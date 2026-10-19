import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:4110",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm start",
    url: "http://127.0.0.1:4110/api/health",
    reuseExistingServer: false,
    env: {
      PORT: "4110",
      HOST: "127.0.0.1",
      DATABASE_PATH: `./data/e2e-${process.pid}.sqlite`,
    },
  },
});
