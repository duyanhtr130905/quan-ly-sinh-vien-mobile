import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { BinaryFileResponse } from '@/api/api-client';

export async function shareBinaryFile(fileResponse: BinaryFileResponse) {
  const file = new File(Paths.cache, fileResponse.filename);
  file.write(fileResponse.bytes);
  if (!await Sharing.isAvailableAsync()) {
    throw new Error('Chia sẻ tệp chưa khả dụng trên thiết bị này.');
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: fileResponse.contentType ?? undefined,
    dialogTitle: fileResponse.filename,
  });
}
