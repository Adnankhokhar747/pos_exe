# Copy the renderer (Electron frontend) into backend/renderer/
# Run this from the pos_exe project root:
#   cd c:\Users\adnan\Documents\GitHub\pos_exe
#   .\backend\copy-frontend.ps1

$source = Join-Path $PSScriptRoot "..\apps\renderer"
$dest   = Join-Path $PSScriptRoot "renderer"

Write-Host "Copying renderer from: $source"
Write-Host "             to:       $dest"

if (-not (Test-Path $source)) {
    Write-Error "Source not found: $source"
    exit 1
}

# Copy everything except node_modules
robocopy $source $dest /E /XD "node_modules" /NFL /NDL /NJH /NJS

Write-Host "Done. renderer/ is ready in backend/."
