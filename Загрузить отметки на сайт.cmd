@echo off
chcp 65001 >nul
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$d='impusha1@yandex.ru'; $m=Read-Host ('Pochta (Enter = '+$d+')'); if(-not $m){$m=$d}; $s=Read-Host 'Parol (vvod ne viden)' -AsSecureString; $p=[System.Net.NetworkCredential]::new('',$s).Password; Write-Host ''; Write-Host '--- SNACHALA POKAZHU, CHTO IZMENITSYA. NICHEGO NE ZAPISYVAETSYA ---'; Write-Host ''; node scripts/prostavit-otmetki.mjs $m $p; if($LASTEXITCODE -ne 0){ Write-Host ''; Write-Host 'NE POLUCHILOS. Prichina vyshe. Nichego ne zapisano.' -ForegroundColor Red; exit }; Write-Host ''; $o=Read-Host 'Zapisat eti otmetki na sait? Napishite da ili net'; if($o -ne 'da'){ Write-Host 'Nichego ne zapisano.'; exit }; Write-Host ''; node scripts/prostavit-otmetki.mjs $m $p --go; if($LASTEXITCODE -ne 0){ Write-Host ''; Write-Host 'ZAPIS NE PROSHLA. Prichina vyshe.' -ForegroundColor Red } else { Write-Host ''; Write-Host 'GOTOVO. Teper zapustite Pereschitat tablicu pochyota.cmd' -ForegroundColor Green }"
echo.
pause
