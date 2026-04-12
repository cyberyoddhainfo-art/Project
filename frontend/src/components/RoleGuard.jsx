import { Navigate, Outlet } from 'react-router-dom';
import useAuthStore from '../contexts/AuthContext';

const RoleGuard = ({ allowedRoles }) => {
    const { user, loading } = useAuthStore();

    if (loading) {
        return <div className="flex h-screen items-center justify-center">Loading...</div>;
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        return <Navigate to="/dashboard" replace />;
    }

    return <Outlet />;
};

export default RoleGuard;
