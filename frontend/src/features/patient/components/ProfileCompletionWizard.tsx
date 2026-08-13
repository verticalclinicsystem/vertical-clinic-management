import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';

interface Branch {
  id: string;
  name: string;
  city: string;
}

interface Doctor {
  id: string;
  user: {
    full_name: string;
  };
  specialization: string;
}

interface ProfileCompletionWizardProps {
  patientProfile: any;
  branches: Branch[];
  doctors: Doctor[];
  onComplete: () => void;
  onLogout: () => void;
  triggerToast: (type: 'success' | 'error' | 'info', msg: string) => void;
}

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

export const ProfileCompletionWizard: React.FC<ProfileCompletionWizardProps> = ({
  patientProfile,
  branches,
  doctors,
  onComplete,
  onLogout,
  triggerToast,
}) => {
  const [step, setStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Step 1: Personal Details & Alerts
  const [dob, setDob] = useState<string>('');
  const [gender, setGender] = useState<string>('M');
  const [bloodGroup, setBloodGroup] = useState<string>('O+');
  const [height, setHeight] = useState<string>(patientProfile?.height || '');
  const [weight, setWeight] = useState<string>(patientProfile?.weight || '');
  const [mobile, setMobile] = useState<string>(patientProfile?.user?.phone || '');
  const [preferredBranchId, setPreferredBranchId] = useState<string>(patientProfile?.preferred_branch_id || '');
  const [preferredDoctorId, setPreferredDoctorId] = useState<string>('');
  
  // Medical Alerts
  const [allergies, setAllergies] = useState<string>('');
  const [chronicConditions, setChronicConditions] = useState<string>('');
  const [highRiskFlags, setHighRiskFlags] = useState<string>('');
  const [specialCondition, setSpecialCondition] = useState<string>('');
  const [disability, setDisability] = useState<string>('');

  // Step 2: Current Treatment
  const [underTreatment, setUnderTreatment] = useState<boolean | null>(null);
  const [currentProblem, setCurrentProblem] = useState<string>('');
  const [currentMedicines, setCurrentMedicines] = useState<string>('');
  const [treatmentSince, setTreatmentSince] = useState<string>('');
  const [prescriptionDate, setPrescriptionDate] = useState<string>('');
  const [prescriptionFile, setPrescriptionFile] = useState<File | null>(null);
  const [prescriptionUploadUrl, setPrescriptionUploadUrl] = useState<string>('');
  const [isUploadingPrescription, setIsUploadingPrescription] = useState<boolean>(false);

  const [latestReportTitle, setLatestReportTitle] = useState<string>('');
  const [latestReportFile, setLatestReportFile] = useState<File | null>(null);
  const [isUploadingReport, setIsUploadingReport] = useState<boolean>(false);
  const [latestReports, setLatestReports] = useState<any[]>([]);

  // Step 3: Lifetime Medical Reports
  const [lifetimeReportTitle, setLifetimeReportTitle] = useState<string>('');
  const [lifetimeReportFile, setLifetimeReportFile] = useState<File | null>(null);
  const [isUploadingLifetimeReport, setIsUploadingLifetimeReport] = useState<boolean>(false);
  const [lifetimeReports, setLifetimeReports] = useState<any[]>([]);

  // Prefill existing patientProfile data on mount / update
  useEffect(() => {
    if (!patientProfile) return;

    if (patientProfile.date_of_birth) {
      setDob(patientProfile.date_of_birth.substring(0, 10));
    }
    if (patientProfile.gender) setGender(patientProfile.gender);
    if (patientProfile.blood_group) setBloodGroup(patientProfile.blood_group);
    if (patientProfile.height) setHeight(patientProfile.height);
    if (patientProfile.weight) setWeight(patientProfile.weight);
    if (patientProfile.user?.phone) setMobile(patientProfile.user.phone);
    else if (patientProfile.phone) setMobile(patientProfile.phone);

    if (patientProfile.preferred_branch_id) {
      setPreferredBranchId(patientProfile.preferred_branch_id);
    } else if (branches && branches.length > 0 && !preferredBranchId) {
      setPreferredBranchId(branches[0].id);
    }

    if (doctors && doctors.length > 0 && !preferredDoctorId) {
      setPreferredDoctorId(doctors[0].id);
    }

    if (patientProfile.allergies && patientProfile.allergies !== 'None') {
      setAllergies(patientProfile.allergies);
    }

    if (patientProfile.chronic_conditions) {
      try {
        const parsed = typeof patientProfile.chronic_conditions === 'string'
          ? JSON.parse(patientProfile.chronic_conditions)
          : patientProfile.chronic_conditions;

        if (parsed.chronicDiseases && parsed.chronicDiseases !== 'None') setChronicConditions(parsed.chronicDiseases);
        if (parsed.highRiskFlags && parsed.highRiskFlags !== 'None') setHighRiskFlags(parsed.highRiskFlags);
        if (parsed.specialCondition && parsed.specialCondition !== 'None') setSpecialCondition(parsed.specialCondition);
        if (parsed.disability && parsed.disability !== 'None') setDisability(parsed.disability);
      } catch (e) {
        if (typeof patientProfile.chronic_conditions === 'string') {
          setChronicConditions(patientProfile.chronic_conditions);
        }
      }
    }

    if (patientProfile.current_treatment_details) {
      try {
        const parsed = typeof patientProfile.current_treatment_details === 'string'
          ? JSON.parse(patientProfile.current_treatment_details)
          : patientProfile.current_treatment_details;

        if (parsed) {
          setUnderTreatment(true);
          if (parsed.currentProblem) setCurrentProblem(parsed.currentProblem);
          if (parsed.currentMedicines) setCurrentMedicines(parsed.currentMedicines);
          if (parsed.treatmentSince) setTreatmentSince(parsed.treatmentSince);
          if (parsed.prescriptionDate) setPrescriptionDate(parsed.prescriptionDate);
          if (parsed.prescriptionUrl) setPrescriptionUploadUrl(parsed.prescriptionUrl);
          if (Array.isArray(parsed.reports)) setLatestReports(parsed.reports);
        }
      } catch (e) {
        // ignore
      }
    }
  }, [patientProfile, branches, doctors]);

  const handleAutofillDemoData = () => {
    setDob('1994-07-15');
    setGender('M');
    setBloodGroup('O+');
    setHeight('172');
    setWeight('74');
    if (!mobile && patientProfile?.user?.phone) setMobile(patientProfile.user.phone);
    if (!mobile) setMobile('7895325634');
    if (branches && branches.length > 0) setPreferredBranchId(branches[0].id);
    if (doctors && doctors.length > 0) setPreferredDoctorId(doctors[0].id);

    setAllergies('Penicillin (Mild)');
    setChronicConditions('Diabetes Type 2');
    setHighRiskFlags('Hypertension');
    setSpecialCondition('None');
    setDisability('None');

    setUnderTreatment(true);
    setCurrentProblem('Tooth pain (Left Molar)');
    setCurrentMedicines('Amoxicillin 500mg, Ibuprofen 400mg');
    setTreatmentSince('2026-07-12');
    setPrescriptionDate('2026-07-15');

    triggerToast('success', 'Sample clinical profile auto-filled! You can now click Next Step.');
  };

  // Helpers
  const calculateAge = (dobString: string): string => {
    if (!dobString) return '';
    const birthDate = new Date(dobString);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 0 ? `${age} Years` : '0 Years';
  };

  const uploadFile = async (file: File, type: string): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('report_type', type);
    const res = await api.post('/medical-reports/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data?.data?.file_url || res.data?.file_url || '';
  };

  const handlePrescriptionUpload = async () => {
    if (!prescriptionFile) return;
    setIsUploadingPrescription(true);
    try {
      const url = await uploadFile(prescriptionFile, 'Prescription');
      setPrescriptionUploadUrl(url);
      triggerToast('success', 'Prescription document uploaded!');
    } catch (err) {
      triggerToast('error', 'Failed to upload prescription.');
    } finally {
      setIsUploadingPrescription(false);
    }
  };

  const handleAddReportStep2 = async () => {
    if (!latestReportFile || !latestReportTitle) {
      triggerToast('error', 'Please enter a report title and select a file.');
      return;
    }
    setIsUploadingReport(true);
    try {
      const url = await uploadFile(latestReportFile, 'Diagnostic Report');
      setLatestReports([...latestReports, { title: latestReportTitle, url, name: latestReportFile.name }]);
      setLatestReportTitle('');
      setLatestReportFile(null);
      // Clear input
      const fileInput = document.getElementById('step2-report-file') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      triggerToast('success', 'Report document uploaded and added!');
    } catch (err) {
      triggerToast('error', 'Failed to upload report.');
    } finally {
      setIsUploadingReport(false);
    }
  };

  const handleAddReportStep3 = async () => {
    if (!lifetimeReportFile || !lifetimeReportTitle) {
      triggerToast('error', 'Please enter a report title and select a file.');
      return;
    }
    setIsUploadingLifetimeReport(true);
    try {
      const url = await uploadFile(lifetimeReportFile, 'Historical Report');
      setLifetimeReports([...lifetimeReports, { title: lifetimeReportTitle, url, name: lifetimeReportFile.name }]);
      setLifetimeReportTitle('');
      setLifetimeReportFile(null);
      // Clear input
      const fileInput = document.getElementById('step3-report-file') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      triggerToast('success', 'Historical report document uploaded and added!');
    } catch (err) {
      triggerToast('error', 'Failed to upload report.');
    } finally {
      setIsUploadingLifetimeReport(false);
    }
  };

  const handleNextStep1 = () => {
    if (!dob) {
      triggerToast('error', 'Please enter your Date of Birth.');
      return;
    }
    if (!mobile) {
      triggerToast('error', 'Please enter your Mobile number.');
      return;
    }
    if (!preferredBranchId) {
      triggerToast('error', 'Please select a preferred branch.');
      return;
    }
    setStep(2);
  };

  const handleNextStep2 = async () => {
    if (underTreatment === null) {
      triggerToast('error', 'Please choose whether you are currently under treatment.');
      return;
    }
    if (underTreatment) {
      if (!currentProblem) {
        triggerToast('error', 'Please state your current problem.');
        return;
      }
      if (!currentMedicines) {
        triggerToast('error', 'Please enter your current medicines.');
        return;
      }
      if (!treatmentSince) {
        triggerToast('error', 'Please enter when your treatment started.');
        return;
      }

      // Auto upload prescription if selected but not uploaded yet
      if (prescriptionFile && !prescriptionUploadUrl) {
        setIsUploadingPrescription(true);
        try {
          triggerToast('info', 'Uploading prescription...');
          const url = await uploadFile(prescriptionFile, 'Prescription');
          setPrescriptionUploadUrl(url);
          triggerToast('success', 'Prescription uploaded!');
        } catch (err) {
          triggerToast('error', 'Prescription upload failed.');
          setIsUploadingPrescription(false);
          return;
        }
        setIsUploadingPrescription(false);
      }

      // Auto upload report if selected but not added yet
      if (latestReportFile && latestReportTitle) {
        setIsUploadingReport(true);
        try {
          triggerToast('info', `Uploading report: ${latestReportTitle}...`);
          const url = await uploadFile(latestReportFile, 'Diagnostic Report');
          const updatedReports = [...latestReports, { title: latestReportTitle, url, name: latestReportFile.name }];
          setLatestReports(updatedReports);
          setLatestReportTitle('');
          setLatestReportFile(null);
          const fileInput = document.getElementById('step2-report-file') as HTMLInputElement;
          if (fileInput) fileInput.value = '';
          triggerToast('success', 'Report document uploaded and added!');
        } catch (err) {
          triggerToast('error', 'Report upload failed.');
          setIsUploadingReport(false);
          return;
        }
        setIsUploadingReport(false);
      } else if (latestReportFile && !latestReportTitle) {
        triggerToast('error', 'Please enter a report title for your selected file.');
        return;
      }
    }
    setStep(3);
  };

  const handleCompleteProfile = async () => {
    setIsSubmitting(true);
    try {
      // Auto upload historic report if selected but not added yet
      let finalLifetimeReports = [...lifetimeReports];
      if (lifetimeReportFile && lifetimeReportTitle) {
        try {
          triggerToast('info', `Uploading historic report: ${lifetimeReportTitle}...`);
          const url = await uploadFile(lifetimeReportFile, 'Historical Report');
          finalLifetimeReports.push({ title: lifetimeReportTitle, url, name: lifetimeReportFile.name });
          setLifetimeReports(finalLifetimeReports);
          setLifetimeReportTitle('');
          setLifetimeReportFile(null);
          const fileInput = document.getElementById('step3-report-file') as HTMLInputElement;
          if (fileInput) fileInput.value = '';
          triggerToast('success', 'Historic report uploaded!');
        } catch (err) {
          triggerToast('error', 'Failed to upload historic report.');
          setIsSubmitting(false);
          return;
        }
      } else if (lifetimeReportFile && !lifetimeReportTitle) {
        triggerToast('error', 'Please enter a report title for your selected file.');
        setIsSubmitting(false);
        return;
      }

      // 1. Compile chronic conditions object
      const compiledChronicConditions = JSON.stringify({
        chronicDiseases: chronicConditions || 'None',
        highRiskFlags: highRiskFlags || 'None',
        specialCondition: specialCondition || 'None',
        disability: disability || 'None',
      });

      // 2. Compile current treatment details
      const compiledCurrentTreatmentDetails = underTreatment
        ? JSON.stringify({
            currentProblem,
            currentMedicines,
            treatmentSince,
            prescriptionDate,
            prescriptionUrl: prescriptionUploadUrl,
            reports: latestReports,
          })
        : null;

      // 3. Patch the patient profile
      await api.patch('/patients/me', {
        date_of_birth: dob ? `${dob}T00:00:00` : null,
        gender,
        blood_group: bloodGroup,
        phone: mobile,
        preferred_branch_id: preferredBranchId || null,
        allergies: allergies || 'None',
        chronic_conditions: compiledChronicConditions,
        current_treatment_details: compiledCurrentTreatmentDetails,
        is_profile_completed: true,
        height: height || null,
        weight: weight || null,
      });

      triggerToast('success', 'Profile completed successfully! Welcome to your dashboard.');
      onComplete();
    } catch (err) {
      triggerToast('error', 'Failed to complete profile registration. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper for chip toggling
  const handleChipToggle = (current: string, tag: string, setter: (val: string) => void) => {
    if (tag === 'None' || tag === 'No Known Allergies') {
      setter(tag);
      return;
    }
    if (!current || current === 'None' || current === 'No Known Allergies') {
      setter(tag);
      return;
    }
    const items = current.split(',').map((s) => s.trim()).filter(Boolean);
    if (items.includes(tag)) {
      const remaining = items.filter((i) => i !== tag);
      setter(remaining.length > 0 ? remaining.join(', ') : 'None');
    } else {
      items.push(tag);
      setter(items.join(', '));
    }
  };

  const isChipSelected = (current: string, tag: string) => {
    if (!current) return false;
    if (current === tag) return true;
    return current.split(',').map((s) => s.trim()).includes(tag);
  };

  const handleRemoveLatestReport = (idx: number) => {
    setLatestReports((prev) => prev.filter((_, i) => i !== idx));
    triggerToast('info', 'Report removed');
  };

  const handleRemoveLifetimeReport = (idx: number) => {
    setLifetimeReports((prev) => prev.filter((_, i) => i !== idx));
    triggerToast('info', 'Historic report removed');
  };

  const progressPercentage = step === 1 ? 33 : step === 2 ? 66 : 100;

  return (
    <div className="wizard-screen-container">
      <div className="wizard-glass-card">
        {/* Header */}
        <div className="wizard-header">
          <div className="wizard-header-logo">
            <span className="logo-v">V</span> Vertical Clinic
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleAutofillDemoData}
              style={{
                fontSize: '0.82rem',
                padding: '7px 14px',
                borderRadius: '8px',
                backgroundColor: '#e0f2fe',
                color: '#0369a1',
                border: '1px solid #bae6fd',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              ⚡ Auto-Fill Demo Clinical Data
            </button>
            <button className="wizard-logout-btn" onClick={onLogout}>
              🚪 Sign Out
            </button>
          </div>
        </div>

        <h2 className="wizard-title">Complete Your Clinical Profile</h2>
        <p className="wizard-subtitle">Help us understand your health profile to provide the best clinical care.</p>

        {/* Animated Progress Track */}
        <div className="wizard-progress-track">
          <div className="wizard-progress-bar" style={{ width: `${progressPercentage}%` }} />
        </div>

        {/* Stepper Indicators */}
        <div className="wizard-stepper">
          <div className={`step-node ${step === 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
            <span className="step-num">{step > 1 ? '✓' : '1'}</span>
            <span className="step-label">Personal Info</span>
          </div>
          <div className="step-line" />
          <div className={`step-node ${step === 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
            <span className="step-num">{step > 2 ? '✓' : '2'}</span>
            <span className="step-label">Current Treatment</span>
          </div>
          <div className="step-line" />
          <div className={`step-node ${step === 3 ? 'active' : ''}`}>
            <span className="step-num">3</span>
            <span className="step-label">Medical Reports</span>
          </div>
        </div>

        {/* STEP 1: Personal Details & Alerts */}
        {step === 1 && (
          <div className="wizard-step-content fade-in">
            <div className="wizard-grid-layout">
              {/* Left Column: Personal details */}
              <div className="wizard-card-sub">
                <h3 className="wizard-sub-title">👤 Patient Information</h3>
                
                <div className="form-group">
                  <label>
                    Full Name <span className="required-tag">*</span>
                  </label>
                  <div className="readonly-field-wrapper">
                    <input type="text" className="form-input read-only" value={patientProfile?.user?.full_name || ''} readOnly />
                    <span className="readonly-lock-badge">🔒 System Record</span>
                  </div>
                </div>

                <div className="form-group">
                  <label>
                    Patient ID <span className="required-tag">*</span>
                  </label>
                  <div className="readonly-field-wrapper">
                    <input type="text" className="form-input read-only" value={patientProfile?.patient_code || ''} readOnly />
                    <span className="readonly-lock-badge">🔒 System Record</span>
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>
                      📅 Date of Birth <span className="required-tag">*</span>
                    </label>
                    <input
                      type="date"
                      className="form-input"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>⏳ Calculated Age</label>
                    <div className="readonly-field-wrapper">
                      <input type="text" className="form-input read-only" value={calculateAge(dob) || '--'} readOnly />
                      <span className="readonly-lock-badge">Auto</span>
                    </div>
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>👤 Gender</label>
                    <select className="form-input" value={gender} onChange={(e) => setGender(e.target.value)}>
                      <option value="M">Male</option>
                      <option value="F">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>🩸 Blood Group</label>
                    <select className="form-input" value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)}>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                    </select>
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>📏 Height (cm)</label>
                    <input
                      type="text"
                      className="form-input"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                      placeholder="e.g. 175"
                    />
                  </div>
                  <div className="form-group">
                    <label>⚖️ Weight (kg)</label>
                    <input
                      type="text"
                      className="form-input"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      placeholder="e.g. 70"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>
                    📱 Mobile Number <span className="required-tag">*</span>
                  </label>
                  <input
                    type="tel"
                    className="form-input"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="+91 XXXXX XXXXX"
                  />
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>
                      🏥 Preferred Branch <span className="required-tag">*</span>
                    </label>
                    <select
                      className="form-input"
                      value={preferredBranchId}
                      onChange={(e) => setPreferredBranchId(e.target.value)}
                    >
                      <option value="">Select Branch</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.city})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>👨‍⚕️ Primary Doctor</label>
                    <select
                      className="form-input"
                      value={preferredDoctorId}
                      onChange={(e) => setPreferredDoctorId(e.target.value)}
                    >
                      <option value="">Select Doctor</option>
                      {doctors.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.user?.full_name} ({d.specialization})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Right Column: Medical Alerts with Quick Select Chips */}
              <div className="wizard-card-sub alert-card">
                <h3 className="wizard-sub-title" style={{ color: '#ef4444' }}>⚠️ Medical Alerts</h3>
                
                {/* Allergies */}
                <div className="form-group">
                  <label>🚨 Allergies</label>
                  <input
                    type="text"
                    className="form-input"
                    value={allergies}
                    onChange={(e) => setAllergies(e.target.value)}
                    placeholder="e.g. Penicillin (Mild), Sulfa"
                  />
                  <div className="quick-select-label">Quick select common allergies:</div>
                  <div className="quick-chips-container">
                    {['No Known Allergies', 'Penicillin', 'Sulfa Drugs', 'Aspirin', 'Latex'].map((tag) => (
                      <span
                        key={tag}
                        className={`chip-tag danger-tag ${isChipSelected(allergies, tag) ? 'selected' : ''}`}
                        onClick={() => handleChipToggle(allergies, tag, setAllergies)}
                      >
                        {isChipSelected(allergies, tag) ? '✓ ' : '+ '}
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Chronic Diseases */}
                <div className="form-group">
                  <label>🩺 Chronic Diseases</label>
                  <input
                    type="text"
                    className="form-input"
                    value={chronicConditions}
                    onChange={(e) => setChronicConditions(e.target.value)}
                    placeholder="e.g. Diabetes Type 2"
                  />
                  <div className="quick-select-label">Quick select:</div>
                  <div className="quick-chips-container">
                    {['None', 'Diabetes Type 2', 'Hypertension', 'Asthma', 'Thyroid'].map((tag) => (
                      <span
                        key={tag}
                        className={`chip-tag ${isChipSelected(chronicConditions, tag) ? 'selected' : ''}`}
                        onClick={() => handleChipToggle(chronicConditions, tag, setChronicConditions)}
                      >
                        {isChipSelected(chronicConditions, tag) ? '✓ ' : '+ '}
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* High Risk Flags */}
                <div className="form-group">
                  <label>❤️ High Risk Flags</label>
                  <input
                    type="text"
                    className="form-input"
                    value={highRiskFlags}
                    onChange={(e) => setHighRiskFlags(e.target.value)}
                    placeholder="e.g. Hypertension, Cardiac"
                  />
                  <div className="quick-chips-container">
                    {['None', 'Hypertension', 'Cardiac History', 'Bleeding Risk'].map((tag) => (
                      <span
                        key={tag}
                        className={`chip-tag danger-tag ${isChipSelected(highRiskFlags, tag) ? 'selected' : ''}`}
                        onClick={() => handleChipToggle(highRiskFlags, tag, setHighRiskFlags)}
                      >
                        {isChipSelected(highRiskFlags, tag) ? '✓ ' : '+ '}
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Special Condition */}
                <div className="form-group">
                  <label>🤰 Special Condition</label>
                  <input
                    type="text"
                    className="form-input"
                    value={specialCondition}
                    onChange={(e) => setSpecialCondition(e.target.value)}
                    placeholder="e.g. None"
                  />
                  <div className="quick-chips-container">
                    {['None', 'Pregnancy', 'Lactating'].map((tag) => (
                      <span
                        key={tag}
                        className={`chip-tag ${isChipSelected(specialCondition, tag) ? 'selected' : ''}`}
                        onClick={() => handleChipToggle(specialCondition, tag, setSpecialCondition)}
                      >
                        {isChipSelected(specialCondition, tag) ? '✓ ' : '+ '}
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Disability */}
                <div className="form-group">
                  <label>🦽 Disability</label>
                  <input
                    type="text"
                    className="form-input"
                    value={disability}
                    onChange={(e) => setDisability(e.target.value)}
                    placeholder="e.g. None"
                  />
                  <div className="quick-chips-container">
                    {['None', 'Mobility Impairment', 'Hearing Impairment'].map((tag) => (
                      <span
                        key={tag}
                        className={`chip-tag ${isChipSelected(disability, tag) ? 'selected' : ''}`}
                        onClick={() => handleChipToggle(disability, tag, setDisability)}
                      >
                        {isChipSelected(disability, tag) ? '✓ ' : '+ '}
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="wizard-footer-actions">
              <div />
              <button className="wizard-btn-primary" onClick={handleNextStep1}>
                Next Step ➔
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Current Treatment Questionnaire */}
        {step === 2 && (
          <div className="wizard-step-content fade-in">
            <div className="treatment-question-box">
              <h3 className="treatment-question-title">Are you currently under medical treatment?</h3>
              
              <div className="treatment-choice-btns">
                <div
                  className={`choice-card-btn ${underTreatment === true ? 'active-yes' : ''}`}
                  onClick={() => setUnderTreatment(true)}
                >
                  <div className="choice-card-header">
                    <span>🟢</span> Yes, I am under active treatment
                  </div>
                  <div className="choice-card-desc">
                    I am currently taking medications, receiving dental/medical procedures, or consulting a specialist.
                  </div>
                </div>

                <div
                  className={`choice-card-btn ${underTreatment === false ? 'active-no' : ''}`}
                  onClick={() => setUnderTreatment(false)}
                >
                  <div className="choice-card-header">
                    <span>🔴</span> No, routine checkup / healthy
                  </div>
                  <div className="choice-card-desc">
                    I am not currently taking regular prescription medicines or undergoing active medical treatment.
                  </div>
                </div>
              </div>
            </div>

            {underTreatment === true && (
              <div className="treatment-inputs-block fade-in">
                <h3 className="wizard-sub-title">🩺 Current Treatment Details</h3>
                
                <div className="form-group">
                  <label>Current Problem / Chief Complaint</label>
                  <input
                    type="text"
                    className="form-input"
                    value={currentProblem}
                    onChange={(e) => setCurrentProblem(e.target.value)}
                    placeholder="e.g. Severe tooth pain (Left lower molar), Sensitivity"
                  />
                </div>

                <div className="form-group">
                  <label>Current Medicines</label>
                  <input
                    type="text"
                    className="form-input"
                    value={currentMedicines}
                    onChange={(e) => setCurrentMedicines(e.target.value)}
                    placeholder="e.g. Amoxicillin 500mg (2x daily), Ibuprofen 400mg"
                  />
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Treatment Start Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={treatmentSince}
                      onChange={(e) => setTreatmentSince(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Latest Prescription Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={prescriptionDate}
                      onChange={(e) => setPrescriptionDate(e.target.value)}
                    />
                  </div>
                </div>

                {/* Prescription File Upload Dropzone */}
                <div className="upload-dropzone-card">
                  <div className="upload-zone-title">📄 Upload Latest Prescription (Photo / PDF)</div>
                  <div className="file-upload-row-3">
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.webp"
                      className="form-file-input"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        if (file) {
                          const validation = validateMedicalFile(file);
                          if (!validation.isValid) {
                            triggerToast('error', validation.message);
                            e.target.value = '';
                            setPrescriptionFile(null);
                            return;
                          }
                        }
                        setPrescriptionFile(file);
                      }}
                    />
                    <div />
                    <button
                      type="button"
                      className="wizard-upload-btn"
                      onClick={handlePrescriptionUpload}
                      disabled={!prescriptionFile || isUploadingPrescription}
                    >
                      {isUploadingPrescription ? 'Uploading...' : 'Upload Prescription'}
                    </button>
                  </div>
                  {prescriptionUploadUrl && (
                    <div style={{ marginTop: '10px' }}>
                      <span className="upload-badge-success">✓ Prescription document attached successfully!</span>
                    </div>
                  )}
                </div>

                {/* Treatment Reports Dropzone */}
                <div className="upload-dropzone-card">
                  <div className="upload-zone-title">📊 Add Diagnostic Reports (X-Rays, Lab Reports)</div>
                  <div className="file-upload-row-3">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Report Name (e.g. OPG Dental X-Ray)"
                      value={latestReportTitle}
                      onChange={(e) => setLatestReportTitle(e.target.value)}
                    />
                    <input
                      type="file"
                      id="step2-report-file"
                      accept=".pdf,.png,.jpg,.jpeg,.webp"
                      className="form-file-input"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        if (file) {
                          const validation = validateMedicalFile(file);
                          if (!validation.isValid) {
                            triggerToast('error', validation.message);
                            e.target.value = '';
                            setLatestReportFile(null);
                            return;
                          }
                        }
                        setLatestReportFile(file);
                      }}
                    />
                    <button
                      type="button"
                      className="wizard-upload-btn"
                      onClick={handleAddReportStep2}
                      disabled={!latestReportFile || !latestReportTitle || isUploadingReport}
                    >
                      {isUploadingReport ? 'Uploading...' : '+ Attach Report'}
                    </button>
                  </div>

                  {latestReports.length > 0 && (
                    <div className="uploaded-files-list">
                      <h4>Attached Diagnostic Reports ({latestReports.length}):</h4>
                      <ul>
                        {latestReports.map((r, i) => (
                          <li key={i} className="uploaded-file-chip">
                            <span>📄 <strong>{r.title}</strong> <small style={{ color: '#64748b' }}>({r.name})</small></span>
                            <button
                              type="button"
                              className="remove-file-btn"
                              onClick={() => handleRemoveLatestReport(i)}
                              title="Remove file"
                            >
                              ✕ Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="wizard-footer-actions">
              <button className="wizard-btn-secondary" onClick={() => setStep(1)}>
                ⬅ Back
              </button>
              <button className="wizard-btn-primary" onClick={handleNextStep2}>
                Next Step ➔
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Lifetime Medical Reports & Profile Summary */}
        {step === 3 && (
          <div className="wizard-step-content fade-in">
            <h3 className="wizard-sub-title">📁 Lifetime Medical Records & Reports</h3>
            <p className="wizard-sub-description">
              Upload any historic dental reports, general wellness reports, or previous clinic files you want saved in your electronic medical health record. You may proceed even if you do not have files to upload.
            </p>

            <div className="upload-dropzone-card">
              <div className="upload-zone-title">📁 Upload Historic Report</div>
              <div className="file-upload-row-3">
                <input
                  type="text"
                  className="form-input"
                  placeholder="Report Name (e.g. Previous Dental X-Ray 2025)"
                  value={lifetimeReportTitle}
                  onChange={(e) => setLifetimeReportTitle(e.target.value)}
                />
                <input
                  type="file"
                  id="step3-report-file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  className="form-file-input"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    if (file) {
                      const validation = validateMedicalFile(file);
                      if (!validation.isValid) {
                        triggerToast('error', validation.message);
                        e.target.value = '';
                        setLifetimeReportFile(null);
                        return;
                      }
                    }
                    setLifetimeReportFile(file);
                  }}
                />
                <button
                  type="button"
                  className="wizard-upload-btn"
                  onClick={handleAddReportStep3}
                  disabled={!lifetimeReportFile || !lifetimeReportTitle || isUploadingLifetimeReport}
                >
                  {isUploadingLifetimeReport ? 'Uploading...' : '+ Attach Historic Report'}
                </button>
              </div>

              {lifetimeReports.length > 0 && (
                <div className="uploaded-files-list">
                  <h4>Attached Historic Files ({lifetimeReports.length}):</h4>
                  <ul>
                    {lifetimeReports.map((r, i) => (
                      <li key={i} className="uploaded-file-chip">
                        <span>📄 <strong>{r.title}</strong> <small style={{ color: '#64748b' }}>({r.name})</small></span>
                        <button
                          type="button"
                          className="remove-file-btn"
                          onClick={() => handleRemoveLifetimeReport(i)}
                          title="Remove file"
                        >
                          ✕ Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Profile Summary Card Before Finalizing */}
            <div className="profile-summary-review-card">
              <div className="summary-card-title">
                📋 Profile Completion Summary Review
              </div>
              <div className="summary-grid">
                <div className="summary-item">
                  <div className="summary-item-label">Patient Name</div>
                  <div className="summary-item-val">{patientProfile?.user?.full_name || 'N/A'}</div>
                </div>
                <div className="summary-item">
                  <div className="summary-item-label">Mobile Number</div>
                  <div className="summary-item-val">{mobile || 'N/A'}</div>
                </div>
                <div className="summary-item">
                  <div className="summary-item-label">Blood Group & Gender</div>
                  <div className="summary-item-val">{bloodGroup} | {gender === 'M' ? 'Male' : gender === 'F' ? 'Female' : 'Other'}</div>
                </div>
                <div className="summary-item">
                  <div className="summary-item-label">Active Treatment</div>
                  <div className="summary-item-val" style={{ color: underTreatment ? '#15803d' : '#475569' }}>
                    {underTreatment === true ? 'Yes (Details Entered)' : underTreatment === false ? 'No (Routine Care)' : 'Not Specified'}
                  </div>
                </div>
                <div className="summary-item">
                  <div className="summary-item-label">Allergies Listed</div>
                  <div className="summary-item-val">{allergies || 'None'}</div>
                </div>
                <div className="summary-item">
                  <div className="summary-item-label">Reports Attached</div>
                  <div className="summary-item-val">{latestReports.length + lifetimeReports.length} file(s)</div>
                </div>
              </div>
            </div>

            <div className="wizard-footer-actions">
              <button className="wizard-btn-secondary" onClick={() => setStep(2)}>
                ⬅ Back
              </button>
              <button className="wizard-btn-primary success" onClick={handleCompleteProfile} disabled={isSubmitting}>
                {isSubmitting ? 'Finalizing Profile...' : 'Complete Profile & Open Dashboard ✔'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

