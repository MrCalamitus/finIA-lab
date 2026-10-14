// qrcode-terminal no publica tipos.
declare module 'qrcode-terminal' {
  const qrcode: {
    generate(texto: string, opciones?: { small?: boolean }, callback?: (qr: string) => void): void;
  };
  export default qrcode;
}
