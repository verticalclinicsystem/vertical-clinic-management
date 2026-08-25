import React, { useState, useEffect, useRef } from 'react';
import { 
  Home, 
  Calendar, 
  Clock, 
  Users, 
  Plus, 
  Search, 
  LogOut, 
  Loader2, 
  FileText, 
  IndianRupee, 
  CreditCard, 
  Download, 
  CheckCircle, 
  AlertCircle, 
  UserCheck, 
  X,
  ArrowLeft,
  Stethoscope,
  Settings,
  Bell,
  Edit2,
  History,
  Mail,
  Bed,
  RefreshCw,
  Phone,
  MapPin,
  Activity,
  Shield,
  Heart,
  AlertTriangle,
  UploadCloud,
  Trash2,
  Eye
} from 'lucide-react';
import { api, getWebSocketUrl } from '../../services/api';
import AdmitPatientModal from '../../components/AdmitPatientModal';
import { RecepDashboardTab } from './components/RecepDashboardTab';
import { CustomDatePicker } from '../../components/CustomDatePicker';
import { RecepAppointmentsTab } from './components/RecepAppointmentsTab';
import { RecepBillingTab } from './components/RecepBillingTab';
import { RecepQueueTab } from './components/RecepQueueTab';
import { RecepPatientsTab } from './components/RecepPatientsTab';
import { RecepInvoicesTab } from './components/RecepInvoicesTab';
import { RecepCheckInTab } from './components/RecepCheckInTab';
import { RecepBedsTab } from './components/RecepBedsTab';
import { RecepAvailabilityTab } from './components/RecepAvailabilityTab';
import './ReceptionistPortal.css';

const validateMedicalFile = (file: File): { isValid: boolean; message: string } => {
  const allowedExtensions = ['pdf', 'png', 'jpg', 'jpeg', 'webp'];
  const maxSizeBytes = 10 * 1024 * 1024; // 10MB
  
  const fileExt = file.name.split('.').pop()?.toLowerCase();
  
  if (!fileExt || !allowedExtensions.includes(fileExt)) {
    return {
      isValid: false,
      message: `Invalid file format (.${fileExt || 'unknown'}). Supported formats are: PDF, PNG, JPG, JPEG, WEBP. Please select a valid document or image scan.`
    };
  }
  
  if (file.size > maxSizeBytes) {
    return {
      isValid: false,
      message: `File size exceeds the 10MB limit. Your file is ${(file.size / (1024 * 1024)).toFixed(2)}MB. Please optimize or select a smaller file.`
    };
  }
  
  return { isValid: true, message: '' };
};

interface ReceptionistPortalProps {
  onLogout: () => void;
}

const formatBedNumber = (bedNum: string): string => {
  if (!bedNum) return '';
  const hasAlphaPrefix = /^[a-zA-Z]/.test(bedNum);
  return hasAlphaPrefix ? bedNum : `Bed ${bedNum}`;
};

const getLocalApptDate = (datetimeStr: string): string => {
  if (!datetimeStr) return '';
  const d = new Date(datetimeStr);
  if (isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const getLocalApptTime = (datetimeStr: string): string => {
  if (!datetimeStr) return '';
  const d = new Date(datetimeStr);
  if (isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

const getLocalTodayDate = (): string => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const formatTimeToAMPM = (timeStr: string): string => {
  if (!timeStr) return '';
  const [hourStr, minStr] = timeStr.split(':');
  const hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour.toString().padStart(2, '0')}:${minStr} ${ampm}`;
};

const formatDocName = (name?: string): string => {
  if (!name) return '';
  const trimmed = name.trim();
  if (/^dr\.?\s+/i.test(trimmed)) {
    return trimmed;
  }
  return `Dr. ${trimmed}`;
};

const parseClinicalJson = (input: any) => {
  if (!input) return null;
  if (typeof input === 'object') return input;
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        return JSON.parse(trimmed);
      } catch (e) {
        return null;
      }
    }
  }
  return null;
};

const formatClinicalDisplay = (input: any): string => {
  if (!input) return '—';
  const parsed = parseClinicalJson(input);
  if (parsed && typeof parsed === 'object') {
    const parts: string[] = [];
    if (parsed.chronicDiseases && parsed.chronicDiseases.toLowerCase() !== 'none') {
      parts.push(parsed.chronicDiseases);
    }
    if (parsed.highRiskFlags && parsed.highRiskFlags.toLowerCase() !== 'none') {
      parts.push(`High Risk: ${parsed.highRiskFlags}`);
    }
    if (parsed.specialCondition && parsed.specialCondition.toLowerCase() !== 'none') {
      parts.push(`Special: ${parsed.specialCondition}`);
    }
    if (parsed.disability && parsed.disability.toLowerCase() !== 'none') {
      parts.push(`Disability: ${parsed.disability}`);
    }
    return parts.length > 0 ? parts.join(' | ') : 'None';
  }
  return String(input);
};

const formatClinicalEdit = (input: any): string => {
  if (!input) return '';
  const parsed = parseClinicalJson(input);
  if (parsed && typeof parsed === 'object') {
    const parts: string[] = [];
    if (parsed.chronicDiseases && parsed.chronicDiseases.toLowerCase() !== 'none') {
      parts.push(parsed.chronicDiseases);
    }
    if (parsed.highRiskFlags && parsed.highRiskFlags.toLowerCase() !== 'none') {
      parts.push(parsed.highRiskFlags);
    }
    if (parsed.specialCondition && parsed.specialCondition.toLowerCase() !== 'none') {
      parts.push(parsed.specialCondition);
    }
    if (parsed.disability && parsed.disability.toLowerCase() !== 'none') {
      parts.push(parsed.disability);
    }
    return parts.join(', ');
  }
  return String(input);
};

export const ReceptionistPortal: React.FC<ReceptionistPortalProps> = ({ onLogout }) => {
  const [activeTab, setActiveTabInternal] = useState<string>(() => {
    const saved = localStorage.getItem('receptionist_portal_tab');
    const validTabs = ['dashboard', 'calendar', 'queue', 'checkin', 'patients', 'billing', 'invoices', 'beds', 'availability'];
    return saved && validTabs.includes(saved) ? saved : 'dashboard';
  });
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
    localStorage.setItem('receptionist_portal_tab', newTab);
  };

  const goBackTab = () => {
    if (tabHistory.length === 0) return;
    const prevTab = tabHistory[tabHistory.length - 1];
    setTabHistory(prev => prev.slice(0, -1));
    setActiveTabInternal(prevTab);
    localStorage.setItem('receptionist_portal_tab', prevTab);
  };

  const setActiveTab = (newTab: string) => {
    changeTab(newTab, true);
  };

  const handleRootTabChange = (newTab: string) => {
    setTabHistory([]);
    changeTab(newTab, false);
  };
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  const [notifications, setNotifications] = useState<any[]>([]);
  const [isNotiDropdownOpen, setIsNotiDropdownOpen] = useState(false);
  const notiDropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      if (res.data?.success) {
        setNotifications(res.data.data || []);
      }
    } catch (err) {
      console.error("Failed to load notifications", err);
    }
  };

  const handleMarkNotificationRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {
      console.error("Failed to mark notification as read", err);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error("Failed to mark all notifications as read", err);
    }
  };

  const handleClearAllNotifications = async () => {
    try {
      await api.delete('/notifications/clear-all');
      setNotifications([]);
    } catch (err) {
      console.error("Failed to clear all notifications", err);
    }
  };


  const formatRelativeTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return 'Yesterday';
      return date.toLocaleDateString();
    } catch {
      return '';
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
      if (notiDropdownRef.current && !notiDropdownRef.current.contains(event.target as Node)) {
        setIsNotiDropdownOpen(false);
      }
      if (globalSearchRef.current && !globalSearchRef.current.contains(event.target as Node)) {
        setIsGlobalSearchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('receptionist_portal_tab', activeTab);
  }, [activeTab]);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Data State
  const [appointments, setAppointments] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  
  // Search & Filter States
  const [patientSearchQuery, setPatientSearchQuery] = useState<string>('');
  const [billingSearchQuery, setBillingSearchQuery] = useState<string>('');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [checkInSearchQuery, setCheckInSearchQuery] = useState<string>('');
  const [selectedApptForCheckIn, setSelectedApptForCheckIn] = useState<any>(null);
  
  // Availability & Leave Requests States
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [isRequestingChange, setIsRequestingChange] = useState<boolean>(false);
  const [reqStartDate, setReqStartDate] = useState<string>('');
  const [reqEndDate, setReqEndDate] = useState<string>('');
  const [reqReason, setReqReason] = useState<string>('');
  const [submittingRequest, setSubmittingRequest] = useState<boolean>(false);
  
  // Calendar states
  const [calendarDate, setCalendarDate] = useState<string>(getLocalTodayDate());
  const [selectedCalendarAppt, setSelectedCalendarAppt] = useState<any>(null);
  const [selectedApptDetails, setSelectedApptDetails] = useState<any>(null);
  const [consultationDetails, setConsultationDetails] = useState<any>(null);
  const [loadingConsultationDetails, setLoadingConsultationDetails] = useState<boolean>(false);

  useEffect(() => {
    const fetchConsultationDetails = async () => {
      if (!selectedApptDetails) {
        setConsultationDetails(null);
        return;
      }
      setLoadingConsultationDetails(true);
      try {
        const res = await api.get(`/consultations/?appointment_id=${selectedApptDetails.id}`);
        if (res.data && res.data.success && res.data.data && res.data.data.items && res.data.data.items.length > 0) {
          setConsultationDetails(res.data.data.items[0]);
        } else {
          setConsultationDetails(null);
        }
      } catch (err) {
        console.error("Failed to fetch consultation details:", err);
        setConsultationDetails(null);
      } finally {
        setLoadingConsultationDetails(false);
      }
    };
    fetchConsultationDetails();
  }, [selectedApptDetails]);
  
  // Modal states
  const [showRegisterModal, setShowRegisterModal] = useState<boolean>(false);
  const [showBookModal, setShowBookModal] = useState<boolean>(false);
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [showEditBillingModal, setShowEditBillingModal] = useState<boolean>(false);
  const [selectedInvoiceForEdit, setSelectedInvoiceForEdit] = useState<any>(null);
  const [showInvoicePreviewModal, setShowInvoicePreviewModal] = useState<boolean>(false);
  const [selectedInvoiceForPreview, setSelectedInvoiceForPreview] = useState<any>(null);
  const [sendingEmailStatus, setSendingEmailStatus] = useState<boolean>(false);
  const [showPatientHistoryModal, setShowPatientHistoryModal] = useState<boolean>(false);
  const [selectedPatientForHistory, setSelectedPatientForHistory] = useState<any>(null);
  const [patientHistoryData, setPatientHistoryData] = useState<any>(null);
  const [loadingPatientHistory, setLoadingPatientHistory] = useState<boolean>(false);
  const [historyModalTab, setHistoryModalTab] = useState<'appointments' | 'consultations' | 'prescriptions' | 'bills' | 'reports'>('appointments');
  
  // Medical reports upload state in Receptionist EMR History Modal
  const [reportUploadTitle, setReportUploadTitle] = useState<string>('');
  const [reportUploadType, setReportUploadType] = useState<string>('Lab Report');
  const [reportUploadFile, setReportUploadFile] = useState<File | null>(null);
  const [uploadingReport, setUploadingReport] = useState<boolean>(false);
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null);
  const [viewingReport, setViewingReport] = useState<any>(null);
  
  // Global Patient Search
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>('');
  const [globalSearchResults, setGlobalSearchResults] = useState<any[]>([]);
  const [isGlobalSearchDropdownOpen, setIsGlobalSearchDropdownOpen] = useState<boolean>(false);
  const globalSearchRef = useRef<HTMLDivElement>(null);

  const handleGlobalSearch = async (query: string) => {
    setGlobalSearchQuery(query);
    if (!query.trim()) {
      setGlobalSearchResults([]);
      setIsGlobalSearchDropdownOpen(false);
      return;
    }
    try {
      const res = await api.get(`/patients/?search=${encodeURIComponent(query)}`);
      if (res.data && res.data.success) {
        setGlobalSearchResults(res.data.data.items || []);
        setIsGlobalSearchDropdownOpen(true);
      }
    } catch (err) {
      console.error('Error in global patient search:', err);
    }
  };

  const handleSelectGlobalPatient = (patient: any) => {
    setIsGlobalSearchDropdownOpen(false);
    setGlobalSearchQuery('');
    setSelectedPatientForHistory(patient);
    fetchPatientHistoryProfile(patient.id);
    setIsEditingPatientProfile(false);
    setShowPatientHistoryModal(true);
  };
  const [isEditingPatientProfile, setIsEditingPatientProfile] = useState<boolean>(false);
  const [savingPatientProfile, setSavingPatientProfile] = useState<boolean>(false);
  const [editPatientForm, setEditPatientForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    gender: 'Male',
    date_of_birth: '',
    blood_group: '',
    address: '',
    allergies: '',
    chronic_conditions: '',
    emergency_contact_name: '',
    emergency_contact_relation: '',
    emergency_contact_phone: '',
    insurance_provider: '',
    insurance_policy_no: '',
  });

  const handleStartEditPatient = (patientObj?: any) => {
    const target = patientObj || selectedPatientForHistory;
    if (!target) return;
    setEditPatientForm({
      full_name: target.user?.full_name || target.name || '',
      phone: target.user?.phone || '',
      email: target.user?.email || '',
      gender: target.gender || 'Male',
      date_of_birth: target.date_of_birth ? target.date_of_birth.split('T')[0] : '',
      blood_group: target.blood_group || '',
      address: target.address || '',
      allergies: formatClinicalEdit(target.allergies),
      chronic_conditions: formatClinicalEdit(target.chronic_conditions),
      emergency_contact_name: target.emergency_contact_name || '',
      emergency_contact_relation: target.emergency_contact_relation || '',
      emergency_contact_phone: target.emergency_contact_phone || '',
      insurance_provider: target.insurance_provider || '',
      insurance_policy_no: target.insurance_policy_no || '',
    });
    setIsEditingPatientProfile(true);
  };

  const handleSavePatientProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedPatientForHistory) return;
    setSavingPatientProfile(true);
    try {
      const payload: any = {
        full_name: editPatientForm.full_name,
        phone: editPatientForm.phone,
        gender: editPatientForm.gender,
        blood_group: editPatientForm.blood_group,
        address: editPatientForm.address,
        allergies: editPatientForm.allergies,
        chronic_conditions: editPatientForm.chronic_conditions,
        emergency_contact_name: editPatientForm.emergency_contact_name,
        emergency_contact_relation: editPatientForm.emergency_contact_relation,
        emergency_contact_phone: editPatientForm.emergency_contact_phone,
        insurance_provider: editPatientForm.insurance_provider,
        insurance_policy_no: editPatientForm.insurance_policy_no,
      };

      if (editPatientForm.date_of_birth) {
        payload.date_of_birth = `${editPatientForm.date_of_birth}T00:00:00Z`;
      }

      const res = await api.put(`/patients/${selectedPatientForHistory.id}`, payload);
      if (res.data?.success) {
        showToast('Patient profile updated successfully!', 'success');
        const updatedPatient = res.data.data;
        setSelectedPatientForHistory(updatedPatient);
        setIsEditingPatientProfile(false);
        // Refresh local patient list
        fetchPortalData(true);
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.message || 'Failed to update patient profile.', 'error');
    } finally {
      setSavingPatientProfile(false);
    }
  };
  const [editBillingForm, setEditBillingForm] = useState({
    total_amount: 0,
    discount_amount: 0,
    tax_amount: 0,
    status: 'unpaid',
  });
  const [editPendingCharges, setEditPendingCharges] = useState<{
    consultations: any[];
    treatment_plans: any[];
    standard_materials: any[];
  } | null>(null);
  const [loadingEditPendingCharges, setLoadingEditPendingCharges] = useState<boolean>(false);
  const [editSelectedConsultationId, setEditSelectedConsultationId] = useState<string | null>(null);
  const [editSelectedTreatmentPlanId, setEditSelectedTreatmentPlanId] = useState<string | null>(null);
  const [editIncludeMedicines, setEditIncludeMedicines] = useState<boolean>(true);
  const [editIncludeMaterials, setEditIncludeMaterials] = useState<boolean>(true);
  const [editCustomMaterialsCost, setEditCustomMaterialsCost] = useState<number>(0);
  
  // Form states
  const [registerForm, setRegisterForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: 'Patient123!',
    gender: 'Male',
    date_of_birth: '',
    address: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
  });

  const [selectedPatientForBooking, setSelectedPatientForBooking] = useState<any>(null);
  const [bookingForm, setBookingForm] = useState({
    doctor_id: '',
    appointment_date: '',
    appointment_time: '',
    treatment_type: 'General Consultation',
    consultation_type: 'in_person',
    notes: '',
  });
  const [availableSlots, setAvailableSlots] = useState<{ time: string; status: string }[]>([]);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);

  // Rescheduling states
  const [rescheduleApptId, setRescheduleApptId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>('');
  const [rescheduleTime, setRescheduleTime] = useState<string>('');
  const [rescheduleSlots, setRescheduleSlots] = useState<{ time: string; status: string }[]>([]);
  const [loadingRescheduleSlots, setLoadingRescheduleSlots] = useState<boolean>(false);
  const [isCustomTimeBooking, setIsCustomTimeBooking] = useState<boolean>(false);
  const [isCustomTimeReschedule, setIsCustomTimeReschedule] = useState<boolean>(false);
  const [rescheduleConsultationType, setRescheduleConsultationType] = useState<string>('in_person');

  const [billingForm, setBillingForm] = useState({
    patient_id: '',
    total_amount: 0,
    discount_amount: 0,
    tax_amount: 0,
  });

  const [pendingCharges, setPendingCharges] = useState<{
    consultations: any[];
    treatment_plans: any[];
    standard_materials: any[];
  } | null>(null);
  const [loadingPendingCharges, setLoadingPendingCharges] = useState<boolean>(false);
  const [selectedConsultationId, setSelectedConsultationId] = useState<string | null>(null);
  const [selectedTreatmentPlanId, setSelectedTreatmentPlanId] = useState<string | null>(null);
  const [selectedAdmissionIds, setSelectedAdmissionIds] = useState<string[]>([]);
  const [includeMedicines, setIncludeMedicines] = useState<boolean>(true);
  const [includeMaterials, setIncludeMaterials] = useState<boolean>(true);
  const [customMaterialsCost, setCustomMaterialsCost] = useState<number>(0);

  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<any>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    payment_method: 'cash', // cash | card | online_upi | bank_transfer
    transaction_reference: '',
  });

  // Bed Management states
  const [bedsData, setBedsData] = useState<any[]>([]);
  const [categoriesData, setCategoriesData] = useState<any[]>([]);
  const [isLoadingBeds, setIsLoadingBeds] = useState<boolean>(false);
  const [bedsError, setBedsError] = useState<string | null>(null);

  // Bed Management Sub-Tab & History States
  const [bedSubTab, setBedSubTab] = useState<'grid' | 'history'>('grid');
  const [pendingAdmissionRequests, setPendingAdmissionRequests] = useState<any[]>([]);
  const [activeAdmissionRequestId, setActiveAdmissionRequestId] = useState<string | null>(null);
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

  // Action loading states
  const [submitLoading, setSubmitLoading] = useState<boolean>(false);
  


  // Toast notifications state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const getInvoiceEffectiveStatus = (inv: any) => {
    if (!inv) return 'unpaid';
    if (inv.status === 'cancelled') return 'cancelled';
    const bal = typeof inv.balance_due === 'number' ? inv.balance_due : parseFloat(inv.balance_due || 0);
    const paid = typeof inv.amount_paid === 'number' ? inv.amount_paid : parseFloat(inv.amount_paid || 0);
    if (bal <= 0) return 'paid';
    if (paid > 0 && bal > 0) return 'partially_paid';
    return 'unpaid';
  };

  const fetchMyRequests = async () => {
    try {
      const res = await api.get('/doctors/availability-requests/');
      if (res.data?.success) {
        setMyRequests(res.data.data);
      }
    } catch (e) {
      console.error('Error fetching my requests:', e);
    }
  };

  const handleSubmitChangeRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqReason.trim()) {
      showToast('Please provide a reason for the request.', 'error');
      return;
    }
    setSubmittingRequest(true);
    try {
      const payload = {
        request_type: 'leave',
        proposed_start_date: reqStartDate,
        proposed_end_date: reqEndDate,
        reason: reqReason.trim()
      };

      const res = await api.post('/doctors/availability-requests/', payload);
      if (res.data?.success) {
        showToast('Leave request submitted successfully!', 'success');
        setIsRequestingChange(false);
        setReqReason('');
        setReqStartDate('');
        setReqEndDate('');
        await fetchMyRequests();
      } else {
        showToast(res.data?.message || 'Failed to submit request.', 'error');
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.message || 'Error submitting request.', 'error');
    } finally {
      setSubmittingRequest(false);
    }
  };

  const fetchPendingAdmissionRequests = async () => {
    try {
      const res = await api.get('/ipd/admission-requests/pending');
      if (res.data && res.data.success) {
        setPendingAdmissionRequests(res.data.data || []);
      }
    } catch (err: any) {
      console.error('Failed to fetch pending admission requests:', err);
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
      
      try {
        const catRes = await api.get('/ipd/categories');
        if (catRes.data && catRes.data.success) {
          setCategoriesData(catRes.data.data);
        }
      } catch (catErr) {
        console.error('Failed to fetch IPD categories:', catErr);
      }

      fetchPendingAdmissionRequests();
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
        showToast('Patient admitted successfully!', 'success');
        if (activeAdmissionRequestId) {
          try {
            await api.post(`/ipd/admission-requests/${activeAdmissionRequestId}/fulfill`);
          } catch (reqErr) {
            console.error('Failed to fulfill admission request:', reqErr);
          }
          setActiveAdmissionRequestId(null);
        }
        setIsAdmitModalOpen(false);
        setAdmitForm({ patient_id: '', admitting_doctor_id: '', diagnosis: '', initial_deposit: 0 });
        fetchBedsData();
        fetchAdmissionHistory();
      }
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to admit patient.', 'error');
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
        showToast('Patient transferred successfully!', 'success');
        setIsTransferModalOpen(false);
        setTransferForm({ to_bed_id: '', reason: '' });
        fetchBedsData();
        fetchAdmissionHistory();
      }
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to transfer patient.', 'error');
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
        showToast('Rounding vitals logged successfully!', 'success');
        setIsVitalsModalOpen(false);
        setVitalsForm({ temp: 98.6, pulse: 72, systolic_bp: 120, diastolic_bp: 80, spo2: 98, respiratory_rate: 16, nursing_notes: '' });
        fetchBedsData();
        fetchAdmissionHistory();
      }
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to log vitals.', 'error');
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
        showToast('Medication scheduled successfully!', 'success');
        setMacForm({ medicine_name: '', dosage: '', scheduled_time: '' });
        fetchClinicalRecords(selectedBed.active_admission.admission_id);
      }
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to schedule medication.', 'error');
    }
  };

  const handleAdministerMedication = async (itemId: string, status: string) => {
    try {
      const res = await api.patch(`/ipd/admissions/mac/${itemId}`, { status });
      if (res.data && res.data.success) {
        showToast(`Medication marked as ${status}!`, 'success');
        if (selectedBed && selectedBed.active_admission) {
          fetchClinicalRecords(selectedBed.active_admission.admission_id);
        }
      }
    } catch (err: any) {
      showToast('Failed to update medication administration.', 'error');
    }
  };

  const handleFinalizeCheckout = async () => {
    if (!selectedBed || !selectedBed.active_admission) return;
    try {
      const res = await api.post(`/ipd/admissions/${selectedBed.active_admission.admission_id}/finalize-checkout`);
      if (res.data && res.data.success) {
        showToast('Patient checked out and discharged successfully!', 'success');
        setIsCheckoutModalOpen(false);
        setCheckoutBill(null);
        fetchBedsData();
        fetchAdmissionHistory();
      }
    } catch (err: any) {
      showToast('Failed to finalize checkout.', 'error');
    }
  };

  const handleCleanBed = async (bedId: string) => {
    try {
      const res = await api.post(`/ipd/beds/${bedId}/clean`);
      if (res.data && res.data.success) {
        showToast('Bed marked as available and ready for use!', 'success');
        fetchBedsData();
        fetchAdmissionHistory();
      }
    } catch (err: any) {
      showToast('Failed to mark bed as clean.', 'error');
    }
  };

  useEffect(() => {
    if (activeTab === 'availability') {
      fetchMyRequests();
    }
    if (activeTab === 'beds') {
      fetchBedsData();
      fetchAdmissionHistory();
    }
  }, [activeTab]);

  // Fetch initial configuration & user details
  const fetchInitialContext = async () => {
    try {
      const [meRes, branchRes, docRes] = await Promise.all([
        api.get('/auth/me'),
        api.get('/branches/?limit=100'),
        api.get('/doctors/?limit=100'),
      ]);
      
      if (meRes.data?.success) {
        setCurrentUser(meRes.data.data);
        if (meRes.data.data.branch_id) {
          setSelectedBranchId(meRes.data.data.branch_id);
        }
      }
      
      if (branchRes.data?.success) {
        setBranches(branchRes.data.data.items || []);
        // Fallback branch if user doesn't have one assigned
        if (!selectedBranchId && branchRes.data.data.items?.length > 0) {
          setSelectedBranchId(branchRes.data.data.items[0].id);
        }
      }

      if (docRes.data?.success) {
        setDoctors(docRes.data.data.items || []);
      }
    } catch (err: any) {
      console.error(err);
      showToast('Error loading clinic context.', 'error');
    }
  };

  // Main data fetching
  const fetchPortalData = async (silent = false) => {
    if (!selectedBranchId) return;
    if (!silent) setLoading(true);
    try {
      // 1. Fetch appointments for this branch
      const apptRes = await api.get(`/appointments/?branch_id=${selectedBranchId}&limit=100`);
      if (apptRes.data?.success) {
        setAppointments(apptRes.data.data.items || []);
      }

      // 2. Fetch all patients
      const patientRes = await api.get('/patients/?limit=100');
      if (patientRes.data?.success) {
        setPatients(patientRes.data.data.items || []);
      }

      // 3. Fetch invoices
      const invoiceRes = await api.get('/billing/?limit=100');
      if (invoiceRes.data?.success) {
        setInvoices(invoiceRes.data.data.items || []);
      }
    } catch (err: any) {
      console.error(err);
      showToast('Error fetching database records.', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialContext();
  }, []);

  useEffect(() => {
    if (selectedBranchId) {
      fetchPortalData();
    }
  }, [selectedBranchId]);

  // Real-time WebSocket Queue Update
  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connectWebSocket = () => {
      try {
        const wsUrl = getWebSocketUrl();
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
          console.log('WebSocket connected for queue updates');
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.event === 'queue_updated') {
              console.log('Queue update received via WebSocket, refreshing...');
              fetchPortalData(true);
            } else if (data.event === 'new_booking') {
              console.log('New booking event received via WebSocket:', data.data);
              showToast(`New Appointment Booked: ${data.data.patient_name} with Dr. ${data.data.doctor_name} for ${data.data.treatment_type} at ${data.data.time}.`, 'success');
              fetchPortalData(true);
            }
          } catch (err) {
            console.error('Error parsing WebSocket message:', err);
          }
        };

        socket.onclose = () => {
          console.log('WebSocket disconnected, reconnecting in 5s...');
          reconnectTimeout = setTimeout(connectWebSocket, 5000);
        };

        socket.onerror = (err) => {
          console.error('WebSocket error:', err);
          socket?.close();
        };
      } catch (err) {
        console.error('Failed to establish WebSocket connection:', err);
        reconnectTimeout = setTimeout(connectWebSocket, 5000);
      }
    };

    connectWebSocket();

    return () => {
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, [selectedBranchId]);

  // Fallback Polling for Real-time sync (every 15 seconds)
  useEffect(() => {
    if (!selectedBranchId) return;
    const interval = setInterval(() => {
      fetchPortalData(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [selectedBranchId]);

  // Load available slots when doctor and date change
  useEffect(() => {
    const loadSlots = async () => {
      if (!bookingForm.doctor_id || !bookingForm.appointment_date) {
        setAvailableSlots([]);
        return;
      }
      setLoadingSlots(true);
      try {
        const res = await api.get(
          `/appointments/available-slots?doctor_id=${bookingForm.doctor_id}&date=${bookingForm.appointment_date}&branch_id=${selectedBranchId}&consultation_type=${bookingForm.consultation_type}`
        );
        if (res.data?.success) {
          setAvailableSlots(res.data.data || []);
        }
      } catch (err) {
        console.error(err);
        setAvailableSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    };
    loadSlots();
  }, [bookingForm.doctor_id, bookingForm.appointment_date, bookingForm.consultation_type, selectedBranchId]);

  // Action handlers
  const handleCheckIn = async (appointmentId: string) => {
    try {
      const res = await api.patch(`/appointments/${appointmentId}/check-in`);
      if (res.data?.success) {
        showToast('Patient successfully checked in! Placed in waiting queue.', 'success');
        await fetchPortalData();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Error checking in appointment.', 'error');
    }
  };



  // Load available slots for rescheduling
  useEffect(() => {
    const loadRescheduleSlots = async () => {
      if (!rescheduleApptId || !rescheduleDate) {
        setRescheduleSlots([]);
        return;
      }
      const appt = appointments.find(a => a.id === rescheduleApptId);
      if (!appt || !appt.doctor_id) return;
      setLoadingRescheduleSlots(true);
      try {
        const res = await api.get(
          `/appointments/available-slots?doctor_id=${appt.doctor_id}&date=${rescheduleDate}&branch_id=${selectedBranchId}&consultation_type=${rescheduleConsultationType}`
        );
        if (res.data?.success) {
          setRescheduleSlots(res.data.data || []);
        }
      } catch (err) {
        console.error(err);
        setRescheduleSlots([]);
      } finally {
        setLoadingRescheduleSlots(false);
      }
    };
    loadRescheduleSlots();
  }, [rescheduleApptId, rescheduleDate, selectedBranchId, rescheduleConsultationType, appointments]);

  const handleCancel = async (appointmentId: string) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) {
      return;
    }
    try {
      const res = await api.patch(`/appointments/${appointmentId}/cancel`);
      if (res.data?.success) {
        showToast('Appointment cancelled successfully.', 'success');
        await fetchPortalData();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Error cancelling appointment.', 'error');
    }
  };

  const handleRescheduleSubmit = async () => {
    if (!rescheduleApptId || !rescheduleDate || !rescheduleTime) {
      showToast('Please select both a new date and an available time slot.', 'error');
      return;
    }
    try {
      const datetimeStr = `${rescheduleDate}T${rescheduleTime}:00`;
      const res = await api.patch(`/appointments/${rescheduleApptId}/reschedule`, {
        new_datetime: datetimeStr,
        consultation_type: rescheduleConsultationType
      });
      if (res.data?.success) {
        showToast('Appointment rescheduled successfully.', 'success');
        setRescheduleApptId(null);
        setRescheduleDate('');
        setRescheduleTime('');
        await fetchPortalData();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Error rescheduling appointment.', 'error');
    }
  };

  const handleRegisterPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerForm.full_name || !registerForm.email || !registerForm.phone) {
      showToast('Name, email, and phone are required.', 'error');
      return;
    }
    setSubmitLoading(true);
    try {
      // 1. Call public registration
      const regRes = await api.post('/auth/register', {
        full_name: registerForm.full_name,
        email: registerForm.email,
        phone: registerForm.phone,
        password: registerForm.password,
      });

      if (regRes.data?.success) {
        // 2. Look up the newly registered patient profile using query search
        // Wait a small moment to let DB hooks complete
        await new Promise((r) => setTimeout(r, 400));
        const searchRes = await api.get(`/patients/?search=${registerForm.email}`);
        
        if (searchRes.data?.success && searchRes.data.data.items?.length > 0) {
          const patientProfile = searchRes.data.data.items[0];
          
          // 3. Update clinical demographics via PUT /patients/{id}
          await api.put(`/patients/${patientProfile.id}`, {
            date_of_birth: registerForm.date_of_birth ? new Date(registerForm.date_of_birth).toISOString() : null,
            gender: registerForm.gender,
            address: registerForm.address || null,
            emergency_contact_name: registerForm.emergency_contact_name || null,
            emergency_contact_phone: registerForm.emergency_contact_phone || null,
            preferred_branch_id: selectedBranchId,
          });

          // 4. Activate patient immediately since reception is front-desk registering them
          await api.post(`/patients/${patientProfile.id}/activate`);

          showToast('Patient registered and activated successfully!', 'success');
          
          // Clear form & close
          setRegisterForm({
            full_name: '',
            email: '',
            phone: '',
            password: 'Patient123!',
            gender: 'Male',
            date_of_birth: '',
            address: '',
            emergency_contact_name: '',
            emergency_contact_phone: '',
          });
          setShowRegisterModal(false);
          await fetchPortalData();
          // Auto select the new patient and open the book modal
          setSelectedPatientForBooking(patientProfile);
          setShowBookModal(true);
        } else {
          showToast('Patient registered, but details update failed.', 'error');
          setShowRegisterModal(false);
        }
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.message || 'Error registering patient.', 'error');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientForBooking || !bookingForm.doctor_id || !bookingForm.appointment_date || !bookingForm.appointment_time) {
      showToast('All fields are required to schedule an appointment.', 'error');
      return;
    }
    setSubmitLoading(true);
    try {
      // Send local ISO string without 'Z' so backend treats it as clinic local time (IST)
      const dt = `${bookingForm.appointment_date}T${bookingForm.appointment_time}:00`;
      const res = await api.post('/appointments/', {
        patient_id: selectedPatientForBooking.id,
        doctor_id: bookingForm.doctor_id,
        branch_id: selectedBranchId,
        appointment_datetime: dt,
        treatment_type: bookingForm.treatment_type,
        consultation_type: bookingForm.consultation_type,
        notes: bookingForm.notes || 'Scheduled at reception desk.',
      });

      if (res.data?.success) {
        showToast('Appointment scheduled successfully!', 'success');
        setShowBookModal(false);
        setBookingForm({
          doctor_id: '',
          appointment_date: '',
          appointment_time: '',
          treatment_type: 'General Consultation',
          consultation_type: 'in_person',
          notes: '',
        });
        setSelectedPatientForBooking(null);
        await fetchPortalData();
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.message || 'Error booking appointment.', 'error');
    } finally {
      setSubmitLoading(false);
    }
  };

  const fetchPendingCharges = async (patientId: string) => {
    if (!patientId) {
      setPendingCharges(null);
      return;
    }
    setLoadingPendingCharges(true);
    try {
      const res = await api.get(`/billing/calculate-pending?patient_id=${patientId}`);
      if (res.data?.success) {
        const data = res.data.data;
        setPendingCharges(data);
        
        // Auto-select latest consultation/treatment plan/admission if available
        if (data.consultations && data.consultations.length > 0) {
          setSelectedConsultationId(data.consultations[0].id);
        } else {
          setSelectedConsultationId(null);
        }
        
        if (data.treatment_plans && data.treatment_plans.length > 0) {
          setSelectedTreatmentPlanId(data.treatment_plans[0].id);
        } else {
          setSelectedTreatmentPlanId(null);
        }

        if (data.ipd_admissions && data.ipd_admissions.length > 0) {
          setSelectedAdmissionIds([data.ipd_admissions[0].id]);
        } else {
          setSelectedAdmissionIds([]);
        }
        
        const materialsSum = data.standard_materials ? data.standard_materials.reduce((sum: number, item: any) => sum + item.cost, 0) : 0;
        setCustomMaterialsCost(materialsSum);
      }
    } catch (err) {
      console.error(err);
      showToast('Error loading pending charges.', 'error');
    } finally {
      setLoadingPendingCharges(false);
    }
  };

  useEffect(() => {
    if (billingForm.patient_id) {
      fetchPendingCharges(billingForm.patient_id);
    } else {
      setPendingCharges(null);
    }
  }, [billingForm.patient_id]);

  useEffect(() => {
    let subtotal = 0;
    let autoDepositDeduction = 0;
    if (pendingCharges) {
      if (selectedConsultationId) {
        const selectedConsultation = pendingCharges.consultations.find(c => c.id === selectedConsultationId);
        if (selectedConsultation) {
          subtotal += selectedConsultation.consultation_fee || 0;
          if (includeMedicines && selectedConsultation.prescriptions) {
            selectedConsultation.prescriptions.forEach((p: any) => {
              if (p.items) {
                p.items.forEach((item: any) => {
                  subtotal += item.total_price || 0;
                });
              }
            });
          }
        }
      }
      
      if (selectedTreatmentPlanId) {
        const selectedPlan = pendingCharges.treatment_plans.find(p => p.id === selectedTreatmentPlanId);
        if (selectedPlan && selectedPlan.procedures) {
          selectedPlan.procedures.forEach((proc: any) => {
            subtotal += proc.cost || 0;
          });
        }
      }

      if (selectedAdmissionIds.length > 0 && (pendingCharges as any).ipd_admissions) {
        selectedAdmissionIds.forEach((admId: string) => {
          const selectedAdm = (pendingCharges as any).ipd_admissions.find((a: any) => a.id === admId);
          if (selectedAdm) {
            subtotal += selectedAdm.current_bed_rent || 0;
            if (selectedAdm.past_items) {
              selectedAdm.past_items.forEach((item: any) => {
                subtotal += item.total_price || 0;
              });
            }
            autoDepositDeduction += (selectedAdm.initial_deposit || 0) + (selectedAdm.insurance_approved_amount || 0);
          }
        });
      }
      
      if (includeMaterials) {
        subtotal += Number(customMaterialsCost) || 0;
      }
    }
    setBillingForm(prev => ({
      ...prev,
      total_amount: Math.round(subtotal * 100) / 100,
      discount_amount: autoDepositDeduction > 0 ? autoDepositDeduction : prev.discount_amount
    }));
  }, [pendingCharges, selectedConsultationId, selectedTreatmentPlanId, selectedAdmissionIds, includeMedicines, includeMaterials, customMaterialsCost]);

  const fetchEditPendingCharges = async (patientId: string, invoice: any) => {
    if (!patientId || !invoice) {
      setEditPendingCharges(null);
      return;
    }
    setLoadingEditPendingCharges(true);
    try {
      const res = await api.get(`/billing/calculate-pending?patient_id=${patientId}&exclude_invoice_id=${invoice.id}`);
      if (res.data?.success) {
        const data = res.data.data;
        setEditPendingCharges(data);
        
        // Pre-select current invoice's consultation/treatment plan
        setEditSelectedConsultationId(invoice.consultation_id || null);
        setEditSelectedTreatmentPlanId(invoice.treatment_plan_id || null);
        
        // Include medicines by default
        setEditIncludeMedicines(true);
        
        const materialsSum = data.standard_materials ? data.standard_materials.reduce((sum: number, item: any) => sum + item.cost, 0) : 0;
        
        // Calculate base sum of current linked items
        let baseSum = 0;
        if (invoice.consultation_id && data.consultations) {
          const c = data.consultations.find((x: any) => x.id === invoice.consultation_id);
          if (c) {
            baseSum += c.consultation_fee || 0;
            if (c.prescriptions) {
              c.prescriptions.forEach((p: any) => {
                if (p.items) {
                  p.items.forEach((item: any) => {
                    baseSum += item.total_price || 0;
                  });
                }
              });
            }
          }
        }
        if (invoice.treatment_plan_id && data.treatment_plans) {
          const tp = data.treatment_plans.find((x: any) => x.id === invoice.treatment_plan_id);
          if (tp && tp.procedures) {
            tp.procedures.forEach((proc: any) => {
              baseSum += proc.cost || 0;
            });
          }
        }
        
        const diff = invoice.total_amount - baseSum;
        if (diff > 0) {
          setEditIncludeMaterials(true);
          setEditCustomMaterialsCost(Math.round(diff * 100) / 100);
        } else {
          setEditIncludeMaterials(false);
          setEditCustomMaterialsCost(materialsSum);
        }
      }
    } catch (err) {
      console.error(err);
      showToast('Error loading invoice charges breakdown.', 'error');
    } finally {
      setLoadingEditPendingCharges(false);
    }
  };

  useEffect(() => {
    let subtotal = 0;
    if (editPendingCharges) {
      if (editSelectedConsultationId) {
        const selectedConsultation = editPendingCharges.consultations.find(c => c.id === editSelectedConsultationId);
        if (selectedConsultation) {
          subtotal += selectedConsultation.consultation_fee || 0;
          if (editIncludeMedicines && selectedConsultation.prescriptions) {
            selectedConsultation.prescriptions.forEach((p: any) => {
              if (p.items) {
                p.items.forEach((item: any) => {
                  subtotal += item.total_price || 0;
                });
              }
            });
          }
        }
      }
      
      if (editSelectedTreatmentPlanId) {
        const selectedPlan = editPendingCharges.treatment_plans.find(p => p.id === editSelectedTreatmentPlanId);
        if (selectedPlan && selectedPlan.procedures) {
          selectedPlan.procedures.forEach((proc: any) => {
            subtotal += proc.cost || 0;
          });
        }
      }
      
      if (editIncludeMaterials) {
        subtotal += Number(editCustomMaterialsCost) || 0;
      }
    } else if (selectedInvoiceForEdit) {
      subtotal = selectedInvoiceForEdit.total_amount;
    }
    setEditBillingForm(prev => ({
      ...prev,
      total_amount: Math.round(subtotal * 100) / 100
    }));
  }, [editPendingCharges, editSelectedConsultationId, editSelectedTreatmentPlanId, editIncludeMedicines, editIncludeMaterials, editCustomMaterialsCost, selectedInvoiceForEdit]);

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billingForm.patient_id || billingForm.total_amount <= 0) {
      showToast('Please select a patient and enter a valid total amount.', 'error');
      return;
    }
    setSubmitLoading(true);
    try {
      const res = await api.post('/billing/', {
        patient_id: billingForm.patient_id,
        total_amount: Number(billingForm.total_amount),
        discount_amount: Number(billingForm.discount_amount),
        tax_amount: Number(billingForm.tax_amount),
        consultation_id: selectedConsultationId || undefined,
        treatment_plan_id: selectedTreatmentPlanId || undefined,
        admission_id: selectedAdmissionIds.length > 0 ? selectedAdmissionIds[0] : undefined,
        admission_ids: selectedAdmissionIds,
        status: 'unpaid',
      });

      if (res.data?.success) {
        showToast('Invoice generated successfully.', 'success');
        setActiveTab('invoices');
        setBillingForm({
          patient_id: '',
          total_amount: 0,
          discount_amount: 0,
          tax_amount: 0,
        });
        setSelectedConsultationId(null);
        setSelectedTreatmentPlanId(null);
        setSelectedAdmissionIds([]);
        setPendingCharges(null);
        await fetchPortalData();
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.message || 'Error generating invoice.', 'error');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleUpdateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceForEdit) return;
    setSubmitLoading(true);
    try {
      const res = await api.put(`/billing/${selectedInvoiceForEdit.id}`, {
        total_amount: Number(editBillingForm.total_amount),
        discount_amount: Number(editBillingForm.discount_amount),
        tax_amount: Number(editBillingForm.tax_amount),
        status: editBillingForm.status,
        consultation_id: editSelectedConsultationId || null,
        treatment_plan_id: editSelectedTreatmentPlanId || null,
      });

      if (res.data?.success) {
        showToast('Invoice updated successfully.', 'success');
        setShowEditBillingModal(false);
        setSelectedInvoiceForEdit(null);
        setEditPendingCharges(null);
        await fetchPortalData();
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.message || 'Error updating invoice.', 'error');
    } finally {
      setSubmitLoading(false);
    }
  };

  const fetchPatientHistoryProfile = async (patientId: string) => {
    if (!patientId) return;
    setLoadingPatientHistory(true);
    setPatientHistoryData(null);
    try {
      const res = await api.get(`/patients/${patientId}/history-profile`);
      if (res.data?.success) {
        setPatientHistoryData(res.data.data);
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.message || 'Error loading patient history profile.', 'error');
    } finally {
      setLoadingPatientHistory(false);
    }
  };

  const handleReportUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientForHistory?.id) return;
    if (!reportUploadFile) {
      showToast('Please select a report file first.', 'error');
      return;
    }

    const validation = validateMedicalFile(reportUploadFile);
    if (!validation.isValid) {
      showToast(validation.message, 'error');
      return;
    }

    setUploadingReport(true);
    const formData = new FormData();
    formData.append('file', reportUploadFile);
    formData.append('report_type', reportUploadType);
    formData.append('patient_id', selectedPatientForHistory.id);
    if (reportUploadTitle.trim()) {
      formData.append('title', reportUploadTitle.trim());
    }

    try {
      const res = await api.post('/medical-reports/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      if (res.data?.success) {
        showToast('Medical report uploaded successfully.', 'success');
        setReportUploadTitle('');
        setReportUploadType('Lab Report');
        setReportUploadFile(null);
        // Reload history to refresh the reports list
        await fetchPatientHistoryProfile(selectedPatientForHistory.id);
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.message || 'Failed to upload medical report.', 'error');
    } finally {
      setUploadingReport(false);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!selectedPatientForHistory?.id || !reportId) return;
    if (!window.confirm('Are you sure you want to delete this medical report? This action cannot be undone.')) {
      return;
    }

    setDeletingReportId(reportId);
    try {
      const res = await api.delete(`/medical-reports/${reportId}`);
      if (res.data?.success) {
        showToast('Medical report deleted successfully.', 'success');
        await fetchPatientHistoryProfile(selectedPatientForHistory.id);
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.message || 'Failed to delete medical report.', 'error');
    } finally {
      setDeletingReportId(null);
    }
  };

  // Auto-calculate 18% GST whenever edit total_amount changes
  useEffect(() => {
    const total = Number(editBillingForm.total_amount) || 0;
    const tax = Math.round(total * 0.18 * 100) / 100;
    setEditBillingForm(prev => ({
      ...prev,
      tax_amount: tax
    }));
  }, [editBillingForm.total_amount]);

  // Auto-calculate 18% GST whenever total_amount changes
  useEffect(() => {
    const total = Number(billingForm.total_amount) || 0;
    const tax = Math.round(total * 0.18 * 100) / 100;
    setBillingForm(prev => ({
      ...prev,
      tax_amount: tax
    }));
  }, [billingForm.total_amount]);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceForPayment || paymentForm.amount <= 0) {
      showToast('Please enter a valid payment amount.', 'error');
      return;
    }
    setSubmitLoading(true);
    try {
      const res = await api.post('/payments/', {
        invoice_id: selectedInvoiceForPayment.id,
        amount: Number(paymentForm.amount),
        payment_method: paymentForm.payment_method,
        transaction_reference: paymentForm.transaction_reference || null,
      });

      if (res.data?.success) {
        showToast('Payment recorded successfully! Balance updated.', 'success');
        setShowPaymentModal(false);
        setSelectedInvoiceForPayment(null);
        setPaymentForm({
          amount: 0,
          payment_method: 'cash',
          transaction_reference: '',
        });
        await fetchPortalData();
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.message || 'Error recording payment.', 'error');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDownloadPDF = async (invoiceId: string, invoiceNumber: string) => {
    try {
      const response = await api.get(`/billing/${invoiceId}/pdf`, {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoice_${invoiceNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast('PDF Receipt downloaded.', 'success');
    } catch (error) {
      console.error(error);
      showToast('Failed to download invoice PDF.', 'error');
    }
  };

  const handleSendInvoiceEmail = async (invoiceId: string, invoiceNumber: string) => {
    setSendingEmailStatus(true);
    try {
      const res = await api.post(`/billing/${invoiceId}/send-email`);
      if (res.data?.success) {
        showToast(`Invoice ${invoiceNumber} emailed successfully!`, 'success');
      } else {
        showToast(res.data?.message || 'Failed to send invoice email.', 'error');
      }
    } catch (error: any) {
      console.error(error);
      const errMsg = error.response?.data?.message || 'Failed to send invoice email.';
      showToast(errMsg, 'error');
    } finally {
      setSendingEmailStatus(false);
    }
  };

  // Searching patient records
  const searchPatients = async () => {
    if (!patientSearchQuery.trim()) {
      await fetchPortalData();
      return;
    }
    setLoading(true);
    try {
      const res = await api.get(`/patients/?search=${patientSearchQuery}`);
      if (res.data?.success) {
        setPatients(res.data.data.items || []);
      }
    } catch (err) {
      console.error(err);
      showToast('Error searching patients.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Queue Kanban filters
  const today = getLocalTodayDate();
  const scheduledToday = appointments.filter((a) => {
    const datePart = getLocalApptDate(a.appointment_datetime);
    return datePart === today && (a.status === 'pending' || a.status === 'confirmed');
  });

  const waitingToday = appointments.filter((a) => {
    const datePart = getLocalApptDate(a.appointment_datetime);
    return datePart === today && (a.status === 'checked_in' || a.status === 'Waiting');
  });

  const activeConsultation = appointments.filter((a) => {
    const datePart = getLocalApptDate(a.appointment_datetime);
    return datePart === today && (a.status === 'in_consultation' || a.status === 'In Consultation');
  });

  const completedToday = appointments.filter((a) => {
    const datePart = getLocalApptDate(a.appointment_datetime);
    return datePart === today && a.status === 'completed';
  });

  // Calendar Filter
  const calendarAppointments = appointments.filter((a) => {
    const datePart = getLocalApptDate(a.appointment_datetime);
    return datePart === calendarDate;
  });

  // Billing Filters
  const filteredInvoices = invoices.filter((inv) => {
    const name = inv.patient?.user?.full_name || '';
    const code = inv.patient?.patient_code || '';
    const num = inv.invoice_number || '';
    const query = billingSearchQuery.toLowerCase();
    return (
      name.toLowerCase().includes(query) ||
      code.toLowerCase().includes(query) ||
      num.toLowerCase().includes(query)
    );
  });

  // Check-In Filters
  const checkInFilteredAppointments = appointments
    .filter((a) => {
      const datePart = getLocalApptDate(a.appointment_datetime);
      const isToday = datePart === today && a.status !== 'cancelled' && a.status !== 'rejected';
      if (!isToday) return false;
      
      const name = a.patient?.user?.full_name || '';
      const code = a.patient?.patient_code || '';
      const phone = a.patient?.user?.phone || '';
      const query = checkInSearchQuery.toLowerCase();
      return (
        name.toLowerCase().includes(query) ||
        code.toLowerCase().includes(query) ||
        phone.toLowerCase().includes(query)
      );
    })
    // Latest appointment at top, oldest at bottom
    .sort((a, b) => new Date(b.appointment_datetime).getTime() - new Date(a.appointment_datetime).getTime());

  // Calculate high-level KPIs for dashboard
  const billingRevenueToday = invoices
    .filter(inv => getLocalApptDate(inv.created_at) === today && inv.status === 'paid')
    .reduce((sum, inv) => sum + inv.grand_total, 0);



  return (
    <div className="recep-layout">
      {/* Toast Notification */}
      {toast && (
        <div className={`recep-toast ${toast.type}`}>
          {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Sidebar */}
      <aside className="recep-sidebar">
        <div className="recep-sidebar-header">
          <div className="recep-logo-badge">R</div>
          <div className="recep-clinic-info">
            <span className="recep-clinic-name">Vertical Clinic</span>
            <span className="recep-clinic-sub">FRONT DESK OS</span>
          </div>
        </div>

        <div className="recep-sidebar-pill">Receptionist Portal</div>

        <nav className="recep-sidebar-nav">
          <div className="recep-nav-group-label">Daily Workflow</div>
          {[
            { id: 'dashboard', icon: <Home size={18} />, label: 'Dashboard' },
            { id: 'calendar', icon: <Calendar size={18} />, label: 'Appointment Calendar' },
            { id: 'queue', icon: <Clock size={18} />, label: 'Queue Board' },
            { id: 'checkin', icon: <UserCheck size={18} />, label: 'Check-In' },
            { id: 'patients', icon: <Users size={18} />, label: 'Patient Intake' },
            { id: 'billing', icon: <IndianRupee size={18} />, label: 'Billing' },
            { id: 'invoices', icon: <FileText size={18} />, label: 'Invoices' },
            { id: 'beds', icon: <Bed size={18} />, label: 'Bed Management' },
            { id: 'availability', icon: <Calendar size={18} />, label: 'Availability' },
          ].map(tab => (
            <div 
              key={tab.id} 
              className={`recep-nav-item ${activeTab === tab.id ? 'active' : ''}`} 
              onClick={() => handleRootTabChange(tab.id)}
            >
              {tab.icon} {tab.label}
            </div>
          ))}
        </nav>

        <div className="recep-sidebar-footer">
          <button className="recep-btn-switch" onClick={onLogout}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <main className="recep-main">
        {/* Topbar */}
        <header className="recep-topbar">
          <div className="recep-title-area" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '14px' }}>
            {tabHistory.length > 0 && (
              <button 
                onClick={goBackTab} 
                className="recep-back-btn" 
                title="Go Back"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div>
              <h2 className="recep-page-title" style={{ margin: 0 }}>
                {activeTab === 'dashboard' && 'Daily Dashboard'}
                {activeTab === 'calendar' && 'Appointment Calendar'}
                {activeTab === 'queue' && 'Real-time Queue Manager'}
                {activeTab === 'checkin' && 'Patient Check-In'}
                {activeTab === 'patients' && 'Patient Directory & Intake'}
                {activeTab === 'billing' && 'Create Clinic Bill'}
                {activeTab === 'invoices' && 'Invoices & Payments'}
                {activeTab === 'beds' && 'IPD Bed Management'}
                {activeTab === 'availability' && 'Availability & Leave Settings'}
              </h2>
              <span className="recep-page-subtitle" style={{ marginTop: '2px', display: 'block' }}>
                Managing operations for front desk staff
              </span>
            </div>
          </div>

          {/* Global Patient EMR Search Bar */}
          <div ref={globalSearchRef} style={{ flex: 1, maxWidth: '380px', margin: '0 24px', position: 'relative' }}>
            <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} size={16} />
            <input 
              type="text" 
              className="recep-input-field" 
              style={{ paddingLeft: '38px', height: '38px', width: '100%', borderRadius: '10px', fontSize: '0.85rem', margin: 0 }} 
              placeholder="Search patient by name, phone, code..." 
              value={globalSearchQuery}
              onChange={(e) => handleGlobalSearch(e.target.value)}
              onFocus={() => { if (globalSearchQuery.trim()) setIsGlobalSearchDropdownOpen(true); }}
            />
            {isGlobalSearchDropdownOpen && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                right: 0,
                backgroundColor: '#ffffff',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)',
                zIndex: 999,
                maxHeight: '320px',
                overflowY: 'auto',
                padding: '6px 0'
              }}>
                {globalSearchResults.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--muted)' }}>
                    No matching patient records found.
                  </div>
                ) : (
                  globalSearchResults.map((pat: any) => (
                    <div 
                      key={pat.id} 
                      onClick={() => handleSelectGlobalPatient(pat)}
                      style={{
                        padding: '10px 16px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        borderBottom: '1px solid var(--surface-2)',
                        textAlign: 'left'
                      }}
                      className="global-search-item"
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                          {pat.user?.full_name || pat.name || 'Walk-in Patient'}
                        </span>
                        <span style={{ fontSize: '0.75rem', background: 'var(--primary-light)', color: 'var(--primary)', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                          {pat.patient_code}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '12px', fontSize: '0.78rem', color: 'var(--muted)' }}>
                        <span>Phone: {pat.user?.phone || '—'}</span>
                        <span>Gender: {pat.gender || '—'}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="recep-topbar-right" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div className="notifications-wrapper" ref={notiDropdownRef} style={{ position: 'relative' }}>
              <button 
                onClick={() => setIsNotiDropdownOpen(!isNotiDropdownOpen)}
                style={{ border: 'none', background: 'none', position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px' }}
              >
                <Bell size={20} color="#64748b" />
                {notifications.filter(n => !n.is_read).length > 0 && (
                  <span style={{ position: 'absolute', top: '2px', right: '2px', width: '8px', height: '8px', backgroundColor: '#ef4444', borderRadius: '50%' }} />
                )}
              </button>

              {isNotiDropdownOpen && (
                <div className="notifications-dropdown" style={{
                  position: 'absolute',
                  top: 'calc(100% + 10px)',
                  right: 0,
                  width: '320px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                  zIndex: 200,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <div className="notifications-header" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderBottom: '1px solid #f1f5f9'
                  }}>
                    <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: '#1e293b' }}>Notifications</h4>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {notifications.filter(n => !n.is_read).length > 0 && (
                        <button 
                          className="notifications-clear-btn" 
                          onClick={() => { handleMarkAllNotificationsRead(); }}
                          style={{ background: 'none', border: 'none', fontSize: '0.75rem', color: 'var(--primary-teal, #0c6e8c)', cursor: 'pointer', fontWeight: 500 }}
                        >
                          Mark all read
                        </button>
                      )}
                      {notifications.length > 0 && (
                        <button 
                          className="notifications-clear-btn" 
                          onClick={() => { handleClearAllNotifications(); setIsNotiDropdownOpen(false); }}
                          style={{ background: 'none', border: 'none', fontSize: '0.75rem', color: '#d9534f', cursor: 'pointer', fontWeight: 500 }}
                        >
                          Clear all
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="notifications-list" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {notifications.length === 0 ? (
                      <div className="notifications-empty" style={{ padding: '24px', textAlign: 'center', fontSize: '0.85rem', color: '#64748b' }}>
                        No notifications yet.
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div
                          key={n.id}
                          className={`notification-item ${!n.is_read ? 'unread' : ''}`}
                          onClick={() => {
                            if (!n.is_read) {
                              handleMarkNotificationRead(n.id);
                            }
                          }}
                          style={{
                            padding: '12px 16px',
                            borderBottom: '1px solid #f1f5f9',
                            cursor: 'pointer',
                            backgroundColor: n.is_read ? 'transparent' : 'rgba(12, 110, 140, 0.03)',
                            transition: 'background-color 0.2s',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px'
                          }}
                        >
                          <div className="notification-item-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: n.is_read ? 500 : 600, color: '#1e293b' }}>{n.title}</span>
                            {!n.is_read && <span className="notification-unread-dot" style={{ width: '6px', height: '6px', backgroundColor: '#3b82f6', borderRadius: '50%' }} />}
                          </div>
                          <div className="notification-item-msg" style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.4 }}>{n.message}</div>
                          <div className="notification-item-time" style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '4px' }}>{formatRelativeTime(n.created_at)}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="profile-dropdown-wrapper" ref={profileDropdownRef}>
              <div 
                className="recep-profile-badge" 
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                style={{ cursor: 'pointer' }}
              >
                <div className="recep-profile-avatar">
                  {currentUser?.full_name?.slice(0, 2).toUpperCase() || 'RE'}
                </div>
                <div className="recep-profile-info">
                  <span className="recep-profile-name">{currentUser?.full_name || 'Front Desk Staff'}</span>
                  <span className="recep-profile-role">Receptionist</span>
                </div>
              </div>

              {isProfileDropdownOpen && (
                <div className="profile-dropdown-menu">
                  <button onClick={() => { handleRootTabChange('availability'); setIsProfileDropdownOpen(false); }}>
                    <Settings size={14} style={{ color: 'var(--primary-teal, #0c6e8c)' }} /> Availability
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

        {/* Content Wrapper */}
        <div className="recep-content">
          {loading ? (
            <div className="recep-loading-state">
              <Loader2 size={36} className="spin-icon" />
              <span>Fetching Clinic Records...</span>
            </div>
          ) : (
            <>
              {/* DASHBOARD TAB */}
              {activeTab === 'dashboard' && (
                <RecepDashboardTab
                  appointments={appointments}
                  waitingToday={waitingToday}
                  doctors={doctors}
                  billingRevenueToday={billingRevenueToday}
                  invoices={invoices}
                  today={today}
                  getLocalApptDate={getLocalApptDate}
                  getLocalApptTime={getLocalApptTime}
                  formatDocName={formatDocName}
                  setShowBookModal={setShowBookModal}
                  handleCheckIn={handleCheckIn}
                />
              )}

              {/* CALENDAR TAB */}
              {activeTab === 'calendar' && (
                <RecepAppointmentsTab
                  calendarDate={calendarDate}
                  setCalendarDate={setCalendarDate}
                  selectedCalendarAppt={selectedCalendarAppt}
                  setSelectedCalendarAppt={setSelectedCalendarAppt}
                  calendarAppointments={calendarAppointments}
                  setShowBookModal={setShowBookModal}
                  doctors={doctors}
                  selectedBranchId={selectedBranchId}
                  formatDocName={formatDocName}
                  getLocalApptTime={getLocalApptTime}
                  getLocalApptDate={getLocalApptDate}
                  appointments={appointments}
                  rescheduleApptId={rescheduleApptId}
                  setRescheduleApptId={setRescheduleApptId}
                  rescheduleDate={rescheduleDate}
                  setRescheduleDate={setRescheduleDate}
                  rescheduleTime={rescheduleTime}
                  setRescheduleTime={setRescheduleTime}
                  rescheduleConsultationType={rescheduleConsultationType}
                  setRescheduleConsultationType={setRescheduleConsultationType}
                  isCustomTimeReschedule={isCustomTimeReschedule}
                  setIsCustomTimeReschedule={setIsCustomTimeReschedule}
                  loadingRescheduleSlots={loadingRescheduleSlots}
                  rescheduleSlots={rescheduleSlots}
                  handleRescheduleSubmit={handleRescheduleSubmit}
                  handleCheckIn={handleCheckIn}
                  handleCancel={handleCancel}
                  setBillingForm={setBillingForm}
                  setActiveTab={setActiveTab}
                  setSelectedApptDetails={setSelectedApptDetails}
                  getLocalTodayDate={getLocalTodayDate}
                />
              )}

              {/* QUEUE TAB (Kanban Board) */}
              {activeTab === 'queue' && (
                <RecepQueueTab
                  scheduledToday={scheduledToday}
                  waitingToday={waitingToday}
                  activeConsultation={activeConsultation}
                  completedToday={completedToday}
                  getLocalApptTime={getLocalApptTime}
                  formatDocName={formatDocName}
                  setSelectedApptDetails={setSelectedApptDetails}
                  handleCheckIn={handleCheckIn}
                  setBillingForm={setBillingForm}
                  setActiveTab={setActiveTab}
                />
              )}

              {/* PATIENTS TAB */}
              {activeTab === 'patients' && (
                <RecepPatientsTab
                  patientSearchQuery={patientSearchQuery}
                  setPatientSearchQuery={setPatientSearchQuery}
                  searchPatients={searchPatients}
                  patients={patients}
                  setShowRegisterModal={setShowRegisterModal}
                  setSelectedPatientForHistory={setSelectedPatientForHistory}
                  fetchPatientHistoryProfile={fetchPatientHistoryProfile}
                  setIsEditingPatientProfile={setIsEditingPatientProfile}
                  setShowPatientHistoryModal={setShowPatientHistoryModal}
                />
              )}

              {/* BILLING TAB (Create Bill) */}
              {activeTab === 'billing' && (
                <RecepBillingTab
                  handleCreateInvoice={handleCreateInvoice}
                  billingForm={billingForm}
                  setBillingForm={setBillingForm}
                  patients={patients}
                  loadingPendingCharges={loadingPendingCharges}
                  pendingCharges={pendingCharges}
                  selectedConsultationId={selectedConsultationId}
                  setSelectedConsultationId={setSelectedConsultationId}
                  includeMedicines={includeMedicines}
                  setIncludeMedicines={setIncludeMedicines}
                  selectedTreatmentPlanId={selectedTreatmentPlanId}
                  setSelectedTreatmentPlanId={setSelectedTreatmentPlanId}
                  selectedAdmissionIds={selectedAdmissionIds}
                  setSelectedAdmissionIds={setSelectedAdmissionIds}
                  includeMaterials={includeMaterials}
                  setIncludeMaterials={setIncludeMaterials}
                  customMaterialsCost={customMaterialsCost}
                  setCustomMaterialsCost={setCustomMaterialsCost}
                  submitLoading={submitLoading}
                  currentUser={currentUser}
                  formatDocName={formatDocName}
                />
              )}

              {/* INVOICES TAB */}
              {activeTab === 'invoices' && (
                <RecepInvoicesTab
                  billingSearchQuery={billingSearchQuery}
                  setBillingSearchQuery={setBillingSearchQuery}
                  invoices={invoices}
                  setBillingForm={setBillingForm}
                  setActiveTab={setActiveTab}
                  filteredInvoices={filteredInvoices}
                  getInvoiceEffectiveStatus={getInvoiceEffectiveStatus}
                  setSelectedInvoiceForPreview={setSelectedInvoiceForPreview}
                  setShowInvoicePreviewModal={setShowInvoicePreviewModal}
                  setSelectedInvoiceForPayment={setSelectedInvoiceForPayment}
                  setPaymentForm={setPaymentForm}
                  setShowPaymentModal={setShowPaymentModal}
                />
              )}

              {/* CHECK-IN TAB */}
              {activeTab === 'checkin' && (
                <RecepCheckInTab
                  checkInSearchQuery={checkInSearchQuery}
                  setCheckInSearchQuery={setCheckInSearchQuery}
                  appointments={appointments}
                  getLocalApptDate={getLocalApptDate}
                  today={today}
                  checkInFilteredAppointments={checkInFilteredAppointments}
                  selectedApptForCheckIn={selectedApptForCheckIn}
                  setSelectedApptForCheckIn={setSelectedApptForCheckIn}
                  getLocalApptTime={getLocalApptTime}
                  handleCheckIn={handleCheckIn}
                  formatDocName={formatDocName}
                />
              )}

              {/* IPD BED MANAGEMENT WORKSPACE */}
              {activeTab === 'beds' && (
                <RecepBedsTab
                  bedSubTab={bedSubTab}
                  setBedSubTab={setBedSubTab}
                  fetchAdmissionHistory={fetchAdmissionHistory}
                  isLoadingHistory={isLoadingHistory}
                  fetchBedsData={fetchBedsData}
                  isLoadingBeds={isLoadingBeds}
                  pendingAdmissionRequests={pendingAdmissionRequests}
                  setActiveAdmissionRequestId={setActiveAdmissionRequestId}
                  setAdmitForm={setAdmitForm}
                  bedsData={bedsData}
                  setSelectedBed={setSelectedBed}
                  setIsAdmitModalOpen={setIsAdmitModalOpen}
                  bedsError={bedsError}
                  historySearchQuery={historySearchQuery}
                  setHistorySearchQuery={setHistorySearchQuery}
                  admissionHistory={admissionHistory}
                  fetchHistoryDetails={fetchHistoryDetails}
                  handleCleanBed={handleCleanBed}
                  setIsVitalsModalOpen={setIsVitalsModalOpen}
                  fetchClinicalRecords={fetchClinicalRecords}
                  setIsMacModalOpen={setIsMacModalOpen}
                  setIsTransferModalOpen={setIsTransferModalOpen}
                  setIsCheckoutModalOpen={setIsCheckoutModalOpen}
                  fetchCheckoutBill={fetchCheckoutBill}
                />
              )}

              {/* TAB: AVAILABILITY SETTINGS MANAGER */}
              {activeTab === 'availability' && (
                <RecepAvailabilityTab
                  setIsRequestingChange={setIsRequestingChange}
                  branches={branches}
                  selectedBranchId={selectedBranchId}
                  myRequests={myRequests}
                />
              )}
            </>
          )}
        </div>
      </main>

      {/* Leave Request Modal */}
      {isRequestingChange && (
        <div className="recep-modal-overlay">
          <div className="recep-modal-content">
            <div className="recep-modal-header">
              <h3>Request Leave</h3>
              <button className="close-btn" onClick={() => setIsRequestingChange(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmitChangeRequest}>
              <div className="recep-form-grid">
                <div className="form-group">
                  <label>Start Date</label>
                  <CustomDatePicker 
                    value={reqStartDate}
                    onChange={setReqStartDate}
                  />
                </div>
                <div className="form-group">
                  <label>End Date</label>
                  <CustomDatePicker 
                    value={reqEndDate}
                    onChange={setReqEndDate}
                  />
                </div>
                <div className="form-group full-width">
                  <label>Reason for leave</label>
                  <textarea 
                    required
                    rows={4}
                    value={reqReason}
                    onChange={(e) => setReqReason(e.target.value)}
                    placeholder="Provide details about your leave request..."
                  />
                </div>
              </div>
              <div className="recep-modal-actions">
                <button 
                  type="button" 
                  className="btn-cancel"
                  onClick={() => setIsRequestingChange(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-submit"
                  disabled={submittingRequest}
                >
                  {submittingRequest ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Register Patient */}
      {showRegisterModal && (
        <div className="recep-modal-overlay">
          <div className="recep-modal-content">
            <div className="recep-modal-header">
              <h3>Patient Front-Desk Registration</h3>
              <button className="close-btn" onClick={() => setShowRegisterModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleRegisterPatient}>
              <div className="recep-form-grid">
                <div className="form-group">
                  <label>Full Name *</label>
                  <input 
                    type="text" 
                    required 
                    value={registerForm.full_name} 
                    onChange={e => setRegisterForm({ ...registerForm, full_name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Email Address *</label>
                  <input 
                    type="email" 
                    required 
                    value={registerForm.email} 
                    onChange={e => setRegisterForm({ ...registerForm, email: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Phone Number *</label>
                  <input 
                    type="text" 
                    required 
                    value={registerForm.phone} 
                    onChange={e => setRegisterForm({ ...registerForm, phone: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Temporary Password</label>
                  <input 
                    type="text" 
                    value={registerForm.password} 
                    onChange={e => setRegisterForm({ ...registerForm, password: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Date of Birth</label>
                  <CustomDatePicker 
                    value={registerForm.date_of_birth} 
                    onChange={date => setRegisterForm({ ...registerForm, date_of_birth: date })}
                  />
                </div>
                <div className="form-group">
                  <label>Gender</label>
                  <select 
                    value={registerForm.gender} 
                    onChange={e => setRegisterForm({ ...registerForm, gender: e.target.value })}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="form-group full-width">
                  <label>Residential Address</label>
                  <textarea 
                    value={registerForm.address} 
                    onChange={e => setRegisterForm({ ...registerForm, address: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Emergency Contact Name</label>
                  <input 
                    type="text" 
                    value={registerForm.emergency_contact_name} 
                    onChange={e => setRegisterForm({ ...registerForm, emergency_contact_name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Emergency Contact Phone</label>
                  <input 
                    type="text" 
                    value={registerForm.emergency_contact_phone} 
                    onChange={e => setRegisterForm({ ...registerForm, emergency_contact_phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="recep-modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowRegisterModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={submitLoading}>
                  {submitLoading ? <Loader2 size={16} className="spin-icon" /> : 'Register & Activate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Book Appointment */}
      {showBookModal && (
        <div className="recep-modal-overlay">
          <div className="recep-modal-content">
            <div className="recep-modal-header">
              <h3>Schedule Appointment</h3>
              <button className="close-btn" onClick={() => setShowBookModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleBookAppointment}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--ink-2)', marginBottom: '6px', display: 'block' }}>Patient *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    required
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      fontSize: '0.88rem',
                      outline: 'none',
                      backgroundColor: 'var(--surface-2)',
                      color: 'var(--ink-2)',
                      cursor: 'pointer'
                    }}
                    value={selectedPatientForBooking?.id || ''}
                    onChange={e => {
                      const selectedId = e.target.value;
                      const found = patients.find(p => p.id === selectedId);
                      setSelectedPatientForBooking(found || null);
                    }}
                  >
                    <option value="">-- Select Patient --</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.user?.full_name} ({p.patient_code}) &middot; {p.user?.phone || 'No Phone'}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="recep-btn-primary"
                    style={{
                      padding: '0 16px',
                      height: '42px',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      backgroundColor: 'var(--accent)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                    onClick={() => {
                      setShowBookModal(false);
                      setShowRegisterModal(true);
                    }}
                  >
                    <Plus size={16} /> New Patient
                  </button>
                </div>
              </div>

              <div className="recep-form-grid">
                <div className="form-group">
                  <label>Doctor *</label>
                  <select 
                    required
                    value={bookingForm.doctor_id} 
                    onChange={e => setBookingForm({ ...bookingForm, doctor_id: e.target.value })}
                  >
                    <option value="">Select Doctor</option>
                    {doctors.filter(d => d.branch_id === selectedBranchId).map(doc => (
                      <option key={doc.id} value={doc.id}>
                        {formatDocName(doc.user?.full_name)} ({doc.specialization})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Consultation Type</label>
                  <select 
                    value={bookingForm.consultation_type} 
                    onChange={e => setBookingForm({ ...bookingForm, consultation_type: e.target.value })}
                  >
                    <option value="in_person">In Clinic</option>
                    <option value="teleconsultation">Teleconsultation</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Date *</label>
                  <CustomDatePicker 
                    value={bookingForm.appointment_date} 
                    onChange={date => setBookingForm({ ...bookingForm, appointment_date: date })}
                  />
                </div>

                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ margin: 0 }}>Available Slots *</label>
                    <button
                      type="button"
                      onClick={() => setIsCustomTimeBooking(!isCustomTimeBooking)}
                      style={{ background: 'none', border: 'none', color: '#0d9488', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', padding: 0 }}
                    >
                      {isCustomTimeBooking ? 'Select from list' : '✍️ Custom Time'}
                    </button>
                  </div>
                  {isCustomTimeBooking ? (
                    <input 
                      type="time"
                      required
                      value={bookingForm.appointment_time} 
                      onChange={e => setBookingForm({ ...bookingForm, appointment_time: e.target.value })}
                      style={{ width: '100%', padding: '6px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.85rem' }}
                    />
                  ) : (
                    <select 
                      required
                      disabled={loadingSlots || !bookingForm.doctor_id || !bookingForm.appointment_date}
                      value={bookingForm.appointment_time} 
                      onChange={e => setBookingForm({ ...bookingForm, appointment_time: e.target.value })}
                    >
                      <option value="">{loadingSlots ? 'Calculating...' : 'Select Slot'}</option>
                      {availableSlots
                        .map((slot: any) => {
                          let label = formatTimeToAMPM(slot.time);
                          const isExpired = slot.status === 'expired';
                          if (slot.status === 'booked') {
                            label += ' (Booked)';
                          } else if (isExpired) {
                            label += ' (Expired)';
                          } else if (slot.status === 'lunch_break') {
                            label += ' (Lunch Break)';
                          } else if (slot.status === 'tele_only') {
                            label += ' (Tele Only)';
                          } else if (slot.status === 'in_clinic_only') {
                            label += ' (In-Clinic Only)';
                          }
                          const isTypeMismatch = (bookingForm.consultation_type === 'in_person' && slot.status === 'tele_only') ||
                                                 (bookingForm.consultation_type === 'teleconsultation' && slot.status === 'in_clinic_only');
                          const isDisabled = isExpired || slot.status === 'booked' || slot.status === 'lunch_break' || isTypeMismatch;
                          return (
                            <option key={slot.time} value={slot.time} disabled={isDisabled}>
                              {label}
                            </option>
                          );
                        })}
                    </select>
                  )}
                </div>

                <div className="form-group">
                  <label>Treatment Type</label>
                  <input 
                    type="text" 
                    value={bookingForm.treatment_type} 
                    onChange={e => setBookingForm({ ...bookingForm, treatment_type: e.target.value })}
                  />
                </div>

                <div className="form-group full-width">
                  <label>Front Desk Notes</label>
                  <textarea 
                    placeholder="E.g., Walk-in, patient complaining of fever/headache."
                    value={bookingForm.notes} 
                    onChange={e => setBookingForm({ ...bookingForm, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="recep-modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowBookModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={submitLoading || loadingSlots}>
                  {submitLoading ? <Loader2 size={16} className="spin-icon" /> : 'Confirm Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}



      {/* MODAL: Record Payment */}
      {showPaymentModal && (
        <div className="recep-modal-overlay">
          <div className="recep-modal-content">
            <div className="recep-modal-header">
              <h3>Record Transaction Payment</h3>
              <button className="close-btn" onClick={() => setShowPaymentModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleRecordPayment}>
              <div className="booking-patient-badge">
                <IndianRupee size={16} />
                <span>Invoice: <strong>{selectedInvoiceForPayment?.invoice_number}</strong> | Balance Due: <strong>₹{selectedInvoiceForPayment?.balance_due.toFixed(2)}</strong></span>
              </div>

              <div className="recep-form-grid">
                <div className="form-group">
                  <label>Amount Recieved (₹) *</label>
                  <input 
                    type="number" 
                    required 
                    min="0.01" 
                    max={selectedInvoiceForPayment?.balance_due}
                    step="0.01"
                    value={paymentForm.amount || ''} 
                    onChange={e => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })}
                  />
                </div>

                <div className="form-group">
                  <label>Payment Method *</label>
                  <select 
                    value={paymentForm.payment_method} 
                    onChange={e => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Card Swipe</option>
                    <option value="online_upi">Online UPI</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                </div>

                <div className="form-group full-width">
                  <label>Transaction Reference Number (UTR / Card Slip)</label>
                  <input 
                    type="text" 
                    placeholder="E.g., UTR19284092"
                    value={paymentForm.transaction_reference} 
                    onChange={e => setPaymentForm({ ...paymentForm, transaction_reference: e.target.value })}
                  />
                </div>
              </div>

              <div className="recep-modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowPaymentModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={submitLoading}>
                  {submitLoading ? <Loader2 size={16} className="spin-icon" /> : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit Bill / Invoice */}
      {showEditBillingModal && (
        <div className="recep-modal-overlay">
          <div className="recep-modal-content">
            <div className="recep-modal-header">
              <h3>Edit Invoice: {selectedInvoiceForEdit?.invoice_number}</h3>
              <button className="close-btn" onClick={() => setShowEditBillingModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleUpdateInvoice}>
              <div className="booking-patient-badge">
                <FileText size={16} />
                <span>Patient: <strong>{selectedInvoiceForEdit?.patient?.user?.full_name}</strong> ({selectedInvoiceForEdit?.patient?.patient_code})</span>
              </div>

              {loadingEditPendingCharges && (
                <div className="form-help-text" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '1rem 0', fontSize: '0.85rem', color: 'var(--muted)' }}>
                  <Loader2 size={16} className="spin-icon" /> Loading clinical charges breakdown...
                </div>
              )}

              {editPendingCharges && (
                <div className="pending-charges-section" style={{ margin: '1rem 0', padding: '1rem', background: 'var(--surface-2)', borderRadius: '8px' }}>
                  <h4 style={{ margin: '0 0 1rem 0', color: 'var(--primary-dark)', fontSize: '0.95rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                    Clinical Breakdown
                  </h4>

                  {/* 1. Consultations selection */}
                  {editPendingCharges.consultations && editPendingCharges.consultations.length > 0 ? (
                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--ink-2)' }}>Select Consultation to Bill</label>
                      <select
                        className="recep-select-field"
                        style={{ padding: '8px 12px', fontSize: '0.88rem', width: '100%', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--surface-2)' }}
                        value={editSelectedConsultationId || ''}
                        onChange={(e) => setEditSelectedConsultationId(e.target.value || null)}
                      >
                        <option value="">-- Do Not Bill Consultation --</option>
                        {editPendingCharges.consultations.map((c: any) => (
                          <option key={c.id} value={c.id}>
                            {formatDocName(c.doctor_name)} ({new Date(c.consultation_datetime).toLocaleDateString()}) - Fee: ₹{c.consultation_fee}
                          </option>
                        ))}
                      </select>
                      
                      {/* 2. Medicines checkbox */}
                      {editSelectedConsultationId && editPendingCharges.consultations.find(c => c.id === editSelectedConsultationId)?.prescriptions?.some((p: any) => p.items?.length > 0) && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--ink-2)' }}>
                          <input
                            type="checkbox"
                            className="recep-checkbox"
                            checked={editIncludeMedicines}
                            onChange={(e) => setEditIncludeMedicines(e.target.checked)}
                          />
                          Include Dispensed Prescriptions/Medicines (₹{
                            editPendingCharges.consultations.find(c => c.id === editSelectedConsultationId)?.prescriptions?.reduce((sum: number, p: any) => 
                              sum + (p.items?.reduce((pSum: number, item: any) => pSum + (item.total_price || 0), 0) || 0)
                            , 0).toFixed(2)
                          })
                        </label>
                      )}
                    </div>
                  ) : (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>No unbilled consultations found.</p>
                  )}

                  {/* 3. Treatment plan selection */}
                  {editPendingCharges.treatment_plans && editPendingCharges.treatment_plans.length > 0 ? (
                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--ink-2)' }}>Select Treatment Plan / Procedures</label>
                      <select
                        className="recep-select-field"
                        style={{ padding: '8px 12px', fontSize: '0.88rem', width: '100%', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--surface-2)' }}
                        value={editSelectedTreatmentPlanId || ''}
                        onChange={(e) => setEditSelectedTreatmentPlanId(e.target.value || null)}
                      >
                        <option value="">-- Do Not Bill Treatment Plan --</option>
                        {editPendingCharges.treatment_plans.map((p: any) => (
                          <option key={p.id} value={p.id}>
                            {p.title} ({p.procedures?.length} procedures) - Cost: ₹{p.procedures?.reduce((sum: number, proc: any) => sum + proc.cost, 0)}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>No active/unbilled treatment plans found.</p>
                  )}

                  {/* 4. Used Materials & Consumables */}
                  <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: 'var(--ink-2)' }}>
                      <input
                        type="checkbox"
                        className="recep-checkbox"
                        checked={editIncludeMaterials}
                        onChange={(e) => setEditIncludeMaterials(e.target.checked)}
                      />
                      Include Used Clinical Things / Materials (₹)
                    </label>
                    {editIncludeMaterials && (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        style={{ marginTop: '0.5rem', padding: '8px 12px', fontSize: '0.88rem', width: '100%', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--surface-2)' }}
                        value={editCustomMaterialsCost}
                        onChange={(e) => setEditCustomMaterialsCost(parseFloat(e.target.value) || 0)}
                        placeholder="Enter materials cost"
                      />
                    )}
                  </div>
                </div>
              )}

              <div className="recep-form-grid">
                <div className="form-group">
                  <label>Subtotal / Base Amount (₹) *</label>
                  <input 
                    type="number" 
                    required 
                    readOnly
                    min="0"
                    step="0.01"
                    value={editBillingForm.total_amount || 0} 
                    style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed' }}
                  />
                </div>

                <div className="form-group">
                  <label>Discount Amount (₹)</label>
                  <input 
                    type="number" 
                    min="0"
                    step="0.01"
                    value={editBillingForm.discount_amount} 
                    onChange={e => setEditBillingForm({ ...editBillingForm, discount_amount: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                <div className="form-group">
                  <label>GST / Tax Amount (₹)</label>
                  <input 
                    type="number" 
                    min="0"
                    step="0.01"
                    value={editBillingForm.tax_amount} 
                    onChange={e => setEditBillingForm({ ...editBillingForm, tax_amount: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                <div className="form-group">
                  <label>Status *</label>
                  <select 
                    value={editBillingForm.status} 
                    onChange={e => setEditBillingForm({ ...editBillingForm, status: e.target.value })}
                  >
                    <option value="unpaid">Unpaid</option>
                    <option value="partially_paid">Partial</option>
                    <option value="paid">Paid</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <div className="billing-summary-badge full-width" style={{ gridColumn: 'span 2', marginTop: '10px' }}>
                  <span>Grand Total (Auto-calculated):</span>
                  <strong>₹{Math.max(0, editBillingForm.total_amount - editBillingForm.discount_amount + editBillingForm.tax_amount).toFixed(2)}</strong>
                </div>

                <div className="billing-summary-badge full-width" style={{ gridColumn: 'span 2', background: 'var(--surface-2)' }}>
                  <span>Amount Already Paid:</span>
                  <strong>₹{selectedInvoiceForEdit?.amount_paid.toFixed(2)}</strong>
                </div>

                <div className="billing-summary-badge full-width" style={{ gridColumn: 'span 2', border: '1px solid var(--border)' }}>
                  <span>Balance Due:</span>
                  <strong style={{ color: Math.max(0, (editBillingForm.total_amount - editBillingForm.discount_amount + editBillingForm.tax_amount) - (selectedInvoiceForEdit?.amount_paid || 0)) > 0 ? 'var(--danger)' : 'var(--success)' }}>
                    ₹{Math.max(0, (editBillingForm.total_amount - editBillingForm.discount_amount + editBillingForm.tax_amount) - (selectedInvoiceForEdit?.amount_paid || 0)).toFixed(2)}
                  </strong>
                </div>
              </div>

              <div className="recep-modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowEditBillingModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={submitLoading}>
                  {submitLoading ? <Loader2 size={16} className="spin-icon" /> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Invoice Preview & Digital Receipt */}
      {showInvoicePreviewModal && selectedInvoiceForPreview && (
        <div className="recep-modal-overlay">
          <div className="recep-modal-content" style={{ maxWidth: '650px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="recep-modal-header" style={{ paddingBottom: '12px', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Invoice Receipt</h3>
                <small style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>No: {selectedInvoiceForPreview.invoice_number}</small>
              </div>
              <button className="close-btn" onClick={() => setShowInvoicePreviewModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', padding: '0.75rem 1rem', backgroundColor: 'var(--surface-2)', borderRadius: '8px' }}>
              <div>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--muted)', fontWeight: 600 }}>Created On</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{new Date(selectedInvoiceForPreview.created_at).toLocaleDateString()}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--muted)', fontWeight: 600 }}>Invoice Status</div>
                {(() => {
                  const effStatus = getInvoiceEffectiveStatus(selectedInvoiceForPreview);
                  return (
                    <span className={`badge ${
                      effStatus === 'paid' ? 'badge-completed' :
                      effStatus === 'partially_paid' ? 'badge-confirmed' :
                      effStatus === 'cancelled' ? 'badge-cancelled' : 'badge-pending'
                    }`} style={{ marginTop: '4px', display: 'inline-block' }}>
                      {effStatus === 'paid' ? 'Paid' :
                       effStatus === 'partially_paid' ? 'Partial' :
                       effStatus === 'cancelled' ? 'Cancelled' : 'Unpaid'}
                    </span>
                  );
                })()}
              </div>
            </div>

            {/* Patient & Clinic Information */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Billed To</h4>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{selectedInvoiceForPreview.patient?.user?.full_name}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--ink-2)' }}>Code: {selectedInvoiceForPreview.patient?.patient_code}</div>
                {selectedInvoiceForPreview.patient?.user?.email && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--ink-2)' }}>Email: {selectedInvoiceForPreview.patient?.user?.email}</div>
                )}
                {selectedInvoiceForPreview.patient?.user?.phone && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--ink-2)' }}>Phone: {selectedInvoiceForPreview.patient?.user?.phone}</div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Issued By</h4>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Vertical Clinic</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--ink-2)' }}>Main Branch, Ahmedabad</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--ink-2)' }}>contact@verticalclinic.com</div>
              </div>
            </div>

            {/* Billing Items Table */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Clinical Charges Breakdown</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', paddingBottom: '8px', textAlign: 'left', fontWeight: 600, color: 'var(--ink-2)' }}>
                    <th style={{ padding: '8px 0' }}>Item Description</th>
                    <th style={{ padding: '8px 0', textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedInvoiceForPreview.items_breakdown && selectedInvoiceForPreview.items_breakdown.length > 0 ? (
                    selectedInvoiceForPreview.items_breakdown.map((item: any, idx: number) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 0', color: item.amount < 0 ? 'var(--success)' : 'var(--text-primary)', fontWeight: item.amount < 0 ? 600 : 500 }}>
                          {item.description}
                        </td>
                        <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 600, color: item.amount < 0 ? 'var(--success)' : 'var(--text-primary)' }}>
                          {item.amount < 0 ? `- ₹${Math.abs(item.amount).toFixed(2)}` : `₹${item.amount.toFixed(2)}`}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <>
                      {/* 1. Consultation */}
                      {selectedInvoiceForPreview.consultation && (
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px 0' }}>
                            <div>Consultation Fee</div>
                            <small style={{ color: 'var(--muted)' }}>{formatDocName(selectedInvoiceForPreview.consultation.doctor?.user?.full_name)}</small>
                          </td>
                          <td style={{ padding: '10px 0', textAlign: 'right' }}>
                            ₹{(selectedInvoiceForPreview.consultation.doctor?.consultation_fee || 500).toFixed(2)}
                          </td>
                        </tr>
                      )}

                      {/* 2. Prescription Items */}
                      {selectedInvoiceForPreview.prescription_items && selectedInvoiceForPreview.prescription_items.length > 0 && (
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px 0' }}>
                            <div>Dispensed Medicines / Prescriptions</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                              {selectedInvoiceForPreview.prescription_items.map((item: any, idx: number) => (
                                <span key={idx} style={{ fontSize: '0.75rem', backgroundColor: 'var(--primary-light)', padding: '2px 6px', borderRadius: '4px', color: 'var(--primary-dark)' }}>
                                  {item.medicine_name}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td style={{ padding: '10px 0', textAlign: 'right', verticalAlign: 'middle' }}>
                            Included
                          </td>
                        </tr>
                      )}

                      {/* 3. Treatment Plan */}
                      {selectedInvoiceForPreview.treatment_plan && (
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px 0' }}>
                            <div>Treatment Plan Procedures</div>
                            <small style={{ color: 'var(--muted)' }}>{selectedInvoiceForPreview.treatment_plan.title}</small>
                          </td>
                          <td style={{ padding: '10px 0', textAlign: 'right' }}>
                            ₹{(selectedInvoiceForPreview.treatment_plan.procedures?.reduce((sum: number, p: any) => sum + (p.cost || 0), 0) || 0).toFixed(2)}
                          </td>
                        </tr>
                      )}

                      {/* 4. IPD Admission Stay */}
                      {selectedInvoiceForPreview.admission && (
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px 0' }}>
                            <div>IPD Bed Stay & Rent</div>
                            <small style={{ color: 'var(--muted)' }}>
                              {formatBedNumber(selectedInvoiceForPreview.admission.bed?.bed_number || '') || 'N/A'} ({selectedInvoiceForPreview.admission.bed?.category?.name || 'IPD Category'})
                            </small>
                          </td>
                          <td style={{ padding: '10px 0', textAlign: 'right' }}>
                            Included in total
                          </td>
                        </tr>
                      )}
                      
                      {/* Default fallback row if no consultation/treatment plan/admission (standard bill) */}
                      {!selectedInvoiceForPreview.consultation && !selectedInvoiceForPreview.treatment_plan && !selectedInvoiceForPreview.admission && (
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px 0' }}>General Consultation & Billed Services</td>
                          <td style={{ padding: '10px 0', textAlign: 'right' }}>
                            ₹{selectedInvoiceForPreview.total_amount.toFixed(2)}
                          </td>
                        </tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>

            {/* Calculations Summary Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '280px', marginLeft: 'auto', marginBottom: '2rem', fontSize: '0.88rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--ink-2)' }}>Subtotal:</span>
                <span>₹{selectedInvoiceForPreview.total_amount.toFixed(2)}</span>
              </div>
              {selectedInvoiceForPreview.discount_amount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger)' }}>
                  <span>Discount:</span>
                  <span>-₹{selectedInvoiceForPreview.discount_amount.toFixed(2)}</span>
                </div>
              )}
              {selectedInvoiceForPreview.tax_amount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--ink-2)' }}>GST / Tax:</span>
                  <span>+₹{selectedInvoiceForPreview.tax_amount.toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.05rem', borderTop: '2px solid var(--border)', paddingTop: '8px', marginTop: '4px' }}>
                <span>Grand Total:</span>
                <span>₹{selectedInvoiceForPreview.grand_total.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success)', fontWeight: 600 }}>
                <span>Amount Paid:</span>
                <span>₹{selectedInvoiceForPreview.amount_paid.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border)', paddingTop: '8px', fontWeight: 700 }}>
                <span>Balance Due:</span>
                <span style={{ color: selectedInvoiceForPreview.balance_due > 0 ? 'var(--danger)' : 'var(--success)' }}>
                  ₹{selectedInvoiceForPreview.balance_due.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Actions Toolbar Footer */}
            <div className="recep-modal-actions" style={{ justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '16px', margin: 0 }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  type="button" 
                  className="btn-download"
                  style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--ink)' }}
                  onClick={() => handleDownloadPDF(selectedInvoiceForPreview.id, selectedInvoiceForPreview.invoice_number)}
                  title="Download PDF"
                >
                  <Download size={14} /> PDF
                </button>
                <button 
                  type="button" 
                  className="btn-download"
                  style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--ink)' }}
                  disabled={sendingEmailStatus}
                  onClick={() => handleSendInvoiceEmail(selectedInvoiceForPreview.id, selectedInvoiceForPreview.invoice_number)}
                  title="Email Receipt to Patient"
                >
                  {sendingEmailStatus ? <Loader2 size={14} className="spin-icon" /> : <Mail size={14} />} Email
                </button>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                {selectedInvoiceForPreview.balance_due > 0 && (
                  <button 
                    type="button" 
                    className="btn-pay"
                    onClick={() => {
                      setShowInvoicePreviewModal(false);
                      setSelectedInvoiceForPayment(selectedInvoiceForPreview);
                      setPaymentForm({
                        amount: selectedInvoiceForPreview.balance_due,
                        payment_method: 'cash',
                        transaction_reference: '',
                      });
                      setShowPaymentModal(true);
                    }}
                  >
                    <CreditCard size={14} /> Pay Balance
                  </button>
                )}
                <button 
                  type="button" 
                  className="btn-edit"
                  onClick={() => {
                    setShowInvoicePreviewModal(false);
                    setSelectedInvoiceForEdit(selectedInvoiceForPreview);
                    setEditBillingForm({
                      total_amount: selectedInvoiceForPreview.total_amount,
                      discount_amount: selectedInvoiceForPreview.discount_amount,
                      tax_amount: selectedInvoiceForPreview.tax_amount,
                      status: selectedInvoiceForPreview.status,
                    });
                    fetchEditPendingCharges(selectedInvoiceForPreview.patient_id, selectedInvoiceForPreview);
                    setShowEditBillingModal(true);
                  }}
                >
                  <Edit2 size={14} /> Edit
                </button>
                <button type="button" className="btn-cancel" onClick={() => setShowInvoicePreviewModal(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Patient History & Complete Profile */}
      {showPatientHistoryModal && (
        <div className="recep-modal-overlay">
          <div className="recep-modal-content" style={{ maxWidth: '1000px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="recep-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <History size={24} style={{ color: 'var(--primary)' }} />
                <div>
                  <h3 style={{ margin: 0 }}>Patient Profile & EMR History</h3>
                  <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                    Complete patient records and clinical visits timeline
                  </span>
                </div>
              </div>
              <button className="close-btn" onClick={() => { setShowPatientHistoryModal(false); setPatientHistoryData(null); }}>
                <X size={18} />
              </button>
            </div>

            <div className="recep-modal-body" style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px', padding: '20px 0' }}>
              {/* Left Side: Demographic Card */}
              <div className="patient-demographics-sidebar" style={{ borderRight: '1px solid var(--border)', paddingRight: '20px', overflowY: 'auto' }}>
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                  <div style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '24px',
                    background: 'linear-gradient(135deg, var(--primary) 0%, #3b82f6 100%)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.75rem',
                    fontWeight: 'bold',
                    margin: '0 auto 12px auto',
                    boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.2), 0 4px 6px -4px rgba(59, 130, 246, 0.2)'
                  }}>
                    {selectedPatientForHistory?.user?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'PT'}
                  </div>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '1.25rem', fontWeight: 700, color: 'var(--ink)' }}>
                    {selectedPatientForHistory?.user?.full_name || selectedPatientForHistory?.name || 'N/A'}
                  </h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--primary)', background: 'var(--primary-light)', padding: '4px 10px', borderRadius: '9999px', fontWeight: 600, border: '1px solid rgba(59, 130, 246, 0.1)' }}>
                    {selectedPatientForHistory?.patient_code}
                  </span>

                  {!isEditingPatientProfile && (
                    <button 
                      className="recep-btn-secondary full-width" 
                      onClick={() => handleStartEditPatient()}
                      style={{ 
                        marginTop: '16px', 
                        padding: '8px 16px', 
                        fontSize: '0.85rem', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        gap: '8px',
                        borderRadius: '8px',
                        fontWeight: 600,
                        border: '1px solid var(--border)',
                        backgroundColor: '#ffffff'
                      }}
                    >
                      <Edit2 size={14} /> Edit Profile Details
                    </button>
                  )}
                </div>

                {isEditingPatientProfile ? (
                  <form onSubmit={handleSavePatientProfile} style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.82rem' }}>
                    <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '6px', fontWeight: 600, color: 'var(--primary)' }}>
                      Edit Patient Profile
                    </div>

                    <div>
                      <label style={{ display: 'block', fontWeight: 600, marginBottom: '2px' }}>Full Name *</label>
                      <input 
                        type="text" 
                        required 
                        className="recep-input-field" 
                        style={{ padding: '5px 8px', fontSize: '0.82rem' }}
                        value={editPatientForm.full_name} 
                        onChange={(e) => setEditPatientForm({ ...editPatientForm, full_name: e.target.value })}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <label style={{ display: 'block', fontWeight: 600, marginBottom: '2px' }}>Phone *</label>
                        <input 
                          type="text" 
                          required 
                          className="recep-input-field" 
                          style={{ padding: '5px 8px', fontSize: '0.82rem' }}
                          value={editPatientForm.phone} 
                          onChange={(e) => setEditPatientForm({ ...editPatientForm, phone: e.target.value })}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontWeight: 600, marginBottom: '2px' }}>Gender</label>
                        <select 
                          className="recep-select-field" 
                          style={{ padding: '5px 8px', fontSize: '0.82rem' }}
                          value={editPatientForm.gender} 
                          onChange={(e) => setEditPatientForm({ ...editPatientForm, gender: e.target.value })}
                        >
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <label style={{ display: 'block', fontWeight: 600, marginBottom: '2px' }}>DOB</label>
                        <CustomDatePicker 
                          value={editPatientForm.date_of_birth || ''} 
                          onChange={(date) => setEditPatientForm({ ...editPatientForm, date_of_birth: date })}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontWeight: 600, marginBottom: '2px' }}>Blood Group</label>
                        <select 
                          className="recep-select-field" 
                          style={{ padding: '5px 8px', fontSize: '0.82rem' }}
                          value={editPatientForm.blood_group} 
                          onChange={(e) => setEditPatientForm({ ...editPatientForm, blood_group: e.target.value })}
                        >
                          <option value="">Select</option>
                          <option value="A+">A+</option>
                          <option value="A-">A-</option>
                          <option value="B+">B+</option>
                          <option value="B-">B-</option>
                          <option value="O+">O+</option>
                          <option value="O-">O-</option>
                          <option value="AB+">AB+</option>
                          <option value="AB-">AB-</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontWeight: 600, marginBottom: '2px' }}>Address</label>
                      <textarea 
                        rows={2} 
                        className="recep-input-field" 
                        style={{ padding: '5px 8px', fontSize: '0.82rem', resize: 'vertical' }}
                        value={editPatientForm.address} 
                        onChange={(e) => setEditPatientForm({ ...editPatientForm, address: e.target.value })}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontWeight: 600, marginBottom: '2px' }}>Known Allergies</label>
                      <input 
                        type="text" 
                        className="recep-input-field" 
                        style={{ padding: '5px 8px', fontSize: '0.82rem' }}
                        placeholder="e.g. Penicillin, Sulfa"
                        value={editPatientForm.allergies} 
                        onChange={(e) => setEditPatientForm({ ...editPatientForm, allergies: e.target.value })}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontWeight: 600, marginBottom: '2px' }}>Chronic Conditions</label>
                      <input 
                        type="text" 
                        className="recep-input-field" 
                        style={{ padding: '5px 8px', fontSize: '0.82rem' }}
                        placeholder="e.g. Diabetes, Hypertension"
                        value={editPatientForm.chronic_conditions} 
                        onChange={(e) => setEditPatientForm({ ...editPatientForm, chronic_conditions: e.target.value })}
                      />
                    </div>

                    <div style={{ background: 'var(--surface-2)', padding: '8px', borderRadius: '6px', marginTop: '4px' }}>
                      <strong style={{ fontSize: '0.78rem', display: 'block', marginBottom: '6px', color: 'var(--primary-dark)' }}>Emergency Contact</strong>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <input 
                          type="text" 
                          className="recep-input-field" 
                          style={{ padding: '4px 6px', fontSize: '0.8rem' }}
                          placeholder="Contact Name"
                          value={editPatientForm.emergency_contact_name} 
                          onChange={(e) => setEditPatientForm({ ...editPatientForm, emergency_contact_name: e.target.value })}
                        />
                        <input 
                          type="text" 
                          className="recep-input-field" 
                          style={{ padding: '4px 6px', fontSize: '0.8rem' }}
                          placeholder="Relation (e.g. Spouse)"
                          value={editPatientForm.emergency_contact_relation} 
                          onChange={(e) => setEditPatientForm({ ...editPatientForm, emergency_contact_relation: e.target.value })}
                        />
                        <input 
                          type="text" 
                          className="recep-input-field" 
                          style={{ padding: '4px 6px', fontSize: '0.8rem' }}
                          placeholder="Emergency Phone"
                          value={editPatientForm.emergency_contact_phone} 
                          onChange={(e) => setEditPatientForm({ ...editPatientForm, emergency_contact_phone: e.target.value })}
                        />
                      </div>
                    </div>

                    <div style={{ background: 'var(--surface-2)', padding: '8px', borderRadius: '6px' }}>
                      <strong style={{ fontSize: '0.78rem', display: 'block', marginBottom: '6px', color: 'var(--primary-dark)' }}>Insurance Information</strong>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <input 
                          type="text" 
                          className="recep-input-field" 
                          style={{ padding: '4px 6px', fontSize: '0.8rem' }}
                          placeholder="Insurance Provider"
                          value={editPatientForm.insurance_provider} 
                          onChange={(e) => setEditPatientForm({ ...editPatientForm, insurance_provider: e.target.value })}
                        />
                        <input 
                          type="text" 
                          className="recep-input-field" 
                          style={{ padding: '4px 6px', fontSize: '0.8rem' }}
                          placeholder="Policy Number"
                          value={editPatientForm.insurance_policy_no} 
                          onChange={(e) => setEditPatientForm({ ...editPatientForm, insurance_policy_no: e.target.value })}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <button 
                        type="submit" 
                        className="recep-btn-primary" 
                        disabled={savingPatientProfile}
                        style={{ flex: 1, padding: '6px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                      >
                        {savingPatientProfile ? <Loader2 size={14} className="spin-icon" /> : 'Save Profile'}
                      </button>
                      <button 
                        type="button" 
                        className="btn-cancel" 
                        onClick={() => setIsEditingPatientProfile(false)}
                        style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.88rem' }}>
                    
                    {/* Compact Profile Info Grid */}
                    <div style={{ 
                      backgroundColor: 'var(--surface-1)', 
                      border: '1px solid var(--border)', 
                      borderRadius: '12px', 
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '6px', background: 'var(--surface-2)' }}>
                          <Phone size={14} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <span style={{ color: 'var(--muted)', display: 'block', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.025em' }}>Phone</span>
                          <span style={{ fontWeight: 500, color: 'var(--ink)' }}>{selectedPatientForHistory?.user?.phone || '—'}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '6px', background: 'var(--surface-2)' }}>
                          <Mail size={14} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <span style={{ color: 'var(--muted)', display: 'block', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.025em' }}>Email</span>
                          <span style={{ fontWeight: 500, color: 'var(--ink)', wordBreak: 'break-all' }}>{selectedPatientForHistory?.user?.email || '—'}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '6px', background: 'var(--surface-2)' }}>
                          <Users size={14} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <span style={{ color: 'var(--muted)', display: 'block', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.025em' }}>Gender / Age</span>
                          <span style={{ fontWeight: 500, color: 'var(--ink)' }}>
                            {selectedPatientForHistory?.gender || '—'} / {selectedPatientForHistory?.date_of_birth ? `${new Date().getFullYear() - new Date(selectedPatientForHistory.date_of_birth).getFullYear()} Yrs` : '—'}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '6px', background: 'var(--surface-2)' }}>
                          <Activity size={14} style={{ color: '#ef4444' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <span style={{ color: 'var(--muted)', display: 'block', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.025em' }}>Blood Group</span>
                          <span style={{ fontWeight: 600, color: '#ef4444' }}>{selectedPatientForHistory?.blood_group || '—'}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <div style={{ color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '6px', background: 'var(--surface-2)', marginTop: '2px' }}>
                          <MapPin size={14} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <span style={{ color: 'var(--muted)', display: 'block', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.025em' }}>Address</span>
                          <span style={{ display: 'block', lineHeight: 1.4, color: 'var(--ink)', fontSize: '0.85rem' }}>{selectedPatientForHistory?.address || '—'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Medical / Alert Badges Card */}
                    <div style={{ 
                      backgroundColor: 'var(--surface-1)', 
                      border: '1px solid var(--border)', 
                      borderRadius: '12px', 
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)'
                    }}>
                      <div>
                        <strong style={{ 
                          color: selectedPatientForHistory?.allergies && selectedPatientForHistory.allergies.toLowerCase() !== 'none' ? 'var(--danger)' : 'var(--muted)', 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '6px', 
                          fontSize: '0.72rem', 
                          textTransform: 'uppercase', 
                          fontWeight: 700, 
                          marginBottom: '4px',
                          letterSpacing: '0.025em'
                        }}>
                          <AlertTriangle size={13} style={{ color: selectedPatientForHistory?.allergies && selectedPatientForHistory.allergies.toLowerCase() !== 'none' ? 'var(--danger)' : 'var(--muted)' }} /> Known Allergies
                        </strong>
                        <div style={{ 
                          fontSize: '0.85rem', 
                          padding: '8px 10px', 
                          backgroundColor: selectedPatientForHistory?.allergies && selectedPatientForHistory.allergies.toLowerCase() !== 'none' ? '#fef2f2' : 'var(--surface-2)', 
                          border: selectedPatientForHistory?.allergies && selectedPatientForHistory.allergies.toLowerCase() !== 'none' ? '1px solid #fee2e2' : '1px solid transparent',
                          borderRadius: '8px',
                          color: selectedPatientForHistory?.allergies && selectedPatientForHistory.allergies.toLowerCase() !== 'none' ? '#b91c1c' : 'var(--ink)',
                          fontWeight: selectedPatientForHistory?.allergies && selectedPatientForHistory.allergies.toLowerCase() !== 'none' ? 600 : 400
                        }}>
                          {selectedPatientForHistory?.allergies ? formatClinicalDisplay(selectedPatientForHistory.allergies) : 'None'}
                        </div>
                      </div>

                      {selectedPatientForHistory?.chronic_conditions && (
                        <div>
                          <strong style={{ color: 'var(--muted)', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px', letterSpacing: '0.025em' }}>
                            Chronic Conditions
                          </strong>
                          <div style={{ fontSize: '0.85rem', padding: '8px 10px', backgroundColor: 'var(--surface-2)', borderRadius: '8px', color: 'var(--ink)' }}>
                            {formatClinicalDisplay(selectedPatientForHistory.chronic_conditions)}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Emergency Contact */}
                    {selectedPatientForHistory?.emergency_contact_name && (
                      <div style={{ 
                        padding: '12px 14px', 
                        background: 'linear-gradient(135deg, #fef3c7 0%, #fffbeb 100%)', 
                        border: '1px solid #fde68a', 
                        borderRadius: '12px',
                        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)'
                      }}>
                        <strong style={{ color: '#92400e', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 700, marginBottom: '4px' }}>
                          <Heart size={13} style={{ color: '#d97706' }} /> Emergency Contact
                        </strong>
                        <span style={{ display: 'block', fontSize: '0.82rem', color: '#78350f', lineHeight: 1.4 }}>
                          <strong>{selectedPatientForHistory.emergency_contact_name}</strong> ({selectedPatientForHistory.emergency_contact_relation || 'Relative'})
                        </span>
                        {selectedPatientForHistory.emergency_contact_phone && (
                          <span style={{ display: 'block', fontSize: '0.82rem', color: '#78350f', marginTop: '2px', fontWeight: 500 }}>
                            📞 {selectedPatientForHistory.emergency_contact_phone}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Insurance Details Box */}
                    <div style={{ 
                      padding: '14px', 
                      background: selectedPatientForHistory?.insurance_provider ? 'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)' : 'var(--surface-2)', 
                      border: selectedPatientForHistory?.insurance_provider ? '1px solid #a7f3d0' : '1px solid var(--border)', 
                      borderRadius: '12px',
                      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)'
                    }}>
                      <strong style={{ color: selectedPatientForHistory?.insurance_provider ? '#065f46' : 'var(--muted)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 700, marginBottom: '6px' }}>
                        <Shield size={13} style={{ color: selectedPatientForHistory?.insurance_provider ? '#059669' : 'var(--muted)' }} /> Insurance Details
                      </strong>
                      <span style={{ display: 'block', fontSize: '0.82rem', color: selectedPatientForHistory?.insurance_provider ? '#047857' : 'var(--muted)', lineHeight: 1.4, fontWeight: selectedPatientForHistory?.insurance_provider ? 500 : 400 }}>
                        {selectedPatientForHistory?.insurance_provider 
                          ? `${selectedPatientForHistory.insurance_provider} (Policy: ${selectedPatientForHistory.insurance_policy_no || '—'})` 
                          : 'No active insurance policy'}
                      </span>
                    </div>

                  </div>
                )}
              </div>

              {/* Right Side: EMR Timeline & Tabs */}
              <div className="patient-emr-tabs-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {loadingPatientHistory ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '40px' }}>
                    <Loader2 size={32} className="spin-icon" style={{ color: 'var(--primary)', marginBottom: '10px' }} />
                    <p style={{ color: 'var(--muted)' }}>Retrieving patient's complete history profile...</p>
                  </div>
                ) : (
                  <>
                    {/* Tabs navigation */}
                    <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '15px', gap: '15px' }}>
                      {(['appointments', 'consultations', 'prescriptions', 'bills', 'reports'] as const).map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setHistoryModalTab(tab)}
                          style={{
                            padding: '8px 12px',
                            background: 'none',
                            border: 'none',
                            borderBottom: historyModalTab === tab ? '2px solid var(--primary)' : 'none',
                            color: historyModalTab === tab ? 'var(--primary)' : 'var(--muted)',
                            fontWeight: historyModalTab === tab ? 'bold' : 'normal',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            textTransform: 'capitalize'
                          }}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>

                    {/* Tab contents */}
                    <div style={{ flex: 1, overflowY: 'auto', paddingRight: '5px' }}>
                      {historyModalTab === 'appointments' && (
                        <div>
                          <h4 style={{ margin: '0 0 10px 0', color: 'var(--primary-dark)' }}>Appointments</h4>
                          {(!patientHistoryData?.upcoming_appointments?.length && !patientHistoryData?.appointment_history?.length) ? (
                            <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>No appointment records found.</p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              {patientHistoryData?.upcoming_appointments?.map((appt: any) => (
                                <div key={appt.id} style={{ padding: '10px', border: '1px solid var(--primary-light)', background: '#eff6ff', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div>
                                    <strong style={{ display: 'block', fontSize: '0.9rem' }}>{appt.treatment_type}</strong>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                                      {formatDocName(appt.doctor?.user?.full_name)} &middot; {new Date(appt.appointment_datetime).toLocaleString()}
                                    </span>
                                  </div>
                                  <span className="badge badge-confirmed" style={{ fontSize: '0.75rem' }}>Upcoming</span>
                                </div>
                              ))}
                              {patientHistoryData?.appointment_history?.map((appt: any) => (
                                <div key={appt.id} style={{ padding: '10px', border: '1px solid var(--border)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div>
                                    <strong style={{ display: 'block', fontSize: '0.9rem' }}>{appt.treatment_type}</strong>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                                      {formatDocName(appt.doctor?.user?.full_name)} &middot; {new Date(appt.appointment_datetime).toLocaleString()}
                                    </span>
                                  </div>
                                  <span className={`badge badge-${appt.status}`} style={{ fontSize: '0.75rem' }}>{appt.status}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {historyModalTab === 'consultations' && (
                        <div>
                          <h4 style={{ margin: '0 0 10px 0', color: 'var(--primary-dark)' }}>Clinical Visits / Consultations</h4>
                          {!patientHistoryData?.medical_history?.length ? (
                            <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>No clinical consultations found.</p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                              {patientHistoryData.medical_history.map((c: any) => (
                                <div key={c.id} style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--surface-1)' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <strong style={{ fontSize: '0.9rem', color: 'var(--primary)' }}>Visit with {formatDocName(c.doctor?.user?.full_name)}</strong>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{new Date(c.consultation_datetime).toLocaleDateString()}</span>
                                  </div>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.82rem', marginTop: '6px' }}>
                                    <div>
                                      <strong style={{ display: 'block', color: 'var(--muted)' }}>Symptoms:</strong>
                                      <span>{c.symptoms || '—'}</span>
                                    </div>
                                    <div>
                                      <strong style={{ display: 'block', color: 'var(--muted)' }}>Diagnosis:</strong>
                                      <span>{c.diagnosis || '—'}</span>
                                    </div>
                                  </div>
                                  {c.notes && (
                                    <div style={{ marginTop: '8px', fontSize: '0.82rem', borderTop: '1px solid var(--border)', paddingTop: '6px' }}>
                                      <strong style={{ display: 'block', color: 'var(--muted)' }}>Clinical Notes:</strong>
                                      <span style={{ fontStyle: 'italic' }}>{c.notes}</span>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {historyModalTab === 'prescriptions' && (
                        <div>
                          <h4 style={{ margin: '0 0 10px 0', color: 'var(--primary-dark)' }}>Prescriptions</h4>
                          {!patientHistoryData?.prescriptions?.length ? (
                            <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>No prescriptions found.</p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              {patientHistoryData.prescriptions.map((p: any) => (
                                <div key={p.id} style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: '8px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>
                                    <strong style={{ fontSize: '0.88rem' }}>Issued by {formatDocName(p.doctor?.user?.full_name)}</strong>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{new Date(p.created_at).toLocaleDateString()}</span>
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {p.items?.map((item: any, idx: number) => (
                                      <div key={idx} style={{ fontSize: '0.82rem', display: 'flex', justifyContent: 'space-between' }}>
                                        <span><strong>{item.medicine_name}</strong> ({item.dosage})</span>
                                        <span style={{ color: 'var(--muted)' }}>{item.duration} &middot; {item.instructions}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {historyModalTab === 'bills' && (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <h4 style={{ margin: 0, color: 'var(--primary-dark)' }}>Billing Invoices</h4>
                            <button
                              className="recep-btn-secondary"
                              style={{ fontSize: '0.8rem', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              onClick={() => {
                                setShowPatientHistoryModal(false);
                                setBillingForm({
                                  patient_id: selectedPatientForHistory.id,
                                  total_amount: 0,
                                  discount_amount: 0,
                                  tax_amount: 0,
                                });
                                setActiveTab('billing');
                              }}
                            >
                              <Plus size={14} /> Create Bill for Patient
                            </button>
                          </div>
                          {!patientHistoryData?.bills?.length ? (
                            <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>No billing invoices found.</p>
                          ) : (
                            <div className="recep-table-container">
                              <table className="recep-table" style={{ fontSize: '0.8rem' }}>
                                <thead>
                                  <tr>
                                    <th>Inv Number</th>
                                    <th>Date</th>
                                    <th>Grand Total</th>
                                    <th>Paid</th>
                                    <th>Balance</th>
                                    <th>Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {patientHistoryData.bills.map((b: any) => (
                                    <tr key={b.id}>
                                      <td><strong>{b.invoice_number}</strong></td>
                                      <td>{new Date(b.created_at).toLocaleDateString()}</td>
                                      <td>₹{b.grand_total.toFixed(2)}</td>
                                      <td>₹{b.amount_paid.toFixed(2)}</td>
                                      <td style={{ color: b.balance_due > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>
                                        ₹{b.balance_due.toFixed(2)}
                                      </td>
                                      <td>
                                        <span className={`badge badge-${b.status}`}>
                                          {b.status}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}

                      {historyModalTab === 'reports' && (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h4 style={{ margin: 0, color: 'var(--primary-dark)', fontSize: '1.1rem', fontWeight: 600 }}>Medical Documents & Reports</h4>
                          </div>

                          {/* Premium Upload Section */}
                          <div style={{
                            background: 'linear-gradient(135deg, var(--surface-2) 0%, var(--surface-1) 100%)',
                            border: '1px solid var(--border)',
                            borderRadius: '12px',
                            padding: '16px',
                            marginBottom: '20px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                          }}>
                            <h5 style={{ margin: '0 0 12px 0', fontSize: '0.88rem', fontWeight: 600, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <UploadCloud size={16} style={{ color: 'var(--primary)' }} /> Upload Document on Behalf of Patient
                            </h5>
                            <form onSubmit={handleReportUpload} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '4px' }}>Document Title</label>
                                  <input
                                    type="text"
                                    className="recep-input-field"
                                    placeholder="e.g. Blood Test, Chest X-Ray"
                                    style={{ fontSize: '0.85rem', padding: '6px 10px' }}
                                    value={reportUploadTitle}
                                    onChange={(e) => setReportUploadTitle(e.target.value)}
                                  />
                                </div>
                                <div>
                                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '4px' }}>Document Category *</label>
                                  <select
                                    className="recep-input-field"
                                    style={{ fontSize: '0.85rem', padding: '6px 10px', height: '34px', background: 'var(--surface-1)' }}
                                    value={reportUploadType}
                                    onChange={(e) => setReportUploadType(e.target.value)}
                                    required
                                  >
                                    <option value="Lab Report">Lab Report</option>
                                    <option value="X-Ray">X-Ray / Scan</option>
                                    <option value="Prescription">Prescription</option>
                                    <option value="Consent Form">Consent Form</option>
                                    <option value="Other">Other Document</option>
                                  </select>
                                </div>
                              </div>

                              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                                <div style={{ flex: 1 }}>
                                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '4px' }}>Select File * (PDF, Image - max 10MB)</label>
                                  <div style={{
                                    border: '1px dashed var(--border)',
                                    borderRadius: '8px',
                                    padding: '8px 12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    backgroundColor: 'var(--surface-1)',
                                    cursor: 'pointer',
                                    position: 'relative'
                                  }}>
                                    <FileText size={16} style={{ color: 'var(--muted)' }} />
                                    <span style={{ fontSize: '0.8rem', color: reportUploadFile ? 'var(--ink)' : 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '280px' }}>
                                      {reportUploadFile ? reportUploadFile.name : 'Choose a file...'}
                                    </span>
                                    <input
                                      type="file"
                                      accept=".pdf,.png,.jpg,.jpeg,.webp"
                                      style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        height: '100%',
                                        opacity: 0,
                                        cursor: 'pointer'
                                      }}
                                      onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                          setReportUploadFile(e.target.files[0]);
                                        }
                                      }}
                                      required
                                    />
                                  </div>
                                </div>
                                <button
                                  type="submit"
                                  className="recep-btn-primary"
                                  disabled={uploadingReport}
                                  style={{
                                    height: '36px',
                                    padding: '0 16px',
                                    fontSize: '0.85rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                  }}
                                >
                                  {uploadingReport ? (
                                    <>
                                      <Loader2 size={14} className="spin-icon" /> Uploading...
                                    </>
                                  ) : (
                                    <>
                                      <UploadCloud size={14} /> Upload
                                    </>
                                  )}
                                </button>
                              </div>
                            </form>
                          </div>

                          {/* Existing Reports List */}
                          <h5 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', fontWeight: 600, color: 'var(--muted)' }}>
                            Patient Document History
                          </h5>
                          {!patientHistoryData?.reports?.length ? (
                            <div style={{
                              textAlign: 'center',
                              padding: '24px',
                              border: '1px solid var(--border)',
                              borderRadius: '12px',
                              color: 'var(--muted)',
                              backgroundColor: 'var(--surface-2)',
                              fontSize: '0.85rem'
                            }}>
                              No medical reports or documents uploaded for this patient.
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              {patientHistoryData.reports.map((report: any) => {
                                return (
                                  <div
                                    key={report.id}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      padding: '12px 16px',
                                      border: '1px solid var(--border)',
                                      borderRadius: '10px',
                                      backgroundColor: 'var(--surface-1)'
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                                      <div style={{
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: '8px',
                                        backgroundColor: 'var(--surface-2)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'var(--primary)'
                                      }}>
                                        <FileText size={18} />
                                      </div>
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <strong style={{ display: 'block', fontSize: '0.88rem', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {report.report_name}
                                        </strong>
                                        <span style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
                                          <span style={{
                                            backgroundColor: 'var(--surface-2)',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            fontWeight: 500
                                          }}>
                                            {report.report_type}
                                          </span>
                                          &middot;
                                          <span>
                                            Uploaded: {new Date(report.uploaded_at).toLocaleDateString()}
                                          </span>
                                        </span>
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', marginLeft: '12px' }}>
                                      <button
                                        type="button"
                                        onClick={() => setViewingReport(report)}
                                        className="recep-btn-secondary"
                                        style={{ padding: '6px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                                        title="View Report"
                                      >
                                        <Eye size={13} /> View
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteReport(report.id)}
                                        disabled={deletingReportId === report.id}
                                        className="recep-btn-secondary"
                                        style={{
                                          padding: '6px 10px',
                                          fontSize: '0.8rem',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          color: 'var(--danger)',
                                          borderColor: 'rgba(239, 68, 68, 0.2)',
                                          backgroundColor: 'rgba(239, 68, 68, 0.05)'
                                        }}
                                        title="Delete Report"
                                      >
                                        {deletingReportId === report.id ? (
                                          <Loader2 size={13} className="spin-icon" />
                                        ) : (
                                          <Trash2 size={13} />
                                        )}
                                        Delete
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
            
            <div className="recep-modal-footer" style={{ borderTop: '1px solid var(--border)', paddingTop: '15px', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn-cancel" onClick={() => { setShowPatientHistoryModal(false); setPatientHistoryData(null); }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Medical Report Viewer */}
      {viewingReport && (
        <div className="recep-modal-overlay" onClick={() => setViewingReport(null)} style={{ zIndex: 1100 }}>
          <div className="recep-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="recep-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileText size={24} style={{ color: 'var(--primary)' }} />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--ink)' }}>{viewingReport.report_name}</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                    Category: <strong style={{ color: 'var(--ink)' }}>{viewingReport.report_type}</strong> | Uploaded: {new Date(viewingReport.uploaded_at || viewingReport.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setViewingReport(null)} 
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="recep-modal-body" style={{ flex: 1, padding: '20px 0', minHeight: '450px', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
              {viewingReport.file_url?.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={viewingReport.file_url.startsWith('http') ? viewingReport.file_url : `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${viewingReport.file_url}`}
                  style={{ width: '100%', height: '100%', border: 'none', minHeight: '450px', borderRadius: '4px' }}
                  title={viewingReport.report_name}
                />
              ) : (
                <div style={{ width: '100%', height: '100%', overflow: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '10px' }}>
                  <img
                    src={viewingReport.file_url.startsWith('http') ? viewingReport.file_url : `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${viewingReport.file_url}`}
                    style={{ maxWidth: '100%', maxHeight: '450px', objectFit: 'contain', borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    alt={viewingReport.report_name}
                  />
                </div>
              )}
            </div>

            <div className="recep-modal-footer" style={{ borderTop: '1px solid var(--border)', paddingTop: '15px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="recep-btn-secondary"
                onClick={() => {
                  const url = viewingReport.file_url.startsWith('http') ? viewingReport.file_url : `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${viewingReport.file_url}`;
                  window.open(url, '_blank');
                }}
                style={{ fontSize: '0.85rem' }}
              >
                Open in New Tab
              </button>
              <button type="button" className="recep-btn-primary" onClick={() => setViewingReport(null)} style={{ fontSize: '0.85rem' }}>
                Close Viewer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Clinical Details Modal */}
      {selectedApptDetails && (
        <div className="recep-modal-overlay" onClick={() => setSelectedApptDetails(null)}>
          <div className="recep-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', width: '90%' }}>
            <div className="recep-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Stethoscope size={24} style={{ color: 'var(--primary)' }} />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Clinical View: Consultation Details</h3>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    Patient: <strong>{selectedApptDetails.patient?.user?.full_name || 'Walk-in'}</strong> | Status: <span className={`badge badge-${selectedApptDetails.status}`}>{selectedApptDetails.status?.replace('_', ' ')}</span>
                  </span>
                </div>
              </div>
              <button className="close-btn" onClick={() => setSelectedApptDetails(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="recep-modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', padding: '16px 0' }}>
              {/* Info Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#475569', textTransform: 'uppercase' }}>Patient Info</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem' }}>
                    <div><strong>Code:</strong> {selectedApptDetails.patient?.patient_code || '—'}</div>
                    <div><strong>Contact:</strong> {selectedApptDetails.patient?.user?.phone || '—'}</div>
                    <div><strong>Email:</strong> {selectedApptDetails.patient?.user?.email || '—'}</div>
                    <div><strong>Allergies:</strong> <span style={{ color: selectedApptDetails.patient?.allergies && selectedApptDetails.patient?.allergies !== 'None' ? '#ef4444' : 'inherit' }}>{selectedApptDetails.patient?.allergies || 'None'}</span></div>
                  </div>
                </div>

                <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#475569', textTransform: 'uppercase' }}>Appointment Info</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem' }}>
                    <div><strong>Doctor:</strong> {formatDocName(selectedApptDetails.doctor?.user?.full_name || 'Staff')}</div>
                    <div><strong>Treatment:</strong> {selectedApptDetails.treatment_type}</div>
                    <div><strong>Type:</strong> {selectedApptDetails.consultation_type === 'teleconsultation' ? 'Teleconsultation' : 'In-Person'}</div>
                    <div><strong>Time:</strong> {getLocalApptDate(selectedApptDetails.appointment_datetime)} at {formatTimeToAMPM(getLocalApptTime(selectedApptDetails.appointment_datetime))}</div>
                  </div>
                </div>
              </div>

              {/* Consultation Details */}
              <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '16px' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', fontWeight: 'bold' }}>Doctor's Examination &amp; Prescription</h4>
                
                {loadingConsultationDetails ? (
                  <div style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                    <Loader2 className="spin-icon" style={{ display: 'inline-block', marginRight: '8px' }} /> Loading clinical data...
                  </div>
                ) : consultationDetails ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Vitals Bar */}
                    <div style={{ display: 'flex', gap: '20px', padding: '8px 12px', backgroundColor: '#f0fdf4', borderRadius: '6px', border: '1px solid #bbf7d0', fontSize: '0.85rem' }}>
                      <div><strong>BP:</strong> {consultationDetails.vitals_bp || '—'}</div>
                      <div><strong>Pulse:</strong> {consultationDetails.vitals_pulse ? `${consultationDetails.vitals_pulse} bpm` : '—'}</div>
                      <div><strong>Temp:</strong> {consultationDetails.vitals_temperature ? `${consultationDetails.vitals_temperature} °F` : '—'}</div>
                    </div>

                    {/* Symptoms and Diagnosis */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <strong style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', marginBottom: '4px' }}>Symptoms:</strong>
                        <div style={{ fontSize: '0.85rem', padding: '8px 12px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', minHeight: '60px', whiteSpace: 'pre-line' }}>
                          {consultationDetails.symptoms || 'No symptoms recorded.'}
                        </div>
                      </div>
                      <div>
                        <strong style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', marginBottom: '4px' }}>Diagnosis:</strong>
                        <div style={{ fontSize: '0.85rem', padding: '8px 12px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', minHeight: '60px', whiteSpace: 'pre-line' }}>
                          {consultationDetails.diagnosis || 'No diagnosis recorded.'}
                        </div>
                      </div>
                    </div>

                    {/* Prescriptions */}
                    <div>
                      <strong style={{ display: 'block', fontSize: '0.85rem', color: '#334155', marginBottom: '8px' }}>Prescribed Medications:</strong>
                      {consultationDetails.prescriptions && consultationDetails.prescriptions.length > 0 ? (
                        consultationDetails.prescriptions.map((presc: any, pIdx: number) => (
                          <div key={presc.id || pIdx} style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px', backgroundColor: '#ffffff', marginBottom: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.8rem', color: '#64748b' }}>
                              <span>Prescription Ref: #{pIdx + 1}</span>
                              <span className={`badge badge-${presc.status === 'Dispensed' ? 'completed' : 'pending'}`}>{presc.status}</span>
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                              <thead>
                                <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                                  <th style={{ padding: '6px 0', color: '#64748b' }}>Medicine</th>
                                  <th style={{ padding: '6px 0', color: '#64748b' }}>Dosage</th>
                                  <th style={{ padding: '6px 0', color: '#64748b' }}>Duration</th>
                                  <th style={{ padding: '6px 0', color: '#64748b', textAlign: 'right' }}>Qty</th>
                                  <th style={{ padding: '6px 0', color: '#64748b', paddingLeft: '12px' }}>Instructions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {presc.items && presc.items.length > 0 ? (
                                  presc.items.map((item: any, iIdx: number) => (
                                    <tr key={item.id || iIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                      <td style={{ padding: '6px 0', fontWeight: 'bold' }}>{item.medicine_name}</td>
                                      <td style={{ padding: '6px 0' }}>{item.dosage}</td>
                                      <td style={{ padding: '6px 0' }}>{item.duration}</td>
                                      <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 'bold' }}>{item.quantity || 10}</td>
                                      <td style={{ padding: '6px 0', paddingLeft: '12px', color: '#64748b' }}>{item.instructions || '—'}</td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td colSpan={5} style={{ padding: '12px 0', textAlign: 'center', color: '#64748b' }}>No medicines prescribed.</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                            {presc.notes && (
                              <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#64748b', padding: '6px', backgroundColor: '#f8fafc', borderRadius: '4px' }}>
                                <strong>Notes:</strong> {presc.notes}
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div style={{ padding: '12px', border: '1px dashed #cbd5e1', borderRadius: '6px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                          No active prescription for this consultation.
                        </div>
                      )}
                    </div>

                    {/* General Notes */}
                    {consultationDetails.notes && (
                      <div>
                        <strong style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', marginBottom: '4px' }}>General Consultation Notes:</strong>
                        <p style={{ margin: 0, fontSize: '0.85rem', padding: '8px 12px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px' }}>{consultationDetails.notes}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: '24px', border: '1px dashed #cbd5e1', borderRadius: '6px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                    No clinical consultation log found. The doctor might not have completed the checkup or consultation details yet.
                  </div>
                )}
              </div>
            </div>

            <div className="recep-modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
              <button type="button" className="btn-cancel" onClick={() => setSelectedApptDetails(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. ADMIT PATIENT MODAL */}
      <AdmitPatientModal
        isOpen={isAdmitModalOpen}
        onClose={() => {
          setIsAdmitModalOpen(false);
          setActiveAdmissionRequestId(null);
        }}
        selectedBed={selectedBed}
        setSelectedBed={setSelectedBed}
        activeAdmissionRequestId={activeAdmissionRequestId}
        setActiveAdmissionRequestId={setActiveAdmissionRequestId}
        admitForm={admitForm}
        setAdmitForm={setAdmitForm}
        bedsData={bedsData}
        patients={patients}
        doctors={doctors}
        pendingAdmissionRequests={pendingAdmissionRequests}
        onSubmit={handleAdmitPatient}
        categories={categoriesData}
      />

      {/* 2. TRANSFER BED MODAL */}
      {isTransferModalOpen && selectedBed && (
        <div className="recep-modal-overlay" onClick={() => setIsTransferModalOpen(false)}>
          <div className="recep-modal-content" onClick={(e) => e.stopPropagation()} style={{ width: '500px', maxWidth: '92vw' }}>
            <div className="recep-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0 }}>Transfer Patient — From {formatBedNumber(selectedBed.bed_number)}</h3>
              <button className="close-btn" onClick={() => setIsTransferModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleTransferPatient}>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label>Target Bed (Available beds only)</label>
                <select
                  className="recep-select-field"
                  value={transferForm.to_bed_id}
                  onChange={(e) => setTransferForm({ ...transferForm, to_bed_id: e.target.value })}
                  required
                >
                  <option value="">-- Choose Available Bed --</option>
                  {bedsData
                    .filter((b: any) => b.status === 'available')
                    .map((b: any) => (
                      <option key={b.id} value={b.id}>
                        {formatBedNumber(b.bed_number)} ({b.category?.name} - ₹{b.category?.base_charge_24h}/day)
                      </option>
                    ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label>Transfer Reason</label>
                <textarea
                  className="recep-input-field"
                  rows={3}
                  value={transferForm.reason}
                  onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
                  placeholder="e.g. Patient requested deluxe room, clinical condition requires ICU monitoring"
                  required
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '15px' }}>
                <button type="button" className="btn-cancel" onClick={() => setIsTransferModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-submit">Transfer Patient</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. VITALS ROUNDING LOG MODAL */}
      {isVitalsModalOpen && selectedBed && selectedBed.active_admission && (
        <div className="recep-modal-overlay" onClick={() => setIsVitalsModalOpen(false)}>
          <div className="recep-modal-content" onClick={(e) => e.stopPropagation()} style={{ width: '850px', maxWidth: '95vw' }}>
            <div className="recep-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0 }}>Clinical Rounding: Vitals & Nursing Logs</h3>
              <button className="close-btn" onClick={() => setIsVitalsModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '24px', maxHeight: '70vh', overflowY: 'auto' }}>
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
                  <div className="form-group">
                    <label>Temperature (°F)</label>
                    <input
                      type="number"
                      step="0.1"
                      className="recep-input-field"
                      value={vitalsForm.temp}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, temp: Number(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Pulse Rate (bpm)</label>
                    <input
                      type="number"
                      className="recep-input-field"
                      value={vitalsForm.pulse}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, pulse: Number(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>BP Systolic (mmHg)</label>
                    <input
                      type="number"
                      className="recep-input-field"
                      value={vitalsForm.systolic_bp}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, systolic_bp: Number(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>BP Diastolic (mmHg)</label>
                    <input
                      type="number"
                      className="recep-input-field"
                      value={vitalsForm.diastolic_bp}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, diastolic_bp: Number(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>SpO2 Saturation (%)</label>
                    <input
                      type="number"
                      className="recep-input-field"
                      value={vitalsForm.spo2}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, spo2: Number(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Resp Rate (/min)</label>
                    <input
                      type="number"
                      className="recep-input-field"
                      value={vitalsForm.respiratory_rate}
                      onChange={(e) => setVitalsForm({ ...vitalsForm, respiratory_rate: Number(e.target.value) })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label>Clinical Notes</label>
                  <textarea
                    className="recep-input-field"
                    rows={3}
                    value={vitalsForm.nursing_notes}
                    onChange={(e) => setVitalsForm({ ...vitalsForm, nursing_notes: e.target.value })}
                    placeholder="Enter observation notes, IV status, pain levels, etc."
                    required
                    style={{ resize: 'vertical' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '15px' }}>
                  <button type="button" className="btn-cancel" onClick={() => setIsVitalsModalOpen(false)}>Cancel</button>
                  <button type="submit" className="btn-submit">Save Rounding</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 4. MEDICATION ADMINISTRATION CHART (MAC) MODAL */}
      {isMacModalOpen && selectedBed && selectedBed.active_admission && (
        <div className="recep-modal-overlay" onClick={() => setIsMacModalOpen(false)}>
          <div className="recep-modal-content" onClick={(e) => e.stopPropagation()} style={{ width: '850px', maxWidth: '95vw' }}>
            <div className="recep-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0 }}>Medication Administration Chart (MAC)</h3>
              <button className="close-btn" onClick={() => setIsMacModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', maxHeight: '70vh', overflowY: 'auto' }}>
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
                                className="recep-btn-secondary"
                                style={{ padding: '3px 8px', fontSize: '0.74rem', color: '#16a34a', borderColor: '#bbf7d0' }}
                                onClick={() => handleAdministerMedication(m.id, 'administered')}
                              >
                                Mark Given
                              </button>
                              <button
                                type="button"
                                className="recep-btn-secondary"
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
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label>Medicine Name</label>
                  <input
                    type="text"
                    className="recep-input-field"
                    value={macForm.medicine_name}
                    onChange={(e) => setMacForm({ ...macForm, medicine_name: e.target.value })}
                    placeholder="e.g. Inj. Pantocid 40mg"
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label>Dosage & Route</label>
                  <input
                    type="text"
                    className="recep-input-field"
                    value={macForm.dosage}
                    onChange={(e) => setMacForm({ ...macForm, dosage: e.target.value })}
                    placeholder="e.g. IV twice daily, 1 tab orally"
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label>Scheduled Administer Time</label>
                  <input
                    type="datetime-local"
                    className="recep-input-field"
                    value={macForm.scheduled_time}
                    onChange={(e) => setMacForm({ ...macForm, scheduled_time: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '15px' }}>
                  <button type="button" className="btn-cancel" onClick={() => setIsMacModalOpen(false)}>Cancel</button>
                  <button type="submit" className="btn-submit">Add Schedule</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 5. FINALIZE CHECKOUT / BILLING SUMMARY MODAL */}
      {isCheckoutModalOpen && selectedBed && selectedBed.active_admission && (
        <div className="recep-modal-overlay" onClick={() => setIsCheckoutModalOpen(false)}>
          <div className="recep-modal-content" onClick={(e) => e.stopPropagation()} style={{ width: '600px', maxWidth: '92vw' }}>
            <div className="recep-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0 }}>Final Checkout Invoice Preview</h3>
              <button className="close-btn" onClick={() => setIsCheckoutModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            {isLoadingCheckoutBill ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '30px' }}>
                <RefreshCw size={28} className="spin-animation" style={{ color: '#0d9488' }} />
              </div>
            ) : checkoutBill ? (
              <div className="invoice-container-premium" style={{ color: '#1e293b', maxHeight: '70vh', overflowY: 'auto' }}>
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
                  {checkoutBill.bill_items?.map((item: any, idx: number) => (
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

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '15px' }}>
                  <button type="button" className="btn-cancel" onClick={() => setIsCheckoutModalOpen(false)}>Close Preview</button>
                  <button
                    type="button"
                    className="btn-submit"
                    style={{ background: '#16a34a', borderColor: '#16a34a', color: '#ffffff' }}
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
                      {formatBedNumber(historyDetailsData.bed_number)}
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
                className="recep-btn-secondary"
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
