# MANUAL DE INSTRUCCIONES: DASHBOARD DE RESUMEN (PACT)
**Sistema de Control y Administración de Proyectos**
*Documento de Referencia Técnica y Operativa — Julio 2026*
*Diseño y Conceptualización: Ing. Enrique Saavedra Sada, PE*

---

## 1. INTRODUCCIÓN AL DASHBOARD DE RESUMEN
El **Dashboard de Resumen** es el panel centralizador de PACT. Consolida, en tiempo real, los datos técnicos, financieros y de cumplimiento del proyecto mediante la integración de múltiples módulos (Entrada de Datos, Certificaciones de Pago, Change Orders, Cumplimiento Laboral y Liquidación).

El objetivo principal de este componente es ofrecer al **Administrador del Programa** y al **Ingeniero de Proyecto** una visualización consolidada del estado del proyecto para facilitar la toma de decisiones críticas de control de costo y tiempo.

---

## 2. ALERTAS CRÍTICAS Y FLUJO DE VALIDACIÓN
El sistema evalúa de forma proactiva tres áreas críticas de riesgo operativo en la parte superior del Dashboard:

### 2.1. Alertas FMIS (Federal Medical/Infrastructure Funding End Date)
El sistema monitorea la fecha de finalización del financiamiento federal (FMIS End Date) del proyecto en comparación con la fecha actual del sistema.
* **Aviso (Warning):** Si faltan **30 días o menos** para la fecha FMIS, se despliega un banner de advertencia color ámbar animado indicando los días restantes.
* **Expiración (Expired):** Si la fecha actual supera el límite FMIS, se despliega un banner rojo de alta prioridad advirtiendo el vencimiento y los días transcurridos desde el límite.

### 2.2. Alertas de Cumplimiento Laboral (Labor Compliance)
Compara la fecha de vencimiento (`date_expiry`) de cada documento de cumplimiento laboral registrado para los subcontratistas activos con la fecha actual del sistema.
* **Excepción de Terminación Sustancial:** Si el proyecto cuenta con una fecha de terminación sustancial registrada y el documento vence con posterioridad a esta, el sistema **no** lo cataloga como vencido.
* **Bloqueo:** Enlista en rojo todos los documentos vencidos junto al nombre del subcontratista y la fecha de expiración correspondiente.

### 2.3. Alertas de Certificados de Manufactura (CM) Insuficientes
Implementa una regla de control que impide pagar cantidades que carezcan de certificación física aprobada. El sistema valida de manera recursiva todas las certificaciones de pago:
* Para cada partida que requiera certificado de manufactura (`requires_mfg_cert = true`), calcula el acumulado aprobado por certificados de manufactura contra el acumulado histórico pagado hasta la certificación anterior.
* **Partidas por Unidad de Medida Estándar:**
  $$Qty_{\text{disponible}} = Qty_{\text{aprobada\_CM}} - Qty_{\text{pagada\_anterior}}$$
  Si la cantidad a pagar en la certificación actual supera esta diferencia, se genera una alerta detallando la cantidad faltante.
* **Partidas tipo Lumpsum (LS):**
  Aplica un escalado en base al porcentaje de peso asignado a la partida física:
  $$Qty_{\text{disponible\_LS}} = \left( Qty_{\text{aprobada\_CM}} \times \frac{100}{\text{mfg\_cert\_qty}} \right) - Qty_{\text{pagada\_anterior}}$$
  Si el pago actual excede el balance escalado, se alerta la insuficiencia expresada en unidades de manufactura.

---

## 3. MÓDULO 1: FECHAS CLAVE Y BALANCE DE TIEMPO

Este bloque controla la duración del proyecto, el tiempo consumido y las prórrogas aprobadas.

### 3.1. Días de Contrato Originales ($D_{\text{total}}$)
Es la diferencia total en días calendario entre la fecha de comienzo y la fecha original de terminación del contrato:
$$D_{\text{total}} = \text{Fecha Terminación Original} - \text{Fecha Comienzo} + 1$$

### 3.2. Días de Prórroga por Change Orders ($D_{\text{ext\_CHO}}$)
Es la suma neta de los días otorgados en las Órdenes de Cambio aprobadas por el programa:
$$D_{\text{ext\_CHO}} = \sum (\text{time\_extension\_days}_{\text{aprobados}})$$

### 3.3. Días de Contrato Revisados ($D_{\text{revisados}}$)
$$D_{\text{revisados}} = D_{\text{total}} + D_{\text{ext\_CHO}}$$

### 3.4. Tiempo Transcurrido a la Fecha ($D_{\text{transcurrido}}$)
Calcula los días consumidos por el contratista. Si el proyecto tiene una fecha de **Terminación Sustancial** o **Terminación Real** registrada, se congela el cálculo usando dicha fecha límite; de lo contrario, se calcula hasta el día actual:
$$D_{\text{transcurrido}} = \text{Fecha Límite} - \text{Fecha Comienzo} + 1$$

### 3.5. Balance de Días ($D_{\text{balance}}$)
Diferencia entre el tiempo otorgado y el tiempo consumido:
$$D_{\text{balance}} = D_{\text{revisados}} - D_{\text{transcurrido}}$$
* *Nota:* Un valor negativo se destaca en **rojo** para indicar atraso en el cronograma.

### 3.6. Progreso del Tiempo Transcurrido (Porcentaje)
$$\text{Progreso Tiempo (\%)} = \left( \frac{D_{\text{transcurrido}}}{D_{\text{revisados}}} \right) \times 100$$

---

## 4. MÓDULO 2: COSTOS, PAGOS Y AVANCE DE OBRA

Monitorea la ejecución del presupuesto original y ajustado de la obra.

### 4.1. Costo Original ($C_{\text{original}}$)
Representa el monto total de la adjudicación inicial del contrato. Se obtiene de la base de datos o mediante la sumatoria del valor original de las partidas contractuales:
$$C_{\text{original}} = \sum (Qty_{\text{original}} \times Price_{\text{unitario}})$$

### 4.2. Costo Ajustado ($C_{\text{ajustado}}$)
Monto del contrato vigente tras aplicar las modificaciones aprobadas:
$$C_{\text{ajustado}} = C_{\text{original}} + \sum (\text{proposed\_change}_{\text{CHO\_aprobados}})$$

### 4.3. Trabajo Certificado hasta la Fecha ($Certified_{\text{total}}$)
Sumatoria neta del monto directo ejecutado en todas las certificaciones de pago acumuladas que no estén marcadas como excluidas:
$$Certified_{\text{total}} = \sum (\text{Monto Certificación de Pago})$$

### 4.4. Balance Actual del Contrato (Remaining Balance)
Presupuesto disponible o remanente por certificar:
$$B_{\text{remaining}} = C_{\text{ajustado}} - Certified_{\text{total}}$$

### 4.5. Porcentaje de Obra Ejecutada
Proporción de avance financiero y de obra ejecutada facturada sobre el monto ajustado del contrato:
$$\text{Progreso Obra (\%)} = \left( \frac{Certified_{\text{total}}}{C_{\text{ajustado}}} \right) \times 100$$

### 4.6. Desglose de Fondos de Financiamiento
Para cada partida y orden de cambio, el sistema determina la participación en base a la tasa de aportación federal configurada para el proyecto:
* **Participación FHWA (Federal Highway Administration):**
  $$FHWA_{\text{share}} = \text{Monto Ejecutado} \times \left( \frac{\text{Federal Share Pct}}{100} \right)$$
* **Participación ACT (Autoridad de Carreteras y Transportación):**
  $$ACT_{\text{share}} = \text{Monto Ejecutado} - FHWA_{\text{share}}$$

---

## 5. MÓDULO 3: MATERIAL ON SITE (MOS)

Administra los adelantos monetarios concedidos al contratista por acopio de materiales en el sitio del proyecto y su correspondiente amortización conforme se instalan los materiales.

### 5.1. Balance Histórico Pagado de MOS
El monto total acumulado de facturas de materiales que han sido aprobadas y pagadas como adelanto al contratista:
$$MOS_{\text{historico}} = \sum (Cost_{\text{factura\_MOS\_aprobada}})$$

### 5.2. Balance Actual de MOS
El valor monetario del material que permanece almacenado y que aún no ha sido incorporado a la obra física. Disminuye automáticamente cuando el inspector certifica la colocación de la partida correspondiente en obra:
$$MOS_{\text{actual}} = MOS_{\text{historico}} - \sum (Qty_{\text{instalada}} \times Price_{\text{factura\_MOS}})$$

---

## 6. MÓDULO 4: CHANGE ORDERS (ÓRDENES DE CAMBIO)
Muestra un desglose en forma de matriz del número de órdenes de cambio (CHOs), el tiempo extendido acumulado y el impacto monetario total según el estado administrativo de los documentos:
1. **Aprobados:** CHOs validados y firmados por la Autoridad (alimentan directamente al Costo Ajustado y Días Revisados).
2. **En Trámite:** CHOs en fase de análisis (monto proyectado pero no incorporado al balance actual de ejecución).
3. **Resumen:** Suma total de ambos estados para proyección global de costos.
4. **Porcentaje de Cambio (Costo):**
   $$\text{\% Cambio Costo} = \left( \frac{\sum (\text{Monto CHOs Aprobados})}{C_{\text{original}}} \right) \times 100$$

---

## 7. MÓDULO 5: RETENCIONES, PENALIDADES Y LIQUIDACIÓN (NET PAID)

Este bloque detalla todas las deducciones contractuales, penalizaciones y el monto neto transferido al contratista.

### 7.1. Retención Contractual del 5% ($R_{5\%}$)
Retención automática del 5% aplicada sobre las partidas que no tengan la exención de retención aprobada (`skip_retention = false`):
$$R_{5\%} = \sum (\text{Monto de Partida Afecta} \times 0.05)$$

### 7.2. Daños Líquidos (Liquidated Damages - DLQ)
Multa por retraso acumulado a base de una tasa fija diaria configurada para el proyecto. Comienza a penalizar de forma automática una vez el tiempo transcurrido supera el plazo de contrato revisado:
$$DLQ = \max(0, (D_{\text{transcurrido}} - D_{\text{revisados}}) \times Rate_{\text{diaria}})$$

### 7.3. Total Retenciones y Penalidades ($Ret_{\text{total}}$)
Consolida todas las deducciones activas y reembolsos aplicados a lo largo del historial de certificaciones:
$$Ret_{\text{total}} = R_{5\%} - Reembolso_{\text{Ret}} + Ret_{\text{extra}} + Multas_{\text{Seguro}} + Penalidades_{\text{otras}} - Ajustes_{\text{Precios}} - Reembolso_{\text{Penalidades}} + DLQ + Multas_{\text{Certificaciones}}$$

### 7.4. Monto Neto Pagado (Net Paid)
Representa la cantidad neta final transferida al contratista:
$$Net\ Paid = Certified_{\text{total}} - Ret_{\text{total}}$$

---

## 8. MÓDULO 6: CIERRE Y LIQUIDACIÓN DE PARTIDAS
Mide el progreso del cierre administrativo formal de cada una de las partidas del contrato original.
* **Firmas Requeridas:** Para liquidar completamente un ítem de contrato, se requiere la aprobación digital de tres actores:
  1. Administrador de Proyecto (Admin)
  2. Representante del Contratista (Contr)
  3. Ingeniero Liquidador (Liq)
* **Porcentaje de Firmas Recolectadas:**
  $$\text{\% Firmas Recolectadas} = \left( \frac{\text{Total Firmas Recolectadas}}{\text{Cantidad Total de Partidas} \times 3} \right) \times 100$$
* **Documentos de Cierre Federales:** Despliega una lista dinámica de verificación con los nombres de los documentos y certificaciones federales requeridas para el cierre del proyecto que han sido completados y cargados al expediente digital.

---
*Fin del Manual de Instrucciones del Dashboard de Resumen (PACT)*
*Documento preparado de forma automatizada por Antigravity para el Ing. Enrique Saavedra Sada, PE.*
