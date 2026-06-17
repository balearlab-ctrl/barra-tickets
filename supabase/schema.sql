-- ============================================================
--  Barra Tickets · esquema de base de datos (Supabase / Postgres)
--  Pega esto en el SQL Editor de Supabase y ejecútalo.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- PRODUCTOS ----------
create table if not exists productos (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  categoria   text not null default 'Otros',
  -- precio en céntimos para evitar errores de decimales
  precio_cent integer not null check (precio_cent >= 0),
  activo      boolean not null default true,
  orden       integer not null default 0,
  creado_en   timestamptz not null default now()
);

-- ---------- PEDIDOS ----------
-- estado: pendiente -> pagado -> canjeado   (o pendiente -> cancelado)
create table if not exists pedidos (
  id                uuid primary key default gen_random_uuid(),
  codigo            text not null unique,           -- código corto para la barra (ej. "AB-CD")
  mesa              text,
  items             jsonb not null,                 -- [{nombre, precio_cent, qty}]
  total_cent        integer not null,
  estado            text not null default 'pendiente'
                      check (estado in ('pendiente','pagado','canjeado','cancelado')),
  metodo            text,
  payment_intent_id text unique,
  creado_en         timestamptz not null default now(),
  pagado_en         timestamptz,
  canjeado_en       timestamptz
);

create index if not exists pedidos_estado_idx on pedidos (estado);
create index if not exists pedidos_codigo_idx on pedidos (codigo);

-- ============================================================
--  Canje atómico: solo un camarero puede marcar "canjeado".
--  Devuelve el pedido si tuvo éxito, o lanza un error claro.
-- ============================================================
create or replace function canjear_pedido(p_codigo text)
returns pedidos
language plpgsql
security definer
as $$
declare
  v_pedido pedidos;
begin
  -- Bloquea la fila para evitar doble canje simultáneo
  select * into v_pedido from pedidos where codigo = upper(p_codigo) for update;

  if not found then
    raise exception 'NO_ENCONTRADO';
  end if;

  if v_pedido.estado = 'canjeado' then
    raise exception 'YA_CANJEADO';
  end if;

  if v_pedido.estado <> 'pagado' then
    raise exception 'NO_PAGADO';
  end if;

  update pedidos
     set estado = 'canjeado', canjeado_en = now()
   where id = v_pedido.id
   returning * into v_pedido;

  return v_pedido;
end;
$$;

-- ============================================================
--  RLS (Row Level Security)
-- ============================================================
alter table productos enable row level security;
alter table pedidos   enable row level security;

-- Cualquiera puede LEER los productos activos (la carta es pública).
drop policy if exists "productos lectura publica" on productos;
create policy "productos lectura publica" on productos
  for select using (activo = true);

-- Solo personal autenticado puede gestionar productos.
drop policy if exists "productos gestion staff" on productos;
create policy "productos gestion staff" on productos
  for all to authenticated using (true) with check (true);

-- Los pedidos NO son legibles públicamente desde el cliente.
-- Toda la lógica de pedidos (crear/leer por código/canjear) pasa por
-- las rutas de API del servidor usando la service_role key, que
-- ignora RLS. El personal autenticado también puede leerlos.
drop policy if exists "pedidos staff" on pedidos;
create policy "pedidos staff" on pedidos
  for select to authenticated using (true);

-- ============================================================
--  Datos de ejemplo (puedes borrarlos)
-- ============================================================
insert into productos (nombre, categoria, precio_cent, orden) values
  ('Combinado',         'Copas',       900,  1),
  ('Combinado Premium', 'Copas',      1200,  2),
  ('Cerveza',           'Cervezas',    400,  3),
  ('Refresco',          'Sin alcohol', 300,  4),
  ('Red Bull',          'Sin alcohol', 400,  5),
  ('Agua',              'Sin alcohol', 200,  6)
on conflict do nothing;
