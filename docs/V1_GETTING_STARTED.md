# Getting Started v1.0

Estado del trabajo de Getting Started para v1.0 y decisiones aprobadas.
Informe de partida: `INFORME-GETTING-STARTED-V1.md` (entregado fuera del repositorio).
Dirección aprobó D-GS1 a D-GS8 el 12-11-2026.

## GS-1: modelo de progreso (este paso)

Código: `src/features/home/gettingStarted.ts`. Pruebas: `gettingStarted.test.ts`
y `src/Help.test.tsx` › Getting Started.

### Orden de etapas

| # | Id interno | Etapa | Completa cuando… |
| --- | --- | --- | --- |
| 1 | `accounts` | Accounts & Savings | hay al menos una cuenta |
| 2 | `income` | Income | hay al menos una fuente de ingreso, **o** el usuario declaró `none` |
| 3 | `debts` | Debts | hay al menos una deuda, **o** el usuario declaró `none` |
| 4 | `bills` | Bills & Subscriptions | hay al menos una factura **sin** `debtId` (los pagos que crea una deuda no cuentan) |
| 5 | `goals` | Goals | hay al menos una meta **o** el Emergency Fund (D-GS2) |
| 6 | `finish` | Finish Setup | solo cuando se termina el recorrido (`finished`) |

Las etiquetas visibles se definen en GS-3. Hasta entonces, el panel de Home
conserva sus textos actuales, en el nuevo orden.

### Estados de una etapa

- `done`: el espacio tiene lo que pide (o, en `finish`, el recorrido terminó).
  **Los datos reales tienen prioridad** sobre cualquier respuesta guardada.
- `none`: el usuario declaró que no tiene ninguno. Solo para `income` y `debts`.
  Cuenta como completa, **no crea datos** y no vuelve al retomar la guía.
- `skipped`: pendiente para después. No cuenta como completa y vuelve al retomar.
- `to-do`: sin hacer.

`none` y `skipped` se excluyen mutuamente: declarar `none` quita el `skipped`
de esa etapa, y omitirla quita el `none`.

### Progreso guardado (v2)

```ts
{ version: 2, hidden, skipped: StageId[], none: ('income' | 'debts')[], finished, last: StageId | null }
```

- Misma clave del dispositivo: `goal-planning-app.getting-started` → `{ spaceId, progress }`.
- Sin datos financieros. Nunca va en los datos del espacio ni en la copia de seguridad.
- `last` solo dice qué etapa abrir al volver (`resumeStep`). Nunca decide si una
  etapa está completa. GS-1 no lo escribe todavía: lo harán las pantallas de GS-3 (`visitStep`).
- La demo mantiene su progreso en memoria (`DEMO_PROGRESS`, oculto al empezar) y nunca lo guarda.
- Show Getting Started on Home (`resumeGuide`) devuelve las etapas omitidas,
  reabre un recorrido terminado y **conserva** las respuestas `none`.

### Compatibilidad con el progreso anterior

`readProgress` lee cualquier valor sin bloquear la aplicación y **nunca escribe**.
El valor solo se reescribe, en v2, cuando el usuario cambia algo.

- Sin `version` (antes de v1.0): mismos ids. `day-to-day` se lee como `finish` y
  nunca queda como omitida. `hidden` y `finished` se respetan. Un antiguo
  «I Have None» se guardaba como `skipped` y **sigue como skipped**, porque no se puede
  saber si significaba `none`. Un campo `none` en un valor antiguo se ignora.
- Versión futura (> 2): se leen los campos conocidos y se ignoran los demás.
- Valor dañado o desconocido: guía nueva. Ids desconocidos y un `last` no válido se descartan.

### Adaptación mínima del panel actual

- El panel muestra los pasos en el nuevo orden (Accounts primero) con sus textos actuales.
- El botón existente **I Have None** de Cards and loans guarda ahora `none` en
  lugar de `skipped` (D-GS3). No se añadió ningún botón: la opción de Income
  llegará con su pantalla de etapa (GS-3).
- Help & Guide y `guideContent.ts` describen el nuevo orden.
- Un paso `none` se ve igual que uno hecho (✓), y el lector de pantalla dice «none».

## Pendiente (no incluido en GS-1)

| Paso | Contenido |
| --- | --- |
| GS-2 | Extraer `AccountForm` e `IncomeSourceForm` sin cambiar su comportamiento. |
| GS-3 | Pantallas de etapa con Back, Continue y Skip for now; tarjeta compacta en Home; `I don't have regular income`; etiquetas definitivas; escribir `last`. |
| GS-4 | Debts y Bills dentro de la etapa; volver a la etapa tras guardar (D-GS6); `I don't have any debts`. |
| GS-5 | Goals: Emergency Fund y New Goal desde la etapa; no duplicar la invitación al fondo en Home. |
| GS-6 | Finish Setup con resumen y sin confirmación (D-GS7); `Whose income is this?` en Duo (D-GS5). |
| GS-7 | Retomar desde la tarjeta de Home y Settings › Help & Guide (D-GS8); documentación final; recorridos manuales. |

## Decisión registrada para la fase Debts

**D-D2-INTEREST — Interest rate: known zero, known positive rate, or unknown.**

- Un 0 % confirmado y una tasa desconocida son estados distintos.
- Una tasa desconocida nunca se convierte en 0 % sin avisar. **Nunca usar 0 % como valor por defecto.**
- Una proyección que depende de una tasa desconocida no se presenta como fiable.
- El futuro formulario de Debts permitirá guardar, de forma explícita, una deuda con tasa desconocida.
- Se implementa en la fase Debts (D2), no en GS-1. Hasta entonces, el formulario
  actual sigue exigiendo el interés (D-GS4).
