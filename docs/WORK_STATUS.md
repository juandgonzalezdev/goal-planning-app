# Estado de trabajo y coordinación

Actualizado: 4 de noviembre de 2026.

Este registro describe la integración actual de Rumbo. `STATUS.md` conserva
el estado histórico fechado allí; los resúmenes de `rumbo-01-08/` describen
las entregas y sus comprobaciones, no acreditan por sí solos su integración
en esta carpeta de trabajo.

## Repositorio comprobado por Codex

- Carpeta: `C:\Projects\goal-planning-app`.
- Base integrada en main: `579117b` — Improve navigation links and restore return context.
- Rumbo 02 está integrado en `main` y `origin/main`.
- Rama candidata actual: `integration/rumbo-03-08`.
- Los archivos sin seguimiento anteriores se conservan y excluyen de los commits.
  Rumbo 03 y coordinación se guardaron por separado antes de continuar 04–08.

## Integración actual

- Rumbo 02 confirmado e integrado en `579117b`, comprobado por Codex en Git.
- Rumbo 03–08 aplicados con commits locales separados; sin push ni integración
  a main. La autorización de Juan de preparar la candidata sustituyó la pausa.
- Estado vigente de la candidata y revisión: apartado final de este documento.
  Los apartados anteriores conservan la cronología y sus confirmaciones.
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

## Rumbo 03: Mark as Paid (guardado localmente en 18ddb1e)

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
- En el intento inicial de Codex, Show Fewer no se verificó en navegador: el navegador integrado agotó el
  tiempo de conexión a la sesión local de prueba (timeout). No se registra
  como prueba manual ni como recorrido comprobado en navegador.

### Preparación de Rumbo 03, sin commit

- Solo se preparan los 23 archivos del incremento 03, sus correcciones,
  pruebas y documentación. Se excluyen parches, resúmenes e informes
  descargados, capturas y todos los demás archivos ajenos sin seguimiento.
- Esta preparación no incluye commit, push, merge ni incrementos 04–08.

## Siguiente trabajo

Revisión de Claude de las correcciones posteriores a su informe y prueba de
la candidata por Juan. Las correcciones se guardan en commits adicionales,
sin reescribir los extremos revisados. Siguen pendientes Small Loan y Credit Card
manuales del 02 y los recorridos nuevos del 03–08. Sin push, merge a main ni
publicación hasta nueva autorización de Juan.

## Candidata local Rumbo 03–08 (3 de noviembre de 2026)

Base integrada: `579117bf8edc1b1714e9c92c11750099e5c78009`.
Rama: `integration/rumbo-03-08`. Extremo de código: `dbb3967`.
El registro y el guion de prueba se entregan en un commit documental posterior;
el hash final de la candidata se comunica con `git log -1` al entregar.

| Commit local | Contenido |
| --- | --- |
| `18ddb1e` | Rumbo 03, correcciones de pagos y borrado, confirmaciones previas. |
| `ee65443` | Coordinación: AGENTS, CLAUDE y WORKFLOW. |
| `7a3012d` | 04: referencia temporal de Left to Pay y Coming up. |
| `3f51bd0` | 05: Add global y regreso al origen. Extremo fijo de revisión 03–05. |
| `f5dc496` | 06: barra lateral y columnas responsive. |
| `eaf828d` | 07: gráficas, teclado, tablas y privacidad de History. |
| `dbb3967` | 08: Help, Getting Started, mensajes, skeleton; adaptación Windows y privacidad de ayudas. |

Adaptaciones y controles por incremento: [INTEGRATION_NOTES.md](INTEGRATION_NOTES.md).
No cambiaron package.json ni package-lock.json; no se añadieron dependencias.
No se incluyeron parches descargados, capturas, datos personales ni archivos
ajenos en los commits.

### Revisiones y acceso real

- Entrega 03–05: base `579117b`, extremo `3f51bd0`; paquete generado localmente
  en `review-deliveries/rumbo-03-05-review.zip`, fuera de src y fuera de Git.
  Contiene hashes completos, diff con archivos nuevos y snapshot de archivos
  seguidos. Claude confirmó en el informe recibido el 4 de noviembre que pudo
  abrir todos los adjuntos de ambos bloques en su propio entorno.
- La segunda entrega abarca desde `3f51bd0` al commit final de la candidata,
  incluyendo 06–08 y documentación final; los hashes completos constan en su
  archivo commits.txt. La entrega no equivale a una revisión aprobada.
- El informe REVISION-03-08.md, de Claude (4 de noviembre), revisa los extremos
  `579117b..3f51bd0` y `3f51bd0..8db763e`. No tuvo acceso al repositorio de Juan
  ni verificó allí los commits intermedios; comprobó coherencia de snapshots
  y diffs y declaró esa limitación. Sus hallazgos se evalúan más abajo.

### Responsive, privacidad y navegador

- Comprobación responsive automática: Layout simula matchMedia, cambio de
  anchura y controles no duplicados; inspección del CSS para 740/1024/1200 px.
  Codex no verificó la disposición visual; posteriormente Claude comprobó
  responsive en Chromium sobre 8db763e, según el informe recibido.
- Privacidad: pruebas de H1, gráficas ocultas de History y ejemplos de ayudas
  de This Month al ocultar importes, incluido ocultar una nota ya abierta.
  Money, metas y deudas mantienen su visibilidad existente; ocultar importes
  no es cifrado ni bloqueo de acceso.
- Intento de navegador de esta candidata: servidor local arrancado y navegador
  integrado sin conexión (ERR_CONNECTION_TIMED_OUT). Posteriormente Claude
  verificó Show Fewer en Chromium sobre 8db763e. No se atribuyen esos recorridos
  a Codex. No se declaran recorridos de navegador,
  Safari, iPhone, iPad, VoiceOver ni gestos táctiles como realizados por Codex.
- Las confirmaciones de Juan de Test Delete y Student Loan registradas arriba
  se conservan con su alcance original; no se extienden a las nuevas funciones.

### Entrega para probar

Funciones, instrucciones para ordenador/teléfono y checklist breve:
[CANDIDATE.md](CANDIDATE.md). Juan prueba la candidata antes de autorizar
cualquier integración final.

### Comprobaciones finales propias de Codex

- Sobre el código `dbb39677791a84d0ec8727ce90d2b6b7d46b21cd`:
  `npm test -- --maxWorkers=2`: **813 pruebas aprobadas en 58 archivos**,
  213,85 s. Incluye Show Fewer, pagos, borrado con saldo, enlaces, Coming up,
  Add, Layout, gráficas, H1, Getting Started y privacidad de notas abiertas.
- `npm run lint`: correcto. `npm run build`: correcto, 153 módulos;
  JS 692,27 kB (192,89 kB gzip). El aviso conocido de tamaño apareció en las
  compilaciones de los incrementos; no se elevó el límite para ocultarlo.
- `git diff --check` y comprobación del diff desde la base: correctos.
  Solo documentación cambia después de los controles de código; no justifica
  repetir la suite completa.
- Avisos conocidos de jsdom: scrollTo y navegación a otro documento, sin fallos.
  No se ejecutó npm audit: no hubo cambios de dependencias en esta tarea.
- Logs propios fuera de Git: `review-deliveries/final-tests.txt`,
  `final-lint.txt`, `final-build.txt`. No se incluyen en commits.

## Correcciones de REVISION-03-08 (4 de noviembre de 2026)

Editor: Codex. Revisor del informe: Claude. Base revisada e inmutable:
`8db763ef273e8338847aca2307069ee514abfadb`. Los resultados del informe son
información recibida; no se presentan como ejecuciones propias de Codex.

### Evidencia recibida de Claude sobre 8db763e

- Claude ejecutó **813/813 pruebas en 58 archivos**, `--maxWorkers=2`
  (129,8 s), lint y build correctos en su snapshot, Linux y Node 22, tras
  npm ci. Build mantuvo el aviso conocido de tamaño. No ejecutó estos comandos
  sobre el repositorio de Juan ni comprobó con Git la identidad de la base.
- En Chromium, con vite preview y datos de la demo, verificó Show Fewer a
  390 y 1280 px: pregunta, Keep Editing conserva lista y valor y Discard and
  Leave cierra el formulario. Verificó también responsive a 320, 390, 768,
  1023, 1024, 1199, 1200 y 1440 px, sin desbordamiento lateral en las pantallas
  indicadas en el informe. Confirmó sidebar desde 1024 y columnas desde 1200.
- Safari/iPhone, gestos, teclado móvil, movimiento reducido real y lector de
  pantalla siguen pendientes en la candidata final. No se extienden los
  recorridos Chromium de 8db763e a las correcciones posteriores.
- Se conservan las confirmaciones manuales de Juan de Test Delete con saldo
  10, Cancel y borrado posterior en ordenador y teléfono sobre el 03 anterior.
  No se marca una repetición de ese recorrido sobre la candidata corregida.

### Resolución de los hallazgos

| Hallazgo | Evaluación y corrección |
| --- | --- |
| H1 | Reproducido por Codex: una prueba nueva falló porque no aparecía Leave without saving al cambiar de Gym Membership a Transit Pass. Se protege el formulario anterior con useLeaveGuard y su tag. Keep Editing conserva importe, fecha y cuenta; Discard and Leave abre la otra factura sin guardar la primera. La prueba reabre la primera y comprueba sus valores iniciales. Commit `284fd48`. |
| H2 | La frase Cancel podía referirse al botón del formulario, pero era ambigua en el paso del diálogo. CANDIDATE ahora distingue Discard and Leave del Cancel explícito del formulario. |
| H3 | Eliminado el comentario obsoleto Add on Home; queda la explicación del Add global. Commit `284fd48`. |
| H4 | Endurecido el mensaje de borrado: si deleteAccount rechaza la operación al evaluar los datos actuales, se muestra el motivo, se mantiene la confirmación y no se anuncia deleted. La prueba aislada falló antes al recibir el mensaje falso. Se conserva la protección normal de revisiones entre pestañas. Commit `c40f502`. |

La propuesta de devolver null en H4 no encaja con ChangeSpace, cuyo callback
devuelve FinanceData. No se amplió ese contrato: al rechazo se conservan los
datos actuales y se informa del motivo; un adaptador que confirmase ese cambio
sin efectos ya no provoca un mensaje falso de borrado. La prueba simula ese
camino defensivo, no una carrera reproducida en dos navegadores.

También se atendió la observación de foco: al abrir Delete se enfoca la
confirmación, Cancel vuelve al botón Delete y un borrado confirmado enfoca
la lista Accounts. Verificado automáticamente, no con lector de pantalla.

### Comprobaciones propias de las correcciones

- Antes del arreglo H1, su nueva prueba falló al no encontrar el diálogo.
- Antes del arreglo H4, su nueva prueba falló porque se anunciaba deleted.
- Pruebas afectadas: 48 aprobadas en 4 archivos (MarkPaid, MoneyBlocks,
  AccountDeletionUi y accountDeletion), 27,38 s.
- El primer build encontró un tipo demasiado amplio en el doble de prueba
  de AccountDeletionUi; se tipó con ChangeSpace antes de la validación final.
- Código de cierre de correcciones: `c40f502`.
- Suite completa de cierre propia de Codex: `npm test -- --maxWorkers=2`,
  **815/815 pruebas aprobadas en 59 archivos**, 214,34 s. Se ejecutó una vez
  después de cerrar las correcciones de código.
- Lint y build finales correctos; build conserva el aviso de fragmento
  JavaScript superior a 500 kB. JS 692,72 kB (193,02 kB gzip).
- `git diff --check` y comprobación desde la base revisada: sin errores.
  Avisos conocidos de jsdom sobre scrollTo y navegación, sin pruebas fallidas.
- La entrega pequeña de correcciones se genera fuera de Git en
  `review-deliveries/corrections-8db763e-review.zip`: diff completo desde
  `8db763e`, hashes base/final, archivos cambiados y logs propios de cierre.
  Su recepción y revisión por Claude todavía no se dan por realizadas.
- Solo documentación cambia después de estos controles. No se reescribieron
  los commits revisados, no cambiaron dependencias y no se hizo push, merge
  a main ni despliegue. Los archivos ajenos se conservan sin incluir en commits.

## Revisión de correcciones f7081aa y observaciones opcionales (4 de noviembre de 2026)

- Codex leyó `review-deliveries/REVISION-correcciones-f7081aa.md`, escrito por
  Claude. El revisor considera correctos H1–H4 y el ajuste de foco, sin
  bloqueantes ni regresiones en el alcance revisado. Sus pruebas dirigidas,
  lint, build y recorridos Chromium son resultados del revisor sobre su
  snapshot reconstruido, no ejecuciones nuevas de Codex en esta carpeta.
- Se atienden las dos observaciones opcionales: si un rechazo coincide con
  un fallo de guardado se comunica el resultado de guardado; tras borrar la
  última cuenta se enfoca Add Your First Account. Con cuentas restantes se
  conserva el foco en la lista Accounts. No cambia el contrato de ChangeSpace.
- Archivos propios: `src/features/money/AccountsSection.tsx`,
  `src/AccountDeletionUi.test.tsx`, `src/MoneyBlocks.test.tsx` y este registro.
- Evidencia propia: antes del arreglo, 3 casos fallaron (not-saved, conflict y
  foco de última cuenta), con 27 aprobados. Después: 53/53 en 4 archivos,
  23,72 s, ejecutando MarkPaid, MoneyBlocks, AccountDeletionUi y accountDeletion
  con `npm test -- ... --maxWorkers=2`. Lint, build y git diff --check correctos.
  Persisten los avisos conocidos de scrollTo en jsdom y del fragmento >500 kB.
- No se repite la suite completa: cambio localizado y cobertura de las áreas
  afectadas. Las 815 pruebas anteriores corresponden al código c40f502.
  No se ejecutó audit; no cambiaron dependencias. Sin nueva prueba manual de
  Juan ni navegador propio. Safari/iPhone, gestos, teclado móvil, movimiento
  reducido real y lector de pantalla siguen pendientes.
- Git comprobado: rama `integration/rumbo-03-08`, HEAD/base de estos ajustes
  `f7081aad88f27a80c36ad0b1a65be895f76c13ce`. Cambios propios sin preparar,
  índice vacío. Se preservaron AGENTS.md, CLAUDE.md y docs/WORKFLOW.md pendientes,
  y todos los archivos ajenos sin seguimiento. Sin commit, push, merge o despliegue.
- Siguiente paso: Juan puede probar con datos ficticios la última cuenta:
  crear una cuenta en un espacio vacío, borrarla y comprobar que el foco queda
  en Add Your First Account. Con varias cuentas, debe quedar en Accounts.
  La revisión de estos ajustes sigue pendiente. No se anuncia entrega fija
  hasta autorizar su commit; después se generará el snapshot según WORKFLOW.

## Preparación de entrega fija final-adjustments (4 de noviembre de 2026)

Juan autorizó guardar los ajustes funcionales y la coordinación en commits
locales separados. Se conserva como base f7081aad88f27a80c36ad0b1a65be895f76c13ce.
El primer commit guarda los tres archivos de código/pruebas y CANDIDATE y este
registro. El segundo guarda exclusivamente AGENTS.md, CLAUDE.md y WORKFLOW.md,
con el contenido de coordinación ya pendiente, sin incorporar archivos ajenos.
La entrega fija se obtiene del extremo de esos dos commits, en
`review-deliveries/final-adjustments/<hash-final-completo>/`; allí se registran
los hashes exactos, diff completo, copias de archivos del commit y comprobaciones.

Se reutilizan las 53 pruebas y lint/build ejecutados por Codex el 4 de noviembre:
solo se añaden documentación y commits desde esos controles, sin cambios de
código o dependencias. El log original de las 53 pruebas se conserva; lint y
build se documentan como resultados observados en las herramientas de esta
conversación, sin presentar una transcripción reconstruida como log original.
No se repiten suite, lint ni build por preparar la entrega. CANDIDATE contiene
los recorridos de Juan, aún pendientes. Sin push, merge a main ni despliegue.

## Aprobación de Claude y preparación manual de Juan (4 de noviembre de 2026)

Codex leyó directamente
`review-deliveries/final-adjustments/53a61fc1ec0ce2d92df75a39c81a4cb587cc924e/REVISION.md`.
Claude aprueba los dos ajustes y la coordinación: no encuentra errores ni
regresiones pendientes. Revisión del alcance f7081aa..53a61fc, con código en
eda9966. No se modifica el informe ni el snapshot fijo.

Resultados propios de Claude sobre su snapshot reconstruido, Linux/Node 22.23:
53/53 pruebas en 4 archivos, lint y build correctos; comprobó además que las
3 pruebas de regresión fallan con AccountsSection de f7081aa. En Chromium,
390 y 1280 px, verificó Delete → confirmación, Cancel → Delete y borrado →
lista Accounts cuando quedan cuentas, sin errores de consola. Son resultados
del revisor, no ejecuciones nuevas de Codex ni confirmaciones manuales de Juan.

El borrado de la última cuenta y su foco en Add Your First Account siguen
cubiertos solo automáticamente; Claude no los probó en navegador. El rechazo
coincidente con fallo de guardado también tiene cobertura automática aislada.
Los recorridos de Juan sobre esta candidata, Safari/iPhone, gestos, teclado
móvil, movimiento reducido real y lector de pantalla continúan pendientes.
Se conservan las confirmaciones históricas de Juan con su versión original.

Git comprobado al iniciar esta preparación: integration/rumbo-03-08,
HEAD 53a61fc1ec0ce2d92df75a39c81a4cb587cc924e, índice vacío y sin cambios en
archivos seguidos. Archivos ajenos sin seguimiento conservados. Solo se registra
la revisión y se prepara el acceso local; sin nuevas funcionalidades, nueva
suite, push, merge a main ni despliegue. Esta anotación queda sin preparar.

Servidor manual preparado por Codex: Vite PID 43080, escucha 0.0.0.0:5194,
carpeta C:\Projects\goal-planning-app. El puerto 5193 estaba ocupado por un
Vite del proyecto, pero no respondió por HTTP; se dejó intacto y se usó 5194.
Direcciones exactas de esta sesión: http://localhost:5194/ (ordenador) y
http://192.168.0.238:5194/ (teléfono en la misma Wi-Fi). Respuesta HTTP 200
comprobada por Codex en localhost y dirección LAN desde el ordenador; esto no
acredita conexión desde el teléfono ni recorrido manual en navegador.
Se actualiza CANDIDATE.md con la aprobación y el acceso actual. Ambos cambios
documentales quedan sin preparar; HEAD sigue siendo 53a61fc. No se repitieron
pruebas, lint o build porque no cambió funcionalidad. La entrega fija permanece
intacta y el informe de Claude no se edita.

## Cierre autorizado de Rumbo 03–08 (4 de noviembre de 2026)

Juan autoriza cerrar Rumbo 03–08, guardar únicamente esta documentación e
integrar integration/rumbo-03-08 en main, con fast-forward si es posible y
push normal a origin/main. No autoriza despliegue manual ni push forzado.
Este apartado sustituye las restricciones de integración de los registros
históricos anteriores; no modifica las entregas fijas ni los informes.

No se han comunicado nuevas confirmaciones manuales de Juan. Continúan
pendientes los recorridos de CANDIDATE.md, incluida la última cuenta y su foco,
y Safari/iPhone, gestos, teclado móvil, movimiento reducido real y lector de
pantalla. Small Loan y Credit Card conservan su pendiente manual del 02.
Se mantienen con su alcance original las confirmaciones históricas de
Student Loan y Test Delete; autorizar el cierre no acredita nuevas pruebas.

Se reutilizan las comprobaciones vigentes del código eda9966: 53/53 pruebas
afectadas, lint y build correctos, y la suite de 815/815 sobre c40f502 con su
alcance anterior. En este cierre solo cambia documentación: no se repiten
suite, lint, build ni audit. Codex comprueba el diff y el índice documental.
Se conservan y excluyen todos los archivos ajenos sin seguimiento.

La integración requiere actualizar primero las referencias remotas y comprobar
que main y origin/main son antecesores de la candidata, preservando todos sus
commits. Si aparece una divergencia inesperada se informa antes de resolverla.
El resultado exacto de integración y push se comunica con los hashes de Git.
Según DEVELOPMENT.md, Cloudflare Pages publica automáticamente main al recibir
el push; no se ejecuta ni se modifica el despliegue manualmente.

## Goal Rings: implementación local (4 de noviembre de 2026)

Juan autorizó crear la rama e implementar el encargo local
`review-deliveries/goal-rings/ENCARGO.md`. Editor: Codex; revisor previsto:
Claude, tras el aviso de Juan. No hay autorización de commit, push, merge ni
publicación para esta tarea.

Git comprobado directamente por Codex: rama `codex/goal-rings-home`, base y
HEAD `d825c7400e8706270c09e181b16254d773873a07`. Tras `git fetch origin`,
`origin/main` coincide con esa base. Índice vacío; cambios de esta tarea sin
preparar, incluidos los archivos nuevos. Se conservan todos los archivos ajenos
sin seguimiento y las entregas anteriores.

- Nuevo bloque de Home con anillos SVG, nombres seleccionables, paneles,
  metas y formulario de Contribution compartido con GoalDetailScreen.
- Settings: Show rings on Home, desactivado por defecto y recordado en este
  dispositivo. No se modifica el menú ni las áreas existentes.
- Usa addGoalMovement para assigned y new-savings, con vista previa del efecto,
  elección de cuenta, validaciones y mensajes de guardado existentes. No hay
  Undo en el flujo anterior; no se inventa uno.
- Privacidad por área mediante amountVisibility: también se ocultan las formas,
  porcentajes, vista previa y mensajes posteriores al guardado. Migas, Escape,
  protección de borradores y restauración de foco; movimiento reducido.
- Resúmenes por el mes y la fecha de saldos de Home; una meta abierta muestra su
  estado actual, como Goals. Las metas no se suman a Savings.
- Calendario de next payment y orientación por meses en el dominio; reutiliza
  la programación de facturas. Regular solo se muestra si hay fuente e Irregular
  si el ingreso está marcado extraordinary; en los demás casos se omite la etiqueta.
- Vitest limita el descubrimiento a src: la primera ejecución completa intentó
  ejecutar también snapshots de review-deliveries y se interrumpió. No se cambian
  ni eliminan esas copias.

Comprobaciones propias de Codex sobre el código final, Windows, 4 de noviembre:

- Pruebas afectadas previas: 69/69 en 4 archivos; luego se añadió el caso de dos
  cuentas, incluido en la ejecución completa final.
- `npm test -- --maxWorkers=2`: 839/839, 61 archivos, 204,60 s. Avisos conocidos
  de jsdom sobre scrollTo y navegación, sin fallos.
- `npm run lint`, `npm run build` y `git diff --check`: correctos.
  Build: aviso conocido de fragmento >500 kB; JS comprimido 197,42 kB.
- `npm audit`: 12 avisos moderados en dependencias de desarrollo, sin modificar
  dependencias. `npm audit --omit=dev`: 0 vulnerabilidades. No se presenta el
  audit completo como correcto ni se aplica audit fix.
- Navegador integrado: tras fallar el acceso inicial, servidor local accesible
  en 127.0.0.1:5196. Se abrió el prototipo local y la app; revisión a 1280×900
  y 390×844, modo claro/oscuro, Bills por su nombre, centro siempre Goals,
  Contribution ficticia new-savings de 25 (meta 1800→1825; Savings 2900→2925),
  regreso y ocultación de cifras/arco/porcentajes/formulario. A 390 px se comprobó
  ausencia de desbordamiento horizontal (scrollWidth 375, viewport 390).
  Son verificaciones de Codex, no confirmaciones manuales de Juan.

Resumen de trabajo y recorrido de Juan:
`review-deliveries/goal-rings/WORKING.md`. Logs y capturas al lado. Es material
mutable, no una entrega fija. Pendientes: prueba manual de Juan en ordenador y
móvil real, Safari/iPhone, tacto/teclado móvil, lector de pantalla y movimiento
reducido real; revisión de Claude. La cobertura de assigned y movimiento reducido
es automática, sin atribuirla al recorrido de navegador anterior.

Siguiente paso: Juan prueba y autoriza el commit cuando proceda. Después Codex
creará la entrega fija por hash según WORKFLOW.md, sin sobrescribir ENCARGO,
prototipo ni entregas previas. No se hizo commit, push, merge ni despliegue.
## Goal Rings: commit autorizado para revisión (4 de noviembre de 2026)

Juan autoriza guardar el commit y preparar la entrega fija para Claude. Esta
indicación sustituye únicamente el pendiente de autorización de commit del
apartado anterior. No autoriza push, merge a main ni despliegue, y no confirma
las pruebas manuales pendientes.

Codex guarda solo los 15 archivos de implementación, pruebas, configuración y
WORK_STATUS de esta tarea. ENCARGO, prototipo, logs, capturas, material de revisión
y demás archivos ajenos sin seguimiento quedan fuera del commit. Se reutilizan
los resultados propios anteriores de 839 pruebas, lint y build: en este paso
solo se añade esta anotación documental, sin cambiar código ni dependencias.
La entrega fija se genera del commit final completo en
`review-deliveries/goal-rings/<hash-final-completo>/`, con base exacta, diff,
copias del commit, evidencia y ruta exclusiva para REVISION.md de Claude.
## Goal Rings: correcciones tras revisión de Claude (4 de noviembre de 2026)

Codex leyó directamente el informe fijo
`review-deliveries/goal-rings/03e66bb558bfa4b069c0e303b1e5d213971f925c/REVISION.md`.
Claude recomienda resolver P2-1 y P3-2 a P3-4; sus verificaciones de navegador son
del revisor, no de Juan. El informe y toda la entrega anterior quedan intactos.

Git propio al empezar: `codex/goal-rings-home`, HEAD `03e66bb`, índice vacío y
sin cambios versionados. Se conservan los archivos ajenos sin seguimiento.
Las correcciones quedan sin preparar y sin commit; falta autorización de Juan
para un nuevo commit y su entrega fija. Sin push, merge ni despliegue.

Resoluciones:

- P2-1: los hijos SVG invisibles usan pointer-events:none dentro de una meta.
  openArea ignora además los intentos de navegación mientras hay una meta,
  antes de invocar la protección de borradores.
- P3-2: se limpia change al cambiar de vista, dentro de la acción aceptada por
  la protección de borradores. Cerrar solo Contribution conserva el indicador;
  salir y reabrir la meta no lo repite ni desactiva su dibujo inicial.
- P3-3: anillo y nombre usan openArea y registran la fila equivalente para
  restaurar el foco. Se conserva el regreso al centro cuando ese fue el origen.
- P3-4: la vista previa compara el saldo anterior y posterior de cada cuenta;
  si coinciden muestra «no change», sin flecha. También corrige el formulario
  compartido del detalle de Goals. No cambia ningún cálculo ni guardado.

Comprobaciones propias de Codex sobre estas correcciones:

- Antes de corregir: 7 comprobaciones fallaron y 11 pasaron en GoalRings.test.tsx;
  los fallos reproducen los cuatro hallazgos (incluido el diálogo inesperado).
  Evidencia: review-deliveries/goal-rings/regressions-before-fixes.json.
- Después: npm test -- src/GoalRings.test.tsx src/LeaveForms.test.tsx
  src/AlexDemo.test.tsx --maxWorkers=2: 69/69 en 3 archivos, 33,06 s.
  Incluye todos los casos nuevos/ampliados y regresión del formulario compartido.
- npm run lint, npm run build y git diff --check: correctos.
  Build conserva el aviso de fragmento >500 kB; comprimido 197,45 kB.
- No se repite la suite completa por estas correcciones locales de interacción
  y texto. 839/839 sigue siendo la suite anterior del commit 03e66bb, no un
  resultado nuevo. Se reutiliza el audit anterior (12 moderados de desarrollo,
  0 en producción); no cambiaron las dependencias.
- Navegador integrado en 127.0.0.1:5196, panel visible, escritorio 1280×900:
  seis zonas SVG con pointer-events:none; elementFromPoint junto al arco en
  radios equivalentes 125/175 no encuentra controles invisibles. Un clic en
  r=175 mantiene la meta. Bills por nombre y regreso restaura area-bills.
  New savings ficticio de 25 muestra Piggy Bank «150,00 zł · no change»;
  tras guardar, salir y reabrir no hay rings-added ni rings-progress-new,
  y draw-on-open está presente. Meta 1825→1850 en esta demo local.
  La protección de un borrador frente a clics directos está cubierta por las
  pruebas automáticas; no se atribuye ese caso al recorrido de navegador.
- Se comprobó el importe final del contador; no se acredita una evaluación
  completa de su ritmo o fluidez. El intento de muestrear fotogramas mediante
  el navegador no pudo ejecutarse por una limitación de su evaluador.

Los logs nuevos y el resumen mutable están en review-deliveries/goal-rings/
(review-fixes-*.log y CORRECCIONES.md). No se incluyen en commits de la app.
Pendientes la nueva revisión de Claude y la prueba manual de Juan, incluidas
animaciones/contador, teléfono real, Safari/iPhone y lector de pantalla.
No se aplican las observaciones opcionales de tamaño móvil, semántica,
vista previa en Goals ni diferencia temporal: se conservan para valoración.
## Goal Rings: commit de correcciones autorizado (4 de noviembre de 2026)

Juan autoriza guardar estas correcciones en un nuevo commit y preparar otra
entrega fija para Claude. Sustituye únicamente el pendiente de autorización
de commit del apartado anterior. No autoriza push, merge ni despliegue y no
acredita pruebas manuales de Juan.

Codex prepara solo los cinco archivos de las correcciones y su documentación.
Se reutilizan las 69 pruebas afectadas, lint y build del mismo código y entorno;
solo se añade este registro documental antes del commit. La nueva entrega fija
usará como base 03e66bb558bfa4b069c0e303b1e5d213971f925c y el nuevo hash final,
sin alterar el informe ni las copias anteriores. Los archivos ajenos sin
seguimiento y todo review-deliveries quedan fuera del commit.
## Goal Rings: P3-5, ahorro sin asignar (4 de noviembre de 2026)

Codex leyó directamente
`review-deliveries/goal-rings/2fcde466561166bbf8afd35f29d3f94adb836b91/REVISION.md`.
Claude considera resueltos los cuatro hallazgos previos y comunica P3-5 en la
fila Unassigned savings. Sus pruebas son del revisor, no confirmaciones de Juan.
Juan solicita corregirlo y autoriza expresamente el commit y una nueva entrega
fija. No autoriza push, merge ni despliegue.

Git comprobado al empezar: codex/goal-rings-home, HEAD 2fcde466561166bbf8afd35f29d3f94adb836b91,
índice vacío y sin cambios versionados. Se preservan los archivos ajenos sin
seguimiento y todas las entregas e informes anteriores.

- La fila Unassigned savings compara antes y después mediante savingsSummary,
  como las cuentas: si coinciden, «· no change» sin flecha; si difieren, «→».
  Se reutiliza previewSavings ya calculado. No cambia cálculo ni guardado.
- Prueba parametrizada con New savings (no change, sin flecha) y Savings I
  already have (flecha, sin no change, importe esperado). No guarda datos.
- Antes del arreglo: New savings falló; Savings I already have pasó (18 pruebas
  omitidas por el filtro). Evidencia original: p3-5-before.json.
- Después: npm test -- src/GoalRings.test.tsx src/LeaveForms.test.tsx
  src/AlexDemo.test.tsx --maxWorkers=2: 71/71 en 3 archivos, 33,77 s.
- npm run lint, npm run build y git diff --check: correctos. Build conserva
  aviso de fragmento >500 kB; comprimido 197,46 kB.
- Resultados propios de Codex, Windows, 4 de noviembre; logs p3-5-*.log en
  review-deliveries/goal-rings/. No hay nueva comprobación en navegador ni
  confirmación manual de Juan. Se conservan los pendientes de prueba manual,
  animaciones/contador y dispositivos reales descritos anteriormente.
- Por ser un cambio localizado de presentación sin dependencias ni lógica
  financiera, no se repite la suite completa ni audit. 839/839 corresponde a
  03e66bb; 69/69 corresponde a 2fcde46. No son ejecuciones sobre P3-5.
  El audit anterior conserva sus 12 moderados de desarrollo y 0 de producción.

Se guardan únicamente GoalMovementForm.tsx, GoalRings.test.tsx y este registro.
La nueva entrega fija toma 2fcde466561166bbf8afd35f29d3f94adb836b91 como base y
el nuevo commit completo como extremo. No se incluyen review-deliveries ni
archivos ajenos en el commit. Claude escribirá solo REVISION.md en la nueva
carpeta después del aviso de Juan. Sin push, merge ni despliegue.
## Goal Rings: revisión de código terminada (4 de noviembre de 2026)

Codex leyó directamente el informe
`review-deliveries/goal-rings/9b39cb7a4d9fe0faa6589032073714b382e0349b/REVISION.md`.
Claude confirma P3-5 resuelto y sin hallazgos nuevos; los cuatro hallazgos
anteriores ya estaban resueltos. La revisión de código queda cerrada y la rama
lista para la prueba manual de Juan. No equivale a aprobación de integración.

Claude no ejecutó pruebas, lint, build ni navegador para P3-5; reutilizó las
71 pruebas afectadas, lint y build de Codex. Su comprobación de «Not known · no
change» sin cuenta es por inspección. No se atribuye a una prueba manual de Juan.
Codex no repite comprobaciones funcionales al registrar esta revisión: no hay
cambios de código ni dependencias. Se comprobó Git directamente: rama
codex/goal-rings-home, HEAD 9b39cb7, índice vacío y sin cambios versionados antes
de esta anotación. Se preservan los archivos ajenos sin seguimiento y todas
las entregas e informes. Esta anotación queda sin preparar y sin commit.

Siguiente paso: Juan activa Show rings on Home en Settings con la demo y sigue
el recorrido de DELIVERY.md de 2fcde46, con el panel visible para valorar arco
y contador, también en teléfono y con movimiento reducido. Continúan pendientes
Safari/iPhone, tacto, teclado móvil y lector de pantalla; no hay confirmaciones
nuevas de Juan. Después Juan decide si autoriza integrar en main y publicar.
No se hizo commit, push, merge ni despliegue al registrar el cierre de revisión.
## Goal Rings: integración y publicación autorizadas (4 de noviembre de 2026)

Juan aprueba publicar en main. Esta autorización permite guardar el registro
documental pendiente de revisión, integrar codex/goal-rings-home en main y hacer
push normal a origin/main. Sustituye las restricciones de integración anteriores
para Goal Rings. No autoriza push forzado ni cambios en la configuración de
Cloudflare Pages; la publicación se activa automáticamente al recibir main.

Codex actualizó las referencias con git fetch origin: main y origin/main están
en d825c7400e8706270c09e181b16254d773873a07 y son antecesores de la candidata
9b39cb7a4d9fe0faa6589032073714b382e0349b, comprobado con merge-base. No hay
divergencia y se puede usar fast-forward. Antes de integrar se guarda únicamente
este registro y la anotación pendiente de cierre de revisión en un commit
documental. Las entregas fijas y los informes no se alteran; los archivos ajenos
sin seguimiento se conservan y quedan excluidos.

Se reutilizan los resultados vigentes: suite completa 839/839 de 03e66bb,
69/69 de 2fcde46 y 71/71 de 9b39cb7; lint y build correctos en el último código.
Solo cambia documentación desde esas comprobaciones. No se repiten pruebas,
lint, build ni audit por integrar el mismo contenido. Audit anterior: 12
moderados de desarrollo, 0 de producción. El ajuste sigue desactivado por defecto.

La autorización de publicar no acredita una prueba manual de Juan. Se conservan
los pendientes registrados de animaciones/contador, teléfono real, Safari/iPhone,
tacto, teclado móvil, lector de pantalla y movimiento reducido real. Los hashes
y el resultado exacto del push y de la publicación se comunicarán tras verificar.

## Rediseño móvil — Incremento 1: Money y textos (5 de noviembre de 2026)

Juan autoriza exclusivamente simplificar Money y sus textos, sin cambios de
modelos, cálculos, esquema, almacenamiento, preferencias, Home, Bills,
Getting Started ni navegación global. No autoriza commit, merge, push ni
despliegue. No se comienza el Incremento 2.

Git comprobado por Codex: base main y HEAD
07223f24a1958fef09e98af9fb5a14060e9010a1, índice vacío, sin cambios
versionados y con archivos ajenos sin seguimiento preservados. Rama creada:
codex/mobile-increment-1-money. Los cambios quedan sin preparar.

Money conserva Income, Accounts & Savings y Cards & Loans. Explicaciones
permanentes pasan a ayudas desplegables nativas con foco visible y área de
44 px; estados vacíos más breves y un Add por encabezado. Se conserva el
destino de foco de Add Account tras borrar la última cuenta. Reports & Backup
se elimina de Money y permanece en Settings sin alterar su implementación.
El CSS está limitado a .money-screen. Manual, mapa y recorrido de desarrollo
actualizados. Las pruebas que usaban el enlace retirado acceden por Settings.

Entrega de trabajo y recorrido manual propuesto para Chrome y Safari/iPhone:
review-deliveries/mobile-increment-1/WORKING.md. No es entrega fija por commit;
falta autorización de Juan para guardarlo y generar las copias por hash para
Claude según WORKFLOW.md. No se contactó con Claude. No se verificó navegador
ni se atribuye ninguna prueba manual a Juan.

Comprobaciones propias de Codex: 198/198 en 7 suites afectadas (102,07 s),
lint, build y git diff --check correctos. Ejecución final sobre código y
pruebas estabilizados; antes se corrigió una expectativa del texto vacío.
Build: JS 706,78 kB, gzip 197,19 kB; aviso conocido >500 kB. No se repiten
suite completa ni audit: sin cambios financieros ni dependencias. Logs y
detalle en VALIDATION.md junto al resumen de trabajo. Pruebas visuales y
manuales pendientes; resultados no atribuidos a Juan.

## Incremento 1: commit y entrega fija autorizados (5 de noviembre de 2026)

Juan autoriza guardar el incremento y preparar la entrega fija para Claude.
Esta autorización sustituye únicamente el pendiente de commit del apartado
anterior. No autoriza merge, push ni despliegue, ni confirma pruebas manuales.
Codex comprobó que el diff coincide con el de la entrega de trabajo antes de
esta anotación. Se reutilizan las 198 pruebas afectadas, lint y build del
mismo código; solo se añade este registro documental. Se guardan únicamente
los 14 archivos propios de implementación, pruebas y documentación. El índice
estaba vacío. Archivos ajenos sin seguimiento y review-deliveries quedan fuera.
La entrega fija usa la base 07223f24a1958fef09e98af9fb5a14060e9010a1 y el
commit final, con copias obtenidas de Git y ruta exclusiva REVISION.md de Claude.
Siguen pendientes Chrome y Safari/iPhone; no se inicia Incremento 2.
