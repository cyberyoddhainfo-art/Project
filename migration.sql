-- 1. Add reporting_manager_id to profiles table
ALTER TABLE profiles 
ADD COLUMN reporting_manager_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- 2. Modify attendance status constraint to support 'pending_wfh'
-- Note: 'wfh' will now represent an approved wfh schedule
ALTER TABLE attendance 
DROP CONSTRAINT attendance_status_check;

ALTER TABLE attendance 
ADD CONSTRAINT attendance_status_check 
CHECK (status IN ('present', 'absent', 'half_day', 'wfh', 'pending_wfh'));
