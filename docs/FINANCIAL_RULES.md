# Reglas financieras

Estas reglas deciden qué cifra aparece en cada pantalla. Están en
`src/domain/` (funciones puras, con pruebas) y ninguna pantalla las repite. Si
una regla cambia, se cambia allí y se actualizan sus pruebas y este documento.

Los ejemplos usan la demo de Alex (fecha de la demo: **23-10-2026**). Los
valores completos están en [demo-alex.md](demo-alex.md).

## 1. Una sola fuente de datos

- Cada espacio tiene un único conjunto de registros (`FinanceData`, en
  `domain/finance/types.ts`): ingresos, facturas, meses de factura, deudas,
  cuentas, saldos, metas y movimientos.
- **Los totales no se guardan nunca.** Se calculan en cada pantalla a partir de
  los registros, así que Home, Bills, Cards, History, Data y Goals no pueden
  contradecirse.
- Todas las pantallas cambian los datos con `space.update` (`app/useSpace.ts`).
  El espacio propio se guarda en ese mismo paso; la demo no se guarda nunca.

## 2. Dinero y fechas

- **Importes en unidades menores enteras** (grosze, céntimos): `650000` son
  6.500,00 zł. Nunca decimales, porque `0.1 + 0.2` no da `0.3` exacto.
  `sumMinor` (`domain/money.ts`) se detiene si llega un decimal.
- Cada espacio tiene una moneda (PLN, EUR o USD). Los importes no se convierten.
- **Fechas como texto `AAAA-MM-DD`** y meses como `AAAA-MM`. Se comparan y se
  formatean como texto, así que la zona horaria del dispositivo no puede mover
  un día.
- **Hoy** es la fecha del dispositivo en el espacio propio y la fecha fija en la
  demo (23-10-2026). Todas las pantallas, incluido el Goal Planner, usan la
  misma fecha (`space.today`).
- Los porcentajes se calculan desde sus componentes en el momento:
  Japón 600 de 10.000 → 6,0 %.

## 3. Desconocido no es cero

- Un importe o un saldo que falta es `null` y se muestra como **Amount needed**,
  **Not entered** o **Balance needed**, nunca como 0.
- Los totales suman solo lo conocido **y dicen cuántos faltan** al lado
  ("+ 1 unknown amount", "One balance is missing").
- **Left to Pay** nunca dice "All your October bills are paid." mientras quede
  una factura sin pagar con importe desconocido (`leftToPayStatus` en
  `domain/finance/overview.ts`).
- Savings es desconocido si alguna cuenta de ahorro no tiene saldo.

## 4. Ingresos

- Una fuente de ingreso tiene un importe habitual y un día de cobro. Mientras no
  se registra lo que llegó, ese mes cuenta como **esperado**; al registrarlo,
  cuenta lo **recibido** (`monthIncome` en `domain/finance/income.ts`).
- **Yearly Net Income** suma solo ingresos recibidos. No proyecta nada.
- Borrar una fuente no borra los ingresos ya recibidos.

## 5. Facturas y recurrencia

- Una factura se repite cada mes entre su primer y su último mes, con un día de
  pago (los meses cortos usan su último día).
- **Cambiar el importe de un mes** ("Change amount" en Home o en la factura)
  afecta solo a ese mes (`setBillMonthAmount`).
- **Cambiar el importe habitual** se hace en el detalle de la factura e indica
  desde qué mes. Los meses anteriores no cambian y un mes con importe propio lo
  conserva (`setUsualAmountFrom`).
- Marcar una factura como pagada afecta solo a ese mes.
- **Planned Bills** = suma de los importes conocidos del mes. Es lo planificado,
  no lo gastado.
- **Income minus Bills** = ingresos (recibidos + esperados) − facturas
  conocidas. No es dinero ahorrado ni libre para gastar: no incluye el gasto
  diario.

Ejemplo (Alex, octubre): 6.500 − 5.750 = **750**. Si Utilities pasa a 750 solo
en octubre: Planned Bills 5.800 y diferencia 700; noviembre sigue en 5.750 y
750.

## 6. Deudas y cuotas

- **Total Debt** = suma del último saldo conocido de cada tarjeta y préstamo
  (`summarizeDebts`). Las cuotas mensuales no se suman: pagan la deuda, no son
  más deuda.
- **Una cuota vinculada se cuenta una vez.** Si una factura paga una deuda, la
  cuota vive solo en esa factura: Cards la muestra, Monthly Bills la cuenta, y
  la deuda no guarda una cuota propia (`debtPayment`; la importación rechaza un
  archivo con las dos).
- **Marcar una cuota como pagada no reduce el principal.** La app no sabe qué
  parte es interés. El saldo cambia solo cuando el usuario introduce un saldo
  nuevo con su fecha; el anterior queda en el historial.
- La estimación de pago ("Estimate", "What If I Pay Extra?") es solo un cálculo:
  mismo interés y misma cuota cada mes, máximo 50 años, y no cambia nada.
- Borrar una deuda con factura vinculada obliga a elegir: borrar también la
  factura o conservarla sin vínculo. Nunca queda apuntando a nada.
- El pago mínimo de una tarjeta es un dato introducido; la app no lo calcula.

Ejemplo (Alex): 1.800 + 12.000 + 3.600 = **17.400**. Marcar pagado el Student
Loan deja Left to Pay en 0 y Total Debt sigue en 17.400.

## 7. Cuentas, Savings y metas

- Las cuentas son de cuatro tipos: Daily Spending, Investments, Savings y Other.
  **My Money** muestra el último saldo de cada tipo. La deuda nunca se resta.
- **Savings = lo que tienen las cuentas de ahorro.** Las metas y el Emergency
  Fund son **propósitos** dentro de Savings, no dinero extra:

  ```
  Savings = metas + Emergency Fund + sin asignar
  ```

  Nunca se suman otra vez encima de Savings (`savingsSummary` en
  `domain/finance/savings.ts`). Si los propósitos suman más que Savings, la
  pantalla lo dice.

- Ejemplo (Alex): Savings 1.350 = Japón 600 + Navidad 100 + Emergency 300 +
  350 sin asignar. My Goals muestra 700 "part of your Savings".

### Aportar o retirar de una meta

Cada movimiento dice de dónde viene o adónde va el dinero
(`addGoalMovement` en `domain/finance/goals.ts`):

| Elección en pantalla | Efecto | Savings |
| --- | --- | --- |
| **New savings** | La meta y la cuenta de ahorro suben el importe, una vez. | Sube |
| **Savings I already have** | Ahorro sin asignar pasa a la meta. | Igual |
| **Back to unassigned savings** | La meta baja y el ahorro sin asignar sube. | Igual |
| **Out of my savings** | La meta y la cuenta bajan (dinero gastado o movido fuera). | Baja |

- Nunca se puede sacar de una meta más de lo que tiene, ni asignar más ahorro
  del que está sin asignar (si el saldo es conocido).
- El nuevo saldo de la cuenta queda como saldo "From a goal movement", para que
  el historial explique el cambio. No se mueve dinero real.
- Borrar una meta devuelve lo ahorrado a sin asignar; ningún saldo cambia.

### Ritmo sugerido y Goal Planner

- Regla mensual aprobada: se cuentan **meses completos** desde hoy hasta la
  fecha objetivo; la primera aportación es un mes después de hoy. La aportación
  mensual necesaria se **redondea hacia arriba** al siguiente grosz.
- Una fecha con menos de un mes completo no admite plan mensual, salvo que la
  meta ya esté cubierta.
- El ritmo semanal usa la misma regla con semanas. Es una sugerencia, nunca un
  pago.
- El Goal Planner no crea nada por sí mismo: un plan confirmado solo pasa a My
  Goals con **Save as Goal**, con 0 ahorrado.
- Las alternativas (aumentar la aportación o mover la fecha) se aplican solo si
  el usuario las confirma, y se pueden deshacer.

## 8. Demo y espacio propio

- La demo (Alex) y el espacio propio nunca se mezclan: abrir, usar o reiniciar
  la demo no lee ni escribe el espacio propio. La demo no se puede importar.
- **Reset Demo** (franja, Data o Settings) devuelve el ejemplo completo: los
  registros, el mes elegido, el borrador y el plan del Goal Planner, y el aviso
  "Saved in My Goals".
- **Exit Demo** descarta todos los cambios.

## 9. Guardado y mensajes

- Cada cambio dice qué pasó (`ui/saveOutcome.ts`): "Saved on this device.",
  "Demo only: not saved." o que el navegador no lo guardó.
- Si el navegador rechaza el guardado, aparece además un aviso fijo arriba.
- Si hay datos guardados que no se pueden leer, nunca se sobrescriben en
  silencio: la bienvenida ofrece borrarlos.
- **Importar** comprueba el archivo (versión, migración y validación) y no
  reemplaza nada hasta que el usuario confirma.
- **Formato guardado:** `schemaVersion` 2. Un cambio de formato necesita una
  migración nueva en `data/migrations.ts` y pruebas que conserven los datos
  existentes.

## Dónde están las pruebas de estas reglas

- `src/domain/finance/alexDemo.test.ts`: los criterios de la demo y 5 semillas ×
  60 ediciones aleatorias que comprueban los invariantes (totales desde sus
  partes, cuota contada una vez, Savings sin doble conteo).
- `src/domain/finance/finance.test.ts`, `goals.test.ts`, `home.test.ts`: cada
  cálculo con importes exactos.
- `src/AlexDemo.test.tsx` y `src/App.test.tsx`: las mismas reglas vistas en
  pantalla.
