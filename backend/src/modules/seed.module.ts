import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from '@/entities';
import { SeedService, TicketGeneratorService } from '@/services';

@Module({
  imports: [TypeOrmModule.forFeature([Ticket])],
  providers: [SeedService, TicketGeneratorService],
  exports: [SeedService],
})
export class SeedModule {}
