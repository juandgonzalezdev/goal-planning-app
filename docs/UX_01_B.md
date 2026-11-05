# UX-01 B — All Bills y búsqueda: correcciones tras Claude

Estado vigente: N1 corregido; commit fijo autorizado, pendiente de revisión final
y validación manual de Dirección. Editor Codex, 2026-11-05. No commit ni integración nuevos.

## Base, referencias y alcance

Rama codex/ux-01-b-all-bills, HEAD/main
868ab7b983e19b49cdc2244c8ebfe5ba9d1c2777, con UX-01 A integrado. Índice vacío.
AGENTS.md, docs/WORKFLOW.md y WORK_STATUS.md consultados. Plan y evaluación:
UX_01_IMPLEMENTATION.md y UX_01_TECHNICAL_EVALUATION.md; propuesta §5.
Revisión leída: review-deliveries/ux-01-b/working-2026-11-05/REVISION.md.
Claude: Approved with observations; declaró 182/182 pruebas dirigidas y medidas
Chromium a 375×812 en la versión previa. No son ejecuciones de Codex ni pruebas
sobre estas correcciones. Dirección amplía expresamente la búsqueda a ambas
vistas y nombre/categoría; sustituye la limitación anterior de alcance.

Solo UX-01 B. Sin UX-01 C, selector 360°, gráficos nuevos, Pay/Undo, cambios de
payments, reglas financieras, modelos de datos, almacenamiento o dependencias.
Las entregas/informes anteriores y los documentos locales ajenos se conservan.

## Resultado y respuesta a O1–O5

- O1: filas All Bills conservan categoría y frecuencia en una línea secundaria
  que envuelve: Utilities · Monthly · Due day 12. Nombre/importe usual/estado y
  fechas conservados. Usa min-width:0 y overflow-wrap existentes; no se recorta
  información ni se introduce scroll horizontal intencionado.
- O2: filtro mensual anunciado como Show bills by payment; filtro general como
  Show bills by status. ValidityFilterBar acepta nombre accesible opcional;
  Income y otros usos conservan su nombre anterior. Estados Active/Upcoming/Ended
  siguen referidos a hoy/demo, no al Paid/Pending del mes seleccionado.
- O3: contador visible y asociado mediante aria-describedby, con aria-live=off
  y sin role=status. Se consulta junto al campo o al recorrer el contenido;
  no hay anuncios programados por carácter, temporizadores ni debounce de lista.
  Confirmar comportamiento real con VoiceOver/NVDA en validación manual.
- O4: un solo Search bills, placeholder Name or category, encima de ambas
  vistas. Coincidencia literal por nombre o categoría, sin mayúsculas, marcas
  diacríticas NFD ni espacios exteriores de consulta. Sin regex ni HTML.
  This Month filtra Calendar y List después del filtro de pago; All Bills combina
  búsqueda con vigencia. Totales, conteos de filtros y tabla de impresión usan
  colecciones completas como antes; el contador muestra solo coincidencias.
- O5: misma consulta al cambiar This Month/All Bills y al volver de Details.
  Al llegar a otra sección principal (Home/Goals/Money/History) se limpia solo
  query. Volver a Bills conserva scope, modo, mes, filtros y día. La limpieza
  sucede tras navegación efectiva, no antes de confirmar descarte. Settings/Help
  y Details no se tratan como otra sección principal ni eliminan la consulta.

MonthSwitch, Calendar/List, Hide All Amounts, filtros de pago y vigencia, acciones
mensuales y End Subscription conservados. scope/query son solo BillsView en
memoria; resets y retorno de demo usan el objeto existente completo. Inicio por
defecto This Month; All Bills muestra todos los estados al entrar por primera vez.

La selección del día se calcula sin aplicar la búsqueda: no cambia de día al
escribir. Si un formulario mensual modificado desaparecería por la búsqueda o
cambio de scope/filtro, confirmLeave pide conservar o descartar antes de hacerlo.
Show All de la factura recién añadida puede limpiar búsqueda/filtro si la ocultan.
Accesos desde Home y + Add → Mark a Bill as Paid siguen eligiendo This Month.
Regreso de Details conserva returnKey/foco/scroll existentes; si no está la fila,
la alternativa existente es calendario/encabezado. Sin navegación nueva de C.

## Manifiesto acumulado (15 archivos)

- src/App.tsx
- src/features/bills/BillsScreen.tsx
- src/features/bills/AllBills.tsx
- src/features/bills/billsView.ts
- src/components/ValidityFilterBar.tsx
- src/styles/finance.css
- src/BillsSearch.test.tsx (nuevo)
- src/BillsCalendar.test.tsx
- src/LeaveForms.test.tsx
- src/MoneyBlocks.test.tsx
- src/MoneyHub.test.tsx
- src/features/bills/SubscriptionReview.test.tsx
- docs/USER_GUIDE.md
- docs/UX_01_B.md (nuevo)
- docs/WORK_STATUS.md

Las pruebas existentes conservan sus aserciones funcionales; se adaptan nombres
de grupos y el antiguo FoldBlock al selector. Ningún archivo del dominio ni de
persistencia cambia. Las regresiones nuevas incluyen un payment histórico real
dentro de los datos ficticios y comparan datos, historial y totales antes/después.

## Verificación y límites

Regresión dirigida previa al cierre: 103/103 en cuatro archivos. Dirección pide
repetir toda la suite antes del commit fijo; resultado final se registra al final.
No se atribuye 976/976 a la versión anterior: fueron 973/976, con tres expectativas
viejas corregidas después. Claude declaró 182/182 sobre aquella versión.

Intento propio de navegador integrado: Vite arrancado en puerto 5190; apertura de
http://127.0.0.1:5190/ falló con ERR_CONNECTION_TIMED_OUT. No se ejecutaron medidas
actuales ni capturas ni se certifica ausencia de desbordamiento en esta versión.
Las medidas Chromium anteriores de Claude no sustituyen esta comprobación.
Sin Safari/iPhone, teclado virtual ni lector real nuevos; todos los recorridos de
B permanecen pendientes de Dirección. La aprobación manual de A no se traslada.

Tokens/estilos de foco existentes, campo de 16 px y alto 44 px, Clear y selector
con alto mínimo 44 px; flex-wrap y min-width:0 en búsqueda. Categorías/nombres
largos envuelven en filas existentes. Validar a 320/375/390 px y zoom grande,
light/dark y reduced motion. Sin paginación ni medición de colecciones masivas.
Audit previo ENOTFOUND permanece no completado; no hay cambios de dependencias.

## Recorridos manuales prioritarios (datos ficticios, todos pendientes)

1. Chrome escritorio y Safari/iPhone: selector y Search bills al inicio. Escribir
   nombre y categoría (Café Service/cafe, Subscriptions), alternar ambas vistas:
   consulta conservada, coincidencias correctas y categoría/frecuencia visibles.
2. Calendar y List: query sin coincidencias y combinado Paid/Pending/All; cambiar
   mes y volver. Misma selección de día/modo/mes. Planned/Paid/Left to Pay no
   cambian al escribir, ni se altera ningún payment.
3. All Bills: Active/Upcoming/Ended/All y consulta simultáneos. Encontrar una anual
   finalizada, abrir Details, Back recupera consulta/filtro/foco. End Subscription
   accesible en una activa, sin ejecutarlo para este recorrido.
4. Clear vacía y enfoca campo; texto literal [.* no provoca error. Contador visible
   y disponible al lector, sin anuncios repetidos por cada carácter. Revisar nombres
   distintos de grupos de pago y de vigencia mediante lector/teclado.
5. Con búsqueda y filtros elegidos, pasar a Home/Goals/Money/History y volver a
   Bills: solo búsqueda limpia. Desde Details/Settings/Help, consulta conservada.
6. Amount en edición con cambios: búsqueda que oculte la fila y cambio de scope
   piden confirmación. Keep Editing/Escape conserva campos y consulta anterior;
   Discard and Leave permite salir sin guardar. Repetir formulario de payment.
7. 320/375/390 px y texto/zoom grandes: verificar scrollWidth <= clientWidth,
   categorías/nombres largos envueltos, Clear y filtro alcanzables, último resultado
   visible. Ambos temas, rotación y teclado virtual; barra A oculta/reaparece sin
   tapar campos/acciones. Tab/Enter/Espacio, foco visible y orden lógico.
8. + Add → Mark a Bill as Paid y Planned Bills de Home abren This Month; no pagar.
   Impresión de ambas vistas contiene tabla mensual completa, sin búsqueda/nav.
   Colección vacía conserva mensaje y Add Your First Bill.

## Entrega y autorización

Preparación revisable:
review-deliveries/ux-01-b/observations-2026-11-05/DELIVERY.md.
Claude escribe únicamente REVISION.md en esa carpeta tras aviso de Juan. Codex
no crea ni modifica su informe. Paquete local sin commit, no entrega fija por hash;
pendientes revisión dirigida, manual y autorización de commit/integración.


## Resultados finales propios de Codex — 2026-11-05

- npm test -- --maxWorkers=2: **980/980**, 69 archivos, 234,89 s, salida 0
  (full-final.log). Ejecución completa sobre el producto corregido, conforme
  a petición expresa de Dirección; sustituye el estado anterior de 973/976.
- Regresión dirigida previa: 103/103 en cuatro archivos, 40,69 s; incluida en
  la completa. No se suman ambas ejecuciones.
- npm run lint y npm run build finales: salida 0. JS 719,46 kB/gzip 200,99;
  CSS 77,98 kB/gzip 14,61. Aviso JS >500 kB vigente.
- git diff --check correcto. Audit previo no completado por ENOTFOUND,
  reutilizado porque no cambian dependencias; no se acredita satisfactorio.
- Primeras comprobaciones detectaron una comparación redundante de tipos en
  App y una expectativa antigua de persistencia tras Home; corregidas antes
  de la completa final. Los logs intermedios se conservan con su resultado.

Quince archivos acumulados de UX-01 B, copias y diff locales verificados, índice
vacío y main intacto; ajenos conservados por SHA-256. Preparación sin commit,
no fija por hash. Pendientes revisión dirigida, validación manual y aprobación
posterior de commit/integración. Sin merge, push ni despliegue.


## N1 — corrección final y commit fijo autorizado

Revisión leída: review-deliveries/ux-01-b/observations-2026-11-05/REVISION.md.
Claude declara O1–O5 resueltas, Approved with observations; sus 170/170 y
medidas Chromium a 320 px son comprobaciones del revisor, no de Codex.
Dirección exige corregir N1 y autoriza commit fijo; no merge ni push.

Cambio mínimo: la rama payment de + Add en App.tsx añade query vacía al mismo
setBillsView que ya elige This Month, List y Pending. O1–O5 y búsqueda normal
entre scopes no cambian. No se altera la navegación/foco existente: desde Bills
el foco puede quedarse en Add; no se implementa movimiento nuevo al primer pago.

Seis casos de regresión: desde This Month y All Bills, consultas zzz (sin
resultados), cafe (nombre parcial) y Utilities (categoría parcial). Dos facturas
pendientes y una ya pagada en el mes, más un payment histórico. Tras el atajo,
query vacía, This Month/List/Pending y exactamente ambos Mark as Paid visibles,
excluyendo la factura ya pagada; datos y actividad histórica sin cambios.
Antes del arreglo fallaban los seis por consulta retenida. Una primera versión
de la prueba añadió una expectativa de foco ajena al cambio mínimo; se retiró
sin ampliar código. Las primeras ejecuciones amplias se interrumpieron y no se
presentan como resultados finales. Se ejecutan nueva, dirigida y completa finales.

Observaciones de aceptación manual, expresamente pendientes:
- N2: escribir una búsqueda que oculta un formulario mensual modificado abre
  Leave without saving?; Keep Editing descarta el carácter y conserva borrador.
  La guarda se mantiene intacta; evaluar la experiencia en manual, no resuelta.
- VoiceOver/O3: contador sin región viva; el usuario debe releer campo/contenido
  para conocer resultados. Pendiente comprobar que esa interacción sea adecuada.
- Chrome/Safari iPhone: N1 con zzz y consultas parciales, sin registrar pagos;
  comprobar lista completa y conducta de foco existente, filtros y totales.
  Permanecen pendientes temas, teclado real y zoom/anchos del guion.

No se atribuyen manuales nuevos ni resolución de N2/VoiceOver. Se conservan
limitaciones de audit ENOTFOUND, aviso de bundle y navegador local.
Manifiesto acumulado sigue siendo de quince archivos. El commit autorizado
y su hash definitivo, diff completo, copias del contenido versionado y estado
Git se documentan en review-deliveries/ux-01-b/<hash>/DELIVERY.md y GIT_STATUS.md
para evitar autorreferencia del commit. Se conserva cada entrega anterior.


## Verificación final N1 y autorización de guardado — 2026-11-06

- Nueva regresión: 6/6 (once pruebas ajenas al filtro omitidas), 8,97 s.
- Dirigidas afectadas: 176/176 en ocho archivos, 78,68 s.
- Suite completa final: **986/986**, 69 archivos, 232,44 s, salida 0.
- Lint/build finales: salida 0. JS 719,47 kB/gzip 201,00; CSS 77,98 kB/gzip
  14,61. Diff --check correcto; aviso >500 kB permanece.

Resultados propios de Codex, incluidos unos en otros, no se suman. Logs de
reproducción y finales se incorporan a la entrega por hash. Suite ejecutada de
nuevo por petición expresa de Dirección. Audit previo ENOTFOUND sigue no
completado, sin atribuirle resultado satisfactorio.

Commit autorizado exclusivamente de los quince archivos del manifiesto.
N1 cambia una línea funcional de App; regresión y documentación actualizadas.
Resto de archivos revisados O1–O5 preservados. Snapshot fijo extraído de git show
y verificado contra contenido versionado, con cambios completos base..final.
Hash y ruta exactos se registran externamente en DELIVERY.md/GIT_STATUS.md.
Pendientes revisión final de Claude y validación manual, especialmente N2 y
VoiceOver, que siguen observaciones de aceptación sin resolver por este commit.
Sin merge ni push; main permanece en la base aprobada de UX-01 A.
