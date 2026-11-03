# Estado de trabajo y coordinación

Actualizado: 3 de noviembre de 2026.

Este registro describe la integración actual de Rumbo. `STATUS.md` conserva
el estado histórico fechado allí; los resúmenes de `rumbo-01-08/` describen
las entregas y sus comprobaciones, no acreditan por sí solos su integración
en esta carpeta de trabajo.

## Repositorio comprobado por Codex

- Carpeta: `C:\Projects\goal-planning-app`.
- Base integrada (HEAD): `4e91c9b` — Hide chart details when amounts are hidden.
- Rama: `feature/rumbo-02-enlaces`.
- Hay cambios existentes en archivos seguidos y archivos sin seguimiento.
  Deben preservarse.

## Integración actual

- Rumbo 02 aplicado, sin commit, según el estado comunicado por Juan.
  Codex comprobó la rama, HEAD y la existencia de cambios pendientes; no ha
  verificado aquí la equivalencia completa con el parche de entrega.
- Incrementos 03–08 pendientes de aplicar.
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

## Corrección de Balance update (sin commit)

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

## Siguiente trabajo

Completar las pruebas manuales pendientes de Small Loan y Credit Card. Los incrementos 03–08
siguen pendientes. No hacer commit, push ni merge sin indicación de Juan.
