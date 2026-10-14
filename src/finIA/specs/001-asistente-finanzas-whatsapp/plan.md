# Implementation Plan: Asistente de finanzas personales por WhatsApp

**Branch**: `001-asistente-finanzas-whatsapp` | **Date**: 2026-10-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-asistente-finanzas-whatsapp/spec.md`

## Summary

Un proceso de Node.js escucha, con Baileys, los mensajes del grupo de WhatsApp del dueño. Cada
mensaje pasa por un filtro (grupo, dueño, no propio), una cola en serie y un intérprete que llama
a un LLM local en Ollama con salida estructurada. El LLM solo **propone** una intención; el código
la valida con zod, convierte el monto a centavos y ejecuta una de seis acciones de una lista
cerrada sobre SQLite local. La idempotencia vive en la base: el id del mensaje es clave primaria y
se guarda en la misma transacción que los movimientos.

## Technical Context

**Language/Version**: TypeScript ejecutado por Node.js 24 LTS con type stripping nativo (sin
compilación); `tsc --noEmit` para tipos. Ver [research.md](research.md) R1.

**Primary Dependencies**: `baileys@7.0.0-rc14` (WhatsApp), `zod@4.6.5` (validación y JSON
Schema), `qrcode-terminal@0.12.0` (QR). Ollama vía `fetch` nativo, sin SDK. R2, R5, R7.

**Storage**: SQLite local con `node:sqlite`, archivo `data/finia.db`. R8 y
[data-model.md](data-model.md).

**Testing**: `node:test` + `node:assert`. Unit, integration (intérprete y canal falsos, SQLite en
memoria), seguridad; evaluación manual con el modelo real (`npm run eval`). R12.

**Target Platform**: laptop del dueño (macOS, Linux o Windows) con Node 24; Ollama local o en
servidor de la red local.

**Project Type**: servicio de un solo proceso, sin interfaz propia (la interfaz es el chat).

**Performance Goals**: confirmación de registro en < 10 s (SC-001) con el modelo del taller
cargado (`keep_alive`).

**Constraints**: ningún dato financiero sale de la máquina o red local (FR-017); montos en
centavos enteros; timeout del intérprete 20 s configurable; mensajes ≤ 500 caracteres.

**Scale/Scope**: un usuario, un grupo, del orden de decenas de mensajes al día y miles de
movimientos al año.

**Unknowns**: ninguno pendiente. El nombre del modelo del taller es configuración
(`FINIA_OLLAMA_MODEL`) y se fija tras `npm run eval` (R5).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cómo lo cumple el diseño | Pre | Post |
|---|---|---|---|
| I. Todo input es no confiable | Filtro de origen antes de todo; LLM con salida estructurada revalidada con zod; despachador con lista cerrada de 6 acciones; confirmaciones decididas por código; el esquema no permite "todos" ([interpretacion.md](contracts/interpretacion.md)) | ✅ | ✅ |
| II. El dinero es exacto y no se duplica | `monto_centavos INTEGER`; monto parseado en código desde texto; PK de `mensajes_procesados` + `UNIQUE (mensaje_origen_id, indice_en_mensaje)` en la misma transacción; todo fallo produce aviso ([data-model.md](data-model.md)) | ✅ | ✅ |
| III. Los datos no salen de la máquina | Ollama local o red privada; la URL se valida al arrancar (solo loopback o RFC 1918); SQLite local; sin telemetría ([configuracion.md](contracts/configuracion.md)) | ✅ | ✅ |
| IV. Ningún secreto en el repo | Config por variables de entorno; `.env.example` sin valores; `auth_info/`, `.env`, `data/` en `.gitignore` con prueba; logs sin credenciales; el hook del repo impide al agente leer `auth_info*` y `.env` | ✅ | ✅ |
| V. Cada requisito tiene una prueba | Cada FR y escenario de aceptación mapea a una prueba de integración; cada FR de seguridad (013–018) tiene una prueba de ataque en `tests/seguridad/`; SC-002/SC-004 en `eval/` | ✅ | ✅ |
| Restricciones: dependencias | 3 de runtime y 2 de desarrollo, versión exacta, publicadas hace ≥ 2 semanas, lockfile versionado; revisar en el diff la transitiva nativa de Baileys (R2) | ✅ | ✅ |
| Restricciones: alcance | Un usuario, un grupo, MXN; sin bancos ni API oficial | ✅ | ✅ |
| Flujo: spec y código en la misma rama | Esta rama/PR | ✅ | ✅ |

**Resultado**: sin violaciones. Complexity Tracking vacío.

**Riesgo anotado (no violación)**: `baileys` es una release candidate (la etiqueta `latest` de npm
apunta a ella y la 6.x es `legacy`). Mitigación: versión exacta y escenario Q6 del quickstart.

## Project Structure

### Documentation (this feature)

```text
specs/001-asistente-finanzas-whatsapp/
├── spec.md
├── plan.md              # este archivo
├── research.md          # Fase 0
├── data-model.md        # Fase 1
├── quickstart.md        # Fase 1
├── contracts/
│   ├── interpretacion.md  # salida del LLM (esquema + reglas)
│   ├── conversacion.md    # entradas y respuestas en el chat
│   └── configuracion.md   # variables de entorno y scripts
├── checklists/requirements.md
└── tasks.md             # Fase 2 (/speckit-tasks)
```

### Source Code (raíz: `src/finIA/`)

```text
package.json  package-lock.json  tsconfig.json  .env.example  .gitignore  .npmrc

src/
├── main.ts                  # arranque: config, base, canal, cola
├── config.ts                # lectura y validación de variables de entorno
├── logger.ts                # logger mínimo + adaptador para Baileys
├── dominio/
│   ├── dinero.ts            # texto → centavos, centavos → "$1,234.56"
│   ├── fechas.ts            # validación de fechas y rangos de periodo
│   └── categorias.ts        # listas fijas por tipo
├── interprete/
│   ├── esquema.ts           # zod: contrato de interpretación
│   ├── prompt.ts            # instrucciones al modelo
│   └── ollama.ts            # cliente fetch con timeout
├── acciones/
│   ├── despachador.ts       # lista cerrada: intención → acción
│   ├── registrar.ts  confirmar.ts  consultar.ts  resumen.ts  corregir.ts  borrar.ts
│   └── respuestas.ts        # textos de contracts/conversacion.md
├── almacen/
│   ├── db.ts                # conexión node:sqlite y migraciones
│   └── repositorio.ts       # consultas parametrizadas
├── canal/
│   ├── whatsapp.ts          # adaptador Baileys (conexión, envío, eventos)
│   └── filtro.ts            # grupo + dueño + no propio + texto ≤ 500
├── manejador.ts             # orquesta: filtro → idempotencia → intérprete → acción → respuesta
└── scripts/grupos.ts        # lista grupos para FINIA_GROUP_JID

tests/
├── unit/                    # dinero, fechas, categorías, esquema, filtro
├── integration/             # escenarios de aceptación US1–US4 y Edge Cases
├── seguridad/               # FR-013…FR-018: un intento de violación por requisito
└── dobles/                  # intérprete falso, canal falso

eval/
├── tipicos.json             # 30 mensajes con resultado esperado (SC-002)
├── hostiles.json            # 20 mensajes hostiles (SC-004)
└── correr.ts
```

**Structure Decision**: un solo proyecto en `src/finIA/`. El manejador depende de interfaces
(`Interprete`, `Canal`, `Repositorio`) para que las pruebas usen dobles sin WhatsApp ni Ollama.
Capas finas por carpeta; sin frameworks.

## Flujo de un mensaje

```text
Baileys messages.upsert
  → filtro (grupo, fromMe, no en mensajes_enviados, texto, ≤ 500)   ── no → ignorar
  → ¿ya en mensajes_procesados? ── sí → ignorar
  → ¿anterior a primer_arranque? ── sí → ignorar ; ¿> 24 h? ── sí → ignorado_antiguo (+aviso al final)
  → cola en serie
  → ¿hay pendiente? ── sí → ¿afirmativo? ── sí → confirmar ; no → descartar + aviso, y seguir
  → intérprete (Ollama) ── error/timeout → aviso "no disponible"
  → validación (zod + reglas de contrato) ── falla → aviso con ejemplo
  → despachador (registrar | consultar | resumen | corregir | borrar)
  → transacción: mensajes_procesados + movimientos/cambios
  → enviar respuesta → guardar id en mensajes_enviados
```

## Trazabilidad requisito → diseño

| Requisito | Dónde |
|---|---|
| FR-001, FR-004, FR-007, FR-016 | `interprete/`, `dominio/categorias.ts`, reglas de [interpretacion.md](contracts/interpretacion.md) |
| FR-002, FR-002a, FR-012 | `acciones/registrar.ts`, `acciones/respuestas.ts` |
| FR-003, FR-020 | `dominio/fechas.ts`, `manejador.ts` (24 h, `primer_arranque`) |
| FR-005, FR-005a | `dominio/dinero.ts`, `acciones/confirmar.ts`, estado `pendiente` |
| FR-006, SC-005 | PK de `mensajes_procesados`, `UNIQUE` en `movimientos` |
| FR-008–FR-010 | `acciones/consultar.ts`, `acciones/resumen.ts`, SQL con enteros |
| FR-011 | `confirmacion_msg_id` + `contextInfo.stanzaId` de la cita |
| FR-013, FR-014 | `canal/filtro.ts`, tabla `mensajes_enviados` |
| FR-015 | `acciones/despachador.ts` |
| FR-017, SC-006 | validación de `FINIA_OLLAMA_URL` en `config.ts` |
| FR-018 | `config.ts`, `logger.ts`, `.gitignore` |
| FR-019 | `interprete/ollama.ts` (timeout, errores) |

## Complexity Tracking

Sin violaciones de la constitución que justificar.
