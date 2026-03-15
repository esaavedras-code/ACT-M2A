# Manual de Usuario - Programa de Control de Proyectos ACT v2.0

Este manual detalla todas las secciones y funcionalidades del programa para el control de obras de la Autoridad de Carreteras y Transportación (ACT).

## 1. Acceso y Navegación Principal

Al iniciar el programa, entrará en el **Dashboard Principal**.
- **Resumen de Proyectos**: Lista de todos los proyectos activos con su número ACT, descripción y presupuesto.
- **Búsqueda**: Utilice la barra de búsqueda para filtrar proyectos por número o nombre.

## 2. Gestión de Proyectos

### Crear Nuevo Proyecto
Haga clic en el botón de añadir proyecto en el Dashboard. Primero deberá completar la **Sección 1 (Información del Proyecto)**. Una vez guardado, se habilitarán las demás secciones.

### Secciones del Proyecto

#### 1. Información del Proyecto (Section 1)
- Datos básicos: Número ACT, FHWA, municipio, fechas de contrato y adjudicación.
- **Estado de Fondos**: Configuración del porcentaje de aportación federal.
- **Botón de Borrado**: Permite eliminar el proyecto completo (requiere confirmación).

#### 2. Información del Contratista (Section 2)
- Nombre de la empresa, representante, seguro social patronal y contactos.
- Esta información se utiliza automáticamente en la generación de reportes.

#### 3. Firmas ACT (Section 3)
- Listado de personal asignado al proyecto (Ingeniero de Área, Supervisor, etc.).
- Permite añadir múltiples funcionarios con sus respectivos roles.

#### 4. Partidas del Contrato (Section 4)
- **Inventario Maestro**: Listado de todas las partidas adjudicadas.
- Incluye descripción, cantidad original, unidad y precio unitario.
- **Mfg (Cert. Manufactura)**: Marque esta casilla si la partida requiere certificación de materiales para ser pagada.

#### 5. Órdenes de Cambio - CHO (Section 5)
- Gestión de variaciones al contrato original.
- Permite añadir o reducir cantidades a las partidas existentes o crear partidas nuevas bajo la orden de cambio.

#### 6. Certificaciones de Pago (Section 6)
- Creación de certificaciones periódicas.
- **Retención**: El sistema aplica automáticamente el 10% de retención (configurable).
- **MOS (Material on Site)**: Permite registrar facturas de materiales que aún no han sido instalados pero se pagarán por adelantado.
- **Balance a Pagar**: Cálculo automático restando retención anterior y sumando devolución de retención si aplica.

#### 7. Certificados de Manufactura (Section 7)
- **Carga de PDF**: El sistema puede leer archivos PDF de certificados y extraer automáticamente la partida, cantidad y fecha.
- **Validación Automática**: Verifica cumplimiento con regulaciones (Buy America, registros, etc.).
- **Estado de Cumplimiento**: Indica si el documento es válido para ser procesado por PRHTA.

#### 8. Inventario Material on Site (Section 8)
- Rastreo automático de materiales pagados por factura vs. materiales instalados.
- El sistema alerta si se intenta instalar más material del que hay en el inventario.

#### 9. Cumplimiento Laboral (Section 9)
- Seguimiento de documentos requeridos (Child Support, Dept. of Labor, etc.).
- **Alertas de Expiración**: Los campos se resaltan en rojo si el documento ha expirado.
- **Notificación por Email**: (Solo versión escritorio) Envía recordatorios directamente a los contratistas.

#### 10. Liquidación (Section 10)
- Resumen final del proyecto.
- Seguimiento de firmas de funcionarios y documentos federales finales.

## 3. Generación de Reportes

Ubicado en el menú lateral. El sistema genera documentos PDF oficiales listos para firma:
- **ACT-117C**: Estimado mensual de pago.
- **Certificación Ambiental**: Requisito de cierre.
- **Análisis de Tiempo (AC-457b)**: Cálculo de días de contrato y extensiones.
- **Hoja de Liquidación**: Para el cierre administrativo del proyecto.

## 4. Preguntas Frecuentes y Soporte

- **¿Por qué no puedo editar una sección?**: Asegúrese de haber guardado la Sección 1 primero.
- **¿Cómo se guardan los cambios?**: El sistema utiliza sincronización en tiempo real. Los campos resaltados en verde indican que el dato se guarda al momento de escribir.
- **¿Cómo actualizo la versión?**: El sistema le notificará cuando haya una versión 2.0+ disponible para descarga.
