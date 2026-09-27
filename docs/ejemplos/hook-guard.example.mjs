#!/usr/bin/env node
// EJEMPLO de hook PreToolUse para Claude Code (multiplataforma, solo Node).
// Uso: copiar a .claude/hooks/guard.mjs y registrarlo en .claude/settings.json
//      (ver settings.json.example).
//
// Claude Code envía por stdin un JSON con la acción que el agente quiere ejecutar:
//   { "tool_name": "Bash", "tool_input": { "command": "..." } }
//   { "tool_name": "Read", "tool_input": { "file_path": "..." } }
// Salir con código 2 BLOQUEA la acción; el texto de stderr le llega al modelo como motivo.

// Coinciden como ruta (/p/.env) o dentro de un comando (cat .env, "auth_info/creds.json").
// .env.example sí está permitido: es la plantilla sin secretos.
const SECRET_PATHS = [
  /(^|[\s\\/'"=(])\.env(?!\.example\b)(?![\w-])/,
  /(^|[\s\\/'"=(])auth_info\w*/,
];

const DANGEROUS_COMMANDS = [
  { re: /\brm\s+-[a-z]*r[a-z]*f|\brm\s+-[a-z]*f[a-z]*r/i, why: "borrado recursivo forzado" },
  { re: /Remove-Item\b.*-Recurse/i, why: "borrado recursivo (PowerShell)" },
  { re: /\bgit\s+push\b.*(--force|-f\b)/, why: "push forzado" },
  { re: /\bgit\s+reset\s+--hard\b/, why: "reset destructivo" },
  { re: /\b(curl|wget|irm|iwr)\b.*\|\s*(sh|bash|iex)\b/i, why: "ejecutar scripts descargados" },
  { re: /\bDROP\s+(TABLE|DATABASE)\b/i, why: "borrado de tablas" },
];

function block(reason) {
  process.stderr.write(`Bloqueado por hook de seguridad: ${reason}. Propón una alternativa segura o pide confirmación al usuario.\n`);
  process.exit(2);
}

let raw = "";
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    process.exit(0); // si no entendemos la entrada, no bloqueamos (las reglas deny siguen activas)
  }

  const { tool_name: tool, tool_input: input = {} } = event;

  if (tool === "Bash" || tool === "PowerShell") {
    const cmd = String(input.command ?? "");
    for (const { re, why } of DANGEROUS_COMMANDS) {
      if (re.test(cmd)) block(why);
    }
    // Cubre lo que las reglas deny no ven: `bash -c 'cat .env'`, `node -e "...auth_info..."`, etc.
    if (SECRET_PATHS.some((re) => re.test(cmd))) block("acceso a secretos desde la terminal");
  }

  if (tool === "Read" || tool === "Edit" || tool === "Write") {
    const path = String(input.file_path ?? "");
    if (SECRET_PATHS.some((re) => re.test(path))) block(`acceso a archivo sensible (${path})`);
  }

  process.exit(0);
});
