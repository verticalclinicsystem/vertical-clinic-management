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
  DollarSign, 
  CreditCard, 
  UserPlus, 
  CalendarPlus, 
  Download, 
  CheckCircle, 
  AlertCircle, 
  UserCheck, 
  X,
  User,
  ArrowRight,
  Stethoscope,
  Trash2,
  Settings,
  Bell
} from 'lucide-react';
import { api } from '../../services/api';
import './ReceptionistPortal.css';

interface ReceptionistPortalProps {
  onLogout: () => void;
}

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

export const ReceptionistPortal: React.FC<ReceptionistPortalProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<string>(() => localStorage.getItem('receptionist_portal_tab') || 'dashboard');
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
  const [includeMedicines, setIncludeMedicines] = useState<boolean>(true);
  const [includeMaterials, setIncludeMaterials] = useState<boolean>(true);
  const [customMaterialsCost, setCustomMaterialsCost] = useState<number>(0);

  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<any>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    payment_method: 'cash', // cash | card | online_upi | bank_transfer
    transaction_reference: '',
  });

  // Action loading states
  const [submitLoading, setSubmitLoading] = useState<boolean>(false);
  


  // Toast notifications state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
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

  useEffect(() => {
    if (activeTab === 'availability') {
      fetchMyRequests();
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
  const fetchPortalData = async () => {
    if (!selectedBranchId) return;
    setLoading(true);
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
      setLoading(false);
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
          `/appointments/available-slots?doctor_id=${appt.doctor_id}&date=${rescheduleDate}&branch_id=${selectedBranchId}&consultation_type=${appt.consultation_type || 'in_person'}`
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
  }, [rescheduleApptId, rescheduleDate, selectedBranchId, appointments]);

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
        new_datetime: datetimeStr
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
        
        // Auto-select latest consultation/treatment plan if available
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
      
      if (includeMaterials) {
        subtotal += Number(customMaterialsCost) || 0;
      }
    }
    setBillingForm(prev => ({
      ...prev,
      total_amount: Math.round(subtotal * 100) / 100
    }));
  }, [pendingCharges, selectedConsultationId, selectedTreatmentPlanId, includeMedicines, includeMaterials, customMaterialsCost]);

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
            { id: 'billing', icon: <DollarSign size={18} />, label: 'Billing' },
            { id: 'invoices', icon: <FileText size={18} />, label: 'Invoices' },
            { id: 'availability', icon: <Calendar size={18} />, label: 'Availability' },
          ].map(tab => (
            <div 
              key={tab.id} 
              className={`recep-nav-item ${activeTab === tab.id ? 'active' : ''}`} 
              onClick={() => setActiveTab(tab.id)}
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
          <div className="recep-title-area">
            <h2 className="recep-page-title">
              {activeTab === 'dashboard' && 'Daily Dashboard'}
              {activeTab === 'calendar' && 'Appointment Calendar'}
              {activeTab === 'queue' && 'Real-time Queue Manager'}
              {activeTab === 'checkin' && 'Patient Check-In'}
              {activeTab === 'patients' && 'Patient Directory & Intake'}
              {activeTab === 'billing' && 'Create Clinic Bill'}
              {activeTab === 'invoices' && 'Invoices & Payments'}
              {activeTab === 'availability' && 'Availability & Leave Settings'}
            </h2>
            <span className="recep-page-subtitle">
              Managing operations for front desk staff
            </span>
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
                  <button onClick={() => { setActiveTab('availability'); setIsProfileDropdownOpen(false); }}>
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
              {activeTab === 'dashboard' && (() => {
                const formatTimeToAMPM = (timeStr: string) => {
                  if (!timeStr) return '';
                  try {
                    const timePart = timeStr.includes('T') ? getLocalApptTime(timeStr) : timeStr.slice(0, 5);
                    const [hours, minutes] = timePart.split(':').map(Number);
                    const ampm = hours >= 12 ? 'PM' : 'AM';
                    const formattedHours = hours % 12 || 12;
                    return `${formattedHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
                  } catch (e) {
                    return timeStr;
                  }
                };

                const dbTodayAppointments = appointments.filter((a) => {
                  const datePart = getLocalApptDate(a.appointment_datetime);
                  return datePart === today;
                });

                let displayAppointments = [...dbTodayAppointments];
                displayAppointments.sort((a, b) => a.appointment_datetime.localeCompare(b.appointment_datetime));

                const todayApptsCount = dbTodayAppointments.length;
                const displayApptsCount = todayApptsCount;
                const displayWaitingCount = waitingToday.length;
                
                const walkInsTodayCount = appointments.filter(appt => {
                  const datePart = getLocalApptDate(appt.appointment_datetime);
                  return datePart === today && (appt.consultation_type === 'walk_in' || appt.notes?.toLowerCase().includes('walk-in'));
                }).length;
                const displayWalkInsCount = walkInsTodayCount;

                const availableDocs = doctors.filter(d => d.is_available).length;
                const totalDocs = doctors.length;
                const displayDocsRatio = totalDocs > 0 ? `${availableDocs}/${totalDocs}` : '0/0';

                const displayedRevenue = billingRevenueToday;

                const getHourGroupRevenue = (startHour: number, endHour: number): number => {
                  return invoices
                    .filter(inv => {
                      if (inv.status !== 'paid') return false;
                      const datePart = getLocalApptDate(inv.created_at);
                      if (datePart !== today) return false;
                      const d = new Date(inv.created_at);
                      const h = d.getHours();
                      return h >= startHour && h < endHour;
                    })
                    .reduce((sum, inv) => sum + inv.grand_total, 0);
                };

                const rev9AM = getHourGroupRevenue(8, 10);
                const rev11AM = getHourGroupRevenue(10, 12);
                const rev1PM = getHourGroupRevenue(12, 14);
                const rev3PM = getHourGroupRevenue(14, 16);
                const rev5PM = getHourGroupRevenue(16, 24);

                const maxRev = Math.max(rev9AM, rev11AM, rev1PM, rev3PM, rev5PM, 1);

                return (
                  <div className="recep-dashboard-view">
                    {/* Stats Grid */}
                    <div className="recep-stats-grid">
                      <div className="recep-stat-card border-indigo">
                        <div className="recep-stat-top">
                          <span className="recep-stat-icon-wrapper bg-light-purple"><Calendar size={20} /></span>
                          <span className="recep-stat-trend bg-light-green">+12%</span>
                        </div>
                        <span className="recep-stat-val">{displayApptsCount}</span>
                        <span className="recep-stat-label">Today's Appointments</span>
                      </div>

                      <div className="recep-stat-card border-orange">
                        <div className="recep-stat-top">
                          <span className="recep-stat-icon-wrapper bg-light-orange"><Clock size={20} /></span>
                        </div>
                        <span className="recep-stat-val">{displayWaitingCount}</span>
                        <span className="recep-stat-label">Waiting Patients</span>
                      </div>

                      <div className="recep-stat-card border-teal">
                        <div className="recep-stat-top">
                          <span className="recep-stat-icon-wrapper bg-light-teal"><User size={20} /></span>
                        </div>
                        <span className="recep-stat-val">{displayWalkInsCount}</span>
                        <span className="recep-stat-label">Walk-Ins Today</span>
                      </div>

                      <div className="recep-stat-card border-green">
                        <div className="recep-stat-top">
                          <span className="recep-stat-icon-wrapper bg-light-green"><Stethoscope size={20} /></span>
                        </div>
                        <span className="recep-stat-val">{displayDocsRatio}</span>
                        <span className="recep-stat-label">Doctors Available</span>
                      </div>
                    </div>

                    {/* Dashboard Row */}
                    <div className="recep-dashboard-row">
                      {/* Left Pane: Today's Appointments List */}
                      <div className="recep-card flex-2">
                        <div className="recep-card-header">
                          <h3 className="recep-card-title">Today's Appointments</h3>
                          <button className="recep-btn-primary" onClick={() => setShowBookModal(true)}>
                            <Plus size={16} /> Walk-In
                          </button>
                        </div>
                        
                        <div className="recep-table-container">
                          <table className="recep-table">
                            <thead>
                              <tr>
                                <th>ID</th>
                                <th>Patient</th>
                                <th>Doctor</th>
                                <th>Time</th>
                                <th>Status</th>
                                <th>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {displayAppointments.length === 0 ? (
                                <tr>
                                  <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                                    No appointments scheduled for today.
                                  </td>
                                </tr>
                              ) : (
                                displayAppointments.map((appt) => {
                                  const timeStr = formatTimeToAMPM(appt.appointment_datetime);
                                  const apptId = appt.appointment_number || appt.patient?.patient_code || `APT-${appt.id.toString().slice(-5).toUpperCase()}`;
                                  
                                  const isCheckedIn = appt.status === 'checked_in' || appt.status === 'Waiting';
                                  
                                  let displayStatus = appt.status;
                                  if (displayStatus === 'pending') {
                                    displayStatus = 'Waiting';
                                  } else if (displayStatus === 'confirmed') {
                                    displayStatus = 'Confirmed';
                                  } else if (displayStatus === 'completed') {
                                    displayStatus = 'Completed';
                                  } else if (displayStatus === 'cancelled') {
                                    displayStatus = 'Cancelled';
                                  }
                                  
                                  if (isCheckedIn) {
                                    displayStatus = 'Checked In';
                                  }
                                
                                let badgeClass = 'badge-pending';
                                if (displayStatus === 'Waiting') badgeClass = 'badge-waiting';
                                else if (displayStatus === 'Confirmed') badgeClass = 'badge-confirmed';
                                else if (displayStatus === 'Completed') badgeClass = 'badge-completed';
                                else if (displayStatus === 'Cancelled') badgeClass = 'badge-cancelled';
                                else if (displayStatus === 'Checked In') badgeClass = 'badge-completed';
                                
                                const showCheckInBtn = displayStatus === 'Waiting' && !isCheckedIn;
                                
                                return (
                                  <tr key={appt.id}>
                                    <td><strong className="recep-appt-id">{apptId}</strong></td>
                                    <td><strong>{appt.patient?.user?.full_name || 'Walk-in'}</strong></td>
                                    <td>Dr. {appt.doctor?.user?.full_name || 'Staff Doctor'}</td>
                                    <td>{timeStr}</td>
                                    <td>
                                      <span className={`badge ${badgeClass}`}>{displayStatus}</span>
                                    </td>
                                    <td>
                                      {showCheckInBtn && (
                                        <button 
                                          className="recep-checkin-btn-action btn-sm"
                                          onClick={() => handleCheckIn(appt.id)}
                                        >
                                          Check-In
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              }))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Right Pane: Revenue Today */}
                      <div className="recep-card flex-1">
                        <div className="recep-card-header">
                          <h3 className="recep-card-title">Revenue Today</h3>
                        </div>
                        <div className="recep-revenue-chart-card">
                          <div className="recep-revenue-header">
                            <span className="recep-revenue-title">₹{displayedRevenue.toLocaleString('en-IN')}</span>
                            <span className="recep-revenue-subtitle">Across Satellite branch</span>
                          </div>
                          
                          <div className="recep-bar-chart">
                            <div className="recep-chart-bar-container">
                              <span className="recep-chart-bar-val">₹{rev9AM.toLocaleString('en-IN')}</span>
                              <div className="recep-chart-bar-fill" style={{ height: `${(rev9AM / maxRev) * 100}%` }}></div>
                              <span className="recep-chart-bar-label">9AM</span>
                            </div>
                            <div className="recep-chart-bar-container">
                              <span className="recep-chart-bar-val">₹{rev11AM.toLocaleString('en-IN')}</span>
                              <div className="recep-chart-bar-fill" style={{ height: `${(rev11AM / maxRev) * 100}%` }}></div>
                              <span className="recep-chart-bar-label">11AM</span>
                            </div>
                            <div className="recep-chart-bar-container">
                              <span className="recep-chart-bar-val">₹{rev1PM.toLocaleString('en-IN')}</span>
                              <div className="recep-chart-bar-fill" style={{ height: `${(rev1PM / maxRev) * 100}%` }}></div>
                              <span className="recep-chart-bar-label">1PM</span>
                            </div>
                            <div className="recep-chart-bar-container">
                              <span className="recep-chart-bar-val">₹{rev3PM.toLocaleString('en-IN')}</span>
                              <div className="recep-chart-bar-fill" style={{ height: `${(rev3PM / maxRev) * 100}%` }}></div>
                              <span className="recep-chart-bar-label">3PM</span>
                            </div>
                            <div className="recep-chart-bar-container">
                              <span className="recep-chart-bar-val">₹{rev5PM.toLocaleString('en-IN')}</span>
                              <div className="recep-chart-bar-fill" style={{ height: `${(rev5PM / maxRev) * 100}%` }}></div>
                              <span className="recep-chart-bar-label">5PM</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* CALENDAR TAB */}
              {activeTab === 'calendar' && (
                <div className="recep-calendar-view">
                  {/* Calendar Toolbar */}
                  <div className="recep-calendar-toolbar">
                    <div className="toolbar-left">
                      <div className="date-picker-container">
                        <label htmlFor="calendar-date-input">Select Date</label>
                        <input
                          id="calendar-date-input"
                          type="date"
                          className="calendar-date-input"
                          value={calendarDate}
                          onChange={(e) => {
                            setCalendarDate(e.target.value);
                            setSelectedCalendarAppt(null);
                          }}
                        />
                      </div>
                      <div className="calendar-date-display">
                        <h3>
                          {new Date(calendarDate).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </h3>
                        <span className="calendar-subtitle">
                          {calendarAppointments.length} appointment{calendarAppointments.length !== 1 ? 's' : ''} scheduled
                        </span>
                      </div>
                    </div>

                    <div className="toolbar-right">
                      <button
                        className="recep-btn-primary"
                        onClick={() => setShowBookModal(true)}
                      >
                        <CalendarPlus size={16} /> New Appointment
                      </button>
                    </div>
                  </div>

                  <div className="recep-calendar-split-container">
                    {/* Left side: Calendar Grid */}
                    <div className="recep-calendar-grid-card">
                      {doctors.filter(d => d.branch_id === selectedBranchId).length === 0 ? (
                        <div className="recep-empty-state">
                          <Users size={48} />
                          <p>No doctors assigned to this branch.</p>
                        </div>
                      ) : (
                        <div className="calendar-table-wrapper">
                          <table className="calendar-grid-table">
                            <thead>
                              <tr>
                                <th className="time-col-header">Time</th>
                                {doctors
                                  .filter(d => d.branch_id === selectedBranchId)
                                  .map(doc => (
                                    <th key={doc.id} className="doc-col-header">
                                      Dr. {doc.user?.full_name || 'Staff'}
                                    </th>
                                  ))}
                              </tr>
                            </thead>
                            <tbody>
                              {[
                                { label: '09:00 AM', hour24: 9 },
                                { label: '10:00 AM', hour24: 10 },
                                { label: '11:00 AM', hour24: 11 },
                                { label: '12:00 PM', hour24: 12 },
                                { label: '01:00 PM', hour24: 13 },
                                { label: '02:00 PM', hour24: 14 },
                                { label: '03:00 PM', hour24: 15 },
                                { label: '04:00 PM', hour24: 16 },
                                { label: '05:00 PM', hour24: 17 }
                              ].map(slot => {
                                return (
                                  <tr key={slot.hour24}>
                                    <td className="time-cell">{slot.label}</td>
                                    {doctors
                                      .filter(d => d.branch_id === selectedBranchId)
                                      .map(doc => {
                                        const cellAppts = calendarAppointments.filter(a => {
                                          const localTime = getLocalApptTime(a.appointment_datetime);
                                          const apptHour = parseInt(localTime.split(':')[0] || '-1', 10);
                                          return a.doctor_id === doc.id && apptHour === slot.hour24;
                                        });

                                        return (
                                          <td key={doc.id} className="calendar-grid-cell">
                                            {cellAppts.length === 0 ? (
                                              <span className="empty-cell-dash">—</span>
                                            ) : (
                                              <div className="cell-pills-container">
                                                {cellAppts.map(appt => {
                                                  const isSelected = selectedCalendarAppt?.id === appt.id;
                                                  return (
                                                    <div
                                                      key={appt.id}
                                                      className={`calendar-appt-pill ${appt.status} ${isSelected ? 'selected' : ''}`}
                                                      onClick={() => setSelectedCalendarAppt(appt)}
                                                    >
                                                      <span className="pill-patient-name">
                                                        {appt.patient?.user?.full_name || 'Walk-in'}
                                                      </span>
                                                      <span className="pill-appt-time">
                                                        {getLocalApptTime(appt.appointment_datetime)}
                                                      </span>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            )}
                                          </td>
                                        );
                                      })}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Right side: Sidebar Pane */}
                    <div className="recep-calendar-sidebar-card">
                      {selectedCalendarAppt ? (
                        (() => {
                          const appt = appointments.find(a => a.id === selectedCalendarAppt.id) || selectedCalendarAppt;
                          return (
                            <div className="calendar-appt-detail-pane">
                              <div className="detail-pane-header">
                                <h4>Appointment Details</h4>
                                <button
                                  className="btn-close-detail"
                                  onClick={() => setSelectedCalendarAppt(null)}
                                >
                                  <X size={16} />
                                </button>
                              </div>

                              <div className="detail-pane-body">
                                <div className="detail-status-section">
                                  <span className={`badge badge-${appt.status}`}>
                                    {appt.status?.replace('_', ' ')}
                                  </span>
                                  <span className={`badge-consultation ${appt.consultation_type}`}>
                                    {appt.consultation_type === 'teleconsultation' ? 'Teleconsult' : 'In-Person'}
                                  </span>
                                </div>

                                <div className="detail-section">
                                  <span className="section-label">Patient Details</span>
                                  <div className="detail-info-block">
                                    <div className="info-row">
                                      <strong>Name:</strong>
                                      <span>{appt.patient?.user?.full_name || 'Walk-in'}</span>
                                    </div>
                                    <div className="info-row">
                                      <strong>Code:</strong>
                                      <span className="mono-text">{appt.patient?.patient_code || '—'}</span>
                                    </div>
                                    <div className="info-row">
                                      <strong>Phone:</strong>
                                      <span>{appt.patient?.user?.phone || '—'}</span>
                                    </div>
                                    <div className="info-row">
                                      <strong>Email:</strong>
                                      <span>{appt.patient?.user?.email || '—'}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="detail-section">
                                  <span className="section-label">Schedule Info</span>
                                  <div className="detail-info-block">
                                    <div className="info-row">
                                      <strong>Date:</strong>
                                      <span>{getLocalApptDate(appt.appointment_datetime)}</span>
                                    </div>
                                    <div className="info-row">
                                      <strong>Day:</strong>
                                      <span>
                                        {new Date(getLocalApptDate(appt.appointment_datetime)).toLocaleDateString('en-US', { weekday: 'long' })}
                                      </span>
                                    </div>
                                    <div className="info-row">
                                      <strong>Time Slot:</strong>
                                      <span className="time-highlight">
                                        {formatTimeToAMPM(getLocalApptTime(appt.appointment_datetime))}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="detail-section">
                                  <span className="section-label">Clinical Info</span>
                                  <div className="detail-info-block">
                                    <div className="info-row">
                                      <strong>Doctor:</strong>
                                      <span>Dr. {appt.doctor?.user?.full_name || 'Staff'}</span>
                                    </div>
                                    <div className="info-row">
                                      <strong>Treatment:</strong>
                                      <span>{appt.treatment_type}</span>
                                    </div>
                                    {appt.notes && (
                                      <div className="info-notes-row">
                                        <strong>Notes:</strong>
                                        <p>{appt.notes}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="detail-pane-actions">
                                  {rescheduleApptId === appt.id ? (
                                    <div className="reschedule-panel" style={{ marginTop: '12px', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#f8fafc', width: '100%' }}>
                                      <h5 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#1e293b' }}>Reschedule Appointment</h5>
                                      <div className="form-group" style={{ marginBottom: '8px' }}>
                                        <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '4px', fontWeight: 'bold' }}>New Date</label>
                                        <input
                                          type="date"
                                          value={rescheduleDate}
                                          onChange={(e) => {
                                            setRescheduleDate(e.target.value);
                                            setRescheduleTime('');
                                          }}
                                          style={{ width: '100%', padding: '6px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.85rem' }}
                                        />
                                      </div>
                                      <div className="form-group" style={{ marginBottom: '12px' }}>
                                        <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '4px', fontWeight: 'bold' }}>Available Time Slot</label>
                                        {loadingRescheduleSlots ? (
                                          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Loading slots...</div>
                                        ) : (
                                          <select
                                            value={rescheduleTime}
                                            onChange={(e) => setRescheduleTime(e.target.value)}
                                            style={{ width: '100%', padding: '6px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.85rem' }}
                                          >
                                            <option value="">-- Select Time Slot --</option>
                                            {rescheduleSlots
                                              .filter((s) => s.status === 'available')
                                              .map((s) => (
                                                <option key={s.time} value={s.time}>
                                                  {formatTimeToAMPM(s.time)}
                                                </option>
                                              ))}
                                          </select>
                                        )}
                                      </div>
                                      <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                          onClick={handleRescheduleSubmit}
                                          className="recep-btn-primary"
                                          style={{ flex: 1, padding: '6px', fontSize: '0.85rem' }}
                                        >
                                          Save
                                        </button>
                                        <button
                                          onClick={() => {
                                            setRescheduleApptId(null);
                                            setRescheduleDate('');
                                            setRescheduleTime('');
                                          }}
                                          className="btn-cancel"
                                          style={{ flex: 1, padding: '6px', fontSize: '0.85rem', border: '1px solid #cbd5e1', background: '#fff', borderRadius: '4px', cursor: 'pointer' }}
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      {(appt.status === 'pending' || appt.status === 'confirmed') && (
                                        <button
                                          className="btn-checkin-appt"
                                          onClick={() => handleCheckIn(appt.id)}
                                          style={{ width: '100%' }}
                                        >
                                          Check In Patient
                                        </button>
                                      )}
                                      {(appt.status === 'pending' || appt.status === 'confirmed') && (
                                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px', width: '100%' }}>
                                          <button
                                            className="btn-reschedule-appt"
                                            onClick={() => {
                                              setRescheduleApptId(appt.id);
                                              setRescheduleDate(getLocalTodayDate());
                                            }}
                                            style={{ flex: 1, padding: '8px', fontSize: '0.85rem', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                                          >
                                            <Clock size={14} /> Reschedule
                                          </button>
                                          <button
                                            className="btn-cancel-appt-action"
                                            onClick={() => handleCancel(appt.id)}
                                            style={{ flex: 1, padding: '8px', fontSize: '0.85rem', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '6px', color: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                                          >
                                            <Trash2 size={14} /> Cancel
                                          </button>
                                        </div>
                                      )}
                                    </>
                                  )}
                                  {appt.status === 'completed' && (
                                    <button
                                      className="btn-create-invoice-appt"
                                      onClick={() => {
                                        setBillingForm({
                                          patient_id: appt.patient_id,
                                          total_amount: appt.doctor?.consultation_fee || 500,
                                          discount_amount: 0,
                                          tax_amount: 0,
                                        });
                                        setActiveTab('billing');
                                      }}
                                    >
                                      Generate Invoice
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        <div className="calendar-timeline-pane">
                          <h4 className="timeline-title">Day Timeline</h4>
                          <span className="timeline-date">
                            {new Date(calendarDate).toLocaleDateString('en-US', {
                              weekday: 'long',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>

                          <div className="timeline-items-container">
                            {calendarAppointments.length === 0 ? (
                              <div className="timeline-empty">
                                <Clock size={32} />
                                <p>No appointments for this date.</p>
                              </div>
                            ) : (
                              calendarAppointments
                                .sort((a, b) => a.appointment_datetime.localeCompare(b.appointment_datetime))
                                .map(appt => {
                                  const timePart = getLocalApptTime(appt.appointment_datetime);
                                  return (
                                    <div
                                      key={appt.id}
                                      className={`timeline-item-card status-${appt.status}`}
                                      onClick={() => {
                                        setSelectedCalendarAppt(appt);
                                        setSelectedApptDetails(appt);
                                      }}
                                    >
                                      <div className="timeline-item-time">{timePart}</div>
                                      <div className="timeline-item-content">
                                        <h5>{appt.patient?.user?.full_name || 'Walk-in'}</h5>
                                        <span className="timeline-item-sub">
                                          Dr. {appt.doctor?.user?.full_name || 'Staff'} • {appt.treatment_type}
                                        </span>
                                      </div>
                                      <div className={`timeline-item-status status-${appt.status}`} />
                                    </div>
                                  );
                                })
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* QUEUE TAB (Kanban Board) */}
              {activeTab === 'queue' && (
                <div className="recep-kanban-view">
                  <div className="recep-kanban-board">
                    {/* Scheduled Lane */}
                    <div className="recep-kanban-column">
                      <div className="recep-kanban-col-header bg-gray">
                        <span>Scheduled Today</span>
                        <span className="col-count">{scheduledToday.length}</span>
                      </div>
                      <div className="recep-kanban-col-content">
                        {scheduledToday.length === 0 ? (
                          <div className="kanban-empty">No scheduled slots</div>
                        ) : (
                          scheduledToday.map((appt) => (
                            <div className="recep-kanban-card" key={appt.id} onClick={() => setSelectedApptDetails(appt)} style={{ cursor: 'pointer' }}>
                              <div className="card-top">
                                <span className="card-time">{getLocalApptTime(appt.appointment_datetime)}</span>
                                <span className={`badge-consultation ${appt.consultation_type}`}>
                                  {appt.consultation_type === 'teleconsultation' ? 'Tele' : 'In-Clinic'}
                                </span>
                              </div>
                              <h4 className="card-patient-name">{appt.patient?.user?.full_name || 'Walk-in'}</h4>
                              <span className="card-code">{appt.patient?.patient_code}</span>
                              <div className="card-meta">
                                <span>Dr. {appt.doctor?.user?.full_name || 'Staff'}</span>
                                <span>{appt.treatment_type}</span>
                              </div>
                               <div className="card-actions">
                                 <button className="btn-checkin" onClick={(e) => { e.stopPropagation(); handleCheckIn(appt.id); }}>
                                   Check In <ArrowRight size={14} />
                                 </button>
                               </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
 
                    {/* Checked In / Waiting Lane */}
                    <div className="recep-kanban-column">
                      <div className="recep-kanban-col-header bg-orange">
                        <span>Checked In / Waiting</span>
                        <span className="col-count">{waitingToday.length}</span>
                      </div>
                      <div className="recep-kanban-col-content">
                        {waitingToday.length === 0 ? (
                          <div className="kanban-empty">No patients waiting</div>
                        ) : (
                          waitingToday.map((appt) => (
                            <div className="recep-kanban-card border-orange" key={appt.id} onClick={() => setSelectedApptDetails(appt)} style={{ cursor: 'pointer' }}>
                              <div className="card-top">
                                <span className="card-time">{getLocalApptTime(appt.appointment_datetime)}</span>
                                <span className="badge badge-waiting">Waiting</span>
                              </div>
                              <h4 className="card-patient-name">{appt.patient?.user?.full_name || 'Walk-in'}</h4>
                              <span className="card-code">{appt.patient?.patient_code}</span>
                              <div className="card-meta">
                                <span>Dr. {appt.doctor?.user?.full_name || 'Staff'}</span>
                                <span>{appt.treatment_type}</span>
                              </div>
                              <p className="card-notes"><em>Wait queue...</em></p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
 
                    {/* In Consultation Lane */}
                    <div className="recep-kanban-column">
                      <div className="recep-kanban-col-header bg-blue">
                        <span>In Consultation</span>
                        <span className="col-count">{activeConsultation.length}</span>
                      </div>
                      <div className="recep-kanban-col-content">
                        {activeConsultation.length === 0 ? (
                          <div className="kanban-empty">No active cabinets</div>
                        ) : (
                          activeConsultation.map((appt) => (
                            <div className="recep-kanban-card border-blue" key={appt.id} onClick={() => setSelectedApptDetails(appt)} style={{ cursor: 'pointer' }}>
                              <div className="card-top">
                                <span className="card-time">{getLocalApptTime(appt.appointment_datetime)}</span>
                                <span className="badge badge-consultation-active">In Progress</span>
                              </div>
                              <h4 className="card-patient-name">{appt.patient?.user?.full_name || 'Walk-in'}</h4>
                              <span className="card-code">{appt.patient?.patient_code}</span>
                              <div className="card-meta">
                                <span>Dr. {appt.doctor?.user?.full_name || 'Staff'}</span>
                                <span>{appt.treatment_type}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
 
                    {/* Completed Lane */}
                    <div className="recep-kanban-column">
                      <div className="recep-kanban-col-header bg-green">
                        <span>Completed</span>
                        <span className="col-count">{completedToday.length}</span>
                      </div>
                      <div className="recep-kanban-col-content">
                        {completedToday.length === 0 ? (
                          <div className="kanban-empty">No completed cases</div>
                        ) : (
                          completedToday.map((appt) => (
                            <div className="recep-kanban-card border-green" key={appt.id} onClick={() => setSelectedApptDetails(appt)} style={{ cursor: 'pointer' }}>
                              <div className="card-top">
                                <span className="card-time">{getLocalApptTime(appt.appointment_datetime)}</span>
                                <span className="badge badge-completed">Done</span>
                              </div>
                              <h4 className="card-patient-name">{appt.patient?.user?.full_name || 'Walk-in'}</h4>
                              <span className="card-code">{appt.patient?.patient_code}</span>
                              <div className="card-meta">
                                <span>Dr. {appt.doctor?.user?.full_name || 'Staff'}</span>
                                <span>{appt.treatment_type}</span>
                              </div>
                              <div className="card-actions mt-1">
                                <button 
                                  className="btn-bill" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setBillingForm({
                                      patient_id: appt.patient_id,
                                      total_amount: appt.doctor?.consultation_fee || 500,
                                      discount_amount: 0,
                                      tax_amount: 0,
                                    });
                                    setActiveTab('billing');
                                  }}
                                >
                                  Create Invoice
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* PATIENTS TAB */}
              {activeTab === 'patients' && (
                <div className="recep-patients-view">
                  <div className="recep-card">
                    <div className="recep-card-header flex-column-mobile">
                      <div className="recep-search-wrapper">
                        <Search size={16} className="recep-search-icon" />
                        <input
                          type="text"
                          className="recep-search-input"
                          placeholder="Search patient by name, code, phone..."
                          value={patientSearchQuery}
                          onChange={(e) => setPatientSearchQuery(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && searchPatients()}
                        />
                        <button className="search-btn-action" onClick={searchPatients}>
                          Search
                        </button>
                      </div>

                      <div className="recep-header-actions">
                        <button className="recep-btn-primary" onClick={() => setShowRegisterModal(true)}>
                          <UserPlus size={16} /> New Registration
                        </button>
                      </div>
                    </div>

                    {patients.length === 0 ? (
                      <div className="recep-empty-state">
                        <Users size={48} />
                        <p>No patient records found.</p>
                      </div>
                    ) : (
                      <div className="recep-table-container">
                        <table className="recep-table">
                          <thead>
                            <tr>
                              <th>Patient Code</th>
                              <th>Name</th>
                              <th>Age / Gender</th>
                              <th>Phone</th>
                              <th>Insurance Details</th>
                              <th>Status</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {patients.map((p) => {
                              const age = p.date_of_birth 
                                ? new Date().getFullYear() - new Date(p.date_of_birth).getFullYear() 
                                : '—';
                              return (
                                <tr key={p.id}>
                                  <td><strong>{p.patient_code}</strong></td>
                                  <td>{p.user?.full_name || 'N/A'}</td>
                                  <td>{age} Yrs / {p.gender || '—'}</td>
                                  <td>{p.user?.phone || '—'}</td>
                                  <td>{p.insurance_provider ? `${p.insurance_provider} (${p.insurance_policy_no || 'No Policy'})` : 'None'}</td>
                                  <td>
                                    <span className={`badge ${p.is_active ? 'badge-completed' : 'badge-cancelled'}`}>
                                      {p.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                  </td>
                                  <td>
                                    <div className="recep-actions-row">
                                      <button 
                                        className="btn-action-book" 
                                        title="Book Appointment"
                                        onClick={() => {
                                          setSelectedPatientForBooking(p);
                                          setShowBookModal(true);
                                        }}
                                      >
                                        <CalendarPlus size={16} /> Book
                                      </button>
                                      <button 
                                        className="btn-action-bill" 
                                        title="Generate Invoice"
                                        onClick={() => {
                                          setBillingForm({
                                            patient_id: p.id,
                                            total_amount: 0,
                                            discount_amount: 0,
                                            tax_amount: 0,
                                          });
                                          setActiveTab('billing');
                                        }}
                                      >
                                        <DollarSign size={16} /> Bill
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* BILLING TAB (Create Bill) */}
              {activeTab === 'billing' && (
                <div className="recep-billing-container">
                  <div className="recep-billing-form-section">
                    <div className="recep-card">
                      <div className="recep-card-header">
                        <h3>Create New Bill</h3>
                      </div>
                      
                      <form onSubmit={handleCreateInvoice} className="recep-billing-form-body">
                        <div className="form-group">
                          <label>Select Patient *</label>
                          <select
                            required
                            className="recep-select-field"
                            value={billingForm.patient_id}
                            onChange={(e) => setBillingForm({ ...billingForm, patient_id: e.target.value })}
                          >
                            <option value="">-- Select Patient --</option>
                            {patients.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.user?.full_name} ({p.patient_code})
                              </option>
                            ))}
                          </select>
                        </div>

                        {loadingPendingCharges && (
                          <div className="form-help-text" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '1rem 0' }}>
                            <Loader2 size={16} className="pharmacy-spinner" /> Loading pending clinical charges...
                          </div>
                        )}

                        {pendingCharges && (
                          <div className="pending-charges-section" style={{ margin: '1.5rem 0', padding: '1rem', background: 'var(--surface-2)', borderRadius: '8px' }}>
                            <h4 style={{ margin: '0 0 1rem 0', color: 'var(--primary-dark)', fontSize: '0.95rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                              Clinical Breakdown
                            </h4>

                            {/* 1. Consultations selection */}
                            {pendingCharges.consultations && pendingCharges.consultations.length > 0 ? (
                              <div className="form-group" style={{ marginBottom: '1rem' }}>
                                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Select Consultation to Bill</label>
                                <select
                                  className="recep-select-field"
                                  style={{ padding: '6px 10px', fontSize: '0.9rem' }}
                                  value={selectedConsultationId || ''}
                                  onChange={(e) => setSelectedConsultationId(e.target.value || null)}
                                >
                                  <option value="">-- Do Not Bill Consultation --</option>
                                  {pendingCharges.consultations.map((c: any) => (
                                    <option key={c.id} value={c.id}>
                                      Dr. {c.doctor_name} ({new Date(c.consultation_datetime).toLocaleDateString()}) - Fee: ₹{c.consultation_fee}
                                    </option>
                                  ))}
                                </select>
                                
                                {/* 2. Medicines checkbox (if consultation is selected and has prescriptions) */}
                                {selectedConsultationId && pendingCharges.consultations.find(c => c.id === selectedConsultationId)?.prescriptions?.some((p: any) => p.items?.length > 0) && (
                                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                                    <input
                                      type="checkbox"
                                      checked={includeMedicines}
                                      onChange={(e) => setIncludeMedicines(e.target.checked)}
                                    />
                                    Include Dispensed Prescriptions/Medicines (₹{
                                      pendingCharges.consultations.find(c => c.id === selectedConsultationId)?.prescriptions?.reduce((sum: number, p: any) => 
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
                            {pendingCharges.treatment_plans && pendingCharges.treatment_plans.length > 0 ? (
                              <div className="form-group" style={{ marginBottom: '1rem' }}>
                                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Select Treatment Plan / Procedures</label>
                                <select
                                  className="recep-select-field"
                                  style={{ padding: '6px 10px', fontSize: '0.9rem' }}
                                  value={selectedTreatmentPlanId || ''}
                                  onChange={(e) => setSelectedTreatmentPlanId(e.target.value || null)}
                                >
                                  <option value="">-- Do Not Bill Treatment Plan --</option>
                                  {pendingCharges.treatment_plans.map((p: any) => (
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
                              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                                <input
                                  type="checkbox"
                                  checked={includeMaterials}
                                  onChange={(e) => setIncludeMaterials(e.target.checked)}
                                />
                                Include Used Clinical Things / Materials (₹)
                              </label>
                              {includeMaterials && (
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  className="recep-input-field"
                                  style={{ marginTop: '0.5rem', padding: '6px 10px', fontSize: '0.9rem' }}
                                  value={customMaterialsCost}
                                  onChange={(e) => setCustomMaterialsCost(parseFloat(e.target.value) || 0)}
                                  placeholder="Enter materials cost"
                                />
                              )}
                            </div>
                          </div>
                        )}

                        <div className="form-group">
                          <label>Subtotal / Combined Cost (₹) *</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            required
                            className="recep-input-field readonly"
                            readOnly
                            placeholder="Select patient to load cost"
                            value={billingForm.total_amount || ''}
                          />
                        </div>

                        <div className="form-group">
                          <label>Discount Amount (₹)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="recep-input-field"
                            placeholder="Enter discount if any"
                            value={billingForm.discount_amount || ''}
                            onChange={(e) => setBillingForm({ ...billingForm, discount_amount: parseFloat(e.target.value) || 0 })}
                          />
                        </div>

                        <div className="form-group">
                          <label>GST / Tax Amount (₹)</label>
                          <div className="gst-input-wrapper">
                            <input
                              type="number"
                              readOnly={currentUser?.role !== 'admin'}
                              className={`recep-input-field ${currentUser?.role !== 'admin' ? 'readonly' : ''}`}
                              placeholder="Calculated tax"
                              value={billingForm.tax_amount}
                              onChange={(e) => setBillingForm({ ...billingForm, tax_amount: parseFloat(e.target.value) || 0 })}
                            />
                            <span className="gst-badge">18% GST</span>
                          </div>
                          {currentUser?.role !== 'admin' ? (
                            <span className="form-help-text">GST rate is fixed at 18%. Only administrators can edit this rate.</span>
                          ) : (
                            <span className="form-help-text text-success">Admin Access: You can manually override the GST amount if needed.</span>
                          )}
                        </div>

                        <button 
                          type="submit" 
                          className="recep-btn-primary full-width" 
                          disabled={submitLoading || !billingForm.patient_id || billingForm.total_amount <= 0}
                          style={{ marginTop: '1.5rem' }}
                        >
                          {submitLoading ? 'Generating...' : 'Generate & Save Bill'}
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* Real-time Bill Receipt Preview */}
                  <div className="recep-billing-preview-section">
                    <div className="recep-card bill-receipt-card">
                      <div className="receipt-header">
                        <div className="clinic-logo-text">Vertical Clinic</div>
                        <div className="receipt-title">BILL RECEIPT PREVIEW</div>
                        <div className="receipt-meta">
                          <span>Date: {new Date().toLocaleDateString()}</span>
                          <span>Status: <span className="status-unpaid">UNPAID (Pending)</span></span>
                        </div>
                      </div>

                      <div className="receipt-divider"></div>

                      <div className="receipt-section">
                        <h4>Patient Information</h4>
                        {(() => {
                          const patient = patients.find(p => p.id === billingForm.patient_id);
                          if (!patient) return <p className="placeholder-text">No patient selected</p>;
                          return (
                            <div className="receipt-patient-details">
                              <p><strong>Name:</strong> {patient.user?.full_name}</p>
                              <p><strong>Code:</strong> {patient.patient_code}</p>
                              <p><strong>Phone:</strong> {patient.user?.phone || '—'}</p>
                            </div>
                          );
                        })()}
                      </div>

                      <div className="receipt-divider"></div>

                      <div className="receipt-section">
                        <h4>Billing Breakdowns</h4>
                        {selectedConsultationId && (() => {
                          const consultation = pendingCharges?.consultations.find(c => c.id === selectedConsultationId);
                          return (
                            <>
                              <div className="receipt-row" style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                                <span>Consultation: Dr. {consultation?.doctor_name}</span>
                                <span>₹{(consultation?.consultation_fee || 0).toFixed(2)}</span>
                              </div>
                              {includeMedicines && consultation?.prescriptions?.map((p: any) => 
                                p.items?.map((item: any, itemIdx: number) => (
                                  <div key={itemIdx} className="receipt-row" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', paddingLeft: '1rem' }}>
                                    <span>Medicine: {item.medicine_name} ({item.qty})</span>
                                    <span>₹{(item.total_price || 0).toFixed(2)}</span>
                                  </div>
                                ))
                              )}
                            </>
                          );
                        })()}

                        {selectedTreatmentPlanId && (() => {
                          const plan = pendingCharges?.treatment_plans.find(p => p.id === selectedTreatmentPlanId);
                          return plan?.procedures?.map((proc: any, procIdx: number) => (
                            <div key={procIdx} className="receipt-row" style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                              <span>Procedure: {proc.procedure_name}</span>
                              <span>₹{(proc.cost || 0).toFixed(2)}</span>
                            </div>
                          ));
                        })()}

                        {includeMaterials && (
                          <div className="receipt-row" style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                            <span>Clinical Materials &amp; Sterile Consumables</span>
                            <span>₹{Number(customMaterialsCost || 0).toFixed(2)}</span>
                          </div>
                        )}

                        {!selectedConsultationId && !selectedTreatmentPlanId && !includeMaterials && (
                          <div className="receipt-row">
                            <span>Subtotal Cost</span>
                            <span>₹{(billingForm.total_amount || 0).toFixed(2)}</span>
                          </div>
                        )}
                        
                        <div className="receipt-row">
                          <span>GST (18%)</span>
                          <span>+ ₹{(billingForm.tax_amount || 0).toFixed(2)}</span>
                        </div>
                        <div className="receipt-row text-danger">
                          <span>Discount</span>
                          <span>- ₹{(billingForm.discount_amount || 0).toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="receipt-divider"></div>

                      <div className="receipt-total-row">
                        <span>Grand Total Due</span>
                        <span className="grand-total-val">
                          ₹{Math.max(0, (billingForm.total_amount || 0) - (billingForm.discount_amount || 0) + (billingForm.tax_amount || 0)).toFixed(2)}
                        </span>
                      </div>

                      <div className="receipt-footer">
                        <p>Thank you for choosing Vertical Clinic!</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* INVOICES TAB */}
              {activeTab === 'invoices' && (
                <div className="recep-billing-view">
                  <div className="recep-card">
                    <div className="recep-card-header">
                      <div className="recep-search-wrapper">
                        <Search size={16} className="recep-search-icon" />
                        <input
                          type="text"
                          className="recep-search-input"
                          placeholder="Search invoices by patient, invoice #..."
                          value={billingSearchQuery}
                          onChange={(e) => setBillingSearchQuery(e.target.value)}
                        />
                      </div>
                      <button 
                        className="recep-btn-primary" 
                        onClick={() => {
                          setBillingForm({
                            patient_id: '',
                            total_amount: 0,
                            discount_amount: 0,
                            tax_amount: 0,
                          });
                          setActiveTab('billing');
                        }}
                      >
                        <Plus size={16} /> New Bill
                      </button>
                    </div>

                    {filteredInvoices.length === 0 ? (
                      <div className="recep-empty-state">
                        <FileText size={48} />
                        <p>No invoices matching your query.</p>
                      </div>
                    ) : (
                      <div className="recep-table-container">
                        <table className="recep-table">
                          <thead>
                            <tr>
                              <th>Invoice #</th>
                              <th>Patient</th>
                              <th>Subtotal</th>
                              <th>Discount</th>
                              <th>Tax (GST)</th>
                              <th>Grand Total</th>
                              <th>Paid</th>
                              <th>Balance Due</th>
                              <th>Status</th>
                              <th>Created</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredInvoices.map((inv) => (
                              <>
                              <tr key={inv.id}>
                                <td><strong>{inv.invoice_number}</strong></td>
                                <td>
                                  <div>{inv.patient?.user?.full_name}</div>
                                  <small style={{ color: 'var(--muted)' }}>{inv.patient?.patient_code}</small>
                                </td>
                                <td>₹{inv.total_amount.toLocaleString('en-IN')}</td>
                                <td>₹{inv.discount_amount.toLocaleString('en-IN')}</td>
                                <td>₹{inv.tax_amount.toLocaleString('en-IN')}</td>
                                <td><strong>₹{inv.grand_total.toLocaleString('en-IN')}</strong></td>
                                <td>₹{inv.amount_paid.toLocaleString('en-IN')}</td>
                                <td style={{ color: inv.balance_due > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>
                                  ₹{inv.balance_due.toLocaleString('en-IN')}
                                </td>
                                <td>
                                  <span className={`badge ${
                                    inv.status === 'paid' ? 'badge-completed' :
                                    inv.status === 'partially_paid' ? 'badge-confirmed' :
                                    inv.status === 'cancelled' ? 'badge-cancelled' : 'badge-pending'
                                  }`}>
                                    {inv.status === 'paid' ? 'Paid' :
                                     inv.status === 'partially_paid' ? 'Partial' :
                                     inv.status === 'cancelled' ? 'Cancelled' : 'Unpaid'}
                                  </span>
                                </td>
                                <td>{new Date(inv.created_at).toLocaleDateString()}</td>
                                <td>
                                  <div className="recep-actions-row">
                                    {inv.balance_due > 0 && (
                                      <button 
                                        className="btn-pay"
                                        onClick={() => {
                                          setSelectedInvoiceForPayment(inv);
                                          setPaymentForm({
                                            amount: inv.balance_due,
                                            payment_method: 'cash',
                                            transaction_reference: '',
                                          });
                                          setShowPaymentModal(true);
                                        }}
                                      >
                                        <CreditCard size={14} /> Pay
                                      </button>
                                    )}
                                    <button 
                                      className="btn-download"
                                      onClick={() => handleDownloadPDF(inv.id, inv.invoice_number)}
                                      title="Download PDF Receipt"
                                    >
                                      <Download size={14} /> Receipt
                                    </button>
                                  </div>
                                </td>
                              </tr>
                              {/* Medicine Breakdown Row */}
                              {inv.prescription_items && inv.prescription_items.length > 0 && (
                                <tr key={`${inv.id}-medicines`} style={{ background: '#f8faff' }}>
                                  <td colSpan={11} style={{ padding: '8px 16px 12px 32px' }}>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3b82f6', marginRight: '4px' }}>💊 Medicines:</span>
                                      {inv.prescription_items.map((med: any, midx: number) => (
                                        <span key={midx} style={{
                                          background: '#eff6ff',
                                          color: '#1e40af',
                                          borderRadius: '20px',
                                          padding: '2px 10px',
                                          fontSize: '0.75rem',
                                          fontWeight: 600,
                                          border: '1px solid #bfdbfe',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px'
                                        }}>
                                          {med.medicine_name}
                                          <span style={{ color: '#6b7280', fontWeight: 400 }}>{med.dosage} · {med.duration}</span>
                                        </span>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              )}
                              </>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* CHECK-IN TAB */}
              {activeTab === 'checkin' && (
                <div className="recep-checkin-container">
                  {/* Left Column: Search & Patient List */}
                  <div className="recep-checkin-search-section">
                    <div className="recep-card">
                      <div className="recep-card-header">
                        <h3>Today's Patient List</h3>
                      </div>
                      <div className="recep-checkin-search-bar-wrapper">
                        <Search size={18} className="recep-search-icon-inside" />
                        <input
                          type="text"
                          className="recep-checkin-search-input"
                          placeholder="Search today's patients by name, code or phone..."
                          value={checkInSearchQuery}
                          onChange={(e) => setCheckInSearchQuery(e.target.value)}
                        />
                      </div>

                      <div className="recep-checkin-patient-list">
                        {checkInFilteredAppointments.length === 0 ? (
                          <div className="recep-empty-state" style={{ padding: '2rem' }}>
                            <Users size={32} />
                            <p>No patients scheduled for today.</p>
                          </div>
                        ) : (
                          checkInFilteredAppointments.map((appt) => {
                            const isSelected = selectedApptForCheckIn?.id === appt.id;
                            const p = appt.patient;
                            const timeStr = getLocalApptTime(appt.appointment_datetime);
                            const [hour, minute] = timeStr.split(':');
                            const formattedTime = `${parseInt(hour) % 12 || 12}:${minute} ${parseInt(hour) >= 12 ? 'PM' : 'AM'}`;
                            
                            return (
                              <div 
                                key={appt.id}
                                className={`recep-checkin-patient-card ${isSelected ? 'selected' : ''}`}
                                onClick={() => setSelectedApptForCheckIn(appt)}
                              >
                                <div className="patient-avatar-circle">
                                  {p?.user?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'PT'}
                                </div>
                                <div className="patient-details">
                                  <span className="patient-name">{p?.user?.full_name || 'N/A'}</span>
                                  <span className="patient-code-phone">
                                    {p?.patient_code} &middot; {p?.user?.phone || '—'}
                                  </span>
                                  <span style={{ fontSize: '0.78rem', color: 'var(--primary)', marginTop: '2px', display: 'block', fontWeight: 500 }}>
                                    Time: {formattedTime} &middot; Reason: {appt.treatment_type}
                                  </span>
                                </div>
                                <div className="patient-actions" onClick={(e) => e.stopPropagation()}>
                                  {appt.status === 'completed' ? (
                                    <span className="badge badge-completed" style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }}>Completed</span>
                                  ) : appt.status === 'in_consultation' || appt.status === 'In Consultation' ? (
                                    <span className="badge badge-confirmed" style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}>In Consultation</span>
                                  ) : appt.status === 'checked_in' || appt.status === 'Waiting' ? (
                                    <span className="badge badge-completed">Checked In</span>
                                  ) : (
                                    <button 
                                      className="recep-checkin-btn-action"
                                      onClick={() => handleCheckIn(appt.id)}
                                    >
                                      <UserCheck size={16} /> Check In
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Today's Appointment Detail */}
                  <div className="recep-checkin-detail-section">
                    <div className="recep-card">
                      <div className="recep-card-header">
                        <h3>Appointment Details</h3>
                      </div>
                      
                      {selectedApptForCheckIn ? (
                        (() => {
                          const appt = appointments.find(a => a.id === selectedApptForCheckIn.id);
                          if (!appt || appt.status === 'cancelled' || appt.status === 'rejected') {
                            return (
                              <div className="recep-checkin-detail-empty">
                                <AlertCircle size={32} className="warning-icon" />
                                <p className="title">Appointment Cancelled or Rejected</p>
                                <p className="subtitle">This appointment is no longer active.</p>
                              </div>
                            );
                          }
                          
                          // Format appointment time
                          const timeStr = getLocalApptTime(appt.appointment_datetime);
                          const [hour, minute] = timeStr.split(':');
                          const formattedTime = `${parseInt(hour) % 12 || 12}:${minute} ${parseInt(hour) >= 12 ? 'PM' : 'AM'}`;

                          return (
                            <div className="recep-checkin-detail-body">
                              <div className="detail-row">
                                <span className="label">Appointment ID</span>
                                <span className="value text-primary font-bold">APT-{appt.id.slice(0, 5).toUpperCase()}</span>
                              </div>
                              <div className="detail-row">
                                <span className="label">Patient Name</span>
                                <span className="value font-medium">{appt.patient?.user?.full_name}</span>
                              </div>
                              <div className="detail-row">
                                <span className="label">Phone Number</span>
                                <span className="value font-medium">{appt.patient?.user?.phone || '—'}</span>
                              </div>
                              <div className="detail-row">
                                <span className="label">Reason / Type</span>
                                <span className="value font-medium">{appt.treatment_type}</span>
                              </div>
                              <div className="detail-row">
                                <span className="label">Doctor Assigned</span>
                                <span className="value font-medium">Dr. {appt.doctor?.user?.full_name || 'N/A'}</span>
                              </div>
                              <div className="detail-row">
                                <span className="label">Scheduled Time</span>
                                <span className="value font-medium">{formattedTime}</span>
                              </div>
                              {appt.notes && (
                                <div className="detail-row" style={{ display: 'block', marginTop: '8px' }}>
                                  <span className="label" style={{ display: 'block', marginBottom: '4px' }}>Notes / Reason details</span>
                                  <span className="value" style={{ display: 'block', padding: '8px', backgroundColor: 'var(--surface-2)', borderRadius: '6px', fontSize: '0.85rem' }}>
                                    {appt.notes}
                                  </span>
                                </div>
                              )}
                              
                              <div className="detail-divider"></div>
                              
                              {appt.status === 'completed' ? (
                                <div className="checked-in-status-box" style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', marginTop: '1rem' }}>
                                  <CheckCircle size={20} /> Consultation Completed
                                </div>
                              ) : appt.status === 'in_consultation' || appt.status === 'In Consultation' ? (
                                <div className="checked-in-status-box" style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', marginTop: '1rem' }}>
                                  <CheckCircle size={20} /> Currently In Consultation
                                </div>
                              ) : appt.status === 'checked_in' || appt.status === 'Waiting' ? (
                                <div className="checked-in-status-box">
                                  <CheckCircle size={20} /> Checked In & Added to Queue
                                </div>
                              ) : (
                                <>
                                  <p className="detail-notice">
                                    Once checked in, the patient will be added to the queue and the doctor will be notified automatically.
                                  </p>
                                  <button 
                                    className="recep-btn-primary full-width"
                                    style={{ marginTop: '1.5rem' }}
                                    onClick={() => handleCheckIn(appt.id)}
                                  >
                                    <UserCheck size={18} /> Check In Patient
                                  </button>
                                </>
                              )}
                            </div>
                          );
                        })()
                      ) : (
                        <div className="recep-checkin-detail-empty">
                          <Users size={32} />
                          <p className="title">Select a Patient</p>
                          <p className="subtitle">Click on a patient from the list to view and verify their appointment details.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: AVAILABILITY SETTINGS MANAGER */}
              {activeTab === 'availability' && (
                <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px 0', width: '100%' }}>
                  {/* Top Banner Accent */}
                  <div style={{
                    background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)',
                    color: '#ffffff',
                    padding: '24px 28px',
                    borderRadius: '12px',
                    marginBottom: '24px',
                    boxShadow: '0 4px 12px rgba(15, 118, 110, 0.08)'
                  }}>
                    <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Calendar size={22} /> Availability & Schedule Settings
                    </h2>
                    <p style={{ margin: '8px 0 0 0', fontSize: '0.85rem', color: '#ccfbf1', lineHeight: 1.4, opacity: 0.9 }}>
                      Your shift timings are synchronized with branch operating parameters. If you need to take leaves, please click <strong>Request Leave</strong> to submit a leave application to the clinic admin for approval.
                    </p>
                    <div style={{ marginTop: '16px' }}>
                      <button
                        onClick={() => setIsRequestingChange(true)}
                        style={{
                          backgroundColor: '#ffffff',
                          color: '#0f766e',
                          border: 'none',
                          padding: '10px 20px',
                          borderRadius: '8px',
                          fontWeight: '700',
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}
                      >
                        <Plus size={16} /> Request Leave
                      </button>
                    </div>
                  </div>

                  {/* Read-only availability parameters */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '24px' }}>
                    
                    {/* Working Hours Card */}
                    <div className="recep-card" style={{ 
                      padding: '24px', 
                      marginBottom: 0, 
                      borderRadius: '16px', 
                      background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)', 
                      border: '1px solid #bbf7d0',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      cursor: 'default',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)';
                    }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <div style={{ 
                          width: '40px', 
                          height: '40px', 
                          borderRadius: '12px', 
                          backgroundColor: '#dcfce7', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center' 
                        }}>
                          <Clock size={20} color="#16a34a" />
                        </div>
                        <span style={{ fontSize: '1rem', fontWeight: '700', color: '#14532d' }}>Working Hours</span>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.8rem', color: '#166534', fontWeight: '500', marginBottom: '4px' }}>Daily Shift Hours</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#15803d', letterSpacing: '-0.5px' }}>
                          {(() => {
                            const userBranch = branches.find(b => b.id === selectedBranchId) || branches[0];
                            const formatHour = (timeStr: string) => {
                              if (!timeStr) return '';
                              return timeStr.slice(0, 5);
                            };
                            const start = userBranch ? formatHour(userBranch.opening_hour) : '09:00';
                            const end = userBranch ? formatHour(userBranch.closing_hour) : '21:00';
                            return `${start} - ${end}`;
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Operational Breaks Card */}
                    <div className="recep-card" style={{ 
                      padding: '24px', 
                      marginBottom: 0, 
                      borderRadius: '16px', 
                      background: 'linear-gradient(135deg, #ffffff 0%, #fffbeb 100%)', 
                      border: '1px solid #fde68a',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      cursor: 'default',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)';
                    }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <div style={{ 
                          width: '40px', 
                          height: '40px', 
                          borderRadius: '12px', 
                          backgroundColor: '#fef3c7', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center' 
                        }}>
                          <Clock size={20} color="#d97706" />
                        </div>
                        <span style={{ fontSize: '1rem', fontWeight: '700', color: '#78350f' }}>Operational Breaks</span>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.8rem', color: '#92400e', fontWeight: '500', marginBottom: '4px' }}>Daily Lunch Break</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#b45309', letterSpacing: '-0.5px' }}>13:00 - 14:00</div>
                      </div>
                    </div>
                  </div>

                  {/* Leave Requests History */}
                  <div className="recep-card" style={{ padding: '24px' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--recep-text-dark)', marginBottom: '12px' }}>
                      Leave Requests History
                    </h3>
                    {myRequests.length === 0 ? (
                      <p style={{ fontSize: '0.85rem', color: 'var(--recep-text-muted)', margin: 0 }}>You have not submitted any leave requests yet.</p>
                    ) : (
                      <div className="recep-table-container" style={{ margin: 0, overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid var(--recep-border)', textAlign: 'left' }}>
                              <th style={{ padding: '10px 8px' }}>Type</th>
                              <th style={{ padding: '10px 8px' }}>Requested Dates</th>
                              <th style={{ padding: '10px 8px' }}>Reason</th>
                              <th style={{ padding: '10px 8px' }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {myRequests.map((req: any) => {
                              const propStr = `${req.proposed_start_date} to ${req.proposed_end_date}`;
                              return (
                                <tr key={req.id} style={{ borderBottom: '1px solid var(--recep-border)' }}>
                                  <td style={{ padding: '12px 8px', fontWeight: 600 }}>Leave</td>
                                  <td style={{ padding: '12px 8px' }}>{propStr}</td>
                                  <td style={{ padding: '12px 8px' }}>{req.reason}</td>
                                  <td style={{ padding: '12px 8px' }}>
                                    <span style={{
                                      display: 'inline-block',
                                      padding: '4px 8px',
                                      borderRadius: '6px',
                                      fontSize: '0.75rem',
                                      fontWeight: 600,
                                      textTransform: 'uppercase',
                                      backgroundColor: 
                                        req.status === 'approved' ? '#dcfce7' : 
                                        req.status === 'rejected' ? '#fee2e2' : '#fef3c7',
                                      color: 
                                        req.status === 'approved' ? '#15803d' : 
                                        req.status === 'rejected' ? '#b91c1c' : '#b45309'
                                    }}>
                                      {req.status}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
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
                  <input 
                    type="date" 
                    required
                    value={reqStartDate}
                    onChange={(e) => setReqStartDate(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>End Date</label>
                  <input 
                    type="date" 
                    required
                    value={reqEndDate}
                    onChange={(e) => setReqEndDate(e.target.value)}
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
                  <input 
                    type="date" 
                    value={registerForm.date_of_birth} 
                    onChange={e => setRegisterForm({ ...registerForm, date_of_birth: e.target.value })}
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
                        Dr. {doc.user?.full_name} ({doc.specialization})
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
                  <input 
                    type="date" 
                    required 
                    min={today}
                    value={bookingForm.appointment_date} 
                    onChange={e => setBookingForm({ ...bookingForm, appointment_date: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Available Slots *</label>
                  <select 
                    required
                    disabled={loadingSlots || !bookingForm.doctor_id || !bookingForm.appointment_date}
                    value={bookingForm.appointment_time} 
                    onChange={e => setBookingForm({ ...bookingForm, appointment_time: e.target.value })}
                  >
                    <option value="">{loadingSlots ? 'Calculating...' : 'Select Slot'}</option>
                    {availableSlots
                      .filter((s: any) => s.status === 'available')
                      .map((slot: any) => (
                        <option key={slot.time} value={slot.time}>
                          {formatTimeToAMPM(slot.time)}
                        </option>
                      ))}
                  </select>
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
                    placeholder="E.g., Walk-in, patient complaining of toothache."
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
                <DollarSign size={16} />
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
                    <div><strong>Doctor:</strong> Dr. {selectedApptDetails.doctor?.user?.full_name || 'Staff'}</div>
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
    </div>
  );
};
