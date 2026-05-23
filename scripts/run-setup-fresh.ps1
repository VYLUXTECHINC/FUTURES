# Run this in PowerShell as Administrator to clear cached setup script and re-download
Remove-Item "$env:TEMP\setup.ps1" -Force -ErrorAction SilentlyContinue
$wc = New-Object System.Net.WebClient
$wc.Headers.Add("Cache-Control", "no-cache")
$wc.DownloadFile("https://raw.githubusercontent.com/VYLUXTECHINC/FUTURES/b41c8e8/scripts/setup-vps.ps1", "$env:TEMP\setup.ps1")
& "$env:TEMP\setup.ps1"
