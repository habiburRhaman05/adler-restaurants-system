import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, SafeAreaView, ScrollView, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';
import { useAuthStore, useUpdateProfile } from '@/features/auth';

export default function EditProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const updateMut = useUpdateProfile();

  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const handleSave = () => {
    updateMut.mutate({ firstName, lastName, phone, address }, {
      onSuccess: () => {
        Alert.alert('Success', 'Profile updated successfully.');
        router.back();
      },
      onError: (e: any) => {
        Alert.alert('Error', e.response?.data?.message || 'Could not update profile.');
      }
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.gray900} />
        </Pressable>
        <Text style={styles.headerTitle}>Edit Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>First Name</Text>
        <TextInput 
          style={styles.input} 
          value={firstName} 
          onChangeText={setFirstName} 
        />

        <Text style={styles.label}>Last Name</Text>
        <TextInput 
          style={styles.input} 
          value={lastName} 
          onChangeText={setLastName} 
        />

        <Text style={styles.label}>Phone Number</Text>
        <TextInput 
          style={styles.input} 
          value={phone} 
          onChangeText={setPhone} 
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>Address</Text>
        <TextInput 
          style={styles.input} 
          value={address} 
          onChangeText={setAddress} 
        />

        <Pressable 
          style={[styles.submitBtn, updateMut.isPending && { opacity: 0.7 }]} 
          onPress={handleSave}
          disabled={updateMut.isPending}
        >
          {updateMut.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Save Changes</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white,paddingTop: 20 },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  backBtn: { marginRight: 16 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.gray900 },
  
  content: { padding: 20 },
  
  label: { fontSize: 14, fontWeight: '700', color: colors.gray700, marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: colors.gray50, borderWidth: 1, borderColor: colors.gray200, borderRadius: 12, padding: 14, fontSize: 16, color: colors.gray900 },
  
  submitBtn: { backgroundColor: colors.blue, padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 40 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
