import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, ScrollView, TextInput, Modal, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../lib/supabase';

const MODES = ['Cash', 'GCash', 'Card'];
const peso = (n) => '₱' + Number(n).toFixed(2);

export default function CashierScreen({ userId, cashierName }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');
  const [cart, setCart] = useState([]);
  const [mode, setMode] = useState('Cash');
  const [received, setReceived] = useState('');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [report, setReport] = useState(null);

  useEffect(() => {
    supabase.from('products').select('id, name, price, category').order('name')
      .then(({ data, error }) => {
        if (error) Alert.alert('Error', error.message);
        setProducts(data || []);
        setLoading(false);
      });
  }, []);

  const categories = useMemo(() => ['All', ...new Set(products.map((p) => p.category))], [products]);
  const shown = category === 'All' ? products : products.filter((p) => p.category === category);
  const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  const count = cart.reduce((sum, i) => sum + i.qty, 0);
  const paid = mode === 'Cash' ? Number(received) || 0 : total;
  const change = paid - total;

  const addProduct = (p) => setCart((c) =>
    c.some((i) => i.id === p.id) ? c.map((i) => (i.id === p.id ? { ...i, qty: i.qty + 1 } : i)) : [...c, { ...p, qty: 1 }]);

  const removeProduct = (id) => setCart((c) =>
    c.map((i) => (i.id === id ? { ...i, qty: i.qty - 1 } : i)).filter((i) => i.qty > 0));

  const checkOut = async () => {
    if (change < 0) return Alert.alert('Insufficient amount', `Still needs ${peso(-change)}.`);
    const { error } = await supabase.from('sales').insert({
      cashier_id: userId,
      total,
      payment_mode: mode,
      amount_paid: paid,
      change,
      items: cart.map(({ id, name, price, qty }) => ({ id, name, price, qty })),
    });
    if (error) return Alert.alert('Checkout failed', error.message);
    Alert.alert('Sale complete', `Change: ${peso(change)}`);
    setCart([]);
    setReceived('');
    setMode('Cash');
    setCheckoutOpen(false);
  };

  const endOfDay = async () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { data, error } = await supabase.from('sales').select('total, payment_mode')
      .eq('cashier_id', userId).gte('created_at', start.toISOString());
    if (error) return Alert.alert('Error', error.message);
    const sum = (rows) => rows.reduce((a, r) => a + Number(r.total), 0);
    setReport({
      count: data.length,
      total: sum(data),
      byMode: MODES.map((m) => [m, sum(data.filter((r) => r.payment_mode === m))]),
    });
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#4f46e5" /></View>;

  return (
    <View style={s.container}>
      <StatusBar style="light" />
      <View style={s.header}>
        <View>
          <Text style={s.brand}>Vendora</Text>
          <Text style={s.cashier}>Cashier: {cashierName}</Text>
        </View>
        <View style={s.row}>
          <TouchableOpacity style={s.headerBtn} onPress={endOfDay}>
            <Text style={s.headerBtnText}>End of Day</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.headerBtn, s.logoutBtn]} onPress={() => supabase.auth.signOut()}>
            <Text style={s.headerBtnText}>Log out</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          {categories.map((c) => (
            <TouchableOpacity key={c} style={[s.chip, category === c && s.chipActive]} onPress={() => setCategory(c)}>
              <Text style={[s.chipText, category === c && s.chipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={shown}
        keyExtractor={(p) => String(p.id)}
        numColumns={2}
        columnWrapperStyle={s.gridRow}
        contentContainerStyle={s.grid}
        ListEmptyComponent={<Text style={s.empty}>No products yet.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={s.card} onPress={() => addProduct(item)}>
            <Text style={s.cardCategory}>{item.category}</Text>
            <Text style={s.cardName}>{item.name}</Text>
            <Text style={s.cardPrice}>{peso(item.price)}</Text>
          </TouchableOpacity>
        )}
      />

      <View style={s.cart}>
        <Text style={s.cartTitle}>Order ({count} item{count === 1 ? '' : 's'})</Text>
        <ScrollView style={s.cartList}>
          {cart.length === 0 && <Text style={s.empty}>Tap a product to add it.</Text>}
          {cart.map((i) => (
            <View key={i.id} style={s.cartItem}>
              <View style={s.flex}>
                <Text style={s.itemName}>{i.name}</Text>
                <Text style={s.itemSub}>{peso(i.price)} × {i.qty}</Text>
              </View>
              <TouchableOpacity style={s.qtyBtn} onPress={() => removeProduct(i.id)}><Text style={s.qtyText}>−</Text></TouchableOpacity>
              <Text style={s.qty}>{i.qty}</Text>
              <TouchableOpacity style={s.qtyBtn} onPress={() => addProduct(i)}><Text style={s.qtyText}>+</Text></TouchableOpacity>
              <Text style={s.lineTotal}>{peso(i.price * i.qty)}</Text>
            </View>
          ))}
        </ScrollView>
        <View style={s.totalRow}>
          <Text style={s.totalLabel}>Total</Text>
          <Text style={s.totalValue}>{peso(total)}</Text>
        </View>
        <TouchableOpacity style={[s.checkoutBtn, !cart.length && s.disabled]} disabled={!cart.length} onPress={() => setCheckoutOpen(true)}>
          <Text style={s.checkoutText}>Check Out</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={checkoutOpen} transparent animationType="slide" onRequestClose={() => setCheckoutOpen(false)}>
        <View style={s.backdrop}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Check Out</Text>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Total</Text>
              <Text style={s.totalValue}>{peso(total)}</Text>
            </View>
            <Text style={s.label}>Mode of Payment</Text>
            <View style={s.row}>
              {MODES.map((m) => (
                <TouchableOpacity key={m} style={[s.mode, mode === m && s.modeActive]} onPress={() => setMode(m)}>
                  <Text style={[s.modeText, mode === m && s.modeTextActive]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {mode === 'Cash' && (
              <>
                <Text style={s.label}>Amount Received</Text>
                <TextInput style={s.input} keyboardType="decimal-pad" placeholder="0.00" value={received} onChangeText={setReceived} />
              </>
            )}
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Change</Text>
              <Text style={[s.totalValue, change < 0 && s.negative]}>{peso(Math.max(change, 0))}</Text>
            </View>
            <TouchableOpacity style={s.checkoutBtn} onPress={checkOut}>
              <Text style={s.checkoutText}>Confirm Payment</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.cancel} onPress={() => setCheckoutOpen(false)}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={!!report} transparent animationType="fade" onRequestClose={() => setReport(null)}>
        <View style={s.backdrop}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>End of Day</Text>
            <Text style={s.itemSub}>{cashierName} · {new Date().toLocaleDateString()}</Text>
            {report && (
              <>
                <View style={s.reportRow}><Text>Transactions</Text><Text style={s.bold}>{report.count}</Text></View>
                {report.byMode.map(([m, v]) => (
                  <View key={m} style={s.reportRow}><Text>{m}</Text><Text style={s.bold}>{peso(v)}</Text></View>
                ))}
                <View style={s.totalRow}>
                  <Text style={s.totalLabel}>Total Sales</Text>
                  <Text style={s.totalValue}>{peso(report.total)}</Text>
                </View>
              </>
            )}
            <TouchableOpacity style={s.checkoutBtn} onPress={() => setReport(null)}>
              <Text style={s.checkoutText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7ff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f7ff' },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: 8 },
  bold: { fontWeight: '700' },
  header: { backgroundColor: '#4f46e5', paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { color: '#fff', fontSize: 22, fontWeight: '800' },
  cashier: { color: '#c7d2fe', fontSize: 13, marginTop: 2 },
  headerBtn: { backgroundColor: '#6366f1', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  logoutBtn: { backgroundColor: '#ef4444' },
  headerBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  chips: { padding: 12, gap: 8 },
  chip: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb' },
  chipActive: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  chipText: { color: '#374151', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  grid: { paddingHorizontal: 12, paddingBottom: 12 },
  gridRow: { gap: 10, marginBottom: 10 },
  card: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#e5e7eb' },
  cardCategory: { fontSize: 11, color: '#6b7280', textTransform: 'uppercase' },
  cardName: { fontSize: 15, fontWeight: '700', color: '#1f2937', marginVertical: 4 },
  cardPrice: { fontSize: 15, fontWeight: '700', color: '#4f46e5' },
  empty: { textAlign: 'center', color: '#9ca3af', padding: 16 },
  cart: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, paddingBottom: 28, elevation: 8, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
  cartTitle: { fontSize: 16, fontWeight: '800', color: '#1f2937', marginBottom: 6 },
  cartList: { maxHeight: 180 },
  cartItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8 },
  itemName: { fontWeight: '600', color: '#1f2937' },
  itemSub: { fontSize: 12, color: '#6b7280' },
  qtyBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#eef2ff', alignItems: 'center', justifyContent: 'center' },
  qtyText: { fontSize: 18, fontWeight: '700', color: '#4f46e5' },
  qty: { width: 20, textAlign: 'center', fontWeight: '700' },
  lineTotal: { width: 72, textAlign: 'right', fontWeight: '700', color: '#1f2937' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 10, marginTop: 8 },
  totalLabel: { fontSize: 16, fontWeight: '700', color: '#374151' },
  totalValue: { fontSize: 20, fontWeight: '800', color: '#1f2937' },
  negative: { color: '#ef4444' },
  checkoutBtn: { backgroundColor: '#4f46e5', borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 12 },
  disabled: { backgroundColor: '#a5b4fc' },
  checkoutText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: '#1f2937', marginBottom: 4 },
  label: { fontSize: 13, fontWeight: '600', color: '#6b7280', marginTop: 14, marginBottom: 6 },
  mode: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center' },
  modeActive: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  modeText: { fontWeight: '700', color: '#374151' },
  modeTextActive: { color: '#fff' },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, fontSize: 16 },
  cancel: { alignItems: 'center', padding: 12 },
  cancelText: { color: '#6b7280', fontWeight: '600' },
  reportRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
});
