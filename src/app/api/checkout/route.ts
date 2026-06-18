import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { generarCodigo, iniciales } from "@/lib/codigo";
import type { Producto } from "@/lib/types";

// Recibe { items: [{ id, qty }], mesa }.
// El pago es directo: NO pide móvil ni clave. Eso es opcional y se añade
// después, desde el ticket ("proteger ticket").
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
      if (lineas.length !== 1 || lineas[0].qty !== 1) {
        return NextResponse.json(
          { error: "El bonocopa se compra solo y de uno en uno" },
          { status: 400 }
        );
      }
      consumiciones_total = bonos[0].consumiciones;
    }

    // Prefijo del código a partir del nombre del evento (ej. "MSP")
    const { data: cfg } = await supabase
      .from("config")
      .select("evento_nombre")
      .eq("id", 1)
      .maybeSingle();
    const prefijo = iniciales((cfg as any)?.evento_nombre);

    // Código único (reintenta si colisiona)
    let codigo = generarCodigo(prefijo);
    for (let intento = 0; intento < 5; intento++) {
      const { data: existe } = await supabase
        .from("pedidos")
        .select("id")
        .eq("codigo", codigo)
        .maybeSingle();
      if (!existe) break;
      codigo = generarCodigo(prefijo);
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: total,
      currency: "eur",
      automatic_payment_methods: { enabled: true },
      metadata: { codigo },
    });

    const { error: insErr } = await supabase.from("pedidos").insert({
      codigo,
      mesa: mesa || null,
      items: lineas,
      total_cent: total,
      estado: "pendiente",
      payment_intent_id: paymentIntent.id,
      consumiciones_total: consumiciones_total,
      consumiciones_restantes: consumiciones_total,
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
