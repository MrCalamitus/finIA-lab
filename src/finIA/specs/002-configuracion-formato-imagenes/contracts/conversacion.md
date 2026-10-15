# Contrato: conversación (v2)

Sustituye los textos de [conversacion.md de la 001](../../001-asistente-finanzas-whatsapp/contracts/conversacion.md).
Las **entradas aceptadas y las garantías de la 001 siguen igual**; cambia el formato (FR-010 a
FR-015) y se añaden configuración e imágenes. Las pruebas comparan contra estos textos.

## Reglas de formato

- Solo `*negrita*`, `_cursiva_`, ```` ```monoespaciado``` ````, viñetas `•` y emojis (FR-010).
- Montos siempre en negrita (`*$180.00*`), salvo dentro de bloques monoespaciados.
- Cada categoría lleva su emoji (`🌮 Comida`); las del dueño, `🏷️` (FR-012).
- Los textos dinámicos (categorías, descripciones, comercio) se escapan: se quitan `*` `_` `~` `` ` ``.
- Emojis de resultado: ✅ hecho · 🤔 pregunta · ⚠️ aviso o error · 📊 consulta/resumen · 🧾 ticket ·
  ⚙️ configuración · 🗑️ borrado · ✏️ corrección · 🕒 mensajes atrasados.
- Los ejemplos de uso van en monoespaciado: ```` ```gasté 180 en tacos``` ```` (FR-014).

## Registro, consultas, correcciones (formatos nuevos de la 001)

| Situación | Respuesta |
|---|---|
| Registro de uno | `✅ Registrado: gasto de *$180.00* · 🌮 Comida · hoy` (se conserva el tipo: "Otros" existe en gasto e ingreso) |
| Registro de varios | `✅ *Registrados 2 movimientos*`<br>`• gasto de *$50.00* · 🌮 Comida · hoy`<br>`• gasto de *$200.00* · 🚌 Transporte · hoy` |
| Pide confirmación (umbral) | `🤔 ¿Confirmas ingreso de *$75,000.00* · 💼 Salario · hoy?`<br>`Responde *sí* para guardarlo.` · varios: `🤔 ¿Confirmas estos 2 movimientos?` + viñetas + `Responde *sí* para guardarlos.` |
| Pendiente descartado | `⚠️ No guardé el ingreso de *$75,000.00* porque no lo confirmaste.` |
| Consulta | `📊 *Comida en octubre*`<br>`*$2,340.00* · 14 gastos` |
| Consulta de ingresos y gastos | `📊 *Octubre*`<br>`💰 Ingresos: *$12,500.00* · 1 ingreso`<br>`💸 Gastos: *$180.00* · 1 gasto` |
| Sin datos | `📊 No hay gastos de 🌮 Comida en octubre.` |
| Resumen | ver abajo |
| Corrección | `✏️ Corregido: gasto · 🌮 Comida · hoy`<br>`Monto: $180.00 → *$150.00*` · categoría: `✏️ Corregido: gasto de *$180.00* · hoy`<br>`Categoría: Comida → *Transporte*` · fecha: `✏️ Corregido: gasto de *$180.00* · 🌮 Comida`<br>`Fecha: hoy → *ayer*` |
| Borrado | `🗑️ Borrado: gasto de *$180.00* · 🌮 Comida · hoy` |
| No se entendió | `⚠️ No pude registrarlo. Escríbelo así: ```gasté 180 en tacos```` |
| Intérprete no disponible | `⚠️ No puedo interpretar mensajes en este momento. No guardé nada; inténtalo de nuevo en un rato.` |
| Mensajes atrasados | `🕒 Estuve apagado. Ignoré *3 mensajes* de hace más de 24 h; reenvíalos si quieres registrarlos.` |

Los demás avisos de la 001 (cita ambigua, sin coincidencia, valor no válido, corrección alta,
mensaje largo, error interno) conservan su texto, empiezan con `⚠️ ` y ponen los montos en negrita.

### Resumen

````text
📊 *Resumen de octubre*
💰 Ingresos: *$12,500.00*
💸 Gastos: *$4,120.50*
🟢 Balance: *$8,379.50*

*Gasto por categoría*
```Comida           $2,340.00
Hogar            $1,180.50
Transporte         $600.00```
````

Balance negativo: `🔴 Balance: *-$150.00*`. Las filas del bloque se alinean rellenando con espacios
hasta el ancho del nombre más largo; los montos, a la derecha.

## Configuración

| Situación | Respuesta |
|---|---|
| Bienvenida + pregunta 1 | `👋 *¡Hola! Vamos a configurar tu asistente.*`<br>`⚙️ *1/2 · Categorías de gasto*`<br>`Las predeterminadas son: 🌮 Comida, 🚌 Transporte, …, 📦 Otros.`<br>`Responde *predeterminadas* o escribe las tuyas separadas por comas (máx. 15).` |
| Pregunta 2 | `⚙️ *2/2 · Monto de confirmación*`<br>`¿A partir de qué monto te pido confirmar antes de guardar? (entre $100 y $1,000,000). Ahora: *$50,000.00*` |
| Configuración lista | `✅ *Configuración guardada*`<br>`• Gastos: 🌮 Comida, 🏷️ Mascotas, … 📦 Otros`<br>`• Ingresos: 💼 Salario, … 📦 Otros`<br>`• Confirmo arriba de *$5,000.00*` |
| Cambio de un valor | `✅ Umbral: $50,000.00 → *$5,000.00*` (y análogo para listas: `antes → ahora`) |
| Intento no válido | `⚠️ No pude usar esa lista: "Gimnasio y spa de lujo" tiene más de 20 caracteres. Usa solo letras, máx. 3 palabras y 20 caracteres por categoría.` |
| Configuración pausada | `⏸️ Pausé la configuración. Escribe *configurar* cuando quieras terminarla.` (y el mensaje se procesa) |
| `ver configuración` | igual que "Configuración lista" con título `⚙️ *Tu configuración*` |
| `configurar ingresos` | `⚙️ *Categorías de ingreso*`<br>`Ahora: 💼 Salario, 🧾 Honorarios, 🎁 Regalo, 📦 Otros.`<br>`Escribe las tuyas separadas por comas o *predeterminadas*.` |

## Imágenes

| Situación | Respuesta |
|---|---|
| Propuesta de ticket | ver abajo |
| Ticket guardado | `✅ *Guardé el ticket de Super La Esquina* · 5 artículos · *$229.90* · 12/10/2026` |
| Ticket descartado | `⚠️ No guardé el ticket de *$229.90* porque no lo confirmaste.` |
| Falta la fecha | `🤔 No encontré la fecha del ticket. Envía otra foto donde se vea o escríbela, por ejemplo ```12/10/2026``` o ```ayer```.` |
| Falta el total | `⚠️ No pude leer el *total* del ticket. Envía una foto más nítida donde se vea el total.` |
| Suma no cuadra | `⚠️ Los artículos suman *$219.90* pero el total del ticket es *$229.90*. Envía una foto más nítida.` |
| No es ticket | `⚠️ No encontré un ticket en la imagen. Si fue una compra, escríbela así: ```gasté 180 en tacos```` |
| Más de 40 artículos | `⚠️ El ticket tiene más de 40 artículos. Regístralo por partes o escríbelo a mano.` |
| Imagen no válida | `⚠️ Solo puedo leer fotos JPG o PNG de hasta 5 MB.` |
| Modelo de visión no disponible | `⚠️ No puedo leer imágenes en este momento. No guardé nada; inténtalo más tarde o escribe el gasto.` |
| Borrar ticket (pregunta) | `🤔 ¿Borro los *5 artículos* del ticket del 12/10 por *$229.90*? Responde *sí* para borrarlos.` |
| Ticket borrado | `🗑️ Borré el ticket del 12/10: 5 artículos por *$229.90*.` |
| "borra el ticket" sin cita | `⚠️ Cita la confirmación del ticket que quieres borrar.` |

### Propuesta de ticket

````text
🧾 *Ticket de Super La Esquina* · 12/10/2026 _(fecha del ticket)_
1. Leche entera 1 l (2 x) · *$57.00* · 🌮 Comida
2. Manzana gala 0.800 kg · *$36.00* · 🌮 Comida
3. Pan blanco (3 piezas) · *$15.00* · 🌮 Comida
4. Detergente líquido (3 l) · *$79.90* · 🏠 Hogar _(con descuento de $10.00)_
5. Huevo (12 piezas) · *$42.00* · 🌮 Comida ⚠️ _posible repetido de: gasto del 12/10 "gasté 42 en huevo"_
✅ Suman *$229.90*, igual que el total del ticket.
ℹ️ Ignoré los productos y montos del texto; solo uso los del ticket.
Responde *sí* para guardar los 5 o *sin repetidos* para guardar 4.
````

- `_(fecha del ticket)_` o `_(fecha que escribiste)_` según el origen (FR-020).
- La línea `ℹ️` solo aparece si el texto de la foto tenía números además de la fecha.
- Con cuadre de FR-018e, la línea de suma cambia y los importes de los artículos ya incluyen su parte:
  - IVA: `✅ Suman *$259.64* + IVA *$40.36* = *$300.00*, igual que el total del ticket. Repartí el IVA entre los artículos.`
  - Descuento: `✅ Suman *$3,050.39* − descuento *$60.07* = *$2,990.32*, igual que el total del ticket. Repartí el descuento entre los artículos.`
  - Ambos: `✅ Suman *$…* + IVA *$…* − descuento *$…* = *$…*, igual que el total del ticket. Repartí el IVA y el descuento entre los artículos.`
- La opción *sin repetidos* solo aparece si hay artículos marcados.
- Si todos están marcados: `⚠️ Todos parecen repetidos. Responde *sí* para guardarlos de todos modos o *sin repetidos* para no guardar nada.`
