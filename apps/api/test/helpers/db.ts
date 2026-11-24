import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../../src/generated/prisma/client.js';

const DEFAULT_DATABASE_URL = 'mysql://sellerops:sellerops@127.0.0.1:3307/sellerops';

export function createPrisma(): PrismaClient {
  const url = new URL(process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL);
  const adapter = new PrismaMariaDb({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    connectionLimit: 20,
  });
  return new PrismaClient({ adapter });
}

// 테스트마다 전용 상점을 만들어 쓴다. 다른 데이터(개발 DB)는 건드리지 않는다.
export async function createTestStore(prisma: PrismaClient) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return prisma.store.create({
    data: { name: `test-${suffix}`, webhookSecret: 'test-secret', policyDoc: '테스트 정책' },
  });
}

export async function deleteTestStore(prisma: PrismaClient, storeId: number) {
  await prisma.llmCall.deleteMany({
    where: { OR: [{ inquiry: { storeId } }, { review: { storeId } }] },
  });
  await prisma.inquiry.deleteMany({ where: { storeId } }); // 초안은 cascade로 함께 삭제
  await prisma.review.deleteMany({ where: { storeId } });
  await prisma.briefing.deleteMany({ where: { storeId } });
  await prisma.store.delete({ where: { id: storeId } });
}
