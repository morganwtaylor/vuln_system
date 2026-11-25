# Glucora vulnerability machine — grouper and decision engine

Part 2 of the Staff Security take-home. This is the one mechanism whose absence best explains
the 4,902 open findings: **nothing groups findings into root causes and decides on the group**.
Every finding became its own ticket. This code takes the bundle as shipped and makes the decision
with no human in the loop: each fix unit gets one verb, an owner, a reason and a prepared fix.

## Run it

Python 3.9 or later. Standard library only. Nothing to install.

```
python vm_machine.py "<path to bundle folder with README.md>" --out out
GLUCORA_BUNDLE="<same path>" python -m unittest -v
```

Output: `out/decisions.md` (for people) and `out/decisions.json` (all units, all finding ids).
Runtime is under one second.

## What it does

1. **Validate** each finding once. Open is live. Fixed is live if the merge is later than the last
   publish. Dismissed stays dismissed only with a trusted reason (false positive, not in the
   production path). "No fix available" with a fixed version, and "tolerable risk" with no owner
   or end date, are re-opened.
2. **Group** by root cause: scaffold vintage, base image, or package across projects. Every
   runtime instance of a CVE with KEV or a public exploit on an exposed asset breaks out into
   one per-CVE unit, so it does not wait for a platform upgrade. Human findings that note the same
   pattern join one bug-class unit. Firmware components are units with fleet exposure.
3. **Decide** in a fixed sequence: valid, exposed, exploited, safe to fix. CVSS is not used.
   Verbs: `act-now`, `campaign`, `track`, `close`.
4. **Prepare** the fix: target version or scaffold, a canary (lowest exposure, most active
   project), and a gate (human review for a major-version bump, otherwise fan-out after canary).

## Output on the bundle

**4,902 open findings → 118 fix units: 9 act-now, 69 campaign, 35 track, 5 close.**

| act-now unit | Why |
| --- | --- |
| `jose` CVE-2026-916242, 5 projects | KEV, token forgery, EPSS 0.91. Includes `glucose-ingest` and `partner-webhooks` |
| `react-router-dom` CVE-2026-916275, 9 projects | Public exploit; fix is 7.x, so a review gate, no auto-publish |
| firmware `crypto-lib` | BLE-adjacent, all 311,700 devices, no shipped fix |
| PT-2026-07 + BB-4501 | Cross-patient PHI read; same pattern in two apps |
| PT-2026-09, PT-2026-12, PT-2026-21 | Auth bugs with a human repro on PHI/PII services |
| BB-4412 sibling in `onboarding-quiz` | Fixed in storefront; note says the component is shared |
| BB-4530 `labs.glucora.example` | Takeover claim confirmed: the surface scan shows a dangling CNAME |

The three largest campaigns: `lovable-scaffold-2025.03` (1,965 findings, 11 projects),
`lovable-scaffold-2025.06` (817), `node18-alpine` end of life (623). The 2025.03 scaffold has 198
CVEs that recur across its 11 projects, but each project has its own installed versions. So the
fix is "move to the current scaffold's dependency set", not one version bump.

Validation found: 5 fixes merged but not published; 49 dismissals re-opened; 41 dismissals kept.

## What it got wrong, or may get wrong

- **It re-opens all 25 "no fix available" dismissals** because `fixed_version` is set. If the
  scanner fills that field with a version the project cannot take, these are noise.
- **The BB-4412 sibling comes from free text** in a bounty note. Without the note, the machine
  does not find it. It marks the unit "not verified", but still `act-now`: possibly too strong.
- **60 cross-team package campaigns all go to the platform team** to coordinate. That owner is
  a policy choice, not data. Some "app-dependency" packages may really be scaffold-pinned.
- **The canary step delays act-now fixes.** For `jose` (KEV) the canary should be hours, or
  skipped, not a normal cycle.
- **Exposure is per service, not per code path.** A server-only package in an internet-facing
  app counts as exposed.
- **The EPSS threshold (0.10) and the act-now class list are judgment**, not tuned on data.

## What it cannot see in this data

- Reachability: whether the vulnerable function is called.
- What is live: `last_publish` is a date, not the deployed artifact.
- Assets outside the inventory. The bundle shows three: the `clinician-portal` remix with no
  access control, `api-v1.glucora.example` (not in inventory, cert expires in 19 days) and
  `ops-metrics` (anonymous viewer on). This machine only joins against `services.csv`, so it
  makes no decision on them. That is the second build.
- RLS state per table, and whether transmitters reject older signed firmware.

## What it needs from real systems

Lovable workspace API (projects, publishes, remixes, the deployed commit); an SBOM of each
published build and container image; the deploy API; DNS zones; daily KEV and EPSS feeds; the
on-call directory for owners; firmware fleet telemetry; a PR API for the campaign runner.

## What I would build second, and why

**The discovery diff**: compare platform APIs, DNS and the surface scan with the inventory each
day, and make each difference a fix unit. It is second because it does not explain the 4,902.
Those are known findings that nobody grouped. But every decision above joins against the
inventory, and the bundle shows the inventory is wrong in at least three places. So discovery is
what keeps this machine honest.
