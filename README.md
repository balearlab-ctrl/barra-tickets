# Barra Tickets — pedidos de barra con QR y pago online

Pide desde el móvil escaneando un QR, paga con **Apple Pay / Google Pay / tarjeta** (Stripe)
y recibe un **código + QR único** que el personal valida en la barra. Incluye **panel de
control** para gestionar productos y precios.

Stack: **Next.js 14 (App Router) · Supabase (BD + Auth) · Stripe (pagos)**.

---

## Cómo funciona (flujo seguro)

1. El cliente abre la carta (el QR de la mesa apunta a `/carta?mesa=12`), elige y pulsa pagar.
2. El navegador llama a `/api/checkout`. **El servidor recalcula los precios desde la base de
   datos** (nunca confía en el precio que manda el móvil), genera un código único, crea el
   pedido como `pendiente` y un *PaymentIntent* de Stripe.
3. El cliente paga con el *Payment Element* de Stripe (Apple Pay, Google Pay o tarjeta).
4. Stripe envía un **webhook** a `/api/webhook`. Solo cuando el banco confirma el cobro, el
   pedido pasa a `pagado`. **Esta es la única fuente de verdad del pago.**
5. El cliente ve su ticket en `/pedido/AB-CD` con QR y código (la página consulta el estado
   hasta que se confirma).
6. En barra, el personal abre `/barra`, mete el código y pulsa servir. El canje usa una
   **función SQL atómica** que impide que el mismo código se use dos veces.

---

## Puesta en marcha

### 1. Requisitos
- Node.js 18.18+ (recomendado 20)
- Una cuenta de [Supabase](https://supabase.com) (gratis)
- Una cuenta de [Stripe](https://stripe.com) (modo test gratis)

### 2. Instalar
```bash
npm install
cp .env.local.example .env.local
```

### 3. Base de datos (Supabase)
1. Crea un proyecto en Supabase.
2. Ve a **SQL Editor**, pega el contenido de `supabase/schema.sql` y ejecútalo.
   Crea las tablas, la seguridad (RLS), la función de canje y unos productos de ejemplo.
3. En **Project Settings → API** copia a `.env.local`:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY`  *(secreta, solo servidor)*

### 4. Usuarios del personal
En **Authentication → Users → Add user**, crea las cuentas de tu personal (email + contraseña).
Esas cuentas son las que pueden entrar en `/admin` y `/barra`.

### 5. Stripe
1. En el [dashboard de Stripe](https://dashboard.stripe.com) (modo test), **Developers → API keys**:
   - `Publishable key` → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - `Secret key` → `STRIPE_SECRET_KEY`
2. Webhook en local (en otra terminal):
   ```bash
   stripe login
   stripe listen --forward-to localhost:3000/api/webhook
   ```
   Copia el `whsec_...` que muestra a `STRIPE_WEBHOOK_SECRET`.
3. Para **Apple Pay** necesitas dominio con HTTPS y verificarlo en
   **Stripe → Settings → Payment methods → Apple Pay** (en localhost se prueba con tarjeta;
   Stripe da tarjetas de test como `4242 4242 4242 4242`, cualquier fecha futura y CVC).

### 6. Arrancar
```bash
npm run dev
```
Abre http://localhost:3000

- `/carta?mesa=12` → carta del cliente
- `/admin` → panel de control (login)
- `/barra` → validación (login)

---

## Despliegue (Vercel)

1. Sube el repo a GitHub e impórtalo en [Vercel](https://vercel.com).
2. Añade todas las variables de `.env.local` en **Project Settings → Environment Variables**
   (pon `NEXT_PUBLIC_BASE_URL` con tu dominio real, p. ej. `https://tubar.vercel.app`).
3. En Stripe crea un webhook de producción apuntando a
   `https://tu-dominio/api/webhook` (evento `payment_intent.succeeded`) y usa su `whsec_`.
4. Genera los QR de cada mesa apuntando a `https://tu-dominio/carta?mesa=NUMERO`.

---

## Generar los QR de las mesas

Cada QR solo tiene que codificar una URL como:
```
https://tu-dominio/carta?mesa=12
```
Puedes generarlos con cualquier herramienta de QR (o añadir una página de admin que los pinte).

---

## Notas de seguridad y producción

- Los precios **siempre** se recalculan en el servidor; el cliente no puede manipular importes.
- El pedido solo se da por pagado vía **webhook firmado** de Stripe.
- El canje es **atómico** (función `canjear_pedido`), así que no hay doble entrega aunque dos
  camareros validen a la vez.
- `SUPABASE_SERVICE_ROLE_KEY` y `STRIPE_SECRET_KEY` son secretas: nunca las expongas en el
  cliente ni las subas al repo.
- Para reforzar el acceso del personal puedes añadir una tabla `staff` y comprobar el rol en
  el `middleware`; ahora mismo basta con tener cuenta en Supabase Auth.
- Si esperas mucho volumen, alarga el código (`src/lib/codigo.ts`) para reducir colisiones.

## Estructura
```
supabase/schema.sql            Tablas, RLS y función de canje
src/middleware.ts              Protege /admin y /barra
src/app/carta/                 Carta del cliente
src/app/pedido/[codigo]/       Ticket con QR (polling de estado)
src/app/admin/                 Panel de control (productos/precios/ventas)
src/app/barra/                 Validación en barra
src/app/api/checkout/          Crea pedido + PaymentIntent (precios server-side)
src/app/api/webhook/           Confirma el pago (fuente de verdad)
src/app/api/validar/           Canje atómico (staff)
src/app/api/pedido/[codigo]/   Estado del pedido para el ticket
src/lib/                       Stripe, Supabase y utilidades
```
