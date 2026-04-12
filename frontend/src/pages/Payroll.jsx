import { useState, useEffect } from 'react';
import api from '../services/api';
import useAuthStore from '../contexts/AuthContext';
import { format } from 'date-fns';
import { Download, Play } from 'lucide-react';

const Payroll = ({ isSelfView }) => {
    const { user } = useAuthStore();
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // For Run Payroll Modal
    const [showRunModal, setShowRunModal] = useState(false);
    const [runMonth, setRunMonth] = useState(new Date().getMonth() + 1);
    const [runYear, setRunYear] = useState(new Date().getFullYear());
    const [running, setRunning] = useState(false);

    const fetchRecords = async () => {
        setLoading(true);
        try {
            if (isSelfView) {
                const res = await api.get(`/payroll/${user.employee_id}`);
                setRecords(res.data.data);
            } else {
                const res = await api.get('/payroll');
                setRecords(res.data.data);
            }
        } catch(e) {
            console.error(e);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchRecords();
    }, [isSelfView]);

    const handleRunPayroll = async (e) => {
        e.preventDefault();
        setRunning(true);
        try {
            const res = await api.post('/payroll/run', { month: Number(runMonth), year: Number(runYear) });
            alert(`Payroll processed! Processed ${res.data.processedCount} employees.`);
            setShowRunModal(false);
            fetchRecords();
        } catch(e) {
            alert('Failed to run payroll. Check logs.');
        }
        setRunning(false);
    };

    const handleDownload = async (id) => {
        try {
            const res = await api.get(`/payroll/${id}/payslip`);
            const { url } = res.data.data;
            window.open(url, '_blank');
        } catch(e) {
            alert('Failed to fetch payslip download link. PDF may not be generated correctly.');
        }
    };

    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    return (
        <div>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{isSelfView ? 'My Payslips' : 'Payroll Management'}</h1>
                    <p className="text-gray-500">Manage monthly salaries and payslips.</p>
                </div>
                {!isSelfView && (
                    <button onClick={() => setShowRunModal(true)} className="bg-purple-600 text-white px-4 py-2 rounded-xl flex items-center hover:bg-purple-700 transition">
                        <Play className="w-4 h-4 mr-2" fill="currentColor" /> Run Payroll
                    </button>
                )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                {!isSelfView && <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Employee</th>}
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Period</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Gross</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Deductions</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Net Pay</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan={isSelfView? "5":"6"} className="px-6 py-8 text-center text-gray-500">Loading...</td></tr>
                            ) : records.map((rec) => (
                                <tr key={rec.id} className="hover:bg-gray-50 transition">
                                    {!isSelfView && <td className="px-6 py-4 font-medium text-gray-900">{rec.profiles?.full_name} ({rec.employee_id})</td>}
                                    <td className="px-6 py-4 text-gray-700">{months[rec.month - 1]} {rec.year}</td>
                                    <td className="px-6 py-4 text-gray-700">${rec.gross}</td>
                                    <td className="px-6 py-4 text-red-600">-${(Number(rec.pf_deduction) + Number(rec.pt_deduction) + Number(rec.tds_deduction) + Number(rec.lwp_deduction)).toFixed(2)}</td>
                                    <td className="px-6 py-4 font-bold text-green-600">${rec.net_pay}</td>
                                    <td className="px-6 py-4">
                                        <button onClick={() => handleDownload(rec.id)} className="text-blue-600 hover:text-blue-800 font-medium text-sm flex items-center disabled:opacity-50" disabled={!rec.payslip_url}>
                                            <Download className="w-4 h-4 mr-1" /> Download PDF
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Run Payroll Modal */}
            {showRunModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6">
                        <h2 className="text-xl font-bold mb-4">Run Monthly Payroll</h2>
                        <form onSubmit={handleRunPayroll} className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-600">Month</label>
                                <select required className="w-full border p-2 rounded block mt-1" value={runMonth} onChange={e => setRunMonth(e.target.value)}>
                                    {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-600">Year</label>
                                <input required type="number" className="w-full border p-2 rounded block mt-1" value={runYear} onChange={e => setRunYear(e.target.value)} />
                            </div>
                            
                            <div className="bg-blue-50 border border-blue-100 text-blue-800 p-3 rounded-lg text-sm">
                                This will format LWP deductions, calculate taxes and allowances, insert records into DB, and generate PDF payslips stored in R2 for all active employees. This process may take a while.
                            </div>

                            <div className="flex justify-end space-x-3 mt-4">
                                <button type="button" disabled={running} onClick={() => setShowRunModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                                <button type="submit" disabled={running} className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50">
                                    {running ? 'Processing...' : 'Run Payroll Engine'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Payroll;
