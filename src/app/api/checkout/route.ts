import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { generarCodigo } from "@/lib/codigo";
import { hashPin, verifyPin, normalizarMovil } from "@/lib/pin";
import type { Producto } from "@/lib/types";

// Recibe { items: [{ id, qty }], mesa }.
// IMPORTANTE: nunca confiamos en el precio que manda el cliente.
// Recalculamos todo desde la base de datos.
export async function POST(req: NextRequest) {
  try {
    const { items, mesa, movil, pin } = await req.json();

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Carrito vacío" }, { status: 400 });
    }

    const movilLimpio = normalizarMovil(movil || "");
    const pinLimpio = (pin || "").toString().trim();
    if (movilLimpio.length < 6) {
      return NextResponse.json({ error: "Móvil no válido" }, { status: 400 });
    }
    if (!/^\d{4}$/.test(pinLimpio)) {
      return NextResponse.json({ error: "La clave debe tener 4 cifras" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Si este móvil ya tiene pedidos, la clave debe coincidir con la suya.
    const { data: previos } = await supabase
      .from("pedidos")
      .select("pin_hash")
      .eq("movil", movilLimpio)
      .in("estado", ["pagado", "canjeado"]);

    if (previos && previos.length > 0) {
      // ¿Bloqueado por intentos fallidos?
      const { data: rate } = await supabase
        .from("recuperacion_rate")
        .select("*")
        .eq("movil", movilLimpio)
        .maybeSingle();
      if (rate?.bloqueado_hasta && new Date(rate.bloqueado_hasta) > new Date()) {
        const mins = Math.ceil(
          (new Date(rate.bloqueado_hasta).getTime() - Date.now()) / 60000
        );
        return NextResponse.json(
          { error: `Demasiados intentos. Prueba en ${mins} min.` },
          { status: 429 }
        );
      }

      const ok = previos.some((p: any) => verifyPin(pinLimpio, p.pin_hash));
      if (!ok) {
        const fallos = (rate?.fallos || 0) + 1;
        const bloquear = fallos >= 5;
        await supabase.from("recuperacion_rate").upsert({
          movil: movilLimpio,
          fallos: bloquear ? 0 : fallos,
          bloqueado_hasta: bloquear
            ? new Date(Date.now() + 10 * 60000).toISOString()
            : null,
        });
        return NextResponse.json(
          { error: "Este móvil ya tiene otra clave. Escribe la que usaste antes." },
          { status: 401 }
        );
      }
      // Acierto: limpia intentos
      await supabase
        .from("recuperacion_rate")
        .upsert({ movil: movilLimpio, fallos: 0, bloqueado_hasta: null });
    }
    const ids = items.map((i: any) => i.id);

    const { data: productos, error } = await supabase
      .from("productos")
      .select("*")
      .in("id", ids)
      .eq("activo", true);

    if (error) throw error;

    const lineas = [] as { nombre: string; precio_cent: number; qty: number }[];
    let total = 0;
    let consumiciones_total: number | null = null;

    for (const item of items) {
      const p = (productos as Producto[]).find((x) => x.id === item.id);
      const qty = Math.max(1, Math.min(99, parseInt(item.qty, 10) || 0));
      if (!p || qty <= 0) continue;
      lineas.push({ nombre: p.nombre, precio_cent: p.precio_cent, qty });
      total += p.precio_cent * qty;
    }

    if (lineas.length === 0 || total <= 0) {
      return NextResponse.json({ error: "Productos no válidos" }, { status: 400 });
    }

    // ¿Hay algún bonocopa? (producto con más de 1 consumición)
    const bonos = items
      .map((i: any) => (productos as Producto[]).find((x) => x.id === i.id))
      .filter((p): p is Producto => !!p && p.consumiciones > 1);

    if (bonos.length > 0) {
      // Regla: el bonocopa se compra solo, 1 por pedido (un QR por bono).
      if (lineas.length !== 1 || items[0].qty != 1) {
        return NextResponse.json(
          { error: "El bonocopa se compra solo y de uno en uno" },
          { status: 400 }
        );
      }
      consumiciones_total = bonos[0].consumiciones;
    }

    // Código único (reintenta si colisiona)
    let codigo = generarCodigo();
    for (let intento = 0; intento < 5; intento++) {
      const { data: existe } = await supabase
        .from("pedidos")
        .select("id")
        .eq("codigo", codigo)
        .maybeSingle();
      if (!existe) break;
      codigo = generarCodigo();
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: total,
      currency: "eur",
      automatic_payment_methods: { enabled: true }, // Apple Pay, tarjeta, etc.
      metadata: { codigo },
    });

    // Guardamos el pedido como "pendiente". Pasará a "pagado" en el webhook.
    const { error: insErr } = await supabase.from("pedidos").insert({
      codigo,
      mesa: mesa || null,
      items: lineas,
      total_cent: total,
      estado: "pendiente",
      payment_intent_id: paymentIntent.id,
      consumiciones_total: consumiciones_total,
      consumiciones_restantes: consumiciones_total,
      movil: movilLimpio,
      pin_hash: hashPin(pinLimpio),
    });
    if (insErr) throw insErr;

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      codigo,
      total_cent: total,
    });
  } catch (e: any) {
    console.error("checkout error", e);
    return NextResponse.json({ error: "No se pudo iniciar el pago" }, { status: 500 });
  }
}
