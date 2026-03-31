const now = new Date();
const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

export const db = {
  users: [],
  expenses: [
    {
      id: 1,
      userId: 1,
      amount: 280,
      category: "Food",
      description: "Swiggy lunch",
      paymentMethod: "UPI",
      timestamp: `${currentMonth}-03T12:10:00.000Z`
    },
    {
      id: 2,
      userId: 1,
      amount: 420,
      category: "Travel",
      description: "Uber office commute",
      paymentMethod: "Card",
      timestamp: `${currentMonth}-06T09:00:00.000Z`
    },
    {
      id: 3,
      userId: 1,
      amount: 1600,
      category: "Bills",
      description: "Electricity bill",
      paymentMethod: "NetBanking",
      timestamp: `${currentMonth}-08T05:30:00.000Z`
    },
    {
      id: 4,
      userId: 1,
      amount: 699,
      category: "Shopping",
      description: "Amazon household items",
      paymentMethod: "Card",
      timestamp: `${currentMonth}-11T18:45:00.000Z`
    }
  ],
  budgets: [
    { id: 1, userId: 1, category: "Food", limit: 4000 },
    { id: 2, userId: 1, category: "Travel", limit: 3000 },
    { id: 3, userId: 1, category: "Bills", limit: 5000 }
  ]
};

let expenseId = db.expenses.length + 1;
let budgetId = db.budgets.length + 1;
let userId = 1;

export function nextExpenseId() {
  return expenseId++;
}

export function nextBudgetId() {
  return budgetId++;
}

export function nextUserId() {
  return userId++;
}
