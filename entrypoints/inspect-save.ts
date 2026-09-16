import { inspectSnapshotPayload } from '../src/tools/inspect-save/picker';
import { runPickerHost } from '../src/tools/inspect-save/picker-host';

export default defineUnlistedScript(() => {
  runPickerHost({
    portPrefix: 'swiss-inspect-save',
    scopeKey: '__swissInspect',
    buildPayload: inspectSnapshotPayload,
  });
});
