export type QrPayloadKind = 'url' | 'text' | 'wifi' | 'contact' | 'email' | 'phone' | 'sms';

export type QrPayloadFields = Record<string, string | boolean | undefined>;

function required(value: unknown) {
  const result = String(value ?? '').trim();
  if (!result) throw new Error('Inserisci un URL o un testo.');
  return result;
}

function escapeWifi(value: unknown) {
  return String(value ?? '').replace(/([\\;,:])/g, '\\$1');
}

export function buildQrPayload(kind: QrPayloadKind, fields: QrPayloadFields): string {
  if (kind === 'url' || kind === 'text') return required(fields.value);
  if (kind === 'wifi') {
    const ssid = required(fields.ssid);
    const security = String(fields.security || 'WPA');
    const password = String(fields.password ?? '');
    return `WIFI:T:${escapeWifi(security)};S:${escapeWifi(ssid)};P:${escapeWifi(password)};H:${fields.hidden === true ? 'true' : 'false'};;`;
  }
  if (kind === 'phone') return `tel:${required(fields.phone)}`;
  if (kind === 'sms') return `sms:${required(fields.phone)}${fields.message ? `?body=${encodeURIComponent(String(fields.message))}` : ''}`;
  if (kind === 'email') {
    const to = required(fields.to);
    const query = [
      fields.subject ? `subject=${encodeURIComponent(String(fields.subject))}` : '',
      fields.body ? `body=${encodeURIComponent(String(fields.body))}` : '',
    ].filter(Boolean);
    const suffix = query.join('&');
    return `mailto:${to}${suffix ? `?${suffix}` : ''}`;
  }
  const firstName = String(fields.firstName ?? '').trim();
  const lastName = String(fields.lastName ?? '').trim();
  const fullName = `${firstName} ${lastName}`.trim();
  if (!fullName) throw new Error('Inserisci almeno nome o cognome del contatto.');
  const line = (name: string, value: unknown) => String(value ?? '').trim() ? `${name}:${String(value).trim()}` : '';
  return [
    'BEGIN:VCARD', 'VERSION:3.0', `N:${lastName};${firstName};;;`, `FN:${fullName}`,
    line('ORG', fields.organization), line('TEL', fields.phone), line('EMAIL', fields.email), line('URL', fields.website), 'END:VCARD',
  ].filter(Boolean).join('\n');
}
