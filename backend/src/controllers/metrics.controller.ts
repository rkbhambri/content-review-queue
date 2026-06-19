import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IMetricsSummary } from '@/interfaces';
import { MetricsService } from '@/services';

@ApiTags('metrics')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @ApiOperation({
    summary: 'Queue health metrics',
    description:
      'Aggregate counts of tickets by status and locale plus reservation lifecycle counts. Public (no auth) for easy monitoring.',
  })
  @ApiResponse({ status: 200, description: 'Queue health snapshot.' })
  getMetrics(): Promise<IMetricsSummary> {
    return this.metrics.getSummary();
  }
}
