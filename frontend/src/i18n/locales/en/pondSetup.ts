const pondSetup = {
  stepCounter: 'Pond {{current}} of {{total}}',
  finishLater: 'Finish later',

  sectionPond: 'Pond details',
  whyPond: 'Shape and size let us calculate area, stocking capacity, and dosage amounts for you.',
  sectionCulture: 'Culture details',
  whyCulture: 'Species, stocking date and density drive every growth, feed, and harvest-timing recommendation the app gives you for this pond.',
  sectionAeration: 'Aeration',
  whyAeration: 'Optional, but the Aeration engine uses this to check adequacy and estimate power cost — you can skip it and add it later.',

  fieldName: 'Pond name',
  placeholderName: 'e.g. A1',

  fieldGeometry: 'Pond shape',
  geom_rectangular: 'Rectangular',
  geom_circular: 'Circular',
  geom_raceway: 'Raceway',

  fieldDiameter: 'Diameter (m)',
  fieldLength: 'Length (m)',
  fieldWidth: 'Width (m)',
  fieldDepth: 'Depth (m)',
  areaPreview: 'Area: {{area}} m²',

  fieldSpecies: 'Species',
  selectSpecies: 'Select species',
  fieldStrain: 'Strain / line',
  selectStrain: 'Select strain',
  fieldHatchery: 'Seed sourced from (hatchery)',
  selectHatchery: 'Select hatchery',

  fieldDensity: 'Stocking density (PL/m²)',
  placeholderDensity: 'e.g. 40',
  densityHint: 'Post-larvae stocked per square metre',

  fieldStartDate: 'Start of culture',
  docHelper: 'Day {{day}} of culture today',

  fieldAeratorCount: 'No. of aerators',
  fieldHpPerAerator: 'HP per aerator',
  totalHp: 'Total installed: {{hp}} HP',

  cropSuffix: 'Cycle 1',
  saveAndNext: 'Save & continue',
  finishSetup: 'Finish setup',

  // Validation
  errName: 'Enter an alphanumeric pond name',
  errDiameter: 'Diameter must be 1–400 m',
  errLength: 'Length must be 1–500 m',
  errWidth: 'Width must be 1–500 m',
  errDepth: 'Depth must be 0.5–5.0 m',
  errArea: 'Pond area must be between 10 and 50,000 m²',
  errSpecies: 'Select a species',
  errStrain: 'Select a strain',
  errHatchery: 'Select a hatchery',
  errDensity: 'Enter a valid stocking density',
  errAerator: 'Enter a valid number',
  errHp: 'Enter HP per aerator',
  errSave: "Couldn't save this pond. Please try again.",

  // Pond naming, step 2 of 2 (artboard 06)
  stepPondsTitle: "Your ponds",
  namePattern: "Name pattern",
  prefixPlaceholder: "prefix",
  namesLabel: "Names",
  pondsToCreate: "Ponds to create",

  pondNameLabel: "Pond name",


  pondNamePlaceholder: "e.g. North pond",


  errPondName: "Give every pond a name",


  moreDetails: "Add more details (optional)",


  moreDetailsHint: "Leave this shut and we will assume an earthen pond of no fixed shape. The pond page will tell you those are not confirmed.",


  stockedToggle: "Any of these ponds already stocked? (optional)",


  stockedHint: "Tell us and the app can start showing growth, feed use and profit for that pond. Leave it blank to add later.",


  stockedDateLabel: "Stocking date",


  stockedDatePlaceholder: "YYYY-MM-DD",


  stockedCountLabel: "Seed count",


  stockedCountPlaceholder: "PL count",


  firstCycleName: "{{pond}} — first cycle",


  errCyclesPartial: "Your ponds were created. {{count}} cycle(s) could not be started — you can start them from the pond page.",
  areaPlaceholder: "area m²",
  areaOptionalNote: "Area is optional now. You can add it when you stock a pond.",
  createFarmCta: "Create farm",
  errPrefix: "Use 1–4 letters or numbers",
  errPondsPartial: "Farm created, but {{count}} pond(s) could not be added. Add them from the farm screen.",
};
export default pondSetup;
