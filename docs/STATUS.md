# Estado del proyecto

**Actualizado:** 13-11-2026 · GPA-ORG-A · Fase A documental.
**Base inspeccionada:** `478bacc2dae157476c7c294c6ae2080c4686c9d8`
(`Ensure Emergency Fund uniqueness and safe restoration`).
Se inspeccionó una copia del commit remoto, con sus archivos verificados por
huella de blob Git. No se inspeccionó el árbol ni el índice local de Windows.
Dirección identifica esta base como integrada en main, incluidos R1 y R2.
Su presencia en el commit está comprobada; el despliegue no se verificó en esta fase.

Este es el resumen vigente. [WORK_STATUS.md](WORK_STATUS.md) conserva los
registros fechados de etapas anteriores y no se interpreta como instrucciones
actuales. [PRODUCT_VISION.md](PRODUCT_VISION.md) conserva la dirección de producto
aprobada; su roadmap fechado no acredita el estado implementado de esta base.

## Implementado: presencia comprobada en la base

La inspección es estática, sin ejecución nueva de la app.

| Área | Evidencia y límite |
| --- | --- |
| Espacio local, Demo y persistencia | `src/app/useSpace.ts`, `src/data/indexedDbStore.ts` y [STORAGE_AND_RECOVERY.md](STORAGE_AND_RECOVERY.md): IndexedDB, revisiones, recuperación y Demo aislada. Sin cuentas operativas ni servidor de sincronización. |
| Navegación y finanzas | Home, Bills, Goals, Money y History; Money reúne ingresos, cuentas/ahorro y tarjetas/préstamos; Reports & Backup está en Settings. Ver `src/App.tsx` y [PROJECT_MAP.md](PROJECT_MAP.md). |
| Home y Getting Started | Anillo de cuatro secciones, tarjeta contextual y guía con progreso persistido. Ver `src/features/home/`, `src/features/guide/`, `src/data/guideProgress.ts` y [V1_GETTING_STARTED.md](V1_GETTING_STARTED.md). No se certifican todos sus recorridos por inspección. |
| Backup | `src/data/exchange.ts`: formato con registros y progreso Getting Started; sigue leyendo backups antiguos de solo registros. No se modificó el contrato. |
| Idiomas | EN/ES/PL previstos y catálogos parciales presentes. `src/i18n/languages.ts` mantiene `READY = { en: true, es: false, pl: false }`: ES/PL requieren preview o elección previa. No se presenta traducción completa ni disponibilidad general. |
| R1: reservas | `src/domain/finance/savings.ts` contabiliza metas activas y archivadas, incluido el fondo. Conserva cortes históricos, desconocidos y negativos. [UX_05_5_R1.md](UX_05_5_R1.md). |
| R2: Emergency Fund | `goals.ts` identifica el fondo único, incluso archivado, y `emergency.ts` protege creación/revisión y ofrece restauración de dominio sin duplicar movimientos. No existe una nueva UI de Restore. [UX_05_5_R2.md](UX_05_5_R2.md). |

Los informes R1/R2 conservan su estado original de entrega aislada/no integrada:
son evidencia histórica de implementación y QA. La identificación de esta base
como integrada proviene de Dirección y de la presencia de sus cambios, no de
reescribir retroactivamente esos informes.

## Validado: resultados atribuidos, no ejecutados en GPA-ORG-A

| Versión y fecha | Responsable / origen | Resultado comunicado y límite |
| --- | --- | --- |
| R1, 12-11-2026; contenido incluido en la base actual | Informe de Codex [UX_05_5_R1.md](UX_05_5_R1.md), «Resultado final» | 1.324/1.324 en 93 archivos; lint y build correctos. Sin pruebas manuales, Chrome o Safari en esa entrega. |
| R2, 13-11-2026; commit de referencia `478bacc` | Informe de Codex [UX_05_5_R2.md](UX_05_5_R2.md), «Resultado definitivo y veredicto» | 1.347/1.347 en 95 archivos, Vitest maxWorkers=4; lint y build correctos. Sin ejecución manual ni navegador en esa entrega. |
| R2, 13-11-2026 | Mismo informe R2 | npm audit comunicó 10 vulnerabilidades moderadas en dependencias existentes. No se ejecutó audit fix ni se acredita resolución. Build avisó de JS >500 kB (839,30 kB, gzip 235,04 kB). |
| GPA-ORG-A, 13-11-2026 | Codex, copia verificada de la base | Revisión documental y estática; las comprobaciones exactas y el parche se entregan en el informe externo de esta fase. Sin suite, lint, build, audit ni recorrido manual nuevos. |

Las 598 pruebas y el audit sin vulnerabilidades de `98addbc` (29-10-2026)
son resultados históricos de esa versión. No describen la base actual.
No se suman pruebas de diferentes entregas ni se certifica seguridad actual
a partir de un audit antiguo.

### Confirmaciones manuales posteriores conservadas

[WORK_STATUS.md](WORK_STATUS.md) registra confirmaciones de Dirección con su
alcance original: Student Loan/Test Delete; Bills 2A y End Subscription;
UX-01 A–C; UX-02.1/F1 en Safari/iPhone; UX-04.1 T1–T11 en Chrome/Windows y
Safari/iPhone, solo Demo y modo claro (10-11-2026).
No equivalen a una regresión manual completa sobre `478bacc`.
R1/R2 no aportan nueva confirmación manual; sus guiones siguen pendientes
mientras Dirección no confirme expresamente esos recorridos.

## Pendiente y límites vigentes

- Pendientes históricos todavía abiertos: O2/O3 de Bills, N1–N3 de 2A.1,
  heurística de teclado, MarkPaid intermitente, observaciones UX-02.1 y QA física.
  Ver [Conservación de WORK_STATUS](ORGANIZATION.md#conservación-de-work_status),
  fila «Pendientes no trasladados íntegramente». No se declaran resueltos sin evidencia.

- Los datos locales y las exportaciones permanecen **sin cifrar**. Ocultar
  importes cambia la presentación; no es cifrado ni control de acceso.
- Duo comparte un espacio en un dispositivo; no ofrece permisos privados por
  miembro ni sincronización. Create Account / Log In son previews con campos
  deshabilitados (`src/features/welcome/AuthPreview.tsx`).
- R3: contrato transversal para operaciones con déficit o disponibilidad
  desconocida, pendiente según Dirección y R2. No se considera resuelto por R1/R2.
- R4: distribución/reportes de archivadas, advertencias y privacidad integral.
  R5: integración de Restore y flujos UI; UX-05.5-S: experiencia visual.
  Son dependencias registradas en R2, no tareas autorizadas por este documento.
- Delete conserva el riesgo de pérdida de trazabilidad descrito en R1/R2.
  No se ha implementado recuperación automática de anomalías históricas.
- Audit: quedan los 10 avisos moderados comunicados en R2 y la advertencia de
  bundle grande; no se ha evaluado de nuevo su estado ni mitigación.
- Las limitaciones heredadas y las confirmaciones históricas de abajo se
  conservan para no dar por corregida una incidencia sin evidencia.

## Próximos incrementos y decisiones

1. UX-05.5-R3, sujeto a su encargo y autorización específicos.
2. Evaluación organizativa, identidad híbrida, gestión de tareas, seguridad e
   infraestructura según [ORGANIZATION.md](ORGANIZATION.md). Sin crear todavía
   carpetas, tableros ni servicios.
3. Cuentas, sincronización multidispositivo, permisos Duo, cifrado, IA/voz y
   wearables permanecen como evaluación o visión futura, sin implementación
   autorizada en GPA-ORG-A.

## Registro heredado: lectura por versión

Las tablas siguientes se conservan del STATUS de `98addbc`, fechado
29-10-2026. No se han repetido en esta fase. «Confirmado» significa únicamente
la confirmación histórica de Juan para ese recorrido; no su validación en la
base actual. Los pendientes solo se cierran con evidencia del incremento pertinente.

## Validación manual histórica de octubre

### Guardado asíncrono en IndexedDB (parche 04)

| Recorrido | Chrome | Safari / iPhone |
| --- | --- | --- |
| Recargar y conservar el espacio | Confirmado | Sin confirmar |
| Conflicto entre dos pestañas y Open Latest Version | Confirmado | Sin confirmar |
| Download Backup y Restore Backup | Confirmado | Sin confirmar |

La demo también se probó en ventanas privadas, sin indicar en qué navegador.

### Otras pestañas y recuperación (parche 05)

| Recorrido | Chrome | Safari / iPhone |
| --- | --- | --- |
| S1 Dos pestañas con el mismo espacio | Sin confirmar | Sin confirmar |
| S2 Actualización automática con aviso, en la misma pantalla | Confirmado | Sin confirmar |
| S3 y S5 Formulario escrito: se conserva, aviso de conflicto, no se guarda | Confirmado | Sin confirmar |
| S4 y S6 Copy What I Typed y Open Latest Version con confirmación | Confirmado | Sin confirmar |
| S7 Borrado en otra pestaña con un formulario escrito | Confirmado | Confirmado |
| S8 Formulario cerrado como «(closed)» | Confirmado | Sin confirmar |
| S9 Discard and Close con confirmación y Welcome tras recargar | Confirmado | Confirmado |
| S10 Borrado en otra pestaña sin nada escrito | Sin confirmar | **Pendiente** |
| S11 Comprobación al volver a la pestaña | Sin confirmar | Sin confirmar |

### Demo desde Settings (parche 05b)

| Recorrido | Chrome | Safari / iPhone |
| --- | --- | --- |
| D2.1 Entrar, cambiar, Reset Demo y salir: todo lo propio sigue igual | Confirmado | Confirmado |
| D2.2 Recargar después: sigue el espacio propio | Confirmado | Confirmado |
| D2.3 Borrador de New Goal: pregunta, Copy y Keep Editing | Confirmado | Confirmado |
| D2.4 Discard and Open Demo: el borrador no entra ni vuelve | Confirmado | Confirmado |
| D2.5 Exit Demo con algo escrito en la demo | Confirmado | Confirmado |
| D2.6 Otra pestaña guarda durante la demo | Confirmado | Confirmado |
| D2.7 Otra pestaña borra durante la demo | Confirmado | Confirmado |

La pantalla de recuperación, Use Older Copy y Download Both Copies necesitan
datos dañados a propósito. Solo están probados con las pruebas automáticas y en
Chromium.


Las limitaciones siguientes son las registradas en octubre. **Requieren
reconciliación con el código actual antes de afirmarlas como defectos presentes
o resueltos.** Se conservan como lista de comprobación; los guiones antiguos
que mencionan Data, la barra de pestañas o la antigua Home pueden haber cambiado.

## Limitaciones heredadas que requieren nueva comprobación

- **Sin cifrado.** Los datos, Download Backup y Download Both Copies están sin
  cifrar. Ocultar importes solo cambia lo que se ve.
- **Barra de pestañas:** salir de un formulario con ella descarta lo escrito
  sin preguntar, salvo New Goal y Welcome Setup. Ver la decisión pendiente más
  abajo.
- **Avisos no fijos:** los avisos de otras pestañas aparecen arriba, en el
  flujo de la página (decisión de producto). Si se está desplazado hacia abajo,
  se ven al subir o al intentar guardar.
- **Actualización automática:** las pantallas se montan de nuevo. Se conservan
  la pantalla, el mes y las vistas de Data, History y Bills, pero se pierde el
  estado pequeño de cada pantalla (por ejemplo, el modo Spent/Planned de Home).
- **Demo desde Welcome con una operación pendiente:** el botón no hace nada
  durante esa fracción de segundo y no lo explica.
- **Al salir de la demo**, el Home propio empieza arriba.
- **Restore Backup** no comprueba todavía que la copia sea del mismo tipo de
  espacio (Individual o Duo), ni limita el tamaño del archivo.
- **Copias en el portapapeles:** en `http://` de la red local el navegador no
  deja copiar. Aparece el recuadro para copiar a mano.


Otros pendientes históricos de octubre: P1–P5 (recuperación, cifrado local,
formato de backup y analítica), tamaño/tipo de espacio en Restore Backup y
retirada de `createLocalStore`. No se certifica su resolución ni se autoriza
su modificación aquí. El formato de backup sí evolucionó como se indica arriba;
eso no demuestra que todos los pendientes de recuperación estén resueltos.
