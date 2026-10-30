# Goal Planning App

Prototipo web, pensado primero para el móvil, que ayuda a una persona a
entender sus ingresos, facturas, deudas, dinero y metas con cifras
explicables y conectadas entre sí.

- **Propósito:** entender tus finanzas, explorar opciones y decidir con
  información. Cada sugerencia explica sus datos, supuestos y límites, y nada
  cambia hasta que lo confirmas.
- **Estado:** prototipo de aprendizaje. La prioridad actual es la demo
  Individual de **Alex**: un año ficticio completo (2026), editable y
  reproducible. El modo
  Duo se muestra, pero su versión privada queda para más adelante.
- **Sin servidor ni cuentas:** todo se calcula en el navegador. El espacio
  propio se guarda solo en este navegador (IndexedDB), **sin cifrar**; la demo
  no se guarda nunca. Si otra pestaña cambia o borra el espacio, lo escrito
  aquí no se pierde sin preguntar. Ver
  [docs/STORAGE_AND_RECOVERY.md](docs/STORAGE_AND_RECOVERY.md).
- **Interfaz en inglés sencillo**; documentación en español.
- **Menú:** Home, Bills, Cards, History y Data. My Goals, el fondo de
  emergencia y Settings se abren desde Home o la cabecera. La demo se abre
  desde la bienvenida (Explore the App) o desde Settings (Explore the Demo).

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
npm audit        # dependencias con vulnerabilidades conocidas
```

## Documentación

| Documento | Para qué sirve |
| --- | --- |
| [docs/USER_GUIDE.md](docs/USER_GUIDE.md) | Manual de uso en inglés sencillo: cómo usar la app tal como funciona hoy, con ejemplos inventados y sus límites actuales. |
| [docs/PROJECT_MAP.md](docs/PROJECT_MAP.md) | Dónde vive cada cosa y qué archivos revisar para cambiar X. |
| [docs/FINANCIAL_RULES.md](docs/FINANCIAL_RULES.md) | Las reglas financieras, cómo se relacionan las cifras y ejemplos. |
| [docs/STORAGE_AND_RECOVERY.md](docs/STORAGE_AND_RECOVERY.md) | Guardado en IndexedDB, migración, otras pestañas, formularios sin guardar, recuperación, copias y aislamiento de la demo. |
| [docs/STATUS.md](docs/STATUS.md) | Estado real de las pruebas automáticas y manuales, limitaciones y trabajo pendiente. |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Instalación, comprobaciones, recorrido de revisión y archivos auxiliares. |
| [docs/demo-alex-year.md](docs/demo-alex-year.md) | El año ficticio de Alex: perfil, acontecimientos, supuestos, resumen mensual y comprobaciones. |

## Tecnología

React 19 + TypeScript + Vite. Pruebas con Vitest y Testing Library (jsdom).
No hay otras dependencias de ejecución (el PDF se genera con código propio).
Las pruebas de la base de datos usan `fake-indexeddb` (solo desarrollo).
