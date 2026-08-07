import React, { useState, useEffect, useRef } from 'react';
import {
  Home,
  Users,
  UserPlus,
  User,
  Settings,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Search,
  LogOut,
  FileText,
  Plus,
  RefreshCw,
  ChevronRight,
  AlertTriangle,
  DollarSign,
  Megaphone,
  Edit3,
  Check,
  Package,
  Camera,
  Upload
} from 'lucide-react';
import { api } from '../../services/api';
import './ClinicManagerPortal.css';

interface ClinicManagerPortalProps {
  onLogout: () => void;
}

export const ClinicManagerPortal: React.FC<ClinicManagerPortalProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'staff' | 'onboard' | 'emergency' | 'billing' | 'notices' | 'requests' | 'profile'
  >('overview');

  // Dashboard Overview state
  const [overviewData, setOverviewData] = useState<any>(null);
  const [isLoadingOverview, setIsLoadingOverview] = useState<boolean>(true);

  // Staff listing state
  const [staffData, setStaffData] = useState<{ doctors: any[]; receptionists: any[]; pharmacists?: any[] }>({
    doctors: [],
    receptionists: [],
    pharmacists: []
  });
  const [isLoadingStaff, setIsLoadingStaff] = useState<boolean>(false);
  const [staffSearchQuery, setStaffSearchQuery] = useState<string>('');

  // User Profile & Dropdown state
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [isEditingManagerProfile, setIsEditingManagerProfile] = useState<boolean>(false);
  const [managerBio, setManagerBio] = useState<string>('Operational manager responsible for clinic staff scheduling, patient queue flow, doctor emergency blocks, and discount approvals.');
  const [profileEditForm, setProfileEditForm] = useState({
    full_name: '',
    phone: '',
    email: '',
  });
  const [isUpdatingProfile, setIsUpdatingProfile] = useState<boolean>(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Topbar Live Search Dropdown state
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState<boolean>(false);
  const searchDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await api.get('/auth/me');
        if (res.data?.success) {
          setCurrentUser(res.data.data);
          setProfileEditForm({
            full_name: res.data.data.full_name || '',
            phone: res.data.data.phone || '',
            email: res.data.data.email || '',
          });
        }
      } catch (err) {
        console.error('Failed to fetch user profile:', err);
      }
    };
    fetchMe();
  }, []);

  const handleSaveProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsUpdatingProfile(true);
    setProfileMsg(null);
    try {
      const res = await api.patch('/auth/profile', {
        full_name: profileEditForm.full_name,
        phone: profileEditForm.phone,
      });
      if (res.data?.success || res.status === 200) {
        setProfileMsg({ type: 'success', text: 'Profile updated successfully!' });
        setCurrentUser((prev: any) => ({
          ...prev,
          full_name: profileEditForm.full_name,
          phone: profileEditForm.phone,
        }));
        setIsEditingManagerProfile(false);
        setTimeout(() => {
          setIsProfileModalOpen(false);
          setProfileMsg(null);
        }, 1500);
      } else {
        setProfileMsg({ type: 'error', text: res.data?.message || 'Failed to update profile.' });
      }
    } catch (err: any) {
      setProfileMsg({ type: 'error', text: err.response?.data?.message || 'Error updating profile.' });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(event.target as Node)) {
        setIsSearchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Schedule requests state
  const [requestsList, setRequestsList] = useState<any[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState<boolean>(false);
  const [reviewNotes, setReviewNotes] = useState<{ [key: string]: string }>({});

  // Onboarding forms state
  const [onboardRole, setOnboardRole] = useState<'doctor' | 'receptionist' | 'pharmacist'>('doctor');
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
  const [pharmacistForm, setPharmacistForm] = useState({
    full_name: '',
    email: '',
    password: '',
    phone: '',
    employee_code: '',
  });

  // Edit Staff Modal State
  const [editStaffModal, setEditStaffModal] = useState<{
    open: boolean;
    user_id: string;
    full_name: string;
    phone: string;
    is_active: boolean;
    consultation_fee: number;
    specialization: string;
    shift_timing: string;
    role: string;
  } | null>(null);

  // Doctor Emergency Block & Bulk Reschedule State
  const [emergencyForm, setEmergencyForm] = useState({
    doctor_id: '',
    leave_date: new Date().toISOString().split('T')[0],
    target_reschedule_date: '',
  });
  const [emergencyResult, setEmergencyResult] = useState<any | null>(null);
  const [isBlockingEmergency, setIsBlockingEmergency] = useState<boolean>(false);

  // Billing Approvals State
  const [billingRequests, setBillingRequests] = useState<any[]>([]);
  const [isLoadingBilling, setIsLoadingBilling] = useState<boolean>(false);

  // Staff Announcements State
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    message: '',
    target_role: 'all',
  });
  const [announcementHistory, setAnnouncementHistory] = useState<any[]>([]);

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

  // Fetch Billing Requests
  const fetchBillingRequests = async () => {
    setIsLoadingBilling(true);
    try {
      const res = await api.get('/clinic-manager/billing-requests');
      setBillingRequests(res.data || []);
    } catch (err: any) {
      showToast('error', 'Failed to load billing approval requests.');
    } finally {
      setIsLoadingBilling(false);
    }
  };

  useEffect(() => {
    fetchOverview();
    fetchStaff();
  }, []);

  useEffect(() => {
    if (activeTab === 'overview') fetchOverview();
    if (activeTab === 'staff') fetchStaff();
    if (activeTab === 'requests') fetchRequests();
    if (activeTab === 'billing') fetchBillingRequests();
    if (activeTab === 'emergency') fetchStaff();
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
      fetchStaff();
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to onboard doctor.');
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
      fetchStaff();
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to onboard receptionist.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Onboard Pharmacist
  const handleOnboardPharmacist = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await api.post('/clinic-manager/pharmacists', pharmacistForm);
      showToast('success', res.data?.message || 'Pharmacist onboarded successfully!');
      setPharmacistForm({
        full_name: '',
        email: '',
        password: '',
        phone: '',
        employee_code: '',
      });
      setActiveTab('staff');
      fetchStaff();
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to onboard pharmacist.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Edit Staff Submission
  const handleSaveEditStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStaffModal) return;
    setIsSubmitting(true);
    try {
      const res = await api.patch(`/clinic-manager/staff/${editStaffModal.user_id}`, {
        full_name: editStaffModal.full_name,
        phone: editStaffModal.phone,
        is_active: editStaffModal.is_active,
        consultation_fee: editStaffModal.consultation_fee,
        specialization: editStaffModal.specialization,
        shift_timing: editStaffModal.shift_timing,
      });
      showToast('success', res.data?.message || 'Staff updated successfully!');
      setEditStaffModal(null);
      fetchStaff();
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to update staff member.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Emergency Doctor Block & Bulk Reschedule
  const handleEmergencyBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emergencyForm.doctor_id) {
      showToast('error', 'Please select a doctor to freeze schedule.');
      return;
    }
    setIsBlockingEmergency(true);
    setEmergencyResult(null);
    try {
      const res = await api.post(
        `/clinic-manager/doctors/${emergencyForm.doctor_id}/emergency-block`,
        {
          leave_date: emergencyForm.leave_date,
          target_reschedule_date: emergencyForm.target_reschedule_date || undefined,
        }
      );
      setEmergencyResult(res.data);
      showToast('success', res.data?.message || 'Schedule frozen & bulk reschedule complete!');
      fetchOverview();
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to execute emergency doctor block.');
    } finally {
      setIsBlockingEmergency(false);
    }
  };

  // Handle Billing Review (Approve/Reject)
  const handleReviewBilling = async (invoiceId: string, action: 'approve' | 'reject') => {
    try {
      const res = await api.post(`/clinic-manager/billing-requests/${invoiceId}/review`, {
        action,
        reason_notes: action === 'approve' ? 'Approved by Manager' : 'Rejected by Manager',
      });
      showToast('success', res.data?.message || `Billing override ${action}d!`);
      fetchBillingRequests();
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to review billing request.');
    }
  };

  // Handle Staff Announcement Submission
  const handleSendAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await api.post('/clinic-manager/announcements', announcementForm);
      showToast('success', res.data?.message_text || 'Announcement broadcasted successfully!');
      setAnnouncementHistory([
        { ...announcementForm, created_at: new Date().toLocaleTimeString() },
        ...announcementHistory,
      ]);
      setAnnouncementForm({ title: '', message: '', target_role: 'all' });
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to broadcast announcement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Schedule Request Review
  const handleReviewRequest = async (requestId: string, action: 'approve' | 'reject') => {
    try {
      const res = await api.post(`/clinic-manager/schedule-requests/${requestId}/review`, {
        action,
        response_notes: reviewNotes[requestId] || '',
      });
      showToast('success', res.data?.message || `Request ${action}d successfully!`);
      fetchRequests();
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to review schedule request.');
    }
  };

  // Filtered staff, billing, requests and notices datasets based on topbar search query
  const query = staffSearchQuery.trim().toLowerCase();

  const filteredDoctors = (staffData.doctors || []).filter((d: any) => {
    if (!query) return true;
    return (
      (d.full_name || '').toLowerCase().includes(query) ||
      (d.specialization || '').toLowerCase().includes(query) ||
      (d.email || '').toLowerCase().includes(query) ||
      (d.phone || '').toLowerCase().includes(query)
    );
  });

  const filteredReceptionists = (staffData.receptionists || []).filter((r: any) => {
    if (!query) return true;
    return (
      (r.full_name || '').toLowerCase().includes(query) ||
      (r.employee_code || '').toLowerCase().includes(query) ||
      (r.email || '').toLowerCase().includes(query) ||
      (r.phone || '').toLowerCase().includes(query)
    );
  });

  const filteredPharmacists = (staffData.pharmacists || []).filter((ph: any) => {
    if (!query) return true;
    return (
      (ph.full_name || '').toLowerCase().includes(query) ||
      (ph.email || '').toLowerCase().includes(query) ||
      (ph.phone || '').toLowerCase().includes(query)
    );
  });

  const filteredBillingRequests = billingRequests.filter((b: any) => {
    if (!query) return true;
    return (
      (b.patient_name || '').toLowerCase().includes(query) ||
      (b.doctor_name || '').toLowerCase().includes(query) ||
      (b.invoice_number || '').toLowerCase().includes(query) ||
      (b.id || '').toLowerCase().includes(query)
    );
  });

  const filteredRequestsList = requestsList.filter((req: any) => {
    if (!query) return true;
    return (
      (req.doctor_name || '').toLowerCase().includes(query) ||
      (req.reason || '').toLowerCase().includes(query) ||
      (req.request_type || '').toLowerCase().includes(query)
    );
  });

  const filteredAnnouncementHistory = announcementHistory.filter((a: any) => {
    if (!query) return true;
    return (
      (a.title || '').toLowerCase().includes(query) ||
      (a.message || '').toLowerCase().includes(query) ||
      (a.target_role || '').toLowerCase().includes(query)
    );
  });

  return (
    <div className="manager-portal-container">
      {/* TOAST NOTIFICATION */}
      {toast && (
        <div className={`manager-toast ${toast.type}`}>
          {toast.type === 'success' ? <CheckCircle size={18} /> : <XCircle size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* EDIT STAFF MODAL */}
      {editStaffModal && (
        <div className="manager-modal-overlay">
          <div className="manager-modal-card">
            <div className="modal-header">
              <h2>Edit Staff Member: {editStaffModal.full_name}</h2>
              <button className="close-btn" onClick={() => setEditStaffModal(null)}>×</button>
            </div>
            <form onSubmit={handleSaveEditStaff}>
              <div className="custom-form-group" style={{ marginBottom: '12px' }}>
                <label>Full Name</label>
                <input
                  type="text"
                  className="custom-input"
                  value={editStaffModal.full_name}
                  onChange={(e) => setEditStaffModal({ ...editStaffModal, full_name: e.target.value })}
                />
              </div>

              <div className="custom-form-group" style={{ marginBottom: '12px' }}>
                <label>Phone Number</label>
                <input
                  type="text"
                  className="custom-input"
                  value={editStaffModal.phone}
                  onChange={(e) => setEditStaffModal({ ...editStaffModal, phone: e.target.value })}
                />
              </div>

              {editStaffModal.role === 'doctor' && (
                <>
                  <div className="custom-form-group" style={{ marginBottom: '12px' }}>
                    <label>Specialization</label>
                    <input
                      type="text"
                      className="custom-input"
                      value={editStaffModal.specialization}
                      onChange={(e) => setEditStaffModal({ ...editStaffModal, specialization: e.target.value })}
                    />
                  </div>
                  <div className="custom-form-group" style={{ marginBottom: '12px' }}>
                    <label>Consultation Fee (₹)</label>
                    <input
                      type="number"
                      className="custom-input"
                      value={editStaffModal.consultation_fee}
                      onChange={(e) => setEditStaffModal({ ...editStaffModal, consultation_fee: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </>
              )}

              {editStaffModal.role === 'receptionist' && (
                <div className="custom-form-group" style={{ marginBottom: '12px' }}>
                  <label>Shift Timing</label>
                  <input
                    type="text"
                    className="custom-input"
                    value={editStaffModal.shift_timing}
                    onChange={(e) => setEditStaffModal({ ...editStaffModal, shift_timing: e.target.value })}
                  />
                </div>
              )}

              <div className="custom-form-group" style={{ marginBottom: '20px' }}>
                <label>Status</label>
                <select
                  className="custom-input"
                  value={editStaffModal.is_active ? 'active' : 'inactive'}
                  onChange={(e) => setEditStaffModal({ ...editStaffModal, is_active: e.target.value === 'active' })}
                >
                  <option value="active">Active / On Duty</option>
                  <option value="inactive">Inactive / Off Duty</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-secondary" onClick={() => setEditStaffModal(null)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <aside className="manager-sidebar">
        <div className="manager-brand-header">
          <div className="manager-brand-mark">V</div>
          <div className="manager-brand-text">
            <h2>Vertical Clinic</h2>
            <p>CLINIC OS</p>
          </div>
        </div>

        <div className="manager-portal-badge">
          <span className="badge-dot"></span> Manager Portal
        </div>

        <nav className="manager-sidebar-nav">
          <button
            className={`sidebar-nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <Home size={18} /> Operational Overview
          </button>

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
            <UserPlus size={18} /> Onboard Personnel
          </button>

          <button
            className={`sidebar-nav-item ${activeTab === 'emergency' ? 'active' : ''}`}
            onClick={() => setActiveTab('emergency')}
          >
            <AlertTriangle size={18} /> Doctor Emergency Block
          </button>

          <button
            className={`sidebar-nav-item ${activeTab === 'billing' ? 'active' : ''}`}
            onClick={() => setActiveTab('billing')}
          >
            <DollarSign size={18} /> Billing Approvals
          </button>

          <button
            className={`sidebar-nav-item ${activeTab === 'notices' ? 'active' : ''}`}
            onClick={() => setActiveTab('notices')}
          >
            <Megaphone size={18} /> Staff Announcements
          </button>

          <button
            className={`sidebar-nav-item ${activeTab === 'requests' ? 'active' : ''}`}
            onClick={() => setActiveTab('requests')}
          >
            <Calendar size={18} /> Schedule Approvals
          </button>

          <div className="sidebar-section-heading" style={{ marginTop: '16px' }}>PROFILE</div>
          <button
            className={`sidebar-nav-item ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <User size={18} /> My Profile
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
              {activeTab === 'overview' && 'Operational Dashboard'}
              {activeTab === 'staff' && 'Branch Personnel Directory'}
              {activeTab === 'onboard' && 'Onboard New Staff'}
              {activeTab === 'emergency' && 'Doctor Emergency Block & Bulk Reschedule'}
              {activeTab === 'billing' && 'Manager Billing & Discount Approvals'}
              {activeTab === 'notices' && 'Staff Broadcast Announcements'}
              {activeTab === 'requests' && 'Doctor Schedule Approvals'}
            </h1>
            <p className="topbar-subtitle">Branch Operations & Clinical Workflow Oversight</p>
          </div>

          <div className="topbar-right-utilities">
            <div className="topbar-search-wrapper" ref={searchDropdownRef}>
              <div className="topbar-search-box">
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search staff, operations, billing..."
                  value={staffSearchQuery}
                  onChange={(e) => {
                    setStaffSearchQuery(e.target.value);
                    setIsSearchDropdownOpen(true);
                  }}
                  onFocus={() => {
                    if (staffSearchQuery.trim()) setIsSearchDropdownOpen(true);
                  }}
                />
                {staffSearchQuery && (
                  <button
                    type="button"
                    className="clear-search-btn"
                    onClick={() => {
                      setStaffSearchQuery('');
                      setIsSearchDropdownOpen(false);
                    }}
                  >
                    ×
                  </button>
                )}
              </div>

              {/* SEARCH RESULTS FLOATING DROPDOWN */}
              {staffSearchQuery.trim() !== '' && isSearchDropdownOpen && (
                <div className="search-results-dropdown">
                  <div className="search-dropdown-header">
                    <span>Matching Records for "{staffSearchQuery}"</span>
                    <span className="search-count-badge">
                      {filteredDoctors.length + filteredReceptionists.length + filteredPharmacists.length + filteredBillingRequests.length + filteredRequestsList.length} matches
                    </span>
                  </div>

                  <div className="search-dropdown-list">
                    {/* DOCTORS */}
                    {filteredDoctors.length > 0 && (
                      <div className="search-category">
                        <div className="category-title">👨‍⚕️ Doctors</div>
                        {filteredDoctors.map((doc: any) => (
                          <div
                            key={doc.doctor_id}
                            className="search-item"
                            onClick={() => {
                              setActiveTab('staff');
                              setIsSearchDropdownOpen(false);
                              setEditStaffModal({
                                open: true,
                                user_id: doc.user_id,
                                full_name: doc.full_name,
                                phone: doc.phone || '',
                                is_active: doc.is_available,
                                consultation_fee: doc.consultation_fee,
                                specialization: doc.specialization,
                                shift_timing: '',
                                role: 'doctor'
                              });
                            }}
                          >
                            <div className="search-item-avatar doc">Dr</div>
                            <div className="search-item-details">
                              <div className="item-name">{doc.full_name}</div>
                              <div className="item-sub">{doc.specialization} • ₹{doc.consultation_fee}</div>
                            </div>
                            <span className={`status-pill ${doc.is_available ? 'active' : 'inactive'}`}>
                              {doc.is_available ? 'On Duty' : 'Off Duty'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* RECEPTIONISTS */}
                    {filteredReceptionists.length > 0 && (
                      <div className="search-category">
                        <div className="category-title">👩‍💼 Receptionists</div>
                        {filteredReceptionists.map((rec: any) => (
                          <div
                            key={rec.receptionist_id}
                            className="search-item"
                            onClick={() => {
                              setActiveTab('staff');
                              setIsSearchDropdownOpen(false);
                              setEditStaffModal({
                                open: true,
                                user_id: rec.user_id,
                                full_name: rec.full_name,
                                phone: rec.phone || '',
                                is_active: rec.is_active,
                                consultation_fee: 0,
                                specialization: '',
                                shift_timing: rec.shift_timing,
                                role: 'receptionist'
                              });
                            }}
                          >
                            <div className="search-item-avatar rec">REC</div>
                            <div className="search-item-details">
                              <div className="item-name">{rec.full_name}</div>
                              <div className="item-sub">{rec.employee_code} • {rec.shift_timing}</div>
                            </div>
                            <span className={`status-pill ${rec.is_active ? 'active' : 'inactive'}`}>
                              {rec.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* PHARMACISTS */}
                    {filteredPharmacists.length > 0 && (
                      <div className="search-category">
                        <div className="category-title">💊 Pharmacists</div>
                        {filteredPharmacists.map((ph: any) => (
                          <div
                            key={ph.id || ph.user_id}
                            className="search-item"
                            onClick={() => {
                              setActiveTab('staff');
                              setIsSearchDropdownOpen(false);
                            }}
                          >
                            <div className="search-item-avatar pharm">PH</div>
                            <div className="search-item-details">
                              <div className="item-name">{ph.full_name}</div>
                              <div className="item-sub">{ph.email} • {ph.phone}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* BILLING */}
                    {filteredBillingRequests.length > 0 && (
                      <div className="search-category">
                        <div className="category-title">💳 Billing & Discount Queue</div>
                        {filteredBillingRequests.map((b: any) => (
                          <div
                            key={b.id}
                            className="search-item"
                            onClick={() => {
                              setActiveTab('billing');
                              setIsSearchDropdownOpen(false);
                            }}
                          >
                            <div className="search-item-avatar bill">₹</div>
                            <div className="search-item-details">
                              <div className="item-name">{b.patient_name} ({b.invoice_number})</div>
                              <div className="item-sub">Requested Discount: ₹{b.discount_amount}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* SCHEDULE REQUESTS */}
                    {filteredRequestsList.length > 0 && (
                      <div className="search-category">
                        <div className="category-title">📅 Schedule Requests</div>
                        {filteredRequestsList.map((req: any) => (
                          <div
                            key={req.id}
                            className="search-item"
                            onClick={() => {
                              setActiveTab('requests');
                              setIsSearchDropdownOpen(false);
                            }}
                          >
                            <div className="search-item-avatar req">REQ</div>
                            <div className="search-item-details">
                              <div className="item-name">{req.doctor_name} ({req.request_type})</div>
                              <div className="item-sub">{req.reason || 'Leave request'}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* NO RESULTS */}
                    {filteredDoctors.length + filteredReceptionists.length + filteredPharmacists.length + filteredBillingRequests.length + filteredRequestsList.length === 0 && (
                      <div className="search-empty-msg">
                        No matching staff or operational records found.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div
              className="topbar-user-profile"
              onClick={() => setIsProfileOpen((prev) => !prev)}
              ref={profileDropdownRef}
              style={{ position: 'relative', cursor: 'pointer' }}
            >
              <div className="user-avatar-circle">
                {currentUser?.full_name ? currentUser.full_name.substring(0, 2).toUpperCase() : 'CM'}
              </div>
              <div className="user-details-text">
                <span className="user-name">{currentUser?.full_name || 'Clinic Operational Manager'}</span>
                <span className="user-role-label">Operations Lead</span>
              </div>

              {/* PROFILE DROPDOWN MENU - EXACT MATCH TO USER'S SCREENSHOT */}
              {isProfileOpen && (
                <div className="manager-profile-dropdown-menu" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="dropdown-menu-item"
                    onClick={() => {
                      setIsProfileOpen(false);
                      setIsEditingManagerProfile(false);
                      setActiveTab('profile');
                    }}
                  >
                    <User size={16} className="dropdown-icon" />
                    <span>View Profile</span>
                  </button>
                  <button
                    className="dropdown-menu-item"
                    onClick={() => {
                      setIsProfileOpen(false);
                      setActiveTab('requests');
                    }}
                  >
                    <Settings size={16} className="dropdown-icon" />
                    <span>Availability</span>
                  </button>
                  <div className="dropdown-menu-divider"></div>
                  <button
                    className="dropdown-menu-item logout-item"
                    onClick={() => {
                      setIsProfileOpen(false);
                      onLogout();
                    }}
                  >
                    <LogOut size={16} className="dropdown-icon logout" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main className="manager-main-content">
          {/* TAB 1: DASHBOARD OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="tab-fade-in">
              <div className="manager-hero-card">
                <div className="hero-text-content">
                  <span className="hero-greeting">Welcome back,</span>
                  <h2 className="hero-name">Clinic Manager</h2>
                  <p className="hero-subtext">Branch Operational Command & Real-Time Patient Queue Control</p>
                </div>
                <div className="hero-action-buttons">
                  <button className="hero-btn-primary" onClick={() => { setOnboardRole('doctor'); setActiveTab('onboard'); }}>
                    <Plus size={16} /> Onboard Doctor
                  </button>
                  <button className="hero-btn-secondary" onClick={() => setActiveTab('emergency')}>
                    <AlertTriangle size={16} /> Doctor Emergency Block
                  </button>
                </div>
              </div>

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
                      <span className="stat-card-label">Patients in Queue</span>
                    </div>
                    <div className="stat-card-icon-box cyan">
                      <Clock size={22} />
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-card-left">
                      <span className="stat-card-value">{overviewData?.active_doctors_count || 0}</span>
                      <span className="stat-card-label">Active Doctors</span>
                    </div>
                    <div className="stat-card-icon-box green">
                      <Users size={22} />
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-card-left">
                      <span className="stat-card-value">{overviewData?.pending_schedule_requests_count || 0}</span>
                      <span className="stat-card-label">Pending Requests</span>
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
                  <p>View, edit and toggle duty status for all doctors, receptionists & pharmacists.</p>
                </div>

                <div className="quick-action-card" onClick={() => setActiveTab('emergency')}>
                  <div className="quick-card-header">
                    <AlertTriangle size={20} className="quick-card-icon" style={{ color: '#ef4444' }} />
                    <ChevronRight size={18} className="chevron" />
                  </div>
                  <h3>Emergency Doctor Absence</h3>
                  <p>1-Click Doctor Schedule Freeze + Smart Bulk Reschedule Engine for impacted patients.</p>
                </div>

                <div className="quick-action-card" onClick={() => setActiveTab('billing')}>
                  <div className="quick-card-header">
                    <DollarSign size={20} className="quick-card-icon" style={{ color: '#10b981' }} />
                    <ChevronRight size={18} className="chevron" />
                  </div>
                  <h3>Discount & Refund Queue</h3>
                  <p>Review and authorize receptionist discount waiver & patient refund requests.</p>
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
                    <p className="card-subtitle">Active doctors, receptionists, and pharmacists</p>
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
                          <th>Fee</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDoctors.length === 0 ? (
                          <tr><td colSpan={6} className="empty-td">No doctors found.</td></tr>
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
                              <td>
                                <button
                                  className="btn-action-icon"
                                  title="Edit Doctor"
                                  onClick={() => setEditStaffModal({
                                    open: true,
                                    user_id: d.user_id,
                                    full_name: d.full_name,
                                    phone: d.phone || '',
                                    is_active: d.is_available,
                                    consultation_fee: d.consultation_fee,
                                    specialization: d.specialization,
                                    shift_timing: '',
                                    role: 'doctor'
                                  })}
                                >
                                  <Edit3 size={15} /> Edit
                                </button>
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
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredReceptionists.length === 0 ? (
                          <tr><td colSpan={6} className="empty-td">No receptionists found.</td></tr>
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
                              <td>
                                <button
                                  className="btn-action-icon"
                                  title="Edit Receptionist"
                                  onClick={() => setEditStaffModal({
                                    open: true,
                                    user_id: r.user_id,
                                    full_name: r.full_name,
                                    phone: r.phone || '',
                                    is_active: r.is_on_duty,
                                    consultation_fee: 0,
                                    specialization: '',
                                    shift_timing: r.shift_timing,
                                    role: 'receptionist'
                                  })}
                                >
                                  <Edit3 size={15} /> Edit
                                </button>
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
                  <Users size={18} /> Onboard Doctor
                </button>
                <button
                  type="button"
                  className={`role-tab-btn ${onboardRole === 'receptionist' ? 'active' : ''}`}
                  onClick={() => setOnboardRole('receptionist')}
                >
                  <UserPlus size={18} /> Onboard Receptionist
                </button>
                <button
                  type="button"
                  className={`role-tab-btn ${onboardRole === 'pharmacist' ? 'active' : ''}`}
                  onClick={() => setOnboardRole('pharmacist')}
                >
                  <Package size={18} /> Onboard Pharmacist
                </button>
              </div>

              {onboardRole === 'doctor' && (
                <form className="form-card-container fade-in" onSubmit={handleOnboardDoctor}>
                  <div className="form-card-header">
                    <h2>Onboard New Doctor</h2>
                    <p>Create credentials, professional specialization, consultation fees, and default slots.</p>
                  </div>
                  <div className="form-row-2">
                    <div className="custom-form-group">
                      <label>Full Name *</label>
                      <input
                        type="text"
                        className="custom-input"
                        placeholder="Dr. Vikram Shah"
                        value={doctorForm.full_name}
                        onChange={(e) => setDoctorForm({ ...doctorForm, full_name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="custom-form-group">
                      <label>Email Address *</label>
                      <input
                        type="email"
                        className="custom-input"
                        placeholder="doctor@clinic.com"
                        value={doctorForm.email}
                        onChange={(e) => setDoctorForm({ ...doctorForm, email: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="form-row-2">
                    <div className="custom-form-group">
                      <label>Login Password *</label>
                      <input
                        type="password"
                        className="custom-input"
                        placeholder="••••••••"
                        value={doctorForm.password}
                        onChange={(e) => setDoctorForm({ ...doctorForm, password: e.target.value })}
                        required
                      />
                    </div>
                    <div className="custom-form-group">
                      <label>Phone Number</label>
                      <input
                        type="text"
                        className="custom-input"
                        placeholder="+91 9876543210"
                        value={doctorForm.phone}
                        onChange={(e) => setDoctorForm({ ...doctorForm, phone: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="form-row-2">
                    <div className="custom-form-group">
                      <label>Specialization *</label>
                      <input
                        type="text"
                        className="custom-input"
                        value={doctorForm.specialization}
                        onChange={(e) => setDoctorForm({ ...doctorForm, specialization: e.target.value })}
                        required
                      />
                    </div>
                    <div className="custom-form-group">
                      <label>Consultation Fee (₹) *</label>
                      <input
                        type="number"
                        className="custom-input"
                        value={doctorForm.consultation_fee}
                        onChange={(e) => setDoctorForm({ ...doctorForm, consultation_fee: parseFloat(e.target.value) || 0 })}
                        required
                      />
                    </div>
                  </div>
                  <button type="submit" className="form-submit-btn" disabled={isSubmitting}>
                    {isSubmitting ? 'Onboarding Doctor...' : 'Complete Doctor Onboarding'}
                  </button>
                </form>
              )}

              {onboardRole === 'receptionist' && (
                <form className="form-card-container fade-in" onSubmit={handleOnboardReceptionist}>
                  <div className="form-card-header">
                    <h2>Onboard New Receptionist</h2>
                    <p>Create staff credentials, employee code, and assigned duty shift hours.</p>
                  </div>
                  <div className="form-row-2">
                    <div className="custom-form-group">
                      <label>Full Name *</label>
                      <input
                        type="text"
                        className="custom-input"
                        placeholder="Ritu Sharma"
                        value={receptionistForm.full_name}
                        onChange={(e) => setReceptionistForm({ ...receptionistForm, full_name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="custom-form-group">
                      <label>Email Address *</label>
                      <input
                        type="email"
                        className="custom-input"
                        placeholder="reception@clinic.com"
                        value={receptionistForm.email}
                        onChange={(e) => setReceptionistForm({ ...receptionistForm, email: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="form-row-2">
                    <div className="custom-form-group">
                      <label>Password *</label>
                      <input
                        type="password"
                        className="custom-input"
                        placeholder="••••••••"
                        value={receptionistForm.password}
                        onChange={(e) => setReceptionistForm({ ...receptionistForm, password: e.target.value })}
                        required
                      />
                    </div>
                    <div className="custom-form-group">
                      <label>Employee Code</label>
                      <input
                        type="text"
                        className="custom-input"
                        placeholder="REC-001"
                        value={receptionistForm.employee_code}
                        onChange={(e) => setReceptionistForm({ ...receptionistForm, employee_code: e.target.value })}
                      />
                    </div>
                  </div>
                  <button type="submit" className="form-submit-btn" disabled={isSubmitting}>
                    {isSubmitting ? 'Onboarding Receptionist...' : 'Complete Receptionist Onboarding'}
                  </button>
                </form>
              )}

              {onboardRole === 'pharmacist' && (
                <form className="form-card-container fade-in" onSubmit={handleOnboardPharmacist}>
                  <div className="form-card-header">
                    <h2>Onboard New Pharmacist</h2>
                    <p>Create credentials for pharmacy stock management and counter billing staff.</p>
                  </div>
                  <div className="form-row-2">
                    <div className="custom-form-group">
                      <label>Full Name *</label>
                      <input
                        type="text"
                        className="custom-input"
                        placeholder="Amit Patel"
                        value={pharmacistForm.full_name}
                        onChange={(e) => setPharmacistForm({ ...pharmacistForm, full_name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="custom-form-group">
                      <label>Email Address *</label>
                      <input
                        type="email"
                        className="custom-input"
                        placeholder="pharmacist@clinic.com"
                        value={pharmacistForm.email}
                        onChange={(e) => setPharmacistForm({ ...pharmacistForm, email: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="form-row-2">
                    <div className="custom-form-group">
                      <label>Password *</label>
                      <input
                        type="password"
                        className="custom-input"
                        placeholder="••••••••"
                        value={pharmacistForm.password}
                        onChange={(e) => setPharmacistForm({ ...pharmacistForm, password: e.target.value })}
                        required
                      />
                    </div>
                    <div className="custom-form-group">
                      <label>Phone Number</label>
                      <input
                        type="text"
                        className="custom-input"
                        placeholder="+91 9876543210"
                        value={pharmacistForm.phone}
                        onChange={(e) => setPharmacistForm({ ...pharmacistForm, phone: e.target.value })}
                      />
                    </div>
                  </div>
                  <button type="submit" className="form-submit-btn" disabled={isSubmitting}>
                    {isSubmitting ? 'Onboarding Pharmacist...' : 'Complete Pharmacist Onboarding'}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* TAB 4: DOCTOR EMERGENCY BLOCK & BULK RESCHEDULE */}
          {activeTab === 'emergency' && (
            <div className="tab-fade-in">
              <div className="content-card">
                <div className="content-card-header">
                  <div>
                    <h2>Doctor Emergency Block & Bulk Reschedule Engine</h2>
                    <p className="card-subtitle">Freeze Doctor schedule & automatically map impacted patients to next open slots</p>
                  </div>
                </div>

                <form className="emergency-form-box" onSubmit={handleEmergencyBlock}>
                  <div className="form-row-3">
                    <div className="custom-form-group">
                      <label>Select Absent Doctor *</label>
                      <select
                        className="custom-input"
                        value={emergencyForm.doctor_id}
                        onChange={(e) => setEmergencyForm({ ...emergencyForm, doctor_id: e.target.value })}
                        required
                      >
                        <option value="">-- Choose Doctor --</option>
                        {(staffData.doctors || []).map((d) => (
                          <option key={d.doctor_id} value={d.doctor_id}>
                            {d.full_name} ({d.specialization})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="custom-form-group">
                      <label>Emergency Absence Date *</label>
                      <input
                        type="date"
                        className="custom-input"
                        value={emergencyForm.leave_date}
                        onChange={(e) => setEmergencyForm({ ...emergencyForm, leave_date: e.target.value })}
                        required
                      />
                    </div>

                    <div className="custom-form-group">
                      <label>Target Reschedule Date (Optional)</label>
                      <input
                        type="date"
                        className="custom-input"
                        placeholder="Default: Next Day"
                        value={emergencyForm.target_reschedule_date}
                        onChange={(e) => setEmergencyForm({ ...emergencyForm, target_reschedule_date: e.target.value })}
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <button type="submit" className="btn-danger-lg" disabled={isBlockingEmergency}>
                      {isBlockingEmergency ? 'Freezing Schedule & Bulk Rescheduling...' : '⚡ Freeze Schedule & Bulk Reschedule Patients'}
                    </button>
                    <span className="info-subtext">
                      * System will find unbooked open slots on target date to avoid double booking.
                    </span>
                  </div>
                </form>

                {emergencyResult && (
                  <div className="emergency-result-card">
                    <div className="result-header">
                      <CheckCircle size={24} color="#10b981" />
                      <div>
                        <h3>Bulk Reschedule Complete for {emergencyResult.doctor_name}</h3>
                        <p>{emergencyResult.message}</p>
                      </div>
                    </div>

                    {emergencyResult.rescheduled_appointments && emergencyResult.rescheduled_appointments.length > 0 ? (
                      <div style={{ marginTop: '16px' }}>
                        <h4>Rescheduled Patients ({emergencyResult.impacted_count}):</h4>
                        <table className="custom-table" style={{ marginTop: '8px' }}>
                          <thead>
                            <tr>
                              <th>Patient Name</th>
                              <th>New Provisionally Assigned Date</th>
                              <th>New Time Slot</th>
                              <th>Confirmation Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {emergencyResult.rescheduled_appointments.map((a: any, i: number) => (
                              <tr key={i}>
                                <td><strong>{a.patient_name}</strong></td>
                                <td>{a.new_date}</td>
                                <td><span className="badge-time">{a.new_time}</span></td>
                                <td><span className="badge-pending">Pending Patient Confirmation</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p style={{ marginTop: '12px', color: '#64748b' }}>No active booked patients were impacted for this date.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: BILLING APPROVALS QUEUE */}
          {activeTab === 'billing' && (
            <div className="tab-fade-in">
              <div className="content-card">
                <div className="content-card-header">
                  <div>
                    <h2>Manager Billing & Discount Approvals</h2>
                    <p className="card-subtitle">Authorize receptionist discount waivers and billing overrides</p>
                  </div>
                  <button className="btn-secondary" onClick={fetchBillingRequests}>
                    <RefreshCw size={16} /> Refresh Queue
                  </button>
                </div>

                {isLoadingBilling ? (
                  <div className="manager-loading-box">Loading billing approval queue...</div>
                ) : filteredBillingRequests.length === 0 ? (
                  <div className="empty-state-box">
                    <CheckCircle size={32} color="#10b981" />
                    <h3>No Pending Billing Requests</h3>
                    <p>All discounts and billing overrides have been reviewed.</p>
                  </div>
                ) : (
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Invoice Number</th>
                        <th>Patient Name</th>
                        <th>Subtotal</th>
                        <th>Discount Requested</th>
                        <th>Grand Total</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBillingRequests.map((inv) => (
                        <tr key={inv.id}>
                          <td><code>{inv.invoice_number}</code></td>
                          <td><strong>{inv.patient_name}</strong></td>
                          <td>₹{inv.total_amount}</td>
                          <td><strong style={{ color: '#ef4444' }}>-₹{inv.discount_amount}</strong></td>
                          <td><strong>₹{inv.grand_total}</strong></td>
                          <td><span className="status-tag pending">{inv.status.toUpperCase()}</span></td>
                          <td>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                className="btn-approve-sm"
                                onClick={() => handleReviewBilling(inv.id, 'approve')}
                              >
                                <Check size={14} /> Approve Waiver
                              </button>
                              <button
                                className="btn-reject-sm"
                                onClick={() => handleReviewBilling(inv.id, 'reject')}
                              >
                                <XCircle size={14} /> Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* TAB 6: STAFF ANNOUNCEMENTS */}
          {activeTab === 'notices' && (
            <div className="tab-fade-in">
              <div className="content-card">
                <div className="content-card-header">
                  <div>
                    <h2>Broadcast Clinic Staff Announcements</h2>
                    <p className="card-subtitle">Publish internal operational notices to Doctors, Receptionists, and Pharmacists</p>
                  </div>
                </div>

                <form className="announcement-form-box" onSubmit={handleSendAnnouncement}>
                  <div className="form-row-2">
                    <div className="custom-form-group">
                      <label>Announcement Title *</label>
                      <input
                        type="text"
                        className="custom-input"
                        placeholder="e.g. Sunday Maintenance Notice"
                        value={announcementForm.title}
                        onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                        required
                      />
                    </div>

                    <div className="custom-form-group">
                      <label>Target Recipients *</label>
                      <select
                        className="custom-input"
                        value={announcementForm.target_role}
                        onChange={(e) => setAnnouncementForm({ ...announcementForm, target_role: e.target.value })}
                      >
                        <option value="all">All Clinic Personnel</option>
                        <option value="doctor">Doctors Only</option>
                        <option value="receptionist">Receptionists Only</option>
                        <option value="pharmacist">Pharmacists Only</option>
                      </select>
                    </div>
                  </div>

                  <div className="custom-form-group" style={{ marginTop: '12px' }}>
                    <label>Announcement Message *</label>
                    <textarea
                      className="custom-input"
                      rows={4}
                      placeholder="Write your announcement message here..."
                      value={announcementForm.message}
                      onChange={(e) => setAnnouncementForm({ ...announcementForm, message: e.target.value })}
                      required
                    />
                  </div>

                  <button type="submit" className="form-submit-btn" style={{ marginTop: '16px' }} disabled={isSubmitting}>
                    {isSubmitting ? 'Broadcasting...' : '📢 Broadcast Notice to Staff'}
                  </button>
                </form>

                {filteredAnnouncementHistory.length > 0 && (
                  <div style={{ marginTop: '32px' }}>
                    <h3>Recent Sent Notices ({filteredAnnouncementHistory.length})</h3>
                    <div className="requests-grid" style={{ marginTop: '12px' }}>
                      {filteredAnnouncementHistory.map((h, idx) => (
                        <div className="request-card" key={idx}>
                          <div className="req-header">
                            <h4>{h.title}</h4>
                            <span className="tag-spec">{h.target_role.toUpperCase()}</span>
                          </div>
                          <p style={{ margin: '8px 0', color: '#334155' }}>{h.message}</p>
                          <span style={{ fontSize: '12px', color: '#94a3b8' }}>Sent at {h.created_at}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 7: SCHEDULE CHANGE APPROVALS */}
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
                ) : filteredRequestsList.length === 0 ? (
                  <div className="empty-state-box">
                    <CheckCircle size={32} color="#10b981" />
                    <h3>No Pending Requests</h3>
                    <p>All doctor availability and leave requests have been resolved.</p>
                  </div>
                ) : (
                  <div className="requests-grid">
                    {filteredRequestsList.map((req) => (
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

          {/* MY PROFILE WORKSPACE (EXACT MATCH TO DOCTOR PORTAL SCREENSHOT) */}
          {activeTab === 'profile' && (
            <div className="tab-fade-in">
              <div className="profile-workspace-hero">
                <div className="hero-text-content">
                  <h2><User size={22} /> Manager Profile Workspace</h2>
                  <p>Manage your professional credentials, registration details, and contact profile.</p>
                </div>
              </div>

              <div className="profile-workspace-grid">
                {/* LEFT CARD: PROFILE PICTURE */}
                <div className="profile-picture-card">
                  <h4 className="card-section-label">PROFILE PICTURE</h4>
                  <div className="avatar-display-box">
                    <div className="large-circle-avatar">
                      {currentUser?.full_name ? currentUser.full_name.substring(0, 2).toUpperCase() : 'CM'}
                      <div className="camera-overlay-badge">
                        <Camera size={18} />
                        <span>Add Photo</span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-upload-photo"
                    onClick={() => {
                      setProfileMsg({ type: 'success', text: 'Photo upload simulated successfully!' });
                      setTimeout(() => setProfileMsg(null), 3000);
                    }}
                  >
                    <Upload size={14} /> Upload Photo
                  </button>
                  <span className="photo-help-note">Supports JPG, PNG (Max 5MB)</span>
                </div>

                {/* RIGHT CARD: CREDENTIALS & GENERAL INFORMATION */}
                <div className="profile-credentials-card">
                  <div className="card-header-flex" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0 }}>Credentials & General Information</h3>
                    {!isEditingManagerProfile ? (
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', fontSize: '0.84rem', fontWeight: 700, color: '#0f766e', borderColor: '#0f766e', borderRadius: '8px' }}
                        onClick={() => setIsEditingManagerProfile(true)}
                      >
                        <Edit3 size={14} /> Edit Details
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f766e', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '4px 12px', borderRadius: '6px' }}>
                        Editing Mode
                      </span>
                    )}
                  </div>

                  {profileMsg && (
                    <div className={`profile-alert ${profileMsg.type}`}>
                      {profileMsg.text}
                    </div>
                  )}

                  <form onSubmit={handleSaveProfile} className="profile-workspace-form">
                    <div className="form-grid-2">
                      <div className="form-group">
                        <label>Full Name</label>
                        <input
                          type="text"
                          value={profileEditForm.full_name}
                          onChange={(e) => setProfileEditForm({ ...profileEditForm, full_name: e.target.value })}
                          disabled={!isEditingManagerProfile}
                          className={!isEditingManagerProfile ? 'readonly-input' : ''}
                        />
                      </div>

                      <div className="form-group">
                        <label>Registration / Manager Code</label>
                        <input
                          type="text"
                          value="MGR-BOPAL-01"
                          disabled
                          className="readonly-input"
                        />
                      </div>

                      <div className="form-group">
                        <label>Primary Specialization / Role</label>
                        <input
                          type="text"
                          value="Operations Manager"
                          disabled
                          className="readonly-input"
                        />
                      </div>

                      <div className="form-group">
                        <label>Assigned Branch</label>
                        <input
                          type="text"
                          value={currentUser?.branch?.name || 'Bopal Main Branch'}
                          disabled
                          className="readonly-input"
                        />
                      </div>

                      <div className="form-group">
                        <label>Email Address</label>
                        <input
                          type="email"
                          value={profileEditForm.email}
                          disabled
                          className="readonly-input"
                        />
                      </div>

                      <div className="form-group">
                        <label>Contact Phone</label>
                        <input
                          type="text"
                          value={profileEditForm.phone}
                          onChange={(e) => setProfileEditForm({ ...profileEditForm, phone: e.target.value })}
                          disabled={!isEditingManagerProfile}
                          className={!isEditingManagerProfile ? 'readonly-input' : ''}
                        />
                      </div>
                    </div>

                    <div className="form-group" style={{ marginTop: '16px' }}>
                      <label>Professional Biography</label>
                      <textarea
                        rows={3}
                        value={managerBio}
                        onChange={(e) => setManagerBio(e.target.value)}
                        disabled={!isEditingManagerProfile}
                        className={!isEditingManagerProfile ? 'readonly-input' : ''}
                      />
                    </div>

                    {isEditingManagerProfile && (
                      <div className="workspace-form-actions">
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => setIsEditingManagerProfile(false)}
                        >
                          Cancel
                        </button>
                        <button type="submit" className="btn-primary" disabled={isUpdatingProfile}>
                          {isUpdatingProfile ? 'Saving...' : 'Save Profile Changes'}
                        </button>
                      </div>
                    )}
                  </form>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MANAGER VIEW & EDIT PROFILE MODAL BOX */}
      {isProfileModalOpen && (
        <div className="manager-modal-overlay" onClick={() => setIsProfileModalOpen(false)}>
          <div className="manager-modal-card" onClick={(e) => e.stopPropagation()} style={{ width: '560px', maxWidth: '92vw' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="user-avatar-circle" style={{ width: '42px', height: '42px', fontSize: '1rem', background: '#0f766e', color: '#ffffff' }}>
                  {currentUser?.full_name ? currentUser.full_name.substring(0, 2).toUpperCase() : 'CM'}
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                    {isEditingManagerProfile ? `Edit Profile: ${currentUser?.full_name || 'Manager'}` : `Manager Details: ${currentUser?.full_name || 'Manager'}`}
                  </h2>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    Clinic Operational Manager • Operations Lead
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {!isEditingManagerProfile && (
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', fontSize: '0.82rem', fontWeight: 700, color: '#0f766e', borderColor: '#0f766e', borderRadius: '8px' }}
                    onClick={() => setIsEditingManagerProfile(true)}
                  >
                    <Edit3 size={14} /> Edit Details
                  </button>
                )}
                <button className="close-btn" onClick={() => { setIsProfileModalOpen(false); setIsEditingManagerProfile(false); }}>×</button>
              </div>
            </div>

            {profileMsg && (
              <div className={`profile-alert ${profileMsg.type}`} style={{ marginBottom: '16px' }}>
                {profileMsg.text}
              </div>
            )}

            {!isEditingManagerProfile ? (
              /* VIEW DETAILS BOX MODE */
              <div className="profile-box-details">
                <div className="detail-box-row">
                  <div className="detail-box-col">
                    <span className="box-label">Full Name</span>
                    <span className="box-val">{currentUser?.full_name || 'Clinic Operational Manager'}</span>
                  </div>
                  <div className="detail-box-col">
                    <span className="box-label">Phone Number</span>
                    <span className="box-val">{currentUser?.phone || '+91 98200 99999'}</span>
                  </div>
                </div>

                <div className="detail-box-row">
                  <div className="detail-box-col">
                    <span className="box-label">Email Address</span>
                    <span className="box-val">{currentUser?.email || 'manager@verticalclinic.com'}</span>
                  </div>
                  <div className="detail-box-col">
                    <span className="box-label">Assigned Branch</span>
                    <span className="box-val">{currentUser?.branch?.name || 'Bopal Main Branch'}</span>
                  </div>
                </div>

                <div className="detail-box-row">
                  <div className="detail-box-col">
                    <span className="box-label">System Role</span>
                    <span className="box-val badge-role-tag">Clinic Manager / Branch Lead</span>
                  </div>
                  <div className="detail-box-col">
                    <span className="box-label">Duty Status</span>
                    <span className="box-val status-online-tag">● Active / On Duty</span>
                  </div>
                </div>

                <div className="detail-box-row" style={{ marginTop: '8px' }}>
                  <div className="detail-box-col" style={{ gridColumn: 'span 2' }}>
                    <span className="box-label">Operational Scope</span>
                    <span className="box-val-sm">Full administrative control over staff onboarding, doctor emergency blocks, billing approvals, and schedule management.</span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                  <button type="button" className="btn-secondary" onClick={() => setIsProfileModalOpen(false)}>Close</button>
                  <button type="button" className="btn-primary" onClick={() => setIsEditingManagerProfile(true)}>
                    <Edit3 size={14} /> Edit Details
                  </button>
                </div>
              </div>
            ) : (
              /* EDIT DETAILS FORM INSIDE THE BOX */
              <form onSubmit={handleSaveProfile}>
                <div className="custom-form-group" style={{ marginBottom: '12px' }}>
                  <label>Full Name</label>
                  <input
                    type="text"
                    className="custom-input"
                    value={profileEditForm.full_name}
                    onChange={(e) => setProfileEditForm({ ...profileEditForm, full_name: e.target.value })}
                    required
                  />
                </div>

                <div className="custom-form-group" style={{ marginBottom: '12px' }}>
                  <label>Phone Number</label>
                  <input
                    type="text"
                    className="custom-input"
                    value={profileEditForm.phone}
                    onChange={(e) => setProfileEditForm({ ...profileEditForm, phone: e.target.value })}
                  />
                </div>

                <div className="custom-form-group" style={{ marginBottom: '12px' }}>
                  <label>Email Address (Account ID)</label>
                  <input
                    type="email"
                    className="custom-input disabled-input"
                    value={profileEditForm.email}
                    disabled
                  />
                </div>

                <div className="custom-form-group" style={{ marginBottom: '12px' }}>
                  <label>Assigned Branch</label>
                  <input
                    type="text"
                    className="custom-input disabled-input"
                    value={currentUser?.branch?.name || 'Bopal Main Branch'}
                    disabled
                  />
                </div>

                <div className="custom-form-group" style={{ marginBottom: '20px' }}>
                  <label>Status</label>
                  <select className="custom-input" disabled>
                    <option value="active">Active / On Duty</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setIsEditingManagerProfile(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={isUpdatingProfile}>
                    {isUpdatingProfile ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
