import React, { useState, useEffect } from 'react';
import {
  Home,
  Users,
  UserPlus,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Search,
  Bell,
  LogOut,
  ShieldAlert,
  Building,
  Activity,
  FileText,
  Plus,
  RefreshCw,
  X,
  ChevronRight
} from 'lucide-react';
import { api } from '../../services/api';
import './ClinicManagerPortal.css';

interface ClinicManagerPortalProps {
  onLogout: () => void;
}

export const ClinicManagerPortal: React.FC<ClinicManagerPortalProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'staff' | 'onboard' | 'requests'>('overview');
  
  // Dashboard Overview state
  const [overviewData, setOverviewData] = useState<any>(null);
  const [isLoadingOverview, setIsLoadingOverview] = useState<boolean>(true);

  // Staff listing state
  const [staffData, setStaffData] = useState<{ doctors: any[]; receptionists: any[] }>({ doctors: [], receptionists: [] });
  const [isLoadingStaff, setIsLoadingStaff] = useState<boolean>(false);
  const [staffSearchQuery, setStaffSearchQuery] = useState<string>('');

  // Schedule requests state
  const [requestsList, setRequestsList] = useState<any[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState<boolean>(false);
  const [reviewNotes, setReviewNotes] = useState<{ [key: string]: string }>({});

  // Onboarding forms state
  const [onboardRole, setOnboardRole] = useState<'doctor' | 'receptionist'>('doctor');
  const [doctorForm, setDoctorForm] = useState({
    full_name: '',
    email: '',
    password: '',
    phone: '',
    specialization: 'General Dentistry',
    qualification: 'BDS',
    experience_years: 5,
    consultation_fee: 500,
    registration_number: '',
    tele_start: '15:00',
    tele_end: '17:00',
    lunch_start: '13:00',
    lunch_end: '14:00',
  });
  const [receptionistForm, setReceptionistForm] = useState({
    full_name: '',
    email: '',
    password: '',
    phone: '',
    employee_code: '',
    shift_timing: 'Morning Shift (09:00 - 17:00)',
  });

  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch Dashboard Overview
  const fetchOverview = async () => {
    setIsLoadingOverview(true);
    try {
      const res = await api.get('/clinic-manager/dashboard-overview');
      setOverviewData(res.data);
    } catch (err: any) {
      showToast('error', 'Failed to load operational overview metrics.');
    } finally {
      setIsLoadingOverview(false);
    }
  };

  // Fetch Branch Staff
  const fetchStaff = async () => {
    setIsLoadingStaff(true);
    try {
      const res = await api.get('/clinic-manager/staff');
      setStaffData(res.data);
    } catch (err: any) {
      showToast('error', 'Failed to load branch staff directory.');
    } finally {
      setIsLoadingStaff(false);
    }
  };

  // Fetch Schedule Requests
  const fetchRequests = async () => {
    setIsLoadingRequests(true);
    try {
      const res = await api.get('/clinic-manager/schedule-requests');
      setRequestsList(res.data || []);
    } catch (err: any) {
      showToast('error', 'Failed to load schedule change requests.');
    } finally {
      setIsLoadingRequests(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  useEffect(() => {
    if (activeTab === 'overview') fetchOverview();
    if (activeTab === 'staff') fetchStaff();
    if (activeTab === 'requests') fetchRequests();
  }, [activeTab]);

  // Handle Onboard Doctor
  const handleOnboardDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await api.post('/clinic-manager/doctors', doctorForm);
      showToast('success', res.data?.message || 'Doctor onboarded successfully!');
      setDoctorForm({
        full_name: '',
        email: '',
        password: '',
        phone: '',
        specialization: 'General Dentistry',
        qualification: 'BDS',
        experience_years: 5,
        consultation_fee: 500,
        registration_number: '',
        tele_start: '15:00',
        tele_end: '17:00',
        lunch_start: '13:00',
        lunch_end: '14:00',
      });
      setActiveTab('staff');
    } catch (err: any) {
      showToast('error', err.response?.data?.detail || 'Failed to onboard doctor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Onboard Receptionist
  const handleOnboardReceptionist = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await api.post('/clinic-manager/receptionists', receptionistForm);
      showToast('success', res.data?.message || 'Receptionist onboarded successfully!');
      setReceptionistForm({
        full_name: '',
        email: '',
        password: '',
        phone: '',
        employee_code: '',
        shift_timing: 'Morning Shift (09:00 - 17:00)',
      });
      setActiveTab('staff');
    } catch (err: any) {
      showToast('error', err.response?.data?.detail || 'Failed to onboard receptionist.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Review Schedule Request
  const handleReviewRequest = async (requestId: string, action: 'approve' | 'reject') => {
    const notes = reviewNotes[requestId] || '';
    try {
      const res = await api.post(`/clinic-manager/schedule-requests/${requestId}/review`, {
        action,
        response_notes: notes,
      });
      showToast('success', res.data?.message || `Request ${action}d successfully.`);
      fetchRequests();
    } catch (err: any) {
      showToast('error', err.response?.data?.detail || `Failed to ${action} request.`);
    }
  };

  const filteredDoctors = staffData.doctors.filter(
    (d) =>
      d.full_name.toLowerCase().includes(staffSearchQuery.toLowerCase()) ||
      d.email.toLowerCase().includes(staffSearchQuery.toLowerCase()) ||
      d.specialization.toLowerCase().includes(staffSearchQuery.toLowerCase())
  );

  const filteredReceptionists = staffData.receptionists.filter(
    (r) =>
      r.full_name.toLowerCase().includes(staffSearchQuery.toLowerCase()) ||
      r.email.toLowerCase().includes(staffSearchQuery.toLowerCase()) ||
      r.employee_code.toLowerCase().includes(staffSearchQuery.toLowerCase())
  );

  return (
    <div className="manager-app-container">
      {/* Toast Notification */}
      {toast && (
        <div className={`manager-toast ${toast.type}`}>
          {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertIcon size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* LEFT SIDEBAR NAVIGATION */}
      <aside className="manager-sidebar">
        <div className="manager-brand-header">
          <div className="manager-brand-mark">V</div>
          <div className="manager-brand-text">
            <h2>Vertical Clinic</h2>
            <p>CLINIC MANAGER</p>
          </div>
        </div>

        <div style={{ padding: '12px' }}>
          <div className="manager-portal-badge">
            <Building size={16} /> Manager Portal
          </div>
        </div>

        <nav className="manager-sidebar-nav">
          <span className="sidebar-section-heading">MAIN</span>
          <button
            className={`sidebar-nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <Home size={18} /> Dashboard
          </button>

          <span className="sidebar-section-heading">MANAGE</span>
          <button
            className={`sidebar-nav-item ${activeTab === 'staff' ? 'active' : ''}`}
            onClick={() => setActiveTab('staff')}
          >
            <Users size={18} /> Staff Directory
          </button>
          <button
            className={`sidebar-nav-item ${activeTab === 'onboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('onboard')}
          >
            <UserPlus size={18} /> Onboard Staff
          </button>
          <button
            className={`sidebar-nav-item ${activeTab === 'requests' ? 'active' : ''}`}
            onClick={() => setActiveTab('requests')}
          >
            <Calendar size={18} /> Schedule Approvals
          </button>
        </nav>

        <div className="manager-sidebar-footer">
          <button className="sidebar-logout-btn" onClick={onLogout}>
            <LogOut size={18} /> Sign Out
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT WRAPPER */}
      <div className="manager-main-wrapper">
        {/* TOP BAR */}
        <header className="manager-topbar">
          <div className="topbar-title-section">
            <h1 className="topbar-title">
              {activeTab === 'overview' && 'Dashboard'}
              {activeTab === 'staff' && 'Branch Staff Directory'}
              {activeTab === 'onboard' && 'Onboard New Staff'}
              {activeTab === 'requests' && 'Schedule Approvals'}
            </h1>
            <p className="topbar-subtitle">Operational Branch Administration & Staff Onboarding</p>
          </div>

          <div className="topbar-right-utilities">
            <div className="topbar-search-box">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Search staff, operations..."
                value={staffSearchQuery}
                onChange={(e) => setStaffSearchQuery(e.target.value)}
              />
            </div>

            <button className="topbar-icon-btn" title="Notifications">
              <Bell size={18} />
              <span className="notification-dot" />
            </button>

            <div className="topbar-user-profile">
              <div className="user-avatar-circle">CM</div>
              <div className="user-details-text">
                <span className="user-name">Clinic Manager</span>
                <span className="user-role-label">Manager</span>
              </div>
            </div>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main className="manager-main-content">
          {/* TAB 1: DASHBOARD OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="tab-fade-in">
              {/* HERO WELCOME CARD */}
              <div className="manager-hero-card">
                <div className="hero-text-content">
                  <span className="hero-greeting">Welcome back,</span>
                  <h2 className="hero-name">Clinic Manager</h2>
                  <p className="hero-subtext">Operational Branch Administration & Real-Time Clinic Flow</p>
                </div>
                <div className="hero-action-buttons">
                  <button className="hero-btn-primary" onClick={() => { setOnboardRole('doctor'); setActiveTab('onboard'); }}>
                    <Plus size={16} /> Onboard Doctor
                  </button>
                  <button className="hero-btn-secondary" onClick={() => { setOnboardRole('receptionist'); setActiveTab('onboard'); }}>
                    <UserPlus size={16} /> Onboard Receptionist
                  </button>
                </div>
              </div>

              {/* NOTICE BANNER */}
              <div className="notice-banner-ops">
                <ShieldAlert size={18} className="notice-icon" />
                <span>
                  <strong>Operational Restricted Mode:</strong> Financial revenue and billing reports are restricted to Admin level. The metrics below represent operational patient flow & staff roster status.
                </span>
              </div>

              {/* STAT CARDS GRID */}
              {isLoadingOverview ? (
                <div className="manager-loading-box">Loading operational metrics...</div>
              ) : (
                <div className="manager-stats-grid">
                  <div className="stat-card">
                    <div className="stat-card-left">
                      <span className="stat-card-value">{overviewData?.today_appointments_count || 0}</span>
                      <span className="stat-card-label">Appointments Today</span>
                    </div>
                    <div className="stat-card-icon-box blue">
                      <Calendar size={22} />
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-card-left">
                      <span className="stat-card-value">{overviewData?.waiting_queue_count || 0}</span>
                      <span className="stat-card-label">Patients in Waiting Queue</span>
                    </div>
                    <div className="stat-card-icon-box cyan">
                      <Clock size={22} />
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-card-left">
                      <span className="stat-card-value">{overviewData?.active_doctors_count || 0}</span>
                      <span className="stat-card-label">Active Doctors on Duty</span>
                    </div>
                    <div className="stat-card-icon-box green">
                      <Users size={22} />
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-card-left">
                      <span className="stat-card-value">{overviewData?.pending_schedule_requests_count || 0}</span>
                      <span className="stat-card-label">Pending Schedule Requests</span>
                    </div>
                    <div className="stat-card-icon-box yellow">
                      <FileText size={22} />
                    </div>
                  </div>
                </div>
              )}

              {/* QUICK LINKS SECTION */}
              <div className="quick-actions-row">
                <div className="quick-action-card" onClick={() => setActiveTab('staff')}>
                  <div className="quick-card-header">
                    <Users size={20} className="quick-card-icon" />
                    <ChevronRight size={18} className="chevron" />
                  </div>
                  <h3>Staff Directory</h3>
                  <p>View and manage all active doctors and receptionists assigned to this branch.</p>
                </div>

                <div className="quick-action-card" onClick={() => setActiveTab('onboard')}>
                  <div className="quick-card-header">
                    <UserPlus size={20} className="quick-card-icon" />
                    <ChevronRight size={18} className="chevron" />
                  </div>
                  <h3>Onboard New Personnel</h3>
                  <p>Register new doctors with specializations & fees, or receptionists with shift hours.</p>
                </div>

                <div className="quick-action-card" onClick={() => setActiveTab('requests')}>
                  <div className="quick-card-header">
                    <Calendar size={20} className="quick-card-icon" />
                    <ChevronRight size={18} className="chevron" />
                  </div>
                  <h3>Schedule Change Approvals</h3>
                  <p>Review doctor leave applications and shift/teleconsultation window modification requests.</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: STAFF DIRECTORY */}
          {activeTab === 'staff' && (
            <div className="tab-fade-in">
              <div className="content-card">
                <div className="content-card-header">
                  <div>
                    <h2>Branch Personnel Directory</h2>
                    <p className="card-subtitle">Active doctors and receptionists for this branch</p>
                  </div>
                  <button className="btn-primary" onClick={() => setActiveTab('onboard')}>
                    <Plus size={16} /> Onboard New Staff
                  </button>
                </div>

                {isLoadingStaff ? (
                  <div className="manager-loading-box">Loading staff directory...</div>
                ) : (
                  <div className="tables-container">
                    <h3 className="table-section-title">👨‍⚕️ Doctors ({filteredDoctors.length})</h3>
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Doctor Name</th>
                          <th>Email Address</th>
                          <th>Specialization</th>
                          <th>Consultation Fee</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDoctors.length === 0 ? (
                          <tr><td colSpan={5} className="empty-td">No doctors found matching search.</td></tr>
                        ) : (
                          filteredDoctors.map((d) => (
                            <tr key={d.doctor_id}>
                              <td>
                                <div className="user-table-cell">
                                  <div className="table-avatar">Dr</div>
                                  <strong>{d.full_name}</strong>
                                </div>
                              </td>
                              <td>{d.email}</td>
                              <td><span className="tag-spec">{d.specialization}</span></td>
                              <td>₹{d.consultation_fee}</td>
                              <td>
                                <span className={`badge-status ${d.is_available ? 'active' : 'inactive'}`}>
                                  {d.is_available ? 'On Duty' : 'Off Duty'}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>

                    <h3 className="table-section-title" style={{ marginTop: '32px' }}>👩‍💼 Receptionists ({filteredReceptionists.length})</h3>
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Staff Name</th>
                          <th>Email Address</th>
                          <th>Employee Code</th>
                          <th>Shift Timing</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredReceptionists.length === 0 ? (
                          <tr><td colSpan={5} className="empty-td">No receptionists found matching search.</td></tr>
                        ) : (
                          filteredReceptionists.map((r) => (
                            <tr key={r.receptionist_id}>
                              <td>
                                <div className="user-table-cell">
                                  <div className="table-avatar recep">REC</div>
                                  <strong>{r.full_name}</strong>
                                </div>
                              </td>
                              <td>{r.email}</td>
                              <td><code>{r.employee_code}</code></td>
                              <td>{r.shift_timing}</td>
                              <td>
                                <span className={`badge-status ${r.is_on_duty ? 'active' : 'inactive'}`}>
                                  {r.is_on_duty ? 'On Duty' : 'Off Shift'}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: ONBOARD NEW STAFF */}
          {activeTab === 'onboard' && (
            <div className="tab-fade-in">
              <div className="onboard-role-tabs">
                <button
                  type="button"
                  className={`role-tab-btn ${onboardRole === 'doctor' ? 'active' : ''}`}
                  onClick={() => setOnboardRole('doctor')}
                >
                  <Users size={18} /> Onboard New Doctor
                </button>
                <button
                  type="button"
                  className={`role-tab-btn ${onboardRole === 'receptionist' ? 'active' : ''}`}
                  onClick={() => setOnboardRole('receptionist')}
                >
                  <UserPlus size={18} /> Onboard New Receptionist
                </button>
              </div>

              {onboardRole === 'doctor' ? (
                <form className="form-card-container fade-in" onSubmit={handleOnboardDoctor}>
                  <div className="form-card-header">
                    <h2>Onboard New Doctor</h2>
                    <p>Create credentials, professional specialization, consultation fees, and schedule windows.</p>
                  </div>

                  <div className="form-row-2">
                    <div className="custom-form-group">
                      <label>Full Name *</label>
                      <input
                        type="text"
                        className="custom-input"
                        required
                        placeholder="Dr. Rajesh Sharma"
                        value={doctorForm.full_name}
                        onChange={(e) => setDoctorForm({ ...doctorForm, full_name: e.target.value })}
                      />
                    </div>

                    <div className="custom-form-group">
                      <label>Email Address *</label>
                      <input
                        type="email"
                        className="custom-input"
                        required
                        placeholder="doctor@verticalclinic.com"
                        value={doctorForm.email}
                        onChange={(e) => setDoctorForm({ ...doctorForm, email: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-row-2">
                    <div className="custom-form-group">
                      <label>Password *</label>
                      <input
                        type="password"
                        className="custom-input"
                        required
                        placeholder="••••••••"
                        value={doctorForm.password}
                        onChange={(e) => setDoctorForm({ ...doctorForm, password: e.target.value })}
                      />
                    </div>

                    <div className="custom-form-group">
                      <label>Phone Number</label>
                      <input
                        type="tel"
                        className="custom-input"
                        placeholder="+91 98765 43210"
                        value={doctorForm.phone}
                        onChange={(e) => setDoctorForm({ ...doctorForm, phone: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-row-3">
                    <div className="custom-form-group">
                      <label>Specialization</label>
                      <select
                        className="custom-input"
                        value={doctorForm.specialization}
                        onChange={(e) => setDoctorForm({ ...doctorForm, specialization: e.target.value })}
                      >
                        <option value="General Dentistry">General Dentistry</option>
                        <option value="Orthodontics">Orthodontics (Braces)</option>
                        <option value="Endodontics">Endodontics (Root Canal)</option>
                        <option value="Pediatric Dentistry">Pediatric Dentistry</option>
                        <option value="Prosthodontics">Prosthodontics (Crowns & Implants)</option>
                        <option value="Periodontics">Periodontics (Gum Health)</option>
                      </select>
                    </div>

                    <div className="custom-form-group">
                      <label>Qualification</label>
                      <input
                        type="text"
                        className="custom-input"
                        placeholder="BDS, MDS"
                        value={doctorForm.qualification}
                        onChange={(e) => setDoctorForm({ ...doctorForm, qualification: e.target.value })}
                      />
                    </div>

                    <div className="custom-form-group">
                      <label>Consultation Fee (₹)</label>
                      <input
                        type="number"
                        className="custom-input"
                        value={doctorForm.consultation_fee}
                        onChange={(e) => setDoctorForm({ ...doctorForm, consultation_fee: Number(e.target.value) })}
                      />
                    </div>
                  </div>

                  <div className="form-row-2">
                    <div className="custom-form-group">
                      <label>Teleconsultation Video Hours (Default 3 PM - 5 PM)</label>
                      <div className="time-range-group">
                        <input
                          type="time"
                          className="custom-input"
                          value={doctorForm.tele_start}
                          onChange={(e) => setDoctorForm({ ...doctorForm, tele_start: e.target.value })}
                        />
                        <span>to</span>
                        <input
                          type="time"
                          className="custom-input"
                          value={doctorForm.tele_end}
                          onChange={(e) => setDoctorForm({ ...doctorForm, tele_end: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="custom-form-group">
                      <label>Lunch Break Hours (Default 1 PM - 2 PM)</label>
                      <div className="time-range-group">
                        <input
                          type="time"
                          className="custom-input"
                          value={doctorForm.lunch_start}
                          onChange={(e) => setDoctorForm({ ...doctorForm, lunch_start: e.target.value })}
                        />
                        <span>to</span>
                        <input
                          type="time"
                          className="custom-input"
                          value={doctorForm.lunch_end}
                          onChange={(e) => setDoctorForm({ ...doctorForm, lunch_end: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  <button type="submit" className="form-submit-btn" disabled={isSubmitting}>
                    {isSubmitting ? 'Onboarding Doctor...' : 'Complete Doctor Onboarding'}
                  </button>
                </form>
              ) : (
                <form className="form-card-container fade-in" onSubmit={handleOnboardReceptionist}>
                  <div className="form-card-header">
                    <h2>Onboard New Receptionist</h2>
                    <p>Create staff login credentials and assign branch shift schedule.</p>
                  </div>

                  <div className="form-row-2">
                    <div className="custom-form-group">
                      <label>Full Name *</label>
                      <input
                        type="text"
                        className="custom-input"
                        required
                        placeholder="Priya Patel"
                        value={receptionistForm.full_name}
                        onChange={(e) => setReceptionistForm({ ...receptionistForm, full_name: e.target.value })}
                      />
                    </div>

                    <div className="custom-form-group">
                      <label>Email Address *</label>
                      <input
                        type="email"
                        className="custom-input"
                        required
                        placeholder="reception@verticalclinic.com"
                        value={receptionistForm.email}
                        onChange={(e) => setReceptionistForm({ ...receptionistForm, email: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-row-2">
                    <div className="custom-form-group">
                      <label>Password *</label>
                      <input
                        type="password"
                        className="custom-input"
                        required
                        placeholder="••••••••"
                        value={receptionistForm.password}
                        onChange={(e) => setReceptionistForm({ ...receptionistForm, password: e.target.value })}
                      />
                    </div>

                    <div className="custom-form-group">
                      <label>Phone Number</label>
                      <input
                        type="tel"
                        className="custom-input"
                        placeholder="+91 98765 12345"
                        value={receptionistForm.phone}
                        onChange={(e) => setReceptionistForm({ ...receptionistForm, phone: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="custom-form-group">
                    <label>Shift Timing</label>
                    <select
                      className="custom-input"
                      value={receptionistForm.shift_timing}
                      onChange={(e) => setReceptionistForm({ ...receptionistForm, shift_timing: e.target.value })}
                    >
                      <option value="Morning Shift (09:00 - 17:00)">Morning Shift (09:00 - 17:00)</option>
                      <option value="Evening Shift (13:00 - 21:00)">Evening Shift (13:00 - 21:00)</option>
                      <option value="Full Day (09:00 - 21:00)">Full Day (09:00 - 21:00)</option>
                    </select>
                  </div>

                  <button type="submit" className="form-submit-btn" disabled={isSubmitting}>
                    {isSubmitting ? 'Onboarding Receptionist...' : 'Complete Receptionist Onboarding'}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* TAB 4: SCHEDULE CHANGE APPROVALS */}
          {activeTab === 'requests' && (
            <div className="tab-fade-in">
              <div className="content-card">
                <div className="content-card-header">
                  <div>
                    <h2>Doctor Schedule & Leave Approvals</h2>
                    <p className="card-subtitle">Review and resolve shift & leave change requests</p>
                  </div>
                  <button className="btn-secondary" onClick={fetchRequests}>
                    <RefreshCw size={16} /> Refresh Requests
                  </button>
                </div>

                {isLoadingRequests ? (
                  <div className="manager-loading-box">Loading schedule requests...</div>
                ) : requestsList.length === 0 ? (
                  <div className="empty-state-box">
                    <CheckCircle size={32} color="#10b981" />
                    <h3>No Pending Requests</h3>
                    <p>All doctor availability and leave requests have been resolved.</p>
                  </div>
                ) : (
                  <div className="requests-grid">
                    {requestsList.map((req) => (
                      <div className="request-card" key={req.id}>
                        <div className="req-header">
                          <div>
                            <h3 className="req-doctor-name">{req.doctor_name}</h3>
                            <span className={`req-badge ${req.request_type}`}>{req.request_type.toUpperCase()}</span>
                          </div>
                          <span className={`status-tag ${req.status}`}>{req.status.toUpperCase()}</span>
                        </div>

                        <div className="req-details">
                          <p><strong>Reason:</strong> {req.reason || 'No reason provided'}</p>
                          {req.proposed_start_date && (
                            <p><strong>Dates:</strong> {req.proposed_start_date} to {req.proposed_end_date}</p>
                          )}
                          {req.proposed_start_time && (
                            <p><strong>Proposed Hours:</strong> {req.proposed_start_time} - {req.proposed_end_time}</p>
                          )}
                        </div>

                        {req.status === 'pending' && (
                          <div className="req-action-block">
                            <input
                              type="text"
                              className="custom-input-sm"
                              placeholder="Manager note (optional)..."
                              value={reviewNotes[req.id] || ''}
                              onChange={(e) => setReviewNotes({ ...reviewNotes, [req.id]: e.target.value })}
                            />
                            <div className="req-btn-row">
                              <button
                                type="button"
                                className="btn-approve"
                                onClick={() => handleReviewRequest(req.id, 'approve')}
                              >
                                <CheckCircle size={14} /> Approve
                              </button>
                              <button
                                type="button"
                                className="btn-reject"
                                onClick={() => handleReviewRequest(req.id, 'reject')}
                              >
                                <XCircle size={14} /> Reject
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

const AlertIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <ShieldAlert size={size} />
);
