$ErrorActionPreference = "Stop"

if (-not $env:LEAK_ALERT_USERNAME -or -not $env:LEAK_ALERT_PASSWORD) {
    throw "Set LEAK_ALERT_USERNAME and LEAK_ALERT_PASSWORD before running the suite."
}

$flows = @(
    "flows/auth/01-login.yaml",
    "flows/auth/02-invalid-login.yaml",
    "flows/auth/03-required-login-fields.yaml",
    "flows/auth/04-logout.yaml"
)

$failedFlows = @()
New-Item -ItemType Directory -Force -Path "test-results-auth" | Out-Null

foreach ($flow in $flows) {
    Write-Host "Running $flow..." -ForegroundColor Cyan
    maestro test `
        -e TEST_USERNAME="$env:LEAK_ALERT_USERNAME" `
        -e TEST_PASSWORD="$env:LEAK_ALERT_PASSWORD" `
        $flow `
        --test-output-dir test-results-auth

    if ($LASTEXITCODE -ne 0) {
        $failedFlows += $flow
    }
}

$testExitCode = if ($failedFlows.Count -eq 0) { 0 } else { 1 }
$env:TEST_STATUS = if ($testExitCode -eq 0) { "PASSED" } else { "FAILED" }
$env:TEST_RESULTS_DIR = "test-results-auth"
$env:SANITIZED_RESULTS_DIR = "test-results-auth-sanitized"
$env:TEST_USERNAME = $env:LEAK_ALERT_USERNAME
$env:TEST_PASSWORD = $env:LEAK_ALERT_PASSWORD

try {
    node scripts/prepare_results.js test-results-auth
    $env:TEST_RESULTS_DIR = "test-results-auth-sanitized"
    node scripts/notify_teams.js
}
catch {
    Write-Warning "Teams notification failed: $($_.Exception.Message)"
}

if ($failedFlows.Count -gt 0) {
    Write-Error "Failed flows: $($failedFlows -join ', ')"
}
else {
    Write-Host "All authentication flows passed." -ForegroundColor Green
}

exit $testExitCode
