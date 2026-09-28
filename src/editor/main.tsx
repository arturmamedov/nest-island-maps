import '@fontsource/montserrat/500.css';
import '@fontsource/montserrat/600.css';
import '@fontsource/poppins/700.css';
import '../map/fonts.css';
import './editor.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

/* The editor entry (index.html). The UI faces are Montserrat 500/600 and
   Poppins 700 (spec §2); fonts.css brings the faces the map itself draws. */

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
