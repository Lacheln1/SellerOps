import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { resolveClaudeCommand } from './claude-command.js';

const dir = mkdtempSync(path.join(tmpdir(), 'claude-cmd-test-'));
const cliJs = path.join(dir, 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js');
mkdirSync(path.dirname(cliJs), { recursive: true });
writeFileSync(path.join(dir, 'claude.cmd'), '');
writeFileSync(cliJs, '');

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('resolveClaudeCommand', () => {
  it('Windows에서 claude.cmd가 있으면 node로 옆의 cli.js를 직접 실행한다', () => {
    const result = resolveClaudeCommand({ PATH: dir }, 'win32');

    expect(result).toEqual({ command: process.execPath, prefixArgs: [cliJs] });
  });

  it('Windows가 아니면 PATH의 claude를 쓴다', () => {
    expect(resolveClaudeCommand({ PATH: dir }, 'linux')).toEqual({
      command: 'claude',
      prefixArgs: [],
    });
  });

  it('Windows여도 cli.js를 찾지 못하면 claude를 쓴다', () => {
    expect(resolveClaudeCommand({ PATH: tmpdir() }, 'win32')).toEqual({
      command: 'claude',
      prefixArgs: [],
    });
  });

  it('CLAUDE_BIN이 있으면 그것을 우선한다', () => {
    expect(resolveClaudeCommand({ CLAUDE_BIN: '/opt/claude' }, 'win32')).toEqual({
      command: '/opt/claude',
      prefixArgs: [],
    });
  });

  it('CLAUDE_BIN이 .js 파일이면 node로 실행한다', () => {
    expect(resolveClaudeCommand({ CLAUDE_BIN: '/opt/claude/cli.js' }, 'linux')).toEqual({
      command: process.execPath,
      prefixArgs: ['/opt/claude/cli.js'],
    });
  });
});
