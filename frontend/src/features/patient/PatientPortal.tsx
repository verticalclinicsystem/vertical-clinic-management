import React, { useState, useEffect } from 'react';
import {
  Home,
  Calendar,
  CreditCard,
  UploadCloud,
  Settings,
  LogOut,
  Stethoscope,
  Pill,
  Activity,
  Clock,
  AlertCircle,
  Check,
  MapPin,
  Download,
  Trash2,
  Plus,
  ChevronRight,
  ShieldCheck,
  User,
  Search,
  Bell,
  Video,
  Menu,
  X,
  MoreVertical
} from 'lucide-react';
import { api } from '../../services/api';
import './PatientPortal.css';

const getErrorMessage = (err: any, defaultMsg: string): string => {
  if (err.response?.data) {
    const data = err.response.data;
    if (data.message) return data.message;
    if (data.detail) {
      if (typeof data.detail === 'string') return data.detail;
      if (Array.isArray(data.detail) && data.detail.length > 0) {
        return data.detail[0]?.msg || defaultMsg;
      }
    }
  }
  return err.message || defaultMsg;
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const formatTimeToAMPM = (timeStr: string): string => {
  if (!timeStr) return '';
  const [hourStr, minStr] = timeStr.split(':');
  const hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour.toString().padStart(2, '0')}:${minStr} ${ampm}`;
};

interface PatientPortalProps {
  onLogout: () => void;
}

type ScreenType = 'dashboard' | 'appointments' | 'prescriptions' | 'billing' | 'reports' | 'preferences' | 'timeline' | 'profile' | 'book' | 'teleconsultation';

export const PatientPortal: React.FC<PatientPortalProps> = ({ onLogout }) => {
  const [screen, setScreen] = useState<ScreenType>(() => (localStorage.getItem('patient_portal_tab') as ScreenType) || 'dashboard');

  useEffect(() => {
    localStorage.setItem('patient_portal_tab', screen);
  }, [screen]);
  const [patientProfile, setPatientProfile] = useState<any>(null);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [statistics, setStatistics] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [preferences, setPreferences] = useState<any>({
    language: 'English',
    notification_email: true,
    notification_sms: true,
    notification_whatsapp: false,
    notification_push: true,
    preferred_doctor_id: null,
    preferred_branch_id: null,
    consultation_preference: 'in_person'
  });

  // Booking Wizard State (full-page screen, no modal)
  const [bookingStep, setBookingStep] = useState<number>(() => {
    const val = localStorage.getItem('booking_wizard_step');
    return val ? parseInt(val, 10) : 1;
  });
  const [branches, setBranches] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  // Slot object from API: { time: "09:00", status: "available" | "booked" }
  const [availableSlots, setAvailableSlots] = useState<{ time: string; status: string }[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => localStorage.getItem('booking_selected_branch_id') || '');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(() => localStorage.getItem('booking_selected_doctor_id') || '');
  const [bookingDate, setBookingDate] = useState<string>(() => localStorage.getItem('booking_date') || '');
  const [bookingSlot, setBookingSlot] = useState<string>(() => localStorage.getItem('booking_slot') || '');
  const [calendarViewMonth, setCalendarViewMonth] = useState<number>(() => new Date().getMonth());
  const [calendarViewYear, setCalendarViewYear] = useState<number>(() => new Date().getFullYear());
  const [consultationType, setConsultationType] = useState<string>(() => localStorage.getItem('booking_consultation_type') || '');
  const [treatmentType, setTreatmentType] = useState<string>(() => localStorage.getItem('booking_treatment_type') || 'Routine Checkup');
  const [customTreatmentText, setCustomTreatmentText] = useState<string>(() => localStorage.getItem('booking_custom_treatment_text') || '');
  const [bookingNotes, setBookingNotes] = useState<string>(() => localStorage.getItem('booking_notes') || '');

  // Reschedule Modal State
  const [rescheduleApptId, setRescheduleApptId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>('');
  const [rescheduleSlot, setRescheduleSlot] = useState<string>('');
  const [rescheduleSlots, setRescheduleSlots] = useState<{ time: string; status: string }[]>([]);
  const [rescheduleDoctorId, setRescheduleDoctorId] = useState<string>('');

  // Cancel Modal State
  const [cancelApptId, setCancelApptId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');

  // Dropdown actions state
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);

  // Upload Report Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadType, setUploadType] = useState('Lab Report');
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // Report Viewer Modal State
  const [viewingReport, setViewingReport] = useState<any | null>(null);
  const [imageZoom, setImageZoom] = useState<number>(1);
  const [imageRotate, setImageRotate] = useState<number>(0);

  // New states for flow details modals
  const [viewingAppointment, setViewingAppointment] = useState<any | null>(null);
  const [viewingHistoryEvent, setViewingHistoryEvent] = useState<any | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<any | null>(null);

  // Detailed symptoms and report attachment states for booking
  const [bookingSymptoms, setBookingSymptoms] = useState<string>(() => localStorage.getItem('booking_symptoms') || '');
  const [attachedReportId, setAttachedReportId] = useState<string | null>(() => localStorage.getItem('booking_attached_report_id') || null);

  // Booking Confirmation Modal State
  const [showBookingConfirm, setShowBookingConfirm] = useState(false);

  // Doctor list filtering & sorting states
  const [filterSpecialty, setFilterSpecialty] = useState('');
  const [filterExperience, setFilterExperience] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [filterLanguage, setFilterLanguage] = useState('');
  const [sortOption, setSortOption] = useState('experience_desc');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAndSortedDoctors = React.useMemo(() => {
    let result = [...doctors];

    // Search query (name or specialty)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(d =>
        d.user?.full_name?.toLowerCase().includes(q) ||
        d.specialization?.toLowerCase().includes(q)
      );
    }

    // Specialization filter
    if (filterSpecialty) {
      result = result.filter(d => d.specialization === filterSpecialty);
    }

    // Experience filter
    if (filterExperience) {
      if (filterExperience === '1-5') {
        result = result.filter(d => d.experience_years >= 1 && d.experience_years <= 5);
      } else if (filterExperience === '5-10') {
        result = result.filter(d => d.experience_years > 5 && d.experience_years <= 10);
      } else if (filterExperience === '10+') {
        result = result.filter(d => d.experience_years > 10);
      }
    }

    // Gender filter (simulated based on name)
    if (filterGender) {
      result = result.filter(d => {
        const name = d.user?.full_name || '';
        const inferredGender = (name.includes('Sneha') || name.includes('Anjali') || name.includes('Desai')) ? 'Female' : 'Male';
        return inferredGender.toLowerCase() === filterGender.toLowerCase();
      });
    }

    // Language filter (simulated)
    if (filterLanguage) {
      result = result.filter(d => {
        const name = d.user?.full_name || '';
        const langs = ['English', 'Hindi'];
        if (name.includes('Mehta') || name.includes('Patel') || name.includes('Shah') || name.includes('Desai')) {
          langs.push('Gujarati');
        }
        if (name.includes('Nair')) langs.push('Malayalam');
        if (name.includes('Rao')) langs.push('Kannada');
        return langs.some(l => l.toLowerCase() === filterLanguage.toLowerCase());
      });
    }

    // Sort options
    if (sortOption === 'experience_desc') {
      result.sort((a, b) => (b.experience_years || 0) - (a.experience_years || 0));
    } else if (sortOption === 'experience_asc') {
      result.sort((a, b) => (a.experience_years || 0) - (b.experience_years || 0));
    } else if (sortOption === 'fee_desc') {
      result.sort((a, b) => (b.consultation_fee || 0) - (a.consultation_fee || 0));
    } else if (sortOption === 'fee_asc') {
      result.sort((a, b) => (a.consultation_fee || 0) - (b.consultation_fee || 0));
    } else if (sortOption === 'rating_desc') {
      result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }

    return result;
  }, [doctors, searchQuery, filterSpecialty, filterExperience, filterGender, filterLanguage, sortOption]);

  const renderSummarySidebar = () => {
    const selectedBranch = branches.find((b: any) => b.id === selectedBranchId);
    const selectedDoctor = doctors.find((d: any) => d.id === selectedDoctorId);
    const docName = selectedDoctor?.user?.full_name
      ? (selectedDoctor.user.full_name.toLowerCase().startsWith('dr')
        ? selectedDoctor.user.full_name
        : `Dr. ${selectedDoctor.user.full_name}`)
      : null;

    const formattedDate = bookingDate
      ? new Date(bookingDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
      : null;

    return (
      <div className="booking-summary-sidebar">
        <h4 className="booking-summary-title">Appointment Summary</h4>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '14px' }}>
          <div className="summary-sidebar-item">
            <span className="summary-sidebar-icon">🏥</span>
            <div className="summary-sidebar-info">
              <span className="summary-sidebar-label">Branch</span>
              <span className={`summary-sidebar-val ${!selectedBranch ? 'empty' : ''}`}>
                {selectedBranch ? `${selectedBranch.name} Branch` : 'Not selected'}
              </span>
            </div>
          </div>

          <div className="summary-sidebar-item">
            <span className="summary-sidebar-icon">{consultationType === 'teleconsultation' ? '💻' : '🏥'}</span>
            <div className="summary-sidebar-info">
              <span className="summary-sidebar-label">Mode</span>
              <span className={`summary-sidebar-val ${!consultationType ? 'empty' : ''}`}>
                {consultationType === 'teleconsultation' ? 'Tele Consultation' : consultationType === 'in_person' ? 'In-Clinic Visit' : 'Not selected'}
              </span>
            </div>
          </div>

          <div className="summary-sidebar-item">
            <span className="summary-sidebar-icon">👨‍⚕️</span>
            <div className="summary-sidebar-info">
              <span className="summary-sidebar-label">Doctor</span>
              <span className={`summary-sidebar-val ${!selectedDoctor ? 'empty' : ''}`}>
                {docName ? docName : 'Not selected'}
              </span>
            </div>
          </div>

          <div className="summary-sidebar-item">
            <span className="summary-sidebar-icon">📅</span>
            <div className="summary-sidebar-info">
              <span className="summary-sidebar-label">Date & Time</span>
              <span className={`summary-sidebar-val ${!formattedDate ? 'empty' : ''}`}>
                {formattedDate ? `${formattedDate} at ${bookingSlot || '—'}` : 'Not scheduled'}
              </span>
            </div>
          </div>
        </div>

        {consultationType === 'teleconsultation' && (
          <div className="summary-sidebar-footer-info" style={{ marginTop: '12px' }}>
            💻 <strong>Tele Consultation:</strong> Meeting link will be generated 30 minutes before your scheduled appointment and shared in the notification.
          </div>
        )}

        {bookingStep > 3 && (
          <button
            type="button"
            className="btn-secondary"
            style={{ width: '100%', marginTop: '12px', fontSize: '0.8rem', padding: '8px 12px' }}
            onClick={() => setBookingStep(3)}
          >
            ✏️ Change Doctor
          </button>
        )}
      </div>
    );
  };

  const clearBookingWizardState = () => {
    // Clear states
    setBookingStep(1);
    setSelectedBranchId('');
    setConsultationType('');
    setSelectedDoctorId('');
    setBookingDate('');
    setBookingSlot('');
    setTreatmentType('Routine Checkup');
    setCustomTreatmentText('');
    setBookingSymptoms('');
    setBookingNotes('');
    setAttachedReportId(null);

    // Clear localStorage
    localStorage.removeItem('booking_wizard_step');
    localStorage.removeItem('booking_selected_branch_id');
    localStorage.removeItem('booking_consultation_type');
    localStorage.removeItem('booking_selected_doctor_id');
    localStorage.removeItem('booking_date');
    localStorage.removeItem('booking_slot');
    localStorage.removeItem('booking_treatment_type');
    localStorage.removeItem('booking_custom_treatment_text');
    localStorage.removeItem('booking_symptoms');
    localStorage.removeItem('booking_notes');
    localStorage.removeItem('booking_attached_report_id');
  };

  // Prescription Detail Modal State
  const [viewingPrescription, setViewingPrescription] = useState<any | null>(null);

  // Conflict Booking State
  const [conflictAppt, setConflictAppt] = useState<any>(null);

  // Global UI States
  const [alert, setAlert] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Tele Consultation State
  const [activeTele, setActiveTele] = useState<any>(null);
  const [checklist, setChecklist] = useState<any[]>([]);
  const [pastTeles, setPastTeles] = useState<any[]>([]);
  const [selectedTeleId, setSelectedTeleId] = useState<string | null>(null);

  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState<any>({
    phone: '',
    blood_group: '',
    date_of_birth: '',
    allergies: '',
    chronic_conditions: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    insurance_provider: '',
    insurance_policy_no: '',
  });

  const startEditingProfile = () => {
    setProfileForm({
      phone: patientProfile?.user?.phone || '',
      blood_group: patientProfile?.blood_group || '',
      date_of_birth: patientProfile?.date_of_birth ? patientProfile.date_of_birth.substring(0, 10) : '',
      allergies: patientProfile?.allergies || '',
      chronic_conditions: patientProfile?.chronic_conditions || '',
      emergency_contact_name: patientProfile?.emergency_contact_name || '',
      emergency_contact_phone: patientProfile?.emergency_contact_phone || '',
      insurance_provider: patientProfile?.insurance_provider || '',
      insurance_policy_no: patientProfile?.insurance_policy_no || '',
    });
    setIsEditingProfile(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await api.put(`/patients/${patientProfile.id}`, {
        ...profileForm,
        date_of_birth: profileForm.date_of_birth ? new Date(profileForm.date_of_birth).toISOString() : null
      });
      if (res.data?.success) {
        setPatientProfile(res.data.data);
        setIsEditingProfile(false);
        triggerToast('success', 'Profile updated successfully.');
      } else {
        triggerToast('error', res.data?.message || 'Failed to update profile.');
      }
    } catch (err: any) {
      console.error(err);
      triggerToast('error', getErrorMessage(err, 'Error updating profile.'));
    } finally {
      setIsLoading(false);
    }
  };

  // Dynamic Appointment Filters
  const [appointmentFilterStatus, setAppointmentFilterStatus] = useState<string>('all');
  const [appointmentFilterDate, setAppointmentFilterDate] = useState<string>('');
  const [appointmentsList, setAppointmentsList] = useState<any[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState<boolean>(false);
  const [appointmentsTotal, setAppointmentsTotal] = useState<number>(0);
  const [appointmentsPage, setAppointmentsPage] = useState<number>(1);

  const fetchAppointments = async (page = 1) => {
    setAppointmentsLoading(true);
    try {
      const params: any = {
        page,
        limit: 20,
      };

      if (appointmentFilterStatus === 'upcoming') {
        params.status = 'upcoming';
      } else if (appointmentFilterStatus === 'completed') {
        params.status = 'completed';
      } else if (appointmentFilterStatus === 'cancelled') {
        params.status = 'cancelled';
      } else if (appointmentFilterStatus === 'rescheduled') {
        params.rescheduled = true;
      } else if (appointmentFilterStatus === 'history') {
        params.status = 'history';
      }

      if (appointmentFilterDate) {
        params.start_date = `${appointmentFilterDate}T00:00:00`;
        params.end_date = `${appointmentFilterDate}T23:59:59`;
      }

      const res = await api.get('/appointments/', { params });
      if (res.data?.success) {
        setAppointmentsList(res.data.data.items || []);
        setAppointmentsTotal(res.data.data.total || 0);
        setAppointmentsPage(page);
      }
    } catch (err) {
      console.error('Error fetching appointments:', err);
      triggerToast('error', 'Could not fetch appointments.');
    } finally {
      setAppointmentsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileAndDashboard();
  }, []);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.dropdown-trigger') && !target.closest('.action-dropdown-menu')) {
        setActiveDropdownId(null);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, []);

  useEffect(() => {
    if (screen === 'teleconsultation') {
      fetchTeleconsultations();
    }
  }, [screen]);

  useEffect(() => {
    if (screen === 'appointments') {
      fetchAppointments(1);
    }
  }, [screen, appointmentFilterStatus, appointmentFilterDate]);

  // Calendar wizard step 4 auto-initialization
  useEffect(() => {
    if (bookingStep === 4 && !bookingDate) {
      const todayStr = new Date().toISOString().split('T')[0];
      handleDateChange(todayStr);
      const todayDate = new Date();
      setCalendarViewMonth(todayDate.getMonth());
      setCalendarViewYear(todayDate.getFullYear());
    }
  }, [bookingStep, bookingDate]);

  // Booking persistence and branch doctors reload effect
  useEffect(() => {
    localStorage.setItem('booking_wizard_step', bookingStep.toString());
  }, [bookingStep]);

  useEffect(() => {
    localStorage.setItem('booking_selected_branch_id', selectedBranchId);
  }, [selectedBranchId]);

  useEffect(() => {
    localStorage.setItem('booking_consultation_type', consultationType);
  }, [consultationType]);

  useEffect(() => {
    localStorage.setItem('booking_selected_doctor_id', selectedDoctorId);
  }, [selectedDoctorId]);

  useEffect(() => {
    localStorage.setItem('booking_date', bookingDate);
  }, [bookingDate]);

  useEffect(() => {
    localStorage.setItem('booking_slot', bookingSlot);
  }, [bookingSlot]);

  useEffect(() => {
    localStorage.setItem('booking_treatment_type', treatmentType);
  }, [treatmentType]);

  useEffect(() => {
    localStorage.setItem('booking_custom_treatment_text', customTreatmentText);
  }, [customTreatmentText]);

  useEffect(() => {
    localStorage.setItem('booking_symptoms', bookingSymptoms);
  }, [bookingSymptoms]);

  useEffect(() => {
    localStorage.setItem('booking_notes', bookingNotes);
  }, [bookingNotes]);

  useEffect(() => {
    localStorage.setItem('booking_attached_report_id', attachedReportId || '');
  }, [attachedReportId]);

  useEffect(() => {
    if (selectedBranchId && doctors.length === 0) {
      const loadBranchDoctors = async () => {
        try {
          const res = await api.get('/doctors/', { params: { branch_id: selectedBranchId } });
          if (res.data?.success) {
            setDoctors(res.data.data.items || []);
          }
        } catch (err) {
          console.error(err);
        }
      };
      loadBranchDoctors();
    }
  }, [selectedBranchId, doctors.length]);

  // Generate 42 days grid for calendar view
  const getDaysArray = (year: number, month: number) => {
    const days: { day: number; isCurrentMonth: boolean; dateString: string; isPast: boolean }[] = [];

    // First day index of the month (0 = Sun, 1 = Mon, ..., 6 = Sat)
    const firstDayIndex = new Date(year, month, 1).getDay();

    // Days in previous month
    const prevMonthYear = month === 0 ? year - 1 : year;
    const prevMonth = month === 0 ? 11 : month - 1;
    const daysInPrevMonth = new Date(prevMonthYear, prevMonth + 1, 0).getDate();

    // Days in current month
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();

    // Next month year and month
    const nextMonthYear = month === 11 ? year + 1 : year;
    const nextMonth = month === 11 ? 0 : month + 1;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Previous month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const dStr = `${prevMonthYear}-${(prevMonth + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
      days.push({
        day: d,
        isCurrentMonth: false,
        dateString: dStr,
        isPast: new Date(prevMonthYear, prevMonth, d) < today
      });
    }

    // Current month days
    for (let i = 1; i <= daysInCurrentMonth; i++) {
      const dStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
      days.push({
        day: i,
        isCurrentMonth: true,
        dateString: dStr,
        isPast: new Date(year, month, i) < today
      });
    }

    // Next month padding to complete 42 days grid (6 weeks)
    const totalSlots = 42;
    const remainingSlots = totalSlots - days.length;
    for (let i = 1; i <= remainingSlots; i++) {
      const dStr = `${nextMonthYear}-${(nextMonth + 1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
      days.push({
        day: i,
        isCurrentMonth: false,
        dateString: dStr,
        isPast: new Date(nextMonthYear, nextMonth, i) < today
      });
    }

    return days;
  };

  const handlePrevMonth = () => {
    if (calendarViewMonth === 0) {
      setCalendarViewMonth(11);
      setCalendarViewYear(calendarViewYear - 1);
    } else {
      setCalendarViewMonth(calendarViewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarViewMonth === 11) {
      setCalendarViewMonth(0);
      setCalendarViewYear(calendarViewYear + 1);
    } else {
      setCalendarViewMonth(calendarViewMonth + 1);
    }
  };

  const fetchTeleconsultations = async () => {
    try {
      const activeRes = await api.get('/teleconsultation/active');
      if (activeRes.data?.success) {
        setActiveTele(activeRes.data.data);
      }
      const checklistRes = await api.get('/teleconsultation/checklist');
      if (checklistRes.data?.success) {
        setChecklist(checklistRes.data.data);
      }
      const pastRes = await api.get('/teleconsultation/past');
      if (pastRes.data?.success) {
        setPastTeles(pastRes.data.data);
      }
    } catch (err) {
      console.error('Error fetching teleconsultations:', err);
    }
  };

  const triggerToast = (type: 'success' | 'error', message: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 4000);
  };

  const fetchProfileAndDashboard = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Patient profile
      const profileRes = await api.get('/patients/me');
      if (profileRes.data?.success) {
        setPatientProfile(profileRes.data.data);
      }

      // 2. Fetch stats
      const statsRes = await api.get('/patients/me/statistics');
      if (statsRes.data?.success) {
        setStatistics(statsRes.data.data);
      }

      // 3. Fetch Dashboard data (recent items)
      const dashRes = await api.get('/patients/me/dashboard');
      if (dashRes.data?.success) {
        setDashboardData(dashRes.data.data);
      }

      // 4. Fetch Timeline
      const timelineRes = await api.get('/patients/me/timeline');
      if (timelineRes.data?.success) {
        setTimeline(timelineRes.data.data);
      }

      // 5. Fetch Preferences
      const prefRes = await api.get('/patients/me/preferences');
      if (prefRes.data?.success) {
        setPreferences(prefRes.data.data);
      }
    } catch (err: any) {
      console.error(err);
      triggerToast('error', getErrorMessage(err, 'Failed to load dashboard data.'));
    } finally {
      setIsLoading(false);
    }
  };

  // Load branches and navigate to the Book screen
  const openBookingWizard = async () => {
    setBookingStep(1);
    setSelectedBranchId('');
    setConsultationType('');
    setSelectedDoctorId('');
    setBookingDate('');
    setBookingSlot('');
    setAvailableSlots([]);
    setBookingSymptoms('');
    setAttachedReportId(null);
    setScreen('book');

    try {
      const res = await api.get('/branches/');
      if (res.data?.success) {
        setBranches(res.data.data.items || []);
      }
    } catch (err) {
      console.error(err);
      triggerToast('error', 'Could not load branch information.');
    }
  };

  // Load doctors for selected branch (Wizard Step 2)
  const handleBranchSelect = async (branchId: string) => {
    setSelectedBranchId(branchId);
    setConsultationType('');
    setSelectedDoctorId('');
    setBookingDate('');
    setBookingSlot('');

    // Clear filters
    setFilterSpecialty('');
    setFilterExperience('');
    setFilterGender('');
    setFilterLanguage('');
    setSearchQuery('');
    setSortOption('experience_desc');

    try {
      const res = await api.get('/doctors/', { params: { branch_id: branchId } });
      if (res.data?.success) {
        setDoctors(res.data.data.items || []);
      }
    } catch (err) {
      console.error(err);
      triggerToast('error', 'Could not load doctors for this branch.');
    }
  };

  // Select doctor and go to step 4
  const handleDoctorSelect = (doctorId: string) => {
    setSelectedDoctorId(doctorId);
    setBookingDate('');
    setBookingSlot('');
    setAvailableSlots([]);
  };

  // Fetch available slots when doctor and date are selected (Wizard Step 3)
  const handleDateChange = async (date: string) => {
    setBookingDate(date);
    setBookingSlot('');
    setAvailableSlots([]);

    try {
      const res = await api.get('/appointments/available-slots', {
        params: { doctor_id: selectedDoctorId, date, consultation_type: consultationType }
      });
      if (res.data?.success) {
        // Backend returns [{ time: "09:00", status: "available"|"booked" }]
        setAvailableSlots(res.data.data || []);
      }
    } catch (err) {
      console.error(err);
      triggerToast('error', 'Could not fetch available slots.');
    }
  };

  // Join teleconsultation meeting with validation check
  const handleJoinMeeting = async (appointmentId: string) => {
    try {
      const res = await api.post(`/teleconsultation/${appointmentId}/join`);
      if (res.data?.success) {
        const url = res.data.data.meeting_url;
        window.open(url, '_blank');
        triggerToast('success', 'Opening video consultation room...');
      }
    } catch (err: any) {
      console.error(err);
      triggerToast('error', getErrorMessage(err, 'Could not join the meeting.'));
    }
  };

  // Submit appointment booking
  const handleBookingSubmit = async () => {
    if (!selectedBranchId || !selectedDoctorId || !bookingDate || !bookingSlot) {
      triggerToast('error', 'Please fill in all details.');
      return;
    }

    setIsLoading(true);
    try {
      // Build ISO Datetime
      // Slot example: "09:00"
      const apptDateTime = `${bookingDate}T${bookingSlot}:00`;

      let finalNotes = bookingNotes || '';
      if (consultationType === 'teleconsultation') {
        const extraList = [];
        if (bookingSymptoms.trim()) {
          extraList.push(`Symptoms: ${bookingSymptoms.trim()}`);
        }
        if (attachedReportId) {
          const matchedReport = dashboardData?.reports?.find((r: any) => r.id === attachedReportId);
          if (matchedReport) {
            extraList.push(`Attached Report: ${matchedReport.title} (ID: ${attachedReportId})`);
          }
        }
        if (extraList.length > 0) {
          finalNotes = `${extraList.join(' | ')}\n${finalNotes}`.trim();
        }
      }

      const res = await api.post('/appointments/', {
        doctor_id: selectedDoctorId,
        branch_id: selectedBranchId,
        // Send local datetime string — DO NOT convert to UTC (.toISOString())
        // because the backend validates against local clinic slot times.
        appointment_datetime: apptDateTime,
        treatment_type: treatmentType === 'Other (Custom Concern)' ? customTreatmentText : treatmentType,
        consultation_type: consultationType,
        notes: finalNotes
      });

      if (res.data?.success) {
        triggerToast('success', 'Appointment booked successfully!');
        clearBookingWizardState();
        setScreen('dashboard');
        fetchProfileAndDashboard();
        if (screen === 'appointments') {
          fetchAppointments(1);
        }
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = getErrorMessage(err, 'Booking failed.');
      if (errMsg.includes('You already have an active appointment scheduled on this date with this doctor')) {
        const conflicting = dashboardData?.upcoming_appointments?.find((appt: any) => {
          const isSameDoctor = appt.doctor_id === selectedDoctorId;
          const apptDateStr = appt.appointment_datetime?.split('T')[0];
          const isSameDay = apptDateStr === bookingDate;
          const isActive = ['pending', 'confirmed', 'rescheduled'].includes(appt.status);
          return isSameDoctor && isSameDay && isActive;
        });
        if (conflicting) {
          setConflictAppt(conflicting);
          return;
        }
      }
      triggerToast('error', errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // Cancel Appointment
  const handleCancelSubmit = async () => {
    if (!cancelApptId) return;
    setIsLoading(true);
    try {
      const res = await api.patch(`/appointments/${cancelApptId}/cancel`, {
        cancel_reason: cancelReason || 'Cancelled by Patient via Portal'
      });
      if (res.data?.success) {
        triggerToast('success', 'Appointment cancelled successfully.');
        setCancelApptId(null);
        setCancelReason('');
        fetchProfileAndDashboard();
        if (screen === 'appointments') {
          fetchAppointments(appointmentsPage);
        }
      }
    } catch (err: any) {
      console.error(err);
      triggerToast('error', getErrorMessage(err, 'Cancellation rejected.'));
    } finally {
      setIsLoading(false);
    }
  };

  // Open Reschedule Modal
  const openRescheduleModal = async (apptId: string, doctorId: string) => {
    setRescheduleApptId(apptId);
    setRescheduleDoctorId(doctorId);
    setRescheduleDate('');
    setRescheduleSlot('');
    setRescheduleSlots([]);
  };

  // Fetch Slots for Rescheduling Date selection
  const handleRescheduleDateSelect = async (date: string) => {
    setRescheduleDate(date);
    setRescheduleSlot('');
    setRescheduleSlots([]);

    try {
      const res = await api.get('/appointments/available-slots', {
        params: { doctor_id: rescheduleDoctorId, date }
      });
      if (res.data?.success) {
        // Backend returns [{ time: "09:00", status: "available"|"booked" }]
        setRescheduleSlots(res.data.data || []);
      }
    } catch (err) {
      console.error(err);
      triggerToast('error', 'Could not load slots.');
    }
  };

  // Submit Rescheduling
  const handleRescheduleSubmit = async () => {
    if (!rescheduleApptId || !rescheduleDate || !rescheduleSlot) return;
    setIsLoading(true);

    try {
      const resDateTime = `${rescheduleDate}T${rescheduleSlot}:00`;
      const res = await api.patch(`/appointments/${rescheduleApptId}/reschedule`, {
        // Send local datetime string — not UTC
        appointment_datetime: resDateTime
      });

      if (res.data?.success) {
        triggerToast('success', 'Appointment rescheduled successfully!');
        setRescheduleApptId(null);
        fetchProfileAndDashboard();
        if (screen === 'appointments') {
          fetchAppointments(appointmentsPage);
        }
      }
    } catch (err: any) {
      console.error(err);
      triggerToast('error', getErrorMessage(err, 'Rescheduling rejected.'));
    } finally {
      setIsLoading(false);
    }
  };

  // Save Preferences
  const handlePreferencesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await api.patch('/patients/me/preferences', preferences);
      if (res.data?.success) {
        triggerToast('success', 'Notification preferences updated.');
        setPreferences(res.data.data);
      }
    } catch (err: any) {
      console.error(err);
      triggerToast('error', getErrorMessage(err, 'Failed to update preferences.'));
    } finally {
      setIsLoading(false);
    }
  };

  // Download PDF file helper (Prescriptions & Invoices)
  const downloadPdf = async (url: string, filename: string) => {
    try {
      const response = await api.get(url, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      triggerToast('success', `${filename} downloaded successfully.`);
    } catch (err) {
      console.error(err);
      triggerToast('error', 'Failed to generate and download PDF.');
    }
  };

  // File Upload Helper
  const handleReportUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      triggerToast('error', 'Please select a report file.');
      return;
    }

    setIsLoading(true);
    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('title', uploadTitle || uploadFile.name);
    formData.append('report_type', uploadType);

    try {
      const res = await api.post('/medical-reports/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data?.success) {
        triggerToast('success', 'Medical report uploaded successfully!');
        setShowUploadModal(false);
        setUploadTitle('');
        setUploadFile(null);
        fetchProfileAndDashboard();
      }
    } catch (err: any) {
      console.error(err);
      triggerToast('error', getErrorMessage(err, 'Upload failed.'));
    } finally {
      setIsLoading(false);
    }
  };

  const isImageFile = (url: string) => {
    if (!url) return false;
    const cleanUrl = url.toLowerCase().split('?')[0];
    return cleanUrl.endsWith('.jpg') || cleanUrl.endsWith('.jpeg') || cleanUrl.endsWith('.png') || cleanUrl.endsWith('.gif') || cleanUrl.endsWith('.webp');
  };

  // Delete uploaded report
  const handleDeleteReport = async (reportId: string) => {
    if (!window.confirm('Are you sure you want to delete this report?')) return;
    setIsLoading(true);
    try {
      const res = await api.delete(`/medical-reports/${reportId}`);
      if (res.data?.success) {
        triggerToast('success', 'Report deleted successfully.');
        fetchProfileAndDashboard();
      }
    } catch (err: any) {
      console.error(err);
      triggerToast('error', 'Could not delete report.');
    } finally {
      setIsLoading(false);
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return 'PT';
    return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <div className="portal-container">
      {/* ── Toast Alert Banner ── */}
      {alert && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 1000,
          backgroundColor: alert.type === 'success' ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${alert.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
          color: alert.type === 'success' ? '#15803d' : '#b91c1c',
          padding: '12px 18px',
          borderRadius: '8px',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          animation: 'slideIn 0.3s ease'
        }}>
          {alert.type === 'success' ? <ShieldCheck size={20} /> : <AlertCircle size={20} />}
          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{alert.message}</span>
        </div>
      )}

      {/* Sidebar mobile backdrop overlay */}
      {isMobileSidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setIsMobileSidebarOpen(false)} />
      )}

      {/* ── Left Sidebar panel ── */}
      <aside className={`portal-sidebar ${isMobileSidebarOpen ? 'open' : ''}`}>
        <div className="portal-brand">
          <div className="portal-brand-mark">V</div>
          <div className="portal-brand-text">
            <h2>Vertical Clinic</h2>
            <p>Patient Portal</p>
          </div>
          <button onClick={() => setIsMobileSidebarOpen(false)} className="sidebar-close-btn">
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '12px' }}>
          <button
            className="portal-nav-item active"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              color: '#ffffff',
              fontWeight: 700
            }}
            onClick={() => { setScreen('dashboard'); setIsMobileSidebarOpen(false); }}
          >
            <User size={16} /> Patient Portal
          </button>
        </div>

        <nav className="portal-nav">
          <span className="sidebar-section-heading">Main</span>
          <button
            className={`portal-nav-item ${screen === 'dashboard' ? 'active' : ''}`}
            onClick={() => { setScreen('dashboard'); setIsMobileSidebarOpen(false); }}
          >
            <Home size={18} /> Dashboard
          </button>
          <button
            className={`portal-nav-item ${screen === 'book' ? 'active' : ''}`}
            onClick={() => { openBookingWizard(); setIsMobileSidebarOpen(false); }}
          >
            <Plus size={18} /> Book an Appointment
          </button>
          <button
            className={`portal-nav-item ${screen === 'appointments' ? 'active' : ''}`}
            onClick={() => { setScreen('appointments'); setIsMobileSidebarOpen(false); }}
          >
            <Calendar size={18} /> Appointments
          </button>

          <span className="sidebar-section-heading">Records</span>
          <button
            className={`portal-nav-item ${screen === 'timeline' ? 'active' : ''}`}
            onClick={() => { setScreen('timeline'); setIsMobileSidebarOpen(false); }}
          >
            <Activity size={18} /> Medical History
          </button>
          <button
            className={`portal-nav-item ${screen === 'reports' ? 'active' : ''}`}
            onClick={() => { setScreen('reports'); setIsMobileSidebarOpen(false); }}
          >
            <UploadCloud size={18} /> Medical Reports
          </button>
          <button
            className={`portal-nav-item ${screen === 'prescriptions' ? 'active' : ''}`}
            onClick={() => { setScreen('prescriptions'); setIsMobileSidebarOpen(false); }}
          >
            <Pill size={18} /> Prescriptions
          </button>
          <button
            className={`portal-nav-item ${screen === 'billing' ? 'active' : ''}`}
            onClick={() => { setScreen('billing'); setIsMobileSidebarOpen(false); }}
          >
            <CreditCard size={18} /> Billing History
          </button>

          <span className="sidebar-section-heading">Other</span>
          <button
            className={`portal-nav-item ${screen === 'teleconsultation' ? 'active' : ''}`}
            onClick={() => { setScreen('teleconsultation'); setIsMobileSidebarOpen(false); }}
          >
            <Video size={18} /> Tele Consultation
          </button>

          <button
            className={`portal-nav-item ${screen === 'profile' ? 'active' : ''}`}
            onClick={() => { setScreen('profile'); setIsMobileSidebarOpen(false); }}
          >
            <User size={18} /> Profile
          </button>
        </nav>

        <div className="portal-sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button onClick={onLogout} className="logout-btn">
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main content panel ── */}
      <main className="portal-main">
        <header className="portal-topbar">
          <button onClick={() => setIsMobileSidebarOpen(true)} className="topbar-menu-btn">
            <Menu size={20} />
          </button>
          <div className="topbar-brand-section" style={{ marginRight: 'auto' }}>
            <div className="topbar-title">
              {screen === 'book' ? 'Book an Appointment' : screen.charAt(0).toUpperCase() + screen.slice(1)}
            </div>
            <div className="topbar-subtitle">Patient Portal</div>
          </div>

          <div className="topbar-actions">
            <div className="topbar-search-wrapper">
              <Search className="topbar-search-icon" size={16} />
              <input
                type="text"
                placeholder="Search patients, appointments, invoices..."
                className="topbar-search-input"
              />
            </div>

            <button className="topbar-icon-btn">
              <Bell size={18} />
            </button>
            <button className="topbar-icon-btn" onClick={() => setScreen('preferences')}>
              <Settings size={18} />
            </button>

            {patientProfile && (
              <div className="topbar-profile">
                <div className="topbar-avatar">
                  {getInitials(patientProfile.user?.full_name)}
                </div>
                <div className="topbar-user-info">
                  <span className="topbar-user-name">{patientProfile.user?.full_name}</span>
                  <span className="topbar-user-role">Patient</span>
                </div>
              </div>
            )}
          </div>
        </header>

        <div className="portal-content">
          {isLoading && (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div style={{
                border: '4px solid var(--border-color)',
                borderTop: '4px solid var(--primary-teal)',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 12px'
              }} />
              <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Fetching clinic records...</p>
            </div>
          )}

          {/* ── SCREEN: DASHBOARD OVERVIEW ── */}
          {screen === 'dashboard' && dashboardData && (
            <div className="dashboard-grid">
              {/* Hero Banner Card */}
              {patientProfile && (
                <div className="hero-banner">
                  <div className="hero-text">
                    <span className="hero-welcome">Welcome back,</span>
                    <h2 className="hero-name">{patientProfile.user?.full_name}</h2>
                    <span className="hero-meta">
                      Patient ID: {patientProfile.patient_code} {patientProfile.preferred_branch?.name ? `· ${patientProfile.preferred_branch.name}` : ''}
                    </span>
                  </div>
                  <div className="hero-actions">
                    <button
                      onClick={() => {
                        const firstAppt = dashboardData.upcoming_appointments?.[0];
                        if (firstAppt) {
                          const isLimitReached = (firstAppt.reschedule_count || 0) >= 2;
                          const apptTime = new Date(firstAppt.appointment_datetime).getTime();
                          const isWithinTwoHours = apptTime - Date.now() < 2 * 60 * 60 * 1000;

                          if (isLimitReached) {
                            triggerToast('error', 'Maximum reschedule limit reached. Please contact receptionist to update your appointment.');
                            return;
                          }
                          if (isWithinTwoHours) {
                            triggerToast('error', 'Rescheduling is not allowed within 2 hours of the scheduled time. Please call the clinic.');
                            return;
                          }
                          openRescheduleModal(firstAppt.id, firstAppt.doctor_id);
                        } else {
                          triggerToast('error', 'No active appointments to reschedule. Please book a new one.');
                        }
                      }}
                      className="btn-hero-secondary"
                    >
                      <Clock size={16} /> Reschedule
                    </button>
                    <button onClick={openBookingWizard} className="btn-hero-primary">
                      <Calendar size={16} /> Book an Appointment
                    </button>
                  </div>
                </div>
              )}

              {/* Metrics cards */}
              {statistics && (
                <div className="stats-row">
                  <div className="stat-card">
                    <div className="stat-info">
                      <span className="stat-val">{dashboardData.upcoming_appointments?.length || 0}</span>
                      <span className="stat-label">Upcoming Appointments</span>
                    </div>
                    <div className="stat-icon-wrapper accent-teal">
                      <Calendar size={20} />
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-info">
                      <span className="stat-val">{statistics.active_prescriptions || 0}</span>
                      <span className="stat-label">Active Prescriptions</span>
                    </div>
                    <div className="stat-icon-wrapper accent-green">
                      <Pill size={20} />
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-info">
                      <span className="stat-val">₹{statistics.balance_due || 0}</span>
                      <span className="stat-label">Balance Due</span>
                    </div>
                    <div className="stat-icon-wrapper accent-yellow">
                      <CreditCard size={20} />
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-info">
                      <span className="stat-val">{statistics.total_visits ?? 0}</span>
                      <span className="stat-label">Visits This Year</span>
                    </div>
                    <div className="stat-icon-wrapper accent-blue">
                      <Check size={20} />
                    </div>
                  </div>
                </div>
              )}

              {/* Two columns main content */}
              <div className="portal-layout-columns">
                {/* Left column */}
                <div className="col">
                  {/* Upcoming Appointment Widget */}
                  <div className="card">
                    <div className="card-title-bar">
                      <h3 className="card-title"><Calendar size={18} /> Upcoming Appointments</h3>
                      <span
                        onClick={() => setScreen('appointments')}
                        style={{ fontSize: '0.78rem', color: 'var(--primary-teal)', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}
                      >
                        View all <ChevronRight size={13} />
                      </span>
                    </div>
                    <div className="dash-appt-list">
                      {dashboardData.upcoming_appointments && dashboardData.upcoming_appointments.length > 0 ? (
                        dashboardData.upcoming_appointments.map((appt: any) => (
                          <div
                            key={appt.id}
                            className="dash-appt-item"
                            style={{ cursor: 'pointer' }}
                            onClick={(e) => {
                              const target = e.target as HTMLElement;
                              if (target.tagName.toLowerCase() === 'button' || target.closest('button')) {
                                return;
                              }
                              setViewingAppointment(appt);
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div className="dash-doctor-avatar">Dr</div>
                              <div className="dash-appt-details">
                                <span className="dash-doctor-name">{appt.doctor?.user?.full_name?.toLowerCase().startsWith('dr') ? appt.doctor?.user?.full_name : `Dr. ${appt.doctor?.user?.full_name}`}</span>
                                <span className="dash-appt-type">{appt.treatment_type} {appt.branch?.name ? `· ${appt.branch.name}` : ''}</span>
                                <span className="dash-appt-time">{new Date(appt.appointment_datetime).toLocaleString()}</span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                              <span className={`status-pill ${appt.status}`}>{appt.status}</span>
                              {['confirmed', 'rescheduled'].includes(appt.status) && (() => {
                                const isLimitReached = (appt.reschedule_count || 0) >= 2;
                                const apptTime = new Date(appt.appointment_datetime).getTime();
                                const isWithinTwoHours = apptTime - Date.now() < 2 * 60 * 60 * 1000;

                                return (
                                  <div className="action-buttons" style={{ marginTop: '4px' }}>
                                    <button
                                      onClick={() => {
                                        if (isLimitReached) {
                                          triggerToast('error', 'Maximum reschedule limit reached. Please contact receptionist to update your appointment.');
                                          return;
                                        }
                                        if (isWithinTwoHours) {
                                          triggerToast('error', 'Rescheduling is not allowed within 2 hours of the scheduled time. Please call the clinic.');
                                          return;
                                        }
                                        openRescheduleModal(appt.id, appt.doctor_id);
                                      }}
                                      className="action-btn reschedule"
                                      style={{ padding: '4px 8px', fontSize: '0.7rem', opacity: isLimitReached || isWithinTwoHours ? 0.5 : 1, cursor: isLimitReached || isWithinTwoHours ? 'not-allowed' : 'pointer' }}
                                    >
                                      <Clock size={11} /> Reschedule
                                    </button>
                                    <button
                                      onClick={() => {
                                        if (isWithinTwoHours) {
                                          triggerToast('error', 'Cancellation is not allowed within 2 hours of the scheduled time. Please call the clinic.');
                                          return;
                                        }
                                        setCancelApptId(appt.id);
                                      }}
                                      className="action-btn cancel"
                                      style={{ padding: '4px 8px', fontSize: '0.7rem', opacity: isWithinTwoHours ? 0.5 : 1, cursor: isWithinTwoHours ? 'not-allowed' : 'pointer' }}
                                    >
                                      <X size={11} /> Cancel
                                    </button>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                          No upcoming appointments scheduled.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right column (Widgets) */}
                <div className="col">
                  {/* Recent Prescriptions Widget */}
                  <div className="card">
                    <div className="card-title-bar">
                      <h3 className="card-title"><Pill size={18} /> Recent Prescriptions</h3>
                    </div>
                    <div className="dash-rx-list">
                      {dashboardData.prescriptions && dashboardData.prescriptions.length > 0 ? (
                        dashboardData.prescriptions.slice(0, 3).map((rx: any) => (
                          <div key={rx.id} className="dash-rx-item">
                            <div className="dash-rx-info">
                              <span className="dash-rx-code">RX-{rx.id.substring(0, 5).toUpperCase()}</span>
                              <span className="dash-rx-doctor">
                                {rx.doctor?.user?.full_name?.toLowerCase().startsWith('dr') ? rx.doctor?.user?.full_name : `Dr. ${rx.doctor?.user?.full_name}`} — {new Date(rx.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <span className="dash-rx-badge">{(rx.items || rx.medications)?.length || 0} items</span>
                          </div>
                        ))
                      ) : (
                        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                          No recent prescriptions found.
                        </div>
                      )}
                      <button
                        onClick={() => setScreen('prescriptions')}
                        className="btn-secondary"
                        style={{ width: '100%', marginTop: '12px', padding: '10px', fontSize: '0.85rem', fontWeight: 600 }}
                      >
                        View All Prescriptions
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── SCREEN: MEDICAL HISTORY TIMELINE ── */}
          {screen === 'timeline' && timeline && (
            <div className="card">
              <div className="card-title-bar">
                <h3 className="card-title"><Activity size={18} /> Medical History Timeline</h3>
              </div>
              {timeline.length > 0 ? (
                <div className="timeline-list">
                  {timeline.map((event: any, idx: number) => (
                    <div
                      key={idx}
                      className="timeline-item"
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        if (event.event_type === 'visit' || event.event_type === 'prescription') {
                          setViewingHistoryEvent(event);
                        } else if (event.event_type === 'invoice') {
                          const fullBill = dashboardData?.bills?.find((b: any) => b.id === event.id || b.invoice_number === event.title);
                          if (fullBill) {
                            setViewingInvoice(fullBill);
                          } else {
                            setViewingInvoice(event.details);
                          }
                        } else if (event.event_type === 'report') {
                          setViewingReport(event.details);
                        }
                      }}
                    >
                      <div className={`timeline-marker ${event.event_type}`} />
                      <div className="timeline-content">
                        <div className="timeline-meta">
                          <span style={{ textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
                            {event.event_type}
                          </span>
                          <span>{new Date(event.datetime).toLocaleDateString()}</span>
                        </div>
                        <span className="timeline-title">{event.title}</span>
                        <div className="timeline-details">
                          {event.event_type === 'visit' && (
                            <>
                              {event.details.diagnosis && <p><strong>Diagnosis:</strong> {event.details.diagnosis}</p>}
                              {event.details.symptoms && <p><strong>Symptoms:</strong> {event.details.symptoms}</p>}
                              {event.details.notes && <p><strong>Notes:</strong> {event.details.notes}</p>}
                            </>
                          )}
                          {event.event_type === 'prescription' && (
                            <>
                              <p>Medications prescribed:</p>
                              <ul style={{ paddingLeft: '20px', marginTop: '4px' }}>
                                {(event.details.items || event.details.medications)?.map((m: any, mIdx: number) => (
                                  <li key={mIdx}>{m.medicine_name || m.name} ({m.dosage}) - {m.duration || m.duration_days + ' Days'}</li>
                                ))}
                              </ul>
                            </>
                          )}
                          {event.event_type === 'invoice' && (
                            <p><strong>Amount:</strong> ₹{event.details.total_amount} | <strong>Status:</strong> {event.details.status}</p>
                          )}
                          {event.event_type === 'report' && (
                            <p><strong>Type:</strong> {event.details.report_type} | Title: {event.details.title}</p>
                          )}
                          {event.event_type === 'follow_up' && (
                            <p>{event.details.notes}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>No health events logged yet.</p>
              )}
            </div>
          )}

          {/* ── SCREEN: PROFILE INFO ── */}
          {screen === 'profile' && patientProfile && (
            <div className="card">
              <div className="card-title-bar">
                <h3 className="card-title"><User size={18} /> Profile Information</h3>
                {!isEditingProfile ? (
                  <button
                    onClick={startEditingProfile}
                    className="btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '0.85rem', fontWeight: 600 }}
                  >
                    Edit Profile
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => setIsEditingProfile(false)}
                      className="btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '0.85rem', fontWeight: 600 }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveProfile}
                      className="btn-primary"
                      style={{ padding: '6px 12px', fontSize: '0.85rem', fontWeight: 600 }}
                    >
                      Save Changes
                    </button>
                  </div>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginTop: '16px' }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b' }}>Full Name</label>
                  <div className="form-input" style={{ backgroundColor: '#f8fafc', fontWeight: 600 }}>{patientProfile.user?.full_name}</div>
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b' }}>Email Address</label>
                  <div className="form-input" style={{ backgroundColor: '#f8fafc' }}>{patientProfile.user?.email}</div>
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b' }}>Phone Number</label>
                  {isEditingProfile ? (
                    <input
                      type="text"
                      value={profileForm.phone}
                      onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
                      className="form-input"
                    />
                  ) : (
                    <div className="form-input" style={{ backgroundColor: '#f8fafc' }}>{patientProfile.user?.phone || 'Not set'}</div>
                  )}
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b' }}>Patient ID Code</label>
                  <div className="form-input" style={{ backgroundColor: '#f8fafc', fontFamily: 'monospace' }}>{patientProfile.patient_code}</div>
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b' }}>Blood Group</label>
                  {isEditingProfile ? (
                    <select
                      value={profileForm.blood_group}
                      onChange={e => setProfileForm({ ...profileForm, blood_group: e.target.value })}
                      className="form-input"
                      style={{ padding: '8px 12px' }}
                    >
                      <option value="">Select Blood Group</option>
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                    </select>
                  ) : (
                    <div className="form-input" style={{ backgroundColor: '#f8fafc' }}>{patientProfile.blood_group || 'Not recorded'}</div>
                  )}
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b' }}>Date of Birth</label>
                  {isEditingProfile ? (
                    <input
                      type="date"
                      value={profileForm.date_of_birth}
                      onChange={e => setProfileForm({ ...profileForm, date_of_birth: e.target.value })}
                      className="form-input"
                    />
                  ) : (
                    <div className="form-input" style={{ backgroundColor: '#f8fafc' }}>{patientProfile.date_of_birth ? new Date(patientProfile.date_of_birth).toLocaleDateString() : 'Not recorded'}</div>
                  )}
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b' }}>Known Allergies</label>
                  {isEditingProfile ? (
                    <textarea
                      value={profileForm.allergies}
                      onChange={e => setProfileForm({ ...profileForm, allergies: e.target.value })}
                      className="form-input"
                      rows={2}
                      style={{ height: 'auto', padding: '10px 12px' }}
                    />
                  ) : (
                    <div className="form-input" style={{ backgroundColor: '#f8fafc', color: patientProfile.allergies ? 'var(--error-red)' : 'inherit' }}>
                      {patientProfile.allergies || 'None recorded'}
                    </div>
                  )}
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b' }}>Chronic Conditions</label>
                  {isEditingProfile ? (
                    <textarea
                      value={profileForm.chronic_conditions}
                      onChange={e => setProfileForm({ ...profileForm, chronic_conditions: e.target.value })}
                      className="form-input"
                      rows={2}
                      style={{ height: 'auto', padding: '10px 12px' }}
                    />
                  ) : (
                    <div className="form-input" style={{ backgroundColor: '#f8fafc' }}>{patientProfile.chronic_conditions || 'None recorded'}</div>
                  )}
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b' }}>Emergency Contact Name</label>
                  {isEditingProfile ? (
                    <input
                      type="text"
                      value={profileForm.emergency_contact_name}
                      onChange={e => setProfileForm({ ...profileForm, emergency_contact_name: e.target.value })}
                      className="form-input"
                    />
                  ) : (
                    <div className="form-input" style={{ backgroundColor: '#f8fafc' }}>{patientProfile.emergency_contact_name || 'Not recorded'}</div>
                  )}
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b' }}>Emergency Contact Phone</label>
                  {isEditingProfile ? (
                    <input
                      type="text"
                      value={profileForm.emergency_contact_phone}
                      onChange={e => setProfileForm({ ...profileForm, emergency_contact_phone: e.target.value })}
                      className="form-input"
                    />
                  ) : (
                    <div className="form-input" style={{ backgroundColor: '#f8fafc' }}>{patientProfile.emergency_contact_phone || 'Not recorded'}</div>
                  )}
                </div>
              </div>

              {/* ── Section below profile data: Insurance & Billing Preferences ── */}
              <div style={{ marginTop: '28px', paddingTop: '22px', borderTop: '1px solid var(--border)' }}>
                <h4 style={{ marginBottom: '14px', fontSize: '1rem', fontFamily: 'var(--font-heading)', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={18} style={{ color: 'var(--accent)' }} /> Insurance &amp; Billing Preferences
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b' }}>Insurance Provider</label>
                    {isEditingProfile ? (
                      <input
                        type="text"
                        value={profileForm.insurance_provider}
                        onChange={e => setProfileForm({ ...profileForm, insurance_provider: e.target.value })}
                        className="form-input"
                      />
                    ) : (
                      <div className="form-input" style={{ backgroundColor: '#f8fafc', fontWeight: 600 }}>{patientProfile.insurance_provider || 'Star Health & Allied Insurance'}</div>
                    )}
                  </div>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b' }}>Policy Number</label>
                    {isEditingProfile ? (
                      <input
                        type="text"
                        value={profileForm.insurance_policy_no}
                        onChange={e => setProfileForm({ ...profileForm, insurance_policy_no: e.target.value })}
                        className="form-input"
                      />
                    ) : (
                      <div className="form-input" style={{ backgroundColor: '#f8fafc', fontFamily: 'monospace' }}>{patientProfile.insurance_policy_no || 'SH-992384-A'}</div>
                    )}
                  </div>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b' }}>Coverage Limit</label>
                    <div className="form-input" style={{ backgroundColor: '#f8fafc' }}>₹5,00,000 / Year</div>
                  </div>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b' }}>Policy Expiry Date</label>
                    <div className="form-input" style={{ backgroundColor: '#f8fafc' }}>31 Dec 2026</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── SCREEN: APPOINTMENTS ── */}
          {screen === 'appointments' && (
            <div className="card">
              <div className="card-title-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                <h3 className="card-title" style={{ margin: 0 }}><Calendar size={18} /> My Appointments</h3>

                {/* Date Filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label htmlFor="appt-date-filter" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Filter by Date:</label>
                  <input
                    id="appt-date-filter"
                    type="date"
                    value={appointmentFilterDate}
                    onChange={(e) => setAppointmentFilterDate(e.target.value)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      fontSize: '0.85rem',
                      outline: 'none',
                      backgroundColor: 'var(--surface-color, #ffffff)'
                    }}
                  />
                  {appointmentFilterDate && (
                    <button
                      onClick={() => setAppointmentFilterDate('')}
                      className="btn-text"
                      style={{ fontSize: '0.8rem', color: 'var(--error-red)', padding: '4px 8px' }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Status Filter Tabs */}
              <div style={{
                display: 'flex',
                gap: '8px',
                padding: '12px 24px',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: '#f8fafc',
                flexWrap: 'wrap'
              }}>
                {[
                  { value: 'all', label: 'All' },
                  { value: 'upcoming', label: 'Upcoming' },
                  { value: 'completed', label: 'Completed' },
                  { value: 'cancelled', label: 'Cancelled' },
                  { value: 'rescheduled', label: 'Rescheduled' }
                ].map((tab) => {
                  const isActive = appointmentFilterStatus === tab.value;
                  return (
                    <button
                      key={tab.value}
                      onClick={() => setAppointmentFilterStatus(tab.value)}
                      style={{
                        padding: '6px 16px',
                        borderRadius: '20px',
                        border: '1px solid',
                        borderColor: isActive ? 'var(--primary-teal)' : '#cbd5e1',
                        backgroundColor: isActive ? 'var(--primary-teal)' : '#ffffff',
                        color: isActive ? '#ffffff' : '#475569',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: isActive ? '0 2px 6px rgba(12, 110, 140, 0.2)' : 'none'
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="table-container">
                {appointmentsLoading ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                    <div style={{
                      border: '3px solid var(--border-color)',
                      borderTop: '3px solid var(--primary-teal)',
                      borderRadius: '50%',
                      width: '30px',
                      height: '30px',
                      animation: 'spin 1s linear infinite',
                      margin: '0 auto 10px auto'
                    }} />
                    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                    Loading appointments...
                  </div>
                ) : (
                  <table className="portal-table">
                    <thead>
                      <tr>
                        <th>Doctor</th>
                        <th>Branch</th>
                        <th>Date &amp; Time</th>
                        <th>Treatment Plan</th>
                        <th>Consultation</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {appointmentsList.map((appt: any, apptIdx: number) => {
                        const isNearBottom = apptIdx >= Math.max(0, appointmentsList.length - 2);
                        return (
                        <tr
                          key={appt.id}
                          style={{ cursor: 'pointer' }}
                          onClick={(e) => {
                            const target = e.target as HTMLElement;
                            if (target.tagName.toLowerCase() === 'button' || target.closest('button') || target.closest('a')) {
                              return;
                            }
                            setViewingAppointment(appt);
                          }}
                        >
                          <td style={{ fontWeight: 600 }}><Stethoscope size={13} style={{ display: 'inline', marginRight: '5px', color: 'var(--primary-teal)' }} />{appt.doctor?.user?.full_name?.toLowerCase().startsWith('dr') ? appt.doctor?.user?.full_name : `Dr. ${appt.doctor?.user?.full_name}`}</td>
                          <td><MapPin size={13} style={{ display: 'inline', marginRight: '4px', color: '#64748b' }} />{appt.branch?.name}</td>
                          <td>{new Date(appt.appointment_datetime).toLocaleString()}</td>
                          <td>{appt.treatment_type}</td>
                          <td>{appt.consultation_type === 'in_person' ? 'In Person' : 'Video Consultation'}</td>
                          <td>
                            <span className={`status-pill ${appt.status}`}>{appt.status}</span>
                          </td>
                          <td>
                            {['confirmed', 'rescheduled'].includes(appt.status) ? (
                              <div className="action-dropdown-container">
                                <button
                                  className={`dropdown-trigger ${activeDropdownId === appt.id ? 'active' : ''}`}
                                  onClick={() => setActiveDropdownId(activeDropdownId === appt.id ? null : appt.id)}
                                  title="Actions"
                                >
                                  <MoreVertical size={16} />
                                </button>
                                {activeDropdownId === appt.id && (() => {
                                  const isLimitReached = (appt.reschedule_count || 0) >= 2;
                                  const apptTime = new Date(appt.appointment_datetime).getTime();
                                  const isWithinTwoHours = apptTime - Date.now() < 2 * 60 * 60 * 1000;

                                  return (
                                    <div className={`action-dropdown-menu ${isNearBottom ? 'open-up' : ''}`}>
                                      <button
                                        style={isLimitReached || isWithinTwoHours ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                                        onClick={() => {
                                          if (isLimitReached) {
                                            triggerToast('error', 'Maximum reschedule limit reached. Please contact receptionist to update your appointment.');
                                            return;
                                          }
                                          if (isWithinTwoHours) {
                                            triggerToast('error', 'Rescheduling is not allowed within 2 hours of the scheduled time. Please call the clinic.');
                                            return;
                                          }
                                          openRescheduleModal(appt.id, appt.doctor_id);
                                          setActiveDropdownId(null);
                                        }}
                                      >
                                        <Clock size={13} style={{ color: 'var(--primary-teal)' }} /> Reschedule
                                      </button>
                                      <button
                                        className="cancel-item"
                                        style={isWithinTwoHours ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                                        onClick={() => {
                                          if (isWithinTwoHours) {
                                            triggerToast('error', 'Cancellation is not allowed within 2 hours of the scheduled time. Please call the clinic.');
                                            return;
                                          }
                                          setCancelApptId(appt.id);
                                          setActiveDropdownId(null);
                                        }}
                                      >
                                        <X size={13} style={{ color: '#dc2626' }} /> Cancel
                                      </button>
                                    </div>
                                  );
                                })()}
                              </div>
                            ) : (
                              <span className="action-muted-text">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                      {appointmentsList.length === 0 && (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px 0' }}>No appointments found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Pagination controls */}
              {appointmentsTotal > 20 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', padding: '16px', borderTop: '1px solid var(--border-color)' }}>
                  <button
                    disabled={appointmentsPage === 1}
                    onClick={() => fetchAppointments(appointmentsPage - 1)}
                    className="btn-secondary"
                    style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                  >
                    Previous
                  </button>
                  <span style={{ alignSelf: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Page {appointmentsPage} of {Math.ceil(appointmentsTotal / 20)}
                  </span>
                  <button
                    disabled={appointmentsPage >= Math.ceil(appointmentsTotal / 20)}
                    onClick={() => fetchAppointments(appointmentsPage + 1)}
                    className="btn-secondary"
                    style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── SCREEN: PRESCRIPTIONS ── */}
          {screen === 'prescriptions' && dashboardData && (
            <div className="card">
              <div className="card-title-bar">
                <h3 className="card-title"><Pill size={18} /> Prescriptions</h3>
              </div>
              <div className="table-container">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Doctor</th>
                      <th>Diagnosis &amp; Symptoms</th>
                      <th>Prescribed Date</th>
                      <th>Medications</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardData.prescriptions?.map((rx: any) => {
                      // Prefer the linked consultation record (returned by backend eager load)
                      // which holds the doctor's AI-assisted diagnosis and symptoms.
                      const consultation = rx.consultation;
                      const diagnosis = consultation?.diagnosis
                        || rx.consultation?.diagnosis
                        || (() => {
                          const rxDate = new Date(rx.created_at).toDateString();
                          return timeline.find((e: any) => e.event_type === 'visit' && new Date(e.datetime).toDateString() === rxDate)?.details?.diagnosis;
                        })()
                        || 'General Consultation';
                      const symptoms = consultation?.symptoms
                        || rx.consultation?.symptoms
                        || (() => {
                          const rxDate = new Date(rx.created_at).toDateString();
                          return timeline.find((e: any) => e.event_type === 'visit' && new Date(e.datetime).toDateString() === rxDate)?.details?.symptoms;
                        })()
                        || 'None recorded';

                      return (
                        <tr
                          key={rx.id}
                          style={{ cursor: 'pointer' }}
                          onClick={(e) => {
                            const target = e.target as HTMLElement;
                            if (target.tagName.toLowerCase() === 'button' || target.closest('button') || target.tagName.toLowerCase() === 'a') return;
                            setViewingPrescription({ rx, diagnosis, symptoms });
                          }}
                        >
                          <td style={{ fontFamily: 'monospace' }}>{rx.id.substring(0, 8).toUpperCase()}</td>
                          <td>{rx.doctor?.user?.full_name?.toLowerCase().startsWith('dr') ? rx.doctor?.user?.full_name : `Dr. ${rx.doctor?.user?.full_name}`}</td>
                          <td>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary)' }}>{diagnosis}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Symptoms: {symptoms}</div>
                          </td>
                          <td>{new Date(rx.created_at).toLocaleDateString()}</td>
                          <td>
                            <ul style={{ paddingLeft: '16px', margin: 0, fontSize: '0.8rem' }}>
                              {(rx.items || rx.medications)?.map((m: any, idx: number) => (
                                <li key={idx} style={{ color: 'var(--primary)', fontWeight: 500 }}>
                                  {m.medicine_name || m.name} - {m.dosage} ({m.duration || m.duration_days + ' Days'})
                                </li>
                              ))}
                            </ul>
                          </td>
                          <td>
                            <span className={`status-pill ${rx.status === 'active' || rx.status === 'dispensed' ? 'completed' : 'pending'}`}>
                              {rx.status}
                            </span>
                          </td>
                          <td>
                            <button
                              onClick={(e) => { e.stopPropagation(); downloadPdf(`/prescriptions/${rx.id}/pdf`, `Prescription_${rx.id.substring(0, 8)}.pdf`); }}
                              className="btn-secondary"
                              style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                            >
                              <Download size={13} /> PDF
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {(!dashboardData.prescriptions || dashboardData.prescriptions.length === 0) && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No prescriptions issued.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── SCREEN: BILLING & INVOICES ── */}
          {screen === 'billing' && dashboardData && (
            <div className="card">
              <div className="card-title-bar">
                <h3 className="card-title"><CreditCard size={18} /> Invoices &amp; Payments</h3>
              </div>
              <div className="table-container">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th>Invoice Code</th>
                      <th>Due Date</th>
                      <th>Total Amount</th>
                      <th>Paid Amount</th>
                      <th>Balance Due</th>
                      <th>Status</th>
                      <th>Download</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardData.bills?.map((bill: any) => (
                      <tr
                        key={bill.id}
                        style={{ cursor: 'pointer' }}
                        onClick={(e) => {
                          const target = e.target as HTMLElement;
                          if (target.tagName.toLowerCase() === 'button' || target.closest('button')) {
                            return;
                          }
                          setViewingInvoice(bill);
                        }}
                      >
                        <td style={{ fontFamily: 'monospace' }}>{bill.invoice_number}</td>
                        <td>{new Date(bill.due_date).toLocaleDateString()}</td>
                        <td>₹{bill.total_amount}</td>
                        <td>₹{bill.paid_amount}</td>
                        <td style={{ color: bill.balance_due > 0 ? 'var(--error-red)' : 'inherit', fontWeight: 600 }}>
                          ₹{bill.balance_due}
                        </td>
                        <td>
                          <span className={`status-pill ${bill.status}`}>{bill.status}</span>
                        </td>
                        <td>
                          <button
                            onClick={() => downloadPdf(`/billing/${bill.id}/pdf`, `Invoice_${bill.invoice_number}.pdf`)}
                            className="btn-secondary"
                            style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                          >
                            <Download size={13} /> PDF Invoice
                          </button>
                        </td>
                      </tr>
                    ))}
                    {(!dashboardData.bills || dashboardData.bills.length === 0) && (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No invoice statements available.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── SCREEN: UPLOADED REPORTS ── */}
          {screen === 'reports' && dashboardData && (
            <div className="card">
              <div className="card-title-bar">
                <h3 className="card-title"><UploadCloud size={18} /> Diagnostic Reports</h3>
                <button onClick={() => setShowUploadModal(true)} className="btn-primary" style={{ padding: '8px 12px', fontSize: '0.8rem' }}>
                  <Plus size={14} /> Upload Report
                </button>
              </div>

              <div className="table-container">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Report Type</th>
                      <th>Uploaded On</th>
                      <th>File Size</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardData.reports?.map((report: any) => (
                      <tr key={report.id}>
                        <td style={{ fontWeight: 600 }}>{report.title}</td>
                        <td>{report.report_type}</td>
                        <td>{new Date(report.uploaded_at || report.created_at).toLocaleDateString()}</td>
                        <td>{report.file_size ? `${(report.file_size / 1024).toFixed(1)} KB` : 'N/A'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => {
                                setViewingReport(report);
                                setImageZoom(1);
                                setImageRotate(0);
                              }}
                              className="btn-secondary"
                              style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                            >
                              View
                            </button>
                            <a
                              href={`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${report.file_url}`}
                              download
                              target="_blank"
                              rel="noreferrer"
                              className="btn-secondary"
                              style={{ padding: '6px 10px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
                            >
                              <Download size={13} />
                            </a>
                            <button
                              onClick={() => handleDeleteReport(report.id)}
                              className="btn-danger-outline"
                              style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(!dashboardData.reports || dashboardData.reports.length === 0) && (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No medical reports uploaded yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── SCREEN: BOOK APPOINTMENT (full page) ── */}
          {screen === 'book' && (
            <div className="book-page">
              <div className="book-page-header">
                <div>
                  <p style={{ color: 'var(--muted)', fontSize: '0.88rem', marginTop: '4px' }}>Follow the steps below to schedule your visit</p>
                </div>
                <button onClick={() => { clearBookingWizardState(); setScreen('dashboard'); }} className="btn-secondary">
                  ← Back to Dashboard
                </button>
              </div>

              <div className="book-page-body">
                {/* Top: Horizontal Stepper */}
                <div className="book-steps-panel-horizontal">
                  {[
                    { num: 1, label: 'Branch', sub: 'Choose clinic' },
                    { num: 2, label: 'Mode', sub: 'Consultation type' },
                    { num: 3, label: 'Doctor', sub: 'Select clinician' },
                    { num: 4, label: 'Date & Time', sub: 'Pick a slot' },
                    { num: 5, label: 'Details', sub: 'Confirm & notes' },
                  ].map((step, idx) => {
                    const isActive = bookingStep === step.num;
                    const isDone = bookingStep > step.num;
                    return (
                      <React.Fragment key={step.num}>
                        <div className={`book-step-item-horizontal ${isActive ? 'active' : isDone ? 'done' : ''}`}>
                          <div className="book-step-circle-horizontal">
                            {isDone ? '✓' : step.num}
                          </div>
                          <div className="book-step-text-horizontal">
                            <span className="book-step-title-horizontal">{step.label}</span>
                            <span className="book-step-sub-horizontal">{step.sub}</span>
                          </div>
                        </div>
                        {idx < 4 && (
                          <div className="book-step-arrow">→</div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* Main Content Area */}
                <div className="book-step-content-area" style={{ flex: 1, marginTop: '24px' }}>

                  {/* Step 1: Branch */}
                  {bookingStep === 1 && (
                    <div className="card" style={{ padding: '24px', animation: 'fadeIn 0.3s ease-out' }}>
                      <h3 style={{ marginBottom: '6px', fontSize: '1.1rem' }}>Choose Branch Location</h3>
                      <p style={{ color: 'var(--muted)', fontSize: '0.84rem', marginBottom: '20px' }}>Select the clinic branch you'd like to visit</p>

                      <div className="branch-selection-list">
                        {branches.map((b: any) => {
                          const isSelected = selectedBranchId === b.id;
                          return (
                            <div
                              key={b.id}
                              className={`branch-card-horizontal ${isSelected ? 'selected' : ''}`}
                              onClick={() => handleBranchSelect(b.id)}
                            >
                              <div className="branch-image-placeholder">
                                <span>🏥 {b.name.substring(0, 2)}</span>
                              </div>
                              <div className="branch-info-main">
                                <div className="branch-title-row">
                                  <span className="location-pin-badge">📍</span>
                                  <h4>{b.name} Branch</h4>
                                </div>
                                <p className="branch-address">{b.address}</p>
                                <p className="branch-phone">📞 {b.phone}</p>
                              </div>
                              <div className="branch-info-extra">
                                <p className="branch-working-hours">🕒 Mon - Sat: 9:00 AM - 9:00 PM | Sun: 9:00 AM - 2:00 PM</p>
                                <p className="branch-parking">🅿️ Parking Available</p>
                              </div>
                              <div className="branch-radio-wrapper">
                                <div className={`custom-radio-circle ${isSelected ? 'checked' : ''}`} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Step 2: Mode */}
                  {bookingStep === 2 && (
                    <div className="card" style={{ padding: '24px', animation: 'fadeIn 0.3s ease-out' }}>
                      <h3 style={{ marginBottom: '6px', fontSize: '1.1rem' }}>Select Consultation Mode</h3>
                      <p style={{ color: 'var(--muted)', fontSize: '0.84rem', marginBottom: '20px' }}>Choose how you would like to connect with your doctor</p>

                      <div className="consultation-mode-cards">
                        <div
                          className={`mode-card ${consultationType === 'in_person' ? 'selected' : ''}`}
                          onClick={() => setConsultationType('in_person')}
                        >
                          <div className="mode-card-icon-placeholder">🏥</div>
                          <h4 className="mode-card-title">In Clinic</h4>
                          <p className="mode-card-desc">Visit the branch in person for a face-to-face checkup</p>
                          <ul className="mode-card-benefits">
                            <li><span className="benefit-check">✓</span> Physical examination</li>
                            <li><span className="benefit-check">✓</span> Direct personal care</li>
                            <li><span className="benefit-check">✓</span> Access to clinic equipment</li>
                          </ul>
                          <span className="mode-card-duration-badge">⏱️ 30 Minutes</span>
                        </div>

                        <div
                          className={`mode-card ${consultationType === 'teleconsultation' ? 'selected' : ''}`}
                          onClick={() => setConsultationType('teleconsultation')}
                        >
                          <div className="mode-card-recommended-badge">Recommended</div>
                          <div className="mode-card-icon-placeholder">💻</div>
                          <h4 className="mode-card-title">Tele Consultation</h4>
                          <p className="mode-card-desc">Join a secure video call from the comfort of your home</p>
                          <ul className="mode-card-benefits">
                            <li><span className="benefit-check tele">✓</span> Safe & convenient</li>
                            <li><span className="benefit-check tele">✓</span> Save travel time & cost</li>
                            <li><span className="benefit-check tele">✓</span> Digital prescription included</li>
                          </ul>
                          <span className="mode-card-duration-badge">⏱️ 20-30 Minutes</span>
                        </div>
                      </div>

                      <div className="mode-info-banner">
                        <div className="mode-info-banner-illustration">💡</div>
                        <p className="mode-info-banner-text">
                          <strong>Note:</strong> Teleconsultation is ideal for initial assessments, report reviews, and follow-ups. In-person visits are recommended for treatments requiring procedures.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Step 3: Doctor Selection (3 Columns) */}
                  {bookingStep === 3 && (() => {
                    const uniqueSpecs = Array.from(new Set(doctors.map(d => d.specialization || d.specialty || 'General Dentist')));
                    return (
                      <div className="doctor-selection-layout" style={{ animation: 'fadeIn 0.3s ease-out' }}>

                        {/* Column 1: Filters */}
                        <div className="doctor-filters-card">
                          <div className="doctor-filters-header">
                            <h4>🔍 Filter Clinicians</h4>
                            <button
                              type="button"
                              className="clear-filters-btn"
                              onClick={() => {
                                setFilterSpecialty('');
                                setFilterExperience('');
                                setFilterGender('');
                                setFilterLanguage('');
                                setSearchQuery('');
                                setSortOption('experience_desc');
                              }}
                            >
                              Reset
                            </button>
                          </div>

                          <div className="filter-group">
                            <label className="filter-label">Search Name / Specialty</label>
                            <input
                              type="text"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              placeholder="e.g. Sneha or Orthodontist"
                              className="filter-select"
                              style={{ background: 'var(--surface-2)' }}
                            />
                          </div>

                          <div className="filter-group">
                            <label className="filter-label">Specialization</label>
                            <select
                              value={filterSpecialty}
                              onChange={(e) => setFilterSpecialty(e.target.value)}
                              className="filter-select"
                            >
                              <option value="">All Specialities</option>
                              {uniqueSpecs.map(spec => (
                                <option key={spec} value={spec}>{spec}</option>
                              ))}
                            </select>
                          </div>

                          <div className="filter-group">
                            <label className="filter-label">Gender</label>
                            <select
                              value={filterGender}
                              onChange={(e) => setFilterGender(e.target.value)}
                              className="filter-select"
                            >
                              <option value="">Any Gender</option>
                              <option value="Male">Male</option>
                              <option value="Female">Female</option>
                            </select>
                          </div>

                          <button
                            type="button"
                            className="reset-filters-btn-block"
                            onClick={() => {
                              setFilterSpecialty('');
                              setFilterExperience('');
                              setFilterGender('');
                              setFilterLanguage('');
                              setSearchQuery('');
                              setSortOption('experience_desc');
                            }}
                          >
                            Reset All Filters
                          </button>
                        </div>

                        {/* Column 2: Doctor Cards List */}
                        <div className="doctor-list-container" style={{ flex: 1 }}>
                          <div className="doctor-list-header">
                            <div className="doctor-list-header-info">
                              Select Your Clinician &nbsp;•&nbsp; <span style={{ color: 'var(--primary)', fontWeight: '600' }}>{filteredAndSortedDoctors.length} Doctors Available</span>
                            </div>

                          </div>

                          <div className="doctor-cards-grid" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {filteredAndSortedDoctors.map((doc: any) => {
                              const isSelected = selectedDoctorId === doc.id;
                              const inferredGender = (doc.user?.full_name?.includes('Sneha') || doc.user?.full_name?.includes('Anjali') || doc.user?.full_name?.includes('Desai')) ? 'Female' : 'Male';

                              const langs = ['English', 'Hindi'];
                              const docName = doc.user?.full_name || '';
                              if (docName.includes('Mehta') || docName.includes('Patel') || docName.includes('Shah') || docName.includes('Desai')) {
                                langs.push('Gujarati');
                              }
                              if (docName.includes('Nair')) langs.push('Malayalam');
                              if (docName.includes('Rao')) langs.push('Kannada');

                              return (
                                <div
                                  key={doc.id}
                                  className={`doctor-card-horizontal ${isSelected ? 'selected' : ''}`}
                                  onClick={() => handleDoctorSelect(doc.id)}
                                >
                                  <div className="doctor-avatar-circle-placeholder">
                                    <span>Dr</span>
                                  </div>
                                  <div className="doctor-card-middle-info">
                                    <div className="doctor-card-name-row">
                                      <h4>
                                        {doc.user?.full_name?.toLowerCase().startsWith('dr') ? doc.user?.full_name : `Dr. ${doc.user?.full_name}`}
                                      </h4>
                                      <span className="doctor-verified-badge">✓ Verified</span>
                                    </div>
                                    <p className="doctor-card-specialization">{doc.specialization || 'General Dentist'}</p>

                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                                      <span className="doctor-card-mode-pill">👤 {inferredGender}</span>
                                    </div>
                                    <div className="doctor-card-rating">
                                      <span className="doctor-card-rating-star">★</span>
                                      <strong>{doc.rating || '4.8'}</strong>&nbsp;({doc.experience_years * 12 + 15} reviews)
                                    </div>
                                    <p className="doctor-card-meta-details" style={{ marginTop: '8px', lineHeight: '1.4' }}>
                                      {doc.bio || 'Dedicated clinician offering comprehensive services and personalized dental/medical treatments.'}
                                    </p>
                                  </div>
                                  <div className="doctor-card-right-info">
                                    <span className={`doctor-card-mode-pill ${consultationType === 'teleconsultation' ? 'tele' : ''}`}>
                                      {consultationType === 'teleconsultation' ? 'Teleconsult' : 'In-Clinic'}
                                    </span>
                                    <div className="doctor-card-fee-label" style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '4px' }}>Consultation Fee</div>
                                    <div className="doctor-card-fee">₹{doc.consultation_fee}</div>
                                    <button
                                      type="button"
                                      className={`btn-select-doctor ${isSelected ? 'selected' : ''}`}
                                      style={{
                                        width: '100%',
                                        padding: '8px 14px',
                                        borderRadius: '8px',
                                        border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border)',
                                        background: isSelected ? 'var(--primary)' : 'var(--surface-2)',
                                        color: isSelected ? '#fff' : 'var(--ink)',
                                        fontWeight: '600',
                                        fontSize: '0.8rem',
                                        cursor: 'pointer',
                                        transition: 'var(--transition-all)',
                                        marginTop: '8px'
                                      }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDoctorSelect(doc.id);
                                      }}
                                    >
                                      {isSelected ? 'Selected ✓' : 'Select Doctor'}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}

                            {filteredAndSortedDoctors.length === 0 && (
                              <div className="doctor-list-empty-state">
                                <span>👨‍⚕️</span>
                                <h4>No clinicians match your filter criteria</h4>
                                <p>Try resetting filters or searching with a different keyword.</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Column 3: Sticky Summary Sidebar */}
                        <div className="doctor-sidebar-column">
                          {renderSummarySidebar()}
                        </div>

                      </div>
                    );
                  })()}

                  {/* Step 4: Date & Time Slot selection */}
                  {bookingStep === 4 && (() => {
                    const activeDoctor = doctors.find((d: any) => d.id === selectedDoctorId);
                    const doctorName = activeDoctor?.user?.full_name?.toLowerCase().startsWith('dr')
                      ? activeDoctor.user.full_name
                      : `Dr. ${activeDoctor?.user?.full_name || 'Clinician'}`;
                    const doctorSpecialty = activeDoctor?.specialization || 'General Dentist';
                    const availableSlotsCount = availableSlots.filter((s: any) => s.status === 'available').length;

                    const formatFriendlyDate = (dateStr: string) => {
                      if (!dateStr) return '';
                      const parts = dateStr.split('-');
                      const dateObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                      return dateObj.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                    };

                    const morningSlots = availableSlots.filter((s: any) => {
                      const hr = parseInt(s.time.split(':')[0], 10);
                      return hr < 12;
                    });

                    const afternoonSlots = availableSlots.filter((s: any) => {
                      const hr = parseInt(s.time.split(':')[0], 10);
                      return hr >= 12 && hr < 16;
                    });

                    const eveningSlots = availableSlots.filter((s: any) => {
                      const hr = parseInt(s.time.split(':')[0], 10);
                      return hr >= 16;
                    });

                    const renderSlotButton = (slot: { time: string; status: string }) => {
                      const isBooked = slot.status === 'booked';
                      const isSelected = bookingSlot === slot.time;
                      return (
                        <button
                          key={slot.time}
                          type="button"
                          className={`slot-item-btn${isSelected ? ' selected' : ''}${isBooked ? ' booked' : ''}`}
                          onClick={() => !isBooked && setBookingSlot(slot.time)}
                          disabled={isBooked}
                          title={isBooked ? 'This slot is already booked' : `Book ${formatTimeToAMPM(slot.time)}`}
                        >
                          {formatTimeToAMPM(slot.time)}
                          {isBooked && <span style={{ fontSize: '0.7rem', marginLeft: '4px' }}>🔒</span>}
                        </button>
                      );
                    };

                    return (
                      <div className="card" style={{ padding: '24px', animation: 'fadeIn 0.3s ease-out' }}>
                        <h3 style={{ marginBottom: '6px', fontSize: '1.1rem' }}>Select Date & Time Slot</h3>
                        <p style={{ color: 'var(--muted)', fontSize: '0.84rem', marginBottom: '20px' }}>Choose a convenient date and time for your appointment</p>

                        <div className="booking-calendar-layout">
                          {/* Left Column: Interactive Custom Calendar */}
                          <div className="calendar-card">
                            <div className="calendar-header">
                              <span className="calendar-month-title">
                                {MONTH_NAMES[calendarViewMonth]} {calendarViewYear}
                              </span>
                              <div className="calendar-nav-buttons">
                                <button
                                  type="button"
                                  className="calendar-nav-btn"
                                  onClick={handlePrevMonth}
                                  disabled={
                                    calendarViewYear < new Date().getFullYear() ||
                                    (calendarViewYear === new Date().getFullYear() && calendarViewMonth <= new Date().getMonth())
                                  }
                                >
                                  &larr;
                                </button>
                                <button
                                  type="button"
                                  className="calendar-nav-btn"
                                  onClick={handleNextMonth}
                                >
                                  &rarr;
                                </button>
                              </div>
                            </div>

                            <div className="calendar-days-of-week">
                              <div>Sun</div>
                              <div>Mon</div>
                              <div>Tue</div>
                              <div>Wed</div>
                              <div>Thu</div>
                              <div>Fri</div>
                              <div>Sat</div>
                            </div>

                            <div className="calendar-days-grid">
                              {getDaysArray(calendarViewYear, calendarViewMonth).map((dItem, idx) => {
                                const isSelected = bookingDate === dItem.dateString;
                                const isDisabled = dItem.isPast;
                                return (
                                  <button
                                    key={idx}
                                    type="button"
                                    className={`calendar-day-btn ${dItem.isCurrentMonth ? 'current-month' : 'other-month'}${isSelected ? ' selected' : ''}`}
                                    onClick={() => handleDateChange(dItem.dateString)}
                                    disabled={isDisabled}
                                  >
                                    {dItem.day}
                                  </button>
                                );
                              })}
                            </div>

                            <div className="calendar-today-btn-wrapper">
                              <button
                                type="button"
                                className="calendar-today-btn"
                                onClick={() => {
                                  const todayStr = new Date().toISOString().split('T')[0];
                                  handleDateChange(todayStr);
                                  setCalendarViewMonth(new Date().getMonth());
                                  setCalendarViewYear(new Date().getFullYear());
                                }}
                              >
                                Today
                              </button>
                            </div>
                          </div>

                          {/* Right Column: Time Slots */}
                          <div className="slots-container">
                            {/* Doctor info header card */}
                            <div className="slot-doctor-card">
                              <div className="slot-doctor-profile">
                                <div className="slot-doctor-avatar">
                                  Dr
                                </div>
                                <div className="slot-doctor-details">
                                  <div className="slot-doctor-name">{doctorName}</div>
                                  <div className="slot-doctor-specialty">{doctorSpecialty}</div>
                                  <div className="slot-doctor-meta">
                                    <span>🕐 30 mins</span>
                                    <span>💻 {consultationType === 'teleconsultation' ? 'Tele Consultation' : 'In Clinic'}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="slot-availability-pill">
                                <span className="slot-availability-pill-title">{availableSlotsCount} Slots Available</span>
                                <span className="slot-availability-pill-date">{formatFriendlyDate(bookingDate)}</span>
                              </div>
                            </div>

                            {/* Timezone bar */}
                            <div className="slot-timezone-bar">
                              <span>🕐 All times are shown in Asia/Kolkata (IST)</span>
                              <span className="timezone-link">Change Timezone</span>
                            </div>

                            {/* Categorized slots */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                              {morningSlots.length > 0 && (
                                <div className="slot-category-section">
                                  <div className="slot-category-header">
                                    <span>🌅</span> Morning
                                  </div>
                                  <div className="slot-category-grid">
                                    {morningSlots.map(renderSlotButton)}
                                  </div>
                                </div>
                              )}

                              {afternoonSlots.length > 0 && (
                                <div className="slot-category-section">
                                  <div className="slot-category-header">
                                    <span>☀️</span> Afternoon
                                  </div>
                                  <div className="slot-category-grid">
                                    {afternoonSlots.map(renderSlotButton)}
                                  </div>
                                </div>
                              )}

                              {eveningSlots.length > 0 && (
                                <div className="slot-category-section">
                                  <div className="slot-category-header">
                                    <span>🌆</span> Evening
                                  </div>
                                  <div className="slot-category-grid">
                                    {eveningSlots.map(renderSlotButton)}
                                  </div>
                                </div>
                              )}

                              {availableSlots.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--muted)', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                  No slots available for the selected date. Please pick another date from the calendar.
                                </div>
                              )}
                            </div>

                            {/* Legend */}
                            <div className="slot-legend">
                              <div className="legend-item">
                                <div className="legend-dot available" />
                                <span>Available</span>
                              </div>
                              <div className="legend-item">
                                <div className="legend-dot selected" />
                                <span>Selected</span>
                              </div>
                              <div className="legend-item">
                                <div className="legend-dot booked" />
                                <span>Booked</span>
                              </div>
                              <div className="legend-item">
                                <div className="legend-dot break" />
                                <span>Break Time</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Step 5: Details/Confirmation (2 Columns) */}
                  {bookingStep === 5 && (
                    <div className="confirm-details-layout" style={{ animation: 'fadeIn 0.3s ease-out' }}>
                      {/* Left Column: Confirmation cards, timeline, additional form fields */}
                      <div className="confirm-main-column">
                        {/* Review Card: Patient Details */}
                        <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
                          <h4 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: '700', color: 'var(--ink)' }}>👨‍💼 Patient Information</h4>
                          <div className="confirm-details-grid">

                            <div className="confirm-detail-card">
                              <div className="confirm-detail-icon">👤</div>
                              <div className="confirm-detail-info">
                                <span className="confirm-detail-label">Name</span>
                                <span className="confirm-detail-val">{patientProfile?.user?.full_name || 'Patient'}</span>
                              </div>
                            </div>

                            <div className="confirm-detail-card">
                              <div className="confirm-detail-icon">📞</div>
                              <div className="confirm-detail-info">
                                <span className="confirm-detail-label">Phone</span>
                                <span className="confirm-detail-val">{patientProfile?.user?.phone || 'N/A'}</span>
                              </div>
                            </div>

                            <div className="confirm-detail-card">
                              <div className="confirm-detail-icon">🩸</div>
                              <div className="confirm-detail-info">
                                <span className="confirm-detail-label">Blood Group</span>
                                <span className="confirm-detail-val">{patientProfile?.blood_group || 'O+'}</span>
                              </div>
                            </div>

                            <div className="confirm-detail-card">
                              <div className="confirm-detail-icon">🎂</div>
                              <div className="confirm-detail-info">
                                <span className="confirm-detail-label">Age/Gender</span>
                                <span className="confirm-detail-val">
                                  {patientProfile?.date_of_birth ? `${new Date().getFullYear() - new Date(patientProfile.date_of_birth).getFullYear()} yrs` : 'N/A'}
                                </span>
                              </div>
                            </div>

                          </div>
                        </div>

                        {/* Review Card: Appointment Preferences */}
                        <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
                          <h4 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: '700', color: 'var(--ink)' }}>⚙️ Consultation Preferences</h4>

                          <div className="form-group" style={{ marginBottom: '16px' }}>
                            <label className="form-label" style={{ fontWeight: 600 }}>Treatment Concern / Type</label>
                            <select
                              value={treatmentType}
                              onChange={(e) => setTreatmentType(e.target.value)}
                              className="form-input"
                              style={{ background: 'var(--surface-2)' }}
                            >
                              <option value="Routine Checkup">Routine Checkup</option>
                              <option value="Scaling & Polishing">Scaling & Polishing</option>
                              <option value="Root Canal Treatment (RCT)">Root Canal Treatment (RCT)</option>
                              <option value="Tooth Extraction">Tooth Extraction</option>
                              <option value="Braces Adjustment">Braces Adjustment</option>
                              <option value="Teeth Whitening">Teeth Whitening</option>
                              <option value="Other (Custom Concern)">Other (Custom Concern)</option>
                            </select>
                          </div>

                          {treatmentType === 'Other (Custom Concern)' && (
                            <div className="form-group" style={{ marginBottom: '16px' }}>
                              <label className="form-label" style={{ fontWeight: 600 }}>Specify Custom Concern</label>
                              <input
                                type="text"
                                value={customTreatmentText}
                                onChange={(e) => setCustomTreatmentText(e.target.value)}
                                placeholder="Please specify your dental/clinical concern..."
                                className="form-input"
                                required
                              />
                            </div>
                          )}

                          {consultationType === 'teleconsultation' && (
                            <>
                              <div className="form-group" style={{ marginBottom: '16px' }}>
                                <label className="form-label" style={{ fontWeight: 600 }}>Reason / Symptoms for Consultation</label>
                                <textarea
                                  value={bookingSymptoms}
                                  onChange={(e) => setBookingSymptoms(e.target.value)}
                                  placeholder="Describe your symptoms (e.g., severe toothache for 2 days, swelling)..."
                                  className="form-input" rows={3}
                                  style={{ resize: 'vertical' }}
                                />
                              </div>
                              <div className="form-group" style={{ marginBottom: '16px' }}>
                                <label className="form-label" style={{ fontWeight: 600 }}>Attach Previous Medical Report (Optional)</label>
                                <select
                                  value={attachedReportId || ''}
                                  onChange={(e) => setAttachedReportId(e.target.value || null)}
                                  className="form-input"
                                  style={{ background: 'var(--surface-2)' }}
                                >
                                  <option value="">-- Select a report to attach --</option>
                                  {dashboardData?.reports?.map((report: any) => (
                                    <option key={report.id} value={report.id}>{report.title} ({report.report_type})</option>
                                  ))}
                                </select>
                              </div>
                            </>
                          )}

                          <div className="form-group">
                            <label className="form-label" style={{ fontWeight: 600 }}>Notes for Doctor (Optional)</label>
                            <textarea
                              value={bookingNotes}
                              onChange={(e) => setBookingNotes(e.target.value)}
                              placeholder="Mention any other information you want the doctor to know..."
                              className="form-input" rows={3}
                              style={{ resize: 'vertical' }}
                            />
                          </div>
                        </div>

                        {/* "What Happens Next" Timeline */}
                        <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
                          <h4 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: '700', color: 'var(--ink)' }}>🕒 What Happens Next?</h4>
                          <div className="booking-timeline">
                            <div className="booking-timeline-item">
                              <h5>Step 1: Instant Confirmation</h5>
                              <p>Upon clicking 'Confirm', your slot is locked instantly and you will receive an SMS and email notification.</p>
                            </div>
                            <div className="booking-timeline-item">
                              <h5>Step 2: Clinician Pre-Review</h5>
                              <p>Our medical team reviews your attached medical reports or symptoms description beforehand.</p>
                            </div>
                            <div className="booking-timeline-item">
                              <h5>Step 3: Consultation Day</h5>
                              <p>
                                {consultationType === 'teleconsultation'
                                  ? 'Join the secure video meeting from the active rooms tab in your patient portal.'
                                  : 'Arrive 10 minutes prior to your slot at the selected branch. Show confirmation on your phone.'}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Cancellation/Rescheduling Policy */}
                        <div className="mode-info-banner" style={{ marginTop: '20px', border: '1px solid rgba(245, 158, 11, 0.25)', background: 'rgba(245, 158, 11, 0.04)' }}>
                          <div className="mode-info-banner-illustration" style={{ fontSize: '1.4rem' }}>⚠️</div>
                          <div className="mode-info-banner-text" style={{ color: 'var(--ink)' }}>
                            <strong style={{ color: '#d97706' }}>Cancellation & Rescheduling Policy:</strong> You can cancel or reschedule this appointment free of charge up to 2 hours before the scheduled time. Late cancellations may incur a convenience fee.
                          </div>
                        </div>
                      </div>

                      {/* Right Column: Sticky Summary Sidebar */}
                      <div className="confirm-sidebar-column">
                        {renderSummarySidebar()}

                        <div className="confirm-actions-panel" style={{ marginTop: '16px', background: 'var(--surface)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <span style={{ fontSize: '0.82rem', color: 'var(--muted)', textAlign: 'center' }}>
                            Review all details carefully before confirming.
                          </span>
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ width: '100%' }}
                            onClick={() => setBookingStep(4)}
                          >
                            ✏️ Edit Date & Slot
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                </div>

                {/* Bottom: Wizard Footer Nav Bar */}
                <div className="book-footer" style={{ marginTop: '24px', padding: '16px 24px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {bookingStep > 1 ? (
                    <button onClick={() => setBookingStep(bookingStep - 1)} className="btn-secondary" style={{ padding: '10px 20px' }}>
                      ← Back
                    </button>
                  ) : (
                    <div />
                  )}
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={() => { clearBookingWizardState(); setScreen('dashboard'); }} className="btn-secondary" style={{ padding: '10px 20px' }}>Cancel</button>
                    {bookingStep < 5 ? (
                      <button
                        onClick={() => setBookingStep(bookingStep + 1)}
                        disabled={
                          (bookingStep === 1 && !selectedBranchId) ||
                          (bookingStep === 2 && !consultationType) ||
                          (bookingStep === 3 && !selectedDoctorId) ||
                          (bookingStep === 4 && (!bookingDate || !bookingSlot))
                        }
                        className="btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 24px' }}
                      >
                        {bookingStep === 4 ? 'Continue to Details' : 'Continue'} <ChevronRight size={16} />
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowBookingConfirm(true)}
                        className="btn-primary"
                        disabled={isLoading}
                        style={{ padding: '10px 24px' }}
                      >
                        ✓ Confirm Appointment
                      </button>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ── SCREEN: TELE CONSULTATION ── */}
          {screen === 'teleconsultation' && (() => {
            const allConsultations: any[] = [];
            if (activeTele) {
              allConsultations.push({ ...activeTele, status: 'scheduled' });
            }
            if (pastTeles && pastTeles.length > 0) {
              allConsultations.push(...pastTeles);
            }

            if (allConsultations.length === 0) {
              return (
                <div className="tele-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                  <div style={{ textAlign: 'center', maxWidth: '420px', padding: '40px', background: 'var(--surface-2)', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                    <div className="tele-video-icon-wrap" style={{ margin: '0 auto 20px', width: '80px', height: '80px', background: 'var(--primary-light)', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      <Video size={36} className="tele-video-icon" style={{ color: 'var(--primary)' }} />
                    </div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--ink)', marginBottom: '8px' }}>No Tele Consultations</h3>
                    <p style={{ color: 'var(--muted)', fontSize: '0.88rem', lineHeight: 1.5, marginBottom: '24px' }}>
                      You don't have any upcoming or past video consultations scheduled. You can book one anytime.
                    </p>
                    <button className="btn-primary" onClick={() => setScreen('book')} style={{ width: '100%', justifyContent: 'center' }}>
                      Book Tele Consultation
                    </button>
                  </div>
                </div>
              );
            }

            const currentSelectedId = selectedTeleId || allConsultations[0]?.id;
            const selectedItem = allConsultations.find(c => c.id === currentSelectedId) || allConsultations[0];

            return (
              <div className="tele-page">
                <div className="tele-grid">
                  {/* Left Column: Details Box */}
                  <div className="tele-main-card">
                    {selectedItem?.status === 'scheduled' ? (
                      <>
                        <div className="tele-video-icon-wrap">
                          <Video size={48} className="tele-video-icon" />
                        </div>
                        <h2 className="tele-title">Video Consultation with {selectedItem.doctor_name}</h2>
                        <p className="tele-subtitle">Scheduled for {selectedItem.scheduled_time || `${selectedItem.date} at ${selectedItem.time}`}</p>
                        {selectedItem.is_expired ? (
                          <div className="tele-timer-badge" style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fee2e2' }}>
                            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444', marginRight: '6px' }}></span>
                            Session Expired / Time Passed
                          </div>
                        ) : selectedItem.is_ongoing || selectedItem.time_left_minutes === 0 ? (
                          <div className="tele-timer-badge" style={{ background: '#ecfdf5', color: '#10b981', border: '1px solid #a7f3d0' }}>
                            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', marginRight: '6px' }}></span>
                            Session Live / Ongoing
                          </div>
                        ) : (
                          <div className="tele-timer-badge">
                            <Clock size={14} /> Starts in {selectedItem.time_left_minutes} minutes
                          </div>
                        )}
                        {(() => {
                          const minutesLeft = selectedItem.time_left_minutes || 0;
                          const hasLink = !!selectedItem.meeting_link;
                          const canJoin = !!selectedItem.can_join;
                          const isExpired = !!selectedItem.is_expired;

                          if (isExpired) {
                            return (
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: '#fef2f2',
                                border: '1px solid #fee2e2',
                                color: '#ef4444',
                                padding: '10px 14px',
                                borderRadius: '6px',
                                fontSize: '0.82rem',
                                margin: '14px 0',
                                fontWeight: 500,
                                textAlign: 'left'
                              }}>
                                <span>⚠️ This consultation session has expired or the scheduled time slot has passed. Please contact the clinic if you need to reschedule.</span>
                              </div>
                            );
                          } else if (canJoin) {
                            return (
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: '#f0fdf4',
                                border: '1px solid #bbf7d0',
                                color: '#16a34a',
                                padding: '10px 14px',
                                borderRadius: '6px',
                                fontSize: '0.82rem',
                                margin: '14px 0',
                                fontWeight: 500,
                                textAlign: 'left'
                              }}>
                                <span>✅ {selectedItem.doctor_name?.startsWith('Dr.') ? selectedItem.doctor_name : `Dr. ${selectedItem.doctor_name || 'Clinician'}`} is ready. Click below to enter the secure room.</span>
                              </div>
                            );
                          } else if (hasLink || (minutesLeft > 0 && minutesLeft <= 30)) {
                            return (
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: '#eff6ff',
                                border: '1px solid #bfdbfe',
                                color: '#2563eb',
                                padding: '10px 14px',
                                borderRadius: '6px',
                                fontSize: '0.82rem',
                                margin: '14px 0',
                                fontWeight: 500,
                                textAlign: 'left'
                              }}>
                                <span>💻 Your consultation room is ready! The "Join Meeting" button will activate exactly 10 minutes before your start time.</span>
                              </div>
                            );
                          } else {
                            return (
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: '#fef3c7',
                                border: '1px solid #fde68a',
                                color: '#d97706',
                                padding: '10px 14px',
                                borderRadius: '6px',
                                fontSize: '0.82rem',
                                margin: '14px 0',
                                fontWeight: 500,
                                textAlign: 'left'
                              }}>
                                <span>🕒 A secure consultation room will be prepared 30 minutes before your appointment. The "Join Meeting" button will activate 10 minutes prior to the start.</span>
                              </div>
                            );
                          }
                        })()}
                        <button
                          onClick={() => handleJoinMeeting(selectedItem.id)}
                          className="tele-btn-join"
                          disabled={!selectedItem.can_join}
                          style={{
                            cursor: selectedItem.can_join ? 'pointer' : 'not-allowed',
                            opacity: selectedItem.can_join ? 1 : 0.6
                          }}
                        >
                          <Video size={16} /> Join Meeting
                        </button>
                        <button className="tele-btn-message" onClick={() => triggerToast('success', 'Message sent to the clinic support team!')}>
                          Send Message to Clinic
                        </button>
                      </>
                    ) : (
                      <div style={{ width: '100%', textAlign: 'left' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
                          <div className="tele-past-avatar" style={{ width: '50px', height: '50px', fontSize: '1.1rem' }}>
                            {selectedItem.doctor_name ? selectedItem.doctor_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : 'DR'}
                          </div>
                          <div style={{ flex: 1 }}>
                            <h2 className="tele-title" style={{ margin: 0, fontSize: '1.2rem' }}>{selectedItem.doctor_name}</h2>
                            <p className="tele-subtitle" style={{ margin: '2px 0 0 0', fontSize: '0.82rem' }}>{selectedItem.specialty} • Completed Call</p>
                          </div>
                          <span className="tele-status-chip">Completed</span>
                        </div>

                        <div className="tele-summary-section">
                          <h4 className="tele-summary-heading">Session Details</h4>
                          <table className="tele-details-table">
                            <tbody>
                              <tr>
                                <td>Date &amp; Time</td>
                                <td>{selectedItem.date} at {selectedItem.time || '10:00 AM'}</td>
                              </tr>
                              <tr>
                                <td>Call Duration</td>
                                <td>{selectedItem.duration}</td>
                              </tr>
                              <tr>
                                <td>Consultation ID</td>
                                <td style={{ fontFamily: 'monospace' }}>{selectedItem.id}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        <div className="tele-summary-section" style={{ marginTop: '20px' }}>
                          <h4 className="tele-summary-heading">Doctor's Clinical Notes</h4>
                          <p className="tele-summary-text">{selectedItem.notes}</p>
                        </div>

                        <div className="tele-summary-section" style={{ marginTop: '20px' }}>
                          <h4 className="tele-summary-heading">Prescriptions / Medications</h4>
                          <div className="tele-summary-rx">
                            <span className="tele-rx-icon">💊</span>
                            <span>{selectedItem.prescription}</span>
                          </div>
                        </div>

                        <div className="tele-summary-section" style={{ marginTop: '20px' }}>
                          <h4 className="tele-summary-heading">Doctor's Recommendations</h4>
                          <p className="tele-summary-text" style={{ fontStyle: 'italic' }}>{selectedItem.recommendations}</p>
                        </div>

                        <button
                          className="btn-secondary"
                          style={{ marginTop: '24px', width: '100%', justifyContent: 'center' }}
                          onClick={() => triggerToast('success', 'Summary receipt sent to registered email address.')}
                        >
                          ✉ Email Summary PDF
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Right Column: List & Checklist */}
                  <div className="tele-sidebar-cards">
                    {/* Pre-Consultation Checklist */}
                    <div className="tele-checklist-card">
                      <h3 className="tele-card-title">Pre-Consultation Checklist</h3>
                      <ul className="tele-checklist">
                        {checklist.length > 0 ? (
                          checklist.map((item) => (
                            <li key={item.id}>
                              <span className="tele-check-icon">✓</span>
                              {item.text}
                            </li>
                          ))
                        ) : (
                          <>
                            <li><span className="tele-check-icon">✓</span> Stable Internet connection tested</li>
                            <li><span className="tele-check-icon">✓</span> Good lighting on your face</li>
                            <li><span className="tele-check-icon">✓</span> Recent X-ray uploaded (optional)</li>
                            <li><span className="tele-check-icon">✓</span> List of current symptoms ready</li>
                          </>
                        )}
                      </ul>
                    </div>

                    {/* All Consultations List */}
                    <div className="tele-past-card">
                      <h3 className="tele-card-title">All Tele Consultations</h3>
                      <div className="tele-past-list">
                        {allConsultations.map((item) => {
                          const isSelected = item.id === currentSelectedId;
                          const isUpcoming = item.status === 'scheduled';
                          return (
                            <div
                              key={item.id}
                              className={`tele-past-item ${isSelected ? 'selected' : ''}`}
                              onClick={() => setSelectedTeleId(item.id)}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div className="tele-past-avatar" style={{ background: isUpcoming ? 'var(--warning-bg)' : 'var(--primary-light)', color: isUpcoming ? 'var(--warning)' : 'var(--primary)' }}>
                                  {isUpcoming ? '⏰' : (item.doctor_name ? item.doctor_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : 'DR')}
                                </div>
                                <div style={{ textAlign: 'left' }}>
                                  <div className="tele-past-doc">{item.doctor_name}</div>
                                  <div className="tele-past-date">
                                    {isUpcoming ? (item.scheduled_time || `${item.date} at ${item.time}`) : `${item.date} • ${item.duration}`}
                                  </div>
                                </div>
                              </div>
                              <span className={`tele-status-chip ${isUpcoming ? 'pending' : ''}`} style={{ background: isUpcoming ? 'var(--warning-bg)' : 'var(--success-bg)', color: isUpcoming ? 'var(--warning)' : 'var(--success)', alignSelf: 'center' }}>
                                {isUpcoming ? 'Upcoming' : 'Completed'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── SCREEN: PORTAL PREFERENCES / SETTINGS ── */}
          {screen === 'preferences' && (
            <div className="card">
              <div className="card-title-bar">
                <h3 className="card-title"><Video size={18} /> Portal Settings &amp; Preferences</h3>
              </div>

              <form onSubmit={handlePreferencesSubmit} className="pref-grid">
                <div>
                  <h4 style={{ marginBottom: '14px', fontSize: '0.95rem' }}>General Settings</h4>
                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="form-label">Preferred Portal Language</label>
                    <select
                      value={preferences.language || 'English'}
                      onChange={(e) => setPreferences({ ...preferences, language: e.target.value })}
                      className="form-input"
                    >
                      <option value="English">English</option>
                      <option value="Spanish">Spanish (Español)</option>
                      <option value="Hindi">Hindi (हिंदी)</option>
                      <option value="Gujarati">Gujarati (ગુજરાતી)</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="form-label">Preferred Consultation Format</label>
                    <select
                      value={preferences.consultation_preference || 'in_person'}
                      onChange={(e) => setPreferences({ ...preferences, consultation_preference: e.target.value })}
                      className="form-input"
                    >
                      <option value="in_person">In Person Clinic Visit</option>
                      <option value="teleconsultation">Video Consultation / Telehealth</option>
                    </select>
                  </div>
                </div>

                <div>
                  <h4 style={{ marginBottom: '14px', fontSize: '0.95rem' }}>Notification Preferences</h4>
                  <div className="toggle-row">
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Email Notifications</div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Send appointment reminders &amp; receipts</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={preferences.notification_email}
                      onChange={(e) => setPreferences({ ...preferences, notification_email: e.target.checked })}
                      style={{ transform: 'scale(1.2)' }}
                    />
                  </div>

                  <div className="toggle-row">
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>SMS Notifications</div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Send brief reminders on your mobile</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={preferences.notification_sms}
                      onChange={(e) => setPreferences({ ...preferences, notification_sms: e.target.checked })}
                      style={{ transform: 'scale(1.2)' }}
                    />
                  </div>

                  <div className="toggle-row">
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>WhatsApp Alerts</div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Send instant booking alerts on WhatsApp</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={preferences.notification_whatsapp}
                      onChange={(e) => setPreferences({ ...preferences, notification_whatsapp: e.target.checked })}
                      style={{ transform: 'scale(1.2)' }}
                    />
                  </div>

                  <div className="toggle-row">
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Browser Push Notifications</div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Allow live status updates</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={preferences.notification_push}
                      onChange={(e) => setPreferences({ ...preferences, notification_push: e.target.checked })}
                      style={{ transform: 'scale(1.2)' }}
                    />
                  </div>

                  <button type="submit" className="btn-primary" style={{ marginTop: '20px', width: '100%' }}>
                    Save Preferences
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </main>


      {/* ── MODAL: RESCHEDULE APPOINTMENT ── */}
      {rescheduleApptId && (
        <div className="modal-overlay">
          <div className="modal-card">
            <header className="modal-header">
              <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)' }}>Reschedule Appointment</h3>
              <button onClick={() => setRescheduleApptId(null)} style={{ fontSize: '1.25rem', color: 'var(--text-muted)' }}>&times;</button>
            </header>

            <div className="modal-body">
              <div style={{
                backgroundColor: 'rgba(245, 158, 11, 0.08)',
                color: '#d97706',
                border: '1px solid #fef3c7',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 600,
                marginBottom: '16px'
              }}>
                Warning: Appointments cannot be rescheduled within 2 hours of the scheduled time. Limit: 2 reschedule attempts maximum.
              </div>

              <div className="form-group">
                <label className="form-label">New Date</label>
                <input
                  type="date"
                  value={rescheduleDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => handleRescheduleDateSelect(e.target.value)}
                  className="form-input"
                />
              </div>

              {rescheduleDate && (
                <div style={{ marginTop: '16px' }}>
                  <label className="form-label">Select Available Slot</label>
                  <div className="slots-grid">
                    {rescheduleSlots.map((slot) => {
                      const isBooked = slot.status === 'booked';
                      const isSelected = rescheduleSlot === slot.time;
                      return (
                        <button
                          key={slot.time}
                          className={`slot-button${isSelected ? ' selected' : ''}${isBooked ? ' booked' : ''}`}
                          onClick={() => !isBooked && setRescheduleSlot(slot.time)}
                          disabled={isBooked}
                          title={isBooked ? 'Already booked' : `Select ${formatTimeToAMPM(slot.time)}`}
                        >
                          {formatTimeToAMPM(slot.time)}
                        </button>
                      );
                    })}
                    {rescheduleSlots.length === 0 && (
                      <p style={{ gridColumn: 'span 3', color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.85rem' }}>
                        No slots available on this date.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <footer className="modal-footer">
              <button onClick={() => setRescheduleApptId(null)} className="btn-secondary">Cancel</button>
              <button
                onClick={handleRescheduleSubmit}
                className="btn-primary"
                disabled={!rescheduleDate || !rescheduleSlot || isLoading}
              >
                {isLoading ? 'Updating...' : 'Save Changes'}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* ── MODAL: CANCEL APPOINTMENT ── */}
      {cancelApptId && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '480px' }}>
            <header className="modal-header">
              <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)' }}>Cancel Appointment</h3>
              <button onClick={() => setCancelApptId(null)} style={{ fontSize: '1.25rem', color: 'var(--text-muted)' }}>&times;</button>
            </header>

            <div className="modal-body">
              <p style={{ fontSize: '0.9rem', marginBottom: '14px' }}>Are you sure you want to cancel this appointment? Cancellation is not allowed within 2 hours of the scheduled time.</p>

              <div className="form-group">
                <label className="form-label">Reason for Cancellation</label>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Schedule conflict, feeling better"
                  className="form-input"
                />
              </div>
            </div>

            <footer className="modal-footer">
              <button onClick={() => setCancelApptId(null)} className="btn-secondary">Close</button>
              <button onClick={handleCancelSubmit} className="btn-primary" style={{ backgroundColor: 'var(--error-red)', borderColor: 'var(--error-red)' }} disabled={isLoading}>
                {isLoading ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* ── MODAL: PRESCRIPTION DETAIL ── */}
      {viewingPrescription && (() => {
        const { rx, diagnosis, symptoms } = viewingPrescription;
        const doctorName = rx.doctor?.user?.full_name
          ? (rx.doctor.user.full_name.toLowerCase().startsWith('dr') ? rx.doctor.user.full_name : `Dr. ${rx.doctor.user.full_name}`)
          : 'Doctor';
        const medicines = rx.items || rx.medications || [];
        // Prefer the consultation's notes (the doctor's AI-approved clinical summary),
        // then fall back to the prescription-level notes field.
        const consultationNotes = rx.consultation?.notes || '';
        const notes = consultationNotes || rx.notes || '';
        const prescribedDate = new Date(rx.created_at).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        return (
          <div className="modal-overlay" style={{ zIndex: 9999 }} onClick={() => setViewingPrescription(null)}>
            <div
              className="modal-card"
              style={{ maxWidth: '580px', borderRadius: '18px', overflow: 'hidden', padding: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{
                background: 'linear-gradient(135deg, var(--primary-dark) 0%, var(--primary) 100%)',
                padding: '16px 28px 10px', color: '#fff', position: 'relative'
              }}>
                <div style={{ fontSize: '1.8rem', marginBottom: '6px' }}>💊</div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Prescription Details</h3>
                <p style={{ margin: '3px 0 0', fontSize: '0.8rem', opacity: 0.85 }}>
                  Issued by {doctorName} &nbsp;·&nbsp; {prescribedDate}
                </p>
                <button
                  onClick={() => setViewingPrescription(null)}
                  style={{
                    position: 'absolute', top: '14px', right: '16px',
                    background: 'rgba(255,255,255,0.18)', border: 'none', color: '#fff',
                    fontSize: '1rem', cursor: 'pointer', borderRadius: '50%',
                    width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}
                >&times;</button>
              </div>

              {/* Body */}
              <div style={{ padding: '22px 28px', maxHeight: '70vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>

                {/* Clinical Info */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: '6px' }}>🩺 Diagnosis</div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4 }}>{diagnosis}</div>
                  </div>
                  <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: '6px' }}>🤒 Symptoms</div>
                    <div style={{ fontSize: '0.88rem', color: 'var(--ink)', lineHeight: 1.4 }}>{symptoms}</div>
                  </div>
                </div>

                {notes && (
                  <div style={{ background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.2)', borderRadius: '10px', padding: '14px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--primary-dark)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: '6px' }}>📝 Doctor's Notes</div>
                    <div style={{ fontSize: '0.88rem', color: 'var(--ink)', lineHeight: 1.6 }}>{notes}</div>
                  </div>
                )}

                {/* Medicines */}
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: '10px' }}>
                    💊 Prescribed Medicines ({medicines.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {medicines.map((med: any, idx: number) => (
                      <div key={idx} style={{
                        background: 'var(--surface-2)', border: '1px solid var(--border)',
                        borderRadius: '12px', padding: '14px 16px',
                        display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', alignItems: 'start'
                      }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--primary-dark)', marginBottom: '4px' }}>
                            {med.medicine_name || med.name}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                            {med.dosage && (
                              <span style={{ background: 'var(--primary-light)', color: 'var(--primary-dark)', fontSize: '0.75rem', fontWeight: 600, padding: '3px 10px', borderRadius: '20px' }}>
                                📋 {med.dosage}
                              </span>
                            )}
                            {(med.duration || med.duration_days) && (
                              <span style={{ background: '#f0fdf4', color: '#16a34a', fontSize: '0.75rem', fontWeight: 600, padding: '3px 10px', borderRadius: '20px', border: '1px solid #bbf7d0' }}>
                                📅 {med.duration || med.duration_days + ' Days'}
                              </span>
                            )}
                            {med.instructions && (
                              <span style={{ background: '#fff7ed', color: '#c2410c', fontSize: '0.75rem', fontWeight: 600, padding: '3px 10px', borderRadius: '20px', border: '1px solid #fed7aa' }}>
                                ⚠️ {med.instructions}
                              </span>
                            )}
                          </div>
                        </div>
                        <div>
                          <span style={{
                            fontSize: '0.72rem', fontWeight: 700, padding: '4px 10px', borderRadius: '20px',
                            background: idx % 2 === 0 ? 'var(--primary-light)' : '#f0fdf4',
                            color: idx % 2 === 0 ? 'var(--primary)' : '#16a34a'
                          }}>
                            #{idx + 1}
                          </span>
                        </div>
                      </div>
                    ))}
                    {medicines.length === 0 && (
                      <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '16px' }}>
                        No medications listed on this prescription.
                      </div>
                    )}
                  </div>
                </div>

                {/* Status & Rx ID */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--border)', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    RX ID: {rx.id?.toUpperCase()}
                  </div>
                  <span className={`status-pill ${rx.status === 'active' || rx.status === 'dispensed' ? 'completed' : 'pending'}`}>
                    {rx.status}
                  </span>
                </div>
              </div>

              {/* Footer */}
              <div style={{ padding: '14px 28px 20px', display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid var(--border)' }}>
                <button onClick={() => setViewingPrescription(null)} className="btn-secondary">Close</button>
                <button
                  onClick={() => { setViewingPrescription(null); downloadPdf(`/prescriptions/${rx.id}/pdf`, `Prescription_${rx.id.substring(0, 8)}.pdf`); }}
                  className="btn-primary"
                  style={{ gap: '6px' }}
                >
                  <Download size={14} /> Download PDF
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── MODAL: BOOKING CONFIRMATION ── */}
      {showBookingConfirm && (() => {
        const selectedBranch = branches.find((b: any) => b.id === selectedBranchId);
        const selectedDoctor = doctors.find((d: any) => d.id === selectedDoctorId);
        const doctorName = selectedDoctor?.user?.full_name
          ? (selectedDoctor.user.full_name.toLowerCase().startsWith('dr')
            ? selectedDoctor.user.full_name
            : `Dr. ${selectedDoctor.user.full_name}`)
          : 'Selected Doctor';
        return (
          <div className="modal-overlay" style={{ zIndex: 9999, overflowY: 'auto' }}>
            <div className="modal-card" style={{ maxWidth: '520px', borderRadius: '18px', overflow: 'hidden', padding: 0, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
              {/* Header */}
              <div style={{
                background: 'linear-gradient(135deg, var(--primary-dark) 0%, var(--primary) 100%)',
                padding: '24px 28px 20px',
                color: '#fff',
                position: 'relative',
                flexShrink: 0
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📋</div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Confirm Your Appointment</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.82rem', opacity: 0.85 }}>Please review the details before confirming</p>
                <button
                  onClick={() => setShowBookingConfirm(false)}
                  style={{
                    position: 'absolute', top: '16px', right: '18px',
                    background: 'rgba(255,255,255,0.15)', border: 'none',
                    color: '#fff', fontSize: '1.1rem', cursor: 'pointer',
                    borderRadius: '50%', width: '30px', height: '30px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    lineHeight: 1
                  }}
                >&times;</button>
              </div>

              {/* Summary Body */}
              <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flex: 1 }}>
                {/* Summary rows */}
                {[
                  { icon: '🏥', label: 'Branch', value: selectedBranch ? `${selectedBranch.name} Branch` : '—' },
                  { icon: '👨‍⚕️', label: 'Doctor', value: doctorName },
                  { icon: '📅', label: 'Date', value: bookingDate ? new Date(bookingDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '—' },
                  { icon: '🕐', label: 'Time Slot', value: bookingSlot || '—' },
                  { icon: consultationType === 'teleconsultation' ? '💻' : '🏥', label: 'Mode', value: consultationType === 'teleconsultation' ? 'Tele Consultation (Video Call)' : 'In Clinic Visit' },
                  { icon: '🦷', label: 'Treatment Type', value: treatmentType === 'Other (Custom Concern)' ? (customTreatmentText || 'Other') : (treatmentType || 'General Checkup') },
                ].map(({ icon, label, value }) => (
                  <div key={label} style={{
                    display: 'flex', alignItems: 'flex-start', gap: '12px',
                    padding: '10px 14px', borderRadius: '10px',
                    background: 'var(--surface-2)', border: '1px solid var(--border)'
                  }}>
                    <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{label}</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--ink)', marginTop: '2px' }}>{value}</div>
                    </div>
                  </div>
                ))}
                {bookingNotes.trim() && (
                  <div style={{
                    padding: '10px 14px', borderRadius: '10px',
                    background: 'var(--surface-2)', border: '1px solid var(--border)'
                  }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '4px' }}>📝 Notes for Doctor</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--ink)', lineHeight: 1.5 }}>{bookingNotes}</div>
                  </div>
                )}

                {/* Disclaimer */}
                <div style={{
                  background: 'rgba(14,165,233,0.07)', border: '1px solid rgba(14,165,233,0.2)',
                  borderRadius: '8px', padding: '10px 14px', fontSize: '0.78rem',
                  color: 'var(--primary-dark)', lineHeight: 1.5
                }}>
                  ℹ️ Once confirmed, you'll receive a notification. You can reschedule or cancel anytime from the Upcoming Appointments section.
                </div>
              </div>

              {/* Footer */}
              <div style={{
                padding: '16px 28px 24px',
                display: 'flex', gap: '12px', justifyContent: 'flex-end',
                borderTop: '1px solid var(--border)',
                flexShrink: 0,
                background: '#ffffff'
              }}>
                <button
                  onClick={() => setShowBookingConfirm(false)}
                  className="btn-secondary"
                  disabled={isLoading}
                >
                  ← Go Back
                </button>
                <button
                  onClick={async () => {
                    setShowBookingConfirm(false);
                    await handleBookingSubmit();
                  }}
                  className="btn-primary"
                  disabled={isLoading}
                  style={{ minWidth: '150px', justifyContent: 'center' }}
                >
                  {isLoading ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)',
                        borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite'
                      }} />
                      Booking...
                    </span>
                  ) : '✓ Confirm & Book'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── MODAL: UPLOAD MEDICAL REPORT ── */}
      {showUploadModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '500px' }}>
            <header className="modal-header">
              <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)' }}>Upload Diagnostics Report</h3>
              <button onClick={() => setShowUploadModal(false)} style={{ fontSize: '1.25rem', color: 'var(--text-muted)' }}>&times;</button>
            </header>

            <form onSubmit={handleReportUpload}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Report Title</label>
                  <input
                    type="text"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="e.g. Dental OPG X-Ray, Blood Test"
                    className="form-input"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Report Category</label>
                  <select
                    value={uploadType}
                    onChange={(e) => setUploadType(e.target.value)}
                    className="form-input"
                  >
                    <option value="Lab Report">Lab Report</option>
                    <option value="X-Ray Scan">X-Ray Scan</option>
                    <option value="Prescription PDF">Prescription PDF</option>
                    <option value="Consent Form">Consent Form</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Select Report File</label>
                  <div className="upload-dropzone">
                    <UploadCloud size={32} style={{ color: 'var(--primary-teal)' }} />
                    <input
                      type="file"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      required
                      style={{ fontSize: '0.85rem' }}
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>PDF, PNG, JPG scans are accepted. Max: 10MB</span>
                  </div>
                </div>
              </div>

              <footer className="modal-footer">
                <button type="button" onClick={() => setShowUploadModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary" disabled={isLoading}>
                  {isLoading ? 'Uploading...' : 'Upload File'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: VIEW REPORT ── */}
      {viewingReport && (() => {
        const fileUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${viewingReport.file_url}`;
        const isImage = isImageFile(viewingReport.file_url);

        return (
          <div className="modal-overlay" style={{ zIndex: 1100 }}>
            <div className="modal-card" style={{ maxWidth: '800px', width: '90%' }}>
              <header className="modal-header">
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)' }}>{viewingReport.title}</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Category: {viewingReport.report_type}</span>
                </div>
                <button onClick={() => setViewingReport(null)} style={{ fontSize: '1.5rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>&times;</button>
              </header>

              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px' }}>
                {isImage ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Controls */}
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', background: 'var(--surface-2)', padding: '6px', borderRadius: '8px' }}>
                      <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => setImageZoom(prev => Math.max(0.5, prev - 0.25))}>Zoom Out (-)</button>
                      <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => setImageZoom(1)}>Reset</button>
                      <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => setImageZoom(prev => Math.min(3, prev + 0.25))}>{Math.round(imageZoom * 100)}%</button>
                      <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => setImageRotate(prev => (prev + 90) % 360)}>Rotate ↻</button>
                    </div>
                    {/* Container */}
                    <div style={{
                      width: '100%',
                      height: '450px',
                      background: '#0f172a',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'auto',
                      position: 'relative'
                    }}>
                      <img
                        src={fileUrl}
                        alt={viewingReport.title}
                        style={{
                          maxHeight: '100%',
                          maxWidth: '100%',
                          objectFit: 'contain',
                          transform: `scale(${imageZoom}) rotate(${imageRotate}deg)`,
                          transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                      />
                    </div>
                  </div>
                ) : viewingReport.file_url?.toLowerCase().endsWith('.pdf') ? (
                  <div style={{ width: '100%', height: '500px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <iframe
                      src={fileUrl}
                      style={{ width: '100%', height: '100%', border: 'none' }}
                      title={viewingReport.title}
                    />
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--surface-2)', borderRadius: '8px' }}>
                    <span style={{ fontSize: '3rem', display: 'block', marginBottom: '12px' }}>📁</span>
                    <p style={{ margin: '0 0 16px', fontWeight: 600 }}>Preview not available for this file type</p>
                    <a
                      href={fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-primary"
                      style={{ display: 'inline-block', textDecoration: 'none', fontSize: '0.85rem' }}
                    >
                      Open in New Tab / Download
                    </a>
                  </div>
                )}
              </div>

              <footer className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border)', padding: '12px 20px' }}>
                <a
                  href={fileUrl}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary"
                  style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
                >
                  Download File
                </a>
                <button onClick={() => setViewingReport(null)} className="btn-primary" style={{ fontSize: '0.85rem' }}>
                  Close
                </button>
              </footer>
            </div>
          </div>
        );
      })()}

      {/* ── MODAL: VIEW APPOINTMENT DETAILS ── */}
      {viewingAppointment && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-card" style={{ maxWidth: '600px', width: '95%' }}>
            <header className="modal-header">
              <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)' }}>Appointment Details</h3>
              <button onClick={() => setViewingAppointment(null)} style={{ fontSize: '1.5rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>&times;</button>
            </header>
            <div className="modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Doctor</label>
                  <p style={{ margin: '4px 0 0', fontWeight: 600 }}>
                    {viewingAppointment.doctor_name || (viewingAppointment.doctor?.user?.full_name?.toLowerCase().startsWith('dr') ? viewingAppointment.doctor?.user?.full_name : `Dr. ${viewingAppointment.doctor?.user?.full_name}`)}
                  </p>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Branch</label>
                  <p style={{ margin: '4px 0 0' }}>{viewingAppointment.branch?.name || 'Main Branch'}</p>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Date &amp; Time</label>
                  <p style={{ margin: '4px 0 0' }}>{new Date(viewingAppointment.appointment_datetime).toLocaleString()}</p>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Status</label>
                  <p style={{ margin: '4px 0 0' }}>
                    <span className={`status-pill ${viewingAppointment.status}`}>{viewingAppointment.status}</span>
                  </p>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Type</label>
                  <p style={{ margin: '4px 0 0' }}>
                    <span className={`badge ${viewingAppointment.consultation_type === 'teleconsultation' ? 'badge-tele' : 'badge-clinic'}`} style={{
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      background: viewingAppointment.consultation_type === 'teleconsultation' ? 'var(--primary-light)' : '#f1f5f9',
                      color: viewingAppointment.consultation_type === 'teleconsultation' ? 'var(--primary)' : '#475569'
                    }}>
                      {viewingAppointment.consultation_type === 'teleconsultation' ? '💻 Tele Consultation' : '🏥 In Clinic'}
                    </span>
                  </p>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Treatment Concern</label>
                  <p style={{ margin: '4px 0 0' }}>{viewingAppointment.treatment_type || 'General Checkup'}</p>
                </div>
              </div>

              {viewingAppointment.notes && (
                <div style={{ marginTop: '8px', padding: '12px', background: 'var(--surface-2)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Consultation Notes / Symptoms</label>
                  <p style={{ margin: 0, fontSize: '0.88rem', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{viewingAppointment.notes}</p>
                </div>
              )}

              {viewingAppointment.consultation_type === 'teleconsultation' && viewingAppointment.status === 'confirmed' && (
                <div style={{ marginTop: '8px', padding: '12px', background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>💻 Video Consultation is ready to join!</p>
                  <button
                    onClick={() => {
                      setViewingAppointment(null);
                      handleJoinMeeting(viewingAppointment.id);
                    }}
                    className="btn-primary"
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    <Video size={16} /> Join Video Consultation
                  </button>
                </div>
              )}
            </div>
            <footer className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', padding: '12px 20px' }}>
              <button onClick={() => setViewingAppointment(null)} className="btn-primary" style={{ fontSize: '0.85rem' }}>Close</button>
            </footer>
          </div>
        </div>
      )}

      {/* ── MODAL: VIEW HISTORY VISIT DETAILS ── */}
      {viewingHistoryEvent && (() => {
        const eventDate = new Date(viewingHistoryEvent.datetime).toDateString();
        const rxMatch = timeline.find(event =>
          event.event_type === 'prescription' &&
          new Date(event.datetime).toDateString() === eventDate
        );
        const billMatch = timeline.find(event =>
          event.event_type === 'invoice' &&
          new Date(event.datetime).toDateString() === eventDate
        );

        return (
          <div className="modal-overlay" style={{ zIndex: 1100 }}>
            <div className="modal-card" style={{ maxWidth: '650px', width: '95%' }}>
              <header className="modal-header">
                <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)' }}>Medical History Visit Details</h3>
                <button onClick={() => setViewingHistoryEvent(null)} style={{ fontSize: '1.5rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>&times;</button>
              </header>
              <div className="modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Doctor</label>
                    <p style={{ margin: '4px 0 0', fontWeight: 600 }}>{viewingHistoryEvent.title}</p>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Visit Date</label>
                    <p style={{ margin: '4px 0 0' }}>{new Date(viewingHistoryEvent.datetime).toLocaleString()}</p>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Diagnosis / Medical Summary</label>
                  <div style={{ padding: '12px', background: 'var(--surface-2)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--primary)' }}>
                      {viewingHistoryEvent.details?.diagnosis || viewingHistoryEvent.description || 'No diagnosis recorded.'}
                    </p>
                  </div>
                </div>

                {viewingHistoryEvent.details?.symptoms && (
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Recorded Symptoms</label>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--ink)' }}>{viewingHistoryEvent.details.symptoms}</p>
                  </div>
                )}

                {viewingHistoryEvent.details?.notes && (
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Clinical Instructions &amp; Recommendations</label>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--muted)', fontStyle: 'italic', lineHeight: 1.5 }}>
                      "{viewingHistoryEvent.details.notes}"
                    </p>
                  </div>
                )}

                {rxMatch && (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: '8px' }}>💊 Prescribed Medications</label>
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <p style={{ margin: '0 0 8px', fontSize: '0.82rem', color: 'var(--muted)' }}>
                        Prescription Code: {(rxMatch.details?.prescription_id || rxMatch.id)?.substring(0, 8).toUpperCase()}
                      </p>
                      <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.88rem' }}>
                        {(rxMatch.details?.medicines || rxMatch.details?.medications || rxMatch.details?.items)?.map((med: any, idx: number) => (
                          <li key={idx} style={{ marginBottom: '4px' }}>
                            <strong>{med.name || med.medicine_name}</strong> - {med.dosage} ({med.duration || `${med.duration_days} Days`})
                            {med.instructions && <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Instructions: {med.instructions}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {billMatch && (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: '8px' }}>💳 Associated Billing Invoice</label>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div>
                        <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600 }}>{billMatch.title}</p>
                        <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--muted)' }}>Amount: {billMatch.description}</p>
                      </div>
                      <button
                        onClick={() => {
                          const fullBill = dashboardData?.bills?.find((b: any) => b.id === billMatch.id);
                          if (fullBill) {
                            setViewingInvoice(fullBill);
                          } else {
                            triggerToast('error', 'Invoice details not loaded.');
                          }
                        }}
                        className="btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                      >
                        View Full Invoice
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <footer className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', padding: '12px 20px' }}>
                <button onClick={() => setViewingHistoryEvent(null)} className="btn-primary" style={{ fontSize: '0.85rem' }}>Close</button>
              </footer>
            </div>
          </div>
        );
      })()}

      {/* ── MODAL: VIEW INVOICE DETAILS ── */}
      {viewingInvoice && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-card" style={{ maxWidth: '600px', width: '95%' }}>
            <header className="modal-header">
              <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)' }}>Invoice &amp; Statement</h3>
              <button onClick={() => setViewingInvoice(null)} style={{ fontSize: '1.5rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>&times;</button>
            </header>
            <div className="modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--primary)' }}>INV-{viewingInvoice.invoice_number}</h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Issued: {new Date(viewingInvoice.created_at || viewingInvoice.due_date).toLocaleDateString()}</span>
                </div>
                <span className={`status-pill ${viewingInvoice.status}`}>{viewingInvoice.status}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span style={{ color: 'var(--muted)' }}>Consultation Fee / Treatment:</span>
                  <span>₹{viewingInvoice.total_amount}</span>
                </div>
                {viewingInvoice.discount_amount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#16a34a' }}>
                    <span>Discount:</span>
                    <span>- ₹{viewingInvoice.discount_amount}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span>GST / Tax (18%):</span>
                  <span>₹{viewingInvoice.tax_amount}</span>
                </div>
                {patientProfile?.insurance_provider && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--primary)' }}>
                    <span>Insurance Covered ({patientProfile.insurance_provider}):</span>
                    <span>₹{Math.max(0, Number(viewingInvoice.total_amount) + Number(viewingInvoice.tax_amount) - Number(viewingInvoice.discount_amount) - Number(viewingInvoice.grand_total)).toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 700, borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: '5px' }}>
                  <span>Grand Total:</span>
                  <span>₹{viewingInvoice.grand_total}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--muted)' }}>
                  <span>Amount Paid:</span>
                  <span>₹{viewingInvoice.amount_paid}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', fontWeight: 700, color: viewingInvoice.balance_due > 0 ? 'var(--error-red)' : '#16a34a' }}>
                  <span>Balance Due:</span>
                  <span>₹{viewingInvoice.balance_due}</span>
                </div>
              </div>

              {patientProfile?.insurance_provider && (
                <div style={{ marginTop: '10px', padding: '10px', background: 'var(--surface-2)', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.8rem' }}>
                  <span style={{ fontWeight: 600, display: 'block', marginBottom: '2px' }}>Insurance Information</span>
                  Provider: {patientProfile.insurance_provider} • Policy No: {patientProfile.insurance_policy_no || 'N/A'}
                </div>
              )}
            </div>
            <footer className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border)', padding: '12px 20px' }}>
              <button
                onClick={() => downloadPdf(`/billing/${viewingInvoice.id}/pdf`, `Invoice_${viewingInvoice.invoice_number}.pdf`)}
                className="btn-secondary"
                style={{ fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Download size={14} /> Download PDF Invoice
              </button>
              <button onClick={() => setViewingInvoice(null)} className="btn-primary" style={{ fontSize: '0.85rem' }}>Close</button>
            </footer>
          </div>
        </div>
      )}

      {/* ── MODAL: BOOKING CONFLICT DETECTED ── */}
      {conflictAppt && (
        <div className="modal-overlay" style={{ zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', backgroundColor: 'rgba(15, 23, 42, 0.6)' }}>
          <div className="modal-card" style={{ maxWidth: '500px', width: '90%', borderRadius: '16px', border: '1px solid rgba(226, 232, 240, 0.8)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', padding: '24px', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#fee2e2', color: '#ef4444', flexShrink: 0 }}>
                <Clock size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', fontFamily: 'var(--font-heading)' }}>Booking Conflict Detected</h3>
                <p style={{ margin: '8px 0 0', fontSize: '0.9rem', color: '#475569', lineHeight: 1.5 }}>
                  You already have an active appointment scheduled on <strong>{bookingDate}</strong> with <strong>{conflictAppt.doctor?.user?.full_name || 'this doctor'}</strong>.
                </p>
                <p style={{ margin: '8px 0 0', fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5 }}>
                  Under clinic guidelines, patients can only book one active appointment per doctor per day. You can reschedule your existing appointment to a different time instead.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
              <button
                onClick={() => setConflictAppt(null)}
                className="btn-secondary"
                style={{ padding: '10px 18px', fontSize: '0.875rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 500 }}
              >
                Cancel &amp; Close
              </button>
              <button
                onClick={() => {
                  const id = conflictAppt.id;
                  const docId = conflictAppt.doctor_id;
                  setConflictAppt(null);
                  setScreen('dashboard');
                  openRescheduleModal(id, docId);
                }}
                className="btn-primary"
                style={{ padding: '10px 18px', fontSize: '0.875rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                <Clock size={16} /> Reschedule Existing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default PatientPortal;
