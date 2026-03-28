import whisper
import sys
import os

def transcribe(audio_path):
    if not os.path.exists(audio_path):
        print(f"Error: El archivo {audio_path} no existe.")
        return

    print(f"Cargando el modelo Whisper (base)...")
    # Usamos el modelo 'base' que es ligero y bueno para la mayoría de los casos.
    model = whisper.load_model("base")

    print(f"Transcribiendo {audio_path}...")
    result = model.transcribe(audio_path, language="es")

    output_path = audio_path.rsplit(".", 1)[0] + ".txt"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(result["text"])

    print(f"Transcripción completada. Guardada en: {output_path}")
    print("--- TRANSCRIPTION START ---")
    print(result["text"])
    print("--- TRANSCRIPTION END ---")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python transcribe.py [ruta_archivo_audio]")
    else:
        transcribe(sys.argv[1])
