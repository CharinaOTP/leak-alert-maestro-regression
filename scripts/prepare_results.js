const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.env.TEST_RESULTS_DIR || "test-results";
const sanitizedRoot =
  process.env.SANITIZED_RESULTS_DIR || `${root.replace(/[\\/]$/, "")}-sanitized`;
const secrets = [
  process.env.TEST_USERNAME,
  process.env.TEST_PASSWORD,
  process.env.LEAK_ALERT_USERNAME,
  process.env.LEAK_ALERT_PASSWORD,
  process.env.TEAMS_WEBHOOK_URL,
].filter(Boolean);

function filesUnder(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(full) : [full];
  });
}

function copySanitized(file) {
  const destination = path.join(sanitizedRoot, path.relative(root, file));
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  if (!/\.(json|log|txt|ya?ml)$/i.test(file)) {
    fs.copyFileSync(file, destination);
    return;
  }
  let text = fs.readFileSync(file, "utf8");
  for (const secret of secrets) text = text.split(secret).join("***REDACTED***");
  fs.writeFileSync(destination, text);
}

function classify(message) {
  if (/ENOTFOUND|ERR_NAME_NOT_RESOLVED|DNS/i.test(message))
    return ["Critical", "Confirmed", "DNS/network access failure"];
  if (/401|403|unauthorized|forbidden/i.test(message))
    return ["Critical", "Confirmed", "Authentication or authorization failure"];
  if (/timed? out|timeout/i.test(message))
    return ["High", "Suspected", "Application, API, or network timeout"];
  if (/assertion|is visible|not visible/i.test(message))
    return ["High", "Suspected", "UI assertion failed; inspect screenshot and hierarchy"];
  return ["High", "Suspected", "Automation step failed; inspect attached artifacts"];
}

const files = filesUnder(root);
files.forEach(copySanitized);

const failures = [];
for (const file of files.filter((item) => /commands.*\.json$/i.test(path.basename(item)))) {
  try {
    const commands = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const entry of commands) {
      if (entry.metadata?.status !== "FAILED") continue;
      const message = entry.metadata?.error?.message || "Maestro command failed.";
      const [severity, confidence, diagnosis] = classify(message);
      failures.push({
        flow: path.basename(file).replace(/^commands-\(|\)\.json$|commands\.json$/g, "") || path.basename(path.dirname(file)),
        step: Object.keys(entry.metadata?.evaluatedCommand || entry.command || {})[0] || "Unknown step",
        reason: message,
        severity,
        confidence,
        diagnosis,
      });
    }
  } catch {}
}

let health;
const healthFile = path.join(root, "api-health.json");
if (fs.existsSync(healthFile)) health = JSON.parse(fs.readFileSync(healthFile, "utf8"));

const primary = failures[0] || (health?.status === "FAILED"
  ? {
      flow: "Endpoint preflight",
      step: "Connect to Leak Alert",
      reason: health.diagnosis,
      severity: "Critical",
      confidence: health.confidence,
      diagnosis: health.diagnosis,
    }
  : null);

const summary = {
  status: process.env.TEST_STATUS || (primary ? "FAILED" : "PASSED"),
  generatedAt: new Date().toISOString(),
  failedChecks: failures.length + (health?.status === "FAILED" ? 1 : 0),
  endpointHealth: health || null,
  primaryFailure: primary,
};

fs.mkdirSync(sanitizedRoot, { recursive: true });
fs.writeFileSync(path.join(sanitizedRoot, "test-summary.json"), JSON.stringify(summary, null, 2));
console.log(`Prepared sanitized results: ${summary.status}; failed checks: ${summary.failedChecks}`);
