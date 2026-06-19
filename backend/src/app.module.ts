import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from '@/config/configuration';
import { AppController } from '@/controllers';
import { Reservation, Reviewer, Ticket } from '@/entities';
import {
  AuthModule,
  CommonModule,
  MetricsModule,
  SeedModule,
  TicketsModule,
} from '@/modules';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.user'),
        password: config.get<string>('database.password'),
        database: config.get<string>('database.name'),
        entities: [Reviewer, Ticket, Reservation],
        synchronize: config.get<boolean>('database.synchronize'),
        // Retry while Postgres finishes starting up inside docker-compose.
        retryAttempts: 10,
        retryDelay: 3000,
      }),
    }),
    CommonModule,
    AuthModule,
    TicketsModule,
    MetricsModule,
    SeedModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
