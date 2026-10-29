# Reglas financieras

Estas reglas deciden qué cifra aparece en cada pantalla. Están en
`src/domain/` (funciones puras, con pruebas) y ninguna pantalla las repite. Si
una regla cambia, se cambia allí y se actualizan sus pruebas y este documento.

Los ejemplos usan el año ficticio de Alex (fecha de la demo: **31-12-2026**).
Los valores completos están en [demo-alex-year.md](demo-alex-year.md).

## 0. Principio del producto

La app ayuda a responder siete preguntas: ¿qué ingresos recibo y cómo varían?,
¿en qué uso mi dinero?, ¿cuáles son mis compromisos esenciales?, ¿qué gastos
podría revisar?, ¿qué consecuencias tendría un cambio?, ¿qué protección tengo
ante un imprevisto? y ¿cómo evoluciona mi ahorro?

Cada sugerencia (fondo de emergencia, ideas para revisar, simulaciones,
Explore de una meta, notas de referencia) **explica sus datos, supuestos y
límites**, se puede abrir y editar, y **no cambia nada hasta que el usuario la
confirma**. Las referencias generales nunca se presentan como consejo
personal.

## 1. Una sola fuente de datos

- Cada espacio tiene un único conjunto de registros (`FinanceData`, en
  `domain/finance/types.ts`): ingresos, facturas, meses de factura, deudas,
  cuentas, saldos, metas y movimientos.
- **Los totales no se guardan nunca.** Se calculan en cada pantalla a partir de
  los registros, así que Home, Bills, Cards, History, Data y Goals no pueden
  contradecirse.
- Todas las pantallas cambian los datos con `space.update` (`app/useSpace.ts`).
  En el espacio propio, el cambio se muestra cuando la base de datos del
  navegador confirma que lo guardó; la demo no se guarda nunca. Detalles en
  [STORAGE_AND_RECOVERY.md](STORAGE_AND_RECOVERY.md).

## 2. Dinero y fechas

- **Importes en unidades menores enteras** (grosze, céntimos): `650000` son
  6.500,00 zł. Nunca decimales, porque `0.1 + 0.2` no da `0.3` exacto.
  `sumMinor` (`domain/money.ts`) se detiene si llega un decimal.
- Cada espacio tiene una moneda (PLN, EUR o USD). Los importes no se convierten.
- **Fechas como texto `AAAA-MM-DD`** y meses como `AAAA-MM`. Se comparan y se
  formatean como texto, así que la zona horaria del dispositivo no puede mover
  un día.
- **Hoy** es la fecha del dispositivo en el espacio propio y la fecha fija en la
  demo (31-12-2026). Todas las pantallas usan la misma fecha (`space.today`).
- Los porcentajes se calculan desde sus componentes en el momento:
  Japón 1.800 de 10.000 → 18 %. Con ingresos cero o datos incompletos no se
  muestra porcentaje.

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
- Un ingreso puede marcarse como **extraordinario** (la devolución del IRPF de
  Alex); Year Summary lo dice aparte.
- **Year Summary** suma solo ingresos recibidos. No proyecta nada.
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
- Una factura puede ser **anual**, tener **meses en pausa** y datos de
  **suscripción** (si se puede pausar o cancelar, y la valoración del usuario:
  Needed / Could adjust / Optional).
- Un pago guarda **cuándo** se pagó y **desde qué cuenta**. Pagado después del
  vencimiento = "Paid late"; sin pagar tras el vencimiento = "Overdue".

## 5b. Obligación, gasto, transferencia y deuda

La app distingue seis cosas y cada una tiene su registro:

| Qué | Registro | ¿Es gasto? |
| --- | --- | --- |
| Obligación prevista | Factura (mes de factura) | No hasta que se paga |
| Pago o gasto realizado | Factura pagada o `Expense` | Sí, una vez |
| Transferencia entre cuentas propias | `Transfer` | No (ni ingreso ni gasto) |
| Aportación o retirada de ahorro | Transferencia + movimiento de meta | No |
| Nueva deuda / amortización | Compra con tarjeta / principal de una cuota | La compra sí, al comprar; el pago de la tarjeta no |
| Saldo observado | `BalanceSnapshot` con fecha | No |

- **Resultado del mes = ingresos recibidos − gasto.** Gasto = facturas pagadas
  que no pagan deuda + gastos (con tarjeta, cuando se compra) + **solo los
  intereses** de las cuotas de préstamos (`monthResult`,
  `domain/finance/spending.ts`). El resultado **no es ahorro**.
- **Flujo de caja** ("How is this worked out?"): dinero que entra y sale de
  las cuentas, incluidos pagos de tarjeta y principal. La identidad
  `resultado = Δ Everyday + Δ Savings + Δ inversiones − Δ deuda` se comprueba
  y la parte "sin explicar" debe ser 0 (`monthFunding`,
  `domain/finance/flows.ts`). Con un déficit, la app dice cuánto vino de
  Savings, de la cuenta diaria y de deuda nueva.
- **Planned Bills** = facturas del mes, pagadas o no (lo previsto).
- La cuota de un préstamo sin interés anotado no reduce el principal: la app
  no lo adivina, y la conciliación de ese mes dice que falta el dato.
- Los saldos son **instantáneas con fecha**. Home muestra el último saldo hasta
  el fin del mes elegido (o hoy). History nunca reconstruye saldos pasados a
  partir del actual.

Ejemplo (Alex, agosto): resultado −3.037,86 = 1.500 de Savings + 1.160,57 de la
cuenta diaria + 377,29 de deuda nueva.

## 6. Deudas y cuotas

- **Total Debt** = suma del último saldo conocido de cada tarjeta y préstamo
  (`summarizeDebts`). Las cuotas mensuales no se suman: pagan la deuda, no son
  más deuda.
- **Una cuota vinculada se cuenta una vez.** Si una factura paga una deuda, la
  cuota vive solo en esa factura: Cards la muestra, Monthly Bills la cuenta, y
  la deuda no guarda una cuota propia (`debtPayment`; la importación rechaza un
  archivo con las dos).
- **Marcar una cuota como pagada no reduce el principal por sí solo.** Si la
  cuota guarda su interés, el principal es cuota − interés; si no, la app no
  lo supone. El saldo registrado sigue siendo la referencia; el anterior queda
  en el historial.
- **La cuota de un mes** que muestran Cards y el detalle de una tarjeta o
  préstamo es la misma que Monthly Bills para ese mes: el importe propio del
  mes si la factura lo tiene (p. ej. la tarjeta pagada entera en diciembre,
  2.489,27) o, si no, el habitual (`debtMonthPayment`). El enlace a la factura
  abre ese mismo mes.
- Se distinguen tres fechas: el **mes de la cuota** (el mes elegido), la
  **fecha del saldo registrado** (la del último saldo introducido, nunca una
  proyección del mes elegido) y la **fecha de referencia de la estimación**
  (hoy en el espacio propio; 31-12-2026 en la demo, dicho así).
- La estimación de pago ("Estimate", "What If I Pay Extra?") es solo un cálculo:
  mismo interés y la cuota habitual cada mes, máximo 50 años, y no cambia nada.
  Con saldo 0 dice "Nothing left to pay" y no muestra estimación ni ahorros.
- Borrar una deuda con factura vinculada obliga a elegir: borrar también la
  factura o conservarla sin vínculo. Nunca queda apuntando a nada.
- El pago mínimo de una tarjeta es un dato introducido; la app no lo calcula.

Ejemplo (Alex, 31-12-2026): 0 + 2.644,35 + 9.622,63 = **12.266,98**.

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

- Ejemplo (Alex, diciembre): Savings 2.900 = Japón 1.800 + New Bike 200 +
  Emergency 900 + 0 sin asignar. My Goals muestra 2.000 "part of your Savings".
- **El dinero no gastado no se ahorra solo.** Savings cambia únicamente con
  una transferencia o un movimiento registrado; ni las simulaciones ni las
  ideas para revisar lo suben.

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

### Metas: objetivo opcional y Explore

- Una meta tiene nombre; el **objetivo es opcional**. Una fecha límite
  **necesita objetivo** (sin él no hay ritmo que calcular). Nunca se pide una
  aportación mensual para crearla.
- Ritmo sugerido: se cuentan **meses completos** desde hoy hasta la fecha; la
  primera aportación es un mes después de hoy; el importe se **redondea hacia
  arriba** al grosz. Es lo que haría falta, **no** lo que la persona puede
  permitirse.
- **Explore** (dentro de la meta): "si ahorro X al mes" → cuántos meses y fecha
  aproximada (máximo 50 años); "o llegar en esta fecha" → importe mensual. No
  cambia nada; **Use This Date** pide confirmación (`domain/goalExplore.ts`).

### Fondo de emergencia

```
objetivo = gastos esenciales mensuales confirmados × meses de cobertura
```

- Es un **borrador**: Home sugiere "Start with an emergency fund" (Review My
  Emergency Fund / Maybe Later) si no hay fondo, y nada se crea ni se asigna
  hasta **Create Emergency Fund** o **Save Review**. Si ya hay un fondo, solo
  se ofrece revisarlo: nunca hay dos.
- Líneas propuestas (`estimateEssentials`, `domain/finance/emergency.ts`):
  facturas esenciales con su importe actual (anuales ÷ 12), pagos mínimos de
  deuda, y gasto diario esencial (vivienda, alimentación, servicios,
  transporte, salud) como **media de hasta 6 meses completos** con registros.
  Los gastos **excepcionales** de los últimos 12 meses se muestran aparte y no
  cuentan: un mes extremo no se toma como referencia.
- Las aportaciones a otras metas nunca son gasto esencial. El usuario marca o
  desmarca cada línea y puede cambiar su importe.
- Opciones de 1, 3 o 6 meses, u otro número (0,5–24). 1 mes es un primer hito;
  3–6 meses es una referencia orientativa.
- Si a una línea marcada le falta importe: **Estimate incomplete**; se puede
  completar, desmarcar o guardar el fondo sin objetivo.
- "Money already set aside": ahorro **sin asignar** que pasa al fondo nuevo
  (nunca más del que hay); no crea Savings nuevo.
- Cobertura = lo que tiene **el propio fondo** ÷ esenciales confirmados. No
  cuenta otras metas ni inversiones.
- Referencias (texto en la app, "Where these references come from"):
  FINRA, [How to avoid bad financial luck](https://www.finra.org/investors/insights/how-avoid-bad-financial-luck-friday-13th)
  (13-3-2026: un fondo podría llegar a cubrir de 3 a 6 meses de gastos), y
  CFPB, [Start Small, Save Up](https://www.consumerfinance.gov/about-us/newsroom/cfpb-announces-start-small-save-initiative/)
  (15-4-2019: empezar poco a poco, sin un número fijo de meses). Son
  orientaciones generales, no una garantía personal.

### Suscripciones y simulaciones

- **What If I Pause It? / What If I Cancel It?** calcula, con las fechas
  efectivas de los próximos cargos (y el coste de reactivación si se conoce),
  cuánto bajaría el gasto previsto: "Pausing Gym Membership for 3 monthly
  periods … could reduce planned spending by 387,00 zł."
- La simulación no cambia nada. **Confirm** cambia solo meses futuros; los
  pagos ya hechos nunca cambian. **Cancel** lo deja todo igual.
- **Ideas to Review** ordena por impacto anual y facilidad (se puede pausar o
  cancelar, valoración del usuario). No da por hecho que el ocio sobra y
  recuerda el mayor déficit del año para dar escala: recortes pequeños rara vez
  cubren un déficit grande.

### Notas de referencia (Year Summary → Reference Notes)

- **Vivienda / ingresos**: (vivienda + servicios pagados) ÷ ingreso neto
  recibido, mismo periodo. Eurostat llama
  [sobrecarga por costes de vivienda](https://ec.europa.eu/eurostat/statistics-explained/index.php?title=Glossary:Housing_cost_overburden_rate)
  a superar el **40 % de la renta disponible** del hogar: es una medida
  estadística de dificultad, **no un límite recomendado**. El ingreso neto de
  la app no es exactamente renta disponible. Sin ingresos o con una factura sin
  importe, no se muestra porcentaje.
- **50/30/20**: reparto orientativo popularizado por el libro *All Your Worth*
  (2005); la app no puntúa al usuario contra él.

## 8. Demo y espacio propio

- La demo (Alex) y el espacio propio nunca se mezclan: abrir, usar, reiniciar
  o dejar la demo no lee ni escribe el espacio propio, y ninguna preferencia,
  vista, selección ni borrador pasa de uno a otro. La demo no se puede
  importar. Se abre desde la bienvenida o desde Settings; las reglas de
  entrada y salida están en
  [STORAGE_AND_RECOVERY.md](STORAGE_AND_RECOVERY.md#8-la-demo-y-el-espacio-propio).
- **Reset Demo** (franja, Data o Settings) devuelve el año completo: todos los
  registros, el mes elegido (diciembre de 2026), el diseño inicial de Home y
  las preferencias de pantalla de Alex.
- El orden y los bloques abiertos de Home son preferencias de pantalla, no
  datos. En el espacio propio se recuerdan en este dispositivo
  (`goal-planning-app.home-layout`, ligado al id del espacio); en la demo duran
  mientras está abierta y nunca se guardan.
- Las preferencias de pantalla de la demo (importes ocultos, Donut o Bars,
  Maybe Later) también viven solo en memoria.
- **Exit Demo** descarta todos los cambios. Si hay algo escrito sin guardar,
  pregunta antes.

## 9. Guardado y mensajes

- Cada cambio dice qué pasó (`ui/saveOutcome.ts`): "Saved on this device.",
  "Demo only: not saved.", que el navegador no lo guardó o por qué no se
  guardó (otra pestaña, solo lectura, otro cambio guardándose).
- Un cambio rechazado no cambia nada, y el formulario conserva lo escrito.
- Si hay datos guardados que no se pueden leer, nunca se sobrescriben en
  silencio: la pantalla de recuperación ofrece Download Both Copies, Use Older
  Copy y Erase, siempre con confirmación.
- **Importar** comprueba el archivo (versión, migración y validación) y no
  reemplaza nada hasta que el usuario confirma.
- **Formato guardado:** `schemaVersion` 3 (añade gastos y transferencias; la
  migración 2 → 3 los crea vacíos y no toca nada más). Un cambio de formato
  necesita una migración nueva en `data/migrations.ts` y pruebas que conserven
  los datos existentes.

## 10. Informe PDF, copia de seguridad y ocultar importes

- **Export Report** (Data) descarga un PDF de un mes o un año: periodo, moneda,
  fecha de generación, aviso de datos inventados en la demo, resumen, mes a mes
  (año), categorías con gráfico, pagos pendientes, deudas con la fecha de su
  saldo, cuentas, Savings y metas, datos que faltan y supuestos. Dice siempre
  que **no es un extracto bancario ni un certificado** y que los datos no los
  ha verificado ninguna entidad. Se genera en el navegador (`src/report/`), sin
  dependencias nuevas.
- **Include amounts** decide si el PDF lleva importes; no depende de lo oculto
  en Home y el informe dice en su portada si los incluye.
- **Data Backup** (Download Backup / Restore Backup) es el JSON restaurable. El
  PDF no es una copia de seguridad, y **Download Both Copies** tampoco: es un
  archivo de recuperación que Restore Backup rechaza. Los dos JSON llevan los
  datos sin cifrar.
- **Ocultar importes** (ojo en cada bloque de Home y Hide All Amounts) solo
  cambia lo que se ve: máscara fija `••••`, también en etiquetas accesibles,
  porcentajes y gráficos. Se recuerda en este dispositivo. **No es cifrado ni
  protección de acceso.**

## Dónde están las pruebas de estas reglas

- `src/domain/finance/alexDemo.test.ts`: los criterios de la demo y 5 semillas ×
  60 ediciones aleatorias que comprueban los invariantes (totales desde sus
  partes, cuota contada una vez, Savings sin doble conteo).
- `src/domain/finance/finance.test.ts`, `goals.test.ts`, `home.test.ts`,
  `src/domain/goalExplore.test.ts`, `src/report/report.test.ts`: cada cálculo
  con importes exactos.
- `src/AlexDemo.test.tsx` y `src/App.test.tsx`: las mismas reglas vistas en
  pantalla.
