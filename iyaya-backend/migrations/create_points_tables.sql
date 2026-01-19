-- Points System Tables for Solana Integration
-- Run this in Supabase SQL Editor

-- Caregiver Points Ledger (transaction log)
CREATE TABLE IF NOT EXISTS caregiver_points_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metric VARCHAR(50) NOT NULL,
  delta INTEGER NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Caregiver Points Summary (current totals)
CREATE TABLE IF NOT EXISTS caregiver_points_summary (
  caregiver_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  total_points INTEGER DEFAULT 0,
  tier VARCHAR(20) DEFAULT 'Bronze',
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_points_ledger_caregiver ON caregiver_points_ledger(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_points_ledger_created ON caregiver_points_ledger(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_points_summary_caregiver ON caregiver_points_summary(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_points_summary_total ON caregiver_points_summary(total_points DESC);

-- RLS Policies (drop existing first to avoid conflicts)
ALTER TABLE caregiver_points_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE caregiver_points_summary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Caregivers can view own points ledger" ON caregiver_points_ledger;
DROP POLICY IF EXISTS "Caregivers can view own points summary" ON caregiver_points_summary;
DROP POLICY IF EXISTS "Admins can view all points ledger" ON caregiver_points_ledger;
DROP POLICY IF EXISTS "Admins can view all points summary" ON caregiver_points_summary;
DROP POLICY IF EXISTS "Admins can insert points ledger" ON caregiver_points_ledger;
DROP POLICY IF EXISTS "Admins can update points summary" ON caregiver_points_summary;

-- Caregivers can view their own points
CREATE POLICY "Caregivers can view own points ledger" ON caregiver_points_ledger
  FOR SELECT USING (auth.uid() = caregiver_id);

CREATE POLICY "Caregivers can view own points summary" ON caregiver_points_summary
  FOR SELECT USING (auth.uid() = caregiver_id);

-- Admins can view all points
CREATE POLICY "Admins can view all points ledger" ON caregiver_points_ledger
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "Admins can view all points summary" ON caregiver_points_summary
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'superadmin')
    )
  );

-- Admins can insert/update points
CREATE POLICY "Admins can insert points ledger" ON caregiver_points_ledger
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "Admins can update points summary" ON caregiver_points_summary
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'superadmin')
    )
  );

-- Function to auto-update summary timestamp
CREATE OR REPLACE FUNCTION update_points_summary_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS points_summary_updated_at ON caregiver_points_summary;

CREATE TRIGGER points_summary_updated_at
  BEFORE UPDATE ON caregiver_points_summary
  FOR EACH ROW
  EXECUTE FUNCTION update_points_summary_timestamp();

-- Verify tables created
SELECT 'Points tables created successfully' as status;
