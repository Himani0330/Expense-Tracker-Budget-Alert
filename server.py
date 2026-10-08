"""
Expense Tracker with Budget Alerts - Enhanced FastAPI Backend
Provides full CRUD for expenses & income, smart financial analytics,
daily burn rate projections, category budgeting, and dynamic budget alerts.
"""

import json
import os
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

app = FastAPI(
    title="Expense Tracker with Budget Alerts API",
    description="High-performance backend for managing expenses, budgets, category limits, financial health score, and spending alerts.",
    version="2.0.0",
)

# Enable CORS for frontend development and production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
DATA_FILE = os.path.join(DATA_DIR, "expenses.json")
BUDGET_FILE = os.path.join(DATA_DIR, "budget.json")

os.makedirs(DATA_DIR, exist_ok=True)

# ----------------- Models -----------------

class Expense(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    name: str
    amount: float
    category: str
    date: str
    notes: Optional[str] = ""
    type: str = "expense"  # "expense" or "income"
    payment_method: str = "Credit Card"  # "Credit Card", "Debit Card", "Cash", "Bank Transfer", "PayPal"
    is_recurring: bool = False

class ExpenseCreate(BaseModel):
    name: str
    amount: float
    category: str
    date: Optional[str] = None
    notes: Optional[str] = ""
    type: Optional[str] = "expense"
    payment_method: Optional[str] = "Credit Card"
    is_recurring: Optional[bool] = False

class Budget(BaseModel):
    total_budget: float = 1500.0
    warning_threshold: float = 0.90  # 90% default as per spec
    currency: str = "USD"
    currency_symbol: str = "$"
    category_budgets: Dict[str, float] = {
        "Food & Dining": 400.0,
        "Utilities & Bills": 300.0,
        "Entertainment": 150.0,
        "Transportation": 150.0,
        "Shopping": 200.0,
        "Health": 120.0,
        "Education": 100.0,
        "General": 80.0,
    }

# ----------------- Default Seed Data -----------------

today = datetime.now()

DEFAULT_EXPENSES = [
    {
        "id": "exp-101",
        "name": "Whole Foods Market",
        "amount": 142.50,
        "category": "Food & Dining",
        "date": today.strftime("%Y-%m-%d"),
        "notes": "Weekly organic groceries & pantry restock",
        "type": "expense",
        "payment_method": "Credit Card",
        "is_recurring": False,
    },
    {
        "id": "exp-102",
        "name": "Fiber Internet & Power",
        "amount": 118.20,
        "category": "Utilities & Bills",
        "date": (today - timedelta(days=1)).strftime("%Y-%m-%d"),
        "notes": "Monthly high-speed utility bundle",
        "type": "expense",
        "payment_method": "Bank Transfer",
        "is_recurring": True,
    },
    {
        "id": "exp-103",
        "name": "Metro Transit Monthly Card",
        "amount": 65.00,
        "category": "Transportation",
        "date": (today - timedelta(days=2)).strftime("%Y-%m-%d"),
        "notes": "Unlimited commuter subway pass",
        "type": "expense",
        "payment_method": "Debit Card",
        "is_recurring": True,
    },
    {
        "id": "exp-104",
        "name": "IMAX Cinema & Concessions",
        "amount": 38.00,
        "category": "Entertainment",
        "date": (today - timedelta(days=3)).strftime("%Y-%m-%d"),
        "notes": "Sci-Fi premiere screening",
        "type": "expense",
        "payment_method": "Credit Card",
        "is_recurring": False,
    },
    {
        "id": "exp-105",
        "name": "Ergonomic Mechanical Keyboard",
        "amount": 89.99,
        "category": "Shopping",
        "date": (today - timedelta(days=4)).strftime("%Y-%m-%d"),
        "notes": "Productivity workspace equipment",
        "type": "expense",
        "payment_method": "Credit Card",
        "is_recurring": False,
    },
    {
        "id": "exp-106",
        "name": "Gym Membership & Sauna",
        "amount": 55.00,
        "category": "Health",
        "date": (today - timedelta(days=5)).strftime("%Y-%m-%d"),
        "notes": "Monthly athletic club subscription",
        "type": "expense",
        "payment_method": "Debit Card",
        "is_recurring": True,
    },
    {
        "id": "exp-107",
        "name": "Artisan Espresso Beans",
        "amount": 22.50,
        "category": "Food & Dining",
        "date": (today - timedelta(days=6)).strftime("%Y-%m-%d"),
        "notes": "Single origin roast",
        "type": "expense",
        "payment_method": "Cash",
        "is_recurring": False,
    },
    {
        "id": "exp-108",
        "name": "Cloud Computing Course",
        "amount": 49.00,
        "category": "Education",
        "date": (today - timedelta(days=7)).strftime("%Y-%m-%d"),
        "notes": "Professional certification training",
        "type": "expense",
        "payment_method": "Credit Card",
        "is_recurring": False,
    },
]

# ----------------- Storage Helpers -----------------

def load_budget() -> Budget:
    if os.path.exists(BUDGET_FILE):
        try:
            with open(BUDGET_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return Budget(**data)
        except Exception:
            pass
    b = Budget()
    save_budget(b)
    return b

def save_budget(budget: Budget):
    with open(BUDGET_FILE, "w", encoding="utf-8") as f:
        json.dump(budget.model_dump(), f, indent=2)

def load_expenses() -> List[Expense]:
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return [Expense(**item) for item in data]
        except Exception:
            pass
    # Seed default data on initial setup
    expenses = [Expense(**item) for item in DEFAULT_EXPENSES]
    save_expenses(expenses)
    return expenses

def save_expenses(expenses: List[Expense]):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump([e.model_dump() for e in expenses], f, indent=2)

# ----------------- API Endpoints -----------------

@app.get("/health")
def health_check():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}

@app.get("/expenses", response_model=List[Expense])
def get_expenses(
    category: Optional[str] = Query(None, description="Filter by category"),
    search: Optional[str] = Query(None, description="Search by name or note"),
    type: Optional[str] = Query(None, description="Filter by type: expense or income"),
):
    """Retrieve all expenses with optional filtering."""
    expenses = load_expenses()
    if category and category.lower() != "all":
        expenses = [e for e in expenses if e.category.lower() == category.lower()]
    if type and type.lower() != "all":
        expenses = [e for e in expenses if e.type.lower() == type.lower()]
    if search:
        q = search.lower()
        expenses = [
            e for e in expenses
            if q in e.name.lower() or (e.notes and q in e.notes.lower())
        ]
    return expenses

@app.post("/expenses", response_model=Expense, status_code=status.HTTP_201_CREATED)
def create_expense(expense_in: ExpenseCreate):
    """Add a new expense or income item."""
    if expense_in.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0.")
    if not expense_in.name.strip():
        raise HTTPException(status_code=400, detail="Title is required.")

    date_str = expense_in.date or datetime.now().strftime("%Y-%m-%d")
    new_expense = Expense(
        id=str(uuid.uuid4())[:8],
        name=expense_in.name.strip(),
        amount=round(expense_in.amount, 2),
        category=expense_in.category.strip() or "General",
        date=date_str,
        notes=expense_in.notes or "",
        type=expense_in.type or "expense",
        payment_method=expense_in.payment_method or "Credit Card",
        is_recurring=expense_in.is_recurring or False,
    )

    expenses = load_expenses()
    expenses.insert(0, new_expense)
    save_expenses(expenses)
    return new_expense

@app.put("/expenses/{expense_id}", response_model=Expense)
def update_expense(expense_id: str, expense_in: ExpenseCreate):
    """Update an existing transaction."""
    expenses = load_expenses()
    target_idx = None
    for idx, e in enumerate(expenses):
        if e.id == expense_id or str(idx) == expense_id:
            target_idx = idx
            break

    if target_idx is None:
        raise HTTPException(status_code=404, detail="Transaction not found")

    date_str = expense_in.date or expenses[target_idx].date
    updated = Expense(
        id=expenses[target_idx].id,
        name=expense_in.name.strip(),
        amount=round(expense_in.amount, 2),
        category=expense_in.category.strip() or "General",
        date=date_str,
        notes=expense_in.notes or "",
        type=expense_in.type or expenses[target_idx].type,
        payment_method=expense_in.payment_method or expenses[target_idx].payment_method,
        is_recurring=expense_in.is_recurring if expense_in.is_recurring is not None else expenses[target_idx].is_recurring,
    )
    expenses[target_idx] = updated
    save_expenses(expenses)
    return updated

@app.delete("/expenses/{identifier}")
def delete_expense(identifier: str):
    """Delete an expense by ID or numeric index."""
    expenses = load_expenses()
    removed = None

    for idx, e in enumerate(expenses):
        if e.id == identifier:
            removed = expenses.pop(idx)
            break

    if removed is None and identifier.isdigit():
        idx = int(identifier)
        if 0 <= idx < len(expenses):
            removed = expenses.pop(idx)

    if removed is None:
        raise HTTPException(status_code=404, detail=f"Expense '{identifier}' not found.")

    save_expenses(expenses)
    return {"message": "Transaction successfully deleted", "deleted_item": removed}

@app.get("/budget", response_model=Budget)
def get_budget():
    """Retrieve current budget settings."""
    return load_budget()

@app.put("/budget", response_model=Budget)
def update_budget(new_budget: Budget):
    """Update overall budget, currency, and category budgets."""
    if new_budget.total_budget <= 0:
        raise HTTPException(status_code=400, detail="Total budget must be greater than 0.")
    save_budget(new_budget)
    return new_budget

@app.put("/budget/category")
def update_category_budget(category: str = Query(...), limit: float = Query(...)):
    """Update budget allocation for an individual category."""
    budget = load_budget()
    if limit < 0:
        raise HTTPException(status_code=400, detail="Category limit cannot be negative.")
    budget.category_budgets[category] = round(limit, 2)
    save_budget(budget)
    return {"category": category, "new_limit": limit}

@app.get("/summary")
def get_summary():
    """Get calculated summary, category breakdown, and budget alert status."""
    expenses = load_expenses()
    budget = load_budget()

    actual_expenses = [e for e in expenses if getattr(e, "type", "expense") == "expense"]
    income_items = [e for e in expenses if getattr(e, "type", "expense") == "income"]

    total_spent = round(sum(e.amount for e in actual_expenses), 2)
    total_income = round(sum(e.amount for e in income_items), 2)
    net_savings = round(total_income - total_spent, 2) if total_income > 0 else 0.0

    remaining = round(budget.total_budget - total_spent, 2)
    percent_used = round((total_spent / budget.total_budget * 100), 1) if budget.total_budget > 0 else 0.0

    # Category breakdown
    category_totals: Dict[str, float] = {}
    for e in actual_expenses:
        category_totals[e.category] = round(category_totals.get(e.category, 0.0) + e.amount, 2)

    category_stats = []
    for cat, total in sorted(category_totals.items(), key=lambda x: x[1], reverse=True):
        cat_budget = budget.category_budgets.get(cat, 0.0)
        cat_percent = round((total / cat_budget * 100), 1) if cat_budget > 0 else 0.0
        category_stats.append({
            "category": cat,
            "spent": total,
            "budget": cat_budget,
            "percent_of_category_budget": cat_percent,
            "is_over_category": total > cat_budget if cat_budget > 0 else False,
        })

    # Alert status determination (90% is threshold per README specification)
    warning_cutoff = budget.warning_threshold * 100  # 90%
    if total_spent > budget.total_budget:
        alert_level = "exceeded"
        alert_message = f"🚨 Critical Overspend: You have exceeded your budget by {budget.currency_symbol}{abs(remaining):.2f}!"
    elif percent_used >= warning_cutoff:
        alert_level = "warning"
        alert_message = f"⚠️ Budget Alert: You have used {percent_used}% of your budget ({budget.currency_symbol}{total_spent:.2f} of {budget.currency_symbol}{budget.total_budget:.2f})!"
    elif percent_used >= 75.0:
        alert_level = "notice"
        alert_message = f"ℹ️ Approaching limit: You have reached {percent_used}% of your budget limit."
    else:
        alert_level = "ok"
        alert_message = f"✅ Budget Healthy: {budget.currency_symbol}{remaining:.2f} remaining ({100 - percent_used:.1f}% available)."

    highest_expense = max(actual_expenses, key=lambda e: e.amount).model_dump() if actual_expenses else None

    return {
        "total_budget": budget.total_budget,
        "warning_threshold": budget.warning_threshold,
        "currency": budget.currency,
        "currency_symbol": budget.currency_symbol,
        "total_spent": total_spent,
        "total_income": total_income,
        "net_savings": net_savings,
        "remaining": remaining,
        "percent_used": percent_used,
        "alert_level": alert_level,
        "alert_message": alert_message,
        "expense_count": len(actual_expenses),
        "income_count": len(income_items),
        "highest_expense": highest_expense,
        "category_breakdown": category_stats,
        "recent_expenses": [e.model_dump() for e in expenses[:6]],
    }

@app.get("/analytics")
def get_analytics():
    """Advanced financial health score, daily spending velocity, runway, and AI insights."""
    expenses = load_expenses()
    budget = load_budget()

    actual_expenses = [e for e in expenses if getattr(e, "type", "expense") == "expense"]
    total_spent = sum(e.amount for e in actual_expenses)
    percent_used = (total_spent / budget.total_budget * 100) if budget.total_budget > 0 else 0.0

    # Daily spending map (last 14 days)
    daily_map: Dict[str, float] = {}
    today_dt = datetime.now()
    for i in range(13, -1, -1):
        d_str = (today_dt - timedelta(days=i)).strftime("%Y-%m-%d")
        daily_map[d_str] = 0.0

    for e in actual_expenses:
        if e.date in daily_map:
            daily_map[e.date] = round(daily_map[e.date] + e.amount, 2)

    daily_series = [{"date": k, "amount": v} for k, v in daily_map.items()]

    # Spending velocity (daily burn rate based on days with records or default 30 days)
    days_recorded = len(set(e.date for e in actual_expenses)) or 1
    burn_rate = round(total_spent / max(days_recorded, 1), 2)
    remaining = max(budget.total_budget - total_spent, 0)
    runway_days = round(remaining / burn_rate, 1) if burn_rate > 0 else 999.0

    # Calculate Financial Health Score (0 - 100)
    score = 100
    if percent_used > 100:
        score -= min(60, int(percent_used - 100) * 2)
    elif percent_used >= 90:
        score -= 30
    elif percent_used >= 75:
        score -= 15
    elif percent_used >= 50:
        score -= 5

    # Check category overspends
    over_count = 0
    for e in actual_expenses:
        cat_limit = budget.category_budgets.get(e.category, 0)
        cat_total = sum(item.amount for item in actual_expenses if item.category == e.category)
        if cat_limit > 0 and cat_total > cat_limit:
            over_count += 1
    score -= min(25, over_count * 5)
    score = max(10, min(100, score))

    if score >= 90:
        grade = "A+"
        grade_desc = "Outstanding Financial Discipline"
    elif score >= 80:
        grade = "A"
        grade_desc = "Healthy & Well-Controlled"
    elif score >= 70:
        grade = "B"
        grade_desc = "Fair - Moderate Spending Alert"
    elif score >= 50:
        grade = "C"
        grade_desc = "At Risk - Exceeding Thresholds"
    else:
        grade = "D"
        grade_desc = "Critical - Budget Overrun"

    # Smart AI Insights & Recommendations
    insights = []
    if percent_used >= 90:
        insights.append("🚨 Emergency alert: You have exceeded 90% of your allocated budget. Postpone discretionary shopping.")
    elif percent_used < 60:
        insights.append(f"✨ Great job! You are pacing well under your budget with {100 - round(percent_used, 1)}% remaining.")

    # Find highest category
    cat_totals = {}
    for e in actual_expenses:
        cat_totals[e.category] = cat_totals.get(e.category, 0) + e.amount
    if cat_totals:
        top_cat = max(cat_totals.items(), key=lambda x: x[1])
        cat_pct = round(top_cat[1] / total_spent * 100, 1) if total_spent > 0 else 0
        insights.append(f"📊 Top spending in '{top_cat[0]}' consumes {cat_pct}% of total expenses ({budget.currency_symbol}{top_cat[1]:.2f}).")

    if burn_rate > 0:
        insights.append(f"⚡ Daily burn rate is {budget.currency_symbol}{burn_rate:.2f}/day. At this pace, your budget lasts ~{int(runway_days)} more days.")

    recurring_sum = sum(e.amount for e in actual_expenses if e.is_recurring)
    if recurring_sum > 0:
        insights.append(f"🔄 Fixed recurring subscriptions total {budget.currency_symbol}{recurring_sum:.2f} per month.")

    return {
        "health_score": score,
        "grade": grade,
        "grade_description": grade_desc,
        "burn_rate": burn_rate,
        "runway_days": runway_days,
        "daily_series": daily_series,
        "insights": insights,
    }

@app.post("/expenses/seed")
def seed_data():
    """Reset to rich demonstration expenses."""
    expenses = [Expense(**item) for item in DEFAULT_EXPENSES]
    save_expenses(expenses)
    return {"message": "Sample demonstration data reloaded successfully", "count": len(expenses)}

@app.post("/expenses/clear")
def clear_all_expenses():
    """Clear all recorded expenses."""
    save_expenses([])
    return {"message": "All expenses cleared successfully."}

# Mount static build folder if it exists
DIST_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dist")
if os.path.exists(DIST_DIR):
    app.mount("/", StaticFiles(directory=DIST_DIR, html=True), name="static")
