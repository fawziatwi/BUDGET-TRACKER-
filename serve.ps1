param([int]$Port = 8080)

$root = $PSScriptRoot
$mimeMap = @{
    '.html' = 'text/html; charset=utf-8'
    '.js'   = 'text/javascript; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.png'  = 'image/png'
    '.svg'  = 'image/svg+xml'
    '.ico'  = 'image/x-icon'
    '.webmanifest' = 'application/manifest+json'
}

$lanIp = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike '169.*' -and $_.IPAddress -ne '127.0.0.1' -and $_.PrefixOrigin -ne 'WellKnown' } |
    Select-Object -First 1 -ExpandProperty IPAddress)

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$lanBound = $false
if ($lanIp) {
    $listener.Prefixes.Add("http://$($lanIp):$Port/")
    try {
        $listener.Start()
        $lanBound = $true
    } catch {
        # LAN binding needs an admin URL reservation on this machine — fall back to localhost-only.
        $listener = New-Object System.Net.HttpListener
        $listener.Prefixes.Add("http://localhost:$Port/")
        $listener.Start()
    }
} else {
    $listener.Start()
}

Write-Output "Serving $root"
Write-Output "  Local:   http://localhost:$Port/"
if ($lanBound) {
    Write-Output "  Network: http://$($lanIp):$Port/  <-- open this on your iPhone (same WiFi)"
} elseif ($lanIp) {
    Write-Output "  Network binding needs an admin URL reservation. Run once as Administrator:"
    Write-Output "    netsh http add urlacl url=http://$($lanIp):$Port/ user=$env:USERDOMAIN\$env:USERNAME"
    Write-Output "  Then re-run this script (non-admin) to serve on your LAN IP too."
}
Write-Output "Press Ctrl+C to stop."

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response
    try {
        $path = $request.Url.AbsolutePath
        if ($path -eq '/') { $path = '/index.html' }
        $filePath = Join-Path $root ($path.TrimStart('/') -replace '/', [System.IO.Path]::DirectorySeparatorChar)

        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $mime = $mimeMap[$ext]
            if (-not $mime) { $mime = 'application/octet-stream' }
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentType = $mime
            $response.ContentLength64 = $bytes.Length
            $response.Headers.Add('Cache-Control', 'no-cache')
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $notFoundBytes = [System.Text.Encoding]::UTF8.GetBytes('Not found')
            $response.OutputStream.Write($notFoundBytes, 0, $notFoundBytes.Length)
        }
    } catch {
        $response.StatusCode = 500
    } finally {
        $response.OutputStream.Close()
    }
}
