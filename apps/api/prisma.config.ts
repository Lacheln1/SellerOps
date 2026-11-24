import path from 'node:path';
import { defineConfig } from 'prisma/config';

// Prisma 7은 .env를 자동으로 읽지 않는다. 루트 .env가 있으면 읽고, 없으면 compose 기본값을 쓴다.
try {
  process.loadEnvFile(path.resolve(process.cwd(), '../../.env'));
} catch {
  // .env 없음 → 아래 기본값 사용
}

const DEFAULT_URL = 'mysql://sellerops:sellerops@127.0.0.1:3307/sellerops';
const DEFAULT_SHADOW_URL = 'mysql://sellerops:sellerops@127.0.0.1:3307/sellerops_shadow';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    url: process.env.DATABASE_URL ?? DEFAULT_URL,
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL ?? DEFAULT_SHADOW_URL,
  },
});
