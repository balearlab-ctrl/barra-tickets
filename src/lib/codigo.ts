// Genera un código corto y legible para enseñar en barra, ej "AB-CD".
// Evita caracteres ambiguos (0/O, 1/I, etc.).
const ALFABETO = "ACDEFHJKLMNPRTUVWXY349";

export function generarCodigo(): string {
  let s = "";
  for (let i = 0; i < 4; i++) {
    s += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
  }
  return s.slice(0, 2) + "-" + s.slice(2, 4);
}
