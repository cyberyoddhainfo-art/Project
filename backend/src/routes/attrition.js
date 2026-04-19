const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getCache, setCache } = require('../utils/cache');

// ─── Configurable Thresholds (sensible locked defaults) ───
const THRESHOLDS = {
    // Pattern A: Sick Leave spike
    SL_MIN_COUNT: parseInt(process.env.ATTRITION_SL_MIN_COUNT) || 3,       // minimum SL days in 30d to trigger
    SL_MULTIPLIER: parseFloat(process.env.ATTRITION_SL_MULTIPLIER) || 3.0, // must be Nx the monthly average

    // Pattern B: Absence spike
    ABS_MIN_COUNT: parseInt(process.env.ATTRITION_ABS_MIN_COUNT) || 4,      // minimum absent days in 30d
    ABS_MULTIPLIER: parseFloat(process.env.ATTRITION_ABS_MULTIPLIER) || 2.0, // must be Nx the monthly average

    // Analysis windows
    RECENT_DAYS: parseInt(process.env.ATTRITION_RECENT_DAYS) || 30,
    BASELINE_MONTHS: parseInt(process.env.ATTRITION_BASELINE_MONTHS) || 12,

    // Cache TTL for bulk dashboard (seconds)
    CACHE_TTL: parseInt(process.env.ATTRITION_CACHE_TTL) || 3600 // 1 hour
};

/**
 * Core analysis function — pure logic, no side effects beyond DB reads.
 * Returns a risk assessment object for a single employee.
 */
async function analyzeAttritionRisk(employeeId) {
    const now = new Date();
    const recentStart = new Date(now);
    recentStart.setDate(recentStart.getDate() - THRESHOLDS.RECENT_DAYS);

    const baselineStart = new Date(now);
    baselineStart.setMonth(baselineStart.getMonth() - THRESHOLDS.BASELINE_MONTHS);

    const nowStr = now.toISOString().split('T')[0];
    const recentStartStr = recentStart.toISOString().split('T')[0];
    const baselineStartStr = baselineStart.toISOString().split('T')[0];

    // ── Fetch data in parallel ──
    const [slRecent, slBaseline, absRecent, absBaseline] = await Promise.all([
        // Recent sick leaves (last 30 days, approved, single-day)
        supabase
            .from('leave_requests')
            .select('id, start_date, end_date, days_count')
            .eq('employee_id', employeeId)
            .eq('leave_type', 'SL')
            .eq('status', 'approved')
            .gte('start_date', recentStartStr)
            .lte('start_date', nowStr),

        // Baseline sick leaves (12 months)
        supabase
            .from('leave_requests')
            .select('id, start_date, days_count')
            .eq('employee_id', employeeId)
            .eq('leave_type', 'SL')
            .eq('status', 'approved')
            .gte('start_date', baselineStartStr)
            .lte('start_date', nowStr),

        // Recent absences (last 30 days)
        supabase
            .from('attendance')
            .select('id, date')
            .eq('employee_id', employeeId)
            .eq('status', 'absent')
            .gte('date', recentStartStr)
            .lte('date', nowStr),

        // Baseline absences (12 months)
        supabase
            .from('attendance')
            .select('id, date')
            .eq('employee_id', employeeId)
            .eq('status', 'absent')
            .gte('date', baselineStartStr)
            .lte('date', nowStr)
    ]);

    // ── Compute metrics ──
    const recentSLCount = (slRecent.data || []).length;
    const baselineSLCount = (slBaseline.data || []).length;
    const slMonthlyAvg = baselineSLCount / THRESHOLDS.BASELINE_MONTHS;

    const recentAbsCount = (absRecent.data || []).length;
    const baselineAbsCount = (absBaseline.data || []).length;
    const absMonthlyAvg = baselineAbsCount / THRESHOLDS.BASELINE_MONTHS;

    // ── Evaluate triggers ──
    const flags = [];

    // Pattern A: SL spike
    if (recentSLCount >= THRESHOLDS.SL_MIN_COUNT &&
        (slMonthlyAvg === 0 || recentSLCount >= slMonthlyAvg * THRESHOLDS.SL_MULTIPLIER)) {
        flags.push({
            pattern: 'sick_leave_spike',
            label: 'Unusual sick leave pattern',
            recent_count: recentSLCount,
            monthly_average: Math.round(slMonthlyAvg * 10) / 10,
            detail: `${recentSLCount} sick leave${recentSLCount !== 1 ? 's' : ''} in the last ${THRESHOLDS.RECENT_DAYS} days vs. average of ${(Math.round(slMonthlyAvg * 10) / 10)}/month`
        });
    }

    // Pattern B: Absence spike
    if (recentAbsCount >= THRESHOLDS.ABS_MIN_COUNT &&
        (absMonthlyAvg === 0 || recentAbsCount >= absMonthlyAvg * THRESHOLDS.ABS_MULTIPLIER)) {
        flags.push({
            pattern: 'absence_spike',
            label: 'Unusual absence pattern',
            recent_count: recentAbsCount,
            monthly_average: Math.round(absMonthlyAvg * 10) / 10,
            detail: `${recentAbsCount} absence${recentAbsCount !== 1 ? 's' : ''} in the last ${THRESHOLDS.RECENT_DAYS} days vs. average of ${(Math.round(absMonthlyAvg * 10) / 10)}/month`
        });
    }

    // ── Risk level ──
    let risk_level = 'normal';
    let recommendation = 'No unusual patterns detected.';
    if (flags.length === 1) {
        risk_level = 'amber';
        recommendation = 'Notice: Unusual attendance pattern detected in last 30 days. Consider a well-being check-in.';
    } else if (flags.length >= 2) {
        risk_level = 'red';
        recommendation = 'Alert: Multiple attendance anomalies detected. A well-being check-in is strongly recommended.';
    }

    return {
        employee_id: employeeId,
        risk_level,
        flags,
        recommendation,
        analysis_period: { from: recentStartStr, to: nowStr },
        baseline_period: { from: baselineStartStr, to: nowStr }
    };
}

// ─────────────────────────────────────────────
// GET /api/attrition/pulse/:employee_id
// Single employee pulse — Admin, HR, or Self
// ─────────────────────────────────────────────
router.get('/pulse/:employee_id', requireAuth, async (req, res) => {
    try {
        const { employee_id } = req.params;

        // Access control: self, Admin, or HR
        if (req.user.role === 'Employee' && req.user.employee_id !== employee_id) {
            return res.status(403).json({ success: false, error: 'Forbidden' });
        }

        const result = await analyzeAttritionRisk(employee_id);
        res.json({ success: true, data: result });
    } catch (err) {
        console.error('[Attrition Pulse Error]:', err);
        res.status(500).json({ success: false, error: 'Failed to analyze attrition risk' });
    }
});

// ─────────────────────────────────────────────
// GET /api/attrition/pulse
// Bulk scan for Admin/HR dashboard — cached 1hr
// ─────────────────────────────────────────────
router.get('/pulse', requireAuth, requireRole(['Admin', 'HR']), async (req, res) => {
    try {
        // Scope to managed employees for HR
        const isHR = req.user.role === 'HR';
        const cacheKey = isHR ? `attrition:pulse:hr:${req.user.profile_id}` : 'attrition:pulse:all';

        const cached = await getCache(cacheKey);
        if (cached) return res.json({ success: true, data: cached, cached: true });

        // Get employee list
        let empQuery = supabase.from('profiles').select('employee_id, full_name, department, designation').eq('is_active', true);
        if (isHR) {
            empQuery = empQuery.eq('reporting_manager_id', req.user.profile_id);
        }

        const { data: employees, error: empError } = await empQuery;
        if (empError) throw empError;
        if (!employees || employees.length === 0) {
            return res.json({ success: true, data: { flagged: [], summary: { total: 0, amber: 0, red: 0 } } });
        }

        // Analyze each employee
        const analyses = await Promise.all(
            employees.map(async (emp) => {
                const risk = await analyzeAttritionRisk(emp.employee_id);
                return {
                    ...risk,
                    full_name: emp.full_name,
                    department: emp.department,
                    designation: emp.designation
                };
            })
        );

        const flagged = analyses.filter(a => a.risk_level !== 'normal');
        const summary = {
            total: employees.length,
            amber: analyses.filter(a => a.risk_level === 'amber').length,
            red: analyses.filter(a => a.risk_level === 'red').length
        };

        const result = { flagged, summary };
        await setCache(cacheKey, result, THRESHOLDS.CACHE_TTL);

        res.json({ success: true, data: result });
    } catch (err) {
        console.error('[Attrition Bulk Pulse Error]:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch attrition pulse data' });
    }
});

// ─────────────────────────────────────────────
// GET /api/attrition/thresholds
// Returns current threshold config (Admin only)
// ─────────────────────────────────────────────
router.get('/thresholds', requireAuth, requireRole(['Admin']), async (req, res) => {
    res.json({
        success: true,
        data: {
            sl_min_count: THRESHOLDS.SL_MIN_COUNT,
            sl_multiplier: THRESHOLDS.SL_MULTIPLIER,
            abs_min_count: THRESHOLDS.ABS_MIN_COUNT,
            abs_multiplier: THRESHOLDS.ABS_MULTIPLIER,
            recent_days: THRESHOLDS.RECENT_DAYS,
            baseline_months: THRESHOLDS.BASELINE_MONTHS,
            cache_ttl_seconds: THRESHOLDS.CACHE_TTL,
            note: 'Configure via environment variables: ATTRITION_SL_MIN_COUNT, ATTRITION_SL_MULTIPLIER, ATTRITION_ABS_MIN_COUNT, ATTRITION_ABS_MULTIPLIER, ATTRITION_RECENT_DAYS, ATTRITION_BASELINE_MONTHS, ATTRITION_CACHE_TTL'
        }
    });
});

module.exports = router;
