import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  MessageEvent,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { CurrentUser, SkipSuccessWrapper } from '@/decorators';
import { ReservationDto, ReservationResultDto, TicketDto } from '@/dtos';
import { JwtAuthGuard, RateLimitGuard } from '@/guards';
import { IAuthUser } from '@/interfaces';
import { EventsService, ReservationsService, TicketsService } from '@/services';

@ApiTags('tickets')
@ApiBearerAuth()
@Controller('tickets')
export class TicketsController {
  constructor(
    private readonly ticketsService: TicketsService,
    private readonly reservations: ReservationsService,
    private readonly events: EventsService,
  ) {}

  @Get('available')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      'List claimable tickets for the authenticated reviewer (locale-scoped)',
  })
  @ApiResponse({ status: 200, type: [TicketDto] })
  listAvailable(@CurrentUser() user: IAuthUser): Promise<TicketDto[]> {
    return this.ticketsService.listAvailable(user);
  }

  @Get('active')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "The reviewer's active holds (active or confirmed)",
    description:
      'Let the UI restore held tickets after a page refresh. Expired holds are swept out first.',
  })
  @ApiResponse({ status: 200, type: [ReservationResultDto] })
  listActive(@CurrentUser() user: IAuthUser): Promise<ReservationResultDto[]> {
    return this.ticketsService.listActiveHeld(user);
  }

  @Post(':id/reserve')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reserve an available ticket',
    description:
      'Atomically claims the ticket and holds it for the reservation TTL (default 20 min).',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: ReservationResultDto })
  @ApiResponse({
    status: 403,
    description: 'Ticket belongs to a different locale.',
  })
  @ApiResponse({ status: 404, description: 'Ticket not found.' })
  @ApiResponse({ status: 409, description: 'Ticket is no longer available.' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded.' })
  async reserve(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: IAuthUser,
  ): Promise<ReservationResultDto> {
    const { ticket, reservation } = await this.reservations.reserve(id, user);
    return {
      ticket: TicketDto.from(ticket),
      reservation: ReservationDto.from(reservation),
    };
  }

  @Post(':id/confirm')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirm processing of a reserved ticket',
    description:
      'Must be called within the reservation window, by the reviewer who holds it.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: ReservationResultDto })
  @ApiResponse({
    status: 404,
    description: 'No reservation for this ticket by you.',
  })
  @ApiResponse({
    status: 409,
    description: 'Reservation already confirmed / not confirmable.',
  })
  @ApiResponse({
    status: 410,
    description: 'Reservation window expired; ticket re-queued.',
  })
  async confirm(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: IAuthUser,
  ): Promise<ReservationResultDto> {
    const { ticket, reservation } = await this.reservations.confirm(id, user);
    return {
      ticket: TicketDto.from(ticket),
      reservation: ReservationDto.from(reservation),
    };
  }

  @Sse('stream')
  @UseGuards(JwtAuthGuard)
  @SkipSuccessWrapper()
  @ApiOperation({
    summary: 'Real-time, locale-scoped ticket events (SSE)',
    description:
      'Server-Sent Events stream. Because EventSource cannot set headers, pass the JWT via the `access_token` query parameter.',
  })
  stream(@Req() req: Request & { user: IAuthUser }): Observable<MessageEvent> {
    return this.events.streamForLocale(
      req.user.locale,
    ) as unknown as Observable<MessageEvent>;
  }
}
