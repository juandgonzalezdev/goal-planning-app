# Incremento 2A: Bills

Alcance: creación compacta de facturas y edición compatible de detalles. Sin cambios
de esquema, fórmulas, intereses, Home, navegación global ni relaciones entre préstamos y Bills.
Base integrada: 48f6aea44de1c6fb0448d12b5dbe5178cf353fb4.
Base del ajuste de frecuencia: e71781f7f155ec2bb0e0444933f23d4878a93d40.
Rama: codex/increment-2a-bills.

## Aceptación vigente para preparar el cierre (5 de noviembre de 2026)

Dirección confirma la validación manual de los recorridos principales y autoriza
preparar el cierre exclusivo de Bills 2A. Esta sección sustituye los estados de
pendiente de las secciones históricas inferiores; sus guiones siguen siendo una
referencia de cobertura, no una declaración de que se haya ejecutado cada subpaso.

Resultados satisfactorios comunicados expresamente por Dirección, no ejecutados
por Codex:

- Creación y edición de facturas mensuales, anuales y de un solo mes.
- Manejo de importes desconocidos.
- Registro de payments y visualización en History.
- Paid → Pending → Paid sin duplicados.
- Protección de payments históricos al modificar fechas.
- Cancelación de suscripciones conservando payments anteriores, sin obligaciones
  nuevas después de cancelar.
- Advertencia de Delete Bill y conservación de datos al cancelar la eliminación.
- Exportación y revisión de informes PDF mensuales y anuales.
- Navegación móvil en Safari/iPhone y visualización en modo oscuro.
- Navegación mediante teclado y lectura/activación de controles con VoiceOver.

No se extiende esta confirmación a Chrome a 390 px, a todos los temas por recorrido,
a concurrencia real entre pestañas, al Delete confirmado ni a cada detalle del guion
anterior. Esos casos conservan su cobertura automática donde exista; no se declaran
manualmente aprobados. Dirección considera suficiente la validación principal para
preparar el cierre. El texto nuevo O1 tiene validación automática, no manual nueva.

Claude: Approved with observations, sin bloqueantes, según
`review-deliveries/bills-2a-payment-integrity/REVISION-FOLLOWUP.md`, leído por Codex.
O1 corregida; O2/O3 y dirección futura de producto quedan registradas en
[BILLS_2A_CLOSURE.md](BILLS_2A_CLOSURE.md). Recomendación: **Ready to merge**,
aprobado por Dirección para commit, merge y push el 5 de noviembre de 2026.
El resultado de integración se registra en la entrega fija bills-2a-closure;
la publicación automática requiere comprobación separada del push.

## Corrección de integridad histórica autorizada (5 de noviembre de 2026)

Dirección amplía 2A exclusivamente para corregir la omisión de payments por fechas,
pausas y cancelación con anticipos. Base: `4ba3c0a991500d6f7f586bd3567916cd0632f4fb`.
`billsForMonth` une previsión y payments registrados sin duplicar; History, cálculos,
flujos y PDF conservan registros heredados fuera del plan. Planned Bills sigue
siendo inclusivo (pagadas o no). No se cambian esquema, almacenamiento ni fórmulas.
Editar fechas o aplicar pausa/cancelación incompatible se rechaza con explicación.
Delete conserva su acción separada y ahora informa el número de payments y usa
la revisión de apertura de su confirmación. No se inicia Manage Subscription,
Pause/Resume completo ni navegación. Detalle y evidencia:
[PAYMENT_INTEGRITY_FIX.md](audits/PAYMENT_INTEGRITY_FIX.md).

Validación manual nueva pendiente (datos ficticios):

1. Registrar por adelantado un payment de abril, con fecha de hoy. Intentar End month
   anterior y cancelación antes del próximo cargo: error claro, sin guardar cambios;
   History, importe, fecha, cuenta e informes se conservan. Fin compatible sí guarda.
2. Restaurar una copia ficticia con ese payment después del fin o dentro de pausedMonths:
   aparece una sola vez en History y detalle, con aviso; Spent/PDF conservan el importe,
   sin convertirlo en Left to Pay. Probar con importes visibles y ocultos.
3. Delete Bill muestra el número de payments, incluidos los fuera del plan. Cancel
   conserva todo; confirmar elimina únicamente esa factura y sus registros. Con
   otra pestaña guardando antes, no borra la versión nueva.
4. Datos restaurados con abril pagado y pausado: cambiar el fin a diciembre guarda
   correctamente; abril sigue una sola vez en History/totales/PDF. Si junio también
   está pagado y no pausado, un fin en mayo se bloquea por junio, no por abril.
5. Mark as Not Paid en ese payment fuera del calendario, desde detalle y lista:
   muestra explicación y Keep as Paid, sin ejecutar la operación. El payment y sus
   datos siguen accesibles. En un mes previsto, la confirmación habitual funciona.
6. Cambiar inicio y fin juntos con un fin anterior al payment: error/foco en End
   month y mensaje con mes pagado. Delete sin payments no dice “0 payments”.

Estas pruebas no están confirmadas por Juan. Se mantienen todos los pendientes
del guion general y la revisión de Claude antes del cierre.

## Comportamiento vigente

- Add Bill muestra Bill name, Amount, Amount not known yet justo debajo, Due day
  y un selector Frequency con Every month, Every year y One month only.
  Every month es el valor inicial. No existen casillas Repeat every month ni Yearly.
- El inicio de una factura nueva es el mes seleccionado al abrirla, también desde
  Home y el calendario. Para otro inicio se selecciona primero ese mes.
- Every month usa la frecuencia mensual actual; Every year usa yearly. One month only
  usa una factura mensual con endMonth = startMonth inclusivos. No hay datos nuevos
  ni migración. No se crean ocurrencias anteriores al mes elegido.
- El resumen de recurrencia se actualiza con la elección, el día y las fechas.
  Está junto a Frequency, antes de More, con aria-live polite y atomic. Frequency
  lo referencia mediante aria-describedby. La región permanece montada.
- More details empieza cerrado. Tiene Category (Other por defecto), End month cuando
  se repite, Note y vínculo a card/loan. No contiene Frequency ni una casilla Yearly.
  Elegir One month only oculta End month y omite Ends del resumen de More.
  Volver a mensual o anual recupera el fin avanzado del borrador, si se había elegido.
- More mantiene el nombre accesible More details y su resumen gris como descripción
  separada. Resume categoría, fin, vínculo y presencia de nota. Al editar puede
  indicar Yearly como dato de la factura, sin añadir un control para cambiarlo.
- Edit Details conserva frecuencia original, inicio, fin, pausas, importes y payments
  al guardar otros detalles, incluso desde otro mes. Incluye facturas antiguas con
  frecuencia mensual implícita (propiedad ausente), mensual explícita, anual y de un mes.
  Frequency es un selector de creación; no se añade a la edición ni se convierte
  automáticamente ninguna factura existente. Start month y End month siguen en More.
  Para volver a repetir una factura de un mes al editar, se elige No end month.
  La ayuda de Start month sigue indicando Existing billing periods are kept when you
  save details. Los importes mantienen sus acciones separadas por mes o desde un mes.
- Amount not known yet es una casilla única del formulario principal. Sin marcar:
  ninguna ayuda bajo el importe o la casilla. Marcada: campo vacío y deshabilitado
  con una sola ayuda, Unknown amount — shown as Unknown, never as 0. Uncheck to enter
  an amount. Campo y casilla describen la misma ayuda solo mientras existe.
  Al desmarcar se recupera el importe escrito y se puede editar. Desconocido se guarda
  como null, nunca como cero. El cero introducido explícitamente sigue siendo válido.
- Save crea una factura, con bloqueo de doble envío. Cancel descarta explícitamente;
  Back pregunta antes de perder cambios, incluido cambiar solo Frequency.
- Las suscripciones mantienen sus acciones separadas. Cancelar antes del primer
  cargo conserva el límite inclusivo y omite ese cargo mediante pausedMonths existente.
  Subscription y Details muestran Skipped months sin inventar el origen de esa omisión.

## Evidencia automática

BillsCalendar.test.tsx cubre las tres elecciones en el formulario principal y su
guardado desde December 2026: mensual aparece en January 2027, anual en December 2027,
de un mes solo en December 2026. Ninguna aparece en November 2026. También comprueba
End month al alternar opciones, resumen accesible, Back, doble envío, importe desconocido,
cero explícito, errores y ausencia de las casillas de frecuencia anteriores.

features/bills/BillForm.test.tsx edita desde otro mes cinco variantes existentes:
mensual implícita, mensual explícita, anual, de un mes y anual limitada a un mes.
Compara todos los datos salvo la nota que se cambia: frecuencia, fechas, pausas, cambios
de importe, debts, vínculo y billMonths intactos; History y resúmenes mensuales iguales.

domain/finance/singleMonthBills.test.ts conserva la cobertura de Calendar/totales, All Bills,
Coming up, suscripciones, anuales, History y PDF. Ninguna prueba DOM acredita lectura
real de VoiceOver o compatibilidad visual en Safari. Los resultados exactos están en
WORK_STATUS.md y en la entrega fija correspondiente.

## Aceptación manual de la versión con Frequency (pendiente)

Usar datos ficticios. Chrome a 390 px y Safari/iPhone real, en claro y oscuro. Registrar
únicamente recorridos efectivamente realizados y su navegador/dispositivo. Las pruebas
confirmadas antes del nuevo selector se conservan abajo y no se extienden a este control.

1. **Formulario y selector:** Add Bill muestra los campos principales y un solo selector
   Frequency con Every month, Every year y One month only, en ese orden. More está cerrado.
   Seleccionar cada opción: el resumen cambia a Monthly, Once a year o One month only.
   Abrir More: no hay casillas Repeat every month o Yearly, ni otro selector Frequency.
2. **Mensual y mes único:** seleccionar December 2026, crear Test monthly de 20, día 5.
   Está en diciembre y enero, nunca en noviembre. Crear Test once de 75, día 31,
   eligiendo One month only: aparece solo en diciembre. Probar February 2028: día 31
   vence el 29. All Bills conserva sus fechas. Repetir alta desde Home y día del calendario.
3. **Anual y fin avanzado:** crear Test yearly con Every year desde December 2026.
   Aparece en diciembre de 2026 y 2027, no en enero de 2027. Elegir End month avanzado,
   alternar mensual/anual/mes único y comprobar resumen y fecha recuperada al volver a
   repetir. Guardar One month only con fin previo en el borrador: dura solo el mes elegido.
   More no anuncia Ends para el alta de un mes; sí para recurrentes con fin y al editar.
4. **Importe y O1:** sin marcar Amount not known yet no hay ayuda. Escribir 45, marcar:
   única ayuda, campo deshabilitado. Desmarcar: vuelve 45 y se puede editar. Guardar con
   casilla marcada: Unknown, no cero; recargar mantiene ese valor. Sin importe y sin
   marcar: el error menciona la casilla y enfoca Amount. Guardar 0 explícito: muestra cero.
5. **Borradores y acciones:** cambiar solo Frequency y pulsar Back: Keep Editing conserva
   la elección; Discard and Leave sale. Cancel no guarda. Repetir con nota e importe.
   Doble toque o Enter al guardar: solo una factura. Cancel vuelve al origen de Home/calendario.
6. **Edición e History:** registrar un payment ficticio con importe, fecha y cuenta.
   Abrir Edit Details desde otro mes: More cerrado, no hay selector nuevo que cambie
   frecuencia y se mantienen las fechas. Cambiar solo Note y guardar: payment, History y
   totales iguales. Repetir con anual y factura vinculada a préstamo: vínculo y Remaining
   Balance conservados. Start month tiene la ayuda de conservación de períodos.
   En una factura única, cambiar End month a No end month: resumen coherente y se repite.
7. **Coming up:** cargo de mes único dentro de los próximos siete días del siguiente mes:
   aparece solo en ese intervalo, separado de Left to Pay, sin nueva ocurrencia después.
8. **Suscripciones:** simulación sin confirmar, Cancel, pausa confirmada y cancelación
   anterior al primer cargo. No vuelve el cargo cancelado; pausas y cancelación muestran
   Skipped months. Los payments previos se conservan. Mensaje is cancelled from coherente.
9. **PDF:** informes del mes anterior, del cargo y del posterior, con y sin importes.
   La factura pendiente de mes único está solo en el del cargo. Cambiar un importe habitual
   desde un mes posterior no modifica períodos anteriores.
10. **Teclado, móvil y lector (H7):** Tab: Bill name → Amount → Amount not known yet →
    Due day → Frequency → More details → Save → Cancel (Back antes del formulario).
    El campo Amount deshabilitado se omite. Verificar selección nativa con teclado, foco
    visible, Enter sin duplicados y el orden de campos extra al abrir More. En iPhone,
    teclado numérico sin tapar Frequency/Save ni desbordamiento; probar gesto de atrás.
    VoiceOver: Frequency anuncia su opción y el resumen actualizado de manera completa;
    More conserva nombre estable y resumen como descripción, collapsed/expanded y ayuda
    de Start month. La casilla desconocida y Amount comparten una sola ayuda al marcar.

Este guion actualiza H1–H7, N1–N3 y O1 a la nueva interfaz. La validación previa y la
aprobación de Claude de e71781f siguen teniendo su alcance original. No se cierra ni
integra 2A hasta completar la validación acordada y la revisión de este ajuste.

## Trazabilidad de confirmaciones anteriores

El registro siguiente se conserva literalmente. Sus referencias al guion anterior
describen e71781f, no acreditan la nueva versión de Frequency.

## Confirmaciones registradas para el cierre (5 de noviembre de 2026)

Pruebas manuales confirmadas expresamente por Juan, con resultado satisfactorio:

- Creación de una factura mensual.
- Recurrencia de December 2026 a January 2027 en ordenador y teléfono.
- Creación y edición de una factura de un solo mes.
- Cambio de una factura única a recurrente.
- Cancelación de una edición sin guardar cambios.
- Facturas con importe desconocido.
- Funcionamiento de la corrección final O1.

Son resultados comunicados por Juan, no recorridos ejecutados por Codex. Solo la
recurrencia tiene confirmación explícita en ordenador y teléfono. No se atribuyen
navegadores concretos, anchuras, dispositivos específicos, temas ni lector a ninguna
prueba porque no se han indicado.

Pendientes de confirmación expresa:

- Recorrido completo de History y conservación de payments, cuenta, fecha y totales.
- Suscripciones: simulación, pausa, cancelación anterior al primer cargo y Skipped months.
- PDF del mes anterior, del mes de cargo y del posterior, con y sin importes.
- Teclado real: Tab, Espacio, Enter, foco y accesibilidad con teclado numérico móvil.
- VoiceOver: nombres, descripciones y anuncios de los resúmenes y ayudas.
- Comprobaciones específicas en ambos temas visuales y cobertura identificada en
  Chrome a 390 px y Safari/iPhone. Ordenador/teléfono no acreditan esos navegadores.
- Cualquier otro paso del guion no comprendido expresamente en la lista confirmada,
  como Coming up, anuales y fines, doble guardado, recarga y vínculos con préstamos.

Codex leyó el informe de Claude en
review-deliveries/increment-2a-bills/e71781f7f155ec2bb0e0444933f23d4878a93d40/REVISION.md:
aprobado sin hallazgos nuevos ni correcciones pendientes, por inspección. La aprobación
no acredita las pruebas manuales pendientes ni una ejecución de pruebas por Claude.

Juan indica mantener pendientes los recorridos restantes y continuar la validación
antes de integrar. El Incremento 2A no se da por cerrado. No se integra ni se hace push.
