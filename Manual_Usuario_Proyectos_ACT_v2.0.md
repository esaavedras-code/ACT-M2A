# Manual de Usuario - Proyectos ACT (Versión 2.0)

Este manual detalla las funcionalidades y módulos del programa **Proyectos ACT**, diseñado para la gestión técnica y financiera de proyectos de construcción bajo la Autoridad de Carreteras y Transportación (ACT) de Puerto Rico.

---

## Índice
1. [Introducción](#1-introducción)
2. [Gestión de Proyectos](#2-gestión-de-proyectos)
3. [Administración de Partidas](#3-administración-de-partidas)
4. [Órdenes de Cambio (CHO / EWO)](#4-órdenes-de-cambio-cho--ewo)
5. [Certificaciones de Pago](#5-certificaciones-de-pago)
6. [Central de Reportes (Los 11 Módulos)](#6-central-de-reportes)
7. [Copia de Seguridad (Importar/Exportar)](#7-copia-de-seguridad)

---

## 1. Introducción
**Proyectos ACT** es una herramienta integral que centraliza toda la información de un contrato de construcción, desde las cantidades originales de las partidas hasta la liquidación final. Su objetivo es automatizar los cálculos financieros y generar los formularios oficiales de la ACT de forma instantánea.

---

## 2. Gestión de Proyectos
En la pantalla principal y en el formulario de detalles, el usuario puede administrar la información base:
- **Datos de Identificación**: ACT No., Número Federal, Descripción del Proyecto.
- **Personal del Proyecto**: Administrador, Contratista, Liquidador.
- **Fechas Clave**: Fecha de comienzo, terminación original, terminación revisada y aceptación final.
- **Finanzas**: Costo original, días laborables originales y tasas de daños líquidos.

**¿Para qué sirve?** Establece los parámetros que usarán todos los reportes, especialmente los de liquidación y análisis de tiempo.

---

## 3. Administración de Partidas
Este módulo permite ingresar y editar el listado de partidas del contrato (Itemized Proposal).
- **Campos**: Número de partida, especificación, descripción, unidad, cantidad y precio unitario.
- **Sincronización**: Las cantidades ejecutadas se actualizan automáticamente a medida que se ingresan certificaciones de pago.

---

## 4. Órdenes de Cambio (CHO / EWO)
Aquí se gestionan las modificaciones al contrato original.
- **CHO (Change Order)**: Para cambios en partidas existentes o nuevas, e incrementos/reducciones de costo.
- **EWO (Extra Work Order)**: Para trabajos no previstos originalmente.
- **Ajuste de Tiempo**: Permite extender la fecha de terminación del proyecto.

**¿Para qué sirve?** Mantiene el "Costo Final del Contrato" actualizado y permite generar el reporte comparativo de Liquidación.

---

## 5. Certificaciones de Pago
Es el motor principal de la contabilidad del proyecto. Cada certificación (Cert. 1, 2, 3...) registra:
- **Work Performed**: Cantidad de trabajo hecho por partida en ese periodo.
- **Material on Site (MOS)**: Materiales pagados a pie de obra pero aún no instalados.
- **Retenciones**: Cálculo automático del 5% de retención o retenciones extra.
- **Formulario ACT-117C**: Genera automáticamente el anverso y reverso del certificado de pago oficial.

---

## 6. Central de Reportes
Dividida en 8 secciones lógicas para cubrir todo el ciclo de vida del proyecto:

### I. Información General
- **Datos de Proyecto**: Hoja de resumen de funcionarios y contratistas.
- **Dashboard Ejecutivo**: Resumen visual de costo vs. tiempo y progreso actual.

### II. Gestión de Partidas
- **Balances Actuales**: Comparativa de qué se contrató vs. qué se ha pagado hasta hoy.
- **Detalle de Ejecución**: Historial cronológico de cada vez que se pagó una partida específica.

### III. Manufactura
- **Certificados de Manufactura**: Control de documentos de fábrica requeridos para materiales.

### IV. MOS (Material on Site)
- **Inventario**: Detalle de facturas y deducciones.
- **ACT-117B**: Formulario oficial de balance de materiales por partida.

### V. Change Orders
- **Exportación Selectiva**: Genera un PDF con una o varias órdenes de cambio específicas.

### VI. Certificaciones de Pago
- **ACT-117C Oficial**: Generación masiva de certificaciones de pago con todos sus anexos.

### VII. Liquidación (Módulo Crítico)
- **Acceptance Checklist**: Cotejo para proyectos con fondos federales.
- **Hojas de Liquidación por Partida**: Documento que resume la historia de cada partida (Original + CHOs - Pagos = Balance Final).
- **Final Construction Report**: Resumen mensual de pagos y totales.
- **Final Estimate**: Desglose financiero final para cierre.
- **Contract Final Report**: Informe narrativo con fechas y costos finales ajustados.
- **Análisis de Tiempo (AC-457b)**: Cálculo de días por Overrun y posibles daños líquidos.
- **Environmental Review Certification**: Certificación de cumplimiento ambiental con logo oficial.

---

## 7. Copia de Seguridad (Importar/Exportar)
El programa permite exportar toda la base de datos de un proyecto a un archivo `.json`.
- **Exportar**: Crea un respaldo local seguro.
- **Importar**: Permite mover el proyecto de una computadora a otra o restaurar datos anteriores.

**Importante**: Se recomienda exportar el proyecto al finalizar cada certificación de pago importante.

---
*Manual generado para Proyectos ACT v2.0 - Mar 2026*
