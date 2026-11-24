import net from 'node:net';
import { describe, expect, it } from 'vitest';

const DEFAULT_REDIS_URL = 'redis://127.0.0.1:6379';

// 아직 Redis 클라이언트 의존성이 없어서 RESP로 PING만 직접 보낸다. (BullMQ 도입 후 교체)
function ping(url: URL): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = net.connect(Number(url.port || 6379), url.hostname);
    socket.setTimeout(5000, () => socket.destroy(new Error('Redis 응답 시간 초과')));
    socket.once('error', reject);
    socket.once('data', (data) => {
      socket.end();
      resolve(data.toString().trim());
    });
    socket.once('connect', () => socket.write('PING\r\n'));
  });
}

describe('Redis', () => {
  it('PING에 PONG으로 응답한다', async () => {
    const url = new URL(process.env.REDIS_URL ?? DEFAULT_REDIS_URL);

    expect(await ping(url)).toBe('+PONG');
  });
});
