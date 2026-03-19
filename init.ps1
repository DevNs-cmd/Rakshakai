# RAKSHAK — Autonomous Governance Integrity System
# Automated Environment Provisioner

Write-Host "Initializing RAKSHAK System Core..." -ForegroundColor Blue

# 1. Project Root Check
if (!(Test-Path .\backend) -or !(Test-Path .\frontend)) {
    Write-Error "Invalid root directory. Execute from Rakshak AI folder."
    exit
}

# 2. Python Environment Setup
Write-Host "`nStep 1: Setting up Python Virtual Environment..." -ForegroundColor Gray
if (!(Test-Path .\backend\venv)) {
    python -m venv .\backend\venv
}
.\backend\venv\Scripts\Activate.ps1

Write-Host "Installing Backend Dependencies (Modular)..."
pip install -r .\backend\requirements.txt

# 3. Environment Config
Write-Host "`nStep 2: Syncing Environment Configurations..." -ForegroundColor Gray
if (!(Test-Path .\backend\.env)) {
    Copy-Item .\backend\.env.example .\backend\.env
    Write-Host "Created backend .env (Using development defaults)" -ForegroundColor Yellow
}

if (!(Test-Path .\frontend\.env.local)) {
    Set-Content -Path .\frontend\.env.local -Value "NEXT_PUBLIC_API_URL=http://localhost:8000`nNEXT_PUBLIC_MAPBOX_TOKEN=YOUR_MAPBOX_ACCESS_TOKEN_HERE"
    Write-Host "Created frontend .env.local (placeholder Mapbox token - add your own)" -ForegroundColor Yellow
}

# 4. Frontend Setup
Write-Host "`nStep 3: Initializing Frontend (App Router)..." -ForegroundColor Gray
$currentDir = Get-Location
Set-Location .\frontend
npm install
Set-Location $currentDir

# 5. Database & Seed
Write-Host "`nStep 4: Launching System Control Center..." -ForegroundColor Green
Write-Host "Tip: Run 'docker-compose up -d' for the full production stack.`n" -ForegroundColor Cyan

Write-Host "System initialized. Starting Development Cluster..."
Write-Host "Backend: http://localhost:8000" -ForegroundColor Blue
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Blue

# Optional: Run concurrently (requires two terminals, but this script provides a start point)
Write-Host "`nTo start services manually:"
Write-Host "1. cd backend; .\venv\Scripts\Activate.ps1; python main.py"
Write-Host "2. cd frontend; npm run dev"
