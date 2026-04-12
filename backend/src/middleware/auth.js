const supabase = require('../config/supabase');

// Middleware to protect routes via Supabase Auth standard JWT
const requireAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, error: 'Unauthorized: Missing or invalid token' });
        }

        const token = authHeader.split(' ')[1];
        
        // Let's decode and verify the JWT with Supabase
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({ success: false, error: 'Unauthorized: Invalid token' });
        }

        // Fetch user profile to get the Role
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', user.id)
            .single();

        if (profileError || !profile) {
            return res.status(403).json({ success: false, error: 'Forbidden: User profile not found' });
        }

        req.user = {
            id: user.id,
            profile_id: profile.id,
            employee_id: profile.employee_id,
            role: profile.role
        };
        next();
    } catch (err) {
        console.error('Auth Error:', err);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
};

// Middleware to restrict access to specific roles
const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ success: false, error: 'Forbidden: Insufficient permissions' });
        }
        next();
    };
};

module.exports = { requireAuth, requireRole };
