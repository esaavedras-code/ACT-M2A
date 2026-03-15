Add-Type -AssemblyName System.Runtime.WindowsRuntime
# Load required types
[Windows.Media.Ocr.OcrEngine, Windows.Foundation.UniversalApiContract, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.StorageFile, Windows.Foundation.UniversalApiContract, ContentType = WindowsRuntime] | Out-Null
[Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation.UniversalApiContract, ContentType = WindowsRuntime] | Out-Null
[Windows.Globalization.Language, Windows.Foundation.UniversalApiContract, ContentType = WindowsRuntime] | Out-Null

$imagePath = 'c:\Users\Enrique Saavedra\Documents\Programa ACT\tmp\page1.png'
if (-not (Test-Path $imagePath)) {
    Write-Output "Image not found at $imagePath"
    exit
}
try {
    $fileTask = [Windows.Storage.StorageFile]::GetFileFromPathAsync($imagePath)
    $fileTask.AsTask().Wait()
    $file = $fileTask.GetResults()

    $streamTask = $file.OpenAsync([Windows.Storage.FileAccessMode]::Read)
    $streamTask.AsTask().Wait()
    $stream = $streamTask.GetResults()

    $decoderTask = [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)
    $decoderTask.AsTask().Wait()
    $decoder = $decoderTask.GetResults()

    $bitmapTask = $decoder.GetSoftwareBitmapAsync()
    $bitmapTask.AsTask().Wait()
    $softwareBitmap = $bitmapTask.GetResults()

    $lang = [Windows.Globalization.Language]::new("en-US")
    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)
    
    $ocrTask = $engine.RecognizeAsync($softwareBitmap)
    $ocrTask.AsTask().Wait()
    $ocrResult = $ocrTask.GetResults()

    foreach ($line in $ocrResult.Lines) {
        Write-Output $line.Text
    }
} catch {
    Write-Output "Error: $_"
}
