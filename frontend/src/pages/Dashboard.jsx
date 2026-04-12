import { useState, useEffect } from 'react';
import useAuthStore from '../contexts/AuthContext';
import api from '../services/api';
import { Users, UserCheck, CalendarDays, DollarSign } from 'lucide-react';

const StatCard = ({ title, value, icon: Icon, colorClass }) => (
    <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 flex items-center">
        <div className={`p-4 rounded-xl ${colorClass} mr-4`}>
            <Icon className="w-6 h-6 text-white" />
        </div>
        <div>
            <p className="text-sm text-gray-500 font-medium">{title}</p>
            <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
        </div>
    </div>
);

const Dashboard = () => {
    const { user } = useAuthStore();
    const [stats, setStats] = useState({ employees: 0, pendingLeaves: 0, presentToday: 0 });
    const [balance, setBalance] = useState(null);

    useEffect(() => {
        const fetchDashboardData = async () => {
            if (user?.role === 'Admin' || user?.role === 'HR') {
                try {
                    const [empRes, leavesRes, attRes] = await Promise.all([
                        api.get('/employees'),
                        api.get('/leaves?status=pending'),
                        api.get(`/attendance?date=${new Date().toISOString().split('T')[0]}`)
                    ]);
                    setStats({
                        employees: empRes.data.data?.length || 0,
                        pendingLeaves: leavesRes.data.data?.length || 0,
                        presentToday: (attRes.data.data || []).filter(a => a.status === 'present').length
                    });
                } catch(e) {
                    console.error("Failed to load admin stats");
                }
            } else if (user?.role === 'Employee') {
                try {
                    const res = await api.get(`/leaves/balance/${user.employee_id}`);
                    setBalance(res.data.data);
                } catch(e) {
                    console.error("Failed to load balance stats");
                }
            }
        };
        fetchDashboardData();
    }, [user]);

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Welcome, {user?.full_name}</h1>
                <p className="text-gray-500">Here's what's happening today.</p>
            </div>

            {(user?.role === 'Admin' || user?.role === 'HR') && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <StatCard title="Total Employees" value={stats.employees} icon={Users} colorClass="bg-blue-500" />
                    <StatCard title="Present Today" value={stats.presentToday} icon={UserCheck} colorClass="bg-green-500" />
                    <StatCard title="Pending Leaves" value={stats.pendingLeaves} icon={CalendarDays} colorClass="bg-orange-500" />
                    <StatCard title="Payroll Status" value="Ready" icon={DollarSign} colorClass="bg-purple-500" />
                </div>
            )}

            {user?.role === 'Employee' && balance && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <StatCard title="Casual Leaves (CL)" value={`${balance.cl_total - balance.cl_used} Remaining`} icon={CalendarDays} colorClass="bg-blue-500" />
                    <StatCard title="Sick Leaves (SL)" value={`${balance.sl_total - balance.sl_used} Remaining`} icon={CalendarDays} colorClass="bg-orange-500" />
                    <StatCard title="Paid Leaves (PL)" value={`${balance.pl_total - balance.pl_used} Remaining`} icon={CalendarDays} colorClass="bg-purple-500" />
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 min-h-[300px]">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Recent Activity</h2>
                <div className="flex items-center justify-center h-[200px] text-gray-400">
                    No recent activities recorded yet.
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
