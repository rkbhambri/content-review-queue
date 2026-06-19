import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Locale, TicketStatus } from '@/enums';

/**
 * A unit of work to be reviewed. The `status` column is the single source of
 * truth for claimability; the composite (locale, status) index keeps the
 * "available tickets for my locale" query fast.
 */
@Entity({ name: 'tickets' })
@Index(['locale', 'status'])
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Stable id from the upstream source (file name / generator). */
  @Column({ name: 'external_ref', type: 'varchar', length: 128, unique: true })
  externalRef: string;

  @Column({ type: 'enum', enum: Locale })
  locale: Locale;

  @Column({ type: 'enum', enum: TicketStatus, default: TicketStatus.AVAILABLE })
  status: TicketStatus;

  /** Free-form review content (title, body, priority, etc.). */
  @Column({ type: 'jsonb', default: {} })
  payload: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
