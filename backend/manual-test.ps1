$BASE = "http://localhost:5000"
$headers = @{}
$studentToken = ""
$studentId = ""
$mentorToken = ""
$companyToken = ""
$adminToken = ""
$pass = 0
$fail = 0
$total = 0

function Test-Feature {
    param([string]$name, [string]$method, [string]$url, $body, [string]$token, [int]$expectStatus)
    $script:total++
    $h = @{}
    if ($token) { $h["Authorization"] = "Bearer $token" }
    $h["Content-Type"] = "application/json"
    try {
        $params = @{ Uri = $url; Method = $method; Headers = $h; ErrorAction = "Stop" }
        if ($body) { $params["Body"] = $body }
        $r = Invoke-RestMethod @params
        $status = 200
        if ($status -eq $expectStatus) {
            $script:pass++
            Write-Host "  PASS $name" -ForegroundColor Green
        } else {
            $script:fail++
            Write-Host "  FAIL $name (expected $expectStatus, got $status)" -ForegroundColor Red
        }
        return $r
    } catch {
        $status = $_.Exception.Response.StatusCode.value__
        if ($status -eq $expectStatus) {
            $script:pass++
            Write-Host "  PASS $name (status $status)" -ForegroundColor Green
        } else {
            $script:fail++
            Write-Host "  FAIL $name (expected $expectStatus, got $status) - $($_.ErrorDetails.Message)" -ForegroundColor Red
        }
        return $null
    }
}

# ============================================
Write-Host "`n========== 1. REGISTER ==========" -ForegroundColor Cyan
$regBody = @{ email="demo2026@student.com"; password="DemoPass123"; role="student"; full_name="Manual Test Student"; city="Mumbai"; college_name="Thakur College of Science and Commerce" } | ConvertTo-Json
$r = Test-Feature "Register new student" "POST" "$BASE/api/auth/register" $regBody "" 201
if ($r) {
    $studentToken = $r.token
    $studentRefresh = $r.refreshToken
    $studentId = $r.user.id
    Write-Host "  -> User ID: $($r.user.id)" -ForegroundColor DarkGray
    Write-Host "  -> Role: $($r.user.role)" -ForegroundColor DarkGray
}

# ============================================
Write-Host "`n========== 2. LOGIN ==========" -ForegroundColor Cyan
$loginBody = @{ email="demo2026@student.com"; password="DemoPass123" } | ConvertTo-Json
$r = Test-Feature "Login as student" "POST" "$BASE/api/auth/login" $loginBody "" 200
if ($r) {
    $studentToken = $r.token
    Write-Host "  -> Token received" -ForegroundColor DarkGray
    Write-Host "  -> User: $($r.user.email)" -ForegroundColor DarkGray
}

# ============================================
Write-Host "`n========== 3. GET /me ==========" -ForegroundColor Cyan
$r = Test-Feature "Get current user" "GET" "$BASE/api/auth/me" $null $studentToken 200
if ($r) {
    Write-Host "  -> Name: $($r.user.full_name)" -ForegroundColor DarkGray
    Write-Host "  -> Email: $($r.user.email)" -ForegroundColor DarkGray
    Write-Host "  -> Trust Score: $($r.user.trust_score)" -ForegroundColor DarkGray
}

# ============================================
Write-Host "`n========== 4. PROFILES ==========" -ForegroundColor Cyan
$r = Test-Feature "Get my profile" "GET" "$BASE/api/profiles/me" $null $studentToken 200
if ($r) {
    Write-Host "  -> Full Name: $($r.profile.full_name)" -ForegroundColor DarkGray
    Write-Host "  -> City: $($r.profile.city)" -ForegroundColor DarkGray
}

$updateBody = @{ bio="Full Stack Developer | Mumbai | Building cool things"; skills=@("JavaScript","React","Node.js","Python") } | ConvertTo-Json
$r = Test-Feature "Update my profile" "PUT" "$BASE/api/profiles/me" $updateBody $studentToken 200
if ($r) {
    Write-Host "  -> Updated bio: $($r.profile.bio)" -ForegroundColor DarkGray
}

# Login as mentor and company to get their IDs
$mLogin = @{ email="mentor1@alumni.com"; password="password123" } | ConvertTo-Json
$mr = Invoke-RestMethod -Uri "$BASE/api/auth/login" -Method POST -Body $mLogin -ContentType "application/json"
$mentorToken = $mr.token
Write-Host "  -> Mentor logged in: $($mr.user.email)" -ForegroundColor DarkGray

$cLogin = @{ email="hr@techstartup.com"; password="password123" } | ConvertTo-Json
$cr = Invoke-RestMethod -Uri "$BASE/api/auth/login" -Method POST -Body $cLogin -ContentType "application/json"
$companyToken = $cr.token
Write-Host "  -> Company logged in: $($cr.user.email)" -ForegroundColor DarkGray

$aLogin = @{ email="admin@nextgencampus.com"; password="admin123" } | ConvertTo-Json
$ar = Invoke-RestMethod -Uri "$BASE/api/auth/login" -Method POST -Body $aLogin -ContentType "application/json"
$adminToken = $ar.token
Write-Host "  -> Admin logged in: $($ar.user.email)" -ForegroundColor DarkGray

# Get public profile (use mentor's ID)
$r = Test-Feature "Get public profile by ID" "GET" "$BASE/api/profiles/$($mr.user.id)" $null $studentToken 200
if ($r) {
    Write-Host "  -> Name: $($r.profile.full_name)" -ForegroundColor DarkGray
    Write-Host "  -> Role: $($r.profile.role)" -ForegroundColor DarkGray
}

# ============================================
Write-Host "`n========== 5. REFRESH TOKEN ==========" -ForegroundColor Cyan
$refreshBody = @{ refreshToken = $studentRefresh } | ConvertTo-Json
$r = Test-Feature "Refresh token" "POST" "$BASE/api/auth/refresh" $refreshBody "" 200
if ($r) {
    $studentToken = $r.token
    Write-Host "  -> New token received" -ForegroundColor DarkGray
}

# ============================================
Write-Host "`n========== 6. DOUBTS ==========" -ForegroundColor Cyan
$doubtBody = @{ title="Manual Test: How does JavaScript event loop work in depth?"; content="I want to understand the complete event loop mechanism including microtasks and macrotasks in JavaScript engines."; tags=@("javascript","event-loop","async"); subject="Programming" } | ConvertTo-Json
$r = Test-Feature "Create a doubt" "POST" "$BASE/api/doubts" $doubtBody $studentToken 201
$doubtId = ""
if ($r) {
    $doubtId = $r.doubt.id
    Write-Host "  -> Doubt ID: $doubtId" -ForegroundColor DarkGray
    Write-Host "  -> Title: $($r.doubt.title)" -ForegroundColor DarkGray
    Write-Host "  -> AI Draft: $(if($r.doubt.ai_draft_answer){'Yes'}else{'No (pending)'})" -ForegroundColor DarkGray
}

$r = Test-Feature "List all doubts" "GET" "$BASE/api/doubts" $null $studentToken 200
if ($r) {
    Write-Host "  -> Found $($r.doubts.Count) doubts" -ForegroundColor DarkGray
    Write-Host "  -> Total: $($r.pagination.total)" -ForegroundColor DarkGray
}

if ($doubtId) {
    $r = Test-Feature "Get doubt by ID" "GET" "$BASE/api/doubts/$doubtId" $null $studentToken 200
    if ($r) { Write-Host "  -> Title: $($r.doubt.title)" -ForegroundColor DarkGray }

    $answerBody = @{ content="The event loop continuously checks the call stack. When empty, it checks the microtask queue first (Promises), then macrotasks (setTimeout, setInterval). This ensures async operations are handled in the correct order." } | ConvertTo-Json
    $r = Test-Feature "Answer the doubt" "POST" "$BASE/api/doubts/$doubtId/answers" $answerBody $studentToken 201
    if ($r) { Write-Host "  -> Answer ID: $($r.answer.id)" -ForegroundColor DarkGray }

    $r = Test-Feature "Get doubt answers" "GET" "$BASE/api/doubts/$doubtId/answers" $null $studentToken 200
    if ($r) { Write-Host "  -> Found $($r.answers.Count) answers" -ForegroundColor DarkGray }

    $voteBody = @{ vote_type=1 } | ConvertTo-Json
    $r = Test-Feature "Upvote the doubt" "POST" "$BASE/api/doubts/$doubtId/vote" $voteBody $studentToken 200
    if ($r) { Write-Host "  -> $($r.message)" -ForegroundColor DarkGray }

    $r = Test-Feature "Search doubts" "GET" "$BASE/api/doubts?search=event+loop" $null $studentToken 200
    if ($r) { Write-Host "  -> Found $($r.doubts.Count) results" -ForegroundColor DarkGray }

    $r = Test-Feature "Filter by subject" "GET" "$BASE/api/doubts?subject=Programming" $null $studentToken 200
}

# ============================================
Write-Host "`n========== 7. GIGS ==========" -ForegroundColor Cyan
$r = Test-Feature "List all gigs" "GET" "$BASE/api/gigs" $null $studentToken 200
if ($r) { Write-Host "  -> Found $($r.gigs.Count) gigs" -ForegroundColor DarkGray }

$gigBody = @{ title="Manual Test: React Native Developer"; description="Build a cross-platform mobile app for campus networking with React Native and Firebase backend integration."; skills_required=@("React Native","Firebase","JavaScript"); compensation=15000; duration_days=30; is_remote=$true; category="Mobile Development"; application_deadline=(Get-Date).AddDays(14).ToString("yyyy-MM-ddTHH:mm:ss.fffZ") } | ConvertTo-Json
$r = Test-Feature "Post a gig (company)" "POST" "$BASE/api/gigs" $gigBody $companyToken 201
$gigId = ""
if ($r) {
    $gigId = $r.gig.id
    Write-Host "  -> Gig ID: $gigId" -ForegroundColor DarkGray
    Write-Host "  -> Title: $($r.gig.title)" -ForegroundColor DarkGray
    Write-Host "  -> Compensation: $($r.gig.compensation)" -ForegroundColor DarkGray
}

if ($gigId) {
    $r = Test-Feature "Get gig by ID" "GET" "$BASE/api/gigs/$gigId" $null $studentToken 200
    if ($r) { Write-Host "  -> Title: $($r.gig.title)" -ForegroundColor DarkGray }

    $applyBody = @{ cover_letter="I am a skilled React Native developer with 2 years of experience building mobile apps." } | ConvertTo-Json
    $r = Test-Feature "Apply for gig (student)" "POST" "$BASE/api/gigs/$gigId/apply" $applyBody $studentToken 201
    if ($r) {
        Write-Host "  -> Application ID: $($r.application.id)" -ForegroundColor DarkGray
        Write-Host "  -> Status: $($r.application.status)" -ForegroundColor DarkGray
    }

    $r = Test-Feature "My applications (student)" "GET" "$BASE/api/gigs/my-applications" $null $studentToken 200
    if ($r) { Write-Host "  -> Found $($r.applications.Count) applications" -ForegroundColor DarkGray }

    $r = Test-Feature "Gig applications (company)" "GET" "$BASE/api/gigs/$gigId/applications" $null $companyToken 200
    if ($r) { Write-Host "  -> Found $($r.applications.Count) applications" -ForegroundColor DarkGray }

    $updateGigBody = @{ title="Manual Test: Senior React Native Developer" } | ConvertTo-Json
    $r = Test-Feature "Update gig (company)" "PUT" "$BASE/api/gigs/$gigId" $updateGigBody $companyToken 200
    if ($r) { Write-Host "  -> Updated title: $($r.gig.title)" -ForegroundColor DarkGray }
}

# ============================================
Write-Host "`n========== 8. WALLET ==========" -ForegroundColor Cyan
$r = Test-Feature "Get wallet" "GET" "$BASE/api/wallet" $null $studentToken 200
if ($r) {
    Write-Host "  -> Balance: $($r.wallet.balance)" -ForegroundColor DarkGray
    Write-Host "  -> Frozen: $($r.wallet.frozen_amount)" -ForegroundColor DarkGray
}

$r = Test-Feature "Get wallet transactions" "GET" "$BASE/api/wallet/transactions" $null $studentToken 200
if ($r) { Write-Host "  -> Found $($r.transactions.Count) transactions" -ForegroundColor DarkGray }

# ============================================
Write-Host "`n========== 9. NOTIFICATIONS ==========" -ForegroundColor Cyan
$r = Test-Feature "Get notifications" "GET" "$BASE/api/notifications" $null $studentToken 200
if ($r) { Write-Host "  -> Found $($r.notifications.Count) notifications" -ForegroundColor DarkGray }

# ============================================
Write-Host "`n========== 10. TRUST SCORE ==========" -ForegroundColor Cyan
$r = Test-Feature "Get trust score" "GET" "$BASE/api/trust/my-score" $null $studentToken 200
if ($r) {
    Write-Host "  -> Score: $($r.trustScore)" -ForegroundColor DarkGray
    Write-Host "  -> Tier: $($r.tier)" -ForegroundColor DarkGray
    Write-Host "  -> Breakdown: Doubts=$($r.breakdown.doubts), Answers=$($r.breakdown.answers), Gigs=$($r.breakdown.gigs)" -ForegroundColor DarkGray
}

# ============================================
Write-Host "`n========== 11. BADGES ==========" -ForegroundColor Cyan
$r = Test-Feature "Get my badges" "GET" "$BASE/api/badges/my-badges" $null $studentToken 200
if ($r) { Write-Host "  -> Found $($r.badges.Count) badges" -ForegroundColor DarkGray }

# ============================================
Write-Host "`n========== 12. CHAT ==========" -ForegroundColor Cyan
$r = Test-Feature "Get conversations" "GET" "$BASE/api/chat/conversations" $null $studentToken 200
if ($r) { Write-Host "  -> Found $($r.conversations.Count) conversations" -ForegroundColor DarkGray }

# ============================================
Write-Host "`n========== 13. RESOURCES ==========" -ForegroundColor Cyan
$r = Test-Feature "Get resources" "GET" "$BASE/api/resources" $null $studentToken 200
if ($r) { Write-Host "  -> Found $($r.resources.Count) resources" -ForegroundColor DarkGray }

# ============================================
Write-Host "`n========== 14. VERIFICATION ==========" -ForegroundColor Cyan
$r = Test-Feature "Get verification status" "GET" "$BASE/api/verification/status" $null $studentToken 200
if ($r) { Write-Host "  -> Status: $($r | ConvertTo-Json -Compress)" -ForegroundColor DarkGray }

# ============================================
Write-Host "`n========== 15. AI FEATURES ==========" -ForegroundColor Cyan
$r = Test-Feature "AI: Gig recommendations" "GET" "$BASE/api/ai/recommend-gigs" $null $studentToken 200
if ($r) { Write-Host "  -> Found $($r.gigs.Count) recommended gigs" -ForegroundColor DarkGray }

$r = Test-Feature "AI: Mentor recommendations" "GET" "$BASE/api/ai/recommend-mentors" $null $studentToken 200
if ($r) { Write-Host "  -> Found $($r.mentors.Count) recommended mentors" -ForegroundColor DarkGray }

$draftBody = @{ doubt_id=$doubtId } | ConvertTo-Json
$r = Test-Feature "AI: Draft answer" "POST" "$BASE/api/ai/draft-answer" $draftBody $studentToken 200
if ($r) {
    if ($r.answer) { Write-Host "  -> Draft: $($r.answer.Substring(0,80))..." -ForegroundColor DarkGray }
    else { Write-Host "  -> Response: $($r | ConvertTo-Json -Compress)" -ForegroundColor DarkGray }
}

# ============================================
Write-Host "`n========== 16. MENTOR FEATURES ==========" -ForegroundColor Cyan
$r = Test-Feature "Mentor: Get requests" "GET" "$BASE/api/mentorship/requests" $null $mentorToken 200
if ($r) { Write-Host "  -> Found $($r.requests.Count) mentorship requests" -ForegroundColor DarkGray }

$r = Test-Feature "Mentor: Get sessions" "GET" "$BASE/api/mentorship/sessions" $null $mentorToken 200
if ($r) { Write-Host "  -> Found $($r.sessions.Count) sessions" -ForegroundColor DarkGray }

# ============================================
Write-Host "`n========== 17. ADMIN FEATURES ==========" -ForegroundColor Cyan
$r = Test-Feature "Admin: Dashboard" "GET" "$BASE/api/admin/dashboard" $null $adminToken 200
if ($r) {
    if ($r.stats) { Write-Host "  -> Stats: $($r.stats | ConvertTo-Json -Compress)" -ForegroundColor DarkGray }
    else { Write-Host "  -> Users: $($r.totalUsers), Doubts: $($r.totalDoubts)" -ForegroundColor DarkGray }
}

$r = Test-Feature "Admin: List users" "GET" "$BASE/api/admin/users" $null $adminToken 200
if ($r) { Write-Host "  -> Found $($r.users.Count) users" -ForegroundColor DarkGray }

$r = Test-Feature "Admin: Verifications" "GET" "$BASE/api/admin/verifications" $null $adminToken 200
if ($r) { Write-Host "  -> Response received" -ForegroundColor DarkGray }

# ============================================
Write-Host "`n========== 18. PUBLIC ROUTES ==========" -ForegroundColor Cyan
$r = Test-Feature "Swagger docs" "GET" "$BASE/api-docs/" $null "" 200
$r = Test-Feature "Health check" "GET" "$BASE/health" $null "" 200

# ============================================
Write-Host "`n========== 19. DELETE GIG (cleanup) ==========" -ForegroundColor Cyan
if ($gigId) {
    $r = Test-Feature "Delete gig (company)" "DELETE" "$BASE/api/gigs/$gigId" $null $companyToken 200
    if ($r) { Write-Host "  -> $($r.message)" -ForegroundColor DarkGray }
}

# ============================================
Write-Host "`n========== RESULTS ==========" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Total: $($pass + $fail)" -ForegroundColor White
Write-Host "  PASS:  $pass" -ForegroundColor Green
Write-Host "  FAIL:  $fail" -ForegroundColor $(if($fail -gt 0){"Red"}else{"Green"})
Write-Host "  Pass Rate: $(($pass/($pass+$fail)*100).ToString('F1'))%" -ForegroundColor $(if($fail -eq 0){"Green"}else{"Yellow"})
if ($fail -eq 0) {
    Write-Host "`n  ALL FEATURES WORKING!" -ForegroundColor Green
}
