# PETRAILS — AI-Assisted Pet Insurance Risk & Claims Intelligence Platform

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7.2-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3.1-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.4.5-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.13-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![MongoDB Atlas](https://img.shields.io/badge/MongoDB-Atlas_Cloud-47A248?logo=mongodb&logoColor=white)](https://cloud.mongodb.com/)
[![scikit-learn](https://img.shields.io/badge/scikit--learn-1.7.2-F7931E?logo=scikit-learn&logoColor=white)](https://scikit-learn.org/)
[![SHAP](https://img.shields.io/badge/SHAP-0.54.1-red)](https://shap.readthedocs.io/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

> **PETRAILS** is an enterprise-grade, full-stack actuarial intelligence platform built for pet insurance underwriters, claims adjusters, and veterinary medical officers. It couples deterministic actuarial insurance guidelines with trained machine learning models, explainable AI (SHAP), and live cloud database persistence via MongoDB Atlas.

---

## 🌟 Key Capabilities

1. **Transparent Dual-Engine Underwriting:**
   - **Deterministic Rule Engine:** Encodes Guidewire-compliant baseline underwriting guidelines based on species, breed susceptibility (e.g. brachycephalic airway syndrome, large-breed hip dysplasia), life-stage age transitions, and declared clinical history.
   - **Predictive ML Risk Model:** A trained `RandomForestRegressor` operating on independent clinical feature vectors to forecast loss severity and claim risk index (10–95).
   - **Explainable AI (SHAP):** Fitted `shap.TreeExplainer` calculating exact Shapley delta attributions ($\sum \phi_i + \text{Base} = \text{Prediction}$) to show underwriters *why* an assessment received its score.

2. **Claims Intelligence & Anomaly Detection:**
   - **Regional Tariff Benchmark Engine:** Compares itemized veterinary invoices against regional market fee bound tables (`standardMarketRangeInr`).
   - **IsolationForest Anomaly Detector:** Identifies statistical outliers in billed-to-benchmark ratios, item counts, and episodic claim cadence.
   - **Non-Accusatory Human-in-the-Loop Protocol:** Flags statistical variance for adjuster review rather than presuming fraud or automating claim denial.

3. **Live Cloud Persistence (MongoDB Atlas):**
   - Full asynchronous database integration via PyMongo Async (`petrails_db`).
   - Persists 7 core collections: `users`, `pets`, `assessments`, `claims`, `notifications`, `information_requests`, and `audit_logs`.
   - Complete audit trail logging every underwriter approval, stipulation, and claims settlement payout.

4. **Clinical Information Gap Resolution:**
   - Detects ambiguous veterinary records (e.g. unconfirmed joint laxity, vaccination gaps).
   - Dispatches structured clinical inquiries directly to treating veterinary clinics.

---

## 🏗️ Architecture Overview

```
                          ┌────────────────────────┐
                          │   React 18 + Vite UI   │
                          │ (Tailwind CSS, Lucide) │
                          │     Port: 5173         │
                          └───────────┬────────────┘
                                      │ HTTP REST (Proxy: /api)
                                      ▼
                          ┌────────────────────────┐
                          │  FastAPI Backend Core  │
                          │     (Python 3.13)      │
                          │     Port: 8000         │
                          └─────┬────────────┬─────┘
                                │            │
            ┌───────────────────┘            └───────────────────┐
            ▼                                                    ▼
┌───────────────────────────────┐                ┌───────────────────────────────┐
│     Actuarial Intelligence    │                │      MongoDB Atlas Cloud      │
│  - Actuarial Rule Engine      │                │  (PyMongo Async Connection)   │
│  - RandomForest Risk Model    │                │  - Users & Roles (JWT Auth)   │
│  - SHAP TreeExplainer (XAI)   │                │  - Pets & Clinical Records    │
│  - IsolationForest Anomaly    │                │  - Assessments & Claims       │
│  - Safe Age Regex Normalizer  │                │  - Audit Logs & Gaps          │
└───────────────────────────────┘                └───────────────────────────────┘
```

---

## 📁 Repository Structure

```
Petrails/
├── index.html                   # HTML entrypoint with Cinzel & Inter typography preloads
├── package.json                 # Node dependencies & frontend scripts
├── tsconfig.json                # TypeScript compiler configuration
├── vite.config.ts               # Vite bundler configuration & backend API proxy
├── .gitignore                   # Multi-platform production gitignore (protects secrets)
│
├── backend/                     # Python FastAPI Backend Architecture
│   ├── .env.example             # Template for MongoDB URI and JWT secrets
│   ├── main.py                  # Backend root forwarder (app.main:app)
│   ├── requirements.txt         # Pinned Python package dependencies
│   ├── run.bat                  # One-click Windows CMD launch script
│   ├── run.ps1                  # One-click Windows PowerShell launch script
│   │
│   └── app/                     # Modular Application Package
│       ├── main.py              # FastAPI application factory, lifespan, CORS
│       ├── core/
│       │   ├── config.py        # Pydantic Settings management (.env loading)
│       │   ├── database.py      # Async MongoClient connection, ping, & indexes
│       │   └── security.py      # Bcrypt password hashing, JWT creation & RBAC
│       ├── api/                 # REST Route Controllers
│       │   ├── routes_auth.py   # Registration, Login, and Profile endpoints
│       │   ├── routes_health.py # Health checks & MongoDB ping diagnostics
│       │   ├── routes_pets.py   # Pet dossier CRUD operations
│       │   ├── routes_assessments.py # Underwriting assessments & decisions
│       │   ├── routes_claims.py # Claims intake, anomaly detection & review
│       │   ├── routes_operations.py # Information gaps & notification endpoints
│       │   └── routes_analytics.py  # Portfolio loss ratios & risk aggregation
│       ├── schemas/             # Pydantic Request & Response Data Models
│       │   ├── auth.py, health.py, pet.py, assessment.py, claim.py, analytics.py
│       ├── services/            # Business & Actuarial Intelligence Logic
│       │   ├── audit_service.py # Immutable MongoDB audit trail logger
│       │   └── intelligence_service.py # Dual-Engine coordinator
│       ├── ml/                  # Machine Learning & Explainable AI Module
│       │   ├── train_models.py  # Dataset generator & scikit-learn training pipeline
│       │   ├── inference.py     # Real-time model inference & SHAP calculation
│       │   ├── data/            # Exported actuarial training data & README
│       │   │   ├── pet_underwriting_actuarial_v1.csv
│       │   │   └── README.md
│       │   └── models/          # Serialized scikit-learn & SHAP model artifacts
│       │       ├── underwriting_risk_model.joblib
│       │       └── claims_anomaly_model.joblib
│       └── tests/               # Automated Pytest Test Suite (35 tests)
│           ├── test_ml_pipeline.py, test_auth.py, test_pets.py, ...
│
└── src/                         # React 18 Frontend Application
    ├── App.tsx                  # Root application router & layout wrapper
    ├── main.tsx                 # DOM mounting point
    ├── index.css                # Tailwind directives & CSS design tokens
    ├── context/
    │   └── AppContext.tsx       # Live application state & backend synchronization
    ├── components/
    │   ├── common/              # AssessmentCard, ClaimCard, ExplainabilityPanel, ...
    │   └── navigation/          # Navbar, NotificationCenter, SearchModal
    ├── pages/                   # 13 Application Pages
    │   ├── LandingPage.tsx      # Public platform overview & value proposition
    │   ├── SignInPage.tsx       # Institutional authentication
    │   ├── SignUpPage.tsx       # Underwriter onboarding
    │   ├── DashboardPage.tsx    # Underwriter mission control
    │   ├── AssessmentsPage.tsx  # Policy underwriting queue
    │   ├── RiskAssessmentDetailPage.tsx # Deep-dive Dual-Engine & SHAP factor dossier
    │   ├── NewAssessmentPage.tsx# Policy application intake wizard
    │   ├── ClaimsPage.tsx       # Claims adjudication workspace (Table & Card views)
    │   ├── ClaimDetailPage.tsx  # Forensic invoice & treatment adjudication
    │   ├── PetDetailPage.tsx    # Longitudinal pet clinical history
    │   ├── InformationRequestsPage.tsx # Clinical gap inquiry dispatch center
    │   ├── AnalyticsPage.tsx    # Actuarial portfolio analytics & risk distributions
    │   ├── ProfilePage.tsx      # Underwriter profile & authority limit
    │   └── SettingsPage.tsx     # System settings & notification controls
    ├── services/                # Axios/Fetch API client layer
    │   ├── apiClient.ts, authService.ts, petService.ts, claimService.ts, ...
    └── types/                   # TypeScript interfaces (Pet, Claim, Assessment, SHAP)
```

---

## ⚡ Quickstart Guide

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **Python**: 3.10+ (Anaconda or standard 64-bit Python)
- **MongoDB Atlas**: Active cluster connection URI

---

### 2. Backend Setup & Startup

1. **Navigate to the backend folder:**
   ```bash
   cd backend
   ```

2. **Configure Environment Variables:**
   Copy `.env.example` to `.env` and provide your MongoDB Atlas credentials:
   ```bash
   cp .env.example .env
   ```
   *Edit `.env`:*
   ```ini
   HOST=0.0.0.0
   PORT=8000
   MONGODB_URI=mongodb+srv://<username>:<password>@petrails.asxljqd.mongodb.net/?retryWrites=true&w=majority
   MONGODB_DATABASE=petrails_db
   JWT_SECRET_KEY=petrails-super-secret-key-change-in-production-2026
   JWT_ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=1440
   CORS_ORIGINS=["http://localhost:5173","http://127.0.0.1:5173","*"]
   ```

3. **Install Dependencies into Virtual Environment:**
   ```bash
   python -m venv .venv
   .\.venv\Scripts\activate
   pip install -r requirements.txt
   ```

4. **Train and Export Machine Learning Models:**
   ```bash
   python -m app.ml.train_models
   ```

5. **Start the FastAPI Backend:**
   - **In PowerShell:**
     ```powershell
     .\run.ps1
     ```
   - **In Command Prompt (CMD):**
     ```cmd
     run.bat
     ```
   - *Backend runs on **`http://127.0.0.1:8000`**.*
   - *Interactive Swagger UI is available at **`http://127.0.0.1:8000/docs`**.*

---

### 3. Frontend Setup & Startup

1. **From the project root directory:**
   ```bash
   npm install
   ```

2. **Run the Vite Development Server:**
   ```bash
   npm run dev
   ```
   - *Application runs on **`http://localhost:5173/`**.*
   - *Vite automatically proxies `/api` requests to `http://localhost:8000`.*

---

## 🧪 Testing and Verification

### Backend Automated Pytest Suite
Run the full test suite containing **35 passing tests**:
```bash
cd backend
python -m pytest
```
*Coverage includes:*
- `test_ml_pipeline.py`: AgeText regex normalizer, model loading, real inference, SHAP additivity reconciliation ($\Delta = 0.000000$), and claims IsolationForest.
- `test_auth.py`: User registration, bcrypt password hashing (12 rounds), JWT issuance, and RBAC role checks.
- `test_pets.py`: Pet dossier creation, listing, and ID lookups.
- `test_assessments.py`: Dual-Engine risk scoring, SHAP factors, and decision audit recording.
- `test_claims.py`: Claims intake, regional tariff deviation evaluation, and adjuster payout approvals.
- `test_analytics.py`: MongoDB portfolio loss ratio aggregations and breed risk trends.
- `test_health.py`: Live database ping and service heartbeat diagnostics.

### Frontend Production Build
```bash
npm run build
```
*Compiles TypeScript without type errors (`tsc -b`) and generates production bundles in `dist/` via Vite.*

---

## 🔐 Default Credentials (Seed Underwriter)

When the backend boots against a fresh MongoDB Atlas instance, default seed underwriters auto-bootstrap on first login:

- **Email:** `sarah.jenkins@petrails.insure`
- **Password:** `Petrails@2026`
- **Role:** Senior Underwriting Officer
- **Authority Limit:** ₹5,00,000 (Tata AIG General Insurance)

---

## 📄 Academic Research & Attribution

Developed as part of the **Guidewire Pet Insurance Underwriting & Claims Intelligence Research Project** at **Reva University**.

Designed with ❤️ for veterinary actuaries, underwriters, and claims specialists worldwide.
