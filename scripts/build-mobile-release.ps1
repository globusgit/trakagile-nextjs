param(
    [string]$ApiBaseUrl = "https://trakagile.com",
    [string]$OutputDirectory = "dist"
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$mobileRoot = Join-Path $projectRoot "mobile"
$pubspec = Get-Content (Join-Path $mobileRoot "pubspec.yaml") -Raw
$versionMatch = [regex]::Match($pubspec, '(?m)^version:\s*([^\s]+)')
if (-not $versionMatch.Success) {
    throw "Could not read the mobile version from pubspec.yaml."
}

$version = $versionMatch.Groups[1].Value.Replace('+', '-build')
$destinationRoot = Join-Path $projectRoot $OutputDirectory
$destination = Join-Path $destinationRoot "TrakAgile-$version.apk"

Push-Location $mobileRoot
try {
    flutter pub get
    flutter analyze
    flutter build apk --release --dart-define="API_BASE_URL=$ApiBaseUrl"
} finally {
    Pop-Location
}

New-Item -ItemType Directory -Force -Path $destinationRoot | Out-Null
Copy-Item -LiteralPath (Join-Path $mobileRoot "build\app\outputs\flutter-apk\app-release.apk") -Destination $destination -Force
$hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $destination).Hash
Write-Host "APK: $destination"
Write-Host "SHA256: $hash"
Write-Warning "Production signing is intentionally pending. Do not distribute this build until a release keystore replaces debug signing."
