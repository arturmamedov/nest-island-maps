import '@fontsource/montserrat/500.css';
import '@fontsource/montserrat/600.css';
import '@fontsource/poppins/700.css';
import '../map/fonts.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ISLAND_LIST } from '../shared/islands';
import { LABEL_FONTS, LABEL_FONT_IDS } from '../shared/tokens';

/* Milestone 1 placeholder: proves the self-hosted faces load and the seeds
   validate. The editor shell replaces it in milestone 3. */

const SAMPLE = 'Médano · Los Amigos · Es Vedrà · Güigüí'.toUpperCase();

function Specimen() {
  return (
    <main style={{ fontFamily: 'Montserrat, sans-serif', color: '#0f172a', padding: 32, maxWidth: 960 }}>
      <h1 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: 24 }}>Nest Island Maps</h1>
      {LABEL_FONT_IDS.map((id) => {
        const f = LABEL_FONTS[id];
        return (
          <p key={id} style={{ margin: '12px 0' }}>
            <span style={{ display: 'block', fontSize: 12, color: '#64748b' }}>
              {f.family} {f.weight}
            </span>
            <span style={{ fontFamily: `${f.family}, sans-serif`, fontWeight: f.weight, fontSize: 25, letterSpacing: '0.19em' }}>{SAMPLE}</span>
          </p>
        );
      })}
      <ul style={{ color: '#475569' }}>
        {ISLAND_LIST.map((i) => (
          <li key={i.id}>
            {i.name}: {i.seed.hostels.length} hostels, {i.seed.attractions.length} things to do, {i.seed.decor.length} decor, {i.seed.routes.length}{' '}
            routes
          </li>
        ))}
      </ul>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Specimen />
  </StrictMode>,
);
