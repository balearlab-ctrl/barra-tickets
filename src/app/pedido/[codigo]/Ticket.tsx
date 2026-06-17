"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { euros, type PedidoItem, type Config } from "@/lib/types";

type PedidoLite = {
  codigo: string;
  items: PedidoItem[];
  total_cent: number;
  estado: string;
};

export default function Ticket({
  codigo,
  config,
}: {
  codigo: string;
  config: Config;
}) {
  const [pedido, setPedido] = useState<PedidoLite | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let activo = true;
    const tick = async () => {
      try {
        const r = await fetch(`/api/pedido/${codigo}`);
        if (!r.ok) {
          if (activo) setError(true);
          return;
        }
        const d = await r.json();
        if (activo) setPedido(d.pedido);
      } catch {
        /* reintenta */
      }
    };
    tick();
    const iv = setInterval(() => {
      setPedido((p) => {
        if (p && (p.estado === "pagado" || p.estado === "canjeado")) {
          clearInterval(iv);
          return p;
        }
        tick();
        return p;
      });
    }, 2000);
    return () => {
      activo = false;
      clearInterval(iv);
    };
  }, [codigo]);

  const themeVars = {
    ["--c1" as any]: config.color1,
    ["--c2" as any]: config.color2,
    ["--bg" as any]: config.fondo,
  } as React.CSSProperties;

  if (error) {
    return (
      <div style={themeVars} className="tk-root">
        <main className="mx-auto max-w-xl px-4 py-16 text-center text-white/55">
          No encontramos este pedido.
        </main>
      </div>
    );
  }

  const confirmado =
    pedido && (pedido.estado === "pagado" || pedido.estado === "canjeado");

  return (
    <div style={themeVars} className="tk-root">
      <div className="tk-aurora" aria-hidden />
      <main className="relative mx-auto max-w-xl px-4 pb-16 pt-7">
        <div className="mb-1 text-center">
          {config.logo_url && (
            <img
              src={config.logo_url}
              alt={config.evento_nombre}
              className="mx-auto mb-3 max-h-16 w-auto object-contain"
            />
          )}
          {confirmado ? (
            <span className="tk-badge tk-ok">✓ Pago confirmado</span>
          ) : (
            <span className="tk-badge tk-wait">Confirmando el pago…</span>
          )}
        </div>
        <p className="tk-title mb-5 text-center text-2xl font-extrabold">
          {confirmado ? "Listo para recoger en barra" : "Un momento…"}
        </p>

        <div className="tk-ticket">
          <div className="px-5 pb-4 pt-6 text-center">
            <div className="inline-block rounded-2xl bg-white p-3">
              <QRCodeSVG value={`TICKET:${codigo}`} size={156} level="M" />
            </div>
            <div className="tk-code mt-4">{codigo}</div>
            <div className="text-xs text-white/45">{config.evento_nombre}</div>
          </div>

          <div className="relative border-t-2 border-dashed border-white/15">
            <span className="tk-notch -left-3" />
            <span className="tk-notch -right-3" />
          </div>

          <div className="px-5 pb-5 pt-4">
            {pedido?.items.map((i, idx) => (
              <div
                key={idx}
                className="flex justify-between py-1 text-[13px] text-white/55"
              >
                <span>
                  {i.qty}× <b className="font-semibold text-white">{i.nombre}</b>
                </span>
                <span>{euros(i.precio_cent * i.qty)}</span>
              </div>
            ))}
            {pedido && (
              <div className="mt-2 flex justify-between border-t border-white/12 pt-2 text-[13px]">
                <b className="text-white">Total pagado</b>
                <b className="tk-gold">{euros(pedido.total_cent)}</b>
              </div>
            )}
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-white/45">
          Enseña este código o QR en la barra. No hace falta hacer cola.
        </p>
      </main>

      <style>{`
        .tk-root{ position:relative; min-height:100vh; background:var(--bg); color:#F2EEF8; overflow:hidden; }
        .tk-aurora{ position:fixed; inset:-30% -10% auto -10%; height:60vh; z-index:0; pointer-events:none;
          background:
            radial-gradient(50% 60% at 25% 0%, color-mix(in srgb, var(--c1) 50%, transparent), transparent 70%),
            radial-gradient(55% 60% at 80% 0%, color-mix(in srgb, var(--c2) 50%, transparent), transparent 70%);
          filter:blur(34px); }
        .tk-title{ font-family:Syne,system-ui,sans-serif; letter-spacing:-0.02em; }
        .tk-badge{ display:inline-flex; align-items:center; gap:7px; padding:7px 14px; border-radius:999px;
          font-weight:800; font-size:13px; font-family:Syne; }
        .tk-ok{ background:rgba(52,211,153,0.14); color:#34D399; border:1px solid rgba(52,211,153,0.35); }
        .tk-wait{ background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.6); border:1px solid rgba(255,255,255,0.12); }
        .tk-ticket{ position:relative; z-index:1; overflow:hidden; border-radius:22px;
          border:1px solid rgba(255,255,255,0.1);
          background:linear-gradient(180deg, color-mix(in srgb, var(--c2) 16%, #15121d), #141019); }
        .tk-code{ font-family:'Space Mono',monospace; font-weight:700; font-size:32px; letter-spacing:0.14em;
          color:#F5C04E; }
        .tk-gold{ color:#F5C04E; }
        .tk-notch{ position:absolute; top:-11px; width:22px; height:22px; border-radius:50%; background:var(--bg); }
      `}</style>
    </div>
  );
}
