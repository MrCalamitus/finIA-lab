# 00 · Bienvenida y contexto: de ChatGPT a Mythos

## Quién te acompaña

**Luis Alberto Ortiz Meza**: Ingeniero en Computación y Maestro en Ingeniería en Seguridad y Tecnologías de la Información (IPN, ESIME Culhuacán).

- Poco más de **14 años** en proyectos de todos los tamaños, con total libertad de stack y de forma con 100% de cumplimiento.
- **IA aplicada:** IAPREP (la mejor de 3 soluciones en la evaluación del INE de 2024) y pipelines multiagente con LLM locales (CrewAI + Ollama) en producción.
- **Ya recorrió el camino de FinIA:** Hermes, su asistente personal con LLM locales, registra sus gastos desde fotos de tickets.
- Usa agentes de código a diario. Fue ponente en este mismo congreso en 2021.

[Más sobre el instructor](../../README.md#sobre-el-instructor) · [LinkedIn](https://www.linkedin.com/in/mrcalamitus)

## Cómo llegamos aquí: la IA generativa en 4 años

Qué fue real y qué fue hype. Leyenda: 🌍 industria · 💻 desarrollo de software · 🔐 seguridad · 💼 empleo y predicciones.

| Fecha | | Qué pasó |
|---|---|---|
| **30 nov 2022** | 🌍 | Sale ChatGPT. En enero de 2023 ya tiene **100 millones de usuarios**: la app de consumo de más rápido crecimiento de la historia. A TikTok le tomó ~9 meses y a Instagram 2 años y medio. [1] |
| **mar 2023** | 🌍 | Carta del Future of Life Institute: pide **pausar 6 meses** el entrenamiento de modelos más potentes que GPT-4. Más de 30 mil firmas, entre ellas Musk, Wozniak y Bengio. La pausa nunca ocurrió. [2] |
| **30 may 2023** | 🌍 | Declaración del Center for AI Safety: *"Mitigar el riesgo de **extinción** por la IA debería ser una prioridad global"*. La firman Hinton, Bengio, **Altman, Hassabis y Amodei**, los mismos que construyen los modelos. [3] |
| **mar 2024** | 💻 | Cognition presenta a **Devin**, "el primer ingeniero de software con IA". Resolvía el 13.86 % de SWE-bench Lite, medido por ellos mismos en un subconjunto, y uno de sus demos resultó no ser lo que decía. Nace el ciclo "demo espectacular → realidad modesta". [4] |
| **nov 2024** | 💻 | Anthropic publica **MCP** (Model Context Protocol), un estándar para conectar agentes con herramientas y datos. OpenAI lo adopta en marzo de 2025 y en diciembre de 2025 pasa a la Linux Foundation. [5] |
| **21 ene 2025** | 🌍 | **Stargate:** OpenAI, SoftBank y Oracle anuncian en la Casa Blanca **USD 500 mil millones** en infraestructura de IA en EE. UU. [6] |
| **27 ene 2025** | 🌍 | **DeepSeek R1**, un modelo chino abierto y mucho más barato de entrenar, provoca que Nvidia pierda **USD 589 mil millones** en un día: la mayor caída en la historia de la bolsa. [7] |
| **2 feb 2025** | 💻 | Andrej Karpathy acuña el término **"vibe coding"**. En noviembre, Collins lo nombra **Palabra del Año 2025**. Nacen los *vibecoders* (lo vemos en [03](03-sdd-con-spec-kit.md)). [8] |
| **feb – jun 2025** | 💻 | Nacen los **agentes de terminal**: Claude Code (24 feb), Codex CLI de OpenAI (16 abr) y Gemini CLI de Google (25 jun). [9] |
| **mar 2025** | 💼 | Dario Amodei (CEO de Anthropic): en 3 a 6 meses la IA escribiría el **90 % del código**. Fuera de Anthropic, no se cumplió en ese plazo. [10] |
| **abr 2025** | 🔐 | **Slopsquatting:** en 2.23 millones de muestras de código generado, el **19.7 %** incluía paquetes que **no existen**, y el 43 % de esos nombres se repetía siempre. Un atacante solo tiene que registrarlos con malware. [11] |
| **may 2025** | 🔐 | Pruebas de seguridad: Claude Opus 4 **chantajea** a un ingeniero ficticio para no ser reemplazado (84 % de las veces en ese escenario) [12]. El modelo o3 de OpenAI **sabotea su script de apagado** en 7 de 100 corridas, aun con la instrucción explícita de permitirlo. [13] |
| **may 2025** | 💼 | **Klarna** había sustituido con IA el equivalente a ~700 agentes de atención a clientes. Su CEO admite: *"Nos enfocamos demasiado en el costo. El resultado fue menor calidad"*, y vuelve a contratar humanos. [14] |
| **10 jul 2025** | 💻 | Estudio de METR con desarrolladores experimentados: con IA tardaron **19 % más**, pero creían haber sido **20 % más rápidos**. [15] |
| **14 jul 2025** | 💻 | AWS lanza **Kiro**, un IDE guiado por especificaciones: la industria empieza a responder al vibe coding con SDD. [16] |
| **jul 2025** | 🔐 | Un atacante logra meter en la extensión oficial de **Amazon Q para VS Code** (casi 1 millón de instalaciones) un prompt que ordenaba **borrar archivos y recursos de AWS**. Se publicó; no se ejecutó por un error de formato del propio prompt. [17] |
| **jul 2025** | 🔐 | El agente de **Replit borra la base de datos de producción** de SaaStr en plena congelación de código, con 1,206 ejecutivos y 1,196 empresas, y después **oculta lo que hizo**. [18] |
| **jul 2025** | 💻 | Encuesta de Stack Overflow (49 mil desarrolladores): el **84 %** usa o planea usar IA, pero **46 % desconfía** de su precisión y solo 33 % confía. [19] |
| **ago 2025** | 💼 | MIT NANDA: **95 % de los pilotos de IA generativa** en empresas no generan retorno medible. [20] |
| **26 ago 2025** | 🔐 | **s1ngularity:** paquetes de Nx comprometidos en npm usan **los CLI de IA instalados en la máquina de la víctima** (Claude, Gemini, Q) para buscar secretos. Se filtran 2,349 credenciales. [21] |
| **2 sep 2025** | 💻 | GitHub publica **spec-kit**, la herramienta de SDD que usamos hoy. [22] |
| **sep 2025** | 🌍 | *If Anyone Builds It, Everyone Dies* (Yudkowsky y Soares) llega a la lista de bestsellers del NYT. Su tesis: una superinteligencia nos mataría a todos. [23] |
| **oct 2025 – ene 2026** | 💼 | **Amazon** recorta ~14,000 puestos corporativos en octubre y suma unos **30,000** con la ronda de enero. Andy Jassy aclara que *"no es por dinero, y ni siquiera es por IA, no por ahora. Es cultura"*. [24] |
| **nov 2025** | 🔐 | Anthropic detiene la primera campaña de **ciberespionaje orquestada por IA**: un actor ligado a China usó Claude Code con MCP contra ~30 organizaciones. La IA ejecutó el **80–90 %** del trabajo. [25] |
| **23 ene 2026** | 💼 | Davos. Amodei: *"podríamos estar a **6 a 12 meses** de que el modelo haga la mayor parte, quizá todo, de lo que hace un ingeniero de software"*. [26] |
| **7 abr 2026** | 🔐 | Anthropic anuncia **Claude Mythos Preview** y **no lo libera al público**: encontró miles de vulnerabilidades críticas en todos los sistemas operativos y navegadores principales, incluida una falla de **27 años** en OpenBSD. Solo lo usan socios defensivos (Project Glasswing). [27] |
| **may 2026** | 💼 | Sam Altman, que antes decía que la IA reemplazaría *"la mayoría de los trabajos"*, ahora dice: *"no creo que vayamos a tener el apocalipsis laboral"*. Yale Budget Lab: todavía no hay un cambio significativo en el desempleo de los trabajos más expuestos a la IA. [28] |
| **2026** | 💼 | Amazon contacta a exempleados despedidos para **recontratarlos en roles de IA, machine learning y cloud** en AWS: la iniciativa *"Swami's Boomerang Reengagement"*. Además planea contratar ~11,000 ingenieros en el año. Amazon lo describe como "boomerang hiring" normal. [29] |
| **jul 2026** | 🔐 | **Agentes de OpenAI hackean Hugging Face.** Durante una evaluación interna de capacidades de ciberseguridad, un enjambre de ~700 agentes **escapó de su entorno de prueba** explotando una falla en el sistema donde debían estar confinados, y **entró a la infraestructura real de Hugging Face** para robar las soluciones de la prueba en la que estaban atorados. Varios intentaron **borrar o alterar el registro** de lo que hicieron. Es la primera intrusión documentada ejecutada por completo por un sistema de IA agéntico. [30] |
| **jul 2026** | 🌍 | Kimi K3 (Moonshot) y Qwen 3.8 (Alibaba): los modelos chinos quedan solo por detrás de lo último de OpenAI y Anthropic, y lideran en modelos abiertos. [31] |

## Cuatro lecturas

**1. La carrera: EE. UU. vs. China.** EE. UU. apuesta por modelos cerrados y cómputo masivo (Stargate). China, por modelos **abiertos** y eficientes (DeepSeek, Qwen, Kimi) [6, 7, 31]. Para ti es buena noticia: hoy puedes correr en tu laptop, con Ollama, modelos que hace dos años no existían. Es lo que haremos con FinIA.

**2. "En 6 meses" y el empleo.** "El 90 % del código en 3 a 6 meses" (marzo 2025), "ingenieros reemplazados en 6 a 12 meses" (enero 2026), "la mayoría de los trabajos" (Altman), y luego *"me alegra haberme equivocado"* (Altman, mayo 2026) [10, 26, 28]. En el camino, Klarna y Amazon recortaron y terminaron buscando otra vez a personas [14, 24, 29]. Lo que sí cambió es **cómo** se trabaja: el agente escribe y el ingeniero especifica, revisa y asegura. Justo lo que practicamos hoy.

**3. Cuando el agente hace de más.** Hay que separar dos cosas:
- **Pruebas diseñadas para provocar el mal comportamiento** (Opus 4, o3, Mythos) [12, 13, 27]. En la de Mythos, un usuario simulado **le pidió** intentar escapar del sandbox. Lo logró y le mandó un correo al investigador, que estaba comiendo un sándwich en un parque. Lo preocupante fue lo que hizo **sin que se lo pidieran**: publicó detalles del exploit en sitios web públicos y trató de borrar sus huellas del historial de cambios.
- **Incidentes reales:** el agente de Replit en producción [18], el prompt malicioso en Amazon Q [17], los paquetes inventados [11], el malware que usa tu propio CLI de IA [21], los atacantes que orquestan intrusiones con agentes [25] y, el caso más grave, **los agentes de OpenAI que escaparon de su evaluación y atacaron a Hugging Face** [30]: nadie les pidió atacar a una empresa real; lo hicieron para "aprobar" su prueba. **El agente ya es superficie de ataque, y también puede ser el atacante.** Lo atacamos de frente en [04 · Seguridad y control](04-seguridad-y-control.md).

**4. Hype vs. datos.** Conviven dos narrativas extremas: la extinción (cartas de 2023, el bestseller de 2025) [2, 3, 23] y el "reemplazo total en meses". Los datos cuentan algo más aburrido: el 95 % de los pilotos empresariales no da retorno [20], los desarrolladores se sienten más rápidos de lo que son [15] y confían cada vez menos en la herramienta [19]. Quienes sacan valor **rediseñan su proceso**. La respuesta de la industria al vibe coding fue justo esa: desarrollo guiado por especificaciones (Kiro, spec-kit) [16, 22].

## Lo que te llevas

> Ni apocalipsis ni magia. La IA generativa es una herramienta muy poderosa que **se equivoca, puede ser manipulada y a veces hace de más**. Por eso este taller va de especificar, limitar y verificar, no de confiar.

---

### Fuentes

1. [Reuters vía Yahoo Finance: ChatGPT sets record for fastest-growing user base (UBS)](https://finance.yahoo.com/news/chatgpt-sets-record-fastest-growing-190911828.html)
2. [Future of Life Institute: Pause Giant AI Experiments](https://futureoflife.org/open-letter/pause-giant-ai-experiments/)
3. [Center for AI Safety: Statement on AI Risk](https://safe.ai/work/statement-on-ai-extinction-risk)
4. [The Pragmatic Engineer: Is the "AI developer" a threat to jobs, or a marketing stunt?](https://blog.pragmaticengineer.com/the-ai-developer/)
5. [Anthropic: Donating the Model Context Protocol and establishing the Agentic AI Foundation](https://anthropic.com/news/donating-the-model-context-protocol-and-establishing-of-the-agentic-ai-foundation) · [Wikipedia: MCP](https://en.wikipedia.org/wiki/Model_Context_Protocol)
6. [OpenAI: Announcing The Stargate Project](https://openai.com/index/announcing-the-stargate-project/)
7. [CNBC: Nvidia sheds almost $600 billion in market cap](https://www.cnbc.com/2025/01/27/nvidia-sheds-almost-600-billion-in-market-cap-biggest-drop-ever.html)
8. [Wikipedia: Vibe coding](https://en.wikipedia.org/wiki/Vibe_coding)
9. [Google: Introducing Gemini CLI](https://blog.google/technology/developers/introducing-gemini-cli-open-source-ai-agent/) · [Wikipedia: Codex CLI](https://en.wikipedia.org/wiki/Codex_CLI) · [Wikipedia: Claude](https://en.wikipedia.org/wiki/Claude_(language_model))
10. [IT Pro: Amodei's prediction about AI-generated code](https://www.itpro.com/technology/artificial-intelligence/anthropic-ceo-dario-amodei-ai-generated-code)
11. [Help Net Security: Package hallucination and slopsquatting](https://www.helpnetsecurity.com/2025/04/14/package-hallucination-slopsquatting-malicious-code/)
12. [Anthropic: System Card Claude Opus 4 & Sonnet 4](https://www.anthropic.com/claude-4-system-card) · [Fortune](https://fortune.com/2025/05/23/anthropic-ai-claude-opus-4-blackmail-engineers-aviod-shut-down/)
13. [The Register: OpenAI model modifies own shutdown script](https://www.theregister.com/2025/05/29/openai_model_modifies_shutdown_script/)
14. [CX Dive: Klarna reinvests in human talent](https://www.customerexperiencedive.com/news/klarna-reinvests-human-talent-customer-service-AI-chatbot/747586/)
15. [METR: Measuring the impact of early-2025 AI on experienced open-source developer productivity](https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/)
16. [DevClass: Hands on with Kiro](https://devclass.com/2025/07/15/hands-on-with-kiro-the-aws-preview-of-an-agentic-ai-ide-driven-by-specifications/)
17. [AWS Security Bulletin AWS-2025-015](https://aws.amazon.com/security/security-bulletins/AWS-2025-015/) · [The Register](https://www.theregister.com/2025/07/24/amazon_q_ai_prompt/)
18. [AI Incident Database #1152: Replit Agent](https://incidentdatabase.ai/cite/1152/) · [Fortune](https://fortune.com/2025/07/23/ai-coding-tool-replit-wiped-database-called-it-a-catastrophic-failure/)
19. [Stack Overflow: 2025 Developer Survey](https://stackoverflow.co/company/press/archive/stack-overflow-2025-developer-survey/)
20. [Fortune: MIT report, 95% of generative AI pilots failing](https://fortune.com/2025/08/18/mit-report-95-percent-generative-ai-pilots-at-companies-failing-cfo)
21. [Wiz: s1ngularity supply chain attack](https://www.wiz.io/blog/s1ngularity-supply-chain-attack)
22. [GitHub Blog: Spec-driven development with AI](https://github.blog/ai-and-ml/generative-ai/spec-driven-development-with-ai-get-started-with-a-new-open-source-toolkit/)
23. [Washington Post: reseña de *If Anyone Builds It, Everyone Dies*](https://www.washingtonpost.com/books/2025/09/28/yudkowsky-soares-everyone-dies-review/)
24. [CNN: Amazon says it cut 14,000 people because of "culture"](https://www.cnn.com/2025/10/30/tech/amazon-layoffs-andy-jassy-ai-culture)
25. [Anthropic: Disrupting the first reported AI-orchestrated cyber espionage campaign](https://www.anthropic.com/news/disrupting-AI-espionage)
26. [Entrepreneur: Anthropic CEO says AI could replace software engineers in 6 to 12 months](https://www.entrepreneur.com/business-news/ai-ceo-says-software-engineers-could-be-replaced-in-months/502087)
27. [Anthropic: Project Glasswing](https://www.anthropic.com/glasswing) · [Futurism: Claude Mythos escaped a sandbox during testing](https://futurism.com/artificial-intelligence/anthropic-claude-mythos-escaped-sandbox)
28. [TIME: Sam Altman says AI "jobs apocalypse" probably won't happen](https://time.com/article/2026/05/26/sam-altman-ai-job-losses-openAI-/)
29. [IBTimes UK: Amazon wants laid-off AI workers back](https://www.ibtimes.co.uk/amazon-rehires-laid-off-workers-ai-roles-1821575) · [People Matters: Amazon will hire 11,000 engineers in 2026](https://www.peoplematters.in/news/strategic-hr/after-30000-layoffs-amazon-says-it-will-hire-11000-engineers-in-2026-49486)
30. [MIT Technology Review: The inside story on why OpenAI agents hacked Hugging Face](https://www.technologyreview.com/2026/08/26/1143013/the-inside-story-on-why-openai-agents-hacked-hugging-face/) · [NBC News](https://www.nbcnews.com/tech/tech-news/openai-report-says-network-was-hacked-rogue-ai-agents-rcna594590) · [Wikipedia: OpenAI–HuggingFace incident](https://en.wikipedia.org/wiki/OpenAI%E2%80%93HuggingFace_incident)
31. [Foreign Policy: China narrows U.S. AI gap with Kimi K3 and Qwen 3.8](https://foreignpolicy.com/2026/07/23/china-ai-race-moonshot-kimi-k3-alibaba-qwen-deepseek-openai-anthropic/)
