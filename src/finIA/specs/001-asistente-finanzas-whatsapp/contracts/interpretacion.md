# Contrato: salida del intérprete de lenguaje

Lo que el LLM local **propone** para cada mensaje. Es input no confiable (constitución I): el
código lo valida con este esquema y con las reglas de abajo antes de actuar. En el código, el
esquema zod es la fuente de verdad; este JSON Schema se genera de él y se envía a Ollama en
`format`.

## Esquema

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["accion"],
  "properties": {
    "accion": {
      "enum": ["registrar", "consultar", "resumen", "corregir", "borrar", "no_entendido"]
    },
    "movimientos": {
      "type": "array", "minItems": 1, "maxItems": 10,
      "items": {
        "type": "object", "additionalProperties": false,
        "required": ["tipo", "monto_texto", "categoria", "fecha"],
        "properties": {
          "tipo": { "enum": ["gasto", "ingreso"] },
          "monto_texto": { "type": "string", "maxLength": 30 },
          "categoria": { "enum": ["Comida", "Transporte", "Hogar", "Servicios", "Salud", "Educación",
                                  "Entretenimiento", "Ropa", "Salario", "Honorarios", "Regalo", "Otros"] },
          "fecha": { "type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}$" }
        }
      }
    },
    "consulta": {
      "type": "object", "additionalProperties": false,
      "required": ["tipo", "periodo"],
      "properties": {
        "tipo": { "enum": ["gasto", "ingreso", "ambos"] },
        "periodo": { "enum": ["hoy", "semana", "mes", "mes_concreto"] },
        "mes": { "type": "string", "pattern": "^\\d{4}-\\d{2}$" },
        "categoria": { "enum": ["...misma lista que movimientos..."] }
      }
    },
    "correccion": {
      "type": "object", "additionalProperties": false,
      "required": ["campo", "nuevo_valor"],
      "properties": {
        "campo": { "enum": ["monto", "categoria", "fecha"] },
        "nuevo_valor": { "type": "string", "maxLength": 30 }
      }
    },
    "pista": {
      "type": "object", "additionalProperties": false,
      "description": "Ayuda a elegir un movimiento cuando la confirmación citada agrupa varios",
      "properties": {
        "monto_texto": { "type": "string", "maxLength": 30 },
        "categoria": { "enum": ["...misma lista..."] }
      }
    }
  }
}
```

## Campos obligatorios por acción

| `accion` | Requiere | Ignora |
|---|---|---|
| `registrar` | `movimientos` | el resto |
| `consultar` | `consulta` (`mes` si `periodo = mes_concreto`) | el resto |
| `resumen` | — (`consulta.periodo`/`mes` opcionales; por defecto `mes`) | el resto |
| `corregir` | `correccion` (`pista` opcional) | el resto |
| `borrar` | — (`pista` opcional) | el resto |
| `no_entendido` | — | todo |

## Reglas que el código aplica después del esquema

Si cualquiera falla, **no se guarda ni modifica nada** y el dueño recibe un aviso (FR-007,
FR-016).

1. `monto_texto` se convierte a centavos **en código**. Debe dar un entero > 0.
2. Los dígitos de `monto_texto` deben aparecer en el texto original del mensaje.
3. `categoria` debe pertenecer a la lista de su `tipo` (p. ej. `Salario` no es un gasto).
4. `fecha` debe ser una fecha real, no posterior a la fecha de envío y no más de 366 días atrás.
5. En `registrar`, si **algún** movimiento falla, se rechaza el mensaje completo (FR-002a).
6. `corregir`/`borrar` afectan **exactamente un** movimiento `vigente`: el de la confirmación
   citada (desambiguado con `pista` si agrupa varios) o, sin cita, el último vigente (FR-011).
   No existe forma de expresar "todos" ni un rango: el esquema no lo permite.
7. Una respuesta del modelo que no sea JSON válido, no cumpla el esquema o tarde más del timeout
   se trata como intérprete no disponible o como `no_entendido` (FR-019).

## Lo que NO pasa por el intérprete

- La confirmación de un pendiente ("sí"): la decide el código con una lista fija de afirmativos.
- Mensajes de otros chats, de otras personas, del propio asistente, no textuales o de más de 500
  caracteres: se descartan antes.
