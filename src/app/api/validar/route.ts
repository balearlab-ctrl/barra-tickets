import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Comprueba un código y lo marca como canjeado de forma atómica.
// Requiere personal autenticado.
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { codigo, soloConsultar } = await req.json();
  if (!codigo || typeof codigo !== "string") {
    return NextResponse.json({ error: "Falta el código" }, { status: 400 });
  }

  const admin = createAdminClient();
  const code = codigo.trim().toUpperCase();

  // Modo consulta: ver el pedido sin canjearlo todavía.
  if (soloConsultar) {
    const { data, error } = await admin
      .from("pedidos")
      .select("*")
      .eq("codigo", code)
      .maybeSingle();
    if (error || !data) {
      return NextResponse.json({ resultado: "NO_ENCONTRADO" }, { status: 200 });
    }
    return NextResponse.json({ resultado: "OK", pedido: data });
  }

  // Modo canje: función SQL atómica (evita doble entrega).
  const { data, error } = await admin.rpc("canjear_pedido", { p_codigo: code });

  if (error) {
    const msg = error.message || "";
    if (msg.includes("YA_CANJEADO"))
      return NextResponse.json({ resultado: "YA_CANJEADO" }, { status: 200 });
    if (msg.includes("NO_PAGADO"))
      return NextResponse.json({ resultado: "NO_PAGADO" }, { status: 200 });
    if (msg.includes("NO_ENCONTRADO"))
      return NextResponse.json({ resultado: "NO_ENCONTRADO" }, { status: 200 });
    console.error("validar error", error);
    return NextResponse.json({ error: "Error al validar" }, { status: 500 });
  }

  return NextResponse.json({ resultado: "CANJEADO", pedido: data });
}
