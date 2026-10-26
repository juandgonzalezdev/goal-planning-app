# Demo de Alex (Individual)

La demo pública se abre con **Alex**, una persona inventada. Todas las cifras de
todas las pantallas se calculan a partir de los registros de
`src/data/fixtures/demoAlex.ts`; ninguna se escribe a mano en una pantalla. La
fecha de la demo es fija, **23 de octubre de 2026** (`ALEX_DEMO_TODAY`), para
que el estado de pagos de octubre tenga sentido cualquier día. El Goal Planner
usa también esa fecha.

La demo no se guarda nunca. Los cambios duran hasta cerrar la página. **Reset
Demo** devuelve el ejemplo completo (registros, mes elegido y Goal Planner) y
**Exit Demo** descarta todos los cambios. La demo nunca lee ni escribe el
espacio propio.

## Valores dados (de la especificación)

| Registro | Valor |
| --- | --- |
| Ingreso neto | 6.500 PLN, cobrado el día 1 |
| Rent | 4.000 · día 2 · Housing |
| Utilities | 700 · día 5 · Utilities |
| Transport | 200 · día 6 · Transport |
| Subscriptions | 80 · día 10 · Subscriptions |
| Cuota Small Loan | 320 · día 15 · Loans |
| Credit Card Payment | 200 · día 22 · Cards |
| Cuota Student Loan | 250 · día 25 · Loans |
| Total de facturas / diferencia | 5.750 / 750 ("Income minus Bills", nunca "ahorro") |
| Credit Card | Saldo pendiente 1.800, día de corte 20, día de pago 22 |
| Student Loan | 12.000, día de pago 25 |
| Trip to Japan | Flexible, 600 de 10.000 (6 %, faltan 9.400) |
| Christmas Gift | Con fecha, 100 ahorrados, límite 24-12-2026 |
| Emergency Fund | 300 |

## Valores inventados (no estaban en la especificación)

| Registro | Valor | Motivo |
| --- | --- | --- |
| Saldo Small Loan | 3.600 (al 15-10-2026), 9,90 %, nov 2025 – oct 2027 | Encaja con 320 al mes durante los 12 meses restantes |
| Interés Credit Card | 18,50 % | Tipo habitual de una tarjeta polaca |
| Pago mínimo Credit Card | 90 (introducido, sin regla) | Separado de los 200 planificados |
| Student Loan | 2,00 %, oct 2024 – dic 2030 | Tipo bajo de préstamo de estudios |
| Objetivo Christmas Gift | 400 | 100 ahorrados → 25 %, faltan 300 |
| Nota de Subscriptions | Music 25, Video 40, Cloud Storage 15 | Suman 80 |
| Cuentas | Everyday 820 · Investments 500 · Savings Account 1.200 · Piggy Bank 150 | |
| Savings | 1.350 = Japón 600 + Navidad 100 + Emergency 300 + 350 sin asignar | Sin doble conteo |
| Estado de pagos | Todas las facturas de octubre pagadas en su día salvo Student Loan | Left to Pay el 23-10: 250 |

Totales: Total Debt 17.400 (1.800 + 12.000 + 3.600). Metas 700; con el
Emergency Fund, 1.000.

## Reglas que siguen las cifras

Resumen; el detalle está en [FINANCIAL_RULES.md](FINANCIAL_RULES.md).

- El dinero se guarda en grosze (enteros) y las fechas como `AAAA-MM-DD`.
- Un importe desconocido se muestra como "Amount needed", nunca como 0, y no se
  dice "todo pagado" mientras quede un importe pendiente desconocido.
- Marcar una factura como pagada nunca baja el saldo de una deuda; los saldos
  cambian solo al introducir uno nuevo (el anterior queda en el historial).
- Un préstamo o tarjeta con factura vinculada se paga solo a través de esa
  factura, así que la cuota se cuenta una vez.
- Ahorro nuevo para una meta sube la cuenta de ahorro (y Savings) una vez;
  asignar ahorro que ya existe no cambia ningún total; no se puede sacar más de
  lo ahorrado o sin asignar.
- Cambiar el importe de un mes afecta solo a ese mes; cambiar el importe
  habitual se aplica desde el mes elegido.
