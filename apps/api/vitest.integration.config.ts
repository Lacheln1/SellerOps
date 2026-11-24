import { defineConfig } from 'vitest/config';

// 통합 테스트: docker compose의 MySQL, Redis가 떠 있어야 한다 (npm run infra:up).
export default defineConfig({
  test: {
    include: ['test/**/*.integration.test.ts'],
    testTimeout: 20_000,
    hookTimeout: 20_000,
    // 같은 DB를 쓰므로 파일끼리 순서대로 실행한다.
    fileParallelism: false,
  },
});
