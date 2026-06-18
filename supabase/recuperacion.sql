-- ============================================================
--  Barra Tickets · Recuperar pedido con móvil + clave
--  Ejecuta esto en el SQL Editor de Supabase (ADICIONAL, no borra nada).
-- ============================================================

-- Datos para recuperar el pedido
alter table pedidos add column if not exists movil text;
alter table pedidos add column if not exists pin_hash text;   -- clave cifrada (nunca en claro)
create index if not exists pedidos_movil_idx on pedidos (movil);

-- Control de intentos fallidos por móvil (anti fuerza bruta)
create table if not exists recuperacion_rate (
  movil            text primary key,
  fallos           int not null default 0,
  bloqueado_hasta  timestamptz
);

alter table recuperacion_rate enable row level security;
-- Sin policies a propósito: solo el servidor (service_role) accede a esta tabla.
