
import os

filePath = r'c:\Users\Enrique Saavedra\Documents\Programa ACT\src\lib\reportLogic.ts'
with open(filePath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
skip = False
for i, line in enumerate(lines):
    if 'personnel?.forEach(p => {' in line and 'reportData.push([p.role, p.name' in lines[i+1]:
        # Start of replacement
        indent = line[:line.find('personnel')]
        new_lines.append(line)
        new_lines.append(f"{indent}    const role = (p.role || '').toLowerCase();\n")
        new_lines.append(f"{indent}    const isAuth = role.includes('supervisor') || role.includes('director regional') || role.includes('administrador del proyecto') || role.includes('resident engineer') || role.includes('project administrator');\n")
        new_lines.append(f"{indent}    if (isAuth) {{\n")
        new_lines.append(f"{indent}        reportData.push([p.role, p.name || 'N/A', p.phone_office || '', p.phone_mobile || '', p.email || '']);\n")
        new_lines.append(f"{indent}    }} else {{\n")
        new_lines.append(f"{indent}        reportData.push([p.role, p.name || 'N/A', '', '', '']);\n")
        new_lines.append(f"{indent}    }}\n")
        skip = True
    elif skip and '});' in line:
        new_lines.append(line)
        skip = False
    elif not skip:
        new_lines.append(line)
    elif skip and 'reportData.push' in line:
        continue # skip the original line

with open(filePath, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
print("Done")
