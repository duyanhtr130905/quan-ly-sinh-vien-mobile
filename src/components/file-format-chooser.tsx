import { Pressable, StyleSheet, View } from 'react-native';

import type { StudentFileFormat } from '@/api/students';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

const formats: StudentFileFormat[] = ['xlsx', 'csv', 'json', 'xml'];

export function FileFormatChooser({ value, onChange }: { value: StudentFileFormat; onChange: (format: StudentFileFormat) => void }) {
  return (
    <View style={styles.row}>
      {formats.map((format) => (
        <Pressable key={format} onPress={() => onChange(format)} style={[styles.choice, value === format && styles.selected]}>
          <ThemedText type="smallBold" style={value === format && styles.selectedText}>{format.toUpperCase()}</ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

export const FILE_FORMATS = formats;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  choice: { borderColor: '#0A7EA4', borderRadius: Spacing.two, borderWidth: 1, paddingHorizontal: Spacing.two, paddingVertical: Spacing.two },
  selected: { backgroundColor: '#0A7EA4' },
  selectedText: { color: '#FFFFFF' },
});
