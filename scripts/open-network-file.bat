@echo off
SET url=%1
SET url=%url:tmkfile://=%
SET url=\\%url:/=\%
start "" "%url%"