#!/usr/bin/env python3
"""Glucora vulnerability machine: the grouper and the decision engine.

Takes the take-home bundle as input. Groups every finding into fix units by
root cause, validates each unit once, and gives each unit one verb
(act-now, campaign, track, close) with an owner, a reason and a prepared fix.
No person is in the loop. Standard library only.

    python vm_machine.py <bundle_dir> [--out out]
"""
import argparse
import collections
import csv
import json
import os
import re
import sys

VERB_ORDER = {"act-now": 0, "campaign": 1, "track": 2, "close": 3}

# Rule constants. The security lead owns these; changing one is a code review.
EPSS_CAMPAIGN = 0.10                      # below this, low-exposure units are tracked
HUMAN_ACT_NOW_CLASSES = {"authorization", "authentication", "ssrf", "injection"}
TRUSTED_DISMISSALS = {"dismissed: false positive", "dismissed: not used in production path"}
CONNECTIVITY_COMPONENTS = {"ble-host": "ble/", "crypto-lib": "crypto/"}  # assumption: component -> source path
PLATFORM_OWNER = "platform-oncall@glucora.example"  # policy: platform team owns scaffold and base-image campaigns


# --------------------------------------------------------------------------- load

def load(bundle):
    def rows(name):
        with open(os.path.join(bundle, name), newline="", encoding="utf-8") as fh:
            return list(csv.DictReader(fh))

    with open(os.path.join(bundle, "findings.jsonl"), encoding="utf-8") as fh:
        findings = [json.loads(line) for line in fh if line.strip()]
    return {
        "findings": findings,
        "services": {s["project"]: s for s in rows("services.csv")},
        "intel": {r["cve"]: r for r in rows("vuln_intel.csv")},
        "human": rows("human_findings.csv"),
        "surface": rows("external_surface.csv"),
        "fleet": rows("fleet.csv"),
        "fw": rows("firmware_components.csv"),
    }


# --------------------------------------------------------------------------- service context

def exposure(svc):
    """high: internet + PHI/PII. medium: internet, or internal PHI. low: the rest.
    Unknown data class counts as PHI (worst case)."""
    if svc is None:
        return "high"
    data = svc["data_class"] if svc["data_class"] in {"phi", "pii", "internal", "public"} else "phi"
    internet = svc["internet_facing"] == "yes"
    if internet and data in {"phi", "pii"}:
        return "high"
    if internet or data == "phi":
        return "medium"
    return "low"


EXPOSURE_RANK = {"high": 0, "medium": 1, "low": 2}


def major(version):
    m = re.match(r"\D*(\d+)", version or "")
    return int(m.group(1)) if m else None


def current_scaffold(services):
    vintages = sorted({s["scaffold_or_base"] for s in services.values() if s["kind"] == "lovable"})
    return vintages[-1] if vintages else None


def supported_base(services, base):
    """Pick a supported base image with the same runtime family, from the estate itself."""
    family = base.split("-")[0].rstrip("0123456789.")
    options = sorted({s["scaffold_or_base"] for s in services.values()
                      if s["kind"] == "container" and "end of life" not in s["scaffold_or_base"]
                      and s["scaffold_or_base"].startswith(family)})
    return options[-1] if options else None


# --------------------------------------------------------------------------- step 3: validate

def validate(f, svc):
    """Return (live, note). live = the risk is still on a running asset."""
    status = f["status"]
    if status == "open":
        return True, ""
    if status == "fixed":
        merged, published = f.get("fix_merged_at", ""), (svc or {}).get("last_publish", "")
        if merged and published and merged > published:
            return True, "fix merged but not published: not live"
        return False, "fixed and published"
    if status == "dismissed":
        reason = f.get("notes", "")
        if reason in TRUSTED_DISMISSALS:
            return False, reason
        if reason == "dismissed: no fix available" and f.get("fixed_version"):
            return True, "dismissed as 'no fix available' but a fixed version now exists"
        if reason == "dismissed: tolerable risk":
            return True, "risk acceptance with no owner or end date: re-opened"
        return True, "dismissed without a trusted reason: re-opened"
    return True, "unknown status"


def signals(f, intel):
    i = intel.get(f["cve"], {})
    return {
        "kev": i.get("kev") == "yes",
        "exploit": i.get("exploit_public") == "yes",
        "epss": float(i.get("epss") or 0),
        "cvss": float(i.get("cvss") or f.get("cvss") or 0),
        "summary": i.get("summary", ""),
    }


# --------------------------------------------------------------------------- step 2: group

def hot_cves(data):
    """CVEs with exploitation evidence on at least one exposed runtime asset."""
    hot = set()
    for f in data["findings"]:
        sig = signals(f, data["intel"])
        if (sig["kev"] or sig["exploit"]) and f["manifest_scope"] == "runtime" \
                and exposure(data["services"].get(f["project"])) in {"high", "medium"}:
            hot.add(f["cve"])
    return hot


def group_key(f, svc, hot):
    """The root cause a finding belongs to.

    Every runtime instance of a hot CVE breaks out of its slow platform campaign into
    one per-CVE unit, so it does not wait for the upgrade and is fixed everywhere at once.
    """
    if f["cve"] in hot and f["manifest_scope"] == "runtime":
        return ("exploited-cve", f["cve"])
    if f["layer"] == "scaffold":
        return ("scaffold", svc["scaffold_or_base"] if svc else "unknown-scaffold")
    if f["layer"] == "base-image":
        return ("base-image", svc["scaffold_or_base"] if svc else "unknown-base")
    return ("package", f"{f['ecosystem']}:{f['package']}")


# --------------------------------------------------------------------------- step 4: decide

def decide_scanner_unit(unit):
    live = [m for m in unit["members"] if m["live"]]
    if not live:
        return "close", "no live findings"
    runtime = [m for m in live if m["scope"] == "runtime"]
    if not runtime:
        return "track", "all live findings are development-scope only"
    exploited = [m for m in runtime if (m["kev"] or m["exploit"]) and m["exposure"] in {"high", "medium"}]
    if exploited:
        tag = "KEV" if any(m["kev"] for m in exploited) else "public exploit"
        return "act-now", f"{tag} on {len({m['project'] for m in exploited})} exposed project(s)"
    exposed = [m for m in runtime if m["exposure"] in {"high", "medium"}]
    max_epss = max(m["epss"] for m in runtime)
    if exposed:
        return "campaign", f"runtime findings on {len({m['project'] for m in exposed})} exposed project(s), no exploitation signal"
    if max_epss >= EPSS_CAMPAIGN:
        return "campaign", f"internal only, but EPSS {max_epss:.2f}"
    return "track", f"internal, non-PHI, no exploitation signal (max EPSS {max_epss:.2f})"


def build_scanner_units(data):
    services, intel = data["services"], data["intel"]
    hot = hot_cves(data)
    units = {}
    for f in data["findings"]:
        svc = services.get(f["project"])
        sig = signals(f, intel)
        live, note = validate(f, svc)
        key = group_key(f, svc, hot)
        unit = units.setdefault(key, {"kind": key[0], "root_cause": key[1], "members": []})
        unit["members"].append({
            "finding_id": f["finding_id"], "project": f["project"], "package": f["package"],
            "installed": f["installed_version"], "fixed": f["fixed_version"], "cve": f["cve"],
            "status": f["status"], "live": live, "validation": note, "scope": f["manifest_scope"],
            "exposure": exposure(svc), "layer": f["layer"],
            "major_bump": (major(f["fixed_version"]) or 0) > (major(f["installed_version"]) or 0),
            **sig,
        })
    out = []
    target_scaffold = current_scaffold(services)
    for unit in units.values():
        verb, why = decide_scanner_unit(unit)
        live = [m for m in unit["members"] if m["live"]]
        projects = sorted({m["project"] for m in live})
        teams = sorted({services[p]["team"] for p in projects if p in services})
        needs_review = any(m["major_bump"] for m in live)
        kind, root = unit["kind"], unit["root_cause"]
        if kind in {"scaffold", "base-image"}:
            owner = PLATFORM_OWNER
        elif len(teams) == 1 and projects:
            owner = services[projects[0]]["owner"]
        else:
            owner = PLATFORM_OWNER + " (coordinates " + ", ".join(teams) + ")" if teams else PLATFORM_OWNER
        out.append({
            "unit_id": f"{kind}:{root}",
            "kind": kind,
            "root_cause": root,
            "verb": verb,
            "why": why,
            "owner": owner,
            "teams": teams,
            "projects": projects,
            "live_findings": len(live),
            "all_findings": len(unit["members"]),
            "max_epss": max((m["epss"] for m in live), default=0),
            "kev": any(m["kev"] for m in live),
            "public_exploit": any(m["exploit"] for m in live),
            "worst_exposure": min((m["exposure"] for m in live), key=EXPOSURE_RANK.get, default="low"),
            "needs_review": needs_review,
            "fix": prepared_fix(kind, root, live, services, target_scaffold, needs_review),
            "flags": sorted({m["validation"] for m in unit["members"] if m["validation"] and m["live"]}),
            "summary": sorted({m["summary"].split(": ", 1)[-1] for m in live})[:3],
            "finding_ids": [m["finding_id"] for m in live],
        })
    return out


def canary(projects, services):
    """Lowest exposure first, then the most active project, so a break shows fast and hurts least."""
    ranked = sorted(projects, key=lambda p: (-EXPOSURE_RANK[exposure(services.get(p))],
                                             -int((services.get(p) or {}).get("publishes_30d") or 0), p))
    return ranked[0] if ranked else None


def prepared_fix(kind, root, live, services, target_scaffold, needs_review):
    projects = sorted({m["project"] for m in live})
    if not projects:
        return "none: nothing live"
    gate = "human review of the diff before any publish (major-version bump)" if needs_review \
        else "automatic fan-out after a green canary"
    first = canary(projects, services)
    if kind == "scaffold":
        if root == target_scaffold:
            return (f"current scaffold still carries these: ask the platform vendor for a scaffold patch; "
                    f"meanwhile pin fixed versions in {len(projects)} project(s). Canary {first}; {gate}.")
        return (f"move {len(projects)} project(s) from {root} to the {target_scaffold} dependency set. "
                f"Canary {first}; {gate}.")
    if kind == "base-image":
        target = supported_base(services, root) if "end of life" in root else root + " (latest patch)"
        return f"rebuild {len(projects)} service(s) on {target}. Canary {first}; {gate}."
    fixed = sorted({m["fixed"] for m in live if m["fixed"]}, key=lambda v: [int(x) for x in re.findall(r"\d+", v)])
    pkg = sorted({m["package"] for m in live})
    target = (f">= {fixed[0]}" if len(fixed) == 1 else f"each project's fixed version (highest {fixed[-1]})") \
        if fixed else "a fixed version"
    return f"bump {', '.join(pkg)} to {target} in {len(projects)} project(s). Canary {first}; {gate}."


# --------------------------------------------------------------------------- human findings (bug classes)

def build_human_units(data):
    services, surface = data["services"], data["surface"]
    by_id = {h["id"]: h for h in data["human"]}
    parent = {}
    for h in data["human"]:
        m = re.search(r"same pattern as ([A-Z]+-\d+-?\d*)", h["notes"], re.I)
        parent[h["id"]] = m.group(1) if m and m.group(1) in by_id else h["id"]

    groups = collections.defaultdict(list)
    for h in data["human"]:
        groups[parent[h["id"]]].append(h)

    units = []
    for root, members in groups.items():
        lead = by_id[root]
        live = [h for h in members if h["status"] in {"open", "triage"}]
        verb, why, flags = "close", "fixed or closed", []
        projects = sorted({h["project"] for h in members})
        if live:
            cls = lead["class"]
            sensitive = [h for h in live if (services.get(h["project"]) or {}).get("data_class", "phi") in {"phi", "pii"}]
            if cls == "dns":
                host = re.search(r"([a-z0-9-]+\.glucora\.example)", lead["title"])
                hit = [s for s in surface if host and s["hostname"] == host.group(1)]
                if hit and "dangling" in hit[0]["notes"]:
                    verb, why = "act-now", f"claim confirmed by the surface scan: {hit[0]['notes']}"
                else:
                    verb, why = "track", "claim not confirmed by the surface scan"
            elif cls in HUMAN_ACT_NOW_CLASSES and sensitive:
                verb, why = "act-now", f"{cls} bug with a human repro on a PHI/PII service (repro counts as exploited)"
            else:
                verb, why = "campaign", f"{cls} bug; class not on the act-now list"
            flags = [f"{h['id']}: {h['notes']}" for h in live if h["notes"]]
        owner = (services.get(lead["project"]) or {}).get("owner", "security lead (no owner in inventory)")
        units.append({
            "unit_id": f"bug-class:{root}", "kind": "bug-class", "root_cause": f"{lead['class']}: {lead['title']}",
            "verb": verb, "why": why, "owner": owner, "projects": projects,
            "live_findings": len(live), "all_findings": len(members),
            "fix": ("none" if not live else
                    "remove the DNS record; then check every CNAME on each DNS change" if lead["class"] == "dns" else
                    "write the pattern as a check, sweep every project, then keep it on each publish"),
            "flags": flags, "finding_ids": [h["id"] for h in members],
            "worst_exposure": min((exposure(services.get(p)) for p in projects), key=EXPOSURE_RANK.get),
            "needs_review": False,
        })

    # A fixed bug whose note names another project: the same component lives there. Sweep it.
    names = set(services)
    for h in data["human"]:
        if h["status"] != "fixed":
            continue
        for p in sorted(n for n in names if n != h["project"] and re.search(rf"\b{re.escape(n)}\b", h["notes"])):
            svc = services[p]
            sensitive = svc["data_class"] in {"phi", "pii"}
            units.append({
                "unit_id": f"bug-class:{h['id']}->{p}", "kind": "bug-class",
                "root_cause": f"{h['class']}: {h['title']} (sibling of fixed {h['id']})",
                "verb": "act-now" if h["class"] in HUMAN_ACT_NOW_CLASSES and sensitive else "campaign",
                "why": f"{h['id']} was fixed in {h['project']}; the note says {p} shares the component. Not verified.",
                "owner": svc["owner"], "projects": [p], "live_findings": 1, "all_findings": 1,
                "fix": f"run the {h['id']} repro against {p}; port the fix", "flags": [h["notes"]],
                "finding_ids": [h["id"]], "worst_exposure": exposure(svc), "needs_review": False,
            })
    return units


# --------------------------------------------------------------------------- firmware

def build_firmware_units(data):
    fleet = {r["firmware_version"]: int(r["transmitters"]) for r in data["fleet"]}
    total = sum(fleet.values())
    units = []
    for c in data["fw"]:
        versions = [v for v in c["affected_firmware_versions"].split(";") if v]
        exposed = sum(fleet.get(v, 0) for v in versions)
        unfixed = "unfixed" in c["notes"]
        vector = c["attack_vector"]
        if vector == "adjacent":
            verb = "act-now" if unfixed else "campaign"
            why = (f"BLE-adjacent, {exposed:,} devices ({exposed / total:.0%}); "
                   + ("no shipped firmware fixes it" if unfixed else "a fixed release exists; adoption is the gap"))
        else:
            verb, why = "track", f"{vector} vector: needs a prior foothold; {exposed:,} devices"
        path = CONNECTIVITY_COMPONENTS.get(c["component"])
        route = f"minor-change path ({path}): regression suite only" if path else "path not mapped: firmware lead decides"
        units.append({
            "unit_id": f"firmware:{c['component']}", "kind": "firmware", "root_cause": f"{c['component']} {c['installed_version']}",
            "verb": verb, "why": why, "owner": "firmware-oncall@glucora.example", "projects": versions,
            "live_findings": len(versions), "all_findings": len(versions),
            "fix": f"{c['component']} -> {c['fixed_version']}; {route}. Rollout stages stay with the firmware lead and clinical safety.",
            "flags": [c["notes"]], "finding_ids": [c["cve"]], "worst_exposure": "high" if vector == "adjacent" else "low",
            "needs_review": False, "devices_exposed": exposed, "fleet_share": round(exposed / total, 3),
        })
    return units


# --------------------------------------------------------------------------- run

def rank(u):
    return (VERB_ORDER[u["verb"]], not u.get("kev", False), not u.get("public_exploit", False),
            EXPOSURE_RANK.get(u.get("worst_exposure", "low"), 2), -u.get("max_epss", 0), -u["live_findings"])


def run(bundle):
    data = load(bundle)
    units = build_scanner_units(data) + build_human_units(data) + build_firmware_units(data)
    units.sort(key=rank)
    open_findings = sum(1 for f in data["findings"] if f["status"] == "open")
    live_scanner = sum(u["live_findings"] for u in units if u["kind"] not in {"bug-class", "firmware"})
    notes = collections.Counter(validate(f, data["services"].get(f["project"]))[1]
                                for f in data["findings"] if f["status"] != "open")
    return {
        "input": {"findings": len(data["findings"]), "open_findings": open_findings,
                  "live_findings_after_validation": live_scanner,
                  "validation": dict(notes),
                  "human_findings": len(data["human"]), "firmware_components": len(data["fw"])},
        "units_by_verb": dict(collections.Counter(u["verb"] for u in units)),
        "units": units,
    }


def to_markdown(result):
    i, u = result["input"], result["units"]
    lines = ["# Machine output", "",
             f"Input: {i['open_findings']:,} open scanner findings ({i['findings']:,} total), "
             f"{i['human_findings']} human findings, {i['firmware_components']} firmware components.", "",
             f"After validation: {i['live_findings_after_validation']:,} live scanner findings. "
             "Non-open findings the machine re-checked: "
             + "; ".join(f"{k} ({v})" for k, v in sorted(i["validation"].items(), key=lambda x: -x[1])) + ".", "",
             "Output: " + ", ".join(f"{n} {v}" for v, n in sorted(result["units_by_verb"].items(), key=lambda x: VERB_ORDER[x[0]])) + " units.", ""]
    for verb in ("act-now", "campaign", "track", "close"):
        rows = [x for x in u if x["verb"] == verb]
        if not rows:
            continue
        lines += [f"## {verb} ({len(rows)})", "", "| Unit | Live findings | Projects | Why | Owner | Prepared fix |", "| --- | --- | --- | --- | --- | --- |"]
        for x in rows if verb in {"act-now", "campaign"} else rows[:15]:
            lines.append(f"| `{x['unit_id']}` | {x['live_findings']} | {len(x['projects'])} | {x['why']} | {x['owner']} | {x['fix']} |")
        if verb not in {"act-now", "campaign"} and len(rows) > 15:
            lines.append(f"| ... {len(rows) - 15} more in decisions.json | | | | | |")
        lines.append("")
    flagged = [x for x in u if x["flags"] and x["verb"] != "close"]
    if flagged:
        lines += ["## Flags the machine raised", ""]
        for x in flagged:
            for fl in x["flags"]:
                lines.append(f"- `{x['unit_id']}`: {fl}")
        lines.append("")
    return "\n".join(lines)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("bundle", help="path to the unzipped bundle folder (the one with README.md)")
    ap.add_argument("--out", default="out", help="output folder (default: out)")
    a = ap.parse_args(argv)
    result = run(a.bundle)
    os.makedirs(a.out, exist_ok=True)
    with open(os.path.join(a.out, "decisions.json"), "w", encoding="utf-8") as fh:
        json.dump(result, fh, indent=2)
    with open(os.path.join(a.out, "decisions.md"), "w", encoding="utf-8") as fh:
        fh.write(to_markdown(result))
    i = result["input"]
    print(f"{i['open_findings']:,} open findings -> {len(result['units'])} fix units: {result['units_by_verb']}")
    for x in result["units"]:
        if x["verb"] == "act-now":
            print(f"  act-now  {x['unit_id']}: {x['why']}")
    print(f"wrote {a.out}/decisions.json and {a.out}/decisions.md")
    return 0


if __name__ == "__main__":
    sys.exit(main())
