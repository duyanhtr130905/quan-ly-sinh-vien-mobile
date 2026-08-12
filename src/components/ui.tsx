import type { ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View, type PressableProps, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

type AppButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: ButtonVariant;
  style?: StyleProp<ViewStyle>;
};

export function AppButton({
  label,
  variant = 'primary',
  disabled,
  style,
  accessibilityLabel,
  ...props
}: AppButtonProps) {
  const theme = useTheme();
  const colors = variant === 'danger'
    ? { backgroundColor: theme.danger, borderColor: theme.danger, color: theme.dangerText }
    : variant === 'primary'
      ? { backgroundColor: theme.primary, borderColor: theme.primary, color: theme.primaryText }
      : { backgroundColor: 'transparent', borderColor: theme.primary, color: theme.text };

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        colors,
        variant === 'secondary' && styles.secondary,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
      {...props}
    >
      <ThemedText type="smallBold" style={{ color: colors.color }}>{label}</ThemedText>
    </Pressable>
  );
}

export function Card({ children, selected = false, style }: { children: ReactNode; selected?: boolean; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return <ThemedView type="backgroundElement" style={[styles.card, selected && { borderColor: theme.primary, borderWidth: 2 }, style]}>{children}</ThemedView>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <ThemedText type="smallBold">{children}</ThemedText>;
}

export function FormField({ label, required = false, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}{required ? ' *' : ''}</ThemedText>
      {children}
    </View>
  );
}

export function AppTextInput({ style, placeholderTextColor, ...props }: TextInputProps) {
  const theme = useTheme();

  return (
    <TextInput
      placeholderTextColor={placeholderTextColor ?? theme.textSecondary}
      style={[styles.input, { borderColor: theme.border, color: theme.text }, style]}
      {...props}
    />
  );
}

export function ScreenState({
  title,
  detail,
  actionLabel,
  onAction,
}: {
  title: string;
  detail?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <Card style={styles.state}>
      <ThemedText type="smallBold">{title}</ThemedText>
      {detail ? <ThemedText type="small" themeColor="textSecondary">{detail}</ThemedText> : null}
      {actionLabel && onAction ? <AppButton label={actionLabel} variant="secondary" onPress={onAction} /> : null}
    </Card>
  );
}

export function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  itemLabel,
  onPrevious,
  onNext,
}: {
  currentPage: number;
  totalPages: number;
  totalItems?: number;
  itemLabel?: string;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const pageCount = totalPages || 1;
  const suffix = totalItems === undefined ? '' : ` · ${totalItems}${itemLabel ? ` ${itemLabel}` : ''}`;

  return (
    <View style={styles.pagination}>
      <AppButton label="Trước" variant="secondary" disabled={currentPage <= 1} onPress={onPrevious} />
      <ThemedText type="small" accessibilityLiveRegion="polite">Trang {currentPage}/{pageCount}{suffix}</ThemedText>
      <AppButton label="Sau" variant="secondary" disabled={totalPages === 0 || currentPage >= totalPages} onPress={onNext} />
    </View>
  );
}

export function StatusBadge({ status }: { status: 'valid' | 'invalid' | 'pending' }) {
  const theme = useTheme();
  const content = status === 'valid'
    ? { label: 'Hợp lệ', color: theme.success }
    : status === 'invalid'
      ? { label: 'Cần sửa', color: theme.danger }
      : { label: 'Chưa kiểm tra', color: theme.warning };

  return (
    <View style={[styles.badge, { borderColor: content.color }]} accessibilityLabel={`Trạng thái: ${content.label}`}>
      <ThemedText type="smallBold" style={{ color: content.color }}>{content.label}</ThemedText>
    </View>
  );
}

export function ErrorMessage({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <ThemedText type="small" style={{ color: theme.danger }}>{children}</ThemedText>;
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: Spacing.two,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  secondary: {
    backgroundColor: 'transparent',
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.45,
  },
  card: {
    borderRadius: Spacing.two,
    gap: Spacing.two,
    padding: Spacing.three,
  },
  field: {
    gap: Spacing.one,
  },
  input: {
    borderRadius: Spacing.two,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  state: {
    alignItems: 'center',
    marginTop: Spacing.four,
    padding: Spacing.four,
  },
  pagination: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'space-between',
    paddingTop: Spacing.three,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: Spacing.two,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
});
