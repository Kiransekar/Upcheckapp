import { ShrimpCalculationsService } from './shrimp-calculations.service';

/**
 * QA BUG-001. The service used to band the RAW double and round afterwards, so
 * two inputs whose results both PRINT as 0.1000 could land in opposite bands —
 * and the SAFE copy then claimed "< 0.1 ppm" directly beneath the figure
 * 0.1000. The rule now: round once, classify what the farmer is shown.
 *
 * Band rule, matching the on-screen legend: >0.5 critical, >=0.1 warning.
 */
describe('calculateFreeAmmonia — band boundaries', () => {
  const svc = new ShrimpCalculationsService();

  // The exact pair from the QA report, at the salinity the screen sends.
  it('gives the same band to two inputs that print the same value', () => {
    const low = svc.calculateFreeAmmonia(1.032, 8.2, 29, 15);
    const high = svc.calculateFreeAmmonia(1.0323, 8.2, 29, 15);

    expect(low.unionizedAmmonia).toBe(0.1);
    expect(high.unionizedAmmonia).toBe(0.1);
    expect(low.toxicityLevel).toBe(high.toxicityLevel);
  });

  it('places a displayed 0.1000 in WARNING, as the legend promises', () => {
    const r = svc.calculateFreeAmmonia(1.032, 8.2, 29, 15);
    expect(r.unionizedAmmonia).toBe(0.1);
    expect(r.toxicityLevel).toBe('warning');
  });

  // Both sides of both boundaries, so a future edit cannot slide either one.
  it('bands just below 0.1 as safe', () => {
    const r = svc.calculateFreeAmmonia(1.03, 8.2, 29, 15);
    expect(r.unionizedAmmonia).toBeLessThan(0.1);
    expect(r.toxicityLevel).toBe('safe');
  });

  it('bands just above 0.5 as critical and 0.5 itself as warning', () => {
    expect(svc.calculateFreeAmmonia(2, 8, 30, 0).toxicityLevel).toBe('warning');
    expect(svc.calculateFreeAmmonia(8, 9, 32, 0).toxicityLevel).toBe('critical');
  });
});

/**
 * QA BUG-008. CalculateSurvivalRateDto:32 documents a 100% clamp as the reason
 * harvestedCount carries no @Max. The clamp was never implemented, so the guard
 * lived nowhere and 150000 of 100000 returned 150%.
 */
describe('calculateSurvivalRate — clamp', () => {
  const svc = new ShrimpCalculationsService();

  it('clamps an overshoot to 100 rather than reporting an impossible rate', () => {
    expect(svc.calculateSurvivalRate(100_000, 150_000)).toBe(100);
    expect(svc.calculateSurvivalRate(1_000, 999_999)).toBe(100);
  });

  it('leaves a normal rate untouched', () => {
    expect(svc.calculateSurvivalRate(100_000, 80_000)).toBe(80);
  });

  it('still returns 0 for an unstocked pond', () => {
    expect(svc.calculateSurvivalRate(0, 500)).toBe(0);
  });
});
