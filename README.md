# 🏥 Vertical Clinic Management System (Suvidha Clinic)

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688.svg?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19.2-61DAFB.svg?style=flat&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6.svg?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7.0-DC382D.svg?style=flat&logo=redis&logoColor=white)](https://redis.io/)
[![Celery](https://img.shields.io/badge/Celery-5.4-37814A.svg?style=flat&logo=celery&logoColor=white)](https://docs.celeryq.dev/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg?style=flat&logo=docker&logoColor=white)](https://www.docker.com/)
[![Vite](https://img.shields.io/badge/Vite-8.1-646CFF.svg?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)

An enterprise-grade, multi-branch Clinic & Inpatient Management System (EHR/EMR). Built with high-performance **FastAPI**, **React 19**, **PostgreSQL**, **Redis**, and powered by **AI Clinical Intelligence** (Groq Whisper & Llama 3.3 / Google Gemini), **WebRTC Teleconsultations**, and **IPD Bed Tracking**.

---

## 📑 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Technology Stack](#-technology-stack)
- [Project Directory Structure](#-project-directory-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Option A: Docker Compose (Recommended)](#option-a-docker-compose-recommended)
  - [Option B: Manual Local Setup](#option-b-manual-local-setup)
- [Configuration & Environment Variables](#-configuration--environment-variables)
- [Database Management & Seed Data](#-database-management--seed-data)
- [Pre-Configured Demo Credentials](#-pre-configured-demo-credentials)
- [AI Clinical Assistant Workflow](#-ai-clinical-assistant-workflow)
- [API Documentation](#-api-documentation)
- [Running Tests & Quality Checks](#-running-tests--quality-checks)
- [Production Deployment](#-production-deployment)
- [Contributing & License](#-contributing--license)

---

## 🌟 Overview

The **Vertical Clinic Management System** is designed for multi-location healthcare clinics and hospitals. It unifies outpatient departments (OPD), inpatient departments (IPD), telemedicine, pharmacy, automated billing, and AI clinical summarization into a single cohesive platform.

### What Problems Does It Solve?
- **Siloed Multi-Branch Operations:** Centralizes records, doctors, inventory, and bed availability across multiple clinics (e.g., Satellite, Bopal, Navrangpura).
- **Time-Consuming Doctor Documentation:** Provides voice-to-text dictation and LLM-assisted clinical notes that generate diagnoses, suggested medications, and treatment plans in seconds.
- **Patient Safety Gaps:** Automatically checks proposed prescriptions against known patient allergies and flags drug interactions in real time.
- **Fragmented Inpatient & Outpatient Care:** Seamlessly transitions patients from outpatient consultations to IPD bed admission, rounds tracking, and discharge summaries.

---

## 🚀 Key Features

### 1. 👥 Multi-Role Portal Experiences
The system provides tailored interfaces for 6 specialized user roles:

| Role | Core Capabilities |
| :--- | :--- |
| **👑 Super Admin** | Global clinic analytics, revenue reports, multi-branch oversight, user access provisioning, audit trails, and system settings. |
| **🏢 Clinic Manager** | Branch-level operations, staff scheduling, doctor shift management, bed occupancy oversight, low-stock inventory alerts, and branch financials. |
| **🩺 Doctor** | OPD/IPD queue, patient timeline & medical history, voice-dictated AI clinical notes, digital prescriptions, treatment plans, lab report reviews, and IPD daily rounds. |
| **🛎️ Receptionist** | Front desk triage, quick patient registration, appointment booking & rescheduling, walk-in token allocation, IPD bed assignment, and invoice generation. |
| **💊 Pharmacist** | Real-time prescription fulfillment, batch-level stock tracking, expiry alerts, low-stock warnings, and OTC medicine dispensing. |
| **🧑‍💼 Patient** | Self-service appointment booking wizard, upcoming/past visit tracking, teleconsultation video calls, prescription & lab report downloads, Stripe billing, and live clinic messaging. |

### 2. 🤖 AI Clinical Intelligence
- **Voice Dictation (Groq Whisper Large V3):** Doctor dictates clinical findings; processed entirely in RAM without storing raw audio on disk.
- **Automated Clinical Structuring (Groq / Gemini / Local Engine):** Converts unstructured notes into structured JSON containing chief complaints, assessment, treatment plans, and suggested dosages.
- **Drug Allergy Conflict Detection:** Cross-checks active patient allergies (including penicillin derivatives like amoxicillin, ampicillin, augmentin) and generates prominent safety alerts.

### 3. 🛏️ Inpatient Department (IPD) & Bed Management
- **Visual Bed Grid:** Monitor occupied, available, cleaning, and maintenance beds across categories (General, Semi-Private, Private, ICU).
- **Admission Lifecycle:** Admission forms, admitting doctor assignment, bed allocation, daily clinical rounds, bed transfers, and automated discharge summaries.

### 4. 📹 Embedded Teleconsultation
- Real-time video appointments powered by `@jitsi/react-sdk`.
- Direct one-click join for both doctor and patient with secure room generation.

### 5. 💳 Billing, Invoicing & Payments
- Itemized billing covering consultations, procedures, bed charges, and pharmacy orders.
- Automated PDF invoice & prescription generation via **WeasyPrint** and **Jinja2**.
- Multi-mode payment support (Cash, UPI, Card) alongside online payments with **Stripe**.

### 6. ⚡ Real-Time WebSockets & Notifications
- Instant WebSocket event push for live appointment queue changes, notifications, and chat.
- Asynchronous task processing via Celery & Redis for SMS (Twilio/Fast2SMS), WhatsApp (Meta Cloud API), and Email (SMTP/Mailgun).

---

## 🏛️ System Architecture

```text
               ┌────────────────────────────────────────────────────────┐
               │              React 19 + TypeScript SPA                 │
               │  (Portals: Admin | Manager | Doctor | Recep | Patient) │
               └──────────────────────────┬─────────────────────────────┘
                                          │  HTTP/REST & WebSockets
                                          ▼
               ┌────────────────────────────────────────────────────────┐
               │                  FastAPI Backend Gateway               │
               │   - JWT Auth & RBAC Middleware                         │
               │   - Centralized Exception & Response Handlers          │
               │   - OpenAPI / Swagger Docs                             │
               └──────────┬───────────────────┬───────────────────┬─────┘
                          │                   │                   │
                          ▼                   ▼                   ▼
                 ┌─────────────────┐ ┌─────────────────┐ ┌────────────────┐
                 │ PostgreSQL 16   │ │ Redis 7 Broker  │ │ AI Services    │
                 │ (SQLAlchemy 2.0 │ │ (Cache, Celery  │ │ (Groq Whisper, │
                 │  AsyncPG Engine)│ │  & WebSockets)  │ │  Llama/Gemini) │
                 └─────────────────┘ └────────┬────────┘ └────────────────┘
                                              │
                                              ▼
                                     ┌─────────────────┐
                                     │ Celery Workers  │
                                     │ - Reminders     │
                                     │ - Email / SMS   │
                                     │ - PDF Gen       │
                                     └─────────────────┘
```

---

## 🛠️ Technology Stack

### Backend
- **Framework:** FastAPI 0.115+ (Python 3.12)
- **Database ORM:** SQLAlchemy 2.0 (AsyncIO) with `asyncpg`
- **Migrations:** Alembic
- **Task Queue & Cache:** Celery 5.4, Redis 7
- **Authentication:** JWT (`python-jose`) + password hashing (`passlib`, `bcrypt`)
- **PDF Generation:** WeasyPrint + Jinja2 templates
- **AI Integrations:** Groq SDK (`whisper-large-v3`, `llama-3.3-70b-versatile`), Google Generative AI (`gemini-1.5-flash`), Ollama
- **Storage:** Local static uploads, Cloudinary CDN, AWS S3
- **Payment Gateway:** Stripe Python SDK

### Frontend
- **Framework:** React 19 + TypeScript (Strict Mode)
- **Build Tool:** Vite 8.1
- **Styling:** Custom Modular CSS Design System (`theme.css`) with light/dark variables, glassmorphic modals, and responsive layout
- **Icons:** Lucide React
- **Video:** `@jitsi/react-sdk` (WebRTC)
- **HTTP Client:** Axios with custom in-memory caching and request/response interceptors
- **Linter:** Oxlint

---

## 📂 Project Directory Structure

```text
clinic/
├── backend/
│   ├── alembic/                      # Database migration scripts
│   ├── app/
│   │   ├── api/                      # API route handlers
│   │   │   ├── deps.py               # Dependency injection (Auth, DB)
│   │   │   └── v1/                   # Modular API endpoints
│   │   │       ├── admin.py          # Admin management
│   │   │       ├── ai.py             # Groq Whisper & LLM note generation
│   │   │       ├── appointments.py   # Appointment booking & slots
│   │   │       ├── auth.py           # Login, register, token refresh
│   │   │       ├── billing.py        # Invoicing & payments
│   │   │       ├── branches.py       # Clinic branch management
│   │   │       ├── doctors.py        # Doctor directory & schedules
│   │   │       ├── ipd.py            # Inpatient beds, rounds, discharge
│   │   │       ├── patients.py       # Patient records & clinical history
│   │   │       ├── pharmacy.py       # Inventory & dispensing
│   │   │       ├── teleconsultation.py# Video calls & Jitsi rooms
│   │   │       └── users.py          # User management
│   │   ├── config.py                 # Pydantic BaseSettings
│   │   ├── core/                     # Security, JWT, WebSockets, logging
│   │   ├── db/                       # Engine, session, and seed scripts
│   │   ├── models/                   # SQLAlchemy database entities
│   │   ├── repositories/             # Data access repository layer
│   │   ├── schemas/                  # Pydantic request/response schemas
│   │   ├── services/                 # Business logic services
│   │   ├── tasks/                    # Celery asynchronous workers & beat
│   │   └── main.py                   # FastAPI app entry point
│   ├── docker/                       # Dockerfile, Dockerfile.worker, Nginx
│   ├── tests/                        # Comprehensive Pytest test suite
│   ├── docker-compose.yml            # Multi-container dev orchestration
│   ├── requirements.txt              # Production Python dependencies
│   ├── reset_db.py                   # Reset & re-seed database script
│   └── seed_*.py                     # Granular entity seeders
├── frontend/
│   ├── public/                       # Static public assets
│   ├── src/
│   │   ├── assets/                   # Images and branding
│   │   ├── components/               # Shared reusable UI elements
│   │   ├── context/                  # React context providers
│   │   ├── features/                 # Role-based feature portals
│   │   │   ├── admin/                # Admin Portal UI
│   │   │   ├── auth/                 # Login & Registration UI
│   │   │   ├── doctor/               # Doctor Workspace & AI Dictation
│   │   │   ├── ipdBedManagement/     # Bed Grid & Inpatient Admissions
│   │   │   ├── manager/              # Clinic Operational Management
│   │   │   ├── patient/              # Patient Portal & Booking Wizard
│   │   │   ├── pharmacy/             # Pharmacy & Inventory Management
│   │   │   └── receptionist/         # Front Desk & Triage Portal
│   │   ├── services/                 # Axios API client & interceptors
│   │   ├── App.tsx                   # Master router & session manager
│   │   ├── index.css                 # Base resets & font definitions
│   │   └── theme.css                 # Global design system & tokens
│   ├── Dockerfile                    # Multi-stage production Docker build
│   ├── package.json                  # Node dependencies and scripts
│   └── vite.config.ts                # Vite dev server & proxy settings
└── README.md                         # Project documentation
```

---

## ⚡ Getting Started

### Prerequisites
Make sure you have the following installed on your machine:
- **Git**
- **Docker & Docker Compose** (for Docker setup)
- *OR* for manual setup:
  - **Python 3.12+**
  - **Node.js 20+** and **npm**
  - **PostgreSQL 16+**
  - **Redis 7+**

---

### Option A: Docker Compose (Recommended)

Run the full stack (FastAPI app, Celery worker, Celery beat, PostgreSQL, Redis, and Nginx) with a single command:

1. **Clone the repository:**
   ```bash
   git clone <repository_url>
   cd clinic
   ```

2. **Configure environment:**
   ```bash
   cp backend/.env.example backend/.env
   ```
   *(Update keys such as `GROQ_API_KEY` in `backend/.env` if you wish to use AI features).*

3. **Start all services:**
   ```bash
   cd backend
   docker-compose up --build -d
   ```

4. **Verify containers:**
   ```bash
   docker-compose ps
   ```

5. **Start the frontend:**
   ```bash
   cd ../frontend
   npm install
   npm run dev
   ```

- **Frontend App:** http://localhost:5173
- **FastAPI Documentation:** http://localhost:8000/docs
- **Backend Health Check:** http://localhost:8000/health

---

### Option B: Manual Local Setup

#### 1. Database Setup
Create a PostgreSQL database and user:
```sql
CREATE USER clinic_user WITH PASSWORD 'clinic_secret';
CREATE DATABASE clinic_db OWNER clinic_user;
```
Ensure Redis is running:
```bash
redis-server
```

#### 2. Backend Setup
```bash
cd backend

# Create and activate a Python virtual environment
python3.12 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
```

Initialize tables and seed mock data:
```bash
python reset_db.py
```

Start the FastAPI application:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

*(Optional) Start Celery worker in a separate terminal:*
```bash
celery -A app.tasks.celery_app worker --loglevel=info -Q default,ai,notifications
```

#### 3. Frontend Setup
```bash
cd frontend

# Install Node dependencies
npm install

# Start Vite development server
npm run dev
```

Visit **http://localhost:5173** in your browser.

---

## ⚙️ Configuration & Environment Variables

Copy `backend/.env.example` to `backend/.env` and update the parameters:

```ini
# ── Application
APP_NAME="Suvidha Clinic"
APP_ENV=development             # development | staging | production
APP_VERSION=1.0.0
DEBUG=true

# ── Security
SECRET_KEY=generate_a_secure_32_character_hex_key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7

# ── Database (PostgreSQL)
DATABASE_URL=postgresql+asyncpg://clinic_user:clinic_secret@localhost:5432/clinic_db
SYNC_DATABASE_URL=postgresql://clinic_user:clinic_secret@localhost:5432/clinic_db

# ── Redis & Celery
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/1

# ── AI Provider
AI_PROVIDER=groq                # groq | gemini | ollama
GROQ_API_KEY=gsk_your_groq_api_key
GROQ_MODEL=llama-3.3-70b-versatile
GEMINI_API_KEY=AIzaSy_your_gemini_api_key
GEMINI_MODEL=gemini-1.5-flash

# ── Payments
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CURRENCY=inr

# ── File Storage
STORAGE_BACKEND=local           # local | s3 | cloudinary
UPLOAD_DIR=/app/uploads
MAX_UPLOAD_SIZE_MB=20

# ── Communication (SMS, Email, WhatsApp)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=clinic@example.com
SMTP_PASSWORD=app_password
SMS_PROVIDER=fast2sms           # twilio | fast2sms
WHATSAPP_PROVIDER=meta          # meta | wati | 360dialog
```

---

## 🗄️ Database Management & Seed Data

The project includes built-in scripts to manage and populate initial data:

| Script | Purpose |
| :--- | :--- |
| `python reset_db.py` | Drops all existing tables, recreates the schema, and populates all branches, staff, doctors, slots, beds, medicines, and sample clinical histories. |
| `python clear_seed_data.py` | Safely clears clinical transaction records (appointments, prescriptions, invoices) while retaining admin users and branch definitions. |
| `python seed_beds.py` | Seeds IPD beds across all branches. |
| `python seed_patient_clinical_data.py` | Seeds rich medical histories, reports, and previous visits for testing the Doctor timeline view. |

---

## 🔑 Pre-Configured Demo Credentials

The database seeder creates ready-to-test accounts for every role:

| Role | Email | Password | Branch |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@verticalclinic.com` | `Admin@verticalclinic.com` | All Branches (Global) |
| **Clinic Manager** | `manager@verticalclinic.com` | `ManagerPassword123!` | Bopal (BOP) |
| **Doctor (General)** | `doctor@verticalclinic.com` | `Doctor@verticalclinic.com` | Satellite (SAT) |
| **Doctor (Cardiology)** | `doctor1_bopal@verticalclinic.com` | `Doctor1_bopal@verticalclinic.com` | Bopal (BOP) |
| **Receptionist** | `receptionist@verticalclinic.com` | `Receptionist@123` | Satellite (SAT) |
| **Receptionist (Bopal)**| `receptionist1_bopal@verticalclinic.com` | `Receptionist1_bopal@verticalclinic.com` | Bopal (BOP) |
| **Pharmacist** | `pharmacist@verticalclinic.com` | `Pharmacist@verticalclinic.com` | Satellite (SAT) |
| **Patient** | `patient@verticalclinic.com` | `Patient@verticalclinic.com` | Satellite (SAT) |
| **Patient (Bopal)** | `patient1_bopal@verticalclinic.com` | `Patient1_bopal@verticalclinic.com` | Bopal (BOP) |

---

## 🧠 AI Clinical Assistant Workflow

The AI Clinical Assistant streamlines doctor consultations while safeguarding patient health:

```text
[Doctor Mic Input]
        │
        ▼ (Audio Blob in RAM)
[POST /api/v1/ai/transcribe] ──► Groq Whisper Large V3 ──► Transcribed Text
                                                                 │
                                                                 ▼
[POST /api/v1/ai/analyze-notes] ◄────────────────────────────────┘
        │
        ├──► LLM Prompting (Groq / Gemini / Local Engine)
        │    - Structured clinical summary
        │    - Suggested medications & dosages
        │    - Treatment plan & follow-up recommendation
        │
        ├──► Automated Allergy Conflict Check
        │    - Validates against patient's recorded allergies
        │    - Flags cross-reactivity (e.g., Penicillin -> Amoxicillin)
        │
        ▼
[Populated UI in Doctor Portal]
(Doctor reviews, edits with 1-click, and saves prescription to DB)
```

---

## 📖 API Documentation

FastAPI auto-generates interactive API documentation:
- **Interactive Swagger UI:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc Viewer:** [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **OpenAPI JSON Specification:** [http://localhost:8000/openapi.json](http://localhost:8000/openapi.json)

### Key Endpoint Groups:
- `/api/v1/auth`: Authentication, OTP generation, token refresh
- `/api/v1/admin`: Analytics, staff registration, system audits
- `/api/v1/clinic-manager`: Branch schedules, inventory, and bed KPIs
- `/api/v1/doctors`: Doctor availability, slots, and profiles
- `/api/v1/patients`: Patient profiles, history timeline, document uploads
- `/api/v1/appointments`: Real-time booking, slot locks, cancellation
- `/api/v1/ai`: Audio transcription and note structuring
- `/api/v1/ipd`: Inpatient beds, admissions, rounds, and discharges
- `/api/v1/billing`: Invoices, Stripe sessions, payment verification
- `/api/v1/pharmacy`: Medicine stock, batch management, dispensing
- `/api/v1/teleconsultation`: Jitsi room generation and video sessions
- `/api/v1/ws`: Real-time WebSocket connection for queue and notifications

---

## 🧪 Running Tests & Quality Checks

### Backend Tests
The backend contains an automated Pytest suite covering authentication, role permissions, scheduling, billing, IPD beds, and consultations:

```bash
cd backend
source venv/bin/activate

# Run full test suite
pytest

# Run tests with verbose output and coverage
pytest -v --cov=app tests/

# Run code linter (Ruff)
ruff check .

# Run type checker (Mypy)
mypy app/
```

### Frontend Checks
```bash
cd frontend

# Run Oxlint
npm run lint

# TypeScript compilation check & production build
npm run build
```

---

## 🚢 Production Deployment

### Containerized Deployment
The production Docker configuration uses a hardened, multi-stage image running `uvicorn` behind an Nginx reverse proxy with Gzip compression and rate limiting:

```bash
cd backend
docker-compose -f docker-compose.prod.yml up -d --build
```

### Frontend Deployment (Vercel / Nginx)
The repository includes a root `vercel.json` and a `frontend/Dockerfile` for deploying the SPA frontend with client-side routing rewrites:
```bash
cd frontend
npm run build
# The dist/ directory is ready to be served by any static host or Nginx.
```

---

## 🤝 Contributing & License

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Distributed under the **MIT License**. See `LICENSE` for more information.

---

<p align="center">
  <b>Built for modern, patient-first healthcare operations.</b>
</p>
