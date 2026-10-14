import type { Canal, MensajeEntrante } from '../../src/tipos.ts';

export interface Envio {
  id: string;
  texto: string;
}

export interface CanalFalso extends Canal {
  enviados: Envio[];
  /** Si se define, cada envío se reinyecta como eco (`fromMe=true`), como hace WhatsApp. */
  alEco: ((eco: MensajeEntrante) => void) | null;
  /** Número de envíos siguientes que deben fallar. */
  fallosPendientes: number;
  ultimo(): string | undefined;
}

export function crearCanalFalso(grupoJid: string, reloj: () => Date): CanalFalso {
  let contador = 0;
  const canal: CanalFalso = {
    enviados: [],
    alEco: null,
    fallosPendientes: 0,
    ultimo() {
      return canal.enviados.at(-1)?.texto;
    },
    async enviar(texto) {
      if (canal.fallosPendientes > 0) {
        canal.fallosPendientes--;
        throw new Error('envío fallido (doble)');
      }
      contador++;
      const id = `${grupoJid}:bot-${contador}`;
      canal.enviados.push({ id, texto });
      if (canal.alEco) {
        const eco: MensajeEntrante = { id, remoteJid: grupoJid, fromMe: true, texto, citadoId: null, enviadoEn: reloj() };
        // Como Baileys: el eco llega mientras el envío todavía se está resolviendo.
        canal.alEco(eco);
      }
      return id;
    },
  };
  return canal;
}
