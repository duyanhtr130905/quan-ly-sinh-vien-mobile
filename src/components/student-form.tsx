import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ApiClientError } from '@/api/api-client';
import { getActiveHobbies, getStudentClasses, type Hobby, type StudentClass } from '@/api/catalogs';
import { createStudent, type Student, type StudentFormValues, type StudentImageFile, updateStudent } from '@/api/students';
import { SearchableMultiSelectModal, SearchableSingleSelectModal } from '@/components/searchable-select-modal';
import { StickyActionBar } from '@/components/sticky-action-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppButton, AppTextInput, Card, ErrorMessage, FormField, SectionTitle } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const EMAIL_PATTERN = /^[0-9a-zA-Z.\-_]+@[0-9a-zA-Z.\-_]+$/;
const FACEBOOK_PATTERN = /^https?:\/\/[0-9a-zA-Z.\-_]+$/;
const PASSWORD_PATTERN = /^(?=.*[0-9])(?=.*[A-Z])(?=.*[a-z])(?=.*[^A-Za-z0-9\s]).{8,}$/;
const HAIR_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png']);
const IMAGE_EXTENSIONS: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' };

type StudentFormProps = {
  mode: 'create' | 'edit';
  student?: Student;
};

const emptyValues: StudentFormValues = {
  code: '',
  fullname: '',
  dob: '',
  sex: true,
  homecity: '',
  address: '',
  hair_color: '',
  email: '',
  facebook: '',
  class_id: '',
  username: '',
  password: '',
  description: '',
  hobbies: 0,
};

function formValuesFromStudent(student: Student): StudentFormValues {
  return {
    code: student.code,
    fullname: student.fullname,
    dob: student.dob ?? '',
    sex: student.sex,
    homecity: student.homecity ?? '',
    address: student.address ?? '',
    hair_color: student.hair_color ?? '',
    email: student.email,
    facebook: student.facebook ?? '',
    class_id: student.class_id ?? '',
    username: student.username,
    password: '',
    description: student.description ?? '',
    hobbies: Number(student.hobbies ?? 0),
  };
}

function validationMessage(values: StudentFormValues, create: boolean): string | null {
  if (create && !values.code.trim()) return 'Mã sinh viên là bắt buộc.';
  if (!values.fullname.trim()) return 'Họ tên là bắt buộc.';
  if (!values.email.trim()) return 'Email là bắt buộc.';
  if (create && !values.username.trim()) return 'Username là bắt buộc.';
  if (create && !values.password) return 'Mật khẩu là bắt buộc.';
  if (values.code.length > 50) return 'Mã sinh viên không được vượt quá 50 ký tự.';
  if (values.username.length > 50) return 'Username không được vượt quá 50 ký tự.';
  if (values.fullname.length > 30) return 'Họ tên không được vượt quá 30 ký tự.';
  if (values.homecity.length > 100 || values.address.length > 100) return 'Quê quán và địa chỉ không được vượt quá 100 ký tự.';
  if (values.hair_color && !HAIR_COLOR_PATTERN.test(values.hair_color)) return 'Màu tóc phải theo định dạng #RRGGBB.';
  if (!EMAIL_PATTERN.test(values.email) || values.email.length > 256) return 'Email không đúng định dạng.';
  if (values.facebook && (!FACEBOOK_PATTERN.test(values.facebook) || values.facebook.length > 256)) return 'Facebook phải là URL http/https hợp lệ.';
  if (values.password && !PASSWORD_PATTERN.test(values.password)) return 'Mật khẩu cần ít nhất 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.';
  if (values.dob && !isValidDate(values.dob)) return 'Ngày sinh phải theo định dạng YYYY-MM-DD.';
  return null;
}

function isValidDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function apiMessage(error: unknown) {
  if (error instanceof ApiClientError) return `${error.code ? `${error.code}: ` : ''}${error.message}`;
  if (error instanceof Error && error.message) return `Không thể lưu sinh viên: ${error.message}`;
  return 'Không thể lưu sinh viên.';
}

function classLabel(studentClass: StudentClass) {
  return `${studentClass.code} — ${studentClass.name}`;
}

function hobbyMaskFromIds(ids: string[], hobbies: Hobby[], currentMask: number) {
  const knownMask = hobbies.reduce((mask, hobby) => mask | hobby.bit_value, 0);
  const selectedMask = hobbies.filter((hobby) => ids.includes(hobby.id)).reduce((mask, hobby) => mask | hobby.bit_value, 0);
  return (currentMask & ~knownMask) | selectedMask;
}

export function StudentForm({ mode, student }: StudentFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const isCreate = mode === 'create';
  const [values, setValues] = useState<StudentFormValues>(() => student ? formValuesFromStudent(student) : emptyValues);
  const [image, setImage] = useState<StudentImageFile | null>(null);
  const [classModalVisible, setClassModalVisible] = useState(false);
  const [hobbyModalVisible, setHobbyModalVisible] = useState(false);
  const classesQuery = useQuery({ queryKey: ['student-classes'], queryFn: getStudentClasses });
  const hobbiesQuery = useQuery({ queryKey: ['active-hobbies'], queryFn: getActiveHobbies });
  const classes = classesQuery.data?.data ?? [];
  const hobbies = hobbiesQuery.data?.data ?? [];
  const selectedClass = classes.find((item) => item.id === values.class_id);
  const selectedHobbies = hobbies.filter((hobby) => (values.hobbies & hobby.bit_value) !== 0);
  const selectedHobbyIds = selectedHobbies.map((hobby) => hobby.id);
  const saveMutation = useMutation({
    mutationFn: () => isCreate ? createStudent(values, image) : updateStudent(student!.id, values, image),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ['students'] });
      await queryClient.invalidateQueries({ queryKey: ['deleted-students'] });
      await queryClient.invalidateQueries({ queryKey: ['student', response.data.id] });
      await queryClient.invalidateQueries({ queryKey: ['classes'] });
      await queryClient.invalidateQueries({ queryKey: ['class'] });
      await queryClient.invalidateQueries({ queryKey: ['class-members'] });
      await queryClient.invalidateQueries({ queryKey: ['class-available'] });
      router.replace({ pathname: '/students/[id]', params: { id: response.data.id } });
    },
  });
  const update = <Key extends keyof StudentFormValues>(key: Key, value: StudentFormValues[Key]) => {
    setValues((current) => ({ ...current, [key]: value }));
  };
  const chooseImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Cần quyền truy cập ảnh', 'Hãy cho phép truy cập thư viện ảnh để đính kèm ảnh sinh viên.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (result.canceled) return;

    const asset = result.assets[0];
    const extension = asset.fileName?.split('.').pop()?.toLowerCase() ?? asset.uri.split('.').pop()?.toLowerCase() ?? '';
    const type = asset.mimeType ?? IMAGE_EXTENSIONS[extension] ?? '';
    if (!IMAGE_TYPES.has(type)) {
      Alert.alert('Ảnh không hợp lệ', 'Chỉ hỗ trợ ảnh JPG, JPEG hoặc PNG.');
      return;
    }
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
      Alert.alert('Ảnh quá lớn', 'Ảnh đính kèm không được vượt quá 5 MB.');
      return;
    }
    setImage({ uri: asset.uri, name: asset.fileName ?? `student.${extension || 'jpg'}`, type, size: asset.fileSize });
  };
  const submit = () => {
    const error = validationMessage(values, isCreate);
    if (error) {
      Alert.alert('Dữ liệu chưa hợp lệ', error);
      return;
    }
    saveMutation.mutate();
  };
  const selectorError = (error: unknown, fallback: string) => error instanceof ApiClientError
    ? `${error.code ? `${error.code}: ` : ''}${error.message}`
    : fallback;

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: 'height' })} style={styles.container}>
        <ScrollView contentContainerStyle={styles.content} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
          <FormSection title="Thông tin bắt buộc">
            <FormField label={isCreate ? 'Mã sinh viên' : 'Mã sinh viên (không thể thay đổi)'} required>
              <AppTextInput accessibilityLabel="Mã sinh viên" autoCapitalize="characters" editable={isCreate} value={values.code} onChangeText={(value) => update('code', value)} style={!isCreate && styles.readOnly} />
            </FormField>
            <FormField label="Họ và tên" required>
              <AppTextInput accessibilityLabel="Họ và tên" value={values.fullname} onChangeText={(value) => update('fullname', value)} />
            </FormField>
            <FormField label="Email" required>
              <AppTextInput accessibilityLabel="Email" autoCapitalize="none" keyboardType="email-address" value={values.email} onChangeText={(value) => update('email', value)} />
            </FormField>
            <FormField label={isCreate ? 'Username' : 'Username (không thể thay đổi)'} required>
              <AppTextInput accessibilityLabel="Username" autoCapitalize="none" editable={isCreate} value={values.username} onChangeText={(value) => update('username', value)} style={!isCreate && styles.readOnly} />
            </FormField>
            <FormField label={isCreate ? 'Mật khẩu' : 'Mật khẩu mới (để trống nếu giữ nguyên)'} required={isCreate}>
              <AppTextInput accessibilityLabel="Mật khẩu" autoCapitalize="none" secureTextEntry value={values.password} onChangeText={(value) => update('password', value)} />
            </FormField>
          </FormSection>
          <FormSection title="Thông tin cá nhân">
            <FormField label="Ngày sinh (YYYY-MM-DD)">
              <AppTextInput accessibilityLabel="Ngày sinh, định dạng năm-tháng-ngày" autoCapitalize="none" placeholder="2004-01-15" value={values.dob} onChangeText={(value) => update('dob', value)} />
            </FormField>
            <FormField label="Giới tính">
              <View style={styles.actions}>
                <AppButton label="Nam" variant={values.sex === true ? 'primary' : 'secondary'} onPress={() => update('sex', true)} />
                <AppButton label="Nữ" variant={values.sex === false ? 'primary' : 'secondary'} onPress={() => update('sex', false)} />
              </View>
            </FormField>
            <FormField label="Quê quán">
              <AppTextInput accessibilityLabel="Quê quán" value={values.homecity} onChangeText={(value) => update('homecity', value)} />
            </FormField>
            <FormField label="Địa chỉ">
              <AppTextInput accessibilityLabel="Địa chỉ" value={values.address} onChangeText={(value) => update('address', value)} />
            </FormField>
            <FormField label="Màu tóc (#RRGGBB)">
              <AppTextInput accessibilityLabel="Màu tóc" autoCapitalize="characters" value={values.hair_color} onChangeText={(value) => update('hair_color', value)} />
            </FormField>
            <FormField label="Facebook (http/https)">
              <AppTextInput accessibilityLabel="Địa chỉ Facebook" autoCapitalize="none" keyboardType="url" value={values.facebook} onChangeText={(value) => update('facebook', value)} />
            </FormField>
          </FormSection>
          <FormSection title="Học tập">
            <FormField label="Lớp">
              <Pressable accessibilityHint="Mở danh sách lớp để chọn" accessibilityLabel={`Lớp: ${selectedClass ? classLabel(selectedClass) : 'Chưa xếp lớp'}`} accessibilityRole="button" onPress={() => setClassModalVisible(true)} style={[styles.selector, { borderColor: theme.border }]}>
                <ThemedText type="small">{selectedClass ? classLabel(selectedClass) : 'Chưa xếp lớp'}</ThemedText>
                <ThemedText type="smallBold" themeColor="textSecondary">›</ThemedText>
              </Pressable>
              {classesQuery.isError ? <ErrorMessage>{selectorError(classesQuery.error, 'Không thể tải danh sách lớp.')}</ErrorMessage> : null}
            </FormField>
            <FormField label="Sở thích">
              {selectedHobbies.length ? <View style={styles.chips}>{selectedHobbies.map((hobby) => <Pressable key={hobby.id} accessibilityLabel={`Bỏ sở thích ${hobby.name}`} accessibilityRole="button" onPress={() => update('hobbies', values.hobbies & ~hobby.bit_value)} style={[styles.chip, { borderColor: theme.primary }]}><ThemedText type="small">{hobby.name} ×</ThemedText></Pressable>)}</View> : <ThemedText type="small" themeColor="textSecondary">Chưa chọn sở thích.</ThemedText>}
              <AppButton label="+ Chọn sở thích" variant="secondary" onPress={() => setHobbyModalVisible(true)} />
              {hobbiesQuery.isError ? <ErrorMessage>{selectorError(hobbiesQuery.error, 'Không thể tải danh sách sở thích.')}</ErrorMessage> : null}
            </FormField>
          </FormSection>
          <FormSection title="Mô tả và ảnh">
            <FormField label="Mô tả">
              <AppTextInput accessibilityLabel="Mô tả" multiline value={values.description} onChangeText={(value) => update('description', value)} style={styles.multilineInput} />
            </FormField>
            <AppButton label="Chọn ảnh JPG/PNG (tối đa 5 MB)" variant="secondary" onPress={() => void chooseImage()} />
            {image ? (
              <Card style={styles.imagePreview}>
                <Image accessible accessibilityLabel="Ảnh mới đã chọn" source={{ uri: image.uri }} style={styles.image} />
                <ThemedText type="small">{image.name}</ThemedText>
                <AppButton label="Bỏ ảnh mới chọn" variant="secondary" onPress={() => setImage(null)} />
              </Card>
            ) : student?.attachment ? <Image accessible accessibilityLabel={`Ảnh hồ sơ của ${student.fullname}`} source={{ uri: student.attachment }} style={styles.image} /> : null}
          </FormSection>
          {saveMutation.isError ? <ErrorMessage>{apiMessage(saveMutation.error)}</ErrorMessage> : null}
        </ScrollView>
        <StickyActionBar>
          <AppButton label="Hủy" variant="secondary" onPress={() => router.back()} />
          <AppButton disabled={saveMutation.isPending} label={saveMutation.isPending ? 'Đang lưu...' : isCreate ? 'Tạo sinh viên' : 'Lưu thay đổi'} style={styles.save} onPress={submit} />
        </StickyActionBar>
      </KeyboardAvoidingView>
      <SearchableSingleSelectModal
        emptyMessage="Không có lớp khớp với từ khóa."
        errorMessage={classesQuery.isError ? selectorError(classesQuery.error, 'Không thể tải danh sách lớp.') : undefined}
        items={classes.map((item) => ({ id: item.id, label: classLabel(item), searchText: `${item.code} ${item.name}` }))}
        loading={classesQuery.isPending}
        selectedId={values.class_id}
        title="Chọn lớp"
        visible={classModalVisible}
        onClear={() => {
          update('class_id', '');
          setClassModalVisible(false);
        }}
        onClose={() => setClassModalVisible(false)}
        onSelect={(item) => {
          update('class_id', item.id);
          setClassModalVisible(false);
        }}
      />
      <SearchableMultiSelectModal
        emptyMessage="Không có sở thích khớp với từ khóa."
        errorMessage={hobbiesQuery.isError ? selectorError(hobbiesQuery.error, 'Không thể tải danh sách sở thích.') : undefined}
        items={hobbies.map((item) => ({ id: item.id, label: item.name, searchText: item.code }))}
        loading={hobbiesQuery.isPending}
        selectedIds={selectedHobbyIds}
        title="Chọn sở thích"
        visible={hobbyModalVisible}
        onClose={() => setHobbyModalVisible(false)}
        onDone={(ids) => {
          update('hobbies', hobbyMaskFromIds(ids, hobbies, values.hobbies));
          setHobbyModalVisible(false);
        }}
      />
    </ThemedView>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <Card style={styles.section}><SectionTitle>{title}</SectionTitle>{children}</Card>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { gap: Spacing.three, padding: Spacing.four, paddingBottom: Spacing.five },
  section: { gap: Spacing.three },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  selector: { alignItems: 'center', borderRadius: Spacing.two, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 48, paddingHorizontal: Spacing.three },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { borderRadius: Spacing.two, borderWidth: 1, minHeight: 36, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one },
  multilineInput: { minHeight: 112, textAlignVertical: 'top' },
  readOnly: { opacity: 0.58 },
  imagePreview: { alignItems: 'flex-start' },
  image: { borderRadius: Spacing.two, height: 120, width: 120 },
  save: { flex: 1 },
});
