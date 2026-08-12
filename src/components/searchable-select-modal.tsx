import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { AppButton, AppTextInput, Card, ScreenState } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type SelectItem = {
  id: string;
  label: string;
  searchText?: string;
};

type BaseModalProps<T extends SelectItem> = {
  emptyMessage: string;
  errorMessage?: string;
  items: T[];
  loading?: boolean;
  onClose: () => void;
  title: string;
  visible: boolean;
};

function useFilteredItems<T extends SelectItem>(items: T[]) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase('vi-VN');
    if (!normalized) return items;
    return items.filter((item) => `${item.label} ${item.searchText ?? ''}`.toLocaleLowerCase('vi-VN').includes(normalized));
  }, [items, search]);

  return { filtered, search, setSearch };
}

function ModalShell({ children, onClose, title, visible }: { children: React.ReactNode; onClose: () => void; title: string; visible: boolean }) {
  const theme = useTheme();
  return (
    <Modal animationType="slide" presentationStyle="overFullScreen" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <SafeAreaView edges={['top', 'bottom']} style={[styles.sheet, { backgroundColor: theme.background }]}>
          <View style={styles.header}>
            <ThemedText type="subtitle" style={styles.title}>{title}</ThemedText>
            <AppButton label="Đóng" variant="secondary" onPress={onClose} />
          </View>
          {children}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

export function SearchableSingleSelectModal<T extends SelectItem>({
  emptyMessage,
  errorMessage,
  items,
  loading = false,
  onClear,
  onClose,
  onSelect,
  selectedId,
  title,
  visible,
}: BaseModalProps<T> & {
  clearLabel?: string;
  onClear?: () => void;
  onSelect: (item: T) => void;
  selectedId: string;
}) {
  return (
    <ModalShell onClose={onClose} title={title} visible={visible}>
      {visible ? <SingleSelectContent
        emptyMessage={emptyMessage}
        errorMessage={errorMessage}
        items={items}
        loading={loading}
        onClear={onClear}
        onSelect={onSelect}
        selectedId={selectedId}
        title={title}
      /> : null}
    </ModalShell>
  );
}

function SingleSelectContent<T extends SelectItem>({
  emptyMessage,
  errorMessage,
  items,
  loading,
  onClear,
  onSelect,
  selectedId,
  title,
}: Omit<BaseModalProps<T>, 'onClose' | 'visible'> & {
  onClear?: () => void;
  onSelect: (item: T) => void;
  selectedId: string;
}) {
  const { filtered, search, setSearch } = useFilteredItems(items);
  return (
    <View style={styles.content}>
        <AppTextInput
          accessibilityLabel={`Tìm ${title.toLocaleLowerCase('vi-VN')}`}
          autoFocus
          placeholder="Tìm theo mã hoặc tên"
          returnKeyType="search"
          value={search}
          onChangeText={setSearch}
        />
        {onClear ? <AppButton label="Chưa xếp lớp" variant={selectedId ? 'secondary' : 'primary'} onPress={onClear} /> : null}
        {errorMessage ? <ScreenState title="Không thể tải danh sách" detail={errorMessage} /> : null}
        {loading ? <View style={styles.loading}><ActivityIndicator size="large" /></View> : null}
        {!loading && !errorMessage ? (
          <FlatList
            contentContainerStyle={filtered.length === 0 ? styles.emptyList : undefined}
            data={filtered}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<ScreenState title="Không có kết quả" detail={emptyMessage} />}
            renderItem={({ item }) => {
              const selected = item.id === selectedId;
              return (
                <Pressable accessibilityLabel={`${selected ? 'Đã chọn' : 'Chưa chọn'}: ${item.label}`} accessibilityRole="button" onPress={() => onSelect(item)}>
                  <Card selected={selected} style={styles.option}>
                    <ThemedText type="smallBold">{selected ? '✓ ' : ''}{item.label}</ThemedText>
                  </Card>
                </Pressable>
              );
            }}
          />
        ) : null}
    </View>
  );
}

export function SearchableMultiSelectModal<T extends SelectItem>({
  emptyMessage,
  errorMessage,
  items,
  loading = false,
  onClose,
  onDone,
  selectedIds,
  title,
  visible,
}: BaseModalProps<T> & {
  onDone: (selectedIds: string[]) => void;
  selectedIds: string[];
}) {
  return (
    <ModalShell onClose={onClose} title={title} visible={visible}>
      {visible ? <MultiSelectContent
        key={selectedIds.join(',')}
        emptyMessage={emptyMessage}
        errorMessage={errorMessage}
        items={items}
        loading={loading}
        onClose={onClose}
        onDone={onDone}
        selectedIds={selectedIds}
        title={title}
      /> : null}
    </ModalShell>
  );
}

function MultiSelectContent<T extends SelectItem>({
  emptyMessage,
  errorMessage,
  items,
  loading,
  onClose,
  onDone,
  selectedIds,
  title,
}: Omit<BaseModalProps<T>, 'onClose' | 'visible'> & {
  onClose: () => void;
  onDone: (selectedIds: string[]) => void;
  selectedIds: string[];
}) {
  const { filtered, search, setSearch } = useFilteredItems(items);
  const [workingIds, setWorkingIds] = useState<string[]>(selectedIds);
  const toggle = (id: string) => {
    setWorkingIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };
  return (
    <View style={styles.content}>
        <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">Đã chọn {workingIds.length} sở thích. Thay đổi chỉ được áp dụng khi chọn “Xong”.</ThemedText>
        <AppTextInput
          accessibilityLabel={`Tìm ${title.toLocaleLowerCase('vi-VN')}`}
          autoFocus
          placeholder="Tìm sở thích"
          returnKeyType="search"
          value={search}
          onChangeText={setSearch}
        />
        {errorMessage ? <ScreenState title="Không thể tải danh sách" detail={errorMessage} /> : null}
        {loading ? <View style={styles.loading}><ActivityIndicator size="large" /></View> : null}
        {!loading && !errorMessage ? (
          <FlatList
            contentContainerStyle={filtered.length === 0 ? styles.emptyList : undefined}
            data={filtered}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<ScreenState title="Không có kết quả" detail={emptyMessage} />}
            renderItem={({ item }) => {
              const selected = workingIds.includes(item.id);
              return (
                <Pressable accessibilityLabel={`${selected ? 'Đã chọn' : 'Chưa chọn'}: ${item.label}`} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => toggle(item.id)}>
                  <Card selected={selected} style={styles.option}>
                    <ThemedText type="smallBold">{selected ? '✓ Đã chọn · ' : '○ Chưa chọn · '}{item.label}</ThemedText>
                  </Card>
                </Pressable>
              );
            }}
          />
        ) : null}
        <View style={styles.actions}>
          <AppButton label="Hủy" variant="secondary" onPress={onClose} />
          <AppButton label={`Xong (${workingIds.length})`} onPress={() => onDone(workingIds)} />
        </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    flex: 1,
    marginTop: Spacing.six,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  title: {
    flex: 1,
    fontSize: 24,
    lineHeight: 32,
  },
  content: {
    flex: 1,
    gap: Spacing.two,
    padding: Spacing.four,
  },
  option: {
    marginBottom: Spacing.two,
    minHeight: 52,
  },
  loading: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  emptyList: {
    flexGrow: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'flex-end',
  },
});
