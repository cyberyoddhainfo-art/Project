const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

const { createClient } = require('@supabase/supabase-js');

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Email and password required' });
        }

        const tempSupabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
            auth: { persistSession: false, autoRefreshToken: false }
        });

        const { data, error } = await tempSupabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            return res.status(401).json({ success: false, error: error.message });
        }

        // Fetch User profile to get role
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role, employee_id, full_name')
            .eq('user_id', data.user.id)
            .single();

        if (profileError || !profile) {
            // Usually, this shouldn't happen unless profile setup fails at creation.
            return res.status(403).json({ success: false, error: 'Profile not found. Contact Admin.' });
        }

        res.json({
            success: true,
            data: {
                session: data.session,
                user: {
                    id: data.user.id,
                    email: data.user.email,
                    role: profile.role,
                    employee_id: profile.employee_id,
                    full_name: profile.full_name
                }
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

module.exports = router;
