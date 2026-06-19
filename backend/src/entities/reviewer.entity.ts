import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Locale } from '@/enums';

/**
 * A reviewer is identified by a human-friendly `reviewerId` and is permanently
 * bound to a single locale. Authentication simply resolves (or lazily creates)
 * the reviewer row for that id + locale pair.
 */
@Entity({ name: 'reviewers' })
@Index(['reviewerId'], { unique: true })
export class Reviewer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'reviewer_id', type: 'varchar', length: 64 })
  reviewerId: string;

  @Column({ type: 'enum', enum: Locale })
  locale: Locale;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
