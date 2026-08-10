import logging
from jinja2 import Template

logger = logging.getLogger(__name__)

def generate_prescription_pdf(prescription_data: dict) -> bytes:
    """
    Generate a PDF from prescription data using WeasyPrint (falling back to a mock PDF in case of errors).
    """
    html_template = """
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            @page {
                size: A4;
                margin: 20mm;
            }
            body {
                font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                color: #2D3748;
                line-height: 1.5;
                font-size: 14px;
            }
            .header {
                border-bottom: 2px solid #3182CE;
                padding-bottom: 15px;
                margin-bottom: 30px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .clinic-logo {
                font-size: 24px;
                font-weight: bold;
                color: #2B6CB0;
            }
            .clinic-details {
                text-align: right;
                font-size: 12px;
                color: #718096;
            }
            .doc-patient-grid {
                display: table;
                width: 100%;
                margin-bottom: 30px;
            }
            .doc-patient-col {
                display: table-cell;
                width: 50%;
            }
            .rx-section {
                font-size: 20px;
                font-weight: bold;
                color: #2B6CB0;
                margin-bottom: 15px;
            }
            .rx-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 40px;
            }
            .rx-table th {
                background-color: #EDF2F7;
                color: #4A5568;
                font-weight: bold;
                text-align: left;
                padding: 10px;
                border-bottom: 1px solid #CBD5E0;
            }
            .rx-table td {
                padding: 12px 10px;
                border-bottom: 1px solid #E2E8F0;
            }
            .instructions {
                font-size: 12px;
                color: #718096;
                margin-top: 4px;
            }
            .footer {
                margin-top: 100px;
                border-top: 1px solid #E2E8F0;
                padding-top: 15px;
                text-align: right;
            }
            .signature-line {
                display: inline-block;
                width: 200px;
                border-top: 1px solid #A0AEC0;
                margin-top: 50px;
                text-align: center;
                font-size: 12px;
                color: #718096;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="clinic-logo">VERTICAL CLINIC SYSTEM</div>
            <div class="clinic-details">
                <strong>Branch:</strong> {{ branch_name }}<br>
                <strong>Address:</strong> {{ branch_address }}<br>
                <strong>Phone:</strong> {{ branch_phone }}
            </div>
        </div>

        <div class="doc-patient-grid">
            <div class="doc-patient-col">
                <strong>DOCTOR DETAILS:</strong><br>
                Dr. {{ doctor_name }}<br>
                {{ doctor_specialization }}<br>
                Reg No: {{ doctor_reg_no }}
            </div>
            <div class="doc-patient-col" style="padding-left: 20px;">
                <strong>PATIENT DETAILS:</strong><br>
                Name: {{ patient_name }}<br>
                Code: {{ patient_code }}<br>
                Date: {{ date }}
            </div>
        </div>

        <div class="rx-section">Rx</div>

        <table class="rx-table">
            <thead>
                <tr>
                    <th>Medicine Name</th>
                    <th>Dosage</th>
                    <th>Duration</th>
                </tr>
            </thead>
            <tbody>
                {% for item in items %}
                <tr>
                    <td>
                        <strong>{{ item.medicine_name }}</strong>
                        {% if item.instructions %}
                        <div class="instructions">{{ item.instructions }}</div>
                        {% endif %}
                    </td>
                    <td>{{ item.dosage }}</td>
                    <td>{{ item.duration }}</td>
                </tr>
                {% endfor %}
            </tbody>
        </table>

        {% if notes %}
        <div style="margin-bottom: 30px;">
            <strong>Notes:</strong><br>
            {{ notes }}
        </div>
        {% endif %}

        <div class="footer">
            <div class="signature-line">
                Dr. {{ doctor_name }}<br>
                (Authorized Signature)
            </div>
        </div>
    </body>
    </html>
    """
    
    rendered_html = Template(html_template).render(**prescription_data)
    
    try:
        from weasyprint import HTML
        pdf_bytes = HTML(string=rendered_html).write_pdf()
        return pdf_bytes
    except Exception as e:
        logger.warning(f"WeasyPrint PDF generation failed, using mock fallback. Error: {e}")
        # Return a basic valid PDF byte stream
        return b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << >> /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 50 >>\nstream\nBT /F1 24 Tf 100 700 Td (Mock Prescription PDF) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000062 00000 n\n0000000121 00000 n\n0000000224 00000 n\ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n323\n%%EOF"


def generate_invoice_pdf(invoice_data: dict) -> bytes:
    """
    Generate a PDF from invoice data using WeasyPrint (falling back to a mock PDF in case of errors).
    """
    html_template = """
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            @page {
                size: A4;
                margin: 20mm;
            }
            body {
                font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                color: #1A202C;
                line-height: 1.5;
                font-size: 14px;
            }
            .header-container {
                width: 100%;
                margin-bottom: 24px;
            }
            .header-table {
                width: 100%;
                border-collapse: collapse;
            }
            .clinic-logo {
                font-size: 24px;
                font-weight: 800;
                color: #0E7490;
                margin: 0;
            }
            .clinic-subtitle {
                font-size: 12px;
                color: #64748B;
                margin: 4px 0 0 0;
                font-weight: 500;
            }
            .header-meta {
                text-align: right;
                font-size: 12px;
                color: #64748B;
                line-height: 1.5;
            }
            .brand-divider {
                border-bottom: 3px solid #0E7490;
                margin-top: 16px;
                width: 100%;
            }
            .details-grid {
                display: table;
                width: 100%;
                margin-top: 24px;
                margin-bottom: 30px;
            }
            .details-col {
                display: table-cell;
                width: 50%;
                vertical-align: top;
            }
            .details-title {
                font-size: 12px;
                font-weight: bold;
                color: #475569;
                text-transform: uppercase;
                margin-bottom: 8px;
            }
            .bill-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 30px;
            }
            .bill-table th {
                background-color: #F1F5F9;
                color: #475569;
                font-weight: bold;
                text-align: left;
                padding: 10px 12px;
                border-bottom: 1px solid #E2E8F0;
                font-size: 12px;
                text-transform: uppercase;
            }
            .bill-table td {
                padding: 12px;
                border-bottom: 1px solid #E2E8F0;
                color: #334155;
            }
            .total-section {
                width: 45%;
                margin-left: 55%;
                border-collapse: collapse;
                margin-bottom: 40px;
            }
            .total-section td {
                padding: 6px 10px;
                color: #334155;
            }
            .total-row {
                font-weight: bold;
                font-size: 16px;
                border-top: 1px solid #E2E8F0;
                color: #0F172A;
            }
            .status-badge {
                display: inline-block;
                padding: 3px 8px;
                border-radius: 4px;
                font-weight: bold;
                font-size: 11px;
                text-transform: uppercase;
                margin-top: 2px;
            }
            .status-paid { background-color: #DCFCE7; color: #15803D; }
            .status-unpaid { background-color: #FEE2E2; color: #B91C1C; }
            .status-partial { background-color: #FEF3C7; color: #D97706; }
            .footer {
                margin-top: 80px;
                border-top: 1px solid #E2E8F0;
                padding-top: 20px;
                text-align: center;
                font-size: 11px;
                color: #94A3B8;
                line-height: 1.5;
            }
        </style>
    </head>
    <body>
        <div class="header-container">
            <table class="header-table">
                <tr>
                    <td>
                        <div class="clinic-logo">🏥 VERTICAL CLINIC</div>
                        <div class="clinic-subtitle">Smart Healthcare & Multi-Branch Clinic System</div>
                    </td>
                    <td class="header-meta">
                        <strong>INVOICE:</strong> {{ invoice_number }}<br>
                        <strong>Date:</strong> {{ date }}<br>
                        <strong>Status:</strong> <span class="status-badge status-{{ status_class }}">{{ status }}</span>
                    </td>
                </tr>
            </table>
            <div class="brand-divider"></div>
        </div>

        <div class="details-grid">
            <div class="details-col">
                <div class="details-title">Patient Details</div>
                <strong>{{ patient_name }}</strong><br>
                Code: {{ patient_code }}<br>
                Phone: {{ patient_phone }}
            </div>
            <div class="details-col" style="text-align: right;">
                <div class="details-title">Clinic Branch</div>
                <strong>{{ branch_name }}</strong><br>
                {{ branch_address }}<br>
                Phone: {{ branch_phone }}
            </div>
        </div>

        <table class="bill-table">
            <thead>
                <tr>
                    <th>Description</th>
                    <th style="text-align: right; width: 120px;">Amount</th>
                </tr>
            </thead>
            <tbody>
                {% if items %}
                    {% for item in items %}
                    <tr>
                        <td>{{ item.description }}</td>
                        <td style="text-align: right; font-weight: 600;">₹{{ "%.2f"|format(item.amount) }}</td>
                    </tr>
                    {% endfor %}
                {% else %}
                    <tr>
                        <td>Dental Treatment / Procedure Charges</td>
                        <td style="text-align: right; font-weight: 600;">₹{{ "%.2f"|format(total_amount) }}</td>
                    </tr>
                {% endif %}
            </tbody>
        </table>

        <table class="total-section">
            <tr>
                <td>Total Amount:</td>
                <td style="text-align: right;">₹{{ "%.2f"|format(total_amount) }}</td>
            </tr>
            {% if discount_amount > 0 %}
            <tr>
                <td>Discount:</td>
                <td style="text-align: right;">-₹{{ "%.2f"|format(discount_amount) }}</td>
            </tr>
            {% endif %}
            {% if tax_amount > 0 %}
            <tr>
                <td>Tax:</td>
                <td style="text-align: right;">₹{{ "%.2f"|format(tax_amount) }}</td>
            </tr>
            {% endif %}
            <tr class="total-row">
                <td style="padding-top: 10px;">Grand Total:</td>
                <td style="text-align: right; padding-top: 10px;">₹{{ "%.2f"|format(grand_total) }}</td>
            </tr>
            <tr style="color: #059669;">
                <td>Amount Paid:</td>
                <td style="text-align: right;">-₹{{ "%.2f"|format(amount_paid) }}</td>
            </tr>
            <tr style="font-weight: bold; border-top: 1px double #E2E8F0;">
                <td>Balance Due:</td>
                <td style="text-align: right; color: {% if balance_due > 0 %}#B91C1C{% else %}#15803D{% endif %};">₹{{ "%.2f"|format(balance_due) }}</td>
            </tr>
        </table>

        <div class="footer">
            Report generated automatically from Vertical Clinic System<br>
            Thank you for choosing Vertical Clinic. Wish you a healthy smile!
        </div>
    </body>
    </html>
    """
    
    rendered_html = Template(html_template).render(**invoice_data)
    
    try:
        from weasyprint import HTML
        pdf_bytes = HTML(string=rendered_html).write_pdf()
        return pdf_bytes
    except Exception as e:
        logger.warning(f"WeasyPrint PDF generation failed for invoice, using mock fallback. Error: {e}")
        return b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << >> /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 47 >>\nstream\nBT /F1 24 Tf 100 700 Td (Mock Invoice PDF) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000062 00000 n\n0000000121 00000 n\n0000000224 00000 n\ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n320\n%%EOF"

