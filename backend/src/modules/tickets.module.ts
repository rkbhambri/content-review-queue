import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketsController } from '@/controllers';
import { Reservation, Ticket } from '@/entities';
import { RateLimitGuard } from '@/guards';
import { ReaperService, ReservationsService, TicketsService } from '@/services';
import { AuthModule } from './auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Ticket, Reservation]), AuthModule],
  controllers: [TicketsController],
  providers: [
    TicketsService,
    ReservationsService,
    ReaperService,
    RateLimitGuard,
  ],
  exports: [TicketsService, ReservationsService],
})
export class TicketsModule {}
