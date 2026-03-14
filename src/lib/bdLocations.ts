// Bangladesh Districts and Thanas (Upazilas) data
export interface District {
  name: string;
  name_bn: string;
  thanas: { name: string; name_bn: string }[];
}

export const BD_DISTRICTS: District[] = [
  { name: "Dhaka", name_bn: "ঢাকা", thanas: [
    { name: "Dhanmondi", name_bn: "ধানমন্ডি" }, { name: "Gulshan", name_bn: "গুলশান" },
    { name: "Mirpur", name_bn: "মিরপুর" }, { name: "Mohammadpur", name_bn: "মোহাম্মদপুর" },
    { name: "Uttara", name_bn: "উত্তরা" }, { name: "Tejgaon", name_bn: "তেজগাঁও" },
    { name: "Motijheel", name_bn: "মতিঝিল" }, { name: "Ramna", name_bn: "রমনা" },
    { name: "Lalbagh", name_bn: "লালবাগ" }, { name: "Kotwali", name_bn: "কোতোয়ালি" },
    { name: "Sutrapur", name_bn: "সূত্রাপুর" }, { name: "Bangshal", name_bn: "বংশাল" },
    { name: "Wari", name_bn: "ওয়ারী" }, { name: "Khilgaon", name_bn: "খিলগাঁও" },
    { name: "Demra", name_bn: "ডেমরা" }, { name: "Sabujbagh", name_bn: "সবুজবাগ" },
    { name: "Kafrul", name_bn: "কাফরুল" }, { name: "Cantonment", name_bn: "ক্যান্টনমেন্ট" },
    { name: "Pallabi", name_bn: "পল্লবী" }, { name: "Shah Ali", name_bn: "শাহ আলী" },
    { name: "Turag", name_bn: "তুরাগ" }, { name: "Badda", name_bn: "বাড্ডা" },
    { name: "Vatara", name_bn: "ভাটারা" }, { name: "Savar", name_bn: "সাভার" },
    { name: "Dhamrai", name_bn: "ধামরাই" }, { name: "Keraniganj", name_bn: "কেরানীগঞ্জ" },
    { name: "Nawabganj", name_bn: "নবাবগঞ্জ" }, { name: "Dohar", name_bn: "দোহার" },
    { name: "Tongi", name_bn: "টঙ্গী" }, { name: "Gazipur Sadar", name_bn: "গাজীপুর সদর" },
    { name: "Adabor", name_bn: "আদাবর" }, { name: "Hazaribagh", name_bn: "হাজারীবাগ" },
    { name: "Jatrabari", name_bn: "যাত্রাবাড়ী" }, { name: "Kadamtali", name_bn: "কদমতলী" },
    { name: "Kamrangirchar", name_bn: "কামরাঙ্গীরচর" }, { name: "Shyampur", name_bn: "শ্যামপুর" },
  ]},
  { name: "Chittagong", name_bn: "চট্টগ্রাম", thanas: [
    { name: "Kotwali", name_bn: "কোতোয়ালি" }, { name: "Panchlaish", name_bn: "পাঁচলাইশ" },
    { name: "Bayezid", name_bn: "বায়েজিদ" }, { name: "Chandgaon", name_bn: "চান্দগাঁও" },
    { name: "Double Mooring", name_bn: "ডবলমুরিং" }, { name: "Halishahar", name_bn: "হালিশহর" },
    { name: "Patenga", name_bn: "পতেঙ্গা" }, { name: "Bakalia", name_bn: "বাকলিয়া" },
    { name: "Bandar", name_bn: "বন্দর" }, { name: "Pahartali", name_bn: "পাহাড়তলী" },
    { name: "Sitakunda", name_bn: "সীতাকুণ্ড" }, { name: "Mirsharai", name_bn: "মিরসরাই" },
    { name: "Sandwip", name_bn: "সন্দ্বীপ" }, { name: "Patiya", name_bn: "পটিয়া" },
    { name: "Rangunia", name_bn: "রাঙ্গুনিয়া" }, { name: "Anwara", name_bn: "আনোয়ারা" },
    { name: "Boalkhali", name_bn: "বোয়ালখালী" }, { name: "Fatikchhari", name_bn: "ফটিকছড়ি" },
    { name: "Hathazari", name_bn: "হাটহাজারী" }, { name: "Raozan", name_bn: "রাউজান" },
    { name: "Lohagara", name_bn: "লোহাগাড়া" }, { name: "Satkania", name_bn: "সাতকানিয়া" },
    { name: "Chandanaish", name_bn: "চন্দনাইশ" },
  ]},
  { name: "Rajshahi", name_bn: "রাজশাহী", thanas: [
    { name: "Boalia", name_bn: "বোয়ালিয়া" }, { name: "Matihar", name_bn: "মতিহার" },
    { name: "Rajpara", name_bn: "রাজপাড়া" }, { name: "Shah Makhdum", name_bn: "শাহ মখদুম" },
    { name: "Paba", name_bn: "পবা" }, { name: "Godagari", name_bn: "গোদাগাড়ী" },
    { name: "Tanore", name_bn: "তানোর" }, { name: "Bagmara", name_bn: "বাগমারা" },
    { name: "Puthia", name_bn: "পুঠিয়া" }, { name: "Durgapur", name_bn: "দুর্গাপুর" },
    { name: "Charghat", name_bn: "চারঘাট" }, { name: "Bagha", name_bn: "বাঘা" },
    { name: "Mohanpur", name_bn: "মোহনপুর" },
  ]},
  { name: "Khulna", name_bn: "খুলনা", thanas: [
    { name: "Khulna Sadar", name_bn: "খুলনা সদর" }, { name: "Sonadanga", name_bn: "সোনাডাঙ্গা" },
    { name: "Khalishpur", name_bn: "খালিশপুর" }, { name: "Daulatpur", name_bn: "দৌলতপুর" },
    { name: "Khan Jahan Ali", name_bn: "খান জাহান আলী" }, { name: "Batiaghata", name_bn: "বটিয়াঘাটা" },
    { name: "Dacope", name_bn: "দাকোপ" }, { name: "Dumuria", name_bn: "ডুমুরিয়া" },
    { name: "Dighalia", name_bn: "দিঘলিয়া" }, { name: "Koyra", name_bn: "কয়রা" },
    { name: "Paikgachha", name_bn: "পাইকগাছা" }, { name: "Phultala", name_bn: "ফুলতলা" },
    { name: "Rupsha", name_bn: "রূপসা" }, { name: "Terokhada", name_bn: "তেরখাদা" },
  ]},
  { name: "Sylhet", name_bn: "সিলেট", thanas: [
    { name: "Kotwali", name_bn: "কোতোয়ালি" }, { name: "Jaintapur", name_bn: "জৈন্তাপুর" },
    { name: "Gowainghat", name_bn: "গোয়াইনঘাট" }, { name: "Companiganj", name_bn: "কোম্পানীগঞ্জ" },
    { name: "Kanaighat", name_bn: "কানাইঘাট" }, { name: "Zakiganj", name_bn: "জকিগঞ্জ" },
    { name: "Beanibazar", name_bn: "বিয়ানীবাজার" }, { name: "Golapganj", name_bn: "গোলাপগঞ্জ" },
    { name: "Fenchuganj", name_bn: "ফেঞ্চুগঞ্জ" }, { name: "Balaganj", name_bn: "বালাগঞ্জ" },
    { name: "Bishwanath", name_bn: "বিশ্বনাথ" }, { name: "Osmaninagar", name_bn: "ওসমানীনগর" },
    { name: "South Surma", name_bn: "দক্ষিণ সুরমা" },
  ]},
  { name: "Rangpur", name_bn: "রংপুর", thanas: [
    { name: "Rangpur Sadar", name_bn: "রংপুর সদর" }, { name: "Gangachara", name_bn: "গঙ্গাচড়া" },
    { name: "Taragonj", name_bn: "তারাগঞ্জ" }, { name: "Badarganj", name_bn: "বদরগঞ্জ" },
    { name: "Mithapukur", name_bn: "মিঠাপুকুর" }, { name: "Pirgachha", name_bn: "পীরগাছা" },
    { name: "Kaunia", name_bn: "কাউনিয়া" }, { name: "Pirganj", name_bn: "পীরগঞ্জ" },
  ]},
  { name: "Barisal", name_bn: "বরিশাল", thanas: [
    { name: "Barisal Sadar", name_bn: "বরিশাল সদর" }, { name: "Bakerganj", name_bn: "বাকেরগঞ্জ" },
    { name: "Babuganj", name_bn: "বাবুগঞ্জ" }, { name: "Wazirpur", name_bn: "উজিরপুর" },
    { name: "Banaripara", name_bn: "বানারীপাড়া" }, { name: "Gournadi", name_bn: "গৌরনদী" },
    { name: "Agailjhara", name_bn: "আগৈলঝাড়া" }, { name: "Mehendiganj", name_bn: "মেহেন্দিগঞ্জ" },
    { name: "Muladi", name_bn: "মুলাদী" }, { name: "Hizla", name_bn: "হিজলা" },
  ]},
  { name: "Mymensingh", name_bn: "ময়মনসিংহ", thanas: [
    { name: "Mymensingh Sadar", name_bn: "ময়মনসিংহ সদর" }, { name: "Trishal", name_bn: "ত্রিশাল" },
    { name: "Bhaluka", name_bn: "ভালুকা" }, { name: "Muktagachha", name_bn: "মুক্তাগাছা" },
    { name: "Fulbaria", name_bn: "ফুলবাড়িয়া" }, { name: "Gaffargaon", name_bn: "গফরগাঁও" },
    { name: "Gauripur", name_bn: "গৌরীপুর" }, { name: "Ishwarganj", name_bn: "ঈশ্বরগঞ্জ" },
    { name: "Nandail", name_bn: "নান্দাইল" }, { name: "Tarakanda", name_bn: "তারাকান্দা" },
    { name: "Haluaghat", name_bn: "হালুয়াঘাট" }, { name: "Dhobaura", name_bn: "ধোবাউড়া" },
    { name: "Phulpur", name_bn: "ফুলপুর" },
  ]},
  { name: "Comilla", name_bn: "কুমিল্লা", thanas: [
    { name: "Comilla Sadar", name_bn: "কুমিল্লা সদর" }, { name: "Debidwar", name_bn: "দেবিদ্বার" },
    { name: "Barura", name_bn: "বরুড়া" }, { name: "Brahmanpara", name_bn: "ব্রাহ্মণপাড়া" },
    { name: "Chandina", name_bn: "চান্দিনা" }, { name: "Chauddagram", name_bn: "চৌদ্দগ্রাম" },
    { name: "Daudkandi", name_bn: "দাউদকান্দি" }, { name: "Homna", name_bn: "হোমনা" },
    { name: "Laksam", name_bn: "লাকসাম" }, { name: "Muradnagar", name_bn: "মুরাদনগর" },
    { name: "Nangalkot", name_bn: "নাঙ্গলকোট" }, { name: "Meghna", name_bn: "মেঘনা" },
    { name: "Monohorgonj", name_bn: "মনোহরগঞ্জ" }, { name: "Titas", name_bn: "তিতাস" },
    { name: "Burichang", name_bn: "বুড়িচং" }, { name: "Lalmai", name_bn: "লালমাই" },
  ]},
  { name: "Gazipur", name_bn: "গাজীপুর", thanas: [
    { name: "Gazipur Sadar", name_bn: "গাজীপুর সদর" }, { name: "Kaliakair", name_bn: "কালিয়াকৈর" },
    { name: "Kapasia", name_bn: "কাপাসিয়া" }, { name: "Sreepur", name_bn: "শ্রীপুর" },
    { name: "Kaliganj", name_bn: "কালীগঞ্জ" }, { name: "Tongi", name_bn: "টঙ্গী" },
  ]},
  { name: "Narayanganj", name_bn: "নারায়ণগঞ্জ", thanas: [
    { name: "Narayanganj Sadar", name_bn: "নারায়ণগঞ্জ সদর" }, { name: "Araihazar", name_bn: "আড়াইহাজার" },
    { name: "Bandar", name_bn: "বন্দর" }, { name: "Rupganj", name_bn: "রূপগঞ্জ" },
    { name: "Sonargaon", name_bn: "সোনারগাঁও" }, { name: "Siddhirganj", name_bn: "সিদ্ধিরগঞ্জ" },
    { name: "Fatulla", name_bn: "ফতুল্লা" },
  ]},
  { name: "Narsingdi", name_bn: "নরসিংদী", thanas: [
    { name: "Narsingdi Sadar", name_bn: "নরসিংদী সদর" }, { name: "Belabo", name_bn: "বেলাবো" },
    { name: "Monohardi", name_bn: "মনোহরদী" }, { name: "Palash", name_bn: "পলাশ" },
    { name: "Raipura", name_bn: "রায়পুরা" }, { name: "Shibpur", name_bn: "শিবপুর" },
  ]},
  { name: "Tangail", name_bn: "টাঙ্গাইল", thanas: [
    { name: "Tangail Sadar", name_bn: "টাঙ্গাইল সদর" }, { name: "Sakhipur", name_bn: "সখীপুর" },
    { name: "Basail", name_bn: "বাসাইল" }, { name: "Madhupur", name_bn: "মধুপুর" },
    { name: "Ghatail", name_bn: "ঘাটাইল" }, { name: "Kalihati", name_bn: "কালিহাতী" },
    { name: "Nagarpur", name_bn: "নাগরপুর" }, { name: "Mirzapur", name_bn: "মির্জাপুর" },
    { name: "Gopalpur", name_bn: "গোপালপুর" }, { name: "Delduar", name_bn: "দেলদুয়ার" },
    { name: "Bhuapur", name_bn: "ভুয়াপুর" }, { name: "Dhanbari", name_bn: "ধনবাড়ী" },
  ]},
  { name: "Bogura", name_bn: "বগুড়া", thanas: [
    { name: "Bogura Sadar", name_bn: "বগুড়া সদর" }, { name: "Gabtali", name_bn: "গাবতলী" },
    { name: "Sherpur", name_bn: "শেরপুর" }, { name: "Shahjahanpur", name_bn: "শাহজাহানপুর" },
    { name: "Kahaloo", name_bn: "কাহালু" }, { name: "Nandigram", name_bn: "নন্দীগ্রাম" },
    { name: "Adamdighi", name_bn: "আদমদিঘী" }, { name: "Dupchanchia", name_bn: "দুপচাঁচিয়া" },
    { name: "Sariakandi", name_bn: "সারিয়াকান্দি" }, { name: "Sonatala", name_bn: "সোনাতলা" },
    { name: "Dhunot", name_bn: "ধুনট" }, { name: "Shibganj", name_bn: "শিবগঞ্জ" },
  ]},
  { name: "Jessore", name_bn: "যশোর", thanas: [
    { name: "Jessore Sadar", name_bn: "যশোর সদর" }, { name: "Abhaynagar", name_bn: "অভয়নগর" },
    { name: "Bagherpara", name_bn: "বাঘারপাড়া" }, { name: "Chaugachha", name_bn: "চৌগাছা" },
    { name: "Jhikargachha", name_bn: "ঝিকরগাছা" }, { name: "Keshabpur", name_bn: "কেশবপুর" },
    { name: "Manirampur", name_bn: "মণিরামপুর" }, { name: "Sharsha", name_bn: "শার্শা" },
  ]},
  { name: "Dinajpur", name_bn: "দিনাজপুর", thanas: [
    { name: "Dinajpur Sadar", name_bn: "দিনাজপুর সদর" }, { name: "Birampur", name_bn: "বীরামপুর" },
    { name: "Birganj", name_bn: "বীরগঞ্জ" }, { name: "Biral", name_bn: "বিরল" },
    { name: "Bochaganj", name_bn: "বোচাগঞ্জ" }, { name: "Chirirbandar", name_bn: "চিরিরবন্দর" },
    { name: "Fulbari", name_bn: "ফুলবাড়ী" }, { name: "Ghoraghat", name_bn: "ঘোড়াঘাট" },
    { name: "Hakimpur", name_bn: "হাকিমপুর" }, { name: "Kaharole", name_bn: "কাহারোল" },
    { name: "Khansama", name_bn: "খানসামা" }, { name: "Nawabganj", name_bn: "নবাবগঞ্জ" },
    { name: "Parbatipur", name_bn: "পার্বতীপুর" },
  ]},
  { name: "Cox's Bazar", name_bn: "কক্সবাজার", thanas: [
    { name: "Cox's Bazar Sadar", name_bn: "কক্সবাজার সদর" }, { name: "Chakaria", name_bn: "চকরিয়া" },
    { name: "Kutubdia", name_bn: "কুতুবদিয়া" }, { name: "Maheshkhali", name_bn: "মহেশখালী" },
    { name: "Ramu", name_bn: "রামু" }, { name: "Teknaf", name_bn: "টেকনাফ" },
    { name: "Ukhia", name_bn: "উখিয়া" }, { name: "Pekua", name_bn: "পেকুয়া" },
  ]},
  { name: "Faridpur", name_bn: "ফরিদপুর", thanas: [
    { name: "Faridpur Sadar", name_bn: "ফরিদপুর সদর" }, { name: "Alfadanga", name_bn: "আলফাডাঙ্গা" },
    { name: "Bhanga", name_bn: "ভাঙ্গা" }, { name: "Boalmari", name_bn: "বোয়ালমারী" },
    { name: "Charbhadrasan", name_bn: "চরভদ্রাসন" }, { name: "Madhukhali", name_bn: "মধুখালী" },
    { name: "Nagarkanda", name_bn: "নগরকান্দা" }, { name: "Sadarpur", name_bn: "সদরপুর" },
    { name: "Saltha", name_bn: "সালথা" },
  ]},
  { name: "Noakhali", name_bn: "নোয়াখালী", thanas: [
    { name: "Noakhali Sadar", name_bn: "নোয়াখালী সদর" }, { name: "Begumganj", name_bn: "বেগমগঞ্জ" },
    { name: "Chatkhil", name_bn: "চাটখিল" }, { name: "Companiganj", name_bn: "কোম্পানীগঞ্জ" },
    { name: "Hatiya", name_bn: "হাতিয়া" }, { name: "Kabirhat", name_bn: "কবিরহাট" },
    { name: "Senbagh", name_bn: "সেনবাগ" }, { name: "Sonaimuri", name_bn: "সোনাইমুড়ী" },
    { name: "Subarnachar", name_bn: "সুবর্ণচর" },
  ]},
  { name: "Brahmanbaria", name_bn: "ব্রাহ্মণবাড়িয়া", thanas: [
    { name: "Brahmanbaria Sadar", name_bn: "ব্রাহ্মণবাড়িয়া সদর" }, { name: "Akhaura", name_bn: "আখাউড়া" },
    { name: "Ashuganj", name_bn: "আশুগঞ্জ" }, { name: "Bancharampur", name_bn: "বাঞ্ছারামপুর" },
    { name: "Bijoynagar", name_bn: "বিজয়নগর" }, { name: "Kasba", name_bn: "কসবা" },
    { name: "Nabinagar", name_bn: "নবীনগর" }, { name: "Nasirnagar", name_bn: "নাসিরনগর" },
    { name: "Sarail", name_bn: "সরাইল" },
  ]},
  { name: "Pabna", name_bn: "পাবনা", thanas: [
    { name: "Pabna Sadar", name_bn: "পাবনা সদর" }, { name: "Atgharia", name_bn: "আটঘরিয়া" },
    { name: "Bera", name_bn: "বেড়া" }, { name: "Bhangura", name_bn: "ভাঙ্গুড়া" },
    { name: "Chatmohar", name_bn: "চাটমোহর" }, { name: "Faridpur", name_bn: "ফরিদপুর" },
    { name: "Ishwardi", name_bn: "ঈশ্বরদী" }, { name: "Santhia", name_bn: "সাঁথিয়া" },
    { name: "Sujanagar", name_bn: "সুজানগর" },
  ]},
  { name: "Kishoreganj", name_bn: "কিশোরগঞ্জ", thanas: [
    { name: "Kishoreganj Sadar", name_bn: "কিশোরগঞ্জ সদর" }, { name: "Austagram", name_bn: "অষ্টগ্রাম" },
    { name: "Bajitpur", name_bn: "বাজিতপুর" }, { name: "Bhairab", name_bn: "ভৈরব" },
    { name: "Hossainpur", name_bn: "হোসেনপুর" }, { name: "Itna", name_bn: "ইটনা" },
    { name: "Karimganj", name_bn: "করিমগঞ্জ" }, { name: "Katiadi", name_bn: "কটিয়াদী" },
    { name: "Kuliarchar", name_bn: "কুলিয়ারচর" }, { name: "Mithamain", name_bn: "মিঠামইন" },
    { name: "Nikli", name_bn: "নিকলী" }, { name: "Pakundia", name_bn: "পাকুন্দিয়া" },
    { name: "Tarail", name_bn: "তাড়াইল" },
  ]},
  { name: "Habiganj", name_bn: "হবিগঞ্জ", thanas: [
    { name: "Habiganj Sadar", name_bn: "হবিগঞ্জ সদর" }, { name: "Ajmiriganj", name_bn: "আজমিরীগঞ্জ" },
    { name: "Bahubal", name_bn: "বাহুবল" }, { name: "Baniachong", name_bn: "বানিয়াচং" },
    { name: "Chunarughat", name_bn: "চুনারুঘাট" }, { name: "Lakhai", name_bn: "লাখাই" },
    { name: "Madhabpur", name_bn: "মাধবপুর" }, { name: "Nabiganj", name_bn: "নবীগঞ্জ" },
    { name: "Sayestaganj", name_bn: "শায়েস্তাগঞ্জ" },
  ]},
  { name: "Chandpur", name_bn: "চাঁদপুর", thanas: [
    { name: "Chandpur Sadar", name_bn: "চাঁদপুর সদর" }, { name: "Faridganj", name_bn: "ফরিদগঞ্জ" },
    { name: "Haimchar", name_bn: "হাইমচর" }, { name: "Haziganj", name_bn: "হাজীগঞ্জ" },
    { name: "Kachua", name_bn: "কচুয়া" }, { name: "Matlab Dakshin", name_bn: "মতলব দক্ষিণ" },
    { name: "Matlab Uttar", name_bn: "মতলব উত্তর" }, { name: "Shahrasti", name_bn: "শাহরাস্তি" },
  ]},
  { name: "Feni", name_bn: "ফেনী", thanas: [
    { name: "Feni Sadar", name_bn: "ফেনী সদর" }, { name: "Chhagalnaiya", name_bn: "ছাগলনাইয়া" },
    { name: "Daganbhuiyan", name_bn: "দাগনভূঁইয়া" }, { name: "Fulgazi", name_bn: "ফুলগাজী" },
    { name: "Parshuram", name_bn: "পরশুরাম" }, { name: "Sonagazi", name_bn: "সোনাগাজী" },
  ]},
  { name: "Lakshmipur", name_bn: "লক্ষ্মীপুর", thanas: [
    { name: "Lakshmipur Sadar", name_bn: "লক্ষ্মীপুর সদর" }, { name: "Kamalnagar", name_bn: "কমলনগর" },
    { name: "Raipur", name_bn: "রায়পুর" }, { name: "Ramganj", name_bn: "রামগঞ্জ" },
    { name: "Ramgati", name_bn: "রামগতি" },
  ]},
  { name: "Manikganj", name_bn: "মানিকগঞ্জ", thanas: [
    { name: "Manikganj Sadar", name_bn: "মানিকগঞ্জ সদর" }, { name: "Daulatpur", name_bn: "দৌলতপুর" },
    { name: "Ghior", name_bn: "ঘিওর" }, { name: "Harirampur", name_bn: "হরিরামপুর" },
    { name: "Saturia", name_bn: "সাটুরিয়া" }, { name: "Shivalaya", name_bn: "শিবালয়" },
    { name: "Singair", name_bn: "সিংগাইর" },
  ]},
  { name: "Munshiganj", name_bn: "মুন্সীগঞ্জ", thanas: [
    { name: "Munshiganj Sadar", name_bn: "মুন্সীগঞ্জ সদর" }, { name: "Gazaria", name_bn: "গজারিয়া" },
    { name: "Lohajang", name_bn: "লৌহজং" }, { name: "Sirajdikhan", name_bn: "সিরাজদিখান" },
    { name: "Sreenagar", name_bn: "শ্রীনগর" }, { name: "Tongibari", name_bn: "টঙ্গীবাড়ী" },
  ]},
  { name: "Madaripur", name_bn: "মাদারীপুর", thanas: [
    { name: "Madaripur Sadar", name_bn: "মাদারীপুর সদর" }, { name: "Kalkini", name_bn: "কালকিনি" },
    { name: "Rajoir", name_bn: "রাজৈর" }, { name: "Shibchar", name_bn: "শিবচর" },
  ]},
  { name: "Gopalganj", name_bn: "গোপালগঞ্জ", thanas: [
    { name: "Gopalganj Sadar", name_bn: "গোপালগঞ্জ সদর" }, { name: "Kashiani", name_bn: "কাশিয়ানী" },
    { name: "Kotalipara", name_bn: "কোটালীপাড়া" }, { name: "Muksudpur", name_bn: "মুকসুদপুর" },
    { name: "Tungipara", name_bn: "টুঙ্গিপাড়া" },
  ]},
  { name: "Shariatpur", name_bn: "শরীয়তপুর", thanas: [
    { name: "Shariatpur Sadar", name_bn: "শরীয়তপুর সদর" }, { name: "Bhedarganj", name_bn: "ভেদরগঞ্জ" },
    { name: "Damudya", name_bn: "ডামুড্যা" }, { name: "Gosairhat", name_bn: "গোসাইরহাট" },
    { name: "Naria", name_bn: "নড়িয়া" }, { name: "Zajira", name_bn: "জাজিরা" },
  ]},
  { name: "Satkhira", name_bn: "সাতক্ষীরা", thanas: [
    { name: "Satkhira Sadar", name_bn: "সাতক্ষীরা সদর" }, { name: "Assasuni", name_bn: "আশাশুনি" },
    { name: "Debhata", name_bn: "দেবহাটা" }, { name: "Kalaroa", name_bn: "কলারোয়া" },
    { name: "Kaliganj", name_bn: "কালীগঞ্জ" }, { name: "Shyamnagar", name_bn: "শ্যামনগর" },
    { name: "Tala", name_bn: "তালা" },
  ]},
  { name: "Bagerhat", name_bn: "বাগেরহাট", thanas: [
    { name: "Bagerhat Sadar", name_bn: "বাগেরহাট সদর" }, { name: "Chitalmari", name_bn: "চিতলমারী" },
    { name: "Fakirhat", name_bn: "ফকিরহাট" }, { name: "Kachua", name_bn: "কচুয়া" },
    { name: "Mollahat", name_bn: "মোল্লাহাট" }, { name: "Mongla", name_bn: "মোংলা" },
    { name: "Morrelganj", name_bn: "মোড়েলগঞ্জ" }, { name: "Rampal", name_bn: "রামপাল" },
    { name: "Sarankhola", name_bn: "শরণখোলা" },
  ]},
  { name: "Kushtia", name_bn: "কুষ্টিয়া", thanas: [
    { name: "Kushtia Sadar", name_bn: "কুষ্টিয়া সদর" }, { name: "Bheramara", name_bn: "ভেড়ামারা" },
    { name: "Daulatpur", name_bn: "দৌলতপুর" }, { name: "Khoksa", name_bn: "খোকসা" },
    { name: "Kumarkhali", name_bn: "কুমারখালী" }, { name: "Mirpur", name_bn: "মিরপুর" },
  ]},
  { name: "Natore", name_bn: "নাটোর", thanas: [
    { name: "Natore Sadar", name_bn: "নাটোর সদর" }, { name: "Bagatipara", name_bn: "বাগাতিপাড়া" },
    { name: "Baraigram", name_bn: "বড়াইগ্রাম" }, { name: "Gurudaspur", name_bn: "গুরুদাসপুর" },
    { name: "Lalpur", name_bn: "লালপুর" }, { name: "Singra", name_bn: "সিংড়া" },
    { name: "Naldanga", name_bn: "নলডাঙ্গা" },
  ]},
  { name: "Naogaon", name_bn: "নওগাঁ", thanas: [
    { name: "Naogaon Sadar", name_bn: "নওগাঁ সদর" }, { name: "Atrai", name_bn: "আত্রাই" },
    { name: "Badalgachhi", name_bn: "বদলগাছী" }, { name: "Dhamoirhat", name_bn: "ধামইরহাট" },
    { name: "Manda", name_bn: "মান্দা" }, { name: "Mohadevpur", name_bn: "মহাদেবপুর" },
    { name: "Niamatpur", name_bn: "নিয়ামতপুর" }, { name: "Patnitala", name_bn: "পত্নীতলা" },
    { name: "Porsha", name_bn: "পোরশা" }, { name: "Raninagar", name_bn: "রাণীনগর" },
    { name: "Sapahar", name_bn: "সাপাহার" },
  ]},
  { name: "Sirajganj", name_bn: "সিরাজগঞ্জ", thanas: [
    { name: "Sirajganj Sadar", name_bn: "সিরাজগঞ্জ সদর" }, { name: "Belkuchi", name_bn: "বেলকুচি" },
    { name: "Chauhali", name_bn: "চৌহালি" }, { name: "Kamarkhanda", name_bn: "কামারখন্দ" },
    { name: "Kazipur", name_bn: "কাজীপুর" }, { name: "Raiganj", name_bn: "রায়গঞ্জ" },
    { name: "Shahzadpur", name_bn: "শাহজাদপুর" }, { name: "Tarash", name_bn: "তাড়াশ" },
    { name: "Ullahpara", name_bn: "উল্লাপাড়া" },
  ]},
  { name: "Joypurhat", name_bn: "জয়পুরহাট", thanas: [
    { name: "Joypurhat Sadar", name_bn: "জয়পুরহাট সদর" }, { name: "Akkelpur", name_bn: "আক্কেলপুর" },
    { name: "Kalai", name_bn: "কালাই" }, { name: "Khetlal", name_bn: "ক্ষেতলাল" },
    { name: "Panchbibi", name_bn: "পাঁচবিবি" },
  ]},
  { name: "Chapainawabganj", name_bn: "চাঁপাইনবাবগঞ্জ", thanas: [
    { name: "Chapainawabganj Sadar", name_bn: "চাঁপাইনবাবগঞ্জ সদর" }, { name: "Bholahat", name_bn: "ভোলাহাট" },
    { name: "Gomastapur", name_bn: "গোমস্তাপুর" }, { name: "Nachole", name_bn: "নাচোল" },
    { name: "Shibganj", name_bn: "শিবগঞ্জ" },
  ]},
  { name: "Nawabganj", name_bn: "নবাবগঞ্জ", thanas: [
    { name: "Nawabganj Sadar", name_bn: "নবাবগঞ্জ সদর" }, { name: "Bholahat", name_bn: "ভোলাহাট" },
    { name: "Gomastapur", name_bn: "গোমস্তাপুর" }, { name: "Nachole", name_bn: "নাচোল" },
    { name: "Shibganj", name_bn: "শিবগঞ্জ" },
  ]},
  { name: "Nilphamari", name_bn: "নীলফামারী", thanas: [
    { name: "Nilphamari Sadar", name_bn: "নীলফামারী সদর" }, { name: "Dimla", name_bn: "ডিমলা" },
    { name: "Domar", name_bn: "ডোমার" }, { name: "Jaldhaka", name_bn: "জলঢাকা" },
    { name: "Kishoreganj", name_bn: "কিশোরগঞ্জ" }, { name: "Saidpur", name_bn: "সৈয়দপুর" },
  ]},
  { name: "Kurigram", name_bn: "কুড়িগ্রাম", thanas: [
    { name: "Kurigram Sadar", name_bn: "কুড়িগ্রাম সদর" }, { name: "Bhurungamari", name_bn: "ভুরুঙ্গামারী" },
    { name: "Char Rajibpur", name_bn: "চর রাজিবপুর" }, { name: "Chilmari", name_bn: "চিলমারী" },
    { name: "Fulbari", name_bn: "ফুলবাড়ী" }, { name: "Nageshwari", name_bn: "নাগেশ্বরী" },
    { name: "Phulbari", name_bn: "ফুলবাড়ী" }, { name: "Rajarhat", name_bn: "রাজারহাট" },
    { name: "Ulipur", name_bn: "উলিপুর" },
  ]},
  { name: "Gaibandha", name_bn: "গাইবান্ধা", thanas: [
    { name: "Gaibandha Sadar", name_bn: "গাইবান্ধা সদর" }, { name: "Fulchhari", name_bn: "ফুলছড়ি" },
    { name: "Gobindaganj", name_bn: "গোবিন্দগঞ্জ" }, { name: "Palashbari", name_bn: "পলাশবাড়ী" },
    { name: "Sadullapur", name_bn: "সাদুল্লাপুর" }, { name: "Saghata", name_bn: "সাঘাটা" },
    { name: "Sundarganj", name_bn: "সুন্দরগঞ্জ" },
  ]},
  { name: "Lalmonirhat", name_bn: "লালমনিরহাট", thanas: [
    { name: "Lalmonirhat Sadar", name_bn: "লালমনিরহাট সদর" }, { name: "Aditmari", name_bn: "আদিতমারী" },
    { name: "Hatibandha", name_bn: "হাতীবান্ধা" }, { name: "Kaliganj", name_bn: "কালীগঞ্জ" },
    { name: "Patgram", name_bn: "পাটগ্রাম" },
  ]},
  { name: "Thakurgaon", name_bn: "ঠাকুরগাঁও", thanas: [
    { name: "Thakurgaon Sadar", name_bn: "ঠাকুরগাঁও সদর" }, { name: "Baliadangi", name_bn: "বালিয়াডাঙ্গী" },
    { name: "Haripur", name_bn: "হরিপুর" }, { name: "Pirganj", name_bn: "পীরগঞ্জ" },
    { name: "Ranisankail", name_bn: "রাণীশংকৈল" },
  ]},
  { name: "Panchagarh", name_bn: "পঞ্চগড়", thanas: [
    { name: "Panchagarh Sadar", name_bn: "পঞ্চগড় সদর" }, { name: "Atwari", name_bn: "আটোয়ারী" },
    { name: "Boda", name_bn: "বোদা" }, { name: "Debiganj", name_bn: "দেবীগঞ্জ" },
    { name: "Tetulia", name_bn: "তেতুলিয়া" },
  ]},
  { name: "Pirojpur", name_bn: "পিরোজপুর", thanas: [
    { name: "Pirojpur Sadar", name_bn: "পিরোজপুর সদর" }, { name: "Bhandaria", name_bn: "ভান্ডারিয়া" },
    { name: "Kawkhali", name_bn: "কাউখালী" }, { name: "Mathbaria", name_bn: "মঠবাড়িয়া" },
    { name: "Nazirpur", name_bn: "নাজিরপুর" }, { name: "Nesarabad", name_bn: "নেছারাবাদ" },
    { name: "Zianagar", name_bn: "জিয়ানগর" },
  ]},
  { name: "Jhalokathi", name_bn: "ঝালকাঠি", thanas: [
    { name: "Jhalokathi Sadar", name_bn: "ঝালকাঠি সদর" }, { name: "Kathalia", name_bn: "কাঠালিয়া" },
    { name: "Nalchity", name_bn: "নলছিটি" }, { name: "Rajapur", name_bn: "রাজাপুর" },
  ]},
  { name: "Bhola", name_bn: "ভোলা", thanas: [
    { name: "Bhola Sadar", name_bn: "ভোলা সদর" }, { name: "Borhanuddin", name_bn: "বোরহানউদ্দিন" },
    { name: "Char Fasson", name_bn: "চরফ্যাশন" }, { name: "Daulatkhan", name_bn: "দৌলতখান" },
    { name: "Lalmohan", name_bn: "লালমোহন" }, { name: "Manpura", name_bn: "মনপুরা" },
    { name: "Tazumuddin", name_bn: "তজুমুদ্দিন" },
  ]},
  { name: "Patuakhali", name_bn: "পটুয়াখালী", thanas: [
    { name: "Patuakhali Sadar", name_bn: "পটুয়াখালী সদর" }, { name: "Bauphal", name_bn: "বাউফল" },
    { name: "Dashmina", name_bn: "দশমিনা" }, { name: "Dumki", name_bn: "দুমকি" },
    { name: "Galachipa", name_bn: "গলাচিপা" }, { name: "Kalapara", name_bn: "কলাপাড়া" },
    { name: "Mirzaganj", name_bn: "মির্জাগঞ্জ" }, { name: "Rangabali", name_bn: "রাঙ্গাবালী" },
  ]},
  { name: "Barguna", name_bn: "বরগুনা", thanas: [
    { name: "Barguna Sadar", name_bn: "বরগুনা সদর" }, { name: "Amtali", name_bn: "আমতলী" },
    { name: "Bamna", name_bn: "বামনা" }, { name: "Betagi", name_bn: "বেতাগী" },
    { name: "Patharghata", name_bn: "পাথরঘাটা" }, { name: "Taltali", name_bn: "তালতলী" },
  ]},
  { name: "Moulvibazar", name_bn: "মৌলভীবাজার", thanas: [
    { name: "Moulvibazar Sadar", name_bn: "মৌলভীবাজার সদর" }, { name: "Barlekha", name_bn: "বড়লেখা" },
    { name: "Juri", name_bn: "জুড়ী" }, { name: "Kamalganj", name_bn: "কমলগঞ্জ" },
    { name: "Kulaura", name_bn: "কুলাউড়া" }, { name: "Rajnagar", name_bn: "রাজনগর" },
    { name: "Sreemangal", name_bn: "শ্রীমঙ্গল" },
  ]},
  { name: "Sunamganj", name_bn: "সুনামগঞ্জ", thanas: [
    { name: "Sunamganj Sadar", name_bn: "সুনামগঞ্জ সদর" }, { name: "Bishwamvarpur", name_bn: "বিশ্বম্ভরপুর" },
    { name: "Chhatak", name_bn: "ছাতক" }, { name: "Derai", name_bn: "দিরাই" },
    { name: "Dharampasha", name_bn: "ধর্মপাশা" }, { name: "Dowarabazar", name_bn: "দোয়ারাবাজার" },
    { name: "Jagannathpur", name_bn: "জগন্নাথপুর" }, { name: "Jamalganj", name_bn: "জামালগঞ্জ" },
    { name: "Sulla", name_bn: "শাল্লা" }, { name: "Tahirpur", name_bn: "তাহিরপুর" },
  ]},
  { name: "Netrokona", name_bn: "নেত্রকোণা", thanas: [
    { name: "Netrokona Sadar", name_bn: "নেত্রকোণা সদর" }, { name: "Atpara", name_bn: "আটপাড়া" },
    { name: "Barhatta", name_bn: "বারহাট্টা" }, { name: "Durgapur", name_bn: "দুর্গাপুর" },
    { name: "Kalmakanda", name_bn: "কলমাকান্দা" }, { name: "Kendua", name_bn: "কেন্দুয়া" },
    { name: "Khaliajuri", name_bn: "খালিয়াজুড়ী" }, { name: "Madan", name_bn: "মদন" },
    { name: "Mohanganj", name_bn: "মোহনগঞ্জ" }, { name: "Purbadhala", name_bn: "পূর্বধলা" },
  ]},
  { name: "Jamalpur", name_bn: "জামালপুর", thanas: [
    { name: "Jamalpur Sadar", name_bn: "জামালপুর সদর" }, { name: "Baksiganj", name_bn: "বকশীগঞ্জ" },
    { name: "Dewanganj", name_bn: "দেওয়ানগঞ্জ" }, { name: "Islampur", name_bn: "ইসলামপুর" },
    { name: "Madarganj", name_bn: "মাদারগঞ্জ" }, { name: "Melandaha", name_bn: "মেলান্দহ" },
    { name: "Sarishabari", name_bn: "সরিষাবাড়ী" },
  ]},
  { name: "Sherpur", name_bn: "শেরপুর", thanas: [
    { name: "Sherpur Sadar", name_bn: "শেরপুর সদর" }, { name: "Jhenaigati", name_bn: "ঝিনাইগাতী" },
    { name: "Nakla", name_bn: "নকলা" }, { name: "Nalitabari", name_bn: "নালিতাবাড়ী" },
    { name: "Sreebardi", name_bn: "শ্রীবর্দী" },
  ]},
  { name: "Rangamati", name_bn: "রাঙ্গামাটি", thanas: [
    { name: "Rangamati Sadar", name_bn: "রাঙ্গামাটি সদর" }, { name: "Bagaichhari", name_bn: "বাঘাইছড়ি" },
    { name: "Barkal", name_bn: "বরকল" }, { name: "Belaichhari", name_bn: "বিলাইছড়ি" },
    { name: "Juraichhari", name_bn: "জুরাছড়ি" }, { name: "Kaptai", name_bn: "কাপ্তাই" },
    { name: "Kawkhali", name_bn: "কাউখালী" }, { name: "Langadu", name_bn: "লংগদু" },
    { name: "Naniarchar", name_bn: "নানিয়ারচর" }, { name: "Rajasthali", name_bn: "রাজস্থলী" },
  ]},
  { name: "Khagrachhari", name_bn: "খাগড়াছড়ি", thanas: [
    { name: "Khagrachhari Sadar", name_bn: "খাগড়াছড়ি সদর" }, { name: "Dighinala", name_bn: "দিঘীনালা" },
    { name: "Lakshmichhari", name_bn: "লক্ষ্মীছড়ি" }, { name: "Mahalchhari", name_bn: "মহালছড়ি" },
    { name: "Manikchhari", name_bn: "মানিকছড়ি" }, { name: "Matiranga", name_bn: "মাটিরাঙ্গা" },
    { name: "Panchhari", name_bn: "পানছড়ি" }, { name: "Ramgarh", name_bn: "রামগড়" },
  ]},
  { name: "Bandarban", name_bn: "বান্দরবান", thanas: [
    { name: "Bandarban Sadar", name_bn: "বান্দরবান সদর" }, { name: "Alikadam", name_bn: "আলীকদম" },
    { name: "Lama", name_bn: "লামা" }, { name: "Naikhongchhari", name_bn: "নাইক্ষ্যংছড়ি" },
    { name: "Rowangchhari", name_bn: "রোয়াংছড়ি" }, { name: "Ruma", name_bn: "রুমা" },
    { name: "Thanchi", name_bn: "থানচি" },
  ]},
  { name: "Chuadanga", name_bn: "চুয়াডাঙ্গা", thanas: [
    { name: "Chuadanga Sadar", name_bn: "চুয়াডাঙ্গা সদর" }, { name: "Alamdanga", name_bn: "আলমডাঙ্গা" },
    { name: "Damurhuda", name_bn: "দামুড়হুদা" }, { name: "Jibannagar", name_bn: "জীবননগর" },
  ]},
  { name: "Jhenaidah", name_bn: "ঝিনাইদহ", thanas: [
    { name: "Jhenaidah Sadar", name_bn: "ঝিনাইদহ সদর" }, { name: "Harinakunda", name_bn: "হরিণাকুন্ডু" },
    { name: "Kaliganj", name_bn: "কালীগঞ্জ" }, { name: "Kotchandpur", name_bn: "কোটচাঁদপুর" },
    { name: "Maheshpur", name_bn: "মহেশপুর" }, { name: "Shailkupa", name_bn: "শৈলকুপা" },
  ]},
  { name: "Magura", name_bn: "মাগুরা", thanas: [
    { name: "Magura Sadar", name_bn: "মাগুরা সদর" }, { name: "Mohammadpur", name_bn: "মোহাম্মদপুর" },
    { name: "Shalikha", name_bn: "শালিখা" }, { name: "Sreepur", name_bn: "শ্রীপুর" },
  ]},
  { name: "Narail", name_bn: "নড়াইল", thanas: [
    { name: "Narail Sadar", name_bn: "নড়াইল সদর" }, { name: "Kalia", name_bn: "কালিয়া" },
    { name: "Lohagara", name_bn: "লোহাগড়া" },
  ]},
  { name: "Meherpur", name_bn: "মেহেরপুর", thanas: [
    { name: "Meherpur Sadar", name_bn: "মেহেরপুর সদর" }, { name: "Gangni", name_bn: "গাংনী" },
    { name: "Mujibnagar", name_bn: "মুজিবনগর" },
  ]},
  { name: "Rajbari", name_bn: "রাজবাড়ী", thanas: [
    { name: "Rajbari Sadar", name_bn: "রাজবাড়ী সদর" }, { name: "Baliakandi", name_bn: "বালিয়াকান্দি" },
    { name: "Goalandaghat", name_bn: "গোয়ালন্দঘাট" }, { name: "Pangsha", name_bn: "পাংশা" },
    { name: "Kalukhali", name_bn: "কালুখালী" },
  ]},
  { name: "Sunamgonj", name_bn: "সুনামগঞ্জ", thanas: [
    { name: "Sunamgonj Sadar", name_bn: "সুনামগঞ্জ সদর" },
  ]},
];

// Helper: try to auto-detect district/thana from address text
export function detectLocation(address: string): { district: string; thana: string } {
  if (!address) return { district: "", thana: "" };
  const lower = address.toLowerCase();
  
  for (const dist of BD_DISTRICTS) {
    const distMatch = lower.includes(dist.name.toLowerCase()) || address.includes(dist.name_bn);
    if (distMatch) {
      // Try to find thana
      for (const th of dist.thanas) {
        if (lower.includes(th.name.toLowerCase()) || address.includes(th.name_bn)) {
          return { district: dist.name, thana: th.name };
        }
      }
      return { district: dist.name, thana: "" };
    }
  }
  
  // Try thana-first search
  for (const dist of BD_DISTRICTS) {
    for (const th of dist.thanas) {
      if (lower.includes(th.name.toLowerCase()) || address.includes(th.name_bn)) {
        return { district: dist.name, thana: th.name };
      }
    }
  }
  
  return { district: "", thana: "" };
}
