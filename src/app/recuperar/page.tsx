"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { euros, type PedidoItem } from "@/lib/types";

type LogItem = { cantidad: number; creado_en: string };
type Ped = {
  codigo: string;
  items: PedidoItem[];
  total_cent: number;
  estado: string;
  creado_en: string;
  consumiciones_total: number | null;
  consumiciones_restantes: number | null;
  historial: LogItem[];
};

const hora = (s: string) =>
  new Date(s).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
const fecha = (s: string) =>
  new Date(s).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });

export default function RecuperarPage() {
  const [movil, setMovil] = useState("");
  const [pin, setPin] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pedidos, setPedidos] = useState<Ped[] | null>(null);
  const [hayBonos, setHayBonos] = useState(false);
  const [bonosMostrados, setBonosMostrados] = useState(0);
  const [necesitaNuevaClave, setNecesitaNuevaClave] = useState(false);
  const [nueva1, setNueva1] = useState("");
  const [nueva2, setNueva2] = useState("");
  const [errNueva, setErrNueva] = useState<string | null>(null);
  const [guardandoClave, setGuardandoClave] = useState(false);

  // Solicitud de factura
  const [verFactura, setVerFactura] = useState(false);
  const [fact, setFact] = useState({
    nombre: "",
    nif: "",
    direccion: "",
    cp: "",
    poblacion: "",
    email: "",
  });
  const [enviandoFact, setEnviandoFact] = useState(false);
  const [factMsg, setFactMsg] = useState<string | null>(null);
  const [factErr, setFactErr] = useState<string | null>(null);

  const enviarFactura = async () => {
    setFactErr(null);
    if (!fact.nombre.trim()) return setFactErr("Pon tu nombre o razón social.");
    if (!fact.nif.trim()) return setFactErr("Pon tu NIF/CIF.");
    if (!/.+@.+\..+/.test(fact.email)) return setFactErr("Pon un email válido.");
    setEnviandoFact(true);
    try {
      const r = await fetch("/api/factura", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movil, ...fact }),
      });
      const d = await r.json();
      if (d.ok) {
        setFactMsg("✓ Solicitud recibida. Te enviaremos la factura a tu correo.");
        setVerFactura(false);
      } else setFactErr(d.error || "No se pudo enviar.");
    } catch {
      setFactErr("Error de conexión.");
    } finally {
      setEnviandoFact(false);
    }
  };

  const buscar = async (pinArg?: string) => {
    setError(null);
    setCargando(true);
    const usarPin = pinArg ?? pin;
    try {
      const r = await fetch("/api/recuperar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movil, pin: usarPin }),
      });
      const d = await r.json();
      if (d.resultado === "OK") {
        setPedidos(d.pedidos);
        setHayBonos(!!d.hayBonos);
        setBonosMostrados(d.bonosMostrados || 0);
        setNecesitaNuevaClave(!!d.necesitaNuevaClave);
        if (d.claveIncorrecta && d.minutos)
          setError(`Demasiados intentos. Prueba en ${d.minutos} min.`);
        else if (d.claveIncorrecta) setError("Clave incorrecta para tu bono.");
      } else if (d.resultado === "SIN_PEDIDOS")
        setError("No tienes pedidos comprados con este móvil todavía.");
      else setError("No se pudo comprobar. Inténtalo de nuevo.");
    } catch {
      setError("Error de conexión.");
    } finally {
      setCargando(false);
    }
  };

  const crearClave = async () => {
    setErrNueva(null);
    if (!/^\d{4}$/.test(nueva1)) {
      setErrNueva("La clave debe tener 4 cifras.");
      return;
    }
    if (nueva1 !== nueva2) {
      setErrNueva("Las dos claves no coinciden.");
      return;
    }
    setGuardandoClave(true);
    try {
      const r = await fetch("/api/fijar-clave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movil, pin: nueva1 }),
      });
      const d = await r.json();
      if (d.ok) {
        setPin(nueva1);
        setNecesitaNuevaClave(false);
        setNueva1("");
        setNueva2("");
        await buscar(nueva1);
      } else setErrNueva(d.error || "No se pudo guardar.");
    } catch {
      setErrNueva("Error de conexión.");
    } finally {
      setGuardandoClave(false);
    }
  };

  const activos = (pedidos || []).filter((p) => p.estado !== "canjeado");
  const consumidos = (pedidos || []).filter((p) => p.estado === "canjeado");

  return (
    <main className="mx-auto max-w-sm px-5 py-10">
      <h1 className="font-display text-2xl font-extrabold">Mis pedidos</h1>
      <p className="mt-1 text-sm text-muted">
        Entra con tu móvil. Si tienes un bono, añade tu clave de 4 cifras.
      </p>

      <div className="mt-5 rounded-2xl border border-line bg-panel p-5">
        <label className="mb-1 block text-xs font-semibold text-muted">Móvil</label>
        <input
          value={movil}
          onChange={(e) => setMovil(e.target.value)}
          inputMode="tel"
          placeholder="600 00 00 00"
          className="mb-3 w-full rounded-lg border border-line bg-ink px-3 py-2.5 outline-none focus:border-violet"
        />
        <label className="mb-1 block text-xs font-semibold text-muted">
          Clave (solo si tienes un bono)
        </label>
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
          onClick={() => buscar()}
          disabled={cargando}
          className="w-full rounded-lg bg-violet py-3 font-semibold text-white disabled:opacity-50"
        >
          {cargando ? "Buscando…" : "Ver mis pedidos"}
        </button>
      </div>

      {pedidos && necesitaNuevaClave && (
        <div className="mt-4 rounded-2xl border border-gold/40 bg-gold/10 p-4">
          <p className="text-center text-sm font-semibold text-gold">
            🎟️ Tu bono no tiene clave. Crea una nueva para desbloquearlo.
          </p>
          <div className="mt-3 flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-semibold text-muted">Clave (4 cifras)</label>
              <input
                value={nueva1}
                onChange={(e) => setNueva1(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
                inputMode="numeric"
                placeholder="••••"
                className="w-full rounded-lg border border-line bg-ink px-3 py-2.5 text-center font-mono text-lg tracking-[0.3em] outline-none focus:border-violet"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-semibold text-muted">Repite la clave</label>
              <input
                value={nueva2}
                onChange={(e) => setNueva2(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
                inputMode="numeric"
                placeholder="••••"
                className="w-full rounded-lg border border-line bg-ink px-3 py-2.5 text-center font-mono text-lg tracking-[0.3em] outline-none focus:border-violet"
              />
            </div>
          </div>
          {errNueva && <p className="mt-2 text-sm text-bad">{errNueva}</p>}
          <button
            onClick={crearClave}
            disabled={guardandoClave}
            className="mt-3 w-full rounded-lg bg-violet py-3 font-semibold text-white disabled:opacity-50"
          >
            {guardandoClave ? "Guardando…" : "Guardar clave y ver mi bono"}
          </button>
        </div>
      )}

      {pedidos && !necesitaNuevaClave && hayBonos && bonosMostrados === 0 && (
        <p className="mt-4 rounded-xl border border-gold/40 bg-gold/10 p-3 text-center text-sm text-gold">
          🎟️ Tienes un bono protegido. Escribe tu clave de 4 cifras arriba para verlo.
        </p>
      )}

      {pedidos && (
        <div className="mt-5">
          {activos.length > 0 && (
            <>
              <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-muted">
                Disponibles
              </p>
              <div className="space-y-4">
                {activos.map((p) => (
                  <div key={p.codigo} className="rounded-2xl border border-line bg-panel p-4 text-center">
                    <div className="inline-block rounded-2xl bg-white p-3">
                      <QRCodeSVG value={`TICKET:${p.codigo}`} size={150} level="M" />
                    </div>
                    <div className="mt-3 font-mono text-2xl font-bold tracking-[0.12em] text-gold">
                      {p.codigo}
                    </div>
                    {p.consumiciones_total != null ? (
                      <div className="mt-2 inline-block rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-sm font-bold text-gold">
                        🎟️ Quedan {p.consumiciones_restantes} de {p.consumiciones_total}
                      </div>
                    ) : (
                      <div className="mt-2 text-sm text-muted">
                        {p.items.map((i) => `${i.qty}× ${i.nombre}`).join(" · ")}
                      </div>
                    )}
                    {p.historial.length > 0 && (
                      <div className="mt-3 border-t border-line pt-2 text-left text-xs text-muted">
                        {p.historial.map((h, idx) => (
                          <div key={idx} className="flex justify-between py-0.5">
                            <span>Serviste {h.cantidad}</span>
                            <span>{hora(h.creado_en)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {consumidos.length > 0 && (
            <>
              <p className="mb-2 mt-7 text-[11px] uppercase tracking-[0.16em] text-muted">
                Ya consumidos
              </p>
              <div className="space-y-3">
                {consumidos.map((p) => (
                  <div key={p.codigo} className="rounded-2xl border border-line bg-panel/60 p-4 opacity-70">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-lg font-bold text-muted line-through">
                        {p.codigo}
                      </span>
                      <span className="text-xs text-muted">{fecha(p.creado_en)}</span>
                    </div>
                    <div className="mt-1 text-sm text-muted line-through">
                      {p.consumiciones_total != null
                        ? `🎟️ Bonocopa ×${p.consumiciones_total}`
                        : p.items.map((i) => `${i.qty}× ${i.nombre}`).join(" · ")}
                    </div>
                    {p.historial.length > 0 ? (
                      <div className="mt-2 border-t border-line pt-2 text-xs text-muted">
                        {p.historial.map((h, idx) => (
                          <div key={idx} className="flex justify-between py-0.5">
                            <span>Consumiste {h.cantidad}</span>
                            <span>
                              {fecha(h.creado_en)} · {hora(h.creado_en)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-1 text-xs text-muted">Entregado</div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Solicitar factura (escondido abajo) */}
          <div className="mt-8 border-t border-line pt-4">
            {factMsg ? (
              <p className="text-center text-sm text-good">{factMsg}</p>
            ) : !verFactura ? (
              <button
                onClick={() => setVerFactura(true)}
                className="w-full text-center text-sm text-muted underline"
              >
                ¿Necesitas factura de tus consumos?
              </button>
            ) : (
              <div className="rounded-2xl border border-line bg-panel p-4">
                <p className="mb-1 text-sm font-semibold">Solicitar factura</p>
                <p className="mb-3 text-xs text-muted">
                  Déjanos tus datos fiscales y te la enviaremos a tu correo.
                </p>
                <input
                  value={fact.nombre}
                  onChange={(e) => setFact({ ...fact, nombre: e.target.value })}
                  placeholder="Nombre o razón social"
                  className="mb-2 w-full rounded-lg border border-line bg-ink px-3 py-2.5 outline-none focus:border-violet"
                />
                <input
                  value={fact.nif}
                  onChange={(e) => setFact({ ...fact, nif: e.target.value })}
                  placeholder="NIF / CIF"
                  className="mb-2 w-full rounded-lg border border-line bg-ink px-3 py-2.5 outline-none focus:border-violet"
                />
                <input
                  value={fact.direccion}
                  onChange={(e) => setFact({ ...fact, direccion: e.target.value })}
                  placeholder="Dirección"
                  className="mb-2 w-full rounded-lg border border-line bg-ink px-3 py-2.5 outline-none focus:border-violet"
                />
                <div className="mb-2 flex gap-2">
                  <input
                    value={fact.cp}
                    onChange={(e) => setFact({ ...fact, cp: e.target.value })}
                    placeholder="C.P."
                    inputMode="numeric"
                    className="w-1/3 rounded-lg border border-line bg-ink px-3 py-2.5 outline-none focus:border-violet"
                  />
                  <input
                    value={fact.poblacion}
                    onChange={(e) => setFact({ ...fact, poblacion: e.target.value })}
                    placeholder="Población"
                    className="w-2/3 rounded-lg border border-line bg-ink px-3 py-2.5 outline-none focus:border-violet"
                  />
                </div>
                <input
                  value={fact.email}
                  onChange={(e) => setFact({ ...fact, email: e.target.value })}
                  placeholder="Email donde enviarla"
                  inputMode="email"
                  className="mb-3 w-full rounded-lg border border-line bg-ink px-3 py-2.5 outline-none focus:border-violet"
                />
                {factErr && <p className="mb-2 text-sm text-bad">{factErr}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={() => setVerFactura(false)}
                    className="flex-1 rounded-lg border border-line py-2.5 text-sm font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={enviarFactura}
                    disabled={enviandoFact}
                    className="flex-1 rounded-lg bg-violet py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {enviandoFact ? "Enviando…" : "Solicitar factura"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
