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
`npx vitest run src/features/planner`.

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
2. **Home.** Income 6.500, Planned Bills 5.750, Income minus Bills 750 ("Not
   money saved"). Left to Pay 250 y "You still have bills to pay in October.".
   Total Debt 17.400 (Show abre las tres deudas). My Money con Savings 1.350
   dividido por propósito. My Goals: Japón 6 %, Navidad 25 %.
3. **Change amount.** En Monthly Bills by Category, Utilities → 750 en octubre:
   Planned Bills 5.800 y diferencia 700. Cambia a November 2026: sigue 5.750.
4. **Bills.** Abre el día 25 y marca Student Loan como pagado: Home dice "All
   your October bills are paid." y Total Debt sigue en 17.400.
5. **Cards.** Abre Small Loan, Update Balance a 3.300: Total Debt baja a 17.100
   en Home y el saldo anterior aparece en History.
6. **Goals.** Abre Trip to Japan y añade 100 con "Savings I already have":
   Savings no cambia. Añade otros 100 con "New savings": Savings sube 100.
7. **Goal Planner** (Home → Plan Another Goal). La fecha propuesta es el
   23-02-2027 (cuatro meses después de la fecha de la demo). Evalúa, revisa,
   confirma y pulsa **Save as Goal** en Home.
8. **Reset Demo** desde la franja, Data o Settings: vuelven 17.400 y 750, la
   meta guardada desaparece, no queda "Saved in My Goals" y el Goal Planner
   empieza vacío.
9. **Exit Demo → Create Account → Continue Without an Account.** Crea un
   espacio propio, añade una factura y recarga la página: sigue ahí. En Data,
   Export JSON descarga el archivo.
10. **Safari (iPhone).** Los campos de fecha no se salen de la columna y la barra
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
