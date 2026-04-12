import { useState, useEffect } from 'react';
import api from '../services/api';
import useAuthStore from '../contexts/AuthContext';
import { format } from 'date-fns';

const Attendance = ({ isSelfView }) => {
    const { user } = useAuthStore();
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [attendance, setAttendance] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchData();
    }, [date]);

    const fetchData = async () => {
        setLoading(true);
        try {
            if (isSelfView) {
                const currentDate = new Date(date);
                const attRes = await api.get(`/attendance/${user.employee_id}?month=${currentDate.getMonth() + 1}&year=${currentDate.getFullYear()}`);
                setAttendance(attRes.data.data || []);
            } else {
                const [attRes, empRes] = await Promise.all([
                    api.get(`/attendance?date=${date}`),
                    api.get('/employees')
                ]);
                setAttendance(attRes.data.data || []);
                setEmployees(empRes.data.data || []);
            }
        } catch(e) {
            console.error(e);
        }
        setLoading(false);
    };

    const handleMark = async (employee_id, status) => {
        try {
            await api.post('/attendance', { employee_id, date, status });
            fetchData();
        } catch(e) {
            alert('Failed to mark attendance');
        }
    };

    const handleSelfMark = async (status) => {
        try {
            await api.post('/attendance/self', { date, status });
            fetchData();
            alert('Attendance marked successfully');
        } catch(e) {
            alert('Failed to mark self attendance');
        }
    };

    const handleApproveWfh = async (id) => {
        try {
            await api.put(`/attendance/${id}/approve-wfh`);
            fetchData();
        } catch(e) {
            alert('Failed to approve WFH');
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{isSelfView ? 'My Attendance' : 'Attendance'}</h1>
                    <p className="text-gray-500">{isSelfView ? 'Mark and view your monthly attendance.' : 'Mark and manage daily attendance.'}</p>
                </div>
                <div>
                    <input 
                        type="date" 
                        value={date} 
                        onChange={(e) => setDate(e.target.value)}
                        className="px-4 py-2 border rounded-xl focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                {!isSelfView && <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Employee ID</th>}
                                {!isSelfView && <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Name</th>}
                                {isSelfView && <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Date</th>}
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
                                {!isSelfView && <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Action</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan="5" className="px-6 py-8 text-center text-gray-500">Loading...</td></tr>
                            ) : isSelfView ? (
                                attendance.length > 0 ? attendance.map(a => (
                                    <tr key={a.id} className="hover:bg-gray-50 transition">
                                        <td className="px-6 py-4 font-medium text-gray-900">{format(new Date(a.date), 'dd MMM yyyy')}</td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
                                                ${a.status === 'present' ? 'bg-green-100 text-green-800' :
                                                  a.status === 'absent' ? 'bg-red-100 text-red-800' :
                                                  a.status === 'half_day' ? 'bg-yellow-100 text-yellow-800' : 
                                                  a.status === 'pending_wfh' ? 'bg-orange-100 text-orange-800' :
                                                  'bg-purple-100 text-purple-800'}`}>
                                                {a.status.replace('_', ' ').toUpperCase()}
                                            </span>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan="2" className="px-6 py-8 text-center text-gray-500">No attendance records for this month.</td></tr>
                                )
                            ) : employees.map((emp) => {
                                const record = attendance.find(a => a.employee_id === emp.employee_id);
                                return (
                                    <tr key={emp.employee_id} className="hover:bg-gray-50 transition">
                                        <td className="px-6 py-4 font-medium text-gray-900">{emp.employee_id}</td>
                                        <td className="px-6 py-4 text-gray-700">{emp.full_name}</td>
                                        <td className="px-6 py-4">
                                            {record ? (
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
                                                    ${record.status === 'present' ? 'bg-green-100 text-green-800' :
                                                      record.status === 'absent' ? 'bg-red-100 text-red-800' :
                                                      record.status === 'half_day' ? 'bg-yellow-100 text-yellow-800' : 
                                                      record.status === 'pending_wfh' ? 'bg-orange-100 text-orange-800' :
                                                      'bg-purple-100 text-purple-800'}`}>
                                                    {record.status.replace('_', ' ').toUpperCase()}
                                                </span>
                                            ) : <span className="text-gray-400">Not Marked</span>}
                                        </td>
                                        <td className="px-6 py-4 space-x-2 flex items-center">
                                            <button onClick={() => handleMark(emp.employee_id, 'present')} className="px-3 py-1 bg-green-50 text-green-700 rounded text-sm hover:bg-green-100">P</button>
                                            <button onClick={() => handleMark(emp.employee_id, 'absent')} className="px-3 py-1 bg-red-50 text-red-700 rounded text-sm hover:bg-red-100">A</button>
                                            <button onClick={() => handleMark(emp.employee_id, 'half_day')} className="px-3 py-1 bg-yellow-50 text-yellow-700 rounded text-sm hover:bg-yellow-100">HD</button>
                                            <button onClick={() => handleMark(emp.employee_id, 'wfh')} className="px-3 py-1 bg-purple-50 text-purple-700 rounded text-sm hover:bg-purple-100">WFH</button>
                                            {record?.status === 'pending_wfh' && (
                                                <button onClick={() => handleApproveWfh(record.id)} className="ml-2 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">Approve WFH</button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {isSelfView && (
                <div className="mt-8 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold mb-4">Mark Today's Attendance</h3>
                    <div className="flex space-x-4">
                        <button onClick={() => handleSelfMark('present')} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Mark Present</button>
                        <button onClick={() => handleSelfMark('wfh')} className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">Request WFH</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Attendance;
