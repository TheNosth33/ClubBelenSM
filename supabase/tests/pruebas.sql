\set ON_ERROR_STOP 1
\set QUIET 1
-- Ayudantes de prueba
create schema t;
create function t.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FALLÓ: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;
-- Ejecuta SQL como un usuario y verifica que falle por permisos
create function t.denied(sql text, msg text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    raise notice 'ok - % (rechazado: %)', msg, sqlerrm;
    return;
  end;
  raise exception 'FALLÓ: % (se permitió)', msg;
end $$;
grant usage on schema t to anon, authenticated, service_role;
create table t.ids (name text primary key, id uuid);
-- Lee como superusuario (sin RLS) el último cambio pendiente.
create function t.last_pending() returns uuid language sql stable security definer as $$
  select id from public.pending_changes order by created_at desc limit 1 $$;
create function t.pending_status(p uuid) returns text language sql stable security definer as $$
  select status from public.pending_changes where id = p $$;
grant select on t.ids to anon, authenticated, service_role;
create function t.id(n text) returns uuid language sql stable as $$ select id from t.ids where name = n $$;
grant execute on all functions in schema t to anon, authenticated, service_role;

-- ======== Creación de cuentas (como lo hace la Edge Function) ========
set role service_role;
select t.ok(public.needs_setup(), 'base vacía necesita configuración inicial');
reset role;

do $$
declare
  u record;
begin
  for u in select * from (values
    ('dg', 'director.general'), ('carlos', 'carlos.martinez'), ('maria', 'maria.hernandez'),
    ('ana', 'ana.ramirez'), ('jose', 'jose.castro'), ('sofia', 'sofia.gomez'),
    ('diego', 'diego.perez'), ('mateo', 'mateo.lopez'), ('nuevo', 'pedro.gomez')) v(name, username)
  loop
    insert into t.ids values (u.name, gen_random_uuid());
    insert into auth.users (id, email) values (t.id(u.name), 'x' || replace(t.id(u.name)::text, '-', '') || '@usuarios.clubbelensm.app');
  end loop;
end $$;

set role service_role;
select t.ok(public.bootstrap_profile(t.id('dg'), '{"username":"director.general","fullName":"Director General","sex":"M","birthDate":"1985-01-01","clubs":["guias","conquistadores"]}'), 'se crea el Director General');
select t.ok(not public.bootstrap_profile(t.id('carlos'), '{"username":"otro","fullName":"Otro DG","sex":"M","birthDate":"1985-01-01","clubs":[]}'), 'no se puede crear un segundo Director General');
select t.ok(public.check_create_user(t.id('dg'), '{conquistadores}', '{director}') = 'ok', 'el DG puede crear directores');
select public.create_profile(t.id('carlos'), t.id('dg'), '{"username":"carlos.martinez","fullName":"Carlos Martínez","sex":"M","birthDate":"1980-07-22","clubs":["guias","conquistadores"],"roles":["director"],"phone":"7777-1111"}', false, '');
select public.create_profile(t.id('maria'), t.id('dg'), '{"username":"maria.hernandez","fullName":"María Hernández","sex":"F","birthDate":"1990-11-02","clubs":["guias","conquistadores"],"roles":["director_asociado"]}', false, '');
select public.create_profile(t.id('ana'), t.id('dg'), '{"username":"ana.ramirez","fullName":"Ana Ramírez","sex":"F","birthDate":"1988-02-17","clubs":["guias","aventureros"],"roles":["director"]}', false, '');
select public.create_profile(t.id('jose'), t.id('dg'), '{"username":"jose.castro","fullName":"José Castro","sex":"M","birthDate":"2002-08-09","clubs":["guias","conquistadores"],"roles":["consejero"]}', false, '');
select t.ok(public.check_create_user(t.id('carlos'), '{conquistadores}', '{miembro}') = 'ok', 'un Director puede crear miembros de su club');
select t.ok(public.check_create_user(t.id('carlos'), '{aventureros}', '{miembro}') = 'denied', 'un Director no crea usuarios en otro club');
select t.ok(public.check_create_user(t.id('carlos'), '{conquistadores}', '{director}') = 'denied', 'un Director no puede crear Directores');
select t.ok(public.check_create_user(t.id('maria'), '{conquistadores}', '{miembro}') = 'denied', 'Directora Asociada sin permiso no crea usuarios');
select t.ok(public.check_create_user(t.id('jose'), '{conquistadores}', '{miembro}') = 'denied', 'un Consejero no crea usuarios');
select public.create_profile(t.id('sofia'), t.id('carlos'), '{"username":"sofia.gomez","fullName":"Sofía Gómez","sex":"F","birthDate":"2013-05-20","clubs":["conquistadores"],"roles":["miembro","secretario"],"phone":"7000-0001"}', false, '');
select public.create_profile(t.id('diego'), t.id('carlos'), '{"username":"diego.perez","fullName":"Diego Pérez","sex":"M","birthDate":"2014-02-08","clubs":["conquistadores"],"roles":["miembro"]}', false, '');
select public.create_profile(t.id('mateo'), t.id('ana'), '{"username":"mateo.lopez","fullName":"Mateo López","sex":"M","birthDate":"2019-06-12","clubs":["aventureros"],"roles":["miembro"]}', false, '');
select t.ok(not public.needs_setup(), 'ya no necesita configuración inicial');
select t.ok(public.check_reset_password(t.id('carlos'), t.id('sofia')), 'Director puede restablecer contraseña de su miembro');
select t.ok(not public.check_reset_password(t.id('carlos'), t.id('mateo')), 'Director no restablece contraseña de otro club');
select t.ok(not public.check_reset_password(t.id('maria'), t.id('sofia')), 'Directora Asociada no restablece contraseñas');
select t.ok(not public.check_reset_password(t.id('carlos'), t.id('dg')), 'nadie restablece la contraseña del DG');
reset role;

-- ======== Inicio de sesión con usuario ========
set role anon;
select t.ok(public.login_email('Sofia.Gomez ') = 'x' || replace(t.id('sofia')::text, '-', '') || '@usuarios.clubbelensm.app', 'login_email encuentra el correo interno');
select t.ok(public.login_email('no.existe') like 'x%@usuarios.clubbelensm.app', 'usuario inexistente devuelve correo falso (no revela si existe)');
select t.denied('select * from public.profiles', 'anónimo no puede leer perfiles');
select t.denied($$select public.perform_action('{"type":"createNotice","data":{"clubIds":["conquistadores"],"title":"x","body":"x","urgent":false}}')$$, 'anónimo no ejecuta acciones');
reset role;

-- Cambia de usuario
create function t.as_user(n text) returns void language sql as $$ select set_config('request.jwt.claim.sub', t.id(n)::text, false) $$;
grant execute on function t.as_user(text) to authenticated;

-- ======== Miembro: solo lectura ========
set role authenticated;
select t.as_user('sofia');
select t.denied($$insert into public.activities (club_ids, title, date, start_time) values ('{conquistadores}', 'hack', '2030-01-01', '08:00')$$, 'miembro no inserta actividades directamente');
select t.denied($$update public.profiles set roles = '{director}' where id = t.id('sofia')$$, 'miembro no se cambia el rol');
select t.denied($$update public.task_assignments set status = 'hecha'$$, 'miembro no marca tareas hechas directamente');
select t.denied($$select public.perform_action('{"type":"createActivity","data":{"clubIds":["conquistadores"],"title":"x","date":"2030-01-01","startTime":"08:00","location":"x"}}')$$, 'miembro no crea actividades');
select t.denied($$select public.admin_update_user(t.id('sofia'), '{"roles":["director"]}')$$, 'miembro no usa funciones del DG');
select t.denied($$select public.apply_action('{"type":"activateUser","userId":"00000000-0000-0000-0000-000000000000"}', t.id('sofia'))$$, 'la app no puede llamar apply_action');
select t.denied($$select public.create_profile(gen_random_uuid(), t.id('sofia'), '{}', false, '')$$, 'la app no puede llamar create_profile');
select t.ok((select phone from public.profile_private where id = t.id('sofia')) = '7000-0001', 'miembro ve su propio teléfono');
select t.ok(not exists (select 1 from public.profile_private where id <> t.id('sofia')), 'miembro no ve teléfonos de otros');
select public.update_my_profile('Sofía Elena Gómez Rivas', '2013-05-20', 'https://ejemplo/foto.jpg', null);
select t.ok((select full_name from public.profiles where id = t.id('sofia')) = 'Sofía Elena Gómez Rivas', 'miembro edita su nombre y foto');

-- ======== Director: crea actividad en su club ========
select t.as_user('carlos');
select t.ok(public.perform_action('{"type":"createActivity","data":{"clubIds":["conquistadores"],"title":"Caminata","description":"","date":"2030-03-02","startTime":"07:00","endTime":null,"location":"Volcán"}}', 'Crear actividad') = 'done', 'Director crea actividad de su club');
select t.denied($$select public.perform_action('{"type":"createActivity","data":{"clubIds":["aventureros"],"title":"x","date":"2030-01-01","startTime":"08:00","location":"x"}}')$$, 'Director no crea actividades en otro club');
select t.ok(public.perform_action(('{"type":"recordMeeting","data":{"clubId":"conquistadores","date":"2026-11-08","title":"Reunión","presentIds":["' || t.id('sofia') || '"],"absentIds":["' || t.id('diego') || '"]}}')::jsonb) = 'done', 'Director registra asistencia');
select t.ok(public.perform_action(('{"type":"addAchievement","data":{"userId":"' || t.id('sofia') || '","kind":"clase","name":"Amigo","date":"2026-10-01"}}')::jsonb) = 'done', 'Director registra una clase');
select t.ok((select phone from public.profile_private where id = t.id('sofia')) = '7000-0001', 'Director ve teléfono de su miembro');
select t.ok(not exists (select 1 from public.profile_private where id = t.id('mateo')), 'Director no ve teléfono de miembros de otro club');

select t.as_user('sofia');
select t.ok(exists (select 1 from public.activities where title = 'Caminata'), 'miembro ve la actividad de su club');
select t.ok(exists (select 1 from public.notifications where title = 'Nueva actividad'), 'miembro recibe notificación de la actividad');
select t.ok(exists (select 1 from public.notifications where title = '🎖️ Nueva clase obtenida'), 'miembro recibe notificación de su clase');
select t.as_user('mateo');
select t.ok(not exists (select 1 from public.activities where title = 'Caminata'), 'Aventurero no ve actividades de Conquistadores');
select t.ok(not exists (select 1 from public.notifications), 'Aventurero no recibió notificación');
select t.ok(not exists (select 1 from public.meetings), 'Aventurero no ve reuniones de otro club');

-- ======== Cambio de último momento ========
select t.as_user('carlos');
select t.ok(public.perform_action(('{"type":"updateActivity","id":"' || (select id from public.activities where title = 'Caminata') || '","data":{"startTime":"09:00","endTime":null},"notify":true}')::jsonb) = 'done', 'Director cambia la hora de la actividad');
select t.ok(exists (select 1 from public.notices where urgent and body like '%nueva hora: 09:00%'), 'se publica aviso urgente automático');

-- ======== Directora Asociada: sus cambios esperan aprobación ========
select t.as_user('maria');
select t.ok(public.perform_action('{"type":"createNotice","data":{"clubIds":["conquistadores"],"title":"Ensayo de marcha","body":"Sábado 3 p. m.","urgent":false}}', 'Publicar aviso "Ensayo de marcha"') = 'pending', 'aviso de la Asociada queda pendiente');
select t.ok(not exists (select 1 from public.notices where title = 'Ensayo de marcha'), 'el aviso aún no se publica');
select t.ok(exists (select 1 from public.pending_changes where status = 'pendiente'), 'la Asociada ve su cambio pendiente');
select t.as_user('ana');
select t.ok(not exists (select 1 from public.pending_changes), 'Directora de otro club no ve el pendiente');
select t.denied($$select public.review_pending(t.last_pending(), true)$$, 'Directora de otro club no puede aprobar');
select t.ok(t.pending_status(t.last_pending()) = 'pendiente', 'el cambio sigue pendiente');
select t.as_user('carlos');
select t.ok(exists (select 1 from public.notifications where title = 'Cambio pendiente de aprobación'), 'el Director recibe aviso de aprobación pendiente');
select public.review_pending((select id from public.pending_changes where status = 'pendiente'), true);
select t.ok(exists (select 1 from public.notices where title = 'Ensayo de marcha' and created_by = t.id('maria')), 'al aprobar, el aviso se publica a nombre de la Asociada');
select t.as_user('maria');
select t.ok(exists (select 1 from public.notifications where title = '✅ Cambio aprobado'), 'la Asociada recibe la aprobación');

-- ======== Tareas: consejero asigna, miembro entrega, consejero revisa ========
select t.as_user('jose');
select t.ok(public.perform_action(('{"type":"createTask","data":{"clubId":"conquistadores","title":"Aprender nudos","description":"","dueDate":"2030-01-10","assignments":{"' || t.id('sofia') || '":{"status":"pendiente","seen":false},"' || t.id('diego') || '":{"status":"pendiente","seen":false},"' || t.id('mateo') || '":{"status":"pendiente","seen":false}}}}')::jsonb) = 'done', 'Consejero asigna tarea');
select t.ok((select count(*) from public.task_assignments) = 2, 'no se asigna a quien no es del club (Mateo excluido)');
select t.denied($$select public.perform_action('{"type":"createActivity","data":{"clubIds":["conquistadores"],"title":"x","date":"2030-01-01","startTime":"08:00","location":"x"}}')$$, 'Consejero no crea actividades');

select t.as_user('sofia');
select public.mark_task_seen((select id from public.tasks where title = 'Aprender nudos'));
select public.submit_task((select id from public.tasks where title = 'Aprender nudos'));
select t.ok((select status from public.task_assignments where user_id = t.id('sofia')) = 'en_revision', 'miembro entrega: queda en revisión (no hecha)');
select t.ok((select count(*) from public.task_assignments) = 1, 'miembro solo ve su propia asignación');
select t.denied($$select public.perform_action(('{"type":"reviewTask","taskId":"' || (select id from public.tasks where title = 'Aprender nudos') || '","userId":"' || t.id('sofia') || '","status":"hecha"}')::jsonb)$$, 'miembro no puede aprobarse su tarea');

select t.as_user('jose');
select t.ok(exists (select 1 from public.notifications where title = 'Tarea entregada para revisión'), 'Consejero recibe aviso de entrega');
select t.ok(public.perform_action(('{"type":"reviewTask","taskId":"' || (select id from public.tasks where title = 'Aprender nudos') || '","userId":"' || t.id('sofia') || '","status":"hecha"}')::jsonb) = 'done', 'Consejero marca la tarea como hecha');
select t.as_user('sofia');
select t.ok((select status from public.task_assignments where user_id = t.id('sofia')) = 'hecha', 'la tarea queda hecha');
select public.mark_notifications_read(null);
select t.ok(not exists (select 1 from public.notifications where not read), 'miembro marca sus notificaciones como leídas');

-- ======== Editar usuarios ========
select t.as_user('carlos');
select t.denied($$select public.perform_action(('{"type":"updateUser","userId":"' || t.id('sofia') || '","data":{"roles":["director"]}}')::jsonb)$$, 'Director no puede dar rol de Director');
select t.denied($$select public.perform_action(('{"type":"updateUser","userId":"' || t.id('sofia') || '","data":{"clubs":["aventureros"]}}')::jsonb)$$, 'Director no mueve a un miembro a un club que no administra');
select t.denied($$select public.perform_action(('{"type":"updateUser","userId":"' || t.id('sofia') || '","data":{"active":false}}')::jsonb)$$, 'Director no puede usar campos del DG');
select t.denied($$select public.perform_action(('{"type":"updateUser","userId":"' || t.id('dg') || '","data":{"fullName":"x"}}')::jsonb)$$, 'nadie edita al Director General');
select t.ok(public.perform_action(('{"type":"updateUser","userId":"' || t.id('sofia') || '","data":{"roles":["miembro","secretario","consejero"],"phone":"7000-9999"}}')::jsonb) = 'done', 'Director cambia roles no directivos y teléfono');
select t.denied($$select public.admin_update_user(t.id('sofia'), '{"active":false}')$$, 'Director no usa funciones del DG');

-- ======== Director General ========
select t.as_user('dg');
select t.ok((select count(*) from public.activities) >= 1 and (select count(*) from public.profiles) = 8, 'DG ve todo');
select public.admin_update_user(t.id('maria'), '{"extraPermissions":["create_users"]}');
reset role;
set role service_role;
select t.ok(public.check_create_user(t.id('maria'), '{conquistadores}', '{miembro}') = 'pending', 'Asociada con permiso: crear usuario queda pendiente');
select public.create_profile(t.id('nuevo'), t.id('maria'), '{"username":"pedro.gomez","fullName":"Pedro Gómez","sex":"M","birthDate":"2014-03-10","clubs":["conquistadores"],"roles":["miembro"]}', true, 'Crear usuario Pedro Gómez');
reset role;
set role authenticated;
select t.as_user('nuevo');
select t.ok((select active from public.profiles where id = t.id('nuevo')) = false, 'usuario pendiente queda inactivo');
select t.ok(not exists (select 1 from public.activities), 'usuario inactivo no ve datos');
select t.denied($$select public.update_my_profile('x y', '2014-03-10', null, null)$$, 'usuario inactivo no puede editar');
select t.as_user('carlos');
select public.review_pending((select id from public.pending_changes where status = 'pendiente'), true);
select t.ok((select active from public.profiles where id = t.id('nuevo')), 'al aprobar, el usuario queda activo');

select t.as_user('dg');
select public.admin_update_user(t.id('diego'), '{"active":false}');
select t.as_user('diego');
select t.ok(not exists (select 1 from public.activities), 'usuario desactivado no ve nada');
select t.denied($$select public.submit_task((select id from public.tasks limit 1))$$, 'usuario desactivado no entrega tareas');
reset role;
\echo
\echo TODAS LAS PRUEBAS PASARON
-- La Edge Function usa la clave de servicio para estas funciones
set role service_role;
select t.ok(not public.needs_setup(), 'service_role puede consultar needs_setup');
select t.ok(public.login_email('sofia.gomez') is not null, 'service_role puede consultar login_email');
select t.ok(public.is_general_director(t.id('dg')), 'service_role puede consultar is_general_director');
reset role;
\echo PRUEBAS DE SERVICE_ROLE PASARON
