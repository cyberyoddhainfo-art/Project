import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../contexts/AuthContext';
import { LayoutDashboard, Users, Calendar, Clock, DollarSign, LogOut, User } from 'lucide-react';

const Layout = () => {
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const isAdminOrHR = user?.role === 'Admin' || user?.role === 'HR';

    const menuItems = [
        { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
        ...(isAdminOrHR ? [
            { name: 'Employees', path: '/employees', icon: Users },
            { name: 'Attendance', path: '/attendance', icon: Clock },
            { name: 'Leaves', path: '/leaves', icon: Calendar },
            { name: 'Payroll', path: '/payroll', icon: DollarSign },
        ] : []),
        ...(!isAdminOrHR ? [
            { name: 'My Profile', path: '/my/profile', icon: User },
            { name: 'My Leaves', path: '/my/leaves', icon: Calendar },
            { name: 'My Attendance', path: '/my/attendance', icon: Clock },
            { name: 'My Payslips', path: '/my/payslips', icon: DollarSign },
        ] : [])
    ];

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 bg-white shadow-xl flex flex-col">
                <div className="h-16 flex items-center justify-center border-b border-gray-100 px-6">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        CloudHR
                    </h1>
                </div>

                <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
                    {menuItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname.startsWith(item.path);
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${
                                    isActive
                                        ? 'bg-blue-50 text-blue-700 font-medium'
                                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                }`}
                            >
                                <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                                {item.name}
                            </Link>
                        )
                    })}
                </nav>

                <div className="p-4 border-t border-gray-100">
                    <div className="flex items-center px-4 py-3 mb-2 rounded-xl bg-gray-50">
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{user?.full_name}</p>
                            <p className="text-xs text-gray-500 truncate">{user?.role}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="flex w-full items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                    >
                        <LogOut className="w-4 h-4 mr-3" />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-8">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default Layout;
