import { useState, useEffect } from 'react';
import api from '../services/api';
import useAuthStore from '../contexts/AuthContext';
import { format } from 'date-fns';

const Leaves = ({ isSelfView, applyMode }) => {
    const { user } = useAuthStore();
    const [leaves, setLeaves] = useState([]);
    const [loading, setLoading] = useState(true);

    const [showApplyModal, setShowApplyModal] = useState(applyMode || false);
    const [formData, setFormData] = useState({
        leave_type: 'CL', start_date: '', end_date: '', days_count: 1, reason: ''
    });

    const fetchLeaves = async () => {
        setLoading(true);
        try {
            if (isSelfView) {
                const res = await api.get(`/leaves/history/${user.employee_id}`);
                setLeaves(res.data.data);
            } else {
                const res = await api.get('/leaves');
                setLeaves(res.data.data);
            }
        } catch(e) {
            console.error(e);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchLeaves();
    }, [isSelfView]);

    const handleApply = async (e) => {
        e.preventDefault();
        try {
            await api.post('/leaves', formData);
            setShowApplyModal(false);
            fetchLeaves();
            if (applyMode) alert('Leave submitted successfully. Navigating back or resetting form.');
        } catch(e) {
            alert('Failed to apply leave');
        }
    };

    const handleAction = async (id, action) => {
        try {
            const remarks = prompt("Add remarks:");
            if (remarks === null) return;
            await api.put(`/leaves/${id}/${action}`, { remarks });
            fetchLeaves();
        } catch (e) {
            alert('Action failed');
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{isSelfView ? 'My Leaves' : 'Leave Requests'}</h1>
                    <p className="text-gray-500">View and manage time off.</p>
                </div>
                {isSelfView && (
                    <button onClick={() => setShowApplyModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition">
                        Apply Leave
                    </button>
                )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                {!isSelfView && <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Employee</th>}
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Type</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Dates</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Days</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Reason</th>
                                {!isSelfView && <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan="7" className="px-6 py-8 text-center text-gray-500">Loading...</td></tr>
                            ) : leaves.map((lv) => (
                                <tr key={lv.id} className="hover:bg-gray-50 transition">
                                    {!isSelfView && <td className="px-6 py-4 font-medium text-gray-900">{lv.profiles?.full_name} ({lv.employee_id})</td>}
                                    <td className="px-6 py-4 text-gray-700 font-medium">{lv.leave_type}</td>
                                    <td className="px-6 py-4 text-gray-500 text-sm">
                                        {format(new Date(lv.start_date), 'dd MMM yyyy')} - {format(new Date(lv.end_date), 'dd MMM yyyy')}
                                    </td>
                                    <td className="px-6 py-4 text-gray-700">{lv.days_count}</td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
                                            ${lv.status === 'approved' ? 'bg-green-100 text-green-800' :
                                              lv.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                              'bg-yellow-100 text-yellow-800'}`}>
                                            {lv.status.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-700 text-sm truncate max-w-xs" title={lv.reason}>{lv.reason}</td>
                                    {!isSelfView && (
                                        <td className="px-6 py-4 space-x-2">
                                            {lv.status === 'pending' && (
                                                <>
                                                    <button onClick={() => handleAction(lv.id, 'approve')} className="text-green-600 hover:text-green-800 font-medium text-sm">Approve</button>
                                                    <button onClick={() => handleAction(lv.id, 'reject')} className="text-red-600 hover:text-red-800 font-medium text-sm">Reject</button>
                                                </>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {showApplyModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6">
                        <h2 className="text-xl font-bold mb-4">Apply for Leave</h2>
                        <form onSubmit={handleApply} className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-600">Leave Type</label>
                                <select required className="w-full border p-2 rounded block mt-1" value={formData.leave_type} onChange={e => setFormData({...formData, leave_type: e.target.value})}>
                                    <option value="CL">Casual Leave (CL)</option>
                                    <option value="SL">Sick Leave (SL)</option>
                                    <option value="PL">Paid Leave (PL)</option>
                                    <option value="LWP">Leave Without Pay (LWP)</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-gray-600">Start Date</label>
                                    <input required type="date" className="w-full border p-2 rounded block mt-1" onChange={e => setFormData({...formData, start_date: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-600">End Date</label>
                                    <input required type="date" className="w-full border p-2 rounded block mt-1" onChange={e => setFormData({...formData, end_date: e.target.value})} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-600">Total Days</label>
                                <input required type="number" min="1" className="w-full border p-2 rounded block mt-1" value={formData.days_count} onChange={e => setFormData({...formData, days_count: parseInt(e.target.value)})} />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-600">Reason</label>
                                <textarea required className="w-full border p-2 rounded block mt-1" rows="3" onChange={e => setFormData({...formData, reason: e.target.value})}></textarea>
                            </div>
                            <div className="flex justify-end space-x-3 mt-4">
                                {!applyMode && <button type="button" onClick={() => setShowApplyModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>}
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Submit Application</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Leaves;
