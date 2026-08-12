import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { ApiClientError } from '@/api/api-client';
import { createClass, type ClassDetail, type ClassFormValues, updateClass } from '@/api/classes';
import { ThemedView } from '@/components/themed-view';
import { StickyActionBar } from '@/components/sticky-action-bar';
import { AppButton, AppTextInput, Card, ErrorMessage, FormField, SectionTitle } from '@/components/ui';
import { Spacing } from '@/constants/theme';

export function ClassForm({ mode, studentClass }: { mode: 'create' | 'edit'; studentClass?: ClassDetail }) {
  const create = mode === 'create';
  const router = useRouter();
  const client = useQueryClient();
  const [values, setValues] = useState<ClassFormValues>(() => studentClass
    ? { code: studentClass.code, name: studentClass.name, description: studentClass.description ?? '' }
    : { code: '', name: '', description: '' });
  const invalid = !values.name.trim() || (create && !values.code.trim()) || values.code.trim().length > 50 || values.name.trim().length > 255;
  const mutation = useMutation({
    mutationFn: () => create ? createClass(values) : updateClass(studentClass!.id, values),
    onSuccess: async (response) => {
      const id = response.data.id;
      await client.invalidateQueries({ queryKey: ['classes'] });
      await client.invalidateQueries({ queryKey: ['student-classes'] });
      await client.invalidateQueries({ queryKey: ['class', id] });
      router.replace({ pathname: '/classes/[id]', params: { id } } as never);
    },
  });
  const error = mutation.error instanceof ApiClientError
    ? `${mutation.error.code ? `${mutation.error.code}: ` : ''}${mutation.error.message}`
    : mutation.error instanceof Error ? mutation.error.message : null;

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', default: undefined })} style={styles.container}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Card>
            <SectionTitle>Thông tin lớp</SectionTitle>
            <FormField label="Mã lớp" required>
              <AppTextInput
                accessibilityLabel="Mã lớp"
                autoCapitalize="characters"
                editable={create}
                value={values.code}
                onChangeText={(code) => setValues((current) => ({ ...current, code }))}
                style={!create && styles.readOnly}
              />
            </FormField>
            <FormField label="Tên lớp" required>
              <AppTextInput accessibilityLabel="Tên lớp" value={values.name} onChangeText={(name) => setValues((current) => ({ ...current, name }))} />
            </FormField>
            <FormField label="Mô tả">
              <AppTextInput accessibilityLabel="Mô tả lớp" multiline value={values.description} onChangeText={(description) => setValues((current) => ({ ...current, description }))} style={styles.multiline} />
            </FormField>
          </Card>
          {invalid ? <ErrorMessage>Mã lớp (tối đa 50) và tên lớp (tối đa 255) là bắt buộc.</ErrorMessage> : null}
          {error ? <ErrorMessage>{error}</ErrorMessage> : null}
        </ScrollView>
        <StickyActionBar>
          <AppButton label="Hủy" variant="secondary" onPress={() => router.back()} />
          <AppButton disabled={invalid || mutation.isPending} label={mutation.isPending ? 'Đang lưu...' : create ? 'Tạo lớp' : 'Lưu thay đổi'} style={styles.save} onPress={() => mutation.mutate()} />
        </StickyActionBar>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { gap: Spacing.three, padding: Spacing.four, paddingBottom: Spacing.five },
  multiline: { minHeight: 112, textAlignVertical: 'top' },
  readOnly: { opacity: 0.58 },
  save: { flex: 1 },
});
