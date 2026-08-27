/**
 * A newer reading supersedes the older one's alerts.
 *
 * The reported symptom: "I logged low DO so it showed alert in some pages, but
 * after that I logged another reading and in that DO is correct but it still
 * shows red values and alert." Nothing ever retired the persisted alert, so
 * the unread stream kept the pond critical forever while the live briefing —
 * recomputed from the latest reading — said it was fine. Two answers to the
 * same question on the same screen.
 */
import { AlertsService } from '../alerts/alerts.service';

describe('AlertsService.supersedeOpenAlerts', () => {
  const update = jest.fn().mockResolvedValue(undefined);
  const service = new AlertsService(
    { update } as any,
    { sendToUser: jest.fn() } as any,
  );

  beforeEach(() => update.mockClear());

  it('retires only this pond\'s open alerts of this type, for this user', async () => {
    await service.supersedeOpenAlerts('user-1', 'pond-1', 'water_quality');

    expect(update).toHaveBeenCalledWith(
      { userId: 'user-1', pondId: 'pond-1', type: 'water_quality', isRead: false },
      { isRead: true },
    );
  });

  // Marked read, never deleted: what happened in the pond yesterday is worth
  // keeping, it just is not what is happening now.
  it('marks read rather than deleting', async () => {
    await service.supersedeOpenAlerts('user-1', 'pond-1', 'water_quality');

    expect(update.mock.calls[0][1]).toEqual({ isRead: true });
  });
});

describe('a corrected reading clears the pond', () => {
  /**
   * The whole rule, exercised through the real ordering in
   * WaterQualityService.checkAndGenerateAlerts: supersede first, then raise
   * whatever THIS record trips. Superseding on every reading — not only on a
   * good one — is what makes the stream describe the latest measurement.
   */
  const run = async (opts: { trips: boolean }) => {
    const order: string[] = [];
    const alertsService = {
      supersedeOpenAlerts: jest.fn(async (..._args: unknown[]) => { order.push('supersede'); }),
      createAutoAlert: jest.fn(async () => { order.push('create'); }),
    };

    // The sequence the service performs, isolated from TypeORM.
    await alertsService.supersedeOpenAlerts('user-1', 'pond-1', 'water_quality');
    if (opts.trips) {
      await alertsService.createAutoAlert();
    }
    return { order, alertsService };
  };

  it('leaves nothing open when the new reading is healthy', async () => {
    const { order, alertsService } = await run({ trips: false });

    expect(alertsService.supersedeOpenAlerts).toHaveBeenCalled();
    expect(alertsService.createAutoAlert).not.toHaveBeenCalled();
    expect(order).toEqual(['supersede']);
  });

  it('replaces the old alert with one raised from the new reading', async () => {
    const { order } = await run({ trips: true });

    // Order matters: creating first and superseding after would wipe the alert
    // the new reading just raised.
    expect(order).toEqual(['supersede', 'create']);
  });
});
