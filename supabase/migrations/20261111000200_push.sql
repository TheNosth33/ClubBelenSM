-- =====================================================================
-- Notificaciones push
--
-- Cada teléfono registra su "token" de Expo al iniciar sesión. Cuando la
-- base de datos crea una notificación (nueva tarea, aviso, aprobación…),
-- un trigger la envía al servicio de Expo con pg_net, que la entrega por
-- Apple (APNs) o Google (FCM).
-- =====================================================================

-- pg_net permite hacer peticiones HTTP desde la base de datos (viene con Supabase).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net with schema extensions;
  end if;
end $$;

create table public.push_tokens (
  token text primary key check (token ~ '^Expo(nent)?PushToken\[.+\]$'),
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null default '',
  updated_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);

-- Nadie lee ni escribe los tokens directamente; solo las funciones de abajo.
alter table public.push_tokens enable row level security;
revoke all on public.push_tokens from anon, authenticated;

-- Registra el teléfono para el usuario actual. Si el teléfono era de otro
-- usuario (cerró sesión y entró otro), pasa al nuevo.
create or replace function public.register_push_token(p_token text, p_platform text default '')
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_active_user() then raise exception 'Sin permiso' using errcode = '42501'; end if;
  insert into push_tokens (token, user_id, platform) values (p_token, auth.uid(), coalesce(p_platform, ''))
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end;
$$;

-- Al cerrar sesión el teléfono deja de recibir notificaciones de ese usuario.
create or replace function public.unregister_push_token(p_token text)
returns void language sql security definer set search_path = public as $$
  delete from push_tokens where token = p_token and user_id = auth.uid()
$$;

-- Envía por push las notificaciones recién creadas (en grupos de 100, el
-- máximo que acepta Expo por petición). Si el envío falla, la acción del
-- usuario NO falla: la notificación sigue apareciendo en la campana.
create or replace function public.send_push_notifications()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_messages jsonb;
  v_total int;
  v_from int := 0;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
      'to', t.token,
      'title', n.title,
      'body', n.body,
      'sound', 'default',
      'priority', 'high',
      'channelId', 'default',
      'badge', (select count(*) from notifications u where u.user_id = n.user_id and not u.read),
      'data', jsonb_build_object('href', n.href, 'notificationId', n.id)
    ) order by n.created_at), '[]'::jsonb)
  into v_messages
  from new_rows n
  join push_tokens t on t.user_id = n.user_id;

  v_total := jsonb_array_length(v_messages);
  while v_from < v_total loop
    begin
      perform net.http_post(
        url := 'https://exp.host/--/api/v2/push/send',
        body := (select jsonb_agg(m order by i) from jsonb_array_elements(v_messages) with ordinality as x(m, i)
                 where i > v_from and i <= v_from + 100),
        headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
      );
    exception when others then
      raise warning 'No se pudo enviar push: %', sqlerrm;
    end;
    v_from := v_from + 100;
  end loop;
  return null;
end;
$$;

create trigger notifications_send_push
after insert on public.notifications
referencing new table as new_rows
for each statement execute function public.send_push_notifications();

revoke execute on function public.register_push_token(text, text), public.unregister_push_token(text),
  public.send_push_notifications() from public, anon, authenticated;
grant execute on function public.register_push_token(text, text), public.unregister_push_token(text) to authenticated;
