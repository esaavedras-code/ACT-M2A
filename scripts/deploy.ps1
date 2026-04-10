# Script de Rebuild, Push y Deploy para PACT
# Diseñado por Enrique Saavedra Sada, PE

$date = Get-Date -Format "yy.MMdd"
$version = "3.$date"

Write-Host "Actualizando versión a $version..." -ForegroundColor Cyan

# Actualizar package.json
$json = Get-Content "package.json" | ConvertFrom-Json
$json.version = $version
$json | ConvertTo-Json -Depth 20 | Set-Content "package.json"

Write-Host "Generando nuevo icono..." -ForegroundColor Yellow
node scripts/generate-icon.js

Write-Host "Compilando aplicación Electron (.exe)..." -ForegroundColor Green
npm run electron:build

Write-Host "Realizando Push a Git..." -ForegroundColor Magenta
git add .
git commit -m "Build and Deploy $version - Enrique Saavedra"
git push

Write-Host "¡Proceso completado con éxito para la versión $version!" -ForegroundColor Green
