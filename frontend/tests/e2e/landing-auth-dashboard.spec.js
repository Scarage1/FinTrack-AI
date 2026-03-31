import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function openDashboard(page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Go to Dashboard|Start Tracking Free|View Live Demo/i }).first().click();
  await expect(page.getByText("Welcome back", { exact: false })).toBeVisible({ timeout: 20000 });
}

async function ensureDashboard(page) {
  const goButton = page.getByRole("button", { name: /Go to Dashboard|Start Tracking Free|View Live Demo/i }).first();
  if (await goButton.isVisible().catch(() => false)) {
    await goButton.click();
  }
  await expect(page.getByText("Welcome back", { exact: false })).toBeVisible({ timeout: 20000 });
}

async function getToken(page) {
  return page.evaluate(() => localStorage.getItem("expense_token"));
}

test("landing -> dashboard -> add expense", async ({ page }) => {
  const unique = Date.now();
  const expenseText = `E2E coffee ${unique}`;

  await openDashboard(page);

  await page.getByPlaceholder("Amount").first().fill("321");
  await page.getByPlaceholder("Description (e.g. Swiggy dinner)").first().fill(expenseText);
  await page.getByRole("button", { name: "Add Expense" }).click();

  await expect(page.getByText(expenseText)).toBeVisible();
});

test("landing -> dashboard smoke", async ({ page }) => {
  await openDashboard(page);
  await expect(page.getByText("Welcome back")).toBeVisible();
  await expect(page.getByText("Recent Expenses")).toBeVisible();
});

test("dashboard -> export expenses csv", async ({ page }) => {
  await openDashboard(page);
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
  await openDashboard(page);
  await expect(page.getByText("Welcome back")).toBeVisible();
  await expect(page.getByText("Recent Expenses")).toBeVisible();
});

test("invalid token auto-recovers session", async ({ page }) => {
  await openDashboard(page);
  await expect(page.getByText("Welcome back")).toBeVisible();

  await page.evaluate(() => {
    localStorage.setItem("expense_token", "invalid-token");
  });

  await page.reload();
  await ensureDashboard(page);
});

test("accessibility smoke landing and dashboard", async ({ page }) => {
  await page.goto("/");

  const landingResults = await new AxeBuilder({ page }).analyze();
  expect(landingResults.violations).toEqual([]);

  await page.getByRole("button", { name: /Go to Dashboard|Start Tracking Free|View Live Demo/i }).first().click();
  await expect(page.getByText("Welcome back")).toBeVisible();

  const dashboardResults = await new AxeBuilder({ page }).analyze();
  expect(dashboardResults.violations).toEqual([]);
});

test("dashboard search and pagination interactions", async ({ page, request }) => {
  const unique = Date.now();
  await openDashboard(page);

  await expect(page.getByText("Recent Expenses")).toBeVisible();

  const token = await getToken(page);
  expect(token).toBeTruthy();
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
  await ensureDashboard(page);
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
