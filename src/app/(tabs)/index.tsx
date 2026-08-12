import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, View, type ListRenderItemInfo } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiClientError } from '@/api/api-client';
import { deleteStudents, exportStudents, getStudentPage, type StudentFileFormat, type StudentListItem } from '@/api/students';
import { FileFormatChooser } from '@/components/file-format-chooser';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppButton, AppTextInput, Card, ErrorMessage, PaginationControls, ScreenState } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { shareBinaryFile } from '@/utils/file-sharing';

const PAGE_SIZE = 10;

function apiMessage(error: unknown, fallback: string) {
  return error instanceof ApiClientError
    ? `${error.code ? `${error.code}: ` : ''}${error.message}`
    : fallback;
}

function StudentCard({
  student,
  selecting,
  selected,
  onPress,
}: {
  student: StudentListItem;
  selecting: boolean;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityHint={selecting ? 'Chọn hoặc bỏ chọn sinh viên này' : 'Mở chi tiết sinh viên'}
      accessibilityLabel={`${selecting ? (selected ? 'Đã chọn' : 'Chưa chọn') : 'Sinh viên'}: ${student.fullname}`}
      accessibilityRole="button"
      onPress={onPress}
    >
      <Card selected={selected} style={styles.studentCard}>
        <ThemedText type="smallBold">{selecting ? `${selected ? '✓ Đã chọn · ' : '○ Chưa chọn · '}` : ''}{student.fullname}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">Mã sinh viên: {student.code}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">{student.email}</ThemedText>
      </Card>
    </Pressable>
  );
}

export default function StudentsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [exportFormat, setExportFormat] = useState<StudentFileFormat>('xlsx');
  const studentsQuery = useQuery({
    queryKey: ['students', { page, size: PAGE_SIZE, search }],
    queryFn: () => getStudentPage({ page, size: PAGE_SIZE, search }),
  });
  const pageData = studentsQuery.data?.data;
  const students = pageData?.records ?? [];
  const currentPage = pageData?.page_info.current ?? page;
  const totalPages = pageData?.page_info.total_pages ?? 0;
  const exportMutation = useMutation({
    mutationFn: () => exportStudents(selectedIds, exportFormat).then(shareBinaryFile),
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteStudents(selectedIds),
    onSuccess: async (response) => {
      const deleted = new Set(response.data.deleted.map(String));
      await queryClient.invalidateQueries({ queryKey: ['students'] });
      await queryClient.invalidateQueries({ queryKey: ['deleted-students'] });
      response.data.deleted.forEach((id) => queryClient.removeQueries({ queryKey: ['student', String(id)] }));
      setSelectedIds((current) => current.filter((id) => !deleted.has(id)));
      if (students.length > 0 && students.every((student) => deleted.has(student.id))) {
        setPage((current) => Math.max(1, current - 1));
      }
      Alert.alert(
        'Kết quả xóa',
        `Đã chuyển ${response.data.deleted.length} sinh viên vào danh sách đã xóa.${response.data.notFound.length ? ` Không tìm thấy: ${response.data.notFound.join(', ')}.` : ''}`,
      );
    },
  });

  const submitSearch = () => {
    setSearch(searchInput.trim());
    setPage(1);
  };
  const toggleSelection = (id: string) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };
  const changeSelectionMode = () => {
    setSelectionMode((current) => {
      if (current) setSelectedIds([]);
      return !current;
    });
  };
  const selectPage = () => {
    setSelectedIds((current) => [...new Set([...current, ...students.map((student) => student.id)])]);
  };
  const confirmDelete = () => {
    Alert.alert('Xóa sinh viên đã chọn?', `${selectedIds.length} sinh viên sẽ được chuyển vào danh sách đã xóa.`, [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: () => deleteMutation.mutate() },
    ]);
  };
  const renderItem = ({ item }: ListRenderItemInfo<StudentListItem>) => (
    <StudentCard
      selected={selectedIds.includes(item.id)}
      selecting={selectionMode}
      student={item}
      onPress={() => selectionMode
        ? toggleSelection(item.id)
        : router.push({ pathname: '/students/[id]', params: { id: item.id } })}
    />
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <FlatList
          contentContainerStyle={[styles.listContent, students.length === 0 && styles.emptyContent]}
          data={students}
          keyExtractor={(student) => student.id}
          ListEmptyComponent={studentsQuery.isPending ? (
            <View style={styles.loading}><ActivityIndicator size="large" /></View>
          ) : studentsQuery.isError ? (
            <ScreenState title="Không thể tải danh sách" detail={apiMessage(studentsQuery.error, 'Không thể tải danh sách sinh viên.')} actionLabel="Thử lại" onAction={() => void studentsQuery.refetch()} />
          ) : (
            <ScreenState title="Không có sinh viên phù hợp" detail="Thử thay đổi từ khóa tìm kiếm hoặc thêm sinh viên mới." />
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
              <ThemedText type="subtitle">Sinh viên</ThemedText>
              <ThemedText themeColor="textSecondary">Tìm theo tên hoặc email. Kéo xuống để làm mới danh sách.</ThemedText>
              <View style={styles.actions}>
                <AppButton label="Thêm sinh viên" onPress={() => router.push('/students/new')} />
                <AppButton label="Đã xóa" variant="secondary" onPress={() => router.push('/students/deleted')} />
                <AppButton label="Nhập" variant="secondary" onPress={() => router.push('/students/import')} />
                <AppButton label={selectionMode ? 'Xong chọn' : 'Chọn nhiều'} variant="secondary" onPress={changeSelectionMode} />
              </View>
              {selectionMode ? (
                <Card style={styles.selectionBar}>
                  <ThemedText type="smallBold" accessibilityLiveRegion="polite">Đang chọn · {selectedIds.length} sinh viên</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">Lựa chọn được giữ khi chuyển trang và sẽ được xóa khi bạn thoát chế độ chọn.</ThemedText>
                  <View style={styles.actions}>
                    <AppButton label="Chọn trang này" variant="secondary" onPress={selectPage} />
                    <AppButton label="Bỏ chọn" variant="secondary" onPress={() => setSelectedIds([])} />
                    {selectedIds.length ? <AppButton label="Sao chép" onPress={() => router.push({ pathname: '/students/copy-preview', params: { ids: selectedIds.join(',') } })} /> : null}
                  </View>
                  {selectedIds.length ? (
                    <>
                      <ThemedText type="smallBold">Xuất dữ liệu đã chọn</ThemedText>
                      <FileFormatChooser value={exportFormat} onChange={setExportFormat} />
                      <View style={styles.actions}>
                        <AppButton disabled={exportMutation.isPending} label={exportMutation.isPending ? 'Đang chuẩn bị...' : 'Xuất'} onPress={() => exportMutation.mutate()} />
                        <AppButton disabled={deleteMutation.isPending} label={deleteMutation.isPending ? 'Đang xóa...' : 'Xóa'} variant="danger" onPress={confirmDelete} />
                      </View>
                    </>
                  ) : null}
                  {exportMutation.isError ? <ErrorMessage>{apiMessage(exportMutation.error, 'Không thể xuất tệp.')}</ErrorMessage> : null}
                  {deleteMutation.isError ? <ErrorMessage>{apiMessage(deleteMutation.error, 'Không thể xóa sinh viên.')}</ErrorMessage> : null}
                </Card>
              ) : null}
              <View style={styles.searchRow}>
                <AppTextInput
                  accessibilityLabel="Tìm sinh viên theo tên hoặc email"
                  returnKeyType="search"
                  value={searchInput}
                  placeholder="Nhập tên hoặc email"
                  onChangeText={setSearchInput}
                  onSubmitEditing={submitSearch}
                  style={styles.searchInput}
                />
                <AppButton label="Tìm" onPress={submitSearch} />
              </View>
            </View>
          )}
          refreshing={studentsQuery.isRefetching}
          renderItem={renderItem}
          onRefresh={() => void studentsQuery.refetch()}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { gap: Spacing.two, padding: Spacing.four },
  emptyContent: { flexGrow: 1 },
  header: { gap: Spacing.two, paddingBottom: Spacing.three },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  searchRow: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two },
  searchInput: { flex: 1 },
  studentCard: { gap: Spacing.half },
  selectionBar: { gap: Spacing.two },
  loading: { alignItems: 'center', flex: 1, justifyContent: 'center', minHeight: 220 },
});
