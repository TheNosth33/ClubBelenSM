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
