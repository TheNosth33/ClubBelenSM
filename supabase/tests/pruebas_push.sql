\set ON_ERROR_STOP 1
-- Mensajes push enviados a un token
create function t.pushes_to(p_token text) returns setof jsonb language sql security definer as $$
  select m from net.calls c, jsonb_array_elements(c.body) m where m ->> 'to' = p_token $$;
grant execute on function t.pushes_to(text) to authenticated;
truncate net.calls;

set role anon;
select t.denied($$select public.register_push_token('ExponentPushToken[anon]', 'ios')$$, 'anónimo no registra teléfonos');
reset role;

set role authenticated;
select t.as_user('sofia');
select public.register_push_token('ExponentPushToken[sofia-iphone]', 'ios');
select t.ok(true, 'miembro registra su teléfono');
select t.denied($$select public.register_push_token('no-es-un-token', 'ios')$$, 'se rechaza un token con formato inválido');
select t.denied($$select * from public.push_tokens$$, 'nadie lee los tokens directamente');

-- Un director crea una actividad: Sofía recibe push
select t.as_user('carlos');
select public.perform_action('{"type":"createActivity","data":{"clubIds":["conquistadores"],"title":"Fogata","description":"","date":"2030-05-01","startTime":"18:00","endTime":null,"location":"Iglesia"}}', '');
select t.ok((select count(*) from t.pushes_to('ExponentPushToken[sofia-iphone]')) = 1, 'al crear una actividad, el teléfono de Sofía recibe un push');
select t.ok((select m ->> 'title' = 'Nueva actividad' and m ->> 'body' like 'Fogata · %' and m -> 'data' ->> 'href' like '/actividad/%'
             and m ->> 'sound' = 'default' and m ->> 'channelId' = 'default'
             from t.pushes_to('ExponentPushToken[sofia-iphone]') m), 'el push lleva título, texto y la pantalla que debe abrir');
select t.ok((select (m ->> 'badge')::int >= 1 from t.pushes_to('ExponentPushToken[sofia-iphone]') m), 'el push lleva el número de no leídas para el ícono');
reset role;
select t.ok((select count(*) from net.calls) = 1 and (select url from net.calls) = 'https://exp.host/--/api/v2/push/send', 'una sola petición a Expo para todos los destinatarios');
select t.ok((select headers ->> 'Content-Type' from net.calls limit 1) = 'application/json', 'la petición va como JSON');

-- Muchos teléfonos: se envía en grupos de 100
truncate net.calls;
insert into public.push_tokens (token, user_id) select 'ExponentPushToken[extra-' || g || ']', t.id('jose') from generate_series(1, 150) g;
set role authenticated;
select t.as_user('carlos');
select public.perform_action('{"type":"createNotice","data":{"clubIds":["conquistadores"],"title":"Aviso masivo","body":"x","urgent":true}}', '');
reset role;
select t.ok((select count(*) from net.calls) = 2, '151 mensajes se envían en 2 peticiones (100 + 51)');
select t.ok((select max(jsonb_array_length(body)) from net.calls) = 100, 'ninguna petición pasa de 100 mensajes');
select t.ok((select count(*) from net.calls c, jsonb_array_elements(c.body) m where m ->> 'title' = '⚠️ Aviso urgente') = 151, 'todos los teléfonos reciben el aviso urgente');
delete from public.push_tokens where token like 'ExponentPushToken[extra-%';

-- Quien no tiene teléfono registrado no genera envíos
truncate net.calls;
set role authenticated;
select t.as_user('ana');
select public.perform_action(('{"type":"addAchievement","data":{"userId":"' || t.id('mateo') || '","kind":"clase","name":"Corderitos","date":"2026-10-01"}}')::jsonb, '');
reset role;
select t.ok((select count(*) from net.calls) = 0, 'sin teléfono registrado no se envía nada');

-- Si Expo falla, la acción igual se guarda
create or replace function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000)
returns bigint language plpgsql as $$ begin raise exception 'sin conexión'; end $$;
set role authenticated;
select t.as_user('carlos');
select t.ok(public.perform_action('{"type":"createNotice","data":{"clubIds":["conquistadores"],"title":"Aviso sin internet","body":"x","urgent":false}}', '') = 'done', 'si falla el envío push, la acción igual se completa');
select t.as_user('sofia');
select t.ok(exists (select 1 from public.notifications where body = 'Aviso sin internet'), 'y la notificación aparece en la campana');
reset role;
create or replace function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000)
returns bigint language sql as $$ insert into net.calls (url, body, headers) values (url, body, headers) returning id $$;

-- Cerrar sesión: el teléfono deja de recibir
truncate net.calls;
set role authenticated;
select t.as_user('sofia');
select public.unregister_push_token('ExponentPushToken[sofia-iphone]');
select t.as_user('carlos');
select public.perform_action('{"type":"createNotice","data":{"clubIds":["conquistadores"],"title":"Después de salir","body":"x","urgent":false}}', '');
reset role;
select t.ok((select count(*) from t.pushes_to('ExponentPushToken[sofia-iphone]')) = 0, 'tras cerrar sesión, el teléfono ya no recibe push');

-- Otro usuario entra en el mismo teléfono: el token pasa a él
set role authenticated;
select t.as_user('sofia');
select public.register_push_token('ExponentPushToken[telefono-compartido]', 'android');
select t.as_user('jose');
select public.register_push_token('ExponentPushToken[telefono-compartido]', 'android');
select t.as_user('sofia');
select public.unregister_push_token('ExponentPushToken[telefono-compartido]');
reset role;
select t.ok((select user_id from public.push_tokens where token = 'ExponentPushToken[telefono-compartido]') = t.id('jose'), 'en un teléfono compartido el token pasa al último usuario, y el anterior no se lo puede quitar');
\echo PRUEBAS DE PUSH PASARON
