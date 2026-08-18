import React, { useState, useEffect, useRef } from 'react';
import { 
  Home, 
  Users, 
  Video, 
  FileText, 
  Clock, 
  Search,
  Plus, 
  Trash2,
  Mic,
  MicOff,
  Stethoscope,
  Settings,
  Calendar,
  Bell,
  CheckCircle,
  List,
  Activity,
  Sparkles,
  FolderOpen,
  X,
  ChevronRight,
  Heart,
  Camera,
  FileSpreadsheet,
  AlertTriangle,
  ArrowLeft,
  LogOut,
  User,
  Edit3,
  Bed,
  Eye,
  RefreshCw,
  Download
} from 'lucide-react';
import { api, getWebSocketUrl } from '../../services/api';
import { JitsiMeeting } from '@jitsi/react-sdk';
import './DoctorPortal.css';

interface DoctorPortalProps {
  onLogout: () => void;
}

interface PrescriptionItemInput {
  medicine_name: string;
  dosage: string;
  duration: string;
  instructions: string;
}

interface Leave {
  start_date: string;
  end_date: string;
  reason: string;
}



const formatBedNumber = (bedNum: string): string => {
  if (!bedNum) return '';
  const hasAlphaPrefix = /^[a-zA-Z]/.test(bedNum);
  return hasAlphaPrefix ? bedNum : `Bed ${bedNum}`;
};

const formatDocName = (name?: string): string => {
  if (!name) return '';
  const trimmed = name.trim();
  if (/^dr\.?\s+/i.test(trimmed)) {
    return trimmed;
  }
  return `Dr. ${trimmed}`;
};

const CLINICAL_SCENARIOS: Record<string, { notes: string; aiSummary: string; suggestedMeds: any[]; suggestedTreatment: string }> = {
  braces: {
    notes: "Patient reports mild discomfort in upper-right molar area. Requesting routine braces adjustment.",
    aiSummary: "Summary: Patient presents for scheduled orthodontic adjustment. No signs of infection or swelling. Wire tension increased on upper arch; lower arch elastics replaced. Mild sensitivity reported on tooth #14, recommend monitoring.\n\nSuggested next step: Continue 2-week adjustment cycle. Consider fluoride varnish if sensitivity persists.",
    suggestedMeds: [{ medicine_name: 'Paracetamol 650mg', dosage: '1 tab if pain', duration: '3 days', instructions: 'Take twice a day' }],
    suggestedTreatment: "Braces Adjustment"
  },
  root_canal: {
    notes: "Patient complains of severe throbbing pain in the lower left molar for 3 days, sensitive to hot and cold liquids, swelling in gums.",
    aiSummary: "Summary: Patient presents with severe acute pulpitis in tooth #19 (lower left first molar) persisting for 3 days. Marked hypersensitivity to thermal stimuli and mild localized gingival inflammation. Recommend initiating root canal therapy.\n\nSuggested next step: Root canal preparation and pulp extirpation. Follow up in 1 week.",
    suggestedMeds: [
      { medicine_name: 'Amoxicillin 500mg', dosage: '1-1-1', duration: '5 days', instructions: 'Take after meals' },
      { medicine_name: 'Ibuprofen 400mg', dosage: '1-0-1', duration: '3 days', instructions: 'Take if pain persists' }
    ],
    suggestedTreatment: "Root Canal Therapy"
  },
  extraction: {
    notes: "Patient complains of pressure and pain in the back of the mouth, lower jaw. Localized swelling, third molar impacted.",
    aiSummary: "Summary: Clinical exam reveals partially erupted and mesioangularly impacted lower left third molar (tooth #17) causing pressure, local pain, and pericoronitis. Recommend surgical extraction.\n\nSuggested next step: Schedule surgical extraction. Advise cold compress and soft diet post-op.",
    suggestedMeds: [
      { medicine_name: 'Diclofenac 50mg', dosage: '1-0-1', duration: '3 days', instructions: 'Take after food' },
      { medicine_name: 'Chlorhexidine Mouthwash 100ml', dosage: 'Rinse twice a day', duration: '7 days', instructions: 'Use after brushing' }
    ],
    suggestedTreatment: "Tooth Extraction"
  },
  scaling: {
    notes: "Patient complains of bleeding gums while brushing and yellow tartar buildup.",
    aiSummary: "Summary: Patient presents with generalized mild gingivitis. Visible supra- and subgingival calculus buildup on mandibular anterior teeth. Moderate bleeding on probing. Recommend full mouth scaling and polishing.\n\nSuggested next step: Full mouth scaling and oral hygiene counseling. Review brushing technique.",
    suggestedMeds: [
      { medicine_name: 'Chlorhexidine Mouthwash 100ml', dosage: 'Rinse twice a day', duration: '10 days', instructions: 'Use after food' }
    ],
    suggestedTreatment: "Scaling & Polishing"
  }
};

export const DoctorPortal: React.FC<DoctorPortalProps> = ({ onLogout }) => {
  const [activeTab, setActiveTabInternal] = useState<string>(() => localStorage.getItem('doctor_portal_tab') || 'dashboard');
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
    localStorage.setItem('doctor_portal_tab', newTab);
  };

  const goBackTab = () => {
    if (tabHistory.length === 0) return;
    const prevTab = tabHistory[tabHistory.length - 1];
    setTabHistory(prev => prev.slice(0, -1));
    setActiveTabInternal(prevTab);
    localStorage.setItem('doctor_portal_tab', prevTab);
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
    localStorage.setItem('doctor_portal_tab', activeTab);
  }, [activeTab]);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  // Local Queue Search & Global EMR Search
  const [queueSearch, setQueueSearch] = useState<string>('');
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>('');
  const [globalSearchResults, setGlobalSearchResults] = useState<any[]>([]);
  const [isGlobalSearchDropdownOpen, setIsGlobalSearchDropdownOpen] = useState(false);
  const [emrLookupPatient, setEmrLookupPatient] = useState<any>(null);
  const [loadingEmrHistory, setLoadingEmrHistory] = useState<boolean>(false);
  const globalSearchRef = useRef<HTMLDivElement>(null);

  const handleGlobalSearch = async (query: string) => {
    setGlobalSearchQuery(query);
    if (!query.trim()) {
      setGlobalSearchResults([]);
      setIsGlobalSearchDropdownOpen(false);
      return;
    }
    try {
      const res = await api.get(`/patients/?search=${query}`);
      if (res.data && res.data.success) {
        setGlobalSearchResults(res.data.data.items || []);
        setIsGlobalSearchDropdownOpen(true);
      }
    } catch (err) {
      console.error('Error in global search:', err);
    }
  };

  const handleSelectEmrPatient = async (patient: any) => {
    setIsGlobalSearchDropdownOpen(false);
    setGlobalSearchQuery('');
    setLoadingEmrHistory(true);
    setEmrLookupPatient({ patient });
    try {
      const consRes = await api.get(`/consultations/?patient_id=${patient.id}`);
      const prescRes = await api.get(`/prescriptions/?patient_id=${patient.id}`);
      const reportsRes = await api.get(`/medical-reports/patient/${patient.id}`);
      setEmrLookupPatient({
        patient,
        consultations: consRes.data?.data?.items || [],
        prescriptions: prescRes.data?.data?.items || [],
        reports: reportsRes.data?.data || []
      });
    } catch (err) {
      console.error('Error fetching EMR lookup patient history:', err);
    } finally {
      setLoadingEmrHistory(false);
    }
  };

  // Search Patients state
  const [patientSearch, setPatientSearch] = useState<string>('');
  const [patientsList, setPatientsList] = useState<any[]>([]);
  const [selectedPatientHistory, setSelectedPatientHistory] = useState<any>(null);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  // Medical report preview and download state
  const [viewingReport, setViewingReport] = useState<any>(null);
  const [reportFileUrl, setReportFileUrl] = useState<string>('');
  const [loadingReportFile, setLoadingReportFile] = useState<boolean>(false);
  const [reportError, setReportError] = useState<string>('');
  const [reportContentType, setReportContentType] = useState<string>('');
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!viewingReport || !viewingReport.file_url) {
      setBlobUrl(null);
      setReportError('');
      return;
    }

    const isPdf = viewingReport.file_url.toLowerCase().includes('.pdf') || viewingReport.file_url.toLowerCase().includes('/raw/');
    if (!isPdf) {
      setBlobUrl(null);
      setReportError('');
      return;
    }

    let active = true;
    const url = viewingReport.file_url.startsWith('http') 
      ? viewingReport.file_url 
      : `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${viewingReport.file_url}`;
    
    setLoadingReportFile(true);
    setReportError('');

    fetch(url)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.blob();
      })
      .then((blob) => {
        if (active) {
          const pdfBlob = new Blob([blob], { type: 'application/pdf' });
          const objectUrl = URL.createObjectURL(pdfBlob);
          setBlobUrl(objectUrl);
        }
      })
      .catch((err) => {
        if (active) {
          console.error("Failed to fetch PDF blob:", err);
          setReportError(err.message || "Failed to load PDF");
        }
      })
      .finally(() => {
        if (active) {
          setLoadingReportFile(false);
        }
      });

    return () => {
      active = false;
      setBlobUrl((prev) => {
        if (prev) {
          URL.revokeObjectURL(prev);
        }
        return null;
      });
    };
  }, [viewingReport]);

  // Consultation Form state
  const [activeAppt, setActiveAppt] = useState<any>(null);
  const [activePatientDetails, setActivePatientDetails] = useState<any>(null);
  const [loadingPatientDetails, setLoadingPatientDetails] = useState<boolean>(false);
  const [symptoms, setSymptoms] = useState<string>('');
  const [diagnosis, setDiagnosis] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [vitalsBp, setVitalsBp] = useState<string>('120/80');
  const [vitalsPulse, setVitalsPulse] = useState<number>(72);
  const [vitalsTemp, setVitalsTemp] = useState<number>(98.6);
  const [vitalsHeight, setVitalsHeight] = useState<string>('172');
  const [followupAdvised, setFollowupAdvised] = useState<boolean>(false);
  const [followupAfterDays, setFollowupAfterDays] = useState<number>(7);

  // IPD Admission Advised States
  const [ipdAdvised, setIpdAdvised] = useState<boolean>(false);
  const [ipdPreferredCategory, setIpdPreferredCategory] = useState<string>('');
  const [ipdReason, setIpdReason] = useState<string>('');
  const [ipdUrgency, setIpdUrgency] = useState<string>('routine');
  const [vitalsWeight, setVitalsWeight] = useState<string>('74');
  const [vitalsSpo2, setVitalsSpo2] = useState<number>(98);
  const [calculatedBmiInfo, setCalculatedBmiInfo] = useState<{ bmi: string; label: string; color: string }>({ bmi: '25.0', label: 'Normal', color: '#16a34a' });
  const [patientWorkspaceTab, setPatientWorkspaceTab] = useState<'history' | 'reports' | 'treatment' | 'timeline' | 'vitals' | 'prescriptions' | 'imaging' | null>(null);
  const [activeQuickDrawer, setActiveQuickDrawer] = useState<'history' | 'reports' | 'prescriptions' | null>(null);
  const [showClinicalProfileModal, setShowClinicalProfileModal] = useState<boolean>(false);
  const [profileModalTab, setProfileModalTab] = useState<'alerts' | 'vitals' | 'treatment' | 'demographics'>('alerts');
  const [prescriptionItems, setPrescriptionItems] = useState<PrescriptionItemInput[]>([]);
  const [savingConsultation, setSavingConsultation] = useState<boolean>(false);

  // Doctor Profile state
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState<boolean>(false);
  const [profileForm, setProfileForm] = useState<any>({
    full_name: '',
    phone: '',
    avatar_url: '',
    specialization: '',
    qualification: '',
    experience_years: 0,
    consultation_fee: 0.0,
    bio: '',
    registration_number: ''
  });

  useEffect(() => {
    if (dashboardData?.doctor) {
      const doc = dashboardData.doctor;
      setProfileForm({
        full_name: doc.full_name || '',
        phone: doc.phone || '',
        avatar_url: doc.avatar_url || '',
        specialization: doc.specialization || '',
        qualification: doc.qualification || '',
        experience_years: doc.experience_years || 0,
        consultation_fee: doc.consultation_fee || 0.0,
        bio: doc.bio || '',
        registration_number: doc.registration_number || ''
      });
    }
  }, [dashboardData]);

  // Groq Whisper & Allergy Safety States
  const [isRecordingAudio, setIsRecordingAudio] = useState<boolean>(false);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [allergyWarnings, setAllergyWarnings] = useState<string[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  const handleSaveDoctorProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileForm.full_name?.trim()) {
      showToast('Name is required.', 'error');
      return;
    }
    try {
      // 1. Update user fields
      await api.patch('/auth/profile', {
        full_name: profileForm.full_name,
        phone: profileForm.phone,
        avatar_url: profileForm.avatar_url
      });

      // 2. Update doctor professional fields
      await api.put(`/doctors/${dashboardData.doctor.id}`, {
        specialization: profileForm.specialization,
        qualification: profileForm.qualification,
        experience_years: Number(profileForm.experience_years),
        consultation_fee: Number(profileForm.consultation_fee),
        bio: profileForm.bio,
        registration_number: profileForm.registration_number
      });

      showToast('Profile updated successfully!', 'success');
      setIsEditingProfile(false);
      fetchDashboard();
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed to update profile details.';
      showToast(errorMsg, 'error');
    }
  };



  const parseMedicalAlerts = (patientDetails: any) => {
    let chronicDiseases = 'None';
    let highRiskFlags = 'Hypertension';
    let specialCondition = 'None';
    let disability = 'None';

    if (patientDetails?.chronic_conditions) {
      try {
        const parsed = typeof patientDetails.chronic_conditions === 'string'
          ? JSON.parse(patientDetails.chronic_conditions)
          : patientDetails.chronic_conditions;

        if (parsed && typeof parsed === 'object') {
          if (parsed.chronicDiseases && parsed.chronicDiseases !== 'none') chronicDiseases = parsed.chronicDiseases;
          else if (parsed.chronicDiseases === 'none') chronicDiseases = 'None';

          if (parsed.highRiskFlags && parsed.highRiskFlags !== 'none') highRiskFlags = parsed.highRiskFlags;
          else if (parsed.highRiskFlags === 'none') highRiskFlags = 'None';

          if (parsed.specialCondition && parsed.specialCondition !== 'none') specialCondition = parsed.specialCondition;
          else if (parsed.specialCondition === 'none') specialCondition = 'None';

          if (parsed.disability && parsed.disability !== 'none') disability = parsed.disability;
          else if (parsed.disability === 'none') disability = 'None';
        } else {
          chronicDiseases = String(patientDetails.chronic_conditions);
        }
      } catch (e) {
        chronicDiseases = String(patientDetails.chronic_conditions);
      }
    }

    return {
      allergies: patientDetails?.allergies || 'None',
      chronicDiseases,
      highRiskFlags,
      specialCondition,
      disability
    };
  };

  const calculateAge = (dobString?: string): string => {
    if (!dobString) return '32 Years';
    try {
      const birthDate = new Date(dobString);
      const ageDifMs = Date.now() - birthDate.getTime();
      const ageDate = new Date(ageDifMs);
      const age = Math.abs(ageDate.getUTCFullYear() - 1970);
      return `${age} Years`;
    } catch (e) {
      return '32 Years';
    }
  };

  const calculateBMI = (hStr: string, wStr: string): { bmi: string; label: string; color: string } => {
    const h = parseFloat(hStr);
    const w = parseFloat(wStr);
    if (!h || !w || h <= 0 || w <= 0) {
      return { bmi: '25.0', label: 'Normal', color: '#16a34a' };
    }
    const hMeters = h / 100;
    const bmiVal = (w / (hMeters * hMeters)).toFixed(1);
    const valNum = parseFloat(bmiVal);
    let label = 'Normal';
    let color = '#16a34a';
    if (valNum < 18.5) {
      label = 'Underweight';
      color = '#eab308';
    } else if (valNum >= 25 && valNum < 30) {
      label = 'Overweight';
      color = '#f97316';
    } else if (valNum >= 30) {
      label = 'Obese';
      color = '#dc2626';
    }
    return { bmi: bmiVal, label, color };
  };

  // Video call state & Incoming call ringing listener
  const [inVideoCall, setInVideoCall] = useState<boolean>(false);
  const [videoPatientName, setVideoPatientName] = useState<string>('');
  const [videoApptId, setVideoApptId] = useState<string>('');
  const [videoRoomName, setVideoRoomName] = useState<string>('');
  const [incomingCall, setIncomingCall] = useState<any>(null);

  useEffect(() => {
    const checkIncoming = async () => {
      try {
        const res = await api.get('/teleconsultations/check-incoming-call');
        if (res.data && res.data.success && res.data.data?.has_incoming_call) {
          const callData = res.data.data;
          if (!inVideoCall && (!incomingCall || incomingCall.appointment_id !== callData.appointment_id)) {
            setIncomingCall(callData);
          }
        }
      } catch (err) {
        // silent check
      }
    };
    checkIncoming();
    const interval = setInterval(checkIncoming, 3000);
    return () => clearInterval(interval);
  }, [inVideoCall, incomingCall]);

  const handleAcceptIncomingCall = async () => {
    if (!incomingCall) return;
    try {
      await api.post(`/teleconsultations/${incomingCall.appointment_id}/accept-call`);
      setVideoRoomName(incomingCall.room_name);
      setVideoPatientName(incomingCall.caller_name || incomingCall.patient_name || 'Patient');
      setVideoApptId(incomingCall.appointment_id);
      setInVideoCall(true);
    } catch (e) {
      console.error(e);
    } finally {
      setIncomingCall(null);
    }
  };

  const handleDeclineIncomingCall = async () => {
    if (!incomingCall) return;
    try {
      await api.post(`/teleconsultations/${incomingCall.appointment_id}/decline-call`);
    } catch (e) {
      console.error(e);
    } finally {
      setIncomingCall(null);
    }
  };




  const [lunchStart, setLunchStart] = useState<string>('13:00');
  const [lunchEnd, setLunchEnd] = useState<string>('14:00');
  const [teleStart, setTeleStart] = useState<string>('15:00');
  const [teleEnd, setTeleEnd] = useState<string>('17:00');
  const [shiftStart, setShiftStart] = useState<string>('09:00');
  const [shiftEnd, setShiftEnd] = useState<string>('21:00');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [leavesList, setLeavesList] = useState<Leave[]>([]);
  // Availability Change Requests
  const [isRequestingChange, setIsRequestingChange] = useState<boolean>(false);
  const [requestType, setRequestType] = useState<string>('lunch_break');
  const [reqStartTime, setReqStartTime] = useState<string>('13:00');
  const [reqEndTime, setReqEndTime] = useState<string>('14:00');
  const [reqStartDate, setReqStartDate] = useState<string>('');
  const [reqEndDate, setReqEndDate] = useState<string>('');
  const [reqReason, setReqReason] = useState<string>('');
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [submittingRequest, setSubmittingRequest] = useState<boolean>(false);

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
      const payload: any = {
        request_type: requestType,
        reason: reqReason.trim()
      };
      if (requestType === 'leave') {
        payload.proposed_start_date = reqStartDate;
        payload.proposed_end_date = reqEndDate;
      } else {
        payload.proposed_start_time = reqStartTime;
        payload.proposed_end_time = reqEndTime;
      }

      const res = await api.post('/doctors/availability-requests/', payload);
      if (res.data?.success) {
        showToast('Availability change request submitted successfully!', 'success');
        setIsRequestingChange(false);
        setReqReason('');
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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setIsUploadingAvatar(true);
      showToast('Uploading profile picture...', 'info');
      const res = await api.post('/users/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data?.success) {
        const newAvatarUrl = res.data?.data?.avatar_url;
        showToast('Profile picture uploaded successfully!', 'success');
        if (newAvatarUrl) {
          setProfileForm((prev: any) => ({ ...prev, avatar_url: newAvatarUrl }));
        }
        fetchDashboard();
      }
    } catch (err: any) {
      console.error("Avatar upload failed", err);
      showToast(err.response?.data?.message || 'Failed to upload photo.', 'error');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      setIsUploadingAvatar(true);
      showToast('Removing profile picture...', 'info');
      const res = await api.delete('/users/me/avatar');
      if (res.data?.success) {
        showToast('Profile picture removed.', 'success');
        setProfileForm((prev: any) => ({ ...prev, avatar_url: '' }));
        fetchDashboard();
      }
    } catch (err: any) {
      console.error("Failed to remove avatar", err);
      showToast(err.response?.data?.message || 'Failed to remove photo.', 'error');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Weekly slots configs state
  interface WeekdaySlotConfig {
    weekday: number;
    is_active: boolean;
    start_time: string;
    end_time: string;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [weeklySlots, setWeeklySlots] = useState<WeekdaySlotConfig[]>([
    { weekday: 0, is_active: true, start_time: '09:00', end_time: '17:00' }, // Mon
    { weekday: 1, is_active: true, start_time: '09:00', end_time: '17:00' }, // Tue
    { weekday: 2, is_active: true, start_time: '09:00', end_time: '17:00' }, // Wed
    { weekday: 3, is_active: true, start_time: '09:00', end_time: '17:00' }, // Thu
    { weekday: 4, is_active: true, start_time: '09:00', end_time: '17:00' }, // Fri
    { weekday: 5, is_active: true, start_time: '09:00', end_time: '17:00' }, // Sat
    { weekday: 6, is_active: false, start_time: '09:00', end_time: '17:00' }, // Sun
  ]);

  // Voice dictation & AI states
  const [selectedScenario, setSelectedScenario] = useState<string>('');
  const [, setIsListening] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [aiSummary, setAiSummary] = useState<any>(null);
  const [isEditingSummary, setIsEditingSummary] = useState<boolean>(false);
  const [editedSummaryText, setEditedSummaryText] = useState<string>('');
  const [suggestedMeds, setSuggestedMeds] = useState<any[]>([]);
  const [suggestedTreatment, setSuggestedTreatment] = useState<string>('');
  const [suggestedTreatmentNotes, setSuggestedTreatmentNotes] = useState<string>('');
  const [approved, setApproved] = useState<boolean>(false);

  // Prescriptions Tab states
  const [allPrescriptions, setAllPrescriptions] = useState<any[]>([]);
  const [selectedPrescription, setSelectedPrescription] = useState<any>(null);
  const [prescriptionSearch, setPrescriptionSearch] = useState<string>('');
  const [loadingPrescriptions, setLoadingPrescriptions] = useState<boolean>(false);
  const [isEditPrescriptionModalOpen, setIsEditPrescriptionModalOpen] = useState<boolean>(false);
  const [editingPrescriptionId, setEditingPrescriptionId] = useState<string | null>(null);
  const [editingPrescriptionNotes, setEditingPrescriptionNotes] = useState<string>('');
  const [editingPrescriptionItems, setEditingPrescriptionItems] = useState<any[]>([]);
  const [savingEditPrescription, setSavingEditPrescription] = useState<boolean>(false);

  // Treatment Plans Tab states
  const [allPatients, setAllPatients] = useState<any[]>([]);
  const [treatmentPatientId, setTreatmentPatientId] = useState<string>('');
  const [activePlan, setActivePlan] = useState<any>(null);
  const [loadingPlan, setLoadingPlan] = useState<boolean>(false);
  const [newProcName, setNewProcName] = useState<string>('');
  const [newProcCost, setNewProcCost] = useState<number>(0);
  const [newProcNotes, setNewProcNotes] = useState<string>('');
  const [savingProcedure, setSavingProcedure] = useState<boolean>(false);

  // Follow-up states
  const [pendingFollowups, setPendingFollowups] = useState<any[]>([]);
  const [bookedFollowups, setBookedFollowups] = useState<any[]>([]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch Dashboard
  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await api.get('/doctors/me/dashboard');
      if (res.data && res.data.success) {
        const data = res.data.data;
        setDashboardData(data);
        
        // Load existing availability settings from metadata
        if (data.doctor && data.doctor.availability_metadata) {
          try {
            const meta = JSON.parse(data.doctor.availability_metadata);
            if (meta.lunch_start) setLunchStart(meta.lunch_start);
            if (meta.lunch_end) setLunchEnd(meta.lunch_end);
            if (meta.tele_start) setTeleStart(meta.tele_start);
            if (meta.tele_end) setTeleEnd(meta.tele_end);
            if (meta.shift_start) setShiftStart(meta.shift_start);
            if (meta.shift_end) setShiftEnd(meta.shift_end);
            if (meta.leaves) setLeavesList(meta.leaves);
          } catch (e) {
            console.error('Error parsing metadata:', e);
          }
        }

        // Fetch slots
        if (data.doctor?.id) {
          try {
            const slotsRes = await api.get(`/doctors/${data.doctor.id}/slots`);
            if (slotsRes.data && slotsRes.data.success) {
              const fetchedSlots = slotsRes.data.data;
              const updated = [
                { weekday: 0, is_active: false, start_time: '09:00', end_time: '17:00' },
                { weekday: 1, is_active: false, start_time: '09:00', end_time: '17:00' },
                { weekday: 2, is_active: false, start_time: '09:00', end_time: '17:00' },
                { weekday: 3, is_active: false, start_time: '09:00', end_time: '17:00' },
                { weekday: 4, is_active: false, start_time: '09:00', end_time: '17:00' },
                { weekday: 5, is_active: false, start_time: '09:00', end_time: '17:00' },
                { weekday: 6, is_active: false, start_time: '09:00', end_time: '17:00' },
              ].map(ws => {
                const found = fetchedSlots.find((fs: any) => fs.weekday === ws.weekday);
                if (found) {
                  return {
                    weekday: ws.weekday,
                    is_active: found.is_active,
                    start_time: found.start_time,
                    end_time: found.end_time
                  };
                }
                return ws;
              });
              setWeeklySlots(updated);
            }
          } catch (slotErr) {
            console.error('Error fetching doctor slots:', slotErr);
          }
        }
        await fetchMyRequests();
      } else {
        setError('Failed to fetch dashboard metrics.');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error loading doctor dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

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
              fetchDashboard();
            } else if (data.event === 'patient_ready') {
              showToast(`${data.patient_name || 'Patient'} is now ready in the waiting lobby.`, 'info');
              fetchDashboard();
            } else if (data.event === 'patient_left') {
              showToast(`${data.patient_name || 'Patient'} has left the waiting lobby.`, 'info');
              fetchDashboard();
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

  useEffect(() => {
    if (false as boolean) {
      console.log(weeklySlots, leavesList);
    }
  }, [weeklySlots, leavesList]);

  // Fetch prescriptions list for the log
  const fetchPrescriptions = async () => {
    setLoadingPrescriptions(true);
    try {
      const res = await api.get('/prescriptions/');
      if (res.data && res.data.success) {
        const items = (res.data.data.items || []).map((item: any) => ({
          ...item,
          patient_name: item.patient?.user?.full_name || item.patient_name
        }));
        setAllPrescriptions(items);
      }
    } catch (err) {
      console.error('Error fetching prescriptions:', err);
    } finally {
      setLoadingPrescriptions(false);
    }
  };

  // Fetch all patients for dropdown selection in Treatment Plans and Follow-up
  const fetchPatientsDropdown = async () => {
    try {
      const res = await api.get('/patients/');
      if (res.data && res.data.success) {
        setAllPatients(res.data.data.items || []);
      }
    } catch (err) {
      console.error('Error fetching patients list:', err);
    }
  };

  // Fetch treatment plan for a specific patient
  const fetchPatientTreatmentPlan = async (patientId: string) => {
    if (!patientId) return;
    setLoadingPlan(true);
    try {
      const res = await api.get(`/treatment-plans/?patient_id=${patientId}`);
      if (res.data && res.data.success && res.data.data.items && res.data.data.items.length > 0) {
        setActivePlan(res.data.data.items[0]);
      } else {
        setActivePlan(null);
      }
    } catch (err) {
      console.error('Error fetching treatment plan:', err);
      setActivePlan(null);
    } finally {
      setLoadingPlan(false);
    }
  };

  // Add new procedure to the active treatment plan
  const handleAddProcedure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePlan) {
      showToast('No active treatment plan found to update.', 'error');
      return;
    }
    if (!newProcName.trim() || newProcCost <= 0) {
      showToast('Please fill out procedure name and a valid cost.', 'error');
      return;
    }

    setSavingProcedure(true);
    try {
      const updatedProcedures = [
        ...activePlan.procedures.map((p: any) => ({
          procedure_name: p.procedure_name,
          cost: p.cost,
          status: p.status,
          notes: p.notes
        })),
        {
          procedure_name: newProcName,
          cost: newProcCost,
          status: 'planned',
          notes: newProcNotes
        }
      ];

      const payload = {
        title: activePlan.title,
        status: activePlan.status,
        total_cost: activePlan.total_cost + newProcCost,
        notes: activePlan.notes,
        procedures: updatedProcedures
      };

      const res = await api.put(`/treatment-plans/${activePlan.id}`, payload);
      if (res.data && res.data.success) {
        setActivePlan(res.data.data);
        setNewProcName('');
        setNewProcCost(0);
        setNewProcNotes('');
        showToast('Procedure added successfully!');
      }
    } catch (err) {
      console.error('Error adding procedure:', err);
      showToast('Failed to add procedure to treatment plan.', 'error');
    } finally {
      setSavingProcedure(false);
    }
  };

  // Create a new treatment plan from scratch
  const handleCreateTreatmentPlan = async (patientId: string, title: string, notes: string) => {
    try {
      const payload = {
        patient_id: patientId,
        doctor_id: dashboardData?.doctor?.id || activeAppt?.doctor_id,
        title: title,
        status: 'active',
        total_cost: 0,
        notes: notes,
        procedures: []
      };
      const res = await api.post('/treatment-plans/', payload);
      if (res.data && res.data.success) {
        setActivePlan(res.data.data);
        showToast('Treatment plan initiated successfully.');
      }
    } catch (err) {
      console.error('Error creating treatment plan:', err);
      showToast('Failed to initiate treatment plan.', 'error');
    }
  };

  // Update procedure status in the plan
  const handleUpdateProcedureStatus = async (procedureIndex: number, newStatus: string) => {
    if (!activePlan) return;
    try {
      const updatedProcedures = activePlan.procedures.map((p: any, idx: number) => ({
        procedure_name: p.procedure_name,
        cost: p.cost,
        status: idx === procedureIndex ? newStatus : p.status,
        notes: p.notes
      }));

      // Auto-determine overall plan status based on procedures completion
      const allCompleted = updatedProcedures.length > 0 && updatedProcedures.every((p: any) => p.status === 'completed');
      const newPlanStatus = allCompleted ? 'completed' : 'active';

      const payload = {
        title: activePlan.title,
        status: newPlanStatus,
        total_cost: activePlan.total_cost,
        notes: activePlan.notes,
        procedures: updatedProcedures
      };

      const res = await api.put(`/treatment-plans/${activePlan.id}`, payload);
      if (res.data && res.data.success) {
        setActivePlan(res.data.data);
        showToast(allCompleted ? 'Treatment plan completed 100%! Status updated to COMPLETED 🎉' : 'Procedure status updated.');
      }
    } catch (err) {
      console.error('Error updating procedure status:', err);
      showToast('Failed to update procedure status.', 'error');
    }
  };

  // Fetch upcoming followups/appointments for list
  const fetchUpcomingFollowups = async () => {
    try {
      const res = await api.get('/doctors/me/follow-ups');
      if (res.data && res.data.success) {
        setPendingFollowups(res.data.data?.pending || []);
        setBookedFollowups(res.data.data?.booked || []);
      }
    } catch (err) {
      console.error('Error fetching follow-ups:', err);
    }
  };

  // IPD Ward Round States
  const [ipdBeds, setIpdBeds] = useState<any[]>([]);
  const [ipdCategories, setIpdCategories] = useState<any[]>([]);
  const [loadingIpdBeds, setLoadingIpdBeds] = useState<boolean>(false);
  const [selectedWardCategory, setSelectedWardCategory] = useState<string>('all');
  const [ipdSearchQuery, setIpdSearchQuery] = useState<string>('');

  // History Detail Modal State for Doctor
  const [isHistoryDetailsModalOpen, setIsHistoryDetailsModalOpen] = useState<boolean>(false);
  const [isLoadingHistoryDetails, setIsLoadingHistoryDetails] = useState<boolean>(false);
  const [historyDetailsData, setHistoryDetailsData] = useState<any>(null);

  // Doctor Round Note Modal State
  const [isRoundNoteModalOpen, setIsRoundNoteModalOpen] = useState<boolean>(false);
  const [selectedBedForRound, setSelectedBedForRound] = useState<any>(null);
  const [roundVitalsForm, setRoundVitalsForm] = useState({
    temp: 98.6,
    pulse: 72,
    systolic_bp: 120,
    diastolic_bp: 80,
    spo2: 98,
    respiratory_rate: 16,
    doctor_notes: '',
  });
  const [submittingRoundNote, setSubmittingRoundNote] = useState<boolean>(false);

  // Lock body scroll when any modal is active
  useEffect(() => {
    const isAnyModalOpen = isHistoryDetailsModalOpen || isRoundNoteModalOpen;
    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isHistoryDetailsModalOpen, isRoundNoteModalOpen]);

  const fetchIpdBeds = async () => {
    setLoadingIpdBeds(true);
    try {
      const [bedsRes, catRes] = await Promise.all([
        api.get('/ipd/dashboard/beds'),
        api.get('/ipd/categories')
      ]);
      if (bedsRes.data && bedsRes.data.success) {
        setIpdBeds(bedsRes.data.data || []);
      }
      if (catRes.data && catRes.data.success) {
        setIpdCategories(catRes.data.data || []);
      }
    } catch (err) {
      console.error('Error fetching IPD beds for doctor rounds:', err);
    } finally {
      setLoadingIpdBeds(false);
    }
  };

  const fetchHistoryDetails = async (admissionId: string) => {
    setIsLoadingHistoryDetails(true);
    setIsHistoryDetailsModalOpen(true);
    try {
      const res = await api.get(`/ipd/admissions/${admissionId}/summary`);
      if (res.data && res.data.success) {
        setHistoryDetailsData(res.data.data);
      } else {
        showToast('Could not load patient history case sheet.', 'error');
      }
    } catch (err: any) {
      console.error('Error fetching admission summary:', err);
      showToast('Error loading patient history details.', 'error');
    } finally {
      setIsLoadingHistoryDetails(false);
    }
  };

  const handleSaveRoundNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBedForRound || !selectedBedForRound.active_admission) return;
    if (!roundVitalsForm.doctor_notes.trim()) {
      showToast('Please enter doctor round notes.', 'error');
      return;
    }
    setSubmittingRoundNote(true);
    try {
      const payload = {
        admission_id: selectedBedForRound.active_admission.id,
        temp: parseFloat(String(roundVitalsForm.temp)),
        pulse: parseInt(String(roundVitalsForm.pulse)),
        systolic_bp: parseInt(String(roundVitalsForm.systolic_bp)),
        diastolic_bp: parseInt(String(roundVitalsForm.diastolic_bp)),
        spo2: parseInt(String(roundVitalsForm.spo2)),
        respiratory_rate: parseInt(String(roundVitalsForm.respiratory_rate)),
        nursing_notes: `[DOCTOR ROUND NOTE] ${roundVitalsForm.doctor_notes}`
      };
      const res = await api.post('/ipd/vitals/', payload);
      if (res.data && res.data.success) {
        showToast('Doctor Ward Round Note recorded successfully!', 'success');
        setIsRoundNoteModalOpen(false);
        setRoundVitalsForm({
          temp: 98.6,
          pulse: 72,
          systolic_bp: 120,
          diastolic_bp: 80,
          spo2: 98,
          respiratory_rate: 16,
          doctor_notes: '',
        });
        fetchIpdBeds();
      }
    } catch (err: any) {
      console.error('Error saving doctor round note:', err);
      showToast(err.response?.data?.message || 'Failed to save doctor round note.', 'error');
    } finally {
      setSubmittingRoundNote(false);
    }
  };

  // Fetch all tab contents on change
  useEffect(() => {
    if (activeTab === 'ipd' || activeTab === 'consultation') {
      fetchIpdBeds();
    } else if (activeTab === 'prescriptions') {
      fetchPrescriptions();
    } else if (activeTab === 'patients') {
      handleSearchPatients('');
    } else if (activeTab === 'treatment') {
      fetchPatientsDropdown();
      if (activeAppt) {
        setTreatmentPatientId(activeAppt.patient_id);
        fetchPatientTreatmentPlan(activeAppt.patient_id);
      }
    } else if (activeTab === 'followup') {
      fetchPatientsDropdown();
      fetchUpcomingFollowups();
    }
  }, [activeTab]);

  // Download PDF helper
  const downloadPdf = async (prescriptionId: string) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/prescriptions/${prescriptionId}/pdf`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('PDF generation failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Rx_Prescription_${prescriptionId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      showToast('PDF downloaded successfully!');
    } catch (err) {
      console.error('Error downloading PDF:', err);
      showToast('Failed to download prescription PDF.', 'error');
    }
  };

  // Trigger AI Clinical Note Analysis
  const triggerAIAnalysis = async (textToAnalyze: string, scenarioKey?: string) => {
    setIsAnalyzing(true);
    setApproved(false);
    setAllergyWarnings([]);
    try {
      // Gather active patient allergies if present
      let patientAllergies: string[] = [];
      if (activePatientDetails?.allergies) {
        if (Array.isArray(activePatientDetails.allergies)) {
          patientAllergies = activePatientDetails.allergies;
        } else if (typeof activePatientDetails.allergies === 'string') {
          patientAllergies = [activePatientDetails.allergies];
        }
      }

      const res = await api.post('/ai/analyze-notes', {
        text: textToAnalyze,
        scenario: scenarioKey,
        patient_allergies: patientAllergies,
        patient_id: activeAppt?.patient_id
      });

      if (res.data && res.data.success) {
        const result = res.data.data;
        let vitals = { bp: '120/80', pulse: 72, temperature: 98.6 };
        const lowerText = textToAnalyze.toLowerCase();
        const scKey = scenarioKey || '';
        if (lowerText.includes('canal') || lowerText.includes('pulpitis') || scKey === 'root_canal') {
          vitals = { bp: '130/85', pulse: 88, temperature: 99.1 };
        } else if (lowerText.includes('extract') || scKey === 'extraction') {
          vitals = { bp: '125/82', pulse: 80, temperature: 98.8 };
        } else if (lowerText.includes('brace') || scKey === 'braces') {
          vitals = { bp: '118/76', pulse: 70, temperature: 98.4 };
        } else if (lowerText.includes('scale') || lowerText.includes('scaling') || scKey === 'scaling') {
          vitals = { bp: '120/80', pulse: 72, temperature: 98.6 };
        }

        const summaryObj = {
          vitals,
          diagnosis: result.suggested_treatment_plan || 'General Dental Consultation',
          clinical_summary: result.summary || textToAnalyze,
          treatment_notes: result.treatment_plan_notes || '',
          medications: result.suggested_medications || [],
          suggested_treatment: result.suggested_treatment_plan || '',
          allergy_warnings: result.allergy_warnings || []
        };

        setAiSummary(summaryObj);
        setEditedSummaryText(summaryObj.clinical_summary);
        setSuggestedMeds(result.suggested_medications || []);
        setSuggestedTreatment(result.suggested_treatment_plan || '');
        setSuggestedTreatmentNotes(result.treatment_plan_notes || '');
        setAllergyWarnings(result.allergy_warnings || []);
        
        // Auto-populate consultation form fields from AI result
        setDiagnosis(result.suggested_treatment_plan || '');
        if (!notes.trim()) {
          setNotes(result.treatment_plan_notes || result.summary || '');
        }
        if (!symptoms.trim() && result.summary) {
          setSymptoms(result.summary);
        }

        if (result.allergy_warnings && result.allergy_warnings.length > 0) {
          showToast('⚠️ ALLERGY ALERT: AI detected medication conflict with patient allergies!', 'error');
        } else {
          showToast('AI Clinical Analysis loaded — review and accept below.');
        }
      }
    } catch (err) {
      console.error('Error in AI analysis request:', err);
      showToast('AI analysis failed. Using fallback processor.', 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Simulate typing of scenario clinical notes
  const handleStartScenario = (scenarioKey: string) => {
    setSelectedScenario(scenarioKey);
    setSymptoms('');
    setIsListening(true);
    setApproved(false);
    setAiSummary('');
    setEditedSummaryText('');
    setIsEditingSummary(false);
    setSuggestedMeds([]);
    setSuggestedTreatment('');
    setAllergyWarnings([]);

    const fullText = CLINICAL_SCENARIOS[scenarioKey].notes;
    let currentIdx = 0;
    const interval = setInterval(() => {
      if (currentIdx < fullText.length) {
        setSymptoms(prev => prev + fullText.charAt(currentIdx));
        currentIdx++;
      } else {
        clearInterval(interval);
        setIsListening(false);
        triggerAIAnalysis(fullText, scenarioKey);
      }
    }, 15);
  };

  // Groq Whisper Large V3 MediaRecorder voice dictation
  const startMediaRecorder = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
        }
        setRecordingSeconds(0);
        setIsRecordingAudio(false);
        setIsListening(false);

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size === 0) {
          showToast('No audio recorded.', 'error');
          return;
        }

        setIsTranscribing(true);
        showToast('Transcribing voice dictation via Groq Whisper Large V3...');

        try {
          const formData = new FormData();
          formData.append('file', audioBlob, 'dictation.webm');

          const response = await api.post('/ai/transcribe', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });

          if (response.data && response.data.success) {
            const transcribedText = response.data.data.text;
            if (transcribedText) {
              setSymptoms(transcribedText);
              showToast('Voice transcribed successfully! Running AI analysis...');
              triggerAIAnalysis(transcribedText);
            } else {
              showToast('No speech detected in recording.', 'error');
            }
          } else {
            showToast('Voice transcription failed.', 'error');
          }
        } catch (err: any) {
          console.error('Error transcribing audio:', err);
          showToast('Whisper transcription failed. Please verify Groq API Key.', 'error');
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start(200);
      setIsRecordingAudio(true);
      setIsListening(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      showToast('Could not access microphone. Please grant mic permissions.', 'error');
      runSimulatedVoice();
    }
  };

  const stopMediaRecorder = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleStartVoiceDictation = () => {
    if (isRecordingAudio) {
      stopMediaRecorder();
    } else {
      setApproved(false);
      setAiSummary('');
      setEditedSummaryText('');
      setIsEditingSummary(false);
      setSuggestedMeds([]);
      setSuggestedTreatment('');
      setAllergyWarnings([]);
      startMediaRecorder();
    }
  };

  const runSimulatedVoice = () => {
    setIsListening(true);
    setSymptoms('');
    const dummySpeechText = "Patient complains of bleeding gums while brushing, yellow tartar buildup on lower front teeth, and mild sensitivity to cold beverages.";
    let index = 0;
    const interval = setInterval(() => {
      if (index < dummySpeechText.length) {
        setSymptoms(prev => prev + dummySpeechText.charAt(index));
        index++;
      } else {
        clearInterval(interval);
        setIsListening(false);
        triggerAIAnalysis(dummySpeechText);
      }
    }, 15);
  };

  // Apply suggested medicines to the prescription form
  const applyAISuggestions = () => {
    const mappedItems = suggestedMeds.map((med: any) => ({
      medicine_name: med.medicine_name,
      dosage: med.dosage,
      duration: med.duration,
      instructions: med.instructions
    }));
    setPrescriptionItems([...prescriptionItems, ...mappedItems]);
    showToast('AI Medicines applied to Prescription Builder!');
  };

  // Add the AI treatment suggestion as a treatment plan
  const applyAITreatmentPlan = async () => {
    if (!activeAppt) return;
    try {
      await handleCreateTreatmentPlan(activeAppt.patient_id, suggestedTreatment, suggestedTreatmentNotes);
      showToast('Treatment plan initiated from AI suggestion!');
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Search Patients
  const handleSearchPatients = async (query: string) => {
    setPatientSearch(query);
    try {
      const url = query.trim() ? `/patients/?search=${query}` : '/patients/';
      const res = await api.get(url);
      if (res.data && res.data.success) {
        setPatientsList(res.data.data.items || []);
      }
    } catch (err) {
      console.error('Error searching patients:', err);
    }
  };


  // View Patient History
  const handleViewHistory = async (patient: any) => {
    setLoadingHistory(true);
    setLoadingEmrHistory(true);
    setSelectedPatientHistory({ patient });
    setEmrLookupPatient({ patient });
    try {
      const consRes = await api.get(`/consultations/?patient_id=${patient.id}`);
      const prescRes = await api.get(`/prescriptions/?patient_id=${patient.id}`);
      const reportsRes = await api.get(`/medical-reports/patient/${patient.id}`);
      
      const historyData = {
        patient,
        consultations: consRes.data?.data?.items || [],
        prescriptions: prescRes.data?.data?.items || [],
        reports: reportsRes.data?.data || []
      };
      
      setSelectedPatientHistory(historyData);
      setEmrLookupPatient(historyData);
    } catch (err) {
      console.error('Error fetching patient history:', err);
    } finally {
      setLoadingHistory(false);
      setLoadingEmrHistory(false);
    }
  };

  const handlePreviewReport = async (report: any) => {
    setViewingReport(report);
    setLoadingReportFile(false);
    setReportError('');
    
    const url = report.file_url.startsWith('http') 
      ? report.file_url 
      : `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${report.file_url}`;
      
    setReportFileUrl(url);
    
    const urlLower = report.file_url.toLowerCase();
    const isImg = !urlLower.includes('.pdf') && (
                  urlLower.endsWith('.png') || 
                  urlLower.endsWith('.jpg') || 
                  urlLower.endsWith('.jpeg') || 
                  urlLower.endsWith('.gif') || 
                  urlLower.endsWith('.webp') ||
                  urlLower.includes('/image/')
                );
                  
    if (isImg) {
      setReportContentType('image/jpeg');
    } else {
      setReportContentType('application/pdf');
    }
  };

  const downloadReportFile = async (url: string, filename: string) => {
    try {
      const absoluteUrl = url.startsWith('http') 
        ? url 
        : `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${url}`;
      
      const response = await fetch(absoluteUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      setTimeout(() => {
        window.URL.revokeObjectURL(link.href);
      }, 100);
    } catch (err: any) {
      console.error('Error downloading report:', err);
      showToast('Failed to download report document.', 'error');
    }
  };

  const handleCloseReportModal = () => {
    if (reportFileUrl && reportFileUrl.startsWith('blob:')) {
      window.URL.revokeObjectURL(reportFileUrl);
    }
    setViewingReport(null);
    setReportFileUrl('');
    setReportContentType('');
  };

  // Start Consultation — updates appointment status to in_consultation in backend
  const handleStartConsultation = async (appt: any) => {
    try {
      // 1. Mark appointment as "in_consultation" so receptionist queue reflects it
      await api.patch(`/appointments/${appt.id}/start`);
    } catch (err) {
      // Non-blocking: log but don't block the UI from opening
      console.warn('Could not update appointment status to in_consultation:', err);
    }

    setActiveAppt(appt);
    setSymptoms(appt.notes || '');
    setDiagnosis('');
    setNotes('');
    setVitalsBp('120/80');
    setVitalsPulse(72);
    setVitalsTemp(98.6);
    setVitalsSpo2(98);
    setPrescriptionItems([]);
    setApproved(false);
    setAiSummary(null);
    setEditedSummaryText('');
    setIsEditingSummary(false);
    setFollowupAdvised(false);
    setFollowupAfterDays(7);

    // Fetch full patient profile details
    if (appt.patient_id) {
      setLoadingPatientDetails(true);
      try {
        const res = await api.get(`/patients/${appt.patient_id}`);
        if (res.data && res.data.success) {
          const patData = res.data.data;
          setActivePatientDetails(patData);
          const h = patData.height || '172';
          const w = patData.weight || '74';
          setVitalsHeight(h);
          setVitalsWeight(w);
          setCalculatedBmiInfo(calculateBMI(h, w));
        }
      } catch (err) {
        console.error('Error fetching patient profile:', err);
      } finally {
        setLoadingPatientDetails(false);
      }
    }

    // 2. Pre-load patient history for clinical context on the consultation left-panel
    handleViewHistory({ id: appt.patient_id, user: { full_name: appt.patient_name }, patient_code: appt.patient_code });

    setActiveTab('consultation');
  };

  // Prescription builder rows
  const addPrescriptionItem = () => {
    setPrescriptionItems([
      ...prescriptionItems,
      { medicine_name: '', dosage: '1-0-1', duration: '5 days', instructions: 'Take after food' }
    ]);
  };

  const removePrescriptionItem = (index: number) => {
    const updated = [...prescriptionItems];
    updated.splice(index, 1);
    setPrescriptionItems(updated);
  };

  const updatePrescriptionItem = (index: number, field: keyof PrescriptionItemInput, value: string) => {
    const updated = [...prescriptionItems];
    updated[index][field] = value;
    setPrescriptionItems(updated);
  };

  // Edit Existing Prescription Handlers
  const handleOpenEditPrescription = (presc: any) => {
    setEditingPrescriptionId(presc.id);
    setEditingPrescriptionNotes(presc.notes || '');
    setEditingPrescriptionItems(
      (presc.items || []).map((item: any) => ({
        medicine_name: item.medicine_name || '',
        dosage: item.dosage || '1-0-1',
        duration: item.duration || '5 days',
        instructions: item.instructions || 'Take after food',
        quantity: item.quantity || 10,
      }))
    );
    setIsEditPrescriptionModalOpen(true);
  };

  const addEditPrescriptionItem = () => {
    setEditingPrescriptionItems([
      ...editingPrescriptionItems,
      { medicine_name: '', dosage: '1-0-1', duration: '5 days', instructions: 'Take after food', quantity: 10 }
    ]);
  };

  const removeEditPrescriptionItem = (index: number) => {
    const updated = [...editingPrescriptionItems];
    updated.splice(index, 1);
    setEditingPrescriptionItems(updated);
  };

  const updateEditPrescriptionItem = (index: number, field: string, value: any) => {
    const updated = [...editingPrescriptionItems];
    updated[index] = { ...updated[index], [field]: value };
    setEditingPrescriptionItems(updated);
  };

  const handleSaveEditPrescription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPrescriptionId) return;

    if (editingPrescriptionItems.length === 0) {
      showToast('Prescription must contain at least one medicine item.', 'error');
      return;
    }

    setSavingEditPrescription(true);
    try {
      const payload = {
        notes: editingPrescriptionNotes,
        items: editingPrescriptionItems.map((item) => ({
          medicine_name: item.medicine_name,
          dosage: item.dosage,
          duration: item.duration,
          instructions: item.instructions,
          quantity: item.quantity ? parseInt(String(item.quantity), 10) : 10,
        })),
      };
      const res = await api.put(`/prescriptions/${editingPrescriptionId}`, payload);
      if (res.data && res.data.success) {
        showToast('Prescription updated successfully!', 'success');
        const updatedPresc = res.data.data;
        
        setSelectedPrescription((prev: any) => ({
          ...prev,
          ...updatedPresc,
          items: updatedPresc.items || payload.items,
          notes: updatedPresc.notes,
        }));
        setAllPrescriptions((prev: any[]) =>
          prev.map((p) => (p.id === editingPrescriptionId ? { ...p, ...updatedPresc, patient_name: p.patient_name } : p))
        );
        setIsEditPrescriptionModalOpen(false);
      }
    } catch (err: any) {
      console.error('Error updating prescription:', err);
      showToast(err.response?.data?.message || 'Failed to update prescription.', 'error');
    } finally {
      setSavingEditPrescription(false);
    }
  };

  // Save Consultation and Prescriptions
  const handleSaveConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!diagnosis.trim()) {
      showToast('Please enter a diagnosis.', 'error');
      return;
    }

    setSavingConsultation(true);
    try {
      // Persist the latest height & weight back to the patient profile
      try {
        await api.put(`/patients/${activeAppt.patient_id}`, {
          height: vitalsHeight,
          weight: vitalsWeight
        });
      } catch (profileErr) {
        console.warn('Could not update patient height/weight:', profileErr);
      }

      const consultPayload = {
        appointment_id: activeAppt.id,
        patient_id: activeAppt.patient_id,
        doctor_id: dashboardData?.doctor?.id || activeAppt.doctor_id || "3c0cff69-4b92-41fe-b2a5-e8f77f76b394",
        branch_id: activeAppt.branch_id || dashboardData?.doctor?.branch_id || "4b60cf78-7a68-4437-8423-a19c6a9b9377",
        symptoms,
        diagnosis,
        notes: notes || editedSummaryText || aiSummary?.clinical_summary || "",
        vitals_bp: vitalsBp,
        vitals_pulse: vitalsPulse,
        vitals_temperature: vitalsTemp,
        followup_advised: followupAdvised,
        followup_after_days: followupAdvised ? followupAfterDays : 0
      };

      const consultRes = await api.post('/consultations/', consultPayload);
      
      if (consultRes.data && consultRes.data.success) {
        const newConsultationId = consultRes.data.data.id;

        if (prescriptionItems.length > 0) {
          const prescPayload = {
            consultation_id: newConsultationId,
            patient_id: activeAppt.patient_id,
            doctor_id: consultPayload.doctor_id,
            // Use actual doctor notes (which carries AI clinical summary the doctor reviewed)
            notes: notes.trim() || editedSummaryText.trim() || (aiSummary?.clinical_summary ? aiSummary.clinical_summary : 'Take medicines strictly as directed.'),
            status: 'active',
            items: prescriptionItems.map(item => ({
              medicine_name: item.medicine_name,
              dosage: item.dosage,
              duration: item.duration,
              instructions: item.instructions
            }))
          };
          await api.post('/prescriptions/', prescPayload);
        }

        if (ipdAdvised) {
          try {
            await api.post('/ipd/admission-requests', {
              patient_id: activeAppt.patient_id,
              category_id: ipdPreferredCategory || null,
              reason: ipdReason || diagnosis || 'Advised for IPD admission & monitoring.',
              urgency: ipdUrgency
            });
            showToast('IPD Admission request & alert sent to Receptionist!', 'info');
          } catch (ipdErr) {
            console.error('Failed to send IPD admission request:', ipdErr);
          }
        }

        showToast('Consultation and prescription recorded successfully!', 'success');
        setIpdAdvised(false);
        setIpdReason('');
        setIpdPreferredCategory('');
        setIpdUrgency('routine');
        setActiveAppt(null);
        fetchDashboard();
      }
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Error recording consultation.', 'error');
    } finally {
      setSavingConsultation(false);
    }
  };



  // Join teleconsultation meeting
  const handleJoinVideo = async (appt: any) => {
    let room = '';
    try {
      const res = await api.post(`/teleconsultations/${appt.id}/join`);
      const data = res.data?.data || res.data;
      room = (data?.meeting_url || `vclinicteleconsult${appt.id.replace(/-/g, '').substring(0, 12)}`).toLowerCase().replace(/[^a-z0-9]/g, '');
      showToast('Video consultation room connected!', 'success');
    } catch (e: any) {
      try {
        const res2 = await api.post(`/teleconsultations/${appt.id}/create-link`);
        const data2 = res2.data?.data || res2.data;
        room = (data2?.meeting_url || `vclinicteleconsult${appt.id.replace(/-/g, '').substring(0, 12)}`).toLowerCase().replace(/[^a-z0-9]/g, '');
      } catch (err2) {
        room = `vclinicteleconsult${appt.id.replace(/-/g, '').substring(0, 12)}`;
      }
      showToast('Joining video consultation room...', 'info');
    }
    setVideoRoomName(room);
    setVideoPatientName(appt.patient_name || appt.patient?.user?.full_name || 'Patient');
    setVideoApptId(appt.id);
    setInVideoCall(true);
  };

  // Time conversion
  const formatTime = (timeStr: string) => {
    try {
      const date = new Date(timeStr);
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch (e) {
      return timeStr;
    }
  };

  const queueItems = (dashboardData?.today_appointments || []).filter(
    (appt: any) => appt.status && ["waiting", "checked_in", "in_consultation", "in consultation", "completed"].includes(appt.status.toLowerCase())
  );

  const doctorName = dashboardData?.doctor?.full_name || 'Doctor';
  const doctorSpecialty = dashboardData?.doctor?.specialization || 'Specialist';

  return (
    <div className="doc-layout">
      {/* ── SIDEBAR ── */}
      <aside className="doc-sidebar">
        <div className="doc-sidebar-header">
          <div className="doc-logo-badge">V</div>
          <div className="doc-clinic-info">
            <span className="doc-clinic-name">Vertical Clinic</span>
            <span className="doc-clinic-sub">CLINIC OS</span>
          </div>
        </div>

        <div className="doc-sidebar-pill">
          Doctor Portal
        </div>

        <nav className="doc-sidebar-nav">
          <div className="doc-nav-group-label">MAIN</div>
          <div 
            className={`doc-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => { handleRootTabChange('dashboard'); setSelectedPatientHistory(null); }}
          >
            <Home size={18} /> Dashboard
          </div>

          <div 
            className={`doc-nav-item ${activeTab === 'queue' ? 'active' : ''}`}
            onClick={() => { handleRootTabChange('queue'); setSelectedPatientHistory(null); }}
          >
            <List size={18} /> Queue
          </div>
          
          <div className="doc-nav-group-label">CONSULTATION</div>
          <div 
            className={`doc-nav-item ${activeTab === 'consultation' ? 'active' : ''}`}
            onClick={() => { handleRootTabChange('consultation'); }}
          >
            <Stethoscope size={18} /> Consultation
          </div>

          <div 
            className={`doc-nav-item ${activeTab === 'prescriptions' ? 'active' : ''}`}
            onClick={() => { handleRootTabChange('prescriptions'); setSelectedPatientHistory(null); }}
          >
            <FileText size={18} /> Prescription
          </div>

          <div 
            className={`doc-nav-item ${activeTab === 'treatment' ? 'active' : ''}`}
            onClick={() => { handleRootTabChange('treatment'); setSelectedPatientHistory(null); }}
          >
            <Activity size={18} /> Treatment Plan
          </div>

          <div 
            className={`doc-nav-item ${activeTab === 'followup' ? 'active' : ''}`}
            onClick={() => { handleRootTabChange('followup'); setSelectedPatientHistory(null); }}
          >
            <Clock size={18} /> Follow-up
          </div>

          <div 
            className={`doc-nav-item ${activeTab === 'availability' ? 'active' : ''}`}
            onClick={() => { handleRootTabChange('availability'); setSelectedPatientHistory(null); }}
          >
            <Calendar size={18} /> Availability
          </div>

          <div className="doc-nav-group-label">IN-PATIENT (IPD)</div>
          <div 
            className={`doc-nav-item ${activeTab === 'ipd' ? 'active' : ''}`}
            onClick={() => { handleRootTabChange('ipd'); setSelectedPatientHistory(null); }}
          >
            <Bed size={18} /> IPD Ward Rounds
          </div>

          <div className="doc-nav-group-label">PROFILE</div>
          <div 
            className={`doc-nav-item ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => { handleRootTabChange('profile'); setSelectedPatientHistory(null); }}
          >
            <User size={18} /> My Profile
          </div>
        </nav>

        <div className="doc-sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button className="doc-btn-switch" onClick={onLogout}>
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT AREA ── */}
      <main className="doc-main">
        {/* ── TOPBAR ── */}
        <header className="doc-topbar">
          <div className="doc-title-area" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '14px' }}>
            {tabHistory.length > 0 && (
              <button 
                onClick={goBackTab} 
                className="doc-back-btn" 
                title="Go Back"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div>
              <h1 className="doc-page-title" style={{ margin: 0 }}>
                {activeTab === 'dashboard' && 'Dashboard'}
                {activeTab === 'queue' && 'Queue Management'}
                {activeTab === 'consultation' && 'Consultation'}
                {activeTab === 'prescriptions' && 'Prescription Workspace'}
                {activeTab === 'treatment' && 'Treatment Plans'}
                {activeTab === 'followup' && 'Follow-up Center'}
                {activeTab === 'availability' && 'Availability Settings'}
                {activeTab === 'ipd' && 'IPD Ward Rounds'}
                {activeTab === 'workflow' && 'Full Clinic Workflow'}
                {activeTab === 'profile' && 'My Profile'}
              </h1>
              <p className="doc-page-subtitle" style={{ marginTop: '2px', margin: 0 }}>Doctor Portal · {dashboardData?.doctor?.branch_name ? `${dashboardData.doctor.branch_name} Branch` : 'Loading Branch...'}</p>
            </div>
          </div>

          <div ref={globalSearchRef} style={{ flex: 1, maxWidth: '380px', margin: '0 32px', position: 'relative' }}>
            <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--doc-text-muted)' }} size={16} />
            <input 
              type="text" 
              className="doc-input" 
              style={{ paddingLeft: '38px', height: '38px', width: '100%', borderRadius: '10px', fontSize: '0.85rem', margin: 0 }} 
              placeholder="Global Patient EMR Search..." 
              value={globalSearchQuery}
              onChange={(e) => handleGlobalSearch(e.target.value)}
            />
            {isGlobalSearchDropdownOpen && (
              <div className="global-search-dropdown" style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                left: 0,
                right: 0,
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                zIndex: 999,
                maxHeight: '300px',
                overflowY: 'auto',
                padding: '6px 0'
              }}>
                {globalSearchResults.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', fontSize: '0.85rem', color: '#64748b' }}>
                    No patient records found.
                  </div>
                ) : (
                  globalSearchResults.map((pat: any) => (
                    <div 
                      key={pat.id} 
                      className="global-search-item" 
                      onClick={() => handleSelectEmrPatient(pat)}
                      style={{
                        padding: '10px 16px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        borderBottom: '1px solid #f1f5f9',
                        textAlign: 'left'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>{pat.user?.full_name || pat.full_name || pat.patient_name || 'Walk-in Patient'}</span>
                        <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--primary-teal, #0c6e8c)', backgroundColor: 'rgba(12, 110, 140, 0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                          {pat.patient_code}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', fontSize: '0.75rem', color: '#64748b' }}>
                        <span>Phone: {pat.user?.phone || pat.phone_number || 'N/A'}</span>
                        <span>·</span>
                        <span>Gender: {pat.gender || 'N/A'}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div className="notifications-wrapper" ref={notiDropdownRef} style={{ position: 'relative' }}>
              <button 
                onClick={() => setIsNotiDropdownOpen(!isNotiDropdownOpen)}
                style={{ border: 'none', background: 'none', position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px' }}
              >
                <Bell size={20} color="var(--doc-text-muted)" />
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
                className="doc-profile-badge" 
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                style={{ cursor: 'pointer' }}
              >
                <div className="doc-profile-avatar" style={{ backgroundColor: '#e0f2fe', color: '#0369a1', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {dashboardData?.doctor?.avatar_url ? (
                    <img src={dashboardData.doctor.avatar_url} alt="Doctor" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    doctorName.split(' ').map((n: string) => n[0]).join('')
                  )}
                </div>
                <div className="doc-profile-info">
                  <span className="doc-profile-name">{doctorName}</span>
                  <span className="doc-profile-role">{doctorSpecialty}</span>
                </div>
              </div>

              {isProfileDropdownOpen && (
                <div className="profile-dropdown-menu">
                  <button onClick={() => { handleRootTabChange('profile'); setIsProfileDropdownOpen(false); }}>
                    <User size={14} style={{ color: 'var(--primary-teal, #0c6e8c)' }} /> View Profile
                  </button>
                  <button onClick={() => { handleRootTabChange('availability'); setIsProfileDropdownOpen(false); }}>
                    <Settings size={14} style={{ color: 'var(--primary-teal, #0c6e8c)' }} /> Availability
                  </button>
                  <div className="profile-dropdown-divider"></div>
                  <button className="logout-item" onClick={() => { onLogout(); setIsProfileDropdownOpen(false); }}>
                    <LogOut size={14} style={{ color: '#dc2626' }} /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ── ROUTED VIEWS ── */}
        <div className="doc-content">
          {loading && activeTab === 'dashboard' ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>Loading clinical analytics...</div>
          ) : error && activeTab === 'dashboard' ? (
            <div style={{ color: 'red', textAlign: 'center', padding: '20px' }}>{error}</div>
          ) : (
            <>
              {/* TAB: DASHBOARD */}
              {activeTab === 'dashboard' && (
                <>
                  {/* Stats Grid */}
                  <div className="doc-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '24px' }}>
                    <div className="doc-stat-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span className="doc-stat-val">{dashboardData?.analytics?.patients_treated_today ?? 8}</span>
                          <span className="doc-stat-label" style={{ marginTop: '8px' }}>Today's Patients</span>
                        </div>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Users size={16} color="#3b82f6" />
                        </div>
                      </div>
                    </div>

                    <div className="doc-stat-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span className="doc-stat-val">{dashboardData?.analytics?.upcoming_appointments ?? 2}</span>
                          <span className="doc-stat-label" style={{ marginTop: '8px' }}>Waiting Queue</span>
                        </div>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Clock size={16} color="#f97316" />
                        </div>
                      </div>
                    </div>

                    <div className="doc-stat-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span className="doc-stat-val">{dashboardData?.analytics?.completed_consultations ?? 5}</span>
                          <span className="doc-stat-label" style={{ marginTop: '8px' }}>Completed Consultations</span>
                        </div>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CheckCircle size={16} color="#22c55e" />
                        </div>
                      </div>
                    </div>

                    <div className="doc-stat-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span className="doc-stat-val">{dashboardData?.analytics?.tele_consultations_completed ?? 1}</span>
                          <span className="doc-stat-label" style={{ marginTop: '8px' }}>Tele Consultations</span>
                        </div>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#e6fcf5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Video size={16} color="#0d9488" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Two Column Layout matching screenshot */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '24px' }}>
                    {/* Left Column: Today's Queue */}
                    <div className="doc-card" style={{ marginBottom: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h2 className="doc-card-title" style={{ margin: 0 }}>Today's Queue</h2>
                        <a href="#queue" onClick={(e) => { e.preventDefault(); setActiveTab('queue'); }} style={{ color: 'var(--doc-primary)', fontSize: '0.82rem', fontWeight: '600', textDecoration: 'none' }}>
                          Open full queue
                        </a>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {queueItems.map((appt: any, idx: number) => {
                          const initials = appt.patient_name
                            ? appt.patient_name.split(' ').map((n: string) => n[0]).join('').toUpperCase()
                            : 'PT';
                          const timeStr = appt.appointment_datetime
                            ? formatTime(appt.appointment_datetime)
                            : '10:00 AM';
                          const statusLower = appt.status.toLowerCase();
                          const isWaiting = statusLower === 'waiting' || statusLower === 'pending' || statusLower === 'checked_in';
                          const isCompleted = statusLower === 'completed';
                          const isInConsult = statusLower === 'in_consultation' || statusLower === 'in consultation';

                          return (
                            <div key={appt.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', border: '1px solid var(--doc-border)', borderRadius: '10px', opacity: isCompleted ? 0.75 : 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.85rem' }}>
                                  {initials}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>{appt.patient_name}</span>
                                    {appt.tele_status === 'patient_ready' && (
                                      <span style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '1px 6px', borderRadius: '10px', fontSize: '0.65rem', fontWeight: '800', border: '1px solid #bbf7d0', whiteSpace: 'nowrap' }}>
                                        Ready in Lobby
                                      </span>
                                    )}
                                  </div>
                                  <span style={{ fontSize: '0.78rem', color: 'var(--doc-text-muted)' }}>
                                    {appt.treatment_type} - {timeStr}
                                  </span>
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                {isWaiting ? (
                                  <span style={{ backgroundColor: '#fff7ed', color: '#ea580c', padding: '4px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ width: '5px', height: '5px', backgroundColor: '#ea580c', borderRadius: '50%' }} /> {statusLower === 'checked_in' ? 'Checked In' : 'Waiting'}
                                  </span>
                                ) : isCompleted ? (
                                  <span style={{ backgroundColor: '#f0fdf4', color: '#16a34a', padding: '4px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ width: '5px', height: '5px', backgroundColor: '#16a34a', borderRadius: '50%' }} /> Completed
                                  </span>
                                ) : isInConsult ? (
                                  <span style={{ backgroundColor: '#eff6ff', color: '#2563eb', padding: '4px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ width: '5px', height: '5px', backgroundColor: '#2563eb', borderRadius: '50%' }} /> In Consultation
                                  </span>
                                ) : (
                                  <span style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', padding: '4px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ width: '5px', height: '5px', backgroundColor: '#1d4ed8', borderRadius: '50%' }} /> Confirmed
                                  </span>
                                )}
                                
                                {isCompleted ? (
                                  <button 
                                    onClick={() => handleViewHistory({ 
                                      id: appt.patient_id, 
                                      user: { full_name: appt.patient_name }, 
                                      patient_code: appt.patient_code 
                                    })} 
                                    className="doc-btn-secondary" 
                                    style={{ height: '32px', padding: '0 16px', borderRadius: '6px', fontSize: '0.8rem', backgroundColor: '#f0fdf4', color: '#16a34a', borderColor: '#bbf7d0', cursor: 'pointer', fontWeight: '600' }}
                                  >
                                    View History
                                  </button>
                                ) : (
                                  <button 
                                    onClick={() => handleStartConsultation({ 
                                      id: appt.id, 
                                      patient_name: appt.patient_name, 
                                      patient_id: appt.patient_id || 'd9bfa4b1-8b01-44bb-bc74-672ef9198642', 
                                      treatment_type: appt.treatment_type 
                                    })} 
                                    className="doc-btn-primary" 
                                    style={{ height: '32px', padding: '0 16px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600' }}
                                  >
                                    {isInConsult ? 'Resume' : 'Open'}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Right Column: Weekly Consultation Load bar chart */}
                    <div className="doc-card" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column' }}>
                      <h2 className="doc-card-title">Consultation Load — This Week</h2>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '20px 10px 10px 10px', height: '180px' }}>
                        {/* Mon */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '12%' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: '600', marginBottom: '6px', color: 'var(--doc-text-muted)' }}>9</span>
                          <div style={{ width: '100%', height: '90px', background: 'linear-gradient(180deg, #06b6d4 0%, #0f766e 100%)', borderRadius: '4px' }} />
                          <span style={{ fontSize: '0.75rem', fontWeight: '600', marginTop: '8px', color: 'var(--doc-text-muted)' }}>Mon</span>
                        </div>
                        {/* Tue */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '12%' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: '600', marginBottom: '6px', color: 'var(--doc-text-muted)' }}>11</span>
                          <div style={{ width: '100%', height: '110px', background: 'linear-gradient(180deg, #06b6d4 0%, #0f766e 100%)', borderRadius: '4px' }} />
                          <span style={{ fontSize: '0.75rem', fontWeight: '600', marginTop: '8px', color: 'var(--doc-text-muted)' }}>Tue</span>
                        </div>
                        {/* Wed */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '12%' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: '600', marginBottom: '6px', color: 'var(--doc-text-muted)' }}>8</span>
                          <div style={{ width: '100%', height: '80px', background: 'linear-gradient(180deg, #06b6d4 0%, #0f766e 100%)', borderRadius: '4px' }} />
                          <span style={{ fontSize: '0.75rem', fontWeight: '600', marginTop: '8px', color: 'var(--doc-text-muted)' }}>Wed</span>
                        </div>
                        {/* Thu */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '12%' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: '600', marginBottom: '6px', color: 'var(--doc-text-muted)' }}>12</span>
                          <div style={{ width: '100%', height: '120px', background: 'linear-gradient(180deg, #06b6d4 0%, #0f766e 100%)', borderRadius: '4px' }} />
                          <span style={{ fontSize: '0.75rem', fontWeight: '600', marginTop: '8px', color: 'var(--doc-text-muted)' }}>Thu</span>
                        </div>
                        {/* Fri */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '12%' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: '600', marginBottom: '6px', color: 'var(--doc-text-muted)' }}>10</span>
                          <div style={{ width: '100%', height: '100px', background: 'linear-gradient(180deg, #06b6d4 0%, #0f766e 100%)', borderRadius: '4px' }} />
                          <span style={{ fontSize: '0.75rem', fontWeight: '600', marginTop: '8px', color: 'var(--doc-text-muted)' }}>Fri</span>
                        </div>
                        {/* Sat */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '12%' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: '600', marginBottom: '6px', color: 'var(--doc-text-muted)' }}>6</span>
                          <div style={{ width: '100%', height: '60px', background: 'linear-gradient(180deg, #06b6d4 0%, #0f766e 100%)', borderRadius: '4px' }} />
                          <span style={{ fontSize: '0.75rem', fontWeight: '600', marginTop: '8px', color: 'var(--doc-text-muted)' }}>Sat</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* TAB: QUEUE (FULL QUEUE) */}
              {activeTab === 'queue' && (
                <div>
                  <div className="doc-card" style={{ marginBottom: '20px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Active Waiting Queue</h3>
                    <div style={{ position: 'relative', width: '280px' }}>
                      <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--doc-text-muted)' }} size={16} />
                      <input 
                        type="text" 
                        className="doc-input" 
                        style={{ paddingLeft: '36px', height: '36px', width: '100%', fontSize: '0.85rem', margin: 0 }}
                        placeholder="Search patient name..."
                        list="doctor-queue-suggestions"
                        value={queueSearch}
                        onChange={(e) => setQueueSearch(e.target.value)}
                      />
                      <datalist id="doctor-queue-suggestions">
                        {Array.from(new Set(
                          (dashboardData?.today_appointments || []).map((appt: any) => appt.patient_name).filter(Boolean)
                        )).map((name: any) => (
                          <option key={name} value={name} />
                        ))}
                      </datalist>
                    </div>
                  </div>

                  {(() => {
                    const filteredAppts = [...(dashboardData?.today_appointments || [])]
                      .filter((appt: any) => appt.status && ["waiting", "checked_in", "in_consultation", "in consultation", "completed"].includes(appt.status.toLowerCase()))
                      .filter((appt: any) => !queueSearch || appt.patient_name?.toLowerCase().includes(queueSearch.toLowerCase()))
                      .sort((a: any, b: any) => new Date(b.appointment_datetime).getTime() - new Date(a.appointment_datetime).getTime());

                    if (filteredAppts.length === 0) {
                      return (
                        <div style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--doc-border)' }}>
                          <p style={{ color: 'var(--doc-text-muted)', fontSize: '0.9rem', margin: 0 }}>
                            {queueSearch ? 'No matching patients found in queue.' : 'No patients scheduled in the queue for today.'}
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '24px' }}>
                        {filteredAppts.map((appt: any, idx: number) => {
                          const initials = appt.patient_name
                            ? appt.patient_name.split(' ').map((n: string) => n[0]).join('').toUpperCase()
                            : 'PT';
                          const timeStr = appt.appointment_datetime
                            ? formatTime(appt.appointment_datetime)
                            : '10:00 AM';
                          const apptNum = `APT-2847${idx + 1}`;
                          const statusLower = appt.status.toLowerCase();
                          const isCompleted = statusLower === 'completed';
                          const isInConsultation = statusLower === 'in_consultation' || statusLower === 'in consultation';
                          
                          // Status badge colors
                          let badgeBg = '#eff6ff';
                          let badgeText = '#1d4ed8';
                          let badgeLabel = 'Confirmed';
                          
                          if (statusLower === 'waiting' || statusLower === 'pending' || statusLower === 'checked_in') {
                            badgeBg = '#fff7ed';
                            badgeText = '#ea580c';
                            badgeLabel = statusLower === 'checked_in' ? 'Checked In' : 'Waiting';
                          } else if (isInConsultation) {
                            badgeBg = '#eff6ff';
                            badgeText = '#2563eb';
                            badgeLabel = 'In Consultation';
                          } else if (isCompleted) {
                            badgeBg = '#f0fdf4';
                            badgeText = '#16a34a';
                            badgeLabel = 'Completed';
                          }
                          
                          const colors = [
                            { bg: '#e0f2fe', text: '#0369a1' },
                            { bg: '#fef3c7', text: '#d97706' },
                            { bg: '#f0fdf4', text: '#15803d' },
                            { bg: '#fdf2f8', text: '#be185d' },
                            { bg: '#faf5ff', text: '#7e22ce' }
                          ];
                          const color = colors[idx % colors.length];

                          return (
                            <div key={appt.id || idx} className="doc-card" style={{ 
                              margin: 0, 
                              padding: '24px', 
                              display: 'flex', 
                              flexDirection: 'column', 
                              gap: '16px', 
                              justifyContent: 'space-between',
                              opacity: isCompleted ? 0.8 : 1,
                              borderLeft: isCompleted ? '4px solid #22c55e' : isInConsultation ? '4px solid #3b82f6' : '4px solid transparent'
                            }}>
                              {/* Card Header */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <div style={{ 
                                    width: '44px', 
                                    height: '44px', 
                                    borderRadius: '50%', 
                                    backgroundColor: color.bg, 
                                    color: color.text, 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center', 
                                    fontWeight: '700',
                                    fontSize: '0.95rem'
                                  }}>
                                    {initials}
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--doc-text-dark)' }}>{appt.patient_name}</span>
                                      {appt.tele_status === 'patient_ready' && (
                                        <span style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '1px 6px', borderRadius: '10px', fontSize: '0.65rem', fontWeight: '800', border: '1px solid #bbf7d0', whiteSpace: 'nowrap' }}>
                                          Ready
                                        </span>
                                      )}
                                    </div>
                                    <span style={{ fontSize: '0.78rem', color: 'var(--doc-text-muted)' }}>
                                      {appt.patient_code || 'PT-10234'} · {appt.treatment_type}
                                    </span>
                                  </div>
                                </div>
                                <span style={{ 
                                  backgroundColor: badgeBg, 
                                  color: badgeText, 
                                  padding: '4px 10px', 
                                  borderRadius: '20px', 
                                  fontSize: '0.72rem', 
                                  fontWeight: '700', 
                                  display: 'inline-flex', 
                                  alignItems: 'center', 
                                  gap: '4px' 
                                }}>
                                  <span style={{ width: '5px', height: '5px', backgroundColor: badgeText, borderRadius: '50%' }} />
                                  {badgeLabel}
                                </span>
                              </div>

                              {/* Card Divider */}
                              <div style={{ borderBottom: '1px solid var(--doc-border)' }} />

                              {/* Card Body */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span style={{ color: 'var(--doc-text-muted)' }}>Time</span>
                                  <span style={{ fontWeight: '700', color: 'var(--doc-text-dark)' }}>{timeStr}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span style={{ color: 'var(--doc-text-muted)' }}>Appointment</span>
                                  <span style={{ fontWeight: '700', color: 'var(--doc-primary)', fontFamily: 'monospace' }}>{apptNum}</span>
                                </div>
                              </div>

                              {/* Card Footer Button */}
                              <div style={{ display: 'flex', gap: '8px' }}>
                                {isCompleted ? (
                                  <button
                                    type="button"
                                    className="doc-btn-secondary"
                                    style={{
                                      flex: 1,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '8px',
                                      height: '40px',
                                      fontSize: '0.85rem',
                                      fontWeight: '600',
                                      backgroundColor: '#f0fdf4',
                                      color: '#16a34a',
                                      borderColor: '#bbf7d0',
                                      cursor: 'pointer'
                                    }}
                                    onClick={() => handleViewHistory({ id: appt.patient_id, user: { full_name: appt.patient_name }, patient_code: appt.patient_code })}
                                  >
                                    <FolderOpen size={16} /> View History
                                  </button>
                                ) : (
                                  <button 
                                    onClick={() => handleStartConsultation(appt)} 
                                    className="doc-btn-primary" 
                                    style={{ 
                                      flex: 1, 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      justifyContent: 'center', 
                                      gap: '8px', 
                                      height: '40px',
                                      fontSize: '0.85rem',
                                      fontWeight: '600',
                                      backgroundColor: 'var(--doc-primary)',
                                      color: '#ffffff',
                                      borderColor: 'var(--doc-primary)',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    <Stethoscope size={16} /> {isInConsultation ? 'Resume Consultation' : 'Start Consultation'}
                                  </button>
                                )}
                                
                                {appt.consultation_type === 'teleconsultation' && !isCompleted && (
                                   <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flex: 1 }}>
                                     {appt.tele_status === 'patient_ready' && (
                                       <span style={{ 
                                         display: 'inline-flex', 
                                         alignItems: 'center', 
                                         gap: '4px', 
                                         fontSize: '0.7rem', 
                                         color: '#10b981', 
                                         fontWeight: '700',
                                         backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                         padding: '2px 8px',
                                         borderRadius: '12px',
                                         border: '1px solid rgba(16, 185, 129, 0.2)',
                                         marginBottom: '2px',
                                         animation: 'pulse-badge 2s infinite'
                                       }}>
                                         <style>{`
                                           @keyframes pulse-badge {
                                             0% { opacity: 0.8; }
                                             50% { opacity: 1; transform: scale(1.02); }
                                             100% { opacity: 0.8; }
                                           }
                                         `}</style>
                                         <span style={{ width: '6px', height: '6px', backgroundColor: '#10b981', borderRadius: '50%' }} />
                                         Patient Ready
                                       </span>
                                     )}
                                     <button 
                                       onClick={() => handleJoinVideo(appt)} 
                                       className="doc-btn-primary" 
                                       style={{ 
                                         width: '100%',
                                         padding: '0 14px',
                                         height: '40px',
                                         display: 'inline-flex', 
                                         alignItems: 'center', 
                                         justifyContent: 'center', 
                                         gap: '6px',
                                         backgroundColor: appt.tele_status === 'patient_ready' ? '#10b981' : '#0284c7',
                                         color: '#ffffff',
                                         fontWeight: '600',
                                         fontSize: '0.85rem',
                                         borderRadius: '8px',
                                         cursor: 'pointer',
                                         border: 'none',
                                         boxShadow: appt.tele_status === 'patient_ready' ? '0 0 12px rgba(16, 185, 129, 0.4)' : '0 2px 6px rgba(2, 132, 199, 0.25)',
                                         transition: 'all 0.3s ease'
                                       }}
                                       title="Join Teleconsultation Video Call"
                                     >
                                       <Video size={16} /> Join Video Call
                                     </button>
                                   </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* TAB: AVAILABILITY SETTINGS MANAGER */}
              {activeTab === 'availability' && (
                <div style={{ maxWidth: '800px', margin: '0 auto' }}>
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
                      Your clinical timing parameters are locked for patient scheduling safety. If you need to make changes to your lunch break, teleconsultation window, shift timing, or take leaves, please click <strong>Request Schedule Change</strong> to ask the clinic admin for approval.
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
                        <Plus size={16} /> Request Schedule Change
                      </button>
                    </div>
                  </div>

                  {/* Read-only availability parameters */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '24px' }}>
                    
                    {/* Working Hours Card */}
                    <div className="doc-card" style={{ 
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
                        <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#15803d', letterSpacing: '-0.5px' }}>{shiftStart} - {shiftEnd}</div>
                      </div>
                    </div>

                    {/* Operational Breaks Card */}
                    <div className="doc-card" style={{ 
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
                        <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#b45309', letterSpacing: '-0.5px' }}>{lunchStart} - {lunchEnd}</div>
                      </div>
                    </div>

                    {/* Teleconsultation Window Card */}
                    <div className="doc-card" style={{ 
                      padding: '24px', 
                      marginBottom: 0, 
                      borderRadius: '16px', 
                      background: 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)', 
                      border: '1px solid #bae6fd',
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
                          backgroundColor: '#e0f2fe', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center' 
                        }}>
                          <Video size={20} color="#0284c7" />
                        </div>
                        <span style={{ fontSize: '1rem', fontWeight: '700', color: '#0c4a6e' }}>Teleconsultation</span>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.8rem', color: '#075985', fontWeight: '500', marginBottom: '4px' }}>Video Call Hours</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0369a1', letterSpacing: '-0.5px' }}>{teleStart} - {teleEnd}</div>
                      </div>
                    </div>
                  </div>


                  {/* Change Requests History */}
                  <div className="doc-card" style={{ padding: '24px' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--doc-text-dark)', marginBottom: '12px' }}>
                      Change Requests History
                    </h3>
                    {myRequests.length === 0 ? (
                      <p style={{ fontSize: '0.85rem', color: 'var(--doc-text-muted)', margin: 0 }}>You have not submitted any availability change requests yet.</p>
                    ) : (
                      <div className="doc-table-container" style={{ margin: 0 }}>
                        <table className="doc-table">
                          <thead>
                            <tr>
                              <th>Type</th>
                              <th>Proposed Changes</th>
                              <th>Reason</th>
                              <th>Status</th>
                              <th>Response Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {myRequests.map((req: any) => {
                              let propStr = '';
                              if (req.request_type === 'leave') {
                                propStr = `${req.proposed_start_date} to ${req.proposed_end_date}`;
                              } else {
                                propStr = `${req.proposed_start_time} - ${req.proposed_end_time}`;
                              }
                              return (
                                <tr key={req.id}>
                                  <td style={{ textTransform: 'capitalize', fontWeight: '600' }}>{req.request_type.replace('_', ' ')}</td>
                                  <td>{propStr}</td>
                                  <td style={{ fontSize: '0.82rem', whiteSpace: 'normal', maxWidth: '200px' }}>{req.reason}</td>
                                  <td>
                                    <span style={{
                                      display: 'inline-block',
                                      padding: '2px 8px',
                                      borderRadius: '4px',
                                      fontSize: '0.75rem',
                                      fontWeight: '700',
                                      textTransform: 'uppercase',
                                      backgroundColor: req.status === 'approved' ? '#dcfce7' : req.status === 'rejected' ? '#fee2e2' : '#fef9c3',
                                      color: req.status === 'approved' ? '#15803d' : req.status === 'rejected' ? '#b91c1c' : '#854d0e'
                                    }}>
                                      {req.status}
                                    </span>
                                  </td>
                                  <td style={{ fontSize: '0.82rem', color: 'var(--doc-text-muted)', whiteSpace: 'normal', maxWidth: '150px' }}>
                                    {req.status === 'rejected' && req.rejection_reason ? req.rejection_reason : '-'}
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

              {/* TAB: PROFILE */}
              {activeTab === 'profile' && (
                <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                  {/* Top Banner Accent */}
                  <div style={{
                    background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)',
                    color: '#ffffff',
                    padding: '28px 32px',
                    borderRadius: '12px',
                    marginBottom: '24px',
                    boxShadow: '0 4px 12px rgba(15, 118, 110, 0.08)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <User size={24} /> Doctor Profile Workspace
                      </h2>
                      <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem', color: '#ccfbf1', opacity: 0.9 }}>
                        Manage your professional credentials, registration details, and contact profile.
                      </p>
                    </div>
                    <div>
                      {!isEditingProfile ? (
                        <button
                          onClick={() => setIsEditingProfile(true)}
                          className="doc-btn-primary"
                          style={{ padding: '10px 20px', fontSize: '0.88rem', backgroundColor: '#ffffff', color: '#0f766e', border: '1px solid #ffffff' }}
                        >
                          ✏️ Edit Profile
                        </button>
                      ) : (
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button
                            onClick={() => {
                              setIsEditingProfile(false);
                              if (dashboardData?.doctor) {
                                const doc = dashboardData.doctor;
                                setProfileForm({
                                  full_name: doc.full_name || '',
                                  phone: doc.phone || '',
                                  avatar_url: doc.avatar_url || '',
                                  specialization: doc.specialization || '',
                                  qualification: doc.qualification || '',
                                  experience_years: doc.experience_years || 0,
                                  consultation_fee: doc.consultation_fee || 0.0,
                                  bio: doc.bio || '',
                                  registration_number: doc.registration_number || ''
                                });
                              }
                            }}
                            className="doc-btn-secondary"
                            style={{ padding: '10px 18px', fontSize: '0.88rem', border: '1px solid rgba(255,255,255,0.4)', backgroundColor: 'transparent', color: '#ffffff' }}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSaveDoctorProfile}
                            className="doc-btn-primary"
                            style={{ padding: '10px 18px', fontSize: '0.88rem', backgroundColor: '#14b8a6', color: '#ffffff', border: 'none' }}
                          >
                            Save Changes
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '24px' }}>
                    {/* Left Column: Photo Upload Card */}
                    <div className="doc-card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 20px' }}>
                      <h4 style={{ margin: '0 0 16px 0', fontSize: '0.9rem', color: 'var(--doc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Profile Picture
                      </h4>
                      <div 
                        style={{ 
                          position: 'relative', 
                          width: '130px', 
                          height: '130px', 
                          borderRadius: '50%', 
                          border: '4px solid #f1f5f9', 
                          overflow: 'hidden', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          backgroundColor: '#e2e8f0', 
                          marginBottom: '16px',
                          cursor: 'pointer',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                        }}
                        onClick={() => document.getElementById('doctor-avatar-upload')?.click()}
                        title="Click to upload profile photo"
                      >
                        {profileForm.avatar_url ? (
                          <img src={profileForm.avatar_url} alt="Doctor" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: '2.5rem', fontWeight: 700, color: '#475569' }}>
                            {profileForm.full_name ? profileForm.full_name.split(' ').map((n: string) => n[0]).join('') : 'DR'}
                          </span>
                        )}
                        <div 
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: 'rgba(15, 23, 42, 0.6)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            opacity: profileForm.avatar_url ? 0 : 0.8,
                            transition: 'opacity 0.2s',
                            fontSize: '0.75rem',
                            fontWeight: 600
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                          onMouseLeave={(e) => e.currentTarget.style.opacity = profileForm.avatar_url ? '0' : '0.8'}
                        >
                          <Camera size={20} style={{ marginBottom: '4px' }} />
                          {profileForm.avatar_url ? 'Change Photo' : 'Add Photo'}
                        </div>
                        {isUploadingAvatar && (
                          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', fontSize: '0.75rem', fontWeight: 600 }}>
                            Uploading...
                          </div>
                        )}
                      </div>

                      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label
                          htmlFor="doctor-avatar-upload"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            width: '100%',
                            padding: '8px 12px',
                            backgroundColor: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            color: '#334155',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          <Camera size={14} /> {profileForm.avatar_url ? 'Change Photo' : 'Upload Photo'}
                        </label>

                        {profileForm.avatar_url && (
                          <button
                            type="button"
                            onClick={handleRemoveAvatar}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              width: '100%',
                              padding: '7px 12px',
                              backgroundColor: '#fff1f2',
                              border: '1px solid #fecdd3',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              color: '#e11d48',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                          >
                            <Trash2 size={13} /> Remove Photo
                          </button>
                        )}

                        <input
                          type="file"
                          id="doctor-avatar-upload"
                          accept="image/*"
                          onChange={handleAvatarUpload}
                          style={{ display: 'none' }}
                        />
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.72rem', color: 'var(--doc-text-muted)' }}>
                          Supports JPG, PNG (Max 5MB)
                        </p>
                      </div>
                    </div>

                    {/* Right Column: Profile Form Details Card */}
                    <div className="doc-card">
                      <h3 style={{ margin: '0 0 20px 0', fontSize: '1.05rem', fontWeight: 700, color: 'var(--doc-text-dark)', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                        Credentials & General Information
                      </h3>

                      <form onSubmit={handleSaveDoctorProfile} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div>
                          <label className="doc-form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b' }}>Full Name</label>
                          {isEditingProfile ? (
                            <input
                              type="text"
                              value={profileForm.full_name}
                              onChange={e => setProfileForm({ ...profileForm, full_name: e.target.value })}
                              className="doc-input"
                              style={{ marginTop: '6px' }}
                            />
                          ) : (
                            <div className="doc-input" style={{ backgroundColor: '#f8fafc', fontWeight: 600, marginTop: '6px' }}>{profileForm.full_name || 'N/A'}</div>
                          )}
                        </div>

                        <div>
                          <label className="doc-form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b' }}>Registration Number</label>
                          {isEditingProfile ? (
                            <input
                              type="text"
                              value={profileForm.registration_number}
                              onChange={e => setProfileForm({ ...profileForm, registration_number: e.target.value })}
                              className="doc-input"
                              style={{ marginTop: '6px' }}
                            />
                          ) : (
                            <div className="doc-input" style={{ backgroundColor: '#f8fafc', fontFamily: 'monospace', fontWeight: 600, marginTop: '6px' }}>{profileForm.registration_number || 'N/A'}</div>
                          )}
                        </div>

                        <div>
                          <label className="doc-form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b' }}>Primary Specialization</label>
                          {isEditingProfile ? (
                            <input
                              type="text"
                              value={profileForm.specialization}
                              onChange={e => setProfileForm({ ...profileForm, specialization: e.target.value })}
                              className="doc-input"
                              style={{ marginTop: '6px' }}
                            />
                          ) : (
                            <div className="doc-input" style={{ backgroundColor: '#f8fafc', marginTop: '6px' }}>{profileForm.specialization || 'N/A'}</div>
                          )}
                        </div>

                        <div>
                          <label className="doc-form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b' }}>Qualifications</label>
                          {isEditingProfile ? (
                            <input
                              type="text"
                              value={profileForm.qualification}
                              onChange={e => setProfileForm({ ...profileForm, qualification: e.target.value })}
                              className="doc-input"
                              style={{ marginTop: '6px' }}
                              placeholder="e.g. BDS, MDS (Oral Surgery)"
                            />
                          ) : (
                            <div className="doc-input" style={{ backgroundColor: '#f8fafc', marginTop: '6px' }}>{profileForm.qualification || 'N/A'}</div>
                          )}
                        </div>

                        <div>
                          <label className="doc-form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b' }}>Experience (Years)</label>
                          {isEditingProfile ? (
                            <input
                              type="number"
                              value={profileForm.experience_years}
                              onChange={e => setProfileForm({ ...profileForm, experience_years: parseInt(e.target.value) || 0 })}
                              className="doc-input"
                              style={{ marginTop: '6px' }}
                            />
                          ) : (
                            <div className="doc-input" style={{ backgroundColor: '#f8fafc', marginTop: '6px' }}>{profileForm.experience_years ?? 0} Years</div>
                          )}
                        </div>

                        <div>
                          <label className="doc-form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b' }}>Consultation Fee (₹)</label>
                          {isEditingProfile ? (
                            <input
                              type="number"
                              value={profileForm.consultation_fee}
                              onChange={e => setProfileForm({ ...profileForm, consultation_fee: parseFloat(e.target.value) || 0.0 })}
                              className="doc-input"
                              style={{ marginTop: '6px' }}
                            />
                          ) : (
                            <div className="doc-input" style={{ backgroundColor: '#f8fafc', marginTop: '6px' }}>₹{profileForm.consultation_fee ?? '0.00'}</div>
                          )}
                        </div>

                        <div>
                          <label className="doc-form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b' }}>Email Address</label>
                          <div className="doc-input" style={{ backgroundColor: '#f8fafc', marginTop: '6px', color: '#64748b' }}>{profileForm.email || 'N/A'}</div>
                        </div>

                        <div>
                          <label className="doc-form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b' }}>Contact Phone</label>
                          {isEditingProfile ? (
                            <input
                              type="text"
                              value={profileForm.phone}
                              onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
                              className="doc-input"
                              style={{ marginTop: '6px' }}
                            />
                          ) : (
                            <div className="doc-input" style={{ backgroundColor: '#f8fafc', marginTop: '6px' }}>{profileForm.phone || 'N/A'}</div>
                          )}
                        </div>

                        <div style={{ gridColumn: '1 / -1' }}>
                          <label className="doc-form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b' }}>Professional Biography</label>
                          {isEditingProfile ? (
                            <textarea
                              rows={3}
                              value={profileForm.bio}
                              onChange={e => setProfileForm({ ...profileForm, bio: e.target.value })}
                              className="doc-textarea"
                              style={{ marginTop: '6px', resize: 'vertical' }}
                              placeholder="Write a brief professional description..."
                            />
                          ) : (
                            <div className="doc-textarea" style={{ backgroundColor: '#f8fafc', marginTop: '6px', minHeight: '80px', whiteSpace: 'pre-wrap' }}>{profileForm.bio || 'No biography recorded.'}</div>
                          )}
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: PATIENTS (CONSULTATION VIEW) */}
              {activeTab === 'patients' && (
                <>
                  {!selectedPatientHistory ? (
                    <div className="doc-card">
                      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                          <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--doc-text-muted)' }} size={16} />
                          <input 
                            type="text" 
                            className="doc-input" 
                            style={{ paddingLeft: '36px' }}
                            placeholder="Search patients by name, code, or phone number..."
                            list="doctor-patients-suggestions"
                            value={patientSearch}
                            onChange={(e) => handleSearchPatients(e.target.value)}
                          />
                          <datalist id="doctor-patients-suggestions">
                            {Array.from(new Set(
                              (patientsList || []).map((pat: any) => pat.user?.full_name || pat.name).filter(Boolean)
                            )).map((name: any) => (
                              <option key={name} value={name} />
                            ))}
                          </datalist>
                        </div>
                      </div>

                      <div className="doc-table-container">
                        <table className="doc-table">
                          <thead>
                            <tr>
                              <th>Patient Code</th>
                              <th>Patient Name</th>
                              <th>Phone Number</th>
                              <th>Date of Birth</th>
                              <th>Gender</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {patientsList.length === 0 ? (
                              <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: '20px' }}>
                                  {patientSearch ? 'No matching patient profiles found.' : 'Search patient files above.'}
                                </td>
                              </tr>
                            ) : (
                              patientsList.map((pat) => (
                                <tr key={pat.id}>
                                  <td style={{ fontFamily: 'monospace' }}>{pat.patient_code}</td>
                                  <td style={{ fontWeight: '600' }}>{pat.user?.full_name}</td>
                                  <td>{pat.user?.phone}</td>
                                  <td>{pat.date_of_birth || 'N/A'}</td>
                                  <td style={{ textTransform: 'capitalize' }}>{pat.gender || 'N/A'}</td>
                                  <td>
                                    <button 
                                      onClick={() => handleViewHistory(pat)} 
                                      className="doc-btn-primary"
                                    >
                                      Open Case History
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="doc-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--doc-border)', paddingBottom: '12px', marginBottom: '20px' }}>
                        <div>
                          <h2 style={{ fontSize: '1.2rem', fontWeight: '700', margin: 0 }}>
                            Case File: {selectedPatientHistory.patient?.user?.full_name}
                          </h2>
                          <span style={{ fontSize: '0.8rem', color: 'var(--doc-text-muted)' }}>
                            Patient Code: {selectedPatientHistory.patient?.patient_code} | Phone: {selectedPatientHistory.patient?.user?.phone}
                          </span>
                        </div>
                        <button onClick={() => setSelectedPatientHistory(null)} className="doc-btn-secondary">
                          Back to Search
                        </button>
                      </div>

                      {loadingHistory ? (
                        <div style={{ textAlign: 'center', padding: '30px' }}>Loading patient health cards...</div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
                          {/* Consultations */}
                          <div>
                            <h3 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '12px' }}>Clinical Timeline</h3>
                            {selectedPatientHistory.consultations?.length === 0 ? (
                              <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '6px', fontSize: '0.88rem', color: 'var(--doc-text-muted)' }}>
                                No previous consultations found.
                              </div>
                            ) : (
                              selectedPatientHistory.consultations.map((c: any) => (
                                <div key={c.id} style={{ border: '1px solid var(--doc-border)', padding: '16px', borderRadius: '8px', marginBottom: '12px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--doc-primary)' }}>
                                      {new Date(c.consultation_datetime).toLocaleDateString()}
                                    </span>
                                    <span style={{ fontSize: '0.78rem', color: 'var(--doc-text-muted)' }}>
                                      BP: {c.vitals_bp || 'N/A'} | Pulse: {c.vitals_pulse || 'N/A'} bpm
                                    </span>
                                  </div>
                                  <h4 style={{ fontSize: '0.88rem', fontWeight: '700', margin: '4px 0' }}>Diagnosis: {c.diagnosis}</h4>
                                  <p style={{ fontSize: '0.82rem', margin: '4px 0' }}><strong>Symptoms:</strong> {c.symptoms}</p>
                                  {c.notes && <p style={{ fontSize: '0.82rem', margin: '4px 0', color: 'var(--doc-text-muted)' }}><strong>Advice:</strong> {c.notes}</p>}
                                </div>
                              ))
                            )}
                          </div>

                          {/* Prescriptions */}
                          <div>
                            <h3 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '12px' }}>Prescribed Drugs</h3>
                            {selectedPatientHistory.prescriptions?.length === 0 ? (
                              <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '6px', fontSize: '0.88rem', color: 'var(--doc-text-muted)' }}>
                                No prescription logs found.
                              </div>
                            ) : (
                              selectedPatientHistory.prescriptions.map((p: any) => (
                                <div key={p.id} style={{ border: '1px solid var(--doc-border)', padding: '16px', borderRadius: '8px', marginBottom: '12px' }}>
                                  <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--doc-primary)' }}>
                                    {new Date(p.created_at).toLocaleDateString()}
                                  </span>
                                  <ul style={{ paddingLeft: '18px', margin: '8px 0', fontSize: '0.82rem' }}>
                                    {p.items?.map((item: any) => (
                                      <li key={item.id} style={{ marginBottom: '4px' }}>
                                        <strong>{item.medicine_name}</strong> - {item.dosage} ({item.duration})
                                        {item.instructions && <div style={{ fontSize: '0.75rem', color: 'var(--doc-text-muted)' }}>{item.instructions}</div>}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* TAB: PRESCRIPTIONS */}
              {activeTab === 'prescriptions' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
                  <div className="doc-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                      <h2 className="doc-card-title" style={{ margin: 0 }}>Prescription Logs</h2>
                      <div style={{ position: 'relative', width: '220px' }}>
                        <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--doc-text-muted)' }} />
                        <input 
                          type="text" 
                          className="doc-input" 
                          style={{ paddingLeft: '32px', height: '32px', fontSize: '0.8rem', marginBottom: 0 }}
                          placeholder="Search patient name..." 
                          list="doctor-prescriptions-suggestions"
                          value={prescriptionSearch}
                          onChange={(e) => setPrescriptionSearch(e.target.value)}
                        />
                        <datalist id="doctor-prescriptions-suggestions">
                          {Array.from(new Set(
                            (allPrescriptions || []).map((p: any) => p.patient_name || p.patient?.user?.full_name).filter(Boolean)
                          )).map((name: any) => (
                            <option key={name} value={name} />
                          ))}
                        </datalist>
                      </div>
                    </div>

                    {loadingPrescriptions ? (
                      <div style={{ textAlign: 'center', padding: '20px' }}>Loading prescriptions...</div>
                    ) : (
                      <div className="doc-table-container">
                        <table className="doc-table">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Patient</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {allPrescriptions
                              .filter(p => !prescriptionSearch || p.patient_name?.toLowerCase().includes(prescriptionSearch.toLowerCase()))
                              .map(p => (
                                <tr key={p.id} style={{ cursor: 'pointer', backgroundColor: selectedPrescription?.id === p.id ? '#f0fdf4' : '' }} onClick={() => setSelectedPrescription(p)}>
                                  <td>{new Date(p.created_at).toLocaleDateString()}</td>
                                  <td style={{ fontWeight: '600' }}>{p.patient_name || 'Walk-in Patient'}</td>
                                  <td>
                                    <button className="doc-btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={(e) => { e.stopPropagation(); setSelectedPrescription(p); }}>
                                      View Rx
                                    </button>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div>
                    {selectedPrescription ? (
                      <div className="rx-preview">
                        <div className="rx-header">
                          <div className="rx-clinic-title">
                            Vertical Clinic<br />
                            <span style={{ fontSize: '0.7rem', color: 'var(--doc-text-muted)', fontWeight: 500 }}>302 Satellite, Ahmedabad</span>
                          </div>
                          <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--doc-text-muted)' }}>
                            <strong>GSTIN:</strong> 24AAACV1209D1Z4<br />
                            <strong>Rx ID:</strong> {selectedPrescription.id.substring(0, 8)}
                          </div>
                        </div>

                        <div className="rx-meta-row">
                          <div className="rx-meta-block">
                            <span className="rx-meta-label">Patient Name</span>
                            <span className="rx-meta-val">{selectedPrescription.patient_name || 'N/A'}</span>
                          </div>
                          <div className="rx-meta-block">
                            <span className="rx-meta-label">Date</span>
                            <span className="rx-meta-val">{new Date(selectedPrescription.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>

                        <table className="rx-table">
                          <thead>
                            <tr>
                              <th>Medicine</th>
                              <th>Dosage</th>
                              <th>Duration</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedPrescription.items?.map((item: any, idx: number) => (
                              <tr key={idx}>
                                <td style={{ fontWeight: 600 }}>{item.medicine_name}</td>
                                <td>{item.dosage}</td>
                                <td>{item.duration}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '30px' }}>
                          <div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--doc-text-muted)', display: 'block' }}>RE-VISIT DATE</span>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>As advised by doctor</span>
                          </div>
                          <div style={{ textAlign: 'center', borderTop: '1px solid #cbd5e1', width: '120px', paddingTop: '4px' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--doc-primary)', display: 'block' }}>DIGITALLY SIGNED</span>
                            <span style={{ fontSize: '0.65rem', color: 'var(--doc-text-muted)' }}>{formatDocName(doctorName)}</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
                          <button 
                            onClick={() => handleOpenEditPrescription(selectedPrescription)} 
                            className="doc-btn-secondary" 
                            style={{ padding: '8px 14px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#f0fdf4', color: '#16a34a', borderColor: '#bbf7d0', cursor: 'pointer', fontWeight: 600 }}
                          >
                            <Edit3 size={14} /> Edit Prescription
                          </button>
                          <button onClick={() => downloadPdf(selectedPrescription.id)} className="doc-btn-primary" style={{ flex: 1, padding: '8px', fontSize: '0.8rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
                            <FileText size={14} /> Download PDF
                          </button>
                          <button onClick={() => window.print()} className="doc-btn-secondary" style={{ padding: '8px 12px', fontSize: '0.8rem' }}>
                            Print
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="doc-card" style={{ textAlign: 'center', padding: '40px', color: 'var(--doc-text-muted)' }}>
                        <FileText size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                        <p style={{ margin: 0 }}>Select a prescription log from the list to preview the digital Rx receipt sheet.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB: TREATMENT PLANS */}
              {activeTab === 'treatment' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '24px' }}>
                  <div className="doc-card">
                    <h3 className="doc-card-title" style={{ marginBottom: '16px' }}>Select Patient</h3>
                    <div className="doc-form-group">
                      <label className="doc-form-label">Patient</label>
                      <select 
                        className="doc-input" 
                        value={treatmentPatientId} 
                        onChange={(e) => {
                          setTreatmentPatientId(e.target.value);
                          fetchPatientTreatmentPlan(e.target.value);
                        }}
                      >
                        <option value="">-- Choose Patient --</option>
                        {allPatients.map((pat) => (
                          <option key={pat.id} value={pat.id}>
                            {pat.user?.full_name} ({pat.patient_code})
                          </option>
                        ))}
                      </select>
                    </div>

                    {!activePlan && treatmentPatientId && !loadingPlan && (
                      <div style={{ padding: '16px', backgroundColor: '#f0fdf4', border: '1px dashed #22c55e', borderRadius: '8px', textAlign: 'center' }}>
                        <p style={{ fontSize: '0.85rem', margin: '0 0 12px 0' }}>No active treatment plan found for this patient.</p>
                        <button 
                          className="doc-btn-primary" 
                          style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                          onClick={() => handleCreateTreatmentPlan(treatmentPatientId, 'Comprehensive Dental Plan', 'Generated from doctor clinical panel')}
                        >
                          Initiate Plan
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    {loadingPlan ? (
                      <div className="doc-card" style={{ textAlign: 'center', padding: '40px' }}>Loading treatment plan...</div>
                    ) : activePlan ? (
                      <div className="doc-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                          <div>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0, color: 'var(--doc-primary)' }}>{activePlan.title}</h3>
                             <span style={{ fontSize: '0.78rem', color: 'var(--doc-text-muted)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                               Status: 
                               <strong style={{ 
                                 color: activePlan.status?.toLowerCase() === 'completed' ? '#047857' : activePlan.status?.toLowerCase() === 'cancelled' ? '#b91c1c' : '#0d9488',
                                 backgroundColor: activePlan.status?.toLowerCase() === 'completed' ? '#d1fae5' : activePlan.status?.toLowerCase() === 'cancelled' ? '#fee2e2' : '#ccfbf1',
                                 padding: '2px 8px',
                                 borderRadius: '4px',
                                 fontSize: '0.75rem',
                                 fontWeight: 800,
                                 letterSpacing: '0.5px'
                               }}>
                                 {activePlan.status?.toLowerCase() === 'completed' ? '✓ COMPLETED' : activePlan.status?.toUpperCase()}
                               </strong>
                             </span>
                          </div>
                          <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--doc-text-dark)' }}>
                            Total: ₹{activePlan.total_cost}
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div style={{ marginBottom: '24px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: '600', marginBottom: '4px' }}>
                            <span>Treatment Progress</span>
                            <span>
                              {Math.round(
                                (activePlan.procedures?.filter((p: any) => p.status === 'completed').length / 
                                (activePlan.procedures?.length || 1)) * 100
                              )}%
                            </span>
                          </div>
                          <div className="progress-bar-container">
                            <div 
                              className="progress-bar-fill" 
                              style={{ 
                                width: `${
                                  (activePlan.procedures?.filter((p: any) => p.status === 'completed').length / 
                                  (activePlan.procedures?.length || 1)) * 100
                                }%` 
                              }} 
                            />
                          </div>
                        </div>

                        {/* Procedures Table */}
                        <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--doc-text-muted)', marginBottom: '10px' }}>Procedures</h4>
                        <div className="doc-table-container" style={{ marginBottom: '24px' }}>
                          <table className="doc-table">
                            <thead>
                              <tr>
                                <th>Procedure</th>
                                <th>Cost</th>
                                <th>Status</th>
                                <th>Notes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {activePlan.procedures?.length === 0 ? (
                                <tr>
                                  <td colSpan={4} style={{ textAlign: 'center', padding: '16px', color: 'var(--doc-text-muted)' }}>No procedures scheduled. Add one below.</td>
                                </tr>
                              ) : (
                                activePlan.procedures.map((proc: any, idx: number) => (
                                  <tr key={idx}>
                                    <td style={{ fontWeight: '600' }}>{proc.procedure_name}</td>
                                    <td>₹{proc.cost}</td>
                                    <td>
                                      <select 
                                        value={proc.status} 
                                        className="doc-input" 
                                        style={{ height: '28px', padding: '0 4px', fontSize: '0.75rem', marginBottom: 0 }}
                                        onChange={(e) => handleUpdateProcedureStatus(idx, e.target.value)}
                                      >
                                        <option value="planned">Planned</option>
                                        <option value="in_progress">In Progress</option>
                                        <option value="completed">Completed</option>
                                        <option value="cancelled">Cancelled</option>
                                      </select>
                                    </td>
                                    <td style={{ fontSize: '0.75rem', color: 'var(--doc-text-muted)' }}>{proc.notes || '-'}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>

                        {/* Add Procedure Form */}
                        <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--doc-text-muted)', marginBottom: '10px' }}>Add Scheduled Procedure</h4>
                        <form onSubmit={handleAddProcedure} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 1.2fr 80px', gap: '10px', alignItems: 'flex-end' }}>
                          <div className="doc-form-group" style={{ marginBottom: 0 }}>
                            <label className="doc-form-label" style={{ fontSize: '0.7rem' }}>Procedure Name</label>
                            <input 
                              type="text" 
                              className="doc-input" 
                              style={{ height: '32px', fontSize: '0.8rem', padding: '4px 8px', marginBottom: 0 }} 
                              placeholder="e.g. Tooth Scaling"
                              value={newProcName}
                              onChange={(e) => setNewProcName(e.target.value)}
                              required
                            />
                          </div>
                          <div className="doc-form-group" style={{ marginBottom: 0 }}>
                            <label className="doc-form-label" style={{ fontSize: '0.7rem' }}>Cost (₹)</label>
                            <input 
                              type="number" 
                              className="doc-input" 
                              style={{ height: '32px', fontSize: '0.8rem', padding: '4px 8px', marginBottom: 0 }} 
                              placeholder="₹"
                              value={newProcCost || ''}
                              onChange={(e) => setNewProcCost(Number(e.target.value))}
                              required
                            />
                          </div>
                          <div className="doc-form-group" style={{ marginBottom: 0 }}>
                            <label className="doc-form-label" style={{ fontSize: '0.7rem' }}>Procedure Notes</label>
                            <input 
                              type="text" 
                              className="doc-input" 
                              style={{ height: '32px', fontSize: '0.8rem', padding: '4px 8px', marginBottom: 0 }} 
                              placeholder="e.g. Mandibular quadrant"
                              value={newProcNotes}
                              onChange={(e) => setNewProcNotes(e.target.value)}
                            />
                          </div>
                          <button type="submit" className="doc-btn-primary" style={{ height: '32px', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }} disabled={savingProcedure}>
                            <Plus size={16} /> Add
                          </button>
                        </form>
                      </div>
                    ) : (
                      <div className="doc-card" style={{ textAlign: 'center', padding: '40px', color: 'var(--doc-text-muted)' }}>
                        <Stethoscope size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                        <p style={{ margin: 0 }}>Choose a patient from the dropdown list to manage their medical treatment plan procedures.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB: FOLLOW-UP */}
              {activeTab === 'followup' && (
                <div className="doc-card" style={{ width: '100%' }}>
                  <h3 className="doc-card-title" style={{ marginBottom: '16px' }}>Upcoming Clinical Follow-ups</h3>
                  
                  <div style={{ marginBottom: '24px' }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--doc-text)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>📅</span> Booked Follow-ups ({bookedFollowups.length})
                    </h4>
                    <div className="doc-table-container">
                      <table className="doc-table">
                        <thead>
                          <tr>
                            <th>Patient</th>
                            <th>Scheduled Date</th>
                            <th>Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bookedFollowups.length === 0 ? (
                            <tr>
                              <td colSpan={3} style={{ textAlign: 'center', padding: '12px', color: 'var(--doc-text-muted)', fontSize: '0.85rem' }}>No booked follow-up appointments scheduled.</td>
                            </tr>
                          ) : (
                            bookedFollowups.map((f: any, idx: number) => (
                              <tr key={f.appointment_id || idx}>
                                <td style={{ fontWeight: '600' }}>{f.patient_name} ({f.patient_code})</td>
                                <td>{new Date(f.appointment_datetime).toLocaleDateString()} at {new Date(f.appointment_datetime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</td>
                                <td style={{ fontSize: '0.8rem', color: 'var(--doc-text-muted)' }}>{f.notes || '-'}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--doc-text)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>⏳</span> Advised & Pending Booking ({pendingFollowups.length})
                    </h4>
                    <div className="doc-table-container">
                      <table className="doc-table">
                        <thead>
                          <tr>
                            <th>Patient</th>
                            <th>Recommended By</th>
                            <th>Reason / Plan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pendingFollowups.length === 0 ? (
                            <tr>
                              <td colSpan={3} style={{ textAlign: 'center', padding: '12px', color: 'var(--doc-text-muted)', fontSize: '0.85rem' }}>No pending recommended follow-ups.</td>
                            </tr>
                          ) : (
                            pendingFollowups.map((f: any, idx: number) => (
                              <tr key={f.consultation_id || idx}>
                                <td style={{ fontWeight: '600' }}>{f.patient_name} ({f.patient_code})</td>
                                <td>{new Date(f.recommended_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                                <td style={{ fontSize: '0.8rem', color: 'var(--doc-text-muted)' }}>{f.treatment_type}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: IPD WARD ROUNDS */}
              {activeTab === 'ipd' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Header & Controls */}
                  <div className="doc-card" style={{ padding: '20px', marginBottom: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                      <div>
                        <h2 className="doc-card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Bed size={22} style={{ color: '#0d9488' }} /> In-Patient (IPD) Ward Rounds
                        </h2>
                        <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: '#64748b' }}>
                          Monitor live occupied beds, review clinical vitals & MAC medication logs, and record daily doctor round progress notes.
                        </p>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ position: 'relative', width: '240px' }}>
                          <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                          <input
                            type="text"
                            className="doc-input"
                            style={{ height: '36px', paddingLeft: '32px', fontSize: '0.84rem', width: '100%', margin: 0 }}
                            placeholder="Search patient / bed..."
                            value={ipdSearchQuery}
                            onChange={(e) => setIpdSearchQuery(e.target.value)}
                          />
                        </div>

                        <button
                          type="button"
                          className="doc-btn-secondary"
                          onClick={fetchIpdBeds}
                          style={{ height: '36px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem' }}
                        >
                          <RefreshCw size={15} className={loadingIpdBeds ? 'spin-animation' : ''} /> Refresh Wards
                        </button>
                      </div>
                    </div>

                    {/* Category Filter Pills */}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '16px', borderTop: '1px solid #f1f5f9', paddingTop: '14px', overflowX: 'auto' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedWardCategory('all')}
                        style={{
                          padding: '6px 16px',
                          borderRadius: '20px',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          border: selectedWardCategory === 'all' ? '1px solid #0d9488' : '1px solid #e2e8f0',
                          background: selectedWardCategory === 'all' ? '#0d9488' : '#ffffff',
                          color: selectedWardCategory === 'all' ? '#ffffff' : '#64748b',
                          cursor: 'pointer'
                        }}
                      >
                        All Wards ({ipdBeds.length} Beds)
                      </button>
                      {ipdCategories.map((cat: any) => {
                        const count = ipdBeds.filter((b: any) => b.category_id === cat.id).length;
                        const isSelected = selectedWardCategory === cat.id;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setSelectedWardCategory(cat.id)}
                            style={{
                              padding: '6px 16px',
                              borderRadius: '20px',
                              fontSize: '0.82rem',
                              fontWeight: 700,
                              border: isSelected ? '1px solid #0d9488' : '1px solid #e2e8f0',
                              background: isSelected ? '#0d9488' : '#ffffff',
                              color: isSelected ? '#ffffff' : '#64748b',
                              cursor: 'pointer'
                            }}
                          >
                            {cat.name} ({count})
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Ward Occupancy Content */}
                  {loadingIpdBeds ? (
                    <div style={{ textAlign: 'center', padding: '60px', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                      <RefreshCw size={32} className="spin-animation" style={{ color: '#0d9488' }} />
                      <p style={{ marginTop: '12px', fontSize: '0.9rem', color: '#64748b' }}>Loading live IPD ward status...</p>
                    </div>
                  ) : (
                    (() => {
                      const filteredCategories = selectedWardCategory === 'all'
                        ? ipdCategories
                        : ipdCategories.filter((c: any) => c.id === selectedWardCategory);

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                          {filteredCategories.map((cat: any) => {
                            const categoryBeds = ipdBeds.filter((b: any) => {
                              if (b.category_id !== cat.id) return false;
                              if (!ipdSearchQuery.trim()) return true;
                              const query = ipdSearchQuery.toLowerCase();
                              const bedNoMatch = b.bed_number.toLowerCase().includes(query);
                              const patientMatch = b.active_admission?.patient_name?.toLowerCase().includes(query);
                              const docMatch = b.active_admission?.admitting_doctor?.toLowerCase().includes(query);
                              return bedNoMatch || patientMatch || docMatch;
                            });

                            if (categoryBeds.length === 0) return null;

                            const occupiedCount = categoryBeds.filter((b: any) => b.status === 'occupied').length;

                            return (
                              <div key={cat.id} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px' }}>
                                {/* Ward Section Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '10px', borderBottom: '2px solid #f1f5f9' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>{cat.name}</h3>
                                    <span style={{ fontSize: '0.78rem', background: '#f1f5f9', padding: '3px 10px', borderRadius: '12px', color: '#475569', fontWeight: 600 }}>
                                      {cat.description || 'In-Patient Ward'}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0d9488' }}>
                                    Occupancy: {occupiedCount} / {categoryBeds.length} Beds
                                  </div>
                                </div>

                                {/* Bed Cards Grid */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                                  {categoryBeds.map((bed: any) => {
                                    const isOccupied = bed.status === 'occupied' && bed.active_admission;
                                    const adm = bed.active_admission;

                                    return (
                                      <div
                                        key={bed.id}
                                        style={{
                                          border: isOccupied ? '1px solid #cbd5e1' : '1px dashed #cbd5e1',
                                          borderRadius: '14px',
                                          padding: '16px',
                                          background: isOccupied ? '#ffffff' : '#f8fafc',
                                          boxShadow: isOccupied ? '0 4px 6px -1px rgba(0, 0, 0, 0.05)' : 'none',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          justifyContent: 'space-between'
                                        }}
                                      >
                                        <div>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                            <span style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                              <Bed size={18} style={{ color: isOccupied ? '#0d9488' : '#94a3b8' }} /> {formatBedNumber(bed.bed_number)}
                                            </span>
                                            <span style={{
                                              fontSize: '0.72rem',
                                              padding: '3px 8px',
                                              borderRadius: '12px',
                                              fontWeight: 700,
                                              background: isOccupied ? '#dcfce7' : '#f1f5f9',
                                              color: isOccupied ? '#15803d' : '#64748b',
                                              border: isOccupied ? '1px solid #86efac' : '1px solid #cbd5e1'
                                            }}>
                                              {isOccupied ? 'Occupied' : 'Vacant'}
                                            </span>
                                          </div>

                                          {isOccupied ? (
                                            <div style={{ fontSize: '0.85rem' }}>
                                              <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>
                                                {adm.patient_name}
                                              </div>
                                              <div style={{ fontSize: '0.78rem', color: '#64748b', margin: '2px 0 8px' }}>
                                                Code: <strong>{adm.patient_code}</strong> | Dr. {adm.admitting_doctor}
                                              </div>

                                              <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '10px' }}>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>DIAGNOSIS</div>
                                                <div style={{ fontSize: '0.82rem', color: '#334155', fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                  {adm.diagnosis || 'No diagnosis recorded'}
                                                </div>
                                              </div>

                                              <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                                <span>Admitted: {new Date(adm.admission_datetime).toLocaleDateString()}</span>
                                                <span style={{ fontWeight: 700, color: '#0f172a' }}>Day {adm.stay_days || 1}</span>
                                              </div>
                                            </div>
                                          ) : (
                                            <div style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8', fontSize: '0.84rem', fontStyle: 'italic' }}>
                                              Bed is currently available for admission.
                                            </div>
                                          )}
                                        </div>

                                        {isOccupied && (
                                          <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '12px', marginTop: '4px' }}>
                                            <button
                                              type="button"
                                              onClick={() => fetchHistoryDetails(adm.id)}
                                              style={{
                                                flex: 1,
                                                padding: '7px 8px',
                                                fontSize: '0.78rem',
                                                fontWeight: 700,
                                                background: '#f0fdf4',
                                                color: '#15803d',
                                                border: '1px solid #bbf7d0',
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '4px'
                                              }}
                                            >
                                              <Eye size={14} /> Case Sheet
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setSelectedBedForRound(bed);
                                                setRoundVitalsForm({
                                                  temp: 98.6,
                                                  pulse: 72,
                                                  systolic_bp: 120,
                                                  diastolic_bp: 80,
                                                  spo2: 98,
                                                  respiratory_rate: 16,
                                                  doctor_notes: '',
                                                });
                                                setIsRoundNoteModalOpen(true);
                                              }}
                                              style={{
                                                flex: 1,
                                                padding: '7px 8px',
                                                fontSize: '0.78rem',
                                                fontWeight: 700,
                                                background: '#0d9488',
                                                color: '#ffffff',
                                                border: '1px solid #0d9488',
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '4px'
                                              }}
                                            >
                                              <Edit3 size={14} /> Round Note
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()
                  )}
                </div>
              )}

              {/* TAB: CONSULTATION WORKSPACE (ENTERPRISE EMR WORKSPACE) */}
              {activeTab === 'consultation' && (
                activeAppt ? (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: 'calc(100vh - 100px)',
                    maxHeight: 'calc(100vh - 100px)',
                    overflow: 'hidden',
                    backgroundColor: '#f8fafc',
                    margin: '-32px'
                  }}>
                    {/* 3-COLUMN EMR WORKSPACE VIEWPOT */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '22% 48% 30%',
                      gap: '16px',
                      padding: '16px 24px',
                      flex: 1,
                      height: 'calc(100% - 64px)',
                      overflow: 'hidden'
                    }}>

                      {/* ── LEFT PANEL (22%): PATIENT SUMMARY & PATIENT WORKSPACE ── */}
                      <div style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '14px',
                        height: '100%',
                        overflowY: 'auto',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                      }}>
                        {/* COMPACT PATIENT SUMMARY CARD */}
                        <div style={{
                          backgroundColor: '#f8fafc',
                          borderRadius: '10px',
                          border: '1px solid #e2e8f0',
                          padding: '14px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                            <div style={{
                              width: '42px',
                              height: '42px',
                              borderRadius: '50%',
                              backgroundColor: '#0f766e',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: '1.05rem',
                              flexShrink: 0
                            }}>
                              {activeAppt.patient_name ? activeAppt.patient_name.split(' ').map((n: string) => n[0]).join('').toUpperCase() : 'PT'}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <h4 style={{ margin: 0, fontWeight: 800, fontSize: '0.96rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {activeAppt.patient_name} {loadingPatientDetails && <span style={{ fontSize: '0.7rem', color: '#0f766e' }}>(Syncing...)</span>}
                              </h4>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                <span style={{ fontSize: '0.7rem', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '1px 6px', borderRadius: '4px', fontWeight: 700, fontFamily: 'monospace' }}>
                                  {activePatientDetails?.patient_code || activeAppt.patient_code || 'PT-10007'}
                                </span>
                                <span style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: 700 }}>
                                  🟢 Active
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Demographics & Blood Group */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: '#475569', marginBottom: '10px', backgroundColor: '#ffffff', padding: '6px 10px', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                            <span>👤 {calculateAge(activePatientDetails?.date_of_birth)} • {activePatientDetails?.gender || 'Female'}</span>
                            <span style={{ fontWeight: 800, color: '#dc2626', backgroundColor: '#fef2f2', padding: '1px 6px', borderRadius: '4px' }}>
                              🩸 {activePatientDetails?.blood_group || 'O+'}
                            </span>
                          </div>

                          {/* Critical Alerts Badges */}
                          {(() => {
                            const alerts = parseMedicalAlerts(activePatientDetails);
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {alerts.highRiskFlags !== 'None' && alerts.highRiskFlags !== 'none' ? (
                                  <span style={{ fontSize: '0.72rem', backgroundColor: '#fee2e2', color: '#dc2626', padding: '3px 8px', borderRadius: '6px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <AlertTriangle size={12} color="#dc2626" /> High Risk: {alerts.highRiskFlags}
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '0.72rem', backgroundColor: '#f0fdf4', color: '#16a34a', padding: '3px 8px', borderRadius: '6px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    🟢 No High Risk Flags
                                  </span>
                                )}

                                {alerts.allergies !== 'None' && alerts.allergies !== 'none' ? (
                                  <span style={{ fontSize: '0.72rem', backgroundColor: '#fee2e2', color: '#dc2626', padding: '3px 8px', borderRadius: '6px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    🔴 Allergy: {alerts.allergies}
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '0.72rem', backgroundColor: '#f0fdf4', color: '#16a34a', padding: '3px 8px', borderRadius: '6px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    🟢 No Known Allergies
                                  </span>
                                )}

                                {alerts.specialCondition !== 'None' && alerts.specialCondition !== 'none' && (
                                  <span style={{ fontSize: '0.72rem', backgroundColor: '#fef3c7', color: '#d97706', padding: '3px 8px', borderRadius: '6px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    🟡 Condition: {alerts.specialCondition}
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </div>

                        {/* PATIENT WORKSPACE ACTION MENU */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 2px', marginBottom: '2px' }}>
                            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              Patient Workspace
                            </span>
                            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Select item</span>
                          </div>

                          {[
                            { id: 'vitals', title: 'Vitals', subtitle: 'BP, Pulse, Temp, BMI', icon: <Heart size={16} color="#ef4444" /> },
                            { id: 'history', title: 'Medical History', subtitle: '28 Visits Logged', icon: <FileText size={16} color="#2563eb" /> },
                            { id: 'reports', title: 'Reports', subtitle: 'OPG X-Ray & Blood Report', icon: <FolderOpen size={16} color="#16a34a" /> },
                            { id: 'treatment', title: 'Current Treatment', subtitle: 'Tooth pain, Amoxicillin', icon: <Stethoscope size={16} color="#0f766e" /> },
                            { id: 'timeline', title: 'Timeline', subtitle: 'Lifecycle Activity', icon: <Activity size={16} color="#d97706" /> },
                            { id: 'prescriptions', title: 'Previous Prescriptions', subtitle: '2 Prescriptions Logged', icon: <FileSpreadsheet size={16} color="#8b5cf6" /> },
                            { id: 'imaging', title: 'Imaging', subtitle: 'Dental Scans & X-Rays', icon: <Camera size={16} color="#0284c7" /> },
                          ].map((item) => {
                            const isActive = patientWorkspaceTab === item.id;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => setPatientWorkspaceTab(item.id as any)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '10px 12px',
                                  borderRadius: '10px',
                                  border: isActive ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                                  backgroundColor: isActive ? '#eff6ff' : '#ffffff',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  transition: 'all 150ms ease-in-out',
                                  boxShadow: isActive ? '0 2px 6px rgba(37, 99, 235, 0.12)' : 'none'
                                }}
                                onMouseOver={(e) => {
                                  if (!isActive) e.currentTarget.style.backgroundColor = '#f8fafc';
                                }}
                                onMouseOut={(e) => {
                                  if (!isActive) e.currentTarget.style.backgroundColor = '#ffffff';
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                  <div style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '8px',
                                    backgroundColor: isActive ? '#dbeafe' : '#f1f5f9',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                  }}>
                                    {item.icon}
                                  </div>
                                  <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: '0.83rem', fontWeight: isActive ? 800 : 700, color: isActive ? '#1e40af' : '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {item.title}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: isActive ? '#3b82f6' : '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {item.subtitle}
                                    </div>
                                  </div>
                                </div>
                                <ChevronRight size={16} color={isActive ? '#2563eb' : '#94a3b8'} style={{ flexShrink: 0 }} />
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* ── CENTER PANEL (48%): DOCTOR CLINICAL WORKSPACE ── */}
                      <div style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        padding: '20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px',
                        height: '100%',
                        overflowY: 'auto',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                      }}>
                        {/* SECTION 1: CHIEF COMPLAINT & AI COPILOT NOTES */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                              Chief Complaint & Clinical Notes
                            </h3>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <select 
                                className="doc-input" 
                                style={{ width: '140px', height: '30px', padding: '0 8px', fontSize: '0.75rem', marginBottom: 0 }}
                                value={selectedScenario || ''}
                                onChange={(e) => handleStartScenario(e.target.value)}
                              >
                                <option value="">-- Demo Scenario --</option>
                                <option value="rct">🦷 Root Canal</option>
                                <option value="ortho">😬 Orthodontic</option>
                                <option value="extraction">💉 Extraction</option>
                                <option value="scaling">🧼 Scaling</option>
                              </select>
                              <button 
                                type="button" 
                                onClick={handleStartVoiceDictation} 
                                className="doc-btn-secondary" 
                                disabled={isTranscribing}
                                style={{ 
                                  height: '30px', 
                                  padding: '0 12px', 
                                  fontSize: '0.75rem', 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: '6px', 
                                  borderColor: isRecordingAudio ? '#ef4444' : isTranscribing ? '#0284c7' : '#cbd5e1',
                                  backgroundColor: isRecordingAudio ? '#fef2f2' : isTranscribing ? '#f0f9ff' : '#ffffff',
                                  color: isRecordingAudio ? '#dc2626' : isTranscribing ? '#0284c7' : '#334155',
                                  fontWeight: 700
                                }}
                              >
                                {isRecordingAudio ? (
                                  <>
                                    <span style={{
                                      width: '8px',
                                      height: '8px',
                                      borderRadius: '50%',
                                      backgroundColor: '#ef4444',
                                      animation: 'pulse 1s infinite'
                                    }} />
                                    <MicOff size={14} color="#ef4444" />
                                    <span>Stop ({String(Math.floor(recordingSeconds / 60)).padStart(2, '0')}:{String(recordingSeconds % 60).padStart(2, '0')})</span>
                                  </>
                                ) : isTranscribing ? (
                                  <>
                                    <RefreshCw size={14} className="spin" color="#0284c7" />
                                    <span>Transcribing...</span>
                                  </>
                                ) : (
                                  <>
                                    <Mic size={14} />
                                    <span>Speak</span>
                                  </>
                                )}
                              </button>

                              {/* MANUAL EDIT RE-ANALYZE / AI SUMMARIZE BUTTON */}
                              <button 
                                type="button" 
                                onClick={() => {
                                  if (!symptoms.trim()) {
                                    showToast('Please speak or type clinical notes first.', 'error');
                                    return;
                                  }
                                  showToast('Re-analyzing clinical notes with Groq AI...');
                                  triggerAIAnalysis(symptoms);
                                }} 
                                className="doc-btn-primary" 
                                disabled={isAnalyzing || isTranscribing}
                                style={{ 
                                  height: '30px', 
                                  padding: '0 12px', 
                                  fontSize: '0.75rem', 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: '4px', 
                                  backgroundColor: '#0d9488',
                                  borderColor: '#0d9488',
                                  color: '#ffffff',
                                  fontWeight: 700
                                }}
                                title="Click to generate or update AI summary after manually editing text"
                              >
                                <Sparkles size={13} />
                                <span>{isAnalyzing ? 'Analyzing...' : 'AI Summarize'}</span>
                              </button>
                            </div>
                          </div>

                          <textarea 
                            className="doc-textarea" 
                            rows={3}
                            value={symptoms}
                            onChange={(e) => setSymptoms(e.target.value)}
                            placeholder="Chief complaint, clinical symptoms, and doctor observation notes..."
                            style={{ fontSize: '0.85rem', lineHeight: '1.4', padding: '10px', borderRadius: '8px', borderColor: '#cbd5e1' }}
                          />

                          {/* AI AMBIENT COPILOT DRAFT CARD */}
                          {(isAnalyzing || aiSummary || allergyWarnings.length > 0) && (
                            <div style={{ marginTop: '10px', padding: '12px', borderRadius: '10px', backgroundColor: allergyWarnings.length > 0 ? '#fef2f2' : '#f0fdfa', border: allergyWarnings.length > 0 ? '1px solid #fca5a5' : '1px solid #99f6e4' }}>
                              
                              {/* ALLERGY WARNING ALERT BANNER */}
                              {allergyWarnings.length > 0 && (
                                <div style={{ marginBottom: '10px', padding: '10px 12px', borderRadius: '8px', backgroundColor: '#fee2e2', border: '1px solid #f87171', color: '#991b1b' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, fontSize: '0.82rem' }}>
                                    <AlertTriangle size={16} color="#dc2626" />
                                    <span>⚠️ CRITICAL PATIENT ALLERGY ALERT</span>
                                  </div>
                                  {allergyWarnings.map((warn, idx) => (
                                    <div key={idx} style={{ fontSize: '0.78rem', marginTop: '4px', fontWeight: 600 }}>
                                      • {warn}
                                    </div>
                                  ))}
                                </div>
                              )}

                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <Sparkles size={16} color={allergyWarnings.length > 0 ? '#dc2626' : '#0d9488'} />
                                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: allergyWarnings.length > 0 ? '#991b1b' : '#0f766e' }}>AI Clinical Assistant</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {!approved && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (isEditingSummary) {
                                          setIsEditingSummary(false);
                                          setNotes(editedSummaryText);
                                          showToast('Summary updated!');
                                        } else {
                                          setIsEditingSummary(true);
                                        }
                                      }}
                                      style={{ fontSize: '0.72rem', backgroundColor: '#ffffff', border: '1px solid #99f6e4', color: '#0d9488', padding: '3px 8px', borderRadius: '4px', fontWeight: 700, cursor: 'pointer' }}
                                    >
                                      {isEditingSummary ? 'Save' : 'Edit'}
                                    </button>
                                  )}
                                  
                                  {approved ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setApproved(false);
                                        showToast('Approval revoked.');
                                      }}
                                      style={{ 
                                        fontSize: '0.72rem', 
                                        backgroundColor: '#dcfce7', 
                                        color: '#15803d', 
                                        border: '1px solid #bbf7d0',
                                        padding: '3px 8px', 
                                        borderRadius: '4px', 
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '2px'
                                      }}
                                      title="Click to undo approval"
                                    >
                                      Approved ✓ <X size={10} style={{ marginLeft: '2px' }} />
                                    </button>
                                  ) : (
                                    <button 
                                      type="button" 
                                      onClick={() => {
                                        setApproved(true);
                                        setNotes(editedSummaryText || aiSummary?.clinical_summary || '');
                                        if (aiSummary?.diagnosis) setDiagnosis(aiSummary.diagnosis);
                                        showToast('AI Notes Approved!');
                                      }}
                                      style={{ fontSize: '0.72rem', backgroundColor: '#0d9488', color: '#ffffff', border: 'none', padding: '3px 8px', borderRadius: '4px', fontWeight: 700, cursor: 'pointer' }}
                                    >
                                      Approve Notes
                                    </button>
                                  )}
                                </div>
                              </div>
                              {isAnalyzing ? (
                                <p style={{ margin: 0, fontSize: '0.78rem', color: '#0d9488' }}>Analyzing voice stream & synthesizing clinical record via Groq LLM...</p>
                              ) : (
                                <div style={{ fontSize: '0.78rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  {isEditingSummary ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      <strong style={{ color: '#0f766e' }}>Edit Summary:</strong>
                                      <textarea
                                        value={editedSummaryText}
                                        onChange={(e) => setEditedSummaryText(e.target.value)}
                                        className="doc-textarea"
                                        rows={3}
                                        style={{ width: '100%', fontSize: '0.8rem', padding: '8px', borderRadius: '6px', borderColor: '#99f6e4', backgroundColor: '#ffffff' }}
                                      />
                                    </div>
                                  ) : (
                                    <div><strong>Summary:</strong> {editedSummaryText || aiSummary?.clinical_summary}</div>
                                  )}
                                  {aiSummary?.medications && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                                      <span style={{ color: '#0f766e', fontWeight: 700 }}>Suggested Medicines Available ({aiSummary.medications.length})</span>
                                      <button type="button" onClick={applyAISuggestions} style={{ fontSize: '0.72rem', backgroundColor: '#ffffff', border: '1px solid #99f6e4', color: '#0f766e', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, cursor: 'pointer' }}>
                                        + Apply to Prescription
                                      </button>
                                    </div>
                                  )}
                                  {aiSummary?.suggested_treatment && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <span style={{ color: '#0f766e', fontWeight: 700 }}>Plan: {aiSummary.suggested_treatment}</span>
                                      <button type="button" onClick={applyAITreatmentPlan} style={{ fontSize: '0.72rem', backgroundColor: '#ffffff', border: '1px solid #99f6e4', color: '#0f766e', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, cursor: 'pointer' }}>
                                        + Add Treatment Plan
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* SECTION 2: PRESCRIPTION BUILDER (MAJOR SECTION) */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                              Prescription Builder
                            </h3>
                            <button 
                              type="button" 
                              onClick={addPrescriptionItem} 
                              className="doc-btn-primary" 
                              style={{ height: '32px', padding: '0 14px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                              <Plus size={14} /> Add Medicine Row
                            </button>
                          </div>

                          {prescriptionItems.length === 0 ? (
                            <div style={{ flex: 1, minHeight: '120px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px dashed #cbd5e1', borderRadius: '10px', padding: '20px', backgroundColor: '#f8fafc', color: '#64748b' }}>
                              <Stethoscope size={28} color="#94a3b8" style={{ marginBottom: '8px' }} />
                              <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>No Medications Added</span>
                              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Click "+ Add Medicine Row" to construct patient prescription</span>
                            </div>
                          ) : (
                            <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                              <table className="doc-table" style={{ margin: 0 }}>
                                <thead style={{ backgroundColor: '#f8fafc' }}>
                                  <tr>
                                    <th style={{ fontSize: '0.75rem', fontWeight: 800, padding: '8px 12px' }}>Medicine Name</th>
                                    <th style={{ fontSize: '0.75rem', fontWeight: 800, padding: '8px 12px', width: '100px' }}>Dosage</th>
                                    <th style={{ fontSize: '0.75rem', fontWeight: 800, padding: '8px 12px', width: '100px' }}>Duration</th>
                                    <th style={{ fontSize: '0.75rem', fontWeight: 800, padding: '8px 12px' }}>Instructions</th>
                                    <th style={{ width: '36px', padding: '8px 6px' }}></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {prescriptionItems.map((item, idx) => (
                                    <tr key={idx}>
                                      <td style={{ padding: '6px 8px' }}>
                                        <input 
                                          type="text" 
                                          className="doc-input" 
                                          value={item.medicine_name} 
                                          onChange={(e) => updatePrescriptionItem(idx, 'medicine_name', e.target.value)}
                                          placeholder="e.g. Amoxicillin 500mg"
                                          style={{ marginBottom: 0, height: '30px', fontSize: '0.8rem' }}
                                        />
                                      </td>
                                      <td style={{ padding: '6px 8px' }}>
                                        <input 
                                          type="text" 
                                          className="doc-input" 
                                          value={item.dosage} 
                                          onChange={(e) => updatePrescriptionItem(idx, 'dosage', e.target.value)}
                                          placeholder="1-0-1"
                                          style={{ marginBottom: 0, height: '30px', fontSize: '0.8rem' }}
                                        />
                                      </td>
                                      <td style={{ padding: '6px 8px' }}>
                                        <input 
                                          type="text" 
                                          className="doc-input" 
                                          value={item.duration} 
                                          onChange={(e) => updatePrescriptionItem(idx, 'duration', e.target.value)}
                                          placeholder="5 Days"
                                          style={{ marginBottom: 0, height: '30px', fontSize: '0.8rem' }}
                                        />
                                      </td>
                                      <td style={{ padding: '6px 8px' }}>
                                        <input 
                                          type="text" 
                                          className="doc-input" 
                                          value={item.instructions} 
                                          onChange={(e) => updatePrescriptionItem(idx, 'instructions', e.target.value)}
                                          placeholder="Take after meals"
                                          style={{ marginBottom: 0, height: '30px', fontSize: '0.8rem' }}
                                        />
                                      </td>
                                      <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                                        <button 
                                          type="button" 
                                          onClick={() => removePrescriptionItem(idx)}
                                          style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                                        >
                                          <Trash2 size={15} />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>

                        {/* SECTION 3: CLINICAL DIAGNOSIS */}
                        <div>
                          <h3 style={{ fontSize: '0.9rem', fontWeight: 800, margin: '0 0 6px 0', color: '#0f172a' }}>
                            Clinical Diagnosis / Assessment
                          </h3>
                          <input
                            type="text"
                            className="doc-input"
                            value={diagnosis}
                            onChange={(e) => setDiagnosis(e.target.value)}
                            placeholder="e.g. Tooth pain - Left Molar / Advised Root Canal Therapy (RCT)"
                            style={{ marginBottom: 0, height: '36px', fontSize: '0.84rem' }}
                          />
                        </div>

                        {/* SECTION 4: FOLLOW-UP RECOMMENDATION */}
                        <div style={{
                          marginTop: '16px',
                          padding: '16px',
                          backgroundColor: '#f8fafc',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px'
                        }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.88rem', fontWeight: '700', color: '#0f172a' }}>
                            <input
                              type="checkbox"
                              checked={followupAdvised}
                              onChange={(e) => setFollowupAdvised(e.target.checked)}
                              style={{ width: '16px', height: '16px', accentColor: 'var(--doc-primary)' }}
                            />
                            Advise Follow-up Appointment?
                          </label>
                          {followupAdvised && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingLeft: '24px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600 }}>Recommend visit after:</span>
                                <select
                                  className="doc-input"
                                  value={followupAfterDays}
                                  onChange={(e) => setFollowupAfterDays(Number(e.target.value))}
                                  style={{ marginBottom: 0, width: '150px', height: '32px', padding: '0 8px', fontSize: '0.8rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                                >
                                  <option value={3}>3 Days</option>
                                  <option value={7}>7 Days (1 Week)</option>
                                  <option value={14}>14 Days (2 Weeks)</option>
                                  <option value={30}>30 Days (1 Month)</option>
                                  <option value={60}>60 Days (2 Months)</option>
                                  <option value={90}>90 Days (3 Months)</option>
                                </select>
                              </div>
                              <div style={{ fontSize: '0.78rem', color: '#0284c7', background: '#e0f2fe', padding: '8px 12px', borderRadius: '6px', border: '1px solid #bae6fd', marginTop: '4px' }}>
                                📅 Calculated Target Date: <strong>{(() => {
                                  const d = new Date();
                                  d.setDate(d.getDate() + followupAfterDays);
                                  return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
                                })()}</strong>
                              </div>
                              <div style={{ fontSize: '0.74rem', color: '#64748b', fontStyle: 'italic' }}>
                                Note: The patient will be notified on their portal to schedule a follow-up for <strong>{diagnosis || 'Routine Follow-up'}</strong>.
                              </div>
                            </div>
                          )}
                        </div>

                        {/* 🏥 IPD ADMISSION RECOMMENDATION BLOCK */}
                        <div style={{
                          backgroundColor: ipdAdvised ? '#f0fdf4' : '#ffffff',
                          padding: '14px',
                          borderRadius: '8px',
                          border: ipdAdvised ? '1px solid #86efac' : '1px solid #e2e8f0',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px',
                          marginTop: '12px'
                        }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.88rem', fontWeight: '700', color: ipdAdvised ? '#166534' : '#0f172a' }}>
                            <input
                              type="checkbox"
                              checked={ipdAdvised}
                              onChange={(e) => setIpdAdvised(e.target.checked)}
                              style={{ width: '16px', height: '16px', accentColor: '#059669' }}
                            />
                            🏥 Advise IPD Admission (Recommend Hospitalization)?
                          </label>
                          {ipdAdvised && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingLeft: '24px' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                                    Preferred Ward / Category:
                                  </label>
                                  <select
                                    className="doc-input"
                                    value={ipdPreferredCategory}
                                    onChange={(e) => setIpdPreferredCategory(e.target.value)}
                                    style={{ marginBottom: 0, height: '34px', padding: '0 8px', fontSize: '0.8rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                                  >
                                    <option value="">Any Available Ward</option>
                                    {ipdCategories.map((c: any) => (
                                      <option key={c.id} value={c.id}>{c.name} (₹{c.base_charge_24h}/day)</option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                                    Urgency Level:
                                  </label>
                                  <select
                                    className="doc-input"
                                    value={ipdUrgency}
                                    onChange={(e) => setIpdUrgency(e.target.value)}
                                    style={{ marginBottom: 0, height: '34px', padding: '0 8px', fontSize: '0.8rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                                  >
                                    <option value="routine">Routine Admission</option>
                                    <option value="urgent">Urgent</option>
                                    <option value="emergency">Emergency / ICU</option>
                                  </select>
                                </div>
                              </div>
                              <div>
                                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                                  Clinical Reason & Instructions for Receptionist:
                                </label>
                                <input
                                  type="text"
                                  className="doc-input"
                                  placeholder="e.g. Severe dehydration, requires 48h IV monitoring & bed assignment..."
                                  value={ipdReason}
                                  onChange={(e) => setIpdReason(e.target.value)}
                                  style={{ marginBottom: 0, fontSize: '0.8rem', height: '34px' }}
                                />
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#15803d', background: '#dcfce7', padding: '8px 12px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                                🔔 Saving consultation will immediately send a real-time notification alert to <strong>Receptionist</strong> and <strong>Patient</strong> for bed assignment queue.
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* ── RIGHT PANEL (30%): DYNAMIC INFORMATION PANEL ── */}
                      <div style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        padding: '20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px',
                        height: '100%',
                        overflowY: 'auto',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                      }}>
                        {/* DYNAMIC PANEL HEADER */}
                        <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {patientWorkspaceTab === 'vitals' && '❤️ Patient Vitals & Health Metrics'}
                            {patientWorkspaceTab === 'history' && '📄 Consultation History Timeline'}
                            {patientWorkspaceTab === 'reports' && '🧪 Lab Reports & OPG X-Rays'}
                            {patientWorkspaceTab === 'treatment' && '💊 Active Treatment Plan'}
                            {patientWorkspaceTab === 'timeline' && '📈 Patient Lifecycle Timeline'}
                            {patientWorkspaceTab === 'prescriptions' && '📋 Historical Prescriptions Log'}
                            {patientWorkspaceTab === 'imaging' && '📷 Dental Scans & Imaging'}
                            {patientWorkspaceTab === null && 'ℹ️ Dynamic Patient Information Panel'}
                          </h3>
                          <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                            {patientWorkspaceTab === null ? 'Select an item from Patient Workspace to inspect records' : 'Live EMR dynamic stream'}
                          </span>
                        </div>

                        {/* DYNAMIC CONTENT VIEWS */}
                        {patientWorkspaceTab === null && (
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '30px 20px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
                            <FolderOpen size={42} color="#94a3b8" style={{ marginBottom: '12px' }} />
                            <h4 style={{ margin: '0 0 6px 0', fontSize: '0.95rem', fontWeight: 800, color: '#334155' }}>
                              Select an item from Patient Workspace
                            </h4>
                            <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b', lineHeight: '1.4', maxWidth: '260px' }}>
                              Click any button on the left panel (Medical History, Reports, Vitals, etc.) to view detailed clinical records here without leaving the consultation workspace.
                            </p>
                          </div>
                        )}

                        {/* VITALS VIEW */}
                        {patientWorkspaceTab === 'vitals' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.82rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                              <span style={{ color: '#64748b', fontWeight: 600 }}>Blood Pressure</span>
                              <input 
                                type="text" 
                                value={vitalsBp} 
                                onChange={(e) => setVitalsBp(e.target.value)} 
                                style={{ width: '90px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '3px 8px', textAlign: 'right', fontWeight: '700', fontSize: '0.82rem' }}
                              />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                              <span style={{ color: '#64748b', fontWeight: 600 }}>Pulse Rate</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <input 
                                  type="number" 
                                  value={vitalsPulse} 
                                  onChange={(e) => setVitalsPulse(Number(e.target.value))} 
                                  style={{ width: '70px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '3px 8px', textAlign: 'right', fontWeight: '700', fontSize: '0.82rem' }}
                                />
                                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>bpm</span>
                              </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                              <span style={{ color: '#64748b', fontWeight: 600 }}>Oxygen Saturation (SpO2)</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <input 
                                  type="number" 
                                  value={vitalsSpo2} 
                                  onChange={(e) => setVitalsSpo2(Number(e.target.value))} 
                                  style={{ width: '70px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '3px 8px', textAlign: 'right', fontWeight: '700', fontSize: '0.82rem' }}
                                />
                                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>%</span>
                              </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                              <span style={{ color: '#64748b', fontWeight: 600 }}>Body Temperature</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <input 
                                  type="number" 
                                  step="0.1"
                                  value={vitalsTemp} 
                                  onChange={(e) => setVitalsTemp(Number(e.target.value))} 
                                  style={{ width: '70px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '3px 8px', textAlign: 'right', fontWeight: '700', fontSize: '0.82rem' }}
                                />
                                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>°F</span>
                              </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                              <span style={{ color: '#64748b', fontWeight: 600 }}>Height</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <input 
                                  type="text" 
                                  value={vitalsHeight} 
                                  onChange={(e) => setVitalsHeight(e.target.value)} 
                                  style={{ width: '70px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '3px 8px', textAlign: 'right', fontWeight: '700', fontSize: '0.82rem' }}
                                />
                                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>cm</span>
                              </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                              <span style={{ color: '#64748b', fontWeight: 600 }}>Weight</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <input 
                                  type="text" 
                                  value={vitalsWeight} 
                                  onChange={(e) => setVitalsWeight(e.target.value)} 
                                  style={{ width: '70px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '3px 8px', textAlign: 'right', fontWeight: '700', fontSize: '0.82rem' }}
                                />
                                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>kg</span>
                              </div>
                            </div>

                            {/* Calculate BMI Button */}
                            <button
                              type="button"
                              onClick={() => {
                                const bmiRes = calculateBMI(vitalsHeight, vitalsWeight);
                                setCalculatedBmiInfo(bmiRes);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                width: '100%',
                                padding: '10px 12px',
                                backgroundColor: '#0f766e',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: 700,
                                fontSize: '0.82rem',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s',
                                marginTop: '4px',
                                marginBottom: '4px'
                              }}
                              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#0d5c56'}
                              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#0f766e'}
                            >
                              📊 Calculate BMI
                            </button>

                            <div style={{ border: `1px solid ${calculatedBmiInfo.color}`, backgroundColor: '#ffffff', padding: '12px', borderRadius: '10px', textAlign: 'center', marginTop: '4px' }}>
                              <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Body Mass Index (BMI)</span>
                              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: '2px 0' }}>{calculatedBmiInfo.bmi}</div>
                              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: calculatedBmiInfo.color }}>{calculatedBmiInfo.label}</span>
                            </div>
                          </div>
                        )}

                        {/* MEDICAL HISTORY VIEW */}
                        {patientWorkspaceTab === 'history' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {(selectedPatientHistory?.consultations || [
                              { id: '1', date: '15 July 2026', diagnosis: 'Tooth Pain - Left Molar', symptoms: 'Sensitivity to cold and hot liquids', notes: 'Advised Root Canal Therapy' },
                              { id: '2', date: '02 July 2026', diagnosis: 'Routine Oral Scaling', symptoms: 'Tartar buildup', notes: 'Full mouth scaling completed' }
                            ]).map((c: any, idx: number) => (
                              <div key={c.id || idx} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', backgroundColor: '#f8fafc' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0f766e' }}>
                                    📅 {c.consultation_datetime ? new Date(c.consultation_datetime).toLocaleDateString() : c.date || '15 July 2026'}
                                  </span>
                                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Visit Log</span>
                                </div>
                                <h4 style={{ margin: '4px 0', fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>
                                  Diagnosis: {c.diagnosis}
                                </h4>
                                <p style={{ margin: '4px 0', fontSize: '0.78rem', color: '#334155' }}>
                                  <strong>Symptoms:</strong> {c.symptoms}
                                </p>
                                {c.notes && (
                                  <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                                    <strong>Advice:</strong> {c.notes}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* REPORTS VIEW */}
                        {patientWorkspaceTab === 'reports' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {(!selectedPatientHistory?.reports || selectedPatientHistory.reports.length === 0) ? (
                              <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '0.82rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                                No medical reports uploaded yet.
                              </div>
                            ) : (
                              selectedPatientHistory.reports.map((report: any) => (
                                <div 
                                  key={report.id} 
                                  style={{ 
                                    border: '1px solid #bfdbfe', 
                                    borderRadius: '10px', 
                                    padding: '12px', 
                                    backgroundColor: '#eff6ff' 
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                    <FolderOpen size={20} color="#2563eb" />
                                    <div>
                                      <h5 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#1e40af', wordBreak: 'break-all' }}>
                                        {report.report_name}
                                      </h5>
                                      <span style={{ fontSize: '0.72rem', color: '#1d4ed8' }}>
                                        Uploaded on {new Date(report.uploaded_at || report.created_at || new Date()).toLocaleDateString()} · {report.report_type}
                                      </span>
                                    </div>
                                  </div>
                                  <button 
                                    className="doc-btn-secondary" 
                                    onClick={() => handlePreviewReport(report)}
                                    style={{ width: '100%', fontSize: '0.78rem', height: '30px', backgroundColor: '#ffffff', borderColor: '#bfdbfe', color: '#1d4ed8' }}
                                  >
                                    Preview Report PDF
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        )}

                        {/* CURRENT TREATMENT VIEW */}
                        {patientWorkspaceTab === 'treatment' && (() => {
                          const rawDetails = activePatientDetails?.current_treatment_details;
                          let problem = 'Tooth pain (Left Molar)';
                          let medicines = 'Amoxicillin 500mg, Ibuprofen 400mg';
                          let since = '12 July 2026';

                          if (rawDetails) {
                            try {
                              if (rawDetails.trim().startsWith('{')) {
                                const parsed = JSON.parse(rawDetails);
                                problem = parsed.currentProblem || problem;
                                medicines = parsed.currentMedicines || medicines;
                                if (parsed.treatmentSince) {
                                  since = parsed.treatmentSince;
                                }
                              } else {
                                problem = rawDetails;
                              }
                            } catch (e) {
                              problem = rawDetails;
                            }
                          }

                          // Format since date if it matches YYYY-MM-DD
                          if (since && since.match(/^\d{4}-\d{2}-\d{2}$/)) {
                            try {
                              const d = new Date(since);
                              since = d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
                            } catch (err) {}
                          }

                          return (
                            <div style={{ border: '1px solid #bbf7d0', backgroundColor: '#f0fdf4', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.82rem' }}>
                              <div>
                                <span style={{ color: '#15803d', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', display: 'block' }}>Primary Problem</span>
                                <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.88rem' }}>
                                  • {problem}
                                </span>
                              </div>

                              <div>
                                <span style={{ color: '#15803d', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', display: 'block' }}>Medicines Being Taken</span>
                                <span style={{ color: '#334155', fontWeight: 600 }}>
                                  • {medicines}
                                </span>
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #bbf7d0', paddingTop: '8px' }}>
                                <span style={{ color: '#15803d', fontWeight: 600 }}>Treatment Since</span>
                                <span style={{ fontWeight: 700, color: '#0f172a' }}>{since}</span>
                              </div>
                            </div>
                          );
                        })()}

                        {/* TIMELINE VIEW */}
                        {patientWorkspaceTab === 'timeline' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.8rem' }}>
                            <div style={{ borderLeft: '3px solid #0f766e', paddingLeft: '10px' }}>
                              <div style={{ fontWeight: 700, color: '#0f172a' }}>Today - Consultation Started</div>
                              <div style={{ color: '#64748b', fontSize: '0.72rem' }}>18:15 PM · {dashboardData?.doctor?.branch_name ? `${dashboardData.doctor.branch_name} Branch` : 'Satellite Branch'}</div>
                            </div>
                            <div style={{ borderLeft: '3px solid #2563eb', paddingLeft: '10px' }}>
                              <div style={{ fontWeight: 700, color: '#0f172a' }}>15 July 2026 - OPG Scan Uploaded</div>
                              <div style={{ color: '#64748b', fontSize: '0.72rem' }}>Uploaded by Radiologist</div>
                            </div>
                            <div style={{ borderLeft: '3px solid #16a34a', paddingLeft: '10px' }}>
                              <div style={{ fontWeight: 700, color: '#0f172a' }}>02 July 2026 - Initial Visit</div>
                              <div style={{ color: '#64748b', fontSize: '0.72rem' }}>Dr. Amit Shah · Oral Scaling</div>
                            </div>
                          </div>
                        )}

                        {/* PREVIOUS PRESCRIPTIONS VIEW */}
                        {patientWorkspaceTab === 'prescriptions' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {(selectedPatientHistory?.prescriptions || [
                              {
                                id: 'rx-1029',
                                created_at: '2026-07-15',
                                items: [
                                  { medicine_name: 'Amoxicillin 500mg', dosage: '1-1-1', duration: '5 days' },
                                  { medicine_name: 'Ibuprofen 400mg', dosage: '1-0-1', duration: '3 days' }
                                ]
                              }
                            ]).map((rx: any, idx: number) => (
                              <div key={rx.id || idx} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', backgroundColor: '#ffffff' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '4px' }}>
                                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#8b5cf6' }}>
                                    💊 Rx #{rx.id?.substring(0, 8) || 'RX-1029'}
                                  </span>
                                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                    {rx.created_at ? new Date(rx.created_at).toLocaleDateString() : '15 July 2026'}
                                  </span>
                                </div>
                                <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '0.78rem', color: '#334155' }}>
                                  {rx.items?.map((item: any, i: number) => (
                                    <li key={i}>
                                      <strong>{item.medicine_name}</strong> - {item.dosage} ({item.duration})
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* IMAGING VIEW */}
                        {patientWorkspaceTab === 'imaging' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', backgroundColor: '#f8fafc', textAlign: 'center' }}>
                              <Camera size={32} color="#0284c7" style={{ marginBottom: '6px' }} />
                              <h5 style={{ margin: '0 0 4px 0', fontSize: '0.85rem', fontWeight: 700 }}>Dental OPG Panoramic Scan</h5>
                              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Date: 15 July 2026</span>
                              <button className="doc-btn-secondary" style={{ width: '100%', marginTop: '8px', fontSize: '0.78rem', height: '30px' }}>
                                Open Full Resolution X-Ray
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                    </div>

                    {/* ── STICKY BOTTOM ACTION BAR ── */}
                    <div style={{
                      height: '64px',
                      backgroundColor: '#ffffff',
                      borderTop: '1px solid #e2e8f0',
                      padding: '12px 24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.04)',
                      zIndex: 10
                    }}>
                      <div style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>
                        Active Patient: <strong style={{ color: '#0f172a' }}>{activeAppt.patient_name}</strong> ({activePatientDetails?.patient_code || activeAppt.patient_code || 'PT-10007'})
                      </div>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button 
                          type="button" 
                          className="doc-btn-secondary" 
                          style={{ height: '40px', padding: '0 16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: '700' }}
                          onClick={() => setActiveTab('treatment')}
                        >
                          <Activity size={16} /> Treatment Plan
                        </button>

                        <button 
                          type="button" 
                          className="doc-btn-primary" 
                          disabled={savingConsultation}
                          style={{ 
                            height: '40px', 
                            padding: '0 20px',
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px', 
                            fontSize: '0.85rem', 
                            fontWeight: '700',
                            backgroundColor: '#16a34a',
                            borderColor: '#16a34a',
                            color: '#ffffff',
                            opacity: savingConsultation ? 0.7 : 1,
                            cursor: savingConsultation ? 'not-allowed' : 'pointer'
                          }}
                          onClick={async () => {
                            if (!diagnosis) {
                              showToast('Please enter a clinical diagnosis / assessment first.', 'error');
                              return;
                            }
                            await handleSaveConsultation({ preventDefault: () => {} } as any);
                          }}
                        >
                          <CheckCircle size={16} /> {savingConsultation ? 'Saving...' : 'Complete Consultation'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--doc-border)' }}>
                    <div style={{ width: '72px', height: '72px', borderRadius: '50%', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
                      <Stethoscope size={36} color="var(--doc-primary)" />
                    </div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--doc-text-dark)', margin: '0 0 8px 0' }}>No Patient Currently in Consultation</h3>
                    <p style={{ color: 'var(--doc-text-muted)', fontSize: '0.9rem', margin: '0 0 24px 0', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto', lineHeight: '1.4' }}>
                      Go to the Queue Management page and click "Start Consultation" on any waiting or confirmed patient to load their clinical profile.
                    </p>
                    <button className="doc-btn-primary" onClick={() => setActiveTab('queue')} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '0 24px' }}>
                      <List size={16} /> Open Patient Queue
                    </button>
                  </div>
                )
              )}
            </>
          )}
        </div>
      </main>

      {/* ── SLEEK FLOATING TELECONSULTATION ALERT NOTIFICATION TOAST (TOP RIGHT) ── */}
      {incomingCall && !inVideoCall && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          zIndex: 99999,
          backgroundColor: '#0f172a',
          border: '1px solid #0284c7',
          borderRadius: '16px',
          padding: '16px 20px',
          maxWidth: '380px',
          boxShadow: '0 20px 35px -10px rgba(2, 132, 199, 0.5)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            backgroundColor: '#0284c7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 0 12px rgba(2, 132, 199, 0.6)'
          }}>
            <Video size={22} color="#ffffff" />
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              📹 Teleconsultation Alert
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc', margin: '2px 0' }}>
              {incomingCall.caller_name || 'Patient'} has joined!
            </div>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              Waiting in video room
            </div>
          </div>

          <button
            onClick={handleAcceptIncomingCall}
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: '#16a34a',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 12px rgba(22, 163, 74, 0.4)'
            }}
          >
            Join Call
          </button>

          <button
            onClick={handleDeclineIncomingCall}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              fontSize: '1.2rem',
              padding: '0 4px',
              lineHeight: 1
            }}
            title="Dismiss"
          >
            &times;
          </button>
        </div>
      )}


      {/* ── INTERACTIVE VIDEO CONSULTATION ROOM (MODAL) ── */}
      {inVideoCall && (
        <div className="video-consultation-overlay">
          <div className="video-consultation-window">
            <header className="video-header">
              <span style={{ fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Video size={18} color="var(--doc-primary-light)" /> Teleconsultation Room
              </span>
              <span style={{ fontSize: '0.85rem' }}>Patient: <strong>{videoPatientName}</strong></span>
            </header>

            <div className="video-body">
              {/* Primary Video Feed - Realtime Jitsi Video Room */}
              <div className="video-main-screen" style={{ position: 'relative', overflow: 'hidden', minHeight: '400px', backgroundColor: '#0f172a' }}>
                {videoRoomName ? (
                  <JitsiMeeting
                    domain="meet.element.io"
                    roomName={videoRoomName ? videoRoomName.toLowerCase().replace(/[^a-z0-9_]/g, '') : 'vclinic_teleconsult_room'}
                    configOverwrite={{
                      startWithAudioMuted: false,
                      startWithVideoMuted: false,
                      disableThirdPartyRequests: true,
                      prejoinPageEnabled: false,
                      enableWelcomePage: false,
                      disableDeepLinking: true,
                      enableUserRolesBasedOnToken: false,
                      requireDisplayName: false,
                      toolbarButtons: [
                        'microphone', 'camera', 'desktop', 'fullscreen',
                        'hangup', 'chat', 'raisehand', 'tileview'
                      ]
                    }}
                    interfaceConfigOverwrite={{
                      SHOW_JITSI_WATERMARK: false,
                      SHOW_WATERMARK_FOR_GUESTS: false,
                      TOOLBAR_BUTTONS: [
                        'microphone', 'camera', 'desktop', 'fullscreen',
                        'hangup', 'chat', 'raisehand', 'tileview'
                      ]
                    }}
                    userInfo={{
                      displayName: dashboardData?.doctor?.full_name || 'Doctor',
                      email: ''
                    }}
                    onReadyToClose={() => {
                      api.post(`/teleconsultations/${videoApptId}/end`)
                        .then(() => {
                          const matchedAppt = dashboardData?.today_appointments?.find((a: any) => a.id === videoApptId);
                          if (matchedAppt) {
                            handleStartConsultation(matchedAppt);
                          }
                          setInVideoCall(false);
                          fetchDashboard();
                        })
                        .catch(() => {
                          setInVideoCall(false);
                          fetchDashboard();
                        });
                    }}
                    getIFrameRef={(iframeRef) => {
                      iframeRef.style.height = '100%';
                      iframeRef.style.width = '100%';
                    }}
                  />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                    Connecting Video Call Stream...
                  </div>
                )}
              </div>

              {/* Consultation sidebar in-call */}
              <div style={{ backgroundColor: '#1e293b', borderLeft: '1px solid #334155', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ color: 'white', fontSize: '0.95rem', fontWeight: '700', marginBottom: '16px' }}>Consultation Controls</h3>
                  <p style={{ color: '#94a3b8', fontSize: '0.78rem', lineHeight: '1.4', marginBottom: '20px' }}>
                    Verify patient details and medical records. After completing the live call conversation, click the button below to write the prescription.
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button 
                    onClick={() => {
                      const matchedAppt = dashboardData?.today_appointments?.find((a: any) => a.id === videoApptId);
                      if (matchedAppt) {
                        handleStartConsultation(matchedAppt);
                        setInVideoCall(false);
                      } else {
                        // Fallback dummy appt
                        handleStartConsultation({ id: videoApptId, patient_name: videoPatientName, patient_id: 'd9bfa4b1-8b01-44bb-bc74-672ef9198642' });
                        setInVideoCall(false);
                      }
                    }} 
                    className="doc-btn-primary"
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    <FileText size={16} /> Write Prescription & Finish
                  </button>
                  <button 
                    onClick={() => setInVideoCall(false)} 
                    className="doc-btn-secondary"
                    style={{ width: '100%', justifyContent: 'center', backgroundColor: '#334155', color: 'white', borderColor: '#475569' }}
                  >
                    Minimize Video
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
      {/* Request Change Modal */}
      {isRequestingChange && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '500px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 24px',
              borderBottom: '1px solid var(--doc-border)',
              backgroundColor: '#f8fafc'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700', color: 'var(--doc-text-dark)' }}>
                Request Schedule Change
              </h3>
              <button 
                onClick={() => setIsRequestingChange(false)}
                style={{
                  border: 'none',
                  background: 'none',
                  color: 'var(--doc-text-muted)',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmitChangeRequest} style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                <div className="doc-form-group">
                  <label className="doc-form-label" style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--doc-text-dark)' }}>Request Type</label>
                  <select 
                    className="doc-input"
                    value={requestType}
                    onChange={(e) => {
                      setRequestType(e.target.value);
                      if (e.target.value === 'lunch_break') {
                        setReqStartTime('13:00');
                        setReqEndTime('14:00');
                      } else if (e.target.value === 'teleconsultation') {
                        setReqStartTime('15:00');
                        setReqEndTime('17:00');
                      } else if (e.target.value === 'shift_timing') {
                        setReqStartTime('09:00');
                        setReqEndTime('21:00');
                      }
                    }}
                    style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid var(--doc-border)' }}
                  >
                    <option value="lunch_break">Lunch Break Time</option>
                    <option value="teleconsultation">Teleconsultation Hours</option>
                    <option value="shift_timing">Shift Timings (Operating Hours)</option>
                    <option value="leave">Apply for Leave</option>
                  </select>
                </div>

                {requestType === 'leave' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="doc-form-group">
                      <label className="doc-form-label" style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--doc-text-dark)' }}>Start Date</label>
                      <input 
                        type="date" 
                        required
                        className="doc-input"
                        value={reqStartDate}
                        onChange={(e) => setReqStartDate(e.target.value)}
                        style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid var(--doc-border)', padding: '0 8px' }}
                      />
                    </div>
                    <div className="doc-form-group">
                      <label className="doc-form-label" style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--doc-text-dark)' }}>End Date</label>
                      <input 
                        type="date" 
                        required
                        className="doc-input"
                        value={reqEndDate}
                        onChange={(e) => setReqEndDate(e.target.value)}
                        style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid var(--doc-border)', padding: '0 8px' }}
                      />
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="doc-form-group">
                      <label className="doc-form-label" style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--doc-text-dark)' }}>Proposed Start Time</label>
                      <input 
                        type="time" 
                        required
                        className="doc-input"
                        value={reqStartTime}
                        onChange={(e) => setReqStartTime(e.target.value)}
                        style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid var(--doc-border)', padding: '0 8px' }}
                      />
                    </div>
                    <div className="doc-form-group">
                      <label className="doc-form-label" style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--doc-text-dark)' }}>Proposed End Time</label>
                      <input 
                        type="time" 
                        required
                        className="doc-input"
                        value={reqEndTime}
                        onChange={(e) => setReqEndTime(e.target.value)}
                        style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid var(--doc-border)', padding: '0 8px' }}
                      />
                    </div>
                  </div>
                )}

                <div className="doc-form-group">
                  <label className="doc-form-label" style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--doc-text-dark)' }}>Describe your issue / Reason for change</label>
                  <textarea 
                    rows={4}
                    required
                    className="doc-input"
                    value={reqReason}
                    onChange={(e) => setReqReason(e.target.value)}
                    placeholder="Provide a detailed explanation for this request..."
                    style={{ width: '100%', fontFamily: 'inherit', resize: 'vertical', borderRadius: '8px', border: '1px solid var(--doc-border)', padding: '8px' }}
                  />
                </div>

              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                marginTop: '24px',
                borderTop: '1px solid var(--doc-border)',
                paddingTop: '16px'
              }}>
                <button 
                  type="button" 
                  className="doc-btn-secondary" 
                  onClick={() => setIsRequestingChange(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="doc-btn-primary"
                  disabled={submittingRequest}
                  style={{ backgroundColor: 'var(--doc-primary)', color: '#ffffff' }}
                >
                  {submittingRequest ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Report Preview Modal */}
      {viewingReport && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '800px',
            height: '85vh',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 24px',
              borderBottom: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700', color: '#0f172a' }}>
                  {viewingReport.report_name}
                </h3>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  Category: {viewingReport.report_type}
                </span>
              </div>
              <button 
                onClick={handleCloseReportModal}
                style={{
                  border: 'none',
                  background: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content Area */}
            <div style={{ flex: 1, padding: '24px', backgroundColor: '#f1f5f9', position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              {loadingReportFile ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', border: '3px solid #cbd5e1', borderTopColor: '#0f766e', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontSize: '0.9rem', color: '#475569', fontWeight: 600 }}>Loading report preview...</span>
                </div>
              ) : reportError ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', backgroundColor: '#ffffff', borderRadius: '8px', padding: '24px', border: '1px solid #e2e8f0' }}>
                  <AlertTriangle size={48} color="#e11d48" />
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>Failed to load preview directly</h4>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', textAlign: 'center' }}>{reportError}</p>
                  <button
                    onClick={() => downloadReportFile(viewingReport.file_url, `${viewingReport.report_name || 'report'}.pdf`)}
                    className="doc-btn-primary"
                    style={{ fontSize: '0.85rem' }}
                  >
                    Download File Instead
                  </button>
                </div>
              ) : reportFileUrl ? (
                (() => {
                  const fileUrlLower = viewingReport.file_url?.toLowerCase() || '';
                  const isImg = !fileUrlLower.includes('.pdf') && (
                                fileUrlLower.includes('/image/') || 
                                fileUrlLower.match(/\.(jpg|jpeg|png|webp|gif)$/) ||
                                reportContentType?.toLowerCase().startsWith('image/')
                              );
                  if (isImg) {
                    return (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', backgroundColor: '#0f172a', borderRadius: '8px', padding: '16px' }}>
                        <img 
                          src={reportFileUrl} 
                          alt={viewingReport.report_name} 
                          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
                        />
                      </div>
                    );
                  } else {
                    if (!blobUrl) {
                      return (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                          <div style={{ width: '40px', height: '40px', border: '3px solid #cbd5e1', borderTopColor: '#0f766e', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                          <span style={{ fontSize: '0.9rem', color: '#475569', fontWeight: 600 }}>Loading report preview...</span>
                        </div>
                      );
                    }
                    return (
                      <iframe
                        src={blobUrl}
                        title={viewingReport.report_name}
                        width="100%"
                        height="100%"
                        style={{ border: 'none', borderRadius: '8px', backgroundColor: '#ffffff' }}
                      />
                    );
                  }
                })()
              ) : null}
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #e2e8f0', padding: '16px 24px', backgroundColor: '#f8fafc' }}>
              <button
                onClick={() => downloadReportFile(viewingReport.file_url, `${viewingReport.report_name || 'report'}.pdf`)}
                className="doc-btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
              >
                <Download size={14} /> Download File
              </button>
              <button 
                onClick={handleCloseReportModal} 
                className="doc-btn-primary" 
                style={{ fontSize: '0.85rem', backgroundColor: '#0f766e', borderColor: '#0f766e', color: 'white' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── QUICK ACTION DRAWER MODAL ── */}
      {activeQuickDrawer && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: '24px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '720px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f8fafc'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                  {activeQuickDrawer === 'history' && '📄 Full Medical History Timeline'}
                  {activeQuickDrawer === 'reports' && '📂 Patient Medical Reports'}
                  {activeQuickDrawer === 'prescriptions' && '💊 Previous Prescriptions Log'}
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Patient: <strong>{activeAppt?.patient_name || 'Rohan Deshmukh'}</strong> ({activePatientDetails?.patient_code || activeAppt?.patient_code || 'PT-10234'})
                </span>
              </div>
              <button 
                onClick={() => setActiveQuickDrawer(null)}
                style={{ border: 'none', background: '#f1f5f9', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={18} color="#64748b" />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              {activeQuickDrawer === 'history' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {selectedPatientHistory?.consultations?.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '8px', color: '#64748b' }}>
                      No prior consultation records registered for this patient.
                    </div>
                  ) : (
                    (selectedPatientHistory?.consultations || [
                      { id: '1', date: '15 July 2026', diagnosis: 'Tooth Pain - Left Molar', symptoms: 'Sensitivity to cold and hot liquids', notes: 'Advised Root Canal Therapy' },
                      { id: '2', date: '02 July 2026', diagnosis: 'Routine Oral Scaling', symptoms: 'Tartar buildup', notes: 'Full mouth scaling completed' }
                    ]).map((c: any, idx: number) => (
                      <div key={c.id || idx} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', backgroundColor: '#ffffff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f766e' }}>
                            📅 {c.consultation_datetime ? new Date(c.consultation_datetime).toLocaleDateString() : c.date || '15 July 2026'}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Consultation Visit</span>
                        </div>
                        <h4 style={{ margin: '4px 0', fontSize: '0.92rem', fontWeight: 700, color: '#0f172a' }}>
                          Diagnosis: {c.diagnosis}
                        </h4>
                        <p style={{ margin: '4px 0', fontSize: '0.82rem', color: '#334155' }}>
                          <strong>Symptoms:</strong> {c.symptoms}
                        </p>
                        {c.notes && (
                          <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                            <strong>Doctor Advice:</strong> {c.notes}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeQuickDrawer === 'reports' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {(!selectedPatientHistory?.reports || selectedPatientHistory.reports.length === 0) ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '0.88rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                      No medical reports uploaded yet.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      {selectedPatientHistory.reports.map((report: any) => (
                        <div key={report.id} style={{ border: '1px solid #bfdbfe', borderRadius: '10px', padding: '16px', backgroundColor: '#eff6ff' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                            <FolderOpen size={20} color="#2563eb" />
                            <div>
                              <h5 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: '#1e40af', wordBreak: 'break-all' }}>
                                {report.report_name}
                              </h5>
                              <span style={{ fontSize: '0.72rem', color: '#1d4ed8' }}>
                                Uploaded on {new Date(report.uploaded_at || report.created_at || new Date()).toLocaleDateString()} · {report.report_type}
                              </span>
                            </div>
                          </div>
                          <button 
                            className="doc-btn-secondary" 
                            onClick={() => handlePreviewReport(report)}
                            style={{ width: '100%', fontSize: '0.78rem', height: '30px', backgroundColor: '#ffffff', borderColor: '#bfdbfe', color: '#1d4ed8' }}
                          >
                            Preview Report PDF
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeQuickDrawer === 'prescriptions' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {(selectedPatientHistory?.prescriptions || [
                    {
                      id: 'rx-1',
                      created_at: '2026-07-15',
                      items: [
                        { medicine_name: 'Amoxicillin 500mg', dosage: '1-1-1', duration: '5 days', instructions: 'Take after meals' },
                        { medicine_name: 'Ibuprofen 400mg', dosage: '1-0-1', duration: '3 days', instructions: 'Take if pain persists' }
                      ]
                    }
                  ]).map((rx: any, idx: number) => (
                    <div key={rx.id || idx} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', backgroundColor: '#ffffff' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#8b5cf6' }}>
                          💊 Rx #{rx.id?.substring(0, 8) || 'RX-1029'}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {rx.created_at ? new Date(rx.created_at).toLocaleDateString() : '15 July 2026'}
                        </span>
                      </div>
                      <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.82rem', color: '#334155' }}>
                        {rx.items?.map((item: any, i: number) => (
                          <li key={i} style={{ marginBottom: '4px' }}>
                            <strong>{item.medicine_name}</strong> - {item.dosage} ({item.duration})
                            {item.instructions && <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>{item.instructions}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc', textAlign: 'right' }}>
              <button onClick={() => setActiveQuickDrawer(null)} className="doc-btn-primary" style={{ padding: '8px 20px', fontSize: '0.85rem' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ENTERPRISE CLINICAL PROFILE & MEDICAL ALERTS MODAL ── */}
      {showClinicalProfileModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: '24px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '840px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden'
          }}>
            {/* Modal Header Bar */}
            <div style={{
              padding: '20px 28px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#0f766e',
              color: '#ffffff'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  backgroundColor: '#ffffff',
                  color: '#0f766e',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '1.1rem'
                }}>
                  {activeAppt?.patient_name ? activeAppt.patient_name.split(' ').map((n: string) => n[0]).join('').toUpperCase() : 'PT'}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                    {activeAppt?.patient_name || 'Rohan Deshmukh'}
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: '#ccfbf1' }}>
                    Patient ID: <strong>{activePatientDetails?.patient_code || activeAppt?.patient_code || 'PT-10007'}</strong> · {calculateAge(activePatientDetails?.date_of_birth)} · {activePatientDetails?.gender || 'Female'}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setShowClinicalProfileModal(false)}
                style={{ border: 'none', background: 'rgba(255, 255, 255, 0.2)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ffffff' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Tabs Header */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc', padding: '0 24px' }}>
              <button
                onClick={() => setProfileModalTab('alerts')}
                style={{
                  padding: '14px 20px',
                  border: 'none',
                  background: 'none',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  color: profileModalTab === 'alerts' ? '#dc2626' : '#64748b',
                  borderBottom: profileModalTab === 'alerts' ? '3px solid #dc2626' : '3px solid transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                ⚠️ Medical Alerts
              </button>
              <button
                onClick={() => setProfileModalTab('vitals')}
                style={{
                  padding: '14px 20px',
                  border: 'none',
                  background: 'none',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  color: profileModalTab === 'vitals' ? '#0f766e' : '#64748b',
                  borderBottom: profileModalTab === 'vitals' ? '3px solid #0f766e' : '3px solid transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                📊 Vitals & BMI
              </button>
              <button
                onClick={() => setProfileModalTab('treatment')}
                style={{
                  padding: '14px 20px',
                  border: 'none',
                  background: 'none',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  color: profileModalTab === 'treatment' ? '#16a34a' : '#64748b',
                  borderBottom: profileModalTab === 'treatment' ? '3px solid #16a34a' : '3px solid transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                🟢 Current Treatment
              </button>
              <button
                onClick={() => setProfileModalTab('demographics')}
                style={{
                  padding: '14px 20px',
                  border: 'none',
                  background: 'none',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  color: profileModalTab === 'demographics' ? '#2563eb' : '#64748b',
                  borderBottom: profileModalTab === 'demographics' ? '3px solid #2563eb' : '3px solid transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                👤 Demographics & Contacts
              </button>
            </div>

            {/* Modal Tab Body */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1, backgroundColor: '#ffffff' }}>
              {/* TAB 1: MEDICAL ALERTS */}
              {profileModalTab === 'alerts' && (() => {
                const alerts = parseMedicalAlerts(activePatientDetails);
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ backgroundColor: '#fff5f5', border: '1px solid #fee2e2', borderRadius: '12px', padding: '20px' }}>
                      <h4 style={{ margin: '0 0 14px 0', fontSize: '0.95rem', fontWeight: 800, color: '#991b1b' }}>
                        🚨 Critical Clinical Flags & Warnings
                      </h4>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '0.88rem' }}>
                        <div style={{ backgroundColor: '#ffffff', border: '1px solid #fee2e2', padding: '12px 16px', borderRadius: '8px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase', display: 'block' }}>Allergies</span>
                          <span style={{ fontSize: '1rem', fontWeight: 800, color: alerts.allergies !== 'None' ? '#dc2626' : '#64748b' }}>
                            {alerts.allergies}
                          </span>
                        </div>

                        <div style={{ backgroundColor: '#ffffff', border: '1px solid #fef3c7', padding: '12px 16px', borderRadius: '8px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#b45309', textTransform: 'uppercase', display: 'block' }}>Chronic Diseases</span>
                          <span style={{ fontSize: '1rem', fontWeight: 800, color: alerts.chronicDiseases !== 'None' ? '#d97706' : '#64748b' }}>
                            {alerts.chronicDiseases}
                          </span>
                        </div>

                        <div style={{ backgroundColor: '#ffffff', border: '1px solid #fee2e2', padding: '12px 16px', borderRadius: '8px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase', display: 'block' }}>High Risk Flags</span>
                          <span style={{ fontSize: '1rem', fontWeight: 800, color: alerts.highRiskFlags !== 'None' ? '#dc2626' : '#64748b' }}>
                            {alerts.highRiskFlags}
                          </span>
                        </div>

                        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', padding: '12px 16px', borderRadius: '8px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'block' }}>Special Condition</span>
                          <span style={{ fontSize: '1rem', fontWeight: 700, color: '#334155' }}>
                            {alerts.specialCondition}
                          </span>
                        </div>

                        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', padding: '12px 16px', borderRadius: '8px', gridColumn: 'span 2' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'block' }}>Disability</span>
                          <span style={{ fontSize: '1rem', fontWeight: 700, color: '#334155' }}>
                            {alerts.disability}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* TAB 2: VITALS & BMI */}
              {profileModalTab === 'vitals' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', textAlign: 'center', backgroundColor: '#f8fafc' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Blood Pressure</span>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>{vitalsBp}</div>
                      <span style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 600 }}>Normal</span>
                    </div>

                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', textAlign: 'center', backgroundColor: '#f8fafc' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Pulse Rate</span>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>{vitalsPulse} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>bpm</span></div>
                      <span style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 600 }}>Resting Heart Rate</span>
                    </div>

                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', textAlign: 'center', backgroundColor: '#f8fafc' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Body Temp</span>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>{vitalsTemp} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>°F</span></div>
                      <span style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 600 }}>Afebrite</span>
                    </div>

                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', textAlign: 'center', backgroundColor: '#f8fafc' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Height</span>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>{vitalsHeight} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>cm</span></div>
                    </div>

                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', textAlign: 'center', backgroundColor: '#f8fafc' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Weight</span>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>{vitalsWeight} <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>kg</span></div>
                    </div>

                    {(() => {
                      const bmiInfo = calculateBMI(vitalsHeight, vitalsWeight);
                      return (
                        <div style={{ border: `1px solid ${bmiInfo.color}`, borderRadius: '10px', padding: '16px', textAlign: 'center', backgroundColor: '#ffffff' }}>
                          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Body Mass Index (BMI)</span>
                          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>{bmiInfo.bmi}</div>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: bmiInfo.color }}>{bmiInfo.label}</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* TAB 3: CURRENT TREATMENT */}
              {profileModalTab === 'treatment' && (() => {
                const rawDetails = activePatientDetails?.current_treatment_details;
                let problem = 'Tooth pain (Left Molar)';
                let medicines = 'Amoxicillin 500mg, Ibuprofen 400mg';
                let since = '12 July 2026';
                let rxDate = '15 July 2026';

                if (rawDetails) {
                  try {
                    if (rawDetails.trim().startsWith('{')) {
                      const parsed = JSON.parse(rawDetails);
                      problem = parsed.currentProblem || problem;
                      medicines = parsed.currentMedicines || medicines;
                      if (parsed.treatmentSince) {
                        since = parsed.treatmentSince;
                      }
                      if (parsed.prescriptionDate) {
                        rxDate = parsed.prescriptionDate;
                      }
                    } else {
                      problem = rawDetails;
                    }
                  } catch (e) {
                    problem = rawDetails;
                  }
                }

                // Format dates if they match YYYY-MM-DD
                if (since && since.match(/^\d{4}-\d{2}-\d{2}$/)) {
                  try {
                    const d = new Date(since);
                    since = d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
                  } catch (err) {}
                }
                if (rxDate && rxDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                  try {
                    const d = new Date(rxDate);
                    rxDate = d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
                  } catch (err) {}
                }

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ border: '1px solid #dcfce7', backgroundColor: '#f0fdf4', borderRadius: '12px', padding: '20px' }}>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', fontWeight: 800, color: '#166534' }}>
                        🟢 Active Treatment Plan & Patient Complaints
                      </h4>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.88rem' }}>
                        <div style={{ backgroundColor: '#ffffff', border: '1px solid #bbf7d0', padding: '12px 16px', borderRadius: '8px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase', display: 'block' }}>Primary Problem</span>
                          <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                            {problem}
                          </span>
                        </div>

                        <div style={{ backgroundColor: '#ffffff', border: '1px solid #bbf7d0', padding: '12px 16px', borderRadius: '8px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase', display: 'block' }}>Current Medicines Being Taken</span>
                          <span style={{ fontSize: '0.95rem', color: '#334155' }}>
                            {medicines}
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div style={{ backgroundColor: '#ffffff', border: '1px solid #bbf7d0', padding: '12px 16px', borderRadius: '8px' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase', display: 'block' }}>Treatment Since</span>
                            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>{since}</span>
                          </div>
                          <div style={{ backgroundColor: '#ffffff', border: '1px solid #bbf7d0', padding: '12px 16px', borderRadius: '8px' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase', display: 'block' }}>Latest Prescription Date</span>
                            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>{rxDate}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* TAB 4: DEMOGRAPHICS */}
              {profileModalTab === 'demographics' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '0.88rem' }}>
                    <div style={{ border: '1px solid #e2e8f0', padding: '12px 16px', borderRadius: '8px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>Full Name</span>
                      <span style={{ fontWeight: 700, color: '#0f172a' }}>{activeAppt?.patient_name}</span>
                    </div>

                    <div style={{ border: '1px solid #e2e8f0', padding: '12px 16px', borderRadius: '8px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>Patient Code</span>
                      <span style={{ fontWeight: 700, color: '#0f766e', fontFamily: 'monospace' }}>{activePatientDetails?.patient_code || 'PT-10007'}</span>
                    </div>

                    <div style={{ border: '1px solid #e2e8f0', padding: '12px 16px', borderRadius: '8px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>Phone Number</span>
                      <span style={{ fontWeight: 700, color: '#0f172a' }}>{activePatientDetails?.user?.phone || '7896325634'}</span>
                    </div>

                    <div style={{ border: '1px solid #e2e8f0', padding: '12px 16px', borderRadius: '8px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>Email Address</span>
                      <span style={{ fontWeight: 600, color: '#334155' }}>{activePatientDetails?.user?.email || 'patient@example.com'}</span>
                    </div>

                    <div style={{ border: '1px solid #e2e8f0', padding: '12px 16px', borderRadius: '8px', gridColumn: 'span 2' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>Residential Address</span>
                      <span style={{ fontWeight: 600, color: '#334155' }}>{activePatientDetails?.address || 'Satellite, Ahmedabad, Gujarat'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '16px 28px', borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc', textAlign: 'right' }}>
              <button 
                onClick={() => setShowClinicalProfileModal(false)} 
                className="doc-btn-primary" 
                style={{ padding: '8px 24px', fontSize: '0.85rem', fontWeight: 700 }}
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── GLOBAL EMR LOOKUP MODAL (OPTION B) ── */}
      {emrLookupPatient && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: '24px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '900px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px 28px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#0c6e8c',
              color: '#ffffff'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
                  EMR Case File: {emrLookupPatient.patient?.user?.full_name || emrLookupPatient.patient?.full_name || 'Patient'}
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#e0f2fe' }}>
                  Patient Code: <strong>{emrLookupPatient.patient?.patient_code}</strong> · Gender: {emrLookupPatient.patient?.gender || 'N/A'} · Phone: {emrLookupPatient.patient?.user?.phone || emrLookupPatient.patient?.phone_number || 'N/A'}
                </span>
              </div>
              <button 
                onClick={() => setEmrLookupPatient(null)}
                style={{ border: 'none', background: 'rgba(255, 255, 255, 0.2)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ffffff' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1, backgroundColor: '#f8fafc' }}>
              {loadingEmrHistory ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                  Loading patient medical logs...
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                  {/* Left Column: Consultations */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px' }}>
                      📋 Consultation History
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {!emrLookupPatient.consultations || emrLookupPatient.consultations.length === 0 ? (
                        <div style={{ padding: '20px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px dashed #cbd5e1', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                          No consultation records found.
                        </div>
                      ) : (
                        emrLookupPatient.consultations.map((c: any) => (
                          <div key={c.id} style={{ backgroundColor: '#ffffff', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginBottom: '6px' }}>
                              <span>Date: {new Date(c.created_at || c.consultation_date).toLocaleDateString()}</span>
                              <span style={{ color: '#0c6e8c' }}>{formatDocName(c.doctor_name || 'Clinic Specialist')}</span>
                            </div>
                            <div style={{ fontSize: '0.85rem', marginBottom: '4px' }}>
                              <strong>Symptoms:</strong> {c.symptoms || 'None recorded'}
                            </div>
                            <div style={{ fontSize: '0.85rem', marginBottom: '4px' }}>
                              <strong>Diagnosis:</strong> {c.diagnosis || 'None recorded'}
                            </div>
                            {c.notes && (
                              <div style={{ fontSize: '0.8rem', color: '#475569', backgroundColor: '#f1f5f9', padding: '6px 10px', borderRadius: '6px', marginTop: '6px' }}>
                                <strong>Notes:</strong> {c.notes}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Right Column: Prescriptions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px' }}>
                      💊 Prescription Log
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {!emrLookupPatient.prescriptions || emrLookupPatient.prescriptions.length === 0 ? (
                        <div style={{ padding: '20px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px dashed #cbd5e1', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                          No prescriptions found.
                        </div>
                      ) : (
                        emrLookupPatient.prescriptions.map((p: any) => (
                          <div key={p.id} style={{ backgroundColor: '#ffffff', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginBottom: '6px' }}>
                              Date: {new Date(p.created_at).toLocaleDateString()}
                            </div>
                            <div style={{ fontSize: '0.85rem' }}>
                              <strong>Medications:</strong>
                              <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                                {p.items?.map((item: any, idx: number) => (
                                  <li key={idx} style={{ marginBottom: '2px' }}>
                                    {item.medicine_name} - {item.dosage} ({item.frequency || 'As directed'})
                                  </li>
                                )) || <li>{p.instructions || 'Custom instructions'}</li>}
                              </ul>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '16px 28px', borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc', textAlign: 'right' }}>
              <button 
                onClick={() => setEmrLookupPatient(null)} 
                className="doc-btn-primary" 
                style={{ padding: '8px 24px', fontSize: '0.85rem', fontWeight: 700 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT PRESCRIPTION MODAL ── */}
      {isEditPrescriptionModalOpen && (
        <div className="doc-modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px'
        }}>
          <div className="doc-modal-container" style={{
            backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '750px',
            maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid #e2e8f0'
          }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#e6fcf5', color: '#0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Edit Prescription Sheet</h3>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>Modify prescribed medications, dosage, and doctor instructions</p>
                </div>
              </div>
              <button 
                onClick={() => setIsEditPrescriptionModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEditPrescription} style={{ padding: '24px' }}>
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>Medications List</label>
                  <button
                    type="button"
                    onClick={addEditPrescriptionItem}
                    className="doc-btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Plus size={14} /> Add Medicine
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {editingPrescriptionItems.map((item, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr 36px', gap: '10px', alignItems: 'center', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                      <div>
                        <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Medicine Name</label>
                        <input
                          type="text"
                          className="doc-input"
                          style={{ fontSize: '0.8rem', height: '34px', margin: 0 }}
                          placeholder="e.g. Paracetamol 500mg"
                          value={item.medicine_name}
                          onChange={(e) => updateEditPrescriptionItem(idx, 'medicine_name', e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Dosage</label>
                        <input
                          type="text"
                          className="doc-input"
                          style={{ fontSize: '0.8rem', height: '34px', margin: 0 }}
                          placeholder="1-0-1"
                          value={item.dosage}
                          onChange={(e) => updateEditPrescriptionItem(idx, 'dosage', e.target.value)}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Duration</label>
                        <input
                          type="text"
                          className="doc-input"
                          style={{ fontSize: '0.8rem', height: '34px', margin: 0 }}
                          placeholder="5 days"
                          value={item.duration}
                          onChange={(e) => updateEditPrescriptionItem(idx, 'duration', e.target.value)}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Instructions</label>
                        <input
                          type="text"
                          className="doc-input"
                          style={{ fontSize: '0.8rem', height: '34px', margin: 0 }}
                          placeholder="After food"
                          value={item.instructions}
                          onChange={(e) => updateEditPrescriptionItem(idx, 'instructions', e.target.value)}
                        />
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => removeEditPrescriptionItem(idx)}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', marginTop: '16px' }}
                          title="Remove medicine"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>Doctor's Advice / Notes</label>
                <textarea
                  className="doc-input"
                  rows={3}
                  style={{ width: '100%', fontSize: '0.85rem', padding: '10px' }}
                  placeholder="Add general advice or instructions..."
                  value={editingPrescriptionNotes}
                  onChange={(e) => setEditingPrescriptionNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
                <button
                  type="button"
                  className="doc-btn-secondary"
                  onClick={() => setIsEditPrescriptionModalOpen(false)}
                  style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="doc-btn-primary"
                  disabled={savingEditPrescription}
                  style={{ padding: '8px 20px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {savingEditPrescription ? 'Saving Changes...' : 'Save Prescription'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DOCTOR PATIENT CASE SHEET SUMMARY MODAL ── */}
      {isHistoryDetailsModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(5px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 9999, padding: '24px'
        }}>
          <div style={{
            backgroundColor: '#ffffff', borderRadius: '16px', width: '100%',
            maxWidth: '920px', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px 28px', borderBottom: '1px solid #e2e8f0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              backgroundColor: '#0d9488', color: '#ffffff'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
                  Clinical Case Sheet Summary & Ward Log
                </h3>
                <span style={{ fontSize: '0.82rem', color: '#ccfbf1' }}>
                  Complete In-Patient IPD Clinical Audit History
                </span>
              </div>
              <button
                type="button"
                onClick={() => { setIsHistoryDetailsModalOpen(false); setHistoryDetailsData(null); }}
                style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', padding: '4px' }}
              >
                <X size={22} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1, backgroundColor: '#f8fafc' }}>
              {isLoadingHistoryDetails ? (
                <div style={{ textAlign: 'center', padding: '60px' }}>
                  <RefreshCw size={32} className="spin-animation" style={{ color: '#0d9488' }} />
                  <p style={{ marginTop: '12px', fontSize: '0.9rem', color: '#64748b' }}>Loading case sheet details...</p>
                </div>
              ) : historyDetailsData ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Patient & Admission Overview Card */}
                  <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                          {historyDetailsData.admission?.patient?.full_name || 'Patient Summary'}
                        </h4>
                        <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                          Patient Code: <strong>{historyDetailsData.admission?.patient?.patient_code}</strong> | Admitted by Dr. {historyDetailsData.admission?.doctor?.full_name || 'N/A'}
                        </p>
                      </div>
                      <span style={{
                        padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 800,
                        background: historyDetailsData.admission?.status === 'admitted' ? '#dcfce7' : '#e2e8f0',
                        color: historyDetailsData.admission?.status === 'admitted' ? '#15803d' : '#475569'
                      }}>
                        {historyDetailsData.admission?.status?.toUpperCase()}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', background: '#f8fafc', padding: '14px', borderRadius: '10px', fontSize: '0.82rem' }}>
                      <div><span style={{ color: '#64748b' }}>Current Bed:</span> <strong style={{ color: '#0d9488' }}>{formatBedNumber(historyDetailsData.admission?.bed?.bed_number || '')}</strong></div>
                      <div><span style={{ color: '#64748b' }}>Ward Category:</span> <strong>{historyDetailsData.admission?.bed?.category?.name || 'Standard'}</strong></div>
                      <div><span style={{ color: '#64748b' }}>Admission Date:</span> <strong>{new Date(historyDetailsData.admission?.admission_datetime).toLocaleDateString()}</strong></div>
                      <div><span style={{ color: '#64748b' }}>Stay Duration:</span> <strong>{historyDetailsData.admission?.stay_days || 1} Days</strong></div>
                    </div>

                    <div style={{ marginTop: '14px', fontSize: '0.85rem' }}>
                      <span style={{ fontWeight: 700, color: '#334155' }}>Primary Diagnosis: </span>
                      <span style={{ fontStyle: 'italic', color: '#475569' }}>{historyDetailsData.admission?.diagnosis || 'No initial diagnosis recorded'}</span>
                    </div>
                  </div>

                  {/* Bed Transfer History */}
                  {historyDetailsData.transfers && historyDetailsData.transfers.length > 0 && (
                    <div style={{ background: '#ffffff', padding: '16px 20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <h5 style={{ margin: '0 0 12px', fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>🔀 Bed Movement / Transfer History</h5>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {historyDetailsData.transfers.map((tr: any) => (
                          <div key={tr.id} style={{ fontSize: '0.8rem', padding: '8px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                            <span>Transferred from {formatBedNumber(tr.from_bed?.bed_number || '')} ➔ {formatBedNumber(tr.to_bed?.bed_number || '')}</span>
                            <span style={{ color: '#64748b' }}>{new Date(tr.transferred_at).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Vitals & Clinical Round Notes */}
                  <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <h5 style={{ margin: '0 0 14px', fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Activity size={18} style={{ color: '#0d9488' }} /> Patient Vitals & Clinical Assessment Log
                    </h5>
                    <div className="doc-table-container">
                      <table className="doc-table">
                        <thead>
                          <tr>
                            <th>Recorded At</th>
                            <th>Temp (°F)</th>
                            <th>Pulse (bpm)</th>
                            <th>BP (mmHg)</th>
                            <th>SpO2 (%)</th>
                            <th>Clinical Progress Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {!historyDetailsData.vitals || historyDetailsData.vitals.length === 0 ? (
                            <tr>
                              <td colSpan={6} style={{ textAlign: 'center', padding: '16px', color: '#94a3b8' }}>No clinical vitals logged yet.</td>
                            </tr>
                          ) : (
                            historyDetailsData.vitals.map((v: any) => (
                              <tr key={v.id}>
                                <td style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                                  {new Date(v.recorded_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                </td>
                                <td><span style={{ fontWeight: 700, color: v.temp > 99.5 ? '#dc2626' : '#1e293b' }}>{v.temp}°F</span></td>
                                <td>{v.pulse} bpm</td>
                                <td>{v.systolic_bp}/{v.diastolic_bp}</td>
                                <td><span style={{ fontWeight: 700, color: v.spo2 < 95 ? '#dc2626' : '#16a34a' }}>{v.spo2}%</span></td>
                                <td style={{ fontSize: '0.8rem', color: '#334155' }}>{v.nursing_notes || '-'}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* MAC Medication Log */}
                  <div style={{ background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <h5 style={{ margin: '0 0 14px', fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      💊 Medication Administration Chart (MAC) Log
                    </h5>
                    <div className="doc-table-container">
                      <table className="doc-table">
                        <thead>
                          <tr>
                            <th>Scheduled Time</th>
                            <th>Medicine & Dosage</th>
                            <th>Status</th>
                            <th>Administered Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {!historyDetailsData.medication_administrations || historyDetailsData.medication_administrations.length === 0 ? (
                            <tr>
                              <td colSpan={4} style={{ textAlign: 'center', padding: '16px', color: '#94a3b8' }}>No medication administrations logged yet.</td>
                            </tr>
                          ) : (
                            historyDetailsData.medication_administrations.map((m: any) => (
                              <tr key={m.id}>
                                <td style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                  {new Date(m.scheduled_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                </td>
                                <td><strong>{m.medicine_name}</strong> ({m.dosage})</td>
                                <td>
                                  <span style={{
                                    padding: '3px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 800,
                                    background: m.status === 'administered' ? '#dcfce7' : '#fff7ed',
                                    color: m.status === 'administered' ? '#15803d' : '#ea580c'
                                  }}>
                                    {m.status.toUpperCase()}
                                  </span>
                                </td>
                                <td style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                  {m.administered_time ? new Date(m.administered_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '16px 28px', borderTop: '1px solid #e2e8f0', backgroundColor: '#ffffff', textAlign: 'right' }}>
              <button
                type="button"
                className="doc-btn-secondary"
                onClick={() => { setIsHistoryDetailsModalOpen(false); setHistoryDetailsData(null); }}
                style={{ padding: '8px 20px', fontSize: '0.85rem', fontWeight: 700 }}
              >
                Close Case Sheet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DOCTOR WARD ROUND NOTE & VITALS LOG MODAL ── */}
      {isRoundNoteModalOpen && selectedBedForRound && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(5px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 9999, padding: '24px'
        }}>
          <div style={{
            backgroundColor: '#ffffff', borderRadius: '16px', width: '100%',
            maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid #e2e8f0'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px', borderBottom: '1px solid #e2e8f0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              backgroundColor: '#0d9488', color: '#ffffff'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                  Doctor Ward Round Progress Note
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#ccfbf1' }}>
                  {formatBedNumber(selectedBedForRound.bed_number)} · Patient: <strong>{selectedBedForRound.active_admission?.patient_name}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsRoundNoteModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveRoundNote} style={{ padding: '24px' }}>
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '0.85rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>Bedside Vitals Assessment</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Body Temp (°F)</label>
                    <input
                      type="number"
                      step="0.1"
                      className="doc-input"
                      style={{ height: '36px', fontSize: '0.85rem', margin: 0 }}
                      value={roundVitalsForm.temp}
                      onChange={(e) => setRoundVitalsForm({ ...roundVitalsForm, temp: parseFloat(e.target.value) || 98.6 })}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Pulse (bpm)</label>
                    <input
                      type="number"
                      className="doc-input"
                      style={{ height: '36px', fontSize: '0.85rem', margin: 0 }}
                      value={roundVitalsForm.pulse}
                      onChange={(e) => setRoundVitalsForm({ ...roundVitalsForm, pulse: parseInt(e.target.value) || 72 })}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>SpO2 (%)</label>
                    <input
                      type="number"
                      className="doc-input"
                      style={{ height: '36px', fontSize: '0.85rem', margin: 0 }}
                      value={roundVitalsForm.spo2}
                      onChange={(e) => setRoundVitalsForm({ ...roundVitalsForm, spo2: parseInt(e.target.value) || 98 })}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Systolic BP</label>
                    <input
                      type="number"
                      className="doc-input"
                      style={{ height: '36px', fontSize: '0.85rem', margin: 0 }}
                      value={roundVitalsForm.systolic_bp}
                      onChange={(e) => setRoundVitalsForm({ ...roundVitalsForm, systolic_bp: parseInt(e.target.value) || 120 })}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Diastolic BP</label>
                    <input
                      type="number"
                      className="doc-input"
                      style={{ height: '36px', fontSize: '0.85rem', margin: 0 }}
                      value={roundVitalsForm.diastolic_bp}
                      onChange={(e) => setRoundVitalsForm({ ...roundVitalsForm, diastolic_bp: parseInt(e.target.value) || 80 })}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Resp Rate (/min)</label>
                    <input
                      type="number"
                      className="doc-input"
                      style={{ height: '36px', fontSize: '0.85rem', margin: 0 }}
                      value={roundVitalsForm.respiratory_rate}
                      onChange={(e) => setRoundVitalsForm({ ...roundVitalsForm, respiratory_rate: parseInt(e.target.value) || 16 })}
                    />
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Doctor Round Clinical Evaluation & Progress Note *
                </label>
                <textarea
                  className="doc-input"
                  rows={4}
                  style={{ width: '100%', fontSize: '0.85rem', padding: '10px' }}
                  placeholder="Record patient response, daily clinical round observations, medication adjustments..."
                  value={roundVitalsForm.doctor_notes}
                  onChange={(e) => setRoundVitalsForm({ ...roundVitalsForm, doctor_notes: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
                <button
                  type="button"
                  className="doc-btn-secondary"
                  onClick={() => setIsRoundNoteModalOpen(false)}
                  style={{ padding: '8px 18px', fontSize: '0.85rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="doc-btn-primary"
                  disabled={submittingRoundNote}
                  style={{ padding: '8px 24px', fontSize: '0.85rem', background: '#0d9488', borderColor: '#0d9488' }}
                >
                  {submittingRoundNote ? 'Saving Note...' : 'Save Round Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          backgroundColor: toast.type === 'success' ? '#0f766e' : toast.type === 'info' ? '#0284c7' : '#ef4444',
          color: '#ffffff',
          padding: '12px 24px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          zIndex: 10000,
          fontWeight: 600,
          fontSize: '0.9rem'
        }}>
          {toast.type === 'success' ? <CheckCircle size={18} /> : toast.type === 'info' ? <Sparkles size={18} /> : <AlertTriangle size={18} />}
          {toast.message}
        </div>
      )}
    </div>
  );
};
