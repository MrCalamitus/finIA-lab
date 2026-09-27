# 05 · El Manifiesto de Contexto

El agente no recuerda nada entre sesiones. Todo lo que debe saber de tu proyecto tiene que vivir **en archivos del repo**. A ese conjunto de archivos le llamamos **Manifiesto de Contexto**.

## Las cuatro piezas

| Pieza | Archivo | Qué contiene | Naturaleza |
|---|---|---|---|
| **Memoria del proyecto** | `CLAUDE.md` | Topología del repo, comandos de build/test, convenciones, reglas | Guía: el modelo la lee y la sigue… casi siempre |
| **Permisos** | `.claude/settings.json` | Qué herramientas y comandos se permiten, se preguntan o se prohíben | **Control determinista** |
| **Hooks** | `.claude/settings.json` + scripts | Código que corre antes o después de cada acción (bloquear, validar, correr tests) | **Control determinista** |
| **Constitución** | `.specify/memory/constitution.md` | Principios no negociables que spec-kit aplica en cada spec, plan y tarea | Guía que el proceso SDD verifica |

> ¿`.clauderc`? No existe. Los nombres reales son los de la tabla.

## 1. `CLAUDE.md`: qué poner

Corto (menos de ~100 líneas), concreto y verificable:

- **Topología:** qué hay en cada carpeta y dónde va cada cosa nueva.
- **Comandos obligatorios:** cómo instalar, correr, testear y hacer lint. "Antes de dar una tarea por terminada, corre `<test>`".
- **Convenciones:** idioma, estilo y manejo de errores.
- **Reglas de seguridad:** qué nunca tocar y qué siempre validar.
- **Qué NO poner:** documentación larga, tutoriales o secretos.

👉 Ejemplo: [`docs/ejemplos/CLAUDE.md.example`](../ejemplos/CLAUDE.md.example)

## 2. Permisos: `allow`, `ask` y `deny`

```json
{
  "permissions": {
    "allow": ["Bash(npm test *)", "Bash(git status)"],
    "ask":   ["Bash(git push *)"],
    "deny":  ["Read(./.env)", "Read(./auth_info*/**)", "Bash(rm -rf *)"]
  }
}
```

Se evalúan en orden **deny → ask → allow**, así que `deny` gana siempre. Ve a lo seguro: pocas cosas en `allow` y lo peligroso en `deny`.

> ⚠️ **Dato de seguridad:** una regla `Bash(...)` compara el **texto** del comando. `Bash(rm *)` detiene `rm -rf build/`, pero no `bash -c 'rm -rf build/'`. `Read(./.env)` bloquea `cat .env`, pero no un script de Node que abra el archivo por su cuenta. Los permisos son una buena primera barrera, **no una frontera de seguridad**. Para eso existen el **sandbox** (bloqueo a nivel sistema operativo) y los hooks (tu propia lógica sobre el comando completo).

👉 Ejemplo completo: [`docs/ejemplos/settings.json.example`](../ejemplos/settings.json.example)

## 3. Hooks: tu código en el ciclo del agente

| Evento | Cuándo | Uso típico |
|---|---|---|
| `PreToolUse` | Antes de ejecutar una tool | **Bloquear** comandos peligrosos o acceso a secretos |
| `PostToolUse` | Después de editar | Correr formateo, lint o tests automáticamente |
| `Stop` | Cuando el agente dice "terminé" | Verificar que los tests pasan antes de aceptar |

Un hook recibe en `stdin` un JSON con la acción. Si termina con **código de salida 2**, la acción se bloquea y el motivo le llega al modelo para que ajuste su plan.

👉 Ejemplo: [`docs/ejemplos/hook-guard.example.mjs`](../ejemplos/hook-guard.example.mjs)

## 4. La constitución (spec-kit)

La generas con `/speckit-constitution`. Pon ahí lo que **ninguna** feature puede violar, por ejemplo:

- "Todo input externo (mensajes, respuestas del LLM) se valida contra un esquema antes de persistirse."
- "Los montos se guardan como enteros en centavos."
- "Ningún secreto en el repo; la configuración se lee de variables de entorno."
- "Cada requisito tiene al menos una prueba automatizada."

## Cómo se complementan

```
 constitución ──► gobierna ──► spec / plan / tareas   (qué construir)
 CLAUDE.md    ──► orienta  ──► cada sesión del agente (cómo trabajar aquí)
 permisos     ──► limitan  ──► lo que el agente PUEDE hacer
 hooks        ──► verifican──► lo que el agente HIZO
```

## Lo que te llevas

> Lo que quieres que el agente **sepa** va en `CLAUDE.md` y en la constitución. Lo que **no debe poder hacer** va en permisos y hooks. La guía orienta; el control impide.
