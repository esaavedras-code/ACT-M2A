import sys

file_path = r'c:\Users\Enrique Saavedra\Documents\PROGRAMAS AI\Programa ACT\src\components\ForceAccount2Form.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_body = [
    '                              <tbody>\n',
    '                                 {ac50DailyDetail.length === 0 ? (\n',
    '                                    <tr>\n',
    '                                       <td colSpan={34} className="border border-slate-900 p-10 text-center text-slate-300 font-bold uppercase italic bg-slate-50/20">\n',
    '                                          No se ha registrado uso de equipo en los reportes diarios de este mes.\n',
    '                                       </td>\n',
    '                                    </tr>\n',
    '                                 ) : ac50DailyDetail.map((row, idx) => {\n',
    '                                   let totalAct = row.days.slice(1).reduce((a:number, b:number) => a+b, 0);\n',
    '                                   return (\n',
    '                                     <tr key={idx} className="hover:bg-blue-50/40 transition-all group">\n',
    '                                        <td className="border border-slate-900 p-1 text-center font-black bg-slate-100 group-hover:bg-blue-100/50 text-[8px]">{idx + 1}</td>\n',
    '                                        <td className="border border-slate-900 p-1.5 uppercase font-black text-[8px] leading-tight text-left">\n',
    '                                           <div className="flex flex-col">\n',
    '                                              <span className="text-slate-900">{row.equipment.description}</span>\n',
    '                                              <span className="text-blue-600 text-[6px] font-bold mt-0.5 opacity-80">{row.equipment.model}</span>\n',
    '                                           </div>\n',
    '                                        </td>\n',
    '                                        {Array.from({length: 31}, (_, i) => {\n',
    '                                          const hasHours = row.days[i+1] > 0;\n',
    '                                          return (\n',
    '                                            <td key={i} className={`border border-slate-900 p-1 text-center font-black transition-all ${hasHours ? \'text-blue-700 bg-blue-100/60\' : \'text-slate-300\'}`}>\n',
    '                                              {row.days[i+1] || ""}\n',
    '                                            </td>\n',
    '                                          );\n',
    '                                        })}\n',
    '                                        <td className="border border-slate-900 p-1 text-center font-black bg-blue-50 text-blue-700 group-hover:bg-blue-100 shadow-inner">{totalAct}</td>\n',
    '                                     </tr>\n',
    '                                   );\n',
    '                                 })}\n',
    '                              </tbody>\n'
]

# Find the specific tbody for Parte A
# It comes after the "Día de la semana" header which we just updated.
start_b = -1
end_b = -1
for i, line in enumerate(lines):
    if 'Día de la semana' in line and i > 1200:
        # Search for first <tbody> after this
        for j in range(i, len(lines)):
            if '<tbody>' in lines[j]:
                start_b = j
                break
        if start_b != -1:
            for j in range(start_b, len(lines)):
                if '</tbody>' in lines[j]:
                    end_b = j
                    break
        break

if start_b != -1 and end_b != -1:
    lines[start_b:end_b+1] = new_body
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print("Cuerpo de tabla AC-50 actualizado.")
else:
    print(f"Error: No se encontró el rango del tbody (start:{start_b}, end:{end_b})")
