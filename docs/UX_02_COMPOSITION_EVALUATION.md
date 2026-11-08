# UX-02 — Evaluación de composición y preparación de diseño

Fecha: 2026-11-07. Autor: Codex, editor técnico. Diseño/revisión: Claude.
Estado: evaluación y dos correcciones independientes; composición sin aprobar.
Rama/HEAD comprobados: codex/ux-02-month-selector,
ae8150a1dc336d035c6e24dadbba1542792b238b. Índice vacío.
No se autoriza ni ejecuta commit, merge, push o despliegue.

## 1. Conclusión ejecutiva

La base funcional es aprovechable. La composición aún no cierra UX-02: la rueda
se estira en escritorio, los vecinos parecen texto auxiliar y la barra temporal
comparte espacio con privacidad y organización de Home. Aprobar las pruebas no
resuelve esas decisiones visuales. Recomiendo prototipar un selector compacto de
tres posiciones con transición direccional, separado de las herramientas de Home.
La ubicación de esas herramientas y la profundidad siguen siendo propuestas.

Esta entrega NO cambia la disposición, tamaños, estilos, navegación ni gráficos.
Solo corrige O3 (foco inicial en el mes seleccionado) y O4 (aviso de lint), con
sus pruebas. Claude debe diseñar el prototipo; Dirección aprueba antes de que
Codex traslade la nueva composición al producto.

## 2. Fuentes y estado técnico

Leídos: AGENTS.md, docs/WORKFLOW.md, docs/WORK_STATUS.md, docs/UX_02.md,
docs/UX_01_IMPLEMENTATION.md, docs/UX_01_TECHNICAL_EVALUATION.md, la propuesta
review-deliveries/ux-redesign/PROPUESTA.md y su prototype.html. El checklist
local encontrado es el de UX-01 A–C; no se inventa un checklist UX-02 aprobado.
Se leyó el informe independiente local completo:
review-deliveries/ux-02/corrections-2026-11-07/REVISION.md.

Claude dictamina **Approved with observations**, con H1–H9 y N1/N3 resueltos,
O1–O5 bajos y profundidad pendiente de Dirección. Eso no es aprobación visual
final ni permiso de commit. Al comenzar, Codex comparó los 25 SHA-256 de la
entrega con los archivos de trabajo: 25/25 coincidentes. Los cambios previos y
archivos ajenos se preservan; todas las entregas anteriores permanecen intactas.

Las 1012/1012, 11/11 del componente, build y lint con un aviso son de la entrega
anterior y de la revisión de Claude según sus respectivos registros. No son
nuevas ejecuciones. Tras las pequeñas correcciones de esta evaluación se han
ejecutado 12/12 del componente, lint estricto sin avisos y build: ver §9.

## 3. Decisiones originales recuperadas

| Decisión y fuente | Estado y alcance vigente |
| --- | --- |
| Propuesta §4.1: mes al frente, año diferenciado, vecinos inclinados | Parcial: el mes y año tienen dos líneas, pero el frontal ocupa casi toda la fila y los vecinos son discretos. |
| Propuesta §4.1: rueda/cilindro y desplazamiento continuo diciembre→enero | Continuidad funcional hecha; profundidad estática y entrada animada no equivalen a un recorrido circular direccional. |
| Tres controles de teclado y cuadrícula rápida de 12 meses | Hecho: anterior/central/siguiente; modal fuera del sticky. Se preserva. |
| Franja propia de unos 56px, sin solapamientos | Hecho tras H1: 56,8px medidos de nuevo; la apertura del modal no agranda la barra. |
| Propuesta: limitar a months | Sustituido por el encargo de Dirección: continuidad entre años; límite técnico YYYY-MM, no horizonte de negocio nuevo. |
| History separado del mes compartido | Hecho; inicia en el año de la primera apertura, luego conserva su propio período, búsqueda/filtros. No cambiarlo al copiar una frase o mock antiguos. |
| Períodos futuros de History | Confirmados expresamente por Dirección el 2026-11-07; no requieren nueva decisión. |
| Movimiento reducido | Implementado; la revisión anterior de Claude lo verificó. En esta auditoría no se vuelve a certificar por captura estática. |
| Rueda horizontal/trackpad de la propuesta | Diferida en la implementación actual; no se añade como efecto colateral de esta revisión. |
| UX-01: navegación flotante y Settings sin duplicar en escritorio | Hecho: a partir de1024px Settings está en el riel, no en la cabecera; en móvil está en cabecera. El mock usa otro breakpoint, no se impone sobre lo integrado. |
| Ojo global, Home options y distribución exacta del encabezado | No hay una posición final documentada/aprobada para el nuevo diseño; el encargo actual lo declara expresamente abierto. |
| Prototipo original como referencia completa | No aprobado para importar íntegro: mezcla UX-01/02/03, otras áreas de Home y datos simulados. Reutilizar solo intención temporal/tokens pertinentes. |

El prototipo muestra varias caras comprimidas a los lados y un centro compacto.
Eso ayuda a explicar la intención, pero no prueba accesibilidad, integridad ni
conveniencia de copiar doce caras. Tampoco autoriza trasladar sus gráficos,
fuentes de ingresos, botones de pago ni límites temporales a esta rama.

## 4. Auditoría visual propia: pasos y evidencia

Capturas tomadas ANTES de O3/O4, sobre los 25 archivos revisados, en Chromium del
navegador integrado, servidor local propio5204. Solo Explore the App y ejemplos
ficticios. Se guardaron e inspeccionaron las nueve imágenes aceptadas. Se
rechazaron las capturas de escritorio/prototipo recortadas y una toma de Bills
en transición; se usan las completas/estables siguientes. El viewport y
Appearance System se restauraron al terminar.

Las medidas pueden variar por scrollbars: a1280×800, frontal837,97px y control
completo922,8px; Claude había medido un frontal de aproximadamente853px. No son
mediciones idénticas, pero ambas evidencian el mismo estiramiento.

### Paso 1 — Home escritorio: funcional, jerarquía temporal pendiente

Mes y año legibles, tres áreas conservadas. El frontal parece una barra ancha,
con Nov/Jan separados en sus extremos. + Add aparece en cabecera; Settings está
en el riel. Ojo y tres puntos se alinean con la rueda y parecen parte de ella.
No se observa una duplicación de Settings en este ancho.

![1. Home escritorio actual](C:/Projects/goal-planning-app/review-deliveries/ux-02/composition-audit-2026-11-07/screenshots/01-desktop-home-full.jpg)

### Paso 2 — Home options: funciones claras dentro del menú, disparador ambiguo

El menú contiene Expand All, Collapse All y Customize Home. Son organización de
Home, no acciones temporales ni configuración general. Su proximidad al mes no
explica esa diferencia hasta abrirlo. Expand/Collapse conserva su alcance actual
sobre las partes de Home: no reinterpretarlo como ocultar las tres áreas.

![2. Menú Home options](C:/Projects/goal-planning-app/review-deliveries/ux-02/composition-audit-2026-11-07/screenshots/02-home-options.jpg)

### Paso 3 — Home móvil: compacto, vecinos poco reconocibles

A390×844 hay una fila temporal de56,8px. El mes destaca más que en escritorio,
pero Nov/Jan, pequeños y sin un indicador de acción visible, parecen etiquetas.
Ojo y Home options compiten con la lectura del período. El foco visible es una
fortaleza; no conviene resolver la percepción sacrificando nombres o44px.

![3. Home móvil actual](C:/Projects/goal-planning-app/review-deliveries/ux-02/composition-audit-2026-11-07/screenshots/03-mobile-home.jpg)

### Paso 4 — + Add móvil: acceso global reconocible y separado

El menú presenta acciones globales existentes, incluidos Add a Contribution y
Mark a Bill as Paid. No cambia al elegir un mes. Conviene preservar este acceso y
sus guardas/foco; no usarlo como contenedor de Home options ni privacidad.
Actualmente se muestra en las secciones principales; no se promete presencia
nueva en detalles/formularios donde App no lo muestra.

![4. Menú global Add](C:/Projects/goal-planning-app/review-deliveries/ux-02/composition-audit-2026-11-07/screenshots/04-mobile-add.jpg)

### Paso 5 — Cuadrícula modal: composición correcta, foco inicial mejorable

El panel no aumenta el sticky, tiene doce meses legibles y Close separado. Antes
de la corrección nueva, activeElement fue Previous year: confirma O3. La captura
no acredita el teclado virtual ni VoiceOver. La corrección técnica posterior
prioriza el mes seleccionado y retira autoFocus de Year.

![5. Modal antes de O3](C:/Projects/goal-planning-app/review-deliveries/ux-02/composition-audit-2026-11-07/screenshots/05-mobile-month-dialog.jpg)

### Paso 6 — Bills: mismo control temporal, privacidad diferenciada

Comparte December2026 con Home. La privacidad tiene texto y vive fuera de la
rueda. + Add y Add Bill no son dos instancias de idéntico menú: el segundo es un
atajo contextual. No se eliminan sus funciones en esta evaluación.

![6. Bills móvil](C:/Projects/goal-planning-app/review-deliveries/ux-02/composition-audit-2026-11-07/screenshots/06-mobile-bills.jpg)

### Paso 7 — History: alcance independiente, preservar distinciones

Period combina All time/año/mes; la variante mensual comparte MonthSwitch y el
año usa sus propios botones. La privacidad está fuera del selector. Los botones
Expand All/Collapse All de History no son Home options: no generalizar sus
callbacks solo porque coincidan los textos.

![7. History y período independiente](C:/Projects/goal-planning-app/review-deliveries/ux-02/composition-audit-2026-11-07/screenshots/07-mobile-history.jpg)

### Paso 8 — Home oscuro: consistente, misma debilidad de jerarquía

Centro y año siguen legibles, sin recuadro duplicado. El oscurecimiento por sí
solo no hace que los vecinos parezcan controles. Las sombras/depth deben
probarse en ambos temas, sin depender únicamente del color.

![8. Home oscuro](C:/Projects/goal-planning-app/review-deliveries/ux-02/composition-audit-2026-11-07/screenshots/08-mobile-dark.jpg)

### Paso 9 — Prototipo original: referencia útil, implementación no trasladable

La rueda muestra planos laterales y centro compacto. Los gráficos y la
organización distinta que aparecen debajo son contexto histórico de UX-03,
excluido del nuevo prototipo y del producto de esta entrega.

![9. Prototipo original, solo referencia](C:/Projects/goal-planning-app/review-deliveries/ux-02/composition-audit-2026-11-07/screenshots/09-original-prototype-full.jpg)

## 5. O1–O5 y qué es independiente del diseño

| Observación | Clasificación | Actuación en esta entrega |
| --- | --- | --- |
| O1: vecinos interactivos | Decisión visual ligada a profundidad/espacio | Documentada y confirmada visualmente. Proponer affordance visible persistente y estados hover/focus/pressed, sin añadir paradas de teclado. Sin CSS nuevo. |
| O2: ancho escritorio | Defecto de composición pequeño de código, pero decisión visual abierta | Confirmado. Proponer límite y centro dentro de la columna de contenido; no aplicar22rem ni alineación como si ya estuvieran aprobados. |
| O3: foco inicial | Técnica, independiente de composición | Corregida: foco al botón aria-pressed=true después de showModal; retorno al disparador conservado. Nueva regresión para febrero/enero y diciembre. |
| O4: aviso de lint | Técnica, independiente | Corregida en fuente: capturar el disparador al abrir y usar esa referencia al limpiar. ESLint excluye solo review-deliveries/**, copias históricas inmutables; src sigue comprobado. |
| O5: months sin uso | Limpieza de API, no decisión estética ni fallo actual | Confirmada. Se conserva por compatibilidad contractual; no impone límites ni se usa para cálculos. Retirada aplazada a limpieza explícita de llamadores; no borrar App.months globalmente. |

La animación actual month-arrive entra siempre con translateX(12px), incluso al
retroceder; no representa el sentido de giro. Esto procede de inspección del CSS,
no de una medición de movimiento por capturas estáticas. Es un candidato para el
prototipo, junto al tamaño del mes activo y la posición relativa de los vecinos.

## 6. Recomendación de distribución — pendiente de aprobación

Recomiendo la opción A como primer prototipo por su menor alcance técnico.
Solo hay una alternativa de ubicación porque existe una decisión real pendiente.

| Control | Opción A recomendada: herramientas de Home separadas | Opción B: privacidad en cabecera global |
| --- | --- | --- |
| + Add | Mantener cabecera y menú/guardas actuales | Igual |
| Hide/Show All Amounts | Fila de herramientas de Home, fuera de .home-month-bar; a la derecha del título Home, junto a Home options pero separados de la fecha | Un único acceso en cabecera con el estado compartido; revisar sustitución de los accesos equivalentes de Bills/History para no duplicarlos |
| Home options | Junto al título de Home, con nombre/ayuda que explique su ámbito | Igual; no convertirlo en Settings ni en menú de navegación |
| Settings | Conservar ubicación responsive integrada: riel ancho, cabecera móvil | Igual, salvo una propuesta explícita nueva de Claude aprobada por Dirección |
| Selector | Franja propia compacta, centrada en la columna útil; único elemento sticky temporal | Igual |
| Ojos individuales | Mantener en This Month, Left to Pay y Money & Goals | Igual |

A evita ampliar el contexto React de privacidad y conserva los estados de
organización dentro de HomeScreen. El coste es que ojo y Home options dejan de
estar pegados al período durante scroll: Dirección debe aceptar esa pérdida de
acceso fijo o pedir otra solución en el prototipo.

B mantiene privacidad accesible globalmente, pero puede saturar la cabecera de
320px, duplicar acciones en Bills/History y exige resolver bien su ámbito. No se
recomienda ocultarla dentro de un menú de más pasos ni mover estado persistente.

Para la rueda propongo empezar el prototipo con un ancho18–22rem en escritorio,
mes activo más presente y año subordinado, tres planos próximos entre sí y cambio
direccional corto. Son parámetros de exploración, NO especificaciones aprobadas.
En móvil el ancho se adapta sin segunda fila ni textos solapados; conservar al
menos44px en todo objetivo. No es necesario renderizar doce caras para comunicar
continuidad: probar primero tres posiciones que se desplazan en el sentido real.

## 7. Riesgos técnicos y referencias concretas

| Riesgo / decisión | Archivos y punto de integración |
| --- | --- |
| Mover el ojo a la cabecera sin contexto crea un control sin efecto | App.tsx:1010/1025/1080 monta AmountVisibilityProvider alrededor de pantallas, no de la cabecera. HomeAmountsEye consume ese contexto. B exige callbacks/contexto correcto, no copiar JSX. |
| Cambiar alcance o persistencia de privacidad | ui/amountVisibility.ts (tres HOME_AREAS y compatibilidad de nombres), ui/privacy.tsx (HomeAmountsEye/AllAmountsToggle/EyeToggle), App.tsx:835 (saveHidden y separación demo/propio). Conservar la semántica actual. |
| Home options fuera de Home pierde retorno de foco o Customize | features/home/HomeScreen.tsx:104 y234; components/MenuButton.tsx; homeLayout.ts. Conservar opcionesRef, Done y estado local, sin duplicarlo en App. |
| Ancho corregido con estilo global afecta Bills/Details | styles/finance.css:473,577,968,1113; MonthSwitch y sus seis consumidores (Home, Bills, Bill, Debt, Cards & Loans, History). Ajustar una envoltura compartida deliberada, no centrar todo main. |
| Scroll y sticky | home-month-bar/data-sticky-bar, App y reglas scroll-padding. No introducir segunda barra fija ni tapar barra UX-01A o Save/Close. |
| Animación cambia antes de que la guarda acepte | components/MonthSwitch.tsx:valor controlado/committed/onChange; App.confirmLeave y History.change/guard. Animar/anunciar el valor confirmado, sin estado paralelo del mes. |
| Cilindro complejo introduce solapamientos/hit targets | MonthSwitch y CSS: una sola acción anterior/central/siguiente, sin caras ocultas enfocables ni listeners de rueda que capturen scroll. |
| History pierde filtro independiente | features/history/historyView.ts:30 y HistoryScreen.tsx:204/215. Period de año/All time no se convierte en mes de App. |
| Retirar months de forma indiscriminada | MonthSwitch.tsx:7 y seis llamadas; App.months también alimenta otras funciones y reports. O5 no justifica cambiar esos usos. |
| Safari/iPhone y teclado virtual | dialog, pointer capture, pan-y y altura real con teclado. Las capturas Chromium no resuelven este riesgo. |

No cambian la navegación UX-01A, Details/Edit, retornos de UX-01B/C, cálculos,
Remaining Balance, Contribution, historial de payment, almacenamiento ni UX-03.

## 8. Decisiones de Dirección y encargo para Claude

1. Elegir distribución A o B; en A, aceptar o no que privacidad/opciones no sean
   sticky. No está aprobada la ubicación por el hecho de recomendarla aquí.
2. Aprobar el marco compacto, su alineación y la jerarquía mes/año después de verlo
   a320/390 y1280px, con + Add, Settings y navegación reales.
3. Elegir el grado de profundidad/movimiento a partir de un prototipo interactivo,
   incluida la variante reducida. Priorizar tres planos antes de pedir doce caras.

Encargo autónomo para Claude: docs/UX_02_PROTOTYPE_BRIEF.md. Claude prepara el
prototipo UX/UI en una carpeta nueva de review-deliveries acordada en ese brief,
sin tocar el código productivo ni los informes existentes. Juan comunica el
material y la aprobación; no se envían mensajes a otro asistente automáticamente.
Codex implementa solo después de aprobar composición y alcance concreto.

## 9. Verificación y entrega de esta evaluación

Cambios técnicos: src/components/MonthSwitch.tsx, su test y eslint.config.js.
Sin cambios de composición ni dependencias. Se ejecutaron:
- npm test -- src/components/MonthSwitch.test.tsx --maxWorkers=2:12/12,4,68s,salida0.
- npm run lint -- --max-warnings=0: salida0, sin errores ni avisos sobre fuentes actuales.
- npm run build: salida0, JS725,06kB/gzip202,74kB; aviso conocido>500kB.
- git diff --check: correcto; índice vacío.

La primera ejecución de npm run lint salió0 pero avisó sobre el componente viejo
en dos copias de entrega. Esas copias no se corrigieron ni se borraron. Se excluyó
la carpeta de snapshots en eslint.config.js; no se desactivó react-hooks/exhaustive-deps
en src. Log inicial y final preservados.

Se reutilizan las1012/1012 anteriores para el resto del contenido; NO se declara
una suite completa nueva1013/1013 ni se suman12 a1012. Por el alcance localizado de
foco/referencia y configuración de lint se repitió el componente, lint/build/diff.
Sin audit nuevo: dependencias idénticas; sin aceptación manual atribuida a Juan.
Las capturas auditadas son previas a O3/O4; el foco nuevo está probado en jsdom,
no comprobado otra vez en Safari/VoiceOver ni certificado visualmente por esas imágenes.

Paquete local, no fijo por hash:
review-deliveries/ux-02/composition-audit-2026-11-07/DELIVERY.md.
Incluye copias, diff incremental de esta revisión, logs, capturas aceptadas y huellas.
No sustituye las entregas anteriores ni anuncia UX-02 listo para commit.
