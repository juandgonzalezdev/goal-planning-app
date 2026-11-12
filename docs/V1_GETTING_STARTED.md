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

- Misma clave del dispositivo: `goal-planning-app.getting-started` → `{ spaceId, progress }`.
- Sin datos financieros. Nunca va en los datos del espacio ni en la copia de seguridad.
- `last` solo dice qué etapa abrir al volver (`resumeStep`). Nunca decide si una
  etapa está completa. GS-1 no lo escribe todavía: lo harán las pantallas de GS-3 (`visitStep`).
- La demo mantiene su progreso en memoria (`DEMO_PROGRESS`, oculto al empezar) y nunca lo guarda.
- Show Getting Started on Home (`resumeGuide`) devuelve las etapas omitidas,
  reabre un recorrido terminado y **conserva** las respuestas `none`.

### Compatibilidad con el progreso anterior

`readProgress` lee cualquier valor sin bloquear la aplicación y **nunca escribe**.
El valor solo se reescribe, en v2, cuando el usuario cambia algo.

- Sin `version` (antes de v1.0): mismos ids. `day-to-day` se lee como `finish` y
  nunca queda como omitida. `hidden` y `finished` se respetan. Un antiguo
  «I Have None» se guardaba como `skipped` y **sigue como skipped**, porque no se puede
  saber si significaba `none`. Un campo `none` en un valor antiguo se ignora.
- Versión futura (> 2): se leen los campos conocidos y se ignoran los demás.
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
- **Goals** (provisional hasta GS-5) muestra lo que ya hay y abre la pantalla existente
  (`Add a Goal` → `new-goal`). Su Back/Cancel vuelve a la etapa. Desde GS-4, Debts y
  Bills tienen su formulario dentro de la etapa (ver abajo).

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

### Finish (provisional)

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

## Pendiente

| Paso | Estado | Contenido |
| --- | --- | --- |
| GS-3 | **Implementado** | Lo descrito arriba, incluida D-GS9 y `I don't have regular income`. |
| GS-4 | **Implementado** | Debts y Bills dentro de la etapa, D-GS6 en ambas, `I don't have any debts` (D-GS3), pagos ya vinculados sin duplicar. |
| GS-5 | Pendiente | Goals: Emergency Fund y New Goal desde la etapa; no duplicar la invitación al fondo en Home. |
| GS-6 | Pendiente | Finish Setup con resumen y sin confirmación (D-GS7); `Whose income is this?` en Duo (D-GS5). |
| GS-7 | Pendiente | Documentación final y recorridos manuales (Home y Help & Guide ya permiten retomar, D-GS8). |

| Decisión | Estado |
| --- | --- |
| D-GS9 | Implementada en GS-3, conservada en GS-4 |
| D-GS3 | Implementada (Income en GS-3, Debts en GS-4) |
| D-GS6 | Implementada en Debts y Bills (GS-4); Goals pendiente (GS-5) |
| D-GS5 | Pendiente (GS-6) |
| D-D2-INTEREST | Pendiente (mejora funcional del módulo Debts) |

Getting Started v1.0 **no está completo**: faltan GS-5, GS-6 y GS-7.

## Decisión registrada para la fase Debts

**D-D2-INTEREST — Interest rate: known zero, known positive rate, or unknown.**

- Un 0 % confirmado y una tasa desconocida son estados distintos.
- Una tasa desconocida nunca se convierte en 0 % sin avisar. **Nunca usar 0 % como valor por defecto.**
- Una proyección que depende de una tasa desconocida no se presenta como fiable.
- El futuro formulario de Debts permitirá guardar, de forma explícita, una deuda con tasa desconocida.
- Se implementa en la fase Debts (D2), no en GS-1. Hasta entonces, el formulario
  actual sigue exigiendo el interés (D-GS4).
