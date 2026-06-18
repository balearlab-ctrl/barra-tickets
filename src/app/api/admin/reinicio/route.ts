import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPin } from "@/lib/pin";

export async function POST(req: NextRequest) {
  const auth = createServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { clave } = await req.json();
  const c = (clave || "").toString().trim();

  const admin = createAdminClient();

  // Verifica la clave de reinicio
  const { data: cfg } = await admin
    .from("config")
    .select("evento_nombre, logo_url, reinicio_hash")
    .eq("id", 1)
    .maybeSingle();

  if (!cfg?.reinicio_hash) {
    return NextResponse.json({ error: "Primero define una clave de reinicio." }, { status: 400 });
  }
  if (!verifyPin(c, cfg.reinicio_hash)) {
    return NextResponse.json({ error: "Clave de reinicio incorrecta." }, { status: 401 });
  }

  // Calcula el resumen de la fiesta actual (no archivada)
  const { data: todos } = await admin
    .from("pedidos")
    .select("total_cent, estado, items, consumiciones_total, consumiciones_restantes")
    .eq("archivado", false)
    .in("estado", ["pagado", "canjeado"]);

  const lista = (todos as any[]) || [];
  let ingresos = 0,
    copas = 0,
    bonos = 0,
    consumVendidas = 0,
    consumServidas = 0;
  const prod = new Map<string, { unidades: number; ingresos: number }>();
  const add = (n: string, u: number, ing: number) => {
    const cur = prod.get(n) || { unidades: 0, ingresos: 0 };
    cur.unidades += u;
    cur.ingresos += ing;
    prod.set(n, cur);
  };
  for (const p of lista) {
    ingresos += p.total_cent || 0;
    if (p.consumiciones_total != null) {
      bonos += 1;
      consumVendidas += p.consumiciones_total;
      consumServidas += p.consumiciones_total - (p.consumiciones_restantes ?? 0);
      const l = (p.items || [])[0];
      if (l) add(l.nombre, 1, p.total_cent || 0);
    } else {
      for (const i of p.items || []) {
        copas += i.qty || 0;
        add(i.nombre, i.qty || 0, (i.precio_cent || 0) * (i.qty || 0));
      }
    }
  }
  const resumen = {
    ingresos,
    pedidos: lista.length,
    copas,
    bonos,
    consumVendidas,
    consumServidas,
    porProducto: Array.from(prod.entries())
      .map(([nombre, v]) => ({ nombre, ...v }))
      .sort((a, b) => b.unidades - a.unidades),
  };

  // Archiva el evento
  await admin.from("eventos_archivados").insert({
    nombre: cfg.evento_nombre,
    logo_url: cfg.logo_url,
    resumen,
  });

  // Marca los pedidos como archivados (NO se borran: así se pueden facturar
  // después del evento). El panel del día solo muestra los no archivados.
  await admin.from("pedidos").update({ archivado: true }).eq("archivado", false);

  return NextResponse.json({ ok: true, resumen });
}
