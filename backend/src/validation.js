import { z } from "zod";

const monthRegex = /^\d{4}-\d{2}$/;
const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,128}$/;

const categories = ["Food", "Travel", "Bills", "Shopping", "Entertainment", "Others"];
const paymentMethods = ["UPI", "Card", "Cash", "NetBanking"];

function sendValidationError(res, issues) {
  return res.status(400).json({
    code: "REQUEST_ERROR",
    message: "validation failed",
    details: issues.map((i) => ({ path: i.path.join("."), message: i.message }))
  });
}

function validateWith(schema, selector) {
  return (req, res, next) => {
    const result = schema.safeParse(selector(req));
    if (!result.success) return sendValidationError(res, result.error.issues);
    return next();
  };
}

export const registerBodySchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  email: z.string().trim().email().max(120),
  password: z.string().regex(passwordRegex, "password must be 8+ chars and include letters + numbers")
});

export const loginBodySchema = z.object({
  email: z.string().trim().email().max(120),
  password: z.string().min(1).max(128)
});

export const refreshBodySchema = z.object({
  refreshToken: z.string().min(20).max(300)
});

export const logoutBodySchema = z.object({
  refreshToken: z.string().min(20).max(300)
});

export const createExpenseBodySchema = z.object({
  amount: z.coerce.number().positive(),
  category: z.enum(categories).optional(),
  description: z.string().max(300).optional(),
  paymentMethod: z.enum(paymentMethods).optional(),
  timestamp: z.string().datetime().optional()
});

export const budgetBodySchema = z.object({
  category: z.enum(categories),
  limit: z.coerce.number().positive()
});

export const expenseQuerySchema = z.object({
  month: z.string().regex(monthRegex).optional(),
  category: z.enum(categories).optional().or(z.literal("")),
  search: z.string().max(120).optional(),
  minAmount: z.coerce.number().nonnegative().optional(),
  maxAmount: z.coerce.number().nonnegative().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  sortBy: z.enum(["timestamp", "amount"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional()
});

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const validateRegisterBody = validateWith(registerBodySchema, (req) => req.body);
export const validateLoginBody = validateWith(loginBodySchema, (req) => req.body);
export const validateExpenseBody = validateWith(createExpenseBodySchema, (req) => req.body);
export const validateBudgetBody = validateWith(budgetBodySchema, (req) => req.body);
export const validateExpenseQuery = validateWith(expenseQuerySchema, (req) => req.query);
export const validateIdParam = validateWith(idParamSchema, (req) => req.params);
export const validateRefreshBody = validateWith(refreshBodySchema, (req) => req.body);
export const validateLogoutBody = validateWith(logoutBodySchema, (req) => req.body);
