import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizarMovil } from "@/lib/pin";

export async function POST(req: NextRequest) {
  const { movil } = await req.json();
  const m = normalizarMovil(movil || "");
  if (m.length < 6) return NextResponse.json({ existe: false });

  const admin = createAdminClient();
  const { data } = await admin
    .from("pedidos")
    .select("id")
    .eq("movil", m)
    .not("pin_hash", "is", null)
    .limit(1);

  return NextResponse.json({ existe: (data?.length || 0) > 0 });
}
