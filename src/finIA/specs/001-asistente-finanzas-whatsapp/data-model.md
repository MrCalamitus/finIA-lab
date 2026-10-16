# Data Model: Asistente de finanzas personales por WhatsApp

**Fase 1 de** [plan.md](plan.md) · Almacenamiento: SQLite local (`data/finia.db`), ver
[research.md](research.md) R8.

## Diagrama

```text
mensajes_procesados 1 ──── 0..N movimientos 1 ──── 0..N cambios
        (mensaje_id)        (mensaje_origen_id)      (movimiento_id)

mensajes_enviados            estado (clave/valor)
```

## Movimiento (`movimientos`)

Un gasto o un ingreso.

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | INTEGER PK | autoincremental |
| `tipo` | TEXT | `gasto` \| `ingreso` |
| `monto_centavos` | INTEGER | > 0. Entero, nunca flotante (FR-005) |
| `categoria` | TEXT | debe pertenecer a la lista del `tipo` (ver Categoría) |
| `fecha` | TEXT | `YYYY-MM-DD`; no futura respecto al envío; máx. 366 días atrás |
| `texto_original` | TEXT | texto del mensaje que lo originó |
| `mensaje_origen_id` | TEXT | FK → `mensajes_procesados.mensaje_id` |
| `indice_en_mensaje` | INTEGER | 0..9: posición dentro de un mensaje con varios movimientos |
| `confirmacion_msg_id` | TEXT NULL | id del mensaje del asistente que lo confirmó (para citar, FR-011) |
| `estado` | TEXT | `pendiente` \| `vigente` \| `borrado` \| `descartado` |
| `creado_en` | TEXT | ISO 8601 |
| `actualizado_en` | TEXT | ISO 8601 |

- **Unicidad**: `UNIQUE (mensaje_origen_id, indice_en_mensaje)`. Junto con la PK de
  `mensajes_procesados`, impide duplicados aunque un mensaje se entregue 100 veces (SC-005).
- **Índices**: `(estado, fecha)` para consultas; `confirmacion_msg_id` para correcciones citadas.
- **Solo los `vigente` cuentan** en consultas y resúmenes (FR-005a, FR-009).
- **Nunca se borran filas**: borrar = pasar a `borrado` (borrado lógico).

### Transiciones de estado

```text
                 monto ≤ $50,000.00
 (interpretado) ───────────────────────────────► vigente ──(borrar)──► borrado
       │                                           ▲
       │ algún monto > $50,000.00                  │ siguiente mensaje = afirmativo
       ▼                                           │
   pendiente ──────────────────────────────────────┘
       │
       └── siguiente mensaje ≠ afirmativo ──► descartado
```

- Solo puede haber **un mensaje pendiente** a la vez (todos sus movimientos juntos, FR-002a).
- `borrado` y `descartado` son finales. `vigente` admite correcciones de `monto_centavos`, `categoria` y `fecha`.

## Cambio (`cambios`)

Historial de correcciones, borrados y descartes. Permite confirmar "antes → después" (FR-012) y
auditar.

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | INTEGER PK | |
| `movimiento_id` | INTEGER | FK → `movimientos.id` |
| `accion` | TEXT | `corregir` \| `borrar` \| `descartar` \| `confirmar` |
| `campo` | TEXT NULL | `monto_centavos` \| `categoria` \| `fecha` (solo en `corregir`) |
| `valor_anterior` | TEXT NULL | |
| `valor_nuevo` | TEXT NULL | |
| `mensaje_id` | TEXT | mensaje del dueño que provocó el cambio |
| `creado_en` | TEXT | ISO 8601 |

## Mensaje procesado (`mensajes_procesados`)

Constancia de que un mensaje del dueño ya fue atendido.

| Campo | Tipo | Reglas |
|---|---|---|
| `mensaje_id` | TEXT PK | `<remoteJid>:<key.id>` |
| `enviado_en` | TEXT | `messageTimestamp` en ISO 8601 |
| `resultado` | TEXT | `registrado` \| `pendiente` \| `consulta` \| `resumen` \| `correccion` \| `borrado` \| `confirmado` \| `rechazado` \| `ignorado_antiguo` |
| `procesado_en` | TEXT | ISO 8601 |

- La inserción ocurre **en la misma transacción** que los movimientos o cambios que provoca.
- Si el `mensaje_id` ya existe, el mensaje no se vuelve a procesar ni a responder (FR-006).

## Mensaje enviado (`mensajes_enviados`)

Ids de los mensajes que escribió el asistente, para no procesarlos (FR-014).

| Campo | Tipo | Reglas |
|---|---|---|
| `mensaje_id` | TEXT PK | `<remoteJid>:<key.id>` devuelto por el envío |
| `enviado_en` | TEXT | ISO 8601 |

## Estado (`estado`)

Clave/valor para datos de operación.

| Clave | Valor |
|---|---|
| `primer_arranque` | ISO 8601 del primer arranque; mensajes anteriores se ignoran (R4) |
| `version_esquema` | entero, para migraciones |

## Categoría (constante en código, no tabla)

Lista fija definida por el proyecto (Assumptions). El dueño no crea categorías.

| Tipo | Categorías |
|---|---|
| gasto | Comida, Transporte, Hogar, Servicios, Salud, Educación, Entretenimiento, Ropa, Otros |
| ingreso | Salario, Honorarios, Regalo, Otros |

Una categoría que no pertenece a la lista de su tipo hace que la interpretación se rechace
(Edge Cases, FR-016).

## Valores derivados (no se guardan)

- **Periodo** de consulta: `hoy`, `semana` (lunes a domingo), `mes` (calendario), `mes_concreto`
  (`YYYY-MM`). Se resuelve a un rango `[desde, hasta]` de fechas en código.
- **Totales**: `SUM(monto_centavos)` y `COUNT(*)` sobre `vigente`, en SQL, con enteros (SC-003).
- **Balance**: ingresos − gastos, en centavos.
