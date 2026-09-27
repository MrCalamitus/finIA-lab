# finIA-lab

> **¿Por qué "FinIA"?** Fin(anzas) + IA. En 2026, si tu producto no lleva "IA" en el nombre, ¿de verdad existe? 😄

**Arquitectura de Productos con IA: Agentes, SDD y Casos de Uso Reales**
Taller · Congreso de Seguridad · ESIME Culhuacán
Imparte: Luis Alberto Ortiz Meza

---

## Objetivo

Dar el salto de usar la IA como **asistente de chat** a operarla como un **agente** que planifica, escribe, valida y corrige sistemas completos desde tu terminal, con control y seguridad.

## Proyecto práctico

Vamos a construir desde cero un **Asistente de Finanzas Personales**:

- Registras gastos e ingresos escribiendo en un **grupo de WhatsApp donde solo estás tú**.
- Un **modelo de lenguaje local** (Ollama) interpreta cada mensaje.
- La información queda guardada y la puedes consultar.

El proyecto se construye con **SDD (Specification-Driven Development)** usando **[spec-kit](https://github.com/github/spec-kit)** sobre **Claude Code**. El stack y las funcionalidades **no están decididos en este repo**: los vas a definir tú en la especificación. Ese es el punto del taller.

## Antes del taller

👉 **Haz el [pre-work](docs/00-prework.md).** Sin él no podrás seguir la parte práctica: las descargas no caben en el Wi-Fi del congreso.

## Agenda (3 horas)

| Bloque | Tema | Min |
|---|---|---|
| **1. De asistente a agente** | [Bienvenida y contexto](docs/conceptos/00-bienvenida-y-contexto.md) · [cambio de paradigma](docs/conceptos/01-de-asistente-a-agente.md) | 10 |
| | [Arquitectura CLI y Tool Calling](docs/conceptos/02-cli-y-tool-calling.md) | 15 |
| | [SDD con spec-kit](docs/conceptos/03-sdd-con-spec-kit.md) | 10 |
| | [Seguridad y control](docs/conceptos/04-seguridad-y-control.md) | 10 |
| **2. Infraestructura y Manifiesto de Contexto** | Verificación del entorno | 10 |
| | [El Manifiesto de Contexto](docs/conceptos/05-manifiesto-de-contexto.md) | 25 |
| **3. Hands-on: Asistente de Finanzas** | Fase 1: la especificación | 20 |
| | Fase 2: ejecución autónoma | 30 |
| | Fase 3: depuración e iteración | 25 |
| **4. Estrategias avanzadas y cierre** | [Del taller al día a día](docs/conceptos/06-del-taller-al-dia-a-dia.md) | 10 |
| | Preguntas y networking | 15 |
| | **Total** | **180** |

## Mapa del repo

```
docs/
├─ 00-prework.md          ← instalación y checklist (hazlo antes)
├─ conceptos/             ← la teoría del taller, 1 página por tema
├─ ejemplos/              ← plantillas de referencia del Manifiesto de Contexto
└─ proyecto/vision.md     ← el problema que vamos a resolver (punto de partida de la spec)
```

Lectura sugerida, en orden: [00](docs/conceptos/00-bienvenida-y-contexto.md) → [01](docs/conceptos/01-de-asistente-a-agente.md) → [02](docs/conceptos/02-cli-y-tool-calling.md) → [03](docs/conceptos/03-sdd-con-spec-kit.md) → [04](docs/conceptos/04-seguridad-y-control.md) → [05](docs/conceptos/05-manifiesto-de-contexto.md) → [06](docs/conceptos/06-del-taller-al-dia-a-dia.md) → [visión del proyecto](docs/proyecto/vision.md).

## Sobre el instructor

**Luis Alberto Ortiz Meza**: Ingeniero en Computación y Maestro en Ingeniería en Seguridad y Tecnologías de la Información por el IPN. Ambos títulos son de ESIME Culhuacán: aquí se formó.

- **Poco más de 14 años de proyectos de todos los tamaños:** ha participado activamente en cada uno, con total libertad para elegir el stack y la forma de trabajo.
- **IA aplicada, no de demo:** IAPREP, visión por computadora que lee actas electorales, fue evaluado por el INE en 2024 como la mejor de 3 soluciones (97 % de confiabilidad). También construyó pipelines multiagente con LLM locales (CrewAI + Ollama) en producción y [un agente RAG auditable](https://github.com/MrCalamitus/rag-agent) en AWS Bedrock.
- **Ya recorrió el camino de FinIA:** Hermes, su asistente personal con LLM locales, registra sus gastos desde fotos de tickets.
- **Agentes de código a diario:** usa Cursor desde 2023 y Claude Code desde 2025. Como cofundador y CTO de ZOGA, impulsó la adopción de IA en el flujo de desarrollo de su equipo.
- **Vuelve a casa:** fue ponente en el 9º Congreso de Seguridad de la Información de ESIME Culhuacán (2021).

[LinkedIn](https://www.linkedin.com/in/mrcalamitus) · [GitHub](https://github.com/MrCalamitus)

## Comunidad

¿Quieres seguir aprendiendo después del taller? Únete a [VibeCoders](https://www.vibecoders.la/) y [AI Builders México](https://aibuilders.mx/). Detalles en [06 · Del taller al día a día](docs/conceptos/06-del-taller-al-dia-a-dia.md#mantente-al-día-comunidades).

## Requisitos

- **Claude Pro** activo (incluye Claude Code).
- **Laptop propia** en la que puedas instalar software. Recomendado: 16 GB de RAM para correr el modelo local. Si tienes menos, habrá un servidor en el taller.
- **WhatsApp** en tu teléfono, con batería.

> ⚠️ El canal de WhatsApp usa una librería **no oficial**. Lee el aviso en el [pre-work](docs/00-prework.md#5-whatsapp) antes de decidir con qué número participar.
