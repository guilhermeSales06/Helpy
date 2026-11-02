import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './app/styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div>Helpy</div>
  </StrictMode>,
);
