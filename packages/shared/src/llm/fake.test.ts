import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { FakeLlmProvider } from './fake.js';
import { toJsonSchema } from './json-schema.js';
import { LlmError, type LlmRequest } from './types.js';

const schema = z.object({ category: z.enum(['shipping', 'other']), confidence: z.number() });

const request = (overrides: Partial<LlmRequest<z.infer<typeof schema>>> = {}) => ({
  kind: 'classify' as const,
  tier: 'fast' as const,
  promptVersion: 'v1',
  system: '문의를 분류한다.',
  input: '배송 언제 와요?',
  schema,
  ...overrides,
});

async function errorOf(promise: Promise<unknown>): Promise<LlmError> {
  try {
    await promise;
  } catch (e) {
    if (e instanceof LlmError) return e;
    throw e;
  }
  throw new Error('에러가 발생해야 한다');
}

describe('FakeLlmProvider', () => {
  it('스키마를 통과한 데이터와 호출 정보를 돌려준다', async () => {
    const provider = FakeLlmProvider.always({ category: 'shipping', confidence: 0.9 });

    const result = await provider.complete(request());

    expect(result.data).toEqual({ category: 'shipping', confidence: 0.9 });
    expect(result.meta).toMatchObject({
      kind: 'classify',
      provider: 'fake',
      model: 'fake',
      promptVersion: 'v1',
    });
  });

  it('받은 요청을 기록한다', async () => {
    const provider = FakeLlmProvider.always({ category: 'other', confidence: 0.5 });

    await provider.complete(request({ input: '첫 번째' }));
    await provider.complete(request({ input: '두 번째' }));

    expect(provider.calls.map((c) => c.input)).toEqual(['첫 번째', '두 번째']);
  });

  it('스키마와 맞지 않는 응답은 invalid_output이다', async () => {
    const provider = FakeLlmProvider.always({ category: '환불', confidence: 2 });

    const error = await errorOf(provider.complete(request()));

    expect(error.code).toBe('invalid_output');
    expect(error.meta?.provider).toBe('fake');
  });

  it('JSON이 아닌 문자열 응답은 invalid_output이다', async () => {
    const provider = FakeLlmProvider.always('죄송하지만 분류할 수 없습니다');

    expect((await errorOf(provider.complete(request()))).code).toBe('invalid_output');
  });

  it('JSON 문자열 응답은 읽어서 검증한다', async () => {
    const provider = FakeLlmProvider.always('{"category":"other","confidence":0.1}');

    expect((await provider.complete(request())).data.category).toBe('other');
  });

  it.each(['error', 'timeout', 'rate_limited'] as const)(
    'failing(%s)는 같은 코드로 실패한다',
    async (code) => {
      const error = await errorOf(FakeLlmProvider.failing(code).complete(request()));

      expect(error.code).toBe(code);
    },
  );

  it('응답 시간이 timeoutMs보다 길면 실제로 기다리지 않고 timeout이다', async () => {
    const provider = FakeLlmProvider.always(
      { category: 'other', confidence: 1 },
      { delayMs: 5000 },
    );

    const error = await errorOf(provider.complete(request({ timeoutMs: 1000 })));

    expect(error.code).toBe('timeout');
    expect(error.meta?.durationMs).toBe(1000);
  });

  it('sequence는 순서대로 응답하고 다 쓰면 error다', async () => {
    const provider = FakeLlmProvider.sequence([
      { category: 'shipping', confidence: 0.8 },
      { category: 'other', confidence: 0.2 },
    ]);

    expect((await provider.complete(request())).data.category).toBe('shipping');
    expect((await provider.complete(request())).data.category).toBe('other');
    expect((await errorOf(provider.complete(request()))).code).toBe('error');
  });
});

describe('toJsonSchema', () => {
  it('$schema 키를 뺀 순수 JSON Schema를 만든다', () => {
    const json = toJsonSchema(schema);

    expect(json).not.toHaveProperty('$schema');
    expect(json).toMatchObject({
      type: 'object',
      properties: { category: { enum: ['shipping', 'other'] } },
      required: ['category', 'confidence'],
    });
  });
});
