-- ============================================================
--  Barra Tickets · Archivar pedidos al cerrar evento (sin borrar)
--  Ejecuta esto en el SQL Editor de Supabase (ADICIONAL).
-- ============================================================

-- Marca de "pertenece a un evento ya cerrado". El panel del día solo
-- muestra los NO archivados; pero los archivados siguen existiendo para
-- que el cliente pueda pedir factura después del evento.
alter table pedidos add column if not exists archivado boolean not null default false;
create index if not exists pedidos_archivado_idx on pedidos (archivado);
