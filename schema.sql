-- ==========================================================
-- SUPABASE SCHEMA FOR HR & PAYROLL SYSTEM
-- ==========================================================

-- 1. PROFILES (Extends auth.users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    employee_id TEXT UNIQUE NOT NULL,
    department TEXT NOT NULL,
    designation TEXT NOT NULL,
    joining_date DATE NOT NULL,
    phone TEXT,
    bank_account_encrypted TEXT,
    salary_basic NUMERIC(10, 2) NOT NULL DEFAULT 0,
    hra NUMERIC(10, 2) NOT NULL DEFAULT 0,
    allowances NUMERIC(10, 2) NOT NULL DEFAULT 0,
    role TEXT CHECK (role IN ('Admin', 'HR', 'Employee')) DEFAULT 'Employee',
    is_active BOOLEAN DEFAULT true,
    profile_photo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. ATTENDANCE
CREATE TABLE attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id TEXT REFERENCES profiles(employee_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status TEXT CHECK (status IN ('present', 'absent', 'half_day', 'wfh')) NOT NULL,
    marked_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(employee_id, date)
);

-- 3. LEAVE REQUESTS
CREATE TABLE leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id TEXT REFERENCES profiles(employee_id) ON DELETE CASCADE,
    leave_type TEXT CHECK (leave_type IN ('CL', 'SL', 'PL', 'LWP')) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_count INTEGER NOT NULL CHECK (days_count > 0),
    reason TEXT,
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. LEAVE BALANCES
CREATE TABLE leave_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id TEXT REFERENCES profiles(employee_id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    cl_total INTEGER DEFAULT 12,
    cl_used INTEGER DEFAULT 0,
    sl_total INTEGER DEFAULT 12,
    sl_used INTEGER DEFAULT 0,
    pl_total INTEGER DEFAULT 15,
    pl_used INTEGER DEFAULT 0,
    UNIQUE(employee_id, year)
);

-- 5. PAYROLL
CREATE TABLE payroll (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id TEXT REFERENCES profiles(employee_id) ON DELETE CASCADE,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INTEGER NOT NULL,
    basic NUMERIC(10, 2) NOT NULL,
    hra NUMERIC(10, 2) NOT NULL,
    allowances NUMERIC(10, 2) NOT NULL,
    gross NUMERIC(10, 2) NOT NULL,
    pf_deduction NUMERIC(10, 2) NOT NULL,
    pt_deduction NUMERIC(10, 2) NOT NULL,
    tds_deduction NUMERIC(10, 2) NOT NULL,
    lwp_deduction NUMERIC(10, 2) NOT NULL,
    net_pay NUMERIC(10, 2) NOT NULL,
    payslip_url TEXT,
    generated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(employee_id, month, year)
);

-- ==========================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================================

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll ENABLE ROW LEVEL SECURITY;

-- Helper Function to Get Current User Role
-- (Assuming we will either use JWT claims or look up from profiles)
-- Since we are verifying role in express backend, RLS might just bypass the backend service key.
-- But if the client accesses directly via JS sdk:
CREATE OR REPLACE FUNCTION user_role() RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Profiles:
-- Employees can view their own profile. Admin and HR can view all, Admin and HR can update all. 
CREATE POLICY "Employees can view own profile" ON profiles FOR SELECT USING (auth.uid() = user_id OR user_role() IN ('Admin', 'HR'));
CREATE POLICY "Admins/HR can insert profiles" ON profiles FOR INSERT WITH CHECK (user_role() IN ('Admin', 'HR'));
CREATE POLICY "Admins/HR can update profiles" ON profiles FOR UPDATE USING (user_role() IN ('Admin', 'HR'));

-- Attendance:
-- Employees can view own attendance.
CREATE POLICY "Employees can view own attendance" ON attendance FOR SELECT USING (
    employee_id IN (SELECT employee_id FROM profiles WHERE user_id = auth.uid()) OR user_role() IN ('Admin', 'HR')
);
CREATE POLICY "HR/Admin can manage attendance" ON attendance FOR ALL USING (user_role() IN ('Admin', 'HR'));

-- Leave Requests:
-- Employees can view and create own
CREATE POLICY "Employees can view own leaves" ON leave_requests FOR SELECT USING (
    employee_id IN (SELECT employee_id FROM profiles WHERE user_id = auth.uid()) OR user_role() IN ('Admin', 'HR')
);
CREATE POLICY "Employees can apply for leave" ON leave_requests FOR INSERT WITH CHECK (
    employee_id IN (SELECT employee_id FROM profiles WHERE user_id = auth.uid())
);
CREATE POLICY "HR/Admin can update leaves" ON leave_requests FOR UPDATE USING (user_role() IN ('Admin', 'HR'));

-- Leave Balances:
CREATE POLICY "Employees can view own balance" ON leave_balances FOR SELECT USING (
    employee_id IN (SELECT employee_id FROM profiles WHERE user_id = auth.uid()) OR user_role() IN ('Admin', 'HR')
);
CREATE POLICY "HR/Admin can manage balances" ON leave_balances FOR ALL USING (user_role() IN ('Admin', 'HR'));

-- Payroll:
CREATE POLICY "Employees can view own payroll" ON payroll FOR SELECT USING (
    employee_id IN (SELECT employee_id FROM profiles WHERE user_id = auth.uid()) OR user_role() IN ('Admin', 'HR')
);
CREATE POLICY "HR/Admin can manage payroll" ON payroll FOR ALL USING (user_role() IN ('Admin', 'HR'));

-- ==========================================================
-- Note: In our Express backend, we will primarily interact 
-- with Supabase using the SERVER_ROLE_KEY to bypass RLS 
-- on writes where needed, while strictly validating roles 
-- in the Express middleware before triggering queries.
-- ==========================================================
