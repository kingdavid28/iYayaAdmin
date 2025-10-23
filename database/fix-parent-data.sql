-- Fix missing parent data in jobs table
-- This script ensures all jobs have proper parent_id references to users with names and emails

-- First, ensure we have some parent users
INSERT INTO users (id, email, name, role, status, created_at, updated_at)
VALUES
  ('550e8400-e29b-41d4-a716-446655440000', 'john.parent@example.com', 'John Parent', 'parent', 'active', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440001', 'sarah.parent@example.com', 'Sarah Parent', 'parent', 'active', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440002', 'mike.parent@example.com', 'Mike Parent', 'parent', 'active', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440003', 'lisa.parent@example.com', 'Lisa Parent', 'parent', 'active', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Ensure we have some caregiver users
INSERT INTO users (id, email, name, role, status, created_at, updated_at)
VALUES
  ('550e8400-e29b-41d4-a716-446655440010', 'anna.caregiver@example.com', 'Anna Caregiver', 'caregiver', 'active', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440011', 'david.caregiver@example.com', 'David Caregiver', 'caregiver', 'active', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440012', 'emma.caregiver@example.com', 'Emma Caregiver', 'caregiver', 'active', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Update existing jobs to have proper parent_id references
-- If jobs exist without parent_id or with null parent_id, assign them to sample parents
UPDATE jobs
SET parent_id = CASE
  WHEN parent_id IS NULL THEN (
    SELECT id FROM users
    WHERE role = 'parent'
    ORDER BY created_at
    LIMIT 1
  )
  ELSE parent_id
END,
updated_at = NOW()
WHERE parent_id IS NULL;

-- Update jobs to have proper caregiver_id references where appropriate
UPDATE jobs
SET caregiver_id = (
  SELECT id FROM users
  WHERE role = 'caregiver'
  ORDER BY created_at
  LIMIT 1
),
updated_at = NOW()
WHERE caregiver_id IS NULL AND status IN ('completed', 'confirmed');

-- Add some sample jobs if none exist
INSERT INTO jobs (id, parent_id, title, description, location, budget, hourly_rate, status, created_at, updated_at)
SELECT
  gen_random_uuid(),
  (SELECT id FROM users WHERE role = 'parent' ORDER BY created_at LIMIT 1),
  'Childcare for 3-year-old',
  'Need experienced caregiver for my 3-year-old daughter. Must be patient and engaging.',
  'Downtown Manila',
  500,
  150,
  'open',
  NOW() - INTERVAL '2 days',
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM jobs LIMIT 1);

INSERT INTO jobs (id, parent_id, title, description, location, budget, hourly_rate, status, created_at, updated_at)
SELECT
  gen_random_uuid(),
  (SELECT id FROM users WHERE role = 'parent' ORDER BY created_at LIMIT 1 OFFSET 1),
  'After-school care',
  'Looking for reliable caregiver to pick up kids from school and help with homework.',
  'Makati City',
  800,
  200,
  'confirmed',
  NOW() - INTERVAL '1 day',
  NOW()
WHERE (SELECT COUNT(*) FROM jobs) < 2;

-- Ensure all jobs have valid parent_id references
UPDATE jobs
SET parent_id = (SELECT id FROM users WHERE role = 'parent' ORDER BY created_at LIMIT 1)
WHERE parent_id NOT IN (SELECT id FROM users WHERE role = 'parent');

-- Log the results
DO $$
DECLARE
  job_count INTEGER;
  parent_count INTEGER;
  caregiver_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO job_count FROM jobs;
  SELECT COUNT(*) INTO parent_count FROM users WHERE role = 'parent';
  SELECT COUNT(*) INTO caregiver_count FROM users WHERE role = 'caregiver';

  RAISE NOTICE 'Jobs: %, Parents: %, Caregivers: %', job_count, parent_count, caregiver_count;
END $$;
