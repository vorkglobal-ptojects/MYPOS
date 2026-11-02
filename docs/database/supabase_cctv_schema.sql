-- MIFOS CCTV System Schema Migration

-- 1. CCTV Cameras Registry Table
CREATE TABLE IF NOT EXISTS public.cctv_cameras (
    id VARCHAR(100) PRIMARY KEY,
    branch_id VARCHAR(50) NOT NULL,
    camera_name VARCHAR(255) NOT NULL,
    camera_ip VARCHAR(100) NOT NULL,
    camera_model VARCHAR(100) DEFAULT 'EZVIZ CS-H6c',
    camera_protocol VARCHAR(50) DEFAULT 'ONVIF',
    agent_id VARCHAR(100),
    status VARCHAR(50) DEFAULT 'OFFLINE', -- ONLINE, OFFLINE, WARNING
    last_heartbeat TIMESTAMPTZ,
    counter_name VARCHAR(100) DEFAULT 'Cashier Counter 01',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CCTV Evidence Recordings Table
CREATE TABLE IF NOT EXISTS public.cctv_recordings (
    id VARCHAR(100) PRIMARY KEY,
    branch_id VARCHAR(50) NOT NULL,
    camera_id VARCHAR(100) REFERENCES public.cctv_cameras(id) ON DELETE SET NULL,
    pawn_id VARCHAR(100) NOT NULL,
    cashier_id VARCHAR(100),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    duration INTEGER DEFAULT 20, -- seconds
    file_path TEXT NOT NULL,
    file_size BIGINT DEFAULT 0,
    mime_type VARCHAR(50) DEFAULT 'video/mp4',
    status VARCHAR(50) DEFAULT 'COMPLETED', -- PROCESSING, COMPLETED, FAILED
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by pawn_id and branch_id
CREATE INDEX IF NOT EXISTS idx_cctv_recordings_pawn_id ON public.cctv_recordings(pawn_id);
CREATE INDEX IF NOT EXISTS idx_cctv_recordings_branch_id ON public.cctv_recordings(branch_id);

-- 3. CCTV Audit Logs Table
CREATE TABLE IF NOT EXISTS public.cctv_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(100),
    user_email VARCHAR(255),
    branch_id VARCHAR(50),
    camera_id VARCHAR(100),
    recording_id VARCHAR(100),
    action VARCHAR(50) NOT NULL, -- LIVE_VIEW, SNAPSHOT, PLAYBACK, DOWNLOAD, PTZ_CONTROL, CAPTURE_TRIGGER, CAMERA_REGISTER
    ip_address VARCHAR(100),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cctv_audit_logs_created_at ON public.cctv_audit_logs(created_at DESC);
