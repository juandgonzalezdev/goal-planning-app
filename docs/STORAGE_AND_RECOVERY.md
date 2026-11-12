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
| Progreso de Getting Started (GS-6A.1) | Almacén `meta`: una clave `guide-progress:<id del espacio>` por espacio | `{ format: 1, spaceId, revision, savedAt, progress }`, con **revisión propia**, separada de la del espacio. Va en la copia de seguridad nueva. Ver §10 |
| Espacios ilegibles apartados por Use Older Copy | Almacén `quarantine` | Cada uno con su propia clave. Nunca se borran ni se sobrescriben |
| La copia antigua (versiones anteriores de la app) | `localStorage`, clave `goal-planning-app.my-space` | Solo se lee y nunca se cambia, salvo con Erase |
| La marca de borrado | `localStorage`, clave `goal-planning-app.erased` | Mientras existe, la copia antigua no se vuelve a abrir |
| Preferencias de pantalla del espacio propio | `localStorage`: `goal-planning-app.hidden-amounts`, `.bills-chart`, `.emergency-later` y `.home-layout` (ligado al id del espacio) | Son de este dispositivo, no del espacio, y no van en la copia de seguridad |
| Progreso de Getting Started de versiones anteriores a GS-6A.1 | `localStorage`, clave `goal-planning-app.getting-started` | Solo se lee, una vez, para traerlo a `meta` (§10). Esta versión nunca lo escribe. Erase lo borra |
| La demo | Solo en memoria | Nunca se guarda (sección 8) |

Los espacios nuevos reciben un id aleatorio (`newId`). Los creados antes
conservan `my-space`.

**Home en tres áreas (preferencias de pantalla).**

- `hidden-amounts` sigue siendo una lista de nombres. Se lee con
  `hiddenAreasFrom`: un área queda oculta si en la lista está su nombre
  (`month`, `left-to-pay`, `money-goals`) o el de **cualquiera** de sus bloques
  antiguos (`month`, `categories`, `year` → This Month; `left-to-pay` → Left
  to Pay; `money`, `debt`, `goals` → Money & Goals).
  Nada que estuviera oculto pasa a verse.
- Al guardar se escriben los nombres de las áreas ocultas **y** los de todos
  sus bloques antiguos (`savedHiddenNames`), para que una versión anterior de
  la app, si se vuelve a ella, siga ocultando lo mismo.
- `home-layout` se guarda como `{ spaceId, layout: { version: 2, order, open } }`:
  `order` son las tres áreas y `open` las partes abiertas (`categories`,
  `year`, `money`, `debt`, `goals`). Un diseño de siete bloques se lee así: cada
  área ocupa el lugar de su primer bloque y una parte está abierta si su bloque
  lo estaba. Cualquier otra cosa ilegible vuelve al diseño inicial sin error.
  Si se vuelve a una versión anterior, esta lee del formato 2 lo que reconoce:
  This Month y Left to Pay primero, el resto de bloques en su orden inicial, y
  abiertos los bloques cuyo nombre coincide con una parte abierta; This Month y
  Left to Pay aparecen cerrados. Es solo la vista: ningún dato se pierde.
- Reset Layout solo cambia `home-layout`; nunca toca `hidden-amounts`.
- `getting-started` (GS-1 a GS-5) se guardaba como `{ spaceId, progress: { version: 2, hidden, skipped, none, finished, last } }`. Desde GS-6A.1 el progreso vive en IndexedDB (§10) y esta clave solo se lee para traerlo una vez; ya no se escribe. Erase All Data la borra.
- La demo no lee ni escribe ninguna de estas claves.

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
  (`app/unsavedChanges.ts`). Los borradores de New Goal y Welcome Setup los
  registra `App.tsx` como **conservados** (`kept`): cuentan aunque su pantalla
  esté cerrada, y moverse por la app nunca los descarta.
- Un formulario puede decir dónde vive: `tag` (por ejemplo el editor de una
  factura de la lista, o el formulario abierto de History) y `month` (los tres
  editores del importe de un mes). Con eso, un cambio dentro de una pantalla
  sabe qué formularios cerraría.
- **Copy What I Typed** copia todos los campos con contenido de cada formulario.
  Si el navegador no deja copiar (por ejemplo en `http://` de la red local),
  muestra el texto en un recuadro de solo lectura ya seleccionado. También
  existe **Show What I Typed**. Lo escrito no se guarda, no se envía y no se
  registra.
- Mientras no se puede guardar, un formulario que se cierra sigue en la lista
  como «(closed)» hasta descartarlo. En ese estado moverse no pregunta, porque
  nada se pierde.
- Descartar siempre pide confirmación: Discard and Open Latest Version,
  Discard and Try Again, Discard and Close, Discard and Open Demo, Discard and
  Exit Demo y Discard and Leave.

### Leave without saving? (paso 1B)

- `confirmLeave` (en `App.tsx`, y `useLeaveGuard()` para las pantallas) recibe
  qué formularios cerraría un cambio y el cambio. Sin formularios con cambios
  afectados, el cambio ocurre en el acto. Si se está guardando, espera la
  respuesta; si después ya no se perdería nada, el cambio ocurre sin preguntar.
  Si no, aparece **Leave without saving?** (`LeaveDialog` en
  `components/UnsavedForms.tsx`) con la lista, **Keep Editing** (foco inicial y
  Escape; vuelve el foco al campo), **Copy What I Typed** (solo esos formularios;
  no sale) y **Discard and Leave** (hace el cambio una vez).
- Lo usan: pestañas, logo, engranaje, botones Back, enlaces a otras pantallas,
  el cambio de mes (solo si hay un importe escrito para otro mes), Calendar/List
  y el filtro de Bills, Spent/Planned y la categoría de Spending by Category,
  periodo, búsqueda, filtros y meses de History (solo si dejan de mostrar el
  registro que se está cambiando, o si otro formulario ocupa su lugar), y abrir
  otro formulario de Income o Accounts & Balances en lugar del abierto.
- **Cancel** no pregunta: es la elección del usuario. Las vueltas después de
  guardar o borrar usan `backAllowed()` y tampoco preguntan.
- Los editores del importe de un mes van por factura **y** mes (`key`), así que
  un importe nunca se guarda en otro mes.

### Atrás y Adelante del navegador

`app/navigation.ts` (`Navigation`). Cada paso del historial guarda
`{ screen, chain, idx }` y nada de lo escrito. `chain` es aleatorio
(`crypto.randomUUID`, o `getRandomValues`, o `Math.random` con la hora) y no se
guarda en ningún almacenamiento; al recargar se adopta la cadena del paso actual.
La distancia entre dos pasos solo se calcula dentro de una misma cadena.

- Sin nada que perder, Atrás y Adelante funcionan como siempre.
- Con algo que perder, la pantalla **no cambia**. Si el paso es de la misma
  cadena y no hay ningún movimiento propio en curso, la app pide **una** vuelta
  (`history.go(origen − llegada)`) y pregunta. Discard and Leave pide **un**
  movimiento al **primer** destino, con permiso para esa única llegada.
- Nada se decide por tiempo. Cada llegada se juzga solo por el paso al que
  llega: solo una llegada al paso permitido, o sin nada que perder, cambia la
  pantalla. Cualquier otra llegada termina el permiso.
- Si llega un paso distinto del esperado mientras hay un movimiento propio en
  curso, la app queda **«unsure»**: no vuelve a mover el historial; reescribe el
  paso actual (`replaceState`, cadena nueva) con la pantalla del formulario.
  Discard and Leave queda desactivado mientras dure, y tras 2 s el diálogo dice
  «Navigation is taking longer than expected.» El estado termina cuando ya no hay
  nada que perder.
- Un paso sin cadena o de otra cadena: no se mueve nada; el paso pasa a una
  cadena nueva con la pantalla del formulario. Discard and Leave le devuelve su
  estado original y muestra su pantalla (Home si no tiene una legible).
- Recargar, cerrar o salir del sitio: solo `beforeunload` (aviso del navegador)
  mientras hay algo escrito, también un borrador conservado.
- **Límites:** una llegada tardía sin nada que perder puede cambiar la pantalla;
  tras Keep Editing en un paso reescrito, un Atrás puede parecer que no hace
  nada. En Safari/iPhone se comprobaron los gestos cancelado y completado
  de 1B, el regreso desde Money y los recorridos principales de la nueva
  Home: Show All y regreso desde una factura, protección de Add Spending,
  conservación del borrador de Add Goal y ocultación de importes.
  No se han validado todas las formas de navegación en Safari.

## 6. Problemas al abrir y recuperación

| Situación | Qué ve el usuario |
| --- | --- |
| Lo guardado no se puede abrir: dañado (`broken`), falta el espacio (`missing`), copias distintas (`copies-differ`) | Pantalla **Your Saved Information**. Nunca ofrece crear un espacio. Ofrece Download Both Copies, Use Older Copy (si la copia antigua se puede leer) y Erase Saved Information, cada uno tras confirmación, más Try Again |
| Guardado por una versión más nueva de la app (`newer-version`) | La misma pantalla, solo con Download Both Copies y Try Again. Nunca se sustituye ni se borra |
| El navegador no puede guardar con seguridad (sin IndexedDB, o falló a mitad) | **Solo lectura**: se puede mirar todo, Download Backup, Download Both Copies y Try Again. Si se muestra la copia antigua, se dice que puede estar desactualizada. Ningún control llega a guardar. Sin copia que mostrar, Welcome lo dice y no deja empezar un espacio |
| Erase no pudo quitar la copia antigua | Welcome dice «Erase is not finished…». Esa copia no se vuelve a abrir |

**Use Older Copy** aparta el espacio ilegible en `quarantine` (no lo borra) y
abre la copia antigua. **Erase** borra el espacio, apunta su última revisión y
después quita la copia antigua. Desde GS-6A.1, Erase borra también, en la misma
transacción, el progreso de Getting Started de **todos** los espacios, y después
la clave antigua `goal-planning-app.getting-started`. Use Older Copy aparta en
`quarantine` el progreso del espacio que sale de `spaces` (cuando la copia
antigua tiene otro id); si el id es el mismo, el progreso se queda con él.

## 7. Download Backup y Download Both Copies

| | Download Backup | Download Both Copies |
| --- | --- | --- |
| Dónde | Settings → Reports & Backup → Data Backup, siempre (también en la demo) | Pantalla de recuperación, y en Settings → Reports & Backup cuando el espacio es de solo lectura |
| Qué contiene | Desde GS-6A.1, un sobre `{ kind: "goal-planning-backup", format: 1, financeData, gettingStarted }`: el espacio abierto, validado, sin cambios, y el progreso de Getting Started **tal como está guardado** (`null` si no hay nada guardado). Ver §10 | Todas las copias del dispositivo **tal como están guardadas**: el espacio actual (aunque esté dañado), todos los espacios, la cuarentena, las marcas, los registros de progreso de Getting Started (`database.guideProgress`) y, como texto, la copia antigua y el progreso antiguo (`olderGuideProgress`) |
| Para qué | Guardar y restaurar con **Restore Backup** | Rescatar información antes de Use Older Copy o Erase |
| Restore Backup | Lo lee, lo comprueba y pide confirmación antes de reemplazar. Acepta también los archivos antiguos (solo `FinanceData`) | Lo rechaza: «This is a recovery file, not a backup…» |
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
  - El diseño de Home, las vistas de Money y History y el filtro de Goals de
    la demo también son solo suyos.
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

## 10. Progreso de Getting Started (GS-6A.1)

### Dónde y con qué revisión

- Un registro por espacio en el almacén `meta`, clave `guide-progress:<id>`:
  `{ format: 1, spaceId, revision, savedAt, progress }`, con `progress` en el
  formato `GuideProgress` v2 (`docs/V1_GETTING_STARTED.md`). Código:
  `src/data/guideProgress.ts` y `indexedDbStore.ts` (`loadProgress`,
  `saveProgress`, `restore`).
- `revision` es **del progreso**: empieza en 1 y sube con cada guardado de la
  guía. **Nunca** cambia la revisión del espacio ni sus registros, así que un
  cambio de etapa en una pestaña no deja «desactualizado» un formulario
  financiero abierto en otra. Revisión 0 = no hay nada guardado todavía (guía
  nueva). Así se distingue «sin progreso» de un progreso guardado con
  `finished: false`.
- No hay almacén nuevo ni cambio de `DATABASE_VERSION` (sigue en 1) ni de
  `schemaVersion` (sigue en 3). Una pestaña de la versión anterior sigue
  funcionando.
- `saveProgress(spaceId, progress, baseRevision)` compara y escribe en una
  sola transacción (`transact`, `durability: 'strict'`). Responde `saved` solo
  cuando la transacción terminó; `conflict` (otra pestaña o un Restore guardó
  antes, o el espacio ya no es el abierto) con lo guardado ahora; o `failed`.
  En los dos últimos casos no escribe nada.
- La app (`useSpace.changeGuide`) solo muestra un cambio de la guía cuando el
  almacén respondió `saved`. Los cambios de la guía de una pestaña van en cola,
  uno tras otro, y no esperan a los guardados financieros (ni al revés).

### Migración desde localStorage

`loadProgress` al abrir el espacio:

1. Lee `current-space` y el registro. Si hay registro, **ese manda**
   (GS-6A-T01) y localStorage ya no se vuelve a leer para ese espacio.
2. Si no hay registro, lee `goal-planning-app.getting-started`. Solo lo usa si
   su `spaceId` es el del espacio abierto, con `readProgress` (lectura
   tolerante de v1 y v2). Un valor de otro espacio, dañado o ausente da una
   guía nueva **sin escribir nada**. Un valor de una versión futura (> 2) no se
   trae.
3. Lo escribe con `add` en una transacción que vuelve a comprobar que el
   espacio sigue abierto y que **nadie** guardó progreso entretanto (otra
   pestaña, un Restore). Si alguien lo hizo, se usa lo suyo.
4. La clave antigua **no se borra** (solo Erase la borra).

Migración interrumpida: si la escritura falla, no queda nada a medias; se
muestra lo que tenía localStorage (revisión 0) y se reintenta en la siguiente
apertura. Repetirla o hacerla en dos pestañas a la vez deja un único registro.
Los datos financieros nunca dan `finished: true`.

### Backup y Restore

- **Download Backup** escribe el sobre con `gettingStarted: { progress }` leído
  del almacén en ese momento (lo confirmado, nunca el estado en pantalla), o
  `null` si no hay nada guardado. En la demo, siempre `null`. Si hay progreso
  guardado pero no se puede leer, el archivo sale sin él y la pantalla lo dice.
- **Restore Backup** (`importBackup`) acepta el sobre nuevo y los archivos
  antiguos (solo `FinanceData`). Todo o nada: un problema en los registros **o**
  en `gettingStarted` (campos desconocidos, etapas no válidas, versión futura,
  `format` futuro) rechaza el archivo entero con el motivo. Se mantienen todas
  las comprobaciones financieras y el rechazo del archivo de recuperación.
- `store.restore(data, baseRevision, guide)` escribe los registros **y** el
  progreso en **una única transacción** IndexedDB (`spaces`, `meta`,
  `quarantine`): o queda todo o no queda nada. El espacio conserva su id.
  - Archivo nuevo con progreso: ese progreso pasa a ser el del espacio (con
    `finished` tal cual, `true` o `false`).
  - Archivo antiguo, o nuevo con `null`: se conserva el progreso válido del
    espacio. Si no tenía ninguno, se guarda el que tuviera localStorage para ese
    espacio o, si no, una guía nueva sin terminar. Nunca se inventa `finished`.
    Como queda un registro, ninguna migración posterior lo pisa.
  - Progreso guardado dañado o de una versión futura: un archivo con progreso lo
    aparta en `quarantine` antes de reemplazarlo; un archivo antiguo deja intacto
    el de una versión futura.

### Otras pestañas

- Cada guardado avisa con `StoreChange` `progress-saved` (`spaceId`,
  `revision`). La otra pestaña relee solo el progreso; no relee el espacio ni
  toca sus formularios. Una pestaña de la versión anterior trata ese aviso como
  cualquier otro y comprueba el espacio sin encontrar cambios.
- Al volver a una pestaña (`visibilitychange`) también se relee el progreso.
- Una pestaña con un progreso viejo recibe `conflict`: se muestra lo guardado y
  el aviso «Not saved: Getting Started changed in another tab…». Nada se pisa.

### Límites conocidos

- Una pestaña de una versión **anterior** a GS-6A.1 sigue leyendo y escribiendo
  la clave de localStorage. Esos cambios ya no llegan a esta versión (manda el
  registro de `meta`).
- Un Erase hecho desde una versión anterior no borra los registros
  `guide-progress:*`. No se reutilizan: los espacios nuevos tienen id aleatorio
  y `create` borra cualquier registro con su id. El siguiente Erase de esta
  versión los borra.
- Un registro dañado o de una versión futura queda bloqueado: se ve una guía
  nueva, sin terminar, y los cambios de la guía dicen que no se guardaron. Se
  resuelve con Restore de un archivo con progreso o con Erase.
- Un archivo de backup nuevo no lo abre una versión anterior de la app («The
  file has no schemaVersion.»).
- Sin IndexedDB (solo lectura) el progreso se muestra desde localStorage y no se
  puede cambiar.
