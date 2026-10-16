# Contrato: configuración (v2)

Extiende [configuracion.md de la 001](../../001-asistente-finanzas-whatsapp/contracts/configuracion.md).
Las variables de la 001 no cambian.

## Variables de entorno nuevas

| Variable | Obligatoria | Por defecto | Descripción |
|---|---|---|---|
| `FINIA_OLLAMA_MODEL_VISION` | no | valor de `FINIA_OLLAMA_MODEL` | modelo de Ollama para fotos; debe tener la capacidad `vision` |
| `FINIA_VISION_TIMEOUT_MS` | no | `60000` | tiempo máximo por imagen (1,000–300,000) |

Se usa la misma `FINIA_OLLAMA_URL`, restringida a la máquina o la red local (FR-017).

## Configuración del dueño (en la base, no en variables)

Categorías y umbral se guardan en la base local ([data-model.md](../data-model.md)) y se cambian
solo desde el chat. Nunca desde variables de entorno ni archivos.

## Comandos de chat (reconocidos por código, sin el modelo)

Normalización: minúsculas, sin acentos, sin puntuación final, espacios colapsados.

| Comando | Efecto |
|---|---|
| `configurar` | pregunta 1 (categorías de gasto) y luego pregunta 2 (umbral) |
| `configurar ingresos` | una pregunta: categorías de ingreso |
| `ver configuracion` | muestra categorías y umbral vigentes |
| `borra el ticket` · `borrar ticket` · `borra ticket` | solo citando la confirmación de un ticket: pregunta y borra con `sí` |

## Intento de respuesta (FR-006a)

| Espera | Cuenta como intento | Válido si |
|---|---|---|
| categorías (gasto o ingreso) | `predeterminadas`, o texto con al menos una coma y sin dígitos | cada nombre cumple las reglas de [data-model.md](../data-model.md) y hay ≤ 15 |
| umbral | el mensaje completo es un monto según `parsearMonto` | entre $100.00 y $1,000,000.00 |
| fecha de ticket | una foto, o un texto con una fecha según research R5 | `validarFecha` |

Cualquier otro mensaje: la espera se cancela (la configuración queda `pausada`) con aviso y el
mensaje sigue el flujo normal.

## Scripts

`npm run eval` añade la evaluación de tickets (SC-004, SC-005, SC-006) si existe `eval/tickets/`.
