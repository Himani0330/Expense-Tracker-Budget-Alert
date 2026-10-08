# Expense Tracker with Budget Alerts 💸🚨

A modern, high-performance, full-stack financial management web application built with **React (Frontend)** and **FastAPI (Backend)**. It allows users to track expenses in real-time, categorize transactions, visualize spending distribution with interactive analytics, and receive dynamic budget alerts when approaching or exceeding limits.

---

## 🌟 Key Features

- **Dynamic Budget Alerts:**
  - Real-time alert banner that triggers when spending hits **90% of budget limit** (or custom threshold).
  - High-priority warnings when budget is exceeded with dollar-level overspend calculation.
  - Safe status indicator when budget health is optimal.
- **Visual Analytics:**
  - Interactive SVG Donut chart displaying spending percentage across categories.
  - Category progress breakdown with individual category budget comparisons.
- **Transaction Management:**
  - Add, edit, and delete expense transactions.
  - Categorization across *Food & Dining*, *Utilities & Bills*, *Transportation*, *Entertainment*, *Shopping*, *Health*, and *General*.
  - Instant real-time text search and multi-category filtering pills.
  - Multi-attribute sorting (Newest, Oldest, Highest Amount, Lowest Amount, Title).
- **Data Persistence & Export:**
  - Persistent JSON database in FastAPI backend.
  - Automatic graceful fallback to `localStorage` if backend is offline.
  - One-click **CSV Report Export** for spreadsheets.
  - One-click **Demo Data loader** to instantly test with realistic expenses.
- **Design System:**
  - Rich glassmorphism dark aesthetic with vibrant tailored accents and micro-animations.
  - Clean responsive layout matching modern financial dashboards.

---

## 🛠️ Tech Stack

- **Frontend:** React 18, Vite, Vanilla CSS Design System, Responsive SVG Data Visualizations
- **Backend:** FastAPI, Pydantic, Uvicorn, Python 3.9+
- **Storage:** JSON persistence (`data/expenses.json`, `data/budget.json`)
- **API Protocol:** RESTful HTTP API with CORS & Vite Reverse Proxy

---

## 🚀 Quickstart Guide

### 1. Prerequisites
- Python 3.9+
- Node.js & npm

### 2. Backend Setup (FastAPI)
Install Python dependencies and start the backend:
```bash
pip install fastapi uvicorn
python -m uvicorn server:app --reload --port 8000
```
The API is live at `http://127.0.0.1:8000`.

### 3. Frontend Setup (React + Vite)
In a separate terminal, start the development server:
```bash
npm install
npm run dev
```
Open your browser and navigate to `http://localhost:3000`.

---

## 📡 REST API Endpoints

### Expenses
- `GET /expenses` — Retrieve all expenses (supports `?category=` and `?search=`).
- `POST /expenses` — Add a new expense.
- `PUT /expenses/{id}` — Update an existing expense.
- `DELETE /expenses/{id}` — Delete an expense.
- `POST /expenses/seed` — Reload sample demonstration expenses.
- `POST /expenses/clear` — Clear all recorded expenses.

### Budget & Summary
- `GET /budget` — Retrieve the current budget settings and category thresholds.
- `PUT /budget` — Update overall budget and alert threshold.
- `GET /summary` — Retrieve aggregated metrics, alert level, percent used, and category breakdown.

---

## 📄 License
This project is open-source and available under the **MIT License**.
