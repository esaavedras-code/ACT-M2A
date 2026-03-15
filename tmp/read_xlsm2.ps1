Add-Type -AssemblyName 'System.IO.Compression.FileSystem'
$path = 'C:\Users\Enrique Saavedra\Documents\Programa ACT\Documentos\Formulario Force Account_V2.3.xlsm'
$zip = [System.IO.Compression.ZipFile]::OpenRead($path)

# Get shared strings
$ssEntry = $zip.Entries | Where-Object { $_.FullName -eq 'xl/sharedStrings.xml' }
$ssStream = $ssEntry.Open()
$ssReader = New-Object System.IO.StreamReader($ssStream)
$ssXml = $ssReader.ReadToEnd()
$ssReader.Close()

$stringsRx = [regex]'<t[^>]*>([^<]+)</t>'
$stringMatches = $stringsRx.Matches($ssXml)
$strings = @()
foreach ($m in $stringMatches) { $strings += $m.Groups[1].Value }

Write-Output "=== SHARED STRINGS (primeros 80) ==="
for ($i = 0; $i -lt [Math]::Min(80, $strings.Count); $i++) {
    Write-Output "$i : $($strings[$i])"
}

$zip.Dispose()
