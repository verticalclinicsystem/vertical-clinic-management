import React from 'react';
import { Loader2, Bed } from 'lucide-react';

interface RecepBillingTabProps {
  handleCreateInvoice: (e: React.FormEvent) => void;
  billingForm: any;
  setBillingForm: (form: any) => void;
  patients: any[];
  loadingPendingCharges: boolean;
  pendingCharges: any;
  selectedConsultationId: string | null;
  setSelectedConsultationId: (id: string | null) => void;
  includeMedicines: boolean;
  setIncludeMedicines: (include: boolean) => void;
  selectedTreatmentPlanId: string | null;
  setSelectedTreatmentPlanId: (id: string | null) => void;
  selectedAdmissionIds: string[];
  setSelectedAdmissionIds: (ids: string[]) => void;
  includeMaterials: boolean;
  setIncludeMaterials: (include: boolean) => void;
  customMaterialsCost: number;
  setCustomMaterialsCost: (cost: number) => void;
  submitLoading: boolean;
  currentUser: any;
  formatDocName: (name: string) => string;
}

export const RecepBillingTab: React.FC<RecepBillingTabProps> = ({
  handleCreateInvoice,
  billingForm,
  setBillingForm,
  patients,
  loadingPendingCharges,
  pendingCharges,
  selectedConsultationId,
  setSelectedConsultationId,
  includeMedicines,
  setIncludeMedicines,
  selectedTreatmentPlanId,
  setSelectedTreatmentPlanId,
  selectedAdmissionIds,
  setSelectedAdmissionIds,
  includeMaterials,
  setIncludeMaterials,
  customMaterialsCost,
  setCustomMaterialsCost,
  submitLoading,
  currentUser,
  formatDocName,
}) => {
  return (
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
              <div
                className="form-help-text"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '1rem 0' }}
              >
                <Loader2 size={16} className="pharmacy-spinner" /> Loading pending clinical charges...
              </div>
            )}

            {pendingCharges && (
              <div
                className="pending-charges-section"
                style={{
                  margin: '1.5rem 0',
                  padding: '1rem',
                  background: 'var(--surface-2)',
                  borderRadius: '8px',
                }}
              >
                <h4
                  style={{
                    margin: '0 0 1rem 0',
                    color: 'var(--primary-dark)',
                    fontSize: '0.95rem',
                    borderBottom: '1px solid var(--border)',
                    paddingBottom: '0.5rem',
                  }}
                >
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
                          {formatDocName(c.doctor_name)} (
                          {new Date(c.consultation_datetime).toLocaleDateString()}) - Fee: ₹
                          {c.consultation_fee}
                        </option>
                      ))}
                    </select>

                    {/* 2. Medicines checkbox (if consultation is selected and has prescriptions) */}
                    {selectedConsultationId &&
                      pendingCharges.consultations
                        .find((c: any) => c.id === selectedConsultationId)
                        ?.prescriptions?.some((p: any) => p.items?.length > 0) && (
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            marginTop: '0.5rem',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                          }}
                        >
                          <input
                            type="checkbox"
                            className="recep-checkbox"
                            checked={includeMedicines}
                            onChange={(e) => setIncludeMedicines(e.target.checked)}
                          />
                          Include Dispensed Prescriptions/Medicines (₹
                          {pendingCharges.consultations
                            .find((c: any) => c.id === selectedConsultationId)
                            ?.prescriptions?.reduce(
                              (sum: number, p: any) =>
                                sum +
                                (p.items?.reduce(
                                  (pSum: number, item: any) => pSum + (item.total_price || 0),
                                  0
                                ) || 0),
                              0
                            )
                            .toFixed(2)}
                          )
                        </label>
                      )}
                  </div>
                ) : (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    No unbilled consultations found.
                  </p>
                )}

                {/* 3. Treatment plan selection */}
                {pendingCharges.treatment_plans && pendingCharges.treatment_plans.length > 0 ? (
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                      Select Treatment Plan / Procedures
                    </label>
                    <select
                      className="recep-select-field"
                      style={{ padding: '6px 10px', fontSize: '0.9rem' }}
                      value={selectedTreatmentPlanId || ''}
                      onChange={(e) => setSelectedTreatmentPlanId(e.target.value || null)}
                    >
                      <option value="">-- Do Not Bill Treatment Plan --</option>
                      {pendingCharges.treatment_plans.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.title} ({p.procedures?.length} procedures) - Cost: ₹
                          {p.procedures?.reduce((sum: number, proc: any) => sum + proc.cost, 0)}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    No active/unbilled treatment plans found.
                  </p>
                )}

                {/* 4. IPD Bed Stay & Rent selection (Multi-Select Checkboxes) */}
                {pendingCharges.ipd_admissions && pendingCharges.ipd_admissions.length > 0 ? (
                  <div
                    className="form-group"
                    style={{
                      marginBottom: '1rem',
                      background: '#f0fdf4',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #bbf7d0',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '8px',
                      }}
                    >
                      <label
                        style={{
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          color: '#15803d',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Bed size={16} /> Select IPD Bed Stay(s) to Bill
                      </label>
                      <button
                        type="button"
                        style={{
                          fontSize: '0.75rem',
                          background: 'none',
                          border: 'none',
                          color: '#16a34a',
                          cursor: 'pointer',
                          fontWeight: 600,
                        }}
                        onClick={() => {
                          if (selectedAdmissionIds.length === pendingCharges.ipd_admissions.length) {
                            setSelectedAdmissionIds([]);
                          } else {
                            setSelectedAdmissionIds(pendingCharges.ipd_admissions.map((a: any) => a.id));
                          }
                        }}
                      >
                        {selectedAdmissionIds.length === pendingCharges.ipd_admissions.length
                          ? 'Deselect All'
                          : 'Select All Beds'}
                      </button>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        maxHeight: '200px',
                        overflowY: 'auto',
                      }}
                    >
                      {pendingCharges.ipd_admissions.map((adm: any) => {
                        const isChecked = selectedAdmissionIds.includes(adm.id);
                        return (
                          <label
                            key={adm.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '8px 10px',
                              background: isChecked ? '#ffffff' : '#f8fafc',
                              border: isChecked ? '1px solid #22c55e' : '1px solid #e2e8f0',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '0.85rem',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedAdmissionIds([...selectedAdmissionIds, adm.id]);
                                } else {
                                  setSelectedAdmissionIds(
                                    selectedAdmissionIds.filter((id) => id !== adm.id)
                                  );
                                }
                              }}
                              style={{ width: '16px', height: '16px', accentColor: '#16a34a' }}
                            />
                            <div style={{ flex: 1 }}>
                              <span style={{ fontWeight: 600 }}>Bed {adm.bed_number}</span> (
                              {adm.category_name}) &middot; {adm.hours_stayed}h stay
                            </div>
                            <div style={{ textAlign: 'right', fontWeight: 700, color: '#15803d' }}>
                              ₹{adm.current_bed_rent}
                              {adm.initial_deposit > 0 && (
                                <span style={{ display: 'block', fontSize: '0.75rem', color: '#16a34a', fontWeight: 500 }}>
                                  Deposit: -₹{adm.initial_deposit}
                                </span>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    No active IPD bed stay found.
                  </p>
                )}

                {/* 5. Used Materials & Consumables */}
                <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                    }}
                  >
                    <input
                      type="checkbox"
                      className="recep-checkbox"
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
                onChange={(e) =>
                  setBillingForm({ ...billingForm, discount_amount: parseFloat(e.target.value) || 0 })
                }
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
                  onChange={(e) =>
                    setBillingForm({ ...billingForm, tax_amount: parseFloat(e.target.value) || 0 })
                  }
                />
                <span className="gst-badge">18% GST</span>
              </div>
              {currentUser?.role !== 'admin' ? (
                <span className="form-help-text">
                  GST rate is fixed at 18%. Only administrators can edit this rate.
                </span>
              ) : (
                <span className="form-help-text text-success">
                  Admin Access: You can manually override the GST amount if needed.
                </span>
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
              <span>
                Status: <span className="status-unpaid">UNPAID (Pending)</span>
              </span>
            </div>
          </div>

          <div className="receipt-divider"></div>

          <div className="receipt-section">
            <h4>Patient Information</h4>
            {(() => {
              const patient = patients.find((p) => p.id === billingForm.patient_id);
              if (!patient) return <p className="placeholder-text">No patient selected</p>;
              return (
                <div className="receipt-patient-details">
                  <p>
                    <strong>Name:</strong> {patient.user?.full_name}
                  </p>
                  <p>
                    <strong>Code:</strong> {patient.patient_code}
                  </p>
                  <p>
                    <strong>Phone:</strong> {patient.user?.phone || '—'}
                  </p>
                </div>
              );
            })()}
          </div>

          <div className="receipt-divider"></div>

          <div className="receipt-section">
            <h4>Billing Breakdowns</h4>
            {selectedConsultationId &&
              (() => {
                const consultation = pendingCharges?.consultations.find(
                  (c: any) => c.id === selectedConsultationId
                );
                return (
                  <>
                    <div className="receipt-row" style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                      <span>Consultation: {formatDocName(consultation?.doctor_name)}</span>
                      <span>₹{(consultation?.consultation_fee || 0).toFixed(2)}</span>
                    </div>
                    {includeMedicines &&
                      consultation?.prescriptions?.map((p: any) =>
                        p.items?.map((item: any, itemIdx: number) => (
                          <div
                            key={itemIdx}
                            className="receipt-row"
                            style={{ fontSize: '0.8rem', color: 'var(--text-muted)', paddingLeft: '1rem' }}
                          >
                            <span>
                              Medicine: {item.medicine_name} ({item.qty})
                            </span>
                            <span>₹{(item.total_price || 0).toFixed(2)}</span>
                          </div>
                        ))
                      )}
                  </>
                );
              })()}

            {selectedTreatmentPlanId &&
              (() => {
                const plan = pendingCharges?.treatment_plans.find((p: any) => p.id === selectedTreatmentPlanId);
                return plan?.procedures?.map((proc: any, procIdx: number) => (
                  <div
                    key={procIdx}
                    className="receipt-row"
                    style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}
                  >
                    <span>Procedure: {proc.procedure_name}</span>
                    <span>₹{(proc.cost || 0).toFixed(2)}</span>
                  </div>
                ));
              })()}

            {selectedAdmissionIds.length > 0 &&
              (() => {
                return selectedAdmissionIds.map((admId) => {
                  const adm = pendingCharges?.ipd_admissions?.find((a: any) => a.id === admId);
                  if (!adm) return null;
                  return (
                    <div key={adm.id} className="receipt-row" style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                      <span>
                        IPD Bed Stay: Bed {adm.bed_number} ({adm.category_name}, {adm.hours_stayed}h)
                      </span>
                      <span>₹{(adm.current_bed_rent || 0).toFixed(2)}</span>
                    </div>
                  );
                });
              })()}

            {includeMaterials && (
              <div className="receipt-row" style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                <span>Clinical Materials &amp; Sterile Consumables</span>
                <span>₹{Number(customMaterialsCost || 0).toFixed(2)}</span>
              </div>
            )}

            {!selectedConsultationId &&
              !selectedTreatmentPlanId &&
              selectedAdmissionIds.length === 0 &&
              !includeMaterials && (
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
              ₹
              {Math.max(
                0,
                (billingForm.total_amount || 0) -
                  (billingForm.discount_amount || 0) +
                  (billingForm.tax_amount || 0)
              ).toFixed(2)}
            </span>
          </div>

          <div className="receipt-footer">
            <p>Thank you for choosing Vertical Clinic!</p>
          </div>
        </div>
      </div>
    </div>
  );
};
