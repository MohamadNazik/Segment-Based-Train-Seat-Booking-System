# Segment-Based Train Seat Booking System

A seat booking system for Sri Lanka's Colombo Fort–Badulla scenic line, where a single
physical seat can be sold to multiple passengers on the same trip as long as their legs
don't overlap - e.g. seat 5 can be booked Colombo Fort → Kandy by one passenger and Kandy →
Badulla by another, on the same train, without conflict. Each passenger pays only for the
distance they actually travel.

Stack: **Go + PostgreSQL + Redis** backend, **React + TypeScript (Vite)** frontend, run via
`docker-compose up`.

## Running it

```
cp .env.example .env
docker compose up --build
```

`.env.example` looks like this:

```
# Backend HTTP server
PORT=8080

# Postgres connection (individual fields, assembled into a DSN by the backend)
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=changeme
DB_NAME=trainbooking
DB_SSLMODE=disable

# Redis (used for temporary seat holds during checkout)
REDIS_ADDR=localhost:6379

# Fare / hold configuration
RATE_PER_KM=10
FRAGMENTATION_RATE=0.5
HOLD_TTL_SECONDS=300
```

Once copied to `.env`, replace `DB_PASSWORD=changeme` with a real password - it's what
initializes the Postgres container's superuser. `RATE_PER_KM`, `FRAGMENTATION_RATE`, and
`HOLD_TTL_SECONDS` are also read from `.env` by `docker-compose.yml` and can be tuned
freely. `PORT`, `DB_HOST`, `DB_PORT`, `DB_SSLMODE`, and `REDIS_ADDR` are **not** read by
Compose - it sets its own container-internal values for those (the api container talks to
`db`/`redis` by service name, not `localhost`); those four only matter for
[local development without Docker](#local-development-without-docker), further down.

Once up:

- Frontend: http://localhost:5173
- API directly: http://localhost:8080 (mostly useful for `curl`ing during development)
- Postgres is exposed on `5433` (not `5432`, to avoid clashing with a locally-installed
  Postgres) and Redis on `6379`.

Migrations run automatically on API startup and are idempotent - `docker compose up` on an
already-provisioned volume is a no-op for the schema. Seed data (all 24 stations, 3 reserved
coaches × 40 seats, 5 unreserved coaches) loads with the first migration run.

### Local development (without Docker)

Backend: `cd backend && go run ./cmd/server` (needs `DB_*`/`REDIS_ADDR` env vars pointing at
a running Postgres + Redis - this is where the `.env.example` values above are read as-is).
Frontend: `cd frontend && npm install && npm run dev` - Vite's dev server proxies `/api` to
`localhost:8080` (see `vite.config.ts`); in the Docker build this proxying job is done by
nginx instead (`frontend/nginx.conf`).

## Requirements addressed

- **Stations / seats / bookings API** - `GET /stations`, `GET /availability`, hold + booking
  endpoints (full reference below).
- **Segment-based reselling** - a seat is booked per station-range, not for the whole route,
  so a vacated leg becomes bookable again for a different passenger. See
  [Segment model](#segment-model).
- **Correct handling of concurrent booking attempts** - a per-seat Redis lock plus a
  Postgres exclusion constraint, described in [Concurrency model](#concurrency-model).
- **Configurable stations, coaches, and seats per coach** - all three are database rows, not
  code. See [Configurability](#configurability).
- **Frontend for searching and booking** - a full React flow: search → coach list → seat
  list → checkout (with a live countdown) → confirmation, with URL-driven search state.

## Segment model

Each station has a `sequence` (0..N-1) along the line. A booking on a seat occupies the
half-open interval `[origin_seq, destination_seq)` (normalized for direction - see below).
Two bookings on the same seat conflict iff their intervals overlap; adjacent legs (`[0,3)`
and `[3,6)`) do **not** conflict, which is exactly the "reselling a vacated seat" behavior
the assignment asks for.

This is enforced two ways, layered:

1. **In Go**, `BookedRange.Overlaps` (`backend/internal/seats/seat.go`) is used both to
   compute live availability and to price a candidate leg's fragmentation surcharge.
2. **In Postgres**, a generated `segment int4range` column plus
   `EXCLUDE USING gist (seat_id WITH =, travel_date WITH =, is_outbound WITH =, segment WITH &&)`
   makes an overlapping insert physically impossible to persist, regardless of what the
   application layer does or how many API instances are running.

Two further dimensions besides the station range:

- **Direction.** The line runs both ways. `origin_seq`/`destination_seq` store the
  passenger's actual boarding/alighting order (descending for an inbound trip), and a
  generated `is_outbound` column records which timeline a booking belongs to. An outbound
  and inbound booking on the same seat/stations never conflict - they're different trips.
- **Date.** The line runs daily, so `travel_date` is part of every booking and every
  uniqueness check. The same seat/stations/direction can be booked on two different dates
  with no conflict.

## Concurrency model

Booking is multi-step (select seat → contact details → mock payment → confirm), so there's
a real window where a seat needs to be provisionally reserved without truly double-booking
it. Two layers:

1. **Redis holds (soft, temporary) for UX during checkout.** `POST /holds` creates a
   `hold:<token>` key in Redis with a TTL (`HOLD_TTL_SECONDS`, default 300s) and returns the
   token to the frontend - a one-time proof of ownership for the later cancel/finalize call,
   not tied to any user account. The fare is computed once, here, and locked in for the rest
   of checkout. If the TTL lapses, Redis deletes the key itself; no cleanup job needed. An
   explicit cancel deletes it immediately instead of waiting.

2. **A per-seat lock** (`SET NX PX` + a compare-and-delete unlock script) serializes
   concurrent hold-creation attempts for the same seat, closing the race where two requests
   both see "available" and both try to create a hold. Whichever acquires the lock first
   checks availability and creates the hold; the other blocks, then re-checks after the lock
   is released and finds the seat already taken.

3. **The Postgres exclusion constraint** is the final backstop at booking finalization -
   Redis and Postgres are two different systems, so there's still a small window (a crash, a
   hold that expires mid-request) where something could theoretically slip through. A
   racing `INSERT` that overlaps raises `exclusion_violation`, translated to a `409`. This
   guarantee holds regardless of how many API instances are running, unlike an app-level
   mutex which only protects a single process.

**Alternative considered:** an in-process mutex/semaphore per seat instead of a Redis lock.
Rejected because it only protects a single API instance - this system is meant to scale
horizontally, and a mutex held in one process's memory does nothing against a second
instance racing the same seat.

## Fare model

Base fare is `rate_per_km * distance(origin, destination)`, using cumulative per-station
distance seeded in the database. On top of that, a fragmentation surcharge accounts for
capacity a booking boxes in: for a candidate leg, look at the seat's nearest same-direction
neighboring booking on each side. A side only counts as "wasted" if it's bounded by another
booking on that side (not by the line's actual start/end - open capacity toward the
terminus is just ordinary remaining capacity, not lost revenue). The surcharge is a
fraction (`FRAGMENTATION_RATE`, default 0.5) of the full per-km rate for that boxed-in gap,
since it's likely, not certain, to go unsold.

Concretely: if seat A is booked `[0,3)` and seat B is booked `[0,4)`, a passenger booking
`[4,7)` sees seat A cost more than seat B for the identical leg, because seat A strands
`[3,4)` between two bookings while seat B leaves no gap. Both `rate_per_km` and
`fragmentation_rate` are env-configurable, not hardcoded.

## Configurability

Stations, coaches, and seats are database rows, not constants in code - extending the line
or adding a coach is a data change, not a code change:

- `stations(id, code, name, sequence, distance_km)` - the ordered station list.
- `coaches(id, code, type, seat_count)` - `type` is `reserved` or `unreserved`.
- `seats(id, coach_id, seat_number)` - generated only for `reserved` coaches, via
  `generate_series(1, seat_count)` in the seed migration. Unreserved coaches are
  first-come-first-served with no seat assignment, matching the assignment's own
  description of them (out of scope for seat-level booking).

Nothing in the Go backend hardcodes a station or coach code - `stations.Repo`, `seats.Repo`,
etc. all read these tables directly. The frontend's station dropdowns are populated live
from `GET /stations`.

## Architecture

```
/backend                       Go module (net/http, pgx/v5, go-redis/v9, golang-migrate)
  cmd/server/main.go            entrypoint: config, DB/Redis connections, migrations, router
  internal/config                env-based config (rates, hold TTL, DB/Redis connection info)
  internal/db, internal/cache    pgxpool setup; Redis client + HoldStore
  internal/apiformat              shared wire-format constants (no dependencies of its own)
  internal/stations               station list
  internal/seats                  availability, fare/fragmentation pricing, overlap logic
  internal/holds                  hold creation/cancellation, per-seat locking
  internal/bookings                finalize-from-hold, booking lookup by ID
  internal/httpapi                 router (stdlib net/http, Go 1.22+ method+path patterns)
  migrations/*.sql                 schema, seed data, embedded via embed.FS
/frontend                      Vite + React 19 + TypeScript, Tailwind CSS v4
  src/pages/                      BookingPage (search/coaches/seats), CheckoutPage,
                                   BookingConfirmationPage - each its own react-router route
  src/components/                 LandingSearch, CoachList, SeatList, Confirmation
  src/api/                        typed fetch client
docker-compose.yml              db (postgres:16), redis, api, web (nginx, non-root)
```

## API reference

All routes are under `/api/v1/`.

| Method | Path | Notes |
|---|---|---|
| GET | `/stations` | Ordered station list. |
| GET | `/availability?origin=&destination=&date=` | Available seats only (booked/pending filtered out), each with coach, seat number, and priced fare. |
| POST | `/holds` | Body `{seat_id, origin, destination, date}` → `{hold_token, travel_date, fare, expires_at}`. `409` if the seat isn't available for that leg/date. |
| POST | `/holds/{token}/cancel` | Releases a hold immediately. `204` on success, `404` if unknown/expired. |
| POST | `/bookings` | Body `{hold_token, email, mobile}` → `201` with the confirmed booking. `410` if the hold is gone/expired, `409` if the exclusion constraint still rejects it. |
| GET | `/bookings/{id}` | Looks up a confirmed booking by ID. `404` if unknown. The ID is an unguessable UUID - the only thing standing in for auth in this no-login system, the same trust model as a physical ticket reference. |

## Design decisions and alternatives considered

- **Two-layer hold + exclusion-constraint model, not just one.** A Redis-only hold with no
  DB-level guarantee would leave a real (if narrow) window for a genuine double-booking if
  something crashed or raced between the hold check and the final insert. A DB-constraint-only
  approach (no Redis hold at all) would work for correctness, but gives no reasonable
  multi-step checkout UX - a seat would have to be booked-or-not in one atomic step, with no
  "you have 5 minutes to pay" period. Using both keeps the DB constraint as the sole source
  of truth for what's actually booked, while Redis handles the UX-facing "is this pending"
  question.
- **Redis-backed per-seat lock over an in-process mutex** - covered above, needed for
  correctness across multiple API instances.
- **Half-open interval `[origin_seq, destination_seq)` model over a simpler
  "exact same leg" match.** Modeling segments as ranges (rather than requiring an exact
  station-pair match) is what makes adjacent-leg reselling and partial-overlap rejection
  both fall out of one `Overlaps` function, instead of needing separate special-case logic
  for each.
- **Unreserved coaches have no seat-level booking**, matching the assignment's own
  description of them as first-come-first-served - modeling individual seats for them would
  add complexity with no real behavior to justify it.
- **Single-seat-at-a-time checkout** (one hold = one seat), not a cart of multiple seats.
  Kept the hold/booking model simpler; extending to multiple seats per checkout is additive
  (a "hold group" concept) rather than a redesign, but wasn't needed for the core
  requirements.
- **Mock payment that always succeeds.** There's no real payment integration in scope;
  "cancel" is the real, testable path that exercises releasing a hold early, so a separate
  simulated-payment-failure path wasn't needed to prove that logic.
- **No login/accounts.** Passengers are identified only by the contact info they give at
  booking time (email + mobile), matching how a real ticket counter works and avoiding scope
  creep beyond what the assignment asks for. A booking's ID (an unguessable UUID) is what
  stands in for access control on `GET /bookings/{id}`.

## Out of scope

Deliberately not implemented, to keep focus on the core requirements above:

- Seat-map visualization (showing which specific seats are taken, not just available count).
- Waitlisting for a fully-booked leg.
- An admin/operator view.
- Real payment integration.
- Multi-seat checkout (booking several seats in one hold/transaction).
- Automated concurrency tests - correctness was instead verified manually against a real
  Postgres + Redis (overlap rejection, adjacent-segment acceptance, reverse-direction
  independence, per-seat lock exclusivity, and real concurrent-request races for both hold
  creation and booking finalization).
