import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { createAppBridge } from '@jtl-software/cloud-apps-core';

createAppBridge().then(appBridge => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App appBridge={appBridge} />
    </StrictMode>,
  );
});
