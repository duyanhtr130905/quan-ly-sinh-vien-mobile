import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
    },
  },
});

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="classes/new" options={{ title: 'Thêm lớp' }} />
          <Stack.Screen name="classes/[id]" options={{ title: 'Chi tiết lớp' }} />
          <Stack.Screen name="classes/[id]/edit" options={{ title: 'Sửa lớp' }} />
          <Stack.Screen name="classes/[id]/membership" options={{ title: 'Sinh viên thuộc lớp' }} />
          <Stack.Screen name="classes/[id]/membership/add" options={{ title: 'Thêm sinh viên vào lớp' }} />
          <Stack.Screen name="students/new" options={{ title: 'Thêm sinh viên' }} />
          <Stack.Screen name="students/[id]" options={{ title: 'Chi tiết sinh viên' }} />
          <Stack.Screen name="students/[id]/edit" options={{ title: 'Sửa sinh viên' }} />
          <Stack.Screen name="students/deleted" options={{ title: 'Sinh viên đã xóa' }} />
        </Stack>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
