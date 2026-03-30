# Sección 03: Órdenes de Cambio (CHO)
## Ciclo de Vida del Reporte Oficial ACT-122/123/124
El módulo de **Change Orders (CHO)** es el corazón financiero de las modificaciones al contrato original del proyecto. El sistema PACT automatiza el cálculo de balances y la generación de formularios oficiales de la ACT (RevisionDic 2024).

### Partes de una Orden de Cambio:

1.  **Encabezado de la CHO:**
    *   **CHO Number:** Número secuencial (1, 2, 3...) de la modificación.
    *   **Amendment Letter:** Letra de la enmienda asociada (0, A, B...).
    *   **CHO Date:** Fecha de emisión oficial de la orden.
    *   **Description:** Alcance detallado del cambio propuesto.

2.  **Modificaciones de Tiempo:**
    *   **Time Extension (Days):** Cantidad de días adicionales al contrato.
    *   **Tipo de Días:** Clasificación por compensables o no compensables (para FMIS).

3.  **Partidas y Precios (Items):**
    *   **Contract Items:** Modificaciones a cantidades de partidas que ya existen en el contrato original.
    *   **New Items (Extra Work):** Creación de nuevas partidas no contempladas inicialmente.
    *   **Precio Unitario:** El sistema permitirá editar el precio si es una partida nueva o mostrará el original si ya existe.

4.  **Resumen de Balances:**
    *   **Change Order Amount (Box 28):** Monto neto de la CHO actual.
    *   **Actual Contract Amount (Box 29):** Suma del original más todas las CHOs aprobadas anteriormente.
    *   **New Contract Amount (Box 30):** Balance total proyectado tras esta modificación.

---
### Formularios Especiales Complementarios:

*   **ACT-123 (Supplementary Form):** Se usa como adenda detallada de las partidas cuando la ACT-122 no tiene suficiente espacio o se requiere desglose por fondos.
*   **ACT-124 (Checklist):** Verificación de cumplimiento normativo y firmas necesarias para la aprobación de la orden de cambio.
*   **ROA (Record of Authorization):** Autorización rápida para proceder con trabajos críticos antes de formalizar la CHO completa.

### Cómo Usarlo:
- Seleccione el proyecto y cree una nueva CHO desde el botón "+".
- El sistema calculará automáticamente el historial de balances del proyecto para rellenar los Box 29 y 30.
- Vaya al **Centro de Reportes** para generar los PDFs o Excels oficiales con los datos rellenados.

---
> [!NOTE]
> El sistema detectará automáticamente si una partida es "Extra Work" comparando su número de ítem con la lista original del contrato.
