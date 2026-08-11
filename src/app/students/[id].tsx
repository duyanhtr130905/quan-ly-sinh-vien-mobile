import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ApiClientError } from '@/api/api-client';
import { getActiveHobbies, getStudentClasses } from '@/api/catalogs';
import { copyStudent, deleteStudent, exportStudent, getStudent, type StudentFileFormat } from '@/api/students';
import { FileFormatChooser } from '@/components/file-format-chooser';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { shareBinaryFile } from '@/utils/file-sharing';

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiClientError) return `${error.code ? `${error.code}: ` : ''}${error.message}`;
  return fallback;
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

export default function StudentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const studentQuery = useQuery({ queryKey: ['student', id], queryFn: () => getStudent(id), enabled: Boolean(id) });
  const classesQuery = useQuery({ queryKey: ['student-classes'], queryFn: getStudentClasses });
  const hobbiesQuery = useQuery({ queryKey: ['active-hobbies'], queryFn: getActiveHobbies });
  const student = studentQuery.data?.data;
  const studentClass = useMemo(() => classesQuery.data?.data.find((item) => item.id === student?.class_id), [classesQuery.data, student?.class_id]);
  const studentHobbies = useMemo(() => {
    const mask = Number(student?.hobbies ?? 0);
    return hobbiesQuery.data?.data.filter((hobby) => (mask & hobby.bit_value) !== 0).map((hobby) => hobby.name) ?? [];
  }, [hobbiesQuery.data, student?.hobbies]);
  const [exportFormat, setExportFormat] = useState<StudentFileFormat>('xlsx');

  const copyMutation = useMutation({
    mutationFn: () => copyStudent(id),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ['students'] });
      Alert.alert('Đã sao chép sinh viên', `Đã tạo ${response.data.code}.`);
      router.replace({ pathname: '/students/[id]', params: { id: response.data.id } });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteStudent(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['students'] });
      await queryClient.invalidateQueries({ queryKey: ['deleted-students'] });
      queryClient.removeQueries({ queryKey: ['student', id] });
      router.replace('/');
    },
  });
  const exportMutation = useMutation({ mutationFn: () => exportStudent(id, exportFormat).then(shareBinaryFile) });

  const confirmDelete = () => {
    Alert.alert('Xóa sinh viên?', 'Sinh viên sẽ được chuyển vào danh sách đã xóa.', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: () => deleteMutation.mutate() },
    ]);
  };

  if (studentQuery.isPending) {
    return <CenteredState><ActivityIndicator size="large" /></CenteredState>;
  }

  if (studentQuery.isError || !student) {
    return (
      <CenteredState>
        <ThemedText type="smallBold">Không tìm thấy sinh viên</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">{studentQuery.isError ? errorMessage(studentQuery.error, 'Không thể tải sinh viên.') : 'Sinh viên không còn tồn tại.'}</ThemedText>
        <Pressable onPress={() => void studentQuery.refetch()}><ThemedText type="smallBold">Thử lại</ThemedText></Pressable>
      </CenteredState>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedView type="backgroundElement" style={styles.summary}>
          {student.attachment ? <Image source={{ uri: student.attachment }} style={styles.image} /> : null}
          <ThemedText type="subtitle">{student.fullname}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">Mã sinh viên: {student.code}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{student.email}</ThemedText>
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.details}>
          <DetailRow label="Ngày sinh" value={student.dob} />
          <DetailRow label="Giới tính" value={student.sex === true ? 'Nam' : student.sex === false ? 'Nữ' : null} />
          <DetailRow label="Username" value={student.username} />
          <DetailRow label="Lớp" value={studentClass ? `${studentClass.code} — ${studentClass.name}` : student.class_id ? `ID ${student.class_id}` : null} />
          <DetailRow label="Sở thích" value={studentHobbies.length ? studentHobbies.join(', ') : null} />
          <DetailRow label="Quê quán" value={student.homecity} />
          <DetailRow label="Địa chỉ" value={student.address} />
          <DetailRow label="Màu tóc" value={student.hair_color} />
          <DetailRow label="Facebook" value={student.facebook} />
          <DetailRow label="Mô tả" value={student.description} />
        </ThemedView>

        {copyMutation.isError ? <ThemedText type="small" style={styles.errorText}>{errorMessage(copyMutation.error, 'Không thể sao chép sinh viên.')}</ThemedText> : null}
        {deleteMutation.isError ? <ThemedText type="small" style={styles.errorText}>{errorMessage(deleteMutation.error, 'Không thể xóa sinh viên.')}</ThemedText> : null}
        {exportMutation.isError ? <ThemedText type="small" style={styles.errorText}>{errorMessage(exportMutation.error, 'Không thể xuất tệp.')}</ThemedText> : null}
        <View style={styles.actions}>
          <Pressable onPress={() => router.push({ pathname: '/students/[id]/edit', params: { id } })} style={styles.primaryAction}><ThemedText type="smallBold" style={styles.primaryActionText}>Sửa</ThemedText></Pressable>
          <Pressable disabled={copyMutation.isPending} onPress={() => copyMutation.mutate()} style={styles.secondaryAction}><ThemedText type="smallBold">{copyMutation.isPending ? 'Đang sao chép...' : 'Sao chép'}</ThemedText></Pressable>
          <Pressable disabled={deleteMutation.isPending} onPress={confirmDelete} style={styles.deleteAction}><ThemedText type="smallBold" style={styles.deleteActionText}>{deleteMutation.isPending ? 'Đang xóa...' : 'Xóa'}</ThemedText></Pressable>
        </View>
        <ThemedView type="backgroundElement" style={styles.exportCard}>
          <ThemedText type="smallBold">Xuất sinh viên</ThemedText>
          <FileFormatChooser value={exportFormat} onChange={setExportFormat} />
          <Pressable disabled={exportMutation.isPending} onPress={() => exportMutation.mutate()} style={[styles.secondaryAction, exportMutation.isPending && styles.disabledButton]}><ThemedText type="smallBold">{exportMutation.isPending ? 'Đang chuẩn bị...' : 'Xuất'}</ThemedText></Pressable>
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

function DetailRow({ label, value }: { label: string; value: unknown }) {
  return <View style={styles.detailRow}><ThemedText type="smallBold">{label}</ThemedText><ThemedText type="small" themeColor="textSecondary">{displayValue(value)}</ThemedText></View>;
}

function CenteredState({ children }: { children: React.ReactNode }) {
  return <ThemedView style={styles.centered}>{children}</ThemedView>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { gap: Spacing.three, padding: Spacing.four },
  summary: { gap: Spacing.one, padding: Spacing.three, borderRadius: Spacing.two },
  image: { width: 144, height: 144, borderRadius: Spacing.two },
  details: { gap: Spacing.three, padding: Spacing.three, borderRadius: Spacing.two },
  detailRow: { gap: Spacing.half },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  primaryAction: { backgroundColor: '#0A7EA4', borderRadius: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  primaryActionText: { color: '#FFFFFF' },
  secondaryAction: { borderColor: '#0A7EA4', borderRadius: Spacing.two, borderWidth: 1, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  deleteAction: { backgroundColor: '#B42318', borderRadius: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  deleteActionText: { color: '#FFFFFF' },
  exportCard: { gap: Spacing.two, padding: Spacing.three, borderRadius: Spacing.two },
  disabledButton: { opacity: 0.5 },
  errorText: { color: '#B42318' },
  centered: { alignItems: 'center', flex: 1, gap: Spacing.two, justifyContent: 'center', padding: Spacing.four },
});
