# Leak Alert QA Defect Report

Environment: DCWD development portal  
Test date: July 28, 2026  
Automation: Maestro Chromium

## DEF-001: Leak Pressure `Low` persists as `High`

Severity: Critical  
Affected reference: `2026072C26`

### Steps to reproduce

1. Sign in and select **Create a Report**.
2. Search for and select a Matina address.
3. Set Type of Report to `Report A Leak`.
4. Search reference `18-341274-8`.
5. Select `Non Account Holder`.
6. Enter `Charina Mae Castillano` and `09938834221`.
7. Enter landmark `Near Matina Road`.
8. Select Leak Type `Blow-Off`, Pressure `Low`, Visibility `Surface`, and
   Coverings `Soil`.
9. Enter `For investigation` and submit.
10. Open **Operations > Leak Reports > Customer Reports**.
11. Open the green Report Details action for the submitted reference.

Expected: Pressure displays `Low`.  
Actual: Pressure displays `High`.

Automated flow: `flows/operations/02-open-report-action.yaml`

## DEF-002: Duplicate reports are accepted

Severity: High  
Affected references: `2026072C26`, `202607C949`

### Steps to reproduce

1. Complete the report submission described in DEF-001.
2. Repeat it using the same reference, reporter, location, contact, leak
   details, and remarks.
3. Return to Dashboard or Operations Customer Reports.

Expected: The system warns about a probable duplicate or requires an authorized
override.

Actual: Two independent references are created for identical reports.

Automated flow: `flows/reports/07-create-leak-report-e2e.yaml`

## DEF-003: Dispatched crew is missing from monitoring and audit history

Severity: Critical  
Affected reference: `202607C949`

### Steps to reproduce

1. Open **Operations > Leak Reports > Customer Reports**.
2. Select the red Dispatch action for `202607C949`.
3. Select active crew `002705 - RINCE VERGEL ABAS (CT-01)`.
4. Select **DISPATCH LEAK**, then **Yes, Dispatch**.
5. Change Status to **Dispatched**.
6. Locate `202607C949` and inspect **Dispatch To**.
7. Open its green detail action and select **Logs History**.

Expected: The list and audit entry identify `CT-01` and its assigned personnel.

Actual: The list displays `N/A`; Logs History records `Leak Dispatched` without
the selected crew.

Automated flows:

- `flows/operations/06-dispatch-leak-e2e.yaml`
- `flows/operations/08-dispatched-assignment-details.yaml`

## DEF-004: Follow Up executes without details or confirmation

Severity: High  
Affected reference: `202607C949`

### Steps to reproduce

1. Open **Operations > Leak Reports**.
2. Set Status to **Dispatched**.
3. Open the green detail action for `202607C949`.
4. Select **Logs History**.
5. Select **+ Follow Up** once.

Expected: A form requests the reason, status, responsible party, remarks, and
optional evidence, followed by confirmation.

Actual: A generic `Follow up` audit entry is created immediately without a form,
reason, evidence, responsible party, or confirmation.

Automated flow: `flows/operations/10-open-follow-up.yaml` verifies persistence
without clicking the unsafe action again.

## Evidence

Maestro outputs include screenshots, failed assertions, UI hierarchy, and
sanitized command artifacts. CI artifacts are retained for 30 days.
