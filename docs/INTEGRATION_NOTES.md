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
