import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("landing -> register -> dashboard -> add expense", async ({ page }) => {
  const unique = Date.now();
  const email = `pw_${unique}@example.com`;
  const password = "password123";
  const expenseText = `E2E coffee ${unique}`;

  await page.goto("/");

  await expect(page.getByText("FinTrack AI")).toBeVisible();
  await page.getByRole("button", { name: "Create Account" }).click();

  await expect(page.getByText("Expense Tracker + ML")).toBeVisible();
  await page.getByPlaceholder("Name").fill("Playwright User");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Register" }).click();

  await expect(page.getByText("Welcome back")).toBeVisible();

  await page.getByPlaceholder("Amount").first().fill("321");
  await page.getByPlaceholder("Description (e.g. Swiggy dinner)").first().fill(expenseText);
  await page.getByRole("button", { name: "Add Expense" }).click();

  await expect(page.getByText(expenseText)).toBeVisible();
});

test("landing -> login with seeded user", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Login to Dashboard" }).click();

  await page.getByPlaceholder("Email").fill("demo@expense.app");
  await page.getByPlaceholder("Password").fill("password123");
  await page.getByRole("button", { name: "Login" }).click();

  await expect(page.getByText("Welcome back")).toBeVisible();
  await expect(page.getByText("Recent Expenses")).toBeVisible();
});

test("dashboard -> export expenses csv", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Login to Dashboard" }).click();

  await page.getByPlaceholder("Email").fill("demo@expense.app");
  await page.getByPlaceholder("Password").fill("password123");
  await page.getByRole("button", { name: "Login" }).click();

  await expect(page.getByText("Recent Expenses")).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export CSV" }).click()
  ]);

  expect(download.suggestedFilename()).toContain("expenses-");
  expect(download.suggestedFilename()).toContain(".csv");
});

test("responsive smoke on mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Login to Dashboard" }).click();

  await page.getByPlaceholder("Email").fill("demo@expense.app");
  await page.getByPlaceholder("Password").fill("password123");
  await page.getByRole("button", { name: "Login" }).click();

  await expect(page.getByText("Welcome back")).toBeVisible();
  await expect(page.getByText("Recent Expenses")).toBeVisible();
});

test("invalid token triggers auto logout to landing", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Login to Dashboard" }).click();

  await page.getByPlaceholder("Email").fill("demo@expense.app");
  await page.getByPlaceholder("Password").fill("password123");
  await page.getByRole("button", { name: "Login" }).click();

  await expect(page.getByText("Welcome back")).toBeVisible();

  await page.evaluate(() => {
    localStorage.setItem("expense_token", "invalid-token");
  });

  await page.reload();
  await expect(page.getByRole("button", { name: "Login to Dashboard" })).toBeVisible();
});

test("accessibility smoke landing and dashboard", async ({ page }) => {
  await page.goto("/");

  const landingResults = await new AxeBuilder({ page }).analyze();
  expect(landingResults.violations).toEqual([]);

  await page.getByRole("button", { name: "Login to Dashboard" }).click();
  await page.getByPlaceholder("Email").fill("demo@expense.app");
  await page.getByPlaceholder("Password").fill("password123");
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page.getByText("Welcome back")).toBeVisible();

  const dashboardResults = await new AxeBuilder({ page }).analyze();
  expect(dashboardResults.violations).toEqual([]);
});

test("dashboard search and pagination interactions", async ({ page, request }) => {
  const unique = Date.now();
  const email = `pw_filters_${unique}@example.com`;
  const password = "password123";

  await page.goto("/");
  await page.getByRole("button", { name: "Create Account" }).click();

  await page.getByPlaceholder("Name").fill("Playwright Filters User");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Register" }).click();

  await expect(page.getByText("Recent Expenses")).toBeVisible();

  const token = await page.evaluate(() => localStorage.getItem("expense_token"));
  for (let i = 0; i < 10; i += 1) {
    const res = await request.post("http://localhost:4000/api/expenses", {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      data: {
        amount: 100 + i,
        description: `Filter item ${i} ${unique}`,
        paymentMethod: "UPI"
      }
    });
    expect(res.ok()).toBeTruthy();
  }

  await page.reload();
  await expect(page.getByText("Recent Expenses")).toBeVisible();

  const pager = page.locator(".pager");
  await expect(pager).toContainText("Page 1 of 2");

  await page.getByLabel("Search expenses").fill(`Filter item 9 ${unique}`);
  await expect(page.getByText(`Filter item 9 ${unique}`)).toBeVisible();
  await expect(pager).toContainText("Page 1 of 1");

  await page.getByLabel("Search expenses").fill("");
  await expect(pager).toContainText("Page 1 of 2");

  await page.getByRole("button", { name: "Next" }).click();
  await expect(pager).toContainText("Page 2 of 2");
});
