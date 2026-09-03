import {
  classifyZone,
  zoneStatus,
  evaluateParameter,
  getThreshold,
  nighttimeDoAlarm,
  toThresholdSpecies,
  FiveZoneThreshold,
} from '../waterQualityThresholds'

describe('toThresholdSpecies', () => {
  it('maps common species names', () => {
    expect(toThresholdSpecies('Penaeus monodon')).toBe('monodon')
    expect(toThresholdSpecies('Black Tiger')).toBe('monodon')
    expect(toThresholdSpecies('P. indicus')).toBe('indicus')
    expect(toThresholdSpecies('Macrobrachium rosenbergii (scampi)')).toBe('scampi')
    expect(toThresholdSpecies('Litopenaeus vannamei')).toBe('vannamei')
    // The typo that is actually in production still resolves — it contains
    // the name — which is why "unknown" has to mean something else.
    expect(toThresholdSpecies('VannameiVannamei')).toBe('vannamei')
  })

  it('answers null for a species it does not know, instead of guessing vannamei', () => {
    expect(toThresholdSpecies('banana')).toBeNull()
    expect(toThresholdSpecies('')).toBeNull()
    expect(toThresholdSpecies(undefined)).toBeNull()
  })
})

describe('classifyZone', () => {
  const ph: FiveZoneThreshold = {
    criticalLow: 7.0,
    cautionLow: 7.5,
    cautionHigh: 8.5,
    criticalHigh: 9.0,
  }

  it('classifies all five zones for a two-sided parameter', () => {
    expect(classifyZone(6.8, ph)).toBe('critical-low')
    expect(classifyZone(7.2, ph)).toBe('caution-low')
    expect(classifyZone(8.0, ph)).toBe('optimal')
    expect(classifyZone(8.8, ph)).toBe('caution-high')
    expect(classifyZone(9.5, ph)).toBe('critical-high')
  })

  it('treats boundaries as inclusive on the optimal side', () => {
    expect(classifyZone(7.5, ph)).toBe('optimal') // == cautionLow
    expect(classifyZone(8.5, ph)).toBe('optimal') // == cautionHigh
  })

  it('omits low zones for a one-sided high parameter (ammonia)', () => {
    const nh3: FiveZoneThreshold = { cautionHigh: 0.1, criticalHigh: 0.5 }
    expect(classifyZone(0, nh3)).toBe('optimal')
    expect(classifyZone(0.2, nh3)).toBe('caution-high')
    expect(classifyZone(0.9, nh3)).toBe('critical-high')
  })

  it('omits high zones for a one-sided low parameter (DO)', () => {
    const dox = getThreshold('vannamei', 'do')
    expect(classifyZone(2, dox)).toBe('critical-low')
    expect(classifyZone(3.5, dox)).toBe('caution-low')
    expect(classifyZone(7, dox)).toBe('optimal')
  })
})

describe('zoneStatus', () => {
  it('maps zones to traffic-light status', () => {
    expect(zoneStatus('optimal')).toBe('safe')
    expect(zoneStatus('caution-low')).toBe('warning')
    expect(zoneStatus('caution-high')).toBe('warning')
    expect(zoneStatus('critical-low')).toBe('critical')
    expect(zoneStatus('critical-high')).toBe('critical')
  })
})

describe('evaluateParameter', () => {
  it('returns none for missing values', () => {
    expect(evaluateParameter('vannamei', 'ph', null)).toEqual({ zone: null, status: 'none' })
    expect(evaluateParameter('vannamei', 'ph', undefined)).toEqual({ zone: null, status: 'none' })
    expect(evaluateParameter('vannamei', 'ph', NaN)).toEqual({ zone: null, status: 'none' })
  })

  it('evaluates a value against the species threshold', () => {
    expect(evaluateParameter('vannamei', 'ph', 8.0)).toEqual({ zone: 'optimal', status: 'safe' })
    expect(evaluateParameter('vannamei', 'do', 2.5)).toEqual({
      zone: 'critical-low',
      status: 'critical',
    })
  })

  it('applies species-specific salinity tolerance', () => {
    // 30 ppt: optimal for monodon (wider band) but caution-high for vannamei.
    expect(evaluateParameter('vannamei', 'salinity', 30).status).toBe('warning')
    expect(evaluateParameter('monodon', 'salinity', 30).status).toBe('safe')
  })

  it('treats scampi as a freshwater species for salinity', () => {
    expect(evaluateParameter('scampi', 'salinity', 20).status).toBe('critical')
    expect(evaluateParameter('scampi', 'salinity', 2).status).toBe('safe')
  })
})

describe('nighttimeDoAlarm', () => {
  it('fires when a night reading is below the caution-low DO floor', () => {
    expect(nighttimeDoAlarm({ dissolvedOxygen: 3.5, hour: 3 })).toBe(true)
    expect(nighttimeDoAlarm({ dissolvedOxygen: 3.5, hour: 23 })).toBe(true)
  })

  it('does not fire during the day', () => {
    expect(nighttimeDoAlarm({ dissolvedOxygen: 3.5, hour: 14 })).toBe(false)
  })

  it('does not fire when night DO is healthy', () => {
    expect(nighttimeDoAlarm({ dissolvedOxygen: 6, hour: 3 })).toBe(false)
  })
})
