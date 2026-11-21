
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

  const [screen, setScreen] = useState<'home' | 'cart' | 'shop' | 'admin' | 'profile' | 'favorites' | 'orders' | 'seller-orders' | 'product'>('home');
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
  const [productImageUploading, setProductImageUploading] = useState(false);
  const [productCategory, setProductCategory] = useState('Buskut');
  const [addingProduct, setAddingProduct] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [sellerProducts, setSellerProducts] = useState<Product[]>([]);
  const [sellerProductsLoading, setSellerProductsLoading] = useState(false);

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
      const [sellersResult, ordersResult, subscriptionsResult, walletResult] = await Promise.all([
        supabase.from('seller_profiles').select('id, shop_name, description, approved, created_at').eq('approved', false).order('created_at', { ascending: false }).limit(50),
        supabase.from('orders').select('id, customer_id, total_amount, currency, usd_total_amount, status, payment_status, payment_method, created_at').order('created_at', { ascending: false }).limit(50),
        supabase.from('shop_subscriptions').select('id, shop_id, amount, currency, status, started_at, expires_at, created_at').order('created_at', { ascending: false }).limit(50),
        supabase.from('wallet_transactions').select('id, seller_id, amount, transaction_type, description, order_id, created_at').order('created_at', { ascending: false }).limit(50),
      ]);
      if (sellersResult.error) throw sellersResult.error;
      if (ordersResult.error) throw ordersResult.error;
      if (subscriptionsResult.error) throw subscriptionsResult.error;
      if (walletResult.error) throw walletResult.error;
      setPendingSellers(sellersResult.data || []);
      setAdminOrders(ordersResult.data || []);
      setAdminSubscriptions(subscriptionsResult.data || []);
      setAdminWallet(walletResult.data || []);
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
      const { error } = await supabase
        .from('orders')
        .update({ status: nextStatus })
        .eq('id', orderId)
        .eq('payment_status', 'paid');
      if (error) throw error;
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
      if (savedImageUrl && !/^https?:\\/\\//i.test(savedImageUrl)) {
        setProductImageUploading(true);
        const imageResponse = await fetch(savedImageUrl);
        if (!imageResponse.ok) throw new Error('Sawirka telefoonka lama akhrin karin.');
        const imageBlob = await imageResponse.blob();
        const mimeType = String(imageBlob.type || 'image/jpeg').toLowerCase().split(';')[0];
        const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : mimeType === 'image/jpeg' ? 'jpg' : '';
        if (!extension) throw new Error('Sawirka waa inuu noqdaa JPG, PNG ama WEBP.');
        if (imageBlob.size <= 0 || imageBlob.size > 5 * 1024 * 1024) throw new Error('Sawirka waa inuu ka yaraadaa 5 MB.');
        const imagePath = session.user.id + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 9) + '.' + extension;
        const { error: uploadError } = await supabase.storage.from('product-images').upload(imagePath, imageBlob, {
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
        <Text style={styles.buttonText}>Ku dar cart-ka</Text>
      </TouchableOpacity>
    </View>
  );

  const renderHome = () => (
    <>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Ku soo dhowow IMSIYA 🍰</Text>
        <Text style={styles.heroText}>
          Ka iibso macmacaanka aad jeceshahay, ama fur dukaankaaga.
        </Text>
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="Raadi buskut, xalwo, keeg..."
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
        <Text style={styles.sectionTitle}>Macmacaanka</Text>
        <TouchableOpacity onPress={() => { loadProducts(); loadCategories(); }}>
          <Text style={styles.refreshText}>Cusboonaysii</Text>
        </TouchableOpacity>
      </View>

      {productsLoading ? (
        <ActivityIndicator size="large" color="#5B2A86" />
      ) : productError ? (
        <Text style={styles.errorText}>{productError}</Text>
      ) : filteredProducts.length === 0 ? (
        <Text style={styles.emptyText}>Weli alaab lama helin.</Text>
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
      Alert.alert('IMSIYA', 'Cart-kaagu waa madhan yahay.');
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

  const renderSellerOrders = () => (
    <View>
      <Text style={styles.sectionTitle}>Dalabyada dukaankayga</Text>
      <TouchableOpacity onPress={() => setScreen('shop')}><Text style={styles.refreshText}>← Ku noqo dukaanka</Text></TouchableOpacity>
      <TouchableOpacity style={styles.secondaryButton} onPress={loadMySellerOrders} disabled={sellerOrdersLoading}>
        <Text style={styles.secondaryButtonText}>Cusboonaysii dalabyada</Text>
      </TouchableOpacity>
      {sellerOrdersLoading ? <ActivityIndicator size="large" color="#5B2A86" /> : sellerOrders.length === 0 ? (
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
      <Text style={styles.sectionTitle}>Dalabyadayda</Text>
      <TouchableOpacity onPress={() => setScreen('profile')}><Text style={styles.refreshText}>← Ku noqo Profile</Text></TouchableOpacity>
      <TouchableOpacity style={styles.secondaryButton} onPress={loadMyOrders}><Text style={styles.secondaryButtonText}>Cusboonaysii dalabyada</Text></TouchableOpacity>
      {ordersLoading ? <ActivityIndicator size="large" color="#5B2A86" /> : myOrders.length === 0 ? <Text style={styles.emptyText}>Weli dalab kuma jiro akoonkaaga.</Text> : myOrders.map(order => (
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
        <Text style={styles.heroTitle}>Akoonkayga</Text>
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
        <Text style={styles.sectionTitle}>Alaabta aan jeclahay</Text>
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
          <Text style={styles.buttonText}>Ku dar cart-ka</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderCart = () => (
    <View>
      <Text style={styles.sectionTitle}>Cart-kaaga</Text>

      {cart.length === 0 ? (
        <Text style={styles.emptyText}>Cart-kaagu waa madhan yahay.</Text>
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
            <Text style={styles.totalLabel}>Wadarta</Text>
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
              <Text style={styles.buttonText}>Ku bixi PayPal</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => setCart([])}
          >
            <Text style={styles.secondaryButtonText}>Nadiifi cart-ka</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );

  const renderAdmin = () => (
    <View>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Maamulka IMSIYA</Text>
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
        <Text style={styles.shopStatusTitle}>Codsiyada iibiyeyaasha</Text>
        <Text style={styles.shopStatusText}>Sugaya ansixinta: {pendingSellers.length}</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={loadAdminData}>
          <Text style={styles.buttonText}>Cusboonaysii</Text>
        </TouchableOpacity>
      </View>
      {adminLoading ? <ActivityIndicator size="large" color="#5B2A86" /> : pendingSellers.length === 0 ? (
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
        <Text style={styles.shopStatusTitle}>Guudmar maamulka</Text>
        <Text style={styles.shopStatusText}>Dalabyada: {adminOrders.length} kii ugu dambeeyey</Text>
        <Text style={styles.shopStatusText}>Subscriptions: {adminSubscriptions.length} kii ugu dambeeyey</Text>
        <Text style={styles.shopStatusText}>Wallet transactions: {adminWallet.length} kii ugu dambeeyey</Text>
      </View>

      <Text style={styles.sectionTitle}>Dalabyada macaamiisha</Text>
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

      <Text style={styles.sectionTitle}>Lacagaha dukaamada ($20 bishii)</Text>
      {adminSubscriptions.length === 0 ? <Text style={styles.emptyText}>Weli subscription lama diiwaangelin.</Text> : adminSubscriptions.map(sub => (
        <View key={sub.id} style={styles.shopStatusCard}>
          <Text style={styles.shopStatusTitle}>{sub.currency || 'USD'} {Number(sub.amount || 0).toFixed(2)} · {sub.status}</Text>
          <Text style={styles.shopStatusText}>Shop ID: {sub.shop_id}</Text>
          <Text style={styles.shopStatusText}>Bilow: {sub.started_at ? new Date(sub.started_at).toLocaleDateString() : '—'}</Text>
          <Text style={styles.shopStatusText}>Dhamaad: {sub.expires_at ? new Date(sub.expires_at).toLocaleDateString() : '—'}</Text>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Dhaqdhaqaaqa wallet-ka iibiyeyaasha</Text>
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
      <Text style={styles.sectionTitle}>Dukaankayga</Text>

      {shopLoading ? (
        <ActivityIndicator size="large" color="#5B2A86" />
      ) : (
        <>
          <Text style={styles.label}>Magaca dukaanka</Text>
          <TextInput
            style={styles.input}
            placeholder="Tusaale: IMSIYA Sweets"
            value={shopName}
            onChangeText={setShopName}
          />

          <Text style={styles.label}>Sharaxaadda dukaanka</Text>
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
                Xaaladda: {myShop.active ? 'Wuu furan yahay' : 'Weli ma furna'}
              </Text>
              <Text style={styles.shopStatusText}>
                Lacagta dukaanka: $20 USD bishii
              </Text>
              <TouchableOpacity style={styles.secondaryButton} onPress={loadMyShop} disabled={shopLoading}>
                <Text style={styles.secondaryButtonText}>Hubi xaaladda dukaanka</Text>
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

          <Text style={styles.sectionTitle}>Dalabyada dukaankayga</Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => { setScreen('seller-orders'); loadMySellerOrders(); }}>
            <Text style={styles.secondaryButtonText}>Eeg dalabyada iibka</Text>
          </TouchableOpacity>
          <Text style={styles.sectionTitle}>Alaabtayda</Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={loadMySellerProducts}><Text style={styles.secondaryButtonText}>Cusboonaysii alaabta</Text></TouchableOpacity>
          {sellerProductsLoading ? <ActivityIndicator color="#5B2A86" /> : sellerProducts.length === 0 ? <Text style={styles.emptyText}>Weli alaab kuma jirto dukaankaaga.</Text> : sellerProducts.map(item => (
            <View key={item.id} style={styles.shopStatusCard}>
              <Text style={styles.shopStatusTitle}>{item.name}</Text>
              <Text style={styles.shopStatusText}>{money(item.price)} · Kaydka: {item.stock}</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity style={[styles.secondaryButton, { flex: 1 }]} onPress={() => beginEditProduct(item)}><Text style={styles.secondaryButtonText}>Tafatir</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.secondaryButton, { flex: 1, borderColor: '#B3261E' }]} onPress={() => deleteSellerProduct(item.id)}><Text style={[styles.secondaryButtonText, { color: '#B3261E' }]}>Tirtir</Text></TouchableOpacity>
              </View>
            </View>
          ))}

          <Text style={styles.sectionTitle}>{editingProductId ? 'Tafatir alaabta' : 'Ku dar alaab cusub'}</Text>
          {editingProductId && <TouchableOpacity onPress={() => { setEditingProductId(null); setProductName(''); setProductDescription(''); setProductPrice(''); setProductStock('10'); setProductImage(''); setProductCategory('Buskut'); }}><Text style={styles.refreshText}>Jooji tafatirka</Text></TouchableOpacity>}

          <Text style={styles.label}>Magaca alaabta</Text>
          <TextInput
            style={styles.input}
            placeholder="Magaca macmacaanka"
            value={productName}
            onChangeText={setProductName}
          />

          <Text style={styles.label}>Sharaxaadda</Text>
          <TextInput
            style={styles.input}
            placeholder="Sharax alaabta"
            value={productDescription}
            onChangeText={setProductDescription}
          />

          <Text style={styles.label}>Qiimaha (KSh)</Text>
          <TextInput
            style={styles.input}
            placeholder="Tusaale: 500"
            value={productPrice}
            onChangeText={setProductPrice}
            keyboardType="numeric"
          />

          <Text style={styles.label}>Tirada kaydka</Text>
          <TextInput
            style={styles.input}
            placeholder="10"
            value={productStock}
            onChangeText={setProductStock}
            keyboardType="numeric"
          />

          <Text style={styles.label}>Sawirka alaabta</Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={pickProductImage} disabled={productImageUploading}>
            <Text style={styles.secondaryButtonText}>Ka dooro sawir telefoonka</Text>
          </TouchableOpacity>
          {productImage ? <Image source={{ uri: productImage }} style={{ width: '100%', height: 180, borderRadius: 14, marginVertical: 10 }} resizeMode="cover" /> : null}
          <Text style={styles.shopStatusText}>Sawirka JPG, PNG ama WEBP; ugu badnaan 5 MB.</Text>
          <TextInput
            style={styles.input}
            placeholder="Ama geli URL sawir (https://...)"
            value={productImage.startsWith('file://') || productImage.startsWith('content://') ? '' : productImage}
            onChangeText={setProductImage}
            autoCapitalize="none"
          />

          <Text style={styles.label}>Qaybta alaabta</Text>
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
              <Text style={styles.buttonText}>{editingProductId ? 'Kaydi isbeddelka' : 'Ku dar alaabta'}</Text>
            )}
          </TouchableOpacity>
        </>
      )}
    </View>
  );

  if (!session) {
    return (
      <View style={styles.authContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8F5FC" />

        <Text style={styles.logo}>IMSIYA 🍰</Text>
        <Text style={styles.authSubtitle}>
          Suuqa macmacaanka ee qof walba
        </Text>

        {authMode === 'signup' && (
          <TextInput
            style={styles.input}
            placeholder="Magacaaga"
            value={fullName}
            onChangeText={setFullName}
          />
        )}

        <TextInput
          style={styles.input}
          placeholder="Email-kaaga"
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
              {authMode === 'signup' ? 'Samee akoon' : 'Gal akoonka'}
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
              ? 'Akoon ma leedahay? Gal halkan'
              : 'Akoon ma lihid? Isdiiwaangeli'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F5FC" />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerLogo}>IMSIYA</Text>
          <Text style={styles.headerSubtitle}>Suuqa macmacaanka</Text>
        </View>

        <TouchableOpacity onPress={signOut}>
          <Text style={styles.logoutText}>Ka bax</Text>
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
        {screen === 'product' && renderProductDetails()}
      </ScrollView>

      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setScreen('home')}
        >
          <Text style={styles.navIcon}>🏠</Text>
          <Text style={styles.navText}>Hoyga</Text>
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
          <Text style={styles.navText}>Dukaankayga</Text>
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
    backgroundColor: '#F8F5FC',
    justifyContent: 'center',
    padding: 24,
  },
  logo: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#5B2A86',
    textAlign: 'center',
    marginBottom: 8,
  },
  authSubtitle: {
    textAlign: 'center',
    color: '#766184',
    marginBottom: 30,
    fontSize: 15,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5D8F0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    color: '#30243A',
    fontSize: 15,
  },
  multilineInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  primaryButton: {
    backgroundColor: '#F28C28',
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
    color: '#5B2A86',
    fontWeight: '600',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2D4EF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLogo: {
    fontSize: 23,
    fontWeight: 'bold',
    color: '#5B2A86',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#796A86',
  },
  logoutText: {
    color: '#D97706',
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
    backgroundColor: '#5B2A86',
    borderRadius: 22,
    padding: 22,
    marginBottom: 20,
    borderLeftWidth: 5,
    borderLeftColor: '#F28C28',
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
    borderColor: '#E5D8F0',
    marginBottom: 14,
    color: '#30243A',
  },
  categoryScroll: {
    marginBottom: 18,
  },
  categoryButton: {
    backgroundColor: '#F0E7F8',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  categorySelected: {
    backgroundColor: '#5B2A86',
  },
  categoryText: {
    color: '#68447F',
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
    color: '#492064',
    fontWeight: 'bold',
    fontSize: 21,
    marginBottom: 14,
  },
  refreshText: {
    color: '#5B2A86',
    fontWeight: 'bold',
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  favoriteToggle: { alignSelf: 'flex-end', paddingHorizontal: 5, paddingVertical: 1 },
  favoriteToggleText: { color: '#D97706', fontSize: 22, fontWeight: 'bold' },
  profileAction: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E8DDF1', borderRadius: 15, padding: 16, marginBottom: 10 },
  profileActionText: { color: '#5B2A86', fontWeight: 'bold', fontSize: 15 },
  productCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E8DDF1',
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
    color: '#30243A',
    fontWeight: 'bold',
    fontSize: 15,
    marginTop: 9,
  },
  productCategory: {
    color: '#8B7A98',
    fontSize: 12,
    marginTop: 4,
  },
  productPrice: {
    color: '#5B2A86',
    fontWeight: 'bold',
    fontSize: 15,
    marginTop: 6,
  },
  stockText: {
    color: '#796A86',
    fontSize: 11,
    marginTop: 4,
  },
  emptyText: {
    color: '#796A86',
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
    borderColor: '#E8DDF1',
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
    backgroundColor: '#F0E7F8',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    color: '#492064',
    fontSize: 20,
    fontWeight: 'bold',
  },
  quantityText: {
    color: '#30243A',
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
    color: '#492064',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#5B2A86',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#5B2A86',
    padding: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#5B2A86',
    fontWeight: 'bold',
  },
  label: {
    color: '#492064',
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
    borderColor: '#E5D8F0',
  },
  shopStatusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#492064',
    marginBottom: 8,
  },
  shopStatusText: {
    color: '#796A86',
    marginBottom: 6,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5D8F0',
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
    borderTopColor: '#E2D4EF',
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
    color: '#68447F',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
  },
});

