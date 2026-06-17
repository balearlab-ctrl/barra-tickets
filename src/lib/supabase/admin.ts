import { createClient } from "@supabase/supabase-js";

// Cliente con service_role: SOLO en el servidor (rutas API / server components).
// Ignora RLS. Nunca lo importes en componentes "use client".
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
