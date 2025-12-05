-- Add suspension tracking fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS suspension_end_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS suspension_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_suspension_at TIMESTAMP WITH TIME ZONE;

-- Create index for auto-reactivation queries
CREATE INDEX IF NOT EXISTS idx_users_suspension_end ON users(suspension_end_date) 
WHERE status = 'suspended' AND suspension_end_date IS NOT NULL;

-- Function to auto-reactivate expired suspensions
CREATE OR REPLACE FUNCTION auto_reactivate_expired_suspensions()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE users 
  SET 
    status = 'active',
    status_reason = 'Suspension period completed',
    status_updated_at = NOW(),
    suspension_end_date = NULL
  WHERE 
    status = 'suspended' 
    AND suspension_end_date IS NOT NULL
    AND suspension_end_date < NOW();
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to run auto-reactivation (requires pg_cron extension)
-- Run this manually or set up a cron job:
-- SELECT cron.schedule('auto-reactivate-suspensions', '*/5 * * * *', 'SELECT auto_reactivate_expired_suspensions()');
