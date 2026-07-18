# ResiSmart — Staff & Visitor Management

### एक ही दस्तावेज़ में: gate पर कौन आया, society में कौन काम करता है, और किसे क्या दिखे — अवधारणा, screens, पूरा उदाहरण, और जो कमियाँ हैं उनकी ईमानदार सूची।

> **दस्तावेज़ की स्थिति — 19 जुलाई 2026**
>
> ⚠️ **यह बनी हुई चीज़ का manual नहीं है। यह एक design दस्तावेज़ है — अभी इसमें से कुछ भी बना नहीं है।**
>
> `FINANCE_MODULE.md` में लिखा है *"जहाँ code और दस्तावेज़ अलग कहें, वहाँ code सही है।"* **यहाँ वह नियम उलटा है** — क्योंकि तुलना करने को code है ही नहीं। जिस दिन Phase 1 बनेगा, यह पंक्ति बदलनी होगी।
>
> जो तथ्य मौजूदा codebase के बारे में कहे गए हैं (क्या है, क्या नहीं), वे 19 जुलाई 2026 को `file:line` सहित जाँचे गए हैं। MyGate और प्रतिस्पर्धियों के बारे में जो कहा गया है, वह सार्वजनिक शोध से है और §3 में स्रोत के साथ है।
>
> **दायरे से बाहर: payroll।** वेतन की गणना, PF, ESIC, gratuity और 192B TDS — इनमें से कुछ भी यह software नहीं करेगा। कारण और आगे का रास्ता §26 में।
>
> भाषा: व्याख्या हिंदी में, तकनीकी नाम/field/code अंग्रेज़ी में — ताकि पढ़ने वाला और बनाने वाला दोनों काम चला सकें।

---

## विषय-सूची

1. [यह module क्या है](#1-यह-module-क्या-है)
2. [शब्दावली](#2-शब्दावली)
3. [शोध से निकले पाँच नियम](#3-शोध-से-निकले-पाँच-नियम)
4. [दो तरह का स्टाफ़ — यह भेद सबसे ज़रूरी है](#4-दो-तरह-का-स्टाफ़)
5. [Staff master — क्या-क्या रखा जाएगा](#5-staff-master)
6. [किस स्टाफ़ को क्या दिखे — permission matrix](#6-permission-matrix)
7. [Permission का backend enforcement](#7-permission-का-backend-enforcement)
8. [ड्यूटी roster और shift](#8-ड्यूटी-roster-और-shift)
9. [हाज़िरी — और वह किसलिए है](#9-हाज़िरी)
10. [काम की सूची (tasks) — माली, प्लंबर, बिजली मिस्त्री](#10-काम-की-सूची)
11. [Visitor — श्रेणियाँ और प्रवाह](#11-visitor-श्रेणियाँ-और-प्रवाह)
12. [अनुमति किससे माँगी जाए](#12-अनुमति-किससे-माँगी-जाए)
13. [Settings — पाँच स्तर और पूरा toggle पेड़](#13-settings)
14. [Resident की अपनी पसंद](#14-resident-की-अपनी-पसंद)
15. [पास, QR और offline सत्यापन](#15-पास-qr-और-offline-सत्यापन)
16. [फ़ोटो और गाड़ी का नंबर](#16-फ़ोटो-और-गाड़ी-का-नंबर)
17. [निकासी — उद्योग की सबसे बड़ी ख़ामी](#17-निकासी)
18. [Guard का override](#18-guard-का-override)
19. [सूचना की सीढ़ी](#19-सूचना-की-सीढ़ी)
20. [सुरक्षा और DPDP](#20-सुरक्षा-और-dpdp)
21. [Data model](#21-data-model)
22. [किस module से क्या जुड़ता है](#22-integration-map)
23. [पूरा उदाहरण — हरित विहार में एक दिन](#23-पूरा-उदाहरण)
24. [बनाने का क्रम](#24-बनाने-का-क्रम)
25. [जाँच की योजना](#25-जाँच-की-योजना)
26. [ज्ञात कमियाँ और जो हम जानबूझकर नहीं कर रहे](#26-ज्ञात-कमियाँ)

---

## 1. यह module क्या है

> Gate पर खड़ा आदमी → guard उसे पहचानता या दर्ज करता है → नियम तय करते हैं कि पूछना है या नहीं → सही घर से पूछा जाता है → अंदर/बाहर का हिसाब रहता है → और स्टाफ़ की हाज़िरी वह सबूत बनती है जिससे एजेंसी का बिल जाँचा जाता है।

एक ही module में दो चीज़ें हैं क्योंकि **gate पर दोनों एक ही दरवाज़े से गुज़रते हैं** — मेहमान भी, माली भी। guard का जो screen मेहमान दर्ज करता है, वही माली की हाज़िरी भी लगाता है। इन्हें अलग बनाना guard के लिए दो apps बनाना होगा, और शोध साफ़ कहता है कि **हर विफलता guard पर आकर टूटती है** (§3)।

**चार सुनहरे नियम — पूरे module में कहीं इनका उल्लंघन नहीं होगा:**

1. **हम access control नहीं बना रहे, हम रिकॉर्ड और सूचना बना रहे हैं।** Guard को software रोक नहीं सकता। इसलिए वादा वह करेंगे जो निभा सकें।
2. **जो दर्ज है वह सच हो, वरना दर्ज ही न हो।** अनुमान लगाया गया डेटा (OCR का नंबर, अपने-आप बंद हुई entry) हमेशा "अनुमानित" के निशान के साथ रहेगा।
3. **मालिक और किरायेदार अलग हैं।** जो नियम flat के कागज़ों पर लगा, वही यहाँ भी — किरायेदार के मेहमान की सूचना मालिक को नहीं जाएगी।
4. **Default में निगरानी नहीं।** Resident की आवाजाही, staff की location, चेहरा-पहचान — कुछ भी अपने आप चालू नहीं। Society चाहे तो चालू करे, जानते-बूझते।

**यह module क्या नहीं है:** यह boom barrier नहीं चलाता, biometric मशीन नहीं है, **payroll नहीं है** (§26), और यह guard के फ़ैसले की जगह नहीं लेता।

---

## 2. शब्दावली

| शब्द | यहाँ इसका मतलब |
|---|---|
| **Gate console** | वह screen जो gate के tablet/फ़ोन पर चलती है। Guard का पूरा संसार यही है। |
| **Society staff** | जिसे society तनख़्वाह देती है — guard, माली, सफ़ाईकर्मी, manager |
| **Household staff** | जिसे resident तनख़्वाह देता है — कामवाली, ड्राइवर, रसोइया। Society का कर्मचारी **नहीं** |
| **Visitor entry** | एक बार का आना-जाना। इसमें check-in है, और शायद check-out |
| **Gate pass** | पहले से बना हुआ न्योता — कोड + QR, जो आने पर भुनाया जाता है |
| **Approval request** | resident से पूछा गया सवाल, जिसका जवाब कुछ सेकंड में चाहिए |
| **Override** | resident ने मना किया या जवाब नहीं दिया, फिर भी guard ने अंदर भेजा |
| **Overstay** | जो अपेक्षित समय से ज़्यादा अंदर रह गया |
| **Auto-close** | दिन के अंत में बची हुई entries को अनुमान से बंद करना, निशान लगाकर |
| **Duty roster** | कौन staff किस दिन, किस shift में |
| **Effective policy** | society के नियम + resident की पसंद, दोनों मिलाकर निकला एक जवाब |
| **Attendance mark** | हाज़िरी का एक रिकॉर्ड — किसने, कब, कहाँ से, किसने पक्का किया |

---

## 3. शोध से निकले पाँच नियम

MyGate, ADDA, NoBrokerHood और ApnaComplex पर शोध से पाँच बातें निकलीं जो design बदलती हैं। ये राय नहीं हैं — हर एक के पीछे स्रोत है।

**१. MyGate का अपना help centre मानता है कि guard को रोका नहीं जा सकता।**
> "The final authority to allow or deny entry rests with the security guard… If a guard chooses to let someone in without waiting for your response, **or despite a denial, the app cannot prevent it.**" — help.mygate.in/articles/134062

इसलिए हमारा लक्ष्य रोकना नहीं, **दिखाना** है (§18)।

**२. निकासी हर जगह टूटी हुई है।** MyGate का आधिकारिक जवाब है कि यह "system की ख़राबी नहीं, guard की आदत" है और हल "guard की दोबारा training" है (help.mygate.in/articles/136260)। कारण ढाँचागत है: **entry ख़ुद को लागू करती है** क्योंकि visitor अंदर आना चाहता है और खड़ा रहता है; **exit के पीछे किसी का स्वार्थ नहीं।** इसलिए हर जगह "अंदर कौन है" सूची कल्पना है। हमारा हल §17 में।

**३. MyGate blacklist दे ही नहीं पाया — और उनका कारण सही है।** उनका कहना है visitor की जानकारी guard हाथ से भरता है, इसलिए वह *"inaccurate or manipulated"* हो सकती है और उस पर भरोसेमंद रोक बनाना *"technically unfeasible"* है (help.mygate.in/articles/134068)। **सीख: पहचान सुलझे बिना blacklist एक दिखावा है** — इसीलिए वह हमारे यहाँ Phase 5 में है, पहले नहीं।

**४. गार्ड की भाषा feature से ज़्यादा मायने रखती है।** ApnaComplex अपना guard interface **8 भाषाओं** में देता है। हर विफलता guard पर टूटती है, और जो screen वह पढ़ नहीं सकता उसे वह छोड़ देगा।

**५. सूचना का चैनल गंदा करना सुरक्षा को नुक़सान पहुँचाता है।** MyGate ने notifications में विज्ञापन भर दिए; Play Store की सबसे आम शिकायत यह है कि residents अब **सुरक्षा alert और car ad में फ़र्क़ नहीं कर पाते।** हमारा gate चैनल कभी विज्ञापन नहीं ढोएगा।

**एक और, जो hack नहीं पर उससे बुरा है:** ThePrint की ज़मीनी रिपोर्ट में गुड़गाँव के एक वकील ने पाया कि **उनके visitor logs पड़ोसियों को दिख रहे थे** — 2024 के चुनाव में प्रचार करने वाले उनसे मिलने आए, और उसके बाद उन्हें घूरा गया और सवाल पूछे गए। यह डेटा चोरी नहीं, **ग़लत access control** था। §20 में इसी का जवाब है।

---

## 4. दो तरह का स्टाफ़

यह भेद पूरे module की रीढ़ है। इन्हें मिलाना सबसे बड़ी design ग़लती होगी।

| | **Society staff** | **Household staff** |
|---|---|---|
| तनख़्वाह कौन देता है | Society | Resident |
| उदाहरण | गार्ड, माली, सफ़ाईकर्मी, manager, प्लंबर, लिफ़्टमैन | कामवाली, ड्राइवर, रसोइया, आया |
| System में login | **हाँ** — `SOCIETY_EMPLOYEE` | **नहीं** — कभी नहीं |
| Module access | designation के अनुसार (§6) | कुछ नहीं |
| Gate पर | हाज़िरी लगती है | आना-जाना दर्ज होता है |
| हाज़िरी किसलिए | **एजेंसी का बिल जाँचने के लिए** (§9) | resident की जानकारी के लिए |
| कई flats में | लागू नहीं | **हाँ** — एक कामवाली 5 घरों में |
| Finance में | भुगतान मौजूदा Expense से, हाथ से | **कुछ नहीं** — society का पैसा नहीं है |

मौजूदा codebase में `Resident.relationship` का एक मान पहले से `'STAFF'` है (`resident.model.ts:89`) — **household staff वहीं रहेगा**, नया model नहीं बनेगा। बस एक बात जोड़नी होगी: एक household staff कई flats से जुड़ सके।

**Society staff के लिए नया `SocietyStaff` model बनेगा** (§5) — क्योंकि उसका जीवन-चक्र अलग है: नियुक्ति, shift, हाज़िरी, सत्यापन, इस्तीफ़ा।

### तीन तरह का रोज़गार, और तीनों का पैसा पहले से चलता है

भारत में सबसे आम बात यह है कि **गार्ड और सफ़ाईकर्मी एजेंसी के होते हैं**, society के नहीं:

| प्रकार | पैसा कैसे जाता है | बना है? |
|---|---|---|
| **AGENCY** — एजेंसी के गार्ड | एजेंसी का बिल → मौजूदा Expense + Vendor, 194C TDS | ✅ पहले से |
| **CONTRACT** — ठेके का मिस्त्री | मौजूदा Expense + Vendor, 194C/194J | ✅ पहले से |
| **DIRECT** — society का अपना माली | **हाथ से एक Expense voucher** — हम गणना नहीं करेंगे | ✅ पहले से |

तीनों में से किसी के लिए इस module को कुछ नया नहीं बनाना। DIRECT कर्मचारी का भुगतान भी बस एक सामान्य expense है — society चाहे तो `POST /ledger/accounts` से अपना खाता बना ले (वह route पहले से है, admin-only), या मौजूदा `5170 Administration` में डाल दे।

**हम वेतन की गणना नहीं करेंगे** — कारण §26 में।

---

## 5. Staff master

```
SocietyStaff
├── societyId, staffCode (SF/0001, gapless)
├── person: { name, phone, email?, photoKey? }
├── designation: SECURITY_GUARD | HEAD_GUARD | GARDENER | HOUSEKEEPING
│                | PLUMBER | ELECTRICIAN | LIFT_OPERATOR | PUMP_OPERATOR
│                | MANAGER | ACCOUNTANT | CLERK | OTHER
├── employmentType: DIRECT | AGENCY | CONTRACT
├── vendorId?                      ← AGENCY हो तो कौन-सी एजेंसी
├── userId?                        ← login हो तो; कई staff को नहीं चाहिए
├── staffRoleId?                   ← नया StaffRole, §6 — मौजूदा PermissionRole नहीं
├── joinedOn, leftOn?, isActive
├── verification: { policeVerifiedOn?, verifiedBy?, documentKey?, expiresOn? }
├── emergencyContact: { name, phone, relation }
├── documents: IStaffDocument[]     ← flat documents वाला ही आकार
├── blocksAssigned?: ObjectId[]     ← माली को सिर्फ़ A व B
└── createdBy/By Name/updatedBy/By Name + timestamps
```

**कुछ सोचे-समझे फ़ैसले:**

- **वेतन का कोई field नहीं** — न `monthlyPaise`, न PF/ESIC/UAN। हम payroll नहीं कर रहे, और जो field हम भरते नहीं वह रखना अपने आप में एक झूठ है। (Finance में यही सबक़ बारह बार मिला: *घोषित, दिखाया गया, पर कभी पढ़ा न गया* field सबसे आम बग है।)
- **`userId` वैकल्पिक है।** सफ़ाईकर्मी को login नहीं चाहिए — उसकी हाज़िरी guard या supervisor लगाएगा। यह वही तर्क है जो `Resident.userId` पर पहले से लगा है: *डेटा में होना और login होना अलग बातें हैं।*
- **Aadhaar का कोई field नहीं।** न staff का, न visitor का। कारण §20 में।
- **`documents` का आकार `IFlatDocument`/`IResidentDocument` जैसा ही** — एक upload route, एक presigned-download आदत, कुछ नया सीखने या बिगाड़ने को नहीं।
- **`verification.expiresOn`** — पुलिस सत्यापन की मियाद ख़त्म होने पर committee को alert। यह असली माँग है और किसी competitor में नहीं मिली।
- **`blocksAssigned`** — माली A और B का है, C का नहीं। इससे उसकी task queue अपने आप छँट जाती है।

---

## 6. Permission matrix

आपकी सीधी माँग: *"sabko unse related module ka hi access mile."*

**Module keys (society स्तर):**

| Key | क्या खुलता है |
|---|---|
| `GATE_CONSOLE` | entry/exit की screen |
| `GATE_LOGS` | पुराना रिकॉर्ड, रिपोर्ट |
| `TASKS_OWN` | "मेरे काम" |
| `TASKS_MANAGE` | काम बाँटना, सबका देखना |
| `STAFF_VIEW` / `STAFF_MANAGE` | staff सूची / नियुक्ति-बदलाव |
| `ATTENDANCE_OWN` / `ATTENDANCE_MANAGE` | अपनी हाज़िरी / सबकी |
| `VISITOR_SETTINGS` | §13 के toggles |
| `RESIDENTS_VIEW` | निवासी निर्देशिका (सीमित — §20) |
| `FINANCE_*` | मौजूदा finance modules |

**डिफ़ॉल्ट नक़्शा** — नियुक्ति करते ही यह लग जाता है, admin बाद में बदल सकता है:

| पद | मिलता है |
|---|---|
| **सुरक्षा गार्ड** | `GATE_CONSOLE`, `ATTENDANCE_OWN` |
| **हेड गार्ड** | ऊपर वाला + `GATE_LOGS`, `ATTENDANCE_MANAGE` (सिर्फ़ गार्डों की) |
| **माली** | `TASKS_OWN`, `ATTENDANCE_OWN` |
| **सफ़ाईकर्मी** | `TASKS_OWN`, `ATTENDANCE_OWN` |
| **प्लंबर / बिजली मिस्त्री** | `TASKS_OWN`, `ATTENDANCE_OWN` |
| **लिफ़्ट/पंप ऑपरेटर** | `TASKS_OWN`, `ATTENDANCE_OWN` |
| **Manager** | `GATE_LOGS`, `TASKS_MANAGE`, `STAFF_MANAGE`, `ATTENDANCE_MANAGE`, `RESIDENTS_VIEW`, `VISITOR_SETTINGS` |
| **Accountant / क्लर्क** | `FINANCE_*`, `GATE_LOGS` (सिर्फ़ पढ़ना) |

**ध्यान देने लायक़ बात:** गार्ड को `RESIDENTS_VIEW` **नहीं** मिलता। उसे मेहमान दर्ज करने के लिए flat नंबर चाहिए — पूरी निर्देशिका नहीं। gate console flat नंबर से खोजने देगा और सिर्फ़ **"A-101 — शर्मा"** दिखाएगा, फ़ोन नंबर नहीं। शोध में यही चूक बार-बार दिखी।

### ⚠️ यह मौजूदा `PermissionRole` **नहीं** है — नया `StaffRole` बनेगा

दो अलग दुनिया हैं, और इन्हें मिलाना नहीं है:

| | `SYSTEM_EMPLOYEE` | `SOCIETY_EMPLOYEE` |
|---|---|---|
| किसका कर्मचारी | **ResiSmart का** (platform चलाने वाली कंपनी) | **एक society का** |
| Tenant | `SYSTEM` | `SOCIETY` |
| उदाहरण | support staff जो societies/shops संभाले | गार्ड, माली, manager |
| Modules | `societies`, `shops`, `audit-logs`, `settings` | `GATE_CONSOLE`, `TASKS_OWN`, … |
| दायरा | पूरा platform | सिर्फ़ अपनी society |

मौजूदा `PermissionRole` **सिर्फ़ पहली दुनिया के लिए है**, और उसे दोबारा इस्तेमाल करना दो पक्की गड़बड़ियाँ लाता:

1. **उसमें `societyId` है ही नहीं** (`permission-role.model.ts:35-63`) → एक society का manager दूसरी society का role उठा सकता। यह cross-society रिसाव है
2. **`name` globally unique है** (`:41`) → हरित विहार "Manager" बना ले, तो शांति निकेतन को duplicate-key error मिलेगा। दूसरी society यह समझ ही नहीं पाएगी कि क्यों

इसलिए **नया `StaffRole` model**, जिसमें `societyId` हो और **unique `(societyId, name)`** पर हो।

**चौकड़ी का आकार वही रहेगा** — `canRead / canCreate / canEdit / canDelete` — ताकि admin को नया ढाँचा न सीखना पड़े और permission-editor screen का pattern दोहराया जा सके। **आकार उधार, collection नहीं।**

---

## 7. Permission का backend enforcement

**यहाँ एक मौजूदा ख़ामी है जिसकी नक़ल हम नहीं करेंगे।**

आज `PermissionRole` में `canRead/canCreate/canEdit/canDelete` सहेजा जाता है, admin उसे screen पर बदल भी सकता है — पर **backend में कोई जाँच नहीं है।** पूरे `backend/src` में `requirePermission`, `checkPermission`, `hasPermission` जैसा कुछ भी नहीं है। सिर्फ़ `authorizeRoles` है, जो केवल role देखता है। Sidebar `moduleKey` पर छाँटता है — पर वह **client-side है**, और client पर छँटा हुआ menu सुरक्षा नहीं है; API सीधे बुलाई जा सकती है।

आपने कहा था *"industry level secure in every case… koi loophole ho bhi to use bhi sahi krna hai"* — इसलिए:

**नया middleware, backend पर असली जाँच:**

```ts
requirePermission('GATE_CONSOLE', 'create')
```

- यह `req.user` से staff का `staffRoleId` निकालेगा, permission चौकड़ी देखेगा, और न होने पर **403**।
- हर नए route पर लगेगा — कोई अपवाद नहीं।
- Sidebar का client-side filter **बना रहेगा**, पर सिर्फ़ सुविधा के लिए (न दिखे जो काम न करे), सुरक्षा के लिए नहीं।

**और एक अलग काम, जो इस module के दायरे से बाहर है पर दर्ज होना चाहिए:** मौजूदा SYSTEM_EMPLOYEE की permissions भी इसी तरह backend पर लागू नहीं हैं। वह एक स्वतंत्र सुरक्षा-कमी है। मैं उसे यहाँ चुपचाप ठीक नहीं कर रहा क्योंकि वह दूसरा module है और उसका अपना परीक्षण चाहिए — **पर आपको यह जानना चाहिए।**

---

## 8. ड्यूटी roster और shift

```
StaffShift        — shift की परिभाषा: नाम, शुरू, ख़त्म, रात है या नहीं
StaffRosterEntry  — staffId + तारीख़ + shiftId + gate/क्षेत्र
```

- Shift **society के हिसाब से** बनेंगे — कहीं 12-12 घंटे के दो, कहीं 8-8 के तीन।
- Roster हफ़्ते/महीने भर के लिए एक साथ बनेगा, और दोहराया जा सकेगा (हर सोमवार वही)।
- **Guard का login उसके shift से बँधा होगा** — shift ख़त्म, token ख़त्म। इससे यह भी पता रहेगा कि किसी entry के समय ड्यूटी पर कौन था। यह §18 के लिए ज़रूरी है।
- रात की shift आधी रात पार करती है — तारीख़ shift के **शुरू** से गिनी जाएगी, वरना हर रात की हाज़िरी दो दिनों में बँट जाएगी। (यही ग़लती finance में financial-year के साथ हो चुकी है; दोबारा नहीं।)

---

## 9. हाज़िरी

### पहले यह — हाज़िरी किसलिए है

चूँकि हम वेतन नहीं बनाते, यह सवाल जायज़ है कि हाज़िरी क्यों रखें। **एक ही कारण, और वह अपने आप में काफ़ी है:**

> एजेंसी महीने के अंत में **4 गार्ड × 30 दिन** का बिल भेजती है। हाज़िरी कहती है कि एक गार्ड 4 दिन नहीं आया। Manager बिल घटवाता है।

Society का असली नुक़सान यहीं होता है, और आज इसे पकड़ने का कोई तरीक़ा नहीं है। **यह अकेला उपयोग payroll के बिना भी हाज़िरी को पूरी तरह सार्थक बना देता है** — और यही वह जगह है जहाँ यह module अपनी क़ीमत वसूल कर लेता है।

दूसरा कारण छोटा पर असली है: committee को पता रहे कि माली सच में रोज़ आता है या नहीं।

### दो रास्ते, और दोनों चाहिए

| रास्ता | कौन | कैसे |
|---|---|---|
| **ख़ुद लगाए** | जिनके पास login है | gate console या फ़ोन पर "काम शुरू" / "काम ख़त्म" |
| **कोई और लगाए** | जिनके पास login नहीं | guard/supervisor सूची में से चुनकर, फ़ोटो के साथ |

```
AttendanceMark
├── staffId, societyId, date, shiftId?
├── inAt?, outAt?
├── source: SELF | GUARD | SUPERVISOR | AUTO_CLOSE
├── markedByStaffId?, markedByUserId?
├── inPhotoKey?, outPhotoKey?
├── status: PRESENT | ABSENT | HALF_DAY | LEAVE | WEEKLY_OFF | HOLIDAY
├── isEstimated: boolean            ← AUTO_CLOSE से बना हो तो true
└── note?
```

**नियम:**
- `AUTO_CLOSE` से बनी हाज़िरी हमेशा `isEstimated: true` — और **अनुमानित हाज़िरी एजेंसी के बिल से मिलान में नहीं गिनी जाएगी** जब तक manager उसे पक्का न करे। यह §1 का नियम २ है, और यहाँ इसका पैसों वाला नतीजा है: अनुमान पर बिल नहीं कटना चाहिए।
- छुट्टी, साप्ताहिक अवकाश और त्योहार पहले से भरे जा सकेंगे, ताकि महीने के अंत में "अनुपस्थित" का ग़लत ढेर न लगे।
- हाज़िरी बदली जा सकेगी, पर **पुराना मान audit में रहेगा** — यह बिल घटाने का आधार है, और बिल विवाद का विषय है।
- **Staff की location कभी दर्ज नहीं होगी।** हाज़िरी gate पर लगती है, यही काफ़ी है।

---

## 10. काम की सूची

माली, प्लंबर और बिजली मिस्त्री को कुछ चाहिए **जिस पर वे काम करें** — वरना `TASKS_OWN` खाली डिब्बा है। आज repo में complaints/tickets/tasks **कुछ नहीं है** — पूरी तरह नया।

```
Task
├── societyId, taskCode
├── title, description, photos[]
├── category: PLUMBING | ELECTRICAL | GARDEN | CLEANING | LIFT | SECURITY | OTHER
├── raisedBy: { userId, name, flatId? }      ← resident या committee
├── scope: SOCIETY | BLOCK | FLAT            ← common area या किसी के घर का
├── blockId?, flatId?
├── assignedToStaffId?
├── status: OPEN | ASSIGNED | IN_PROGRESS | DONE | VERIFIED | CLOSED | REJECTED
├── priority: LOW | NORMAL | HIGH | URGENT
├── dueOn?, completedOn?, completionPhotos[]
└── audit quad
```

- **`VERIFIED` अलग से है** — staff "हो गया" कहे और शिकायत करने वाला पक्का करे, ये दो अलग बातें हैं। बिना इसके हर काम "हो गया" हो जाता है।
- माली को सिर्फ़ `GARDEN` + उसके `blocksAssigned` के काम दिखेंगे।
- Resident सिर्फ़ **अपनी** शिकायतें देखेगा, पड़ोसी की नहीं (§20 का वही नियम)।
- यह module अपने आप में बड़ा है। **Phase 4** में है, और अगर आप चाहें तो इसे बिल्कुल अलग module बनाकर बाद में कर सकते हैं — gate/staff इसके बिना पूरा चलता है।

---

## 11. Visitor — श्रेणियाँ और प्रवाह

**छह श्रेणियाँ, हर एक के अपने नियम:**

| श्रेणी | ख़ास बात |
|---|---|
| **मेहमान** | सामान्य — अनुमति चाहिए |
| **रिश्तेदार** | पहले से बुलाया जा सकता है, बार-बार का पास |
| **डिलीवरी** | "gate पर छोड़ दो" का विकल्प; resident का default चलता है |
| **कैब** | आम तौर पर सिर्फ़ बताना, अनुमति नहीं |
| **Household staff** | पहले से पंजीकृत — रोज़ नहीं पूछा जाएगा |
| **ठेकेदार / मिस्त्री** | ज़्यादा जानकारी, शायद committee की मंज़ूरी |

**Guard का प्रवाह — तीन tap में entry:**

```
1. कौन?          → [मेहमान] [डिलीवरी] [कैब] [स्टाफ़] [ठेकेदार]
2. किसके पास?     → flat नंबर टाइप → "B-704 — वर्मा" 
                    (पहले से पंजीकृत हो तो नाम/फ़ोन से सीधा मिल जाएगा)
3. नाम + फ़ोटो    → [अंदर भेजें]
```

फिर policy के अनुसार: या तो तुरंत अंदर, या "पूछा जा रहा है…" के साथ रुकना।

**पहले से बुलाया हुआ मेहमान** इससे भी छोटा है: **QR स्कैन → हरा निशान → अंदर।** एक tap।

---

## 12. अनुमति किससे माँगी जाए

यह वह हिस्सा है जो सबसे ज़्यादा ग़लत हो सकता है, इसलिए नियम स्पष्ट हैं।

**पहला सवाल — कौन-सा घर?**

| Flat की स्थिति | किससे पूछें | क्यों |
|---|---|---|
| `RENTED` | **सिर्फ़ किरायेदार परिवार** | मालिक को यह जानना कि किरायेदार से कौन मिलने आया — निजता का उल्लंघन है |
| `OWNER_OCCUPIED` | मालिक परिवार | सीधा |
| `VACANT` | **committee / admin** | खाली flat पर कोई आया — यही अपने आप में देखने लायक़ बात है |

यह ठीक वही सिद्धांत है जो flat के दस्तावेज़ों पर लगा है (*किरायेदार को मालिक के कागज़ नहीं दिखते*), और वही `householdType: 'OWNER' | 'TENANT'` field दोबारा काम आएगा। **कुछ नया नहीं चाहिए।**

**दूसरा सवाल — घर के भीतर किसे?**

```
listHouseholdMembers(flatId, societyId)
  → isActive === true
  → loginStatus === 'LOGIN'          ← data-only सदस्य पूछे ही नहीं जा सकते
  → isHead पहले, फिर बाक़ी साथ-साथ
  → जो पहले जवाब दे, वही अंतिम
```

**और अगर पूरे घर में किसी का login नहीं है?** छोटी societies में यह आम है। तब कोई approval संभव ही नहीं — सीधे policy के fallback पर (§13 का `onTimeout`)। **यह हालत पहले दिन से संभालनी है**, वरना guard हमेशा घूमते चक्र में फँसा रहेगा। शोध में यह कहीं नहीं दिखा — शायद इसीलिए क्योंकि MyGate मान लेता है कि सबके पास app है।

---

## 13. Settings

### पाँच तैयार स्तर

आपकी बात — *"admin says society is small, he just wants entry exit, no scanning"*:

| स्तर | क्या मिलता है | किसके लिए |
|---|---|---|
| **L1 — डिजिटल रजिस्टर** | सिर्फ़ entry। कोई अनुमति, कोई scan, कोई exit नहीं | 20–40 flat, कागज़ी रजिस्टर की जगह |
| **L2 — + निकासी** | check-in + check-out, "अभी अंदर कौन है", overstay alert | जहाँ हिसाब चाहिए |
| **L3 — + अनुमति** | resident से पूछना, "gate पर छोड़ दो" | ज़्यादातर societies |
| **L4 — + पास व स्कैनर** | पहले से न्योता, QR + कोड, guard स्कैन करे | बड़ी societies |
| **L5 — + गाड़ी व स्टाफ़** | vehicle entry/exit, staff हाज़िरी, tasks | पूरी सुविधा |

**Preset सिर्फ़ toggles भर देता है।** उसके बाद हर switch अलग से बदला जा सकता है — यानी कोई भी मनचाही combination बन सकती है, पर admin को 30 switch से शुरुआत नहीं करनी पड़ती।

### पूरा toggle पेड़

```
VisitorPolicy (एक society = एक document)
│
├── level: L1 | L2 | L3 | L4 | L5 | CUSTOM
│
├── capture
│   ├── photo:        OFF | OPTIONAL | REQUIRED
│   ├── phone:        OFF | OPTIONAL | REQUIRED     ← default OPTIONAL (§20)
│   ├── idProof:      OFF | OPTIONAL | REQUIRED
│   ├── allowedIdTypes: []                          ← Aadhaar सूची में नहीं
│   └── categoriesEnabled: []
│
├── exit
│   ├── trackExit: boolean
│   ├── mode: MANUAL | SCAN | AUTO_EXPIRE
│   ├── overstayAlertAfterMinutes: number
│   ├── autoCloseAtHour: number                     ← रोज़ रात, §17
│   └── autoCloseNotifyCommittee: boolean
│
├── approval  (हर श्रेणी के लिए अलग)
│   ├── mode: NONE | NOTIFY_ONLY | REQUIRED
│   ├── timeoutSeconds: number
│   ├── onTimeout: HOLD | GUARD_DECIDES | AUTO_DENY
│   ├── whoCanApprove: ANY_ADULT | HEAD_ONLY | OWNER_ONLY
│   ├── allowGuardOverride: boolean
│   └── overrideRequiresReason: boolean             ← चालू हो तो हमेशा true
│
├── passes
│   ├── enabled, form: CODE | QR | BOTH
│   ├── defaultValidityMinutes, maxValidityHours
│   ├── singleUse: boolean
│   └── offlineValidation: boolean                  ← §15
│
├── vehicles
│   ├── trackVehicles, trackVehicleExit
│   ├── residentRegistry: boolean
│   └── plateOcr: { enabled, provider, suggestOnly } ← suggestOnly हमेशा true
│
├── residents
│   ├── logResidentMovement: boolean                ← default false (§20)
│   └── logResidentVehicleOnly: boolean
│
├── privacy
│   ├── retentionDays: number                       ← default 90, सीमा 30–180
│   ├── residentSeesOwnFlatOnly: boolean            ← default true, बदला नहीं जा सकता
│   └── purgePhotosWithEntry: boolean               ← default true
│
├── guardApp
│   ├── language: hi | en | mr | ta | te | bn | gu | or | kn
│   ├── offlineQueueEnabled: boolean
│   └── shiftBoundSession: boolean
│
└── modules: string[]                               ← ⚠️ schema में default नहीं
```

> **`modules` पर default क्यों नहीं:** finance में यही सबक़ मिला था। अगर schema में `default: []` लगा दिया, तो *"कभी चुना ही नहीं"* और *"जानबूझकर कुछ नहीं चुना"* एक हो जाएँगे — और जिस दिन यह feature चालू होगा, चालू societies की screens ग़ायब हो जाएँगी। यह डेटा नष्ट होने जैसा दिखेगा, भले कुछ नष्ट न हुआ हो। इसलिए `undefined` = कभी तय नहीं, `[]` = जानबूझकर कुछ नहीं।

---

## 14. Resident की अपनी पसंद

```
ResidentGatePreference (एक resident + एक flat = एक document)
├── frequentVisitors[]: { name, phone, category, autoApprove, validTill? }
├── deliveryDefault: ASK_ME | LEAVE_AT_GATE | ALWAYS_ALLOW
├── cabDefault: ASK_ME | ALWAYS_ALLOW
├── quietHours: { from: "23:00", to: "07:00", action: HOLD | LEAVE_AT_GATE }
├── notifyChannels: PUSH | EMAIL
└── notifyWhichMembers: ALL_LOGIN | HEAD_ONLY | SELECTED[]
```

**छत का नियम — यह पूरे module में सबसे ज़रूरी अकेली पंक्ति है:**

> **Admin छत तय करता है, resident उसके भीतर चुनता है।**

अगर admin ने डिलीवरी पर `approval.mode = REQUIRED` कर रखा है, तो कोई resident `ALWAYS_ALLOW` नहीं लगा सकता — screen पर वह विकल्प धूसर दिखेगा, कारण के साथ: *"आपकी society ने हर डिलीवरी पर अनुमति अनिवार्य की है।"*

यह गणित **एक ही जगह** होगा:

```ts
effectivePolicy(societyPolicy, residentPref, category, now) → ResolvedRules
```

Gate console, resident app, और backend तीनों यही function बुलाएँगे। **दो जगह दो अलग जवाब कभी नहीं निकलेंगे** — क्योंकि जवाब निकालने की जगह ही एक है।

---

## 15. पास, QR और offline सत्यापन

**दो रूप, दो अलग ज़रूरतें:**

| | 6-अंकीय कोड | हस्ताक्षरित QR |
|---|---|---|
| किसके लिए | इंसान — फ़ोन पर बोला जा सके | मशीन — स्कैन |
| सुरक्षा | server पर जाँच, rate-limit, थोड़ी देर का | HMAC हस्ताक्षर, छेड़ा नहीं जा सकता |
| Offline चलेगा? | नहीं | **हाँ** |

**QR के भीतर:** `societyId | passId | flatId | category | validFrom | validTo | nonce | HMAC`

**Offline क्यों मायने रखता है:** gate का इंटरनेट जाता है — यह भारत में नियम है, अपवाद नहीं। ADDA इसे अपने प्रमुख feature की तरह बेचता है। हस्ताक्षरित QR **बिना network के** जाँचा जा सकता है क्योंकि guard के device के पास society की सार्वजनिक कुंजी होगी। entry queue में जाएगी और network आते ही sync होगी।

**दो ख़तरे जो offline में बचे रहते हैं, और उनका जवाब:**
- **एक ही QR दो gate पर** — offline में रोका नहीं जा सकता। इसलिए sync के बाद server दोहरे इस्तेमाल को पकड़ेगा और committee को दिखाएगा। रोकना नहीं, दिखाना — §1 का नियम १।
- **रद्द किया हुआ पास** — offline device को पता नहीं चलेगा। इसलिए offline वैधता की अधिकतम सीमा छोटी रहेगी (डिफ़ॉल्ट 12 घंटे), ताकि रद्द करने की खिड़की सीमित रहे।

**न्योता भेजना:** WhatsApp/SMS/link — resident एक tap में भेजे। कोड + QR + society का पता + नक़्शे का link, सब एक संदेश में।

---

## 16. फ़ोटो और गाड़ी का नंबर

**फ़ोटो** — दो: चेहरा और गाड़ी। `s3.uploadBuffer` तैयार है, `visitor-photos/` prefix, presigned link, कभी सीधा URL नहीं।

- **Browser में ही compress** — gate का tablet कमज़ोर network पर होता है; 4MB की फ़ोटो वहाँ नहीं चढ़ेगी। ~200KB तक लाकर भेजेंगे।
- फ़ोटो entry के साथ ही मिटेगी (§20)।

**गाड़ी का नंबर — यहाँ एक बात पूरे सवाल को बदल देती है:**

> **Resident की गाड़ियों के लिए ANPR की ज़रूरत ही नहीं है।**

Resident की गाड़ियाँ एक **जानी-पहचानी, सीमित सूची** हैं। Guard "DL8C" टाइप करे और dropdown में पंजीकृत गाड़ियाँ दिखें — यह OCR से **तेज़ भी है और 100% सही भी।** ANPR सिर्फ़ *अनजान मेहमान* की गाड़ी पर मदद करता है, जो छोटा और कम अहम हिस्सा है।

इसलिए:

| चरण | क्या |
|---|---|
| **A — सस्ता, पक्का** | `ResidentVehicle` registry + autocomplete। किरायेदार के जाते ही उसकी गाड़ियाँ निष्क्रिय (मौजूदा move-out flow से) |
| **B — OCR** | फ़ोटो हमेशा खिंचेगी। OCR उसके ऊपर **सुझाव** देगा — भरा हुआ पर **"अनुमान" के निशान के साथ**, guard एक tap में पक्का करे |

**कभी चुपचाप autofill नहीं।** भारतीय प्लेटों पर ANPR उतना भरोसेमंद नहीं जितना बेचा जाता है — फ़ैंसी fonts, गंदी प्लेटें, टेढ़ा कोण, रात, दोपहिया की छोटी प्लेट। ADDA की अपनी तुलना यही कहती है: ANPR रोशनी पर निर्भर है और नक़ली प्लेट से चकमा खा जाता है। **अगर ग़लत नंबर चुपचाप रिकॉर्ड बन गया, तो जिस दिन उस रिकॉर्ड की ज़रूरत पड़ेगी उसी दिन वह झूठा निकलेगा।**

Provider एक बदली जा सकने वाली interface के पीछे रहेगा (Google Vision / PlateRecognizer / बाद में self-hosted), per-society चालू-बंद, क्योंकि हर lookup पर पैसा लगता है।

**RFID एक बेहतर विकल्प है** resident की गाड़ियों के लिए — MyGate यही करता है (Park+ के ज़रिए), और वह ANPR से ज़्यादा भरोसेमंद है। पर वह hardware का फ़ैसला है, इसलिए यहाँ सिर्फ़ एक webhook की जगह छोड़ी गई है।

---

## 17. निकासी

**यह उद्योग की सबसे बड़ी अनसुलझी समस्या है** (§3, नियम २)। MyGate का जवाब "guard को दोबारा training दो" है। वह कभी काम नहीं करेगा, क्योंकि समस्या आदत की नहीं, **प्रोत्साहन की** है।

**हमारा चार-परत हल:**

**१. हर entry की अपेक्षित अवधि हो।** पास पर वैधता होती है; बिना पास वाली entry को श्रेणी के हिसाब से डिफ़ॉल्ट मिलेगा (डिलीवरी 15 मिनट, मेहमान 4 घंटे, मिस्त्री 8 घंटे)।

**२. समय बीतने पर overstay alert** — guard को, और अगर society चाहे तो resident को। यह NoBrokerHood से लिया गया विचार है, और यह अकेला competitor है जिसने इस दिशा में कुछ किया।

**३. रोज़ रात auto-close।** तय समय पर बची हुई entries अपने आप बंद, `exitSource: AUTO_CLOSE` और **`isEstimated: true`** के साथ। यह झूठ नहीं है — यह साफ़-साफ़ कहा गया अनुमान है।

**४. सुबह committee को reconciliation।** *"कल 47 entries, 41 की निकासी दर्ज, 6 अनुमान से बंद।"* अब यह एक संख्या है जिसे सुधारा जा सकता है।

**अंतर यह है:** MyGate की "अंदर कौन है" सूची चुपचाप ग़लत होती है। हमारी सूची **अपनी ग़लती की माप के साथ आएगी।** जब वह संख्या हर दिन 6 दिखेगी, तब committee guard से बात करेगी — और यही असली हल है, क्योंकि यह समस्या software की नहीं, प्रबंधन की है। हमारा काम उसे **दृश्यमान** बनाना है।

---

## 18. Guard का override

MyGate मानता है कि guard को रोका नहीं जा सकता। हम भी नहीं रोकेंगे — **हम उसे गिनेंगे।**

```
अनुमति नहीं मिली (मना हुआ / जवाब नहीं आया)
      ↓
guard "फिर भी अंदर भेजें" दबाता है
      ↓
कारण अनिवार्य — [परिचित है] [resident ने फ़ोन पर कहा] [आपात] [अन्य + लिखें]
      ↓
entry बनती है, पर लाल निशान के साथ
      ↓
audit में दर्ज: कौन guard, कौन-सी shift, क्या कारण, resident ने क्या कहा था
      ↓
resident को तुरंत सूचना — "आपके मना करने के बाद भी अंदर भेजा गया"
      ↓
महीने की रिपोर्ट committee को
```

**महीने की रिपोर्ट का एक वाक्य:**
> *"रमेश (रात shift): 41 अनुमति-माँगों में से 12 बार बिना जवाब आए अंदर भेजा।"*

यह एक संख्या है, feature नहीं — और यह किसी प्रतिस्पर्धी में नहीं है। यह अकेली चीज़ MyGate के पूरे approval flow से ज़्यादा सुरक्षा देती है, क्योंकि यह उस जगह रोशनी डालती है जहाँ असल में फ़ैसला होता है।

**Resident को तुरंत बताना क्यों ज़रूरी है:** अगर उसे महीने बाद पता चले, तो सूचना बेकार है। अगर तुरंत पता चले, तो वह उसी वक़्त फ़ोन कर सकता है।

---

## 19. सूचना की सीढ़ी

**यह module का सबसे बड़ा नया infrastructure है।** आज इस codebase में **कोई real-time रास्ता नहीं है** — न push, न socket, न SSE, न SMS। सिर्फ़ email है। और email से gate पर खड़े guard का काम नहीं चलता।

**सुझाई गई सीढ़ी:**

```
1. Push (FCM)          → mobile app + browser, एक साथ
2. In-app / SSE        → resident का app या dashboard खुला हो तो तुरंत
3. timeout             → policy के अनुसार: HOLD | GUARD_DECIDES | AUTO_DENY
4. Email               → सिर्फ़ रिकॉर्ड के लिए, फ़ैसले के लिए नहीं
```

**FCM ही क्यों:** एक ही चीज़ से Expo mobile push और browser web push दोनों मिलते हैं। backend पर एक `firebase-admin`, और दोनों सतहें सध जाती हैं।

**SMS/IVR आज मौजूद नहीं** — `otp.service.ts:4` ख़ुद कहता है *"no SMS gateway yet."* MyGate की सीढ़ी में IVR call एक अहम कड़ी है (फ़ोन बंद हो तब भी घंटी बजती है)। हमारे पास वह नहीं है। **यह एक पैसे वाला फ़ैसला है, तकनीकी नहीं** — MSG91/Twilio जोड़ना कठिन नहीं, पर हर संदेश पर ख़र्च है। जब तक तय न हो, `onTimeout` ही असली सुरक्षा-जाल है।

**एक वादा:** gate का सूचना चैनल **कभी विज्ञापन नहीं ढोएगा** (§3, नियम ५)।

---

## 20. सुरक्षा और DPDP

### DPDP अधिनियम 2023 — society ही ज़िम्मेदार है

सबसे अहम बात: **Data Fiduciary society/RWA है, app बनाने वाला नहीं।** MyGate के सह-संस्थापक का सार्वजनिक बयान — *"we are not the custodians of the data, the data belongs to the RWAs"* — क़ानूनी रूप से विवादित है, पर व्यावहारिक असर यह है कि **जुर्माना society पर आएगा** (₹250 करोड़ तक)। इसलिए हमारे defaults ही उनकी compliance बनेंगे।

| ज़रूरत | हमारा जवाब |
|---|---|
| स्पष्ट सहमति | पहली बार gate पर visitor को सूचना; AGM का प्रस्ताव सहमति **नहीं** माना जाता |
| कम से कम डेटा | फ़ोन **वैकल्पिक** default; फ़ोटो society तय करे |
| उद्देश्य-सीमा | gate का डेटा marketing में कभी नहीं |
| मिटाना | auto-purge, default 90 दिन (30–180) |
| वापस लेना | resident अपना रिकॉर्ड मिटवा सके, बिना शुल्क |

### Aadhaar — field बनेगा ही नहीं

- निजी संस्था पहचान के लिए Aadhaar **माँग नहीं सकती** (Puttaswamy के बाद §57 रद्द)।
- UIDAI के अनुसार **फ़ोटोकॉपी रखना ही अधिनियम का उल्लंघन है।**
- Aadhaar अधिनियम के तहत दंड DPDP से अलग और ऊपर है।

Societies यह ग़लती रोज़ करती हैं। **हम Aadhaar का field ही नहीं बनाएँगे** — न visitor का, न staff का। अगर सत्यापन चाहिए तो कोई और सरकारी ID, या बेहतर — सिर्फ़ *"सत्यापित: हाँ"* रखें, दस्तावेज़ नहीं।

### पड़ोसी की नज़र — असली छेद

ThePrint की रिपोर्ट (§3) में जो हुआ वह hack नहीं था, **access control की चूक** थी। इसलिए:

| कौन | क्या देख सकता है |
|---|---|
| Resident | **सिर्फ़ अपने flat** के visitors |
| मालिक (flat किराए पर) | **किरायेदार के मेहमान नहीं** |
| Guard | ड्यूटी के दौरान की entries; निवासी निर्देशिका **नहीं** |
| Manager | सब कुछ, audit के साथ |
| Committee | कुल आँकड़े; व्यक्तिगत log सिर्फ़ कारण दर्ज करके |

`privacy.residentSeesOwnFlatOnly` **बदला नहीं जा सकता।** यह setting नहीं, नियम है।

### बाक़ी सुरक्षा

- **Gate pass पर HMAC** — 6 अंक अनुमान लगाए जा सकते हैं, हस्ताक्षर नहीं
- **कोड एक बार में जलेगा** — server पर, atomically
- **Guard सत्र shift से बँधा** — shift ख़त्म, token ख़त्म
- **Gate device के लिए अलग rate-limit tier** — आज का 300/15min pass स्कैन में उड़ जाएगा
- **हर query में `societyId` हाथ से** — इस codebase में कोई global tenant filter नहीं है; एक handler में भूले तो cross-society रिसाव
- **`requirePermission` backend पर** (§7)
- **फ़ोटो निजी prefix + presigned**, entry के साथ मिटेगी
- **हर override, deny, manual exit, permission बदलाव** → audit

---

## 21. Data model

**नए models:**

| Model | क्या |
|---|---|
| `VisitorPolicy` | per-society settings (§13) |
| `ResidentGatePreference` | per-resident पसंद (§14) |
| `Visitor` | बार-बार आने वालों की पहचान (फ़ोन से) |
| `VisitorEntry` | एक आना-जाना |
| `GatePass` | पहले से बना न्योता |
| `ApprovalRequest` | पूछा गया सवाल + जवाब |
| `ResidentVehicle` | flat से जुड़ी गाड़ियाँ |
| `SocietyStaff` | §5 |
| `StaffRole` | per-society permissions — **unique `(societyId, name)`**, §6 |
| `StaffShift`, `StaffRosterEntry` | §8 |
| `AttendanceMark` | §9 |
| `Task` | §10 (Phase 4) |
| `PushToken` | device के push tokens |

**मौजूदा में बदलाव:**

| क्या | कहाँ | क्यों |
|---|---|---|
| `SOCIETY_EMPLOYEE` ज़िंदा करना | `constants/roles.ts:17` | आज सिर्फ़ घोषित है, कहीं इस्तेमाल नहीं |
| Household staff कई flats में | `resident.model.ts` | एक कामवाली, पाँच घर |
| `visitorModule` sidebar field | `sidebarContent.tsx` | **तीसरा** field — `financeModule`/`moduleKey` नहीं |
| `requirePermission` middleware | नया | §7 |

**Finance में कुछ नहीं बदलेगा।** payroll न होने का एक अच्छा साइड-इफ़ेक्ट यह है कि chart of accounts, `subLedgerDimension`, TDS की धाराएँ और Society का schema — किसी को छूने की ज़रूरत नहीं। जो finance आज हरा है, वह वैसा ही रहेगा।

---

## 22. Integration map

```
                    ┌─────────────────┐
                    │  Gate Console   │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
  ┌───────────┐       ┌────────────┐       ┌────────────┐
  │  Visitor  │       │   Staff    │       │  Vehicle   │
  └─────┬─────┘       └─────┬──────┘       └─────┬──────┘
        │                   │                    │
        ▼                   ▼                    │
  ┌───────────┐       ┌────────────┐             │
  │ Household │       │  हाज़िरी   │             │
  │ (Resident)│       └─────┬──────┘             │
  └─────┬─────┘             │                    │
        │                   ▼                    ▼
        │             ┌──────────────────────────────┐
        │             │          Finance             │
        │             │  एजेंसी बिल जाँच · parking   │
        │             │  (सिर्फ़ पढ़ना — कुछ नया नहीं) │
        ▼             └──────────────────────────────┘
  ┌───────────┐
  │  Flat     │  status → अनुमति किससे (§12)
  └───────────┘
```

| जुड़ाव | क्या होता है |
|---|---|
| Household → अनुमति | `listHouseholdMembers` + `householdType` से तय कि किससे पूछें |
| Flat status → routing | `RENTED` / `OWNER_OCCUPIED` / `VACANT` तीन अलग रास्ते |
| **एजेंसी बिल ↔ हाज़िरी** | *"4 गार्ड का बिल, हाज़िरी 3 की"* — **module की सबसे बड़ी क़ीमत यहीं है** (§9) |
| गाड़ी → parking शुल्क | `Flat.quantities` + `PER_QUANTITY` पहले से मौजूद |
| Vendor → staff | एजेंसी के गार्ड `vendorId` से जुड़े |
| स्टाफ़ का भुगतान | मौजूदा Expense, हाथ से — कोई नई पाइप नहीं |
| सब कुछ → Audit | मौजूदा `auditFinance` (नाम भ्रामक है, काम सही करता है) |

---

## 23. पूरा उदाहरण

**हरित विहार सहकारी गृह निर्माण संस्था, पुणे** — 120 flat, 3 block (A/B/C), स्तर **L4**।
स्टाफ़: 4 गार्ड (2 shift, एजेंसी से), 1 माली (society का), 3 सफ़ाईकर्मी (एजेंसी), 1 manager (society का)।

**नियम:** डिलीवरी → अनुमति ज़रूरी, 45 सेकंड, फिर guard तय करे। मेहमान → अनुमति ज़रूरी, 60 सेकंड, फिर रोके रखो। override चालू, कारण अनिवार्य। रिकॉर्ड 90 दिन।

---

**सुबह 5:58 — shift बदली**
रात वाला गार्ड सुरेश gate console पर "shift समाप्त" दबाता है। दिन वाला रमेश अपना QR स्कैन करता है — `AttendanceMark { staffId: रमेश, inAt: 05:58, source: SELF, shiftId: DAY }`। रमेश का token अब शाम 6 बजे तक का है।

**सुबह 7:12 — माली**
गंगाराम आता है। उसके पास login नहीं है, तो रमेश सूची से उसे चुनकर फ़ोटो के साथ हाज़िरी लगाता है — `source: GUARD`।

**सुबह 9:34 — डिलीवरी, और यहाँ असली बात है**
Swiggy वाला B-704 के लिए आता है। **B-704 किराए पर है।** रमेश "डिलीवरी" + "B-704" दबाता है।

सिस्टम `flat.status === 'RENTED'` देखता है → **सिर्फ़ किरायेदार परिवार को पूछता है।** मालिक श्री देशपांडे (जो पुणे में ही रहते हैं) को **कुछ नहीं जाता** — उन्हें यह जानने की कोई ज़रूरत नहीं कि उनके किरायेदार ने क्या मँगाया।

किरायेदार परिवार में 3 सदस्य हैं। दो के पास login है, सास के पास नहीं (`loginStatus: 'DATA_ONLY'`) — **उन्हें पूछा ही नहीं जाता।** 11 सेकंड में बहू approve करती है। एक tap, अंदर।

**सुबह 10:05 — पहले से बुलाया मेहमान**
A-302 की श्रीमती जोशी ने कल रात अपनी बहन को न्योता भेजा था — WhatsApp पर QR गया। बहन QR दिखाती है, रमेश स्कैन करता है, **हरा निशान**, अंदर। किसी से कुछ नहीं पूछा गया — पास पहले से मंज़ूर है। कोड जल जाता है।

**सुबह 11:20 — खाली flat**
कोई A-101 के लिए आता है। `status === 'VACANT'` → **committee को जाता है, किसी resident को नहीं।** Manager फ़ोन करके पता करता है — broker है, flat दिखाने आया। Manager मंज़ूरी देता है। रिकॉर्ड में committee के नाम से।

**दोपहर 2:00 — नल टपक रहा है**
C-505 शिकायत दर्ज करती है, category `PLUMBING`, फ़ोटो के साथ। Manager उसे प्लंबर विजय को सौंपता है। विजय के फ़ोन पर सिर्फ़ **उसके** काम दिखते हैं — पूरी society की शिकायतें नहीं। शाम को वह फ़ोटो के साथ "हो गया" लगाता है; स्थिति `DONE`। C-505 पक्का करती है → `VERIFIED`। **बिना उस पक्का किए वह `CLOSED` नहीं होगी।**

**शाम 6:47 — override**
कोई C-210 के लिए आता है, कहता है भाई है। 60 सेकंड बीत जाते हैं, कोई जवाब नहीं (फ़ोन बंद)। Policy कहती है **HOLD** — यानी रोको।

आदमी ज़ोर देता है। रमेश "फिर भी अंदर भेजें" दबाता है, कारण चुनता है *"परिचित है"*।

- Entry बनती है, **लाल निशान** के साथ
- Audit में: रमेश, DAY shift, कारण, और यह कि resident ने जवाब नहीं दिया
- C-210 के फ़ोन पर push जाता है — *"आपके जवाब का इंतज़ार किए बिना अंदर भेजा गया"*। वह 8 बजे फ़ोन चालू करके देखता है, और भाई सच में आया था

**रात 11:00 — auto-close**
दिन की 47 entries में से 41 की निकासी दर्ज है। 6 बची हैं — `AUTO_CLOSE`, `isEstimated: true`।

**अगली सुबह — committee को**
> *18 जुलाई: 47 entries, 41 निकासी दर्ज (87%), 6 अनुमान से बंद, 1 override।*

महीने भर यह संख्या 85% के आसपास रहती है। Committee एजेंसी से बात करती है। **यह software का काम नहीं था — software ने बस इसे दिखाया।**

**महीने का अंत — और यहाँ module अपनी क़ीमत वसूल करता है**

एजेंसी का बिल आता है: **4 गार्ड × 30 दिन।** Manager हाज़िरी खोलता है — एक गार्ड **4 दिन नहीं आया**, और उन दिनों कोई बदली भी नहीं भेजी गई।

Manager बिल घटवाता है। भुगतान मौजूदा रास्ते से जाता है: Vendor + Expense + 194C TDS — **इस module ने finance में कुछ नहीं जोड़ा, सिर्फ़ सबूत दिया।**

गंगाराम (माली, DIRECT) का भुगतान भी हमेशा की तरह हाथ से एक Expense voucher है। **हमने उसका वेतन नहीं गिना** — बस यह दर्ज है कि वह 26 दिन आया, और committee को इतना ही चाहिए।

---

## 24. बनाने का क्रम

| Phase | क्या | push चाहिए? |
|---|---|---|
| **0 — नींव** | FCM push + SSE; `SOCIETY_EMPLOYEE` ज़िंदा; `requirePermission`; gate rate-limit tier | — |
| **1 — डिजिटल रजिस्टर** | Visitor models, entry, exit, "अंदर कौन है", overstay, auto-close, gate console, `VisitorPolicy` + presets + settings, resident सिर्फ़ अपना log | **नहीं** |
| **2 — अनुमति** | ApprovalRequest, timeout सीढ़ी, override + कारण + audit, resident की पसंद, शांत घंटे, "gate पर छोड़ दो" | **हाँ** |
| **3 — पास व स्कैनर** | GatePass, HMAC QR + 6-अंकीय कोड, scanner, offline queue, WhatsApp न्योता | हाँ |
| **4 — स्टाफ़ व गाड़ी** | SocietyStaff, StaffRole, roster, हाज़िरी, एजेंसी-बिल मिलान, ResidentVehicle + autocomplete, Task queue | हाँ |
| **5 — गहराई** | ANPR सुझाव, blacklist (**पहचान सुलझने के बाद**), delivery webhook, RFID hook, रिपोर्ट | हाँ |

> **महत्वपूर्ण:** **Phase 1 push के बिना पूरा चलता है।** अगर जल्दी कुछ दिखाना है, तो वहाँ से शुरू करें — पूरा डिजिटल रजिस्टर, exit, और settings बिना किसी नए infrastructure के। Phase 0 सिर्फ़ Phase 2 के लिए ज़रूरी है।

---

## 25. जाँच की योजना

वही तरीक़ा जो finance के 19 suites में इस्तेमाल हुआ — Atlas पर फेंकने लायक़ `societyId`, ख़ुद सफ़ाई करने वाला `finally`, गिनती, और नाकाम होने पर non-zero exit।

| # | क्या साबित करना है |
|---|---|
| 1 | `npx tsc --noEmit` दोनों apps में साफ़ — backend dev transpile-only है, यही असली द्वार है |
| 2 | **किराए के flat का मेहमान — मालिक को कुछ नहीं जाता।** यह अकेली सबसे ज़रूरी assertion है |
| 3 | खाली flat → committee के पास, किसी resident के पास नहीं |
| 4 | data-only सदस्य को कभी नहीं पूछा जाता; **किसी के पास login न हो तो सीधे fallback** |
| 5 | `effectivePolicy` — resident admin की छत से ऊपर नहीं जा सकता |
| 6 | Override बिना कारण के नहीं बनता; audit में दिखता है; resident को सूचना जाती है |
| 7 | Auto-close हमेशा `isEstimated: true`; reconciliation की गिनती मिलती है |
| 8 | QR का HMAC — छेड़ा गया QR ठुकराया जाए; कोड दूसरी बार न चले |
| 9 | Offline queue: network बंद → entry बने → वापस आने पर sync, कोई नक़ल नहीं |
| 10 | Retention purge — 90 दिन पुरानी entry **और उसकी फ़ोटो** दोनों मिटें |
| 11 | Resident दूसरे flat का log **API से भी** न देख पाए (सिर्फ़ UI से नहीं) |
| 12 | `requirePermission` — माली की token से gate console की API **403** दे |
| 13 | Cross-society: A society का guard B society की entry न देख पाए |
| 13b | **दो societies एक ही नाम का `StaffRole` बना सकें** ("Manager") — कोई duplicate-key नहीं |
| 13c | **दूसरी society का `staffRoleId` ठुकराया जाए** — भले वह ObjectId असली हो |
| 14 | अनुपस्थित दिन एजेंसी-बिल मिलान में दिखें; `isEstimated` हाज़िरी बिना पक्का किए न गिने |

> **§25.11 और §25.12 पर ज़ोर क्यों:** finance में सीखा गया सबसे महँगा सबक़ यह था कि **पास होता हुआ aggregate assertion एक टूटी query छिपा सकता है** — vendor का tie-back पास हो रहा था जबकि payments छँट रहे थे, क्योंकि दो ग़लतियाँ आपस में कट रही थीं। इसलिए permission की जाँच UI से नहीं, **सीधे API से** होगी।

---

## 26. ज्ञात कमियाँ

**जो अभी बना ही नहीं** (19 जुलाई 2026 तक): इस दस्तावेज़ में लिखी हर चीज़। यह योजना है, manual नहीं।

### Payroll — दायरे से बाहर, और यह जानबूझकर है

**हम वेतन की गणना नहीं करेंगे।** न PF, न ESIC, न gratuity, न 192B slab, न वेतन पर्ची। यह हमारा software नहीं है।

तीन वजहें, और तीनों ठोस हैं:

1. **ज़्यादातर societies को इसकी ज़रूरत ही नहीं।** गार्ड और सफ़ाईकर्मी एजेंसी से आते हैं — एजेंसी अपना payroll ख़ुद करती है। Society को बस बिल चुकाना है, और वह रास्ता आज काम करता है।
2. **यह एक पूरा module है, gate का कोना नहीं।** PF की दरें, ESIC की सीमाएँ, gratuity की गणना, 192B के slab, Form 16 — यह सब बदलता रहता है और ग़लत होने पर क़ानूनी ज़िम्मेदारी बनती है।
3. **आधा payroll न होने से बुरा है।** अगर हम salary का field रख दें और उस पर कुछ न करें, तो वह ठीक वैसा ही *घोषित-पर-कभी-न-पढ़ा-गया* field बन जाएगा जिनकी वजह से finance में बारह बग निकले।

**अगर society को अपने कर्मचारी को भुगतान करना है**, तो वह मौजूदा Expense से हाथ से दर्ज होगा — जैसे बिजली का बिल दर्ज होता है। हमने बस यह दर्ज रखा है कि वह कितने दिन आया।

> **📌 बाद के लिए दर्ज:** जब अलग से **society application** बनेगी, तब payroll वहाँ का सवाल है — यहाँ का नहीं। तब भी सलाह यही रहेगी कि उसे अपना module बनाया जाए, gate या finance में ठूँसा न जाए। **इस module ने finance में एक भी बदलाव नहीं माँगा** (§21) — इसका मतलब यह भी है कि बाद में payroll जोड़ना किसी चीज़ को तोड़े बिना हो सकेगा। हाज़िरी का डेटा तब तक जमा हो चुका होगा और सीधे काम आएगा।

### और जो हम जानबूझकर नहीं कर रहे

| नहीं कर रहे | कारण |
|---|---|
| **चेहरा पहचान (face recognition)** | NoBrokerHood करता है। DPDP में biometric पर अलग बोझ है, और घरेलू कामगारों की biometric बिना असली सहमति के रखना — ThePrint ने इसे विस्तार से उठाया है। **यह हमारा default कभी नहीं होगा** |
| **Aadhaar** | §20। क़ानूनी रूप से अरक्षणीय |
| **Blacklist अभी** | MyGate इसे इसलिए नहीं दे पाया क्योंकि guard के टाइप किए नाम/नंबर पर रोक टिकती नहीं। **पहचान सुलझे बिना यह काम करने का दिखावा होगा — जो सुरक्षा में न होने से बुरा है** |
| **Resident की आवाजाही default में** | निगरानी। Society चाहे तो चालू करे, जानते-बूझते |
| **Boom barrier / hardware** | अलग उत्पाद। सिर्फ़ webhook की जगह छोड़ी है |

### जो हम चाहकर भी नहीं कर सकते

**Swiggy/Zomato की असली integration engineering नहीं, business development है।** MyGate के पास सच में API partnership है — order उठते ही वे pre-approval बना देते हैं, और delivery वाला gate पर सिर्फ़ अपना फ़ोन नंबर बोलता है। यह उनकी असली खाई है, और 6-अंकीय कोड नहीं। **हम इतना कर सकते हैं:** डिलीवरी की साफ़ श्रेणी + resident का default + एक तैयार webhook endpoint — ताकि जिस दिन कोई partner मिले, जोड़ना सिर्फ़ config हो।

### खुले सवाल जिन पर आपका फ़ैसला चाहिए

1. **SMS/IVR जोड़ें?** — फ़ोन बंद वाले resident तक पहुँचने का यही रास्ता है। पैसे वाला फ़ैसला
2. **Gate console web पर या native app?** — मेरी सलाह web पहले (सस्ता tablet, app store नहीं, camera HTTPS पर मिल जाता है), native बाद में
3. **ANPR का provider** — per-lookup ख़र्च; क़ीमत verify करनी होगी
4. **मौजूदा SYSTEM_EMPLOYEE की permissions भी backend पर लागू करें?** — यह इस module के बाहर की सुरक्षा-कमी है, पर है असली (§7)

---

*यह दस्तावेज़ MyGate, ADDA, NoBrokerHood और ApnaComplex पर सार्वजनिक शोध, तथा 19 जुलाई 2026 को ResiSmart codebase की `file:line` सहित जाँच पर आधारित है। जहाँ स्रोत आपस में टकराए — ख़ासकर MyGate के marketing पन्ने और उनके अपने help centre के बीच — वहाँ help centre को सही माना गया है और टकराव §3 में दर्ज है।*
