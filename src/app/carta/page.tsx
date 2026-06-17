import { createClient } from "@/lib/supabase/server";
import CartaClient from "./CartaClient";
import type { Producto, Config } from "@/lib/types";
import { CONFIG_DEFECTO } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CartaPage() {
  const supabase = createClient();

  const [{ data: productos }, { data: config }] = await Promise.all([
    supabase
      .from("productos")
      .select("*")
      .eq("activo", true)
      .order("orden", { ascending: true }),
    supabase.from("config").select("*").eq("id", 1).maybeSingle(),
  ]);

  return (
    <CartaClient
      productos={(productos as Producto[]) || []}
      config={(config as Config) || CONFIG_DEFECTO}
    />
  );
}
