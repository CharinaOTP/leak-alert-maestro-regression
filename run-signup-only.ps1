$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path "test-results-login" | Out-Null
maestro test flows/auth/01-login.yaml --test-output-dir test-results-login
