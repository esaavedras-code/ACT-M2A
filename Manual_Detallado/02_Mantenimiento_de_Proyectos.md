# Sección 02: Mantenimiento de Proyectos
## Gestión de Datos Maestros
El módulo de **Mantenimiento de Proyectos** es donde se registran y actualizan centralizadamente los datos que luego se usarán en todos los reportes (ACT-122, ACT-117, etc.).

### Secciones de Datos Principales:

1.  **Datos Generales (Header):**
    *   **Project Name:** Nombre completo como aparece en el contrato.
    *   **Project IDs:** Project No., Oracle No., Federal No., OCPR.
    *   **Números de Cuenta (Account No.):** Vital para el FMIS y depósitos.

2.  **Fechas Críticas:**
    *   **Date Original Completion:** Fecha original pactada en el contrato.
    *   **Revised Completion Date:** Calculada automáticamente por el sistema sumando las extensiones de tiempo de todas las CHOs aprobadas.
    *   **Administrative Term Date (Contralor):** Nueva fecha límite de vigencia administrativa, extendida generalmente 2 años después de la fecha de terminación técnica.

3.  **Contratistas y Personal (Personnel):**
    *   **Contractor Name (Oficial):** El nombre legal que firmará los documentos.
    *   **Residente de Proyecto (Resident Engineer):** Responsable técnico del proyecto.
    *   **Director Ejecutivo y PM:** Personal de supervisión de la ACT.

---
### Gestión de la Lista de Partidas (Contract Items):

Desde esta sección se pueden agregar todas las **Partidas Originales** del Proyecto Agreement:
1.  Introduzca el **Item No.** oficial.
2.  El sistema autocompletará la descripción y unidad si el ítem ya existe en la base de datos histórica de la ACT (Historial de Precios).
3.  Defina la **Cantidad Original** y el **Precio Unitario**.
4.  Especifique el **Origen de Fondos (Federal % / State %)** para cada partida.

### Cómo Usarlo:
- Acceda desde el menú lateral (icono de engranaje o martillo).
- Seleccione un proyecto de la lista desplegable.
- Los campos resaltados en **verde** (#66FF99) son obligatorios. El sistema le avisará si falta alguno esencial para los cálculos financieros.

---
> [!IMPORTANT]
> Un cambio en esta sección afectará todos los reportes generados a partir de ese momento. Verifique que los nombres y números Oracle sean exactos.
