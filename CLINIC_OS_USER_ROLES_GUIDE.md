# 🏥 Vertical Clinic OS — User Roles & Permissions Guide

> **Architecture Standard:** Multi-Branch, Zero-Trust Role-Based Access Control (RBAC).

---

## 📌 1. Executive Overview

**Vertical Clinic OS** enforces a **Zero-Overlap, Strict Role-Based Access Control (RBAC)** architecture to guarantee:
* **Patient Privacy:** Complete HIPAA/GDPR-aligned confidentiality of clinical notes, lab reports, and vitals.
* **Operational Integrity:** Non-clinical personnel cannot alter diagnoses or e-prescriptions.
* **Financial Separation:** Sensitive revenue metrics, profit margins, and corporate billing details are restricted exclusively to Super Admins.

---

## 👥 2. System Roles Overview

| # | Role Name | System Key | Target Persona | Primary Responsibility |
|---|---|---|---|---|
| **1** | **Super Admin** | `admin` | Clinic Owner / Executive | Multi-branch governance, security audit logs, revenue analytics, staff access management. |
| **2** | **Clinic Manager** | `clinic_manager` | Floor Operations Head | Branch operational speed, bed turnarounds, shift approvals, fee discount authorizations. |
| **3** | **Doctor** | `doctor` | Medical Specialist / Physician | Patient diagnosis, EHR history, e-prescriptions, treatment plans, video teleconsultations. |
| **4** | **Receptionist** | `receptionist` | Front Desk Staff / Cashier | 15-second patient intake, live OPD token queues, appointment booking, payment collection. |
| **5** | **Patient** | `patient` | Patient / Client | 24/7 self-service booking, video calls, medical record PDF locker, payment receipts. |

---

## ➕ 3. User Provisioning & Hierarchy

```
                      ┌──────────────────────┐
                      │     SUPER ADMIN      │  ── Full Enterprise Authority Across All Branches
                      └──────────┬───────────┘
                                 │
            ┌────────────────────┴────────────────────┐
            ▼                                         ▼
┌──────────────────────┐                  ┌──────────────────────┐
│    CLINIC MANAGER    │                  │     RECEPTIONIST     │
│ (Branch Operations & │                  │ (Walk-In Express     │
│  Staff Onboarding)   │                  │  Patient Creation)   │
└──────────┬───────────┘                  └──────────┬───────────┘
           │                                         │
           ├─────────────────────────┐               │
           ▼                         ▼               │
┌──────────────────────┐  ┌──────────────────────┐   │
│        DOCTOR        │  │       PATIENT        │◄──┘
│ (Clinical Care, EHR, │  │ (Self-Registration & │
│  e-Rx & Admissions)  │  │  Appt Booking)       │
└──────────┬───────────┘  └──────────────────────┘
           │                         ▲
           └─────────────────────────┘
            (Medical Care & Consult)
```

### Delegation Rules:
* **Super Admin**: Provisions clinic branches, managers, doctors, and receptionists across all locations. Executes account suspensions.
* **Clinic Manager**: Onboards branch doctors and receptionists directly without technical support.
* **Receptionist**: Onboards walk-in patients during check-in.
* **Patient**: Registers independently via phone/email OTP.

---

## 🔍 4. Role-by-Role Breakdown & Boundaries

### 1. Super Admin (`admin`)
* **Primary Focus**: Total executive oversight, branch setup, staff permission controls, and financial performance.
* **Key Features**: Multi-branch revenue analytics, user suspension / session revocation, branch configuration console, audit logs.
* **Access Boundary**: ❌ Cannot edit doctor consultation notes or diagnoses.

### 2. Clinic Manager (`clinic_manager`)
* **Primary Focus**: Operational throughput, queue flow, IPD beds, and discount approvals.
* **Key Features**: Live floor hub, 2-minute staff onboarding, emergency doctor schedule freeze, fee discount approval queue, IPD bed tracker.
* **Access Boundary**: ❌ Cannot view overall clinic P&L or bank accounts. Scoped to assigned branch.

### 3. Doctor (`doctor`)
* **Primary Focus**: High-quality medical care, digital recordkeeping, and e-prescriptions.
* **Key Features**: Live OPD cabin queue calling, full EHR & vitals trends, smart e-prescription builder, multi-stage treatment planner, video teleconsultations.
* **Access Boundary**: ❌ Prohibited from taking billing payments or editing front-desk queues.

### 4. Receptionist (`receptionist`)
* **Primary Focus**: Fast front-desk check-in, token distribution, scheduling, and payment collection.
* **Key Features**: 15-second patient intake, OPD token generator, appointment calendar, POS billing & GST receipts, IPD admissions.
* **Access Boundary**: ❌ Prohibited from writing prescriptions or altering medical notes.

### 5. Patient (`patient`)
* **Primary Focus**: Self-service healthcare access and digital record management.
* **Key Features**: 24/7 appointment booking, in-browser video room, digital medical PDF locker, payment history.
* **Access Boundary**: ❌ Strict privacy scoping—access limited exclusively to personal and registered family records.

---

## 📊 5. Master Permission Matrix

| Capability | Super Admin | Clinic Manager | Doctor | Receptionist | Patient |
|---|:---:|:---:|:---:|:---:|:---:|
| **Book Appointments** | ✅ | ✅ | ❌ | ✅ | ✅ *(Self)* |
| **Manage Live OPD Queue** | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Register New Patients** | ✅ | ✅ | ❌ | ✅ | ✅ *(Self)* |
| **Write Diagnoses & Notes** | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Issue e-Prescriptions** | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Generate Billing Invoices** | ✅ | ❌ | ❌ | ✅ | ❌ |
| **Collect Payments** | ✅ | ❌ | ❌ | ✅ | ✅ *(Online)* |
| **Manage IPD Bed Allocation** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Video Teleconsultations** | ❌ | ❌ | ✅ | ❌ | ✅ |
| **Approve Staff & Onboard** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **View Revenue Analytics** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Configure Branches** | ✅ | ❌ | ❌ | ❌ | ❌ |
