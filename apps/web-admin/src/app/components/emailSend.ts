import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { EmailComposer } from 'capacitor-email-composer';

async function blobToBase64(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(arrayBuffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export async function openOrderEmailDraft(options: {
  toEmail: string;
  subject: string;
  body: string;
  filename: string;
  blob: Blob;
}): Promise<void> {
  const { toEmail, subject, body, filename, blob } = options;

  // Native (Android): open email composer with attachment.
  if (Capacitor.isNativePlatform()) {
    const base64 = await blobToBase64(blob);
    const writeRes = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Cache,
      recursive: true,
    });

    await EmailComposer.open({
      to: [toEmail],
      subject,
      body,
      isHtml: false,
      attachments: [
        {
          type: 'absolute',
          path: writeRes.uri,
          name: filename,
        },
      ],
    });
    return;
  }

  // Web/Desktop fallback: mailto (no attachment possible).
  const mailto = `mailto:${encodeURIComponent(toEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.open(mailto, '_blank', 'noopener,noreferrer');
}

