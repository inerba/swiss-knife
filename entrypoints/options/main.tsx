import ReactDOM from 'react-dom/client';
import { SettingsApp } from '../../src/SettingsApp';
import { applyAppearance } from '../../src/lib/appearance';
import '../../src/style.css';
applyAppearance();
ReactDOM.createRoot(document.getElementById('root')!).render(<SettingsApp />);
