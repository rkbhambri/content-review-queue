import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ReservationStatus } from '@/enums';
import { Ticket } from './ticket.entity';

/**
 * A reservation records the lifecycle of a single hold on a ticket. Keeping it
 * separate from the ticket itself preserves an auditable history (who held
 * what, when it expired) and cleanly normalizes the data model.
 *
 * The (status, expiresAt) index is what the reaper scans every cycle.
 */
@Entity({ name: 'reservations' })
@Index(['status', 'expiresAt'])
@Index(['ticketId'])
export class Reservation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'ticket_id', type: 'uuid' })
  ticketId: string;

  @ManyToOne(() => Ticket, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticket_id' })
  ticket?: Ticket;

  /** The reviewer's human id (not the reviewer row uuid) for easy tracing. */
  @Column({ name: 'reviewer_id', type: 'varchar', length: 64 })
  reviewerId: string;

  @Column({
    type: 'enum',
    enum: ReservationStatus,
    default: ReservationStatus.ACTIVE,
  })
  status: ReservationStatus;

  @CreateDateColumn({ name: 'reserved_at', type: 'timestamptz' })
  reservedAt: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt: Date | null;
}
