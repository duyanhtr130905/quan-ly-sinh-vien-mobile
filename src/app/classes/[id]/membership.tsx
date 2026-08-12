import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, View, type ListRenderItemInfo } from 'react-native';

import { ApiClientError } from '@/api/api-client';
import { getClassStudents, removeClassStudent, removeClassStudents, type ClassStudent } from '@/api/classes';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppButton, AppTextInput, Card, ErrorMessage, PaginationControls, ScreenState } from '@/components/ui';
import { Spacing } from '@/constants/theme';

const PAGE_SIZE = 10;

function apiMessage(error: unknown) {
  return error instanceof ApiClientError
    ? `${error.code ? `${error.code}: ` : ''}${error.message}`
    : 'Không thể loại sinh viên khỏi lớp.';
}

export default function MembershipScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const query = useQuery({
    queryKey: ['class-members', id, { page, size: PAGE_SIZE, search }],
    queryFn: () => getClassStudents(id, { page, size: PAGE_SIZE, search }),
    enabled: Boolean(id),
  });
  const data = query.data?.data;
  const records = data?.records ?? [];
  const current = data?.page_info.current ?? page;
  const total = data?.page_info.total_pages ?? 0;
  const invalidate = async () => {
    await client.invalidateQueries({ queryKey: ['class', id] });
    await client.invalidateQueries({ queryKey: ['class-members', id] });
    await client.invalidateQueries({ queryKey: ['class-available', id] });
    await client.invalidateQueries({ queryKey: ['classes'] });
    await client.invalidateQueries({ queryKey: ['students'] });
    await client.invalidateQueries({ queryKey: ['student'] });
  };
  const remove = useMutation({ mutationFn: (studentId: string) => removeClassStudent(id, studentId), onSuccess: invalidate });
  const bulkRemove = useMutation({
    mutationFn: () => removeClassStudents(id, selected),
    onSuccess: async () => {
      await invalidate();
      setSelected([]);
    },
  });
  const busy = remove.isPending || bulkRemove.isPending;
  const toggle = (studentId: string) => {
    setSelected((items) => items.includes(studentId) ? items.filter((item) => item !== studentId) : [...items, studentId]);
  };
  const submit = () => {
    setSearch(input.trim());
    setPage(1);
  };
  const changeSelectionMode = () => {
    setSelecting((current) => {
      if (current) setSelected([]);
      return !current;
    });
  };
  const confirmSingle = (student: ClassStudent) => {
    Alert.alert('Loại sinh viên?', `${student.fullname} sẽ không còn thuộc lớp này.`, [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Loại', style: 'destructive', onPress: () => remove.mutate(student.id) },
    ]);
  };
  const confirmBulk = () => {
    Alert.alert('Loại sinh viên?', `${selected.length} sinh viên sẽ bị loại khỏi lớp này. Thao tác chỉ thực hiện khi toàn bộ dữ liệu hợp lệ.`, [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Loại', style: 'destructive', onPress: () => bulkRemove.mutate() },
    ]);
  };
  const renderItem = ({ item }: ListRenderItemInfo<ClassStudent>) => (
    <Card selected={selected.includes(item.id)} style={styles.memberCard}>
      <Pressable
        accessibilityHint={selecting ? 'Chọn hoặc bỏ chọn sinh viên này' : undefined}
        accessibilityLabel={`${selecting ? (selected.includes(item.id) ? 'Đã chọn' : 'Chưa chọn') : 'Sinh viên'}: ${item.fullname}`}
        accessibilityRole={selecting ? 'button' : undefined}
        disabled={!selecting}
        onPress={() => toggle(item.id)}
      >
        <ThemedText type="smallBold">{selecting ? `${selected.includes(item.id) ? '✓ Đã chọn · ' : '○ Chưa chọn · '}` : ''}{item.fullname}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">{item.code} · {item.email}</ThemedText>
      </Pressable>
      {!selecting ? <Pressable accessibilityLabel={`Thao tác với ${item.fullname}`} disabled={busy} onPress={() => confirmSingle(item)} style={styles.memberAction}><ThemedText type="smallBold" themeColor="textSecondary">{remove.isPending ? 'Đang loại...' : 'Loại khỏi lớp'}</ThemedText></Pressable> : null}
    </Card>
  );

  return (
    <ThemedView style={styles.container}>
      <FlatList
        contentContainerStyle={[styles.content, records.length === 0 && styles.empty]}
        data={records}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={query.isPending ? (
          <View style={styles.loading}><ActivityIndicator size="large" /></View>
        ) : query.isError ? (
          <ScreenState title="Không thể tải sinh viên" detail={apiMessage(query.error)} actionLabel="Thử lại" onAction={() => void query.refetch()} />
        ) : (
          <ScreenState title="Chưa có sinh viên trong lớp" detail="Thêm sinh viên vào lớp để bắt đầu quản lý thành viên." />
        )}
        ListFooterComponent={data ? (
          <PaginationControls
            currentPage={current}
            onNext={() => setPage((value) => value + 1)}
            onPrevious={() => setPage((value) => Math.max(1, value - 1))}
            totalItems={data.page_info.total_items}
            totalPages={total}
          />
        ) : null}
        ListHeaderComponent={(
          <View style={styles.header}>
            <ThemedText type="subtitle">Thành viên lớp</ThemedText>
            <View style={styles.actions}>
              <AppButton label="Thêm sinh viên" onPress={() => router.push({ pathname: '/classes/[id]/membership/add', params: { id } } as never)} />
              <AppButton label={selecting ? 'Xong chọn' : 'Chọn nhiều'} variant="secondary" onPress={changeSelectionMode} />
            </View>
            {selecting ? (
              <Card style={styles.selection}>
                <ThemedText type="smallBold" accessibilityLiveRegion="polite">Đang chọn · {selected.length} sinh viên</ThemedText>
                <View style={styles.actions}>
                  <AppButton label="Chọn trang này" variant="secondary" onPress={() => setSelected((items) => [...new Set([...items, ...records.map((record) => record.id)])])} />
                  <AppButton label="Bỏ chọn" variant="secondary" onPress={() => setSelected([])} />
                  <AppButton disabled={!selected.length || busy} label={bulkRemove.isPending ? 'Đang loại...' : 'Loại đã chọn'} variant="danger" onPress={confirmBulk} />
                </View>
              </Card>
            ) : null}
            <View style={styles.searchRow}>
              <AppTextInput
                accessibilityLabel="Tìm thành viên lớp"
                placeholder="Tìm mã, tên hoặc email"
                returnKeyType="search"
                value={input}
                onChangeText={setInput}
                onSubmitEditing={submit}
                style={styles.searchInput}
              />
              <AppButton label="Tìm" onPress={submit} />
            </View>
            {remove.isError ? <ErrorMessage>{apiMessage(remove.error)}</ErrorMessage> : null}
            {bulkRemove.isError ? <ErrorMessage>{apiMessage(bulkRemove.error)}</ErrorMessage> : null}
          </View>
        )}
        refreshing={query.isRefetching}
        renderItem={renderItem}
        onRefresh={() => void query.refetch()}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { gap: Spacing.two, padding: Spacing.four },
  empty: { flexGrow: 1 },
  header: { gap: Spacing.two, paddingBottom: Spacing.three },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  searchRow: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two },
  searchInput: { flex: 1 },
  memberCard: { gap: Spacing.half, paddingVertical: Spacing.two },
  memberAction: { alignSelf: 'flex-start', minHeight: 36, paddingVertical: Spacing.one },
  selection: { gap: Spacing.two },
  loading: { alignItems: 'center', flex: 1, justifyContent: 'center', minHeight: 220 },
});
