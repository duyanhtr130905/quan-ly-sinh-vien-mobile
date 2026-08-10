import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Tabs, ThemeProvider } from 'expo-router';
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
        <Tabs>
          <Tabs.Screen name="index" options={{ title: 'Sinh viên' }} />
          <Tabs.Screen name="classes" options={{ title: 'Lớp' }} />
        </Tabs>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
