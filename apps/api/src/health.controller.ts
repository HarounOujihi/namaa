import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('meta')
@Controller()
export class MetaController {
  @Get()
  info() {
    return {
      service: 'Dyslexia Therapy API',
      docs: '/docs',
      health: '/health',
      apps: {
        child: 'http://localhost:5173',
        admin: 'http://localhost:5174',
        web: 'http://localhost:3001',
      },
    };
  }

  @Get('health')
  @ApiTags('health')
  check(): { status: string } {
    return { status: 'ok' };
  }
}
