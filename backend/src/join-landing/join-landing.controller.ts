import { Controller, Get, Header, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Public } from '../auth/decorators/auth.decorators';
import { FarmInvite, inviteRejection } from '../farm-members/farm-invite.entity';
import { Farm } from '../farms/farm.entity';
import { renderJoinPage } from './join-landing.html';

/**
 * The public landing page an invite link points at (W4-A).
 *
 * The share text used to read "Or tap: `upcheckapp://join/CODE`" — a CUSTOM
 * SCHEME, and `linking.ts` registers only that prefix. WhatsApp does not
 * linkify custom schemes, so for the farmer receiving it the line was dead
 * text; and a recipient who does not have the app yet got nothing at all — no
 * web page, no Play Store link, and no way to carry the code through an
 * install. The invite loop simply ended there.
 *
 * The design puts this on the `upcheck.in` apex, served by the Vercel project.
 * That project is not reachable right now, so it is served from the API host
 * instead — same URL shape, same page, and the only thing that changes when
 * Vercel comes back is which host the link names.
 *
 * ── What this page may and may not say ────────────────────────────────────
 * It names the FARM for a valid code. That is not a new disclosure: anyone
 * holding a live code can already redeem it and see the farm from inside. But
 * it must not become a farm-name enumerator, so:
 *   • the same 5/min brute-force budget the redeem endpoint uses;
 *   • an invalid, expired, revoked or spent code gets a GENERIC page — never
 *     "no such farm" vs "that farm's code expired", which would confirm which
 *     codes exist.
 * It never reveals who is in the farm, and it grants nothing: joining still
 * goes through the authenticated redeem endpoint, inside the app.
 */
const JOIN_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

@Controller()
export class JoinLandingController {
  constructor(
    @InjectRepository(FarmInvite)
    private readonly invitesRepo: Repository<FarmInvite>,
    @InjectRepository(Farm)
    private readonly farmsRepo: Repository<Farm>,
  ) {}

  @Public()
  @Throttle(JOIN_THROTTLE)
  @Get('join/:code')
  @Header('Content-Type', 'text/html; charset=utf-8')
  // No caching: an invite can be revoked at any moment, and a CDN holding a
  // "come and join" page for a dead code is worse than a slow one.
  @Header('Cache-Control', 'no-store')
  async page(@Param('code') rawCode: string): Promise<string> {
    // Same normalisation the app does: a messaging client may lower-case the
    // link, and the invite alphabet excludes I/O/0/1.
    const code = (rawCode ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8);

    const farmName = await this.resolveFarmName(code);
    return renderJoinPage({ code, farmName });
  }

  /**
   * The farm this code opens, or null for anything not currently usable.
   *
   * Fails soft in every direction: a missing table (deploy-before-migrate) or
   * a database wobble yields the generic page rather than a 500. Someone
   * standing in a field with a link should never see a stack trace.
   */
  private async resolveFarmName(code: string): Promise<string | null> {
    if (code.length !== 8) return null;
    try {
      const invite = await this.invitesRepo.findOne({ where: { code } });
      if (inviteRejection(invite, new Date()) !== null) return null;
      const farm = await this.farmsRepo.findOne({
        where: { id: invite!.farmId },
      });
      return farm && !farm.deletedAt ? farm.name : null;
    } catch {
      return null;
    }
  }
}
