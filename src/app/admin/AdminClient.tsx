"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Producto, Pedido, Config, euros, CONFIG_DEFECTO } from "@/lib/types";

const vacio = { nombre: "", categoria: "", precioStr: "", activo: true, esBono: false, consumiciones: "4" };

const VIBES: { nombre: string; c1: string; c2: string; bg: string }[] = [
  { nombre: "Neón rosa", c1: "#FF2D78", c2: "#7C5CFF", bg: "#0B0A0F" },
  { nombre: "Verde ácido", c1: "#B8FF3C", c2: "#15D6A0", bg: "#07120D" },
  { nombre: "Azul eléctrico", c1: "#2D9BFF", c2: "#7C5CFF", bg: "#070A14" },
  { nombre: "Fuego", c1: "#FF6A2D", c2: "#FFC53C", bg: "#140A07" },
  { nombre: "Chicle", c1: "#FF2D78", c2: "#FF8A3C", bg: "#120712" },
];

export default function AdminClient({ email }: { email: string }) {
  const supabase = createClient();
  const router = useRouter();

  const [productos, setProductos] = useState<Producto[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [config, setConfig] = useState<Config>(CONFIG_DEFECTO);
  const [guardandoMarca, setGuardandoMarca] = useState(false);
  const [marcaOk, setMarcaOk] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(vacio);
  const [mostrarForm, setMostrarForm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  const cargar = async () => {
    const { data: prods } = await supabase
      .from("productos")
      .select("*")
      .order("orden", { ascending: true });
    const { data: peds } = await supabase
      .from("pedidos")
      .select("*")
      .order("creado_en", { ascending: false })
      .limit(20);
    const { data: cfg } = await supabase
      .from("config")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    setProductos((prods as Producto[]) || []);
    setPedidos((peds as Pedido[]) || []);
    if (cfg) setConfig(cfg as Config);
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Marca ----
  const subirLogo = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // Reducir tamaño para no guardar imágenes enormes en la BD.
        const max = 360;
        const escala = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * escala);
        const h = Math.round(img.height * escala);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/png");
        setConfig((c) => ({ ...c, logo_url: dataUrl }));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const subirBanner = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // Foto del story: reducir a 1080 de lado mayor y comprimir en JPEG.
        const max = 1080;
        const escala = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * escala);
        const h = Math.round(img.height * escala);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
        setConfig((c) => ({ ...c, banner_url: dataUrl }));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const guardarMarca = async () => {
    setGuardandoMarca(true);
    setMarcaOk(false);
    await supabase
      .from("config")
      .update({
        evento_nombre: config.evento_nombre,
        subtitulo: config.subtitulo,
        logo_url: config.logo_url,
        banner_url: config.banner_url,
        color1: config.color1,
        color2: config.color2,
        fondo: config.fondo,
        actualizado_en: new Date().toISOString(),
      })
      .eq("id", 1);
    setGuardandoMarca(false);
    setMarcaOk(true);
    setTimeout(() => setMarcaOk(false), 2500);
  };

  // ---- Productos ----
  const abrirNuevo = () => {
    setEditId(null);
    setForm(vacio);
    setMostrarForm(true);
  };
  const abrirEditar = (p: Producto) => {
    setEditId(p.id);
    setForm({
      nombre: p.nombre,
      categoria: p.categoria,
      precioStr: (p.precio_cent / 100).toString(),
      activo: p.activo,
      esBono: (p.consumiciones ?? 1) > 1,
      consumiciones: String(p.consumiciones ?? 4),
    });
    setMostrarForm(true);
  };
  const guardar = async () => {
    const precio_cent = Math.round(
      parseFloat(form.precioStr.replace(",", ".")) * 100
    );
    if (!form.nombre.trim() || isNaN(precio_cent)) return;
    const cons = form.esBono ? Math.max(2, parseInt(form.consumiciones, 10) || 2) : 1;
    const fila = {
      nombre: form.nombre.trim(),
      categoria: form.categoria.trim() || "Otros",
      precio_cent,
      activo: form.activo,
      consumiciones: cons,
    };
    if (editId) await supabase.from("productos").update(fila).eq("id", editId);
    else await supabase.from("productos").insert(fila);
    setMostrarForm(false);
    cargar();
  };
  const toggle = async (p: Producto) => {
    await supabase.from("productos").update({ activo: !p.activo }).eq("id", p.id);
    cargar();
  };
  const borrar = async (p: Producto) => {
    if (!confirm(`¿Borrar "${p.nombre}"?`)) return;
    await supabase.from("productos").delete().eq("id", p.id);
    cargar();
  };

  const salir = async () => {
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  };

  const ingresos = pedidos
    .filter((p) => p.estado !== "pendiente" && p.estado !== "cancelado")
    .reduce((s, p) => s + p.total_cent, 0);
  const canjeados = pedidos.filter((p) => p.estado === "canjeado").length;
  const validos = pedidos.filter(
    (p) => p.estado === "pagado" || p.estado === "canjeado"
  ).length;

  if (mostrarForm) {
    return (
      <main className="mx-auto max-w-xl px-4 py-6">
        <div className="rounded-2xl border border-line bg-panel p-5">
          <p className="mb-3 text-[11px] uppercase tracking-[0.16em] text-muted">
            {editId ? "Editar producto" : "Nuevo producto"}
          </p>
          <Campo label="Nombre">
            <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="campo" placeholder="Combinado Premium" />
          </Campo>
          <Campo label="Categoría">
            <input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className="campo" placeholder="Copas" />
          </Campo>
          <Campo label="Precio (€)">
            <input value={form.precioStr} onChange={(e) => setForm({ ...form, precioStr: e.target.value })} inputMode="decimal" className="campo" placeholder="9" />
          </Campo>
          <label className="mb-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />
            Visible en la carta
          </label>

          <div className="mb-4 rounded-xl border border-line bg-panel2 p-3">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={form.esBono} onChange={(e) => setForm({ ...form, esBono: e.target.checked })} />
              🎟️ Es un bonocopa (varias consumiciones)
            </label>
            {form.esBono && (
              <div className="mt-3">
                <label className="mb-1 block text-xs font-semibold text-muted">Nº de consumiciones</label>
                <input
                  value={form.consumiciones}
                  onChange={(e) => setForm({ ...form, consumiciones: e.target.value.replace(/[^0-9]/g, "") })}
                  inputMode="numeric"
                  className="campo"
                  placeholder="4"
                />
                <p className="mt-2 text-xs text-muted">
                  El cliente paga una vez y el QR vale para estas consumiciones. Los bonocopas
                  se compran solos (un QR por bono).
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button onClick={() => setMostrarForm(false)} className="flex-1 rounded-lg border border-line py-3 font-semibold">Cancelar</button>
            <button onClick={guardar} className="flex-1 rounded-lg bg-violet py-3 font-semibold text-white">Guardar</button>
          </div>
        </div>
        <style>{`.campo{width:100%;background:#0B0A0F;border:1px solid #2A2733;border-radius:8px;padding:10px 12px;outline:none}.campo:focus{border-color:#7C5CFF}`}</style>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-extrabold">Panel de control</h1>
          <p className="text-xs text-muted">{email}</p>
        </div>
        <button onClick={salir} className="rounded-lg border border-line px-3 py-2 text-sm">Salir</button>
      </header>

      <div className="mb-4 grid grid-cols-3 gap-2">
        <Stat n={pedidos.length} k="Pedidos" />
        <Stat n={euros(ingresos)} k="Ingresos" />
        <Stat n={`${canjeados}/${validos}`} k="Canjeados" />
      </div>

      {/* ====== MARCA Y ASPECTO ====== */}
      <section className="mb-4 rounded-2xl border border-line bg-panel p-4">
        <p className="mb-3 text-[11px] uppercase tracking-[0.16em] text-muted">Marca y aspecto</p>

        {/* Vista previa */}
        <div
          className="mb-4 flex flex-col items-center justify-center overflow-hidden rounded-xl p-5"
          style={{
            backgroundColor: config.fondo,
            backgroundImage: `radial-gradient(60% 80% at 25% 0%, ${config.color1}55, transparent 70%), radial-gradient(60% 80% at 80% 0%, ${config.color2}55, transparent 70%)${
              config.banner_url
                ? `, linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.7)), url(${config.banner_url})`
                : ""
            }`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {config.logo_url ? (
            <img src={config.logo_url} alt="logo" className="mb-2 max-h-16 w-auto object-contain" />
          ) : (
            <span className="mb-2 h-3 w-3 rounded-full" style={{ background: config.color1, boxShadow: `0 0 16px ${config.color1}` }} />
          )}
          <div className="font-display text-lg font-extrabold text-white">{config.evento_nombre || "Tu evento"}</div>
          <div className="text-xs text-white/60">{config.subtitulo}</div>
        </div>

        <Campo label="Nombre del evento">
          <input value={config.evento_nombre} onChange={(e) => setConfig({ ...config, evento_nombre: e.target.value })} className="campo" placeholder="Fiesta Vértigo" />
        </Campo>
        <Campo label="Subtítulo">
          <input value={config.subtitulo} onChange={(e) => setConfig({ ...config, subtitulo: e.target.value })} className="campo" placeholder="Pide y recoge en barra" />
        </Campo>

        <label className="mb-1 block text-xs font-semibold text-muted">Logo (evento o promotora)</label>
        <div className="mb-3 flex gap-2">
          <button onClick={() => fileRef.current?.click()} className="rounded-lg border border-line px-3 py-2 text-sm">
            {config.logo_url ? "Cambiar logo" : "Subir logo"}
          </button>
          {config.logo_url && (
            <button onClick={() => setConfig({ ...config, logo_url: null })} className="rounded-lg border border-line px-3 py-2 text-sm text-bad">Quitar</button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && subirLogo(e.target.files[0])} />
        </div>

        <label className="mb-1 block text-xs font-semibold text-muted">Story de la fiesta (fondo)</label>
        <div className="mb-3 flex gap-2">
          <button onClick={() => bannerRef.current?.click()} className="rounded-lg border border-line px-3 py-2 text-sm">
            {config.banner_url ? "Cambiar story" : "Subir story"}
          </button>
          {config.banner_url && (
            <button onClick={() => setConfig({ ...config, banner_url: null })} className="rounded-lg border border-line px-3 py-2 text-sm text-bad">Quitar</button>
          )}
          <input ref={bannerRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && subirBanner(e.target.files[0])} />
        </div>

        <label className="mb-1 block text-xs font-semibold text-muted">Combinaciones rápidas</label>
        <div className="mb-3 flex flex-wrap gap-2">
          {VIBES.map((v) => (
            <button key={v.nombre} onClick={() => setConfig({ ...config, color1: v.c1, color2: v.c2, fondo: v.bg })}
              className="flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-xs">
              <span className="h-3 w-3 rounded-full" style={{ background: `linear-gradient(90deg, ${v.c1}, ${v.c2})` }} />
              {v.nombre}
            </button>
          ))}
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2">
          <ColorPick label="Acento 1" value={config.color1} onChange={(v) => setConfig({ ...config, color1: v })} />
          <ColorPick label="Acento 2" value={config.color2} onChange={(v) => setConfig({ ...config, color2: v })} />
          <ColorPick label="Fondo" value={config.fondo} onChange={(v) => setConfig({ ...config, fondo: v })} />
        </div>

        <button onClick={guardarMarca} disabled={guardandoMarca}
          className="w-full rounded-lg bg-violet py-3 font-semibold text-white disabled:opacity-50">
          {guardandoMarca ? "Guardando…" : marcaOk ? "✓ Guardado" : "Guardar marca"}
        </button>
        <style>{`.campo{width:100%;background:#0B0A0F;border:1px solid #2A2733;border-radius:8px;padding:10px 12px;outline:none}.campo:focus{border-color:#7C5CFF}`}</style>
      </section>

      {/* ====== CATÁLOGO ====== */}
      <section className="mb-4 rounded-2xl border border-line bg-panel p-4">
        <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-muted">Catálogo · precios</p>
        {productos.map((p) => (
          <div key={p.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 border-b border-line py-3 last:border-0">
            <div>
              <div className="font-semibold">
                {p.nombre}
                {(p.consumiciones ?? 1) > 1 && (
                  <span className="ml-2 rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] font-bold uppercase text-gold">
                    Bono ×{p.consumiciones}
                  </span>
                )}
              </div>
              <div className="text-xs text-muted">{p.categoria} · <span className={p.activo ? "" : "text-bad"}>{p.activo ? "visible" : "oculto"}</span></div>
            </div>
            <div className="font-mono font-bold">{euros(p.precio_cent)}</div>
            <div className="flex gap-1.5">
              <button onClick={() => abrirEditar(p)} className="icon">✏️</button>
              <button onClick={() => toggle(p)} className="icon">{p.activo ? "👁️" : "🚫"}</button>
              <button onClick={() => borrar(p)} className="icon">🗑️</button>
            </div>
          </div>
        ))}
        <button onClick={abrirNuevo} className="mt-4 w-full rounded-lg bg-violet py-3 font-semibold text-white">+ Añadir producto</button>
      </section>

      {/* ====== PEDIDOS ====== */}
      <section className="rounded-2xl border border-line bg-panel p-4">
        <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-muted">Últimos pedidos</p>
        {pedidos.length === 0 && <p className="py-6 text-center text-muted">Aún no hay pedidos.</p>}
        {pedidos.map((p) => (
          <div key={p.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 border-b border-line py-3 last:border-0">
            <div>
              <div className="font-mono font-bold">{p.codigo}</div>
              <div className="text-xs text-muted">{p.items.reduce((a, i) => a + i.qty, 0)} prod · {p.metodo || "—"}</div>
            </div>
            <div className="font-mono font-bold">{euros(p.total_cent)}</div>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${p.estado === "canjeado" ? "border-bad/30 text-bad" : "border-line text-muted"}`}>{p.estado}</span>
          </div>
        ))}
      </section>

      <style>{`.icon{border:1px solid #2A2733;background:transparent;width:34px;height:34px;border-radius:9px;cursor:pointer}`}</style>
    </main>
  );
}

function Stat({ n, k }: { n: string | number; k: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel2 p-3">
      <div className="font-mono text-xl font-bold">{n}</div>
      <div className="mt-0.5 text-[11px] uppercase tracking-[0.08em] text-muted">{k}</div>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-xs font-semibold text-muted">{label}</label>
      {children}
    </div>
  );
}

function ColorPick({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-muted">{label}</label>
      <div className="flex items-center gap-2 rounded-lg border border-line bg-ink p-1.5">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent p-0" />
        <span className="font-mono text-xs uppercase text-muted">{value}</span>
      </div>
    </div>
  );
}
