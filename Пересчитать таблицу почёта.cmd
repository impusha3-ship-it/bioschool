@echo off
chcp 65001 >nul
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$m = Read-Host 'Pochta uchitelya (email)'; $s = Read-Host 'Parol (vvod ne viden)' -AsSecureString; $p = [System.Net.NetworkCredential]::new('', $s).Password; node scripts/pereschet-pochyota.mjs $m $p"
echo.
pause
