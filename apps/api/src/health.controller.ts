import { Controller, Get } from '@nestjs/common';
import type { HealthStatus } from '@sellerops/shared';

@Controller('health')
export class HealthController {
  @Get()
  check(): HealthStatus {
    return { service: 'api', status: 'ok' };
  }
}
