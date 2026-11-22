// lib/webFit.ts (22 Nov 2026, same as Totality): web only. A text box in a row must be allowed to
// shrink, the way it does in the phone apps, so it never pushes the button beside it off a narrow screen.
import { Platform } from 'react-native';

if (Platform.OS === 'web' && typeof document !== 'undefined' && !document.getElementById('hq-web-fit')) {
  const el = document.createElement('style');
  el.id = 'hq-web-fit';
  el.textContent = 'input,textarea{min-width:0}';
  document.head.appendChild(el);
}

export {};
