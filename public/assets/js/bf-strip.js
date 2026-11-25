// Shiriti Black Friday në krye të çdo faqeje: numëruesi deri në fund të ofertës.
import { startCountdown } from './black-friday-data.js';

const strip = document.querySelector('[data-bf-strip]');
if (strip && !strip.hidden) startCountdown(strip, () => { strip.hidden = true; });
