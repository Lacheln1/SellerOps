import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  LlmError,
  toJsonSchema,
  type LlmCallMeta,
  type LlmModelTier,
  type LlmProvider,
  type LlmRequest,
  type LlmResult,
} from '@sellerops/shared';
import { resolveClaudeCommand, type ClaudeCommand } from './claude-command.js';
import { runProcess, type ProcessRunner } from './run-process.js';

const DEFAULT_MODELS: Record<LlmModelTier, string> = { fast: 'haiku', smart: 'sonnet' };
const DEFAULT_TIMEOUT_MS = 120_000;

// ※ 아직 실제 한도 오류 메시지로 확인하지 못했다. 스파이크·운영 중 실제 문구를 보고 보강한다.
const RATE_LIMIT_PATTERN = /rate.?limit|usage limit|limit reached|quota|overloaded|\b429\b/i;

export interface ClaudeCliProviderOptions {
  models?: Partial<Record<LlmModelTier, string>>;
  command?: ClaudeCommand;
  runner?: ProcessRunner;
  /** claude를 실행할 폴더. 프로젝트의 CLAUDE.md·설정을 읽지 않도록 빈 폴더를 쓴다. */
  workDir?: string;
  defaultTimeoutMs?: number;
  /** 모델 환경변수(CLAUDE_MODEL_FAST, CLAUDE_MODEL_SMART)를 읽을 환경. 기본은 process.env */
  env?: NodeJS.ProcessEnv;
}

interface Envelope {
  is_error?: boolean;
  result?: unknown;
  structured_output?: unknown;
  usage?: { input_tokens?: number; output_tokens?: number };
  modelUsage?: Record<string, unknown>;
}

/**
 * 구독으로 로그인된 Claude Code를 헤드리스(claude -p)로 호출하는 provider.
 * 이 PC에서만 실행한다. 서버·CI·다른 사람이 쓰는 환경에서는 쓰지 않는다.
 *
 * 안전 장치
 * - --tools "" : 모델에게 도구를 주지 않는다. 입력에 인젝션이 있어도 텍스트를 돌려주는 것 외에 할 수 있는 일이 없다.
 * - 고객 입력은 stdin으로만 전달한다. 인자(지시문)에는 섞지 않는다.
 * - --setting-sources "" / --strict-mcp-config / 빈 작업 폴더 : 로컬 설정, 훅, MCP, CLAUDE.md를 읽지 않는다.
 * - --no-session-persistence : 호출 기록을 세션으로 남기지 않는다.
 */
export class ClaudeCliProvider implements LlmProvider {
  readonly name = 'claude-cli';

  private readonly models: Record<LlmModelTier, string>;
  private readonly command: ClaudeCommand;
  private readonly runner: ProcessRunner;
  private readonly workDir: string;
  private readonly defaultTimeoutMs: number;

  constructor(options: ClaudeCliProviderOptions = {}) {
    // 별칭(haiku, sonnet)이 가리키는 모델은 설치된 CLI 버전에 따라 다르다.
    // 특정 모델을 쓰려면 CLAUDE_MODEL_FAST / CLAUDE_MODEL_SMART에 전체 모델 이름을 넣는다.
    const env = options.env ?? process.env;
    this.models = {
      fast: env.CLAUDE_MODEL_FAST || DEFAULT_MODELS.fast,
      smart: env.CLAUDE_MODEL_SMART || DEFAULT_MODELS.smart,
      ...options.models,
    };
    this.command = options.command ?? resolveClaudeCommand();
    this.runner = options.runner ?? runProcess;
    this.workDir = options.workDir ?? path.join(tmpdir(), 'sellerops-agent-runner');
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async complete<T>(request: LlmRequest<T>): Promise<LlmResult<T>> {
    const model = this.models[request.tier];
    const timeoutMs = request.timeoutMs ?? this.defaultTimeoutMs;
    const args = [
      ...this.command.prefixArgs,
      '-p',
      '--model',
      model,
      '--output-format',
      'json',
      '--json-schema',
      JSON.stringify(toJsonSchema(request.schema)),
      '--tools',
      '',
      '--no-session-persistence',
      '--system-prompt',
      request.system,
      '--setting-sources',
      '',
      '--strict-mcp-config',
    ];

    mkdirSync(this.workDir, { recursive: true });
    const startedAt = Date.now();
    const result = await this.runner(this.command.command, args, {
      stdin: request.input,
      cwd: this.workDir,
      timeoutMs,
    });

    const meta: LlmCallMeta = {
      kind: request.kind,
      provider: this.name,
      model,
      promptVersion: request.promptVersion,
      durationMs: Date.now() - startedAt,
    };

    if (result.spawnError) {
      throw new LlmError('error', `claude를 실행하지 못함: ${result.spawnError}`, meta);
    }
    if (result.timedOut) {
      throw new LlmError('timeout', `claude가 ${timeoutMs}ms 안에 끝나지 않음`, meta);
    }

    const envelope = parseJson(result.stdout) as Envelope | undefined;
    const failureText = envelope?.is_error ? String(envelope.result ?? '') : result.stderr;

    if (result.exitCode !== 0 || envelope?.is_error) {
      const detail = (failureText || result.stdout).slice(0, 300);
      throw new LlmError(
        RATE_LIMIT_PATTERN.test(detail) ? 'rate_limited' : 'error',
        `claude 실패 (exit ${result.exitCode}): ${detail}`,
        meta,
      );
    }
    if (!envelope || typeof envelope !== 'object') {
      throw new LlmError('invalid_output', 'claude 출력이 JSON이 아님', meta);
    }

    const candidate = envelope.structured_output ?? parseJson(stripCodeFence(envelope.result));
    const parsed = request.schema.safeParse(candidate);
    if (!parsed.success) {
      throw new LlmError('invalid_output', '응답이 스키마와 맞지 않음', meta, {
        cause: parsed.error,
      });
    }

    return {
      data: parsed.data,
      meta: {
        ...meta,
        model: firstKey(envelope.modelUsage) ?? model,
        inputTokens: envelope.usage?.input_tokens,
        outputTokens: envelope.usage?.output_tokens,
      },
    };
  }
}

function parseJson(text: unknown): unknown {
  if (typeof text !== 'string') return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function stripCodeFence(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const match = value.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return match?.[1] ?? value;
}

function firstKey(record: Record<string, unknown> | undefined): string | undefined {
  return record ? Object.keys(record)[0] : undefined;
}
