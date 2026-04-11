Add-Type -AssemblyName 'System.IO.Compression.FileSystem'
$path = 'C:\Users\Enrique Saavedra\Documents\PROGRAMAS AI\Programa ACT Administrador\Documentos\AC200024 Presentacion 1-8-26.pptx'
$zip = [System.IO.Compression.ZipFile]::OpenRead($path)

$s1 = $zip.GetEntry('ppt/slides/slide1.xml')
if ($s1) {
    $stream = $s1.Open()
    $reader = New-Object System.IO.StreamReader($stream)
    $content = $reader.ReadToEnd()
    $content | Out-File 'scratch/slide1_data.xml' -Encoding utf8
    $reader.Close()
}

$s2 = $zip.GetEntry('ppt/slides/slide2.xml')
if ($s2) {
    $stream = $s2.Open()
    $reader = New-Object System.IO.StreamReader($stream)
    $content = $reader.ReadToEnd()
    $content | Out-File 'scratch/slide2_data.xml' -Encoding utf8
    $reader.Close()
}

$zip.Dispose()
Write-Host "Done"
