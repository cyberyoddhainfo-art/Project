import { useState, useEffect } from 'react';
import api from '../services/api';
import useAuthStore from '../contexts/AuthContext';
import { Plus, Search } from 'lucide-react';
import EmployeePulse, { PulseDot } from '../components/EmployeePulse';

const Employees = ({ isSelfView }) => {
    const { user } = useAuthStore();
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pulseMap, setPulseMap] = useState({});

    // Modal state for adding/editing employee
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState(null);
    const initialFormData = {
        full_name: '', email: '', password: '', employee_id: '',
        department: '', designation: '', joining_date: '', phone: '',
        bank_account: '', salary_basic: 0, hra: 0, allowances: 0, role: 'Employee', reporting_manager_id: ''
    };
    const [formData, setFormData] = useState(initialFormData);

    const fetchEmployees = async () => {
        setLoading(true);
        try {
            if (isSelfView) {
                const res = await api.get(`/employees/${user.profile_id}`);
                setEmployees([res.data.data]);
            } else {
                const res = await api.get('/employees');
                setEmployees(res.data.data);

                // Fetch bulk pulse data for table indicators
                try {
                    const pulseRes = await api.get('/attrition/pulse');
                    const flagged = pulseRes.data.data?.flagged || [];
                    const map = {};
                    flagged.forEach(f => { map[f.employee_id] = { risk_level: f.risk_level, flags: f.flags || [] }; });
                    setPulseMap(map);
                } catch(pe) {
                    console.error('Pulse fetch failed:', pe);
                }
            }
        } catch(e) {
            console.error(e);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchEmployees();
    }, [isSelfView]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editId) {
                const payload = { ...formData };
                delete payload.password;
                delete payload.email; // Email/Password managed via auth natively, omit from profile update
                
                await api.put(`/employees/${editId}`, payload);
            } else {
                await api.post('/employees', formData);
            }
            setShowModal(false);
            setEditId(null);
            setFormData(initialFormData);
            fetchEmployees();
        } catch(e) {
            alert(`Failed to ${editId ? 'update' : 'create'} employee`);
        }
    };

    const handleEdit = (emp) => {
        setFormData({
            full_name: emp.full_name,
            email: emp.email || '',
            password: '', // Blank by default when editing
            employee_id: emp.employee_id,
            department: emp.department,
            designation: emp.designation,
            joining_date: emp.joining_date,
            phone: emp.phone || '',
            bank_account: emp.bank_account || '',
            salary_basic: emp.salary_basic,
            hra: emp.hra,
            allowances: emp.allowances,
            role: emp.role,
            reporting_manager_id: emp.reporting_manager_id || ''
        });
        setEditId(emp.id);
        setShowModal(true);
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{isSelfView ? 'My Profile' : 'Employees'}</h1>
                    <p className="text-gray-500">Manage employee records.</p>
                </div>
                {!isSelfView && (
                    <button onClick={() => { setEditId(null); setFormData(initialFormData); setShowModal(true); }} className="bg-blue-600 text-white px-4 py-2 rounded-xl flex items-center hover:bg-blue-700 transition">
                        <Plus className="w-4 h-4 mr-2" /> Add Employee
                    </button>
                )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Employee ID</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Name</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Department</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Designation</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Role</th>
                                {!isSelfView && <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Action</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan="5" className="px-6 py-8 text-center text-gray-500">Loading...</td></tr>
                            ) : employees.map((emp) => (
                                <tr key={emp.id} className="hover:bg-gray-50 transition">
                                    <td className="px-6 py-4 font-medium text-gray-900">{emp.employee_id}</td>
                                    <td className="px-6 py-4 text-gray-700">
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            {emp.full_name}
                                            <PulseDot
                                                riskLevel={pulseMap[emp.employee_id]?.risk_level}
                                                flags={pulseMap[emp.employee_id]?.flags}
                                            />
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-700">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                            {emp.department}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-700">{emp.designation}</td>
                                    <td className="px-6 py-4 text-gray-700">{emp.role}</td>
                                    {!isSelfView && (
                                        <td className="px-6 py-4">
                                            <button onClick={() => handleEdit(emp)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">Edit</button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pulse card for self-view */}
            {isSelfView && employees.length > 0 && (
                <EmployeePulse employeeId={employees[0].employee_id} />
            )}

            {/* Add / Edit Employee Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
                        <h2 className="text-xl font-bold mb-4">{editId ? 'Edit Employee' : 'Add New Employee'}</h2>
                        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
                            <input required={!editId} placeholder="Full Name" value={formData.full_name} className="border p-2 rounded" onChange={e => setFormData({...formData, full_name: e.target.value})} />
                            
                            {/* Disable email field entirely on edit since Supabase Auth handles email logic differently natively */}
                            <input required={!editId} disabled={!!editId} type="email" placeholder="Email (Login)" value={formData.email} className={`border p-2 rounded ${editId ? 'bg-gray-100 text-gray-500' : ''}`} onChange={e => setFormData({...formData, email: e.target.value})} />
                            
                            <input required={!editId} placeholder={editId ? "New Password (Optional)" : "Password"} type="password" value={formData.password} className="border p-2 rounded" onChange={e => setFormData({...formData, password: e.target.value})} />
                            <input required={!editId} disabled={!!editId} placeholder="Employee ID" value={formData.employee_id} className={`border p-2 rounded ${editId ? 'bg-gray-100 text-gray-500' : ''}`} onChange={e => setFormData({...formData, employee_id: e.target.value})} />
                            
                            <input required={!editId} placeholder="Department" value={formData.department} className="border p-2 rounded" onChange={e => setFormData({...formData, department: e.target.value})} />
                            <input required={!editId} placeholder="Designation" value={formData.designation} className="border p-2 rounded" onChange={e => setFormData({...formData, designation: e.target.value})} />
                            <input required={!editId} type="date" value={formData.joining_date} className="border p-2 rounded" onChange={e => setFormData({...formData, joining_date: e.target.value})} />
                            <input placeholder="Phone" value={formData.phone} className="border p-2 rounded" onChange={e => setFormData({...formData, phone: e.target.value})} />
                            
                            <input required={!editId} placeholder="Bank Account Number" value={formData.bank_account} className="border p-2 rounded" onChange={e => setFormData({...formData, bank_account: e.target.value})} />
                            <input required={!editId} placeholder="Basic Salary" type="number" value={formData.salary_basic || ''} className="border p-2 rounded" onChange={e => setFormData({...formData, salary_basic: Number(e.target.value)})} />
                            <input required={!editId} placeholder="HRA" type="number" value={formData.hra || ''} className="border p-2 rounded" onChange={e => setFormData({...formData, hra: Number(e.target.value)})} />
                            <input required={!editId} placeholder="Allowances" type="number" value={formData.allowances || ''} className="border p-2 rounded" onChange={e => setFormData({...formData, allowances: Number(e.target.value)})} />
                            <select className="border p-2 rounded" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                                <option value="Employee">Employee</option>
                                <option value="HR">HR</option>
                                <option value="Admin">Admin</option>
                            </select>

                            {user?.role === 'Admin' && (
                                <select className="border p-2 rounded" value={formData.reporting_manager_id} onChange={e => setFormData({...formData, reporting_manager_id: e.target.value})}>
                                    <option value="">No Reporting HR Assigned</option>
                                    {employees.filter(emp => emp.role === 'HR').map(hr => (
                                        <option key={hr.id} value={hr.id}>{hr.full_name}</option>
                                    ))}
                                </select>
                            )}
                            
                            <div className="col-span-2 flex justify-end space-x-3 mt-4">
                                <button type="button" onClick={() => { setShowModal(false); setEditId(null); setFormData(initialFormData); }} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">{editId ? 'Save Changes' : 'Create'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Employees;
