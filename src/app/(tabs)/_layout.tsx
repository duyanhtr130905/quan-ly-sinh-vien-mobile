import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: 'Sinh viên' }} />
      <Tabs.Screen name="classes" options={{ title: 'Lớp' }} />
    </Tabs>
  );
}
