# Leak Alert API Reference

Generated from the deployed Leak Alert client source map on July 29, 2026.

Primary API base:
`https://dev-api.davao-water.gov.ph/dcwd-gis/api/v1/`

Unless described as external, endpoints use Bearer authentication. Request and
response schemas should be confirmed against the API implementation; this
inventory documents calls made by the deployed web client.

## Authentication

| Method | Path | Purpose |
|---|---|---|
| POST | `/admin/userlogin/login` | Authenticate a user and return identity, role, and token data. |
| POST | `/auth/refresh` | Exchange a refresh token for a new access token. |

## Leak and complaint reports

| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/GetLeakReports/GetAllLeakReports` | List leak reports with paging and search. |
| GET | `/admin/GetLeakReports/GetLeakReportsFiltered` | List reports filtered by dispatch status and search. |
| GET | `/admin/GetLeakReports/GetLeakReportsByEmpId` | List reports for the signed-in employee/dashboard. |
| POST | `/admin/LeakReport/ReportLeak` | Create a leak report. |
| PUT | `/admin/LeakReport/UpdateLeak` | Update a leak report using multipart form data. |
| POST | `/admin/LeakReport/NoWaterSupply` | Create a no-water/water-supply complaint. |
| GET | `/admin/GetComplaints/GetWaterComplaints` | List water complaints. |
| GET | `/admin/customer/SearchAccountOrMeterNumber` | Find a customer using an account or meter number. |

## Images, repair details, and audit logs

| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/LeakReport/leak/{imageType}/{filename}` | Resolve a leak-image URL. |
| GET | `/admin/GetRepairDetails/repair/{referenceNo}` | Get repair details for a report. |
| GET | `/admin/GetRepairDetails/repair/{referenceNo}/filenames` | List repair evidence filenames. |
| GET | `/admin/Logs/{referenceNo}` | Retrieve report audit history. |
| POST | `/admin/Logs` | Create an audit/follow-up log entry. |

## Dispatch

| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/Dispatch/all` | List dispatch records for override/management. |
| POST | `/admin/Dispatch/DispatchToCrew` | Dispatch a report to a crew. |
| PUT | `/admin/Dispatch/status/dispatch/{referenceNo}/{status}` | Override or update dispatch status. |
| GET | `/admin/GetCrew/GetAllCrew` | List available crews. |

## Caretaker and crew administration

| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/Caretaker/GetAllCaretaker` | List caretaker crews. |
| POST | `/admin/Caretaker/AddCaretaker` | Create a caretaker entry. |
| POST | `/admin/Caretaker/UpdateCaretaker/{id}` | Update a caretaker entry. |
| DELETE | `/admin/Caretaker/DeleteCaretaker/{id}` | Delete a caretaker entry. |
| POST | `/admin/Caretaker/AssignCrew` | Assign an employee to a caretaker crew. |
| DELETE | `/admin/Caretaker/RemoveCrew` | Remove an employee from a caretaker crew. |
| GET | `/admin/Caretaker/reports/daily-accomplishment/details` | Retrieve caretaker daily accomplishment details. |
| POST | `/admin/GetCrew/UpdateCrew` | Update crew information. |
| DELETE | `/admin/GetCrew/RemoveFromCrewList` | Remove an employee from a crew list. |

## Leak-detection crew and reports

| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/LeakDetection/GetAllLDCrew` | List leak-detection crew members. |
| PUT | `/admin/LeakDetection/assign-designation` | Assign or change a leak-detection designation. |
| GET | `/admin/LeakDetection/by-reported-by` | Retrieve leak-detection reports by reporter. |
| POST | `/admin/LeakDetection/reports/dar/save-selections` | Save daily accomplishment report selections. |

## Users, employees, and access

| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/useraccount/GetAll` | List employee/user-account records. |
| GET | `/admin/useraccount/GetByEmployeeId` | Retrieve a user by employee ID. |
| GET | `/admin/useraccount/GetByEmployeeId?empId={employeeId}` | Retrieve a specific employee for audit display. |
| POST | `/admin/useraccount/RegisterAsCrew` | Register an employee as crew. |
| POST | `/admin/useraccount/RegisterAsLeakDetectionCrew` | Register an employee as leak-detection crew. |
| POST | `/admin/useraccount/UpdateAccessLevel` | Change a user's access level. |
| PUT | `/admin/useraccount/UpdateUser` | Update the signed-in user's settings/profile. |
| GET | `/admin/useraccounts/list` | List user accounts for system maintenance. |

## External GIS and geocoding services

| Method | URL | Purpose |
|---|---|---|
| GET | `https://api-gis.davao-water.gov.ph/dcwd-gis/api/v1/admin/customer/SearchAccountOrMeterNumber?searchValue={value}` | Customer lookup used by water-supply concerns. |
| GET | `https://api-gis.davao-water.gov.ph/helpers/leaksys/getWSS.php?lat={lat}&lng={lng}` | Resolve the water-supply system for coordinates. |
| GET | `https://api-gis.davao-water.gov.ph/helpers/leaksys/getCaretaker.php?lat={lat}&lng={lng}` | Resolve the caretaker for coordinates. |
| GET | `https://nominatim.openstreetmap.org/search?format=json&q={query}&limit=5&viewbox=125.3,7.3,125.8,6.9&bounded=1` | Search bounded Davao addresses. |

## Availability monitoring

The health monitor checks all 44 documented APIs. GET APIs receive safe
read-only requests with health-check values. Mutation APIs use `OPTIONS`
preflight requests so monitoring cannot create, update, dispatch, or delete
records. At the beginning of every run, the monitor signs in using the
`LEAK_ALERT_USERNAME` and `LEAK_ALERT_PASSWORD` GitHub Actions secrets. The
bearer token remains in process memory and is attached to protected probes.
Credentials and tokens are never written to logs, artifacts, Teams, or this
documentation.

Run locally:

```powershell
node scripts/check_api_health.js
```

The GitHub Actions workflow runs daily at 22:00 UTC (06:00 Asia/Manila the following day) and can
also be launched manually from the workflow page. Teams receives a daily
Adaptive Card containing totals and average response time. Failures additionally
include the API name, status/error, and diagnosed reason. The card contains
buttons to run the workflow, open this documentation, and view prior runs.

The uploaded JSON artifact contains every API's name, full URL, intended method,
safe probe method, HTTP status, response time, expected statuses, health state,
and failure reason. Results are retained for 14 days.

Required GitHub Actions secrets:

- `LEAK_ALERT_USERNAME`
- `LEAK_ALERT_PASSWORD`
- `TEAMS_WEBHOOK_URL`

### Initial all-API validation

The final authenticated July 29, 2026 validation checked all 44 documented
APIs. A fresh bearer token was acquired successfully, 42 checks passed, and two
deployed client routes returned `404 Not Found`:

- `POST /auth/refresh`
- `POST /admin/LeakDetection/reports/dar/save-selections`

These failures mean the routes used by the deployed client were not found by
their configured servers. The monitor will continue checking them daily so
their recovery is visible immediately.

## Regenerating the inventory

Download the deployed source map into a local ignored evidence directory, then
run:

```powershell
node scripts/extract_deployed_apis.js audit-results/security-main.js.map
```

The extractor prints a normalized JSON inventory containing method, path, and
source module. Never commit the downloaded source map because it may expose
implementation details or client-side keys.
