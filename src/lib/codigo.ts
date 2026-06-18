// Genera un código corto y legible para enseñar en barra.
// Formato "pro": iniciales del evento + 5 aleatorios, ej "MSP-A7K2X".
// Evita caracteres ambiguos (0/O, 1/I, etc.) en la parte aleatoria.
const ALFABETO = "ACDEFHJKLMNPRTUVWXY349";

// Saca hasta 3 iniciales del nombre del evento (sin acentos ni símbolos).
export function iniciales(nombre?: string): string {
  const limpio = (nombre || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .toUpperCase()
    .replace(/[^A-Z\s]/g, " ")
    .trim();

  if (!limpio) return "BT"; // por defecto: Barra Tickets

  const palabras = limpio.split(/\s+/).filter(Boolean);
  let pref = "";
  if (palabras.length >= 2) {
    pref = palabras.slice(0, 3).map((p) => p[0]).join("");
  } else {
    pref = palabras[0].slice(0, 3);
  }
  return pref.slice(0, 3) || "BT";
}

export function generarCodigo(prefijo?: string): string {
  const pref = (prefijo || "BT").replace(/[^A-Z]/g, "").slice(0, 3) || "BT";
  let s = "";
  for (let i = 0; i < 5; i++) {
    s += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
  }
  return `${pref}-${s}`;
}
