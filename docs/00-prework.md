# Pre-work (hazlo ANTES del taller)

⏱️ ~45 minutos, con buena conexión. **No lo dejes para el día del taller**: el Wi-Fi del congreso no alcanza para todas las personas que asistirán.

Si algo falla, anota el error exacto y tráelo. Lo resolvemos en los primeros 10 minutos del Bloque 2.

---

## 1. Git

| SO | Instalación |
|---|---|
| macOS | `xcode-select --install` (o `brew install git`) |
| Windows | [Git for Windows](https://git-scm.com/downloads/win). Instálalo: Claude Code lo usa para su terminal Bash. |
| Linux | `sudo apt install git` (o el gestor de tu distro) |

## 2. Claude Code

Requiere **Claude Pro** (o superior) activo. Instálalo **sin** permisos de administrador:

| SO | Comando |
|---|---|
| macOS / Linux / WSL | `curl -fsSL https://claude.ai/install.sh \| bash` |
| Windows (PowerShell) | `irm https://claude.ai/install.ps1 \| iex` |

Luego **abre una terminal nueva** y ejecuta:

```bash
claude --version     # debe imprimir un número de versión
claude               # abre el navegador para iniciar sesión con tu cuenta Pro
```

Dentro de Claude Code escribe `/exit` para salir. Si algo falla, `claude doctor` te dice qué revisar.

## 3. Python + uv + spec-kit

spec-kit se instala con [uv](https://docs.astral.sh/uv/), que también instala Python si no lo tienes.

| SO | Instalar uv |
|---|---|
| macOS / Linux / WSL | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| Windows (PowerShell) | `powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 \| iex"` |

Abre una terminal nueva e instala spec-kit (versión fijada para el taller):

```bash
uv tool install specify-cli==1.0.12
specify --version    # debe imprimir: specify 1.0.12
```

> En Windows nativo (sin WSL), el día del taller inicializaremos con `--script ps`. No necesitas hacer nada más ahora.

## 4. Node.js y Ollama

**Node.js 24 LTS o superior**: descárgalo de [nodejs.org](https://nodejs.org/). Verifica con `node --version`.

**Ollama** (para correr el modelo de lenguaje en tu máquina):

| SO | Instalación |
|---|---|
| macOS | [Descarga para macOS](https://ollama.com/download/mac) (requiere macOS 14+) |
| Windows | [Descarga para Windows](https://ollama.com/download/windows) |
| Linux | `curl -fsSL https://ollama.com/install.sh \| sh` |

Descarga el modelo del taller (**pesa varios GB; hazlo en casa**):

```bash
ollama pull <MODELO_DEL_TALLER>     # te confirmamos el nombre exacto antes del taller
ollama run <MODELO_DEL_TALLER> "Responde solo: listo"
```

> 💡 ¿Tu laptop tiene 8 GB de RAM o menos? Instala Ollama de todos modos, pero no descargues el modelo: en el taller habrá un **servidor compartido** en la red local.

## 5. WhatsApp

### ⚠️ Lee esto primero

El asistente se conecta a WhatsApp con [Baileys](https://github.com/WhiskeySockets/Baileys), una librería **no oficial**, no afiliada a WhatsApp. Su uso **puede violar los términos de servicio de WhatsApp y provocar la suspensión del número**. En el taller la usamos de forma mínima: un grupo propio, sin envíos masivos ni mensajes a terceros. Aun así, **el riesgo es tuyo**. Si no quieres arriesgar tu número principal, usa uno secundario.

### Crea tu grupo "de mí para mí"

WhatsApp no deja crear un grupo vacío, así que:

1. Crea un grupo nuevo agregando a **un** contacto de confianza.
2. Nómbralo, por ejemplo, **`finIA 💰`**.
3. En la info del grupo, **elimina** a ese contacto. Ahora solo quedas tú.
4. Escribe un mensaje de prueba. Ese grupo será la "terminal" de tu asistente.

El día del taller, vincularemos tu sesión escaneando un código QR desde **WhatsApp → Dispositivos vinculados**. Lleva el teléfono **con batería**.

## 6. Clona el repo del taller

```bash
git clone <URL_DEL_REPO> finIA-lab
cd finIA-lab
```

---

## ✅ Checklist final

Ejecuta cada comando en una **terminal nueva**. Todos deben responder sin error:

```bash
git --version
claude --version
uv --version
specify --version            # specify 1.0.12
node --version               # v24 o superior
ollama --version
ollama list                  # debe aparecer el modelo del taller (salvo que uses el servidor compartido)
```

- [ ] Todos los comandos anteriores responden
- [ ] Iniciaste sesión en Claude Code con tu cuenta Pro
- [ ] Tienes tu grupo de WhatsApp de un solo miembro
- [ ] Leíste los [conceptos](conceptos/) (opcional, pero recomendado)
- [ ] Clonaste el repo del taller
