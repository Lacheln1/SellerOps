import { existsSync } from 'node:fs';
import path from 'node:path';

export interface ClaudeCommand {
  command: string;
  /** command 뒤, claude 인자 앞에 붙는 인자 (예: node로 cli.js를 실행할 때 cli.js 경로) */
  prefixArgs: string[];
}

/**
 * claude 실행 방법을 정한다. 셸을 거치지 않기 위한 선택이다.
 *
 * Windows에서 npm으로 설치한 claude는 claude.cmd 래퍼인데, Node는 셸 없이 .cmd를 실행할 수 없고
 * 셸을 거치면 --json-schema 같은 인자의 따옴표 처리가 위험해진다. 그래서 래퍼 옆의
 * cli.js를 node로 직접 실행한다.
 *
 * 우선순위: CLAUDE_BIN 환경변수 → (Windows) PATH의 claude.cmd 옆 cli.js → PATH의 claude
 */
export function resolveClaudeCommand(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): ClaudeCommand {
  const override = env.CLAUDE_BIN;
  if (override) {
    return override.endsWith('.js')
      ? { command: process.execPath, prefixArgs: [override] }
      : { command: override, prefixArgs: [] };
  }

  if (platform === 'win32') {
    const dirs = (env.PATH ?? env.Path ?? '').split(path.delimiter).filter(Boolean);
    for (const dir of dirs) {
      if (!existsSync(path.join(dir, 'claude.cmd'))) continue;
      const cliJs = path.join(dir, 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js');
      if (existsSync(cliJs)) return { command: process.execPath, prefixArgs: [cliJs] };
    }
  }

  return { command: 'claude', prefixArgs: [] };
}
