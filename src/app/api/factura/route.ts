import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizarMovil } from "@/lib/pin";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const m = normalizarMovil(body.movil || "");
  const nombre = (body.nombre || "").toString().trim();
  const nif = (body.nif || "").toString().trim();
  const email = (body.email || "").toString().trim();
  const direccion = (body.direccion || "").toString().trim();
  const cp = (body.cp || "").toString().trim();
  const poblacion = (body.poblacion || "").toString().trim();

  if (m.length < 6) return NextResponse.json({ error: "Móvil no válido" }, { status: 400 });
  if (!nombre) return NextResponse.json({ error: "Falta el nombre o razón social" }, { status: 400 });
  if (!nif) return NextResponse.json({ error: "Falta el NIF/CIF" }, { status: 400 });
  if (!/.+@.+\..+/.test(email))
    return NextResponse.json({ error: "Email no válido" }, { status: 400 });

  const admin = createAdminClient();

  // Reunimos lo consumido por ese móvil
  const { data: pedidos } = await admin
    .from("pedidos")
    .select("codigo, items, total_cent, estado, consumiciones_total")
    .eq("movil", m)
    .in("estado", ["pagado", "canjeado"])
    .order("creado_en", { ascending: true });

  const total = (pedidos || []).reduce((s: number, p: any) => s + (p.total_cent || 0), 0);
  const detalle = (pedidos || []).map((p: any) => ({
    codigo: p.codigo,
    total_cent: p.total_cent,
    bono: p.consumiciones_total != null,
    items: p.items,
  }));

  const { error } = await admin.from("facturas").insert({
    movil: m,
    nombre,
    nif,
    direccion,
    cp,
    poblacion,
    email,
    total_cent: total,
    detalle,
    estado: "pendiente",
  });

  if (error) {
    return NextResponse.json({ error: "No se pudo registrar la solicitud" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
