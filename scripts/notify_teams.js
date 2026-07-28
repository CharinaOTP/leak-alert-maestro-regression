const fs = require("fs");
const path = require("path");

const webhook = process.env.TEAMS_WEBHOOK_URL;
if (!webhook) {
  console.log("TEAMS_WEBHOOK_URL is not configured; notification skipped.");
  process.exit(0);
}

const status = process.env.TEST_STATUS || "FAILED";
const repository = process.env.GITHUB_REPOSITORY || "Leak Alert regression";
const runId = process.env.GITHUB_RUN_ID || "local";
const server = process.env.GITHUB_SERVER_URL || "";
const runUrl =
  server && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
    ? `${server}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : "";
const resultsDir = process.env.TEST_RESULTS_DIR || "test-results";
const summaryPath = path.join(resultsDir, "test-summary.json");
const summary = fs.existsSync(summaryPath)
  ? JSON.parse(fs.readFileSync(summaryPath, "utf8"))
  : null;
const failure = summary?.primaryFailure;

const payload = {
  type: "message",
  attachments: [
    {
      contentType: "application/vnd.microsoft.card.adaptive",
      contentUrl: null,
      content: {
        $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
        type: "AdaptiveCard",
        version: "1.4",
        body: [
          {
            type: "TextBlock",
            size: "Large",
            weight: "Bolder",
            color: status === "PASSED" ? "Good" : "Attention",
            text: `Leak Alert regression ${status}`,
          },
          {
            type: "FactSet",
            facts: [
              { title: "Repository", value: repository },
              { title: "Run ID", value: runId },
              { title: "Branch", value: process.env.GITHUB_REF_NAME || "local" },
              { title: "Triggered by", value: process.env.GITHUB_ACTOR || "scheduler" },
              { title: "Failed checks", value: String(summary?.failedChecks || 0) },
              ...(failure
                ? [
                    { title: "Failed flow", value: failure.flow },
                    { title: "Failed step", value: failure.step },
                    { title: "Severity", value: failure.severity },
                    { title: "Diagnosis", value: `${failure.confidence}: ${failure.diagnosis}` },
                  ]
                : []),
            ],
          },
          {
            type: "TextBlock",
            wrap: true,
            text:
              status === "PASSED"
                ? "All critical Leak Alert web scenarios passed."
                : `Reason: ${failure?.reason || "One or more critical scenarios failed."}\n\nReview the uploaded screenshots, UI hierarchy, and sanitized command artifacts.`,
          },
        ],
        actions: runUrl
          ? [{ type: "Action.OpenUrl", title: "Open CI run", url: runUrl }]
          : [],
      },
    },
  ],
};

async function sendNotification() {
  const response = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Teams webhook returned HTTP ${response.status}: ${await response.text()}`);
  }

  console.log("Teams notification sent.");
}

sendNotification().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
