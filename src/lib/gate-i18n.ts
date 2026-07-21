/**
 * The gate console, in the language the guard actually speaks.
 *
 * This is the one screen in ResiSmart where English is a genuine barrier
 * rather than an inconvenience. A committee member reading a balance sheet in
 * English is normal; a guard on a night shift in Pune being asked to parse
 * "Overstay — expected departure exceeded" is not, and what happens instead is
 * that they stop using the software and go back to the paper book.
 *
 * Scope is deliberately narrow — only strings a GUARD sees. Translating the
 * finance module into ten languages would be a large amount of work that helps
 * nobody, and half-translated screens read worse than English ones.
 *
 * `guardApp.language` on the society's ops policy chooses the language. It has
 * existed as a field since Phase 4 and did nothing until this file; a setting
 * that stores a preference nothing reads is the defect this codebase keeps
 * finding, so it is wired to the console in the same change.
 */

export const GATE_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'mr', label: 'मराठी' },
  { code: 'gu', label: 'ગુજરાતી' },
  { code: 'bn', label: 'বাংলা' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'te', label: 'తెలుగు' },
  { code: 'kn', label: 'ಕನ್ನಡ' },
  { code: 'ml', label: 'മലയാളം' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ' },
  { code: 'or', label: 'ଓଡ଼ିଆ' },
] as const;

export type GateLang = typeof GATE_LANGUAGES[number]['code'];

/**
 * The key set is short on purpose. Every string here is one a guard reads
 * while somebody is standing in front of them, so each one has to be a phrase
 * rather than a label — "Who is at the gate?" beats "Visitor name".
 */
export interface GateStrings {
  /**
   * The heading over the guard's screen. It reads "Gate Desk" rather than
   * "Gate" or "Gate Console": the module is called Visitor Management now, and
   * what is left of the word "gate" here is the physical post the guard is
   * standing at — which is the right word for it.
   */
  console: string;
  whoIsHere: string;
  visitorName: string;
  phone: string;
  whichFlat: string;
  vehicle: string;
  photo: string;
  category: string;
  recordEntry: string;
  recordExit: string;
  inside: string;
  nobodyInside: string;
  askingFlat: string;
  letIn: string;
  turnAway: string;
  leaveAtGate: string;
  waiting: string;
  noAnswer: string;
  decideYourself: string;
  whyOverride: string;
  scanPass: string;
  typeCode: string;
  passAccepted: string;
  passRefused: string;
  noSignal: string;
  savedOnDevice: string;
  blockedWarning: string;
  overstaying: string;
  residentVehicle: string;
  save: string;
  cancel: string;
}

const en: GateStrings = {
  console: 'Gate Desk',
  whoIsHere: 'Who is at the gate?',
  visitorName: 'Their name',
  phone: 'Phone number',
  whichFlat: 'Which flat',
  vehicle: 'Vehicle number',
  photo: 'Photo',
  category: 'Kind of visitor',
  recordEntry: 'Let in',
  recordExit: 'Mark as gone',
  inside: 'Inside now',
  nobodyInside: 'Nobody is inside',
  askingFlat: 'Asking the flat…',
  letIn: 'Allowed',
  turnAway: 'Refused',
  leaveAtGate: 'Leave it at the gate',
  waiting: 'Waiting for an answer',
  noAnswer: 'No answer',
  decideYourself: 'Decide without waiting',
  whyOverride: 'Why? This goes on the record.',
  scanPass: 'Scan pass',
  typeCode: 'Type the code',
  passAccepted: 'Pass accepted',
  passRefused: 'Pass refused',
  noSignal: 'No signal',
  savedOnDevice: 'Saved on this device',
  blockedWarning: 'This visitor is on the society blocklist',
  overstaying: 'Still inside past their time',
  residentVehicle: 'A resident vehicle',
  save: 'Save',
  cancel: 'Cancel',
};

const hi: GateStrings = {
  console: 'गेट डेस्क',
  whoIsHere: 'गेट पर कौन है?',
  visitorName: 'इनका नाम',
  phone: 'फ़ोन नंबर',
  whichFlat: 'कौन-सा फ़्लैट',
  vehicle: 'गाड़ी नंबर',
  photo: 'फ़ोटो',
  category: 'किस तरह का आगंतुक',
  recordEntry: 'अंदर भेजें',
  recordExit: 'गया हुआ दर्ज करें',
  inside: 'अभी अंदर',
  nobodyInside: 'कोई अंदर नहीं है',
  askingFlat: 'फ़्लैट से पूछा जा रहा है…',
  letIn: 'अनुमति मिली',
  turnAway: 'मना किया',
  leaveAtGate: 'गेट पर छोड़ दें',
  waiting: 'जवाब का इंतज़ार',
  noAnswer: 'कोई जवाब नहीं',
  decideYourself: 'बिना इंतज़ार किए तय करें',
  whyOverride: 'क्यों? यह रिकॉर्ड में जाएगा।',
  scanPass: 'पास स्कैन करें',
  typeCode: 'कोड टाइप करें',
  passAccepted: 'पास सही है',
  passRefused: 'पास नहीं चला',
  noSignal: 'नेटवर्क नहीं',
  savedOnDevice: 'इसी डिवाइस में सुरक्षित',
  blockedWarning: 'यह व्यक्ति सोसायटी की रोक-सूची में है',
  overstaying: 'तय समय से ज़्यादा रुके हैं',
  residentVehicle: 'निवासी की गाड़ी',
  save: 'सहेजें',
  cancel: 'रद्द करें',
};

const mr: GateStrings = {
  console: 'गेट डेस्क',
  whoIsHere: 'गेटवर कोण आहे?',
  visitorName: 'त्यांचे नाव',
  phone: 'फोन नंबर',
  whichFlat: 'कोणता फ्लॅट',
  vehicle: 'गाडी नंबर',
  photo: 'फोटो',
  category: 'कोणत्या प्रकारचे पाहुणे',
  recordEntry: 'आत सोडा',
  recordExit: 'गेले म्हणून नोंदवा',
  inside: 'आत्ता आत',
  nobodyInside: 'कोणीही आत नाही',
  askingFlat: 'फ्लॅटला विचारत आहोत…',
  letIn: 'परवानगी दिली',
  turnAway: 'नकार दिला',
  leaveAtGate: 'गेटवरच ठेवा',
  waiting: 'उत्तराची वाट',
  noAnswer: 'उत्तर नाही',
  decideYourself: 'वाट न पाहता ठरवा',
  whyOverride: 'का? हे नोंदीत जाईल.',
  scanPass: 'पास स्कॅन करा',
  typeCode: 'कोड टाइप करा',
  passAccepted: 'पास बरोबर आहे',
  passRefused: 'पास चालला नाही',
  noSignal: 'नेटवर्क नाही',
  savedOnDevice: 'याच डिव्हाइसमध्ये जतन',
  blockedWarning: 'ही व्यक्ती सोसायटीच्या प्रतिबंध यादीत आहे',
  overstaying: 'ठरलेल्या वेळेपेक्षा जास्त थांबले आहेत',
  residentVehicle: 'रहिवाशाची गाडी',
  save: 'जतन करा',
  cancel: 'रद्द करा',
};

const gu: GateStrings = {
  console: 'ગેટ ડેસ્ક',
  whoIsHere: 'ગેટ પર કોણ છે?',
  visitorName: 'તેમનું નામ',
  phone: 'ફોન નંબર',
  whichFlat: 'કયો ફ્લેટ',
  vehicle: 'વાહન નંબર',
  photo: 'ફોટો',
  category: 'કયા પ્રકારના મુલાકાતી',
  recordEntry: 'અંદર જવા દો',
  recordExit: 'ગયા તરીકે નોંધો',
  inside: 'અત્યારે અંદર',
  nobodyInside: 'કોઈ અંદર નથી',
  askingFlat: 'ફ્લેટને પૂછી રહ્યા છીએ…',
  letIn: 'મંજૂરી મળી',
  turnAway: 'ના પાડી',
  leaveAtGate: 'ગેટ પર જ મૂકો',
  waiting: 'જવાબની રાહ',
  noAnswer: 'કોઈ જવાબ નથી',
  decideYourself: 'રાહ જોયા વગર નક્કી કરો',
  whyOverride: 'કેમ? આ રેકોર્ડમાં જશે.',
  scanPass: 'પાસ સ્કેન કરો',
  typeCode: 'કોડ ટાઇપ કરો',
  passAccepted: 'પાસ સાચો છે',
  passRefused: 'પાસ ચાલ્યો નહીં',
  noSignal: 'નેટવર્ક નથી',
  savedOnDevice: 'આ જ ડિવાઇસમાં સાચવ્યું',
  blockedWarning: 'આ વ્યક્તિ સોસાયટીની પ્રતિબંધ યાદીમાં છે',
  overstaying: 'નક્કી સમય કરતાં વધુ રોકાયા છે',
  residentVehicle: 'રહેવાસીનું વાહન',
  save: 'સાચવો',
  cancel: 'રદ કરો',
};

const bn: GateStrings = {
  console: 'গেট ডেস্ক',
  whoIsHere: 'গেটে কে আছেন?',
  visitorName: 'তাঁর নাম',
  phone: 'ফোন নম্বর',
  whichFlat: 'কোন ফ্ল্যাট',
  vehicle: 'গাড়ির নম্বর',
  photo: 'ছবি',
  category: 'কী ধরনের অতিথি',
  recordEntry: 'ভিতরে যেতে দিন',
  recordExit: 'চলে গেছেন বলে লিখুন',
  inside: 'এখন ভিতরে',
  nobodyInside: 'কেউ ভিতরে নেই',
  askingFlat: 'ফ্ল্যাটে জিজ্ঞাসা করা হচ্ছে…',
  letIn: 'অনুমতি দেওয়া হয়েছে',
  turnAway: 'ফিরিয়ে দেওয়া হয়েছে',
  leaveAtGate: 'গেটেই রেখে দিন',
  waiting: 'উত্তরের অপেক্ষা',
  noAnswer: 'কোনও উত্তর নেই',
  decideYourself: 'অপেক্ষা না করে সিদ্ধান্ত নিন',
  whyOverride: 'কেন? এটি নথিভুক্ত থাকবে।',
  scanPass: 'পাস স্ক্যান করুন',
  typeCode: 'কোড লিখুন',
  passAccepted: 'পাস ঠিক আছে',
  passRefused: 'পাস চলেনি',
  noSignal: 'নেটওয়ার্ক নেই',
  savedOnDevice: 'এই ডিভাইসেই রাখা আছে',
  blockedWarning: 'এই ব্যক্তি সোসাইটির নিষেধ তালিকায় আছেন',
  overstaying: 'নির্ধারিত সময়ের বেশি রয়ে গেছেন',
  residentVehicle: 'বাসিন্দার গাড়ি',
  save: 'সংরক্ষণ করুন',
  cancel: 'বাতিল',
};

const ta: GateStrings = {
  console: 'கேட் டெஸ்க்',
  whoIsHere: 'கேட்டில் யார் இருக்கிறார்கள்?',
  visitorName: 'அவர்களின் பெயர்',
  phone: 'தொலைபேசி எண்',
  whichFlat: 'எந்த வீடு',
  vehicle: 'வாகன எண்',
  photo: 'புகைப்படம்',
  category: 'எந்த வகை வருகையாளர்',
  recordEntry: 'உள்ளே அனுப்பு',
  recordExit: 'சென்றுவிட்டதாக பதிவு செய்',
  inside: 'இப்போது உள்ளே',
  nobodyInside: 'யாரும் உள்ளே இல்லை',
  askingFlat: 'வீட்டாரிடம் கேட்கிறோம்…',
  letIn: 'அனுமதிக்கப்பட்டது',
  turnAway: 'மறுக்கப்பட்டது',
  leaveAtGate: 'கேட்டிலேயே விட்டுவிடுங்கள்',
  waiting: 'பதிலுக்காக காத்திருக்கிறோம்',
  noAnswer: 'பதில் இல்லை',
  decideYourself: 'காத்திராமல் முடிவு செய்யுங்கள்',
  whyOverride: 'ஏன்? இது பதிவாகும்.',
  scanPass: 'பாஸ் ஸ்கேன் செய்',
  typeCode: 'குறியீட்டை உள்ளிடு',
  passAccepted: 'பாஸ் சரி',
  passRefused: 'பாஸ் ஏற்கப்படவில்லை',
  noSignal: 'நெட்வொர்க் இல்லை',
  savedOnDevice: 'இந்த சாதனத்தில் சேமிக்கப்பட்டது',
  blockedWarning: 'இவர் சொசைட்டியின் தடைப்பட்டியலில் உள்ளார்',
  overstaying: 'நேரத்தை மீறி உள்ளே இருக்கிறார்',
  residentVehicle: 'குடியிருப்பாளரின் வாகனம்',
  save: 'சேமி',
  cancel: 'ரத்து',
};

const te: GateStrings = {
  console: 'గేట్ డెస్క్',
  whoIsHere: 'గేటు దగ్గర ఎవరున్నారు?',
  visitorName: 'వారి పేరు',
  phone: 'ఫోన్ నంబర్',
  whichFlat: 'ఏ ఫ్లాట్',
  vehicle: 'వాహన నంబర్',
  photo: 'ఫోటో',
  category: 'ఏ రకమైన సందర్శకుడు',
  recordEntry: 'లోపలికి పంపండి',
  recordExit: 'వెళ్ళిపోయినట్టు నమోదు చేయండి',
  inside: 'ఇప్పుడు లోపల',
  nobodyInside: 'ఎవరూ లోపల లేరు',
  askingFlat: 'ఫ్లాట్‌ను అడుగుతున్నాం…',
  letIn: 'అనుమతి ఇచ్చారు',
  turnAway: 'తిరస్కరించారు',
  leaveAtGate: 'గేటు దగ్గరే వదిలేయండి',
  waiting: 'సమాధానం కోసం ఎదురుచూపు',
  noAnswer: 'సమాధానం లేదు',
  decideYourself: 'ఎదురుచూడకుండా నిర్ణయించండి',
  whyOverride: 'ఎందుకు? ఇది రికార్డులో ఉంటుంది.',
  scanPass: 'పాస్ స్కాన్ చేయండి',
  typeCode: 'కోడ్ టైప్ చేయండి',
  passAccepted: 'పాస్ సరైనది',
  passRefused: 'పాస్ పనిచేయలేదు',
  noSignal: 'నెట్‌వర్క్ లేదు',
  savedOnDevice: 'ఈ పరికరంలోనే భద్రపరచబడింది',
  blockedWarning: 'ఈ వ్యక్తి సొసైటీ నిషేధ జాబితాలో ఉన్నారు',
  overstaying: 'నిర్ణీత సమయం దాటి లోపల ఉన్నారు',
  residentVehicle: 'నివాసి వాహనం',
  save: 'భద్రపరచండి',
  cancel: 'రద్దు',
};

const kn: GateStrings = {
  console: 'ಗೇಟ್ ಡೆಸ್ಕ್',
  whoIsHere: 'ಗೇಟಿನಲ್ಲಿ ಯಾರಿದ್ದಾರೆ?',
  visitorName: 'ಅವರ ಹೆಸರು',
  phone: 'ಫೋನ್ ಸಂಖ್ಯೆ',
  whichFlat: 'ಯಾವ ಫ್ಲ್ಯಾಟ್',
  vehicle: 'ವಾಹನ ಸಂಖ್ಯೆ',
  photo: 'ಫೋಟೋ',
  category: 'ಯಾವ ರೀತಿಯ ಭೇಟಿಗಾರ',
  recordEntry: 'ಒಳಗೆ ಬಿಡಿ',
  recordExit: 'ಹೋಗಿದ್ದಾರೆ ಎಂದು ದಾಖಲಿಸಿ',
  inside: 'ಈಗ ಒಳಗೆ',
  nobodyInside: 'ಯಾರೂ ಒಳಗಿಲ್ಲ',
  askingFlat: 'ಫ್ಲ್ಯಾಟ್‌ಗೆ ಕೇಳುತ್ತಿದ್ದೇವೆ…',
  letIn: 'ಅನುಮತಿ ಸಿಕ್ಕಿದೆ',
  turnAway: 'ನಿರಾಕರಿಸಲಾಗಿದೆ',
  leaveAtGate: 'ಗೇಟಿನಲ್ಲೇ ಬಿಡಿ',
  waiting: 'ಉತ್ತರಕ್ಕಾಗಿ ಕಾಯುತ್ತಿದ್ದೇವೆ',
  noAnswer: 'ಉತ್ತರವಿಲ್ಲ',
  decideYourself: 'ಕಾಯದೆ ನಿರ್ಧರಿಸಿ',
  whyOverride: 'ಏಕೆ? ಇದು ದಾಖಲೆಗೆ ಹೋಗುತ್ತದೆ.',
  scanPass: 'ಪಾಸ್ ಸ್ಕ್ಯಾನ್ ಮಾಡಿ',
  typeCode: 'ಕೋಡ್ ಟೈಪ್ ಮಾಡಿ',
  passAccepted: 'ಪಾಸ್ ಸರಿಯಾಗಿದೆ',
  passRefused: 'ಪಾಸ್ ನಡೆಯಲಿಲ್ಲ',
  noSignal: 'ನೆಟ್‌ವರ್ಕ್ ಇಲ್ಲ',
  savedOnDevice: 'ಈ ಸಾಧನದಲ್ಲೇ ಉಳಿಸಲಾಗಿದೆ',
  blockedWarning: 'ಈ ವ್ಯಕ್ತಿ ಸೊಸೈಟಿಯ ನಿರ್ಬಂಧ ಪಟ್ಟಿಯಲ್ಲಿದ್ದಾರೆ',
  overstaying: 'ನಿಗದಿತ ಸಮಯ ಮೀರಿ ಒಳಗಿದ್ದಾರೆ',
  residentVehicle: 'ನಿವಾಸಿಯ ವಾಹನ',
  save: 'ಉಳಿಸಿ',
  cancel: 'ರದ್ದು',
};

const ml: GateStrings = {
  console: 'ഗേറ്റ് ഡെസ്ക്',
  whoIsHere: 'ഗേറ്റിൽ ആരാണ്?',
  visitorName: 'അവരുടെ പേര്',
  phone: 'ഫോൺ നമ്പർ',
  whichFlat: 'ഏത് ഫ്ലാറ്റ്',
  vehicle: 'വാഹന നമ്പർ',
  photo: 'ഫോട്ടോ',
  category: 'ഏത് തരം സന്ദർശകൻ',
  recordEntry: 'അകത്തേക്ക് വിടുക',
  recordExit: 'പോയതായി രേഖപ്പെടുത്തുക',
  inside: 'ഇപ്പോൾ അകത്ത്',
  nobodyInside: 'ആരും അകത്തില്ല',
  askingFlat: 'ഫ്ലാറ്റിനോട് ചോദിക്കുന്നു…',
  letIn: 'അനുമതി നൽകി',
  turnAway: 'നിരസിച്ചു',
  leaveAtGate: 'ഗേറ്റിൽ തന്നെ വെക്കുക',
  waiting: 'മറുപടിക്കായി കാത്തിരിക്കുന്നു',
  noAnswer: 'മറുപടിയില്ല',
  decideYourself: 'കാത്തിരിക്കാതെ തീരുമാനിക്കുക',
  whyOverride: 'എന്തുകൊണ്ട്? ഇത് രേഖയിൽ വരും.',
  scanPass: 'പാസ് സ്കാൻ ചെയ്യുക',
  typeCode: 'കോഡ് ടൈപ്പ് ചെയ്യുക',
  passAccepted: 'പാസ് ശരിയാണ്',
  passRefused: 'പാസ് സ്വീകരിച്ചില്ല',
  noSignal: 'നെറ്റ്‌വർക്ക് ഇല്ല',
  savedOnDevice: 'ഈ ഉപകരണത്തിൽ സൂക്ഷിച്ചു',
  blockedWarning: 'ഈ വ്യക്തി സൊസൈറ്റിയുടെ വിലക്കുപട്ടികയിലാണ്',
  overstaying: 'നിശ്ചിത സമയം കഴിഞ്ഞും അകത്താണ്',
  residentVehicle: 'താമസക്കാരന്റെ വാഹനം',
  save: 'സൂക്ഷിക്കുക',
  cancel: 'റദ്ദാക്കുക',
};

const pa: GateStrings = {
  console: 'ਗੇਟ ਡੈਸਕ',
  whoIsHere: 'ਗੇਟ ਉੱਤੇ ਕੌਣ ਹੈ?',
  visitorName: 'ਉਹਨਾਂ ਦਾ ਨਾਂ',
  phone: 'ਫ਼ੋਨ ਨੰਬਰ',
  whichFlat: 'ਕਿਹੜਾ ਫਲੈਟ',
  vehicle: 'ਗੱਡੀ ਨੰਬਰ',
  photo: 'ਫ਼ੋਟੋ',
  category: 'ਕਿਸ ਤਰ੍ਹਾਂ ਦਾ ਮਹਿਮਾਨ',
  recordEntry: 'ਅੰਦਰ ਭੇਜੋ',
  recordExit: 'ਗਏ ਵਜੋਂ ਦਰਜ ਕਰੋ',
  inside: 'ਹੁਣ ਅੰਦਰ',
  nobodyInside: 'ਕੋਈ ਅੰਦਰ ਨਹੀਂ',
  askingFlat: 'ਫਲੈਟ ਤੋਂ ਪੁੱਛ ਰਹੇ ਹਾਂ…',
  letIn: 'ਇਜਾਜ਼ਤ ਮਿਲੀ',
  turnAway: 'ਨਾਂਹ ਕੀਤੀ',
  leaveAtGate: 'ਗੇਟ ਉੱਤੇ ਹੀ ਛੱਡੋ',
  waiting: 'ਜਵਾਬ ਦੀ ਉਡੀਕ',
  noAnswer: 'ਕੋਈ ਜਵਾਬ ਨਹੀਂ',
  decideYourself: 'ਉਡੀਕੇ ਬਿਨਾਂ ਫ਼ੈਸਲਾ ਕਰੋ',
  whyOverride: 'ਕਿਉਂ? ਇਹ ਰਿਕਾਰਡ ਵਿੱਚ ਜਾਵੇਗਾ।',
  scanPass: 'ਪਾਸ ਸਕੈਨ ਕਰੋ',
  typeCode: 'ਕੋਡ ਟਾਈਪ ਕਰੋ',
  passAccepted: 'ਪਾਸ ਠੀਕ ਹੈ',
  passRefused: 'ਪਾਸ ਨਹੀਂ ਚੱਲਿਆ',
  noSignal: 'ਨੈੱਟਵਰਕ ਨਹੀਂ',
  savedOnDevice: 'ਇਸੇ ਡਿਵਾਈਸ ਵਿੱਚ ਸੰਭਾਲਿਆ',
  blockedWarning: 'ਇਹ ਵਿਅਕਤੀ ਸੁਸਾਇਟੀ ਦੀ ਰੋਕ-ਸੂਚੀ ਵਿੱਚ ਹੈ',
  overstaying: 'ਤੈਅ ਸਮੇਂ ਤੋਂ ਵੱਧ ਅੰਦਰ ਹਨ',
  residentVehicle: 'ਵਸਨੀਕ ਦੀ ਗੱਡੀ',
  save: 'ਸੰਭਾਲੋ',
  cancel: 'ਰੱਦ ਕਰੋ',
};

const or: GateStrings = {
  console: 'ଗେଟ୍ ଡେସ୍କ',
  whoIsHere: 'ଗେଟରେ କିଏ ଅଛନ୍ତି?',
  visitorName: 'ସେମାନଙ୍କ ନାମ',
  phone: 'ଫୋନ୍ ନମ୍ବର',
  whichFlat: 'କେଉଁ ଫ୍ଲାଟ୍',
  vehicle: 'ଗାଡ଼ି ନମ୍ବର',
  photo: 'ଫଟୋ',
  category: 'କେଉଁ ପ୍ରକାର ଅତିଥି',
  recordEntry: 'ଭିତରକୁ ଛାଡ଼ନ୍ତୁ',
  recordExit: 'ଚାଲିଗଲେ ବୋଲି ଲେଖନ୍ତୁ',
  inside: 'ଏବେ ଭିତରେ',
  nobodyInside: 'କେହି ଭିତରେ ନାହାନ୍ତି',
  askingFlat: 'ଫ୍ଲାଟକୁ ପଚାରୁଛୁ…',
  letIn: 'ଅନୁମତି ମିଳିଲା',
  turnAway: 'ମନା କରାଗଲା',
  leaveAtGate: 'ଗେଟରେ ହିଁ ଛାଡ଼ନ୍ତୁ',
  waiting: 'ଉତ୍ତର ପାଇଁ ଅପେକ୍ଷା',
  noAnswer: 'କୌଣସି ଉତ୍ତର ନାହିଁ',
  decideYourself: 'ଅପେକ୍ଷା ନକରି ସ୍ଥିର କରନ୍ତୁ',
  whyOverride: 'କାହିଁକି? ଏହା ରେକର୍ଡରେ ଯିବ।',
  scanPass: 'ପାସ୍ ସ୍କାନ୍ କରନ୍ତୁ',
  typeCode: 'କୋଡ୍ ଟାଇପ୍ କରନ୍ତୁ',
  passAccepted: 'ପାସ୍ ଠିକ୍ ଅଛି',
  passRefused: 'ପାସ୍ ଚାଲିଲା ନାହିଁ',
  noSignal: 'ନେଟୱାର୍କ ନାହିଁ',
  savedOnDevice: 'ଏହି ଡିଭାଇସରେ ସଞ୍ଚିତ',
  blockedWarning: 'ଏହି ବ୍ୟକ୍ତି ସୋସାଇଟିର ପ୍ରତିବନ୍ଧ ତାଲିକାରେ ଅଛନ୍ତି',
  overstaying: 'ନିର୍ଦ୍ଧାରିତ ସମୟ ଠାରୁ ଅଧିକ ଭିତରେ ଅଛନ୍ତି',
  residentVehicle: 'ବାସିନ୍ଦାଙ୍କ ଗାଡ଼ି',
  save: 'ସଞ୍ଚୟ କରନ୍ତୁ',
  cancel: 'ବାତିଲ୍',
};

const DICTIONARIES: Record<GateLang, GateStrings> = {
  en, hi, mr, gu, bn, ta, te, kn, ml, pa, or,
};

/**
 * Strings for a language, falling back to English.
 *
 * Falls back wholesale rather than key-by-key: a screen that is half Marathi
 * and half English is harder to read than one that is entirely English, and a
 * missing key here means somebody added a string and forgot the translations —
 * which should be visible, not papered over.
 */
export function gateStrings(lang?: string): GateStrings {
  return DICTIONARIES[(lang || 'en') as GateLang] || en;
}
