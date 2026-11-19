
import React, { useEffect, useState } from 'react';
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

  const [screen, setScreen] = useState<'home' | 'cart' | 'shop'>('home');

  const [category, setCategory] = useState('Dhammaan');
  const [search, setSearch] = useState('');

  const [shopName, setShopName] = useState('');
  const [shopDescription, setShopDescription] = useState('');
  const [myShop, setMyShop] = useState<Shop | null>(null);

  const [shopLoading, setShopLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);

  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [productStock, setProductStock] = useState('10');
  const [productImage, setProductImage] = useState('');
  const [productCategory, setProductCategory] = useState('Buskut');
  const [addingProduct, setAddingProduct] = useState(false);

  const [categoryRows, setCategoryRows] = useState<Category[]>([]);

  const loadCategories = async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('id, name');

    if (error) {
      console.log('Category error:', error.message);
      return;
    }

    setCategoryRows((data || []) as Category[]);
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
        'Lacag-bixinta waa la dhammeeyey. Waxaan hubinaynaa xaaladda dukaanka.'
      );
      await loadMyShop();
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
    if (session) {
      loadMyShop();
    } else {
      setMyShop(null);
    }
  }, [session?.user?.id]);

  const signInOrSignUp = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('IMSIYA', 'Geli email-ka iyo password-ka.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('IMSIYA', 'Password-ku waa inuu ahaadaa ugu yaraan 6 xaraf.');
      return;
    }

    setAuthLoading(true);

    try {
      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
            },
            emailRedirectTo: 'imsiya://',
          },
        });

        if (error) throw error;

        if (!data.session) {
          Alert.alert(
            'IMSIYA',
            'Akoonka waa la sameeyey. Fadlan email-kaaga ka xaqiiji link-ga laguu soo diray.'
          );
        } else {
          Alert.alert('IMSIYA', 'Akoonkaaga waa la sameeyey.');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;
      }
    } catch (e: any) {
      Alert.alert('IMSIYA', e.message || 'Gelitaanka wuu fashilmay.');
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

    setCart([]);
    setScreen('home');
  };

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      Alert.alert('IMSIYA', 'Alaabtani hadda ma taallo.');
      return;
    }

    setCart(current => {
      const existing = current.find(item => item.id === product.id);

      if (existing) {
        if (existing.quantity >= product.stock) {
          Alert.alert('IMSIYA', 'Tirada alaabta intaas kama badnaan karto.');
          return current;
        }

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
        'create-checkout-session',
        {
          body: {
            shop_id: myShop.id,
            success_url: 'imsiya://subscription-success',
            cancel_url: 'imsiya://subscription-cancel',
          },
        }
      );

      if (error) throw error;

      if (!data?.checkout_url) {
        throw new Error('Stripe ma soo celin link-ga lacag-bixinta.');
      }

      await Linking.openURL(data.checkout_url);
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
      const { error } = await supabase.from('products').insert({
        seller_id: session.user.id,
        shop_id: myShop.id,
        category_id: selectedCategory.id,
        name: productName.trim(),
        description: productDescription.trim(),
        price,
        image_url: productImage.trim() || null,
        stock,
        active: true,
      });

      if (error) throw error;

      setProductName('');
      setProductDescription('');
      setProductPrice('');
      setProductStock('10');
      setProductImage('');

      Alert.alert('IMSIYA', 'Alaabta waa lagu daray dukaanka.');
      await loadProducts();
    } catch (e: any) {
      Alert.alert('IMSIYA', e.message || 'Alaabta lama dari karin.');
    } finally {
      setAddingProduct(false);
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesCategory =
      category === 'Dhammaan' || product.category === category;

    const matchesSearch =
      product.name.toLowerCase().includes(search.toLowerCase());

    return matchesCategory && matchesSearch;
  });

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

      <Text style={styles.productName}>{product.name}</Text>
      <Text style={styles.productCategory}>{product.category}</Text>
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
        {categories.map(item => (
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
        <TouchableOpacity onPress={loadProducts}>
          <Text style={styles.refreshText}>Cusboonaysii</Text>
        </TouchableOpacity>
      </View>

      {productsLoading ? (
        <ActivityIndicator size="large" color="#8B4513" />
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
            style={styles.primaryButton}
            onPress={() =>
              Alert.alert(
                'IMSIYA',
                'Cart-kaagu waa diyaar. Nidaamka dalabka iyo lacag-bixinta macaamiisha weli waa in lagu xiraa database-ka iyo adeegga lacag-bixinta.'
              )
            }
          >
            <Text style={styles.buttonText}>Sii wad dalabka</Text>
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

  const renderShop = () => (
    <View>
      <Text style={styles.sectionTitle}>Dukaankayga</Text>

      {shopLoading ? (
        <ActivityIndicator size="large" color="#8B4513" />
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
                      Bixi $20 bishii — Stripe
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Ku dar alaab cusub</Text>

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

          <Text style={styles.label}>Sawirka alaabta (URL)</Text>
          <TextInput
            style={styles.input}
            placeholder="https://..."
            value={productImage}
            onChangeText={setProductImage}
            autoCapitalize="none"
          />

          <Text style={styles.label}>Qaybta alaabta</Text>
          <View style={styles.categoryChoices}>
            {categories.filter(item => item !== 'Dhammaan').map(item => (
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
            {addingProduct ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Ku dar alaabta</Text>
            )}
          </TouchableOpacity>
        </>
      )}
    </View>
  );

  if (!session) {
    return (
      <View style={styles.authContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />

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
      <StatusBar barStyle="dark-content" backgroundColor="#FFF8F0" />

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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8F0',
  },
  authContainer: {
    flex: 1,
    backgroundColor: '#FFF8F0',
    justifyContent: 'center',
    padding: 24,
  },
  logo: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#8B4513',
    textAlign: 'center',
    marginBottom: 8,
  },
  authSubtitle: {
    textAlign: 'center',
    color: '#76533D',
    marginBottom: 30,
    fontSize: 15,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6D5C5',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    color: '#30251F',
    fontSize: 15,
  },
  multilineInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  primaryButton: {
    backgroundColor: '#8B4513',
    padding: 15,
    borderRadius: 12,
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
    color: '#8B4513',
    fontWeight: '600',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EEDFD2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLogo: {
    fontSize: 23,
    fontWeight: 'bold',
    color: '#8B4513',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#806B5C',
  },
  logoutText: {
    color: '#A13D2D',
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
    backgroundColor: '#F3DFC9',
    borderRadius: 18,
    padding: 20,
    marginBottom: 18,
  },
  heroTitle: {
    fontSize: 22,
    color: '#603719',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  heroText: {
    color: '#684A35',
    fontSize: 14,
    lineHeight: 21,
  },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E6D5C5',
    marginBottom: 14,
    color: '#30251F',
  },
  categoryScroll: {
    marginBottom: 18,
  },
  categoryButton: {
    backgroundColor: '#F1E5DA',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  categorySelected: {
    backgroundColor: '#8B4513',
  },
  categoryText: {
    color: '#69472F',
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
    color: '#603719',
    fontWeight: 'bold',
    fontSize: 21,
    marginBottom: 14,
  },
  refreshText: {
    color: '#8B4513',
    fontWeight: 'bold',
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  productCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F0E2D5',
  },
  productImage: {
    width: '100%',
    height: 115,
    borderRadius: 10,
    backgroundColor: '#F4E8DE',
  },
  imagePlaceholder: {
    height: 115,
    borderRadius: 10,
    backgroundColor: '#F4E8DE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 42,
  },
  productName: {
    color: '#3E2C20',
    fontWeight: 'bold',
    fontSize: 15,
    marginTop: 9,
  },
  productCategory: {
    color: '#927A68',
    fontSize: 12,
    marginTop: 4,
  },
  productPrice: {
    color: '#8B4513',
    fontWeight: 'bold',
    fontSize: 15,
    marginTop: 6,
  },
  stockText: {
    color: '#806B5C',
    fontSize: 11,
    marginTop: 4,
  },
  emptyText: {
    color: '#806B5C',
    textAlign: 'center',
    padding: 25,
  },
  errorText: {
    color: '#B3261E',
    padding: 12,
  },
  cartItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
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
    backgroundColor: '#F1E5DA',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    color: '#603719',
    fontSize: 20,
    fontWeight: 'bold',
  },
  quantityText: {
    color: '#30251F',
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
    color: '#603719',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#8B4513',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#8B4513',
    padding: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#8B4513',
    fontWeight: 'bold',
  },
  label: {
    color: '#603719',
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
    borderColor: '#E6D5C5',
  },
  shopStatusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#603719',
    marginBottom: 8,
  },
  shopStatusText: {
    color: '#806B5C',
    marginBottom: 6,
  },
  divider: {
    height: 1,
    backgroundColor: '#E6D5C5',
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
    borderTopColor: '#EEDFD2',
    paddingVertical: 10,
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
    color: '#69472F',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
  },
});

