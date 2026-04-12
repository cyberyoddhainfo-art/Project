const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getCache, setCache, clearCache } = require('../utils/cache');
const { generatePayslipPDF, uploadPayslipToSupabase, getPayslipSignedUrl } = require('../services/pdf');

// GET all payroll records
router.get('/', requireAuth, requireRole(['Admin', 'HR']), async (req, res) => {
    try {
        const { month, year } = req.query;
        let query = supabase.from('payroll').select('*, profiles!payroll_employee_id_fkey(full_name, employee_id, department)').order('generated_at', { ascending: false });

        if (month) query = query.eq('month', month);
        if (year) query = query.eq('year', year);

        if (req.user.role === 'HR') {
            const { data: managed } = await supabase.from('profiles').select('employee_id').eq('reporting_manager_id', req.user.profile_id);
            const managedIds = managed ? managed.map(m => m.employee_id) : [];
            if (managedIds.length === 0) return res.json({ success: true, data: [] });
            query = query.in('employee_id', managedIds);
        }

        // Fetch from cache for default latest if no specific queries
        const cacheKey = `payroll:all:${month || 'any'}:${year || 'any'}`;
        const cached = await getCache(cacheKey);
        if (cached) return res.json({ success: true, data: cached });

        const { data, error } = await query;
        if (error) throw error;

        await setCache(cacheKey, data, 300); // 5 min cache
        res.json({ success: true, data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Failed to fetch payroll records' });
    }
});

// GET payroll for specific employee
router.get('/:employee_id', requireAuth, async (req, res) => {
    try {
        const { employee_id } = req.params;
        
        if (req.user.role === 'Employee' && req.user.employee_id !== employee_id) {
            return res.status(403).json({ success: false, error: 'Forbidden' });
        }

        const { data, error } = await supabase
            .from('payroll')
            .select('*')
            .eq('employee_id', employee_id)
            .order('year', { ascending: false })
            .order('month', { ascending: false });

        if (error) throw error;

        res.json({ success: true, data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Failed to fetch employee payroll' });
    }
});

// GET Payslip Download link
router.get('/:id/payslip', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        
        const { data: record, error } = await supabase.from('payroll').select('*').eq('id', id).single();
        if (error || !record) return res.status(404).json({ success: false, error: 'Payslip not found' });

        if (req.user.role === 'Employee' && req.user.employee_id !== record.employee_id) {
            return res.status(403).json({ success: false, error: 'Forbidden' });
        }

        if (!record.payslip_url) {
            return res.status(404).json({ success: false, error: 'PDF not generated yet' });
        }

        const signedUrl = await getPayslipSignedUrl(record.payslip_url);
        if (!signedUrl) return res.status(500).json({ success: false, error: 'Storage configured incorrectly' });

        res.json({ success: true, data: { url: signedUrl } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Failed to get payslip' });
    }
});

// POST Run monthly payroll
router.post('/run', requireAuth, requireRole(['Admin', 'HR']), async (req, res) => {
    try {
        const { month, year, employee_ids } = req.body;
        
        if (!month || !year) return res.status(400).json({ success: false, error: 'Month and year required' });

        // Get employees to process
        let query = supabase.from('profiles').select('*').eq('is_active', true);
        if (employee_ids && employee_ids.length > 0) {
            query = query.in('employee_id', employee_ids);
        }
        if (req.user.role === 'HR') {
            query = query.eq('reporting_manager_id', req.user.profile_id);
        }

        const { data: employees, error: empErr } = await query;
        if (empErr || !employees) throw empErr;

        let processedCount = 0;
        const results = [];

        for (const emp of employees) {
            // Check if already generated for this month
            const { data: existing } = await supabase.from('payroll').select('id').eq('employee_id', emp.employee_id).eq('month', month).eq('year', year).single();
            if (existing) {
                results.push({ employee_id: emp.employee_id, status: 'skipped', reason: 'Already processed' });
                continue;
            }

            // Calculate active working days vs LWP
            const startStr = new Date(year, month - 1, 1).toISOString().split('T')[0];
            const endStr = new Date(year, month, 0).toISOString().split('T')[0];
            
            // Note: simple calculation based on 30 standard days
            const standardDays = 30;

            const { data: lwps } = await supabase.from('leave_requests')
                .select('days_count')
                .eq('employee_id', emp.employee_id)
                .eq('status', 'approved')
                .eq('leave_type', 'LWP')
                .gte('start_date', startStr)
                .lte('start_date', endStr);

            let lwpDays = 0;
            if (lwps) lwps.forEach(l => lwpDays += l.days_count);

            const basic = emp.salary_basic || 0;
            const hra = emp.hra || 0;
            const allowances = emp.allowances || 0;
            const grossMonthly = basic + hra + allowances;

            const pf_deduction = basic * 0.12; // 12% of basic
            const pt_deduction = 200; // Rs 200 standard
            const tds_deduction = grossMonthly > 50000 ? grossMonthly * 0.1 : 0; // simple slab
            
            const lwp_deduction = parseFloat(((grossMonthly / standardDays) * lwpDays).toFixed(2));

            const total_deductions = pf_deduction + pt_deduction + tds_deduction + lwp_deduction;
            let net_pay = parseFloat((grossMonthly - total_deductions).toFixed(2));
            if (net_pay < 0) net_pay = 0;

            const payrollRecord = {
                employee_id: emp.employee_id,
                month,
                year,
                basic,
                hra,
                allowances,
                gross: grossMonthly,
                pf_deduction,
                pt_deduction,
                tds_deduction,
                lwp_deduction,
                net_pay,
                generated_by: req.user.profile_id
            };

            // Generate payslip PDF
            let pdfUrl = null;
            try {
                const pdfBuffer = await generatePayslipPDF(emp, payrollRecord);
                pdfUrl = await uploadPayslipToSupabase(emp.employee_id, month, year, pdfBuffer);
            } catch (err) {
                console.error("PDF generation failed for", emp.employee_id, err);
            }

            payrollRecord.payslip_url = pdfUrl;

            // Insert into DB
            const { error: insertErr } = await supabase.from('payroll').insert([payrollRecord]);
            if (insertErr) {
                results.push({ employee_id: emp.employee_id, status: 'error', reason: insertErr.message });
            } else {
                processedCount++;
                results.push({ employee_id: emp.employee_id, status: 'success' });
            }
        }

        await clearCache('payroll:all:');
        res.json({ success: true, processedCount, results });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Failed to run payroll' });
    }
});

module.exports = router;
