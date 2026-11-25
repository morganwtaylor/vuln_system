// Builds the panel deck: node build_deck.js  ->  glucora-vm-panel.pptx
// Numbers come from out/decisions.json (the machine's run on the bundle) and the bundle itself.
const pptxgen = require("pptxgenjs");
const path = require("path");
const { applyTheme } = require(process.env.PPTX_SKILL
  ? path.join(process.env.PPTX_SKILL, "scripts/apply_theme.js")
  : "./apply_theme.js");

const THEME = {
  name: "Glucora VM",
  headFontFace: "Arial",
  bodyFontFace: "Arial",
  colors: {
    dk1: "1C1F22", lt1: "FFFFFF", dk2: "24323A", lt2: "F3F5F6",
    accent1: "D9480F", // act-now: the only warm color in the deck
    accent2: "3D5A66", // built / campaign
    accent3: "9AA5AB", // track, quiet
    accent4: "E3E8EA", // tints
    accent5: "5F6F76", // secondary text
    accent6: "F7E4DA", // act-now tint
    hlink: "3D5A66", folHlink: "5F6F76",
  },
};
const HEX = THEME.colors;

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9"; // 10 x 5.625 in
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "Replacing the queue";
const C = pres.SchemeColor;

// ---------------------------------------------------------------- layouts
pres.defineSlideMaster({
  title: "DARK",
  background: { color: HEX.dk2 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 1.5, w: 8.8, h: 1.4,
      fontSize: 36, bold: true, color: C.background1, valign: "bottom", align: "left", margin: 0 }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: 0.6, y: 3.1, w: 8.8, h: 1.6,
      fontSize: 16, color: C.accent4, valign: "top", margin: 0 }, text: "" } },
  ],
});
pres.defineSlideMaster({
  title: "CONTENT",
  background: { color: "FAFAFA" },
  margin: [0.5, 0.5, 0.5, 0.5],
  slideNumber: { x: 9.2, y: 5.2, w: 0.4, h: 0.25, fontSize: 10, color: HEX.accent5, align: "right" },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.5, y: 0.3, w: 9.0, h: 1.0,
      fontSize: 26, bold: true, color: C.text1, valign: "top", align: "left", margin: 0 }, text: "" } },
  ],
});

let sectionName = "";
function slide(master, section) {
  if (section && section !== sectionName) { pres.addSection({ title: section }); sectionName = section; }
  return pres.addSlide({ masterName: master, sectionTitle: sectionName });
}
const T = (s, text, opts) => s.addText(text, Object.assign({ isTextBox: true, margin: 0, color: C.text1, fontSize: 14 }, opts));
const foot = (s, text) => T(s, text, { x: 0.5, y: 5.15, w: 8.4, h: 0.3, fontSize: 10, color: C.accent5 });
const box = (s, o) => s.addShape(o.round ? pres.shapes.ROUNDED_RECTANGLE : pres.shapes.RECTANGLE,
  Object.assign({ line: { color: o.lineColor || C.accent4, width: o.lineWidth || 1 }, fill: { color: o.fill || C.background1 },
    rectRadius: o.round ? 0.08 : undefined }, o));

// ---------------------------------------------------------------- 1. title
let s = slide("DARK", "Problem");
s.addText("Replacing the queue with a machine that decides", { placeholder: "title" });
s.addText([
  { text: "Glucora vulnerability management, Staff Security take-home", options: { breakLine: true } },
  { text: "Morgan Taylor" },
], { placeholder: "body" });
s.addNotes("Twenty minutes, then questions. I will show the system, then the piece I built running on your data, then what it means for each of your weeks.");

// ---------------------------------------------------------------- 2. collapse
s = slide("CONTENT", "Problem");
s.addText("4,902 open findings are 118 fix units with owners", { placeholder: "title" });
T(s, "4,902", { x: 0.5, y: 1.55, w: 3.2, h: 0.9, fontSize: 60, bold: true });
T(s, "open findings today, each one a ticket, 89% past SLA", { x: 0.5, y: 2.5, w: 3.2, h: 0.6, fontSize: 14, color: C.accent5 });
s.addShape(pres.shapes.RIGHT_ARROW, { x: 3.85, y: 1.85, w: 0.6, h: 0.4, fill: { color: C.accent3 }, line: { color: C.accent3 } });
T(s, "118", { x: 4.6, y: 1.55, w: 2.0, h: 0.9, fontSize: 60, bold: true, color: C.accent2 });
T(s, "fix units, each with one owner, one verb and a prepared fix", { x: 4.6, y: 2.5, w: 2.2, h: 0.8, fontSize: 14, color: C.accent5 });
const verbs = [
  ["9", "act-now", "exploited or exploit-ready on exposed PHI, auth or devices", C.accent1],
  ["69", "campaign", "real and exposed; one change fans out after a canary", C.accent2],
  ["35", "track", "dev-only or internal with no signal: no work", C.accent3],
  ["5", "close", "nothing live", C.accent4],
];
verbs.forEach(([n, v, d], i) => {
  const y = 1.55 + i * 0.85;
  s.addShape(pres.shapes.RECTANGLE, { x: 7.0, y: y + 0.08, w: 0.18, h: 0.5, fill: { color: verbs[i][3] }, line: { color: verbs[i][3] } });
  T(s, [{ text: n + " ", options: { bold: true, fontSize: 20 } }, { text: v, options: { bold: true, fontSize: 14 } }], { x: 7.3, y, w: 2.2, h: 0.35 });
  T(s, d, { x: 7.3, y: y + 0.35, w: 2.2, h: 0.45, fontSize: 11, color: C.accent5 });
});
T(s, "No person picks work from a list. The security lead owns the rules, not the decisions.",
  { x: 0.5, y: 3.9, w: 6.2, h: 0.7, fontSize: 16, bold: true, color: C.accent2 });
foot(s, "Source: vm_machine.py run on the bundle as shipped (out/decisions.json).");
s.addNotes("The queue counts findings. The machine counts root causes. Same data, 118 units. Nine need action this week; everything else is a campaign the platform runs, or no work at all.");

// ---------------------------------------------------------------- 3. root causes
s = slide("CONTENT", "Problem");
s.addText("Five upgrades nobody owns hold 83% of the open findings", { placeholder: "title" });
s.addChart(pres.charts.BAR, [{
  name: "Open findings",
  labels: ["lovable-scaffold-2025.03", "lovable-scaffold-2025.06", "node18-alpine (EOL)", "python3.9-slim (EOL)", "lovable-scaffold-2025.09", "All other root causes"],
  values: [1947, 808, 616, 382, 321, 828],
}], {
  x: 0.4, y: 1.4, w: 5.9, h: 3.6, barDir: "bar", catAxisOrientation: "maxMin",
  chartColors: [HEX.accent2], showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "#,##0",
  dataLabelFontSize: 12, dataLabelColor: HEX.dk1, dataLabelFontFace: "+mn-lt",
  catAxisLabelFontSize: 12, catAxisLabelColor: HEX.dk1, catAxisLabelFontFace: "+mn-lt",
  valAxisHidden: true, valGridLine: { style: "none" }, catGridLine: { style: "none" },
  catAxisLineShow: false, showLegend: false, barGapWidthPct: 45,
});
T(s, [
  { text: "One change per root cause.", options: { bold: true, breakLine: true } },
  { text: "Each scaffold project moves to the current scaffold's dependency set. Each container rebuilds on a supported base image.", options: { breakLine: true } },
  { text: " ", options: { breakLine: true, fontSize: 8 } },
  { text: "A move, not a bump.", options: { bold: true, breakLine: true } },
  { text: "The 2025.03 projects share 198 CVEs, but each has its own installed versions." },
], { x: 6.6, y: 1.5, w: 2.9, h: 3.2, fontSize: 14, valign: "top" });
foot(s, "Open findings by root cause: findings.jsonl joined to services.csv. 4,074 of 4,902 in the top five.");
s.addNotes("This is why tickets per finding fail. 1,947 tickets for one platform decision. The owner of the root cause is the platform team, not the eleven product teams.");

// ---------------------------------------------------------------- 4. the machine
s = slide("CONTENT", "System");
s.addText("Five components run without a person in the loop", { placeholder: "title" });
const comps = [
  ["Discover", "Platform APIs, DNS and surface scan vs the inventory", "Platform team", "second"],
  ["Group", "One key per root cause; hot CVEs break out", "Security lead (keys)", "built"],
  ["Validate", "Once per unit: live, runtime, trusted dismissal", "Machine", "built"],
  ["Decide", "Rules as code give one verb per unit", "Security lead (rules)", "built"],
  ["Fix and verify", "Agent prepares the change; canary; scan the live asset", "Platform team", ""],
];
const bw = 1.62, gap = 0.22, by = 1.5, bh = 2.15;
comps.forEach(([name, what, owner, tag], i) => {
  const x = 0.5 + i * (bw + gap);
  const built = tag === "built";
  box(s, { x, y: by, w: bw, h: bh, round: true, fill: built ? C.accent4 : C.background1,
    lineColor: built ? C.accent2 : C.accent3, lineWidth: built ? 2 : 1 });
  T(s, name, { x: x + 0.12, y: by + 0.15, w: bw - 0.24, h: 0.35, fontSize: 15, bold: true });
  T(s, what, { x: x + 0.12, y: by + 0.55, w: bw - 0.24, h: 1.0, fontSize: 12, valign: "top" });
  T(s, owner, { x: x + 0.12, y: by + 1.65, w: bw - 0.24, h: 0.4, fontSize: 11, color: C.accent5, valign: "bottom" });
  if (i < comps.length - 1) s.addShape(pres.shapes.LINE, { x: x + bw + 0.02, y: by + bh / 2, w: gap - 0.04, h: 0,
    line: { color: HEX.accent3, width: 1.25, endArrowType: "triangle" } });
});
// loop back
const lx1 = 0.5 + bw / 2, lx2 = 0.5 + 4 * (bw + gap) + bw / 2, ly = by + bh + 0.35;
s.addShape(pres.shapes.LINE, { x: lx2, y: by + bh, w: 0, h: 0.35, line: { color: HEX.accent3, width: 1.25, dashType: "dash" } });
s.addShape(pres.shapes.LINE, { x: lx1, y: ly, w: lx2 - lx1, h: 0, line: { color: HEX.accent3, width: 1.25, dashType: "dash" } });
s.addShape(pres.shapes.LINE, { x: lx1, y: by + bh, w: 0, h: 0.35, flipV: true, line: { color: HEX.accent3, width: 1.25, dashType: "dash", endArrowType: "triangle" } });
T(s, "Still there on re-scan means still open. Merged is not fixed.", { x: 2.2, y: ly + 0.08, w: 5.6, h: 0.3, fontSize: 12, color: C.accent5, align: "center" });
box(s, { x: 0.5, y: 4.75, w: 0.25, h: 0.2, fill: C.accent4, lineColor: C.accent2, lineWidth: 2 });
T(s, "Built for Part 2, runs on the bundle", { x: 0.85, y: 4.72, w: 3.2, h: 0.28, fontSize: 12 });
T(s, "Discover is the second build", { x: 4.2, y: 4.72, w: 3.0, h: 0.28, fontSize: 12, color: C.accent5 });
s.addNotes("What runs, who owns it, what breaks it. Discovery breaks on a publish path the API hides; the independent surface scan covers it. The grouper breaks on a bad key; a unit that never closes is the symptom. The decision engine breaks on bad inventory data; unknown data class counts as PHI. At 3x volume, units grow with root causes, not findings.");

// ---------------------------------------------------------------- 5. act-now
s = slide("CONTENT", "System");
s.addText("Nine units need action this week, and CVSS chose none of them", { placeholder: "title" });
const hdr = (t) => ({ text: t, options: { bold: true, fontSize: 13 } });
const rows = [
  [hdr("Unit"), hdr("Why act-now"), hdr("How the fix ships")],
  ["jose, 5 projects", "KEV; token forgery; EPSS 0.91", "Canary in hours, then all 5"],
  ["react-router-dom, 9 projects", "Public exploit; fix is a major version", "Human review of the diff"],
  ["Firmware crypto-lib, 311,700 devices", "BLE-adjacent; no shipped fix", "Minor-change path"],
  ["PT-2026-07 + BB-4501, 2 apps", "Cross-patient PHI read; human repro", "RLS check on every publish"],
  ["PT-2026-09, PT-2026-12, PT-2026-21", "Auth bugs on PHI/PII; human repro", "Prepared fix per service"],
  ["BB-4412 sibling in onboarding-quiz", "Shares a component with a fixed XSS", "Run the repro; port the fix"],
  ["BB-4530 labs.glucora.example", "Dangling CNAME, confirmed by scan", "Remove the DNS record"],
];
s.addTable(rows.map((r, i) => r.map((c, j) => typeof c === "string"
  ? { text: c, options: { bold: j === 0, fontSize: 13 } } : c)), {
  x: 0.5, y: 1.35, w: 9.0, colW: [3.3, 3.2, 2.5], fontSize: 13, color: HEX.dk1, fontFace: "Arial",
  border: { type: "solid", pt: 0.75, color: "E0E0E0" }, rowH: 0.42, valign: "middle", margin: [0.04, 0.08, 0.04, 0.08],
});
foot(s, "CVE-2026-916242 (jose), CVE-2026-916275 (react-router-dom). The BB-4412 sibling comes from a bounty note and is not verified.");
s.addNotes("Two of these are scanner CVEs, broken out of slow campaigns because of KEV or a public exploit. The rest are human findings or firmware: the queue had them on the same boards as 4,900 dependency bumps. BB-4533, the 'critical' missing CAPTCHA, closes: no exploit path.");

// ---------------------------------------------------------------- 6. validation
s = slide("CONTENT", "System");
s.addText("Validation changes what counts as open: merged is not fixed", { placeholder: "title" });
const tiles = [
  ["5", "fixes merged but not published", "Stay open. The owner gets a publish request.", C.accent1],
  ["49", "dismissals reopened", "\"No fix\" when a fix exists, or risk accepted with no owner or end date.", C.accent2],
  ["41", "dismissals kept", "False positive, or not in the production path.", C.accent3],
  ["907", "dev-only findings", "Tracked. No work until an input changes.", C.accent3],
];
tiles.forEach(([n, label, desc, col], i) => {
  const x = 0.5 + i * 2.3;
  box(s, { x, y: 1.5, w: 2.1, h: 2.9, round: true, fill: C.background1, lineColor: C.accent4 });
  T(s, n, { x: x + 0.2, y: 1.7, w: 1.8, h: 0.8, fontSize: 44, bold: true, color: col });
  T(s, label, { x: x + 0.2, y: 2.55, w: 1.75, h: 0.6, fontSize: 14, bold: true, valign: "top" });
  T(s, desc, { x: x + 0.2, y: 3.2, w: 1.75, h: 1.1, fontSize: 12, color: C.accent5, valign: "top" });
});
foot(s, "Merged = fix_merged_at later than last_publish. 4,956 live = 4,902 open + 49 re-opened + 5 merged-not-live.");
s.addNotes("The queue closed these on merge or on a dismissal click. The machine checks the live asset. Re-opening all 25 'no fix available' dismissals may be noise if the scanner always fills fixed_version: that is on my what-it-got-wrong list.");

// ---------------------------------------------------------------- 7. engineer week
s = slide("CONTENT", "People");
s.addText("Your normal week: one prepared change, not 200 tickets", { placeholder: "title" });
const roles = [
  ["Lovable builder", "Usually nothing. When a campaign reaches your project, one tested change arrives with a summary.", "Read the diff and publish. No unreviewed agent fixes on PHI projects."],
  ["Container owner", "One base-image PR with CI green. One PR per base image, not one per CVE.", "Merge and deploy in the campaign window."],
  ["Firmware engineer", "Units arrive as release scope, tagged by code path and attack vector.", "Keep the component list current."],
];
roles.forEach(([role, get, owe], i) => {
  const x = 0.5 + i * 3.05;
  box(s, { x, y: 1.4, w: 2.85, h: 2.95, round: true, fill: C.background1, lineColor: C.accent4 });
  T(s, role, { x: x + 0.2, y: 1.55, w: 2.5, h: 0.35, fontSize: 16, bold: true });
  T(s, "You get", { x: x + 0.2, y: 2.0, w: 2.5, h: 0.25, fontSize: 11, bold: true, color: C.accent2 });
  T(s, get, { x: x + 0.2, y: 2.25, w: 2.5, h: 0.95, fontSize: 13, valign: "top" });
  T(s, "You owe", { x: x + 0.2, y: 3.25, w: 2.5, h: 0.25, fontSize: 11, bold: true, color: C.accent2 });
  T(s, owe, { x: x + 0.2, y: 3.5, w: 2.5, h: 0.7, fontSize: 13, valign: "top" });
});
box(s, { x: 0.5, y: 4.5, w: 9.0, h: 0.6, round: true, fill: C.accent4, lineColor: C.accent4 });
T(s, [{ text: "Security lead: ", options: { bold: true } },
  { text: "owns the rules and keys, approves exceptions with an owner and an end date, and picks no work." }],
  { x: 0.7, y: 4.55, w: 8.6, h: 0.5, fontSize: 13, valign: "middle" });
s.addNotes("The machine owes you tested changes and silence about findings that do not matter. You owe it a review and a publish inside the window. Teams that already ask the Lovable agent to fix things keep that speed; the campaign is reviewed once, canaried, then fanned out.");

// ---------------------------------------------------------------- 8. firmware
s = slide("CONTENT", "People");
s.addText("All 311,700 transmitters carry a BLE-reachable bug today", { placeholder: "title" });
s.addChart(pres.charts.BAR, [{
  name: "Transmitters", labels: ["tx2-fw-3.41.2", "tx2-fw-3.40.0", "tx2-fw-3.38.5", "tx1-fw-2.19.7 (gen 1)"],
  values: [164300, 48900, 37100, 61400],
}], {
  x: 0.4, y: 1.35, w: 4.6, h: 3.2, barDir: "bar", catAxisOrientation: "maxMin",
  chartColors: [HEX.accent2], showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "#,##0",
  dataLabelFontSize: 12, dataLabelColor: HEX.dk1, dataLabelFontFace: "+mn-lt",
  catAxisLabelFontSize: 12, catAxisLabelColor: HEX.dk1, catAxisLabelFontFace: "+mn-lt",
  valAxisHidden: true, valGridLine: { style: "none" }, catGridLine: { style: "none" }, catAxisLineShow: false,
  showLegend: false, barGapWidthPct: 45, showTitle: true, title: "Fleet by firmware version",
  titleFontSize: 12, titleColor: HEX.accent5, titleFontFace: "+mn-lt",
});
T(s, [
  { text: "crypto-lib: act-now. ", options: { bold: true, color: C.accent1 } },
  { text: "Unfixed in every version. Goes to the crypto/ minor-change path.", options: { breakLine: true } },
  { text: " ", options: { breakLine: true, fontSize: 6 } },
  { text: "ble-host: campaign. ", options: { bold: true, color: C.accent2 } },
  { text: "147,400 devices (47%) on older versions. Gen 1 needs a backport build.", options: { breakLine: true } },
  { text: " ", options: { breakLine: true, fontSize: 6 } },
  { text: "rtos-kernel, bootloader: track. ", options: { bold: true } },
  { text: "Need a foothold or physical access.", options: { breakLine: true } },
  { text: " ", options: { breakLine: true, fontSize: 6 } },
  { text: "Where it stops: ", options: { bold: true } },
  { text: "rollout stages and algo/, alerts/, calibration/ stay with the firmware lead and clinical safety." },
], { x: 5.3, y: 1.4, w: 4.2, h: 3.3, fontSize: 13, valign: "top" });
foot(s, "Fixed = share of the fleet on a fixed version. About 11% never update: a standing risk with a named owner.");
s.addNotes("Same loop, different clock: 6 to 8 weeks disclosure to 100%. The machine ranks and routes; it never holds or advances a rollout stage. The gen 1 pipeline has not run in 390 days and lives on one machine: that is a leadership ask, not a ticket. Assumption to check: the transmitter rejects older signed images, or HTTP delivery from fw-cdn is a downgrade path.");

// ---------------------------------------------------------------- 9. bug class
s = slide("CONTENT", "People");
s.addText("A bug class with no CVE becomes a check on every publish", { placeholder: "title" });
const steps = [
  ["Write the check", "AI drafts it from the PoC; a human confirms one known case"],
  ["Sweep the estate", "Run it on every asset in the inventory, same day"],
  ["One unit", "Hits join one unit; a working PoC counts as exploited"],
  ["Fix once", "At the platform layer when possible"],
  ["Keep the check", "It runs on each publish, so the class cannot return"],
];
steps.forEach(([h, d], i) => {
  const x = 0.5 + i * 1.84;
  s.addShape(pres.shapes.OVAL, { x, y: 1.45, w: 0.5, h: 0.5, fill: { color: C.accent2 }, line: { color: C.accent2 } });
  T(s, String(i + 1), { x, y: 1.45, w: 0.5, h: 0.5, fontSize: 16, bold: true, color: C.background1, align: "center", valign: "middle" });
  T(s, h, { x, y: 2.05, w: 1.7, h: 0.35, fontSize: 14, bold: true });
  T(s, d, { x, y: 2.42, w: 1.65, h: 1.0, fontSize: 12, color: C.accent5, valign: "top" });
});
box(s, { x: 0.5, y: 3.65, w: 9.0, h: 1.3, round: true, fill: C.accent6, lineColor: C.accent6 });
T(s, [
  { text: "In the bundle: ", options: { bold: true } },
  { text: "PT-2026-07 (RLS missing on 8 of 11 readings tables) and BB-4501 (caregiver share link) are the same missing tenant check. caregiver-app has RLS coverage \"none\". The machine makes one unit and one RLS check across all 26 Lovable projects." },
], { x: 0.75, y: 3.75, w: 8.5, h: 1.1, fontSize: 14, valign: "middle" });
s.addNotes("Cost is per class, not per instance, so it holds at 3x. Discovery is what makes the sweep possible: you cannot sweep what you do not know exists.");

// ---------------------------------------------------------------- 10. measurement
s = slide("CONTENT", "Proof");
s.addText("Three numbers for the board, starting from today's baseline", { placeholder: "title" });
const board = [
  ["9", "act-now units open", "Target: none older than 14 days.", C.accent1],
  ["22%", "of services on a supported platform", "10 of 45 on the current scaffold or a supported base image.", C.accent2],
  ["0%", "of transmitters free of BLE-reachable bugs", "crypto-lib is unfixed in every shipped version.", C.accent1],
];
board.forEach(([n, label, desc, col], i) => {
  const x = 0.5 + i * 3.05;
  box(s, { x, y: 1.4, w: 2.85, h: 2.5, round: true, fill: C.background1, lineColor: C.accent4 });
  T(s, n, { x: x + 0.2, y: 1.55, w: 2.5, h: 0.85, fontSize: 48, bold: true, color: col });
  T(s, label, { x: x + 0.2, y: 2.45, w: 2.5, h: 0.6, fontSize: 14, bold: true, valign: "top" });
  T(s, desc, { x: x + 0.2, y: 3.1, w: 2.5, h: 0.7, fontSize: 12, color: C.accent5, valign: "top" });
});
T(s, [{ text: "Fixed = ", options: { bold: true } }, { text: "live where the risk was, and a new scan of the live asset is clean." }],
  { x: 0.5, y: 4.1, w: 9.0, h: 0.35, fontSize: 15 });
T(s, "Stop reporting: total open findings, and CVSS SLA adherence (31% last quarter). Both reward closing tickets, not removing risk.",
  { x: 0.5, y: 4.5, w: 9.0, h: 0.5, fontSize: 13, color: C.accent5 });
s.addNotes("Daily numbers for us: arrivals that joined an existing unit versus new units, coverage, merged-but-not-live, decision changes and their cause, and unreviewed agent publishes on PHI projects, target zero. The 14-day target is my proposal, not data.");

// ---------------------------------------------------------------- 11. limits + second build
s = slide("CONTENT", "Proof");
s.addText("Its blind spot is the inventory, so discovery is the second build", { placeholder: "title" });
T(s, "What it gets wrong", { x: 0.5, y: 1.4, w: 4.3, h: 0.35, fontSize: 16, bold: true });
T(s, [
  { text: "Re-opens all 25 \"no fix available\" dismissals; may be noise", options: { bullet: true, breakLine: true } },
  { text: "Finds the BB-4412 sibling only from free text in a note", options: { bullet: true, breakLine: true } },
  { text: "Its canary step can delay a KEV fix", options: { bullet: true, breakLine: true } },
  { text: "Exposure is per service, not per code path; no reachability", options: { bullet: true } },
], { x: 0.5, y: 1.85, w: 4.3, h: 2.6, fontSize: 13, paraSpaceAfter: 8, valign: "top" });
box(s, { x: 5.2, y: 1.4, w: 4.3, h: 3.55, round: true, fill: C.background1, lineColor: C.accent2, lineWidth: 2 });
T(s, "Live, but not in the inventory", { x: 5.45, y: 1.55, w: 3.9, h: 0.35, fontSize: 16, bold: true });
T(s, [
  { text: "clinician-portal-rx-share-remix", options: { bold: true, breakLine: true } },
  { text: "Published remix of a PHI app, no access control", options: { breakLine: true } },
  { text: " ", options: { breakLine: true, fontSize: 6 } },
  { text: "api-v1.glucora.example", options: { bold: true, breakLine: true } },
  { text: "Legacy Express API; certificate expires in 19 days", options: { breakLine: true } },
  { text: " ", options: { breakLine: true, fontSize: 6 } },
  { text: "ops-metrics.glucora.example", options: { bold: true, breakLine: true } },
  { text: "Dashboard with anonymous viewer enabled" },
], { x: 5.45, y: 2.0, w: 3.9, h: 2.1, fontSize: 13, valign: "top" });
T(s, "The machine joins against services.csv, so today it makes no decision on these.",
  { x: 5.45, y: 4.15, w: 3.9, h: 0.65, fontSize: 12, color: C.accent5, valign: "top" });
s.addNotes("Discovery is second because it does not explain the 4,902: those are known findings nobody grouped. But every decision joins against the inventory, and the inventory is wrong in at least three places. Needs from real systems: platform publish and remix APIs, an SBOM per published build, DNS zones, daily KEV and EPSS, the on-call directory, firmware telemetry, a PR API.");

// ---------------------------------------------------------------- 12. leadership
s = slide("DARK", "Proof");
s.addText("What I need from leadership", { placeholder: "title" });
s.addText([
  { text: "Platform owns scaffold and base-image campaigns, with time in every cycle", options: { bullet: { type: "number" }, breakLine: true } },
  { text: "The machine may take an unowned PHI asset offline", options: { bullet: { type: "number" }, breakLine: true } },
  { text: "Every shipped firmware line keeps a build that ran in the last 90 days", options: { bullet: { type: "number" }, breakLine: true } },
  { text: "An act-now unit outranks feature work", options: { bullet: { type: "number" } } },
], { placeholder: "body", paraSpaceAfter: 6 });
s.addNotes("What we kill: tickets per finding, CVSS SLAs, the weekly breach review, the firmware spreadsheet. What I refuse: a queue team, a person who triages findings, severity without an exploit path, and a merge counted as a fix.");

(async () => {
  const out = "glucora-vm-panel.pptx";
  await pres.writeFile({ fileName: out });
  await applyTheme(out, THEME);
  console.log("wrote " + out);
})();
