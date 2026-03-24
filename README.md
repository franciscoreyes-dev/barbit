# Barbit

Online booking for barber shops. Customers find a shop, pick a barber and a service, choose an available slot, and book — no account needed, just a phone number and an OTP.

Live Demo (coming soon) · Backend API (coming soon)

## What is this?

Barbit is a multi-tenant SaaS that gives barber shops an online booking page and a management dashboard. The idea is simple: most small shops still take bookings over the phone or on Instagram DMs, and the existing platforms are either too expensive or way too complex for a 2-barber shop.

Three roles, three different experiences:

**Customers** search for a shop, browse barbers and services, pick a date, see available slots in real time, and book by verifying their phone with a 6-digit SMS code. No sign-up, no password, no app to download.

**Shop owners** register their shop, invite barbers via email, and get a full dashboard — calendar with week/day views, stats with charts and KPIs, barber management, and shop settings.

**Barbers** get their own dashboard to manage services, set their weekly schedule, add exceptions (day off, different hours), and view their personal calendar with the ability to mark appointments as completed or no-show.

## Tech stack

| | |
|---|---|
| **Frontend** | React 18 · TypeScript · Vite · Tailwind CSS v4 · shadcn/ui · TanStack Query v5 · React Router v6 · React Hook Form + Zod · Lucide icons |
| **Backend** | Node.js 20 · Fastify v4 · TypeScript · PostgreSQL · node-postgres (raw SQL, no ORM) |
| **Auth** | JWT for owner/barber · SMS OTP for customers (Twilio) |
| **Services** | Twilio (SMS) · Resend (email invites) |

## How it works

### Booking flow

1. Customer searches shops by name or city
2. Picks a barber → picks a service (with price and duration)
3. Picks a date → backend calculates available slots on the fly from the barber's schedule, exceptions, and existing bookings
4. Enters phone number → receives 6-digit OTP via SMS → confirms
5. Appointment created, confirmation SMS sent

Slots are never pre-generated. The algorithm builds them dynamically based on the service duration and cascades from the barber's start time. If someone books 9:00–9:40, the next available slot is 9:40, not 9:30. Race conditions (two people booking the same slot) are handled with a Postgres transaction + `SELECT FOR UPDATE`.

### Owner dashboard

- **Calendar** — 7-day grid on desktop, swipeable single-day view on mobile. Filter by barber. Compact appointment cards that expand on tap.
- **Stats** — week or day view with KPIs (appointments, completed, revenue, no-show rate), bar chart by day, busiest hours, service breakdown, barber breakdown. Estimated income card with optional no-show adjustment.
- **Barbers** — invite via email, activate/deactivate, manage each barber's services, schedule, and exceptions.
- **Settings** — shop name, address, city, phone, email, timezone.

### Barber dashboard

- Personal calendar with appointment details and customer phone (tap to call)
- Mark appointments as completed or no-show
- Manage own services (name, duration, price)
- Weekly schedule editor + day-by-day exceptions

## Database

13 migrations, 11 tables. Multi-tenant by design — every table has a `shop_id` and every query filters by it. No cross-tenant queries exist.

```
shops · users · barbers · service_catalog · barber_services
weekly_schedule · schedule_exceptions · customers
appointments · invite_tokens · otp_codes
```

## Project structure

```
barbit/
├── frontend/
│   └── src/
│       ├── components/      # ui/ (shadcn), owner/, icons/, layout/
│       ├── views/           # public/, owner/, barber/, auth/
│       ├── hooks/           # TanStack Query hooks per resource
│       ├── lib/             # Axios instance, constants
│       ├── types/           # TypeScript interfaces
│       └── router/          # Routes + role-based guards
├── backend/
│   └── src/
│       ├── routes/          # Fastify route handlers
│       ├── services/        # Business logic
│       ├── db/              # Pool, migrations, seed
│       ├── jobs/            # Background tasks
│       └── lib/             # JWT, auth middleware
```

## Running locally

### Prerequisites

- Node.js 20+
- PostgreSQL
- Twilio account (SMS)
- Resend account (emails)

### Backend

```bash
cd backend
cp .env.example .env   # fill in credentials
npm install
npm run migrate
npm run seed           # demo shop with barbers and services
npm run dev            # http://localhost:3000
```

```env
PORT=3000
DATABASE_URL=postgresql://user:pass@localhost:5432/barbit
JWT_SECRET=your-secret
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...
RESEND_API_KEY=...
FRONTEND_URL=http://localhost:5173
```

### Frontend

```bash
cd frontend
cp .env.example .env   # VITE_API_URL=http://localhost:3000
npm install
npm run dev            # http://localhost:5173
```

## API

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register` · `/auth/login` · `/auth/otp/send` · `/auth/otp/verify` |
| Invites | `GET /invite/:token` · `POST /invite/:token/accept` |
| Shops | `GET /shops/search` · `GET /shops/:slug` · `PATCH /shops/:id` · `GET /shops/:id/stats` |
| Barbers | `GET /shops/:shopId/barbers` · `POST /barbers/invite` · `PATCH /barbers/:id` · `DELETE /barbers/:id` |
| Services | `GET/POST /barbers/:id/services` · `PATCH/DELETE /barbers/:id/services/:serviceId` |
| Availability | `GET/PUT /barbers/:id/schedule` · `GET/POST/DELETE /barbers/:id/exceptions` · `GET /barbers/:id/slots` |
| Appointments | `POST /appointments` · `GET /appointments/mine` · `DELETE /appointments/:id` · `PATCH /appointments/:id/status` |

## Roadmap

- [ ] Deploy on Vercel (frontend) + Railway (backend + Postgres)
- [ ] SMS reminders before appointments (job scaffolded)
- [ ] Real-time calendar updates
- [ ] End-to-end tests
- [ ] Customer appointment history page
