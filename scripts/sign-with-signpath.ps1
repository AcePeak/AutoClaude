<#
.SYNOPSIS
    Sign AutoClaude installer with SignPath

.DESCRIPTION
    This script helps submit the unsigned installer to SignPath for code signing.
    SignPath keeps private keys secure on their HSM - signing happens remotely.

.PARAMETER ApiToken
    Your SignPath API token (from User Profile > API Tokens)

.PARAMETER OrganizationId
    Your SignPath organization ID

.PARAMETER ProjectSlug
    Your SignPath project slug (e.g., "autoclaude")

.PARAMETER SigningPolicySlug
    The signing policy to use (e.g., "release-signing" or "test-signing")

.PARAMETER InputFile
    Path to the unsigned installer (default: dist-electron/AutoClaude Setup *.exe)

.EXAMPLE
    .\sign-with-signpath.ps1 -ApiToken "your-token" -OrganizationId "your-org-id" -ProjectSlug "autoclaude" -SigningPolicySlug "release-signing"
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$ApiToken,

    [Parameter(Mandatory=$true)]
    [string]$OrganizationId,

    [Parameter(Mandatory=$true)]
    [string]$ProjectSlug,

    [Parameter(Mandatory=$true)]
    [string]$SigningPolicySlug,

    [string]$InputFile
)

$ErrorActionPreference = "Stop"

# Find the installer if not specified
if (-not $InputFile) {
    $installers = Get-ChildItem -Path "dist-electron" -Filter "AutoClaude*.exe" | Where-Object { $_.Name -notmatch "signed" }
    if ($installers.Count -eq 0) {
        Write-Error "No installer found in dist-electron/. Run 'npm run build:win' first."
        exit 1
    }
    $InputFile = $installers[0].FullName
    Write-Host "Found installer: $InputFile"
}

if (-not (Test-Path $InputFile)) {
    Write-Error "Input file not found: $InputFile"
    exit 1
}

$fileName = Split-Path $InputFile -Leaf
$outputFile = $InputFile -replace '\.exe$', '-signed.exe'

Write-Host ""
Write-Host "SignPath Code Signing" -ForegroundColor Cyan
Write-Host "=====================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Input:  $InputFile"
Write-Host "Output: $outputFile"
Write-Host ""

# Step 1: Create signing request
Write-Host "Step 1: Submitting to SignPath..." -ForegroundColor Yellow

$headers = @{
    "Authorization" = "Bearer $ApiToken"
}

$uri = "https://app.signpath.io/API/v1/$OrganizationId/SigningRequests"

# Read file as bytes
$fileBytes = [System.IO.File]::ReadAllBytes($InputFile)
$fileBase64 = [Convert]::ToBase64String($fileBytes)

$body = @{
    ProjectSlug = $ProjectSlug
    SigningPolicySlug = $SigningPolicySlug
    ArtifactConfigurationSlug = "default"
    Description = "AutoClaude installer signing"
    Artifact = @{
        FileName = $fileName
        Content = $fileBase64
    }
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Body $body -ContentType "application/json"
    $signingRequestId = $response.signingRequestId
    $signingRequestUrl = $response.signingRequestUrl

    Write-Host "Signing request created: $signingRequestId" -ForegroundColor Green
    Write-Host "URL: $signingRequestUrl"
} catch {
    Write-Error "Failed to create signing request: $_"
    Write-Host ""
    Write-Host "Common issues:" -ForegroundColor Yellow
    Write-Host "  - Invalid API token"
    Write-Host "  - Wrong organization ID"
    Write-Host "  - Project or policy slug not found"
    Write-Host ""
    Write-Host "You can also sign manually at: https://app.signpath.io" -ForegroundColor Cyan
    exit 1
}

# Step 2: Wait for signing to complete
Write-Host ""
Write-Host "Step 2: Waiting for signing to complete..." -ForegroundColor Yellow

$statusUri = "https://app.signpath.io/API/v1/$OrganizationId/SigningRequests/$signingRequestId"
$maxWaitMinutes = 10
$startTime = Get-Date

while ($true) {
    Start-Sleep -Seconds 10

    $elapsed = (Get-Date) - $startTime
    if ($elapsed.TotalMinutes -gt $maxWaitMinutes) {
        Write-Host ""
        Write-Host "Timeout waiting for signing. Check status at:" -ForegroundColor Yellow
        Write-Host $signingRequestUrl
        exit 1
    }

    try {
        $status = Invoke-RestMethod -Uri $statusUri -Method Get -Headers $headers

        Write-Host "  Status: $($status.status) (elapsed: $([int]$elapsed.TotalSeconds)s)"

        if ($status.status -eq "Completed") {
            Write-Host ""
            Write-Host "Signing completed!" -ForegroundColor Green
            break
        } elseif ($status.status -eq "Failed" -or $status.status -eq "Denied") {
            Write-Host ""
            Write-Error "Signing failed with status: $($status.status)"
            Write-Host "Check details at: $signingRequestUrl"
            exit 1
        }
    } catch {
        Write-Host "  (checking...)"
    }
}

# Step 3: Download signed artifact
Write-Host ""
Write-Host "Step 3: Downloading signed artifact..." -ForegroundColor Yellow

$downloadUri = "https://app.signpath.io/API/v1/$OrganizationId/SigningRequests/$signingRequestId/SignedArtifact"

try {
    Invoke-WebRequest -Uri $downloadUri -Headers $headers -OutFile $outputFile
    Write-Host "Downloaded to: $outputFile" -ForegroundColor Green
} catch {
    Write-Error "Failed to download signed artifact: $_"
    Write-Host "You can download manually from: $signingRequestUrl"
    exit 1
}

Write-Host ""
Write-Host "Done! Signed installer: $outputFile" -ForegroundColor Cyan
Write-Host ""
