Add-Type -AssemblyName 'System.IO.Compression.FileSystem'
$path = 'C:\Users\Enrique Saavedra\Documents\Programa ACT\Documentos\Formulario Force Account_V2.3.xlsm'
$zip = [System.IO.Compression.ZipFile]::OpenRead($path)
$entry = $zip.Entries | Where-Object { $_.FullName -eq 'xl/workbook.xml' }
$stream = $entry.Open()
$reader = New-Object System.IO.StreamReader($stream)
$xml = $reader.ReadToEnd()
$reader.Close()
$zip.Dispose()
$pattern = 'name="([^"]+)"'
$rx = [regex]$pattern
$ms = $rx.Matches($xml)
foreach ($m in $ms) { Write-Output $m.Groups[1].Value }
