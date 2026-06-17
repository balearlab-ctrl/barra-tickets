"use client";

import { useEffect, useRef, useState } from "react";
import { euros, type Pedido } from "@/lib/types";

type Estado =
  | { tipo: "idle" }
  | { tipo: "valido"; pedido: Pedido }
  | { tipo: "canjeado"; pedido: Pedido }
  | { tipo: "ya"; cuando?: string }
  | { tipo: "nopagado" }
  | { tipo: "noexiste" }
  | { tipo: "error" };

// Extrae el código de lo que contiene el QR (formato "TICKET:AB-CD").
function extraerCodigo(texto: string): string {
  const t = texto.trim();
  const i = t.indexOf(":");
  return (i >= 0 ? t.slice(i + 1) : t).trim().toUpperCase();
}

export default function BarraClient() {
  const [codigo, setCodigo] = useState("");
  const [estado, setEstado] = useState<Estado>({ tipo: "idle" });
  const [cargando, setCargando] = useState(false);
  const [escaneando, setEscaneando] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const scannerRef = useRef<any>(null);

  const consultar = async (code: string) => {
    const c = code.trim().toUpperCase();
    if (!c) return;
    setCargando(true);
    setEstado({ tipo: "idle" });
    try {
      const r = await fetch("/api/validar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo: c, soloConsultar: true }),
      });
      const d = await r.json();
      if (d.resultado === "NO_ENCONTRADO") setEstado({ tipo: "noexiste" });
      else if (d.pedido.estado === "canjeado")
        setEstado({ tipo: "ya", cuando: d.pedido.canjeado_en });
      else if (d.pedido.estado !== "pagado") setEstado({ tipo: "nopagado" });
      else setEstado({ tipo: "valido", pedido: d.pedido });
    } catch {
      setEstado({ tipo: "error" });
    } finally {
      setCargando(false);
    }
  };

  const canjear = async (code: string) => {
    setCargando(true);
    try {
      const r = await fetch("/api/validar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo: code }),
      });
      const d = await r.json();
      if (d.resultado === "CANJEADO") setEstado({ tipo: "canjeado", pedido: d.pedido });
      else if (d.resultado === "YA_CANJEADO") setEstado({ tipo: "ya" });
      else setEstado({ tipo: "error" });
    } catch {
      setEstado({ tipo: "error" });
    } finally {
      setCargando(false);
    }
  };

  // Arranca / detiene la cámara cuando se activa el escaneo.
  useEffect(() => {
    if (!escaneando) return;
    let activo = true;
    setCamError(null);

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (!activo) return;
        const scanner = new Html5Qrcode("qr-reader", { verbose: false } as any);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 230, height: 230 } },
          (texto: string) => {
            const code = extraerCodigo(texto);
            setCodigo(code);
            pararEscaner();
            consultar(code);
          },
          () => {}
        );
      } catch (e: any) {
        if (activo) {
          setCamError(
            "No se pudo abrir la cámara. Revisa los permisos del navegador o escribe el código a mano."
          );
          setEscaneando(false);
        }
      }
    })();

    return () => {
      activo = false;
      const s = scannerRef.current;
      if (s) {
        s.stop().then(() => s.clear()).catch(() => {});
        scannerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escaneando]);

  const pararEscaner = () => setEscaneando(false);

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <header className="mb-5 flex items-center gap-3">
        <span className="h-3 w-3 rounded-full bg-magenta shadow-[0_0_14px_#FF2D78]" />
        <h1 className="font-display text-xl font-extrabold">Validación en barra</h1>
      </header>

      <div className="rounded-2xl border border-line bg-panel p-5">
        {/* Escáner de QR */}
        {!escaneando ? (
          <button
            onClick={() => {
              setEstado({ tipo: "idle" });
              setEscaneando(true);
            }}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-violet py-3.5 font-semibold text-white"
          >
            📷 Escanear QR
          </button>
        ) : (
          <div className="mb-4">
            <div
              id="qr-reader"
              className="overflow-hidden rounded-xl border border-line"
            />
            <button
              onClick={pararEscaner}
              className="mt-2 w-full rounded-lg border border-line py-2.5 text-sm font-semibold"
            >
              Cancelar escaneo
            </button>
          </div>
        )}

        {camError && <p className="mb-3 text-sm text-bad">{camError}</p>}

        <label className="mb-1 block text-xs font-semibold text-muted">
          …o introduce el código a mano
        </label>
        <div className="flex gap-2">
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && consultar(codigo)}
            placeholder="AB-CD"
            className="w-full rounded-lg border border-line bg-ink px-3 py-2.5 font-mono font-bold tracking-[0.1em] outline-none focus:border-violet"
          />
          <button
            onClick={() => consultar(codigo)}
            disabled={cargando}
            className="rounded-lg bg-violet px-4 font-semibold text-white disabled:opacity-50"
          >
            Comprobar
          </button>
        </div>

        <div className="mt-4">
          {estado.tipo === "noexiste" && (
            <Aviso tipo="bad" titulo="✕ Código no encontrado">
              Revisa el código o pide al cliente que muestre su ticket.
            </Aviso>
          )}
          {estado.tipo === "nopagado" && (
            <Aviso tipo="bad" titulo="⚠ Pago no confirmado">
              Este pedido aún no está pagado. Espera unos segundos y reintenta.
            </Aviso>
          )}
          {estado.tipo === "ya" && (
            <Aviso tipo="bad" titulo="⚠ Ya canjeado">
              Este pedido ya se sirvió
              {estado.cuando ? ` (${new Date(estado.cuando).toLocaleString("es-ES")})` : ""}.
            </Aviso>
          )}
          {estado.tipo === "error" && (
            <Aviso tipo="bad" titulo="Error">Inténtalo de nuevo.</Aviso>
          )}

          {estado.tipo === "valido" && (
            <div>
              <Aviso tipo="ok" titulo="✓ Válido · pagado" />
              <div className="mt-3 rounded-2xl border border-line bg-panel2 p-4">
                <div className="mb-2 text-center font-mono text-2xl font-bold tracking-[0.1em] text-gold">
                  {estado.pedido.codigo}
                </div>
                {estado.pedido.items.map((i, idx) => (
                  <div key={idx} className="py-1 text-sm">
                    {i.qty}× <b>{i.nombre}</b>
                  </div>
                ))}
                <div className="mt-2 flex justify-between border-t border-line pt-2 text-sm">
                  <b>Total</b>
                  <b>{euros(estado.pedido.total_cent)}</b>
                </div>
              </div>
              <button
                onClick={() => canjear(estado.pedido.codigo)}
                disabled={cargando}
                className="mt-4 w-full rounded-xl bg-violet py-3.5 font-semibold text-white disabled:opacity-50"
              >
                Servir y marcar entregado
              </button>
            </div>
          )}

          {estado.tipo === "canjeado" && (
            <Aviso tipo="ok" titulo="✓ Entregado">
              Pedido {estado.pedido.codigo} servido. ¡Que aproveche!
            </Aviso>
          )}
        </div>
      </div>

      <p className="mt-4 text-xs text-muted">
        Pulsa “Escanear QR” y enfoca el código del cliente; se validará solo. Si
        falla la cámara, escribe el código a mano.
      </p>
    </main>
  );
}

function Aviso({
  tipo,
  titulo,
  children,
}: {
  tipo: "ok" | "bad";
  titulo: string;
  children?: React.ReactNode;
}) {
  const cls =
    tipo === "ok"
      ? "border-ok/30 bg-ok/10 text-ok"
      : "border-bad/30 bg-bad/10 text-bad";
  return (
    <div className={`rounded-xl border p-3 ${cls}`}>
      <div className="font-bold">{titulo}</div>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  );
}
