# Mapa del proyecto

Dónde vive cada cosa y qué archivos revisar antes de cambiarla. Todas las rutas
son relativas a la raíz del repositorio.

## La idea en una frase

Las pantallas (`src/features/`) **leen** los registros del espacio abierto y
**piden** cambios a `space.update`. Los cálculos (`src/domain/`) son funciones
puras sin React. El guardado (`src/data/`) solo convierte los registros en texto
y los guarda o los lee. Así, Home, Bills, Cards, History, Data y Goals muestran
siempre las mismas cifras.

```
Pantalla ──lee──▶ registros del espacio (FinanceData) ──▶ domain/ calcula totales
    │                         ▲
    └── space.update(cambio) ─┘── data/localStore guarda (solo el espacio propio)
```

## Carpetas

| Carpeta | Qué contiene | Reglas |
| --- | --- | --- |
| `src/App.tsx` | El armazón: cabecera, franja de la demo, pantalla actual, barra de pestañas y estado de navegación compartido (meta abierta, factura abierta, mes elegido, Goal Planner). | Solo coordina; no calcula. |
| `src/main.tsx` | Arranca React y carga `styles/base.css`. | |
| `src/app/` | Estado de la aplicación: `useSpace.ts` (espacio propio o demo, guardado, Reset Demo), `navigation.ts` (pantallas, pestañas, botón Atrás), `newId.ts` (ids), `today.ts` (fecha del dispositivo). | |
| `src/features/` | Una carpeta por pestaña o recorrido, con sus pantallas y piezas. | Pueden usar `domain/`, `ui/`, `components/`. |
| `src/components/` | Piezas visuales compartidas: `BottomNav`, `Field`, `Icon`, `MonthSwitch`, `ProgressBar`. | Sin lógica financiera. |
| `src/domain/` | Cálculos deterministas y sus pruebas. `domain/finance/` es el modelo de la app (facturas, deudas, cuentas, ingresos, metas, ahorro). El resto (`evaluateGoalPlan`, `exploreAlternatives`, `goal`, `monthlyPlan`…) es el motor del Goal Planner. | Sin React ni navegador. Dinero en unidades menores. |
| `src/data/` | Guardado y archivos: `localStore.ts`, `exchange.ts` (exportar/importar), `validate.ts`, `migrations.ts`, `uiPrefs.ts`, y `fixtures/` con los datos inventados. | Nada de pantallas. |
| `src/ui/` | Ayudas de presentación: formato de importes y fechas, lectura de importes escritos, colores de gráficos, textos del resultado de guardar. | Sin estado. |
| `src/styles/` | CSS global: `tokens.css` (colores, radios, espacios, modo oscuro), `base.css`, `app.css` (armazón y bienvenida), `finance.css` (pestañas, Home, formularios, Goals, Alex). | |
| `src/test/` | Ayudas para pruebas (`memoryStorage.ts`). | |
| `docs/` | Esta documentación. | |
| `public/` | `favicon.svg`. | |

### Pantallas por carpeta

| Carpeta | Archivos |
| --- | --- |
| `features/home/` | `HomeScreen.tsx` (orden de Home) y sus secciones: `MonthOverview`, `LeftToPay`, `BillsByCategory`, `TotalDebt`, `HomeMoney` (My Money / Our Money), `HomeGoals` (My Goals / Our Goals), `PlannerSection` (Plan Another Goal), `YearlyNetIncome`, `Donut`. |
| `features/bills/` | `BillsScreen.tsx` (pestaña Bills, por fechas de pago) y `BillScreen.tsx` (una factura: importe del mes, importe habitual, pagada). |
| `features/cards/` | `CardsScreen.tsx` (My Loans & Cards), `DebtScreen.tsx` (una tarjeta o préstamo, saldo, estimación, pago extra) y `debtDraft.ts` (lectura del formulario). |
| `features/history/` | `HistoryScreen.tsx`: pagos, ingresos, saldos y movimientos de ahorro registrados. |
| `features/data/` | `DataScreen.tsx` y una sección por archivo: `IncomeSection`, `BillsSection`, `DebtsSection`, `AccountsSection`, `GoalsSection`, `ExchangeSection` (exportar e importar). |
| `features/goals/` | Lista de metas, nueva meta, detalle de una meta con aportaciones y retiradas, ritmo sugerido. |
| `features/planner/` | Goal Planner: `GoalPlanner.tsx`, `ExploreAlternatives`, `GoalReview`, `GoalOverview`, `planFields.ts`, `planStatus.ts` y `planner.css`. |
| `features/settings/` | `SettingsScreen.tsx`: apariencia, salir o reiniciar la demo, borrar el espacio propio. |
| `features/welcome/` | Bienvenida, vista previa de cuenta (sin contraseñas) y Welcome Setup del espacio propio. |

## Quiero cambiar X → reviso estos archivos

| Quiero cambiar… | Archivos |
| --- | --- |
| **Colores, radios, espacios, modo oscuro** | `src/styles/tokens.css`. Colores de gráficos: `src/ui/chartColors.ts` (categorías de facturas y tipos de cuenta) y `PURPOSE_COLORS` en `features/home/HomeMoney.tsx`. Colores de personas: `domain/finance/space.ts`. |
| **Estilos de una pantalla** | Pestañas, Home, formularios, Goals y Alex: `src/styles/finance.css` (por secciones comentadas). Armazón, cabecera, bienvenida y botones: `src/styles/app.css`. Goal Planner: `features/planner/planner.css`. Base: `src/styles/base.css`. |
| **Orden y contenido de Home** | Orden: `features/home/HomeScreen.tsx`. Cada bloque: su archivo en `features/home/`. Cifras de la parte superior: `domain/finance/overview.ts`. Prueba del orden: `AlexDemo.test.tsx` («shows the sections in the approved order»). |
| **Datos ficticios de Alex** | `src/data/fixtures/demoAlex.ts` (registros y fecha de la demo, 23-10-2026). Valores documentados: `docs/demo-alex.md`. Pruebas: `domain/finance/alexDemo.test.ts` y `AlexDemo.test.tsx`. |
| **Hogar Duo de pruebas** | `src/data/fixtures/demoHousehold.ts`. Solo lo usan las pruebas (`App.test.tsx`, `data.test.ts`, `finance.test.ts`…); no aparece en la app. |
| **Facturas y recurrencia** | Reglas: `domain/finance/bills.ts` (meses, importe habitual desde un mes, importe de un mes, pagada). Pantallas: `features/bills/`, `features/home/BillsByCategory.tsx`, `features/home/LeftToPay.tsx`, `features/data/BillsSection.tsx`. Categorías: `BILL_CATEGORIES` en `domain/finance/types.ts`. |
| **Deudas y cuotas** | Reglas: `domain/finance/debts.ts` (cuota vinculada, total, borrar con o sin factura) y `domain/loanPayoff.ts` (estimación). Pantallas: `features/cards/`, `features/home/TotalDebt.tsx`, `features/data/DebtsSection.tsx`. |
| **Cuentas y saldos** | `domain/finance/moneyAccounts.ts`, `domain/finance/balances.ts`, `recordBalance` en `domain/finance/debts.ts`. Pantallas: `features/data/AccountsSection.tsx`, `features/home/HomeMoney.tsx`. |
| **Savings y metas** | `domain/finance/savings.ts` (Savings por propósito), `domain/finance/goals.ts` (movimientos, progreso, ritmo), `domain/finance/pots.ts`. Pantallas: `features/goals/`, `features/home/HomeGoals.tsx`, `features/home/HomeMoney.tsx`, `features/data/GoalsSection.tsx`. |
| **Ingresos** | `domain/finance/income.ts`. Pantallas: `features/data/IncomeSection.tsx`, `features/home/MonthOverview.tsx`, `features/home/YearlyNetIncome.tsx`. |
| **Goal Planner** | Pantallas: `features/planner/`. Cálculos: `domain/evaluateGoalPlan.ts`, `domain/exploreAlternatives.ts`, `domain/goal.ts`, `domain/monthlyPlan.ts`, `domain/goalTime.ts`. Entrada desde Home: `features/home/PlannerSection.tsx`. Guardar como meta: `savePlannedGoal` en `src/App.tsx`. |
| **Historial** | `features/history/HistoryScreen.tsx` (solo lee registros). |
| **Guardado** | `src/data/localStore.ts` (único sitio que escribe en el navegador) y `src/app/useSpace.ts` (cuándo se guarda y aviso de error). Mensajes tras guardar: `src/ui/saveOutcome.ts`. |
| **Importar y exportar** | `src/data/exchange.ts`, `src/data/validate.ts`, `src/data/migrations.ts`. Pantalla: `features/data/ExchangeSection.tsx`. |
| **Formato de datos guardados** | `domain/finance/types.ts` + una migración nueva en `data/migrations.ts` + `data/validate.ts` + pruebas en `data/data.test.ts`. |
| **Navegación y pestañas** | `src/app/navigation.ts` (lista de pantallas y pestañas, botón Atrás), `components/BottomNav.tsx`, `src/App.tsx`. |
| **Preferencias** | Apariencia (por espacio): `features/settings/SettingsScreen.tsx` y `preferences` en `domain/finance/types.ts`. Donut o barras (por dispositivo): `src/data/uiPrefs.ts`. |
| **Demo: entrar, salir, reiniciar** | `src/app/useSpace.ts` (`openDemo`, `resetDemo`, `closeDemo`) y `resetDemo` / `exitDemo` en `src/App.tsx`. |
| **Formato de importes y fechas** | `src/ui/format.ts`. Lectura de importes escritos: `src/ui/moneyInput.ts` y `src/ui/decimalInput.ts` (Goal Planner: `features/planner/planFields.ts`). |
| **Textos de la interfaz** | Están en cada pantalla (`features/…`). Nombres compartidos: `src/ui/labels.ts`, `src/ui/chartColors.ts`, `features/planner/planStatus.ts`. |

## Pruebas

| Archivo | Qué cubre |
| --- | --- |
| `src/AlexDemo.test.tsx` | La demo de Alex de punta a punta: cifras, orden de Home, Reset Demo, Goal Planner con la fecha de la demo. |
| `src/App.test.tsx` | La app con el hogar Duo de pruebas y el espacio propio: navegación, guardado, importación, pantallas. |
| `src/domain/**/*.test.ts` | Los cálculos, con importes exactos. `alexDemo.test.ts` incluye invariantes con ediciones aleatorias. |
| `src/data/*.test.ts` | Validación, migraciones, guardado. |
| `src/features/planner/*.test.tsx` | Goal Planner, alternativas, revisión y confirmación. |
