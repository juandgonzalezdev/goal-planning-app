# UX-01 — Evaluación técnica y plan de entregas

Fecha: 5 de noviembre de 2026. Autor/editor: Codex. Destinatario: Dirección.
Fase autorizada: evaluación y planificación; no implementación.
Resultado: **viable con alcance acotado y condiciones de pago/Undo por aprobar**.

## 1. Dictamen y alcance recomendado

La barra flotante, acceso superior a All Bills, búsqueda y edición directa pueden
construirse sobre componentes actuales, sin bibliotecas ni modelo financiero nuevos.
La mejora visible puede entregarse antes del pago rápido.

El pago sin cuenta ya es compatible con dominio, almacenamiento, backup, History,
cálculos y PDF. Se confirmó mediante sondas, no solo leyendo el tipo.
Undo **no es únicamente presentación**: necesita una operación limitada, reversible
y comprobada contra la revisión y el registro que creó el payment.
Mark as Not Paid no es una inversa exacta ni un Undo genérico seguro.

Recomiendo aprobar primero navegación y descubrimiento; aprobar por separado el
contrato de pago rápido, detalles posteriores y Undo antes de implementarlos.
No trasladar a producción la lógica financiera ficticia del prototipo.

Exclusiones: UX-02 (selector 360° y filtros nuevos de History), UX-03 (identidad,
paletas de categorías/ingresos, gráficos, Home y Year Overview), Pause/Resume,
rediseño PDF, migraciones y sincronización nueva. Superficies y contraste mínimos
de navegación sí pertenecen a UX-01; no autorizan aplicar toda la paleta UX-03.

## 2. Material disponible y método

Los tres archivos solicitados existen y se leyeron localmente:
- review-deliveries/ux-redesign/PROPUESTA.md: 43.387 bytes.
- review-deliveries/ux-redesign/prototype.html: 72.724 bytes.
- review-deliveries/ux-redesign/contrast-check.mjs: 3.054 bytes.

Se consultaron AGENTS.md, docs/WORKFLOW.md, docs/WORK_STATUS.md,
docs/DEVELOPMENT.md, el seguimiento 2A.1 y los componentes/consumidores citados.
El procedimiento aplicable es docs/WORKFLOW.md.

Método: inspección de código y HTML/CSS/JS, ejecución del script de contraste,
13 sondas de caracterización de dominio/almacén y 36 pruebas existentes dirigidas.
No se abrió navegador ni se hizo auditoría visual del prototipo, capturas móviles,
prueba manual o inspección visual de PDF. No se consultaron datos personales.
Todos los datos de las sondas son fixtures ficticias; IndexedDB es fake-indexeddb
nuevo en memoria, sin acceder al espacio propio del usuario.

El HTML mezcla las tres fases. Las etiquetas UX-01 son referencia de intención,
no convierten todos sus elementos en alcance aprobado o implementación válida.

## 3. Situación de 2A.1 y separación

Comprobado directamente con Git al comenzar:
- Rama: codex/increment-2a1-end-subscription.
- HEAD: 4d23540fb5121628d4f88828a352a1df3a210047.
- main: 4112c234a4e8813d3e04ae2f9c70877e41f8ef73.
- Últimos commits: 4d23540, 4112c23 y 4ba3c0a.
- Índice vacío.
- Trece archivos versionados modificados y SubscriptionReview.test.tsx nuevo:
  los catorce archivos del seguimiento O1–O7 de 2A.1.
- Archivos ajenos sin seguimiento, incluidas entregas, conservados.

El commit original tiene Approved with observations según el informe leído.
O1–O7 siguen sin commit, nueva entrega fija, revisión dirigida ni validación manual
aprobada. No están integradas en main. UX-01 no cierra ni autoriza integrar 2A.1.

Dependencias:
- AllBills.tsx y BillScreen.tsx ya tienen cambios pendientes. UX-01 debe conservar
  el criterio de estado respecto de hoy, independiente del mes seleccionado.
- Manage Subscription / End Subscription debe continuar visible cerca del inicio.
  PROPUESTA §5.3 sugiere mover Pause/End al menú: contradice el objetivo de 2A.1.
  Recomiendo NO trasladar End Subscription al menú de puntos.
- Las protecciones financieras de Bills 2A están en main: unión de previsión y
  payments y rechazo de exclusiones adicionales de payments.
- Los archivos financieros/de almacenamiento inspeccionados coinciden con main,
  salvo tipos de parámetros de bills.ts. Las sondas se ejecutaron en la carpeta
  con O1–O7, no en un checkout de producción. El diff respecto de main confirma
  que no cambió el comportamiento de los predicados de pago inspeccionados.

Secuencia recomendada: cerrar revisión/validación de 2A.1 e integrarlo solo con
autorización; crear después codex/ux-01-navigation desde main aprobado y limpio.
Si se adelanta únicamente navegación, Dirección debe aprobar un checkout/worktree
aislado desde main. No crear la rama en esta carpeta sucia ni arrastrar los catorce
archivos, hacer stash o incluirlos en UX-01. All Bills/detalle esperan base acordada.

Esta evaluación solo añade este documento y evidencia propia. No edita WORK_STATUS,
ya modificado por 2A.1, ni el material de Claude. No cambia rama, HEAD, main, índice,
producto, pruebas permanentes ni configuración de la app.

## 4. Pago sin cuenta: comportamiento real

Referencias inspeccionadas:
- src/features/bills/MarkPaid.tsx:47–87: inicialización, validación y guardado.
- src/features/bills/payment.ts: suggestedPaidOn y paidText.
- src/domain/finance/bills.ts:158–225: campos, validación, pagar y desmarcar.
- src/domain/finance/flows.ts:32–50 y monthFunding.
- src/domain/finance/history.ts: activityLog.
- src/domain/finance/spending.ts: monthSpending y monthResult.
- src/domain/finance/records.ts:122: stampNewRecords.
- src/data/exchange.ts y src/report/report.ts: backup e informe.

### 4.1 paidFrom: null

La entrada acepta null; BillMonth guardado omite paidFrom. No necesita migrar backups.
Significa cuenta no registrada, no una cuenta ficticia, efectivo supuesto o la única
cuenta disponible.

| Aspecto | Resultado comprobado |
| --- | --- |
| Validación | null válido; cuenta inexistente inválida. |
| Saldos guardados | No modifica balances, moneyAccounts, debts ni metas. |
| Banco | No crea flujo de tipo bill atribuido a una cuenta desconocida. |
| Factura ordinaria | Cuenta una vez en History, Spent y Money out; baja Left to Pay. |
| Atribución | monthFunding puede dejar parte del resultado como notExplained; no se asigna dinero a una cuenta supuesta. |
| Backup | Export/import conserva payment sin cuenta y History. |
| PDF | Mensual/anual conservan el importe; el PDF oculto no lo revela. |
| Repetición | No añade otro BillMonth/History, pero puede sustituir detalles del payment existente. |

No duplicar no equivale a idempotencia segura: una segunda llamada con null puede
borrar paidFrom de un payment ya pagado. El comando rápido debe comprobar que el
mes siga pendiente y corresponda a la intención mostrada. Editar es acción distinta.

### 4.2 Afirmaciones de la propuesta que requieren corregirse

- “Con No account no se crea movimiento”: cierto para el flujo bancario de esa
  factura, no para todo flujo. Una tarjeta genera repayment calculado de deuda sin
  cuenta; un préstamo con interés conocido genera flujo del principal. Conservarlos.
- “Elegir cuenta mueve su saldo” / “Balances only change when you pick an account”:
  elegirla añade flujo calculado para conciliación, no modifica snapshots de saldo.
  Los saldos se actualizan en su recorrido explícito. No prometer lo contrario.

Texto recomendado: “Account optional. Saved balances stay as entered.”
La ayuda ampliada explica la atribución a flujos registrados. P3 debe acordar
“No account recorded” o “No account”, sin cambiar la representación interna.

### 4.3 Deudas, importe y fecha

- Tarjeta: repayment, principal fuera de Spent, payment dentro de Money out;
  Remaining Balance guardado sin cambios.
- Préstamo sin interés: payment completo como salida; no se inventa split ni cero
  de interés. Spent no incluye interés desconocido; aparece como pago sin desglose.
- Préstamo con interés: Spent incluye interés y el principal genera flujo de deuda,
  incluso sin cuenta. No recalcula Remaining Balance.
- Desconocido: pedir importe, nunca suponer cero. Cero explícito válido.
  Importe conocido oculto puede guardarse sin mostrarlo, tampoco en toast/aria/copias.
- suggestedPaidOn propone el vencimiento si ya pasó, y hoy si aún no pasó.
  No es siempre hoy: en un toque se guardaría esa sugerencia sin revisión.
  Recomiendo hoy para registro rápido y permitir corregir fecha en detalles;
  Dirección debe aprobarlo. El mes contable sigue siendo el de la obligación.

Primera entrega financiera recomendada: quick pay con importe conocido en facturas
ordinarias y tarjetas; préstamos abren detalles con interés opcional hasta aprobar
expresamente el pago rápido sin desglose. Nunca exigir cuenta conocida.

## 5. Add details exige adaptar el formulario existente

MarkPaidForm inicia un registro: preselecciona la única cuenta Daily Spending,
propone una fecha y deja interés vacío. No precarga todos los campos de un payment
existente. Insertarlo sin más en una hoja después de Pay puede reemplazar detalles.

Contrato propuesto:
- Add details edita billId + month del receipt, con importe, paidOn, paidFrom e
  interés vigentes precargados. No crea otra operación al abrir.
- Cancel de detalles conserva el payment rápido. Cerrar no equivale a Undo.
- Alta nueva: sin cuenta por defecto con cero, una o varias cuentas. Edición:
  conservar cuenta existente, nunca sustituirla por un default.
- Conservar campos no modificados, ausencia de campos e importes/interés cero.
- Guardar revalida datos actuales con revisión de apertura y guarda de borrador.
- Guardar detalles invalida Undo del payment rápido original. No borrar después
  un payment enriquecido como si continuara intacto.

Puede empezar con formulario en línea/revelado progresivo. La hoja inferior es una
presentación del mismo contrato, no requisito de integridad. Si se aprueba hoja:
diálogo real, foco inicial, Esc, retorno al origen, fondo inerte y borrador protegido.

## 6. Undo: contrato seguro propuesto

### 6.1 No basta Mark as Not Paid ni la revisión de apertura

Sondas propias:
- Sin BillMonth previo, desmarcar deja paid:false; no recupera la ausencia original.
- Si se cambió importe al pagar, conserva el nuevo; no restaura override anterior.
  Elimina paidOn, paidFrom, interest y recordedAt.
- El almacén rechaza candidatos con revisión obsoleta.
- Tras cargar la revisión nueva, desmarcar usando esa revisión sí puede quitar un
  payment editado después. El CAS no reconoce la intención antigua de Undo.

useSpace.commit, aproximadamente línea 294, compara base con floor (la revisión
recibida externamente); SpaceStore.save compara atómicamente la revisión de guardado.
base no es igualdad estricta con la revisión posterior al payment, especialmente
tras cambios locales/refresco. SaveOutcome solo devuelve estado, no revisión real.

### 6.2 Receipt efímero y revisión exacta, sin modelo nuevo

Contrato por aprobar antes de implementar:
1. Una escritura validada/serializada para pagar. Guarda síncrona de doble toque.
2. Solo tras saved/demo, receipt en memoria: espacio/generación, billId, month,
   registro previo completo o ausencia, registro posterior exacto, revisión realmente
   guardada y contexto mínimo de vuelta.
3. Undo solo en esa generación/espacio y revisión posterior exacta, con registro
   y plan compatibles. Cualquier escritura posterior lo invalida, aunque sea ajena
   al payment. Es conservador y sencillo de verificar.
4. Restaurar solo BillMonth previo o retirar el recién creado, con orden/campos
   originales y el resto de FinanceData intacto. Nunca restaurar todo el espacio.
5. Reversión y CAS como única escritura; consumir receipt tras éxito. Doble Undo
   no provoca dos cambios.
6. Cambios de plan, Delete, reset, restore o cambio de espacio/demo invalidan receipt.
   No recrear facturas ni saltarse las guardas de payments fuera de calendario.
7. Demo necesita secuencia local efímera porque su revisión actual es 0. Nada nuevo
   en FinanceData ni backups.
8. Rechazo con resultado explícito. Devolver el objeto actual puede terminar en
   saved aunque no se aplicara nada: no anunciar “Undone” o “Paid” por ese no-op.

Se necesita una operación comprobada para payment/Undo que entregue receipt y
resultado semántico, y un helper pequeño de reversión con precondiciones.
ChangeSpace general puede mantenerse: una variante limitada de useSpace puede
devolver la revisión real. No inferir revision + 1 desde un render obsoleto.
No supone API REST, historial persistente de Undo o migración.

### 6.3 Toast y varias operaciones

Alcance recomendado: Undo solo de la última operación confirmada. Sin pila de
deshacer ni Undo tras recarga/backup. Cambiar pestaña de app no es una escritura y
puede conservar receipt si sigue en el mismo espacio.

El aviso pertenece al shell, no a la fila que desaparece con Pending o a una vista
que se desmonta. Anunciar éxito solo al confirmar escritura; distinguir demo, busy,
read-only, not-saved, outdated, conflict y stale. stale puede corresponder a escritura
ya completada: nunca lanzar compensación automática.

Los 6 s no se dan por aprobados. Recomiendo duración ampliable o cierre manual
accesible, pausa con foco/puntero/página oculta/detalles abiertos, sin retirar control
enfocado al reemplazar aviso. Nueva operación invalida el receipt anterior, con
anuncio; no robar foco para mostrar toast. Si desaparece la fila, usar estado estable
con Undo alcanzable. Corregir desde detalles sigue disponible al cerrar aviso.

## 7. Adaptación de navegación, búsqueda y edición

### 7.1 Barra flotante

Reutilizar BottomNav, Icon, selectTab y confirmLeave. Un solo nav; conservar
controlador de Back/Forward, no reemplazarlo por eventos del HTML.

- Iconos/etiquetas de los cinco destinos, aria-current, iconos decorativos y foco.
- Barra fija inferior móvil/tablet, safe areas y espacio reservado mediante altura
  real. Toast encima y diálogos delante; último botón de la pantalla accesible.
- Riel ancho sin duplicar logo/Help/Settings. Código actual: 1024 px; propuesta:
  1100 px. Recomiendo conservar 1024 inicialmente y Home de 1200 px sin cambios.
  Si se elige 1100, cambiar CSS y SIDEBAR_QUERY juntos.
- App.tsx hoy monta nav solo en pestañas y antes de main. Persistir en
  detalles/formularios exige ampliar showNav y definir destino activo/origen.
  Recomiendo visible dentro del espacio abierto, conservar origen/Back; modales
  cubren y excluyen nav del foco. Onboarding fuera de alcance.
- Etiquetas visibles como se pidió. No aprobar automáticamente P2 de iconos solos.
  Con poco ancho/zoom, adaptar altura/distribución antes de ocultar texto.
- DOM móvil con contenido antes del nav y enlace de salto; no duplicar árboles
  para resolver escritorio. Preservar nombres accesibles.
- VisualViewport como señal complementaria. Foco o ratio de altura aislados no
  prueban teclado virtual (también zoom/rotación); fallback accesible, sin ocultar
  por teclado físico.
- Reduced motion sin inclinación/deslizamiento. Transición discreta suficiente;
  inclinación 3D ornamental puede esperar al pulido aprobado.
- Nav, toast y acciones de pago fuera de impresión.

### 7.2 Bills y retorno

- This Month / All Bills arriba. Mantener Calendar/List y filtros en This Month;
  no eliminar calendario por copiar el prototipo.
- Añadir scope y query a BillsView con defaults de estado visual; no reinterpretar
  allOpen silenciosamente. Adaptar resets/ownReturn/demo; no tocar FinanceData.
- Nombre/categoría sin tildes o mayúsculas; búsqueda como texto escapado, etiqueta
  visible Search bills, Clear y conteo accesibles.
- Filtrar solo colección visual. Totales/gráfico/PDF usan colección completa.
  Filtros de estado conservan hoy como referencia y conteos bien rotulados.
- En calendario, mantener día cuando proceda; día sin coincidencias explícito;
  no saltar foco al escribir.
- Preservar scope/query/filtro/modo/mes/día/scroll/returnKey al volver de detalle/
  edición, incluido Back/Forward. Si fila desaparece, foco en encabezado/lista.
- Resumen compacto con cifras actuales; aplazar anillo/gráficos nuevos de UX-03.

### 7.3 Acciones y textos

Fila abre detalle y Pay es botón hermano: nunca botón anidado ni contenedor que
dispare ambas acciones. Paid abre detalle del payment; desmarcar mantiene su
confirmación/protecciones.

Edit visible arriba y entrada directa de All Bills al mismo BillForm, con intención
de navegación explícita y revisión vigente. No simular clicks en botones ocultos.
Documento propone menú Open/Edit y HTML botón Edit separado: recomiendo fila Open
y Edit visible separado, nombres accesibles con factura. Delete diferenciado y
Manage Subscription visible, no escondido en el menú.

Recorte inicial solo Bills/All Bills/pago/nav. Ayuda secundaria a HelpTip sin
eliminar avisos de integridad, interés desconocido, desconocidos, solo este mes,
cuenta no atribuida, guardado fallido y proveedor. La regla “una línea” no se aplica
a errores. Textos de Income/Year Overview y gráficos permanecen fuera de esta entrega.
Conservar Remaining Balance, Contribution y payment.

## 8. Componentes y archivos afectados en implementación futura

| Área | Archivos existentes | Cambio previsto |
| --- | --- | --- |
| Shell/rutas | src/App.tsx, src/app/navigation.ts, src/ui/useMediaQuery.ts | Nav, contexto, edición directa y retorno. Intentar conservar navigation.ts; ampliar contrato solo si resulta necesario. |
| Nav/iconos | src/components/BottomNav.tsx, src/components/Icon.tsx | Cinco iconos, etiquetas, indicador y señal de borrador de solo lectura. |
| Estilos/medidas | src/styles/tokens.css, src/styles/finance.css y shell implicado | Tokens mínimos, padding medido, safe areas, capas, foco, impresión, reduced motion. |
| Bills | src/features/bills/BillsScreen.tsx, AllBills.tsx, BillsCalendar.tsx, billsView.ts | Scope/búsqueda/coincidencias, filas y conservación de vista. |
| Detalle | src/features/bills/BillScreen.tsx, BillForm.tsx | Edit arriba/directo con guardas; preservar Manage Subscription. |
| Pago | src/features/bills/MarkPaid.tsx, payment.ts; src/features/home/LeftToPay.tsx | Default sin cuenta y edición precargada en las tres entradas. |
| Escrituras/Undo | src/app/useSpace.ts, src/ui/saveOutcome.ts; helper nuevo o src/domain/finance/bills.ts | Receipt efímero, resultado explícito y reversión exacta. No fórmulas/schema. |
| Aviso/diálogo | Componentes nuevos bajo src/components o features/bills, ubicación a acordar | Foco, anuncios y ciclo de receipt; no copiar mock HTML. |
| Privacidad/borradores | src/app/unsavedChanges.ts, módulo amountVisibility y HelpTip | Preferentemente reutilización; no almacenar borradores/importes ocultos. |
| Pruebas/manual | Archivos de §10, docs/USER_GUIDE.md y estado UX-01 al aprobar implementar | Evidencia por entrega, excluyendo cambios ajenos de 2A.1. |

Rutas nuevas propuestas, no archivos creados ni API final. Sin paquetes nuevos de
animación/búsqueda/UI/gráficos. Reportes, flows, spending, schema, backups y saldos
se conservan y se prueban como consumidores, no se rediseñan.

## 9. Plan por entregas pequeñas

Cada entrega sigue WORKFLOW: alcance, pruebas pertinentes, lint/build, diff/índice,
commit solo autorizado, entrega fija y revisión. Terminar no autoriza main/push.

| Entrega | Contenido acotado | Salida verificable |
| --- | --- | --- |
| UX-01-A | Barra, iconos/etiquetas, tokens mínimos, safe areas, foco y reduced motion. Acordar persistencia/breakpoint. | Cinco destinos una sola vez; Back/borradores intactos; último control visible en móvil/zoom; ningún dato financiero tocado. |
| UX-01-B | This Month/All Bills arriba y búsqueda; conservar calendario/lista. | Encontrar sin recorrer calendario; búsqueda no altera totales; estados/payments 2A.1 intactos; vuelta al mismo origen. |
| UX-01-C | Fila abre detalle, Edit arriba/directo y acceso al payment; retirar acciones repetidas disponibles en detalle. | Abrir/editar/volver con foco y filtro; sin botones anidados ni End Subscription escondido. |
| UX-01-D | Cuenta opcional por defecto en formulario y edición de detalles existente; recorte inicial de ayudas. | Guardar sin cuenta con 0/1/N cuentas; datos existentes intactos; Cancel no escribe. Sin pago instantáneo si Undo no está listo. |
| UX-01-E | Quick pay + receipt + Undo exacto + toast, juntos; préstamos según aprobación. | Una escritura, sin duplicados/cuenta asumida; concurrencia probada; no éxito falso; History/PDF/flows coherentes. |
| UX-01-F | Pulido accesible/textos; hoja inferior solo si se aprueba. | Móvil, teclado/lector, light-dark, movimiento reducido y superposición real; validación de Dirección antes de integrar. |

A–C ya mejoran visiblemente sin construir Undo. D/E permiten verificar primero el
formulario/detalles. No entregar quick pay sin reversión/guardas aceptadas.
El punto de borrador puede entrar en A leyendo estado existente, no como sistema nuevo.

No se dan horas sin probar layout/Viewport reales. Esfuerzo relativo: A–C medio,
D medio, E alto por semántica/concurrencia, F medio.

## 10. Riesgos y pruebas necesarias

| Riesgo | Mitigación/prueba |
| --- | --- |
| Mezclar 2A.1 | Base explícita, checkout limpio/aislado, manifiesto/diff/índice exactos; no staging global. |
| Doble toque/payment ya pagado | Guarda síncrona y revalidación atómica de importe/plan/registro; no sobrescribir detalles. |
| Undo quita cambios posteriores | Receipt, revisión/generación exactas, CAS y restauración de un registro; rechazo explícito. |
| Cuenta supuesta | null por defecto, ningún flujo bancario atribuido, snapshots idénticos. |
| Interés desconocido como cero | Conservar unsplitLoanPayments, no adivinar split; decisión de préstamos. |
| Detalles pierden campos | Precarga, conservación de recordedAt/campos no tocados; cerrar no deshace pago rápido. |
| Éxito de un no-op | Resultado semántico además de saved; no receipt si no se aplicó. |
| Búsqueda altera cifras/vuelta | Colección visual separada y pruebas de totales/contexto. |
| Nav/teclado/modal tapa controles | Altura real/capas/safe areas; viewport real; fallback sin ocultar indebidamente. |
| Se ocultan avisos necesarios | Mantener integridad/errores y ayuda progresiva accesible. |

Automatización prevista:
- Layout.test.tsx, App.test.tsx, navigation.test.ts, LeaveForms, HomeAreas,
  OtherTabs y retorno: tabs, foco, búsqueda, edición, borradores y Back/Forward.
- billsView.test.ts, BillsCalendar.test.tsx y All Bills: nombre/categoría/tildes/caso,
  Clear, cero resultados, estados heredados, filtros, calendario y totales intactos.
- MarkPaid.test.tsx, domain/finance/markPaid.test.ts y nuevas pruebas receipt/Undo:
  Home/lista/detalle y ocultación de importes.
- Sin cuenta con 0/1/N cuentas; conocido/desconocido/cero; mensual/anual,
  vencida/hoy/futura, importe propio del mes y cambios habituales.
- Ordinaria/tarjeta/préstamo con interés null/0/conocido: balances intactos, flujos,
  Spent/Money out, conciliación y History correctos.
- Undo con registro previo ausente o amount null/cero/override; ausencia/valores de
  paidOn/paidFrom/interest/recordedAt, orden y otros registros intactos.
- Dos pestañas: mismo payment, otro registro, plan/pausa/fin/Delete, aviso recibido
  o pendiente. Probar almacén atómico y hook, no solo mocks que devuelven outdated.
- Dos pagos rápidos, Undo repetido, busy, guardado lento, falta de espacio,
  read-only, fallos, space switch, demo, reset y restore. Nunca rollback global.
- Backup/export/import, History y PDF mensual/anual/oculto. Mantener casos de
  payment fuera de calendario y bloqueo de desmarcar de Bills 2A.
- Contraste de colores efectivos; foco/anuncios y pausa del toast con temporizadores.

Validación real propuesta a Dirección por entrega:
- 320/390 px, móvil horizontal, tablet/escritorio; zoom/texto 200 %, cinco etiquetas,
  último Save/Keep Subscription/Undo sin tapar.
- Light/dark, reduced motion/transparencia, fallback sin backdrop-filter.
- Safari/iPhone con teclado virtual; teclado físico y lector de pantalla.
- Pending oculta fila al pagar, Undo por teclado, cierre de detalles, cambio de tab
  y dos pestañas reales.
- PDF visible/oculto con datos ficticios. No extender confirmaciones anteriores.

## 11. Prototipo y contraste: límites de reutilización

El script original terminó con salida 0: las parejas propuestas ensayadas cumplen
objetivo; muted actual 4,48 y propuesto 4,82 sobre bg light. Evidencia matemática,
no aceptación visual de la implementación final.

Observaciones de inspección estática:
- El script prueba etiquetas sobre superficies fijas, no toda composición del cristal
  con contenido. Extremos calculados: light .72 sobre negro da 3,37; dark .74 sobre
  blanco da 3,85 para sus etiquetas inactivas. Son extremos matemáticos, no píxeles
  observados ni demostración de fallo visual del prototipo. No garantizan 4,5 en
  toda composición. Recomiendo superficie opaca inicial o medir/ajustar composición.
- PROPUESTA menciona VisualViewport; HTML oculta nav por foco/ancho, sin verificarlo.
  No copiar esa heurística.
- Se pide etiqueta visible de búsqueda; HTML usa sr/placeholder. Mantenerla visible.
- Objetivo táctil 44 px, pero botones del mock incluyen 36–40 px. También difieren
  mínimos de texto y etiquetas de nav. Revisar medidas reales, no heredar su garantía.
- Pay del HTML cambia estado ficticio y Undo pone false; la hoja guarda cuenta en
  ese mock, no reproduce validación/transacciones ni todos los campos financieros.
- Hay rueda, gráficos e ingresos UX-02/03. No migrar íntegramente el prototipo.
- Su localStorage conserva preferencias tema/pestaña, no equivale al almacén financiero.
- Menús/acciones visuales no prueban recorridos de producción. Sin validación real
  de teclado, móvil o lector en esta evaluación.

## 12. Decisiones pendientes de Dirección

P1, P5 y P6 están aprobadas conceptualmente en el documento/encargo; no se vuelve
a pedir aprobar su intención. Faltan estos contratos concretos:

| Decisión | Recomendación |
| --- | --- |
| D1 — base/orden | Cerrar 2A.1 y partir de main aprobado. Si se adelanta A, autorizar checkout aislado desde main, solo navegación. |
| D2 — persistencia/layout | Nav también en detalles/edición, conservando origen/Back; cinco etiquetas. Mantener 1024 y Home; no iconos solos. |
| D3 — fecha/préstamos | Hoy en quick pay, detalles para corregir fecha. Préstamos abren detalles con interés opcional hasta aprobar quick pay sin split. |
| D4 — Undo | Último payment, reversión exacta con receipt efímero y revisión/generación estrictas; toda escritura posterior lo invalida. Aprobar la pequeña operación comprobada, no solo un toast. |
| D5 — tiempo/acciones | Duración ampliable o cierre manual; pausa con foco/puntero/ocultación/modal; un receipt; invalidar al guardar detalles o pagar de nuevo sin retirar controles enfocados. 6 s no aprobados. |
| D6 — cuenta/detalles | “No account recorded”, o aprobar P3 “No account”; sin preselección bancaria en alta, conservar cuenta en edición. Corregir texto de saldos del prototipo. |
| D7 — primer alcance | A–C primero, sin anillo nuevo ni ocultar End Subscription. D/E después del contrato financiero. Edit separado de Open, sin menú obligatorio. |

P4 de History, P7–P9 y P11 son UX-02/03 o decisiones vigentes: no son condiciones
para UX-01 y no se implementan ni reabren aquí. No requiere aprobación nueva usar el
null existente; no se propone cuenta ficticia, origen bancario o campo persistente Undo.

## 13. Evidencia ejecutada, límites y entrega

Evidencia propia del 5 de noviembre de 2026 en:
review-deliveries/ux-01-technical-evaluation/evidence/

| Ejecución | Resultado |
| --- | --- |
| Configuración aislada y probes.test.ts | 13/13, un archivo, 933 ms. Caracteriza lo existente, incluidas las limitaciones demostradas de Undo. |
| npm test dirigido a src/domain/finance/markPaid.test.ts, src/domain/finance/paymentIntegrity.test.ts, src/data/paymentIntegrityStorage.test.ts, maxWorkers=2 | 36/36, tres archivos, 1,03 s. |
| node review-deliveries/ux-redesign/contrast-check.mjs | Salida 0; parejas propuestas ensayadas pasan, muted actual bajo umbral como referencia. |
| Extremos matemáticos | glass-extremes.json: 3,37 y 3,85; no prueba visual. |
| Preservación de 2A.1 y propuesta | Rama/HEAD/main/índice y hashes de catorce pendientes más tres fuentes comparados antes/después; resultado en preservation-after.json. |

49 comprobaciones en dos invocaciones, no suite completa. No acreditan que el
futuro Pay/Undo esté implementado o sea seguro: prueban premisas y riesgos.
No se repiten suite completa, lint, build ni audit para evaluación documental sin
cambiar producto/dependencias. El 946/946 previo de Codex corresponde a O1–O7;
no se presenta como ejecución nueva de UX-01.

Sondas/configuración fuera de src, ejecutadas con configuración propia; no se añaden
a pruebas permanentes ni se cambia vite.config.ts. Sin git add, commit, branch switch,
merge, push, stash o despliegue. El índice se conserva byte a byte.

Este análisis es documento nuevo sin preparar y separado. No es entrega fija por
commit ni revisión independiente completada. Siguiente paso: Dirección decide
D1–D7 y autoriza primer alcance; entonces Codex prepara la rama/base acordada e
implementa solo esa entrega. Hasta aprobarla no comienza implementación UX-01.
