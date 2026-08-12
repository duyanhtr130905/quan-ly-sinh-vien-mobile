import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { ApiClientError } from '@/api/api-client';
import { commitClassCopies, previewClassCopies, type ClassCopyDraft, type ClassCopyValues, validateClassCopies } from '@/api/classes';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppButton, AppTextInput, Card, ErrorMessage, FormField, ScreenState, StatusBadge } from '@/components/ui';
import { Spacing } from '@/constants/theme';

function apiMessage(error: unknown, fallback: string) {
  return error instanceof ApiClientError
    ? `${error.code ? `${error.code}: ` : ''}${error.message}`
    : fallback;
}

function fingerprint(drafts: ClassCopyDraft[]) {
  return JSON.stringify(drafts);
}

export default function ClassCopyPreviewScreen() {
  const { ids = '' } = useLocalSearchParams<{ ids?: string }>();
  const router = useRouter();
  const client = useQueryClient();
  const selectedIds = useMemo(() => ids.split(',').filter(Boolean), [ids]);
  const preview = useQuery({
    queryKey: ['class-copy-preview', selectedIds],
    queryFn: () => previewClassCopies(selectedIds),
    enabled: Boolean(selectedIds.length),
  });
  const [overrides, setOverrides] = useState<ClassCopyDraft[] | null>(null);
  const [validation, setValidation] = useState<Record<string, { status: 'valid' | 'invalid'; errors: Record<string, string> }>>({});
  const [validatedFingerprint, setValidatedFingerprint] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const drafts = overrides ?? preview.data?.data.drafts ?? [];
  const currentFingerprint = fingerprint(drafts);
  const validateMutation = useMutation({
    mutationFn: () => validateClassCopies(drafts),
    onSuccess: (response) => {
      setValidation(Object.fromEntries(response.data.rows.map((row) => [row.draftKey, row])));
      setValidatedFingerprint(currentFingerprint);
    },
  });
  const commitMutation = useMutation({
    mutationFn: () => commitClassCopies(drafts),
    onSuccess: async (response) => {
      await client.invalidateQueries({ queryKey: ['classes'] });
      Alert.alert('Sao chép thành công', `Đã tạo ${response.data.created.length} lớp.`);
      router.replace('/classes');
    },
  });
  const hasCurrentValidation = validatedFingerprint === currentFingerprint;
  const validCurrent = hasCurrentValidation
    && drafts.length > 0
    && Object.keys(validation).length === drafts.length
    && Object.values(validation).every((row) => row.status === 'valid');
  const update = (key: string, values: ClassCopyValues) => {
    setOverrides((current) => (current ?? drafts).map((draft) => draft.draftKey === key ? { ...draft, values } : draft));
    setValidatedFingerprint(null);
  };
  const editingDraft = editing ? drafts.find((draft) => draft.draftKey === editing) : undefined;

  if (preview.isPending) {
    return <ThemedView style={styles.center}><ActivityIndicator size="large" /></ThemedView>;
  }

  if (preview.isError) {
    return (
      <ThemedView style={styles.center}>
        <ScreenState title="Không thể tạo bản nháp" detail={apiMessage(preview.error, 'Vui lòng thử lại.')} actionLabel="Thử lại" onAction={() => void preview.refetch()} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card>
          <ThemedText type="subtitle">Xem trước sao chép lớp</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">Nguồn: {selectedIds.length} · Bản nháp: {drafts.length}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">Quy trình: sửa bản nháp → kiểm tra → lưu. Chỉ bản nháp đã kiểm tra hiện tại mới được lưu.</ThemedText>
          {preview.data?.data.notFoundIds.length ? <ErrorMessage>Không tìm thấy: {preview.data.data.notFoundIds.join(', ')}</ErrorMessage> : null}
          {!hasCurrentValidation && drafts.length ? <ErrorMessage>Bản nháp hiện tại chưa được kiểm tra hoặc đã thay đổi. Hãy kiểm tra lại trước khi lưu.</ErrorMessage> : null}
        </Card>
        {drafts.map((draft) => {
          const row = validation[draft.draftKey];
          const status = hasCurrentValidation ? row?.status ?? 'pending' : 'pending';
          return (
            <Card key={draft.draftKey}>
              <View style={styles.cardHeader}>
                <ThemedText type="smallBold">{draft.values.code} · {draft.values.name}</ThemedText>
                <StatusBadge status={status} />
              </View>
              <ThemedText type="small" themeColor="textSecondary">Nguồn #{draft.sourceId}</ThemedText>
              {draft.values.description ? <ThemedText type="small">{draft.values.description}</ThemedText> : null}
              {Object.entries(row?.errors ?? {}).map(([field, value]) => <ErrorMessage key={field}>{field}: {value}</ErrorMessage>)}
              <AppButton label="Sửa bản nháp" variant="secondary" onPress={() => setEditing(draft.draftKey)} />
            </Card>
          );
        })}
        {validateMutation.isError ? <ErrorMessage>{apiMessage(validateMutation.error, 'Không thể kiểm tra bản nháp.')}</ErrorMessage> : null}
        {commitMutation.isError ? <ErrorMessage>{apiMessage(commitMutation.error, 'Không thể lưu bản sao.')}</ErrorMessage> : null}
        <View style={styles.actions}>
          <AppButton disabled={!drafts.length || validateMutation.isPending || commitMutation.isPending} label={validateMutation.isPending ? 'Đang kiểm tra...' : 'Kiểm tra bản nháp'} variant="secondary" onPress={() => validateMutation.mutate()} />
          <AppButton disabled={!validCurrent || commitMutation.isPending || validateMutation.isPending} label={commitMutation.isPending ? 'Đang lưu...' : 'Lưu bản sao'} onPress={() => Alert.alert('Lưu bản sao?', `Tạo ${drafts.length} lớp mới.`, [{ text: 'Hủy', style: 'cancel' }, { text: 'Lưu', onPress: () => commitMutation.mutate() }])} />
        </View>
      </ScrollView>
      {editingDraft ? <Editor draft={editingDraft} onClose={() => setEditing(null)} onSave={(values) => { update(editingDraft.draftKey, values); setEditing(null); }} /> : null}
    </ThemedView>
  );
}

function Editor({ draft, onClose, onSave }: { draft: ClassCopyDraft; onClose: () => void; onSave: (values: ClassCopyValues) => void }) {
  const [values, setValues] = useState(draft.values);
  return (
    <ThemedView style={styles.editor}>
      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: 'height' })} style={styles.container}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Card>
            <ThemedText type="subtitle">Sửa bản nháp</ThemedText>
            <FormField label="Mã lớp" required>
              <AppTextInput accessibilityLabel="Mã lớp" value={values.code} onChangeText={(code) => setValues((current) => ({ ...current, code }))} />
            </FormField>
            <FormField label="Tên lớp" required>
              <AppTextInput accessibilityLabel="Tên lớp" value={values.name} onChangeText={(name) => setValues((current) => ({ ...current, name }))} />
            </FormField>
            <FormField label="Mô tả">
              <AppTextInput accessibilityLabel="Mô tả lớp" multiline value={values.description} onChangeText={(description) => setValues((current) => ({ ...current, description }))} style={styles.multiline} />
            </FormField>
            <View style={styles.actions}>
              <AppButton label="Áp dụng" onPress={() => onSave(values)} />
              <AppButton label="Hủy" variant="secondary" onPress={onClose} />
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { gap: Spacing.three, padding: Spacing.four },
  cardHeader: { gap: Spacing.two },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  multiline: { minHeight: 112, textAlignVertical: 'top' },
  center: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: Spacing.four },
  editor: { ...StyleSheet.absoluteFill, zIndex: 2 },
});
