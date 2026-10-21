# instalar-flutter.ps1 — Instala Flutter SDK en Windows y verifica el entorno
# Uso:  powershell -ExecutionPolicy Bypass -File .\instalar-flutter.ps1
$ErrorActionPreference = 'Stop'

function Paso($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }

$flutterRoot = Join-Path $env:USERPROFILE 'flutter'
$flutterBin  = Join-Path $flutterRoot 'bin'

# 1. Git (necesario para clonar el SDK)
Paso 'Comprobando Git'
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements
        # winget instala en una sesión nueva; añadimos su PATH temporal para este script
        $env:Path = "$env:Path;C:\Program Files\Git\cmd"
    }
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        throw 'Git no disponible. Instálalo desde https://git-scm.com/download/win y vuelve a ejecutar este script.'
    }
}
Write-Host 'Git OK'

# 2. Flutter SDK (rama stable)
Paso 'Descargando Flutter SDK (rama stable, ~1 GB)'
if (Test-Path (Join-Path $flutterBin 'flutter.bat')) {
    Write-Host "Flutter ya existe en $flutterRoot — se omite la descarga."
} else {
    git clone https://github.com/flutter/flutter.git -b stable $flutterRoot
}

# 3. Añadir flutter\bin al PATH del usuario
Paso 'Configurando PATH'
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if ($userPath -notlike "*$flutterBin*") {
    [Environment]::SetEnvironmentVariable('Path', "$userPath;$flutterBin", 'User')
    Write-Host "Añadido al PATH del usuario: $flutterBin"
} else {
    Write-Host 'flutter\bin ya está en el PATH del usuario.'
}
$env:Path = "$env:Path;$flutterBin"

# 4. Primera ejecución: descarga Dart SDK y herramientas (tarda varios minutos)
Paso 'Primera ejecución de flutter (descarga Dart SDK, puede tardar 5-10 min)'
flutter --version

# 5. Diagnóstico del entorno
Paso 'flutter doctor'
flutter doctor

Write-Host "`nListo. Abre una terminal NUEVA y ejecuta 'flutter doctor' para confirmar." -ForegroundColor Green
Write-Host "Para crear el proyecto:  flutter create .  (dentro de la carpeta del proyecto)" -ForegroundColor Green
