-- =============================================================================
-- SRM HACKATHON 2026: PRODUCTION SUPABASE DATABASE SCHEMA & AUTOMATIONS
-- Target Project ID: xdgsuebdlmgtfuxtmotv
-- =============================================================================

-- 1. Enable Cryptographic UUID Generator Extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- TABLE 1: app_users (Students, Leaders & Hackers)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.app_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    public_user_id TEXT UNIQUE DEFAULT ('USER-2026-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
    name TEXT NOT NULL,
    username TEXT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT DEFAULT 'hashed_default',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- TABLE 2: teams (Squads & Proposed Architecture)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id TEXT UNIQUE DEFAULT ('TEAM-2026-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
    name TEXT UNIQUE NOT NULL,
    track TEXT NOT NULL,
    abstract TEXT,
    leader_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- TABLE 3: team_members (Squad Roster & Maximum 4 Limit)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'MEMBER', -- 'LEADER' or 'MEMBER'
    status TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE' or 'PENDING'
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_team_user UNIQUE (team_id, user_id)
);

-- =============================================================================
-- TABLE 4: team_invitations (Unique Verification Tokens & Invites)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.team_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invitation_id TEXT UNIQUE DEFAULT ('INV-2026-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    inviter_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
    invited_email TEXT NOT NULL,
    invited_name TEXT DEFAULT '',
    message TEXT DEFAULT '',
    token_hash TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED'
    delivery_status TEXT DEFAULT 'DELIVERED',
    expires_at TIMESTAMPTZ DEFAULT (now() + interval '3 days'),
    sent_at TIMESTAMPTZ DEFAULT now(),
    accepted_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- TABLE 5: support_tickets (Contact Us & Helpdesk Desk)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id TEXT UNIQUE DEFAULT ('TCK-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6))),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'General Support',
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'IN_PROGRESS', 'RESOLVED'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- TABLE 6: announcements (Live Student Awareness Feed)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'General',
    priority TEXT NOT NULL DEFAULT 'High', -- 'Critical', 'High', 'Medium', 'Info'
    track TEXT NOT NULL DEFAULT 'All Tracks',
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- AUTOMATION TRIGGER 1: STRICT MAXIMUM 4 MEMBERS PER TEAM
-- Automatically aborts insert if a squad already has 4 members!
-- =============================================================================
CREATE OR REPLACE FUNCTION check_team_capacity_limit()
RETURNS TRIGGER AS $$
DECLARE
    current_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO current_count
    FROM public.team_members
    WHERE team_id = NEW.team_id;

    IF current_count >= 4 THEN
        RAISE EXCEPTION 'Squad limit reached: Team already has 4 members (maximum capacity).';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_team_max_capacity ON public.team_members;
CREATE TRIGGER trg_enforce_team_max_capacity
BEFORE INSERT ON public.team_members
FOR EACH ROW
EXECUTE FUNCTION check_team_capacity_limit();

-- =============================================================================
-- AUTOMATION TRIGGER 2: AUTOMATIC updated_at TIMESTAMP REFRESH
-- =============================================================================
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_app_users_updated_at ON public.app_users;
CREATE TRIGGER trg_app_users_updated_at
BEFORE UPDATE ON public.app_users
FOR EACH ROW
EXECUTE FUNCTION update_timestamp_column();

DROP TRIGGER IF EXISTS trg_teams_updated_at ON public.teams;
CREATE TRIGGER trg_teams_updated_at
BEFORE UPDATE ON public.teams
FOR EACH ROW
EXECUTE FUNCTION update_timestamp_column();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) & PUBLIC API ACCESS POLICIES
-- Enables seamless REST API read, write, update, and delete access
-- =============================================================================
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Grant permissions to public roles
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- Teams Policies
DROP POLICY IF EXISTS "Allow public read teams" ON public.teams;
CREATE POLICY "Allow public read teams" ON public.teams FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert teams" ON public.teams;
CREATE POLICY "Allow public insert teams" ON public.teams FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update teams" ON public.teams;
CREATE POLICY "Allow public update teams" ON public.teams FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete teams" ON public.teams;
CREATE POLICY "Allow public delete teams" ON public.teams FOR DELETE USING (true);

-- App Users Policies
DROP POLICY IF EXISTS "Allow public read users" ON public.app_users;
CREATE POLICY "Allow public read users" ON public.app_users FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert users" ON public.app_users;
CREATE POLICY "Allow public insert users" ON public.app_users FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update users" ON public.app_users;
CREATE POLICY "Allow public update users" ON public.app_users FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete users" ON public.app_users;
CREATE POLICY "Allow public delete users" ON public.app_users FOR DELETE USING (true);

-- Team Members Policies
DROP POLICY IF EXISTS "Allow public read members" ON public.team_members;
CREATE POLICY "Allow public read members" ON public.team_members FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert members" ON public.team_members;
CREATE POLICY "Allow public insert members" ON public.team_members FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update members" ON public.team_members;
CREATE POLICY "Allow public update members" ON public.team_members FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete members" ON public.team_members;
CREATE POLICY "Allow public delete members" ON public.team_members FOR DELETE USING (true);

-- Support Tickets Policies
DROP POLICY IF EXISTS "Allow public read tickets" ON public.support_tickets;
CREATE POLICY "Allow public read tickets" ON public.support_tickets FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert tickets" ON public.support_tickets;
CREATE POLICY "Allow public insert tickets" ON public.support_tickets FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update tickets" ON public.support_tickets;
CREATE POLICY "Allow public update tickets" ON public.support_tickets FOR UPDATE USING (true);

-- Announcements Policies
DROP POLICY IF EXISTS "Allow public read announcements" ON public.announcements;
CREATE POLICY "Allow public read announcements" ON public.announcements FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert announcements" ON public.announcements;
CREATE POLICY "Allow public insert announcements" ON public.announcements FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public delete announcements" ON public.announcements;
CREATE POLICY "Allow public delete announcements" ON public.announcements FOR DELETE USING (true);
