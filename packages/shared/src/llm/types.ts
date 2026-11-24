import type { z } from 'zod';

/** LlmCall.kind 컬럼과 같은 값 */
export type LlmCallKind = 'classify' | 'draft' | 'review_classify' | 'briefing' | 'eval';

/** 작업 난이도에 따른 모델 등급. 실제 모델 이름은 provider가 정한다. */
export type LlmModelTier = 'fast' | 'smart';

/** LlmCall.status 컬럼(success 제외)과 같은 값 */
export type LlmErrorCode = 'invalid_output' | 'error' | 'timeout' | 'rate_limited';

export interface LlmRequest<T> {
  kind: LlmCallKind;
  tier: LlmModelTier;
  /** 프롬프트를 바꿀 때마다 올린다. LlmCall에 남겨 버전별 Eval 비교에 쓴다. */
  promptVersion: string;
  /** 지시문. 고객이 쓴 텍스트를 절대 넣지 않는다. */
  system: string;
  /** 문의·리뷰 같은 신뢰할 수 없는 입력. 지시가 아니라 데이터로만 전달된다. */
  input: string;
  /** 응답이 따라야 하는 형식. provider가 한 번, 호출한 쪽이 믿기 전에 한 번 더 검증한다. */
  schema: z.ZodType<T>;
  timeoutMs?: number;
}

/** LlmCall 테이블에 그대로 기록할 수 있는 호출 정보 */
export interface LlmCallMeta {
  kind: LlmCallKind;
  provider: string;
  model: string;
  promptVersion: string;
  durationMs: number;
  inputTokens?: number;
  outputTokens?: number;
}

export interface LlmResult<T> {
  data: T;
  meta: LlmCallMeta;
}

export class LlmError extends Error {
  constructor(
    readonly code: LlmErrorCode,
    message: string,
    /** 실패한 호출도 LlmCall에 남길 수 있도록 알고 있는 정보를 담는다. */
    readonly meta?: Partial<LlmCallMeta>,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'LlmError';
  }
}

export interface LlmProvider {
  /** LlmCall.provider 컬럼 값 (claude-cli, fake ...) */
  readonly name: string;
  complete<T>(request: LlmRequest<T>): Promise<LlmResult<T>>;
}
