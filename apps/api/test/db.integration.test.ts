import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Prisma } from '../src/generated/prisma/client.js';
import { createPrisma, createTestStore, deleteTestStore } from './helpers/db.js';

const prisma = createPrisma();
let storeId: number;

beforeAll(async () => {
  storeId = (await createTestStore(prisma)).id;
});

afterAll(async () => {
  await deleteTestStore(prisma, storeId);
  await prisma.$disconnect();
});

const newInquiry = (
  externalId: string,
  extra: Partial<Prisma.InquiryUncheckedCreateInput> = {},
): Prisma.InquiryUncheckedCreateInput => ({
  storeId,
  externalId,
  body: '배송 언제 와요? 😡',
  receivedAt: new Date(),
  ...extra,
});

async function errorCode(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (e) {
    return e instanceof Prisma.PrismaClientKnownRequestError ? e.code : String(e);
  }
  return undefined;
}

describe('문의 수집 (멱등)', () => {
  it('같은 상점의 같은 externalId는 두 번 저장되지 않는다', async () => {
    await prisma.inquiry.create({ data: newInquiry('dup-1') });

    expect(await errorCode(prisma.inquiry.create({ data: newInquiry('dup-1') }))).toBe('P2002');
    expect(await prisma.inquiry.count({ where: { storeId, externalId: 'dup-1' } })).toBe(1);
  });

  it('externalId는 대소문자를 구분하지 않는다 (테이블 collation이 _ci)', async () => {
    await prisma.inquiry.create({ data: newInquiry('Case-1') });

    expect(await errorCode(prisma.inquiry.create({ data: newInquiry('case-1') }))).toBe('P2002');
  });

  it('한글과 이모지를 그대로 저장한다', async () => {
    const created = await prisma.inquiry.create({ data: newInquiry('utf8-1') });
    const found = await prisma.inquiry.findUniqueOrThrow({ where: { id: created.id } });

    expect(found.body).toBe('배송 언제 와요? 😡');
  });
});

describe('발송 (중복 방지)', () => {
  it('approved가 아니면 sent로 바뀌지 않는다', async () => {
    const inquiry = await prisma.inquiry.create({
      data: newInquiry('send-1', { status: 'drafted' }),
    });

    const result = await prisma.inquiry.updateMany({
      where: { id: inquiry.id, status: 'approved' },
      data: { status: 'sent', sentAt: new Date() },
    });

    expect(result.count).toBe(0);
    expect((await prisma.inquiry.findUniqueOrThrow({ where: { id: inquiry.id } })).status).toBe(
      'drafted',
    );
  });

  it('동시에 20번 발송을 시도해도 정확히 한 번만 성공한다', async () => {
    const inquiry = await prisma.inquiry.create({
      data: newInquiry('send-2', { status: 'approved' }),
    });

    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        prisma.inquiry.updateMany({
          where: { id: inquiry.id, status: 'approved' },
          data: { status: 'sent', sentAt: new Date() },
        }),
      ),
    );

    expect(results.filter((r) => r.count === 1)).toHaveLength(1);
    expect((await prisma.inquiry.findUniqueOrThrow({ where: { id: inquiry.id } })).status).toBe(
      'sent',
    );
  });

  it('정의되지 않은 status 값은 DB가 거부한다', async () => {
    const inquiry = await prisma.inquiry.create({ data: newInquiry('enum-1') });

    await expect(
      prisma.$executeRaw`UPDATE Inquiry SET status = 'bogus' WHERE id = ${inquiry.id}`,
    ).rejects.toThrow();
  });
});

describe('초안과 연관 데이터', () => {
  it('같은 문의의 같은 버전 초안은 중복될 수 없다', async () => {
    const inquiry = await prisma.inquiry.create({ data: newInquiry('draft-1') });
    await prisma.draft.create({
      data: { inquiryId: inquiry.id, version: 1, body: 'a', policyRefs: [] },
    });

    expect(
      await errorCode(
        prisma.draft.create({
          data: { inquiryId: inquiry.id, version: 1, body: 'b', policyRefs: [] },
        }),
      ),
    ).toBe('P2002');
  });

  it('문의를 지우면 초안은 함께 지워지고 LlmCall 기록은 남는다', async () => {
    const inquiry = await prisma.inquiry.create({ data: newInquiry('cascade-1') });
    await prisma.draft.create({
      data: { inquiryId: inquiry.id, version: 1, body: 'a', policyRefs: [] },
    });
    const call = await prisma.llmCall.create({
      data: {
        kind: 'classify',
        provider: 'fake',
        model: 'fake',
        promptVersion: 'v1',
        status: 'success',
        durationMs: 1,
        inquiryId: inquiry.id,
      },
    });

    await prisma.inquiry.delete({ where: { id: inquiry.id } });

    expect(await prisma.draft.count({ where: { inquiryId: inquiry.id } })).toBe(0);
    expect(
      (await prisma.llmCall.findUniqueOrThrow({ where: { id: call.id } })).inquiryId,
    ).toBeNull();
    await prisma.llmCall.delete({ where: { id: call.id } });
  });
});

describe('일일 브리핑 (재실행 안전)', () => {
  it('같은 상점·날짜로 다시 저장하면 1건이 유지되고 최신 값으로 덮어쓴다', async () => {
    const date = new Date('2026-11-24');
    for (const version of [1, 2]) {
      await prisma.briefing.upsert({
        where: { storeId_date: { storeId, date } },
        create: { storeId, date, sections: { version } },
        update: { sections: { version } },
      });
    }

    const rows = await prisma.briefing.findMany({ where: { storeId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.sections).toEqual({ version: 2 });
  });
});
