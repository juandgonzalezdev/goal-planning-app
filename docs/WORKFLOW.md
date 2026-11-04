# Flujo de trabajo entre Juan, Codex y Claude

Las reglas comunes están en [AGENTS.md](../AGENTS.md). Este documento describe
cómo llevarlas a la práctica. [WORK_STATUS.md](WORK_STATUS.md) conserva el estado,
las confirmaciones y los pendientes; no se duplican aquí.
[DEVELOPMENT.md](DEVELOPMENT.md) describe las herramientas y los recorridos técnicos.

## Secuencia de una tarea

1. **Alcance de Juan.** Identificar el resultado esperado, archivos permitidos,
   exclusiones y criterios de aceptación. Consultar WORK_STATUS.md y el estado
   de Git según el acceso real, siguiendo AGENTS.md.
2. **Implementación y pruebas de Codex.** Codex actúa como editor en el flujo
   habitual. Implementa el alcance y entrega
   un diff identificable junto con las comprobaciones necesarias.
3. **Revisión de Claude.** Tras el aviso de Juan, Claude lee la entrega fija,
   en el rol y con las limitaciones de acceso definidos en AGENTS.md.
   Señala errores y riesgos con
   referencias a archivos y líneas, efecto observable y reproducción propuesta.
   Distingue hallazgos de inspección, hipótesis y resultados recibidos del editor.
   Escribe únicamente el informe acordado; Juan avisa a Codex cuando está listo.
4. **Correcciones.** El mismo editor resuelve los hallazgos y comunica para cada
   uno la corrección y su evidencia, o el motivo por el que sigue pendiente.
   El revisor inspecciona el diff actualizado recibido. Un cambio de alcance
   vuelve a Juan antes de implementar trabajo que no esté autorizado.
5. **Prueba manual breve de Juan.** Entregar un recorrido corto y concreto con
   datos ficticios, pasos y resultado esperado, centrado en el cambio y sus
   riesgos. Registrar el resultado con las reglas de atribución de AGENTS.md.
6. **Integración autorizada.** Entregar el resultado revisado y las limitaciones
   antes de la decisión de Juan. El editor ejecuta solo las operaciones
   autorizadas conforme a AGENTS.md, con la lista de archivos revisada,
   y comunica el estado final de Git.

## Entrega entre asistentes

Cada entrega debe ser autosuficiente y contener:

| Dato | Contenido mínimo |
| --- | --- |
| Tarea y alcance | Identificador, objetivo, editor, revisor y exclusiones. |
| Rama y base | Nombre de rama y hash de la base: comprobados directamente si hay acceso a Git; si no, atribuidos al estado proporcionado por el editor. |
| Contenido | Archivos y comportamiento cambiado; diff o commits exactos. Distinguir cambios preparados, sin preparar y archivos nuevos. |
| Comprobaciones | Comandos o recorridos realmente ejecutados, resultado, fecha y contenido al que corresponden. Separar resultados propios, comunicados por Juan y procedentes de otras entregas. |
| Limitaciones | Qué no se ejecutó, incidencias abiertas, riesgos y pruebas manuales pendientes. |
| Siguiente paso | Quién debe actuar, qué revisar o probar y qué autorización falta. |

Codex proporciona el estado de Git comprobado y fija cada entrega a un commit
final completo, con su base exacta. Si todavía no hay commit, no se anuncia como
entrega fija: el trabajo queda en curso hasta que Juan autorice guardarlo.
Aplicar las reglas de alcance y datos de AGENTS.md.

## Entregas e informes con acceso local

El acceso confirmado está documentado en
[claude-local-access.md](../review-deliveries/claude-local-access.md).
Se trabaja directamente en `review-deliveries/`, sin exigir ZIP ni adjuntos
cuando ambos asistentes puedan acceder. Esta ubicación sustituye a
`docs/reviews/` para las nuevas revisiones locales; los paquetes anteriores
conservan su valor como entregas históricas.

Para cada tarea, Codex crea `review-deliveries/<tarea>/<commit-final-completo>/`:

- `DELIVERY.md`: la entrega autosuficiente de la tabla anterior y la ruta
  exacta en la que Claude debe escribir su informe.
- `GIT_STATUS.md`: estado, rama, HEAD, base y contenido preparado comprobados
  por Codex, con fecha y límites de la consulta. Los cambios locales ajenos
  a la entrega se identifican y no se incluyen en el snapshot revisado.
- `changes.diff`: diff completo base..final, incluidos archivos nuevos.
- `files/`: copias de los archivos cambiados obtenidas del commit final;
  cualquier archivo adicional necesario se obtiene del mismo commit.

Codex deja fijos los archivos de entrega. Si cambia el contenido, crea otra
entrega con el nuevo commit final, sin sobrescribir la anterior. Claude revisa
esas copias y ese diff, aunque el código de la carpeta de trabajo haya avanzado.
No se incluye `review-deliveries/` en commits de la app por iniciativa propia.

La única escritura de Claude para esa revisión es
`review-deliveries/<tarea>/<commit-final-completo>/REVISION.md`. Codex no edita
ese informe: resuelve los hallazgos en código y devuelve una nueva entrega.
El informe identifica autor, fecha, alcance base..final y limitaciones.
Cada hallazgo incluye prioridad, referencia, problema, efecto y comprobación
propuesta. La entrega posterior relaciona cada hallazgo con su resolución.

Juan comunica que la entrega está lista indicando la ruta, y después que la
revisión está lista indicando la ruta del informe. No se presupone que los
asistentes compartan conversaciones ni se envían mensajes entre ellos por
iniciativa propia. Antes de revisar, Claude comprueba que puede leer los archivos
indicados. Si pierde acceso, lo comunica a Juan; un adjunto queda como alternativa,
no como requisito del flujo local. Codex tampoco da por leído un informe que
no haya abierto.

## Comprobaciones sin repeticiones innecesarias

Aplicar la regla de reutilización de resultados de AGENTS.md. El editor consulta
DEVELOPMENT.md para los comandos y empieza por las pruebas afectadas cuando
la corrección es localizada. Si procede una suite completa por el alcance o
riesgo del cambio, usa `npm test -- --maxWorkers=2` y explica por qué.
La entrega registra las comprobaciones pendientes y cualquier bloqueo, como
un timeout del navegador. El informe del revisor analiza esa evidencia recibida.

## Trabajo pausado y cambios separados

Seguir la regla de pausa y preservación de AGENTS.md. El editor con acceso a Git
verifica la separación usando consultas con `GIT_OPTIONAL_LOCKS=0`: compara
antes y después la lista y el diff preparados y, cuando se exige conservar
exactamente el índice, su huella. Entrega el diff sin preparar por separado,
incluyendo los archivos nuevos. El revisor recibe esos resultados identificados
como comprobaciones del editor; no se le encarga verificar el índice local.
WORK_STATUS.md sigue siendo el registro de estado, sujeto al alcance autorizado.
