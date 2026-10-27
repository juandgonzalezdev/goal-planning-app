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

Ejecuta las tres antes de entregar un cambio:

| Orden | Qué comprueba | Resultado esperado |
| --- | --- | --- |
| `npm test` | Todas las pruebas (Vitest + Testing Library en jsdom). | Todas pasan. |
| `npm run lint` | ESLint (incluye reglas de React Hooks). | Sin errores. |
| `npm run build` | `tsc -b` (tipos) y compilación de Vite. | Sin errores. |

`npm run test:watch` repite las pruebas al guardar. Para una sola carpeta:
`npx vitest run src/report`.

`npm run build` avisa de que el paquete JS supera 500 kB (unos 507 kB, 135 kB
comprimido): la mayor parte del aumento son los 401 registros del año de Alex.
Es un aviso, no un error.

### Escribir pruebas

- Cálculos: junto al archivo, en `src/domain/…/*.test.ts`, con importes exactos
  en unidades menores.
- Pantallas: en `src/AlexDemo.test.tsx` (demo de Alex) o `src/App.test.tsx`
  (espacio propio y hogar Duo de pruebas). Se pasa una fecha fija con
  `getToday` y un almacenamiento en memoria (`src/test/memoryStorage.ts`).
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
   La preferencia se recuerda en este dispositivo.
6. **Fondo de emergencia.** My Goals → Review My Emergency Fund: esenciales
   4.415,42 al mes; 3 months → objetivo 13.246,26. Cancel no cambia nada; Save
   Review guarda el objetivo y la cobertura (~0,2 meses) aparece en Home.
7. **Metas.** Trip to Japan → Try an Amount or Date: 500 al mes → 17 meses
   (31-5-2028). New Goal sin objetivo se puede crear; con fecha pide objetivo.
8. **History.** Gráfico de 12 meses; elige August para ver sus categorías.
   Filtra por tipo, categoría y cuenta; añade un gasto y una transferencia.
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
13. **Safari (iPhone).** Los campos de fecha no se salen de la columna y la barra
    de pestañas no tapa el pie de página.

## Ramas y entregas

- `main` es la versión publicada. No se fusiona nada en `main` sin la
  aprobación de Juan.
- Cada trabajo va en su propia rama desde la última versión aprobada, con
  commits pequeños y con un propósito claro. Separa los movimientos de archivos
  de los cambios de lógica.
- Si la entrega llega como paquete `.mbox`, se aplica con `git am` (ver la
  entrega correspondiente).

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
