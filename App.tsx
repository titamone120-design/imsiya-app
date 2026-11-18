
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
} from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

type Product = {
  id: number;
  name: string;
  price: number;
  emoji: string;
  category: string;
};

type CartItem = Product & { quantity: number };

const categories = [
  'All', 'Biscuits', 'Halwa', 'Cakes', 'Chocolates', 'Desserts',
];

const products: Product[] = [
  { id: 1, name: 'Chocolate Cake', price: 15, emoji: '🎂', category: 'Cakes' },
  { id: 2, name: 'Delicious Halwa', price: 10, emoji: '🍯', category: 'Halwa' },
  { id: 3, name: 'Sweet Biscuits', price: 5, emoji: '🍪', category: 'Biscuits' },
  { id: 4, name: 'Chocolate Treats', price: 8, emoji: '🍫', category: 'Chocolates' },
  { id: 5, name: 'Sweet Cupcake', price: 6, emoji: '🧁', category: 'Cakes' },
  { id: 6, name: 'Ice Cream', price: 7, emoji: '🍨', category: 'Desserts' },
];

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [screen, setScreen] = useState<'home' | 'cart'>('home');
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');

  // Handle email confirmation links that open the IMSIYA app.
  const handleAuthLink = async (url: string | null) => {
    if (!url) return;

    try {
      const parsedUrl = new URL(url);
      const code = parsedUrl.searchParams.get('code');

      // Supabase PKCE confirmation link.
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
        return;
      }

      // Supabase token-based confirmation link.
      const hash = parsedUrl.hash.startsWith('#')
        ? parsedUrl.hash.substring(1)
        : parsedUrl.hash;

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
      Alert.alert(
        'IMSIYA',
        error.message || 'Could not verify your email. Please try again.'
      );
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

    // Handle a confirmation link when the app is already closed.
    Linking.getInitialURL().then(handleAuthLink);

    // Handle a confirmation link when the app is already open.
    const linkingSubscription = Linking.addEventListener(
      'url',
      ({ url }) => {
        handleAuthLink(url);
      }
    );

    return () => {
      subscription.unsubscribe();
      linkingSubscription.remove();
    };
  }, []);

  const handleAuth = async () => {
    if (!email.trim() || !password) {
      Alert.alert('IMSIYA', 'Please enter your email and password.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('IMSIYA', 'Password must be at least 6 characters.');
      return;
    }

    setLoading(true);

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
            'Check your email',
            'Your account has been created. Open the confirmation link in your email to verify your account. The IMSIYA app should open after confirmation.'
          );
        } else {
          Alert.alert('IMSIYA', 'Your account has been created!');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;
      }
    } catch (error: any) {
      Alert.alert('IMSIYA', error.message || 'Something went wrong.');
    } finally {
      setLoading(false);
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
    setCart(current => {
      const found = current.find(item => item.id === product.id);

      if (found) {
        return current.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [...current, { ...product, quantity: 1 }];
    });

    Alert.alert('IMSIYA', product.name + ' added to your cart!');
  };

  const updateQuantity = (id: number, amount: number) => {
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

  const removeItem = (id: number) => {
    setCart(current => current.filter(item => item.id !== id));
  };

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const total = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const filteredProducts = products.filter(item => {
    const categoryMatch =
      category === 'All' || item.category === category;

    const searchMatch =
      item.name.toLowerCase().includes(search.toLowerCase());

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
              ? 'Join IMSIYA and discover delicious sweets.'
              : 'Login to continue shopping on IMSIYA.'}
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
            disabled={loading}
          >
            {loading ? (
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

        <Text style={styles.authFooter}>
          IMSIYA Sweets Marketplace
        </Text>
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
              placeholder="🔍 Search sweets and cakes..."
              placeholderTextColor="#888"
              value={search}
              onChangeText={setSearch}
            />
          </View>

          <Text style={styles.heading}>Explore Categories</Text>

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

          <Text style={styles.heading}>Popular Sweets</Text>

          <View style={styles.products}>
            {filteredProducts.map(item => (
              <View style={styles.product} key={item.id}>
                <Text style={styles.emoji}>{item.emoji}</Text>
                <Text style={styles.productName}>{item.name}</Text>
                <Text style={styles.price}>
                  ${item.price.toFixed(2)}
                </Text>

                <TouchableOpacity
                  style={styles.addButton}
                  onPress={() => addToCart(item)}
                >
                  <Text style={styles.addButtonText}>
                    + Add to Cart
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {filteredProducts.length === 0 && (
            <Text style={styles.emptyText}>No products found.</Text>
          )}

          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>
              Sell your sweets on IMSIYA!
            </Text>
            <Text style={styles.bannerText}>
              Open your shop and reach more customers.
            </Text>
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.cartPage}>
          <View style={styles.cartTitleRow}>
            <Text style={styles.heading}>My Shopping Cart</Text>
            <TouchableOpacity onPress={() => setScreen('home')}>
              <Text style={styles.continueText}>
                Continue Shopping
              </Text>
            </TouchableOpacity>
          </View>

          {cart.length === 0 ? (
            <View style={styles.emptyCart}>
              <Text style={styles.emptyEmoji}>🛒</Text>
              <Text style={styles.emptyTitle}>
                Your cart is empty
              </Text>
              <Text style={styles.emptyText}>
                Add some delicious sweets!
              </Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setScreen('home')}
              >
                <Text style={styles.addButtonText}>
                  Start Shopping
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {cart.map(item => (
                <View style={styles.cartItem} key={item.id}>
                  <Text style={styles.cartEmoji}>{item.emoji}</Text>

                  <View style={styles.cartInfo}>
                    <Text style={styles.productName}>
                      {item.name}
                    </Text>
                    <Text style={styles.price}>
                      ${(item.price * item.quantity).toFixed(2)}
                    </Text>

                    <View style={styles.quantityRow}>
                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => updateQuantity(item.id, -1)}
                      >
                        <Text style={styles.quantityText}>−</Text>
                      </TouchableOpacity>

                      <Text style={styles.quantityNumber}>
                        {item.quantity}
                      </Text>

                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => updateQuantity(item.id, 1)}
                      >
                        <Text style={styles.quantityText}>+</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => removeItem(item.id)}
                      >
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
                  ${total.toFixed(2)}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.checkoutButton}
                onPress={() =>
                  Alert.alert(
                    'IMSIYA',
                    'Your cart is ready! Order processing and payment still need integration.'
                  )
                }
              >
                <Text style={styles.checkoutText}>
                  Proceed to Checkout
                </Text>
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
          <Text style={styles.navText}>
            Cart ({cartCount})
          </Text>
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
  addButton: {
    backgroundColor: '#512080',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
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
