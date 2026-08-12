import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { ApiClientError } from '@/api/api-client';
import { getStudent } from '@/api/students';
import { StudentForm } from '@/components/student-form';
import { ThemedView } from '@/components/themed-view';
import { ScreenState } from '@/components/ui';
import { Spacing } from '@/constants/theme';

export default function EditStudentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const studentQuery = useQuery({
    queryKey: ['student', id],
    queryFn: () => getStudent(id),
    enabled: Boolean(id),
  });

  if (studentQuery.isPending) {
    return <CenteredState><ActivityIndicator size="large" /></CenteredState>;
  }

  if (studentQuery.isError) {
    const message = studentQuery.error instanceof ApiClientError ? studentQuery.error.message : 'Không thể tải sinh viên.';
    return <CenteredState><ScreenState title="Không thể mở biểu mẫu" detail={message} actionLabel="Thử lại" onAction={() => void studentQuery.refetch()} /></CenteredState>;
  }

  return <StudentForm key={studentQuery.data.data.id} mode="edit" student={studentQuery.data.data} />;
}

function CenteredState({ children }: { children: React.ReactNode }) {
  return <ThemedView style={styles.centered}>{children}</ThemedView>;
}

const styles = StyleSheet.create({
  centered: { alignItems: 'center', flex: 1, gap: Spacing.two, justifyContent: 'center', padding: Spacing.four },
});
