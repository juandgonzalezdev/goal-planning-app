# GPA-ORG-B1.1 — Informe de reconciliación (entrega documental propuesta)

**Fecha:** 13-11-2026\
**Versión:** R2 (correcciones A1/A2/M1 y observaciones adicionales de la revisión independiente de Claude)\
**Base fija:** `3895e2dd469601db4a707ece6ad414641c4a35fb`\
**Modalidad de preparación (R1/R2, histórica):** lectura remota del contenido versionado en GitHub y elaboración de los documentos fuera del repositorio, sin escrituras en GitHub ni en el repositorio Windows y sin pruebas automáticas/manuales nuevas. Su copia posterior a `docs/` y cualquier integración están sujetas a autorización de Dirección.

## 1. Objeto y alcance

Contrastar la documentación de Bills 2A, UX-04.1 e idiomas con el registro de estado aprobado en GPA-ORG-A. Esta revisión constituye **reconciliación documental parcial**, no cierre de todos los pendientes; incorpora los hallazgos de la revisión independiente del 13-11. El historial completo no se auditó línea por línea. Se conserva completo `docs/WORK_STATUS.md`; sus secciones mantienen el estado y permisos correspondientes a sus fechas.

Fuentes primarias: `docs/ORGANIZATION.md`, `docs/STATUS.md`, `docs/PRODUCT_VISION.md`, `docs/WORK_STATUS.md`, `docs/WORKFLOW.md`, `docs/FINANCIAL_RULES.md`, `docs/BILLS_2A_CLOSURE.md`, `docs/INCREMENT_2A.md`, `docs/UX_04_1.md`, `docs/UX_05_5_R1.md`, `docs/UX_05_5_R2.md` y `src/i18n/languages.ts`, leídos o contrastados en la base fija. La inspección de esta fase no equivale a una auditoría de todos los archivos de código.

## 2. Reconciliación Bills 2A

### Evidencia verificada

- `INCREMENT_2A.md` documenta aceptación de Dirección de recorridos principales: alta/edición mensual, anual y única, importes desconocidos, pagos e History, transiciones Paid→Pending→Paid, historial protegido, cancelación, aviso Delete, PDF, navegación móvil Safari/iPhone, modo oscuro, teclado y VoiceOver.
- El documento **excluye expresamente** la afirmación de pruebas manuales de todos los subpasos: Chrome a 390 px, concurrencia real entre pestañas y Delete confirmado, entre otros.
- `BILLS_2A_CLOSURE.md` registra la revisión histórica «Approved with observations» y 39/39 dirigidas, suite anterior O1 920/920 (no se suma ni se atribuye como ejecución de esta fase).
- **Bills 2A-O2** permanece hipótesis no reproducida: podría anunciarse éxito tras no-op cuando cambia el calendario en otra pestaña; el análisis histórico no encontró consecuencia de integridad. **Bills 2A-O3** es limpieza de textos genéricos, sin efecto funcional acreditado.
- **2A-N1–N3:** Ends en More, nombre «More details» y ayuda Start month fueron corregidas el 05-11. La aceptación principal de 2A tiene exclusiones explícitas.
- **2A.1-N1–N3 (distintas y abiertas):** texto «Status as of», texto «is ended in this app» y Active sin End Subscription cuando no hay cargos elegibles. Figuran como notas menores no bloqueantes en `INCREMENT_2A1.md` y `WORK_STATUS.md`; no se confunden con 2A-N1–N3.
- Bills 2A está integrado en `main` (`4112c23`, comprobación de Claude); 2A.1 figura en `4d23540` y `00bae6c`, según su verificación. Estos commits no amplían las pruebas manuales originales.
- Otras limitaciones conocidas: payment heredado en mes pausado visible/contabilizado sin UI para quitarlo, y estado Active conservado en mes inicial tras cancelar antes del primer cargo.
- Las propuestas aprobadas de barra flotante, búsqueda All Bills, selector 360° y End Subscription tienen desarrollos posteriores identificados; Pause/Resume completo, rediseño PDF y nombres descriptivos de descarga requieren cotejo antes de afirmarse implementados.

### Veredicto B1.1

**Aceptación principal documentada; pendientes delimitados.** No volver a abrir toda la implementación de Bills 2A, pero tampoco declarar Bills 2A-O2/O3, casos de concurrencia, todos los guiones de frecuencia o accesibilidad de versiones posteriores como cerrados.

**Verificación faltante:** comparar pruebas actuales de `PaymentIntegrity`, `BillForm` y UI; reproducir 2A-O2 con dos pestañas y datos ficticios antes de clasificarla como defecto; conciliar separadamente 2A.1-N1–N3 y las limitaciones históricas. No ejecutar sin autorización funcional.

## 3. Reconciliación UX-04.1 / Ring-first

### Evidencia verificada

- El informe `UX_04_1.md` documenta aprobación A+C y aceptación manual **T1–T11 el 10-11-2026**, sobre la Demo en commit `3a12cbc`, Chrome/Windows y Safari/iPhone, en modo claro.
- El mismo informe registra sin cobertura manual el modo oscuro, la limitación de Coming up, opciones de Home y acciones propias de sectores diferentes de Bills. Además, Customize Home no se ofrece con anillo; el importe oculto se confirma sin mostrarlo, y la fecha «hoy» solo se propone en Review de Home.
- **Integración confirmada por Claude mediante Git:** `3a12cbc` es antecesor de `3895e2d`; seis archivos clave no variaron y cuatro evolucionaron en i18n/Getting Started, según su comparación. El informe original se redactó antes del merge; su «pendiente de integrar» era histórico.
- `STATUS.md` de GPA-ORG-A indica presencia de Ring-first Home en la base, pero deja explícito que su inspección es estática y no certifica todos los recorridos.
- `PRODUCT_VISION.md` mantiene principios Ring-first y una tabla de roadmap que advierte ser histórica para el estado de implementación.

### Veredicto B1.1

**UX-04.1 integrado en `main` (`3a12cbc`, comprobación de Claude); aceptación manual T1–T11 conservada con alcance original.** La comparación de contenido de los archivos fue selectiva, no una regresión completa de `3895e2d`. No anular la aceptación válida de Demo, ni ampliarla a todas las rutas, temas, código posterior o datos reales.

**Verificación faltante:** confirmar mediante pruebas dirigidas si los límites descritos siguen existiendo y cubrir modo oscuro en entorno físico cuando se autorice. Mantener además como pendientes UX-03-H2, la revisión visual del rebote, Safari/iPhone con VoiceOver y riesgos de persistencia HomeLayout (UX-03 integrado según Claude en `7800dac`). No introducir rediseño dentro de B1.1.

## 4. Reconciliación idiomas B1/B1.1/B1.2

### Evidencia verificada

- El historial `WORK_STATUS.md` registra B1.2 desde copia aislada de `feature/b1-i18n` con base `acadbac`, con cambios del selector Welcome, campos Duo y formatos de fecha. Comunica suite 1.142/1.142, lint y build correctos **en esa copia**.
- **Contenido integrado en main**, según verificación por ascendencia y código de Claude: commit `563b714` (fundación multilingüe y ajustes B1.2). Existen pruebas de nombre Duo, años 0001/0099 y selector compacto. No existe comparación byte a byte del paquete `b1-2-final-review.patch` externo.
- La revisión visual de B1.2 no pudo completarse y deja pendientes anchos 320/360/375/390 px, teclado real y lector de pantalla.
- `src/i18n/languages.ts` de `3895e2d` declara tres idiomas `en`, `es`, `pl`, pero `READY` habilita para selección general solo inglés (`en: true`, `es: false`, `pl: false`). Los idiomas restantes pueden estar disponibles mediante preview o selección conservada.
- `STATUS.md` describe los catálogos como parciales y no certifica traducción completa.

### Veredicto B1.1

**Contenido B1.2 integrado en `main` mediante `563b714` según revisión independiente Git; ES/PL aún no disponibles generalmente.** Los resultados de la copia aislada no certifican aceptación manual ni igualdad byte a byte con el paquete externo.

**Verificación faltante:** revisión de completitud de traducciones y textos accesibles; aceptación manual en 320/360/375/390 px, teclado y lector reales. No activar ES/PL por esta revisión.

## 5. Integridad financiera y otros límites que no deben perderse

- R1 y R2 constan como integrados por `STATUS.md`; sus informes originales pertenecen a entregas históricas y no se reescriben. Se mantiene la distinción entre restauración de dominio (R2) y UI Restore (R5).
- R3 (déficit/desconocido) sigue siendo trabajo separado de **prioridad crítica funcional**, primero entre próximos incrementos funcionales según `STATUS.md`. El orden de revisión documental no lo desplaza. Ni este registro ni GPA-ORG-B autorizan modificar reglas financieras.
- R4 (visibilidad/reportes de archivadas), R5 (UI), UX-05.5-S (diseño visual) y riesgo de Delete siguen pendientes **sin suponer dependencia obligatoria entre R3 y R4**. Recuperación histórica de duplicados/estados inválidos también está pendiente, de forma distinta de Delete.
- La preferencia «Debts» fue comunicada por Dirección el **11-11-2026** en conversación, no en un acta normativa del repositorio. Claude identificó además la referencia externa `increments/evolucion-ux-i18n/fase-a/FASE-A-AUDITORIA-Y-PLAN.md`, §1.7, conflicto C2; no se dispone de ese archivo para validación independiente aquí, por lo que C2 continúa abierto. El código ya usa «Debts» en Getting Started, ayuda, PDF y aria-label de Home (verificación de Claude), pero anillo/Money y `PRODUCT_VISION.md` mantienen «Cards & Loans». Se requiere registrar alcance específico antes de editar visión protegida, interfaces o identificadores de dominio.
- R2 comunicó **10 avisos moderados** sin distinguir producción/desarrollo. Registros anteriores comunicaron **12 moderados en desarrollo, 0 de producción**, otros **0 producción** y auditorías incompletas por `ENOTFOUND`. Son resultados distintos por fecha/alcance, **no un audit actual** ni prueba de vulnerabilidades de producción. No se ejecutó escaneo nuevo.

## 6. Riesgos de una consolidación prematura

| Riesgo | Impacto | Medida de control |
| --- | --- | --- |
| Interpretar «pendiente de merge» en un informe de noviembre como situación actual | Duplicar trabajo o revertir progreso | Fechar cada evidencia y asociarla a commit concreto |
| Tratar resultados de una copia aislada como QA de `main` | Publicar estados lingüísticos incorrectos | Identificar fuente y entorno; exigir comparación y validación nueva |
| Dar por reproducida Bills 2A-O2 | Abrir una corrección sin defecto demostrado | Ensayo dirigido y conservar la clasificación de hipótesis |
| Eliminar/reescribir `WORK_STATUS.md` | Perder autorizaciones y decisiones históricas | Preservar íntegro; nueva matriz como índice, no sustituto |
| Duplicar `PRODUCT_VISION` o `FINANCIAL_RULES` | Fuentes normativas contradictorias | Enlaces, no duplicación de reglas |
| Crear nuevas carpetas/Issues antes de aprobación | Confusión del estado oficial y publicación no deseada | Entrega aislada, revisión y permiso separado |

## 7. Propuesta de decisión para Dirección

1. **Mantener** esta matriz como documento auxiliar no normativo, sin sustituir fuentes oficiales; su integración queda sujeta a autorización y verificación local específicas.
2. Priorizar un encargo técnico específico para **UX-05.5-R3**, separado de la reorganización.
3. Completar reconciliación de **Bills 2A-O2/O3 frente a 2A.1-N1/N2/N3**, y resolver las notas de UX-01 A (teclado/VisualViewport) y UX-02.1; registrar cobertura física por versión. La integración Git de UX-04.1/B1.2 ya fue contrastada por Claude: no repetirla como tarea sin causa.
4. Registrar aparte las limitaciones de Bills y UX-04.1, pendientes UX-03/H2 y el uso mixto de «Debts»; después determinar ubicación definitiva del registro y creación eventual de `product/`.
5. Evitar de momento edición de `docs/STATUS.md`, `docs/WORK_STATUS.md`, `docs/PRODUCT_VISION.md`, reglas financieras y cualquier archivo `src/`.

## 8. Evidencia y límites de esta entrega

- **Ejecución original:** lectura de archivos versionados mediante GitHub connector, anclada al commit `3895e2d`, sin acciones de escritura. **Revisión independiente aportada:** Claude clonó el repositorio en contenedor de solo lectura y verificó ascendencia, commits y archivos; esos resultados son de Claude, no de esta ejecución.
- **Archivos preparados:** únicamente dos Markdown derivados de R2, elaborados fuera del repositorio y copiados después como `docs/BACKLOG_TRACEABILITY.md` y `docs/BACKLOG_RECONCILIATION.md`; originales R1 y R2 preservados. Las correcciones R2-1 a R2-5 se contrastaron en la revisión independiente final de Claude (13-11-2026, Approved with observations; `REVISION-GPA-ORG-B1-1-FINAL.md`, entrega externa).
- **No realizado en esta corrección:** suite, lint, build, navegador, pruebas físicas, nuevo audit de dependencias, diff o inspección del índice local Windows, commit/merge/push/deploy, creación de GitHub Project o Issue. No se han comparado bytes del paquete externo B1.2. La comparación Git mencionada pertenece a Claude.
- **Revisiones independientes:** Claude emitió **Approved with observations** sobre R2 (`REVISION-GPA-ORG-B1-1-R2.md`) y en la revisión independiente final de esta versión (`REVISION-GPA-ORG-B1-1-FINAL.md`), ambas el 13-11-2026 y entregadas fuera del repositorio. Las correcciones posteriores de O1 (líneas 6, 96 y 98 de este documento y línea 7 de `BACKLOG_TRACEABILITY.md`) las realizó Claude con autorización de Dirección y todavía no cuentan con una nueva revisión independiente. Incorporación, commit, merge, push y despliegue siguen sujetos a autorización y comprobación separadas.

## Control de hallazgos de la revisión independiente

| Hallazgo | Tratamiento R2 |
| --- | --- |
| A1 | Dos filas distintas 2A-N1–N3 corregidas / 2A.1-N1–N3 abiertas; IDs prefijados. |
| A2 | Añadidas filas UX-01A-KEYBOARD, UX-021-OBS, QA-FISICA; matriz declarada parcial. |
| M1 | UX-04.1 y B1.2 integrados, con commits y límites manuales originales. |
| M2 | Bills 2A `4112c23`, limitaciones y dirección UX histórica diferenciada. |
| M3 | «Debts» fechado, atribuido a Dirección, uso mixto y falta de acta en Git. |
| M4 | UX-03 commit `7800dac`, H2, rebote, Safari/VoiceOver, HomeLayout. |
| B1–B6 | R3 crítico; R4 independiente; audit contextualizado; límites Home; base STATUS y UX-05.5-S/recuperación histórica. |

## Reproducción de la verificación de commits

Las comprobaciones de ascendencia fueron **atribuidas a Claude** en su segunda revisión; aquí no se ejecutaron sobre el Git local de Windows. Se pueden reproducir en una copia del repositorio cuyo HEAD sea `3895e2d` mediante `git merge-base --is-ancestor <commit> 3895e2d` y comprobando `$LASTEXITCODE` (0 = antecesor). Commits citados: `4112c23`, `4d23540`, `00bae6c`, `7800dac`, `3a12cbc` y `563b714`. La ascendencia por sí sola no certifica cobertura manual ni correspondencia byte a byte con parches externos.

## Fuentes versionadas

- [Organización](https://github.com/juandgonzalezdev/goal-planning-app/blob/3895e2d/docs/ORGANIZATION.md)
- [Estado](https://github.com/juandgonzalezdev/goal-planning-app/blob/3895e2d/docs/STATUS.md)
- [Historial](https://github.com/juandgonzalezdev/goal-planning-app/blob/3895e2d/docs/WORK_STATUS.md)
- [Visión](https://github.com/juandgonzalezdev/goal-planning-app/blob/3895e2d/docs/PRODUCT_VISION.md)
- [Reglas financieras](https://github.com/juandgonzalezdev/goal-planning-app/blob/3895e2d/docs/FINANCIAL_RULES.md)
- [Bills 2A](https://github.com/juandgonzalezdev/goal-planning-app/blob/3895e2d/docs/INCREMENT_2A.md)
- [Cierre Bills 2A](https://github.com/juandgonzalezdev/goal-planning-app/blob/3895e2d/docs/BILLS_2A_CLOSURE.md)
- [UX-04.1](https://github.com/juandgonzalezdev/goal-planning-app/blob/3895e2d/docs/UX_04_1.md)
- [R1](https://github.com/juandgonzalezdev/goal-planning-app/blob/3895e2d/docs/UX_05_5_R1.md)
- [R2](https://github.com/juandgonzalezdev/goal-planning-app/blob/3895e2d/docs/UX_05_5_R2.md)
- [Configuración de idiomas](https://github.com/juandgonzalezdev/goal-planning-app/blob/3895e2d/src/i18n/languages.ts)
