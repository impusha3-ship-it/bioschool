@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo Публикация правил базы Firebase.
echo Откроется браузер: войдите в Google-аккаунт, которому принадлежит проект bioschool-e9271.
echo.
call npx --yes firebase-tools login
call npx --yes firebase-tools deploy --only database
echo.
echo Проверка, что правила действуют:
node scripts/proverka-pravil.mjs
echo.
pause
