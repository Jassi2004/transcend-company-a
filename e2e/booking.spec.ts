import { test, expect } from "@playwright/test";
test("a customer can book, search, cancel, and inspect activity", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Good things are on the calendar." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "New reservation" }).click();
  await page.getByRole("button", { name: "09:00" }).click();
  await page.getByLabel("Your name").fill("Browser Test");
  await page.getByLabel("Email address").fill("browser@example.com");
  await page.getByRole("button", { name: "Confirm reservation" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByText("browser@example.com")).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByText("cancelled", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Activity", exact: true }).click();
  await expect(
    page.getByText("booking.cancelled", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.screenshot({
    path: "test-results/company-a-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "New reservation" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/company-a-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});
