import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getHealth, type HealthResponse } from '@/api/health';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

type HealthState =
  | { status: 'loading' }
  | { status: 'success'; health: HealthResponse }
  | { status: 'error'; message: string };

export default function StudentsScreen() {
  const [healthState, setHealthState] = useState<HealthState>({ status: 'loading' });

  useEffect(() => {
    let isMounted = true;

    getHealth()
      .then((health) => {
        if (isMounted) {
          setHealthState({ status: 'success', health });
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setHealthState({
            status: 'error',
            message: error instanceof Error ? error.message : 'Unable to reach the API.',
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle">Sinh viên</ThemedText>
        <ThemedText themeColor="textSecondary">Danh sách sinh viên sẽ hiển thị tại đây.</ThemedText>

        <ThemedView type="backgroundElement" style={styles.healthCard}>
          <ThemedText type="smallBold">Kết nối máy chủ</ThemedText>
          {healthState.status === 'loading' && <ThemedText type="small">Đang kiểm tra...</ThemedText>}
          {healthState.status === 'success' && (
            <ThemedText type="small">
              {healthState.health.status}: {healthState.health.message}
            </ThemedText>
          )}
          {healthState.status === 'error' && (
            <ThemedText type="small" themeColor="textSecondary">
              Không thể kết nối: {healthState.message}
            </ThemedText>
          )}
        </ThemedView>
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
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  healthCard: {
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Spacing.two,
  },
});
