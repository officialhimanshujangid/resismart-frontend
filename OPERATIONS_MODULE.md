# ResiSmart — Operations Module

### Gate · शिकायत · स्टाफ़ · अधिकार — एक ही दस्तावेज़ में: कौन आया, किसने क्या किया, किसे क्या दिखे, और पैसा किसे गया।

> **दस्तावेज़ की स्थिति — 19 जुलाई 2026**
>
> ✅ **बन गया — 20 जुलाई 2026**
>
> | खंड | क्या | assertions |
> |---|---|---|
> | §6, §7 | अधिकार — `AccessRole`, `requirePermission` (स्तर + block दायरा, दोनों backend पर), दस बनी-बनाई भूमिकाएँ, committee को भूमिका देने की screen, sidebar में `accessModule` | 48/48 |
> | §11, §13, §17 | Gate का डिजिटल रजिस्टर — entry/exit, "अंदर कौन है", overstay, रात का auto-close, सुबह का हिसाब, retention purge, पाँच presets, gate console + records + settings | 62/62 |
> | §4, §5 | स्टाफ़ और तैनाती — `SocietyStaff` (कोई वेतन/Aadhaar नहीं), `StaffAssignment` (staff × wing × काम × primary/backup), routing की सीढ़ी, सत्यापन की मियाद, एजेंसी की गिनती, और `IExpenseLine.staffId` | 54/54 |
> | §14–§19 | शिकायत, सामान और QR — `Complaint` + `ComplaintEvent` (हर क़दम दर्ज), category-वार L1 owner बनाम assignee, रुकने पर SLA घड़ी रुकती है, "मुझे भी", आचरण की शिकायत अलग रास्ते से, काम करने वाला ख़ुद बंद नहीं कर सकता, `Asset` का QR sticker → `/scan/[token]` → भरा-भराया फ़ॉर्म, AMC की मियाद की चेतावनी | 71/71 |
> | §22 | सूचना का ढाँचा — `Notification` (रिकॉर्ड पहले, भेजना बाद में), SSE धारा (`fetch`+reader, URL में token नहीं), web push बिना किसी बाहरी खाते के (VAPID ख़ुद बनती और `GlobalSetting` में टिकती है), Firebase तैयार पर keys के बिना चुपचाप बंद, मरा हुआ device ख़ुद हटता है, header में सूचना केंद्र | 48/48 |
> | §12, §14 | Gate की अनुमति — `whoToAsk` (**किराए के flat पर सिर्फ़ किरायेदार, मकान-मालिक को कुछ नहीं**), खाली flat → committee, किसी का login न हो तो तुरंत guard, `effectivePolicy` (resident सिर्फ़ कम दख़ल माँग सकता है, ज़्यादा अधिकार नहीं), शांत घंटे, अपेक्षित मेहमान, पहला जवाब जीतता है, कारण सहित override + तुरंत सूचना, timeout की सफ़ाई, override की मासिक रिपोर्ट | 55/55 |
> | §15 | पास और स्कैनर — `GatePass` (6-अंकीय कोड + **Ed25519 से हस्ताक्षरित QR**, HMAC नहीं — guard device के पास सिर्फ़ जाँचने की कुंजी हो, बनाने की नहीं), atomically एक ही बार जलता है, दो gate एक साथ scan करें तो एक ही जीते, offline queue + WebCrypto से बिना network जाँच, sync पर दोहरा इस्तेमाल **दर्ज और flag — रोका नहीं**, ज़्यादा से ज़्यादा 12 घंटे का offline भरोसा | 46/46 |
> | §8 | Admin की सौंपनी — `AdminTransfer` (**निमंत्रण से कुछ नहीं बदलता**, स्वीकार करने पर एक ही transaction में सब), OTP शुरुआत में जमे contact पर जाता है, जाने वाले की अगली भूमिका हर बार चुननी पड़ती है, बाहरी manager किसी flat से न जुड़े, society कभी बिना admin नहीं रहती, break-glass (Chairman + तीन सेवारत सदस्य + लिखित कारण + 72 घंटे की आपत्ति), आपत्ति दर्ज होती है — अपने आप पलटती नहीं | 50/50 |
> | §19, §25 | गहराई — `ResidentVehicle` (नंबर सामान्यीकृत, guard को सुझाव, बिकी गाड़ी नए मालिक पर चढ़ सके), **blocklist सिर्फ़ उसी पर जो सचमुच gate पर दर्ज हुआ हो — नाम पर कभी नहीं** (enum में NAME है ही नहीं), दो committee सदस्य + लिखित कारण, मिलान पर guard रुकता नहीं पर entry पर निशान पक्का रहता है, ops रिपोर्ट (gate, SLA दो अलग वादों पर, staff, category, सामान), guard console 11 भाषाओं में | 58/58 |
>
> **ग्यारहों phase बन चुके हैं — कुल 608 assertions।**
>
> ⚠️ **20 जुलाई को पकड़ी गई गड़बड़ी, और उसका सबक़:** `DEFAULT_MODULES` सिर्फ़ `['GATE']` था, और वह अनुमान DB में लिख भी दिया जाता था। नतीजा — Staff, Complaints और Equipment **बने हुए, चलते हुए, और admin को अदृश्य**। **कोई admin वह feature चालू नहीं कर सकता जो उसने कभी देखा ही नहीं।** अब चारों modules default से चालू हैं; बंद करना उसका काम है जिसने उन्हें देखकर मना किया हो। साथ ही `modulesInferredAt` जुड़ा — अनुमान अब अनुमान की तरह दर्ज होता है, चुनाव की तरह नहीं, इसलिए बाद का कोई सुधार पुरानी society तक पहुँच सके। और **Operations Settings किसी module के पीछे नहीं है** — वरना gate बंद करते ही उसे वापस चालू करने का इकलौता दरवाज़ा भी बंद हो जाता।
>
> जो जानबूझकर नहीं बनाया:
>
> - **ANPR, RFID/boom barrier, delivery partner webhook** — आपके निर्णय से योजना से हटाए गए (लागत और बाहरी निर्भरता)। कोई अधूरा stub नहीं छोड़ा — यही सही है, क्योंकि इस codebase की सबसे आम ग़लती "घोषित पर कभी पढ़ा न गया" रही है।
> - **SMS/IVR** — API keys आने तक नहीं। ढाँचा तैयार है; `notification.service` की सीढ़ी में एक और चैनल जोड़ना है, पूरा फिर से बनाना नहीं।
> - **Payroll** — दायरे से बाहर, नीचे देखें।
>
> **Firebase बना हुआ है पर keys के बिना चुप है** — `FIREBASE_*` env में डालते ही mobile push चालू। Web push को किसी बाहरी खाते की ज़रूरत ही नहीं; VAPID जोड़ी ख़ुद बनती है और `GlobalSetting` में टिकी रहती है।
>
> अब यहाँ भी वही नियम लागू है जो `FINANCE_MODULE.md` में है: **जहाँ code और दस्तावेज़ अलग कहें, वहाँ code सही है।**
>
> Codebase के बारे में हर तथ्य 19 जुलाई 2026 को `file:line` सहित जाँचा गया है। MyGate/ADDA/ApnaComplex/NoBrokerHood और भारतीय सहकारी क़ानून के बारे में जो कहा गया है, वह सार्वजनिक शोध से है और §3 में स्रोत सहित है। जहाँ शोध में स्रोत आपस में टकराए, वहाँ टकराव दर्ज है।
>
> **दायरे से बाहर: payroll।** वेतन की गणना, PF, ESIC, gratuity, 192B — कुछ नहीं (§29)। **स्टाफ़ को कितना दिया, यह दर्ज होगा** (§23) — पर गणना हम नहीं करेंगे।
>
> भाषा: व्याख्या हिंदी में, तकनीकी नाम अंग्रेज़ी में।

---

## विषय-सूची

**भाग १ — नींव**
1. [यह module क्या है](#1-यह-module-क्या-है)
2. [शब्दावली](#2-शब्दावली)
3. [शोध से निकले नियम](#3-शोध-से-निकले-नियम)

**भाग २ — लोग और अधिकार**
4. [चार तरह के लोग](#4-चार-तरह-के-लोग)
5. [Staff master और उसकी तैनाती](#5-staff-master-और-उसकी-तैनाती)
6. [अधिकार — एक ही मॉडल, committee और staff दोनों के लिए](#6-अधिकार)
7. [Backend enforcement](#7-backend-enforcement)
8. [Admin की सौंपनी (ownership transfer)](#8-admin-की-सौंपनी)

**भाग ३ — Gate**
9. [Visitor — श्रेणियाँ और प्रवाह](#9-visitor)
10. [अनुमति किससे माँगी जाए](#10-अनुमति-किससे)
11. [पास, QR और offline सत्यापन](#11-पास-qr-offline)
12. [फ़ोटो और गाड़ी का नंबर](#12-फ़ोटो-और-गाड़ी)
13. [निकासी — उद्योग की सबसे बड़ी ख़ामी](#13-निकासी)
14. [Guard का override](#14-guard-override)

**भाग ४ — शिकायत**
15. [शिकायत module](#15-शिकायत-module)
16. [शिकायत किस तक पहुँचे — routing](#16-routing)
17. [SLA, रुकी हुई घड़ी, और escalation](#17-sla)
18. [आचरण की शिकायत — जो किसी के पास नहीं है](#18-आचरण-की-शिकायत)
19. [सामान से जुड़ी शिकायत और QR](#19-सामान-और-qr)

**भाग ५ — पैसा**
20. [स्टाफ़ भुगतान + Excel](#20-स्टाफ़-भुगतान)

**भाग ६ — नियंत्रण**
21. [Settings — सब कुछ अपने हिसाब से](#21-settings)
22. [Resident की अपनी पसंद](#22-resident-की-पसंद)
23. [सूचना की सीढ़ी](#23-सूचना-की-सीढ़ी)
24. [सुरक्षा और DPDP](#24-सुरक्षा-और-dpdp)

**भाग ७ — बनाना**
25. [Data model](#25-data-model)
26. [किस module से क्या जुड़ता है](#26-integration-map)
27. [पूरा उदाहरण — हरित विहार में एक दिन](#27-पूरा-उदाहरण)
28. [बनाने का क्रम](#28-बनाने-का-क्रम)
29. [जाँच की योजना](#29-जाँच-की-योजना)
30. [ज्ञात कमियाँ और जो हम जानबूझकर नहीं कर रहे](#30-ज्ञात-कमियाँ)

---

## 1. यह module क्या है

> Gate पर कौन आया → वह किसके पास गया → society में क्या टूटा → वह किसने ठीक किया → और उसे कितना पैसा दिया गया। **एक ही कहानी के पाँच पड़ाव।**

पहले यह तीन अलग चीज़ें लगती थीं — gate, शिकायत, स्टाफ़। पर ये तीनों **एक ही व्यक्ति के इर्द-गिर्द घूमती हैं**: माली gate से आता है, उसे शिकायत सौंपी जाती है, महीने के अंत उसे पैसा मिलता है। इन्हें अलग बनाना उसी आदमी को तीन जगह दर्ज करना होगा।

**पाँच सुनहरे नियम — पूरे module में कहीं इनका उल्लंघन नहीं होगा:**

1. **हम access control नहीं बना रहे, हम रिकॉर्ड और सूचना बना रहे हैं।** Guard को software रोक नहीं सकता (§3)। वादा वही करेंगे जो निभा सकें।
2. **जो दर्ज है वह सच हो, वरना दर्ज ही न हो।** अनुमान लगाया गया डेटा हमेशा "अनुमानित" के निशान के साथ।
3. **मालिक और किरायेदार अलग हैं।** किरायेदार के मेहमान की सूचना मालिक को नहीं जाएगी; किरायेदार की शिकायत मालिक को नहीं दिखेगी।
4. **Default में निगरानी नहीं।** Resident की आवाजाही, staff की location, चेहरा-पहचान — कुछ भी अपने आप चालू नहीं।
5. **हर अधिकार का लेन-देन दर्ज हो।** किसने किसे क्या access दिया, कब, क्यों — यह वह जगह है जहाँ हर प्रतिस्पर्धी ख़ाली है (§3)।

**यह module क्या नहीं है:** boom barrier controller नहीं, biometric मशीन नहीं, **payroll नहीं**, और guard के फ़ैसले की जगह नहीं।

---

## 2. शब्दावली

| शब्द | यहाँ इसका मतलब |
|---|---|
| **Gate console** | gate के tablet/फ़ोन की screen। Guard का पूरा संसार |
| **Society staff** | जिसे society पैसा देती है — guard, माली, सफ़ाईकर्मी, manager |
| **Household staff** | जिसे resident पैसा देता है — कामवाली, ड्राइवर। Society का कर्मचारी **नहीं** |
| **Visitor entry** | एक बार का आना-जाना |
| **Gate pass** | पहले से बना न्योता — कोड + QR |
| **Override** | resident ने मना किया या चुप रहा, फिर भी guard ने भेजा |
| **Auto-close** | दिन के अंत में बची entries को अनुमान से बंद करना, निशान लगाकर |
| **AccessRole** | अधिकारों का एक बंडल — committee सदस्य या staff को दिया जाता है |
| **StaffAssignment** | कौन staff किस block का, किस काम का — शिकायत यहीं से रास्ता पाती है |
| **Ticket owner** | जो शिकायत के लिए **जवाबदेह** है (escalation इसी पर चढ़ता है) |
| **Ticket assignee** | जो शिकायत का **काम** करता है |
| **रुकी घड़ी (SLA pause)** | जब देरी staff की वजह से नहीं — घर बंद है, मंज़ूरी बाक़ी है |
| **Effective policy** | society के नियम + resident की पसंद, मिलाकर एक जवाब |

---

## 3. शोध से निकले नियम

MyGate, ADDA, NoBrokerHood, ApnaComplex और भारतीय सहकारी क़ानून पर शोध से जो निकला। हर बात के पीछे स्रोत है, और जहाँ भरोसा कम है वहाँ साफ़ लिखा है।

### Gate के बारे में

**१. MyGate का अपना help centre मानता है कि guard को रोका नहीं जा सकता।**
> "The final authority to allow or deny entry rests with the security guard… If a guard chooses to let someone in without waiting for your response, **or despite a denial, the app cannot prevent it.**" — help.mygate.in/articles/134062

**२. निकासी हर जगह टूटी है।** MyGate का आधिकारिक जवाब: यह "system की ख़राबी नहीं, guard की आदत", हल है "दोबारा training" (articles/136260)। कारण ढाँचागत है — **entry ख़ुद को लागू करती है, exit के पीछे किसी का स्वार्थ नहीं।** हल §13 में।

**३. MyGate blacklist दे ही नहीं पाया**, और उनका कारण सही है: guard के हाथ से भरी जानकारी *"inaccurate or manipulated"* होती है, इसलिए उस पर रोक बनाना *"technically unfeasible"* (articles/134068)। **पहचान सुलझे बिना blacklist दिखावा है।**

**४. गार्ड की भाषा feature से ज़्यादा मायने रखती है।** ApnaComplex guard interface **8 भाषाओं** में देता है।

**५. सूचना का चैनल गंदा करना सुरक्षा को नुक़सान पहुँचाता है।** MyGate ने notifications में विज्ञापन भर दिए; Play Store की सबसे आम शिकायत यह है कि residents अब **सुरक्षा alert और car ad में फ़र्क़ नहीं कर पाते।**

### अधिकार और admin के बारे में — यहाँ सबसे बड़ी खोज है

**६. किसी के पास "transfer" नाम की चीज़ है ही नहीं।** MyGate में admin सौंपना = *नया बनाओ + पुराना मिटाओ* — दो अलग विनाशकारी काम, बीच में कोई कड़ी नहीं। और email बदला ही नहीं जा सकता; उसके लिए भी account मिटाकर नया बनाना पड़ता है (adminfaq.mygate.com/articles/130318)।

**७. Super-admin ख़ुद को बेरोक-टोक copy कर सकता है।** MyGate के शब्दों में:
> *"An existing Society Admin with Master Access has the authority to create new dashboard roles… and assign them the same level of Master Access."*

कोई मंज़ूरी नहीं, कोई सीमा नहीं, कोई OTP नहीं।

**८. Admin के अधिकार देने-लेने का कोई audit नहीं है।** MyGate का audit log **सिर्फ़ accounting** का है (Accounts → Audit Logs) और dashboard login/logout का। **किसने किसे admin बनाया, यह कहीं दर्ज नहीं होता।** जाता हुआ admin बाक़ी सब admins को मिटा सकता है और कोई रिकॉर्ड नहीं बचता।

**९. बाहरी manager को admin बनाना — यह सुलझी हुई समस्या है।** ApnaComplex के पास इसी नाम का flow है: *"How to create a user without assigning block ID or apt number and assign admin role"* — यानी **flat से जुड़ा हुआ न होने वाला admin**। वे उसे *staff-with-roles* की तरह रखते हैं, *member-with-roles* की तरह नहीं। MyGate के पास "Society Manager" एक बनी-बनाई भूमिका है।

**१०. ⚠️ मेरी पिछली बात ग़लत थी — committee हर साल नहीं बदलती।** महाराष्ट्र, कर्नाटक और गुजरात में कार्यकाल **5 साल** है (MCS Act s.73, Model Bye-law 121)। दिल्ली में **ज़्यादा से ज़्यादा 3 साल** (DCS Act 2003)। और जो RWA सहकारी नहीं बल्कि **Societies Registration Act 1860** के तहत हैं, उनके अपने bye-laws में **1–2 साल** आम है।
> **इसलिए कार्यकाल hard-code नहीं होगा।** अच्छी बात: `Committee` model में `termStartDate`/`termEndDate` **पहले से हैं** — कुछ बदलना नहीं है।

**११. भुगतान पर संयुक्त हस्ताक्षर क़ानूनन ज़रूरी है।** Model Bye-law 113: बैंक खाता *"shall be operated upon… by the **Secretary jointly with the Chairman or Treasurer**."*
> **स्रोत टकराते हैं:** bye-law का पाठ Secretary को **अनिवार्य** बनाता है, पर कई टिप्पणियाँ इसे "तीन में से कोई दो" बताती हैं। ये एक बात नहीं हैं। **इसलिए यह नियम सेट करने योग्य होगा, मान लिया हुआ नहीं।** किसी app में यह लागू होता नहीं मिला।

**१२. Bye-law 139 — Chairman का आपात अधिकार।** आपात स्थिति में Chairman committee का कोई भी अधिकार इस्तेमाल कर सकता है, **पर कारण लिखकर**, और अगली बैठक में **अनुमोदन कराकर**। यह ठीक वह आकार है जो "break-glass admin" के लिए चाहिए — और यह क़ानूनी रूप से आधारित है (§8)।

**१३. Block/wing के हिसाब से अधिकार किसी के पास नहीं हैं।** MyGate का अधिकार-मॉडल सिर्फ़ **module × (पढ़ना | पूरा)** है। कोई क्षेत्रीय आयाम नहीं। बड़ी societies में "wing-wise committee" असली चलन है — **यह खुला मैदान है।**

### शिकायत के बारे में

**१४. Auto-routing category × building पर MyGate में सच में चलता है** — साथ में "time of day" और "staff availability" पर भी। यानी *"A wing का प्लंबर"* एक बना हुआ feature है, कल्पना नहीं।

**१५. दो अलग भूमिकाएँ चाहिए — owner और assignee।** ApnaComplex में हर category का एक **L1 owner** है (जवाबदेह), और उससे अलग *"the Maintenance Staff who actually attends"* (काम करने वाला)। जो लोग इन दोनों को एक field बना देते हैं, वे escalation करते ही technician से ticket छीन लेते हैं।

**१६. Staff ख़ुद ticket बंद नहीं कर सकता।** MyGate में staff सिर्फ़ **"Job Done"** कह सकता है, manager पक्का करता है। और एक क़दम आगे — **resident अपने app से 4-अंकीय OTP पढ़कर staff को देता है**, तभी ticket बंद होता है। ApnaComplex का पुराना तरीक़ा "job card पर resident का दस्तख़त" था, जिसे वे ख़ुद *"not really recommended"* कहते हैं।

**१७. ADDA की escalation एक दिन से कम नहीं हो सकती** — उनके अपने दस्तावेज़ में, "technical feasibility" के कारण (रोज़ चलने वाला batch job)। **पानी के रिसाव को 2 घंटे चाहिए, एक दिन नहीं।**

**१८. NoBrokerHood की चार-स्तरीय सीढ़ी क़ानून से जुड़ी है:** L1 staff 0–24घं → L2 manager 24–48घं → L3 committee 3–7 दिन → **L4 बाहरी अधिकारी (Deputy Registrar, सहकारी न्यायालय, उपभोक्ता मंच) 15+ दिन**। और **आपात bypass** — आग, पानी का रिसाव, बिजली गुल — नीचे के स्तर छोड़कर सीधे ऊपर। भारतीय क़ानून भी 15 दिन में जवाब की अपेक्षा करता है।

**१९. "मुझे भी" (me too) किसी के पास नहीं है।** पानी बंद होने पर 40 अलग tickets बनते हैं, और उन्हें जोड़ने का कोई तरीक़ा नहीं। यह इसलिए भी अहम है क्योंकि एक स्वतंत्र स्रोत residents की असली शिकायत यह बताता है: *"दोबारा शिकायत करने पर नाराज़ माना जाता है।"* किसी मौजूदा शिकायत से जुड़ जाना सामाजिक रूप से आसान है।

**२०. आदमी के ख़िलाफ़ शिकायत का कोई रास्ता नहीं है।** किसी app में गुमनाम शिकायत नहीं मिली, और staff के **व्यवहार** की शिकायत के लिए कोई अलग रास्ता नहीं। **ख़तरा साफ़ है:** *"सफ़ाईकर्मी ने बदतमीज़ी की"* अगर category=Housekeeping में गया, तो auto-routing उसे **उसी आदमी के पास** भेज देगा। §18 इसी का जवाब है।

**२१. जो अच्छे facility-management software में है और society apps में नहीं:** रुकी हुई SLA घड़ी, पहला-जवाब बनाम पूरा-समाधान का अलग समय, सामान (asset) से जुड़े tickets, और सामान पर **QR sticker** जिसे स्कैन करते ही शिकायत का फ़ॉर्म भर जाए। आख़िरी वाला सबसे सस्ता और सबसे असरदार है।

### और एक, जो hack नहीं पर उससे बुरा है

ThePrint की ज़मीनी रिपोर्ट: गुड़गाँव के एक वकील ने पाया कि **उनके visitor logs पड़ोसियों को दिख रहे थे**। यह डेटा चोरी नहीं, **ग़लत access control** था। ADDA अपने FAQ में यही चूक ख़ुद मानता है: **किरायेदार की शिकायत मकान-मालिक को दिखती है।** §24 में इसका जवाब।

---

## 4. चार तरह के लोग

यह वर्गीकरण पूरे module की रीढ़ है।

| | **Admin** | **Committee सदस्य** | **Society staff** | **Household staff** |
|---|---|---|---|---|
| कौन | society चलाने वाला | चुना हुआ पदाधिकारी | society का कर्मचारी | resident का कर्मचारी |
| उदाहरण | secretary या बाहरी manager | Chairman, Treasurer | गार्ड, माली, manager | कामवाली, ड्राइवर |
| Role | `SOCIETY_ADMIN` | `SOCIETY_COMMITTEE` | `SOCIETY_EMPLOYEE` | कोई नहीं |
| Flat से जुड़ा? | **ज़रूरी नहीं** (§8) | आम तौर पर हाँ | नहीं | हाँ |
| Login | हाँ | हाँ | कभी-कभी | **कभी नहीं** |
| अधिकार | सब कुछ + बाँटने का हक़ | admin जो दे (§6) | admin जो दे (§6) | कुछ नहीं |
| पैसा | — | — | society से (§20) | resident से — **हमारा विषय नहीं** |

**मौजूदा codebase में क्या है:** `Committee`, `CommitteeMember`, `CommitteeDesignation` **बने हुए हैं** (14 जुलाई 2026 को), और `termStartDate`/`termEndDate` भी। `SOCIETY_EMPLOYEE` सिर्फ़ घोषित है, कहीं इस्तेमाल नहीं (`roles.ts:17`)। Household staff के लिए `Resident.relationship = 'STAFF'` पहले से है — **नया model नहीं बनेगा**, बस उसे कई flats से जुड़ने देना है।

### तीन तरह का रोज़गार, और तीनों का पैसा पहले से चलता है

| प्रकार | पैसा कैसे | बना है? |
|---|---|---|
| **AGENCY** — एजेंसी के गार्ड | एजेंसी का बिल → Expense + Vendor, 194C TDS | ✅ पहले से |
| **CONTRACT** — ठेके का मिस्त्री | Expense + Vendor | ✅ पहले से |
| **DIRECT** — society का अपना माली | **§20 का staff payment** | नया, पर छोटा |

---

## 5. Staff master और उसकी तैनाती

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
├── accessRoleId?                  ← §6 — नया AccessRole, मौजूदा PermissionRole नहीं
├── joinedOn, leftOn?, isActive
├── verification: { policeVerifiedOn?, verifiedBy?, documentKey?, expiresOn? }
├── emergencyContact: { name, phone, relation }
├── documents: IStaffDocument[]     ← flat documents वाला ही आकार
└── audit quad + timestamps
```

**वेतन का कोई field नहीं** — न `monthlyPaise`, न PF/ESIC/UAN। जो field हम भरते नहीं, वह रखना अपने आप में एक झूठ है। (Finance में यही सबक़ बारह बार मिला: *घोषित, दिखाया गया, पर कभी पढ़ा न गया* field सबसे आम बग है।)

**`userId` वैकल्पिक है** — सफ़ाईकर्मी को login नहीं चाहिए। यही तर्क `Resident.userId` पर पहले से लगा है।

**Aadhaar का कोई field नहीं** — न staff का, न visitor का (§24)।

### तैनाती — यह वह चीज़ है जो किसी के पास नहीं है

आपकी माँग: *"staff को जब create करूँ तो किसी wing से, किसी particular section से link कर पाऊँ ताकि आगे शिकायत उसी तक पहुँचे।"*

शोध कहती है: **किसी भी app में zone/beat नाम की चीज़ नहीं है।** MyGate के पास सिर्फ़ building filter है। ApnaComplex का routing पूरी तरह category पर है, block पर बिल्कुल नहीं।

```
StaffAssignment
├── staffId, societyId
├── scope: SOCIETY | BLOCK
├── blockId?                       ← Block model पहले से है, blockType: TOWER|WING|PHASE
├── categories: [PLUMBING | ELECTRICAL | GARDEN | ...]
├── rank: PRIMARY | BACKUP
└── isActive
```

एक staff की कई तैनाती हो सकती हैं। उदाहरण:
- विजय (प्लंबर) → A व B wing → PLUMBING → PRIMARY
- विजय → C wing → PLUMBING → BACKUP
- गंगाराम (माली) → पूरी society → GARDEN → PRIMARY

**यही शिकायत का रास्ता तय करेगा** (§16)। और यही `blocksAssigned` की जगह लेता है जो पिछले मसौदे में था — क्योंकि तैनाती का सवाल *"किस block का"* अकेले नहीं, *"किस block में किस काम का"* है।

### ✅ बन गया — 20 जुलाई 2026

Routing की सीढ़ी चलती है: **PRIMARY → BACKUP → society-wide → `null`**।

वह आख़िरी `null` जानबूझकर है। जब कोई मेल न खाए, तो कोई "मिलता-जुलता" आदमी नहीं चुना जाता — काम *"बाँटना बाक़ी"* में जाता है। **चुपचाप ग़लत आदमी को दी गई शिकायत उससे बुरी है जो खुलेआम किसी को नहीं दी गई**, क्योंकि दूसरी पर नज़र पड़ती है।

दो और बातें जो बनाते समय पक्की हुईं:

- **कोई चला जाए तो उसकी सारी तैनाती उसी दिन बंद** — और routing हर बार दोबारा जाँचता है कि वह अब भी नौकरी में है, इसलिए कोई बासी assignment किसी को वापस ज़िंदा नहीं कर सकता
- **`IExpenseLine.staffId` अब सच में पढ़ा जाता है** — Phase 2 में इसे जानबूझकर रोका गया था। नाम भी snapshot होता है, ताकि voucher सालों बाद भी पढ़ा जा सके, और दूसरी society का staff ठुकराया जाता है

---

## 6. अधिकार

आपकी माँग दो हिस्सों में थी: **committee सदस्य को क्या दिखे**, और **staff को क्या access मिले**। ये दोनों एक ही सवाल हैं, इसलिए **एक ही मॉडल** होगा।

```
AccessRole
├── societyId                       ← ⚠️ यही मौजूदा PermissionRole में नहीं है
├── name                            ← unique (societyId, name)
├── appliesTo: COMMITTEE | STAFF | BOTH
├── permissions[]: { module, level: NONE | READ | FULL }
├── scope: { allBlocks: boolean, blockIds: ObjectId[] }   ← किसी के पास नहीं है
├── isSystem: boolean               ← seeded भूमिकाएँ मिटाई न जा सकें
└── audit quad
```

### ⚠️ यह मौजूदा `PermissionRole` नहीं है

| | `SYSTEM_EMPLOYEE` | `SOCIETY_EMPLOYEE` / committee |
|---|---|---|
| किसका कर्मचारी | **ResiSmart का** (platform कंपनी) | **एक society का** |
| Tenant | `SYSTEM` | `SOCIETY` |
| Modules | `societies`, `shops`, `audit-logs` | `GATE_CONSOLE`, `COMPLAINTS`, … |
| दायरा | पूरा platform | सिर्फ़ अपनी society |

मौजूदा `PermissionRole` सिर्फ़ पहली दुनिया के लिए है, और उसे दोबारा इस्तेमाल करने से **दो पक्की गड़बड़ियाँ** आतीं:

1. **उसमें `societyId` है ही नहीं** (`permission-role.model.ts:35-63`) → एक society का manager दूसरी का role उठा लेता
2. **`name` globally unique है** (`:41`) → हरित विहार "Manager" बना ले, तो शांति निकेतन को duplicate-key error मिलता, और वे समझ भी न पाते क्यों

**चौकड़ी का आकार उधार, collection नहीं।**

### तीन स्तर, दो आयाम

MyGate के पास सिर्फ़ **पढ़ना | पूरा** है। हमारे पास **NONE | READ | FULL** होगा — क्योंकि "यह module इसे दिखे ही नहीं" और "दिखे पर बदल न सके" अलग बातें हैं।

और दूसरा आयाम — **block का दायरा** — जो किसी के पास नहीं है:

> *"राजेश A व B wing के committee सदस्य हैं। उन्हें उन्हीं दो wings की शिकायतें दिखें, C wing की नहीं।"*

बड़ी societies में wing-wise committee असली चलन है, और यह अकेली चीज़ हमें हर प्रतिस्पर्धी से आगे कर देती है।

### Modules की सूची

| Key | क्या खुलता है |
|---|---|
| `GATE_CONSOLE` | entry/exit की screen |
| `GATE_LOGS` | पुराना रिकॉर्ड, रिपोर्ट |
| `COMPLAINTS_OWN` | "मेरे पास आई शिकायतें" |
| `COMPLAINTS_MANAGE` | सब देखना, बाँटना, बंद करना |
| `COMPLAINTS_CONDUCT` | आचरण की शिकायतें (§18) — **अलग से, जानबूझकर** |
| `STAFF_VIEW` / `STAFF_MANAGE` | staff सूची / नियुक्ति |
| `STAFF_PAYMENTS` | staff भुगतान — असल में `FINANCE_*` का हिस्सा (§20) |
| `RESIDENTS_VIEW` | निवासी निर्देशिका (सीमित — §24) |
| `COMMITTEE_MANAGE` | committee सदस्य जोड़ना-हटाना |
| `ACCESS_MANAGE` | **अधिकार बाँटना** — सिर्फ़ admin |
| `OPS_SETTINGS` | §21 के toggles |
| `FINANCE_*` | मौजूदा finance modules |

### बनी-बनाई भूमिकाएँ

Admin को ख़ाली मैदान से शुरू न करना पड़े, इसलिए seeded (और बदली जा सकने वाली):

| भूमिका | किसके लिए | मिलता है |
|---|---|---|
| **Chairman** | committee | लगभग सब, `ACCESS_MANAGE` नहीं |
| **Secretary** | committee | सब कुछ पढ़ना + शिकायत/committee चलाना |
| **Treasurer** | committee | `FINANCE_*` (थोक प्रविष्टि सहित), बाक़ी पढ़ना |
| **Committee सदस्य** | committee | पढ़ना + अपने block की शिकायतें |
| **Society Manager** | staff (बाहरी भी) | रोज़मर्रा सब कुछ, `ACCESS_MANAGE` नहीं |
| **सुरक्षा गार्ड** | staff | `GATE_CONSOLE` |
| **हेड गार्ड** | staff | + `GATE_LOGS` |
| **तकनीकी staff** | staff (माली/प्लंबर/मिस्त्री) | `COMPLAINTS_OWN` |
| **Accountant** | staff | `FINANCE_*`, `GATE_LOGS` पढ़ना |
| **सिर्फ़ देखने वाला** | auditor | सब कुछ READ, कुछ भी FULL नहीं |

**ध्यान देने लायक़ दो बातें:**

- **गार्ड को `RESIDENTS_VIEW` नहीं मिलता।** उसे flat नंबर चाहिए, पूरी निर्देशिका नहीं। Gate console *"A-101 — शर्मा"* दिखाएगा, फ़ोन नंबर नहीं।
- **`ACCESS_MANAGE` किसी seeded भूमिका में नहीं है** — Chairman में भी नहीं। अधिकार बाँटना सिर्फ़ admin का काम है, और admin बदलने का अपना रास्ता है (§8)। MyGate में super-admin ख़ुद को बेरोक copy कर सकता है; हम वह दरवाज़ा नहीं खोलेंगे।

---

## 7. Backend enforcement

**एक मौजूदा ख़ामी है जिसकी नक़ल हम नहीं करेंगे।**

आज `PermissionRole` में चौकड़ी सहेजी जाती है, admin उसे screen पर बदल भी सकता है — पर **backend में कोई जाँच नहीं है।** पूरे `backend/src` में `requirePermission` / `checkPermission` / `hasPermission` जैसा कुछ नहीं। सिर्फ़ `authorizeRoles` है, जो केवल role देखता है। Sidebar `moduleKey` पर छाँटता है, **पर वह client-side है** — और client पर छँटा menu सुरक्षा नहीं, क्योंकि API सीधे बुलाई जा सकती है।

आपने कहा था *"industry level secure in every case… koi loophole ho bhi to use bhi sahi krna hai"* — इसलिए:

```ts
requirePermission('COMPLAINTS_MANAGE', 'edit')
requirePermission('GATE_CONSOLE', 'create', { block: 'fromBody' })   // block-दायरे सहित
```

- `req.user` से `accessRoleId` निकालेगा, स्तर देखेगा, और न होने पर **403**
- **block का दायरा भी यहीं जाँचा जाएगा** — क्योंकि यह UI में दिखाकर backend में छोड़ देना वही ग़लती दोहराना होगा
- हर नए route पर, कोई अपवाद नहीं
- Sidebar का client-side filter रहेगा, **पर सिर्फ़ सुविधा के लिए**

> **दायरे से बाहर, पर दर्ज:** मौजूदा SYSTEM_EMPLOYEE की permissions भी backend पर लागू नहीं हैं। यह एक स्वतंत्र सुरक्षा-कमी है। मैं उसे यहाँ चुपचाप ठीक नहीं कर रहा — वह दूसरा module है और उसका अपना परीक्षण चाहिए।

### ✅ बन गया — 20 जुलाई 2026

`middlewares/access.middleware.ts` में `requirePermission(module, needed, opts)`। जो जाँचा जाता है:

- **स्तर** — `NONE` छिपाता है, `READ` पढ़ने देता है, `FULL` बदलने देता है
- **Block का दायरा** — `body`, `query` या `params` से wing पढ़कर, तीनों रास्ते बंद
- **विफलता पर बंद** — setup वाला द्वार खुला रहता है (वह कार्यप्रवाह की सीढ़ी है); यह **बंद** होता है, क्योंकि यह दूसरों का डेटा रोकता है और *"जाँच नहीं पाए"* का मतलब कभी *"जाने दो"* नहीं हो सकता
- तीन अलग codes — `ACCESS_DENIED`, `ACCESS_NOT_ASSIGNED`, `ACCESS_WRONG_WING` — ताकि screen कारण बता सके

साथ में `attachAccess`, उन handlers के लिए जिन्हें **छाँटना** है, मना नहीं करना — A व B wing वाले सदस्य को उन्हीं दो की शिकायतें लौटें, 403 नहीं।

**Sidebar में तीसरा field `accessModule`** — `moduleKey` (platform staff) और `financeModule` (society ने feature चालू किया या नहीं) से अलग। तीन अलग सवाल, तीन अलग field।

---

## 8. Admin की सौंपनी

शोध की सबसे बड़ी खोज यही थी: **किसी के पास "transfer" नाम की चीज़ है ही नहीं** (§3, नियम ६–८)। MyGate में यह *नया बनाओ + पुराना मिटाओ* है, बीच में कोई कड़ी नहीं, और **किसने किसे admin बनाया इसका कोई रिकॉर्ड नहीं।**

### तीन तरह के उत्तराधिकारी

| किसे | कैसे |
|---|---|
| **society का मौजूदा सदस्य** | सूची से चुनो |
| **committee का Chairman** | एक tap — सबसे आम रास्ता |
| **बाहर का नया व्यक्ति** | नाम + email/फ़ोन। **किसी flat से नहीं जुड़ेगा** — professional manager, FM कंपनी |

तीसरा वाला ApnaComplex का सिद्ध pattern है: बाहरी admin को *staff-with-roles* की तरह रखो, *member-with-roles* की तरह नहीं। इसीलिए `SocietyStaff.userId` और `AccessRole` पहले से इस काम के लिए तैयार हैं।

### प्रवाह — और यह atomic होगा

```
1. मौजूदा admin शुरू करे → उत्तराधिकारी चुने
                          → अपनी नई भूमिका चुने (committee सदस्य / resident / हट जाना)
2. निमंत्रण जाए           → OTP से सत्यापित (मौजूदा otp.service दोबारा इस्तेमाल)
3. ⏸ यहाँ कुछ नहीं बदलता  ← स्वीकार होने तक society का admin वही पुराना है
4. उत्तराधिकारी स्वीकार करे → एक ही transaction में:
                            • नया → SOCIETY_ADMIN, Society.adminUserId बदले
                            • पुराना → चुनी हुई भूमिका पर
5. सूचना जाए              → दोनों को + पूरी committee को
6. Audit                  → ADMIN_TRANSFER_INITIATED / ACCEPTED / CANCELLED
```

**पाँच सुरक्षा-कवच:**

1. **Society कभी बिना admin के न रहे** — transaction का पहला assertion
2. **पुराने admin की नई भूमिका स्पष्ट चुननी होगी** — चुपचाप ग़ायब नहीं। MyGate में वह बस मिटा दिया जाता है
3. **स्वीकार किए बिना कुछ नहीं बदलता** — ग़लत email पर भेज दिया तो society फँसती नहीं
4. **committee को हमेशा पता चलेगा** — यह सिर्फ़ दो लोगों के बीच की बात नहीं
5. **हर लेन-देन audit में** — §3 नियम ८ की सीधी भरपाई

### जब admin ग़ायब हो जाए — break-glass

यह असली समस्या है: admin चल बसे, देश छोड़ दे, या नाराज़ होकर जवाब देना बंद कर दे। ऑफ़लाइन में इसका पूरा क़ानूनी रास्ता है — सूची बनाओ → Registrar → मजिस्ट्रेट → पुलिस ज़ब्ती (MCS Act s.73-H, धारा 146–148A)। **डिजिटल में इसका कोई समकक्ष नहीं है।**

Bye-law 139 हमें आकार देता है — Chairman आपात में committee का कोई भी अधिकार ले सकता है, **पर कारण लिखकर और अगली बैठक में अनुमोदन कराकर।**

```
Chairman + कम से कम 2 और सक्रिय committee सदस्य मिलकर दावा करें
   → कारण लिखना अनिवार्य
   → तीनों OTP से पुष्टि करें
   → मौजूदा admin को तुरंत सूचना + 72 घंटे का समय
   → वह चुप रहे तो admin बदल जाए
   → पूरी society को सूचना, audit में स्थायी दर्ज
```

**हम इसे "आपात दावा" कहेंगे, "recovery" नहीं** — क्योंकि यह सामान्य रास्ता नहीं है और इसका इस्तेमाल दिखना चाहिए।

### साथ में co-admin

एक से ज़्यादा admin हो सकते हैं (बड़ी societies में ज़रूरी है), **पर `Society.adminUserId` वाला एक प्राथमिक रहेगा** — क्योंकि "सब बराबर हैं" का मतलब है कोई ज़िम्मेदार नहीं। दूसरे admins `AccessRole` से बनेंगे और उनमें `ACCESS_MANAGE` अलग से देना पड़ेगा।

---

## 9. Visitor

**छह श्रेणियाँ:**

| श्रेणी | ख़ास बात |
|---|---|
| **मेहमान** | अनुमति चाहिए |
| **रिश्तेदार** | पहले से बुलाया जा सके, बार-बार का पास |
| **डिलीवरी** | "gate पर छोड़ दो"; resident का default चलता है |
| **कैब** | आम तौर पर सिर्फ़ बताना |
| **Household staff** | पहले से पंजीकृत — रोज़ नहीं पूछा जाएगा |
| **ठेकेदार / मिस्त्री** | ज़्यादा जानकारी, शायद committee की मंज़ूरी |

**Guard का प्रवाह — तीन tap:**

```
1. कौन?         → [मेहमान] [डिलीवरी] [कैब] [स्टाफ़] [ठेकेदार]
2. किसके पास?    → flat नंबर → "B-704 — वर्मा"
3. नाम + फ़ोटो   → [अंदर भेजें]
```

**पहले से बुलाया मेहमान:** QR स्कैन → हरा निशान → अंदर। एक tap।

---

## 10. अनुमति किससे

**पहला सवाल — कौन-सा घर?**

| Flat की स्थिति | किससे पूछें | क्यों |
|---|---|---|
| `RENTED` | **सिर्फ़ किरायेदार परिवार** | मालिक को यह जानना कि किरायेदार से कौन मिला — निजता का उल्लंघन |
| `OWNER_OCCUPIED` | मालिक परिवार | सीधा |
| `VACANT` | **committee / admin** | खाली flat पर कोई आया — यही देखने लायक़ बात है |

यही सिद्धांत flat के दस्तावेज़ों पर पहले से लगा है, और वही `householdType: 'OWNER' | 'TENANT'` field काम आएगा। **कुछ नया नहीं चाहिए।**

**दूसरा सवाल — घर के भीतर किसे?**

```
listHouseholdMembers(flatId, societyId)
  → isActive === true
  → loginStatus === 'LOGIN'        ← data-only सदस्य पूछे ही नहीं जा सकते
  → isHead पहले, फिर बाक़ी साथ-साथ
  → जो पहले जवाब दे, वही अंतिम
```

**अगर पूरे घर में किसी का login नहीं है?** छोटी societies में आम है। तब approval संभव ही नहीं — सीधे `onTimeout` पर। **यह हालत पहले दिन से संभालनी है**, वरना guard घूमते चक्र में फँसेगा। शोध में यह कहीं नहीं दिखा — शायद इसलिए कि MyGate मान लेता है सबके पास app है।

---

## 11. पास, QR, offline

| | 6-अंकीय कोड | हस्ताक्षरित QR |
|---|---|---|
| किसके लिए | इंसान — फ़ोन पर बोला जा सके | मशीन — स्कैन |
| सुरक्षा | server पर जाँच, rate-limit, थोड़ी देर का | HMAC, छेड़ा नहीं जा सकता |
| Offline? | नहीं | **हाँ** |

**QR के भीतर:** `societyId | passId | flatId | category | validFrom | validTo | nonce | HMAC`

**Offline क्यों:** gate का इंटरनेट जाता है — भारत में यह नियम है, अपवाद नहीं। ADDA इसे प्रमुख feature की तरह बेचता है। हस्ताक्षरित QR **बिना network** जाँचा जा सकता है; entry queue में जाएगी और network आते ही sync।

**दो ख़तरे और उनका जवाब:**
- **एक ही QR दो gate पर** — offline में रोका नहीं जा सकता। sync के बाद server दोहरा इस्तेमाल पकड़ेगा और committee को दिखाएगा। रोकना नहीं, दिखाना
- **रद्द किया पास** — offline device को पता नहीं चलेगा। इसलिए offline वैधता की अधिकतम सीमा छोटी (डिफ़ॉल्ट 12 घंटे)

---

## 12. फ़ोटो और गाड़ी

**फ़ोटो** — चेहरा और गाड़ी। `s3.uploadBuffer` तैयार है, `visitor-photos/` prefix, presigned link। **Browser में ही compress** (~200KB) — gate का tablet कमज़ोर network पर होता है।

**गाड़ी का नंबर — एक बात पूरे सवाल को बदल देती है:**

> **Resident की गाड़ियों के लिए ANPR की ज़रूरत ही नहीं है।**

वे एक **जानी-पहचानी, सीमित सूची** हैं। Guard "DL8C" टाइप करे और dropdown में पंजीकृत गाड़ियाँ दिखें — OCR से **तेज़ भी, 100% सही भी।** ANPR सिर्फ़ *अनजान मेहमान* की गाड़ी पर मदद करता है।

| चरण | क्या |
|---|---|
| **A** | `ResidentVehicle` registry + autocomplete। किरायेदार जाते ही उसकी गाड़ियाँ निष्क्रिय |
| **B** | फ़ोटो हमेशा। OCR **सुझाव** दे — **"अनुमान" के निशान के साथ**, guard एक tap में पक्का करे |

**कभी चुपचाप autofill नहीं।** ADDA की अपनी तुलना कहती है ANPR रोशनी पर निर्भर है और नक़ली प्लेट से चकमा खाता है। **ग़लत नंबर चुपचाप रिकॉर्ड बन गया, तो जिस दिन ज़रूरत पड़ेगी उसी दिन झूठा निकलेगा।**

---

## 13. निकासी

**उद्योग की सबसे बड़ी अनसुलझी समस्या** (§3, नियम २)। MyGate का जवाब "दोबारा training" है — वह कभी काम नहीं करेगा, क्योंकि समस्या आदत की नहीं **प्रोत्साहन की** है।

**चार परतें:**

१. **हर entry की अपेक्षित अवधि** — डिलीवरी 15 मिनट, मेहमान 4 घंटे, मिस्त्री 8 घंटे
२. **समय बीतने पर overstay alert** — guard को, और society चाहे तो resident को
३. **रोज़ रात auto-close** — `exitSource: AUTO_CLOSE`, `isEstimated: true`
४. **सुबह committee को हिसाब** — *"कल 47 entries, 41 की निकासी दर्ज, 6 अनुमान से बंद"*

**अंतर:** MyGate की "अंदर कौन है" सूची चुपचाप ग़लत होती है। हमारी **अपनी ग़लती की माप के साथ** आएगी। जब वह संख्या रोज़ 6 दिखेगी, committee guard से बात करेगी — यही असली हल है, क्योंकि समस्या software की नहीं, प्रबंधन की है।

### ✅ बन गया — 20 जुलाई 2026

चारों परतें चालू हैं। एक बात बनाते समय निकली जो पहले नहीं सोची थी:

> **जो society exit दर्ज ही नहीं करती, उसका "accuracy" `null` है — `0%` नहीं।**

पहला रूप 0% लौटाता था, यानी एक ऐसी society पर उँगली उठती जिसने वह सुविधा जानबूझकर बंद रखी है। बंद सुविधा के लिए किसी को दोषी ठहराना आँकड़े का दुरुपयोग है। अब वह संख्या सिर्फ़ वहाँ आती है जहाँ किसी को सचमुच *"गया"* दबाना था।

Cron घंटे-घंटे चलता है, रोज़ रात नहीं — क्योंकि हर society अपना समय चुनती है, और एक तय समय आधों के लिए शाम का बीच होता।

---

## 14. Guard override

MyGate मानता है guard को रोका नहीं जा सकता। हम भी नहीं रोकेंगे — **हम गिनेंगे।**

```
अनुमति नहीं मिली → guard "फिर भी अंदर भेजें" दबाए
      → कारण अनिवार्य [परिचित है] [फ़ोन पर कहा] [आपात] [अन्य]
      → entry बने, लाल निशान के साथ
      → audit: कौन guard, कौन shift, क्या कारण, resident ने क्या कहा था
      → resident को तुरंत सूचना
      → महीने की रिपोर्ट committee को
```

> *"रमेश (रात shift): 41 अनुमति-माँगों में से 12 बार बिना जवाब आए अंदर भेजा।"*

यह एक संख्या है, feature नहीं — और किसी प्रतिस्पर्धी में नहीं है। **Resident को तुरंत बताना ज़रूरी है** — महीने बाद पता चले तो सूचना बेकार; तुरंत पता चले तो वह उसी वक़्त फ़ोन कर सकता है।

---

## 15. शिकायत module

आज repo में complaints/tickets **कुछ नहीं है** — पूरी तरह नया।

```
Complaint
├── societyId, ticketCode (CMP/0001)
├── title, description, photos[]
├── categoryId → ComplaintCategory (दो स्तर: category → sub-category)
├── visibility: PERSONAL | COMMUNITY        ← §24
├── scope: SOCIETY | BLOCK | FLAT
├── blockId?, flatId?, assetId?             ← §19
├── raisedBy: { userId, name, flatId?, viaChannel: APP | GUARD | MANAGER }
│
├── ownerStaffId?      ← जवाबदेह — escalation इस पर चढ़ता है
├── assigneeStaffId?   ← जो काम करता है
├── assigneeVendorId?  ← या बाहरी vendor (लिफ़्ट AMC)
│
├── status: NEW | ASSIGNED | IN_PROGRESS | ON_HOLD | WORK_DONE
│           | RESOLVED | CLOSED | REOPENED | REJECTED
├── priority: LOW | NORMAL | HIGH | EMERGENCY
│
├── firstResponseDueAt, resolutionDueAt     ← §17, दो अलग घड़ियाँ
├── firstRespondedAt?, resolvedAt?, closedAt?
├── pausedAt?, pauseReason?, totalPausedMs  ← रुकी घड़ी
├── reopenCount: number                     ← गिनती, status नहीं
├── meTooCount, mergedIntoId?               ← §15 नीचे
├── rating?, feedback?
└── audit quad
```

### छह फ़ैसले जो सोच-समझकर लिए गए

**१. `ownerStaffId` और `assigneeStaffId` अलग हैं।** ApnaComplex में यही दो-परत मॉडल है — जवाबदेह अलग, काम करने वाला अलग। **जो इन्हें एक field बना देते हैं, वे escalation करते ही technician से ticket छीन लेते हैं** और फिर पता नहीं चलता कि काम कौन कर रहा था।

**२. `WORK_DONE` और `RESOLVED` अलग हैं।** Staff सिर्फ़ "काम हो गया" कह सकता है; **staff ख़ुद ticket बंद नहीं कर सकता।** MyGate में यही है, और वे एक क़दम आगे जाते हैं — resident अपने app से 4-अंकीय OTP पढ़कर staff को देता है (society चाहे तो चालू करे)।

**३. `reopenCount` एक गिनती है, status नहीं।** ADDA reopen को "status वापस NEW कर दो" की तरह करता है — **इससे reopen की गिनती हमेशा के लिए मिट जाती है**, और reopen दर सेवा की गुणवत्ता का सबसे अच्छा पैमाना है।

**४. "मुझे भी" — जो किसी के पास नहीं है।** पानी बंद होने पर 40 अलग tickets बनते हैं। यहाँ resident मौजूदा शिकायत से जुड़ सकेगा। यह सिर्फ़ सफ़ाई की बात नहीं — एक स्वतंत्र स्रोत बताता है कि residents की असली शिकायत यह है कि *"दोबारा शिकायत करने पर नाराज़ माना जाता है।"* **किसी मौजूदा शिकायत से जुड़ जाना सामाजिक रूप से आसान है।**

**५. `viaChannel`** — भारतीय societies में बहुत सी शिकायतें ज़बानी आती हैं, manager की मेज़ पर। MyGate और ADDA दोनों में "resident की ओर से manager दर्ज करे" वाला रास्ता है। बिना इसके वे शिकायतें WhatsApp में रह जाएँगी।

**६. `assigneeVendorId`** — लिफ़्ट AMC वाली कंपनी को शिकायत सौंपी जा सके। ADDA का शब्द सही है: *"vendors only view assigned tasks"* — उन्हें निवासी निर्देशिका नहीं दिखेगी।

---

## 16. Routing

आपकी माँग: *"future में related person को complaint section से handle किया जा सके।"*

```
शिकायत आई (category = PLUMBING, block = B)
   ↓
StaffAssignment खोजो: block=B + category=PLUMBING + rank=PRIMARY
   ↓ मिला → assignee = विजय
   ↓ नहीं मिला → rank=BACKUP देखो
   ↓ वह भी नहीं → scope=SOCIETY वाला देखो
   ↓ वह भी नहीं → COMPLAINTS_MANAGE वाले को, "बाँटना बाक़ी" के साथ
   ↓
owner = उस category का ज़िम्मेदार (committee सदस्य या manager)
```

**कभी चुपचाप अनाथ नहीं छोड़ा जाएगा** — अगर कोई नियम नहीं मिला तो शिकायत manager की सूची में "बाँटना बाक़ी" के साथ खड़ी होगी, ग़ायब नहीं।

**एक ज़रूरी अपवाद:** आचरण की शिकायत **कभी trade routing से नहीं जाएगी** (§18)।

---

## 17. SLA

तीन चीज़ें जो society apps में नहीं हैं और अच्छे facility-management software में हैं।

### पहला जवाब और पूरा समाधान — दो अलग घड़ियाँ

Residents का ग़ुस्सा ज़्यादातर **देरी से नहीं, चुप्पी से** होता है। इसलिए हर sub-category पर दो समय:

| Sub-category | पहला जवाब | समाधान |
|---|---|---|
| पानी का रिसाव | 30 मिनट | 4 घंटे |
| नल ख़राब | 4 घंटे | 2 दिन |
| लिफ़्ट बंद | 15 मिनट | 6 घंटे |
| बग़ीचा | 1 दिन | 7 दिन |

**समय sub-category पर लगेगा, category पर नहीं** — "पानी का रिसाव" और "नल ख़राब" दोनों plumbing हैं पर बिल्कुल अलग हैं।

**ADDA एक दिन से कम नहीं कर सकता** (उनके अपने दस्तावेज़ में, batch job की वजह से)। हमारा मिनटों में होगा।

### रुकी हुई घड़ी

अगर देरी staff की वजह से नहीं है, तो घड़ी नहीं चलनी चाहिए:

```
रुकने के कारण (बंद सूची — मनमाना नहीं):
  घर बंद है / resident ने समय नहीं दिया
  सामान का इंतज़ार
  vendor का इंतज़ार
  committee की मंज़ूरी बाक़ी
```

**बंद सूची क्यों:** अगर staff कोई भी कारण लिख सकेगा तो हर ticket "रुका हुआ" हो जाएगा। और बिना रुकी घड़ी के staff का आँकड़ा अन्यायपूर्ण होगा — तब वे ticket बंद करके नया खोलने लगेंगे, जो और बुरा है।

### Escalation की सीढ़ी

NoBrokerHood की सीढ़ी क़ानून से जुड़ी है और हम वही अपनाएँगे:

| स्तर | किसे | कब |
|---|---|---|
| L1 | assignee staff | 0 – पहला SLA |
| L2 | manager / owner | SLA पार |
| L3 | committee | 3–7 दिन |
| L4 | **बाहरी अधिकारी की याद दिलाना** | 15+ दिन |

L4 कोई कार्रवाई नहीं करता — वह committee को याद दिलाता है कि **भारतीय क़ानून 15 दिन में जवाब की अपेक्षा करता है**, और उसके बाद सदस्य Registrar या उपभोक्ता मंच जा सकता है। यह चेतावनी अपने आप में दबाव है।

**आपात bypass:** आग, पानी का रिसाव, बिजली गुल, लिफ़्ट में फँसना → नीचे के स्तर छोड़कर सीधे L2/L3, और तुरंत सूचना।

---

## 18. आचरण की शिकायत

शोध में यह **किसी भी app में नहीं मिला**, और साथ में एक ठोस ख़तरा मिला:

> *"सफ़ाईकर्मी ने बदतमीज़ी की"* — यह अगर category=Housekeeping में गया, तो auto-routing इसे **housekeeping supervisor या उसी आदमी के पास** भेज देगा।

इसलिए एक अलग वर्ग:

```
Complaint.kind: SERVICE | CONDUCT
```

**`CONDUCT` के अपने नियम:**

| नियम | क्यों |
|---|---|
| **trade routing से कभी नहीं जाएगी** | जिसके ख़िलाफ़ है, उसी के पास न पहुँचे |
| सिर्फ़ `COMPLAINTS_CONDUCT` वालों को दिखेगी | committee का चुना हुआ व्यक्ति |
| staff के आँकड़ों में **नहीं** गिनी जाएगी | वरना supervisor उसे दबाएगा |
| सार्वजनिक सूची में कभी नहीं | |
| **जिसके ख़िलाफ़ है उससे नाम छिपा** | पर committee को पता रहेगा |

**पूरी गुमनामी क्यों नहीं:** 300 flat की society में flat से आदमी वैसे भी पहचाना जाता है — पूरी गुमनामी का वादा झूठा होगा। और पूरी गुमनामी दुरुपयोग को न्योता देती है। इसलिए **"जिसके ख़िलाफ़ है उससे छिपा, committee को पता"** — यह निभाया जा सकने वाला वादा है।

**यह committee के ख़िलाफ़ भी चलेगा।** आज residents के पास कोई रास्ता नहीं है जब शिकायत उसी आदमी के बारे में हो जो app चलाता है। अगर शिकायत किसी committee सदस्य के बारे में है, तो वह सदस्य उसे नहीं देख पाएगा — चाहे उसके पास `COMPLAINTS_CONDUCT` हो।

---

## 19. सामान और QR

**सबसे सस्ता और सबसे असरदार विचार** — और किसी society app में नहीं है (Limble जैसे facility software में है)।

```
Asset
├── societyId, assetCode, name
├── category: LIFT | PUMP | DG | TANK | GATE | STP | अन्य
├── blockId?, location                ← "B wing, लिफ़्ट 2"
├── vendorId?, amcExpiresOn?
└── qrToken                           ← sticker पर छपा
```

**लिफ़्ट पर लगा sticker स्कैन करो → शिकायत का फ़ॉर्म भरा हुआ खुले** — कौन-सी लिफ़्ट, कौन-सा block, कौन-सी category, सब पहले से।

यह डेटा की सबसे बड़ी गड़बड़ी ठीक करता है: **residents जगह ठीक से नहीं बता पाते।** *"लिफ़्ट काम नहीं कर रही"* — कौन-सी? किस wing की?

साथ में मुफ़्त में मिलता है:
- हर सामान का अपना इतिहास — *"इस पंप में 6 महीने में 5 शिकायतें"*
- **AMC वाली शिकायत vendor को**, society के ख़र्च पर नहीं
- मरम्मत बनाम बदलने का फ़ैसला आँकड़ों पर

---

## 20. स्टाफ़ भुगतान

आपकी माँग: *"किसी finance module में entry कर पाऊँ कि किसको कितनी salary दी ताकि minus कर सकूँ… और Excel से भी हो जाए।"*

**यह payroll नहीं है** — गणना हम नहीं करेंगे। यह सिर्फ़ **"किसे कितना दिया"** दर्ज करना है।

### ⚠️ यह module इसे नहीं बनाएगा — Expense बनाएगा

पहले मसौदे में यहाँ एक `StaffPaymentRun` model था। **वह ग़लत था** — वह असल में Expense ही था, बस दूसरे नाम से: अपना status, अपनी numbering, अपनी lines। यही वह ग़लती है जिससे finance में बारह बग निकले — *एक ही चीज़ को दो जगह रखना।*

स्टाफ़ का भुगतान **एक ख़र्च है**, और Expense module में पहले से वह सब है जो चाहिए: मंज़ूरी का प्रवाह, TDS, vendor, fund, block, per-line account code, और ledger का सही रास्ता।

इसलिए यह **finance module का काम है, इस module का नहीं** — और वहाँ यह staff से बड़ा बन जाता है:

> **Expenses → थोक प्रविष्टि (bulk entry)** — कोई भी ख़र्च थोक में दर्ज हो सके, सिर्फ़ स्टाफ़ नहीं।

Society में लगभग हर ख़र्च दोहराता है — बिजली, टैंकर, एजेंसी का बिल, लिफ़्ट AMC, माली। *"पिछले महीने जैसा"* सिर्फ़ स्टाफ़ के लिए बनाना आधा काम होता।

### इस module से क्या चाहिए — सिर्फ़ एक field

```
IExpenseLine
├── expenseAccountCode, amountPaise
├── fundId?          ← पहले से
├── blockId?         ← पहले से
└── staffId?         ← नया, उसी आकार में तीसरा आयाम
```

`expense.model.ts:5-17` में `fundId` और `blockId` पहले से वैकल्पिक आयाम हैं। **`staffId` उसी शक्ल में जुड़ जाएगा।**

इससे *"गंगाराम को इस साल कितना दिया"* का जवाब expense lines से निकलेगा — और वह **अपने आप ledger से मिला हुआ** होगा, क्योंकि पैसा जाने की जगह ही एक है। पुराने design में दो जगह थीं और उन्हें मिलाना पड़ता।

**`subLedgerDimension` में `EMPLOYEE` जोड़ने की ज़रूरत नहीं** — यह जानबूझकर है। Finance को जितना कम छुएँ, उतना अच्छा।

### एक नया खाता

Seeded COA में वेतन का कोई खाता नहीं है। `5100 Security Charges` और `5110 Housekeeping` हैं, पर वे **बाहरी सेवा के ख़र्च** हैं, तनख़्वाह नहीं। इसलिए `5200 Staff Payments`।

> ⚠️ **कोड जोड़ते समय सावधानी:** finance में एक बार `1500` कोड पहले ही एक group ने ले लिया था, और `$setOnInsert` चुपचाप कुछ न करके निकल गया — खाता कभी बना ही नहीं, और महीनों पता नहीं चला। **हर नए कोड पर टकराव की assertion ज़रूरी है।**

### बाक़ी सब finance का हिस्सा है

थोक प्रविष्टि की पूरी design — Excel के खाने, एक-voucher बनाम कई-voucher का सवाल, *"पिछले जैसा दोहराएँ"*, दोबारा submit से बचाव — **`FINANCE_MODULE.md` में है**, यहाँ नहीं। यहाँ बस इतना दर्ज है कि स्टाफ़ उसका एक उपयोग है।

---

## 21. Settings

आपकी माँग: *"सब कुछ customization दो, जैसा जिसको चाहिए enable करके इस्तेमाल कर ले।"*

`FinancePolicy` वाला ही pattern — एक per-society `SocietyOpsPolicy`, और sidebar में एक **तीसरा** field `opsModule` (`financeModule` या `moduleKey` दोबारा नहीं — वे अलग सवाल हैं)।

### पहले: कौन-कौन से module चालू

```
OPS_MODULES = ['GATE', 'COMPLAINTS', 'STAFF', 'ASSETS']
```

Society सिर्फ़ शिकायत चाहती है, gate नहीं? चालू करे। सिर्फ़ gate चाहिए? वही सही।

> **`modules` पर schema default नहीं** — finance वाला सबक़। `default: []` लगा दिया तो *"कभी चुना ही नहीं"* और *"जानबूझकर कुछ नहीं चुना"* एक हो जाएँगे, और feature चालू होते ही चालू societies की screens ग़ायब हो जाएँगी। यह डेटा नष्ट होने जैसा दिखेगा, भले कुछ नष्ट न हुआ हो।

### Gate के पाँच तैयार स्तर

आपकी बात — *"admin says society is small, he just wants entry exit, no scanning"*:

| स्तर | क्या | किसके लिए |
|---|---|---|
| **L1 डिजिटल रजिस्टर** | सिर्फ़ entry | 20–40 flat, काग़ज़ की जगह |
| **L2 + निकासी** | check-in/out, "अंदर कौन है", overstay | जहाँ हिसाब चाहिए |
| **L3 + अनुमति** | resident से पूछना, "gate पर छोड़ दो" | ज़्यादातर |
| **L4 + पास व स्कैनर** | QR + कोड, guard स्कैन करे | बड़ी societies |
| **L5 + गाड़ी** | vehicle entry/exit | पूरी सुविधा |

**Preset सिर्फ़ toggles भर देता है** — उसके बाद हर switch अलग से बदला जा सकता है।

### पूरा toggle पेड़

```
SocietyOpsPolicy (एक society = एक document)
│
├── modules: string[]                       ← ⚠️ schema default नहीं
│
├── gate
│   ├── level: L1..L5 | CUSTOM
│   ├── capture
│   │   ├── photo / phone / idProof: OFF | OPTIONAL | REQUIRED
│   │   ├── allowedIdTypes[]                ← Aadhaar सूची में नहीं
│   │   └── categoriesEnabled[]
│   ├── exit
│   │   ├── trackExit, mode: MANUAL | SCAN | AUTO_EXPIRE
│   │   ├── overstayAlertAfterMinutes
│   │   └── autoCloseAtHour, autoCloseNotifyCommittee
│   ├── approval  (हर श्रेणी अलग)
│   │   ├── mode: NONE | NOTIFY_ONLY | REQUIRED
│   │   ├── timeoutSeconds
│   │   ├── onTimeout: HOLD | GUARD_DECIDES | AUTO_DENY
│   │   ├── whoCanApprove: ANY_ADULT | HEAD_ONLY | OWNER_ONLY
│   │   └── allowGuardOverride, overrideRequiresReason
│   ├── passes: { enabled, form, validity, singleUse, offlineValidation }
│   ├── vehicles: { track, trackExit, registry, plateOcr{enabled,provider,suggestOnly} }
│   └── residents: { logResidentMovement, logResidentVehicleOnly }   ← default false
│
├── complaints
│   ├── enabled
│   ├── categories: ComplaintCategory[]      ← society अपनी बनाए
│   ├── slaDefaults: { firstResponseMins, resolutionMins }  (per sub-category)
│   ├── pauseReasonsEnabled[]
│   ├── escalation: { l2AfterMins, l3AfterMins, l4ReminderDays }
│   ├── emergencyCategories[]                ← bypass वाली
│   ├── closure: RESIDENT_CONFIRMS | MANAGER_CONFIRMS | OTP
│   ├── reopenWindowDays, showReopenWindowToResident   ← नीचे देखें
│   ├── meTooEnabled
│   └── conductEnabled, conductVisibleToRoleId
│
├── staff
│   ├── enabled, requirePoliceVerification
│   ├── verificationExpiryAlertDays
│   └── assignmentEnabled                    ← §5 की तैनाती
│
├── payments
│   └── staffExpenseAccountCode              ← default 5200; बाक़ी सब FinancePolicy में
│
├── privacy
│   ├── retentionDays: 90 (30–180)
│   ├── residentSeesOwnFlatOnly: true        ← बदला नहीं जा सकता
│   └── purgePhotosWithEntry: true
│
└── guardApp
    ├── language: hi | en | mr | ta | te | bn | gu | or | kn
    ├── offlineQueueEnabled
    └── shiftBoundSession
```

> **`showReopenWindowToResident` क्यों है:** MyGate admins को reopen की खिड़की सीमित करने देता है। वह ईमानदार भी हो सकती है और residents को चुप कराने का हथियार भी। इसलिए **खिड़की resident को दिखेगी**, और रोका गया हर reopen प्रयास दर्ज होगा। सीमा लगाना ठीक है; चुपचाप लगाना नहीं।

---

## 22. Resident की पसंद

```
ResidentGatePreference (एक resident + एक flat)
├── frequentVisitors[]: { name, phone, category, autoApprove, validTill? }
├── deliveryDefault: ASK_ME | LEAVE_AT_GATE | ALWAYS_ALLOW
├── cabDefault: ASK_ME | ALWAYS_ALLOW
├── quietHours: { from: "23:00", to: "07:00", action: HOLD | LEAVE_AT_GATE }
├── notifyChannels: PUSH | EMAIL
└── notifyWhichMembers: ALL_LOGIN | HEAD_ONLY | SELECTED[]
```

**छत का नियम — पूरे module की सबसे ज़रूरी अकेली पंक्ति:**

> **Admin छत तय करता है, resident उसके भीतर चुनता है।**

अगर admin ने डिलीवरी पर `mode = REQUIRED` कर रखा है, तो कोई resident `ALWAYS_ALLOW` नहीं लगा सकता — विकल्प धूसर दिखेगा, कारण के साथ: *"आपकी society ने हर डिलीवरी पर अनुमति अनिवार्य की है।"*

यह गणित **एक ही जगह** होगा:

```ts
effectivePolicy(opsPolicy, residentPref, category, now) → ResolvedRules
```

Gate console, resident app, backend — तीनों यही function बुलाएँगे। **दो जगह दो अलग जवाब कभी नहीं निकलेंगे, क्योंकि जवाब निकालने की जगह ही एक है।**

---

## 23. सूचना की सीढ़ी

**यह सबसे बड़ा नया infrastructure है।** आज इस codebase में **कोई real-time रास्ता नहीं** — न push, न socket, न SSE, न SMS। सिर्फ़ email। और email से gate पर खड़े guard का काम नहीं चलता।

```
1. Push (FCM)    → mobile app + browser, एक साथ
2. In-app / SSE  → app या dashboard खुला हो तो तुरंत
3. timeout       → policy: HOLD | GUARD_DECIDES | AUTO_DENY
4. Email         → रिकॉर्ड के लिए, फ़ैसले के लिए नहीं
```

**FCM ही क्यों:** एक ही चीज़ से Expo mobile push और browser web push दोनों। backend पर एक `firebase-admin`।

**SMS/IVR आज नहीं है** — `otp.service.ts:4` ख़ुद कहता है *"no SMS gateway yet."* MyGate की सीढ़ी में IVR एक अहम कड़ी है (फ़ोन बंद हो तब भी घंटी बजती है)। **यह पैसे वाला फ़ैसला है, तकनीकी नहीं।**

**एक वादा:** gate और शिकायत के चैनल **कभी विज्ञापन नहीं ढोएँगे** (§3, नियम ५)।

---

## 24. सुरक्षा और DPDP

### DPDP 2023 — society ही ज़िम्मेदार है

**Data Fiduciary society/RWA है, app बनाने वाला नहीं।** MyGate के सह-संस्थापक का बयान — *"we are not the custodians of the data, the data belongs to the RWAs"* — क़ानूनी रूप से विवादित है, पर असर यह है कि **जुर्माना society पर आएगा** (₹250 करोड़ तक)। इसलिए **हमारे defaults ही उनकी compliance बनेंगे।**

| ज़रूरत | जवाब |
|---|---|
| स्पष्ट सहमति | gate पर visitor को सूचना; AGM का प्रस्ताव सहमति **नहीं** |
| कम से कम डेटा | फ़ोन **वैकल्पिक** default |
| उद्देश्य-सीमा | gate का डेटा marketing में कभी नहीं |
| मिटाना | auto-purge, default 90 दिन |
| वापस लेना | resident अपना रिकॉर्ड मिटवा सके, बिना शुल्क |

### Aadhaar — field बनेगा ही नहीं

- निजी संस्था पहचान के लिए Aadhaar **माँग नहीं सकती** (Puttaswamy के बाद §57 रद्द)
- UIDAI के अनुसार **फ़ोटोकॉपी रखना ही उल्लंघन है**
- दंड DPDP से अलग और ऊपर

Societies यह ग़लती रोज़ करती हैं। **न visitor का, न staff का।**

### कौन क्या देखे

ThePrint की रिपोर्ट में जो हुआ वह hack नहीं, **access control की चूक** थी। और ADDA अपने FAQ में यही चूक ख़ुद मानता है: **किरायेदार की शिकायत मकान-मालिक को दिखती है।**

| कौन | क्या |
|---|---|
| Resident | **सिर्फ़ अपने flat** के visitors और अपनी शिकायतें |
| मालिक (flat किराए पर) | **किरायेदार के मेहमान नहीं, किरायेदार की शिकायत नहीं** |
| Guard | ड्यूटी के दौरान की entries; निवासी निर्देशिका **नहीं** |
| Committee सदस्य | अपने block का (अगर `AccessRole.scope` सीमित है) |
| आचरण की शिकायत | सिर्फ़ `COMPLAINTS_CONDUCT` वाले, और जिसके ख़िलाफ़ है वह कभी नहीं |
| Manager | सब कुछ, audit के साथ |

`privacy.residentSeesOwnFlatOnly` **बदला नहीं जा सकता।** यह setting नहीं, नियम है।

### बाक़ी

- **Gate pass पर HMAC** — 6 अंक अनुमान लगाए जा सकते हैं, हस्ताक्षर नहीं
- **कोड एक बार में जले** — server पर, atomically
- **Guard सत्र shift से बँधा**
- **Gate device के लिए अलग rate-limit tier** — आज का 300/15min pass स्कैन में उड़ जाएगा
- **हर query में `societyId` हाथ से** — codebase में कोई global tenant filter नहीं; एक handler में भूले तो cross-society रिसाव
- **`requirePermission` backend पर, block-दायरे सहित** (§7)
- **हर override, deny, manual exit, अधिकार-परिवर्तन, admin transfer** → audit

---

## 25. Data model

**नए models:**

| Model | क्या |
|---|---|
| `SocietyOpsPolicy` | per-society settings (§21) |
| `AccessRole` | अधिकार — committee + staff, **unique `(societyId, name)`** (§6) |
| `ResidentGatePreference` | per-resident पसंद (§22) |
| `Visitor` · `VisitorEntry` · `GatePass` · `ApprovalRequest` | gate |
| `ResidentVehicle` | flat से जुड़ी गाड़ियाँ |
| `SocietyStaff` · `StaffAssignment` | §5 |
| `Complaint` · `ComplaintCategory` · `ComplaintEvent` | §15 |
| `Asset` | §19 |
| `AdminTransfer` | §8 |
| `PushToken` | device tokens |

**मौजूदा में बदलाव — जानबूझकर कम:**

| क्या | कहाँ | क्यों |
|---|---|---|
| `SOCIETY_EMPLOYEE` ज़िंदा करना | `roles.ts:17` | आज सिर्फ़ घोषित है |
| Household staff कई flats में | `resident.model.ts` | एक कामवाली, पाँच घर |
| `opsModule` sidebar field | `sidebarContent.tsx` | **तीसरा** field |
| `requirePermission` middleware | नया | §7 |
| `Society.adminUserId` बदलने का रास्ता | §8 | आज सिर्फ़ पढ़ा जाता है, society के लिए कभी बदला नहीं जाता |
| COA में `5200 Staff Payments` | `chart-of-accounts.seed.ts` | §20 — **टकराव की assertion सहित** |
| `IExpenseLine.staffId?` | `expense.model.ts:5-17` | `fundId`/`blockId` के साथ तीसरा आयाम (§20) |

**Finance में और कुछ नहीं बदलेगा** — न `subLedgerDimension`, न TDS की धाराएँ, न Society का schema। **जो finance आज हरा है (19 suites, 1085 assertions), वह वैसा ही रहेगा।**

**जो पहले से है और दोबारा इस्तेमाल होगा:** `Committee`/`CommitteeMember`/`CommitteeDesignation` (`termStartDate`/`termEndDate` सहित), `Block` (`blockType: TOWER|WING|PHASE`), `bulk-import.service` का पूरा ढाँचा, `otp.service`, `s3.service`, `auditFinance`, `listHouseholdMembers`, `node-cron`।

---

## 26. Integration map

```
                        ┌──────────────┐
                        │ Gate Console │
                        └──────┬───────┘
                               │
        ┌──────────────┬───────┴───────┬──────────────┐
        ▼              ▼               ▼              ▼
   ┌─────────┐   ┌──────────┐    ┌─────────┐   ┌──────────┐
   │ Visitor │   │  Staff   │    │ Vehicle │   │  Asset   │
   └────┬────┘   └────┬─────┘    └────┬────┘   └────┬─────┘
        │             │               │             │ QR
        │             │ तैनाती         │             ▼
        │             └───────┐       │       ┌──────────┐
        │                     ▼       │       │ शिकायत   │
        │              ┌─────────────┐│       └────┬─────┘
        │              │  Routing    │◄────────────┘
        │              └─────────────┘
        ▼                     │
   ┌─────────┐                ▼
   │Household│         ┌─────────────┐
   │  Flat   │────────►│   Finance   │
   └─────────┘ status  │ भुगतान·बिल  │
                       └─────────────┘
```

| जुड़ाव | क्या होता है |
|---|---|
| Flat status → अनुमति | `RENTED`/`OWNER_OCCUPIED`/`VACANT` तीन अलग रास्ते |
| Household → किसे पूछें | `listHouseholdMembers` + `householdType` |
| StaffAssignment → शिकायत | block × category → assignee (§16) |
| Asset QR → शिकायत | जगह अपने आप भर जाए (§19) |
| Asset AMC → vendor | AMC वाली शिकायत vendor को, society के ख़र्च पर नहीं |
| स्टाफ़ भुगतान → Finance | Expense की थोक प्रविष्टि, `staffId` सहित (§20) |
| एजेंसी बिल ↔ staff सूची | कितने गार्ड सच में तैनात हैं |
| गाड़ी → parking शुल्क | `Flat.quantities` + `PER_QUANTITY` पहले से |
| Committee → AccessRole | पद के हिसाब से अधिकार (§6) |
| सब कुछ → Audit | मौजूदा `auditFinance` |

---

## 27. पूरा उदाहरण

**हरित विहार सहकारी गृह निर्माण संस्था, पुणे** — 120 flat, 3 block (A/B/C), gate स्तर **L4**, शिकायत चालू।
स्टाफ़: 4 गार्ड (एजेंसी), 1 माली (society का), 3 सफ़ाईकर्मी (एजेंसी), 1 प्लंबर (ठेके पर), 1 manager।

---

**सुबह 5:58 — shift बदली।** रमेश अपना QR स्कैन करता है। उसका token शाम 6 बजे तक का है।

**सुबह 9:34 — डिलीवरी, और यहाँ असली बात है।**
Swiggy वाला B-704 के लिए। **B-704 किराए पर है।** सिस्टम `flat.status === 'RENTED'` देखकर **सिर्फ़ किरायेदार परिवार को पूछता है।** मालिक श्री देशपांडे को **कुछ नहीं जाता।**

किरायेदार परिवार में 3 लोग हैं। दो के पास login है, सास के पास नहीं (`DATA_ONLY`) — **उन्हें पूछा ही नहीं जाता।** 11 सेकंड में बहू approve करती है।

**सुबह 10:05 — पहले से बुलाया मेहमान।** A-302 की श्रीमती जोशी ने कल रात बहन को WhatsApp पर QR भेजा था। स्कैन → हरा निशान → अंदर। कोड जल जाता है।

**सुबह 11:20 — खाली flat।** कोई A-101 के लिए आता है। `VACANT` → **committee को**, किसी resident को नहीं। Manager फ़ोन करके पता करता है — broker है। मंज़ूरी committee के नाम से दर्ज।

**दोपहर 12:40 — लिफ़्ट, और यहाँ QR काम आता है।**
B wing की लिफ़्ट 2 में कोई फँस जाता है। एक resident **लिफ़्ट पर लगा sticker स्कैन** करता है — फ़ॉर्म पहले से भरा खुलता है: *Asset = लिफ़्ट 2, Block = B, Category = LIFT*।

यह `emergencyCategories` में है → **L1 छोड़कर सीधे L2**, manager को तुरंत। पहला जवाब 15 मिनट का, समाधान 6 घंटे का।

`StaffAssignment` में B wing + LIFT का कोई staff नहीं — पर asset पर **AMC vendor** दर्ज है। शिकायत सीधे उन्हें जाती है, और **उनके ख़र्च पर**, क्योंकि AMC चालू है।

अगले 20 मिनट में तीन और residents वही शिकायत करने आते हैं। उन्हें **"यह पहले से दर्ज है — जुड़ें?"** दिखता है। तीनों जुड़ जाते हैं। **चार अलग tickets नहीं बनते** — एक ticket, चार लोग देख रहे हैं।

**दोपहर 2:00 — नल।** C-505 शिकायत दर्ज करती है, `PLUMBING`। Routing चलता है: block=C + PLUMBING + PRIMARY → **विजय**। विजय के फ़ोन पर सिर्फ़ **उसके** काम दिखते हैं।

विजय जाता है, घर बंद है। वह **"घर बंद है"** चुनकर ticket रोकता है — **घड़ी रुक जाती है।** शाम को दोबारा जाकर ठीक करता है, फ़ोटो लगाकर **"काम हो गया"** दबाता है।

**विजय ticket बंद नहीं कर सकता।** C-505 पक्का करती है → `RESOLVED`। तब जाकर बंद होगा।

**दोपहर 3:15 — एक अलग तरह की शिकायत।**
A-207 शिकायत करते हैं कि एक सफ़ाईकर्मी ने बदतमीज़ी की। वे `CONDUCT` चुनते हैं।

**यह trade routing से नहीं जाती।** अगर जाती, तो housekeeping supervisor — या वही आदमी — इसे देख लेता। यह सिर्फ़ Secretary के पास जाती है, जिनके पास `COMPLAINTS_CONDUCT` है। **staff के आँकड़ों में नहीं गिनी जाती।** और सफ़ाईकर्मी को शिकायत करने वाले का नाम कभी नहीं पता चलेगा — पर Secretary को पता है।

**शाम 6:47 — override।** कोई C-210 के लिए, कहता है भाई है। 60 सेकंड, कोई जवाब नहीं (फ़ोन बंद)। Policy कहती है **HOLD**।

आदमी ज़ोर देता है। रमेश "फिर भी अंदर भेजें" दबाता है, कारण *"परिचित है"*। Entry **लाल निशान** के साथ बनती है, audit में सब दर्ज, और C-210 को push जाता है। वह 8 बजे फ़ोन चालू करके देखता है — भाई सच में आया था।

**रात 11:00 — auto-close।** 47 में से 41 की निकासी दर्ज। 6 बची — `isEstimated: true`।

**अगली सुबह — committee को:**
> *18 जुलाई: 47 entries, 41 निकासी दर्ज (87%), 6 अनुमान से बंद, 1 override। शिकायतें: 6 नई, 4 बंद, 1 SLA पार। लिफ़्ट 2 (B) — इस साल की तीसरी शिकायत।*

आख़िरी वाक्य पर committee रुकती है। **तीन शिकायतें एक ही लिफ़्ट पर** — यह AMC नवीनीकरण की बातचीत में काम आएगा।

---

**महीने का अंत — दो काम**

**१. एजेंसी का बिल।** 4 गार्ड × 30 दिन। Manager staff सूची देखता है — एक गार्ड 20 तारीख़ को छोड़कर गया और उसकी जगह कोई नहीं आया। बिल घटवाता है। भुगतान मौजूदा रास्ते से: Vendor + Expense + 194C TDS।

**२. अपने staff का भुगतान।** Manager Excel बनाता है:

| Staff Code | Staff Name | Amount | Note |
|---|---|---|---|
| SF/0003 | गंगाराम | 12000 | जुलाई |
| SF/0007 | विजय | 8500 | जुलाई |

Upload → preview: **दोनों मिल गए, कुल ₹20,500, HDFC खाते से।** Submit।

एक Expense voucher बनता है — डेबिट `5200 Staff Payments` ₹20,500, क्रेडिट HDFC ₹20,500. **Society का पैसा घट जाता है।**

**हमने किसी का वेतन नहीं गिना।** Manager ने तय किया कितना देना है; हमने बस दर्ज किया, ledger में डाला, और अब *"गंगाराम को इस साल कितना दिया"* का जवाब निकल सकता है।

---

**और एक दिन, तीन महीने बाद —**

Secretary का तबादला हो जाता है। वे **admin सौंपते** हैं: उत्तराधिकारी = Chairman, अपनी नई भूमिका = committee सदस्य।

Chairman को निमंत्रण जाता है। **जब तक वे स्वीकार नहीं करते, कुछ नहीं बदलता।** वे OTP से स्वीकार करते हैं — एक ही transaction में Chairman admin बन जाते हैं, Secretary committee सदस्य रह जाते हैं (हटाए नहीं जाते), पूरी committee को सूचना जाती है, और audit में स्थायी दर्ज हो जाता है।

**MyGate में यह दो अलग काम होते — नया बनाओ, पुराना मिटाओ — और कहीं दर्ज न होता।**

---

## 28. बनाने का क्रम

| Phase | क्या | push चाहिए? |
|---|---|---|
| **0 — नींव** | FCM push + SSE; `SOCIETY_EMPLOYEE` ज़िंदा; `AccessRole` + `requirePermission` (block-दायरे सहित); gate rate-limit tier | — |
| **1 — डिजिटल रजिस्टर** | Visitor models, entry, exit, "अंदर कौन है", overstay, auto-close, gate console, `SocietyOpsPolicy` + presets, resident सिर्फ़ अपना log | **नहीं** |
| **2 — अनुमति** | ApprovalRequest, timeout सीढ़ी, override + कारण + audit, resident की पसंद, शांत घंटे, "gate पर छोड़ दो" | **हाँ** |
| **3 — शिकायत** | Complaint + categories, दो-भूमिका ticket, SLA (दो घड़ियाँ + रुकना), escalation, "मुझे भी", reopen गिनती, आचरण वर्ग | हाँ |
| **4 — स्टाफ़ व तैनाती** | SocietyStaff, StaffAssignment, routing, Asset + QR, seeded AccessRoles | हाँ |
| **5 — पास व स्कैनर** | GatePass, HMAC QR + कोड, scanner, offline queue, WhatsApp न्योता | हाँ |
| **6 — सौंपनी** | AdminTransfer + break-glass। *(स्टाफ़ भुगतान finance की थोक प्रविष्टि के साथ जाएगा — अलग काम)* | हाँ |
| **7 — गहराई** | ANPR सुझाव, blacklist (**पहचान सुलझने के बाद**), गाड़ी, रिपोर्ट, delivery webhook, RFID hook | हाँ |

**दो सुझाव:**

- **Phase 1 push के बिना पूरा चलता है।** जल्दी कुछ दिखाना है तो वहाँ से शुरू करें।
- **Phase 3 और 6 अलग से भी हो सकते हैं।** अगर gate से ज़्यादा ज़रूरी शिकायत लगती है, तो 0 → 3 → 4 का रास्ता भी सही है। शिकायत को gate की ज़रूरत नहीं।

---

## 29. जाँच की योजना

वही तरीक़ा जो finance के 19 suites में — Atlas पर फेंकने लायक़ `societyId`, ख़ुद सफ़ाई करने वाला `finally`, गिनती, non-zero exit।

| # | क्या साबित करना है |
|---|---|
| 1 | `npx tsc --noEmit` दोनों apps में साफ़ — backend dev transpile-only है, यही असली द्वार |
| 2 | **किराए के flat का मेहमान — मालिक को कुछ नहीं जाता।** सबसे ज़रूरी अकेली assertion |
| 3 | **किराए के flat की शिकायत — मालिक को नहीं दिखती** (ADDA की मानी हुई चूक) |
| 4 | खाली flat → committee के पास, किसी resident के पास नहीं |
| 5 | data-only सदस्य कभी नहीं पूछे जाते; **किसी के पास login न हो तो सीधे fallback** |
| 6 | `effectivePolicy` — resident admin की छत से ऊपर नहीं जा सकता |
| 7 | Override बिना कारण नहीं बनता; audit में दिखता है; resident को सूचना जाती है |
| 8 | Auto-close हमेशा `isEstimated: true`; हिसाब मिलता है |
| 9 | QR का HMAC — छेड़ा गया QR ठुकराया जाए; कोड दूसरी बार न चले |
| 10 | Offline queue: network बंद → entry बने → sync पर कोई नक़ल नहीं |
| 11 | Retention purge — 90 दिन पुरानी entry **और उसकी फ़ोटो** दोनों मिटें |
| 12 | Resident दूसरे flat का log **API से भी** न देख पाए |
| 13 | `requirePermission` — माली की token से gate console की API **403** |
| 14 | **Block-दायरा backend पर लागू हो** — A-wing वाला committee सदस्य C-wing की शिकायत API से भी न देखे |
| 15 | Cross-society: A का guard B की entry न देखे |
| 15b | **दो societies एक ही नाम का `AccessRole` बना सकें** — कोई duplicate-key नहीं |
| 15c | **दूसरी society का `accessRoleId` ठुकराया जाए** — भले ObjectId असली हो |
| 16 | **`staffId` वाली expense lines का योग ledger से मिले**; प्रति-staff हिसाब सही |
| 17 | `5200` खाता सच में बना — **कोई और खाता/group उस कोड को पहले न ले चुका हो** |
| 18 | Excel: ग़लत staff code वाली पंक्ति **ERROR** हो, पूरी file नहीं |
| 19 | **आचरण की शिकायत trade routing से कभी न जाए**, और जिसके ख़िलाफ़ है उसे कभी न दिखे |
| 20 | Routing की सीढ़ी: PRIMARY → BACKUP → SOCIETY → "बाँटना बाक़ी"। **कभी अनाथ नहीं** |
| 21 | रुकी घड़ी: रुके समय में SLA न बढ़े; कारण बंद सूची से ही आए |
| 22 | Staff `WORK_DONE` कर सके, `CLOSED` **नहीं** |
| 23 | `reopenCount` बढ़े — status वापस NEW करने से गिनती न मिटे |
| 24 | Admin transfer: **स्वीकार से पहले कुछ न बदले**; society कभी बिना admin न रहे; दोनों तरफ़ audit |
| 25 | Break-glass: 3 committee सदस्यों से कम पर न चले; कारण अनिवार्य; पुराने admin को सूचना जाए |

> **§29.12, .14 और .17 पर ज़ोर क्यों:** finance का सबसे महँगा सबक़ यह था कि **पास होता हुआ aggregate assertion एक टूटी query छिपा सकता है** — vendor का tie-back पास हो रहा था जबकि payments छँट रहे थे, क्योंकि दो ग़लतियाँ आपस में कट रही थीं। इसलिए अधिकार की जाँच UI से नहीं **सीधे API से** होगी। और §29.17 उस असली बग की भरपाई है जहाँ `1500` खाता कभी बना ही नहीं और महीनों पता नहीं चला।

---

## 30. ज्ञात कमियाँ

**जो अभी बना ही नहीं** (19 जुलाई 2026 तक): इस दस्तावेज़ में लिखी हर चीज़। यह योजना है, manual नहीं।

### हाज़िरी — आपके कहने पर हटाई गई

पिछले मसौदे में staff attendance थी। **आपने कहा उसकी ज़रूरत नहीं**, और मैं सहमत हूँ — staff का काम **शिकायत से** पता चलेगा, जो ज़्यादा सच्चा पैमाना है। "आया या नहीं" से "किया या नहीं" बेहतर सवाल है।

एजेंसी के बिल की जाँच अब staff सूची से होगी (कितने तैनात हैं) — रोज़ की हाज़िरी से नहीं।

> 📌 अगर बाद में ज़रूरत लगे तो `AttendanceMark` जोड़ना आसान रहेगा, क्योंकि `SocietyStaff` और gate console दोनों तब तक बने होंगे।

### Payroll — दायरे से बाहर, जानबूझकर

**वेतन की गणना नहीं होगी।** न PF, न ESIC, न gratuity, न 192B slab, न वेतन पर्ची। §20 सिर्फ़ **"किसे कितना दिया"** दर्ज करता है — वह payroll नहीं, expense है।

तीन वजहें:
1. **ज़्यादातर societies को ज़रूरत नहीं** — गार्ड और सफ़ाईकर्मी एजेंसी से आते हैं
2. **यह अपने आप में पूरा module है**, gate का कोना नहीं — दरें बदलती रहती हैं और ग़लत होने पर क़ानूनी ज़िम्मेदारी बनती है
3. **आधा payroll न होने से बुरा है** — salary का field रखकर उस पर कुछ न करना ठीक वही *घोषित-पर-कभी-न-पढ़ा-गया* field बनाता है जिनसे finance में बारह बग निकले

> 📌 **बाद के लिए:** जब अलग **society application** बने, payroll वहाँ का सवाल है। तब भी उसे अपना module बनाना — gate या finance में ठूँसना नहीं। **इस module ने finance में सिर्फ़ एक खाता जोड़ा है** (§25), इसलिए बाद में payroll आना किसी चीज़ को तोड़े बिना होगा।

### और जो जानबूझकर नहीं कर रहे

| नहीं कर रहे | कारण |
|---|---|
| **चेहरा पहचान** | NoBrokerHood करता है। DPDP में biometric पर अलग बोझ; घरेलू कामगारों की biometric बिना असली सहमति — ThePrint ने विस्तार से उठाया। **हमारा default कभी नहीं** |
| **Aadhaar** | §24। क़ानूनी रूप से अरक्षणीय |
| **Blacklist अभी** | पहचान सुलझे बिना **काम करने का दिखावा — जो सुरक्षा में न होने से बुरा है** |
| **पूरी गुमनाम शिकायत** | 300 flat में flat से आदमी पहचाना जाता है; वादा झूठा होगा और दुरुपयोग को न्योता। §18 का बीच का रास्ता बेहतर |
| **Resident की आवाजाही default में** | निगरानी |
| **सामान/spare parts का stock** | 300 flat की society नल का washer सामने की दुकान से लेती है। हिसाब रखने की लागत फ़ायदे से ज़्यादा |
| **मशीन के घंटों पर preventive maintenance** | DG और लिफ़्ट से runtime पढ़ना पड़ेगा। कैलेंडर काफ़ी है |
| **बहु-स्तरीय मंज़ूरी की श्रृंखला** | एक सीमा, एक मंज़ूरी देने वाला — काफ़ी है |
| **Boom barrier / hardware** | अलग उत्पाद। सिर्फ़ webhook की जगह |

### जो चाहकर भी नहीं कर सकते

**Swiggy/Zomato की integration engineering नहीं, business development है।** MyGate के पास सच में API partnership है — order उठते ही pre-approval बन जाता है, delivery वाला सिर्फ़ अपना नंबर बोलता है। यह उनकी असली खाई है, 6-अंकीय कोड नहीं। **हम इतना कर सकते हैं:** साफ़ श्रेणी + resident का default + तैयार webhook endpoint, ताकि partner मिलने पर जोड़ना सिर्फ़ config हो।

### शोध की सीमाएँ — ईमानदारी से

- **MyGate का marketing पन्ना भरोसेमंद नहीं।** वह validation modes, OTP expiry, auto-blocking जैसी चीज़ें बताता है जो उनके **अपने help centre से टकराती हैं** (blacklist का मामला §3, नियम ३)। इस दस्तावेज़ में हर जगह help centre को माना गया है
- **MyGate के admin panel के असली toggles नहीं देखे जा सके** — `adminfaq` का settings पन्ना नहीं खुला
- **Admin के अधिकार के दुरुपयोग का कोई दर्ज मामला नहीं मिला** — छह तरह से खोजा। इसका मतलब यह नहीं कि होता नहीं; vendor की support ticket सार्वजनिक नहीं होतीं
- **Bye-law 113 पर स्रोत टकराते हैं** — "Secretary अनिवार्य" बनाम "तीन में से कोई दो"। इसलिए §3 नियम ११ में इसे सेट करने योग्य रखा है, मान लिया हुआ नहीं

### खुले सवाल जिन पर आपका फ़ैसला चाहिए

1. **SMS/IVR जोड़ें?** — फ़ोन बंद वाले resident तक पहुँचने का यही रास्ता। पैसे वाला फ़ैसला
2. **Gate console web पर या native app?** — सलाह: web पहले (सस्ता tablet, app store नहीं, camera HTTPS पर)
3. **ANPR provider** — per-lookup ख़र्च; क़ीमत verify करनी होगी
4. **मौजूदा SYSTEM_EMPLOYEE की permissions भी backend पर लागू करें?** — दायरे से बाहर पर असली (§7)
5. **Phase 3 (शिकायत) को Phase 1–2 से पहले करें?** — अगर gate से ज़्यादा ज़रूरी लगे तो हो सकता है

---

*यह दस्तावेज़ MyGate, ADDA, NoBrokerHood, ApnaComplex पर सार्वजनिक शोध; महाराष्ट्र सहकारी संस्था अधिनियम 1960, Model Bye-laws 113/114/121/125/139, दिल्ली DCS Act 2003; DPDP अधिनियम 2023; तथा 19 जुलाई 2026 को ResiSmart codebase की `file:line` सहित जाँच पर आधारित है। जहाँ स्रोत टकराए — ख़ासकर MyGate के marketing पन्ने और उनके help centre के बीच — वहाँ help centre को सही माना गया है और टकराव दर्ज है।*
