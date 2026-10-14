# Contrato: configuración

Toda la configuración se lee de variables de entorno (constitución IV). El repo solo incluye
`.env.example` con estos nombres y valores de ejemplo, nunca valores reales. Al arrancar, la
configuración se valida con zod; si falta algo obligatorio, el proceso termina con un mensaje que
nombra la variable, **sin imprimir su valor**.

| Variable | Obligatoria | Por defecto | Descripción |
|---|---|---|---|
| `FINIA_GROUP_JID` | sí | — | id del grupo, p. ej. `120363000000000000@g.us`. Se obtiene con `npm run grupos` |
| `FINIA_OLLAMA_URL` | no | `http://127.0.0.1:11434` | debe ser `localhost`, `127.0.0.1` o una IP privada (RFC 1918); otra cosa se rechaza al arrancar (FR-017) |
| `FINIA_OLLAMA_MODEL` | sí | — | nombre del modelo en Ollama |
| `FINIA_LLM_TIMEOUT_MS` | no | `20000` | tiempo máximo por interpretación |
| `FINIA_AUTH_DIR` | no | `./auth_info` | carpeta de sesión de WhatsApp. En `.gitignore` |
| `FINIA_DB_PATH` | no | `./data/finia.db` | base de datos. `data/` en `.gitignore` |
| `FINIA_LOG_LEVEL` | no | `info` | `debug` \| `info` \| `warn` \| `error`. Solo `debug` registra texto de mensajes |

## Archivos que nunca se versionan

`.env`, `.env.local`, `auth_info*/`, `data/`. Una prueba automatizada verifica que estén en
`.gitignore`.

## Scripts (`package.json`)

| Script | Uso |
|---|---|
| `npm start` | arranca el asistente (muestra el QR la primera vez) |
| `npm run grupos` | lista los grupos de la cuenta con su id, para llenar `FINIA_GROUP_JID` |
| `npm test` | pruebas automatizadas (sin WhatsApp ni Ollama) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run eval` | evaluación SC-002 y SC-004 contra el modelo real |
