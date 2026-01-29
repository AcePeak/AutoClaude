# AutoClaude Release Script
# Usage: .\release.ps1 [-BumpType major|minor|patch] [-Message "Release notes"]
#
# Examples:
#   .\release.ps1                           # Bump patch version (1.0.0 -> 1.0.1)
#   .\release.ps1 -BumpType minor           # Bump minor version (1.0.1 -> 1.1.0)
#   .\release.ps1 -BumpType major           # Bump major version (1.1.0 -> 2.0.0)
#   .\release.ps1 -Message "Bug fixes"      # Custom release notes

param(
    [ValidateSet("major", "minor", "patch")]
    [string]$BumpType = "patch",

    [string]$Message = ""
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$VersionFile = Join-Path $ScriptDir "version.json"
$IssFile = Join-Path $ScriptDir "installer\autoclaude.iss"
$DistDir = Join-Path $ScriptDir "dist"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  AutoClaude Release Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check for gh CLI
$ghPath = Get-Command "gh" -ErrorAction SilentlyContinue
if (-not $ghPath) {
    # Try common installation paths
    $ghPaths = @(
        "$env:ProgramFiles\GitHub CLI\gh.exe",
        "${env:ProgramFiles(x86)}\GitHub CLI\gh.exe",
        "$env:LOCALAPPDATA\Programs\GitHub CLI\gh.exe"
    )
    foreach ($p in $ghPaths) {
        if (Test-Path $p) {
            $ghPath = $p
            break
        }
    }
}
if (-not $ghPath) {
    Write-Host "[ERROR] GitHub CLI (gh) not found" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install GitHub CLI from:" -ForegroundColor Yellow
    Write-Host "https://cli.github.com/" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Then authenticate with: gh auth login" -ForegroundColor Yellow
    exit 1
}
$gh = if ($ghPath -is [string]) { $ghPath } else { $ghPath.Source }

# Check gh auth status
$authStatus = & $gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Not authenticated with GitHub CLI" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please run: gh auth login" -ForegroundColor Yellow
    exit 1
}

Write-Host "[OK] GitHub CLI authenticated" -ForegroundColor Green

# Check for uncommitted changes
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "[ERROR] You have uncommitted changes" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please commit or stash your changes first:" -ForegroundColor Yellow
    git status --short
    Write-Host ""
    exit 1
}

Write-Host "[OK] Working directory clean" -ForegroundColor Green

# Read current version
if (-not (Test-Path $VersionFile)) {
    Write-Host "[ERROR] Version file not found: $VersionFile" -ForegroundColor Red
    exit 1
}

$version = Get-Content $VersionFile -Raw | ConvertFrom-Json
$oldVersion = "$($version.major).$($version.minor).$($version.patch)"

# Bump version
switch ($BumpType) {
    "major" {
        $version.major++
        $version.minor = 0
        $version.patch = 0
    }
    "minor" {
        $version.minor++
        $version.patch = 0
    }
    "patch" {
        $version.patch++
    }
}

$newVersion = "$($version.major).$($version.minor).$($version.patch)"
Write-Host ""
Write-Host "Version: $oldVersion -> $newVersion" -ForegroundColor Yellow
Write-Host ""

# Update version.json
$version | ConvertTo-Json | Set-Content $VersionFile -Encoding UTF8
Write-Host "[OK] Updated version.json" -ForegroundColor Green

# Update autoclaude.iss
$issContent = Get-Content $IssFile -Raw
$issContent = $issContent -replace '#define MyAppVersion "[\d.]+"', "#define MyAppVersion `"$newVersion`""
Set-Content $IssFile -Value $issContent -Encoding UTF8
Write-Host "[OK] Updated autoclaude.iss" -ForegroundColor Green

# Build installer
Write-Host ""
Write-Host "Building installer..." -ForegroundColor Cyan
& "$ScriptDir\build.ps1"

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Build failed" -ForegroundColor Red
    exit 1
}

# Find the built installer
$installerPath = Get-ChildItem -Path $DistDir -Filter "AutoClaude_Setup_$newVersion.exe" | Select-Object -First 1
if (-not $installerPath) {
    Write-Host "[ERROR] Installer not found in dist directory" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Installer built: $($installerPath.Name)" -ForegroundColor Green

# Generate release notes
$releaseNotes = ""
if ($Message) {
    $releaseNotes = $Message
} else {
    # Get commits since last tag
    $lastTag = git describe --tags --abbrev=0 2>$null
    if ($lastTag) {
        $commits = git log "$lastTag..HEAD" --pretty=format:"- %s" --no-merges
        if ($commits) {
            $releaseNotes = "## Changes`n`n$commits"
        }
    }

    if (-not $releaseNotes) {
        $releaseNotes = "## AutoClaude v$newVersion`n`nNew release with bug fixes and improvements."
    }
}

Write-Host ""
Write-Host "Release Notes:" -ForegroundColor Cyan
Write-Host $releaseNotes -ForegroundColor Gray
Write-Host ""

# Commit version bump
git add $VersionFile $IssFile
git commit -m "Bump version to $newVersion"
Write-Host "[OK] Committed version bump" -ForegroundColor Green

# Create and push tag
$tagName = "v$newVersion"
git tag -a $tagName -m "Release $newVersion"
Write-Host "[OK] Created tag: $tagName" -ForegroundColor Green

git push origin main
git push origin $tagName
Write-Host "[OK] Pushed to GitHub" -ForegroundColor Green

# Create GitHub release
Write-Host ""
Write-Host "Creating GitHub release..." -ForegroundColor Cyan

$releaseNotesFile = Join-Path $env:TEMP "release_notes_$newVersion.md"
Set-Content $releaseNotesFile -Value $releaseNotes -Encoding UTF8

& $gh release create $tagName $installerPath.FullName --title "AutoClaude $newVersion" --notes-file $releaseNotesFile

if ($LASTEXITCODE -eq 0) {
    Remove-Item $releaseNotesFile -Force -ErrorAction SilentlyContinue

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Release Successful!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Version: $newVersion" -ForegroundColor Cyan
    Write-Host "Tag: $tagName" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "View release at:" -ForegroundColor Cyan
    Write-Host "https://github.com/AcePeak/AutoClaude/releases/tag/$tagName" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "[ERROR] Failed to create GitHub release" -ForegroundColor Red
    exit 1
}
