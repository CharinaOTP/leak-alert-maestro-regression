$ErrorActionPreference = "Stop"

New-Item -ItemType Directory -Force -Path "test-results" | Out-Null
Write-Host "Running Leak Alert managed Chromium web regression..." -ForegroundColor Green
maestro test flows/00-full-web-regression.yaml --test-output-dir test-results
