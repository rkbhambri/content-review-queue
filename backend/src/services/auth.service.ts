import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reviewer } from '@/entities';
import { Locale } from '@/enums';
import { IJwtPayload, ILoginResult } from '@/interfaces';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Reviewer)
    private readonly reviewers: Repository<Reviewer>,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Simulated login: resolves the reviewer for (reviewerId, locale), lazily
   * creating the row on first sight, then issues a signed JWT carrying the
   * locale so every downstream request is locale-scoped.
   *
   * A reviewer id is treated as locale-specific (the same id under a different
   * locale is upserted to the new locale) which keeps the demo friction-free.
   */
  async login(reviewerId: string, locale: Locale): Promise<ILoginResult> {
    let reviewer = await this.reviewers.findOne({ where: { reviewerId } });

    if (!reviewer) {
      reviewer = this.reviewers.create({ reviewerId, locale });
      await this.reviewers.save(reviewer);
    } else if (reviewer.locale !== locale) {
      reviewer.locale = locale;
      await this.reviewers.save(reviewer);
    }

    const payload: IJwtPayload = {
      sub: reviewer.id,
      reviewerId: reviewer.reviewerId,
      locale: reviewer.locale,
    };

    return {
      accessToken: await this.jwt.signAsync(payload),
      reviewer: { reviewerId: reviewer.reviewerId, locale: reviewer.locale },
    };
  }
}
