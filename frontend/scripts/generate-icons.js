// Regenerates every app-icon asset from the original shrimp mark, inverted:
// gradient background in the shrimp's own blues, shrimp knocked out in white.
// The eye dot and segment separators were white in the source, so they invert
// to gradient-blue for free.
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SVG = path.join(ROOT, 'assets/Icon.svg');
const RES = path.join(ROOT, 'android/app/src/main/res');
// Icon.svg is 1440x810; rendering it 'contain' onto a 1024 white square is how
// the original mark was produced, and these are the shrimp's bounds in it.
const mark = sharp(SVG).resize(1024, 1024, { fit: 'contain', background: '#ffffff' }).png().toBuffer();
const BBOX = { left: 369, top: 343, width: 291, height: 282 }; // measured shrimp extent
const C1 = '#02C1E3', C2 = '#007CBC'; // sampled gradient endpoints of the original mark
// Android draws the small icon inside a tinted circular badge and masks it by
// alpha, so the glyph has to be solid and sit inside that circle's safe area.
// The old mark covered 14% of the canvas in hairlines — at 24dp it vanished and
// only the badge circle was visible.
const NOTIF_SCALE = 0.72;

// Shrimp coverage as straight RGBA: white everywhere, alpha from the negated red
// channel. Source red is 255 on the white ground and ~0 across the blue mark, so
// that one channel is already a clean anti-aliased coverage mask.
const shrimpRGBA = (async () => {
  const red = await sharp(await mark).extract(BBOX).extractChannel('red').raw().toBuffer();
  const rgba = Buffer.alloc(red.length * 4, 0xff);
  for (let i = 0; i < red.length; i++) rgba[i * 4 + 3] = 255 - red[i];
  return rgba;
})();

const gradient = (size, [a, b] = [C1, C2]) => Buffer.from(
  `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
     <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
       <stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/>
     </linearGradient></defs>
     <rect width="${size}" height="${size}" fill="url(#g)"/>
   </svg>`);

const circleMask = (size) => Buffer.from(
  `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`);

const blank = (size) => sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });

// White shrimp sized to `scale` of a `size` canvas, centred (optionally nudged by
// a fraction of the canvas to clear a badge), transparent elsewhere.
async function whiteShrimp(size, scale, nudge = 0) {
  const shrimp = await sharp(await shrimpRGBA, { raw: { width: BBOX.width, height: BBOX.height, channels: 4 } })
    .resize({ width: Math.round(size * scale) }).png().toBuffer();
  const { width: w, height: h } = await sharp(shrimp).metadata();
  const off = Math.round(size * nudge);
  return blank(size).composite([{
    input: shrimp,
    left: Math.round((size - w) / 2) - off,
    top: Math.round((size - h) / 2) - off,
  }]).png().toBuffer();
}

// Gradient ground + white shrimp. `round` clips to a circle (legacy round launcher).
async function inverted(size, scale, round = false) {
  const layers = [{ input: await whiteShrimp(size, scale) }];
  if (round) layers.push({ input: circleMask(size), blend: 'dest-in' });
  return sharp(gradient(size)).composite(layers).png().toBuffer();
}

const write = (file, buf) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buf);
  console.log('wrote', path.relative(ROOT, file));
};

// ---------------------------------------------------------------------------
// State variants, for swapping the icon by what the farm currently needs.
//
// Each state is a gradient pair plus a corner badge glyph. Colour alone is not
// enough — it is unreadable for colour-blind users and hard to tell apart on a
// crowded home screen — so the glyph carries the meaning and the colour only
// reinforces it. Glyphs are authored in a 100x100 box and stroked heavily so
// they survive the 24dp notification size.
// ---------------------------------------------------------------------------
// Stroke preset. Takes the width rather than letting callers append their own
// `stroke-width` after it — a duplicate attribute is a hard parse error in librsvg.
const S = (w = 12) => `stroke="#000" fill="none" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
const GLYPHS = {
  clock: `<circle cx="50" cy="50" r="36" ${S()}/><path d="M50 28V52h18" ${S()}/>`,
  exclaim: `<path d="M50 20V58" ${S(16)}/><circle cx="50" cy="80" r="9" fill="#000"/>`,
  bulb: `<circle cx="50" cy="40" r="26" fill="#000"/><rect x="37" y="62" width="26" height="10" rx="5" fill="#000"/><rect x="41" y="78" width="18" height="10" rx="5" fill="#000"/>`,
  // An open, stroked bowl with the pellets offset to one side. Filled, with
  // three evenly spaced pellets above it, it read as a smiley face.
  bowl: `<path d="M8 44h84M16 44a34 34 0 0 0 68 0" ${S()}/><circle cx="38" cy="20" r="7" fill="#000"/><circle cx="60" cy="12" r="7" fill="#000"/>`,
  // A tick, not a basket — a handled basket was indistinguishable from a
  // padlock at badge size. Pairs with the rupee: ready to cut, ready to sell.
  tick: `<path d="M18 52l22 24 42-52" ${S(16)}/>`,
  // Rupee, not a price tag — a tag silhouette was near-indistinguishable from
  // the disease shield at badge size.
  rupee: `<path d="M28 20h44M28 42h44M42 20c24 0 24 30 0 30h-8l36 36" ${S(11)}/>`,
  download: `<path d="M50 12v46M28 42l22 22 22-22" ${S(13)}/><path d="M20 84h60" ${S(13)}/>`,
  droplet: `<path d="M50 10c22 28 32 42 32 54a32 32 0 0 1-64 0c0-12 10-26 32-54z" fill="#000"/>`,
  shield: `<path d="M50 10l34 14v28c0 22-16 34-34 40-18-6-34-18-34-40V24z" fill="#000"/>`,
};

// `null` badge = the healthy default, the plain mark with no glyph.
const STATES = {
  healthy: { badge: null, colors: [C1, C2], note: 'all good — default launcher icon' },
  'stale-data': { badge: 'clock', colors: ['#FFB020', '#E07A00'], note: 'no pond data logged for a while' },
  critical: { badge: 'exclaim', colors: ['#FF5A4E', '#D42017'], note: 'critical alert needs attention now' },
  insight: { badge: 'bulb', colors: ['#A78BFA', '#6D3BE0'], note: 'new insight or recommendation' },
  'feeding-overdue': { badge: 'bowl', colors: ['#FF9A3D', '#E2560C'], note: 'not fed for too long' },
  harvest: { badge: 'tick', colors: ['#57D96B', '#10883A'], note: 'harvest window is near' },
  'ready-to-sell': { badge: 'rupee', colors: ['#34E0B0', '#08957A'], note: 'stock ready to sell' },
  'water-quality': { badge: 'droplet', colors: ['#24D3C4', '#056E76'], note: 'DO / pH / salinity excursion' },
  'update-available': { badge: 'download', colors: ['#5B8DEF', '#1E3A8A'], note: 'OTA update ready to install' },
  'disease-risk': { badge: 'shield', colors: ['#C2185B', '#7A0E3A'], note: 'disease risk detected' },
};

// The white plate: shrimp plus a badge disc with the glyph punched out of it,
// on transparency. Everything else is derived from this one shape — the
// launcher tints it over a gradient, the notification drawable ships its alpha
// alone, and the in-app mark fills it with the state colour.
async function plate(size, badge) {
  if (!badge) return whiteShrimp(size, 0.62);
  const r = size * BADGE.r, cx = size * BADGE.cx, cy = size * BADGE.cy;
  const circle = (rad) => Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${cx}" cy="${cy}" r="${rad}" fill="#fff"/></svg>`);
  // 0.56 + a nudge up-left keeps the shrimp clear of the badge it now shares the
  // canvas with; at 0.62 the tail ran straight under the disc. The shrimp is
  // then cut back by a slightly larger circle before the disc lands, leaving a
  // keyline gap — both are white, so without it the badge fuses into the tail.
  const cutBack = await blank(size)
    .composite([{ input: await whiteShrimp(size, 0.56, 0.05) }, { input: circle(r * 1.16), blend: 'dest-out' }])
    .png().toBuffer();
  const withBadge = await sharp(cutBack).composite([{ input: circle(r) }]).png().toBuffer();
  return sharp(withBadge).composite([{ input: glyphLayer(size, badge), blend: 'dest-out' }]).png().toBuffer();
}

// The badge symbol alone, on transparency, positioned to match plate()'s disc.
const BADGE = { r: 0.205, cx: 0.755, cy: 0.755, glyph: 1.25 };
function glyphLayer(size, badge, colour = '#000') {
  const g = size * BADGE.r * BADGE.glyph;
  const art = GLYPHS[badge].replace(/#000/g, colour);
  return Buffer.from(`<svg width="${size}" height="${size}"><g transform="translate(${size * BADGE.cx - g / 2} ${size * BADGE.cy - g / 2}) scale(${g / 100})">${art}</g></svg>`);
}

async function variants() {
  const OUT = path.join(ROOT, 'assets/logo-variants');
  fs.rmSync(OUT, { recursive: true, force: true });
  const index = {};
  for (const [state, { badge, colors, note }] of Object.entries(STATES)) {
    const dir = path.join(OUT, state);
    const full = await plate(1024, badge);
    // Launcher master, and an adaptive foreground with the art pulled into the
    // 66% safe zone the launcher mask can crop to.
    write(path.join(dir, 'icon.png'), await sharp(gradient(1024, colors)).composite([{ input: full }]).png().toBuffer());
    // 512 is plenty: the largest consumer is the 432px xxxhdpi foreground.
    const inset = await sharp(await plate(512, badge)).resize(Math.round(512 * 0.71)).png().toBuffer();
    write(path.join(dir, 'adaptive-foreground.png'),
      await sharp(gradient(512, colors)).composite([{ input: inset, gravity: 'centre' }]).png().toBuffer());
    // In-app mark: the plate filled with the state gradient on transparency, so
    // it sits on the app's light surfaces instead of needing a coloured tile.
    // The glyph is painted white here rather than knocked out, so the mark
    // still reads on a dark surface as well as a light one.
    const tinted = await sharp(gradient(512, colors))
      .composite([{ input: await plate(512, badge), blend: 'dest-in' }]).png().toBuffer();
    write(path.join(dir, 'mark.png'), badge
      ? await sharp(tinted).composite([{ input: glyphLayer(512, badge, '#ffffff') }]).png().toBuffer()
      : tinted);
    // Notification small icons go straight into the native tree: alpha only,
    // tinted at runtime, so the colour above is irrelevant here. The healthy
    // state reuses the existing notification_icon.png rather than duplicating it.
    if (badge) {
      for (const [dpi, px] of [['mdpi', 24], ['hdpi', 36], ['xhdpi', 48], ['xxhdpi', 72], ['xxxhdpi', 96]]) {
        write(path.join(RES, `drawable-${dpi}`, `notification_icon_${state.replace(/-/g, '_')}.png`),
          await sharp(await plate(96, badge)).resize(px).png().toBuffer());
      }
    }
    index[state] = {
      note,
      colors,
      launcher: `assets/logo-variants/${state}/icon.png`,
      adaptiveForeground: `assets/logo-variants/${state}/adaptive-foreground.png`,
      inAppMark: `assets/logo-variants/${state}/mark.png`,
      notificationDrawable: badge ? `notification_icon_${state.replace(/-/g, '_')}` : 'notification_icon',
    };
  }
  write(path.join(OUT, 'index.json'), Buffer.from(JSON.stringify(index, null, 2) + '\n'));
}

(async () => {
  // Expo asset sources. 0.62 fills the tile properly — the original sat at 0.28.
  write(path.join(ROOT, 'assets/icon.png'), await inverted(1024, 0.62));
  write(path.join(ROOT, 'assets/favicon.png'), await inverted(48, 0.68));
  // Adaptive foreground: outer 1/3 can be cropped by the launcher mask, so the
  // shrimp stays inside the 66% safe zone while the gradient runs full bleed.
  write(path.join(ROOT, 'assets/adaptive-icon.png'), await inverted(1024, 0.44));
  // Splash + notification stay white-on-transparent; the blue comes from the
  // splash background colour and the notification tint respectively.
  write(path.join(ROOT, 'assets/splash-icon.png'), await whiteShrimp(200, 0.86));
  write(path.join(ROOT, 'assets/notification-icon.png'), await whiteShrimp(96, NOTIF_SCALE));

  // Committed native tree: no prebuild runs on EAS, so regenerate in place.
  // Expo names these .webp but writes PNG bytes; match that.
  for (const [dpi, legacy, fg] of [['mdpi', 48, 108], ['hdpi', 72, 162], ['xhdpi', 96, 216], ['xxhdpi', 144, 324], ['xxxhdpi', 192, 432]]) {
    const dir = path.join(RES, `mipmap-${dpi}`);
    write(path.join(dir, 'ic_launcher.webp'), await inverted(legacy, 0.62));
    write(path.join(dir, 'ic_launcher_round.webp'), await inverted(legacy, 0.62, true));
    write(path.join(dir, 'ic_launcher_foreground.webp'), await inverted(fg, 0.44));
  }
  for (const [dpi, notif, splash] of [['mdpi', 24, 288], ['hdpi', 36, 432], ['xhdpi', 48, 576], ['xxhdpi', 72, 864], ['xxxhdpi', 96, 1152]]) {
    const dir = path.join(RES, `drawable-${dpi}`);
    write(path.join(dir, 'notification_icon.png'), await whiteShrimp(notif, NOTIF_SCALE));
    write(path.join(dir, 'splashscreen_logo.png'), await whiteShrimp(splash, 0.5));
  }

  await variants();
})();
