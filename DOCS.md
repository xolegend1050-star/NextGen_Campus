# NextGen Campus — Project Documentation

A full-stack platform connecting tier 2/3 college students with alumni mentors,
enabling doubt-solving, and offering micro-internships (gigs).

**Student Project** — Sujal Borhade, B.Sc Computer Science, Thakur College

---

## Live Deployment

| Service | URL | Platform |
|---------|-----|----------|
| Frontend | https://nextgen-campus-8qib.onrender.com | Render (Static Site) |
| Backend API | https://nextgen-campus-api.onrender.com | Render (Web Service) |
| API Docs (Swagger) | https://nextgen-campus-api.onrender.com/api-docs | Render |
| AI Service | https://nextgen-campus-ai.onrender.com | Render (Web Service) |
| Database | Supabase project `ojfzzenwzojbejafpusk` | Supabase (ap-northeast-1) |

Repository: https://github.com/xolegend1050-star/NextGen_Campus

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, Tailwind CSS, React Router, Zustand, React Hook Form + Zod |
| Backend | Node.js, Express, JWT, Socket.IO, Helmet, express-rate-limit |
| Database | PostgreSQL (Supabase), `pg` driver |
| AI Service | Python, Flask, scikit-learn, Gemini API |
| Email | Resend (HTTP API) |
| Deployment | Render (3 services) |

---

## Module Status

| Module | Status |
|--------|--------|
| Authentication | Complete |
| Email (Resend) | Complete |
| Admin Panel | Complete |
| Frontend Routing | Complete |
| Database & Config | Complete |
| AI Service | Healthy (cold start ~30-60s on free tier) |
| Chat / Social | Partial — REST only, Socket.IO not wired |
| File Upload | Complete |
| Payments / Escrow | Complete (simulated gateway) |

---

## 1. Authentication Module

Complete end-to-end flow: register → verify email → login → protected routes →
forgot password → reset password → logout → refresh token.

| # | Fix | Severity | File |
|---|-----|----------|------|
| 1 | Created `/verify-email` page — flow was completely broken (no page existed) | Critical | `frontend/src/pages/auth/VerifyEmail.jsx` |
| 2 | Removed `verification_token` leak from register API response | Critical | `backend/src/controllers/auth/authController.js` |
| 3 | Fixed profile data silently lost on registration (`ON CONFLICT DO NOTHING` → `DO UPDATE`) | High | `backend/src/controllers/auth/authController.js` |
| 4 | `verification_type` now role-dependent (student / alumni / company) | Medium | `backend/src/controllers/auth/authController.js` |
| 5 | Added `verifyEmailValidation` middleware to `/verify-email` | Medium | `backend/src/validators/auth.js`, `backend/src/routes/auth.js` |
| 6 | `authenticate` middleware validates the session exists — logged-out tokens rejected | Medium | `backend/src/middleware/auth.js` |
| 7 | `getMe` returns `company_profiles` data for company users | Medium | `backend/src/controllers/auth/authController.js` |
| 8 | ResetPassword enforces uppercase + lowercase + digit (frontend parity with backend) | Medium | `frontend/src/pages/auth/ResetPassword.jsx` |

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | No | Create account, send verification email |
| POST | `/api/auth/login` | No | Returns JWT + refresh token |
| GET | `/api/auth/me` | Yes | Current user + role-specific profile |
| POST | `/api/auth/forgot-password` | No | Email a reset link (non-enumerable response) |
| POST | `/api/auth/reset-password` | No | Consume token, set new password |
| POST | `/api/auth/verify-email` | No | Consume verification token |
| POST | `/api/auth/resend-verification` | No | Resend the verification link (non-enumerable) |
| POST | `/api/auth/logout` | Yes | Invalidate session |
| POST | `/api/auth/refresh` | No | Issue a new access token |

### Security controls

- Passwords hashed with bcrypt (12 salt rounds)
- Zod/express-validator parity between frontend and backend
- Global rate limit: 500 requests / 15 min per IP
- Strict auth rate limit: 5 failed attempts / 15 min on login, register,
  forgot-password, reset-password (successful logins not counted)
- Helmet security headers, CORS allow-list, 10 MB body limit

---

## 2. Email Module (Resend)

Three-stage rewrite, documented because each stage fixed a distinct failure:

| Stage | Implementation | Problem solved |
|-------|----------------|----------------|
| 1 | Nodemailer with a module-level cached transporter | First call fell back to the Ethereal test account and cached that broken transporter permanently |
| 2 | Fresh transporter per call, 10 s timeouts, config logging | Removed the stale-cache bug |
| 3 | **Resend HTTP API** | Render's free tier blocks outbound SMTP ports 25/465/587, so nodemailer could never connect |

`forgotPassword` sends the email **non-blocking** (fire-and-forget), so the API
responds immediately regardless of provider latency.

`EMAIL_FROM` uses `onboarding@resend.dev` — Resend's free-tier default sender.

---

## 3. Admin Panel

### Backend
- Added missing `GET /api/admin/flagged-content` and `GET /api/admin/disputes`
  (only PATCH/PUT handlers existed, so the pages 404'd)
- New seed script: `backend/src/config/seed-admin.js`

### Seeded data
5 verification requests (3 pending, 1 approved, 1 rejected), 3 flagged content
items, 2 disputes (1 open, 1 resolved), 6 audit log entries, plus wallets.

### Database
Admin login returned 401 because the stored `password_hash` in Supabase was
stale/corrupt. It was reset directly against the database and verified with
`bcrypt.compareSync`.

### Frontend
| Page | Change |
|------|--------|
| Dashboard | Rewritten — user breakdown, content stats, mentorship stats, recent activity |
| Verifications | Shows user email, verification type/tier, avatar initials, rejection reasons |
| FlaggedContent | Fixed field name: `description` (was `content_preview`) |
| Disputes | Fixed field names: `compensation`, `raiser_name` |
| AuditLog | Human-readable actions (`ban_user` → `Ban User`) |
| Sidebar | Replaced 4 duplicate `CogIcon` entries with distinct icons |

---

## 4. Frontend / Routing

| Issue | Root cause | Fix |
|-------|-----------|-----|
| Blank page on refresh | Render static sites do **not** use Netlify-style `_redirects` | Rewrite rule in Render Dashboard: `/*` → `/index.html` (Action: Rewrite) |
| Hydration flicker | No guard | Hydration guard added in `App.jsx` |
| Over-aggressive 401 redirects | Hard redirects on any 401 | Softened handling in `services/api.js` |

---

## 5. Database & Configuration

### Seed scripts
- `backend/src/config/seed-admin.js` — admin panel sample data
- `backend/src/config/seed-safe.js` — idempotent seed (`ON CONFLICT DO NOTHING`)
- `backend/src/config/seed.js` — full demo dataset

### Environment variables (Render Dashboard)

| Key | Value |
|-----|-------|
| `DATABASE_URL` | `postgresql://postgres.<ref>:<password>@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres` |
| `JWT_SECRET` | *(set in dashboard — never committed)* |
| `JWT_EXPIRES_IN` | `7d` |
| `JWT_REFRESH_EXPIRES_IN` | `30d` |
| `FRONTEND_URL` | `https://nextgen-campus-8qib.onrender.com` |
| `CORS_ORIGIN` | `https://nextgen-campus-8qib.onrender.com` |
| `RESEND_API_KEY` | `re_********` *(set in dashboard — never committed)* |
| `EMAIL_FROM` | `onboarding@resend.dev` |
| `GEMINI_API_KEY` | *(set in AI service dashboard)* |

> `.env` files are gitignored. All secrets live only in the Render dashboard.

### Rate limiting variables (optional)
`RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS`, `AUTH_RATE_LIMIT_WINDOW_MS`,
`AUTH_RATE_LIMIT_MAX_ATTEMPTS`

---

## 6. File Upload Module

Four categories, each with its own directory, size limit, and MIME allow-list.
Validation is two-stage: the multer `fileFilter` rejects an undeclared type up
front, then `fileValidation.js` re-checks the extension and the real magic
bytes, so renaming `payload.exe` to `resume.pdf` is still caught.

| Category | Endpoint | Accepts | Max | Post-processing |
|----------|----------|---------|-----|-----------------|
| Avatar | `POST /api/upload/avatar` | JPG, PNG | 5 MB | Resize to 1920w, JPEG q80, 200px thumbnail |
| Resume | `POST /api/upload/resume` | PDF | 10 MB | None (stored as uploaded) |
| Document | `POST /api/upload/document` | JPG, PNG, PDF | 5 MB | Same as avatar |
| Doubt image | `POST /api/upload/doubt-image` | JPG, PNG | 5 MB | Same as avatar |

Follow-up endpoints: `POST /api/upload/avatar/apply` and
`POST /api/upload/resume/apply` attach an uploaded file to the caller's profile
(deleting the file they replaced), and `DELETE /api/upload/:category/:filename`
removes a file.

Uploads are served from `/uploads` as inert content: images render inline with
long-lived cache headers, everything else is forced to `application/octet-stream`
with `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`,
so an uploaded file can never execute in a user's browser.

Rate limited to 10 uploads per 15 minutes per IP.

> **Bug fixed here:** `fileValidation.js` called `FileType.fromBuffer`, the
> `file-type` v16 API. The installed v22 exports `fileTypeFromBuffer`, so every
> upload failed with a 500. File upload was broken on the deployed backend until
> this was corrected.

---

## 7. Payments & Escrow

Escrow guarantees a student is paid for work they have already done: the
company's money leaves its wallet and is held until the work is approved, so
neither side can walk away.

```
application accepted
   -> company funds escrow      (company wallet -> escrow, student sees nothing yet)
   -> student submits a deliverable
   -> company releases           (escrow -> student wallet, total_earned increases)
   or
   -> company refunds            (escrow -> company wallet, student sees nothing)
```

| Endpoint | Role | Purpose |
|----------|------|---------|
| `POST /api/wallet/escrow/:gigId` | company | Fund escrow for an accepted applicant |
| `POST /api/wallet/escrow/:gigId/release` | company | Release held funds to the student |
| `POST /api/wallet/escrow/:gigId/refund` | company | Return funds to the company |
| `GET /api/wallet/escrow` | any | Escrow history for the caller |

Correctness properties this enforces:

- **Escrow is per-application.** `application_id` links the held funds to one
  accepted student, so a company accepting several applicants funds each
  separately. A partial unique index allows only one `locked` escrow per
  application.
- **`student_id` comes from the accepted application**, never from client input.
- **Money moves only inside a transaction.** The gig and wallet rows are locked
  with `FOR UPDATE`, so two concurrent funding requests cannot both succeed.
- **Amounts must be positive** and are capped, enforced by a `CHECK` constraint
  as well as in code. Previously a negative amount credited the company.
- **Release requires submitted work**, so funds cannot be paid out for nothing.
  `force: true` overrides for an admin.
- **Release is idempotent** — a repeat call reports the existing release rather
  than paying twice.
- **Refunded escrow cannot be released**, so money cannot bounce between wallets.

Migrations live in `backend/migrations/` and are applied with
`npm run migrate:up`, which records applied files in `schema_migrations`.

> **Bugs fixed here:** `fundEscrow` never wrote `student_id`, so `releaseEscrow`
> looked up a wallet for `user_id = NULL` and the payout could never happen —
> the flow was dead end to end. The `notification_type` enum also had no
> `escrow_funded` value, which aborted the whole funding transaction.

---

## 8. AI Service

Python + Flask with four scikit-learn models and Gemini API integration.

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Health check |
| `POST /api/generate-doubt-answer` | Gemini-generated doubt answer |
| `POST /api/moderate-content` | Toxicity / spam classification |
| `POST /api/recommend-mentors` | Mentor recommendation (ML) |
| `POST /api/recommend-gigs` | Gig recommendation (TF-IDF + collaborative filtering) |
| `POST /api/predict-gig-success` | Application success probability |
| `POST /api/analyze-resume` | Skill-gap analysis (Gemini) |
| `POST /api/mock-interview` | Interview questions + answer feedback |
| `POST /api/predict-dropout` | Student dropout risk (RandomForest) |
| `POST /api/predict-payment-risk` | Company payment risk |

Models self-heal: each checks `models/saved/*.pkl` and trains a model on
synthetic data at first boot if the file is missing, so no model binaries are
committed to the repo.

> **Note:** Render's free tier spins services down after inactivity. The first
> request can take 30–60 s while the AI service cold-starts.

### Resilience

Every call to the AI service goes through `utils/aiClient.js`, which enforces a
hard timeout and bounded retries. Previously the seven `axios.post` calls had
no timeout at all, so one slow upstream call held an Express request open
indefinitely.

| Concern | Behaviour |
|---------|-----------|
| Timeout | 30 s default, 12 s for the cheap prediction endpoints (`AI_TIMEOUT_MS`, `AI_FAST_TIMEOUT_MS`) |
| Retries | 2 attempts with exponential backoff, only for timeouts, connection errors and 5xx (`AI_MAX_RETRIES`) |
| Throttling | 30 AI requests / 15 min per IP — these endpoints meter a paid API |
| Health | `GET /api/ai/health` reports whether the upstream is reachable |

Degradation is deliberate per endpoint: mentor/gig recommendations and gig
success prediction fall back to SQL, moderation **fails open** so an outage
never blocks a user from posting (flagged `degraded: true` for manual review),
and resume analysis returns a renderable placeholder shape.

---

## 7. Pending Work

| Item | Notes |
|------|-------|
| Chat real-time | Socket.IO exists on both sides but `Chat.jsx` uses REST only |
| DM flow | No direct messages, read receipts, or typing indicators |
| Payments / escrow | Wallet tables exist, no payment gateway |
| Notifications | Partially wired |
| File upload | Partially wired |
| Email verification enforcement | Token is issued but unverified users can still log in |

---

## 8. Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@nextgencampus.com` | `admin123` |
| Student | `sujal@student.com` | `password123` |
| Student | `priya@student.com` | `password123` |
| Student | `rahul@student.com` | `password123` |
| Student | `ananya@student.com` | `password123` |
| Mentor | `mentor1@alumni.com` | `password123` |
| Mentor | `mentor2@alumni.com` | `password123` |
| Mentor | `mentor3@alumni.com` | `password123` |
| Company | `hr@techstartup.com` | `password123` |
| Company | `talent@codecraft.com` | `password123` |

---

## 9. Token Security

All opaque tokens stored in the database are **SHA-256 hashed**, never stored raw.
`hashToken()` is defined once in `authController.js` and used at every storage
and lookup site, so a database leak does not expose usable credentials.

| Table | Column | Hashing |
|-------|--------|---------|
| `user_sessions` | `token_hash` | SHA-256 |
| `user_sessions` | `refresh_token_hash` | SHA-256 |
| `password_resets` | `token_hash` | SHA-256 |
| `verification_tokens` | `token` | SHA-256 |

The raw token is emailed to the user; only the hash is persisted. Logout and
session-expiry checks compare `hashToken(token)` against the stored value, so a
logged-out token is rejected even while its JWT is still cryptographically valid.

### Indexes

`migrations/add_token_indexes.sql` adds indexes on the hashed-token columns
looked up on every authenticated request.

---

## 10. Known Technical Debt

| Issue | Impact |
|-------|--------|
| No rate limiting on `/api/admin/*` | Admin endpoints inherit only the global 500 / 15 min limit |
| Unversioned model endpoints | Harder to evolve later |
| Email verification is not enforced | A verification token is issued and emailed, but an unverified user can still log in |
| Chat is REST-only | Socket.IO is set up server- and client-side but `Chat.jsx` does not use it |

> **Resolved:** email verification is now enforced at login (HTTP 403 with
> `code: EMAIL_NOT_VERIFIED`), and `POST /api/auth/resend-verification` lets an
> unverified user request a fresh link. Both the resend and forgot-password
> responses are non-enumerable, so they cannot be used to discover which
> addresses are registered.
