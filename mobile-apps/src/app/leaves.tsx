import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, SafeAreaView, ScrollView, ActivityIndicator, TextInput, Alert, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';
import { useMyLeaves, useCreateLeave, useCancelLeave, LeaveRequest, type LeaveType } from '@/features/leaves';
import { format, parseISO } from 'date-fns';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const LEAVE_TYPES: LeaveType[] = ['VACATION', 'SICK', 'PERSONAL', 'OTHER'];

export default function LeavesScreen() {
  const router = useRouter();
  const { data: leaves, isLoading } = useMyLeaves();
  const createMut = useCreateLeave();
  const cancelMut = useCancelLeave();

  const [modalVisible, setModalVisible] = useState(false);
  const [leaveType, setLeaveType] = useState<LeaveType>('VACATION');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  // Mirrors the backend's createLeaveSchema so obvious mistakes never leave
  // the device: valid dates, end >= start, not ending in the past, reason ≥ 10.
  const validate = (): string | null => {
    if (!DATE_RE.test(startDate) || Number.isNaN(Date.parse(startDate))) {
      return 'Start date must be a valid date in YYYY-MM-DD format.';
    }
    if (!DATE_RE.test(endDate) || Number.isNaN(Date.parse(endDate))) {
      return 'End date must be a valid date in YYYY-MM-DD format.';
    }
    if (new Date(endDate) < new Date(startDate)) {
      return 'End date must be on or after the start date.';
    }
    const today = new Date().toISOString().slice(0, 10);
    if (endDate < today) {
      return 'Leave cannot end in the past.';
    }
    if (reason.trim().length < 10) {
      return 'Please give a reason of at least 10 characters.';
    }
    return null;
  };

  const handleSubmit = () => {
    if (createMut.isPending) return;
    const error = validate();
    if (error) {
      Alert.alert('Check your request', error);
      return;
    }
    createMut.mutate({ leaveType, startDate, endDate, reason: reason.trim() }, {
      onSuccess: () => {
        setModalVisible(false);
        setStartDate('');
        setEndDate('');
        setReason('');
      }
    });
  };

  const handleCancel = (id: string) => {
    Alert.alert('Cancel Leave Request', 'Are you sure you want to cancel this leave request?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes, Cancel', style: 'destructive', onPress: () => cancelMut.mutate(id) }
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.gray900} />
        </Pressable>
        <Text style={styles.headerTitle}>Leave Requests</Text>
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => setModalVisible(true)} style={styles.addBtn}>
          <Ionicons name="add" size={24} color={colors.blue} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {isLoading ? (
          <ActivityIndicator size="large" color={colors.blue} style={{ marginTop: 40 }} />
        ) : leaves && leaves.length > 0 ? (
          leaves.map((l: LeaveRequest) => (
            <View key={l.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardType}>{l.leaveType.replace('_', ' ')}</Text>
                <View style={[styles.statusBadge, 
                  l.status === 'APPROVED' ? styles.bgGreen : 
                  l.status === 'REJECTED' || l.status === 'CANCELLED' ? styles.bgRed : styles.bgAmber
                ]}>
                  <Text style={[styles.statusText, 
                    l.status === 'APPROVED' ? styles.textGreen : 
                    l.status === 'REJECTED' || l.status === 'CANCELLED' ? styles.textRed : styles.textAmber
                  ]}>{l.status}</Text>
                </View>
              </View>
              
              <Text style={styles.cardDate}>
                {format(parseISO(l.startDate), 'MMM d, yyyy')} - {format(parseISO(l.endDate), 'MMM d, yyyy')}
              </Text>
              
              {l.reason && (
                <Text style={styles.cardReason}>Note: {l.reason}</Text>
              )}
              {l.adminNote && (
                <View style={styles.adminNoteBox}>
                  <Text style={styles.adminNoteText}>Admin: {l.adminNote}</Text>
                </View>
              )}

              {l.status === 'PENDING' && (
                <Pressable style={styles.cancelBtn} onPress={() => handleCancel(l.id)}>
                  <Text style={styles.cancelBtnText}>Cancel Request</Text>
                </Pressable>
              )}
            </View>
          ))
        ) : (
          <View style={styles.emptyBox}>
            <Ionicons name="airplane-outline" size={48} color={colors.gray300} />
            <Text style={styles.emptyText}>No leave requests found.</Text>
            <Text style={styles.emptySub}>Tap the + icon to request time off.</Text>
          </View>
        )}
      </ScrollView>

      {/* Request Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Request Leave</Text>
            <Pressable onPress={() => setModalVisible(false)} hitSlop={10}>
              <Ionicons name="close" size={28} color={colors.gray500} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.label}>Leave Type</Text>
            <View style={styles.typeRow}>
              {LEAVE_TYPES.map(t => (
                <Pressable
                  key={t}
                  style={[styles.typeBtn, leaveType === t && styles.typeBtnActive]}
                  onPress={() => setLeaveType(t)}
                >
                  <Text style={[styles.typeBtnText, leaveType === t && styles.typeBtnTextActive]}>{t}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Start Date (YYYY-MM-DD)</Text>
            <TextInput 
              style={styles.input} 
              placeholder="e.g. 2024-08-01" 
              value={startDate} 
              onChangeText={setStartDate} 
            />

            <Text style={styles.label}>End Date (YYYY-MM-DD)</Text>
            <TextInput 
              style={styles.input} 
              placeholder="e.g. 2024-08-05" 
              value={endDate} 
              onChangeText={setEndDate} 
            />

            <Text style={styles.label}>Reason (min. 10 characters)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Why do you need this time off?"
              value={reason}
              onChangeText={setReason}
              multiline
            />

            <Pressable 
              style={[styles.submitBtn, createMut.isPending && { opacity: 0.7 }]} 
              onPress={handleSubmit}
              disabled={createMut.isPending}
            >
              {createMut.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Submit Request</Text>}
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.gray50 },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 20,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  backBtn: { marginRight: 16 },
  addBtn: { marginLeft: 16 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.gray900 },
  
  content: { padding: 20 },
  
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.gray200,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardType: { fontSize: 16, fontWeight: '800', color: colors.gray900, textTransform: 'capitalize' },
  cardDate: { fontSize: 15, fontWeight: '600', color: colors.gray700, marginBottom: 8 },
  cardReason: { fontSize: 14, color: colors.gray500, marginBottom: 8 },
  
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: '800' },
  
  bgGreen: { backgroundColor: '#ECFDF5' },
  textGreen: { color: '#059669' },
  bgRed: { backgroundColor: '#FEF2F2' },
  textRed: { color: '#DC2626' },
  bgAmber: { backgroundColor: '#FFFBEB' },
  textAmber: { color: '#D97706' },
  
  adminNoteBox: { backgroundColor: colors.gray50, padding: 12, borderRadius: 12, marginTop: 8 },
  adminNoteText: { fontSize: 13, color: colors.gray700, fontStyle: 'italic' },
  
  cancelBtn: { marginTop: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.redSoft, alignItems: 'center' },
  cancelBtnText: { color: colors.red, fontWeight: '700', fontSize: 14 },
  
  emptyBox: { alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: 18, fontWeight: '800', color: colors.gray900, marginTop: 16 },
  emptySub: { fontSize: 15, color: colors.gray500, marginTop: 8 },
  
  modalSafe: { flex: 1, backgroundColor: colors.white },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: colors.gray900 },
  modalContent: { padding: 20 },
  
  label: { fontSize: 14, fontWeight: '700', color: colors.gray700, marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: colors.gray50, borderWidth: 1, borderColor: colors.gray200, borderRadius: 12, padding: 14, fontSize: 16, color: colors.gray900 },
  textArea: { height: 100, textAlignVertical: 'top' },
  
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.gray50, borderWidth: 1, borderColor: colors.gray200 },
  typeBtnActive: { backgroundColor: colors.blueSoft, borderColor: colors.blue },
  typeBtnText: { fontSize: 14, fontWeight: '700', color: colors.gray500 },
  typeBtnTextActive: { color: colors.blue },
  
  submitBtn: { backgroundColor: colors.blue, padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 30 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
