/**
 * ══════════════════════════════════════════════════════════
 *  CloudHR Demo Data Seed Script
 *  Run: node src/seed.js
 * ══════════════════════════════════════════════════════════
 *
 *  Creates 8 employees with realistic attendance, leave,
 *  and payroll data. Intentionally crafts 2 employees with
 *  attrition-triggering patterns so the Pulse feature demos well.
 *
 *  All demo employees use password: Demo@1234
 * ══════════════════════════════════════════════════════════
 */

require('dotenv').config();
const supabase = require('./config/supabase');
const { encrypt } = require('./utils/encryption');

const DEMO_PASSWORD = 'Demo@1234';

// ─── Employee profiles ───
const EMPLOYEES = [
    {
        email: 'priya.sharma@cloudhr.demo',
        full_name: 'Priya Sharma',
        employee_id: 'EMP001',
        department: 'Engineering',
        designation: 'Senior Developer',
        joining_date: '2024-03-15',
        phone: '9876543210',
        bank_account: '1234567890123456',
        salary_basic: 65000, hra: 26000, allowances: 8000,
        role: 'Employee'
    },
    {
        email: 'rahul.verma@cloudhr.demo',
        full_name: 'Rahul Verma',
        employee_id: 'EMP002',
        department: 'Engineering',
        designation: 'Full Stack Developer',
        joining_date: '2024-06-01',
        phone: '9876543211',
        bank_account: '2345678901234567',
        salary_basic: 55000, hra: 22000, allowances: 6000,
        role: 'Employee'
    },
    {
        email: 'anita.desai@cloudhr.demo',
        full_name: 'Anita Desai',
        employee_id: 'EMP003',
        department: 'Design',
        designation: 'UI/UX Lead',
        joining_date: '2024-01-10',
        phone: '9876543212',
        bank_account: '3456789012345678',
        salary_basic: 60000, hra: 24000, allowances: 7500,
        role: 'Employee'
    },
    {
        email: 'vikram.patel@cloudhr.demo',
        full_name: 'Vikram Patel',
        employee_id: 'EMP004',
        department: 'Marketing',
        designation: 'Marketing Manager',
        joining_date: '2023-11-20',
        phone: '9876543213',
        bank_account: '4567890123456789',
        salary_basic: 70000, hra: 28000, allowances: 9000,
        role: 'Employee'
    },
    {
        email: 'sneha.reddy@cloudhr.demo',
        full_name: 'Sneha Reddy',
        employee_id: 'EMP005',
        department: 'Engineering',
        designation: 'QA Engineer',
        joining_date: '2024-08-12',
        phone: '9876543214',
        bank_account: '5678901234567890',
        salary_basic: 48000, hra: 19200, allowances: 5000,
        role: 'Employee'
    },
    {
        email: 'arjun.nair@cloudhr.demo',
        full_name: 'Arjun Nair',
        employee_id: 'EMP006',
        department: 'Finance',
        designation: 'Finance Analyst',
        joining_date: '2024-04-22',
        phone: '9876543215',
        bank_account: '6789012345678901',
        salary_basic: 52000, hra: 20800, allowances: 6500,
        role: 'Employee'
    },
    {
        // HR Manager
        email: 'meera.kumar@cloudhr.demo',
        full_name: 'Meera Kumar',
        employee_id: 'HR001',
        department: 'Human Resources',
        designation: 'HR Manager',
        joining_date: '2023-06-01',
        phone: '9876543216',
        bank_account: '7890123456789012',
        salary_basic: 75000, hra: 30000, allowances: 10000,
        role: 'HR'
    },
    {
        // Admin
        email: 'admin@cloudhr.demo',
        full_name: 'System Admin',
        employee_id: 'ADM001',
        department: 'IT',
        designation: 'System Administrator',
        joining_date: '2023-01-01',
        phone: '9876543217',
        bank_account: '8901234567890123',
        salary_basic: 85000, hra: 34000, allowances: 12000,
        role: 'Admin'
    }
];

// ─── Helpers ───

function dateStr(d) {
    return d.toISOString().split('T')[0];
}

function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
}

function isWeekday(d) {
    const day = d.getDay();
    return day !== 0 && day !== 6;
}

/** Generate attendance for an employee over last N months */
function generateAttendance(employeeId, monthsBack, absentPattern = 'normal') {
    const records = [];
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - monthsBack);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (!isWeekday(d)) continue;

        let status = 'present';
        const rand = Math.random();

        if (absentPattern === 'spike_recent') {
            // Last 30 days: high absence rate
            const isRecent = (end - d) / (1000 * 60 * 60 * 24) <= 30;
            if (isRecent) {
                if (rand < 0.25) status = 'absent';       // 25% absent recently
                else if (rand < 0.3) status = 'half_day';
                else if (rand < 0.35) status = 'wfh';
            } else {
                if (rand < 0.04) status = 'absent';       // 4% normally
                else if (rand < 0.07) status = 'half_day';
                else if (rand < 0.12) status = 'wfh';
            }
        } else {
            // Normal pattern
            if (rand < 0.04) status = 'absent';
            else if (rand < 0.08) status = 'half_day';
            else if (rand < 0.15) status = 'wfh';
        }

        records.push({
            employee_id: employeeId,
            date: dateStr(new Date(d)),
            status
        });
    }
    return records;
}

/** Generate leave requests */
function generateLeaves(employeeId, leavePattern = 'normal') {
    const leaves = [];
    const year = new Date().getFullYear();

    if (leavePattern === 'sl_spike') {
        // Pattern: 4 single-day SL in the last 30 days (triggers attrition flag)
        for (let i = 0; i < 4; i++) {
            const d = daysAgo(5 + i * 6); // spread across last 30 days
            if (!isWeekday(d)) d.setDate(d.getDate() - 1);
            leaves.push({
                employee_id: employeeId,
                leave_type: 'SL',
                start_date: dateStr(d),
                end_date: dateStr(d),
                days_count: 1,
                reason: ['Migraine', 'Stomach bug', 'Fever', 'Body ache'][i],
                status: 'approved'
            });
        }
        // Also add 1 normal SL from months ago (baseline)
        const oldSL = daysAgo(180);
        leaves.push({
            employee_id: employeeId,
            leave_type: 'SL',
            start_date: dateStr(oldSL),
            end_date: dateStr(oldSL),
            days_count: 1,
            reason: 'Cold',
            status: 'approved'
        });
    }

    // Normal leave history for everyone
    // 1-2 CL in past months
    const cl1 = daysAgo(90);
    leaves.push({
        employee_id: employeeId,
        leave_type: 'CL',
        start_date: dateStr(cl1),
        end_date: dateStr(new Date(cl1.getTime() + 86400000)),
        days_count: 2,
        reason: 'Family function',
        status: 'approved'
    });

    // 1 PL trip
    const pl1 = daysAgo(150);
    const pl1End = new Date(pl1.getTime() + 4 * 86400000);
    leaves.push({
        employee_id: employeeId,
        leave_type: 'PL',
        start_date: dateStr(pl1),
        end_date: dateStr(pl1End),
        days_count: 5,
        reason: 'Vacation trip',
        status: 'approved'
    });

    // 1 pending leave (for demo)
    if (leavePattern === 'normal' && Math.random() > 0.5) {
        const future = new Date();
        future.setDate(future.getDate() + 5);
        leaves.push({
            employee_id: employeeId,
            leave_type: 'CL',
            start_date: dateStr(future),
            end_date: dateStr(future),
            days_count: 1,
            reason: 'Personal errand',
            status: 'pending'
        });
    }

    return leaves;
}

// ─── Main seeder ───

async function seed() {
    console.log('🌱 Starting CloudHR demo data seed...\n');

    const profileIdMap = {}; // employee_id -> profile UUID
    let hrProfileId = null;

    // ── Step 1: Create auth users + profiles ──
    console.log('👤 Creating employees...');
    for (const emp of EMPLOYEES) {
        // Create Supabase auth user
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: emp.email,
            password: DEMO_PASSWORD,
            email_confirm: true
        });

        if (authError) {
            if (authError.message.includes('already been registered')) {
                console.log(`  ⏭️  ${emp.full_name} (${emp.email}) already exists, skipping...`);
                // Fetch existing profile
                const { data: existing } = await supabase.from('profiles').select('id').eq('employee_id', emp.employee_id).single();
                if (existing) {
                    profileIdMap[emp.employee_id] = existing.id;
                    if (emp.role === 'HR') hrProfileId = existing.id;
                }
                continue;
            }
            console.error(`  ❌ Failed to create ${emp.full_name}:`, authError.message);
            continue;
        }

        const encryptedBank = encrypt(emp.bank_account);
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .insert([{
                user_id: authData.user.id,
                full_name: emp.full_name,
                employee_id: emp.employee_id,
                department: emp.department,
                designation: emp.designation,
                joining_date: emp.joining_date,
                phone: emp.phone,
                bank_account_encrypted: encryptedBank,
                salary_basic: emp.salary_basic,
                hra: emp.hra,
                allowances: emp.allowances,
                role: emp.role
            }])
            .select()
            .single();

        if (profileError) {
            console.error(`  ❌ Profile insert failed for ${emp.full_name}:`, profileError.message);
            await supabase.auth.admin.deleteUser(authData.user.id);
            continue;
        }

        profileIdMap[emp.employee_id] = profile.id;
        if (emp.role === 'HR') hrProfileId = profile.id;

        // Initialize leave balance
        const year = new Date().getFullYear();
        await supabase.from('leave_balances').upsert([{
            employee_id: emp.employee_id,
            year
        }], { onConflict: 'employee_id,year' });

        console.log(`  ✅ ${emp.full_name} (${emp.role}) — ${emp.email}`);
    }

    // ── Step 2: Assign HR as reporting manager for employees ──
    if (hrProfileId) {
        console.log('\n🔗 Assigning reporting manager...');
        for (const empId of ['EMP001', 'EMP002', 'EMP003', 'EMP004', 'EMP005', 'EMP006']) {
            if (profileIdMap[empId]) {
                await supabase.from('profiles').update({ reporting_manager_id: hrProfileId }).eq('id', profileIdMap[empId]);
            }
        }
        console.log(`  ✅ All employees report to Meera Kumar (HR)`);
    }

    // ── Step 3: Generate attendance ──
    console.log('\n📅 Generating attendance records...');

    // EMP002 (Rahul) — will have absence spike pattern
    const attritionEmployees = {
        'EMP002': 'spike_recent',  // Rahul: absence spike → triggers Pattern B
        'EMP004': 'normal'         // Vikram: normal attendance (but will have SL spike via leaves)
    };

    for (const emp of EMPLOYEES) {
        if (emp.role === 'Admin') continue; // Skip admin for attendance

        const pattern = attritionEmployees[emp.employee_id] || 'normal';
        const records = generateAttendance(emp.employee_id, 12, pattern);

        // Upsert in batches of 50
        for (let i = 0; i < records.length; i += 50) {
            const batch = records.slice(i, i + 50);
            const { error } = await supabase.from('attendance').upsert(batch, { onConflict: 'employee_id,date' });
            if (error) console.error(`  ⚠️ Attendance batch error for ${emp.employee_id}:`, error.message);
        }
        console.log(`  ✅ ${emp.full_name}: ${records.length} attendance records (pattern: ${pattern})`);
    }

    // ── Step 4: Generate leave requests ──
    console.log('\n🏖️  Generating leave requests...');

    // EMP004 (Vikram) — SL spike pattern (triggers attrition Pattern A)
    const leavePatterns = {
        'EMP004': 'sl_spike',  // Vikram: 4 SL in last 30 days
        'EMP002': 'sl_spike'   // Rahul: also SL spike (will be RED — both patterns)
    };

    for (const emp of EMPLOYEES) {
        if (emp.role === 'Admin') continue;

        const pattern = leavePatterns[emp.employee_id] || 'normal';
        const leaves = generateLeaves(emp.employee_id, pattern);

        for (const leave of leaves) {
            const { error } = await supabase.from('leave_requests').insert([leave]);
            if (error && !error.message.includes('duplicate')) {
                console.error(`  ⚠️ Leave error for ${emp.employee_id}:`, error.message);
            }
        }

        // Update leave balances based on approved leaves
        const approvedLeaves = leaves.filter(l => l.status === 'approved');
        const year = new Date().getFullYear();
        const balanceUpdate = {};
        for (const l of approvedLeaves) {
            const key = `${l.leave_type.toLowerCase()}_used`;
            balanceUpdate[key] = (balanceUpdate[key] || 0) + l.days_count;
        }
        if (Object.keys(balanceUpdate).length > 0) {
            await supabase.from('leave_balances').update(balanceUpdate)
                .eq('employee_id', emp.employee_id)
                .eq('year', year);
        }

        console.log(`  ✅ ${emp.full_name}: ${leaves.length} leave requests (pattern: ${pattern})`);
    }

    // ── Step 5: Generate payroll for last 3 months ──
    console.log('\n💰 Generating payroll records...');

    const now = new Date();
    for (const emp of EMPLOYEES) {
        if (emp.role === 'Admin') continue;

        for (let m = 1; m <= 3; m++) {
            const payMonth = new Date(now);
            payMonth.setMonth(payMonth.getMonth() - m);
            const month = payMonth.getMonth() + 1;
            const year = payMonth.getFullYear();

            const gross = emp.salary_basic + emp.hra + emp.allowances;
            const pf = Math.round(emp.salary_basic * 0.12);
            const pt = 200;
            const tds = Math.round(gross * 0.05);
            const lwp = 0;
            const net = gross - pf - pt - tds - lwp;

            const { error } = await supabase.from('payroll').upsert([{
                employee_id: emp.employee_id,
                month,
                year,
                basic: emp.salary_basic,
                hra: emp.hra,
                allowances: emp.allowances,
                gross,
                pf_deduction: pf,
                pt_deduction: pt,
                tds_deduction: tds,
                lwp_deduction: lwp,
                net_pay: net
            }], { onConflict: 'employee_id,month,year' });

            if (error) console.error(`  ⚠️ Payroll error for ${emp.employee_id}:`, error.message);
        }
        console.log(`  ✅ ${emp.full_name}: 3 months payroll`);
    }

    // ── Done ──
    console.log('\n══════════════════════════════════════════════════');
    console.log('🎉 Demo data seed complete!\n');
    console.log('📋 Login Credentials (all use password: Demo@1234):');
    console.log('─────────────────────────────────────────────────');
    console.log('  Admin:    admin@cloudhr.demo');
    console.log('  HR:       meera.kumar@cloudhr.demo');
    console.log('  Employee: priya.sharma@cloudhr.demo');
    console.log('  Employee: rahul.verma@cloudhr.demo    ← RED attrition flag (SL + absence spike)');
    console.log('  Employee: vikram.patel@cloudhr.demo   ← AMBER attrition flag (SL spike)');
    console.log('  Employee: anita.desai@cloudhr.demo');
    console.log('  Employee: sneha.reddy@cloudhr.demo');
    console.log('  Employee: arjun.nair@cloudhr.demo');
    console.log('══════════════════════════════════════════════════\n');
}

seed().catch(err => {
    console.error('💥 Seed failed:', err);
    process.exit(1);
});
