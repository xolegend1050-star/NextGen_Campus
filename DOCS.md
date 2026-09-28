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
| Payments / Escrow | Not started |

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

## 6. AI Service

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

## 9. Known Technical Debt

| Issue | Impact |
|-------|--------|
| `password_resets.token_hash` stores **raw UUIDs** | Database leak would allow instant account takeover — should be SHA-256 hashed |
| No index on `password_resets.token_hash` | Reset lookups do a full table scan |
| `user_sessions.token_hash` stores **raw JWTs** | Should be hashed, same reason |
| No rate limiting on `/api/admin/*` | Admin endpoints inherit only the global 500/15 min limit |
| Unversioned model endpoints | Harder to evolve later |
