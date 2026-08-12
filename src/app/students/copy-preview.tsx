import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { ApiClientError } from '@/api/api-client';
import { getActiveHobbies, getStudentClasses } from '@/api/catalogs';
import { commitStudentCopies, previewStudentCopies, type StudentCopyDraft, type StudentCopyValues, type StudentImageFile, validateStudentCopies } from '@/api/students';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppButton, AppTextInput, Card, ErrorMessage, FormField, ScreenState, StatusBadge } from '@/components/ui';
import { Spacing } from '@/constants/theme';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png']);

function apiMessage(error: unknown, fallback: string) {
  return error instanceof ApiClientError
    ? `${error.code ? `${error.code}: ` : ''}${error.message}`
    : fallback;
}

function fingerprint(drafts: StudentCopyDraft[]) {
  return JSON.stringify(drafts);
}

export default function StudentCopyPreviewScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { ids = '' } = useLocalSearchParams<{ ids?: string }>();
  const selectedIds = useMemo(() => ids.split(',').filter(Boolean), [ids]);
  const previewQuery = useQuery({
    queryKey: ['student-copy-preview', selectedIds],
    queryFn: () => previewStudentCopies(selectedIds),
    enabled: selectedIds.length > 0,
  });
  const [draftOverrides, setDraftOverrides] = useState<StudentCopyDraft[] | null>(null);
  const [rows, setRows] = useState<Record<string, { status: 'valid' | 'invalid'; errors: Record<string, string> }>>({});
  const [validatedFingerprint, setValidatedFingerprint] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [images, setImages] = useState<Record<string, StudentImageFile>>({});
  const classesQuery = useQuery({ queryKey: ['student-classes'], queryFn: getStudentClasses });
  const hobbiesQuery = useQuery({ queryKey: ['active-hobbies'], queryFn: getActiveHobbies });
  const drafts = draftOverrides ?? previewQuery.data?.data.drafts ?? [];
  const currentFingerprint = fingerprint(drafts);
  const validateMutation = useMutation({
    mutationFn: () => validateStudentCopies(drafts),
    onSuccess: (response) => {
      setRows(Object.fromEntries(response.data.rows.map((row) => [row.draftKey, row])));
      setValidatedFingerprint(currentFingerprint);
    },
  });
  const commitMutation = useMutation({
    mutationFn: () => commitStudentCopies(drafts, images),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ['students'] });
      Alert.alert('Sao chép thành công', `Đã tạo ${response.data.created.length} sinh viên.`);
      router.replace('/');
    },
  });
  const hasCurrentValidation = validatedFingerprint === currentFingerprint;
  const canCommit = hasCurrentValidation
    && drafts.length > 0
    && Object.keys(rows).length === drafts.length
    && Object.values(rows).every((row) => row.status === 'valid');
  const updateDraft = (key: string, values: StudentCopyValues) => {
    setDraftOverrides((current) => (current ?? drafts).map((draft) => draft.draftKey === key ? { ...draft, values } : draft));
    setValidatedFingerprint(null);
  };
  const chooseImage = async (draftKey: string) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Cần quyền truy cập ảnh', 'Hãy cho phép truy cập thư viện ảnh để thay thế ảnh đính kèm.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (result.canceled) return;

    const asset = result.assets[0];
    const extension = asset.fileName?.split('.').pop()?.toLowerCase() ?? asset.uri.split('.').pop()?.toLowerCase() ?? '';
    const type = asset.mimeType ?? ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' }[extension] ?? '');
    if (!IMAGE_TYPES.has(type) || (asset.fileSize ?? 0) > 5 * 1024 * 1024) {
      Alert.alert('Ảnh không hợp lệ', 'Chỉ hỗ trợ JPG/JPEG/PNG, tối đa 5 MB.');
      return;
    }
    setImages((current) => ({
      ...current,
      [draftKey]: {
        uri: asset.uri,
        name: asset.fileName ?? `attachment.${extension || 'jpg'}`,
        type,
        size: asset.fileSize,
      },
    }));
  };
  const editingDraft = editing ? drafts.find((item) => item.draftKey === editing) : undefined;

  if (previewQuery.isPending) {
    return <ThemedView style={styles.center}><ActivityIndicator size="large" /></ThemedView>;
  }

  if (previewQuery.isError) {
    return (
      <ThemedView style={styles.center}>
        <ScreenState title="Không thể tạo bản nháp" detail={apiMessage(previewQuery.error, 'Vui lòng thử lại.')} actionLabel="Thử lại" onAction={() => void previewQuery.refetch()} />
      </ThemedView>
    );
  }

  const notFound = previewQuery.data?.data.notFoundIds ?? [];
  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card>
          <ThemedText type="subtitle">Xem trước sao chép</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">Nguồn: {selectedIds.length} · Bản nháp: {drafts.length}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">Quy trình: sửa bản nháp → kiểm tra → lưu. Chỉ bản nháp đã kiểm tra hiện tại mới được lưu.</ThemedText>
          {notFound.length ? <ErrorMessage>Không tìm thấy: {notFound.join(', ')}</ErrorMessage> : null}
          {!hasCurrentValidation && drafts.length ? <ErrorMessage>Bản nháp hiện tại chưa được kiểm tra hoặc đã thay đổi. Hãy kiểm tra lại trước khi lưu.</ErrorMessage> : null}
        </Card>
        {drafts.map((draft) => {
          const row = rows[draft.draftKey];
          const status = hasCurrentValidation ? row?.status ?? 'pending' : 'pending';
          return (
            <Card key={draft.draftKey}>
              <View style={styles.cardHeader}>
                <ThemedText type="smallBold">{draft.values.fullname} · {draft.values.code}</ThemedText>
                <StatusBadge status={status} />
              </View>
              <ThemedText type="small" themeColor="textSecondary">Nguồn #{draft.sourceId}</ThemedText>
              {Object.entries(row?.errors ?? {}).map(([field, value]) => <ErrorMessage key={field}>{field}: {value}</ErrorMessage>)}
              {images[draft.draftKey] ? <Image accessible accessibilityLabel={`Ảnh thay thế cho ${draft.values.fullname}`} source={{ uri: images[draft.draftKey].uri }} style={styles.image} /> : null}
              <View style={styles.actions}>
                <AppButton label="Sửa bản nháp" variant="secondary" onPress={() => setEditing(draft.draftKey)} />
                <AppButton label={images[draft.draftKey] ? 'Đổi ảnh thay thế' : 'Chọn ảnh thay thế'} variant="secondary" onPress={() => void chooseImage(draft.draftKey)} />
              </View>
            </Card>
          );
        })}
        {validateMutation.isError ? <ErrorMessage>{apiMessage(validateMutation.error, 'Không thể kiểm tra bản nháp.')}</ErrorMessage> : null}
        {commitMutation.isError ? <ErrorMessage>{apiMessage(commitMutation.error, 'Không thể lưu bản sao.')}</ErrorMessage> : null}
        <View style={styles.actions}>
          <AppButton disabled={!drafts.length || validateMutation.isPending || commitMutation.isPending} label={validateMutation.isPending ? 'Đang kiểm tra...' : 'Kiểm tra bản nháp'} variant="secondary" onPress={() => validateMutation.mutate()} />
          <AppButton disabled={!canCommit || commitMutation.isPending || validateMutation.isPending} label={commitMutation.isPending ? 'Đang lưu...' : 'Lưu bản sao'} onPress={() => Alert.alert('Lưu các bản sao?', `Tạo ${drafts.length} sinh viên mới.`, [{ text: 'Hủy', style: 'cancel' }, { text: 'Lưu', onPress: () => commitMutation.mutate() }])} />
        </View>
      </ScrollView>
      {editingDraft ? (
        <DraftEditor
          classes={classesQuery.data?.data ?? []}
          draft={editingDraft}
          hobbies={hobbiesQuery.data?.data ?? []}
          onClose={() => setEditing(null)}
          onSave={(values) => {
            updateDraft(editingDraft.draftKey, values);
            setEditing(null);
          }}
        />
      ) : null}
    </ThemedView>
  );
}

function DraftEditor({
  draft,
  classes,
  hobbies,
  onClose,
  onSave,
}: {
  draft: StudentCopyDraft;
  classes: { id: string; code: string; name: string }[];
  hobbies: { id: string; name: string; bit_value: number }[];
  onClose: () => void;
  onSave: (values: StudentCopyValues) => void;
}) {
  const [values, setValues] = useState(draft.values);
  const textField = (label: string, key: keyof StudentCopyValues, multiline = false) => (
    <FormField label={label}>
      <AppTextInput
        accessibilityLabel={label}
        multiline={multiline}
        value={values[key] == null ? '' : String(values[key])}
        onChangeText={(value) => setValues((current) => ({ ...current, [key]: value } as StudentCopyValues))}
        style={multiline && styles.multiline}
      />
    </FormField>
  );

  return (
    <ThemedView style={styles.editor}>
      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: 'height' })} style={styles.container}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Card>
            <ThemedText type="subtitle">Sửa bản nháp</ThemedText>
            {textField('Mã sinh viên', 'code')}
            {textField('Họ và tên', 'fullname')}
            {textField('Email', 'email')}
            {textField('Username', 'username')}
            {textField('Ngày sinh (YYYY-MM-DD)', 'dob')}
            {textField('Quê quán', 'homecity')}
            {textField('Địa chỉ', 'address')}
            {textField('Màu tóc (#RRGGBB)', 'hair_color')}
            {textField('Facebook', 'facebook')}
            {textField('Mô tả', 'description', true)}
            <FormField label="Giới tính">
              <View style={styles.actions}>
                <AppButton label="Nam" variant={values.sex === true ? 'primary' : 'secondary'} onPress={() => setValues((current) => ({ ...current, sex: true }))} />
                <AppButton label="Nữ" variant={values.sex === false ? 'primary' : 'secondary'} onPress={() => setValues((current) => ({ ...current, sex: false }))} />
              </View>
            </FormField>
            <FormField label="Lớp">
              <View style={styles.actions}>
                <AppButton label="Chưa xếp lớp" variant={values.class_id === null ? 'primary' : 'secondary'} onPress={() => setValues((current) => ({ ...current, class_id: null }))} />
                {classes.map((item) => <AppButton key={item.id} label={`${item.code} — ${item.name}`} variant={String(values.class_id) === item.id ? 'primary' : 'secondary'} onPress={() => setValues((current) => ({ ...current, class_id: item.id }))} />)}
              </View>
            </FormField>
            <FormField label="Sở thích">
              <View style={styles.actions}>
                {hobbies.map((item) => {
                  const selected = (Number(values.hobbies) & item.bit_value) !== 0;
                  return <AppButton key={item.id} label={item.name} variant={selected ? 'primary' : 'secondary'} onPress={() => setValues((current) => ({ ...current, hobbies: selected ? Number(current.hobbies) & ~item.bit_value : Number(current.hobbies) | item.bit_value }))} />;
                })}
              </View>
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
  image: { height: 100, width: 100, borderRadius: Spacing.two },
  multiline: { minHeight: 112, textAlignVertical: 'top' },
  center: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: Spacing.four },
  editor: { ...StyleSheet.absoluteFill, zIndex: 2 },
});
