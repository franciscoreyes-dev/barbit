# Barbit

A multi-tenant SaaS platform for barber shop appointment management. Customers can search for shops, pick a barber and a service, choose an available time slot, and book — all without creating an account. Shop owners and barbers manage everything from their own dashboards.

I built this as a portfolio project to show what I can do with a fullstack TypeScript stack after my two years at ITS Angelo Rizzoli (Software Architect — Full Stack Developer) and my first year working in the industry. The idea came from a real problem: most barber shops around me still take bookings over the phone or on Instagram DMs, and the existing platforms are either too expensive or too bloated for a small shop.

## What it does

**For customers (no account needed):**
- Search shops by name or city
- Browse barbers and their services with prices and duration
- Pick a date and see available time slots calculated in real time
- Book by verifying their phone number with a 6-digit OTP via SMS
- View and cancel upcoming appointments (up to 12h before)

**For shop owners:**
- Register the shop and get a public page at `/shop/your-slug`
- Invite barbers via email (they get a link, set a password, and they're in)
- See the full shop calendar — week view on desktop, swipeable day view on mobile
- Filter appointments by barber
- Stats dashboard with KPIs, appointments per day chart, busiest hours, service and barber breakdowns
- Estimated income card with optional no-show rate adjustment
- Manage barber profiles, services, schedules, and exceptions
- Configure shop details (name, address, phone, timezone)

**For barbers:**
- Personal calendar with appointment details
- Mark appointments as completed or no-show
- Manage their own services (name, duration, price)
- Set weekly schedule and day-by-day exceptions (day off, different hours)

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS v4, shadcn/ui |
| State | TanStack Query v5, React Hook Form + Zod |
| Routing | React Router v6 with role-based guards |
| Backend | Node.js 20, Fastify v4, TypeScript |
| Database | PostgreSQL with raw SQL (node-postgres, no ORM) |
| Auth | JWT (owner/barber), OTP via SMS (customers) |
| Email | Resend (barber invites) |
| SMS | Twilio (OTP + booking confirmations) |
| Icons | Lucide React |

## Project structure

```
barbit/
├── frontend/                # React SPA
│   └── src/
│       ├── components/
│       │   ├── ui/          # shadcn/ui base components
│       │   ├── owner/       # AppointmentCard, DayColumn, BarberFilterStrip
│       │   ├── icons/       # Shared icon components
│       │   └── layout/      # OwnerLayout, BarberLayout
│       ├── views/
│       │   ├── public/      # HomeView, ShopView, BookingView, OtpView
│       │   ├── owner/       # StatsView, DashboardView, BarbersView, BarberDetailView, SettingsView
│       │   ├── barber/      # CalendarView, ServicesView, ScheduleView
│       │   └── auth/        # LoginView, RegisterView, InviteView
│       ├── hooks/           # TanStack Query hooks for every API resource
│       ├── lib/             # Axios instance, constants
│       ├── types/           # TypeScript interfaces
│       └── router/          # Routes + guards
├── backend/
│   └── src/
│       ├── routes/          # Fastify route handlers
│       ├── services/        # Business logic (availability, appointments, OTP, shop stats)
│       ├── db/              # Connection pool, migrations, seed
│       ├── jobs/            # Background tasks (appointment reminders)
│       └── lib/             # JWT helpers, auth middleware
```

## Database

13 migrations, 11 tables. The schema is designed around multi-tenant isolation — every table has a `shop_id` foreign key and every query filters by it.

Main tables: `shops`, `users`, `barbers`, `service_catalog`, `barber_services`, `weekly_schedule`, `schedule_exceptions`, `customers`, `appointments`, `invite_tokens`, `otp_codes`.

**Slot calculation:** slots are not pre-generated. When a customer asks for availability, the backend calculates open slots on the fly based on the barber's schedule, any exceptions for that day, the service duration, and existing appointments. Race conditions on double-booking are handled with a Postgres transaction + `SELECT FOR UPDATE`.

## How to run it

### Prerequisites
- Node.js 20+
- PostgreSQL
- Twilio account (for SMS OTP)
- Resend account (for invite emails)

### Backend

```bash
cd backend
cp .env.example .env   # fill in your credentials
npm install
npm run migrate
npm run seed           # creates a demo shop with barbers and services
npm run dev            # starts on http://localhost:3000
```

Environment variables needed:

```
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
cp .env.example .env   # set VITE_API_URL=http://localhost:3000
npm install
npm run dev            # starts on http://localhost:5173
```

## API overview

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `/auth/login`, `/auth/otp/send`, `/auth/otp/verify` |
| Invites | `GET /invite/:token`, `POST /invite/:token/accept` |
| Shops | `GET /shops/search`, `GET /shops/:slug`, `PATCH /shops/:id`, `GET /shops/:id/stats` |
| Barbers | `GET /shops/:shopId/barbers`, `POST /barbers/invite`, `PATCH /barbers/:id`, `DELETE /barbers/:id` |
| Services | `GET /barbers/:id/services`, `POST /barbers/:id/services`, `PATCH`, `DELETE` |
| Availability | `GET/PUT /barbers/:id/schedule`, `GET/POST/DELETE /barbers/:id/exceptions`, `GET /barbers/:id/slots` |
| Appointments | `POST /appointments`, `GET /appointments/mine`, `DELETE /appointments/:id`, `PATCH /appointments/:id/status` |

## What I learned building this

This is the project where a lot of things clicked for me. Some highlights:

- **Multi-tenancy with row-level isolation.** Every query has a `WHERE shop_id = $1` and I learned the hard way what happens when you forget one (spoiler: you see other people's data).
- **Slot calculation is harder than it looks.** Generating available time slots from a weekly schedule + exceptions + existing bookings, with variable service durations, was the trickiest algorithm in the project. And then you need to handle two people trying to book the same slot at the same time — that's where Postgres transactions with `SELECT FOR UPDATE` saved me.
- **OTP auth without accounts.** Customers don't sign up. They just enter their phone, get a code, and they're in. It was a good exercise in thinking about auth flows that aren't the usual email/password.
- **Mobile-first is a mindset.** I designed every component for a phone screen first and then adapted for desktop. The owner calendar switches from a single-day swipeable view on mobile to a full 7-day grid on desktop, and getting the appointment cards to work in both layouts without duplicating code took some iteration.
- **Component architecture matters.** Extracting `AppointmentCard`, `DayColumn`, `BarberFilterStrip` as reusable components made it possible to share logic between the owner calendar and stats views without copy-pasting.

## Status

This is a working MVP. The core flows (registration, invite, booking, calendar management) are all functional. Some things I'd add next:

- [ ] SMS reminders before appointments (backend job is scaffolded)
- [ ] Deployment on Vercel + Railway
- [ ] End-to-end tests
- [ ] Real-time calendar updates with WebSocket or SSE
- [ ] Customer appointment history page

## About me

I'm Francisco — fullstack developer based in Milan. I studied at [ITS Angelo Rizzoli](https://www.its-rizzoli.it/) (2 year program, Software Architect — Full Stack Developer) and I've been working in the industry for about a year now. This project is part of my portfolio to show how I approach building a product from scratch.

If you want to get in touch, find me on [GitHub](https://github.com/franciscoreyes-dev).
