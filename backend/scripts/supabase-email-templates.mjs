/**
 * Supabase Auth email templates for Neerani — six languages, one file.
 *
 * WHY THIS IS A SCRIPT AND NOT 36 BLOCKS OF PASTED HTML
 *
 * Supabase has ONE template per email type with no locale switching, so the
 * only way to send a farmer an email in their own language is a Go-template
 * branch on `{{ .Data.language }}`. Written by hand that is six languages x
 * six templates = 36 hand-written branches, and a single syntax error in any
 * one of them makes Supabase silently fall back to its DEFAULT template —
 * losing every customisation with no error shown anywhere except the auth log.
 *
 * So the copy lives in a plain map and the Go syntax is generated once, by
 * `branch()` below. One implementation to get right instead of thirty-six.
 *
 * PREREQUISITE, already shipped: the app writes `language` into Supabase
 * `user_metadata` at signup (SignupDto.language -> supabase-auth.service
 * signUp options.data). Without it `.Data.language` is empty and every farmer
 * falls through to English. Accounts created BEFORE that shipped have no
 * language and will correctly get English.
 *
 * TRANSLATION STATUS: machine-drafted. These are the first thing a new farmer
 * receives, and they carry security instructions ("if you didn't request
 * this"). Have a native speaker read the five non-English sets before this is
 * applied to production.
 *
 * USAGE
 *   export SUPABASE_ACCESS_TOKEN=...   # supabase.com/dashboard/account/tokens
 *   node scripts/supabase-email-templates.mjs --check    # print, change nothing
 *   node scripts/supabase-email-templates.mjs --apply    # PATCH the project
 */

const PROJECT_REF = 'mcslntwchfucavjrrhnu'; // Upcheck Aquaculture App
const LANGS = ['en', 'hi', 'bn', 'ta', 'te', 'or'];
const BRAND = 'Neerani';
const SUPPORT = 'admin@upcheck.in';

/**
 * Copy, per template, per language.
 *
 * `cta` is the button label. `note` is the "if you didn't ask for this" line —
 * it is a security instruction and must never be dropped from a translation.
 * `code` appears only where a one-time code is offered as a fallback.
 */
const COPY = {
    confirmation: {
        en: { subject: 'Confirm your email address', h: 'Confirm your email', p: 'Tap the button below to confirm this address and finish setting up your account.', cta: 'Confirm email', note: 'If you did not create an account, you can ignore this email.' },
        hi: { subject: 'अपना ईमेल पता सत्यापित करें', h: 'अपना ईमेल सत्यापित करें', p: 'यह पता सत्यापित करने और अपना खाता पूरा करने के लिए नीचे दिए बटन पर टैप करें।', cta: 'ईमेल सत्यापित करें', note: 'यदि आपने खाता नहीं बनाया है, तो इस ईमेल को अनदेखा करें।' },
        bn: { subject: 'আপনার ইমেল ঠিকানা নিশ্চিত করুন', h: 'আপনার ইমেল নিশ্চিত করুন', p: 'এই ঠিকানাটি নিশ্চিত করে অ্যাকাউন্ট তৈরি সম্পূর্ণ করতে নিচের বোতামে চাপ দিন।', cta: 'ইমেল নিশ্চিত করুন', note: 'আপনি যদি অ্যাকাউন্ট তৈরি না করে থাকেন, এই ইমেলটি উপেক্ষা করতে পারেন।' },
        ta: { subject: 'உங்கள் மின்னஞ்சல் முகவரியை உறுதிப்படுத்தவும்', h: 'உங்கள் மின்னஞ்சலை உறுதிப்படுத்தவும்', p: 'இந்த முகவரியை உறுதிப்படுத்தி உங்கள் கணக்கை முடிக்க கீழே உள்ள பொத்தானை அழுத்தவும்.', cta: 'மின்னஞ்சலை உறுதிப்படுத்து', note: 'நீங்கள் கணக்கை உருவாக்கவில்லை என்றால், இந்த மின்னஞ்சலைப் புறக்கணிக்கலாம்.' },
        te: { subject: 'మీ ఇమెయిల్ చిరునామాను నిర్ధారించండి', h: 'మీ ఇమెయిల్‌ను నిర్ధారించండి', p: 'ఈ చిరునామాను నిర్ధారించి మీ ఖాతాను పూర్తి చేయడానికి కింది బటన్‌ను నొక్కండి.', cta: 'ఇమెయిల్ నిర్ధారించు', note: 'మీరు ఖాతా సృష్టించకపోతే, ఈ ఇమెయిల్‌ను విస్మరించవచ్చు.' },
        or: { subject: 'ଆପଣଙ୍କ ଇମେଲ ଠିକଣା ନିଶ୍ଚିତ କରନ୍ତୁ', h: 'ଆପଣଙ୍କ ଇମେଲ ନିଶ୍ଚିତ କରନ୍ତୁ', p: 'ଏହି ଠିକଣା ନିଶ୍ଚିତ କରି ଆପଣଙ୍କ ଆକାଉଣ୍ଟ ସମ୍ପୂର୍ଣ୍ଣ କରିବାକୁ ତଳ ବଟନ ଦବାନ୍ତୁ।', cta: 'ଇମେଲ ନିଶ୍ଚିତ କରନ୍ତୁ', note: 'ଯଦି ଆପଣ ଆକାଉଣ୍ଟ ତିଆରି କରିନାହାନ୍ତି, ଏହି ଇମେଲକୁ ଅଣଦେଖା କରନ୍ତୁ।' },
    },
    recovery: {
        en: { subject: 'Reset your password', h: 'Reset your password', p: 'We received a request to reset your password. Tap below to choose a new one. This link expires shortly.', cta: 'Reset password', note: 'If you did not request this, ignore this email — your password will not change.' },
        hi: { subject: 'अपना पासवर्ड रीसेट करें', h: 'अपना पासवर्ड रीसेट करें', p: 'हमें आपका पासवर्ड रीसेट करने का अनुरोध मिला। नया चुनने के लिए नीचे टैप करें। यह लिंक जल्द समाप्त हो जाएगा।', cta: 'पासवर्ड रीसेट करें', note: 'यदि आपने यह अनुरोध नहीं किया, तो इसे अनदेखा करें — आपका पासवर्ड नहीं बदलेगा।' },
        bn: { subject: 'আপনার পাসওয়ার্ড রিসেট করুন', h: 'আপনার পাসওয়ার্ড রিসেট করুন', p: 'আপনার পাসওয়ার্ড রিসেট করার অনুরোধ পেয়েছি। নতুন পাসওয়ার্ড বাছতে নিচে চাপ দিন। এই লিঙ্কটি শীঘ্রই মেয়াদ শেষ হবে।', cta: 'পাসওয়ার্ড রিসেট করুন', note: 'আপনি এই অনুরোধ না করে থাকলে উপেক্ষা করুন — আপনার পাসওয়ার্ড বদলাবে না।' },
        ta: { subject: 'உங்கள் கடவுச்சொல்லை மீட்டமைக்கவும்', h: 'கடவுச்சொல்லை மீட்டமைக்கவும்', p: 'உங்கள் கடவுச்சொல்லை மீட்டமைக்கக் கோரிக்கை வந்துள்ளது. புதியதைத் தேர்வுசெய்ய கீழே அழுத்தவும். இந்த இணைப்பு விரைவில் காலாவதியாகும்.', cta: 'கடவுச்சொல்லை மீட்டமை', note: 'நீங்கள் இதைக் கோரவில்லை என்றால் புறக்கணிக்கவும் — உங்கள் கடவுச்சொல் மாறாது.' },
        te: { subject: 'మీ పాస్‌వర్డ్‌ను రీసెట్ చేయండి', h: 'మీ పాస్‌వర్డ్ రీసెట్ చేయండి', p: 'మీ పాస్‌వర్డ్ రీసెట్ చేయమని అభ్యర్థన వచ్చింది. కొత్తది ఎంచుకోవడానికి కింద నొక్కండి. ఈ లింక్ త్వరలో గడువు ముగుస్తుంది.', cta: 'పాస్‌వర్డ్ రీసెట్ చేయి', note: 'మీరు దీన్ని అభ్యర్థించకపోతే విస్మరించండి — మీ పాస్‌వర్డ్ మారదు.' },
        or: { subject: 'ଆପଣଙ୍କ ପାସୱାର୍ଡ ରିସେଟ କରନ୍ତୁ', h: 'ପାସୱାର୍ଡ ରିସେଟ କରନ୍ତୁ', p: 'ଆପଣଙ୍କ ପାସୱାର୍ଡ ରିସେଟ କରିବାକୁ ଅନୁରୋଧ ମିଳିଛି। ନୂଆ ବାଛିବାକୁ ତଳେ ଦବାନ୍ତୁ। ଏହି ଲିଙ୍କ ଶୀଘ୍ର ସମାପ୍ତ ହେବ।', cta: 'ପାସୱାର୍ଡ ରିସେଟ କରନ୍ତୁ', note: 'ଆପଣ ଏହା ଅନୁରୋଧ କରିନଥିଲେ ଅଣଦେଖା କରନ୍ତୁ — ଆପଣଙ୍କ ପାସୱାର୍ଡ ବଦଳିବ ନାହିଁ।' },
    },
    magic_link: {
        en: { subject: 'Your sign-in link', h: 'Sign in to Neerani', p: 'Tap below to sign in. The link works once and expires shortly.', cta: 'Sign in', note: 'If you did not try to sign in, ignore this email.', code: 'Or enter this code in the app:' },
        hi: { subject: 'आपका साइन-इन लिंक', h: 'Neerani में साइन इन करें', p: 'साइन इन करने के लिए नीचे टैप करें। यह लिंक एक बार काम करता है और जल्द समाप्त हो जाता है।', cta: 'साइन इन करें', note: 'यदि आपने साइन इन का प्रयास नहीं किया, तो इसे अनदेखा करें।', code: 'या ऐप में यह कोड डालें:' },
        bn: { subject: 'আপনার সাইন-ইন লিঙ্ক', h: 'Neerani-তে সাইন ইন করুন', p: 'সাইন ইন করতে নিচে চাপ দিন। লিঙ্কটি একবার কাজ করে এবং শীঘ্রই মেয়াদ শেষ হয়।', cta: 'সাইন ইন করুন', note: 'আপনি সাইন ইন করার চেষ্টা না করলে উপেক্ষা করুন।', code: 'অথবা অ্যাপে এই কোডটি দিন:' },
        ta: { subject: 'உங்கள் உள்நுழைவு இணைப்பு', h: 'Neerani-யில் உள்நுழையவும்', p: 'உள்நுழைய கீழே அழுத்தவும். இந்த இணைப்பு ஒருமுறை மட்டுமே செயல்படும், விரைவில் காலாவதியாகும்.', cta: 'உள்நுழை', note: 'நீங்கள் உள்நுழைய முயற்சிக்கவில்லை என்றால் புறக்கணிக்கவும்.', code: 'அல்லது செயலியில் இந்தக் குறியீட்டை உள்ளிடவும்:' },
        te: { subject: 'మీ సైన్-ఇన్ లింక్', h: 'Neerani లో సైన్ ఇన్ చేయండి', p: 'సైన్ ఇన్ చేయడానికి కింద నొక్కండి. ఈ లింక్ ఒకసారి మాత్రమే పనిచేస్తుంది, త్వరలో గడువు ముగుస్తుంది.', cta: 'సైన్ ఇన్', note: 'మీరు సైన్ ఇన్ ప్రయత్నించకపోతే విస్మరించండి.', code: 'లేదా యాప్‌లో ఈ కోడ్ నమోదు చేయండి:' },
        or: { subject: 'ଆପଣଙ୍କ ସାଇନ-ଇନ ଲିଙ୍କ', h: 'Neerani ରେ ସାଇନ ଇନ କରନ୍ତୁ', p: 'ସାଇନ ଇନ କରିବାକୁ ତଳେ ଦବାନ୍ତୁ। ଏହି ଲିଙ୍କ ଥରେ କାମ କରେ ଓ ଶୀଘ୍ର ସମାପ୍ତ ହୁଏ।', cta: 'ସାଇନ ଇନ', note: 'ଆପଣ ସାଇନ ଇନ ଚେଷ୍ଟା କରିନଥିଲେ ଅଣଦେଖା କରନ୍ତୁ।', code: 'କିମ୍ବା ଆପରେ ଏହି କୋଡ ଦିଅନ୍ତୁ:' },
    },
    invite: {
        en: { subject: "You've been invited to a farm on Neerani", h: 'You have been invited', p: 'Someone has invited you to help manage their farm on Neerani. Tap below to accept and set up your account.', cta: 'Accept invitation', note: 'If you were not expecting this, you can ignore this email.' },
        hi: { subject: 'आपको Neerani पर एक फ़ार्म में आमंत्रित किया गया है', h: 'आपको आमंत्रित किया गया है', p: 'किसी ने आपको Neerani पर अपने फ़ार्म के प्रबंधन में मदद के लिए आमंत्रित किया है। स्वीकार करने के लिए नीचे टैप करें।', cta: 'निमंत्रण स्वीकारें', note: 'यदि आप इसकी अपेक्षा नहीं कर रहे थे, तो इसे अनदेखा करें।' },
        bn: { subject: 'আপনাকে Neerani-তে একটি খামারে আমন্ত্রণ জানানো হয়েছে', h: 'আপনাকে আমন্ত্রণ জানানো হয়েছে', p: 'কেউ আপনাকে Neerani-তে তাঁর খামার পরিচালনায় সাহায্য করতে আমন্ত্রণ জানিয়েছেন। গ্রহণ করতে নিচে চাপ দিন।', cta: 'আমন্ত্রণ গ্রহণ করুন', note: 'আপনি এটি আশা না করে থাকলে উপেক্ষা করতে পারেন।' },
        ta: { subject: 'Neerani-யில் ஒரு பண்ணைக்கு அழைக்கப்பட்டுள்ளீர்கள்', h: 'நீங்கள் அழைக்கப்பட்டுள்ளீர்கள்', p: 'Neerani-யில் தங்கள் பண்ணையை நிர்வகிக்க உதவ யாரோ உங்களை அழைத்துள்ளனர். ஏற்க கீழே அழுத்தவும்.', cta: 'அழைப்பை ஏற்கவும்', note: 'இதை நீங்கள் எதிர்பார்க்கவில்லை என்றால் புறக்கணிக்கலாம்.' },
        te: { subject: 'Neerani లో ఒక పొలానికి మిమ్మల్ని ఆహ్వానించారు', h: 'మిమ్మల్ని ఆహ్వానించారు', p: 'Neerani లో తమ పొలాన్ని నిర్వహించడంలో సహాయం చేయమని ఎవరో మిమ్మల్ని ఆహ్వానించారు. అంగీకరించడానికి కింద నొక్కండి.', cta: 'ఆహ్వానం అంగీకరించు', note: 'మీరు దీన్ని ఊహించకపోతే విస్మరించవచ్చు.' },
        or: { subject: 'Neerani ରେ ଏକ ଫାର୍ମକୁ ଆପଣଙ୍କୁ ନିମନ୍ତ୍ରଣ କରାଯାଇଛି', h: 'ଆପଣଙ୍କୁ ନିମନ୍ତ୍ରଣ କରାଯାଇଛି', p: 'Neerani ରେ ନିଜ ଫାର୍ମ ପରିଚାଳନାରେ ସାହାଯ୍ୟ କରିବାକୁ କେହି ଆପଣଙ୍କୁ ନିମନ୍ତ୍ରଣ କରିଛନ୍ତି। ଗ୍ରହଣ କରିବାକୁ ତଳେ ଦବାନ୍ତୁ।', cta: 'ନିମନ୍ତ୍ରଣ ଗ୍ରହଣ କରନ୍ତୁ', note: 'ଆପଣ ଏହା ଆଶା କରିନଥିଲେ ଅଣଦେଖା କରିପାରନ୍ତି।' },
    },
    email_change: {
        en: { subject: 'Confirm your new email address', h: 'Confirm your new email', p: 'Tap below to confirm {{ .NewEmail }} as the address for your account.', cta: 'Confirm new email', note: 'If you did not request this change, ignore this email and contact us.' },
        hi: { subject: 'अपना नया ईमेल पता सत्यापित करें', h: 'नया ईमेल सत्यापित करें', p: 'अपने खाते के पते के रूप में {{ .NewEmail }} की पुष्टि करने के लिए नीचे टैप करें।', cta: 'नया ईमेल सत्यापित करें', note: 'यदि आपने यह बदलाव नहीं मांगा, तो इसे अनदेखा करें और हमसे संपर्क करें।' },
        bn: { subject: 'আপনার নতুন ইমেল ঠিকানা নিশ্চিত করুন', h: 'নতুন ইমেল নিশ্চিত করুন', p: 'আপনার অ্যাকাউন্টের ঠিকানা হিসেবে {{ .NewEmail }} নিশ্চিত করতে নিচে চাপ দিন।', cta: 'নতুন ইমেল নিশ্চিত করুন', note: 'আপনি এই পরিবর্তন না চাইলে উপেক্ষা করুন এবং আমাদের সাথে যোগাযোগ করুন।' },
        ta: { subject: 'உங்கள் புதிய மின்னஞ்சலை உறுதிப்படுத்தவும்', h: 'புதிய மின்னஞ்சலை உறுதிப்படுத்தவும்', p: 'உங்கள் கணக்கின் முகவரியாக {{ .NewEmail }} ஐ உறுதிப்படுத்த கீழே அழுத்தவும்.', cta: 'புதிய மின்னஞ்சலை உறுதிப்படுத்து', note: 'இந்த மாற்றத்தை நீங்கள் கோரவில்லை என்றால் புறக்கணித்து எங்களைத் தொடர்பு கொள்ளவும்.' },
        te: { subject: 'మీ కొత్త ఇమెయిల్ చిరునామాను నిర్ధారించండి', h: 'కొత్త ఇమెయిల్ నిర్ధారించండి', p: 'మీ ఖాతా చిరునామాగా {{ .NewEmail }} ను నిర్ధారించడానికి కింద నొక్కండి.', cta: 'కొత్త ఇమెయిల్ నిర్ధారించు', note: 'మీరు ఈ మార్పును కోరకపోతే విస్మరించి మమ్మల్ని సంప్రదించండి.' },
        or: { subject: 'ଆପଣଙ୍କ ନୂଆ ଇମେଲ ଠିକଣା ନିଶ୍ଚିତ କରନ୍ତୁ', h: 'ନୂଆ ଇମେଲ ନିଶ୍ଚିତ କରନ୍ତୁ', p: 'ଆପଣଙ୍କ ଆକାଉଣ୍ଟ ଠିକଣା ଭାବେ {{ .NewEmail }} ନିଶ୍ଚିତ କରିବାକୁ ତଳେ ଦବାନ୍ତୁ।', cta: 'ନୂଆ ଇମେଲ ନିଶ୍ଚିତ କରନ୍ତୁ', note: 'ଆପଣ ଏହି ପରିବର୍ତ୍ତନ ମାଗିନଥିଲେ ଅଣଦେଖା କରି ଆମକୁ ଯୋଗାଯୋଗ କରନ୍ତୁ।' },
    },
    reauthentication: {
        en: { subject: '{{ .Token }} is your Neerani verification code', h: 'Your verification code', p: 'Use this code to confirm it is you. It expires shortly.', note: 'If you did not request this, someone may have your password. Change it and contact us.' },
        hi: { subject: '{{ .Token }} आपका Neerani सत्यापन कोड है', h: 'आपका सत्यापन कोड', p: 'यह आप ही हैं इसकी पुष्टि के लिए इस कोड का उपयोग करें। यह जल्द समाप्त हो जाएगा।', note: 'यदि आपने यह अनुरोध नहीं किया, तो किसी के पास आपका पासवर्ड हो सकता है। इसे बदलें और हमसे संपर्क करें।' },
        bn: { subject: '{{ .Token }} আপনার Neerani যাচাই কোড', h: 'আপনার যাচাই কোড', p: 'এটি আপনিই তা নিশ্চিত করতে এই কোডটি ব্যবহার করুন। এটি শীঘ্রই মেয়াদ শেষ হবে।', note: 'আপনি এই অনুরোধ না করলে কারও কাছে আপনার পাসওয়ার্ড থাকতে পারে। এটি বদলান এবং আমাদের জানান।' },
        ta: { subject: '{{ .Token }} உங்கள் Neerani சரிபார்ப்புக் குறியீடு', h: 'உங்கள் சரிபார்ப்புக் குறியீடு', p: 'இது நீங்கள்தான் என்பதை உறுதிப்படுத்த இந்தக் குறியீட்டைப் பயன்படுத்தவும். இது விரைவில் காலாவதியாகும்.', note: 'நீங்கள் இதைக் கோரவில்லை என்றால், உங்கள் கடவுச்சொல் யாரிடமோ இருக்கலாம். அதை மாற்றி எங்களைத் தொடர்பு கொள்ளவும்.' },
        te: { subject: '{{ .Token }} మీ Neerani ధృవీకరణ కోడ్', h: 'మీ ధృవీకరణ కోడ్', p: 'ఇది మీరేనని నిర్ధారించడానికి ఈ కోడ్‌ను ఉపయోగించండి. ఇది త్వరలో గడువు ముగుస్తుంది.', note: 'మీరు దీన్ని అభ్యర్థించకపోతే, మీ పాస్‌వర్డ్ ఎవరికైనా తెలిసి ఉండవచ్చు. దాన్ని మార్చి మమ్మల్ని సంప్రదించండి.' },
        or: { subject: '{{ .Token }} ଆପଣଙ୍କ Neerani ଯାଞ୍ଚ କୋଡ', h: 'ଆପଣଙ୍କ ଯାଞ୍ଚ କୋଡ', p: 'ଏହା ଆପଣ ବୋଲି ନିଶ୍ଚିତ କରିବାକୁ ଏହି କୋଡ ବ୍ୟବହାର କରନ୍ତୁ। ଏହା ଶୀଘ୍ର ସମାପ୍ତ ହେବ।', note: 'ଆପଣ ଏହା ଅନୁରୋଧ କରିନଥିଲେ, କାହା ପାଖରେ ଆପଣଙ୍କ ପାସୱାର୍ଡ ଥାଇପାରେ। ଏହାକୁ ବଦଳାନ୍ତୁ ଓ ଆମକୁ ଜଣାନ୍ତୁ।' },
    },
};

/**
 * Wrap per-language HTML in a Go if/else-if chain on `.Data.language`.
 *
 * English is the `else`, so it catches three cases at once: a farmer who chose
 * English, an unrecognised value, and every account created before the app
 * started recording a language. That last group is the majority today.
 */
const branch = (fn) => {
    const others = LANGS.filter((l) => l !== 'en')
        .map((l) => `{{ else if eq .Data.language "${l}" }}${fn(l)}`)
        .join('');
    // The `if` is deliberately a condition that is never true, so every real
    // language is an `else if` and English is the single `else`. That keeps the
    // generated shape identical for every template — one chain, one fallback.
    return `{{ if eq .Data.language "__none__" }}${others}{{ else }}${fn('en')}{{ end }}`;
};

const S = {
    // SINGLE quotes around the font names on purpose: this whole string is
    // interpolated into style="…", so a double quote here closes the attribute
    // and the rest of the CSS becomes stray markup. Every template was broken
    // by exactly that until it was spotted in the --check output.
    body: "margin:0;padding:24px 16px;background:#F4F7F9;font-family:-apple-system,Roboto,'Noto Sans','Noto Sans Devanagari','Noto Sans Bengali','Noto Sans Tamil','Noto Sans Telugu','Noto Sans Oriya',sans-serif;color:#16303F;",
    card: 'max-width:520px;margin:0 auto;background:#FFFFFF;border-radius:12px;padding:28px 24px;',
    brand: 'font-size:22px;font-weight:800;color:#0B6DC7;letter-spacing:-0.4px;padding-bottom:4px;',
    h: 'font-size:19px;font-weight:700;margin:12px 0 8px;',
    p: 'font-size:15px;line-height:1.55;margin:0 0 20px;',
    // A real <a> styled as a button. Bulletproof-ish: Gmail's Indian mobile
    // clients strip a lot of CSS but keep inline background and padding on an
    // anchor, and the link still works as a plain link if all of it is stripped.
    cta: 'display:inline-block;background:#0B6DC7;color:#FFFFFF;text-decoration:none;font-weight:700;font-size:16px;padding:13px 26px;border-radius:8px;',
    code: 'font-size:26px;font-weight:800;letter-spacing:4px;color:#0B4F8A;margin:8px 0 20px;',
    note: 'font-size:13px;line-height:1.5;color:#5A7183;margin:22px 0 0;',
    foot: 'font-size:12px;color:#8397A6;text-align:center;padding-top:16px;',
};

/** One language's body for a link-style email. */
const linkBody = (c, withCode) => `
<div style="${S.h}">${c.h}</div>
<p style="${S.p}">${c.p}</p>
<p style="margin:0 0 18px;"><a href="{{ .ConfirmationURL }}" style="${S.cta}">${c.cta}</a></p>
${withCode && c.code ? `<p style="${S.p};margin-bottom:4px;">${c.code}</p><div style="${S.code}">{{ .Token }}</div>` : ''}
<p style="${S.note}">${c.note}</p>`;

/** One language's body for a code-only email (reauthentication). */
const codeBody = (c) => `
<div style="${S.h}">${c.h}</div>
<p style="${S.p}">${c.p}</p>
<div style="${S.code}">{{ .Token }}</div>
<p style="${S.note}">${c.note}</p>`;

const doc = (inner) => `<!DOCTYPE html><html><body style="${S.body}">
<div style="${S.card}">
<div style="${S.brand}">${BRAND}</div>
${inner}
</div>
<div style="${S.foot}">${BRAND} &middot; ${SUPPORT}</div>
</body></html>`;

/** Subjects branch too — a Hindi body under an English subject reads as spam. */
const subject = (key) => branch((l) => COPY[key][l].subject);

const template = (key, kind) =>
    doc(branch((l) => (kind === 'code' ? codeBody(COPY[key][l]) : linkBody(COPY[key][l], kind === 'link+code'))));

export const payload = {
    mailer_subjects_confirmation: subject('confirmation'),
    mailer_templates_confirmation_content: template('confirmation', 'link'),

    mailer_subjects_recovery: subject('recovery'),
    mailer_templates_recovery_content: template('recovery', 'link'),

    // Magic link carries the OTP as well: some corporate and ISP scanners
    // pre-fetch links and consume the token before the farmer ever taps it,
    // producing "token expired" on a link they never used. The code is the
    // working fallback when that happens.
    mailer_subjects_magic_link: subject('magic_link'),
    mailer_templates_magic_link_content: template('magic_link', 'link+code'),

    mailer_subjects_invite: subject('invite'),
    mailer_templates_invite_content: template('invite', 'link'),

    mailer_subjects_email_change: subject('email_change'),
    mailer_templates_email_change_content: template('email_change', 'link'),

    mailer_subjects_reauthentication: subject('reauthentication'),
    mailer_templates_reauthentication_content: template('reauthentication', 'code'),
};

/* ------------------------------------------------------------------ CLI */

const mode = process.argv.includes('--apply') ? 'apply' : 'check';

if (mode === 'check') {
    for (const [k, v] of Object.entries(payload)) {
        console.log(`\n=== ${k} (${v.length} chars) ===`);
        console.log(v.slice(0, 220).replace(/\n/g, ' ') + (v.length > 220 ? ' …' : ''));
    }
    console.log(`\n${Object.keys(payload).length} fields ready. Re-run with --apply to PATCH ${PROJECT_REF}.`);
    console.log('Translations are machine-drafted — have a native speaker read them first.');
} else {
    const token = process.env.SUPABASE_ACCESS_TOKEN;
    if (!token) {
        console.error('SUPABASE_ACCESS_TOKEN is not set. Create one at https://supabase.com/dashboard/account/tokens');
        process.exit(1);
    }
    const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        console.error(`FAILED ${res.status}: ${await res.text()}`);
        process.exit(1);
    }
    console.log('Applied. Now send yourself one of each and READ them — a Go syntax');
    console.log('error makes Supabase fall back to its default template silently,');
    console.log('and the only trace is in the project auth log.');
}
