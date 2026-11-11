# Club Belén SM — App móvil

App para iOS y Android del **Club Belén SM** (Asociación Oriental Salvadoreña), hecha con
[Expo](https://expo.dev) (React Native + TypeScript). Un solo código genera la app para los dos sistemas.

## Probarla en tu teléfono (5 minutos)

1. Instala **Node.js 20 o más reciente** en tu computadora.
2. Instala la app **Expo Go** en tu teléfono (App Store o Google Play).
3. En esta carpeta ejecuta:

   ```bash
   npm install
   npx expo start
   ```

4. Escanea el código QR que aparece (en iPhone con la cámara, en Android desde Expo Go).

Para verla en el navegador de la computadora: `npx expo start --web`.

### Cuentas de demostración

Sin Supabase configurado, la app trae datos de ejemplo para que la explores (ver
[Conectar a Supabase](#conectar-a-supabase-para-usarla-con-todo-el-club) para usarla de verdad).

| Rol | Usuario | Contraseña |
| --- | --- | --- |
| Director General | `director.general` | `Belen2026` |
| Director (Conquistadores) | `carlos.martinez` | `Club2026` |
| Directora Asociada (sus cambios requieren aprobación) | `maria.hernandez` | `Club2026` |
| Directora (Aventureros) | `ana.ramirez` | `Club2026` |
| Consejero | `jose.castro` | `Club2026` |
| Miembro / Secretaria (asistencia perfecta) | `sofia.gomez` | `Club2026` |
| Miembro (3 faltas → amarillo) | `diego.perez` | `Club2026` |
| Miembro / Tesorera (6 faltas → rojo) | `valeria.cruz` | `Club2026` |


## Pantallas

- **Inicio**: foto, fecha, nombre y lema del club; campana de notificaciones; próxima actividad
  en grande; tareas *sin ver* y *abiertas*; avisos (los de último momento primero, en rojo).
- **Tareas**: semana de domingo a sábado (con flechas para otras semanas; toca un día para filtrar),
  botones *Pendientes* y *Hechas* con su cantidad, y la lista correspondiente.
- **Calendario**: 6 meses (2 pasados, el actual y 3 próximos), vista *Mes completo* o *Semana*, y
  las actividades del mes seleccionado (toca un día para ver solo ese día).
- **Mi Club**: tarjeta con portada, logo y nombre; botones Calendario, Miembros, Avisos y Tareas;
  herramientas de dirección según el rol; próxima actividad; últimos avisos y miembros.
- **Perfil**: tarjeta con portada, foto, nombre, roles (hasta 3) y clubes (hasta 2); botón para
  editar; reuniones del año, asistencias (verde = perfecta, amarillo = 3–4 faltas, rojo = 5 o más)
  y faltas; últimas 3 clases y especialidades; **Mi carnet**.

## Roles y permisos

| Rol | Puede |
| --- | --- |
| **Director General** (una sola cuenta) | Todo: ver todos los clubes, crear/editar/eliminar usuarios, dar y quitar roles, dar y quitar permisos individuales, aprobar cambios, editar cualquier club. |
| **Director** | En sus clubes: editar el club (portada, logo, lema, fondo del carnet), crear actividades y avisos, asignar y revisar tareas, agregar/quitar miembros, crear usuarios, registrar asistencia y logros, aprobar cambios de asociados. |
| **Director Asociado** | Lo mismo que el Director, pero **cada cambio queda pendiente** hasta que lo apruebe el Director del club o el Director General. Crear usuarios solo si el Director General le da ese permiso. |
| **Consejero / Instructor** | Asignar tareas y marcarlas como hechas o pendientes. |
| **Secretario / Tesorero / Capellán** | Igual que un miembro, con su rol visible. |
| **Miembro** | Ver tareas, actividades, avisos y calendario; marcar sus tareas como hechas (quedan *en revisión* hasta que alguien con permiso las apruebe); editar su foto, portada, nombre, fecha de nacimiento y contraseña. |

El Director General puede activar o desactivar cualquier permiso a cualquier usuario en
**Panel de administración → (usuario) → Permisos**. Por ejemplo, dar a la Secretaria el permiso de
*Registrar asistencia*.

## Crear usuarios

Nombre completo, sexo, fecha de nacimiento, edad (se calcula sola), teléfono, club según la edad
(Aventureros 4–9, Conquistadores 10–15, Guías Mayores 16+; desde los 16 puede servir además en un
segundo club), rol (hasta 3), usuario (se genera del nombre: *Juan Carlos Pérez López* →
`juan.perez`) y contraseña (mínimo 8 caracteres con letras y números).

## Conectar a Supabase (para usarla con todo el club)

Sin configurar nada, la app abre en **modo demostración**: los datos viven solo en ese teléfono.
Para que todos compartan la misma información (tareas, avisos, asistencia, fotos) y se
actualice sola en todos los teléfonos, conéctala a [Supabase](https://supabase.com) (plan gratuito).

### 1. Crear el proyecto
Entra a supabase.com → **New project**. Elige una contraseña para la base de datos (guárdala) y la
región más cercana (por ejemplo, *East US*).

### 2. Crear las tablas y reglas de seguridad
En el proyecto: **SQL Editor → New query**. Abre `supabase/instalar_todo.sql`, copia **todo** su
contenido, pégalo y presiona **Run**. Debe decir *Success. No rows returned*.
(Ese archivo une los tres de `supabase/migrations/`: esquema, imágenes y notificaciones push.)

### 3. Cerrar el registro público
**Authentication → Sign In / Providers**: desactiva **Allow new users to sign up**.
Así solo los directores pueden crear cuentas desde la app.

### 4. Subir la función para administrar usuarios
Crear usuarios, restablecer contraseñas y eliminar cuentas necesita una clave que no puede ir
dentro de la app; por eso vive en una *Edge Function*. Con la terminal, en la carpeta del proyecto:

```bash
npx supabase login
```
```bash
npx supabase link --project-ref TU_ID_DE_PROYECTO
```
```bash
npx supabase functions deploy admin-users --no-verify-jwt
```

(`TU_ID_DE_PROYECTO` aparece en la dirección del proyecto: `https://supabase.com/dashboard/project/<id>`.
También puedes crearla desde el panel en **Edge Functions → Deploy a new function → Via Editor**,
con el nombre `admin-users`, pegando `supabase/functions/admin-users/index.ts` y desactivando
**Verify JWT** en su configuración. La función valida ella misma quién la llama.)

### 5. Conectar la app
Copia `.env.example` como `.env` y llena los dos valores de **Project Settings → API Keys**:
la *Project URL* y la *Publishable key* (o la *anon key*). Luego:

```bash
npx expo start
```

La primera vez aparece **Configuración inicial**: ahí creas tu cuenta de Director General.
Desde ese momento tú creas a los directores y ellos a sus miembros.

> Los datos de demostración no se pasan a Supabase: el club empieza limpio.

### Cómo queda protegida la información
- Las tablas solo se pueden **leer** desde la app, y cada quien ve únicamente lo de sus clubes
  (Row Level Security). Los teléfonos de los miembros solo los ven ellos y sus directores.
- Todo cambio pasa por funciones del servidor que **revisan los permisos** del rol: aunque alguien
  modificara la app, no podría saltárselos.
- Los cambios de un Director Asociado quedan pendientes en el servidor hasta que se aprueban.
- Las contraseñas las guarda Supabase cifradas; nunca pasan por la base de datos del club.
- Para entrar con *usuario* (no correo), cada cuenta tiene un correo interno que nadie usa.

### Pruebas del esquema
`supabase/tests/` tiene 100 pruebas (permisos de cada rol, fotos y notificaciones push) que se
corren contra un PostgreSQL local:

```bash
PGHOST=localhost PGUSER=postgres ./supabase/tests/correr.sh
```

## Notificaciones push

Cuando alguien recibe una notificación (tarea nueva, aviso, actividad, aprobación, tarea revisada…)
le llega también al teléfono aunque la app esté cerrada. Al tocarla se abre la pantalla
correspondiente, y el ícono de la app muestra cuántas tiene sin leer.

**Cómo funciona:** al iniciar sesión, el teléfono pide permiso y se registra en Supabase. Cada vez
que la base de datos crea una notificación, la envía al servicio gratuito de Expo, que la entrega por
Apple o Google. Al cerrar sesión, el teléfono deja de recibir las de ese usuario. Si el envío push
falla, nada se rompe: la notificación sigue apareciendo en la campana.

> **No funciona en Expo Go** (ni en el navegador): hace falta instalar la app compilada con EAS.
> Todo lo demás sí funciona en Expo Go.

### Activarlas (una sola vez)

1. **Base de datos:** ya queda lista con `supabase/instalar_todo.sql`. (Si instalaste antes solo
   los dos primeros archivos, ejecuta también `supabase/migrations/20261111000200_push.sql`.)
2. **Cuenta de Expo:** crea una cuenta gratis en expo.dev y en la carpeta del proyecto ejecuta:
   ```bash
   npx eas-cli@latest login
   ```
   ```bash
   npx eas-cli@latest init
   ```
   Esto agrega el identificador del proyecto (`projectId`) en `app.json`.
3. **Android (Firebase):**
   - En [console.firebase.google.com](https://console.firebase.google.com) crea un proyecto y agrega
     una app **Android** con el paquete `com.clubbelensm.app`.
   - Descarga `google-services.json`, ponlo en la carpeta del proyecto y agrega esta línea dentro de
     `"android"` en `app.json`: `"googleServicesFile": "./google-services.json",`
   - En Firebase: **Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada**.
     Súbela a Expo con el siguiente comando y elige *Android → Google Service Account → Push
     Notifications (FCM V1)*:
     ```bash
     npx eas-cli@latest credentials
     ```
4. **iPhone:** necesitas una cuenta de Apple Developer (99 USD/año). La primera vez que compiles
   para iOS, EAS pregunta si quieres configurar las notificaciones push: responde que sí y lo hace solo.
5. **Compilar e instalar:**
   ```bash
   npx eas-cli@latest build --profile preview --platform android
   ```
   Al terminar te da un enlace para descargar el APK: compártelo con los miembros para que lo
   instalen. Para iPhone usa `--profile production --platform ios` y luego
   `npx eas-cli@latest submit --platform ios` para distribuirla por TestFlight.

En **Perfil → Notificaciones push** cada miembro ve si están activadas en su teléfono; si las
negó, al tocar ahí se abren los Ajustes para activarlas.

## Publicar en las tiendas

Con [EAS](https://docs.expo.dev/eas/) se compila en la nube, sin necesidad de una Mac
(`eas.json` ya trae los perfiles `preview` y `production`):

```bash
npx eas-cli@latest build --profile production --platform all
```
```bash
npx eas-cli@latest submit
```

Necesitas una cuenta de Apple Developer (99 USD/año) y una de Google Play (25 USD, un solo pago).

## Estructura del código

```
src/
  app/                 Pantallas (Expo Router: cada archivo es una ruta)
    (tabs)/            Inicio, Tareas, Calendario, Mi Club, Perfil
    login.tsx, notificaciones.tsx, tarea/, actividad/, club/, usuario/, perfil/,
    crear/, asistencia.tsx, revisar.tsx, aprobaciones.tsx, admin/
  components/          Componentes visuales reutilizables
  lib/supabase.ts      Conexión a Supabase (lee el archivo .env)
  lib/push.ts          Permiso, registro del teléfono y apertura de notificaciones push
  data/
    backend/           Dónde viven los datos: local.ts (demostración) o remote.ts (Supabase)
    types.ts           Modelo de datos
    constants.ts       Clubes, roles, permisos, lemas, umbrales de asistencia
    permissions.ts     Quién puede hacer qué
    engine.ts          Aplica los cambios en modo demostración
    DataContext.tsx    Estado de la app y sesión
    seed.ts            Datos de ejemplo y cuenta inicial
  utils/               Fechas en español, usuarios/contraseñas, imágenes
supabase/
  migrations/          Tablas, reglas de seguridad y funciones (se pegan en el SQL Editor)
  functions/admin-users  Crear usuarios, restablecer contraseñas, eliminar cuentas
  tests/               Pruebas de permisos del esquema
```

Comandos útiles: `npm run typecheck`, `npm run lint`.

Si cambias los permisos de un rol, cámbialos en los dos lugares: `ROLE_PERMISSIONS` en
`src/data/constants.ts` y `role_permissions` en el esquema SQL.
