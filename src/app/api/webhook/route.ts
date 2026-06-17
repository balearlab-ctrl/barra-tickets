import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import Stripe from "stripe";

// El webhook necesita el cuerpo en crudo para verificar la firma.
export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig!,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error("Firma de webhook inválida", err.message);
    return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
  }

  const supabase = createAdminClient();

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent;
    const metodo =
      (pi.payment_method_types && pi.payment_method_types[0]) || "tarjeta";

    // Solo confirmamos el pedido cuando el banco confirma el cobro.
    await supabase
      .from("pedidos")
      .update({ estado: "pagado", pagado_en: new Date().toISOString(), metodo })
      .eq("payment_intent_id", pi.id)
      .eq("estado", "pendiente");
  }

  if (event.type === "payment_intent.payment_failed") {
    const pi = event.data.object as Stripe.PaymentIntent;
    await supabase
      .from("pedidos")
      .update({ estado: "cancelado" })
      .eq("payment_intent_id", pi.id)
      .eq("estado", "pendiente");
  }

  return NextResponse.json({ received: true });
}
