# Manual de Lógica y Relaciones de PACT (v3.28.0503)

Este documento detalla las reglas de negocio, validaciones y dependencias entre las distintas secciones del programa PACT para asegurar la integridad de los datos y el cumplimiento de los procesos de auditoría.

---

## 1. Certificación de Pagos y Certificados de Manufactura

**Regla de Oro:** No se puede certificar el pago de una partida si no hay evidencia documental (Certificados de Manufactura) que respalde la cantidad instalada.

*   **Relación:** Cada partida (`Item`) en la **Certificación de Pago Mensual** se cruza con la base de datos de **Certificados de Manufactura**.
*   **Validación:** 
    *   `Cantidad Total Certificada` (Manufactura) ≥ `Cantidad Acumulada a Pagar`.
*   **Certificados para Múltiples Partidas:** Si un mismo documento (Certificado de Manufactura) cubre varios ítems o partidas, el sistema permite marcarlo como múltiple. Podrás seleccionar todas las partidas que incluye e indicar la cantidad específica correspondiente a cada una. Al guardar los cambios, el sistema se encargará automáticamente de dividir ("expandir") este único certificado en registros individuales para cada partida en la base de datos, facilitando así el rastreo por ítem.
*   **Advertencia (Warning):** Si intentas pagar una cantidad que supera lo respaldado por los certificados subidos, el sistema mostrará una alerta visual roja en el formulario de pago indicando: *"Advertencia: La cantidad certificada de manufactura para esta partida es insuficiente."*

## 2. Informes Diarios (ACT-45) y Partidas del Contrato

**Relación:** El Informe Diario es la fuente primaria de datos para las certificaciones de pago futuras.

*   **Integridad de Datos:** Al crear un informe diario, solo puedes seleccionar partidas que existan previamente en el **Contrato Original** o en **Change Orders (CHO)** aprobadas.
*   **Sincronización:** Los informes diarios alimentan automáticamente el "Progreso en Campo". Si una partida se reporta como trabajada en un ACT-45, su cantidad acumulada se actualiza para facilitar el llenado de la certificación mensual.
*   **Organización:** Los informes se auto-organizan en directorios mensuales. Al borrar un informe diario, se recalculan las cantidades acumuladas del proyecto para evitar discrepancias.

## 3. Órdenes de Cambio (CHO / ACT-123) y el Presupuesto

**Relación:** Las CHO son el único mecanismo legal para modificar las cantidades o precios del contrato original.

*   **Modificación del Contrato:** Una CHO aprobada inyecta automáticamente nuevas partidas o ajusta las cantidades de las existentes en el módulo de **Certificación de Pagos**.
*   **Garantía de Fondos:** El sistema valida que el total acumulado de las CHO no exceda el presupuesto federal o estatal asignado al proyecto sin previa autorización.

## 4. Inspección (ACT-96) y Gestión de Riesgos

**Relación:** Vincula eventos externos y de seguridad con el progreso físico del proyecto.

*   **Relación con ACT-45:** Aunque son formularios distintos, comparten la misma base de datos de "Días de Trabajo". Una inspección realizada hoy aparecerá vinculada cronológicamente con las actividades reportadas en el informe diario de la misma fecha.
*   **Entidades Externas:** Las inspecciones de EPA, ACT, OSHA o DNER quedan registradas y bloquean la certificación de ciertas partidas si existen violaciones de seguridad pendientes de corregir.

## 5. Firmas Autorizadas y Flujo de Aprobación

**Relación:** Los roles definen quién puede "sellar" legalmente cada reporte.

*   **Jerarquía de Firmas:** 
    *   **Inspector:** Firma el ACT-45 y ACT-96.
    *   **Residente:** Valida la Certificación de Pago.
    *   **Director de Área / Asesor Legal:** Firmas finales para la exportación de reportes maestros (como el ACT-32).
*   **Consistencia:** El nombre y puesto configurados en la sección de **Firmas Autorizadas** del proyecto son los que se inyectan automáticamente en los archivos Excel y PDF finales.

## 6. Documentación Técnica (Archivos y Fotos)

**Relación:** Evidencia visual para auditoría.

*   **Fotos en ACT-45:** Las fotos subidas en un informe diario quedan "ancladas" a la fecha y a las partidas trabajadas ese día.
*   **Exportación:** Al generar el reporte en Excel, el sistema busca las fotos de ese periodo y prepara el anexo fotográfico automáticamente.

---

> [!IMPORTANT]
> **Nota para Auditoría:** Cualquier borrado de un registro (Informe, Pago o CHO) queda registrado en el **Audit Log** del sistema, indicando qué usuario realizó la acción y en qué fecha, para garantizar la trazabilidad total del proyecto.

---
*Diseñado por el Ing. Enrique Saavedra Sada, PE*
