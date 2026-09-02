// theme/colorRoles.ts
export const light = {
    // Backgrounds
    background: '#F5F8FA', // main page background
    surface: '#FFFFFF', // card / sheet surface
    surfaceVariant: '#EEF2F5', // secondary surface (input bg)
    surfaceOverlay: 'rgba(11, 109, 199, 0.04)', // branded tint on white

    // Borders
    borderDefault: '#E0E8EC',
    borderStrong: '#C8D4DA',
    borderBrand: '#0EA8D8',

    // Text
    textPrimary: '#1A222B',
    textSecondary: '#3E5163',
    textTertiary: '#5C6F7E',
    textDisabled: '#A3B5BF',
    textInverse: '#FFFFFF',
    textBrand: '#0B6DC7',
    textLink: '#0D84D6',

    // Interactive
    primary: '#0D84D6',
    primaryHover: '#0B6DC7',
    primaryPressed: '#08508F',
    primaryDisabled: '#A3B5BF',

    // Status
    successText: '#1A6B3A',
    successBg: '#EAF7EE',
    successBorder: '#27A855',
    warningText: '#8A4700',
    warningBg: '#FEF6E4',
    warningBorder: '#F08C00',
    dangerText: '#A41B1B',
    dangerBg: '#FDF0F0',
    dangerBorder: '#E03535',
    infoText: '#0B4F8A',
    infoBg: '#EBF4FD',
    infoBorder: '#1A7FD4',
};
// ponytail: dark palette removed — was exported but never rendered (no useColorScheme
// hook, all 118 screens hardcode roles.light, StatusBar fixed dark-content). Re-add
// alongside a real useTheme()/useColorScheme() wire-up if dark mode ships.
