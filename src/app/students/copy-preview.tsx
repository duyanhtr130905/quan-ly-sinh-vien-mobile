import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ApiClientError } from '@/api/api-client';
import { getActiveHobbies, getStudentClasses } from '@/api/catalogs';
import { commitStudentCopies, previewStudentCopies, type StudentCopyDraft, type StudentCopyValues, type StudentImageFile, validateStudentCopies } from '@/api/students';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const imageTypes = new Set(['image/jpeg', 'image/jpg', 'image/png']);

function message(error: unknown, fallback: string) {
  return error instanceof ApiClientError ? `${error.code ? `${error.code}: ` : ''}${error.message}` : fallback;
}

export default function StudentCopyPreviewScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const { ids = '' } = useLocalSearchParams<{ ids?: string }>();
  const selectedIds = useMemo(() => ids.split(',').filter(Boolean), [ids]);
  const previewQuery = useQuery({ queryKey: ['student-copy-preview', selectedIds], queryFn: () => previewStudentCopies(selectedIds), enabled: selectedIds.length > 0 });
  const [draftOverrides, setDraftOverrides] = useState<StudentCopyDraft[] | null>(null);
  const [rows, setRows] = useState<Record<string, { status: 'valid' | 'invalid'; errors: Record<string, string> }>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [images, setImages] = useState<Record<string, StudentImageFile>>({});
  const classesQuery = useQuery({ queryKey: ['student-classes'], queryFn: getStudentClasses });
  const hobbiesQuery = useQuery({ queryKey: ['active-hobbies'], queryFn: getActiveHobbies });

  const drafts = draftOverrides ?? previewQuery.data?.data.drafts ?? [];

  const validateMutation = useMutation({
    mutationFn: () => validateStudentCopies(drafts),
    onSuccess: (response) => setRows(Object.fromEntries(response.data.rows.map((row) => [row.draftKey, row]))),
  });
  const commitMutation = useMutation({
    mutationFn: () => commitStudentCopies(drafts, images),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ['students'] });
      Alert.alert('Sao chép thành công', `Đã tạo ${response.data.created.length} sinh viên.`);
      router.replace('/');
    },
  });
  const invalid = drafts.length === 0 || Object.keys(rows).length !== drafts.length || Object.values(rows).some((row) => row.status !== 'valid');
  const updateDraft = (key: string, values: StudentCopyValues) => {
    setDraftOverrides((current) => (current ?? drafts).map((draft) => draft.draftKey === key ? { ...draft, values } : draft));
    setRows({});
  };
  const chooseImage = async (draftKey: string) => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (result.canceled) return;
    const asset = result.assets[0];
    const extension = asset.fileName?.split('.').pop()?.toLowerCase() ?? asset.uri.split('.').pop()?.toLowerCase() ?? '';
    const type = asset.mimeType ?? ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' }[extension] ?? '');
    if (!imageTypes.has(type) || (asset.fileSize ?? 0) > 5 * 1024 * 1024) {
      Alert.alert('Ảnh không hợp lệ', 'Chỉ hỗ trợ JPG/JPEG/PNG, tối đa 5 MB.');
      return;
    }
    setImages((current) => ({ ...current, [draftKey]: { uri: asset.uri, name: asset.fileName ?? `attachment.${extension || 'jpg'}`, type, size: asset.fileSize } }));
  };
  const confirmCommit = () => Alert.alert('Lưu các bản sao?', `Tạo ${drafts.length} sinh viên mới.`, [{ text: 'Hủy', style: 'cancel' }, { text: 'Lưu', onPress: () => commitMutation.mutate() }]);

  if (previewQuery.isPending) return <Centered><ActivityIndicator size="large" /></Centered>;
  if (previewQuery.isError) return <Centered><ThemedText type="smallBold">Không thể tạo bản nháp</ThemedText><ThemedText type="small">{message(previewQuery.error, 'Vui lòng thử lại.')}</ThemedText></Centered>;

  const notFound = previewQuery.data?.data.notFoundIds ?? [];
  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="subtitle">Xem trước sao chép</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">Nguồn: {selectedIds.length} · Bản nháp: {drafts.length}</ThemedText>
          {notFound.length ? <ThemedText type="small" style={styles.error}>Không tìm thấy: {notFound.join(', ')}</ThemedText> : null}
        </ThemedView>
        {drafts.map((draft) => <CopyCard key={draft.draftKey} draft={draft} status={rows[draft.draftKey]} image={images[draft.draftKey]} onEdit={() => setEditing(draft.draftKey)} onImage={() => void chooseImage(draft.draftKey)} />)}
        {validateMutation.isError ? <ThemedText type="small" style={styles.error}>{message(validateMutation.error, 'Không thể kiểm tra bản nháp.')}</ThemedText> : null}
        {commitMutation.isError ? <ThemedText type="small" style={styles.error}>{message(commitMutation.error, 'Không thể lưu bản sao.')}</ThemedText> : null}
        <Pressable disabled={validateMutation.isPending || !drafts.length} onPress={() => validateMutation.mutate()} style={[styles.secondary, (!drafts.length || validateMutation.isPending) && styles.disabled]}><ThemedText type="smallBold">{validateMutation.isPending ? 'Đang kiểm tra...' : 'Kiểm tra bản nháp'}</ThemedText></Pressable>
        <Pressable disabled={invalid || commitMutation.isPending} onPress={confirmCommit} style={[styles.primary, (invalid || commitMutation.isPending) && styles.disabled]}><ThemedText type="smallBold" style={styles.primaryText}>{commitMutation.isPending ? 'Đang lưu...' : 'Lưu bản sao'}</ThemedText></Pressable>
      </ScrollView>
      {editing ? <DraftEditor draft={drafts.find((item) => item.draftKey === editing)!} classes={classesQuery.data?.data ?? []} hobbies={hobbiesQuery.data?.data ?? []} themeColor={theme.text} onClose={() => setEditing(null)} onSave={(values) => { updateDraft(editing, values); setEditing(null); }} /> : null}
    </ThemedView>
  );
}

function CopyCard({ draft, status, image, onEdit, onImage }: { draft: StudentCopyDraft; status?: { status: string; errors: Record<string, string> }; image?: StudentImageFile; onEdit: () => void; onImage: () => void }) {
  return <ThemedView type="backgroundElement" style={styles.card}><ThemedText type="smallBold">{draft.values.fullname} · {draft.values.code}</ThemedText><ThemedText type="small" themeColor="textSecondary">Nguồn #{draft.sourceId} · {status?.status === 'valid' ? 'Hợp lệ' : status?.status === 'invalid' ? 'Cần sửa' : 'Chưa kiểm tra'}</ThemedText>{Object.entries(status?.errors ?? {}).map(([field, value]) => <ThemedText key={field} type="small" style={styles.error}>{field}: {value}</ThemedText>)}{image ? <Image source={{ uri: image.uri }} style={styles.image} /> : null}<View style={styles.actions}><Pressable onPress={onEdit} style={styles.secondary}><ThemedText type="smallBold">Sửa</ThemedText></Pressable><Pressable onPress={onImage} style={styles.secondary}><ThemedText type="smallBold">Ảnh thay thế</ThemedText></Pressable></View></ThemedView>;
}

function DraftEditor({ draft, classes, hobbies, themeColor, onClose, onSave }: { draft: StudentCopyDraft; classes: { id: string; code: string; name: string }[]; hobbies: { id: string; name: string; bit_value: number }[]; themeColor: string; onClose: () => void; onSave: (values: StudentCopyValues) => void }) {
  const [values, setValues] = useState(draft.values);
  const input = (label: string, key: keyof StudentCopyValues, options?: { numeric?: boolean; multiline?: boolean }) => <View style={styles.field}><ThemedText type="small">{label}</ThemedText><TextInput value={values[key] == null ? '' : String(values[key])} onChangeText={(value) => setValues((current) => ({ ...current, [key]: options?.numeric ? Number(value || 0) : value } as StudentCopyValues))} multiline={options?.multiline} style={[styles.input, options?.multiline && styles.multiline, { color: themeColor }]} /></View>;
  return <ThemedView style={styles.editor}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><ThemedText type="subtitle">Sửa bản nháp</ThemedText>{input('Mã sinh viên', 'code')}{input('Họ tên', 'fullname')}{input('Email', 'email')}{input('Username', 'username')}{input('Ngày sinh (YYYY-MM-DD)', 'dob')}{input('Quê quán', 'homecity')}{input('Địa chỉ', 'address')}{input('Màu tóc (#RRGGBB)', 'hair_color')}{input('Facebook', 'facebook')}{input('Mô tả', 'description', { multiline: true })}<ThemedText type="small">Giới tính</ThemedText><View style={styles.actions}><Pressable onPress={() => setValues({ ...values, sex: true })} style={styles.secondary}><ThemedText type="smallBold">{values.sex === true ? '✓ Nam' : 'Nam'}</ThemedText></Pressable><Pressable onPress={() => setValues({ ...values, sex: false })} style={styles.secondary}><ThemedText type="smallBold">{values.sex === false ? '✓ Nữ' : 'Nữ'}</ThemedText></Pressable></View><ThemedText type="small">Lớp</ThemedText><View style={styles.actions}><Pressable onPress={() => setValues({ ...values, class_id: null })} style={styles.secondary}><ThemedText type="smallBold">Chưa xếp</ThemedText></Pressable>{classes.map((item) => <Pressable key={item.id} onPress={() => setValues({ ...values, class_id: item.id })} style={styles.secondary}><ThemedText type="smallBold">{String(values.class_id) === item.id ? '✓ ' : ''}{item.code}</ThemedText></Pressable>)}</View><ThemedText type="small">Sở thích</ThemedText><View style={styles.actions}>{hobbies.map((item) => { const selected = (Number(values.hobbies) & item.bit_value) !== 0; return <Pressable key={item.id} onPress={() => setValues({ ...values, hobbies: selected ? Number(values.hobbies) & ~item.bit_value : Number(values.hobbies) | item.bit_value })} style={styles.secondary}><ThemedText type="smallBold">{selected ? '✓ ' : ''}{item.name}</ThemedText></Pressable>; })}</View><Pressable onPress={() => onSave(values)} style={styles.primary}><ThemedText type="smallBold" style={styles.primaryText}>Áp dụng</ThemedText></Pressable><Pressable onPress={onClose} style={styles.secondary}><ThemedText type="smallBold">Hủy</ThemedText></Pressable></ScrollView></ThemedView>;
}

function Centered({ children }: { children: React.ReactNode }) { return <ThemedView style={styles.centered}>{children}</ThemedView>; }
const styles = StyleSheet.create({ container: { flex: 1 }, content: { gap: Spacing.three, padding: Spacing.four }, card: { gap: Spacing.two, padding: Spacing.three, borderRadius: Spacing.two }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }, primary: { alignItems: 'center', backgroundColor: '#0A7EA4', borderRadius: Spacing.two, padding: Spacing.three }, primaryText: { color: '#FFFFFF' }, secondary: { alignSelf: 'flex-start', borderColor: '#0A7EA4', borderRadius: Spacing.two, borderWidth: 1, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two }, disabled: { opacity: 0.45 }, error: { color: '#B42318' }, image: { width: 100, height: 100, borderRadius: Spacing.two }, centered: { alignItems: 'center', flex: 1, gap: Spacing.two, justifyContent: 'center', padding: Spacing.four }, editor: { ...StyleSheet.absoluteFill, zIndex: 2 }, field: { gap: Spacing.one }, input: { borderColor: '#0A7EA4', borderRadius: Spacing.two, borderWidth: 1, fontSize: 16, minHeight: 44, paddingHorizontal: Spacing.two, paddingVertical: Spacing.two }, multiline: { minHeight: 90, textAlignVertical: 'top' } });
