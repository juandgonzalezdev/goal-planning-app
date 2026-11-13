# Coordinación de Goal Planning App

Reglas comunes para colaboradores y asistentes. Dirección (Juan) define el
alcance y autoriza decisiones. Lee [docs/STATUS.md](docs/STATUS.md) para el
estado vigente y la documentación pertinente antes de editar.
[docs/WORK_STATUS.md](docs/WORK_STATUS.md) conserva el historial fechado:
sus autorizaciones, rutas y pendientes antiguos no son instrucciones actuales.
El procedimiento está en [docs/WORKFLOW.md](docs/WORKFLOW.md); la organización
y las decisiones preparatorias, en [docs/ORGANIZATION.md](docs/ORGANIZATION.md).

## Roles y acceso real

- Codex es el editor habitual; Claude realiza revisión independiente cuando se
  le asigna. Otros colaboradores pueden participar con permisos específicos.
  Una asignación expresa puede cambiar el editor; las herramientas no fijan el rol.
- Un solo editor por conjunto de archivos. Ningún revisor modifica implementación,
  pruebas, documentación común, entregas ajenas o índice sin autorización.
  Su informe se escribe únicamente en la ubicación acordada.
- Comprueba las capacidades de cada sesión. No presupongas acceso compartido al
  disco, Git, archivos, conversaciones o comandos. Leer HEAD no verifica el
  árbol de trabajo ni el índice. Un acceso confirmado antes no acredita el actual.
- Si falta acceso, informa del límite y usa una copia de base verificable o
  material recibido, identificando su procedencia. Nunca inventes un repositorio,
  resultados ni cambios en el ordenador de Dirección.
- Dirección comunica las entregas y revisiones. No automatices intercambios entre
  asistentes ni envíes mensajes a terceros sin una autorización específica.

## Git y protección del trabajo

- Con acceso a Git, antes de trabajar comprueba rama, HEAD, estado con archivos
  sin seguimiento, diff sin preparar y diff preparado: `git branch --show-current`,
  `git rev-parse HEAD`, `git status --short --branch`, `git diff` y
  `git diff --cached`. Limita consultas con `GIT_OPTIONAL_LOCKS=0` cuando
  corresponda; distingue consultas locales de información recibida.
- Trabaja exclusivamente en la rama o copia autorizada. Conserva cambios ajenos,
  archivos ignorados y sin seguimiento; no sobrescribas, muevas, borres ni incluyas
  material ajeno. No recrees carpetas eliminadas por un procedimiento antiguo.
- Preserva el índice existente. Separa lo preparado, lo no preparado y los archivos
  nuevos. Cuando se exige preservación exacta, captura el diff preparado binario
  completo y su SHA-256 antes y después; una lista de nombres no basta.
  Detente ante una discrepancia crítica con el estado autorizado.
- No uses `git add .`, `git add -A`, operaciones destructivas, limpieza masiva,
  descarte de cambios ni reescritura del historial por iniciativa propia.
- No hagas commit, merge, push, despliegue o publicación sin autorización expresa
  para cada operación. Una entrega revisable puede existir sin commit.
  Aplicar un parche tampoco equivale a integrarlo ni a publicarlo.
- Si Dirección pausa una tarea, conserva archivos e índice y no la reanudes sin
  indicación. No amplíes el alcance para resolver mejoras vecinas.

## Datos, seguridad y dominio

- Usa exclusivamente datos ficticios en repositorio, pruebas, ejemplos, capturas
  y entregas compartidas. No incorpores información financiera personal.
- No almacenes secretos, tokens, contraseñas o claves privadas, tampoco en logs.
- Mantén aislados datos y preferencias Demo del espacio propio. Respeta
  [docs/FINANCIAL_RULES.md](docs/FINANCIAL_RULES.md) y
  [docs/STORAGE_AND_RECOVERY.md](docs/STORAGE_AND_RECOVERY.md).
  No alteres cálculos, persistencia, migraciones ni formatos sin alcance específico.
- Ocultar importes no equivale a cifrar o controlar acceso. No envíes datos
  financieros a servicios externos sin autorización específica.

## Idioma y comprobaciones

- Explica decisiones, trabajo técnico e informes a Dirección en español.
  La interfaz sigue las decisiones EN/ES/PL y su disponibilidad real; consulta
  STATUS. Conserva `Remaining Balance`, `Contribution` y `payment` y sus
  traducciones aprobadas. No cambies traducciones fuera del alcance.
- El editor ejecuta verificaciones proporcionales al cambio. WORKFLOW define
  cuándo se requieren; [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) aporta comandos
  técnicos y recorridos, algunos históricos.
- Identifica fecha, versión, responsable y entorno de cada resultado.
  Separa ejecución propia, informe de otro asistente y confirmación de Dirección.
  Reutiliza resultados del mismo contenido y entorno; repite si un cambio, fallo,
  riesgo o instrucción lo justifica. No repitas toda la suite por un relevo.
- Una prueba manual solo está confirmada cuando Dirección lo expresa para ese
  recorrido y versión; no extiendas la confirmación a otros dispositivos o temas.
- Entrega diff completo, informe, verificaciones y pendientes según WORKFLOW.
  Hasta una decisión posterior de Dirección, STATUS es la referencia del estado
  operativo vigente; los informes de cada incremento conservan el detalle de
  pruebas y decisiones. WORK_STATUS permanece como historial y solo se amplía
  con autorización expresa de Dirección.
