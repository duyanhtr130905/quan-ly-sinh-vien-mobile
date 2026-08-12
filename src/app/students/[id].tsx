import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Image, Modal, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiClientError } from '@/api/api-client';
import { getActiveHobbies, getStudentClasses } from '@/api/catalogs';
import { copyStudent, deleteStudent, exportStudent, getStudent, type StudentFileFormat } from '@/api/students';
import { FileFormatChooser } from '@/components/file-format-chooser';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppButton, Card, ErrorMessage, ScreenState, SectionTitle } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { shareBinaryFile } from '@/utils/file-sharing';

function apiMessage(error: unknown, fallback: string) {
  return error instanceof ApiClientError
    ? `${error.code ? `${error.code}: ` : ''}${error.message}`
    : fallback;
}

function formatDate(value: string | null) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export default function StudentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const [actionsVisible, setActionsVisible] = useState(false);
  const [exportFormat, setExportFormat] = useState<StudentFileFormat>('xlsx');
  const studentQuery = useQuery({ queryKey: ['student', id], queryFn: () => getStudent(id), enabled: Boolean(id) });
  const classesQuery = useQuery({ queryKey: ['student-classes'], queryFn: getStudentClasses });
  const hobbiesQuery = useQuery({ queryKey: ['active-hobbies'], queryFn: getActiveHobbies });
  const student = studentQuery.data?.data;
  const studentClass = useMemo(() => classesQuery.data?.data.find((item) => item.id === student?.class_id), [classesQuery.data, student?.class_id]);
  const studentHobbies = useMemo(() => {
    const mask = Number(student?.hobbies ?? 0);
    return hobbiesQuery.data?.data.filter((hobby) => (mask & hobby.bit_value) !== 0).map((hobby) => hobby.name) ?? [];
  }, [hobbiesQuery.data, student?.hobbies]);
  const copyMutation = useMutation({
    mutationFn: () => copyStudent(id),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ['students'] });
      await queryClient.invalidateQueries({ queryKey: ['classes'] });
      await queryClient.invalidateQueries({ queryKey: ['class'] });
      await queryClient.invalidateQueries({ queryKey: ['class-members'] });
      await queryClient.invalidateQueries({ queryKey: ['class-available'] });
      setActionsVisible(false);
      Alert.alert('Đã sao chép sinh viên', `Đã tạo ${response.data.code}.`);
      router.replace({ pathname: '/students/[id]', params: { id: response.data.id } });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteStudent(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['students'] });
      await queryClient.invalidateQueries({ queryKey: ['deleted-students'] });
      await queryClient.invalidateQueries({ queryKey: ['classes'] });
      await queryClient.invalidateQueries({ queryKey: ['class'] });
      await queryClient.invalidateQueries({ queryKey: ['class-members'] });
      await queryClient.invalidateQueries({ queryKey: ['class-available'] });
      queryClient.removeQueries({ queryKey: ['student', id] });
      setActionsVisible(false);
      router.replace('/');
    },
  });
  const exportMutation = useMutation({ mutationFn: () => exportStudent(id, exportFormat).then(shareBinaryFile) });

  if (studentQuery.isPending) return <ThemedView style={styles.center}><ActivityIndicator size="large" /></ThemedView>;
  if (studentQuery.isError || !student) {
    return <ThemedView style={styles.center}><ScreenState title="Không tìm thấy sinh viên" detail={studentQuery.isError ? apiMessage(studentQuery.error, 'Không thể tải sinh viên.') : 'Sinh viên không còn tồn tại.'} actionLabel="Thử lại" onAction={() => void studentQuery.refetch()} /></ThemedView>;
  }

  const changing = copyMutation.isPending || deleteMutation.isPending;
  const classValue = studentClass ? `${studentClass.code} — ${studentClass.name}` : student.class_id ? `ID ${student.class_id}` : null;
  const contactRows = [
    { label: 'Email', value: student.email },
    { label: 'Quê quán', value: student.homecity },
    { label: 'Địa chỉ', value: student.address },
    { label: 'Facebook', value: student.facebook },
  ];
  const otherRows = [
    { label: 'Màu tóc', value: student.hair_color },
    { label: 'Mô tả', value: student.description },
  ];
  const confirmDelete = () => {
    Alert.alert('Xóa sinh viên?', 'Sinh viên sẽ được chuyển vào thùng rác và có thể khôi phục sau đó.', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: () => deleteMutation.mutate() },
    ]);
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.identity}>
          {student.attachment ? <Image accessible accessibilityLabel={`Ảnh hồ sơ của ${student.fullname}`} source={{ uri: student.attachment }} style={styles.image} /> : null}
          <View style={styles.identityText}>
            <ThemedText type="subtitle" style={styles.name}>{student.fullname}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">Mã sinh viên: {student.code}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">{student.email}</ThemedText>
          </View>
        </Card>
        <View style={styles.primaryActions}>
          <AppButton disabled={changing} label="Sửa" style={styles.primaryAction} onPress={() => router.push({ pathname: '/students/[id]/edit', params: { id } })} />
          <AppButton disabled={changing} label="Thao tác khác" variant="secondary" onPress={() => setActionsVisible(true)} />
        </View>
        <DetailSection title="Thông tin sinh viên" rows={[
          { label: 'Ngày sinh', value: formatDate(student.dob) },
          { label: 'Giới tính', value: student.sex === true ? 'Nam' : student.sex === false ? 'Nữ' : null },
          { label: 'Username', value: student.username },
        ]} />
        <DetailSection title="Học tập" rows={[
          { label: 'Lớp', value: classValue },
          { label: 'Sở thích', value: studentHobbies.length ? studentHobbies.join(', ') : null },
        ]} />
        <DetailSection title="Liên hệ" rows={contactRows} />
        <DetailSection title="Khác" rows={otherRows} />
        {copyMutation.isError ? <ErrorMessage>{apiMessage(copyMutation.error, 'Không thể sao chép sinh viên.')}</ErrorMessage> : null}
        {deleteMutation.isError ? <ErrorMessage>{apiMessage(deleteMutation.error, 'Không thể xóa sinh viên.')}</ErrorMessage> : null}
        {exportMutation.isError ? <ErrorMessage>{apiMessage(exportMutation.error, 'Không thể xuất tệp.')}</ErrorMessage> : null}
      </ScrollView>
      <Modal animationType="slide" presentationStyle="overFullScreen" transparent visible={actionsVisible} onRequestClose={() => setActionsVisible(false)}>
        <View style={styles.backdrop}>
          <SafeAreaView edges={['bottom']} style={[styles.actionSheet, { backgroundColor: theme.background }]}>
            <Card>
              <View style={styles.sheetHeader}>
                <ThemedText type="smallBold">Thao tác với sinh viên</ThemedText>
                <AppButton label="Đóng" variant="secondary" onPress={() => setActionsVisible(false)} />
              </View>
              <AppButton disabled={changing} label={copyMutation.isPending ? 'Đang sao chép...' : 'Sao chép'} variant="secondary" onPress={() => copyMutation.mutate()} />
              <ThemedText type="smallBold">Xuất sinh viên</ThemedText>
              <FileFormatChooser value={exportFormat} onChange={setExportFormat} />
              <AppButton disabled={changing || exportMutation.isPending} label={exportMutation.isPending ? 'Đang chuẩn bị...' : 'Xuất'} variant="secondary" onPress={() => exportMutation.mutate()} />
              <AppButton disabled={changing} label={deleteMutation.isPending ? 'Đang xóa...' : 'Xóa'} variant="danger" onPress={confirmDelete} />
            </Card>
          </SafeAreaView>
        </View>
      </Modal>
    </ThemedView>
  );
}

function DetailSection({ title, rows }: { title: string; rows: { label: string; value: string | null }[] }) {
  const visibleRows = rows.filter((row) => row.value);
  if (!visibleRows.length) return null;
  return (
    <Card>
      <SectionTitle>{title}</SectionTitle>
      {visibleRows.map((row) => <View key={row.label} style={styles.detailRow}><ThemedText type="smallBold">{row.label}</ThemedText><ThemedText type="small" themeColor="textSecondary">{row.value}</ThemedText></View>)}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { gap: Spacing.three, padding: Spacing.four },
  identity: { alignItems: 'center', flexDirection: 'row' },
  identityText: { flex: 1, gap: Spacing.half },
  name: { fontSize: 26, lineHeight: 34 },
  image: { borderRadius: Spacing.two, height: 88, width: 88 },
  primaryActions: { flexDirection: 'row', gap: Spacing.two },
  primaryAction: { flex: 1 },
  detailRow: { gap: Spacing.half },
  center: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: Spacing.four },
  backdrop: { backgroundColor: 'rgba(0, 0, 0, 0.45)', flex: 1, justifyContent: 'flex-end' },
  actionSheet: { borderTopLeftRadius: Spacing.four, borderTopRightRadius: Spacing.four, padding: Spacing.four },
  sheetHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
});
