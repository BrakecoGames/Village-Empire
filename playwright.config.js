// Playwright-configuratie voor Village Empire.
// De game wordt geserveerd vanaf http://127.0.0.1:4173 (eigen origin), en elke test
// krijgt een nieuw, leeg browserprofiel. Opgeslagen spelvoortgang (localStorage) van
// de echte speler wordt daardoor nooit gelezen of overschreven.
const { defineConfig } = require('@playwright/test');

const PORT = 4173;

module.exports = defineConfig({
  testDir: './tests',
  // visual.spec.js maakt alleen vergelijkingsbeelden; draai die met `npm run shots`
  testIgnore: process.env.VISUAL ? [] : ['**/visual.spec.js', '**/stage.spec.js', '**/showcase.spec.js', '**/characters.spec.js'],
  // Buiten iCloud Drive: iCloud verplaatst/verwijdert soms trace-bestanden terwijl Playwright erin
  // schrijft (ENOENT bij browserContext.close), waardoor een geslaagde test toch faalt.
  outputDir: require('path').join(require('os').tmpdir(), 'village-empire-test-results'),
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    browserName: 'chromium',
    // Headless Chromium rendert WebGL via SwiftShader (software); dat is traag maar betrouwbaar.
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
    },
    {
      name: 'mobile',
      use: {
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
      },
    },
  ],
  webServer: {
    command: `npx http-server . -p ${PORT} -a 127.0.0.1 -c-1 --silent`,
    url: `http://127.0.0.1:${PORT}/index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
