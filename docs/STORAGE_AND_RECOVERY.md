# Guardado, otras pestañas y recuperación

Cómo guarda la app el espacio propio, qué hace cuando otra pestaña lo cambia y
cómo se recupera lo que no se puede abrir. También explica qué separa la demo
del espacio propio. Las reglas financieras están en
[FINANCIAL_RULES.md](FINANCIAL_RULES.md), y los archivos en
[PROJECT_MAP.md](PROJECT_MAP.md).

**Lo que no hay todavía:** cuentas, servidor, sincronización entre
dispositivos ni cifrado. Todo se guarda solo en este navegador y **sin
cifrar**. Cualquiera que pueda usar el navegador puede verlo. La app no envía
nada a ningún sitio y no tiene registros (logs), analítica ni informes de
errores.

## 1. Dónde se guarda

| Qué | Dónde | Notas |
| --- | --- | --- |
| El espacio propio (registros y apariencia) | Base de datos IndexedDB `goal-planning-app`, almacén `spaces` | Un sobre por espacio: `{ format, revision, savedAt, data }`. `data` es el `FinanceData` de siempre, sin la revisión, así que una copia de seguridad sigue siendo `FinanceData` |
| Qué espacio abre este dispositivo | Almacén `meta`: `current-space`, `legacy` y `last-revision` | `legacy` vale `migrated` o `erased` cuando la copia antigua ya se trató. `last-revision` sobrevive a Erase para que un espacio nuevo siga contando desde ahí |
| Espacios ilegibles apartados por Use Older Copy | Almacén `quarantine` | Cada uno con su propia clave. Nunca se borran ni se sobrescriben |
| La copia antigua (versiones anteriores de la app) | `localStorage`, clave `goal-planning-app.my-space` | Solo se lee y nunca se cambia, salvo con Erase |
| La marca de borrado | `localStorage`, clave `goal-planning-app.erased` | Mientras existe, la copia antigua no se vuelve a abrir |
| Preferencias de pantalla del espacio propio | `localStorage`: `goal-planning-app.hidden-amounts`, `.bills-chart`, `.emergency-later` y `.home-layout` (este último ligado al id del espacio) | Son de este dispositivo, no del espacio, y no van en la copia de seguridad |
| La demo | Solo en memoria | Nunca se guarda (sección 7) |

Los espacios nuevos reciben un id aleatorio (`newId`). Los creados antes
conservan `my-space`.

## 2. Migración desde la copia antigua

La primera vez que se abre esta versión, si la base de datos está vacía y hay
una copia antigua legible:

1. Se copia a `spaces` con la revisión 1, solo si ninguna otra pestaña lo ha
   hecho ya.
2. Se lee de nuevo y se compara con la copia antigua. Si no coinciden, la app
   no la usa y lo muestra como problema (`copies-differ`).
3. Solo entonces pasa a ser el espacio actual (`current-space`) y `legacy`
   queda en `migrated`.

Cada paso es una transacción que comprueba que nada cambió entretanto. La copia
antigua se deja tal cual y no se vuelve a importar. Un cambio en el formato
de los registros sigue necesitando una migración en `data/migrations.ts`
(`schemaVersion` 3 hoy). Es independiente del formato del sobre.

## 3. Guardado asíncrono

- **Apertura:** al arrancar, la app dice que está abriendo el espacio y nunca
  muestra Welcome antes de tener la respuesta. Si tarda más de lo normal,
  ofrece Try Again.
- **Revisiones:** cada guardado indica la revisión sobre la que se hizo. La
  base de datos compara y escribe en una sola transacción. Si otra pestaña
  guardó antes, el cambio se rechaza (`conflict`) y no se escribe nada. Nunca
  se guarda a medias.
- **Un cambio cada vez:** mientras se guarda uno, los demás se rechazan
  (`busy`) en `useSpace`, no solo en los botones. Los controles que cambian
  datos quedan `aria-disabled` y se lee «Saving…».
- **Lo que se ve está guardado:** un cambio aparece en pantalla solo cuando la
  base de datos lo confirma. Si falla, el formulario conserva lo escrito.
- **Sesiones:** cada apertura del espacio es una sesión. Una respuesta que
  llega después de salir, borrar o abrir la demo se ignora (`stale`). Ignorarla
  no cancela la escritura: es la revisión la que impide que caiga en otro
  espacio.
- **Formularios empezados antes de una recarga:** guardan la revisión en la que
  empezaron. Si el espacio se abrió de nuevo con cambios más recientes, se
  rechazan (`outdated`) en lugar de escribir encima.

Los textos de cada resultado están en `ui/saveOutcome.ts`: «Saved on this
device.», «Demo only: not saved.», «Not saved: this space changed in another
tab…», etc.

## 4. Otras pestañas

Cada pestaña recibe los avisos de las demás por `BroadcastChannel`. Al volver a
la pestaña (`visibilitychange` y `pageshow`) también comprueba si algo cambió,
por si se perdió un aviso, como en el iPhone en segundo plano. Un aviso solo
hace que la pestaña vuelva a leer: la seguridad depende de las revisiones, no
de los avisos.

| Qué hizo la otra pestaña | Sin nada escrito aquí | Con algo escrito aquí |
| --- | --- | --- |
| Guardó un cambio | Se actualiza sola, en la misma pantalla, mes, vistas, foco y posición, con «Updated with changes from another tab.». Si el registro abierto desapareció, lo explica sin mostrar datos | No sustituye nada. Avisa del conflicto, bloquea los guardados y ofrece Copy What I Typed y **Open Latest Version**, que pregunta antes de descartar |
| Borró el espacio | Va a Welcome con «Your space was erased in another tab.» | Bloquea todo guardado y mantiene la pantalla hasta **Discard and Close**, que pregunta antes |
| Una versión antigua de la app guarda en la copia antigua | Aviso con OK. No se hace nada automáticamente | Igual |
| Una versión más nueva de la app tomó la base de datos | Solo lectura (`takenOver`): solo ayuda recargar | Lo escrito sigue en pantalla para copiarlo |

Si llega un aviso mientras se guarda algo, la app espera la respuesta de ese
guardado. Nunca lo cancela. Antes de mostrar lo leído vuelve a comprobar la
sesión, el espacio, la revisión, que no haya otra escritura y que no haya nada
escrito. Nunca vuelve a una revisión anterior.

Los avisos aparecen arriba, en el flujo normal de la página, no fijos
(decisión de producto), y se anuncian con `role="alert"`.

## 5. Formularios con cambios sin guardar

- Cada formulario que guarda datos se registra con `useUnsavedChanges`
  (`app/unsavedChanges.ts`). El borrador de New Goal cuenta aunque su pantalla
  esté cerrada.
- **Copy What I Typed** copia todos los campos con contenido de cada formulario.
  Si el navegador no deja copiar (por ejemplo en `http://` de la red local),
  muestra el texto en un recuadro de solo lectura ya seleccionado. También
  existe **Show What I Typed**. Lo escrito no se guarda, no se envía y no se
  registra.
- Mientras no se puede guardar, un formulario que se cierra sigue en la lista
  como «(closed)» hasta descartarlo.
- Descartar siempre pide confirmación: Discard and Open Latest Version,
  Discard and Try Again, Discard and Close, Discard and Open Demo y Discard and
  Exit Demo.
- **Límite conocido:** salir de un formulario con la barra de pestañas descarta
  lo escrito sin preguntar, salvo New Goal y Welcome Setup, que conservan su
  borrador. Ver [STATUS.md](STATUS.md).

## 6. Problemas al abrir y recuperación

| Situación | Qué ve el usuario |
| --- | --- |
| Lo guardado no se puede abrir: dañado (`broken`), falta el espacio (`missing`), copias distintas (`copies-differ`) | Pantalla **Your Saved Information**. Nunca ofrece crear un espacio. Ofrece Download Both Copies, Use Older Copy (si la copia antigua se puede leer) y Erase Saved Information, cada uno con confirmación, más Try Again |
| Guardado por una versión más nueva de la app (`newer-version`) | La misma pantalla, solo con Download Both Copies y Try Again. Nunca se sustituye ni se borra |
| El navegador no puede guardar con seguridad (sin IndexedDB, o falló a mitad) | **Solo lectura**: se puede mirar todo, Download Backup, Download Both Copies y Try Again. Si se muestra la copia antigua, se dice que puede estar desactualizada. Ningún control llega a guardar. Sin copia que mostrar, Welcome lo dice y no deja empezar un espacio |
| Erase no pudo quitar la copia antigua | Welcome dice «Erase is not finished…». Esa copia no se vuelve a abrir |

**Use Older Copy** aparta el espacio ilegible en `quarantine` (no lo borra) y
abre la copia antigua. **Erase** borra el espacio, apunta su última revisión y
después quita la copia antigua.

## 7. Download Backup y Download Both Copies

| | Download Backup | Download Both Copies |
| --- | --- | --- |
| Dónde | Data → Data Backup, siempre (también en la demo) | Pantalla de recuperación, y en Data cuando el espacio es de solo lectura |
| Qué contiene | El espacio abierto, validado, en el formato de intercambio | Todas las copias del dispositivo **tal como están guardadas**: el espacio actual (aunque esté dañado), todos los espacios, la cuarentena, las marcas y la copia antigua como texto |
| Para qué | Guardar y restaurar con **Restore Backup** | Rescatar información antes de Use Older Copy o Erase |
| Restore Backup | Lo lee, lo comprueba y pide confirmación antes de reemplazar | Lo rechaza: «This is a recovery file, not a backup…» |
| ¿Cambia algo al descargar? | No | No: se lee en una transacción de solo lectura |
| Nombre | `goal-planning-backup.json` | `goal-planning-recovery-AAAA-MM-DD.json` |

Los dos archivos llevan los datos financieros **sin cifrar**. El informe PDF
(Export Report) no es una copia de seguridad.

## 8. La demo y el espacio propio

La demo de Alex vive solo en memoria. Abrirla, usarla, reiniciarla o salir de
ella no lee ni escribe el espacio propio (`useSpace` no escribe en el almacén
con la demo abierta).

- **Entradas:** desde Welcome o la pantalla de recuperación (**Explore the
  App**) y desde el Settings del espacio propio (**Explore the Demo**). Dentro
  de la demo, Settings no ofrece esta entrada.
- **Nunca con una operación pendiente:** mientras se crea, se guarda, se borra
  o se abre el espacio, la demo no se abre (`openDemo` responde `busy`) y el
  guardado no se cancela. En Settings el botón queda `aria-disabled` con «Wait
  until your last change is saved.». Desde Welcome el botón no hace nada en ese
  momento.
- **Preguntar antes de descartar:** si hay algo escrito, sea el borrador de New
  Goal o lo conservado como «(closed)», Explore the Demo pregunta con Copy What
  I Typed, Keep Editing y Discard and Open Demo. **Exit Demo** pregunta igual
  si hay algo escrito dentro de la demo (Discard and Exit Demo).
- **Aislamiento en las dos direcciones:** ninguna preferencia, vista, selección
  ni borrador pasa de un lado a otro.
  - Las preferencias de pantalla de la demo (importes ocultos, Donut o Bars,
    Maybe Later del fondo de emergencia) viven solo en memoria. Toda demo
    empieza con las de Alex, y Reset Demo las restablece.
  - El diseño de Home y las vistas de Data y History de la demo también son
    solo suyos.
  - La vista de Bills y el mes del espacio propio se apartan al entrar y se
    devuelven al salir.
  - La demo usa el tema de Alex. Al salir vuelve el del espacio propio.
- **Salida:**
  - Si se entró desde Settings, Exit Demo vuelve al Home propio, recargado
    desde el almacén. Si otra pestaña guardó entretanto, se ve esa versión. Si
    la borró, aparece Welcome con el motivo. Si hay un problema, se ve su aviso
    o la pantalla de recuperación.
  - Si se entró desde Welcome, Exit Demo vuelve a Welcome.
- Dentro de la demo, Restore Backup no está disponible («Exit the demo to
  import your own data.»), así que nada de la demo puede llegar al espacio
  propio.

## 9. Pruebas

Qué archivo de pruebas cubre cada parte: [PROJECT_MAP.md](PROJECT_MAP.md#pruebas).
Qué recorridos manuales están confirmados: [STATUS.md](STATUS.md).
