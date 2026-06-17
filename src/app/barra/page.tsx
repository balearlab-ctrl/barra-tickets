import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import BarraClient from "./BarraClient";

export const dynamic = "force-dynamic";

export default async function BarraPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login?next=/barra");

  return <BarraClient />;
}
