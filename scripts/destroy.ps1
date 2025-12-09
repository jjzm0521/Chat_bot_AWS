# Script para destruir recursos de Chatbot AWS
# Ejecutar: .\scripts\destroy.ps1

param(
    [switch]$Force
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Write-Host "============================================" -ForegroundColor Red
Write-Host "  Chatbot AWS - Destruir Recursos" -ForegroundColor Red
Write-Host "============================================" -ForegroundColor Red
Write-Host ""

if (-not $Force) {
    Write-Host "ADVERTENCIA: Esto eliminará TODOS los recursos AWS del proyecto." -ForegroundColor Yellow
    Write-Host "Incluye: DynamoDB tables, S3 buckets, Lambda functions, Lex bot, etc." -ForegroundColor Yellow
    Write-Host ""
    $confirm = Read-Host "¿Estás seguro? Escribe 'SI' para confirmar"
    
    if ($confirm -ne "SI") {
        Write-Host "Operación cancelada." -ForegroundColor Green
        exit 0
    }
}

Write-Host ""
Write-Host "Destruyendo recursos..." -ForegroundColor Yellow

Set-Location $ProjectRoot

# Destruir todos los stacks
npx cdk destroy --all --force

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "  ✓ Recursos eliminados exitosamente" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Red
    Write-Host "  ✗ Error al eliminar recursos" -ForegroundColor Red
    Write-Host "============================================" -ForegroundColor Red
    Write-Host "Algunos recursos pueden requerir eliminación manual." -ForegroundColor Yellow
    exit 1
}
