import os
import sys
from openai import OpenAI
from dotenv import load_dotenv

# Cargar variables (.env.local es el que usa este proyecto)
load_dotenv(".env.local")

def transcribe_with_groq(audio_path):
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        print("Error: No se encontró GROQ_API_KEY en .env.local")
        return

    client = OpenAI(
        base_url="https://api.groq.com/openai/v1",
        api_key=api_key
    )

    if not os.path.exists(audio_path):
        print(f"Error: El archivo {audio_path} no existe.")
        return

    print(f"Subiendo y transcribiendo {audio_path} a Groq...")
    
    with open(audio_path, "rb") as file:
        transcription = client.audio.transcriptions.create(
            file=(os.path.basename(audio_path), file.read()),
            model="whisper-large-v3",
            response_format="verbose_json",
        )

    output_path = audio_path.rsplit(".", 1)[0] + ".txt"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(transcription.text)

    print(f"Transcripción completada con éxito!")
    print(f"Guardada en: {output_path}")
    print("\n--- TRANSCRIPTION START ---\n")
    print(transcription.text)
    print("\n--- TRANSCRIPTION END ---")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python scripts/transcribe_groq.py [ruta_archivo_audio]")
    else:
        transcribe_with_groq(sys.argv[1])
