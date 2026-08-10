import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  type ListRenderItemInfo,
} from 'react-native';

import { ApiClientError } from '@/api/api-client';
import {
  getDeletedStudentPage,
  permanentlyDeleteStudents,
  restoreStudents,
  type StudentListItem,
} from '@/api/students';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const PAGE_SIZE = 10;

function errorMessage(error: unknown) {
  if (error instanceof ApiClientError) return `${error.code ? `${error.code}: ` : ''}${error.message}`;
  return 'Không thể tải danh sách sinh viên đã xóa.';
}

export default function DeletedStudentsScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const deletedQuery = useQuery({
    queryKey: ['deleted-students', { page, size: PAGE_SIZE, search }],
    queryFn: () => getDeletedStudentPage({ page, size: PAGE_SIZE, search }),
  });
  const pageData = deletedQuery.data?.data;
  const students = pageData?.records ?? [];
  const currentPage = pageData?.page_info.current ?? page;
  const totalPages = pageData?.page_info.total_pages ?? 0;

  const refreshLists = async () => {
    await queryClient.invalidateQueries({ queryKey: ['students'] });
    await queryClient.invalidateQueries({ queryKey: ['deleted-students'] });
  };

  const restoreMutation = useMutation({
    mutationFn: (id: number) => restoreStudents([id]),
    onSuccess: async (response) => {
      await refreshLists();
      const { restored, conflicts, notFound } = response.data;
      const parts = [
        restored.length ? `Đã khôi phục ${restored.length} sinh viên.` : '',
        conflicts.length ? `Không thể khôi phục do trùng code/email/username: ${conflicts.join(', ')}.` : '',
        notFound.length ? `Không tìm thấy: ${notFound.join(', ')}.` : '',
      ].filter(Boolean);
      Alert.alert('Khôi phục sinh viên', parts.join('\n'));
    },
  });

  const permanentMutation = useMutation({
    mutationFn: (id: number) => permanentlyDeleteStudents([id]),
    onSuccess: async (response) => {
      await refreshLists();
      const { deleted, notFound } = response.data;
      Alert.alert('Xóa vĩnh viễn', deleted.length ? 'Đã xóa vĩnh viễn sinh viên.' : `Không tìm thấy: ${notFound.join(', ')}.`);
    },
  });

  const submitSearch = () => {
    setSearch(searchInput.trim());
    setPage(1);
  };

  const confirmRestore = (student: StudentListItem) => {
    const id = Number(student.id);
    Alert.alert('Khôi phục sinh viên?', `${student.fullname} sẽ trở lại danh sách đang hoạt động.`, [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Khôi phục', onPress: () => restoreMutation.mutate(id) },
    ]);
  };

  const confirmPermanentDelete = (student: StudentListItem) => {
    const id = Number(student.id);
    Alert.alert('Xóa vĩnh viễn?', `Không thể khôi phục ${student.fullname} sau thao tác này.`, [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa vĩnh viễn', style: 'destructive', onPress: () => permanentMutation.mutate(id) },
    ]);
  };

  const renderItem = ({ item }: ListRenderItemInfo<StudentListItem>) => (
    <ThemedView type="backgroundElement" style={styles.studentCard}>
      <ThemedText type="smallBold">{item.fullname}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">Mã sinh viên: {item.code}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">{item.email}</ThemedText>
      <ThemedView style={styles.cardActions}>
        <Pressable disabled={restoreMutation.isPending || permanentMutation.isPending} onPress={() => confirmRestore(item)} style={styles.restoreButton}><ThemedText type="smallBold" style={styles.restoreText}>Khôi phục</ThemedText></Pressable>
        <Pressable disabled={restoreMutation.isPending || permanentMutation.isPending} onPress={() => confirmPermanentDelete(item)} style={styles.permanentButton}><ThemedText type="smallBold" style={styles.permanentText}>Xóa vĩnh viễn</ThemedText></Pressable>
      </ThemedView>
    </ThemedView>
  );

  const renderEmpty = () => {
    if (deletedQuery.isPending) return <ActivityIndicator color={theme.text} size="large" />;
    if (deletedQuery.isError) {
      return (
        <ThemedView type="backgroundElement" style={styles.stateCard}>
          <ThemedText type="smallBold">Đã xảy ra lỗi</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{errorMessage(deletedQuery.error)}</ThemedText>
          <Pressable onPress={() => void deletedQuery.refetch()}><ThemedText type="smallBold">Thử lại</ThemedText></Pressable>
        </ThemedView>
      );
    }
    return <ThemedView type="backgroundElement" style={styles.stateCard}><ThemedText type="small">Không có sinh viên đã xóa phù hợp.</ThemedText></ThemedView>;
  };

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={students}
        keyExtractor={(student) => student.id}
        renderItem={renderItem}
        ListHeaderComponent={
          <ThemedView style={styles.header}>
            <ThemedText themeColor="textSecondary">Tìm theo tên hoặc email.</ThemedText>
            <ThemedView style={styles.searchRow}>
              <TextInput value={searchInput} onChangeText={setSearchInput} onSubmitEditing={submitSearch} placeholder="Nhập tên hoặc email" placeholderTextColor={theme.textSecondary} returnKeyType="search" style={[styles.searchInput, { borderColor: theme.backgroundSelected, color: theme.text }]} />
              <Pressable onPress={submitSearch} style={styles.searchButton}><ThemedText type="smallBold" style={styles.restoreText}>Tìm</ThemedText></Pressable>
            </ThemedView>
            {restoreMutation.isError ? <ThemedText type="small" style={styles.errorText}>{errorMessage(restoreMutation.error)}</ThemedText> : null}
            {permanentMutation.isError ? <ThemedText type="small" style={styles.errorText}>{errorMessage(permanentMutation.error)}</ThemedText> : null}
          </ThemedView>
        }
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={
          pageData ? (
            <ThemedView style={styles.pagination}>
              <Pressable disabled={currentPage <= 1} onPress={() => setPage((current) => Math.max(1, current - 1))} style={[styles.paginationButton, currentPage <= 1 && styles.disabledButton]}><ThemedText type="smallBold">Trước</ThemedText></Pressable>
              <ThemedText type="small" themeColor="textSecondary">Trang {currentPage}/{totalPages || 1} · {pageData.page_info.total_items} sinh viên</ThemedText>
              <Pressable disabled={totalPages === 0 || currentPage >= totalPages} onPress={() => setPage((current) => current + 1)} style={[styles.paginationButton, (totalPages === 0 || currentPage >= totalPages) && styles.disabledButton]}><ThemedText type="smallBold">Sau</ThemedText></Pressable>
            </ThemedView>
          ) : null
        }
        contentContainerStyle={[styles.content, students.length === 0 && styles.emptyContent]}
        refreshing={deletedQuery.isRefetching}
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
  searchRow: { flexDirection: 'row', gap: Spacing.two },
  searchInput: { borderWidth: 1, borderRadius: Spacing.two, flex: 1, fontSize: 16, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  searchButton: { alignItems: 'center', backgroundColor: '#0A7EA4', borderRadius: Spacing.two, justifyContent: 'center', paddingHorizontal: Spacing.three },
  studentCard: { gap: Spacing.half, padding: Spacing.three, borderRadius: Spacing.two },
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.two },
  restoreButton: { backgroundColor: '#0A7EA4', borderRadius: Spacing.two, paddingHorizontal: Spacing.two, paddingVertical: Spacing.two },
  restoreText: { color: '#FFFFFF' },
  permanentButton: { backgroundColor: '#B42318', borderRadius: Spacing.two, paddingHorizontal: Spacing.two, paddingVertical: Spacing.two },
  permanentText: { color: '#FFFFFF' },
  stateCard: { alignItems: 'center', gap: Spacing.two, marginTop: Spacing.four, padding: Spacing.four, borderRadius: Spacing.two },
  pagination: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingTop: Spacing.three },
  paginationButton: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.two },
  disabledButton: { opacity: 0.4 },
  errorText: { color: '#B42318' },
});
