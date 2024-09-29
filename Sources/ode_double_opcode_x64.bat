:: Prepares ODE project files for x64 platform with double-precision math
@echo off

cd Extras/ode/build
rmdir /s /q vs2010
premake4.exe --os=windows --platform=x64 --only-double vs2010
