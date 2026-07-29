const fs = require("fs");

const timeoutMs = Number(process.env.API_HEALTH_TIMEOUT_MS || 15000);
const outputPath = process.env.API_HEALTH_OUTPUT || "test-results/api-health.json";
const webhook = process.env.TEAMS_WEBHOOK_URL;

const probes = [
  {
    name: "Leak Alert web portal",
    url: "https://dev-myportal.davao-water.gov.ph/gis/leak/",
    method: "GET",
    expected: [200],
  },
  {
    name: "DCWD GIS API gateway",
    url: "https://dev-api.davao-water.gov.ph/dcwd-gis/api/v1/",
    method: "GET",
    expected: [404],
  },
  {
    name: "Authentication API",
    url: "https://dev-api.davao-water.gov.ph/dcwd-gis/api/v1/admin/userlogin/login",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "API-HEALTHCHECK-NONEXISTENT",
      password: "invalid-healthcheck-credential",
    }),
    expected: [400, 401],
  },
  {
    name: "Protected Leak Reports API",
    url: "https://dev-api.davao-water.gov.ph/dcwd-gis/api/v1/admin/GetLeakReports/GetAllLeakReports?PageIndex=1&PageSize=1",
    method: "GET",
    expected: [401, 403],
  },
  {
    name: "GIS WSS helper",
    url: "https://api-gis.davao-water.gov.ph/helpers/leaksys/getWSS.php?lat=7.0731&lng=125.6128",
    method: "GET",
    expected: [200],
  },
  {
    name: "GIS caretaker helper",
    url: "https://api-gis.davao-water.gov.ph/helpers/leaksys/getCaretaker.php?lat=7.0731&lng=125.6128",
    method: "GET",
    expected: [200],
  },
  {
    name: "OpenStreetMap address search",
    url: "https://nominatim.openstreetmap.org/search?format=json&q=Davao&limit=1&viewbox=125.3,7.3,125.8,6.9&bounded=1",
    method: "GET",
    headers: { "User-Agent": "LeakAlert-QA-HealthMonitor/1.0" },
    expected: [200],
  },
];

async function probe(target) {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(target.url, {
      method: target.method,
      headers: target.headers,
      body: target.body,
      redirect: "manual",
      signal: controller.signal,
    });
    return {
      name: target.name,
      method: target.method,
      url: target.url.replace(/\?.*$/, ""),
      status: response.status,
      durationMs: Date.now() - startedAt,
      healthy: target.expected.includes(response.status),
      expected: target.expected,
    };
  } catch (error) {
    return {
      name: target.name,
      method: target.method,
      url: target.url.replace(/\?.*$/, ""),
      status: null,
      durationMs: Date.now() - startedAt,
      healthy: false,
      expected: target.expected,
      error: error.name === "AbortError" ? "Request timed out" : error.message,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function notifyTeams(result) {
  if (!webhook || result.failed === 0) return;
  const failures = result.results
    .filter((item) => !item.healthy)
    .map(
      (item) =>
        `• ${item.name}: ${item.error || `HTTP ${item.status}`} (expected ${item.expected.join("/")})`
    )
    .join("\n");
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
              color: "Attention",
              text: "Leak Alert API availability failure",
            },
            {
              type: "TextBlock",
              wrap: true,
              text: `${result.failed} of ${result.total} service probes failed.`,
            },
            { type: "TextBlock", wrap: true, text: failures },
            {
              type: "TextBlock",
              wrap: true,
              text: `Checked at ${result.checkedAt}`,
            },
          ],
        },
      },
    ],
  };
  const response = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Teams webhook returned HTTP ${response.status}`);
}

async function main() {
  const results = await Promise.all(probes.map(probe));
  const summary = {
    checkedAt: new Date().toISOString(),
    total: results.length,
    passed: results.filter((item) => item.healthy).length,
    failed: results.filter((item) => !item.healthy).length,
    results,
  };
  fs.mkdirSync(require("path").dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`);
  for (const item of results) {
    console.log(
      `${item.healthy ? "PASS" : "FAIL"} ${item.name}: ${
        item.error || `HTTP ${item.status}`
      } (${item.durationMs} ms)`
    );
  }
  await notifyTeams(summary);
  if (summary.failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
