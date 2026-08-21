import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./test",
  testMatch: "browser.spec.js",
  timeout: 15000,
  use: {
    baseURL: "http://127.0.0.1:39102",
  },
  webServer: [
    {
      command: "node test/support/server.js",
      port: 39101,
      reuseExistingServer: false,
    },
    {
      command: "vite --host 127.0.0.1 --port 39102",
      port: 39102,
      reuseExistingServer: false,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: devices["Desktop Chrome"],
    },
    {
      name: "firefox",
      use: devices["Desktop Firefox"],
    },
    {
      name: "webkit",
      use: devices["Desktop Safari"],
    },
  ],
});
