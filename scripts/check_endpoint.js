const fs = require("fs");
const path = require("path");

const target = process.env.LEAK_ALERT_URL || "https://dev-myportal.davao-water.gov.ph/gis/leak";
const outputDir = process.env.TEST_RESULTS_DIR || "test-results";
const startedAt = Date.now();

async function main() {
  let result;
  try {
    const response = await fetch(target, {
      redirect: "follow",
      signal: AbortSignal.timeout(30000),
    });
    result = {
      status: response.ok ? "PASSED" : "FAILED",
      endpoint: new URL(target).origin,
      httpStatus: response.status,
      responseTimeMs: Date.now() - startedAt,
      diagnosis: response.ok ? "Endpoint is reachable." : `Endpoint returned HTTP ${response.status}.`,
      confidence: "Confirmed",
    };
  } catch (error) {
    const detail = `${error.cause?.code || ""} ${error.message}`.trim();
    const dns = /ENOTFOUND|EAI_AGAIN|name.*resolve/i.test(detail);
    result = {
      status: "FAILED",
      endpoint: new URL(target).origin,
      responseTimeMs: Date.now() - startedAt,
      diagnosis: dns
        ? "DNS resolution failed. The runner is outside the DCWD network/VPN or cannot use DCWD DNS."
        : `Endpoint connection failed: ${detail}`,
      confidence: "Confirmed",
    };
  }

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, "api-health.json"), JSON.stringify(result, null, 2));
  console.log(`${result.status}: ${result.diagnosis}`);
  process.exit(result.status === "PASSED" ? 0 : 1);
}

main();
