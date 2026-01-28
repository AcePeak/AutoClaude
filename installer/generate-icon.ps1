Add-Type -AssemblyName System.Drawing

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AssetsDir = Join-Path $ScriptDir "assets"
$IconPath = Join-Path $AssetsDir "autoclaude.ico"
$PngPath = Join-Path $AssetsDir "autoclaude.png"

if (-not (Test-Path $AssetsDir)) {
    New-Item -ItemType Directory -Path $AssetsDir -Force | Out-Null
}

$size = 256
$bitmap = New-Object System.Drawing.Bitmap($size, $size)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias

$bgColor = [System.Drawing.Color]::FromArgb(255, 59, 130, 246)
$graphics.Clear($bgColor)

$padding = 10
$circleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 37, 99, 235))
$graphics.FillEllipse($circleBrush, $padding, $padding, $size - $padding * 2, $size - $padding * 2)

$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, 16)
$pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

$cx = $size / 2
$cy = $size / 2 - 15
$w = 50
$h = 35
$g = 15

$leftRect = New-Object System.Drawing.RectangleF(($cx - $w * 2 - $g), ($cy - $h), ($w * 2), ($h * 2))
$rightRect = New-Object System.Drawing.RectangleF(($cx + $g), ($cy - $h), ($w * 2), ($h * 2))

$graphics.DrawArc($pen, $leftRect, 45, 270)
$graphics.DrawArc($pen, $rightRect, 225, 270)

$font = New-Object System.Drawing.Font("Arial", 42, [System.Drawing.FontStyle]::Bold)
$textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(220, 255, 255, 255))
$text = "AC"
$textSize = $graphics.MeasureString($text, $font)
$textX = ($size - $textSize.Width) / 2
$textY = $cy + $h + 15
$graphics.DrawString($text, $font, $textBrush, $textX, $textY)

$graphics.Dispose()

$bitmap.Save($PngPath, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "PNG saved: $PngPath" -ForegroundColor Green

$ms = New-Object System.IO.MemoryStream
$bitmap.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
$pngData = $ms.ToArray()
$ms.Dispose()

$iconDir = [byte[]]@(0, 0, 1, 0, 1, 0)
$imgSize = $pngData.Length
$entry = [byte[]]@(0, 0, 0, 0)
$entry += [BitConverter]::GetBytes([int16]1)
$entry += [BitConverter]::GetBytes([int16]32)
$entry += [BitConverter]::GetBytes([int32]$imgSize)
$entry += [BitConverter]::GetBytes([int32]22)

$icoData = $iconDir + $entry + $pngData
[System.IO.File]::WriteAllBytes($IconPath, $icoData)
Write-Host "ICO saved: $IconPath" -ForegroundColor Green

$bitmap.Dispose()
$pen.Dispose()
$circleBrush.Dispose()
$textBrush.Dispose()
$font.Dispose()

Write-Host "Done!" -ForegroundColor Cyan
