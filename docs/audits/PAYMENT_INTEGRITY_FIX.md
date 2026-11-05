# Bills 2A — corrección de integridad de payments

Fecha: 5 de noviembre de 2026. Editor: Codex. Revisión de Claude pendiente del aviso
de Juan. Autorización: corregir exclusivamente la integridad histórica dentro de 2A,
incluido Delete Bill con advertencia y cantidad. No incluye Manage Subscription,
Pause/Resume completo ni navegación.

Actualización posterior: Claude revisó esta primera corrección con veredicto
Approved with observations en `review-deliveries/bills-2a-payment-integrity/REVISION.md`.
Dirección autorizó resolver M1/M2 y L1–L4. La continuación, que sustituye la guarda
estricta de todos los meses por la de exclusiones adicionales y bloquea Mark as Not
Paid fuera del calendario, está en [PAYMENT_INTEGRITY_FOLLOWUP.md](PAYMENT_INTEGRITY_FOLLOWUP.md).
Los resultados anteriores de este documento describen la primera corrección.

## Base, separación y entrega

Comprobación directa de Git al inicio: rama `codex/increment-2a-bills`, base/HEAD
`4ba3c0a991500d6f7f586bd3567916cd0632f4fb`; commits anteriores `e71781f` y `e626006`.
El índice estaba vacío. WORK_STATUS.md tenía las 19 líneas de la auditoría previa;
se conservaron. La auditoría, su evidencia, la propuesta y numerosas entregas/archivos
ajenos ya estaban sin seguimiento; se preservan. Esta corrección no los prepara ni
los añade a otro alcance. Sin commit, push, merge o despliegue. Según WORKFLOW,
esta documentación es una entrega local en curso, no una entrega fija por commit.

## Causa raíz y decisión

`billsForMonth` seleccionaba solo la previsión (`isBillDueIn`) antes de leer los
payments. Un hecho pagado podía quedar oculto por un fin anterior, por inicio o
aniversario incompatible, o por una pausa. Todos los consumidores compartían esa
omisión: History, Spent, Money out, flujos y PDF. `applyCancel` recortaba el rango
antes del primer cargo no pagado, incluso si había un anticipo pagado posterior.

Se aplican dos defensas sin migrar ni reparar datos silenciosamente:

1. **Lectura:** unión de facturas previstas y payments registrados de ese mes,
   cada factura una sola vez. Los registros con `paid: false` fuera del plan no
   entran. El predicado `isBillDueIn` sigue expresando previsión; Upcoming no
   inventa cargos y Left to Pay no incluye estos payments como pendientes.
2. **Escritura:** editar las fechas o aplicar cancelación/pausa exige que el plan
   candidato incluya todos los meses pagados. Rechazo completo; no se mueve,
   elimina ni cambia un payment. La UI explica el error antes de guardar.

Planned Bills ya significa facturas del mes “paid or not”: incluye también estos
payments recuperados. No se resta de Spent ni se añade un pendiente para compensar.
History conserva su criterio del mes de la obligación y la fecha pagada separada;
no se traslada un anticipo al mes de su fecha de registro.

## Archivos y comportamiento

| Archivo | Cambio |
| --- | --- |
| `src/domain/finance/bills.ts` | Unión de previsión y payments, helper de meses pagados excluidos, rechazo de fechas incompatibles y edición de un payment heredado aunque ya no esté previsto |
| `src/domain/finance/subscriptions.ts` | Construcción compartida del plan candidato y revalidación al aplicar cancelación/pausa; devuelve los datos originales ante conflicto |
| `src/features/bills/BillForm.tsx` | Error asociado al campo de fechas, apertura de More y foco según patrón existente |
| `src/features/bills/SubscriptionSection.tsx` | Meses en conflicto visibles, confirmación bloqueada sin mensaje falso de éxito; conserva revisión base y guardado existentes |
| `src/features/bills/BillScreen.tsx` | Aviso de payment fuera del plan, conteo explícito de Delete y revisión capturada al abrir su confirmación |
| `src/domain/finance/paymentIntegrity.test.ts` | Regresiones financieras y contenido PDF mensual/anual, fechas, anticipos, pausas y Delete |
| `src/features/bills/PaymentIntegrity.test.tsx` | Errores accesibles/foco, bloqueo de cancelación, detalle del payment heredado y confirmación Delete |
| `src/data/paymentIntegrityStorage.test.ts` | Lectura de copia antigua, backup, recuperación, conflicto entre dos pestañas y borrado atómico |
| `docs/FINANCIAL_RULES.md`, `docs/USER_GUIDE.md`, `docs/INCREMENT_2A.md`, `docs/WORK_STATUS.md` | Reglas, comportamiento y recorridos de aceptación actualizados |
| Este documento | Entrega, resultados y límites |

History, spending, flows y report no necesitan filtros alternativos ni duplicación
de sus fórmulas: todos reciben la selección corregida. No se cambió esquema,
dependencias, formato de backup, migraciones, transacciones ni sincronización.
Los registros sin importe propio siguen leyendo el habitual según la regla previa;
editar fechas o aplicar pausa/cancelación no modifica ese importe ni sus cambios.
Editar importes explícitamente sigue siendo una acción separada, fuera del cambio
de fechas. No se inventan importes ni fechas que nunca se registraron.

## Delete Bill y almacenamiento

Se verificó antes de modificar su interfaz: las únicas referencias de registro a
`billId` en el modelo financiero están en `billMonths`. `deleteBill` elimina la
factura y sus registros del mismo FinanceData, y el almacén guarda el espacio completo
en una transacción con comparación de revisión. No queda un payment huérfano. La
deuda vinculada, Remaining Balance y demás snapshots permanecen; no se recrea un
monthlyPayment independiente en la deuda (comportamiento previo).

Es seguro conservar la acción explícita con las reglas actuales. La nueva
advertencia cuenta todos los registros `paid: true`, incluidos los fuera del plan,
sin revelar importes. Cancel no guarda nada. La revisión de apertura se entrega
al guardado: después de abrir una versión más reciente, una confirmación vieja
no borra sobre ella. También se mantiene el bloqueo transaccional si la pestaña
no recibió el aviso. No se promete deshacer: los backups anteriores son copias
separadas y una restauración explícita puede recuperar datos borrados, como antes.
No se encontró otro riesgo que requiera cambiar la política aprobada de Delete.

## Ubicación de la propuesta de Claude

Regularizada por Codex con la autorización actual de Juan:

- Original íntegro: `review-deliveries/subscription-management-ux/REVISION.md`.
- Referencia en la ruta anterior: `docs/ux/SUBSCRIPTION_MANAGEMENT_PROPOSAL.md`.
- SHA-256 antes y después del traslado:
  `9955171AA41B0D62F46822D80B6467321F0EFE329A3EDBF1D629D38865518758`.

El texto original no se editó; su cabecera sobre la ruta anterior es histórica.
No se incluye review-deliveries en un commit por iniciativa propia. La auditoría
anterior conserva su valor fechado; su propuesta pendiente queda autorizada solo
en lo que establece este incremento, no en el rediseño completo.

## Comprobaciones propias de Codex

- Antes de corregir: 17 pruebas nuevas de dominio, 12 fallaban y 5 pasaban.
  Fallos: restauración con fin/pausa/inicio/aniversario, edición de fechas,
  anticipos mensuales/anuales, pausa obsoleta, importes desconocidos/cero e interés.
- Primera ejecución tras corregir: dos expectativas de pruebas se precisaron:
  cambiar frecuencia en un dato restaurado modifica la clasificación regular/anual
  aunque conserva el importe; History representa cero saliente como `-0`.
- Dirigida: `npm test -- src/data/paymentIntegrityStorage.test.ts
  src/features/bills/PaymentIntegrity.test.tsx src/domain/finance/paymentIntegrity.test.ts
  --maxWorkers=2`: **25/25** en tres archivos, 3,94 s.
- Lint: `npm run lint`, salida 0.
- Build final: `npm run build`, salida 0; JS 710,10 kB, gzip 198,26 kB.
  Mantiene aviso conocido de fragmento >500 kB. Las primeras compilaciones
  detectaron campos obligatorios/tipo en la nueva fixture de préstamo; corregidos.
- `npm audit --omit=optional`: no completado, `ENOTFOUND registry.npmjs.org`.
  No se acredita audit limpio ni se ejecutó audit fix; no cambian dependencias.

- Suite completa: `npm test -- --maxWorkers=2`: **908/908 pruebas en 66 archivos**,
  220,65 s. Se justifica por el selector compartido en varias áreas financieras.
  Avisos conocidos de jsdom sobre scrollTo y navegación, sin fallos.
- Después se repitió solo `src/domain/finance/paymentIntegrity.test.ts`: **17/17**,
  680 ms, para verificar la fixture de préstamo completada durante la compilación.
  No cambió producto tras iniciar la suite completa; no se repitió entera.
- `git diff --check`: correcto; solo avisos de conversión LF/CRLF en documentación.
- Índice comprobado vacío al finalizar; los cambios quedan sin preparar.

No se ejecutó navegador ni se confirmó ninguna prueba manual de Juan.

## Límites y siguiente paso

- Los datos legibles antiguos siguen accesibles; no se exige reparación para cambiar
  una nota. Si se cambia el calendario, todos los meses pagados deben encajar. Una
  pausa heredada incompatible no se elimina automáticamente.
- Un registro huérfano de factura o estructura inválida sigue sujeto al validador
  existente; esta corrección no inventa la factura faltante ni acepta datos ilegibles.
- La corrección no recupera un payment que ya fue borrado explícitamente. Conserva
  y vuelve a mostrar los que siguen guardados.
- Cancelar antes del primer cargo conserva la representación existente con pausa
  del inicio. Su etiqueta Active en el mes inicial es una limitación UX conocida,
  sin efecto contable, reservada al incremento posterior.
- No se añaden estados, filtros o gestión de suscripción. La pausa limitada y el
  horizonte de simulación no cambian.
- Pendientes revisión de Claude y validación manual de Juan: anticipos, rechazo de
  fechas, restauración, PDF visible/oculto y Delete con otra pestaña; guion concreto
  en INCREMENT_2A.md. Los pendientes anteriores de 2A, Frequency, móvil/VoiceOver
  y ambos temas conservan su alcance y no se declaran aprobados.

Recomendación: llevar esta corrección a revisión y validación de 2A. No cerrar
ni integrar 2A hasta completar los pendientes acordados y recibir autorización.
Commit y entrega fija para Claude requieren la autorización correspondiente;
no se crearon snapshots atribuidos a un commit que no contiene estos cambios.
