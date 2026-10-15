# Quickstart: validar configuración, formato e imágenes

Guía de validación de punta a punta. Formatos: [contracts/conversacion.md](contracts/conversacion.md).
Comandos y variables: [contracts/configuracion.md](contracts/configuracion.md).

## Requisitos

- Lo de la [quickstart de la 001](../001-asistente-finanzas-whatsapp/quickstart.md) funcionando.
- Un modelo con capacidad `vision` en Ollama (por defecto, el mismo `FINIA_OLLAMA_MODEL`).
- 10 fotos de tickets reales en `eval/tickets/` con su archivo de respuestas esperadas (sin datos
  personales que no quieras versionar).
- **Una sola** copia de `npm start` corriendo.

## 1. Pruebas automatizadas

```bash
npm run typecheck
npm test        # incluye las pruebas de la 001 con los textos nuevos (SC-008)
```

## 2. Evaluación con los modelos reales

```bash
npm run eval
```

**Esperado**: lo de la 001 (SC-002 ≥ 27/30, p95 < 10 s, SC-004 de la 001 0/20) y además:
- Tickets: ≥ 8/10 suman exactamente el total con la fecha correcta; ≥ 7/10 con todos los artículos
  correctos (SC-004); p95 < 45 s (SC-005).
- 10 imágenes hostiles y 10 listas de categorías hostiles: 0 cambios sin confirmación (SC-006).

## 3. En tu grupo de WhatsApp

Parte de una base de prueba nueva (`FINIA_DB_PATH=./data/prueba.db`) para ver la configuración
inicial.

| # | Haces | Esperado | Cubre |
|---|---|---|---|
| C1 | `hola` | bienvenida y pregunta 1/2 | FR-001 |
| C2 | `Comida, Transporte, Mascotas, Gimnasio` | lista guardada + "Otros"; pregunta 2/2 | FR-003 |
| C3 | `5,000` | "Configuración guardada" | FR-005 |
| C4 | `gasté 6,000 en el veterinario` | pide confirmación; 🏷️ Mascotas | SC-002 |
| C5 | `configurar`, luego `gasté 180 en tacos` | se pausa y registra el gasto | FR-006a |
| C6 | `ver configuración` | categorías y umbral vigentes | FR-008 |
| F1 | `gasté 180 en tacos` | `✅ Registrado: *$180.00* · 🌮 Comida · hoy` con negritas visibles | FR-011 |
| F2 | `resumen` | montos alineados en bloque monoespaciado | FR-013 |
| I1 | foto de un ticket | "✅ Guardé el ticket…" con artículos, cantidades y "Suman … igual que el total", sin pedir confirmación | FR-018, FR-018a, FR-019 |
| I2 | `resumen` | incluye los artículos del ticket | FR-019 |
| I3 | misma foto otra vez | artículos marcados como posibles repetidos; `sin repetidos` no guarda nada | FR-018d |
| I4 | foto sin fecha visible, luego `9 de octubre` | pide la fecha; con la fecha guarda directo | FR-018c, FR-019 |
| I5 | foto con texto `ayer gasté 50 en café` | fecha de ayer; aviso de que se ignoró el texto | FR-020 |
| I6 | cita "Guardé el ticket…" y `borra el ticket`, luego `sí` | pregunta y borra todos sus artículos | FR-020a |
| I7 | foto de un paisaje | "No encontré un ticket" | escenario 7 |
| I8 | un PDF o un sticker | aviso o se ignora; nada guardado | FR-021 |

## 4. Privacidad

Igual que en la 001: con `lsof -i -P | grep node`, solo WhatsApp y la URL de Ollama configurada
(SC-007). La carpeta `data/` no contiene imágenes (FR-022).
