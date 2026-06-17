"use client";

import { useMemo, useState } from "react";
import { Producto, Config, euros } from "@/lib/types";
import CheckoutForm from "@/components/CheckoutForm";

export default function CartaClient({
  productos,
  config,
}: {
  productos: Producto[];
  config: Config;
}) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [pagando, setPagando] = useState(false);

  const categorias = useMemo(
    () => [...new Set(productos.map((p) => p.categoria))],
    [productos]
  );
  const total = useMemo(
    () =>
      Object.entries(cart).reduce((s, [id, q]) => {
        const p = productos.find((x) => x.id === id);
        return s + (p ? p.precio_cent * q : 0);
      }, 0),
    [cart, productos]
  );
  const count = Object.values(cart).reduce((a, b) => a + b, 0);

  const chg = (id: string, d: number) =>
    setCart((c) => {
      const q = (c[id] || 0) + d;
      const next = { ...c };
      if (q <= 0) delete next[id];
      else next[id] = q;
      return next;
    });

  const itemsParaApi = Object.entries(cart).map(([id, qty]) => ({ id, qty }));

  // Variables de color que vienen del panel de control.
  const themeVars = {
    ["--c1" as any]: config.color1,
    ["--c2" as any]: config.color2,
    ["--bg" as any]: config.fondo,
  } as React.CSSProperties;

  if (pagando) {
    return (
      <div style={themeVars} className="bt-root">
        <Estilos />
        {config.banner_url && (
          <div
            className="bt-banner"
            aria-hidden
            style={{ backgroundImage: `url(${config.banner_url})` }}
          />
        )}
        <CheckoutForm
          items={itemsParaApi}
          mesa={null}
          totalCent={total}
          accent={config.color1}
          onBack={() => setPagando(false)}
        />
      </div>
    );
  }

  return (
    <div style={themeVars} className="bt-root">
      <Estilos />
      {config.banner_url && (
        <div
          className="bt-banner"
          aria-hidden
          style={{ backgroundImage: `url(${config.banner_url})` }}
        />
      )}
      <div className="bt-aurora" aria-hidden />

      <main className="relative mx-auto max-w-xl px-4 pb-32 pt-7">
        {/* HERO con logo */}
        <header className="mb-7 text-center">
          {config.logo_url ? (
            <img
              src={config.logo_url}
              alt={config.evento_nombre}
              className="mx-auto mb-3 max-h-48 w-auto object-contain drop-shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
            />
          ) : (
            <span className="bt-dot mx-auto mb-3 block" />
          )}
          <h1 className="bt-title text-3xl font-extrabold leading-none">
            {config.evento_nombre}
          </h1>
          <p className="mt-2 text-sm text-white/55">{config.subtitulo}</p>
        </header>

        <div className="bt-card mb-6 p-5 text-center">
          <p className="bt-eyebrow">Carta de la barra</p>
          <h2 className="bt-title mt-1 text-2xl font-bold">¿Qué te pongo?</h2>
          <p className="mt-1 text-[13px] text-white/50">
            Elige, paga y recoge enseñando tu QR
          </p>
        </div>

        {productos.length === 0 && (
          <p className="py-10 text-center text-white/50">
            No hay productos disponibles ahora mismo.
          </p>
        )}

        {categorias.map((cat) => (
          <section key={cat}>
            <div className="bt-cat">{cat}</div>
            {productos
              .filter((p) => p.categoria === cat)
              .map((p) => {
                const q = cart[p.id] || 0;
                return (
                  <div
                    key={p.id}
                    className={`bt-item ${q > 0 ? "bt-item-on" : ""}`}
                  >
                    <div>
                      <div className="font-semibold">{p.nombre}</div>
                      <div className="bt-price">{euros(p.precio_cent)}</div>
                    </div>
                    <div className="flex-1" />
                    {q > 0 ? (
                      <div className="bt-stepper">
                        <button onClick={() => chg(p.id, -1)}>–</button>
                        <span>{q}</span>
                        <button onClick={() => chg(p.id, 1)}>+</button>
                      </div>
                    ) : (
                      <button className="bt-add" onClick={() => chg(p.id, 1)}>
                        Añadir
                      </button>
                    )}
                  </div>
                );
              })}
          </section>
        ))}
      </main>

      {count > 0 && (
        <div className="bt-bar">
          <div className="mx-auto flex max-w-xl items-center gap-3 px-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.12em] text-white/55">
                {count} producto{count > 1 ? "s" : ""}
              </div>
              <div className="bt-total">{euros(total)}</div>
            </div>
            <button className="bt-pay" onClick={() => setPagando(true)}>
              Pagar pedido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Estilos() {
  return (
    <style>{`
      .bt-root{ position:relative; min-height:100vh; background:var(--bg); color:#F2EEF8; overflow:hidden; }
      .bt-banner{ position:fixed; inset:0; z-index:0; background-size:cover; background-position:center top; }
      .bt-banner::after{ content:""; position:absolute; inset:0;
        background:linear-gradient(180deg,
          color-mix(in srgb, var(--bg) 74%, transparent) 0%,
          color-mix(in srgb, var(--bg) 88%, transparent) 45%,
          var(--bg) 100%); }
      .bt-aurora{
        position:fixed; inset:-30% -10% auto -10%; height:70vh; z-index:0; pointer-events:none;
        background:
          radial-gradient(50% 60% at 20% 10%, color-mix(in srgb, var(--c1) 55%, transparent), transparent 70%),
          radial-gradient(55% 65% at 85% 0%, color-mix(in srgb, var(--c2) 55%, transparent), transparent 70%);
        filter:blur(30px); animation:btfloat 12s ease-in-out infinite alternate;
      }
      @keyframes btfloat{ from{ transform:translateY(-12px) scale(1); } to{ transform:translateY(14px) scale(1.08); } }
      @media (prefers-reduced-motion: reduce){ .bt-aurora{ animation:none; } }

      .bt-title{ font-family:Syne,system-ui,sans-serif; letter-spacing:-0.02em;
        background:linear-gradient(92deg, #fff, color-mix(in srgb, var(--c1) 60%, #fff));
        -webkit-background-clip:text; background-clip:text; color:transparent; }
      .bt-eyebrow{ font-size:11px; letter-spacing:0.18em; text-transform:uppercase;
        color:color-mix(in srgb, var(--c1) 70%, #fff); font-weight:700; }
      .bt-dot{ width:14px; height:14px; border-radius:50%; background:var(--c1);
        box-shadow:0 0 22px var(--c1); }

      .bt-card{ position:relative; z-index:1; border-radius:20px;
        background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.09);
        backdrop-filter:blur(8px); }

      .bt-cat{ position:relative; z-index:1; display:flex; align-items:center; gap:10px;
        margin:22px 4px 10px; font-family:Syne; font-weight:800; font-size:13px;
        text-transform:uppercase; letter-spacing:0.08em;
        color:color-mix(in srgb, var(--c2) 75%, #fff); }
      .bt-cat::after{ content:""; flex:1; height:1px;
        background:linear-gradient(90deg, color-mix(in srgb, var(--c2) 40%, transparent), transparent); }

      .bt-item{ position:relative; z-index:1; display:flex; align-items:center; gap:12px;
        margin-bottom:10px; padding:14px 15px; border-radius:16px;
        background:rgba(255,255,255,0.035); border:1px solid rgba(255,255,255,0.08);
        transition:transform .12s ease, border-color .15s ease; }
      .bt-item:active{ transform:scale(0.99); }
      .bt-item-on{ border-color:color-mix(in srgb, var(--c1) 55%, transparent);
        box-shadow:0 0 0 1px color-mix(in srgb, var(--c1) 35%, transparent), 0 8px 28px color-mix(in srgb, var(--c1) 18%, transparent); }
      .bt-price{ font-family:'Space Mono',monospace; font-size:13px; color:#fff; opacity:.6; margin-top:2px; }

      .bt-add{ border:0; border-radius:12px; padding:11px 16px; font-weight:700; font-size:13px;
        color:#fff; cursor:pointer; font-family:Syne;
        background:linear-gradient(180deg, color-mix(in srgb, var(--c2) 88%, #fff 0%), var(--c2));
        box-shadow:0 6px 20px color-mix(in srgb, var(--c2) 35%, transparent); }

      .bt-stepper{ display:flex; align-items:center; overflow:hidden; border-radius:12px;
        border:1px solid rgba(255,255,255,0.14); }
      .bt-stepper button{ width:38px; height:38px; border:0; cursor:pointer; font-size:20px;
        font-family:'Space Mono'; color:#fff; background:rgba(255,255,255,0.06); }
      .bt-stepper button:active{ background:var(--c1); }
      .bt-stepper span{ min-width:34px; text-align:center; font-family:'Space Mono'; font-weight:700; }

      .bt-bar{ position:fixed; left:0; right:0; bottom:0; z-index:20; padding:14px 0 calc(14px + env(safe-area-inset-bottom));
        background:linear-gradient(180deg, transparent, color-mix(in srgb, var(--bg) 92%, transparent) 30%);
        backdrop-filter:blur(10px); }
      .bt-total{ font-family:'Space Mono'; font-weight:700; font-size:22px; }
      .bt-pay{ flex:1; border:0; border-radius:16px; padding:16px; cursor:pointer;
        font-family:Syne; font-weight:800; font-size:16px; color:#fff;
        background:linear-gradient(100deg, var(--c1), var(--c2));
        box-shadow:0 10px 34px color-mix(in srgb, var(--c1) 45%, transparent);
        animation:btpulse 2.4s ease-in-out infinite; }
      @keyframes btpulse{ 50%{ box-shadow:0 10px 44px color-mix(in srgb, var(--c1) 65%, transparent); } }
      @media (prefers-reduced-motion: reduce){ .bt-pay{ animation:none; } }
    `}</style>
  );
}
