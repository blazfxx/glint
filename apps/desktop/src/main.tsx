import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Countdown } from './pages/Countdown';
import { Encoder } from './pages/Encoder';
import { History } from './pages/History';
import { Overlay } from './pages/Overlay';
import { QuickAccess } from './pages/QuickAccess';
import { Settings } from './pages/Settings';
import { WindowPicker } from './pages/WindowPicker';
import { route } from './glint';
import './styles.css';

const { page, params } = route();
const mac = navigator.userAgent.includes('Mac OS');

/** Pages with their own window chrome get the solid app background; overlays stay see-through. */
if (['settings', 'history', 'windows'].includes(page)) document.body.classList.add('page-solid');
document.title =
  page === 'settings'
    ? 'Glint Settings'
    : page === 'history'
      ? 'Glint History'
      : page === 'windows'
        ? 'Capture a Window'
        : 'Glint';

function Page() {
  switch (page) {
    case 'overlay':
      return <Overlay displayId={params.get('display') ?? ''} />;
    case 'quick':
      return <QuickAccess />;
    case 'history':
      return <History mac={mac} />;
    case 'windows':
      return <WindowPicker />;
    case 'countdown':
      return <Countdown seconds={Number(params.get('seconds') ?? 3)} />;
    case 'encoder':
      return <Encoder />;
    default:
      return <Settings initialTab={params.get('tab')} />;
  }
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Page />
    </StrictMode>,
  );
}
