"use client";

import { useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { euros } from "@/lib/types";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

type Item = { id: string; qty: number };

export default function CheckoutForm({
  items,
  mesa,
  totalCent,
  accent = "#FF2D78",
  onBack,
}: {
  items: Item[];
  mesa: string | null;
  totalCent: number;
  accent?: string;
  onBack: () => void;
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, mesa }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else {
          setClientSecret(d.clientSecret);
          setCodigo(d.codigo);
        }
      })
      .catch(() => setError("No se pudo conectar con el pago"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="relative z-10 mx-auto max-w-xl px-4 pb-32 pt-5">
      <button onClick={onBack} className="mb-4 text-sm text-muted">
        ← Volver a la carta
      </button>

      <div className="mb-4 rounded-2xl border border-line bg-panel p-4">
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
          Pagar pedido
        </p>
        <h2 className="font-display text-3xl font-bold">{euros(totalCent)}</h2>
      </div>

      {error && (
        <div className="rounded-xl border border-bad/30 bg-bad/10 p-4 text-sm text-bad">
          {error}
        </div>
      )}

      {!clientSecret && !error && (
        <p className="py-10 text-center text-muted">Preparando el pago…</p>
      )}

      {clientSecret && codigo && (
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: {
              theme: "night",
              variables: {
                colorPrimary: "#7C5CFF",
                colorBackground: "#16141D",
                colorText: "#F2EEF8",
                borderRadius: "12px",
                fontFamily: "Inter, system-ui, sans-serif",
              },
            },
          }}
        >
          <PagoInterno codigo={codigo} accent={accent} />
        </Elements>
      )}
    </main>
  );
}

function PagoInterno({ codigo, accent }: { codigo: string; accent: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const pagar = async () => {
    if (!stripe || !elements) return;
    setLoading(true);
    setMsg(null);

    const base = process.env.NEXT_PUBLIC_BASE_URL || window.location.origin;
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${base}/pedido/${codigo}` },
    });

    // Si llega aquí, hubo un error inmediato (la mayoría redirige antes).
    if (error) {
      setMsg(error.message || "No se pudo completar el pago");
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-line bg-panel p-4">
      <PaymentElement />
      {msg && <p className="mt-3 text-sm text-bad">{msg}</p>}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-[rgba(11,10,15,0.92)] px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto max-w-xl">
          <button
            onClick={pagar}
            disabled={!stripe || loading}
            style={{ background: `linear-gradient(100deg, ${accent}, ${accent})` }}
            className="w-full rounded-xl py-4 font-display text-base font-extrabold text-white disabled:opacity-50"
          >
            {loading ? "Procesando…" : "Pagar ahora"}
          </button>
          <p className="mt-2 text-center text-[11px] text-muted">
            Pago seguro con Stripe · Apple Pay, Google Pay y tarjeta
          </p>
        </div>
      </div>
    </div>
  );
}
