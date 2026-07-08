import React, { useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginFormValues, useLogin, getLoginErrorMessage } from '@/features/auth';
import { colors } from '@/theme';

export default function LoginScreen() {
  const login = useLogin();
  const passwordRef = useRef<TextInput>(null);

  const errorMessage = useMemo(() => {
    if (!login.isError) return null;
    return getLoginErrorMessage(login.error);
  }, [login.isError, login.error]);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = (values: LoginFormValues) => {
    login.mutate(values);
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* SDK 55 enforces edge-to-edge on Android, where the window no longer
          auto-resizes for the keyboard — so `padding` is needed on BOTH platforms,
          otherwise the password field and login button stay hidden behind it. */}
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.brandRow}>
            <View style={styles.brandIcon}>
              <Ionicons name="calendar" size={26} color={colors.white} />
            </View>
          </View>

          <Text style={styles.welcome}>Welcome back</Text>
          <Text style={styles.subtitle}>Log in to manage your work schedule and track your progress.</Text>

          <View style={styles.form}>
            <Text style={styles.label}>Email</Text>
            <Controller
              control={control}
              name="email"
              render={({ field: { value, onChange, onBlur } }) => (
                <View style={[styles.inputWrap, !!errors.email && styles.inputWrapError]}>
                  <Ionicons name="mail-outline" size={18} color={errors.email ? colors.red : colors.gray400} />
                  <TextInput
                    style={styles.input}
                    placeholder="you@example.com"
                    placeholderTextColor={colors.gray300}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoComplete="email"
                    returnKeyType="next"
                    submitBehavior="submit"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                  />
                </View>
              )}
            />
            {!!errors.email && <Text style={styles.fieldError}>{errors.email.message}</Text>}

            <Text style={styles.label}>Password</Text>
            <Controller
              control={control}
              name="password"
              render={({ field: { value, onChange, onBlur } }) => (
                <View style={[styles.inputWrap, !!errors.password && styles.inputWrapError]}>
                  <Ionicons name="lock-closed-outline" size={18} color={errors.password ? colors.red : colors.gray400} />
                  <TextInput
                    ref={passwordRef}
                    style={styles.input}
                    placeholder="Enter your password"
                    placeholderTextColor={colors.gray300}
                    secureTextEntry
                    autoComplete="password"
                    returnKeyType="done"
                    onSubmitEditing={handleSubmit(onSubmit)}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                  />
                </View>
              )}
            />
            {!!errors.password && <Text style={styles.fieldError}>{errors.password.message}</Text>}

            <Pressable style={styles.forgotBtn}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>

            <Pressable
              style={[styles.loginBtn, login.isPending && styles.loginBtnBusy]}
              onPress={handleSubmit(onSubmit)}
              disabled={login.isPending}
            >
              {login.isPending ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <ActivityIndicator color={colors.white} size="small" />
                  <Text style={styles.loginBtnText}>Signing in...</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.loginBtnText}>Log In</Text>
                  <Ionicons name="arrow-forward" size={18} color={colors.white} />
                </>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Error Modal */}
      <Modal visible={!!errorMessage} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="alert-circle" size={44} color={colors.red} />
            </View>
            <Text style={styles.modalTitle}>Login Failed</Text>
            <Text style={styles.modalMessage}>{errorMessage}</Text>
            <Pressable
              style={styles.modalBtn}
              onPress={() => login.reset()}
            >
              <Text style={styles.modalBtnText}>Try Again</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  scrollContent: { flexGrow: 1, padding: 24, paddingTop: 50, justifyContent: 'center' },

  brandRow: { alignItems: 'center', marginBottom: 22 },
  brandIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.blue,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },

  welcome: { fontSize: 28, fontWeight: '800', color: colors.gray900, textAlign: 'center', letterSpacing: -0.4 },
  subtitle: { fontSize: 13, color: colors.gray500, textAlign: 'center', marginTop: 8, marginBottom: 24, paddingHorizontal: 16, lineHeight: 19 },

  form: { gap: 4 },
  label: { fontSize: 12, fontWeight: '700', color: colors.gray500, marginBottom: 8, marginTop: 12, textTransform: 'uppercase', letterSpacing: 0.3 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.gray50,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
  },
  inputWrapError: {
    borderColor: colors.red,
    backgroundColor: colors.redSoft,
  },
  input: { flex: 1, fontSize: 14, color: colors.gray900, fontWeight: '600' },

  fieldError: { color: colors.red, fontSize: 11, fontWeight: '600', marginTop: 6 },

  forgotBtn: { alignSelf: 'flex-end', marginTop: 14, marginBottom: 22 },
  forgotText: { color: colors.blue, fontSize: 12, fontWeight: '700' },

  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.blue,
    borderRadius: 14,
    paddingVertical: 16,
    shadowColor: colors.blue,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  loginBtnBusy: { backgroundColor: colors.blueDark },
  loginBtnText: { color: colors.white, fontWeight: '800', fontSize: 15 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  modalIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.redSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.gray900, marginBottom: 8 },
  modalMessage: { fontSize: 13, color: colors.gray500, textAlign: 'center', lineHeight: 19, marginBottom: 22 },
  modalBtn: {
    backgroundColor: colors.blue,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 40,
  },
  modalBtnText: { color: colors.white, fontWeight: '700', fontSize: 14 },
});
