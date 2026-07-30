# Video 3 — Serviceability: Delivery Beats (Hindi)

- **Series:** Super Admin Training
- **Duration:** ~7:33 | 1920×1080 | Voice: hi-IN Swara (female, Indian accent)
- **Note:** series की सबसे important video — business context + app demo + real mobile app flow

## Narration script (scene-wise)

### Scene 1 — Intro
नमस्ते! Qwipo Seller Store series के तीसरे — और सबसे important — video में आपका स्वागत है। आज की topic है Serviceability, यानी delivery beats। ये functionality थोड़ी-सी complex ज़रूर है, लेकिन यही तय करती है कि customer के mobile app पर क्या दिखेगा, और उसका order किस दिन पहुँचेगा। इसलिए आज हम पहले business को समझेंगे, और फिर app में पूरा setup करके दिखाएँगे।

### Scene 2 — Business challenge — distributor की दुनिया
सबसे पहले, distributor की असली दुनिया समझिए। कोई भी distributor — जैसे हमारे example के Sharma Agencies — रोज़ पूरे शहर में delivery नहीं करता। गाड़ियाँ सीमित हैं, और दुकानें सैकड़ों। इसलिए वो हफ़्ते को इलाकों में बाँट देता है — सोमवार को KPHB Colony की एक सौ बीस दुकानें, मंगलवार को Miyapur, बुधवार को Kukatpally, गुरुवार को Bachupally — और इसी तरह पूरा हफ़्ता। इसी fixed route को field में कहते हैं — beat। लेकिन दिक्कत ये है कि दुकानदार को पता ही नहीं होता कि गाड़ी उसके इलाके में कब आती है। Order आज दिया, गाड़ी परसों आएगी — नतीजा: confusion, phone calls, और आधी भरी गाड़ी।

### Scene 3 — Beat क्या है (Area + Days + Company)
Qwipo में इसी problem का digital solution है — Delivery Beat। Beat तीन चीज़ों से मिलकर बनता है। पहली — Area: नक्शे पर खींचा हुआ इलाका, जो एक GeoJSON polygon file से आता है। दूसरी — Delivery days: उस इलाके में delivery के दिन, जैसे सोमवार और गुरुवार। और तीसरी — Company: किस company का माल — क्योंकि हर company का beat plan अलग हो सकता है। तो formula simple है — Area, plus Days, plus Company, equals Delivery Beat। मतलब — इस इलाके में, इस company का माल, इन दिनों पहुँचता है।

### Scene 4 — Serviceability tab — day-first view
अब app में देखते हैं। Seller detail खोलिए — हमने Mahadeva Enterprises लिया — और Serviceability tab पर click कीजिए। यहाँ Delivery Beats का पूरा setup company के हिसाब से grouped दिखता है। देखिए — Mahadev All Brands के छह beats हैं, छह दिनों में फैले हुए। हर delivery day के सामने उस दिन के beats की chips हैं — admin एक ही नज़र में पूरा weekly schedule पढ़ सकता है।

### Scene 5 — Serviceability Map — polygons
अब Map view पर click कीजिए — और ये है इस feature का असली कमाल। हर beat का polygon नक्शे पर अपने अलग रंग में दिखता है — Bachupally, Pragathi Nagar, KPHB Colony, Nizampet — सारे इलाके बिल्कुल साफ़। Distributor के warehouse का pin भी दिखता है। और ऊपर के day filters से आप सिर्फ़ Monday या सिर्फ़ Thursday के इलाके भी देख सकते हैं। इससे admin तुरंत check कर सकता है — coverage में कोई इलाका छूटा तो नहीं? दो beats आपस में गलत overlap तो नहीं कर रहे?

### Scene 6 — Add Delivery Beat dialog
अब चलिए, एक नया beat बनाते हैं। Add delivery beats पर click कीजिए। Form में चार चीज़ें हैं — Company, Beat का नाम, Delivery days, और Polygon file — और चारों mandatory हैं।

### Scene 7 — Beat भरना — नाम, दिन, polygon upload
Company में Mahadev All Brands select कीजिए। Beat name में इलाके की पहचान लिखिए — हमने लिखा Bachupally 1। Delivery days में हमने सोमवार और गुरुवार चुने — यानी इस इलाके में हफ़्ते में दो बार delivery जाएगी। और आखिर में polygon — GeoJSON file upload कीजिए। File valid होते ही green tick आता है, और नीचे map preview में इलाका दिखने लगता है — देखिए, Bachupally का polygon। Save से पहले यहीं confirm कर लीजिए कि यही सही इलाका है।

### Scene 8 — Beat saved — दोनों दिनों में chips
Save करते ही beat list में आ गया! और ध्यान से देखिए — Bachupally 1 अब सोमवार और गुरुवार, दोनों rows में दिख रहा है, 2d badge के साथ — यानी एक ही इलाका, हफ़्ते में दो delivery days। Mahadev All Brands के अब सात beats हो गए। यही है admin का day-first view — हर दिन के सामने, उस दिन serve होने वाले सारे इलाके।

### Scene 9 — Mobile app impact — असली app flow (Distributors → Cart → Order Confirmed)
अब सबसे ज़रूरी सवाल — इस पूरे setup का फायदा क्या? जवाब है — retailer का mobile app। ये देखिए, असली app का पूरा flow। पहली screen — Authorised Distributors। दुकानदार app खोलता है, तो app उसकी location से समझ जाता है कि वो किस beat के polygon के अंदर है — और हर distributor के साथ delivery day पहले से दिखता है: Shri Sai Krishna Traders — Tomorrow, beat day; Sri Sarda Enterprises — Friday twenty eighth, beat day। साथ में Seller MOV भी — minimum order value। दूसरी screen — Cart Summary। हर distributor के items के नीचे दुकानदार delivery day खुद चुनता है — beat day पर free delivery, या ज़्यादा MOV पर Tomorrow express। और तीसरी screen — order confirmed! दुकानदार को order करते समय ही पता है कि माल किस दिन आएगा — ना कोई phone call, ना confusion। और distributor की गाड़ी एक दिन में एक ही इलाके के orders लेकर full निकलती है — कम खर्च, time पर delivery, खुश customer। यही है beat functionality की असली ताकत।

### Scene 10 — 3 golden rules
जाते-जाते तीन golden rules याद रखिए — system इन्हें खुद enforce करता है। पहला — beat का नाम हर company के अंदर unique होना चाहिए। दूसरा — एक ही नाम का beat हर company में same delivery days रखेगा — इलाका एक है, तो schedule भी एक होना चाहिए। और तीसरा — अगर दो polygons आपस में overlap करते हैं, तो उनके delivery days match होने चाहिए — वरना एक ही दुकान को app में दो अलग-अलग दिन दिखेंगे। गलती होने पर system save से पहले ही warning दे देता है।

### Scene 11 — Outro — series complete
तो ये थी Serviceability — beat यानी Area, Days, और Company; app में beats बनाना, map पर coverage verify करना, और mobile app के ज़रिए customer तक सही delivery day पहुँचाना। और इसी के साथ हमारी तीन videos की series पूरी होती है — Video एक: seller बनाना; Video दो: companies, tagging और connectors; और Video तीन: serviceability। अब आप Qwipo Seller Store के Super Admin के तौर पर पूरी तरह तैयार हैं। धन्यवाद, और all the best!

---

*Regenerate: Application Demo Videos/video-pipeline/ — capture-v3.js → tts.js -v3 → build-video.js -v3*
