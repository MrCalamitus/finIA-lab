# 02 · Arquitectura CLI y Tool Calling

## El LLM no ejecuta nada

Un modelo de lenguaje solo produce texto. La "magia" de un agente es un programa, el **cliente** (Claude Code, en nuestro caso), que:

1. Le dice al modelo qué **herramientas** (*tools*) existen y cómo se usan.
2. Recibe del modelo una **solicitud estructurada** para usar una herramienta.
3. **Decide si la permite** (según tus permisos y hooks), la ejecuta **en tu máquina** y le devuelve el resultado al modelo.

```
 Tú ──prompt──► Cliente CLI ──contexto + lista de tools──► LLM (nube)
                    ▲  │                                      │
                    │  │◄──── tool_use: Bash("npm test") ─────┘
                    │  ▼
                    │  ¿Permitido? ── no ──► se bloquea y el modelo recibe el motivo
                    │  │ sí
                    │  ▼
                    │  Ejecuta en TU terminal
                    │  │
                    └──┴──── tool_result: salida de consola ──► LLM decide el siguiente paso
```

## Un tool call por dentro

Lo que el modelo "pide" es un objeto como este:

```json
{
  "type": "tool_use",
  "name": "Bash",
  "input": { "command": "npm test", "description": "Correr las pruebas" }
}
```

Y lo que recibe de vuelta:

```json
{ "type": "tool_result", "content": "2 passed, 1 failed: expected 150 but got 1.5" }
```

Con ese resultado, el modelo planea el siguiente paso. Así "lee la consola" y se autocorrige.

## Herramientas típicas de Claude Code

| Tool | Para qué |
|---|---|
| `Read`, `Glob`, `Grep` | Explorar y entender el código |
| `Edit`, `Write` | Modificar archivos |
| `Bash` / `PowerShell` | Ejecutar comandos: build, tests, git |
| `WebFetch`, `WebSearch` | Consultar documentación |
| Skills, subagentes, MCP | Extender capacidades: flujos empaquetados, agentes especializados, servicios externos |

## Implicaciones

- **Tu terminal es la superficie de ataque.** Todo lo que el agente ejecuta corre con **tus** permisos de usuario.
- **El control está en el cliente, no en el modelo.** Los permisos y hooks se aplican antes de ejecutar, de forma determinista. Pedirle al modelo "por favor no borres nada" no es una medida de seguridad.
- **Esto no es exclusivo de Claude.** El mismo patrón (tools + ciclo) lo usan otros clientes y también la app que vamos a construir: nuestro LLM local recibe un mensaje y devuelve **datos estructurados** que nuestro código valida antes de usarlos.

## Lo que te llevas

> El modelo **propone** acciones; el cliente las **autoriza y ejecuta**. Si controlas el cliente, controlas al agente.
