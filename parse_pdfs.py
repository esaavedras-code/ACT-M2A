import PyPDF2
import os

docs_dir = r"C:\Users\Enrique Saavedra\Documents\Programa ACT\Documentos"
files = [
  'ACT-45 Actividades.pdf',
  'ACT-45 Instrucciones.pdf',
  'ACT-96 Inspeccion.pdf',
  'ACT-96 Instrucciones.pdf'
]

for file in files:
    try:
        path = os.path.join(docs_dir, file)
        out_path = os.path.join(docs_dir, file.replace('.pdf', '.txt'))
        with open(path, 'rb') as f:
            reader = PyPDF2.PdfReader(f)
            text = ""
            for page in reader.pages:
                text += page.extract_text() + "\n"
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(text)
        print(f"Success {file}")
    except Exception as e:
        print(f"Error {file}: {e}")
