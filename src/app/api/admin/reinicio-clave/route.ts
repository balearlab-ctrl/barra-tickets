import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPin } from "@/lib/pin";

export async function POST(req: NextRequest) {
  const auth = createServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { clave } = await req.json();
  const c = (clave || "").toString().trim();
  if (c.length < 4) {
    return NextResponse.json({ error: "La clave debe tener al menos 4 caracteres" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("config")
    .update({ reinicio_hash: hashPin(c) })
    .eq("id", 1);

  if (error) return NextResponse.json({ error: "No se pudo guardar" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
