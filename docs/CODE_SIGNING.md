# Code Signing with SignPath

This document explains how to sign AutoClaude installers using SignPath to eliminate Windows SmartScreen warnings.

## Why Code Signing?

Without code signing:
- Users see "Windows protected your PC" warning
- Users must click "More info" then "Run anyway"
- Can discourage users from installing

With code signing:
- No SmartScreen warning (after building reputation)
- Professional appearance
- Users trust the software

## SignPath Overview

SignPath is a code signing service that:
- Keeps your private key secure on HSM (Hardware Security Module)
- Signs artifacts remotely
- Provides audit trail for all signing operations
- Free tier available for open source projects

## Setup (One-time)

### 1. Create SignPath Account

1. Go to https://app.signpath.io
2. Sign up for an account
3. Create an organization

### 2. Create Project and Certificate

1. Create a new project (e.g., "AutoClaude")
2. Go to **Certificates** and create a new certificate
3. Choose certificate type (Test or Release)
4. SignPath will generate a certificate with the private key stored securely

### 3. Configure Signing Policy

1. Go to your project settings
2. Create a signing policy (e.g., "release-signing")
3. Configure which users can submit signing requests

### 4. Get API Token (Optional, for automation)

1. Go to **User Profile** > **API Tokens**
2. Create a new token
3. Save it securely (you won't see it again)

## Signing Methods

### Method 1: Manual (Web Interface)

Best for occasional releases:

1. Build the unsigned installer:
   ```powershell
   npm run build:win
   ```

2. Go to https://app.signpath.io

3. Navigate to your project > Submit Signing Request

4. Upload the installer from `dist-electron/AutoClaude Setup x.x.x.exe`

5. Select your signing policy

6. Submit and wait for signing to complete

7. Download the signed artifact

### Method 2: PowerShell Script

For command-line workflow:

```powershell
# First, build the unsigned installer
npm run build:win

# Then sign with SignPath
.\scripts\sign-with-signpath.ps1 `
    -ApiToken "your-api-token" `
    -OrganizationId "your-org-id" `
    -ProjectSlug "autoclaude" `
    -SigningPolicySlug "release-signing"
```

The signed installer will be saved as `AutoClaude Setup x.x.x-signed.exe`.

### Method 3: GitHub Actions (CI/CD)

For automated releases, add to `.github/workflows/release.yml`:

```yaml
- name: Sign with SignPath
  uses: signpath/github-action-submit-signing-request@v0.3
  with:
    api-token: ${{ secrets.SIGNPATH_API_TOKEN }}
    organization-id: ${{ secrets.SIGNPATH_ORGANIZATION_ID }}
    project-slug: autoclaude
    signing-policy-slug: release-signing
    artifact-configuration-slug: default
    input-artifact-path: dist-electron/AutoClaude Setup*.exe
    output-artifact-path: dist-electron/AutoClaude-signed.exe
    wait-for-completion: true
```

## Certificate Types

| Type | SmartScreen | Use Case |
|------|-------------|----------|
| Test | Still shows warning | Development/testing |
| Release (OV) | Warning reduced over time | Production releases |
| Release (EV) | No warning immediately | High-trust releases |

### About SmartScreen Reputation

- **Test certificates**: Always show SmartScreen warning
- **OV (Organization Validation)**: Warning disappears after building reputation (many downloads)
- **EV (Extended Validation)**: No warning from first release (but more expensive)

For open source projects, OV certificates with reputation building is the typical path.

## Troubleshooting

### "SmartScreen still showing warning after signing"

- Test certificates always show warnings
- OV certificates need reputation (thousands of downloads)
- Verify the file is actually signed: `signtool verify /pa /v <file.exe>`

### "API token invalid"

- Tokens expire or can be revoked
- Generate a new token from User Profile

### "Signing request denied"

- Check your signing policy permissions
- Some policies require approval from another team member

## Verifying Signature

After signing, verify the signature:

```powershell
# Using Windows built-in tool
signtool verify /pa /v "dist-electron\AutoClaude Setup 2.2.0-signed.exe"

# Or check in Explorer
# Right-click the exe > Properties > Digital Signatures tab
```

## File Locations

- `installer/AutoClaude.cer` - Public certificate (for verification)
- `installer/AutoClaude.pem` - Public certificate in PEM format
- Private key is stored securely on SignPath's HSM

## Resources

- SignPath Documentation: https://about.signpath.io/documentation
- SignPath GitHub Action: https://github.com/SignPath/github-action-submit-signing-request
- Windows SmartScreen FAQ: https://support.microsoft.com/en-us/windows/microsoft-defender-smartscreen
