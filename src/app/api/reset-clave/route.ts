import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizarMovil } from "@/lib/pin";

export async function POST(req: NextRequest) {
  // Solo personal con sesión iniciada
  const auth = createServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { movil } = await req.json();
  const m = normalizarMovil(movil || "");
  if (m.length < 6) {
    return NextResponse.json({ error: "Móvil no válido" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Quita la clave de TODOS los pedidos de ese móvil (mantiene el móvil).
  const { data, error } = await admin
    .from("pedidos")
    .update({ pin_hash: null })
    .eq("movil", m)
    .select("id");

  if (error) {
    return NextResponse.json({ error: "No se pudo resetear" }, { status: 500 });
  }

  // Limpia también el bloqueo por intentos de ese móvil
  await admin
    .from("recuperacion_rate")
    .upsert({ movil: m, fallos: 0, bloqueado_hasta: null });

  return NextResponse.json({ ok: true, afectados: data?.length || 0 });
}
