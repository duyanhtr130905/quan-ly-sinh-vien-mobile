import { ActivityIndicator, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { getClass } from '@/api/classes';
import { ClassForm } from '@/components/class-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
export default function EditClassScreen() { const { id } = useLocalSearchParams<{ id: string }>(); const query = useQuery({ queryKey: ['class', id], queryFn: () => getClass(id), enabled: Boolean(id) }); if (query.isPending) return <ThemedView style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></ThemedView>; if (!query.data?.data) return <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ThemedText>Không thể tải lớp.</ThemedText><Pressable onPress={() => void query.refetch()}><ThemedText type="smallBold">Thử lại</ThemedText></Pressable></ThemedView>; return <ClassForm mode="edit" studentClass={query.data.data} />; }
