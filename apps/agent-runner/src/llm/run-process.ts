import { spawn } from 'node:child_process';

export interface ProcessResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  /** 프로세스를 아예 시작하지 못했을 때의 사유 (명령을 찾을 수 없음 등) */
  spawnError?: string;
}

export interface ProcessOptions {
  stdin: string;
  cwd: string;
  timeoutMs: number;
}

export type ProcessRunner = (
  command: string,
  args: string[],
  options: ProcessOptions,
) => Promise<ProcessResult>;

const MAX_OUTPUT_BYTES = 5 * 1024 * 1024;

/** 셸 없이 프로세스를 실행한다. 입력은 인자가 아니라 stdin으로만 넘긴다. */
export const runProcess: ProcessRunner = (command, args, { stdin, cwd, timeoutMs }) =>
  new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;

    const finish = (result: ProcessResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const child = spawn(command, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      if (stdout.length < MAX_OUTPUT_BYTES) stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      if (stderr.length < MAX_OUTPUT_BYTES) stderr += chunk;
    });

    child.on('error', (error) =>
      finish({ stdout, stderr, exitCode: null, timedOut, spawnError: error.message }),
    );
    child.on('close', (exitCode) => finish({ stdout, stderr, exitCode, timedOut }));

    // 프로세스가 입력을 다 읽기 전에 끝나면 EPIPE가 날 수 있다. 결과는 close 이벤트에서 처리한다.
    child.stdin.on('error', () => undefined);
    child.stdin.end(stdin);
  });
