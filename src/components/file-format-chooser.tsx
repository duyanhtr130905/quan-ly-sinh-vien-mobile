import { StyleSheet, View } from 'react-native';

import type { StudentFileFormat } from '@/api/students';
import { AppButton } from '@/components/ui';
import { Spacing } from '@/constants/theme';

const formats: StudentFileFormat[] = ['xlsx', 'csv', 'json', 'xml'];

export function FileFormatChooser({ value, onChange }: { value: StudentFileFormat; onChange: (format: StudentFileFormat) => void }) {
  return (
    <View style={styles.row}>
      {formats.map((format) => (
        <AppButton
          key={format}
          accessibilityLabel={`Chọn định dạng ${format.toUpperCase()}`}
          label={format.toUpperCase()}
          onPress={() => onChange(format)}
          variant={value === format ? 'primary' : 'secondary'}
          style={styles.choice}
        />
      ))}
    </View>
  );
}

export const FILE_FORMATS = formats;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  choice: { minHeight: 40, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one },
});
