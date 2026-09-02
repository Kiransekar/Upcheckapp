import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ShrimpCalculationsService } from './shrimp-calculations.service';
import { ShrimpCalculationsController } from './shrimp-calculations.controller';
import { FreeAmmoniaDto } from './dto/advanced-calculations.dto';

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

/**
 * QA BUG-004. recommended-feeding-rate typed its query param as `number`, but
 * Nest passes query strings through as strings, so the type was decorative.
 * Number('abc') is NaN, every `<` rung of the step table was false, and
 * control fell to the unconditional tail `return 1.8`. Empty string became 0
 * and matched the post-larvae bucket, returning 10. Both came back HTTP 200
 * as confident advice.
 */
describe('recommended-feeding-rate — rejects junk instead of answering it', () => {
  let controller: ShrimpCalculationsController;
  let calculationsService: any;

  beforeEach(() => {
    calculationsService = {
      getRecommendedFeedingRate: jest.fn().mockReturnValue(3.2),
    };
    controller = new ShrimpCalculationsController(calculationsService);
  });

  it('rejects a non-numeric averageWeightG instead of falling through to 1.8', () => {
    expect(() => controller.getRecommendedFeedingRate('abc')).toThrow(
      BadRequestException,
    );
  });

  it('rejects an empty averageWeightG instead of matching the post-larvae bucket', () => {
    expect(() => controller.getRecommendedFeedingRate('')).toThrow(
      BadRequestException,
    );
  });

  it('rejects a negative averageWeightG', () => {
    expect(() => controller.getRecommendedFeedingRate('-5')).toThrow(
      BadRequestException,
    );
  });

  it('passes a valid averageWeightG through to the service', () => {
    const result = controller.getRecommendedFeedingRate('15');
    expect(result).toEqual({ recommendedFeedingRatePercent: 3.2 });
  });
});

/**
 * QA BUG-007. FreeAmmoniaDto.ph had @Min(0) but no @Max, so pH 20 validated
 * and computed happily. pH is defined on [0, 14].
 */
describe('FreeAmmoniaDto.ph — bounded to the pH scale', () => {
  it('rejects a pH above 14', async () => {
    const dto = plainToInstance(FreeAmmoniaDto, {
      tan: 1,
      ph: 20,
      temperature: 28,
    });
    const errors = await validate(dto);
    const phError = errors.find((e) => e.property === 'ph');
    expect(phError?.constraints).toHaveProperty('max');
  });

  it('accepts a normal pH within range', async () => {
    const dto = plainToInstance(FreeAmmoniaDto, {
      tan: 1,
      ph: 8.2,
      temperature: 28,
    });
    const errors = await validate(dto);
    const phError = errors.find((e) => e.property === 'ph');
    expect(phError).toBeUndefined();
  });
});
