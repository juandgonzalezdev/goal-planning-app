# Getting Started v1.0

Estado del trabajo de Getting Started para v1.0 y decisiones aprobadas.
Informe de partida: `INFORME-GETTING-STARTED-V1.md` (entregado fuera del repositorio).
Dirección aprobó D-GS1 a D-GS8 el 12-11-2026.

## GS-1: modelo de progreso (este paso)

Código: `src/features/home/gettingStarted.ts`. Pruebas: `gettingStarted.test.ts`
y `src/Help.test.tsx` › Getting Started.

### Orden de etapas

| # | Id interno | Etapa | Completa cuando… |
| --- | --- | --- | --- |
| 1 | `accounts` | Accounts & Savings | hay al menos una cuenta |
| 2 | `income` | Income | hay al menos una fuente de ingreso, **o** el usuario declaró `none` |
| 3 | `debts` | Debts | hay al menos una deuda, **o** el usuario declaró `none` |
| 4 | `bills` | Bills & Subscriptions | hay al menos una factura **sin** `debtId` (los pagos que crea una deuda no cuentan) |
| 5 | `goals` | Goals | hay al menos una meta **o** el Emergency Fund (D-GS2) |
| 6 | `finish` | Finish Setup | solo cuando se termina el recorrido (`finished`) |

Las etiquetas visibles se definieron en GS-3 (Accounts & Savings, Income, Debts,
Bills & Subscriptions, Goals, Finish).

### Estados de una etapa

- `done`: el espacio tiene lo que pide (o, en `finish`, el recorrido terminó).
  **Los datos reales tienen prioridad** sobre cualquier respuesta guardada.
- `none`: el usuario declaró que no tiene ninguno. Solo para `income` y `debts`.
  Cuenta como completa, **no crea datos** y no vuelve al retomar la guía.
- `skipped`: pendiente para después. No cuenta como completa y vuelve al retomar.
- `to-do`: sin hacer.

`none` y `skipped` se excluyen mutuamente: declarar `none` quita el `skipped`
de esa etapa, y omitirla quita el `none`.

### Progreso guardado (v2)

```ts
{ version: 2, hidden, skipped: StageId[], none: ('income' | 'debts')[], finished, last: StageId | null }
```

- Desde GS-6A.1 se guarda en IndexedDB, almacén `meta`, un registro por espacio
  (`guide-progress:<id>`) con **revisión propia**, separado de `FinanceData` y de
  la revisión del espacio. Antes vivía en localStorage
  (`goal-planning-app.getting-started` → `{ spaceId, progress }`); ese valor se
  trae una sola vez y ya no se escribe. Detalle en
  `docs/STORAGE_AND_RECOVERY.md` §10.
- Sin datos financieros. Nunca va dentro de los datos del espacio. Desde GS-6A.1
  sí va en la copia de seguridad, separado de los registros (`gettingStarted`).
- `last` solo dice qué etapa abrir al volver (`resumeStep`). Nunca decide si una
  etapa está completa. GS-1 no lo escribe todavía: lo harán las pantallas de GS-3 (`visitStep`).
- La demo mantiene su progreso en memoria (`DEMO_PROGRESS`, oculto al empezar) y nunca lo guarda.
- Show Getting Started on Home (`resumeGuide`) devuelve las etapas omitidas y
  **conserva** las respuestas `none`. Desde GS-6B **nunca** reabre un recorrido
  terminado (D-GS6-24): con `finished`, Help & Guide ofrece Review Setup.

### Compatibilidad con el progreso anterior

`readProgress` lee cualquier valor sin bloquear la aplicación y **nunca escribe**.
Desde GS-6A.1 se usa para traer el valor antiguo de localStorage a IndexedDB una
sola vez; lo guardado en IndexedDB se comprueba con `checkProgress`, que es
estricto (ver GS-6A.1 más abajo).

- Sin `version` (antes de v1.0): mismos ids. `day-to-day` se lee como `finish` y
  nunca queda como omitida. `hidden` y `finished` se respetan. Un antiguo
  «I Have None» se guardaba como `skipped` y **sigue como skipped**, porque no se puede
  saber si significaba `none`. Un campo `none` en un valor antiguo se ignora.
- Versión futura (> 2): `readProgress` lee los campos conocidos. Desde GS-6A.1
  un valor así no se trae de localStorage, y un registro así en IndexedDB queda
  bloqueado: nunca se lee como `finished: true` ni se sobrescribe.
- Valor dañado o desconocido: guía nueva. Ids desconocidos y un `last` no válido se descartan.

### Adaptación mínima del panel actual

- El panel muestra los pasos en el nuevo orden (Accounts primero) con sus textos actuales.
- El botón existente **I Have None** de Cards and loans guarda ahora `none` en
  lugar de `skipped` (D-GS3). No se añadió ningún botón: la opción de Income
  llegará con su pantalla de etapa (GS-3).
- Help & Guide y `guideContent.ts` describen el nuevo orden.
- Un paso `none` se ve igual que uno hecho (✓), y el lector de pantalla dice «none».

## GS-2: formularios reutilizables

Los formularios de Add Account / Edit e Add Income / Edit salieron de sus
secciones de Money sin cambiar lo que ve ni lo que guarda el usuario:

| Pieza | Qué contiene | Qué no contiene |
| --- | --- | --- |
| `features/money/accountDraft.ts`, `incomeDraft.ts` | Borrador y valores iniciales (`new…Draft`, `edit…Draft`), título y campos para «Leave without saving?» (`…FormTitle`, `…TypedFields`), comprobaciones y el cambio a guardar (`prepare…Save`, con los mismos mensajes y el mismo orden) | Estado de React, guardado, navegación |
| `features/money/AccountForm.tsx`, `IncomeSourceForm.tsx` | Los campos y los botones Save/Cancel, controlados por props (`draft`, `onDraftChange`, `saving`, `blocked`, `onSave`, `onCancel`) | Estado propio, `MoneyBlocksContext`, navegación, persistencia |
| `AccountsSection.tsx`, `IncomeSection.tsx` (el anfitrión) | El borrador abierto, su registro con `useUnsavedChanges`, el aviso al cambiar de formulario (`useLeaveGuard`), el guardado con `onChange` y su revisión base, el mensaje y el foco | — |

Un anfitrión nuevo, como la etapa de GS-3, hace lo mismo que Money: guarda el
borrador en su estado, lo registra con
`useUnsavedChanges(accountFormTitle(d), accountTypedFields(d))`, llama a
`prepareAccountSave` y guarda `apply` con su `onChange` (igual para Income).

**Observación conocida, sin cambios en GS-2:** en Money, si se abre Add Account
(o Add Income) sin escribir y después Edit de otro registro, el formulario de
Edit cuenta como modificado y salir pregunta «Leave without saving?» aunque no
se haya escrito nada. Ya ocurría en la base. Se conserva porque GS-2 no cambia
el comportamiento; se puede corregir aparte si Dirección lo decide.

## GS-3: pantallas de etapa y navegación flexible (implementado)

El panel grande de Home se sustituye por una **tarjeta compacta** y una **pantalla
de etapa** propia. No hay un segundo modelo de progreso ni un esquema nuevo: todo
se deriva de los registros y del progreso v2 de GS-1.

| Pieza | Archivo |
| --- | --- |
| Tarjeta de Home: `Getting Started`, `Step N of 6 · <etapa>`, barra de 6 segmentos, `Start setup` / `Continue setup`, `Hide for now` | `features/home/GettingStartedCard.tsx` (sustituye a `GettingStartedPanel.tsx`) |
| Pantalla de etapa: lista de etapas, título, pregunta, explicación, contenido, Back / Skip for now / Continue, Close | `features/guide/GuideScreen.tsx` |
| Etapas con formulario (anfitriones de GS-2) | `features/guide/AccountsStage.tsx`, `IncomeStage.tsx` |
| Textos | `features/guide/guideText.ts` (inglés sencillo, fuera del catálogo i18n como el resto de estas pantallas hasta B2–B5) |
| Reglas puras nuevas | `gettingStarted.ts`: `openingStep`, `guideStarted`, `stepReachable`, `previousStep`, `nextStep` |

### Navegación

- La guía es la pantalla `guide` (`app/navigation.ts`): un flujo más, **no una pestaña**.
  Las cinco pestañas no cambian. Se abre desde la tarjeta de Home y desde
  **Settings › Help & Guide › Open Getting Started** (que sigue ofreciendo
  `Show Getting Started on Home`).
- Toda la guía es **un solo paso** del historial del navegador. Cambiar de etapa no
  añade pasos (no hay historiales duplicados): el botón Back del navegador o el gesto
  del iPhone salen de la guía a donde se abrió, igual que **Close**. **Back** dentro
  de la pantalla retrocede una etapa.
- La etapa en pantalla vive en memoria (`guideStage` en `App.tsx`); al cambiar de etapa
  se guarda `last` con `visitStep`. Al volver se abre `openingStep`: la última etapa
  visitada si sigue pendiente; si no, la primera pendiente.
- Desde GS-4, Debts y Bills tienen su formulario dentro de la etapa, y desde GS-5 también
  Goals (ver abajo). En GS-3, Goals abría la pantalla `new-goal`; ya no.

### D-GS9 (implementada): regla de acceso elegida

- **Back** retrocede una etapa. **Skip for now** guarda `skipped` y avanza una etapa.
  **Continue** solo aparece cuando la etapa está completa y avanza una etapa.
- En la lista de etapas se puede abrir **cualquier etapa alcanzada**: completa
  (`done`/`none`), omitida, la primera pendiente (`currentStep`) y todas hasta la
  que está en pantalla. Las etapas posteriores nunca alcanzadas están desactivadas
  y se abren en orden con Continue o Skip for now. Con la guía terminada, todas se
  pueden abrir.
- Visitar una etapa **no la completa** ni le quita `skipped`; solo los registros reales,
  una respuesta `none` o Done en Finish cambian el estado.
- Estados visibles: **Completed** (✓, relleno morado), **Skipped** (círculo
  discontinuo), **Not started** (número), y la etapa en pantalla con anillo y
  `aria-current="step"`. Cada botón tiene una etiqueta accesible
  «Income, step 2 of 6: Skipped, current». No depende solo del color. Botones de
  44 × 44 px como mínimo; por debajo de 420 px solo se ven los números.

### Borradores

Las etapas Accounts e Income registran su borrador con `useUnsavedChanges`, guardan con
la revisión con que se abrió el formulario y conservan el formulario si el guardado no
se confirma. Back, Continue, Skip for now, la lista de etapas, las pestañas, Close y el
Back del navegador pasan por la protección existente («Leave without saving?»); con un
guardado en curso, el movimiento espera a la respuesta. Un formulario sin cambios no
pregunta. La observación conocida de Money (Add sin editar → Edit) no se toca: no afecta
a la guía, que solo abre formularios nuevos.

### Ocultar importes

La pantalla `guide` recibe el mismo estado de ocultación que Home, Bills y History
(`AmountVisibilityProvider` en `App.tsx`; no hay un segundo estado). Las listas de
Accounts e Income usan `useAllAmounts`, como Bills y History: con **Hide amounts**
(el ojo de la cabecera, todas las áreas ocultas) muestran `••••` y el lector de
pantalla oye «amount hidden». «Not entered» se sigue mostrando, porque no es un
importe. Los formularios nuevos muestran lo que el usuario escribe. Los mensajes
de guardado no incluyen importes. Money no sigue este control (ya era así antes de
GS-3 y queda fuera de este alcance).

### Finish (provisional, sustituido por GS-6B; ver abajo)

Muestra el estado de las cinco etapas en palabras. **Done** guarda `finished` (la
semántica de GS-1, la misma que el antiguo Done) y cierra la guía; las etapas omitidas
siguen omitidas. Queda para GS-6: resumen final, «Your journey starts here!», Finish
Setup sin confirmación (D-GS7) y `Whose income is this?` (D-GS5).

## GS-4: Debts y Bills dentro de la guía (implementado)

Las etapas 3 y 4 alojan los formularios que ya existían, como Accounts e Income alojan
los de GS-2. No hay una segunda implementación de campos, validaciones ni guardado.

| Pieza | Archivo |
| --- | --- |
| Etapa Debts: lista `Your debts` (nombre, tipo, Remaining Balance, `Already in your bills`), `Add a Debt` / `Add Another Debt` | `features/guide/DebtsStage.tsx` |
| Formulario de tarjeta o préstamo, ahora exportado; `inline` quita el enlace Back propio y usa un h2 `Add a Debt` | `DebtForm` en `features/cards/DebtScreen.tsx` |
| Etapa Bills: `Your bills`, `Debt payments already in your bills`, `Add a Bill` / `Add Another Bill` | `features/guide/BillsStage.tsx` (aloja `features/bills/BillForm.tsx` sin cambios) |

### Reutilización

- **Debts**: el mismo `DebtForm` de la pantalla `debt` (Money › Cards & Loans › Add Card or
  Loan), con `readDebtDraft` y `applyDebtForm` de `debtDraft.ts`. Mismos campos, mismo
  interés obligatorio (0 válido), mismo «Add this payment to my monthly bills» marcado por
  defecto, misma revisión base (`useEditBase`) y mismo `useUnsavedChanges`.
- **Bills**: el mismo `BillForm` de la pantalla `bill`, sin cambios: importe conocido o
  `Amount not known yet` (se guarda `null`, nunca 0), frecuencias `Every month`,
  `Every year` y `One month only`, More details (categoría, mes final,
  `Pays a card or loan`, nota). Una factura nueva empieza en el mes de hoy; la guía no
  cambia el mes compartido ni el calendario.
- **Cambio en `DebtForm` válido en toda la app**: una protección local contra doble
  pulsación (`saving`, como ya tenía `BillForm`). En la base, en la demo, dos pulsaciones
  seguidas de **Add** creaban dos deudas (reproducido en `bf36c8e`); en el espacio propio
  el almacén ya respondía `busy`. El mensaje de alta es ahora `Debt added.`, que solo usa
  la guía (la pantalla `debt` sigue abriendo el detalle, como antes).

### D-GS6 (implementada en Debts y Bills)

Tras un guardado confirmado el usuario **permanece en la etapa**: el formulario se cierra,
el registro aparece en la lista, el estado se recalcula con los datos reales, el foco va a
`Add Another …` y un mensaje dice `Debt added.` / `Bill added.` con el resultado del
guardado. **Cancel** cierra sin guardar. Si el guardado no se confirma (navegador, otra
pestaña), el formulario sigue como estaba y dice por qué. Fuera de la guía nada cambia:
Money abre el detalle de la deuda creada y Bills sigue su flujo propio.

### D-GS3 (implementada en Debts)

`I don't have any debts` sustituye a `I Have None` y guarda `none` con el modelo v2 de
GS-1 (`declareNone`); no crea ningún registro. **Skip for now** guarda `skipped`, nunca
`none`. Los registros reales tienen prioridad: si después se añade una deuda, la etapa
pasa a Completed y la respuesta `none` no lo impide. Con una deuda ya registrada no se
ofrece `I don't have any debts`. No hay un segundo indicador.

### Pagos de deudas que ya son facturas

- La relación es la que guarda la factura (`debtId`), leída con `linkedBill` de
  `domain/finance/debts.ts`. Nunca por nombres parecidos.
- Debts muestra `Already in your bills` en la tarjeta o préstamo con factura vinculada.
- Bills los lista aparte (`Debt payments already in your bills`) con
  «This debt payment is already included in your bills.» No cuentan para completar la
  etapa Bills (regla de GS-1, `stepDone`).
- «Not in your bills yet: the monthly payment you entered for …» solo aparece para una
  deuda cuyo pago está guardado en la propia deuda (`debtPayment` con `source: 'debt'` e
  importe mayor que 0) y que no ha terminado (préstamo sin `finalPaymentMonth` pasado).
  Una deuda sin pago configurado no recibe ningún aviso. El texto explica cómo añadirla
  con `Pays a card or loan`, que la vincula sin duplicar (`debt-already-paid` impide una
  segunda factura). Corrección de la revisión de Juan (v2).
- Recorrer Debts y Bills no crea facturas: solo el guardado de la deuda, como antes.

### Borradores

Los dos formularios ya registraban su borrador con `useUnsavedChanges`; dentro de la etapa
quedan cubiertos por la misma protección que Accounts e Income: Back, Skip for now,
`I don't have any debts`, la lista de etapas, las pestañas, Close, el Back del navegador y
Exit Demo preguntan «Leave without saving?». Keep Editing conserva lo escrito; Discard and
Leave mueve una sola vez; con un guardado en curso, el movimiento espera a la respuesta.

### Hide amounts

Las listas de Debts y Bills usan `useAllAmounts` y `Amount.tsx` (GS-3). `Unknown` y
`Not entered` se mantienen. Los mensajes de guardado no contienen importes.

### Limitaciones conocidas

- Solo existen los tipos `card` (Credit Card) y `loan`. Las deudas personales (familia,
  amigos) siguen pendientes del módulo Debts (necesitan esquema v4).
- D-D2-INTEREST sigue pendiente: el interés es obligatorio, como antes.
- El formulario de deuda no lleva el foco al primer error (ya era así en Money).

## GS-5: Goals y Emergency Fund dentro de la guía (implementado)

La etapa 5 aloja los formularios que ya existían, como las demás etapas. No hay un segundo
formulario de metas, ni un segundo servicio de creación, ni un segundo Emergency Fund.

| Pieza | Archivo |
| --- | --- |
| Etapa Goals: pregunta `What are you saving for?`, lista `Your goals` (Emergency Fund primero, luego las metas activas), `Add a Goal` / `Add Another Goal`, `Start an Emergency Fund` | `features/guide/GoalsStage.tsx` |
| Formulario New Goal y su paso `Check Your Goal`; `inline` quita el enlace Back propio, usa h2 y añade Cancel en la confirmación | `NewGoalScreen` en `features/goals/NewGoalScreen.tsx` (campos `GoalFormFields`, reglas `readGoalDraft`) |
| Guardado de Create Goal, compartido por la pantalla New Goal y la etapa | `saveNewGoal` en `features/goals/goalDraft.ts` (llama a `createGoal` del dominio, como antes `App.tsx`) |
| Borrador del Emergency Fund; `inline` quita el Back propio, baja los títulos (h2/h3) y entrega el fondo guardado a la etapa (`onSaved`) | `EmergencyScreen` en `features/goals/EmergencyScreen.tsx` |
| Guardado del Emergency Fund (también reinicia «Maybe Later» de Home, como antes) | `saveEmergency` en `App.tsx`, el mismo para la pantalla `emergency` y la etapa |

### Metas con fecha y sin fecha

- Con fecha (`With Date`): objetivo obligatorio y fecha posterior a hoy, como en New Goal. La
  confirmación muestra el ritmo sugerido (`GoalPace`), sin compromiso.
- Sin fecha (`Flexible`): se guarda `deadline: null`; no se pide ni se inventa una fecha. La
  lista dice `Flexible · No deadline`. El objetivo es opcional (`No target`).
- Toda meta nueva empieza en 0 (`openingBalance: 0`, sin movimientos). No cambian cálculos,
  ritmo, progreso, fechas, historial ni esquema.

### Emergency Fund (D-GS2)

- Es un registro `Goal` con `kind: 'emergency'` (uno activo como máximo, `emergencyFund`).
  No es una meta ordinaria y la etapa no crea ninguna junto a él.
- Cuenta para completar Goals por sí solo (`stepDone`, sin cambios desde GS-1). Si no existe,
  la etapa no se completa y no se crea nada.
- Se lista una vez, como `Emergency Fund · For unexpected costs · No deadline`, con su objetivo
  o `No target`. Con fondo, `Start an Emergency Fund` ya no se ofrece; la revisión sigue en Goals.
- `Start an Emergency Fund` abre el mismo borrador de Goals: gastos esenciales × meses (sin
  importe recomendado propio), `Create Emergency Fund` o `Create Without a Target`, y el importe
  opcional ya apartado, limitado a la parte de Savings sin propósito (`assigned`). No crea
  cuentas ni cambia saldos.

### D-GS6 y D-GS9 en Goals

Tras **Create Goal** o **Create Emergency Fund** confirmado: el formulario se cierra, el
usuario sigue en Goals, el registro aparece, el estado se recalcula, el foco va a
`Add Another Goal` (o `Add a Goal`) y el mensaje es `Goal added.` / `Emergency Fund added.`
con el resultado del guardado (`Saved on this device.` o el de la demo). **Cancel** (en el
formulario o en la confirmación) cierra sin guardar. Si el guardado no se confirma, la
confirmación sigue como estaba y dice por qué. Fuera de la guía nada cambia: Goals › Add Goal
sigue abriendo la meta creada y Start an Emergency Fund sigue mostrando «Your Emergency Fund is saved.».

`Skip for now` guarda `skipped`; abrir el formulario o dejar un borrador no completa nada.
No hay `I don't have any goals`: Goals sigue sin respuesta `none` (no está en `NONE_STEPS`).

### Borradores

La etapa guarda el borrador de New Goal y lo registra con `useUnsavedChanges('New Goal', …)`
(no como borrador «kept»: salir pregunta). El borrador del Emergency Fund ya se registraba solo.
Back, Continue, Skip for now, la lista de etapas, las pestañas, Close, el Back del navegador y
Exit Demo preguntan «Leave without saving?»; un formulario sin cambios no pregunta; con un
guardado en curso, el movimiento espera a la respuesta. El borrador «kept» de New Goal de la
pestaña Goals (`app:new-goal` en `App.tsx`) es otro y no cambia.

### Doble pulsación en Create Goal (cambio válido en toda la app)

En la base, en la demo, dos pulsaciones seguidas de **Create Goal** creaban dos metas
(reproducido en `e653e66` desde Goals › Add Goal). `NewGoalScreen` tiene ahora la misma
protección local que `DebtForm` (GS-4): un `saving` ref. En el espacio propio el almacén ya
respondía `busy`.

### Hide amounts

La lista usa `useAllAmounts` y `Amount.tsx`: lo guardado, el objetivo y lo que falta muestran
`••••` y el lector oye «amount hidden». Nombre, tipo, fecha, `No deadline` y `No target` se
mantienen. Los mensajes no llevan importes. Lo que el usuario escribe (y su confirmación) se ve.

### Individual y Duo

Sin cambios: una meta nueva pertenece a la persona en Individual y a `shared` en Duo, igual
que New Goal en Goals. GS-5 no añade selector de propietario (GS-6).

### Limitaciones y observaciones para GS-6

- (Corregido en GS-6B, D-GS6-10.) `stepDone('goals')` contaba cualquier registro `goal`/`emergency`, también uno **archivado**,
  que la lista (y Goals) no muestran: un espacio con solo una meta archivada ve Goals como
  Completed y «No goals yet.». Ya era así en GS-1; no se cambia sin decisión.
- Los importes de la confirmación `Check Your Goal` (y el ritmo sugerido) son los que el usuario
  acaba de escribir y no se ocultan, igual que fuera de la guía.
- El borrador del Emergency Fund es largo dentro de la etapa (es el mismo de Goals).

## Pendiente

| Paso | Estado | Contenido |
| --- | --- | --- |
| GS-3 | **Implementado** | Lo descrito arriba, incluida D-GS9 y `I don't have regular income`. |
| GS-4 | **Implementado** | Debts y Bills dentro de la etapa, D-GS6 en ambas, `I don't have any debts` (D-GS3), pagos ya vinculados sin duplicar. |
| GS-5 | **Implementado** | Goals con New Goal y el borrador del Emergency Fund dentro de la etapa, metas con y sin fecha, D-GS6 en Goals, D-GS2 conservada. La invitación de Home desaparece en cuanto existe el fondo (sin cambios). |
| GS-6A.1 | **Implementado** | Progreso transaccional y Backup/Restore. |
| GS-6B | **Implementado** | Finish con resumen, Finishing…/Try Again, Review Setup, metas archivadas (D-GS6-09 a D-GS6-24). |
| GS-6 (resto) | Pendiente | `Whose income is this?` en Duo (D-GS5). |
| GS-7 | Pendiente | Documentación final y recorridos manuales (Home y Help & Guide ya permiten retomar, D-GS8). |

| Decisión | Estado |
| --- | --- |
| D-GS9 | Implementada en GS-3, conservada en GS-4 y GS-5 |
| D-GS3 | Implementada (Income en GS-3, Debts en GS-4) |
| D-GS6 | Implementada en Debts y Bills (GS-4) y en Goals (GS-5) |
| D-GS2 | Implementada en GS-1, conservada en GS-5 (el Emergency Fund completa Goals) |
| D-GS5 | Pendiente (GS-6) |
| D-D2-INTEREST | Pendiente (mejora funcional del módulo Debts) |

Getting Started v1.0 **no está completo**: faltan GS-6 y GS-7.

## Decisión registrada para la fase Debts

**D-D2-INTEREST — Interest rate: known zero, known positive rate, or unknown.**

- Un 0 % confirmado y una tasa desconocida son estados distintos.
- Una tasa desconocida nunca se convierte en 0 % sin avisar. **Nunca usar 0 % como valor por defecto.**
- Una proyección que depende de una tasa desconocida no se presenta como fiable.
- El futuro formulario de Debts permitirá guardar, de forma explícita, una deuda con tasa desconocida.
- Se implementa en la fase Debts (D2), no en GS-1. Hasta entonces, el formulario
  actual sigue exigiendo el interés (D-GS4).

## GS-6A.1: progreso transaccional y Backup/Restore

Implementado sobre `669984a` (rama `feature/gs-6a-persistence`). Solo
persistencia; la experiencia visual de Finish (Finishing…, Try Again, Review
Setup, resumen) es de GS-6B.

- **Dónde:** IndexedDB, almacén `meta`, `guide-progress:<id>` →
  `{ format: 1, spaceId, revision, savedAt, progress }`. Revisión propia; los
  cambios de la guía no suben la revisión del espacio.
- **Contrato** (`SpaceStore`): `loadProgress(spaceId)` → `loaded` | `locked` |
  `unavailable` | `failed`; `saveProgress(spaceId, progress, baseRevision)` →
  `saved` | `conflict` | `failed`; `restore(data, baseRevision, guide)` para
  Restore Backup en una sola transacción.
- **App:** `useSpace` lee el progreso antes de mostrar el espacio y expone
  `guide` (lo confirmado), `changeGuide(cambio)` (asíncrono, devuelve
  `GuideOutcome`) y `backupText()`. La demo sigue en memoria (`demoGuide`).
- **Estados de etapa:** se siguen derivando de los registros guardados
  (`stepStates`); `finished` sigue siendo independiente (D-GS6-21/22).
- **Errores:** Skip for now, la respuesta «none» y Done esperan a que se guarde.
  Si no se guarda, la pantalla se queda en la misma etapa con un aviso mínimo
  (`role="alert"`) y la respuesta se puede volver a dar. Moverse entre etapas
  abre la etapa al momento y guarda `last` en segundo plano; si falla, también
  se avisa. Hide for now y Show Getting Started on Home avisan igual.
- **Migración, Backup/Restore, Erase, Recovery, pestañas y límites:**
  `docs/STORAGE_AND_RECOVERY.md` §10.

## GS-6B: Finish y Review Setup

Implementado sobre `b0f6dd4` (rama `feature/gs-6b-finish-review`). Reutiliza la
persistencia de GS-6A.1 sin cambiarla: ni almacén, ni formato, ni revisión.

- **Estados (D-GS6-13):** `stageStateWords` (`features/guide/guideText.ts`) da
  Completed, No regular income (solo Income), No debts (solo Debts), Skipped y
  Not started. Finish sin terminar dice Not finished. Sustituye a «Completed (none)».
- **Goals (D-GS6-10):** `stepDone('goals')` solo cuenta metas activas
  (`activeGoals`) o el Emergency Fund activo (`emergencyFund`), lo mismo que lista
  la etapa. Una meta archivada no completa Goals.
- **Finish (D-GS6-09/15/19/20):** resumen de las cinco etapas, cada línea abre su
  etapa, sin importes. Sin registros, un aviso breve que no bloquea
  (`setupHasRecords`: existencia de cuentas, fuentes de ingreso, deudas, facturas
  o metas en cualquier estado, incluidas las archivadas; no es lo mismo que una
  etapa completa. GS-6B.1, D4). Done espera a
  `changeGuide(finishGuide)`: mientras guarda dice **Finishing…**
  (`aria-disabled`, una segunda pulsación no hace nada); si no se guarda dice
  **Try Again** con el motivo (`role="alert"`) y no cierra. Guardado → Home, sin
  la tarjeta. Abierta desde Home, es Back a ese paso; desde otro sitio (Help &
  Guide, o tras recargar), Home sustituye al paso de la guía.
- **Review Setup (D-GS6-12/14/16):** con `finished`, Home options › Review Setup
  y Help & Guide › Getting Started › Review Setup abren la etapa `finish`, titulada
  Review Setup, con Close. Abrirla o moverse entre etapas **no escribe** progreso
  (`last` no sirve con la guía terminada). Close vuelve a donde se abrió, con la
  protección de formularios. Los cambios en las etapas no tocan `finished`.
- **Sin reinicio (D-GS6-24):** `resumeGuide` conserva `finished`; Help & Guide ya
  no ofrece Show Getting Started on Home ni Open Getting Started tras Finish.
- **Datos (D-GS6-21/22/23):** los estados salen siempre de los registros guardados
  y de las respuestas guardadas; un borrador nunca completa una etapa. Si se borran
  registros, la etapa vuelve a su respuesta (`none`, `skipped`) o a Not started;
  `finished` no se deshace. Tener registros nunca pone `finished`.
- **Demo (D-GS6-17):** igual que en GS-6A.1, el progreso de la demo vive en
  memoria; Review Setup también funciona en la demo. Nada pasa al espacio propio.
- **Backup/Restore (D-GS6-18):** sin cambios respecto a GS-6A.1.

Pruebas: `src/GuideFinishReview.test.tsx` (app completa) y la sección GS-6B de
`src/features/home/gettingStarted.test.ts`.
