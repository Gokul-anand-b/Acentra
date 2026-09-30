import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const fixture = JSON.parse(
  readFileSync(new URL("../../.runtime/e2e.json", import.meta.url), "utf8"),
);
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Email address").fill(fixture.email);
  await page.getByLabel("Password", { exact: true }).fill(fixture.password);
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Risk overview" }),
  ).toBeVisible();
});
test("database dashboard, filter, graph, review and clear", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await expect(
    page.getByText("Demo / Synthetic Data", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "../docs/screenshots/overview.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Alert queue", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Search transactions" })
    .fill(fixture.transaction_id);
  await expect(
    page.getByRole("link", { name: fixture.transaction_id, exact: true }),
  ).toBeVisible();
  await page.getByLabel("Risk level").selectOption("LOW");
  await expect(page.getByText("No transactions found")).toBeVisible();
  await page.getByLabel("Risk level").selectOption("CRITICAL");
  await page
    .getByRole("link", { name: fixture.transaction_id, exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Why was this flagged?" }),
  ).toBeVisible();
  await expect(page.getByText("95", { exact: true })).toBeVisible();
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await page.screenshot({
    path: "../docs/screenshots/investigation.png",
    fullPage: true,
  });
  await page
    .getByLabel("Decision reason")
    .fill("Browser test: verified transaction evidence");
  await page
    .getByRole("button", { name: "Mark reviewed", exact: true })
    .click();
  await expect(
    page.getByText("Decision saved to the audit trail."),
  ).toBeVisible();
  await page
    .getByLabel("Decision reason")
    .fill("Browser test: customer verification completed");
  await page
    .getByRole("button", { name: "Clear transaction", exact: true })
    .click();
  await expect(
    page.getByText("A final decision has been recorded."),
  ).toBeVisible();
  await expect(
    page.getByText("Browser test: customer verification completed"),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("rule management, import validation and audit navigation", async ({
  page,
}) => {
  await page.getByRole("link", { name: "Rule engine", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Transaction velocity", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Configure" }).first().click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("link", { name: "Data import", exact: true }).click();
  await page.getByLabel("Transaction file").setInputFiles({
    name: "invalid.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "id,customer_id,merchant_id,amount,timestamp\nbad,B,M,-1,2025-01-01T00:00:00Z\n",
    ),
  });
  await page.getByRole("button", { name: "Import and evaluate" }).click();
  await expect(
    page.getByRole("heading", { name: "Import report" }),
  ).toBeVisible();
  await expect(page.getByText(/Row 1:/)).toBeVisible();
  await page.getByRole("link", { name: "Audit trail", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Audit trail", exact: true }),
  ).toBeVisible();
});
test("responsive workspace has no page overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "Risk overview" }),
  ).toBeVisible();
  await page.screenshot({
    path: "../docs/screenshots/mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("input, trained model, case workspace, notifications and printable report", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/input");
  await page.getByRole("button", { name: "Fill example", exact: true }).click();
  await page.screenshot({
    path: "../docs/screenshots/workbench.png",
    fullPage: true,
  });
  const response = page.waitForResponse(
    (r) =>
      r.url().includes("/api/transactions?") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Evaluate transaction", exact: true })
    .click();
  const record = await (await response).json();
  expect(record.assessment.scoring.ml.available).toBe(true);
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await page.goto("/input");
  await page
    .getByRole("button", { name: "Run flagged demo", exact: true })
    .click();
  await expect(page.getByText("95", { exact: true })).toBeVisible();
  await page
    .getByLabel("Decision reason")
    .fill(
      "Prototype check: suspicious travel and unusual amount require investigation",
    );
  await page
    .getByRole("button", { name: "Escalate to case", exact: true })
    .click();
  await page.getByRole("link", { name: "Open case workspace" }).click();
  await page
    .getByLabel("Investigation note")
    .fill("Reviewed graph relationships and model advisory evidence.");
  await page
    .getByRole("button", { name: "Save case update", exact: true })
    .click();
  await expect(
    page
      .locator(".case-card blockquote")
      .filter({
        hasText: "Reviewed graph relationships and model advisory evidence.",
      }),
  ).toBeVisible();
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await page.screenshot({
    path: "../docs/screenshots/case-workspace.png",
    fullPage: true,
  });
  await page.evaluate(() => {
    window.print = () => {
      document.body.dataset.printRequested = "true";
    };
  });
  await page.getByRole("button", { name: "Print report", exact: true }).click();
  await expect(page.locator("body")).toHaveAttribute(
    "data-print-requested",
    "true",
  );
  await page.pdf({
    path: "../docs/FraudGuard-investigation-report.pdf",
    format: "A4",
    printBackground: true,
  });
  await page.goto("/notifications");
  await expect(page.locator(".notification-card").first()).toBeVisible();
  await page.goto("/model");
  await expect(
    page.getByText("Advisory inference active", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("30,000", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "../docs/screenshots/model.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
