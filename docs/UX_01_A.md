# UX-01 A — Floating Navigation

Fecha: 5 de noviembre de 2026. Editor: Codex. Revisor pendiente: Claude.
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
Sin commit, push, merge ni despliegue de UX-01 A.

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
- Nav después de main en DOM; enlace Skip to content y main enfocable. Botones
  nativos, aria-current=page, iconos aria-hidden, foco visible y modo forced-colors.
- Medida real de altura reserva espacio al final del shell, incluido pie/mensajes.
  Scroll-padding evita enfocar detrás de la barra. La reserva se retira al imprimir.
- VisualViewport ajusta la posición sobre su borde visible mientras hay campo
  editable y escala 1; no oculta por foco solo ni confunde pinch zoom con teclado.
  Si hace falta, desplaza el campo al área visible. Sin VisualViewport conserva
  float/reserva y scroll normales. Se liberan observadores, listeners y variables
  al desmontar/cambiar disposición.
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

## Recorridos manuales de Dirección (pendientes, datos ficticios)

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

## Resultado final propio de Codex

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
