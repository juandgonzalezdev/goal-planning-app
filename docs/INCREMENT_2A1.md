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
