# Data Model: Configuración, formato de respuestas y registro desde imágenes

**Fase 1 de** [plan.md](plan.md). Extiende el [modelo de la 001](../001-asistente-finanzas-whatsapp/data-model.md)
con la **migración v2**. SQLite no permite cambiar un `CHECK`, así que `movimientos` y
`mensajes_procesados` se reconstruyen (crear nueva, copiar, renombrar) dentro de una transacción.

## Diagrama

```text
categorias (tipo, nombre, activa)        estado (umbral, configuración)       espera (1 fila)

tickets 1 ──── 0..40 movimientos ──── 0..N cambios
   │                 │
   └─ mensaje_origen_id → mensajes_procesados ←─ mensaje_origen_id
```

## Categoría (`categorias`) — nueva

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | INTEGER PK | |
| `tipo` | TEXT | `gasto` \| `ingreso` |
| `nombre` | TEXT | `^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]{1,20}$`, ≤ 3 palabras |
| `emoji` | TEXT | fijo para las predeterminadas, `🏷️` para las del dueño |
| `activa` | INTEGER | 1 = elegible para registros y correcciones nuevos; 0 = quitada (FR-006b) |
| `orden` | INTEGER | orden de presentación |

- `UNIQUE (tipo, nombre COLLATE NOCASE)`. Máximo 15 activas por tipo (validado en código).
- `Otros` existe siempre activa en ambos tipos; no se puede desactivar.
- La migración siembra las predeterminadas de la 001 con sus emojis:
  gasto: Comida 🌮, Transporte 🚌, Hogar 🏠, Servicios 💡, Salud 💊, Educación 📚,
  Entretenimiento 🎬, Ropa 👕, Otros 📦 · ingreso: Salario 💼, Honorarios 🧾, Regalo 🎁, Otros 📦.
- Configurar una lista nueva: las que no están pasan a `activa = 0`, las nuevas se insertan, las que
  vuelven se reactivan. Nunca se borran filas (los movimientos guardan el nombre como texto).

## Estado (`estado`) — claves nuevas

| Clave | Valor |
|---|---|
| `umbral_centavos` | entero entre 10000 y 100000000 ($100.00–$1,000,000.00). Predeterminado 5000000 |
| `configuracion` | `pendiente` (nunca configurado) \| `pausada` \| `completa` |
| `version_esquema` | `2` |

## Espera (`espera`) — nueva

Lo que el asistente espera del siguiente mensaje (research R7). Como máximo una.

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | INTEGER PK | `CHECK (id = 1)` |
| `tipo` | TEXT | `config_categorias_gasto` \| `config_umbral` \| `config_categorias_ingreso` \| `ticket_fecha` \| `ticket_confirmacion` \| `borrar_ticket` \| `registro_pendiente` |
| `referencia` | TEXT NULL | id del ticket o `mensaje_origen_id` del registro pendiente |
| `creado_en` | TEXT | ISO 8601 |

## Ticket (`tickets`) — nueva

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | INTEGER PK | |
| `mensaje_origen_id` | TEXT UNIQUE | FK → `mensajes_procesados` (diferida); la foto que lo originó |
| `comercio` | TEXT NULL | ≤ 60 caracteres, sin símbolos de formato |
| `fecha` | TEXT NULL | `YYYY-MM-DD`; NULL solo en `esperando_fecha` |
| `origen_fecha` | TEXT NULL | `texto` \| `ticket` |
| `total_centavos` | INTEGER | > 0; igual a la suma de la propuesta |
| `propuesta` | TEXT | JSON validado de artículos (ver abajo) mientras no se guarda |
| `texto_foto` | TEXT NULL | texto que acompañó la foto |
| `estado` | TEXT | `esperando_fecha` \| `pendiente` \| `guardado` \| `descartado` \| `borrado` |
| `confirmacion_msg_id` | TEXT NULL | id de la respuesta "Guardé el ticket…" (para citarla) |
| `creado_en`, `actualizado_en` | TEXT | ISO 8601 |

**Artículo de la propuesta** (JSON en `propuesta`, validado con zod al guardar y al leer):
`{ descripcion (1–60), cantidad (≤ 20 | null), centavos (> 0, monto final), centavosLeidos (> 0, importe impreso con su descuento), descuentoCentavos (≥ 0), categoria (activa), repetidoDe (id de movimiento | null), repetidoTexto }`.
Máximo 40 artículos. La propuesta guarda además `ajuste: { impuestoCentavos, descuentoGeneralCentavos } | null`
(FR-018e); `centavos` ya incluye la parte del ajuste de cada artículo y es lo que se guarda en el movimiento.

### Transiciones

```text
(foto válida) ──fecha conocida──► pendiente ──"sí" / "sin repetidos"──► guardado ──"borra el ticket" + "sí"──► borrado
      │                              │
      └─sin fecha─► esperando_fecha ─┤ fecha escrita / otra foto ─► pendiente
                                     └─ otra cosa ─► descartado
```

Al pasar a `guardado` se insertan los movimientos `vigente` en la misma transacción; la propuesta
se conserva como registro de lo leído.

## Movimiento (`movimientos`) — modificado

Campos nuevos y restricciones cambiadas (el resto, igual que en la 001):

| Campo | Tipo | Reglas |
|---|---|---|
| `origen` | TEXT | `texto` \| `imagen`; las filas de la 001 migran como `texto` |
| `descripcion` | TEXT NULL | descripción del artículo (solo origen `imagen`) |
| `cantidad` | TEXT NULL | "800 g", "3 piezas", "2 x" (solo origen `imagen`) |
| `ticket_id` | INTEGER NULL | FK → `tickets.id` |
| `indice_en_mensaje` | INTEGER | **0..39** (antes 0..9) |
| `categoria` | TEXT | se valida contra las categorías **activas** al registrar o corregir; las consultas aceptan cualquiera existente |

`texto_original` de un movimiento de imagen es el texto de la foto o `"[ticket]"`.

## Mensaje procesado (`mensajes_procesados`) — modificado

`resultado` añade: `configuracion` · `ticket_esperando_fecha` · `ticket_propuesto` ·
`ticket_guardado` · `ticket_descartado` · `ticket_borrado` · `imagen_rechazada`.

## Cambio (`cambios`) — modificado

`accion` añade `borrar_ticket` (un cambio por cada artículo borrado en bloque, todos con el mismo
`mensaje_id`).
