import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { ApiClientError } from '@/api/api-client';
import { createClass, type ClassFormValues, type ClassRecord, updateClass } from '@/api/classes';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function ClassForm({ mode, studentClass }: { mode: 'create' | 'edit'; studentClass?: ClassRecord }) {
  const create = mode === 'create'; const router = useRouter(); const theme = useTheme(); const client = useQueryClient();
  const [values, setValues] = useState<ClassFormValues>(() => studentClass ? { code: studentClass.code, name: studentClass.name, description: studentClass.description ?? '' } : { code: '', name: '', description: '' });
  const invalid = !values.name.trim() || (create && !values.code.trim()) || values.code.trim().length > 50 || values.name.trim().length > 255;
  const mutation = useMutation({ mutationFn: () => create ? createClass(values) : updateClass(studentClass!.id, values), onSuccess: async (response) => { const id = response.data.id; await client.invalidateQueries({ queryKey: ['classes'] }); await client.invalidateQueries({ queryKey: ['class', id] }); router.replace({ pathname: '/classes/[id]', params: { id } } as never); } });
  const error = mutation.error instanceof ApiClientError ? `${mutation.error.code ? `${mutation.error.code}: ` : ''}${mutation.error.message}` : mutation.error instanceof Error ? mutation.error.message : null;
  return <ThemedView style={styles.container}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><ThemedView type="backgroundElement" style={styles.section}>
    <ThemedText type="smallBold">Thông tin lớp</ThemedText><ThemedText type="small">Mã lớp *</ThemedText><TextInput editable={create} value={values.code} onChangeText={(code) => setValues((v) => ({ ...v, code }))} autoCapitalize="characters" style={[styles.input, { borderColor: theme.backgroundSelected, color: theme.text }, !create && styles.readOnly]} />
    <ThemedText type="small">Tên lớp *</ThemedText><TextInput value={values.name} onChangeText={(name) => setValues((v) => ({ ...v, name }))} style={[styles.input, { borderColor: theme.backgroundSelected, color: theme.text }]} />
    <ThemedText type="small">Mô tả</ThemedText><TextInput value={values.description} onChangeText={(description) => setValues((v) => ({ ...v, description }))} multiline style={[styles.input, styles.multiline, { borderColor: theme.backgroundSelected, color: theme.text }]} />
  </ThemedView>{invalid ? <ThemedText type="small" style={styles.error}>Mã lớp (tối đa 50) và tên lớp (tối đa 255) là bắt buộc.</ThemedText> : null}{error ? <ThemedText type="small" style={styles.error}>{error}</ThemedText> : null}<Pressable disabled={invalid || mutation.isPending} onPress={() => mutation.mutate()} style={[styles.save, (invalid || mutation.isPending) && styles.disabled]}><ThemedText type="smallBold" style={styles.saveText}>{mutation.isPending ? 'Đang lưu...' : create ? 'Tạo lớp' : 'Lưu thay đổi'}</ThemedText></Pressable></ScrollView></ThemedView>;
}
const styles = StyleSheet.create({ container: { flex: 1 }, content: { gap: Spacing.three, padding: Spacing.four }, section: { gap: Spacing.two, padding: Spacing.three, borderRadius: Spacing.two }, input: { borderWidth: 1, borderRadius: Spacing.two, minHeight: 44, paddingHorizontal: Spacing.two, paddingVertical: Spacing.two, fontSize: 16 }, multiline: { minHeight: 96, textAlignVertical: 'top' }, readOnly: { opacity: 0.55 }, save: { alignItems: 'center', backgroundColor: '#0A7EA4', borderRadius: Spacing.two, padding: Spacing.three }, saveText: { color: '#FFFFFF' }, error: { color: '#B42318' }, disabled: { opacity: 0.45 } });
