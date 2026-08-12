import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { ApiClientError } from '@/api/api-client';
import { createHobby } from '@/api/catalogs';
import { commitStudentImport, getStudentImportTemplate, previewStudentImport, type StudentFileFormat, type StudentImportPreview, type StudentImportRow, type StudentImportValues, validateStudentImport } from '@/api/students';
import { FileFormatChooser } from '@/components/file-format-chooser';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppButton, AppTextInput, Card, ErrorMessage, FormField, StatusBadge } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { shareBinaryFile } from '@/utils/file-sharing';

const SUPPORTED_FORMATS = new Set(['csv', 'xlsx', 'json', 'xml']);

function apiMessage(error: unknown, fallback: string) {
  return error instanceof ApiClientError
    ? `${error.code ? `${error.code}: ` : ''}${error.message}`
    : fallback;
}

function importFingerprint(rows: StudentImportRow[]) {
  return JSON.stringify(rows.map(({ draftKey, values }) => ({ draftKey, values })));
}

export default function StudentImportScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [format, setFormat] = useState<StudentFileFormat>('xlsx');
  const [file, setFile] = useState<{ uri: string; name: string; size: number | null } | null>(null);
  const [preview, setPreview] = useState<StudentImportPreview | null>(null);
  const [drafts, setDrafts] = useState<StudentImportRow[]>([]);
  const [validatedFingerprint, setValidatedFingerprint] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const templateMutation = useMutation({
    mutationFn: async () => shareBinaryFile(await getStudentImportTemplate(format)),
  });
  const previewMutation = useMutation({
    mutationFn: () => previewStudentImport(file!.uri, file!.name),
    onSuccess: (response) => {
      setPreview(response.data);
      setDrafts(response.data.rows);
      setValidatedFingerprint(null);
    },
  });
  const validateMutation = useMutation({
    mutationFn: (items: StudentImportRow[]) => validateStudentImport(items),
    onSuccess: (response) => {
      setPreview(response.data);
      setDrafts(response.data.rows);
      setValidatedFingerprint(importFingerprint(response.data.rows));
    },
  });
  const hobbyMutation = useMutation({
    mutationFn: createHobby,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['active-hobbies'] });
      validateMutation.mutate(drafts);
    },
  });
  const commitMutation = useMutation({
    mutationFn: () => commitStudentImport(drafts),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ['students'] });
      await queryClient.invalidateQueries({ queryKey: ['classes'] });
      await queryClient.invalidateQueries({ queryKey: ['class'] });
      await queryClient.invalidateQueries({ queryKey: ['class-members'] });
      await queryClient.invalidateQueries({ queryKey: ['class-available'] });
      Alert.alert('Nhập thành công', `Đã tạo ${response.data.created.length}, cập nhật ${response.data.updated.length} sinh viên.`);
      router.replace('/');
    },
  });
  const currentFingerprint = importFingerprint(drafts);
  const hasCurrentValidation = validatedFingerprint === currentFingerprint;
  const invalidCount = drafts.filter((row) => row.status !== 'valid').length;
  const missingHobbies = useMemo(() => [...new Set(drafts.flatMap((row) => row.missingHobbies))], [drafts]);
  const editingRow = editing ? drafts.find((item) => item.draftKey === editing) : undefined;
  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: false, copyToCacheDirectory: true });
    if (result.canceled) return;

    const asset = result.assets[0];
    const extension = asset.name.split('.').pop()?.toLowerCase() ?? '';
    if (!SUPPORTED_FORMATS.has(extension)) {
      Alert.alert('File không hợp lệ', 'Chỉ hỗ trợ CSV, XLSX, JSON hoặc XML.');
      return;
    }
    if ((asset.size ?? 0) > 10 * 1024 * 1024) {
      Alert.alert('File quá lớn', 'File nhập không được vượt quá 10 MB.');
      return;
    }
    setFile({ uri: asset.uri, name: asset.name, size: asset.size ?? null });
    setPreview(null);
    setDrafts([]);
    setValidatedFingerprint(null);
  };
  const updateRow = (draftKey: string, values: StudentImportValues) => {
    setDrafts((current) => current.map((row) => row.draftKey === draftKey ? { ...row, values } : row));
    setValidatedFingerprint(null);
  };
  const confirmCommit = () => {
    Alert.alert('Nhập dữ liệu?', `Sẽ xử lý ${drafts.length} dòng hợp lệ.`, [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xác nhận', onPress: () => commitMutation.mutate() },
    ]);
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card>
          <ThemedText type="subtitle">Nhập sinh viên</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">Quy trình: chọn tệp → xem trước → sửa/kiểm tra → nhập.</ThemedText>
          <ThemedText type="smallBold">Mẫu nhập</ThemedText>
          <FileFormatChooser value={format} onChange={setFormat} />
          <AppButton disabled={templateMutation.isPending} label={templateMutation.isPending ? 'Đang chuẩn bị...' : 'Tải/chia sẻ mẫu'} variant="secondary" onPress={() => templateMutation.mutate()} />
          {templateMutation.isError ? <ErrorMessage>{apiMessage(templateMutation.error, 'Không thể lấy mẫu.')}</ErrorMessage> : null}
        </Card>
        <Card>
          <ThemedText type="smallBold">File nhập</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">Hỗ trợ CSV, XLSX, JSON và XML; tệp tối đa 10 MB.</ThemedText>
          <AppButton label="Chọn file CSV/XLSX/JSON/XML" onPress={() => void pickFile()} />
          {file ? <ThemedText type="small">Đã chọn: {file.name}{file.size !== null ? ` · ${Math.ceil(file.size / 1024)} KB` : ''}</ThemedText> : null}
          <AppButton disabled={!file || previewMutation.isPending} label={previewMutation.isPending ? 'Đang xem trước...' : 'Xem trước file'} variant="secondary" onPress={() => previewMutation.mutate()} />
          {previewMutation.isError ? <ErrorMessage>{apiMessage(previewMutation.error, 'Không thể đọc file nhập.')}</ErrorMessage> : null}
        </Card>
        {preview ? (
          <>
            <Card>
              <ThemedText type="smallBold">{hasCurrentValidation ? 'Kết quả kiểm tra' : 'Bản xem trước'}: {drafts.length - invalidCount} hợp lệ · {invalidCount} cần sửa</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">Các lỗi bên dưới đến từ backend và phải được sửa hoặc kiểm tra lại trước khi nhập.</ThemedText>
              {!hasCurrentValidation ? <ErrorMessage>Bản nháp hiện tại chưa được kiểm tra hoặc đã thay đổi; hãy kiểm tra lại trước khi nhập.</ErrorMessage> : null}
              {missingHobbies.length ? (
                <>
                  <ErrorMessage>Sở thích chưa có: {missingHobbies.join('; ')}</ErrorMessage>
                  <View style={styles.actions}>
                    {missingHobbies.map((name) => <AppButton key={name} disabled={hobbyMutation.isPending} label={hobbyMutation.isPending ? 'Đang tạo sở thích...' : `Tạo “${name}”`} variant="secondary" onPress={() => hobbyMutation.mutate(name)} />)}
                  </View>
                </>
              ) : null}
              {hobbyMutation.isError ? <ErrorMessage>{apiMessage(hobbyMutation.error, 'Không thể tạo sở thích.')}</ErrorMessage> : null}
            </Card>
            {drafts.map((row) => <ImportCard key={row.draftKey} current={hasCurrentValidation} row={row} onEdit={() => setEditing(row.draftKey)} />)}
            {validateMutation.isError ? <ErrorMessage>{apiMessage(validateMutation.error, 'Không thể kiểm tra dữ liệu.')}</ErrorMessage> : null}
            {commitMutation.isError ? <ErrorMessage>{apiMessage(commitMutation.error, 'Không thể nhập dữ liệu.')}</ErrorMessage> : null}
            <View style={styles.actions}>
              <AppButton disabled={validateMutation.isPending || commitMutation.isPending || hobbyMutation.isPending} label={validateMutation.isPending ? 'Đang kiểm tra...' : 'Kiểm tra bản nháp'} variant="secondary" onPress={() => validateMutation.mutate(drafts)} />
              <AppButton disabled={!hasCurrentValidation || invalidCount > 0 || !drafts.length || commitMutation.isPending || validateMutation.isPending || hobbyMutation.isPending} label={commitMutation.isPending ? 'Đang nhập...' : 'Nhập dữ liệu'} onPress={confirmCommit} />
            </View>
          </>
        ) : null}
      </ScrollView>
      {editingRow ? <ImportEditor row={editingRow} onClose={() => setEditing(null)} onSave={(values) => { updateRow(editingRow.draftKey, values); setEditing(null); }} /> : null}
    </ThemedView>
  );
}

function ImportCard({ row, current, onEdit }: { row: StudentImportRow; current: boolean; onEdit: () => void }) {
  const errors = { ...row.errors, ...row.fieldErrors };
  return (
    <Card>
      <View style={styles.cardHeader}>
        <ThemedText type="smallBold">Dòng {row.rowNumber} · {row.mode === 'update' ? 'Cập nhật' : 'Tạo mới'}</ThemedText>
        <StatusBadge status={current ? row.status : 'pending'} />
      </View>
      <ThemedText type="small">{row.values.code} · {row.values.fullname}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">{row.values.email} · {row.values.username} · Lớp: {row.values.class || '—'}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">Sở thích: {row.values.hobbies.join('; ') || '—'}</ThemedText>
      {Object.entries(errors).map(([field, value]) => <ErrorMessage key={field}>{field}: {value}</ErrorMessage>)}
      <AppButton label="Sửa dòng" variant="secondary" onPress={onEdit} />
    </Card>
  );
}

function ImportEditor({ row, onClose, onSave }: { row: StudentImportRow; onClose: () => void; onSave: (values: StudentImportValues) => void }) {
  const [values, setValues] = useState(row.values);
  const input = (label: string, key: Exclude<keyof StudentImportValues, 'gender' | 'hobbies'>, options?: { multiline?: boolean; secure?: boolean }) => (
    <FormField label={label}>
      <AppTextInput
        accessibilityLabel={label}
        multiline={options?.multiline}
        secureTextEntry={options?.secure}
        value={values[key] ?? ''}
        onChangeText={(value) => setValues((current) => ({ ...current, [key]: value }))}
        style={options?.multiline && styles.multiline}
      />
    </FormField>
  );

  return (
    <ThemedView style={styles.editor}>
      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: 'height' })} style={styles.container}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Card>
            <ThemedText type="subtitle">Sửa dòng {row.rowNumber}</ThemedText>
            {input('Mã sinh viên', 'code')}
            {input('Họ tên', 'fullname')}
            {input('Ngày sinh (DD/MM/YYYY)', 'dob')}
            {input('Lớp (mã lớp)', 'class')}
            {input('Email', 'email')}
            {input('Username', 'username')}
            {input('Mật khẩu (để trống khi cập nhật)', 'password', { secure: true })}
            {input('Quê quán', 'homecity')}
            {input('Địa chỉ', 'address')}
            <FormField label="Sở thích (ngăn cách bằng ;)" >
              <AppTextInput accessibilityLabel="Sở thích" value={values.hobbies.join('; ')} onChangeText={(value) => setValues((current) => ({ ...current, hobbies: value.split(';').map((item) => item.trim()).filter(Boolean) }))} />
            </FormField>
            {input('Mô tả', 'description', { multiline: true })}
            {input('Màu tóc', 'hair_color')}
            {input('Facebook', 'facebook')}
            <FormField label="Giới tính">
              <View style={styles.actions}>
                <AppButton label="Nam" variant={values.gender === true ? 'primary' : 'secondary'} onPress={() => setValues((current) => ({ ...current, gender: true }))} />
                <AppButton label="Nữ" variant={values.gender === false ? 'primary' : 'secondary'} onPress={() => setValues((current) => ({ ...current, gender: false }))} />
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
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  cardHeader: { gap: Spacing.two },
  multiline: { minHeight: 112, textAlignVertical: 'top' },
  editor: { ...StyleSheet.absoluteFill, zIndex: 2 },
});
