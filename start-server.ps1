# Simple lightweight local static HTTP server for SkyCast Weather
param (
    [int]$Port = 3000
)

$HostIP = "127.0.0.1"
$Url = "http://$($HostIP):$Port/"
$Folder = $PSScriptRoot

if (-not (Test-Path $Folder)) {
    Write-Error "Directory not found: $Folder"
    exit 1
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
Write-Host " SkyCast Weather App Server Running!" -ForegroundColor Green
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
