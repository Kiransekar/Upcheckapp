import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeedbackReport } from './feedback.entity';
import { FeedbackStorageService } from './feedback-storage.service';
import { PushService } from '../push/push.service';
import { EmailService } from '../email.service';
import {
  CreateFeedbackDto,
  ListFeedbackDto,
  UpdateFeedbackDto,
} from './dto/feedback.dto';
import type { FeedbackCategory, FeedbackStatus } from './feedback-status';

/**
 * Postgres "undefined_table" (42P01) — same pattern as attendance.service.ts
 * and disease.service.ts. `feedback_reports` is a brand-new table and
 * `migrationsRun` is false, so a deploy-before-migrate window is real. Reads
 * degrade to empty rather than 500ing; writes fail honestly, because there is
 * nowhere safe to put a report the farmer would then believe was sent.
 */
function isMissingTable(err: any): boolean {
  return (err?.code ?? err?.driverError?.code) === '42P01';
}

/** What the app and the dashboard see — the entity plus signed image URLs. */
export interface FeedbackView extends FeedbackReport {
  attachmentUrls: string[];
}

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(
    @InjectRepository(FeedbackReport)
    private readonly repo: Repository<FeedbackReport>,
    private readonly storage: FeedbackStorageService,
    private readonly push: PushService,
    private readonly email: EmailService,
  ) {}

  // ──────────────────────────────── farmer ────────────────────────────────

  async create(userId: string, dto: CreateFeedbackDto): Promise<FeedbackView> {
    const paths = dto.attachmentPaths ?? [];
    this.assertOwnsPaths(userId, paths);

    const report = this.repo.create({
      userId,
      farmId: dto.farmId ?? null,
      category: dto.category as FeedbackCategory,
      subject: dto.subject?.trim() || null,
      message: dto.message.trim(),
      attachmentPaths: paths,
      status: 'new',
    });
    const saved = await this.repo.save(report);

    // Alert the team, or the report sits in a table nobody is watching.
    // Best-effort by the same rule as update()'s push: the farmer was shown a
    // success, so the save must stand whether or not Brevo is up. Logged, not
    // swallowed silently — an outage that costs us every report should be
    // visible somewhere.
    await this.email
      .sendFeedbackAlertEmail({
        id: saved.id,
        userId: saved.userId,
        farmId: saved.farmId,
        category: saved.category,
        subject: saved.subject,
        message: saved.message,
        attachmentCount: paths.length,
      })
      .catch((err) =>
        this.logger.error(
          `Feedback alert email failed for report ${saved.id}: ${err?.message}`,
        ),
      );

    return this.withUrls(saved);
  }

  /** Every report this user has sent, newest first. */
  async findMine(userId: string): Promise<FeedbackView[]> {
    try {
      const rows = await this.repo.find({
        where: { userId },
        order: { createdAt: 'DESC' },
      });
      // The list does not sign attachments: it renders a paperclip count, not
      // thumbnails, so signing N reports × 3 images on every pull-to-refresh
      // would be a round trip to Storage for pixels nobody looks at.
      return rows.map((r) => ({ ...r, attachmentUrls: [] }));
    } catch (err) {
      if (isMissingTable(err)) {
        this.logger.warn('feedback_reports is missing — returning no reports.');
        return [];
      }
      throw err;
    }
  }

  /**
   * One report of the caller's own.
   *
   * Scoped by userId in the WHERE clause, not fetched-then-checked: a report
   * belonging to someone else is a 404, not a 403, so this endpoint cannot be
   * used to probe which ids exist.
   */
  async findOneMine(userId: string, id: string): Promise<FeedbackView> {
    const report = await this.repo
      .findOne({ where: { id, userId } })
      .catch((err) => {
        if (isMissingTable(err)) return null;
        throw err;
      });
    if (!report) throw new NotFoundException('Report not found');
    return this.withUrls(report);
  }

  // ───────────────────────────────── admin ────────────────────────────────

  async findAll(query: ListFeedbackDto): Promise<FeedbackView[]> {
    try {
      const where: Record<string, unknown> = {};
      if (query.status) where.status = query.status;
      if (query.category) where.category = query.category;

      const rows = await this.repo.find({
        where,
        order: { createdAt: 'DESC' },
        take: query.limit ?? 50,
        skip: query.offset ?? 0,
      });
      return rows.map((r) => ({ ...r, attachmentUrls: [] }));
    } catch (err) {
      if (isMissingTable(err)) {
        this.logger.warn('feedback_reports is missing — returning no reports.');
        return [];
      }
      throw err;
    }
  }

  async findOneAsAdmin(id: string): Promise<FeedbackView> {
    const report = await this.repo.findOne({ where: { id } }).catch((err) => {
      if (isMissingTable(err)) return null;
      throw err;
    });
    if (!report) throw new NotFoundException('Report not found');
    return this.withUrls(report);
  }

  /**
   * Set status and/or write or edit the response.
   *
   * One rule is enforced here rather than left to the dashboard: a report that
   * carries a reply cannot still be `new`. Staff replying straight from the
   * inbox without touching the status dropdown is the normal case, and the
   * farmer seeing "Not seen yet" above a message from the team is the kind of
   * small nonsense that makes people stop trusting the feature.
   */
  async update(id: string, dto: UpdateFeedbackDto): Promise<FeedbackView> {
    const report = await this.repo.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');

    if (dto.status) report.status = dto.status as FeedbackStatus;

    // Only a non-empty response counts as "written" for notification purposes
    // — a status-only PATCH, or one that clears the response, must not push.
    let wroteResponse = false;
    if (dto.adminResponse !== undefined) {
      const text = dto.adminResponse.trim();
      report.adminResponse = text || null;
      // Editing an existing reply re-stamps the time — the farmer is being
      // shown the current text, so the timestamp must describe that text.
      report.respondedAt = text ? new Date() : null;
      report.respondedBy = text ? (dto.respondedBy?.trim() ?? null) : null;
      if (text && report.status === 'new') report.status = 'in_review';
      wroteResponse = !!text;
    }

    const saved = await this.repo.save(report);

    // Tell the farmer, rather than making them reopen the report to find out.
    // Best-effort by design: sendToUser never throws into its caller, and an
    // admin's reply must save whether or not delivery succeeds.
    if (wroteResponse) {
      await this.push
        .sendToUser(saved.userId, {
          title: 'Support replied to your report',
          body: 'Tap to read the reply.',
          data: { type: 'feedback_reply', reportId: saved.id },
        })
        .catch(() => undefined);
    }

    return this.withUrls(saved);
  }

  // ──────────────────────────────── helpers ───────────────────────────────

  /**
   * Attachment paths come back from the client on create, so re-check they are
   * inside this user's own folder. Without this a farmer could quote another
   * farmer's storage path in their own report and read the photo back through
   * the signed URL on their own detail screen.
   */
  private assertOwnsPaths(userId: string, paths: string[]): void {
    const prefix = `${userId}/`;
    if (paths.some((p) => !p.startsWith(prefix) || p.includes('..'))) {
      throw new ForbiddenException('Attachment does not belong to you');
    }
  }

  private async withUrls(report: FeedbackReport): Promise<FeedbackView> {
    return {
      ...report,
      attachmentUrls: await this.storage.signAttachments(
        report.attachmentPaths ?? [],
      ),
    };
  }
}
