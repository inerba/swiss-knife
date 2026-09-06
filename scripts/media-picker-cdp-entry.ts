// Bundle with esbuild and evaluate in a CDP isolated world of the existing tab.
// This harness uses the production picker, no mock DOM and no browser launch.
import { installPicker } from '../src/tools/media-picker/picker';
import { compactPageUrl } from '../src/tools/media-picker/format';

const scope = window as typeof window & { __swissMediaTest?: { start(): void; cleanup(): void; result: unknown; status: string; compact: string } };
scope.__swissMediaTest?.cleanup();
let stop = () => {};
const test = {
  result: null as unknown,
  status: 'idle',
  compact: compactPageUrl(location.href),
  start() {
    stop(); test.result = null; test.status = 'picking';
    stop = installPicker(({ owners: _owners, ...result }) => { test.result = result; test.status = 'selected'; }, () => { test.status = 'cancelled'; }, error => { test.status = String(error); });
  },
  cleanup() { stop(); delete scope.__swissMediaTest; },
};
scope.__swissMediaTest = test;
test.start();
