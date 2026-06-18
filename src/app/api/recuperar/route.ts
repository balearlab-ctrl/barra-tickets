import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPin, normalizarMovil } from "@/lib/pin";

const MAX_FALLOS = 5;
const BLOQUEO_MIN = 10;

export async function POST(req: NextRequest) {
  const { movil, pin } = await req.json();
  const m = normalizarMovil(movil || "");
  const p = (pin || "").toString().trim();

  if (m.length < 6 || !/^\d{4}$/.test(p)) {
    return NextResponse.json({ error: "Datos no válidos" }, { status: 400 });
  }

  const admin = createAdminClient();

  // 1) ¿Está bloqueado por demasiados intentos?
  const { data: rate } = await admin
    .from("recuperacion_rate")
    .select("*")
    .eq("movil", m)
    .maybeSingle();

  if (rate?.bloqueado_hasta && new Date(rate.bloqueado_hasta) > new Date()) {
    const mins = Math.ceil(
      (new Date(rate.bloqueado_hasta).getTime() - Date.now()) / 60000
    );
    return NextResponse.json({ resultado: "BLOQUEADO", minutos: mins });
  }

  // 2) Buscar pedidos pagados/canjeados de ese móvil
  const { data: pedidos } = await admin
    .from("pedidos")
    .select("*")
    .eq("movil", m)
    .in("estado", ["pagado", "canjeado"])
    .order("creado_en", { ascending: false });

  // Sin ningún pedido para ese móvil: no es un fallo de clave.
  if (!pedidos || pedidos.length === 0) {
    return NextResponse.json({ resultado: "SIN_PEDIDOS" });
  }

  const validos = pedidos.filter((ped: any) => verifyPin(p, ped.pin_hash));

  if (validos.length === 0) {
    // Falla de clave: suma intento y bloquea si procede
    const fallos = (rate?.fallos || 0) + 1;
    const bloquear = fallos >= MAX_FALLOS;
    await admin.from("recuperacion_rate").upsert({
      movil: m,
      fallos: bloquear ? 0 : fallos,
      bloqueado_hasta: bloquear
        ? new Date(Date.now() + BLOQUEO_MIN * 60000).toISOString()
        : null,
    });
    return NextResponse.json({
      resultado: bloquear ? "BLOQUEADO" : "INCORRECTO",
      minutos: bloquear ? BLOQUEO_MIN : undefined,
    });
  }

  // 3) Éxito: limpia intentos, trae el historial y devuelve los pedidos (sin la clave)
  await admin.from("recuperacion_rate").upsert({ movil: m, fallos: 0, bloqueado_hasta: null });

  const ids = validos.map((p: any) => p.id);
  const { data: logs } = await admin
    .from("consumiciones_log")
    .select("pedido_id, cantidad, creado_en")
    .in("pedido_id", ids)
    .order("creado_en", { ascending: true });

  const limpio = validos.map((ped: any) => ({
    codigo: ped.codigo,
    items: ped.items,
    total_cent: ped.total_cent,
    estado: ped.estado,
    creado_en: ped.creado_en,
    consumiciones_total: ped.consumiciones_total,
    consumiciones_restantes: ped.consumiciones_restantes,
    historial: (logs || [])
      .filter((l: any) => l.pedido_id === ped.id)
      .map((l: any) => ({ cantidad: l.cantidad, creado_en: l.creado_en })),
  }));

  return NextResponse.json({ resultado: "OK", pedidos: limpio });
}
