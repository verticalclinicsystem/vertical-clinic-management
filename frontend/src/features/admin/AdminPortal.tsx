import React, { useState, useEffect, useRef } from 'react';
import {
  Home, BarChart2, Package, Users, Layers,
  Settings, ArrowLeft, LogOut, Search, Bell, Plus,
  RefreshCw, Edit, X, Calendar, Check, AlertCircle,
  Eye, EyeOff, Building
} from 'lucide-react';
import { api } from '../../services/api';
import './AdminPortal.css';

interface AdminPortalProps { onLogout: () => void; }

const CIRC = 314.16; // 2 * PI * 50

function DonutChart({ segments, total, label }: { segments: { value: number; color: string; name: string }[]; total: number; label: string }) {
  let offset = 0;
  return (
    <div className="admin-donut-wrapper">
      <div className="admin-donut-graphic">
        <svg className="admin-donut-svg" width="140" height="140">
          <circle className="admin-donut-circle-bg" cx="70" cy="70" r="50" />
          {segments.map((seg, i) => {
            const dash = total > 0 ? (seg.value / total) * CIRC : 0;
            const el = (
              <circle key={i} className="admin-donut-segment" cx="70" cy="70" r="50"
                stroke={seg.color} strokeDasharray={`${dash} ${CIRC}`} strokeDashoffset={-offset} />
            );
            offset += dash;
            return el;
          })}
        </svg>
        <div className="admin-donut-center">
          <span className="admin-donut-center-num">{total}</span>
          <span className="admin-donut-center-label">{label}</span>
        </div>
      </div>
      <div className="admin-donut-legend">
        {segments.map((seg, i) => (
          <div className="admin-legend-item" key={i}>
            <span className="admin-legend-label-box">
              <span className="admin-legend-color" style={{ backgroundColor: seg.color }} />
              <span className="admin-legend-label">{seg.name}</span>
            </span>
            <span className="admin-legend-value">{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const AdminPortal: React.FC<AdminPortalProps> = ({ onLogout }) => {
  const [activeTab, setActiveTabInternal] = useState<string>(() => localStorage.getItem('admin_portal_tab') || 'dashboard');
  const [tabHistory, setTabHistory] = useState<string[]>([]);

  const changeTab = (newTab: string, pushToHistory = true) => {
    if (newTab === activeTab) return;
    if (pushToHistory) {
      setTabHistory(prev => {
        const next = [...prev, activeTab];
        if (next.length > 10) return next.slice(1);
        return next;
      });
    }
    setActiveTabInternal(newTab);
    localStorage.setItem('admin_portal_tab', newTab);
  };

  const goBackTab = () => {
    if (tabHistory.length === 0) return;
    const prevTab = tabHistory[tabHistory.length - 1];
    setTabHistory(prev => prev.slice(0, -1));
    setActiveTabInternal(prevTab);
    localStorage.setItem('admin_portal_tab', prevTab);
  };

  const handleRootTabChange = (newTab: string) => {
    setTabHistory([]);
    changeTab(newTab, false);
  };
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('admin_portal_tab', activeTab);
  }, [activeTab]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [editingBranch, setEditingBranch] = useState<any>(null);
  const [branchForm, setBranchForm] = useState<any>({
    name: '',
    code: '',
    city: '',
    address: '',
    phone: '',
    email: '',
    gst_number: '',
    opening_hour: '09:00',
    closing_hour: '21:00',
    is_active: true
  });

  const [isAddingBranch, setIsAddingBranch] = useState(false);
  const [newBranchForm, setNewBranchForm] = useState({
    name: '',
    code: '',
    city: '',
    address: '',
    phone: '',
    email: '',
    gst_number: '',
    opening_hour: '09:00',
    closing_hour: '21:00'
  });

  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [newStaffForm, setNewStaffForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    role: 'doctor',
    branch_id: ''
  });

  const [editingStaff, setEditingStaff] = useState<any>(null);
  const [staffForm, setStaffForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    role: 'doctor',
    branch_id: '',
    is_active: true
  });

  const [availabilityRequests, setAvailabilityRequests] = useState<any[]>([]);
  const [resolvingRequest, setResolvingRequest] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [conflictWarning, setConflictWarning] = useState<any[] | null>(null);

  const fetchAvailabilityRequests = async () => {
    try {
      const res = await api.get('/doctors/availability-requests/');
      if (res.data?.success) {
        setAvailabilityRequests(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching availability requests:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'availability-requests') {
      fetchAvailabilityRequests();
    }
  }, [activeTab]);

  const handleEditBranchClick = (br: any) => {
    setEditingBranch(br);
    setBranchForm({
      name: br.name || '',
      code: br.code || '',
      city: br.city || '',
      address: br.address || '',
      phone: br.phone || '',
      email: br.email || '',
      gst_number: br.gst_number || '',
      opening_hour: br.opening_hour || '09:00',
      closing_hour: br.closing_hour || '21:00',
      is_active: br.is_active !== undefined ? br.is_active : br.status === 'active'
    });
  };

  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.put(`/branches/${editingBranch.id}`, branchForm);
      if (res.data?.success) {
        setEditingBranch(null);
        fetchDashboard();
      } else {
        alert(res.data?.message || 'Failed to update branch.');
      }
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Error occurred while updating branch.');
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/branches/', newBranchForm);
      if (res.data?.success) {
        setIsAddingBranch(false);
        setNewBranchForm({ name: '', code: '', city: '', address: '', phone: '', email: '', gst_number: '', opening_hour: '09:00', closing_hour: '21:00' });
        fetchDashboard();
      } else {
        alert(res.data?.message || 'Failed to create branch.');
      }
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Error occurred while creating branch.');
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...newStaffForm,
        branch_id: newStaffForm.branch_id || null
      };
      const res = await api.post('/users/', payload);
      if (res.data?.success) {
        alert('Staff member created successfully!');
        setIsAddingStaff(false);
        setShowPassword(false);
        setNewStaffForm({ full_name: '', email: '', phone: '', password: '', role: 'doctor', branch_id: '' });
        fetchDashboard();
      } else {
        alert(res.data?.message || 'Failed to create staff member.');
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.detail || err.response?.data?.message || 'Error occurred while creating staff member.';
      alert(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
    }
  };

  const handleEditStaffClick = (s: any) => {
    setEditingStaff(s);
    setShowEditPassword(false);
    setStaffForm({
      full_name: s.name || '',
      email: s.email || '',
      phone: s.phone === '—' ? '' : (s.phone || ''),
      password: '',
      role: s.role || 'doctor',
      branch_id: s.branch_id || '',
      is_active: s.status === 'active'
    });
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        full_name: staffForm.full_name,
        email: staffForm.email,
        phone: staffForm.phone || null,
        role: staffForm.role,
        branch_id: staffForm.branch_id || null,
        is_active: staffForm.is_active
      };
      if (staffForm.password) {
        payload.password = staffForm.password;
      }
      const res = await api.put(`/users/${editingStaff.id}`, payload);
      if (res.data?.success) {
        setEditingStaff(null);
        setShowEditPassword(false);
        fetchDashboard();
      } else {
        alert(res.data?.message || 'Failed to update staff member.');
      }
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Error occurred while updating staff member.');
    }
  };

  const handleDeleteStaff = async (staffId: string) => {
    if (staffId === currentUser?.id) {
      alert("You cannot delete your own admin account.");
      return;
    }
    if (!window.confirm("Are you sure you want to permanently delete this staff member? This action will cascade delete all their associated records and cannot be undone.")) {
      return;
    }
    try {
      const res = await api.delete(`/users/${staffId}`);
      if (res.data?.success) {
        setEditingStaff(null);
        fetchDashboard();
      } else {
        alert(res.data?.message || 'Failed to delete staff member.');
      }
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Error occurred while deleting staff member.');
    }
  };

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const [dashRes, meRes] = await Promise.all([
        api.get('/admin/dashboard'),
        api.get('/auth/me'),
      ]);
      if (dashRes.data?.success) setData(dashRes.data.data);
      if (meRes.data?.success) setCurrentUser(meRes.data.data);
      if (activeTab === 'availability-requests') {
        await fetchAvailabilityRequests();
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleResolveRequest = async (requestId: string, status: 'approved' | 'rejected') => {
    try {
      const res = await api.put(`/doctors/availability-requests/${requestId}`, {
        status,
        rejection_reason: status === 'rejected' ? rejectionReason : undefined
      });
      if (res.data?.success) {
        setResolvingRequest(null);
        setRejectionReason('');
        await fetchAvailabilityRequests();
        const conflicts = res.data.data?.conflicts || [];
        if (conflicts.length > 0) {
          setConflictWarning(conflicts);
        } else {
          alert(`Request successfully ${status}.`);
        }
      } else {
        alert(res.data?.message || 'Failed to update request.');
      }
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Error occurred while resolving request.');
    }
  };

  useEffect(() => { fetchDashboard(); }, []);

  const kpis = data?.kpis || {};
  const apptStatus = data?.appointment_status_today || {};
  const stockHealth = data?.medicine_stock_health || {};
  const visitsTrend = data?.patient_visits_trend || [];
  const branches = data?.branches || [];
  const staff = data?.staff || [];
  const inventory = data?.inventory || [];

  const fmtCurrency = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  const initials = currentUser?.full_name?.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) || 'AD';

  const stats = [
    { id: 'revenue', label: 'Total Revenue (MTD)', value: fmtCurrency(kpis.total_revenue_mtd || 0), trend: 'MTD', trendType: 'up', color: 'var(--revenue-green)' },
    { id: 'patients', label: 'Total Patients', value: String(kpis.total_patients || 0), trend: 'Registered', trendType: 'neutral', color: 'var(--patients-blue)' },
    { id: 'doctors', label: 'Doctors', value: String(kpis.active_doctors || 0), trend: 'Active', trendType: 'neutral', color: 'var(--doctors-teal)' },
    { id: 'appointments', label: 'Appointments Today', value: String(kpis.appointments_today || 0), trend: 'Today', trendType: 'neutral', color: 'var(--appt-orange)' },
    { id: 'inventory', label: 'Inventory SKUs', value: String(kpis.total_skus || 0), trend: kpis.low_stock_count > 0 ? `${kpis.low_stock_count} low` : 'OK', trendType: kpis.low_stock_count > 0 ? 'warning' : 'neutral', color: 'var(--inv-red)' },
    { id: 'branches', label: 'Active Branches', value: String(kpis.active_branches || 0), trend: 'All OK', trendType: 'neutral', color: 'var(--branch-indigo)' },
  ];

  const apptSegments = [
    { name: 'Confirmed', value: apptStatus.confirmed || 0, color: '#3b82f6' },
    { name: 'Waiting', value: (apptStatus.checked_in || 0) + (apptStatus.pending || 0), color: '#f59e0b' },
    { name: 'Completed', value: apptStatus.completed || 0, color: '#10b981' },
    { name: 'Cancelled', value: apptStatus.cancelled || 0, color: '#ef4444' },
  ];

  const stockSegments = [
    { name: 'In Stock', value: stockHealth.in_stock || 0, color: '#10b981' },
    { name: 'Low Stock', value: stockHealth.low_stock || 0, color: '#ef4444' },
  ];

  const maxVisits = Math.max(...visitsTrend.map((v: any) => v.count), 1);

  const filteredInventory = inventory.filter((i: any) =>
    i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.category.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredStaff = staff.filter((s: any) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.role.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredBranches = branches.filter((b: any) =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <div className="admin-logo-badge">V</div>
          <div className="admin-clinic-info">
            <span className="admin-clinic-name">Vertical Clinic</span>
            <span className="admin-clinic-sub">CLINIC OS</span>
          </div>
        </div>
        <div className="admin-sidebar-pill">Admin Portal</div>
        <nav className="admin-sidebar-nav">
          <div className="admin-nav-group-label">Main</div>
          {[
            { id: 'dashboard', icon: <Home size={18} />, label: 'Dashboard' },
            { id: 'reports', icon: <BarChart2 size={18} />, label: 'Reports' },
            { id: 'inventory', icon: <Package size={18} />, label: 'Inventory Reports' },
          ].map(tab => (
            <div key={tab.id} className={`admin-nav-item ${activeTab === tab.id ? 'active' : ''}`} onClick={() => handleRootTabChange(tab.id)}>
              {tab.icon} {tab.label}
            </div>
          ))}
          <div className="admin-nav-group-label">Manage</div>
          {[
            { id: 'staff', icon: <Users size={18} />, label: 'Staff Management' },
            { id: 'branches', icon: <Layers size={18} />, label: 'Branch Management' },
            { id: 'availability-requests', icon: <Calendar size={18} />, label: 'Availability Requests' },
            { id: 'settings', icon: <Settings size={18} />, label: 'Settings' },
          ].map(tab => (
            <div key={tab.id} className={`admin-nav-item ${activeTab === tab.id ? 'active' : ''}`} onClick={() => handleRootTabChange(tab.id)}>
              {tab.icon} {tab.label}
            </div>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <button className="admin-btn-switch" onClick={onLogout}>
            <LogOut size={14} /> Log Out
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div className="admin-title-area" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '14px' }}>
            {tabHistory.length > 0 && (
              <button 
                onClick={goBackTab} 
                className="admin-back-btn" 
                title="Go Back"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div>
              <h1 className="admin-page-title" style={{ margin: 0 }}>
                {activeTab === 'dashboard' && 'Dashboard'}
                {activeTab === 'reports' && 'Reports'}
                {activeTab === 'inventory' && 'Inventory Reports'}
                {activeTab === 'staff' && 'Staff Management'}
                {activeTab === 'branches' && 'Branch Management'}
                {activeTab === 'availability-requests' && 'Availability Change Requests'}
                {activeTab === 'settings' && 'Settings'}
              </h1>
              <p className="admin-page-subtitle" style={{ marginTop: '2px', margin: 0 }}>Admin Portal · Vertical Clinic</p>
            </div>
          </div>
          <div className="admin-topbar-right">
            <button className="admin-icon-btn" title="Refresh" onClick={fetchDashboard}>
              <RefreshCw size={16} className={loading ? 'spin' : ''} />
            </button>
            <button className="admin-icon-btn"><Bell size={18} /></button>

            <div className="profile-dropdown-wrapper" ref={profileDropdownRef}>
              <div 
                className="admin-profile-badge" 
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                style={{ cursor: 'pointer' }}
              >
                <div className="admin-profile-avatar">{initials}</div>
                <div className="admin-profile-info">
                  <span className="admin-profile-name">{currentUser?.full_name || 'Admin'}</span>
                  <span className="admin-profile-role">Admin</span>
                </div>
              </div>

              {isProfileDropdownOpen && (
                <div className="profile-dropdown-menu">
                  <button onClick={() => { handleRootTabChange('settings'); setIsProfileDropdownOpen(false); }}>
                    <Settings size={14} style={{ color: 'var(--primary-teal, #0c6e8c)' }} /> Settings
                  </button>
                  <div className="profile-dropdown-divider"></div>
                  <button className="logout-item" onClick={() => { onLogout(); setIsProfileDropdownOpen(false); }}>
                    <LogOut size={14} style={{ color: '#dc2626' }} /> Switch Role
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="admin-content">

          {/* ── DASHBOARD ── */}
          {activeTab === 'dashboard' && (
            <>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '60px', color: 'var(--admin-text-muted)' }}>Loading dashboard data…</div>
              ) : (
                <>
                  <div className="admin-stats-grid">
                    {stats.map(st => (
                      <div className="admin-stat-card" key={st.id}>
                        <div className="admin-stat-top">
                          <span className="admin-stat-label">{st.label}</span>
                          <span className={`admin-stat-trend ${st.trendType === 'up' ? 'admin-trend-up' : st.trendType === 'warning' ? 'admin-trend-warning' : 'admin-trend-neutral'}`}>{st.trend}</span>
                        </div>
                        <div className="admin-stat-val">{st.value}</div>
                        <div style={{ height: '4px', width: '40px', backgroundColor: st.color, borderRadius: '2px', marginTop: '8px' }} />
                      </div>
                    ))}
                  </div>

                  <div className="admin-charts-grid">
                    {/* Patient Visits Trend */}
                    <div className="admin-card">
                      <div className="admin-card-header">
                        <h2 className="admin-card-title">Patient Visits — Last 6 Months</h2>
                      </div>
                      <div className="admin-bar-chart-container">
                        {visitsTrend.map((v: any, i: number) => (
                          <div className="admin-bar-column-wrapper" key={i}>
                            <span className="admin-bar-value">{v.count}</span>
                            <div className="admin-bar-column blue-grad" style={{ height: `${Math.max((v.count / maxVisits) * 155, 4)}px` }} />
                            <span className="admin-bar-label">{v.month}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Appointment Status Today */}
                    <div className="admin-card">
                      <div className="admin-card-header">
                        <h2 className="admin-card-title">Appointment Status Today</h2>
                      </div>
                      <DonutChart segments={apptSegments} total={apptStatus.total || 0} label="total" />
                    </div>
                  </div>

                  <div className="admin-charts-grid">
                    {/* Revenue placeholder — real invoices will populate */}
                    <div className="admin-card">
                      <div className="admin-card-header">
                        <h2 className="admin-card-title">Revenue This Month</h2>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '160px', flexDirection: 'column', gap: '8px' }}>
                        <span style={{ fontSize: '2.2rem', fontWeight: 700, color: 'var(--revenue-green)' }}>{fmtCurrency(kpis.total_revenue_mtd || 0)}</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)' }}>Month-to-date from invoices</span>
                      </div>
                    </div>

                    {/* Medicine Stock Health */}
                    <div className="admin-card">
                      <div className="admin-card-header">
                        <h2 className="admin-card-title">Medicine Stock Health</h2>
                      </div>
                      <DonutChart segments={stockSegments} total={stockHealth.total || 0} label="total" />
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* ── REPORTS (placeholder — no static data) ── */}
          {activeTab === 'reports' && (
            <div className="admin-card">
              <div className="admin-card-actions">
                <h2 className="admin-card-title">Clinical & Financial Reports</h2>
                <button className="admin-btn-primary"><Plus size={16} /> Generate Custom Report</button>
              </div>
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--admin-text-muted)' }}>
                Report generation is handled via the billing and consultation APIs. No pre-generated reports exist yet.
              </div>
            </div>
          )}

          {/* ── INVENTORY ── */}
          {activeTab === 'inventory' && (
            <div className="admin-card">
              <div className="admin-card-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 className="admin-card-title">Pharmacy Medicine Stock</h2>
                <div className="admin-search-wrapper" style={{ margin: 0, width: '250px', position: 'relative' }}>
                  <Search className="admin-search-icon" size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--admin-text-muted)' }} />
                  <input type="text" className="admin-search-input" style={{ paddingLeft: '36px', height: '36px', width: '100%', fontSize: '0.85rem' }} placeholder="Search medicines..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
              </div>
              {loading ? <div style={{ padding: '40px', textAlign: 'center' }}>Loading…</div> : (
                <div className="admin-table-container">
                  <table className="admin-table">
                    <thead><tr><th>Medicine Name</th><th>Category</th><th>Stock</th><th>Reorder Point</th><th>Unit Price</th><th>Status</th></tr></thead>
                    <tbody>
                      {filteredInventory.map((item: any) => (
                        <tr key={item.id}>
                          <td style={{ fontWeight: 600 }}>{item.name}</td>
                          <td>{item.category}</td>
                          <td>{item.stock} {item.unit}</td>
                          <td>{item.reorder_level}</td>
                          <td>₹{item.unit_price}</td>
                          <td><span className={`admin-status-badge ${item.is_low_stock ? 'low' : 'active'}`}>{item.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'staff' && (
            <div className="admin-card">
              <div className="admin-card-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 className="admin-card-title">Clinic Staff Directory</h2>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div className="admin-search-wrapper" style={{ margin: 0, width: '250px', position: 'relative' }}>
                    <Search className="admin-search-icon" size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--admin-text-muted)' }} />
                    <input type="text" className="admin-search-input" style={{ paddingLeft: '36px', height: '36px', width: '100%', fontSize: '0.85rem' }} placeholder="Search staff..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                  </div>
                  <button className="admin-btn-primary" onClick={() => { setIsAddingStaff(true); setShowPassword(false); }}>
                    <Plus size={16} /> Add Staff Member
                  </button>
                </div>
              </div>
              {loading ? <div style={{ padding: '40px', textAlign: 'center' }}>Loading…</div> : (
                <div className="admin-table-container">
                  <table className="admin-table">
                    <thead><tr><th>Full Name</th><th>Role</th><th>Email</th><th>Phone</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                      {filteredStaff.map((s: any) => (
                        <tr key={s.id}>
                          <td style={{ fontWeight: 600 }}>{s.name}</td>
                          <td style={{ textTransform: 'capitalize' }}>{s.role}</td>
                          <td>{s.email}</td>
                          <td>{s.phone}</td>
                          <td><span className={`admin-status-badge ${s.status}`}>{s.status}</span></td>
                          <td>
                            <button
                              onClick={() => handleEditStaffClick(s)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--admin-primary)',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.8rem',
                                fontWeight: '600'
                              }}
                            >
                              <Edit size={14} /> Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── BRANCHES ── */}
          {activeTab === 'branches' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="admin-card-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 className="admin-card-title" style={{ margin: 0 }}>Active Branches</h2>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div className="admin-search-wrapper" style={{ margin: 0, width: '250px', position: 'relative' }}>
                    <Search className="admin-search-icon" size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--admin-text-muted)' }} />
                    <input type="text" className="admin-search-input" style={{ paddingLeft: '36px', height: '36px', width: '100%', fontSize: '0.85rem' }} placeholder="Search branches..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                  </div>
                  <button className="admin-btn-primary" onClick={() => setIsAddingBranch(true)}>
                    <Plus size={16} /> Add Branch
                  </button>
                </div>
              </div>
              {loading ? <div style={{ padding: '40px', textAlign: 'center' }}>Loading…</div> : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                  {filteredBranches.map((br: any) => (
                    <div key={br.id} className="branch-card" style={{
                      background: '#fff',
                      border: '1px solid var(--admin-border)',
                      borderRadius: '16px',
                      padding: '24px',
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)',
                      display: 'flex',
                      flexDirection: 'column',
                      position: 'relative'
                    }}>
                      <div className="flex-between" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <div className="stat-icon" style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '10px',
                          background: 'var(--admin-primary-light)',
                          color: 'var(--admin-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <Building size={20} />
                        </div>
                        <span className={`admin-status-badge ${br.status}`} style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          textTransform: 'capitalize',
                          borderRadius: '20px',
                          padding: '4px 12px',
                          fontSize: '0.75rem',
                          lineHeight: '1',
                          backgroundColor: br.status === 'active' ? '#d1fae5' : '#fee2e2',
                          color: br.status === 'active' ? '#065f46' : '#991b1b'
                        }}>
                          <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: br.status === 'active' ? '#059669' : '#dc2626'
                          }} />
                          {br.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--admin-text-dark)' }}>{br.name}</h3>
                      <div className="cell-sub" style={{ fontSize: '0.85rem', color: 'var(--admin-text-muted)', marginBottom: '16px', minHeight: '38px' }}>
                        {br.address || `${br.city}`}
                      </div>
                      <div style={{ height: '1px', background: 'var(--admin-border)', margin: '0 0 16px 0' }} />
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px', fontSize: '0.9rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                          <span style={{ color: 'var(--admin-text-muted)' }}>Phone</span>
                          <strong style={{ color: 'var(--admin-text-dark)' }}>{br.phone}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderTop: '1px dashed var(--admin-border)' }}>
                          <span style={{ color: 'var(--admin-text-muted)' }}>Staff</span>
                          <strong style={{ color: 'var(--admin-text-dark)' }}>{br.staff || 0}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderTop: '1px dashed var(--admin-border)' }}>
                          <span style={{ color: 'var(--admin-text-muted)' }}>Revenue (MTD)</span>
                          <strong style={{ color: 'var(--admin-text-dark)' }}>{fmtCurrency(br.revenue || 0)}</strong>
                        </div>
                      </div>
                      
                      <button
                        className="admin-btn-secondary"
                        onClick={() => handleEditBranchClick(br)}
                        style={{
                          width: '100%',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          padding: '10px',
                          borderRadius: '10px',
                          border: '1px solid var(--admin-border)',
                          background: '#fff',
                          color: 'var(--admin-text-dark)',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.12s ease',
                          fontSize: '0.9rem'
                        }}
                      >
                        <Edit size={14} /> Manage Branch
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── SETTINGS ── */}
          {activeTab === 'settings' && (
            <div className="admin-card" style={{ gap: '20px' }}>
              <h2 className="admin-card-title">System Settings</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                <div style={{ border: '1px solid var(--admin-border)', padding: '20px', borderRadius: '8px' }}>
                  <h3 style={{ fontSize: '0.92rem', marginBottom: '12px' }}>Financial Settings</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)' }}>GST Rate (%)</label>
                    <input type="number" defaultValue="18" style={{ padding: '8px', border: '1px solid var(--admin-border)', borderRadius: '6px' }} />
                    <label style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)' }}>Default Teleconsultation Fee (₹)</label>
                    <input type="number" defaultValue="500" style={{ padding: '8px', border: '1px solid var(--admin-border)', borderRadius: '6px' }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── AVAILABILITY & LEAVE REQUESTS ── */}
          {activeTab === 'availability-requests' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Section 1: Pending Requests */}
              <div className="admin-card">
                <div className="admin-card-actions">
                  <div>
                    <h2 className="admin-card-title">Pending Staff & Doctor Requests</h2>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--admin-text-muted)' }}>
                      Schedule and leave requests requiring admin approval
                    </p>
                  </div>
                  <button className="admin-btn-primary" onClick={fetchAvailabilityRequests} style={{ gap: '6px' }}>
                    <RefreshCw size={14} /> Refresh List
                  </button>
                </div>

                {loading ? (
                  <div style={{ padding: '40px', textAlign: 'center' }}>Loading requests…</div>
                ) : (() => {
                  const pendingReqs = availabilityRequests.filter((r: any) => r.status === 'pending');
                  if (pendingReqs.length === 0) {
                    return (
                      <div style={{ padding: '30px', textAlign: 'center', color: 'var(--admin-text-muted)', fontSize: '0.88rem' }}>
                        No pending availability change requests.
                      </div>
                    );
                  }
                  return (
                    <div className="admin-table-container">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Staff / Doctor</th>
                            <th>Request Type</th>
                            <th>Proposed Change</th>
                            <th>Reason</th>
                            <th>Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pendingReqs.map((req: any) => {
                            let proposedStr = '';
                            if (req.request_type === 'leave') {
                              proposedStr = `${req.proposed_start_date} to ${req.proposed_end_date}`;
                            } else if (req.request_type === 'lunch_break' || req.request_type === 'teleconsultation' || req.request_type === 'shift_timing') {
                              proposedStr = `${req.proposed_start_time} - ${req.proposed_end_time}`;
                            }

                            return (
                              <tr key={req.id}>
                                <td style={{ fontWeight: 600 }}>{req.doctor_name}</td>
                                <td>
                                  <span style={{ textTransform: 'capitalize', fontSize: '0.85rem' }}>
                                    {req.request_type.replace('_', ' ')}
                                  </span>
                                </td>
                                <td>{proposedStr}</td>
                                <td style={{ maxWidth: '250px', whiteSpace: 'normal', fontSize: '0.85rem' }}>{req.reason}</td>
                                <td>
                                  <span className="admin-status-badge pending" style={{ textTransform: 'uppercase' }}>
                                    Pending
                                  </span>
                                </td>
                                <td>
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                      onClick={() => handleResolveRequest(req.id, 'approved')}
                                      style={{
                                        background: '#10b981',
                                        border: 'none',
                                        color: '#fff',
                                        cursor: 'pointer',
                                        padding: '5px 10px',
                                        borderRadius: '6px',
                                        fontSize: '0.75rem',
                                        fontWeight: '600',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                      }}
                                    >
                                      <Check size={12} /> Approve
                                    </button>
                                    <button
                                      onClick={() => setResolvingRequest(req)}
                                      style={{
                                        background: '#ef4444',
                                        border: 'none',
                                        color: '#fff',
                                        cursor: 'pointer',
                                        padding: '5px 10px',
                                        borderRadius: '6px',
                                        fontSize: '0.75rem',
                                        fontWeight: '600',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                      }}
                                    >
                                      <X size={12} /> Reject
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>

              {/* Section 2: Past Requests History */}
              <div className="admin-card">
                <div className="admin-card-header" style={{ marginBottom: '16px' }}>
                  <h2 className="admin-card-title">Past Request History</h2>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--admin-text-muted)' }}>
                    Record of previously approved and rejected leave & schedule requests
                  </p>
                </div>

                {loading ? (
                  <div style={{ padding: '40px', textAlign: 'center' }}>Loading history…</div>
                ) : (() => {
                  const pastReqs = availabilityRequests.filter((r: any) => r.status !== 'pending');
                  if (pastReqs.length === 0) {
                    return (
                      <div style={{ padding: '30px', textAlign: 'center', color: 'var(--admin-text-muted)', fontSize: '0.88rem' }}>
                        No past request history recorded yet.
                      </div>
                    );
                  }
                  return (
                    <div className="admin-table-container">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Staff / Doctor</th>
                            <th>Request Type</th>
                            <th>Proposed Change</th>
                            <th>Reason</th>
                            <th>Status</th>
                            <th>Admin Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pastReqs.map((req: any) => {
                            let proposedStr = '';
                            if (req.request_type === 'leave') {
                              proposedStr = `${req.proposed_start_date} to ${req.proposed_end_date}`;
                            } else if (req.request_type === 'lunch_break' || req.request_type === 'teleconsultation' || req.request_type === 'shift_timing') {
                              proposedStr = `${req.proposed_start_time} - ${req.proposed_end_time}`;
                            }

                            return (
                              <tr key={req.id}>
                                <td style={{ fontWeight: 600 }}>{req.doctor_name}</td>
                                <td>
                                  <span style={{ textTransform: 'capitalize', fontSize: '0.85rem' }}>
                                    {req.request_type.replace('_', ' ')}
                                  </span>
                                </td>
                                <td>{proposedStr}</td>
                                <td style={{ maxWidth: '250px', whiteSpace: 'normal', fontSize: '0.85rem' }}>{req.reason}</td>
                                <td>
                                  <span style={{
                                    display: 'inline-block',
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    backgroundColor: req.status === 'approved' ? '#dcfce7' : '#fee2e2',
                                    color: req.status === 'approved' ? '#15803d' : '#b91c1c'
                                  }}>
                                    {req.status}
                                  </span>
                                </td>
                                <td style={{ fontSize: '0.82rem', color: 'var(--admin-text-muted)' }}>
                                  {req.admin_notes || '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>

            </div>
          )}

        </div>
      </main>

      {/* Edit Branch Modal */}
      {editingBranch && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content">
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">Edit Branch Details</h3>
              <button className="admin-modal-close-btn" onClick={() => setEditingBranch(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveBranch}>
              <div className="admin-form-grid">
                <div className="admin-form-group">
                  <label className="admin-form-label">Branch Name</label>
                  <input
                    type="text"
                    required
                    className="admin-form-input"
                    value={branchForm.name}
                    onChange={e => setBranchForm({ ...branchForm, name: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Branch Code</label>
                  <input
                    type="text"
                    required
                    className="admin-form-input"
                    value={branchForm.code}
                    onChange={e => setBranchForm({ ...branchForm, code: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">City</label>
                  <input
                    type="text"
                    required
                    className="admin-form-input"
                    value={branchForm.city}
                    onChange={e => setBranchForm({ ...branchForm, city: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">GST Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 24AACCS1234K1ZP"
                    className="admin-form-input"
                    value={branchForm.gst_number}
                    onChange={e => setBranchForm({ ...branchForm, gst_number: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Contact Phone</label>
                  <input
                    type="text"
                    required
                    className="admin-form-input"
                    value={branchForm.phone}
                    onChange={e => setBranchForm({ ...branchForm, phone: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Email Address</label>
                  <input
                    type="email"
                    className="admin-form-input"
                    value={branchForm.email}
                    onChange={e => setBranchForm({ ...branchForm, email: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Opening Hour</label>
                  <input
                    type="time"
                    required
                    className="admin-form-input"
                    value={branchForm.opening_hour}
                    onChange={e => setBranchForm({ ...branchForm, opening_hour: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Closing Hour</label>
                  <input
                    type="time"
                    required
                    className="admin-form-input"
                    value={branchForm.closing_hour}
                    onChange={e => setBranchForm({ ...branchForm, closing_hour: e.target.value })}
                  />
                </div>
                <div className="admin-form-group full-width">
                  <label className="admin-form-label">Address</label>
                  <textarea
                    rows={3}
                    className="admin-form-input"
                    style={{ fontFamily: 'inherit', resize: 'vertical' }}
                    value={branchForm.address}
                    onChange={e => setBranchForm({ ...branchForm, address: e.target.value })}
                  />
                </div>
                <div className="admin-form-group full-width">
                  <label className="admin-form-label" style={{ marginBottom: '8px', display: 'block' }}>Status</label>
                  <div className="status-pill-select" style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      className={`status-pill-opt ${branchForm.is_active ? 'selected' : ''}`}
                      onClick={() => setBranchForm({ ...branchForm, is_active: true })}
                      style={{
                        padding: '10px 20px',
                        borderRadius: '10px',
                        border: '1px solid',
                        borderColor: branchForm.is_active ? 'var(--admin-primary)' : 'var(--admin-border)',
                        background: branchForm.is_active ? 'var(--admin-primary-light)' : '#fff',
                        color: branchForm.is_active ? 'var(--admin-primary)' : 'var(--admin-text-muted)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.12s ease',
                        fontSize: '0.9rem'
                      }}
                    >
                      Active
                    </button>
                    <button
                      type="button"
                      className={`status-pill-opt ${!branchForm.is_active ? 'selected' : ''}`}
                      onClick={() => setBranchForm({ ...branchForm, is_active: false })}
                      style={{
                        padding: '10px 20px',
                        borderRadius: '10px',
                        border: '1px solid',
                        borderColor: !branchForm.is_active ? 'var(--admin-primary)' : 'var(--admin-border)',
                        background: !branchForm.is_active ? 'var(--admin-primary-light)' : '#fff',
                        color: !branchForm.is_active ? 'var(--admin-primary)' : 'var(--admin-text-muted)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.12s ease',
                        fontSize: '0.9rem'
                      }}
                    >
                      Inactive
                    </button>
                  </div>
                </div>
              </div>
              <div className="admin-modal-actions">
                <button type="button" className="admin-btn-switch" style={{ border: '1px solid var(--admin-border)' }} onClick={() => setEditingBranch(null)}>
                  Cancel
                </button>
                <button type="submit" className="admin-btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Branch Modal */}
      {isAddingBranch && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content">
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">Add New Branch</h3>
              <button className="admin-modal-close-btn" onClick={() => setIsAddingBranch(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateBranch}>
              <div className="admin-form-grid">
                <div className="admin-form-group">
                  <label className="admin-form-label">Branch Name</label>
                  <input
                    type="text"
                    required
                    className="admin-form-input"
                    value={newBranchForm.name}
                    onChange={e => setNewBranchForm({ ...newBranchForm, name: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Branch Code</label>
                  <input
                    type="text"
                    required
                    className="admin-form-input"
                    value={newBranchForm.code}
                    onChange={e => setNewBranchForm({ ...newBranchForm, code: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">City</label>
                  <input
                    type="text"
                    required
                    className="admin-form-input"
                    value={newBranchForm.city}
                    onChange={e => setNewBranchForm({ ...newBranchForm, city: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">GST Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 24AACCS1234K1ZP"
                    className="admin-form-input"
                    value={newBranchForm.gst_number}
                    onChange={e => setNewBranchForm({ ...newBranchForm, gst_number: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Contact Phone</label>
                  <input
                    type="text"
                    required
                    className="admin-form-input"
                    value={newBranchForm.phone}
                    onChange={e => setNewBranchForm({ ...newBranchForm, phone: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Email Address</label>
                  <input
                    type="email"
                    className="admin-form-input"
                    value={newBranchForm.email}
                    onChange={e => setNewBranchForm({ ...newBranchForm, email: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Opening Hour</label>
                  <input
                    type="time"
                    required
                    className="admin-form-input"
                    value={newBranchForm.opening_hour}
                    onChange={e => setNewBranchForm({ ...newBranchForm, opening_hour: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Closing Hour</label>
                  <input
                    type="time"
                    required
                    className="admin-form-input"
                    value={newBranchForm.closing_hour}
                    onChange={e => setNewBranchForm({ ...newBranchForm, closing_hour: e.target.value })}
                  />
                </div>
                <div className="admin-form-group full-width">
                  <label className="admin-form-label">Address</label>
                  <textarea
                    rows={3}
                    className="admin-form-input"
                    style={{ fontFamily: 'inherit', resize: 'vertical' }}
                    value={newBranchForm.address}
                    onChange={e => setNewBranchForm({ ...newBranchForm, address: e.target.value })}
                  />
                </div>
              </div>
              <div className="admin-modal-actions">
                <button type="button" className="admin-btn-cancel" onClick={() => setIsAddingBranch(false)}>
                  Cancel
                </button>
                <button type="submit" className="admin-btn-primary">
                  Create Branch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      {isAddingStaff && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content">
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">Add New Staff Member</h3>
              <button className="admin-modal-close-btn" onClick={() => { setIsAddingStaff(false); setShowPassword(false); }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateStaff}>
              <div className="admin-form-grid">
                <div className="admin-form-group">
                  <label className="admin-form-label">Full Name</label>
                  <input
                    type="text"
                    required
                    className="admin-form-input"
                    value={newStaffForm.full_name}
                    onChange={e => setNewStaffForm({ ...newStaffForm, full_name: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Email Address</label>
                  <input
                    type="email"
                    required
                    className="admin-form-input"
                    value={newStaffForm.email}
                    onChange={e => setNewStaffForm({ ...newStaffForm, email: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Contact Phone</label>
                  <input
                    type="text"
                    required
                    className="admin-form-input"
                    value={newStaffForm.phone}
                    onChange={e => setNewStaffForm({ ...newStaffForm, phone: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Password</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      className="admin-form-input"
                      style={{ width: '100%', paddingRight: '40px' }}
                      value={newStaffForm.password}
                      onChange={e => setNewStaffForm({ ...newStaffForm, password: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        color: 'var(--admin-text-muted)',
                        padding: '4px'
                      }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Role</label>
                  <select
                    className="admin-form-input"
                    value={newStaffForm.role}
                    onChange={e => setNewStaffForm({ ...newStaffForm, role: e.target.value })}
                  >
                    <option value="doctor">Doctor</option>
                    <option value="receptionist">Receptionist</option>
                    <option value="pharmacist">Pharmacist</option>
                    <option value="clinic_manager">Clinic Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Assign to Branch</label>
                  <select
                    className="admin-form-input"
                    value={newStaffForm.branch_id}
                    onChange={e => setNewStaffForm({ ...newStaffForm, branch_id: e.target.value })}
                  >
                    <option value="">No Branch / Global Admin</option>
                    {branches.map((br: any) => (
                      <option key={br.id} value={br.id}>
                        {br.name} ({br.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="admin-modal-actions">
                <button type="button" className="admin-btn-cancel" onClick={() => { setIsAddingStaff(false); setShowPassword(false); }}>
                  Cancel
                </button>
                <button type="submit" className="admin-btn-primary">
                  Create Staff
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {editingStaff && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content">
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">Edit Staff Details</h3>
              <button className="admin-modal-close-btn" onClick={() => { setEditingStaff(null); setShowEditPassword(false); }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveStaff}>
              <div className="admin-form-grid">
                <div className="admin-form-group">
                  <label className="admin-form-label">Full Name</label>
                  <input
                    type="text"
                    required
                    className="admin-form-input"
                    value={staffForm.full_name}
                    onChange={e => setStaffForm({ ...staffForm, full_name: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Email Address</label>
                  <input
                    type="email"
                    required
                    className="admin-form-input"
                    value={staffForm.email}
                    onChange={e => setStaffForm({ ...staffForm, email: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Contact Phone</label>
                  <input
                    type="text"
                    className="admin-form-input"
                    value={staffForm.phone}
                    onChange={e => setStaffForm({ ...staffForm, phone: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Password (leave blank to keep current)</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type={showEditPassword ? "text" : "password"}
                      placeholder="New password"
                      className="admin-form-input"
                      style={{ width: '100%', paddingRight: '40px' }}
                      value={staffForm.password}
                      onChange={e => setStaffForm({ ...staffForm, password: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowEditPassword(!showEditPassword)}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        color: 'var(--admin-text-muted)',
                        padding: '4px'
                      }}
                    >
                      {showEditPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Role</label>
                  <select
                    className="admin-form-input"
                    value={staffForm.role}
                    onChange={e => setStaffForm({ ...staffForm, role: e.target.value })}
                  >
                    <option value="doctor">Doctor</option>
                    <option value="receptionist">Receptionist</option>
                    <option value="pharmacist">Pharmacist</option>
                    <option value="clinic_manager">Clinic Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Assign to Branch</label>
                  <select
                    className="admin-form-input"
                    value={staffForm.branch_id}
                    onChange={e => setStaffForm({ ...staffForm, branch_id: e.target.value })}
                  >
                    <option value="">No Branch / Global Admin</option>
                    {branches.map((br: any) => (
                      <option key={br.id} value={br.id}>
                        {br.name} ({br.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="admin-form-group full-width">
                  <label className="admin-form-label">Status</label>
                  <select
                    className="admin-form-input"
                    value={staffForm.is_active ? "true" : "false"}
                    onChange={e => setStaffForm({ ...staffForm, is_active: e.target.value === "true" })}
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="admin-modal-actions">
                {editingStaff.id !== currentUser?.id && (
                  <button 
                    type="button" 
                    className="admin-btn-danger" 
                    onClick={() => handleDeleteStaff(editingStaff.id)}
                    style={{ marginRight: 'auto' }}
                  >
                    Delete Staff
                  </button>
                )}
                <button type="button" className="admin-btn-cancel" onClick={() => { setEditingStaff(null); setShowEditPassword(false); }}>
                  Cancel
                </button>
                <button type="submit" className="admin-btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      {resolvingRequest && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content" style={{ maxWidth: '400px' }}>
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">Reject Request</h3>
              <button className="admin-modal-close-btn" onClick={() => setResolvingRequest(null)}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', padding: '15px 0' }}>
              <p style={{ fontSize: '0.88rem', color: 'var(--admin-text-muted)' }}>
                Please specify the reason for rejecting the availability request from <strong>{resolvingRequest.doctor_name}</strong>.
              </p>
              <div className="admin-form-group full-width">
                <label className="admin-form-label">Reason for Rejection</label>
                <textarea
                  rows={3}
                  required
                  className="admin-form-input"
                  style={{ fontFamily: 'inherit', resize: 'vertical' }}
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  placeholder="Explain why this request is being rejected..."
                />
              </div>
            </div>
            <div className="admin-modal-actions">
              <button type="button" className="admin-btn-cancel" onClick={() => setResolvingRequest(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="admin-btn-primary"
                style={{ background: '#ef4444' }}
                onClick={() => handleResolveRequest(resolvingRequest.id, 'rejected')}
                disabled={!rejectionReason.trim()}
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conflict Warning Modal */}
      {conflictWarning && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content" style={{ maxWidth: '500px' }}>
            <div className="admin-modal-header">
              <h3 className="admin-modal-title" style={{ color: '#eab308', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={20} /> Schedule Conflicts Detected
              </h3>
              <button className="admin-modal-close-btn" onClick={() => setConflictWarning(null)}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', padding: '15px 0' }}>
              <p style={{ fontSize: '0.9rem', lineHeight: '1.4' }}>
                The schedule change has been approved. However, the following existing appointments conflict with the new timings.
                They have been automatically marked as <strong>Pending Action</strong> and the patients have been notified:
              </p>
              <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--admin-border)', borderRadius: '6px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px', background: '#fef08a1a' }}>
                {conflictWarning.map((c: any) => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '6px 8px', background: '#fff', borderRadius: '4px', border: '1px solid var(--admin-border)' }}>
                    <span style={{ fontWeight: 600 }}>{c.patient_name}</span>
                    <span style={{ fontFamily: 'monospace' }}>
                      {new Date(c.appointment_datetime).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="admin-modal-actions">
              <button type="button" className="admin-btn-primary" onClick={() => setConflictWarning(null)}>
                Dismiss & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
