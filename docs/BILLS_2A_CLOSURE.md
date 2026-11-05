# Bills 2A — verificación final y preparación del cierre

Fecha: 5 de noviembre de 2026. Editor: Codex. Alcance exclusivo: Bills 2A.
Reglas: AGENTS.md y docs/WORKFLOW.md (no existe WORKFLOW.md en la raíz).

## Estado comprobado y recomendación

Dirección aprobó expresamente el cierre, commit, entrega fija, merge a main y
push el 5 de noviembre de 2026, limitados a los 16 archivos de este manifiesto.
La ejecución y sus hashes/resultados se registrarán en la entrega fija local
review-deliveries/bills-2a-closure/<commit-final-completo>/, sin incluirla en la app.
O2/O3 permanecen diferidas y los avisos conocidos conservan su estado. El push
activa el despliegue automático; no acredita por sí solo la publicación.
El apartado siguiente conserva el estado comprobado al preparar la aprobación.

**Ready to merge**, pendiente de aprobación final de Dirección. Rama:
`codex/increment-2a-bills`; HEAD `4ba3c0a991500d6f7f586bd3567916cd0632f4fb`.
Índice vacío; cambios de integridad y cierre sin preparar ni commit. Entrega local
en curso, no fija por commit. No se ha hecho merge, push ni despliegue.

`main` y la referencia local `origin/main` están en
`48f6aea44de1c6fb0448d12b5dbe5178cf353fb4`, antecesor de HEAD. Consulta directa
`git ls-remote origin refs/heads/main` confirma el mismo hash remoto. Los seis
commits de Bills 2A sobre esa base son coherentes con el alcance. Un commit final
con los archivos delimitados abajo permite integración fast-forward si main no avanza.

## Corrección y comprobaciones

O1: ConfirmNotPaid distingue meses pausados de meses fuera de calendario. El primero
explica el bloqueo y conservación en History/informes sin sugerir quitar una pausa;
el segundo orienta a Edit Details. No cambia dominio ni datos. La regresión cubre
ambos motivos desde lista y detalle, ausencia de escritura y conservación de History.

Resultados propios de Codex sobre el contenido final de código:

- `npm test -- src/features/bills/PaymentIntegrity.test.tsx src/domain/finance/paymentIntegrity.test.ts src/data/paymentIntegrityStorage.test.ts --maxWorkers=2`:
  **39/39**, tres archivos, 4,92 s. Incluye dos casos nuevos de O1.
- `npm run lint`: correcto.
- `npm run build`: correcto; JS 711,44 kB, gzip 198,57 kB.
- `git diff --check` y comprobación del índice: correctos, índice vacío.

La suite completa **920/920 en 66 archivos** corresponde al contenido anterior a
O1: consta tanto en la entrega previa de Codex como en REVISION-FOLLOWUP de Claude.
Se reutiliza esa evidencia; no se ejecuta otra suite completa por dos textos y su
regresión dirigida. No se presenta 922/922 como una ejecución completa nueva.
La cobertura inspeccionada incluye History/totales/PDF, payments fuera de fechas o
pausas, anticipos, cancelación normal y anterior al primer cargo, préstamo y Remaining
Balance, Delete limitado a la factura, Cancel sin escritura y conflicto transaccional
entre pestañas. No cambia esquema, dependencias, migraciones ni fórmulas.

Las confirmaciones manuales actuales y sus límites están en INCREMENT_2A.md.
Codex no ha ejecutado navegador, Safari/iPhone, teclado real ni VoiceOver.

## Observaciones y límites residuales

- O2: hipótesis no reproducida de mensaje de éxito incorrecto al cambiar fechas en
  otra pestaña durante Mark as Not Paid. Inspeccionados ambos llamadores,
  markBillNotPaid y useSpace.commit: la guarda devuelve los datos actuales intactos
  si el mes deja de estar previsto; el almacén rechaza revisiones obsoletas. Un
  no-op podría devolverse como saved y producir mensaje incorrecto. No se encontró
  consecuencia de integridad asociada a esta hipótesis; se difiere el ajuste de
  confirmación/revisión, sin ampliar este cierre.
- O3: dos textos genéricos de FIELD_ERRORS en BillForm.tsx se sustituyen por mensajes
  dinámicos. Limpieza diferida, sin efecto funcional observado.
- Limitación conocida: un payment heredado en un mes pausado permanece visible y
  contabilizado; la interfaz actual no permite quitar esa pausa ni desmarcarlo.
- Observación UX ya conocida: Active puede conservarse en el mes inicial al cancelar
  antes del primer cargo; el cargo se omite. No es una incidencia nueva de este cierre.
- Aviso conocido de build >500 kB y avisos históricos de jsdom, sin fallos.
- npm audit previo no completado por ENOTFOUND; sin cambios de dependencias ni nueva
  ejecución. No se declara audit limpio; se conserva el antecedente documentado de
  vulnerabilidades moderadas de herramientas. No se aplica audit fix.

## Archivos pendientes de commit e integración preparada

Lista explícita para el commit final, sin usar git add global:

- src/domain/finance/bills.ts
- src/domain/finance/subscriptions.ts
- src/features/bills/BillForm.tsx
- src/features/bills/BillScreen.tsx
- src/features/bills/MarkPaid.tsx
- src/features/bills/SubscriptionSection.tsx
- src/domain/finance/paymentIntegrity.test.ts (nuevo)
- src/features/bills/PaymentIntegrity.test.tsx (nuevo)
- src/data/paymentIntegrityStorage.test.ts (nuevo)
- docs/FINANCIAL_RULES.md
- docs/USER_GUIDE.md
- docs/INCREMENT_2A.md
- docs/WORK_STATUS.md
- docs/audits/PAYMENT_INTEGRITY_FIX.md (nuevo)
- docs/audits/PAYMENT_INTEGRITY_FOLLOWUP.md (nuevo)
- docs/BILLS_2A_CLOSURE.md (nuevo)

Todos están en rutas del proyecto permitidas para Codex. Los informes de Claude
permanecen intactos en review-deliveries y no se incluyen en el commit de la app.
Se conservan y excluyen todos los demás archivos sin seguimiento, incluidos brand,
rumbo-01-08, resúmenes, results.json, archivos con nombres accidentales, documentación
de auditoría previa de suscripciones y propuesta UX. No se eliminan por este cierre.

Tras aprobación: comprobar de nuevo rama/índice y remoto, preparar solo esta lista,
revisar diff preparado y crear commit; generar entrega fija por hash con DELIVERY,
GIT_STATUS, changes.diff y copias desde el commit según WORKFLOW. Verificar main
sin divergencia y realizar merge --ff-only y push autorizados. Si cambia la base o
aparecen conflictos, resolver el nuevo estado antes de integrar. El push a main
activa el despliegue automático configurado; no se ha activado en esta preparación.

## Dirección UX aprobada para futuros alcances (sin implementar)

- Barra principal flotante y persistente, con iconos y etiquetas.
- Selector de meses 360° con navegación continua entre años.
- Acceso rápido a All Bills en la parte superior de Bills.
- Búsqueda de facturas y acceso sencillo a Details/Edit Details.
- Simplificar el calendario vacío cuando Pending = 0.
- End Subscription desde Bill Details como incremento 2A.1.
- Pause/Resume completos en un incremento posterior.
- Rediseño PDF con preguntas y respuestas, anillos e identidad visual.
- Nombres de descarga descriptivos para informes mensuales y anuales.

Son dirección de producto aprobada, no autorización de implementación dentro de 2A.
