import { describe, expect, it } from 'vitest';
import { buildQrPayload } from './payload';

describe('buildQrPayload', () => {
  it('escapes Wi-Fi delimiters so the generated QR preserves credentials', () => {
    expect(buildQrPayload('wifi', {
      ssid: 'Rete; casa', password: 'p:a;ss\\word', security: 'WPA', hidden: true,
    })).toBe('WIFI:T:WPA;S:Rete\\; casa;P:p\\:a\\;ss\\\\word;H:true;;');
  });

  it('builds an Italian vCard without blank fields', () => {
    expect(buildQrPayload('contact', {
      firstName: 'Giulia', lastName: 'D’Angelo', organization: '', phone: '+39 333 1234567', email: '', website: 'https://example.it',
    })).toBe('BEGIN:VCARD\nVERSION:3.0\nN:D’Angelo;Giulia;;;\nFN:Giulia D’Angelo\nTEL:+39 333 1234567\nURL:https://example.it\nEND:VCARD');
  });

  it('requires the fields that identify the selected QR type', () => {
    expect(() => buildQrPayload('url', { value: '  ' })).toThrow('Inserisci un URL o un testo.');
    expect(buildQrPayload('email', { to: 'ciao@example.it', subject: 'Ciao', body: 'A presto' })).toBe('mailto:ciao@example.it?subject=Ciao&body=A%20presto');
  });
});
