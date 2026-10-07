# 👥 Vertical Clinic OS — User Roles, Hierarchy & Permissions Guide
*(Comprehensive Overview of System Personas, Access Boundaries, and User Delegation)*

---

## 💡 System Architecture & Security Philosophy
**Vertical Clinic OS** is built on a **Zero-Overlap, Strict Role-Based Access Control (RBAC)** architecture.

In a modern multi-specialty medical clinic, operational efficiency and patient data security require strict operational boundaries. Clinic OS provides every team member with a **tailored, role-specific workspace** designed exclusively for their daily workflow.

> **Core Philosophy:**  
> *"Doctors focus on clinical care, Receptionists manage patient intake and billing, Managers oversee operational speed, and Super Admins manage total enterprise growth—without overlapping or compromising security."*

---

## 📑 Table of Contents
1. [The 5 Active Core Roles at a Glance](#-the-5-active-core-roles-at-a-glance)
2. [User Provisioning & Delegation Hierarchy](#-user-provisioning--delegation-hierarchy)
3. [Detailed Role Breakdown](#-detailed-role-breakdown)
   - [1. Super Admin (Clinic Owner & Executive)](#1--super-admin-clinic-owner--executive)
   - [2. Clinic Manager (Floor Operations Head)](#2--clinic-manager-floor-operations-head)
   - [3. Doctor (Medical Specialist)](#3--doctor-medical-specialist)
   - [4. Receptionist (Front Desk & Billing Cashier)](#4--receptionist-front-desk--billing-cashier)
   - [5. Patient (Self-Service Health Companion)](#5--patient-self-service-health-companion)
4. [Master Permission Comparison Matrix](#-master-permission-comparison-matrix)

---

## 👥 The 5 Active Core Roles at a Glance

| Role | Target Persona | Primary Responsibility | Dedicated Interface |
| :--- | :--- | :--- | :--- |
| **1. Super Admin** | Clinic Owner / Executive Director / Hospital Board | Tracks total revenue, enterprise security, branch configuration, and staff access control across all branches. | Executive Admin Portal |
| **2. Clinic Manager** | Floor Operations Manager / Branch Head | Ensures daily floor speed, manages IPD bed availability, approves staff duty shifts, and authorizes fee discounts. | Clinic Operations Hub |
| **3. Doctor** | Physicians, Surgeons & Medical Specialists | Examines patients, reviews medical history (EHR), generates digital e-prescriptions, and conducts video consultations. | Clinical Workbench |
| **4. Receptionist** | Front Desk Staff & Cashiers | Performs 15-second patient check-ins, issues OPD token queue numbers, schedules appointments, and collects payments. | Front Desk Billing Hub |
| **5. Patient** | Patients & Family Members | Books appointments 24/7, joins virtual video teleconsultations, downloads signed digital PDF records, and views bill receipts. | Self-Service Web Portal |

---

## ➕ User Provisioning & Delegation Hierarchy

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

### Provisioning Authority Rules:
1. **Super Admin**:
   - Creates new clinic branches (addresses, phone numbers, tax details).
   - Provisions Super Admins, Clinic Managers, Doctors, and Receptionists.
   - Manages role permissions and executes emergency account suspensions system-wide.
2. **Clinic Manager**:
   - Onboards branch personnel (Doctors and Receptionists) directly without requiring IT support.
   - Registers walk-in and corporate patients.
3. **Receptionist**:
   - Express registration for walk-in patients during check-in.
4. **Patient**:
   - Self-registration via mobile number or email with OTP verification.

---

## 🔍 Detailed Role Breakdown

---

### 1. 🛡️ Super Admin (Clinic Owner & Executive)
*Main Purpose: Total enterprise governance, revenue tracking, branch expansion, and security compliance.*

#### Core Capabilities & Features:
* **Multi-Branch Revenue Analytics:** Real-time consolidated view of daily revenue, patient volume, and active doctors across all branches.
* **Branch Setup & Management:** Ability to add physical clinic locations with operational hours, contact parameters, and tax configurations.
* **Staff Directory & Access Control:** Complete directory of all clinic employees with instant **Account Suspension** and **Active Session Revocation** capabilities.
* **System Audit Trails:** Security audit log tracking logins, administrative actions, and data access.

#### Strict Access Boundaries:
* ❌ **Clinical Data Protection:** Cannot alter doctor consultation notes, change medical diagnoses, or edit finalized prescriptions.

---

### 2. 🏢 Clinic Manager (Floor Operations Head)
*Main Purpose: Smooth day-to-day branch floor management, bed turnaround optimization, queue management, and discount approvals.*

#### Core Capabilities & Features:
* **Live Floor Operations Hub:** Real-time view of patient waiting counts, active doctor cabins, queue status, and floor bottlenecks.
* **Branch Staff Onboarding:** Simplified setup interface to hire Doctors and Receptionists into their branch.
* **Doctor Schedule Freeze:** Emergency block tool when a doctor is called away for surgery or emergencies, automatically notifying scheduled patients.
* **Discount & Refund Approvals:** Centralized authorization queue to review, approve, or reject receptionist fee waivers with audit logs.
* **IPD Bed Management:** Visual tracking of ward beds (`Occupied`, `Vacant`, `Sanitize Required`, `Maintenance`).

#### Strict Access Boundaries:
* ❌ **Financial Privacy:** Restricted from viewing clinic-wide P&L statements, overall bank balances, or executive commission splits.
* ❌ **Branch Sandboxing:** Access is strictly scoped to their assigned clinic location.

---

### 3. 🩺 Doctor (Medical Specialist)
*Main Purpose: Efficient clinical care delivery, complete elimination of manual prescription errors, and structured digital recordkeeping.*

#### Core Capabilities & Features:
* **Live OPD Cabin Queue:** Real-time queue listing checked-in patients waiting outside the cabin with digital calling capability.
* **Electronic Health Records (EHR):** Longitudinal medical history, allergy alerts, past diagnoses, and visual vitals trend graphs (BP, Pulse, SpO2).
* **Smart E-Prescription Builder:** Rapid drug search, standardized dosage presets (`1-0-1`, `0-1-0`, duration, food timing), and instant signed PDF generation.
* **Multi-Stage Treatment Plans:** Procedure planner for multi-session treatments (surgeries, dental work, physiotherapy) with cost estimation.
* **Integrated Teleconsultation:** Secure in-browser HD video calls with real-time clinical note taking.
* **AI Diagnostic Summary:** AI-assisted analysis and summary of uploaded pathology and radiology PDF reports.

#### Strict Access Boundaries:
* ❌ Cannot collect payment cash/UPI, issue tax invoices, or edit front-desk token sequences.

---

### 4. 📋 Receptionist (Front Desk & Billing Cashier)
*Main Purpose: Fast patient check-in, waiting queue management, appointment scheduling, and accurate payment collection.*

#### Core Capabilities & Features:
* **15-Second Express Patient Intake:** Rapid registration form capturing basic demographics, contact details, and critical allergy flags.
* **OPD Live Token Queue:** Digital token generator and patient triage tracker (`Scheduled`, `Waiting`, `In Consultation`, `Completed`).
* **Appointment Calendar:** Interactive doctor schedule management, slot booking, and rescheduling.
* **POS Billing & GST Invoices:** Automated invoicing combining consultation fees, procedures, lab tests, and room stay charges with Cash/UPI QR code support.
* **IPD Admission Wizard:** Bed assignment, ward transfer controls, and discharge bill settlement.

#### Strict Access Boundaries:
* ❌ Strictly prohibited from prescribing medicines or modifying clinical consultation notes.

---

### 5. 📱 Patient (Self-Service Health Companion)
*Main Purpose: 24/7 digital access for appointment booking, virtual consultations, and personal medical record storage.*

#### Core Capabilities & Features:
* **Online Doctor Booking Wizard:** Browse doctor profiles, filter by specialty or branch, view consultation fees, and pick available time slots.
* **In-Browser Video Consultation:** 1-click encrypted video call launcher for scheduled virtual appointments.
* **Digital Medical Locker:** Permanent downloadable access to official signed PDF prescriptions, lab reports, and treatment summaries.
* **Billing History:** Itemized records of past clinic visits and downloadable official GST payment receipts.

#### Strict Access Boundaries:
* ❌ Strict tenant privacy: A patient can only access their own records and registered family profiles.

---

## 📊 Master Permission Comparison Matrix

| Action / Capability | Super Admin | Clinic Manager | Doctor | Receptionist | Patient |
|---|:---:|:---:|:---:|:---:|:---:|
| **Book Appointments** | ✅ | ✅ | ❌ | ✅ | ✅ *(Self)* |
| **Manage Live OPD Queue** | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Register New Patients** | ✅ | ✅ | ❌ | ✅ | ✅ *(Self)* |
| **Write Diagnoses & Clinical Notes** | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Issue Digital Prescriptions (e-Rx)** | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Generate Billing Invoices** | ✅ | ❌ | ❌ | ✅ | ❌ |
| **Collect Payments (Cash/UPI)** | ✅ | ❌ | ❌ | ✅ | ✅ *(Online)* |
| **Manage IPD Bed Allocation** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Conduct Video Teleconsultations** | ❌ | ❌ | ✅ | ❌ | ✅ |
| **Approve Staff Shifts & Onboard** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **View Executive Revenue Analytics**| ✅ | ❌ | ❌ | ❌ | ❌ |
| **Configure Clinic Branches** | ✅ | ❌ | ❌ | ❌ | ❌ |

---
*Vertical Clinic OS — Enterprise Role Architecture Documentation.*
