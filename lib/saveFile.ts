// Hand the person a text file to keep (10 Nov 2026, for "Download her brain"). On the web it is a normal
// download. On a phone it is offered through the share sheet, so they can save it to Notes or Files,
// email it to themselves, or send it anywhere.
import { Platform } from 'react-native';

export async function saveTextFile(name: string, text: string): Promise<void> {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return;
  }
  // No file module ships in the app (adding one needs a store build), so on a phone the text goes to
  // the share sheet, where it can be saved to Notes or Files, or emailed.
  const { Share } = await import('react-native');
  await Share.share({ title: name, message: text });
}
