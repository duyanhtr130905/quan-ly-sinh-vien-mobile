import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet } from 'react-native';

import { ApiClientError } from '@/api/api-client';
import { importClasses, type ClassImportResult } from '@/api/classes';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

const formats = new Set(['csv', 'xlsx', 'json', 'xml']);
function errorMessage(error: unknown) { return error instanceof ApiClientError ? `${error.code ? `${error.code}: ` : ''}${error.message}` : 'Không thể nhập lớp.'; }

export default function ClassImportScreen() {
  const router = useRouter(); const client = useQueryClient(); const [file, setFile] = useState<{ uri: string; name: string; size: number | null } | null>(null); const [result, setResult] = useState<ClassImportResult | null>(null);
  const mutation = useMutation({ mutationFn: () => importClasses(file!.uri, file!.name), onSuccess: async (response) => { setResult(response.data); await client.invalidateQueries({ queryKey: ['classes'] }); } });
  const pick = async () => { const picked = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: false, copyToCacheDirectory: true }); if (picked.canceled) return; const asset = picked.assets[0]; const extension = asset.name.split('.').pop()?.toLowerCase() ?? ''; if (!formats.has(extension)) { Alert.alert('File không hợp lệ', 'Chỉ hỗ trợ CSV, XLSX, JSON hoặc XML.'); return; } if ((asset.size ?? 0) > 10 * 1024 * 1024) { Alert.alert('File quá lớn', 'File không được vượt quá 10 MB.'); return; } setFile({ uri: asset.uri, name: asset.name, size: asset.size ?? null }); setResult(null); };
  const confirm = () => Alert.alert('Nhập lớp?', 'Dữ liệu sẽ được ghi ngay. Các dòng lỗi không làm mất những dòng đã tạo thành công.', [{ text: 'Hủy', style: 'cancel' }, { text: 'Nhập lớp', onPress: () => mutation.mutate() }]);
  return <ThemedView style={s.container}><ScrollView contentContainerStyle={s.content}><ThemedView type="backgroundElement" style={s.card}><ThemedText type="subtitle">Nhập lớp</ThemedText><ThemedText type="small" themeColor="textSecondary">Schema yêu cầu: code, name, description. File được xử lý và ghi dữ liệu ngay khi xác nhận.</ThemedText><Pressable onPress={() => void pick()} style={s.primary}><ThemedText type="smallBold" style={s.white}>Chọn file CSV/XLSX/JSON/XML</ThemedText></Pressable>{file ? <ThemedText type="small">{file.name}{file.size !== null ? ` · ${Math.ceil(file.size / 1024)} KB` : ''}</ThemedText> : null}<Pressable disabled={!file || mutation.isPending} onPress={confirm} style={[s.secondary, (!file || mutation.isPending) && s.disabled]}><ThemedText type="smallBold">{mutation.isPending ? 'Đang nhập...' : 'Nhập lớp'}</ThemedText></Pressable>{mutation.isError ? <ThemedText type="small" style={s.error}>{errorMessage(mutation.error)}</ThemedText> : null}</ThemedView>{result ? <ThemedView type="backgroundElement" style={s.card}><ThemedText type="smallBold">Kết quả nhập: {result.created.length} thành công · {result.failed.length} lỗi</ThemedText><ThemedText type="small" themeColor="textSecondary">Các dòng thành công đã được tạo; các dòng lỗi không được tự hoàn tác.</ThemedText>{result.failed.map((failure) => <ThemedText key={`${failure.row}-${failure.reason}`} type="small" style={s.error}>Dòng {failure.row}: {failure.reason}</ThemedText>)}<Pressable onPress={() => router.replace('/classes')} style={s.primary}><ThemedText type="smallBold" style={s.white}>Về danh sách lớp</ThemedText></Pressable></ThemedView> : null}</ScrollView></ThemedView>;
}
const s = StyleSheet.create({ container: { flex: 1 }, content: { gap: Spacing.three, padding: Spacing.four }, card: { gap: Spacing.two, padding: Spacing.three, borderRadius: Spacing.two }, primary: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#0A7EA4', borderRadius: Spacing.two, padding: Spacing.three }, secondary: { alignSelf: 'flex-start', borderColor: '#0A7EA4', borderRadius: Spacing.two, borderWidth: 1, padding: Spacing.three }, white: { color: '#FFF' }, disabled: { opacity: .45 }, error: { color: '#B42318' } });
