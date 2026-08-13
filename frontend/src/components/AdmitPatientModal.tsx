import React, { useEffect, useRef, useState } from 'react';
import { Bed, X, CheckCircle, User, Stethoscope } from 'lucide-react';

interface AdmitPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedBed: any;
  setSelectedBed: (bed: any) => void;
  activeAdmissionRequestId: string | null;
  setActiveAdmissionRequestId: (id: string | null) => void;
  admitForm: {
    patient_id: string;
    admitting_doctor_id: string;
    diagnosis: string;
    initial_deposit: number;
  };
  setAdmitForm: React.Dispatch<React.SetStateAction<{
    patient_id: string;
    admitting_doctor_id: string;
    diagnosis: string;
    initial_deposit: number;
  }>>;
  bedsData: any[];
  patients: any[];
  doctors: any[];
  pendingAdmissionRequests: any[];
  onSubmit: (e: React.FormEvent, notifyDoctor: boolean) => Promise<void>;
  categories?: any[];
}

/**
 * Reusable Admit Patient Modal component
 * Follows the Medical Teal & Blue design standard using global CSS variables.
 */
const AdmitPatientModal: React.FC<AdmitPatientModalProps> = ({
  isOpen,
  onClose,
  selectedBed,
  setSelectedBed,
  activeAdmissionRequestId,
  admitForm,
  setAdmitForm,
  bedsData,
  patients,
  doctors,
  pendingAdmissionRequests,
  onSubmit,
  categories = [],
}) => {
  const [notifyDoctor, setNotifyDoctor] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus trap / Focus first element when opened
  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      const focusable = modalRef.current?.querySelector('select, textarea, input, button') as HTMLElement;
      focusable?.focus();
    }
  }, [isOpen]);

  if (!isOpen || !selectedBed) return null;

  // Find active admission request details if any
  const activeReq = activeAdmissionRequestId
    ? pendingAdmissionRequests.find((r: any) => r.id === activeAdmissionRequestId)
    : null;

  // Group beds by category/ward using the configured categories list
  const categoriesList = (categories && categories.length > 0 ? categories : []).map((cat: any) => {
    const categoryBeds = bedsData.filter((b: any) =>
      b.category?.id === cat.id && (b.status === 'available' || b.id === selectedBed.id)
    );
    return {
      id: cat.id,
      name: cat.name,
      beds: categoryBeds
    };
  });

  // Fallback if categories are not loaded/passed
  if (categoriesList.length === 0) {
    const categoriesMap: { [catId: string]: { id: string; name: string; beds: any[] } } = {};
    bedsData.forEach((b: any) => {
      const catId = b.category?.id || 'default';
      const catName = b.category?.name || 'General Ward';
      if (!categoriesMap[catId]) {
        categoriesMap[catId] = { id: catId, name: catName, beds: [] };
      }
      if (b.status === 'available' || b.id === selectedBed.id) {
        categoriesMap[catId].beds.push(b);
      }
    });
    categoriesList.push(...Object.values(categoriesMap));
  }

  const currentCategory = categoriesList.find((c) => c.id === selectedBed.category?.id) || categoriesList[0];

  // Helper to format doctor names
  const formatDocName = (name: string) => {
    if (!name) return '';
    return name.startsWith('Dr.') ? name : `Dr. ${name}`;
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // Validation
    if (!admitForm.patient_id) {
      setErrorMsg('Please select a patient.');
      return;
    }
    if (!selectedBed.id) {
      setErrorMsg('Please select a bed.');
      return;
    }
    if (!admitForm.admitting_doctor_id) {
      setErrorMsg('Please select an admitting doctor.');
      return;
    }
    if (!admitForm.diagnosis.trim()) {
      setErrorMsg('Please enter a clinical note / diagnosis.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(e, notifyDoctor);
    } catch (err: any) {
      setErrorMsg(err.message || 'Admission failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="recep-modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1050,
        backdropFilter: 'blur(3px)',
      }}
    >
      <div
        ref={modalRef}
        className="recep-modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admit-modal-title"
        style={{
          width: '560px',
          maxWidth: '94vw',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-lg)',
          padding: 0,
          background: 'var(--surface)',
        }}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, var(--dark-sidebar) 0%, var(--deep-blue) 100%)',
            color: '#ffffff',
            padding: '20px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--bright-cyan)',
                marginBottom: '4px',
              }}
            >
              IPD Hospitalization Admission
            </div>
            <h3
              id="admit-modal-title"
              style={{
                margin: 0,
                fontSize: '1.2rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <Bed size={22} style={{ color: 'var(--bright-cyan)' }} /> Admit Patient to Bed
            </h3>
          </div>
          <button
            className="close-btn"
            onClick={onClose}
            aria-label="Close"
            style={{
              color: '#94a3b8',
              background: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleFormSubmit} style={{ padding: '24px' }}>
          {/* Error Message Alert */}
          {errorMsg && (
            <div
              style={{
                background: '#FDF2F2',
                border: '1px solid var(--danger)',
                color: 'var(--danger)',
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '0.85rem',
                fontWeight: 600,
              }}
            >
              {errorMsg}
            </div>
          )}

          {/* WARD & BED SELECTION CARD */}
          <div
            style={{
              background: '#F1F8FA',
              border: '1.5px solid var(--border)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  color: 'var(--primary-text)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Bed size={14} style={{ color: 'var(--primary-teal)' }} /> Ward & Bed Assignment
              </span>
              {activeReq?.category_name && (
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: 'var(--primary-teal)',
                    background: '#E8F7FA',
                    padding: '3px 9px',
                    borderRadius: '12px',
                    border: '1px solid var(--border)',
                  }}
                >
                  Advised Ward: {activeReq.category_name}
                </span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: 'var(--secondary-text)',
                    display: 'block',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                  }}
                >
                  Ward / Category
                </label>
                <select
                  className="recep-select-field"
                  value={selectedBed.category?.id || ''}
                  onChange={(e) => {
                    const catId = e.target.value;
                    const cat = categoriesList.find((c) => c.id === catId);
                    if (cat) {
                      if (cat.beds.length > 0) {
                        setSelectedBed(cat.beds[0]);
                      } else {
                        setSelectedBed({
                          id: '',
                          bed_number: '',
                          category: { id: cat.id, name: cat.name }
                        });
                      }
                    }
                  }}
                  required
                  style={{
                    background: '#ffffff',
                    fontWeight: 600,
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    fontSize: '0.88rem',
                    color: 'var(--primary-text)',
                  }}
                >
                  {categoriesList.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} ({cat.beds.length} Avail)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: 'var(--secondary-text)',
                    display: 'block',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                  }}
                >
                  Assign Bed Number
                </label>
                <select
                  className="recep-select-field"
                  value={selectedBed.id || ''}
                  onChange={(e) => {
                    const bed = bedsData.find((b: any) => b.id === e.target.value);
                    if (bed) setSelectedBed(bed);
                  }}
                  required
                  style={{
                    background: '#ffffff',
                    fontWeight: 700,
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid var(--active-nav)',
                    fontSize: '0.88rem',
                    color: 'var(--active-nav)',
                  }}
                >
                  {currentCategory?.beds.map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.bed_number} ({b.status === 'available' ? 'Available' : 'Selected'})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* PATIENT DETAILS */}
          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: 'var(--secondary-text)',
                display: 'block',
                marginBottom: '6px',
                textTransform: 'uppercase',
              }}
            >
              Patient Name
            </label>
            {activeReq ? (
              <div
                style={{
                  background: '#E8F7FA',
                  border: '1.5px solid var(--border)',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: 'var(--active-nav)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                    }}
                  >
                    <User size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--primary-text)' }}>
                      {activeReq.patient_name}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--secondary-text)' }}>
                      Code: <strong style={{ color: 'var(--primary-teal)' }}>{activeReq.patient_code}</strong>
                    </div>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: 'var(--primary-teal)',
                    background: '#ffffff',
                    border: '1px solid var(--border)',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <CheckCircle size={12} style={{ color: 'var(--success)' }} /> Advised via Consultation
                </span>
              </div>
            ) : (
              <select
                className="recep-select-field"
                value={admitForm.patient_id}
                onChange={(e) => setAdmitForm((prev) => ({ ...prev, patient_id: e.target.value }))}
                required
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: '#fff',
                  color: 'var(--primary-text)',
                  fontSize: '0.88rem',
                }}
              >
                <option value="">-- Choose Patient --</option>
                {patients.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.user?.full_name || p.name || 'Patient'} ({p.patient_code})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* ADMITTING DOCTOR */}
          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: 'var(--secondary-text)',
                display: 'block',
                marginBottom: '6px',
                textTransform: 'uppercase',
              }}
            >
              Admitting Doctor
            </label>
            {activeReq ? (
              <div
                style={{
                  background: '#F1F8FA',
                  border: '1px solid var(--border)',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: '#E8F7FA',
                      color: 'var(--primary-teal)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Stethoscope size={16} />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--primary-text)' }}>
                    Dr. {activeReq.doctor_name}
                  </div>
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--secondary-text)', fontStyle: 'italic' }}>
                  Recommending Physician
                </span>
              </div>
            ) : (
              <select
                className="recep-select-field"
                value={admitForm.admitting_doctor_id}
                onChange={(e) => setAdmitForm((prev) => ({ ...prev, admitting_doctor_id: e.target.value }))}
                required
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: '#fff',
                  color: 'var(--primary-text)',
                  fontSize: '0.88rem',
                }}
              >
                <option value="">-- Choose Doctor --</option>
                {doctors.map((d: any) => (
                  <option key={d.id} value={d.id}>
                    {formatDocName(d.user?.full_name || d.name)} ({d.specialization || 'General'})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* DIAGNOSIS / REASON */}
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: 'var(--secondary-text)',
                display: 'block',
                marginBottom: '6px',
                textTransform: 'uppercase',
              }}
            >
              Diagnosis / Admission Clinical Notes
            </label>
            <textarea
              className="recep-input-field"
              rows={3}
              value={admitForm.diagnosis}
              onChange={(e) => setAdmitForm((prev) => ({ ...prev, diagnosis: e.target.value }))}
              placeholder="e.g. Severe pneumonia observation, post-op care"
              required
              style={{
                resize: 'vertical',
                width: '100%',
                borderRadius: '8px',
                padding: '10px',
                fontSize: '0.88rem',
                border: '1px solid var(--border)',
              }}
            />
          </div>

          {/* INITIAL DEPOSIT */}
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: 'var(--secondary-text)',
                display: 'block',
                marginBottom: '6px',
                textTransform: 'uppercase',
              }}
            >
              Initial Deposit Amount (₹)
            </label>
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontWeight: 700,
                  color: 'var(--secondary-text)',
                }}
              >
                ₹
              </span>
              <input
                type="number"
                className="recep-input-field"
                value={admitForm.initial_deposit || ''}
                onChange={(e) => setAdmitForm((prev) => ({ ...prev, initial_deposit: Number(e.target.value) }))}
                min="0"
                style={{
                  width: '100%',
                  paddingLeft: '28px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '1rem',
                  color: 'var(--primary-text)',
                  border: '1px solid var(--border)',
                }}
              />
            </div>
          </div>

          {/* NOTIFY CHECKBOX */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
            <input
              type="checkbox"
              id="notify-doctor-checkbox"
              checked={notifyDoctor}
              onChange={(e) => setNotifyDoctor(e.target.checked)}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            <label
              htmlFor="notify-doctor-checkbox"
              style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--secondary-text)', cursor: 'pointer' }}
            >
              Notify physician via email/SMS immediately
            </label>
          </div>

          {/* FOOTER */}
          <div
            style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end',
              borderTop: '1px solid var(--border)',
              paddingTop: '18px',
            }}
          >
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                padding: '10px 18px',
                borderRadius: '8px',
                fontWeight: 600,
                color: 'var(--secondary-text)',
                background: 'var(--bg)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-submit"
              disabled={isSubmitting}
              style={{
                padding: '10px 22px',
                borderRadius: '8px',
                fontWeight: 700,
                color: '#ffffff',
                background: 'linear-gradient(135deg, var(--primary-teal) 0%, var(--active-nav) 100%)',
                border: 'none',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(11, 142, 171, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: isSubmitting ? 0.75 : 1,
              }}
            >
              {isSubmitting ? (
                <span>Processing...</span>
              ) : (
                <>
                  <Bed size={16} /> Confirm & Admit Patient
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdmitPatientModal;
