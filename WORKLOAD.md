# WORKLOAD.md — Task Tracker for Hermes & Claude Code

> **RULE**: Read this file before starting ANY work. Update it before and after each task.

---

## Current Status

| Field          | Value                                    |
|----------------|------------------------------------------|
| Sprint         | Module 3 — Student Profile & Portfolio   |
| Active Agent   | —                                        |
| Last Updated   | 2026-08-06                               |
| Blockers       | None                                     |

---

## Active Tasks

| # | Task                | Assigned To | Status      | Files Touched          | Notes                    |
|---|---------------------|-------------|-------------|------------------------|--------------------------|
| — | No active tasks yet | —           | —           | —                      | —                        |

---

## Completed Tasks

### Module 1 — Auth & Role Management (DONE)

| # | Task | Assigned To | Completed | Commit | Notes |
|---|------|-------------|-----------|--------|-------|
| 1 | User registration with roles (student, alumni, company, admin) | Claude | 2026-07 | — | JWT auth, bcrypt password hashing |
| 2 | Login system with email/password | Claude | 2026-07 | — | Access + refresh token flow |
| 3 | Role-based middleware | Claude | 2026-07 | — | authenticate + authorize middleware |
| 4 | OAuth (Google) login | Claude | 2026-07 | — | oauthController.js |
| 5 | Admin seed script | Claude | 2026-07 | — | seed-admin.js |
| 6 | Database schema (users, roles, profiles) | Claude | 2026-07 | — | database.sql with all core tables |
| 7 | Frontend auth pages (Login, Register) | Claude | 2026-07 | — | React + Zustand auth store |
| 8 | Dashboard layout with role-based routing | Claude | 2026-07 | — | DashboardLayout.jsx |
| 9 | Unit tests (62 tests passing) | Claude | 2026-08 | bce9497 | Module 2 unit tests |

### Module 2 — Tiered Verification (DONE)

| # | Task | Assigned To | Completed | Commit | Notes |
|---|------|-------------|-----------|--------|-------|
| 10 | OTP system for all new registrations | Claude | 2026-08 | f10826e | 6-digit code, 5-min expiry, 3 max attempts |
| 11 | skip_otp flag for existing accounts | Claude | 2026-08 | f10826e | 15 existing accounts set to skip_otp=true |
| 12 | 3 accounts forced to require OTP | Claude | 2026-08 | f10826e | xolegend1050, harshitap2003, renukaborhade902 |
| 13 | VerificationController (submit + status) | Claude | 2026-08 | — | 6 verification types |
| 14 | TrustController (scores, history, report) | Claude | 2026-08 | — | 3 tiers: New/Rising/Featured |
| 15 | TrustTiers utility (scoring + decay) | Claude | 2026-08 | — | 2 pts/day decay after 30 days |
| 16 | Verification state machine | Claude | 2026-08 | — | pending→approved/rejected/expired |
| 17 | Email notifications (submitted/approved/rejected) | Claude | 2026-08 | — | 3 email templates |
| 18 | File upload middleware (multer + sharp) | Claude | 2026-08 | — | Image compression + validation |
| 19 | Student Verification page (college email + ID card) | Claude | 2026-08 | — | Frontend |
| 20 | Alumni Verification page (LinkedIn + college ID) | Claude | 2026-08 | — | Frontend |
| 21 | Company Verification page (domain email + GST) | Claude | 2026-08 | — | Frontend |
| 22 | Admin Verifications page (filter, paginate, preview) | Claude | 2026-08 | — | Approve/reject with reason |
| 23 | Auto-ban after 3 company reports | Claude | 2026-08 | — | trustController.js |

### Module 3 — Student Profile & Portfolio (PARTIAL)

| # | Task | Assigned To | Completed | Commit | Notes |
|---|------|-------------|-----------|--------|-------|
| 24 | Profiles DB schema (profiles, experience, projects) | Claude | 2026-08 | — | 3 tables with full columns |
| 25 | Alumni + Company profile tables | Claude | 2026-08 | — | alumni_profiles, company_profiles |
| 26 | ProfileController CRUD (profile, experience, projects, skills) | Claude | 2026-08 | — | 15 backend endpoints |
| 27 | Profile validators (express-validator) | Claude | 2026-08 | — | profile.js |
| 28 | Student Profile page (edit mode, avatar, bio, socials) | Claude | 2026-08 | — | Profile.jsx |
| 29 | ExperienceSection component (add/edit/delete) | Claude | 2026-08 | — | Modal-based CRUD |
| 30 | ProjectsSection component (add/edit/delete) | Claude | 2026-08 | — | Tech tags, live demo + GitHub links |
| 31 | Profile completion tracking (80% threshold) | Claude | 2026-08 | — | getCompletionStatus endpoint |
| 32 | Public profile view (/profile/:userId) | Claude | 2026-08 | — | getPublicProfile endpoint |

---

## Upcoming / Backlog — Module 3 Remaining

| # | Task | Assigned To | Priority | Files to Touch | Notes |
|---|------|-------------|----------|----------------|-------|
| 33 | Resume upload UI | Claude | Medium | Profile.jsx, profileController.js | resume_url field exists in DB, no upload UI |
| 34 | Cover photo upload UI | Claude | Low | Profile.jsx, profileController.js | cover_url field exists in DB, no upload UI |
| 35 | Alumni-specific fields in Profile.jsx | Claude | High | Profile.jsx, profileController.js | Show company, designation, mentorship fields when role=alumni |
| 36 | Company profile edit page | Claude | High | New: CompanyProfile.jsx, profileController.js | company_profiles table exists, no edit UI |
| 37 | Profile search/discovery page | Claude | Medium | New: StudentSearch.jsx, new controller | Browse/search students by skills, college, tier |
| 38 | Profile photo crop/resize UI | Claude | Low | Profile.jsx, upload middleware | Sharp backend exists, no crop UI |
| 39 | Verification badge display on profile | Claude | Medium | Profile.jsx | Show trust tier badge + verification status |
| 40 | Module 3 unit tests | Hermes | High | New: tests/profile.test.js | Test profile CRUD, completion, public view |

---

## Future Modules (Backlog)

| # | Module | Priority | Notes |
|---|--------|----------|-------|
| M4 | Doubt Forum | High | doubtController.js exists, needs frontend |
| M5 | Mentorship Booking | High | mentorshipController.js exists, needs frontend |
| M6 | Gigs / Freelance | Medium | gigController.js exists, needs frontend |
| M7 | Social Feed / Follow | Medium | followController.js exists, needs frontend |
| M8 | Real-time Chat | Low | chatController.js exists, needs frontend |
| M9 | AI Career Guidance | Low | aiController.js exists, needs frontend |
| M10 | Resource Library | Low | resourceController.js exists, needs frontend |

---

## Decisions Log

| Date | Decision | Made By |
|------|----------|---------|
| 2026-08-06 | Use AGENT.md + WORKLOAD.md for collab | Boss |
| 2026-08-06 | OTP for ALL new accounts, skip_otp for existing | Boss |
| 2026-08-06 | 3 specific accounts forced to require OTP | Boss |
| 2026-08-06 | Supabase (PostgreSQL) for database hosting | Boss |
| 2026-08-06 | Render for backend hosting (auto-deploy on push) | Boss |

---

## Blockers

| # | Issue | Reported By | Status |
|---|-------|-------------|--------|
| — | None | — | — |

---

*This file is the single source of truth. If it's not in here, it didn't happen.*
