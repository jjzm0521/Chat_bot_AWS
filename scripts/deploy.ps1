# Script de despliegue para Chatbot AWS
# Ejecutar: .\scripts\deploy.ps1

param(
    [switch]$SkipFrontend,
    [switch]$SkipBootstrap,
    [switch]$SeedDatabase,
    [string]$Environment = "dev"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Chatbot AWS - Script de Despliegue" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Verificar prerrequisitos
Write-Host "[1/7] Verificando prerrequisitos..." -ForegroundColor Yellow

# Node.js
$nodeVersion = node --version 2>$null
if (-not $nodeVersion) {
    Write-Host "ERROR: Node.js no está instalado" -ForegroundColor Red
    Write-Host "Instalar desde: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}
Write-Host "  ✓ Node.js: $nodeVersion" -ForegroundColor Green

# Python
$pythonVersion = python --version 2>$null
if (-not $pythonVersion) {
    Write-Host "ERROR: Python no está instalado" -ForegroundColor Red
    Write-Host "Instalar desde: https://python.org/" -ForegroundColor Yellow
    exit 1
}
Write-Host "  ✓ Python: $pythonVersion" -ForegroundColor Green

# AWS CLI
$awsVersion = aws --version 2>$null
if (-not $awsVersion) {
    Write-Host "ERROR: AWS CLI no está instalado" -ForegroundColor Red
    Write-Host "Instalar desde: https://aws.amazon.com/cli/" -ForegroundColor Yellow
    exit 1
}
Write-Host "  ✓ AWS CLI: instalado" -ForegroundColor Green

# Verificar credenciales AWS
$awsIdentity = aws sts get-caller-identity 2>$null
if (-not $awsIdentity) {
    Write-Host "ERROR: Credenciales AWS no configuradas" -ForegroundColor Red
    Write-Host "Ejecutar: aws configure" -ForegroundColor Yellow
    exit 1
}
Write-Host "  ✓ AWS Credentials: configuradas" -ForegroundColor Green
Write-Host ""

# Instalar dependencias del proyecto principal
Write-Host "[2/7] Instalando dependencias CDK..." -ForegroundColor Yellow
Set-Location $ProjectRoot
npm install
Write-Host "  ✓ Dependencias CDK instaladas" -ForegroundColor Green
Write-Host ""

# Instalar dependencias Python
Write-Host "[3/7] Instalando dependencias Python..." -ForegroundColor Yellow
pip install -r backend/requirements.txt
Write-Host "  ✓ Dependencias Python instaladas" -ForegroundColor Green
Write-Host ""

# Construir Lambda Layer
Write-Host "[4/7] Construyendo Lambda Layer..." -ForegroundColor Yellow
$layerPath = Join-Path $ProjectRoot "backend/layers/shared/python"
if (-not (Test-Path $layerPath)) {
    New-Item -ItemType Directory -Path $layerPath -Force | Out-Null
}
pip install -r backend/layers/shared/requirements.txt -t $layerPath --quiet

# Copiar shared module al layer
$sharedSource = Join-Path $ProjectRoot "backend/src/shared"
$sharedDest = Join-Path $layerPath "shared"
if (Test-Path $sharedSource) {
    Copy-Item -Path $sharedSource -Destination $sharedDest -Recurse -Force
}
Write-Host "  ✓ Lambda Layer construido" -ForegroundColor Green
Write-Host ""

# Construir Frontend (si no se omite)
if (-not $SkipFrontend) {
    Write-Host "[5/7] Construyendo Frontend..." -ForegroundColor Yellow
    Set-Location (Join-Path $ProjectRoot "frontend")
    npm install
    npm run build
    Set-Location $ProjectRoot
    Write-Host "  ✓ Frontend construido" -ForegroundColor Green
} else {
    Write-Host "[5/7] Saltando build del Frontend..." -ForegroundColor Yellow
}
Write-Host ""

# CDK Bootstrap (solo primera vez)
if (-not $SkipBootstrap) {
    Write-Host "[6/7] Ejecutando CDK Bootstrap..." -ForegroundColor Yellow
    npx cdk bootstrap 2>$null
    Write-Host "  ✓ CDK Bootstrap completado" -ForegroundColor Green
} else {
    Write-Host "[6/7] Saltando CDK Bootstrap..." -ForegroundColor Yellow
}
Write-Host ""

# Desplegar con CDK
Write-Host "[7/7] Desplegando infraestructura con CDK..." -ForegroundColor Yellow
npx cdk deploy --all --require-approval never

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "  ✓ DESPLIEGUE EXITOSO" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Green
    
    # Obtener outputs
    Write-Host ""
    Write-Host "URLs importantes:" -ForegroundColor Cyan
    
    # Mostrar outputs del stack
    $outputs = aws cloudformation describe-stacks --stack-name ChatbotFrontendStack --query "Stacks[0].Outputs" 2>$null | ConvertFrom-Json
    foreach ($output in $outputs) {
        Write-Host "  $($output.OutputKey): $($output.OutputValue)" -ForegroundColor White
    }
    
    Write-Host ""
    Write-Host "Próximos pasos:" -ForegroundColor Yellow
    Write-Host "  1. Actualizar VITE_WEBSOCKET_URL en frontend con el WebSocket endpoint"
    Write-Host "  2. Reconstruir y desplegar frontend: cd frontend && npm run build"
    Write-Host "  3. Subir frontend a S3: aws s3 sync frontend/dist s3://<bucket-name>"
    Write-Host "  4. Poblar base de datos: python scripts/seed-database.py"
    
} else {
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Red
    Write-Host "  ✗ ERROR EN EL DESPLIEGUE" -ForegroundColor Red
    Write-Host "============================================" -ForegroundColor Red
    Write-Host "Revisar los mensajes de error arriba" -ForegroundColor Yellow
    exit 1
}
