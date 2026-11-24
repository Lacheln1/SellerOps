import { defineConfig } from 'vitest/config';

// 단위 테스트: 외부 서비스(MySQL, Redis) 없이 돌아간다.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
