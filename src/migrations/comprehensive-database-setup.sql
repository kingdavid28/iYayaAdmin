-- Comprehensive Database Setup for Iyaya App
-- This file consolidates all necessary database changes

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT auth.uid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  address TEXT,
  location TEXT,
  role TEXT NOT NULL DEFAULT 'parent'::TEXT CHECK (role IN ('parent', 'caregiver', 'admin', 'superadmin')),
  status TEXT DEFAULT 'active'::TEXT CHECK (status IN ('active', 'inactive', 'suspended', 'banned')),
  status_reason TEXT,
  status_updated_at TIMESTAMP WITH TIME ZONE,
  status_updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  profile_image TEXT,
  avatar TEXT,
  bio TEXT,
  experience TEXT,
  skills TEXT[],
  certifications TEXT[],
  hourly_rate INTEGER,
  rating NUMERIC(3, 2) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  email_verified BOOLEAN DEFAULT false,
  auth_provider TEXT DEFAULT 'supabase'::TEXT,
  availability JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS status_reason TEXT,
  ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS status_updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users USING btree (email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users USING btree (role);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users USING btree (status);
CREATE INDEX IF NOT EXISTS idx_users_status_updated_at ON public.users USING btree (status_updated_at);

-- Caregiver profile table to store caregiver-specific attributes
CREATE TABLE IF NOT EXISTS caregiver_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  caregiver_id TEXT UNIQUE,
  profile_image TEXT,
  bio TEXT,
  experience JSONB,
  hourly_rate NUMERIC(10, 2),
  education TEXT,
  languages TEXT[],
  age_care_ranges TEXT[],
  certifications JSONB,
  availability JSONB,
  portfolio JSONB,
  emergency_contacts JSONB,
  verification JSONB,
  rating NUMERIC(3, 2) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  trust_score INTEGER DEFAULT 0,
  has_completed_jobs BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.caregiver_profiles
  ADD COLUMN IF NOT EXISTS trust_score INTEGER DEFAULT 0,
  ALTER COLUMN trust_score SET DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'caregiver_profiles_user_id_fkey'
      AND conrelid = 'public.caregiver_profiles'::regclass
  ) THEN
    ALTER TABLE public.caregiver_profiles
      ADD CONSTRAINT caregiver_profiles_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES public.users(id)
      ON DELETE CASCADE;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS caregiver_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  document_type TEXT NOT NULL,
  category TEXT,
  size BIGINT,
  verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMP WITH TIME ZONE,
  verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expiry_date TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS caregiver_background_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'not_started',
  provider TEXT DEFAULT 'internal',
  check_types TEXT[],
  requested_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  verified_at TIMESTAMP WITH TIME ZONE,
  expiry_date TIMESTAMP WITH TIME ZONE,
  verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
  report_id TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  reason TEXT,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_caregiver_profiles_user_id ON caregiver_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_caregiver_profiles_trust_score ON caregiver_profiles(trust_score);
CREATE INDEX IF NOT EXISTS idx_caregiver_documents_user_id ON caregiver_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_caregiver_documents_verified ON caregiver_documents(verified);
CREATE INDEX IF NOT EXISTS idx_caregiver_background_checks_user_id ON caregiver_background_checks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_status_history_user_id ON user_status_history(user_id);

-- Create children table
CREATE TABLE IF NOT EXISTS children (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  special_needs TEXT,
  allergies TEXT,
  medical_conditions TEXT,
  emergency_contact JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create jobs table
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  date DATE,
  start_time TIME WITHOUT TIME ZONE,
  end_time TIME WITHOUT TIME ZONE,
  hourly_rate INTEGER,
  budget INTEGER,
  number_of_children INTEGER DEFAULT 1,
  children_ages TEXT,
  special_instructions TEXT,
  contact_phone TEXT,
  emergency_contact TEXT,
  status TEXT DEFAULT 'active',
  urgent BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  caregiver_id UUID,
  CONSTRAINT jobs_pkey PRIMARY KEY (id),
  CONSTRAINT jobs_caregiver_id_fkey FOREIGN KEY (caregiver_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT jobs_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT jobs_status_check CHECK (status = ANY (ARRAY['active'::TEXT, 'filled'::TEXT, 'cancelled'::TEXT, 'completed'::TEXT]))
);

CREATE INDEX IF NOT EXISTS idx_jobs_caregiver_id ON public.jobs USING btree (caregiver_id);
CREATE INDEX IF NOT EXISTS idx_jobs_parent_id ON public.jobs USING btree (parent_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs USING btree (status);

CREATE TRIGGER update_jobs_updated_at
BEFORE UPDATE ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create applications table
CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  caregiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'shortlisted')),
  message TEXT,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(job_id, caregiver_id)
);

-- Create bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  caregiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  total_amount DECIMAL(10,2),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
  payment_proof TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  participant_2 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(participant_1, participant_2)
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file')),
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create reviews table with all necessary columns
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  caregiver_id UUID REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('message', 'job_application', 'booking_request', 'booking_confirmed', 'booking_cancelled', 'review', 'payment', 'system')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create availability table
CREATE TABLE IF NOT EXISTS availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(caregiver_id, day_of_week, start_time, end_time)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_children_parent_id ON children(parent_id);
CREATE INDEX IF NOT EXISTS idx_jobs_parent_id ON jobs(parent_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_applications_job_id ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_caregiver_id ON applications(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_bookings_job_id ON bookings(job_id);
CREATE INDEX IF NOT EXISTS idx_bookings_parent_id ON bookings(parent_id);
CREATE INDEX IF NOT EXISTS idx_bookings_caregiver_id ON bookings(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_conversations_participants ON conversations(participant_1, participant_2);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_reviews_booking_id ON reviews(booking_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee_id ON reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_reviews_caregiver_id ON reviews(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_availability_caregiver_id ON availability(caregiver_id);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE children ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE caregiver_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE caregiver_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE caregiver_background_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_status_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON users;
DROP POLICY IF EXISTS "Users can view public profiles" ON users;
DROP POLICY IF EXISTS "Parents can manage their children" ON children;
DROP POLICY IF EXISTS "Anyone can view active jobs" ON jobs;
DROP POLICY IF EXISTS "Anyone can view jobs" ON jobs;
DROP POLICY IF EXISTS "Job owners can manage their jobs" ON jobs;
DROP POLICY IF EXISTS "Job owners can view applications" ON applications;
DROP POLICY IF EXISTS "Caregivers can manage their applications" ON applications;
DROP POLICY IF EXISTS "Booking participants can view bookings" ON bookings;
DROP POLICY IF EXISTS "Booking participants can update bookings" ON bookings;
DROP POLICY IF EXISTS "Parents can create bookings" ON bookings;
DROP POLICY IF EXISTS "Participants can view conversations" ON conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Conversation participants can view messages" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;
DROP POLICY IF EXISTS "Recipients can update messages" ON messages;
DROP POLICY IF EXISTS "Anyone can view reviews" ON reviews;
DROP POLICY IF EXISTS "Authenticated users can create reviews" ON reviews;
DROP POLICY IF EXISTS "Review authors can update their reviews" ON reviews;
DROP POLICY IF EXISTS "Review authors can delete their reviews" ON reviews;
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "Service role can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Caregivers can manage their availability" ON availability;
DROP POLICY IF EXISTS "Anyone can view caregiver availability" ON availability;
DROP POLICY IF EXISTS "Caregivers can manage their profile" ON caregiver_profiles;
DROP POLICY IF EXISTS "Service role can manage caregiver profiles" ON caregiver_profiles;
DROP POLICY IF EXISTS "Caregivers can manage their documents" ON caregiver_documents;
DROP POLICY IF EXISTS "Service role can manage caregiver documents" ON caregiver_documents;
DROP POLICY IF EXISTS "Caregivers can view their background checks" ON caregiver_background_checks;
DROP POLICY IF EXISTS "Service role can manage caregiver background checks" ON caregiver_background_checks;
DROP POLICY IF EXISTS "Service role can manage user status history" ON user_status_history;

-- Create comprehensive RLS policies
CREATE POLICY "Users can view their own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can view public profiles" ON users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage users" ON users;

CREATE POLICY "Admins can manage users" ON users
  FOR ALL USING (
    auth.role() = 'service_role'
    OR (auth.jwt() ->> 'role') IN ('admin', 'superadmin')
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.jwt() ->> 'role') IN ('admin', 'superadmin')
  );

CREATE POLICY "Parents can manage their children" ON children FOR ALL USING (auth.uid() = parent_id);

CREATE POLICY "Anyone can view jobs" ON jobs FOR SELECT USING (true);
CREATE POLICY "Job owners can manage their jobs" ON jobs FOR ALL USING (auth.uid() = parent_id);

DROP POLICY IF EXISTS "Admins can manage jobs" ON jobs;
CREATE POLICY "Admins can manage jobs" ON jobs
  FOR ALL USING (
    auth.role() = 'service_role'
    OR (auth.jwt() ->> 'role') IN ('admin', 'superadmin')
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.jwt() ->> 'role') IN ('admin', 'superadmin')
  );

CREATE POLICY "Job owners can view applications" ON applications FOR SELECT USING (
  auth.uid() IN (SELECT parent_id FROM jobs WHERE id = job_id)
);
CREATE POLICY "Caregivers can manage their applications" ON applications FOR ALL USING (auth.uid() = caregiver_id);

CREATE POLICY "Admins can manage applications" ON applications
  FOR ALL USING (
    auth.role() = 'service_role'
    OR (auth.jwt() ->> 'role') IN ('admin', 'superadmin')
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.jwt() ->> 'role') IN ('admin', 'superadmin')
  );

CREATE POLICY "Booking participants can view bookings" ON bookings FOR SELECT USING (
  auth.uid() = parent_id OR auth.uid() = caregiver_id
);
CREATE POLICY "Booking participants can update bookings" ON bookings FOR UPDATE USING (
  auth.uid() = parent_id OR auth.uid() = caregiver_id
);
CREATE POLICY "Parents can create bookings" ON bookings FOR INSERT WITH CHECK (auth.uid() = parent_id);

CREATE POLICY "Admins can manage bookings" ON bookings
  FOR ALL USING (
    auth.role() = 'service_role'
    OR (auth.jwt() ->> 'role') IN ('admin', 'superadmin')
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.jwt() ->> 'role') IN ('admin', 'superadmin')
  );

CREATE POLICY "Participants can view conversations" ON conversations FOR SELECT USING (
  auth.uid() = participant_1 OR auth.uid() = participant_2
);
CREATE POLICY "Users can create conversations" ON conversations FOR INSERT WITH CHECK (
  auth.uid() = participant_1 OR auth.uid() = participant_2
);

CREATE POLICY "Conversation participants can view messages" ON messages FOR SELECT USING (
  auth.uid() IN (
    SELECT participant_1 FROM conversations WHERE id = conversation_id
    UNION
    SELECT participant_2 FROM conversations WHERE id = conversation_id
  )
);
CREATE POLICY "Users can send messages" ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Recipients can update messages" ON messages FOR UPDATE USING (auth.uid() = recipient_id);

DROP POLICY IF EXISTS "Anyone can view reviews" ON reviews;
CREATE POLICY "Anyone can view reviews" ON reviews FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can create reviews" ON reviews;
CREATE POLICY "Authenticated users can create reviews" ON reviews FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Review authors can update their reviews" ON reviews;
CREATE POLICY "Review authors can update their reviews" ON reviews FOR UPDATE USING (auth.uid() = reviewer_id);
DROP POLICY IF EXISTS "Review authors can delete their reviews" ON reviews;
CREATE POLICY "Review authors can delete their reviews" ON reviews FOR DELETE USING (auth.uid() = reviewer_id);

DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Service role can insert notifications" ON notifications;
CREATE POLICY "Service role can insert notifications" ON notifications FOR INSERT WITH CHECK (
  auth.role() = 'service_role' OR auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "Admins can manage notifications" ON notifications;
CREATE POLICY "Admins can manage notifications" ON notifications
  FOR ALL USING (
    auth.role() = 'service_role'
    OR (auth.jwt() ->> 'role') IN ('admin', 'superadmin')
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.jwt() ->> 'role') IN ('admin', 'superadmin')
  );

-- Consolidated view for admin dashboard metrics (single-row result)
CREATE OR REPLACE VIEW dashboard_metrics AS
SELECT
  (SELECT COUNT(*) FROM users) AS users_total,
  (SELECT COUNT(*) FROM users WHERE status = 'active') AS users_active,
  (SELECT COUNT(*) FROM users WHERE status = 'suspended') AS users_suspended,
  (SELECT COUNT(*) FROM jobs) AS jobs_total,
  (SELECT COUNT(*) FROM jobs WHERE status IN ('open', 'active', 'confirmed')) AS jobs_active,
  (SELECT COUNT(*) FROM bookings) AS bookings_total,
  (SELECT COUNT(*) FROM bookings WHERE status IN ('completed')) AS bookings_completed,
  (SELECT COUNT(*) FROM applications WHERE status = 'pending') AS applications_pending,
  (SELECT COUNT(*) FROM applications WHERE status = 'approved') AS applications_approved;

CREATE POLICY "Caregivers can manage their availability" ON availability FOR ALL USING (auth.uid() = caregiver_id);
CREATE POLICY "Anyone can view caregiver availability" ON availability FOR SELECT USING (true);

CREATE POLICY "Caregivers can manage their profile" ON caregiver_profiles
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage caregiver profiles" ON caregiver_profiles;
CREATE POLICY "Service role can manage caregiver profiles" ON caregiver_profiles
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Caregivers can manage their documents" ON caregiver_documents;
CREATE POLICY "Caregivers can manage their documents" ON caregiver_documents
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage caregiver documents" ON caregiver_documents;
CREATE POLICY "Service role can manage caregiver documents" ON caregiver_documents
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Caregivers can view their background checks" ON caregiver_background_checks;
CREATE POLICY "Caregivers can view their background checks" ON caregiver_background_checks
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage caregiver background checks" ON caregiver_background_checks;
CREATE POLICY "Service role can manage caregiver background checks" ON caregiver_background_checks
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can manage user status history" ON user_status_history;
CREATE POLICY "Service role can manage user status history" ON user_status_history
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('profile-images', 'profile-images', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-proofs', 'payment-proofs', false) ON CONFLICT (id) DO NOTHING;
