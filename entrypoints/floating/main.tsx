import ReactDOM from 'react-dom/client';
import { App } from '../../src/App';
import { applyAppearance } from '../../src/lib/appearance';
import { installClipboardFallback } from '../../src/lib/clipboard';
import '../../src/style.css';
applyAppearance();
installClipboardFallback();
ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
