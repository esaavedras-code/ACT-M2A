# Manual de Instrucciones y Funciones del Programa PACT

Este documento describe todas y cada una de las funciones disponibles en las diferentes secciones de manejo de proyectos del sistema PACT.

---

## 1. ENTRADA DE DATOS (Configuración Inicial)

Esta sección es el corazón del proyecto. Aquí se configuran los datos base que alimentarán el resto de los módulos y certificaciones.

### Pestaña: Información y Documentos
*   **Núm. AC:** Campo de texto. Si escribes números, el sistema le añade automáticamente el prefijo "AC-" (ej. AC-123456).
*   **Núm. Federal:** Campo de texto libre.
*   **Nombre del Proyecto:** Campo de texto amplio.
*   **Núm. Oracle / Núm. Contrato / No. Cuenta:** Campos de texto y numéricos.
*   **Costo Original ($):** Campo numérico con formato automático de moneda (verde). Al modificarlo, se recalcula el daño líquido.
*   **Región:** Selector desplegable con 5 opciones fijas: `Norte`, `Sur`, `Este`, `Oeste`, `Metro`.
*   **Daños Líquidos Diarios ($):** Campo numérico (rojo). Se calcula solo en base a una tabla de la ACT según el costo original, pero puedes borrarlo y escribir la cantidad manualmente si lo deseas.
*   **Participación Federal (%):** Campo numérico para porcentajes (por defecto 80.25%).
*   **Ruta de Grabación (Carpeta):** Permite abrir una ventana de Windows para seleccionar la carpeta local en tu computadora donde quieres que se guarden los archivos generados de este proyecto.
*   **Núm. OCPR / Diseñador / Municipios / Carreteras:** Campos de texto.
*   **Alcance Proy. (SCOPE):** Cuadro de texto amplio (multilínea) para describir detalladamente los trabajos a realizarse.
*   **Fechas Relevantes (Selectores de Calendario):**
    *   **Hoy:** Es automático, siempre muestra la fecha actual. No es editable.
    *   **Firma Contrato / Orden de comienzo**
    *   **Terminación Original / Terminación Revisada**
    *   **Estimated Completion / Real Completion / Substantial Completion / Final Inspection**
    *   **Terminación Administrativa:** Este campo se **calcula automáticamente** sumando exactamente 2 años a la fecha de Terminación Revisada.
    *   **FMIS End Date**
*   **Documentación Crítica y Asistente IA (ACT-GPT)**
    *   **Tipo de Documento:** Selector que permite elegir: `Orden de comienzo`, `Project Agreement`, `Proposal`, `Contrato`.
    *   **Subir Archivo:** Botón para buscar un PDF en tu computadora y asociarlo al proyecto.
    *   **Iniciar Análisis Integral ACT-GPT:** Al presionarlo, el sistema lee todos los PDF que subiste y *llena automáticamente* el costo, las fechas, contratista, alcance, fondos y todas las partidas del contrato sin que tengas que escribirlas.
*   **Información del Contratista:**
    *   Campos de texto para: **Nombre de la Empresa**, **Representante**, **SS Patronal**, **Teléfono Oficina**, **Teléfono Celular** y **Email**. El sistema formatea automáticamente los teléfonos a `(XXX) XXX-XXXX`.

### Pestaña: Firmas ACT (Personal Autorizado)
*   **Periodo (Desde / Hasta):** Dos campos de calendario. Si el puesto está vigente, el "Hasta" se deja vacío (Actual).
*   **Rol / Puesto:** Selector desplegable con estas opciones exactas: `Director Ejecutivo`, `Subdirector Ejecutivo`, `Dir. Ejec. Infraestructura`, `Dir. Área Construcción`, `Director Finanzas`, `Director Regional`, `Supervisor de Área`, `Administrador del Proyecto`, `Oficial de Liquidación`, `Dir. Oficina Control de Proyectos`.
*   **Nombre Completo:** Campo de texto.
*   **Botón de Cambio (Transición Automática):** Al presionarlo (símbolo de +), se abre una fila celeste. Te permite escribir el nombre del funcionario sucesor. El sistema automáticamente le pondrá fecha de fin al viejo, y fecha de inicio de hoy al nuevo.
*   **Oficina, Celular, Email:** Campos de texto. *(Ocultos automáticamente si seleccionas un rol de alta gerencia).*

### Pestaña: Todas las Partidas (Cantidades Originales)
*   **Importar desde Excel:** Botón que permite subir una plantilla con las partidas para cargarlas masivamente.
*   **Añadir Fila:** Agrega una partida en blanco al final.
*   **Ítem #:** Número correlativo de la partida (ej. 001).
*   **Especificación:** Campo inteligente. Al escribir, autocompleta con el catálogo del Standard Specifications.
*   **Descripción:** Texto libre.
*   **Cantidad:** Campo numérico decimal.
*   **Unidad:** Se auto-llena según la especificación, pero permite escritura libre (`LS, EA, LF, SY, CY, TON, HOUR`, etc.).
*   **Precio Unitario:** Campo numérico de dinero.
*   **Fuente de Fondos:** Texto libre (ej. `ACT:100%`, o `FHWA:80% / ACT:20%`).

### Pestaña: Info. CCML (Cartas de Requerimiento)
*   Muestra una cuadrícula con **11 filas fijas**: `Original Project Funds` y `Modification #1` a `#10`.
*   **Federal Share ($) / Toll Credits ($) / State Funds ($):** Celdas numéricas editables al darle clic.
*   **Fila Oscura (Revised Amount):** Suma automáticamente las cantidades de todas las modificaciones y te da los totales matemáticos exactos en vivo.

---

## 2. REPORTE DE OBRA (ROA / Bitácora)

*   **Fecha y Resumen:** Selección de fecha. Generación del día de trabajo.
*   **Clima y Condiciones:** Selectores para Mañana y Tarde (Soleado, Nublado, Lluvia, etc.) y campos para Temperatura Mínima y Máxima.
*   **Personal (Contratista y Subcontratistas):** Permite añadir cuadrillas por oficio (ej. Capataz, Operador, Labor) e indicar horas regulares y extra.
*   **Equipo Mayor:** Selección de equipos en obra, indicando horas activas o si estuvieron inactivos (Idle).
*   **Descripción de Trabajos:** Área de texto amplio para documentar lo realizado, materiales recibidos, visitas y directrices dadas.
*   **Botón Generar PDF:** Crea el reporte oficial de obra (ROA).

---

## 3. REPORTES DE INSPECCIÓN (ACT-45 y ACT-96)

*   **ACT-45 (Daily Report):** Permite documentar trabajo extra realizado por administración (Force Account). Incluye secciones para Labor, Materiales y Equipo con cálculo automático de totales.
*   **ACT-96 (Report of Inspection):** Reporte diario oficial que incluye descripción del trabajo del contratista, condiciones del terreno, firmas del inspector y observaciones.

---

## 4. CERTIFICACIONES MENSUALES DE PAGO

*   **Selección de Periodo:** Fecha de inicio y fin de la certificación.
*   **Número de Certificación:** Se asigna automáticamente (Parcial 1, 2, 3... o Final).
*   **Cantidades Ejecutadas:** Muestra una tabla con todas las partidas. Permite ingresar cuánto se ha instalado "Este Periodo" (This Period). Calcula automáticamente el "Hasta la Fecha" (To Date) sumando certificaciones anteriores.
*   **Ajustes de Retención:** Casillas para calcular el 10% o el 5% de retención (Retainage) automática según el estatus del proyecto.
*   **Penalidades y Retenciones Extra:** Campos para aplicar deducciones por Daños Líquidos (Liquidated Damages) o retenciones por falta de documentos laborales (Nóminas, Pólizas).
*   **Resumen Financiero:** Genera el balance final automático y el PDF oficial de la certificación de pago.

---

## 5. ÓRDENES DE CAMBIO (CHO)

*   **Detalle del CHO:** Permite asignar número de orden de cambio, fecha y justificación técnica.
*   **Modificación de Partidas:** Permite agregar partidas *Nuevas* o modificar partidas *Existentes*. 
*   **DOFAEI Integrado:** Genera automáticamente el desglose de fondos aplicable para el departamento de finanzas.
*   **Firmas Específicas:** Permite seleccionar quiénes de la gerencia aprueban esa orden de cambio en particular.

---

## 6. CUMPLIMIENTO LABORAL Y NÓMINAS (Compliance)

*   **Registro de Subcontratistas:** Permite dar de alta a los subcontratistas aprobados.
*   **Certificación de Nóminas (Payroll):** Registro semanal de que el contratista sometió sus nóminas certificadas.
*   **Pólizas y Seguros:** Control de vencimientos de la póliza del Fondo del Seguro del Estado, ACAA, Responsabilidad Pública (Public Liability) y Propiedad.
*   Alerta automática si el contratista tiene documentos vencidos al momento de generar un pago.

---

## 7. MATERIALES Y MANUFACTUREROS (Materials / Mfg Certs)

*   **Registro de Certificaciones:** Vincula facturas de materiales y certificaciones de manufactureros directamente con las partidas específicas del proyecto.
*   **Trazabilidad:** Asegura que no se pague material que no cuente con su certificación de procedencia y calidad aprobada.

---

## 8. LIQUIDACIÓN DEL PROYECTO

*   **Balance Final:** Calcula todos los pagos emitidos contra el presupuesto del contrato original y las órdenes de cambio.
*   **Cierre de Partidas:** Verifica que ninguna partida haya excedido su presupuesto sin justificación.
*   **Documentación de Cierre:** Genera el documento final ("Final Estimate") para proceder al pago final y cancelación de fianzas.
