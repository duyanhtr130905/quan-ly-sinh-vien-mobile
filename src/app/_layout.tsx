import { DarkTheme, DefaultTheme, Tabs, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Tabs>
        <Tabs.Screen name="index" options={{ title: 'Sinh viên' }} />
        <Tabs.Screen name="classes" options={{ title: 'Lớp' }} />
      </Tabs>
    </ThemeProvider>
  );
}
