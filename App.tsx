
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  TextInput,
} from 'react-native';

const categories = ['All', 'Biscuits', 'Halwa', 'Cakes', 'Chocolates', 'Desserts'];

const products = [
  { name: 'Chocolate Cake', price: '$15', emoji: '🎂', category: 'Cakes', description: 'A delicious chocolate cake.' },
  { name: 'Delicious Halwa', price: '$10', emoji: '🍯', category: 'Halwa', description: 'Traditional sweet halwa.' },
  { name: 'Sweet Biscuits', price: '$5', emoji: '🍪', category: 'Biscuits', description: 'Fresh and crunchy biscuits.' },
  { name: 'Chocolate Treats', price: '$8', emoji: '🍫', category: 'Chocolates', description: 'Sweet chocolate treats.' },
  { name: 'Ice Cream Dessert', price: '$7', emoji: '🍨', category: 'Desserts', description: 'A creamy dessert.' },
];

export default function App() {
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [page, setPage] = useState('home');

  const filtered = products.filter((item) =>
    (category === 'All' || item.category === category) &&
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  const goHome = () => {
    setPage('home');
    setSelected(null);
  };

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#512080" barStyle="light-content" />

      {page === 'home' && !selected && (
        <ScrollView>
          <View style={styles.header}>
            <Text style={styles.logo}>IMSIYA</Text>
            <Text style={styles.tagline}>A world full of sweetness ❤️</Text>
          </View>

          <TextInput
            style={styles.search}
            placeholder="🔍 Search sweets and cakes..."
            placeholderTextColor="#888"
            value={search}
            onChangeText={setSearch}
          />

          <Text style={styles.heading}>Explore Categories</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {categories.map((item) => (
              <TouchableOpacity
                key={item}
                style={[styles.category, category === item && styles.activeCategory]}
                onPress={() => setCategory(item)}
              >
                <Text style={[styles.categoryText, category === item && styles.activeText]}>
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.heading}>Popular Sweets</Text>

          <View style={styles.products}>
            {filtered.map((item) => (
              <TouchableOpacity
                key={item.name}
                style={styles.product}
                onPress={() => setSelected(item)}
              >
                <Text style={styles.emoji}>{item.emoji}</Text>
                <Text style={styles.productName}>{item.name}</Text>
                <Text style={styles.price}>{item.price}</Text>
                <Text style={styles.openText}>View product →</Text>
              </TouchableOpacity>
            ))}
          </View>

          {filtered.length === 0 && (
            <Text style={styles.empty}>No sweets found.</Text>
          )}

          <TouchableOpacity
            style={styles.banner}
            onPress={() => setPage('seller')}
          >
            <Text style={styles.bannerTitle}>Sell your sweets on IMSIYA!</Text>
            <Text style={styles.bannerText}>
              Open your shop and reach more customers.
            </Text>
            <Text style={styles.openText}>Become a seller →</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {selected && (
        <ScrollView>
          <TouchableOpacity style={styles.back} onPress={goHome}>
            <Text style={styles.backText}>← Back to Home</Text>
          </TouchableOpacity>
          <View style={styles.detail}>
            <Text style={styles.bigEmoji}>{selected.emoji}</Text>
            <Text style={styles.detailTitle}>{selected.name}</Text>
            <Text style={styles.price}>{selected.price}</Text>
            <Text style={styles.description}>{selected.description}</Text>
            <TouchableOpacity style={styles.action}>
              <Text style={styles.actionText}>Add to Cart</Text>
            </TouchableOpacity>
            <Text style={styles.note}>
              Shopping and payment will be connected in the next development stage.
            </Text>
          </View>
        </ScrollView>
      )}

      {page === 'seller' && (
        <View style={styles.detail}>
          <TouchableOpacity style={styles.back} onPress={goHome}>
            <Text style={styles.backText}>← Back to Home</Text>
          </TouchableOpacity>
          <Text style={styles.bigEmoji}>🏪</Text>
          <Text style={styles.detailTitle}>Become an IMSIYA Seller</Text>
          <Text style={styles.description}>
            Sell biscuits, halwa, cakes and all kinds of sweets on IMSIYA.
          </Text>
          <Text style={styles.note}>
            Seller registration will be connected to the secure backend next.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF9F4' },
  header: { backgroundColor: '#512080', padding: 28, paddingTop: 50 },
  logo: { color: 'white', fontSize: 32, fontWeight: '900' },
  tagline: { color: '#FFE0B2', marginTop: 5 },
  search: {
    backgroundColor: 'white', margin: 18, padding: 16,
    borderRadius: 14, borderWidth: 1, borderColor: '#E8DCEF',
    color: '#352047',
  },
  heading: {
    fontSize: 21, fontWeight: 'bold', color: '#512080',
    marginHorizontal: 18, marginTop: 18, marginBottom: 14,
  },
  category: {
    backgroundColor: '#F0E4FA', padding: 15,
    borderRadius: 12, marginLeft: 12,
  },
  activeCategory: { backgroundColor: '#512080' },
  categoryText: { color: '#512080', fontWeight: 'bold' },
  activeText: { color: 'white' },
  products: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  product: {
    backgroundColor: 'white', width: '44%', padding: 16,
    marginVertical: 8, borderRadius: 16, elevation: 2,
  },
  emoji: { fontSize: 48, textAlign: 'center', marginBottom: 10 },
  productName: { color: '#352047', fontWeight: 'bold' },
  price: { color: '#E78326', fontSize: 18, fontWeight: 'bold', marginTop: 8 },
  openText: { color: '#512080', fontWeight: 'bold', marginTop: 12 },
  empty: { textAlign: 'center', padding: 30, color: '#777' },
  banner: {
    backgroundColor: '#F5E6D8', margin: 18,
    padding: 20, borderRadius: 16,
  },
  bannerTitle: { color: '#512080', fontSize: 18, fontWeight: 'bold' },
  bannerText: { color: '#654D70', marginTop: 8 },
  back: { padding: 20 },
  backText: { color: '#512080', fontSize: 17, fontWeight: 'bold' },
  detail: { flex: 1, padding: 22, justifyContent: 'center' },
  bigEmoji: { fontSize: 100, textAlign: 'center', marginBottom: 20 },
  detailTitle: {
    fontSize: 25, fontWeight: '900', color: '#512080',
    textAlign: 'center', marginBottom: 10,
  },
  description: {
    fontSize: 16, color: '#654D70', textAlign: 'center', marginTop: 20,
  },
  action: {
    backgroundColor: '#512080', padding: 17,
    borderRadius: 14, marginTop: 25,
  },
  actionText: { color: 'white', textAlign: 'center', fontWeight: 'bold', fontSize: 17 },
  note: { color: '#888', textAlign: 'center', marginTop: 20 },
});
