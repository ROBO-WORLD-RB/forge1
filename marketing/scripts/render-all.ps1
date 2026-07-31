# Batch-render FORGE marketing stories → marketing/out/{id}.mp4
# Run from marketing/ :  npm run render:all
# Or:  pwsh ./scripts/render-all.ps1

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$StoriesDir = Join-Path $Root "stories"
$OutDir = Join-Path $Root "out"

if (-not (Test-Path $StoriesDir)) {
  Write-Error "Stories folder not found: $StoriesDir"
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$stories = Get-ChildItem -Path $StoriesDir -Filter "*.json" | Sort-Object Name
if ($stories.Count -eq 0) {
  Write-Error "No JSON stories in $StoriesDir"
}

Write-Host "Found $($stories.Count) stories → $OutDir" -ForegroundColor Cyan

$failed = @()

foreach ($file in $stories) {
  $json = Get-Content -Raw -Path $file.FullName | ConvertFrom-Json
  $id = $json.id
  $type = $json.type

  if (-not $id) {
    Write-Warning "Skipping $($file.Name): missing id"
    continue
  }
  if (-not $type) {
    Write-Warning "Skipping $($file.Name): missing type (pitch|reel)"
    continue
  }

  $composition = switch ($type) {
    "pitch" { "ForgePitch" }
    "reel" { "ForgeReel" }
    default {
      Write-Warning "Skipping $($file.Name): unknown type '$type'"
      $null
    }
  }
  if (-not $composition) { continue }

  $outFile = Join-Path $OutDir "$id.mp4"
  $propsRel = "stories/$($file.Name)"

  Write-Host ""
  Write-Host "▶ $composition ← $propsRel → out/$id.mp4" -ForegroundColor Yellow

  $extra = @()
  if ($type -eq "reel") {
    $extra += @("--image-format=png", "--video-bitrate=8M")
  }

  & npx remotion render $composition $outFile "--props=$propsRel" @extra
  if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed: $id (exit $LASTEXITCODE)" -ForegroundColor Red
    $failed += $id
  } else {
    Write-Host "✓ Done: out/$id.mp4" -ForegroundColor Green
  }
}

Write-Host ""
if ($failed.Count -gt 0) {
  Write-Host "Finished with $($failed.Count) failure(s): $($failed -join ', ')" -ForegroundColor Red
  exit 1
}

Write-Host "All stories rendered." -ForegroundColor Green
