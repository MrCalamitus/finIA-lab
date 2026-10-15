# FinIA

Asistente de finanzas personales que vive en un grupo de WhatsApp donde solo estás tú. Escribes
"gasté 180 en tacos" y responde "Registrado: gasto de $180.00 · Comida · hoy". Un modelo de
lenguaje local (Ollama) interpreta los mensajes: tus datos financieros no salen de tu máquina.

Especificación, plan y decisiones: [`specs/001-asistente-finanzas-whatsapp/`](specs/001-asistente-finanzas-whatsapp/).

> ⚠️ **WhatsApp no oficial.** La conexión usa [Baileys](https://github.com/WhiskeySockets/Baileys),
> una librería no afiliada a WhatsApp. Su uso puede violar los términos de servicio y provocar la
> suspensión del número. Úsala solo en un grupo propio, sin envíos masivos. El riesgo es tuyo; si
> no quieres arriesgar tu número principal, usa uno secundario.

## Requisitos

- Node.js 24 o superior.
- Ollama con un modelo descargado, en tu máquina o en un servidor de tu red local.
- Un grupo de WhatsApp donde solo estás tú (ver `docs/00-prework.md` en la raíz del repo).

## Puesta en marcha

```bash
npm ci                     # instala exactamente las versiones del lockfile
cp .env.example .env       # llena FINIA_OLLAMA_MODEL
npm run grupos             # escanea el QR y copia el id de tu grupo a FINIA_GROUP_JID
npm start                  # arranca el asistente
```

Todas las variables están descritas en
[`contracts/configuracion.md`](specs/001-asistente-finanzas-whatsapp/contracts/configuracion.md).
`.env`, la carpeta de sesión de WhatsApp (`auth_info/`) y la base de datos (`data/`) nunca se
versionan.

### Actualizar a la 002 (configuración, formato e imágenes)

La 002 migra la base de datos al arrancar (versión 2 del esquema). Antes de la primera
ejecución, detén el asistente y respalda la base:

```bash
cp data/finia.db data/finia.db.respaldo
```

La migración es automática y conserva todos tus movimientos. Si algo sale mal, restaura el
respaldo y reporta el error.

## Qué puedes escribir

| Quieres | Escribe |
|---|---|
| Registrar | "gasté 180 en tacos", "me pagaron 12,500 de la quincena", "gasté 50 en café y 200 en gasolina" |
| Consultar | "¿cuánto llevo gastado este mes en comida?", "¿cuánto gasté esta semana?" |
| Resumen | "resumen", "resumen de septiembre" |
| Corregir | cita la confirmación y escribe "era 150"; o "corrige el último a 150" |
| Borrar | cita la confirmación y escribe "bórralo"; o "borra el último" |
| Registrar un ticket | envía la foto (con o sin texto, p. ej. "ayer"); revisa la propuesta y responde "sí" |
| Borrar un ticket | cita "Guardé el ticket…" y escribe "borra el ticket"; luego "sí" |
| Configurar | "configurar" (categorías de gasto y monto de confirmación), "configurar ingresos", "ver configuración" |

La primera vez que escribes, el asistente atiende tu mensaje y luego te hace dos preguntas para
configurarlo. Los montos mayores a tu monto de confirmación ($50,000.00 si no lo cambias) se guardan
solo si respondes "sí". Todas las respuestas posibles están en
[`contracts/conversacion.md`](specs/002-configuracion-formato-imagenes/contracts/conversacion.md).

### Fotos de tickets

- Solo JPG o PNG de hasta 5 MB. La foto no se guarda: solo los artículos que confirmes.
- Se lee cada artículo con su cantidad y precio, y la suma debe coincidir **al centavo** con el
  total del ticket; si no, te pide una foto más nítida.
- La fecha sale de lo que escribas junto a la foto ("ayer", "12/10") o, si no, del ticket. Del
  texto solo se toma la fecha: los productos y montos escritos se ignoran.
- Si un artículo se parece a algo ya registrado (misma fecha, mismo monto y nombre parecido), se
  marca como posible repetido y puedes responder "sin repetidos".
- Las fotos se leen con el mismo Ollama local, con `FINIA_OLLAMA_MODEL_VISION` o, si no lo
  defines, con `FINIA_OLLAMA_MODEL` (debe tener la capacidad `vision`).

## Pruebas

```bash
npm test                   # unitarias, integración y seguridad; no necesitan WhatsApp ni Ollama
npm run typecheck
npm run eval               # evalúa el modelo real: SC-001, SC-002 y SC-004 (necesita Ollama)
```

`npm run eval` termina con error si el modelo acierta menos de 27 de 30 mensajes típicos, si el
p95 de respuesta llega a 10 s o si algún mensaje hostil provoca un cambio no permitido.

## Cómo está hecho

```text
WhatsApp (Baileys) → validación de esquema → filtro (grupo, dueño, no propio)
  → cola en serie → ¿ya procesado? → ¿pendiente de confirmar?
  → Ollama (propone JSON) → validación zod + reglas → lista cerrada de acciones
  → SQLite (transacción) → respuesta
```

El modelo solo **propone**; el código decide. Los montos se guardan como enteros en centavos y
cada mensaje se registra una sola vez aunque llegue repetido.
