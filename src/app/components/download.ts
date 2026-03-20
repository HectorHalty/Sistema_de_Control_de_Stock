export function downloadTextFile(options: {
  filename: string;
  text: string;
  mimeType?: string;
}): void {
  const { filename, text, mimeType = 'text/plain;charset=utf-8;' } = options;

  const blob = new Blob([text], { type: mimeType });

  // Some WebViews require the element to be in the DOM.
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();

  // Give the browser time to start the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function downloadBlobFile(options: {
  filename: string;
  blob: Blob;
}): void {
  const { filename, blob } = options;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

