import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { Alert, ScrollView, StyleSheet } from 'react-native';

import { ApiClientError } from '@/api/api-client';
import { importClasses, type ClassImportResult } from '@/api/classes';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppButton, Card, ErrorMessage } from '@/components/ui';
import { Spacing } from '@/constants/theme';

const FORMATS = new Set(['csv', 'xlsx', 'json', 'xml']);

function apiMessage(error: unknown) {
  return error instanceof ApiClientError
    ? `${error.code ? `${error.code}: ` : ''}${error.message}`
    : 'Không thể nhập lớp.';
}

export default function ClassImportScreen() {
  const router = useRouter();
  const client = useQueryClient();
  const [file, setFile] = useState<{ uri: string; name: string; size: number | null } | null>(null);
  const [result, setResult] = useState<ClassImportResult | null>(null);
  const mutation = useMutation({
    mutationFn: () => importClasses(file!.uri, file!.name),
    onSuccess: async (response) => {
      setResult(response.data);
      await client.invalidateQueries({ queryKey: ['classes'] });
      await client.invalidateQueries({ queryKey: ['student-classes'] });
    },
  });
  const pick = async () => {
    const picked = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: false, copyToCacheDirectory: true });
    if (picked.canceled) return;

    const asset = picked.assets[0];
    const extension = asset.name.split('.').pop()?.toLowerCase() ?? '';
    if (!FORMATS.has(extension)) {
      Alert.alert('File không hợp lệ', 'Chỉ hỗ trợ CSV, XLSX, JSON hoặc XML.');
      return;
    }
    if ((asset.size ?? 0) > 10 * 1024 * 1024) {
      Alert.alert('File quá lớn', 'File không được vượt quá 10 MB.');
      return;
    }
    setFile({ uri: asset.uri, name: asset.name, size: asset.size ?? null });
    setResult(null);
  };
  const confirm = () => {
    Alert.alert(
      'Nhập lớp?',
      'Dữ liệu sẽ được ghi ngay sau khi xác nhận. Các dòng thành công vẫn được tạo nếu những dòng khác lỗi; không có bước xem trước hoặc hoàn tác.',
      [{ text: 'Hủy', style: 'cancel' }, { text: 'Nhập lớp', onPress: () => mutation.mutate() }],
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <ThemedText type="subtitle">Nhập lớp</ThemedText>
          <ThemedText type="smallBold">Cột bắt buộc</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">code, name, description</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">CSV, XLSX, JSON và XML được hỗ trợ; kích thước tệp tối đa là 10 MB.</ThemedText>
        </Card>
        <Card>
          <ThemedText type="smallBold">Nhập trực tiếp</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">Backend ghi dữ liệu ngay khi bạn xác nhận. Hãy kiểm tra tệp trước khi tiếp tục.</ThemedText>
          <AppButton label="Chọn file CSV/XLSX/JSON/XML" onPress={() => void pick()} />
          {file ? <ThemedText type="small">Đã chọn: {file.name}{file.size !== null ? ` · ${Math.ceil(file.size / 1024)} KB` : ''}</ThemedText> : null}
          <AppButton disabled={!file || mutation.isPending} label={mutation.isPending ? 'Đang nhập...' : 'Xác nhận nhập lớp'} variant="danger" onPress={confirm} />
          {mutation.isError ? <ErrorMessage>{apiMessage(mutation.error)}</ErrorMessage> : null}
        </Card>
        {result ? (
          <Card>
            <ThemedText type="smallBold">Kết quả nhập</ThemedText>
            <ThemedText type="small">Đã tạo: {result.created.length} · Không thành công: {result.failed.length}</ThemedText>
            {result.failed.length ? <ThemedText type="small" themeColor="textSecondary">Các dòng thành công đã được tạo; các dòng lỗi không được tự hoàn tác.</ThemedText> : null}
            {result.failed.map((failure) => <ErrorMessage key={`${failure.row}-${failure.reason}`}>Dòng {failure.row}: {failure.reason}</ErrorMessage>)}
            <AppButton label="Về danh sách lớp" onPress={() => router.replace('/classes')} />
          </Card>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { gap: Spacing.three, padding: Spacing.four },
});
