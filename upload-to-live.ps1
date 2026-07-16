# Upload all PHP backend files to live server via FTP
# Run this script from YOUR PC (not from Claude Code)
# Right-click -> Run with PowerShell

$FtpHost   = "posvan.taqaantech.com"
$FtpPort   = 21
$FtpUser   = "posvan@taqaantech.com"
$FtpPass   = "GVmc90TelY?K"
$RemoteBase = "/pos_api"  # Laravel app root on server

# Local Laravel app root
$LocalBase = Split-Path -Parent $MyInvocation.MyCommand.Path
$LocalBase = Join-Path $LocalBase "backend\api"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Uploading PHP backend to live server..." -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

function Upload-File($localPath, $remotePath) {
    try {
        $uri = "ftp://${FtpHost}:${FtpPort}${remotePath}"
        $req = [System.Net.FtpWebRequest]::Create($uri)
        $req.Method      = [System.Net.WebRequestMethods+Ftp]::UploadFile
        $req.Credentials = New-Object System.Net.NetworkCredential($FtpUser, $FtpPass)
        $req.UseBinary   = $true
        $req.UsePassive  = $true
        $req.KeepAlive   = $false
        $req.Timeout     = 30000

        $fileBytes = [System.IO.File]::ReadAllBytes($localPath)
        $req.ContentLength = $fileBytes.Length
        $stream = $req.GetRequestStream()
        $stream.Write($fileBytes, 0, $fileBytes.Length)
        $stream.Close()

        $resp = $req.GetResponse()
        $resp.Close()
        Write-Host "  [OK] $remotePath" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "  [FAIL] $remotePath : $_" -ForegroundColor Red
        return $false
    }
}

function Ensure-RemoteDir($remotePath) {
    try {
        $uri = "ftp://${FtpHost}:${FtpPort}${remotePath}"
        $req = [System.Net.FtpWebRequest]::Create($uri)
        $req.Method      = [System.Net.WebRequestMethods+Ftp]::MakeDirectory
        $req.Credentials = New-Object System.Net.NetworkCredential($FtpUser, $FtpPass)
        $req.UsePassive  = $true
        $req.KeepAlive   = $false
        $resp = $req.GetResponse()
        $resp.Close()
    } catch {
        # Directory already exists - that's fine
    }
}

# Collect all .php files under backend/api/app/
$files = Get-ChildItem -Path (Join-Path $LocalBase "app") -Recurse -Filter "*.php"

# Also include routes/api.php
$routeFile = Join-Path $LocalBase "routes\api.php"
if (Test-Path $routeFile) {
    $files = @($files) + @(Get-Item $routeFile)
}

$total   = $files.Count
$success = 0
$fail    = 0

Write-Host "Found $total files to upload." -ForegroundColor Yellow
Write-Host ""

# Pre-create common directories
$dirs = @(
    "$RemoteBase/app",
    "$RemoteBase/app/Http",
    "$RemoteBase/app/Http/Controllers",
    "$RemoteBase/app/Http/Controllers/Auth",
    "$RemoteBase/app/Http/Controllers/Backup",
    "$RemoteBase/app/Http/Controllers/Hospital",
    "$RemoteBase/app/Http/Controllers/Identity",
    "$RemoteBase/app/Http/Controllers/Inventory",
    "$RemoteBase/app/Http/Controllers/Platform",
    "$RemoteBase/app/Http/Controllers/POS",
    "$RemoteBase/app/Http/Controllers/Reports",
    "$RemoteBase/app/Http/Controllers/Settings",
    "$RemoteBase/app/Models",
    "$RemoteBase/routes"
)
foreach ($d in $dirs) { Ensure-RemoteDir $d }

foreach ($file in $files) {
    $localPath  = $file.FullName
    $relative   = $localPath.Substring($LocalBase.Length).Replace("\", "/")
    $remotePath = "$RemoteBase$relative"

    if (Upload-File $localPath $remotePath) { $success++ } else { $fail++ }
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Done!  Uploaded: $success   Failed: $fail" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

if ($fail -gt 0) {
    Write-Host ""
    Write-Host "Some files failed. Try uploading them manually via FileZilla." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
