import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';

// --- CONFIGURATION ---
// This URL should point to your deployed Google Apps Script Web App.
const GOOGLE_SCRIPT_URL: string = 'https://script.google.com/macros/s/AKfycbxQ-PTvW5vLirBLPv5RJ_ZX0EGuDgvzkHEU8ssSBQCuecqzp0xas7g4qzwsEIxBY3lc/exec';

// --- MOCK DATA (for local development or as fallback) ---
const initialAgents = ['Ryan', 'Leah', 'Jackie', 'Lyn', 'Mhine'];

const residentialPlans = [
  'GFiber 1499 - 300Mbps',
  'GFiber 1999 - 500Mbps',
  'GFiber 2499 - 1Gbps'
];

// --- HELPERS ---
const calculateCommission = (plan) => {
    if (!plan) return 0;
    if (plan.includes('1499')) return 700;
    if (plan.includes('1999')) return 900;
    if (plan.includes('2499')) return 1200;
    return 0;
};

const getPlanPrice = (plan) => {
    if (!plan) return 0;
    const match = plan.match(/(\d+)/);
    return match ? parseInt(match[0], 10) : 0;
};

const formatDate = (dateString) => {
    if (!dateString) return dateString;
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dateString);
    let date;
    if (isDateOnly) {
        const parts = dateString.split('-');
        date = new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)));
    } else {
        date = new Date(dateString);
    }

    if (isNaN(date.getTime())) {
        return dateString;
    }

    const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        timeZone: 'UTC'
    };
    return date.toLocaleDateString('en-US', options);
};

const normalizeDateToYYYYMMDD = (sheetDate) => {
    if (!sheetDate) return '';
    // Create a date object. This is robust for ISO strings and MM/DD/YYYY formats.
    const d = new Date(sheetDate);
    // If parsing fails, it's not a recognizable date string.
    if (isNaN(d.getTime())) return '';
    
    // Construct the date string from the browser's LOCAL date parts.
    // This correctly reflects the absolute timestamp in the user's timezone.
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
};

const payoutStatusBadgeStyle = (status) => ({
    backgroundColor: 
        status === 'Completed' ? 'var(--accent-green)' :
        status === 'Pending' ? 'var(--accent-yellow)' :
        status === 'On Request' ? 'var(--accent-blue)' :
        status === 'Rejected' ? 'var(--accent-red)' :
        '#6c757d',
});

// --- SVG ICONS ---
const Icon = ({ path, className = '' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="http://www.w3.org/2000/svg" fill="currentColor" className={className} style={{ width: '1.25rem', height: '1.25rem' }}>
        <path d={path} />
    </svg>
);

const ICONS = {
    overview: "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z",
    subscribers: "M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z",
    performance: "M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.09-4-4L2 17.08l1.5 1.41z",
    payout: "M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z",
    accounting: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 14H7v-2h10v2zm0-4H7v-2h10v2zm0-4H7V7h10v2z",
    logout: "M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z",
    menu: "M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z",
};

// --- COMPONENTS ---

const Login = ({ onLogin, agents }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');

        if (username.toLowerCase() === 'admin' && password === 'admin') {
            onLogin({ name: 'Admin', role: 'admin' });
            return;
        }

        const agentExists = agents.find(agent => agent.toLowerCase() === username.toLowerCase());
        if (agentExists && password === `${agentExists}123`) {
            onLogin({ name: agentExists, role: 'agent' });
            return;
        }

        setError('Invalid username or password.');
    };

    return (
        <div className="login-container">
            <div className="login-box">
                <div className="login-header">
                    <span className="logo-text">Globe</span>
                    <span>Tracker</span>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="username">Username</label>
                        <input
                            type="text"
                            id="username"
                            className="form-control"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            type="password"
                            id="password"
                            className="form-control"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    {error && <p className="login-error">{error}</p>}
                    <button type="submit" className="btn btn-primary btn-block">Login</button>
                </form>
            </div>
        </div>
    );
};

const Sidebar = ({ activeMenu, setActiveMenu, userRole, isOpen, onClose }) => {
    const menus = [
        { name: 'Overview', icon: 'overview', roles: ['admin', 'agent'] },
        { name: 'Subscribers', icon: 'subscribers', roles: ['admin', 'agent'] },
        { name: 'My Performance', icon: 'performance', roles: ['agent'] },
        { name: 'Agent Performance', icon: 'performance', roles: ['admin'] },
        { name: 'Payout Reports', icon: 'payout', roles: ['admin', 'agent'] },
        { name: 'Accounting & Financial', icon: 'accounting', roles: ['admin'] },
    ];

    const handleMenuClick = (menuName) => {
        setActiveMenu(menuName);
        onClose();
    };

    return (
        <>
            {isOpen && <div className="sidebar-backdrop" onClick={onClose}></div>}
            <nav className={`sidebar no-print ${isOpen ? 'sidebar-open' : ''}`}>
                <div className="sidebar-logo">
                    <span className="sidebar-logo-text">Globe</span>
                    <span className="sidebar-logo-subtext">Tracker</span>
                </div>
                {menus.filter(menu => menu.roles.includes(userRole)).map(menu => (
                    <div
                        key={menu.name}
                        className={`menu-item ${activeMenu === menu.name ? 'active' : ''}`}
                        onClick={() => handleMenuClick(menu.name)}
                        role="button"
                        tabIndex={0}
                        aria-label={menu.name}
                    >
                        <Icon path={ICONS[menu.icon]} />
                        <span>{menu.name}</span>
                    </div>
                ))}
            </nav>
        </>
    );
};

const Header = ({ currentUser, onLogout, isSaving, onToggleSidebar }) => {
    return (
        <header className="app-header no-print">
            <div className="header-start">
                 <button className="sidebar-toggle" onClick={onToggleSidebar} aria-label="Toggle menu">
                    <Icon path={ICONS.menu} />
                </button>
                <div className={`saving-indicator ${isSaving ? 'is-saving' : ''}`}>
                    Saving...
                </div>
            </div>
            <div className="header-user">
                <span>Welcome, <strong>{currentUser.name}</strong></span>
                <button className="logout-btn" onClick={onLogout}>
                    <Icon path={ICONS.logout} />
                    Logout
                </button>
            </div>
        </header>
    );
};

const LineChart = ({ labels, datasets }) => {
    const containerRef = useRef(null);
    const [tooltip, setTooltip] = useState(null);
    const [containerWidth, setContainerWidth] = useState(0);

    useEffect(() => {
        const observer = new ResizeObserver(entries => {
            if (entries[0]) {
                setContainerWidth(entries[0].contentRect.width);
            }
        });
        if (containerRef.current) {
            observer.observe(containerRef.current);
        }
        return () => observer.disconnect();
    }, []);

    if (!labels || labels.length === 0) return <p>No data to display for this period.</p>;

    const height = 350;
    const padding = { top: 20, right: 20, bottom: 40, left: 60 };
    const chartWidth = containerWidth - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const allDataPoints = datasets.flatMap(ds => ds.data);
    const maxValue = Math.max(0, ...allDataPoints);
    const yAxisMax = maxValue === 0 ? 1000 : Math.ceil(maxValue / 1000) * 1000;

    const getX = (index) => padding.left + (index / (labels.length - 1)) * chartWidth;
    const getY = (value) => padding.top + chartHeight - (value / yAxisMax) * chartHeight;

    const yAxisLabels = Array.from({ length: 6 }, (_, i) => {
        const value = (yAxisMax / 5) * i;
        return { value, y: getY(value) };
    });

    const handleMouseOver = (e, index) => {
        const x = getX(index);
        const tooltipData = {
            label: labels[index],
            datasets: datasets.map(ds => ({
                name: ds.name,
                value: ds.data[index],
                color: ds.color
            })),
            x: x,
            y: e.clientY - containerRef.current.getBoundingClientRect().top
        };
        setTooltip(tooltipData);
    };

    const handleMouseOut = () => {
        setTooltip(null);
    };

    return (
        <div className="line-chart-container" ref={containerRef}>
            {containerWidth > 0 && (
                 <svg className="line-chart-svg" width="100%" height={height}>
                    <g className="y-axis">
                        {yAxisLabels.map(({ value, y }) => (
                            <g key={value}>
                                <text x={padding.left - 10} y={y} dy="0.32em" textAnchor="end" className="axis-label">
                                    {value / 1000}k
                                </text>
                                <line x1={padding.left} x2={containerWidth - padding.right} y1={y} y2={y} className="grid-line" />
                            </g>
                        ))}
                    </g>

                    <g className="x-axis">
                        {labels.map((label, index) => {
                             const showLabel = labels.length <= 12 || index % Math.ceil(labels.length / 12) === 0;
                            return showLabel && (
                                <text key={label} x={getX(index)} y={height - padding.bottom + 20} textAnchor="middle" className="axis-label">
                                    {label}
                                </text>
                            )
                        })}
                    </g>

                    {datasets.map(ds => (
                        <path
                            key={ds.name}
                            className="data-line"
                            stroke={ds.color}
                            d={ds.data.map((point, index) => `${index === 0 ? 'M' : 'L'} ${getX(index)} ${getY(point)}`).join(' ')}
                        />
                    ))}

                     {labels.map((_, index) => (
                        <g key={index} className="data-point-group" onMouseOver={(e) => handleMouseOver(e, index)} onMouseOut={handleMouseOut}>
                             <rect x={getX(index) - (chartWidth / (labels.length - 1) / 2)} y={padding.top} width={chartWidth / (labels.length - 1)} height={chartHeight} fill="transparent" />
                            {datasets.map(ds => (
                                <circle key={ds.name} cx={getX(index)} cy={getY(ds.data[index])} fill={ds.color} className="data-point" />
                            ))}
                        </g>
                    ))}
                </svg>
            )}
           
            {tooltip && (
                <div className="chart-tooltip visible" style={{ left: tooltip.x, top: tooltip.y }}>
                    <div className="tooltip-title">{tooltip.label}</div>
                    {tooltip.datasets.map(ds => (
                        <div key={ds.name} className="tooltip-item">
                            <span className="tooltip-color-box" style={{ backgroundColor: ds.color }}></span>
                            <span>{ds.name}: ₱{ds.value.toLocaleString()}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const Overview = ({ subscribers, expenses, overviewPerformance, currentUser }) => {
    const { totalSalesThisMonth, totalCommissions, topAgent } = overviewPerformance;
    const [activeTab, setActiveTab] = useState('Monthly');

    const visibleSubscribers = useMemo(() => {
        if (currentUser.role === 'agent') {
            return subscribers.filter(sub => sub.agent === currentUser.name);
        }
        return subscribers;
    }, [subscribers, currentUser]);

    // Agent-specific performance data for the cards
    const agentPerformance = useMemo(() => {
        if (currentUser.role !== 'agent') return null;
        
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();

        // For "Total Installed" this month
        const installedThisMonth = visibleSubscribers.filter(sub => {
            if (!sub.activationDate) return false;
            const activationDate = new Date(sub.activationDate);
            return sub.status === 'Installed' &&
                   activationDate.getFullYear() === currentYear &&
                   activationDate.getMonth() === currentMonth;
        });
        const totalSales = installedThisMonth.length;

        // For "Monthly Conversion Rate"
        const applicationsThisMonth = visibleSubscribers.filter(sub => {
            if (!sub.dateOfApplication) return false;
            const appDate = new Date(sub.dateOfApplication);
            return appDate.getFullYear() === currentYear && appDate.getMonth() === currentMonth;
        });
        const installedFromThisMonthApps = applicationsThisMonth.filter(sub => sub.status === 'Installed').length;
        const totalApplications = applicationsThisMonth.length;
        const conversionRate = totalApplications > 0 ? (installedFromThisMonthApps / totalApplications) * 100 : 0;

        // For Payout stats (all-time for agent, but only for installed subs)
        const installedSubscribers = visibleSubscribers.filter(sub => sub.status === 'Installed');
        const pendingPayouts = installedSubscribers.filter(sub => (sub.payoutStatus || 'Pending') === 'Pending').length;
        const onRequestPayouts = installedSubscribers.filter(sub => sub.payoutStatus === 'On Request').length;
        
        const completedPayoutsData = installedSubscribers.filter(sub => sub.payoutStatus === 'Completed');
        const completedPayouts = completedPayoutsData.length;
        
        const grossIncome = completedPayoutsData.reduce((sum, sub) => sum + getPlanPrice(sub.plan), 0);
        const totalCompletedCommission = completedPayoutsData.reduce((sum, sub) => sum + calculateCommission(sub.plan), 0);

        return { totalSales, conversionRate, pendingPayouts, onRequestPayouts, completedPayouts, grossIncome, totalCompletedCommission };
    }, [visibleSubscribers, currentUser.role]);

    const chartData = useMemo(() => {
        const now = new Date();
        const data = { labels: [], commissions: [], expenses: [] };

        const parseDate = (dateStr) => {
            if (!dateStr) return null;
            const d = new Date(dateStr);
            return isNaN(d.getTime()) ? null : d;
        };

        if (activeTab === 'Monthly') {
            for (let i = 11; i >= 0; i--) {
                const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const month = date.getMonth();
                const year = date.getFullYear();
                
                const monthlyCommissions = visibleSubscribers
                    .filter(s => {
                        const actDate = parseDate(s.activationDate);
                        return s.status === 'Installed' && actDate && actDate.getMonth() === month && actDate.getFullYear() === year;
                    })
                    .reduce((sum, s) => sum + calculateCommission(s.plan), 0);
                
                data.labels.push(date.toLocaleString('default', { month: 'short' }));
                data.commissions.push(monthlyCommissions);
                
                if (currentUser.role === 'admin') {
                    const monthlyExpenses = expenses
                        .filter(e => {
                            const expDate = parseDate(e.date);
                            return expDate && expDate.getMonth() === month && expDate.getFullYear() === year;
                        })
                        .reduce((sum, e) => sum + e.amount, 0);
                    data.expenses.push(monthlyExpenses);
                }
            }
        } else if (activeTab === 'Weekly') {
            for (let i = 11; i >= 0; i--) {
                const weekStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() - (i * 7));
                weekStartDate.setHours(0, 0, 0, 0);
                const weekEndDate = new Date(weekStartDate);
                weekEndDate.setDate(weekEndDate.getDate() + 6);
                weekEndDate.setHours(23, 59, 59, 999);

                const weeklyCommissions = visibleSubscribers
                    .filter(s => {
                        const actDate = parseDate(s.activationDate);
                        return s.status === 'Installed' && actDate && actDate >= weekStartDate && actDate <= weekEndDate;
                    })
                    .reduce((sum, s) => sum + calculateCommission(s.plan), 0);
                
                data.labels.push(`${weekStartDate.getMonth()+1}/${weekStartDate.getDate()}`);
                data.commissions.push(weeklyCommissions);

                if (currentUser.role === 'admin') {
                     const weeklyExpenses = expenses
                         .filter(e => {
                            const expDate = parseDate(e.date);
                            return expDate && expDate >= weekStartDate && expDate <= weekEndDate;
                        })
                        .reduce((sum, e) => sum + e.amount, 0);
                    data.expenses.push(weeklyExpenses);
                }
            }
        } else if (activeTab === 'Daily') {
             for (let i = 29; i >= 0; i--) {
                const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
                date.setHours(0,0,0,0);
                const yyyymmdd = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                
                const dailyCommissions = visibleSubscribers
                    .filter(s => s.status === 'Installed' && s.activationDate === yyyymmdd)
                    .reduce((sum, s) => sum + calculateCommission(s.plan), 0);
                
                data.labels.push(`${date.getMonth()+1}/${date.getDate()}`);
                data.commissions.push(dailyCommissions);
                
                if (currentUser.role === 'admin') {
                    const dailyExpenses = expenses
                        .filter(e => e.date === yyyymmdd)
                        .reduce((sum, e) => sum + e.amount, 0);
                    data.expenses.push(dailyExpenses);
                }
            }
        }

        return data;
    }, [visibleSubscribers, expenses, activeTab, currentUser.role]);
    
    const chartDatasets = [
        { name: 'Commissions', data: chartData.commissions, color: 'var(--primary-brand)' },
    ];
    if (currentUser.role === 'admin') {
        chartDatasets.push({ name: 'Expenses', data: chartData.expenses, color: 'var(--accent-red)' });
    }
    
    return (
        <div>
            <h1>Overview</h1>
            {currentUser.role === 'agent' ? (
                <div className="card-grid">
                    <div className="overview-stat-card">
                        <div className="stat-value">{visibleSubscribers.length}</div>
                        <div className="stat-label">Your Total Subscribers</div>
                    </div>
                    <div className="overview-stat-card">
                        <div className="stat-value">{agentPerformance.totalSales}</div>
                        <div className="stat-label">Total Installed</div>
                    </div>
                    <div className="overview-stat-card">
                        <div className="stat-value">{agentPerformance.pendingPayouts}</div>
                        <div className="stat-label">Pending Payout</div>
                    </div>
                    <div className="overview-stat-card">
                        <div className="stat-value">{agentPerformance.onRequestPayouts}</div>
                        <div className="stat-label">On Request Payout</div>
                    </div>
                     <div className="overview-stat-card">
                        <div className="stat-value">{agentPerformance.completedPayouts}</div>
                        <div className="stat-label">Total Completed Payout</div>
                    </div>
                    <div className="overview-stat-card">
                        <div className="stat-value">{agentPerformance.conversionRate.toFixed(1)}%</div>
                        <div className="stat-label">Monthly Conversion Rate</div>
                    </div>
                     <div className="overview-stat-card">
                        <div className="stat-value">₱{agentPerformance.grossIncome.toLocaleString()}</div>
                        <div className="stat-label">Gross Income (Completed)</div>
                    </div>
                    <div className="overview-stat-card">
                        <div className="stat-value">₱{agentPerformance.totalCompletedCommission.toLocaleString()}</div>
                        <div className="stat-label">Total Commission (Completed)</div>
                    </div>
                </div>
            ) : (
                <div className="card-grid">
                    <div className="overview-stat-card">
                        <div className="stat-value">{visibleSubscribers.length}</div>
                        <div className="stat-label">Total Subscribers</div>
                    </div>
                    <div className="overview-stat-card">
                        <div className="stat-value">{totalSalesThisMonth}</div>
                        <div className="stat-label">Total Sales This Month</div>
                    </div>
                    <div className="overview-stat-card">
                        <div className="stat-value">₱{totalCommissions.toLocaleString()}</div>
                        <div className="stat-label">Total Commissions This Month</div>
                    </div>
                    <div className="overview-stat-card">
                        <div className="stat-value">{topAgent.name}</div>
                        <div className="stat-label">Top Performing Agent</div>
                    </div>
                </div>
            )}

            <div className="card" style={{ marginTop: '2rem' }}>
                <h2>{currentUser.role === 'agent' ? 'My Commission Trend' : 'Commission vs. Expenses'}</h2>
                 <div className="tabs">
                    <button className={activeTab === 'Daily' ? 'active' : ''} onClick={() => setActiveTab('Daily')}>Daily</button>
                    <button className={activeTab === 'Weekly' ? 'active' : ''} onClick={() => setActiveTab('Weekly')}>Weekly</button>
                    <button className={activeTab === 'Monthly' ? 'active' : ''} onClick={() => setActiveTab('Monthly')}>Monthly</button>
                </div>
                <LineChart
                    labels={chartData.labels}
                    datasets={chartDatasets}
                />
            </div>
        </div>
    );
};

const SubscriberModal = ({ isOpen, onClose, onSave, subscriber, agents, plans, currentUser }) => {
    const initialFormState = {
        dateOfApplication: new Date().toISOString().split('T')[0],
        name: '',
        jobOrderNo: '',
        plan: plans[0] || '',
        activationDate: '',
        agent: currentUser.role === 'agent' ? currentUser.name : (agents[0] || ''),
        status: 'Pending',
        reason: '',
    };
    
    const [formData, setFormData] = useState(initialFormState);

    useEffect(() => {
        if (subscriber) {
            setFormData({
                ...subscriber,
                activationDate: subscriber.activationDate || '' 
            });
        } else {
            setFormData(initialFormState);
        }
    }, [subscriber, isOpen, plans, agents, currentUser]);

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const newState = { ...prev, [name]: value };

            if (name === 'status' && value === 'Installed') {
                newState.activationDate = new Date().toISOString().split('T')[0];
            }
            
            if (name === 'status' && value !== 'Cancelled' && value !== 'Reject') {
                newState.reason = '';
            }

            return newState;
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="modal-backdrop">
            <div className="modal-content">
                <h2>{subscriber ? 'Edit Subscriber' : 'Add New Subscriber'}</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="dateOfApplication">Date of Application</label>
                        <input type="date" id="dateOfApplication" name="dateOfApplication" className="form-control" value={formData.dateOfApplication} onChange={handleChange} required disabled={!!subscriber} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="name">Name</label>
                        <input type="text" id="name" name="name" className="form-control" value={formData.name} onChange={handleChange} required />
                    </div>
                     <div className="form-group">
                        <label htmlFor="jobOrderNo">Job Order No.</label>
                        <input type="text" id="jobOrderNo" name="jobOrderNo" className="form-control" value={formData.jobOrderNo} onChange={handleChange} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="plan">Plan</label>
                        <select id="plan" name="plan" className="form-control" value={formData.plan} onChange={handleChange} required>
                            {plans.map(plan => <option key={plan} value={plan}>{plan}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label htmlFor="activationDate">Activation Date</label>
                        <input type="date" id="activationDate" name="activationDate" className="form-control" value={formData.activationDate} onChange={handleChange} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="agent">Agent</label>
                        <select id="agent" name="agent" className="form-control" value={formData.agent} onChange={handleChange} required disabled={currentUser.role === 'agent'}>
                            {agents.map(agent => <option key={agent} value={agent}>{agent}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label htmlFor="status">Status</label>
                        <select id="status" name="status" className="form-control" value={formData.status} onChange={handleChange} required>
                            <option value="Pending">Pending</option>
                            <option value="On The Way">On The Way</option>
                            <option value="Installed">Installed</option>
                            <option value="Cancelled">Cancelled</option>
                            <option value="Reject">Reject</option>
                        </select>
                    </div>
                    {(formData.status === 'Cancelled' || formData.status === 'Reject') && (
                        <div className="form-group">
                            <label htmlFor="reason">Reason</label>
                            <textarea id="reason" name="reason" className="form-control" value={formData.reason} onChange={handleChange} required />
                        </div>
                    )}
                    <div className="modal-actions">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary">Save</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const Subscribers = ({ subscribers, onSave, onDelete, agents, plans, currentUser }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSubscriber, setEditingSubscriber] = useState(null);
    
    const visibleSubscribers = useMemo(() => {
        if (currentUser.role === 'agent') {
            return subscribers.filter(sub => sub.agent === currentUser.name);
        }
        return subscribers;
    }, [subscribers, currentUser]);

    const filteredSubscribers = useMemo(() => 
        visibleSubscribers
            .filter(sub => 
                Object.values(sub).some(val => 
                    String(val).toLowerCase().includes(searchTerm.toLowerCase())
                )
            )
            .sort((a, b) => {
                const dateA = a.dateOfApplication ? new Date(a.dateOfApplication).getTime() : 0;
                const dateB = b.dateOfApplication ? new Date(b.dateOfApplication).getTime() : 0;
                return dateB - dateA;
            }),
        [searchTerm, visibleSubscribers]
    );
    
    const openModal = (subscriber = null) => {
        setEditingSubscriber(subscriber);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingSubscriber(null);
    };

    const handleSave = (subscriberData) => {
        onSave(subscriberData);
        closeModal();
    };

    const handleDelete = (id) => {
        if (window.confirm('Are you sure you want to delete this subscriber?')) {
            onDelete(id);
        }
    };
    
    const statusBadgeStyle = (status) => ({
        backgroundColor: 
            status === 'Installed' ? 'var(--accent-green)' :
            status === 'Pending' ? 'var(--accent-yellow)' :
            status === 'On The Way' ? 'var(--accent-blue)' :
            status === 'Cancelled' ? 'var(--accent-red)' :
            status === 'Reject' ? 'var(--accent-gray)' :
            '#6c757d',
    });

    return (
        <div>
            <div className="page-header">
                <h1>Subscribers</h1>
                <button className="btn btn-primary" onClick={() => openModal()}>New Subscriber</button>
            </div>
            <div className="card">
                <input
                    type="text"
                    placeholder="Search subscribers..."
                    className="form-control"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    aria-label="Search subscribers"
                    style={{maxWidth: '450px'}}
                />
                <div className="table-responsive-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Date of App.</th>
                                <th>Name</th>
                                <th>Job Order No.</th>
                                <th>Plan</th>
                                <th>Activation Date</th>
                                <th>Agent</th>
                                <th>Status</th>
                                <th>Reason</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSubscribers.map(sub => (
                                <tr key={sub.id}>
                                    <td>{formatDate(sub.dateOfApplication)}</td>
                                    <td>{sub.name}</td>
                                    <td>{sub.jobOrderNo}</td>
                                    <td>{sub.plan}</td>
                                    <td>{formatDate(sub.activationDate)}</td>
                                    <td>{sub.agent}</td>
                                    <td><span className="status-badge" style={statusBadgeStyle(sub.status)}>{sub.status}</span></td>
                                    <td>{sub.reason}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                                            <button className="btn-icon" onClick={() => openModal(sub)} aria-label={`Edit ${sub.name}`}>
                                                <Icon path="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                                            </button>
                                            <button className="btn-icon btn-icon-danger" onClick={() => handleDelete(sub.id)} aria-label={`Delete ${sub.name}`}>
                                                 <Icon path="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <SubscriberModal 
                isOpen={isModalOpen} 
                onClose={closeModal}
                onSave={handleSave}
                subscriber={editingSubscriber}
                agents={agents}
                plans={plans}
                currentUser={currentUser}
            />
        </div>
    );
};

const MyPerformance = ({ subscribers, currentUser }) => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    const [selectedMonth, setSelectedMonth] = useState(currentMonth);
    const [selectedYear, setSelectedYear] = useState(currentYear);

    const performanceData = useMemo(() => {
        const agentSubs = subscribers.filter(sub => {
            if (!sub.dateOfApplication || sub.agent !== currentUser.name) return false;
            const appDate = new Date(sub.dateOfApplication);
            return appDate.getFullYear() === selectedYear && (appDate.getMonth() + 1) === selectedMonth;
        });

        const totalApplications = agentSubs.length;
        const installedSales = agentSubs.filter(sub => sub.status === 'Installed').length;
        const pending = agentSubs.filter(sub => ['Pending', 'On The Way'].includes(sub.status)).length;
        const cancelledOrRejected = agentSubs.filter(sub => ['Cancelled', 'Reject'].includes(sub.status)).length;
        
        const totalCommission = agentSubs
            .filter(sub => sub.status === 'Installed')
            .reduce((sum, sub) => sum + calculateCommission(sub.plan), 0);
        
        const conversionRate = totalApplications > 0 ? (installedSales / totalApplications) * 100 : 0;

        return {
            totalApplications,
            installedSales,
            pending,
            cancelledOrRejected,
            conversionRate,
            totalCommission,
        };
    }, [subscribers, currentUser.name, selectedMonth, selectedYear]);

    return (
        <div>
            <h1>My Performance</h1>
             <div className="card">
                <div className="report-filters">
                    <div className="form-group">
                        <label>Month</label>
                        <select className="form-control" value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}>
                            {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Year</label>
                        <input className="form-control" type="number" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} />
                    </div>
                </div>
            </div>
            <div className="card-grid" style={{ marginTop: '2rem' }}>
                <div className="stat-card">
                    <div className="stat-value">{performanceData.installedSales}</div>
                    <div className="stat-label">Installed Sales</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{performanceData.totalApplications}</div>
                    <div className="stat-label">Total Applications</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{performanceData.conversionRate.toFixed(1)}%</div>
                    <div className="stat-label">Conversion Rate</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{performanceData.pending}</div>
                    <div className="stat-label">Pending</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{performanceData.cancelledOrRejected}</div>
                    <div className="stat-label">Cancelled / Rejected</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">₱{performanceData.totalCommission.toLocaleString()}</div>
                    <div className="stat-label">Commission Earned</div>
                </div>
            </div>
        </div>
    );
};

const AgentPerformance = ({ subscribers, agents }) => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    const [selectedMonth, setSelectedMonth] = useState(currentMonth);
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [sortConfig, setSortConfig] = useState({ key: 'installedSales', direction: 'descending' });

    const performanceData = useMemo(() => {
        return agents.map(agentName => {
            const agentSubs = subscribers.filter(sub => {
                if (!sub.dateOfApplication) return false;
                const appDate = new Date(sub.dateOfApplication);
                return sub.agent === agentName && appDate.getFullYear() === selectedYear && (appDate.getMonth() + 1) === selectedMonth;
            });

            const totalApplications = agentSubs.length;
            const installedSales = agentSubs.filter(sub => sub.status === 'Installed').length;
            const pending = agentSubs.filter(sub => ['Pending', 'On The Way'].includes(sub.status)).length;
            const cancelledOrRejected = agentSubs.filter(sub => ['Cancelled', 'Reject'].includes(sub.status)).length;
            
            const totalCommission = agentSubs
                .filter(sub => sub.status === 'Installed')
                .reduce((sum, sub) => sum + calculateCommission(sub.plan), 0);
            
            const conversionRate = totalApplications > 0 ? (installedSales / totalApplications) * 100 : 0;

            return {
                name: agentName,
                totalApplications,
                installedSales,
                pending,
                cancelledOrRejected,
                conversionRate,
                totalCommission,
            };
        });
    }, [subscribers, agents, selectedMonth, selectedYear]);

    const sortedPerformanceData = useMemo(() => {
        let sortableItems = [...performanceData];
        if (sortConfig.key) {
            sortableItems.sort((a, b) => {
                if (a[sortConfig.key] < b[sortConfig.key]) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (a[sortConfig.key] > b[sortConfig.key]) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [performanceData, sortConfig]);

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIndicator = (key) => {
        if (sortConfig.key !== key) return ' ';
        return sortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
    };

    const thSortableStyle: React.CSSProperties = { cursor: 'pointer', userSelect: 'none' };

    return (
        <div>
            <h1>Agent Performance</h1>
            <div className="card">
                <div className="report-filters">
                    <div className="form-group">
                        <label>Month</label>
                        <select className="form-control" value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}>
                            {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Year</label>
                        <input className="form-control" type="number" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} />
                    </div>
                </div>

                <div className="table-responsive-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th style={thSortableStyle} onClick={() => requestSort('name')}>Agent Name{getSortIndicator('name')}</th>
                                <th style={thSortableStyle} onClick={() => requestSort('installedSales')}>Installed Sales{getSortIndicator('installedSales')}</th>
                                <th style={thSortableStyle} onClick={() => requestSort('totalApplications')}>Total Apps{getSortIndicator('totalApplications')}</th>
                                <th style={thSortableStyle} onClick={() => requestSort('conversionRate')}>Conversion Rate{getSortIndicator('conversionRate')}</th>
                                <th style={thSortableStyle} onClick={() => requestSort('pending')}>Pending{getSortIndicator('pending')}</th>
                                <th style={thSortableStyle} onClick={() => requestSort('cancelledOrRejected')}>Cancelled/Rejected{getSortIndicator('cancelledOrRejected')}</th>
                                <th style={thSortableStyle} onClick={() => requestSort('totalCommission')}>Commission Earned{getSortIndicator('totalCommission')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedPerformanceData.map(agent => (
                                <tr key={agent.name}>
                                    <td>{agent.name}</td>
                                    <td style={{fontWeight: 600, color: 'var(--primary-brand)'}}>{agent.installedSales}</td>
                                    <td>{agent.totalApplications}</td>
                                    <td>{agent.conversionRate.toFixed(1)}%</td>
                                    <td>{agent.pending}</td>
                                    <td>{agent.cancelledOrRejected}</td>
                                    <td>₱{agent.totalCommission.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const RejectionReasonModal = ({ isOpen, onClose, onSave, initialReason }) => {
    const [reason, setReason] = useState('');

    useEffect(() => {
        if (isOpen) {
            setReason(initialReason || '');
        }
    }, [isOpen, initialReason]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(reason);
    };

    return (
        <div className="modal-backdrop">
            <div className="modal-content">
                <h2>Reason for Rejection</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="rejectionReason">Please provide a reason for rejecting this payout.</label>
                        <textarea
                            id="rejectionReason"
                            className="form-control"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            required
                            rows={4}
                            autoFocus
                        />
                    </div>
                    <div className="modal-actions">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary">Save Reason</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const PayoutReports = ({ subscribers, agents, currentUser, onSaveSubscriber }) => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    const [selectedMonth, setSelectedMonth] = useState(currentMonth);
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [selectedAgent, setSelectedAgent] = useState(currentUser.role === 'admin' ? 'All' : currentUser.name);
    const [isRejectionModalOpen, setIsRejectionModalOpen] = useState(false);
    const [editingSubscriberForRejection, setEditingSubscriberForRejection] = useState(null);

    const reportData = useMemo(() => {
        return subscribers.filter(sub => {
            if (!sub.activationDate) return false;
            const activationDate = new Date(sub.activationDate);
            const isInstalled = sub.status === 'Installed';
            const matchesAgent = currentUser.role === 'admin' ? (selectedAgent === 'All' || sub.agent === selectedAgent) : sub.agent === currentUser.name;
            const matchesDate = activationDate.getFullYear() === selectedYear && (activationDate.getMonth() + 1) === selectedMonth;
            
            return isInstalled && matchesAgent && matchesDate;
        }).map(sub => ({
            ...sub,
            commission: calculateCommission(sub.plan)
        }));
    }, [subscribers, selectedMonth, selectedYear, selectedAgent, currentUser]);

    const totalCommission = useMemo(() => reportData.reduce((sum, item) => sum + item.commission, 0), [reportData]);
    const totalSales = reportData.length;

    const handlePrint = () => {
        window.print();
    };
    
    const handleStatusChange = (subscriber, newStatus) => {
        if (newStatus === 'Rejected') {
            setEditingSubscriberForRejection(subscriber);
            setIsRejectionModalOpen(true);
        } else {
            const updatedSubscriber = {
                ...subscriber,
                payoutStatus: newStatus,
                payoutRejectionReason: '', // Clear reason if not rejected
            };
            onSaveSubscriber(updatedSubscriber);
        }
    };
    
    const handleSaveRejection = (reason) => {
        if (!editingSubscriberForRejection) return;
        const updatedSubscriber = {
            ...editingSubscriberForRejection,
            payoutStatus: 'Rejected',
            payoutRejectionReason: reason,
        };
        onSaveSubscriber(updatedSubscriber);
        closeRejectionModal();
    };

    const closeRejectionModal = () => {
        setIsRejectionModalOpen(false);
        setEditingSubscriberForRejection(null);
    };

    return (
        <div>
            <div className="page-header">
                <h1>Payout Reports</h1>
                <button className="btn btn-secondary no-print" onClick={handlePrint}>Print Report</button>
            </div>
            <div className="card">
                <div className="report-filters no-print">
                    <div className="form-group">
                        <label>Month</label>
                        <select className="form-control" value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}>
                            {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Year</label>
                        <input className="form-control" type="number" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} />
                    </div>
                    {currentUser.role === 'admin' && (
                         <div className="form-group">
                            <label>Agent</label>
                            <select className="form-control" value={selectedAgent} onChange={e => setSelectedAgent(e.target.value)}>
                                <option value="All">All Agents</option>
                                {agents.map(agent => <option key={agent} value={agent}>{agent}</option>)}
                            </select>
                        </div>
                    )}
                </div>

                <div className="card-grid" style={{marginTop: '2rem'}}>
                     <div className="stat-card">
                        <div className="stat-value">{totalSales}</div>
                        <div className="stat-label">Total Sales</div>
                    </div>
                     <div className="stat-card">
                        <div className="stat-value">₱{totalCommission.toLocaleString()}</div>
                        <div className="stat-label">Total Commission</div>
                    </div>
                </div>

                <div className="table-responsive-wrapper">
                    <table className="data-table report-table">
                        <thead>
                            <tr>
                                <th>Agent Name</th>
                                <th>Subscriber Name</th>
                                <th>Plan</th>
                                <th>Activation Date</th>
                                <th>Commission</th>
                                <th>Payout Status</th>
                                <th>Rejection Reason</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reportData.length > 0 ? reportData.map(item => (
                                <tr key={item.id}>
                                    <td>{item.agent}</td>
                                    <td>{item.name}</td>
                                    <td>{item.plan}</td>
                                    <td>{formatDate(item.activationDate)}</td>
                                    <td>₱{item.commission.toLocaleString()}</td>
                                    <td>
                                        {currentUser.role === 'admin' ? (
                                            <select
                                                className="form-control table-select"
                                                value={item.payoutStatus || 'Pending'}
                                                onChange={(e) => handleStatusChange(item, e.target.value)}
                                                aria-label={`Payout status for ${item.name}`}
                                            >
                                                <option value="Pending">Pending</option>
                                                <option value="On Request">On Request</option>
                                                <option value="Completed">Completed</option>
                                                <option value="Rejected">Rejected</option>
                                            </select>
                                        ) : (
                                            <span className="status-badge" style={payoutStatusBadgeStyle(item.payoutStatus || 'Pending')}>
                                                {item.payoutStatus || 'Pending'}
                                            </span>
                                        )}
                                    </td>
                                    <td>{item.payoutRejectionReason}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={7} style={{textAlign: 'center', padding: '1rem'}}>No data available for the selected period.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            <RejectionReasonModal
                isOpen={isRejectionModalOpen}
                onClose={closeRejectionModal}
                onSave={handleSaveRejection}
                initialReason={editingSubscriberForRejection?.payoutRejectionReason || ''}
            />
        </div>
    );
};

const PieChart = ({ data }) => {
    const colors = ['var(--primary-brand)', 'var(--accent-green)', 'var(--accent-yellow)', 'var(--accent-red)', '#8b5cf6'];
    const total = data.reduce((sum, item) => sum + item.value, 0);
    if (total === 0) return <p>No data to display.</p>;
    
    let cumulativePercent = 0;
    const slices = data.map((item, index) => {
        const percent = (item.value / total) * 100;
        const startAngle = (cumulativePercent / 100) * 360;
        const endAngle = ((cumulativePercent + percent) / 100) * 360;
        cumulativePercent += percent;

        const getCoords = (angle) => {
            const radians = (angle - 90) * Math.PI / 180;
            return [50 + 40 * Math.cos(radians), 50 + 40 * Math.sin(radians)];
        };

        const [startX, startY] = getCoords(startAngle);
        const [endX, endY] = getCoords(endAngle);
        const largeArcFlag = percent > 50 ? 1 : 0;
        
        const pathData = `M 50,50 L ${startX},${startY} A 40,40 0 ${largeArcFlag},1 ${endX},${endY} Z`;

        return <path key={item.name} d={pathData} fill={colors[index % colors.length]} />;
    });

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
            <svg viewBox="0 0 100 100" width="200" height="200" style={{flexShrink: 0}}>{slices}</svg>
            <div>
                {data.map((item, index) => (
                    <div key={item.name} style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ height: '1rem', width: '1rem', backgroundColor: colors[index % colors.length], marginRight: '0.5rem', borderRadius: '3px' }}></span>
                        <span>{item.name}: {item.value} ({((item.value/total)*100).toFixed(1)}%)</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ExpenseModal = ({ isOpen, onClose, onSave, expense }) => {
    const expenseCategories = ['Marketing', 'Office Supplies', 'Travel', 'Utilities', 'Others'];
    const initialFormState = {
        date: new Date().toISOString().split('T')[0],
        category: expenseCategories[0],
        description: '',
        amount: ''
    };
    
    const [formData, setFormData] = useState(initialFormState);

    useEffect(() => {
        if (expense) {
            setFormData(expense);
        } else {
            setFormData(initialFormState);
        }
    }, [expense, isOpen]);

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({ ...formData, amount: parseFloat(formData.amount) || 0 });
    };

    return (
        <div className="modal-backdrop">
            <div className="modal-content">
                <h2>{expense ? 'Edit Expense' : 'Add New Expense'}</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="date">Date</label>
                        <input type="date" id="date" name="date" className="form-control" value={formData.date} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="category">Category</label>
                        <select id="category" name="category" className="form-control" value={formData.category} onChange={handleChange} required>
                            {expenseCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                    </div>
                     <div className="form-group">
                        <label htmlFor="description">Description</label>
                        <input type="text" id="description" name="description" className="form-control" value={formData.description} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="amount">Amount</label>
                        <input type="number" id="amount" name="amount" className="form-control" value={formData.amount} onChange={handleChange} required step="0.01" />
                    </div>
                    <div className="modal-actions">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary">Save</button>
                    </div>
                </form>
            </div>
        </div>
    );
};


const AccountingFinancial = ({ subscribers, expenses, onSaveExpense, onDeleteExpense }) => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    const [selectedMonth, setSelectedMonth] = useState(currentMonth);
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState(null);
    
    const financialData = useMemo(() => {
        const filteredSubs = subscribers.filter(sub => {
            if (!sub.activationDate) return false;
            const activationDate = new Date(sub.activationDate);
            return sub.status === 'Installed' &&
                   activationDate.getFullYear() === selectedYear &&
                   (activationDate.getMonth() + 1) === selectedMonth;
        });
        
        const filteredExpenses = expenses.filter(exp => {
            if (!exp.date) return false;
            const expenseDate = new Date(exp.date);
            return expenseDate.getFullYear() === selectedYear &&
                   (expenseDate.getMonth() + 1) === selectedMonth;
        });

        const totalRevenue = filteredSubs.reduce((sum, sub) => sum + getPlanPrice(sub.plan), 0);
        const totalPayouts = filteredSubs.reduce((sum, sub) => sum + calculateCommission(sub.plan), 0);
        const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);
        const netRevenue = totalRevenue - totalPayouts - totalExpenses;

        const planDistribution = residentialPlans.map(plan => ({
            name: plan,
            value: filteredSubs.filter(sub => sub.plan === plan).length
        })).filter(p => p.value > 0);

        return { totalRevenue, totalPayouts, totalExpenses, netRevenue, planDistribution, expensesForPeriod: filteredExpenses };
    }, [subscribers, expenses, selectedMonth, selectedYear]);

    const openModal = (expense = null) => {
        setEditingExpense(expense);
        setIsModalOpen(true);
    };
    const closeModal = () => {
        setIsModalOpen(false);
        setEditingExpense(null);
    };
    const handleSave = (expenseData) => {
        onSaveExpense(expenseData);
        closeModal();
    };
    const handleDelete = (id) => {
        if (window.confirm('Are you sure you want to delete this expense?')) {
            onDeleteExpense(id);
        }
    };

    return (
        <div>
            <h1>Accounting & Financial</h1>
            <div className="card">
                <div className="report-filters no-print">
                    <div className="form-group">
                        <label>Month</label>
                        <select className="form-control" value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}>
                            {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Year</label>
                        <input className="form-control" type="number" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} />
                    </div>
                </div>
            </div>

            <div className="card-grid" style={{ marginTop: '2rem' }}>
                <div className="stat-card">
                    <div className="stat-value">₱{financialData.totalRevenue.toLocaleString()}</div>
                    <div className="stat-label">Total Revenue</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">₱{financialData.totalPayouts.toLocaleString()}</div>
                    <div className="stat-label">Total Payouts</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">₱{financialData.totalExpenses.toLocaleString()}</div>
                    <div className="stat-label">Total Expenses</div>
                </div>
                 <div className="stat-card">
                    <div className="stat-value" style={{color: financialData.netRevenue >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}}>
                        ₱{financialData.netRevenue.toLocaleString()}
                    </div>
                    <div className="stat-label">Net Revenue</div>
                </div>
            </div>
            
            <div className="card" style={{ marginTop: '2rem' }}>
                <h2>Plan Distribution</h2>
                <PieChart data={financialData.planDistribution} />
            </div>

            <div className="card" style={{ marginTop: '2rem' }}>
                <div className="page-header" style={{marginBottom: '1rem' }}>
                    <h2>Expenses Log</h2>
                    <button className="btn btn-primary no-print" onClick={() => openModal()}>Add Expense</button>
                </div>
                <div className="table-responsive-wrapper">
                    <table className="data-table report-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Category</th>
                                <th>Description</th>
                                <th>Amount</th>
                                <th className="no-print">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {financialData.expensesForPeriod.length > 0 ? financialData.expensesForPeriod.map(exp => (
                                <tr key={exp.id}>
                                    <td>{formatDate(exp.date)}</td>
                                    <td>{exp.category}</td>
                                    <td>{exp.description}</td>
                                    <td>₱{parseFloat(exp.amount || 0).toLocaleString()}</td>
                                    <td className="no-print">
                                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                                            <button className="btn-icon" onClick={() => openModal(exp)} aria-label={`Edit expense`}>
                                                <Icon path="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                                            </button>
                                            <button className="btn-icon btn-icon-danger" onClick={() => handleDelete(exp.id)} aria-label={`Delete expense`}>
                                                 <Icon path="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={5} style={{textAlign: 'center', padding: '1rem'}}>No expenses logged for this period.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            <ExpenseModal 
                isOpen={isModalOpen}
                onClose={closeModal}
                onSave={handleSave}
                expense={editingExpense}
            />
        </div>
    );
};


const App = () => {
    const [currentUser, setCurrentUser] = useState(() => {
        try {
            const savedUser = localStorage.getItem('currentUser');
            return savedUser ? JSON.parse(savedUser) : null;
        } catch (error) {
            console.error("Could not parse user from localStorage", error);
            return null;
        }
    });
    const [activeMenu, setActiveMenu] = useState('Overview');
    const [subscribers, setSubscribers] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [agents] = useState(initialAgents);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    const formatDateForSheet = (dateString) => {
        if (dateString && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
            const [year, month, day] = dateString.split('-');
            return `${month}-${day}-${year}`;
        }
        return dateString;
    };

    useEffect(() => {
        if (isSidebarOpen) {
            document.body.classList.add('body-no-scroll');
        } else {
            document.body.classList.remove('body-no-scroll');
        }
    }, [isSidebarOpen]);
    
    useEffect(() => {
        if (!currentUser) {
            setIsLoading(false);
            return;
        }

        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await fetch(GOOGLE_SCRIPT_URL);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                if (data.status === 'error') {
                    throw new Error(data.message);
                }
                
                const processedSubscribers = (data.subscribers || []).map((item, index) => ({
                    ...item,
                    id: item.id || `sheet-row-${index + 2}`,
                    dateOfApplication: normalizeDateToYYYYMMDD(item.dateOfApplication),
                    name: item.name || '',
                    jobOrderNo: item.jobOrderNo || '',
                    plan: item.plan || '',
                    activationDate: normalizeDateToYYYYMMDD(item.activationDate),
                    agent: item.agent || '',
                    status: item.status || 'Pending',
                    reason: item.reason || '',
                    payoutStatus: item.payoutStatus || 'Pending',
                    payoutRejectionReason: item.payoutRejectionReason || ''
                }));
                setSubscribers(processedSubscribers);

                const processedExpenses = (data.expenses || []).map((item, index) => ({
                    ...item,
                    id: item.id || `exp-row-${index + 2}`,
                    date: normalizeDateToYYYYMMDD(item.date),
                    category: item.category || 'Others',
                    description: item.description || '',
                    amount: parseFloat(item.amount) || 0
                }));
                setExpenses(processedExpenses);

            } catch (e) {
                console.error("Failed to fetch data from Google Sheets:", e);
                setError("Failed to load data. Please check the Google Sheet and script configuration.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [currentUser]);
    
    const saveDataToSheet = async (dataToSave, sheetName) => {
        setIsSaving(true);
        try {
            const dataForSheet = JSON.parse(JSON.stringify(dataToSave));

            if (sheetName === 'Globe Sales Tracker Data') {
                dataForSheet.forEach(item => {
                    item.dateOfApplication = formatDateForSheet(item.dateOfApplication);
                    item.activationDate = formatDateForSheet(item.activationDate);
                });
            } else if (sheetName === 'Expenses') {
                dataForSheet.forEach(item => {
                    item.date = formatDateForSheet(item.date);
                });
            }

            const payload = {
                sheetName: sheetName,
                data: dataForSheet,
            };

            const response = await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8',
                },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (result.status !== 'success') {
                throw new Error(result.message || `Unknown error saving to ${sheetName}.`);
            }
        } catch (e) {
            console.error(`Failed to save data to ${sheetName}:`, e);
            setError(`Failed to save changes to ${sheetName}. Your latest changes might not be stored.`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveSubscriber = async (subscriberData) => {
        let updatedSubscribers;
        if (subscriberData.id && String(subscriberData.id).startsWith('sheet-row-')) {
            updatedSubscribers = subscribers.map(sub => sub.id === subscriberData.id ? subscriberData : sub);
        } else if (subscriberData.id) {
            updatedSubscribers = subscribers.map(sub => sub.id === subscriberData.id ? subscriberData : sub);
        } else {
            const newSubscriber = { ...subscriberData, id: Date.now() };
            updatedSubscribers = [newSubscriber, ...subscribers];
        }
        setSubscribers(updatedSubscribers);
        await saveDataToSheet(updatedSubscribers, 'Globe Sales Tracker Data');
    };

    const handleDeleteSubscriber = async (id) => {
        const updatedSubscribers = subscribers.filter(sub => sub.id !== id);
        setSubscribers(updatedSubscribers);
        await saveDataToSheet(updatedSubscribers, 'Globe Sales Tracker Data');
    };

    const handleSaveExpense = async (expenseData) => {
        let updatedExpenses;
        if (expenseData.id && String(expenseData.id).includes('-row-')) {
             updatedExpenses = expenses.map(exp => exp.id === expenseData.id ? expenseData : exp);
        } else if (expenseData.id) {
             updatedExpenses = expenses.map(exp => exp.id === expenseData.id ? expenseData : exp);
        } else {
            const newExpense = { ...expenseData, id: Date.now() };
            updatedExpenses = [newExpense, ...expenses];
        }
        setExpenses(updatedExpenses);
        await saveDataToSheet(updatedExpenses, 'Expenses');
    };

    const handleDeleteExpense = async (id) => {
        const updatedExpenses = expenses.filter(exp => exp.id !== id);
        setExpenses(updatedExpenses);
        await saveDataToSheet(updatedExpenses, 'Expenses');
    };

    const overviewPerformance = useMemo(() => {
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();

        const monthlySubscribers = subscribers.filter(sub => {
            if (!sub.activationDate) return false;
            const activationDate = new Date(sub.activationDate);
            return sub.status === 'Installed' &&
                activationDate.getFullYear() === currentYear &&
                activationDate.getMonth() === currentMonth;
        });

        const totalSalesThisMonth = monthlySubscribers.length;
        const totalCommissions = monthlySubscribers.reduce((sum, sub) => sum + calculateCommission(sub.plan), 0);

        const agentSales = agents.map(agentName => {
            const sales = monthlySubscribers.filter(sub => sub.agent === agentName).length;
            return { name: agentName, sales };
        });

        const topAgent = agentSales.length > 0
            ? agentSales.reduce((prev, current) => (prev.sales >= current.sales) ? prev : current)
            : { name: 'N/A', sales: 0 };
        
        return { totalSalesThisMonth, totalCommissions, topAgent };
    }, [subscribers, agents]);


    const handleLogin = (user) => {
        try {
            localStorage.setItem('currentUser', JSON.stringify(user));
        } catch (error) {
            console.error("Failed to save user to localStorage", error);
            setError("Could not save session. You might be logged out on refresh.");
        }
        setCurrentUser(user);
        setActiveMenu('Overview');
    };

    const handleLogout = () => {
        localStorage.removeItem('currentUser');
        setCurrentUser(null);
    };

    const renderContent = () => {
        if (!currentUser) return null;

        switch (activeMenu) {
            case 'Overview': return <Overview subscribers={subscribers} expenses={expenses} overviewPerformance={overviewPerformance} currentUser={currentUser} />;
            case 'Subscribers': return <Subscribers subscribers={subscribers} onSave={handleSaveSubscriber} onDelete={handleDeleteSubscriber} agents={agents} plans={residentialPlans} currentUser={currentUser} />;
            case 'My Performance': return <MyPerformance subscribers={subscribers} currentUser={currentUser} />;
            case 'Agent Performance': return <AgentPerformance subscribers={subscribers} agents={agents} />;
            case 'Payout Reports': return <PayoutReports subscribers={subscribers} agents={agents} currentUser={currentUser} onSaveSubscriber={handleSaveSubscriber} />;
            case 'Accounting & Financial': return <AccountingFinancial subscribers={subscribers} expenses={expenses} onSaveExpense={handleSaveExpense} onDeleteExpense={handleDeleteExpense} />;
            default: return <Overview subscribers={subscribers} expenses={expenses} overviewPerformance={overviewPerformance} currentUser={currentUser} />;
        }
    };

    useEffect(() => {
        if (!currentUser) return;
        const allowedMenusForRole = {
            admin: ['Overview', 'Subscribers', 'Agent Performance', 'Payout Reports', 'Accounting & Financial'],
            agent: ['Overview', 'Subscribers', 'My Performance', 'Payout Reports'],
        };
        if (!allowedMenusForRole[currentUser.role].includes(activeMenu)) {
            setActiveMenu('Overview');
        }
    }, [currentUser, activeMenu]);

    if (isLoading) {
        return <div className="loading-container">Loading data from Google Sheets...</div>;
    }

    if (error && !subscribers.length && !expenses.length) { 
        return <div className="error-container">{error}</div>;
    }

    if (!currentUser) {
        return <Login onLogin={handleLogin} agents={agents} />;
    }

    return (
        <>
            <Sidebar activeMenu={activeMenu} setActiveMenu={setActiveMenu} userRole={currentUser.role} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
            <main className="main-content">
                <Header currentUser={currentUser} onLogout={handleLogout} isSaving={isSaving} onToggleSidebar={toggleSidebar} />
                <div className="content-area">
                    {error && <div className="toast-error">{error}</div>}
                    {renderContent()}
                </div>
            </main>
        </>
    );
};

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);