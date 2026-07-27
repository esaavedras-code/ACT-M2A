import os

def generate_individual_flowcharts():
    output_dir = r"C:\Users\Enrique Saavedra\Documents\PROGRAMAS AI\Programa ACT\Documentos\Flowcharts"
    os.makedirs(output_dir, exist_ok=True)

    diagrams = [
        ("01_RESUMEN.html", "1. RESUMEN (DASHBOARD & CONSOLIDACIÓN EJECUTIVA)", """
        graph TD
            A[Inicio: Carga de Datos del Proyecto] --> B[Lectura de Contrato Original & CHOs Aprobadas]
            B --> C[Consolidación de Registros Acumulados]
            C --> D1[Progreso Físico en Campo - ACT-45]
            C --> D2[Histórico de Certificaciones - ACT-117C]
            C --> D3[Balance de Retenciones & MOS - ACT-117B]
            D1 --> E[Cálculo de Indicadores KPIs en Tiempo Real]
            D2 --> E
            D3 --> E
            E --> F[Generación de Tableros Visuales & Dashboard]
            F --> G[Exportación de Reporte Ejecutivo Maestro ACT-32]
            G --> H[Fin: Monitoreo & Auditoría Continua]
            
            style A fill:#1F4E78,stroke:#38BDF8,color:#fff
            style E fill:#065F46,stroke:#10B981,color:#fff
            style G fill:#1E3A8A,stroke:#60A5FA,color:#fff
        """),

        ("02_ENTRADA_DE_DATOS.html", "2. ENTRADA DE DATOS (INFORMES DIARIOS ACT-45 E INSPECCIÓN ACT-96)", """
        graph TD
            A[Inicio Jornada de Inspección] --> B[Crear Nuevo Informe Diario ACT-45]
            B --> C[Registrar Datos Ambientales, Mano de Obra & Equipos]
            C --> D[Seleccionar Partidas Contractuales Activas]
            D --> E[Ingresar Cantidades Físicas Instaladas en el Día]
            E --> F{¿Ocurrió Incidencia / Inspección Específica?}
            F -- Sí --> G[Abrir & Llenar Formulario ACT-96]
            G --> H[Vincular Hallazgo u Orden de Corrección]
            F -- No --> I[Adjuntar Evidencia Fotográfica Anclada]
            H --> I
            I --> J[Firma Digital del Inspector de Campo]
            J --> K[Actualización Automática del Progreso en Campo en PACT]
            K --> L[Fin: Registro Validado en BD]

            style A fill:#1F4E78,stroke:#38BDF8,color:#fff
            style F fill:#D97706,stroke:#FBBF24,color:#fff
            style K fill:#065F46,stroke:#10B981,color:#fff
        """),

        ("03_CUMPLIMIENTO_LABORAL.html", "3. CUMPLIMIENTO LABORAL (CERTIFIED PAYROLL & DAVIS-BACON)", """
        graph TD
            A[Recepción de Nómina Semanal Contratista] --> B[Carga de Certificación de Nómina en PACT]
            B --> C[Auditoría de Clasificaciones de Puestos de Trabajo]
            C --> D[Verificación de Tarifa Horaria vs. Scale de Salarios Mínimos]
            D --> E{¿Cumple con la Tarifa Salarial Obligatoria?}
            E -- No --> F[Generar Alerta de Incumplimiento & Requerimiento de Restitución]
            F --> G[Bloquear Aprobación de Cumplimiento Laboral]
            E -- Sí --> H[Auditar Horas Regulares & Horas Extra Overtime]
            H --> I[Validar Declaración Jurada del Patrono]
            I --> J[Aprobar Certificación Laboral Semanal en PACT]
            J --> K[Fin: Habilitar Avance para Certificación de Pago]

            style A fill:#1F4E78,stroke:#38BDF8,color:#fff
            style E fill:#D97706,stroke:#FBBF24,color:#fff
            style F fill:#991B1B,stroke:#F87171,color:#fff
            style J fill:#065F46,stroke:#10B981,color:#fff
        """),

        ("04_CERTIFICADOS_DE_MANUFACTURA.html", "4. CERTIFICADOS DE MANUFACTURA (CM & CUMPLIMIENTO BABA)", """
        graph TD
            A[Carga de Certificado de Manufactura en PACT] --> B[Asociar Documento a Partidas Contractuales]
            B --> C{¿El Documento Ampara Múltiples Partidas?}
            C -- Sí --> D[Marcar Opción 'Múltiple' & Asignar Cantidad por Ítem]
            D --> E[Expansión Automática de Registros en Base de Datos]
            C -- No --> F[Registro Directo de Cantidad Respaldada por Ítem]
            E --> G[Verificación de Balance: CM Respaldado vs Cantidad a Pagar]
            F --> G
            G --> H{¿Cantidad CM >= Cantidad Acumulada a Pagar?}
            H -- No --> I[Mapear Alerta Roja: Cantidad de Manufactura Insuficiente]
            I --> J[Bloqueo / Advertencia en Formulario de Pago Mensual]
            H -- Sí --> K[Validar Respaldos Documentales en Verde]
            K --> L[Fin: Partida Habilitada para Cobro 100% Auditado]

            style A fill:#1F4E78,stroke:#38BDF8,color:#fff
            style C fill:#D97706,stroke:#FBBF24,color:#fff
            style I fill:#991B1B,stroke:#F87171,color:#fff
            style K fill:#065F46,stroke:#10B981,color:#fff
        """),

        ("05_MONTHLY_PAYMENT.html", "5. MONTHLY PAYMENT (CERTIFICACIÓN DE PAGO MENSUAL ACT-117C)", """
        graph TD
            A[Inicio de Periodo de Certificación Mensual] --> B[Conciliar Cantidades Instaladas con Informes ACT-45]
            B --> C[Verificar Validación en Verde de Certificados de Manufactura]
            C --> D[Incorporar Balance de Material On Site ACT-117B]
            D --> E[Ingresar Cantidades a Certificar en el Periodo]
            E --> F[Cálculo Automático del Monto Bruto Acumulado]
            F --> G[Aplicación Automática de Retención Contractual Retainage 5%/10%]
            G --> H[Descuento de Pagos Anteriores & Cálculo de Neto a Pagar]
            H --> I[Revisiones & Firmas: Inspector, Residente & Asesor Legal]
            I --> J[Exportación Oficial de Formulario ACT-117C Excel/PDF]
            J --> K[Fin: Certificación Procesada para Desembolso]

            style A fill:#1F4E78,stroke:#38BDF8,color:#fff
            style F fill:#1E3A8A,stroke:#60A5FA,color:#fff
            style J fill:#065F46,stroke:#10B981,color:#fff
        """),

        ("06_CHANGE_ORDER.html", "6. CHANGE ORDER (ÓRDENES DE CAMBIO CHO / ACT-122 / ACT-123)", """
        graph TD
            A[Identificación de Necesidad de Cambio en Obra] --> B[Crear Borrador de Orden de Cambio CHO / ACT-122]
            B --> C[Definir Tipo: Ajuste Cantidad / Extra Work / Extensión Tiempo]
            C --> D[Desglosar Costos de Mano de Obra, Equipos & Materiales ACT-123]
            D --> E[Comprobación de Asignación de Fondos Presupuestarios en PACT]
            E --> F{¿El Monto Excede el Techo de Asignación?}
            F -- Sí --> G[Emitir Bloqueo Presupuestario & Requerir Re-asignación]
            F -- No --> H[Completar Check List de Orden de Cambio ACT-124]
            H --> I[Ruta de Firmas Autorizadas: Residente, Director & Agencia]
            I --> J[Aprobación Formal de CHO en PACT]
            J --> K[Inyección Automática de Nuevas Partidas & Ajuste de Calendario]
            K --> L[Fin: Contrato Vigente Actualizado]

            style A fill:#1F4E78,stroke:#38BDF8,color:#fff
            style F fill:#D97706,stroke:#FBBF24,color:#fff
            style G fill:#991B1B,stroke:#F87171,color:#fff
            style K fill:#065F46,stroke:#10B981,color:#fff
        """)
    ]

    for fname, title, mcode in diagrams:
        html = f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>{title} - Sistema PACT</title>
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
    <style>
        body {{
            font-family: Arial, sans-serif;
            background-color: #0F172A;
            color: #F8FAFC;
            padding: 30px;
            margin: 0;
        }}
        .card {{
            background: #1E293B;
            border-radius: 12px;
            padding: 25px;
            border: 1px solid #334155;
            max-width: 1000px;
            margin: 0 auto;
        }}
        h2 {{
            color: #38BDF8;
            border-bottom: 2px solid #334155;
            padding-bottom: 10px;
            margin-top: 0;
        }}
        .author {{
            color: #93C5FD;
            font-size: 0.9rem;
            margin-bottom: 20px;
            font-weight: bold;
        }}
        .mermaid {{
            background: #0B0F19;
            padding: 20px;
            border-radius: 8px;
        }}
    </style>
</head>
<body>
    <div class="card">
        <h2>{title}</h2>
        <div class="author">Diseño de Proceso PACT: Ing. Enrique Saavedra Sada, PE</div>
        <div class="mermaid">
        {mcode}
        </div>
    </div>
    <script>
        mermaid.initialize({{ startOnLoad: true, theme: 'dark' }});
    </script>
</body>
</html>"""
        path = os.path.join(output_dir, fname)
        with open(path, "w", encoding="utf-8") as f:
            f.write(html)
        print(f"Diagrama individual creado: {path}")

if __name__ == "__main__":
    generate_individual_flowcharts()
