const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getCache, clearCache, setCache } = require('../utils/cache');

// Admin/HR get all leaves
router.get('/', requireAuth, requireRole(['Admin', 'HR']), async (req, res) => {
    try {
        const { status } = req.query;
        let query = supabase.from('leave_requests').select('*, profiles!leave_requests_employee_id_fkey(full_name, department)').order('created_at', { ascending: false });
        
        if (status) query = query.eq('status', status);

        if (req.user.role === 'HR') {
            const { data: managed } = await supabase.from('profiles').select('employee_id').eq('reporting_manager_id', req.user.profile_id);
            const managedIds = managed ? managed.map(m => m.employee_id) : [];
            if (managedIds.length === 0) return res.json({ success: true, data: [] });
            query = query.in('employee_id', managedIds);
        }

        const { data, error } = await query;
        if (error) throw error;
        
        res.json({ success: true, data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Failed to fetch leaves' });
    }
});

// Employee apply for leave
router.post('/', requireAuth, async (req, res) => {
    try {
        const { leave_type, start_date, end_date, days_count, reason } = req.body;
        const employee_id = req.user.employee_id;

        const { data, error } = await supabase
            .from('leave_requests')
            .insert([{
                employee_id,
                leave_type,
                start_date,
                end_date,
                days_count,
                reason,
                status: 'pending'
            }])
            .select()
            .single();

        if (error) return res.status(400).json({ success: false, error: error.message });

        res.status(201).json({ success: true, data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Failed to apply for leave' });
    }
});

// HR/Admin approve
router.put('/:id/approve', requireAuth, requireRole(['Admin', 'HR']), async (req, res) => {
    try {
        const { id } = req.params;
        const { remarks } = req.body;

        // Fetch leave
        const { data: request, error: fetchErr } = await supabase.from('leave_requests').select('*').eq('id', id).single();
        if (fetchErr || !request) return res.status(404).json({ success: false, error: 'Leave request not found' });
        
        if (request.status !== 'pending') return res.status(400).json({ success: false, error: 'Already processed' });

        // Update leave request
        const { data, error } = await supabase
            .from('leave_requests')
            .update({ status: 'approved', remarks, reviewed_by: req.user.profile_id })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Update balance
        const year = new Date(request.start_date).getFullYear();
        const type_used = `${request.leave_type.toLowerCase()}_used`; // e.g. cl_used, sl_used, pl_used
        
        if (['CL', 'SL', 'PL'].includes(request.leave_type)) {
            // Need to get current to increment
            const { data: bal } = await supabase.from('leave_balances').select(type_used).eq('employee_id', request.employee_id).eq('year', year).single();
            const currentUsed = bal ? bal[type_used] : 0;
            
            await supabase.from('leave_balances')
                .update({ [type_used]: currentUsed + request.days_count })
                .eq('employee_id', request.employee_id)
                .eq('year', year);
        }

        await clearCache(`leaves:${request.employee_id}`);
        res.json({ success: true, data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Failed to approve leave' });
    }
});

// HR/Admin reject
router.put('/:id/reject', requireAuth, requireRole(['Admin', 'HR']), async (req, res) => {
    try {
        const { id } = req.params;
        const { remarks } = req.body;

        const { data, error } = await supabase
            .from('leave_requests')
            .update({ status: 'rejected', remarks, reviewed_by: req.user.profile_id })
            .eq('id', id)
            .select()
            .single();

        if (error) return res.status(400).json({ success: false, error: error.message });

        res.json({ success: true, data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Failed to reject leave' });
    }
});

// Employee/HR/Admin get balance
router.get('/balance/:employee_id', requireAuth, async (req, res) => {
    try {
        const { employee_id } = req.params;
        const year = new Date().getFullYear();

        if (req.user.role === 'Employee' && req.user.employee_id !== employee_id) {
            return res.status(403).json({ success: false, error: 'Forbidden' });
        }

        const cacheKey = `leaves:balance:${employee_id}:${year}`;
        const cached = await getCache(cacheKey);
        if (cached) return res.json({ success: true, data: cached });

        const { data, error } = await supabase
            .from('leave_balances')
            .select('*')
            .eq('employee_id', employee_id)
            .eq('year', year)
            .single();

        if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
        
        const balanceData = data || { cl_total: 12, cl_used: 0, sl_total: 12, sl_used: 0, pl_total: 15, pl_used: 0 };
        await setCache(cacheKey, balanceData, 3600); // 1hr cache
        res.json({ success: true, data: balanceData });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Failed to fetch balance' });
    }
});

// Get own leave history
router.get('/history/:employee_id', requireAuth, async (req, res) => {
    try {
        const { employee_id } = req.params;
        if (req.user.role === 'Employee' && req.user.employee_id !== employee_id) {
            return res.status(403).json({ success: false, error: 'Forbidden' });
        }
        
        const { data, error } = await supabase
            .from('leave_requests')
            .select('*')
            .eq('employee_id', employee_id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ success: true, data });
    } catch(err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Failed to fetch history' });
    }
});

module.exports = router;
