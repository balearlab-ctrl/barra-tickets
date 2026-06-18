import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPin, normalizarMovil } from "@/lib/pin";

const MAX_FALLOS = 5;
const BLOQUEO_MIN = 10;

// Recuperación: el MÓVIL trae las copas normales.
// La CLAVE (opcional) añade además los bonocopas (que van protegidos).
export async function POST(req: NextRequest) {
  const { movil, pin } = await req.json();
  const m = normalizarMovil(movil || "");
  const p = (pin || "").toString().trim();
  const conClave = /^\d{4}$/.test(p);

  if (m.length < 6) {
    return NextResponse.json({ error: "Móvil no válido" }, { status: 400 });
  }

  const admin = createAdminClient();

  // ¿Bloqueado por intentos de clave?
  const { data: rate } = await admin
    .from("recuperacion_rate")
    .select("*")
    .eq("movil", m)
    .maybeSingle();

  const bloqueado =
    rate?.bloqueado_hasta && new Date(rate.bloqueado_hasta) > new Date();

  // Todos los pedidos de ese móvil
  const { data: pedidos } = await admin
    .from("pedidos")
    .select("*")
    .eq("movil", m)
    .in("estado", ["pagado", "canjeado"])
    .order("creado_en", { ascending: false });

  if (!pedidos || pedidos.length === 0) {
    return NextResponse.json({ resultado: "SIN_PEDIDOS" });
  }

  const normales = pedidos.filter((x: any) => x.consumiciones_total == null);
  const bonos = pedidos.filter((x: any) => x.consumiciones_total != null);
  const bonosSinClave = bonos.filter((x: any) => !x.pin_hash);
  const bonosConClave = bonos.filter((x: any) => !!x.pin_hash);

  // Bonos visibles solo si la clave coincide
  let bonosVisibles: any[] = [];
  let claveIncorrecta = false;
  let minutosBloqueo: number | undefined;

  if (bonosConClave.length > 0 && conClave) {
    if (bloqueado) {
      minutosBloqueo = Math.ceil(
        (new Date(rate!.bloqueado_hasta).getTime() - Date.now()) / 60000
      );
    } else {
      bonosVisibles = bonosConClave.filter((b: any) => verifyPin(p, b.pin_hash));
      if (bonosVisibles.length === 0) {
        // Falla de clave: cuenta intento
        const fallos = (rate?.fallos || 0) + 1;
        const bloquear = fallos >= MAX_FALLOS;
        await admin.from("recuperacion_rate").upsert({
          movil: m,
          fallos: bloquear ? 0 : fallos,
          bloqueado_hasta: bloquear
            ? new Date(Date.now() + BLOQUEO_MIN * 60000).toISOString()
            : null,
        });
        claveIncorrecta = true;
        if (bloquear) minutosBloqueo = BLOQUEO_MIN;
      } else {
        await admin
          .from("recuperacion_rate")
          .upsert({ movil: m, fallos: 0, bloqueado_hasta: null });
      }
    }
  }

  const mostrar = [...normales, ...bonosVisibles];

  // Historial de los que mostramos
  const ids = mostrar.map((x: any) => x.id);
  const { data: logs } = ids.length
    ? await admin
        .from("consumiciones_log")
        .select("pedido_id, cantidad, creado_en")
        .in("pedido_id", ids)
        .order("creado_en", { ascending: true })
    : { data: [] as any[] };

  const limpio = mostrar
    .sort(
      (a: any, b: any) =>
        new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime()
    )
    .map((ped: any) => ({
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

  return NextResponse.json({
    resultado: "OK",
    pedidos: limpio,
    hayBonos: bonosConClave.length > 0,
    bonosMostrados: bonosVisibles.length,
    necesitaNuevaClave: bonosSinClave.length > 0,
    claveIncorrecta,
    minutos: minutosBloqueo,
  });
}
