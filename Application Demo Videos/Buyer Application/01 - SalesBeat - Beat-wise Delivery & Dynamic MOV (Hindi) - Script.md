# Buyer App Video 1 — SalesBeat: Beat-wise Delivery & Dynamic MOV (Hindi)

- **App:** Qwipo Buyer / Retailer App (ONDC DigiDukaan)
- **Duration:** ~7:27 | 1920×1080 | Voice: hi-IN Swara (female, Indian accent)
- **Source:** demo-call transcript summary + Figma screens (Qwipo Retailer App - Redesign.zip)

## Narration script (scene-wise)

### Scene 1 — Intro — SalesBeat overview
नमस्ते! Qwipo के Buyer App demo में आपका स्वागत है। ये वही app है जो हमारे retailers — यानी kirana दुकानदार — रोज़ इस्तेमाल करते हैं, और ये ONDC DigiDukaan से powered है। आज हम देखेंगे इसका नया SalesBeat delivery planning feature — beat-wise delivery scheduling, dynamic minimum order value, और एक smarter buying experience। मक़सद simple है — retailer को साफ़ पता हो कि माल कब आएगा, और distributor की sales बढ़ें। चलिए, पूरा journey शुरू से देखते हैं।

### Scene 2 — Home Page — smart distributor sorting + dynamic date logic
शुरुआत home page से। यहाँ सबसे बड़ा enhancement है distributor section की smart sorting। पहले distributors किसी भी order में दिखते थे — अब system हर retailer के लिए check करता है कि उसकी location को कौन-कौन से distributors serve करते हैं, हर distributor का beat day क्या है, और सबसे पहले delivery कौन दे सकता है — वही distributor list में सबसे ऊपर आता है। और एक smart बात — अगर आज सोमवार है और distributor का beat day भी सोमवार है, तो आज की delivery possible नहीं है, क्योंकि गाड़ी route पर निकल चुकी है। ऐसे में app अपने आप next Monday दिखाता है — गलत promise कभी नहीं होता।

### Scene 3 — Distributor cards — beat day, Tomorrow, MOV (informational)
अब Authorised Distributors की list देखिए। हर distributor के card पर delivery information पहले से दिखती है। जैसे Sri Sarda Enterprises — Friday twenty-eighth, beat day, minimum order value पाँच सौ। और जिन sellers ने Tomorrow delivery configure की है — जैसे Mahedeva Enterprises — उनके card पर दोनों options दिखते हैं: beat day पाँच सौ के MOV पर, और Tomorrow express पच्चीस सौ के MOV पर। ध्यान रहे — ये screen सिर्फ़ information देती है। यहाँ से delivery option choose नहीं होता — वो checkout पर होगा।

### Scene 4 — Product listing — delivery info साथ-साथ
जब retailer किसी distributor को खोलता है, तो product listing page पर भी delivery information साथ-साथ चलती है। ऊपर वही Delivery by chips — beat day और Tomorrow, दोनों के MOV के साथ। नीचे products — margin, MRP, discounts, free delivery — सब कुछ। यानी दुकानदार खरीदारी करते समय हर वक़्त जानता है कि माल कब आएगा। यहाँ भी ये सिर्फ़ informational है — असली selection cart में होगा।

### Scene 5 — Cart — delivery option का चुनाव (beat day default)
और अब आता है सबसे बड़ा enhancement — cart। यहाँ हर seller के items के नीचे retailer को delivery options मिलते हैं — radio buttons में। Beat Day Delivery, या Tomorrow Delivery। Default में beat day pre-selected रहता है — यानी regular route वाली delivery। लेकिन अगर माल जल्दी चाहिए, तो retailer Tomorrow select कर सकता है। एक cart में अलग-अलग sellers के लिए अलग-अलग choice — हर seller का अपना option।

### Scene 6 — Dynamic MOV validation + Add More guidance
अब dynamic MOV validation देखिए — जैसे ही retailer delivery option बदलता है, required minimum order value भी बदल जाती है। Beat delivery पर MOV हज़ार, तो Tomorrow पर पच्चीस सौ — switch करते ही app तुरंत नया MOV दिखाता है। और अगर order उस MOV से कम है, तो app खुद guide करता है — देखिए ये red button: Add two thousand two hundred twelve rupees more। दुकानदार को exactly पता है कि Tomorrow delivery पाने के लिए कितने का और माल लेना है — यही guidance basket बड़ी करती है।

### Scene 7 — View Items — seller-specific redirection
और जब retailer उस guidance पर View Items click करता है, तो app उसे सिर्फ़ उसी seller के products पर ले जाता है — बाक़ी सारे distributors hide हो जाते हैं। इससे उसी seller से products add करके MOV पूरा करना बहुत आसान हो जाता है — ना गलत seller का product cart में जाएगा, ना कोई confusion।

### Scene 8 — Configurable rules — Tomorrow delivery on/off/free, seller-level
एक ज़रूरी बात — Tomorrow delivery पूरी तरह configurable है। Seller चाहे तो Tomorrow delivery MOV के साथ रखे, चाहे बिना MOV के — free में, promotional campaign की तरह। और चाहे तो Tomorrow delivery पूरी तरह बंद भी रख सकता है। Beat day का MOV भी हर seller अपना अलग रखता है। यानी एक ही app में हर distributor अपनी business strategy चला सकता है — ये सारी settings super admin portal से seller-level पर होती हैं।

### Scene 9 — Orders Summary — consolidated checkout
Checkout पर चलते हैं — Orders Summary। इसे भी redesign किया गया है। पहले हर seller का order अलग-अलग card में दिखता था — अब एक consolidated summary है। हर seller का total, उसके brands और items, और उसका चुना हुआ delivery day — Omkar Enterprise Tomorrow, Vikas Traders Friday beat day। नीचे पूरा bill — total items, grand total, to pay — और delivery address। एक नज़र में पूरा order, और नीचे Place Order।

### Scene 10 — Order Confirmed
Place Order दबाते ही — order confirmed! हर seller को उसका order अपने चुने हुए delivery day पर मिलेगा — beat day वाले orders route की गाड़ी से आएँगे, free delivery के साथ, और Tomorrow वाले अगले दिन। दुकानदार को order करते समय ही सब पता था — ना कोई phone call, ना confusion।

### Scene 11 — Benefits — retailer + distributor + backend serviceability reports
अब एक नज़र फायदों पर — क्योंकि ये feature दोनों तरफ़ जीत है। Retailer को मिलती है delivery visibility — कौन पहले deliver करेगा, किस दिन आएगा, कितना minimum order चाहिए, और जल्दी चाहिए तो faster option। Distributor को मिलती है higher average order value — क्योंकि MOV baskets बड़ी करता है — better beat utilization, Tomorrow delivery से extra sales, और promotions की flexibility। और bonus — backend में uploaded serviceability polygons से reports भी बनती हैं: किस customer को कौन-सा distributor serve करता है, beat day, delivery distance — जो sales और marketing teams customer segmentation और targeted promotions में use करती हैं।

### Scene 12 — Outro
तो ये था SalesBeat — Buyer App का beat-aware ordering experience। Home page पर smart sorting, हर card पर beat day और MOV की जानकारी, cart में delivery का चुनाव, dynamic MOV validation, और consolidated checkout। और याद रखिए — ये सब चलता है उन beats पर, जो super admin serviceability में बनाता है — वो video ज़रूर देखिए। धन्यवाद!

---

*Regenerate: Application Demo Videos/video-pipeline/ — capture-buyer.js → tts.js -buyer → build-video.js -buyer (screens in video-pipeline/buyer-app/)*
