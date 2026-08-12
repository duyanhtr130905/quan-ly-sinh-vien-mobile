import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, View, type ListRenderItemInfo } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiClientError } from '@/api/api-client';
import { deleteClasses, exportClasses, getClassPage, type ClassFileFormat, type ClassListItem } from '@/api/classes';
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

function ClassCard({ item, selecting, selected, onPress }: {
  item: ClassListItem;
  selecting: boolean;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityHint={selecting ? 'Chọn hoặc bỏ chọn lớp này' : 'Mở chi tiết lớp'}
      accessibilityLabel={`${selecting ? (selected ? 'Đã chọn' : 'Chưa chọn') : 'Lớp'}: ${item.code}, ${item.name}`}
      accessibilityRole="button"
      onPress={onPress}
    >
      <Card selected={selected} style={styles.classCard}>
        <ThemedText type="smallBold">{selecting ? `${selected ? '✓ Đã chọn · ' : '○ Chưa chọn · '}` : ''}{item.code} — {item.name}</ThemedText>
        {item.description ? <ThemedText type="small" themeColor="textSecondary">{item.description}</ThemedText> : null}
        <ThemedText type="small" themeColor="textSecondary">{Number(item.student_count)} sinh viên</ThemedText>
      </Card>
    </Pressable>
  );
}

export default function ClassesScreen() {
  const router = useRouter();
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [format, setFormat] = useState<ClassFileFormat>('xlsx');
  const query = useQuery({
    queryKey: ['classes', { page, size: PAGE_SIZE, search }],
    queryFn: () => getClassPage({ page, size: PAGE_SIZE, search }),
  });
  const data = query.data?.data;
  const records = data?.records ?? [];
  const current = data?.page_info.current ?? page;
  const total = data?.page_info.total_pages ?? 0;
  const exportMutation = useMutation({
    mutationFn: () => exportClasses(selected, format).then(shareBinaryFile),
  });
  const removeMutation = useMutation({
    mutationFn: () => deleteClasses(selected),
    onSuccess: async (response) => {
      const deleted = new Set(response.data.deletedIds.map(String));
      await client.invalidateQueries({ queryKey: ['classes'] });
      response.data.deletedIds.forEach((id) => client.removeQueries({ queryKey: ['class', String(id)] }));
      setSelected((items) => items.filter((id) => !deleted.has(id)));
      if (records.length > 0 && records.every((record) => deleted.has(record.id))) {
        setPage((currentPage) => Math.max(1, currentPage - 1));
      }
      Alert.alert(
        'Kết quả xóa',
        `Đã xóa ${response.data.deletedIds.length} lớp.${response.data.blockedIds.length ? ` Không thể xóa ${response.data.blockedIds.length} lớp còn sinh viên: ${response.data.blockedIds.join(', ')}.` : ''}`,
      );
    },
  });
  const submit = () => {
    setSearch(input.trim());
    setPage(1);
  };
  const toggle = (id: string) => {
    setSelected((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  };
  const changeSelectionMode = () => {
    setSelecting((current) => {
      if (current) setSelected([]);
      return !current;
    });
  };
  const selectPage = () => {
    setSelected((items) => [...new Set([...items, ...records.map((record) => record.id)])]);
  };
  const confirmDelete = () => {
    Alert.alert(
      'Xóa lớp đã chọn?',
      `${selected.length} lớp được gửi xóa. Những lớp còn sinh viên sẽ bị chặn; các lớp khác vẫn có thể bị xóa.`,
      [{ text: 'Hủy', style: 'cancel' }, { text: 'Xóa', style: 'destructive', onPress: () => removeMutation.mutate() }],
    );
  };
  const renderItem = ({ item }: ListRenderItemInfo<ClassListItem>) => (
    <ClassCard
      item={item}
      selected={selected.includes(item.id)}
      selecting={selecting}
      onPress={() => selecting ? toggle(item.id) : router.push({ pathname: '/classes/[id]', params: { id: item.id } } as never)}
    />
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <FlatList
          contentContainerStyle={[styles.content, records.length === 0 && styles.empty]}
          data={records}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={query.isPending ? (
            <View style={styles.loading}><ActivityIndicator size="large" /></View>
          ) : query.isError ? (
            <ScreenState title="Không thể tải danh sách" detail={apiMessage(query.error, 'Không thể tải danh sách lớp.')} actionLabel="Thử lại" onAction={() => void query.refetch()} />
          ) : (
            <ScreenState title="Không có lớp phù hợp" detail="Thử thay đổi từ khóa tìm kiếm hoặc thêm lớp mới." />
          )}
          ListFooterComponent={data ? (
            <PaginationControls
              currentPage={current}
              itemLabel="lớp"
              onNext={() => setPage((value) => value + 1)}
              onPrevious={() => setPage((value) => Math.max(1, value - 1))}
              totalItems={data.page_info.total_items}
              totalPages={total}
            />
          ) : null}
          ListHeaderComponent={(
            <View style={styles.header}>
              <ThemedText type="subtitle">Lớp</ThemedText>
              <ThemedText themeColor="textSecondary">Tìm theo mã, tên hoặc mô tả. Kéo xuống để làm mới danh sách.</ThemedText>
              <View style={styles.actions}>
                <AppButton label="Thêm lớp" onPress={() => router.push('/classes/new' as never)} />
                <AppButton label="Nhập" variant="secondary" onPress={() => router.push('/classes/import' as never)} />
                <AppButton label={selecting ? 'Xong chọn' : 'Chọn nhiều'} variant="secondary" onPress={changeSelectionMode} />
              </View>
              {selecting ? (
                <Card style={styles.selection}>
                  <ThemedText type="smallBold" accessibilityLiveRegion="polite">Đang chọn · {selected.length} lớp</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">Lựa chọn được giữ khi chuyển trang và sẽ được xóa khi bạn thoát chế độ chọn.</ThemedText>
                  <View style={styles.actions}>
                    <AppButton label="Chọn trang này" variant="secondary" onPress={selectPage} />
                    <AppButton label="Bỏ chọn" variant="secondary" onPress={() => setSelected([])} />
                    {selected.length ? <AppButton label="Sao chép" onPress={() => router.push({ pathname: '/classes/copy-preview', params: { ids: selected.join(',') } } as never)} /> : null}
                  </View>
                  {selected.length ? (
                    <>
                      <ThemedText type="smallBold">Xuất dữ liệu đã chọn</ThemedText>
                      <FileFormatChooser value={format} onChange={setFormat} />
                      <View style={styles.actions}>
                        <AppButton disabled={exportMutation.isPending} label={exportMutation.isPending ? 'Đang chuẩn bị...' : 'Xuất'} onPress={() => exportMutation.mutate()} />
                        <AppButton disabled={removeMutation.isPending} label={removeMutation.isPending ? 'Đang xóa...' : 'Xóa'} variant="danger" onPress={confirmDelete} />
                      </View>
                    </>
                  ) : null}
                  {exportMutation.isError ? <ErrorMessage>{apiMessage(exportMutation.error, 'Không thể xuất tệp.')}</ErrorMessage> : null}
                  {removeMutation.isError ? <ErrorMessage>{apiMessage(removeMutation.error, 'Không thể xóa lớp.')}</ErrorMessage> : null}
                </Card>
              ) : null}
              <View style={styles.searchRow}>
                <AppTextInput
                  accessibilityLabel="Tìm lớp theo mã, tên hoặc mô tả"
                  placeholder="Nhập mã, tên hoặc mô tả"
                  returnKeyType="search"
                  value={input}
                  onChangeText={setInput}
                  onSubmitEditing={submit}
                  style={styles.searchInput}
                />
                <AppButton label="Tìm" onPress={submit} />
              </View>
            </View>
          )}
          refreshing={query.isRefetching}
          renderItem={renderItem}
          onRefresh={() => void query.refetch()}
        />
      </SafeAreaView>
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
  classCard: { gap: Spacing.one },
  selection: { gap: Spacing.two },
  loading: { alignItems: 'center', flex: 1, justifyContent: 'center', minHeight: 220 },
});
