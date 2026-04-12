import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import useAuthStore from './contexts/AuthContext';
import RoleGuard from './components/RoleGuard';
import Layout from './components/Layout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import Attendance from './pages/Attendance';
import Leaves from './pages/Leaves';
import Payroll from './pages/Payroll';
import PageNotFound from './pages/PageNotFound';

function App() {
    const { initialize, loading } = useAuthStore();

    useEffect(() => {
        initialize();
    }, [initialize]);

    if (loading) return <div>Loading Application...</div>;

    return (
        <Router>
            <Routes>
                <Route path="/login" element={<Login />} />

                {/* Protected Routes */}
                <Route element={<RoleGuard />}>
                    <Route element={<Layout />}>
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/dashboard" element={<Dashboard />} />
                        
                        {/* Employee endpoints */}
                        <Route path="/my/profile" element={<Employees isSelfView={true} />} />
                        <Route path="/my/leaves" element={<Leaves isSelfView={true} />} />
                        <Route path="/my/attendance" element={<Attendance isSelfView={true} />} />
                        <Route path="/my/payslips" element={<Payroll isSelfView={true} />} />
                        
                        <Route path="/leaves/apply" element={<Leaves applyMode={true} />} />
                    </Route>
                </Route>

                {/* HR/Admin Routes */}
                <Route element={<RoleGuard allowedRoles={['Admin', 'HR']} />}>
                    <Route element={<Layout />}>
                        <Route path="/employees" element={<Employees />} />
                        <Route path="/attendance" element={<Attendance />} />
                        <Route path="/leaves" element={<Leaves />} />
                        <Route path="/payroll" element={<Payroll />} />
                    </Route>
                </Route>

                <Route path="*" element={<PageNotFound />} />
            </Routes>
        </Router>
    );
}

export default App;
