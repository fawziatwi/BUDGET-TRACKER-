Add-Type -AssemblyName System.Drawing

function New-AppIcon {
    param(
        [int]$Size,
        [string]$OutPath
    )

    $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias

    $rect = New-Object System.Drawing.Rectangle(0, 0, $Size, $Size)
    $c1 = [System.Drawing.Color]::FromArgb(255, 10, 132, 255)
    $c2 = [System.Drawing.Color]::FromArgb(255, 88, 86, 214)
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $c1, $c2, 45)
    $g.FillRectangle($brush, $rect)

    # Rounded rect mask (iOS will mask anyway, but keep the raw asset clean-square).
    $ringMargin = [int]($Size * 0.16)
    $ringSize = $Size - ($ringMargin * 2)
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(230, 255, 255, 255), [Math]::Max(2, $Size * 0.045))
    $g.DrawEllipse($pen, $ringMargin, $ringMargin, $ringSize, $ringSize)

    $fontSize = [int]($Size * 0.42)
    $font = New-Object System.Drawing.Font('Arial', $fontSize, [System.Drawing.FontStyle]::Bold)
    $whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $text = [char]0x0024  # "$"
    $strFormat = New-Object System.Drawing.StringFormat
    $strFormat.Alignment = [System.Drawing.StringAlignment]::Center
    $strFormat.LineAlignment = [System.Drawing.StringAlignment]::Center
    $textRect = New-Object System.Drawing.RectangleF(0, ($Size * -0.02), $Size, $Size)
    $g.DrawString($text, $font, $whiteBrush, $textRect, $strFormat)

    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
}

$iconsDir = Join-Path $PSScriptRoot 'icons'
New-Item -ItemType Directory -Force -Path $iconsDir | Out-Null

New-AppIcon -Size 180 -OutPath (Join-Path $iconsDir 'icon-180.png')
New-AppIcon -Size 192 -OutPath (Join-Path $iconsDir 'icon-192.png')
New-AppIcon -Size 512 -OutPath (Join-Path $iconsDir 'icon-512.png')
New-AppIcon -Size 32  -OutPath (Join-Path $iconsDir 'favicon-32.png')

Write-Output "Icons generated in $iconsDir"
