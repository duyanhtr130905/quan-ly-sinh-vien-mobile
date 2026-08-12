import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, View, type ListRenderItemInfo } from 'react-native';

import { ApiClientError } from '@/api/api-client';
import { getDeletedStudentPage, permanentlyDeleteStudents, restoreStudents, type StudentListItem } from '@/api/students';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppButton, AppTextInput, Card, ErrorMessage, PaginationControls, ScreenState } from '@/components/ui';
import { Spacing } from '@/constants/theme';

const PAGE_SIZE = 10;

function apiMessage(error: unknown) {
  return error instanceof ApiClientError
    ? `${error.code ? `${error.code}: ` : ''}${error.message}`
    : 'Không thể cập nhật danh sách sinh viên đã xóa.';
}

export default function DeletedStudentsScreen() {
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const deletedQuery = useQuery({
    queryKey: ['deleted-students', { page, size: PAGE_SIZE, search }],
    queryFn: () => getDeletedStudentPage({ page, size: PAGE_SIZE, search }),
  });
  const pageData = deletedQuery.data?.data;
  const students = pageData?.records ?? [];
  const currentPage = pageData?.page_info.current ?? page;
  const totalPages = pageData?.page_info.total_pages ?? 0;
  const invalidate = async () => {
    await client.invalidateQueries({ queryKey: ['students'] });
    await client.invalidateQueries({ queryKey: ['deleted-students'] });
    await client.invalidateQueries({ queryKey: ['classes'] });
    await client.invalidateQueries({ queryKey: ['class'] });
    await client.invalidateQueries({ queryKey: ['class-members'] });
    await client.invalidateQueries({ queryKey: ['class-available'] });
  };
  const clampAfter = (removed: (string | number)[]) => {
    const removedIds = new Set(removed.map(String));
    if (students.length > 0 && students.every((student) => removedIds.has(student.id))) {
      setPage((current) => Math.max(1, current - 1));
    }
    return removedIds;
  };
  const restoreMutation = useMutation({
    mutationFn: (ids: string[]) => restoreStudents(ids.map(Number)),
    onSuccess: async (response) => {
      await invalidate();
      const restored = clampAfter(response.data.restored);
      response.data.restored.forEach((id) => client.removeQueries({ queryKey: ['student', String(id)] }));
      setSelected((items) => items.filter((id) => !restored.has(id)));
      Alert.alert(
        'Kết quả khôi phục',
        `Đã khôi phục ${response.data.restored.length} sinh viên.${response.data.conflicts.length ? ` Xung đột dữ liệu: ${response.data.conflicts.join(', ')}.` : ''}${response.data.notFound.length ? ` Không tìm thấy: ${response.data.notFound.join(', ')}.` : ''}`,
      );
    },
  });
  const permanentMutation = useMutation({
    mutationFn: (ids: string[]) => permanentlyDeleteStudents(ids.map(Number)),
    onSuccess: async (response) => {
      await invalidate();
      const deleted = clampAfter(response.data.deleted);
      response.data.deleted.forEach((id) => client.removeQueries({ queryKey: ['student', String(id)] }));
      setSelected((items) => items.filter((id) => !deleted.has(id)));
      Alert.alert(
        'Kết quả xóa vĩnh viễn',
        `Đã xóa vĩnh viễn ${response.data.deleted.length} sinh viên.${response.data.notFound.length ? ` Không tìm thấy: ${response.data.notFound.join(', ')}.` : ''}`,
      );
    },
  });
  const busy = restoreMutation.isPending || permanentMutation.isPending;
  const toggle = (id: string) => {
    setSelected((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  };
  const submitSearch = () => {
    setSearch(searchInput.trim());
    setPage(1);
  };
  const changeSelectionMode = () => {
    setSelecting((current) => {
      if (current) setSelected([]);
      return !current;
    });
  };
  const confirmRestore = (ids: string[]) => {
    Alert.alert(
      'Khôi phục sinh viên?',
      `${ids.length} sinh viên sẽ trở lại danh sách hoạt động. Kết quả có thể bao gồm xung đột code/email/username; các xung đột đó sẽ được hiển thị.`,
      [{ text: 'Hủy', style: 'cancel' }, { text: 'Khôi phục', onPress: () => restoreMutation.mutate(ids) }],
    );
  };
  const confirmPermanent = (ids: string[]) => {
    Alert.alert(
      'Xóa vĩnh viễn?',
      `${ids.length} sinh viên sẽ bị xóa vĩnh viễn và không thể hoàn tác.`,
      [{ text: 'Hủy', style: 'cancel' }, { text: 'Xóa vĩnh viễn', style: 'destructive', onPress: () => permanentMutation.mutate(ids) }],
    );
  };
  const openSingleActions = (student: StudentListItem) => {
    Alert.alert(`Thao tác với ${student.fullname}`, 'Chọn hành động cho sinh viên trong thùng rác.', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Khôi phục', onPress: () => confirmRestore([student.id]) },
      { text: 'Xóa vĩnh viễn', style: 'destructive', onPress: () => confirmPermanent([student.id]) },
    ]);
  };
  const renderItem = ({ item }: ListRenderItemInfo<StudentListItem>) => (
    <Card selected={selected.includes(item.id)} style={styles.studentCard}>
      <Pressable
        accessibilityHint={selecting ? 'Chọn hoặc bỏ chọn sinh viên này' : undefined}
        accessibilityLabel={`${selecting ? (selected.includes(item.id) ? 'Đã chọn' : 'Chưa chọn') : 'Sinh viên đã xóa'}: ${item.fullname}`}
        accessibilityRole={selecting ? 'button' : undefined}
        disabled={!selecting}
        onPress={() => toggle(item.id)}
      >
        <ThemedText type="smallBold">{selecting ? `${selected.includes(item.id) ? '✓ Đã chọn · ' : '○ Chưa chọn · '}` : ''}{item.fullname}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">{item.code} · {item.email}</ThemedText>
      </Pressable>
      {!selecting ? <Pressable accessibilityLabel={`Thao tác với ${item.fullname}`} disabled={busy} onPress={() => openSingleActions(item)} style={styles.rowAction}><ThemedText type="smallBold" themeColor="textSecondary">Thao tác</ThemedText></Pressable> : null}
    </Card>
  );

  return (
    <ThemedView style={styles.container}>
      <FlatList
        contentContainerStyle={[styles.content, students.length === 0 && styles.emptyContent]}
        data={students}
        keyExtractor={(student) => student.id}
        ListEmptyComponent={deletedQuery.isPending ? (
          <View style={styles.loading}><ActivityIndicator size="large" /></View>
        ) : deletedQuery.isError ? (
          <ScreenState title="Không thể tải thùng rác" detail={apiMessage(deletedQuery.error)} actionLabel="Thử lại" onAction={() => void deletedQuery.refetch()} />
        ) : (
          <ScreenState title="Thùng rác trống" detail="Không có sinh viên đã xóa phù hợp." />
        )}
        ListFooterComponent={pageData ? (
          <PaginationControls
            currentPage={currentPage}
            itemLabel="sinh viên"
            onNext={() => setPage((current) => current + 1)}
            onPrevious={() => setPage((current) => Math.max(1, current - 1))}
            totalItems={pageData.page_info.total_items}
            totalPages={totalPages}
          />
        ) : null}
        ListHeaderComponent={(
          <View style={styles.header}>
            <ThemedText type="subtitle">Thùng rác sinh viên</ThemedText>
            <ThemedText themeColor="textSecondary">Khôi phục đưa sinh viên về danh sách hoạt động. Xóa vĩnh viễn không thể hoàn tác.</ThemedText>
            <AppButton label={selecting ? 'Xong chọn' : 'Chọn nhiều'} variant="secondary" onPress={changeSelectionMode} />
            {selecting ? (
              <Card style={styles.selectionBar}>
                <ThemedText type="smallBold" accessibilityLiveRegion="polite">Đang chọn · {selected.length} sinh viên</ThemedText>
                <View style={styles.actions}>
                  <AppButton label="Chọn trang này" variant="secondary" onPress={() => setSelected((items) => [...new Set([...items, ...students.map((student) => student.id)])])} />
                  <AppButton label="Bỏ chọn" variant="secondary" onPress={() => setSelected([])} />
                  {selected.length ? <AppButton disabled={busy} label={restoreMutation.isPending ? 'Đang khôi phục...' : 'Khôi phục đã chọn'} onPress={() => confirmRestore(selected)} /> : null}
                  {selected.length ? <AppButton disabled={busy} label={permanentMutation.isPending ? 'Đang xóa...' : 'Xóa vĩnh viễn'} variant="danger" onPress={() => confirmPermanent(selected)} /> : null}
                </View>
              </Card>
            ) : null}
            <View style={styles.searchRow}>
              <AppTextInput
                accessibilityLabel="Tìm sinh viên trong thùng rác"
                placeholder="Nhập tên hoặc email"
                returnKeyType="search"
                value={searchInput}
                onChangeText={setSearchInput}
                onSubmitEditing={submitSearch}
                style={styles.searchInput}
              />
              <AppButton label="Tìm" onPress={submitSearch} />
            </View>
            {restoreMutation.isError ? <ErrorMessage>{apiMessage(restoreMutation.error)}</ErrorMessage> : null}
            {permanentMutation.isError ? <ErrorMessage>{apiMessage(permanentMutation.error)}</ErrorMessage> : null}
          </View>
        )}
        refreshing={deletedQuery.isRefetching}
        renderItem={renderItem}
        onRefresh={() => void deletedQuery.refetch()}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { gap: Spacing.two, padding: Spacing.four },
  emptyContent: { flexGrow: 1 },
  header: { gap: Spacing.two, paddingBottom: Spacing.three },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  searchRow: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two },
  searchInput: { flex: 1 },
  studentCard: { gap: Spacing.half, paddingVertical: Spacing.two },
  rowAction: { alignSelf: 'flex-start', minHeight: 36, paddingVertical: Spacing.one },
  selectionBar: { gap: Spacing.two },
  loading: { alignItems: 'center', flex: 1, justifyContent: 'center', minHeight: 220 },
});
