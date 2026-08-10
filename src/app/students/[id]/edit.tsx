import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { ApiClientError } from '@/api/api-client';
import { getStudent } from '@/api/students';
import { StudentForm } from '@/components/student-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
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
    return (
      <CenteredState>
        <ThemedText type="smallBold">Không thể mở biểu mẫu</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">{message}</ThemedText>
        <Pressable onPress={() => void studentQuery.refetch()}><ThemedText type="smallBold">Thử lại</ThemedText></Pressable>
      </CenteredState>
    );
  }

  return <StudentForm key={studentQuery.data.data.id} mode="edit" student={studentQuery.data.data} />;
}

function CenteredState({ children }: { children: React.ReactNode }) {
  return <ThemedView style={styles.centered}>{children}</ThemedView>;
}

const styles = StyleSheet.create({
  centered: { alignItems: 'center', flex: 1, gap: Spacing.two, justifyContent: 'center', padding: Spacing.four },
});
