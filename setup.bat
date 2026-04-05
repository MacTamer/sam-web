@echo off
title Sam Web — Setup
cd /d "%~dp0"

echo.
echo  Sam Web — First-time setup
echo  ============================
echo.

:: Check for Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo  Node.js is not installed.
    echo.
    echo  1. Go to https://nodejs.org
    echo  2. Download the LTS version (the green button)
    echo  3. Install it, then re-run this script
    echo.
    pause
    exit
)

echo  Node.js found:
node --version

echo.
echo  Installing dependencies...
npm install

echo.
echo  Done! Now:
echo.
echo  1. Open .env.local and fill in your API keys
echo     - OPENAI_API_KEY  (copy from SAM/.env)
echo     - NEXT_PUBLIC_SUPABASE_URL
echo     - NEXT_PUBLIC_SUPABASE_ANON_KEY
echo     - SUPABASE_SERVICE_ROLE_KEY
echo.
echo  2. Create a Supabase project at https://supabase.com
echo     - Go to SQL Editor and run supabase/migrations/001_init.sql
echo.
echo  3. Run start.bat to launch the dev server
echo.
pause
