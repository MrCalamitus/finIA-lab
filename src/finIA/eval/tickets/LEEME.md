# Fotos de tickets para `npm run eval` (SC-004, SC-005)

1. Pon aquí 10 fotos de tickets reales, en JPG o PNG de hasta 5 MB: `ticket-01.jpg`, `ticket-02.jpg`…
2. Crea `esperado.json` con lo que dice cada ticket:

```json
{
  "ticket-01.jpg": {
    "fecha": "2026-10-12",
    "total_centavos": 22990,
    "articulos": [
      { "descripcion": "Leche entera 1 l", "cantidad": "2 x", "centavos": 5700 },
      { "descripcion": "Manzana gala", "cantidad": "800 g", "centavos": 3600 }
    ]
  }
}
```

- `centavos` es el importe de la línea ya con su descuento.
- La comparación de descripciones ignora mayúsculas, acentos y espacios.

**Privacidad:** revisa que los tickets no tengan datos personales (nombre, RFC propio, últimos dígitos
de tarjeta) antes de versionarlos, o déjalos fuera del repo.
