import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Lectura pública limitada por código (el código es el "secreto" del cliente).
export async function GET(
  _req: NextRequest,
  { params }: { params: { codigo: string } }
) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("pedidos")
    .select(
      "codigo, items, total_cent, estado, mesa, creado_en, consumiciones_total, consumiciones_restantes"
    )
    .eq("codigo", params.codigo.toUpperCase())
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  return NextResponse.json({ pedido: data });
}
