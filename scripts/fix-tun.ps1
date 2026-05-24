Write-Host "=== Stop NSSM tunnel ===" -ForegroundColor Yellow
C:\nssm\nssm.exe stop CloudflaredTunnel 2>&1 | Out-Null
Start-Sleep 3
Write-Host "=== Copy credentials for SYSTEM access ===" -ForegroundColor Yellow
Copy-Item "$env:USERPROFILE\.cloudflared\*.json" C:\cloudflared\ -Force
Copy-Item "$env:USERPROFILE\.cloudflared\cert.pem" C:\cloudflared\ -Force
Write-Host "=== Update config path ===" -ForegroundColor Yellow
$cfg = Get-Content C:\cloudflared\config.yml
$cfg = $cfg -replace "C:\\Users\\.*?\\.cloudflared", "C:\cloudflared"
$cfg | Set-Content C:\cloudflared\config.yml -Force
Copy-Item C:\cloudflared\config.yml "$env:USERPROFILE\.cloudflared\config.yml" -Force
Write-Host "=== Update NSSM to run as Administrator ===" -ForegroundColor Yellow
C:\nssm\nssm.exe set CloudflaredTunnel AppParameters "tunnel --config C:\cloudflared\config.yml run futures-bot"
Write-Host "=== Start ===" -ForegroundColor Yellow
C:\nssm\nssm.exe start CloudflaredTunnel
Start-Sleep 15
Write-Host "=== Status ===" -ForegroundColor Yellow
C:\cloudflared\cloudflared.exe tunnel info futures-bot
Write-Host "Done." -ForegroundColor Green
