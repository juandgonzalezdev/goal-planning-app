# Incremento 2A.1 — End Subscription

Fecha: 5 de noviembre de 2026. Editor: Codex. Revisor independiente: Claude, tras
el aviso de Juan. Estado: implementación local; pendiente de autorización de commit
para generar entrega fija por hash según docs/WORKFLOW.md.

## Alcance y base

Base comprobada directamente: main, 4112c234a4e8813d3e04ae2f9c70877e41f8ef73.
Rama de trabajo: codex/increment-2a1-end-subscription. Índice inicialmente vacío;
archivos ajenos sin seguimiento conservados y excluidos. Sin commit, push, merge
ni despliegue. La publicación de 2A fue comunicada por Dirección, no comprobada
con navegador en este incremento. WORKFLOW.md aplicable está en docs/.

Antes: la cancelación estaba tras valoración/opciones, debajo de Usual Amount,
con What If I Cancel It?; podía dejar Active antes del primer cargo y fijar el fin
anual en un mes sin cargo. Ahora: Manage Subscription aparece antes de MonthSwitch,
con estado y End Subscription visibles. Review Subscription pliega las opciones
secundarias y conserva la simulación limitada de pausa existente.

## Comportamiento y decisiones

- End Subscription abre una vista previa sin escribir. Muestra desde qué mes cesan
  los cargos, el último mes con cargo previsto conservado y el ahorro de los cargos
  calculados. Confirm End Subscription guarda; Cancel conserva el dato anterior.
- Se reutilizan simulateSubscription, subscriptionPlan, applyCancel, guardas de
  payments, revisión de apertura, bloqueo de escritura/doble envío, outcomeText y
  protección de cambios sin confirmar. No se modifica el almacenamiento ni el esquema.
- La fecha final retrocede desde el próximo cargo hasta el último mes realmente
  previsto. Así anuales y meses omitidos conservan los mismos cargos, con una fecha
  comprensible y Ended inmediatamente tras confirmar. No se modifican payments.
- Antes del primer cargo se conserva la representación vigente: inicio=fin y ese
  mes omitido. validityOn la interpreta como Ended para Subscriptions, incluso
  antes de ese mes; activeSubscriptions la excluye. Se aplica también a datos
  restaurados. Es indistinguible de una suscripción de un mes cuyo único cargo
  fue omitido: se considera Ended porque no conserva ningún cargo. Otras categorías
  e ingresos mantienen su clasificación. No se introduce Paused ni migración.
- En el detalle, Active significa que el plan aún no ha terminado; puede empezar
  en el futuro. Ended también se muestra en el mes final si ya no quedan próximos
  cargos y el fin está en este mes o antes. All Bills mantiene su regla mensual
  inclusiva salvo la representación sin primer cargo indicada arriba.
- No se deduce Ended por agotar la búsqueda de dos años con un fin lejano o sin fin.
  Si el simulador no encuentra cargos elegibles, se explica y no permite confirmar.
- La previsión reutilizada contiene hasta 12 cargos mensuales o uno anual, buscando
  hasta 24 meses. El texto habla de esos cargos, sin prometer 12 meses de calendario.
  Importes desconocidos no cuentan; si todos son desconocidos, no se anuncia ahorro cero.
- La confirmación explica que la app solo termina el plan local. El usuario debe
  cancelar el servicio con el proveedor. canCancel=false mantiene el bloqueo previo.
- Payments incompatibles bloquean con el mes pagado explícito. History, cálculos y
  PDF siguen usando la unión protegida de previsión y payments de Bills 2A.
- Al abrir la confirmación se enfoca su explicación; Cancel devuelve el foco a End
  Subscription y guardar lo lleva al estado. Controles nativos, sin modal ni formulario
  adicional. La confirmación no se cierra si guardar falla o la revisión es obsoleta.
- No se añaden selector de último cargo, Pause/Resume, navegación, Home ni rediseño PDF.
  Se conserva el criterio existente: finalizar antes del siguiente cargo elegible;
  los cargos vencidos y el de hoy permanecen según upcomingCharges.

## Manifiesto para el futuro commit

1. src/features/bills/BillScreen.tsx — ubicación al inicio.
2. src/features/bills/SubscriptionSection.tsx — gestión, textos, estimación y foco.
3. src/domain/finance/subscriptions.ts — fecha del último cargo; candidato compartido;
   exclusión del caso sin primer cargo en suscripciones activas.
4. src/domain/finance/validity.ts — estado del caso sin primer cargo.
5. src/features/bills/PaymentIntegrity.test.tsx — preview/cancel/confirm, estado,
   desconocidos, revisión obsoleta, anuales y huecos; conserva regresiones anteriores.
6. src/domain/finance/validity.test.ts — datos restaurados y aislamiento de categoría.
7. src/domain/finance/singleMonthBills.test.ts — estado y ausencia de cargos ficticios.
8. src/BillsCalendar.test.tsx — nombres de acciones y mensaje del recorrido existente.
9. docs/USER_GUIDE.md — instrucciones del nuevo recorrido.
10. docs/WORK_STATUS.md — coordinación vigente.
11. docs/INCREMENT_2A1.md — esta entrega y aceptación.
12. src/AlexDemo.test.tsx — expectativa del texto de ahorro por cargos.

review-deliveries y todos los archivos ajenos quedan fuera del commit de la app.

## Comprobaciones

Resultados y logs propios del 5 de noviembre de 2026. No son comprobaciones de Claude ni aceptación manual de Juan.

- Primera dirigida: 106/107; una expectativa conservaba el mensaje antiguo de
  cancelación. Se actualizó al mensaje que distingue el plan de la app del proveedor.
- Dirigida posterior: 84/84 en cuatro archivos (42,06 s), antes de ajustar el último
  cargo en anuales/huecos. Incluye BillsCalendar, integridad UI, validity y mes único.
- Dirigida final del ajuste de fecha: 73/73 en cuatro archivos (6,29 s), integridad UI
  y dominio, alexDemo y mes único. Incluye anuales/huecos, History/cálculos/PDF.
- npm audit --omit=optional: no completado por ENOTFOUND registry.npmjs.org.
  Sin cambio de dependencias ni audit fix; no se acredita audit limpio.
- Se ejecuta suite completa por el cambio de validity compartido y del candidato
  de cancelación. El resultado final se añade debajo; no se reutiliza la suite 2A
  como si verificase este incremento.

## Validación manual pendiente de Juan

Usar solo datos ficticios. No se ejecutó navegador, teclado real, Safari/iPhone,
VoiceOver ni inspección visual de PDF en este incremento. Ningún paso se da por confirmado.
Repetir en móvil a 390 px y Safari/iPhone, claro y oscuro; verificar texto y botones
sin desbordamiento ni controles tapados.

1. Crear Test Stream mensual, 25, día posterior a hoy, inicio este mes. Abrir Details:
   Manage Subscription y End Subscription antes del selector de mes, sin abrir Edit.
2. End Subscription: revisar primer mes sin cargos y ahorro. Cancel: mismos datos,
   cobros y estado; con teclado el foco vuelve a End Subscription.
3. Confirmar: Ended visible inmediatamente y al reabrir/recargar; ningún próximo
   cargo en Bills ni Planned Bills. Los vencidos previos permanecen.
4. Registrar un payment ficticio anterior antes de finalizar: History, importe,
   fecha, cuenta e interés permanecen; exportar PDF mensual/anual y comprobar totales,
   también con importes ocultos. No debe duplicarse el payment.
5. Crear otra suscripción que comienza el mes próximo; finalizar antes del primer
   cargo. Debe mostrar Ended al instante y en All Bills/Ended, sin cargo ni payment
   inventado en el mes inicial.
6. Suscripción anual iniciada en un mes pasado: finalizar; el último mes conservado
   debe ser el último cargo anual, no el mes previo al siguiente aniversario.
7. Con payment anticipado posterior al corte: End Subscription muestra el mes pagado
   y bloquea Confirm, sin cambiar ni ocultar el payment.
8. Solo importe desconocido: sin ahorro cero engañoso; permitir finalizar si no hay
   conflicto. canCancel=No conserva el bloqueo previo y explica la preferencia.
9. Teclado: Tab hasta End Subscription, Enter; explicación enfocada, Confirm/Cancel
   accesibles. Tras confirmar, foco en estado. VoiceOver debe leer título, estado,
   advertencia del proveedor y conflicto. Review Subscription debe plegarse nativamente.
10. Abrir confirmación y recibir una revisión más reciente desde otra pestaña:
    confirmar no debe sobrescribirla; se mantiene la explicación del guardado fallido.

## Siguiente paso

Comprobaciones terminadas: queda pendiente que Juan autorice guardar los doce archivos del manifiesto.
Codex revisa el índice, crea el commit local y genera
review-deliveries/increment-2a1-end-subscription/<hash-completo>/ con DELIVERY.md,
GIT_STATUS.md, changes.diff y files/ obtenidos del commit. Informe de Claude:
esa misma carpeta /REVISION.md. No sobrescribir informes ni entregas previos.
La entrega actual no se anuncia como fija por commit. La integración y publicación
requieren aprobación posterior de Dirección, tras revisión y validación.

### Evidencia adicional de las comprobaciones

La primera suite completa comenzó durante el trabajo y terminó con 924/928,
64 archivos aprobados y dos con fallos (224,91 s). No es evidencia del contenido
final: convivían una expectativa de mensaje antiguo y pruebas nuevas con módulos
previos cargados antes de las correcciones. Las dirigidas posteriores verificaron
los cuatro casos. Se lanzó otra suite completa después de estabilizar producto.

Una expectativa de AlexDemo seguía exigiendo el texto antiguo de ahorro de la pausa;
solo se actualizó esa expectativa a los cargos mostrados, sin cambiar producto.
AlexDemo final: 28/28 (27,75 s). El manifiesto incluye también
src/AlexDemo.test.tsx: son doce archivos propios en total. Los otros once se enumeran
arriba. Tras la suite final se reutilizan sus archivos aprobados y la reejecución
completa de AlexDemo, según la regla de no repetir por cambios de expectativas.

Lint y build finales: salida 0. JS 712,90 kB, gzip 199,01 kB; permanece aviso conocido
>500 kB. Logs propios fuera del commit en review-deliveries/2a1-*.log.

### Resultado final y estado Git

Suite completa sobre el producto final: 927 aprobadas y una expectativa antigua
fallida en AlexDemo, 66 archivos, 219,98 s. Esa única expectativa de texto se corrigió
y el archivo completo se repitió: 28/28. Cobertura final combinada: **928 pruebas
distintas aprobadas en 66 archivos**, en ejecuciones separadas; no se declara una
ejecución única de 928/928. Los otros 65 archivos de la suite se reutilizan porque
no cambió producto, entorno ni sus pruebas después de ella.

Lint y build finales correctos, audit no completado por red, diff --check correcto.
Índice vacío, doce archivos propios sin preparar (once seguidos y este documento
nuevo); sin commit/push/merge/despliegue. Estado comprobado directamente por Codex.
La revisión independiente y los diez recorridos manuales siguen pendientes.


## Autorización de entrega fija (5 de noviembre de 2026)

Dirección autoriza expresamente el commit local de los doce archivos y la entrega
fija por hash. Este apartado sustituye el pendiente de autorización anterior.
Se comprobó que los doce archivos coinciden byte a byte con la entrega local
anterior antes de añadir este registro documental y el de WORK_STATUS.
Se reutilizan las comprobaciones vigentes porque no cambian producto ni pruebas.
El hash final, manifiesto comprobado, estado posterior y ruta exacta para Claude
quedan en DELIVERY.md y GIT_STATUS.md de la nueva carpeta por commit, fuera de la app.
Pendientes: revisión independiente de Claude y validación manual de Dirección.
No se autoriza ni ejecuta integración en main, push ni despliegue.

## Correcciones dirigidas O1–O7 (5 de noviembre de 2026)

Este apartado sustituye las decisiones de presentación anteriores sobre diferencias
de estado entre detalle y All Bills, el texto Cancel para finalizar y Skipped months
antes del primer cargo. Base/HEAD comprobado por Codex:
4d23540fb5121628d4f88828a352a1df3a210047, rama codex/increment-2a1-end-subscription.
Índice vacío al iniciar y sin cambios versionados; archivos ajenos conservados.
Autorización: solo observaciones UX/compatibilidad, sin commit, main ni push nuevos.

Se leyó directamente el informe:
review-deliveries/increment-2a1-end-subscription/4d23540fb5121628d4f88828a352a1df3a210047/REVISION.md.
Veredicto comunicado por Dirección: Approved with observations. El informe declara
928/928 de Claude y lint/build propios de Claude; son resultados del informe sobre
la base, no ejecuciones atribuidas a Codex ni pruebas del contenido corregido.

### Resolución y criterio de estados

| Observación | Corrección |
| --- | --- |
| O1 | validityOn examina el último cargo realmente previsto de un plan finito, con los predicados existentes. Una anual marzo 2026–febrero 2027 ya es Ended en noviembre 2026. No se reescriben fechas ni payments heredados. End Subscription solo se ofrece si hay un cargo elegible para la simulación. |
| O2 | Keep Subscription en la vista de finalización. La simulación de pausa conserva Cancel. |
| O3 | Ahorro para 1 planned charge / N planned charges, sin these 1. |
| O4 | Detalle, etiquetas, filtros y conteos de All Bills reciben la misma fecha de hoy y llaman al mismo validityOn. El detalle muestra la fecha de referencia; el mes seleccionado solo cambia las obligaciones/importe que se consultan. |
| O5 | Mensaje: is ended in this app. No charges are planned from…; antes del primer cargo lo indica expresamente. |
| O6 | Se conserva canCancel=false y se indica Change this in Review Subscription. No se modifica la política de bloqueo. |
| O7 | Cancel de pausa devuelve el foco a su botón; Keep Subscription a End Subscription. El borrador se identifica Action: End Subscription. En el caso sin primer cargo se muestra una explicación de finalización y se oculta ese mes de Skipped months en ambas secciones, sin quitarlo del dato. Eliminadas líneas vacías residuales. |

Regla de presentación común, solo para Subscriptions:
- Upcoming: su mes inicial es posterior al mes actual, salvo un plan finito sin
  ningún cargo conservado, que ya es Ended.
- Con fin: localizar el último mes previsto con isBillDueIn, incluidas anualidad y
  omisiones. Si no hay ninguno, Ended. Si su fecha de vencimiento es hoy o anterior,
  Ended; de lo contrario Active/Upcoming según inicio. Se usa el vencimiento de hoy
  como límite, coherente con upcomingCharges, que no omite el cargo de hoy al finalizar.
- Sin fin: Active/Upcoming según inicio. Agotar los 24 meses del simulador no prueba
  Ended; no se deduce finalización de ausencia de resultados o payments.
- El pago anticipado no adelanta por sí mismo el estado: si el último cargo del plan
  finito vence en el futuro, sigue Active hasta ese vencimiento, incluso pagado.
  La confirmación y Last Month explican el corte guardado; la ausencia de cargos
  elegibles oculta la acción sin fingir que hay algo que confirmar.
- Ended describe que no quedan vencimientos futuros planificados; no significa
  que todos los vencidos se hayan pagado. Los pendientes de hoy/anteriores y los
  payments conservan su selección financiera y su historial.
- Los llamadores que solo pasan un mes conservan la semántica mensual inclusiva
  hasta el último mes previsto. Las dos vistas de suscripciones pasan hoy completo.
  Ingresos y facturas de otras categorías conservan su criterio mensual anterior.

No cambia ninguna regla financiera, esquema, migración, almacenamiento ni dato.
En bills.ts solo se acotan las firmas TypeScript para reutilizar los predicados
sin necesitar campos ajenos a las fechas; sus cuerpos permanecen idénticos.
applyCancel, subscriptionPlan, subscriptionPaymentConflicts, selección financiera,
reportes y guardas de incompatibilidad no se modifican en este seguimiento.

### Archivos de este seguimiento

Producto:
- src/domain/finance/bills.ts (solo tipos de parámetros).
- src/domain/finance/validity.ts.
- src/domain/finance/subscriptions.ts (consumidor del estado con fecha completa).
- src/features/bills/AllBills.tsx.
- src/features/bills/BillScreen.tsx.
- src/features/bills/SubscriptionSection.tsx.

Pruebas:
- src/domain/finance/validity.test.ts.
- src/features/bills/SubscriptionReview.test.tsx (nuevo).
- src/features/bills/PaymentIntegrity.test.tsx.
- src/BillsCalendar.test.tsx.
- src/AlexDemo.test.tsx.

Documentación:
- docs/USER_GUIDE.md.
- docs/WORK_STATUS.md.
- docs/INCREMENT_2A1.md.

### Comprobaciones del seguimiento

Regresiones nuevas antes de corregir: 11 fallos y 3 aprobadas en 14 casos.
Después se precisaron las expectativas de foco para comprobar el botón visible
recreado por React, no un elemento ya desmontado. Se añadió el caso de texto del
registro de cambios sin confirmar. Dirigida final: 41/41 en tres archivos, 5,87 s.
Incluye estados heredados mensuales/anuales, vencimiento actual, futuros, planes
fuera del horizonte de simulación, pagos históricos y restaurados intactos, igualdad
de detalle/All Bills con otro mes seleccionado, singular/plural, ambos retornos de
foco, preferencia bloqueada, borrador y confirmación incompatible previa.
No se presenta como teclado real ni como validación manual de Dirección.

Suite completa nueva justificada por el cambio del criterio compartido de
validityOn y de los filtros/conteos de All Bills. Resultados finales al terminar
en el apartado siguiente. No se repite audit: sin cambios de dependencias, permanece
la limitación ENOTFOUND de la ejecución anterior; no se declara audit limpio.

### Revisión dirigida y validación pendientes

No se ha ejecutado navegador, móvil, Safari/iPhone, VoiceOver ni PDF visual.
No hay validación manual nueva ni se amplían las confirmaciones de incrementos previos.
Los límites de simulación (24 meses) y la preferencia canCancel=false permanecen.
No se conoce cuántos datos reales presentan el caso heredado; solo fixtures ficticias.

Recorridos dirigidos propuestos, todavía pendientes:
1. Anual ficticia marzo 2026–febrero 2027, hoy noviembre 2026: Ended tanto en detalle
   como All Bills; sin End Subscription; payments y datos del plan intactos.
2. Mensual fin este mes: comparar ambas vistas antes, el día y después del último
   vencimiento. Cambiar el mes seleccionado no altera el estado general ni los pagos.
3. Inicio futuro: Upcoming y Starts…, tanto en detalle como en All Bills.
4. End Subscription anual: texto 1 planned charge; Keep Subscription no guarda y
   devuelve foco al botón correcto. Repetir con mensual: N planned charges.
5. Confirmar fin antes del primer cargo: mensaje explícito, sin Skipped months
   del mes omitido, sin cargo inventado. El backup conserva el dato original de omisión.
6. Review Subscription → pausa → Cancel: foco en What If I Pause It?.
7. canCancel=No: explicar dónde cambiarlo y conservar el bloqueo. Anticipo posterior
   al corte: impedir Confirm sin cambiar payment, History ni PDF.

El resultado queda sin preparar, pendiente de autorización de nuevo commit para
una entrega fija por hash. La entrega anterior y REVISION.md se conservan intactos.
Claude debe revisar O1–O7, el criterio temporal elegido y la evidencia de integridad;
no escribir sobre su informe anterior. Tras autorización de commit se generará una
carpeta nueva con REVISION.md propio, conforme a WORKFLOW. Sin integración ni push.

### Resultados finales propios de Codex — seguimiento O1–O7

- npm test -- --maxWorkers=2: **946/946**, 67/67 archivos, 221,52 s,
  una sola ejecución completa sobre el producto final de este seguimiento.
- Dirigida final: **41/41**, tres archivos, 5,87 s. La completa incluye estas
  regresiones y las de integridad de payments, History, almacenamiento y PDF.
- npm run lint: salida 0.
- npm run build: salida 0; JS 713,83 kB/gzip 199,30 kB, aviso conocido >500 kB.
- git diff --check: correcto. Índice vacío; HEAD sigue en 4d23540.
- Sin nueva ejecución de audit ni audit fix, porque no cambian dependencias:
  permanece el ENOTFOUND anterior, sin acreditación de audit limpio.
- Sin navegador ni nueva aceptación manual. Avisos conocidos de jsdom sin fallos.

Preparación local dirigida:
review-deliveries/increment-2a1-end-subscription/observations-working-2026-11-05/DELIVERY.md.
Incluye diff, copias y evidencia de los catorce archivos autorizados por el alcance
de correcciones. Es una copia revisable local del contenido sin preparar, no una
entrega fija por commit. SHA256.json identifica las copias; la entrega por hash y
el nuevo informe de Claude se prepararán tras autorizar el commit correspondiente.
No se sobrescribe la entrega fija anterior ni su REVISION.md.

## Cierre e integración autorizados de 2A.1 (5 de noviembre de 2026)

Dirección confirma aceptación manual y autoriza el commit final de los catorce
archivos, entrega fija, integración en main y push. Este apartado sustituye los
pendientes de aceptación y autorización anteriores; conserva sus límites históricos.
Codex comprobó que los catorce archivos coincidían byte a byte con las copias
Approved de Claude antes de añadir este registro y el de WORK_STATUS.md.
No cambia producto ni pruebas después de la revisión.

Confirmaciones manuales comunicadas expresamente por Dirección, no ejecutadas por Codex:
- End Subscription visible en Bill Details.
- Confirmación con ahorro estimado y advertencia sobre el proveedor.
- Keep Subscription conserva la suscripción sin cambios.
- Confirm End Subscription actualiza el estado a Ended.
- Los payments históricos permanecen visibles en History.
- Tras reiniciar la demo y repetir la finalización, no aparecen nuevos cargos de
  Music Streaming en enero de 2027.

No se atribuyen navegador, dispositivo, modo visual o lector no especificados.
No se amplían estas confirmaciones a PDF visual, anual heredada, dos pestañas
reales, móvil/teclado/VoiceOver u otros recorridos no confirmados expresamente.
Dirección acepta el cierre con la revisión independiente Approved y estas pruebas.

Observaciones menores conservadas, sin declarar resueltas:
- N1: redacción de la ayuda Status as of… puede naturalizarse.
- N2: is ended in this app puede naturalizarse.
- N3: Active sin End Subscription cuando no hay cargos elegibles, por anticipos
  o límite del horizonte; decisión/limitación documentada. Edit Details sigue
  disponible; no se cambian payments ni se inventan cargos para habilitar la acción.
- Aviso conocido de bundle >500 kB; audit sin completar por ENOTFOUND.
No se introducen correcciones nuevas para estas notas durante el cierre.

Se reutilizan las comprobaciones vigentes del mismo código/entorno:
Codex 946/946 en 67 archivos (221,52 s), lint/build correctos y diff sin errores;
Claude declara 215/215 dirigidas y lint/build, atribuidos a su informe.
No se repite suite por registros documentales ni se atribuyen pruebas de UX-01.

Manifiesto: los catorce archivos del apartado Correcciones dirigidas O1–O7.
Se excluyen UX_01_TECHNICAL_EVALUATION.md, UX_01_IMPLEMENTATION.md,
review-deliveries y todos los archivos ajenos. No se implementa UX-01 en este commit.
La entrega fija nueva documentará hash completo, diff/copies desde commit, pruebas,
aceptación, notas residuales y estado Git. El informe original de Claude no se edita.

El resultado de commit, integración/push y sincronización se registra fuera del
commit en review-deliveries/increment-2a1-end-subscription/<hash-final>/DELIVERY.md
y GIT_STATUS.md. El push activa Cloudflare Pages; publicación no comprobada por
Codex hasta que se verifique expresamente. No confundir push con sitio publicado.
Tras integrar, se prepara codex/ux-01-navigation desde el nuevo main para UX-01 A.
