# DCWD Leak Alert Chrome Web Regression

This Maestro suite opens the Leak Alert development portal in Android Chrome:

`https://dev-myportal.davao-water.gov.ph/gis/leak`

## Requirements

- Maestro CLI
- Maestro web support with managed Chromium
- Network access to the DCWD development portal

## Run

```powershell
.\run-full-regression.ps1
```

The suite opens the portal, signs in with the configured QA account, verifies that
an authenticated Leak Alert screen appears, and captures screenshots.

## Security

Credentials are never committed. Supply them through Maestro CLI variables:

```powershell
maestro test `
  -e TEST_USERNAME="$env:LEAK_ALERT_USERNAME" `
  -e TEST_PASSWORD="$env:LEAK_ALERT_PASSWORD" `
  flows/00-critical-regression.yaml `
  --test-output-dir test-results-critical
```

## Current limitation

Maestro launches its own Chromium instance for this web suite; ADB is not used.

## Critical scenarios

- Valid login
- Invalid credentials rejected
- Required login fields enforced
- Dashboard metrics and report table integrity
- Create Report modal and mandatory field presence
- Authenticated navigation
- Logout and session termination

Run the critical pack:

```powershell
maestro test `
  -e TEST_USERNAME="$env:LEAK_ALERT_USERNAME" `
  -e TEST_PASSWORD="$env:LEAK_ALERT_PASSWORD" `
  flows/00-critical-regression.yaml `
  --test-output-dir test-results-critical
```

Run all authentication tests locally and notify Teams:

```powershell
.\run-auth-regression.ps1
```

Run Dashboard and Report lifecycle regression:

```powershell
maestro test `
  -e TEST_USERNAME="$env:LEAK_ALERT_USERNAME" `
  -e TEST_PASSWORD="$env:LEAK_ALERT_PASSWORD" `
  flows/00-report-e2e-regression.yaml `
  --test-output-dir test-results-report-e2e
```

The successful record-creation flow is
`flows/reports/07-create-leak-report-e2e.yaml`. Run it deliberately because it
creates a real QA record in the development environment. The reusable report
regression verifies the existing QA record and does not create duplicates.

## Known application defects

- `REG-OPS-002`: report `2026072C26` was submitted with Leak Pressure `Low`,
  but Operations Report Details persist and display `High`.
- Duplicate protection is absent or ineffective: identical QA submissions
  created references `2026072C26` and `202607C949`.
- The `+ Follow Up` action records a generic follow-up immediately with no
  form, reason, confirmation, assigned crew, or supporting evidence.
- Dispatched reference `202607C949` shows `Dispatch To: N/A`; its audit entry
  records the dispatch event but omits the selected CT-01 crew.

The Operations module is the supported route for opening Report Details, Leak
Images, and Reported Location.

Dispatch fixture state:

- `2026072C26` remains a Customer Report for repeatable eligibility checks.
- `202607C949` was dispatched to active repair crew `CT-01` and is used for
  repeatable dispatched-status persistence checks.

Repair scheduling, field completion, repair evidence upload, and turnover are
crew-role workflows. Completing their mutation tests requires a dedicated
repair-crew QA login; the current administrator identity provides monitoring,
dispatch, details, map, images, logs, and follow-up access.

Set `LEAK_ALERT_USERNAME`, `LEAK_ALERT_PASSWORD`, and `TEAMS_WEBHOOK_URL` as
local environment variables. The runner sends a Teams message for both passing
and failing runs.

## CI/CD and Microsoft Teams

The GitHub Actions workflow runs daily at 06:00 Asia/Manila and also supports
manual execution.

Configure these GitHub repository secrets:

- `LEAK_ALERT_USERNAME`
- `LEAK_ALERT_PASSWORD`
- `TEAMS_WEBHOOK_URL`

Failed runs upload Maestro screenshots and command artifacts, post an Adaptive
Card to Microsoft Teams, and leave the workflow in a failed state.

Teams diagnostics include the failed flow, exact step, severity, confirmed or
suspected cause, failure message, and a direct CI-run link. CI also performs an
endpoint availability check before launching Maestro. Uploaded text artifacts
are sanitized to remove configured usernames, passwords, and webhook values.
