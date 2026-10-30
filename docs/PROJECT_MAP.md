# Mapa del proyecto

Dónde vive cada cosa y qué archivos revisar antes de cambiarla. Todas las rutas
son relativas a la raíz del repositorio.

## La idea en una frase

Las pantallas (`src/features/`) **leen** los registros del espacio abierto y
**piden** cambios a `space.update`. Los cálculos (`src/domain/`) son funciones
puras sin React. El guardado (`src/data/`) comprueba los registros y los guarda
o los lee en la base de datos del navegador. Así, Home, Bills, Cards, History,
Data y Goals muestran siempre las mismas cifras.

```
Pantalla ──lee──▶ registros del espacio (FinanceData) ──▶ domain/ calcula totales
    │                         ▲
    └── space.update(cambio) ─┘── app/useSpace ──▶ data/indexedDbStore guarda
                                  (espera la respuesta; la demo no se guarda nunca)
```

Cómo funcionan el guardado, las otras pestañas, la recuperación y la demo:
[STORAGE_AND_RECOVERY.md](STORAGE_AND_RECOVERY.md).

## Carpetas

| Carpeta | Qué contiene | Reglas |
| --- | --- | --- |
| `src/App.tsx` | El armazón: cabecera, franja de la demo, avisos (solo lectura, conflicto, borrado en otra pestaña, versión antigua), pantalla actual, barra de pestañas y estado de navegación compartido (meta abierta, factura abierta, mes elegido, importes ocultos, vistas de la sesión). También las preguntas antes de descartar, la entrada y salida de la demo y sus preferencias en memoria. | Solo coordina; no calcula. |
| `src/main.tsx` | Arranca React y carga `styles/base.css`. | |
| `src/app/` | Estado de la aplicación: `useSpace.ts` (espacio propio o demo, apertura y guardado asíncronos, sesiones, un cambio cada vez, Reset Demo, cambios de otras pestañas, recuperación), `writeStatus.ts` (si se está guardando o se puede escribir, para los controles), `unsavedChanges.ts` (formularios con cambios sin guardar y Copy What I Typed), `navigation.ts` (pantallas, pestañas, botón Atrás), `newId.ts` (ids), `today.ts` (fecha del dispositivo). | |
| `src/features/` | Una carpeta por pestaña o recorrido, con sus pantallas y piezas. | Pueden usar `domain/`, `ui/`, `components/`. |
| `src/components/` | Piezas visuales compartidas: `BottomNav`, `Field`, `Icon`, `MonthSwitch` (flechas + selector de mes), `ProgressBar`, `FoldBlock` (bloque plegable de Home y Data: encabezado con flecha, resumen cerrado, contenido `inert`), `ResetDemoConfirm` (Reset Demo en dos pasos), `UnsavedForms` (lista de lo escrito, Copy What I Typed, Show What I Typed y `ConfirmDiscard`). | Sin lógica financiera. |
| `src/domain/` | Cálculos deterministas y sus pruebas. `domain/finance/` es el modelo de la app (facturas, gastos, transferencias, deudas, cuentas, ingresos, metas, ahorro, año, fondo de emergencia, suscripciones). Fuera de esa carpeta: dinero, fechas, `goalExplore` (Explore de una meta), `monthlyPlan` y `loanPayoff`. | Sin React ni navegador. Dinero en unidades menores. |
| `src/data/` | Guardado y archivos: `spaceStore.ts` (contrato de cualquier almacén), `indexedDbStore.ts` (el que usa la app: IndexedDB con revisiones, migración desde la copia antigua, avisos a otras pestañas, Erase, Use Older Copy y `exportCopies`), `idb.ts` (transacciones), `savedCopies.ts` (leer lo guardado sin cambiarlo; claves de la copia antigua y de la marca de borrado), `recovery.ts` (archivo de Download Both Copies), `exchange.ts` (exportar/importar), `validate.ts`, `migrations.ts`, `uiPrefs.ts` (preferencias de pantalla del dispositivo) y `fixtures/` con los datos inventados. `localStore.ts` solo aporta `browserStorage` y la clave de la copia antigua: su `createLocalStore` ya no lo usa la app. | Nada de pantallas. |
| `src/ui/` | Ayudas de presentación: formato de importes y fechas, lectura de importes escritos, colores de gráficos, textos del resultado de guardar, ocultar importes (`amountVisibility.ts`: estado y máscara; `privacy.tsx`: botones de ojo). | Sin estado. |
| `src/styles/` | CSS global: `tokens.css` (colores, radios, espacios, modo oscuro), `base.css`, `app.css` (armazón y bienvenida), `finance.css` (pestañas, Home, formularios, Goals, Alex). | |
| `src/report/` | Informe PDF: `pdf.ts` (escritor PDF mínimo, sin dependencias) y `report.ts` (contenido del informe). | Sin React. |
| `src/test/` | Ayudas para pruebas: `memoryStorage.ts` y `space.ts` (base de datos nueva en cada prueba, almacén retenido para simular un guardado lento, lectura de lo guardado). | |
| `docs/` | Esta documentación. El manual de uso para quien usa la app es [`USER_GUIDE.md`](USER_GUIDE.md) (en inglés). | Si cambia un texto, un control o una regla visible, revisar también el manual. |
| `public/` | `favicon.svg`. | |

### Pantallas por carpeta

| Carpeta | Archivos |
| --- | --- |
| `features/home/` | `HomeScreen.tsx` (mes fijo arriba, Expand/Collapse All, Customize Home y arrastre), `HomeBlock.tsx` (marco plegable de cada bloque: encabezado, periodo, resumen cerrado, Move up/down), `homeBlocksContext.ts`, `homeLayout.ts` (orden y bloques abiertos, lectura tolerante), `balanceDates.ts` (texto de fechas de saldos) y sus secciones: `MonthSummary` (This Month y cómo se financió), `LeftToPay`, `SpendingByCategory` (Spent / Planned, Ideas to Review), `PlannedBills`, `TotalDebt`, `HomeMoney` (My Money / Our Money), `HomeGoals` (My Goals, sugerencia del fondo de emergencia), `YearSummary` (año, Reference Notes), `Donut`. |
| `features/bills/` | `BillsScreen.tsx` (pestaña Bills: Calendar o List, filtro, barra del día fija sobre el calendario con View day details, panel del día con + Add Bill y Back to calendar, aviso «Bill added.»), `BillsCalendar.tsx` (cuadrícula del mes, teclado, «+N more»), `billsView.ts` (estado de la vista de la sesión y textos), `BillForm.tsx` (Add Bill / Edit Details; desde un día empieza en ese día y mes), `BillScreen.tsx` (una factura: importe del mes, importe habitual, pagada) y `SubscriptionSection.tsx` (valoración, pausar o cancelar, simulación). El regreso desde una factura (posición y foco) lo guarda `App.tsx` (`billsReturn`). |
| `features/cards/` | `CardsScreen.tsx` (My Loans & Cards), `DebtScreen.tsx` (una tarjeta o préstamo, saldo, estimación, pago extra) y `debtDraft.ts` (lectura del formulario). |
| `features/history/` | `HistoryScreen.tsx` (Year Overview plegable, periodo propio, búsqueda, More Filters con etiquetas quitables, registros por mes y día con Show More, impresión completa), `historyView.ts` (vista de la sesión: periodo, filtros, meses abiertos, registros mostrados; reglas de apertura; nombres de tipo) y `RecordForms.tsx` (añadir o cambiar gasto, transferencia, ingreso). |
| `features/data/` | `DataScreen.tsx` (seis bloques plegables en orden fijo, Expand/Collapse All, zona Demo aparte), `dataBlocks.ts` (bloques, estado de la vista de la sesión: abiertos, filtros, detalle), `DataBlockFrame.tsx`, `ValidityFilterBar.tsx` (Active / Upcoming / Ended / All) y una sección por archivo: `IncomeSection` (lista compacta y cobros de una fuente), `BillsSection`, `DebtsSection`, `AccountsSection`, `GoalsSection`, `ReportSection` (Export Report en PDF), `ExchangeSection` (Data Backup y Restore Backup). Vigencia: `domain/finance/validity.ts`. |
| `features/goals/` | Lista de metas, nueva meta (objetivo opcional), detalle con aportaciones y retiradas, ritmo, `GoalExplore` (probar importe o fecha), `EmergencyScreen` (borrador o revisión del fondo de emergencia). |
| `features/settings/` | `SettingsScreen.tsx`: cuenta y espacio, preferencias (moneda, idioma, apariencia), Privacy & Security con Erase All Data on This Device, Explore the Demo (solo en el espacio propio) y, dentro de la demo, Reset Demo y Exit Demo. |
| `features/recovery/` | `Recovery.tsx`: pantalla Your Saved Information cuando lo guardado no se puede abrir (Download Both Copies, Use Older Copy, Erase Saved Information, Try Again). |
| `features/welcome/` | Bienvenida, vista previa de cuenta (sin contraseñas) y Welcome Setup del espacio propio. |

## Quiero cambiar X → reviso estos archivos

| Quiero cambiar… | Archivos |
| --- | --- |
| **Colores, radios, espacios, modo oscuro** | `src/styles/tokens.css`. Colores de gráficos: `src/ui/chartColors.ts` (categorías de facturas y de gasto, tipos de cuenta) y `PURPOSE_COLORS` en `features/home/HomeMoney.tsx`. Colores de personas: `domain/finance/space.ts`. |
| **Estilos de una pantalla** | Pestañas, Home, formularios, Goals, History y Alex: `src/styles/finance.css` (por secciones comentadas). Armazón, cabecera, bienvenida y botones: `src/styles/app.css`. Base: `src/styles/base.css`. |
| **Orden y contenido de Home** | Orden: `features/home/HomeScreen.tsx`. Cada bloque: su archivo en `features/home/`. Cifras del mes: `domain/finance/spending.ts` (`monthResult`, `monthSpending`) y `domain/finance/flows.ts` (`monthFunding`). Año: `domain/finance/year.ts`. Prueba del orden: `AlexDemo.test.tsx` («shows the sections in the approved order»). |
| **Datos ficticios de Alex** | `src/data/fixtures/demoAlex.ts` (registros del año y fecha de la demo, 31-12-2026). Historia, supuestos y tabla mensual: `docs/demo-alex-year.md`. Pruebas: `domain/finance/alexDemo.test.ts` y `AlexDemo.test.tsx`. |
| **Hogar Duo de pruebas** | `src/data/fixtures/demoHousehold.ts`. Solo lo usan las pruebas (`App.test.tsx`, `data.test.ts`, `finance.test.ts`…); no aparece en la app. |
| **Facturas y recurrencia** | Reglas: `domain/finance/bills.ts` (meses, importe habitual desde un mes, importe de un mes, pagada). Pantallas: `features/bills/`, `features/home/PlannedBills.tsx`, `features/home/LeftToPay.tsx`, `features/data/BillsSection.tsx`. Categorías: `BILL_CATEGORIES` en `domain/finance/types.ts`. |
| **Deudas y cuotas** | Reglas: `domain/finance/debts.ts` (cuota vinculada, total, borrar con o sin factura) y `domain/loanPayoff.ts` (estimación). Pantallas: `features/cards/`, `features/home/TotalDebt.tsx`, `features/data/DebtsSection.tsx`. |
| **Cuentas y saldos** | `domain/finance/moneyAccounts.ts`, `domain/finance/balances.ts`, `recordBalance` en `domain/finance/debts.ts`. Pantallas: `features/data/AccountsSection.tsx`, `features/home/HomeMoney.tsx`. |
| **Savings y metas** | `domain/finance/savings.ts` (Savings por propósito), `domain/finance/goals.ts` (movimientos, progreso, ritmo), `domain/finance/pots.ts`. Pantallas: `features/goals/`, `features/home/HomeGoals.tsx`, `features/home/HomeMoney.tsx`, `features/data/GoalsSection.tsx`. |
| **Ingresos** | `domain/finance/income.ts`, `incomeReceived` en `domain/finance/spending.ts`. Pantallas: `features/data/IncomeSection.tsx`, `features/home/MonthSummary.tsx`, `features/home/YearSummary.tsx`. |
| **Explore de una meta** | `features/goals/GoalExplore.tsx` y `domain/goalExplore.ts` (con `domain/monthlyPlan.ts` y `domain/goalTime.ts`). Validación del formulario: `features/goals/goalDraft.ts` y `domain/goal.ts`. |
| **Fondo de emergencia** | `domain/finance/emergency.ts` (líneas esenciales, objetivo, cobertura, crear o revisar). Pantalla: `features/goals/EmergencyScreen.tsx`. Sugerencia en Home: `features/home/HomeGoals.tsx`. "Maybe Later": `data/uiPrefs.ts`. |
| **Gastos y transferencias** | Tipos en `domain/finance/types.ts`; guardar y validar en `domain/finance/records.ts`; flujos y conciliación en `domain/finance/flows.ts`. |
| **Suscripciones e ideas** | `domain/finance/subscriptions.ts` (simulación, aplicar pausa o cancelación, oportunidades). Pantallas: `features/bills/SubscriptionSection.tsx`, `features/home/SpendingByCategory.tsx`. |
| **Notas de referencia** | `domain/finance/indicators.ts` (vivienda / ingresos, umbral de Eurostat) y `ReferenceNotes` en `features/home/YearSummary.tsx`. |
| **Informe PDF** | `src/report/report.ts` (secciones) y `src/report/pdf.ts` (dibujo). Pantalla: `features/data/ReportSection.tsx`. |
| **Ocultar importes** | `src/ui/amountVisibility.ts` (bloques, máscara, `useBlockAmounts`), `src/ui/privacy.tsx` (ojo y Hide All Amounts), estado en `src/App.tsx`, guardado en `data/uiPrefs.ts`. |
| **Historial** | `domain/finance/history.ts` (lista de actividad, descripción de movimientos de ahorro, nota del usuario aparte en `note`, orden `newestFirst` con `recordedAt`, filtros y búsqueda, grupos por mes y día); vista de la sesión en `features/history/historyView.ts` (estado en `src/App.tsx`, separado demo / espacio propio); `stampNewRecords` en `domain/finance/records.ts` pone la hora de entrada a los registros nuevos; `features/history/HistoryScreen.tsx`, `features/history/RecordForms.tsx`. |
| **Guardado** | `src/data/indexedDbStore.ts` (único sitio que escribe el espacio) con el contrato de `src/data/spaceStore.ts`, y `src/app/useSpace.ts` (cuándo se guarda, un cambio cada vez, sesiones). Estado para los controles: `src/app/writeStatus.ts`. Mensajes tras guardar: `src/ui/saveOutcome.ts`. Explicación: `docs/STORAGE_AND_RECOVERY.md`. |
| **Importar y exportar** | `src/data/exchange.ts`, `src/data/validate.ts`, `src/data/migrations.ts`. Pantalla: `features/data/ExchangeSection.tsx` (Data Backup; Download Both Copies en solo lectura). Archivo de recuperación: `src/data/recovery.ts`. |
| **Formato de datos guardados** | `domain/finance/types.ts` + una migración nueva en `data/migrations.ts` + `data/validate.ts` + pruebas en `data/data.test.ts`. |
| **Navegación y pestañas** | `src/app/navigation.ts` (lista de pantallas y pestañas, botón Atrás), `components/BottomNav.tsx`, `src/App.tsx`. |
| **Preferencias** | Apariencia (por espacio): `features/settings/SettingsScreen.tsx` y `preferences` en `domain/finance/types.ts`. Donut o barras, importes ocultos y "Maybe Later" (por dispositivo, solo el espacio propio): `src/data/uiPrefs.ts`; en la demo viven en memoria (`demoPrefs` en `src/App.tsx`). Diseño de Home: `features/home/homeLayout.ts`, guardado del espacio propio en `uiPrefs.ts` (`readHomeLayout`), estado de la demo en `src/App.tsx`. |
| **Otras pestañas y recuperación** | `src/app/useSpace.ts` (`check`: lee de nuevo y decide; nunca sustituye lo escrito sin guardar), `src/app/unsavedChanges.ts`, avisos en `src/App.tsx`, `src/components/UnsavedForms.tsx`, pantalla `src/features/recovery/Recovery.tsx`, Download Both Copies en `exportCopies` (`src/data/indexedDbStore.ts`) y `src/data/recovery.ts`. Pruebas: `src/OtherTabs.test.tsx`. |
| **Demo: entrar, salir, reiniciar** | `src/app/useSpace.ts` (`openDemo`, que responde `busy` con una operación pendiente; `resetDemo`; `closeDemo`, que recarga desde el almacén) y en `src/App.tsx` `openDemo`, `requestDemo`, `exitDemo`, `leaveDemo`, `resetDemo`, `clearDemoViews` y `ownReturn` (vista de Bills y mes propios apartados). Entrada en Settings: `features/settings/SettingsScreen.tsx`. Pruebas: `src/DemoFromSettings.test.tsx`. |
| **Formato de importes y fechas** | `src/ui/format.ts`. Lectura de importes escritos: `src/ui/moneyInput.ts` y `src/ui/decimalInput.ts`. En el PDF: `pdfMoney` en `src/report/report.ts`. |
| **Textos de la interfaz** | Están en cada pantalla (`features/…`). Nombres compartidos: `src/ui/labels.ts`, `src/ui/chartColors.ts`, `BLOCK_NAMES` en `src/ui/amountVisibility.ts`. |

## Pruebas

| Archivo | Qué cubre |
| --- | --- |
| `src/AlexDemo.test.tsx` | El año de Alex de punta a punta: Home por meses, financiación de agosto, desgloses → History, ideas, ocultar importes, Explore, fondo de emergencia, simulación, filtros de History, PDF y Reset Demo. |
| `src/DataBlocks.test.tsx` | Bloques de Data, filtros de vigencia, detalle de ingresos, enlaces a un bloque (Edit Balances), Reset Demo con confirmación, aislamiento demo / espacio propio. |
| `src/History.test.tsx` | History: orden de la pantalla, periodo propio, búsqueda y More Filters, recuentos, Show More, Expand/Collapse All, volver de una factura o meta, estados vacíos, privacidad, impresión, Reset Demo y separación demo / espacio propio. |
| `src/HomeBlocks.test.tsx` | Mes compartido, enlaces cuota → factura, bloques plegables, resúmenes y privacidad, Customize Home, preferencias y aislamiento de la demo, correcciones de la revisión manual. |
| `src/App.test.tsx` | La app con el hogar Duo de pruebas y el espacio propio: navegación, guardado, importación, pantallas. |
| `src/BillsCalendar.test.tsx` | Bills: calendario, lista, filtro, panel del día, Add Bill desde un día y regreso desde una factura. |
| `src/SavingStates.test.tsx` | Apertura y guardado asíncronos en pantalla: Saving…, doble clic, fallos con Try Again, solo lectura, Erase incompleto, ids de espacio. |
| `src/OtherTabs.test.tsx` | Otras pestañas: actualización automática, conflicto, borrado, versión antigua, «(closed)», recuperación, Download Both Copies y la revisión de solo lectura (ningún botón escribe). |
| `src/DemoFromSettings.test.tsx` | Demo desde Settings: almacenamiento idéntico byte a byte, ninguna escritura, otra pestaña guarda o borra, bloqueo mientras se guarda, borrador de New Goal, Exit Demo con algo escrito, mes y vistas propios. |
| `src/app/*.test.ts(x)` | `useSpace` (sesiones, `busy`, `stale`, comprobaciones antes de mostrar lo leído, demo bloqueada mientras se escribe), registro de formularios sin guardar, ids. |
| `src/domain/**/*.test.ts` | Los cálculos, con importes exactos. `alexDemo.test.ts` incluye invariantes con ediciones aleatorias. |
| `src/data/*.test.ts` | Validación, migraciones, el almacén antiguo de `localStorage` (`localStore.test.ts`) y la base de datos. `indexedDbStore.test.ts` usa `fake-indexeddb` (IndexedDB en memoria) y simula dos pestañas con dos conexiones a la misma base de datos. |
| `src/report/report.test.ts` | El PDF: periodo, secciones, sin importes, aviso de datos inventados, caracteres. |
