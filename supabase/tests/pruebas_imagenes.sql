\set ON_ERROR_STOP 1
set role authenticated;
select t.as_user('sofia');
insert into storage.objects (bucket_id, name) values ('imagenes', 'usuarios/' || t.id('sofia') || '/foto.jpg');
select t.ok(true, 'miembro sube su foto a su carpeta');
select t.denied($$insert into storage.objects (bucket_id, name) values ('imagenes', 'usuarios/' || t.id('diego') || '/foto.jpg')$$, 'miembro no sube fotos a la carpeta de otro');
select t.denied($$insert into storage.objects (bucket_id, name) values ('imagenes', 'clubes/conquistadores/portada.jpg')$$, 'miembro no cambia imágenes del club');
select t.as_user('carlos');
insert into storage.objects (bucket_id, name) values ('imagenes', 'clubes/conquistadores/portada.jpg');
select t.ok(true, 'Director sube portada de su club');
select t.denied($$insert into storage.objects (bucket_id, name) values ('imagenes', 'clubes/aventureros/portada.jpg')$$, 'Director no sube imágenes de otro club');
reset role;
\echo PRUEBAS DE IMÁGENES PASARON
