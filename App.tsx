
import React, { useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Linking,
  Image,
  Platform,
  Modal,
} from 'react-native';

import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

type Product = {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  image_urls: string[];
  stock: number;
  category: string;
  description?: string;
};

type CartItem = Product & {
  quantity: number;
};

type Shop = {
  id: string;
  shop_name: string;
  description: string | null;
  active: boolean;
};

type Category = {
  id: string;
  name: string;
};

const categories = [
  'Dhammaan',
  'Buskut',
  'Xalwo',
  'Keeg',
  'Shukulaato',
  'Macmacaan kale',
];


const SWEET_TERM_TRANSLATIONS: Record<string, string[]> = {
  en: ['Biscuit','Halwa','Cake','Chocolate','Other sweets','All'],
  so: ['Buskut','Xalwo','Keeg','Shukulaato','Macmacaan kale','Dhammaan'],
  ar: ['بسكويت','حلاوة','كعكة','شوكولاتة','حلويات أخرى','الكل'],
  sw: ['Biskuti','Halwa','Keki','Chokoleti','Vitamu vingine','Zote'],
  fr: ['Biscuit','Halva','Gâteau','Chocolat','Autres douceurs','Tout'],
  es: ['Galleta','Halva','Pastel','Chocolate','Otros dulces','Todos'],
  zh: ['饼干','哈尔瓦','蛋糕','巧克力','其他甜点','全部'],
  hi: ['बिस्कुट','हलवा','केक','चॉकलेट','अन्य मिठाइयाँ','सभी'],
  pt: ['Biscoito','Halva','Bolo','Chocolate','Outros doces','Todos'],
  de: ['Keks','Halwa','Kuchen','Schokolade','Andere Süßigkeiten','Alle'],
  tr: ['Bisküvi','Helva','Kek','Çikolata','Diğer tatlılar','Tümü'],
  ru: ['Печенье','Халва','Торт','Шоколад','Другие сладости','Все'],
  ja: ['ビスケット','ハルヴァ','ケーキ','チョコレート','その他のお菓子','すべて'],
  ko: ['비스킷','할와','케이크','초콜릿','기타 디저트','전체'],
  it: ['Biscotto','Halva','Torta','Cioccolato','Altri dolci','Tutti'],
  nl: ['Koekje','Halva','Taart','Chocolade','Andere zoetigheden','Alles'],
  bn: ['বিস্কুট','হালুয়া','কেক','চকোলেট','অন্যান্য মিষ্টি','সব'],
  id: ['Biskuit','Halwa','Kue','Cokelat','Manisan lainnya','Semua'],
  ur: ['بسکٹ','حلوہ','کیک','چاکلیٹ','دیگر مٹھائیاں','سب'],
  am: ['ብስኩት','ሃልዋ','ኬክ','ቸኮሌት','ሌሎች ጣፋጮች','ሁሉም'],
  ha: ['Biskit','Halwa','Kek','Cakulan','Sauran kayan zaki','Duka'],
  yo: ['Bisikiti','Halwa','Keeki','Chokoleeti','Àwọn adùn míì','Gbogbo'],
  th: ['บิสกิต','ฮาลวา','เค้ก','ช็อกโกแลต','ขนมหวานอื่น ๆ','ทั้งหมด'],
  vi: ['Bánh quy','Halva','Bánh kem','Sô cô la','Món ngọt khác','Tất cả'],
  pl: ['Herbatniki','Chałwa','Ciasto','Czekolada','Inne słodycze','Wszystkie'],
  uk: ['Печиво','Халва','Торт','Шоколад','Інші солодощі','Усі'],
  fa: ['بیسکویت','حلوا','کیک','شکلات','شیرینی‌های دیگر','همه'],
  ms: ['Biskut','Halwa','Kek','Coklat','Manisan lain','Semua'],
  el: ['Μπισκότο','Χαλβάς','Κέικ','Σοκολάτα','Άλλα γλυκά','Όλα'],
  sv: ['Kex','Halva','Tårta','Choklad','Andra sötsaker','Alla'],
};

const translateSweetName = (value: string, language: string) => {
  if (!value) return value;
  const normalizedLanguage = String(language || 'en').trim().toLowerCase();
  const terms = SWEET_TERM_TRANSLATIONS[normalizedLanguage] || SWEET_TERM_TRANSLATIONS.en;
  const normalizedValue = value.normalize('NFKC').trim().toLocaleLowerCase();

  // Match a known category regardless of the language in which it was saved
  // (for example, a Somali category saved in Supabase must display in English).
  for (const sourceTerms of Object.values(SWEET_TERM_TRANSLATIONS)) {
    const matchedIndex = sourceTerms.findIndex(term =>
      term.normalize('NFKC').trim().toLocaleLowerCase() === normalizedValue
    );
    if (matchedIndex >= 0) return terms[matchedIndex];
  }

  if (normalizedLanguage === 'so') return value;
  const replacements: [RegExp, number][] = [
    [/macmacaan(?:o)?\s+kale/gi, 4],
    [/other\s+sweets/gi, 4],
    [/shukulaato/gi, 3],
    [/chocolate/gi, 3],
    [/buskut/gi, 0],
    [/biscuit/gi, 0],
    [/xalwo/gi, 1],
    [/halwa/gi, 1],
    [/keeg/gi, 2],
    [/cake/gi, 2],
    [/dhammaan/gi, 5],
    [/all/gi, 5],
  ];
  let translated = value;
  replacements.forEach(([pattern, targetIndex]) => {
    translated = translated.replace(pattern, terms[targetIndex]);
  });
  return translated;
};

const money = (amount: number) =>
  `KSh ${Number(amount || 0).toLocaleString('en-KE')}`;

const orderStatusLabel = (status: unknown, paymentStatus: unknown, language = 'en') => {
  const payment = String(paymentStatus || '').toLowerCase();
  const state = String(status || '').toLowerCase();
  const labels: Record<string, Record<string, string>> = {
    so: { unpaid: 'Lacagta lama xaqiijin', preparing: 'Dalabka waa la helay — waa la diyaarinayaa', shipped: 'Dalabka waa la diray', delivered: 'Dalabka waa la gaarsiiyey', cancelled: 'Dalabka waa la joojiyey', unknown: 'Xaalad lama hayo' },
    ar: { unpaid: 'لم يتم تأكيد الدفع', preparing: 'تم استلام الطلب — جارٍ التجهيز', shipped: 'تم شحن الطلب', delivered: 'تم تسليم الطلب', cancelled: 'تم إلغاء الطلب', unknown: 'الحالة غير متاحة' },
    sw: { unpaid: 'Malipo hayajathibitishwa', preparing: 'Agizo limepokelewa — linaandaliwa', shipped: 'Agizo limetumwa', delivered: 'Agizo limewasilishwa', cancelled: 'Agizo limeghairiwa', unknown: 'Hali haipatikani' },
  };
  const translated = labels[language];
  if (payment !== 'paid') return translated?.unpaid || 'Payment not verified';
  if (state === 'processing' || state === 'pending') return translated?.preparing || 'Order received — preparing';
  if (state === 'shipped' || state === 'in_transit' || state === 'in transit') return translated?.shipped || 'Order shipped';
  if (state === 'delivered' || state === 'completed') return translated?.delivered || 'Order delivered';
  if (state === 'cancelled' || state === 'canceled') return translated?.cancelled || 'Order cancelled';
  return state ? `Order status: ${state}` : (translated?.unknown || 'No status available');
};

const IMSIYA_LANGUAGES = [["en","🇬🇧","English"],["so","🇸🇴","Somali"],["ar","🇸🇦","العربية"],["sw","🇰🇪","Kiswahili"]] as const;


// Core IMSIYA interface translations. Keys are kept in English so product data is not altered.
const SHOP_WALLET_TRANSLATIONS: Record<string, Record<string, string>> = {
  so: {"My Wallet":"Boorsadayda","YOUR SALES BALANCE":"HADHAAGA IIBKAAGA","You keep 100% of your verified sales.":"Waxaad haysanaysaa 100% iibkaaga la xaqiijiyey.","Refresh wallet":"Cusboonaysii boorsada","Activity":"Dhaqdhaqaaq","Transaction history":"Taariikhda macaamillada","No activity yet":"Weli wax dhaqdhaqaaq ah ma jiro","Verified sales will appear here.":"Iibka la xaqiijiyey halkan ayuu ka muuqan doonaa.","Request a payout":"Codso lacag-bixin","Amount (KSh)":"Qaddarka (KSh)","Payout method":"Habka lacag-bixinta","PayPal email":"Iimaylka PayPal","Submit request":"Gudbi codsiga","My Requests":"Codsiyadayda","Awaiting review":"Dib-u-eegis sugaya","My Shop":"Dukaankayga","Manage your shop and the products you sell.":"Maamul dukaankaaga iyo alaabta aad iibiso.","Shop Details":"Faahfaahinta dukaanka","Shop Name":"Magaca dukaanka","Shop Description":"Sharaxaadda dukaanka","Save Shop Details":"Kaydi faahfaahinta dukaanka","Shop subscription":"Is-diiwaangelinta dukaanka","Shop Orders":"Dalabyada dukaanka","My Products":"Alaabtayda","No products yet":"Weli alaab ma jirto","Add Product":"Ku dar alaab","Product Name":"Magaca alaabta","Price (KSh)":"Qiimaha (KSh)","Stock Quantity":"Tirada kaydka","Product Image":"Sawirka alaabta","Product Category":"Qaybta alaabta","Refresh Products":"Cusboonaysii alaabta","Add a New Product":"Ku dar alaab cusub","Edit Product":"Wax ka beddel alaabta","Details":"Faahfaahin","Stock:":"Kaydka:","Out of stock":"Waa dhammaaday","Confirm payment":"Xaqiiji lacag-bixinta","Continue to PayPal":"U gudub PayPal","Cancel":"Jooji","Last updated:":"Markii ugu dambaysay:","Sale":"Iib","Transaction":"Macaamil","Sales payment":"Lacagta iibka","No payout requests yet":"Weli ma jiraan codsiyo lacag-qaadasho","Paid":"La bixiyey","Rejected":"La diiday","Processing":"Waa la farsamaynayaa","My Shop Orders":"Dalabyada dukaankayga","Refresh orders":"Cusboonaysii dalabyada","No shop product orders yet.":"Weli ma jiraan dalabyo alaab dukaan.","Quantity:":"Tirada:","Price:":"Qiimaha:","Order total:":"Wadarta dalabka:","Payment:":"Lacag-bixin:","Method:":"Habka:","You have no orders yet.":"Weli wax dalab ah ma lihid.","Forgot Password?":"Ma illowday furaha sirta?","Sign Up":"Isdiiwaangeli","Sign Out":"Ka bax","You have not added any favorites yet.":"Weli wax aad jeceshahay kuma darin.","Product not found.":"Alaabta lama helin.","Your Cart":"Dambiishayda","Not enough stock available.":"Kayd ku filan ma jiro.","Payment Method":"Habka lacag-bixinta","Secure Payment":"Lacag-bixin ammaan ah","Your payment is secure and encrypted.":"Lacag-bixintaadu waa ammaan oo waa la sirgeliyaa.","Clear cart":"Faaruqi gaariga","Seller Applications":"Codsiyada iibiyeyaasha","Awaiting approval:":"Ansixin sugaya:","There are no applications awaiting approval.":"Ma jiraan codsiyo ansixin sugaya.","Approve this seller":"Ansixi iibiyahan","Admin Overview":"Guudmarka maamulka","Customer Orders":"Dalabyada macaamiisha","No orders yet.":"Weli dalabyo ma jiraan","Start preparing":"Bilow diyaarinta","Ship order":"Dir dalabka","Confirm delivery":"Xaqiiji gaarsiinta","Shop Subscriptions ($20/month)":"Rukhsadaha dukaanka ($20/bishii)","No subscriptions have been recorded yet.":"Weli rukhsado lama diiwaangelin.","Seller Payout Requests":"Codsiyada lacag-qaadashada iibiyaha","Reject request":"Diid codsiga","Seller Wallet Activity":"Dhaqdhaqaaqa boorsada iibiyaha","No wallet activity yet.":"Weli dhaqdhaqaaq boorso ma jiro.","SHOP STATUS":"XAALADDA DUKAANKA","Pay $20 monthly — PayPal":"Ku bixi $20 bishii — PayPal","View Sales Orders":"Eeg dalabyada iibka","Add your first product so customers can discover it.":"Ku dar alaabtaada koowaad si macaamiishu u arkaan.","Sweet Name":"Magaca macmacaanka","Could not load products.":"Alaabta lama soo rari karin.","Could not load applications.":"Codsiyada lama soo rari karin.","Seller approved. The shop will open after the $20 subscription is verified.":"Iibiyaha waa la ansixiyey. Dukaanku wuu furmi doonaa marka la xaqiijiyo rukhsadda $20.","Approval failed.":"Ansixintu way fashilantay.","Only an administrator can change the order status.":"Kaliya maamule ayaa beddeli kara xaaladda dalabka.","Order not found or you are not allowed to change its status.":"Dalabka lama helin ama xaq uma lihid inaad xaaladdiisa beddesho.","Order status updated.":"Xaaladda dalabka waa la cusboonaysiiyey.","Could not update order status.":"Lama cusboonaysiin karin xaaladda dalabka.","Could not load shop products.":"Alaabta dukaanka lama soo rari karin.","Please allow IMSIYA to access photos on your phone.":"Fadlan u oggolow IMSIYA inay gasho sawirrada taleefankaaga.","Could not select the image.":"Sawirka lama dooran karin.","Delete product":"Tirtir alaabta","Are you sure you want to delete this product?":"Ma hubtaa inaad tirtirayso alaabtan?","Yes, delete":"Haa, tirtir","Product deleted.":"Alaabta waa la tirtiray.","Could not delete product.":"Alaabta lama tirtiri karin.","Could not load wallet.":"Boorsada lama soo rari karin.","Enter a valid amount.":"Geli qaddar sax ah.","Enter your PayPal email.":"Geli iimaylkaaga PayPal.","Payout request submitted. The team will review it and process the payment manually.":"Codsiga lacag-bixinta waa la gudbiyey. Kooxdu way dib u eegaysaa, lacagtaana gacanta ayay ku bixinaysaa.","Could not submit payout request.":"Codsiga lacag-bixinta lama gudbin karin.","The request was marked as paid.":"Codsiga waxaa loo calaamadeeyey in la bixiyey.","The request was rejected.":"Codsiga waa la diiday.","Could not update request status.":"Xaaladda codsiga lama cusboonaysiin karin.","Could not load shop.":"Dukaanka lama soo rari karin.","PayPal returned approval. Final verification is handled by the PayPal webhook; the shop opens after the $20 payment is verified.":"PayPal wuu aqbalay codsiga. Xaqiijinta kama dambaysta ah waxaa sameeya PayPal webhook; dukaanku wuu furmaa marka lacagta $20 la xaqiijiyo.","PayPal did not return an order ID. Please contact us before trying to pay again.":"PayPal ma soo celin aqoonsiga dalabka. Fadlan nala soo xiriir ka hor intaadan mar kale isku dayin lacag-bixinta.","PayPal payment was not verified.":"Lacag-bixinta PayPal lama xaqiijin.","PayPal payment verified. Your order is being prepared.":"Lacag-bixinta PayPal waa la xaqiijiyey. Dalabkaaga waa la diyaarinayaa.","PayPal payment could not be verified. Do not pay again until the status has been checked.":"Lacag-bixinta PayPal lama xaqiijin karin. Ha bixin mar kale ilaa xaaladda la hubiyo.","Order payment was cancelled. No money was charged.":"Lacag-bixinta dalabka waa la joojiyey. Wax lacag ah lagama jarin.","Payment was cancelled. Your shop is not open yet.":"Lacag-bixinta waa la joojiyey. Dukaankaagu weli ma furna.","Could not verify the link.":"Xiriirka lama xaqiijin karin.","Please enter your full name.":"Fadlan geli magacaaga oo buuxa.","Enter your email and password.":"Geli iimaylkaaga iyo furaha sirta ah.","The email address is invalid. Please check it.":"Cinwaanka iimaylku sax ma aha. Fadlan hubi.","Password must be at least 8 characters.":"Furaha sirta ahi waa inuu ka koobnaadaa ugu yaraan 8 xaraf.","Account could not be created. Please try again.":"Akawnka lama samayn karin. Fadlan mar kale isku day.","Registration accepted. Verify your email using the link we sent. Check Spam/Junk too.":"Isdiiwaangelinta waa la aqbalay. Ku xaqiiji iimaylka xiriirka aan kuu dirnay. Sidoo kale hubi Spam/Junk.","Your account has been created. Welcome to IMSIYA!":"Akawnkaaga waa la sameeyey. Ku soo dhawoow IMSIYA!","Sign-in did not complete. Please try again.":"Gelitaanku ma dhammaystirmin. Fadlan mar kale isku day.","Registration could not finish because the email verification server has an issue. The administrator must fix Supabase SMTP settings.":"Isdiiwaangelintu ma dhammaystirmi karto sababtoo ah server-ka xaqiijinta iimaylka ayaa cilad leh. Maamuluhu waa inuu hagaajiyaa dejinta Supabase SMTP.","Sign-in failed. Check your details and try again.":"Gelitaanku wuu fashilmay. Hubi xogtaada oo mar kale isku day.","Something went wrong. Please try again.":"Waxbaa khaldamay. Fadlan mar kale isku day.","This product is currently unavailable.":"Alaabtan hadda lama heli karo.","The quantity cannot exceed the available stock.":"Tirada aad dalbatay kama badnaan karto kaydka la hayo.","Product added to cart.":"Alaabta waxaa lagu daray gaariga wax iibsiga.","Please sign in first.":"Fadlan marka hore gal akoonkaaga.","Enter your shop name.":"Geli magaca dukaankaaga.","Shop application saved. Pay $20 per month to open the shop; an administrator will verify the payment.":"Codsiga dukaanka waa la kaydiyey. Bixi $20 bishii si dukaanku u furmo; maamule ayaa xaqiijin doona lacag-bixinta.","Could not save shop details.":"Faahfaahinta dukaanka lama kaydin karin.","Only the Super Admin can set up the PayPal plan.":"Kaliya Super Admin ayaa dejin kara qorshaha PayPal.","PayPal LIVE plan could not be verified.":"Qorshaha PayPal LIVE lama xaqiijin karin.","PayPal LIVE plan for $20/month has been set up and verified. No subscription was started and no payment was charged.":"Qorshaha PayPal LIVE ee $20/bishii waa la dejiyey waana la xaqiijiyey. Rukhsad lama bilaabin, lacagna lama qaadin.","PayPal plan setup failed.":"Dejinta qorshaha PayPal way fashilantay.","Please create your shop first.":"Fadlan marka hore samee dukaankaaga.","PayPal did not return a subscription link.":"PayPal ma soo celin xiriirka rukhsadda.","Could not start payment.":"Lacag-bixinta lama bilaabi karin.","Your shop is not active yet. Wait for payment verification and administrator approval.":"Dukaankaagu weli ma shaqaynayo. Sug xaqiijinta lacag-bixinta iyo ansixinta maamulka.","Enter the product name and price.":"Geli magaca alaabta iyo qiimaheeda.","The product price is invalid.":"Qiimaha alaabtu sax ma aha.","The product quantity is invalid.":"Tirada alaabtu sax ma aha.","Product category not found. Check the categories in Supabase.":"Qaybta alaabta lama helin. Hubi qaybaha ku jira Supabase.","Could not read the image from your phone.":"Sawirka lagama akhrin karin taleefankaaga.","Product updated.":"Alaabta waa la cusboonaysiiyey.","Product added to your shop.":"Alaabta waxaa lagu daray dukaankaaga.","Could not add the product.":"Alaabta lama dari karin.","Product total: KES ":"Wadarta alaabta: KES ","PayPal amount: USD ":"Qaddarka PayPal: USD ","Could not load orders.":"Dalabyada lama soo rari karin.","Could not load seller orders.":"Dalabyada iibiyaha lama soo rari karin.","IMSIYA SELLER":"IIBIYAHA IMSIYA","← My Shop":"← Dukaankayga","Order:":"Dalab:","Your request will be reviewed by the IMSIYA team. Payment is not sent automatically yet.":"Kooxda IMSIYA ayaa dib u eegi doonta codsigaaga. Lacagta si toos ah looma dirayo weli.","Example: 1,000":"Tusaale: 1,000","Your payout will be sent to your PayPal email.":"Lacagtaada waxaa laguugu diri doonaa iimaylkaaga PayPal.","PayPal Payout":"Lacag-bixinta PayPal","IMSIYA will review the request. It will be marked as paid only after PayPal confirms the transfer.":"IMSIYA ayaa dib u eegi doonta codsiga. Waxaa loo calaamadayn doonaa in la bixiyey kaliya marka PayPal xaqiijiso wareejinta.","Your submitted requests will appear here.":"Codsiyada aad gudbisay halkan ayay ka muuqan doonaan.","Status:":"Xaalad:","← Back to Shop":"← Ku noqo dukaanka","IMSIYA Product":"Alaabta IMSIYA","← Back to Profile":"← Ku noqo astaanta","Create an account to buy and sell sweets.":"Samee akoon si aad u iibsato una iibiso macmacaanka.","Sign in to continue shopping.":"Gal si aad u sii wadato wax iibsiga.","Enter your email address first.":"Marka hore geli cinwaanka iimaylkaaga.","If the email is valid, a password reset link has been sent.":"Haddii iimaylku sax yahay, xiriirka dib-u-dejinta furaha sirta waa la diray.","Don't have an account?":"Akoon ma lihid?","IMSIYA Customer":"Macmiilka IMSIYA","Account Details":"Faahfaahinta akoonka","Email:":"Iimayl:","Account type: ":"Nooca akoonka: ","Language":"Luqadda","My Shop and Seller Account":"Dukaankayga iyo akoonka iibiyaha","Seller Wallet":"Boorsada iibiyaha","My Cart":"Dambiishayda wax iibsiga","← Back to Home":"← Ku noqo bogga hore","← Back to Products":"← Ku noqo alaabta","No additional description has been added yet.":"Weli sharaxaad dheeraad ah laguma darin.","Pay Now with PayPal":"Hadda ku bixi PayPal","IMSIYA Admin":"Maamulka IMSIYA","PayPal LIVE — $20/month":"PayPal LIVE — $20/bishii","Set up and verify the product and billing plan. This will not start a subscription or charge money.":"Deji oo xaqiiji badeecadda iyo qorshaha biil-bixinta. Tani ma bilaabayso rukhsad mana qaadayso lacag.","Set up PayPal LIVE Plan":"Deji qorshaha PayPal LIVE","No description provided":"Sharaxaad lama bixin","Note: approving a seller does not activate the shop until the $20 subscription payment is verified.":"Fiiro gaar ah: ansixinta iibiyuhu ma hawlgelinayso dukaanka ilaa la xaqiijiyo lacagta rukhsadda $20.","Orders:":"Dalabyo:","most recent":"kii ugu dambeeyey","Not specified":"Lama cayimin","This order has been delivered.":"Dalabkan waa la gaarsiiyey.","Started:":"Bilaabmay:","Expires:":"Dhacaya:","No payout requests yet.":"Weli ma jiraan codsiyo lacag-qaadasho.","Important: send the money through PayPal first; the button below only records a transfer you have already made.":"Muhiim: marka hore lacagta ku dir PayPal; badhanka hoose wuxuu diiwaangelinayaa oo keliya wareejin aad hore u samaysay.","Payout account:":"Akawnka lacag-qaadashada:","Confirm: PayPal transfer sent":"Xaqiiji: lacagta PayPal waa la diray","No details provided":"Faahfaahin lama bixin","Loading your shop...":"Dukaankaaga waa la soo rarayaa...","Information customers will see.":"Macluumaadka ay macaamiishu arki doonaan.","Example: IMSIYA Sweets":"Tusaale: Macmacaanka IMSIYA","Tell customers about your shop...":"U sheeg macaamiisha wax ku saabsan dukaankaaga...","● Open":"● Furan","● Pending":"● Sugaya","USD / month":"USD / bishii","↻  Check Shop Status":"↻  Hubi xaaladda dukaanka","Track customer purchases and sales orders.":"La soco iibka macaamiisha iyo dalabyada iibka.","Manage the sweets you are selling.":"Maamul macmacaanka aad iibinayso.","Enter the details of your product.":"Geli faahfaahinta alaabtaada.","Describe the product":"Sharax alaabta","＋  Choose a Photo":"＋  Dooro sawir","JPG, PNG or WEBP image; up to 5 MB.":"Sawir JPG, PNG ama WEBP ah; ugu badnaan 5 MB.","Or enter an image URL (https://...)":"Ama geli xiriirka sawirka (https://...)","Sweetness for Everyone":"Macaan qof walba","Admin":"Maamule"},
  ar: {"My Wallet":"محفظتي","YOUR SALES BALANCE":"رصيد مبيعاتك","You keep 100% of your verified sales.":"تحتفظ بنسبة 100٪ من مبيعاتك المؤكدة.","Refresh wallet":"تحديث المحفظة","Activity":"النشاط","Transaction history":"سجل المعاملات","No activity yet":"لا يوجد نشاط بعد","Verified sales will appear here.":"ستظهر المبيعات المؤكدة هنا.","Request a payout":"طلب سحب","Amount (KSh)":"المبلغ (KSh)","Payout method":"طريقة السحب","PayPal email":"بريد PayPal","Submit request":"إرسال الطلب","My Requests":"طلباتي","Awaiting review":"بانتظار المراجعة","My Shop":"متجري","Manage your shop and the products you sell.":"أدر متجرك والمنتجات التي تبيعها.","Shop Details":"تفاصيل المتجر","Shop Name":"اسم المتجر","Shop Description":"وصف المتجر","Save Shop Details":"حفظ تفاصيل المتجر","Shop subscription":"اشتراك المتجر","Shop Orders":"طلبات المتجر","My Products":"منتجاتي","No products yet":"لا توجد منتجات بعد","Add Product":"إضافة منتج","Product Name":"اسم المنتج","Price (KSh)":"السعر (KSh)","Stock Quantity":"كمية المخزون","Product Image":"صورة المنتج","Product Category":"فئة المنتج","Refresh Products":"تحديث المنتجات","Add a New Product":"إضافة منتج جديد","Edit Product":"تعديل المنتج","Details":"التفاصيل","Stock:":"المخزون:","Out of stock":"نفد المخزون","Confirm payment":"تأكيد الدفع","Continue to PayPal":"المتابعة إلى PayPal","Cancel":"إلغاء","Last updated:":"آخر تحديث:","Sale":"بيع","Transaction":"معاملة","Sales payment":"دفعة المبيعات","No payout requests yet":"لا توجد طلبات سحب بعد","Paid":"مدفوع","Rejected":"مرفوض","Processing":"قيد المعالجة","My Shop Orders":"طلبات متجري","Refresh orders":"تحديث الطلبات","No shop product orders yet.":"لا توجد طلبات لمنتجات المتجر بعد","Quantity:":"الكمية:","Price:":"السعر:","Order total:":"إجمالي الطلب:","Payment:":"الدفع:","Method:":"الطريقة:","You have no orders yet.":"ليس لديك طلبات بعد","Forgot Password?":"هل نسيت كلمة المرور؟","Sign Up":"إنشاء حساب","Sign Out":"تسجيل الخروج","You have not added any favorites yet.":"لم تضف أي مفضلات بعد","Product not found.":"لم يتم العثور على المنتج","Your Cart":"سلة التسوق","Not enough stock available.":"المخزون غير كافٍ","Payment Method":"طريقة الدفع","Secure Payment":"دفع آمن","Your payment is secure and encrypted.":"دفعتك آمنة ومشفرة","Clear cart":"إفراغ السلة","Seller Applications":"طلبات البائعين","Awaiting approval:":"بانتظار الموافقة:","There are no applications awaiting approval.":"لا توجد طلبات بانتظار الموافقة","Approve this seller":"الموافقة على هذا البائع","Admin Overview":"نظرة عامة للإدارة","Customer Orders":"طلبات العملاء","No orders yet.":"لا توجد طلبات بعد","Start preparing":"بدء التجهيز","Ship order":"شحن الطلب","Confirm delivery":"تأكيد التسليم","Shop Subscriptions ($20/month)":"اشتراكات المتجر (20 دولارًا شهريًا)","No subscriptions have been recorded yet.":"لم يتم تسجيل اشتراكات بعد","Seller Payout Requests":"طلبات سحب البائعين","Reject request":"رفض الطلب","Seller Wallet Activity":"نشاط محفظة البائع","No wallet activity yet.":"لا يوجد نشاط للمحفظة بعد","SHOP STATUS":"حالة المتجر","Pay $20 monthly — PayPal":"ادفع 20 دولارًا شهريًا — PayPal","View Sales Orders":"عرض طلبات المبيعات","Add your first product so customers can discover it.":"أضف منتجك الأول ليتمكن العملاء من اكتشافه","Sweet Name":"اسم الحلوى","Could not load products.":"تعذر تحميل المنتجات.","Could not load applications.":"تعذر تحميل الطلبات.","Seller approved. The shop will open after the $20 subscription is verified.":"تمت الموافقة على البائع. سيفتح المتجر بعد التحقق من اشتراك 20 دولارًا.","Approval failed.":"فشلت الموافقة.","Only an administrator can change the order status.":"يمكن للمسؤول فقط تغيير حالة الطلب.","Order not found or you are not allowed to change its status.":"لم يتم العثور على الطلب أو ليس لديك إذن لتغيير حالته.","Order status updated.":"تم تحديث حالة الطلب.","Could not update order status.":"تعذر تحديث حالة الطلب.","Could not load shop products.":"تعذر تحميل منتجات المتجر.","Please allow IMSIYA to access photos on your phone.":"يرجى السماح لـ IMSIYA بالوصول إلى الصور على هاتفك.","Could not select the image.":"تعذر اختيار الصورة.","Delete product":"حذف المنتج","Are you sure you want to delete this product?":"هل أنت متأكد أنك تريد حذف هذا المنتج؟","Yes, delete":"نعم، احذف","Product deleted.":"تم حذف المنتج.","Could not delete product.":"تعذر حذف المنتج.","Could not load wallet.":"تعذر تحميل المحفظة.","Enter a valid amount.":"أدخل مبلغًا صحيحًا.","Enter your PayPal email.":"أدخل بريد PayPal الإلكتروني.","Payout request submitted. The team will review it and process the payment manually.":"تم إرسال طلب السحب. سيراجعه الفريق ويعالج الدفع يدويًا.","Could not submit payout request.":"تعذر إرسال طلب السحب.","The request was marked as paid.":"تم تحديد الطلب على أنه مدفوع.","The request was rejected.":"تم رفض الطلب.","Could not update request status.":"تعذر تحديث حالة الطلب.","Could not load shop.":"تعذر تحميل المتجر.","PayPal returned approval. Final verification is handled by the PayPal webhook; the shop opens after the $20 payment is verified.":"وافق PayPal على الطلب. تتم عملية التحقق النهائية عبر إشعار PayPal؛ ويفتح المتجر بعد تأكيد دفع 20 دولارًا.","PayPal did not return an order ID. Please contact us before trying to pay again.":"لم يُرجع PayPal رقم الطلب. يرجى التواصل معنا قبل محاولة الدفع مرة أخرى.","PayPal payment was not verified.":"لم يتم التحقق من دفعة PayPal.","PayPal payment verified. Your order is being prepared.":"تم التحقق من دفعة PayPal. يجري تجهيز طلبك.","PayPal payment could not be verified. Do not pay again until the status has been checked.":"تعذر التحقق من دفعة PayPal. لا تدفع مرة أخرى قبل التحقق من الحالة.","Order payment was cancelled. No money was charged.":"تم إلغاء دفع الطلب. لم يتم خصم أي أموال.","Payment was cancelled. Your shop is not open yet.":"تم إلغاء الدفع. متجرك لم يُفتح بعد.","Could not verify the link.":"تعذر التحقق من الرابط.","Please enter your full name.":"يرجى إدخال اسمك الكامل.","Enter your email and password.":"أدخل بريدك الإلكتروني وكلمة المرور.","The email address is invalid. Please check it.":"عنوان البريد الإلكتروني غير صالح. يرجى التحقق منه.","Password must be at least 8 characters.":"يجب ألا تقل كلمة المرور عن 8 أحرف.","Account could not be created. Please try again.":"تعذر إنشاء الحساب. يرجى المحاولة مرة أخرى.","Registration accepted. Verify your email using the link we sent. Check Spam/Junk too.":"تم قبول التسجيل. تحقق من بريدك عبر الرابط الذي أرسلناه. تحقق أيضًا من مجلد الرسائل غير المرغوب فيها.","Your account has been created. Welcome to IMSIYA!":"تم إنشاء حسابك. مرحبًا بك في IMSIYA!","Sign-in did not complete. Please try again.":"لم تكتمل عملية تسجيل الدخول. يرجى المحاولة مرة أخرى.","Registration could not finish because the email verification server has an issue. The administrator must fix Supabase SMTP settings.":"تعذر إكمال التسجيل بسبب مشكلة في خادم التحقق من البريد الإلكتروني. يجب على المسؤول إصلاح إعدادات Supabase SMTP.","Sign-in failed. Check your details and try again.":"فشل تسجيل الدخول. تحقق من بياناتك وحاول مرة أخرى.","Something went wrong. Please try again.":"حدث خطأ ما. يرجى المحاولة مرة أخرى.","This product is currently unavailable.":"هذا المنتج غير متاح حاليًا.","The quantity cannot exceed the available stock.":"لا يمكن أن تتجاوز الكمية المخزون المتاح.","Product added to cart.":"تمت إضافة المنتج إلى سلة التسوق.","Please sign in first.":"يرجى تسجيل الدخول أولًا.","Enter your shop name.":"أدخل اسم متجرك.","Shop application saved. Pay $20 per month to open the shop; an administrator will verify the payment.":"تم حفظ طلب المتجر. ادفع 20 دولارًا شهريًا لفتح المتجر؛ وسيتحقق المسؤول من الدفع.","Could not save shop details.":"تعذر حفظ تفاصيل المتجر.","Only the Super Admin can set up the PayPal plan.":"يمكن للمسؤول الأعلى فقط إعداد خطة PayPal.","PayPal LIVE plan could not be verified.":"تعذر التحقق من خطة PayPal LIVE.","PayPal LIVE plan for $20/month has been set up and verified. No subscription was started and no payment was charged.":"تم إعداد خطة PayPal LIVE بقيمة 20 دولارًا شهريًا والتحقق منها. لم يبدأ أي اشتراك ولم يتم تحصيل أي مبلغ.","PayPal plan setup failed.":"فشل إعداد خطة PayPal.","Please create your shop first.":"يرجى إنشاء متجرك أولًا.","PayPal did not return a subscription link.":"لم يُرجع PayPal رابط الاشتراك.","Could not start payment.":"تعذر بدء الدفع.","Your shop is not active yet. Wait for payment verification and administrator approval.":"متجرك غير نشط بعد. انتظر التحقق من الدفع وموافقة المسؤول.","Enter the product name and price.":"أدخل اسم المنتج وسعره.","The product price is invalid.":"سعر المنتج غير صالح.","The product quantity is invalid.":"كمية المنتج غير صالحة.","Product category not found. Check the categories in Supabase.":"لم يتم العثور على فئة المنتج. تحقق من الفئات في Supabase.","Could not read the image from your phone.":"تعذرت قراءة الصورة من هاتفك.","Product updated.":"تم تحديث المنتج.","Product added to your shop.":"تمت إضافة المنتج إلى متجرك.","Could not add the product.":"تعذرت إضافة المنتج.","Product total: KES ":"إجمالي المنتج: KES ","PayPal amount: USD ":"مبلغ PayPal: USD ","Could not load orders.":"تعذر تحميل الطلبات.","Could not load seller orders.":"تعذر تحميل طلبات البائع.","IMSIYA SELLER":"بائع IMSIYA","← My Shop":"← متجري","Order:":"الطلب:","Your request will be reviewed by the IMSIYA team. Payment is not sent automatically yet.":"سيراجع فريق IMSIYA طلبك. لم يتم إرسال الدفعة تلقائيًا حتى الآن.","Example: 1,000":"مثال: 1,000","Your payout will be sent to your PayPal email.":"سيتم إرسال مستحقاتك إلى بريد PayPal الإلكتروني.","PayPal Payout":"دفعة PayPal","IMSIYA will review the request. It will be marked as paid only after PayPal confirms the transfer.":"سيراجع IMSIYA الطلب. ولن يتم وضع علامة مدفوع إلا بعد أن يؤكد PayPal التحويل.","Your submitted requests will appear here.":"ستظهر طلباتك المقدمة هنا.","Status:":"الحالة:","← Back to Shop":"← العودة إلى المتجر","IMSIYA Product":"منتج IMSIYA","← Back to Profile":"← العودة إلى الملف الشخصي","Create an account to buy and sell sweets.":"أنشئ حسابًا لشراء الحلويات وبيعها.","Sign in to continue shopping.":"سجّل الدخول لمتابعة التسوق.","Enter your email address first.":"أدخل عنوان بريدك الإلكتروني أولًا.","If the email is valid, a password reset link has been sent.":"إذا كان البريد الإلكتروني صالحًا، فسيتم إرسال رابط إعادة تعيين كلمة المرور.","Don't have an account?":"ليس لديك حساب؟","IMSIYA Customer":"عميل IMSIYA","Account Details":"تفاصيل الحساب","Email:":"البريد الإلكتروني:","Account type: ":"نوع الحساب: ","Language":"اللغة","My Shop and Seller Account":"متجري وحساب البائع","Seller Wallet":"محفظة البائع","My Cart":"سلة التسوق","← Back to Home":"← العودة إلى الصفحة الرئيسية","← Back to Products":"← العودة إلى المنتجات","No additional description has been added yet.":"لم تتم إضافة وصف إضافي بعد.","Pay Now with PayPal":"ادفع الآن عبر PayPal","IMSIYA Admin":"إدارة IMSIYA","PayPal LIVE — $20/month":"PayPal LIVE — 20 دولارًا شهريًا","Set up and verify the product and billing plan. This will not start a subscription or charge money.":"أعد المنتج وخطة الفوترة وتحقق منهما. لن يؤدي ذلك إلى بدء اشتراك أو تحصيل أي أموال.","Set up PayPal LIVE Plan":"إعداد خطة PayPal LIVE","No description provided":"لا يوجد وصف مقدم","Note: approving a seller does not activate the shop until the $20 subscription payment is verified.":"ملاحظة: الموافقة على البائع لا تفعّل المتجر حتى يتم التحقق من دفع اشتراك 20 دولارًا.","Orders:":"الطلبات:","most recent":"الأحدث","Not specified":"غير محدد","This order has been delivered.":"تم تسليم هذا الطلب.","Started:":"بدأ:","Expires:":"ينتهي:","No payout requests yet.":"لا توجد طلبات سحب بعد.","Important: send the money through PayPal first; the button below only records a transfer you have already made.":"مهم: أرسل الأموال عبر PayPal أولًا؛ فالزر أدناه يسجل فقط عملية تحويل قمت بها بالفعل.","Payout account:":"حساب استلام الأموال:","Confirm: PayPal transfer sent":"تأكيد: تم إرسال تحويل PayPal","No details provided":"لا توجد تفاصيل مقدمة","Loading your shop...":"جارٍ تحميل متجرك...","Information customers will see.":"المعلومات التي سيطلع عليها العملاء.","Example: IMSIYA Sweets":"مثال: حلويات IMSIYA","Tell customers about your shop...":"أخبر العملاء عن متجرك...","● Open":"● مفتوح","● Pending":"● قيد الانتظار","USD / month":"دولار أمريكي / شهريًا","↻  Check Shop Status":"↻  التحقق من حالة المتجر","Track customer purchases and sales orders.":"تتبع مشتريات العملاء وطلبات المبيعات.","Manage the sweets you are selling.":"أدر الحلويات التي تبيعها.","Enter the details of your product.":"أدخل تفاصيل منتجك.","Describe the product":"صف المنتج","＋  Choose a Photo":"＋  اختر صورة","JPG, PNG or WEBP image; up to 5 MB.":"صورة JPG أو PNG أو WEBP؛ بحد أقصى 5 ميجابايت.","Or enter an image URL (https://...)":"أو أدخل رابط الصورة (https://...)","Sweetness for Everyone":"حلاوة للجميع","Admin":"المسؤول"},
  sw: {"My Wallet":"Pochi yangu","YOUR SALES BALANCE":"SALIO LA MAUZO YAKO","You keep 100% of your verified sales.":"Unabaki na 100% ya mauzo yako yaliyothibitishwa.","Refresh wallet":"Onyesha upya pochi","Activity":"Shughuli","Transaction history":"Historia ya miamala","No activity yet":"Bado hakuna shughuli","Verified sales will appear here.":"Mauzo yaliyothibitishwa yataonekana hapa.","Request a payout":"Omba malipo","Amount (KSh)":"Kiasi (KSh)","Payout method":"Njia ya malipo","PayPal email":"Barua pepe ya PayPal","Submit request":"Tuma ombi","My Requests":"Maombi yangu","Awaiting review":"Inasubiri ukaguzi","My Shop":"Duka langu","Manage your shop and the products you sell.":"Dhibiti duka lako na bidhaa unazouza.","Shop Details":"Maelezo ya duka","Shop Name":"Jina la duka","Shop Description":"Maelezo ya duka","Save Shop Details":"Hifadhi maelezo ya duka","Shop subscription":"Usajili wa duka","Shop Orders":"Maagizo ya duka","My Products":"Bidhaa zangu","No products yet":"Bado hakuna bidhaa","Add Product":"Ongeza bidhaa","Product Name":"Jina la bidhaa","Price (KSh)":"Bei (KSh)","Stock Quantity":"Idadi ya bidhaa","Product Image":"Picha ya bidhaa","Product Category":"Aina ya bidhaa","Refresh Products":"Onyesha upya bidhaa","Add a New Product":"Ongeza bidhaa mpya","Edit Product":"Hariri bidhaa","Details":"Maelezo","Stock:":"Hisa:","Out of stock":"Bidhaa imeisha","Confirm payment":"Thibitisha malipo","Continue to PayPal":"Endelea PayPal","Cancel":"Ghairi","Last updated:":"Ilisasishwa mwisho:","Sale":"Mauzo","Transaction":"Muamala","Sales payment":"Malipo ya mauzo","No payout requests yet":"Bado hakuna maombi ya malipo","Paid":"Imelipwa","Rejected":"Imekataliwa","Processing":"Inachakatwa","My Shop Orders":"Maagizo ya duka langu","Refresh orders":"Onyesha upya maagizo","No shop product orders yet.":"Bado hakuna maagizo ya bidhaa za duka","Quantity:":"Idadi:","Price:":"Bei:","Order total:":"Jumla ya agizo:","Payment:":"Malipo:","Method:":"Njia:","You have no orders yet.":"Bado huna maagizo","Forgot Password?":"Umesahau nenosiri?","Sign Up":"Jisajili","Sign Out":"Toka","You have not added any favorites yet.":"Bado hujaongeza vipendwa","Product not found.":"Bidhaa haikupatikana","Your Cart":"Kikapu changu","Not enough stock available.":"Hisa haitoshi","Payment Method":"Njia ya malipo","Secure Payment":"Malipo salama","Your payment is secure and encrypted.":"Malipo yako ni salama na yamesimbwa","Clear cart":"Safisha kikapu","Seller Applications":"Maombi ya wauzaji","Awaiting approval:":"Yanasubiri kuidhinishwa:","There are no applications awaiting approval.":"Hakuna maombi yanayosubiri kuidhinishwa","Approve this seller":"Idhinisha muuzaji huyu","Admin Overview":"Muhtasari wa msimamizi","Customer Orders":"Maagizo ya wateja","No orders yet.":"Bado hakuna maagizo","Start preparing":"Anza kuandaa","Ship order":"Tuma agizo","Confirm delivery":"Thibitisha uwasilishaji","Shop Subscriptions ($20/month)":"Usajili wa duka ($20/mwezi)","No subscriptions have been recorded yet.":"Bado hakuna usajili uliorekodiwa","Seller Payout Requests":"Maombi ya malipo ya wauzaji","Reject request":"Kataa ombi","Seller Wallet Activity":"Shughuli za pochi ya muuzaji","No wallet activity yet.":"Bado hakuna shughuli za pochi","SHOP STATUS":"HALI YA DUKA","Pay $20 monthly — PayPal":"Lipa $20 kila mwezi — PayPal","View Sales Orders":"Tazama maagizo ya mauzo","Add your first product so customers can discover it.":"Ongeza bidhaa yako ya kwanza ili wateja waione","Sweet Name":"Jina la kitamu","Could not load products.":"Bidhaa hazikuweza kupakiwa.","Could not load applications.":"Maombi hayakuweza kupakiwa.","Seller approved. The shop will open after the $20 subscription is verified.":"Muuzaji ameidhinishwa. Duka litafunguliwa baada ya usajili wa $20 kuthibitishwa.","Approval failed.":"Uidhinishaji haukufaulu.","Only an administrator can change the order status.":"Msimamizi pekee ndiye anayeweza kubadilisha hali ya agizo.","Order not found or you are not allowed to change its status.":"Agizo halikupatikana au huna ruhusa ya kubadilisha hali yake.","Order status updated.":"Hali ya agizo imesasishwa.","Could not update order status.":"Hali ya agizo haikuweza kusasishwa.","Could not load shop products.":"Bidhaa za duka hazikuweza kupakiwa.","Please allow IMSIYA to access photos on your phone.":"Tafadhali ruhusu IMSIYA kufikia picha kwenye simu yako.","Could not select the image.":"Picha haikuweza kuchaguliwa.","Delete product":"Futa bidhaa","Are you sure you want to delete this product?":"Una uhakika unataka kufuta bidhaa hii?","Yes, delete":"Ndiyo, futa","Product deleted.":"Bidhaa imefutwa.","Could not delete product.":"Bidhaa haikuweza kufutwa.","Could not load wallet.":"Pochi haikuweza kupakiwa.","Enter a valid amount.":"Weka kiasi sahihi.","Enter your PayPal email.":"Weka barua pepe yako ya PayPal.","Payout request submitted. The team will review it and process the payment manually.":"Ombi la malipo limetumwa. Timu italikagua na kushughulikia malipo kwa mkono.","Could not submit payout request.":"Ombi la malipo halikuweza kutumwa.","The request was marked as paid.":"Ombi limewekwa kuwa limelipwa.","The request was rejected.":"Ombi limekataliwa.","Could not update request status.":"Hali ya ombi haikuweza kusasishwa.","Could not load shop.":"Duka halikuweza kupakiwa.","PayPal returned approval. Final verification is handled by the PayPal webhook; the shop opens after the $20 payment is verified.":"PayPal imeidhinisha ombi. Uthibitishaji wa mwisho hufanywa kupitia webhook ya PayPal; duka litafunguliwa baada ya malipo ya $20 kuthibitishwa.","PayPal did not return an order ID. Please contact us before trying to pay again.":"PayPal haikurudisha kitambulisho cha agizo. Tafadhali wasiliana nasi kabla ya kujaribu kulipa tena.","PayPal payment was not verified.":"Malipo ya PayPal hayajathibitishwa.","PayPal payment verified. Your order is being prepared.":"Malipo ya PayPal yamethibitishwa. Agizo lako linaandaliwa.","PayPal payment could not be verified. Do not pay again until the status has been checked.":"Malipo ya PayPal hayakuweza kuthibitishwa. Usilipe tena kabla hali haijakaguliwa.","Order payment was cancelled. No money was charged.":"Malipo ya agizo yameghairiwa. Hakuna pesa iliyokatwa.","Payment was cancelled. Your shop is not open yet.":"Malipo yameghairiwa. Duka lako bado halijafunguliwa.","Could not verify the link.":"Kiungo hakikuweza kuthibitishwa.","Please enter your full name.":"Tafadhali weka jina lako kamili.","Enter your email and password.":"Weka barua pepe na nenosiri lako.","The email address is invalid. Please check it.":"Anwani ya barua pepe si sahihi. Tafadhali ikague.","Password must be at least 8 characters.":"Nenosiri lazima liwe na angalau herufi 8.","Account could not be created. Please try again.":"Akaunti haikuweza kuundwa. Tafadhali jaribu tena.","Registration accepted. Verify your email using the link we sent. Check Spam/Junk too.":"Usajili umepokelewa. Thibitisha barua pepe yako kupitia kiungo tulichotuma. Pia angalia Spam/Junk.","Your account has been created. Welcome to IMSIYA!":"Akaunti yako imeundwa. Karibu IMSIYA!","Sign-in did not complete. Please try again.":"Kuingia hakukukamilika. Tafadhali jaribu tena.","Registration could not finish because the email verification server has an issue. The administrator must fix Supabase SMTP settings.":"Usajili haukuweza kukamilika kwa sababu seva ya uthibitishaji wa barua pepe ina tatizo. Msimamizi lazima arekebishe mipangilio ya Supabase SMTP.","Sign-in failed. Check your details and try again.":"Kuingia kumeshindikana. Kagua taarifa zako na ujaribu tena.","Something went wrong. Please try again.":"Hitilafu imetokea. Tafadhali jaribu tena.","This product is currently unavailable.":"Bidhaa hii haipatikani kwa sasa.","The quantity cannot exceed the available stock.":"Idadi haiwezi kuzidi bidhaa zilizopo kwenye stoo.","Product added to cart.":"Bidhaa imeongezwa kwenye kikapu.","Please sign in first.":"Tafadhali ingia kwanza.","Enter your shop name.":"Weka jina la duka lako.","Shop application saved. Pay $20 per month to open the shop; an administrator will verify the payment.":"Ombi la duka limehifadhiwa. Lipa $20 kwa mwezi ili kufungua duka; msimamizi atathibitisha malipo.","Could not save shop details.":"Maelezo ya duka hayakuweza kuhifadhiwa.","Only the Super Admin can set up the PayPal plan.":"Msimamizi Mkuu pekee ndiye anayeweza kusanidi mpango wa PayPal.","PayPal LIVE plan could not be verified.":"Mpango wa PayPal LIVE haukuweza kuthibitishwa.","PayPal LIVE plan for $20/month has been set up and verified. No subscription was started and no payment was charged.":"Mpango wa PayPal LIVE wa $20/mwezi umewekwa na kuthibitishwa. Usajili haujaanzishwa na hakuna malipo yaliyotozwa.","PayPal plan setup failed.":"Usanidi wa mpango wa PayPal umeshindikana.","Please create your shop first.":"Tafadhali fungua duka lako kwanza.","PayPal did not return a subscription link.":"PayPal haikurudisha kiungo cha usajili.","Could not start payment.":"Malipo hayakuweza kuanzishwa.","Your shop is not active yet. Wait for payment verification and administrator approval.":"Duka lako bado halijaanza kufanya kazi. Subiri uthibitishaji wa malipo na idhini ya msimamizi.","Enter the product name and price.":"Weka jina na bei ya bidhaa.","The product price is invalid.":"Bei ya bidhaa si sahihi.","The product quantity is invalid.":"Idadi ya bidhaa si sahihi.","Product category not found. Check the categories in Supabase.":"Aina ya bidhaa haikupatikana. Kagua aina za bidhaa kwenye Supabase.","Could not read the image from your phone.":"Picha haikuweza kusomwa kutoka kwenye simu yako.","Product updated.":"Bidhaa imesasishwa.","Product added to your shop.":"Bidhaa imeongezwa kwenye duka lako.","Could not add the product.":"Bidhaa haikuweza kuongezwa.","Product total: KES ":"Jumla ya bidhaa: KES ","PayPal amount: USD ":"Kiasi cha PayPal: USD ","Could not load orders.":"Maagizo hayakuweza kupakiwa.","Could not load seller orders.":"Maagizo ya muuzaji hayakuweza kupakiwa.","IMSIYA SELLER":"MUUZAJI WA IMSIYA","← My Shop":"← Duka langu","Order:":"Agizo:","Your request will be reviewed by the IMSIYA team. Payment is not sent automatically yet.":"Timu ya IMSIYA itakagua ombi lako. Malipo bado hayatumiwi kiotomatiki.","Example: 1,000":"Mfano: 1,000","Your payout will be sent to your PayPal email.":"Malipo yako yatatumwa kwenye barua pepe yako ya PayPal.","PayPal Payout":"Malipo ya PayPal","IMSIYA will review the request. It will be marked as paid only after PayPal confirms the transfer.":"IMSIYA itakagua ombi. Litawekwa kuwa limelipwa tu baada ya PayPal kuthibitisha uhamisho.","Your submitted requests will appear here.":"Maombi uliyowasilisha yataonekana hapa.","Status:":"Hali:","← Back to Shop":"← Rudi dukani","IMSIYA Product":"Bidhaa ya IMSIYA","← Back to Profile":"← Rudi kwenye wasifu","Create an account to buy and sell sweets.":"Fungua akaunti ili kununua na kuuza vitamu.","Sign in to continue shopping.":"Ingia ili uendelee kufanya manunuzi.","Enter your email address first.":"Weka anwani yako ya barua pepe kwanza.","If the email is valid, a password reset link has been sent.":"Ikiwa barua pepe ni sahihi, kiungo cha kuweka upya nenosiri kimetumwa.","Don't have an account?":"Huna akaunti?","IMSIYA Customer":"Mteja wa IMSIYA","Account Details":"Maelezo ya akaunti","Email:":"Barua pepe:","Account type: ":"Aina ya akaunti: ","Language":"Lugha","My Shop and Seller Account":"Duka langu na akaunti ya muuzaji","Seller Wallet":"Pochi ya muuzaji","My Cart":"Kikapu changu","← Back to Home":"← Rudi mwanzo","← Back to Products":"← Rudi kwenye bidhaa","No additional description has been added yet.":"Bado hakuna maelezo ya ziada yaliyowekwa.","Pay Now with PayPal":"Lipa sasa kwa PayPal","IMSIYA Admin":"Usimamizi wa IMSIYA","PayPal LIVE — $20/month":"PayPal LIVE — $20/mwezi","Set up and verify the product and billing plan. This will not start a subscription or charge money.":"Sanidi na uthibitishe bidhaa na mpango wa malipo. Hii haitaanzisha usajili wala kutoza pesa.","Set up PayPal LIVE Plan":"Sanidi mpango wa PayPal LIVE","No description provided":"Hakuna maelezo yaliyotolewa","Note: approving a seller does not activate the shop until the $20 subscription payment is verified.":"Kumbuka: kumuidhinisha muuzaji hakuwashi duka hadi malipo ya usajili wa $20 yathibitishwe.","Orders:":"Maagizo:","most recent":"ya hivi karibuni","Not specified":"Haijabainishwa","This order has been delivered.":"Agizo hili limewasilishwa.","Started:":"Ilianza:","Expires:":"Inaisha:","No payout requests yet.":"Bado hakuna maombi ya malipo.","Important: send the money through PayPal first; the button below only records a transfer you have already made.":"Muhimu: tuma pesa kupitia PayPal kwanza; kitufe kilicho hapa chini kinarekodi tu uhamisho ambao tayari umefanya.","Payout account:":"Akaunti ya kupokea malipo:","Confirm: PayPal transfer sent":"Thibitisha: Uhamisho wa PayPal umetumwa","No details provided":"Hakuna maelezo yaliyotolewa","Loading your shop...":"Duka lako linapakia...","Information customers will see.":"Maelezo ambayo wateja wataona.","Example: IMSIYA Sweets":"Mfano: IMSIYA Sweets","Tell customers about your shop...":"Waeleze wateja kuhusu duka lako...","● Open":"● Limefunguliwa","● Pending":"● Linasubiri","USD / month":"USD / mwezi","↻  Check Shop Status":"↻  Angalia hali ya duka","Track customer purchases and sales orders.":"Fuatilia ununuzi wa wateja na maagizo ya mauzo.","Manage the sweets you are selling.":"Dhibiti vitamu unavyouza.","Enter the details of your product.":"Weka maelezo ya bidhaa yako.","Describe the product":"Eleza bidhaa","＋  Choose a Photo":"＋  Chagua picha","JPG, PNG or WEBP image; up to 5 MB.":"Picha ya JPG, PNG au WEBP; hadi MB 5.","Or enter an image URL (https://...)":"Au weka kiungo cha picha (https://...)","Sweetness for Everyone":"Utamu kwa kila mtu","Admin":"Msimamizi"},
  fr: {"My Wallet":"Mon portefeuille","YOUR SALES BALANCE":"SOLDE DE VOS VENTES","You keep 100% of your verified sales.":"Vous conservez 100 % de vos ventes vérifiées.","Refresh wallet":"Actualiser le portefeuille","Activity":"Activité","Transaction history":"Historique des transactions","No activity yet":"Aucune activité pour le moment","Verified sales will appear here.":"Les ventes vérifiées apparaîtront ici.","Request a payout":"Demander un versement","Amount (KSh)":"Montant (KSh)","Payout method":"Mode de versement","PayPal email":"E-mail PayPal","Submit request":"Envoyer la demande","My Requests":"Mes demandes","Awaiting review":"En attente de vérification","My Shop":"Ma boutique","Manage your shop and the products you sell.":"Gérez votre boutique et les produits que vous vendez.","Shop Details":"Détails de la boutique","Shop Name":"Nom de la boutique","Shop Description":"Description de la boutique","Save Shop Details":"Enregistrer les détails","Shop subscription":"Abonnement de la boutique","Shop Orders":"Commandes de la boutique","My Products":"Mes produits","No products yet":"Aucun produit pour le moment","Add Product":"Ajouter un produit","Product Name":"Nom du produit","Price (KSh)":"Prix (KSh)","Stock Quantity":"Quantité en stock","Product Image":"Image du produit","Product Category":"Catégorie du produit","Refresh Products":"Actualiser les produits","Add a New Product":"Ajouter un nouveau produit","Edit Product":"Modifier le produit"},
  es: {"My Wallet":"Mi cartera","YOUR SALES BALANCE":"SALDO DE TUS VENTAS","You keep 100% of your verified sales.":"Conservas el 100 % de tus ventas verificadas.","Refresh wallet":"Actualizar cartera","Activity":"Actividad","Transaction history":"Historial de transacciones","No activity yet":"Aún no hay actividad","Verified sales will appear here.":"Las ventas verificadas aparecerán aquí.","Request a payout":"Solicitar un pago","Amount (KSh)":"Importe (KSh)","Payout method":"Método de pago","PayPal email":"Correo de PayPal","Submit request":"Enviar solicitud","My Requests":"Mis solicitudes","Awaiting review":"Pendiente de revisión","My Shop":"Mi tienda","Manage your shop and the products you sell.":"Administra tu tienda y los productos que vendes.","Shop Details":"Detalles de la tienda","Shop Name":"Nombre de la tienda","Shop Description":"Descripción de la tienda","Save Shop Details":"Guardar detalles","Shop subscription":"Suscripción de la tienda","Shop Orders":"Pedidos de la tienda","My Products":"Mis productos","No products yet":"Aún no hay productos","Add Product":"Añadir producto","Product Name":"Nombre del producto","Price (KSh)":"Precio (KSh)","Stock Quantity":"Cantidad en inventario","Product Image":"Imagen del producto","Product Category":"Categoría del producto","Refresh Products":"Actualizar productos","Add a New Product":"Añadir un producto nuevo","Edit Product":"Editar producto"},
  de: {"My Wallet":"Mein Guthaben","YOUR SALES BALANCE":"DEIN VERKAUFSKONTO","You keep 100% of your verified sales.":"Du behältst 100 % deiner bestätigten Verkäufe.","Refresh wallet":"Guthaben aktualisieren","Activity":"Aktivität","Transaction history":"Transaktionsverlauf","No activity yet":"Noch keine Aktivität","Verified sales will appear here.":"Bestätigte Verkäufe erscheinen hier.","Request a payout":"Auszahlung anfordern","Amount (KSh)":"Betrag (KSh)","Payout method":"Auszahlungsmethode","PayPal email":"PayPal-E-Mail","Submit request":"Anfrage senden","My Requests":"Meine Anfragen","Awaiting review":"Wird geprüft","My Shop":"Mein Shop","Manage your shop and the products you sell.":"Verwalte deinen Shop und deine Produkte.","Shop Details":"Shop-Details","Shop Name":"Shopname","Shop Description":"Shopbeschreibung","Save Shop Details":"Shop-Details speichern","Shop subscription":"Shop-Abonnement","Shop Orders":"Shop-Bestellungen","My Products":"Meine Produkte","No products yet":"Noch keine Produkte","Add Product":"Produkt hinzufügen","Product Name":"Produktname","Price (KSh)":"Preis (KSh)","Stock Quantity":"Lagerbestand","Product Image":"Produktbild","Product Category":"Produktkategorie","Refresh Products":"Produkte aktualisieren","Add a New Product":"Neues Produkt hinzufügen","Edit Product":"Produkt bearbeiten"},
  it: {"My Wallet":"Il mio portafoglio","YOUR SALES BALANCE":"SALDO DELLE TUE VENDITE","You keep 100% of your verified sales.":"Mantieni il 100% delle vendite verificate.","Refresh wallet":"Aggiorna portafoglio","Activity":"Attività","Transaction history":"Cronologia transazioni","No activity yet":"Nessuna attività","Verified sales will appear here.":"Le vendite verificate appariranno qui.","Request a payout":"Richiedi un pagamento","Amount (KSh)":"Importo (KSh)","Payout method":"Metodo di pagamento","PayPal email":"Email PayPal","Submit request":"Invia richiesta","My Requests":"Le mie richieste","Awaiting review":"In attesa di revisione","My Shop":"Il mio negozio","Manage your shop and the products you sell.":"Gestisci il negozio e i prodotti che vendi.","Shop Details":"Dettagli del negozio","Shop Name":"Nome del negozio","Shop Description":"Descrizione del negozio","Save Shop Details":"Salva dettagli","Shop subscription":"Abbonamento negozio","Shop Orders":"Ordini del negozio","My Products":"I miei prodotti","No products yet":"Ancora nessun prodotto","Add Product":"Aggiungi prodotto","Product Name":"Nome prodotto","Price (KSh)":"Prezzo (KSh)","Stock Quantity":"Quantità disponibile","Product Image":"Immagine prodotto","Product Category":"Categoria prodotto","Refresh Products":"Aggiorna prodotti","Add a New Product":"Aggiungi un nuovo prodotto","Edit Product":"Modifica prodotto"},
  pt: {"My Wallet":"Minha carteira","YOUR SALES BALANCE":"SALDO DAS SUAS VENDAS","You keep 100% of your verified sales.":"Você fica com 100% das vendas verificadas.","Refresh wallet":"Atualizar carteira","Activity":"Atividade","Transaction history":"Histórico de transações","No activity yet":"Ainda não há atividade","Verified sales will appear here.":"As vendas verificadas aparecerão aqui.","Request a payout":"Solicitar pagamento","Amount (KSh)":"Valor (KSh)","Payout method":"Método de pagamento","PayPal email":"E-mail do PayPal","Submit request":"Enviar solicitação","My Requests":"Minhas solicitações","Awaiting review":"Aguardando análise","My Shop":"Minha loja","Manage your shop and the products you sell.":"Gerencie sua loja e os produtos que você vende.","Shop Details":"Detalhes da loja","Shop Name":"Nome da loja","Shop Description":"Descrição da loja","Save Shop Details":"Salvar detalhes","Shop subscription":"Assinatura da loja","Shop Orders":"Pedidos da loja","My Products":"Meus produtos","No products yet":"Ainda não há produtos","Add Product":"Adicionar produto","Product Name":"Nome do produto","Price (KSh)":"Preço (KSh)","Stock Quantity":"Quantidade em estoque","Product Image":"Imagem do produto","Product Category":"Categoria do produto","Refresh Products":"Atualizar produtos","Add a New Product":"Adicionar novo produto","Edit Product":"Editar produto"},
  tr: {"My Wallet":"Cüzdanım","YOUR SALES BALANCE":"SATIŞ BAKİYENİZ","You keep 100% of your verified sales.":"Onaylanmış satışlarınızın %100'ü sizde kalır.","Refresh wallet":"Cüzdanı yenile","Activity":"Etkinlik","Transaction history":"İşlem geçmişi","No activity yet":"Henüz etkinlik yok","Verified sales will appear here.":"Onaylanan satışlar burada görünecek.","Request a payout":"Ödeme talep et","Amount (KSh)":"Tutar (KSh)","Payout method":"Ödeme yöntemi","PayPal email":"PayPal e-postası","Submit request":"Talebi gönder","My Requests":"Taleplerim","Awaiting review":"İnceleme bekliyor","My Shop":"Mağazam","Manage your shop and the products you sell.":"Mağazanızı ve sattığınız ürünleri yönetin.","Shop Details":"Mağaza bilgileri","Shop Name":"Mağaza adı","Shop Description":"Mağaza açıklaması","Save Shop Details":"Mağaza bilgilerini kaydet","Shop subscription":"Mağaza aboneliği","Shop Orders":"Mağaza siparişleri","My Products":"Ürünlerim","No products yet":"Henüz ürün yok","Add Product":"Ürün ekle","Product Name":"Ürün adı","Price (KSh)":"Fiyat (KSh)","Stock Quantity":"Stok miktarı","Product Image":"Ürün görseli","Product Category":"Ürün kategorisi","Refresh Products":"Ürünleri yenile","Add a New Product":"Yeni ürün ekle","Edit Product":"Ürünü düzenle"},
  nl: {"My Wallet":"Mijn portemonnee","YOUR SALES BALANCE":"JE VERKOOPSALDO","You keep 100% of your verified sales.":"Je behoudt 100% van je geverifieerde verkopen.","Refresh wallet":"Portemonnee vernieuwen","Activity":"Activiteit","Transaction history":"Transactiegeschiedenis","No activity yet":"Nog geen activiteit","Verified sales will appear here.":"Geverifieerde verkopen verschijnen hier.","Request a payout":"Uitbetaling aanvragen","Amount (KSh)":"Bedrag (KSh)","Payout method":"Uitbetalingsmethode","PayPal email":"PayPal-e-mailadres","Submit request":"Verzoek verzenden","My Requests":"Mijn verzoeken","Awaiting review":"Wacht op beoordeling","My Shop":"Mijn winkel","Manage your shop and the products you sell.":"Beheer je winkel en de producten die je verkoopt.","Shop Details":"Winkelgegevens","Shop Name":"Winkelnaam","Shop Description":"Winkelbeschrijving","Save Shop Details":"Winkelgegevens opslaan","Shop subscription":"Winkelabonnement","Shop Orders":"Winkelbestellingen","My Products":"Mijn producten","No products yet":"Nog geen producten","Add Product":"Product toevoegen","Product Name":"Productnaam","Price (KSh)":"Prijs (KSh)","Stock Quantity":"Voorraadhoeveelheid","Product Image":"Productafbeelding","Product Category":"Productcategorie","Refresh Products":"Producten vernieuwen","Add a New Product":"Nieuw product toevoegen","Edit Product":"Product bewerken"},
  zh: {"My Wallet":"我的钱包","YOUR SALES BALANCE":"您的销售余额","You keep 100% of your verified sales.":"您保留已验证销售额的100%。","Refresh wallet":"刷新钱包","Activity":"活动","Transaction history":"交易记录","No activity yet":"暂无活动","Verified sales will appear here.":"已验证的销售将显示在这里。","Request a payout":"申请提现","Amount (KSh)":"金额 (KSh)","Payout method":"提现方式","PayPal email":"PayPal邮箱","Submit request":"提交申请","My Requests":"我的申请","Awaiting review":"等待审核","My Shop":"我的店铺","Manage your shop and the products you sell.":"管理您的店铺和所售商品。","Shop Details":"店铺详情","Shop Name":"店铺名称","Shop Description":"店铺描述","Save Shop Details":"保存店铺详情","Shop subscription":"店铺订阅","Shop Orders":"店铺订单","My Products":"我的商品","No products yet":"暂无商品","Add Product":"添加商品","Product Name":"商品名称","Price (KSh)":"价格 (KSh)","Stock Quantity":"库存数量","Product Image":"商品图片","Product Category":"商品类别","Refresh Products":"刷新商品","Add a New Product":"添加新商品","Edit Product":"编辑商品"},
  ja: {"My Wallet":"マイウォレット","YOUR SALES BALANCE":"売上残高","You keep 100% of your verified sales.":"確認済み売上の100%を受け取れます。","Refresh wallet":"ウォレットを更新","Activity":"アクティビティ","Transaction history":"取引履歴","No activity yet":"まだ履歴はありません","Verified sales will appear here.":"確認済みの売上がここに表示されます。","Request a payout":"出金を申請","Amount (KSh)":"金額 (KSh)","Payout method":"出金方法","PayPal email":"PayPalメールアドレス","Submit request":"申請する","My Requests":"申請一覧","Awaiting review":"確認待ち","My Shop":"マイショップ","Manage your shop and the products you sell.":"ショップと販売商品を管理します。","Shop Details":"ショップ詳細","Shop Name":"ショップ名","Shop Description":"ショップの説明","Save Shop Details":"ショップ情報を保存","Shop subscription":"ショップ購読","Shop Orders":"ショップ注文","My Products":"マイ商品","No products yet":"商品はまだありません","Add Product":"商品を追加","Product Name":"商品名","Price (KSh)":"価格 (KSh)","Stock Quantity":"在庫数","Product Image":"商品画像","Product Category":"商品カテゴリ","Refresh Products":"商品を更新","Add a New Product":"新しい商品を追加","Edit Product":"商品を編集"},
  ko: {"My Wallet":"내 지갑","YOUR SALES BALANCE":"판매 잔액","You keep 100% of your verified sales.":"확인된 판매액의 100%를 보유합니다.","Refresh wallet":"지갑 새로고침","Activity":"활동","Transaction history":"거래 내역","No activity yet":"아직 활동이 없습니다","Verified sales will appear here.":"확인된 판매가 여기에 표시됩니다.","Request a payout":"출금 요청","Amount (KSh)":"금액 (KSh)","Payout method":"출금 방법","PayPal email":"PayPal 이메일","Submit request":"요청 제출","My Requests":"내 요청","Awaiting review":"검토 대기 중","My Shop":"내 상점","Manage your shop and the products you sell.":"상점과 판매 상품을 관리하세요.","Shop Details":"상점 정보","Shop Name":"상점 이름","Shop Description":"상점 설명","Save Shop Details":"상점 정보 저장","Shop subscription":"상점 구독","Shop Orders":"상점 주문","My Products":"내 상품","No products yet":"아직 상품이 없습니다","Add Product":"상품 추가","Product Name":"상품명","Price (KSh)":"가격 (KSh)","Stock Quantity":"재고 수량","Product Image":"상품 이미지","Product Category":"상품 카테고리","Refresh Products":"상품 새로고침","Add a New Product":"새 상품 추가","Edit Product":"상품 수정"},
  hi: {"My Wallet":"मेरा वॉलेट","YOUR SALES BALANCE":"आपकी बिक्री शेष राशि","You keep 100% of your verified sales.":"आप अपनी सत्यापित बिक्री का 100% रखते हैं।","Refresh wallet":"वॉलेट रीफ़्रेश करें","Activity":"गतिविधि","Transaction history":"लेन-देन इतिहास","No activity yet":"अभी कोई गतिविधि नहीं","Verified sales will appear here.":"सत्यापित बिक्री यहाँ दिखाई देगी।","Request a payout":"भुगतान का अनुरोध करें","Amount (KSh)":"राशि (KSh)","Payout method":"भुगतान विधि","PayPal email":"PayPal ईमेल","Submit request":"अनुरोध भेजें","My Requests":"मेरे अनुरोध","Awaiting review":"समीक्षा की प्रतीक्षा","My Shop":"मेरी दुकान","Manage your shop and the products you sell.":"अपनी दुकान और बेचे जाने वाले उत्पादों का प्रबंधन करें।","Shop Details":"दुकान का विवरण","Shop Name":"दुकान का नाम","Shop Description":"दुकान का विवरण","Save Shop Details":"दुकान का विवरण सहेजें","Shop subscription":"दुकान सदस्यता","Shop Orders":"दुकान के ऑर्डर","My Products":"मेरे उत्पाद","No products yet":"अभी कोई उत्पाद नहीं","Add Product":"उत्पाद जोड़ें","Product Name":"उत्पाद का नाम","Price (KSh)":"कीमत (KSh)","Stock Quantity":"स्टॉक मात्रा","Product Image":"उत्पाद की तस्वीर","Product Category":"उत्पाद श्रेणी","Refresh Products":"उत्पाद रीफ़्रेश करें","Add a New Product":"नया उत्पाद जोड़ें","Edit Product":"उत्पाद संपादित करें"},
  ru: {"My Wallet":"Мой кошелёк","YOUR SALES BALANCE":"БАЛАНС ПРОДАЖ","You keep 100% of your verified sales.":"Вы получаете 100% подтверждённых продаж.","Refresh wallet":"Обновить кошелёк","Activity":"Активность","Transaction history":"История операций","No activity yet":"Пока нет активности","Verified sales will appear here.":"Подтверждённые продажи появятся здесь.","Request a payout":"Запросить выплату","Amount (KSh)":"Сумма (KSh)","Payout method":"Способ выплаты","PayPal email":"Электронная почта PayPal","Submit request":"Отправить запрос","My Requests":"Мои запросы","Awaiting review":"Ожидает проверки","My Shop":"Мой магазин","Manage your shop and the products you sell.":"Управляйте магазином и товарами.","Shop Details":"Данные магазина","Shop Name":"Название магазина","Shop Description":"Описание магазина","Save Shop Details":"Сохранить данные магазина","Shop subscription":"Подписка магазина","Shop Orders":"Заказы магазина","My Products":"Мои товары","No products yet":"Пока нет товаров","Add Product":"Добавить товар","Product Name":"Название товара","Price (KSh)":"Цена (KSh)","Stock Quantity":"Количество на складе","Product Image":"Изображение товара","Product Category":"Категория товара","Refresh Products":"Обновить товары","Add a New Product":"Добавить новый товар","Edit Product":"Изменить товар"},
  id: {"My Wallet":"Dompet saya","YOUR SALES BALANCE":"SALDO PENJUALAN ANDA","You keep 100% of your verified sales.":"Anda menerima 100% dari penjualan terverifikasi.","Refresh wallet":"Segarkan dompet","Activity":"Aktivitas","Transaction history":"Riwayat transaksi","No activity yet":"Belum ada aktivitas","Verified sales will appear here.":"Penjualan terverifikasi akan muncul di sini.","Request a payout":"Minta pencairan","Amount (KSh)":"Jumlah (KSh)","Payout method":"Metode pencairan","PayPal email":"Email PayPal","Submit request":"Kirim permintaan","My Requests":"Permintaan saya","Awaiting review":"Menunggu peninjauan","My Shop":"Toko saya","Manage your shop and the products you sell.":"Kelola toko dan produk yang Anda jual.","Shop Details":"Detail toko","Shop Name":"Nama toko","Shop Description":"Deskripsi toko","Save Shop Details":"Simpan detail toko","Shop subscription":"Langganan toko","Shop Orders":"Pesanan toko","My Products":"Produk saya","No products yet":"Belum ada produk","Add Product":"Tambah produk","Product Name":"Nama produk","Price (KSh)":"Harga (KSh)","Stock Quantity":"Jumlah stok","Product Image":"Gambar produk","Product Category":"Kategori produk","Refresh Products":"Segarkan produk","Add a New Product":"Tambah produk baru","Edit Product":"Edit produk"},
  ur: {"My Wallet":"میرا والیٹ","YOUR SALES BALANCE":"آپ کی فروخت کا بیلنس","You keep 100% of your verified sales.":"آپ اپنی تصدیق شدہ فروخت کا 100٪ رکھتے ہیں۔","Refresh wallet":"والیٹ تازہ کریں","Activity":"سرگرمی","Transaction history":"لین دین کی تاریخ","No activity yet":"ابھی کوئی سرگرمی نہیں","Verified sales will appear here.":"تصدیق شدہ فروخت یہاں دکھائی دے گی۔","Request a payout":"رقم نکلوانے کی درخواست","Amount (KSh)":"رقم (KSh)","Payout method":"ادائیگی کا طریقہ","PayPal email":"PayPal ای میل","Submit request":"درخواست جمع کریں","My Requests":"میری درخواستیں","Awaiting review":"جائزے کا انتظار","My Shop":"میری دکان","Manage your shop and the products you sell.":"اپنی دکان اور فروخت کی مصنوعات کا انتظام کریں۔","Shop Details":"دکان کی تفصیلات","Shop Name":"دکان کا نام","Shop Description":"دکان کی تفصیل","Save Shop Details":"دکان کی تفصیلات محفوظ کریں","Shop subscription":"دکان کی رکنیت","Shop Orders":"دکان کے آرڈرز","My Products":"میری مصنوعات","No products yet":"ابھی کوئی مصنوعات نہیں","Add Product":"مصنوعات شامل کریں","Product Name":"مصنوعات کا نام","Price (KSh)":"قیمت (KSh)","Stock Quantity":"اسٹاک کی مقدار","Product Image":"مصنوعات کی تصویر","Product Category":"مصنوعات کی قسم","Refresh Products":"مصنوعات تازہ کریں","Add a New Product":"نئی مصنوعات شامل کریں","Edit Product":"مصنوعات میں ترمیم"},
  fa: {"My Wallet":"کیف پول من","YOUR SALES BALANCE":"موجودی فروش شما","You keep 100% of your verified sales.":"۱۰۰٪ فروش تأییدشده برای شماست.","Refresh wallet":"به‌روزرسانی کیف پول","Activity":"فعالیت","Transaction history":"تاریخچه تراکنش‌ها","No activity yet":"هنوز فعالیتی وجود ندارد","Verified sales will appear here.":"فروش‌های تأییدشده اینجا نمایش داده می‌شوند.","Request a payout":"درخواست برداشت","Amount (KSh)":"مبلغ (KSh)","Payout method":"روش برداشت","PayPal email":"ایمیل PayPal","Submit request":"ارسال درخواست","My Requests":"درخواست‌های من","Awaiting review":"در انتظار بررسی","My Shop":"فروشگاه من","Manage your shop and the products you sell.":"فروشگاه و محصولات خود را مدیریت کنید.","Shop Details":"جزئیات فروشگاه","Shop Name":"نام فروشگاه","Shop Description":"توضیحات فروشگاه","Save Shop Details":"ذخیره جزئیات فروشگاه","Shop subscription":"اشتراک فروشگاه","Shop Orders":"سفارش‌های فروشگاه","My Products":"محصولات من","No products yet":"هنوز محصولی وجود ندارد","Add Product":"افزودن محصول","Product Name":"نام محصول","Price (KSh)":"قیمت (KSh)","Stock Quantity":"تعداد موجودی","Product Image":"تصویر محصول","Product Category":"دسته‌بندی محصول","Refresh Products":"به‌روزرسانی محصولات","Add a New Product":"افزودن محصول جدید","Edit Product":"ویرایش محصول"},
  ms: {"My Wallet":"Dompet saya","YOUR SALES BALANCE":"BAKI JUALAN ANDA","You keep 100% of your verified sales.":"Anda menyimpan 100% jualan yang disahkan.","Refresh wallet":"Segar semula dompet","Activity":"Aktiviti","Transaction history":"Sejarah transaksi","No activity yet":"Belum ada aktiviti","Verified sales will appear here.":"Jualan yang disahkan akan dipaparkan di sini.","Request a payout":"Minta pembayaran","Amount (KSh)":"Jumlah (KSh)","Payout method":"Kaedah pembayaran","PayPal email":"E-mel PayPal","Submit request":"Hantar permintaan","My Requests":"Permintaan saya","Awaiting review":"Menunggu semakan","My Shop":"Kedai saya","Manage your shop and the products you sell.":"Urus kedai dan produk yang anda jual.","Shop Details":"Butiran kedai","Shop Name":"Nama kedai","Shop Description":"Penerangan kedai","Save Shop Details":"Simpan butiran kedai","Shop subscription":"Langganan kedai","Shop Orders":"Pesanan kedai","My Products":"Produk saya","No products yet":"Belum ada produk","Add Product":"Tambah produk","Product Name":"Nama produk","Price (KSh)":"Harga (KSh)","Stock Quantity":"Kuantiti stok","Product Image":"Imej produk","Product Category":"Kategori produk","Refresh Products":"Segar semula produk","Add a New Product":"Tambah produk baharu","Edit Product":"Edit produk"},
  bn: {"My Wallet":"আমার ওয়ালেট","YOUR SALES BALANCE":"আপনার বিক্রির ব্যালেন্স","You keep 100% of your verified sales.":"আপনি যাচাইকৃত বিক্রির ১০০% পাবেন।","Refresh wallet":"ওয়ালেট রিফ্রেশ করুন","Activity":"কার্যকলাপ","Transaction history":"লেনদেনের ইতিহাস","No activity yet":"এখনও কোনো কার্যকলাপ নেই","Verified sales will appear here.":"যাচাইকৃত বিক্রি এখানে দেখা যাবে।","Request a payout":"পেমেন্টের অনুরোধ করুন","Amount (KSh)":"পরিমাণ (KSh)","Payout method":"পেমেন্ট পদ্ধতি","PayPal email":"PayPal ইমেইল","Submit request":"অনুরোধ জমা দিন","My Requests":"আমার অনুরোধ","Awaiting review":"পর্যালোচনার অপেক্ষায়","My Shop":"আমার দোকান","Manage your shop and the products you sell.":"আপনার দোকান ও বিক্রির পণ্য পরিচালনা করুন।","Shop Details":"দোকানের বিবরণ","Shop Name":"দোকানের নাম","Shop Description":"দোকানের বর্ণনা","Save Shop Details":"দোকানের বিবরণ সংরক্ষণ","Shop subscription":"দোকানের সাবস্ক্রিপশন","Shop Orders":"দোকানের অর্ডার","My Products":"আমার পণ্য","No products yet":"এখনও কোনো পণ্য নেই","Add Product":"পণ্য যোগ করুন","Product Name":"পণ্যের নাম","Price (KSh)":"দাম (KSh)","Stock Quantity":"মজুতের পরিমাণ","Product Image":"পণ্যের ছবি","Product Category":"পণ্যের বিভাগ","Refresh Products":"পণ্য রিফ্রেশ করুন","Add a New Product":"নতুন পণ্য যোগ করুন","Edit Product":"পণ্য সম্পাদনা"},
  am: {"My Wallet":"የእኔ ቦርሳ","YOUR SALES BALANCE":"የሽያጭ ቀሪ ሂሳብዎ","You keep 100% of your verified sales.":"ከተረጋገጠ ሽያጭዎ 100% ይይዛሉ።","Refresh wallet":"ቦርሳን አድስ","Activity":"እንቅስቃሴ","Transaction history":"የግብይት ታሪክ","No activity yet":"እስካሁን እንቅስቃሴ የለም","Verified sales will appear here.":"የተረጋገጡ ሽያጮች እዚህ ይታያሉ።","Request a payout":"ክፍያ ይጠይቁ","Amount (KSh)":"መጠን (KSh)","Payout method":"የክፍያ ዘዴ","PayPal email":"የPayPal ኢሜይል","Submit request":"ጥያቄ አስገባ","My Requests":"ጥያቄዎቼ","Awaiting review":"ግምገማ በመጠባበቅ ላይ","My Shop":"የእኔ መደብር","Manage your shop and the products you sell.":"መደብርዎንና የሚሸጧቸውን ምርቶች ያስተዳድሩ።","Shop Details":"የመደብር ዝርዝሮች","Shop Name":"የመደብር ስም","Shop Description":"የመደብር መግለጫ","Save Shop Details":"የመደብር ዝርዝሮችን አስቀምጥ","Shop subscription":"የመደብር ምዝገባ","Shop Orders":"የመደብር ትዕዛዞች","My Products":"ምርቶቼ","No products yet":"እስካሁን ምርቶች የሉም","Add Product":"ምርት ጨምር","Product Name":"የምርት ስም","Price (KSh)":"ዋጋ (KSh)","Stock Quantity":"የክምችት ብዛት","Product Image":"የምርት ምስል","Product Category":"የምርት ምድብ","Refresh Products":"ምርቶችን አድስ","Add a New Product":"አዲስ ምርት ጨምር","Edit Product":"ምርት አርትዕ"},
  ha: {"My Wallet":"Wallet dina","YOUR SALES BALANCE":"MA'AUNIN SALLAR KA","You keep 100% of your verified sales.":"Kana riƙe da kashi 100% na tallace-tallacen da aka tabbatar.","Refresh wallet":"Sabunta wallet","Activity":"Ayyuka","Transaction history":"Tarihin ma'amaloli","No activity yet":"Babu wani aiki tukuna","Verified sales will appear here.":"Tallace-tallacen da aka tabbatar za su bayyana a nan.","Request a payout":"Nemi biyan kuɗi","Amount (KSh)":"Adadi (KSh)","Payout method":"Hanyar biyan kuɗi","PayPal email":"Imel na PayPal","Submit request":"Aika buƙata","My Requests":"Buƙatuna","Awaiting review":"Ana jiran dubawa","My Shop":"Shagona","Manage your shop and the products you sell.":"Sarrafa shagonka da kayayyakin da kake sayarwa.","Shop Details":"Bayanin shago","Shop Name":"Sunan shago","Shop Description":"Bayanin shago","Save Shop Details":"Ajiye bayanin shago","Shop subscription":"Rajistar shago","Shop Orders":"Odar shago","My Products":"Kayayyakin nawa","No products yet":"Babu kayayyaki tukuna","Add Product":"Ƙara kaya","Product Name":"Sunan kaya","Price (KSh)":"Farashi (KSh)","Stock Quantity":"Adadin kaya","Product Image":"Hoton kaya","Product Category":"Rukunin kaya","Refresh Products":"Sabunta kayayyaki","Add a New Product":"Ƙara sabon kaya","Edit Product":"Gyara kaya"},
  yo: {"My Wallet":"Apamọwọ mi","YOUR SALES BALANCE":"ÌWỌ̀N TÍTÀ RẸ","You keep 100% of your verified sales.":"O gba 100% ti àwọn títà tí a fìdí rẹ̀ múlẹ̀.","Refresh wallet":"Tún apamọwọ ṣe","Activity":"Ìṣe","Transaction history":"Ìtàn ìṣòwò","No activity yet":"Kò sí ìṣe kankan síbẹ̀","Verified sales will appear here.":"Àwọn títà tí a fìdí rẹ̀ múlẹ̀ yóò hàn níbí.","Request a payout":"Béèrè ìsanwó","Amount (KSh)":"Iye (KSh)","Payout method":"Ọ̀nà ìsanwó","PayPal email":"Ímeèlì PayPal","Submit request":"Fi ìbéèrè ránṣẹ́","My Requests":"Àwọn ìbéèrè mi","Awaiting review":"Ń dúró de àyẹ̀wò","My Shop":"Ilé ìtajà mi","Manage your shop and the products you sell.":"Ṣàkóso ilé ìtajà rẹ àti àwọn ọjà tí o ń tà.","Shop Details":"Àlàyé ilé ìtajà","Shop Name":"Orúkọ ilé ìtajà","Shop Description":"Àpèjúwe ilé ìtajà","Save Shop Details":"Fi àlàyé pamọ́","Shop subscription":"Ìforúkọsílẹ̀ ilé ìtajà","Shop Orders":"Àṣẹ ilé ìtajà","My Products":"Àwọn ọjà mi","No products yet":"Kò sí ọjà kankan síbẹ̀","Add Product":"Fi ọjà kún un","Product Name":"Orúkọ ọjà","Price (KSh)":"Iye (KSh)","Stock Quantity":"Iye ọjà tó wà","Product Image":"Àwòrán ọjà","Product Category":"Ẹ̀ka ọjà","Refresh Products":"Tún àwọn ọjà ṣe","Add a New Product":"Fi ọjà tuntun kún un","Edit Product":"Ṣàtúnṣe ọjà"},
  th: {"My Wallet":"กระเป๋าเงินของฉัน","YOUR SALES BALANCE":"ยอดขายของคุณ","You keep 100% of your verified sales.":"คุณได้รับยอดขายที่ยืนยันแล้ว 100%","Refresh wallet":"รีเฟรชกระเป๋าเงิน","Activity":"กิจกรรม","Transaction history":"ประวัติธุรกรรม","No activity yet":"ยังไม่มีกิจกรรม","Verified sales will appear here.":"ยอดขายที่ยืนยันแล้วจะแสดงที่นี่","Request a payout":"ขอถอนเงิน","Amount (KSh)":"จำนวนเงิน (KSh)","Payout method":"วิธีรับเงิน","PayPal email":"อีเมล PayPal","Submit request":"ส่งคำขอ","My Requests":"คำขอของฉัน","Awaiting review":"รอการตรวจสอบ","My Shop":"ร้านค้าของฉัน","Manage your shop and the products you sell.":"จัดการร้านค้าและสินค้าที่คุณขาย","Shop Details":"รายละเอียดร้านค้า","Shop Name":"ชื่อร้านค้า","Shop Description":"คำอธิบายร้านค้า","Save Shop Details":"บันทึกรายละเอียดร้านค้า","Shop subscription":"การสมัครสมาชิกร้านค้า","Shop Orders":"คำสั่งซื้อของร้านค้า","My Products":"สินค้าของฉัน","No products yet":"ยังไม่มีสินค้า","Add Product":"เพิ่มสินค้า","Product Name":"ชื่อสินค้า","Price (KSh)":"ราคา (KSh)","Stock Quantity":"จำนวนสินค้าในคลัง","Product Image":"รูปสินค้า","Product Category":"หมวดหมู่สินค้า","Refresh Products":"รีเฟรชสินค้า","Add a New Product":"เพิ่มสินค้าใหม่","Edit Product":"แก้ไขสินค้า"},
  vi: {"My Wallet":"Ví của tôi","YOUR SALES BALANCE":"SỐ DƯ BÁN HÀNG","You keep 100% of your verified sales.":"Bạn giữ 100% doanh số đã xác minh.","Refresh wallet":"Làm mới ví","Activity":"Hoạt động","Transaction history":"Lịch sử giao dịch","No activity yet":"Chưa có hoạt động","Verified sales will appear here.":"Doanh số đã xác minh sẽ xuất hiện ở đây.","Request a payout":"Yêu cầu thanh toán","Amount (KSh)":"Số tiền (KSh)","Payout method":"Phương thức thanh toán","PayPal email":"Email PayPal","Submit request":"Gửi yêu cầu","My Requests":"Yêu cầu của tôi","Awaiting review":"Đang chờ xem xét","My Shop":"Cửa hàng của tôi","Manage your shop and the products you sell.":"Quản lý cửa hàng và sản phẩm bạn bán.","Shop Details":"Chi tiết cửa hàng","Shop Name":"Tên cửa hàng","Shop Description":"Mô tả cửa hàng","Save Shop Details":"Lưu chi tiết cửa hàng","Shop subscription":"Đăng ký cửa hàng","Shop Orders":"Đơn hàng cửa hàng","My Products":"Sản phẩm của tôi","No products yet":"Chưa có sản phẩm","Add Product":"Thêm sản phẩm","Product Name":"Tên sản phẩm","Price (KSh)":"Giá (KSh)","Stock Quantity":"Số lượng tồn kho","Product Image":"Hình ảnh sản phẩm","Product Category":"Danh mục sản phẩm","Refresh Products":"Làm mới sản phẩm","Add a New Product":"Thêm sản phẩm mới","Edit Product":"Chỉnh sửa sản phẩm"},
  pl: {"My Wallet":"Mój portfel","YOUR SALES BALANCE":"SALDO SPRZEDAŻY","You keep 100% of your verified sales.":"Zachowujesz 100% zweryfikowanej sprzedaży.","Refresh wallet":"Odśwież portfel","Activity":"Aktywność","Transaction history":"Historia transakcji","No activity yet":"Brak aktywności","Verified sales will appear here.":"Zweryfikowana sprzedaż pojawi się tutaj.","Request a payout":"Poproś o wypłatę","Amount (KSh)":"Kwota (KSh)","Payout method":"Metoda wypłaty","PayPal email":"E-mail PayPal","Submit request":"Wyślij prośbę","My Requests":"Moje prośby","Awaiting review":"Oczekuje na sprawdzenie","My Shop":"Mój sklep","Manage your shop and the products you sell.":"Zarządzaj sklepem i sprzedawanymi produktami.","Shop Details":"Szczegóły sklepu","Shop Name":"Nazwa sklepu","Shop Description":"Opis sklepu","Save Shop Details":"Zapisz szczegóły sklepu","Shop subscription":"Subskrypcja sklepu","Shop Orders":"Zamówienia sklepu","My Products":"Moje produkty","No products yet":"Brak produktów","Add Product":"Dodaj produkt","Product Name":"Nazwa produktu","Price (KSh)":"Cena (KSh)","Stock Quantity":"Ilość w magazynie","Product Image":"Zdjęcie produktu","Product Category":"Kategoria produktu","Refresh Products":"Odśwież produkty","Add a New Product":"Dodaj nowy produkt","Edit Product":"Edytuj produkt"},
  uk: {"My Wallet":"Мій гаманець","YOUR SALES BALANCE":"БАЛАНС ПРОДАЖІВ","You keep 100% of your verified sales.":"Ви отримуєте 100% підтверджених продажів.","Refresh wallet":"Оновити гаманець","Activity":"Активність","Transaction history":"Історія транзакцій","No activity yet":"Поки немає активності","Verified sales will appear here.":"Підтверджені продажі з’являться тут.","Request a payout":"Запросити виплату","Amount (KSh)":"Сума (KSh)","Payout method":"Спосіб виплати","PayPal email":"Електронна пошта PayPal","Submit request":"Надіслати запит","My Requests":"Мої запити","Awaiting review":"Очікує перевірки","My Shop":"Мій магазин","Manage your shop and the products you sell.":"Керуйте магазином і товарами, які продаєте.","Shop Details":"Дані магазину","Shop Name":"Назва магазину","Shop Description":"Опис магазину","Save Shop Details":"Зберегти дані магазину","Shop subscription":"Підписка магазину","Shop Orders":"Замовлення магазину","My Products":"Мої товари","No products yet":"Поки немає товарів","Add Product":"Додати товар","Product Name":"Назва товару","Price (KSh)":"Ціна (KSh)","Stock Quantity":"Кількість на складі","Product Image":"Зображення товару","Product Category":"Категорія товару","Refresh Products":"Оновити товари","Add a New Product":"Додати новий товар","Edit Product":"Редагувати товар"},
  el: {"My Wallet":"Το πορτοφόλι μου","YOUR SALES BALANCE":"ΥΠΟΛΟΙΠΟ ΠΩΛΗΣΕΩΝ","You keep 100% of your verified sales.":"Κρατάτε το 100% των επαληθευμένων πωλήσεών σας.","Refresh wallet":"Ανανέωση πορτοφολιού","Activity":"Δραστηριότητα","Transaction history":"Ιστορικό συναλλαγών","No activity yet":"Δεν υπάρχει δραστηριότητα ακόμη","Verified sales will appear here.":"Οι επαληθευμένες πωλήσεις θα εμφανίζονται εδώ.","Request a payout":"Αίτημα πληρωμής","Amount (KSh)":"Ποσό (KSh)","Payout method":"Μέθοδος πληρωμής","PayPal email":"Email PayPal","Submit request":"Υποβολή αιτήματος","My Requests":"Τα αιτήματά μου","Awaiting review":"Σε αναμονή ελέγχου","My Shop":"Το κατάστημά μου","Manage your shop and the products you sell.":"Διαχειριστείτε το κατάστημα και τα προϊόντα σας.","Shop Details":"Στοιχεία καταστήματος","Shop Name":"Όνομα καταστήματος","Shop Description":"Περιγραφή καταστήματος","Save Shop Details":"Αποθήκευση στοιχείων","Shop subscription":"Συνδρομή καταστήματος","Shop Orders":"Παραγγελίες καταστήματος","My Products":"Τα προϊόντα μου","No products yet":"Δεν υπάρχουν προϊόντα ακόμη","Add Product":"Προσθήκη προϊόντος","Product Name":"Όνομα προϊόντος","Price (KSh)":"Τιμή (KSh)","Stock Quantity":"Ποσότητα αποθέματος","Product Image":"Εικόνα προϊόντος","Product Category":"Κατηγορία προϊόντος","Refresh Products":"Ανανέωση προϊόντων","Add a New Product":"Προσθήκη νέου προϊόντος","Edit Product":"Επεξεργασία προϊόντος"},
  sv: {"My Wallet":"Min plånbok","YOUR SALES BALANCE":"DITT FÖRSÄLJNINGSSALDO","You keep 100% of your verified sales.":"Du behåller 100 % av din verifierade försäljning.","Refresh wallet":"Uppdatera plånboken","Activity":"Aktivitet","Transaction history":"Transaktionshistorik","No activity yet":"Ingen aktivitet ännu","Verified sales will appear here.":"Verifierad försäljning visas här.","Request a payout":"Begär utbetalning","Amount (KSh)":"Belopp (KSh)","Payout method":"Utbetalningsmetod","PayPal email":"PayPal-e-post","Submit request":"Skicka begäran","My Requests":"Mina förfrågningar","Awaiting review":"Väntar på granskning","My Shop":"Min butik","Manage your shop and the products you sell.":"Hantera din butik och produkterna du säljer.","Shop Details":"Butiksuppgifter","Shop Name":"Butiksnamn","Shop Description":"Butiksbeskrivning","Save Shop Details":"Spara butiksuppgifter","Shop subscription":"Butiksprenumeration","Shop Orders":"Butiksbeställningar","My Products":"Mina produkter","No products yet":"Inga produkter ännu","Add Product":"Lägg till produkt","Product Name":"Produktnamn","Price (KSh)":"Pris (KSh)","Stock Quantity":"Lagerantal","Product Image":"Produktbild","Product Category":"Produktkategori","Refresh Products":"Uppdatera produkter","Add a New Product":"Lägg till ny produkt","Edit Product":"Redigera produkt"}
};

const CORE_TRANSLATIONS: Record<string, Record<string, string>> = {
  so: {"Home":"Hoy","Login":"Gal","Register":"Isdiiwaangeli","Categories":"Qaybaha","See All":"Dhammaan eeg","Refresh":"Cusboonaysii","Add to cart":"Ku dar dambiisha","Your Cart":"Gaarigayga","Your cart is empty.":"Dambiishaadu waa madhan tahay.","Total":"Wadarta","My Account":"Akoonkayga","My Shop":"Dukaankayga","My Orders":"Dalabyadayda","My Favorites":"Waxyaabaha aan jeclahay","Search sweets...":"Raadi macmacaan...","Password":"Furaha sirta ah","Email address":"Cinwaanka iimaylka","Full name":"Magaca oo buuxa","Seller":"Iibiye","Customer":"Macaamiil","Edit":"Wax ka beddel","Delete":"Tirtir","Save Changes":"Kaydi isbeddellada","Cancel Editing":"Jooji wax ka beddelka","Description":"Sharaxaad","Stock":"Kaydka","Payment Method":"Habka lacag-bixinta","Secure Payment":"Lacag-bixin ammaan ah","Shop Status":"Xaaladda dukaanka","Sweet Deals":"Dalabyo Macaan","Discover sweets you will love":"Soo hel macmacaan aad jeclaan doonto","Shop Now":"Hadda Iibso","Popular Products":"Alaabooyinka Caanka ah","No products found yet.":"Weli wax alaab ah lama helin.","Welcome back":"Ku soo dhawoow","Create your account":"Samee akoonkaaga","Already have an account?":"Hore akoon ma u leedahay?"},
  ar: {"Home":"الرئيسية","Login":"تسجيل الدخول","Register":"إنشاء حساب","Categories":"الفئات","See All":"عرض الكل","Refresh":"تحديث","Add to cart":"أضف إلى السلة","Your Cart":"سلة التسوق","Your cart is empty.":"سلتك فارغة.","Total":"الإجمالي","My Account":"حسابي","My Shop":"متجري","My Orders":"طلباتي","My Favorites":"المفضلة","Search sweets...":"ابحث عن الحلويات...","Password":"كلمة المرور","Email address":"البريد الإلكتروني","Full name":"الاسم الكامل","Seller":"بائع","Customer":"عميل","Edit":"تعديل","Delete":"حذف","Save Changes":"حفظ التغييرات","Cancel Editing":"إلغاء التعديل","Description":"الوصف","Stock":"المخزون","Payment Method":"طريقة الدفع","Secure Payment":"دفع آمن","Shop Status":"حالة المتجر","Sweet Deals":"عروض حلوة","Discover sweets you will love":"اكتشف حلويات ستحبها","Shop Now":"تسوق الآن","Popular Products":"المنتجات الشائعة","No products found yet.":"لم يتم العثور على منتجات بعد.","Welcome back":"مرحبًا بعودتك","Create your account":"أنشئ حسابك","Already have an account?":"هل لديك حساب بالفعل؟"},
  sw: {"Home":"Nyumbani","Login":"Ingia","Register":"Jisajili","Categories":"Aina","See All":"Tazama zote","Refresh":"Onyesha upya","Add to cart":"Ongeza kwenye kikapu","Your Cart":"Kikapu changu","Your cart is empty.":"Kikapu chako hakina kitu.","Total":"Jumla","My Account":"Akaunti yangu","My Shop":"Duka langu","My Orders":"Maagizo yangu","My Favorites":"Vipendwa vyangu","Search sweets...":"Tafuta vitamu...","Password":"Nenosiri","Email address":"Barua pepe","Full name":"Jina kamili","Seller":"Muuzaji","Customer":"Mteja","Edit":"Hariri","Delete":"Futa","Save Changes":"Hifadhi mabadiliko","Cancel Editing":"Ghairi kuhariri","Description":"Maelezo","Stock":"Hisa","Payment Method":"Njia ya malipo","Secure Payment":"Malipo salama","Shop Status":"Hali ya duka","Sweet Deals":"Ofa za Punguzo","Discover sweets you will love":"Gundua vitamu utakavyovipenda","Shop Now":"Nunua Sasa","Popular Products":"Bidhaa Maarufu","No products found yet.":"Hakuna bidhaa zilizopatikana bado.","Welcome back":"Karibu tena","Create your account":"Fungua akaunti yako","Already have an account?":"Tayari una akaunti?"},
  fr: {"Home":"Accueil","Login":"Connexion","Register":"S’inscrire","Categories":"Catégories","See All":"Tout voir","Refresh":"Actualiser","Add to cart":"Ajouter au panier","Your Cart":"Mon panier","Your cart is empty.":"Votre panier est vide.","Total":"Total","My Account":"Mon compte","My Shop":"Ma boutique","My Orders":"Mes commandes","My Favorites":"Mes favoris","Search sweets...":"Rechercher des douceurs...","Password":"Mot de passe","Email address":"Adresse e-mail","Full name":"Nom complet","Seller":"Vendeur","Customer":"Client","Edit":"Modifier","Delete":"Supprimer","Save Changes":"Enregistrer","Cancel Editing":"Annuler la modification","Description":"Description","Stock":"Stock","Payment Method":"Mode de paiement","Secure Payment":"Paiement sécurisé","Shop Status":"Statut de la boutique","Sweet Deals":"Offres gourmandes","Discover sweets you will love":"Découvrez des douceurs que vous allez aimer","Shop Now":"Acheter maintenant","Popular Products":"Produits populaires","No products found yet.":"Aucun produit trouvé pour le moment.","Welcome back":"Bon retour","Create your account":"Créez votre compte","Already have an account?":"Vous avez déjà un compte ?"},
  es: {"Home":"Inicio","Login":"Iniciar sesión","Register":"Registrarse","Categories":"Categorías","See All":"Ver todo","Refresh":"Actualizar","Add to cart":"Añadir al carrito","Your Cart":"Mi carrito","Your cart is empty.":"Tu carrito está vacío.","Total":"Total","My Account":"Mi cuenta","My Shop":"Mi tienda","My Orders":"Mis pedidos","My Favorites":"Mis favoritos","Search sweets...":"Buscar dulces...","Password":"Contraseña","Email address":"Correo electrónico","Full name":"Nombre completo","Seller":"Vendedor","Customer":"Cliente","Edit":"Editar","Delete":"Eliminar","Save Changes":"Guardar cambios","Cancel Editing":"Cancelar edición","Description":"Descripción","Stock":"Existencias","Payment Method":"Método de pago","Secure Payment":"Pago seguro","Shop Status":"Estado de la tienda","Sweet Deals":"Ofertas dulces","Discover sweets you will love":"Descubre dulces que te encantarán","Shop Now":"Comprar ahora","Popular Products":"Productos populares","No products found yet.":"Aún no se encontraron productos.","Welcome back":"Bienvenido de nuevo","Create your account":"Crea tu cuenta","Already have an account?":"¿Ya tienes una cuenta?"},
  de: {"Home":"Startseite","Login":"Anmelden","Register":"Registrieren","Categories":"Kategorien","See All":"Alle anzeigen","Refresh":"Aktualisieren","Add to cart":"In den Warenkorb","Your Cart":"Mein Warenkorb","Your cart is empty.":"Dein Warenkorb ist leer.","Total":"Gesamt","My Account":"Mein Konto","My Shop":"Mein Shop","My Orders":"Meine Bestellungen","My Favorites":"Meine Favoriten","Search sweets...":"Süßes suchen...","Password":"Passwort","Email address":"E-Mail-Adresse","Full name":"Vollständiger Name","Seller":"Verkäufer","Customer":"Kunde","Edit":"Bearbeiten","Delete":"Löschen","Save Changes":"Änderungen speichern","Cancel Editing":"Bearbeiten abbrechen","Description":"Beschreibung","Stock":"Bestand","Payment Method":"Zahlungsmethode","Secure Payment":"Sichere Zahlung","Shop Status":"Shop-Status","Sweet Deals":"Süße Angebote","Discover sweets you will love":"Entdecken Sie Süßigkeiten, die Sie lieben werden","Shop Now":"Jetzt einkaufen","Popular Products":"Beliebte Produkte","No products found yet.":"Noch keine Produkte gefunden.","Welcome back":"Willkommen zurück","Create your account":"Erstellen Sie Ihr Konto","Already have an account?":"Haben Sie bereits ein Konto?"},
  it: {"Home":"Home","Login":"Accedi","Register":"Registrati","Categories":"Categorie","See All":"Vedi tutto","Refresh":"Aggiorna","Add to cart":"Aggiungi al carrello","Your Cart":"Il mio carrello","Your cart is empty.":"Il carrello è vuoto.","Total":"Totale","My Account":"Il mio account","My Shop":"Il mio negozio","My Orders":"I miei ordini","My Favorites":"I miei preferiti","Search sweets...":"Cerca dolci...","Password":"Password","Email address":"Indirizzo email","Full name":"Nome completo","Seller":"Venditore","Customer":"Cliente","Edit":"Modifica","Delete":"Elimina","Save Changes":"Salva modifiche","Cancel Editing":"Annulla modifica","Description":"Descrizione","Stock":"Scorte","Payment Method":"Metodo di pagamento","Secure Payment":"Pagamento sicuro","Shop Status":"Stato del negozio","Sweet Deals":"Offerte dolci","Discover sweets you will love":"Scopri i dolci che amerai","Shop Now":"Acquista ora","Popular Products":"Prodotti popolari","No products found yet.":"Nessun prodotto trovato per ora.","Welcome back":"Bentornato","Create your account":"Crea il tuo account","Already have an account?":"Hai già un account?"},
  pt: {"Home":"Início","Login":"Entrar","Register":"Cadastrar","Categories":"Categorias","See All":"Ver tudo","Refresh":"Atualizar","Add to cart":"Adicionar ao carrinho","Your Cart":"Meu carrinho","Your cart is empty.":"Seu carrinho está vazio.","Total":"Total","My Account":"Minha conta","My Shop":"Minha loja","My Orders":"Meus pedidos","My Favorites":"Meus favoritos","Search sweets...":"Buscar doces...","Password":"Senha","Email address":"Endereço de e-mail","Full name":"Nome completo","Seller":"Vendedor","Customer":"Cliente","Edit":"Editar","Delete":"Excluir","Save Changes":"Salvar alterações","Cancel Editing":"Cancelar edição","Description":"Descrição","Stock":"Estoque","Payment Method":"Forma de pagamento","Secure Payment":"Pagamento seguro","Shop Status":"Status da loja","Sweet Deals":"Ofertas doces","Discover sweets you will love":"Descubra doces que você vai adorar","Shop Now":"Comprar agora","Popular Products":"Produtos populares","No products found yet.":"Nenhum produto encontrado ainda.","Welcome back":"Bem-vindo de volta","Create your account":"Crie sua conta","Already have an account?":"Já tem uma conta?"},
  tr: {"Home":"Ana sayfa","Login":"Giriş yap","Register":"Kayıt ol","Categories":"Kategoriler","See All":"Tümünü gör","Refresh":"Yenile","Add to cart":"Sepete ekle","Your Cart":"Sepetim","Your cart is empty.":"Sepetiniz boş.","Total":"Toplam","My Account":"Hesabım","My Shop":"Mağazam","My Orders":"Siparişlerim","My Favorites":"Favorilerim","Search sweets...":"Tatlı ara...","Password":"Şifre","Email address":"E-posta adresi","Full name":"Ad soyad","Seller":"Satıcı","Customer":"Müşteri","Edit":"Düzenle","Delete":"Sil","Save Changes":"Değişiklikleri kaydet","Cancel Editing":"Düzenlemeyi iptal et","Description":"Açıklama","Stock":"Stok","Payment Method":"Ödeme yöntemi","Secure Payment":"Güvenli ödeme","Shop Status":"Mağaza durumu","Sweet Deals":"Tatlı Fırsatlar","Discover sweets you will love":"Seveceğiniz tatlıları keşfedin","Shop Now":"Şimdi Alışveriş Yap","Popular Products":"Popüler Ürünler","No products found yet.":"Henüz ürün bulunamadı.","Welcome back":"Tekrar hoş geldiniz","Create your account":"Hesabınızı oluşturun","Already have an account?":"Zaten hesabınız var mı?"},
  id: {"Home":"Beranda","Login":"Masuk","Register":"Daftar","Categories":"Kategori","See All":"Lihat semua","Refresh":"Muat ulang","Add to cart":"Tambah ke keranjang","Your Cart":"Keranjang saya","Your cart is empty.":"Keranjang Anda kosong.","Total":"Total","My Account":"Akun saya","My Shop":"Toko saya","My Orders":"Pesanan saya","My Favorites":"Favorit saya","Search sweets...":"Cari makanan manis...","Password":"Kata sandi","Email address":"Alamat email","Full name":"Nama lengkap","Seller":"Penjual","Customer":"Pelanggan","Edit":"Edit","Delete":"Hapus","Save Changes":"Simpan perubahan","Cancel Editing":"Batalkan edit","Description":"Deskripsi","Stock":"Stok","Payment Method":"Metode pembayaran","Secure Payment":"Pembayaran aman","Shop Status":"Status toko","Sweet Deals":"Promo Manis","Discover sweets you will love":"Temukan camilan manis yang Anda sukai","Shop Now":"Belanja Sekarang","Popular Products":"Produk Populer","No products found yet.":"Belum ada produk ditemukan.","Welcome back":"Selamat datang kembali","Create your account":"Buat akun Anda","Already have an account?":"Sudah punya akun?"},
  nl: {"Home":"Startpagina","Login":"Inloggen","Register":"Registreren","Categories":"Categorieën","See All":"Alles bekijken","Refresh":"Vernieuwen","Add to cart":"Toevoegen aan winkelwagen","Your Cart":"Mijn winkelwagen","Your cart is empty.":"Je winkelwagen is leeg.","Total":"Totaal","My Account":"Mijn account","My Shop":"Mijn winkel","My Orders":"Mijn bestellingen","My Favorites":"Mijn favorieten","Search sweets...":"Zoek zoetigheden...","Password":"Wachtwoord","Email address":"E-mailadres","Full name":"Volledige naam","Seller":"Verkoper","Customer":"Klant","Edit":"Bewerken","Delete":"Verwijderen","Save Changes":"Wijzigingen opslaan","Cancel Editing":"Bewerken annuleren","Description":"Beschrijving","Stock":"Voorraad","Payment Method":"Betaalmethode","Secure Payment":"Veilig betalen","Shop Status":"Winkelstatus","Sweet Deals":"Zoete aanbiedingen","Discover sweets you will love":"Ontdek lekkernijen waar je van zult houden","Shop Now":"Shop nu","Popular Products":"Populaire producten","No products found yet.":"Nog geen producten gevonden.","Welcome back":"Welkom terug","Create your account":"Maak je account aan","Already have an account?":"Heb je al een account?"},
  zh: {"Home":"首页","Login":"登录","Register":"注册","Categories":"分类","See All":"查看全部","Refresh":"刷新","Add to cart":"加入购物车","Your Cart":"我的购物车","Your cart is empty.":"购物车为空。","Total":"总计","My Account":"我的账户","My Shop":"我的店铺","My Orders":"我的订单","My Favorites":"我的收藏","Search sweets...":"搜索甜品...","Password":"密码","Email address":"电子邮箱","Full name":"全名","Seller":"卖家","Customer":"顾客","Edit":"编辑","Delete":"删除","Save Changes":"保存更改","Cancel Editing":"取消编辑","Description":"描述","Stock":"库存","Payment Method":"付款方式","Secure Payment":"安全支付","Shop Status":"店铺状态","Sweet Deals":"甜蜜优惠","Discover sweets you will love":"发现你会喜欢的甜品","Shop Now":"立即购物","Popular Products":"热门商品","No products found yet.":"暂未找到商品。","Welcome back":"欢迎回来","Create your account":"创建您的账户","Already have an account?":"已经有账户了吗？"},
  ja: {"Home":"ホーム","Login":"ログイン","Register":"登録","Categories":"カテゴリー","See All":"すべて見る","Refresh":"更新","Add to cart":"カートに追加","Your Cart":"カート","Your cart is empty.":"カートは空です。","Total":"合計","My Account":"マイアカウント","My Shop":"マイショップ","My Orders":"注文履歴","My Favorites":"お気に入り","Search sweets...":"スイーツを検索...","Password":"パスワード","Email address":"メールアドレス","Full name":"氏名","Seller":"販売者","Customer":"お客様","Edit":"編集","Delete":"削除","Save Changes":"変更を保存","Cancel Editing":"編集をキャンセル","Description":"説明","Stock":"在庫","Payment Method":"支払い方法","Secure Payment":"安全な決済","Shop Status":"ショップの状態","Sweet Deals":"スイーツのお得情報","Discover sweets you will love":"お気に入りのスイーツを見つけましょう","Shop Now":"今すぐ購入","Popular Products":"人気商品","No products found yet.":"商品はまだありません。","Welcome back":"お帰りなさい","Create your account":"アカウントを作成","Already have an account?":"すでにアカウントをお持ちですか？"},
  ko: {"Home":"홈","Login":"로그인","Register":"가입하기","Categories":"카테고리","See All":"모두 보기","Refresh":"새로고침","Add to cart":"장바구니에 담기","Your Cart":"내 장바구니","Your cart is empty.":"장바구니가 비어 있습니다.","Total":"합계","My Account":"내 계정","My Shop":"내 상점","My Orders":"내 주문","My Favorites":"즐겨찾기","Search sweets...":"달콤한 상품 검색...","Password":"비밀번호","Email address":"이메일 주소","Full name":"이름","Seller":"판매자","Customer":"고객","Edit":"수정","Delete":"삭제","Save Changes":"변경 사항 저장","Cancel Editing":"편집 취소","Description":"설명","Stock":"재고","Payment Method":"결제 방법","Secure Payment":"안전한 결제","Shop Status":"상점 상태","Sweet Deals":"달콤한 특가","Discover sweets you will love":"마음에 드는 디저트를 찾아보세요","Shop Now":"지금 쇼핑하기","Popular Products":"인기 상품","No products found yet.":"아직 상품이 없습니다.","Welcome back":"다시 오신 것을 환영합니다","Create your account":"계정을 만드세요","Already have an account?":"이미 계정이 있으신가요?"},
  hi: {"Home":"होम","Login":"लॉग इन","Register":"रजिस्टर करें","Categories":"श्रेणियाँ","See All":"सभी देखें","Refresh":"रीफ़्रेश","Add to cart":"कार्ट में जोड़ें","Your Cart":"मेरा कार्ट","Your cart is empty.":"आपका कार्ट खाली है।","Total":"कुल","My Account":"मेरा खाता","My Shop":"मेरी दुकान","My Orders":"मेरे ऑर्डर","My Favorites":"मेरी पसंद","Search sweets...":"मिठाइयाँ खोजें...","Password":"पासवर्ड","Email address":"ईमेल पता","Full name":"पूरा नाम","Seller":"विक्रेता","Customer":"ग्राहक","Edit":"संपादित करें","Delete":"हटाएँ","Save Changes":"बदलाव सहेजें","Cancel Editing":"संपादन रद्द करें","Description":"विवरण","Stock":"स्टॉक","Payment Method":"भुगतान का तरीका","Secure Payment":"सुरक्षित भुगतान","Shop Status":"दुकान की स्थिति","Sweet Deals":"मीठे ऑफ़र","Discover sweets you will love":"ऐसी मिठाइयाँ खोजें जो आपको पसंद आएँगी","Shop Now":"अभी खरीदें","Popular Products":"लोकप्रिय उत्पाद","No products found yet.":"अभी तक कोई उत्पाद नहीं मिला।","Welcome back":"वापसी पर स्वागत है","Create your account":"अपना खाता बनाएँ","Already have an account?":"क्या आपका पहले से खाता है?"},
  ru: {"Home":"Главная","Login":"Войти","Register":"Регистрация","Categories":"Категории","See All":"Смотреть все","Refresh":"Обновить","Add to cart":"В корзину","Your Cart":"Корзина","Your cart is empty.":"Ваша корзина пуста.","Total":"Итого","My Account":"Мой аккаунт","My Shop":"Мой магазин","My Orders":"Мои заказы","My Favorites":"Избранное","Search sweets...":"Поиск сладостей...","Password":"Пароль","Email address":"Электронная почта","Full name":"Полное имя","Seller":"Продавец","Customer":"Покупатель","Edit":"Изменить","Delete":"Удалить","Save Changes":"Сохранить изменения","Cancel Editing":"Отменить редактирование","Description":"Описание","Stock":"Запас","Payment Method":"Способ оплаты","Secure Payment":"Безопасная оплата","Shop Status":"Статус магазина","Sweet Deals":"Сладкие предложения","Discover sweets you will love":"Откройте для себя сладости, которые вам понравятся","Shop Now":"Купить сейчас","Popular Products":"Популярные товары","No products found yet.":"Товары пока не найдены.","Welcome back":"С возвращением","Create your account":"Создайте аккаунт","Already have an account?":"Уже есть аккаунт?"},
  ur: {"Home":"ہوم","Login":"لاگ اِن","Register":"رجسٹر کریں","Categories":"اقسام","See All":"سب دیکھیں","Refresh":"ریفریش","Add to cart":"کارٹ میں شامل کریں","Your Cart":"میری ٹوکری","Your cart is empty.":"آپ کی ٹوکری خالی ہے۔","Total":"کل","My Account":"میرا اکاؤنٹ","My Shop":"میری دکان","My Orders":"میرے آرڈرز","My Favorites":"پسندیدہ","Search sweets...":"مٹھائیاں تلاش کریں...","Password":"پاس ورڈ","Email address":"ای میل ایڈریس","Full name":"پورا نام","Seller":"فروخت کنندہ","Customer":"گاہک","Edit":"ترمیم","Delete":"حذف کریں","Save Changes":"تبدیلیاں محفوظ کریں","Cancel Editing":"ترمیم منسوخ کریں","Description":"تفصیل","Stock":"اسٹاک","Payment Method":"ادائیگی کا طریقہ","Secure Payment":"محفوظ ادائیگی","Shop Status":"دکان کی حالت","Sweet Deals":"میٹھی پیشکشیں","Discover sweets you will love":"اپنی پسندیدہ مٹھائیاں دریافت کریں","Shop Now":"ابھی خریدیں","Popular Products":"مقبول مصنوعات","No products found yet.":"ابھی تک کوئی پروڈکٹ نہیں ملی۔","Welcome back":"واپس آنے پر خوش آمدید","Create your account":"اپنا اکاؤنٹ بنائیں","Already have an account?":"کیا آپ کا پہلے سے اکاؤنٹ ہے؟"},
  fa: {"Home":"خانه","Login":"ورود","Register":"ثبت‌نام","Categories":"دسته‌بندی‌ها","See All":"مشاهده همه","Refresh":"تازه‌سازی","Add to cart":"افزودن به سبد","Your Cart":"سبد خرید من","Your cart is empty.":"سبد خرید شما خالی است.","Total":"مجموع","My Account":"حساب من","My Shop":"فروشگاه من","My Orders":"سفارش‌های من","My Favorites":"علاقه‌مندی‌ها","Search sweets...":"جستجوی شیرینی...","Password":"رمز عبور","Email address":"ایمیل","Full name":"نام کامل","Seller":"فروشنده","Customer":"مشتری","Edit":"ویرایش","Delete":"حذف","Save Changes":"ذخیره تغییرات","Cancel Editing":"لغو ویرایش","Description":"توضیحات","Stock":"موجودی","Payment Method":"روش پرداخت","Secure Payment":"پرداخت امن","Shop Status":"وضعیت فروشگاه","Sweet Deals":"پیشنهادهای شیرین","Discover sweets you will love":"شیرینی‌هایی را کشف کنید که دوست خواهید داشت","Shop Now":"اکنون خرید کنید","Popular Products":"محصولات محبوب","No products found yet.":"هنوز محصولی یافت نشد.","Welcome back":"خوش آمدید","Create your account":"حساب خود را ایجاد کنید","Already have an account?":"از قبل حساب دارید؟"},
  ms: {"Home":"Laman utama","Login":"Log masuk","Register":"Daftar","Categories":"Kategori","See All":"Lihat semua","Refresh":"Muat semula","Add to cart":"Tambah ke troli","Your Cart":"Troli saya","Your cart is empty.":"Troli anda kosong.","Total":"Jumlah","My Account":"Akaun saya","My Shop":"Kedai saya","My Orders":"Pesanan saya","My Favorites":"Kegemaran saya","Search sweets...":"Cari manisan...","Password":"Kata laluan","Email address":"Alamat e-mel","Full name":"Nama penuh","Seller":"Penjual","Customer":"Pelanggan","Edit":"Edit","Delete":"Padam","Save Changes":"Simpan perubahan","Cancel Editing":"Batal suntingan","Description":"Penerangan","Stock":"Stok","Payment Method":"Kaedah pembayaran","Secure Payment":"Pembayaran selamat","Shop Status":"Status kedai","Sweet Deals":"Tawaran Manis","Discover sweets you will love":"Temui manisan yang pasti anda suka","Shop Now":"Beli Sekarang","Popular Products":"Produk Popular","No products found yet.":"Tiada produk ditemui lagi.","Welcome back":"Selamat kembali","Create your account":"Cipta akaun anda","Already have an account?":"Sudah mempunyai akaun?"},
  bn: {"Home":"হোম","Login":"লগইন","Register":"নিবন্ধন","Categories":"বিভাগ","See All":"সব দেখুন","Refresh":"রিফ্রেশ","Add to cart":"কার্টে যোগ করুন","Your Cart":"আমার কার্ট","Your cart is empty.":"আপনার কার্ট খালি।","Total":"মোট","My Account":"আমার অ্যাকাউন্ট","My Shop":"আমার দোকান","My Orders":"আমার অর্ডার","My Favorites":"প্রিয়","Search sweets...":"মিষ্টি খুঁজুন...","Password":"পাসওয়ার্ড","Email address":"ইমেইল ঠিকানা","Full name":"পুরো নাম","Seller":"বিক্রেতা","Customer":"ক্রেতা","Edit":"সম্পাদনা","Delete":"মুছুন","Save Changes":"পরিবর্তন সংরক্ষণ","Cancel Editing":"সম্পাদনা বাতিল","Description":"বর্ণনা","Stock":"মজুত","Payment Method":"পেমেন্ট পদ্ধতি","Secure Payment":"নিরাপদ পেমেন্ট","Shop Status":"দোকানের অবস্থা","Sweet Deals":"মিষ্টি অফার","Discover sweets you will love":"আপনার পছন্দের মিষ্টি খুঁজে নিন","Shop Now":"এখনই কিনুন","Popular Products":"জনপ্রিয় পণ্য","No products found yet.":"এখনও কোনো পণ্য পাওয়া যায়নি।","Welcome back":"ফিরে আসায় স্বাগতম","Create your account":"আপনার অ্যাকাউন্ট তৈরি করুন","Already have an account?":"আপনার কি আগে থেকেই অ্যাকাউন্ট আছে?"},
  am: {"Home":"መነሻ","Login":"ግባ","Register":"ይመዝገቡ","Categories":"ምድቦች","See All":"ሁሉንም ይመልከቱ","Refresh":"አድስ","Add to cart":"ወደ ጋሪ ጨምር","Your Cart":"የእኔ ጋሪ","Your cart is empty.":"ጋሪዎ ባዶ ነው።","Total":"ጠቅላላ","My Account":"የእኔ መለያ","My Shop":"የእኔ ሱቅ","My Orders":"ትዕዛዞቼ","My Favorites":"ተወዳጆቼ","Search sweets...":"ጣፋጮችን ፈልግ...","Password":"የይለፍ ቃል","Email address":"ኢሜይል","Full name":"ሙሉ ስም","Seller":"ሻጭ","Customer":"ደንበኛ","Edit":"አርትዕ","Delete":"ሰርዝ","Save Changes":"ለውጦችን አስቀምጥ","Cancel Editing":"አርትዕን ሰርዝ","Description":"መግለጫ","Stock":"ክምችት","Payment Method":"የክፍያ ዘዴ","Secure Payment":"ደህንነቱ የተጠበቀ ክፍያ","Shop Status":"የሱቅ ሁኔታ","Sweet Deals":"ጣፋጭ ቅናሾች","Discover sweets you will love":"የሚወዷቸውን ጣፋጮች ያግኙ","Shop Now":"አሁን ይግዙ","Popular Products":"ተወዳጅ ምርቶች","No products found yet.":"እስካሁን ምንም ምርት አልተገኘም።","Welcome back":"እንኳን በደህና ተመለሱ","Create your account":"መለያዎን ይፍጠሩ","Already have an account?":"አስቀድመው መለያ አለዎት?"},
  ha: {"Home":"Gida","Login":"Shiga","Register":"Yi rajista","Categories":"Rukuni","See All":"Duba duka","Refresh":"Sabunta","Add to cart":"Ƙara a kwando","Your Cart":"Kwandonka","Your cart is empty.":"Kwandonka babu komai.","Total":"Jimilla","My Account":"Asusuna","My Shop":"Shagona","My Orders":"Oda na","My Favorites":"Abubuwan so","Search sweets...":"Nemo kayan zaƙi...","Password":"Kalmar sirri","Email address":"Adireshin imel","Full name":"Cikakken suna","Seller":"Mai sayarwa","Customer":"Abokin ciniki","Edit":"Gyara","Delete":"Share","Save Changes":"Ajiye canje-canje","Cancel Editing":"Soke gyara","Description":"Bayani","Stock":"Haja","Payment Method":"Hanyar biya","Secure Payment":"Biya mai tsaro","Shop Status":"Matsayin shago","Sweet Deals":"Rangwamen Zaƙi","Discover sweets you will love":"Gano kayan zaƙi da za ka so","Shop Now":"Sayi Yanzu","Popular Products":"Shahararrun Kaya","No products found yet.":"Ba a sami kaya ba tukuna.","Welcome back":"Barka da dawowa","Create your account":"Ƙirƙiri asusunka","Already have an account?":"Kana da asusu tuni?"},
  yo: {"Home":"Ilé","Login":"Wọlé","Register":"Forúkọ sílẹ̀","Categories":"Àwọn ẹ̀ka","See All":"Wo gbogbo rẹ̀","Refresh":"Tún ṣe","Add to cart":"Fi kún àpò","Your Cart":"Àpò mi","Your cart is empty.":"Àpò rẹ ṣófo.","Total":"Àpapọ̀","My Account":"Àkọọ́lẹ̀ mi","My Shop":"Ṣọ́ọ̀bù mi","My Orders":"Àwọn àṣẹ mi","My Favorites":"Àwọn ayanfẹ́ mi","Search sweets...":"Wá àwọn adùn...","Password":"Ọ̀rọ̀ aṣínà","Email address":"Àdírẹ́sì í-meèlì","Full name":"Orúkọ kíkún","Seller":"Olùtajà","Customer":"Oníbàárà","Edit":"Ṣàtúnṣe","Delete":"Paarẹ́","Save Changes":"Fi ìyípadà pamọ́","Cancel Editing":"Fagilé àtúnṣe","Description":"Àpèjúwe","Stock":"Ọjà tó wà","Payment Method":"Ọ̀nà ìsanwó","Secure Payment":"Ìsanwó tó ní ààbò","Shop Status":"Ipò ṣọ́ọ̀bù","Sweet Deals":"Àwọn Àǹfààní Adùn","Discover sweets you will love":"Ṣàwárí àwọn adùn tí wàá fẹ́ràn","Shop Now":"Ràn Ní Báyìí","Popular Products":"Àwọn Ọjà Gbajúmọ̀","No products found yet.":"A kò tíì rí ọjà kankan.","Welcome back":"Ẹ kú àbọ̀ padà","Create your account":"Ṣẹ̀dá àkọọ́lẹ̀ rẹ","Already have an account?":"Ṣé o ti ní àkọọ́lẹ̀ tẹ́lẹ̀?"},
  th: {"Home":"หน้าหลัก","Login":"เข้าสู่ระบบ","Register":"สมัครสมาชิก","Categories":"หมวดหมู่","See All":"ดูทั้งหมด","Refresh":"รีเฟรช","Add to cart":"เพิ่มลงรถเข็น","Your Cart":"รถเข็นของฉัน","Your cart is empty.":"รถเข็นของคุณว่างเปล่า","Total":"รวม","My Account":"บัญชีของฉัน","My Shop":"ร้านค้าของฉัน","My Orders":"คำสั่งซื้อของฉัน","My Favorites":"รายการโปรด","Search sweets...":"ค้นหาขนมหวาน...","Password":"รหัสผ่าน","Email address":"อีเมล","Full name":"ชื่อเต็ม","Seller":"ผู้ขาย","Customer":"ลูกค้า","Edit":"แก้ไข","Delete":"ลบ","Save Changes":"บันทึกการเปลี่ยนแปลง","Cancel Editing":"ยกเลิกการแก้ไข","Description":"คำอธิบาย","Stock":"สต็อก","Payment Method":"วิธีชำระเงิน","Secure Payment":"ชำระเงินอย่างปลอดภัย","Shop Status":"สถานะร้านค้า","Sweet Deals":"ข้อเสนอแสนหวาน","Discover sweets you will love":"ค้นพบขนมหวานที่คุณจะหลงรัก","Shop Now":"ช้อปเลย","Popular Products":"สินค้ายอดนิยม","No products found yet.":"ยังไม่พบสินค้า","Welcome back":"ยินดีต้อนรับกลับมา","Create your account":"สร้างบัญชีของคุณ","Already have an account?":"มีบัญชีอยู่แล้วหรือไม่?"},
  vi: {"Home":"Trang chủ","Login":"Đăng nhập","Register":"Đăng ký","Categories":"Danh mục","See All":"Xem tất cả","Refresh":"Làm mới","Add to cart":"Thêm vào giỏ","Your Cart":"Giỏ hàng của tôi","Your cart is empty.":"Giỏ hàng của bạn đang trống.","Total":"Tổng cộng","My Account":"Tài khoản của tôi","My Shop":"Cửa hàng của tôi","My Orders":"Đơn hàng của tôi","My Favorites":"Yêu thích","Search sweets...":"Tìm đồ ngọt...","Password":"Mật khẩu","Email address":"Địa chỉ email","Full name":"Họ và tên","Seller":"Người bán","Customer":"Khách hàng","Edit":"Sửa","Delete":"Xóa","Save Changes":"Lưu thay đổi","Cancel Editing":"Hủy chỉnh sửa","Description":"Mô tả","Stock":"Hàng tồn","Payment Method":"Phương thức thanh toán","Secure Payment":"Thanh toán an toàn","Shop Status":"Trạng thái cửa hàng","Sweet Deals":"Ưu đãi ngọt ngào","Discover sweets you will love":"Khám phá món ngọt bạn sẽ yêu thích","Shop Now":"Mua ngay","Popular Products":"Sản phẩm phổ biến","No products found yet.":"Chưa tìm thấy sản phẩm nào.","Welcome back":"Chào mừng bạn quay lại","Create your account":"Tạo tài khoản của bạn","Already have an account?":"Bạn đã có tài khoản?"},
  pl: {"Home":"Strona główna","Login":"Zaloguj się","Register":"Zarejestruj się","Categories":"Kategorie","See All":"Zobacz wszystkie","Refresh":"Odśwież","Add to cart":"Dodaj do koszyka","Your Cart":"Mój koszyk","Your cart is empty.":"Twój koszyk jest pusty.","Total":"Razem","My Account":"Moje konto","My Shop":"Mój sklep","My Orders":"Moje zamówienia","My Favorites":"Ulubione","Search sweets...":"Szukaj słodyczy...","Password":"Hasło","Email address":"Adres e-mail","Full name":"Imię i nazwisko","Seller":"Sprzedawca","Customer":"Klient","Edit":"Edytuj","Delete":"Usuń","Save Changes":"Zapisz zmiany","Cancel Editing":"Anuluj edycję","Description":"Opis","Stock":"Stan","Payment Method":"Metoda płatności","Secure Payment":"Bezpieczna płatność","Shop Status":"Status sklepu","Sweet Deals":"Słodkie okazje","Discover sweets you will love":"Odkryj słodycze, które pokochasz","Shop Now":"Kup teraz","Popular Products":"Popularne produkty","No products found yet.":"Nie znaleziono jeszcze produktów.","Welcome back":"Witamy ponownie","Create your account":"Utwórz konto","Already have an account?":"Masz już konto?"},
  uk: {"Home":"Головна","Login":"Увійти","Register":"Реєстрація","Categories":"Категорії","See All":"Переглянути все","Refresh":"Оновити","Add to cart":"Додати в кошик","Your Cart":"Мій кошик","Your cart is empty.":"Ваш кошик порожній.","Total":"Разом","My Account":"Мій обліковий запис","My Shop":"Мій магазин","My Orders":"Мої замовлення","My Favorites":"Обране","Search sweets...":"Шукати солодощі...","Password":"Пароль","Email address":"Електронна пошта","Full name":"Повне ім’я","Seller":"Продавець","Customer":"Покупець","Edit":"Редагувати","Delete":"Видалити","Save Changes":"Зберегти зміни","Cancel Editing":"Скасувати редагування","Description":"Опис","Stock":"Запас","Payment Method":"Спосіб оплати","Secure Payment":"Безпечна оплата","Shop Status":"Статус магазину","Sweet Deals":"Солодкі пропозиції","Discover sweets you will love":"Відкрийте солодощі, які вам сподобаються","Shop Now":"Купити зараз","Popular Products":"Популярні товари","No products found yet.":"Товарів поки не знайдено.","Welcome back":"З поверненням","Create your account":"Створіть обліковий запис","Already have an account?":"Уже маєте обліковий запис?"},
  el: {"Home":"Αρχική","Login":"Σύνδεση","Register":"Εγγραφή","Categories":"Κατηγορίες","See All":"Προβολή όλων","Refresh":"Ανανέωση","Add to cart":"Προσθήκη στο καλάθι","Your Cart":"Το καλάθι μου","Your cart is empty.":"Το καλάθι σας είναι άδειο.","Total":"Σύνολο","My Account":"Ο λογαριασμός μου","My Shop":"Το κατάστημά μου","My Orders":"Οι παραγγελίες μου","My Favorites":"Αγαπημένα","Search sweets...":"Αναζήτηση γλυκών...","Password":"Κωδικός πρόσβασης","Email address":"Διεύθυνση email","Full name":"Ονοματεπώνυμο","Seller":"Πωλητής","Customer":"Πελάτης","Edit":"Επεξεργασία","Delete":"Διαγραφή","Save Changes":"Αποθήκευση αλλαγών","Cancel Editing":"Ακύρωση επεξεργασίας","Description":"Περιγραφή","Stock":"Απόθεμα","Payment Method":"Τρόπος πληρωμής","Secure Payment":"Ασφαλής πληρωμή","Shop Status":"Κατάσταση καταστήματος","Sweet Deals":"Γλυκές προσφορές","Discover sweets you will love":"Ανακαλύψτε γλυκά που θα λατρέψετε","Shop Now":"Αγορά τώρα","Popular Products":"Δημοφιλή προϊόντα","No products found yet.":"Δεν βρέθηκαν ακόμη προϊόντα.","Welcome back":"Καλώς ήρθατε ξανά","Create your account":"Δημιουργήστε τον λογαριασμό σας","Already have an account?":"Έχετε ήδη λογαριασμό;"},
  sv: {"Home":"Hem","Login":"Logga in","Register":"Registrera","Categories":"Kategorier","See All":"Visa alla","Refresh":"Uppdatera","Add to cart":"Lägg i kundvagn","Your Cart":"Min kundvagn","Your cart is empty.":"Din kundvagn är tom.","Total":"Totalt","My Account":"Mitt konto","My Shop":"Min butik","My Orders":"Mina beställningar","My Favorites":"Mina favoriter","Search sweets...":"Sök sötsaker...","Password":"Lösenord","Email address":"E-postadress","Full name":"Fullständigt namn","Seller":"Säljare","Customer":"Kund","Edit":"Redigera","Delete":"Ta bort","Save Changes":"Spara ändringar","Cancel Editing":"Avbryt redigering","Description":"Beskrivning","Stock":"Lager","Payment Method":"Betalningsmetod","Secure Payment":"Säker betalning","Shop Status":"Butiksstatus","Sweet Deals":"Söta erbjudanden","Discover sweets you will love":"Upptäck godsaker du kommer att älska","Shop Now":"Handla nu","Popular Products":"Populära produkter","No products found yet.":"Inga produkter hittades ännu.","Welcome back":"Välkommen tillbaka","Create your account":"Skapa ditt konto","Already have an account?":"Har du redan ett konto?"},
};
// Other languages in the 30-language selector currently use the English fallback until their full phrase sets are added.
export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [language, setLanguage] = useState<string>('en');
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false);
  const [accountDeletionModalOpen, setAccountDeletionModalOpen] = useState(false);
  const [accountDeletionSubmitting, setAccountDeletionSubmitting] = useState(false);
  const [accountDeletionMessage, setAccountDeletionMessage] = useState('');
  const selectedLanguage = IMSIYA_LANGUAGES.find(item => item[0] === language) || IMSIYA_LANGUAGES[0];
  const tr = (somali: string, english: string) => language === 'so' ? (CORE_TRANSLATIONS.so?.[english] || SHOP_WALLET_TRANSLATIONS.so?.[english] || somali) : (CORE_TRANSLATIONS[language]?.[english] || SHOP_WALLET_TRANSLATIONS[language]?.[english] || english);
  useEffect(() => { AsyncStorage.getItem('imsiya:language').then(saved => { if (saved && IMSIYA_LANGUAGES.some(item => item[0] === saved)) setLanguage(saved); }).catch(error => console.log('Language preference restore failed:', error?.message || error)); }, []);
  const chooseLanguage = async (code: string) => { setLanguage(code); setLanguagePickerOpen(false); try { await AsyncStorage.setItem('imsiya:language', code); } catch (error: any) { console.log('Language preference save failed:', error?.message || error); } };

  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [passwordRecoveryMode, setPasswordRecoveryMode] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsLoadingMore, setProductsLoadingMore] = useState(false);
  const [productsPage, setProductsPage] = useState(0);
  const [productsHasMore, setProductsHasMore] = useState(true);
  const [productError, setProductError] = useState('');

  const [cart, setCart] = useState<CartItem[]>([]);
  const [localDataReadyForUser, setLocalDataReadyForUser] = useState<string | null>(null);

  const [screen, setScreen] = useState<'home' | 'cart' | 'shop' | 'admin' | 'profile' | 'favorites' | 'orders' | 'seller-orders' | 'wallet' | 'product' | 'rewards'>('home');
  const [monthlyRewards, setMonthlyRewards] = useState<any[]>([]);
  const [rewardsLoading, setRewardsLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [sellerOrders, setSellerOrders] = useState<any[]>([]);
  const [sellerOrdersLoading, setSellerOrdersLoading] = useState(false);
  const [profileRole, setProfileRole] = useState('');
  const [planSetupLoading, setPlanSetupLoading] = useState(false);
  const [planSetupMessage, setPlanSetupMessage] = useState('');
  const [planSetupError, setPlanSetupError] = useState(false);
  const isAdmin = ['admin', 'super_admin'].includes(profileRole);
  const [pendingSellers, setPendingSellers] = useState<any[]>([]);
  const [adminOrders, setAdminOrders] = useState<any[]>([]);
  const [adminSubscriptions, setAdminSubscriptions] = useState<any[]>([]);
  const [adminWallet, setAdminWallet] = useState<any[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);

  const [category, setCategory] = useState('Dhammaan');
  const [search, setSearch] = useState('');

  const [shopName, setShopName] = useState('');
  const [shopDescription, setShopDescription] = useState('');
  const [myShop, setMyShop] = useState<Shop | null>(null);

  const [shopLoading, setShopLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productStock, setProductStock] = useState('10');
  const [productImages, setProductImages] = useState<string[]>([]);
  const [productImageMimeTypes, setProductImageMimeTypes] = useState<string[]>([]);
  const [productImageUploading, setProductImageUploading] = useState(false);
  const [productCategory, setProductCategory] = useState('Buskut');
  const [addingProduct, setAddingProduct] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [sellerProducts, setSellerProducts] = useState<Product[]>([]);
  const [sellerProductsLoading, setSellerProductsLoading] = useState(false);
  const [sellerWallet, setSellerWallet] = useState<any | null>(null);
  const [sellerWalletTransactions, setSellerWalletTransactions] = useState<any[]>([]);
  const [walletLoading, setWalletLoading] = useState(false);
  const [payoutRequests, setPayoutRequests] = useState<any[]>([]);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutMethod] = useState<'paypal'>('paypal');
  const [payoutAccount, setPayoutAccount] = useState('');
  const [payoutSubmitting, setPayoutSubmitting] = useState(false);
  const [adminPayoutRequests, setAdminPayoutRequests] = useState<any[]>([]);
  const [adminDeletionRequests, setAdminDeletionRequests] = useState<any[]>([]);

  const [categoryRows, setCategoryRows] = useState<Category[]>([]);

  // Keep each signed-in customer's cart and favorites on this device.
  // User-scoped keys prevent data from one account appearing in another account.
  useEffect(() => {
    let active = true;
    const userId = session?.user?.id;

    if (!userId) {
      setCart([]);
      setFavoriteIds([]);
      setLocalDataReadyForUser(null);
      return () => { active = false; };
    }

    setLocalDataReadyForUser(null);
    setCart([]);
    setFavoriteIds([]);
    AsyncStorage.multiGet([`imsiya:cart:${userId}`, `imsiya:favorites:${userId}`])
      .then(([cartEntry, favoritesEntry]) => {
        if (!active) return;
        try {
          const savedCart = cartEntry?.[1] ? JSON.parse(cartEntry[1]) : [];
          setCart(Array.isArray(savedCart) ? savedCart : []);
        } catch {
          setCart([]);
        }
        try {
          const savedFavorites = favoritesEntry?.[1] ? JSON.parse(favoritesEntry[1]) : [];
          setFavoriteIds(Array.isArray(savedFavorites) ? savedFavorites.filter((id: unknown) => typeof id === 'string') : []);
        } catch {
          setFavoriteIds([]);
        }
        setLocalDataReadyForUser(userId);
      })
      .catch(error => {
        console.log('Local cart/favorites restore failed:', error?.message || error);
        if (active) setLocalDataReadyForUser(userId);
      });

    return () => { active = false; };
  }, [session?.user?.id]);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId || localDataReadyForUser !== userId) return;
    AsyncStorage.multiSet([
      [`imsiya:cart:${userId}`, JSON.stringify(cart)],
      [`imsiya:favorites:${userId}`, JSON.stringify(favoriteIds)],
    ] as [string, string][]).catch(error => console.log('Local cart/favorites save failed:', error?.message || error));
  }, [cart, favoriteIds, session?.user?.id, localDataReadyForUser]);

  const loadCategories = async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('id, name');

    if (error) {
      console.log('Category error:', error.message);
      return;
    }

    const loadedCategories = (data || []) as Category[];
    setCategoryRows(loadedCategories);
    setProductCategory(current =>
      loadedCategories.some(item => item.name.toLowerCase() === current.toLowerCase())
        ? current
        : loadedCategories[0]?.name || ''
    );
  };

  const loadProducts = async (reset = true) => {
    const pageSize = 40;
    if (reset) {
      setProductsLoading(true);
      setProductsLoadingMore(false);
      setProductError('');
    } else {
      if (productsLoading || productsLoadingMore || !productsHasMore) return;
      setProductsLoadingMore(true);
    }

    try {
      const page = reset ? 0 : productsPage;
      const from = page * pageSize;
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, image_url, image_urls, stock, description, categories(name)')
        .eq('active', true)
        .order('created_at', { ascending: false })
        .range(from, from + pageSize - 1);

      if (error) throw error;

      const formatted: Product[] = (data || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        price: Number(item.price || 0),
        image_url: item.image_url,
        image_urls: Array.isArray(item.image_urls) && item.image_urls.length ? item.image_urls : (item.image_url ? [item.image_url] : []),
        stock: Number(item.stock || 0),
        description: item.description || '',
        category: Array.isArray(item.categories)
          ? item.categories[0]?.name || 'Macmacaan kale'
          : item.categories?.name || 'Macmacaan kale',
      }));

      setProducts(current => reset ? formatted : [...current, ...formatted]);
      setProductsPage(page + 1);
      setProductsHasMore(formatted.length === pageSize);
    } catch (e: any) {
      setProductError(e.message || tr('Alaabta lama soo qaadi karin.', 'Could not load products.'));
    } finally {
      if (reset) setProductsLoading(false);
      else setProductsLoadingMore(false);
    }
  };

  const loadAdminData = async () => {
    if (!isAdmin) return;
    setAdminLoading(true);
    try {
      const [sellersResult, ordersResult, subscriptionsResult, walletResult, payoutsResult, deletionRequestsResult] = await Promise.all([
        supabase.from('seller_profiles').select('id, shop_name, description, approved, created_at').eq('approved', false).order('created_at', { ascending: false }).limit(50),
        supabase.from('orders').select('id, customer_id, total_amount, currency, usd_total_amount, status, payment_status, payment_method, created_at').order('created_at', { ascending: false }).limit(50),
        supabase.from('shop_subscriptions').select('id, shop_id, amount, currency, status, started_at, expires_at, created_at').order('created_at', { ascending: false }).limit(50),
        supabase.from('wallet_transactions').select('id, seller_id, amount, transaction_type, description, order_id, created_at').order('created_at', { ascending: false }).limit(50),
        supabase.from('payout_requests').select('id, seller_id, amount, status, payout_method, payout_account, created_at, processed_at, admin_note').order('created_at', { ascending: false }).limit(100),
        supabase.from('account_deletion_requests').select('id, requester_id, requester_email, status, requested_at, processed_at, admin_note').order('requested_at', { ascending: false }).limit(100),
      ]);
      if (sellersResult.error) throw sellersResult.error;
      if (ordersResult.error) throw ordersResult.error;
      if (subscriptionsResult.error) throw subscriptionsResult.error;
      if (walletResult.error) throw walletResult.error;
      if (payoutsResult.error) throw payoutsResult.error;
      if (deletionRequestsResult.error) throw deletionRequestsResult.error;
      setPendingSellers(sellersResult.data || []);
      setAdminOrders(ordersResult.data || []);
      setAdminSubscriptions(subscriptionsResult.data || []);
      setAdminWallet(walletResult.data || []);
      setAdminPayoutRequests(payoutsResult.data || []);
      setAdminDeletionRequests(deletionRequestsResult.data || []);
    } catch (e: any) {
      Alert.alert('IMSIYA Admin', e.message || tr('Codsiyada lama soo qaadi karin.', 'Could not load applications.'));
    } finally {
      setAdminLoading(false);
    }
  };

  const approveSeller = async (sellerId: string) => {
    try {
      const { error } = await supabase
        .from('seller_profiles')
        .update({ approved: true })
        .eq('id', sellerId);
      if (error) throw error;
      Alert.alert('IMSIYA Admin', tr('Iibiyaha waa la ansixiyey. Dukaanku wuxuu furmayaa marka subscription-ka $20 la xaqiijiyo.', 'Seller approved. The shop will open after the $20 subscription is verified.'));
      await loadAdminData();
    } catch (e: any) {
      Alert.alert('IMSIYA Admin', e.message || tr('Ansixinta way fashilantay.', 'Approval failed.'));
    }
  };

  const updateOrderTrackingStatus = async (orderId: string, nextStatus: 'processing' | 'shipped' | 'delivered') => {
    if (!isAdmin) {
      Alert.alert('IMSIYA Admin', tr('Kaliya maamulka ayaa beddeli kara xaaladda dalabka.', 'Only an administrator can change the order status.'));
      return;
    }
    try {
      const { data, error } = await supabase
        .from('orders')
        .update({ status: nextStatus })
        .eq('id', orderId)
        .eq('payment_status', 'paid')
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error(tr('Dalabka lama helin ama lama oggola in xaaladdiisa la beddelo.', 'Order not found or you are not allowed to change its status.'));
      await loadAdminData();
      Alert.alert('IMSIYA Admin', tr('Xaaladda dalabka waa la cusboonaysiiyey.', 'Order status updated.'));
    } catch (e: any) {
      Alert.alert('IMSIYA Admin', e.message || tr('Xaaladda dalabka lama beddeli karin.', 'Could not update order status.'));
    }
  };

  const loadMySellerProducts = async () => {
    if (!session?.user?.id) { setSellerProducts([]); return; }
    setSellerProductsLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, image_url, image_urls, stock, description, categories(name)')
        .eq('seller_id', session.user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setSellerProducts((data || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        price: Number(item.price || 0),
        image_url: item.image_url,
        image_urls: Array.isArray(item.image_urls) && item.image_urls.length ? item.image_urls : (item.image_url ? [item.image_url] : []),
        stock: Number(item.stock || 0),
        description: item.description || '',
        category: Array.isArray(item.categories) ? item.categories[0]?.name || 'Macmacaan kale' : item.categories?.name || 'Macmacaan kale',
      })));
    } catch (e: any) {
      Alert.alert('IMSIYA', e.message || tr('Alaabta dukaanka lama soo qaadi karin.', 'Could not load shop products.'));
    } finally {
      setSellerProductsLoading(false);
    }
  };

  const pickProductImage = async () => {
    if (productImages.length >= 5) {
      Alert.alert('IMSIYA', tr('Waxaad ku dari kartaa ugu badnaan 5 sawir.', 'You can add up to 5 photos.'));
      return;
    }
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('IMSIYA', tr('Fadlan oggolow in IMSIYA ay ka doorato sawirrada telefoonkaaga.', 'Please allow IMSIYA to access photos on your phone.'));
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setProductImages(current => current.length < 5 ? [...current, result.assets[0].uri] : current);
        setProductImageMimeTypes(current => current.length < 5 ? [...current, result.assets[0].mimeType || 'image/jpeg'] : current);
      }
    } catch (e: any) {
      Alert.alert('IMSIYA', e.message || tr('Sawirka lama dooran karin.', 'Could not select the image.'));
    }
  };

  const beginEditProduct = (product: Product) => {
    setEditingProductId(product.id);
    setProductName(product.name);
    setProductDescription(product.description || '');
    setProductPrice(String(product.price));
    setProductStock(String(product.stock));
    setProductImages(product.image_urls?.length ? product.image_urls : (product.image_url ? [product.image_url] : []));
    setProductImageMimeTypes([]);
    setProductCategory(product.category);
  };

  const deleteSellerProduct = (productId: string) => {
    Alert.alert(tr('Tirtir alaabta', 'Delete product'), tr('Ma hubtaa inaad tirtirayso alaabtan?', 'Are you sure you want to delete this product?'), [
      { text: 'Maya', style: 'cancel' },
      { text: tr('Haa, tirtir', 'Yes, delete'), style: 'destructive', onPress: async () => {
        try {
          const { error } = await supabase.from('products').update({ active: false }).eq('id', productId).eq('seller_id', session?.user?.id || '');
          if (error) throw error;
          setSellerProducts(current => current.filter(item => item.id !== productId));
          await loadProducts();
          Alert.alert('IMSIYA', tr('Alaabta waa la tirtiray.', 'Product deleted.'));
        } catch (e: any) {
          Alert.alert('IMSIYA', e.message || tr('Alaabta lama tirtiri karin.', 'Could not delete product.'));
        }
      } },
    ]);
  };

  const loadSellerWallet = async () => {
    if (!session?.user?.id) return;
    setWalletLoading(true);
    try {
      const [walletResult, transactionsResult, payoutsResult] = await Promise.all([
        supabase.from('seller_wallets').select('id, seller_id, balance, updated_at').eq('seller_id', session.user.id).maybeSingle(),
        supabase.from('wallet_transactions').select('id, amount, transaction_type, description, order_id, created_at').eq('seller_id', session.user.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('payout_requests').select('id, amount, status, payout_method, created_at, processed_at, admin_note').eq('seller_id', session.user.id).order('created_at', { ascending: false }).limit(30),
      ]);
      if (walletResult.error) throw walletResult.error;
      if (transactionsResult.error) throw transactionsResult.error;
      if (payoutsResult.error) throw payoutsResult.error;
      setSellerWallet(walletResult.data || { balance: 0 });
      setSellerWalletTransactions(transactionsResult.data || []);
      setPayoutRequests(payoutsResult.data || []);
    } catch (e: any) {
      Alert.alert('IMSIYA Wallet', e.message || tr('Wallet-ka lama soo qaadi karin.', 'Could not load wallet.'));
    } finally {
      setWalletLoading(false);
    }
  };

  const requestSellerPayout = async () => {
    const amount = Number(payoutAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('IMSIYA Wallet', tr('Geli lacag sax ah.', 'Enter a valid amount.'));
      return;
    }
    if (!payoutAccount.trim()) {
      Alert.alert('IMSIYA Wallet', tr('Geli email-ka PayPal.', 'Enter your PayPal email.'));
      return;
    }
    setPayoutSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('request_seller_payout', {
        p_amount: amount,
        p_method: payoutMethod,
        p_account: payoutAccount.trim(),
      });
      if (error) throw error;
      setPayoutAmount('');
      await loadSellerWallet();
      Alert.alert('IMSIYA Wallet', tr('Codsiga lacag-bixinta waa la gudbiyey. Maamulka ayaa hubinaya oo gacanta ku bixinaya.', 'Payout request submitted. The team will review it and process the payment manually.'));
    } catch (e: any) {
      Alert.alert('IMSIYA Wallet', e.message || tr('Codsiga lacag-bixinta lama gudbin karin.', 'Could not submit payout request.'));
    } finally {
      setPayoutSubmitting(false);
    }
  };

  const updatePayoutRequestStatus = async (requestId: string, nextStatus: 'paid' | 'rejected') => {
    if (!isAdmin) return;
    try {
      const { error } = await supabase.rpc('admin_process_payout', {
        p_request_id: requestId,
        p_action: nextStatus,
      });
      if (error) throw error;
      await loadAdminData();
      Alert.alert('IMSIYA Admin', nextStatus === 'paid' ? tr('Codsiga waxaa loo calaamadeeyey in lacagta la diray.', 'The request was marked as paid.') : tr('Codsiga waa la diiday.', 'The request was rejected.'));
    } catch (e: any) {
      Alert.alert('IMSIYA Admin', e.message || tr('Xaaladda codsiga lama beddeli karin.', 'Could not update request status.'));
    }
  };

  const loadMyShop = async () => {
    if (!session?.user?.id) {
      setMyShop(null);
      return;
    }

    setShopLoading(true);

    try {
      const { data, error } = await supabase
        .from('shops')
        .select('id, shop_name, description, active')
        .eq('owner_id', session.user.id)
        .maybeSingle();

      if (error) throw error;

      setMyShop(data as Shop | null);
      await loadMySellerProducts();

      if (data) {
        setShopName(data.shop_name || '');
        setShopDescription(data.description || '');
      }
    } catch (e: any) {
      Alert.alert('IMSIYA', e.message || tr('Dukaanka lama soo qaadi karin.', 'Could not load shop.'));
    } finally {
      setShopLoading(false);
    }
  };

  const handleIncomingLink = async (url: string | null) => {
    if (!url) return;
    // PayPal returns browsers to the website URL and native apps to the IMSIYA scheme.
    try {
      const returned = new URL(url);
      const paymentResult = returned.searchParams.get('imsiya_payment');
      if (paymentResult === 'order') {
        url = 'imsiya://order-success?token=' + encodeURIComponent(returned.searchParams.get('token') || '');
      } else if (paymentResult === 'subscription') {
        url = 'imsiya://subscription-success';
      } else if (paymentResult === 'order-cancel') {
        url = 'imsiya://order-cancel';
      } else if (paymentResult === 'subscription-cancel') {
        url = 'imsiya://subscription-cancel';
      }
    } catch {
      // Native deep links are not absolute web URLs; handle them below.
    }

    if (url.startsWith('imsiya://subscription-success')) {
      Alert.alert(
        'IMSIYA',
        tr('PayPal wuxuu soo celiyey oggolaanshaha. Xaqiijinta rasmiga ah waxaa samaynaya PayPal webhook; dukaanka wuxuu furmayaa marka lacagta $20 la xaqiijiyo.', 'PayPal returned approval. Final verification is handled by the PayPal webhook; the shop opens after the $20 payment is verified.')
      );
      await loadMyShop();
      return;
    }

    if (url.startsWith('imsiya://order-success')) {
      try {
        const parsed = new URL(url);
        const paypalOrderId = parsed.searchParams.get('token');
        if (!paypalOrderId) {
          Alert.alert('IMSIYA', tr('PayPal ma soo dirin lambarka dalabka. Fadlan nala soo xiriir ka hor intaadan mar kale bixin.', 'PayPal did not return an order ID. Please contact us before trying to pay again.'));
          return;
        }
        const { data, error } = await supabase.functions.invoke('capture-paypal-order', {
          body: { paypal_order_id: paypalOrderId },
        });
        if (error) throw error;
        if (!data?.success) throw new Error(tr('PayPal lacag-bixinta lama xaqiijin.', 'PayPal payment was not verified.'));
        Alert.alert('IMSIYA', tr('Lacag-bixinta PayPal waa la xaqiijiyey. Dalabkaagu waa la diyaarinayaa.', 'PayPal payment verified. Your order is being prepared.'));
        setCart([]);
        await Promise.all([loadProducts(), loadMyOrders()]);
      } catch (e: any) {
        Alert.alert('IMSIYA', e.message || tr('Lacag-bixinta PayPal lama xaqiijin karin. Ha ku celin bixinta ilaa xaaladda la hubiyo.', 'PayPal payment could not be verified. Do not pay again until the status has been checked.'));
      }
      return;
    }

    if (url.startsWith('imsiya://order-cancel')) {
      Alert.alert('IMSIYA', tr('Lacag-bixinta dalabka waa la joojiyey. Wax lacag ah lagama qaadin.', 'Order payment was cancelled. No money was charged.'));
      return;
    }

    if (url.startsWith('imsiya://subscription-cancel')) {
      Alert.alert(
        'IMSIYA',
        tr('Lacag-bixinta waa la joojiyey. Dukaankaagu weli ma furna.', 'Payment was cancelled. Your shop is not open yet.')
      );
      return;
    }

    try {
      const parsed = new URL(url);
      const code = parsed.searchParams.get('code');

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
        const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ''));
        const authType = parsed.searchParams.get('type') || hashParams.get('type');
        if (authType === 'recovery') {
          setPasswordRecoveryMode(true);
          setAuthMode('login');
          setPassword('');
          setAuthMessage(tr('Geli password cusub oo ugu yaraan 8 xaraf ah.', 'Enter a new password with at least 8 characters.'));
          setScreen('profile');
        }
      }
    } catch (e: any) {
      Alert.alert('IMSIYA', e.message || tr('Link-ga lama xaqiijin karin.', 'Could not verify the link.'));
    }
  };

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, currentSession) => {
      setSession(currentSession);
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecoveryMode(true);
        setAuthMode('login');
        setPassword('');
        setAuthMessage(tr('Geli password cusub oo ugu yaraan 8 xaraf ah.', 'Enter a new password with at least 8 characters.'));
        setScreen('profile');
      }
    });

    Linking.getInitialURL().then(handleIncomingLink);

    const linkSub = Linking.addEventListener('url', ({ url }) => {
      handleIncomingLink(url);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      linkSub.remove();
    };
  }, []);

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);

  useEffect(() => {
    if (!session?.user?.id) {
      setMyShop(null);
      setProfileRole('');
      return;
    }
    loadMyShop();
    let active = true;
    supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.log('Profile role lookup failed:', error.message);
          setProfileRole('');
          return;
        }
        setProfileRole(String(data?.role || ''));
      });
    return () => { active = false; };
  }, [session?.user?.id]);

  useEffect(() => {
    if (isAdmin) loadAdminData();
    else if (screen === 'admin') setScreen('home');
  }, [isAdmin]);

  const signInOrSignUp = async () => {
    const cleanEmail = email.trim().toLowerCase();
    setAuthMessage('');

    if (authMode === 'signup' && !fullName.trim()) {
      setAuthMessage(tr('Fadlan geli magacaaga oo buuxa.', 'Please enter your full name.'));
      return;
    }

    if (!cleanEmail || !password) {
      setAuthMessage(tr('Geli email-ka iyo password-ka.', 'Enter your email and password.'));
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setAuthMessage(tr('Email-ka aad gelisay sax ma aha. Hubi email-ka.', 'The email address is invalid. Please check it.'));
      return;
    }

    if (authMode === 'signup' && password.length < 8) {
      setAuthMessage(tr('Password-ku waa inuu ahaadaa ugu yaraan 8 xaraf.', 'Password must be at least 8 characters.'));
      return;
    }

    setAuthLoading(true);

    try {
      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              full_name: fullName.trim(),
            },
            emailRedirectTo: Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href.split('#')[0] : 'imsiya://',
          },
        });

        if (error) throw error;

        if (!data.user) {
          throw new Error(tr('Akoonka lama samayn. Fadlan mar kale isku day.', 'Account could not be created. Please try again.'));
        }

        if (!data.session) {
          setAuthMessage(tr('Diiwaangelinta waa la aqbalay. Fadlan email-kaaga ka xaqiiji link-ga la soo diray. Hubi Spam/Junk.', 'Registration accepted. Verify your email using the link we sent. Check Spam/Junk too.'));
        } else {
          setSession(data.session);
          setScreen('home');
          setAuthMessage(tr('Akoonkaaga waa la sameeyey. Ku soo dhowow IMSIYA!', 'Your account has been created. Welcome to IMSIYA!'));
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (error) throw error;
        if (!data.session) throw new Error(tr('Gelitaanku ma dhammaan. Mar kale isku day.', 'Sign-in did not complete. Please try again.'));
        setSession(data.session);
        setScreen('home');
      }
    } catch (e: any) {
      const status = Number(e?.status || 0);
      const errorCode = String(e?.code || '');
      const message = String(e?.message || '');

      if (
        authMode === 'signup' &&
        (status >= 500 || errorCode === 'unexpected_failure' ||
          /smtp|email provider|sending email|mail server/i.test(message))
      ) {
        setAuthMessage(tr('Diiwaangelintu ma dhammaan sababtoo ah server-ka email-ka xaqiijinta ayaa cilad leh. Maamulka waa inuu hagaajiyaa SMTP-ga Supabase.', 'Registration could not finish because the email verification server has an issue. The administrator must fix Supabase SMTP settings.'));
      } else {
        setAuthMessage(message || tr('Gelitaanka wuu fashilmay. Hubi xogtaada oo mar kale isku day.', 'Sign-in failed. Check your details and try again.'));
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const saveRecoveredPassword = async () => {
    if (password.length < 8) {
      setAuthMessage(tr('Password-ku waa inuu ahaadaa ugu yaraan 8 xaraf.', 'Password must be at least 8 characters.'));
      return;
    }
    setAuthLoading(true);
    setAuthMessage('');
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPasswordRecoveryMode(false);
      setPassword('');
      setAuthMessage(tr('Password-kaaga cusub waa la kaydiyey.', 'Your new password has been saved.'));
      setScreen('home');
    } catch (e: any) {
      setAuthMessage(e?.message || tr('Password-ka lama beddeli karin. Mar kale isku day.', 'The password could not be changed. Please try again.'));
    } finally {
      setAuthLoading(false);
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      Alert.alert('IMSIYA', error.message || tr('Waxbaa khaldamay. Fadlan mar kale isku day.', 'Something went wrong. Please try again.'));
      return;
    }

    setScreen('home');
  };

  const requestAccountDeletion = () => {
    if (!session?.user?.id || isAdmin) return;
    setAccountDeletionMessage('');
    setAccountDeletionModalOpen(true);
  };

  const submitAccountDeletionRequest = async () => {
    if (!session?.user?.id || isAdmin || accountDeletionSubmitting) return;
    setAccountDeletionSubmitting(true);
    try {
      const { error } = await supabase.from('account_deletion_requests').insert({
        requester_id: session.user.id,
        requester_email: session.user.email || null,
        status: 'pending',
      });
      if (error) {
        if (error.code === '23505') throw new Error(tr('Codsi tirtirid oo hore ayuu u sugayaa.', 'You already have an open account deletion request.'));
        throw error;
      }
      setAccountDeletionMessage(tr('Codsiga tirtirka waa la gudbiyey. Maamulka ayaa dib u eegaya.', 'Your account deletion request has been submitted for review.'));
    } catch (e: any) {
      setAccountDeletionMessage(e?.message || tr('Codsiga lama gudbin karin.', 'Could not submit your request.'));
    } finally {
      setAccountDeletionSubmitting(false);
    }
  };

  const updateAccountDeletionRequest = async (requestId: string, status: 'reviewing' | 'completed' | 'rejected') => {
    try {
      if (status === 'completed') {
        const { data, error } = await supabase.functions.invoke('process-account-deletion', { body: { request_id: requestId } });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        Alert.alert('IMSIYA Admin', tr('Akoonka iyo xogtiisa gaarka ah waa la tirtiray; diiwaannada xisaab-celinta ee loo baahan yahay waa la hayey.', 'The account and personal profile were deleted; required transaction records were retained.'));
      } else {
        const { data, error } = await supabase.from('account_deletion_requests')
          .update({ status, processed_at: status === 'reviewing' ? null : new Date().toISOString() })
          .eq('id', requestId).select('id').maybeSingle();
        if (error) throw error;
        if (!data) throw new Error(tr('Codsiga lama helin ama awood uma lihid.', 'Request not found or permission denied.'));
      }
      await loadAdminData();
    } catch (e: any) {
      Alert.alert('IMSIYA Admin', e.message || tr('Xaaladda codsiga lama beddeli karin.', 'Could not update request status.'));
    }
  };

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      Alert.alert('IMSIYA', tr('Alaabtani hadda ma taallo.', 'This product is currently unavailable.'));
      return;
    }

    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem && existingItem.quantity >= product.stock) {
      Alert.alert('IMSIYA', tr('Tirada alaabta intaas kama badnaan karto.', 'The quantity cannot exceed the available stock.'));
      return;
    }

    setCart(current => {
      const existing = current.find(item => item.id === product.id);
      if (existing) {
        return current.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...current, { ...product, quantity: 1 }];
    });

    Alert.alert('IMSIYA', tr('Alaabta waxaa lagu daray cart-ka.', 'Product added to cart.'));
  };

  const changeQuantity = (id: string, amount: number) => {
    setCart(current =>
      current
        .map(item =>
          item.id === id
            ? { ...item, quantity: item.quantity + amount }
            : item
        )
        .filter(item => item.quantity > 0)
    );
  };

  const cartTotal = cart.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  const createOrUpdateShop = async () => {
    if (!session?.user?.id) {
      Alert.alert('IMSIYA', tr('Marka hore akoonka gal.', 'Please sign in first.'));
      return;
    }

    if (!shopName.trim()) {
      Alert.alert('IMSIYA', tr('Geli magaca dukaanka.', 'Enter your shop name.'));
      return;
    }

    setShopLoading(true);

    try {
      // Seller approval is controlled by the administrator.
      // The app must never approve its own seller profile.
      const { error: sellerError } = await supabase
        .from('seller_profiles')
        .upsert(
          {
            id: session.user.id,
            shop_name: shopName.trim(),
            description: shopDescription.trim(),
          },
          {
            onConflict: 'id',
            ignoreDuplicates: false,
          }
        );

      if (sellerError) throw sellerError;

      if (myShop) {
        const { data, error } = await supabase
          .from('shops')
          .update({
            shop_name: shopName.trim(),
            description: shopDescription.trim(),
          })
          .eq('id', myShop.id)
          .eq('owner_id', session.user.id)
          .select('id, shop_name, description, active')
          .single();

        if (error) throw error;
        setMyShop(data as Shop);
      } else {
        const { data, error } = await supabase
          .from('shops')
          .insert({
            owner_id: session.user.id,
            shop_name: shopName.trim(),
            description: shopDescription.trim(),
            active: false,
          })
          .select('id, shop_name, description, active')
          .single();

        if (error) throw error;
        setMyShop(data as Shop);
      }

      Alert.alert(
        'IMSIYA',
        tr('Codsiga dukaanka waa la kaydiyey. Si dukaanku u furmo, bixi $20 bishii, maamulka ayaana xaqiijinaya oggolaanshaha.', 'Shop application saved. Pay $20 per month to open the shop; an administrator will verify the payment.')
      );
    } catch (e: any) {
      Alert.alert('IMSIYA', e.message || tr('Dukaanka lama kaydin karin.', 'Could not save shop details.'));
    } finally {
      setShopLoading(false);
    }
  };

  const setupPayPalPlan = async () => {
    if (profileRole !== 'super_admin') {
      setPlanSetupError(true);
      setPlanSetupMessage(tr('Kaliya Super Admin ayaa diyaarin kara PayPal plan-ka.', 'Only the Super Admin can set up the PayPal plan.'));
      return;
    }
    setPlanSetupMessage('');
    setPlanSetupError(false);
    setPlanSetupLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-paypal-subscription', {
        body: { action: 'setup_plan_only' },
      });
      if (error) throw new Error(data?.error || error.message || 'PayPal plan setup request failed');
      if (!data?.success || data?.status !== 'ACTIVE') {
        throw new Error(data?.error || tr('PayPal LIVE plan-ka lama xaqiijin.', 'PayPal LIVE plan could not be verified.'));
      }
      setPlanSetupError(false);
      setPlanSetupMessage(tr('PayPal LIVE plan-ka $20 bishii waa la diyaariyey lana xaqiijiyey. Wax subscription ama lacag-bixin ah lama samayn.', 'PayPal LIVE plan for $20/month has been set up and verified. No subscription was started and no payment was charged.'));
    } catch (e: any) {
      setPlanSetupError(true);
      setPlanSetupMessage(e?.message || tr('PayPal plan setup wuu fashilmay.', 'PayPal plan setup failed.'));
    } finally {
      setPlanSetupLoading(false);
    }
  };

  const payShopSubscription = async () => {
    if (!session?.user?.id) {
      Alert.alert('IMSIYA', tr('Marka hore akoonka gal.', 'Please sign in first.'));
      return;
    }

    if (!myShop?.id) {
      Alert.alert('IMSIYA', tr('Marka hore samee dukaankaaga.', 'Please create your shop first.'));
      return;
    }

    setPaymentError('');
    setPaymentLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        'create-paypal-subscription',
        { body: { shop_id: myShop.id, platform: Platform.OS === 'web' ? 'web' : 'native' } }
      );

      // Preserve the FunctionsHttpError so the catch block can read context.status
      // and display the correct message for an existing pending subscription (HTTP 409).
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.approval_url) {
        throw new Error(tr('PayPal ma soo celin link-ga subscription-ka.', 'PayPal did not return a subscription link.'));
      }

      if (Platform.OS === 'web') {
        window.location.assign(data.approval_url);
        return;
      }

      await Linking.openURL(data.approval_url);
    } catch (e: any) {
      let message = e?.message || tr('Lacag-bixinta lama bilaabi karin.', 'Could not start payment.');

      // Supabase FunctionsHttpError stores the Edge Function response in context.
      // Show a clear pending-subscription message instead of the generic non-2xx error.
      const status = e?.context?.status;
      if (status === 409) {
        message = tr(
          'Codsi lacag-bixinta $20 bishii ayaa hore kuu sugaya. Ha samayn codsi kale. Sug xaqiijinta ama la xiriir maamulka IMSIYA.',
          'A $20 monthly payment request is already pending. Do not create another request. Wait for verification or contact IMSIYA support.'
        );
      } else if (status) {
        try {
          const response = typeof e.context.clone === 'function' ? e.context.clone() : e.context;
          const payload = await response.json();
          if (payload?.error && typeof payload.error === 'string') message = payload.error;
        } catch {
          // Keep the friendly fallback message when the response has no readable JSON.
        }
      }

      setPaymentError(message);
      if (Platform.OS !== 'web') Alert.alert('IMSIYA', message);
    } finally {
      setPaymentLoading(false);
    }
  };

  const addProduct = async () => {
    if (!session?.user?.id || !myShop?.id) {
      Alert.alert('IMSIYA', tr('Marka hore samee dukaankaaga.', 'Please create your shop first.'));
      return;
    }

    if (!myShop.active) {
      Alert.alert(
        'IMSIYA',
        tr('Dukaankaagu weli ma shaqaynayo. Sug xaqiijinta lacagta iyo oggolaanshaha maamulka.', 'Your shop is not active yet. Wait for payment verification and administrator approval.')
      );
      return;
    }

    const price = Number(productPrice);
    const stock = Number(productStock);

    if (!productName.trim() || !productPrice.trim()) {
      Alert.alert('IMSIYA', tr('Geli magaca alaabta iyo qiimaheeda.', 'Enter the product name and price.'));
      return;
    }

    if (!Number.isFinite(price) || price <= 0) {
      Alert.alert('IMSIYA', tr('Qiimaha alaabtu sax ma aha.', 'The product price is invalid.'));
      return;
    }

    if (!Number.isInteger(stock) || stock < 0) {
      Alert.alert('IMSIYA', tr('Tirada alaabtu sax ma aha.', 'The product quantity is invalid.'));
      return;
    }

    const selectedCategory = categoryRows.find(
      item => item.name.toLowerCase() === productCategory.toLowerCase()
    );

    if (!selectedCategory) {
      Alert.alert(
        'IMSIYA',
        tr('Qaybta alaabta lama helin. Hubi categories-ka Supabase.', 'Product category not found. Check the categories in Supabase.')
      );
      return;
    }

    setAddingProduct(true);

    try {
      if (productImages.length < 1) throw new Error(tr('Fadlan ku dar ugu yaraan hal sawir.', 'Please add at least one photo.'));
      if (productImages.length > 5) throw new Error(tr('Ugu badnaan 5 sawir ayaa la oggol yahay.', 'A maximum of 5 photos is allowed.'));
      setProductImageUploading(productImages.some(uri => !/^https?:\/\//i.test(uri)));
      const savedImageUrls: string[] = [];
      for (let index = 0; index < productImages.length; index++) {
        let imageUrl = productImages[index].trim();
        if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
          const imageResponse = await fetch(imageUrl);
          if (!imageResponse.ok) throw new Error(tr('Sawirka telefoonka lama akhrin karin.', 'Could not read the image from your phone.'));
          const imageBuffer = await imageResponse.arrayBuffer();
          const mimeType = String(productImageMimeTypes[index] || imageResponse.headers.get('content-type') || 'image/jpeg').toLowerCase().split(';')[0];
          const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : mimeType === 'image/jpeg' ? 'jpg' : '';
          if (!extension) throw new Error('Sawir kasta waa inuu noqdaa JPG, PNG ama WEBP.');
          if (imageBuffer.byteLength <= 0 || imageBuffer.byteLength > 5 * 1024 * 1024) throw new Error('Sawir kasta waa inuu ka yaraadaa 5 MB.');
          const imagePath = session.user.id + '/' + Date.now() + '-' + index + '-' + Math.random().toString(36).slice(2, 9) + '.' + extension;
          const { error: uploadError } = await supabase.storage.from('product-images').upload(imagePath, imageBuffer, {
            contentType: mimeType,
            cacheControl: '3600',
            upsert: false,
          });
          if (uploadError) throw uploadError;
          imageUrl = supabase.storage.from('product-images').getPublicUrl(imagePath).data.publicUrl;
        }
        if (imageUrl) savedImageUrls.push(imageUrl);
      }
      const savedImageUrl = savedImageUrls[0] || null;
      const productPayload = {
        seller_id: session.user.id,
        shop_id: myShop.id,
        category_id: selectedCategory.id,
        name: productName.trim(),
        description: productDescription.trim(),
        price,
        image_url: savedImageUrl,
        image_urls: savedImageUrls,
        stock,
      };
      const result = editingProductId
        ? await supabase.from('products').update(productPayload).eq('id', editingProductId).eq('seller_id', session.user.id)
        : await supabase.from('products').insert({ ...productPayload, active: true });
      if (result.error) throw result.error;

      setEditingProductId(null);
      setProductName('');
      setProductDescription('');
      setProductPrice('');
      setProductStock('10');
      setProductImages([]);
      setProductImageMimeTypes([]);

      Alert.alert('IMSIYA', editingProductId ? tr('Alaabta waa la cusboonaysiiyey.', 'Product updated.') : tr('Alaabta waa lagu daray dukaanka.', 'Product added to your shop.'));
      await Promise.all([loadProducts(), loadMySellerProducts()]);
    } catch (e: any) {
      Alert.alert('IMSIYA', e.message || tr('Alaabta lama dari karin.', 'Could not add the product.'));
    } finally {
      setAddingProduct(false);
      setProductImageUploading(false);
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesCategory =
      category === 'Dhammaan' || product.category === category;

    const matchesSearch =
      product.name.toLowerCase().includes(search.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  const toggleFavorite = (productId: string) => setFavoriteIds(current => current.includes(productId) ? current.filter(id => id !== productId) : [...current, productId]);

  const renderProduct = (product: Product) => (
    <View key={product.id} style={styles.productCard}>
      {(product.image_urls?.[0] || product.image_url) ? (
        <Image
          source={{ uri: product.image_urls?.[0] || product.image_url! }}
          style={styles.productImage}
        />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Text style={styles.placeholderText}>🍬</Text>
        </View>
      )}

      <TouchableOpacity style={styles.favoriteToggle} onPress={() => toggleFavorite(product.id)}><Text style={styles.favoriteToggleText}>{favoriteIds.includes(product.id) ? '♥' : '♡'}</Text></TouchableOpacity>
      <Text style={styles.productName}>{translateSweetName(product.name, language)}</Text>
      <Text style={styles.productCategory}>{translateSweetName(product.category, language)}</Text>
      <TouchableOpacity onPress={() => { setSelectedProduct(product); setScreen('product'); }} style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>{tr("Faahfaahin", "Details")}</Text>
      </TouchableOpacity>
      <Text style={styles.productPrice}>{money(product.price)}</Text>
      <Text style={styles.stockText}>
        {product.stock > 0 ? `${tr('Kaydka:', 'Stock:')} ${product.stock}` : tr('Waa dhammaatay', 'Out of stock')}
      </Text>

      <TouchableOpacity
        style={[
          styles.primaryButton,
          product.stock <= 0 && styles.disabledButton,
        ]}
        disabled={product.stock <= 0}
        onPress={() => addToCart(product)}
      >
        <Text style={styles.buttonText}>{tr("Ku dar cart-ka", "Add to cart")}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderHome = () => (
    <>
      <View style={styles.homeSearchWrap}>
        <Text style={styles.searchGlyph}>⌕</Text>
        <TextInput
          style={styles.searchInput}
          placeholder={tr("Raadi macmacaan...", "Search sweets...")}
          placeholderTextColor="#8D8299"
          value={search}
          onChangeText={setSearch}
        />
        <TouchableOpacity style={styles.searchFilter} onPress={() => { loadProducts(); loadCategories(); }}>
          <Text style={styles.searchFilterText}>☷</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.promoBanner}>
        <View style={styles.promoCopy}>
          <Text style={styles.promoEyebrow}>IMSIYA SPECIAL</Text>
          <Text style={styles.promoTitle}>{tr("Macmacaan kuu gaar ah", "Sweet Deals")}</Text>
          <Text style={styles.promoSubtitle}>{tr("Soo hel macmacaanka aad jeceshahay", "Discover sweets you will love")}</Text>
          <TouchableOpacity style={styles.promoButton} onPress={() => { setCategory('Dhammaan'); setSearch(''); }}>
            <Text style={styles.promoButtonText}>{tr("Hadda iibso", "Shop Now")}  →</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.promoArt}>
          {products[0]?.image_url ? (
            <Image source={{ uri: products[0].image_url }} style={styles.promoImage} resizeMode="cover" />
          ) : <Text style={styles.promoEmoji}>🍰</Text>}
        </View>
        <View style={styles.promoOrb} />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{tr("Qaybaha", "Categories")}</Text>
        <TouchableOpacity onPress={() => { setCategory('Dhammaan'); setSearch(''); }}>
          <Text style={styles.seeAllText}>{tr("Dhammaan", "See All")} →</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.homeCategoryGrid}>
        {[
          { name: 'Keeg', icon: '🍰' },
          { name: 'Buskut', icon: '🍪' },
          { name: 'Xalwo', icon: '🍯' },
          { name: 'Shukulaato', icon: '🍫' },
          { name: 'Macmacaan kale', icon: '🍬' },
        ].map(item => (
          <TouchableOpacity key={item.name} style={[styles.homeCategoryCard, category === item.name && styles.homeCategoryActive]} onPress={() => setCategory(item.name)}>
            <Text style={styles.homeCategoryIcon}>{item.icon}</Text>
            <Text style={[styles.homeCategoryName, category === item.name && styles.homeCategoryNameActive]}>{translateSweetName(item.name, language)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{tr("Alaabta caanka ah", "Popular Products")}</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={() => { loadProducts(); loadCategories(); }} disabled={productsLoading} accessibilityLabel={tr("Cusboonaysii", "Refresh")}>
          {productsLoading ? <ActivityIndicator size="small" color="#5B12A8" /> : <Text style={styles.refreshIcon}>↻</Text>}
          <Text style={styles.refreshButtonText}>{tr("Cusboonaysii", "Refresh")}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.productSectionTools}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
          {['Dhammaan', ...Array.from(new Set([...categories.slice(1), ...categoryRows.map(item => item.name)]))].map(item => (
            <TouchableOpacity key={item} style={[styles.categoryButton, category === item && styles.categorySelected]} onPress={() => setCategory(item)}>
              <Text style={[styles.categoryText, category === item && styles.categorySelectedText]} >{translateSweetName(item, language)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {productsLoading ? (
        <ActivityIndicator size="large" color="#5B12A8" />
      ) : productError ? (
        <Text style={styles.errorText}>{productError}</Text>
      ) : filteredProducts.length === 0 ? (
        <Text style={styles.emptyText}>{tr("Weli alaab lama helin.", "No products found yet.")}</Text>
      ) : (
        <View style={styles.productGrid}>{filteredProducts.map(renderProduct)}</View>
      )}

      {productsHasMore && !productsLoading && (
        <TouchableOpacity
          style={[styles.secondaryButton, { marginTop: 8, marginBottom: 18 }]}
          onPress={() => loadProducts(false)}
          disabled={productsLoadingMore}
        >
          {productsLoadingMore
            ? <ActivityIndicator size="small" color="#4A286B" />
            : <Text style={styles.secondaryButtonText}>{tr('Soo rar badeecooyin dheeraad ah', 'Load more products')}</Text>}
        </TouchableOpacity>
      )}
    </>
  );

  const checkoutCart = async () => {
    if (!session?.user?.id) {
      Alert.alert('IMSIYA', tr('Marka hore akoonka gal.', 'Please sign in first.'));
      return;
    }

    if (cart.length === 0) {
      Alert.alert('IMSIYA', tr("Cart-kaagu waa madhan yahay.", "Your cart is empty."));
      return;
    }

    setCheckoutLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        'create-paypal-order',
        {
          body: {
            platform: Platform.OS === 'web' ? 'web' : 'native',
            items: cart.map(item => ({
              product_id: item.id,
              quantity: item.quantity,
            })),
          },
        }
      );

      if (error) throw error;
      if (!data?.checkout_url || !data?.usd_amount) {
        throw new Error('PayPal ma soo celin link-ga lacag-bixinta.');
      }

      if (Platform.OS === 'web') {
        // Browser checkout must navigate directly; native Alert button callbacks are not reliable on web.
        await Linking.openURL(data.checkout_url);
      } else {
        Alert.alert(
          tr('Xaqiiji lacagta', 'Confirm payment'),
          tr('Wadarta alaabta: KES ', 'Product total: KES ') + data.kes_amount + '\n' + tr('Lacagta PayPal: USD ', 'PayPal amount: USD ') + data.usd_amount,
          [
            { text: tr('Sii wad PayPal', 'Continue to PayPal'), onPress: () => Linking.openURL(data.checkout_url) },
            { text: tr('Jooji', 'Cancel'), style: 'cancel' },
          ]
        );
      }
    } catch (e: any) {
      Alert.alert('IMSIYA', e.message || tr('Lacag-bixinta lama bilaabi karin.', 'Could not start payment.'));
    } finally {
      setCheckoutLoading(false);
    }
  };


  const loadMyOrders = async () => {
    if (!session?.user?.id) return;
    setOrdersLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, total_amount, currency, status, payment_status, payment_method, created_at')
        .eq('customer_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      setMyOrders(data || []);
    } catch (e: any) {
      Alert.alert('IMSIYA', e.message || tr('Dalabyada lama soo qaadi karin.', 'Could not load orders.'));
    } finally {
      setOrdersLoading(false);
    }
  };

  const loadMonthlyRewards = async () => {
    if (!session?.user?.id) { setMonthlyRewards([]); return; }
    setRewardsLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_monthly_rewards_leaderboard');
      if (error) throw error;
      setMonthlyRewards(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.log('Monthly rewards could not load:', e?.message || e);
      setMonthlyRewards([]);
    } finally {
      setRewardsLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user?.id) loadMonthlyRewards();
    else setMonthlyRewards([]);
  }, [session?.user?.id]);

  const loadMySellerOrders = async () => {
    if (!session?.user?.id) return;
    setSellerOrdersLoading(true);
    try {
      const { data, error } = await supabase
        .from('order_items')
        .select('id, order_id, product_id, quantity, unit_price, products(name), orders(id, total_amount, currency, status, payment_status, payment_method, created_at)')
        .eq('seller_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      setSellerOrders((data || []).filter((item: any) => item.orders));
    } catch (e: any) {
      Alert.alert('IMSIYA', e.message || tr('Dalabyada iibiyaha lama soo qaadi karin.', 'Could not load seller orders.'));
    } finally {
      setSellerOrdersLoading(false);
    }
  };

  const renderSellerWallet = () => (
    <View style={styles.walletScreen}>
      <View style={styles.walletTopRow}>
        <View>
          <Text style={styles.walletEyebrow}>{tr("IMSIYA IIBIYE", "IMSIYA SELLER")}</Text>
          <Text style={styles.sectionTitle}>{tr("Wallet-kayga", "My Wallet")}</Text>
        </View>
        <TouchableOpacity style={styles.walletBackButton} onPress={() => setScreen('shop')}>
          <Text style={styles.walletBackText}>{tr("← Dukaankayga", "← My Shop")}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.walletHero}>
        <View style={styles.walletHeroTop}>
          <Text style={styles.walletHeroLabel}>{tr("HADHAAGA IIBKAAGA", "YOUR SALES BALANCE")}</Text>
          <Text style={styles.walletCoin}>✦</Text>
        </View>
        {walletLoading ? <ActivityIndicator size="large" color="#FFFFFF" /> : (
          <>
            <Text style={styles.walletBalance}>{money(Number(sellerWallet?.balance || 0))}</Text>
            <Text style={styles.walletHeroNote}>{tr("100% lacagta iibka la xaqiijiyey adigaa leh.", "You keep 100% of your verified sales.")}</Text>
            <Text style={styles.walletUpdated}>{tr("La cusboonaysiiyey:", "Last updated:")} {sellerWallet?.updated_at ? new Date(sellerWallet.updated_at).toLocaleString() : '—'}</Text>
          </>
        )}
        <TouchableOpacity style={styles.walletRefreshButton} onPress={loadSellerWallet} disabled={walletLoading}>
          {walletLoading ? <ActivityIndicator size="small" color="#4A286B" /> : <Text style={styles.walletRefreshIcon}>↻</Text>}
          <Text style={styles.walletRefreshText}>{tr("Cusboonaysii wallet-ka", "Refresh wallet")}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.walletSection}>
        <View style={styles.walletSectionHeading}>
          <Text style={styles.walletSectionTitle}>{tr("Dhaqdhaqaaqa", "Activity")}</Text>
          <Text style={styles.walletSectionCaption}>{tr("Taariikhda lacagta", "Transaction history")}</Text>
        </View>
        {walletLoading ? <ActivityIndicator color="#4A286B" /> : sellerWalletTransactions.length === 0 ? (
          <View style={styles.walletEmptyCard}>
            <Text style={styles.walletEmptyIcon}>↗</Text>
            <Text style={styles.walletEmptyTitle}>{tr("Weli dhaqdhaqaaq ma jiro", "No activity yet")}</Text>
            <Text style={styles.walletMuted}>{tr("Marka iib la xaqiijiyo, halkan ayaad ka arki doontaa.", "Verified sales will appear here.")}</Text>
          </View>
        ) : sellerWalletTransactions.map(tx => (
          <View key={tx.id} style={styles.walletTransaction}>
            <View style={styles.walletTransactionIcon}><Text style={styles.walletTransactionIconText}>↗</Text></View>
            <View style={styles.walletTransactionInfo}>
              <Text style={styles.walletTransactionTitle}>{tx.transaction_type === "sale" || tx.transaction_type === "Iib" ? tr("Iib", "Sale") : tx.transaction_type || tr("Dhaqdhaqaaq", "Transaction")}</Text>
              <Text style={styles.walletMuted}>{tx.description || tr("Lacagta iibka", "Sales payment")}</Text>
              {tx.order_id ? <Text style={styles.walletMuted}>{tr("Dalab:", "Order:")} {String(tx.order_id).slice(0, 12)}</Text> : null}
              <Text style={styles.walletDate}>{tx.created_at ? new Date(tx.created_at).toLocaleString() : '—'}</Text>
            </View>
            <Text style={styles.walletTransactionAmount}>{money(Number(tx.amount || 0))}</Text>
          </View>
        ))}
      </View>

      <View style={styles.walletPayoutCard}>
        <Text style={styles.walletSectionTitle}>{tr("Codso lacag-bixin", "Request a payout")}</Text>
        <Text style={styles.walletMuted}>{tr("Codsigaaga maamulka ayaa hubinaya. Lacagta si toos ah looma dirayo weli.", "Your request will be reviewed by the IMSIYA team. Payment is not sent automatically yet.")}</Text>
        <Text style={styles.walletFieldLabel}>{tr("Lacagta (KSh)", "Amount (KSh)")}</Text>
        <TextInput style={[styles.input, styles.walletInput]} keyboardType="decimal-pad" placeholder={tr("Tusaale: 1,000", "Example: 1,000")} value={payoutAmount} onChangeText={setPayoutAmount} />
        <Text style={styles.walletFieldLabel}>{tr("Habka lacag-bixinta", "Payout method")}</Text>
        <View style={styles.walletMethodSelected}>
          <View style={styles.walletMethodIcon}><Text style={styles.walletMethodIconText}>P</Text></View>
          <View style={styles.walletMethodInfo}>
            <Text style={styles.walletMethodTitle}>PayPal</Text>
            <Text style={styles.walletMuted}>{tr("Lacagta waxaa laguugu diraa email-kaaga PayPal.", "Your payout will be sent to your PayPal email.")}</Text>
          </View>
          <Text style={styles.walletMethodCheck}>✓</Text>
        </View>
        <Text style={styles.walletFieldLabel}>{tr("Email-ka PayPal", "PayPal email")}</Text>
        <TextInput style={[styles.input, styles.walletInput]} autoCapitalize="none" keyboardType="email-address" placeholder="name@example.com" value={payoutAccount} onChangeText={setPayoutAccount} />
        <View style={styles.walletComingSoon}>
          <Text style={styles.walletComingTitle}>{tr("Bixinta PayPal", "PayPal Payout")}</Text>
          <Text style={styles.walletMuted}>{tr("Codsiga waxaa hubinaya maamulka IMSIYA. Lacagta waxaa la calaamadaynayaa marka PayPal si dhab ah loo diro.", "IMSIYA will review the request. It will be marked as paid only after PayPal confirms the transfer.")}</Text>
        </View>
        <TouchableOpacity style={[styles.walletSubmitButton, payoutSubmitting && styles.disabledButton]} disabled={payoutSubmitting || walletLoading} onPress={requestSellerPayout}>
          {payoutSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.walletSubmitText}>{tr("Gudbi codsiga", "Submit request")}</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.walletSection}>
        <Text style={styles.walletSectionTitle}>{tr("Codsiyadayda", "My Requests")}</Text>
        {payoutRequests.length === 0 ? (
          <View style={styles.walletEmptyCard}>
            <Text style={styles.walletEmptyIcon}>◷</Text>
            <Text style={styles.walletEmptyTitle}>{tr("Codsi lacag-bixin ma jiro", "No payout requests yet")}</Text>
            <Text style={styles.walletMuted}>{tr("Codsiyada aad gudbiso halkan ayay ka muuqan doonaan.", "Your submitted requests will appear here.")}</Text>
          </View>
        ) : payoutRequests.map(req => (
          <View key={req.id} style={styles.walletTransaction}>
            <View style={styles.walletTransactionInfo}>
              <Text style={styles.walletTransactionTitle}>{money(Number(req.amount || 0))} · PayPal</Text>
              <Text style={styles.walletMuted}>{tr("Xaalad:", "Status:")} {req.status === 'paid' ? tr("La bixiyey", "Paid") : req.status === 'rejected' ? tr("La diiday", "Rejected") : req.status === 'processing' ? tr("La shaqaynayo", "Processing") : tr("Sugaya maamulka", "Awaiting review")}</Text>
              <Text style={styles.walletDate}>{req.created_at ? new Date(req.created_at).toLocaleString() : '—'}</Text>
            </View>
            <Text style={styles.walletStatusDot}>●</Text>
          </View>
        ))}
      </View>
    </View>
  );

  const renderSellerOrders = () => (
    <View>
      <Text style={styles.sectionTitle}>{tr("Dalabyada dukaankayga", "My Shop Orders")}</Text>
      <TouchableOpacity onPress={() => setScreen('shop')}><Text style={styles.refreshText}>{tr("← Ku noqo dukaanka", "← Back to Shop")}</Text></TouchableOpacity>
      <TouchableOpacity style={styles.refreshWideButton} onPress={loadMySellerOrders} disabled={sellerOrdersLoading}>
        {sellerOrdersLoading ? <ActivityIndicator size="small" color="#4A286B" /> : <Text style={styles.refreshIcon}>↻</Text>}
        <Text style={styles.refreshButtonText}>{tr("Cusboonaysii dalabyada", "Refresh orders")}</Text>
      </TouchableOpacity>
      {sellerOrdersLoading ? <ActivityIndicator size="large" color="#4A286B" /> : sellerOrders.length === 0 ? (
        <Text style={styles.emptyText}>{tr("Weli dalab alaabta dukaankaaga ah ma jiro.", "No shop product orders yet.")}</Text>
      ) : sellerOrders.map((item: any) => {
        const order = item.orders;
        const product = Array.isArray(item.products) ? item.products[0] : item.products;
        return (
          <View key={item.id} style={styles.shopStatusCard}>
            <Text style={styles.shopStatusTitle}>{product?.name || tr('Alaabta IMSIYA', 'IMSIYA Product')}</Text>
            <Text style={styles.shopStatusText}>{tr('Tirada:', 'Quantity:')} {item.quantity} · {tr('Qiimaha:', 'Price:')} {money(Number(item.unit_price || 0) * Number(item.quantity || 0))}</Text>
            <Text style={styles.shopStatusText}>{tr('Wadarta dalabka:', 'Order total:')} {order.currency || 'KES'} {Number(order.total_amount || 0).toLocaleString('en-KE')}</Text>
            <Text style={styles.shopStatusText}>{orderStatusLabel(order.status, order.payment_status, language)}</Text>
            <Text style={styles.shopStatusText}>{tr('Bixinta:', 'Payment:')} {String(order.payment_status || '—')} · {tr('Habka:', 'Method:')} {order.payment_method || '—'}</Text>
            <Text style={styles.shopStatusText}>{new Date(order.created_at).toLocaleString()}</Text>
            <Text style={styles.shopStatusText}>{tr('Dalab:', 'Order:')} {String(order.id).slice(0, 12)}</Text>
          </View>
        );
      })}
    </View>
  );

  const renderOrderHistory = () => (
    <View>
      <Text style={styles.sectionTitle}>{tr("Dalabyadayda", "My Orders")}</Text>
      <TouchableOpacity onPress={() => setScreen('profile')}><Text style={styles.refreshText}>{tr('← Ku noqo Profile', '← Back to Profile')}</Text></TouchableOpacity>
      <TouchableOpacity style={styles.refreshWideButton} onPress={loadMyOrders} disabled={ordersLoading}>
        {ordersLoading ? <ActivityIndicator size="small" color="#4A286B" /> : <Text style={styles.refreshIcon}>↻</Text>}
        <Text style={styles.refreshButtonText}>{tr("Cusboonaysii dalabyada", "Refresh orders")}</Text>
      </TouchableOpacity>
      {ordersLoading ? <ActivityIndicator size="large" color="#4A286B" /> : myOrders.length === 0 ? <Text style={styles.emptyText}>{tr("Weli dalab kuma jiro akoonkaaga.", "You have no orders yet.")}</Text> : myOrders.map(order => (
        <View key={order.id} style={styles.shopStatusCard}>
          <Text style={styles.shopStatusTitle}>{order.currency || 'KES'} {Number(order.total_amount || 0).toLocaleString('en-KE')}</Text>
          <Text style={styles.shopStatusText}>{orderStatusLabel(order.status, order.payment_status, language)}</Text>
          <Text style={[styles.shopStatusText, { fontWeight: '700', marginTop: 10 }]}>{tr('Raadraaca dalabka', 'Order tracking')}</Text>
          {String(order.status || '').toLowerCase() === 'cancelled' || String(order.status || '').toLowerCase() === 'canceled' ? (
            <Text style={[styles.shopStatusText, { color: '#B42318', fontWeight: '700' }]}>{tr('Dalabkan waa la joojiyey.', 'This order was cancelled.')}</Text>
          ) : String(order.payment_status || '').toLowerCase() !== 'paid' ? (
            <Text style={styles.shopStatusText}>{tr('Raadraacu wuxuu bilaabmayaa marka lacagta la xaqiijiyo.', 'Tracking starts after payment is verified.')}</Text>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 8, marginBottom: 8 }}>
              {[
                { key: 'pending', so: 'La helay', en: 'Received' },
                { key: 'processing', so: 'Diyaarin', en: 'Preparing' },
                { key: 'shipped', so: 'La diray', en: 'Shipped' },
                { key: 'delivered', so: 'La gaarsiiyey', en: 'Delivered' },
              ].map((step, index) => {
                const current = ['pending', 'processing', 'shipped', 'delivered'].indexOf(String(order.status || '').toLowerCase());
                const done = current >= index;
                return (
                  <View key={step.key} style={{ flex: 1, alignItems: 'center' }}>
                    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: done ? '#4A286B' : '#E8E2ED', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: done ? '#FFFFFF' : '#756A80', fontSize: 11, fontWeight: '700' }}>{done ? '✓' : String(index + 1)}</Text>
                    </View>
                    <Text style={{ fontSize: 10, color: done ? '#4A286B' : '#756A80', textAlign: 'center', marginTop: 5, fontWeight: done ? '700' : '400' }}>{language === 'so' ? step.so : step.en}</Text>
                  </View>
                );
              })}
            </View>
          )}
          <Text style={styles.shopStatusText}>{tr('Bixinta:', 'Payment:')} {String(order.payment_status || '—')}</Text>
          <Text style={styles.shopStatusText}>{tr('Habka:', 'Method:')} {order.payment_method || '—'}</Text>
          <Text style={styles.shopStatusText}>{new Date(order.created_at).toLocaleString()}</Text>
          <Text style={styles.shopStatusText}>{tr('Dalab:', 'Order:')} {String(order.id).slice(0, 12)}</Text>
        </View>
      ))}
    </View>
  );

  const renderRewards = () => (
    <View>
      <Text style={styles.sectionTitle}>{tr('IMSIYA Rewards', 'IMSIYA Rewards')}</Text>
      <TouchableOpacity onPress={() => setScreen('profile')}><Text style={styles.refreshText}>{tr('← Ku noqo Profile', '← Back to Profile')}</Text></TouchableOpacity>
      <View style={{ backgroundColor: '#38204F', borderRadius: 22, padding: 18, marginBottom: 22, borderWidth: 1, borderColor: '#F3A33B', elevation: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
          <Text style={{ color: '#F3A33B', fontSize: 11, fontWeight: '900', letterSpacing: 1.6 }}>🎁 IMSIYA REWARDS</Text>
          <TouchableOpacity onPress={loadMonthlyRewards} disabled={rewardsLoading}>
            {rewardsLoading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 12 }}>↻ {tr('Cusboonaysii', 'Refresh')}</Text>}
          </TouchableOpacity>
        </View>
        <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '900', marginBottom: 5 }}>{tr('Iibso, dadaal, hadiyad ku guuleyso!', 'Shop, shine & win a surprise gift!')}</Text>
        <Text style={{ color: '#E9DDF3', fontSize: 13, lineHeight: 19, marginBottom: 16 }}>{tr('Bil kasta waxaan abaalmarin siinnaa dukaanka ugu iibka fiican iyo macmiilka ugu wax iibsiga badan.', 'Every month, we reward the top-selling shop and the customer with the highest verified purchases.')}</Text>
        {(['shop', 'customer'] as const).map((kind) => {
          const rows = monthlyRewards.filter((item: any) => item.award_type === kind);
          return (
            <View key={kind} style={{ backgroundColor: '#FFFFFF', borderRadius: 15, padding: 13, marginBottom: kind === 'shop' ? 10 : 0 }}>
              <Text style={{ color: '#4A286B', fontSize: 14, fontWeight: '900', marginBottom: 8 }}>{kind === 'shop' ? '🏪 ' + tr('Dukaamada ugu firfircoon', 'Top active shops') : '🛍️ ' + tr('Macaamiisha ugu iibsiga badan', 'Top customers')}</Text>
              {rewardsLoading ? <ActivityIndicator color="#5B0AA8" /> : rows.length === 0 ? (
                <Text style={{ color: '#756780', fontSize: 12, lineHeight: 18 }}>{tr('Weli ma jiraan iibsi la xaqiijiyey bishan. Tartanku wuxuu bilaabmayaa marka iibku dhaco.', 'No verified purchases yet this month. The leaderboard will appear as paid orders come in.')}</Text>
              ) : rows.map((entry: any) => (
                <View key={kind + '-' + entry.rank_position} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: entry.rank_position === rows.length ? 0 : 1, borderBottomColor: '#F0E8F6' }}>
                  <Text style={{ color: '#F09A2A', fontWeight: '900', width: 28 }}>#{entry.rank_position}</Text>
                  <Text style={{ color: '#38204F', fontWeight: '800', flex: 1, fontSize: 13 }}>{entry.display_name}</Text>
                  <Text style={{ color: '#5B0AA8', fontWeight: '900', fontSize: 12 }}>{Number(entry.order_count || 0)} {tr('dalab', 'orders')}</Text>
                </View>
              ))}
            </View>
          );
        })}
        <Text style={{ color: '#E9DDF3', fontSize: 11, lineHeight: 16, marginTop: 12 }}>{tr('Iibsi lacagtiisa la xaqiijiyey oo keliya ayaa tartanka lagu daraa. Guuleystayaasha waxaa la hubiyaa ka hor inta aan hadiyadda la dirin.', 'Only verified paid orders count. Winners are checked before gifts are shipped.')}</Text>
      </View>
    </View>
  );

  const renderProfile = () => (
    <View>
      {passwordRecoveryMode ? (
        <View style={styles.authPage}>
          <View style={styles.authBrand}>
            <Text style={styles.authBrandIcon}>🛍️</Text>
            <Text style={styles.authBrandName}>IMSIYA</Text>
            <Text style={styles.authBrandTagline}>Sweetness for Everyone</Text>
          </View>
          <View style={styles.authCard}>
            <Text style={styles.authHeading}>{tr('Samee password cusub', 'Set a new password')}</Text>
            <Text style={styles.authDescription}>{tr('Dooro password cusub oo ammaan ah.', 'Choose a new secure password.')}</Text>
            {!!authMessage && <Text style={styles.authMessage}>{authMessage}</Text>}
            <View style={styles.authInputWrap}>
              <Text style={styles.authInputIcon}>🔒</Text>
              <TextInput style={styles.authInput} placeholder={tr('Password cusub', 'New password')} placeholderTextColor="#8D8299" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} autoCapitalize="none" autoComplete="new-password" />
              <TouchableOpacity style={styles.authPasswordToggle} onPress={() => setShowPassword(current => !current)} accessibilityRole="button" accessibilityLabel={showPassword ? tr('Qari password-ka', 'Hide password') : tr('Muuji password-ka', 'Show password')}><Text style={styles.authPasswordToggleText}>{showPassword ? '🙈' : '👁️'}</Text></TouchableOpacity>
            </View>
            <TouchableOpacity style={[styles.authSubmit, authLoading && styles.disabledButton]} onPress={saveRecoveredPassword} disabled={authLoading}>
              {authLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{tr('Kaydi password-ka cusub', 'Save new password')}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      ) : !session ? (
        <View style={styles.authPage}>
          <View style={styles.authBrand}>
            <Text style={styles.authBrandIcon}>🛍️</Text>
            <Text style={styles.authBrandName}>IMSIYA</Text>
            <Text style={styles.authBrandTagline}>Sweetness for Everyone</Text>
          </View>
          <View style={styles.authCard}>
            <View style={styles.authTabs}>
              <TouchableOpacity style={[styles.authTab, authMode === 'login' && styles.authTabActive]} onPress={() => setAuthMode('login')}>
                <Text style={[styles.authTabText, authMode === 'login' && styles.authTabTextActive]}>{tr("Gal", "Login")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.authTab, authMode === 'signup' && styles.authTabActive]} onPress={() => setAuthMode('signup')}>
                <Text style={[styles.authTabText, authMode === 'signup' && styles.authTabTextActive]}>{tr("Isdiiwaangeli", "Register")}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.authHeading}>{authMode === 'signup' ? tr("Ku soo biir IMSIYA", "Create your account") : tr("Ku soo dhowow", "Welcome back")}</Text>
            <Text style={styles.authDescription}>{authMode === 'signup' ? tr("Samee akoon si aad u iibsato ama u iibiso macmacaanka.", "Create an account to buy and sell sweets.") : tr("Gal akoonkaaga si aad u sii wadato.", "Sign in to continue shopping.")}</Text>
            {!!authMessage && <Text style={styles.authMessage}>{authMessage}</Text>}
            {authMode === 'signup' && <View style={styles.authInputWrap}><Text style={styles.authInputIcon}>👤</Text><TextInput style={styles.authInput} placeholder={tr("Magacaaga oo buuxa", "Full name")} placeholderTextColor="#8D8299" value={fullName} onChangeText={setFullName} /></View>}
            <View style={styles.authInputWrap}><Text style={styles.authInputIcon}>✉</Text><TextInput style={styles.authInput} placeholder={tr("Email-kaaga", "Email address")} placeholderTextColor="#8D8299" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" /></View>
            <View style={styles.authInputWrap}><Text style={styles.authInputIcon}>🔒</Text><TextInput style={styles.authInput} placeholder={tr("Password", "Password")} placeholderTextColor="#8D8299" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} autoCapitalize="none" autoComplete={authMode === "signup" ? "new-password" : "current-password"} /><TouchableOpacity style={styles.authPasswordToggle} onPress={() => setShowPassword(current => !current)} accessibilityRole="button" accessibilityLabel={showPassword ? tr("Qari password-ka", "Hide password") : tr("Muuji password-ka", "Show password")}><Text style={styles.authPasswordToggleText}>{showPassword ? "🙈" : "👁️"}</Text></TouchableOpacity></View>
            {authMode === 'login' && <TouchableOpacity style={styles.authForgot} onPress={async () => {
              const cleanEmail = email.trim().toLowerCase();
              setAuthMessage('');
              if (!cleanEmail) { setAuthMessage(tr("Marka hore geli email-kaaga.", "Enter your email address first.")); return; }
              if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) { setAuthMessage(tr("Email-ka aad gelisay sax ma aha. Hubi email-ka.", "The email address is invalid. Please check it.")); return; }
              setAuthLoading(true);
              try {
                const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo: Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href.split('#')[0] : 'imsiya://' });
                if (error) throw error;
                setAuthMessage(tr("Haddii email-ku sax yahay, link dib-u-dejin ah ayaa laguugu soo diray.", "If the email is valid, a password reset link has been sent."));
              } catch (e: any) {
                setAuthMessage(e?.message || tr("Link-ga dib-u-dejinta lama diri karin. Mar kale isku day.", "The password reset link could not be sent. Please try again."));
              } finally {
                setAuthLoading(false);
              }
            }}>
              <Text style={styles.authForgotText}>{tr("Password ma illowday?", "Forgot Password?")}</Text>
            </TouchableOpacity>}
            <TouchableOpacity style={[styles.authSubmit, authLoading && styles.disabledButton]} onPress={signInOrSignUp} disabled={authLoading}>
              {authLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{authMode === 'signup' ? tr("Samee akoon", "Register") : tr("Gal akoonka", "Login")}</Text>}
            </TouchableOpacity>
            <Text style={styles.authBottomText}>{authMode === 'signup' ? tr("Akoon ma leedahay?", "Already have an account?") : tr("Akoon ma lihid?", "Don't have an account?")} <Text style={styles.authBottomLink} onPress={() => setAuthMode(current => current === 'signup' ? 'login' : 'signup')}>{authMode === 'signup' ? tr("Gal", "Login") : tr("Isdiiwaangeli", "Sign Up")}</Text></Text>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>{tr("Akoonkayga", "My Account")}</Text>
            <Text style={styles.heroText}>{session.user.user_metadata?.full_name || fullName || tr('Macmiilka IMSIYA', 'IMSIYA Customer')}</Text>
          </View>
          <View style={styles.shopStatusCard}>
            <Text style={styles.shopStatusTitle}>{tr("Xogta akoonka", "Account Details")}</Text>
            <Text style={styles.shopStatusText}>{tr("Iimayl:", "Email:")} {session.user.email || '—'}</Text>
            <Text style={styles.shopStatusText}>{tr("Nooca akoonka: ", "Account type: ")}{myShop ? tr("Iibiye", "Seller") : profileRole === 'admin' || profileRole === 'super_admin' ? 'Admin' : tr("Macmiil", "Customer")}</Text>
          </View>
          <TouchableOpacity style={styles.profileAction} onPress={() => setLanguagePickerOpen(true)}><Text style={styles.profileActionText}>🌐  {tr('Luqadda', 'Language')}: {selectedLanguage[1]} {selectedLanguage[2]}</Text></TouchableOpacity>
          <TouchableOpacity style={styles.profileAction} onPress={() => setScreen('favorites')}><Text style={styles.profileActionText}>♥  {tr("Alaabta aan jeclahay", "My Favorites")} ({favoriteIds.length})</Text></TouchableOpacity>
          <TouchableOpacity style={styles.profileAction} onPress={() => setScreen('shop')}><Text style={styles.profileActionText}>🏪  {tr("Dukaankayga iyo iibiyaha", "My Shop and Seller Account")}</Text></TouchableOpacity>
          {myShop ? <TouchableOpacity style={styles.profileAction} onPress={() => { setScreen('wallet'); loadSellerWallet(); }}><Text style={styles.profileActionText}>💰  {tr("Wallet-kayga iibka", "Seller Wallet")}</Text></TouchableOpacity> : null}
          <TouchableOpacity style={styles.profileAction} onPress={() => { setScreen('orders'); loadMyOrders(); }}><Text style={styles.profileActionText}>📦  {tr("Dalabyadayda", "My Orders")}</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.profileAction, { borderColor: '#F3A33B', backgroundColor: '#FFF8E9' }]} onPress={() => { setScreen('rewards'); loadMonthlyRewards(); }}><Text style={[styles.profileActionText, { color: '#6B3B00' }]}>🎁  {tr('IMSIYA Rewards — Abaalmarin bille ah', 'IMSIYA Rewards — Monthly Gifts')}  ✨</Text></TouchableOpacity>
          <TouchableOpacity style={styles.profileAction} onPress={() => setScreen('cart')}><Text style={styles.profileActionText}>🛒  {tr("Cart-kayga", "My Cart")} ({cart.length})</Text></TouchableOpacity>
          {!isAdmin && <TouchableOpacity style={[styles.profileAction, { borderColor: '#F0C6C2', marginTop: 10 }]} onPress={requestAccountDeletion}><Text style={[styles.profileActionText, { color: '#B3261E' }]}>🗑️  {tr('Codso tirtirka akoonka', 'Request account deletion')}</Text></TouchableOpacity>}
          <TouchableOpacity style={[styles.primaryButton, { marginTop: 18 }]} onPress={signOut}><Text style={styles.buttonText}>{tr("Ka bax akoonka", "Sign Out")}</Text></TouchableOpacity>
        </>
      )}
    </View>
  );

  const renderFavorites = () => {
    const favoriteProducts = products.filter(product => favoriteIds.includes(product.id));
    return (
      <View>
        <Text style={styles.sectionTitle}>{tr("Alaabta aan jeclahay", "My Favorites")}</Text>
        <TouchableOpacity onPress={() => setScreen('profile')}><Text style={styles.refreshText}>{tr('← Ku noqo Profile', '← Back to Profile')}</Text></TouchableOpacity>
        {favoriteProducts.length === 0 ? <Text style={styles.emptyText}>{tr('Weli ma aadan dooran alaab aad jeceshahay.', 'You have not added any favorites yet.')}</Text> : <View style={styles.productGrid}>{favoriteProducts.map(renderProduct)}</View>}
      </View>
    );
  };

  const renderProductDetails = () => {
    if (!selectedProduct) return <View><Text style={styles.emptyText}>{tr('Alaabta lama helin.', 'Product not found.')}</Text><TouchableOpacity onPress={() => setScreen('home')}><Text style={styles.refreshText}>{tr('← Ku noqo Hoyga', '← Back to Home')}</Text></TouchableOpacity></View>;
    return (
      <View>
        <TouchableOpacity onPress={() => setScreen('home')}><Text style={styles.refreshText}>{tr('← Ku noqo alaabta', '← Back to Products')}</Text></TouchableOpacity>
        {(selectedProduct.image_urls?.length ? selectedProduct.image_urls : (selectedProduct.image_url ? [selectedProduct.image_url] : [])).length > 0 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 14 }}>{(selectedProduct.image_urls?.length ? selectedProduct.image_urls : [selectedProduct.image_url!]).map((uri, index) => <Image key={selectedProduct.id + '-image-' + index} source={{ uri }} style={{ width: 280, height: 240, borderRadius: 18, marginRight: 10 }} resizeMode="cover" />)}</ScrollView> : <View style={[styles.imagePlaceholder, { height: 220, marginVertical: 14 }]}><Text style={styles.placeholderText}>🍬</Text></View>}
        <Text style={styles.sectionTitle}>{translateSweetName(selectedProduct.name, language)}</Text>
        <Text style={styles.productCategory}>{translateSweetName(selectedProduct.category, language)}</Text>
        <Text style={[styles.productPrice, { fontSize: 22, marginVertical: 10 }]}>{money(selectedProduct.price)}</Text>
        <Text style={styles.shopStatusText}>{selectedProduct.description?.trim() || tr('Sharaxaad dheeraad ah weli lama gelin.', 'No additional description has been added yet.')}</Text>
        <Text style={styles.stockText}>{selectedProduct.stock > 0 ? `${tr('Kaydka:', 'Stock:')} ${selectedProduct.stock}` : tr('Waa dhammaatay', 'Out of stock')}</Text>
        <TouchableOpacity style={[styles.primaryButton, selectedProduct.stock <= 0 && styles.disabledButton]} disabled={selectedProduct.stock <= 0} onPress={() => addToCart(selectedProduct)}>
          <Text style={styles.buttonText}>{tr("Ku dar cart-ka", "Add to cart")}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderCart = () => (
    <View>
      <Text style={styles.sectionTitle}>{tr("Cart-kaaga", "Your Cart")}</Text>

      {cart.length === 0 ? (
        <Text style={styles.emptyText}>{tr("Cart-kaagu waa madhan yahay.", "Your cart is empty.")}</Text>
      ) : (
        <>
          {cart.map(item => (
            <View key={item.id} style={styles.cartItem}>
              <View style={styles.cartInfo}>
                <Text style={styles.productName} >{translateSweetName(item.name, language)}</Text>
                <Text style={styles.productPrice}>
                  {money(item.price * item.quantity)}
                </Text>
              </View>

              <View style={styles.quantityControls}>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => changeQuantity(item.id, -1)}
                >
                  <Text style={styles.quantityButtonText}>−</Text>
                </TouchableOpacity>

                <Text style={styles.quantityText}>{item.quantity}</Text>

                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => {
                    if (item.quantity >= item.stock) {
                      Alert.alert('IMSIYA', tr('Kaydka intaas kuma filna.', 'Not enough stock available.'));
                      return;
                    }
                    changeQuantity(item.id, 1);
                  }}
                >
                  <Text style={styles.quantityButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{tr("Wadarta", "Total")}</Text>
            <Text style={styles.totalAmount}>{money(cartTotal)}</Text>
          </View>

          <View style={styles.checkoutPaymentCard}>
            <Text style={styles.checkoutSectionTitle}>{tr("Habka lacag-bixinta", "Payment Method")}</Text>
            <View style={styles.checkoutPaypalRow}>
              <View style={styles.checkoutPaypalMark}><Text style={styles.checkoutPaypalP}>P</Text></View>
              <View style={styles.checkoutPaypalInfo}>
                <Text style={styles.checkoutPaypalTitle}>PayPal</Text>
                <Text style={styles.checkoutPaypalSubtitle}>{tr("Lacag-bixin ammaan ah", "Secure Payment")}</Text>
              </View>
              <Text style={styles.checkoutSelected}>{'✓'}</Text>
            </View>
            <View style={styles.checkoutSecurityNote}>
              <Text style={styles.checkoutShield}>✓</Text>
              <Text style={styles.checkoutSecurityText}>{tr("Lacag-bixintaadu waa ammaan oo siraysan.", "Your payment is secure and encrypted.")}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.checkoutPaypalButton, checkoutLoading && styles.disabledButton]}
            onPress={checkoutCart}
            disabled={checkoutLoading}
          >
            {checkoutLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.checkoutPaypalButtonContent}>
                <Text style={styles.checkoutButtonP}>P</Text>
                <Text style={styles.checkoutPaypalButtonText}>{tr("Ku bixi hadda PayPal", "Pay Now with PayPal")}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => setCart([])}
          >
            <Text style={styles.secondaryButtonText}>{tr("Nadiifi cart-ka", "Clear cart")}</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );

  const renderAdmin = () => (
    <View>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>{tr("Maamulka IMSIYA", "IMSIYA Admin")}</Text>
        <Text style={styles.heroText}>Super Admin Dashboard · {session?.user?.email}</Text>
      </View>
      {profileRole === 'super_admin' && (
        <View style={styles.shopStatusCard}>
          <Text style={styles.shopStatusTitle}>{tr('PayPal LIVE — $20 bishii', 'PayPal LIVE — $20/month')}</Text>
          <Text style={styles.shopStatusText}>{tr('Diyaari oo xaqiiji product-ka iyo billing plan-ka. Tani ma bilaabayso subscription, mana qaaddo lacag.', 'Set up and verify the product and billing plan. This will not start a subscription or charge money.')}</Text>
          <TouchableOpacity style={[styles.primaryButton, planSetupLoading && styles.disabledButton]} onPress={setupPayPalPlan} disabled={planSetupLoading}>
            {planSetupLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{tr('Diyaari PayPal LIVE Plan', 'Set up PayPal LIVE Plan')}</Text>}
          </TouchableOpacity>
          {!!planSetupMessage && (
            <Text style={[styles.shopStatusText, { color: planSetupError ? '#b42318' : '#18794e', marginTop: 10 }]}>
              {planSetupMessage}
            </Text>
          )}
        </View>
      )}
      <View style={styles.shopStatusCard}>
        <Text style={styles.shopStatusTitle}>{tr("Codsiyada iibiyeyaasha", "Seller Applications")}</Text>
        <Text style={styles.shopStatusText}>{tr('Sugaya ansixinta:', 'Awaiting approval:')} {pendingSellers.length}</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={loadAdminData}>
          <Text style={styles.buttonText}>{tr("Cusboonaysii", "Refresh")}</Text>
        </TouchableOpacity>
      </View>
      {adminLoading ? <ActivityIndicator size="large" color="#4A286B" /> : pendingSellers.length === 0 ? (
        <Text style={styles.emptyText}>{tr('Ma jiraan codsiyo sugaya ansixin.', 'There are no applications awaiting approval.')}</Text>
      ) : pendingSellers.map((seller) => (
        <View key={seller.id} style={styles.shopStatusCard}>
          <Text style={styles.shopStatusTitle}>{seller.shop_name}</Text>
          <Text style={styles.shopStatusText}>{seller.description || tr('Sharaxaad ma jirto', 'No description provided')}</Text>
          <Text style={styles.shopStatusText}>Seller ID: {seller.id}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => approveSeller(seller.id)}>
            <Text style={styles.buttonText}>{tr('Ansixi iibiyahan', 'Approve this seller')}</Text>
          </TouchableOpacity>
        </View>
      ))}
      <Text style={styles.emptyText}>{tr('Xusuusin: ansixinta iibiyaha ma dhaqaajiso dukaanka ilaa lacagta subscription-ka $20 la xaqiijiyo.', 'Note: approving a seller does not activate the shop until the $20 subscription payment is verified.')}</Text>

      <View style={styles.shopStatusCard}>
        <Text style={styles.shopStatusTitle}>{tr("Guudmar maamulka", "Admin Overview")}</Text>
        <Text style={styles.shopStatusText}>{tr('Dalabyada:', 'Orders:')} {adminOrders.length} {tr('kii ugu dambeeyey', 'most recent')}</Text>
        <Text style={styles.shopStatusText}>Subscriptions: {adminSubscriptions.length} {tr('kii ugu dambeeyey', 'most recent')}</Text>
        <Text style={styles.shopStatusText}>Wallet transactions: {adminWallet.length} {tr('kii ugu dambeeyey', 'most recent')}</Text>
      </View>

      <Text style={styles.sectionTitle}>{tr("Dalabyada macaamiisha", "Customer Orders")}</Text>
      {adminOrders.length === 0 ? <Text style={styles.emptyText}>{tr('Weli dalab ma jiro.', 'No orders yet.')}</Text> : adminOrders.map(order => (
        <View key={order.id} style={styles.shopStatusCard}>
          <Text style={styles.shopStatusTitle}>{order.currency || 'KES'} {Number(order.total_amount || 0).toLocaleString('en-KE')}</Text>
          <Text style={styles.shopStatusText}>{tr('Xaalad:', 'Status:')} {orderStatusLabel(order.status, order.payment_status, language)} · {tr('Bixin:', 'Payment:')} {order.payment_status}</Text>
          <Text style={styles.shopStatusText}>{tr('Habka:', 'Method:')} {order.payment_method || tr('Lama cayimin', 'Not specified')}</Text>
          <Text style={styles.shopStatusText}>Order ID: {order.id}</Text>
          <Text style={styles.shopStatusText}>{new Date(order.created_at).toLocaleString()}</Text>
          {order.payment_status === 'paid' && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {order.status === 'pending' && <TouchableOpacity style={[styles.secondaryButton, { flexGrow: 1 }]} onPress={() => updateOrderTrackingStatus(order.id, 'processing')}><Text style={styles.secondaryButtonText}>{tr('Bilow diyaarinta', 'Start preparing')}</Text></TouchableOpacity>}
              {order.status === 'processing' && <TouchableOpacity style={[styles.secondaryButton, { flexGrow: 1 }]} onPress={() => updateOrderTrackingStatus(order.id, 'shipped')}><Text style={styles.secondaryButtonText}>{tr('Dalabka dir', 'Ship order')}</Text></TouchableOpacity>}
              {order.status === 'shipped' && <TouchableOpacity style={[styles.secondaryButton, { flexGrow: 1 }]} onPress={() => updateOrderTrackingStatus(order.id, 'delivered')}><Text style={styles.secondaryButtonText}>{tr('Xaqiiji gaarsiinta', 'Confirm delivery')}</Text></TouchableOpacity>}
              {order.status === 'delivered' && <Text style={styles.shopStatusText}>{tr('Dalabkan waa la gaarsiiyey.', 'This order has been delivered.')}</Text>}
            </View>
          )}
        </View>
      ))}

      <Text style={styles.sectionTitle}>{tr("Lacagaha dukaamada ($20 bishii)", "Shop Subscriptions ($20/month)")}</Text>
      {adminSubscriptions.length === 0 ? <Text style={styles.emptyText}>{tr('Weli subscription lama diiwaangelin.', 'No subscriptions have been recorded yet.')}</Text> : adminSubscriptions.map(sub => (
        <View key={sub.id} style={styles.shopStatusCard}>
          <Text style={styles.shopStatusTitle}>{sub.currency || 'USD'} {Number(sub.amount || 0).toFixed(2)} · {sub.status}</Text>
          <Text style={styles.shopStatusText}>Shop ID: {sub.shop_id}</Text>
          <Text style={styles.shopStatusText}>{tr('Bilow:', 'Started:')} {sub.started_at ? new Date(sub.started_at).toLocaleDateString() : '—'}</Text>
          <Text style={styles.shopStatusText}>{tr('Dhamaad:', 'Expires:')} {sub.expires_at ? new Date(sub.expires_at).toLocaleDateString() : '—'}</Text>
        </View>
      ))}

      <Text style={styles.sectionTitle}>{tr("Codsiyada lacag-bixinta iibiyeyaasha", "Seller Payout Requests")}</Text>
      {adminPayoutRequests.length === 0 ? <Text style={styles.emptyText}>{tr('Weli codsi lacag-bixin ma jiro.', 'No payout requests yet.')}</Text> : adminPayoutRequests.map(req => (
        <View key={req.id} style={styles.shopStatusCard}>
          <Text style={styles.shopStatusTitle}>{money(Number(req.amount || 0))} · PayPal</Text>
          <Text style={styles.shopStatusText}>Seller ID: {req.seller_id}</Text>
          <Text style={styles.shopStatusText}>{tr('Ogow: lacagta marka hore ku dir PayPal; badhanka hoose wuxuu diiwaangelinayaa oo keliya bixinta aad hore u samaysay.', 'Important: send the money through PayPal first; the button below only records a transfer you have already made.')}</Text>
          <Text style={styles.shopStatusText}>{tr('Akoonka lacagta:', 'Payout account:')} {req.payout_account || '—'}</Text>
          <Text style={styles.shopStatusText}>{tr('Xaalad:', 'Status:')} {req.status}</Text>
          {req.status === 'pending' || req.status === 'processing' ? <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={[styles.secondaryButton, { flex: 1 }]} onPress={() => updatePayoutRequestStatus(req.id, 'paid')}><Text style={styles.secondaryButtonText}>{tr('Xaqiiji: PayPal waa la diray', 'Confirm: PayPal transfer sent')}</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.secondaryButton, { flex: 1 }]} onPress={() => updatePayoutRequestStatus(req.id, 'rejected')}><Text style={styles.secondaryButtonText}>{tr('Diid codsiga', 'Reject request')}</Text></TouchableOpacity>
          </View> : null}
        </View>
      ))}

      <Text style={styles.sectionTitle}>{tr('Codsiyada tirtirka akoonka', 'Account deletion requests')} ({adminDeletionRequests.filter(item => item.status === 'pending' || item.status === 'reviewing').length})</Text>
      {adminDeletionRequests.length === 0 ? <Text style={styles.emptyText}>{tr('Codsi tirtirid ma jiro.', 'No account deletion requests.')}</Text> : adminDeletionRequests.map(request => (
        <View key={request.id} style={styles.shopStatusCard}>
          <Text style={styles.shopStatusTitle}>{request.requester_email || request.requester_id}</Text>
          <Text style={styles.shopStatusText}>User ID: {request.requester_id}</Text>
          <Text style={styles.shopStatusText}>{tr('Xaalad:', 'Status:')} {request.status} · {new Date(request.requested_at).toLocaleString()}</Text>
          {request.status === 'pending' || request.status === 'reviewing' ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {request.status === 'pending' && <TouchableOpacity style={[styles.secondaryButton, { flex: 1 }]} onPress={() => updateAccountDeletionRequest(request.id, 'reviewing')}><Text style={styles.secondaryButtonText}>{tr('Bilow dib-u-eegista', 'Start review')}</Text></TouchableOpacity>}
            <TouchableOpacity style={[styles.secondaryButton, { flex: 1 }]} onPress={() => Alert.alert(tr('Xaqiiji tirtirka akoonka', 'Confirm account deletion'), tr('Tani waxay tirtiraysaa akoonka iyo xogta shakhsiga ah. Diiwaannada lacagaha iyo dalabyada ee loo baahan yahay waa la hayn karaa.', 'This permanently deletes the account and personal profile. Required order and payment records may be retained.'), [{ text: tr('Jooji', 'Cancel'), style: 'cancel' }, { text: tr('Tirtir akoonka', 'Delete account'), style: 'destructive', onPress: () => updateAccountDeletionRequest(request.id, 'completed') }])}><Text style={styles.secondaryButtonText}>{tr('Tirtir akoonka oo dhammee', 'Delete account & complete')}</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.secondaryButton, { flex: 1 }]} onPress={() => updateAccountDeletionRequest(request.id, 'rejected')}><Text style={styles.secondaryButtonText}>{tr('Diid codsiga', 'Reject request')}</Text></TouchableOpacity>
          </View> : <Text style={styles.shopStatusText}>{request.processed_at ? new Date(request.processed_at).toLocaleString() : ''}</Text>}
        </View>
      ))}

      <Text style={styles.sectionTitle}>{tr("Dhaqdhaqaaqa wallet-ka iibiyeyaasha", "Seller Wallet Activity")}</Text>
      {adminWallet.length === 0 ? <Text style={styles.emptyText}>{tr('Weli dhaqdhaqaaq wallet ma jiro.', 'No wallet activity yet.')}</Text> : adminWallet.map(tx => (
        <View key={tx.id} style={styles.shopStatusCard}>
          <Text style={styles.shopStatusTitle}>{money(Number(tx.amount || 0))} · {tx.transaction_type}</Text>
          <Text style={styles.shopStatusText}>{tx.description || tr('Faahfaahin ma jirto', 'No details provided')}</Text>
          <Text style={styles.shopStatusText}>Seller ID: {tx.seller_id}</Text>
          <Text style={styles.shopStatusText}>Order ID: {tx.order_id || '—'}</Text>
        </View>
      ))}
    </View>
  );

  const renderShop = () => (
    <View style={styles.myShopScreen}>
      <View style={styles.myShopHeader}>
        <View style={styles.myShopHeaderIcon}><Text style={styles.myShopHeaderEmoji}>🏪</Text></View>
        <View style={styles.myShopHeaderCopy}>
          <Text style={styles.myShopEyebrow}>{tr("IMSIYA IIBIYE", "IMSIYA SELLER")}</Text>
          <Text style={styles.myShopTitle}>{tr("Dukaankayga", "My Shop")}</Text>
          <Text style={styles.myShopSubtitle}>{tr("Maamul dukaankaaga iyo alaabta aad iibiso.", "Manage your shop and the products you sell.")}</Text>
        </View>
      </View>
      {shopLoading ? (
        <View style={styles.myShopLoading}><ActivityIndicator size="large" color="#4A286B" /><Text style={styles.myShopHint}>{tr("Dukaanka waa la soo rarayaa...", "Loading your shop...")}</Text></View>
      ) : (
        <>
          <View style={styles.myShopPanel}>
            <View style={styles.myShopSectionHeading}>
              <Text style={styles.myShopSectionIcon}>✦</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.myShopSectionTitle}>{tr("Xogta dukaanka", "Shop Details")}</Text>
                <Text style={styles.myShopHint}>{tr("Macluumaadka ay macaamiishu arki doonaan.", "Information customers will see.")}</Text>
              </View>
            </View>
            <Text style={styles.label}>{tr("Magaca dukaanka", "Shop Name")}</Text>
            <TextInput style={styles.input} placeholder={tr("Tusaale: IMSIYA Sweets", "Example: IMSIYA Sweets")} value={shopName} onChangeText={setShopName} />
            <Text style={styles.label}>{tr("Sharaxaadda dukaanka", "Shop Description")}</Text>
            <TextInput style={[styles.input, styles.multilineInput]} placeholder={tr("Wax ka sheeg dukaankaaga...", "Tell customers about your shop...")} value={shopDescription} onChangeText={setShopDescription} multiline />
            <TouchableOpacity style={styles.primaryButton} onPress={createOrUpdateShop} disabled={shopLoading}>
              <Text style={styles.buttonText}>{tr("Kaydi xogta dukaanka", "Save Shop Details")}</Text>
            </TouchableOpacity>
          </View>

          {myShop && (
            <View style={styles.myShopStatusPanel}>
              <View style={styles.myShopStatusTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.myShopEyebrow}>{tr("XAALADDA DUKAANKA", "SHOP STATUS")}</Text>
                  <Text style={styles.myShopStatusName}>{myShop.shop_name}</Text>
                </View>
                <View style={[styles.myShopStatusPill, myShop.active ? styles.myShopStatusOpen : styles.myShopStatusPending]}>
                  <Text style={[styles.myShopStatusPillText, myShop.active ? styles.myShopStatusOpenText : styles.myShopStatusPendingText]}>{myShop.active ? tr("● Furan", "● Open") : tr("● Sugaya", "● Pending")}</Text>
                </View>
              </View>
              <Text style={styles.myShopHint}>{tr("Qiimaha adeegga dukaanka", "Shop subscription")}</Text>
              <Text style={styles.myShopSubscription}>$20 <Text style={styles.myShopSubscriptionPeriod}>{tr("USD / bishii", "USD / month")}</Text></Text>
              <TouchableOpacity style={styles.myShopOutlineButton} onPress={loadMyShop} disabled={shopLoading}>
                <Text style={styles.myShopOutlineButtonText}>{tr("↻  Hubi xaaladda dukaanka", "↻  Check Shop Status")}</Text>
              </TouchableOpacity>
              {!myShop.active && (
                <TouchableOpacity style={styles.primaryButton} onPress={payShopSubscription} disabled={paymentLoading}>
                  {paymentLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{tr("Bixi $20 bishii — PayPal", "Pay $20 monthly — PayPal")}</Text>}
                </TouchableOpacity>
              )}
              {!!paymentError && (
                <Text style={{ color: '#B42318', marginTop: 10, fontSize: 13, lineHeight: 19 }}>
                  {paymentError}
                </Text>
              )}
            </View>
          )}

          <View style={styles.myShopSectionBar}>
            <View style={{ flex: 1 }}>
              <Text style={styles.myShopSectionTitle}>{tr("Dalabyada dukaankayga", "Shop Orders")}</Text>
              <Text style={styles.myShopHint}>{tr("La soco iibka iyo dalabyada macaamiisha.", "Track customer purchases and sales orders.")}</Text>
            </View>
            <Text style={styles.myShopSectionIcon}>📦</Text>
          </View>
          <TouchableOpacity style={styles.myShopActionButton} onPress={() => { setScreen('seller-orders'); loadMySellerOrders(); }}>
            <Text style={styles.myShopActionIcon}>🧾</Text>
            <Text style={styles.myShopActionText}>{tr("Eeg dalabyada iibka", "View Sales Orders")}</Text>
            <Text style={styles.myShopActionArrow}>›</Text>
          </TouchableOpacity>

          <View style={styles.myShopSectionBar}>
            <View style={{ flex: 1 }}>
              <Text style={styles.myShopSectionTitle}>{tr("Alaabtayda", "My Products")}</Text>
              <Text style={styles.myShopHint}>{tr("Maamul macmacaanka aad iibinayso.", "Manage the sweets you are selling.")}</Text>
            </View>
            <Text style={styles.myShopSectionIcon}>🍰</Text>
          </View>
          <TouchableOpacity style={styles.myShopOutlineButton} onPress={loadMySellerProducts} disabled={sellerProductsLoading}>
            {sellerProductsLoading ? <ActivityIndicator size="small" color="#4A286B" /> : <Text style={styles.myShopOutlineButtonText}>↻  {tr("Cusboonaysii alaabta", "Refresh Products")}</Text>}
          </TouchableOpacity>
          {sellerProductsLoading ? <ActivityIndicator color="#4A286B" /> : sellerProducts.length === 0 ? (
            <View style={styles.myShopEmpty}>
              <Text style={styles.myShopEmptyIcon}>🧁</Text>
              <Text style={styles.myShopEmptyTitle}>{tr("Weli alaab kuma jirto", "No products yet")}</Text>
              <Text style={styles.myShopHint}>{tr("Ku dar alaabtaada koowaad si macaamiishu u arkaan.", "Add your first product so customers can discover it.")}</Text>
            </View>
          ) : sellerProducts.map(item => (
            <View key={item.id} style={styles.myShopProductCard}>
              {item.image_url ? <Image source={{ uri: item.image_url }} style={styles.myShopProductImage} resizeMode="cover" /> : <View style={styles.myShopProductPlaceholder}><Text style={{ fontSize: 27 }}>🍰</Text></View>}
              <View style={styles.myShopProductInfo}>
                <Text style={styles.myShopProductName}>{translateSweetName(item.name, language)}</Text>
                <Text style={styles.myShopProductPrice}>{money(item.price)}</Text>
                <Text style={styles.myShopHint}>{tr("Kaydka", "Stock")}: {item.stock}</Text>
                <View style={styles.myShopProductActions}>
                  <TouchableOpacity style={styles.myShopEditButton} onPress={() => beginEditProduct(item)}><Text style={styles.myShopEditText}>{tr("Tafatir", "Edit")}</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.myShopDeleteButton} onPress={() => deleteSellerProduct(item.id)}><Text style={styles.myShopDeleteText}>{tr("Tirtir", "Delete")}</Text></TouchableOpacity>
                </View>
              </View>
            </View>
          ))}

          <View style={styles.myShopPanel}>
            <View style={styles.myShopSectionHeading}>
              <Text style={styles.myShopSectionIcon}>{editingProductId ? "✎" : "＋"}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.myShopSectionTitle}>{editingProductId ? tr("Tafatir alaabta", "Edit Product") : tr("Ku dar alaab cusub", "Add a New Product")}</Text>
                <Text style={styles.myShopHint}>{tr("Geli faahfaahinta alaabtaada.", "Enter the details of your product.")}</Text>
              </View>
            </View>
            {editingProductId && <TouchableOpacity style={styles.myShopCancelEdit} onPress={() => { setEditingProductId(null); setProductName(''); setProductDescription(''); setProductPrice(''); setProductStock('10'); setProductImages([]); setProductImageMimeTypes([]); setProductCategory('Buskut'); }}><Text style={styles.refreshText}>{tr("Jooji tafatirka", "Cancel Editing")}</Text></TouchableOpacity>}
            <Text style={styles.label}>{tr("Magaca alaabta", "Product Name")}</Text>
            <TextInput style={styles.input} placeholder={tr("Magaca macmacaanka", "Sweet Name")} value={productName} onChangeText={setProductName} />
            <Text style={styles.label}>{tr("Sharaxaadda", "Description")}</Text>
            <TextInput style={styles.input} placeholder={tr("Sharax alaabta", "Describe the product")} value={productDescription} onChangeText={setProductDescription} />
            <Text style={styles.label}>{tr("Qiimaha (KSh)", "Price (KSh)")}</Text>
            <TextInput style={styles.input} placeholder={language === 'so' ? 'Tusaale: 500' : language === 'ar' ? 'مثال: 500' : language === 'sw' ? 'Mfano: 500' : 'Example: 500'} value={productPrice} onChangeText={setProductPrice} keyboardType="numeric" />
            <Text style={styles.label}>{tr("Tirada kaydka", "Stock Quantity")}</Text>
            <TextInput style={styles.input} placeholder="10" value={productStock} onChangeText={setProductStock} keyboardType="numeric" />
            <Text style={styles.label}>{tr("Sawirrada alaabta (ugu badnaan 5)", "Product Photos (up to 5)")}</Text>
            <TouchableOpacity style={styles.myShopOutlineButton} onPress={pickProductImage} disabled={productImageUploading || productImages.length >= 5}>
              <Text style={styles.myShopOutlineButtonText}>{tr("＋  Ku dar sawir", "＋  Add Photo")} ({productImages.length}/5)</Text>
            </TouchableOpacity>
            {productImages.length > 0 ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 10 }}>{productImages.map((uri, index) => <View key={'selected-product-image-' + index} style={{ position: 'relative' }}><Image source={{ uri }} style={{ width: 88, height: 88, borderRadius: 10 }} resizeMode="cover" /><TouchableOpacity onPress={() => { setProductImages(current => current.filter((_, i) => i !== index)); setProductImageMimeTypes(current => current.filter((_, i) => i !== index)); }} style={{ position: 'absolute', top: 3, right: 3, backgroundColor: '#8B1E2D', borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontWeight: '700' }}>×</Text></TouchableOpacity>{index === 0 ? <Text style={{ fontSize: 10, color: '#4A286B', fontWeight: '700', textAlign: 'center' }}>{tr("Sawirka koowaad", "Main photo")}</Text> : null}</View>)}</View> : null}
            <Text style={styles.myShopHint}>{tr("Dooro 1 ilaa 5 sawir. JPG, PNG ama WEBP; mid kasta ugu badnaan 5 MB. Sawirka koowaad ayaa noqonaya kan weyn.", "Choose 1 to 5 photos. JPG, PNG or WEBP; up to 5 MB each. The first photo is the main image.")}</Text>
            <Text style={styles.label}>{tr("Qaybta alaabta", "Product Category")}</Text>
            <View style={styles.categoryChoices}>
              {Array.from(new Set([...categories.slice(1), ...categoryRows.map(item => item.name)])).map(item => (
                <TouchableOpacity key={item} style={[styles.categoryButton, productCategory === item && styles.categorySelected]} onPress={() => setProductCategory(item)}>
                  <Text style={[styles.categoryText, productCategory === item && styles.categorySelectedText]}>{translateSweetName(item, language)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={[styles.primaryButton, addingProduct && styles.disabledButton]} onPress={addProduct} disabled={addingProduct}>
              {addingProduct || productImageUploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{editingProductId ? tr("Kaydi isbeddelka", "Save Changes") : tr("Ku dar alaabta", "Add Product")}</Text>}
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FCFAFE" />
      <Modal visible={languagePickerOpen} transparent animationType="slide" onRequestClose={() => setLanguagePickerOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(20,10,30,0.55)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "78%" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <Text style={{ color: "#38204F", fontSize: 20, fontWeight: "900" }}>Choose language / Dooro luqadda</Text>
              <TouchableOpacity onPress={() => setLanguagePickerOpen(false)}><Text style={{ color: "#5B0AA8", fontSize: 22 }}>×</Text></TouchableOpacity>
            </View>
            <ScrollView>{IMSIYA_LANGUAGES.map(item => <TouchableOpacity key={item[0]} onPress={() => chooseLanguage(item[0])} style={{ flexDirection: "row", alignItems: "center", padding: 13, borderRadius: 12, marginBottom: 5, backgroundColor: language === item[0] ? "#F3E8FA" : "#FFFFFF", borderWidth: 1, borderColor: language === item[0] ? "#5B0AA8" : "#EEE7F3" }}><Text style={{ fontSize: 20, marginRight: 12 }}>{item[1]}</Text><Text style={{ flex: 1, color: "#38204F", fontSize: 15, fontWeight: "700" }}>{item[2]}</Text>{language === item[0] ? <Text style={{ color: "#5B0AA8" }}>✓</Text> : null}</TouchableOpacity>)}</ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={accountDeletionModalOpen} transparent animationType="fade" onRequestClose={() => { if (!accountDeletionSubmitting) setAccountDeletionModalOpen(false); }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(20,10,30,0.58)', justifyContent: 'center', padding: 22 }}>
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 20, padding: 22 }}>
            <Text style={{ color: '#38204F', fontSize: 19, fontWeight: '900', marginBottom: 10 }}>{tr('Codso tirtirka akoonka', 'Request account deletion')}</Text>
            <Text style={{ color: '#5F536A', fontSize: 14, lineHeight: 21, marginBottom: 18 }}>
              {accountDeletionMessage || tr('Codsigaaga waxaa dib u eegaya maamulka IMSIYA. Akoonkaagu wuu sii shaqaynayaa ilaa codsiga la dhammeeyo. Diiwaannada dalabyada iyo lacagaha waxaa laga yaabaa in loo hayo waajibaadka sharci iyo xisaab-celinta.', 'Your request will be reviewed by IMSIYA. Your account remains active until the request is completed. Order and payment records may be retained where required for legal and accounting purposes.')}
            </Text>
            {accountDeletionMessage ? (
              <TouchableOpacity style={[styles.primaryButton, { marginTop: 4 }]} onPress={() => setAccountDeletionModalOpen(false)}>
                <Text style={styles.buttonText}>{tr('Xir', 'Close')}</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
                <TouchableOpacity disabled={accountDeletionSubmitting} style={{ paddingVertical: 13, paddingHorizontal: 15 }} onPress={() => setAccountDeletionModalOpen(false)}>
                  <Text style={{ color: '#6F6478', fontWeight: '800' }}>{tr('Jooji', 'Cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity disabled={accountDeletionSubmitting} style={[styles.primaryButton, { marginTop: 0, minWidth: 130, opacity: accountDeletionSubmitting ? 0.65 : 1 }]} onPress={submitAccountDeletionRequest}>
                  {accountDeletionSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>{tr('Gudbi codsiga', 'Submit request')}</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <View style={styles.header}>
        <TouchableOpacity style={styles.headerMenuButton} onPress={() => setScreen('profile')} accessibilityLabel="Menu">
          <Text style={styles.headerMenuIcon}>☰</Text>
        </TouchableOpacity>
        <View style={styles.headerBrand}>
          <Text style={styles.headerLogo}>IMSIYA</Text>
          <Text style={styles.headerSubtitle}>{tr("Suuqa macmacaanka", "Sweetness for Everyone")}</Text>
        </View>
        <TouchableOpacity style={styles.headerCartButton} onPress={() => setScreen('cart')} accessibilityLabel="Cart">
          <Text style={styles.headerCartIcon}>🛒</Text>
          {cart.reduce((sum, item) => sum + item.quantity, 0) > 0 && <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{cart.reduce((sum, item) => sum + item.quantity, 0)}</Text></View>}
        </TouchableOpacity>
      </View>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        {screen === 'home' && renderHome()}
        {screen === 'cart' && renderCart()}
        {screen === 'shop' && renderShop()}
        {screen === 'admin' && isAdmin && renderAdmin()}
        {screen === 'profile' && renderProfile()}
        {screen === 'favorites' && renderFavorites()}
        {screen === 'orders' && renderOrderHistory()}
        {screen === 'seller-orders' && renderSellerOrders()}
        {screen === 'wallet' && renderSellerWallet()}
        {screen === 'product' && renderProductDetails()}
        {screen === 'rewards' && renderRewards()}
      </ScrollView>

      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setScreen('home')}
        >
          <Text style={styles.navIcon}>🏠</Text>
          <Text style={styles.navText}>{tr("Hoyga", "Home")}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setScreen('cart')}
        >
          <Text style={styles.navIcon}>🛒</Text>
          <Text style={styles.navText}>
            Cart ({cart.reduce((sum, item) => sum + item.quantity, 0)})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setScreen('shop')}
        >
          <Text style={styles.navIcon}>🏪</Text>
          <Text style={styles.navText}>{tr("Dukaankayga", "My Shop")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => setScreen('profile')}>
          <Text style={styles.navIcon}>👤</Text>
          <Text style={styles.navText}>{tr('My Account', 'My Account')}</Text>
        </TouchableOpacity>
        {isAdmin && (
          <TouchableOpacity style={styles.navItem} onPress={() => { setScreen('admin'); loadAdminData(); }}>
            <Text style={styles.navIcon}>🛡️</Text>
            <Text style={styles.navText}>{tr('Maamulka', 'Admin')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F5FC',
  },
  authContainer: {
    flex: 1,
    backgroundColor: '#FCFAFE',
    justifyContent: 'center',
    padding: 24,
  },
  logo: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#4A286B',
    textAlign: 'center',
    marginBottom: 8,
  },
  authSubtitle: {
    textAlign: 'center',
    color: '#6F6478',
    marginBottom: 30,
    fontSize: 15,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DED2E8',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 15,
    minHeight: 52,
    marginBottom: 15,
    color: '#2E203B',
    fontSize: 16,
  },
  multilineInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  primaryButton: {
    backgroundColor: '#5B0AA8',
    paddingVertical: 17,
    paddingHorizontal: 18,
    minHeight: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 12,
    elevation: 2,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 17,
    letterSpacing: 0.2,
  },
  disabledButton: {
    opacity: 0.5,
  },
  authPage: { paddingTop: 12, paddingBottom: 26 },
  authBrand: { alignItems: 'center', paddingVertical: 24 },
  authBrandIcon: { fontSize: 54, marginBottom: 2 },
  authBrandName: { color: '#4B078B', fontSize: 36, fontWeight: '900', letterSpacing: 1.2 },
  authBrandTagline: { color: '#E99500', fontSize: 14, fontWeight: '800', fontStyle: 'italic', marginTop: 1 },
  authCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 18, borderWidth: 1, borderColor: '#E9E0F1', elevation: 3 },
  authTabs: { flexDirection: 'row', backgroundColor: '#F2EAF9', borderRadius: 18, padding: 4, marginBottom: 22 },
  authTab: { flex: 1, minHeight: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  authTabActive: { backgroundColor: '#5B0AA8', elevation: 2 },
  authTabText: { color: '#35243F', fontSize: 14, fontWeight: '800' },
  authTabTextActive: { color: '#FFFFFF' },
  authHeading: { color: '#35104F', fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 5 },
  authDescription: { color: '#786B82', fontSize: 13, textAlign: 'center', marginBottom: 20 },
  authMessage: { color: '#B3261E', backgroundColor: '#FFF0EF', borderRadius: 12, padding: 11, marginBottom: 12, fontSize: 13, lineHeight: 19 },
  authInputWrap: { minHeight: 52, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4D9ED', borderRadius: 15, paddingHorizontal: 13, marginBottom: 13 },
  authInputIcon: { width: 27, color: '#5B0AA8', fontSize: 17, textAlign: 'center', marginRight: 8 },
  authInput: { flex: 1, minHeight: 50, color: '#2E203B', fontSize: 15, paddingVertical: 8 },
  authPasswordToggle: { minWidth: 40, minHeight: 42, alignItems: 'center', justifyContent: 'center', marginLeft: 5 },
  authPasswordToggleText: { color: '#5B0AA8', fontSize: 19 },
  authForgot: { alignSelf: 'flex-end', paddingVertical: 5, paddingHorizontal: 2 },
  authForgotText: { color: '#5B0AA8', fontWeight: '800', fontSize: 12 },
  authSubmit: { backgroundColor: '#5B0AA8', minHeight: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 13, marginBottom: 14, elevation: 2 },
  authBottomText: { color: '#6F6478', textAlign: 'center', fontSize: 13, marginTop: 3 },
  authBottomLink: { color: '#5B0AA8', fontWeight: '900' },
  authSwitch: {
    padding: 12,
    alignItems: 'center',
  },
  authSwitchText: {
    color: '#4A286B',
    fontWeight: '600',
  },
  header: {
    backgroundColor: '#4B078B',
    paddingHorizontal: 16,
    paddingVertical: 13,
    minHeight: 66,
    borderBottomWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLogo: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 1.4,
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#FFC04D',
    fontWeight: '700',
    fontStyle: 'italic',
    letterSpacing: 0.25,
    textAlign: 'center',
  },
  logoutText: {
    color: '#F09A2A',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 30,
  },
  hero: {
    backgroundColor: '#4B078B',
    borderRadius: 22,
    padding: 22,
    marginBottom: 20,
    borderLeftWidth: 5,
    borderLeftColor: '#F3A33B',
    elevation: 3,
  },
  heroTitle: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  heroText: {
    color: '#F4EAFB',
    fontSize: 14,
    lineHeight: 21,
  },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E7DDF0',
    marginBottom: 14,
    color: '#2E203B',
  },
  categoryScroll: {
    marginBottom: 18,
  },
  categoryButton: {
    backgroundColor: '#F3E8FA',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  categorySelected: {
    backgroundColor: '#5B0AA8',
  },
  categoryText: {
    color: '#624678',
    fontWeight: '600',
    fontSize: 12,
  },
  categorySelectedText: {
    color: '#FFFFFF',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    color: '#38204F',
    fontWeight: '800',
    fontSize: 23,
    letterSpacing: 0.1,
    marginBottom: 15,
  },
  refreshText: {
    color: '#4A286B',
    fontWeight: 'bold',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3E8FA',
    borderWidth: 1,
    borderColor: '#E3D4EF',
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 9,
    gap: 6,
    minHeight: 38,
  },
  refreshWideButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F2FA',
    borderWidth: 1,
    borderColor: '#E3D4EF',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 15,
    marginBottom: 14,
    gap: 8,
  },
  refreshIcon: {
    color: '#4A286B',
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 21,
  },
  refreshButtonText: {
    color: '#4A286B',
    fontWeight: '800',
    fontSize: 13,
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  favoriteToggle: { alignSelf: 'flex-end', paddingHorizontal: 5, paddingVertical: 1 },
  favoriteToggleText: { color: '#F09A2A', fontSize: 22, fontWeight: 'bold' },
  profileAction: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E7DDF0', borderRadius: 15, padding: 16, marginBottom: 10 },
  profileActionText: { color: '#4A286B', fontWeight: '800', fontSize: 16 },
  productCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E7DDF0',
    elevation: 2,
  },
  productImage: {
    width: '100%',
    height: 115,
    borderRadius: 10,
    backgroundColor: '#F2EAF8',
  },
  imagePlaceholder: {
    height: 115,
    borderRadius: 10,
    backgroundColor: '#F2EAF8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 42,
  },
  productName: {
    color: '#2E203B',
    fontWeight: '800',
    fontSize: 16,
    lineHeight: 22,
    marginTop: 10,
  },
  productCategory: {
    color: '#756780',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 5,
  },
  productPrice: {
    color: '#4A286B',
    fontWeight: '800',
    fontSize: 17,
    marginTop: 7,
  },
  stockText: {
    color: '#6F6478',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 5,
  },
  emptyText: {
    color: '#6F6478',
    textAlign: 'center',
    padding: 25,
  },
  errorText: {
    color: '#B3261E',
    padding: 12,
  },
  cartItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E7DDF0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cartInfo: {
    flex: 1,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  quantityButton: {
    backgroundColor: '#F3E8FA',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    color: '#38204F',
    fontSize: 20,
    fontWeight: 'bold',
  },
  quantityText: {
    color: '#2E203B',
    fontWeight: 'bold',
    paddingHorizontal: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 18,
  },
  totalLabel: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#38204F',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4A286B',
  },
  secondaryButton: {
    backgroundColor: '#F7F2FA',
    borderWidth: 1,
    borderColor: '#DCCCE9',
    paddingVertical: 15,
    paddingHorizontal: 16,
    minHeight: 50,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#4A286B',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.1,
  },
  label: {
    color: '#38204F',
    fontWeight: '700',
    fontSize: 15,
    marginBottom: 8,
    marginTop: 10,
  },
  shopStatusCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 14,
    marginTop: 15,
    borderWidth: 1,
    borderColor: '#E7DDF0',
  },
  shopStatusTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#38204F',
    marginBottom: 9,
  },
  shopStatusText: {
    color: '#6F6478',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 7,
  },
  divider: {
    height: 1,
    backgroundColor: '#E7DDF0',
    marginVertical: 24,
  },
  categoryChoices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E9E0F1',
    paddingVertical: 9,
    elevation: 8,
    justifyContent: 'space-around',
  },
  navItem: {
    alignItems: 'center',
    minWidth: 75,
  },
  navIcon: {
    fontSize: 21,
  },
  navText: {
    color: '#624678',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },

  headerMenuButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  headerMenuIcon: { color: '#FFFFFF', fontSize: 25, fontWeight: '700' },
  headerBrand: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerCartButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  headerCartIcon: { color: '#FFFFFF', fontSize: 23 },
  cartBadge: { position: 'absolute', top: 0, right: 0, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: '#FF8A00', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  cartBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  homeSearchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 17, borderWidth: 1, borderColor: '#E9E0F1', paddingHorizontal: 12, marginBottom: 16, minHeight: 49, elevation: 1 },
  searchGlyph: { color: '#5B12A8', fontSize: 25, marginRight: 8 },
  searchFilter: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#F3EAFB', alignItems: 'center', justifyContent: 'center' },
  searchFilterText: { color: '#5B12A8', fontSize: 22, fontWeight: '800' },
  promoBanner: { minHeight: 166, borderRadius: 23, backgroundColor: '#4B078B', padding: 18, marginBottom: 22, flexDirection: 'row', overflow: 'hidden', alignItems: 'center', elevation: 4 },
  promoCopy: { flex: 1, zIndex: 2 },
  promoEyebrow: { color: '#FFC04D', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 7 },
  promoTitle: { color: '#FFFFFF', fontSize: 23, lineHeight: 27, fontWeight: '900', marginBottom: 4 },
  promoSubtitle: { color: '#F8EFFF', fontSize: 14, fontWeight: '700', marginBottom: 12 },
  promoButton: { alignSelf: 'flex-start', backgroundColor: '#FF9D00', borderRadius: 18, paddingVertical: 9, paddingHorizontal: 13 },
  promoButtonText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12 },
  promoArt: { width: 116, height: 116, borderRadius: 58, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginLeft: 8, zIndex: 1, overflow: 'hidden' },
  promoImage: { width: '100%', height: '100%' },
  promoEmoji: { fontSize: 64 },
  promoOrb: { position: 'absolute', width: 170, height: 170, borderRadius: 85, backgroundColor: '#FF9D00', right: -70, top: -92, opacity: 0.95 },
  seeAllText: { color: '#5B0AA8', fontSize: 12, fontWeight: '900' },
  homeCategoryGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 23, gap: 8 },
  homeCategoryCard: { flex: 1, minHeight: 94, borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F0E8F6', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, elevation: 1 },
  homeCategoryActive: { borderColor: '#5B0AA8', backgroundColor: '#F4EAFE' },
  homeCategoryIcon: { fontSize: 29, marginBottom: 7 },
  homeCategoryName: { color: '#33243D', fontSize: 11, fontWeight: '800', textAlign: 'center' },
  homeCategoryNameActive: { color: '#5B0AA8' },
  productSectionTools: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },

  myShopScreen: { paddingBottom: 24 },
  myShopHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#4A286B', borderRadius: 22, padding: 18, marginBottom: 18, borderLeftWidth: 5, borderLeftColor: '#F3A33B', elevation: 3 },
  myShopHeaderIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginRight: 13 },
  myShopHeaderEmoji: { fontSize: 28 },
  myShopHeaderCopy: { flex: 1 },
  myShopEyebrow: { color: '#F3A33B', fontSize: 13, fontWeight: '900', letterSpacing: 1.5, marginBottom: 4 },
  myShopTitle: { color: '#FFFFFF', fontSize: 27, fontWeight: '900', marginBottom: 4 },
  myShopSubtitle: { color: '#F4EAFB', fontSize: 16, lineHeight: 24 },
  myShopPanel: { backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#E7DDF0', padding: 16, marginBottom: 18, elevation: 1 },
  myShopSectionHeading: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  myShopSectionIcon: { fontSize: 23, marginRight: 11, color: '#F09A2A' },
  myShopSectionTitle: { color: '#38204F', fontSize: 21, fontWeight: '900', marginBottom: 3 },
  myShopHint: { color: '#81738B', fontSize: 15, lineHeight: 22 },
  myShopLoading: { alignItems: 'center', padding: 28 },
  myShopStatusPanel: { backgroundColor: '#38204F', borderRadius: 21, padding: 18, marginBottom: 22, elevation: 3 },
  myShopStatusTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  myShopStatusName: { color: '#FFFFFF', fontSize: 23, fontWeight: '900', marginTop: 2 },
  myShopStatusPill: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 20, marginLeft: 8 },
  myShopStatusOpen: { backgroundColor: '#DDF7E8' },
  myShopStatusPending: { backgroundColor: '#FFF0D9' },
  myShopStatusPillText: { fontSize: 13, fontWeight: '900' },
  myShopStatusOpenText: { color: '#167343' },
  myShopStatusPendingText: { color: '#9A5A13' },
  myShopSubscription: { color: '#FFFFFF', fontSize: 27, fontWeight: '900', marginTop: 4, marginBottom: 8 },
  myShopSubscriptionPeriod: { color: '#E9DDF3', fontSize: 16, fontWeight: '600' },
  myShopOutlineButton: { backgroundColor: '#F5F0F9', borderWidth: 1, borderColor: '#DED2E8', borderRadius: 14, paddingVertical: 13, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center', marginTop: 10, marginBottom: 8, minHeight: 48 },
  myShopOutlineButtonText: { color: '#4A286B', fontSize: 16, fontWeight: '800' },
  myShopSectionBar: { flexDirection: 'row', alignItems: 'center', marginTop: 9, marginBottom: 11, paddingHorizontal: 2 },
  myShopActionButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E7DDF0', padding: 15, marginBottom: 20 },
  myShopActionIcon: { fontSize: 22, marginRight: 12 },
  myShopActionText: { color: '#4A286B', fontSize: 18, fontWeight: '800', flex: 1 },
  myShopActionArrow: { color: '#F09A2A', fontSize: 27, fontWeight: '700' },
  myShopEmpty: { alignItems: 'center', backgroundColor: '#F7F2FA', borderWidth: 1, borderColor: '#E7DDF0', borderRadius: 18, padding: 23, marginBottom: 18 },
  myShopEmptyIcon: { fontSize: 34, marginBottom: 8 },
  myShopEmptyTitle: { color: '#38204F', fontSize: 19, fontWeight: '900', marginBottom: 5 },
  myShopProductCard: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E7DDF0', borderRadius: 17, padding: 11, marginBottom: 11, elevation: 1 },
  myShopProductImage: { width: 104, height: 112, borderRadius: 12, backgroundColor: '#F2EAF8', marginRight: 12 },
  myShopProductPlaceholder: { width: 104, height: 112, borderRadius: 12, backgroundColor: '#F2EAF8', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  myShopProductInfo: { flex: 1, justifyContent: 'center' },
  myShopProductName: { color: '#2E203B', fontSize: 18, fontWeight: '900', marginBottom: 4 },
  myShopProductPrice: { color: '#4A286B', fontSize: 19, fontWeight: '900', marginBottom: 3 },
  myShopProductActions: { flexDirection: 'row', gap: 8, marginTop: 9 },
  myShopEditButton: { flex: 1, backgroundColor: '#F3E8FA', borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  myShopEditText: { color: '#4A286B', fontSize: 15, fontWeight: '900' },
  myShopDeleteButton: { flex: 1, backgroundColor: '#FFF1F0', borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  myShopDeleteText: { color: '#B3261E', fontSize: 15, fontWeight: '900' },
  myShopCancelEdit: { alignSelf: 'flex-start', backgroundColor: '#F5F0F9', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 5 },
  myShopImagePreview: { width: '100%', height: 185, borderRadius: 14, marginVertical: 10, backgroundColor: '#F2EAF8' },
  walletScreen: { paddingBottom: 28 },
  walletTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  walletEyebrow: { color: '#F09A2A', fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 4 },
  walletBackButton: { backgroundColor: '#F3E8FA', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 18 },
  walletBackText: { color: '#4A286B', fontSize: 12, fontWeight: '700' },
  walletHero: { backgroundColor: '#38204F', borderRadius: 24, padding: 21, marginBottom: 24, elevation: 5 },
  walletHeroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  walletHeroLabel: { color: '#E9DDF3', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  walletCoin: { color: '#F3A33B', fontSize: 24, fontWeight: 'bold' },
  walletBalance: { color: '#FFFFFF', fontSize: 34, fontWeight: '800', marginTop: 13, marginBottom: 6 },
  walletHeroNote: { color: '#F5EDF9', fontSize: 13, marginBottom: 5 },
  walletUpdated: { color: '#CDBDDA', fontSize: 10, marginTop: 7 },
  walletRefreshButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E7DDF0', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 18, marginTop: 17, elevation: 1 },
  walletRefreshIcon: { color: '#F09A2A', fontSize: 19, fontWeight: '900' },
  walletRefreshText: { color: '#4A286B', fontWeight: '800', fontSize: 12 },
  walletSection: { marginBottom: 22 },
  walletSectionHeading: { marginBottom: 12 },
  walletSectionTitle: { color: '#38204F', fontWeight: '800', fontSize: 18, marginBottom: 5 },
  walletSectionCaption: { color: '#81738B', fontSize: 12 },
  walletEmptyCard: { backgroundColor: '#F5F0F9', borderRadius: 18, padding: 22, alignItems: 'center', borderWidth: 1, borderColor: '#E7DDF0' },
  walletEmptyIcon: { color: '#F09A2A', fontSize: 27, marginBottom: 8 },
  walletEmptyTitle: { color: '#38204F', fontSize: 14, fontWeight: '800', marginBottom: 5 },
  walletMuted: { color: '#81738B', fontSize: 12, lineHeight: 18 },
  walletTransaction: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E7DDF0', padding: 14, marginBottom: 9, flexDirection: 'row', alignItems: 'center' },
  walletTransactionIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F3E8FA', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  walletTransactionIconText: { color: '#4A286B', fontSize: 20, fontWeight: '800' },
  walletTransactionInfo: { flex: 1 },
  walletTransactionTitle: { color: '#38204F', fontSize: 13, fontWeight: '800', marginBottom: 3 },
  walletDate: { color: '#A095AA', fontSize: 10, marginTop: 5 },
  walletTransactionAmount: { color: '#4A286B', fontSize: 13, fontWeight: '800', marginLeft: 8 },
  walletPayoutCard: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 18, borderWidth: 1, borderColor: '#E7DDF0', marginBottom: 23, elevation: 2 },
  walletFieldLabel: { color: '#38204F', fontSize: 12, fontWeight: '800', marginTop: 15, marginBottom: 7 },
  walletInput: { borderColor: '#E3D8EC', borderRadius: 13, marginBottom: 2, backgroundColor: '#FCFAFE' },
  walletMethodSelected: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#F5F0F9', borderRadius: 15, borderWidth: 1, borderColor: '#D9C9E8' },
  walletMethodIcon: { width: 35, height: 35, borderRadius: 18, backgroundColor: '#4A286B', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  walletMethodIconText: { color: '#FFFFFF', fontWeight: '900', fontSize: 16 },
  walletMethodInfo: { flex: 1 },
  walletMethodTitle: { color: '#38204F', fontWeight: '800', fontSize: 13, marginBottom: 2 },
  walletMethodCheck: { color: '#F09A2A', fontSize: 18, fontWeight: '900', marginLeft: 8 },
  walletComingSoon: { backgroundColor: '#FFF8EE', borderColor: '#F5D8B2', borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 15 },
  walletComingTitle: { color: '#9A5A13', fontWeight: '800', fontSize: 12, marginBottom: 4 },
  walletSubmitButton: { backgroundColor: '#F09A2A', paddingVertical: 15, borderRadius: 15, alignItems: 'center', marginTop: 18 },
  walletSubmitText: { color: '#38204F', fontWeight: '900', fontSize: 14 },
  walletStatusDot: { color: '#F09A2A', fontSize: 15, marginLeft: 12 },
  checkoutPaymentCard: { backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#E4D8EF', padding: 16, marginTop: 18, marginBottom: 12 },
  checkoutSectionTitle: { color: '#241B2B', fontSize: 18, fontWeight: '900', marginBottom: 13 },
  checkoutPaypalRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#D8C4EA', borderRadius: 15, padding: 12, backgroundColor: '#FFFFFF' },
  checkoutPaypalMark: { width: 42, height: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginRight: 12, backgroundColor: '#F2F7FF' },
  checkoutPaypalP: { color: '#003087', fontSize: 31, fontWeight: '900', fontStyle: 'italic' },
  checkoutPaypalInfo: { flex: 1 },
  checkoutPaypalTitle: { color: '#24202A', fontSize: 16, fontWeight: '900' },
  checkoutPaypalSubtitle: { color: '#766B80', fontSize: 12, marginTop: 3 },
  checkoutSelected: { color: '#5B0AA8', fontSize: 22, fontWeight: '900', marginHorizontal: 5 },
  checkoutSecurityNote: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0EDFF', borderRadius: 14, padding: 13, marginTop: 13 },
  checkoutShield: { color: '#1689D5', fontSize: 24, fontWeight: '900', marginRight: 11 },
  checkoutSecurityText: { color: '#31264A', fontSize: 13, fontWeight: '700', flex: 1, lineHeight: 19 },
  checkoutPaypalButton: { backgroundColor: '#5B0AA8', borderRadius: 16, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', marginTop: 7, marginBottom: 14, elevation: 3 },
  checkoutPaypalButtonContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  checkoutButtonP: { color: '#FFFFFF', fontSize: 27, fontWeight: '900', fontStyle: 'italic', marginRight: 11 },
  checkoutPaypalButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },

});
