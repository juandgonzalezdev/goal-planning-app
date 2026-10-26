# Goal Planning App

Prototipo web, pensado primero para el móvil, que ayuda a una persona a
entender sus ingresos, facturas, deudas, dinero y metas con cifras
explicables y conectadas entre sí.

- **Estado:** prototipo de aprendizaje. La prioridad actual es la demo
  Individual de **Alex** (datos inventados y completamente editables). El modo
  Duo se muestra, pero su versión privada queda para más adelante.
- **Sin servidor ni cuentas:** todo se calcula en el navegador. El espacio
  propio se guarda solo en este dispositivo (`localStorage`); la demo no se
  guarda nunca.
- **Interfaz en inglés sencillo**; documentación en español.
- **Menú:** Home, Bills, Cards, History y Data. Goals, Goal Planner y Settings
  se abren desde Home o la cabecera.

## Empezar

```bash
npm install
npm run dev      # abre http://localhost:5173
```

Comprobaciones antes de entregar un cambio:

```bash
npm test         # pruebas (Vitest)
npm run lint     # ESLint
npm run build    # TypeScript + compilación de producción
```

## Documentación

| Documento | Para qué sirve |
| --- | --- |
| [docs/PROJECT_MAP.md](docs/PROJECT_MAP.md) | Dónde vive cada cosa y qué archivos revisar para cambiar X. |
| [docs/FINANCIAL_RULES.md](docs/FINANCIAL_RULES.md) | Las reglas financieras, cómo se relacionan las cifras y ejemplos. |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Instalación, comprobaciones, recorrido de revisión y archivos auxiliares. |
| [docs/demo-alex.md](docs/demo-alex.md) | Los datos de Alex: valores dados, valores inventados y totales esperados. |

## Tecnología

React 19 + TypeScript + Vite. Pruebas con Vitest y Testing Library (jsdom).
No hay otras dependencias de ejecución.
