import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ApiClientError } from '@/api/api-client';
import { createHobby } from '@/api/catalogs';
import { commitStudentImport, getStudentImportTemplate, previewStudentImport, type StudentFileFormat, type StudentImportPreview, type StudentImportRow, type StudentImportValues, validateStudentImport } from '@/api/students';
import { FileFormatChooser } from '@/components/file-format-chooser';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { shareBinaryFile } from '@/utils/file-sharing';

const supported = new Set(['csv', 'xlsx', 'json', 'xml']);
function errorMessage(error: unknown, fallback: string) { return error instanceof ApiClientError ? `${error.code ? `${error.code}: ` : ''}${error.message}` : fallback; }

export default function StudentImportScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const [format, setFormat] = useState<StudentFileFormat>('xlsx');
  const [file, setFile] = useState<{ uri: string; name: string; size: number | null } | null>(null);
  const [preview, setPreview] = useState<StudentImportPreview | null>(null);
  const [drafts, setDrafts] = useState<StudentImportRow[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const templateMutation = useMutation({ mutationFn: async () => shareBinaryFile(await getStudentImportTemplate(format)) });
  const previewMutation = useMutation({ mutationFn: () => previewStudentImport(file!.uri, file!.name), onSuccess: (response) => { setPreview(response.data); setDrafts(response.data.rows); } });
  const validateMutation = useMutation({ mutationFn: (items: StudentImportRow[]) => validateStudentImport(items), onSuccess: (response) => { setPreview(response.data); setDrafts(response.data.rows); } });
  const hobbyMutation = useMutation({ mutationFn: createHobby, onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['active-hobbies'] }); validateMutation.mutate(drafts); } });
  const commitMutation = useMutation({ mutationFn: () => commitStudentImport(drafts), onSuccess: async (response) => { await queryClient.invalidateQueries({ queryKey: ['students'] }); Alert.alert('Nhập thành công', `Đã tạo ${response.data.created.length}, cập nhật ${response.data.updated.length} sinh viên.`); router.replace('/'); } });
  const invalidCount = drafts.filter((row) => row.status !== 'valid').length;
  const missingHobbies = useMemo(() => [...new Set(drafts.flatMap((row) => row.missingHobbies))], [drafts]);
  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: false, copyToCacheDirectory: true });
    if (result.canceled) return;
    const asset = result.assets[0]; const extension = asset.name.split('.').pop()?.toLowerCase() ?? '';
    if (!supported.has(extension)) { Alert.alert('File không hợp lệ', 'Chỉ hỗ trợ CSV, XLSX, JSON hoặc XML.'); return; }
    if ((asset.size ?? 0) > 10 * 1024 * 1024) { Alert.alert('File quá lớn', 'File nhập không được vượt quá 10 MB.'); return; }
    setFile({ uri: asset.uri, name: asset.name, size: asset.size ?? null }); setPreview(null); setDrafts([]);
  };
  const updateRow = (draftKey: string, values: StudentImportValues) => { setDrafts((current) => current.map((row) => row.draftKey === draftKey ? { ...row, values } : row)); };
  const confirmCommit = () => Alert.alert('Nhập dữ liệu?', `Sẽ xử lý ${drafts.length} dòng hợp lệ.`, [{ text: 'Hủy', style: 'cancel' }, { text: 'Xác nhận', onPress: () => commitMutation.mutate() }]);
  return <ThemedView style={styles.container}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <ThemedView type="backgroundElement" style={styles.card}><ThemedText type="subtitle">Nhập sinh viên</ThemedText><ThemedText type="small" themeColor="textSecondary">Chọn file → xem trước → sửa/kiểm tra → nhập.</ThemedText><ThemedText type="smallBold">Mẫu nhập</ThemedText><FileFormatChooser value={format} onChange={setFormat} /><Pressable disabled={templateMutation.isPending} onPress={() => templateMutation.mutate()} style={styles.secondary}><ThemedText type="smallBold">{templateMutation.isPending ? 'Đang chuẩn bị...' : 'Tải/chia sẻ mẫu'}</ThemedText></Pressable>{templateMutation.isError ? <ThemedText type="small" style={styles.error}>{errorMessage(templateMutation.error, 'Không thể lấy mẫu.')}</ThemedText> : null}</ThemedView>
    <ThemedView type="backgroundElement" style={styles.card}><ThemedText type="smallBold">File nhập</ThemedText><Pressable onPress={() => void pickFile()} style={styles.primary}><ThemedText type="smallBold" style={styles.primaryText}>Chọn file CSV/XLSX/JSON/XML</ThemedText></Pressable>{file ? <ThemedText type="small">{file.name}{file.size != null ? ` · ${Math.ceil(file.size / 1024)} KB` : ''}</ThemedText> : null}<Pressable disabled={!file || previewMutation.isPending} onPress={() => previewMutation.mutate()} style={[styles.secondary, (!file || previewMutation.isPending) && styles.disabled]}><ThemedText type="smallBold">{previewMutation.isPending ? 'Đang xem trước...' : 'Xem trước file'}</ThemedText></Pressable>{previewMutation.isError ? <ThemedText type="small" style={styles.error}>{errorMessage(previewMutation.error, 'Không thể đọc file nhập.')}</ThemedText> : null}</ThemedView>
    {preview ? <><ThemedView type="backgroundElement" style={styles.card}><ThemedText type="smallBold">Kết quả: {drafts.length - invalidCount} hợp lệ · {invalidCount} cần sửa</ThemedText>{missingHobbies.length ? <><ThemedText type="small" style={styles.error}>Sở thích chưa có: {missingHobbies.join('; ')}</ThemedText><View style={styles.actions}>{missingHobbies.map((name) => <Pressable key={name} disabled={hobbyMutation.isPending} onPress={() => hobbyMutation.mutate(name)} style={styles.secondary}><ThemedText type="smallBold">Tạo “{name}”</ThemedText></Pressable>)}</View></> : null}{hobbyMutation.isError ? <ThemedText type="small" style={styles.error}>{errorMessage(hobbyMutation.error, 'Không thể tạo sở thích.')}</ThemedText> : null}</ThemedView>{drafts.map((row) => <ImportCard key={row.draftKey} row={row} onEdit={() => setEditing(row.draftKey)} />)}<Pressable disabled={validateMutation.isPending} onPress={() => validateMutation.mutate(drafts)} style={[styles.secondary, validateMutation.isPending && styles.disabled]}><ThemedText type="smallBold">{validateMutation.isPending ? 'Đang kiểm tra...' : 'Kiểm tra lại'}</ThemedText></Pressable>{validateMutation.isError ? <ThemedText type="small" style={styles.error}>{errorMessage(validateMutation.error, 'Không thể kiểm tra dữ liệu.')}</ThemedText> : null}<Pressable disabled={invalidCount > 0 || !drafts.length || commitMutation.isPending} onPress={confirmCommit} style={[styles.primary, (invalidCount > 0 || !drafts.length || commitMutation.isPending) && styles.disabled]}><ThemedText type="smallBold" style={styles.primaryText}>{commitMutation.isPending ? 'Đang nhập...' : 'Nhập dữ liệu'}</ThemedText></Pressable>{commitMutation.isError ? <ThemedText type="small" style={styles.error}>{errorMessage(commitMutation.error, 'Không thể nhập dữ liệu.')}</ThemedText> : null}</> : null}
  </ScrollView>{editing ? <ImportEditor row={drafts.find((item) => item.draftKey === editing)!} color={theme.text} onClose={() => setEditing(null)} onSave={(values) => { updateRow(editing, values); setEditing(null); }} /> : null}</ThemedView>;
}

function ImportCard({ row, onEdit }: { row: StudentImportRow; onEdit: () => void }) { return <ThemedView type="backgroundElement" style={styles.card}><ThemedText type="smallBold">Dòng {row.rowNumber} · {row.mode === 'update' ? 'Cập nhật' : 'Tạo mới'} · {row.status === 'valid' ? 'Hợp lệ' : 'Cần sửa'}</ThemedText><ThemedText type="small">{row.values.code} · {row.values.fullname}</ThemedText><ThemedText type="small" themeColor="textSecondary">{row.values.email} · {row.values.username} · Lớp: {row.values.class || '—'}</ThemedText><ThemedText type="small" themeColor="textSecondary">Sở thích: {row.values.hobbies.join('; ') || '—'}</ThemedText>{Object.entries(row.errors).map(([field, value]) => <ThemedText key={field} type="small" style={styles.error}>{field}: {value}</ThemedText>)}<Pressable onPress={onEdit} style={styles.secondary}><ThemedText type="smallBold">Sửa dòng</ThemedText></Pressable></ThemedView>; }

function ImportEditor({ row, color, onClose, onSave }: { row: StudentImportRow; color: string; onClose: () => void; onSave: (values: StudentImportValues) => void }) {
  const [values, setValues] = useState(row.values);
  const input = (label: string, key: Exclude<keyof StudentImportValues, 'gender' | 'hobbies'>, options?: { multiline?: boolean; secure?: boolean }) => <View style={styles.field}><ThemedText type="small">{label}</ThemedText><TextInput value={values[key] ?? ''} onChangeText={(value) => setValues((current) => ({ ...current, [key]: value }))} multiline={options?.multiline} secureTextEntry={options?.secure} style={[styles.input, options?.multiline && styles.multiline, { color }]} /></View>;
  return <ThemedView style={styles.editor}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><ThemedText type="subtitle">Sửa dòng {row.rowNumber}</ThemedText>{input('Mã sinh viên', 'code')}{input('Họ tên', 'fullname')}{input('Ngày sinh (DD/MM/YYYY)', 'dob')}{input('Lớp (mã lớp)', 'class')}{input('Email', 'email')}{input('Username', 'username')}{input('Mật khẩu (để trống khi cập nhật)', 'password', { secure: true })}{input('Quê quán', 'homecity')}{input('Địa chỉ', 'address')}<View style={styles.field}><ThemedText type="small">Sở thích (ngăn cách ;)</ThemedText><TextInput value={values.hobbies.join('; ')} onChangeText={(value) => setValues((current) => ({ ...current, hobbies: value.split(';').map((item) => item.trim()).filter(Boolean) }))} style={[styles.input, { color }]} /></View>{input('Mô tả', 'description', { multiline: true })}{input('Màu tóc', 'hair_color')}{input('Facebook', 'facebook')}<ThemedText type="small">Giới tính</ThemedText><View style={styles.actions}><Pressable onPress={() => setValues({ ...values, gender: true })} style={styles.secondary}><ThemedText type="smallBold">{values.gender === true ? '✓ Nam' : 'Nam'}</ThemedText></Pressable><Pressable onPress={() => setValues({ ...values, gender: false })} style={styles.secondary}><ThemedText type="smallBold">{values.gender === false ? '✓ Nữ' : 'Nữ'}</ThemedText></Pressable></View><Pressable onPress={() => onSave(values)} style={styles.primary}><ThemedText type="smallBold" style={styles.primaryText}>Áp dụng</ThemedText></Pressable><Pressable onPress={onClose} style={styles.secondary}><ThemedText type="smallBold">Hủy</ThemedText></Pressable></ScrollView></ThemedView>;
}

const styles = StyleSheet.create({ container: { flex: 1 }, content: { gap: Spacing.three, padding: Spacing.four }, card: { gap: Spacing.two, padding: Spacing.three, borderRadius: Spacing.two }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }, primary: { alignItems: 'center', backgroundColor: '#0A7EA4', borderRadius: Spacing.two, padding: Spacing.three }, primaryText: { color: '#FFFFFF' }, secondary: { alignSelf: 'flex-start', borderColor: '#0A7EA4', borderRadius: Spacing.two, borderWidth: 1, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two }, disabled: { opacity: 0.45 }, error: { color: '#B42318' }, editor: { ...StyleSheet.absoluteFill, zIndex: 2 }, field: { gap: Spacing.one }, input: { borderColor: '#0A7EA4', borderRadius: Spacing.two, borderWidth: 1, fontSize: 16, minHeight: 44, paddingHorizontal: Spacing.two, paddingVertical: Spacing.two }, multiline: { minHeight: 90, textAlignVertical: 'top' } });
