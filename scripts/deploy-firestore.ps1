# Firestore 규칙 배포 (프로젝트: sambong-world-2026)
# 사용 전: firebase login
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..
npx firebase deploy --only firestore --project sambong-world-2026 --non-interactive
Write-Host "완료." -ForegroundColor Green
