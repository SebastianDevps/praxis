# Dossier: Praxis hacia un harness tipo "software factory"

Fecha: 2026-10-21. Tres informes de subagentes, sin editar. Toda cifra lleva fuente.

---

## Informe 1 — Flujo actual de una feature en Praxis vs. pipeline objetivo

Repo: `/Users/sebasing/Projects/PluginClaude/praxis` (main, 0.9.0). Rutas relativas a esa raíz. Solo hechos; sin veredictos.

### 1. Flujo actual de una feature

- Entrada: `/praxis:feature` es un disparador fino hacia `pipelines/feature.md` (`commands/feature.md:5-9`). Fases `new → research → design → plan → implement` (`pipelines/feature.md:5-10`). Ejecutores declarados: `new` y `plan` = orquestador; `research` = `researcher` + `scout` + `docs-seeker`; `design` = agente `design` (+ `strategy-compare`); `implement` = `engineer` con fan-out a `backend`/`design`/`security` (`pipelines/feature.md:21-25`). El pipeline es prosa: ningún hook lee sus fases; el vocabulario que sí gobierna es `define·plan·build·verify·review·ship` de `docs/task-model.md:110-121`, con `full` = `plan→build→verify→review` y `deep` = las seis (`task-model.md:126-130`).
- Artefactos en `specs/<change>/`: `design.md`, `decisions.md`, `implementation.md` (ledger), `future-work.md`; `AGENTS.md`/`docs/` solo en deep (`skills/spec-lifecycle/SKILL.md:25-38`, mínimos por modo `:72-81`). Tabla fase→archivo en `pipelines/feature.md:31-37`. Propiedad: orquestador escribe `design.md`/`decisions.md`; los builders solo `implementation.md` (`agents/orchestrator.md:87-93`; `agents/engineer.md:49-53`).
- Quién ejecuta en la práctica: el contrato inyectado por turno manda clasificar Trivial/Substantial (`hooks/context/contract.md:12-15`), investigar (`:17-18`), preguntar una vez (`:20-21`), emitir Run Card de 5 campos (`:34-43`), delegar y fan-out (`:45-47`). El router `using-praxis` detalla el bucle de 7 pasos (`skills/using-praxis/SKILL.md:44-77`): tras la aprobación, `writing-plans` → ledger y `subagent-driven-development` (un subagente por tarea, review entre tareas: `skills/subagent-driven-development/SKILL.md:17-25`).
- Aprobación humana (única, en diseño): `hooks/pre-tool-use:191-197` responde `ask` (Claude) o `deny` (otros hosts) a la primera edición de fuente mientras no exista `.praxis/approved/<change>`; `hooks/post-tool-use:58-67` escribe ese marcador tras la edición permitida en `full`/`deep`; `scripts/approve.sh:28-35` lo escribe manualmente y rehúsa sin `design.md` (`:30`). Edit/Write al marcador se deniega (`pre-tool-use:130-134`); Bash es brecha documentada (`:23-24`). El marcador está gitignored (`hooks/lib.sh:369`). `stage:` lo escribe el modelo y "no desbloquea nada" (`spec-lifecycle:88-98`).
- Verificación: `orchestrator.md:116` ("Loop until green or escalate"); `hooks/stop:75-80` bloquea una vez si cambió fuente sin tocar `implementation.md`.
- Review: `reviewer` en dos ejes (Standards/Spec) en subagentes paralelos, veredicto `BLOCK/IMPORTANT/MINOR/clean` (`agents/reviewer.md:38-44, 141-147`), solo lectura, devuelve al engineer (`:178-180`). Panel refutador en "substantial" (`orchestrator.md:121-124`) y en el contrato solo en `deep` (`contract.md:76-85`).
- Cierre: `stage: shipped` = "merged, deployed, or handed over", escrito por el modelo (`spec-lifecycle:63-66`); línea en `PROGRESS.md` (`orchestrator.md:176`); `release-readiness` es prosa (`skills/release-readiness/SKILL.md`).

### 2. Paralelismo

- Ola de refuters: tres lentes "in one parallel wave", cuatro insumos, sin la conversación del builder (`orchestrator.md:123-133`); clasificación `contract gap / actionable / accepted trade-off / noise`, first match wins (`:142-148`); ruteo: actionable → builder, contract gap → humano, `clean` sin lista atacada → re-dispatch (`:162-168`). Reviewer: dos subagentes en una ola (`reviewer.md:42-44`). Regla general: "multiple Agent calls in one assistant turn" (`crafts/orchestration/orchestration.md`, regla "Parallel fan-out"; `orchestrator.md:76-79`).
- Espera a todos: no existe mecanismo propio; depende del `Agent` tool del host. El único hook en `SubagentStop` añade una fila a `.praxis/memory/sessions.jsonl` y solo si existe `.praxis/` (`hooks/subagent-stop:35, 105-107`); no agrega veredictos ni bloquea.
- Medido: `subagents_spawned` = 0 en las 72 celdas de `docs/eval-data/matriz.json` (derivado con script sobre el JSON); el ledger de la evaluación lo registra como no verificado (`docs/evaluacion-arquitectura-plugin.md:837`).

### 3. Loops

- `scripts/loop.sh`: `claude -p` con contexto fresco por iteración (`:257`); `MAX_ITERATIONS=20`, `MAX_DURATION=2h`, `MAX_COST` opcional, `DONE_STREAK=1`, `NO_PROGRESS_LIMIT=2` (`:34-39`); señales `NO MORE TASKS/COMPLETE`→0, `ABORT`→1, `HANG ON A SECOND` continúa (`:14-19`, `:293-315`); exit 3 si se toca un test (`:150-152, 270-273`); exit 4 por tope/reloj/costo/sin progreso (`:245-249, 328-339`). Ledger = `specs/<activo>/implementation.md` (`:110-116`). Commits con trailer `Praxis-Loop:` (`:46, 227-228`).
- `autonomous-loop` es la disciplina; el script la automatiza (`skills/autonomous-loop/SKILL.md:15-17, 59-73`). `/praxis:loop` es opt-in (`commands/loop.md:7-10`).
- Rondas review→builder: no hay tope numérico. `orchestrator.md:116` "until green or escalate"; `subagent-driven-development:22-23` "fix or re-dispatch"; `auto-loop-rulebook.md:25` "fails N times → blocked" sin N; `task-model.md:150` "failed N times". Búsqueda `round|max.?iterations|re-dispatch|re-review` en agents/crafts/commands/skills: los únicos límites numéricos son los de `loop.sh`/`loop.md`.

### 4. Modelos

- Único `model:` en el repo: `sonnet` en `agents/refuter-{correctness,security,tests}.md:5`, justificado en `:21-22` ("nobody has measured whether a heavier model finds more"). `rg '^model:'` sobre agents/skills/commands/pipelines → solo esos tres. Ningún `opus`/`haiku` en recursos; no hay ruteo por costo.
- Evals: `claude-opus-5[1m]` como default de CLI en evals/value (`evals/value/RESULTS.md:93`); `claude-sonnet-5` en la matriz (`matriz.json:3-5`). El plan de importación rechaza los 5 agentes `model: opus` de Core (`docs/plan-importacion-referentes.md:165`).

### 5. Hooks (registro en `hooks/hooks.json`)

| Evento | Mecánica |
|---|---|
| SessionStart (`hooks.json:3-14`) | inyecta router + memoria (`hooks/session-start:39-48`); escribe `.praxis/session-started` en startup/clear (`:28-37`); nunca bloquea |
| UserPromptSubmit (`:16-27`) | parsea `/praxis[:mode] <m>` y persiste el dial (`hooks/user-prompt-submit:28-35`; `lib.sh:55-78`, estado en `$HOME/.claude`); inyecta contrato filtrado por modo (`:37-44`) |
| SubagentStart (`:28-39`) | inyecta contrato subagente + crafts declarados + punteros a skills; `reviewer` recibe además reglas del proyecto (`hooks/subagent-start:27-28, 48-78, 86-103`); fail-open |
| SubagentStop (`:40-51`) | una fila JSON en `sessions.jsonl` (`subagent-stop:105-107`); inerte sin `.praxis/` (`:35`) |
| PreToolUse Edit/Write/MultiEdit (`:52-63`) | deny al marcador (`pre-tool-use:130-134`); deny comentarios tier-1 (`:141-176`); fast: deny sin `implementation.md` (`:183-188`); full/deep: `ask`/`deny` hasta marcador (`:191-197`); deny con pasos si falta diseño/ledger (`:199-212`); overrides `PRAXIS_FLOOR=off`, `PRAXIS_COMMENTS=off` (`:78, 142`); fail-open (`:76-93`) |
| PostToolUse (`:65-76`) | escribe `.praxis/approved/<change>` si full/deep, existe `design.md`, destino fuente y no hay marcador (`post-tool-use:54-67`); nunca bloquea |
| Stop (`:78-89`) | `decision: block` una vez si hay fuente cambiada tras el marcador de sesión y ningún `implementation.md` (`hooks/stop:44, 58-80`) |

Codex registra los 7 eventos (`hooks/hooks-codex.json:3-78`); Cursor solo `sessionStart` (`hooks/hooks-cursor.json:4-8`).

### 6. Merge / ship

- Ningún script, hook, comando o agente mergea, hace push ni abre PR: `rg "git merge|git push|gh pr|gh api|…"` sobre scripts/, commands/, skills/, agents/, hooks/ → una sola mención documental (`skills/dependency-adoption/references/computed-signals.md:148`). Segundo método: `rg -i "merge to main|gh pr create|needs-human|ESCALATE|APPROVE"` fuera de docs/specs/evals → solo la aprobación de diseño (`approve.sh`, `commands/approve.md`, `pre-tool-use`), prosa en `agents/security.md:61` y `auto-loop-rulebook.md:25`.
- Equivalentes de "needs-human": Run Card `Needs your decision` (`orchestrator.md:100,107`), estado `blocked(user)` en el ledger (`task-model.md:151-155`), exits 1/4 del loop (`loop.sh:262-265, 292-295, 328-331`). Ninguno es un marcador escrito por hook tras review.
- `pipelines/bug.md:30` menciona el cuerpo del PR "when one is opened": externo al pipeline.

### 7. Evals

- `evals/floor` (puntuado por orden de `tool_use` y árbol final, `evals/floor/units.mjs:1-6`): v1 18 celdas $6.93, v2 8 celdas $3.67 (`evals/floor/RESULTS.md:18`). v2: tratamiento 3/3 `PASS-stopped`, control 1/3 diseño antes de editar, pre-aprobado 2/2 construye (`:76-83, 98-108`). v1: 3/3 auto-aprobación vía `stage: planned` (`:165-172`). No medido: `hooks/stop` en `-p`, `ask` respondido en vivo (`:194-203`).
- `evals/value`: screening 4 skills sin delta (`evals/value/RESULTS.md:9-14`); unidades `tdd`, `red-first`, brutalist, investigation, comment-discipline (`evals/value/units.mjs`); el craft comment-discipline se eliminó en 0.9.0 tras 0.00 vs 0.00 (`CHANGELOG.md:9`). README: slices verticales 3/3 vs 0/3 (`README.md:208`).
- `evals/routing/cases/`: 45 YAML, uno por skill; el auditor léxico vive en la rama `measurement` (`docs/skill-doctrine.md:7-11, 87`).
- `docs/eval-data/matriz.json`: 72 registros, $10.35, `claude-sonnet-5`, 11 arms × 4 tareas (`:2-33`). Ratios de tokens vs baseline: praxis-fast 1.40/1.17/1.08/1.30, praxis-full 1.31/1.29/1.17/1.12, core 1.63 en compleja. `asked` en trampa: prompt-lifecycle 3/4, praxis-full 1/4, praxis-fast 0/4, praxis-deep 0/2, frase en system prompt 2/2. `build-matriz.mjs` re-puntúa contra el harness en `/tmp/eval/praxis-measurement` (`:9-10`); `session-metrics.mjs` deriva métricas de transcripts interactivos (`:1-12`). Logs: selftest de scorers + celdas.
- Panel refutador (agosto, rama `measurement`): detección idéntica a `reviewer-x3`, 3.65× costo (`docs/evaluacion-arquitectura-plugin.md:60, 204, 549`).

### 8. Docs nuevos (untracked)

- `docs/evaluacion-arquitectura-plugin.md` (2026-09-01, Praxis@`31b6be5` vs Matt `6654f6b6`, Addy `d2c37ef6`, Core `95dc03ba`): H1–H5 confirmadas (`:854-860`); matriz pre-registrada: podar 70 vs Matt 67, empate (`:799`); Opción 1 nominal (`:783`); tres cambios G.2 (`:807-809`); ruteo G.3: dial por proyecto, `critical-paths.md`, piso en fast (`:813-817`); testing G.4 (`:821-825`); 16 ítems no verificados (`:831-846`). Nota fáctica: analiza el SHA anterior a 0.6.0; afirma "no declara PreToolUse ni Stop" (`:34`), hoy sí existen (`hooks.json:52-89`, `CHANGELOG.md:50-52`).
- `docs/plan-importacion-referentes.md`: de Matt convenciones (`disable-model-invocation`, lista promovida, "It's working if", `tdd`, `domain-modeling`, `codebase-design`) (`:20-37`); de Addy `CONSTRAINTS.md` CDD, colocación por costo, formato de evals, paradas duras de `/build auto` (`:71-87`); de Core guard de aserciones con suite roja, runner PostToolUse, Stop con presupuesto 3, `critical-paths.md`, SCEN opcional (`:127-137, 141-153`). Descarta: `implement` de Matt, tracker-publishing, motor Python de Core, telemetría, 25 skills de Addy (`:51-59, 98-109, 155-166`). Elimina pipelines, commands, `crafts/orchestration`, loop (`:148, 179`); refuters condicionados al piloto (`:165`).
- `docs/praxis-plugin-oficial-propuesta.md` y `docs/praxis-oficial-resumen-y-features.md`: arquitectura de 5 capas (`propuesta:192-199`), poda a ~30 componentes (`:205-217`), plan de 6 bloques (`:290-297`), riesgos (`:305-320`). Features 7.1 (`resumen:175-187`).
- `docs/piloto-protocolo.md`: 3 tareas × 3 arms (CLAUDE.md solo / Matt / Praxis full) × 3 devs en cuadrado latino (`:13-39`); reglas de decisión pre-registradas (`:76-83`).
- `untitled.md`: vacío (0 líneas por `wc`, 0 bytes por `stat`).
- Estado en `main` de lo propuesto: `critical-paths`, `decisions.jsonl`, `disable-model-invocation`, `suite-state`, `in-progress/` → 0 ocurrencias fuera de docs/specs (`rg -F` y `fd -H`). Dial sigue en `$HOME/.claude` (`lib.sh:55-60`). Ya ejecutado en main tras los docs: piso de hooks y `/praxis:approve` (0.6.0), método Matt (0.7.0), eliminación del craft comment-discipline (0.9.0) (`CHANGELOG.md:5-54`).
- Referentes citados además: cal.diy (`CHANGELOG.md:50`), Fowler (`reviewer.md:75`), Huntley/ralph (`autonomous-loop:11`), doubt-driven-development de Addy y arXiv 2608.18167/2604.19049 (`docs/adversarial-review.md:82-86, 121-125`).

### 9. Brechas fácticas vs. pipeline objetivo

| Caja/flecha objetivo | Estado |
|---|---|
| feature → spec-writer (opus) | Parcial: fases `new`/`design` con `design.md` escrito por orquestador (`orchestrator.md:87-90`) o agente `design` (`pipelines/feature.md:23`); sin agente spec-writer dedicado; sin `model:` |
| builder (opus) | Parcial: `engineer` (`agents/engineer.md`), un subagente por tarea; sin `model:` |
| 4 reviewers paralelos [security opus, ux sonnet, ui design sonnet, code sonnet] | Parcial: ola de 3 refuters (correctness/security/tests, todos `sonnet`) solo en deep/substantial; `reviewer` 2 ejes; `design-review` es skill vía `reviewer` (`pipelines/design.md:23`); agente `security` sin `model:`. No existe lente UX; no existe conjunto fijo de 4; sin pin a opus |
| esperar a los 4 | No existe: sin barrera ni agregación; `subagent-stop` solo registra (`:105-107`) |
| CHANGES → resume builder (máx. 2 rondas) | Parcial: "actionable → back to the builder" (`orchestrator.md:164`); sin tope de rondas (`:116`); vocabulario `BLOCK/IMPORTANT/MINOR/clean` y `clean/findings`, no `CHANGES/PASS` |
| all PASS → approver (opus) | No existe agente aprobador post-review; la única aprobación es humana y previa al build (`pre-tool-use:191-197`, `post-tool-use:58-67`) |
| APPROVE → merge a main | No existe (dos métodos, §6) |
| ESCALATE → needs-human | Parcial: `Needs your decision`, `blocked(user)`, exits 1/4 del loop; sin marcador de hook post-review |
| `/factory approve` | Parcial: `/praxis:approve <change>` escribe `.praxis/approved/<change>` (`approve.sh:33-35`), aprueba el diseño, rehúsa sin `design.md`; no es aprobación de merge |

### Desconocidos

- Comportamiento del `ask` respondido en sesión interactiva y de `hooks/stop` en `-p`: no medidos (`evals/floor/RESULTS.md:194-203`).
- Si el host entrega el texto crudo de `/praxis:mode` al hook en sesión interactiva (`evaluacion:833`).
- Valor de crafts en subagentes: ninguna celda despachó uno (`evaluacion:837`).

### No-hallazgos (buscados, inexistentes)

- Tope de rondas review→builder: `rg` por `round|max.?iterations|re-dispatch|re-review` en agents/crafts/commands/skills + lectura íntegra de `orchestrator.md` → solo topes del loop autónomo.
- Paso de merge/PR/needs-human mecánico: dos búsquedas `rg` ortogonales (§6) → ninguno.
- `model: opus|haiku` en recursos: `rg '^model:'` + `rg -i opus|sonnet|haiku` fuera de docs/evals → solo `sonnet` en refuters.
- Mecanismos propuestos en los docs (`critical-paths`, `decisions.jsonl`, `disable-model-invocation`, `suite-state`, `in-progress/`): `rg -F` + `fd -H` → 0 fuera de docs/specs.

---

## Informe 2 — QM y Pi como sustrato de ejecución

Consulta realizada el 2026-10-21/22. Lo no verificado se lista al final.

### A) QM (yc-software/qm)

**Qué es.** "Multiplayer agent harness for work. In Slack and on the web": cada empleado y cada sala obtiene un workspace aislado con memoria, archivos, permisos, crons y un sandbox durable; corre en la nube del operador con sus modelos y claves (README: https://github.com/yc-software/qm). Es un asistente organizacional multiusuario, no un orquestador de pipelines de código.

**Quién lo mantiene.** `yc-software` es la organización GitHub de Y Combinator (`name: "Y Combinator"`, `blog: ycombinator.com`; https://api.github.com/orgs/yc-software). YC lo abrió tras usarlo internamente ("a multi-agent harness we use internally at YC"; https://x.com/ycombinator/status/2083243960684908768, texto del extracto del buscador, el post no se pudo abrir). Página oficial: https://qm.ycombinator.com/index.html. 22 contribuidores; dos concentran 1.014 de ~1.142 commits (https://api.github.com/repos/yc-software/qm/contributors). Las contribuciones externas se aceptan solo como propuestas de texto en `adrs/`, no como código (README).

**Licencia y madurez.** MIT. Creado 2026-07-29; 15.486 estrellas, 1.918 forks, 999 issues+PRs abiertos vía API (314 issues en la UI) (https://api.github.com/repos/yc-software/qm). Último release `v0.1.15` del 2026-10-20 (https://github.com/yc-software/qm/releases); `package.json` declara `version: 0.1.0` y Node ≥24.15 (https://github.com/yc-software/qm/blob/main/package.json). Actividad diaria, contrato 0.x.

**Arquitectura.** Core headless (API, identidad, política, scheduler); Postgres guarda sesiones, memoria y cola (`DATABASE_URL`, `SESSION_STORE=postgres`; sin ellos las sesiones se pierden al reiniciar) (README). El spec habla de "durable execution against a central writeahead log: the session tape" y de workers que reclaman turnos por lease desde la cola de runs (https://github.com/yc-software/qm/blob/main/docs/SPEC.md). El agente tiene "a small, fixed tool surface"; `execute` corre comandos en el sandbox del scope (README).

- *Agentes/workflows:* no hay definición declarativa de roles ni pipelines. El deployment directory (`qm.config.jsonc`, `sandbox/tools/<id>/tool.json`, `sandbox/skills/<id>/SKILL.md`, `plugins/`) configura modelo, herramientas y skills (https://github.com/yc-software/qm/blob/main/docs/deploy-directory.md).
- *Paralelismo:* **swarms**: un root spawnea hasta 32 workers (profundidad 4) con `POST /v1/swarm` (`action: spawn|send|context`), cada uno con sandbox propio y una "board computer" compartida; lectura por `GET /v1/swarm?read=1`; exige Postgres y el flag `swarms`, apagado por defecto (https://github.com/yc-software/qm/blob/main/docs/swarms.md). **Persistent subagent sessions** (`subagents.open/send_message/wait/followup_task`), máximo 10 runs pendientes por árbol, flag `persistent_subagents` apagado por defecto (https://github.com/yc-software/qm/blob/main/docs/persistent-subagent-sessions.md).
- *Gates de aprobación:* postura `Strict` ("every harness tool call pauses for human approval"), `Auto` por defecto, `Dangerous` (README). Los workers no heredan aprobaciones; el humano solicitante aprueba o deniega las pendientes (swarms.md).
- *Review loops:* no hay primitivo de revisión. Lo más cercano: `goal` con `objective`/`token_cap` en swarms y un método opcional `judge` en `HarnessModelUtilities` (https://github.com/yc-software/qm/blob/main/src/harness/harness.ts).
- *Model routing:* `MODEL_GATEWAY_URL` descubre modelos (`/v1/models` + LiteLLM `/model_group/info`) y elige protocolo por metadatos del proveedor (https://github.com/yc-software/qm/blob/main/docs/model-gateway.md); `resolveRuntimeChoice` aplica allowlist de org → default de org → override por scope (https://github.com/yc-software/qm/blob/main/src/harness/harness-router.ts).

**Relación con Pi.** Pi es uno de dos harnesses: `HARNESS_IDS = ["pi", "claude"]` (https://github.com/yc-software/qm/blob/main/src/model/pi-models.ts). `pi-harness.ts` importa `createAgentSession`, `SessionManager`, `ModelRuntime` de `@earendil-works/pi-coding-agent`, desactiva las tools nativas (`noTools: "builtin"`, `noExtensions: true`), inyecta `customTools` propias y usa `SessionManager.inMemory()` persistiendo en su tape (https://github.com/yc-software/qm/blob/main/src/harness/pi-harness.ts). `claude-harness.ts` usa `query()` de `@anthropic-ai/claude-agent-sdk` con `permissionMode: "bypassPermissions"`, tools vía `createSdkMcpServer` y hooks `PreToolUse` (https://github.com/yc-software/qm/blob/main/src/harness/claude-harness.ts). Vendoriza `pi-ai` 0.82.0 parcheado (`provider-error.patch`) y `pi-coding-agent` 0.82.0-security.6 (https://github.com/yc-software/qm/blob/main/vendor/pi-ai/README.md), muy por detrás de Pi 1.4.0.

**Para spec-writer → builder → N reviewers → approver → merge.** Tendría que construirse sobre la API de swarms: el root spawnea builder y reviewers con `contexts` distintos, coordina por mensajes y escala aprobaciones con postura `Strict`. QM aporta durabilidad, sandboxes y mensajería; la lógica de pipeline la escribe el usuario, y requiere Postgres, Slack/web y despliegue en Fly/AWS (https://github.com/yc-software/qm/blob/main/docs/getting-started.md).

### B) Pi

**Qué es.** `badlogic/pi-mono` redirige a `earendil-works/pi` (https://github.com/earendil-works/pi); Zechner se unió a Earendil el 2026-04-08 (https://lucumr.pocoo.org/2026/4/8/mario-and-earendil/). "Pi is a minimal, extensible agent harness that you can make your own" que "skips features like sub-agents and plan mode" (README). Paquetes: `pi-ai` (API multi-proveedor), `pi-agent-core` (loop + tools + estado), `pi-coding-agent` (CLI y SDK), `pi-tui`, `chord`, `pi-durable`, `codemode`. 116.988 estrellas, ~7.043 commits, MIT, v1.4.0 el 2026-10-21 (https://api.github.com/repos/earendil-works/pi; https://github.com/earendil-works/pi/releases).

**Ejecución.** Tools con esquema TypeBox + `execute`; modo `parallel` por defecto ("preflight tool calls sequentially, execute allowed tools concurrently"); colas de steering y follow-up (https://github.com/earendil-works/pi/blob/main/packages/agent/README.md). Las tools corren con los permisos del proceso Pi (https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/how-pi-works.md).

**Extensiones, skills, prompts.** Extensiones = módulos TypeScript in-process con hooks `tool_call` (bloquea o muta input), `tool_result`, `agent_settled`, y `registerTool/registerCommand` (https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md). Skills: "implements the Agent Skills specification", `SKILL.md` en `~/.agents/skills/` y `.agents/skills/` (https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/skills.md). Paquetes npm/git agrupan extensiones, skills, prompts y temas (https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md).

**Modo programático.** `-p` (texto final), `--mode json` (JSONL de eventos, una invocación), `--mode rpc` (JSONL bidireccional por stdin/stdout; `prompt/steer/follow_up/abort/fork`; fin real = `agent_settled`), y SDK `createAgentSession()` con `customTools`, `noTools`, `SessionManager.inMemory()` (https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/cli-integration.md; .../rpc.md; .../sdk.md). Flags `--tools`, `--no-extensions`, `--no-session`, `--append-system-prompt` (.../cli.md).

**Sesiones.** JSONL en `~/.pi/agent/sessions/`, árbol `id/parentId`, entradas `message|compaction|branch_summary|context_edit|...`, migración automática a v3 (https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/session-format.md).

**Subagentes.** No nativos. El ejemplo oficial define agentes en Markdown+YAML (`~/.pi/agent/agents/*.md`, `.pi/agents/*.md`); "Each subagent runs in a separate `pi` process"; paralelo "limited to 8 tasks, 4 concurrent"; modo chain (https://github.com/earendil-works/pi/tree/main/packages/coding-agent/examples/extensions/subagent). Paquetes comunitarios: `@narumitw/pi-subagents`, `@tmustier/pi-agent-teams` (https://pi.dev/packages/@narumitw/pi-subagents). `pi-durable` (experimental, separado) corre "as many conversations as you need, concurrently" con tareas checkpointeadas en SQLite/JSONL (https://earendil.com/posts/pi-durable/).

**Licencia y Anthropic.** "Pi remains MIT licensed and that will not change"; habrá piezas futuras Fair Source o cerradas (https://rfc.earendil.com/0015/). Anthropic por `ANTHROPIC_API_KEY`/`ANTHROPIC_OAUTH_TOKEN` (.../providers.md). La doc oficial de Pi no nombra Claude Pro/Max; hay paquetes de terceros (https://github.com/leohenon/pi-anthropic-oauth). Anthropic: el OAuth de suscripción está "designed to support ordinary use of native Anthropic applications"; herramientas que "misrepresent their identity" o enruten tráfico contra límites de suscripción "may be enforced against"; puede permitirse con cargo a usage credits (https://support.claude.com/en/articles/13189465-log-in-to-your-claude-account; https://code.claude.com/docs/en/legal-and-compliance). Pi + API key es la vía segura; Pi + suscripción es zona gris.

**Frente a Claude Code.** Claude Code trae subagentes nativos en `.claude/agents/`, background, `isolation: worktree`, anidamiento hasta 3 niveles y 20 concurrentes (https://code.claude.com/docs/en/sub-agents); hooks shell con `permissionDecision` que también disparan dentro de subagentes (https://code.claude.com/docs/en/hooks); plugins (https://code.claude.com/docs/en/plugins). Pi lo cubre con extensiones TypeScript, sin fan-out nativo.

### C) Opciones de integración

1. **Claude Code orquesta; Pi es worker headless.** Un hook o skill lanza `pi -p` o `--mode json --no-session --tools ...` por tarea; el ledger `specs/<change>/implementation.md` sigue siendo la verdad. Coste bajo-medio: parsear JSONL, esperar `agent_settled`, aislar cwd/worktree y credenciales. Pierde los hooks de Claude Code sobre las tools de Pi (los gates deben reimplementarse como extensión `tool_call`). Ventaja real: reviewers en otros proveedores sin pasar por `claude -p`.
2. **Pi orquesta; Claude Code es worker.** Una extensión spawnea `claude -p --output-format json --bare` (https://code.claude.com/docs/en/headless). Coste alto: reescribir agentes Markdown y hooks shell como TypeScript; se pierde la distribución como plugin.
3. **Ledger compartido en archivos.** Ambos leen y escriben `specs/<change>/` y git; cada harness corre sus roles. Coste bajo en código, alto en coordinación (locks, señales de fin). Inferido: viable porque ambas CLIs son procesos con cwd; no hay documentación que lo prescriba.
4. **QM como sustrato.** Solo si ya se despliega QM (Postgres, Slack/web, Fly/AWS); da durabilidad y mensajería, no pipeline ni review. Coste alto; descartable para un plugin local.

Inferencia global: Claude Code ya cubre fan-out, worktrees y gates; Pi aporta valor sobre todo como worker multi-modelo (opción 1). Es juicio del analista, no capacidad documentada.

### No verificado
- Texto exacto del post de YC en X (402/403); se citó el extracto del buscador.
- Que el `/login` oficial de Pi liste "Claude Pro/Max": la doc oficial no lo nombra; el extracto de npm sí, pero npm devolvió 403.
- Fechas de los bloqueos de OAuth de Anthropic: solo fuentes secundarias.
- La afirmación de aibuilderclub de cuatro runtimes (Codex/OpenCode) en QM: contradicha por `pi-models.ts` y `package.json` actuales.
- `pi-harness.ts` y `claude-harness.ts` se leyeron solo hasta los primeros 100k caracteres.

---

## Informe 3 — Procedencia del patrón "factory" y estado del arte en harnesses agénticos

Fecha de consulta: 21-oct-2026. Toda cifra lleva su URL; lo no verificado se marca como tal.

### Parte 1 — Procedencia del diagrama

**Fuente original: ZazenCodes**, video "Build Your Own AI Software Factory with Claude Code" (https://www.youtube.com/watch?v=ctoaIC4LHmI; un repost lo fecha el 7-oct-2026, dato no confirmado en la página de YouTube, que bloqueó el fetch). Código: https://github.com/zazencodes/zazencodes-season-3/tree/main/src/software-factory-claude-code. El README usa literalmente el texto del diagrama ("feature → spec-writer → builder → four reviewers → WAIT FOR ALL → approver", opus/sonnet por rol, `needs-human`, "/factory approve <job-id>: merge a needs-human job into main").

**Cómo está implementado** (SKILL.md: https://raw.githubusercontent.com/zazencodes/zazencodes-season-3/main/src/software-factory-claude-code/.claude/skills/factory/SKILL.md):
- Un skill orquestador + 7 subagentes en `.claude/agents/` + markdown. Sin hooks, sin scheduler, sin GitHub Actions. "Agents read context from files, not the conversation"; el orquestador es "the only writer of job.json" (se reescribe completo en cada cambio).
- Worktree por job: `git worktree add -b factory/<job-id> <worktree> main`.
- "Wait for all 4": "Spawn all four reviewers **in one message**, so they run in parallel" y "The round is done only when all four `review-*.md` files exist in `round-<N>/`". La barrera es existencia de archivos, no estado del agente. "Never resume the builder mid-round."
- "Resume builder": "resume the same builder with `SendMessage` to `builder-<job-id>`"; `MAX_RESUMES = 2` (máximo 3 rondas). Es reanudación de subagente con historial intacto, no `claude --resume`.
- Merge: `git merge --no-ff factory/<job-id>` en el checkout principal; "Never push". Solo con APPROVE en `decision.md`.
- ESCALATE → `stage: "needs-human"` (worktree y rama se conservan); `/factory approve` ejecuta el mismo paso Merge; `/factory rework <id> <note>` devuelve al builder.
- Dashboard HTML servido con `python3 -m http.server`, polling cada 2 s.

**Derivados que confirman la genealogía:**
- https://github.com/mkbaker/factory: "Adapted from zazencodes' original factory prompt". Plugin instalable; `MAX_REWORK = 2`; cambia el final: `gh pr create --base main --head factory/<id>` y "Nothing is ever committed to or merged into `main` by the factory"; `/factory approve` = `decision: "APPROVE (human)"` + abrir PR; `/factory resume <job-id>` para orquestador muerto ("two orchestrators on one job would spawn duplicate agents"); `board.py`/`ready.py` gestionan dependencias ("depends on #74"); fallback: si el builder no responde, "spawn a fresh `factory:builder`".
- https://github.com/donePM/software-factory: mismo pipeline, reviews en `round-N/review-*.md`, botones Approve/Rework que escriben en `factory/inbox/`; "Merges stay local in `main`... The factory never pushes". Reglas adaptadas de https://github.com/DietrichGebert/ponytail.
- Variantes: https://github.com/candoit3721/software-factory (round limit configurable, añade verify/deploy), https://github.com/Tristandemuijnck/werf, https://github.com/nickdala/software-factory.
- **No es la fuente**: freeCodeCamp "How to Build a Software Factory with Claude Code" (Qudrat Ullah, 22-may-2026, https://www.freecodecamp.org/news/how-to-build-software-factory-with-claude-code/): 7 subagentes distintos, builders secuenciales, un validador único. Tampoco guarda relación con la empresa Factory.ai.

### Parte 2 — Estado del arte (mecanismos)

**OpenAI, "Harness engineering" (Ryan Lopopolo, feb-2026; https://openai.com/index/harness-engineering/ devolvió 403; leído vía https://www.engineering.fyi/article/harness-engineering-leveraging-codex-in-an-agent-first-world e InfoQ 21-feb-2026 https://www.infoq.com/news/2026/02/openai-harness-engineering-codex).** ~1M LOC, ~1.500 PRs, 5 meses, 3→7 ingenieros, 0 líneas manuales. Mecanismos: AGENTS.md "as a table of contents (~100 lines)" que apunta a `docs/` (design docs, execution plans, quality grades); capas Types→Config→Repo→Service→Runtime→UI con linters cuyos mensajes incluyen la remediación; tests estructurales ("taste invariants": logging, naming, tamaño de archivo); "garbage collection": tareas Codex recurrentes que detectan desvíos de "golden principles", actualizan quality grades y abren PRs de refactor (antes gastaban 20 % de cada viernes limpiando "AI slop"); observabilidad legible por el agente (app arrancable por worktree, Chrome DevTools Protocol, LogQL/PromQL/TraceQL); revisión agente-a-agente "until all agent reviewers are satisfied", gates de merge mínimos, PRs cortos. Falla documentada: AGENTS.md monolítico se pudre → progressive disclosure.

**Anthropic.**
- "Building effective agents" (19-dic-2024, https://www.anthropic.com/engineering/building-effective-agents): prompt chaining con "gate" programático; parallelization en dos modos, *sectioning* y *voting* ("several different prompts review and flag the code"); orchestrator-workers; evaluator-optimizer "when there are clear evaluation criteria"; "stopping conditions (such as a maximum number of iterations)"; "human review remains crucial".
- "How we built our multi-agent research system" (13-jun-2025, https://www.anthropic.com/engineering/multi-agent-research-system): +90,2 % vs agente único; "token usage by itself explains 80% of the variance"; ~15× tokens; "most coding tasks involve fewer truly parallelizable tasks than research"; delegación con objetivo, formato de salida, herramientas y límites; LLM-as-judge en una sola llamada (0.0–1.0 + pass/fail); "resume from where the agent was when the errors occurred". Fallas: 50 subagentes para consultas simples, búsquedas duplicadas.
- Docs Claude Code (consultadas 21-oct-2026):
  - Subagentes (https://code.claude.com/docs/en/subagents): `model`, `maxTurns`, `isolation: worktree`, `hooks`; reanudación vía `SendMessage`: "retain their full conversation history" (el mecanismo exacto del "resume builder"); 20 concurrentes por defecto; anidamiento hasta 3 niveles.
  - Agent teams (https://code.claude.com/docs/en/agent-teams): experimental (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`); lista de tareas con dependencias y file locking; hooks `TeammateIdle`/`TaskCompleted` (exit 2 bloquea); ejemplo oficial "parallel code review" con 3 lentes; limitación: "No session resumption with in-process teammates", "Task status can lag".
  - Hooks (https://code.claude.com/docs/en/hooks): Stop/SubagentStop con `decision: block`; `stop_hook_active`; "8-consecutive-continuation cap" (`CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`); `SubagentStop` "keeps the subagent running and delivers reason as its next instruction".
  - Workflow tool / ultracode (https://code.claude.com/docs/en/workflows; InfoQ 1-jun-2026 https://www.infoq.com/news/2026/06/dynamic-workflows-claude-code/): script JS con `agent()`, `parallel()` ("waits for all of them"), `pipeline()`; 16 agentes concurrentes, 1.000 por run; resumable con replay determinista (`Date.now()` lanza error); ejemplo oficial de loop acotado: "keep fixing... until the type check passes or two rounds in a row make no progress".
  - `/goal` (https://code.claude.com/docs/en/goal): evaluador separado en modelo pequeño tras cada turno (Met / Not yet / Impossible); se detiene si varios turnos sin tool use.
  - Best practices (https://code.claude.com/docs/en/best-practices): Writer/Reviewer en sesiones separadas ("won't be biased toward code it just wrote"); "Add an adversarial review step"; advertencia: "A reviewer prompted to find gaps will usually report some, even when the work is sound".
  - Plugin ralph-wiggum (https://github.com/anthropics/claude-code/tree/main/plugins/ralph-wiggum): Stop hook re-inyecta el mismo prompt en la misma sesión; `--max-iterations` ("default: unlimited"), `--completion-promise` (match exacto).

**Cognition.** "Don't Build Multi-Agents" (Walden Yan, 12-jun-2025, https://cognition.com/blog/dont-build-multi-agents): "Share context, and share full agent traces"; "Actions carry implicit decisions, and conflicting decisions carry bad results". Reversión parcial "Multi-Agents: What's Actually Working" (22-abr-2026, https://cognition.com/blog/multi-agents-working): funciona cuando "writes stay single-threaded and the additional agents contribute intelligence rather than actions"; loop Devin ⇄ Devin Review "works best when the agents share no context beforehand"; el reviewer ve solo el diff, "forced to reason backward from the implementation without the spec"; "communication bridge" para filtrar hallazgos y evitar loops; cifra del vendor: ~2 bugs/PR, ~58 % severos.

**SDD tooling.**
- spec-kit (https://github.com/github/spec-kit; https://github.com/github/spec-kit/blob/main/spec-driven.md): constitution → specify con marcadores `[NEEDS CLARIFICATION]` obligatorios → plan con gates "Phase -1" (Simplicity ≤3 projects, Anti-Abstraction, Integration-First "Contract tests written?") que "cannot proceed without either passing the gates or documenting justified exceptions" → tasks `[P]` → implement → converge ("Repeat implement and converge until... Converged"); checklists como "unit tests for the specification".
- Kiro (https://kiro.dev/docs/specs/, actualizado 15-oct-2026): requirements/design/tasks; "Analyze Requirements"; ejecución por *waves* (grafo de dependencias, waves secuenciales, tareas concurrentes); property-based testing ("Correctness", solo IDE); Quick Spec "without approval gates" (implica que el flujo estándar los tiene). No encontrado en esa página: EARS, hooks.
- OpenSpec (https://github.com/Fission-AI/OpenSpec, 72,7k★): propose → apply → archive; "Agree before you build"; `/opsx:verify` solo en perfil expandido; "no rigid phase gates".
- Tessl (https://tessl.io/): hoy se posiciona como skills/loops/factory con "before-and-after evals on every change"; la página no documenta spec-as-source ni un comando de verificación → no verificado.
- cal.diy (https://github.com/calcom/cal.diy/blob/main/SPEC-WORKFLOW.md): opt-in; `specs/{feature}/` con design.md, implementation.md, decisions.md; único gate explícito: "Ask user to review before implementing".

**Huntley / Pocock.** Ralph (14-jul-2025, https://ghuntley.com/ralph/): `while :; do cat PROMPT.md | claude-code ; done`; contexto fresco por iteración; una tarea por loop; backpressure = tipos/tests/analizadores; "DO NOT IMPLEMENT PLACEHOLDER"; un solo subagente para builds/tests; sin stop formal. Pocock (https://github.com/mattpocock/skills, 300k★ en página): grill-me → to-spec → to-tickets → implement (/tdd + /code-review); code-review "as parallel sub-agents so neither pollutes the other" (ejes Standards y Spec); sin fix-loops acotados.

**YC / Stanford / industria.**
- YC: Garry Tan, "Thin Harness, Fat Skills" (abr-2026, https://x.com/garrytan/article/2042925773300908103; https://github.com/garrytan/gbrain/blob/master/docs/ethos/THIN_HARNESS_FAT_SKILLS.md). Video YC "How to Build Software with Thin Harness and Fat Skills" fechado 8-may-2026 por un agregador (https://glasp.co/youtube/57lDpTwiW6g); URL oficial no confirmada. Es doctrina, no mecanismo medible.
- Stanford: CS146S "The Modern Software Developer" (https://bulletin.stanford.edu/courses/2274401; cubre "code review and testing platforms like Coderabbit and Qodo"). CooperBench (Stanford/SAP, ICLR 2026, https://arxiv.org/abs/2601.13295): dos agentes cooperando rinden ~30 % menos que en solitario; GPT-5/Sonnet 4.5 ≈25 % cooperando (≈50 % bajo el baseline solo); fallas: mensajes vagos, incumplimiento de compromisos, expectativas erróneas. **No encontré** material Stanford específico sobre revisores paralelos.
- Cursor, "Towards self-driving codebases" (Wilson Lin, 5-feb-2026, https://cursor.com/blog/self-driving-codebases): planner recursivo + workers sin comunicación lateral; "the judge was removed to keep the system simple"; integrador eliminado por cuello de botella; "Constraints are more effective than instructions"; ~1.000 commits/h; aún requiere "a final 'green' branch".
- Factory.ai (https://docs.factory.ai/missions/overview): Missions (research preview) con "validation milestones"; requiere Agent Readiness Level 4.
- Papers de harness: "An Empirical Study of Harness Design for Coding Agents" (17-sep-2026, https://arxiv.org/abs/2609.20804): 176 configuraciones; context management rinde más al estrechar ventana; planning ayuda a modelos débiles; no evalúa review loops. "Harness Engineering... Eleven Systems" (15-jul-2026, https://arxiv.org/abs/2609.00006): 7 subsistemas, 29 patrones; ningún runtime importa un framework agéntico ni usa embeddings.
- Base histórica: SWE-agent (https://arxiv.org/abs/2405.15793, 12,5 % SWE-bench, "agent-computer interface"); Agentless (https://arxiv.org/abs/2407.01489, 32 % Lite, $0,70, pipeline fijo localize→repair→validate); OpenHands (https://arxiv.org/abs/2407.16741, ICLR 2025). En Verified con Claude 3.5 Sonnet: OpenHands 53,0 % vs Agentless 50,8 % (https://arxiv.org/pdf/2509.13941), diferencia "modest".

**Evidencia empírica sobre revisores paralelos y rondas acotadas.**
- METR RCT (jul-2025, https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/): 16 devs, 246 tareas, +19 % tiempo con IA (IC95 ≈ [−40 %, −2 %] según https://domenic.me/metr-ai-productivity/); el seguimiento 2026 es "only very weak evidence" por autoselección (cobertura: https://birchtree.me/blog/an-update-from-the-study-that-said-devs-were-actually-slower-with-coding-agents/).
- PoLL (Verga et al., abr-2024, https://arxiv.org/abs/2404.18796): panel de 3 familias correlaciona mejor con humanos que un juez grande y es >7× más barato; menor "intra-model bias".
- Contra: "Nine Judges, Two Effective Votes" (Kohli, 28-may-2026, https://arxiv.org/abs/2605.29800): 9 jueces ≈ 2 votos independientes; 8–22 pp bajo el ideal; "best single judge matches or outperforms the full panel". Implicación directa: 3 Sonnet + 1 Opus comparten errores; la diversidad útil viene de lentes y contextos distintos, no de N.
- Adversarial Review (Qiu & Gill, 16-ago-2026, https://arxiv.org/abs/2608.18167): SWE-PRBench F1 single-reviewer 0,495; two-reviewers 0,503; MARS 0,501; AR naive 0,457 ("false consensus"); AR con disenso explícito 0,533. LiveCodeBench: single 77 %, two-reviewers 75 %, MARS 82 %, AR 87 %. SWE-bench Verified: AR 75,2 vs MARS 72,6 vs zero-shot 71,6 con ~4,5× tokens; loop interno cap 5 rondas. Lección: dos revisores paralelos ≈ uno; lo que mejora es obligar al crítico a disentir citando código.
- SWE-Review (Wang et al., 7-jul-2026, https://arxiv.org/abs/2607.06065): revisión agéntica > single-turn; resolve rate tras revisión +3,0 pp (GLM-5) a +25,1 pp (Qwen3-30B); rendimientos decrecientes por ronda en Verified: 34,8 → 40,6 → 43,0 → 43,4 → 44,0; "test paradox": 62 % de falsos APPROVE incluyen tests escritos por el propio generador. Es el respaldo numérico más directo para "max 2 rounds".
- Agyn (post del vendor, 2-mar-2026, https://dev.to/nikita_benkovich_eb86e54d/coding-agent-teams-outperform-solo-agents-722-on-swe-bench-verified-4of5): 72,2 % Verified con Manager/Researcher/Engineer/Reviewer, +7,2 pp vs baseline GPT-5; sin ablación de roles ni cap de rondas.

### Parte 3 — Síntesis por caja/flecha

| Caja / flecha | Quién lo implementa | Mecanismo | Fallas conocidas |
|---|---|---|---|
| feature → spec-writer | zazencodes/mkbaker; spec-kit; Kiro; Pocock grill-me; cal.diy | spec.md con criterios testeables; `[NEEDS CLARIFICATION]`; revisión humana del spec antes de código | Reviewer sin spec "reason backward from the implementation" (Cognition); conocimiento tácito invisible al agente (OpenAI) |
| builder en worktree | zazencodes/mkbaker/donePM; Claude Code `isolation: worktree`; OpenAI app-per-worktree; Cursor workers | TDD, commits en `factory/<id>`, build.md | Agente único "lost track... claimed success" (Cursor); dos escritores en el mismo scope pierden ~30 % (CooperBench) |
| fan-out 4 revisores | zazencodes "in one message"; agent teams (3 lentes); Workflow `parallel()`; Anthropic voting; Pocock | Un mensaje con N Agent calls; lentes disjuntas; contexto fresco solo-diff | Errores correlacionados (9 jueces ≈ 2 votos); two-reviewers ≈ single (F1 0,503 vs 0,495); revisores reportan hallazgos aunque el trabajo sea sólido; ~15× tokens |
| WAIT FOR ALL | zazencodes/mkbaker (archivos `review-*.md`); Workflow `parallel()`; agent teams idle/TaskCompleted | Existencia de archivos como barrera; `job.json` con único escritor | "Task status can lag" (teams); agente colgado → en Workflow reinicia hasta 5 veces y devuelve `null`; orquestador muerto → `/factory resume` |
| CHANGES → resume builder (máx 2) | zazencodes `SendMessage` + `MAX_RESUMES=2`; Devin ⇄ Devin Review; SWE-Review; Workflow "two rounds... no progress"; Ralph `--max-iterations`; Stop-hook cap 8 | Reanudar el mismo subagente con historial; fallback builder fresco con review files | Rendimientos decrecientes tras ronda 1 (+5,8 → +2,4 → +0,4); false consensus (AR); hallazgos fuera de scope sin "communication bridge"; `/resume` no restaura teammates; Ralph default ilimitado |
| all PASS → approver | zazencodes/mkbaker; evaluator-optimizer; `/goal` evaluador separado | Re-ejecuta checks; decision.md APPROVE/ESCALATE | "Test paradox": aprobar por tests del propio builder (62 % de falsos APPROVE); juez de la misma familia que los revisores; Cursor eliminó el judge |
| APPROVE → merge to main | zazencodes/donePM `git merge --no-ff` local, never push; mkbaker `gh pr create`, never merge; OpenAI gates mínimos + GC; Cursor "final green branch" | Merge local vs PR | Merge local sin CI remoto; colisiones entre jobs paralelos (mkbaker `ready.py` espera el PR del bloqueador); integrador = cuello de botella (Cursor) |
| ESCALATE → needs-human ← /factory approve | zazencodes/mkbaker/donePM (`stage: needs-human`, worktree preservado, botón/inbox); Anthropic "pause for human feedback at checkpoints"; gates de Kiro/spec-kit | Comando que reusa Merge/Open PR con `decision: "APPROVE (human)"` | La aprobación vive en JSON que el propio agente puede escribir (ningún hook lo impide en los tres repos); dos orquestadores sobre un job duplican agentes |

### No encontrado / no verificado
- Fecha del video ZazenCodes en YouTube (fetch bloqueado); identidad real de mkbaker/donePM.
- Texto primario del post de OpenAI (403); se usaron mirror e InfoQ.
- Post primario de Mitchell Hashimoto (solo fuentes secundarias lo datan en feb-2026); post de Ramp sobre harnesses (nada).
- URL oficial del episodio Lightcone "Thin Harness, Fat Skills" (solo agregador).
- Documentación de Tessl sobre spec-as-source/verificación; página de Kiro con EARS y hooks (404 en la ruta probada).
- Un estudio que compare directamente N revisores especializados + rondas acotadas vs un revisor único en SWE-bench: no existe tal cual; lo más cercano es Adversarial Review (2 revisores ≈ 1) y SWE-Review (rendimientos decrecientes por ronda).
