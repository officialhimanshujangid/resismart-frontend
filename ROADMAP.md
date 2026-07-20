# ResiSmart — Roadmap

### Finance और Operations, दोनों के बाक़ी काम एक ही क्रम में — क्या बनेगा, किस पर टिका है, कैसे जाँचा जाएगा।

> **स्थिति — 19 जुलाई 2026**
>
> ✅ **Phase 1–5 बन गए** — setup का द्वार (73/73), थोक ख़र्च (60/60), अधिकार की नींव (48/48), gate का रजिस्टर (62/62), स्टाफ़ और तैनाती (54/54), template dropdowns (24/24)। पूरा regression **25 suites / 1426 assertions** हरा। Finance वाले `FINANCE_MODULE.md` में, ops वाले `OPERATIONS_MODULE.md` में।
>
> बाक़ी सब **आगे का नक़्शा** है — अभी बना नहीं है।
>
> - जो finance में **बना हुआ** है → `FINANCE_MODULE.md` (17 जुलाई 2026 को जाँचा गया)
> - जो operations में **बनना है** → `OPERATIONS_MODULE.md` (पूरी design)
> - **यह फ़ाइल** = बाक़ी phases का क्रम और निर्भरता। Finance वाले दोनों design अब module doc में चले गए हैं
>
> हर phase पूरा होने पर: उसका हिस्सा सम्बंधित module doc में जाएगा, और यहाँ से हट जाएगा।

---

## विषय-सूची

**पूरा क्रम**
- [एक नज़र में](#एक-नज़र-में)
- [निर्भरता का नक़्शा](#निर्भरता)
- ~~Phase 1 — Setup का द्वार~~ ✅ **हो गया** → `FINANCE_MODULE.md` §6
- ~~Phase 2 — ख़र्च की थोक प्रविष्टि~~ ✅ **हो गया** → `FINANCE_MODULE.md` §6
- ~~Phase 3 — अधिकार की नींव~~ ✅ **हो गया** → `OPERATIONS_MODULE.md` §6–7
- ~~Phase 4 — Gate: डिजिटल रजिस्टर~~ ✅ **हो गया** → `OPERATIONS_MODULE.md` §11–13
- ~~Phase 5 — स्टाफ़ और तैनाती~~ ✅ **हो गया** → `OPERATIONS_MODULE.md` §4–5
- ~~Phase 6 — शिकायत + सामान + QR~~ ✅ **हो गया** → `OPERATIONS_MODULE.md` §14–19
- ~~Phase 7 — सूचना का ढाँचा (push)~~ ✅ **हो गया** → `OPERATIONS_MODULE.md` §22
- ~~Phase 8 — Gate: अनुमति~~ ✅ **हो गया** → `OPERATIONS_MODULE.md` §12, §14
- ~~Phase 9 — Gate: पास और स्कैनर~~ ✅ **हो गया** → `OPERATIONS_MODULE.md` §15
- ~~Phase 10 — Admin की सौंपनी~~ ✅ **हो गया** → `OPERATIONS_MODULE.md` §8
- ~~Phase 11 — गहराई~~ ✅ **हो गया** → `OPERATIONS_MODULE.md` §19, §25 (ANPR, RFID और delivery webhook आपके कहने पर योजना से हटाए गए)

**नियम**
- [हर phase में क्या-क्या ज़रूरी है](#हर-phase-के-नियम)
- [जो ग़लतियाँ दोबारा नहीं होनी चाहिए](#पुरानी-ग़लतियाँ)

---


<a name="एक-नज़र-में"></a>
## एक नज़र में

| # | Phase | किस module का | Push चाहिए? | क्यों यहाँ |
|---|---|---|---|---|
| ~~**1**~~ | ~~Setup का द्वार + vendor शुरुआती शेष~~ | Finance | — | ✅ **हो गया** — 73/73 |
| ~~**2**~~ | ~~ख़र्च की थोक प्रविष्टि~~ | Finance | — | ✅ **हो गया** — 60/60 |
| ~~**3**~~ | ~~अधिकार की नींव~~ | Ops | — | ✅ **हो गया** — 48/48 |
| ~~**4**~~ | ~~Gate: डिजिटल रजिस्टर~~ | Ops | — | ✅ **हो गया** — 62/62 |
| ~~**5**~~ | ~~स्टाफ़ और तैनाती~~ | Ops | — | ✅ **हो गया** — 54/54 |
| ~~**6**~~ | ~~शिकायत + सामान + QR~~ | Ops | — | ✅ **हो गया** — 71/71 |
| ~~**7**~~ | ~~सूचना का ढाँचा (push)~~ | दोनों | — | ✅ **हो गया** — 48/48 |
| ~~**8**~~ | ~~Gate: अनुमति~~ | Ops | हाँ | ✅ **हो गया** — 55/55 |
| ~~**9**~~ | ~~Gate: पास और स्कैनर~~ | Ops | हाँ | ✅ **हो गया** — 46/46 |
| ~~**10**~~ | ~~Admin की सौंपनी~~ | Ops | हाँ | ✅ **हो गया** — 50/50 |
| ~~**11**~~ | ~~गहराई~~ | दोनों | हाँ | ✅ **हो गया** — 58/58 (ANPR हटाया गया) |

**पहले चार phase बिना push के चलते हैं** — यानी काफ़ी दूर तक बिना नए infrastructure के जाया जा सकता है।

<a name="निर्भरता"></a>
## निर्भरता का नक़्शा

```
  1 Setup द्वार ✅ ─┐
                    ├─→ (finance स्वतंत्र)
  2 थोक ख़र्च ──────┘       │
                            │ staffId
  3 अधिकार ✅               │
      │                     │
      ├─→ 4 Gate रजिस्टर    │
      │        │            │
      └─→ 5 स्टाफ़ ─────────┘
               │
               └─→ 6 शिकायत + सामान
                        │
  7 Push ───────────────┤
      │                 │
      ├─→ 8 अनुमति      │
      │      │          │
      │      └─→ 9 पास व स्कैनर
      │
      └─→ 10 सौंपनी ──→ 11 गहराई
```

**एक जायज़ अदला-बदली:** अगर आपको gate से ज़्यादा शिकायत ज़रूरी लगे, तो **4 को 6 के बाद खिसकाया जा सकता है** — शिकायत को gate की ज़रूरत नहीं। बाक़ी क्रम निर्भरता से बँधा है।

---

<a name="phase-6"></a>
## Phase 6 — शिकायत + सामान + QR

**लक्ष्य:** शिकायत उठे, सही आदमी तक पहुँचे, और बिना resident की पुष्टि के बंद न हो।

**निर्भरता:** Phase 5 ✅ (routing के लिए)।

### Backend
- `Complaint`, `ComplaintCategory` (दो स्तर), `ComplaintEvent`
- **दो भूमिकाएँ** — `ownerStaffId` (जवाबदेह) + `assigneeStaffId` (काम करने वाला)
- Routing की सीढ़ी: PRIMARY → BACKUP → SOCIETY → "बाँटना बाक़ी"। **कभी अनाथ नहीं**
- **दो घड़ियाँ** — पहला जवाब + पूरा समाधान, sub-category पर, **मिनटों में**
- **रुकी घड़ी** — बंद सूची से कारण
- Escalation L1→L4, आपात bypass
- `WORK_DONE` ≠ `RESOLVED`; **staff कभी `CLOSED` नहीं कर सकता**
- `reopenCount` — **गिनती, status नहीं**
- "मुझे भी" / merge
- **`kind: CONDUCT`** — trade routing से कभी नहीं, staff के आँकड़ों में नहीं, committee सदस्य के ख़िलाफ़ भी चले
- `Asset` + `qrToken`; AMC वाली शिकायत vendor को

### Frontend
- `dashboard/complaints` — सूची, विस्तार, बाँटना
- Resident का पन्ना — सिर्फ़ अपनी
- Staff का "मेरे काम"
- `dashboard/assets` + QR sticker छापना
- `/c/:qrToken` — स्कैन पर भरा हुआ फ़ॉर्म

### जाँच
1. `tsc --noEmit`
2. **किराए के flat की शिकायत मालिक को न दिखे** (ADDA की मानी हुई चूक)
3. **आचरण की शिकायत trade routing से कभी न जाए**; जिसके ख़िलाफ़ है उसे कभी न दिखे — चाहे उसके पास `COMPLAINTS_CONDUCT` हो
4. Routing की पूरी सीढ़ी; **कभी अनाथ नहीं**
5. रुकी घड़ी में SLA न बढ़े; कारण बंद सूची से ही
6. Staff `WORK_DONE` कर सके, `CLOSED` **नहीं**
7. `reopenCount` बढ़े — status वापस NEW करने से गिनती न मिटे
8. "मुझे भी" — एक ticket, कई देखने वाले; अलग ticket न बने
9. QR स्कैन → सही asset, block, category भरे
10. आपात श्रेणी नीचे के स्तर छोड़े

---

<a name="phase-7"></a>
## Phase 7 — सूचना का ढाँचा

**लक्ष्य:** असली समय में सूचना — आज कुछ नहीं है, सिर्फ़ email।

**निर्भरता:** कोई नहीं, पर Phase 8+ इस पर टिके हैं।

### Backend
- `firebase-admin`; `PushToken` model
- SSE endpoint (gate console के लिए)
- सूचना की सीढ़ी: push → in-app/SSE → timeout → email (सिर्फ़ रिकॉर्ड)
- **gate/शिकायत के चैनल में कभी विज्ञापन नहीं**

### Frontend / Mobile
- `mobile-society` में `expo-notifications` + token registration
- Web push + service worker (आज PWA नहीं है)
- सूचना केंद्र

### जाँच
1. `tsc --noEmit`
2. एक user के कई device — सबको जाए
3. मरा हुआ token अपने आप हटे
4. SSE टूटे तो दोबारा जुड़े
5. Push न जाए तो भी काम रुके नहीं (email fallback)

### खुला फ़ैसला
**SMS/IVR?** — फ़ोन बंद वाले तक पहुँचने का यही रास्ता, MyGate की सीढ़ी में IVR अहम कड़ी है। **पैसे वाला फ़ैसला।**

---

<a name="phase-8"></a>
## Phase 8 — Gate: अनुमति

**लक्ष्य:** असली visitor management — resident से पूछा जाए, और guard का हर override दिखे।

**निर्भरता:** Phase 4 + 7।

### Backend
- `ApprovalRequest`; timeout की सीढ़ी
- **किससे पूछें** — `RENTED` → सिर्फ़ किरायेदार, `OWNER_OCCUPIED` → मालिक, `VACANT` → committee
- सिर्फ़ `loginStatus === 'LOGIN'`; **किसी का login न हो तो सीधे fallback**
- Override + कारण + audit + resident को तुरंत सूचना
- `ResidentGatePreference` — बार-बार आने वाले, शांत घंटे, डिलीवरी default
- **`effectivePolicy()` — एक ही जगह**
- "gate पर छोड़ दो"
- महीने की override रिपोर्ट

### जाँच
1. `tsc --noEmit`
2. **किराए के flat का मेहमान — मालिक को कुछ न जाए।** सबसे ज़रूरी अकेली assertion
3. खाली flat → committee, किसी resident को नहीं
4. data-only सदस्य कभी न पूछे जाएँ; **किसी का login न हो तो fallback**
5. `effectivePolicy` — resident admin की छत से ऊपर न जाए
6. Override बिना कारण न बने; audit में दिखे; resident को सूचना जाए
7. शांत घंटे — रात में न पूछा जाए
8. पहला जवाब जीते; बाक़ी को "पहले ही तय हो गया" दिखे

---

<a name="phase-9"></a>
## Phase 9 — Gate: पास और स्कैनर

**निर्भरता:** Phase 8।

### Backend
- `GatePass` — 6-अंकीय कोड + **HMAC वाला QR**
- कोड **atomically जले**
- Offline सत्यापन (सार्वजनिक कुंजी device पर), अधिकतम 12 घंटे
- Sync पर दोहरे इस्तेमाल की पकड़ — **दिखाना, रोकना नहीं**

### Frontend
- Resident का न्योता → WhatsApp/SMS/link
- Guard का scanner (`html5-qrcode`)
- Offline queue (IndexedDB) + sync

### जाँच
1. `tsc --noEmit`
2. छेड़ा गया QR ठुकराया जाए
3. कोड दूसरी बार न चले
4. Offline: network बंद → entry बने → sync पर कोई नक़ल नहीं
5. मियाद बीता पास न चले
6. रद्द पास — offline में चल जाए पर sync पर निशान लगे

---

<a name="phase-10"></a>
## Phase 10 — Admin की सौंपनी

**निर्भरता:** Phase 3 ✅ + 7।

### Backend
- `AdminTransfer` — INITIATED / ACCEPTED / CANCELLED / EXPIRED
- तीन तरह के उत्तराधिकारी: मौजूदा सदस्य / Chairman / **बाहरी (किसी flat से नहीं जुड़ा)**
- OTP से स्वीकृति (मौजूदा `otp.service`)
- **एक transaction** — `Society.adminUserId` + दोनों की भूमिकाएँ
- Society कभी बिना admin न रहे
- **Break-glass** — Chairman + 2 सदस्य, कारण, पुराने admin को 72 घंटे
- `ADMIN_TRANSFER_*` audit

### Frontend
- `dashboard/settings/admin-transfer`
- स्वीकृति का पन्ना
- Committee को दिखता इतिहास

### जाँच
1. `tsc --noEmit`
2. **स्वीकार से पहले कुछ न बदले**
3. Society कभी बिना admin न रहे
4. पुराने admin की नई भूमिका स्पष्ट चुनी जाए — चुपचाप न हटे
5. दोनों तरफ़ + committee को सूचना; audit दोनों घटनाओं पर
6. Break-glass 3 सदस्यों से कम पर न चले; कारण अनिवार्य
7. बाहरी admin — कोई flat से जुड़ाव न बने
8. मियाद बीता निमंत्रण न चले

---

<a name="phase-11"></a>
## Phase 11 — गहराई

**निर्भरता:** सब।

- `ResidentVehicle` + autocomplete; गाड़ी entry/exit
- **ANPR — सिर्फ़ सुझाव**, "अनुमान" के निशान के साथ; provider बदला जा सके
- **Blacklist — पहचान सुलझने के बाद ही**
- रिपोर्ट: override, SLA, staff, category-वार, सामान-वार
- Delivery partner webhook (तैयार endpoint)
- RFID/boom barrier hook
- Guard app की भाषाएँ (8+)

---

<a name="हर-phase-के-नियम"></a>
## हर phase में क्या-क्या ज़रूरी है

कोई phase तब तक पूरा नहीं जब तक ये सब न हों:

1. **`npx tsc --noEmit` दोनों apps में साफ़** — backend dev transpile-only है, यही असली द्वार
2. **`next build` साफ़**
3. **Atlas पर verify script** — फेंकने लायक़ `societyId`, ख़ुद सफ़ाई करता `finally`, गिनती, नाकाम पर non-zero exit
4. **हर जगह audit चौकड़ी** — `createdBy`, `createdByName`, `updatedBy`, `updatedByName` + timestamps
5. **हर query में `societyId` हाथ से** — कोई global tenant filter नहीं है
6. **हर लिखने वाली route पर `requirePermission`** (Phase 3 के बाद)
7. **सबके view बनें** — admin, committee, staff, resident — जिसे जो दिखना चाहिए
8. **Module doc में जोड़ो, roadmap से हटाओ**

<a name="पुरानी-ग़लतियाँ"></a>
## जो ग़लतियाँ दोबारा नहीं होनी चाहिए

Finance के काम से निकले सबक़ — हर एक असली बग से आया है:

| सबक़ | कहाँ से आया |
|---|---|
| **घोषित, दिखाया, पर कभी पढ़ा न गया field** — सबसे आम बग | `fundId`, `billTo`, `isRecurring`, `waivedPaise`, `lines.vendorId` समेत **बारह** मौक़े |
| **पास होता aggregate assertion टूटी query छिपा सकता है** | vendor tie-back पास हो रहा था जबकि payments छँट रहे थे — दो ग़लतियाँ आपस में कट रही थीं |
| **`$ne: null` array पर वह नहीं करता जो आप सोचते हैं** | `$elemMatch` इस्तेमाल करो |
| **`$setOnInsert` चुपचाप कुछ न करके निकल जाता है** | `1500` खाता कभी बना ही नहीं, महीनों पता नहीं चला |
| **Schema default दो अलग हालतों को एक कर देता है** | `undefined` ≠ `[]` — "कभी चुना नहीं" बनाम "कुछ नहीं चुना" |
| **नया feature चालू societies को बंद न करे** | `resolveModules` का `inferFromData` — Phase 1 में वही pattern |
| **Client-side filter सुरक्षा नहीं है** | मौजूदा `PermissionRole` backend पर लागू ही नहीं होता |
| **तारीख़ की सीमा पर सोचो** | financial year की गड़बड़ी; रात की shift का दिन |
| **Verify script में `import '../config/timezone'` सबसे पहले** | और controller टेस्ट में `import '../middlewares/auth.middleware'` |

---

*यह roadmap `FINANCE_MODULE.md` (बना हुआ) और `OPERATIONS_MODULE.md` (design) के साथ पढ़ा जाए। तीनों में जहाँ टकराव दिखे, वहाँ बना हुआ code सही है और दस्तावेज़ बग है।*
