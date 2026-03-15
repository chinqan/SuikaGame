/* ============================================
   Entry Point
   ============================================ */

import { Game } from './game';

window.addEventListener('DOMContentLoaded', async () => {
  const game = new Game();
  await game.init();
});
