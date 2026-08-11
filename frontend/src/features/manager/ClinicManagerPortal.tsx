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
  Upload,
  Bed,
  Eye
} from 'lucide-react';
import { api } from '../../services/api';
import './ClinicManagerPortal.css';

interface ClinicManagerPortalProps {
  onLogout: () => void;
}

export const ClinicManagerPortal: React.FC<ClinicManagerPortalProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'staff' | 'onboard' | 'emergency' | 'billing' | 'notices' | 'requests' | 'profile' | 'beds'
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

  // Bed Management states
  const [bedsData, setBedsData] = useState<any[]>([]);
  const [isLoadingBeds, setIsLoadingBeds] = useState<boolean>(false);
  const [bedsError, setBedsError] = useState<string | null>(null);

  // Bed Management Sub-Tab & History States
  const [bedSubTab, setBedSubTab] = useState<'grid' | 'history'>('grid');
  const [admissionHistory, setAdmissionHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');
  
  // History Detail Modal State
  const [isHistoryDetailsModalOpen, setIsHistoryDetailsModalOpen] = useState<boolean>(false);
  const [isLoadingHistoryDetails, setIsLoadingHistoryDetails] = useState<boolean>(false);
  const [historyDetailsData, setHistoryDetailsData] = useState<any>(null);
  
  // Modal states for admissions/transfer/vitals/checkout/MAC
  const [selectedBed, setSelectedBed] = useState<any>(null);
  const [isAdmitModalOpen, setIsAdmitModalOpen] = useState<boolean>(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
  const [isVitalsModalOpen, setIsVitalsModalOpen] = useState<boolean>(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState<boolean>(false);
  const [isMacModalOpen, setIsMacModalOpen] = useState<boolean>(false);

  // Lock body scroll when any modal is active
  useEffect(() => {
    const isAnyModalOpen = isAdmitModalOpen || isTransferModalOpen || isVitalsModalOpen || isCheckoutModalOpen || isMacModalOpen || isHistoryDetailsModalOpen;
    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isAdmitModalOpen, isTransferModalOpen, isVitalsModalOpen, isCheckoutModalOpen, isMacModalOpen, isHistoryDetailsModalOpen]);
  
  // Form fields
  const [admitForm, setAdmitForm] = useState({
    patient_id: '',
    admitting_doctor_id: '',
    diagnosis: '',
    initial_deposit: 0,
  });
  const [transferForm, setTransferForm] = useState({
    to_bed_id: '',
    reason: '',
  });
  const [vitalsForm, setVitalsForm] = useState({
    temp: 98.6,
    pulse: 72,
    systolic_bp: 120,
    diastolic_bp: 80,
    spo2: 98,
    respiratory_rate: 16,
    nursing_notes: '',
  });
  const [macForm, setMacForm] = useState({
    medicine_name: '',
    dosage: '',
    scheduled_time: '',
  });
  
  // Checkout detail state
  const [checkoutBill, setCheckoutBill] = useState<any>(null);
  const [isLoadingCheckoutBill, setIsLoadingCheckoutBill] = useState<boolean>(false);
  
  // Vitals & MAC logs for the selected patient
  const [vitalsHistory, setVitalsHistory] = useState<any[]>([]);
  const [macHistory, setMacHistory] = useState<any[]>([]);
  const [isLoadingClinical, setIsLoadingClinical] = useState<boolean>(false);

  const [patientsList, setPatientsList] = useState<any[]>([]);
  const [doctorsList, setDoctorsList] = useState<any[]>([]);

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

  const fetchBedsData = async () => {
    setIsLoadingBeds(true);
    setBedsError(null);
    try {
      const response = await api.get('/ipd/dashboard/beds');
      if (response.data && response.data.success) {
        setBedsData(response.data.data);
      } else {
        setBedsError('Failed to load beds.');
      }
    } catch (err: any) {
      setBedsError(err.message || 'An error occurred while loading beds.');
    } finally {
      setIsLoadingBeds(false);
    }
  };

  const fetchAdmissionHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await api.get('/ipd/admissions/history');
      if (res.data && res.data.data) {
        setAdmissionHistory(res.data.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch admission history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const fetchHistoryDetails = async (admissionId: string) => {
    setIsHistoryDetailsModalOpen(true);
    setIsLoadingHistoryDetails(true);
    try {
      const res = await api.get(`/ipd/admissions/${admissionId}/summary`);
      if (res.data && res.data.data) {
        setHistoryDetailsData(res.data.data);
      }
    } catch (err) {
      console.error("Error fetching admission summary details", err);
    } finally {
      setIsLoadingHistoryDetails(false);
    }
  };

  const fetchPatientsAndDoctors = async () => {
    try {
      const pRes = await api.get('/patients/?limit=100');
      if (pRes.data && pRes.data.success) {
        setPatientsList(pRes.data.data.items || []);
      }
    } catch (err) {
      console.error("Error fetching patients dropdown", err);
    }
    try {
      const dRes = await api.get('/doctors/?limit=100');
      if (dRes.data && dRes.data.success) {
        setDoctorsList(dRes.data.data.items || []);
      }
    } catch (err) {
      console.error("Error fetching doctors dropdown", err);
    }
  };

  const fetchClinicalRecords = async (admissionId: string) => {
    setIsLoadingClinical(true);
    try {
      const vitalsRes = await api.get(`/ipd/admissions/${admissionId}/vitals`);
      if (vitalsRes.data && vitalsRes.data.success) {
        setVitalsHistory(vitalsRes.data.data);
      }
      const macRes = await api.get(`/ipd/admissions/${admissionId}/mac`);
      if (macRes.data && macRes.data.success) {
        setMacHistory(macRes.data.data);
      }
    } catch (err) {
      console.error("Error loading clinical records", err);
    } finally {
      setIsLoadingClinical(false);
    }
  };

  const fetchCheckoutBill = async (admissionId: string) => {
    setIsLoadingCheckoutBill(true);
    try {
      const response = await api.get(`/ipd/admissions/${admissionId}/bill-summary`);
      if (response.data && response.data.success) {
        setCheckoutBill(response.data.data);
      }
    } catch (err) {
      console.error("Error fetching checkout bill", err);
    } finally {
      setIsLoadingCheckoutBill(false);
    }
  };

  const handleAdmitPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBed) return;
    try {
      const res = await api.post('/ipd/admissions', {
        patient_id: admitForm.patient_id,
        bed_id: selectedBed.id,
        admitting_doctor_id: admitForm.admitting_doctor_id,
        diagnosis: admitForm.diagnosis,
        initial_deposit: Number(admitForm.initial_deposit),
      });
      if (res.data && res.data.success) {
        showToast('success', 'Patient admitted successfully!');
        setIsAdmitModalOpen(false);
        setAdmitForm({ patient_id: '', admitting_doctor_id: '', diagnosis: '', initial_deposit: 0 });
        fetchBedsData();
      }
    } catch (err: any) {
      showToast('error', err.response?.data?.detail || 'Failed to admit patient.');
    }
  };

  const handleTransferPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBed || !selectedBed.active_admission) return;
    try {
      const res = await api.post(`/ipd/admissions/${selectedBed.active_admission.admission_id}/transfer`, {
        to_bed_id: transferForm.to_bed_id,
        reason: transferForm.reason,
      });
      if (res.data && res.data.success) {
        showToast('success', 'Patient transferred successfully!');
        setIsTransferModalOpen(false);
        setTransferForm({ to_bed_id: '', reason: '' });
        fetchBedsData();
      }
    } catch (err: any) {
      showToast('error', err.response?.data?.detail || 'Failed to transfer patient.');
    }
  };

  const handleRecordVitals = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBed || !selectedBed.active_admission) return;
    try {
      const res = await api.post(`/ipd/admissions/${selectedBed.active_admission.admission_id}/vitals`, {
        temp: Number(vitalsForm.temp),
        pulse: Number(vitalsForm.pulse),
        systolic_bp: Number(vitalsForm.systolic_bp),
        diastolic_bp: Number(vitalsForm.diastolic_bp),
        spo2: Number(vitalsForm.spo2),
        respiratory_rate: Number(vitalsForm.respiratory_rate),
        nursing_notes: vitalsForm.nursing_notes,
      });
      if (res.data && res.data.success) {
        showToast('success', 'Rounding vitals logged successfully!');
        setIsVitalsModalOpen(false);
        setVitalsForm({ temp: 98.6, pulse: 72, systolic_bp: 120, diastolic_bp: 80, spo2: 98, respiratory_rate: 16, nursing_notes: '' });
        fetchBedsData();
      }
    } catch (err: any) {
      showToast('error', err.response?.data?.detail || 'Failed to log vitals.');
    }
  };

  const handleScheduleMedication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBed || !selectedBed.active_admission) return;
    try {
      const res = await api.post(`/ipd/admissions/${selectedBed.active_admission.admission_id}/mac`, {
        medicine_name: macForm.medicine_name,
        dosage: macForm.dosage,
        scheduled_time: new Date(macForm.scheduled_time).toISOString(),
      });
      if (res.data && res.data.success) {
        showToast('success', 'Medication scheduled successfully!');
        setMacForm({ medicine_name: '', dosage: '', scheduled_time: '' });
        fetchClinicalRecords(selectedBed.active_admission.admission_id);
      }
    } catch (err: any) {
      showToast('error', err.response?.data?.detail || 'Failed to schedule medication.');
    }
  };

  const handleAdministerMedication = async (itemId: string, status: string) => {
    try {
      const res = await api.patch(`/ipd/admissions/mac/${itemId}`, { status });
      if (res.data && res.data.success) {
        showToast('success', `Medication marked as ${status}!`);
        if (selectedBed && selectedBed.active_admission) {
          fetchClinicalRecords(selectedBed.active_admission.admission_id);
        }
      }
    } catch (err: any) {
      showToast('error', 'Failed to update medication administration.');
    }
  };

  const handleFinalizeCheckout = async () => {
    if (!selectedBed || !selectedBed.active_admission) return;
    try {
      const res = await api.post(`/ipd/admissions/${selectedBed.active_admission.admission_id}/finalize-checkout`);
      if (res.data && res.data.success) {
        showToast('success', 'Patient checked out and discharged successfully!');
        setIsCheckoutModalOpen(false);
        setCheckoutBill(null);
        fetchBedsData();
      }
    } catch (err: any) {
      showToast('error', 'Failed to finalize checkout.');
    }
  };

  const handleCleanBed = async (bedId: string) => {
    try {
      const res = await api.post(`/ipd/beds/${bedId}/clean`);
      if (res.data && res.data.success) {
        showToast('success', 'Bed marked as available and ready for use!');
        fetchBedsData();
      }
    } catch (err: any) {
      showToast('error', 'Failed to mark bed as clean.');
    }
  };

  useEffect(() => {
    fetchOverview();
    fetchStaff();
    fetchPatientsAndDoctors();
  }, []);

  useEffect(() => {
    if (isAdmitModalOpen) {
      fetchPatientsAndDoctors();
    }
  }, [isAdmitModalOpen]);

  useEffect(() => {
    if (activeTab === 'overview') fetchOverview();
    if (activeTab === 'staff') fetchStaff();
    if (activeTab === 'requests') fetchRequests();
    if (activeTab === 'billing') fetchBillingRequests();
    if (activeTab === 'emergency') fetchStaff();
    if (activeTab === 'beds') {
      fetchBedsData();
      fetchAdmissionHistory();
      fetchPatientsAndDoctors();
    }
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

          <button
            className={`sidebar-nav-item ${activeTab === 'beds' ? 'active' : ''}`}
            onClick={() => setActiveTab('beds')}
          >
            <Bed size={18} /> Bed Management
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
              {activeTab === 'beds' && 'IPD Bed Management & Asset Registry'}
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

          {/* IPD BED MANAGEMENT WORKSPACE */}
          {activeTab === 'beds' && (
            <div className="tab-fade-in beds-workspace" style={{ width: '100%' }}>
              <div className="beds-workspace-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a' }}>
                    <Bed size={22} className="text-teal-600" /> IPD Bed Management & Asset Registry
                  </h2>
                  <p style={{ margin: 0, fontSize: '0.86rem', color: '#64748b' }}>
                    Real-time category-wise monitoring of in-patient admissions, bed transfers, and historical stay logs.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {bedSubTab === 'history' && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={fetchAdmissionHistory}
                      disabled={isLoadingHistory}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <RefreshCw size={14} className={isLoadingHistory ? 'spin-animation' : ''} /> Refresh History
                    </button>
                  )}
                  {bedSubTab === 'grid' && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={fetchBedsData}
                      disabled={isLoadingBeds}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <RefreshCw size={14} className={isLoadingBeds ? 'spin-animation' : ''} /> Refresh Grid
                    </button>
                  )}
                </div>
              </div>

              {/* Sub-Tab Navigation Switcher */}
              <div style={{ display: 'flex', gap: '12px', borderBottom: '2px solid #e2e8f0', marginBottom: '24px', paddingBottom: '2px' }}>
                <button
                  type="button"
                  onClick={() => setBedSubTab('grid')}
                  style={{
                    padding: '10px 20px',
                    fontWeight: 700,
                    fontSize: '0.92rem',
                    border: 'none',
                    borderBottom: bedSubTab === 'grid' ? '3px solid #0d9488' : '3px solid transparent',
                    background: 'none',
                    color: bedSubTab === 'grid' ? '#0d9488' : '#64748b',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Bed size={18} /> Live Occupancy Grid
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBedSubTab('history');
                    fetchAdmissionHistory();
                  }}
                  style={{
                    padding: '10px 20px',
                    fontWeight: 700,
                    fontSize: '0.92rem',
                    border: 'none',
                    borderBottom: bedSubTab === 'history' ? '3px solid #0d9488' : '3px solid transparent',
                    background: 'none',
                    color: bedSubTab === 'history' ? '#0d9488' : '#64748b',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <FileText size={18} /> Bed Booking History Logs
                </button>
              </div>

              {/* SUB-TAB 1: LIVE OCCUPANCY GRID (WARD CATEGORIES) */}
              {bedSubTab === 'grid' && (
                <>
                  {bedsError && (
                    <div className="profile-alert error" style={{ marginBottom: '16px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '12px', borderRadius: '8px' }}>
                      {bedsError}
                    </div>
                  )}

                  {isLoadingBeds ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                      <RefreshCw size={32} className="spin-animation text-teal-600" />
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', marginBottom: '30px' }}>
                      {(() => {
                        const groupedCategories: { [key: string]: any[] } = {};
                        bedsData.forEach((bed: any) => {
                          const catName = bed.category?.name || 'General Ward';
                          if (!groupedCategories[catName]) {
                            groupedCategories[catName] = [];
                          }
                          groupedCategories[catName].push(bed);
                        });

                        const defaultCategories = ['General Ward', 'ICU', 'Private Deluxe'];
                        defaultCategories.forEach(cat => {
                          if (!groupedCategories[cat]) {
                            groupedCategories[cat] = [];
                          }
                        });

                        const categoryMetadata: Record<string, { bg: string; color: string; borderLeft: string; tagBg: string; tagColor: string }> = {
                          'General Ward': {
                            bg: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                            color: '#1e40af',
                            borderLeft: '5px solid #3b82f6',
                            tagBg: '#dbeafe',
                            tagColor: '#1e40af'
                          },
                          'ICU': {
                            bg: 'linear-gradient(135deg, #fef2f2 0%, #ffe4e6 100%)',
                            color: '#991b1b',
                            borderLeft: '5px solid #ef4444',
                            tagBg: '#fecaca',
                            tagColor: '#991b1b'
                          },
                          'Private Deluxe': {
                            bg: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
                            color: '#6b21a8',
                            borderLeft: '5px solid #a855f7',
                            tagBg: '#e9d5ff',
                            tagColor: '#6b21a8'
                          }
                        };

                        const sortedCategoryKeys = Object.keys(groupedCategories).sort((a, b) => {
                          const indexA = defaultCategories.indexOf(a);
                          const indexB = defaultCategories.indexOf(b);
                          if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                          if (indexA !== -1) return -1;
                          if (indexB !== -1) return 1;
                          return a.localeCompare(b);
                        });

                        return sortedCategoryKeys.map((catName) => {
                          const bedsList = groupedCategories[catName];
                          const meta = categoryMetadata[catName] || {
                            bg: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                            color: '#334155',
                            borderLeft: '5px solid #64748b',
                            tagBg: '#e2e8f0',
                            tagColor: '#334155'
                          };

                          const availableCount = bedsList.filter((b: any) => b.status === 'available').length;
                          const occupiedCount = bedsList.filter((b: any) => b.status === 'occupied').length;
                          const cleaningCount = bedsList.filter((b: any) => b.status === 'cleaning').length;

                          return (
                            <div key={catName} style={{ background: '#ffffff', borderRadius: '14px', padding: '20px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                              {/* Category Header Banner */}
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  padding: '12px 18px',
                                  background: meta.bg,
                                  borderRadius: '10px',
                                  borderLeft: meta.borderLeft,
                                  marginBottom: '20px'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: meta.color, letterSpacing: '0.5px' }}>
                                    {catName.toUpperCase()}
                                  </h3>
                                  <span style={{ fontSize: '0.82rem', fontWeight: 700, background: meta.tagBg, color: meta.tagColor, padding: '3px 10px', borderRadius: '20px' }}>
                                    {bedsList.length} {bedsList.length === 1 ? 'Bed' : 'Beds'} Total
                                  </span>
                                </div>

                                <div style={{ display: 'flex', gap: '10px', fontSize: '0.78rem', fontWeight: 700 }}>
                                  <span style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', padding: '4px 12px', borderRadius: '20px' }}>
                                    {availableCount} Available
                                  </span>
                                  <span style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '4px 12px', borderRadius: '20px' }}>
                                    {occupiedCount} Occupied
                                  </span>
                                  {cleaningCount > 0 && (
                                    <span style={{ background: '#fffbeb', color: '#b45309', border: '1px solid #fef3c7', padding: '4px 12px', borderRadius: '20px' }}>
                                      {cleaningCount} Cleaning
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Beds Grid for this Category */}
                              <div className="beds-grid-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                                {bedsList.map((bed: any) => {
                                  const statusColors: any = {
                                    available: { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', badge: 'Available' },
                                    occupied: { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c', badge: 'Occupied' },
                                    cleaning: { bg: '#fffbeb', border: '#fef3c7', text: '#b45309', badge: 'Cleaning' }
                                  };
                                  const color = statusColors[bed.status] || statusColors.available;

                                  return (
                                    <div
                                      key={bed.id}
                                      className="bed-card-premium"
                                      style={{
                                        background: '#ffffff',
                                        border: `1px solid ${color.border}`,
                                        borderRadius: '12px',
                                        padding: '20px',
                                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
                                        position: 'relative',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'space-between',
                                        minHeight: '260px'
                                      }}
                                    >
                                      <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                                            {bed.category.name}
                                          </span>
                                          <span
                                            style={{
                                              background: color.bg,
                                              color: color.text,
                                              border: `1px solid ${color.border}`,
                                              padding: '3px 10px',
                                              borderRadius: '9999px',
                                              fontSize: '0.74rem',
                                              fontWeight: 700
                                            }}
                                          >
                                            {color.badge}
                                          </span>
                                        </div>

                                        <h3 style={{ margin: '0 0 8px 0', fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>
                                          Bed {bed.bed_number}
                                        </h3>

                                        <div style={{ fontSize: '0.84rem', color: '#64748b', marginBottom: '16px' }}>
                                          <div>Rate: ₹{bed.category.base_charge_24h}/24h</div>
                                          <div>Overtime: ₹{bed.category.hourly_overtime_rate}/hour</div>
                                        </div>

                                        {bed.active_admission && (
                                          <div
                                            style={{
                                              background: '#f8fafc',
                                              border: '1px solid #e2e8f0',
                                              borderRadius: '8px',
                                              padding: '12px',
                                              fontSize: '0.8rem',
                                              marginBottom: '16px'
                                            }}
                                          >
                                            <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>
                                              {bed.active_admission.patient_name}
                                            </div>
                                            <div style={{ color: '#64748b' }}>Code: {bed.active_admission.patient_code}</div>
                                            <div style={{ color: '#64748b' }}>Doctor: {bed.active_admission.admitting_doctor}</div>
                                            <div style={{ color: '#64748b', marginTop: '4px', fontStyle: 'italic' }}>
                                              Diagnosis: {bed.active_admission.diagnosis}
                                            </div>
                                          </div>
                                        )}
                                      </div>

                                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: 'auto' }}>
                                        {bed.status === 'available' && (
                                          <button
                                            type="button"
                                            className="btn-primary"
                                            style={{ width: '100%', padding: '8px', fontSize: '0.84rem' }}
                                            onClick={() => {
                                              setSelectedBed(bed);
                                              setIsAdmitModalOpen(true);
                                            }}
                                          >
                                            Admit Patient
                                          </button>
                                        )}

                                        {bed.status === 'occupied' && (
                                          <>
                                            <button
                                              type="button"
                                              className="btn-secondary"
                                              style={{ flex: '1 1 45%', padding: '6px 8px', fontSize: '0.78rem', fontWeight: 700 }}
                                              onClick={() => {
                                                setSelectedBed(bed);
                                                setIsVitalsModalOpen(true);
                                                if (bed.active_admission) {
                                                  fetchClinicalRecords(bed.active_admission.admission_id);
                                                }
                                              }}
                                            >
                                              Vitals
                                            </button>
                                            <button
                                              type="button"
                                              className="btn-secondary"
                                              style={{ flex: '1 1 45%', padding: '6px 8px', fontSize: '0.78rem', fontWeight: 700 }}
                                              onClick={() => {
                                                setSelectedBed(bed);
                                                setIsMacModalOpen(true);
                                                if (bed.active_admission) {
                                                  fetchClinicalRecords(bed.active_admission.admission_id);
                                                }
                                              }}
                                            >
                                              MAC
                                            </button>
                                            <button
                                              type="button"
                                              className="btn-secondary"
                                              style={{ flex: '1 1 45%', padding: '6px 8px', fontSize: '0.78rem', fontWeight: 700 }}
                                              onClick={() => {
                                                setSelectedBed(bed);
                                                setIsTransferModalOpen(true);
                                              }}
                                            >
                                              Transfer
                                            </button>
                                            <button
                                              type="button"
                                              className="btn-primary"
                                              style={{ flex: '1 1 45%', padding: '6px 8px', fontSize: '0.78rem', fontWeight: 700, background: '#dc2626', borderColor: '#dc2626' }}
                                              onClick={() => {
                                                setSelectedBed(bed);
                                                setIsCheckoutModalOpen(true);
                                                if (bed.active_admission) {
                                                  fetchCheckoutBill(bed.active_admission.admission_id);
                                                }
                                              }}
                                            >
                                              Checkout
                                            </button>
                                          </>
                                        )}

                                        {bed.status === 'cleaning' && (
                                          <button
                                            type="button"
                                            className="btn-primary"
                                            style={{ width: '100%', padding: '8px', fontSize: '0.84rem', background: '#d97706', borderColor: '#d97706' }}
                                            onClick={() => handleCleanBed(bed.id)}
                                          >
                                            Ready / Mark Clean
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}
                </>
              )}

              {/* SUB-TAB 2: DEDICATED BED BOOKING HISTORY LOGS */}
              {bedSubTab === 'history' && (
                <div style={{ background: '#ffffff', borderRadius: '14px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                  {/* Search and Summary Counters */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
                    <div style={{ position: 'relative', width: '320px' }}>
                      <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                      <input
                        type="text"
                        placeholder="Search patient, bed number, or doctor..."
                        value={historySearchQuery}
                        onChange={(e) => setHistorySearchQuery(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '9px 12px 9px 36px',
                          fontSize: '0.88rem',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          outline: 'none'
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 16px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Records</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>{admissionHistory.length}</div>
                      </div>
                      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '8px 16px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' }}>Active Stays</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#15803d' }}>
                          {admissionHistory.filter(a => a.admission_status === 'admitted').length}
                        </div>
                      </div>
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 16px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Discharged</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#475569' }}>
                          {admissionHistory.filter(a => a.admission_status === 'discharged').length}
                        </div>
                      </div>
                    </div>
                  </div>

                  {isLoadingHistory ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                      <RefreshCw size={32} className="spin-animation text-teal-600" />
                    </div>
                  ) : (
                    (() => {
                      const filteredHistory = admissionHistory.filter((item: any) => {
                        const q = historySearchQuery.toLowerCase();
                        return (
                          (item.patient_name && item.patient_name.toLowerCase().includes(q)) ||
                          (item.patient_code && item.patient_code.toLowerCase().includes(q)) ||
                          (item.bed_number && item.bed_number.toLowerCase().includes(q)) ||
                          (item.admitting_doctor && item.admitting_doctor.toLowerCase().includes(q)) ||
                          (item.category_name && item.category_name.toLowerCase().includes(q))
                        );
                      });

                      if (filteredHistory.length === 0) {
                        return (
                          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                            <FileText size={40} style={{ margin: '0 auto 12px', color: '#cbd5e1' }} />
                            <h4 style={{ margin: '0 0 6px', color: '#334155' }}>No Admission History Found</h4>
                            <p style={{ margin: 0, fontSize: '0.88rem' }}>No historical bed booking records match your query.</p>
                          </div>
                        );
                      }

                      return (
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem', textAlign: 'left' }}>
                            <thead>
                              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                                <th style={{ padding: '12px 14px' }}>Patient Details</th>
                                <th style={{ padding: '12px 14px' }}>Ward & Bed</th>
                                <th style={{ padding: '12px 14px' }}>Admitting Doctor</th>
                                <th style={{ padding: '12px 14px' }}>Admission Datetime</th>
                                <th style={{ padding: '12px 14px' }}>Discharge Datetime</th>
                                <th style={{ padding: '12px 14px' }}>Duration</th>
                                <th style={{ padding: '12px 14px' }}>Status</th>
                                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredHistory.map((item: any, idx: number) => {
                                const isDischarged = item.admission_status === 'discharged';
                                return (
                                  <tr key={item.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '12px 14px' }}>
                                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{item.patient_name}</div>
                                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Code: {item.patient_code}</div>
                                      {item.diagnosis && (
                                        <div style={{ fontSize: '0.76rem', color: '#64748b', fontStyle: 'italic', marginTop: '2px' }}>
                                          Diag: {item.diagnosis}
                                        </div>
                                      )}
                                    </td>
                                    <td style={{ padding: '12px 14px' }}>
                                      <div style={{ fontWeight: 700, color: '#0f172a' }}>Bed {item.bed_number}</div>
                                      <span style={{ fontSize: '0.74rem', background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                                        {item.category_name}
                                      </span>
                                    </td>
                                    <td style={{ padding: '12px 14px', fontWeight: 600, color: '#334155' }}>
                                      Dr. {item.admitting_doctor}
                                    </td>
                                    <td style={{ padding: '12px 14px', color: '#475569' }}>
                                      {new Date(item.admission_datetime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                    </td>
                                    <td style={{ padding: '12px 14px', color: '#475569' }}>
                                      {item.discharge_datetime
                                        ? new Date(item.discharge_datetime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
                                        : <span style={{ color: '#059669', fontWeight: 700 }}>Active Stay</span>}
                                    </td>
                                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0f172a' }}>
                                      {item.stay_days > 0 ? `${item.stay_days} Days (${item.stay_hours}h)` : `${item.stay_hours} Hours`}
                                    </td>
                                    <td style={{ padding: '12px 14px' }}>
                                      <span
                                        style={{
                                          padding: '4px 10px',
                                          borderRadius: '20px',
                                          fontSize: '0.76rem',
                                          fontWeight: 700,
                                          background: isDischarged ? '#f1f5f9' : '#dcfce7',
                                          color: isDischarged ? '#475569' : '#15803d',
                                          border: isDischarged ? '1px solid #cbd5e1' : '1px solid #86efac'
                                        }}
                                      >
                                        {isDischarged ? 'Discharged' : 'Admitted'}
                                      </span>
                                    </td>
                                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                                      <button
                                        type="button"
                                        className="btn-secondary"
                                        style={{ padding: '5px 12px', fontSize: '0.78rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px', borderRadius: '6px' }}
                                        onClick={() => fetchHistoryDetails(item.id)}
                                      >
                                        <Eye size={13} /> View Details
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()
                  )}
                </div>
              )}
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

      {/* 1. ADMIT PATIENT MODAL */}
      {isAdmitModalOpen && selectedBed && (
        <div className="manager-modal-overlay" onClick={() => setIsAdmitModalOpen(false)}>
          <div className="manager-modal-card" onClick={(e) => e.stopPropagation()} style={{ width: '500px' }}>
            <div className="modal-header">
              <h3>Admit Patient — Bed {selectedBed.bed_number}</h3>
              <button className="close-btn" onClick={() => setIsAdmitModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleAdmitPatient}>
              <div className="custom-form-group" style={{ marginBottom: '12px' }}>
                <label>Select Patient</label>
                <select
                  className="custom-input"
                  value={admitForm.patient_id}
                  onChange={(e) => setAdmitForm({ ...admitForm, patient_id: e.target.value })}
                  required
                >
                  <option value="">-- Choose Patient --</option>
                  {patientsList.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.user?.full_name || p.name || p.patient_code} ({p.patient_code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="custom-form-group" style={{ marginBottom: '12px' }}>
                <label>Admitting Doctor</label>
                <select
                  className="custom-input"
                  value={admitForm.admitting_doctor_id}
                  onChange={(e) => setAdmitForm({ ...admitForm, admitting_doctor_id: e.target.value })}
                  required
                >
                  <option value="">-- Choose Doctor --</option>
                  {doctorsList.map((d: any) => (
                    <option key={d.id} value={d.id}>
                      Dr. {d.user?.full_name || d.name || 'Doctor'} ({d.specialization || d.user?.email || 'General'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="custom-form-group" style={{ marginBottom: '12px' }}>
                <label>Diagnosis / Reason for Admission</label>
                <textarea
                  className="custom-input"
                  rows={3}
                  value={admitForm.diagnosis}
                  onChange={(e) => setAdmitForm({ ...admitForm, diagnosis: e.target.value })}
                  placeholder="e.g. Chronic asthma exacerbation, post-op observation"
                  required
                />
              </div>

              <div className="custom-form-group" style={{ marginBottom: '20px' }}>
                <label>Initial Deposit Amount (₹)</label>
                <input
                  type="number"
                  className="custom-input"
                  value={admitForm.initial_deposit}
                  onChange={(e) => setAdmitForm({ ...admitForm, initial_deposit: Number(e.target.value) })}
                  min="0"
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsAdmitModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Confirm Admission</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. TRANSFER BED MODAL */}
      {isTransferModalOpen && selectedBed && (
        <div className="manager-modal-overlay" onClick={() => setIsTransferModalOpen(false)}>
          <div className="manager-modal-card" onClick={(e) => e.stopPropagation()} style={{ width: '500px' }}>
            <div className="modal-header">
              <h3>Transfer Patient — From Bed {selectedBed.bed_number}</h3>
              <button className="close-btn" onClick={() => setIsTransferModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleTransferPatient}>
              <div className="custom-form-group" style={{ marginBottom: '12px' }}>
                <label>Target Bed (Available beds only)</label>
                <select
                  className="custom-input"
                  value={transferForm.to_bed_id}
                  onChange={(e) => setTransferForm({ ...transferForm, to_bed_id: e.target.value })}
                  required
                >
                  <option value="">-- Choose Available Bed --</option>
                  {bedsData
                    .filter((b: any) => b.status === 'available')
                    .map((b: any) => (
                      <option key={b.id} value={b.id}>
                        Bed {b.bed_number} ({b.category.name} - ₹{b.category.base_charge_24h}/day)
                      </option>
                    ))}
                </select>
              </div>

              <div className="custom-form-group" style={{ marginBottom: '20px' }}>
                <label>Transfer Reason</label>
                <textarea
                  className="custom-input"
                  rows={3}
                  value={transferForm.reason}
                  onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
                  placeholder="e.g. Patient requested deluxe room, clinical condition requires ICU monitoring"
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsTransferModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Transfer Patient</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. VITALS ROUNDING LOG MODAL */}
      {isVitalsModalOpen && selectedBed && selectedBed.active_admission && (
        <div className="manager-modal-overlay" onClick={() => setIsVitalsModalOpen(false)}>
          <div className="manager-modal-card" onClick={(e) => e.stopPropagation()} style={{ width: '850px', maxWidth: '95vw' }}>
            <div className="modal-header">
              <h3>Clinical Rounding: Vitals & Nursing Logs</h3>
              <button className="close-btn" onClick={() => setIsVitalsModalOpen(false)}>×</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '24px' }}>
              {/* Left Side: Vitals History */}
              <div style={{ borderRight: '1px solid #e2e8f0', paddingRight: '20px', maxHeight: '450px', overflowY: 'auto' }}>
                <h4 style={{ margin: '0 0 12px 0', color: '#1e293b' }}>Vitals History</h4>
                {isLoadingClinical ? (
                  <RefreshCw size={24} className="spin-animation" />
                ) : vitalsHistory.length === 0 ? (
                  <p style={{ fontSize: '0.84rem', color: '#64748b' }}>No clinical logs recorded for this admission yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {vitalsHistory.map((v: any) => (
                      <div key={v.id} style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.8rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginBottom: '6px', color: '#0f766e' }}>
                          <span>Temp: {v.temp}°F | SpO2: {v.spo2}%</span>
                          <span style={{ fontSize: '0.74rem', color: '#64748b' }}>{new Date(v.recorded_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        <div>Pulse: {v.pulse} bpm | Resp: {v.respiratory_rate}/min</div>
                        <div>BP: {v.bp} mmHg</div>
                        <div style={{ color: '#475569', marginTop: '6px', fontStyle: 'italic' }}>Notes: {v.nursing_notes}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Side: Log Vitals Form */}
              <form onSubmit={handleRecordVitals}>
                <h4 style={{ margin: '0 0 12px 0', color: '#1e293b' }}>Record Roundings</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div className="custom-form-group">
                    <label>Temperature (°F)</label>
                    <input
                      type="number"
                      step="0.1"
                      className="custom-input"
                      value={vitalsForm.temp}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, temp: Number(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="custom-form-group">
                    <label>Pulse Rate (bpm)</label>
                    <input
                      type="number"
                      className="custom-input"
                      value={vitalsForm.pulse}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, pulse: Number(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="custom-form-group">
                    <label>BP Systolic (mmHg)</label>
                    <input
                      type="number"
                      className="custom-input"
                      value={vitalsForm.systolic_bp}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, systolic_bp: Number(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="custom-form-group">
                    <label>BP Diastolic (mmHg)</label>
                    <input
                      type="number"
                      className="custom-input"
                      value={vitalsForm.diastolic_bp}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, diastolic_bp: Number(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="custom-form-group">
                    <label>SpO2 Saturation (%)</label>
                    <input
                      type="number"
                      className="custom-input"
                      value={vitalsForm.spo2}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, spo2: Number(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="custom-form-group">
                    <label>Resp Rate (/min)</label>
                    <input
                      type="number"
                      className="custom-input"
                      value={vitalsForm.respiratory_rate}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, respiratory_rate: Number(e.target.value) })}
                      required
                    />
                  </div>
                </div>

                <div className="custom-form-group" style={{ marginBottom: '20px' }}>
                  <label>Clinical Notes</label>
                  <textarea
                    className="custom-input"
                    rows={3}
                    value={vitalsForm.nursing_notes}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, nursing_notes: e.target.value })}
                    placeholder="Enter observation notes, IV status, pain levels, etc."
                    required
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn-secondary" onClick={() => setIsVitalsModalOpen(false)}>Cancel</button>
                  <button type="submit" className="btn-primary">Save Rounding</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 4. MEDICATION ADMINISTRATION CHART (MAC) MODAL */}
      {isMacModalOpen && selectedBed && selectedBed.active_admission && (
        <div className="manager-modal-overlay" onClick={() => setIsMacModalOpen(false)}>
          <div className="manager-modal-card" onClick={(e) => e.stopPropagation()} style={{ width: '850px', maxWidth: '95vw' }}>
            <div className="modal-header">
              <h3>Medication Administration Chart (MAC)</h3>
              <button className="close-btn" onClick={() => setIsMacModalOpen(false)}>×</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
              {/* Left Side: MAC Schedule Grid */}
              <div style={{ borderRight: '1px solid #e2e8f0', paddingRight: '20px', maxHeight: '480px', overflowY: 'auto' }}>
                <h4 style={{ margin: '0 0 12px 0', color: '#1e293b' }}>Medication Schedule</h4>
                {isLoadingClinical ? (
                  <RefreshCw size={24} className="spin-animation" />
                ) : macHistory.length === 0 ? (
                  <p style={{ fontSize: '0.84rem', color: '#64748b' }}>No medicines scheduled for this stay yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {macHistory.map((m: any) => {
                      const statusStyles: any = {
                        scheduled: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
                        administered: { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
                        missed: { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' }
                      };
                      const style = statusStyles[m.status] || statusStyles.scheduled;

                      return (
                        <div key={m.id} style={{ background: '#ffffff', border: `1px solid ${style.border}`, padding: '12px', borderRadius: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <span style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.86rem' }}>{m.medicine_name}</span>
                            <span style={{ background: style.bg, color: style.text, border: `1px solid ${style.border}`, padding: '2px 8px', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 700 }}>
                              {m.status.toUpperCase()}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#475569' }}>Dosage: {m.dosage}</div>
                          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Scheduled: {new Date(m.scheduled_time).toLocaleString()}</div>

                          {m.status === 'scheduled' && (
                            <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                              <button
                                type="button"
                                className="btn-secondary"
                                style={{ padding: '3px 8px', fontSize: '0.74rem', color: '#16a34a', borderColor: '#bbf7d0' }}
                                onClick={() => handleAdministerMedication(m.id, 'administered')}
                              >
                                Mark Given
                              </button>
                              <button
                                type="button"
                                className="btn-secondary"
                                style={{ padding: '3px 8px', fontSize: '0.74rem', color: '#dc2626', borderColor: '#fecaca' }}
                                onClick={() => handleAdministerMedication(m.id, 'missed')}
                              >
                                Mark Missed
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right Side: Schedule New Form */}
              <form onSubmit={handleScheduleMedication}>
                <h4 style={{ margin: '0 0 12px 0', color: '#1e293b' }}>Schedule Medication</h4>
                <div className="custom-form-group" style={{ marginBottom: '12px' }}>
                  <label>Medicine Name</label>
                  <input
                    type="text"
                    className="custom-input"
                    value={macForm.medicine_name}
                    onChange={(e) => setMacForm({ ...macForm, medicine_name: e.target.value })}
                    placeholder="e.g. Inj. Pantocid 40mg"
                    required
                  />
                </div>

                <div className="custom-form-group" style={{ marginBottom: '12px' }}>
                  <label>Dosage & Route</label>
                  <input
                    type="text"
                    className="custom-input"
                    value={macForm.dosage}
                    onChange={(e) => setMacForm({ ...macForm, dosage: e.target.value })}
                    placeholder="e.g. IV twice daily, 1 tab orally"
                    required
                  />
                </div>

                <div className="custom-form-group" style={{ marginBottom: '20px' }}>
                  <label>Scheduled Administer Time</label>
                  <input
                    type="datetime-local"
                    className="custom-input"
                    value={macForm.scheduled_time}
                    onChange={(e) => setMacForm({ ...macForm, scheduled_time: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn-secondary" onClick={() => setIsMacModalOpen(false)}>Cancel</button>
                  <button type="submit" className="btn-primary">Add Schedule</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 5. FINALIZE CHECKOUT / BILLING SUMMARY MODAL */}
      {isCheckoutModalOpen && selectedBed && selectedBed.active_admission && (
        <div className="manager-modal-overlay" onClick={() => setIsCheckoutModalOpen(false)}>
          <div className="manager-modal-card" onClick={(e) => e.stopPropagation()} style={{ width: '600px' }}>
            <div className="modal-header">
              <h3>Final Checkout Invoice Preview</h3>
              <button className="close-btn" onClick={() => setIsCheckoutModalOpen(false)}>×</button>
            </div>
            {isLoadingCheckoutBill ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '30px' }}>
                <RefreshCw size={28} className="spin-animation text-teal-600" />
              </div>
            ) : checkoutBill ? (
              <div className="invoice-container-premium" style={{ color: '#1e293b' }}>
                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                  <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f766e', marginBottom: '4px' }}>
                    PATIENT: {checkoutBill.patient_name}
                  </div>
                  <div style={{ fontSize: '0.84rem', color: '#64748b' }}>
                    Admitted: {new Date(checkoutBill.admission_date).toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.84rem', color: '#64748b' }}>
                    Stay duration: {checkoutBill.hours_stayed} hours
                  </div>
                </div>

                <h4 style={{ margin: '0 0 10px 0', borderBottom: '2px solid #e2e8f0', paddingBottom: '6px', fontSize: '0.9rem', color: '#475569' }}>
                  BILLING BREAKDOWN
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px', fontSize: '0.86rem' }}>
                  {checkoutBill.bill_items.map((item: any, idx: number) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px dashed #f1f5f9' }}>
                      <div>
                        <span style={{ fontWeight: 700 }}>{item.item_name}</span>
                        <span style={{ color: '#64748b', fontSize: '0.78rem', marginLeft: '6px' }}>({item.quantity} units)</span>
                      </div>
                      <span style={{ fontWeight: 700 }}>₹{item.total_price}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '2px solid #e2e8f0', paddingTop: '12px', marginBottom: '24px', fontSize: '0.9rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Subtotal:</span>
                    <span>₹{checkoutBill.subtotal}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                    <span>Tax (GST):</span>
                    <span>₹{checkoutBill.tax_amount}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.05rem', color: '#0f172a' }}>
                    <span>Grand Total:</span>
                    <span>₹{checkoutBill.grand_total}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a', fontStyle: 'italic' }}>
                    <span>Initial Deposit Paid:</span>
                    <span>- ₹{checkoutBill.initial_deposit}</span>
                  </div>
                  {checkoutBill.insurance_approved_amount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2563eb', fontStyle: 'italic' }}>
                      <span>Insurance Credit:</span>
                      <span>- ₹{checkoutBill.insurance_approved_amount}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.15rem', color: '#dc2626', borderTop: '1px solid #cbd5e1', paddingTop: '8px' }}>
                    <span>Outstanding Due:</span>
                    <span>₹{checkoutBill.balance_due}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn-secondary" onClick={() => setIsCheckoutModalOpen(false)}>Close Preview</button>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ background: '#16a34a', borderColor: '#16a34a' }}
                    onClick={handleFinalizeCheckout}
                  >
                    Confirm Discharge & Checkout
                  </button>
                </div>
              </div>
            ) : (
              <p>Failed to retrieve checkout summary.</p>
            )}
          </div>
        </div>
      )}

        {/* ADMISSION HISTORY FULL SUMMARY MODAL */}
      {isHistoryDetailsModalOpen && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }}>
          <div style={{ background: '#ffffff', borderRadius: '16px', maxWidth: '850px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', padding: '28px' }}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', marginBottom: '20px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a', fontWeight: 800 }}>
                    {historyDetailsData ? historyDetailsData.patient_name : 'Patient History Case Sheet'}
                  </h3>
                  {historyDetailsData && (
                    <span style={{ fontSize: '0.78rem', padding: '3px 10px', borderRadius: '20px', fontWeight: 700, background: historyDetailsData.admission_status === 'discharged' ? '#f1f5f9' : '#dcfce7', color: historyDetailsData.admission_status === 'discharged' ? '#475569' : '#15803d', border: historyDetailsData.admission_status === 'discharged' ? '1px solid #cbd5e1' : '1px solid #86efac' }}>
                      {historyDetailsData.admission_status === 'discharged' ? 'Discharged' : 'Active Stay'}
                    </span>
                  )}
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '0.86rem', color: '#64748b' }}>
                  Patient Code: <strong>{historyDetailsData?.patient_code || 'N/A'}</strong> | Admission ID: <span style={{ fontFamily: 'monospace' }}>{historyDetailsData?.id?.slice(0, 8)}...</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsHistoryDetailsModalOpen(false);
                  setHistoryDetailsData(null);
                }}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            {isLoadingHistoryDetails ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
                <RefreshCw size={32} className="spin-animation" style={{ color: '#0d9488' }} />
              </div>
            ) : historyDetailsData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Key Metric Highlights Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' }}>
                    <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Ward & Bed</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                      Bed {historyDetailsData.bed_number}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#0d9488', fontWeight: 600 }}>{historyDetailsData.category_name}</div>
                  </div>

                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' }}>
                    <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Admitting Doctor</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                      Dr. {historyDetailsData.admitting_doctor}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Ph: {historyDetailsData.doctor_phone}</div>
                  </div>

                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' }}>
                    <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Total Stay Duration</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                      {historyDetailsData.stay_days > 0 ? `${historyDetailsData.stay_days} Days` : `${historyDetailsData.stay_hours} Hours`}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>({historyDetailsData.stay_hours} Hours Total)</div>
                  </div>

                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '14px' }}>
                    <div style={{ fontSize: '0.74rem', color: '#16a34a', fontWeight: 700, textTransform: 'uppercase' }}>Initial Deposit</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#15803d', marginTop: '2px' }}>
                      ₹{historyDetailsData.initial_deposit.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#16a34a' }}>Approved Ins: ₹{historyDetailsData.insurance_approved_amount.toLocaleString()}</div>
                  </div>
                </div>

                {/* Patient Details & Diagnosis Card */}
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: '0.92rem', color: '#0f172a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Admission & Clinical Diagnosis
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', fontSize: '0.88rem' }}>
                    <div>
                      <span style={{ color: '#64748b' }}>Patient Contact:</span>{' '}
                      <strong style={{ color: '#0f172a' }}>{historyDetailsData.patient_phone}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Emergency Contact:</span>{' '}
                      <strong style={{ color: '#0f172a' }}>{historyDetailsData.emergency_contact_phone}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Admission Datetime:</span>{' '}
                      <strong style={{ color: '#0f172a' }}>{new Date(historyDetailsData.admission_datetime).toLocaleString()}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Discharge Datetime:</span>{' '}
                      <strong style={{ color: '#0f172a' }}>
                        {historyDetailsData.discharge_datetime ? new Date(historyDetailsData.discharge_datetime).toLocaleString() : 'Currently Admitted'}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Daily Rate (24h):</span>{' '}
                      <strong style={{ color: '#0f172a' }}>₹{historyDetailsData.base_charge_24h}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Overtime Rate (hourly):</span>{' '}
                      <strong style={{ color: '#0f172a' }}>₹{historyDetailsData.hourly_overtime_rate}/hr</strong>
                    </div>
                  </div>

                  <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px dashed #e2e8f0' }}>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700, marginBottom: '4px' }}>PRIMARY DIAGNOSIS / REASON FOR ADMISSION</div>
                    <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', color: '#334155', fontStyle: 'italic' }}>
                      {historyDetailsData.diagnosis || 'No specific diagnosis notes recorded.'}
                    </div>
                  </div>
                </div>

                {/* Vitals History Logs Section */}
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: '0.92rem', color: '#0f172a', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Recorded Vitals History ({historyDetailsData.vitals_records?.length || 0})</span>
                  </h4>
                  {historyDetailsData.vitals_records && historyDetailsData.vitals_records.length > 0 ? (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                            <th style={{ padding: '8px 10px' }}>Time Recorded</th>
                            <th style={{ padding: '8px 10px' }}>Recorded By</th>
                            <th style={{ padding: '8px 10px' }}>Temp (°F)</th>
                            <th style={{ padding: '8px 10px' }}>Pulse</th>
                            <th style={{ padding: '8px 10px' }}>BP</th>
                            <th style={{ padding: '8px 10px' }}>SpO2</th>
                            <th style={{ padding: '8px 10px' }}>Nursing Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {historyDetailsData.vitals_records.map((v: any) => (
                            <tr key={v.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '8px 10px', color: '#64748b' }}>{new Date(v.recorded_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                              <td style={{ padding: '8px 10px', fontWeight: 600 }}>{v.recorded_by}</td>
                              <td style={{ padding: '8px 10px', fontWeight: 700, color: v.temp > 100 ? '#dc2626' : '#0f172a' }}>{v.temp}°F</td>
                              <td style={{ padding: '8px 10px', fontWeight: 700 }}>{v.pulse} bpm</td>
                              <td style={{ padding: '8px 10px', fontWeight: 700 }}>{v.bp}</td>
                              <td style={{ padding: '8px 10px', fontWeight: 700, color: v.spo2 < 95 ? '#dc2626' : '#059669' }}>{v.spo2}%</td>
                              <td style={{ padding: '8px 10px', color: '#475569', fontStyle: 'italic' }}>{v.nursing_notes || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.84rem', color: '#94a3b8', fontStyle: 'italic' }}>No vitals logs recorded during this stay.</div>
                  )}
                </div>

                {/* MAC Medication Logs Section */}
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: '0.92rem', color: '#0f172a', fontWeight: 700 }}>
                    Medication Administration Chart (MAC Logs - {historyDetailsData.mac_records?.length || 0})
                  </h4>
                  {historyDetailsData.mac_records && historyDetailsData.mac_records.length > 0 ? (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                            <th style={{ padding: '8px 10px' }}>Medicine Name</th>
                            <th style={{ padding: '8px 10px' }}>Dosage</th>
                            <th style={{ padding: '8px 10px' }}>Scheduled Time</th>
                            <th style={{ padding: '8px 10px' }}>Administered Time</th>
                            <th style={{ padding: '8px 10px' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {historyDetailsData.mac_records.map((m: any) => (
                            <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '8px 10px', fontWeight: 700, color: '#0f172a' }}>{m.medicine_name}</td>
                              <td style={{ padding: '8px 10px' }}>{m.dosage}</td>
                              <td style={{ padding: '8px 10px', color: '#64748b' }}>{new Date(m.scheduled_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                              <td style={{ padding: '8px 10px', color: '#64748b' }}>{m.administered_time ? new Date(m.administered_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '-'}</td>
                              <td style={{ padding: '8px 10px' }}>
                                <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '0.74rem', fontWeight: 700, background: m.status === 'given' ? '#dcfce7' : '#fef3c7', color: m.status === 'given' ? '#15803d' : '#b45309' }}>
                                  {m.status.toUpperCase()}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.84rem', color: '#94a3b8', fontStyle: 'italic' }}>No medication administrations logged.</div>
                  )}
                </div>

              </div>
            ) : null}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setIsHistoryDetailsModalOpen(false);
                  setHistoryDetailsData(null);
                }}
                style={{ padding: '8px 20px', fontSize: '0.88rem', fontWeight: 700 }}
              >
                Close Case Sheet Summary
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
