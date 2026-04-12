const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { requireAuth, requireRole } = require('../middleware/auth');
const { encrypt, decrypt } = require('../utils/encryption');
const { getCache, setCache, clearCache } = require('../utils/cache');

// Admin/HR can GET all employees
router.get('/', requireAuth, requireRole(['Admin', 'HR']), async (req, res) => {
    try {
        const isHR = req.user.role === 'HR';
        const cacheKey = isHR ? `employees:hr:${req.user.profile_id}` : 'employees:all';
        const cached = await getCache(cacheKey);
        if (cached) return res.json({ success: true, data: cached });

        let query = supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (isHR) {
            query = query.eq('reporting_manager_id', req.user.profile_id);
        }

        const { data, error } = await query;

        if (error) throw error;
        
        // Don't leak decrypted bank to everyone in bulk list
        const sanitized = data.map(u => {
            const { bank_account_encrypted, ...rest } = u;
            return rest;
        });

        await setCache(cacheKey, sanitized, 300); // 5 min cache
        res.json({ success: true, data: sanitized });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Failed to fetch employees' });
    }
});

// Admin/HR can POST a new employee
router.post('/', requireAuth, requireRole(['Admin', 'HR']), async (req, res) => {
    try {
        const { email, password, full_name, employee_id, department, designation, joining_date, phone, bank_account, salary_basic, hra, allowances, role, reporting_manager_id } = req.body;

        // Create auth user
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true
        });

        if (authError) return res.status(400).json({ success: false, error: authError.message });

        // Insert profile
        const encryptedBank = encrypt(bank_account);

        const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .insert([{
                user_id: authData.user.id,
                full_name,
                employee_id,
                department,
                designation,
                joining_date,
                phone,
                bank_account_encrypted: encryptedBank,
                salary_basic: salary_basic || 0,
                hra: hra || 0,
                allowances: allowances || 0,
                role: role || 'Employee',
                reporting_manager_id: reporting_manager_id || null
            }])
            .select()
            .single();

        if (profileError) {
            // Rollback auth user
            await supabase.auth.admin.deleteUser(authData.user.id);
            return res.status(400).json({ success: false, error: profileError.message });
        }
        
        // Initialize leave balance for new employee
        const currentYear = new Date().getFullYear();
        await supabase.from('leave_balances').insert([{
            employee_id,
            year: currentYear
        }]);

        await clearCache('employees:');
        res.status(201).json({ success: true, data: profileData });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Failed to create employee' });
    }
});

// Update an employee
router.put('/:id', requireAuth, requireRole(['Admin', 'HR']), async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        if (updates.bank_account) {
            updates.bank_account_encrypted = encrypt(updates.bank_account);
            delete updates.bank_account;
        }
        
        if (updates.reporting_manager_id === '') {
            updates.reporting_manager_id = null;
        }

        const { data, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) return res.status(400).json({ success: false, error: error.message });

        await clearCache('employees:');
        res.json({ success: true, data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Failed to update employee' });
    }
});

// GET specific employee
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;

        // Employees can only view themselves
        if (req.user.role === 'Employee' && req.user.profile_id !== id) {
            return res.status(403).json({ success: false, error: 'Forbidden' });
        }

        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', id)
            .single();

        if (error) return res.status(404).json({ success: false, error: 'Employee not found' });

        // Decrypt bank if authorized Admin/HR or Self
        if (data.bank_account_encrypted) {
            data.bank_account = decrypt(data.bank_account_encrypted);
        }

        res.json({ success: true, data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Failed to fetch employee' });
    }
});

module.exports = router;
