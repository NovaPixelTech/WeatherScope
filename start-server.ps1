# WeatherScope launcher
#
# Prefers the zero-dependency Node server (server.js), which serves the static
# app AND the accounts/favorites API in one process. When Node is not installed
# it falls back to a PowerShell static file server: the app still works, but
# sign-in and favorites are unavailable, and the account panel says so.
#
#   .\start-server.ps1                 # node when available, else static
#   .\start-server.ps1 -Port 8080      # choose a port
#   .\start-server.ps1 -Static         # force the static-only server
param (
    [int]$Port = 3000,
    [switch]$Static
)

$HostIP = "127.0.0.1"
$Url = "http://$($HostIP):$Port/"
$Folder = $PSScriptRoot

if (-not (Test-Path $Folder)) {
    Write-Error "Directory not found: $Folder"
    exit 1
}

$node = Get-Command node -ErrorAction SilentlyContinue

if ($node -and -not $Static) {
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host " WeatherScope server (node server.js)" -ForegroundColor Green
    Write-Host " URL: $Url" -ForegroundColor Yellow
    Write-Host " Accounts & favorites: enabled" -ForegroundColor Green
    Write-Host " Press Ctrl+C in this terminal to stop." -ForegroundColor Gray
    Write-Host "==========================================" -ForegroundColor Cyan

    $env:PORT = "$Port"
    $env:HOST = $HostIP

    # Open the browser once the port actually answers, so we never race startup.
    $opener = Start-Job -ScriptBlock {
        param($u)
        for ($i = 0; $i -lt 24; $i++) {
            try {
                $req = [System.Net.WebRequest]::Create($u)
                $req.Method = "HEAD"
                $req.Timeout = 500
                $resp = $req.GetResponse()
                $resp.Close()
                break
            } catch {
                Start-Sleep -Milliseconds 250
            }
        }
        Start-Process $u
    } -ArgumentList $Url

    Push-Location $Folder
    try {
        & node "server.js"
    } finally {
        Pop-Location
        Stop-Job $opener -ErrorAction SilentlyContinue
        Remove-Job $opener -Force -ErrorAction SilentlyContinue
    }
    exit $LASTEXITCODE
}

# --- Fallback: static-only PowerShell server -------------------------------
if ($Static) {
    Write-Host "Starting static-only server (-Static)." -ForegroundColor Yellow
} else {
    Write-Host "Node was not found, so accounts and favorites are unavailable." -ForegroundColor Yellow
    Write-Host "Install Node.js and re-run to enable sign-in. Serving static files only." -ForegroundColor Yellow
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($Url)

try {
    $listener.Start()
} catch {
    Write-Warning "Could not bind to $Url. Trying port 8080..."
    $Port = 8080
    $Url = "http://$($HostIP):$Port/"
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add($Url)
    $listener.Start()
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " WeatherScope App Server Running!" -ForegroundColor Green
Write-Host " URL: $Url" -ForegroundColor Yellow
Write-Host " Press Ctrl+C in this terminal to stop." -ForegroundColor Gray
Write-Host "==========================================" -ForegroundColor Cyan

# Launch default browser
Start-Process $Url

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $relPath = $request.Url.LocalPath.TrimStart('/')
        if ([string]::IsNullOrEmpty($relPath) -or $relPath -eq "/") {
            $relPath = "index.html"
        }

        # Prevent directory traversal
        $relPath = $relPath.Replace('/', [System.IO.Path]::DirectorySeparatorChar)
        $filePath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($Folder, $relPath))

        if ($filePath.StartsWith($Folder) -and (Test-Path $filePath -PathType Leaf)) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $contentType = switch ($ext) {
                ".html" { "text/html; charset=utf-8" }
                ".css"  { "text/css; charset=utf-8" }
                ".js"   { "application/javascript; charset=utf-8" }
                ".json" { "application/json; charset=utf-8" }
                ".png"  { "image/png" }
                ".jpg"  { "image/jpeg" }
                ".svg"  { "image/svg+xml" }
                ".ico"  { "image/x-icon" }
                Default { "application/octet-stream" }
            }

            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentType = $contentType
            $response.ContentLength64 = $bytes.Length
            $response.StatusCode = 200
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $response.OutputStream.Write($msg, 0, $msg.Length)
        }
        $response.Close()
    } catch {
        # Listener stopped or client disconnected
        break
    }
}

$listener.Stop()
