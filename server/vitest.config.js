import {defineConfig} from "vitest/config"

export default defineConfig({
  test: {
    env: {
      NODE_ENV: "test",
      DB_CONNECTION: ":memory:",
      SEED_USER_PWD: "test_password",
      PUBLIC_APP_URL: "http://localhost:5173",
    },
    clearMocks: true,
	coverage: {
	  reportOnFailure: true,	
      clean: false, // Prevent deletion of the coverage directory before running tests
      // ... other configurations
    }
  },
});