# Estado de trabajo y coordinación

Actualizado: 3 de noviembre de 2026.

Este registro describe la integración actual de Rumbo. `STATUS.md` conserva
el estado histórico fechado allí; los resúmenes de `rumbo-01-08/` describen
las entregas y sus comprobaciones, no acreditan por sí solos su integración
en esta carpeta de trabajo.

## Repositorio comprobado por Codex

- Carpeta: `C:\Projects\goal-planning-app`.
- Base integrada (HEAD): `579117b` — Improve navigation links and restore return context.
- Rumbo 02 está integrado en `main` y `origin/main`.
- Rama actual: `feature/rumbo-03-mark-paid`, creada desde esa base.
- Los archivos sin seguimiento anteriores se conservan. Los cambios actuales
  corresponden al parche 03, sus correcciones y documentación; están preparados
  para revisión, sin commit. Los archivos ajenos siguen sin seguimiento.

## Integración actual

- Rumbo 02 confirmado e integrado en `579117b`, comprobado por Codex en Git.
- Rumbo 03 aplicado, sin commit. Incrementos 04–08 pendientes de aplicar.
- La tarea inicial creó las reglas de coordinación. En la corrección actual,
  Codex es el editor y Claude el revisor, sin edición simultánea.
  Juan comunicó la revisión de Claude: precisar las acciones accesibles de
  los saldos y corregir el manual sobre el regreso con la pestaña History.
  Codex aplicó ambos ajustes; no cambió el comportamiento de esa pestaña.

## Comprobaciones comunicadas por Juan

- 725 pruebas aprobadas, lint y build correctos.
- Pruebas manuales confirmadas por Juan:
  - Income desde Home y regreso a Home.
  - Spent desde Home y regreso a Home.
  - Conservación del filtro de Goals.
  - Apertura de Investment Account desde History y regreso a History.

Estos resultados son los comunicados por Juan antes de la corrección siguiente.
No se atribuye un navegador o dispositivo a sus confirmaciones porque no se
ha especificado.

## Corrección de Balance update (integrada en Rumbo 02)

History → Balance update de Student Loan abre Accounts & Savings en lugar
del préstamo. Juan comunicó el fallo en la prueba manual.

Codex localizó la causa: History enviaba todos los saldos a `showAccount`,
que solo busca en `moneyAccounts`. Afectaba también a Small Loan, Credit Card
y cualquier otra tarjeta o préstamo. El enlace ahora distingue `debts` y abre
su detalle; las cuentas conservan Accounts & Savings. Se conserva también
el estado de regreso al pasar por `debt`, para restaurar posición y foco.
Se actualizaron la ayuda de History y las dos referencias del manual de uso.

### Comprobaciones automáticas propias de Codex

- Antes de corregir el código, las tres pruebas nuevas de Student Loan,
  Small Loan y Credit Card fallaron: recibían `money` en lugar de `debt`.
  Las ocho pruebas anteriores del archivo pasaron, incluida Savings Account.
- Las pruebas nuevas comprueban el detalle correcto, Remaining Balance,
  regreso a History, posición y foco en el mismo registro. Se amplió también
  Savings Account para comprobar la posición al volver.
- `npm run lint`: correcto.
- `npm run build`: correcto.
- `npm test -- --maxWorkers=2`: 728 pruebas aprobadas en 47 archivos
  (168,62 s), incluidas las tres nuevas y el caso de Savings Account.
  Se mostraron avisos de jsdom sobre `scrollTo` y navegación a otro documento;
  no hubo pruebas fallidas.
- `git diff --check`: sin errores.

### Confirmación manual comunicada por Juan

- Juan confirmó en ordenador y teléfono el recorrido de Balance update de
  Student Loan: apertura del préstamo y regreso a History conservando posición
  y foco. Esta confirmación fue comunicada por Juan, no ejecutada por Codex.
- Small Loan y Credit Card siguen sin confirmación manual. Su cobertura es
  automática; no se extiende a ellos la confirmación de Student Loan.
- Savings Account conserva su prueba automática de regresión; no se registra
  una nueva confirmación manual para esa cuenta.

### Ajustes tras la revisión de Claude

- Los saldos usan las acciones accesibles `Open account` y `Open card or loan`
  según su destino. Se actualizó el manual.
- Se mantiene el comportamiento de History: Back desde el destino de un
  registro restaura posición y foco. Desde una cuenta abierta en Money también
  lo hace pulsar directamente la pestaña History. Los detalles de facturas,
  metas, tarjetas y préstamos no muestran las pestañas principales.
  Pasar antes por otra pestaña principal elimina esa posición de regreso;
  se conservan periodo, búsqueda, filtros y meses abiertos.
- Se añadió una prueba de ese regreso directo con la pestaña y del paso
  posterior por Home; se comprueban también las acciones accesibles.
- Las 728 pruebas y el build anteriores corresponden a la corrección previa;
  no se presentan como una ejecución nueva después de estos ajustes.
- Comprobación propia de Codex tras los ajustes:
  `npm test -- src/LinksReturn.test.tsx src/History.test.tsx --maxWorkers=2`:
  35 pruebas aprobadas en 2 archivos (29,71 s).
- `npm run lint` y `git diff --check`: correctos tras los ajustes.
  No se repitieron la suite completa ni el build en esta revisión.

## Rumbo 03: Mark as Paid (sin commit)

Codex es el editor; Claude queda como revisor. Juan comunicó seis hallazgos
para el incremento 03. `REVISION-03.md` no se encontró en la carpeta de trabajo;
las correcciones se basan en los seis puntos expresos del mensaje de Juan.

- Parche: `rumbo-01-08/rumbo-03-mark-paid/rumbo-03-mark-paid.patch`.
- `git apply --check` pasó antes de aplicarlo. Aplicación normal, sin forzar
  ni resolver conflictos. Solo se aplicó el incremento 03.
- El parche afecta a 18 archivos (640 líneas añadidas y 38 eliminadas).
  Los avisos de espacios de `git apply` proceden de sus finales CRLF.
- Conservadas las correcciones de Rumbo 02: destino de tarjetas y préstamos,
  etiquetas accesibles y conservación del contexto de regreso a History.
- Mark as Paid usa un formulario compartido desde Home, Bills y el detalle;
  guarda importe, fecha, cuenta e interés opcional del préstamo, sin modificar
  Remaining Balance ni los saldos.

### Comprobaciones automáticas propias de Codex para Rumbo 03

- `npm test -- --maxWorkers=2`: 742 pruebas aprobadas en 49 archivos
  (174,71 s), incluidas las pruebas de enlaces y regreso de Rumbo 02.
  Avisos de jsdom sobre `scrollTo` y navegación a otro documento, sin fallos.
- `npm run lint`: correcto.
- `npm run build`: correcto; mantiene el aviso de fragmento de más de 500 kB.
- `git diff --check`: sin errores tras aplicar el parche y actualizar este registro.
- Estos resultados se ejecutaron aquí por Codex. Los 738 tests del resumen
  del paquete corresponden a su base original, no al estado actual con las
  cuatro pruebas adicionales incorporadas durante la revisión de Rumbo 02.

### Prueba manual de Juan pendiente para Rumbo 03

La confirmación manual de Juan se limita a Test Delete, descrita más abajo.
Sigue pendiente comprobar el formulario
en Home, Bills y detalle, guardar y desmarcar un payment, importes ocultos y
conservación de Remaining Balance. En teléfono: selector de fecha, formulario
estrecho con teclado y gesto de atrás con cambios sin guardar.
Los resultados de la entrega del parche no cuentan como comprobaciones propias.

### Correcciones de los seis hallazgos de Rumbo 03

- Borrado (primera versión, sustituida por el ajuste posterior de Juan): se comprobaban saldos, `paidFrom` de pagos, ingresos, gastos,
  ambos extremos de transferencias y movimientos de metas. Delete queda
  bloqueado con su motivo visible y accesible antes de guardar. El dominio
  impide el borrado y conserva todos los registros, incluso los históricos.
- Show Fewer pregunta si oculta un formulario de pago modificado. Keep Editing
  conserva la lista y el borrador; Discard and Leave cierra solo el formulario
  que deja de mostrarse.
- Repetir Mark as Paid en la lista pregunta antes de cerrar un borrador cambiado.
  Cancel sigue siendo la decisión explícita de descartar ese formulario.
- Mark as Paid y Change Amount se excluyen en lista y detalle, con protección
  de cambios al alternar en ambas direcciones.
- La fecha usa `isCalendarDate`, rechazando días imposibles sin guardar.
- El botón de lista que muestra ✓ Paid anuncia primero `Paid`, además de
  Mark as Not Paid, la factura y el mes.
- Pruebas propias antes de corregir: fallaron los casos de referencias a
  saldos, pagos, ingresos, gastos y transferencias, fechas imposibles,
  ocultación y alternancia de formularios. El caso de movimientos de metas
  y el borrado de una cuenta vacía ya pasaban. La prueba de interfaz de
  borrado falló al no estar bloqueado Delete. Se verificó por separado que
  una factura realmente pagada no anunciaba el estado Paid al inicio.
- Se actualizaron el manual y las reglas financieras. La validación manual
  de estos cambios por Juan sigue pendiente salvo el recorrido Test Delete
  confirmado en el ajuste posterior.
- La primera suite completa tras las correcciones aprobó 758 de 759 pruebas.
  El único fallo era una expectativa anterior de `MoneyBlocks.test.tsx` que
  borraba una cuenta con saldo. Se actualizó para comprobar el bloqueo y la
  conservación del registro en History, conforme al nuevo requisito.
- Resultados finales propios de Codex tras los seis ajustes:
  `npm test -- --maxWorkers=2`: 759 pruebas aprobadas en 50 archivos
  (181,75 s). Incluye 17 casos adicionales respecto a las 742 pruebas previas.
- `npm run lint`, `npm run build` y `git diff --check`: correctos.
  Se observaron los avisos conocidos de jsdom; en la primera compilación de
  esta revisión también apareció el aviso de tamaño del fragmento JavaScript.
- Cambios sin preparar y sin commit en `feature/rumbo-03-mark-paid`;
  HEAD continúa en `579117b`. No se aplicaron 04–08 ni se hizo push o merge.

### Ajuste posterior de Juan: cuentas con solo saldos

- Los saldos por sí solos ya no bloquean el borrado. Se permite eliminar
  una cuenta creada por error con saldo inicial y todos sus snapshots.
- La interfaz pide confirmación y explica que se elimina la cuenta y todas
  sus actualizaciones de saldo en History, sin posibilidad de deshacer.
  Cancel conserva la cuenta y sus saldos; no se tocan otras cuentas.
- Pagos (`paidFrom`), ingresos, gastos, transferencias en ambos sentidos
  y movimientos de metas siguen bloqueando el borrado con explicación previa.
  Se usa la misma comprobación en la interfaz y en `deleteAccount`.
- La confirmación usa la revisión de datos al abrirse para evitar borrar sobre
  cambios concurrentes. `deleteAccount` vuelve a comprobar los vínculos.
- Pruebas actualizadas: cuenta con solo saldos, cuenta creada con saldo
  inicial, Cancel, desaparición de sus snapshots de History y protección de
  pagos con o sin saldos. Se mantienen los demás ajustes del incremento 03.
- Estos casos se verifican automáticamente; Juan confirmó además el recorrido
  Test Delete indicado abajo. La suite completa anterior de 759 pruebas corresponde a
  la versión previa al ajuste, no a una nueva ejecución completa.
- Resultados propios de Codex: `npm test -- src/MoneyBlocks.test.tsx
  src/MarkPaid.test.tsx src/domain/finance/accountDeletion.test.ts --maxWorkers=2`:
  46 pruebas aprobadas en 3 archivos (24,95 s), con los avisos conocidos de
  jsdom sobre `scrollTo`. Lint, build y `git diff --check` correctos.
  Build mantiene el aviso de fragmento JavaScript superior a 500 kB.

### Confirmación manual de Juan y alcance de Show Fewer

- Juan confirmó en ordenador y teléfono: crear la cuenta ficticia `Test Delete`
  con saldo inicial 10, iniciar su borrado y cancelarlo conservando la cuenta
  y su saldo; después confirmar el borrado correctamente. Confirmación
  comunicada por Juan, no ejecutada por Codex.
- Show Fewer pasó la prueba automática específica de Codex: demo ficticia con
  más de cinco facturas pendientes, cambiar el importe de la sexta a `321`,
  pulsar Show Fewer y comprobar la pregunta; Keep Editing conserva el formulario
  y el importe. Reejecución específica: 1 prueba aprobada, 12 omitidas
  (6,05 s, `src/MarkPaid.test.tsx`, `--maxWorkers=2`).
- Show Fewer no se verificó en navegador: el navegador integrado agotó el
  tiempo de conexión a la sesión local de prueba (timeout). No se registra
  como prueba manual ni como recorrido comprobado en navegador.

### Preparación de Rumbo 03, sin commit

- Solo se preparan los 23 archivos del incremento 03, sus correcciones,
  pruebas y documentación. Se excluyen parches, resúmenes e informes
  descargados, capturas y todos los demás archivos ajenos sin seguimiento.
- Esta preparación no incluye commit, push, merge ni incrementos 04–08.

## Siguiente trabajo

Revisar Rumbo 03 y completar su prueba manual con Juan. Siguen pendientes las
pruebas manuales de Small Loan y Credit Card de Rumbo 02. Los incrementos 04–08
siguen pendientes. No hacer commit, push ni merge sin indicación de Juan.
