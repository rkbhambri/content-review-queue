import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MetricsController } from '@/controllers';
import { Reservation, Ticket } from '@/entities';
import { MetricsService } from '@/services';

@Module({
  imports: [TypeOrmModule.forFeature([Ticket, Reservation])],
  controllers: [MetricsController],
  providers: [MetricsService],
})
export class MetricsModule {}
