import { test, expect } from '@playwright/test'

async function register(page, name) {
  await page.goto('/')
  await page
    .getByRole('button', { name: 'Create an account', exact: true })
    .click()
  await page
    .getByLabel('Your email', { exact: true })
    .fill(`${name}-${Date.now()}@example.com`)
  await page.getByLabel('Password', { exact: true }).fill('test-password-123')
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Your alarms' }),
  ).toBeAttached()
}
async function noOverflow(page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
}
test('prototype views, registration, saved alarm CRUD, challenge, reload, and login', async ({
  page,
}, testInfo) => {
  const browserErrors = []
  page.on('pageerror', (error) => browserErrors.push(error.message))
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'BrainRing', exact: true }),
  ).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  await noOverflow(page)
  await page.screenshot({
    path: testInfo.outputPath('login-mobile.png'),
    fullPage: true,
  })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.screenshot({
    path: testInfo.outputPath('login-desktop.png'),
    fullPage: true,
  })
  await page.setViewportSize({ width: 390, height: 844 })
  const email = `ui-${Date.now()}@example.com`
  await page
    .getByRole('button', { name: 'Create an account', exact: true })
    .click()
  await page.getByLabel('Your email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill('test-password-123')
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click()
  await expect(page.locator('.alarm-card')).toHaveCount(2)
  await page.screenshot({
    path: testInfo.outputPath('alarms-mobile.png'),
    fullPage: true,
  })
  await noOverflow(page)
  await page.getByRole('button', { name: '+ add alarm', exact: true }).click()
  await page.getByLabel('Time', { exact: true }).fill('07:45')
  await page
    .getByLabel('Challenge difficulty', { exact: true })
    .selectOption('easy')
  await page.getByLabel('Label', { exact: false }).fill('school')
  await page.getByRole('button', { name: 'Save alarm', exact: true }).click()
  await expect(page.locator('.alarm-card')).toHaveCount(3)
  await page
    .getByRole('switch', { name: 'Turn off 7:45 AM alarm', exact: true })
    .click()
  await expect(
    page.getByRole('switch', { name: 'Turn on 7:45 AM alarm', exact: true }),
  ).toHaveAttribute('aria-checked', 'false')
  await page.reload()
  await expect(page.locator('.alarm-card')).toHaveCount(3)
  await expect(
    page.getByRole('switch', { name: 'Turn on 7:45 AM alarm', exact: true }),
  ).toHaveAttribute('aria-checked', 'false')
  await page
    .getByRole('button', { name: 'Edit 7:45 AM alarm', exact: true })
    .click()
  await page.getByLabel('Time', { exact: true }).fill('07:50')
  await page.getByRole('button', { name: 'Save alarm', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Edit 7:50 AM alarm', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Edit 7:50 AM alarm', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'delete this alarm', exact: true })
    .click()
  await expect(page.locator('.alarm-card')).toHaveCount(2)
  await page.getByRole('button', { name: 'Test alarm', exact: false }).click()
  await expect(
    page.getByRole('heading', { name: 'who dis?!', exact: true }),
  ).toBeVisible()
  await page.screenshot({
    path: testInfo.outputPath('challenge-mobile.png'),
    fullPage: true,
  })
  await noOverflow(page)
  await page
    .getByRole('button', { name: 'A Tralalero Tralala', exact: true })
    .click()
  await expect(page.getByRole('alert')).toContainText(
    'Incorrect answer. Please try again.',
  )
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'who dis?!', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'C Tung Tung Tung Sahur', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Ready for the day', exact: true }),
  ).toBeVisible()
  await page.screenshot({
    path: testInfo.outputPath('success-mobile.png'),
    fullPage: true,
  })
  await page
    .getByRole('button', { name: 'Back to alarms', exact: false })
    .click()
  await page.getByRole('button', { name: 'sign out', exact: false }).click()
  await page.getByLabel('Your email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill('test-password-123')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.locator('.alarm-card')).toHaveCount(2)
  await page.setViewportSize({ width: 320, height: 740 })
  await noOverflow(page)
  expect(browserErrors).toEqual([])
})
test('scheduled weekday alarm fires; one-time easy alarm disables itself', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-15T06:29:50+03:00') })
  await register(page, 'schedule')
  await page.clock.fastForward(10000)
  await expect(
    page.getByRole('heading', { name: 'who dis?!', exact: true }),
  ).toBeVisible()
  await expect(page.locator('.quiz-topline')).toContainText('6:30 AM')
  await page
    .getByRole('button', { name: 'C Tung Tung Tung Sahur', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Back to alarms', exact: false })
    .click()
  await page.getByRole('button', { name: '+ add alarm', exact: true }).click()
  await page.getByLabel('Time', { exact: true }).fill('06:31')
  await page
    .getByLabel('Challenge difficulty', { exact: true })
    .selectOption('easy')
  for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'])
    await page.getByRole('button', { name: day, exact: true }).click()
  await page.getByRole('button', { name: 'Save alarm', exact: true }).click()
  await expect(page.locator('.alarm-card')).toHaveCount(3)
  await page.clock.fastForward(60000)
  await expect(page.getByText('7 + 8 = ?', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'B 15', exact: true }).click()
  await page
    .getByRole('button', { name: 'Back to alarms', exact: false })
    .click()
  await expect(
    page.getByRole('switch', { name: 'Turn on 6:31 AM alarm', exact: true }),
  ).toHaveAttribute('aria-checked', 'false')
})

test('shows friendly auth feedback when backend is unavailable', async ({
  page,
}) => {
  await page.route('**/api/**', (route) => route.abort())
  await page.goto('/')
  await expect(
    page.getByText(
      'BrainRing server is offline. Start backend, then try signing in.',
      { exact: true },
    ),
  ).toBeVisible()
  await page.getByLabel('Your email', { exact: true }).fill('offline@example.com')
  await page.getByLabel('Password', { exact: true }).fill('test-password-123')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(
    'Cannot reach BrainRing server. Start backend and try again.',
  )
})
