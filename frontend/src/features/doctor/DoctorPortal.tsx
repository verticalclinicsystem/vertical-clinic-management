import React, { useState, useEffect } from 'react';
import { 
  Home, 
  Users, 
  Video, 
  FileText, 
  Clock, 
  Search,
  Plus, 
  Trash2,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  Stethoscope,
  Settings,
  Calendar,
  Bell,
  CheckCircle,
  List,
  Activity,
  Sparkles,
  RefreshCw,
  FolderOpen,
  X
} from 'lucide-react';
import { api } from '../../services/api';
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
  const [activeTab, setActiveTab] = useState<string>(() => localStorage.getItem('doctor_portal_tab') || 'dashboard');

  useEffect(() => {
    localStorage.setItem('doctor_portal_tab', activeTab);
  }, [activeTab]);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Search Patients state
  const [patientSearch, setPatientSearch] = useState<string>('');
  const [patientsList, setPatientsList] = useState<any[]>([]);
  const [selectedPatientHistory, setSelectedPatientHistory] = useState<any>(null);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  // Consultation Form state
  const [activeAppt, setActiveAppt] = useState<any>(null);
  const [symptoms, setSymptoms] = useState<string>('');
  const [diagnosis, setDiagnosis] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [vitalsBp, setVitalsBp] = useState<string>('120/80');
  const [vitalsPulse, setVitalsPulse] = useState<number>(72);
  const [vitalsTemp, setVitalsTemp] = useState<number>(98.6);
  const [prescriptionItems, setPrescriptionItems] = useState<PrescriptionItemInput[]>([]);
  const [savingConsultation, setSavingConsultation] = useState<boolean>(false);

  // Video call simulated state
  const [inVideoCall, setInVideoCall] = useState<boolean>(false);
  const [videoPatientName, setVideoPatientName] = useState<string>('');
  const [videoApptId, setVideoApptId] = useState<string>('');
  const [micMuted, setMicMuted] = useState<boolean>(false);
  const [videoMuted, setVideoMuted] = useState<boolean>(false);
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
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [aiSummary, setAiSummary] = useState<any>(null);
  const [suggestedMeds, setSuggestedMeds] = useState<any[]>([]);
  const [suggestedTreatment, setSuggestedTreatment] = useState<string>('');
  const [suggestedTreatmentNotes, setSuggestedTreatmentNotes] = useState<string>('');
  const [approved, setApproved] = useState<boolean>(false);

  // Prescriptions Tab states
  const [allPrescriptions, setAllPrescriptions] = useState<any[]>([]);
  const [selectedPrescription, setSelectedPrescription] = useState<any>(null);
  const [prescriptionSearch, setPrescriptionSearch] = useState<string>('');
  const [loadingPrescriptions, setLoadingPrescriptions] = useState<boolean>(false);

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
  const [followupPatientId, setFollowupPatientId] = useState<string>('');
  const [followupDate, setFollowupDate] = useState<string>('');
  const [followupTime, setFollowupTime] = useState<string>('10:00');
  const [followupReason, setFollowupReason] = useState<string>('');
  const [schedulingFollowup, setSchedulingFollowup] = useState<boolean>(false);
  const [upcomingFollowups, setUpcomingFollowups] = useState<any[]>([]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
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

      const payload = {
        title: activePlan.title,
        status: activePlan.status,
        total_cost: activePlan.total_cost,
        notes: activePlan.notes,
        procedures: updatedProcedures
      };

      const res = await api.put(`/treatment-plans/${activePlan.id}`, payload);
      if (res.data && res.data.success) {
        setActivePlan(res.data.data);
        showToast('Procedure status updated.');
      }
    } catch (err) {
      console.error('Error updating procedure status:', err);
      showToast('Failed to update procedure status.', 'error');
    }
  };

  // Fetch upcoming followups/appointments for list
  const fetchUpcomingFollowups = async () => {
    try {
      const res = await api.get('/appointments/?status=confirmed');
      if (res.data && res.data.success) {
        // filter future dates or just list all confirmed appointments
        const items = (res.data.data.items || []).map((item: any) => ({
          ...item,
          patient_name: item.patient?.user?.full_name || item.patient_name
        }));
        setUpcomingFollowups(items);
      }
    } catch (err) {
      console.error('Error fetching appointments:', err);
    }
  };

  // Schedule follow up appointment
  const handleScheduleFollowup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followupPatientId || !followupDate) {
      showToast('Please select a patient and select a valid date.', 'error');
      return;
    }

    setSchedulingFollowup(true);
    try {
      // Send local datetime string — DO NOT call .toISOString() which converts to UTC
      const combinedDatetime = `${followupDate}T${followupTime}:00`;
      const payload = {
        doctor_id: dashboardData?.doctor?.id || activeAppt?.doctor_id,
        branch_id: dashboardData?.doctor?.branch_id || activeAppt?.branch_id || '526e00f1-fb6f-48d4-a471-6d2e0c300cb1',
        appointment_datetime: combinedDatetime,
        treatment_type: 'Consultation',
        consultation_type: 'in_person',
        notes: followupReason || 'Follow-up consultation'
      };

      // Let's pass the patient_id explicitly.
      const payloadWithPatient = {
        ...payload,
        patient_id: followupPatientId
      };

      const resWithPat = await api.post('/appointments/', payloadWithPatient);
      if (resWithPat.data && resWithPat.data.success) {
        showToast('Follow-up scheduled successfully!');
        setFollowupReason('');
        setFollowupPatientId('');
        fetchUpcomingFollowups();
      }
    } catch (err) {
      console.error('Error scheduling follow-up:', err);
      showToast('Failed to schedule follow-up.', 'error');
    } finally {
      setSchedulingFollowup(false);
    }
  };

  // Fetch all tab contents on change
  useEffect(() => {
    if (activeTab === 'prescriptions') {
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
    try {
      const res = await api.post('/ai/analyze-notes', {
        text: textToAnalyze,
        scenario: scenarioKey
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
          suggested_treatment: result.suggested_treatment_plan || ''
        };

        setAiSummary(summaryObj);
        setSuggestedMeds(result.suggested_medications || []);
        setSuggestedTreatment(result.suggested_treatment_plan || '');
        setSuggestedTreatmentNotes(result.treatment_plan_notes || '');
        
        // Auto-populate consultation form fields from AI result
        setDiagnosis(result.suggested_treatment_plan || '');
        // Only populate notes if doctor hasn't already typed something
        if (!notes.trim()) {
          setNotes(result.treatment_plan_notes || result.summary || '');
        }
        // Auto-populate symptoms from the AI clinical summary if symptoms field is empty
        if (!symptoms.trim() && result.summary) {
          setSymptoms(result.summary);
        }
        showToast('AI Clinical Analysis loaded — review and accept below.');
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
    setSuggestedMeds([]);
    setSuggestedTreatment('');

    const fullText = CLINICAL_SCENARIOS[scenarioKey].notes;
    let currentIdx = 0;
    const interval = setInterval(() => {
      if (currentIdx < fullText.length) {
        setSymptoms(prev => prev + fullText.charAt(currentIdx));
        currentIdx++;
      } else {
        clearInterval(interval);
        setIsListening(false);
        // Automatically trigger AI analysis
        triggerAIAnalysis(fullText, scenarioKey);
      }
    }, 15);
  };

  // Voice dictation using Web Speech API or simulated fallback
  const handleStartVoiceDictation = () => {
    setApproved(false);
    setAiSummary('');
    setSuggestedMeds([]);
    setSuggestedTreatment('');
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setSymptoms('');
      };

      recognition.onresult = (event: any) => {
        const resultText = event.results[0][0].transcript;
        setSymptoms(resultText);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        showToast('Speech recognition failed. Running simulated voice dictation.', 'error');
        runSimulatedVoice();
      };

      recognition.onend = () => {
        setIsListening(false);
        // Trigger AI analysis when speech ends
        if (symptoms.trim()) {
          triggerAIAnalysis(symptoms);
        }
      };

      recognition.start();
    } else {
      // Fallback simulated voice dictation
      runSimulatedVoice();
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
    setSelectedPatientHistory({ patient });
    try {
      const consRes = await api.get(`/consultations/?patient_id=${patient.id}`);
      const prescRes = await api.get(`/prescriptions/?patient_id=${patient.id}`);
      
      setSelectedPatientHistory({
        patient,
        consultations: consRes.data?.data?.items || [],
        prescriptions: prescRes.data?.data?.items || []
      });
    } catch (err) {
      console.error('Error fetching patient history:', err);
    } finally {
      setLoadingHistory(false);
    }
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
    setPrescriptionItems([]);
    setApproved(false);
    setAiSummary(null);

    // 2. Pre-load patient history for clinical context on the consultation left-panel
    // We construct a minimal patient object from the appointment data
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

  // Save Consultation and Prescriptions
  const handleSaveConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!diagnosis.trim()) {
      alert('Please enter a diagnosis.');
      return;
    }

    setSavingConsultation(true);
    try {
      const consultPayload = {
        appointment_id: activeAppt.id,
        patient_id: activeAppt.patient_id,
        doctor_id: dashboardData?.doctor?.id || activeAppt.doctor_id || "2b1aa983-108b-4f4a-a97e-322dd9242270",
        branch_id: activeAppt.branch_id || "526e00f1-fb6f-48d4-a471-6d2e0c300cb1",
        symptoms,
        diagnosis,
        notes,
        vitals_bp: vitalsBp,
        vitals_pulse: vitalsPulse,
        vitals_temperature: vitalsTemp
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
            notes: notes.trim() || (aiSummary?.clinical_summary ? aiSummary.clinical_summary : 'Take medicines strictly as directed.'),
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

        alert('Consultation and prescription recorded successfully!');
        setActiveAppt(null);
        fetchDashboard();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error recording consultation.');
    } finally {
      setSavingConsultation(false);
    }
  };



  // Join teleconsultation meeting
  const handleJoinVideo = async (appt: any) => {
    try {
      await api.post(`/teleconsultation/${appt.id}/create-link`);
      showToast('Video consultation room initialized!', 'success');
      fetchDashboard();
    } catch (e: any) {
      console.error(e);
      showToast('Failed to initialize video call', 'error');
    }
    setVideoPatientName(appt.patient_name);
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

  const queueItems = dashboardData?.today_appointments || [];

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
            onClick={() => { setActiveTab('dashboard'); setSelectedPatientHistory(null); }}
          >
            <Home size={18} /> Dashboard
          </div>

          <div 
            className={`doc-nav-item ${activeTab === 'queue' ? 'active' : ''}`}
            onClick={() => { setActiveTab('queue'); setSelectedPatientHistory(null); }}
          >
            <List size={18} /> Queue
          </div>
          
          <div className="doc-nav-group-label">CONSULTATION</div>
          <div 
            className={`doc-nav-item ${activeTab === 'consultation' ? 'active' : ''}`}
            onClick={() => { setActiveTab('consultation'); }}
          >
            <Stethoscope size={18} /> Consultation
          </div>

          <div 
            className={`doc-nav-item ${activeTab === 'prescriptions' ? 'active' : ''}`}
            onClick={() => { setActiveTab('prescriptions'); setSelectedPatientHistory(null); }}
          >
            <FileText size={18} /> Prescription
          </div>

          <div 
            className={`doc-nav-item ${activeTab === 'treatment' ? 'active' : ''}`}
            onClick={() => { setActiveTab('treatment'); setSelectedPatientHistory(null); }}
          >
            <Activity size={18} /> Treatment Plan
          </div>

          <div 
            className={`doc-nav-item ${activeTab === 'followup' ? 'active' : ''}`}
            onClick={() => { setActiveTab('followup'); setSelectedPatientHistory(null); }}
          >
            <Clock size={18} /> Follow-up
          </div>

          <div 
            className={`doc-nav-item ${activeTab === 'availability' ? 'active' : ''}`}
            onClick={() => { setActiveTab('availability'); setSelectedPatientHistory(null); }}
          >
            <Calendar size={18} /> Availability
          </div>
        </nav>

        <div className="doc-sidebar-footer">
          <button className="doc-btn-switch" onClick={onLogout}>
            <RefreshCw size={14} /> Switch Role
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT AREA ── */}
      <main className="doc-main">
        {/* ── TOPBAR ── */}
        <header className="doc-topbar">
          <div className="doc-title-area">
            <h1 className="doc-page-title">
              {activeTab === 'dashboard' && 'Dashboard'}
              {activeTab === 'queue' && 'Queue Management'}
              {activeTab === 'consultation' && 'Consultation'}
              {activeTab === 'prescriptions' && 'Prescription Workspace'}
              {activeTab === 'treatment' && 'Treatment Plans'}
              {activeTab === 'followup' && 'Follow-up Center'}
              {activeTab === 'availability' && 'Availability Settings'}
              {activeTab === 'workflow' && 'Full Clinic Workflow'}
            </h1>
            <p className="doc-page-subtitle">Doctor Portal · Satellite Branch</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ position: 'relative', width: '280px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--doc-text-muted)' }} />
              <input 
                type="text" 
                className="doc-input" 
                style={{ paddingLeft: '36px', height: '36px', fontSize: '0.85rem' }} 
                placeholder="Search patients, appointments, invoices..." 
              />
            </div>
            
            <select className="doc-input" style={{ width: '110px', height: '36px', fontSize: '0.85rem', padding: '0 8px' }}>
              <option>Satellite</option>
              <option>Bopal</option>
              <option>Navrangpura</option>
            </select>

            <button style={{ border: 'none', background: 'none', position: 'relative', cursor: 'pointer' }}>
              <Bell size={20} color="var(--doc-text-muted)" />
              <span style={{ position: 'absolute', top: '-2px', right: '-2px', width: '6px', height: '6px', backgroundColor: '#ef4444', borderRadius: '50%' }} />
            </button>

            <button style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
              <Settings size={20} color="var(--doc-text-muted)" />
            </button>

            <div className="doc-profile-badge">
              <div className="doc-profile-avatar" style={{ backgroundColor: '#e0f2fe', color: '#0369a1' }}>
                {doctorName.split(' ').map((n: string) => n[0]).join('')}
              </div>
              <div className="doc-profile-info">
                <span className="doc-profile-name">{doctorName}</span>
                <span className="doc-profile-role">{doctorSpecialty}</span>
              </div>
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
                                  <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>{appt.patient_name}</span>
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
                                    Completed
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
                  {dashboardData?.today_appointments?.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--doc-border)' }}>
                      <p style={{ color: 'var(--doc-text-muted)', fontSize: '0.9rem', margin: 0 }}>No patients scheduled in the queue for today.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '24px' }}>
                      {[...(dashboardData?.today_appointments || [])]
                        .sort((a: any, b: any) => new Date(b.appointment_datetime).getTime() - new Date(a.appointment_datetime).getTime())
                        .map((appt: any, idx: number) => {
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
                                  <span style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--doc-text-dark)' }}>{appt.patient_name}</span>
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
                                  <CheckCircle size={16} /> Consultation Completed
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
                                <button 
                                  onClick={() => handleJoinVideo(appt)} 
                                  className="doc-btn-secondary" 
                                  style={{ 
                                    width: '40px',
                                    height: '40px',
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center', 
                                    padding: 0,
                                    backgroundColor: appt.tele_link ? '#e0f2fe' : '#faf5ff',
                                    color: appt.tele_link ? '#0369a1' : '#7e22ce',
                                    borderColor: appt.tele_link ? '#bae6fd' : '#e9d5ff'
                                  }}
                                  title={appt.tele_link ? "Join Teleconsultation Call" : "Initialize Call"}
                                >
                                  <Video size={16} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
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
                            value={patientSearch}
                            onChange={(e) => handleSearchPatients(e.target.value)}
                          />
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
                          value={prescriptionSearch}
                          onChange={(e) => setPrescriptionSearch(e.target.value)}
                        />
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
                            <span style={{ fontSize: '0.65rem', color: 'var(--doc-text-muted)' }}>Dr. {doctorName}</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
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
                            <span style={{ fontSize: '0.78rem', color: 'var(--doc-text-muted)' }}>Status: <strong style={{ color: '#0d9488' }}>{activePlan.status.toUpperCase()}</strong></span>
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '24px' }}>
                  <div className="doc-card">
                    <h3 className="doc-card-title" style={{ marginBottom: '16px' }}>Schedule Follow-up</h3>
                    <form onSubmit={handleScheduleFollowup}>
                      <div className="doc-form-group">
                        <label className="doc-form-label">Patient Name</label>
                        <select 
                          className="doc-input" 
                          value={followupPatientId} 
                          onChange={(e) => setFollowupPatientId(e.target.value)}
                          required
                        >
                          <option value="">-- Choose Patient --</option>
                          {allPatients.map((pat) => (
                            <option key={pat.id} value={pat.id}>
                              {pat.user?.full_name} ({pat.patient_code})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="doc-form-group">
                          <label className="doc-form-label">Select Date</label>
                          <input 
                            type="date" 
                            className="doc-input" 
                            value={followupDate} 
                            onChange={(e) => setFollowupDate(e.target.value)}
                            required
                          />
                        </div>
                        <div className="doc-form-group">
                          <label className="doc-form-label">Select Time</label>
                          <input 
                            type="time" 
                            className="doc-input" 
                            value={followupTime} 
                            onChange={(e) => setFollowupTime(e.target.value)}
                            required
                          />
                        </div>
                      </div>

                      <div className="doc-form-group">
                        <label className="doc-form-label">Follow-up Reason / Clinical Notes</label>
                        <textarea 
                          className="doc-textarea" 
                          rows={3} 
                          placeholder="e.g. 6-Month scaling checkup, ortho wire revision..."
                          value={followupReason}
                          onChange={(e) => setFollowupReason(e.target.value)}
                        />
                      </div>

                      <button type="submit" className="doc-btn-primary" style={{ width: '100%' }} disabled={schedulingFollowup}>
                        {schedulingFollowup ? 'Scheduling...' : 'Schedule Follow-up Appointment'}
                      </button>
                    </form>
                  </div>

                  <div className="doc-card">
                    <h3 className="doc-card-title" style={{ marginBottom: '16px' }}>Upcoming Clinical Follow-ups</h3>
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
                          {upcomingFollowups.length === 0 ? (
                            <tr>
                              <td colSpan={3} style={{ textAlign: 'center', padding: '16px', color: 'var(--doc-text-muted)' }}>No upcoming follow-up appointments scheduled.</td>
                            </tr>
                          ) : (
                            upcomingFollowups.map((f: any) => (
                              <tr key={f.id}>
                                <td style={{ fontWeight: '600' }}>{f.patient_name}</td>
                                <td>{new Date(f.appointment_datetime).toLocaleDateString()} at {new Date(f.appointment_datetime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</td>
                                <td style={{ fontSize: '0.8rem', color: 'var(--doc-text-muted)' }}>{f.notes || '-'}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}


              {/* TAB: CONSULTATION WORKSPACE */}
              {activeTab === 'consultation' && (
                activeAppt ? (
                  <div className="doc-consultation-container">
                    {/* LEFT COLUMN: PATIENT INFO & VITALS */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                      
                      {/* PATIENT CARD */}
                      <div className="doc-card" style={{ padding: '24px', margin: 0 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '20px' }}>
                          <div style={{
                            width: '64px',
                            height: '64px',
                            borderRadius: '50%',
                            backgroundColor: '#e0f2fe',
                            color: '#0369a1',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: '700',
                            fontSize: '1.25rem',
                            marginBottom: '12px'
                          }}>
                            {activeAppt.patient_name ? activeAppt.patient_name.split(' ').map((n: string) => n[0]).join('').toUpperCase() : 'PT'}
                          </div>
                          <h3 style={{ margin: '0 0 4px 0', fontWeight: '700', fontSize: '1.1rem' }}>{activeAppt.patient_name}</h3>
                          <span style={{ fontSize: '0.8rem', color: 'var(--doc-text-muted)' }}>
                            {activeAppt.patient_code || 'PT-10234'} · 32F
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--doc-border)', paddingTop: '16px', fontSize: '0.85rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--doc-text-muted)' }}>Blood Group</span>
                            <span style={{ fontWeight: '600' }}>O+</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--doc-text-muted)' }}>Last Visit</span>
                            <span style={{ fontWeight: '600' }}>02 Jul 2026</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--doc-text-muted)' }}>Allergies</span>
                            <span style={{ fontWeight: '600', color: '#ef4444' }}>Penicillin (mild)</span>
                          </div>
                        </div>

                        <button 
                          type="button" 
                          className="doc-btn-secondary" 
                          style={{ width: '100%', marginTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.8rem', height: '36px' }}
                          onClick={() => handleViewHistory({ id: activeAppt.patient_id, full_name: activeAppt.patient_name })}
                        >
                          <FolderOpen size={16} /> Full Medical History
                        </button>
                      </div>

                      {/* VITALS CARD */}
                      <div className="doc-card" style={{ padding: '24px', margin: 0 }}>
                        <h3 style={{ fontSize: '0.9rem', fontWeight: '700', margin: '0 0 16px 0', borderBottom: '1px solid var(--doc-border)', paddingBottom: '8px' }}>
                          Vitals (entered by staff)
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.85rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--doc-text-muted)' }}>BP</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <input 
                                type="text" 
                                value={vitalsBp} 
                                onChange={(e) => setVitalsBp(e.target.value)} 
                                style={{ width: '80px', border: '1px solid var(--doc-border)', borderRadius: '4px', padding: '4px 8px', textAlign: 'right', fontWeight: '600', fontSize: '0.85rem' }}
                              />
                            </div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--doc-text-muted)' }}>Pulse</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <input 
                                type="number" 
                                value={vitalsPulse} 
                                onChange={(e) => setVitalsPulse(Number(e.target.value))} 
                                style={{ width: '80px', border: '1px solid var(--doc-border)', borderRadius: '4px', padding: '4px 8px', textAlign: 'right', fontWeight: '600', fontSize: '0.85rem' }}
                              />
                              <span style={{ fontSize: '0.75rem', color: 'var(--doc-text-muted)' }}>bpm</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: 'var(--doc-text-muted)' }}>Temp</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <input 
                                type="number" 
                                step="0.1"
                                value={vitalsTemp} 
                                onChange={(e) => setVitalsTemp(Number(e.target.value))} 
                                style={{ width: '80px', border: '1px solid var(--doc-border)', borderRadius: '4px', padding: '4px 8px', textAlign: 'right', fontWeight: '600', fontSize: '0.85rem' }}
                              />
                              <span style={{ fontSize: '0.75rem', color: 'var(--doc-text-muted)' }}>°F</span>
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* RIGHT COLUMN: CLINICAL COPILOT & NOTES */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                      
                      {/* CHIEF COMPLAINT CARD */}
                      <div className="doc-card" style={{ padding: '24px', margin: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <h3 style={{ fontSize: '0.95rem', fontWeight: '700', margin: 0 }}>Chief Complaint & Notes</h3>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <select 
                              className="doc-input" 
                              style={{ width: '150px', height: '32px', padding: '0 8px', fontSize: '0.78rem', marginBottom: 0 }}
                              value={selectedScenario || ''}
                              onChange={(e) => handleStartScenario(e.target.value)}
                            >
                              <option value="">-- Try Demo Scenario --</option>
                              <option value="rct">🦷 Root Canal Simulation</option>
                              <option value="ortho">😬 Orthodontic Simulation</option>
                              <option value="extraction">💉 Extraction Simulation</option>
                              <option value="scaling">🧼 Scaling & Polish Simulation</option>
                            </select>
                            <button 
                              type="button" 
                              onClick={handleStartVoiceDictation} 
                              className="doc-btn-secondary" 
                              style={{ height: '32px', padding: '0 12px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px', borderColor: isListening ? '#ef4444' : '' }}
                            >
                              {isListening ? <MicOff size={14} color="#ef4444" /> : <Mic size={14} />}
                              <span>{isListening ? 'Stop' : 'Speak'}</span>
                            </button>
                          </div>
                        </div>

                        <textarea 
                          className="doc-textarea" 
                          rows={4}
                          value={symptoms}
                          onChange={(e) => setSymptoms(e.target.value)}
                          placeholder="Chief complaint of the patient..."
                          style={{ fontSize: '0.85rem', lineHeight: '1.4' }}
                        />
                      </div>

                      {/* AI GENERATED NOTES CARD */}
                      {(aiSummary || isAnalyzing) && (
                        <div className="doc-card" style={{ padding: '24px', margin: 0, border: '1px solid #ccfbf1', backgroundColor: '#fafdfc' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Sparkles size={18} color="var(--doc-primary)" />
                              <h3 style={{ fontSize: '0.95rem', fontWeight: '700', margin: 0, color: '#0f766e' }}>AI Generated Notes</h3>
                            </div>
                            <span style={{ fontSize: '0.72rem', backgroundColor: '#e2e8f0', color: '#475569', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                              Draft
                            </span>
                          </div>

                          {isAnalyzing ? (
                            <div style={{ padding: '20px 0', textAlign: 'center' }}>
                              <div style={{
                                display: 'inline-block',
                                border: '3px solid #ccfbf1',
                                borderTop: '3px solid #0d9488',
                                borderRadius: '50%',
                                width: '24px',
                                height: '24px',
                                animation: 'spin 1s linear infinite',
                                marginBottom: '10px'
                              }} />
                              <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--doc-text-muted)' }}>AI is listening and compiling clinic notes...</p>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.85rem', color: '#334155' }}>
                              <div>
                                <p style={{ margin: '0 0 6px 0', lineHeight: '1.4' }}>
                                  <strong>Summary:</strong> {aiSummary.clinical_summary || 'No summary compiled.'}
                                </p>
                                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                                  <strong>Suggested next step:</strong> {aiSummary.treatment_notes || 'Continue monitoring.'}
                                </p>
                              </div>

                              {/* AI suggested prescription block */}
                              {aiSummary.medications && aiSummary.medications.length > 0 && (
                                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#ffffff', padding: '12px' }}>
                                  <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>
                                    💊 AI Suggested Prescription:
                                  </span>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {aiSummary.medications.map((med: any, i: number) => (
                                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', borderBottom: i < aiSummary.medications.length-1 ? '1px solid #f1f5f9' : 'none', paddingBottom: '4px' }}>
                                        <span><strong>{med.medicine_name}</strong> — {med.dosage} ({med.instructions})</span>
                                        <span style={{ color: '#64748b', fontSize: '0.78rem' }}>{med.duration}</span>
                                      </div>
                                    ))}
                                  </div>
                                  <button 
                                    type="button" 
                                    onClick={applyAISuggestions}
                                    className="doc-btn-secondary" 
                                    style={{ width: '100%', marginTop: '12px', height: '32px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                  >
                                    <Plus size={14} /> Apply Suggestions to Prescription
                                  </button>
                                </div>
                              )}

                              {/* Suggested treatment plan block */}
                              {aiSummary.suggested_treatment && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f0fdfa', border: '1px solid #b2f5ea', borderRadius: '8px', padding: '12px' }}>
                                  <span style={{ fontSize: '0.8rem' }}>
                                    Suggested Treatment: <strong>{aiSummary.suggested_treatment}</strong>
                                  </span>
                                  <button 
                                    type="button" 
                                    onClick={applyAITreatmentPlan}
                                    className="doc-btn-secondary" 
                                    style={{ height: '28px', padding: '0 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                                  >
                                    <Plus size={12} /> Add to Treatment Plan
                                  </button>
                                </div>
                              )}

                              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
                                <button 
                                  type="button" 
                                  className="doc-btn-secondary" 
                                  style={{ height: '32px', fontSize: '0.8rem' }}
                                  onClick={() => {
                                    setSymptoms(aiSummary.clinical_summary || '');
                                    setDiagnosis(aiSummary.diagnosis || '');
                                    setNotes(aiSummary.treatment_notes || '');
                                    showToast('Assessment contents copied to complaint and notes!');
                                  }}
                                >
                                  Edit
                                </button>
                                <button 
                                  type="button" 
                                  className="doc-btn-primary" 
                                  style={{ 
                                    height: '32px', 
                                    fontSize: '0.8rem', 
                                    backgroundColor: approved ? '#f0fdf4' : '#10b981', 
                                    borderColor: approved ? '#bbf7d0' : '#10b981',
                                    color: approved ? '#166534' : '#ffffff' 
                                  }}
                                  disabled={approved}
                                  onClick={() => {
                                    setApproved(true);
                                    setDiagnosis(aiSummary.diagnosis || 'Diagnosis Code');
                                    showToast('Clinical notes approved and set!');
                                  }}
                                >
                                  {approved ? 'Approved ✓' : 'Approve Notes'}
                                </button>
                              </div>

                            </div>
                          )}
                        </div>
                      )}

                      {/* PRESCRIPTION BUILDER SECTION */}
                      <div className="doc-card" style={{ padding: '24px', margin: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                          <h3 style={{ fontSize: '0.95rem', fontWeight: '700', margin: 0 }}>Prescription Builder</h3>
                          <button 
                            type="button" 
                            onClick={addPrescriptionItem} 
                            className="doc-btn-secondary" 
                            style={{ height: '30px', padding: '0 12px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Plus size={14} /> Add Drug Row
                          </button>
                        </div>

                        {prescriptionItems.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '16px', border: '1px dashed var(--doc-border)', borderRadius: '8px', color: 'var(--doc-text-muted)', fontSize: '0.8rem' }}>
                            No medications added. Click "Add Drug Row" or apply from AI suggestions.
                          </div>
                        ) : (
                          <div className="doc-table-container">
                            <table className="doc-table">
                              <thead>
                                <tr>
                                  <th>Medicine</th>
                                  <th>Dosage</th>
                                  <th>Duration</th>
                                  <th>Instructions</th>
                                  <th style={{ width: '40px' }}></th>
                                </tr>
                              </thead>
                              <tbody>
                                {prescriptionItems.map((item, idx) => (
                                  <tr key={idx}>
                                    <td>
                                      <input 
                                        type="text" 
                                        className="doc-input" 
                                        value={item.medicine_name} 
                                        onChange={(e) => updatePrescriptionItem(idx, 'medicine_name', e.target.value)}
                                        placeholder="e.g. Paracetamol"
                                        style={{ marginBottom: 0, height: '32px', fontSize: '0.8rem' }}
                                      />
                                    </td>
                                    <td>
                                      <input 
                                        type="text" 
                                        className="doc-input" 
                                        value={item.dosage} 
                                        onChange={(e) => updatePrescriptionItem(idx, 'dosage', e.target.value)}
                                        placeholder="e.g. 1-0-1"
                                        style={{ marginBottom: 0, height: '32px', fontSize: '0.8rem' }}
                                      />
                                    </td>
                                    <td>
                                      <input 
                                        type="text" 
                                        className="doc-input" 
                                        value={item.duration} 
                                        onChange={(e) => updatePrescriptionItem(idx, 'duration', e.target.value)}
                                        placeholder="e.g. 3 days"
                                        style={{ marginBottom: 0, height: '32px', fontSize: '0.8rem' }}
                                      />
                                    </td>
                                    <td>
                                      <input 
                                        type="text" 
                                        className="doc-input" 
                                        value={item.instructions} 
                                        onChange={(e) => updatePrescriptionItem(idx, 'instructions', e.target.value)}
                                        placeholder="e.g. Take after food"
                                        style={{ marginBottom: 0, height: '32px', fontSize: '0.8rem' }}
                                      />
                                    </td>
                                    <td>
                                      <button 
                                        type="button" 
                                        onClick={() => removePrescriptionItem(idx)}
                                        style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer' }}
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* WORKFLOW BUTTONS BAR AT BOTTOM */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '12px' }}>
                        <button 
                          type="button" 
                          className="doc-btn-secondary" 
                          style={{ height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: '600' }}
                          onClick={() => setActiveTab('treatment')}
                        >
                          <Activity size={16} /> Treatment Plan
                        </button>

                        <button 
                          type="button" 
                          className="doc-btn-secondary" 
                          disabled={savingConsultation}
                          style={{ 
                            height: '42px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            gap: '8px', 
                            fontSize: '0.85rem', 
                            fontWeight: '600',
                            color: '#16a34a',
                            borderColor: '#16a34a',
                            backgroundColor: '#f0fdf4',
                            opacity: savingConsultation ? 0.7 : 1,
                            cursor: savingConsultation ? 'not-allowed' : 'pointer'
                          }}
                          onClick={async () => {
                            if (!diagnosis) {
                              showToast('Please approve notes or enter a diagnosis in the AI Generated Notes / Assessment first.', 'error');
                              return;
                            }
                            await handleSaveConsultation({ preventDefault: () => {} } as any);
                          }}
                        >
                          <CheckCircle size={16} /> {savingConsultation ? 'Recording...' : 'Complete Consultation'}
                        </button>

                        <button 
                          type="button" 
                          className="doc-btn-primary" 
                          style={{ height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: '600' }}
                          onClick={() => setActiveTab('followup')}
                        >
                          <Clock size={16} /> Schedule Follow-up
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
              {/* Primary Video Feed */}
              <div className="video-main-screen">
                <div className="video-patient-avatar">
                  {videoPatientName.split(' ').map(n => n[0]).join('')}
                </div>
                <div style={{ position: 'absolute', bottom: '20px', left: '20px', color: 'white', fontSize: '0.88rem', background: 'rgba(0,0,0,0.6)', padding: '4px 10px', borderRadius: '4px' }}>
                  {videoPatientName} (Patient Feed)
                </div>

                {/* Self Feed Overlay */}
                <div className="video-self-preview">
                  <span>Dr. Rohan Mehta</span>
                </div>
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

            {/* Video Feed Mute/Hangup Actions Bar */}
            <footer className="video-controls">
              <button 
                onClick={() => setMicMuted(!micMuted)} 
                className="video-control-btn"
                title={micMuted ? "Unmute Mic" : "Mute Mic"}
              >
                {micMuted ? <MicOff size={18} color="#ef4444" /> : <Mic size={18} />}
              </button>
              <button 
                onClick={() => setVideoMuted(!videoMuted)} 
                className="video-control-btn"
                title={videoMuted ? "Turn Video On" : "Turn Video Off"}
              >
                {videoMuted ? <VideoOff size={18} color="#ef4444" /> : <Video size={18} />}
              </button>
              <button 
                onClick={() => setInVideoCall(false)} 
                className="video-control-btn hangup"
                title="Hang Up Call"
              >
                <PhoneOff size={18} />
              </button>
            </footer>
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
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          backgroundColor: toast.type === 'success' ? '#0f766e' : '#ef4444',
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
          {toast.type === 'success' ? <CheckCircle size={18} /> : <CheckCircle size={18} />}
          {toast.message}
        </div>
      )}
    </div>
  );
};
