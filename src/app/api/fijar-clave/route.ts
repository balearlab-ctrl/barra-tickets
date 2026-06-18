import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPin, verifyPin, normalizarMovil } from "@/lib/pin";

// El cliente crea una clave nueva para sus bonos que se quedaron sin clave
// (por ejemplo, tras un reseteo desde el panel).
export async function POST(req: NextRequest) {
  const { movil, pin } = await req.json();
  const m = normalizarMovil(movil || "");
  const p = (pin || "").toString().trim();

  if (m.length < 6) return NextResponse.json({ error: "Móvil no válido" }, { status: 400 });
  if (!/^\d{4}$/.test(p))
    return NextResponse.json({ error: "La clave debe tener 4 cifras" }, { status: 400 });

  const admin = createAdminClient();

  // Bonos de ese móvil
  const { data: bonos } = await admin
    .from("pedidos")
    .select("id, pin_hash, consumiciones_total")
    .eq("movil", m)
    .not("consumiciones_total", "is", null);

  if (!bonos || bonos.length === 0) {
    return NextResponse.json({ error: "No hay bonos para este móvil" }, { status: 404 });
  }

  // Si ya hay bonos con clave, la nueva debe coincidir (todo bajo la misma).
  const conClave = bonos.filter((b: any) => !!b.pin_hash);
  if (conClave.length > 0) {
    const ok = conClave.some((b: any) => verifyPin(p, b.pin_hash));
    if (!ok) {
      return NextResponse.json(
        { error: "Este móvil ya tiene otra clave para otros bonos." },
        { status: 401 }
      );
    }
  }

  // Fija la clave en los bonos que no la tienen
  const sinClave = bonos.filter((b: any) => !b.pin_hash).map((b: any) => b.id);
  if (sinClave.length > 0) {
    const hash = hashPin(p);
    const { error } = await admin.from("pedidos").update({ pin_hash: hash }).in("id", sinClave);
    if (error) return NextResponse.json({ error: "No se pudo guardar" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
