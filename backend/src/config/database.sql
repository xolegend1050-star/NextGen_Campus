-- =====================================================
-- NextGen Campus - Complete PostgreSQL Database Schema
-- All 16 Modules | Tier 2/3 Student Platform
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- MODULE 1: AUTHENTICATION & ROLE MANAGEMENT
-- =====================================================

CREATE TYPE user_role AS ENUM ('student', 'alumni', 'company', 'admin');
CREATE TYPE auth_provider AS ENUM ('email', 'google', 'github');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    role user_role NOT NULL DEFAULT 'student',
    auth_provider auth_provider DEFAULT 'email',
    provider_id VARCHAR(255),
    is_email_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    is_banned BOOLEAN DEFAULT FALSE,
    ban_reason TEXT,
    skip_otp BOOLEAN DEFAULT FALSE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    refresh_token_hash VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE password_resets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- LOGIN OTP VERIFICATION (Company accounts only)
-- =====================================================

CREATE TABLE login_otps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    otp_code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_login_otps_user ON login_otps(user_id);
CREATE INDEX idx_login_otps_code ON login_otps(otp_code);

-- =====================================================
-- MODULE 2: TIERED VERIFICATION MODULE
-- =====================================================

CREATE TYPE verification_tier AS ENUM ('tier1_auto', 'tier2_manual');
CREATE TYPE verification_status AS ENUM ('pending', 'approved', 'rejected', 'expired');
CREATE TYPE verification_type AS ENUM ('student_college_email', 'student_id_card', 'alumni_linkedin', 'alumni_college_id', 'company_domain', 'company_gst');

CREATE TABLE verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    verification_type verification_type NOT NULL,
    tier verification_tier NOT NULL,
    status verification_status DEFAULT 'pending',
    document_url VARCHAR(500),
    document_type VARCHAR(50),
    metadata JSONB DEFAULT '{}',
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE verification_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    verification_type verification_type NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- MODULE 3: STUDENT PROFILE & PORTFOLIO
-- =====================================================

CREATE TYPE talent_tier AS ENUM ('new', 'rising', 'featured');

CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(500),
    cover_url VARCHAR(500),
    bio TEXT,
    phone VARCHAR(20),
    date_of_birth DATE,
    gender VARCHAR(20),
    city VARCHAR(100),
    state VARCHAR(100),
    college_name VARCHAR(255),
    college_city VARCHAR(100),
    course VARCHAR(255),
    year_of_study INTEGER,
    graduation_year INTEGER,
    skills TEXT[] DEFAULT '{}',
    interests TEXT[] DEFAULT '{}',
    linkedin_url VARCHAR(500),
    github_url VARCHAR(500),
    portfolio_url VARCHAR(500),
    resume_url VARCHAR(500),
    trust_score DECIMAL(5,2) DEFAULT 0.00,
    talent_tier talent_tier DEFAULT 'new',
    is_profile_complete BOOLEAN DEFAULT FALSE,
    visibility_settings JSONB DEFAULT '{"city": true, "college": true}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE profile_experience (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    company_name VARCHAR(255),
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE,
    is_current BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE profile_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    project_url VARCHAR(500),
    github_url VARCHAR(500),
    technologies TEXT[] DEFAULT '{}',
    image_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Alumni specific
CREATE TABLE alumni_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    graduation_year INTEGER NOT NULL,
    current_company VARCHAR(255),
    current_designation VARCHAR(255),
    years_of_experience INTEGER,
    mentoring_available BOOLEAN DEFAULT TRUE,
    max_mentees INTEGER DEFAULT 5,
    mentorship_areas TEXT[] DEFAULT '{}',
    linkedin_verified BOOLEAN DEFAULT FALSE,
    company_email VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Company specific
CREATE TABLE company_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    logo_url VARCHAR(500),
    website_url VARCHAR(500),
    description TEXT,
    industry VARCHAR(255),
    company_size VARCHAR(50),
    founded_year INTEGER,
    headquarters_city VARCHAR(100),
    headquarters_state VARCHAR(100),
    gst_number VARCHAR(20),
    linkedin_url VARCHAR(500),
    is_verified BOOLEAN DEFAULT FALSE,
    trust_score DECIMAL(5,2) DEFAULT 0.00,
    payment_cap DECIMAL(10,2) DEFAULT 5000.00,
    requires_escrow BOOLEAN DEFAULT TRUE,
    total_gigs_posted INTEGER DEFAULT 0,
    total_students_hired INTEGER DEFAULT 0,
    average_rating DECIMAL(3,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- MODULE 4: PEER & AI DOUBT-SOLVING FORUM
-- =====================================================

CREATE TYPE doubt_status AS ENUM ('open', 'answered', 'closed', 'flagged');
CREATE TYPE answer_source AS ENUM ('peer', 'ai_draft', 'verified_senior');

CREATE TABLE doubts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    subject VARCHAR(255),
    topic VARCHAR(255),
    status doubt_status DEFAULT 'open',
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0,
    is_flagged BOOLEAN DEFAULT FALSE,
    flag_reason TEXT,
    ai_draft_answer TEXT,
    ai_draft_generated_at TIMESTAMP WITH TIME ZONE,
    accepted_answer_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE doubt_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doubt_id UUID NOT NULL REFERENCES doubts(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    source answer_source DEFAULT 'peer',
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    is_accepted BOOLEAN DEFAULT FALSE,
    is_flagged BOOLEAN DEFAULT FALSE,
    flag_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE doubt_votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    doubt_id UUID REFERENCES doubts(id) ON DELETE CASCADE,
    answer_id UUID REFERENCES doubt_answers(id) ON DELETE CASCADE,
    vote_type INTEGER NOT NULL CHECK (vote_type IN (-1, 1)),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, doubt_id),
    UNIQUE(user_id, answer_id)
);

CREATE TABLE doubt_bookmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    doubt_id UUID NOT NULL REFERENCES doubts(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, doubt_id)
);

-- =====================================================
-- MODULE 5: AI MENTOR MATCHING & BOOKING
-- =====================================================

CREATE TYPE mentorship_status AS ENUM ('pending', 'accepted', 'rejected', 'completed', 'cancelled');
CREATE TYPE session_status AS ENUM ('scheduled', 'ongoing', 'completed', 'cancelled', 'no_show');
CREATE TYPE session_type AS ENUM ('chat', 'video', 'in_person');

CREATE TABLE mentorship_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mentor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT,
    status mentorship_status DEFAULT 'pending',
    ai_match_score DECIMAL(5,2),
    match_reasons TEXT[] DEFAULT '{}',
    student_goals TEXT,
    preferred_session_type session_type DEFAULT 'chat',
    responded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE mentorship_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES mentorship_requests(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id),
    mentor_id UUID NOT NULL REFERENCES users(id),
    session_type session_type NOT NULL,
    status session_status DEFAULT 'scheduled',
    scheduled_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,
    meeting_link VARCHAR(500),
    notes TEXT,
    student_attended BOOLEAN DEFAULT FALSE,
    mentor_attended BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE mentor_availability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mentor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE mentor_expertise (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mentor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill VARCHAR(255) NOT NULL,
    proficiency_level INTEGER DEFAULT 3 CHECK (proficiency_level BETWEEN 1 AND 5),
    years_experience INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(mentor_id, skill)
);

-- =====================================================
-- MODULE 6: CHAT & VIDEO COMMUNICATION
-- =====================================================

CREATE TYPE conversation_type AS ENUM ('mentorship', 'gig', 'dispute', 'general');

CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type conversation_type NOT NULL,
    title VARCHAR(255),
    related_request_id UUID,
    related_gig_id UUID,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE conversation_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_muted BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(conversation_id, user_id)
);

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT,
    message_type VARCHAR(20) DEFAULT 'text',
    file_url VARCHAR(500),
    file_name VARCHAR(255),
    file_size INTEGER,
    is_edited BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    read_by UUID[] DEFAULT '{}',
    ai_moderated BOOLEAN DEFAULT FALSE,
    moderation_flag VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE chat_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    reported_by UUID NOT NULL REFERENCES users(id),
    reason VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- MODULE 7: GIG & MICRO-INTERNSHIP POSTING
-- =====================================================

CREATE TYPE gig_status AS ENUM ('draft', 'open', 'in_review', 'in_progress', 'completed', 'cancelled', 'disputed');
CREATE TYPE application_status AS ENUM ('pending', 'shortlisted', 'accepted', 'rejected', 'withdrawn');

CREATE TABLE gigs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    requirements TEXT,
    skills_required TEXT[] DEFAULT '{}',
    category VARCHAR(100),
    subcategory VARCHAR(100),
    gig_type VARCHAR(50) DEFAULT 'micro_internship',
    duration_days INTEGER,
    max_students INTEGER DEFAULT 1,
    compensation DECIMAL(10,2) NOT NULL,
    is_escrow_required BOOLEAN DEFAULT TRUE,
    status gig_status DEFAULT 'draft',
    is_remote BOOLEAN DEFAULT TRUE,
    location VARCHAR(255),
    application_deadline TIMESTAMP WITH TIME ZONE,
    start_date DATE,
    end_date DATE,
    total_applications INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT FALSE,
    ai_match_threshold DECIMAL(5,2) DEFAULT 50.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE gig_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gig_id UUID NOT NULL REFERENCES gigs(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cover_letter TEXT,
    resume_url VARCHAR(500),
    status application_status DEFAULT 'pending',
    ai_match_score DECIMAL(5,2),
    match_reasons TEXT[] DEFAULT '{}',
    company_notes TEXT,
    shortlisted_at TIMESTAMP WITH TIME ZONE,
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(gig_id, student_id)
);

CREATE TABLE gig_deliverables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gig_id UUID NOT NULL REFERENCES gigs(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    file_url VARCHAR(500),
    file_name VARCHAR(255),
    status VARCHAR(20) DEFAULT 'submitted',
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    feedback TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- MODULE 8: AI GIG RECOMMENDATION & APPLICATION
-- =====================================================

CREATE TABLE gig_recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    gig_id UUID NOT NULL REFERENCES gigs(id) ON DELETE CASCADE,
    match_score DECIMAL(5,2) NOT NULL,
    match_reasons TEXT[] DEFAULT '{}',
    skill_gaps TEXT[] DEFAULT '{}',
    prediction_confidence DECIMAL(5,2),
    is_viewed BOOLEAN DEFAULT FALSE,
    is_applied BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, gig_id)
);

CREATE TABLE student_skill_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill VARCHAR(255) NOT NULL,
    proficiency_level INTEGER DEFAULT 3 CHECK (proficiency_level BETWEEN 1 AND 5),
    evidence_type VARCHAR(50),
    evidence_id UUID,
    confidence_score DECIMAL(5,2),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, skill)
);

-- =====================================================
-- MODULE 9: ESCROW WALLET & PAYMENT
-- =====================================================

CREATE TYPE wallet_transaction_type AS ENUM (
    'credit', 'debit', 'escrow_lock', 'escrow_unlock',
    'escrow_release', 'withdrawal', 'refund', 'dispute_hold'
);

CREATE TYPE wallet_transaction_status AS ENUM ('pending', 'completed', 'failed', 'cancelled');

CREATE TYPE dispute_status AS ENUM ('open', 'under_review', 'resolved', 'escalated');

CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    balance DECIMAL(12,2) DEFAULT 0.00,
    locked_balance DECIMAL(12,2) DEFAULT 0.00,
    total_earned DECIMAL(12,2) DEFAULT 0.00,
    total_withdrawn DECIMAL(12,2) DEFAULT 0.00,
    is_frozen BOOLEAN DEFAULT FALSE,
    freeze_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE wallet_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    transaction_type wallet_transaction_type NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    balance_before DECIMAL(12,2) NOT NULL,
    balance_after DECIMAL(12,2) NOT NULL,
    status wallet_transaction_status DEFAULT 'completed',
    reference_type VARCHAR(50),
    reference_id UUID,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE escrow_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gig_id UUID NOT NULL REFERENCES gigs(id),
    company_id UUID NOT NULL REFERENCES users(id),
    student_id UUID REFERENCES users(id),
    amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'locked',
    funded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    released_at TIMESTAMP WITH TIME ZONE,
    auto_release_at TIMESTAMP WITH TIME ZONE,
    released_to_wallet BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE withdrawal_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    wallet_id UUID NOT NULL REFERENCES wallets(id),
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50),
    payment_details JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'pending',
    processed_by UUID REFERENCES users(id),
    processed_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE disputes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gig_id UUID NOT NULL REFERENCES gigs(id),
    raised_by UUID NOT NULL REFERENCES users(id),
    against_id UUID NOT NULL REFERENCES users(id),
    escrow_id UUID REFERENCES escrow_transactions(id),
    reason VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    evidence_urls TEXT[] DEFAULT '{}',
    status dispute_status DEFAULT 'open',
    resolution TEXT,
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- MODULE 10: RATING, REPUTATION & TRUST SCORE
-- =====================================================

CREATE TABLE ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rater_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rated_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES mentorship_sessions(id),
    gig_id UUID REFERENCES gigs(id),
    overall_rating INTEGER NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
    communication_rating INTEGER CHECK (communication_rating BETWEEN 1 AND 5),
    knowledge_rating INTEGER CHECK (knowledge_rating BETWEEN 1 AND 5),
    punctuality_rating INTEGER CHECK (punctuality_rating BETWEEN 1 AND 5),
    helpfulness_rating INTEGER CHECK (helpfulness_rating BETWEEN 1 AND 5),
    review TEXT,
    is_visible BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(rater_id, session_id),
    UNIQUE(rater_id, gig_id)
);

CREATE TABLE trust_score_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    old_score DECIMAL(5,2),
    new_score DECIMAL(5,2) NOT NULL,
    change_reason VARCHAR(255),
    change_amount DECIMAL(5,2),
    reference_type VARCHAR(50),
    reference_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE company_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES users(id),
    reported_by UUID NOT NULL REFERENCES users(id),
    reason VARCHAR(255) NOT NULL,
    description TEXT,
    evidence_urls TEXT[] DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'pending',
    reviewed_by UUID REFERENCES users(id),
    action_taken TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- MODULE 11: NOTIFICATION SYSTEM
-- =====================================================

CREATE TYPE notification_type AS ENUM (
    'doubt_answer', 'doubt_accepted', 'mentor_request', 'mentor_accepted',
    'session_reminder', 'session_completed', 'gig_shortlisted', 'gig_accepted',
    'gig_completed', 'payment_received', 'payment_released', 'dispute_opened',
    'dispute_resolved', 'verification_approved', 'verification_rejected',
    'badge_earned', 'trust_score_changed', 'admin_action', 'system'
);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    action_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_notifications BOOLEAN DEFAULT TRUE,
    push_notifications BOOLEAN DEFAULT TRUE,
    in_app_notifications BOOLEAN DEFAULT TRUE,
    doubt_notifications BOOLEAN DEFAULT TRUE,
    mentorship_notifications BOOLEAN DEFAULT TRUE,
    gig_notifications BOOLEAN DEFAULT TRUE,
    payment_notifications BOOLEAN DEFAULT TRUE,
    system_notifications BOOLEAN DEFAULT TRUE,
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- MODULE 12: ADMIN DASHBOARD & ACCESS CONTROL
-- =====================================================

CREATE TYPE admin_action_type AS ENUM (
    'approve_verification', 'reject_verification', 'suspend_user',
    'ban_user', 'unban_user', 'resolve_dispute', 'flag_content',
    'unflag_content', 'update_trust_score', 'modify_wallet',
    'feature_gig', 'update_settings', 'export_data'
);

CREATE TABLE admin_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES users(id),
    action_type admin_action_type NOT NULL,
    target_user_id UUID REFERENCES users(id),
    target_resource_type VARCHAR(50),
    target_resource_id UUID,
    reason TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE admin_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id),
    permissions TEXT[] DEFAULT '{}',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE flagged_content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_type VARCHAR(50) NOT NULL,
    content_id UUID NOT NULL,
    reported_by UUID NOT NULL REFERENCES users(id),
    reason VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    reviewed_by UUID REFERENCES users(id),
    action_taken TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- MODULE 13: ANALYTICS DASHBOARD
-- =====================================================

CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB DEFAULT '{}',
    session_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE platform_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(12,2) NOT NULL,
    metric_date DATE NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(metric_name, metric_date)
);

CREATE TABLE student_activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_type VARCHAR(100) NOT NULL,
    activity_data JSONB DEFAULT '{}',
    points_earned INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- MODULE 14: RESOURCE LIBRARY & AI INTERVIEW PREP
-- =====================================================

CREATE TYPE resource_type AS ENUM ('document', 'video', 'link', 'code');

CREATE TABLE resources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    uploader_id UUID NOT NULL REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    resource_type resource_type NOT NULL,
    file_url VARCHAR(500),
    external_url VARCHAR(500),
    tags TEXT[] DEFAULT '{}',
    subject VARCHAR(255),
    difficulty_level VARCHAR(20),
    download_count INTEGER DEFAULT 0,
    is_approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE interview_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    question TEXT NOT NULL,
    sample_answer TEXT,
    difficulty_level VARCHAR(20),
    category VARCHAR(100),
    tags TEXT[] DEFAULT '{}',
    company_name VARCHAR(255),
    asked_frequency INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE interview_practice (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES interview_questions(id),
    student_answer TEXT,
    ai_feedback TEXT,
    score INTEGER CHECK (score BETWEEN 1 AND 10),
    time_taken_seconds INTEGER,
    practice_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- MODULE 15: GAMIFICATION (BADGES & POINTS)
-- =====================================================

CREATE TABLE badges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    icon_url VARCHAR(500),
    category VARCHAR(50),
    points_value INTEGER DEFAULT 0,
    tier VARCHAR(20) DEFAULT 'bronze',
    criteria JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE user_badges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_id UUID NOT NULL REFERENCES badges(id),
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, badge_id)
);

CREATE TABLE points_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    points INTEGER NOT NULL,
    reason VARCHAR(255) NOT NULL,
    reference_type VARCHAR(50),
    reference_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE leaderboards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    total_points INTEGER DEFAULT 0,
    rank INTEGER,
    period VARCHAR(20) DEFAULT 'all_time',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, category, period)
);

-- =====================================================
-- MODULE 16: REST API & WEB SERVICES
-- =====================================================

CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100),
    permissions TEXT[] DEFAULT '{}',
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE api_rate_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    api_key_id UUID NOT NULL REFERENCES api_keys(id),
    endpoint VARCHAR(255) NOT NULL,
    requests_count INTEGER DEFAULT 0,
    window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    window_duration_minutes INTEGER DEFAULT 60,
    max_requests INTEGER DEFAULT 100,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);

-- Profiles
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_city ON profiles(city);
CREATE INDEX idx_profiles_college ON profiles(college_name);
CREATE INDEX idx_profiles_trust_score ON profiles(trust_score DESC);
CREATE INDEX idx_profiles_skills ON profiles USING GIN(skills);

-- Doubts
CREATE INDEX idx_doubts_author ON doubts(author_id);
CREATE INDEX idx_doubts_status ON doubts(status);
CREATE INDEX idx_doubts_subject ON doubts(subject);
CREATE INDEX idx_doubts_created ON doubts(created_at DESC);
CREATE INDEX idx_doubts_tags ON doubts USING GIN(tags);

-- Doubt Answers
CREATE INDEX idx_answers_doubt ON doubt_answers(doubt_id);
CREATE INDEX idx_answers_author ON doubt_answers(author_id);

-- Mentorship
CREATE INDEX idx_mentorship_student ON mentorship_requests(student_id);
CREATE INDEX idx_mentorship_mentor ON mentorship_requests(mentor_id);
CREATE INDEX idx_mentorship_status ON mentorship_requests(status);

-- Sessions
CREATE INDEX idx_sessions_student ON mentorship_sessions(student_id);
CREATE INDEX idx_sessions_mentor ON mentorship_sessions(mentor_id);
CREATE INDEX idx_sessions_scheduled ON mentorship_sessions(scheduled_at);

-- Gigs
CREATE INDEX idx_gigs_company ON gigs(company_id);
CREATE INDEX idx_gigs_status ON gigs(status);
CREATE INDEX idx_gigs_category ON gigs(category);
CREATE INDEX idx_gigs_created ON gigs(created_at DESC);
CREATE INDEX idx_gigs_skills ON gigs USING GIN(skills_required);

-- Applications
CREATE INDEX idx_applications_gig ON gig_applications(gig_id);
CREATE INDEX idx_applications_student ON gig_applications(student_id);
CREATE INDEX idx_applications_status ON gig_applications(status);

-- Wallet
CREATE INDEX idx_wallet_user ON wallets(user_id);
CREATE INDEX idx_transactions_wallet ON wallet_transactions(wallet_id);
CREATE INDEX idx_transactions_type ON wallet_transactions(transaction_type);
CREATE INDEX idx_transactions_created ON wallet_transactions(created_at DESC);

-- Escrow
CREATE INDEX idx_escrow_gig ON escrow_transactions(gig_id);
CREATE INDEX idx_escrow_company ON escrow_transactions(company_id);
CREATE INDEX idx_escrow_student ON escrow_transactions(student_id);
CREATE INDEX idx_escrow_status ON escrow_transactions(status);

-- Ratings
CREATE INDEX idx_ratings_rated ON ratings(rated_id);
CREATE INDEX idx_ratings_rater ON ratings(rater_id);

-- Notifications
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_read ON notifications(is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- Messages
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);

-- Analytics
CREATE INDEX idx_analytics_user ON analytics_events(user_id);
CREATE INDEX idx_analytics_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_created ON analytics_events(created_at DESC);

-- Badges
CREATE INDEX idx_user_badges_user ON user_badges(user_id);
CREATE INDEX idx_points_user ON points_history(user_id);

-- Admin Log
CREATE INDEX idx_admin_log_admin ON admin_audit_log(admin_id);
CREATE INDEX idx_admin_log_action ON admin_audit_log(action_type);
CREATE INDEX idx_admin_log_created ON admin_audit_log(created_at DESC);

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to all tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_doubts_updated_at BEFORE UPDATE ON doubts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_doubt_answers_updated_at BEFORE UPDATE ON doubt_answers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_mentorship_requests_updated_at BEFORE UPDATE ON mentorship_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_mentorship_sessions_updated_at BEFORE UPDATE ON mentorship_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_gigs_updated_at BEFORE UPDATE ON gigs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_gig_applications_updated_at BEFORE UPDATE ON gig_applications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_escrow_transactions_updated_at BEFORE UPDATE ON escrow_transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_company_profiles_updated_at BEFORE UPDATE ON company_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_alumni_profiles_updated_at BEFORE UPDATE ON alumni_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_resources_updated_at BEFORE UPDATE ON resources FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-create wallet for new user
CREATE OR REPLACE FUNCTION create_wallet_for_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO wallets (user_id) VALUES (NEW.id);
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_create_wallet
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION create_wallet_for_user();

-- Auto-create profile for new user
CREATE OR REPLACE FUNCTION create_profile_for_user()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role IN ('student', 'alumni') THEN
        INSERT INTO profiles (user_id, full_name) VALUES (NEW.id, '');
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_create_profile
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION create_profile_for_user();

-- Auto-create notification preferences
CREATE OR REPLACE FUNCTION create_notification_prefs()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO notification_preferences (user_id) VALUES (NEW.id);
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_create_notification_prefs
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION create_notification_prefs();

-- Cleanup expired login OTPs (runs on each insert)
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM login_otps WHERE expires_at < NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_cleanup_otps
    BEFORE INSERT ON login_otps
    FOR EACH ROW
    EXECUTE FUNCTION cleanup_expired_otps();

-- Update doubt upvote count
CREATE OR REPLACE FUNCTION update_doubt_votes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.doubt_id IS NOT NULL THEN
            UPDATE doubts SET upvotes = upvotes + NEW.vote_type WHERE id = NEW.doubt_id;
        END IF;
        IF NEW.answer_id IS NOT NULL THEN
            UPDATE doubt_answers SET upvotes = upvotes + NEW.vote_type WHERE id = NEW.answer_id;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.doubt_id IS NOT NULL THEN
            UPDATE doubts SET upvotes = upvotes - OLD.vote_type WHERE id = OLD.doubt_id;
        END IF;
        IF OLD.answer_id IS NOT NULL THEN
            UPDATE doubt_answers SET upvotes = upvotes - OLD.vote_type WHERE id = OLD.answer_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_update_votes
    AFTER INSERT OR DELETE ON doubt_votes
    FOR EACH ROW
    EXECUTE FUNCTION update_doubt_votes();

-- Update gig application count
CREATE OR REPLACE FUNCTION update_gig_application_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE gigs SET total_applications = total_applications + 1 WHERE id = NEW.gig_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE gigs SET total_applications = total_applications - 1 WHERE id = OLD.gig_id;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_update_application_count
    AFTER INSERT OR DELETE ON gig_applications
    FOR EACH ROW
    EXECUTE FUNCTION update_gig_application_count();

-- =====================================================
-- SEED DATA: Default Badges
-- =====================================================

INSERT INTO badges (name, description, category, points_value, tier, criteria) VALUES
('First Steps', 'Created your profile', 'onboarding', 10, 'bronze', '{"action": "complete_profile"}'),
('Verified Student', 'Completed student verification', 'verification', 50, 'bronze', '{"action": "verify_student"}'),
('Verified Alumni', 'Completed alumni verification', 'verification', 75, 'bronze', '{"action": "verify_alumni"}'),
('Verified Company', 'Completed company verification', 'verification', 100, 'bronze', '{"action": "verify_company"}'),
('Curious Mind', 'Asked your first doubt', 'doubts', 15, 'bronze', '{"action": "first_doubt"}'),
('Problem Solver', 'Got 5 accepted answers', 'doubts', 100, 'silver', '{"action": "accepted_answers", "count": 5}'),
('Knowledge Guru', 'Got 25 accepted answers', 'doubts', 500, 'gold', '{"action": "accepted_answers", "count": 25}'),
('Helpful Hand', 'Answered 10 doubts', 'doubts', 50, 'bronze', '{"action": "answers_given", "count": 10}'),
('First Mentorship', 'Completed your first mentorship session', 'mentorship', 30, 'bronze', '{"action": "first_session"}'),
('Mentor Master', 'Completed 10 mentorship sessions', 'mentorship', 200, 'silver', '{"action": "sessions_completed", "count": 10}'),
('First Gig', 'Completed your first gig', 'gigs', 50, 'bronze', '{"action": "first_gig"}'),
('Gig Champion', 'Completed 10 gigs', 'gigs', 300, 'silver', '{"action": "gigs_completed", "count": 10}'),
('Top Earner', 'Earned ₹10,000 from gigs', 'wallet', 200, 'silver', '{"action": "earnings", "amount": 10000}'),
('Rising Star', 'Reached Rising talent tier', 'reputation', 150, 'silver', '{"action": "rising_tier"}'),
('Featured Talent', 'Reached Featured talent tier', 'reputation', 500, 'gold', '{"action": "featured_tier"}'),
('Social Butterfly', 'Active for 30 days straight', 'engagement', 100, 'bronze', '{"action": "streak", "days": 30}'),
('Team Player', 'Referred 3 verified students', 'social', 75, 'bronze', '{"action": "referrals", "count": 3}'),
('Quick Responder', 'Avg response time under 1 hour', 'mentorship', 100, 'silver', '{"action": "fast_response"}'),
('Perfect Score', 'Received 5-star rating 5 times', 'reputation', 200, 'gold', '{"action": "perfect_ratings", "count": 5}'),
('Dispute Free', 'Completed 5 gigs with no disputes', 'gigs', 150, 'silver', '{"action": "clean_gigs", "count": 5}');

-- =====================================================
-- SEED DATA: Default Admin User
-- =====================================================

-- Password: Admin@123 (bcrypt hashed)
INSERT INTO users (email, password_hash, role, is_email_verified, is_active)
VALUES ('admin@nextgencampus.com', '$2b$10$defaulthashedpasswordhere', 'admin', TRUE, TRUE);

-- =====================================================
-- END OF SCHEMA
-- =====================================================
