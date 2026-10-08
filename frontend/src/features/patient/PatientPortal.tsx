import React, { useState, useEffect } from 'react';
import { api, getWebSocketUrl } from '../../services/api';
import { X } from 'lucide-react';
import { JitsiVideoModal } from './components/JitsiVideoModal';
import './PatientPortal.css';

import { PatientSidebar } from './components/PatientSidebar';
import { PatientHeader } from './components/PatientHeader';
import { DashboardTab } from './components/DashboardTab';
import { AppointmentsTab } from './components/AppointmentsTab';
import { ProfileTab } from './components/ProfileTab';
import { TimelineTab } from './components/TimelineTab';
import { PrescriptionsTab } from './components/PrescriptionsTab';
import { BillingTab } from './components/BillingTab';
import { ReportsTab } from './components/ReportsTab';
import { PreferencesTab } from './components/PreferencesTab';
import { TeleconsultationTab } from './components/TeleconsultationTab';
import { BookingWizard } from './components/BookingWizard';
import { PatientModals } from './components/PatientModals';
import { ProfileCompletionWizard } from './components/ProfileCompletionWizard';

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
      message: `File size exceeds the 10MB limit (${(file.size / (1024 * 1024)).toFixed(2)}MB). Please compress the file before uploading.`
    };
  }
  
  return { isValid: true, message: '' };
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
  const [screen, setScreen] = useState<ScreenType>(() => {
    const saved = localStorage.getItem('patient_portal_tab');
    const validTabs = ['dashboard', 'appointments', 'prescriptions', 'billing', 'reports', 'preferences', 'timeline', 'profile', 'book', 'teleconsultation'];
    return (saved && validTabs.includes(saved) ? saved : 'dashboard') as ScreenType;
  });

  useEffect(() => {
    localStorage.setItem('patient_portal_tab', screen);
  }, [screen]);

  const [patientProfile, setPatientProfile] = useState<any>(null);
  const [doctorReadyNotification, setDoctorReadyNotification] = useState<{
    appointmentId: string;
    doctorName: string;
    specialty?: string;
  } | null>(null);
  const [isGlobalVideoModalOpen, setIsGlobalVideoModalOpen] = useState<boolean>(false);
  const [globalVideoAppt, setGlobalVideoAppt] = useState<any>(null);
  const [dismissedNotificationApptId, setDismissedNotificationApptId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [statistics, setStatistics] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [followups, setFollowups] = useState<any[]>([]);
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

  // Profile completion flow state: 'prompt' | 'wizard' | 'dashboard'
  const [profileChoice, setProfileChoice] = useState<'prompt' | 'wizard' | 'dashboard'>(() => {
    return (sessionStorage.getItem('patient_profile_flow') as 'prompt' | 'wizard' | 'dashboard') || 'prompt';
  });

  const handleSkipProfileToDashboard = () => {
    setProfileChoice('dashboard');
    sessionStorage.setItem('patient_profile_flow', 'dashboard');
  };

  const handleOpenProfileWizard = () => {
    setProfileChoice('wizard');
    sessionStorage.setItem('patient_profile_flow', 'wizard');
  };

  useEffect(() => {
    const isWelcomeModalOpen = Boolean(patientProfile && !patientProfile.is_profile_completed && profileChoice === 'prompt');
    if (isWelcomeModalOpen || isGlobalVideoModalOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow || '';
      };
    }
  }, [patientProfile, profileChoice, isGlobalVideoModalOpen]);

  // Booking Wizard State
  const [bookingStep, setBookingStep] = useState<number>(() => {
    const val = localStorage.getItem('booking_wizard_step');
    return val ? parseInt(val, 10) : 1;
  });
  const [branches, setBranches] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [availableSlots, setAvailableSlots] = useState<{ time: string; status: string }[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => localStorage.getItem('booking_selected_branch_id') || '');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(() => localStorage.getItem('booking_selected_doctor_id') || '');
  const [bookingDate, setBookingDate] = useState<string>(() => localStorage.getItem('booking_date') || '');
  const [bookingSlot, setBookingSlot] = useState<string>(() => localStorage.getItem('booking_slot') || '');
  const [calendarViewMonth, setCalendarViewMonth] = useState<number>(() => new Date().getMonth());
  const [calendarViewYear, setCalendarViewYear] = useState<number>(() => new Date().getFullYear());
  const [consultationType, setConsultationType] = useState<string>(() => localStorage.getItem('booking_consultation_type') || 'in_person');
  const [treatmentType, setTreatmentType] = useState<string>('Routine Checkup');
  const [customTreatmentText, setCustomTreatmentText] = useState<string>('');
  const [bookingNotes, setBookingNotes] = useState<string>('');
  const [bookingSymptoms, setBookingSymptoms] = useState<string>('');
  const [attachedReportId, setAttachedReportId] = useState<string | null>(null);

  // Filters & Search for Step 3
  const [filterSpecialty, setFilterSpecialty] = useState<string>('');
  const [filterExperience, setFilterExperience] = useState<string>('');
  const [filterGender, setFilterGender] = useState<string>('');
  const [filterLanguage, setFilterLanguage] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortOption, setSortOption] = useState<string>('experience_desc');

  // Appointments Filter State
  const [appointmentFilter, setAppointmentFilter] = useState<'all' | 'upcoming' | 'completed' | 'cancelled'>('all');
  const [appointmentDateFilter, setAppointmentDateFilter] = useState<string>('');

  // Modals & UI States
  const [rescheduleApptId, setRescheduleApptId] = useState<string | null>(null);
  const [rescheduleDoctorId, setRescheduleDoctorId] = useState<string | null>(null);
  const [rescheduleConsultationType, setRescheduleConsultationType] = useState<string>('in_person');
  const [rescheduleDate, setRescheduleDate] = useState<string>('');
  const [rescheduleSlots, setRescheduleSlots] = useState<{ time: string; status: string }[]>([]);
  const [rescheduleSlot, setRescheduleSlot] = useState<string>('');

  const [cancelApptId, setCancelApptId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');

  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [uploadTitle, setUploadTitle] = useState<string>('');
  const [uploadType, setUploadType] = useState<string>('Lab Report');
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [viewingPrescription, setViewingPrescription] = useState<any>(null);

  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Teleconsultation detail selection state
  const [selectedTeleId, setSelectedTeleId] = useState<string | null>(null);

  // Booking Confirmation Modal
  const [showBookingConfirm, setShowBookingConfirm] = useState<boolean>(false);

  // Modal State for Viewing Detailed Report File
  const [viewingReport, setViewingReport] = useState<any>(null);
  const [imageZoom, setImageZoom] = useState<number>(1);
  const [imageRotate, setImageRotate] = useState<number>(0);

  // Modal State for Viewing Full Appointment Details
  const [viewingAppointment, setViewingAppointment] = useState<any>(null);

  // Modal State for Viewing Full History Event (Visit/Consultation)
  const [viewingHistoryEvent, setViewingHistoryEvent] = useState<any>(null);

  // Modal State for Viewing Full Invoice Details
  const [viewingInvoice, setViewingInvoice] = useState<any>(null);

  // Editable Profile state
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false);
  const [profileForm, setProfileForm] = useState<any>({});

  // Conflict state
  const [conflictAppt, setConflictAppt] = useState<any>(null);

  const triggerToast = (type: 'success' | 'error' | 'info', message: string) => {
    // Map 'info' type to 'success' so we only use green for success and red for unsuccessful
    const mappedType = type === 'info' ? 'success' : type;
    setToast({ type: mappedType, message });
    setTimeout(() => setToast(null), 4000);
  };

  const handleMarkNotificationRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (err) {
      console.error("Failed to mark notification as read", err);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      console.error("Failed to mark all notifications as read", err);
    }
  };

  const handleClearAllNotifications = async () => {
    try {
      await api.delete('/notifications/clear-all');
      setNotifications([]);
      triggerToast('success', 'All notifications cleared successfully.');
    } catch (err) {
      console.error("Failed to clear notifications", err);
      triggerToast('error', 'Failed to clear notifications.');
    }
  };


  const clearBookingWizardState = () => {
    setBookingStep(1);
    setSelectedBranchId('');
    setSelectedDoctorId('');
    setBookingDate('');
    setBookingSlot('');
    setAvailableSlots([]);
    setConsultationType('in_person');
    setTreatmentType('Routine Checkup');
    setCustomTreatmentText('');
    setBookingNotes('');
    setBookingSymptoms('');
    setAttachedReportId(null);
    localStorage.removeItem('booking_wizard_step');
    localStorage.removeItem('booking_selected_branch_id');
    localStorage.removeItem('booking_selected_doctor_id');
    localStorage.removeItem('booking_date');
    localStorage.removeItem('booking_slot');
    localStorage.removeItem('booking_consultation_type');
  };

  const openRescheduleModal = async (apptId: string, doctorId: string, type: string = 'in_person') => {
    setRescheduleApptId(apptId);
    setRescheduleDoctorId(doctorId);
    setRescheduleConsultationType(type || 'in_person');
    setRescheduleDate('');
    setRescheduleSlot('');
    setRescheduleSlots([]);
  };

  const handleRescheduleDateSelect = async (dateStr: string, typeOverride?: string) => {
    setRescheduleDate(dateStr);
    setRescheduleSlot('');
    const currentType = typeOverride || rescheduleConsultationType || 'in_person';
    if (typeOverride) {
      setRescheduleConsultationType(typeOverride);
    }
    if (rescheduleDoctorId && dateStr) {
      try {
        const typeParam = `&consultation_type=${currentType}`;
        const res = await api.get(`/appointments/available-slots?doctor_id=${rescheduleDoctorId}&date=${dateStr}${typeParam}`);
        setRescheduleSlots(extractArrayData(res.data));
      } catch (err) {
        triggerToast('error', 'Could not load slots for rescheduling.');
      }
    }
  };

  const getInitials = (name?: string): string => {
    if (!name) return 'P';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const isImageFile = (url?: string): boolean => {
    if (!url) return false;
    const cleanUrl = url.split('?')[0].toLowerCase();
    if (cleanUrl.includes('.pdf')) return false;
    return cleanUrl.includes('/image/') || cleanUrl.endsWith('.png') || cleanUrl.endsWith('.jpg') || cleanUrl.endsWith('.jpeg') || cleanUrl.endsWith('.gif') || cleanUrl.endsWith('.webp');
  };

  const extractArrayData = (resData: any): any[] => {
    if (!resData) return [];
    if (Array.isArray(resData)) return resData;
    if (Array.isArray(resData.data?.items)) return resData.data.items;
    if (Array.isArray(resData.items)) return resData.items;
    if (Array.isArray(resData.data)) return resData.data;
    return [];
  };

  const fetchPortalData = async () => {
    setIsLoading(true);
    try {
      const [profileRes, dashRes, statsRes, timelineRes, prefRes, branchRes, docRes, followupsRes] = await Promise.all([
        api.get('/patients/me'),
        api.get('/patients/me/dashboard'),
        api.get('/patients/me/statistics'),
        api.get('/patients/me/timeline'),
        api.get('/patients/me/preferences'),
        api.get('/branches'),
        api.get('/doctors'),
        api.get('/patients/me/follow-ups').catch(() => ({ data: { data: [] } })),
      ]);

      setPatientProfile(profileRes.data?.data || profileRes.data);
      const dashData = dashRes.data?.data || dashRes.data;
      setDashboardData(dashData);

      // Check active teleconsultation status and upcoming calls
      try {
        const activeRes = await api.get('/teleconsultations/active').catch(() => null);
        const activeTele = activeRes?.data?.data || activeRes?.data;
        if (activeTele && activeTele.can_join && !isGlobalVideoModalOpen) {
          if (activeTele.is_ongoing || (activeTele.time_left_minutes !== undefined && activeTele.time_left_minutes <= 15)) {
            setDoctorReadyNotification({
              appointmentId: activeTele.id,
              doctorName: activeTele.doctor_name || 'Clinician',
              specialty: activeTele.specialty || 'General Physician'
            });
            setGlobalVideoAppt(activeTele);
          }
        } else {
          setDoctorReadyNotification(null);
        }
      } catch (teleErr) {
        console.debug('Error checking active teleconsultation:', teleErr);
      }
      setStatistics(statsRes.data?.data || statsRes.data);
      setTimeline(extractArrayData(timelineRes.data));
      if (prefRes.data) {
        setPreferences((prev: any) => ({ ...prev, ...(prefRes.data?.data || prefRes.data) }));
      }
      setBranches(extractArrayData(branchRes.data));
      setDoctors(extractArrayData(docRes.data));
      setFollowups(extractArrayData(followupsRes.data));

      try {
        const notiRes = await api.get('/notifications');
        setNotifications(extractArrayData(notiRes.data));
      } catch (notiErr) {
        console.error("Failed to load notifications", notiErr);
      }
    } catch (err: any) {
      triggerToast('error', getErrorMessage(err, 'Failed to load patient portal records.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPortalData();
  }, []);

  // Periodic poll for incoming teleconsultation call signal and live active status
  useEffect(() => {
    let isMounted = true;
    const pollIncomingAndActive = async () => {
      try {
        const [incomingRes, activeRes] = await Promise.all([
          api.get('/teleconsultations/check-incoming-call').catch(() => null),
          api.get('/teleconsultations/active').catch(() => null)
        ]);
        if (!isMounted) return;

        const incoming = incomingRes?.data?.data || incomingRes?.data;
        if (incoming && incoming.has_incoming_call && !isGlobalVideoModalOpen) {
          setDoctorReadyNotification({
            appointmentId: incoming.appointment_id,
            doctorName: incoming.caller_name || 'your doctor',
            specialty: ''
          });
          setGlobalVideoAppt({
            id: incoming.appointment_id,
            doctor_name: incoming.caller_name || 'Doctor',
            specialty: ''
          });
          return;
        }

        const active = activeRes?.data?.data || activeRes?.data;
        if (active && active.can_join && !isGlobalVideoModalOpen) {
          if (active.is_ongoing || (active.time_left_minutes !== undefined && active.time_left_minutes <= 15)) {
            setDoctorReadyNotification((prev: any) => {
              if (prev && prev.appointmentId === active.id) return prev;
              return {
                appointmentId: active.id,
                doctorName: active.doctor_name || 'Clinician',
                specialty: active.specialty || ''
              };
            });
            setGlobalVideoAppt((prev: any) => {
              if (prev && prev.id === active.id) return prev;
              return active;
            });
          }
        }
      } catch (e) {
        // silent polling failure
      }
    };

    pollIncomingAndActive();
    const interval = setInterval(pollIncomingAndActive, 6000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isGlobalVideoModalOpen]);

  // Real-time WebSocket Queue Update
  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connectWebSocket = () => {
      try {
        const wsUrl = getWebSocketUrl();
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
          console.log('WebSocket connected for patient portal queue updates');
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.event === 'queue_updated') {
              console.log('Queue update received via WebSocket, refreshing patient portal...');
              fetchPortalData();
            } else if (data.event === 'doctor_ready') {
              console.log('Doctor ready event received via WebSocket:', data);
              setDoctorReadyNotification({
                appointmentId: data.appointment_id,
                doctorName: data.doctor_name || 'your doctor',
                specialty: ''
              });
              setGlobalVideoAppt({
                id: data.appointment_id,
                doctor_name: data.doctor_name || 'Doctor',
                meeting_url: data.meeting_url
              });
              fetchPortalData();
            } else if (data.event === 'new_notification') {
              console.log('New notification received via WebSocket:', data.data);
              triggerToast('info', `${data.data.title}: ${data.data.message}`);
              fetchPortalData();
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
  }, []);

  const getLocalDateString = (d: Date = new Date()): string => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const handleBookFollowup = (followup: any) => {
    setSelectedBranchId(followup.branch_id || '');
    setSelectedDoctorId(followup.doctor_id || '');
    setTreatmentType(followup.treatment_type || 'Routine Follow-up');
    setConsultationType('in_person');
    setBookingSlot('');
    
    const todayStr = getLocalDateString(new Date());
    let targetDate = followup.recommended_date ? followup.recommended_date.split('T')[0] : '';
    if (targetDate) {
      if (targetDate < todayStr) {
        targetDate = todayStr;
      }
    } else {
      targetDate = todayStr;
    }
    
    setBookingDate(targetDate);
    const parts = targetDate.split('-');
    if (parts.length === 3) {
      setCalendarViewYear(parseInt(parts[0], 10));
      setCalendarViewMonth(parseInt(parts[1], 10) - 1);
    }
    
    localStorage.setItem('booking_selected_branch_id', followup.branch_id || '');
    localStorage.setItem('booking_selected_doctor_id', followup.doctor_id || '');
    localStorage.setItem('booking_consultation_type', 'in_person');
    localStorage.setItem('booking_date', targetDate);
    localStorage.setItem('booking_slot', '');
    
    setBookingStep(4);
    setScreen('book');
  };

  useEffect(() => {
    localStorage.setItem('booking_wizard_step', bookingStep.toString());
  }, [bookingStep]);

  useEffect(() => {
    if (selectedBranchId) localStorage.setItem('booking_selected_branch_id', selectedBranchId);
    else localStorage.removeItem('booking_selected_branch_id');
  }, [selectedBranchId]);

  useEffect(() => {
    if (selectedDoctorId) localStorage.setItem('booking_selected_doctor_id', selectedDoctorId);
    else localStorage.removeItem('booking_selected_doctor_id');
  }, [selectedDoctorId]);

  useEffect(() => {
    if (bookingDate) localStorage.setItem('booking_date', bookingDate);
    else localStorage.removeItem('booking_date');
  }, [bookingDate]);

  useEffect(() => {
    if (bookingSlot) localStorage.setItem('booking_slot', bookingSlot);
    else localStorage.removeItem('booking_slot');
  }, [bookingSlot]);

  useEffect(() => {
    if (consultationType) localStorage.setItem('booking_consultation_type', consultationType);
  }, [consultationType]);

  const handleBranchSelect = (branchId: string) => {
    setSelectedBranchId(branchId);
    setSelectedDoctorId('');
    setBookingDate('');
    setBookingSlot('');
    setAvailableSlots([]);
    setBookingStep(2);
  };

  // Synchronize doctor selection if branch changes/mismatches
  useEffect(() => {
    if (selectedBranchId && selectedDoctorId) {
      const doc = (Array.isArray(doctors) ? doctors : []).find((d: any) => d.id === selectedDoctorId);
      if (doc && doc.branch_id && doc.branch_id !== selectedBranchId) {
        setSelectedDoctorId('');
      }
    }
  }, [selectedBranchId, selectedDoctorId, doctors]);

  // Auto re-fetch slots when consultationType changes for selected doctor & date
  useEffect(() => {
    if (selectedDoctorId && bookingDate) {
      const branchParam = selectedBranchId ? `&branch_id=${selectedBranchId}` : '';
      api
        .get(
          `/appointments/available-slots?doctor_id=${selectedDoctorId}&date=${bookingDate}&consultation_type=${consultationType}${branchParam}`
        )
        .then((res) => setAvailableSlots(extractArrayData(res.data)))
        .catch(() => {});
    }
  }, [consultationType, selectedDoctorId, bookingDate, selectedBranchId]);

  const handleDoctorSelect = async (doctorId: string) => {
    setSelectedDoctorId(doctorId);
    
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;
    
    setBookingDate(todayStr);
    setBookingSlot('');
    setAvailableSlots([]);
    setBookingStep(4);

    if (doctorId && todayStr) {
      try {
        const branchParam = selectedBranchId ? `&branch_id=${selectedBranchId}` : '';
        const res = await api.get(
          `/appointments/available-slots?doctor_id=${doctorId}&date=${todayStr}&consultation_type=${consultationType}${branchParam}`
        );
        setAvailableSlots(extractArrayData(res.data));
      } catch (err: any) {
        triggerToast('error', 'Failed to fetch doctor availability slots.');
      }
    }
  };

  const handleDateChange = async (date: string) => {
    const todayStr = getLocalDateString(new Date());
    if (date < todayStr) {
      triggerToast('error', 'Cannot select past dates.');
      return;
    }
    setBookingDate(date);
    setBookingSlot('');
    if (selectedDoctorId && date) {
      try {
        const branchParam = selectedBranchId ? `&branch_id=${selectedBranchId}` : '';
        const res = await api.get(
          `/appointments/available-slots?doctor_id=${selectedDoctorId}&date=${date}&consultation_type=${consultationType}${branchParam}`
        );
        setAvailableSlots(extractArrayData(res.data));
      } catch (err: any) {
        triggerToast('error', 'Failed to fetch doctor availability slots.');
      }
    }
  };

  const getDaysArray = (year: number, month: number) => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const todayStr = getLocalDateString(new Date());

    const prevMonthDays = new Date(year, month, 0).getDate();

    const days = [];

    for (let i = firstDay - 1; i >= 0; i--) {
      const pDay = prevMonthDays - i;
      const d = new Date(year, month - 1, pDay);
      const dateString = getLocalDateString(d);
      days.push({
        day: pDay,
        isCurrentMonth: false,
        isPast: dateString < todayStr,
        dateString
      });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const dateString = getLocalDateString(d);

      days.push({
        day: i,
        isCurrentMonth: true,
        isPast: dateString < todayStr,
        dateString
      });
    }

    const totalCells = days.length;
    const remainingCells = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= remainingCells; i++) {
      const d = new Date(year, month + 1, i);
      const dateString = getLocalDateString(d);
      days.push({
        day: i,
        isCurrentMonth: false,
        isPast: dateString < todayStr,
        dateString
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

  const handleRescheduleSubmit = async () => {
    if (!rescheduleApptId || !rescheduleDate || !rescheduleSlot) return;
    setIsLoading(true);
    try {
      const datetime = `${rescheduleDate}T${rescheduleSlot}:00`;
      await api.patch(`/appointments/${rescheduleApptId}/reschedule`, {
        new_datetime: datetime,
        consultation_type: rescheduleConsultationType
      });
      triggerToast('success', 'Appointment rescheduled successfully!');
      setRescheduleApptId(null);
      await fetchPortalData();
    } catch (err: any) {
      triggerToast('error', getErrorMessage(err, 'Failed to reschedule appointment.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelSubmit = async () => {
    if (!cancelApptId) return;
    if (!cancelReason || !cancelReason.trim()) {
      triggerToast('error', 'Cancellation reason is required.');
      return;
    }
    setIsLoading(true);
    try {
      await api.patch(`/appointments/${cancelApptId}/cancel`, { cancellation_reason: cancelReason.trim(), cancel_reason: cancelReason.trim() });
      triggerToast('success', 'Appointment cancelled successfully.');
      setCancelApptId(null);
      setCancelReason('');
      await fetchPortalData();
    } catch (err: any) {
      triggerToast('error', getErrorMessage(err, 'Failed to cancel appointment.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleBookingSubmit = async () => {
    if (!selectedDoctorId || !selectedBranchId || !bookingDate || !bookingSlot) {
      triggerToast('error', 'Please complete all required fields.');
      return;
    }

    setIsLoading(true);
    try {
      const datetimeStr = `${bookingDate}T${bookingSlot}:00`;
      const finalTreatment = treatmentType === 'Other (Custom Concern)' ? customTreatmentText : treatmentType;

      const payload: any = {
        doctor_id: selectedDoctorId,
        branch_id: selectedBranchId,
        appointment_datetime: datetimeStr,
        consultation_type: consultationType,
        treatment_type: finalTreatment || 'General Checkup',
        notes: bookingNotes || undefined
      };

      if (consultationType === 'teleconsultation') {
        if (bookingSymptoms) payload.symptoms = bookingSymptoms;
        if (attachedReportId) payload.report_id = attachedReportId;
      }

      await api.post('/appointments/', payload);
      triggerToast('success', 'Appointment scheduled successfully!');
      clearBookingWizardState();
      await fetchPortalData();
      setScreen('appointments');
    } catch (err: any) {
      const msg = getErrorMessage(err, 'Booking failed.');
      if (err.response?.status === 400 && msg.toLowerCase().includes('already have an active appointment')) {
        const activeDoctor = (Array.isArray(doctors) ? doctors : []).find((d: any) => d.id === selectedDoctorId);
        const existingAppts = dashboardData?.upcoming_appointments || [];
        const match = existingAppts.find((a: any) => a.doctor_id === selectedDoctorId) || {
          doctor: activeDoctor,
          doctor_id: selectedDoctorId,
          id: 'existing'
        };
        setConflictAppt(match);
      } else {
        triggerToast('error', msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleReportUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !uploadTitle) {
      triggerToast('error', 'Please provide a report title and select a valid file.');
      return;
    }

    const validation = validateMedicalFile(uploadFile);
    if (!validation.isValid) {
      triggerToast('error', validation.message);
      setUploadFile(null);
      return;
    }

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('title', uploadTitle);
      formData.append('report_type', uploadType);
      formData.append('file', uploadFile);

      await api.post('/patients/me/reports', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      triggerToast('success', 'Diagnostics report uploaded successfully!');
      setShowUploadModal(false);
      setUploadTitle('');
      setUploadFile(null);
      await fetchPortalData();
    } catch (err: any) {
      triggerToast('error', getErrorMessage(err, 'Report upload failed.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!window.confirm('Are you sure you want to delete this report?')) return;
    setIsLoading(true);
    try {
      await api.delete(`/patients/me/reports/${reportId}`);
      triggerToast('success', 'Report deleted.');
      await fetchPortalData();
    } catch (err: any) {
      triggerToast('error', getErrorMessage(err, 'Failed to delete report.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreferencesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await api.patch('/patients/me/preferences', preferences);
      triggerToast('success', 'Preferences updated successfully.');
    } catch (err: any) {
      triggerToast('error', getErrorMessage(err, 'Failed to update preferences.'));
    } finally {
      setIsLoading(false);
    }
  };

  const downloadPdf = async (url: string, filename: string) => {
    try {
      const response = await api.get(url, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = filename;
      link.click();
    } catch (err: any) {
      triggerToast('error', 'Failed to download PDF document.');
    }
  };

  const startEditingProfile = () => {
    let chronicDiseases = 'None';
    let highRiskFlags = 'None';
    let specialCondition = 'None';
    let disability = 'None';

    try {
      if (patientProfile?.chronic_conditions) {
        const parsed = JSON.parse(patientProfile.chronic_conditions);
        chronicDiseases = parsed.chronicDiseases || 'None';
        highRiskFlags = parsed.highRiskFlags || 'None';
        specialCondition = parsed.specialCondition || 'None';
        disability = parsed.disability || 'None';
      }
    } catch (e) {
      chronicDiseases = patientProfile?.chronic_conditions || 'None';
    }

    setProfileForm({
      phone: patientProfile?.user?.phone || '',
      emergency_contact_name: patientProfile?.emergency_contact_name || '',
      emergency_contact_phone: patientProfile?.emergency_contact_phone || '',
      medical_history: patientProfile?.medical_history || '',
      allergies: patientProfile?.allergies || '',
      insurance_provider: patientProfile?.insurance_provider || '',
      insurance_policy_no: patientProfile?.insurance_policy_no || '',
      address: patientProfile?.address || '',
      blood_group: patientProfile?.blood_group || '',
      date_of_birth: patientProfile?.date_of_birth ? patientProfile.date_of_birth.substring(0, 10) : '',
      height: patientProfile?.height || '',
      weight: patientProfile?.weight || '',
      chronic_diseases: chronicDiseases,
      high_risk_flags: highRiskFlags,
      special_condition: specialCondition,
      disability: disability,
    });
    setIsEditingProfile(true);
  };

  const handleSaveProfile = async () => {
    setIsLoading(true);
    try {
      const payload: any = {
        phone: profileForm.phone || undefined,
        height: profileForm.height || undefined,
        weight: profileForm.weight || undefined,
        emergency_contact_name: profileForm.emergency_contact_name || undefined,
        emergency_contact_phone: profileForm.emergency_contact_phone || undefined,
        address: profileForm.address || undefined,
      };

      const res = await api.patch('/patients/me', payload);
      setPatientProfile(res.data?.data || res.data);
      triggerToast('success', 'Personal contact details updated successfully!');
      setIsEditingProfile(false);
    } catch (err: any) {
      triggerToast('error', getErrorMessage(err, 'Failed to update contact details.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinMeeting = async (appointmentId: string) => {
    const upcoming = dashboardData?.upcoming_appointments || [];
    const today = dashboardData?.today_appointments || [];
    const past = dashboardData?.past_appointments || [];
    const appt = upcoming.find((a: any) => a.id === appointmentId) || 
                 today.find((a: any) => a.id === appointmentId) ||
                 past.find((a: any) => a.id === appointmentId) ||
                 (globalVideoAppt?.id === appointmentId ? globalVideoAppt : null);
                 
    const docName = appt?.doctor?.user?.full_name || appt?.doctor_name || globalVideoAppt?.doctor_name || 'Doctor';
    const spec = appt?.doctor?.specialization || appt?.specialty || globalVideoAppt?.specialty || 'Specialist';

    setGlobalVideoAppt({
      id: appointmentId,
      doctor_name: docName,
      specialty: spec
    });
    setIsGlobalVideoModalOpen(true);
    triggerToast('info', 'Launching in-app video consultation lobby.');
  };

  const safeDoctors = Array.isArray(doctors) ? doctors : [];
  const safeBranches = Array.isArray(branches) ? branches : [];

  // Filter doctors by selected clinic branch
  const branchDoctors = selectedBranchId
    ? safeDoctors.filter((doc: any) => doc.branch_id === selectedBranchId)
    : safeDoctors;

  const filteredAndSortedDoctors = branchDoctors.filter(doc => {
    const fullName = doc.user?.full_name?.toLowerCase() || '';
    const spec = (doc.specialization || doc.specialty || '').toLowerCase();
    const query = searchQuery.toLowerCase();

    if (query && !fullName.includes(query) && !spec.includes(query)) {
      return false;
    }
    if (filterSpecialty && doc.specialization !== filterSpecialty && doc.specialty !== filterSpecialty) {
      return false;
    }
    if (filterGender) {
      const inferredGender = (doc.user?.full_name?.includes('Sneha') || doc.user?.full_name?.includes('Anjali') || doc.user?.full_name?.includes('Desai')) ? 'Female' : 'Male';
      if (inferredGender !== filterGender) return false;
    }
    return true;
  }).sort((a, b) => {
    if (sortOption === 'fee_low') return (a.consultation_fee || 0) - (b.consultation_fee || 0);
    if (sortOption === 'fee_high') return (b.consultation_fee || 0) - (a.consultation_fee || 0);
    if (sortOption === 'rating_desc') return (b.rating || 0) - (a.rating || 0);
    return (b.experience_years || 0) - (a.experience_years || 0);
  });

  const renderSummarySidebar = () => {
    const selectedBranch = safeBranches.find((b: any) => b.id === selectedBranchId);
    const selectedDoctor = safeDoctors.find((d: any) => d.id === selectedDoctorId);
    const doctorName = selectedDoctor?.user?.full_name || '';
    const cleanDoctorName = doctorName.toLowerCase().startsWith('dr') ? doctorName : `Dr. ${doctorName}`;

    return (
      <div className="booking-summary-sidebar">
        <h4 className="booking-summary-title">Appointment Summary</h4>

        <div className="summary-sidebar-item">
          <div className="summary-sidebar-icon">📍</div>
          <div className="summary-sidebar-info">
            <span className="summary-sidebar-label">Clinic Branch</span>
            {selectedBranch ? (
              <span className="summary-sidebar-val">{selectedBranch.name} Branch</span>
            ) : (
              <span className="summary-sidebar-val empty">None Selected</span>
            )}
          </div>
        </div>

        <div className="summary-sidebar-item">
          <div className="summary-sidebar-icon">{consultationType === 'teleconsultation' ? '💻' : '🏥'}</div>
          <div className="summary-sidebar-info">
            <span className="summary-sidebar-label">Consultation Mode</span>
            <span className="summary-sidebar-val">
              {consultationType === 'teleconsultation' ? 'Tele Consultation' : 'In Clinic Visit'}
            </span>
          </div>
        </div>

        <div className="summary-sidebar-item">
          <div className="summary-sidebar-icon">👨‍⚕️</div>
          <div className="summary-sidebar-info">
            <span className="summary-sidebar-label">Clinician</span>
            {selectedDoctor ? (
              <>
                <span className="summary-sidebar-val">{cleanDoctorName}</span>
                <span className="summary-sidebar-val" style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                  {selectedDoctor.specialization || 'General Physician'}
                </span>
              </>
            ) : (
              <span className="summary-sidebar-val empty">None Selected</span>
            )}
          </div>
        </div>

        <div className="summary-sidebar-item">
          <div className="summary-sidebar-icon">📅</div>
          <div className="summary-sidebar-info">
            <span className="summary-sidebar-label">Date &amp; Time Slot</span>
            {bookingDate && bookingSlot ? (
              <>
                <span className="summary-sidebar-val">
                  {new Date(bookingDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <span className="summary-sidebar-val" style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                  🕐 {formatTimeToAMPM(bookingSlot)}
                </span>
              </>
            ) : (
              <span className="summary-sidebar-val empty">Not Selected</span>
            )}
          </div>
        </div>

        <div className="summary-fee-box">
          <div className="fee-row">
            <span>Consultation Fee:</span>
            <strong>₹{selectedDoctor ? selectedDoctor.consultation_fee : 0}</strong>
          </div>
        </div>
      </div>
    );
  };

  const checklist = [
    { id: 1, text: 'Stable Internet connection tested', completed: true },
    { id: 2, text: 'Good lighting on your face', completed: true },
    { id: 3, text: 'Recent X-ray uploaded (optional)', completed: true },
    { id: 4, text: 'List of current symptoms ready', completed: true },
  ];

  return (
    <div className="patient-portal">
      {toast && (
        <div className={`toast-notification ${toast.type}`}>
          {toast.type === 'success' ? '✓ ' : '⚠️ '}
          {toast.message}
        </div>
      )}

      {patientProfile && !patientProfile.is_profile_completed && profileChoice === 'wizard' ? (
        <ProfileCompletionWizard
          patientProfile={patientProfile}
          branches={branches}
          doctors={doctors}
          onComplete={() => {
            setProfileChoice('dashboard');
            sessionStorage.removeItem('patient_profile_flow');
            fetchPortalData();
          }}
          onLogout={onLogout}
          onSkip={handleSkipProfileToDashboard}
          triggerToast={triggerToast}
        />
      ) : (
        <>
          {/* Welcome Prompt Modal: When user has not made a choice yet */}
          {patientProfile && !patientProfile.is_profile_completed && profileChoice === 'prompt' && (
            <div style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.7)',
              backdropFilter: 'blur(6px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '20px',
            }}>
              <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '20px',
                maxWidth: '500px',
                width: '100%',
                padding: '34px 28px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)',
                textAlign: 'center',
                border: '1px solid #e2e8f0',
              }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '18px',
                  backgroundColor: '#e0f2fe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.9rem',
                  margin: '0 auto 16px',
                  boxShadow: '0 8px 16px rgba(14, 165, 233, 0.15)',
                }}>
                  🩺
                </div>

                <span style={{
                  display: 'inline-block',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.8px',
                  color: '#0284c7',
                  backgroundColor: '#f0f9ff',
                  padding: '3px 12px',
                  borderRadius: '999px',
                  marginBottom: '10px',
                  border: '1px solid #bae6fd'
                }}>
                  Vertical Clinic
                </span>

                <h2 style={{
                  fontSize: '1.4rem',
                  fontWeight: 800,
                  color: '#0f172a',
                  margin: '0 0 8px 0',
                }}>
                  Welcome, {patientProfile.user?.full_name || 'Patient'}!
                </h2>

                <p style={{
                  fontSize: '0.9rem',
                  color: '#475569',
                  lineHeight: 1.5,
                  margin: '0 0 20px 0'
                }}>
                  Would you like to complete your clinical health profile now?
                </p>

                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  textAlign: 'left',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '14px 16px',
                  marginBottom: '22px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>🛡️</span>
                    <span style={{ fontSize: '0.84rem', color: '#334155' }}>
                      <strong>Allergies & Alerts:</strong> Prevents harmful drug reactions.
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>⚡</span>
                    <span style={{ fontSize: '0.84rem', color: '#334155' }}>
                      <strong>Faster Consultation:</strong> Doctors have your history before visit.
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>🏥</span>
                    <span style={{ fontSize: '0.84rem', color: '#334155' }}>
                      <strong>Front-Desk Support:</strong> Receptionist can also assist during check-in.
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={handleOpenProfileWizard}
                    style={{
                      width: '100%',
                      padding: '12px 18px',
                      backgroundColor: '#0284c7',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '12px',
                      fontSize: '0.92rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)',
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#0369a1')}
                    onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#0284c7')}
                  >
                    Yes, Complete Profile →
                  </button>

                  <button
                    type="button"
                    onClick={handleSkipProfileToDashboard}
                    style={{
                      width: '100%',
                      padding: '11px 18px',
                      backgroundColor: '#ffffff',
                      color: '#475569',
                      border: '1.5px solid #cbd5e1',
                      borderRadius: '12px',
                      fontSize: '0.88rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = '#f8fafc';
                      e.currentTarget.style.borderColor = '#94a3b8';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = '#ffffff';
                      e.currentTarget.style.borderColor = '#cbd5e1';
                    }}
                  >
                    Skip for Now / Direct to Dashboard
                  </button>
                </div>
              </div>
            </div>
          )}

          <PatientSidebar
            screen={screen}
            setScreen={setScreen}
            clearBookingWizardState={clearBookingWizardState}
            isMobileSidebarOpen={isMobileSidebarOpen}
            setIsMobileSidebarOpen={setIsMobileSidebarOpen}
            onLogout={onLogout}
          />

          <main className="portal-main">
            <PatientHeader
              screen={screen}
              patientProfile={patientProfile}
              getInitials={getInitials}
              setIsMobileSidebarOpen={setIsMobileSidebarOpen}
              setScreen={setScreen}
              notifications={notifications}
              onMarkRead={handleMarkNotificationRead}
              onMarkAllRead={handleMarkAllNotificationsRead}
              onClearAll={handleClearAllNotifications}
              onLogout={onLogout}
            />

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

              {/* ── SCREEN: DASHBOARD ── */}
              {screen === 'dashboard' && dashboardData && (
                <DashboardTab
                  patientProfile={patientProfile}
                  dashboardData={dashboardData}
                  statistics={statistics}
                  setScreen={setScreen}
                  openBookingWizard={() => { setBookingStep(1); setScreen('book'); }}
                  openRescheduleModal={openRescheduleModal}
                  setCancelApptId={setCancelApptId}
                  setViewingAppointment={setViewingAppointment}
                  triggerToast={triggerToast}
                  followups={followups}
                  handleBookFollowup={handleBookFollowup}
                  onOpenProfileWizard={handleOpenProfileWizard}
                />
              )}

              {/* ── SCREEN: APPOINTMENTS ── */}
              {screen === 'appointments' && dashboardData && (
                <AppointmentsTab
                  dashboardData={dashboardData}
                  appointmentFilter={appointmentFilter}
                  setAppointmentFilter={setAppointmentFilter}
                  appointmentDateFilter={appointmentDateFilter}
                  setAppointmentDateFilter={setAppointmentDateFilter}
                  setScreen={setScreen}
                  setBookingStep={setBookingStep}
                  openRescheduleModal={openRescheduleModal}
                  setCancelApptId={setCancelApptId}
                  handleJoinMeeting={handleJoinMeeting}
                  setViewingAppointment={setViewingAppointment}
                  triggerToast={triggerToast}
                  onRefresh={fetchPortalData}
                />
              )}

              {/* ── SCREEN: BOOKING WIZARD ── */}
              {screen === 'book' && (
                <BookingWizard
                  bookingStep={bookingStep}
                  setBookingStep={setBookingStep}
                  branches={branches}
                  selectedBranchId={selectedBranchId}
                  handleBranchSelect={handleBranchSelect}
                  consultationType={consultationType}
                  setConsultationType={setConsultationType}
                  doctors={branchDoctors}
                  selectedDoctorId={selectedDoctorId}
                  handleDoctorSelect={handleDoctorSelect}
                  filterSpecialty={filterSpecialty}
                  setFilterSpecialty={setFilterSpecialty}
                  filterExperience={filterExperience}
                  setFilterExperience={setFilterExperience}
                  filterGender={filterGender}
                  setFilterGender={setFilterGender}
                  filterLanguage={filterLanguage}
                  setFilterLanguage={setFilterLanguage}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  sortOption={sortOption}
                  setSortOption={setSortOption}
                  filteredAndSortedDoctors={filteredAndSortedDoctors}
                  renderSummarySidebar={renderSummarySidebar}
                  bookingDate={bookingDate}
                  bookingSlot={bookingSlot}
                  setBookingSlot={setBookingSlot}
                  handleDateChange={handleDateChange}
                  calendarViewMonth={calendarViewMonth}
                  setCalendarViewMonth={setCalendarViewMonth}
                  calendarViewYear={calendarViewYear}
                  setCalendarViewYear={setCalendarViewYear}
                  handlePrevMonth={handlePrevMonth}
                  handleNextMonth={handleNextMonth}
                  getDaysArray={getDaysArray}
                  MONTH_NAMES={MONTH_NAMES}
                  formatTimeToAMPM={formatTimeToAMPM}
                  availableSlots={availableSlots}
                  patientProfile={patientProfile}
                  treatmentType={treatmentType}
                  setTreatmentType={setTreatmentType}
                  customTreatmentText={customTreatmentText}
                  setCustomTreatmentText={setCustomTreatmentText}
                  bookingSymptoms={bookingSymptoms}
                  setBookingSymptoms={setBookingSymptoms}
                  attachedReportId={attachedReportId}
                  setAttachedReportId={setAttachedReportId}
                  dashboardData={dashboardData}
                  bookingNotes={bookingNotes}
                  setBookingNotes={setBookingNotes}
                  clearBookingWizardState={clearBookingWizardState}
                  setScreen={setScreen}
                  setShowBookingConfirm={setShowBookingConfirm}
                  isLoading={isLoading}
                />
              )}

              {/* ── SCREEN: PRESCRIPTIONS ── */}
              {screen === 'prescriptions' && dashboardData && (
                <PrescriptionsTab
                  dashboardData={dashboardData}
                  timeline={timeline}
                  setViewingPrescription={setViewingPrescription}
                  downloadPdf={downloadPdf}
                />
              )}

              {/* ── SCREEN: BILLING ── */}
              {screen === 'billing' && dashboardData && (
                <BillingTab
                  dashboardData={dashboardData}
                  setViewingInvoice={setViewingInvoice}
                  downloadPdf={downloadPdf}
                />
              )}

              {/* ── SCREEN: REPORTS ── */}
              {screen === 'reports' && dashboardData && (
                <ReportsTab
                  dashboardData={dashboardData}
                  setShowUploadModal={setShowUploadModal}
                  setViewingReport={setViewingReport}
                  setImageZoom={setImageZoom}
                  setImageRotate={setImageRotate}
                  handleDeleteReport={handleDeleteReport}
                  downloadPdf={downloadPdf}
                />
              )}

              {/* ── SCREEN: MEDICAL HISTORY TIMELINE ── */}
              {screen === 'timeline' && (
                <TimelineTab
                  timeline={timeline}
                  dashboardData={dashboardData}
                  followups={followups}
                  handleBookFollowup={handleBookFollowup}
                  setViewingHistoryEvent={setViewingHistoryEvent}
                  setViewingInvoice={setViewingInvoice}
                  setViewingReport={setViewingReport}
                />
              )}

              {/* ── SCREEN: PROFILE ── */}
              {screen === 'profile' && patientProfile && (
                <ProfileTab
                  patientProfile={patientProfile}
                  isEditingProfile={isEditingProfile}
                  setIsEditingProfile={setIsEditingProfile}
                  profileForm={profileForm}
                  setProfileForm={setProfileForm}
                  startEditingProfile={startEditingProfile}
                  handleSaveProfile={handleSaveProfile}
                  getInitials={getInitials}
                  onOpenProfileWizard={handleOpenProfileWizard}
                />
              )}

              {/* ── SCREEN: TELECONSULTATION ── */}
              {screen === 'teleconsultation' && (
                <TeleconsultationTab
                  activeTele={
                    dashboardData?.today_appointments?.find((a: any) => a.consultation_type === 'teleconsultation') ||
                    dashboardData?.upcoming_appointments?.find((a: any) => a.consultation_type === 'teleconsultation')
                  }
                  pastTeles={(dashboardData?.past_appointments || []).filter((a: any) => a.consultation_type === 'teleconsultation')}
                  selectedTeleId={selectedTeleId}
                  setSelectedTeleId={setSelectedTeleId}
                  checklist={checklist}
                  handleJoinMeeting={handleJoinMeeting}
                  triggerToast={triggerToast}
                  setScreen={setScreen}
                />
              )}

              {/* ── SCREEN: PREFERENCES ── */}
              {screen === 'preferences' && (
                <PreferencesTab
                  preferences={preferences}
                  setPreferences={setPreferences}
                  handlePreferencesSubmit={handlePreferencesSubmit}
                />
              )}
            </div>
          </main>

          {/* Modals orchestrator */}
          <PatientModals
            rescheduleApptId={rescheduleApptId}
            setRescheduleApptId={setRescheduleApptId}
            rescheduleDate={rescheduleDate}
            rescheduleSlot={rescheduleSlot}
            rescheduleSlots={rescheduleSlots}
            handleRescheduleDateSelect={handleRescheduleDateSelect}
            setRescheduleSlot={setRescheduleSlot}
            handleRescheduleSubmit={handleRescheduleSubmit}
            formatTimeToAMPM={formatTimeToAMPM}
            cancelApptId={cancelApptId}
            setCancelApptId={setCancelApptId}
            rescheduleConsultationType={rescheduleConsultationType}
            cancelReason={cancelReason}
            setCancelReason={setCancelReason}
            handleCancelSubmit={handleCancelSubmit}
            viewingPrescription={viewingPrescription}
            setViewingPrescription={setViewingPrescription}
            downloadPdf={downloadPdf}
            showBookingConfirm={showBookingConfirm}
            setShowBookingConfirm={setShowBookingConfirm}
            selectedBranchId={selectedBranchId}
            selectedDoctorId={selectedDoctorId}
            branches={branches}
            doctors={doctors}
            bookingDate={bookingDate}
            bookingSlot={bookingSlot}
            consultationType={consultationType}
            treatmentType={treatmentType}
            customTreatmentText={customTreatmentText}
            bookingNotes={bookingNotes}
            isLoading={isLoading}
            handleBookingSubmit={handleBookingSubmit}
            showUploadModal={showUploadModal}
            setShowUploadModal={setShowUploadModal}
            uploadTitle={uploadTitle}
            setUploadTitle={setUploadTitle}
            uploadType={uploadType}
            setUploadType={setUploadType}
            setUploadFile={setUploadFile}
            handleReportUpload={handleReportUpload}
            viewingReport={viewingReport}
            setViewingReport={setViewingReport}
            isImageFile={isImageFile}
            imageZoom={imageZoom}
            setImageZoom={setImageZoom}
            imageRotate={imageRotate}
            setImageRotate={setImageRotate}
            viewingAppointment={viewingAppointment}
            setViewingAppointment={setViewingAppointment}
            handleJoinMeeting={handleJoinMeeting}
            viewingHistoryEvent={viewingHistoryEvent}
            setViewingHistoryEvent={setViewingHistoryEvent}
            timeline={timeline}
            dashboardData={dashboardData}
            setViewingInvoice={setViewingInvoice}
            triggerToast={triggerToast}
            viewingInvoice={viewingInvoice}
            patientProfile={patientProfile}
            conflictAppt={conflictAppt}
            setConflictAppt={setConflictAppt}
            setScreen={setScreen}
            openRescheduleModal={openRescheduleModal}
          />

          {/* Top Banner Alert when Doctor is Ready early */}
          {doctorReadyNotification && dismissedNotificationApptId !== doctorReadyNotification.appointmentId && (
            <div style={{
              position: 'fixed',
              top: '20px',
              right: '20px',
              zIndex: 9999,
              background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
              color: 'white',
              padding: '16px 20px',
              borderRadius: '12px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              border: '1px solid #059669',
              animation: 'slideIn 0.3s ease-out'
            }}>
              <style>{`
                @keyframes slideIn {
                  from { transform: translateY(-20px); opacity: 0; }
                  to { transform: translateY(0); opacity: 1; }
                }
              `}</style>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#a7f3d0' }}>
                  Doctor is Ready!
                </span>
                <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                  Dr. {doctorReadyNotification.doctorName} is ready to start your consultation.
                </span>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => {
                    handleJoinMeeting(doctorReadyNotification.appointmentId);
                    setDoctorReadyNotification(null);
                  }}
                  style={{
                    background: 'white',
                    color: '#059669',
                    border: 'none',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Join Call
                </button>
                <button
                  onClick={() => setDismissedNotificationApptId(doctorReadyNotification.appointmentId)}
                  style={{
                    background: 'transparent',
                    color: 'white',
                    border: 'none',
                    padding: '6px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Dismiss"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Global Jitsi Video Modal */}
          {isGlobalVideoModalOpen && globalVideoAppt && (
            <JitsiVideoModal
              appointmentId={globalVideoAppt.id}
              doctorName={globalVideoAppt.doctor?.user?.full_name || globalVideoAppt.doctor_name || 'your doctor'}
              specialty={globalVideoAppt.doctor?.specialization || globalVideoAppt.specialty || ''}
              patientName={patientProfile?.user?.full_name || 'Patient'}
              isDoctor={false}
              onClose={() => setIsGlobalVideoModalOpen(false)}
            />
          )}
        </>
      )}
    </div>
  );
};

export default PatientPortal;
