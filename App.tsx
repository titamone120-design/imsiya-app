
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
};

type CartItem = Product & { quantity: number };

const categories = [
  'Dhammaan',
  'Buskut',
  'Xalwo',
  'Keeg',
  'Shukulaato',
  'Macmacaan kale',
];

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productError, setProductError] = useState('');

  const [cart, setCart] = useState<CartItem[]>([]);
  const [screen, setScreen] = useState<'home' | 'cart'>('home');
  const [category, setCategory] = useState('Dhammaan');
  const [search, setSearch] = useState('');

  const handleAuthLink = async (url: string | null) => {
    if (!url) return;

    try {
      const parsedUrl = new URL(url);
      const code = parsedUrl.searchParams.get('code');

      if (code) {
        const { error } =
          await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
        return;
      }

      const hash = parsedUrl.hash.replace(/^#/, '');
      const params = new URLSearchParams(hash);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) throw error;
      }
    } catch (error: any) {
      Alert.alert('IMSIYA', error.message || 'Xaqiijinta email-ka way fashilantay.');
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    Linking.getInitialURL().then(handleAuthLink);

    const linkingSubscription = Linking.addEventListener(
      'url',
      ({ url }) => handleAuthLink(url)
    );

    return () => {
      subscription.unsubscribe();
      linkingSubscription.remove();
    };
  }, []);

  // Soo qaad alaabta dhabta ah ee Supabase.
  const loadProducts = async () => {
    setProductsLoading(true);
    setProductError('');

    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, image_url, stock, categories(name)')
        .eq('active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedProducts: Product[] = (data || []).map((item: any) => {
        const categoryData = Array.isArray(item.categories)
          ? item.categories[0]
          : item.categories;

        return {
          id: String(item.id),
          name: item.name || 'Alaab macaan',
          price: Number(item.price) || 0,
          image_url: item.image_url || null,
          stock: Number(item.stock) || 0,
          category: categoryData?.name || 'Macmacaan kale',
        };
      });

      setProducts(formattedProducts);
    } catch (error: any) {
      setProductError(error.message || 'Alaabta lama soo qaadi karin.');
    } finally {
      setProductsLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      loadProducts();
    } else {
      setProducts([]);
    }
  }, [session]);

  const handleAuth = async () => {
    if (!email.trim() || !password) {
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
            emailRedirectTo: 'imsiya://',
          },
        });

        if (error) throw error;

        if (!data.session) {
          Alert.alert(
            'IMSIYA',
            'Account-ka waa la sameeyay. Fadlan email-kaaga ka xaqiiji.'
          );
        } else {
          Alert.alert('IMSIYA', 'Account-kaaga waa diyaar!');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;
      }
    } catch (error: any) {
      Alert.alert('IMSIYA', error.message || 'Waxbaa khaldamay.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      Alert.alert('IMSIYA', error.message);
    } else {
      setCart([]);
      setScreen('home');
    }
  };

  const addToCart = (product: Product) => {
    if (product.stock < 1) {
      Alert.alert('IMSIYA', 'Alaabtan hadda ma taallo.');
      return;
    }

    setCart(current => {
      const found = current.find(item => item.id === product.id);

      if (found) {
        if (found.quantity >= product.stock) {
          Alert.alert('IMSIYA', 'Tirada alaabta intaas way ka badan tahay stock-ga.');
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
  };

  const updateQuantity = (id: string, amount: number) => {
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

  const removeItem = (id: string) => {
    setCart(current => current.filter(item => item.id !== id));
  };

  const cartCount = cart.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  const total = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const filteredProducts = products.filter(item => {
    const categoryMatch =
      category === 'Dhammaan' || item.category === category;

    const searchMatch = item.name
      .toLowerCase()
      .includes(search.toLowerCase());

    return categoryMatch && searchMatch;
  });

  if (!session) {
    return (
      <View style={styles.authContainer}>
        <StatusBar backgroundColor="#512080" barStyle="light-content" />

        <View style={styles.authHeader}>
          <Text style={styles.authLogo}>IMSIYA</Text>
          <Text style={styles.authTagline}>
            A world full of sweetness ❤️
          </Text>
        </View>

        <View style={styles.authCard}>
          <Text style={styles.authTitle}>
            {authMode === 'signup' ? 'Create Account' : 'Welcome Back'}
          </Text>

          <Text style={styles.authSubtitle}>
            {authMode === 'signup'
              ? 'Ku soo biir IMSIYA.'
              : 'Gal account-kaaga IMSIYA.'}
          </Text>

          <Text style={styles.fieldLabel}>Email Address</Text>
          <TextInput
            style={styles.authInput}
            placeholder="Enter your email"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.fieldLabel}>Password</Text>
          <TextInput
            style={styles.authInput}
            placeholder="At least 6 characters"
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />

          <TouchableOpacity
            style={styles.authButton}
            onPress={handleAuth}
            disabled={authLoading}
          >
            {authLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.authButtonText}>
                {authMode === 'signup' ? 'Create Account' : 'Login'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchAuth}
            onPress={() =>
              setAuthMode(authMode === 'signup' ? 'login' : 'signup')
            }
          >
            <Text style={styles.switchAuthText}>
              {authMode === 'signup'
                ? 'Already have an account? Login'
                : "Don't have an account? Sign Up"}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.authFooter}>IMSIYA Sweets Marketplace</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#512080" barStyle="light-content" />

      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>IMSIYA</Text>
          <Text style={styles.tagline}>A world full of sweetness ❤️</Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.cartButton}
            onPress={() => setScreen('cart')}
          >
            <Text style={styles.cartButtonText}>
              🛒 Cart ({cartCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      {screen === 'home' ? (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.welcomeBox}>
            <Text style={styles.welcomeText}>
              Welcome, {session.user.email}
            </Text>
          </View>

          <View style={styles.searchBox}>
            <TextInput
              style={styles.searchInput}
              placeholder="🔍 Raadi macmacaanka..."
              placeholderTextColor="#888"
              value={search}
              onChangeText={setSearch}
            />
          </View>

          <Text style={styles.heading}>Qaybaha Alaabta</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categories}
          >
            {categories.map(item => (
              <TouchableOpacity
                key={item}
                style={[
                  styles.category,
                  category === item && styles.selectedCategory,
                ]}
                onPress={() => setCategory(item)}
              >
                <Text
                  style={[
                    styles.categoryText,
                    category === item && styles.selectedCategoryText,
                  ]}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.productsTitleRow}>
            <Text style={styles.heading}>Alaabta IMSIYA</Text>
            <TouchableOpacity onPress={loadProducts}>
              <Text style={styles.refreshText}>Refresh ↻</Text>
            </TouchableOpacity>
          </View>

          {productsLoading ? (
            <ActivityIndicator
              size="large"
              color="#512080"
              style={styles.loader}
            />
          ) : productError ? (
            <View style={styles.messageBox}>
              <Text style={styles.emptyText}>{productError}</Text>
              <TouchableOpacity style={styles.addButton} onPress={loadProducts}>
                <Text style={styles.addButtonText}>Mar kale isku day</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.products}>
              {filteredProducts.map(item => (
                <View style={styles.product} key={item.id}>
                  {item.image_url ? (
                    <Image
                      source={{ uri: item.image_url }}
                      style={styles.productImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <Text style={styles.emoji}>🍬</Text>
                  )}

                  <Text style={styles.productName}>{item.name}</Text>
                  <Text style={styles.price}>
                    KSh {item.price.toLocaleString()}
                  </Text>
                  <Text style={styles.stockText}>
                    {item.stock > 0 ? `Stock: ${item.stock}` : 'Waa dhammaaday'}
                  </Text>

                  <TouchableOpacity
                    style={[
                      styles.addButton,
                      item.stock < 1 && styles.disabledButton,
                    ]}
                    disabled={item.stock < 1}
                    onPress={() => addToCart(item)}
                  >
                    <Text style={styles.addButtonText}>
                      {item.stock > 0 ? '+ Cart ku dar' : 'Ma jiro'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {!productsLoading && !productError && filteredProducts.length === 0 && (
            <Text style={styles.emptyText}>
              Weli alaab laguma darin qaybtan.
            </Text>
          )}

          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>
              Ku iibso macmacaankaaga IMSIYA!
            </Text>
            <Text style={styles.bannerText}>
              Fur dukaankaaga oo gaadh macaamiil badan.
            </Text>
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.cartPage}>
          <View style={styles.cartTitleRow}>
            <Text style={styles.heading}>My Shopping Cart</Text>
            <TouchableOpacity onPress={() => setScreen('home')}>
              <Text style={styles.continueText}>Continue Shopping</Text>
            </TouchableOpacity>
          </View>

          {cart.length === 0 ? (
            <View style={styles.emptyCart}>
              <Text style={styles.emptyEmoji}>🛒</Text>
              <Text style={styles.emptyTitle}>Cart-kaagu waa madhan yahay</Text>
              <Text style={styles.emptyText}>Ku dar macmacaan aad jeceshahay!</Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setScreen('home')}
              >
                <Text style={styles.addButtonText}>Shopping bilow</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {cart.map(item => (
                <View style={styles.cartItem} key={item.id}>
                  {item.image_url ? (
                    <Image
                      source={{ uri: item.image_url }}
                      style={styles.cartImage}
                    />
                  ) : (
                    <Text style={styles.cartEmoji}>🍬</Text>
                  )}

                  <View style={styles.cartInfo}>
                    <Text style={styles.productName}>{item.name}</Text>
                    <Text style={styles.price}>
                      KSh {(item.price * item.quantity).toLocaleString()}
                    </Text>

                    <View style={styles.quantityRow}>
                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => updateQuantity(item.id, -1)}
                      >
                        <Text style={styles.quantityText}>−</Text>
                      </TouchableOpacity>

                      <Text style={styles.quantityNumber}>{item.quantity}</Text>

                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => updateQuantity(item.id, 1)}
                      >
                        <Text style={styles.quantityText}>+</Text>
                      </TouchableOpacity>

                      <TouchableOpacity onPress={() => removeItem(item.id)}>
                        <Text style={styles.removeText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}

              <View style={styles.totalBox}>
                <Text style={styles.totalLabel}>
                  Total ({cartCount} items)
                </Text>
                <Text style={styles.totalPrice}>
                  KSh {total.toLocaleString()}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.checkoutButton}
                onPress={() =>
                  Alert.alert(
                    'IMSIYA',
                    'Cart-kaagu waa diyaar. Nidaamka dalabka iyo lacag-bixinta weli waa in la isku xiraa.'
                  )
                }
              >
                <Text style={styles.checkoutText}>Proceed to Checkout</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      )}

      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setScreen('home')}
        >
          <Text style={styles.navIcon}>🏠</Text>
          <Text style={styles.navText}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setScreen('cart')}
        >
          <Text style={styles.navIcon}>🛒</Text>
          <Text style={styles.navText}>Cart ({cartCount})</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fffaf6',
  },
  header: {
    backgroundColor: '#512080',
    padding: 16,
    paddingTop: 35,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerActions: {
    alignItems: 'flex-end',
    gap: 7,
  },
  logo: {
    color: '#fff',
    fontSize: 27,
    fontWeight: '900',
    letterSpacing: 2,
  },
  tagline: {
    color: '#f4dfff',
    fontSize: 12,
    marginTop: 3,
  },
  cartButton: {
    backgroundColor: '#ff9d35',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  cartButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  logoutButton: {
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  logoutText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  welcomeBox: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  welcomeText: {
    color: '#512080',
    fontSize: 12,
    fontWeight: '700',
  },
  searchBox: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee2f2',
  },
  searchInput: {
    padding: 13,
    fontSize: 14,
    color: '#24133b',
  },
  heading: {
    color: '#24133b',
    fontSize: 19,
    fontWeight: '800',
    marginHorizontal: 16,
    marginTop: 15,
    marginBottom: 12,
  },
  categories: {
    paddingHorizontal: 16,
  },
  category: {
    backgroundColor: '#f0e8f6',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 9,
  },
  selectedCategory: {
    backgroundColor: '#512080',
  },
  categoryText: {
    color: '#512080',
    fontWeight: '700',
  },
  selectedCategoryText: {
    color: '#fff',
  },
  productsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  refreshText: {
    color: '#512080',
    fontWeight: 'bold',
    marginHorizontal: 16,
    marginTop: 12,
  },
  loader: {
    margin: 35,
  },
  products: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
    justifyContent: 'space-between',
  },
  product: {
    backgroundColor: '#fff',
    width: '48%',
    borderRadius: 15,
    padding: 12,
    marginBottom: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f0e8f6',
  },
  productImage: {
    width: '100%',
    height: 115,
    borderRadius: 10,
    marginVertical: 8,
  },
  emoji: {
    fontSize: 48,
    marginVertical: 8,
  },
  productName: {
    color: '#24133b',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 5,
  },
  price: {
    color: '#e98224',
    fontSize: 16,
    fontWeight: '900',
    marginVertical: 8,
  },
  stockText: {
    color: '#777',
    fontSize: 11,
  },
  addButton: {
    backgroundColor: '#512080',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
  },
  disabledButton: {
    backgroundColor: '#999',
  },
  addButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  banner: {
    backgroundColor: '#512080',
    margin: 16,
    padding: 20,
    borderRadius: 15,
  },
  bannerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
  },
  bannerText: {
    color: '#f4dfff',
    marginTop: 8,
  },
  emptyText: {
    textAlign: 'center',
    color: '#777',
    padding: 20,
  },
  messageBox: {
    padding: 15,
  },
  cartPage: {
    paddingBottom: 30,
  },
  cartTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  continueText: {
    color: '#512080',
    fontWeight: 'bold',
    marginHorizontal: 16,
  },
  emptyCart: {
    alignItems: 'center',
    padding: 35,
  },
  emptyEmoji: {
    fontSize: 65,
    marginBottom: 15,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#24133b',
  },
  cartItem: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginBottom: 12,
    padding: 14,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartImage: {
    width: 60,
    height: 60,
    borderRadius: 10,
    marginRight: 15,
  },
  cartEmoji: {
    fontSize: 42,
    marginRight: 15,
  },
  cartInfo: {
    flex: 1,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 12,
  },
  quantityButton: {
    backgroundColor: '#f0e8f6',
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityText: {
    color: '#512080',
    fontSize: 20,
    fontWeight: 'bold',
  },
  quantityNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#24133b',
  },
  removeText: {
    color: '#d33',
    fontSize: 12,
    fontWeight: 'bold',
  },
  totalBox: {
    backgroundColor: '#f0e8f6',
    margin: 16,
    padding: 18,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalLabel: {
    color: '#24133b',
    fontSize: 17,
    fontWeight: 'bold',
  },
  totalPrice: {
    color: '#512080',
    fontSize: 20,
    fontWeight: '900',
  },
  checkoutButton: {
    backgroundColor: '#ff9d35',
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  checkoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  navItem: {
    alignItems: 'center',
    paddingHorizontal: 25,
  },
  navIcon: {
    fontSize: 21,
  },
  navText: {
    color: '#512080',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 3,
  },
  authContainer: {
    flex: 1,
    backgroundColor: '#fffaf6',
    justifyContent: 'center',
    padding: 22,
  },
  authHeader: {
    alignItems: 'center',
    marginBottom: 30,
  },
  authLogo: {
    color: '#512080',
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: 3,
  },
  authTagline: {
    color: '#8a659f',
    marginTop: 5,
  },
  authCard: {
    backgroundColor: '#fff',
    padding: 22,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#eee2f2',
  },
  authTitle: {
    fontSize: 25,
    fontWeight: '900',
    color: '#24133b',
    textAlign: 'center',
  },
  authSubtitle: {
    color: '#777',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 22,
  },
  fieldLabel: {
    color: '#512080',
    fontWeight: '700',
    marginBottom: 7,
    marginTop: 10,
  },
  authInput: {
    backgroundColor: '#fffaf6',
    borderWidth: 1,
    borderColor: '#e8dced',
    borderRadius: 11,
    padding: 14,
    color: '#24133b',
  },
  authButton: {
    backgroundColor: '#512080',
    padding: 15,
    borderRadius: 11,
    alignItems: 'center',
    marginTop: 22,
  },
  authButtonText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 16,
  },
  switchAuth: {
    padding: 15,
    alignItems: 'center',
  },
  switchAuthText: {
    color: '#512080',
    fontWeight: '700',
    textAlign: 'center',
  },
  authFooter: {
    textAlign: 'center',
    color: '#999',
    marginTop: 25,
    fontSize: 12,
  },
});
