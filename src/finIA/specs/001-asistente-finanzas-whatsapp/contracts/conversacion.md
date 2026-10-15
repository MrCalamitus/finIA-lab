# Contrato: conversación en el grupo

> **Sustituido por la v2** ([002](../../002-configuracion-formato-imagenes/contracts/conversacion.md)):
> mismas entradas y garantías, con formato de WhatsApp, configuración e imágenes. Este archivo
> queda como registro de la 001.

La interfaz del producto es el chat. Este contrato fija lo que el dueño puede escribir y lo que el
asistente responde. Las pruebas de integración comparan contra estos formatos. Los montos usan
`$12,500.00` y las fechas `hoy`, `ayer` o `dd/mm/aaaa`.

## Entradas aceptadas

Solo mensajes de **texto** del grupo configurado, del dueño, de ≤ 500 caracteres. Todo lo demás se
ignora **sin responder**, excepto lo indicado abajo.

| Intención | Ejemplos |
|---|---|
| Registrar | "gasté 180 en tacos", "me pagaron 12,500 de la quincena", "ayer gasté 99.90 en el súper", "gasté 50 en café y 200 en gasolina" |
| Consultar | "¿cuánto llevo gastado este mes en comida?", "¿cuánto gasté esta semana?", "¿cuánto gané en septiembre?" |
| Resumen | "resumen", "resumen de septiembre" |
| Corregir | (citando una confirmación) "era 150", "cámbialo a Transporte"; sin citar: "corrige el último a 150" |
| Borrar | (citando una confirmación) "bórralo"; sin citar: "borra el último" |
| Confirmar pendiente | "sí", "si", "confirmo" (solo cuando hay un pendiente) |

## Respuestas

| Situación | Respuesta |
|---|---|
| Registro de un movimiento | `Registrado: gasto de $180.00 · Comida · hoy` |
| Registro de varios | `Registrados 2 movimientos:`<br>`1. gasto de $50.00 · Comida · hoy`<br>`2. gasto de $200.00 · Transporte · hoy` |
| Monto > $50,000.00 | `¿Confirmas ingreso de $75,000.00 · Salario · hoy? Responde "sí" para guardarlo.` |
| Monto > $50,000.00, varios movimientos | `¿Confirmas estos 2 movimientos?`<br>`1. …`<br>`2. …`<br>`Responde "sí" para guardarlos.` |
| Pendiente confirmado | igual que "Registro de un movimiento" o "Registro de varios" |
| Pendiente descartado | `No guardé el ingreso de $75,000.00 porque no lo confirmaste.` / `No guardé los 2 movimientos porque no los confirmaste.` (y después se atiende el mensaje nuevo) |
| Consulta | `Comida en octubre: $2,340.00 (14 gastos)` · `Gastos esta semana: $500.50 (2 gastos)` · `Ingresos hoy: $9,800.00 (1 ingreso)` · otro año: `Gastos en diciembre de 2025: …` |
| Consulta de ingresos y gastos juntos | `Ingresos en octubre: $12,500.00 (1 ingreso)`<br>`Gastos en octubre: $180.00 (1 gasto)` |
| Consulta sin datos | `No hay gastos de Comida en octubre.` · `No hay movimientos en octubre.` (ingresos y gastos) |
| Resumen | `Resumen de octubre`<br>`Ingresos: $12,500.00`<br>`Gastos: $4,120.50`<br>`Balance: $8,379.50`<br>`Por categoría:`<br>`· Comida $2,340.00`<br>`· …` (categorías de gasto de mayor a menor; balance negativo con `-$`) |
| Resumen sin datos | `No hay movimientos en octubre.` |
| Corrección de monto | `Corregido: gasto · Comida · hoy. Monto: $180.00 → $150.00` |
| Corrección de categoría | `Corregido: gasto de $180.00 · hoy. Categoría: Comida → Transporte` |
| Corrección de fecha | `Corregido: gasto de $180.00 · Comida. Fecha: hoy → ayer` |
| Nuevo valor no válido | `No entendí el nuevo valor "Salario". No cambié nada.` |
| Corrección a más de $50,000.00 | `No corregí: $60,000.00 supera $50,000.00. Borra el registro y regístralo de nuevo para confirmarlo.` |
| Borrado | `Borrado: gasto de $180.00 · Comida · hoy` |
| Corrección sin registro que coincida | `No encontré qué corregir. Cita la confirmación del registro o escribe "corrige el último …".` |
| Borrado sin registro que coincida | `No encontré qué borrar. Cita la confirmación del registro o escribe "borra el último".` |
| Cita ambigua (varios movimientos) | `Esa confirmación tiene 2 movimientos. Dime cuál: el de $50.00 o el de $200.00.` |
| No se entendió | `No pude registrarlo. Escríbelo así: "gasté 180 en tacos".` |
| Varios movimientos, uno inválido | `No guardé nada: no entendí "…". Envíalo de nuevo, por ejemplo: "gasté 50 en café y 200 en gasolina".` |
| Intérprete no disponible | `No puedo interpretar mensajes en este momento. No guardé nada; inténtalo de nuevo en un rato.` |
| Mensajes antiguos ignorados | `Estuve apagado. Ignoré 3 mensajes de hace más de 24 h; reenvíalos si quieres registrarlos.` · con uno: `Ignoré 1 mensaje …; reenvíalo si quieres registrarlo.` |
| Error interno al guardar | `Algo falló y no guardé nada. Inténtalo de nuevo.` |
| Mensaje no financiero ("hola") | `No pude registrarlo. Escríbelo así: "gasté 180 en tacos".` |
| Mensaje > 500 caracteres | `Tu mensaje es muy largo. Envía un movimiento o pregunta a la vez.` |

## Garantías

- Cada respuesta se envía **después** de guardar; nunca se confirma algo que no quedó guardado.
- El asistente responde una sola vez por mensaje, aunque el mensaje llegue varias veces.
- El id de cada respuesta se guarda para no procesarla como mensaje nuevo (FR-014).
- Si el envío de una respuesta falla, se reintenta hasta 3 veces; si nunca sale, queda en el
  registro de actividad (lo guardado no se revierte).
- Los textos viven en `src/acciones/respuestas.ts`; las pruebas comparan contra ellos.
