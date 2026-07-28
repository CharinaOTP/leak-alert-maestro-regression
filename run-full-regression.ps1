$ErrorActionPreference = "Stop"

if (-not $env:LEAK_ALERT_USERNAME -or -not $env:LEAK_ALERT_PASSWORD) {
    throw "Set LEAK_ALERT_USERNAME and LEAK_ALERT_PASSWORD before running the suite."
}

New-Item -ItemType Directory -Force -Path "test-results" | Out-Null
Write-Host "Running Leak Alert managed Chromium web regression..." -ForegroundColor Green

maestro test `
    -e TEST_USERNAME="$env:LEAK_ALERT_USERNAME" `
    -e TEST_PASSWORD="$env:LEAK_ALERT_PASSWORD" `
    flows/00-full-web-regression.yaml `
    --test-output-dir test-results

$testExitCode = $LASTEXITCODE
$env:TEST_STATUS = if ($testExitCode -eq 0) { "PASSED" } else { "FAILED" }
$env:TEST_RESULTS_DIR = "test-results"
$env:SANITIZED_RESULTS_DIR = "test-results-sanitized"
$env:TEST_USERNAME = $env:LEAK_ALERT_USERNAME
$env:TEST_PASSWORD = $env:LEAK_ALERT_PASSWORD

try {
    node scripts/prepare_results.js test-results
    $env:TEST_RESULTS_DIR = "test-results-sanitized"
    node scripts/notify_teams.js
}
catch {
    Write-Warning "Teams notification failed: $($_.Exception.Message)"
}

exit $testExitCode
