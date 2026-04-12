const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { requireAuth, requireRole } = require('../middleware/auth');

// GET all attendance
router.get('/', requireAuth, requireRole(['Admin', 'HR']), async (req, res) => {
    try {
        const { date, employee_id } = req.query;
        let query = supabase.from('attendance').select('*, profiles!attendance_employee_id_fkey(full_name, department)');

        if (date) query = query.eq('date', date);
        if (employee_id) query = query.eq('employee_id', employee_id);

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
        res.status(500).json({ success: false, error: 'Failed to fetch attendance' });
    }
});

// GET attendance for a specific employee
router.get('/:employee_id', requireAuth, async (req, res) => {
    try {
        const { employee_id } = req.params;
        const { month, year } = req.query; // optional filters

        if (req.user.role === 'Employee' && req.user.employee_id !== employee_id) {
            return res.status(403).json({ success: false, error: 'Forbidden' });
        }

        let query = supabase.from('attendance').select('*').eq('employee_id', employee_id);
        
        if (month && year) {
            const start = new Date(year, month - 1, 1).toISOString().split('T')[0];
            const end = new Date(year, month, 0).toISOString().split('T')[0];
            query = query.gte('date', start).lte('date', end);
        }

        const { data, error } = await query;
        if (error) throw error;

        res.json({ success: true, data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Failed to fetch attendance' });
    }
});

// POST single attendance
router.post('/', requireAuth, requireRole(['Admin', 'HR']), async (req, res) => {
    try {
        const { employee_id, date, status } = req.body;

        const { data, error } = await supabase
            .from('attendance')
            .upsert({
                employee_id,
                date,
                status,
                marked_by: req.user.profile_id
            }, { onConflict: 'employee_id,date' })
            .select()
            .single();

        if (error) return res.status(400).json({ success: false, error: error.message });

        res.status(201).json({ success: true, data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Failed to mark attendance' });
    }
});

// POST bulk upload
router.post('/bulk', requireAuth, requireRole(['Admin', 'HR']), async (req, res) => {
    try {
        const { records } = req.body; // Array of {employee_id, date, status}
        if (!Array.isArray(records)) return res.status(400).json({ success: false, error: 'Invalid data format' });

        const toInsert = records.map(r => ({
            employee_id: r.employee_id,
            date: r.date,
            status: r.status,
            marked_by: req.user.profile_id
        }));

        const { data, error } = await supabase
            .from('attendance')
            .upsert(toInsert, { onConflict: 'employee_id,date' })
            .select();

        if (error) return res.status(400).json({ success: false, error: error.message });

        res.status(201).json({ success: true, data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Failed to bulk upload attendance' });
    }
});

// Employee mark own attendance
router.post('/self', requireAuth, async (req, res) => {
    try {
        const { date, status } = req.body;
        // status allowed: 'present', 'wfh'
        let finalStatus = status;
        if (status === 'wfh') finalStatus = 'pending_wfh';
        
        const { data, error } = await supabase
            .from('attendance')
            .upsert({
                employee_id: req.user.employee_id,
                date,
                status: finalStatus,
                marked_by: req.user.profile_id
            }, { onConflict: 'employee_id,date' })
            .select()
            .single();

        if (error) {
            console.error('[Supabase Upsert Error]:', error);
            return res.status(400).json({ success: false, error: error.message });
        }
        res.status(201).json({ success: true, data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Failed to mark self attendance' });
    }
});

// HR/Admin approve WFH
router.put('/:id/approve-wfh', requireAuth, requireRole(['Admin', 'HR']), async (req, res) => {
    try {
        const { id } = req.params;
        
        const { data, error } = await supabase
            .from('attendance')
            .update({ status: 'wfh' })
            .eq('id', id)
            .eq('status', 'pending_wfh')
            .select()
            .single();

        if (error) return res.status(400).json({ success: false, error: error.message });
        res.json({ success: true, data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Failed to approve wfh' });
    }
});

module.exports = router;
