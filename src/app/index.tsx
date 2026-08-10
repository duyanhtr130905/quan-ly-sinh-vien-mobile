import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  type ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiClientError } from '@/api/api-client';
import { getStudentPage, type StudentListItem } from '@/api/students';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const PAGE_SIZE = 10;

function StudentCard({ student }: { student: StudentListItem }) {
  return (
    <ThemedView type="backgroundElement" style={styles.studentCard}>
      <ThemedText type="smallBold">{student.fullname}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Mã sinh viên: {student.code}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {student.email}
      </ThemedText>
    </ThemedView>
  );
}

export default function StudentsScreen() {
  const theme = useTheme();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const studentsQuery = useQuery({
    queryKey: ['students', { page, size: PAGE_SIZE, search }],
    queryFn: () => getStudentPage({ page, size: PAGE_SIZE, search }),
  });
  const pageData = studentsQuery.data?.data;
  const students = pageData?.records ?? [];
  const currentPage = pageData?.page_info.current ?? page;
  const totalPages = pageData?.page_info.total_pages ?? 0;
  const canGoPrevious = currentPage > 1;
  const canGoNext = totalPages > 0 && currentPage < totalPages;

  const submitSearch = () => {
    setSearch(searchInput.trim());
    setPage(1);
  };

  const renderItem = ({ item }: ListRenderItemInfo<StudentListItem>) => <StudentCard student={item} />;
  const renderEmpty = () => {
    if (studentsQuery.isPending) {
      return <ActivityIndicator color={theme.text} size="large" />;
    }

    if (studentsQuery.isError) {
      const message =
        studentsQuery.error instanceof ApiClientError
          ? `${studentsQuery.error.code ? `${studentsQuery.error.code}: ` : ''}${studentsQuery.error.message}`
          : 'Không thể tải danh sách sinh viên.';

      return (
        <ThemedView type="backgroundElement" style={styles.stateCard}>
          <ThemedText type="smallBold">Đã xảy ra lỗi</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {message}
          </ThemedText>
          <Pressable onPress={() => void studentsQuery.refetch()} style={styles.retryButton}>
            <ThemedText type="smallBold">Thử lại</ThemedText>
          </Pressable>
        </ThemedView>
      );
    }

    return (
      <ThemedView type="backgroundElement" style={styles.stateCard}>
        <ThemedText type="small">Không có sinh viên phù hợp.</ThemedText>
      </ThemedView>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <FlatList
          data={students}
          keyExtractor={(student) => String(student.id)}
          renderItem={renderItem}
          ListHeaderComponent={
            <ThemedView style={styles.header}>
              <ThemedText type="subtitle">Sinh viên</ThemedText>
              <ThemedText themeColor="textSecondary">Tìm theo tên hoặc email.</ThemedText>
              <ThemedView style={styles.searchRow}>
                <TextInput
                  value={searchInput}
                  onChangeText={setSearchInput}
                  onSubmitEditing={submitSearch}
                  placeholder="Nhập tên hoặc email"
                  placeholderTextColor={theme.textSecondary}
                  returnKeyType="search"
                  style={[styles.searchInput, { borderColor: theme.backgroundSelected, color: theme.text }]}
                />
                <Pressable onPress={submitSearch} style={styles.searchButton}>
                  <ThemedText type="smallBold" style={styles.searchButtonText}>
                    Tìm
                  </ThemedText>
                </Pressable>
              </ThemedView>
            </ThemedView>
          }
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={
            pageData ? (
              <ThemedView style={styles.pagination}>
                <Pressable
                  disabled={!canGoPrevious}
                  onPress={() => setPage((current) => Math.max(1, current - 1))}
                  style={[styles.paginationButton, !canGoPrevious && styles.disabledButton]}>
                  <ThemedText type="smallBold">Trước</ThemedText>
                </Pressable>
                <ThemedText type="small" themeColor="textSecondary">
                  Trang {currentPage}/{totalPages || 1} · {pageData.page_info.total_items} sinh viên
                </ThemedText>
                <Pressable
                  disabled={!canGoNext}
                  onPress={() => setPage((current) => current + 1)}
                  style={[styles.paginationButton, !canGoNext && styles.disabledButton]}>
                  <ThemedText type="smallBold">Sau</ThemedText>
                </Pressable>
              </ThemedView>
            ) : null
          }
          contentContainerStyle={[styles.listContent, students.length === 0 && styles.emptyContent]}
          refreshing={studentsQuery.isRefetching}
          onRefresh={() => void studentsQuery.refetch()}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  listContent: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  emptyContent: {
    flexGrow: 1,
  },
  header: {
    gap: Spacing.two,
    paddingBottom: Spacing.three,
  },
  searchRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  searchButton: {
    alignItems: 'center',
    backgroundColor: '#0A7EA4',
    borderRadius: Spacing.two,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  searchButtonText: {
    color: '#FFFFFF',
  },
  studentCard: {
    gap: Spacing.half,
    padding: Spacing.three,
    borderRadius: Spacing.two,
  },
  stateCard: {
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.four,
    padding: Spacing.four,
    borderRadius: Spacing.two,
  },
  retryButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  pagination: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: Spacing.three,
  },
  paginationButton: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },
  disabledButton: {
    opacity: 0.4,
  },
});
