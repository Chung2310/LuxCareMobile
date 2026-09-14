Add-Type -AssemblyName System.Drawing

function Generate-IconFile {
    param(
        [string]$sourcePath,
        [string]$targetPath,
        [int]$targetWidth,
        [int]$targetHeight,
        [double]$scaleFactor,
        [System.Drawing.Color]$bgColor,
        [bool]$isMonochrome = $false
    )

    $fullSource = [System.IO.Path]::GetFullPath($sourcePath)
    $fullTarget = [System.IO.Path]::GetFullPath($targetPath)

    $src = [System.Drawing.Image]::FromFile($fullSource)
    $bmp = New-Object System.Drawing.Bitmap $targetWidth, $targetHeight, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)

    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    if ($bgColor -ne [System.Drawing.Color]::Transparent) {
        $brush = New-Object System.Drawing.SolidBrush $bgColor
        $g.FillRectangle($brush, 0, 0, $targetWidth, $targetHeight)
        $brush.Dispose()
    } else {
        $g.Clear([System.Drawing.Color]::Transparent)
    }

    $maxW = $targetWidth * $scaleFactor
    $maxH = $targetHeight * $scaleFactor
    $ratio = [Math]::Min($maxW / $src.Width, $maxH / $src.Height)
    $destW = [int]($src.Width * $ratio)
    $destH = [int]($src.Height * $ratio)
    $destX = [int](($targetWidth - $destW) / 2)
    $destY = [int](($targetHeight - $destH) / 2)

    $g.DrawImage($src, $destX, $destY, $destW, $destH)

    $src.Dispose()
    $g.Dispose()

    if ($isMonochrome) {
        for ($x = 0; $x -lt $targetWidth; $x++) {
            for ($y = 0; $y -lt $targetHeight; $y++) {
                $p = $bmp.GetPixel($x, $y)
                if ($p.A -gt 0) {
                    # Convert to flat monochrome gray (RGB 120, 120, 120) preserving alpha
                    $bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($p.A, 120, 120, 120))
                }
            }
        }
    }

    # Save to memory stream first to avoid file lock
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    [System.IO.File]::WriteAllBytes($fullTarget, $ms.ToArray())
    $ms.Dispose()

    Write-Host "Generated: $targetPath ($($targetWidth)x$($targetHeight))"
}

$brandIcon = "mobile/public/brand-icon.png"

# 1. Main App Icon (1024x1024) - Clean white background with LuxCare brand icon
Generate-IconFile -sourcePath $brandIcon -targetPath "mobile/assets/icon.png" -targetWidth 1024 -targetHeight 1024 -scaleFactor 0.76 -bgColor ([System.Drawing.Color]::White)

# 2. Android Adaptive Icon Foreground (512x512) - Transparent with brand icon inside safe zone (~65%)
Generate-IconFile -sourcePath $brandIcon -targetPath "mobile/assets/android-icon-foreground.png" -targetWidth 512 -targetHeight 512 -scaleFactor 0.65 -bgColor ([System.Drawing.Color]::Transparent)

# 3. Android Adaptive Icon Monochrome (512x512) - Flat monochrome mask
Generate-IconFile -sourcePath $brandIcon -targetPath "mobile/assets/android-icon-monochrome.png" -targetWidth 512 -targetHeight 512 -scaleFactor 0.65 -bgColor ([System.Drawing.Color]::Transparent) -isMonochrome $true

# 4. Android Adaptive Icon Background (512x512) - Clean white
Generate-IconFile -sourcePath $brandIcon -targetPath "mobile/assets/android-icon-background.png" -targetWidth 512 -targetHeight 512 -scaleFactor 0.0 -bgColor ([System.Drawing.Color]::White)

# 5. Splash Icon (1024x1024) - Transparent with brand icon
Generate-IconFile -sourcePath $brandIcon -targetPath "mobile/assets/splash-icon.png" -targetWidth 1024 -targetHeight 1024 -scaleFactor 0.50 -bgColor ([System.Drawing.Color]::Transparent)

# 6. Favicon (48x48) - Transparent with brand icon
Generate-IconFile -sourcePath $brandIcon -targetPath "mobile/assets/favicon.png" -targetWidth 48 -targetHeight 48 -scaleFactor 0.95 -bgColor ([System.Drawing.Color]::Transparent)

# 7. Copy brand-icon directly into mobile/assets/brand-icon.png
Copy-Item -Path (Resolve-Path $brandIcon) -Destination "mobile/assets/brand-icon.png" -Force
Write-Host "Copied: mobile/assets/brand-icon.png"
