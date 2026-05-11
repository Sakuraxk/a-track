param(
    [switch]$Build,
    [switch]$Down,
    [switch]$Logs,
    [switch]$Migrate,
    [switch]$Seed,
    [switch]$Dev,
    [switch]$DevDown
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = $PSScriptRoot

function Test-FrontendReady {
    param(
        [string]$Url
    )

    $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
    if ($curl) {
        try {
            $statusCode = & $curl.Source -L -s -o NUL -w "%{http_code}" $Url
            if ($LASTEXITCODE -eq 0 -and $statusCode -match '^(2|3)\d\d$') {
                return $true
            }
        } catch {
        }
    }

    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 3
        return $response.StatusCode -ge 200 -and $response.StatusCode -lt 400
    } catch {
        return $false
    }
}

function Get-DevFrontendUrl {
    $frontendPort = 80
    if ($env:FRONTEND_PORT) {
        $parsedPort = 0
        if ([int]::TryParse($env:FRONTEND_PORT, [ref]$parsedPort)) {
            $frontendPort = $parsedPort
        }
    }

    if ($frontendPort -eq 80) {
        return 'http://localhost'
    }

    return "http://localhost:$frontendPort"
}

function Wait-DevContainersRemoved {
    param(
        [int]$TimeoutSeconds = 60
    )

    $devContainerNames = @(
        'ai-learning-platform-nginx',
        'ai-learning-platform-frontend',
        'ai-learning-platform-admin',
        'ai-learning-platform-backend',
        'ai-learning-platform-sandbox-worker',
        'ai-learning-platform-db'
    )

    $elapsed = 0
    while ($elapsed -lt $TimeoutSeconds) {
        $remaining = @()

        foreach ($name in $devContainerNames) {
            $existing = docker ps -a --filter "name=$name" --format "{{.Names}}" 2>$null |
                Where-Object { $_ -eq $name }
            if ($existing) {
                $remaining += $name
            }
        }

        if ($remaining.Count -eq 0) {
            return $true
        }

        Start-Sleep -Seconds 1
        $elapsed++
    }

    return $false
}

Write-Host ''
Write-Host '========================================' -ForegroundColor Cyan
Write-Host '  A-Track Docker Deploy' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ''

# Check Docker
try {
    docker --version | Out-Null
} catch {
    Write-Host '[ERROR] Docker not found. Install Docker Desktop first.' -ForegroundColor Red
    exit 1
}

try {
    docker compose version | Out-Null
} catch {
    Write-Host '[ERROR] docker compose not found.' -ForegroundColor Red
    exit 1
}

# ── 开发模式（热重载，改代码即生效）──────────
if ($Dev) {
    $devFrontendUrl = Get-DevFrontendUrl
    Write-Host '  Starting DEV mode (hot-reload)...' -ForegroundColor Magenta
    Write-Host '  Backend:  uvicorn --reload' -ForegroundColor Gray
    Write-Host '  Frontend: vite dev server via nginx proxy' -ForegroundColor Gray
    Write-Host ''
    $devCompose = Join-Path $ProjectRoot 'docker-compose.dev.yml'
    if (-not (Wait-DevContainersRemoved -TimeoutSeconds 5)) {
        Write-Host '  Detected existing containers. Attempting to stop them first...' -ForegroundColor Yellow
        # Try stopping both prod and dev stacks to clear the way
        docker compose -f (Join-Path $ProjectRoot 'docker-compose.yml') down 2>$null
        docker compose -f (Join-Path $ProjectRoot 'docker-compose.dev.yml') down 2>$null
        
        if (-not (Wait-DevContainersRemoved -TimeoutSeconds 60)) {
            Write-Host '  [ERROR] Previous containers are still being removed or are stuck.' -ForegroundColor Red
            Write-Host '  Try running: docker stop $(docker ps -aq); docker rm $(docker ps -aq)' -ForegroundColor Gray
            exit 1
        }
    }
    if ($Build) {
        docker compose -f $devCompose up -d --build
    } else {
        docker compose -f $devCompose up -d
    }
    if ($LASTEXITCODE -ne 0) {
        Write-Host ''
        Write-Host '  [ERROR] DEV mode failed to start. Check: docker compose -f docker-compose.dev.yml logs -f' -ForegroundColor Red
        exit 1
    }
    Write-Host ''
    Write-Host '========================================' -ForegroundColor Green
    Write-Host '  DEV mode started! (hot-reload enabled)' -ForegroundColor Green
    Write-Host '========================================' -ForegroundColor Green
    Write-Host ''
    Write-Host "  Frontend:  $devFrontendUrl" -ForegroundColor Cyan
    Write-Host '  Backend:   http://localhost:8010' -ForegroundColor Cyan
    Write-Host ''
    Write-Host '  * Edit code -> save -> auto refresh!' -ForegroundColor Yellow
    Write-Host '  * Stop with: .\deploy.ps1 -DevDown' -ForegroundColor Gray
    Write-Host ''

    # Wait for the proxied frontend homepage to return success before opening the browser.
    Write-Host '  Waiting for frontend to be ready (first start may take a few minutes)...' -ForegroundColor Gray
    $retries = 0
    $maxRetries = 300
    while ($retries -lt $maxRetries) {
        if (Test-FrontendReady -Url $devFrontendUrl) { break }
        if ($retries % 10 -eq 0 -and $retries -gt 0) {
            Write-Host "  Still waiting... ($retries s)" -ForegroundColor DarkGray
        }
        Start-Sleep -Seconds 1
        $retries++
    }
    if ($retries -ge $maxRetries) {
        Write-Host '  [WARN] Frontend did not respond in time. Check: docker compose -f docker-compose.dev.yml logs -f frontend nginx' -ForegroundColor Yellow
    } else {
        try {
            Start-Process $devFrontendUrl
            Write-Host '  Browser opened! Happy coding!' -ForegroundColor Green
        } catch {}
    }
    Write-Host ''
    exit 0
}

if ($DevDown) {
    Write-Host 'Stopping DEV mode...' -ForegroundColor Yellow
    $devCompose = Join-Path $ProjectRoot 'docker-compose.dev.yml'
    docker compose -f $devCompose down
    if ($LASTEXITCODE -ne 0) {
        Write-Host '[ERROR] Failed to stop DEV mode cleanly.' -ForegroundColor Red
        exit 1
    }
    if (-not (Wait-DevContainersRemoved -TimeoutSeconds 60)) {
        Write-Host '[WARN] Docker is still cleaning up DEV containers. A rapid restart may fail for a few more seconds.' -ForegroundColor Yellow
    }
    Write-Host 'DEV mode stopped.' -ForegroundColor Green
    exit 0
}

# Stop all services
if ($Down) {
    Write-Host 'Stopping all services...' -ForegroundColor Yellow
    docker compose -f (Join-Path $ProjectRoot 'docker-compose.yml') down
    Write-Host 'All services stopped.' -ForegroundColor Green
    exit 0
}

# View logs
if ($Logs) {
    docker compose -f (Join-Path $ProjectRoot 'docker-compose.yml') logs -f
    exit 0
}

# Run database migration
if ($Migrate) {
    Write-Host 'Running database migration...' -ForegroundColor Yellow
    docker compose -f (Join-Path $ProjectRoot 'docker-compose.yml') exec backend alembic upgrade head
    Write-Host 'Migration complete.' -ForegroundColor Green
    exit 0
}

# Seed subject data
if ($Seed) {
    Write-Host 'Seeding subject data...' -ForegroundColor Yellow
    docker compose -f (Join-Path $ProjectRoot 'docker-compose.yml') exec backend python -m scripts.seed_subjects
    Write-Host 'Seed complete.' -ForegroundColor Green
    exit 0
}

# Check .env file
$envFile = Join-Path $ProjectRoot '.env'
if (-not (Test-Path $envFile)) {
    Write-Host '[INFO] .env not found, creating from template...' -ForegroundColor Yellow
    Copy-Item (Join-Path $ProjectRoot '.env.example') $envFile
    Write-Host '[INFO] .env created.' -ForegroundColor Green
    Write-Host ''
    Write-Host '  Please edit .env and re-run this script.' -ForegroundColor Yellow
    Write-Host '    - POSTGRES_PASSWORD' -ForegroundColor Gray
    Write-Host '    - JWT_SECRET' -ForegroundColor Gray
    Write-Host '    - ENCRYPTION_KEY' -ForegroundColor Gray
    Write-Host '    - FRONTEND_PORT (default 80)' -ForegroundColor Gray
    Write-Host ''
    exit 0
}

# Build and start
$composeFile = Join-Path $ProjectRoot 'docker-compose.yml'

Write-Host '[1/3] Building Docker images...' -ForegroundColor Yellow
if ($Build) {
    docker compose -f $composeFile build --no-cache
} else {
    docker compose -f $composeFile build
}
if ($LASTEXITCODE -ne 0) {
    Write-Host '[ERROR] Failed to build main Docker images.' -ForegroundColor Red
    exit 1
}

Write-Host ''
Write-Host '[2/3] Starting all services...' -ForegroundColor Yellow
docker compose -f $composeFile up -d

Write-Host ''
Write-Host '[3/3] Waiting for services...' -ForegroundColor Yellow

# Wait for backend health check
$retries = 0
$maxRetries = 30
while ($retries -lt $maxRetries) {
    try {
        $resp = Invoke-WebRequest -Uri 'http://localhost:8010/health' -UseBasicParsing -TimeoutSec 3 -ErrorAction SilentlyContinue
        if ($resp.StatusCode -eq 200) { break }
    } catch {}
    Start-Sleep -Seconds 2
    $retries++
}

# Read port config
$fp = if ($env:FRONTEND_PORT) { $env:FRONTEND_PORT } else { '80' }
$bp = if ($env:BACKEND_PORT)  { $env:BACKEND_PORT }  else { '8010' }

Write-Host ''
Write-Host '========================================' -ForegroundColor Green
Write-Host '  All services started!' -ForegroundColor Green
Write-Host '========================================' -ForegroundColor Green
Write-Host ''
Write-Host "  Frontend:  http://localhost:$fp" -ForegroundColor Cyan
Write-Host "  Backend:   http://localhost:$bp" -ForegroundColor Cyan
Write-Host "  API Docs:  http://localhost:$fp/docs" -ForegroundColor Cyan
Write-Host "  Health:    http://localhost:$fp/health" -ForegroundColor Cyan
Write-Host ''
Write-Host '  Commands:' -ForegroundColor Yellow
Write-Host '    Logs:      .\deploy.ps1 -Logs' -ForegroundColor Gray
Write-Host '    Stop:      .\deploy.ps1 -Down' -ForegroundColor Gray
Write-Host '    Migrate:   .\deploy.ps1 -Migrate' -ForegroundColor Gray
Write-Host '    Seed:      .\deploy.ps1 -Seed' -ForegroundColor Gray
Write-Host '    Rebuild:   .\deploy.ps1 -Build' -ForegroundColor Gray
Write-Host '    Dev mode:  .\deploy.ps1 -Dev  (hot-reload!)' -ForegroundColor Magenta
Write-Host '    Stop Dev:  .\deploy.ps1 -DevDown' -ForegroundColor Gray
Write-Host ''
Write-Host '  First deploy? Run migration and seed:' -ForegroundColor Yellow
Write-Host '    .\deploy.ps1 -Migrate' -ForegroundColor Gray
Write-Host '    .\deploy.ps1 -Seed' -ForegroundColor Gray
Write-Host ''

# Try to open browser
try {
    Start-Process "http://localhost:$fp"
} catch {}
