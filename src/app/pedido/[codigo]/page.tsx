import Ticket from "./Ticket";
import { createClient } from "@/lib/supabase/server";
import type { Config } from "@/lib/types";
import { CONFIG_DEFECTO } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PedidoPage({
  params,
}: {
  params: { codigo: string };
}) {
  const supabase = createClient();
  const { data: config } = await supabase
    .from("config")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  return (
    <Ticket
      codigo={params.codigo.toUpperCase()}
      config={(config as Config) || CONFIG_DEFECTO}
    />
  );
}
