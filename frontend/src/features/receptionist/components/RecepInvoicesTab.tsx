import React from 'react';
import { Search, Plus, FileText, Eye, CreditCard } from 'lucide-react';

interface RecepInvoicesTabProps {
  billingSearchQuery: string;
  setBillingSearchQuery: (query: string) => void;
  invoices: any[];
  setBillingForm: (form: any) => void;
  setActiveTab: (tab: string) => void;
  filteredInvoices: any[];
  getInvoiceEffectiveStatus: (inv: any) => string;
  setSelectedInvoiceForPreview: (inv: any) => void;
  setShowInvoicePreviewModal: (show: boolean) => void;
  setSelectedInvoiceForPayment: (inv: any) => void;
  setPaymentForm: (form: any) => void;
  setShowPaymentModal: (show: boolean) => void;
}

export const RecepInvoicesTab: React.FC<RecepInvoicesTabProps> = ({
  billingSearchQuery,
  setBillingSearchQuery,
  invoices,
  setBillingForm,
  setActiveTab,
  filteredInvoices,
  getInvoiceEffectiveStatus,
  setSelectedInvoiceForPreview,
  setShowInvoicePreviewModal,
  setSelectedInvoiceForPayment,
  setPaymentForm,
  setShowPaymentModal,
}) => {
  return (
    <div className="recep-billing-view">
      <div className="recep-card">
        <div className="recep-card-header">
          <div className="recep-search-wrapper">
            <Search size={16} className="recep-search-icon" />
            <input
              type="text"
              className="recep-search-input"
              placeholder="Search invoices by patient, invoice #..."
              list="receptionist-invoices-suggestions"
              value={billingSearchQuery}
              onChange={(e) => setBillingSearchQuery(e.target.value)}
            />
            <datalist id="receptionist-invoices-suggestions">
              {Array.from(
                new Set(
                  (invoices || []).flatMap((inv: any) => {
                    const name = inv.patient?.user?.full_name || '';
                    const invoiceNum = inv.invoice_number || '';
                    return [name, invoiceNum].filter(Boolean);
                  })
                )
              ).map((val: any) => (
                <option key={val} value={val} />
              ))}
            </datalist>
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
                  <React.Fragment key={inv.id}>
                    <tr>
                      <td>
                        <strong>{inv.invoice_number}</strong>
                      </td>
                      <td>
                        <div>{inv.patient?.user?.full_name}</div>
                        <small style={{ color: 'var(--muted)' }}>{inv.patient?.patient_code}</small>
                      </td>
                      <td>₹{inv.total_amount.toLocaleString('en-IN')}</td>
                      <td>₹{inv.discount_amount.toLocaleString('en-IN')}</td>
                      <td>₹{inv.tax_amount.toLocaleString('en-IN')}</td>
                      <td>
                        <strong>₹{inv.grand_total.toLocaleString('en-IN')}</strong>
                      </td>
                      <td>₹{inv.amount_paid.toLocaleString('en-IN')}</td>
                      <td
                        style={{
                          color: inv.balance_due > 0 ? 'var(--danger)' : 'var(--success)',
                          fontWeight: 600,
                        }}
                      >
                        ₹{inv.balance_due.toLocaleString('en-IN')}
                      </td>
                      <td>
                        {(() => {
                          const effStatus = getInvoiceEffectiveStatus(inv);
                          return (
                            <span
                              className={`badge ${
                                effStatus === 'paid'
                                  ? 'badge-completed'
                                  : effStatus === 'partially_paid'
                                  ? 'badge-confirmed'
                                  : effStatus === 'cancelled'
                                  ? 'badge-cancelled'
                                  : 'badge-pending'
                              }`}
                            >
                              {effStatus === 'paid'
                                ? 'Paid'
                                : effStatus === 'partially_paid'
                                ? 'Partial'
                                : effStatus === 'cancelled'
                                ? 'Cancelled'
                                : 'Unpaid'}
                            </span>
                          );
                        })()}
                      </td>
                      <td>{new Date(inv.created_at).toLocaleDateString()}</td>
                      <td>
                        <div className="recep-actions-row">
                          <button
                            className="btn-download"
                            onClick={() => {
                              setSelectedInvoiceForPreview(inv);
                              setShowInvoicePreviewModal(true);
                            }}
                            title="View Details & Receipt"
                          >
                            <Eye size={14} /> View Details
                          </button>
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
                        </div>
                      </td>
                    </tr>
                    {/* Medicine Breakdown Row */}
                    {inv.prescription_items && inv.prescription_items.length > 0 && (
                      <tr style={{ background: '#f8faff' }}>
                        <td colSpan={11} style={{ padding: '8px 16px 12px 32px' }}>
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '8px',
                              alignItems: 'center',
                            }}
                          >
                            <span
                              style={{
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                color: '#3b82f6',
                                marginRight: '4px',
                              }}
                            >
                              💊 Medicines:
                            </span>
                            {inv.prescription_items.map((med: any, midx: number) => (
                              <span
                                key={midx}
                                style={{
                                  background: '#eff6ff',
                                  color: '#1e40af',
                                  borderRadius: '20px',
                                  padding: '2px 10px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  border: '1px solid #bfdbfe',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                {med.medicine_name}
                                <span style={{ color: '#6b7280', fontWeight: 400 }}>
                                  {med.dosage} · {med.duration}
                                </span>
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
