import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
} from 'react-native';

const categories = ['Biscuits', 'Halwa', 'Cakes', 'Chocolates', 'Desserts'];

const products = [
  { name: 'Chocolate Cake', price: '$15', emoji: '🎂' },
  { name: 'Delicious Halwa', price: '$10', emoji: '🍯' },
  { name: 'Sweet Biscuits', price: '$5', emoji: '🍪' },
  { name: 'Chocolate Treats', price: '$8', emoji: '🍫' },
];

export default function App() {
  return (
    <ScrollView style={styles.container}>
      <StatusBar backgroundColor="#512080" barStyle="light-content" />

      <View style={styles.header}>
        <Text style={styles.logo}>IMSIYA</Text>
        <Text style={styles.tagline}>A world full of sweetness ❤️</Text>
      </View>

      <View style={styles.search}>
        <Text style={styles.searchText}>🔍 Search sweets and cakes...</Text>
      </View>

      <Text style={styles.heading}>Explore Categories</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {categories.map((item) => (
          <View style={styles.category} key={item}>
            <Text style={styles.categoryText}>{item}</Text>
          </View>
        ))}
      </ScrollView>

      <Text style={styles.heading}>Popular Sweets</Text>
      <View style={styles.products}>
        {products.map((item) => (
          <View style={styles.product} key={item.name}>
            <Text style={styles.emoji}>{item.emoji}</Text>
            <Text style={styles.productName}>{item.name}</Text>
            <Text style={styles.price}>{item.price}</Text>
          </View>
        ))}
      </View>

      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>Sell your sweets on IMSIYA!</Text>
        <Text style={styles.bannerText}>
          Open your shop and reach more customers.
        </Text>
      </View>
    </ScrollView>
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
  },
  searchText: { color: '#888' },
  heading: {
    fontSize: 21, fontWeight: 'bold', color: '#512080',
    marginHorizontal: 18, marginTop: 18, marginBottom: 14,
  },
  category: {
    backgroundColor: '#F0E4FA', padding: 15,
    borderRadius: 12, marginLeft: 12,
  },
  categoryText: { color: '#512080', fontWeight: 'bold' },
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
  banner: {
    backgroundColor: '#F5E6D8', margin: 18,
    padding: 20, borderRadius: 16,
  },
  bannerTitle: { color: '#512080', fontSize: 18, fontWeight: 'bold' },
  bannerText: { color: '#654D70', marginTop: 8 },
});
