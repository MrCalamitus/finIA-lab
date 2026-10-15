# Contrato: salida del intérprete de tickets

Lo que el modelo de visión **propone** para una foto. Es input no confiable (constitución I): se
valida con zod y con las reglas de abajo antes de mostrar nada. El esquema zod es la fuente de
verdad; el JSON Schema se genera de él (sin `pattern`) y se envía en `format`.

## Esquema

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["es_ticket", "comercio", "fecha", "total_texto", "articulos"],
  "properties": {
    "es_ticket":   { "type": "boolean" },
    "comercio":    { "type": ["string", "null"], "maxLength": 60 },
    "fecha":       { "type": ["string", "null"], "maxLength": 10 },
    "total_texto": { "type": ["string", "null"], "maxLength": 20 },
    "articulos": {
      "type": "array", "maxItems": 41,
      "items": {
        "type": "object", "additionalProperties": false,
        "required": ["descripcion", "cantidad", "importe_texto", "descuento_texto", "categoria"],
        "properties": {
          "descripcion":     { "type": "string", "minLength": 1, "maxLength": 60 },
          "cantidad":        { "type": ["string", "null"], "maxLength": 20 },
          "importe_texto":   { "type": "string", "maxLength": 20 },
          "descuento_texto": { "type": ["string", "null"], "maxLength": 20 },
          "categoria":       { "enum": ["…categorías de gasto activas…"] }
        }
      }
    }
  }
}
```

`maxItems: 41` permite detectar "más de 40" y responder el aviso de FR-018b en lugar de truncar.

## Reglas que aplica el código (en orden)

Si una falla, no hay propuesta y se responde el aviso correspondiente de
[conversacion.md](conversacion.md).

1. `es_ticket = false` o `articulos` vacío → "No es ticket".
2. Más de 40 artículos → "Más de 40 artículos".
3. `total_texto` nulo o no convertible con `parsearMonto` → "Falta el total".
4. Cada `importe_texto` y `descuento_texto` se convierte con `parsearMonto` (al descuento se le
   quita un `-` inicial). Si alguno no convierte → "Suma no cuadra" con la suma que sí se pudo leer.
5. Cada artículo: `centavos = importe − descuento`, debe ser > 0.
6. `Σ centavos == total` al centavo → si no, "Suma no cuadra".
7. `categoria` debe ser una categoría de gasto **activa**; si no, se usa `Otros`.
8. `descripcion`, `cantidad` y `comercio` se recortan y se les quitan símbolos de formato y
   caracteres de control.
9. Fecha (FR-018c): fecha escrita por el dueño (research R5) → si no, `fecha` del modelo si cumple
   `^\d{4}-\d{2}-\d{2}$` y `validarFecha` → si no, espera `ticket_fecha`.
10. Posibles repetidos (research R6) contra movimientos vigentes de esa fecha.

## Lo que NO hace el modelo

- No decide la fecha escrita, no confirma, no borra ni configura.
- Ningún texto de la imagen ni del pie de foto puede cambiar estas reglas.
