import { scryptSync, randomBytes, timingSafeEqual } from "crypto";

// Cifra el PIN (nunca se guarda en claro). Formato: scrypt:salt:hash
export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pin, salt, 32);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPin(pin: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  try {
    const salt = Buffer.from(parts[1], "hex");
    const hash = Buffer.from(parts[2], "hex");
    const test = scryptSync(pin, salt, hash.length);
    return hash.length === test.length && timingSafeEqual(hash, test);
  } catch {
    return false;
  }
}

// Deja el móvil en solo dígitos para comparar de forma consistente.
export function normalizarMovil(m: string): string {
  return (m || "").replace(/[^0-9]/g, "");
}
