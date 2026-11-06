# UX-01 C — Details & Edit

Fecha: 2026-11-06. Editor Codex; revisor Claude. Base comprobada:
b4190ba67b55f4e92da2a391f30204b576f0f68c; rama codex/ux-01-c-details-edit.
Entrega local sin commit, no fija por hash. Sin preparar, merge, push ni despliegue.

## Cambios y contraste con el plan

UX_01_IMPLEMENTATION §4 C y §6: Edit Details visible en cabecera; All Bills ofrece
Edit directo como botón hermano del acceso al detalle, sin controles anidados.
Se reutiliza BillForm, su validación y guardas; no se crean rutas nuevas.
List abre Details desde el nombre y elimina su botón Details repetido; conserva
Change Amount mensual y Mark as Paid para no eliminar funciones ni ampliar a Pay rápido.
Calendar y sus accesos conservados. Historial de importes desplegable nativo;
History de payments, estados, End Subscription y ayudas críticas intactos.
Al abrir Edit desde Details se consulta la guarda de los formularios abiertos.
El foco entra en Bill name y vuelve a Edit Details tras Cancel/Save; Back restaura
búsqueda, filtros y foco en el Edit de All Bills. Objetivos nuevos de 44 px,
cabecera adaptable y estilos con tokens actuales. Sin fórmulas, almacenamiento,
modelos, dependencias, UX-02 ni UX-03.

F1: petición explícita de foco al primer Mark as Paid incluso si ya se está en
Bills. Seis regresiones existentes ampliadas (dos scopes y tres consultas).

## Manifiesto

- src/App.tsx
- src/features/bills/AllBills.tsx
- src/features/bills/BillsScreen.tsx
- src/features/bills/BillScreen.tsx
- src/styles/finance.css
- src/BillsSearch.test.tsx
- docs/UX_01_C.md
- docs/WORK_STATUS.md

## Comprobaciones propias

Resultados finales se registran en DELIVERY.md de esta entrega. Las 20/20 dirigidas
incluyen edición directa, conservación de búsqueda/foco, guarda de importe y
navegación flotante con borrador, guardado y seis comprobaciones F1. Primera
fixture copiada tenía debtId incompatible: se corrigió únicamente la fixture.
Una expectativa amplia encontró dos botones tras añadir Edit: se precisó.
No se atribuyen resultados manuales de A/B a C.

## Recorridos manuales pendientes de Dirección

Usar datos ficticios (Sample Service), Chrome y Safari/iPhone, claro/oscuro,
320/390 px y zoom 200 %, teclado y VoiceOver:

1. Bills List: tocar el nombre abre Details; Back devuelve búsqueda, mes, filtro,
   scroll y foco. Probar también Calendar desde chip y panel del día.
2. All Bills con búsqueda y filtro: Edit abre el mismo formulario directamente;
   Cancel devuelve Details, Edit Details tiene foco; Back devuelve All Bills y Edit.
3. Cambiar nombre y Save Changes: detalle actualizado, foco en Edit Details;
   Back conserva contexto. Reabrir Details y comprobar datos del mismo bill.
4. Modificar nombre y pulsar Home en navegación flotante o Back del navegador:
   Keep Editing conserva; Discard and Leave sale. Cancel explícito descarta.
5. En Details modificar importe mensual o formulario Mark as Paid; Edit Details
   pregunta antes de cerrar el borrador. Keep Editing conserva los campos;
   Discard and Leave abre Edit sin borrador oculto. Repetir con usual amount.
6. Payment, Mark as Not Paid, cambios de mes y usual amount siguen disponibles.
   Amount history despliega importes anteriores. History mantiene payments.
7. Suscripción: End Subscription visible y funcional; Cancel conserva suscripción.
   Comprobar ayudas de integridad y acceso a card/loan asociado.
8. Desde Bills, + Add → Mark a Bill as Paid limpia consulta y enfoca el primer
   pendiente; repetir desde otra sección y sin pendientes (encabezado de fallback).
9. Pantalla estrecha, nombre largo, teclado virtual, texto grande: botones sin
   solaparse con navegación flotante; Tab/Enter, foco visible y lector coherentes.

Sin navegador real ejecutado por Codex; geometría, Safari/iPhone, teclado virtual
y VoiceOver siguen pendientes. Bundle >500 kB conocido. Audit no completado por
ENOTFOUND registry.npmjs.org, no se acredita limpio. Claude debe revisar el diff,
las guardas, el estado inicial de edición y foco/retorno. Pendiente autorización
de commit para generar entrega inmutable según WORKFLOW.

## Registro de verificación

Lint y build finales correctos (JS 720,24 kB, gzip 201,24 kB); aviso conocido
>500 kB. git diff --check correcto. npm audit intentado: ENOTFOUND, no completado.
Dirigidas BillsSearch: 20/20, 16,84 s antes de sustituir el botón Details repetido
por el nombre; la suite completa final incluye ese último cambio.
Una ejecución completa iniciada durante la implementación terminó 981/989:
ocho fallos de BillsSearch en una versión intermedia de fixture/expectativas/foco,
posteriormente corregidos. No se presenta esa ejecución como estado final.
No se suman resultados dirigidos y completos.

Resultado final propio: **989/989 pruebas, 69 archivos, 235,34 s**, salida 0,
sobre el código final, incluido el nombre que abre Details. Lint/build finales y
git diff --check correctos. Este resultado sustituye la ejecución intermedia.

## C1–C3 — correcciones autorizadas tras revisión (2026-11-06)

Claude emitió Changes requested en working-2026-11-06/REVISION.md, leído por
Codex. C1: App consume la intención de Edit mediante callback estable cuando
BillScreen la lee al montar. La edición abierta conserva su estado local; volver
del préstamo o por historial no reutiliza la intención. No se cambian las guardas.
C2: comentario de dueDate recolocado y documentación propia de initiallyEditing.
C3: retirada la línea en blanco no relacionada de la primera prueba BillsSearch.
F1 y el resto de UX-01 C conservados. Sin dominio, historial ni persistencia.

Cuatro nuevas regresiones con Small Loan ficticio: Cancel → préstamo → Back,
Save → préstamo → Back, apertura normal → préstamo → Back, y Back/Forward del
navegador después de Edit seguido del mismo recorrido vinculado. Con fixture
válida, antes de corregir fallaron tres y pasó el control normal; después 4/4.
Se comprueba ausencia del formulario al volver y datos de entrada intactos.
La prueba previa de guardado con cambio de nombre y guarda de navegación sigue
vigente. Añadir estos cuatro recorridos a los manuales 2–4; no hay confirmación
manual nueva de Codex ni de Dirección. El navegador de la revisión anterior fue
Chromium de Claude, sin extenderlo a Safari/iPhone o lector.

Dirección autoriza el commit y entrega fija de los ocho archivos del manifiesto.
Sin merge ni push. El hash, verificaciones finales y ruta de revisión dirigida
C1–C3 se registran en DELIVERY.md/GIT_STATUS.md de la entrega fija por hash.
El estado local sin commit de los apartados anteriores es histórico.

Verificación adicional: una ejecución completa aprobó 993/993; la siguiente
terminó 992/993 por una espera heredada en History.test.tsx. Se investigó: el
helper backToTabs esperaba la navegación, que desde UX-01 A también está en
Details, y permitía comprobar Search antes de volver a History. Se espera ahora
el heading History. Solo se corrige la sincronización de la prueba; producto
sin cambios. History aislado había pasado 23/23, sin usarlo para ocultar el fallo.
Se añade src/History.test.tsx al manifiesto: **nueve archivos finales**, sustituyendo
las referencias anteriores a ocho para este commit autorizado. Suite completa,
lint/build y diff se verifican de nuevo sobre el contenido final.

Verificación final propia de C1–C3: suite completa **993/993**, 69 archivos,
236,82 s, salida 0, sobre código/pruebas finales. Dirigidas anteriores 157/157
más SubscriptionReview 15/15 y C1 4/4; incluidas en la completa, no se suman.
Lint/build finales correctos, JS 720,34 kB/gzip 201,34 kB; git diff --check correcto.
Primer lint detectó dependencia setBillEdit del callback, corregida. No se
repitió audit: dependencias intactas y resultado previo ENOTFOUND no completado.
Persisten aviso bundle >500 kB y manuales pendientes. Se autoriza y prepara
commit solo de los nueve archivos; main y remoto sin modificar.

## Mejora adicional: inicio al seleccionar navegación principal (2026-11-06)

Dirección autoriza una mejora acotada antes del cierre, con nuevo commit y entrega
fija independientes. Base: 9aaa1e921c3bac38057c7a882195d30217e00c1a. La entrega
anterior se conserva íntegra; no se sobrescribe ni se amplía su alcance aprobado.

Seleccionar Home/Bills/Goals/Money/History desde float o rail lleva al inicio del
documento tras confirmar la salida. Cambiar de sección enfoca su encabezado con
preventScroll y hace scroll inmediato. Reseleccionar la pantalla principal activa
solo desplaza suavemente, sin navegación, recarga ni cambios de foco/formulario.
Con prefers-reduced-motion el desplazamiento es inmediato. Seleccionar la pestaña
de origen desde un detalle sigue siendo una salida protegida, no una reselección.
No se añaden resets de mes, filtros ni datos. Se conserva el comportamiento de
búsqueda de B al cambiar de sección, sin introducir otro cambio en esos estados.

Contenedor comprobado por inspección de CSS: shell y shell-main crecen con el
documento (app.css:13/33); main no tiene altura limitada ni overflow propio.
finance.css reserva scroll-padding en html; el overflow-y auto de escritorio
(finance.css:944) corresponde al rail, no a main. La ejecución usa el contenedor
que informa document.scrollingElement, con documentElement como fallback, y no
lee window.scrollY para decidir ni para realizar este nuevo desplazamiento.
Las regresiones modelan ese elemento independientemente del scroll de window.
No se acredita una nueva medición de layout en navegador real.

El efecto consume únicamente peticiones explícitas de selectTab, después del
render de destino y del efecto existente de foco. Si la guarda se cancela no hay
petición ni scroll. Back y enlaces contextuales conservan su restauración. La
selección explícita de History desde Money ahora enfoca el encabezado y empieza
arriba; el test de esa selección se actualiza. Los tests separados de Back a
cuenta/préstamo/History mantienen el retorno al registro.

Manifiesto de esta mejora (cinco archivos, diff desde 9aaa1e9):
- src/App.tsx
- src/NavScroll.test.tsx (nuevo)
- src/LinksReturn.test.tsx
- docs/UX_01_C.md
- docs/WORK_STATUS.md

Regresiones nuevas: siete casos, float/rail, las cinco secciones, reselección con
y sin movimiento reducido, mes/búsqueda/vista/datos intactos, historial sin paso
nuevo y foco conservado; salida con borrador, Keep Editing sin scroll y Discard
con scroll. Primeras dirigidas detectaron expectativa anterior de foco de History
y título Our Goals de la fixture; expectativas adaptadas, sin cambiar producto
para ellas. Dirigidas finales 96/96 en seis archivos, 41,92 s, incluidos C1/F1,
Back, formularios y navegación. No se suman con la suite completa.

Guion manual adicional pendiente de Dirección, con datos ficticios:
1. Móvil y escritorio: bajar en cada sección, elegir otra y comprobar inicio y
   encabezado accesible; mes/filtros siguen el comportamiento vigente.
2. Bajar en Bills con mes y filtro seleccionados: pulsar Bills de nuevo; subir
   suavemente, sin recarga, mismo mes/filtro/búsqueda, foco en el control pulsado.
3. Activar movimiento reducido y repetir: ir arriba sin animación.
4. Editar una factura, bajar y pulsar Home: Keep Editing no desplaza ni borra;
   Discard and Leave lleva arriba de Home. Repetir con teclado/VoiceOver.
5. History → préstamo/cuenta → Back: mismo registro/foco/posición; seleccionar
   History explícitamente desde Money: encabezado y comienzo de History.
6. Safari/iPhone, claro/oscuro y zoom: comprobar movimiento, foco y safe areas.

Sin finanzas, almacenamiento, historial de payments, dependencias ni UX-02/03.
F1 y consumo único C1 conservados. Resultados finales y hash en la nueva entrega.

Verificación final propia de la mejora: **1000/1000**, 70 archivos, 242,80 s,
salida 0; suite npm test -- --maxWorkers=2. Dirigidas 96/96 incluidas, no se suman.
Lint/build/diff finales correctos. JS 720,89 kB/gzip 201,51 kB, aviso conocido
>500 kB. Audit previo ENOTFOUND no completado reutilizado sin dependencias nuevas.
Sin navegador real nuevo ni aceptación manual atribuida. Nuevo commit autorizado
de los cinco archivos; entrega fija incremental por hash, sin merge/push.

## Cierre e integración autorizados de UX-01 C — 2026-11-06

Estado vigente que sustituye los pendientes históricos de revisión y aceptación.
Dirección aprueba integrar 2aefc47a4f06742e743d92ad865beeec46f4fe88 y push de main.
Codex verifica el commit y las dos entregas fijas (9aaa1e9 y 2aefc47): manifiestos,
SHA-256 y copias contra blobs de Git; diff incremental idéntico al de Git.
Main, origin/main y remoto directo estaban en b4190ba67b55f4e92da2a391f30204b576f0f68c.
Integración fast-forward hasta el aprobado, sin conflictos ni archivos ajenos.

Revisiones de Claude leídas: C1–C3 Approved en 9aaa1e9; navegación Approved with
observations, sin defectos nuevos en 2aefc47. Sus pruebas y casos Chromium son
del revisor, no ejecuciones nuevas de Codex. Dirección comunica validación manual
de Details/Edit, guardado, cancelación, cambios sin guardar, navegación vinculada,
historial de importes, scroll, Back, movimiento reducido, filtros de History y
VoiceOver en Safari/iPhone. Se registra esa confirmación, sin extenderla a otras
plataformas, versiones, temas o recorridos no indicados.

O1 decidido por Dirección: History abre arriba al seleccionarlo desde la barra
flotante y conserva sus filtros; Back sigue recuperando la posición contextual
cuando corresponde. Se acepta el comportamiento implementado, sin cambio nuevo.

Este cierre cambia únicamente docs/UX_01_C.md y docs/WORK_STATUS.md. Código,
pruebas, estilos y dependencias idénticos al aprobado. Se reutilizan 1000/1000,
70 archivos, y 96/96 dirigidas, sin repetir ni sumar; lint/build correctos.
No se atribuyen nuevas pruebas de Codex ni más manuales de Dirección. Audit
previo ENOTFOUND no completado y aviso bundle >500 kB continúan documentados.
Archivos ajenos y entregas fijas preservados; sin UX-02 ni UX-03.

Commit documental final, resultado del push, coincidencia local/remota y rama
nueva de preparación se registran fuera del commit en:
review-deliveries/ux-01-c/integration-2026-11-06/CLOSURE.md.
El push no acredita despliegue efectivo de Cloudflare Pages; publicación no
verificada en este cierre. Se prepara codex/ux-02-month-selector desde main
final, sin iniciar implementación ni publicar esa rama.
