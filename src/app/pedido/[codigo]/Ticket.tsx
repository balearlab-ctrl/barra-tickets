"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { euros, type PedidoItem, type Config } from "@/lib/types";

type PedidoLite = {
  codigo: string;
  items: PedidoItem[];
  total_cent: number;
  estado: string;
  consumiciones_total: number | null;
  consumiciones_restantes: number | null;
  protegido: boolean;
  tieneClave: boolean;
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

  // Protección del ticket (móvil + clave si es bono)
  const [movil, setMovil] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [movilExiste, setMovilExiste] = useState<boolean | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errProt, setErrProt] = useState<string | null>(null);

  const esBono = pedido?.consumiciones_total != null;

  const refetch = async () => {
    try {
      const r = await fetch(`/api/pedido/${codigo}`, { cache: "no-store" });
      if (r.ok) {
        const d = await r.json();
        setPedido(d.pedido);
      }
    } catch {}
  };

  const comprobarMovil = async () => {
    const m = movil.replace(/[^0-9]/g, "");
    if (m.length < 6) {
      setMovilExiste(null);
      return;
    }
    try {
      const r = await fetch("/api/movil-existe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movil: m }),
      });
      const d = await r.json();
      setMovilExiste(!!d.existe);
    } catch {
      setMovilExiste(null);
    }
  };

  const proteger = async () => {
    setErrProt(null);
    const m = movil.replace(/[^0-9]/g, "");
    if (m.length < 6) {
      setErrProt("Escribe un móvil válido.");
      return;
    }
    if (esBono) {
      if (!/^\d{4}$/.test(pin)) {
        setErrProt("La clave debe tener 4 cifras.");
        return;
      }
      if (movilExiste !== true && pin !== pin2) {
        setErrProt("Las dos claves no coinciden.");
        return;
      }
    }
    setGuardando(true);
    try {
      const r = await fetch("/api/proteger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo, movil: m, pin: esBono ? pin : undefined }),
      });
      const d = await r.json();
      if (d.error) setErrProt(d.error);
      else await refetch();
    } catch {
      setErrProt("No se pudo guardar. Inténtalo de nuevo.");
    } finally {
      setGuardando(false);
    }
  };

  useEffect(() => {
    let activo = true;
    const tick = async () => {
      try {
        const r = await fetch(`/api/pedido/${codigo}`, { cache: "no-store" });
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
        // Se deja de consultar cuando ya no puede cambiar nada:
        // pedido canjeado, o pedido normal ya pagado (sin consumiciones).
        const fin =
          p &&
          (p.estado === "canjeado" ||
            (p.estado === "pagado" && p.consumiciones_total == null));
        if (fin) {
          clearInterval(iv);
          return p;
        }
        tick();
        return p;
      });
    }, 2500);
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

  // Necesita proteger si: copa sin móvil, o bono sin clave (p.ej. tras un reseteo).
  const necesitaProteger =
    !!confirmado &&
    !!pedido &&
    (!pedido.protegido || (esBono && !pedido.tieneClave));

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
            <div className="relative inline-block">
              <div
                className="inline-block rounded-2xl bg-white p-3"
                style={
                  necesitaProteger
                    ? { filter: "blur(9px)", opacity: 0.5 }
                    : undefined
                }
              >
                <QRCodeSVG value={`TICKET:${codigo}`} size={156} level="M" />
              </div>
              {necesitaProteger && (
                <div className="absolute inset-0 flex items-center justify-center text-3xl">
                  🔒
                </div>
              )}
            </div>
            <div className="tk-code mt-4">{codigo}</div>
            <div className="text-xs text-white/45">{config.evento_nombre}</div>
            {pedido?.consumiciones_total != null && (
              <div className="tk-bono">
                {pedido.estado === "canjeado"
                  ? "🎟️ Bonocopa agotado"
                  : `🎟️ Bonocopa · quedan ${pedido.consumiciones_restantes} de ${pedido.consumiciones_total}`}
              </div>
            )}
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

      {necesitaProteger && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 pb-6 pt-10 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-sm rounded-3xl border border-line bg-panel p-5">
            <div className="mb-1 text-center text-3xl">🔒</div>
            <h2 className="text-center font-display text-xl font-extrabold">
              {esBono ? "Guarda tu bonocopa" : "Desbloquea tu QR"}
            </h2>
            <p className="mb-4 mt-1 text-center text-sm text-muted">
              {esBono
                ? "Pon tu móvil y una clave de 4 cifras para poder recuperar tu bono si pierdes esta pantalla."
                : "Pon tu móvil para desbloquear el QR y poder recuperarlo si cierras esta pantalla."}
            </p>

            <label className="mb-1 block text-xs font-semibold text-muted">Móvil</label>
            <input
              value={movil}
              onChange={(e) => {
                setMovil(e.target.value);
                setMovilExiste(null);
              }}
              onBlur={comprobarMovil}
              inputMode="tel"
              placeholder="600 00 00 00"
              className="mb-3 w-full rounded-lg border border-line bg-ink px-3 py-2.5 outline-none focus:border-violet"
            />

            {esBono && movilExiste === true && (
              <>
                <div className="mb-2 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-xs font-semibold text-gold">
                  Este móvil ya tiene clave. Escríbela para ver todo junto.
                </div>
                <label className="mb-1 block text-xs font-semibold text-muted">Tu clave (4 cifras)</label>
                <input
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
                  inputMode="numeric"
                  placeholder="••••"
                  className="mb-1 w-full rounded-lg border border-line bg-ink px-3 py-2.5 text-center font-mono text-lg tracking-[0.3em] outline-none focus:border-violet"
                />
              </>
            )}

            {esBono && movilExiste !== true && (
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
            )}

            {errProt && <p className="mt-3 text-sm text-bad">{errProt}</p>}

            <button
              onClick={proteger}
              disabled={guardando}
              className="mt-4 w-full rounded-xl bg-violet py-3.5 font-display text-[15px] font-bold text-white disabled:opacity-50"
            >
              {guardando ? "Guardando…" : "Desbloquear mi QR"}
            </button>
          </div>
        </div>
      )}

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
        .tk-bono{ margin-top:10px; display:inline-block; padding:7px 14px; border-radius:999px;
          font-family:Syne; font-weight:800; font-size:14px; color:#F5C04E;
          background:rgba(245,192,78,0.12); border:1px solid rgba(245,192,78,0.4); }
        .tk-gold{ color:#F5C04E; }
        .tk-notch{ position:absolute; top:-11px; width:22px; height:22px; border-radius:50%; background:var(--bg); }
      `}</style>
    </div>
  );
}
