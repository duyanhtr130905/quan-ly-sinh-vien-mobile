import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, View, type ListRenderItemInfo } from 'react-native';

import { ApiClientError } from '@/api/api-client';
import { assignClassStudents, getAvailableStudents, type ClassStudent } from '@/api/classes';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppButton, AppTextInput, Card, ErrorMessage, PaginationControls, ScreenState } from '@/components/ui';
import { Spacing } from '@/constants/theme';

const PAGE_SIZE = 10;

function apiMessage(error: unknown, fallback: string) {
  return error instanceof ApiClientError
    ? `${error.code ? `${error.code}: ` : ''}${error.message}`
    : fallback;
}

export default function AddMembersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const query = useQuery({
    queryKey: ['class-available', id, { page, size: PAGE_SIZE, search }],
    queryFn: () => getAvailableStudents(id, { page, size: PAGE_SIZE, search }),
    enabled: Boolean(id),
  });
  const data = query.data?.data;
  const records = data?.records ?? [];
  const current = data?.page_info.current ?? page;
  const total = data?.page_info.total_pages ?? 0;
  const assign = useMutation({
    mutationFn: () => assignClassStudents(id, selected),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['class', id] });
      await client.invalidateQueries({ queryKey: ['class-members', id] });
      await client.invalidateQueries({ queryKey: ['class-available', id] });
      await client.invalidateQueries({ queryKey: ['classes'] });
      await client.invalidateQueries({ queryKey: ['students'] });
      await client.invalidateQueries({ queryKey: ['student'] });
      router.back();
    },
  });
  const toggle = (studentId: string) => {
    setSelected((all) => all.includes(studentId) ? all.filter((value) => value !== studentId) : [...all, studentId]);
  };
  const submit = () => {
    setSearch(input.trim());
    setPage(1);
  };
  const confirmAssign = () => {
    Alert.alert('Thêm sinh viên vào lớp?', `${selected.length} sinh viên sẽ được gán vào lớp này.`, [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Thêm', onPress: () => assign.mutate() },
    ]);
  };
  const renderItem = ({ item }: ListRenderItemInfo<ClassStudent>) => {
    const isSelected = selected.includes(item.id);
    return (
      <Pressable
        accessibilityLabel={`${isSelected ? 'Đã chọn' : 'Chưa chọn'}: ${item.fullname}`}
        accessibilityRole="button"
        onPress={() => toggle(item.id)}
      >
        <Card selected={isSelected} style={styles.card}>
          <ThemedText type="smallBold">{isSelected ? '✓ Đã chọn · ' : '○ Chưa chọn · '}{item.fullname}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{item.code} · {item.email}</ThemedText>
        </Card>
      </Pressable>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <FlatList
        contentContainerStyle={[styles.content, records.length === 0 && styles.empty]}
        data={records}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={query.isPending ? (
          <View style={styles.loading}><ActivityIndicator size="large" /></View>
        ) : query.isError ? (
          <ScreenState title="Không thể tải sinh viên" detail={apiMessage(query.error, 'Không thể tải sinh viên có thể thêm.')} actionLabel="Thử lại" onAction={() => void query.refetch()} />
        ) : (
          <ScreenState title="Không có sinh viên sẵn sàng" detail="Tất cả sinh viên phù hợp đã thuộc một lớp hoặc không khớp từ khóa tìm kiếm." />
        )}
        ListFooterComponent={(
          <View style={styles.footer}>
            {data ? (
              <PaginationControls
                currentPage={current}
                onNext={() => setPage((value) => value + 1)}
                onPrevious={() => setPage((value) => Math.max(1, value - 1))}
                totalItems={data.page_info.total_items}
                totalPages={total}
              />
            ) : null}
            <AppButton disabled={!selected.length || assign.isPending} label={assign.isPending ? 'Đang thêm...' : `Thêm ${selected.length} sinh viên`} onPress={confirmAssign} />
          </View>
        )}
        ListHeaderComponent={(
          <View style={styles.header}>
            <ThemedText type="subtitle">Thêm sinh viên</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">Chọn sinh viên chưa thuộc lớp nào. Lựa chọn được giữ khi chuyển trang.</ThemedText>
            <View style={styles.searchRow}>
              <AppTextInput
                accessibilityLabel="Tìm sinh viên có thể thêm"
                placeholder="Tìm mã, tên hoặc email"
                returnKeyType="search"
                value={input}
                onChangeText={setInput}
                onSubmitEditing={submit}
                style={styles.searchInput}
              />
              <AppButton label="Tìm" onPress={submit} />
            </View>
            {assign.isError ? <ErrorMessage>{apiMessage(assign.error, 'Không thể thêm sinh viên.')}</ErrorMessage> : null}
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
  searchRow: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two },
  searchInput: { flex: 1 },
  card: { gap: Spacing.half, paddingVertical: Spacing.two },
  footer: { gap: Spacing.three, paddingTop: Spacing.three },
  loading: { alignItems: 'center', flex: 1, justifyContent: 'center', minHeight: 220 },
});
