import ReactDOM from 'react-dom/client';
import { App } from '../../src/App';
import { applyAppearance } from '../../src/lib/appearance';
import '../../src/style.css';
applyAppearance();
ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
