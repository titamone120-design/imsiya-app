
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
  const normalizedLanguage = String(language || 'en').toLowerCase();
  if (normalizedLanguage === 'so') return value;
  const terms = SWEET_TERM_TRANSLATIONS[normalizedLanguage];
  if (!terms) return value;
  const replacements: [RegExp, number][] = [
    [/macmacaan(?:o)?\\s+kale/gi, 4],
    [/shukulaato/gi, 3],
    [/buskut/gi, 0],
    [/xalwo/gi, 1],
    [/keeg/gi, 2],
    [/dhammaan/gi, 5],
  ];
  let translated = value.trim();
  replacements.forEach(([pattern, targetIndex]) => {
    translated = translated.replace(pattern, terms[targetIndex]);
  });
  return translated;
};

const money = (amount: number) =>
  `KSh ${Number(amount || 0).toLocaleString('en-KE')}`;

const orderStatusLabel = (status: unknown, paymentStatus: unknown) => {
  const payment = String(paymentStatus || '').toLowerCase();
  const state = String(status || '').toLowerCase();
  if (payment !== 'paid') return 'Lacag-bixinta lama xaqiijin';
  if (state === 'processing' || state === 'pending') return 'Dalabka waa la helay — diyaarin';
  if (state === 'shipped' || state === 'in_transit' || state === 'in transit') return 'Dalabka waa la soo diray';
  if (state === 'delivered' || state === 'completed') return 'Dalabka waa la gaarsiiyey';
  if (state === 'cancelled' || state === 'canceled') return 'Dalabka waa la joojiyey';
  return state ? `Xaaladda dalabka: ${state}` : 'Xaalad lama hayo';
};

const IMSIYA_LANGUAGES = [["en","🇬🇧","English"],["so","🇸🇴","Somali"],["ar","🇸🇦","العربية"],["sw","🇰🇪","Kiswahili"],["fr","🇫🇷","Français"],["es","🇪🇸","Español"],["zh","🇨🇳","中文"],["hi","🇮🇳","हिन्दी"],["pt","🇵🇹","Português"],["de","🇩🇪","Deutsch"],["tr","🇹🇷","Türkçe"],["ru","🇷🇺","Русский"],["ja","🇯🇵","日本語"],["ko","🇰🇷","한국어"],["it","🇮🇹","Italiano"],["nl","🇳🇱","Nederlands"],["bn","🇧🇩","বাংলা"],["id","🇮🇩","Bahasa Indonesia"],["ur","🇵🇰","اردو"],["am","🇪🇹","አማርኛ"],["ha","🇳🇬","Hausa"],["yo","🇳🇬","Yorùbá"],["th","🇹🇭","ไทย"],["vi","🇻🇳","Tiếng Việt"],["pl","🇵🇱","Polski"],["uk","🇺🇦","Українська"],["fa","🇮🇷","فارسی"],["ms","🇲🇾","Bahasa Melayu"],["el","🇬🇷","Ελληνικά"],["sv","🇸🇪","Svenska"]] as const;


// Core IMSIYA interface translations. Keys are kept in English so product data is not altered.
const CORE_TRANSLATIONS: Record<string, Record<string, string>> = {
  so: {"Home":"Hoy","Login":"Gal","Register":"Isdiiwaangeli","Categories":"Qaybaha","See All":"Dhammaan eeg","Refresh":"Cusboonaysii","Add to cart":"Ku dar gaariga","Your Cart":"Gaarigayga","Your cart is empty.":"Gaarigaagu waa madhan yahay.","Total":"Wadarta","My Account":"Akoonkayga","My Shop":"Dukaankayga","My Orders":"Dalabyadayda","My Favorites":"Waxyaabaha aan jeclahay","Search sweets...":"Raadi macmacaan...","Password":"Furaha sirta ah","Email address":"Cinwaanka iimaylka","Full name":"Magaca oo buuxa","Seller":"Iibiye","Customer":"Macaamiil","Edit":"Wax ka beddel","Delete":"Tirtir","Save Changes":"Kaydi isbeddellada","Cancel Editing":"Jooji wax ka beddelka","Description":"Sharaxaad","Stock":"Kaydka","Payment Method":"Habka lacag-bixinta","Secure Payment":"Lacag-bixin ammaan ah","Shop Status":"Xaaladda dukaanka","Sweet Deals":"Dalabyo Macaan","Discover sweets you will love":"Soo hel macmacaan aad jeclaan doonto","Shop Now":"Hadda Iibso","Popular Products":"Alaabooyinka Caanka ah","No products found yet.":"Weli wax alaab ah lama helin.","Welcome back":"Ku soo dhawoow","Create your account":"Samee akoonkaaga","Already have an account?":"Hore akoon ma u leedahay?"},
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
  const selectedLanguage = IMSIYA_LANGUAGES.find(item => item[0] === language) || IMSIYA_LANGUAGES[0];
  const tr = (somali: string, english: string) => language === 'so' ? (CORE_TRANSLATIONS.so?.[english] || somali) : (CORE_TRANSLATIONS[language]?.[english] || english);
  useEffect(() => { AsyncStorage.getItem('imsiya:language').then(saved => { if (saved && IMSIYA_LANGUAGES.some(item => item[0] === saved)) setLanguage(saved); }).catch(error => console.log('Language preference restore failed:', error?.message || error)); }, []);
  const chooseLanguage = async (code: string) => { setLanguage(code); setLanguagePickerOpen(false); try { await AsyncStorage.setItem('imsiya:language', code); } catch (error: any) { console.log('Language preference save failed:', error?.message || error); } };

  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState('');

  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productError, setProductError] = useState('');

  const [cart, setCart] = useState<CartItem[]>([]);
  const [localDataReadyForUser, setLocalDataReadyForUser] = useState<string | null>(null);

  const [screen, setScreen] = useState<'home' | 'cart' | 'shop' | 'admin' | 'profile' | 'favorites' | 'orders' | 'seller-orders' | 'wallet' | 'product'>('home');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [sellerOrders, setSellerOrders] = useState<any[]>([]);
  const [sellerOrdersLoading, setSellerOrdersLoading] = useState(false);
  const [profileRole, setProfileRole] = useState('');
  const [planSetupLoading, setPlanSetupLoading] = useState(false);
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
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productStock, setProductStock] = useState('10');
  const [productImage, setProductImage] = useState('');
  const [productImageMimeType, setProductImageMimeType] = useState('');
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

  const loadProducts = async () => {
    setProductsLoading(true);
    setProductError('');

    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, image_url, stock, description, categories(name)')
        .eq('active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted: Product[] = (data || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        price: Number(item.price || 0),
        image_url: item.image_url,
        stock: Number(item.stock || 0),
        description: item.description || '',
        category: Array.isArray(item.categories)
          ? item.categories[0]?.name || 'Macmacaan kale'
          : item.categories?.name || 'Macmacaan kale',
      }));

      setProducts(formatted);
    } catch (e: any) {
      setProductError(e.message || 'Alaabta lama soo qaadi karin.');
    } finally {
      setProductsLoading(false);
    }
  };

  const loadAdminData = async () => {
    if (!isAdmin) return;
    setAdminLoading(true);
    try {
      const [sellersResult, ordersResult, subscriptionsResult, walletResult, payoutsResult] = await Promise.all([
        supabase.from('seller_profiles').select('id, shop_name, description, approved, created_at').eq('approved', false).order('created_at', { ascending: false }).limit(50),
        supabase.from('orders').select('id, customer_id, total_amount, currency, usd_total_amount, status, payment_status, payment_method, created_at').order('created_at', { ascending: false }).limit(50),
        supabase.from('shop_subscriptions').select('id, shop_id, amount, currency, status, started_at, expires_at, created_at').order('created_at', { ascending: false }).limit(50),
        supabase.from('wallet_transactions').select('id, seller_id, amount, transaction_type, description, order_id, created_at').order('created_at', { ascending: false }).limit(50),
        supabase.from('payout_requests').select('id, seller_id, amount, status, payout_method, payout_account, created_at, processed_at, admin_note').order('created_at', { ascending: false }).limit(100),
      ]);
      if (sellersResult.error) throw sellersResult.error;
      if (ordersResult.error) throw ordersResult.error;
      if (subscriptionsResult.error) throw subscriptionsResult.error;
      if (walletResult.error) throw walletResult.error;
      if (payoutsResult.error) throw payoutsResult.error;
      setPendingSellers(sellersResult.data || []);
      setAdminOrders(ordersResult.data || []);
      setAdminSubscriptions(subscriptionsResult.data || []);
      setAdminWallet(walletResult.data || []);
      setAdminPayoutRequests(payoutsResult.data || []);
    } catch (e: any) {
      Alert.alert('IMSIYA Admin', e.message || 'Codsiyada lama soo qaadi karin.');
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
      Alert.alert('IMSIYA Admin', 'Iibiyaha waa la ansixiyey. Dukaanku wuxuu furmayaa marka subscription-ka $20 la xaqiijiyo.');
      await loadAdminData();
    } catch (e: any) {
      Alert.alert('IMSIYA Admin', e.message || 'Ansixinta way fashilantay.');
    }
  };

  const updateOrderTrackingStatus = async (orderId: string, nextStatus: 'processing' | 'shipped' | 'delivered') => {
    if (!isAdmin) {
      Alert.alert('IMSIYA Admin', 'Kaliya maamulka ayaa beddeli kara xaaladda dalabka.');
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
      if (!data) throw new Error('Dalabka lama helin ama lama oggola in xaaladdiisa la beddelo.');
      await loadAdminData();
      Alert.alert('IMSIYA Admin', 'Xaaladda dalabka waa la cusboonaysiiyey.');
    } catch (e: any) {
      Alert.alert('IMSIYA Admin', e.message || 'Xaaladda dalabka lama beddeli karin.');
    }
  };

  const loadMySellerProducts = async () => {
    if (!session?.user?.id) { setSellerProducts([]); return; }
    setSellerProductsLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, image_url, stock, description, categories(name)')
        .eq('seller_id', session.user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setSellerProducts((data || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        price: Number(item.price || 0),
        image_url: item.image_url,
        stock: Number(item.stock || 0),
        description: item.description || '',
        category: Array.isArray(item.categories) ? item.categories[0]?.name || 'Macmacaan kale' : item.categories?.name || 'Macmacaan kale',
      })));
    } catch (e: any) {
      Alert.alert('IMSIYA', e.message || 'Alaabta dukaanka lama soo qaadi karin.');
    } finally {
      setSellerProductsLoading(false);
    }
  };

  const pickProductImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('IMSIYA', 'Fadlan oggolow in IMSIYA ay ka doorato sawirrada telefoonkaaga.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setProductImage(result.assets[0].uri);
        setProductImageMimeType(result.assets[0].mimeType || 'image/jpeg');
      }
    } catch (e: any) {
      Alert.alert('IMSIYA', e.message || 'Sawirka lama dooran karin.');
    }
  };

  const beginEditProduct = (product: Product) => {
    setEditingProductId(product.id);
    setProductName(product.name);
    setProductDescription(product.description || '');
    setProductPrice(String(product.price));
    setProductStock(String(product.stock));
    setProductImage(product.image_url || '');
    setProductImageMimeType('');
    setProductCategory(product.category);
  };

  const deleteSellerProduct = (productId: string) => {
    Alert.alert('Tirtir alaabta', 'Ma hubtaa inaad tirtirayso alaabtan?', [
      { text: 'Maya', style: 'cancel' },
      { text: 'Haa, tirtir', style: 'destructive', onPress: async () => {
        try {
          const { error } = await supabase.from('products').update({ active: false }).eq('id', productId).eq('seller_id', session?.user?.id || '');
          if (error) throw error;
          setSellerProducts(current => current.filter(item => item.id !== productId));
          await loadProducts();
          Alert.alert('IMSIYA', 'Alaabta waa la tirtiray.');
        } catch (e: any) {
          Alert.alert('IMSIYA', e.message || 'Alaabta lama tirtiri karin.');
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
      Alert.alert('IMSIYA Wallet', e.message || 'Wallet-ka lama soo qaadi karin.');
    } finally {
      setWalletLoading(false);
    }
  };

  const requestSellerPayout = async () => {
    const amount = Number(payoutAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('IMSIYA Wallet', 'Geli lacag sax ah.');
      return;
    }
    if (!payoutAccount.trim()) {
      Alert.alert('IMSIYA Wallet', 'Geli email-ka PayPal.');
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
      Alert.alert('IMSIYA Wallet', 'Codsiga lacag-bixinta waa la gudbiyey. Maamulka ayaa hubinaya oo gacanta ku bixinaya.');
    } catch (e: any) {
      Alert.alert('IMSIYA Wallet', e.message || 'Codsiga lacag-bixinta lama gudbin karin.');
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
      Alert.alert('IMSIYA Admin', nextStatus === 'paid' ? 'Codsiga waxaa loo calaamadeeyey in lacagta la diray.' : 'Codsiga waa la diiday.');
    } catch (e: any) {
      Alert.alert('IMSIYA Admin', e.message || 'Xaaladda codsiga lama beddeli karin.');
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
      Alert.alert('IMSIYA', e.message || 'Dukaanka lama soo qaadi karin.');
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
        'PayPal wuxuu soo celiyey oggolaanshaha. Xaqiijinta rasmiga ah waxaa samaynaya PayPal webhook; dukaanka wuxuu furmayaa marka lacagta $20 la xaqiijiyo.'
      );
      await loadMyShop();
      return;
    }

    if (url.startsWith('imsiya://order-success')) {
      try {
        const parsed = new URL(url);
        const paypalOrderId = parsed.searchParams.get('token');
        if (!paypalOrderId) {
          Alert.alert('IMSIYA', 'PayPal ma soo dirin lambarka dalabka. Fadlan nala soo xiriir ka hor intaadan mar kale bixin.');
          return;
        }
        const { data, error } = await supabase.functions.invoke('capture-paypal-order', {
          body: { paypal_order_id: paypalOrderId },
        });
        if (error) throw error;
        if (!data?.success) throw new Error('PayPal lacag-bixinta lama xaqiijin.');
        Alert.alert('IMSIYA', 'Lacag-bixinta PayPal waa la xaqiijiyey. Dalabkaagu waa la diyaarinayaa.');
        setCart([]);
        await Promise.all([loadProducts(), loadMyOrders()]);
      } catch (e: any) {
        Alert.alert('IMSIYA', e.message || 'Lacag-bixinta PayPal lama xaqiijin karin. Ha ku celin bixinta ilaa xaaladda la hubiyo.');
      }
      return;
    }

    if (url.startsWith('imsiya://order-cancel')) {
      Alert.alert('IMSIYA', 'Lacag-bixinta dalabka waa la joojiyey. Wax lacag ah lagama qaadin.');
      return;
    }

    if (url.startsWith('imsiya://subscription-cancel')) {
      Alert.alert(
        'IMSIYA',
        'Lacag-bixinta waa la joojiyey. Dukaankaagu weli ma furna.'
      );
      return;
    }

    try {
      const parsed = new URL(url);
      const code = parsed.searchParams.get('code');

      if (code) {
        const { error } =
          await supabase.auth.exchangeCodeForSession(code);

        if (error) throw error;
      }
    } catch (e: any) {
      Alert.alert('IMSIYA', e.message || 'Link-ga lama xaqiijin karin.');
    }
  };

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
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
      setAuthMessage('Fadlan geli magacaaga oo buuxa.');
      return;
    }

    if (!cleanEmail || !password) {
      setAuthMessage('Geli email-ka iyo password-ka.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setAuthMessage('Email-ka aad gelisay sax ma aha. Hubi email-ka.');
      return;
    }

    if (password.length < 8) {
      setAuthMessage('Password-ku waa inuu ahaadaa ugu yaraan 8 xaraf.');
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
            emailRedirectTo: 'imsiya://',
          },
        });

        if (error) throw error;

        if (!data.user) {
          throw new Error('Akoonka lama samayn. Fadlan mar kale isku day.');
        }

        if (!data.session) {
          setAuthMessage('Diiwaangelinta waa la aqbalay. Fadlan email-kaaga ka xaqiiji link-ga la soo diray. Hubi Spam/Junk.');
        } else {
          setSession(data.session);
          setScreen('home');
          setAuthMessage('Akoonkaaga waa la sameeyey. Ku soo dhowow IMSIYA!');
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (error) throw error;
        if (!data.session) throw new Error('Gelitaanku ma dhammaan. Mar kale isku day.');
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
        setAuthMessage('Diiwaangelintu ma dhammaan sababtoo ah server-ka email-ka xaqiijinta ayaa cilad leh. Maamulka waa inuu hagaajiyaa SMTP-ga Supabase.');
      } else {
        setAuthMessage(message || 'Gelitaanka wuu fashilmay. Hubi xogtaada oo mar kale isku day.');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      Alert.alert('IMSIYA', error.message);
      return;
    }

    setScreen('home');
  };

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      Alert.alert('IMSIYA', 'Alaabtani hadda ma taallo.');
      return;
    }

    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem && existingItem.quantity >= product.stock) {
      Alert.alert('IMSIYA', 'Tirada alaabta intaas kama badnaan karto.');
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

    Alert.alert('IMSIYA', 'Alaabta waxaa lagu daray cart-ka.');
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
      Alert.alert('IMSIYA', 'Marka hore akoonka gal.');
      return;
    }

    if (!shopName.trim()) {
      Alert.alert('IMSIYA', 'Geli magaca dukaanka.');
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
        'Codsiga dukaanka waa la kaydiyey. Si dukaanku u furmo, bixi $20 bishii, maamulka ayaana xaqiijinaya oggolaanshaha.'
      );
    } catch (e: any) {
      Alert.alert('IMSIYA', e.message || 'Dukaanka lama kaydin karin.');
    } finally {
      setShopLoading(false);
    }
  };

  const setupPayPalPlan = async () => {
    if (profileRole !== 'super_admin') {
      Alert.alert('IMSIYA Admin', 'Kaliya Super Admin ayaa diyaarin kara PayPal plan-ka.');
      return;
    }
    setPlanSetupLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-paypal-subscription', {
        body: { action: 'setup_plan_only' },
      });
      if (error) throw error;
      if (!data?.success || data?.status !== 'ACTIVE') {
        throw new Error(data?.error || 'PayPal LIVE plan-ka lama xaqiijin.');
      }
      Alert.alert('IMSIYA Admin', 'PayPal LIVE plan-ka $20 bishii waa la diyaariyey lana xaqiijiyey. Wax subscription ama lacag-bixin ah lama samayn.');
    } catch (e: any) {
      Alert.alert('IMSIYA Admin', e.message || 'PayPal plan setup wuu fashilmay.');
    } finally {
      setPlanSetupLoading(false);
    }
  };

  const payShopSubscription = async () => {
    if (!session?.user?.id) {
      Alert.alert('IMSIYA', 'Marka hore akoonka gal.');
      return;
    }

    if (!myShop?.id) {
      Alert.alert('IMSIYA', 'Marka hore samee dukaankaaga.');
      return;
    }

    setPaymentLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        'create-paypal-subscription',
        { body: { shop_id: myShop.id, platform: Platform.OS === 'web' ? 'web' : 'native' } }
      );

      if (error) throw error;
      if (!data?.approval_url) {
        throw new Error('PayPal ma soo celin link-ga subscription-ka.');
      }

      await Linking.openURL(data.approval_url);
    } catch (e: any) {
      Alert.alert(
        'IMSIYA',
        e.message || 'Lacag-bixinta lama bilaabi karin.'
      );
    } finally {
      setPaymentLoading(false);
    }
  };

  const addProduct = async () => {
    if (!session?.user?.id || !myShop?.id) {
      Alert.alert('IMSIYA', 'Marka hore samee dukaankaaga.');
      return;
    }

    if (!myShop.active) {
      Alert.alert(
        'IMSIYA',
        'Dukaankaagu weli ma shaqaynayo. Sug xaqiijinta lacagta iyo oggolaanshaha maamulka.'
      );
      return;
    }

    const price = Number(productPrice);
    const stock = Number(productStock);

    if (!productName.trim() || !productPrice.trim()) {
      Alert.alert('IMSIYA', 'Geli magaca alaabta iyo qiimaheeda.');
      return;
    }

    if (!Number.isFinite(price) || price <= 0) {
      Alert.alert('IMSIYA', 'Qiimaha alaabtu sax ma aha.');
      return;
    }

    if (!Number.isInteger(stock) || stock < 0) {
      Alert.alert('IMSIYA', 'Tirada alaabtu sax ma aha.');
      return;
    }

    const selectedCategory = categoryRows.find(
      item => item.name.toLowerCase() === productCategory.toLowerCase()
    );

    if (!selectedCategory) {
      Alert.alert(
        'IMSIYA',
        'Qaybta alaabta lama helin. Hubi categories-ka Supabase.'
      );
      return;
    }

    setAddingProduct(true);

    try {
      let savedImageUrl: string | null = productImage.trim() || null;
      if (savedImageUrl && !/^https?:\/\//i.test(savedImageUrl)) {
        setProductImageUploading(true);
        const imageResponse = await fetch(savedImageUrl);
        if (!imageResponse.ok) throw new Error('Sawirka telefoonka lama akhrin karin.');
        const imageBuffer = await imageResponse.arrayBuffer();
        const mimeType = String(productImageMimeType || imageResponse.headers.get('content-type') || 'image/jpeg').toLowerCase().split(';')[0];
        const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : mimeType === 'image/jpeg' ? 'jpg' : '';
        if (!extension) throw new Error('Sawirka waa inuu noqdaa JPG, PNG ama WEBP.');
        if (imageBuffer.byteLength <= 0 || imageBuffer.byteLength > 5 * 1024 * 1024) throw new Error('Sawirka waa inuu ka yaraadaa 5 MB.');
        const imagePath = session.user.id + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 9) + '.' + extension;
        const { error: uploadError } = await supabase.storage.from('product-images').upload(imagePath, imageBuffer, {
          contentType: mimeType,
          cacheControl: '3600',
          upsert: false,
        });
        if (uploadError) throw uploadError;
        savedImageUrl = supabase.storage.from('product-images').getPublicUrl(imagePath).data.publicUrl;
      }
      const productPayload = {
        seller_id: session.user.id,
        shop_id: myShop.id,
        category_id: selectedCategory.id,
        name: productName.trim(),
        description: productDescription.trim(),
        price,
        image_url: savedImageUrl,
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
      setProductImage('');
      setProductImageMimeType('');

      Alert.alert('IMSIYA', editingProductId ? 'Alaabta waa la cusboonaysiiyey.' : 'Alaabta waa lagu daray dukaanka.');
      await Promise.all([loadProducts(), loadMySellerProducts()]);
    } catch (e: any) {
      Alert.alert('IMSIYA', e.message || 'Alaabta lama dari karin.');
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
      {product.image_url ? (
        <Image
          source={{ uri: product.image_url }}
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
        <Text style={styles.secondaryButtonText}>Faahfaahin</Text>
      </TouchableOpacity>
      <Text style={styles.productPrice}>{money(product.price)}</Text>
      <Text style={styles.stockText}>
        {product.stock > 0 ? `Kaydka: ${product.stock}` : 'Waa dhammaatay'}
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
    </>
  );

  const checkoutCart = async () => {
    if (!session?.user?.id) {
      Alert.alert('IMSIYA', 'Marka hore akoonka gal.');
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
          'Xaqiiji lacagta',
          'Wadarta alaabta: KES ' + data.kes_amount + '\nLacagta PayPal: USD ' + data.usd_amount,
          [
            { text: 'Sii wad PayPal', onPress: () => Linking.openURL(data.checkout_url) },
            { text: 'Jooji', style: 'cancel' },
          ]
        );
      }
    } catch (e: any) {
      Alert.alert('IMSIYA', e.message || 'Lacag-bixinta lama bilaabi karin.');
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
      Alert.alert('IMSIYA', e.message || 'Dalabyada lama soo qaadi karin.');
    } finally {
      setOrdersLoading(false);
    }
  };

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
      Alert.alert('IMSIYA', e.message || 'Dalabyada iibiyaha lama soo qaadi karin.');
    } finally {
      setSellerOrdersLoading(false);
    }
  };

  const renderSellerWallet = () => (
    <View style={styles.walletScreen}>
      <View style={styles.walletTopRow}>
        <View>
          <Text style={styles.walletEyebrow}>IMSIYA SELLER</Text>
          <Text style={styles.sectionTitle}>Wallet-kayga</Text>
        </View>
        <TouchableOpacity style={styles.walletBackButton} onPress={() => setScreen('shop')}>
          <Text style={styles.walletBackText}>← Dukaankayga</Text>
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
            <Text style={styles.walletUpdated}>La cusboonaysiiyey: {sellerWallet?.updated_at ? new Date(sellerWallet.updated_at).toLocaleString() : '—'}</Text>
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
              <Text style={styles.walletTransactionTitle}>{tx.transaction_type || 'Iib'}</Text>
              <Text style={styles.walletMuted}>{tx.description || 'Lacagta iibka'}</Text>
              {tx.order_id ? <Text style={styles.walletMuted}>Dalab: {String(tx.order_id).slice(0, 12)}</Text> : null}
              <Text style={styles.walletDate}>{tx.created_at ? new Date(tx.created_at).toLocaleString() : '—'}</Text>
            </View>
            <Text style={styles.walletTransactionAmount}>{money(Number(tx.amount || 0))}</Text>
          </View>
        ))}
      </View>

      <View style={styles.walletPayoutCard}>
        <Text style={styles.walletSectionTitle}>{tr("Codso lacag-bixin", "Request a payout")}</Text>
        <Text style={styles.walletMuted}>Codsigaaga maamulka ayaa hubinaya. Lacagta si toos ah looma dirayo weli.</Text>
        <Text style={styles.walletFieldLabel}>{tr("Lacagta (KSh)", "Amount (KSh)")}</Text>
        <TextInput style={[styles.input, styles.walletInput]} keyboardType="decimal-pad" placeholder="Tusaale: 1,000" value={payoutAmount} onChangeText={setPayoutAmount} />
        <Text style={styles.walletFieldLabel}>{tr("Habka lacag-bixinta", "Payout method")}</Text>
        <View style={styles.walletMethodSelected}>
          <View style={styles.walletMethodIcon}><Text style={styles.walletMethodIconText}>P</Text></View>
          <View style={styles.walletMethodInfo}>
            <Text style={styles.walletMethodTitle}>PayPal</Text>
            <Text style={styles.walletMuted}>Lacagta waxaa laguugu diraa email-kaaga PayPal.</Text>
          </View>
          <Text style={styles.walletMethodCheck}>✓</Text>
        </View>
        <Text style={styles.walletFieldLabel}>{tr("Email-ka PayPal", "PayPal email")}</Text>
        <TextInput style={[styles.input, styles.walletInput]} autoCapitalize="none" keyboardType="email-address" placeholder="name@example.com" value={payoutAccount} onChangeText={setPayoutAccount} />
        <View style={styles.walletComingSoon}>
          <Text style={styles.walletComingTitle}>Bixinta PayPal</Text>
          <Text style={styles.walletMuted}>Codsiga waxaa hubinaya maamulka IMSIYA. Lacagta waxaa la calaamadaynayaa marka PayPal si dhab ah loo diro.</Text>
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
            <Text style={styles.walletEmptyTitle}>Codsi lacag-bixin ma jiro</Text>
            <Text style={styles.walletMuted}>Codsiyada aad gudbiso halkan ayay ka muuqan doonaan.</Text>
          </View>
        ) : payoutRequests.map(req => (
          <View key={req.id} style={styles.walletTransaction}>
            <View style={styles.walletTransactionInfo}>
              <Text style={styles.walletTransactionTitle}>{money(Number(req.amount || 0))} · PayPal</Text>
              <Text style={styles.walletMuted}>Xaalad: {req.status === 'paid' ? 'La bixiyey' : req.status === 'rejected' ? 'La diiday' : req.status === 'processing' ? 'La shaqaynayo' : 'Sugaya maamulka'}</Text>
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
        <Text style={styles.emptyText}>Weli dalab alaabta dukaankaaga ah ma jiro.</Text>
      ) : sellerOrders.map((item: any) => {
        const order = item.orders;
        const product = Array.isArray(item.products) ? item.products[0] : item.products;
        return (
          <View key={item.id} style={styles.shopStatusCard}>
            <Text style={styles.shopStatusTitle}>{product?.name || 'Alaabta IMSIYA'}</Text>
            <Text style={styles.shopStatusText}>Tirada: {item.quantity} · Qiimaha: {money(Number(item.unit_price || 0) * Number(item.quantity || 0))}</Text>
            <Text style={styles.shopStatusText}>Wadarta dalabka: {order.currency || 'KES'} {Number(order.total_amount || 0).toLocaleString('en-KE')}</Text>
            <Text style={styles.shopStatusText}>{orderStatusLabel(order.status, order.payment_status)}</Text>
            <Text style={styles.shopStatusText}>Bixinta: {String(order.payment_status || '—')} · Habka: {order.payment_method || '—'}</Text>
            <Text style={styles.shopStatusText}>{new Date(order.created_at).toLocaleString()}</Text>
            <Text style={styles.shopStatusText}>Dalab: {String(order.id).slice(0, 12)}</Text>
          </View>
        );
      })}
    </View>
  );

  const renderOrderHistory = () => (
    <View>
      <Text style={styles.sectionTitle}>{tr("Dalabyadayda", "My Orders")}</Text>
      <TouchableOpacity onPress={() => setScreen('profile')}><Text style={styles.refreshText}>← Ku noqo Profile</Text></TouchableOpacity>
      <TouchableOpacity style={styles.refreshWideButton} onPress={loadMyOrders} disabled={ordersLoading}>
        {ordersLoading ? <ActivityIndicator size="small" color="#4A286B" /> : <Text style={styles.refreshIcon}>↻</Text>}
        <Text style={styles.refreshButtonText}>{tr("Cusboonaysii dalabyada", "Refresh orders")}</Text>
      </TouchableOpacity>
      {ordersLoading ? <ActivityIndicator size="large" color="#4A286B" /> : myOrders.length === 0 ? <Text style={styles.emptyText}>{tr("Weli dalab kuma jiro akoonkaaga.", "You have no orders yet.")}</Text> : myOrders.map(order => (
        <View key={order.id} style={styles.shopStatusCard}>
          <Text style={styles.shopStatusTitle}>{order.currency || 'KES'} {Number(order.total_amount || 0).toLocaleString('en-KE')}</Text>
          <Text style={styles.shopStatusText}>{orderStatusLabel(order.status, order.payment_status)}</Text>
          <Text style={styles.shopStatusText}>Bixinta: {String(order.payment_status || '—')}</Text>
          <Text style={styles.shopStatusText}>Habka: {order.payment_method || '—'}</Text>
          <Text style={styles.shopStatusText}>{new Date(order.created_at).toLocaleString()}</Text>
          <Text style={styles.shopStatusText}>Dalab: {String(order.id).slice(0, 12)}</Text>
        </View>
      ))}
    </View>
  );

  const renderProfile = () => (
    <View>
      {!session ? (
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
            <View style={styles.authInputWrap}><Text style={styles.authInputIcon}>🔒</Text><TextInput style={styles.authInput} placeholder={tr("Password", "Password")} placeholderTextColor="#8D8299" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} /></View>
            <TouchableOpacity style={styles.authForgot} onPress={async () => {
              if (!email.trim()) { Alert.alert('IMSIYA', tr("Marka hore geli email-kaaga.", "Enter your email address first.")); return; }
              const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
              Alert.alert('IMSIYA', error ? error.message : tr("Haddii email-ku sax yahay, link dib-u-dejin ah ayaa laguugu soo diray.", "If the email is valid, a password reset link has been sent."));
            }}>
              <Text style={styles.authForgotText}>{tr("Password ma illowday?", "Forgot Password?")}</Text>
            </TouchableOpacity>
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
            <Text style={styles.heroText}>{session.user.user_metadata?.full_name || fullName || 'Macmiilka IMSIYA'}</Text>
          </View>
          <View style={styles.shopStatusCard}>
            <Text style={styles.shopStatusTitle}>Xogta akoonka</Text>
            <Text style={styles.shopStatusText}>Email: {session.user.email || '—'}</Text>
            <Text style={styles.shopStatusText}>{tr("Nooca akoonka: ", "Account type: ")}{myShop ? tr("Iibiye", "Seller") : profileRole === 'admin' || profileRole === 'super_admin' ? 'Admin' : tr("Macmiil", "Customer")}</Text>
          </View>
          <TouchableOpacity style={styles.profileAction} onPress={() => setLanguagePickerOpen(true)}><Text style={styles.profileActionText}>🌐  Language / Luqadda: {selectedLanguage[1]} {selectedLanguage[2]}</Text></TouchableOpacity>
          <TouchableOpacity style={styles.profileAction} onPress={() => setScreen('favorites')}><Text style={styles.profileActionText}>♥  Alaabta aan jeclahay ({favoriteIds.length})</Text></TouchableOpacity>
          <TouchableOpacity style={styles.profileAction} onPress={() => setScreen('shop')}><Text style={styles.profileActionText}>🏪  Dukaankayga iyo iibiyaha</Text></TouchableOpacity>
          {myShop ? <TouchableOpacity style={styles.profileAction} onPress={() => { setScreen('wallet'); loadSellerWallet(); }}><Text style={styles.profileActionText}>💰  {tr("Wallet-kayga iibka", "Seller Wallet")}</Text></TouchableOpacity> : null}
          <TouchableOpacity style={styles.profileAction} onPress={() => { setScreen('orders'); loadMyOrders(); }}><Text style={styles.profileActionText}>📦  Dalabyadayda</Text></TouchableOpacity>
          <TouchableOpacity style={styles.profileAction} onPress={() => setScreen('cart')}><Text style={styles.profileActionText}>🛒  Cart-kayga ({cart.length})</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.primaryButton, { marginTop: 18 }]} onPress={signOut}><Text style={styles.buttonText}>Ka bax akoonka</Text></TouchableOpacity>
        </>
      )}
    </View>
  );

  const renderFavorites = () => {
    const favoriteProducts = products.filter(product => favoriteIds.includes(product.id));
    return (
      <View>
        <Text style={styles.sectionTitle}>{tr("Alaabta aan jeclahay", "My Favorites")}</Text>
        <TouchableOpacity onPress={() => setScreen('profile')}><Text style={styles.refreshText}>← Ku noqo Profile</Text></TouchableOpacity>
        {favoriteProducts.length === 0 ? <Text style={styles.emptyText}>Weli ma aadan dooran alaab aad jeceshahay.</Text> : <View style={styles.productGrid}>{favoriteProducts.map(renderProduct)}</View>}
      </View>
    );
  };

  const renderProductDetails = () => {
    if (!selectedProduct) return <View><Text style={styles.emptyText}>Alaabta lama helin.</Text><TouchableOpacity onPress={() => setScreen('home')}><Text style={styles.refreshText}>← Ku noqo Hoyga</Text></TouchableOpacity></View>;
    return (
      <View>
        <TouchableOpacity onPress={() => setScreen('home')}><Text style={styles.refreshText}>← Ku noqo alaabta</Text></TouchableOpacity>
        {selectedProduct.image_url ? <Image source={{ uri: selectedProduct.image_url }} style={{ width: '100%', height: 240, borderRadius: 18, marginVertical: 14 }} resizeMode="cover" /> : <View style={[styles.imagePlaceholder, { height: 220, marginVertical: 14 }]}><Text style={styles.placeholderText}>🍬</Text></View>}
        <Text style={styles.sectionTitle}>{translateSweetName(selectedProduct.name, language)}</Text>
        <Text style={styles.productCategory}>{translateSweetName(selectedProduct.category, language)}</Text>
        <Text style={[styles.productPrice, { fontSize: 22, marginVertical: 10 }]}>{money(selectedProduct.price)}</Text>
        <Text style={styles.shopStatusText}>{selectedProduct.description?.trim() || 'Sharaxaad dheeraad ah weli lama gelin.'}</Text>
        <Text style={styles.stockText}>{selectedProduct.stock > 0 ? `Kaydka: ${selectedProduct.stock}` : 'Waa dhammaatay'}</Text>
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
                      Alert.alert('IMSIYA', 'Kaydka intaas kuma filna.');
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
          <Text style={styles.shopStatusTitle}>PayPal LIVE — $20 bishii</Text>
          <Text style={styles.shopStatusText}>Diyaari oo xaqiiji product-ka iyo billing plan-ka. Tani ma bilaabayso subscription, mana qaaddo lacag.</Text>
          <TouchableOpacity style={[styles.primaryButton, planSetupLoading && styles.disabledButton]} onPress={setupPayPalPlan} disabled={planSetupLoading}>
            {planSetupLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Diyaari PayPal LIVE Plan</Text>}
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.shopStatusCard}>
        <Text style={styles.shopStatusTitle}>{tr("Codsiyada iibiyeyaasha", "Seller Applications")}</Text>
        <Text style={styles.shopStatusText}>Sugaya ansixinta: {pendingSellers.length}</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={loadAdminData}>
          <Text style={styles.buttonText}>{tr("Cusboonaysii", "Refresh")}</Text>
        </TouchableOpacity>
      </View>
      {adminLoading ? <ActivityIndicator size="large" color="#4A286B" /> : pendingSellers.length === 0 ? (
        <Text style={styles.emptyText}>Ma jiraan codsiyo sugaya ansixin.</Text>
      ) : pendingSellers.map((seller) => (
        <View key={seller.id} style={styles.shopStatusCard}>
          <Text style={styles.shopStatusTitle}>{seller.shop_name}</Text>
          <Text style={styles.shopStatusText}>{seller.description || 'Sharaxaad ma jirto'}</Text>
          <Text style={styles.shopStatusText}>Seller ID: {seller.id}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => approveSeller(seller.id)}>
            <Text style={styles.buttonText}>Ansixi iibiyahan</Text>
          </TouchableOpacity>
        </View>
      ))}
      <Text style={styles.emptyText}>Xusuusin: ansixinta iibiyaha ma dhaqaajiso dukaanka ilaa lacagta subscription-ka $20 la xaqiijiyo.</Text>

      <View style={styles.shopStatusCard}>
        <Text style={styles.shopStatusTitle}>{tr("Guudmar maamulka", "Admin Overview")}</Text>
        <Text style={styles.shopStatusText}>Dalabyada: {adminOrders.length} kii ugu dambeeyey</Text>
        <Text style={styles.shopStatusText}>Subscriptions: {adminSubscriptions.length} kii ugu dambeeyey</Text>
        <Text style={styles.shopStatusText}>Wallet transactions: {adminWallet.length} kii ugu dambeeyey</Text>
      </View>

      <Text style={styles.sectionTitle}>{tr("Dalabyada macaamiisha", "Customer Orders")}</Text>
      {adminOrders.length === 0 ? <Text style={styles.emptyText}>Weli dalab ma jiro.</Text> : adminOrders.map(order => (
        <View key={order.id} style={styles.shopStatusCard}>
          <Text style={styles.shopStatusTitle}>{order.currency || 'KES'} {Number(order.total_amount || 0).toLocaleString('en-KE')}</Text>
          <Text style={styles.shopStatusText}>Xaalad: {orderStatusLabel(order.status, order.payment_status)} · Bixin: {order.payment_status}</Text>
          <Text style={styles.shopStatusText}>Habka: {order.payment_method || 'Lama cayimin'}</Text>
          <Text style={styles.shopStatusText}>Order ID: {order.id}</Text>
          <Text style={styles.shopStatusText}>{new Date(order.created_at).toLocaleString()}</Text>
          {order.payment_status === 'paid' && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {order.status === 'pending' && <TouchableOpacity style={[styles.secondaryButton, { flexGrow: 1 }]} onPress={() => updateOrderTrackingStatus(order.id, 'processing')}><Text style={styles.secondaryButtonText}>Bilow diyaarinta</Text></TouchableOpacity>}
              {order.status === 'processing' && <TouchableOpacity style={[styles.secondaryButton, { flexGrow: 1 }]} onPress={() => updateOrderTrackingStatus(order.id, 'shipped')}><Text style={styles.secondaryButtonText}>Dalabka dir</Text></TouchableOpacity>}
              {order.status === 'shipped' && <TouchableOpacity style={[styles.secondaryButton, { flexGrow: 1 }]} onPress={() => updateOrderTrackingStatus(order.id, 'delivered')}><Text style={styles.secondaryButtonText}>Xaqiiji gaarsiinta</Text></TouchableOpacity>}
              {order.status === 'delivered' && <Text style={styles.shopStatusText}>Dalabkan waa la gaarsiiyey.</Text>}
            </View>
          )}
        </View>
      ))}

      <Text style={styles.sectionTitle}>{tr("Lacagaha dukaamada ($20 bishii)", "Shop Subscriptions ($20/month)")}</Text>
      {adminSubscriptions.length === 0 ? <Text style={styles.emptyText}>Weli subscription lama diiwaangelin.</Text> : adminSubscriptions.map(sub => (
        <View key={sub.id} style={styles.shopStatusCard}>
          <Text style={styles.shopStatusTitle}>{sub.currency || 'USD'} {Number(sub.amount || 0).toFixed(2)} · {sub.status}</Text>
          <Text style={styles.shopStatusText}>Shop ID: {sub.shop_id}</Text>
          <Text style={styles.shopStatusText}>Bilow: {sub.started_at ? new Date(sub.started_at).toLocaleDateString() : '—'}</Text>
          <Text style={styles.shopStatusText}>Dhamaad: {sub.expires_at ? new Date(sub.expires_at).toLocaleDateString() : '—'}</Text>
        </View>
      ))}

      <Text style={styles.sectionTitle}>{tr("Codsiyada lacag-bixinta iibiyeyaasha", "Seller Payout Requests")}</Text>
      {adminPayoutRequests.length === 0 ? <Text style={styles.emptyText}>Weli codsi lacag-bixin ma jiro.</Text> : adminPayoutRequests.map(req => (
        <View key={req.id} style={styles.shopStatusCard}>
          <Text style={styles.shopStatusTitle}>{money(Number(req.amount || 0))} · PayPal</Text>
          <Text style={styles.shopStatusText}>Seller ID: {req.seller_id}</Text>
          <Text style={styles.shopStatusText}>Ogow: lacagta marka hore ku dir PayPal; badhanka hoose wuxuu diiwaangelinayaa oo keliya bixinta aad hore u samaysay.</Text>
          <Text style={styles.shopStatusText}>Akoonka lacagta: {req.payout_account || '—'}</Text>
          <Text style={styles.shopStatusText}>Xaalad: {req.status}</Text>
          {req.status === 'pending' || req.status === 'processing' ? <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={[styles.secondaryButton, { flex: 1 }]} onPress={() => updatePayoutRequestStatus(req.id, 'paid')}><Text style={styles.secondaryButtonText}>Xaqiiji: PayPal waa la diray</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.secondaryButton, { flex: 1 }]} onPress={() => updatePayoutRequestStatus(req.id, 'rejected')}><Text style={styles.secondaryButtonText}>Diid codsiga</Text></TouchableOpacity>
          </View> : null}
        </View>
      ))}

      <Text style={styles.sectionTitle}>{tr("Dhaqdhaqaaqa wallet-ka iibiyeyaasha", "Seller Wallet Activity")}</Text>
      {adminWallet.length === 0 ? <Text style={styles.emptyText}>Weli dhaqdhaqaaq wallet ma jiro.</Text> : adminWallet.map(tx => (
        <View key={tx.id} style={styles.shopStatusCard}>
          <Text style={styles.shopStatusTitle}>{money(Number(tx.amount || 0))} · {tx.transaction_type}</Text>
          <Text style={styles.shopStatusText}>{tx.description || 'Faahfaahin ma jirto'}</Text>
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
          <Text style={styles.myShopEyebrow}>IMSIYA SELLER</Text>
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
            <TextInput style={styles.input} placeholder="Tusaale: IMSIYA Sweets" value={shopName} onChangeText={setShopName} />
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
            {editingProductId && <TouchableOpacity style={styles.myShopCancelEdit} onPress={() => { setEditingProductId(null); setProductName(''); setProductDescription(''); setProductPrice(''); setProductStock('10'); setProductImage(''); setProductImageMimeType(''); setProductCategory('Buskut'); }}><Text style={styles.refreshText}>{tr("Jooji tafatirka", "Cancel Editing")}</Text></TouchableOpacity>}
            <Text style={styles.label}>{tr("Magaca alaabta", "Product Name")}</Text>
            <TextInput style={styles.input} placeholder={tr("Magaca macmacaanka", "Sweet Name")} value={productName} onChangeText={setProductName} />
            <Text style={styles.label}>{tr("Sharaxaadda", "Description")}</Text>
            <TextInput style={styles.input} placeholder={tr("Sharax alaabta", "Describe the product")} value={productDescription} onChangeText={setProductDescription} />
            <Text style={styles.label}>{tr("Qiimaha (KSh)", "Price (KSh)")}</Text>
            <TextInput style={styles.input} placeholder="Tusaale: 500" value={productPrice} onChangeText={setProductPrice} keyboardType="numeric" />
            <Text style={styles.label}>{tr("Tirada kaydka", "Stock Quantity")}</Text>
            <TextInput style={styles.input} placeholder="10" value={productStock} onChangeText={setProductStock} keyboardType="numeric" />
            <Text style={styles.label}>{tr("Sawirka alaabta", "Product Image")}</Text>
            <TouchableOpacity style={styles.myShopOutlineButton} onPress={pickProductImage} disabled={productImageUploading}>
              <Text style={styles.myShopOutlineButtonText}>{tr("＋  Ka dooro sawir telefoonka", "＋  Choose a Photo")}</Text>
            </TouchableOpacity>
            {productImage ? <Image source={{ uri: productImage }} style={styles.myShopImagePreview} resizeMode="cover" /> : null}
            <Text style={styles.myShopHint}>{tr("Sawirka JPG, PNG ama WEBP; ugu badnaan 5 MB.", "JPG, PNG or WEBP image; up to 5 MB.")}</Text>
            <TextInput style={styles.input} placeholder={tr("Ama geli URL sawir (https://...)", "Or enter an image URL (https://...)")} value={productImage.startsWith('file://') || productImage.startsWith('content://') ? '' : productImage} onChangeText={value => { setProductImage(value); setProductImageMimeType(''); }} autoCapitalize="none" />
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
          <Text style={styles.navText}>Profile</Text>
        </TouchableOpacity>
        {isAdmin && (
          <TouchableOpacity style={styles.navItem} onPress={() => { setScreen('admin'); loadAdminData(); }}>
            <Text style={styles.navIcon}>🛡️</Text>
            <Text style={styles.navText}>Admin</Text>
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
