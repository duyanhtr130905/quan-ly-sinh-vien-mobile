import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiClientError } from '@/api/api-client';
import { copyClass, deleteClass, exportClass, getClass, type ClassFileFormat } from '@/api/classes';
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

export default function ClassDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const client = useQueryClient();
  const theme = useTheme();
  const [actionsVisible, setActionsVisible] = useState(false);
  const [format, setFormat] = useState<ClassFileFormat>('xlsx');
  const query = useQuery({ queryKey: ['class', id], queryFn: () => getClass(id), enabled: Boolean(id) });
  const record = query.data?.data;
  const copy = useMutation({
    mutationFn: () => copyClass(id),
    onSuccess: async (response) => {
      await client.invalidateQueries({ queryKey: ['classes'] });
      await client.invalidateQueries({ queryKey: ['student-classes'] });
      setActionsVisible(false);
      router.replace({ pathname: '/classes/[id]', params: { id: response.data.id } } as never);
    },
  });
  const remove = useMutation({
    mutationFn: () => deleteClass(id),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['classes'] });
      await client.invalidateQueries({ queryKey: ['student-classes'] });
      client.removeQueries({ queryKey: ['class', id] });
      setActionsVisible(false);
      router.replace('/classes');
    },
  });
  const exportMutation = useMutation({ mutationFn: () => exportClass(id, format).then(shareBinaryFile) });

  if (query.isPending) return <ThemedView style={styles.center}><ActivityIndicator size="large" /></ThemedView>;
  if (!record) {
    return <ThemedView style={styles.center}><ScreenState title="Không tìm thấy lớp" detail={query.isError ? apiMessage(query.error, 'Không thể tải lớp.') : 'Lớp không còn tồn tại.'} actionLabel="Thử lại" onAction={() => void query.refetch()} /></ThemedView>;
  }

  const studentCount = Number(record.student_count);
  const blocked = studentCount > 0;
  const changing = copy.isPending || remove.isPending;
  const confirmDelete = () => {
    Alert.alert('Xóa lớp?', 'Chỉ lớp không còn sinh viên mới có thể xóa. Thao tác này không thể hoàn tác.', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: () => remove.mutate() },
    ]);
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <ThemedText type="subtitle" style={styles.name}>{record.name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">Mã lớp: {record.code}</ThemedText>
          <ThemedText type="smallBold">{studentCount} sinh viên</ThemedText>
          {record.description ? <ThemedText type="small" themeColor="textSecondary">{record.description}</ThemedText> : null}
        </Card>
        <View style={styles.primaryActions}>
          <AppButton label="Quản lý sinh viên" style={styles.primaryAction} onPress={() => router.push({ pathname: '/classes/[id]/membership', params: { id } } as never)} />
          <AppButton disabled={changing} label="Sửa" variant="secondary" onPress={() => router.push({ pathname: '/classes/[id]/edit', params: { id } } as never)} />
        </View>
        <Card>
          <SectionTitle>Thông tin lớp</SectionTitle>
          <ThemedText type="smallBold">Mã lớp</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{record.code}</ThemedText>
          <ThemedText type="smallBold">Số sinh viên</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{studentCount}</ThemedText>
          {record.description ? <><ThemedText type="smallBold">Mô tả</ThemedText><ThemedText type="small" themeColor="textSecondary">{record.description}</ThemedText></> : null}
        </Card>
        <Card>
          <SectionTitle>Sinh viên thuộc lớp</SectionTitle>
          <ThemedText type="small" themeColor="textSecondary">Danh sách hiện có {studentCount} sinh viên. Thêm, tìm kiếm hoặc loại sinh viên trong màn hình quản lý.</ThemedText>
          <AppButton label="Quản lý sinh viên" variant="secondary" onPress={() => router.push({ pathname: '/classes/[id]/membership', params: { id } } as never)} />
        </Card>
        {copy.isError ? <ErrorMessage>{apiMessage(copy.error, 'Không thể sao chép lớp.')}</ErrorMessage> : null}
        {remove.isError ? <ErrorMessage>{apiMessage(remove.error, 'Không thể xóa lớp.')}</ErrorMessage> : null}
        {exportMutation.isError ? <ErrorMessage>{apiMessage(exportMutation.error, 'Không thể xuất tệp.')}</ErrorMessage> : null}
        <AppButton disabled={changing} label="Thao tác khác" variant="secondary" onPress={() => setActionsVisible(true)} />
      </ScrollView>
      <Modal animationType="slide" presentationStyle="overFullScreen" transparent visible={actionsVisible} onRequestClose={() => setActionsVisible(false)}>
        <View style={styles.backdrop}>
          <SafeAreaView edges={['bottom']} style={[styles.actionSheet, { backgroundColor: theme.background }]}>
            <Card>
              <View style={styles.sheetHeader}>
                <ThemedText type="smallBold">Thao tác với lớp</ThemedText>
                <AppButton label="Đóng" variant="secondary" onPress={() => setActionsVisible(false)} />
              </View>
              <AppButton disabled={changing} label={copy.isPending ? 'Đang sao chép...' : 'Sao chép'} variant="secondary" onPress={() => copy.mutate()} />
              <ThemedText type="smallBold">Xuất lớp</ThemedText>
              <FileFormatChooser value={format} onChange={setFormat} />
              <AppButton disabled={changing || exportMutation.isPending} label={exportMutation.isPending ? 'Đang chuẩn bị...' : 'Xuất'} variant="secondary" onPress={() => exportMutation.mutate()} />
              <AppButton disabled={blocked || changing} label={blocked ? 'Không thể xóa: còn sinh viên' : remove.isPending ? 'Đang xóa...' : 'Xóa'} variant="danger" onPress={confirmDelete} />
              {blocked ? <ThemedText type="small" themeColor="textSecondary">Lớp có sinh viên nên backend sẽ chặn thao tác xóa.</ThemedText> : null}
            </Card>
          </SafeAreaView>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { gap: Spacing.three, padding: Spacing.four },
  name: { fontSize: 26, lineHeight: 34 },
  primaryActions: { flexDirection: 'row', gap: Spacing.two },
  primaryAction: { flex: 1 },
  center: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: Spacing.four },
  backdrop: { backgroundColor: 'rgba(0, 0, 0, 0.45)', flex: 1, justifyContent: 'flex-end' },
  actionSheet: { borderTopLeftRadius: Spacing.four, borderTopRightRadius: Spacing.four, padding: Spacing.four },
  sheetHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
});
