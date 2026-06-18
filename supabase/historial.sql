-- ============================================================
--  Barra Tickets · Historial de consumiciones
--  Ejecuta esto en el SQL Editor de Supabase (ADICIONAL, no borra nada).
-- ============================================================

-- Registro de cada vez que se sirve algo (cada canje, con su hora)
create table if not exists consumiciones_log (
  id         bigint generated always as identity primary key,
  pedido_id  uuid not null references pedidos(id) on delete cascade,
  codigo     text not null,
  cantidad   int not null default 1,
  creado_en  timestamptz not null default now()
);
create index if not exists consumiciones_log_pedido_idx on consumiciones_log (pedido_id);

alter table consumiciones_log enable row level security;
-- Sin policies: solo el servidor (service_role) accede.

-- ============================================================
--  Misma función de consumo de siempre, pero ahora REGISTRA
--  cada canje en consumiciones_log (cantidad y hora).
-- ============================================================
create or replace function consumir_pedido(p_codigo text, p_cantidad int default 1)
returns pedidos
language plpgsql
security definer
as $$
declare
  v pedidos;
  q int;
begin
  select * into v from pedidos where codigo = upper(p_codigo) for update;

  if not found then raise exception 'NO_ENCONTRADO'; end if;
  if v.estado = 'canjeado' then raise exception 'YA_CANJEADO'; end if;
  if v.estado <> 'pagado' then raise exception 'NO_PAGADO'; end if;

  -- Pedido normal
  if v.consumiciones_restantes is null then
    update pedidos set estado = 'canjeado', canjeado_en = now()
      where id = v.id returning * into v;
    insert into consumiciones_log (pedido_id, codigo, cantidad) values (v.id, v.codigo, 1);
    return v;
  end if;

  -- Bonocopa
  q := greatest(1, coalesce(p_cantidad, 1));
  if q > v.consumiciones_restantes then raise exception 'SALDO_INSUFICIENTE'; end if;

  if v.consumiciones_restantes - q <= 0 then
    update pedidos
       set consumiciones_restantes = 0, estado = 'canjeado', canjeado_en = now()
     where id = v.id returning * into v;
  else
    update pedidos
       set consumiciones_restantes = v.consumiciones_restantes - q
     where id = v.id returning * into v;
  end if;

  insert into consumiciones_log (pedido_id, codigo, cantidad) values (v.id, v.codigo, q);
  return v;
end;
$$;
