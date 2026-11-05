# UX-01 A — Floating Navigation

Fecha: 5 de noviembre de 2026. Editor: Codex.
Estado vigente: cierre técnico y aceptación manual comunicada por Dirección; véase el apartado final.
Alcance exclusivo A: navegación flotante/persistente. No incluye B/C, All Bills
arriba/búsqueda, edición rápida, rueda de meses, gráficos, Pay rápido, Undo o cuentas.

## Base y autorización

Rama comprobada: codex/ux-01-navigation.
Base/HEAD y main al iniciar: 00bae6c8407fed2aeaf5da9471eaf2d0c7833ed9.
2A.1 integrado; índice vacío y sin cambios versionados iniciales.
Se identificaron 809 archivos ajenos sin seguimiento, incluidos propuesta,
evaluación, plan y entregas. Se preservan y excluyen.
Referencias leídas: AGENTS.md, docs/WORKFLOW.md, UX_01_TECHNICAL_EVALUATION.md,
UX_01_IMPLEMENTATION.md, PROPUESTA.md y prototype.html compartidos.

La autorización cubre implementación y documentación; no integración en main.
Entrega inicial guardada en 4c670e5f56ac631062e90beca3af2f8ca935561b.
Correcciones actuales sin commit nuevo; sin push, merge ni despliegue.

## Resultado implementado

- Un solo nav con Home, Bills, Goals, Money e History; iconos SVG decorativos
  y etiquetas visibles. No carrusel ni dependencia nueva.
- Móvil/tablet: float inferior de hasta 560 px, márgenes/áreas seguras, botones
  de al menos 44 px de ancho y 56 px de alto; etiquetas envuelven si crece texto.
- Escritorio desde 1024 px: riel flotante de 184 px y reserva lateral total
  de 216 px. Logo, Help y Settings aparecen una sola vez. Altura máxima y scroll
  interno para ventanas bajas. Home conserva sus columnas existentes.
- Superficie translúcida al 96 %, blur con fallback opaco, bordes/sombra. Opacidad
  mayor que la del mock para garantizar contraste calculado sobre fondos extremos.
- Indicador seleccionado medido con ResizeObserver y transición; inclinación
  discreta solo del icono, sin mover su área táctil. Reduced motion retira
  inclinación/transiciones. Reduced transparency usa superficie opaca.
- Destinos disponibles en detalles, formularios, Settings y Help dentro del
  espacio abierto; ausentes en bienvenida/setup sin espacio.
- Estado activo como contexto de origen. Se conserva en memoria por chain/idx
  existentes de navegación, también al volver por Back/Forward tras visitar otro
  destino. No se amplía history.state ni se guarda en FinanceData.
- Clic en ese destino desde un detalle vuelve a su raíz mediante selectTab y
  confirmLeave existentes. No se evitan guardas ni se pierde borrador silenciosamente.
- Nav antes de main en escritorio y después en móvil; Skip to content y main enfocable. Botones
  nativos, aria-current=page, iconos aria-hidden, foco visible y modo forced-colors.
- Medida real de altura reserva espacio al final del shell, incluido pie/mensajes.
  Scroll-padding evita enfocar detrás de la barra. La reserva se retira al imprimir.
- VisualViewport/foco ocultan la barra con teclado y escala 1; no por foco solo
  ni por pinch zoom. Reserva medida constante, sin sumar teclado/offsetTop.
  Se liberan observadores, listeners y variables al desmontar/cambiar disposición.
- End Subscription y sus controles de 2A.1 permanecen en Bill Details.
- Navegación, guardas de datos, cálculos financieros y almacenamiento conservan
  sus implementaciones. No se editan archivos del dominio financiero.

## Archivos propios (11)

Producto:
1. src/App.tsx — disponibilidad del nav, contexto por paso, posición DOM y salto.
2. src/components/BottomNav.tsx — iconos, indicador, medidas/viewport y limpieza.
3. src/components/Icon.tsx — house, receipt e history; reutiliza target/wallet.
4. src/styles/finance.css — float/rail, capas, reserva, foco, impresión y movimiento.
5. src/styles/tokens.css — superficies/sombra/texto de nav y muted mínimo AA.

Pruebas:
6. src/FloatingNavigation.test.tsx — nuevo, nueve casos de componente/integración.
7. src/Layout.test.tsx — actualiza la expectativa antigua de ocultar nav en detalles.
8. src/App.test.tsx — nav persistente en Settings/draft/detalles.

Documentación:
9. docs/USER_GUIDE.md — descripción vigente de navegación.
10. docs/WORK_STATUS.md — coordinación y estado de A.
11. docs/UX_01_A.md — esta entrega, pruebas, límites y guion.

No se incluyen los dos documentos anteriores de planificación sin seguimiento
ni el material de review-deliveries en el futuro commit de la app.

## Comprobaciones y evidencia

Logs y estado inicial en review-deliveries/ux-01-a/implementation/.
Solo datos ficticios; no se consultó el espacio propio del usuario.

- Las seis regresiones iniciales fallaban antes; tras implementar, 6/6 aprobadas.
- Primera regresión de App/Layout/LeaveForms/Help: 115 aprobadas y tres expectativas
  antiguas fallidas que exigían ocultar nav. Se actualizaron al alcance aprobado.
- Regresión dirigida posterior: 126/126 en cinco archivos, 51,31 s.
- Nuevo caso de Back/Forward falló con contexto solo del último destino visitado;
  corregido mediante contexto por paso de navegación. Dirigida final 9/9,
  10,36 s. Sin cambios de navegación persistida ni datos.
- Se ejecuta suite completa por cambiar App y la navegación de todas las vistas.
  La primera, iniciada durante trabajo, cargó el App anterior y terminó 954/955;
  no se atribuye al producto final. La ejecución final se registra al terminar.
- Lint y build finales: salida 0. JS 717,25 kB/gzip 200,40 kB; CSS 77,27 kB/gzip
  14,45 kB. Aviso conocido JS >500 kB; no se sube umbral ni se introducen paquetes.
- npm audit --omit=optional: no completado por ENOTFOUND registry.npmjs.org.
  Sin audit fix, cambio de dependencias ni acreditación de audit limpio.
- Contraste calculado leyendo tokens reales: etiquetas inactivas al menos 6,12
  light y 8,18 dark en límites de composición con negro/blanco; foco al menos
  3,46; activo light 8,54/dark 8,61; muted light 4,82. Script contrast.mjs/log.
  Es QA numérico, no inspección de píxeles del navegador.
- Accesibilidad automatizada disponible: roles/nombres/iconos decorativos,
  único aria-current, salto al contenido, guardado/descartado protegido,
  Escape y foco del diálogo, disposición única y VisualViewport simulado.
  CSS cubre movimiento reducido, forced-colors y transparencia reducida.
  No se acredita una auditoría con axe ni pruebas de lector real.

## Limitaciones y pendientes

El servidor local arrancó en http://127.0.0.1:5178/, pero el navegador de herramientas
respondió net::ERR_CONNECTION_TIMED_OUT al abrirlo. Se informó y no se sustituyó
por una supuesta comprobación visual. No se obtuvieron capturas ni se verificaron
geometría real, superposición, zoom, Safari/iPhone, teclado virtual físico o lector.
No hay nueva validación manual de Dirección. Los tests jsdom no prueban píxeles.

El ajuste de VisualViewport exige recorrido real en Safari/iPhone, incluyendo
teclado/rotación y barras del navegador. No afirma soportar casos no probados.
Persisten el aviso de bundle y audit sin completar. La mejora no está aceptada
hasta revisión independiente y validación de Dirección.

## Revisión de Claude

Revisar disponibilidad en todas las pantallas del espacio, origen al volver por
Back/Forward, confirmLeave intacto, sincronización CSS/1024 px, altura/capas,
viewport/foco/limpieza, roles/nombres, colores/reduced motion y exclusión de B–C.
Comprobar que End Subscription no se oculta ni se modifica.
La entrega local incluirá copies/diff/evidencia y manifiesto; no es fija por commit
hasta que Dirección autorice guardarlo según WORKFLOW. No escribir sobre informes
anteriores ni preparar el índice como parte de una revisión.

## Recorridos manuales de Dirección (checklist original; aceptación registrada al final)

1. Ordenador ancho: entrar a demo; comprobar cinco etiquetas/iconos en riel,
   logo/Help/Settings una sola vez y contenido sin tapar. Recorrer todos los destinos.
2. Móvil 320/390 px y tablet: float inferior en scroll largo de History/Help/Bills;
   último botón, mensaje, pie y confirmaciones quedan visibles por encima.
3. Light/dark; reduced motion y reduced transparency: contraste/foco; sin movimiento
   cuando está reducido; sin perder etiquetas. Probar zoom/texto 200 % y ventana baja.
4. Bills → Gym Membership → Bill Details: nav visible y End Subscription accesible.
   Cambiar a Money/History sin regresar a Home. No finalizar de nuevo por esta prueba.
5. Home → detalle de factura: Home resaltado; History → Back del navegador al detalle:
   vuelve a resaltar Home; Forward: History. Repetir desde Goals y Money/deuda.
6. Edit Details: escribir Sample Membership; pulsar History. Keep Editing y Esc
   conservan campo/foco. Repetir y Discard and Leave cambia destino sin guardar.
   Verificar nombre original al volver. Comprobar también formulario de payment.
7. Teclado: Tab, Skip to content, botones con Enter/Espacio, foco sin recortes;
   lector anuncia cinco nombres y contexto actual; no lee los SVG decorativos.
8. Safari/iPhone: abrir un campo cerca del final, teclado virtual, cerrar teclado,
   rotar teléfono; nav, campo, Save/Cancel y mensajes no se superponen. Confirmar
   fondo modal por encima y foco dentro del diálogo; usar Back/Forward.
9. Bienvenida/Exit Demo: no nav del espacio cerrado. Reabrir demo y verificar
   una sola barra; tamaño de ventana cambia sin duplicar logo/Settings.
10. Impresión de Home/Bills: sin nav, enlace de salto ni reserva vacía adicional.

No se marca ninguno confirmado por una prueba automática. Dirección comunica
resultado y dispositivo/navegador de lo que pruebe.

## Resultado original propio de Codex (anterior a las correcciones)

- Suite final: npm test -- --maxWorkers=2, **955/955 en 68 archivos**, 231,28 s,
  una sola ejecución sobre el producto final. Incluye nueve pruebas nuevas de
  FloatingNavigation y las regresiones de todas las áreas.
- Dirigida de contexto final: 9/9, 10,36 s. La suite final ya la incluye.
- npm run lint y npm run build finales: salida 0.
- Contraste numérico: salida 0. Audit no completado por ENOTFOUND.
- git diff --check correcto. Índice vacío, base/HEAD 00bae6c sin commit nuevo.
- Los 809 archivos ajenos iniciales se verifican por SHA-256 y permanecen intactos.

Preparación revisable:
review-deliveries/ux-01-a/working-2026-11-05/DELIVERY.md,
con changes.diff, copies/files, pruebas y SHA256.json. Es contenido local sin
preparar, no entrega fija por commit. Tras autorización de guardado se generará
review-deliveries/ux-01-a/<hash-completo>/ con REVISION.md propio, según WORKFLOW.
No se declara revisión de Claude ni aceptación manual de Dirección completadas.


## Autorización de commit local — 2026-11-05

Dirección autoriza guardar exclusivamente los once archivos del manifiesto en
`codex/ux-01-navigation` y generar una entrega fija por hash. Este registro
sustituye el estado anterior de autorización pendiente; el hash y el estado
posterior se registran en DELIVERY.md y GIT_STATUS.md de esa entrega.
No se modifica el producto ni las pruebas: se reutilizan los resultados finales
955/955, lint, build y contraste correctos. Audit sigue sin completarse por
ENOTFOUND; no acredita una verificación satisfactoria. Permanecen pendientes
la revisión independiente de Claude y los recorridos manuales de Dirección,
incluidos Safari/iPhone, teclado virtual, lector y comprobación visual real.
No se autoriza merge, push ni despliegue.


## Correcciones tras Claude — 2026-11-05 (estado vigente)

Referencia leída: review-deliveries/ux-01-a/4c670e5f56ac631062e90beca3af2f8ca935561b/REVISION.md.
Veredicto comunicado por Claude: Approved with observations. Dirección autoriza
M1, M2/D1 y ajustes L1–L5; no integración en main. Base actual de correcciones:
4c670e5f56ac631062e90beca3af2f8ca935561b, rama codex/ux-01-navigation.

- M1: Settings y Help no seleccionan ni anuncian ninguna de las cinco pestañas.
  Los botones propios de Settings/Help en el rail anuncian su página actual.
- M2/D1: la detección existente de VisualViewport/foco oculta la barra mientras
  hay teclado (visibility, inert y aria-hidden); reaparece al recuperar altura.
  No se añade otro detector ni listeners. Se retira el listener de scroll: la
  detección usa la diferencia de alturas con escala 1, independiente de offsetTop.
  Foco solo y pinch zoom no bastan para ocultarla. Tras blur se conserva la
  ocultación hasta recuperar viewport, sin cambios de altura antes de Save/click.
  La reserva mantiene solo la altura medida de la barra, safe area y margen:
  no incorpora altura de teclado ni offsetTop. Mantener ese pequeño espacio
  constante evita alterar la longitud del documento al ocultar/reaparecer.
- L1: hover/active inclinan iconos solo con ratón fino que admite hover; la
  animación breve de selección vuelve a posición neutra también en táctil.
- L2: rail antes de main en DOM; móvil después. Sigue habiendo un solo nav y
  Skip to content para saltar al contenido. Guardas de formularios intactas.
- L3: investigado, no reproducido como detalle incorrecto tras recarga. El arranque
  real de navegación sustituye el paso por Home; no restaura el detalle ni su id.
  Cinco regresiones confirman Home visible y Home actual al arrancar desde pasos
  bill/debt/goal/emergency/new-goal. No se introduce persistencia ni se afirma
  que se restaure el detalle; el contexto en sesión y Back/Forward se conservan.
- L4: indicador sin transición hasta la primera medida/frame de montaje o cambio
  de disposición; después conserva animación de selección y reduced motion.
- L5: Back/Forward esperan el encabezado correcto mediante waitFor, sin sleep fijo.

Archivos de esta corrección (7): src/App.tsx, src/components/BottomNav.tsx,
src/styles/finance.css, src/FloatingNavigation.test.tsx, src/Layout.test.tsx,
docs/UX_01_A.md y docs/WORK_STATUS.md. Sin lógica financiera, pagos históricos,
B/C ni UX-02. End Subscription y confirmLeave conservados.

Comprobaciones propias finales: 160/160 en siete archivos, 61,04 s:
FloatingNavigation, Layout, App, LeaveForms, Help, LinksReturn y SubscriptionReview.
Se elige regresión dirigida por el alcance localizado, según WORKFLOW y la
recomendación de Claude; no se repite ni se atribuye 955/955 al contenido corregido.
La suite anterior de 955 pertenece al commit original. Lint y build finales:
salida 0. JS 717,43 kB / gzip 200,50; CSS 77,37 kB / gzip 14,50; persiste aviso
>500 kB. Diff --check correcto. Audit intentado otra vez con --fetch-retries=0:
ENOTFOUND registry.npmjs.org, salida 1; no completado, no acredita seguridad.
Primeras pruebas revelaron expectativas obsoletas de CSS y un nombre incorrecto
del botón Help; las pruebas de recarga inicialmente suponían una restauración
que el arranque no realiza. Se investigó y corrigió la prueba; no la navegación.

Pendientes reales (no confirmados por automatización):
1. Safari/iPhone: Edit Details, último campo, scroll con teclado abierto; barra
   oculta, sin saltos, errores y Save/Cancel alcanzables. Tocar Save directamente,
   sin cerrar teclado: un solo guardado, sin desplazamiento bajo el dedo.
2. Repetir con Cancel y cambios sin guardar; cerrar teclado con Done, cambiar
   campo, rotar y comprobar reaparición. Pinch zoom con campo enfocado, barra
   no ocultada por el zoom; tras cerrar teclado, cinco destinos operativos.
3. iPhone: tocar pestañas y comprobar inclinación vuelve a neutro, End Subscription
   visible, luz/oscuro, VoiceOver y navegación ausente del foco mientras oculta.
4. Escritorio: Tab desde Skip to content, rail antes de main; Enter en enlace
   salta a main. Settings/Help sin pestaña principal actual; botón propio actual.
   Redimensionar a móvil y volver: una barra, indicador sin vuelo desde esquina,
   reduced motion, Back/Forward y confirmación de borradores.
5. Recargar desde un detalle: Home visible y anunciado, sin afirmar restauración
   de detalle. Verificar comportamiento en ambos temas y con lector real.

No se ejecutó navegador real en esta fase; se conserva la limitación anterior
(timeout de acceso local), sin atribuirle nueva comprobación. jsdom no acredita
geometría real, Safari/iPhone, teclado virtual, VoiceOver ni ausencia de saltos.
Sin VisualViewport, no se detecta el teclado: queda la barra normal; requiere
validación en los navegadores objetivo. La heurística de altura requiere también
comprobación frente a barras de Safari, orientación y teclado físico.

Entrega local revisable: review-deliveries/ux-01-a/corrections-2026-11-05/DELIVERY.md.
No es entrega fija por commit. Correcciones sin preparar; nuevo commit no
solicitado en esta autorización. Pendientes revisión dirigida de Claude,
validación manual de Dirección y autorización posterior de integración.


## Cierre técnico y aceptación comunicada por Dirección — 2026-11-05

Este apartado sustituye los estados pendientes históricos anteriores. Dirección
confirma que las diez comprobaciones del checklist fueron superadas en Chrome
y Safari/iPhone. Es aceptación comunicada por Dirección, no ejecución manual de
Codex. No se aportaron versiones ni un desglose por navegador para cada paso;
no se atribuyen pruebas adicionales a esa confirmación.

| # | Comprobación del checklist | Resultado comunicado |
| --- | --- | --- |
| 1 | Ordenador: cinco destinos, rail, controles únicos y contenido accesible | Confirmada por Dirección |
| 2 | Móvil/tablet: barra inferior, scroll y último contenido accesible | Confirmada por Dirección |
| 3 | Temas, movimiento/transparencia reducidos, zoom y ventana baja | Confirmada por Dirección |
| 4 | Bill Details, End Subscription y cambio directo de sección | Confirmada por Dirección |
| 5 | Contexto de origen y Back/Forward | Confirmada por Dirección |
| 6 | Formulario editado, Keep Editing/Escape y descarte confirmado | Confirmada por Dirección |
| 7 | Accesibilidad de teclado, salto al contenido y nombres según checklist | Confirmada por Dirección |
| 8 | Safari/iPhone: teclado, cierre/rotación, Save/Cancel, diálogo y navegación | Confirmada por Dirección |
| 9 | Entrada/salida de demo y navegación única al cambiar tamaño | Confirmada por Dirección |
| 10 | Impresión sin barra ni hueco adicional | Confirmada por Dirección |

Última revisión leída: corrections-2026-11-05/REVISION.md, Claude:
Approved with observations, sin bloqueantes. Sus 160/160 y comprobaciones
Chromium son resultados declarados por Claude, distintos de los de Codex.

O1: se añade protección mínima en la detección existente:
keyboardOpen solo si gap > max(120 px, 15 % de innerHeight), con editable o
retención del estado y escala 1 como antes. El scroll correctivo también depende
de keyboardOpen. Sin listeners nuevos ni cambios de reserva. Ocho casos nuevos
cubren 0,5 px, 80 px, límites de 120/240 px, huecos reales de 300 px, altura
proporcional, blur y recuperación con residuo fraccionario. Así no queda oculta
por redondeo residual. Heurística, no identificación universal de teclados.

O2: Dirección confirma expresamente la identificación visual de Settings y Help
en escritorio. Se conserva aria-current y ninguna pestaña principal seleccionada.
Se incorpora además estilo explícito de página actual con los tokens selected /
selected-text existentes y contorno en forced-colors; no se cambia la paleta.
Esta pequeña modificación y el umbral O1 son posteriores a la aceptación manual:
no se afirma una nueva ejecución de Dirección sobre ellos ni una nueva revisión
independiente de Claude sobre el commit final.

Verificación propia nueva: FloatingNavigation + Layout, 26/26, 18,13 s; lint y
build correctos, diff --check correcto. Se reutilizan las otras regresiones
previas de alcance no alterado (160/160 en siete archivos de Codex), sin sumar
los resultados ni atribuir 160 o 955 como nueva suite completa. Se ejecuta la
regresión dirigida que recomendó Claude para O1/O2. Dependencias y colores no
cambian: audit previo ENOTFOUND sigue no completado; contraste previo vigente
para tokens reutilizados, no una nueva medición de navegador.

Observaciones residuales: O3 (primer frame del indicador) queda como precaución
baja dependiente de motor; no se introduce doble rAF preventivo ni se declara
una prueba adicional específica. Sin VisualViewport no se detecta teclado;
teclados flotantes o muy pequeños pueden no superar el umbral. No se certifican
navegadores/dispositivos/versiones no comunicados ni audit satisfactorio. Persiste
el aviso de bundle >500 kB. No hay bloqueantes técnicos identificados.

Dirección autoriza commit final y entrega fija, no merge ni push. Se conservan
los siete archivos de corrección dentro del manifiesto original de once; los
ajenos siguen excluidos. Hash final, ruta fija y comprobación byte a byte se
registran en DELIVERY.md/GIT_STATUS.md para evitar autorreferencia del commit.
Estado: preparado para aprobación de integración en main; aún no integrado.
Siguiente entrega acordada UX-01 B — All Bills y búsqueda, según
UX_01_IMPLEMENTATION.md, sin implementarla ni cambiar prioridades en este cierre.


## Integración autorizada de UX-01 A — 2026-11-05

Dirección autoriza integrar el commit aprobado
`f37e422ced44e0bc42689871a38aa891134a185a` y ejecutar push de main.
Entrega fija verificada: once archivos exactos del alcance, copias y diff
coincidentes con Git y SHA-256 correctos. Integración por fast-forward desde
`00bae6c8407fed2aeaf5da9471eaf2d0c7833ed9`, sin conflictos. Este registro
documental de cierre no cambia el producto aprobado. Se reutilizan las pruebas
vigentes: 26/26 finales para O1/O2 y regresiones anteriores de 160/160 para
alcance no alterado; lint/build correctos. No hay nueva suite ni prueba manual.

Revisión de Claude aprobada con observaciones no bloqueantes; diez recorridos
Chrome y Safari/iPhone confirmados por Dirección. O1/O2 resueltas; O3 permanece
como precaución menor del primer frame entre motores, sin declararla corregida.
Persisten la heurística del teclado, el audit no completado por ENOTFOUND y
el aviso de bundle >500 kB. Archivos ajenos preservados y excluidos.

El hash final de cierre (que añade solo este registro y WORK_STATUS/UX_01_A),
resultado del push y comparación local/remota se registran en
`review-deliveries/ux-01-a/integration-2026-11-05/CLOSURE.md`. No se confunde
push con publicación: Cloudflare Pages no se considera verificado por el push.
UX-01 B — All Bills y búsqueda es la siguiente entrega según el plan local
UX_01_IMPLEMENTATION.md; su base será el nuevo main sincronizado. No se
implementa B ni se incluyen archivos ajenos del plan como parte de este cierre.
