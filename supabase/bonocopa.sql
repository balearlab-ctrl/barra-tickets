-- ============================================================
--  Barra Tickets · Bonocopas (consumiciones múltiples)
--  Ejecuta esto en el SQL Editor de Supabase (ADICIONAL, no borra nada).
-- ============================================================

-- Cuántas consumiciones da cada producto (1 = normal, 4/2 = bonocopa)
alter table productos add column if not exists consumiciones int not null default 1;

-- En el pedido, control de consumiciones (null = pedido normal de toda la vida)
alter table pedidos add column if not exists consumiciones_total int;
alter table pedidos add column if not exists consumiciones_restantes int;

-- ============================================================
--  Consumir un pedido de forma atómica.
--  - Pedido normal: lo marca como canjeado (una sola vez).
--  - Bonocopa: descuenta p_cantidad consumiciones; cuando llega a 0,
--    pasa a 'canjeado'. Mientras queden, sigue 'pagado' (válido).
--  Evita gastar más de las que hay aunque se escanee a la vez.
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
  return v;
end;
$$;
