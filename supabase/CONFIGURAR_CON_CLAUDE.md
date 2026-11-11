# Configurar Supabase con el conector de Claude

Instrucciones para una sesión de Claude que tenga el **conector de Supabase** conectado.
El usuario (Director General del Club Belén SM) usa **Windows**.

## Qué hacer, en orden

1. **Proyecto:** con `list_organizations` / `list_projects`, pregunta si usar un proyecto
   existente o crear uno nuevo llamado `club-belen-sm` (región cercana a El Salvador, p. ej.
   `us-east-1`). Antes de crearlo, muestra el costo (`get_cost` / `confirm_cost`) y espera su confirmación.
2. **Base de datos:** aplica `supabase/instalar_todo.sql` completo con `apply_migration`
   (nombre: `instalacion_inicial`). Verifica con `list_tables` que existan 12 tablas en `public`
   (clubs, profiles, profile_private, activities, notices, tasks, task_assignments, notifications,
   meetings, achievements, pending_changes, push_tokens) y que `select id from clubs` devuelva
   los 3 clubes.
3. **Edge Function:** despliega `supabase/functions/admin-users/index.ts` con el nombre
   `admin-users` y **verify_jwt = false** (la función valida al usuario ella misma; la
   configuración inicial se llama sin sesión).
4. **Revisión de seguridad:** ejecuta `get_advisors` (security) y comenta cualquier aviso.
5. **Claves para la app:** obtén la URL (`get_project_url`) y la clave publicable
   (`get_publishable_keys`). Crea el archivo `.env` en la raíz del proyecto:
   ```
   EXPO_PUBLIC_SUPABASE_URL=<url>
   EXPO_PUBLIC_SUPABASE_KEY=<clave publicable>
   ```
   Nunca uses ni escribas la clave secreta / service_role.
6. **Pasos que el usuario hace en el panel** (el conector no los cubre); dáselos uno por uno:
   - **Authentication → Sign In / Providers → "Allow new users to sign up": desactivar.**
     (Solo los directores crean cuentas desde la app.)
   - Confirmar que el proveedor **Email** está activado (viene activado).
7. **Probar en Windows (PowerShell), en la carpeta del proyecto:**
   ```
   npm install
   npx expo start
   ```
   Al abrir la app debe aparecer **Configuración inicial** para crear la cuenta del Director General.

## Contexto del proyecto
- App Expo (React Native) en `src/`; el cliente de Supabase está en `src/lib/supabase.ts` y la
  capa de datos en `src/data/backend/remote.ts`.
- Toda escritura pasa por funciones RPC con permisos validados en el servidor; las tablas solo
  se leen (RLS). Pruebas del esquema en `supabase/tests/` (100 pruebas).
- Las notificaciones push (pg_net → Expo) ya quedan instaladas con el paso 2; para recibirlas
  hace falta compilar la app con EAS (ver README, sección "Notificaciones push").
