import { useState, useEffect } from 'react';
import api from '../services/api';
import './EmployeePulse.css';
import { Activity, AlertTriangle, ShieldCheck, TrendingUp, Calendar } from 'lucide-react';

const RISK_CONFIG = {
    normal: { dotClass: 'pulse-dot--normal', badgeClass: 'risk-badge--normal', recoClass: 'pulse-recommendation--normal', label: 'Healthy', icon: '💚' },
    amber:  { dotClass: 'pulse-dot--amber',  badgeClass: 'risk-badge--amber',  recoClass: 'pulse-recommendation--amber',  label: 'Attention',  icon: '⚠️' },
    red:    { dotClass: 'pulse-dot--red',    badgeClass: 'risk-badge--red',    recoClass: 'pulse-recommendation--red',    label: 'At Risk', icon: '🔴' }
};

const PATTERN_ICONS = {
    sick_leave_spike: '🤒',
    absence_spike: '📉'
};

/**
 * Full Pulse card — shows on employee profile view.
 */
const EmployeePulse = ({ employeeId }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!employeeId) return;
        setLoading(true);
        api.get(`/attrition/pulse/${employeeId}`)
            .then(res => {
                setData(res.data.data);
                setError(null);
            })
            .catch(err => {
                console.error('Pulse fetch failed:', err);
                setError('Unable to load pulse data');
            })
            .finally(() => setLoading(false));
    }, [employeeId]);

    if (loading) return <div className="pulse-skeleton" />;
    if (error) return <div className="pulse-card"><p className="text-gray-400 text-sm">{error}</p></div>;
    if (!data) return null;

    const config = RISK_CONFIG[data.risk_level] || RISK_CONFIG.normal;

    return (
        <div className="pulse-card">
            <div className="pulse-card-header">
                <Activity className="w-5 h-5 text-blue-600" />
                <div>
                    <h3>Employee Pulse
                        <span className="pulse-subtitle"> — Last {data.analysis_period?.from ? '30' : '—'} days</span>
                    </h3>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                    <span className={`risk-badge ${config.badgeClass}`}>
                        <span className={`pulse-dot pulse-dot--sm ${config.dotClass}`} />
                        {config.label}
                    </span>
                </div>
            </div>

            {/* Recommendation banner */}
            <div className={`pulse-recommendation ${config.recoClass}`}>
                {data.risk_level === 'normal'
                    ? <ShieldCheck className="w-5 h-5 flex-shrink-0" style={{ marginTop: '1px' }} />
                    : <AlertTriangle className="w-5 h-5 flex-shrink-0" style={{ marginTop: '1px' }} />}
                <span>{data.recommendation}</span>
            </div>

            {/* Flag details */}
            {data.flags && data.flags.length > 0 && (
                <div className="pulse-flags">
                    {data.flags.map((flag, i) => (
                        <div key={i} className="pulse-flag">
                            <span className="pulse-flag-icon">{PATTERN_ICONS[flag.pattern] || '⚡'}</span>
                            <div className="pulse-flag-content">
                                <h4>{flag.label}</h4>
                                <p>{flag.detail}</p>
                                <div className="pulse-flag-stat">
                                    <span>Last 30d: <strong>{flag.recent_count}</strong></span>
                                    <span>Avg/month: <strong>{flag.monthly_average}</strong></span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Period info */}
            {data.analysis_period && (
                <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: '#9ca3af' }}>
                    <Calendar className="w-3.5 h-3.5" />
                    Analysis: {data.analysis_period.from} → {data.analysis_period.to}
                </div>
            )}
        </div>
    );
};

/**
 * Inline pulse dot — for use in employee tables.
 * Shows a hover tooltip with risk reason when flags are provided.
 */
export const PulseDot = ({ riskLevel, size = 'sm', flags = [] }) => {
    if (!riskLevel || riskLevel === 'normal') return null;
    const config = RISK_CONFIG[riskLevel] || RISK_CONFIG.normal;

    const tooltipText = flags.length > 0
        ? flags.map(f => f.detail).join(' · ')
        : `Risk: ${config.label}`;

    return (
        <span className="pulse-dot-wrapper">
            <span
                className={`pulse-dot ${size === 'sm' ? 'pulse-dot--sm' : ''} ${config.dotClass}`}
            />
            <span className={`pulse-tooltip pulse-tooltip--${riskLevel}`}>
                <span className="pulse-tooltip-title">{config.label}</span>
                {flags.map((f, i) => (
                    <span key={i} className="pulse-tooltip-flag">
                        {f.detail}
                    </span>
                ))}
                {flags.length === 0 && (
                    <span className="pulse-tooltip-flag">Unusual attendance pattern detected</span>
                )}
            </span>
        </span>
    );
};

export default EmployeePulse;
