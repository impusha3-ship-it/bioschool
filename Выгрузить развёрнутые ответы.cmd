@echo off
chcp 65001 >nul
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$d = 'impusha1@yandex.ru'; $m = Read-Host ('Pochta (Enter = ' + $d + ')'); if (-not $m) { $m = $d }; $s = Read-Host 'Parol (vvod ne viden)' -AsSecureString; $p = [System.Net.NetworkCredential]::new('', $s).Password; node scripts/vygruzka-otvetov.mjs $m $p"
echo.
pause
