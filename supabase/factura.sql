-- ============================================================
--  Barra Tickets · Solicitudes de factura
--  Ejecuta esto en el SQL Editor de Supabase (ADICIONAL, no borra nada).
--  IMPORTANTE: esto NO emite facturas fiscales; solo recoge la PETICIÓN
--  y los datos del cliente para que tú la emitas/enviés manualmente.
-- ============================================================

create table if not exists facturas (
  id          bigint generated always as identity primary key,
  movil       text,
  nombre      text not null,
  nif         text not null,
  direccion   text,
  cp          text,
  poblacion   text,
  email       text not null,
  total_cent  int not null default 0,
  detalle     jsonb not null default '[]',
  estado      text not null default 'pendiente',  -- pendiente | emitida
  creado_en   timestamptz not null default now()
);

alter table facturas enable row level security;

-- El personal (logueado) puede ver y actualizar las solicitudes.
drop policy if exists "facturas staff read" on facturas;
create policy "facturas staff read" on facturas
  for select to authenticated using (true);

drop policy if exists "facturas staff update" on facturas;
create policy "facturas staff update" on facturas
  for update to authenticated using (true) with check (true);
-- La inserción la hace el servidor (service_role), que se salta RLS.
