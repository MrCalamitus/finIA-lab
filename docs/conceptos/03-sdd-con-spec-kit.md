# 03 · SDD con spec-kit

## El problema: "vibe coding"

### De dónde viene

El 2 de febrero de 2025, Andrej Karpathy (cofundador de OpenAI y exdirector de IA en Tesla) publicó:

> *"Hay un nuevo tipo de programación que llamo 'vibe coding', donde te dejas llevar por completo por las vibras, abrazas los exponenciales y olvidas que el código siquiera existe."*

Lo pensó para proyectos de fin de semana sin consecuencias, donde nadie revisa el código. En noviembre de 2025, Collins lo nombró **Palabra del Año** ([Wikipedia](https://en.wikipedia.org/wiki/Vibe_coding)). De ahí viene **vibecoders**: quienes construyen software conversando con la IA, muchas veces sin saber programar. Comunidades como [VibeCoders](https://www.vibecoders.la/) tomaron el nombre.

### Qué pasa cuando lo llevas a producción

Si le pides a un agente "hazme una app de finanzas", va a **inventar** todo lo que no dijiste: el modelo de datos, las reglas, los casos límite y el stack. Cada sesión inventa algo distinto. El resultado es código espagueti que funciona "más o menos" y que nadie puede verificar.

Los datos lo confirman. En mayo de 2025, 170 de 1,645 apps hechas con Lovable exponían datos personales. Un análisis de CodeRabbit (diciembre 2025) encontró **2.74 veces más vulnerabilidades** en código coescrito por IA ([Wikipedia](https://en.wikipedia.org/wiki/Vibe_coding)).

### El costo real de vibecodearlo todo

Gonzalo D'Angelo lo dice sin rodeos en [este post](https://lnkd.in/p/gzyKbTQY):

> *"Escribir código hoy es barato; mantenerlo funcionando en producción sigue siendo igual de caro."*

El precio real del software no está en escribirlo. Está en la arquitectura, los parches de seguridad, la infraestructura, el soporte y la evolución funcional. Quien sustituye todo por apps vibecodeadas "para ahorrar" suele encontrarse, a los pocos meses, con código inmantenible, vulnerabilidades y costos operativos disparados.

SDD no hace más barato escribir código. Hace más barato **todo lo que viene después**, porque deja decisiones documentadas, requisitos verificables y una arquitectura que alguien más puede entender.

## La idea: la especificación es la fuente de verdad

**Specification-Driven Development (SDD):** primero escribes **qué** y **por qué**. Después, el **cómo** se deriva de eso por pasos, y cada paso queda como un documento revisable.

| Sin spec | Con spec |
|---|---|
| El agente adivina requisitos | Los requisitos están escritos |
| "Funciona" = no truena | "Funciona" = cumple criterios de aceptación |
| Cada sesión empieza de cero | El contexto vive en archivos del repo |
| Cambiar algo = reescribir prompts | Cambiar algo = editar la spec y regenerar el plan |

## spec-kit en 30 segundos

La industria respondió al vibe coding con herramientas de SDD: AWS lanzó Kiro en julio de 2025 y GitHub publicó spec-kit en septiembre (ver la línea de tiempo en [00](00-bienvenida-y-contexto.md)).

[spec-kit](https://github.com/github/spec-kit) es un kit open source de GitHub que convierte SDD en comandos dentro de tu agente. `specify init` instala en tu repo plantillas, scripts y **skills** para Claude Code:

```
/speckit-constitution   Principios no negociables del proyecto (calidad, seguridad, testing)
        ▼
/speckit-specify        QUÉ y POR QUÉ: historias de usuario, requisitos, criterios de aceptación
        ▼
/speckit-clarify        (opcional) El agente te pregunta lo ambiguo antes de planear
        ▼
/speckit-plan           CÓMO: stack, arquitectura, modelo de datos, contratos
        ▼
/speckit-tasks          Lista de tareas ordenada y verificable
        ▼
/speckit-analyze        (opcional) Revisa la consistencia entre spec, plan y tareas
        ▼
/speckit-implement      El agente ejecuta las tareas
```

Cada paso genera archivos en `specs/<feature>/`: `spec.md`, `plan.md`, `tasks.md`, etc. **Tú revisas cada uno antes de avanzar.** Esos puntos de revisión son donde tú controlas el proceso.

> Versión usada en el taller: **spec-kit 1.0.12**. Los nombres de los comandos han cambiado entre versiones. Si ves otros, revisa el mensaje que imprime `specify init`.

## Por qué reduce alucinaciones

- **Menos espacio para inventar:** lo ambiguo se pregunta (`clarify`) en lugar de suponerse.
- **Contexto persistente:** la constitución y la spec viven en el repo. Cualquier sesión nueva las lee.
- **Verificación explícita:** los criterios de aceptación se convierten en tests y el agente sabe cuándo terminó.
- **Separación qué / cómo:** puedes cambiar el stack sin reescribir los requisitos.

## Una buena spec…

- Habla del **usuario y su problema**, no de frameworks.
- Tiene criterios de aceptación **comprobables**: "Dado… cuando… entonces…".
- Declara lo que **no** entra (*fuera de alcance*).
- Incluye **restricciones de seguridad** como requisitos, no como notas al pie.

## Lo que te llevas

> Con un agente, el código es barato y la **intención clara es lo caro**. La spec es el contrato: lo que no está escrito, el agente lo inventa.
