import { buildContextPayload } from '../src/tools/browser-context/collect';
import { runPickerHost } from '../src/tools/inspect-save/picker-host';

export default defineUnlistedScript(() => {
  runPickerHost({
    portPrefix: 'swiss-browser-context',
    scopeKey: '__swissBrowserContext',
    buildPayload: buildContextPayload,
  });
});
