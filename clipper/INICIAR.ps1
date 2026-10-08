# INICIAR - the UNICO file that corres. Hace EVERYTHING automatico:
#   actualiza -> instala (only the 1to vez) -> revisa tus keys -> EDITA and UPLOADS the Shorts to R2.
$ErrorActionPreference = "Continue"
$env:PYTHONUTF8 = "1"   # para que los textos con acentos/emoji del avance no rompan en Windows
$clipper = $PSScriptRoot
Set-Location $clipper
Clear-Host
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "        ODDLY CLIPPER  -  arranque automatico" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# [1] Traer lo last of the repo
Write-Host ""
Write-Host "[1/4] Actualizando el codigo..." -ForegroundColor Yellow
try { git -C (Split-Path $clipper -Parent) pull --quiet } catch {}

# [2] Instalar (only the first vez)
if (-not (Test-Path ".\venv")) {
  Write-Host "[2/4] Primera vez: instalando todo (tarda unos minutos, es 1 sola vez)..." -ForegroundColor Yellow
  powershell -ExecutionPolicy Bypass -File ".\setup.ps1"
} else {
  Write-Host "[2/4] Revisando dependencias..." -ForegroundColor Yellow
  .\venv\Scripts\python.exe -m pip install -q -r requirements.txt *> "$clipper\setup_install.log"
  Write-Host "[2/4] Dependencias al dia. OK" -ForegroundColor Green
}

# [3] Revisar that tengas tus keys (lo unico manual, 1 sola vez)
if (-not (Test-Path ".\.env")) { Copy-Item ".env.example" ".env" }
$envtxt = Get-Content ".\.env" -Raw
if ($envtxt -match "(?m)(GEMINI_API_KEY|R2_ACCESS_KEY_ID)=\s*$") {
  Write-Host ""
  Write-Host "[3/4] FALTAN TUS CLAVES (gratis). Abro el .env - pega tus claves, GUARDA (Ctrl+S), cierra y vuelve." -ForegroundColor Red
  Start-Sleep 2
  notepad ".\.env"
  Read-Host "   Cuando ya guardaste tus claves, presiona ENTER para seguir"
} else {
  Write-Host "[3/4] Claves cargadas. OK" -ForegroundColor Green
}

# Acceso of the Escritorio (by if not esta)
powershell -ExecutionPolicy Bypass -File ".\scripts\crear_acceso_escritorio.ps1" 2>$null

# [4] EDITAR and UPLOAD (everything automatico)
Write-Host ""
Write-Host "[4/4] Editando y subiendo a R2 (corre solo, no tienes que hacer nada)..." -ForegroundColor Yellow
Write-Host ""
.\venv\Scripts\python.exe -m src.pipeline

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " Listo. Los Shorts quedaron en R2." -ForegroundColor Green
Write-Host " (Falta el lado del bot para aprobarlos - lo estamos armando.)" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
Read-Host "Presiona ENTER para cerrar"
