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

  const { codigo, soloConsultar, cantidad } = await req.json();
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
    // Un ticket de un evento ya cerrado no es válido en barra.
    if ((data as any).archivado) {
      return NextResponse.json({ resultado: "NO_ENCONTRADO" }, { status: 200 });
    }
    return NextResponse.json({ resultado: "OK", pedido: data });
  }

  // Modo consumo: función SQL atómica (evita doble entrega / saldo negativo).
  const q = Math.max(1, parseInt(cantidad, 10) || 1);
  const { data, error } = await admin.rpc("consumir_pedido", {
    p_codigo: code,
    p_cantidad: q,
  });

  if (error) {
    const msg = error.message || "";
    if (msg.includes("YA_CANJEADO"))
      return NextResponse.json({ resultado: "YA_CANJEADO" }, { status: 200 });
    if (msg.includes("NO_PAGADO"))
      return NextResponse.json({ resultado: "NO_PAGADO" }, { status: 200 });
    if (msg.includes("ARCHIVADO"))
      return NextResponse.json({ resultado: "NO_ENCONTRADO" }, { status: 200 });
    if (msg.includes("NO_ENCONTRADO"))
      return NextResponse.json({ resultado: "NO_ENCONTRADO" }, { status: 200 });
    if (msg.includes("SALDO_INSUFICIENTE"))
      return NextResponse.json({ resultado: "SALDO_INSUFICIENTE" }, { status: 200 });
    console.error("validar error", error);
    return NextResponse.json({ error: "Error al validar" }, { status: 500 });
  }

  // Si el pedido quedó 'canjeado' está agotado; si sigue 'pagado', es un bono con saldo.
  const agotado = (data as any)?.estado === "canjeado";
  return NextResponse.json({
    resultado: agotado ? "CANJEADO" : "PARCIAL",
    pedido: data,
  });
}
