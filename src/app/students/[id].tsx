import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, View } from 'react-native';

import { ApiClientError } from '@/api/api-client';
import { getActiveHobbies, getStudentClasses } from '@/api/catalogs';
import { copyStudent, deleteStudent, exportStudent, getStudent, type StudentFileFormat } from '@/api/students';
import { FileFormatChooser } from '@/components/file-format-chooser';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppButton, Card, ErrorMessage, ScreenState } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { shareBinaryFile } from '@/utils/file-sharing';

function apiMessage(error: unknown, fallback: string) {
  return error instanceof ApiClientError
    ? `${error.code ? `${error.code}: ` : ''}${error.message}`
    : fallback;
}

function displayValue(value: unknown) {
  return value === null || value === undefined || value === '' ? '—' : String(value);
}

export default function StudentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const studentQuery = useQuery({ queryKey: ['student', id], queryFn: () => getStudent(id), enabled: Boolean(id) });
  const classesQuery = useQuery({ queryKey: ['student-classes'], queryFn: getStudentClasses });
  const hobbiesQuery = useQuery({ queryKey: ['active-hobbies'], queryFn: getActiveHobbies });
  const student = studentQuery.data?.data;
  const studentClass = useMemo(
    () => classesQuery.data?.data.find((item) => item.id === student?.class_id),
    [classesQuery.data, student?.class_id],
  );
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

  if (studentQuery.isPending) {
    return <ThemedView style={styles.center}><ActivityIndicator size="large" /></ThemedView>;
  }

  if (studentQuery.isError || !student) {
    return (
      <ThemedView style={styles.center}>
        <ScreenState
          title="Không tìm thấy sinh viên"
          detail={studentQuery.isError ? apiMessage(studentQuery.error, 'Không thể tải sinh viên.') : 'Sinh viên không còn tồn tại.'}
          actionLabel="Thử lại"
          onAction={() => void studentQuery.refetch()}
        />
      </ThemedView>
    );
  }

  const changing = copyMutation.isPending || deleteMutation.isPending;
  const classValue = studentClass
    ? `${studentClass.code} — ${studentClass.name}`
    : student.class_id ? classesQuery.isPending ? 'Đang tải lớp…' : `ID ${student.class_id}` : null;
  const hobbiesValue = studentHobbies.length
    ? studentHobbies.join(', ')
    : hobbiesQuery.isPending ? 'Đang tải sở thích…' : null;
  const confirmDelete = () => {
    Alert.alert('Xóa sinh viên?', 'Sinh viên sẽ được chuyển vào thùng rác và có thể khôi phục sau đó.', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: () => deleteMutation.mutate() },
    ]);
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          {student.attachment ? <Image accessible accessibilityLabel={`Ảnh hồ sơ của ${student.fullname}`} source={{ uri: student.attachment }} style={styles.image} /> : null}
          <ThemedText type="subtitle">{student.fullname}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">Mã sinh viên: {student.code}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{student.email}</ThemedText>
        </Card>
        <Card>
          <ThemedText type="smallBold">Thông tin sinh viên</ThemedText>
          <DetailRow label="Ngày sinh" value={student.dob} />
          <DetailRow label="Giới tính" value={student.sex === true ? 'Nam' : student.sex === false ? 'Nữ' : null} />
          <DetailRow label="Username" value={student.username} />
          <DetailRow label="Lớp" value={classValue} />
          <DetailRow label="Sở thích" value={hobbiesValue} />
          <DetailRow label="Quê quán" value={student.homecity} />
          <DetailRow label="Địa chỉ" value={student.address} />
          <DetailRow label="Màu tóc" value={student.hair_color} />
          <DetailRow label="Facebook" value={student.facebook} />
          <DetailRow label="Mô tả" value={student.description} />
        </Card>
        {copyMutation.isError ? <ErrorMessage>{apiMessage(copyMutation.error, 'Không thể sao chép sinh viên.')}</ErrorMessage> : null}
        {deleteMutation.isError ? <ErrorMessage>{apiMessage(deleteMutation.error, 'Không thể xóa sinh viên.')}</ErrorMessage> : null}
        {exportMutation.isError ? <ErrorMessage>{apiMessage(exportMutation.error, 'Không thể xuất tệp.')}</ErrorMessage> : null}
        <View style={styles.actions}>
          <AppButton disabled={changing} label="Sửa" onPress={() => router.push({ pathname: '/students/[id]/edit', params: { id } })} />
          <AppButton disabled={changing} label={copyMutation.isPending ? 'Đang sao chép...' : 'Sao chép'} variant="secondary" onPress={() => copyMutation.mutate()} />
          <AppButton disabled={changing} label={deleteMutation.isPending ? 'Đang xóa...' : 'Xóa'} variant="danger" onPress={confirmDelete} />
        </View>
        <Card>
          <ThemedText type="smallBold">Xuất sinh viên</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">Chọn định dạng trước khi chia sẻ tệp.</ThemedText>
          <FileFormatChooser value={exportFormat} onChange={setExportFormat} />
          <AppButton disabled={exportMutation.isPending || changing} label={exportMutation.isPending ? 'Đang chuẩn bị...' : 'Xuất'} variant="secondary" onPress={() => exportMutation.mutate()} />
        </Card>
      </ScrollView>
    </ThemedView>
  );
}

function DetailRow({ label, value }: { label: string; value: unknown }) {
  return (
    <View style={styles.detailRow}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">{displayValue(value)}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { gap: Spacing.three, padding: Spacing.four },
  image: { height: 144, width: 144, borderRadius: Spacing.two },
  detailRow: { gap: Spacing.half },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  center: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: Spacing.four },
});
