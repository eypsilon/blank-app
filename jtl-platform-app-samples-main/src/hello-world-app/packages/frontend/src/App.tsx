import { AppBridge } from '@jtl-software/cloud-apps-core';
import './App.css';
import { ErpPage, PanePage, SetupPage } from './pages';
import { useEffect } from 'react';

type AppMode = 'setup' | 'erp' | 'pane';

const App: React.FC<{ appBridge: AppBridge }> = ({ appBridge }) => {
  const mode: AppMode = location.pathname.substring(1) as AppMode;

  useEffect((): void => {
    console.log('[HelloWorldApp] bridge created!');
  }, []);

  switch (mode) {
    case 'setup':
      return appBridge && <SetupPage appBridge={appBridge} />;
    case 'erp':
      return appBridge && <ErpPage appBridge={appBridge} />;
    case 'pane':
      return appBridge && <PanePage appBridge={appBridge} />;
    default:
      return (
        <div>
          <h1>Unknown mode</h1>
          <p>Unknown mode</p>
        </div>
      );
  }
};

export default App;
