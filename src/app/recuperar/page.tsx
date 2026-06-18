"use client";

import { useState } from "react";
import { euros, type PedidoItem } from "@/lib/types";

type Ped = {
  codigo: string;
  items: PedidoItem[];
  total_cent: number;
  estado: string;
  creado_en: string;
  consumiciones_total: number | null;
  consumiciones_restantes: number | null;
};

export default function RecuperarPage() {
  const [movil, setMovil] = useState("");
  const [pin, setPin] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pedidos, setPedidos] = useState<Ped[] | null>(null);

  const buscar = async () => {
    setError(null);
    setCargando(true);
    try {
      const r = await fetch("/api/recuperar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movil, pin }),
      });
      const d = await r.json();
      if (d.resultado === "OK") setPedidos(d.pedidos);
      else if (d.resultado === "BLOQUEADO")
        setError(`Demasiados intentos. Prueba de nuevo en ${d.minutos} min.`);
      else if (d.resultado === "INCORRECTO")
        setError("Móvil o clave incorrectos.");
      else setError("No se pudo comprobar. Inténtalo de nuevo.");
    } catch {
      setError("Error de conexión.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <main className="mx-auto max-w-sm px-5 py-10">
      <h1 className="font-display text-2xl font-extrabold">Recuperar mi pedido</h1>
      <p className="mt-1 text-sm text-muted">
        Entra con el móvil y la clave de 4 cifras que pusiste al pagar.
      </p>

      {!pedidos && (
        <div className="mt-5 rounded-2xl border border-line bg-panel p-5">
          <label className="mb-1 block text-xs font-semibold text-muted">Móvil</label>
          <input
            value={movil}
            onChange={(e) => setMovil(e.target.value)}
            inputMode="tel"
            placeholder="600 00 00 00"
            className="mb-3 w-full rounded-lg border border-line bg-ink px-3 py-2.5 outline-none focus:border-violet"
          />
          <label className="mb-1 block text-xs font-semibold text-muted">Clave (4 cifras)</label>
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
            inputMode="numeric"
            placeholder="••••"
            onKeyDown={(e) => e.key === "Enter" && buscar()}
            className="mb-4 w-full rounded-lg border border-line bg-ink px-3 py-2.5 font-mono text-lg tracking-[0.3em] outline-none focus:border-violet"
          />
          {error && <p className="mb-3 text-sm text-bad">{error}</p>}
          <button
            onClick={buscar}
            disabled={cargando}
            className="w-full rounded-lg bg-violet py-3 font-semibold text-white disabled:opacity-50"
          >
            {cargando ? "Buscando…" : "Buscar mi pedido"}
          </button>
        </div>
      )}

      {pedidos && pedidos.length === 0 && (
        <p className="mt-6 text-center text-muted">No hay pedidos con esos datos.</p>
      )}

      {pedidos && pedidos.length > 0 && (
        <div className="mt-5 space-y-3">
          {pedidos.map((p) => (
            <a
              key={p.codigo}
              href={`/pedido/${p.codigo}`}
              className="block rounded-2xl border border-line bg-panel p-4"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xl font-bold text-gold">{p.codigo}</span>
                <span className="text-xs text-muted">
                  {new Date(p.creado_en).toLocaleString("es-ES")}
                </span>
              </div>
              {p.consumiciones_total != null ? (
                <div className="mt-1 text-sm">
                  🎟️ Bonocopa ·{" "}
                  {p.estado === "canjeado"
                    ? "agotado"
                    : `quedan ${p.consumiciones_restantes} de ${p.consumiciones_total}`}
                </div>
              ) : (
                <div className="mt-1 text-sm text-muted">
                  {p.items.map((i) => `${i.qty}× ${i.nombre}`).join(" · ")}
                </div>
              )}
              <div className="mt-1 text-xs text-violet">Ver mi QR →</div>
            </a>
          ))}
        </div>
      )}
    </main>
  );
}
