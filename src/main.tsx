import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { bootstrapIcons } from './engine/icons';
import { tryAutoLoadIcons } from './engine/icon-loader';
import './styles/globals.css';

bootstrapIcons();
// Best-effort load of an optional public/icons/manifest.json — silent no-op if absent.
tryAutoLoadIcons().then((result) => {
  if (result && result.loaded > 0) {
    console.info(`[icons] loaded ${result.loaded} vendor icons${result.failed.length ? `, ${result.failed.length} failed` : ''}`);
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
