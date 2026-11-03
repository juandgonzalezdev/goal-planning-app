# Adaptaciones de la candidata Rumbo 03–08

Base integrada: `579117b`. Editor: Codex. Revisiones de Claude: pendientes de
recepción como adjunto por Juan; no se presupone acceso a esta carpeta.

## Rumbo 04

- El parche original no aplicó en LeftToPay, FINANCIAL_RULES y PROJECT_MAP.
  Las demás partes pasaron comprobación antes de aplicarse.
- LeftToPay incorpora grupos y Coming up del 04 conservando useLeaveGuard,
  las etiquetas de formularios de pago y la confirmación de Show Fewer del 03.
  Los elementos que oculta Show Fewer se calculan sobre los nuevos grupos.
- Las inserciones documentales se adaptaron sin perder las reglas de borrado
  corregidas ni la fila de pruebas de accountDeletion.
- Comprobación propia: 55 pruebas en 5 archivos (NextDays, toPay, MarkPaid,
  HomeAreas y LinksReturn), lint, build y diff --check correctos.
  Build conserva el aviso de tamaño y jsdom avisa de scrollTo.

## Rumbo 05

- Conflictos de contexto en App, HistoryScreen y PROJECT_MAP: se integraron
  los cambios del menú global sobre los archivos actuales. Se conservaron el
  destino correcto de Balance update y las etiquetas Open account / Open card
  or loan de Rumbo 02. La ayuda de borrado y Show Fewer del 03 permanece.
- No se han cambiado dependencias ni el esquema de datos.
- Comprobación propia: 63 pruebas en 6 archivos (GlobalAdd, HomeAreas,
  LinksReturn, NextDays, MarkPaid y accountDeletion), lint, build y diff --check
  correctos. No se repitió la suite completa en este paso localizado.

## Rumbo 06

- Aplicación por contextos exactos en App y adaptación de la fila de Layout
  en PROJECT_MAP; se conservó la documentación de pruebas añadida en 03–05.
- Barra lateral desde 1024 px, Home en dos columnas desde 1200 px, como en
  el resumen original. No se modifican los flujos de guardado ni navegación.
- Comprobación propia: 10 pruebas (Layout y GlobalAdd), build y diff --check
  correctos. La disposición CSS real queda para la comprobación de navegador.
