import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    include: ["packages/*/src/**/*.test.ts", "apps/*/src/**/*.test.ts"],
  },
  lint: {
    ignorePatterns: [
      "**/dist/**",
      "**/dist-electron/**",
      "**/dist-renderer/**",
      "**/out/**",
      "**/release/**",
    ],
    options: { typeAware: true, typeCheck: true },
  },
  fmt: {
    ignorePatterns: [
      "**/dist/**",
      "**/dist-electron/**",
      "**/dist-renderer/**",
      "**/out/**",
      "**/release/**",
    ],
  },
});
