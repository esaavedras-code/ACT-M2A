import sys

file_path = r'c:\Users\Enrique Saavedra\Documents\PROGRAMAS AI\Programa ACT\src\components\ForceAccount2Form.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_header = [
    '                                    <th className="border border-slate-900 p-1 w-8 font-black bg-slate-100 italic">A</th>\n',
    '                                    <th className="border border-slate-900 p-1 min-w-[200px] uppercase font-black text-center bg-slate-100">Día de la semana</th>\n',
    '                                    {Array.from({length: 31}, (_, i) => {\n',
    '                                      const [year, month] = ac51Month.split(\'-\').map(Number);\n',
    '                                      const d = new Date(year, month - 1, i + 1);\n',
    '                                      const weekDay = [\'DOM\', \'LUN\', \'MAR\', \'MIÉ\', \'JUE\', \'VIE\', \'SÁB\'][d.getDay()];\n',
    '                                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;\n',
    '                                      return (\n',
    '                                        <th key={i} className={`border border-slate-900 p-1 text-center font-black w-[26px] text-[7px] ${isWeekend ? \'bg-slate-200 text-slate-600\' : \'bg-white\'}`}>\n',
    '                                          {weekDay}\n',
    '                                        </th>\n',
    '                                      );\n',
    '                                    })}\n',
    '                                    <th rowSpan={2} className="border border-slate-900 p-1 text-center bg-blue-600 text-white font-black min-w-[40px]">Total</th>\n',
    '                                 </tr>\n',
    '                                 <tr className="bg-slate-50 text-[8px]">\n',
    '                                    <th className="border border-slate-900 p-1 font-black bg-slate-200 italic">#</th>\n',
    '                                    <th className="border border-slate-900 p-1 uppercase font-black text-center bg-slate-100">Día del mes</th>\n',
    '                                    {Array.from({length: 31}, (_, i) => (\n',
    '                                      <th key={i} className="border border-slate-900 p-1 text-center font-black w-[26px] bg-slate-50">\n',
    '                                        {i + 1}\n',
    '                                      </th>\n',
    '                                    ))}\n'
]

new_body = [
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
    '                                 })}\n'
]

# Replace header lines (current lines 1209-1218 offset)
# We need to find them exactly
start_h = -1
end_h = -1
for i, line in enumerate(lines):
    if '<th rowSpan={2} className="border border-slate-900 p-1 w-8">#</th>' in line and i > 1200:
        start_h = i
    if '{Array.from({length: 31}, (_, i) => (' in line and i > start_h and i < start_h + 10:
        # found the second row start
        pass
    if '))}' in line and i > start_h and i < start_h + 15:
        end_h = i
        break

if start_h != -1 and end_h != -1:
    lines[start_h:end_h+1] = new_header

# Find body lines
start_b = -1
end_b = -1
for i, line in enumerate(lines):
    if '{ac50DailyDetail.map((row, idx) => {' in line and i > 1200:
        start_b = i
    if '});' in line and i > start_b and i < start_b + 20 and start_b != -1:
        end_b = i
        break

if start_b != -1 and end_b != -1:
    lines[start_b:end_b+1] = new_body

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Actualización completada exitosamente.")
