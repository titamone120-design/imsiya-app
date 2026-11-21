
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

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [language, setLanguage] = useState<'en' | 'so'>('en');
  const tr = (somali: string, english: string) => language === 'en' ? english : somali;

  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

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

    if (authMode === 'signup' && !fullName.trim()) {
      Alert.alert('IMSIYA', 'Fadlan geli magacaaga oo buuxa.');
      return;
    }

    if (!cleanEmail || !password) {
      Alert.alert('IMSIYA', 'Geli email-ka iyo password-ka.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      Alert.alert('IMSIYA', 'Email-ka aad gelisay sax ma aha. Hubi email-ka.');
      return;
    }

    if (password.length < 8) {
      Alert.alert('IMSIYA', 'Password-ku waa inuu ahaadaa ugu yaraan 8 xaraf si akoonkaagu u sii ammaan badnaado.');
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
          Alert.alert(
            'IMSIYA',
            'Codsiga akoonka waa la aqbalay. Ka eeg email-kaaga link-ga xaqiijinta. Haddii uusan iman, hubi Spam/Junk.'
          );
        } else {
          Alert.alert('IMSIYA', 'Akoonkaaga waa la sameeyey.');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) throw error;
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
        Alert.alert(
          'IMSIYA — Email-ka xaqiijinta',
          'Diiwaangelintu ma dhammaan sababtoo ah server-ka email-ka xaqiijinta ayaa cilad leh. Tani ma aha password-ka aad gelisay. Maamulka waa inuu hagaajiyaa SMTP-ga Supabase ka hor inta aadan mar kale isdiiwaangelin.'
        );
      } else {
        Alert.alert('IMSIYA', message || 'Gelitaanka wuu fashilmay. Hubi xogtaada oo mar kale isku day.');
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
            ignoreDuplicates: true,
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
        { body: { shop_id: myShop.id } }
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
      <Text style={styles.productName}>{product.name}</Text>
      <Text style={styles.productCategory}>{product.category}</Text>
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
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>{tr("Ku soo dhowow IMSIYA", "Welcome to IMSIYA")}</Text>
        <Text style={styles.heroText}>
          Macmacaanka aad jeceshahay — hal meel.
        </Text>
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder={tr("Raadi macmacaan...", "Search sweets...")}
        placeholderTextColor="#888"
        value={search}
        onChangeText={setSearch}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
      >
        {['Dhammaan', ...(categoryRows.length ? categoryRows.map(item => item.name) : categories.slice(1))].map(item => (
          <TouchableOpacity
            key={item}
            style={[
              styles.categoryButton,
              category === item && styles.categorySelected,
            ]}
            onPress={() => setCategory(item)}
          >
            <Text
              style={[
                styles.categoryText,
                category === item && styles.categorySelectedText,
              ]}
            >
              {item}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{tr("Alaabaha Caanka ah", "Popular Products")}</Text>
        <TouchableOpacity onPress={() => { loadProducts(); loadCategories(); }}>
          <Text style={styles.refreshText}>{tr("Cusboonaysii", "Refresh")}</Text>
        </TouchableOpacity>
      </View>

      {productsLoading ? (
        <ActivityIndicator size="large" color="#4A286B" />
      ) : productError ? (
        <Text style={styles.errorText}>{productError}</Text>
      ) : filteredProducts.length === 0 ? (
        <Text style={styles.emptyText}>{tr("Weli alaab lama helin.", "No products found yet.")}</Text>
      ) : (
        <View style={styles.productGrid}>
          {filteredProducts.map(renderProduct)}
        </View>
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

      Alert.alert(
        'Xaqiiji lacagta',
        'Wadarta alaabta: KES ' + data.kes_amount + '\nLacagta PayPal: USD ' + data.usd_amount,
        [
          { text: 'Sii wad PayPal', onPress: () => Linking.openURL(data.checkout_url) },
          { text: 'Jooji', style: 'cancel' },
        ]
      );
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
          <Text style={styles.walletRefreshText}>↻  Cusboonaysii wallet-ka</Text>
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
          <Text style={styles.walletComingTitle}>M-Pesa  ·  Coming Soon</Text>
          <Text style={styles.walletMuted}>Waxaan hawlgelin doonnaa marka API-ga iyo shortcode-ku diyaar noqdaan.</Text>
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
              <Text style={styles.walletTransactionTitle}>{money(Number(req.amount || 0))} · {req.payout_method === 'mpesa' ? 'M-Pesa' : 'PayPal'}</Text>
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
      <TouchableOpacity style={styles.secondaryButton} onPress={loadMySellerOrders} disabled={sellerOrdersLoading}>
        <Text style={styles.secondaryButtonText}>{tr("Cusboonaysii dalabyada", "Refresh orders")}</Text>
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
      <TouchableOpacity style={styles.secondaryButton} onPress={loadMyOrders}><Text style={styles.secondaryButtonText}>{tr("Cusboonaysii dalabyada", "Refresh orders")}</Text></TouchableOpacity>
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
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>{tr("Akoonkayga", "My Account")}</Text>
        <Text style={styles.heroText}>{session?.user?.user_metadata?.full_name || fullName || 'Macmiilka IMSIYA'}</Text>
      </View>
      <View style={styles.shopStatusCard}>
        <Text style={styles.shopStatusTitle}>Xogta akoonka</Text>
        <Text style={styles.shopStatusText}>Email: {session?.user?.email || '—'}</Text>
        <Text style={styles.shopStatusText}>Nooca akoonka: {profileRole || 'Macmiil'}</Text>
      </View>
      <TouchableOpacity style={styles.profileAction} onPress={() => setScreen('favorites')}>
        <Text style={styles.profileActionText}>♥  Alaabta aan jeclahay ({favoriteIds.length})</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.profileAction} onPress={() => setScreen('shop')}>
        <Text style={styles.profileActionText}>🏪  Dukaankayga iyo iibiyaha</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.profileAction} onPress={() => { setScreen('wallet'); loadSellerWallet(); }}>
        <Text style={styles.profileActionText}>💰  Wallet-kayga iibka</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.profileAction} onPress={() => { setScreen('orders'); loadMyOrders(); }}><Text style={styles.profileActionText}>📦  Dalabyadayda</Text></TouchableOpacity>
      <TouchableOpacity style={styles.profileAction} onPress={() => setScreen('cart')}>
        <Text style={styles.profileActionText}>🛒  Cart-kayga ({cart.length})</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.primaryButton, { marginTop: 18 }]} onPress={signOut}>
        <Text style={styles.buttonText}>Ka bax akoonka</Text>
      </TouchableOpacity>
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
        <Text style={styles.sectionTitle}>{selectedProduct.name}</Text>
        <Text style={styles.productCategory}>{selectedProduct.category}</Text>
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
                <Text style={styles.productName}>{item.name}</Text>
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

          <TouchableOpacity
            style={[styles.primaryButton, checkoutLoading && styles.disabledButton]}
            onPress={checkoutCart}
            disabled={checkoutLoading}
          >
            {checkoutLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{tr("Ku bixi PayPal", "Pay with PayPal")}</Text>
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
          <Text style={styles.shopStatusTitle}>{money(Number(req.amount || 0))} · {req.payout_method === 'mpesa' ? 'M-Pesa' : 'PayPal'}</Text>
          <Text style={styles.shopStatusText}>Seller ID: {req.seller_id}</Text>
          <Text style={styles.shopStatusText}>Akoonka lacagta: {req.payout_account || '—'}</Text>
          <Text style={styles.shopStatusText}>Xaalad: {req.status}</Text>
          {req.status === 'pending' || req.status === 'processing' ? <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={[styles.secondaryButton, { flex: 1 }]} onPress={() => updatePayoutRequestStatus(req.id, 'paid')}><Text style={styles.secondaryButtonText}>Calaamadee: la bixiyey</Text></TouchableOpacity>
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
    <View>
      <Text style={styles.sectionTitle}>{tr("Dukaankayga", "My Shop")}</Text>
      <TouchableOpacity style={styles.secondaryButton} onPress={() => { setScreen('wallet'); loadSellerWallet(); }}>
        <Text style={styles.secondaryButtonText}>💰 Fur Wallet-kayga</Text>
      </TouchableOpacity>

      {shopLoading ? (
        <ActivityIndicator size="large" color="#4A286B" />
      ) : (
        <>
          <Text style={styles.label}>{tr("Magaca dukaanka", "Shop Name")}</Text>
          <TextInput
            style={styles.input}
            placeholder="Tusaale: IMSIYA Sweets"
            value={shopName}
            onChangeText={setShopName}
          />

          <Text style={styles.label}>{tr("Sharaxaadda dukaanka", "Shop Description")}</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            placeholder="Wax ka sheeg dukaankaaga..."
            value={shopDescription}
            onChangeText={setShopDescription}
            multiline
          />

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={createOrUpdateShop}
            disabled={shopLoading}
          >
            <Text style={styles.buttonText}>
              Kaydi xogta dukaanka
            </Text>
          </TouchableOpacity>

          {myShop && (
            <View style={styles.shopStatusCard}>
              <Text style={styles.shopStatusTitle}>
                {myShop.shop_name}
              </Text>
              <Text style={styles.shopStatusText}>
                Xaaladda: {myShop.active ? tr("Wuu furan yahay", "Open") : tr("Weli ma furna", "Not active yet")}
              </Text>
              <Text style={styles.shopStatusText}>
                Lacagta dukaanka: $20 USD bishii
              </Text>
              <TouchableOpacity style={styles.secondaryButton} onPress={loadMyShop} disabled={shopLoading}>
                <Text style={styles.secondaryButtonText}>{tr("Hubi xaaladda dukaanka", "Check Shop Status")}</Text>
              </TouchableOpacity>

              {!myShop.active && (
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={payShopSubscription}
                  disabled={paymentLoading}
                >
                  {paymentLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>
                      Bixi $20 bishii — PayPal
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>{tr("Dalabyada dukaankayga", "My Shop Orders")}</Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => { setScreen('seller-orders'); loadMySellerOrders(); }}>
            <Text style={styles.secondaryButtonText}>{tr("Eeg dalabyada iibka", "View Sales Orders")}</Text>
          </TouchableOpacity>
          <Text style={styles.sectionTitle}>{tr("Alaabtayda", "My Products")}</Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={loadMySellerProducts}><Text style={styles.secondaryButtonText}>{tr("Cusboonaysii alaabta", "Refresh Products")}</Text></TouchableOpacity>
          {sellerProductsLoading ? <ActivityIndicator color="#4A286B" /> : sellerProducts.length === 0 ? <Text style={styles.emptyText}>{tr("Weli alaab kuma jirto dukaankaaga.", "Your shop has no products yet.")}</Text> : sellerProducts.map(item => (
            <View key={item.id} style={styles.shopStatusCard}>
              <Text style={styles.shopStatusTitle}>{item.name}</Text>
              <Text style={styles.shopStatusText}>{money(item.price)} · Kaydka: {item.stock}</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity style={[styles.secondaryButton, { flex: 1 }]} onPress={() => beginEditProduct(item)}><Text style={styles.secondaryButtonText}>Tafatir</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.secondaryButton, { flex: 1, borderColor: '#B3261E' }]} onPress={() => deleteSellerProduct(item.id)}><Text style={[styles.secondaryButtonText, { color: '#B3261E' }]}>{tr("Tirtir", "Delete")}</Text></TouchableOpacity>
              </View>
            </View>
          ))}

          <Text style={styles.sectionTitle}>{editingProductId ? tr("Tafatir alaabta", "Edit Product") : tr("Ku dar alaab cusub", "Add New Product")}</Text>
          {editingProductId && <TouchableOpacity onPress={() => { setEditingProductId(null); setProductName(''); setProductDescription(''); setProductPrice(''); setProductStock('10'); setProductImage(''); setProductImageMimeType(''); setProductCategory('Buskut'); }}><Text style={styles.refreshText}>{tr("Jooji tafatirka", "Cancel Editing")}</Text></TouchableOpacity>}

          <Text style={styles.label}>{tr("Magaca alaabta", "Product Name")}</Text>
          <TextInput
            style={styles.input}
            placeholder={tr("Magaca macmacaanka", "Sweet Name")}
            value={productName}
            onChangeText={setProductName}
          />

          <Text style={styles.label}>{tr("Sharaxaadda", "Description")}</Text>
          <TextInput
            style={styles.input}
            placeholder={tr("Sharax alaabta", "Describe the product")}
            value={productDescription}
            onChangeText={setProductDescription}
          />

          <Text style={styles.label}>{tr("Qiimaha (KSh)", "Price (KSh)")}</Text>
          <TextInput
            style={styles.input}
            placeholder="Tusaale: 500"
            value={productPrice}
            onChangeText={setProductPrice}
            keyboardType="numeric"
          />

          <Text style={styles.label}>{tr("Tirada kaydka", "Stock Quantity")}</Text>
          <TextInput
            style={styles.input}
            placeholder="10"
            value={productStock}
            onChangeText={setProductStock}
            keyboardType="numeric"
          />

          <Text style={styles.label}>{tr("Sawirka alaabta", "Product Image")}</Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={pickProductImage} disabled={productImageUploading}>
            <Text style={styles.secondaryButtonText}>{tr("Ka dooro sawir telefoonka", "Choose a photo from your phone")}</Text>
          </TouchableOpacity>
          {productImage ? <Image source={{ uri: productImage }} style={{ width: '100%', height: 180, borderRadius: 14, marginVertical: 10 }} resizeMode="cover" /> : null}
          <Text style={styles.shopStatusText}>Sawirka JPG, PNG ama WEBP; ugu badnaan 5 MB.</Text>
          <TextInput
            style={styles.input}
            placeholder="Ama geli URL sawir (https://...)"
            value={productImage.startsWith('file://') || productImage.startsWith('content://') ? '' : productImage}
            onChangeText={value => { setProductImage(value); setProductImageMimeType(''); }}
            autoCapitalize="none"
          />

          <Text style={styles.label}>{tr("Qaybta alaabta", "Product Category")}</Text>
          <View style={styles.categoryChoices}>
            {categoryRows.map(item => item.name).map(item => (
              <TouchableOpacity
                key={item}
                style={[
                  styles.categoryButton,
                  productCategory === item && styles.categorySelected,
                ]}
                onPress={() => setProductCategory(item)}
              >
                <Text
                  style={[
                    styles.categoryText,
                    productCategory === item && styles.categorySelectedText,
                  ]}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[
              styles.primaryButton,
              addingProduct && styles.disabledButton,
            ]}
            onPress={addProduct}
            disabled={addingProduct}
          >
            {addingProduct || productImageUploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{editingProductId ? tr("Kaydi isbeddelka", "Save Changes") : tr("Ku dar alaabta", "Add Product")}</Text>
            )}
          </TouchableOpacity>
        </>
      )}
    </View>
  );

  if (!session) {
    return (
      <View style={styles.authContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#FCFAFE" />

        <Text style={styles.logo}>IMSIYA 🍰</Text>
        <Text style={styles.authSubtitle}>
          Suuqa macmacaanka ee qof walba
        </Text>

        {authMode === 'signup' && (
          <TextInput
            style={styles.input}
            placeholder={tr("Magacaaga", "Your Name")}
            value={fullName}
            onChangeText={setFullName}
          />
        )}

        <TextInput
          style={styles.input}
          placeholder={tr("Email-kaaga", "Your Email")}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={signInOrSignUp}
          disabled={authLoading}
        >
          {authLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {authMode === 'signup' ? tr("Samee akoon", "Create Account") : tr("Gal akoonka", "Sign In")}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() =>
            setAuthMode(current =>
              current === 'signup' ? 'login' : 'signup'
            )
          }
          style={styles.authSwitch}
        >
          <Text style={styles.authSwitchText}>
            {authMode === 'signup'
              ? tr("Akoon ma leedahay? Gal halkan", "Already have an account? Sign in")
              : tr("Akoon ma lihid? Isdiiwaangeli", "Don't have an account? Sign up")}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FCFAFE" />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerLogo}>IMSIYA</Text>
          <Text style={styles.headerSubtitle}>{tr("Suuqa macmacaanka", "Sweets Marketplace")}</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><TouchableOpacity onPress={() => setLanguage(current => current === 'en' ? 'so' : 'en')} style={{ backgroundColor: '#F3E8FA', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 14 }}><Text style={{ color: '#4A286B', fontWeight: '800', fontSize: 11 }}>{language === 'en' ? 'EN | SO' : 'SO | EN'}</Text></TouchableOpacity><TouchableOpacity onPress={signOut}>
          <Text style={styles.logoutText}>{tr('Ka bax', 'Sign Out')}</Text>
          </TouchableOpacity></View>
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
    backgroundColor: '#FCFAFE',
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
    borderColor: '#E7DDF0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    color: '#2E203B',
    fontSize: 15,
  },
  multilineInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  primaryButton: {
    backgroundColor: '#F3A33B',
    padding: 15,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  disabledButton: {
    opacity: 0.5,
  },
  authSwitch: {
    padding: 12,
    alignItems: 'center',
  },
  authSwitchText: {
    color: '#4A286B',
    fontWeight: '600',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5D9EF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLogo: {
    fontSize: 23,
    fontWeight: 'bold',
    color: '#4A286B',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6F6478',
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
    backgroundColor: '#4A286B',
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
    backgroundColor: '#4A286B',
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
    fontWeight: 'bold',
    fontSize: 21,
    marginBottom: 14,
  },
  refreshText: {
    color: '#4A286B',
    fontWeight: 'bold',
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  favoriteToggle: { alignSelf: 'flex-end', paddingHorizontal: 5, paddingVertical: 1 },
  favoriteToggleText: { color: '#F09A2A', fontSize: 22, fontWeight: 'bold' },
  profileAction: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E7DDF0', borderRadius: 15, padding: 16, marginBottom: 10 },
  profileActionText: { color: '#4A286B', fontWeight: 'bold', fontSize: 15 },
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
    fontWeight: 'bold',
    fontSize: 15,
    marginTop: 9,
  },
  productCategory: {
    color: '#81738B',
    fontSize: 12,
    marginTop: 4,
  },
  productPrice: {
    color: '#4A286B',
    fontWeight: 'bold',
    fontSize: 15,
    marginTop: 6,
  },
  stockText: {
    color: '#6F6478',
    fontSize: 11,
    marginTop: 4,
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
    borderWidth: 1,
    borderColor: '#4A286B',
    padding: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#4A286B',
    fontWeight: 'bold',
  },
  label: {
    color: '#38204F',
    fontWeight: 'bold',
    marginBottom: 7,
    marginTop: 8,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#38204F',
    marginBottom: 8,
  },
  shopStatusText: {
    color: '#6F6478',
    marginBottom: 6,
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
    borderTopColor: '#E5D9EF',
    paddingVertical: 12,
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
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
  },

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
  walletRefreshButton: { alignSelf: 'flex-start', backgroundColor: '#FFFFFF', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 18, marginTop: 17 },
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

});

