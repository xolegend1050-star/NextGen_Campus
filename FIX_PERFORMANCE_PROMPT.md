# Fix Slow Page Load Performance — NextGen Campus

## Project Directory
`C:\Users\sujal\NextGen_Campus`

## Tech Stack
- Frontend: React + Vite + Zustand + Axios (port 3000)
- Backend: Node.js + Express (port 5000)
- Database: PostgreSQL (Supabase, remote)
- AI Service: Python Flask (port 5001, currently down)

## Problem
Pages load slowly (perceived 2-4 second delays). API performance testing shows ALL backend endpoints respond in under 0.5s. The bottleneck is on the **frontend side** — API calls are being made sequentially instead of in parallel, and there is an N+1 database query issue in one controller.

---

## FIX 1 (HIGH PRIORITY): Dashboard — Serial API Calls
**File:** `frontend/src/pages/student/Dashboard.jsx`

The Dashboard page fires multiple API calls in sequence using separate `await` statements. Each one waits for the previous to finish before starting.

**What to fix:**
1. Find all `api.get()` calls inside `useEffect` or fetch functions
2. Wrap them all in a single `Promise.all()` so they fire in parallel
3. Destructure results from the Promise.all array

**Before (bad):**
```js
const res1 = await api.get('/analytics/student/' + user.id);
const res2 = await api.get('/ai/recommend-gigs');
const res3 = await api.get('/doubts?limit=5');
```

**After (good):**
```js
const [analyticsRes, gigsRes, doubtsRes] = await Promise.all([
  api.get('/analytics/student/' + user.id),
  api.get('/ai/recommend-gigs').catch(() => ({ data: {} })),
  api.get('/doubts?limit=5')
]);
```

Note: Add `.catch(() => ({ data: {} }))` on non-critical calls so one failure doesn't block everything.

---

## FIX 2 (HIGH PRIORITY): Profile — Serial API Calls
**File:** `frontend/src/pages/student/Profile.jsx`

The Profile page fires 5+ API calls to load profile data, experience, projects, badges, and verification status.

**What to fix:**
1. Find the `useEffect` or fetch function that loads profile data
2. Wrap all `api.get()` calls in `Promise.all()`
3. Handle each result separately

**Should look like:**
```js
const [profileRes, badgesRes, expRes, projRes, verifRes] = await Promise.all([
  api.get('/auth/me'),
  api.get('/auth/me/badges'),
  api.get('/profiles/me/experience'),
  api.get('/profiles/me/projects'),
  api.get('/verification/status')
]);
```

---

## FIX 3 (MEDIUM PRIORITY): Doubts List — N+1 Subquery
**File:** `backend/src/controllers/doubts/doubtController.js`

The `getAllDoubts` function (around line 18-28) uses a correlated subquery to count answers per doubt:
```sql
(SELECT COUNT(*) FROM doubt_answers WHERE doubt_id = d.id) as answer_count
```
This runs a separate COUNT query for EVERY row in the results. With 20 doubts, that's 20 extra queries inside one query.

**What to fix:**
Replace the correlated subquery with a LEFT JOIN subquery:

**Before:**
```sql
SELECT d.*, 
       u.email as author_email,
       p.full_name as author_name,
       (SELECT COUNT(*) FROM doubt_answers WHERE doubt_id = d.id) as answer_count
FROM doubts d
JOIN users u ON d.author_id = u.id
LEFT JOIN profiles p ON u.id = p.user_id
```

**After:**
```sql
SELECT d.*, 
       u.email as author_email,
       p.full_name as author_name,
       p.avatar_url as author_avatar,
       p.trust_score as author_trust_score,
       COALESCE(ac.answer_count, 0) as answer_count
FROM doubts d
JOIN users u ON d.author_id = u.id
LEFT JOIN profiles p ON u.id = p.user_id
LEFT JOIN (
  SELECT doubt_id, COUNT(*) as answer_count 
  FROM doubt_answers 
  GROUP BY doubt_id
) ac ON ac.doubt_id = d.id
```

Apply the same fix to the `sort = 'unanswered'` case on line 68 which also uses a correlated subquery in ORDER BY:
```sql
ORDER BY (SELECT COUNT(*) FROM doubt_answers WHERE doubt_id = d.id) ASC
```
Replace with:
```sql
ORDER BY COALESCE(ac.answer_count, 0) ASC
```

---

## FIX 4 (LOW PRIORITY): Completion Status — Unnecessary Write on Read
**File:** `backend/src/controllers/profile/profileController.js`

The `getCompletionStatus` function (line 434-477) runs an `UPDATE` query every time it's called, even though it's a GET/read endpoint.

**What to fix:**
Remove the UPDATE query at lines 468-471:
```js
// REMOVE THIS:
await db.query(
  'UPDATE profiles SET is_profile_complete = $1 WHERE user_id = $2',
  [completion >= 80, req.user.id]
);
```
Just compute and return the completion percentage. If you need to persist it, do it only when the profile is actually updated (in `updateProfile`).

---

## FIX 5 (LOW PRIORITY): Auth Me Badges — Check for Sequential Calls
**File:** `frontend/src/pages/student/Profile.jsx`

Verify that `GET /auth/me` and `GET /auth/me/badges` are called in parallel, not sequentially. These are independent calls.

---

## Additional Checks
1. Check ALL `useEffect` hooks across these files for sequential `await api.get()` patterns:
   - `frontend/src/pages/student/Dashboard.jsx`
   - `frontend/src/pages/student/Profile.jsx`
   - `frontend/src/pages/student/Doubts.jsx`
   - `frontend/src/pages/student/Gigs.jsx`
   - `frontend/src/pages/student/Mentors.jsx`
   - `frontend/src/pages/company/Dashboard.jsx`
   - `frontend/src/pages/mentor/Dashboard.jsx`
   - `frontend/src/pages/admin/Dashboard.jsx`

2. In any file where 2+ independent API calls are awaited separately, wrap them in `Promise.all()`.

3. For API calls that are NOT critical to page render (like badges, analytics), add `.catch(() => ({ data: {} }))` so failure doesn't block the UI.

---

## Testing
After making fixes, restart the backend (`node src/server.js`) and test by:
1. Opening browser DevTools Network tab
2. Navigating to Dashboard
3. Checking that API calls fire in parallel (overlapping in timeline) instead of sequentially
4. Measuring total page load time improvement

## Expected Results
- Dashboard load: ~1.5s → ~0.5s (3x faster)
- Profile load: ~2.2s → ~0.5s (4x faster)
- Doubts list with 20 items: ~0.8s → ~0.3s (2.5x faster)
