# 01 · De asistente a agente

En [00](00-bienvenida-y-contexto.md) viste cómo pasamos del chat de 2022 a los agentes de terminal de 2025. Aquí va qué cambia en la práctica.

## La diferencia en una frase

- Un **asistente** te **responde**. Tú copias, pegas, ejecutas y le vuelves a contar qué pasó.
- Un **agente** **actúa**: lee tus archivos, ejecuta comandos, observa el resultado y corrige. Todo dentro de los límites que tú le fijas.

| | Asistente de chat | Agente |
|---|---|---|
| Ve tu proyecto | Solo lo que pegas | Lee el repo por su cuenta |
| Ejecuta | Nada | Comandos, tests, builds |
| Se entera de un error | Cuando tú se lo pegas | Lo lee directamente de la consola |
| Tu rol | Operador (copiar/pegar) | Arquitecto y supervisor |
| Riesgo principal | Respuestas incorrectas | **Acciones** incorrectas |

## El ciclo del agente

```
      ┌─────────────┐
      │  Objetivo   │  ← tú lo defines (mejor si es una spec)
      └──────┬──────┘
             ▼
   ┌──────► Planear ──────┐
   │                      ▼
Corregir               Actuar      (editar archivos, ejecutar comandos)
   ▲                      │
   └────── Observar ◄─────┘        (salida de consola, tests, errores)
             │
             ▼
     ¿Cumple el objetivo? → sí → entrega para tu revisión
```

El ciclo se repite solo. La calidad del resultado depende de dos cosas: **qué tan claro está el objetivo** y **qué tan buena es la señal de verificación** (tests, build, linters). Por eso este taller va de especificaciones y de control, no de prompts ingeniosos.

## Lo que cambia para ti como ingeniero

1. **Escribes menos código y más intención.** Especificas qué quieres y cómo se verifica.
2. **Tu trabajo se mueve a revisar.** Lees diffs, apruebas permisos y validas criterios de aceptación.
3. **La seguridad pasa a ser tu responsabilidad directa.** Le estás dando una terminal a un sistema que puede equivocarse o ser manipulado.

## Las 6 skills para construir con IA

Pol Marzà lo resume en [*Las 6 skills del infinito*](https://www.linkedin.com/pulse/las-6-skills-del-infinito-pol-marz%C3%A0-y8d7e/): construir con IA exige habilidades que no son saber programar, y se desarrollan con práctica. Cada una tiene su lugar en este taller:

| Skill | En el taller |
|---|---|
| **Tolerancia a la ambigüedad**: avanzar sin tener todo resuelto | `/speckit-clarify` convierte la ambigüedad en preguntas explícitas |
| **Descomposición de problemas**: pasos pequeños y concretos | `/speckit-tasks`: tareas pequeñas y verificables |
| **Criterio para evaluar el output**: distinguir lo correcto de lo que solo lo parece | Revisión de diffs y tests desde los criterios de aceptación |
| **Persistencia frente al error**: explicarle el error en vez de abandonar | Fase 3: depuración e iteración |
| **Comunicación precisa**: pedir lo específico, no lo vago | La spec: lo que no está escrito, el agente lo inventa |
| **Curiosidad técnica selectiva**: preguntar "¿por qué?" cuando algo sorprende | Pedirle al agente que explique antes de aceptar un cambio |

> *"Si quieres construir bien a largo plazo, no hay atajos."* (Pol Marzà)

## Lo que te llevas

> Un agente es un ciclo **planear → actuar → observar → corregir**. Tú pones el objetivo, los límites y la forma de verificar. El agente pone las manos.
