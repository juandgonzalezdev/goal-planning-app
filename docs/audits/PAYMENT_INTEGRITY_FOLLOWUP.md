# Bills 2A — seguimiento de M1, M2 y observaciones UX

Fecha: 5 de noviembre de 2026. Editor: Codex. Revisor: Claude, cuando Juan indique.
Referencia leída: `review-deliveries/bills-2a-payment-integrity/REVISION.md`, veredicto
Approved with observations sobre la primera corrección local. El informe de Claude
no se modifica. Los resultados de Claude se consideran información del informe;
las comprobaciones siguientes son propias de Codex.

## Alcance, base y estado de entrega

Dirección autoriza resolver M1/M2 y L1–L4, sin otros incrementos. Para M2 solicitó
elegir antes de implementar si había alternativas de producto: se presentaron
bloquear la acción o conservar un pendiente recuperable fuera del calendario.
**Juan eligió bloquear la acción y conservar el payment.** No se aplica la opción
de eliminarlo con solo una advertencia, porque dejaría el registro inaccesible.

Git comprobado directamente: `codex/increment-2a-bills`, HEAD/base
`4ba3c0a991500d6f7f586bd3567916cd0632f4fb`; anteriores `e71781f` y `e626006`.
La corrección inicial seguía sin commit: nueve archivos seguidos modificados,
tres suites nuevas y documentación sin seguimiento; índice vacío. Se preservó
ese trabajo y todos los demás archivos ajenos, incluidas entregas y el informe.
Este seguimiento se aplica sobre esa corrección, no únicamente sobre HEAD.
Sin preparar, commit, push, merge ni despliegue. Es entrega local en curso, no
fija por commit; no atribuir estos cambios al HEAD ni a la aprobación anterior.

## Hallazgos y resolución

| Hallazgo | Causa | Corrección |
| --- | --- | --- |
| M1 | Se rechazaba cualquier mes pagado fuera del plan candidato, incluso si ya estaba fuera antes | Se compara `excluded(candidate) − excluded(current)`. Solo exclusiones adicionales bloquean fechas, Pause y Cancel. Las inconsistencias previas permanecen visibles sin modificar payments |
| M2 | Desmarcar fuera del calendario dejaba `paid: false` y borraba fecha/cuenta/interés; el selector ya no podía mostrar ese mes | La acción se bloquea con explicación en el componente compartido de detalle/lista; `markBillNotPaid` también devuelve los datos intactos cuando el mes no está previsto |
| L1 | Si cambiaba Start, siempre se le asignaba el error, aunque lo causara End | Se comprueba cada extremo por separado y se conserva el foco/error en el campo causante |
| L2 | Mensajes genéricos sin mes ni orientación | Mensajes con mes pagado y límite de fechas. En anual se explica también que debe mantenerse el mes de aniversario. Cancelación y pausa distinguen sus motivos |
| L3 | Delete duplicaba la advertencia y decía “0 payments” | Una sola advertencia; con payments incluye cantidad y singular/plural; sin payments no añade conteo |
| L4 | “Outside billing dates or pause” era difícil de interpretar | El detalle dice que la factura no está prevista para el mes, pero el payment fue registrado y sigue contando en History/informes |

El selector de lectura no cambia: cada payment sigue apareciendo y contabilizándose
una sola vez. La guarda de escritura no repara datos restaurados ni convierte
payments en obligaciones nuevas. Un payment vigente que se excluiría por primera
vez continúa bloqueando el cambio, aunque existan otras inconsistencias antiguas.

En M2 no se abre una confirmación destructiva: al intentar Mark as Not Paid se
muestra “Payment kept”, el motivo y Keep as Paid. No se guarda nada, no se emite
éxito y no se eliminan `paidOn`, `paidFrom`, interés, importe o recordedAt. Si el mes
vuelve a estar previsto, la confirmación normal de Mark as Not Paid sigue funcionando.
No se amplía la selección a registros no pagados fuera del calendario.

## Archivos de esta continuación

- `src/domain/finance/bills.ts`: diferencia de exclusiones, comprobación por extremo
  y guarda de Mark as Not Paid.
- `src/domain/finance/subscriptions.ts`: utiliza la misma diferencia al validar
  y aplicar el plan candidato.
- `src/features/bills/BillForm.tsx`: mensajes dinámicos con mes y orientación.
- `src/features/bills/SubscriptionSection.tsx`: redacción de bloqueo Pause/Cancel.
- `src/features/bills/BillScreen.tsx`: redacción de payment fuera del calendario y Delete.
- `src/features/bills/MarkPaid.tsx`: explicación compartida para bloquear M2.
- `src/domain/finance/paymentIntegrity.test.ts`: ocho regresiones nuevas M1/M2/L1.
- `src/features/bills/PaymentIntegrity.test.tsx`: cuatro casos nuevos y ajuste de
  textos esperados; lista/detalle, ausencia de conteo cero y foco en End.
- `docs/FINANCIAL_RULES.md`, `docs/USER_GUIDE.md`, `docs/INCREMENT_2A.md`,
  `docs/WORK_STATUS.md`, `docs/audits/PAYMENT_INTEGRITY_FIX.md` y este documento:
  reglas vigentes, guion y trazabilidad. La suite de almacenamiento previa no cambió.

No cambian modelo, importes, fórmulas, esquema, migraciones, backup, transacciones,
sincronización ni dependencias. La revisión base y el conteo de Delete se conservan.

## Pruebas y comprobaciones propias

Antes de corregir: ocho fallos nuevos sobre 25 casos de dominio, con 17 aprobados.
Se reprodujeron bloqueo por pausa pagada/aniversario heredado, rechazo de fin seguro,
error en extremo equivocado, bloqueo de Pause/Cancel independientes y desaparición
tras Mark as Not Paid fuera de fechas/pausa/aniversario.

Después:

- `npm test -- src/domain/finance/paymentIntegrity.test.ts
  src/features/bills/PaymentIntegrity.test.tsx src/data/paymentIntegrityStorage.test.ts
  --maxWorkers=2`: **37/37**, tres archivos, 4,72 s.
- Dominio: conservación de History, total y PDF tras un cambio independiente,
  un único registro por mes, rechazo de exclusión adicional y conservación íntegra
  de datos ante la acción M2. Las regresiones anteriores de anticipos e interés siguen.
- Interfaz: mensaje de M2 y ausencia de confirmación/guardado desde lista y detalle,
  mes pagado explícito, campo/foco correcto y Delete sin cero.
- La compilación señaló una fixture incompleta de BillsView en la prueba nueva;
  se sustituyó por INITIAL_BILLS_VIEW con modo List. Reejecución específica de
  `src/features/bills/PaymentIntegrity.test.tsx`: **10/10**, 5,31 s.

- Suite completa: `npm test -- --maxWorkers=2`, **920/920 en 66 archivos**, 223,22 s,
  salida 0. Se repitió por petición de Juan y por cambiar guardas comunes de fechas
  y Mark as Not Paid. No se atribuyen las 908 anteriores a este contenido.
- `npm run lint` final: salida 0.
- `npm run build` final: salida 0; JS 711,37 kB, gzip 198,59 kB; aviso conocido >500 kB.
- `git diff --check`: salida 0, sin errores; avisos LF/CRLF de documentación.
  Se revisó el diff de código y la separación con los archivos ajenos. Índice vacío.
- La fixture BillsView se completó mientras la suite ya estaba ejecutándose;
  solo cambió la configuración de la prueba. No hubo cambios de producto tras
  iniciar la suite; sus 10 casos de interfaz se repitieron sobre la fixture final.

Avisos conocidos de jsdom sobre scrollTo y navegación; sin fallos. No se ejecutó
una nueva consulta npm audit: no cambian las dependencias y se conserva el límite
documentado de la comprobación anterior.

## Limitaciones, validación manual y siguiente revisión

- No se ejecutó navegador, Safari/iPhone ni VoiceOver. Las pruebas DOM no acreditan
  una validación manual. El guion actualizado está en INCREMENT_2A.md (pasos 4–6
  del apartado de integridad); los pendientes previos de 2A siguen abiertos.
- Si un payment antiguo está en un mes pausado, esta intervención no añade un
  editor para quitar la pausa. La decisión protectora de Dirección conserva el
  payment y bloquea su desmarcado mientras no esté previsto. No se promete una
  corrección de pausas desde Edit Details, ni se modifica el calendario por esa acción.
- Los registros `paid: false` fuera de calendario que ya existían se tratan como
  antes: no se inventa una obligación ni se reconstruye un payment. Esta corrección
  evita crear ese estado a partir de un payment mediante la acción autorizada.
- Se puede seguir editando fecha/cuenta de un payment que permanece pagado fuera
  de calendario, con validatePayment y reglas ordinarias. Queda documentado en
  FINANCIAL_RULES; no exige desmarcarlo primero.
- Active en el mes inicial tras cancelar antes del primer cargo permanece como
  observación UX fuera de este alcance. No se inicia gestión completa de suscripciones.
- No hay cambios de dependencias. El audit previo no pudo completarse por
  ENOTFOUND del registro; no se presenta como audit limpio ni se aplica audit fix.

Siguiente paso: Juan comunica esta ruta a Claude para revisar exclusivamente
la resolución M1/M2/L1–L4 y la conservación de las defensas previas. Ruta propuesta
para el nuevo informe, sin sobrescribir el anterior:
`review-deliveries/bills-2a-payment-integrity/REVISION-FOLLOWUP.md`.
Antes del cierre 2A siguen pendientes esa revisión y la aceptación manual acordada.
No hay nueva autorización de commit/integración/publicación en este seguimiento.
