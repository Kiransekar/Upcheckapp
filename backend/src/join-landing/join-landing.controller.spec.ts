/**
 * The public invite landing page (W4-A).
 *
 * Two things are load-bearing and neither is cosmetic:
 *
 *  1. **It must not become a farm-name enumerator.** It names the farm for a
 *     live code — no new disclosure, since anyone holding that code can redeem
 *     it — but an unusable code gets a GENERIC page. Telling "no such code"
 *     apart from "that farm's code expired" would confirm which codes exist,
 *     eight characters at a time.
 *  2. **It must never emit unescaped input.** The farm name is farmer-supplied
 *     text going into an HTML document served from our own origin.
 */
import { JoinLandingController } from './join-landing.controller';

const LIVE_INVITE = {
  id: 'invite-1',
  farmId: 'farm-1',
  code: 'ABCD2345',
  role: 'worker',
  expiresAt: new Date(Date.now() + 3600_000),
  maxUses: 1,
  usedCount: 0,
  revokedAt: null,
};

const build = (over: { invite?: any; farm?: any } = {}) => {
  const invitesRepo = {
    findOne: jest
      .fn()
      .mockResolvedValue(over.invite === undefined ? LIVE_INVITE : over.invite),
  };
  const farmsRepo = {
    findOne: jest.fn().mockResolvedValue(
      over.farm === undefined
        ? { id: 'farm-1', name: 'Kakinada East', deletedAt: null }
        : over.farm,
    ),
  };
  return {
    controller: new JoinLandingController(invitesRepo as any, farmsRepo as any),
    invitesRepo,
  };
};

describe('JoinLandingController', () => {
  it('names the farm and shows the code for a live invite', async () => {
    const { controller } = build();

    const html = await controller.page('ABCD2345');

    expect(html).toContain('Kakinada East');
    expect(html).toContain('ABCD2345');
    // The point of the page for someone who does not have the app yet.
    expect(html).toContain('play.google.com');
  });

  it('normalises a code a messaging app mangled', async () => {
    const { controller, invitesRepo } = build();

    await controller.page('abcd-2345');

    expect(invitesRepo.findOne).toHaveBeenCalledWith({
      where: { code: 'ABCD2345' },
    });
  });

  /**
   * Each of these is a DIFFERENT reason the code will not work, and the page
   * says the same thing for all of them on purpose.
   */
  it.each([
    ['unknown', { invite: null }],
    ['revoked', { invite: { ...LIVE_INVITE, revokedAt: new Date() } }],
    ['expired', { invite: { ...LIVE_INVITE, expiresAt: new Date(Date.now() - 1000) } }],
    ['exhausted', { invite: { ...LIVE_INVITE, maxUses: 1, usedCount: 1 } }],
    ['for a deleted farm', { farm: { id: 'farm-1', name: 'Gone', deletedAt: new Date() } }],
  ])('gives a generic page for a code that is %s', async (_label, over) => {
    const { controller } = build(over as any);

    const html = await controller.page('ABCD2345');

    expect(html).toContain('Join a farm on Neerani');
    expect(html).not.toContain('Kakinada East');
    expect(html).not.toContain('Gone');
    // Still offers the install and still shows the code: the farmer may be
    // holding a fine code and a stale page, and a dead end helps nobody.
    expect(html).toContain('play.google.com');
  });

  it('escapes a farm name rather than emitting it as markup', async () => {
    const { controller } = build({
      farm: {
        id: 'farm-1',
        name: '<script>alert(1)</script>',
        deletedAt: null,
      },
    });

    const html = await controller.page('ABCD2345');

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('does not query at all for a code of the wrong length', async () => {
    const { controller, invitesRepo } = build();

    const html = await controller.page('SHORT');

    expect(invitesRepo.findOne).not.toHaveBeenCalled();
    expect(html).toContain('Join a farm on Neerani');
  });

  it('serves the generic page rather than a 500 when the lookup throws', async () => {
    // Deploy-before-migrate, or a database wobble. Someone standing in a field
    // with a link must never see a stack trace.
    const { controller, invitesRepo } = build();
    invitesRepo.findOne.mockRejectedValue(new Error('relation does not exist'));

    await expect(controller.page('ABCD2345')).resolves.toContain(
      'Join a farm on Neerani',
    );
  });
});
