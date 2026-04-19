import { useState, useEffect } from 'react';
import useAuthStore from '../contexts/AuthContext';
import api from '../services/api';
import { Users, UserCheck, CalendarDays, DollarSign, Activity, ShieldCheck } from 'lucide-react';
import { PulseDot } from '../components/EmployeePulse';
import '../components/EmployeePulse.css';

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
    const [attritionData, setAttritionData] = useState({ flagged: [], summary: { total: 0, amber: 0, red: 0 } });

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

                    // Fetch attrition pulse data
                    try {
                        const pulseRes = await api.get('/attrition/pulse');
                        if (pulseRes.data.data) setAttritionData(pulseRes.data.data);
                    } catch(pe) {
                        console.error('Pulse fetch failed:', pe);
                    }
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
                    <StatCard title="Total Employees" value={stats.employees} icon={Users} colorClass="bg-blue-500" />
                    <StatCard title="Present Today" value={stats.presentToday} icon={UserCheck} colorClass="bg-green-500" />
                    <StatCard title="Pending Leaves" value={stats.pendingLeaves} icon={CalendarDays} colorClass="bg-orange-500" />
                    <StatCard title="Payroll Status" value="Ready" icon={DollarSign} colorClass="bg-purple-500" />
                    <StatCard
                        title="Attrition Alerts"
                        value={attritionData.summary.amber + attritionData.summary.red}
                        icon={Activity}
                        colorClass={attritionData.summary.red > 0 ? 'bg-red-500' : attritionData.summary.amber > 0 ? 'bg-amber-500' : 'bg-green-500'}
                    />
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

            {/* Attrition Alerts Panel — only for Admin/HR */}
            {(user?.role === 'Admin' || user?.role === 'HR') && (
                <div className="attrition-alerts-panel mt-6">
                    <h2>
                        <Activity className="w-5 h-5 text-blue-600" />
                        Employee Pulse — Attrition Risk
                    </h2>
                    {attritionData.flagged.length === 0 ? (
                        <div className="attrition-empty">
                            <ShieldCheck className="w-4 h-4 text-green-500" style={{ marginRight: '0.5rem' }} />
                            No attrition risk flags detected across your team.
                        </div>
                    ) : (
                        attritionData.flagged.map((emp, i) => (
                            <div key={i} className="attrition-alert-row" style={{ flexWrap: 'wrap' }}>
                                <PulseDot riskLevel={emp.risk_level} flags={emp.flags} size="md" />
                                <div className="attrition-alert-info">
                                    <span className="name">{emp.full_name}</span>
                                    <span className="dept"> — {emp.department} · {emp.designation}</span>
                                    {emp.flags && emp.flags.length > 0 && (
                                        <div style={{ marginTop: '0.35rem' }}>
                                            {emp.flags.map((f, j) => (
                                                <span key={j} style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', lineHeight: 1.5 }}>
                                                    {f.detail}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <span className={`risk-badge risk-badge--${emp.risk_level}`}>
                                    {emp.risk_level === 'red' ? 'At Risk' : 'Attention'}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default Dashboard;
