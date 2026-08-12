import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';

import { ApiClientError } from '@/api/api-client';
import { copyClass, deleteClass, exportClass, getClass, type ClassFileFormat } from '@/api/classes';
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

export default function ClassDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const client = useQueryClient();
  const [format, setFormat] = useState<ClassFileFormat>('xlsx');
  const query = useQuery({ queryKey: ['class', id], queryFn: () => getClass(id), enabled: Boolean(id) });
  const record = query.data?.data;
  const copy = useMutation({
    mutationFn: () => copyClass(id),
    onSuccess: async (response) => {
      await client.invalidateQueries({ queryKey: ['classes'] });
      router.replace({ pathname: '/classes/[id]', params: { id: response.data.id } } as never);
    },
  });
  const remove = useMutation({
    mutationFn: () => deleteClass(id),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['classes'] });
      client.removeQueries({ queryKey: ['class', id] });
      router.replace('/classes');
    },
  });
  const exportMutation = useMutation({ mutationFn: () => exportClass(id, format).then(shareBinaryFile) });

  if (query.isPending) {
    return <ThemedView style={styles.center}><ActivityIndicator size="large" /></ThemedView>;
  }

  if (!record) {
    return (
      <ThemedView style={styles.center}>
        <ScreenState
          title="Không tìm thấy lớp"
          detail={query.isError ? apiMessage(query.error, 'Không thể tải lớp.') : 'Lớp không còn tồn tại.'}
          actionLabel="Thử lại"
          onAction={() => void query.refetch()}
        />
      </ThemedView>
    );
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
          <ThemedText type="subtitle">{record.name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">Mã lớp: {record.code}</ThemedText>
          <ThemedText type="smallBold">{studentCount} sinh viên</ThemedText>
        </Card>
        <Card>
          <ThemedText type="smallBold">Thông tin lớp</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">Mô tả</ThemedText>
          <ThemedText type="small">{record.description || 'Chưa có mô tả.'}</ThemedText>
        </Card>
        <Card style={styles.membership}>
          <ThemedText type="smallBold">Sinh viên thuộc lớp</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">Xem, thêm hoặc loại sinh viên. Danh sách hiện có {studentCount} sinh viên.</ThemedText>
          <AppButton label="Quản lý sinh viên" variant="secondary" onPress={() => router.push({ pathname: '/classes/[id]/membership', params: { id } } as never)} />
        </Card>
        {copy.isError ? <ErrorMessage>{apiMessage(copy.error, 'Không thể sao chép lớp.')}</ErrorMessage> : null}
        {remove.isError ? <ErrorMessage>{apiMessage(remove.error, 'Không thể xóa lớp.')}</ErrorMessage> : null}
        {exportMutation.isError ? <ErrorMessage>{apiMessage(exportMutation.error, 'Không thể xuất tệp.')}</ErrorMessage> : null}
        <View style={styles.actions}>
          <AppButton disabled={changing} label="Sửa" onPress={() => router.push({ pathname: '/classes/[id]/edit', params: { id } } as never)} />
          <AppButton disabled={changing} label={copy.isPending ? 'Đang sao chép...' : 'Sao chép'} variant="secondary" onPress={() => copy.mutate()} />
          <AppButton disabled={blocked || changing} label={blocked ? 'Không thể xóa: còn sinh viên' : remove.isPending ? 'Đang xóa...' : 'Xóa'} variant="danger" onPress={confirmDelete} />
        </View>
        {blocked ? <ThemedText type="small" themeColor="textSecondary">Lớp có sinh viên nên backend sẽ chặn thao tác xóa.</ThemedText> : null}
        <Card>
          <ThemedText type="smallBold">Xuất lớp</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">Chọn định dạng trước khi chia sẻ tệp.</ThemedText>
          <FileFormatChooser value={format} onChange={setFormat} />
          <AppButton disabled={exportMutation.isPending || changing} label={exportMutation.isPending ? 'Đang chuẩn bị...' : 'Xuất'} variant="secondary" onPress={() => exportMutation.mutate()} />
        </Card>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { gap: Spacing.three, padding: Spacing.four },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  membership: { gap: Spacing.two },
  center: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: Spacing.four },
});
