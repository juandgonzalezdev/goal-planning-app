# Incremento 2A: Bills

Alcance: creación compacta de facturas y edición de detalles. Sin cambios de esquema,
fórmulas, intereses, Home, navegación global ni relaciones entre préstamos y Bills.
Base comprobada: 48f6aea44de1c6fb0448d12b5dbe5178cf353fb4.
Rama: codex/increment-2a-bills.

## Comportamiento

- Add Bill muestra Bill name, Amount, Due day y Repeat every month (marcado por defecto).
- El primer mes es el seleccionado al abrir el formulario, también desde Home y el calendario.
  No se permite introducir otra fecha inicial al crear: para otro mes se selecciona ese mes antes.
- Sin repetición: endMonth = startMonth, ambos inclusivos. No hay ocurrencias anteriores ni posteriores.
- More details empieza cerrado. Conserva Other como categoría interna por defecto;
  permite categoría, importe desconocido, Yearly, último mes cuando hay repetición, nota y vínculo.
  Yearly y Repeat every month son opciones excluyentes; al quitar Yearly se vuelve a mensual.
  La elección anual se explica junto a Repeat y en el resumen de More details.
- Edit Details conserva frecuencia, meses, pausas, importes y payments existentes al guardar
  otros detalles. Los controles avanzados de fechas y vínculo siguen disponibles.
  El resumen de recurrencia se recalcula con las fechas del borrador; para volver a repetir
  una factura de un mes, se elige No end month.
  Los importes conservan sus acciones separadas por mes o desde un mes explícito.
- Save crea una factura. El bloqueo de guardado evita duplicados por doble envío.
  Cancel descarta explícitamente; Back conserva la protección de cambios sin guardar.
- La cancelación de una suscripción anterior al primer cargo usa el mes inicial como último
  mes y lo pausa. Así no conserva accidentalmente un cargo por el límite inclusivo.
  Las fechas omitidas se muestran como Skipped months, tanto para pausas como para
  esa cancelación: el modelo no guarda qué acción originó cada mes omitido.
- El error de importe vacío indica cómo llegar a More details. Si se elige importe desconocido,
  Amount explica su estado incluso al cerrar More. El resumen de recurrencia queda junto
  a Repeat, antes de More, con aria-live polite. More resume categoría, frecuencia anual,
  importe desconocido, último mes, vínculo y presencia de nota sin abrirlo.

## Evidencia automática

src/domain/finance/singleMonthBills.test.ts cubre los consumidores compartidos del calendario,
All Bills (validez), Coming up, suscripciones (proyección, pausa y cancelación), anuales,
History, PDF y totales mensuales. Comprueba que un payment de 120,00 con fecha 3 de noviembre
permanece idéntico después de editar una nota, así como su entrada de History y sus totales.
Añadir una factura ajena conserva las facturas previas, deudas, vínculos, billMonths e History.
BillsCalendar.test.tsx cubre creación sin categoría explícita, mes único, Yearly, edición,
regreso al calendario, errores, importe desconocido, guardado doble y Back con solo recurrencia cambiada.
Los resultados exactos y las limitaciones se registran en WORK_STATUS.md y la entrega.

## Prueba manual pendiente: Chrome y Safari/iPhone

Usar solo datos ficticios y un espacio de prueba. Repetir en Chrome a 390 px y Safari en
un iPhone real, en modo claro y oscuro. No usar datos personales para capturas o informes.

1. Seleccionar February 2028 en Bills. Add Bill: solo los cuatro controles principales y
   More details cerrado. Escribir Test repair, 75 y día 31; desmarcar Repeat every month.
   El resumen indica solo February 2028. Save: una factura el 29 de febrero.
   January y March no la muestran. All Bills conserva su fila y sus fechas.
2. Seleccionar un mes futuro y crear Test monthly, 20, día 5, sin abrir More details.
   Aparece desde ese mes y en el siguiente, nunca en el anterior. Category queda Other.
   Probar también Add Bill desde Home y desde un día del calendario; Cancel vuelve al origen.
3. Abrir More details: Category, Yearly, End month cuando corresponda, Note,
   Amount not known yet y vínculo. Crear Test yearly: el resumen dice Once a year;
   aparece en el mes inicial y su aniversario, no en meses intermedios.
   Probar un último mes y comprobar que no aparece después. Un importe desconocido
   se muestra como desconocido y nunca como cero.
4. Cambiar solo Repeat every month y pulsar Back: aparece Leave without saving?.
   Keep Editing mantiene la elección; Discard and Leave sale. Repetir con nota y nombre.
   Cancel descarta sin guardar. Hacer doble toque en Save: solo se crea una factura.
5. En la factura de un mes, registrar un payment ficticio con su fecha y cuenta.
   Volver a abrir Edit Details desde otro mes: More details cerrado y fechas originales.
   Cambiar únicamente Note y guardar. El payment, History y los totales del mes original
   siguen iguales; no se crea otro cargo. Comprobar también una factura anual y una
   vinculada a préstamo: frecuencia, fechas, vínculo y Remaining Balance conservados.
6. Para Coming up, usar un espacio ficticio con un cargo de mes único dentro de los
   próximos siete días del mes siguiente; aparece solo en ese intervalo y separado
   de Left to Pay. Después del mes de cargo no hay otra ocurrencia.
7. Categoría Subscriptions: probar simulación, Cancel sin confirmar y pausa confirmada.
   Cancelar antes del primer cargo: el cargo deja de estar pendiente y no reaparece al
   mes siguiente. Una suscripción ya pagada conserva su payment e History.
8. Reports & Backup: PDF del mes de cargo incluye la factura pendiente; los meses
   anterior y posterior no. Comprobar con y sin importes. Editar el importe habitual
   desde un mes posterior de una factura mensual: períodos previos siguen iguales.
9. En iPhone, abrir teclado en Amount y Due day, desplegar More details y acceder a
   Save/Cancel sin desbordamiento ni controles tapados. Probar gesto de atrás con cambios.
   Con VoiceOver, verificar etiquetas y collapsed/expanded de More details.

Estas instrucciones no acreditan ejecución manual. Juan debe confirmar cada recorrido
realizado; las confirmaciones del Incremento 1 no se extienden al 2A.


## Aceptación adicional tras la revisión H1–H7 (pendiente)

Repetir en Chrome a 390 px y Safari/iPhone real, claro y oscuro. Estos recorridos
no se consideran confirmados por las pruebas automáticas ni por la revisión de Claude.

1. **H1:** Add Bill con nombre y día, sin importe → Save. El error dice
   “Enter the amount. Not known yet? Open More details.” y el foco sigue en Amount.
   Abrir More, marcar Amount not known yet y cerrarlo: Amount queda deshabilitado,
   con “Not known yet. Change this in More details.” visible. No parece cero ni un fallo.
2. **H2:** Editar Test repair de un mes → More details. Se explica
   “To repeat it, choose No end month.”. Cambiar End month a No end month:
   la frase pasa a mensual y desaparece esa pista. Volver al mes inicial:
   la frase dice One month only. No hay ayudas de frecuencia contradictorias.
3. **H3:** Con More abierto, tocar Repeat: la frase queda inmediatamente junto al
   control y cambia sin tener que buscarla al pie de los campos avanzados. Con VoiceOver,
   comprobar que se anuncia el cambio completo una vez, con el mes y el día correctos.
   Verificar también el anuncio al cambiar End month durante la edición.
4. **H4:** Editar una factura ficticia vinculada a un préstamo y con fecha final.
   More cerrado muestra Category, Pays y Ends. Cambiar categoría o nota y cerrarlo:
   el resumen se actualiza sin revelar el texto de la nota. El vínculo sigue intacto.
5. **H5:** Marcar Yearly y cerrar More: aparecen “Yearly is on (More details).”,
   Yearly en el resumen de More y la frase anual. Repeat queda desmarcado, pero no
   se interpreta como un único mes. Al quitar Yearly, Repeat vuelve a mensual;
   la ayuda de Yearly explica ese efecto. Elegir Repeat también permite volver a mensual.
6. **H6:** Cancelar una suscripción ficticia de un mes antes del primer cargo.
   El mensaje dice “is cancelled from …”; Subscription y Details muestran
   Skipped months con el mes correcto, no Paused ni una afirmación deducida de Cancelled.
   Una pausa normal usa también Skipped months; sus fechas y próximos cargos siguen iguales.
7. **H7, teclado de escritorio:** con More cerrado, Tab recorre Bill name → Amount →
   Due day → Repeat → More details → Save → Cancel, además de Back antes del formulario.
   Espacio cambia casillas; Enter desde un campo crea una sola factura; foco visible
   en Repeat y More. Con More abierto, los controles adicionales entran en el orden visual.
8. **H7, móvil y lector:** con teclado numérico en Due day y Amount, valorar si el
   formulario apilado cabe y permite alcanzar Repeat y Save sin controles tapados ni
   desbordamiento. No se ha cambiado a dos columnas sin evidencia visual. Verificar
   collapsed/expanded de More y que el lector puede abrirlo aunque su contenido no está
   montado al cerrarlo (aria-controls conserva el comportamiento existente). Confirmar
   que Save resulta inequívoco bajo el título Add Bill. Probar gesto de atrás.
