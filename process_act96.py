import re
import json
import os

def parse_act96(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    data = {
        "proyecto_num": "",
        "proyecto_nombre": "",
        "municipio": "",
        "contratista": "",
        "fecha": "",
        "clima": "",
        "actividades": [],
        "equipo": [],
        "personal": []
    }

    # Extract 1. Num Proyecto
    m = re.search(r'1\.\s+NÚM\.\s+DE\s+PROYECTO:\s*(.*)', content, re.IGNORECASE)
    if not m:
        m = re.search(r'AC-\d+', content)
    if m:
        data["proyecto_num"] = m.group(1).strip() if 'group' in dir(m) else m.group(0)
    
    # Extract Municipio
    m = re.search(r'3\.\s+MUNICIPIO:\s*(.*)', content, re.IGNORECASE)
    if m:
        data["municipio"] = m.group(1).strip()
    elif "San Juan" in content:
        data["municipio"] = "San Juan"

    # Extract Contratista
    m = re.search(r'Unique Builders', content, re.IGNORECASE)
    if m:
        data["contratista"] = "Unique Builders"

    # Extract Fecha
    m = re.search(r'5\.\s+FECHA:\s*(.*)', content, re.IGNORECASE)
    if m:
        data["fecha"] = m.group(1).strip()
    else:
        m_fecha = re.search(r'\d{1,2}-[a-zA-Z]{3}-\d{2}', content)
        if m_fecha:
            data["fecha"] = m_fecha.group(0)

    # Actividades
    # We look for lines containing "Fernández Juncos"
    actividades = re.findall(r'(Fernández Juncos con [^\n\(]+\([^\)]+\))', content, re.IGNORECASE)
    # also try another pattern if it's broken in lines
    lines = content.split('\n')
    for line in lines:
        if "Fernández Juncos con" in line and line not in actividades:
            actividades.append(line.strip())
            
    # deduplicate activities
    actividades = list(dict.fromkeys([a for a in actividades if "Fernández Juncos" in a]))
    data["actividades"] = [{"descripcion": a} for a in actividades]

    # Equipos
    equipo_idx = content.find("Equipo:")
    empleados_idx = content.find("Empleados:")
    
    if equipo_idx != -1:
        end_idx = empleados_idx if empleados_idx != -1 else len(content)
        equipo_text = content[equipo_idx:end_idx].replace("Equipo:", "").strip()
        for line in equipo_text.split('\n'):
            line = line.strip()
            if line and not "INFORME" in line and not "AC-" in line and not "Mejoras" in line:
                data["equipo"].append(line)

    if empleados_idx != -1:
        empleados_text = content[empleados_idx:].replace("Empleados:", "").strip()
        for line in empleados_text.split('\n'):
            line = line.strip()
            if line and "--" in line:
                data["personal"].append(line)

    return data

if __name__ == "__main__":
    docs_dir = r"C:\Users\Enrique Saavedra\Documents\Programa ACT\Documentos"
    input_file = os.path.join(docs_dir, "ACT-96 Inspeccion.txt")
    output_file = os.path.join(docs_dir, "ACT-96 Inspeccion_extraida.json")
    
    print(f"Parsing {input_file}...")
    result = parse_act96(input_file)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=4, ensure_ascii=False)
        
    print(f"Datos estructurados guardados en: {output_file}")
    print(json.dumps(result, indent=2, ensure_ascii=False))
