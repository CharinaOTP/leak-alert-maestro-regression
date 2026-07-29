const fs = require("fs");

const timeoutMs = Number(process.env.API_HEALTH_TIMEOUT_MS || 15000);
const outputPath = process.env.API_HEALTH_OUTPUT || "test-results/api-health.json";
const webhook = process.env.TEAMS_WEBHOOK_URL;
const notifyOnSuccess = process.env.API_HEALTH_NOTIFY_SUCCESS !== "false";
const primaryBase = "https://dev-api.davao-water.gov.ph/dcwd-gis/api/v1";
const monitorUsername = process.env.LEAK_ALERT_USERNAME;
const monitorPassword = process.env.LEAK_ALERT_PASSWORD;

const apiCatalog = [
  ["User login", "POST", "/admin/userlogin/login"],
  ["Refresh access token", "POST", "/auth/refresh", "POST"],
  ["List all leak reports", "GET", "/admin/GetLeakReports/GetAllLeakReports?PageIndex=1&PageSize=1"],
  ["List filtered leak reports", "GET", "/admin/GetLeakReports/GetLeakReportsFiltered?PageIndex=1&PageSize=1"],
  ["List employee leak reports", "GET", "/admin/GetLeakReports/GetLeakReportsByEmpId"],
  ["Create leak report", "POST", "/admin/LeakReport/ReportLeak"],
  ["Update leak report", "PUT", "/admin/LeakReport/UpdateLeak"],
  ["Create no-water complaint", "POST", "/admin/LeakReport/NoWaterSupply"],
  ["List water complaints", "GET", "/admin/GetComplaints/GetWaterComplaints?PageIndex=1&PageSize=1"],
  ["Search account or meter", "GET", "/admin/customer/SearchAccountOrMeterNumber?searchValue=API-HEALTHCHECK"],
  ["Resolve leak image URL", "GET", "/admin/LeakReport/leak/healthcheck/nonexistent.jpg"],
  ["Get repair details", "GET", "/admin/GetRepairDetails/repair/202607FAD6"],
  ["List repair filenames", "GET", "/admin/GetRepairDetails/repair/202607FAD6/filenames"],
  ["Get audit logs", "GET", "/admin/Logs/202607FAD6"],
  ["Create audit log", "POST", "/admin/Logs"],
  ["List dispatch records", "GET", "/admin/Dispatch/all"],
  ["Dispatch report to crew", "POST", "/admin/Dispatch/DispatchToCrew"],
  ["Update dispatch status", "PUT", "/admin/Dispatch/status/dispatch/API-HEALTHCHECK/0"],
  ["List all crews", "GET", "/admin/GetCrew/GetAllCrew"],
  ["List caretakers", "GET", "/admin/Caretaker/GetAllCaretaker"],
  ["Add caretaker", "POST", "/admin/Caretaker/AddCaretaker"],
  ["Update caretaker", "POST", "/admin/Caretaker/UpdateCaretaker/0"],
  ["Delete caretaker", "DELETE", "/admin/Caretaker/DeleteCaretaker/0"],
  ["Assign caretaker crew", "POST", "/admin/Caretaker/AssignCrew"],
  ["Remove caretaker crew", "DELETE", "/admin/Caretaker/RemoveCrew"],
  ["Caretaker daily accomplishment", "GET", "/admin/Caretaker/reports/daily-accomplishment/details"],
  ["Update crew", "POST", "/admin/GetCrew/UpdateCrew"],
  ["Remove from crew list", "DELETE", "/admin/GetCrew/RemoveFromCrewList"],
  ["List leak-detection crew", "GET", "/admin/LeakDetection/GetAllLDCrew"],
  ["Assign leak-detection designation", "PUT", "/admin/LeakDetection/assign-designation"],
  ["Leak-detection reports by reporter", "GET", "/admin/LeakDetection/by-reported-by"],
  ["Save DAR selections", "POST", "/admin/LeakDetection/reports/dar/save-selections", "POST"],
  ["List employee accounts", "GET", "/admin/useraccount/GetAll"],
  ["Get current employee account", "GET", "/admin/useraccount/GetByEmployeeId"],
  ["Get account by employee ID", "GET", "/admin/useraccount/GetByEmployeeId?empId={MONITOR_EMPLOYEE}"],
  ["Register employee as crew", "POST", "/admin/useraccount/RegisterAsCrew"],
  ["Register leak-detection crew", "POST", "/admin/useraccount/RegisterAsLeakDetectionCrew"],
  ["Update access level", "POST", "/admin/useraccount/UpdateAccessLevel"],
  ["Update user profile", "PUT", "/admin/useraccount/UpdateUser"],
  ["List system user accounts", "GET", "/admin/useraccounts/list"],
].map(([name, apiMethod, path, safeMethod]) => ({
  name,
  apiMethod,
  method: safeMethod || (apiMethod === "GET" ? "GET" : "OPTIONS"),
  url: `${primaryBase}${path}`,
  expected:
    ["Resolve leak image URL", "Get repair details", "Search account or meter"].includes(name)
      ? [200, 400, 404]
      : [200, 204, 400, 405],
}));

const probes = [
  ...apiCatalog,
  {
    name: "Authentication API",
    url: "https://dev-api.davao-water.gov.ph/dcwd-gis/api/v1/admin/userlogin/login",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    expected: [200],
    replaces: "User login",
  },
  {
    name: "External customer account search",
    url: "https://api-gis.davao-water.gov.ph/dcwd-gis/api/v1/admin/customer/SearchAccountOrMeterNumber?searchValue=API-HEALTHCHECK",
    method: "GET",
    apiMethod: "GET",
    expected: [200, 400, 404],
  },
  {
    name: "GIS WSS helper",
    url: "https://api-gis.davao-water.gov.ph/helpers/leaksys/getWSS.php?lat=7.0731&lng=125.6128",
    method: "GET",
    apiMethod: "GET",
    expected: [200],
  },
  {
    name: "GIS caretaker helper",
    url: "https://api-gis.davao-water.gov.ph/helpers/leaksys/getCaretaker.php?lat=7.0731&lng=125.6128",
    method: "GET",
    apiMethod: "GET",
    expected: [200],
  },
  {
    name: "OpenStreetMap address search",
    url: "https://nominatim.openstreetmap.org/search?format=json&q=Davao&limit=1&viewbox=125.3,7.3,125.8,6.9&bounded=1",
    method: "GET",
    apiMethod: "GET",
    headers: { "User-Agent": "LeakAlert-QA-HealthMonitor/1.0" },
    expected: [200],
  },
].filter(
  (probe, index, all) =>
    !probe.replaces ||
    index === all.findIndex((candidate) => candidate.replaces === probe.replaces)
);

const deduplicatedProbes = probes.filter(
  (probe, index) =>
    !probes.some(
      (candidate, candidateIndex) =>
        candidateIndex > index && candidate.replaces === probe.name
    )
);

async function authenticate() {
  const startedAt = Date.now();
  if (!monitorUsername || !monitorPassword) {
    return {
      result: {
        name: "Authentication API",
        apiMethod: "POST",
        probeMethod: "POST",
        url: `${primaryBase}/admin/userlogin/login`,
        status: null,
        durationMs: 0,
        healthy: false,
        expected: [200],
        reason: "Monitoring credentials are not configured.",
      },
    };
  }
  try {
    const response = await fetch(`${primaryBase}/admin/userlogin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: monitorUsername,
        password: monitorPassword,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const payload = await response.json().catch(() => ({}));
    const session = payload?.data || payload;
    const token = session?.token || session?.accessToken;
    const refreshToken = session?.refreshToken || session?.refresh_token;
    return {
      token,
      refreshToken,
      result: {
        name: "Authentication API",
        apiMethod: "POST",
        probeMethod: "POST",
        url: `${primaryBase}/admin/userlogin/login`,
        status: response.status,
        durationMs: Date.now() - startedAt,
        healthy: response.ok && Boolean(token),
        expected: [200],
        reason:
          response.ok && token
            ? "Authenticated successfully; bearer token acquired in memory."
            : "Login failed or the response did not contain an access token.",
      },
    };
  } catch (error) {
    return {
      result: {
        name: "Authentication API",
        apiMethod: "POST",
        probeMethod: "POST",
        url: `${primaryBase}/admin/userlogin/login`,
        status: null,
        durationMs: Date.now() - startedAt,
        healthy: false,
        expected: [200],
        error: error.name === "TimeoutError" ? "Request timed out" : error.message,
        reason: "Authentication request failed before a bearer token was acquired.",
      },
    };
  }
}

async function probe(target, token, refreshToken) {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resolvedUrl = target.url.replace(
      "{MONITOR_EMPLOYEE}",
      encodeURIComponent(monitorUsername || "")
    );
    const requiresBearer =
      resolvedUrl.startsWith(primaryBase) ||
      resolvedUrl.includes("/dcwd-gis/api/v1/");
    const headers = {
      ...target.headers,
      ...(requiresBearer && token ? { Authorization: `Bearer ${token}` } : {}),
    };
    const isRefresh = target.name === "Refresh access token";
    const response = await fetch(resolvedUrl, {
      method: target.method,
      headers: isRefresh
        ? { ...headers, "Content-Type": "application/json" }
        : headers,
      body: isRefresh
        ? JSON.stringify({ token: refreshToken || "missing-refresh-token" })
        : target.body,
      redirect: "manual",
      signal: controller.signal,
    });
    return {
      name: target.name,
      apiMethod: target.apiMethod || target.method,
      probeMethod: target.method,
      url: target.url,
      status: response.status,
      durationMs: Date.now() - startedAt,
      healthy: target.expected.includes(response.status),
      expected: target.expected,
      reason: target.expected.includes(response.status)
        ? "Endpoint responded with an accepted availability status."
        : response.status >= 500
          ? "Server or upstream gateway returned a 5xx error."
          : response.status === 404
            ? "Route was not found; deployment and endpoint path may be out of sync."
            : `Unexpected HTTP status ${response.status}.`,
    };
  } catch (error) {
    return {
      name: target.name,
      apiMethod: target.apiMethod || target.method,
      probeMethod: target.method,
      url: target.url,
      status: null,
      durationMs: Date.now() - startedAt,
      healthy: false,
      expected: target.expected,
      error: error.name === "AbortError" ? "Request timed out" : error.message,
      reason:
        error.name === "AbortError"
          ? `No response within ${timeoutMs} ms.`
          : "DNS, TLS, connection, or network request failed.",
    };
  } finally {
    clearTimeout(timer);
  }
}

async function notifyTeams(result) {
  if (!webhook || (result.failed === 0 && !notifyOnSuccess)) return;
  const failures = result.results
    .filter((item) => !item.healthy)
    .map(
      (item) =>
        `• ${item.name}: ${item.error || `HTTP ${item.status}`} — ${item.reason}`
    )
    .join("\n");
  const detailChunks = [];
  const detailLines = result.results.map(
    (item) =>
      `${item.healthy ? "✅" : "❌"} ${item.name}\n${item.apiMethod} ${item.url}\nHTTP ${
        item.status ?? "none"
      } • ${item.durationMs} ms • ${item.reason}`
  );
  for (let index = 0; index < detailLines.length; index += 8) {
    detailChunks.push(detailLines.slice(index, index + 8).join("\n\n"));
  }
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
              color: "Good",
              text: "Leak Alert API Checking",
            },
            {
              type: "TextBlock",
              wrap: true,
              weight: "Bolder",
              text: `Summary: ${result.passed} passed, ${result.failed} failed, ${result.total} APIs checked.`,
            },
            ...(failures
              ? [
                  {
                    type: "Container",
                    id: "failedApiDetails",
                    isVisible: false,
                    separator: true,
                    items: [
                      {
                        type: "TextBlock",
                        weight: "Bolder",
                        text: "Failed APIs",
                      },
                      { type: "TextBlock", wrap: true, text: failures },
                    ],
                  },
                ]
              : []),
            {
              type: "Container",
              id: "allApiDetails",
              isVisible: false,
              separator: true,
              items: detailChunks.map((text, index) => ({
                type: "TextBlock",
                wrap: true,
                separator: index > 0,
                text: `API results ${index * 8 + 1}–${Math.min(
                  index * 8 + 8,
                  result.total
                )}\n\n${text}`,
              })),
            },
            {
              type: "TextBlock",
              wrap: true,
              text: `Average response: ${result.averageDurationMs} ms\nChecked at ${result.checkedAt}`,
            },
          ],
          actions: [
            ...(failures
              ? [
                  {
                    type: "Action.ToggleVisibility",
                    title: "View Failed APIs",
                    targetElements: ["failedApiDetails"],
                  },
                ]
              : []),
            {
              type: "Action.ToggleVisibility",
              title: "View All API Details",
              targetElements: ["allApiDetails"],
            },
            {
              type: "Action.OpenUrl",
              title: "Run API Monitor",
              url: "https://github.com/CharinaOTP/leak-alert-maestro-regression/actions/workflows/api-health-monitor.yml",
            },
            {
              type: "Action.OpenUrl",
              title: "View API Documentation",
              url: "https://github.com/CharinaOTP/leak-alert-maestro-regression/blob/main/docs/API_REFERENCE.md",
            },
            {
              type: "Action.OpenUrl",
              title: "View Monitor Runs",
              url: "https://github.com/CharinaOTP/leak-alert-maestro-regression/actions",
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
  const authentication = await authenticate();
  const nonLoginProbes = deduplicatedProbes.filter(
    (target) => target.name !== "Authentication API"
  );
  const endpointResults = await Promise.all(
    nonLoginProbes.map((target) =>
      probe(target, authentication.token, authentication.refreshToken)
    )
  );
  const results = [authentication.result, ...endpointResults];
  const summary = {
    checkedAt: new Date().toISOString(),
    total: results.length,
    passed: results.filter((item) => item.healthy).length,
    failed: results.filter((item) => !item.healthy).length,
    averageDurationMs: Math.round(
      results.reduce((total, item) => total + item.durationMs, 0) / results.length
    ),
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
