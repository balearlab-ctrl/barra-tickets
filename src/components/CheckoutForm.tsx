"use client";

import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { euros } from "@/lib/types";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

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

  // Paso 1: datos para recuperar el pedido
  const [movil, setMovil] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [preparando, setPreparando] = useState(false);

  const continuar = async () => {
    setError(null);
    const m = movil.replace(/[^0-9]/g, "");
    if (m.length < 6) {
      setError("Escribe un móvil válido.");
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      setError("La clave debe tener 4 cifras.");
      return;
    }
    if (pin !== pin2) {
      setError("Las dos claves no coinciden.");
      return;
    }
    setPreparando(true);
    try {
      const r = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, mesa, movil: m, pin }),
      });
      const d = await r.json();
      if (d.error) setError(d.error);
      else {
        setClientSecret(d.clientSecret);
        setCodigo(d.codigo);
      }
    } catch {
      setError("No se pudo conectar con el pago.");
    } finally {
      setPreparando(false);
    }
  };

  return (
    <main className="relative z-10 mx-auto max-w-xl px-4 pb-32 pt-5">
      <button onClick={onBack} className="mb-4 text-sm text-muted">
        ← Volver a la carta
      </button>

      <div className="mb-4 rounded-2xl border border-line bg-panel p-4">
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Pagar pedido</p>
        <h2 className="font-display text-3xl font-bold">{euros(totalCent)}</h2>
      </div>

      {/* PASO 1: datos de recuperación */}
      {!clientSecret && (
        <div className="rounded-2xl border border-line bg-panel p-4">
          <p className="mb-1 text-sm font-semibold">Tus datos para recuperar el pedido</p>
          <p className="mb-4 text-xs text-muted">
            Con tu móvil y esta clave podrás volver a tu QR si cierras la página.
          </p>

          <label className="mb-1 block text-xs font-semibold text-muted">Móvil</label>
          <input
            value={movil}
            onChange={(e) => setMovil(e.target.value)}
            inputMode="tel"
            placeholder="600 00 00 00"
            className="mb-3 w-full rounded-lg border border-line bg-ink px-3 py-2.5 outline-none focus:border-violet"
          />

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-semibold text-muted">Clave (4 cifras)</label>
              <input
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
                inputMode="numeric"
                placeholder="••••"
                className="w-full rounded-lg border border-line bg-ink px-3 py-2.5 text-center font-mono text-lg tracking-[0.3em] outline-none focus:border-violet"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-semibold text-muted">Repite la clave</label>
              <input
                value={pin2}
                onChange={(e) => setPin2(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
                inputMode="numeric"
                placeholder="••••"
                className="w-full rounded-lg border border-line bg-ink px-3 py-2.5 text-center font-mono text-lg tracking-[0.3em] outline-none focus:border-violet"
              />
            </div>
          </div>

          {error && <p className="mt-3 text-sm text-bad">{error}</p>}

          <button
            onClick={continuar}
            disabled={preparando}
            style={{ background: accent }}
            className="mt-4 w-full rounded-xl py-3.5 font-display text-[15px] font-bold text-white disabled:opacity-50"
          >
            {preparando ? "Preparando…" : "Continuar al pago"}
          </button>
        </div>
      )}

      {/* PASO 2: pago con Stripe */}
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
