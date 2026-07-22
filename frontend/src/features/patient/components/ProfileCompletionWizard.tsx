import React, { useState } from 'react';
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

  const handleNextStep2 = () => {
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
    }
    setStep(3);
  };

  const handleCompleteProfile = async () => {
    setIsSubmitting(true);
    try {
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

  return (
    <div className="wizard-screen-container">
      <div className="wizard-glass-card">
        {/* Header */}
        <div className="wizard-header">
          <div className="wizard-header-logo">
            <span className="logo-v">V</span> Vertical Clinic
          </div>
          <button className="wizard-logout-btn" onClick={onLogout}>
            🚪 Sign Out
          </button>
        </div>

        <h2 className="wizard-title">Complete Your Clinical Profile</h2>
        <p className="wizard-subtitle">Help us understand your health profile to provide the best clinical care.</p>

        {/* Stepper Indicators */}
        <div className="wizard-stepper">
          <div className={`step-node ${step >= 1 ? 'active' : ''}`}>
            <span className="step-num">1</span>
            <span className="step-label">Personal Info</span>
          </div>
          <div className="step-line" />
          <div className={`step-node ${step >= 2 ? 'active' : ''}`}>
            <span className="step-num">2</span>
            <span className="step-label">Current Treatment</span>
          </div>
          <div className="step-line" />
          <div className={`step-node ${step >= 3 ? 'active' : ''}`}>
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
                  <label>Full Name</label>
                  <input type="text" className="form-input read-only" value={patientProfile?.user?.full_name || ''} readOnly />
                </div>
                <div className="form-group">
                  <label>Patient ID</label>
                  <input type="text" className="form-input read-only" value={patientProfile?.patient_code || ''} readOnly />
                </div>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Date of Birth</label>
                    <input
                      type="date"
                      className="form-input"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Age</label>
                    <input type="text" className="form-input read-only" value={calculateAge(dob) || '--'} readOnly />
                  </div>
                </div>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Gender</label>
                    <select className="form-input" value={gender} onChange={(e) => setGender(e.target.value)}>
                      <option value="M">Male</option>
                      <option value="F">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Blood Group</label>
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
                    <label>Height (cm)</label>
                    <input
                      type="text"
                      className="form-input"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                      placeholder="e.g. 175"
                    />
                  </div>
                  <div className="form-group">
                    <label>Weight (kg)</label>
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
                  <label>Mobile Number</label>
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
                    <label>Preferred Branch</label>
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
                    <label>Primary Doctor</label>
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

              {/* Right Column: Medical Alerts */}
              <div className="wizard-card-sub alert-card">
                <h3 className="wizard-sub-title" style={{ color: '#ef4444' }}>⚠️ Medical Alerts</h3>
                <div className="form-group">
                  <label>🚨 Allergies</label>
                  <input
                    type="text"
                    className="form-input"
                    value={allergies}
                    onChange={(e) => setAllergies(e.target.value)}
                    placeholder="e.g. Penicillin (Mild)"
                  />
                </div>
                <div className="form-group">
                  <label>🩺 Chronic Diseases</label>
                  <input
                    type="text"
                    className="form-input"
                    value={chronicConditions}
                    onChange={(e) => setChronicConditions(e.target.value)}
                    placeholder="e.g. Diabetes Type 2"
                  />
                </div>
                <div className="form-group">
                  <label>❤️ High Risk Flags</label>
                  <input
                    type="text"
                    className="form-input"
                    value={highRiskFlags}
                    onChange={(e) => setHighRiskFlags(e.target.value)}
                    placeholder="e.g. Hypertension"
                  />
                </div>
                <div className="form-group">
                  <label>🤰 Special Condition</label>
                  <input
                    type="text"
                    className="form-input"
                    value={specialCondition}
                    onChange={(e) => setSpecialCondition(e.target.value)}
                    placeholder="e.g. None"
                  />
                </div>
                <div className="form-group">
                  <label>🦽 Disability</label>
                  <input
                    type="text"
                    className="form-input"
                    value={disability}
                    onChange={(e) => setDisability(e.target.value)}
                    placeholder="e.g. None"
                  />
                </div>
              </div>
            </div>

            <div className="wizard-footer-actions">
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
              <h3 className="treatment-question-title">Are you currently under treatment?</h3>
              <div className="treatment-choice-btns">
                <button
                  type="button"
                  className={`choice-card-btn ${underTreatment === true ? 'active-yes' : ''}`}
                  onClick={() => setUnderTreatment(true)}
                >
                  🟢 Yes, I am under treatment
                </button>
                <button
                  type="button"
                  className={`choice-card-btn ${underTreatment === false ? 'active-no' : ''}`}
                  onClick={() => setUnderTreatment(false)}
                >
                  🔴 No, I am not
                </button>
              </div>
            </div>

            {underTreatment === true && (
              <div className="treatment-inputs-block fade-in">
                <h3 className="wizard-sub-title">🟢 Current Treatment Details</h3>
                <div className="form-group">
                  <label>Current Problem</label>
                  <input
                    type="text"
                    className="form-input"
                    value={currentProblem}
                    onChange={(e) => setCurrentProblem(e.target.value)}
                    placeholder="e.g. Tooth pain (Left Molar)"
                  />
                </div>
                <div className="form-group">
                  <label>Current Medicines</label>
                  <input
                    type="text"
                    className="form-input"
                    value={currentMedicines}
                    onChange={(e) => setCurrentMedicines(e.target.value)}
                    placeholder="e.g. Amoxicillin 500mg, Ibuprofen 400mg"
                  />
                </div>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Current Treatment Since</label>
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

                {/* Prescription File Upload */}
                <div className="form-group file-upload-wrapper">
                  <label>Latest Prescription Copy (Photo / PDF)</label>
                  <div className="file-upload-row">
                    <input
                      type="file"
                      className="form-file-input"
                      onChange={(e) => setPrescriptionFile(e.target.files?.[0] || null)}
                    />
                    <button
                      type="button"
                      className="wizard-upload-btn"
                      onClick={handlePrescriptionUpload}
                      disabled={!prescriptionFile || isUploadingPrescription}
                    >
                      {isUploadingPrescription ? 'Uploading...' : 'Upload File'}
                    </button>
                  </div>
                  {prescriptionUploadUrl && (
                    <span className="upload-badge-success">✓ Prescription document uploaded successfully!</span>
                  )}
                </div>

                {/* Treatment Reports */}
                <div className="form-group file-upload-wrapper">
                  <label>Latest Reports (related to current problem)</label>
                  <div className="file-upload-row-3">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Report Name (e.g. OPG X-Ray)"
                      value={latestReportTitle}
                      onChange={(e) => setLatestReportTitle(e.target.value)}
                    />
                    <input
                      type="file"
                      id="step2-report-file"
                      className="form-file-input"
                      onChange={(e) => setLatestReportFile(e.target.files?.[0] || null)}
                    />
                    <button
                      type="button"
                      className="wizard-upload-btn"
                      onClick={handleAddReportStep2}
                      disabled={!latestReportFile || !latestReportTitle || isUploadingReport}
                    >
                      {isUploadingReport ? 'Uploading...' : 'Add Report'}
                    </button>
                  </div>

                  {latestReports.length > 0 && (
                    <div className="uploaded-files-list">
                      <h4>Added Reports:</h4>
                      <ul>
                        {latestReports.map((r, i) => (
                          <li key={i}>
                            📄 {r.title} ({r.name})
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
                Back
              </button>
              <button className="wizard-btn-primary" onClick={handleNextStep2}>
                Next Step ➔
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Lifetime Medical Reports */}
        {step === 3 && (
          <div className="wizard-step-content fade-in">
            <h3 className="wizard-sub-title">📁 Lifetime Medical Reports</h3>
            <p className="wizard-sub-description">
              Upload any historic dental reports, general wellness reports, or previous clinic files you want to keep saved in your record. You can skip this if you do not have any files.
            </p>

            <div className="form-group file-upload-wrapper" style={{ marginTop: '20px' }}>
              <label>Add Medical Report</label>
              <div className="file-upload-row-3">
                <input
                  type="text"
                  className="form-input"
                  placeholder="Report Name (e.g. Blood Report)"
                  value={lifetimeReportTitle}
                  onChange={(e) => setLifetimeReportTitle(e.target.value)}
                />
                <input
                  type="file"
                  id="step3-report-file"
                  className="form-file-input"
                  onChange={(e) => setLifetimeReportFile(e.target.files?.[0] || null)}
                />
                <button
                  type="button"
                  className="wizard-upload-btn"
                  onClick={handleAddReportStep3}
                  disabled={!lifetimeReportFile || !lifetimeReportTitle || isUploadingLifetimeReport}
                >
                  {isUploadingLifetimeReport ? 'Uploading...' : 'Add Report'}
                </button>
              </div>

              {lifetimeReports.length > 0 && (
                <div className="uploaded-files-list" style={{ marginTop: '20px' }}>
                  <h4>Added Historic Reports:</h4>
                  <ul>
                    {lifetimeReports.map((r, i) => (
                      <li key={i}>
                        📄 {r.title} ({r.name})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="wizard-footer-actions">
              <button className="wizard-btn-secondary" onClick={() => setStep(2)}>
                Back
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
