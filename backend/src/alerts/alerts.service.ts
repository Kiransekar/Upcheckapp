import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alert } from './alert.entity';
import { CreateAlertDto } from './dto/create-alert.dto';
import { PushService } from '../push/push.service';

@Injectable()
export class AlertsService {
  constructor(
    @InjectRepository(Alert)
    private alertsRepository: Repository<Alert>,
    private pushService: PushService,
  ) {}

  create(createDto: CreateAlertDto) {
    const alert = this.alertsRepository.create(createDto);
    return this.alertsRepository.save(alert);
  }

  /**
   * Retire a pond's open alerts of one type, because a newer measurement has
   * replaced the one they were raised from.
   *
   * An alert about a reading is only true until the next reading. Nothing used
   * to retire them, so a low-oxygen alert survived the aeration that fixed it
   * and every screen built on the unread stream kept the pond red — while the
   * live briefing, recomputed from the latest data, said it was fine. Two
   * answers to the same question on the same screen.
   *
   * Marked read rather than deleted: what happened in the pond yesterday is
   * worth keeping, it just is not what is happening now.
   */
  async supersedeOpenAlerts(userId: string, pondId: string, type: string) {
    await this.alertsRepository.update(
      { userId, pondId, type, isRead: false },
      { isRead: true },
    );
  }

  async createAutoAlert(
    userId: string,
    farmId: string,
    type: string,
    title: string,
    message: string,
    severity: 'info' | 'warning' | 'critical' = 'info',
    data?: Record<string, any>,
    pondId?: string,
  ) {
    const alert = this.alertsRepository.create({
      userId,
      farmId,
      type,
      title,
      message,
      severity,
      data,
      pondId,
      isRead: false,
      isPushSent: false,
    });
    const saved = await this.alertsRepository.save(alert);

    // Best-effort Expo push to the owner; reflect the outcome on the row.
    const pushed = await this.pushService.sendToUser(userId, {
      title,
      body: message,
      data: { alertId: saved.id, type, ...(data ?? {}) },
    });
    if (pushed) {
      saved.isPushSent = true;
      await this.alertsRepository.update(saved.id, { isPushSent: true });
    }
    return saved;
  }

  findByUser(userId: string, unreadOnly = false) {
    const where: any = { userId };
    if (unreadOnly) where.isRead = false;
    return this.alertsRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Alert> {
    const alert = await this.alertsRepository.findOneBy({ id });
    if (!alert) throw new NotFoundException(`Alert with ID ${id} not found`);
    return alert;
  }

  async findOneForUser(id: string, userId: string): Promise<Alert> {
    const alert = await this.findOne(id);
    if (alert.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to access this alert',
      );
    }
    return alert;
  }

  async markAsRead(id: string) {
    await this.findOne(id);
    await this.alertsRepository.update(id, { isRead: true });
    return this.findOne(id);
  }

  async markAsReadForUser(id: string, userId: string) {
    await this.findOneForUser(id, userId);
    await this.alertsRepository.update(id, { isRead: true });
    return this.findOne(id);
  }

  async markAllAsRead(userId: string) {
    await this.alertsRepository.update(
      { userId, isRead: false },
      { isRead: true },
    );
    return { success: true };
  }

  async remove(id: string): Promise<{ message: string }> {
    await this.findOne(id);
    await this.alertsRepository.delete(id);
    return { message: 'Alert deleted successfully' };
  }

  async removeForUser(
    id: string,
    userId: string,
  ): Promise<{ message: string }> {
    await this.findOneForUser(id, userId);
    await this.alertsRepository.delete(id);
    return { message: 'Alert deleted successfully' };
  }

  async getUnreadCount(userId: string) {
    return this.alertsRepository.count({ where: { userId, isRead: false } });
  }
}
