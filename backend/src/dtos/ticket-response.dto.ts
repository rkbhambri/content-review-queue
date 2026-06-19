import { ApiProperty } from '@nestjs/swagger';
import { Locale, ReservationStatus, TicketStatus } from '@/enums';
import { Reservation, Ticket } from '@/entities';

export class TicketDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'west-coast/ticket_001' })
  externalRef: string;

  @ApiProperty({ enum: Locale })
  locale: Locale;

  @ApiProperty({ enum: TicketStatus })
  status: TicketStatus;

  @ApiProperty({ type: 'object', additionalProperties: true })
  payload: Record<string, unknown>;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  static from(ticket: Ticket): TicketDto {
    return {
      id: ticket.id,
      externalRef: ticket.externalRef,
      locale: ticket.locale,
      status: ticket.status,
      payload: ticket.payload,
      createdAt: ticket.createdAt,
    };
  }
}

export class ReservationDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: ReservationStatus })
  status: ReservationStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  reservedAt: Date;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'When the hold lapses if not confirmed.',
  })
  expiresAt: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  confirmedAt: Date | null;

  static from(reservation: Reservation): ReservationDto {
    return {
      id: reservation.id,
      status: reservation.status,
      reservedAt: reservation.reservedAt,
      expiresAt: reservation.expiresAt,
      confirmedAt: reservation.confirmedAt,
    };
  }
}

export class ReservationResultDto {
  @ApiProperty({ type: TicketDto })
  ticket: TicketDto;

  @ApiProperty({ type: ReservationDto })
  reservation: ReservationDto;
}
