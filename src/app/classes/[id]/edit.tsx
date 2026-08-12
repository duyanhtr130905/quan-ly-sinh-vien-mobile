import { ActivityIndicator, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';

import { ApiClientError } from '@/api/api-client';
import { getClass } from '@/api/classes';
import { ClassForm } from '@/components/class-form';
import { ThemedView } from '@/components/themed-view';
import { ScreenState } from '@/components/ui';
import { Spacing } from '@/constants/theme';

export default function EditClassScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useQuery({ queryKey: ['class', id], queryFn: () => getClass(id), enabled: Boolean(id) });

  if (query.isPending) {
    return <ThemedView style={styles.center}><ActivityIndicator size="large" /></ThemedView>;
  }

  if (!query.data?.data) {
    const message = query.error instanceof ApiClientError ? query.error.message : 'Không thể tải lớp.';
    return <ThemedView style={styles.center}><ScreenState title="Không thể mở biểu mẫu" detail={message} actionLabel="Thử lại" onAction={() => void query.refetch()} /></ThemedView>;
  }

  return <ClassForm mode="edit" studentClass={query.data.data} />;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: Spacing.four },
});
