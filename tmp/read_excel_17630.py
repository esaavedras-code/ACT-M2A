
import pandas as pd
import json

file_path = r'C:\Users\Enrique Saavedra\Documents\PROGRAMAS AI\Programa ACT Administrador - Copy\Documentos\Notas_con_titulos_AC017630.xlsx'
try:
    xl = pd.ExcelFile(file_path)
    print(f"Sheets: {xl.sheet_names}")
    for sheet in xl.sheet_names:
        df = xl.parse(sheet)
        print(f"\n--- Sheet: {sheet} ---")
        print(df.head(20).to_string())
except Exception as e:
    print(f"Error: {e}")
