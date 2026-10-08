import React, { useState, useEffect, useMemo } from "react";

// API Base URL (FastAPI)
const API_BASE = "http://127.0.0.1:8000";

// Supported Currencies
const CURRENCIES = [
  { code: "USD", symbol: "$", label: "USD ($)" },
  { code: "EUR", symbol: "€", label: "EUR (€)" },
  { code: "GBP", symbol: "£", label: "GBP (£)" },
  { code: "CAD", symbol: "C$", label: "CAD ($)" },
  { code: "INR", symbol: "₹", label: "INR (₹)" },
  { code: "NGN", symbol: "₦", label: "NGN (₦)" },
  { code: "JPY", symbol: "¥", label: "JPY (¥)" },
];

// Color & Icon Mappings
const CATEGORIES = [
  { name: "Food & Dining", icon: "🍕", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.15)" },
  { name: "Utilities & Bills", icon: "⚡", color: "#3b82f6", bg: "rgba(59, 130, 246, 0.15)" },
  { name: "Transportation", icon: "🚗", color: "#10b981", bg: "rgba(16, 185, 129, 0.15)" },
  { name: "Entertainment", icon: "🎬", color: "#a855f7", bg: "rgba(168, 85, 247, 0.15)" },
  { name: "Shopping", icon: "🛍️", color: "#ec4899", bg: "rgba(236, 72, 153, 0.15)" },
  { name: "Health", icon: "💊", color: "#06b6d4", bg: "rgba(6, 182, 212, 0.15)" },
  { name: "Education", icon: "📚", color: "#6366f1", bg: "rgba(99, 102, 241, 0.15)" },
  { name: "General", icon: "🏷️", color: "#818cf8", bg: "rgba(129, 140, 248, 0.15)" },
];

const PAYMENT_METHODS = [
  { name: "Credit Card", icon: "💳" },
  { name: "Debit Card", icon: "🏧" },
  { name: "Cash", icon: "💵" },
  { name: "Bank Transfer", icon: "🏦" },
  { name: "PayPal", icon: "🅿️" },
];

// Web Audio synthesizer for pleasant notifications
const playSound = (type = "chime") => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "warning") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.setValueAtTime(240, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } else {
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch {
    // Ignore audio restrictions
  }
};

export default function App() {
  const [expenses, setExpenses] = useState([]);
  const [budget, setBudget] = useState({
    total_budget: 1500,
    warning_threshold: 0.9,
    currency: "USD",
    currency_symbol: "$",
    category_budgets: {
      "Food & Dining": 400,
      "Utilities & Bills": 300,
      "Entertainment": 150,
      "Transportation": 150,
      "Shopping": 200,
      "Health": 120,
      "Education": 100,
      "General": 80,
    },
  });

  const [analytics, setAnalytics] = useState({
    health_score: 88,
    grade: "A",
    grade_description: "Healthy & Well-Controlled",
    burn_rate: 42.50,
    runway_days: 22.4,
    daily_series: [],
    insights: ["✨ Financial pacing is optimal. Remaining balance is well above threshold."],
  });

  const [serverOnline, setServerOnline] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [theme, setTheme] = useState("default"); // default, emerald, amber, violet
  const [activeChartTab, setActiveChartTab] = useState("donut"); // donut, trends, comparison

  // Filter & Search Controls
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedType, setSelectedType] = useState("all"); // all, expense, income
  const [dateRangeFilter, setDateRangeFilter] = useState("all"); // all, today, week, month
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");

  // Modals
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [isCategoryBudgetModalOpen, setIsCategoryBudgetModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);

  // Form State
  const [expenseForm, setExpenseForm] = useState({
    name: "",
    amount: "",
    category: "Food & Dining",
    date: new Date().toISOString().split("T")[0],
    notes: "",
    type: "expense",
    payment_method: "Credit Card",
    is_recurring: false,
  });

  const [budgetForm, setBudgetForm] = useState({
    total_budget: 1500,
    warning_threshold: 0.9,
    currency: "USD",
    currency_symbol: "$",
  });

  const [categoryBudgetsForm, setCategoryBudgetsForm] = useState({});

  // Toasts
  const [toasts, setToasts] = useState([]);
  const addToast = (message, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    if (soundEnabled) {
      playSound(type === "danger" || type === "warning" ? "warning" : "chime");
    }
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  };

  // Switch Theme
  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    document.body.className = newTheme === "default" ? "" : `theme-${newTheme}`;
  };

  // Fetch backend data
  const loadData = async () => {
    try {
      const [resExp, resBud, resAna] = await Promise.all([
        fetch(`${API_BASE}/expenses`).then((r) => (r.ok ? r.json() : Promise.reject())),
        fetch(`${API_BASE}/budget`).then((r) => (r.ok ? r.json() : Promise.reject())),
        fetch(`${API_BASE}/analytics`).then((r) => (r.ok ? r.json() : Promise.resolve(null))),
      ]);

      setExpenses(resExp);
      setBudget(resBud);
      setBudgetForm({
        total_budget: resBud.total_budget,
        warning_threshold: resBud.warning_threshold || 0.9,
        currency: resBud.currency || "USD",
        currency_symbol: resBud.currency_symbol || "$",
      });
      setCategoryBudgetsForm(resBud.category_budgets || {});
      if (resAna) setAnalytics(resAna);
      setServerOnline(true);
    } catch {
      // Local fallback
      setServerOnline(false);
      const savedExpenses = localStorage.getItem("et_expenses_v2");
      const savedBudget = localStorage.getItem("et_budget_v2");
      if (savedExpenses) setExpenses(JSON.parse(savedExpenses));
      if (savedBudget) {
        const b = JSON.parse(savedBudget);
        setBudget(b);
        setBudgetForm({
          total_budget: b.total_budget,
          warning_threshold: b.warning_threshold || 0.9,
          currency: b.currency || "USD",
          currency_symbol: b.currency_symbol || "$",
        });
        setCategoryBudgetsForm(b.category_budgets || {});
      }
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/health`);
        if (res.ok && !serverOnline) {
          setServerOnline(true);
          loadData();
        }
      } catch {
        if (serverOnline) setServerOnline(false);
      }
    }, 7000);
    return () => clearInterval(interval);
  }, [serverOnline]);

  // Sync to local storage if offline
  useEffect(() => {
    if (!serverOnline) {
      localStorage.setItem("et_expenses_v2", JSON.stringify(expenses));
      localStorage.setItem("et_budget_v2", JSON.stringify(budget));
    }
  }, [expenses, budget, serverOnline]);

  const curr = budget.currency_symbol || "$";

  // Calculations
  const expenseItems = useMemo(() => expenses.filter((e) => (e.type || "expense") === "expense"), [expenses]);
  const incomeItems = useMemo(() => expenses.filter((e) => e.type === "income"), [expenses]);

  const totalSpent = useMemo(() => {
    return Math.round(expenseItems.reduce((sum, item) => sum + Number(item.amount), 0) * 100) / 100;
  }, [expenseItems]);

  const totalIncome = useMemo(() => {
    return Math.round(incomeItems.reduce((sum, item) => sum + Number(item.amount), 0) * 100) / 100;
  }, [incomeItems]);

  const netSavings = useMemo(() => {
    return Math.round((totalIncome - totalSpent) * 100) / 100;
  }, [totalIncome, totalSpent]);

  const remainingBudget = useMemo(() => {
    return Math.round((budget.total_budget - totalSpent) * 100) / 100;
  }, [budget.total_budget, totalSpent]);

  const percentUsed = useMemo(() => {
    if (!budget.total_budget || budget.total_budget <= 0) return 0;
    return Math.round((totalSpent / budget.total_budget) * 1000) / 10;
  }, [totalSpent, budget.total_budget]);

  // Alert determination (90% threshold per spec)
  const alertStatus = useMemo(() => {
    const thresholdPercent = (budget.warning_threshold || 0.9) * 100;
    if (totalSpent > budget.total_budget) {
      return {
        level: "exceeded",
        title: "🚨 Critical Overspend Detected!",
        message: `You have exceeded your ${curr}${budget.total_budget.toFixed(2)} budget by ${curr}${Math.abs(remainingBudget).toFixed(2)}. Spending pause advised!`,
      };
    }
    if (percentUsed >= thresholdPercent) {
      return {
        level: "warning",
        title: `⚠️ 90% Budget Alert Triggered (${percentUsed}%)`,
        message: `You have consumed ${percentUsed}% of your ${curr}${budget.total_budget.toFixed(2)} monthly limit (${curr}${totalSpent.toFixed(2)} spent, ${curr}${remainingBudget.toFixed(2)} remaining).`,
      };
    }
    if (percentUsed >= 75) {
      return {
        level: "warning",
        title: `ℹ️ Notice: Approaching Limit (${percentUsed}%)`,
        message: `Spending is nearing your threshold. You have ${curr}${remainingBudget.toFixed(2)} left.`,
      };
    }
    return {
      level: "ok",
      title: "✅ Budget Health: Optimal",
      message: `You have ${curr}${remainingBudget.toFixed(2)} available (${(100 - percentUsed).toFixed(1)}% of your budget is unspent).`,
    };
  }, [totalSpent, budget.total_budget, budget.warning_threshold, percentUsed, remainingBudget, curr]);

  // Category Totals
  const categoryTotals = useMemo(() => {
    const map = {};
    expenseItems.forEach((e) => {
      map[e.category] = (map[e.category] || 0) + Number(e.amount);
    });
    return Object.entries(map)
      .map(([cat, total]) => {
        const catInfo = CATEGORIES.find((c) => c.name === cat) || {
          name: cat,
          icon: "🏷️",
          color: "#818cf8",
        };
        const catBudget = (budget.category_budgets && budget.category_budgets[cat]) || 0;
        const catPercent = catBudget > 0 ? Math.round((total / catBudget) * 100) : 0;
        return {
          category: cat,
          total: Math.round(total * 100) / 100,
          percentOfBudget: budget.total_budget > 0 ? Math.round((total / budget.total_budget) * 100) : 0,
          catBudget,
          catPercent,
          isOver: catBudget > 0 && total > catBudget,
          icon: catInfo.icon,
          color: catInfo.color,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [expenseItems, budget]);

  // Filtered & Sorted Transactions
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    return expenses
      .filter((e) => {
        const matchesCategory = selectedCategory === "All" || e.category === selectedCategory;
        const matchesType = selectedType === "all" || (e.type || "expense") === selectedType;

        // Date range
        let matchesDate = true;
        if (dateRangeFilter === "today") {
          matchesDate = e.date === now.toISOString().split("T")[0];
        } else if (dateRangeFilter === "week") {
          const itemDate = new Date(e.date);
          const diffDays = (now - itemDate) / (1000 * 3600 * 24);
          matchesDate = diffDays <= 7;
        } else if (dateRangeFilter === "month") {
          const itemDate = new Date(e.date);
          matchesDate = itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
        }

        const matchesQuery =
          searchQuery.trim() === "" ||
          e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (e.notes && e.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (e.payment_method && e.payment_method.toLowerCase().includes(searchQuery.toLowerCase()));

        return matchesCategory && matchesType && matchesDate && matchesQuery;
      })
      .sort((a, b) => {
        if (sortBy === "newest") return new Date(b.date) - new Date(a.date);
        if (sortBy === "oldest") return new Date(a.date) - new Date(b.date);
        if (sortBy === "highest") return b.amount - a.amount;
        if (sortBy === "lowest") return a.amount - b.amount;
        if (sortBy === "name") return a.name.localeCompare(b.name);
        return 0;
      });
  }, [expenses, selectedCategory, selectedType, dateRangeFilter, searchQuery, sortBy]);

  // Open Add Modal
  const handleOpenAddExpense = () => {
    setEditingExpense(null);
    setExpenseForm({
      name: "",
      amount: "",
      category: "Food & Dining",
      date: new Date().toISOString().split("T")[0],
      notes: "",
      type: "expense",
      payment_method: "Credit Card",
      is_recurring: false,
    });
    setIsExpenseModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditExpense = (expense) => {
    setEditingExpense(expense);
    setExpenseForm({
      name: expense.name,
      amount: expense.amount.toString(),
      category: expense.category,
      date: expense.date,
      notes: expense.notes || "",
      type: expense.type || "expense",
      payment_method: expense.payment_method || "Credit Card",
      is_recurring: expense.is_recurring || false,
    });
    setIsExpenseModalOpen(true);
  };

  // Save Transaction
  const handleSaveExpense = async (e) => {
    e.preventDefault();
    if (!expenseForm.name.trim()) {
      addToast("Please provide a transaction title", "danger");
      return;
    }
    const parsedAmount = parseFloat(expenseForm.amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      addToast("Amount must be greater than 0", "danger");
      return;
    }

    const payload = {
      name: expenseForm.name.trim(),
      amount: Math.round(parsedAmount * 100) / 100,
      category: expenseForm.category,
      date: expenseForm.date || new Date().toISOString().split("T")[0],
      notes: expenseForm.notes.trim(),
      type: expenseForm.type || "expense",
      payment_method: expenseForm.payment_method || "Credit Card",
      is_recurring: expenseForm.is_recurring,
    };

    if (serverOnline) {
      try {
        if (editingExpense) {
          const res = await fetch(`${API_BASE}/expenses/${editingExpense.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!res.ok) throw new Error("Failed to update transaction");
          const updated = await res.json();
          setExpenses((prev) => prev.map((item) => (item.id === editingExpense.id ? updated : item)));
          addToast(`Updated "${payload.name}" (${curr}${payload.amount.toFixed(2)})`);
        } else {
          const res = await fetch(`${API_BASE}/expenses`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!res.ok) throw new Error("Failed to add transaction");
          const created = await res.json();
          setExpenses((prev) => [created, ...prev]);
          addToast(`Added "${payload.name}" (${curr}${payload.amount.toFixed(2)})`);
        }
        // Refresh analytics
        fetch(`${API_BASE}/analytics`).then((r) => r.ok && r.json().then(setAnalytics));
      } catch (err) {
        addToast(err.message || "Error saving transaction", "danger");
      }
    } else {
      if (editingExpense) {
        const updated = { ...editingExpense, ...payload };
        setExpenses((prev) => prev.map((item) => (item.id === editingExpense.id ? updated : item)));
        addToast(`Updated "${payload.name}" (Local Mode)`);
      } else {
        const newLocal = { id: `loc-${Date.now().toString(36)}`, ...payload };
        setExpenses((prev) => [newLocal, ...prev]);
        addToast(`Added "${payload.name}" (Local Mode)`);
      }
    }
    setIsExpenseModalOpen(false);
  };

  // Delete Transaction
  const handleDeleteExpense = async (id, name) => {
    if (!window.confirm(`Delete transaction "${name}"?`)) return;
    if (serverOnline) {
      try {
        const res = await fetch(`${API_BASE}/expenses/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to delete transaction");
        setExpenses((prev) => prev.filter((item) => item.id !== id));
        addToast(`Deleted "${name}"`);
        fetch(`${API_BASE}/analytics`).then((r) => r.ok && r.json().then(setAnalytics));
      } catch (err) {
        addToast(err.message || "Failed to delete transaction", "danger");
      }
    } else {
      setExpenses((prev) => prev.filter((item) => item.id !== id));
      addToast(`Deleted "${name}" (Local Mode)`);
    }
  };

  // Save Budget Settings
  const handleSaveBudget = async (e) => {
    e.preventDefault();
    const newBudgetVal = parseFloat(budgetForm.total_budget);
    if (isNaN(newBudgetVal) || newBudgetVal <= 0) {
      addToast("Total budget must be a positive number", "danger");
      return;
    }

    const selectedCurr = CURRENCIES.find((c) => c.code === budgetForm.currency) || { symbol: "$" };

    const updatedBudget = {
      ...budget,
      total_budget: newBudgetVal,
      warning_threshold: parseFloat(budgetForm.warning_threshold) || 0.9,
      currency: budgetForm.currency,
      currency_symbol: selectedCurr.symbol,
    };

    if (serverOnline) {
      try {
        const res = await fetch(`${API_BASE}/budget`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedBudget),
        });
        if (!res.ok) throw new Error("Failed to update budget");
        const saved = await res.json();
        setBudget(saved);
        addToast(`Budget set to ${saved.currency_symbol}${saved.total_budget.toFixed(2)}`);
        fetch(`${API_BASE}/analytics`).then((r) => r.ok && r.json().then(setAnalytics));
      } catch (err) {
        addToast(err.message || "Failed to update budget", "danger");
      }
    } else {
      setBudget(updatedBudget);
      addToast(`Budget set to ${selectedCurr.symbol}${newBudgetVal.toFixed(2)} (Local Mode)`);
    }
    setIsBudgetModalOpen(false);
  };

  // Save Category Budgets
  const handleSaveCategoryBudgets = async (e) => {
    e.preventDefault();
    const updatedBudget = {
      ...budget,
      category_budgets: categoryBudgetsForm,
    };

    if (serverOnline) {
      try {
        const res = await fetch(`${API_BASE}/budget`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedBudget),
        });
        if (!res.ok) throw new Error("Failed to update category limits");
        const saved = await res.json();
        setBudget(saved);
        addToast("Category budget targets updated!");
      } catch (err) {
        addToast(err.message || "Failed to update category limits", "danger");
      }
    } else {
      setBudget(updatedBudget);
      addToast("Category targets updated (Local Mode)!");
    }
    setIsCategoryBudgetModalOpen(false);
  };

  // Seed sample data
  const handleSeedData = async () => {
    if (serverOnline) {
      try {
        const res = await fetch(`${API_BASE}/expenses/seed`, { method: "POST" });
        if (res.ok) {
          loadData();
          addToast("Rich demo expenses reloaded!");
          return;
        }
      } catch {
        // fallback
      }
    }
    loadData();
    addToast("Sample demo data refreshed!");
  };

  // Clear all
  const handleClearAll = async () => {
    if (!window.confirm("Clear all recorded transactions?")) return;
    if (serverOnline) {
      try {
        await fetch(`${API_BASE}/expenses/clear`, { method: "POST" });
      } catch {
        // ignore
      }
    }
    setExpenses([]);
    addToast("All transactions cleared", "warning");
  };

  // Export CSV
  const handleExportCSV = () => {
    if (expenses.length === 0) {
      addToast("No transactions to export", "warning");
      return;
    }
    const headers = ["ID", "Type", "Name", "Amount", "Currency", "Category", "Payment Method", "Recurring", "Date", "Notes"];
    const rows = expenses.map((e) => [
      e.id,
      e.type || "expense",
      `"${e.name.replace(/"/g, '""')}"`,
      e.amount,
      curr,
      `"${e.category}"`,
      `"${e.payment_method || "Credit Card"}"`,
      e.is_recurring ? "Yes" : "No",
      e.date,
      `"${(e.notes || "").replace(/"/g, '""')}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `financial_report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast("CSV Report downloaded successfully!");
  };

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <header className="glass-panel header-bar">
        <div className="logo-container">
          <div className="logo-icon-wrapper">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
              <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
              <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
            </svg>
          </div>
          <div className="brand-text">
            <h1>Expense Tracker & Budget Alerts</h1>
            <p>Smart Financial Management & Real-Time Spending Insights</p>
          </div>
        </div>

        <div className="header-actions">
          {/* Status Badge */}
          <div className="status-pill">
            <span className={`status-dot ${serverOnline ? "" : "standalone"}`}></span>
            <span>{serverOnline ? "FastAPI Live :8000" : "Local Mode"}</span>
          </div>

          {/* Sound Mute Toggle */}
          <button
            className="btn btn-secondary btn-icon"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? "Mute Chimes" : "Enable Chimes"}
          >
            {soundEnabled ? "🔊" : "🔇"}
          </button>

          {/* Theme Selector */}
          <div className="select-box" style={{ minWidth: "110px" }}>
            <select value={theme} onChange={(e) => handleThemeChange(e.target.value)} title="Select Color Theme">
              <option value="default">Indigo Glow</option>
              <option value="emerald">Emerald Vault</option>
              <option value="amber">Sunset Amber</option>
              <option value="violet">Cyber Violet</option>
            </select>
          </div>

          {/* Export Report */}
          <button className="btn btn-secondary btn-sm" onClick={handleExportCSV} title="Export CSV Report">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export
          </button>

          {/* Demo Data Seed */}
          <button className="btn btn-secondary btn-sm" onClick={handleSeedData} title="Reload Demo Data">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" />
              <polyline points="23 20 23 14 17 14" />
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
            </svg>
            Demo Data
          </button>

          {/* Add Transaction Button */}
          <button className="btn btn-primary" onClick={handleOpenAddExpense}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="16" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
            Add Transaction
          </button>
        </div>
      </header>

      {/* Dynamic Budget Alert Banner */}
      <section className={`alert-banner ${alertStatus.level}`}>
        <div className="alert-content">
          <div className="alert-icon-wrap">
            {alertStatus.level === "ok" ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            )}
          </div>
          <div className="alert-text">
            <h4>{alertStatus.title}</h4>
            <p>{alertStatus.message}</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setIsCategoryBudgetModalOpen(true)}>
            Category Limits
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setIsBudgetModalOpen(true)}>
            Adjust Budget
          </button>
        </div>
      </section>

      {/* Smart AI Financial Advisor Insights Banner */}
      {analytics.insights && analytics.insights.length > 0 && (
        <div className="ai-insights-strip">
          <div className="ai-avatar">🤖</div>
          <div className="ai-carousel">
            <strong>Smart Financial Advisor:</strong> {analytics.insights[0]}
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setAnalytics((prev) => ({
                ...prev,
                insights: [...prev.insights.slice(1), prev.insights[0]],
              }));
            }}
          >
            Next Tip ➔
          </button>
        </div>
      )}

      {/* Key Metric Cards Grid */}
      <section className="metrics-grid">
        {/* Total Monthly Budget */}
        <div className="glass-panel metric-card budget">
          <div className="metric-header">
            <span className="metric-label">Monthly Budget</span>
            <div className="metric-icon-box">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
            </div>
          </div>
          <div className="metric-value">
            {curr}{budget.total_budget.toFixed(2)}
          </div>
          <div className="metric-footer">
            <span>Alert threshold: {(budget.warning_threshold * 100).toFixed(0)}%</span>
            <button className="btn btn-secondary btn-sm" style={{ padding: "3px 8px" }} onClick={() => setIsBudgetModalOpen(true)}>
              Edit
            </button>
          </div>
        </div>

        {/* Total Expenses */}
        <div className="glass-panel metric-card spent">
          <div className="metric-header">
            <span className="metric-label">Total Spent</span>
            <div className="metric-icon-box">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
                <polyline points="17 18 23 18 23 12" />
              </svg>
            </div>
          </div>
          <div className="metric-value" style={{ color: percentUsed >= 90 ? "#f87171" : "#f1f5f9" }}>
            {curr}{totalSpent.toFixed(2)}
          </div>
          <div className="progress-container">
            <div
              className={`progress-bar-fill ${percentUsed > 100 ? "danger" : percentUsed >= 90 ? "warning" : "normal"}`}
              style={{ width: `${Math.min(percentUsed, 100)}%` }}
            ></div>
          </div>
          <div className="metric-footer">
            <span>{percentUsed}% of budget</span>
            <span>{expenseItems.length} expenses</span>
          </div>
        </div>

        {/* Remaining Balance */}
        <div className={`glass-panel metric-card remaining ${remainingBudget >= 0 ? "ok" : "danger"}`}>
          <div className="metric-header">
            <span className="metric-label">Remaining Balance</span>
            <div className="metric-icon-box">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
          </div>
          <div className="metric-value" style={{ color: remainingBudget < 0 ? "#ef4444" : "#10b981" }}>
            {remainingBudget < 0 ? `-${curr}${Math.abs(remainingBudget).toFixed(2)}` : `${curr}${remainingBudget.toFixed(2)}`}
          </div>
          <div className="metric-footer">
            <span>{remainingBudget >= 0 ? "Under limit" : "Over limit"}</span>
            <span>{remainingBudget >= 0 ? `${(100 - percentUsed).toFixed(1)}% safe` : "Deficit"}</span>
          </div>
        </div>

        {/* Financial Health Score */}
        <div className="glass-panel metric-card health">
          <div className="metric-header">
            <span className="metric-label">Financial Health</span>
            <div className="metric-icon-box" style={{ background: "rgba(168, 85, 247, 0.15)", color: "#c084fc" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
          </div>
          <div className="metric-value" style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
            <span>{analytics.health_score}</span>
            <span style={{ fontSize: "1rem", color: "var(--text-muted)" }}>/100</span>
            <span
              style={{
                fontSize: "0.85rem",
                padding: "2px 8px",
                borderRadius: "6px",
                background: analytics.health_score >= 80 ? "rgba(16, 185, 129, 0.2)" : "rgba(245, 158, 11, 0.2)",
                color: analytics.health_score >= 80 ? "#34d399" : "#fbbf24",
                fontWeight: "700",
              }}
            >
              Grade {analytics.grade}
            </span>
          </div>
          <div className="metric-footer">
            <span>{analytics.grade_description}</span>
          </div>
        </div>

        {/* Burn Rate & Runway */}
        <div className="glass-panel metric-card income">
          <div className="metric-header">
            <span className="metric-label">Daily Burn Rate</span>
            <div className="metric-icon-box" style={{ background: "rgba(6, 182, 212, 0.15)", color: "#22d3ee" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
          </div>
          <div className="metric-value">
            {curr}{analytics.burn_rate ? analytics.burn_rate.toFixed(2) : "0.00"}
            <span style={{ fontSize: "0.9rem", color: "var(--text-muted)", fontWeight: "normal" }}>/day</span>
          </div>
          <div className="metric-footer">
            <span>Runway: ~{analytics.runway_days ? Math.round(analytics.runway_days) : 30} days left</span>
          </div>
        </div>
      </section>

      {/* Main Dashboard Grid */}
      <div className="dashboard-grid">
        {/* Left Column: Visual Analytics & Breakdown */}
        <section className="glass-panel" style={{ padding: "24px" }}>
          <div className="section-title">
            <h3>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
                <path d="M22 12A10 10 0 0 0 12 2v10z" />
              </svg>
              Spending Analytics
            </h3>

            {/* Tab Switcher */}
            <div className="tab-switcher">
              <button
                className={`tab-btn ${activeChartTab === "donut" ? "active" : ""}`}
                onClick={() => setActiveChartTab("donut")}
              >
                Donut
              </button>
              <button
                className={`tab-btn ${activeChartTab === "trends" ? "active" : ""}`}
                onClick={() => setActiveChartTab("trends")}
              >
                14D Trend
              </button>
              <button
                className={`tab-btn ${activeChartTab === "comparison" ? "active" : ""}`}
                onClick={() => setActiveChartTab("comparison")}
              >
                Limits
              </button>
            </div>
          </div>

          {/* TAB 1: SVG Donut Chart */}
          {activeChartTab === "donut" && (
            <div>
              {categoryTotals.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: "14px 0 20px" }}>
                  <div style={{ position: "relative", width: "190px", height: "190px" }}>
                    <svg viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)", width: "100%", height: "100%" }}>
                      <circle cx="50" cy="50" r="38" fill="transparent" stroke="rgba(255,255,255,0.06)" strokeWidth="16" />
                      {(() => {
                        let accumulatedPercent = 0;
                        return categoryTotals.map((cat, idx) => {
                          const share = totalSpent > 0 ? cat.total / totalSpent : 0;
                          const strokeDasharray = `${share * 238.76} 238.76`;
                          const strokeDashoffset = -accumulatedPercent * 238.76;
                          accumulatedPercent += share;
                          return (
                            <circle
                              key={idx}
                              cx="50"
                              cy="50"
                              r="38"
                              fill="transparent"
                              stroke={cat.color}
                              strokeWidth="16"
                              strokeDasharray={strokeDasharray}
                              strokeDashoffset={strokeDashoffset}
                              style={{ transition: "stroke-dashoffset 0.6s ease" }}
                            />
                          );
                        });
                      })()}
                    </svg>
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        textAlign: "center",
                      }}
                    >
                      <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Total Spent</span>
                      <span style={{ fontFamily: "var(--font-heading)", fontSize: "1.3rem", fontWeight: "700" }}>
                        {curr}{totalSpent.toFixed(0)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Category Breakdown Progress Bars */}
              <div className="category-bars-list">
                {categoryTotals.map((cat, idx) => (
                  <div key={idx} className="category-bar-item">
                    <div className="category-bar-info">
                      <span className="category-name-badge">
                        <span className="cat-indicator" style={{ backgroundColor: cat.color }}></span>
                        {cat.icon} {cat.category}
                      </span>
                      <span className="category-amount-badge">
                        {curr}{cat.total.toFixed(2)}
                        {cat.catBudget > 0 && (
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: "normal", marginLeft: "6px" }}>
                            / {curr}{cat.catBudget}
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="progress-container" style={{ margin: "4px 0" }}>
                      <div
                        className={`progress-bar-fill ${cat.isOver ? "danger" : cat.catPercent >= 90 ? "warning" : "normal"}`}
                        style={{
                          width: `${Math.min(cat.catBudget > 0 ? cat.catPercent : cat.percentOfBudget, 100)}%`,
                          backgroundColor: cat.color,
                        }}
                      ></div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--text-dim)" }}>
                      <span>{cat.percentOfBudget}% of total budget</span>
                      {cat.catBudget > 0 && (
                        <span style={{ color: cat.isOver ? "#f87171" : "inherit" }}>
                          {cat.isOver ? `Over by ${curr}${(cat.total - cat.catBudget).toFixed(2)}` : `${cat.catPercent}% of category limit`}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: Daily 14-Day Spending Trend Bar Chart */}
          {activeChartTab === "trends" && (
            <div>
              <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "8px" }}>
                Daily spending activity over the past 14 days:
              </p>
              <div className="trend-chart-container">
                {analytics.daily_series && analytics.daily_series.length > 0 ? (
                  (() => {
                    const maxDaily = Math.max(...analytics.daily_series.map((d) => d.amount), 1);
                    return analytics.daily_series.map((day, idx) => {
                      const heightPct = Math.max(Math.round((day.amount / maxDaily) * 100), 4);
                      const dayLabel = day.date.slice(5); // MM-DD
                      return (
                        <div key={idx} className="trend-bar-column">
                          <div className="trend-tooltip">
                            {day.date}: {curr}{day.amount.toFixed(2)}
                          </div>
                          <div
                            className="trend-bar-fill"
                            style={{
                              height: `${heightPct}%`,
                              background: day.amount > 100 ? "linear-gradient(180deg, #ef4444, #f59e0b)" : undefined,
                            }}
                          ></div>
                          <span className="trend-bar-date">{dayLabel}</span>
                        </div>
                      );
                    });
                  })()
                ) : (
                  <p style={{ margin: "auto", color: "var(--text-dim)" }}>No trend data recorded yet</p>
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "14px", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                <span>Average: {curr}{analytics.burn_rate ? analytics.burn_rate.toFixed(2) : "0.00"}/day</span>
                <span>Peak Days Highlighted</span>
              </div>
            </div>
          )}

          {/* TAB 3: Category Budget Limits vs Actual */}
          {activeChartTab === "comparison" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>Allocated vs Spent</span>
                <button className="btn btn-secondary btn-sm" onClick={() => setIsCategoryBudgetModalOpen(true)}>
                  Configure Targets
                </button>
              </div>

              <div className="category-bars-list">
                {CATEGORIES.map((c, idx) => {
                  const spent = expenseItems.filter((e) => e.category === c.name).reduce((sum, e) => sum + e.amount, 0);
                  const limit = (budget.category_budgets && budget.category_budgets[c.name]) || 0;
                  const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
                  const isOver = limit > 0 && spent > limit;

                  return (
                    <div key={idx} className="category-bar-item">
                      <div className="category-bar-info">
                        <span className="category-name-badge">
                          {c.icon} {c.name}
                        </span>
                        <span className="category-amount-badge" style={{ color: isOver ? "#f87171" : "inherit" }}>
                          {curr}{spent.toFixed(2)} / {curr}{limit.toFixed(2)}
                        </span>
                      </div>
                      <div className="progress-container">
                        <div
                          className={`progress-bar-fill ${isOver ? "danger" : pct >= 90 ? "warning" : "normal"}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        ></div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--text-dim)" }}>
                        <span>Target: {curr}{limit}</span>
                        <span style={{ color: isOver ? "#f87171" : "inherit", fontWeight: isOver ? "600" : "normal" }}>
                          {isOver ? `⚠️ Over by ${curr}${(spent - limit).toFixed(2)}` : `${pct}% consumed`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* Right Column: Transactions Explorer */}
        <section className="glass-panel" style={{ padding: "24px" }}>
          <div className="section-title">
            <h3>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
              Financial Transactions
            </h3>

            <div style={{ display: "flex", gap: "8px" }}>
              {/* Type Switcher */}
              <div className="tab-switcher">
                <button
                  className={`tab-btn ${selectedType === "all" ? "active" : ""}`}
                  onClick={() => setSelectedType("all")}
                >
                  All ({expenses.length})
                </button>
                <button
                  className={`tab-btn ${selectedType === "expense" ? "active" : ""}`}
                  onClick={() => setSelectedType("expense")}
                >
                  Expenses ({expenseItems.length})
                </button>
                <button
                  className={`tab-btn ${selectedType === "income" ? "active" : ""}`}
                  onClick={() => setSelectedType("income")}
                >
                  Income ({incomeItems.length})
                </button>
              </div>

              {expenses.length > 0 && (
                <button className="btn btn-danger btn-sm" onClick={handleClearAll} title="Clear All">
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="category-pill-filter">
            <button
              className={`filter-pill ${selectedCategory === "All" ? "active" : ""}`}
              onClick={() => setSelectedCategory("All")}
            >
              All Categories
            </button>
            {CATEGORIES.map((cat) => {
              const count = expenses.filter((e) => e.category === cat.name).length;
              return (
                <button
                  key={cat.name}
                  className={`filter-pill ${selectedCategory === cat.name ? "active" : ""}`}
                  onClick={() => setSelectedCategory(cat.name)}
                >
                  {cat.icon} {cat.name} {count > 0 ? `(${count})` : ""}
                </button>
              );
            })}
          </div>

          {/* Search, Date Range & Sort Toolbar */}
          <div className="toolbar-row">
            <div className="search-box">
              <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search by title, notes, or payment method..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="select-box">
              <select value={dateRangeFilter} onChange={(e) => setDateRangeFilter(e.target.value)} title="Filter Date Range">
                <option value="all">All Dates</option>
                <option value="today">Today</option>
                <option value="week">Past 7 Days</option>
                <option value="month">This Month</option>
              </select>
            </div>

            <div className="select-box">
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="highest">Highest Amount</option>
                <option value="lowest">Lowest Amount</option>
                <option value="name">Title (A-Z)</option>
              </select>
            </div>
          </div>

          {/* Transactions List */}
          <div className="expense-items-container">
            {filteredTransactions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">💸</div>
                <h4>No transactions match your criteria</h4>
                <p style={{ fontSize: "0.85rem", marginTop: "4px" }}>
                  Try resetting filters or click below to record a new transaction.
                </p>
                <button className="btn btn-primary btn-sm" style={{ marginTop: "16px" }} onClick={handleOpenAddExpense}>
                  Add Transaction
                </button>
              </div>
            ) : (
              filteredTransactions.map((item) => {
                const catObj = CATEGORIES.find((c) => c.name === item.category) || {
                  icon: "🏷️",
                  color: "#818cf8",
                  bg: "rgba(129, 140, 248, 0.15)",
                };
                const payObj = PAYMENT_METHODS.find((p) => p.name === item.payment_method) || { icon: "💳" };
                const isIncome = item.type === "income";

                return (
                  <div key={item.id} className="expense-row-card">
                    <div className="expense-left">
                      <div className="cat-avatar" style={{ backgroundColor: catObj.bg, color: catObj.color }}>
                        {isIncome ? "💰" : catObj.icon}
                      </div>
                      <div className="expense-meta">
                        <h5>{item.name}</h5>
                        <div className="expense-submeta">
                          <span className={`tag-badge ${isIncome ? "income" : ""}`}>
                            {isIncome ? "Income" : item.category}
                          </span>
                          <span className="tag-badge">
                            {payObj.icon} {item.payment_method || "Card"}
                          </span>
                          {item.is_recurring && <span className="tag-badge recurring">🔄 Recurring</span>}
                          <span>{item.date}</span>
                          {item.notes && <span style={{ fontStyle: "italic", color: "var(--text-dim)" }}>• {item.notes}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="expense-right">
                      <div className={`expense-price ${isIncome ? "income-val" : ""}`}>
                        {isIncome ? "+" : "-"}{curr}{item.amount.toFixed(2)}
                      </div>
                      <div className="expense-actions">
                        <button className="btn btn-secondary btn-icon" onClick={() => handleOpenEditExpense(item)} title="Edit">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button className="btn btn-danger btn-icon" onClick={() => handleDeleteExpense(item.id, item.name)} title="Delete">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* Add / Edit Transaction Modal Dialog */}
      {isExpenseModalOpen && (
        <div className="modal-overlay" onClick={() => setIsExpenseModalOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingExpense ? "Edit Transaction" : "Record New Transaction"}</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setIsExpenseModalOpen(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveExpense}>
              <div className="modal-body">
                {/* Type Selector (Expense vs Income) */}
                <div className="form-group">
                  <label>Transaction Type</label>
                  <div className="tab-switcher" style={{ width: "100%" }}>
                    <button
                      type="button"
                      style={{ flex: 1 }}
                      className={`tab-btn ${expenseForm.type === "expense" ? "active" : ""}`}
                      onClick={() => setExpenseForm({ ...expenseForm, type: "expense" })}
                    >
                      💸 Expense
                    </button>
                    <button
                      type="button"
                      style={{ flex: 1 }}
                      className={`tab-btn ${expenseForm.type === "income" ? "active" : ""}`}
                      onClick={() => setExpenseForm({ ...expenseForm, type: "income" })}
                    >
                      💰 Income
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label>Title / Description</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Trader Joe's, Electricity Bill, Freelance Payout"
                    className="form-input"
                    value={expenseForm.name}
                    onChange={(e) => setExpenseForm({ ...expenseForm, name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Amount ({curr})</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    className="form-input"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Category</label>
                  <select
                    className="form-select"
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.icon} {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Payment Method</label>
                  <select
                    className="form-select"
                    value={expenseForm.payment_method}
                    onChange={(e) => setExpenseForm({ ...expenseForm, payment_method: e.target.value })}
                  >
                    {PAYMENT_METHODS.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.icon} {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={expenseForm.date}
                    onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "4px 0" }}>
                  <input
                    type="checkbox"
                    id="is_recurring_chk"
                    checked={expenseForm.is_recurring}
                    onChange={(e) => setExpenseForm({ ...expenseForm, is_recurring: e.target.checked })}
                    style={{ width: "16px", height: "16px", accentColor: "var(--primary)" }}
                  />
                  <label htmlFor="is_recurring_chk" style={{ fontSize: "0.85rem", color: "var(--text-main)", cursor: "pointer" }}>
                    🔄 This is a recurring subscription / bill
                  </label>
                </div>

                <div className="form-group">
                  <label>Notes (Optional)</label>
                  <textarea
                    rows="2"
                    placeholder="Reference number, purpose, or location..."
                    className="form-textarea"
                    value={expenseForm.notes}
                    onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                  ></textarea>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsExpenseModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingExpense ? "Update Transaction" : "Save Transaction"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Overall Budget & Currency Modal Dialog */}
      {isBudgetModalOpen && (
        <div className="modal-overlay" onClick={() => setIsBudgetModalOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Monthly Budget & Thresholds</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setIsBudgetModalOpen(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveBudget}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Currency</label>
                  <select
                    className="form-select"
                    value={budgetForm.currency}
                    onChange={(e) => setBudgetForm({ ...budgetForm, currency: e.target.value })}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Total Monthly Budget Limit ({curr})</label>
                  <input
                    type="number"
                    step="10"
                    min="10"
                    required
                    className="form-input"
                    value={budgetForm.total_budget}
                    onChange={(e) => setBudgetForm({ ...budgetForm, total_budget: e.target.value })}
                  />
                  <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                    Current spent: {curr}{totalSpent.toFixed(2)} ({percentUsed}% of budget)
                  </span>
                </div>

                <div className="form-group">
                  <label>Alert Trigger Threshold ({Math.round(budgetForm.warning_threshold * 100)}%)</label>
                  <input
                    type="range"
                    min="0.5"
                    max="0.95"
                    step="0.05"
                    value={budgetForm.warning_threshold}
                    onChange={(e) => setBudgetForm({ ...budgetForm, warning_threshold: parseFloat(e.target.value) })}
                    style={{ width: "100%", accentColor: "var(--primary)" }}
                  />
                  <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                    The high-priority alert banner triggers when spending reaches {Math.round(budgetForm.warning_threshold * 100)}% of limit.
                  </span>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsBudgetModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Budgets Configuration Modal */}
      {isCategoryBudgetModalOpen && (
        <div className="modal-overlay" onClick={() => setIsCategoryBudgetModalOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Category Budget Allocations</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setIsCategoryBudgetModalOpen(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveCategoryBudgets}>
              <div className="modal-body">
                <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                  Set specific monthly spending targets for each category:
                </p>
                {CATEGORIES.map((cat) => (
                  <div key={cat.name} className="form-group">
                    <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {cat.icon} {cat.name} ({curr})
                    </label>
                    <input
                      type="number"
                      step="5"
                      min="0"
                      className="form-input"
                      value={categoryBudgetsForm[cat.name] || ""}
                      placeholder="0.00"
                      onChange={(e) =>
                        setCategoryBudgetsForm({
                          ...categoryBudgetsForm,
                          [cat.name]: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                ))}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsCategoryBudgetModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Category Targets
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Toast Notification Stack */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            {toast.type === "success" && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            )}
            {toast.type === "warning" && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            )}
            {toast.type === "danger" && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            )}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
