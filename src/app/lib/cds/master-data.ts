// Cross Dock Store (CDS) — master data for the Hyderabad network.
// Locations, distributors (sellers), retailers and the FMCG catalogue
// used to generate the interconnected synthetic operations data.

import type { CdsLocation, CdsProduct, CdsRetailer, CdsSeller, Rider } from "./types";

export const CDS_LOCATIONS: CdsLocation[] = [
  { id: "kkp", name: "Kukatpally CDS", code: "CDS-KKP", locality: "KPHB Colony", address: "Plot 41, Road No. 4, KPHB Phase 3, Kukatpally, Hyderabad 500072", manager: "Praveen Kumar", phone: "9849012345", status: "Active", inwardCutoff: "11:30", dispatchCutoff: "14:00", crates: 60, darkStoreId: "kphb" },
  { id: "myp", name: "Miyapur CDS", code: "CDS-MYP", locality: "Miyapur X Roads", address: "H.No 1-42/7, Allwyn Colony Road, Miyapur, Hyderabad 500049", manager: "Swathi Reddy", phone: "9866023456", status: "Active", inwardCutoff: "11:30", dispatchCutoff: "14:00", crates: 48 },
  { id: "kdp", name: "Kondapur CDS", code: "CDS-KDP", locality: "Botanical Garden Road", address: "Sy. No 87, Botanical Garden Road, Kondapur, Hyderabad 500084", manager: "Rahul Varma", phone: "9908034567", status: "Active", inwardCutoff: "11:00", dispatchCutoff: "13:30", crates: 48 },
  { id: "gcb", name: "Gachibowli CDS", code: "CDS-GCB", locality: "Gopanpally Thanda", address: "Unit 3, Indira Nagar Industrial Lane, Gachibowli, Hyderabad 500032", manager: "Imran Shaik", phone: "9959045678", status: "Active", inwardCutoff: "11:00", dispatchCutoff: "13:30", crates: 40 },
  { id: "mdp", name: "Madhapur CDS", code: "CDS-MDP", locality: "Ayyappa Society", address: "Plot 112, Ayyappa Society Main Road, Madhapur, Hyderabad 500081", manager: "Keerthi Rao", phone: "9849156789", status: "Active", inwardCutoff: "11:00", dispatchCutoff: "13:30", crates: 36 },
  { id: "upl", name: "Uppal CDS", code: "CDS-UPL", locality: "Uppal Depot Road", address: "H.No 2-3-61, Ramanthapur Road, Uppal, Hyderabad 500039", manager: "Srikanth Goud", phone: "9866267890", status: "Active", inwardCutoff: "11:30", dispatchCutoff: "14:00", crates: 36 },
  { id: "lbn", name: "LB Nagar CDS", code: "CDS-LBN", locality: "Sagar Ring Road", address: "Shed 7, Sagar Ring Road, LB Nagar, Hyderabad 500074", manager: "Mahesh Yadav", phone: "9908378901", status: "Active", inwardCutoff: "11:30", dispatchCutoff: "14:00", crates: 36 },
  { id: "amp", name: "Ameerpet CDS", code: "CDS-AMP", locality: "SR Nagar", address: "6-3-1090, SR Nagar Main Road, Ameerpet, Hyderabad 500038", manager: "Anusha Patel", phone: "9959489012", status: "Active", inwardCutoff: "11:00", dispatchCutoff: "13:30", crates: 30 },
  { id: "sec", name: "Secunderabad CDS", code: "CDS-SEC", locality: "Paradise Circle", address: "1-7-218, SD Road, Secunderabad 500003", manager: "Joseph D'Souza", phone: "9849590123", status: "Active", inwardCutoff: "11:30", dispatchCutoff: "14:00", crates: 30 },
  { id: "alw", name: "Alwal CDS", code: "CDS-ALW", locality: "Lothkunta", address: "Plot 9, Lothkunta Main Road, Alwal, Secunderabad 500010", manager: "Venu Gopal", phone: "9866601234", status: "Active", inwardCutoff: "11:30", dispatchCutoff: "14:00", crates: 30, darkStoreId: "alwal" },
  { id: "kmp", name: "Kompally CDS", code: "CDS-KMP", locality: "Suchitra Circle", address: "Survey 210, Kompally Main Road, Hyderabad 500014", manager: "Ravi Teja", phone: "9908712345", status: "Onboarding", goLive: "20 Nov 2026", inwardCutoff: "11:30", dispatchCutoff: "14:00", crates: 30 },
  { id: "dsn", name: "Dilsukhnagar CDS", code: "CDS-DSN", locality: "Kothapet", address: "16-11-740, Kothapet Road, Dilsukhnagar, Hyderabad 500060", manager: "Lavanya S", phone: "9959823456", status: "Onboarding", goLive: "20 Nov 2026", inwardCutoff: "11:30", dispatchCutoff: "14:00", crates: 30 },
  { id: "mhp", name: "Mehdipatnam CDS", code: "CDS-MHP", locality: "Rethibowli", address: "12-2-823, Rethibowli, Mehdipatnam, Hyderabad 500028", manager: "Faisal Ahmed", phone: "9849934567", status: "Onboarding", goLive: "27 Nov 2026", inwardCutoff: "11:30", dispatchCutoff: "14:00", crates: 30 },
  { id: "trk", name: "Tarnaka CDS", code: "CDS-TRK", locality: "Lalapet Road", address: "12-13-410, Lalapet Road, Tarnaka, Secunderabad 500017", manager: "Sandeep N", phone: "9866045678", status: "Onboarding", goLive: "04 Dec 2026", inwardCutoff: "11:30", dispatchCutoff: "14:00", crates: 24 },
  { id: "atp", name: "Attapur CDS", code: "CDS-ATP", locality: "Pillar 140, PVNR Expressway", address: "Plot 55, Hyderguda Road, Attapur, Hyderabad 500048", manager: "Nikhil Jain", phone: "9908156789", status: "Onboarding", goLive: "04 Dec 2026", inwardCutoff: "11:30", dispatchCutoff: "14:00", crates: 24 },
];

/** Relative order volume per active CDS. */
export const CDS_INTENSITY: Record<string, number> = {
  kkp: 1, myp: 0.85, kdp: 0.8, gcb: 0.7, mdp: 0.5, upl: 0.45, lbn: 0.45, amp: 0.35, sec: 0.35, alw: 0.35,
};

export const PRODUCTS: CdsProduct[] = [
  { sku: "ITC-AAT-10", name: "Aashirvaad Shudh Chakki Atta 10 kg", brand: "ITC", uom: "Bag 10 kg", price: 468 },
  { sku: "ITC-SDF-150", name: "Sunfeast Dark Fantasy Choco Fills 150 g", brand: "ITC", uom: "Box of 12", price: 396 },
  { sku: "ITC-BNG-90", name: "Bingo Mad Angles Achaari 90 g", brand: "ITC", uom: "Box of 20", price: 360 },
  { sku: "ITC-YPN-70", name: "YiPPee! Magic Masala Noodles 70 g", brand: "ITC", uom: "Case of 48", price: 528 },
  { sku: "ITC-SNT-125", name: "Savlon Glycerin Soap 125 g", brand: "ITC", uom: "Pack of 12", price: 444 },
  { sku: "CLG-STG-200", name: "Colgate Strong Teeth 200 g", brand: "Colgate-Palmolive", uom: "Pack of 12", price: 1176 },
  { sku: "CLG-MAX-150", name: "Colgate MaxFresh Gel 150 g", brand: "Colgate-Palmolive", uom: "Pack of 12", price: 1224 },
  { sku: "CLG-PLM-125", name: "Palmolive Naturals Soap 125 g", brand: "Colgate-Palmolive", uom: "Pack of 12", price: 516 },
  { sku: "CLG-ZIG-1", name: "Colgate ZigZag Toothbrush", brand: "Colgate-Palmolive", uom: "Pack of 24", price: 672 },
  { sku: "EMM-NAV-200", name: "Navratna Ayurvedic Cool Oil 200 ml", brand: "Emami", uom: "Pack of 12", price: 1404 },
  { sku: "EMM-BOR-80", name: "BoroPlus Antiseptic Cream 80 ml", brand: "Emami", uom: "Pack of 12", price: 1068 },
  { sku: "EMM-ZDB-25", name: "Zandu Balm 25 ml", brand: "Emami", uom: "Pack of 24", price: 1680 },
  { sku: "EMM-KSK-100", name: "Kesh King Ayurvedic Oil 100 ml", brand: "Emami", uom: "Pack of 12", price: 1500 },
  { sku: "HUL-SRF-1", name: "Surf Excel Easy Wash 1 kg", brand: "Hindustan Unilever", uom: "Bag of 10", price: 1240 },
  { sku: "HUL-RIN-250", name: "Rin Detergent Bar 250 g", brand: "Hindustan Unilever", uom: "Pack of 24", price: 576 },
  { sku: "HUL-VIM-300", name: "Vim Dishwash Bar 300 g", brand: "Hindustan Unilever", uom: "Pack of 24", price: 624 },
  { sku: "HUL-RDL-500", name: "Brooke Bond Red Label Tea 500 g", brand: "Hindustan Unilever", uom: "Pack of 12", price: 3240 },
  { sku: "HUL-CLP-175", name: "Clinic Plus Strong & Long Shampoo 175 ml", brand: "Hindustan Unilever", uom: "Pack of 12", price: 1308 },
  { sku: "TAT-SLT-1", name: "Tata Salt 1 kg", brand: "Tata Consumer", uom: "Bag of 25", price: 600 },
  { sku: "TAT-TEA-1", name: "Tata Tea Premium 1 kg", brand: "Tata Consumer", uom: "Pack of 6", price: 2940 },
  { sku: "TAT-SMP-1", name: "Tata Sampann Toor Dal 1 kg", brand: "Tata Consumer", uom: "Pack of 10", price: 1680 },
  { sku: "FRD-SFO-1", name: "Freedom Refined Sunflower Oil 1 L", brand: "Gemini Edibles", uom: "Box of 10", price: 1390 },
  { sku: "FRD-SFO-5", name: "Freedom Refined Sunflower Oil 5 L", brand: "Gemini Edibles", uom: "Jar 5 L", price: 698 },
  { sku: "FRT-SFO-1", name: "Fortune Sunlite Sunflower Oil 1 L", brand: "Adani Wilmar", uom: "Box of 10", price: 1420 },
  { sku: "FRT-RCB-1", name: "Fortune Rice Bran Oil 1 L", brand: "Adani Wilmar", uom: "Box of 10", price: 1520 },
  { sku: "PRL-PGB-800", name: "Parle-G Gold Biscuits 800 g", brand: "Parle", uom: "Case of 12", price: 1080 },
  { sku: "PRL-MNC-120", name: "Parle Monaco Classic 120 g", brand: "Parle", uom: "Case of 24", price: 576 },
  { sku: "BRT-GDY-200", name: "Britannia Good Day Cashew 200 g", brand: "Britannia", uom: "Case of 24", price: 1128 },
  { sku: "BRT-MRG-250", name: "Britannia Marie Gold 250 g", brand: "Britannia", uom: "Case of 24", price: 864 },
  { sku: "NST-MGI-12", name: "Maggi 2-Minute Masala Noodles 12-pack", brand: "Nestle", uom: "Case of 8", price: 1312 },
  { sku: "NST-NSC-50", name: "Nescafe Classic 50 g", brand: "Nestle", uom: "Pack of 12", price: 2016 },
  { sku: "MRC-PCH-300", name: "Parachute Coconut Oil 300 ml", brand: "Marico", uom: "Pack of 12", price: 1596 },
  { sku: "MRC-SFL-1", name: "Saffola Gold Oil 1 L", brand: "Marico", uom: "Box of 10", price: 1890 },
  { sku: "PTJ-DNT-200", name: "Patanjali Dant Kanti 200 g", brand: "Patanjali", uom: "Pack of 12", price: 1032 },
  { sku: "PTJ-GHE-1", name: "Patanjali Cow Ghee 1 L", brand: "Patanjali", uom: "Pack of 6", price: 3690 },
  { sku: "VJD-TDL-25", name: "Vijayalakshmi Toor Dal 25 kg", brand: "Vijayalakshmi Dall Mill", uom: "Bag 25 kg", price: 3875 },
  { sku: "SRK-SNR-25", name: "Sri Krishna Sona Masoori Rice 25 kg", brand: "Sri Krishna Rice Industries", uom: "Bag 25 kg", price: 1450 },
  { sku: "MHT-BPT-26", name: "Mahateja BPT Raw Rice 26 kg", brand: "Mahateja Ricemills", uom: "Bag 26 kg", price: 1560 },
  { sku: "RNK-SGR-1", name: "Renuka Sugar 1 kg", brand: "Shree Renuka Sugars", uom: "Bag of 30", price: 1350 },
  { sku: "KRN-CHL-500", name: "Karani Chilli Powder 500 g", brand: "Karani Spices", uom: "Pack of 20", price: 2600 },
];

export const SELLERS: CdsSeller[] = [
  { id: "s-rmt", name: "RM Traders", area: "Balanagar", contact: "Rakesh Mehta", phone: "9849123401", brands: ["ITC", "Parle", "Britannia"], cdsIds: ["kkp", "myp", "sec"] },
  { id: "s-ssr", name: "Sri Sai Ram Agencies", area: "Kukatpally", contact: "Sai Ram Prasad", phone: "9866123402", brands: ["Hindustan Unilever", "Nestle"], cdsIds: ["kkp", "kdp", "amp"] },
  { id: "s-jga", name: "Jagadish Agencies", area: "Moosapet", contact: "Jagadish Rao", phone: "9963120143", brands: ["Emami"], cdsIds: ["kkp", "myp", "alw"] },
  { id: "s-yln", name: "YLN Traders", area: "Jeedimetla", contact: "Y. L. Narasimha", phone: "9390969061", brands: ["Colgate-Palmolive"], cdsIds: ["kkp", "myp", "sec", "alw"] },
  { id: "s-knt", name: "Kanta Marketing", area: "Chandanagar", contact: "Kanta Rao", phone: "9030003800", brands: ["Colgate-Palmolive", "Marico"], cdsIds: ["kkp", "kdp", "gcb"] },
  { id: "s-mas", name: "MAS Marketing", area: "Madhapur", contact: "Mohd. Abdul Sattar", phone: "9866198219", brands: ["Emami", "Patanjali"], cdsIds: ["kdp", "gcb", "mdp"] },
  { id: "s-skt", name: "Shri Sai Krishna Traders", area: "Begum Bazar", contact: "Krishna Agarwal", phone: "8121062768", brands: ["Tata Consumer", "Vijayalakshmi Dall Mill", "Sri Krishna Rice Industries", "Shree Renuka Sugars"], cdsIds: ["kkp", "myp", "kdp", "gcb", "upl", "lbn"] },
  { id: "s-jgn", name: "Jai Ganesh Agencies", area: "Miyapur", contact: "Ganesh Kumar", phone: "9985633229", brands: ["Emami", "Gemini Edibles"], cdsIds: ["myp", "kkp"] },
  { id: "s-blj", name: "Balaji Distributors", area: "Uppal", contact: "Balaji Naidu", phone: "9849223409", brands: ["Hindustan Unilever", "Britannia"], cdsIds: ["upl", "lbn", "sec"] },
  { id: "s-lve", name: "Lakshmi Venkateswara Enterprises", area: "Dilsukhnagar", contact: "Venkatesh Gupta", phone: "9866323410", brands: ["Adani Wilmar", "Gemini Edibles"], cdsIds: ["lbn", "upl"] },
  { id: "s-svt", name: "Sri Vinayaka Trading Co", area: "Ameerpet", contact: "Vinay Kumar", phone: "9908423411", brands: ["Parle", "Nestle"], cdsIds: ["amp", "mdp", "kdp"] },
  { id: "s-hng", name: "Hanuman Agencies", area: "Secunderabad", contact: "Hanumanth Rao", phone: "9959523412", brands: ["Tata Consumer", "Marico"], cdsIds: ["sec", "alw", "upl"] },
  { id: "s-afd", name: "Annapurna Foods Distributors", area: "Kondapur", contact: "Annapurna Devi", phone: "9849623413", brands: ["Mahateja Ricemills", "Sri Krishna Rice Industries", "Karani Spices"], cdsIds: ["kdp", "gcb", "mdp", "myp"] },
  { id: "s-dfd", name: "Deccan FMCG Distributors", area: "Attapur", contact: "Sameer Khan", phone: "9866723414", brands: ["ITC", "Hindustan Unilever"], cdsIds: ["gcb", "mdp", "amp"] },
  { id: "s-bhm", name: "Bhavani Marketing", area: "LB Nagar", contact: "Bhavani Shankar", phone: "9908823415", brands: ["Colgate-Palmolive", "Britannia"], cdsIds: ["lbn", "upl"] },
  { id: "s-sda", name: "Sree Durga Agencies", area: "Alwal", contact: "Durga Prasad", phone: "9959923416", brands: ["Parle", "Adani Wilmar"], cdsIds: ["alw", "sec"] },
  { id: "s-vse", name: "Vijaya Sai Enterprises", area: "Gachibowli", contact: "Vijaya Lakshmi", phone: "9849723417", brands: ["Nestle", "Marico", "Patanjali"], cdsIds: ["gcb", "kdp", "mdp"] },
  { id: "s-gwh", name: "Golconda Wholesale", area: "Mehdipatnam", contact: "Syed Irfan", phone: "9866823418", brands: ["Gemini Edibles", "Shree Renuka Sugars", "Tata Consumer"], cdsIds: ["amp", "mdp"] },
];

/** The seller account that operates the CDS module in this demo. */
export const OPERATOR_SELLER_ID = "s-rmt";

const RETAILER_PREFIX = [
  "Sri Lakshmi", "Venkateswara", "Balaji", "Sai Ram", "Durga Bhavani", "Ganesh", "Hanuman", "Annapurna", "Manjeera", "New Krishna", "Om Sai", "Sree Ram", "Vijaya", "Siddhi Vinayaka", "Mahalaxmi", "Kanaka Durga", "Sri Venkata Sai", "Raghavendra", "Padmavathi", "Tirumala", "Royal", "Star", "Fresh Choice", "Green Basket", "Daily Needs", "Sri Sai Balaji", "Anjaneya", "Bhagyalakshmi", "Srinivasa", "Sai Krupa",
];
const RETAILER_SUFFIX: { s: string; t: CdsRetailer["type"] }[] = [
  { s: "Kirana", t: "Kirana" },
  { s: "Kirana & General Stores", t: "Kirana" },
  { s: "General Stores", t: "General Store" },
  { s: "Super Market", t: "Supermarket" },
  { s: "Provision Stores", t: "Kirana" },
  { s: "Mart", t: "Supermarket" },
  { s: "Medical & General", t: "Medical & General" },
  { s: "Bakery & Stores", t: "Bakery" },
];
const OWNER_FIRST = ["Ramesh", "Suresh", "Srinivas", "Venkat", "Lakshmi", "Padma", "Narayana", "Mohan", "Raju", "Shankar", "Anil", "Kiran", "Ravi", "Sridevi", "Prasad", "Naresh", "Yadagiri", "Mallesh", "Feroz", "Salim", "Kavitha", "Satyanarayana", "Bhaskar", "Chandra"];
const OWNER_LAST = ["Reddy", "Goud", "Yadav", "Rao", "Naidu", "Chary", "Gupta", "Shaik", "Agarwal", "Mudiraj", "Patel", "Varma"];

export const CDS_AREAS: Record<string, string[]> = {
  kkp: ["KPHB Colony", "Vivekananda Nagar", "Moosapet", "Balaji Nagar", "Allwyn Colony", "Kukatpally Y Junction"],
  myp: ["Miyapur", "Madinaguda", "Hafeezpet", "Chandanagar", "Deepthisri Nagar"],
  kdp: ["Kondapur", "Kothaguda", "Hafeezpet", "Masjid Banda", "Raghavendra Colony"],
  gcb: ["Gachibowli", "Gopanpally", "Nanakramguda", "Telecom Nagar", "Indira Nagar"],
  mdp: ["Madhapur", "Ayyappa Society", "Guttala Begumpet", "Kavuri Hills"],
  upl: ["Uppal", "Ramanthapur", "Habsiguda", "Boduppal", "Peerzadiguda"],
  lbn: ["LB Nagar", "Vanasthalipuram", "Hayathnagar", "Saroornagar", "Kothapet"],
  amp: ["Ameerpet", "SR Nagar", "Erragadda", "Sanjeeva Reddy Nagar"],
  sec: ["Secunderabad", "Marredpally", "Bowenpally", "Trimulgherry"],
  alw: ["Alwal", "Lothkunta", "Macha Bollaram", "Old Alwal"],
};

export const RIDERS: Rider[] = [
  { name: "Ramesh K", phone: "9701234501", vehicle: "TS 08 UC 4821 · Tata Ace" },
  { name: "Suresh Goud", phone: "9701234502", vehicle: "TS 07 EZ 1932 · Piaggio Ape EV" },
  { name: "Naveen Reddy", phone: "9701234503", vehicle: "TS 09 FA 7710 · Mahindra Jeeto" },
  { name: "Srinivas B", phone: "9701234504", vehicle: "TS 08 HB 2245 · Tata Ace Gold" },
  { name: "Anil Kumar", phone: "9701234505", vehicle: "TS 10 UD 9054 · Ashok Leyland Dost" },
  { name: "Praveen M", phone: "9701234506", vehicle: "TS 07 GK 3318 · Piaggio Ape EV" },
  { name: "Kiran Naik", phone: "9701234507", vehicle: "TS 08 JC 6672 · Mahindra Supro" },
  { name: "Venkatesh P", phone: "9701234508", vehicle: "TS 09 EH 4407 · Tata Ace" },
  { name: "Mahesh Chary", phone: "9701234509", vehicle: "TS 11 UB 5530 · Euler HiLoad EV" },
  { name: "Imran Khan", phone: "9701234510", vehicle: "TS 08 KD 8191 · Mahindra Jeeto" },
  { name: "Raju Yadav", phone: "9701234511", vehicle: "TS 07 HM 2084 · Tata Ace" },
  { name: "Shiva Prasad", phone: "9701234512", vehicle: "TS 09 GB 6239 · Piaggio Ape EV" },
  { name: "Sai Kiran", phone: "9701234513", vehicle: "TS 08 FB 1123 · Tata Ace" },
  { name: "Ravi Kumar G", phone: "9701234514", vehicle: "TS 07 JD 4410 · Mahindra Jeeto" },
  { name: "Nagaraju B", phone: "9701234515", vehicle: "TS 10 EA 3391 · Piaggio Ape EV" },
  { name: "Abdul Rahman", phone: "9701234516", vehicle: "TS 09 HC 7785 · Tata Ace Gold" },
  { name: "Prakash Rao", phone: "9701234517", vehicle: "TS 08 GE 2290 · Euler HiLoad EV" },
  { name: "Yadagiri M", phone: "9701234518", vehicle: "TS 07 FK 6603 · Ashok Leyland Dost" },
  { name: "Harish Goud", phone: "9701234519", vehicle: "TS 11 EB 1847 · Mahindra Supro" },
  { name: "Santosh K", phone: "9701234520", vehicle: "TS 08 UA 9312 · Piaggio Ape EV" },
  { name: "Bhaskar Reddy", phone: "9701234521", vehicle: "TS 09 FD 5526 · Tata Ace" },
  { name: "Rajesh Naik", phone: "9701234522", vehicle: "TS 07 UC 4038 · Mahindra Jeeto" },
  { name: "Feroz Ali", phone: "9701234523", vehicle: "TS 10 GD 7714 · Tata Ace" },
  { name: "Srikanth V", phone: "9701234524", vehicle: "TS 08 HE 2659 · Euler HiLoad EV" },
  { name: "Mallesh P", phone: "9701234525", vehicle: "TS 07 EB 8841 · Piaggio Ape EV" },
  { name: "Vamshi Krishna", phone: "9701234526", vehicle: "TS 09 JA 3175 · Tata Ace Gold" },
  { name: "Ganesh Yadav", phone: "9701234527", vehicle: "TS 11 FC 6402 · Mahindra Jeeto" },
  { name: "Chandu Teja", phone: "9701234528", vehicle: "TS 08 KB 1984 · Ashok Leyland Dost" },
];

/** Deterministic retailer roster per active CDS. */
export function buildRetailers(rand: () => number): CdsRetailer[] {
  const out: CdsRetailer[] = [];
  const used = new Set<string>();
  let n = 1;
  for (const loc of CDS_LOCATIONS) {
    if (loc.status !== "Active") continue;
    const count = Math.round(8 + 10 * (CDS_INTENSITY[loc.id] ?? 0.3));
    const areas = CDS_AREAS[loc.id] ?? [loc.locality];
    for (let i = 0; i < count; i++) {
      let name = "";
      let type: CdsRetailer["type"] = "Kirana";
      for (let guard = 0; guard < 50; guard++) {
        const p = RETAILER_PREFIX[Math.floor(rand() * RETAILER_PREFIX.length)];
        const sfx = RETAILER_SUFFIX[Math.floor(rand() * RETAILER_SUFFIX.length)];
        name = `${p} ${sfx.s}`;
        type = sfx.t;
        if (!used.has(name)) break;
      }
      used.add(name);
      const area = areas[i % areas.length];
      out.push({
        id: `r-${String(n).padStart(3, "0")}`,
        name,
        owner: `${OWNER_FIRST[Math.floor(rand() * OWNER_FIRST.length)]} ${OWNER_LAST[Math.floor(rand() * OWNER_LAST.length)]}`,
        phone: `9${Math.floor(100000000 + rand() * 899999999)}`,
        area,
        cdsId: loc.id,
        // Allwyn Colony sits on the Kukatpally / Miyapur border — the
        // serviceability check routes these retailers via Miyapur CDS.
        serviceableCdsId: loc.id === "kkp" && area === "Allwyn Colony" ? "myp" : loc.id,
        type,
      });
      n++;
    }
  }
  return out;
}
