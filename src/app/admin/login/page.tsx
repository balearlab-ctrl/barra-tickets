"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="px-5 py-16 text-center text-muted">Cargando…</main>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/admin";
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [logo, setLogo] = useState<string | null>(null);
  const [evento, setEvento] = useState<string>("");

  useEffect(() => {
    supabase
      .from("config")
      .select("evento_nombre, logo_url")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setLogo((data as any).logo_url ?? null);
          setEvento((data as any).evento_nombre ?? "");
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const entrar = async () => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError("Email o contraseña incorrectos");
      return;
    }
    router.push(next);
    router.refresh();
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-5">
      <div className="mb-7 flex flex-col items-center text-center">
        {logo ? (
          <img
            src={logo}
            alt={evento || "Logo"}
            className="mb-3 max-h-52 w-auto object-contain drop-shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
          />
        ) : (
          <span className="mb-3 h-3 w-3 rounded-full bg-magenta shadow-[0_0_14px_#FF2D78]" />
        )}
        <h1 className="mt-1 text-sm font-semibold text-muted">Acceso del personal</h1>
      </div>

      <div className="rounded-2xl border border-line bg-panel p-5">
        <label className="mb-1 block text-xs font-semibold text-muted">Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          className="mb-3 w-full rounded-lg border border-line bg-ink px-3 py-2.5 outline-none focus:border-violet"
        />
        <label className="mb-1 block text-xs font-semibold text-muted">Contraseña</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          onKeyDown={(e) => e.key === "Enter" && entrar()}
          className="mb-4 w-full rounded-lg border border-line bg-ink px-3 py-2.5 outline-none focus:border-violet"
        />
        {error && <p className="mb-3 text-sm text-bad">{error}</p>}
        <button
          onClick={entrar}
          disabled={loading}
          className="w-full rounded-lg bg-violet py-3 font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </div>
      <p className="mt-4 text-center text-xs text-muted">
        Crea usuarios del personal en Supabase → Authentication → Users.
      </p>
    </main>
  );
}
