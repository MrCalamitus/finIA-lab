# Research: Asistente de finanzas personales por WhatsApp

**Fase 0 de** [plan.md](plan.md) · **Fecha**: 2026-10-13

Cada decisión resuelve una incógnita del Technical Context. Versiones verificadas en el registro
oficial de npm el 2026-10-13. Regla aplicada: versión exacta y publicada hace al menos dos semanas.

## R1. Lenguaje y runtime

- **Decision**: TypeScript ejecutado directamente por Node.js 24 LTS (type stripping nativo, sin
  paso de compilación). `tsc --noEmit` solo para revisar tipos.
- **Rationale**: Node 24 ya es requisito del pre-work y Baileys es una librería de Node. El type
  stripping (verificado en Node 24.6.0) evita bundlers y `dist/`: menos piezas para el taller.
  Restricción: solo sintaxis borrable (`erasableSyntaxOnly`), sin `enum` ni `namespace`.
- **Alternatives considered**: JavaScript con JSDoc (menos ayuda de tipos para validar el dinero);
  `tsx`/`ts-node` (dependencia extra innecesaria); Python (Baileys no existe en Python).

## R2. Canal de WhatsApp

- **Decision**: `baileys@7.0.0-rc14` (fijada exacta). Sesión con `useMultiFileAuthState` en una
  carpeta `auth_info/` fuera del control de versiones. QR en terminal con `qrcode-terminal@0.12.0`.
- **Rationale**: es la restricción de la visión. En npm, `latest` apunta a la 7.0.0-rc14 y la 6.x
  quedó como `legacy`; la v7 es la línea mantenida. La v7 eliminó `printQRInTerminal`, de ahí
  `qrcode-terminal` (sin dependencias propias).
- **Riesgos y mitigaciones**:
  - Es una release candidate: se fija la versión exacta y el lockfile se versiona.
  - Trae una dependencia transitiva nativa (`whatsapp-rust-bridge`): revisar en el diff del
    lockfile al instalar (constitución, restricciones).
  - Uso mínimo: un grupo propio, sin envíos masivos (Assumptions de la spec).
- **Alternatives considered**: `baileys@6.7.24` (rama `legacy`, sin futuro); `whatsapp-web.js`
  (requiere Chromium, más pesado); API oficial de WhatsApp Business (fuera de alcance).

## R3. Cómo distinguir al dueño y las respuestas propias (FR-013, FR-014)

- **Decision**: un mensaje se procesa solo si cumple las tres condiciones:
  1. `key.remoteJid` es exactamente el grupo configurado (`FINIA_GROUP_JID`).
  2. `key.fromMe === true` (en un grupo de un solo miembro, el dueño es la propia cuenta).
  3. `key.id` **no** está en la tabla `mensajes_enviados` (los que envió el asistente).
- **Rationale**: el asistente escribe con la misma cuenta del dueño, así que `fromMe` es verdadero
  para ambos. La única marca fiable es el id que devuelve `sendMessage`, que se guarda **antes**
  de que el evento de eco pueda llegar. Guardarlo en la base (no en memoria) cubre reinicios.
- **Alternatives considered**: prefijo "🤖" en las respuestas (el dueño podría escribirlo);
  ventana de tiempo tras enviar (frágil).

## R4. Mensajes con el asistente apagado (FR-020)

- **Decision**: se escuchan `messages.upsert` de tipo `notify` y `append`. Para cada mensaje:
  - Si es anterior al **primer arranque** registrado en la base → se ignora sin aviso (historial
    previo a instalar el asistente, que llega en la sincronización inicial).
  - Si tiene más de 24 h respecto al momento de procesarlo → se marca `ignorado_antiguo`.
  - Si no → se procesa con su `messageTimestamp` como fecha por defecto (FR-003).
  - Al terminar la tanda de reconexión, un solo aviso: "Ignoré N mensajes de hace más de 24 h".
- **Rationale**: la tabla de mensajes procesados ya garantiza que reentregas no dupliquen nada; el
  filtro por fecha solo decide qué se procesa.
- **Por validar en quickstart**: cómo entrega Baileys v7 los mensajes pendientes al reconectar
  (escenario Q6 de [quickstart.md](quickstart.md)).

## R5. Intérprete de lenguaje (LLM local)

- **Decision**: llamada HTTP directa a Ollama `POST /api/chat` con `fetch` nativo, `stream:false`,
  `temperature: 0`, `keep_alive: "30m"` y `format` = JSON Schema del contrato
  [interpretacion.md](contracts/interpretacion.md). Modelo configurable (`FINIA_OLLAMA_MODEL`).
  Timeout configurable, 20 s por defecto. URL configurable para el servidor de la red local.
- **Rationale**: las salidas estructuradas de Ollama restringen la forma de la respuesta; aun así
  se revalida (constitución I). `fetch` evita una dependencia (el SDK `ollama` no aporta nada aquí).
  `keep_alive` mantiene el modelo cargado para cumplir SC-001.
- **Modelo**: el del taller se confirma antes del evento (pre-work). Requisitos para elegirlo:
  buen español, soporte de salidas estructuradas y SC-002 ≥ 27/30 en el conjunto de evaluación
  (`eval/`). La elección final se registra aquí tras correr la evaluación.
- **Alternatives considered**: SDK `ollama` (dependencia extra); `llama.cpp` directo (más
  configuración para los asistentes); cualquier API en la nube (prohibido, constitución III).

## R6. El LLM propone, el código decide

- **Decision**: el LLM devuelve solo una **intención** (`registrar`, `consultar`, `resumen`,
  `corregir`, `borrar`, `no_entendido`) con sus datos. El código:
  - valida con zod (estructura, enums, rangos);
  - convierte el monto **en código** a centavos a partir del texto (`monto_texto`), nunca usa un
    número flotante del LLM;
  - exige que los dígitos del monto aparezcan en el mensaje original (anti-alucinación);
  - valida la fecha (no futura, no más de 366 días atrás);
  - ejecuta la acción a través de un despachador con lista cerrada.
- **Confirmaciones ("sí") no pasan por el LLM**: si hay un registro pendiente (FR-005a), el código
  compara el siguiente mensaje contra una lista fija de afirmativos (`sí`, `si`, `confirmo`, …).
  Así ningún texto puede "confirmar" algo por sugestión al modelo.
- **Mensajes de más de 500 caracteres** se rechazan sin llamar al LLM (reduce superficie de
  inyección y tiempo).
- **Rationale**: constitución I y II. La validación determinista es lo que se prueba; el LLM se
  sustituye por un doble en las pruebas automatizadas.

## R7. Validación de esquemas

- **Decision**: `zod@4.6.5`. Un solo esquema genera el JSON Schema para Ollama
  (`z.toJSONSchema`) y valida la respuesta.
- **Rationale**: una sola fuente de verdad para contrato y validación.
- **Alternatives considered**: `ajv` + JSON Schema escrito a mano (dos fuentes que pueden
  divergir); validación manual (propensa a huecos).

## R8. Almacenamiento

- **Decision**: SQLite con el módulo nativo `node:sqlite` (`DatabaseSync`), archivo local
  `data/finia.db` (fuera del repo). Transacciones para registro + constancia de mensaje.
- **Rationale**: cero dependencias y nada nativo que compilar (importante con SO mixto en el
  taller). `UNIQUE`/`PRIMARY KEY` hacen cumplir la idempotencia en la base, no solo en el código.
- **Trade-off aceptado**: Node 24 imprime `ExperimentalWarning` para `node:sqlite` (verificado en
  24.6.0). Se documenta; no afecta el funcionamiento.
- **Alternatives considered**: `better-sqlite3` (compilación nativa, falla con frecuencia en
  Windows); JSON en disco (sin transacciones ni unicidad).

## R9. Dinero y fechas

- **Decision**:
  - Montos en enteros de centavos (`monto_centavos INTEGER`). Parser propio para "12,500",
    "12.5 mil", "$180", "180 pesos", "99.90". Formato mexicano: coma de miles, punto decimal.
    Máximo dos decimales. Cero y negativos se rechazan.
  - Umbral de confirmación: 5,000,000 centavos ($50,000.00), FR-005a.
  - Fechas como texto `YYYY-MM-DD` en la zona horaria de la máquina.
  - Semana = lunes a domingo. Mes = mes calendario.
  - Formato de salida: `$12,500.00` (`Intl.NumberFormat('es-MX')`, sin flotantes intermedios).
- **Rationale**: constitución II; SC-003 exige coincidencia al centavo.

## R10. Concurrencia

- **Decision**: una cola en serie: los mensajes se procesan de uno en uno, en orden de llegada.
- **Rationale**: un solo usuario; evita carreras con "el último registro" y con el pendiente de
  confirmar. El costo (latencia en ráfagas) es despreciable con un usuario.

## R11. Registros de actividad (logs)

- **Decision**: logger propio mínimo (líneas JSON a stdout) que también se pasa a Baileys con un
  adaptador (nivel `warn` por defecto). Se registran ids, acción y resultado. **No** se registran
  credenciales, contenido de `auth_info/` ni variables de entorno. El texto del mensaje solo se
  registra con `FINIA_LOG_LEVEL=debug`.
- **Rationale**: FR-018; evita depender directamente de `pino`.

## R12. Pruebas

- **Decision**: `node:test` + `node:assert` (nativos). Capas:
  - **unit**: dinero, fechas, categorías, esquema, filtro de mensajes.
  - **integration**: el manejador completo con SQLite en memoria, un intérprete falso y un canal
    falso. Cubre cada escenario de aceptación de la spec.
  - **seguridad**: cada FR de seguridad con una prueba que intenta violarlo (constitución V).
  - **eval** (manual, requiere Ollama): SC-002 (30 mensajes típicos) y SC-004 (20 hostiles) con
    el modelo real. No corre en `npm test` porque depende del hardware.
- **Rationale**: cero dependencias de prueba; las pruebas automatizadas no necesitan WhatsApp ni
  Ollama.

## Dependencias resultantes

| Paquete | Versión exacta | Tipo | Publicada |
|---|---|---|---|
| `baileys` | 7.0.0-rc14 | runtime | 2026-07-29 |
| `zod` | 4.6.5 | runtime | 2026-09-13 |
| `qrcode-terminal` | 0.12.0 | runtime | 2022-06-25 |
| `typescript` | 7.0.2 | dev | 2026-07-08 |
| `@types/node` | 24.19.0 | dev | 2026-09-25 |

Se instalan con `--save-exact` y se versiona `package-lock.json`.
