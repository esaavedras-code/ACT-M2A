# Manual de Usuario Detallado: Sistema de Administración de Proyectos ACT

## Introducción al Programa
Este **Sistema de Administración de Proyectos** es una herramienta centralizada creada para llevar el control total de los aspectos financieros, contables, y administrativos de uno o múltiples proyectos de construcción o servicios. 

El programa te permite rastrear desde la firma del contrato y el presupuesto original, hasta los pagos mensuales, penalidades y la liquidación de la obra. Toda la información que ingreses se guarda de forma segura en una base de datos central en internet (la nube), por lo cual puedes acceder a ella con la certeza de que tus cálculos matemáticos no se perderán.

### Cómo navegar y guardar tus cambios
* **Pestañas (Tabs):** En la parte superior verás botones numerados del 1 al 10 más el Dashboard. Al hacer clic en cada uno, el sistema cargará esa sección.
* **El botón de Guardar:** Al iniciar un cambio en alguna celda de cualquier sección, el programa detecta el movimiento y te indicará que tienes cambios sin guardar. Es crítico que, antes de cambiar a otra página o de cerrar tu navegador, oprimas el botón **"Guardar"** o **"Sincronizar"** (habitualmente en la esquina superior derecha o al final del recuadro). Si intentas salir por error, el sistema lanzará una advertencia para evitar que pierdas tus datos.

A continuación, detallamos cada sección de la aplicación y el propósito de **cada celda o botón** en pantalla.

---

## Panel Principal (DASHBOARD)
**Propósito general:** El Dashboard es tu panel de control visual. Esta sección no requiere que ingreses información manual, sino que el sistema recoge todos los datos del resto de las pestañas (1 al 10) y las resume automáticamente en cuadros informativos.

* **Actualizar Datos:** Un botón (texto verde) para refrescar el resumen en pantalla y asegurar que estás viendo los números más actualizados si alguien más editó el proyecto.
* **Descargar (JSON) y Descargar (Excel/CSV):** Botones mediante los cuales puedes bajar un respaldo de los números y fechas a tu computadora. El botón verde (CSV) genera un listado preparado para abrirse en Microsoft Excel en tu PC.
* **Cuadro de TIEMPO:** Te indica los días del contrato, los días transcurridos hasta Hoy, el balance de días que quedan para finalizar, y una barra de progreso porcentual del tiempo consumido.
* **Cuadro de "CHANGE ORDERS" (Órdenes de Cambio):** Resume cuánto dinero extra se ha aprobado en órdenes de cambio, cuánto dinero de órdenes está "en trámite" pero aún no oficializado, y a qué porcentaje del presupuesto original equivalen.
* **Cuadro de PENALIDADES:** Resume en dólares las penalidades en las que está incurriendo el contratista, por ejemplo, los daños liquidados por haberse excedido del tiempo de terminación acordado.
* **Cuadro de COSTOS Y LIQUIDACIÓN:** La métrica más importante, que indica el costo final previsto, cuánto se ha pagado a la fecha ("Total Certificado"), cuánto debe el fondo local (ACT) y el fondo federal (FHWA), y el Balance de dinero pendiente a pagar. 

---

## 1. Proyecto
**Propósito general:** Sirve como la cubierta oficial o carátula del proyecto. Aquí se especifican los detalles de identificación legal del proyecto, sus fuentes de fondo, detalles de ubicación y fechas clave de todo el ciclo de vida de la obra.

**Explicación de celdas:**
* **Núm. AC:** Código o número interno del proyecto adjudicado.
* **Núm. Federal:** Número de proyecto ante la Agencia Federal pertinente, si aplica.
* **Nombre del Proyecto:** La descripción o título corto de la obra.
* **Botón del Zafacón rojo:** A la par del nombre del proyecto (si el proyecto ya existe), encontrarás el icono para borrar. Esto eliminará todos los datos relacionados permanentemente de la base de datos.
* **Núm. Oracle:** Referencia de contabilidad del sistema financiero subyacente de la agencia.
* **Núm. Contrato:** Número formal y legal del contrato firmado.
* **No. Cuenta:** Cuenta contable o de banco que costeará la obra.
* **Costo Original ($):** El presupuesto base inicial contratado (antes de órdenes de cambio). **IMPORTANTE:** Al hacer clic, debes escribir el número neto (ejemplo: 50000); al desenfocar el cuadro, el sistema le añadirá los símbolos de moneda y comas.
* **Región:** Menú de opciones (Norte, Sur, Este, Oeste, Metro) que define a qué jurisdicción regional pertenece la obra.
* **Ruta de Grabación (Carpeta):** Un campo de texto donde el administrador puede anotar la ruta física de la computadora (ej: `C:\Mis Documentos\Carretera1`) donde se guardan los archivos PDF escaneados, las facturas en papel, o los resúmenes de Excel pertinentes a este proyecto. El icono de la carpeta permite utilizar el selector de archivos moderno en sistemas compatibles.
* **Núm. OCPR:** Número asignado por la Oficina de la Contralora de Puerto Rico, o equivalentes oficiales.
* **Diseñador:** Nombre o despacho de la persona u oficina que creó los planos o alcances.
* **Municipios y Carreteras:** Ubicación geográfica (ej: "San Juan, Carolina" o "PR-1, PR-52").
* **Alcance Proy. (SCOPE):** Un cuadro grande para redactar una descripción breve de qué trata el proyecto.

* **Sección de "Fechas Relevantes":**
  * **Hoy (Automática):** Muestra inamovible la fecha del día corriente o actual.
  * **Firma Contrato:** Cuándo ambas partes formalizaron el acuerdo.
  * **Comienzo Proyecto y Terminación Original:** Fecha de inicio y la fecha en que, según el contrato, el proyecto debe de completarse.
  * **Terminación Revisada:** La nueva fecha de terminación si se han otorgado aplazamientos u Órdenes de Cambio con tiempo adicional.
  * **Terminación Administrativa (+2 Años):** Automáticamente calcula 2 años posteriores a la Terminación Revisada para propósitos de cierre de carpetas y vigencias institucionales del gobierno.
  * **Terminación Estimada, Real, Sustancial, e Inspección Final:** Récord de cuándo se espera acabar y las fechas cronológicas formales en que el proyecto se dio por concluido físicamente y de validación.
  * **FMIS END DATE:** Fecha del sistema federal o de administración externa (Federal Management Information System) indicando cuándo vence la asignación de fondos.

---

## 2. Contratista
**Propósito general:** Guardar el perfil corporativo de la empresa que ejecuta la obra.

**Explicación de celdas:**
* **Nombre del Contratista:** Razón Social y legal de la compañía constructora o de diseño.
* **Representante / Email Rep. / Teléfono Rep.:** El nombre de la persona responsable del contrato y su información de contacto directo.
* **Título Representante:** Cargo que ostenta (Ej. Presidente, Ingeniero, Socio Ejecutivo).
* **Seguro Social Patronal (Social Security / EIN):** El número tributario de la empresa indispensable para radicar pagos.
* **Dirección Física / Postal:** Su locación física principal.
* **Botón Añadir Segundo Contratista (si aplica):** Permite añadir una segunda entidad legal si la obra la atiende un Consorcio o un "Joint Venture" de dos compañías unidas.

---

## 3. Firmas ACT
**Propósito general:** Llevar el récord del equipo administrativo (empleados de la Autoridad o dueños) que firman y validan los procesos (quién autorizó qué, quién es el gerente del proyecto, etc.).

**Explicación de celdas:**
* **Botón Añadir Persona:** Crea una fila nueva en la lista de empleados. En cada columna se llenan sus datos.
* **Rol / Puesto:** Un menú desplegable para indicar si es Director Regional, Supervisor del Proyecto, o Director Ejecutivo de Infraestructura.
* **Nombre Completo:** Nombre de dicha persona de alta jerarquía o inspector.
* **Oficina / Celular / Email:** Puntos de contacto. **NOTA**: Algunos "Roles" de alto perfil (Ej. Director Ejecutivo) están programados para anular la necesidad de un teléfono de contacto en el sistema regular por políticas internas, si escoges su puesto estos cuadros se verán inhabilitados.

---

## 4. Partidas
**Propósito general:** Detallar en líneas qué cosas conforman la totalidad de la obra. Cada tuerca, servicio de asfalto, u hormigón estipulado dentro del contrato inicial cuenta como una "Partida".

**Explicación de celdas:**
* **Ítem (Número):** Numeración consecutiva de las partidas (1, 2, 3...) auto-generada por el programa.
* **Especificación:** Número o código de manual estandarizado para dicho elemento constructivo (ej. código #401 de asfaltos o base).
* **Descripción y Descripción Adicional:** En qué consiste o título natural de la tarea (Ej. "Capa de Asfalto Tipo S") y notas adyacentes importantes a recordar.
* **Cantidad y Unidad:** Ejemplos: "5000" y "TM" (Toneladas Métricas) / o "Ls" (Lump Sum o Suma Global).
* **Precio Unitario ($):** Lo que cuesta cada "Tonelada Métrica" (guiándonos del ejemplo anterior).
* **Monto Original:** El sistema hace la multiplicación por sí solo (Cantidad x Precio Unitario), tú no tienes que ingresarlo.
* **Requiere Certificación Manufactura:** Si esta partida es algo comprado a un fabricante (Ej. un transformer o estructura de acero) marcar esta casilla como ("SÍ") indicará al sistema que exija validarlo en la Sección 7.

---

## 5. Órdenes de Cambio (CHO)
**Propósito general:** Para registrar cuando el contratista requiere una enmienda oficial al contrato (añadir presupuestos o añadir una partida que originalmente se les olvidó pactar).

**Explicación de celdas dentro del Cho General:**
* **Botón Crear Órden:** Te abrirá un formulario nuevo para un CHO.
* **Núm de CHO:** El consecutivo de órdenes de tu contrato (Ej "CHO-01").
* **Estatus:** Un selector para decir si el trámite solo fue "Radicado", está "Sometido a FHWA", o ya está "Aprobado".
* **Extensión de Tiempo (días):** Si esta enmienda le está otorgando al contratista días extra para que termine (Ej. 10 días). Esto ajusta la fecha calculada "Terminación Revisada" de la Sección 1.
* **Fecha:** La autorización formal del documento.
* **Desglose de Partidas (Añadir Partida al CHO):** Presionando el botón debajo de este CHO, puedes agregar qué partes constructivas exactamente se le añaden a la obra con este incremento de contrato (Se te pide la cantidad extra y el costo unitario extra, que funcionan igual que en la sección 4 de partidas regulares).

---

## 6. Pagos (Certificaciones)
**Propósito general:** Aquí procesas las estimaciones mensuales o bi-semanales del Contratista, cobrando por la parte de la obra que hayan construido (Ej. el "Pay Estimate #1").

**Explicación de celdas cuando añades un Recibo Nuevo:**
* **Período de Facturación (Desde y Hasta):** Las fechas que cubre la labor realizada para el pago en cuestión.
* **Porcentaje de Retención (Check-Box de Retención):** En obras públicas usualmente se le retiene un 5% al contratista de su pago en calidad de "garantía". Si esto no aplica para tu contrato particular, puedes apagar la casilla del "5%".
* **Añadir Partida Ejecutada:** Cuando vas al botón y agregas un ítem, el sistema te lista en despliegue las partidas de la (Sección 4) u Órdenes de Cambio de la (Sección 5). Seleccionas en la que el contratista dice haber trabajado.
* **Cantidad Estimada o Ejecutada:** Pones el avance constructivo del período. Ejemplo, si en todo el proyecto iba a poner 1,000 bloques, y en este mes puso 200, escribes "200".
* **Fondo de Financiación:** Para seleccionar de dónde proviene el dinero cobrado por la partida (ACT, FHWA, FEMA, CDBG-DR, entre otros).
* **Seguridad (Validador preventivo):** El sistema va restando matemática interna para asegurar que lo que pretendes "Pagar" a una partida o reclamar hoy, sumado a todo lo mes anterior, nunca supere al 100% el presupuesto legal pactado en su renglón. De sobrepasarlo, saltará una notificación.

---

## 7. Manufactura
**Propósito general:** Sirve de inventario que garantiza (con cartas oficiales del proveedor) que cierto artículo complejo (ejemplo vigas de puentes) fue manufacturado a los niveles de calidad del gobierno de Puerto Rico antes de poder instalarse o pagarse.

**Explicación de celdas:**
* **Botón Nuevo Certificado:** Abre la ficha.
* **Partida Vinculada:** Solamente te saldrán las "partidas" que en la Sección 4 les pusiste "check-mark" indicando "Requiere Certificación Manufactura". Simplemente la seleccionas y dices la "Cantidad" que se está validando.
* **Cantidad y Fecha del Certificado:** Indica de qué tamaño es el lote comprobado de dicha manufactura, y la fecha impresa en la carta del proveedor. Esto luego hace puente con la Sección 6 en la lógica matemática interna para asegurar que el contratista "NO PUEDA COBRAR PARTIDAS SIN FABRICA CERTIFICADA".

---

## 8. Materiales (Material on Site / MOS)
**Propósito general:** A veces el contratista compra o le despachan $500,000 en asfalto el día uno y es resguardado pero no se ha aplicado. Si el contrato admite cobrar el "Material Crudo depositado en el sitio", es aquí donde lo agregas para justificar un pago adelantado o amortajado del material mediante un "Total de Factura de Material On Site."

**Explicación de celdas:**
* **Partida de Contrato u OC:** Especificas de qué material estamos hablando.
* **Total Factura (MOS):** Escribes exactamente lo que dice el recibo presentado en la obra de ese material crudo. 
* **Retención "Amortizable":** A medida que en la "Sección 6 (Pagos)" cobras el proceso de colocar o instalar ese asfalto o material que tienes almacenado como *Material On Site*, el programa disminuirá tu valor y tu saldo pendiente en pantalla para garantizar que "No te paguen el material doble".

---

## 9. Cumplimiento
**Propósito general:** Un verificador para que la "Oficina de Auditoría" o el personal administrativo de control mantenga en récord que los deberes operacionales, documentarios y de carácter laboral de la compañía constructora estén sometidos al día de forma legal.

**Explicación de celdas:**
* **Botón de fila "Nuevo Registro":** Genera un renglón "Tracker" o Seguimiento de control.
* **Tipo de Documento:** Permite seleccionar si es un Estatuto de la Corporación, una Resolución del Dept de Estado, Seguros Vigentes, Carta de Declaración de Traspaso, un Contrato por Ley, etcétera. 
* **Recibido / Validado:** Fechas que certifican cuándo el contratista nos entregó dicho documento en las oficinas y cuándo el ente jurídico del proyecto le dio el "Visto Bueno".
* **Estatus:** Marca el requerimiento (Aprobado en su totalidad, Deficitario, o No lo requiere la ley actual para la entidad referida).

---

## 10. Liquidación
**Propósito general:** Aquí muere el control de la obra o se despide al personal al acabar; la parte contable final donde resuelves cuentas por pagar pendientes y se liberan las garantías millonarias retenidas.

**Explicación de celdas:**
* **Porcentaje Actual de Retención a Devolver:** Aquí indúcese si en esta etapa final el Estado procederá en liberar o condonar la devolución del pote o bolsón financiero (el 5% retenido que mencionamos durante todas las sesiones de "Pago") que se retuvo durante los años de la obra de certificación a certificación. 
* **Cargos (Penalidades):** Si el contratista sobrepasó "El número de días del contrato autorizado", esta sección hace la matemática multiplicando "Días Retrasados X Costo Penalidad del Contrato" y la detraerá del total de Balance Retención Devuelta. Tu verás los cobros como "Daños y Perjuicios por Multa".

**Cierre Final:**
El programa tomará los pagos del gobierno a través todos los años (Sección 6) los restará contra tu Costo Base (Sección 1) que sumó las Órdenes de Cambio de ampliación (Sección 5), restará Multas e integrará tus libretos retenidos, dándote el saldo final de centavo neto y preciso para certificar un cierre pulcro a niveles de estricta auditoría.

---
**NOTA DE AYUDA TÉCNICA:**
Dado que este sistema es operado mediante navegación por páginas, es cardinal tener un navegador actualizado y recordar el proceso vital del programa: *"Aplica cada Modificación guardando inmediatamente antes de transitar a una viñeta diversa sobre el plano alto"*.
