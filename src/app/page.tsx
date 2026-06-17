import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-xl px-5 py-10">
      <div className="mb-8 flex items-center gap-3">
        <span className="h-3 w-3 rounded-full bg-magenta shadow-[0_0_14px_#FF2D78]" />
        <div>
          <h1 className="font-display text-xl font-extrabold tracking-tight">Sala Vértigo · Barra</h1>
          <p className="text-sm text-muted">Pedidos de barra con pago y QR</p>
        </div>
      </div>

      <p className="mb-6 text-sm text-muted">
        El QR de cada mesa apunta a la carta con su número, por ejemplo{" "}
        <code className="font-mono text-violet">/carta?mesa=12</code>.
      </p>

      <div className="grid gap-3">
        <Link href="/carta?mesa=demo" className="rounded-2xl border border-line bg-panel p-5 transition hover:border-violet">
          <div className="font-display text-lg font-bold">🍹 Carta del cliente</div>
          <div className="text-sm text-muted">Lo que ve quien escanea el QR</div>
        </Link>
        <Link href="/admin" className="rounded-2xl border border-line bg-panel p-5 transition hover:border-violet">
          <div className="font-display text-lg font-bold">⚙️ Panel de control</div>
          <div className="text-sm text-muted">Productos, precios y ventas (requiere login)</div>
        </Link>
        <Link href="/barra" className="rounded-2xl border border-line bg-panel p-5 transition hover:border-violet">
          <div className="font-display text-lg font-bold">✅ Validación en barra</div>
          <div className="text-sm text-muted">Comprobar y servir códigos (requiere login)</div>
        </Link>
      </div>
    </main>
  );
}
