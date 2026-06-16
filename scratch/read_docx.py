import zipfile
import xml.etree.ElementTree as ET
import os

def get_docx_text(path):
    try:
        namespaces = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
        with zipfile.ZipFile(path) as docx:
            tree = ET.parse(docx.open('word/document.xml'))
            root = tree.getroot()
            paragraphs = []
            for paragraph in root.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p'):
                texts = [node.text for node in paragraph.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t') if node.text]
                if texts:
                    paragraphs.append("".join(texts))
            return "\n".join(paragraphs)
    except Exception as e:
        return f"Error reading {path}: {str(e)}"

if __name__ == "__main__":
    os.makedirs("scratch", exist_ok=True)
    
    text1 = get_docx_text("corrige en el reporte de.docx")
    with open("scratch/corrige_reporte.txt", "w", encoding="utf-8") as f:
        f.write(text1)
        
    text2 = get_docx_text("desglose detallado por secciones.docx")
    with open("scratch/desglose_secciones.txt", "w", encoding="utf-8") as f:
        f.write(text2)
        
    print("Files written successfully!")
