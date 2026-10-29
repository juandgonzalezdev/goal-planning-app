# Desarrollo

## Requisitos

- Node.js 24 y npm 11 (las versiones con las que se trabaja en Windows).
- Git.

## Instalación y ejecución

```bash
npm install          # instala las dependencias de package-lock.json
npm run dev          # servidor de desarrollo: http://localhost:5173
npm run build        # comprueba TypeScript y genera dist/
npm run preview      # sirve dist/ para probar la versión compilada
```

Para probar en el iPhone dentro de la misma red: `npm run dev -- --host` y abre
en Safari la dirección "Network" que muestra la terminal.

## Comprobaciones

Ejecuta las cuatro antes de entregar un cambio:

| Orden | Qué comprueba | Resultado esperado |
| --- | --- | --- |
| `npm test` | Todas las pruebas (Vitest + Testing Library en jsdom). | Todas pasan. |
| `npm run lint` | ESLint (incluye reglas de React Hooks). | Sin errores. |
| `npm run build` | `tsc -b` (tipos) y compilación de Vite. | Sin errores. |
| `npm audit` | Vulnerabilidades conocidas en las dependencias. | 0 vulnerabilidades. |

`npm run test:watch` repite las pruebas al guardar. Para una sola carpeta:
`npx vitest run src/report`.

### Avisos conocidos (no son errores)

- `npm run build` avisa de que el paquete JS supera 500 kB: en `98addbc`
  (29-10-2026) son unos 615 kB, que el navegador descarga comprimidos como unos 169 kB. La parte
  mayor es React DOM; después, los 401 registros del año de Alex
  (`src/data/fixtures/demoAlex.ts`). No se sube el límite del aviso para
  esconderlo. Si el paquete pasa de unos 200 kB comprimidos, la demo y el
  informe PDF se pueden cargar solo al abrirlos (`import()`).
- `npm test` escribe varias veces «Not implemented: Window's scrollTo()
  method». Lo dice jsdom, el navegador simulado de las pruebas, que no sabe
  desplazar la página. Viene de `App.tsx`, que devuelve la posición al volver
  de una factura o una meta a Bills o History. Las pruebas pasan y ese
  regreso se comprueba con un espía en `src/BillsCalendar.test.tsx`.

### Escribir pruebas

- Cálculos: junto al archivo, en `src/domain/…/*.test.ts`, con importes exactos
  en unidades menores.
- Pantallas: en `src/AlexDemo.test.tsx` (demo de Alex) o `src/App.test.tsx`
  (espacio propio y hogar Duo de pruebas). Se pasa una fecha fija con
  `getToday` y un almacenamiento en memoria (`src/test/memoryStorage.ts`).
- Guardado y otras pestañas: la base de datos es `fake-indexeddb`, nueva en
  cada prueba (`freshDatabaseForEachTest` en `src/test/space.ts`). Otra pestaña
  es otro almacén sobre la misma base de datos; un guardado lento se simula con
  `heldStore`. Ejemplos: `src/OtherTabs.test.tsx` y
  `src/DemoFromSettings.test.tsx`.
- Un error corregido lleva una prueba que fallaba antes de la corrección.
- Solo datos inventados. Ningún dato financiero real en el repositorio.

## Recorrido de revisión (manual, unos 10 minutos)

Hazlo en el móvil o con el navegador a 390 px de ancho, en modo claro y oscuro.

1. **Bienvenida → Explore the App.** Aparece la franja "Demo · Alex is
   invented…" con Reset Demo y Exit Demo. Menú: Home, Bills, Cards, History,
   Data.
2. **Home (December 2026).** Income 7.200, Planned Bills 6.401,84, Spent
   5.097,35, Result 2.102,65. Left to Pay 69,99 (Phone & Internet). Total Debt
   12.266,98. Savings 2.900 = Japón 1.800 + New Bike 200 + Emergency Fund 900.
   Year Summary: 55.998 / 48.781,14 / 7.216,86, déficits en Feb, Jul y Aug.
3. **Meses.** Elige August 2026 con las flechas o el selector: Result
   −3.037,86. "How is this worked out?" muestra 1.500 de Savings, 1.160,57 de la
   cuenta diaria y 377,29 de deuda nueva.
4. **Categorías.** Spending by Category → Bars → Groceries: lista de compras;
   abre una y cámbiala en History. Home se actualiza. **Ideas to Review** →
   Gym Membership → What If I Pause It? → 387,00. Cancel no cambia nada.
5. **Ocultar importes.** Hide All Amounts: todos los importes son `••••`, sin
   barras ni porcentajes reveladores. El ojo de un bloque lo muestra solo a él.
   En la demo dura mientras está abierta; en el espacio propio se recuerda en
   este dispositivo.
6. **Fondo de emergencia.** My Goals → Review My Emergency Fund: esenciales
   4.415,42 al mes; 3 months → objetivo 13.246,26. Cancel no cambia nada; Save
   Review guarda el objetivo y la cobertura (~0,2 meses) aparece en Home.
7. **Metas.** Trip to Japan → Try an Amount or Date: 500 al mes → 17 meses
   (31-5-2028). New Goal sin objetivo se puede crear; con fecha pide objetivo.
8. **History.** Al entrar: Year Overview cerrado, periodo 2026, December
   abierto (35 records, Showing 20) y los demás meses cerrados. Busca
   «christmas»: 7 records en December, November y October, con «Note: Spent on
   Christmas gifts». More Filters → Type Spending: «1 on» y la etiqueta
   «Type: Spending ×»; Clear Filters conserva el periodo. Year Overview → July
   muestra sus categorías. Abre un pago de Credit Card Payment y vuelve: mismo
   periodo, búsqueda, meses y posición. Añade un gasto y una transferencia.
9. **Data.** Export Report → One Month / Whole Year → Download PDF, con y sin
   importes. Data Backup → Download Backup.
10. **Reset Demo** desde la franja, Data o Settings: vuelve todo el año y
    December 2026.
11. **Exit Demo → Create Account → Continue Without an Account.** Crea un
    espacio propio, añade una factura y recarga la página: sigue ahí. Restore
    Backup lee el JSON descargado.
12. **Home plegable.** Al abrir solo This Month y Left to Pay están abiertos;
    los demás muestran periodo y resumen. Customize Home → Move up / Move down
    o arrastrar por el asa → Done. Reset Layout vuelve al inicio. El mes se
    queda arriba al desplazarse. Bills → January 2027 → Home muestra enero.
13. **Data plegable.** Al entrar los seis bloques están cerrados con un
    resumen. Income → Salary muestra sus cobros de 2026 (esperado y recibido
    por separado); Ended muestra Part-time Job y Scholarship. Home → My Money →
    Edit Balances abre Accounts & Balances con el foco en su encabezado. Reset
    Demo (franja, Data o Settings) pregunta «Reset demo?»; Cancel no cambia
    nada. Imprimir Home o Data con Collapse All cabe en una página.
14. **Bills → Calendar.** Toca el 30 de December (última fila): la página no
    se mueve y la barra de arriba dice «Wed 30 Dec · No bills». Al bajar, esa
    barra se queda bajo la cabecera mientras se ve el calendario y nunca tapa
    el panel. View day details lleva al panel con la fecha visible y el foco
    en ella; Back to calendar devuelve el foco al día. + Add Bill del panel
    abre el formulario con Due day 30 y Start month December 2026; Cancel
    vuelve al mismo sitio; al guardar vuelve al día con «Bill added.». Con el
    filtro Paid, el aviso dice que el filtro la oculta y ofrece Show All. Abre
    una factura y vuelve: mismo mes, vista, filtro, día, posición y foco.
15. **Safari (iPhone).** Los campos de fecha no se salen de la columna y la barra
    de pestañas no tapa el pie de página.
16. **Demo desde Settings.** En el espacio propio, oculta los importes y pon
    Bills en List. Settings → Explore the Demo: la demo empieza con lo de Alex.
    Cambia cosas, Reset Demo, Exit Demo: vuelves a tu Home con tus importes
    ocultos, tu vista de Bills y tu mes. Con un New Goal empezado, Explore the
    Demo pregunta antes (Copy What I Typed, Keep Editing, Discard and Open
    Demo). Exit Demo también pregunta si escribiste algo en la demo.
17. **Dos pestañas.** Con el mismo espacio en dos pestañas, un cambio en una se
    ve en la otra con «Updated with changes from another tab.». Con un
    formulario escrito en una, el cambio de la otra no lo sustituye: aviso de
    conflicto, Copy What I Typed y Open Latest Version con confirmación.

El registro de qué recorridos están confirmados y en qué navegador está en
[STATUS.md](STATUS.md).

## Ramas y entregas

- `main` es la versión publicada. No se fusiona nada en `main` sin la
  aprobación de Juan.
- Cada trabajo va en su propia rama desde la última versión aprobada, con
  commits pequeños y con un propósito claro. Separa los movimientos de archivos
  de los cambios de lógica.
- Si la entrega llega como paquete `.mbox`, se aplica con `git am` (ver la
  entrega correspondiente).
- Si llega como parche `.patch` (con finales de línea CRLF, como los archivos de
  Windows), se aplica en una rama nueva desde `main` con
  `git apply --check` y después `git apply`. El aviso de «trailing whitespace»
  se debe a los finales CRLF y no es un error. Si `--check` falla, no se usa
  `--ignore-whitespace` ni se sobrescriben archivos: primero se busca la
  diferencia con la base.

## Archivos auxiliares

Los paquetes `.mbox` y `.patch` de fases anteriores y las copias `.bak` no
forman parte del código. `.gitignore` los ignora para que no se suban por
error, junto con capturas (`shots/`), archivos `.env` y exportaciones de datos
(`goal-planning-data*.json`).

Guárdalos fuera del repositorio, por ejemplo en
`C:\Projects\goal-planning-archive\`, con un inventario de su procedencia. El
inventario de la auditoría de octubre de 2026 comprobó que todo su contenido ya
está en el historial de Git.

## Despliegue

Cloudflare Pages publica automáticamente `main` (producción) y algunas ramas de
vista previa con `npm run build` → `dist`. No cambies su configuración desde
aquí.
