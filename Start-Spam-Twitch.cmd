@echo off
cd /d "%~dp0"
start "" "%~dp0SpamCardInspector.exe"
if errorlevel 1 pause
