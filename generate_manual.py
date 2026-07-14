import os
from docx import Document
from docx.shared import Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH

def main():
    doc = Document()

    # Title
    title = doc.add_heading('Manual de Usuario - Sección Change Orders / Enmiendas', 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER

    # About
    about = doc.add_paragraph()
    about.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = about.add_run('About\nDiseñador: Ing. Enrique Saavedra Sada, PE.')
    run.bold = True
    run.italic = True

    doc.add_heading('1. Introducción', level=1)
    doc.add_paragraph('La sección de "Change Orders / Enmiendas" permite gestionar las órdenes de cambio del contrato, incluyendo modificaciones en partidas existentes, trabajos extra, extensiones de tiempo o enmiendas administrativas.')

    doc.add_heading('2. Panel de Resumen (Dashboard)', level=1)
    p = doc.add_paragraph()
    p.add_run('• Total Aprobado ($): ').bold = True
    p.add_run('Muestra el monto total acumulado de las órdenes de cambio que ya han sido aprobadas.\n')
    p.add_run('• Total en Trámite ($): ').bold = True
    p.add_run('Refleja el monto económico de las órdenes de cambio que se encuentran actualmente en proceso o revisión.\n')
    p.add_run('• Impacto Económico: ').bold = True
    p.add_run('Muestra el impacto financiero total en el proyecto.\n')
    p.add_run('• Días de Extensión: ').bold = True
    p.add_run('Indica la cantidad total de días adicionales otorgados al contrato.')

    doc.add_heading('3. Encabezado de la Enmienda', level=1)
    p2 = doc.add_paragraph()
    p2.add_run('• CHO / Enmienda: ').bold = True
    p2.add_run('Número consecutivo que identifica a la orden de cambio (ej. #15).\n')
    p2.add_run('• Fecha: ').bold = True
    p2.add_run('Permite seleccionar o ingresar la fecha de la orden de cambio.\n')
    p2.add_run('• Ext. Días: ').bold = True
    p2.add_run('Campo para ingresar los días de extensión de tiempo asociados a esta enmienda específica.\n')
    p2.add_run('• Estatus Doc.: ').bold = True
    p2.add_run('Lista desplegable para seleccionar el estado actual del documento (ej. En trámite, Aprobado, etc.).\n')
    p2.add_run('• Importe Total: ').bold = True
    p2.add_run('Resumen del costo de la enmienda, desglosado por fuente de fondos (ej. ACT, FHWA).\n')
    p2.add_run('• Tipos de Enmienda: ').bold = True
    p2.add_run('Casillas de verificación para clasificar el cambio:\n')
    p2.add_run('\t- Change of Contract Items (Cambio en Partidas del Contrato)\n')
    p2.add_run('\t- New Items (Extra Work) (Partidas Nuevas / Trabajo Extra)\n')
    p2.add_run('\t- Time Extension (Extensión de Tiempo)\n')
    p2.add_run('\t- Enmienda Administrativa')

    doc.add_heading('4. Detalle de Partidas (Añadir/Modificar)', level=1)
    p3 = doc.add_paragraph()
    p3.add_run('Al hacer clic en el botón ')
    p3.add_run('"+ Añadir item"').bold = True
    p3.add_run(', se permite agregar una nueva partida a la orden de cambio. Las columnas incluyen:\n')
    p3.add_run('• Nuevo: ').bold = True
    p3.add_run('Casilla para marcar si es un ítem completamente nuevo.\n')
    p3.add_run('• # Item: ').bold = True
    p3.add_run('Número identificador de la partida.\n')
    p3.add_run('• Espec.: ').bold = True
    p3.add_run('Especificación correspondiente al ítem.\n')
    p3.add_run('• Descripción: ').bold = True
    p3.add_run('Nombre de la partida y un campo para "Descripción Adicional".\n')
    p3.add_run('• Unit: ').bold = True
    p3.add_run('Unidad de medida (ej. LS, Ea, CuM).\n')
    p3.add_run('• Qty: ').bold = True
    p3.add_run('Cantidad a incrementar o reducir.\n')
    p3.add_run('• Unit Price: ').bold = True
    p3.add_run('Precio unitario de la partida.\n')
    p3.add_run('• Amount Fondos: ').bold = True
    p3.add_run('Monto total de la partida calculado.\n')
    p3.add_run('• Origen de Fondos: ').bold = True
    p3.add_run('Lista desplegable para asignar la fuente de financiamiento.\n')
    p3.add_run('• Botón de Borrar (Basurero): ').bold = True
    p3.add_run('Elimina la partida de la lista.')

    doc.add_heading('5. Justificación Técnica y Legal', level=1)
    doc.add_paragraph('Un cuadro de texto amplio donde se debe redactar el motivo técnico y/o legal que sustenta la creación de la orden de cambio. Por ejemplo: "Las actividades descritas en el presente documento corresponden al proceso de liquidación parcial de las partidas."')

    output_dir = r"C:\Users\Enrique Saavedra\Documents\PROGRAMAS AI\Programa ACT\Documentos\MANUAL PACT JULIO 2026"
    os.makedirs(output_dir, exist_ok=True)
    
    output_path = os.path.join(output_dir, "Manual_Change_Orders.docx")
    doc.save(output_path)
    print(f"Documento guardado en: {output_path}")

if __name__ == "__main__":
    main()
