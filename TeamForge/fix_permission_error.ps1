# PowerShell script to clean up orphaned/unresolved SIDs (AppContainers) from file/folder ACLs.
# This resolves the "opening NUL for ACL write: Access is denied" error on Windows.
# Run this script in an Administrator PowerShell window if permissions are denied.

$rootPath = "d:\Team Forge\Project-Sync"

Write-Host "Scanning permissions for: $rootPath" -ForegroundColor Cyan

# Gather root folder and all recursive subfolders/files
$paths = @($rootPath)
try {
    $paths += Get-ChildItem -Path $rootPath -Recurse -Force -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName
} catch {
    Write-Warning "Could not list all child items: $_"
}

$processedCount = 0
$removedCount = 0

foreach ($path in $paths) {
    if (Test-Path -LiteralPath $path) {
        $processedCount++
        try {
            $acl = Get-Acl -LiteralPath $path -ErrorAction Stop
            $modified = $false
            
            $rulesToRemove = @()
            foreach ($access in $acl.Access) {
                $identity = $access.IdentityReference
                
                $isOrphan = $false
                try {
                    # Try to translate to NTAccount (e.g. DOMAIN\User)
                    $null = $identity.Translate([System.Security.Principal.NTAccount])
                } catch {
                    $isOrphan = $true
                }
                
                # Match AppContainer SIDs (S-1-15-...) or unresolvable SIDs
                if ($isOrphan -or $identity.Value -match "^S-1-15-") {
                    $rulesToRemove += $access
                }
            }
            
            foreach ($rule in $rulesToRemove) {
                Write-Host "Removing orphaned entry '$($rule.IdentityReference.Value)' from: $path" -ForegroundColor Yellow
                $acl.RemoveAccessRule($rule) | Out-Null
                $modified = $true
                $removedCount++
            }
            
            if ($modified) {
                Set-Acl -LiteralPath $path -AclObject $acl -ErrorAction Stop
                Write-Host "Updated ACL for: $path" -ForegroundColor Green
            }
        } catch {
            # Frequently, system files or locked files might fail, which is okay to skip.
            Write-Verbose "Skipped $path : $_"
        }
    }
}

Write-Host "`nScan completed. Processed $processedCount items. Removed $removedCount orphaned security rules." -ForegroundColor Cyan
Write-Host "You can now try running your terminal commands again." -ForegroundColor Green
