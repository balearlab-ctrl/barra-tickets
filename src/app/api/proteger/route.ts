import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPin, verifyPin, normalizarMovil } from "@/lib/pin";

export async function POST(req: NextRequest) {
  const { codigo, movil, pin } = await req.json();
  const code = (codigo || "").toString().trim().toUpperCase();
  const m = normalizarMovil(movil || "");
  const p = (pin || "").toString().trim();

  if (!code) return NextResponse.json({ error: "Falta el código" }, { status: 400 });
  if (m.length < 6) return NextResponse.json({ error: "Móvil no válido" }, { status: 400 });

  const admin = createAdminClient();

  const { data: pedido } = await admin
    .from("pedidos")
    .select("id, estado, consumiciones_total")
    .eq("codigo", code)
    .maybeSingle();

  if (!pedido) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  if (!["pagado", "canjeado"].includes((pedido as any).estado)) {
    return NextResponse.json({ error: "El pedido aún no está pagado" }, { status: 400 });
  }

  const esBono = (pedido as any).consumiciones_total != null;

  // Los bonos exigen clave de 4 cifras; las copas normales solo móvil.
  if (esBono && !/^\d{4}$/.test(p)) {
    return NextResponse.json({ error: "La clave debe tener 4 cifras" }, { status: 400 });
  }

  const update: any = { movil: m };

  if (/^\d{4}$/.test(p)) {
    // Si ese móvil ya tiene clave en otros pedidos, debe coincidir (todo junto).
    const { data: previos } = await admin
      .from("pedidos")
      .select("pin_hash")
      .eq("movil", m)
      .not("pin_hash", "is", null);

    if (previos && previos.length > 0) {
      const { data: rate } = await admin
        .from("recuperacion_rate")
        .select("*")
        .eq("movil", m)
        .maybeSingle();
      if (rate?.bloqueado_hasta && new Date(rate.bloqueado_hasta) > new Date()) {
        const mins = Math.ceil(
          (new Date(rate.bloqueado_hasta).getTime() - Date.now()) / 60000
        );
        return NextResponse.json(
          { error: `Demasiados intentos. Prueba en ${mins} min.` },
          { status: 429 }
        );
      }
      const ok = previos.some((x: any) => verifyPin(p, x.pin_hash));
      if (!ok) {
        const fallos = (rate?.fallos || 0) + 1;
        const bloquear = fallos >= 5;
        await admin.from("recuperacion_rate").upsert({
          movil: m,
          fallos: bloquear ? 0 : fallos,
          bloqueado_hasta: bloquear
            ? new Date(Date.now() + 10 * 60000).toISOString()
            : null,
        });
        return NextResponse.json(
          { error: "Este móvil ya tiene otra clave. Escribe la que usaste antes." },
          { status: 401 }
        );
      }
      await admin
        .from("recuperacion_rate")
        .upsert({ movil: m, fallos: 0, bloqueado_hasta: null });
    }
    update.pin_hash = hashPin(p);
  }

  const { error: upErr } = await admin.from("pedidos").update(update).eq("id", (pedido as any).id);
  if (upErr) {
    return NextResponse.json({ error: "No se pudo guardar" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
