# Implementation Plan: Configuración, formato de respuestas y registro desde imágenes

**Branch**: `002-configuracion-formato-imagenes` | **Date**: 2026-10-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-configuracion-formato-imagenes/spec.md`

## Summary

Tres cambios sobre el asistente de la 001, sin dependencias nuevas:

1. **Configuración**: categorías y umbral pasan del código a la base (`categorias`, `estado`). Una
   conversación guiada, leída con reglas fijas y sin modelo, los define. El esquema del intérprete
   se genera con las categorías activas.
2. **Formato**: todos los textos de `respuestas.ts` se rehacen con el formato de WhatsApp (negritas,
   emojis por categoría, bloques monoespaciados para alinear), escapando los textos dinámicos.
3. **Imágenes**: Baileys descarga la foto (JPEG/PNG ≤ 5 MB, verificada por bytes). El mismo Ollama
   local, con un modelo de visión, propone artículos y total. El código suma en centavos, exige que
   cuadre al centavo, decide la fecha (escrita > ticket > preguntar), marca posibles repetidos y
   pide una sola confirmación.

Las cinco situaciones de "esperando respuesta" se unifican en una sola **espera activa**.

## Technical Context

**Language/Version**: TypeScript sobre Node.js 24 (type stripping), igual que la 001.

**Primary Dependencies**: las de la 001 (`baileys@7.0.0-rc14`, `zod@4.6.5`,
`qrcode-terminal@0.12.0`). Imágenes con `downloadMediaMessage` de Baileys. Sin dependencias nuevas.

**Storage**: SQLite (`node:sqlite`), migración v2 ([data-model.md](data-model.md)).

**Testing**: `node:test`; dobles nuevos de intérprete de tickets y de imágenes; evaluación real en
`eval/` con fotos de tickets.

**Target Platform**: la misma de la 001. Modelo de visión en Ollama local o de la red local.

**Project Type**: servicio de un proceso; la interfaz es el chat.

**Performance Goals**: propuesta de ticket < 45 s p95 (SC-005); texto sin cambios (< 10 s p95).

**Constraints**: imágenes JPEG/PNG ≤ 5 MB; ≤ 40 artículos; suma exacta al centavo; las imágenes no
se guardan; ninguna llamada fuera de la red local.

**Scale/Scope**: un usuario; decenas de tickets al mes.

**Unknowns**: ninguno. Modelo de visión elegido con evidencia en [research.md](research.md) R1;
se confirma con SC-004/SC-005 en `npm run eval`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cómo lo cumple el diseño | Pre | Post |
|---|---|---|---|
| I. Todo input es no confiable | La imagen se valida por tipo, tamaño y bytes; la salida de visión pasa por zod y por las reglas de [ticket.md](contracts/ticket.md); comandos, configuración, fecha escrita y confirmaciones se leen con código, nunca con el modelo; nombres de categoría restringidos (research R8) | ✅ | ✅ |
| II. El dinero es exacto y no se duplica | Importes en centavos con `parsearMonto`; suma exacta contra el total; ticket idempotente por `mensaje_origen_id UNIQUE`; posibles repetidos marcados antes de confirmar; guardar todo o nada | ✅ | ✅ |
| III. Los datos no salen de la máquina | Visión por la misma `FINIA_OLLAMA_URL` validada (loopback/RFC 1918); la imagen solo vive en memoria y no se escribe en disco (FR-022) | ✅ | ✅ |
| IV. Ningún secreto en el repo | Solo dos variables nuevas sin secretos; fotos de evaluación sin datos personales | ✅ | ✅ |
| V. Cada requisito tiene una prueba | Cada FR nuevo con prueba; los de seguridad con un intento de violarlo (categorías hostiles, imágenes hostiles, borrar ticket sin cita, imagen falsa por bytes); las pruebas de la 001 siguen, con los textos nuevos (SC-008) | ✅ | ✅ |
| Restricciones: dependencias | Ninguna nueva | ✅ | ✅ |
| Flujo | Spec y código en la rama `002-…` | ✅ | ✅ |

**Resultado**: sin violaciones.

**Nota**: FR-020a (borrar un ticket en bloque) es una excepción al "un registro por mensaje" de la
001, no a la constitución: es una acción más de la lista cerrada, reconocida por código, limitada a
un ticket citado y con confirmación explícita.

## Project Structure

### Documentation (this feature)

```text
specs/002-configuracion-formato-imagenes/
├── spec.md  plan.md  research.md  data-model.md  quickstart.md
├── contracts/
│   ├── conversacion.md    # textos v2: formato, configuración, imágenes
│   ├── ticket.md          # salida del modelo de visión + reglas
│   └── configuracion.md   # variables nuevas, comandos e intentos de respuesta
└── checklists/requirements.md
```

### Source Code (raíz: `src/finIA/`)

```text
src/
├── config.ts                    # + FINIA_OLLAMA_MODEL_VISION, FINIA_VISION_TIMEOUT_MS
├── tipos.ts                     # MensajeEntrante + imagen { mime, bytes } validada por zod
├── dominio/
│   ├── categorias.ts            # predeterminadas con emoji + validar nombres/listas
│   ├── formato.ts               # nuevo: negrita, escapar, emoji de categoría, tabla alineada
│   ├── fechas.ts                # + leerFechaEscrita (hoy/ayer/antier/dd/mm/dd/mm/aaaa)
│   └── repetidos.ts             # nuevo: normalizar texto, esPosibleRepetido
├── almacen/
│   ├── db.ts                    # migración v2 (reconstruye movimientos y mensajes_procesados)
│   └── repositorio.ts           # + configuración, categorías, espera, tickets
├── interprete/
│   ├── esquema.ts               # esquema de texto generado con categorías activas
│   ├── prompt.ts                # recibe las categorías
│   ├── ollama.ts                # + interpretarTicket (images, timeout de visión)
│   └── ticket.ts                # nuevo: esquema zod del ticket (contracts/ticket.md)
├── acciones/
│   ├── espera.ts                # nuevo: ofrece el mensaje a la espera activa
│   ├── comandos.ts              # nuevo: configurar, ver configuración, borra el ticket
│   ├── configuracion.ts         # nuevo: preguntas y respuestas de configuración
│   ├── ticket.ts                # nuevo: validar, proponer, confirmar, borrar ticket
│   ├── confirmar.ts             # el pendiente de la 001 pasa a ser una espera
│   └── respuestas.ts            # reescrito con contracts/conversacion.md (v2)
├── canal/
│   ├── filtro.ts                # acepta texto o imagen
│   └── whatsapp.ts              # imageMessage + downloadMediaMessage + verificación
└── manejador.ts                 # nuevo orden (abajo)

tests/
├── unit/          formato, leerFechaEscrita, repetidos, nombres de categoría, esquema de ticket
├── integration/   configuracion, espera, ticket (propuesta, fecha, repetidos, borrar), formato
│                  de todas las respuestas; las de la 001 actualizadas a los textos v2
├── seguridad/     categorias-hostiles, imagenes-hostiles, imagen-bytes, borrar-ticket
└── dobles/        interprete-falso con interpretarTicket programable

eval/
├── tickets/       10 fotos + esperado.json (SC-004, SC-005)
├── hostiles-imagen/ 10 imágenes hostiles (SC-006)
└── correr.ts      + evaluación de tickets e imágenes hostiles
```

**Structure Decision**: mismo proyecto y mismas capas que la 001. La lógica nueva va en módulos
nuevos; los existentes solo cambian donde la spec modifica requisitos (categorías, umbral, textos).

## Flujo de un mensaje (v2)

```text
WhatsApp → validación de esquema (texto o imagen) → cola en serie
  → filtro (grupo, dueño, no propio, texto o imagen válida) → ¿ya procesado? → antigüedad (001)
  → ¿configuración pendiente (nunca configurado)? → iniciar configuración con este mensaje
  → ¿espera activa? → ¿la responde? ── sí → resolver (configuración, fecha, confirmación, borrado)
                                     └ no → cancelar/pausar con aviso y seguir
  → ¿comando (configurar, ver configuración, borra el ticket + cita)? → resolver con código
  → ¿imagen? → modelo de visión → reglas de ticket.md → propuesta + espera
  → texto → intérprete (esquema con categorías activas) → lista cerrada (001)
  → transacción → respuesta v2
```

## Trazabilidad requisito → diseño

| Requisito | Dónde |
|---|---|
| FR-001, FR-002, FR-003, FR-005, FR-006, FR-006a, FR-008, FR-009 | `acciones/configuracion.ts`, `acciones/comandos.ts`, `acciones/espera.ts` |
| FR-004, FR-006b | `dominio/categorias.ts`, tabla `categorias` (`activa`) |
| FR-007 | `interprete/esquema.ts` generado, umbral desde `estado` en `registrar.ts` |
| FR-010 a FR-015 | `dominio/formato.ts`, `acciones/respuestas.ts`, pruebas de la 001 actualizadas |
| FR-016, FR-021 | `canal/whatsapp.ts`, `tipos.ts`, `canal/filtro.ts` |
| FR-017, SC-007 | `interprete/ollama.ts` con la URL validada de la 001 |
| FR-018, FR-018a, FR-018b | `interprete/ticket.ts`, `acciones/ticket.ts` |
| FR-018c, FR-020 | `dominio/fechas.ts` (`leerFechaEscrita`), `acciones/ticket.ts` |
| FR-018d | `dominio/repetidos.ts` |
| FR-019, FR-020a | `acciones/ticket.ts`, `acciones/espera.ts`, tabla `tickets` |
| FR-022 | la imagen no se persiste; prueba que revisa la base |
| FR-023 | `interprete/ollama.ts` (timeout de visión) |

## Complexity Tracking

Sin violaciones de la constitución que justificar.
