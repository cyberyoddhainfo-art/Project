const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Try to read keys from .env.example since that is what is currently populated
const envFile = fs.readFileSync(path.join(__dirname, '.env.example'), 'utf-8');
const lines = envFile.split('\n');
let url, key;
for(let line of lines) {
    if(line.startsWith('SUPABASE_URL=')) url = line.split('=')[1].trim();
    if(line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].trim();
}

if (!url || !key) {
    console.error("Could not find Supabase credentials in .env.example!");
    process.exit(1);
}

const supabase = createClient(url, key);

async function setupAdmin() {
    const email = 'admin@company.com';
    const password = 'AdminPassword123!';

    console.log("Creating Admin User...");
    
    // 1. Create the user in Auth
    let userId;
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true
    });

    if (authErr) {
        if (authErr.message.includes('already registered')) {
            console.log("User already exists in Auth. Looking up ID...");
            const { data: users } = await supabase.auth.admin.listUsers();
            userId = users.users.find(u => u.email === email)?.id;
        } else {
            console.error("Error creating Auth user:", authErr.message);
            return;
        }
    } else {
        userId = authData.user.id;
    }

    if (!userId) {
        console.error("Failed to acquire User ID.");
        return;
    }

    // 2. Insert into profiles with Admin role
    const { error: profileErr } = await supabase.from('profiles').upsert({
        user_id: userId,
        full_name: 'System Admin',
        employee_id: 'ADMIN-001',
        department: 'Operations',
        designation: 'Administrator',
        joining_date: new Date().toISOString().split('T')[0],
        salary_basic: 0,
        hra: 0,
        allowances: 0,
        role: 'Admin',
        is_active: true
    }, {onConflict: 'employee_id'});

    if (profileErr) {
        console.error("Error creating profile row for Admin:", profileErr.message);
    } else {
        console.log("-----------------------------------------");
        console.log("SUCCESS! Admin account is fully set up.");
        console.log(`Email: ${email}`);
        console.log(`Password: ${password}`);
        console.log("-----------------------------------------");
    }
}

setupAdmin();
