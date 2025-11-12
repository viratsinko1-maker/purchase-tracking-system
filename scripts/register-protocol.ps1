$protocolName = "tmkfile"
$handlerPath = "`"$PSScriptRoot\open-network-file.bat`" `"%1`""

# Create Registry Key for the Protocol
New-Item -Path "HKCU:\SOFTWARE\Classes\$protocolName" -Force
Set-ItemProperty -Path "HKCU:\SOFTWARE\Classes\$protocolName" -Name "(Default)" -Value "URL:TMK File Protocol"
Set-ItemProperty -Path "HKCU:\SOFTWARE\Classes\$protocolName" -Name "URL Protocol" -Value ""

# Create Command Registry Key
New-Item -Path "HKCU:\SOFTWARE\Classes\$protocolName\shell\open\command" -Force
Set-ItemProperty -Path "HKCU:\SOFTWARE\Classes\$protocolName\shell\open\command" -Name "(Default)" -Value $handlerPath

Write-Host "Protocol $protocolName registered successfully"