import { describe, expect, it } from 'vitest';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('api 서비스의 ok 상태를 반환한다', () => {
    expect(new HealthController().check()).toEqual({ service: 'api', status: 'ok' });
  });
});
