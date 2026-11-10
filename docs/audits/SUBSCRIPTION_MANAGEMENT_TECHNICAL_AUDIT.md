# Auditoría técnica de Subscription Management

Fecha: 5 de noviembre de 2026. Autor/editor: Codex. Propuesta evaluada: Claude,
`docs/ux/SUBSCRIPTION_MANAGEMENT_PROPOSAL.md`. Alcance: auditoría y planificación,
sin autorización de implementación. Revisor posterior: Claude, cuando Juan lo indique.

## Base y entrega

Git comprobado directamente: rama `codex/increment-2a-bills`, HEAD/base
`4ba3c0a991500d6f7f586bd3567916cd0632f4fb`; últimos commits: `4ba3c0a`, `e71781f`,
`e626006`. Al iniciar no había modificaciones de archivos seguidos ni contenido
preparado; sí numerosos archivos ajenos sin seguimiento, incluidos `docs/ux/` y
`review-deliveries/`. Se preservan y no se incluyen en esta tarea por iniciativa propia.
Sin commit, push, merge, despliegue ni cambios del índice. Esta auditoría es trabajo
documental local; no es una entrega fija por commit según WORKFLOW.

Se leyeron AGENTS.md, docs/WORKFLOW.md, DEVELOPMENT.md, WORK_STATUS.md,
INCREMENT_2A.md, la propuesta y los consumidores de facturas/pagos.

## Dictamen

**Problema confirmado, prioridad alta (P1): corregir antes de cerrar Bills 2A.**
No hay borrado físico de `billMonths`, pero sí pérdida de visibilidad y de
contabilización: History omite el payment, Spent y Money out bajan, Result sube,
y el PDF reproduce los cálculos incorrectos. Guardar el registro intacto no basta.
No se ha determinado cuántos datos reales están afectados; no se inspeccionaron
datos personales. El defecto pertenece al dominio compartido, no solo a Subscriptions.

La propuesta acierta en el filtro, pero su afirmación de que `applyCancel` evita
siempre los meses pagados es incorrecta. Excluirlos de `upcomingCharges` no impide
que un `endMonth` anterior los deje fuera del rango.

## Evidencia ejecutada

Comando propio de Codex, 5 de noviembre de 2026:

```text
npm test -- src/subscriptionIntegrity.audit.test.ts src/domain/finance/singleMonthBills.test.ts --maxWorkers=2
2 archivos aprobados; 16/16 pruebas; duración Vitest 726 ms.
```

Siete pruebas de caracterización de esta auditoría y nueve existentes de mes único.
Las siete pasan porque expresan el comportamiento actual, incluido el defecto;
no acreditan que la aplicación esté corregida. Se ejecutaron sobre el HEAD indicado,
con un archivo temporal de pruebas, sin alterar código de producto ni pruebas existentes.
El archivo temporal se conserva como evidencia fuera de la suite:
[`SUBSCRIPTION_INTEGRITY_TESTS.ts.txt`](SUBSCRIPTION_INTEGRITY_TESTS.ts.txt).
Para repetir: copiarlo a `src/subscriptionIntegrity.audit.test.ts`, ejecutar el comando
y retirar solo esa copia temporal. Sus importaciones son relativas a `src/`.

Datos ficticios: Audit Stream, cargo mensual de 12345 unidades menores (123,45),
inicio enero de 2026, día 5, payment de abril registrado el 1 de febrero.
`markBillPaid` acepta ese anticipo: valida la fecha real contra hoy, no exige que
el mes de la obligación haya llegado. Se generó el PDF real con `buildReport`,
comprobando su contenido serializado, sin archivo exportado ni inspección visual.

| Caso dirigido | Resultado comprobado | Accesibilidad desde la UI actual |
| --- | --- | --- |
| Payment de abril; editar fin a febrero | `updateBill` acepta; registro intacto; History pasa de 1 payment a 0; Spent, Planned y Money out de abril pasan de 12345 a 0; Result de -12345 a 0; PDF pierde 123.45 | Permitido: Edit Details → More → End month. No requiere restauración |
| Payment de abril; restaurar `pausedMonths: ['2026-04']` | Mismos efectos; `validateFinanceData` acepta el dato | La pausa vigente no permite seleccionar manualmente un mes pagado. Caso por edición externa/restauración o productor antiguo; no se ejecutó una migración |
| Payment anticipado de abril; cancelar el 1 de febrero | La simulación vigente comienza por febrero, `applyCancel` fija enero como fin y oculta abril con los mismos efectos | Permitido por los controles actuales: elegir abril, Mark as Paid con fecha de hoy, volver a simulación de cancelación y confirmar |
| Pausa vigente con abril pagado | Omite febrero, marzo y mayo; History, cálculo de abril y PDF idénticos antes/después | Recorrido ordinario protegido frente al mes pagado |
| Simulación de pausa antigua aplicada a datos con un nuevo payment | `applyPause` no revalida y oculta el nuevo payment | Reproducción de dominio. La sección pasa revisión base al guardar; no se ha reproducido como fallo de concurrencia de UI |
| Cancelar antes del primer cargo | `endMonth = startMonth`, inicio añadido a `pausedMonths`; sin cargo previsto, payment ni gasto en el mes inicial; PDF sin 123.45 | Permitido; no hay pérdida histórica en este caso sin payments |
| Quitar un fin de febrero | Marzo vuelve a tener 12345 pendientes, sin gasto pagado | Permitido en Edit Details; quitar el fin es extensión retroactiva, no Resume desde hoy |

La cancelación anterior al primer cargo queda `active` durante enero en `validityOn`
y `upcoming` antes de enero: incoherencia de presentación confirmada, no cargo ficticio.
La prueba de cancelación con anticipo usa un rango mensual ordinario; el riesgo de
recorte también existe para anuales por el mismo algoritmo (inspección, sin caso anual
nuevo ejecutado). Una pausa anual pide tres cargos pero el horizonte de búsqueda
actual solo alcanza el mes actual +24; puede encontrar menos de tres.

Los casos incompatibles de fin y pausa pasan `validateFinanceData`: una restauración
no los rechaza por esta inconsistencia. Esto se verificó llamando al validador, no
mediante el recorrido completo de importar un backup.

## Causa y alcance técnico

- `bills.ts:isBillDueIn` exige fechas, aniversario y ausencia de pausa;
  `billsForMonth` filtra antes de leer el payment.
- `history.ts:activityLog` recorre meses pagados pero vuelve a usar ese filtro.
- `spending.ts:monthSpending/monthResult`, `overview.ts:monthlyOverview` y los
  consumidores de Home utilizan la misma selección. Puede faltar gasto, pago de
  tarjeta, principal/interés de préstamo o efectivo, según la factura.
- `flows.ts:accountFlows/reconcileAccount` también dependen de la selección;
  pueden faltar flujos. Los snapshots guardados y Remaining Balance no se borran.
- `report/report.ts:buildReport` calcula Summary con `monthResult` y categorías
  con `monthSpending`; no es una lista literal de todos los payments. La prueba
  acredita la desaparición del importe en el PDF, no una fila de History del PDF.
- `validateBillFields/updateBill` no comparan fechas nuevas con meses pagados.
  Cambiar inicio puede producir la misma exclusión; el cambio de aniversario en
  una anual también merece cobertura al corregir. No se ejecutaron esos dos casos.
- `applyPause` confía en la simulación recibida; `applyCancel` toma el primer
  cargo pendiente y recorta todo lo posterior, incluidos payments posteriores.

## Solución mínima recomendada para integridad (pendiente de autorización)

1. Regla común de escritura: evaluar la factura candidata contra todos sus meses
   `paid: true`; rechazar cambios de inicio, aniversario, fin o pausa que los excluyan.
   Aplicarla a Edit Details, End/cancel y Pause, con datos vigentes al confirmar.
   Error visible y accesible; no proponer desmarcar un payment real como solución normal.
   Para End anterior a un anticipo, bloquear y explicar el último mes pagado que limita
   el fin. No mover ni borrar ese payment, ni ajustar fechas silenciosamente.
2. Defensa de lectura para datos ya inconsistentes: incluir los payments registrados
   aunque su mes no esté planificado. Mantener el predicado de cargos previstos
   separado del de hechos pagados, o definir explícitamente una unión sin duplicados
   en el selector compartido y revisar la semántica de Planned. Cubrir History,
   Spent, Money out, flujos y PDF conjuntamente: arreglar solo History no es suficiente.
   El payment no debe reaparecer como pendiente ni crear atrasos. Mostrar la
   inconsistencia sin reparar ni eliminar datos automáticamente.
3. Conservar las protecciones de revisión base y doble envío; las funciones de dominio
   deben revalidar aunque la UI ya compruebe. No rechazar sin más la carga de espacios
   antiguos: eso podría impedir acceder a los registros que se pretende proteger.

Recomiendo ambas defensas antes del cierre: solo validar nuevas ediciones deja los
backups y espacios ya afectados con informes incorrectos. No exige esquema nuevo ni
implementar la UX completa. Regresiones necesarias al autorizar: fin/inicio/aniversario,
meses pausados importados, anticipos, cancelación fresca y simulación obsoleta,
cuentas/deudas con interés, importes desconocidos, PDF mensual/anual y privacidad.
Comprobar que los importes efectivos de payments no se reinterpretan al tocar el plan;
hay pagos sin `amount` propio que heredan el habitual. No convertir este defecto en
una migración destructiva ni recalcular automáticamente saldos o Contribution.

## Evaluación de la propuesta UX

**Reutilizable:** `simulateSubscription('cancel')` para la proyección de cargos,
importes desconocidos y preferencias `canCancel`; `applyCancel` como base del fin
antes del próximo cargo, solo tras proteger los anticipos. Conservables: revisión
base, bloqueo de envío, `outcomeText`, `useUnsavedChanges`, privacidad y confirmación.
El proveedor no se cancela desde la app: el aviso propuesto debe ser visible.

**Matices de proyección:** el simulador pide 12 cargos mensuales pendientes o uno
anual, dentro de una búsqueda de hasta 24 meses; con pausas o anticipos no equivale
necesariamente a los próximos 12 meses de calendario. Corregir horizonte/texto antes
de prometer ese ahorro. `applyCancel` usa el mes anterior al próximo cargo, que en
una anual puede no ser el mes del último cargo real. Last charge debe calcularse
por ocurrencia, sin confundirlo con fecha fin ni con fecha de payment.

**End tras cargo elegido:** nueva operación pequeña que guarde el mes inclusivo,
valide todos los payments y recalcule el impacto. No reutilizar sin cambios el
simulador actual, que solo admite pausa/cancelación inmediata. Si no hay próximos
cargos en 24 meses, no deducir que la suscripción terminó. Un límite de búsqueda
tampoco prueba que no se cobró; usar “No payments recorded” cuando solo se sabe eso.

**Manage Subscription en Bill Details:** mover/reestructurar `SubscriptionSection`
desde debajo de Usual Amount a encima de `MonthSwitch`, conservando la condición
de categoría. Estado respecto de hoy, separado del mes consultado; End y fechas
visibles, valoración y simulación secundaria plegadas, Delete en zona diferenciada.
Evitar duplicar Skipped months entre sección y Details. Añadir foco al abrir/cerrar,
fieldset/select nativos, avisos polite, protección de borrador, ancho móvil y revisión
de importes ocultos. No requiere navegación nueva ni esquema para End.

**Pausa actual:** lista finita de meses omitidos, tres próximos cargos elegibles,
no tres meses continuos; excluye pagados y vencidos, incluidos los que vencen hoy
(`dueDate <= today`). Se retoma automáticamente al siguiente cargo no omitido;
no hay Resume, fecha abierta, periodos ni estado Paused. Repetir la acción puede
añadir más meses. El restart fee afecta solo a la simulación, no registra un cargo.
En 2A.1 puede conservarse como “Skip Next 3 Charges”, explicando que pueden ser
menos por horizonte/fin; no prometer una pausa abierta. No sumar ahora la casilla
para omitir vencidos: amplía la semántica de obligaciones pendientes.

**Modelo posterior:** pausas abiertas y Resume duradero requieren ampliar la
representación actual finita (intervalos from/until o equivalente). Definir límites
inclusivos/exclusivos, solapamientos, precedencia del fin, aniversario anual,
compatibilidad de `pausedMonths`, validación, almacenamiento, backups/restauración,
migración no destructiva y demo. `endedOn` es opcional para auditoría, no requisito
de End mínimo ni sustituto del último mes debido. Un estado Paused para meses
finitos actuales puede derivarse sin campo nuevo; la gestión completa sí precisa
semántica nueva. No deducir Ended simplemente de “no próximos cargos”.

**Protección de payments:** todos los campos registrados (importe, fecha, cuenta,
interés y recordedAt) deben conservarse; End/Pause no son Delete. Delete ya borra
`billMonths` explícitamente: decidir aparte si se mantiene con conteo y advertencia.
Las medidas de lectura deben seguir distinguiendo principal, interés y gasto.

## Secuencia propuesta y aprobaciones

1. **Autorizar corrección acotada P1**, independiente de rediseño: guardas de escritura
   y lectura histórica tolerante; pruebas dirigidas y regresión financiera/PDF.
   Tras cambios, lint/build y comprobaciones exigidas según alcance; suite amplia
   justificada por el selector compartido. Nueva entrega fija y revisión de Claude.
2. **Cerrar 2A** únicamente tras esa corrección y la validación pendiente registrada
   en INCREMENT_2A.md, incluida la revisión de Frequency. Las confirmaciones previas
   conservan su alcance; no sustituyen Safari/iPhone, VoiceOver, History ni PDF.
   Juan decide commit/integración/publicación por separado.
3. **2A.1 — End Subscription**, aprobar un alcance recortado: sección visible,
   fin antes del próximo cargo o tras cargo elegido, estado/avisos y separación de
   Delete. Solo Subscriptions; sin esquema, pausa abierta ni reactivación desde Ended.
   Change End/Keep It Going se limitarían a fin todavía futuro; nunca rellenar
   silenciosamente el hueco de una suscripción terminada. Prellenar Add Bill puede
   diferirse para que siga siendo pequeño. No estimar “un componente” como garantía:
   dominio, UI, pruebas y documentación también cambian.
4. **Navegación flotante y selector 360° inmediatamente después**, sin condicionarlos
   a Pause/Resume o evolución adicional de Home. Si 2A.1 crece más allá del alcance
   anterior, dividirlo y devolver prioridad a navegación; la P1 sí es requisito previo.
5. **Pause/Resume completo después**, con decisión explícita de modelo y de producto:
   filtro Paused, anuales, cargos vencidos, reanudación y eventos de History.

Dirección debe aprobar la corrección P1 antes de implementarla; el alcance/orden
de 2A.1 frente a navegación; End solo Subscriptions; conservar pausa limitada;
política de Delete con payments; límites de Change End/Keep It Going. D5/D6/D8
pueden esperar al incremento completo. Esta auditoría no concede esas autorizaciones.

## Ubicación de la propuesta y limitaciones

AGENTS.md reserva la escritura de Claude a la ubicación acordada en
`review-deliveries/`. La cabecera de la propuesta declara una excepción expresa
de Juan; esa autorización previa no está verificable en este chat. Si Dirección
ratifica la excepción, puede conservarse su ruta. Si no, acordar una ruta como
`review-deliveries/subscription-management-ux/REVISION.md`, trasladar preservando
literalmente el contenido y dejar una referencia desde docs si procede. No se
movió, editó ni eliminó la propuesta durante esta auditoría.

No se ejecutaron navegador, recorridos manuales, Safari/iPhone ni VoiceOver.
La disponibilidad de los controles se determinó por inspección y sus operaciones
por pruebas de dominio, no por clics automatizados. No se repitieron suite completa,
lint, build ni audit: no cambió producto, dependencias ni pruebas permanentes; el
objetivo nuevo se cubrió con las 16 dirigidas. No se atribuyen aquí resultados de
entregas anteriores como comprobaciones nuevas. Pendiente: aprobación y posterior
implementación/revisión; no está corregido el defecto ni cerrado 2A.
