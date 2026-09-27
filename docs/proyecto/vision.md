# Visión del proyecto: FinIA, Asistente de Finanzas Personales

> Nombre de trabajo: **FinIA**. Lleva "IA" al final porque está de moda y el marketing no perdona. Lo importante está abajo. 😄

> Este documento describe el **problema**, no la solución. Es el punto de partida para `/speckit-specify`.
> El stack, la arquitectura y el modelo de datos se deciden después, en `/speckit-plan`.

## El problema

La mayoría de las personas no lleva registro de sus gastos. No es por falta de apps: es por **fricción**. Abrir una app, navegar formularios y elegir categorías toma más tiempo que el gasto mismo, así que se abandona en una semana.

En cambio, casi todos tenemos WhatsApp abierto todo el día.

## La idea

Un asistente que vive en un **grupo de WhatsApp donde solo estás tú**. Escribes como le escribirías a un amigo y el asistente entiende, registra y responde:

```
Tú:  gasté 180 en tacos
🤖:  Registrado: gasto de $180.00 · Comida · hoy

Tú:  me pagaron 12,500 de la quincena
🤖:  Registrado: ingreso de $12,500.00 · Salario · hoy

Tú:  ¿cuánto llevo gastado este mes en comida?
🤖:  Comida en septiembre: $2,340.00 (14 gastos)
```

Un **modelo de lenguaje local** (Ollama) interpreta el lenguaje natural. Tus datos financieros **no salen de tu máquina**.

## Usuario

- Estudiante o profesionista joven, con ingresos y gastos variables.
- Usa WhatsApp todo el día y no quiere instalar ni aprender otra app.
- Le importa la privacidad de su información financiera.

## Necesidades (en lenguaje del usuario)

1. "Quiero registrar un gasto o ingreso en segundos, escribiendo como hablo."
2. "Quiero que me confirme qué entendió, para saber que quedó bien."
3. "Quiero poder corregir o borrar algo que registré mal."
4. "Quiero preguntar cuánto llevo gastado, por periodo y por categoría."
5. "Quiero ver un resumen más completo que un mensaje de chat."
6. "No quiero que mis datos se vayan a la nube de nadie."

## Restricciones conocidas

- **Canal:** grupo de WhatsApp de un solo miembro, conectado con la librería no oficial [Baileys](https://github.com/WhiskeySockets/Baileys). Cada mensaje del grupo llega como un **evento** que dispara el procesamiento.
- **Solo el dueño:** únicamente se procesan mensajes del grupo configurado enviados por el dueño de la cuenta.
- **El bot también escribe en el grupo:** sus respuestas no deben procesarse como si fueran mensajes nuevos.
- **LLM local:** Ollama, en la máquina del usuario o en un servidor de la red local.
- **Moneda:** pesos mexicanos (MXN).

## Seguridad (requisitos, no sugerencias)

- Todo mensaje entrante es **input no confiable**. Ningún texto, por más convincente que sea, puede provocar acciones fuera de las permitidas.
- La salida del LLM también es input no confiable: debe **validarse** antes de persistir cualquier cosa.
- Las credenciales de la sesión de WhatsApp y la configuración sensible **nunca** van al repositorio.
- El dinero no se puede perder ni duplicar: un mismo mensaje no debe registrarse dos veces.

## Fuera de alcance

- Conexión con bancos o tarjetas.
- Múltiples usuarios o cuentas compartidas.
- Uso de la API oficial de WhatsApp Business.
- Inversiones, créditos o asesoría financiera.

## Preguntas abiertas (para `/speckit-clarify`)

- ¿Qué categorías existen y quién las define?
- ¿Cómo se corrige un registro desde WhatsApp?
- ¿Qué pasa si el LLM no entiende el mensaje o no está disponible?
- ¿Qué pasa con los mensajes enviados mientras el asistente estaba apagado?
- ¿Qué muestra el "resumen más completo" y dónde se ve?
