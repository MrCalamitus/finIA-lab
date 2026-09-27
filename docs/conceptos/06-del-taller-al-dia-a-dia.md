# 06 · Del taller al día a día

## Buenas prácticas que sí escalan

1. **Spec antes que prompt.** En cualquier cambio no trivial: spec → plan → tareas. Los cambios triviales se piden directo.
2. **Tareas pequeñas y verificables.** Una tarea = un diff que puedes revisar en 5 minutos.
3. **Commits frecuentes.** Git es tu botón de deshacer. Haz commit antes de cada cambio grande del agente.
4. **Los tests son el contrato.** Deriva los tests de los criterios de aceptación y exige que pasen (hook `Stop` o regla en `CLAUDE.md`).
5. **Mantén vivo el Manifiesto.** Cuando el agente se equivoque dos veces en lo mismo, eso va a `CLAUDE.md`, a la constitución o a un hook.
6. **Revisa como revisarías a un colega.** Lee el diff. "Pasó los tests" no significa "está bien".

## Control de versiones guiado por IA

- Pide al agente **commits atómicos** con mensajes descriptivos. Tú apruebas el `push`.
- Una rama por feature y un PR por feature: la spec va en el mismo PR que el código.
- Usa al agente para **revisar** también: pídele una revisión del diff buscando bugs y riesgos de seguridad antes de abrir el PR.

## Agentes en CI/CD

Claude Code puede correr sin interacción (`claude -p "<tarea>"`), por ejemplo en GitHub Actions:

- Revisión automática de PRs.
- Triage de issues.
- Actualizar documentación cuando cambia la spec.

En CI **se usa una API key** (secret del repositorio), no tu suscripción personal. Aplica las mismas capas: permisos mínimos, sin secretos de producción y siempre con un humano aprobando el merge.

## La IA en la empresa: el reto ya no es técnico

Pedro Luis Rangel Baltazar resume en [este post](https://lnkd.in/p/gPiRvDKv) el reporte de McKinsey *The State of AI in 2026: On the Road to ROI*:

- **44 %** de las organizaciones ya escala soluciones de IA a nivel empresarial (vs. 38 % el año anterior).
- En empresas con ingresos de más de mil millones de dólares, escalar **agentes autónomos** en una o más funciones pasó del **27 % al 40 % en 12 meses**. Las empresas más pequeñas siguen en 22 %.

Su tesis:

> *"Comprar tecnología es la parte rápida y fácil de cualquier transformación. Diseñar la estructura organizacional para supervisar la autonomía agencial es donde se construye la verdadera ventaja competitiva."*

Lo contrario también está documentado: Klarna y Amazon recortaron personal apostando a la IA y terminaron buscando otra vez a personas (ver [00](00-bienvenida-y-contexto.md)).

Los tres imperativos que propone coinciden con lo que practicamos hoy, a escala de organización:

| En la empresa | En el taller |
|---|---|
| Rediseñar procesos para delegar con autonomía | SDD: spec → plan → tareas → implementación |
| Gobernanza dinámica que gestione el riesgo en tiempo real | Permisos, hooks, sandbox |
| Definir qué decisiones requieren responsabilidad humana | Puntos de revisión: aprobar spec, plan, diff y push |

## De aquí a tu trabajo

| Esta semana | Este mes |
|---|---|
| Escribe un `CLAUDE.md` para tu repo principal | Adopta spec-kit en una feature real |
| Agrega reglas `deny` para tus secretos | Agrega un hook que corra los tests |
| Usa el agente para explicar código legado | Automatiza revisión de PRs en CI |

## Mantente al día: comunidades

La IA cambia cada semana. La mejor forma de no quedarte atrás es rodearte de gente que está construyendo. Estas son las comunidades que me mantienen informado:

| Comunidad | Qué es | Para ti si… |
|---|---|---|
| [**VibeCoders**](https://www.vibecoders.la/) | Comunidad hispanohablante (LatAm y España) de builders que crean productos con IA. Charlas semanales, comunidad de WhatsApp y perfiles públicos de builders. *"Deja de imaginar. Empieza a construir."* | …quieres ver casos reales y lanzar tus propios proyectos |
| [**AI Builders México**](https://aibuilders.mx/) | Comunidad mexicana de desarrolladores, diseñadores y emprendedores que construyen productos con IA. Eventos presenciales y en línea, Discord, WhatsApp, newsletter y meetups. | …quieres ir a eventos, hacer networking y aprender en vivo |

## Lo que te llevas

> El agente amplifica tu proceso: con un buen proceso vas más rápido y con más calidad; con uno malo, produces más código malo. **Invierte en el proceso: spec, manifiesto y verificación.**
