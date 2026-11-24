import { LlmError, type LlmCallMeta, type LlmErrorCode, type LlmProvider } from './types.js';
import type { LlmRequest, LlmResult } from './types.js';

export interface FakeLlmOptions {
  model?: string;
  /** 응답에 걸린 것으로 기록할 시간. 실제로 기다리지는 않는다. */
  delayMs?: number;
}

type Responder = (request: LlmRequest<unknown>, callIndex: number) => unknown | Promise<unknown>;

/**
 * 테스트·CI·공개 데모용 provider. 외부 호출 없이 정해 둔 응답을 돌려준다.
 *
 * - 응답이 문자열이면 JSON으로 읽는다 (깨진 JSON 응답을 흉내 내려고).
 * - 응답이 LlmError면 그대로 던진다.
 * - 실제 provider처럼 응답을 스키마로 검증하므로 형식이 틀리면 invalid_output이 된다.
 */
export class FakeLlmProvider implements LlmProvider {
  readonly name = 'fake';
  /** 지금까지 받은 요청. 테스트에서 프롬프트 내용을 확인할 때 쓴다. */
  readonly calls: LlmRequest<unknown>[] = [];

  constructor(
    private readonly respond: Responder,
    private readonly options: FakeLlmOptions = {},
  ) {}

  static always(value: unknown, options?: FakeLlmOptions): FakeLlmProvider {
    return new FakeLlmProvider(() => value, options);
  }

  /** 호출 순서대로 값을 돌려주고, 다 쓰면 에러를 던진다. */
  static sequence(values: unknown[], options?: FakeLlmOptions): FakeLlmProvider {
    return new FakeLlmProvider((_request, index) => {
      if (index >= values.length) {
        return new LlmError(
          'error',
          `fake 응답이 소진됨 (${values.length}개 준비, ${index + 1}번째 호출)`,
        );
      }
      return values[index];
    }, options);
  }

  static failing(code: LlmErrorCode, message = `fake ${code}`): FakeLlmProvider {
    return new FakeLlmProvider(() => new LlmError(code, message));
  }

  async complete<T>(request: LlmRequest<T>): Promise<LlmResult<T>> {
    const callIndex = this.calls.length;
    this.calls.push(request as LlmRequest<unknown>);

    const delayMs = this.options.delayMs ?? 0;
    const meta: LlmCallMeta = {
      kind: request.kind,
      provider: this.name,
      model: this.options.model ?? 'fake',
      promptVersion: request.promptVersion,
      durationMs: delayMs,
    };

    if (request.timeoutMs !== undefined && delayMs > request.timeoutMs) {
      throw new LlmError('timeout', `fake 응답이 ${request.timeoutMs}ms 안에 오지 않음`, {
        ...meta,
        durationMs: request.timeoutMs,
      });
    }

    let raw = await this.respond(request as LlmRequest<unknown>, callIndex);
    if (raw instanceof LlmError) throw raw;

    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch (cause) {
        throw new LlmError('invalid_output', '응답이 JSON이 아님', meta, { cause });
      }
    }

    const parsed = request.schema.safeParse(raw);
    if (!parsed.success) {
      throw new LlmError('invalid_output', '응답이 스키마와 맞지 않음', meta, {
        cause: parsed.error,
      });
    }
    return { data: parsed.data, meta };
  }
}
