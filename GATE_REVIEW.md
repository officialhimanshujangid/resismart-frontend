# Gate, Staff, Equipment — ईमानदार समीक्षा और आगे का रास्ता

> **तारीख़: 20 जुलाई 2026** · लिखने वाला: Claude · **यह कोड नहीं है, प्रस्ताव है।**
>
> आपने कहा *"muje lagta hai iska flow bhot simple hai, secure nhi hai"*। मैंने जाँचा।
> **आप सही हैं, और वजह उससे गंभीर है जितनी आपने सोची होगी।**

---

## भाग ० — पहले वह बात जो मुझे मानकर शुरू करनी चाहिए

मैंने पिछली रात कहा था *"ग्यारहों phase पूरे, 608 assertions हरी"*। **वह गिनती सच थी और नतीजा भ्रामक था।**

मैंने तीन चीज़ें अलग-अलग बनाईं, हर एक को अलग-अलग जाँचा, हर एक अपनी जगह ठीक है — **और तीनों को कभी आपस में जोड़ा ही नहीं।**

```
guard "Log an arrival" दबाता है
        │
        └──► POST /gate/entries ──► entry बन गई। बस।
                                     ⛔ approval कभी पूछी नहीं गई
                                     ⛔ pass कभी जला नहीं
                                     ⛔ किस gate से आया — दर्ज नहीं

guard QR scan करता है
        │
        └──► POST /gate/passes/redeem ──► pass जल गया। बस।
                                          ⛔ VisitorEntry बनी ही नहीं
                                          ⛔ यानी वह आदमी "अंदर" कहीं नहीं है

resident approve करता है
        │
        └──► outcome APPROVED हो गया। बस।
                                          ⛔ entry इससे भी नहीं बनती
```

### सबूत, अंदाज़ा नहीं

| दावा | सबूत |
|---|---|
| **Gate console approval कभी नहीं पूछता** | `gate/page.tsx:127` सीधे `/gate/entries` पर POST करता है। पूरे codebase में `requestApproval` सिर्फ़ **अपने ही controller और अपनी ही verify script** से बुलाया जाता है — किसी असली flow से नहीं। |
| **Scan के बाद entry नहीं बनती** | `gate-pass.service.ts` में `VisitorEntry` शब्द एक बार भी नहीं है। |
| **`GatePass.visitorEntryId` कभी लिखा नहीं जाता** | पूरे codebase में 2 बार आता है — दोनों बार अपनी ही declaration में। |
| **कोई भौतिक gate (फाटक) है ही नहीं** | `Gate` नाम का कोई model नहीं। `VisitorEntry` में `gateId`/`gateName` शून्य बार। |

### यह ठीक वही दोष है जिससे मैं बार-बार बचने का दावा करता रहा

पूरे काम में मैं दोहराता रहा: *"घोषित, दिखाया, पर कभी पढ़ा न गया — यही सबसे आम बग है।"* और फिर मैंने **तीन पूरे systems** उसी शक्ल में बना दिए।

**मेरी verify scripts ने इसे क्यों नहीं पकड़ा?** क्योंकि हर script ने service को *सीधे* बुलाया:

```ts
// verify-gate-approval.ts — यह पास होता है
const asked = await requestApproval(SID, {...}, guard);   // ✅ काम करता है
```

पर असली guard यह function कभी छूता ही नहीं। **मैंने वह चीज़ जाँची जो मैंने बनाई थी, वह नहीं जो उपयोगकर्ता करता है।** यह वही सबक़ है जो मैंने दो बार लिखा — *"अपने से आसान बनाया गया test वही bug छिपाता है जिसे पकड़ने के लिए लिखा गया"* — और तीसरी बार मैं उसी में गिरा, बस बड़े पैमाने पर।

---

## भाग १ — आपने जो-जो कहा, एक-एक पर

### १. *"approval on kru to approval ke baad hi andar aa paye"*

**अभी:** approval एक अलग टापू है। L3 preset लगाने से `approval.mode = REQUIRED` सेट हो जाता है, resident के पास सूचना भी जा सकती है — पर guard का बटन उसे पूछता ही नहीं। **यानी society ने approval चालू किया, और कुछ नहीं बदला।**

**होना चाहिए:** entry का एक ही दरवाज़ा हो, और वह ख़ुद तय करे:

```
POST /gate/arrivals   ← guard का इकलौता रास्ता
   │
   ├─ effectivePolicy() पूछो
   ├─ NONE          → entry बनाओ, हो गया
   ├─ NOTIFY_ONLY   → entry बनाओ + flat को बताओ
   ├─ LEAVE_AT_GATE → entry बनाओ (status: AT_GATE), अंदर नहीं
   └─ REQUIRED      → ApprovalRequest बनाओ, entry status: AWAITING
                      resident approve करे → तभी status INSIDE
                      मना करे → status DENIED, अंदर नहीं
                      कोई जवाब न आए → policy का onTimeout
```

**अहम बात:** entry **तभी भी बने** जब approval माँगी जा रही हो — पर `AWAITING` हालत में। क्योंकि आदमी सचमुच gate पर खड़ा है, और उसका कोई रिकॉर्ड न होना ग़लत है। "अंदर कौन है" में वह तब तक न गिने जब तक approve न हो।

### २. *"scan par agar scan ho lekin entry to ho"* — बिल्कुल सही

**अभी:** pass जलता है, आदमी कहीं दर्ज नहीं होता। "अंदर कौन है" में वह है ही नहीं। यानी pass वाला रास्ता register को **झूठा** कर देता है।

**होना चाहिए:** scan सफल = entry बनी, और pass उससे जुड़ा (`visitorEntryId` — जो field पहले से है और ख़ाली पड़ा है)। Pass वाली entry को approval की ज़रूरत नहीं — **न्योता ही अनुमति है**, resident ने पहले ही दे दी।

### ३. *"pass jab tak ke liye create kiya hai tab tak valid hona chhaiye"*

**अभी यह ठीक है** — `validFrom`/`validTo` काम करते हैं, `maxUses` भी। पर एक छिपी बात जो आपको पता होनी चाहिए: **QR पर हस्ताक्षर सिर्फ़ 12 घंटे का होता है**, चाहे pass महीने भर का हो। वजह — offline gate को रद्द किए गए pass का पता नहीं चल सकता, तो 12 घंटे से ज़्यादा भरोसा ख़तरा है। **महीने भर का pass online gate पर पूरे महीने चलेगा**, पर offline gate पर 12 घंटे बाद "फिर से scan करने के लिए network चाहिए" कहेगा। यह जान-बूझकर है, पर UI इसे कहीं नहीं बताता — बताना चाहिए।

### ४. *"resident ka apna ek pass hona chahiye, everyone living in society should have pass"*

**अभी बिल्कुल नहीं है।** Pass सिर्फ़ मेहमान के लिए है। निवासी के पास अपनी कोई पहचान नहीं — guard उसे रोज़ पहचान से जाने देता है।

**यह असली कमी है।** इसका सही रूप:

- हर सक्रिय resident का एक **स्थायी घरेलू पास** — QR, जो उसकी सदस्यता तक वैध
- यह **entry-exit के लिए ज़रूरी नहीं** — निवासी को अपने घर आने के लिए scan करना अपमानजनक है और DPDP के लिहाज़ से भी संदिग्ध (`policy.gate.residents.logMovement` default OFF है, और रहना चाहिए)
- इसका असली काम **तीन जगह** है: गाड़ी की पहचान, मेहमान को "मैं इस flat से हूँ" साबित करना, और नए/अस्थायी guard के लिए
- **किरायेदार का pass tenancy ख़त्म होते ही मरे** — यह वह जगह है जहाँ हर प्रतिस्पर्धी ढीला है

### ५. *"setting me pooche ki sirf in ki entry krni hai ya in + out ki"*

**यह पहले से है** (`gate.exit.trackExit`) पर **छिपा हुआ है** — L1/L2 preset के अंदर दबा है, और settings में अलग सवाल की तरह नहीं पूछा जाता। पहला सवाल यही होना चाहिए, साफ़ शब्दों में।

### ६. *"created by gate number, gate crud vgerh"* — यह सबसे बड़ी लापता चीज़ है

**कोई `Gate` model है ही नहीं।** बड़ी society में 2–4 फाटक होते हैं। अभी:

- यह पता ही नहीं चल सकता कि आदमी **किस फाटक से** आया
- यह भी नहीं कि **किस फाटक से निकला** (मुख्य से आया, पिछले से गया — रिकॉर्ड एक जैसा)
- guard किस फाटक पर तैनात है, यह `StaffAssignment` में block-वार है, gate-वार नहीं
- offline device किस फाटक का है — पता नहीं

**यह सिर्फ़ एक field नहीं है।** इसके बिना reconciliation असंभव है: "A फाटक पर 40 आए, B पर 12 निकले" जैसा हिसाब ही नहीं बन सकता।

### ७. *"created by created at nhi hai"*

**Backend में हर जगह है** — यह मैंने पक्का किया था और वह सही है। **UI में लगभग कहीं नहीं दिखता:**

| screen | createdBy/At दिखता है? |
|---|---|
| Committee | ❌ नहीं |
| Staff | ❌ नहीं |
| Equipment | आंशिक |
| Complaints | आंशिक |
| Gate settings | ❌ नहीं — *किसने policy बदली, कब* कहीं नहीं |
| Blocklist | ❌ UI ही नहीं है |
| Vehicles | ❌ UI ही नहीं है |

आपने शुरू में साफ़ कहा था *"sab jagah created by updated by created at updated at maintain kro proper sabke view bhi banao"* — **मैंने पहला आधा किया, दूसरा नहीं।**

### ८. *"ui bhi aishe hai ki verticle padding margin kahi kahi nhi hai"*

सही है। मैंने हर पन्ना अलग-अलग लिखा, हर बार spacing हाथ से चुनी (`space-y-4`, `p-3`, `p-4`, `py-2.5`…)। **कोई साझा layout primitive नहीं है**, इसलिए पन्ने आपस में मेल नहीं खाते।

### ९. *"staff management or sidebar handling is very very complex"*

**संख्या में:** society admin को sidebar में **48 items, 12 समूह**। यह बहुत ज़्यादा है।

**Staff का असली भ्रम** यह है कि एक ही आदमी चार अलग जगह रहता है और चारों जोड़ना उपयोगकर्ता के ज़िम्मे है:
`SocietyStaff` (कौन है) · `StaffAssignment` (कहाँ, क्या काम) · `AccessRole` (क्या देख सकता है) · `User` (login) — और UI इन्हें एक साथ कभी नहीं दिखाता।

---

## भाग २ — असल जड़ क्या है

तीनों शिकायतें एक ही चीज़ से निकलती हैं:

> **मैंने entities बनाए, flows नहीं।**

हर model सही है। हर service अपने आप में ठीक है। पर **किसी ने यह नहीं पूछा कि "एक आदमी gate पर आता है, फिर क्या-क्या होता है, अंत तक"** — और इसीलिए तीन अधूरे रास्ते बने जो एक-दूसरे को नहीं जानते।

"Industry level" का मतलब ज़्यादा features नहीं है। मतलब है: **एक घटना, एक रिकॉर्ड, हर क़दम उस पर टँका हुआ, और उसे देखने का एक पन्ना।**

---

## भाग ३ — मेरा प्रस्ताव

### प्रस्ताव A — **एक ही प्रवेश-द्वार** (सबसे ज़रूरी)

`recordEntry`, `requestApproval`, `redeem` — तीनों के ऊपर एक `arrival.service`, और guard के लिए **एक ही endpoint**। तीनों पुराने रास्ते internal हो जाएँ।

`VisitorEntry.status` फैले: `AWAITING_APPROVAL` · `AT_GATE` (सामान छोड़ा) · `INSIDE` · `LEFT` · `DENIED` · `AUTO_CLOSED`

**हर entry पर लिखा हो कि वह कैसे अंदर आया:** `admittedVia: GUARD | RESIDENT_APPROVAL | PASS | OVERRIDE | EXPECTED_VISITOR`. यही वह एक field है जिससे पूरा gate audit करने लायक़ बनता है।

### प्रस्ताव B — **`Gate` entity**

`Gate` model: नाम, कोड, प्रकार (मुख्य/पैदल/वाहन/सेवा), चालू है या नहीं, entry/exit दोनों या एक।
`VisitorEntry` में `entryGateId` **और** `exitGateId` अलग-अलग।
Device एक gate से बँधा — scanner खुलते ही जानता है वह कहाँ है।

### प्रस्ताव C — **निवासी का पास**

`ResidentPass` — हर सक्रिय resident का स्थायी QR, सदस्यता के साथ जीता-मरता। **entry के लिए ज़रूरी नहीं**, पहचान के लिए। किरायेदार का tenancy के साथ अपने आप ख़त्म।

### प्रस्ताव D — **साझा UI ढाँचा**

`<PageHeader>` · `<DataTable>` · `<AuditFooter>` — तीन primitives, और हर पन्ना इन्हीं से बने। इससे padding की समस्या *अपने आप* हल होती है, हर पन्ने पर हाथ से ठीक करने की ज़रूरत नहीं। `<AuditFooter>` हर record पर *किसने बनाया, कब, किसने बदला, कब* — एक ही जगह से, इसलिए कोई पन्ना भूल नहीं सकता।

### प्रस्ताव E — **Sidebar 48 → ~20**

एक **Operations** समूह: Gate · Staff · Complaints · Equipment · Settings.
Finance के 14 items तीन में सिमटें (रोज़ का काम / सेटअप / रिपोर्ट)।

### प्रस्ताव F — **Staff का एक पन्ना**

एक आदमी = एक पन्ना, जिस पर उसके चारों पहलू एक साथ: कौन है · कहाँ तैनात · क्या देख सकता है · login है या नहीं · कितना भुगतान हुआ (Expense से)।

### प्रस्ताव G — **जाँच का तरीक़ा बदलना पड़ेगा**

यही वह बदलाव है जिसके बिना बाक़ी सब दोबारा टूटेगा। अब से हर verify script **वही रास्ता चले जो उपयोगकर्ता चलता है** — service सीधे नहीं, बल्कि HTTP route से, वही body भेजकर जो frontend भेजता है।

एक assertion जो सब कुछ पकड़ लेती:

```
society approval REQUIRED पर सेट करे
  → guard वही करे जो console करता है
  → assert: resident को पूछा गया
  → assert: entry अभी INSIDE नहीं है
  → resident approve करे
  → assert: अब INSIDE है
```

**यह आज लिखी जाए तो fail होगी।** इसीलिए यही पहले लिखी जानी चाहिए।

---

## भाग ४ — क्रम

| # | क्या | क्यों पहले/बाद |
|---|---|---|
| **1** | HTTP-स्तर की flow जाँच, जो अभी **fail** हो | जब तक टूटन दिखे नहीं, ठीक करने का सबूत नहीं |
| **2** | एक प्रवेश-द्वार (`arrival.service`) + entry की नई हालतें | असली सुरक्षा की कमी यही है |
| **3** | Scan → entry, `visitorEntryId` भरना | register का झूठ यहीं बंद होता है |
| **4** | `Gate` entity + entry/exit gate | बाद में जोड़ना पुराने रिकॉर्ड अधूरे छोड़ देगा |
| **5** | UI primitives + AuditFooter | 4 के बाद, ताकि नए fields एक ही बार दिखें |
| **6** | Sidebar सरल करना | कुछ नहीं तोड़ता, कभी भी |
| **7** | निवासी पास | ऊपर वाला ढाँचा बन जाने के बाद |
| **8** | Staff का एक पन्ना + blocklist/vehicles के UI | आख़िर में |

**मेरा सुझाव: 1–3 एक साथ, फिर आप देखें।** वही असली सुरक्षा-कमी है; बाक़ी सुधार हैं।

---

## भाग ५ — जो मुझे आपसे पूछना है

1. **मेहमान अंदर आते वक़्त approval का इंतज़ार करे, या entry बने और approval साथ-साथ चले?**
   मेरा सुझाव: entry `AWAITING` में बने। आदमी gate पर है — उसका रिकॉर्ड न होना ग़लत है। "अंदर" तब भी न गिने।

2. **निवासी की entry-exit दर्ज हो?** मेरा सुझाव: **नहीं** (अभी default भी यही है)। यह निगरानी है, और यही इन apps की सबसे बड़ी शिकायत है। पास पहचान के लिए हो, हाज़िरी के लिए नहीं।

3. **कितने फाटक?** अगर आपकी सोच में हमेशा एक ही है तो `Gate` entity छोटा रह सकता है; 2–4 हैं तो device-binding भी चाहिए।

4. **यह पूरा काम एक साथ करूँ या 1–3 करके रुकूँ?**

---

## भाग ६ — एक साफ़ बात

आपने पूछा *"i want you review everything"*। मैंने किया, और नतीजा यह है:

**जो बना है, वह ठीक बना है। जो नहीं बना, वह इनके बीच का जोड़ है — और वही सबसे ज़रूरी हिस्सा था।**

608 assertions ने हर ईंट जाँची और दीवार एक बार भी नहीं जाँची। यह गिनती का धोखा है, और मुझे रात को "सब पूरा" कहने से पहले यह देखना चाहिए था। आपने एक बार login करके वह पकड़ लिया जो मेरी तेरह scripts नहीं पकड़ पाईं — इसका मतलब मेरी जाँच का तरीक़ा ग़लत था, संख्या कम नहीं थी।

**कोई कोड मैंने अभी नहीं बदला।** आपके जवाब का इंतज़ार है।
