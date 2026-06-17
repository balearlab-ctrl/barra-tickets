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
  const audioRef = useRef<AudioContext | null>(null);

  type Servido = { codigo: string; items: Pedido["items"]; total_cent: number; hora: string };
  const [servidos, setServidos] = useState<Servido[]>([]);

  // --- sonido y vibración ---
  const initAudio = () => {
    try {
      if (!audioRef.current) {
        const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
        audioRef.current = new AC();
      }
      audioRef.current?.resume();
    } catch {}
  };
  const beep = (ok: boolean) => {
    const ctx = audioRef.current;
    if (!ctx) return;
    try {
      const t0 = ctx.currentTime;
      const notas = ok ? [880, 1320] : [200, 160];
      notas.forEach((f, idx) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = ok ? "sine" : "square";
        o.frequency.value = f;
        const start = t0 + idx * (ok ? 0.12 : 0.18);
        const dur = ok ? 0.12 : 0.22;
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(0.5, start + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
        o.connect(g);
        g.connect(ctx.destination);
        o.start(start);
        o.stop(start + dur + 0.02);
      });
    } catch {}
  };
  const feedback = (ok: boolean) => {
    beep(ok);
    try {
      (navigator as any).vibrate?.(ok ? 40 : [90, 50, 90]);
    } catch {}
  };

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
      if (d.resultado === "NO_ENCONTRADO") {
        setEstado({ tipo: "noexiste" });
        feedback(false);
      } else if (d.pedido.estado === "canjeado") {
        setEstado({ tipo: "ya", cuando: d.pedido.canjeado_en });
        feedback(false);
      } else if (d.pedido.estado !== "pagado") {
        setEstado({ tipo: "nopagado" });
        feedback(false);
      } else {
        setEstado({ tipo: "valido", pedido: d.pedido });
        feedback(true);
      }
    } catch {
      setEstado({ tipo: "error" });
      feedback(false);
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
      if (d.resultado === "CANJEADO") {
        setEstado({ tipo: "canjeado", pedido: d.pedido });
        setServidos((prev) => [
          {
            codigo: d.pedido.codigo,
            items: d.pedido.items,
            total_cent: d.pedido.total_cent,
            hora: new Date().toLocaleTimeString("es-ES", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          },
          ...prev,
        ]);
        feedback(true);
      } else if (d.resultado === "YA_CANJEADO") {
        setEstado({ tipo: "ya" });
        feedback(false);
      } else {
        setEstado({ tipo: "error" });
        feedback(false);
      }
    } catch {
      setEstado({ tipo: "error" });
      feedback(false);
    } finally {
      setCargando(false);
    }
  };

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
            setEscaneando(false);
            consultar(code);
          },
          () => {}
        );
      } catch {
        if (activo) {
          setCamError(
            "No se pudo abrir la cámara. Revisa los permisos o escribe el código a mano."
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

  const empezarEscaneo = () => {
    initAudio();
    setEstado({ tipo: "idle" });
    setCodigo("");
    setEscaneando(true);
  };
  const cerrarResultado = () => setEstado({ tipo: "idle" });

  // ---------- PANTALLA DE RESULTADO (a pantalla completa) ----------
  const esError =
    estado.tipo === "noexiste" ||
    estado.tipo === "nopagado" ||
    estado.tipo === "ya" ||
    estado.tipo === "error";

  if (estado.tipo === "valido") {
    return (
      <Overlay color="ok">
        <div className="text-[90px] leading-none">✓</div>
        <div className="mt-1 font-display text-3xl font-extrabold">VÁLIDO</div>
        <div className="mt-5 w-full max-w-xs rounded-2xl bg-black/25 p-4 text-left">
          <div className="mb-2 text-center font-mono text-3xl font-bold tracking-[0.12em]">
            {estado.pedido.codigo}
          </div>
          {estado.pedido.items.map((i, idx) => (
            <div key={idx} className="py-0.5 text-lg">
              {i.qty}× <b>{i.nombre}</b>
            </div>
          ))}
          <div className="mt-2 flex justify-between border-t border-white/25 pt-2 text-lg">
            <b>Total</b>
            <b>{euros(estado.pedido.total_cent)}</b>
          </div>
        </div>
        <button
          onClick={() => canjear(estado.pedido.codigo)}
          disabled={cargando}
          className="mt-6 w-full max-w-xs rounded-2xl bg-white py-5 font-display text-xl font-extrabold text-emerald-700 disabled:opacity-60"
        >
          {cargando ? "…" : "SERVIR ✓"}
        </button>
        <button onClick={empezarEscaneo} className="mt-3 text-sm text-white/80 underline">
          Cancelar
        </button>
      </Overlay>
    );
  }

  if (estado.tipo === "canjeado") {
    return (
      <Overlay color="ok">
        <div className="text-[90px] leading-none">🍹</div>
        <div className="mt-1 font-display text-3xl font-extrabold">ENTREGADO</div>
        {estado.pedido && (
          <div className="mt-2 font-mono text-2xl font-bold tracking-[0.12em]">
            {estado.pedido.codigo}
          </div>
        )}
        <button
          onClick={empezarEscaneo}
          className="mt-8 w-full max-w-xs rounded-2xl bg-white py-5 font-display text-xl font-extrabold text-emerald-700"
        >
          SIGUIENTE CLIENTE
        </button>
      </Overlay>
    );
  }

  if (esError) {
    const titulo =
      estado.tipo === "ya"
        ? "YA CANJEADO"
        : estado.tipo === "nopagado"
        ? "SIN PAGAR"
        : estado.tipo === "noexiste"
        ? "NO VÁLIDO"
        : "ERROR";
    const detalle =
      estado.tipo === "ya"
        ? "Este pedido ya se sirvió."
        : estado.tipo === "nopagado"
        ? "El pago aún no está confirmado."
        : estado.tipo === "noexiste"
        ? "Este código no existe."
        : "Inténtalo de nuevo.";
    return (
      <Overlay color="bad">
        <div className="text-[90px] leading-none">✕</div>
        <div className="mt-1 font-display text-3xl font-extrabold">{titulo}</div>
        <div className="mt-2 max-w-xs text-center text-lg text-white/90">{detalle}</div>
        <button
          onClick={empezarEscaneo}
          className="mt-8 w-full max-w-xs rounded-2xl bg-white py-5 font-display text-xl font-extrabold text-rose-700"
        >
          ESCANEAR OTRO
        </button>
        <button onClick={cerrarResultado} className="mt-3 text-sm text-white/80 underline">
          Cerrar
        </button>
      </Overlay>
    );
  }

  // ---------- PANTALLA NORMAL (inicio / escaneando) ----------
  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <header className="mb-5 flex items-center gap-3">
        <span className="h-3 w-3 rounded-full bg-magenta shadow-[0_0_14px_#FF2D78]" />
        <h1 className="font-display text-xl font-extrabold">Validación en barra</h1>
      </header>

      <div className="rounded-2xl border border-line bg-panel p-5">
        {!escaneando ? (
          <button
            onClick={empezarEscaneo}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-violet py-5 font-display text-lg font-extrabold text-white"
          >
            📷 ESCANEAR QR
          </button>
        ) : (
          <div className="mb-4">
            <div id="qr-reader" className="overflow-hidden rounded-xl border border-line" />
            <button
              onClick={() => setEscaneando(false)}
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
      </div>

      {servidos.length > 0 && (
        <section className="mt-4 rounded-2xl border border-line bg-panel p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
              Servidos en este turno · {servidos.length}
            </p>
            <button
              onClick={() => setServidos([])}
              className="text-xs text-muted underline"
            >
              Vaciar
            </button>
          </div>
          {servidos.map((s, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 border-b border-line py-2.5 last:border-0"
            >
              <span className="font-mono text-sm font-bold text-gold">{s.codigo}</span>
              <span className="flex-1 truncate text-sm text-muted">
                {s.items.map((i) => `${i.qty}× ${i.nombre}`).join(" · ")}
              </span>
              <span className="font-mono text-xs text-muted">{s.hora}</span>
            </div>
          ))}
        </section>
      )}

      <p className="mt-4 text-xs text-muted">
        Pulsa “Escanear QR” y enfoca el código del cliente; se validará solo. Si falla la
        cámara, escribe el código a mano.
      </p>
    </main>
  );
}

function Overlay({ color, children }: { color: "ok" | "bad"; children: React.ReactNode }) {
  const bg =
    color === "ok"
      ? "linear-gradient(160deg, #10b981, #047857)"
      : "linear-gradient(160deg, #f43f5e, #be123c)";
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 text-center text-white"
      style={{ background: bg, animation: "flashin .28s ease-out" }}
    >
      {children}
      <style>{`@keyframes flashin{0%{opacity:0;transform:scale(.92)}60%{opacity:1}100%{transform:scale(1)}}`}</style>
    </div>
  );
}
