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
