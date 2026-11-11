-- =====================================================================
-- Club Belén SM — INSTALACIÓN COMPLETA (pegar una sola vez)
--
-- Supabase → SQL Editor → New query → pega TODO este archivo → Run.
-- Debe terminar con "Success. No rows returned".
--
-- Es la unión de los 3 archivos de supabase/migrations/ (esquema,
-- imágenes y notificaciones push). No lo ejecutes dos veces: la segunda
-- vez dará error porque las tablas ya existen (eso no daña nada).
-- =====================================================================


-- ##### 20261111000000_esquema.sql #####
-- =====================================================================
-- Club Belén SM — esquema de base de datos para Supabase
--
-- Toda la escritura pasa por funciones (RPC) que validan permisos en el
-- servidor. Las tablas solo permiten LECTURA directa, filtrada por RLS.
--
-- Importante: los permisos por rol de `role_permissions` deben coincidir
-- con ROLE_PERMISSIONS en src/data/constants.ts.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------

create table public.clubs (
  id text primary key check (id in ('aventureros', 'conquistadores', 'guias')),
  name text not null,
  motto text not null default '',
  color text not null,
  logo_url text,
  cover_url text,
  card_background_url text
);

insert into public.clubs (id, name, motto, color) values
  ('aventureros', 'Aventureros', 'Porque Jesús me ama, siempre haré lo mejor', '#E4572E'),
  ('conquistadores', 'Conquistadores', 'El amor de Cristo me motiva', '#1E5AA8'),
  ('guias', 'Guías Mayores', 'El amor de Cristo nos constriñe', '#7A1F3D');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  full_name text not null,
  sex text not null check (sex in ('M', 'F')),
  birth_date date not null,
  clubs text[] not null default '{}',
  roles text[] not null default '{miembro}',
  is_general_director boolean not null default false,
  photo_url text,
  cover_url text,
  extra_permissions text[] not null default '{}',
  revoked_permissions text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9.]{3,40}$'),
  constraint profiles_clubs_valid check (
    cardinality(clubs) <= 2 and clubs <@ array['aventureros', 'conquistadores', 'guias']
  ),
  constraint profiles_roles_valid check (
    cardinality(roles) between 1 and 3
    and roles <@ array['miembro', 'director', 'director_asociado', 'consejero', 'instructor', 'secretario', 'tesorero', 'capellan']
  )
);
create unique index profiles_username_key on public.profiles (lower(username));
-- Solo puede existir un Director General.
create unique index profiles_one_general_director on public.profiles (is_general_director) where is_general_director;

-- Datos que no deben ver todos los miembros (teléfono).
create table public.profile_private (
  id uuid primary key references public.profiles (id) on delete cascade,
  phone text not null default ''
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  club_ids text[] not null check (cardinality(club_ids) >= 1),
  title text not null,
  description text not null default '',
  date date not null,
  start_time text not null check (start_time ~ '^([01]\d|2[0-3]):[0-5]\d$'),
  end_time text check (end_time ~ '^([01]\d|2[0-3]):[0-5]\d$'),
  location text not null default '',
  cancelled boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index activities_date_idx on public.activities (date);

create table public.notices (
  id uuid primary key default gen_random_uuid(),
  club_ids text[] not null check (cardinality(club_ids) >= 1),
  title text not null,
  body text not null,
  urgent boolean not null default false,
  activity_id uuid references public.activities (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  club_id text not null references public.clubs (id),
  title text not null,
  description text not null default '',
  due_date date not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.task_assignments (
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pendiente' check (status in ('pendiente', 'en_revision', 'hecha')),
  seen boolean not null default false,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  primary key (task_id, user_id)
);
create index task_assignments_user_idx on public.task_assignments (user_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text not null default '',
  href text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  club_id text not null references public.clubs (id),
  date date not null,
  title text not null default 'Reunión regular',
  present_ids uuid[] not null default '{}',
  absent_ids uuid[] not null default '{}',
  created_by uuid references public.profiles (id) on delete set null,
  unique (club_id, date)
);

create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('clase', 'especialidad')),
  name text not null,
  date date not null,
  granted_by uuid references public.profiles (id) on delete set null
);

create table public.pending_changes (
  id uuid primary key default gen_random_uuid(),
  action jsonb not null,
  club_id text not null references public.clubs (id),
  summary text not null default '',
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  status text not null default 'pendiente' check (status in ('pendiente', 'aprobado', 'rechazado')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz
);

-- ---------------------------------------------------------------------
-- Funciones auxiliares de permisos
-- ---------------------------------------------------------------------

create or replace function public.jarr(j jsonb)
returns text[] language sql immutable as $$
  select case when j is null or jsonb_typeof(j) <> 'array' then '{}'::text[]
              else array(select jsonb_array_elements_text(j)) end
$$;

-- Debe coincidir con ROLE_PERMISSIONS en src/data/constants.ts
create or replace function public.role_permissions(p_roles text[])
returns text[] language sql immutable as $$
  select coalesce(array_agg(distinct perm), '{}'::text[]) from (
    select unnest(case r
      when 'director' then array['create_users', 'edit_users', 'manage_club', 'manage_activities', 'manage_notices',
                                 'assign_tasks', 'review_tasks', 'manage_members', 'record_attendance',
                                 'manage_achievements', 'approve_changes']
      when 'director_asociado' then array['edit_users', 'manage_club', 'manage_activities', 'manage_notices',
                                 'assign_tasks', 'review_tasks', 'manage_members', 'record_attendance',
                                 'manage_achievements']
      when 'consejero' then array['assign_tasks', 'review_tasks']
      when 'instructor' then array['assign_tasks', 'review_tasks']
      else '{}'::text[] end) as perm
    from unnest(p_roles) as r
  ) s
$$;

create or replace function public.effective_permissions(p_roles text[], p_extra text[], p_revoked text[])
returns text[] language sql immutable as $$
  select coalesce(array_agg(distinct p), '{}'::text[])
  from unnest(public.role_permissions(p_roles) || p_extra) as p
  where not p = any(p_revoked)
$$;

create or replace function public.has_perm(p_uid uuid, p_perm text, p_club text default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p
    where p.id = p_uid and p.active and (
      p.is_general_director or (
        p_perm = any(effective_permissions(p.roles, p.extra_permissions, p.revoked_permissions))
        and (p_club is null or p_club = any(p.clubs))
      )
    )
  )
$$;

-- Los Directores Asociados necesitan aprobación, salvo que el permiso
-- también les venga de otro rol (p. ej. Consejero) o sean además Director.
create or replace function public.needs_approval(p_uid uuid, p_perm text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles p
    where p.id = p_uid
      and not p.is_general_director
      and 'director_asociado' = any(p.roles)
      and not 'director' = any(p.roles)
      and not p_perm = any(role_permissions(array_remove(p.roles, 'director_asociado')))
  )
$$;

create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and active)
$$;

-- Clubes visibles para el usuario actual (el Director General ve todos).
create or replace function public.my_clubs()
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce((
    select case when p.is_general_director then array['aventureros', 'conquistadores', 'guias'] else p.clubs end
    from profiles p where p.id = auth.uid() and p.active
  ), '{}'::text[])
$$;

-- ¿Tiene p_uid el permiso en al menos uno de los clubes del usuario p_target?
create or replace function public.can_manage_user(p_uid uuid, p_target uuid, p_perm text)
returns boolean language sql stable security definer set search_path = public as $$
  select has_perm(p_uid, p_perm) and exists (
    select 1 from profiles t, unnest(t.clubs) c
    where t.id = p_target and not t.is_general_director and has_perm(p_uid, p_perm, c)
  ) or exists (select 1 from profiles me where me.id = p_uid and me.active and me.is_general_director)
$$;

-- ---------------------------------------------------------------------
-- Seguridad a nivel de fila (solo lectura)
-- ---------------------------------------------------------------------

alter table public.clubs enable row level security;
alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;
alter table public.activities enable row level security;
alter table public.notices enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignments enable row level security;
alter table public.notifications enable row level security;
alter table public.meetings enable row level security;
alter table public.achievements enable row level security;
alter table public.pending_changes enable row level security;

create policy "clubes visibles" on public.clubs for select to authenticated
  using (public.is_active_user());

create policy "perfiles visibles" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_active_user());

create policy "teléfono: uno mismo y sus directores" on public.profile_private for select to authenticated
  using (id = auth.uid() or public.can_manage_user(auth.uid(), id, 'edit_users'));

create policy "actividades de mis clubes" on public.activities for select to authenticated
  using (club_ids && public.my_clubs());

create policy "avisos de mis clubes" on public.notices for select to authenticated
  using (club_ids && public.my_clubs());

create policy "tareas de mis clubes" on public.tasks for select to authenticated
  using (club_id = any(public.my_clubs()));

create policy "asignaciones propias o que reviso" on public.task_assignments for select to authenticated
  using (
    user_id = auth.uid() or exists (
      select 1 from public.tasks t
      where t.id = task_id and (
        t.created_by = auth.uid()
        or public.has_perm(auth.uid(), 'review_tasks', t.club_id)
        or public.has_perm(auth.uid(), 'assign_tasks', t.club_id)
      )
    )
  );

create policy "mis notificaciones" on public.notifications for select to authenticated
  using (user_id = auth.uid());

create policy "reuniones de mis clubes" on public.meetings for select to authenticated
  using (club_id = any(public.my_clubs()));

create policy "logros visibles" on public.achievements for select to authenticated
  using (public.is_active_user());

create policy "cambios pendientes propios o que apruebo" on public.pending_changes for select to authenticated
  using (created_by = auth.uid() or public.has_perm(auth.uid(), 'approve_changes', club_id));

-- Nadie escribe directamente en las tablas: solo a través de las funciones.
revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;
revoke all on all tables in schema public from anon;
grant select on all tables in schema public to authenticated;

-- ---------------------------------------------------------------------
-- Funciones internas (no se pueden llamar desde la app)
-- ---------------------------------------------------------------------

create or replace function public.fecha_larga(d date)
returns text language sql immutable as $$
  select (array['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'])[extract(dow from d)::int + 1]
    || ', ' || extract(day from d)::int || ' de '
    || (array['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre',
              'octubre', 'noviembre', 'diciembre'])[extract(month from d)::int]
$$;

create or replace function public.notify_users(p_ids uuid[], p_title text, p_body text, p_href text default null, p_exclude uuid default null)
returns void language sql security definer set search_path = public as $$
  insert into notifications (user_id, title, body, href)
  select distinct u, p_title, coalesce(p_body, ''), p_href
  from unnest(p_ids) as u
  where u is not null and u is distinct from p_exclude and exists (select 1 from profiles where id = u)
$$;

create or replace function public.member_ids(p_clubs text[])
returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(id), '{}') from profiles where active and clubs && p_clubs
$$;

create or replace function public.approver_ids(p_club text)
returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(id), '{}') from profiles
  where active and (is_general_director or ('director' = any(roles) and p_club = any(clubs)))
$$;

-- Aplica una acción ya autorizada. Equivale a applyAction en src/data/engine.ts.
create or replace function public.apply_action(p_action jsonb, p_actor uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_type text := p_action ->> 'type';
  d jsonb := coalesce(p_action -> 'data', '{}'::jsonb);
  v_id uuid;
  v_prev activities;
  v_new activities;
  v_task tasks;
  v_changes text[] := '{}';
  v_body text;
  v_club text;
begin
  case v_type
  when 'createActivity' then
    insert into activities (club_ids, title, description, date, start_time, end_time, location, created_by)
    values (jarr(d -> 'clubIds'), d ->> 'title', coalesce(d ->> 'description', ''), (d ->> 'date')::date,
            d ->> 'startTime', nullif(d ->> 'endTime', ''), coalesce(d ->> 'location', ''), p_actor)
    returning * into v_new;
    perform notify_users(member_ids(v_new.club_ids), 'Nueva actividad',
      v_new.title || ' · ' || fecha_larga(v_new.date), '/actividad/' || v_new.id, p_actor);

  when 'updateActivity' then
    select * into v_prev from activities where id = (p_action ->> 'id')::uuid;
    if not found then return; end if;
    update activities set
      club_ids = case when d ? 'clubIds' then jarr(d -> 'clubIds') else club_ids end,
      title = case when d ? 'title' then d ->> 'title' else title end,
      description = case when d ? 'description' then coalesce(d ->> 'description', '') else description end,
      date = case when d ? 'date' then (d ->> 'date')::date else date end,
      start_time = case when d ? 'startTime' then d ->> 'startTime' else start_time end,
      end_time = case when d ? 'endTime' then nullif(d ->> 'endTime', '') else end_time end,
      location = case when d ? 'location' then coalesce(d ->> 'location', '') else location end,
      cancelled = case when d ? 'cancelled' then coalesce((d ->> 'cancelled')::boolean, false) else cancelled end,
      updated_at = now()
    where id = v_prev.id
    returning * into v_new;
    if coalesce((p_action ->> 'notify')::boolean, false) then
      -- Cambio de último momento: se publica un aviso urgente automáticamente.
      if v_prev.date <> v_new.date then v_changes := v_changes || ('nueva fecha: ' || fecha_larga(v_new.date)); end if;
      if v_prev.start_time <> v_new.start_time then v_changes := v_changes || ('nueva hora: ' || v_new.start_time); end if;
      if v_prev.location <> v_new.location then v_changes := v_changes || ('nuevo lugar: ' || v_new.location); end if;
      if not v_prev.cancelled and v_new.cancelled then v_changes := v_changes || 'la actividad fue cancelada'::text; end if;
      if v_prev.cancelled and not v_new.cancelled then v_changes := v_changes || 'la actividad vuelve a estar programada'::text; end if;
      v_body := case when cardinality(v_changes) > 0
        then 'Cambio en "' || v_new.title || '": ' || array_to_string(v_changes, ', ') || '.'
        else 'Se actualizó la información de "' || v_new.title || '".' end;
      insert into notices (club_ids, title, body, urgent, activity_id, created_by)
      values (v_new.club_ids, case when v_new.cancelled then 'Actividad cancelada' else 'Cambio de actividad' end,
              v_body, true, v_new.id, p_actor);
      perform notify_users(member_ids(v_new.club_ids), '⚠️ Cambio de último momento', v_body, '/actividad/' || v_new.id, p_actor);
    end if;

  when 'deleteActivity' then
    delete from activities where id = (p_action ->> 'id')::uuid;

  when 'createNotice' then
    insert into notices (club_ids, title, body, urgent, created_by)
    values (jarr(d -> 'clubIds'), d ->> 'title', d ->> 'body', coalesce((d ->> 'urgent')::boolean, false), p_actor);
    perform notify_users(member_ids(jarr(d -> 'clubIds')),
      case when coalesce((d ->> 'urgent')::boolean, false) then '⚠️ Aviso urgente' else 'Nuevo aviso' end,
      d ->> 'title', '/club/avisos', p_actor);

  when 'deleteNotice' then
    delete from notices where id = (p_action ->> 'id')::uuid;

  when 'createTask' then
    v_club := d ->> 'clubId';
    insert into tasks (club_id, title, description, due_date, created_by)
    values (v_club, d ->> 'title', coalesce(d ->> 'description', ''), (d ->> 'dueDate')::date, p_actor)
    returning id into v_id;
    -- Solo se asigna a miembros activos de ese club.
    insert into task_assignments (task_id, user_id)
    select v_id, p.id from profiles p
    where p.active and v_club = any(p.clubs)
      and p.id::text in (select jsonb_object_keys(coalesce(d -> 'assignments', '{}'::jsonb)));
    perform notify_users(array(select user_id from task_assignments where task_id = v_id),
      'Nueva tarea asignada', d ->> 'title', '/tarea/' || v_id, p_actor);

  when 'deleteTask' then
    delete from tasks where id = (p_action ->> 'id')::uuid;

  when 'reviewTask' then
    select * into v_task from tasks where id = (p_action ->> 'taskId')::uuid;
    update task_assignments
    set status = p_action ->> 'status', reviewed_at = now(), reviewed_by = p_actor
    where task_id = v_task.id and user_id = (p_action ->> 'userId')::uuid;
    if found then
      perform notify_users(array[(p_action ->> 'userId')::uuid],
        case when p_action ->> 'status' = 'hecha' then '✅ Tarea aprobada' else 'Tarea devuelta a pendiente' end,
        v_task.title, '/tarea/' || v_task.id, p_actor);
    end if;

  when 'addMember' then
    update profiles set clubs = clubs || (p_action ->> 'clubId')
    where id = (p_action ->> 'userId')::uuid and not (p_action ->> 'clubId') = any(clubs);

  when 'removeMember' then
    update profiles set clubs = array_remove(clubs, p_action ->> 'clubId')
    where id = (p_action ->> 'userId')::uuid;

  when 'updateClub' then
    update clubs set
      name = case when d ? 'name' then coalesce(nullif(d ->> 'name', ''), name) else name end,
      motto = case when d ? 'motto' then coalesce(d ->> 'motto', '') else motto end,
      logo_url = case when d ? 'logoUri' then d ->> 'logoUri' else logo_url end,
      cover_url = case when d ? 'coverUri' then d ->> 'coverUri' else cover_url end,
      card_background_url = case when d ? 'cardBackgroundUri' then d ->> 'cardBackgroundUri' else card_background_url end
    where id = p_action ->> 'clubId';

  when 'updateUser' then
    v_id := (p_action ->> 'userId')::uuid;
    update profiles set
      full_name = case when d ? 'fullName' then d ->> 'fullName' else full_name end,
      sex = case when d ? 'sex' then d ->> 'sex' else sex end,
      birth_date = case when d ? 'birthDate' then (d ->> 'birthDate')::date else birth_date end,
      clubs = case when d ? 'clubs' then jarr(d -> 'clubs') else clubs end,
      roles = case when d ? 'roles' then jarr(d -> 'roles') else roles end,
      username = case when d ? 'username' then lower(d ->> 'username') else username end
    where id = v_id;
    if d ? 'phone' then
      insert into profile_private (id, phone) values (v_id, coalesce(d ->> 'phone', ''))
      on conflict (id) do update set phone = excluded.phone;
    end if;

  when 'recordMeeting' then
    insert into meetings (club_id, date, title, present_ids, absent_ids, created_by)
    values (d ->> 'clubId', (d ->> 'date')::date, coalesce(nullif(d ->> 'title', ''), 'Reunión'),
            jarr(d -> 'presentIds')::uuid[], jarr(d -> 'absentIds')::uuid[], p_actor)
    on conflict (club_id, date) do update
      set title = excluded.title, present_ids = excluded.present_ids, absent_ids = excluded.absent_ids;

  when 'addAchievement' then
    insert into achievements (user_id, kind, name, date, granted_by)
    values ((d ->> 'userId')::uuid, d ->> 'kind', d ->> 'name', (d ->> 'date')::date, p_actor);
    perform notify_users(array[(d ->> 'userId')::uuid],
      case when d ->> 'kind' = 'clase' then '🎖️ Nueva clase obtenida' else '🏅 Nueva especialidad' end,
      d ->> 'name', '/perfil', p_actor);

  when 'removeAchievement' then
    delete from achievements where id = (p_action ->> 'id')::uuid;

  when 'activateUser' then
    update profiles set active = true where id = (p_action ->> 'userId')::uuid;

  else
    raise exception 'Acción desconocida: %', v_type;
  end case;
end;
$$;

-- ---------------------------------------------------------------------
-- Funciones que usa la app
-- ---------------------------------------------------------------------

-- Ejecuta una acción si el usuario tiene permiso. Devuelve 'done' o
-- 'pending' (Director Asociado: queda esperando aprobación).
create or replace function public.perform_action(p_action jsonb, p_summary text default '')
returns text language plpgsql security definer set search_path = public as $$
declare
  v_me profiles;
  v_target profiles;
  v_type text := p_action ->> 'type';
  d jsonb := coalesce(p_action -> 'data', '{}'::jsonb);
  v_perm text;
  v_clubs text[];
  v_new_roles text[];
  v_new_clubs text[];
  v_target_id uuid;
  v_club text;
  v_leaders constant text[] := array['director', 'director_asociado'];
begin
  select * into v_me from profiles where id = auth.uid();
  if v_me.id is null or not v_me.active then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;

  -- 1) Permiso requerido y clubes afectados (como actionRequirements en permissions.ts)
  case v_type
  when 'createActivity' then
    v_perm := 'manage_activities'; v_clubs := jarr(d -> 'clubIds');
  when 'updateActivity', 'deleteActivity' then
    v_perm := 'manage_activities';
    select club_ids into v_clubs from activities where id = (p_action ->> 'id')::uuid;
    if v_type = 'updateActivity' and d ? 'clubIds' then
      v_clubs := array(select distinct unnest(coalesce(v_clubs, '{}') || jarr(d -> 'clubIds')));
    end if;
  when 'createNotice' then
    v_perm := 'manage_notices'; v_clubs := jarr(d -> 'clubIds');
  when 'deleteNotice' then
    v_perm := 'manage_notices'; select club_ids into v_clubs from notices where id = (p_action ->> 'id')::uuid;
  when 'createTask' then
    v_perm := 'assign_tasks'; v_clubs := array[d ->> 'clubId'];
  when 'deleteTask' then
    v_perm := 'assign_tasks'; select array[club_id] into v_clubs from tasks where id = (p_action ->> 'id')::uuid;
  when 'reviewTask' then
    if p_action ->> 'status' not in ('hecha', 'pendiente') then raise exception 'Estado no válido'; end if;
    v_perm := 'review_tasks'; select array[club_id] into v_clubs from tasks where id = (p_action ->> 'taskId')::uuid;
  when 'addMember', 'removeMember' then
    v_perm := 'manage_members'; v_clubs := array[p_action ->> 'clubId'];
  when 'updateClub' then
    v_perm := 'manage_club'; v_clubs := array[p_action ->> 'clubId'];
  when 'recordMeeting' then
    v_perm := 'record_attendance'; v_clubs := array[d ->> 'clubId'];
  when 'updateUser' then
    v_perm := 'edit_users'; v_target_id := (p_action ->> 'userId')::uuid;
  when 'addAchievement' then
    v_perm := 'manage_achievements'; v_target_id := (d ->> 'userId')::uuid;
  when 'removeAchievement' then
    v_perm := 'manage_achievements';
    select user_id into v_target_id from achievements where id = (p_action ->> 'id')::uuid;
  else
    raise exception 'Acción no permitida: %', v_type using errcode = '42501';
  end case;

  if v_target_id is not null then
    select * into v_target from profiles where id = v_target_id;
    if v_target.id is null then raise exception 'Usuario no encontrado'; end if;
    v_clubs := v_target.clubs;
  end if;
  if v_clubs is null or cardinality(v_clubs) = 0 or array_position(v_clubs, null) is not null then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;

  -- 2) Validaciones de datos de usuario
  if v_type = 'updateUser' then
    if exists (select 1 from jsonb_object_keys(d) k
               where k not in ('fullName', 'sex', 'birthDate', 'phone', 'clubs', 'roles', 'username')) then
      raise exception 'Campo no permitido' using errcode = '42501';
    end if;
  end if;

  -- 3) Autorización (como canPerform en permissions.ts)
  if not v_me.is_general_director then
    if v_target_id is not null then
      if v_target.is_general_director then raise exception 'Sin permiso' using errcode = '42501'; end if;
      if v_type = 'updateUser' then
        -- Roles de Director / Director Asociado: solo el Director General.
        if d ? 'roles' then
          v_new_roles := jarr(d -> 'roles');
          if exists (select 1 from unnest(v_leaders) r where (r = any(v_new_roles)) <> (r = any(v_target.roles))) then
            raise exception 'Sin permiso' using errcode = '42501';
          end if;
        end if;
        -- Solo puede poner o quitar clubes que administra.
        if d ? 'clubs' then
          v_new_clubs := jarr(d -> 'clubs');
          if exists (
            select 1 from (
              (select unnest(v_new_clubs) except select unnest(v_target.clubs))
              union
              (select unnest(v_target.clubs) except select unnest(v_new_clubs))
            ) changed(c) where not has_perm(v_me.id, v_perm, c)
          ) then
            raise exception 'Sin permiso' using errcode = '42501';
          end if;
        end if;
      end if;
      if not exists (select 1 from unnest(v_target.clubs) c where has_perm(v_me.id, v_perm, c)) then
        raise exception 'Sin permiso' using errcode = '42501';
      end if;
    elsif exists (select 1 from unnest(v_clubs) c where not has_perm(v_me.id, v_perm, c)) then
      raise exception 'Sin permiso' using errcode = '42501';
    end if;
  end if;

  -- 4) Director Asociado: queda pendiente de aprobación
  if needs_approval(v_me.id, v_perm) then
    v_club := v_clubs[1];
    insert into pending_changes (action, club_id, summary, created_by)
    values (p_action, v_club, coalesce(p_summary, ''), v_me.id);
    perform notify_users(approver_ids(v_club), 'Cambio pendiente de aprobación',
      v_me.full_name || ': ' || coalesce(p_summary, ''), '/aprobaciones', v_me.id);
    return 'pending';
  end if;

  perform apply_action(p_action, v_me.id);
  return 'done';
end;
$$;

-- Aprobar o rechazar un cambio de un Director Asociado.
create or replace function public.review_pending(p_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_p pending_changes;
begin
  select * into v_p from pending_changes where id = p_id for update;
  if v_p.id is null or v_p.status <> 'pendiente' then return; end if;
  if not has_perm(auth.uid(), 'approve_changes', v_p.club_id) then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  update pending_changes
  set status = case when p_approve then 'aprobado' else 'rechazado' end, reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_id;
  if p_approve then
    perform apply_action(v_p.action, v_p.created_by);
  end if;
  perform notify_users(array[v_p.created_by],
    case when p_approve then '✅ Cambio aprobado' else '❌ Cambio rechazado' end, v_p.summary, null, auth.uid());
end;
$$;

-- El miembro entrega su tarea: queda "en revisión" hasta que la aprueben.
create or replace function public.submit_task(p_task uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_task tasks;
  v_name text;
begin
  if not is_active_user() then raise exception 'Sin permiso' using errcode = '42501'; end if;
  update task_assignments set status = 'en_revision', seen = true, submitted_at = now()
  where task_id = p_task and user_id = auth.uid() and status = 'pendiente';
  if not found then return; end if;
  select * into v_task from tasks where id = p_task;
  select full_name into v_name from profiles where id = auth.uid();
  perform notify_users(
    array(select id from profiles where active and (id = v_task.created_by or has_perm(id, 'review_tasks', v_task.club_id))),
    'Tarea entregada para revisión', v_name || ': ' || v_task.title, '/tarea/' || v_task.id, auth.uid());
end;
$$;

create or replace function public.mark_task_seen(p_task uuid)
returns void language sql security definer set search_path = public as $$
  update task_assignments set seen = true where task_id = p_task and user_id = auth.uid() and not seen
$$;

-- Marca como leídas las notificaciones indicadas, o todas si p_ids es null.
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns void language sql security definer set search_path = public as $$
  update notifications set read = true
  where user_id = auth.uid() and not read and (p_ids is null or id = any(p_ids))
$$;

-- Cada usuario puede cambiar su nombre, fecha de nacimiento, foto y portada.
create or replace function public.update_my_profile(p_full_name text, p_birth_date date, p_photo_url text, p_cover_url text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_active_user() then raise exception 'Sin permiso' using errcode = '42501'; end if;
  if coalesce(trim(p_full_name), '') = '' then raise exception 'Nombre requerido'; end if;
  update profiles
  set full_name = trim(p_full_name), birth_date = p_birth_date, photo_url = p_photo_url, cover_url = p_cover_url
  where id = auth.uid();
end;
$$;

-- Solo el Director General: roles, clubes, permisos individuales y estado.
create or replace function public.admin_update_user(p_user uuid, p_patch jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and active and is_general_director) then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  if exists (select 1 from jsonb_object_keys(p_patch) k
             where k not in ('roles', 'clubs', 'extraPermissions', 'revokedPermissions', 'active')) then
    raise exception 'Campo no permitido';
  end if;
  update profiles set
    roles = case when p_patch ? 'roles' then jarr(p_patch -> 'roles') else roles end,
    clubs = case when p_patch ? 'clubs' then jarr(p_patch -> 'clubs') else clubs end,
    extra_permissions = case when p_patch ? 'extraPermissions' then jarr(p_patch -> 'extraPermissions') else extra_permissions end,
    revoked_permissions = case when p_patch ? 'revokedPermissions' then jarr(p_patch -> 'revokedPermissions') else revoked_permissions end,
    active = case when p_patch ? 'active' then (p_patch ->> 'active')::boolean else active end
  where id = p_user and not is_general_director;
end;
$$;

-- Para iniciar sesión con "usuario" en lugar de correo. Si el usuario no
-- existe devuelve un correo inventado, así no se puede averiguar qué
-- usuarios existen.
create or replace function public.login_email(p_username text)
returns text language sql stable security definer set search_path = public, auth as $$
  select coalesce(
    (select u.email from auth.users u join public.profiles p on p.id = u.id
     where lower(p.username) = lower(trim(p_username))),
    'x' || md5(lower(trim(p_username))) || '@usuarios.clubbelensm.app'
  )
$$;

-- ¿Falta crear la cuenta del Director General? (primera vez)
create or replace function public.needs_setup()
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from profiles)
$$;

-- ---------------------------------------------------------------------
-- Funciones para la Edge Function "admin-users" (solo service_role)
-- ---------------------------------------------------------------------

-- 'ok', 'pending' (Director Asociado) o 'denied'
create or replace function public.check_create_user(p_actor uuid, p_clubs text[], p_roles text[])
returns text language plpgsql stable security definer set search_path = public as $$
declare
  v_me profiles;
begin
  select * into v_me from profiles where id = p_actor;
  if v_me.id is null or not v_me.active then return 'denied'; end if;
  if v_me.is_general_director then return 'ok'; end if;
  if cardinality(p_clubs) = 0 then return 'denied'; end if;
  if p_roles && array['director', 'director_asociado'] then return 'denied'; end if;
  if exists (select 1 from unnest(p_clubs) c where not has_perm(p_actor, 'create_users', c)) then return 'denied'; end if;
  return case when needs_approval(p_actor, 'create_users') then 'pending' else 'ok' end;
end;
$$;

create or replace function public.create_profile(p_id uuid, p_actor uuid, p_data jsonb, p_pending boolean, p_summary text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_clubs text[] := jarr(p_data -> 'clubs');
  v_name text;
begin
  insert into profiles (id, username, full_name, sex, birth_date, clubs, roles, active)
  values (p_id, lower(p_data ->> 'username'), p_data ->> 'fullName', p_data ->> 'sex', (p_data ->> 'birthDate')::date,
          v_clubs, jarr(p_data -> 'roles'), not p_pending);
  insert into profile_private (id, phone) values (p_id, coalesce(p_data ->> 'phone', ''));
  if p_pending then
    select full_name into v_name from profiles where id = p_actor;
    insert into pending_changes (action, club_id, summary, created_by)
    values (jsonb_build_object('type', 'activateUser', 'userId', p_id), v_clubs[1], p_summary, p_actor);
    perform notify_users(approver_ids(v_clubs[1]), 'Cambio pendiente de aprobación',
      v_name || ': ' || p_summary, '/aprobaciones', p_actor);
  end if;
end;
$$;

-- Crea el perfil del Director General la primera vez.
create or replace function public.bootstrap_profile(p_id uuid, p_data jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from profiles) then return false; end if;
  insert into profiles (id, username, full_name, sex, birth_date, clubs, roles, is_general_director)
  values (p_id, lower(p_data ->> 'username'), p_data ->> 'fullName', p_data ->> 'sex', (p_data ->> 'birthDate')::date,
          jarr(p_data -> 'clubs'), array['director'], true);
  insert into profile_private (id, phone) values (p_id, coalesce(p_data ->> 'phone', ''));
  return true;
end;
$$;

-- ¿Puede p_actor cambiar la contraseña de p_target? (Asociados no.)
create or replace function public.check_reset_password(p_actor uuid, p_target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_actor <> p_target and (
    exists (select 1 from profiles where id = p_actor and active and is_general_director)
    or (not needs_approval(p_actor, 'edit_users') and can_manage_user(p_actor, p_target, 'edit_users'))
  )
$$;

create or replace function public.is_general_director(p_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = p_uid and active and is_general_director)
$$;

-- ---------------------------------------------------------------------
-- Quién puede ejecutar cada función
-- ---------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.perform_action(jsonb, text),
  public.review_pending(uuid, boolean),
  public.submit_task(uuid),
  public.mark_task_seen(uuid),
  public.mark_notifications_read(uuid[]),
  public.update_my_profile(text, date, text, text),
  public.admin_update_user(uuid, jsonb),
  -- usadas por las políticas RLS
  public.is_active_user(),
  public.my_clubs(),
  public.has_perm(uuid, text, text),
  public.can_manage_user(uuid, uuid, text),
  public.jarr(jsonb),
  public.role_permissions(text[]),
  public.effective_permissions(text[], text[], text[])
to authenticated;

grant execute on function public.login_email(text), public.needs_setup() to anon, authenticated, service_role;

grant execute on function
  public.check_create_user(uuid, text[], text[]),
  public.create_profile(uuid, uuid, jsonb, boolean, text),
  public.bootstrap_profile(uuid, jsonb),
  public.check_reset_password(uuid, uuid),
  public.is_general_director(uuid)
to service_role;

-- ---------------------------------------------------------------------
-- Tiempo real: la app se actualiza sola cuando algo cambia
-- ---------------------------------------------------------------------

alter publication supabase_realtime add table
  public.clubs, public.profiles, public.profile_private, public.activities, public.notices, public.tasks,
  public.task_assignments, public.notifications, public.meetings, public.achievements, public.pending_changes;

-- ##### 20261111000100_imagenes.sql #####
-- Fotos de perfil, portadas, logos y fondos de carnet.
-- Lectura pública (para mostrarlas); escritura solo en la carpeta propia
-- (usuarios/<id>/...) o del club que se administra (clubes/<club>/...).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('imagenes', 'imagenes', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create policy "imagenes: subir fotos propias o del club"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'imagenes' and (
    ((storage.foldername(name))[1] = 'usuarios' and (storage.foldername(name))[2] = auth.uid()::text)
    or ((storage.foldername(name))[1] = 'clubes' and public.has_perm(auth.uid(), 'manage_club', (storage.foldername(name))[2]))
  )
);

-- ##### 20261111000200_push.sql #####
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
