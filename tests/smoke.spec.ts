import { expect, test } from '@playwright/test'

const routes = ['/', '/learn', '/profile', '/progress', '/pwn', '/settings', '/chakma', '/onboarding', '/login']

test('student routes render without crashing', async ({ page }) => {
  for (const route of routes) {
    await page.goto(`http://localhost:3000${route}`)
    await expect(page.locator('body')).toBeVisible()
  }
})

test('learn page answers different questions and opens navigation', async ({ page }) => {
  await page.goto('http://localhost:3000/learn')

  await page.getByLabel('Open menu').click()
  await expect(page.getByText('Peer Wisdom')).toBeVisible()
  await page.getByLabel('Close menu').click()

  const input = page.getByPlaceholder('বাংলায় প্রশ্ন লেখো... Enter চাপলে পাঠাবে')

  await input.fill('Newton-er 2nd law bujhi na')
  await page.getByLabel('Send question').click()
  await expect(page.getByText(/F = ma|নিউটন|বল/)).toBeVisible({ timeout: 15000 })

  await input.fill('photosynthesis ki bhabe hoy')
  await page.getByLabel('Send question').click()
  await expect(page.locator('p').filter({ hasText: /সালোক|উদ্ভিদ|glucose|গ্লুকোজ/i }).first()).toBeVisible({ timeout: 15000 })
})

test('settings toggles and pwn filters are clickable', async ({ page }) => {
  await page.goto('http://localhost:3000/settings')
  await page.getByText('Voice output').click()
  await page.getByText('Dark mode').click()
  await expect(page.getByText('Local app preferences')).toBeVisible()

  await page.goto('http://localhost:3000/pwn')
  await page.getByRole('button', { name: 'physics' }).click()
  await expect(page.getByText('Newton second law')).toBeVisible()
})

test('onboarding stores a profile and profile page reads it', async ({ page }) => {
  await page.goto('http://localhost:3000/onboarding')
  for (let i = 0; i < 5; i += 1) {
    await page.locator('button').filter({ has: page.locator('div.font-semibold') }).first().click()
    await page.getByRole('button').filter({ hasText: /পরের প্রশ্ন|শুরু করো/ }).click()
  }
  await page.waitForURL('**/learn')
  await page.goto('http://localhost:3000/profile')
  await expect(page.getByText('Visual Answer Engine').or(page.getByText('English + Career Track')).first()).toBeVisible()
})
