import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { generarCodigo } from "@/lib/codigo";
import type { Producto } from "@/lib/types";

// Recibe { items: [{ id, qty }], mesa }.
// IMPORTANTE: nunca confiamos en el precio que manda el cliente.
// Recalculamos todo desde la base de datos.
export async function POST(req: NextRequest) {
  try {
    const { items, mesa } = await req.json();

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Carrito vacío" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const ids = items.map((i: any) => i.id);

    const { data: productos, error } = await supabase
      .from("productos")
      .select("*")
      .in("id", ids)
      .eq("activo", true);

    if (error) throw error;

    const lineas = [] as { nombre: string; precio_cent: number; qty: number }[];
    let total = 0;

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
