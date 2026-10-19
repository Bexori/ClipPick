Add-Type -AssemblyName System.Drawing
$src='D:\github\ClipPick\build\icon-source-1.10.6.png'
$dst='D:\github\ClipPick\build\icon-256.png'
$size=256
$radius=56
$inset=8
$width=$size-($inset*2)
$height=$size-($inset*2)

$img=[System.Drawing.Image]::FromFile($src)
$bmp=New-Object System.Drawing.Bitmap $size,$size
$g=[System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode='HighQuality'
$g.InterpolationMode='HighQualityBicubic'
$g.PixelOffsetMode='HighQuality'
$g.Clear([System.Drawing.Color]::Transparent)

$rect=New-Object System.Drawing.RectangleF([float]$inset,[float]$inset,[float]$width,[float]$height)
$path=New-Object System.Drawing.Drawing2D.GraphicsPath
$d=$radius*2
$path.AddArc($rect.X,$rect.Y,$d,$d,180,90)
$path.AddArc($rect.Right-$d,$rect.Y,$d,$d,270,90)
$path.AddArc($rect.Right-$d,$rect.Bottom-$d,$d,$d,0,90)
$path.AddArc($rect.X,$rect.Bottom-$d,$d,$d,90,90)
$path.CloseFigure()

$g.SetClip($path)
$g.DrawImage($img, 0, 0, $size, $size)
$g.ResetClip()

$borderColor=[System.Drawing.Color]::FromArgb(110,150,160,180)
$pen=New-Object System.Drawing.Pen($borderColor,2)
$g.DrawPath($pen,$path)

$bmp.Save($dst,[System.Drawing.Imaging.ImageFormat]::Png)
$pen.Dispose()
$path.Dispose()
$g.Dispose()
$bmp.Dispose()
$img.Dispose()
