/**
 * Icon Preload — 离线注册所有项目中使用的 Iconify 图标。
 *
 * 将所有图标数据通过 @iconify-icons/* 包在构建时打包，
 * 避免运行时从 api.iconify.design 等外部 API 加载。
 *
 * 在 main.tsx 中 import 即可生效。
 */
import { addIcon } from '@iconify/react';

// ─── Carbon ───────────────────────────────────────────────────────
import carbon_chip from '@iconify-icons/carbon/chip';
import carbon_machineLearningModel from '@iconify-icons/carbon/machine-learning-model';

// ─── Devicon ──────────────────────────────────────────────────────
import devicon_javascript from '@iconify-icons/devicon/javascript';
import devicon_python from '@iconify-icons/devicon/python';

// ─── Phosphor (ph) ───────────────────────────────────────────────
import ph_archiveBold from '@iconify-icons/ph/archive-bold';
import ph_arrowRightBold from '@iconify-icons/ph/arrow-right-bold';
import ph_atomBold from '@iconify-icons/ph/atom-bold';
import ph_booksBold from '@iconify-icons/ph/books-bold';
import ph_brainBold from '@iconify-icons/ph/brain-bold';
import ph_caretDownBold from '@iconify-icons/ph/caret-down-bold';
import ph_caretLeftBold from '@iconify-icons/ph/caret-left-bold';
import ph_caretRightBold from '@iconify-icons/ph/caret-right-bold';
import ph_certificateBold from '@iconify-icons/ph/certificate-bold';
import ph_chartLineBold from '@iconify-icons/ph/chart-line-bold';
import ph_circleNotchBold from '@iconify-icons/ph/circle-notch-bold';
import ph_clipboardTextBold from '@iconify-icons/ph/clipboard-text-bold';
import ph_clockCountdownBold from '@iconify-icons/ph/clock-countdown-bold';
import ph_cloudBold from '@iconify-icons/ph/cloud-bold';
import ph_codeBold from '@iconify-icons/ph/code-bold';
import ph_cubeBold from '@iconify-icons/ph/cube-bold';
import ph_databaseBold from '@iconify-icons/ph/database-bold';
import ph_dnaBold from '@iconify-icons/ph/dna-bold';
import ph_flaskBold from '@iconify-icons/ph/flask-bold';
import ph_folderOpenBold from '@iconify-icons/ph/folder-open-bold';
import ph_functionBold from '@iconify-icons/ph/function-bold';
import ph_handTapBold from '@iconify-icons/ph/hand-tap-bold';
import ph_lightningBold from '@iconify-icons/ph/lightning-bold';
import ph_mathOperationsBold from '@iconify-icons/ph/math-operations-bold';
import ph_monitorBold from '@iconify-icons/ph/monitor-bold';
import ph_notebookBold from '@iconify-icons/ph/notebook-bold';
import ph_penNibBold from '@iconify-icons/ph/pen-nib-bold';
import ph_playFill from '@iconify-icons/ph/play-fill';
import ph_scrollBold from '@iconify-icons/ph/scroll-bold';
import ph_shuffleBold from '@iconify-icons/ph/shuffle-bold';
import ph_stackBold from '@iconify-icons/ph/stack-bold';
import ph_terminalBold from '@iconify-icons/ph/terminal-bold';
import ph_terminalWindowBold from '@iconify-icons/ph/terminal-window-bold';
import ph_translateBold from '@iconify-icons/ph/translate-bold';
import ph_xCircleBold from '@iconify-icons/ph/x-circle-bold';

// ─── Solar ────────────────────────────────────────────────────────
import solar_altArrowDownBoldDuotone from '@iconify-icons/solar/alt-arrow-down-bold-duotone';
import solar_arrowRightBoldDuotone from '@iconify-icons/solar/arrow-right-bold-duotone';
import solar_bellBingBoldDuotone from '@iconify-icons/solar/bell-bing-bold-duotone';
import solar_bookBookmarkBoldDuotone from '@iconify-icons/solar/book-bookmark-bold-duotone';
import solar_chartSquareBoldDuotone from '@iconify-icons/solar/chart-square-bold-duotone';
import solar_chatRoundDotsBoldDuotone from '@iconify-icons/solar/chat-round-dots-bold-duotone';
import solar_checkCircleBoldDuotone from '@iconify-icons/solar/check-circle-bold-duotone';
import solar_closeCircleBoldDuotone from '@iconify-icons/solar/close-circle-bold-duotone';
import solar_codeSquareBoldDuotone from '@iconify-icons/solar/code-square-bold-duotone';
import solar_dangerTriangleBoldDuotone from '@iconify-icons/solar/danger-triangle-bold-duotone';
import solar_doubleAltArrowLeftBoldDuotone from '@iconify-icons/solar/double-alt-arrow-left-bold-duotone';
import solar_doubleAltArrowRightBoldDuotone from '@iconify-icons/solar/double-alt-arrow-right-bold-duotone';
import solar_fireBoldDuotone from '@iconify-icons/solar/fire-bold-duotone';
import solar_giftBoldDuotone from '@iconify-icons/solar/gift-bold-duotone';
import solar_graphBoldDuotone from '@iconify-icons/solar/graph-bold-duotone';
import solar_hamburgerMenuBoldDuotone from '@iconify-icons/solar/hamburger-menu-bold-duotone';
import solar_lightbulbBoltBoldDuotone from '@iconify-icons/solar/lightbulb-bolt-bold-duotone';
import solar_logout2BoldDuotone from '@iconify-icons/solar/logout-2-bold-duotone';
import solar_magicStick3BoldDuotone from '@iconify-icons/solar/magic-stick-3-bold-duotone';
import solar_medalRibbonsStarBoldDuotone from '@iconify-icons/solar/medal-ribbons-star-bold-duotone';
import solar_penNewSquareBoldDuotone from '@iconify-icons/solar/pen-new-square-bold-duotone';
import solar_refreshCircleBoldDuotone from '@iconify-icons/solar/refresh-circle-bold-duotone';
import solar_settingsBoldDuotone from '@iconify-icons/solar/settings-bold-duotone';
import solar_starShineBoldDuotone from '@iconify-icons/solar/star-shine-bold-duotone';
import solar_targetBoldDuotone from '@iconify-icons/solar/target-bold-duotone';
import solar_userCircleBoldDuotone from '@iconify-icons/solar/user-circle-bold-duotone';

// ─── Tabler ───────────────────────────────────────────────────────
import tabler_mathIntegralX from '@iconify-icons/tabler/math-integral-x';

// ─── 手动内联（包中缺失或图标集中不存在的图标） ─────────────────
// ph:cards-three-bold — 存在于 Iconify API 但 @iconify-icons/ph 未导出
const ph_cardsThreeBold = {
  width: 256, height: 256,
  body: '<path fill="currentColor" d="M208 96H48a20 20 0 0 0-20 20v84a20 20 0 0 0 20 20h160a20 20 0 0 0 20-20v-84a20 20 0 0 0-20-20m-4 100H52v-76h152ZM44 68a12 12 0 0 1 12-12h144a12 12 0 0 1 0 24H56a12 12 0 0 1-12-12m16-40a12 12 0 0 1 12-12h112a12 12 0 0 1 0 24H72a12 12 0 0 1-12-12"/>',
};
// solar:bell-sleep-bold-duotone — 不存在，使用 bell-off-bold-duotone 的 SVG
const solar_bellSleepBoldDuotone = {
  width: 24, height: 24,
  body: '<path fill="currentColor" d="M18.75 9v.704c0 .845.24 1.671.692 2.374l1.108 1.723c1.011 1.574.239 3.713-1.52 4.21a25.8 25.8 0 0 1-14.06 0c-1.759-.497-2.531-2.636-1.52-4.21l1.108-1.723a4.4 4.4 0 0 0 .693-2.374V9c0-3.866 3.022-7 6.749-7s6.75 3.134 6.75 7" opacity=".5"/><path fill="currentColor" d="M7.243 18.545a5.002 5.002 0 0 0 9.513 0c-3.145.59-6.367.59-9.513 0M9.349 9c0 .414.323.75.723.75h2.11L9.56 12.47a.77.77 0 0 0-.156.817c.112.28.375.463.668.463h3.856c.4 0 .723-.336.723-.75a.737.737 0 0 0-.723-.75h-2.11l2.622-2.72a.77.77 0 0 0 .157-.817a.72.72 0 0 0-.669-.463h-3.856c-.4 0-.723.336-.723.75"/>',
};
// solar:chart-up-bold-duotone — 不存在，使用 chart-2-bold-duotone 的 SVG
const solar_chartUpBoldDuotone = {
  width: 24, height: 24,
  body: '<path fill="currentColor" d="M3.293 9.293C3 9.586 3 10.057 3 11v6c0 .943 0 1.414.293 1.707S4.057 19 5 19s1.414 0 1.707-.293S7 17.943 7 17v-6c0-.943 0-1.414-.293-1.707S5.943 9 5 9s-1.414 0-1.707.293"/><path fill="currentColor" d="M17.293 2.293C17 2.586 17 3.057 17 4v13c0 .943 0 1.414.293 1.707S18.057 19 19 19s1.414 0 1.707-.293S21 17.943 21 17V4c0-.943 0-1.414-.293-1.707S19.943 2 19 2s-1.414 0-1.707.293" opacity=".4"/><path fill="currentColor" d="M10 7c0-.943 0-1.414.293-1.707S11.057 5 12 5s1.414 0 1.707.293S14 6.057 14 7v10c0 .943 0 1.414-.293 1.707S12.943 19 12 19s-1.414 0-1.707-.293S10 17.943 10 17z" opacity=".7"/><path fill="currentColor" d="M3 21.25a.75.75 0 0 0 0 1.5h18a.75.75 0 0 0 0-1.5z"/>',
};
// solar:spinner-bold-duotone — 不存在，使用简单 spinner SVG
const solar_spinnerBoldDuotone = {
  width: 24, height: 24,
  body: '<path fill="currentColor" d="M12 2a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1m0 15a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0v-3a1 1 0 0 1 1-1" opacity=".5"/><path fill="currentColor" d="M22 12a1 1 0 0 1-1 1h-3a1 1 0 1 1 0-2h3a1 1 0 0 1 1 1M7 12a1 1 0 0 1-1 1H3a1 1 0 1 1 0-2h3a1 1 0 0 1 1 1" opacity=".3"/><path fill="currentColor" d="M19.07 4.93a1 1 0 0 1 0 1.414l-2.122 2.121a1 1 0 0 1-1.414-1.414l2.122-2.12a1 1 0 0 1 1.414 0m-10.607 10.607a1 1 0 0 1 0 1.414l-2.12 2.121a1 1 0 1 1-1.415-1.414l2.121-2.121a1 1 0 0 1 1.414 0" opacity=".7"/><path fill="currentColor" d="M4.93 4.93a1 1 0 0 1 1.414 0l2.121 2.121a1 1 0 0 1-1.414 1.414L4.93 6.344a1 1 0 0 1 0-1.414m10.607 10.607a1 1 0 0 1 1.414 0l2.121 2.12a1 1 0 0 1-1.414 1.415l-2.121-2.121a1 1 0 0 1 0-1.414"/>',
};

// ─── 注册所有图标 ─────────────────────────────────────────────────
export function preloadIcons() {
  addIcon('carbon:chip', carbon_chip);
  addIcon('carbon:machine-learning-model', carbon_machineLearningModel);
  addIcon('devicon:javascript', devicon_javascript);
  addIcon('devicon:python', devicon_python);
  addIcon('ph:archive-bold', ph_archiveBold);
  addIcon('ph:arrow-right-bold', ph_arrowRightBold);
  addIcon('ph:atom-bold', ph_atomBold);
  addIcon('ph:books-bold', ph_booksBold);
  addIcon('ph:brain-bold', ph_brainBold);
  addIcon('ph:cards-three-bold', ph_cardsThreeBold);
  addIcon('ph:caret-down-bold', ph_caretDownBold);
  addIcon('ph:caret-left-bold', ph_caretLeftBold);
  addIcon('ph:caret-right-bold', ph_caretRightBold);
  addIcon('ph:certificate-bold', ph_certificateBold);
  addIcon('ph:chart-line-bold', ph_chartLineBold);
  addIcon('ph:circle-notch-bold', ph_circleNotchBold);
  addIcon('ph:clipboard-text-bold', ph_clipboardTextBold);
  addIcon('ph:clock-countdown-bold', ph_clockCountdownBold);
  addIcon('ph:cloud-bold', ph_cloudBold);
  addIcon('ph:code-bold', ph_codeBold);
  addIcon('ph:cube-bold', ph_cubeBold);
  addIcon('ph:database-bold', ph_databaseBold);
  addIcon('ph:dna-bold', ph_dnaBold);
  addIcon('ph:flask-bold', ph_flaskBold);
  addIcon('ph:folder-open-bold', ph_folderOpenBold);
  addIcon('ph:function-bold', ph_functionBold);
  addIcon('ph:hand-tap-bold', ph_handTapBold);
  addIcon('ph:lightning-bold', ph_lightningBold);
  addIcon('ph:math-operations-bold', ph_mathOperationsBold);
  addIcon('ph:monitor-bold', ph_monitorBold);
  addIcon('ph:notebook-bold', ph_notebookBold);
  addIcon('ph:pen-nib-bold', ph_penNibBold);
  addIcon('ph:play-fill', ph_playFill);
  addIcon('ph:scroll-bold', ph_scrollBold);
  addIcon('ph:shuffle-bold', ph_shuffleBold);
  addIcon('ph:stack-bold', ph_stackBold);
  addIcon('ph:terminal-bold', ph_terminalBold);
  addIcon('ph:terminal-window-bold', ph_terminalWindowBold);
  addIcon('ph:translate-bold', ph_translateBold);
  addIcon('ph:x-circle-bold', ph_xCircleBold);
  addIcon('solar:alt-arrow-down-bold-duotone', solar_altArrowDownBoldDuotone);
  addIcon('solar:arrow-right-bold-duotone', solar_arrowRightBoldDuotone);
  addIcon('solar:bell-bing-bold-duotone', solar_bellBingBoldDuotone);
  addIcon('solar:bell-sleep-bold-duotone', solar_bellSleepBoldDuotone);
  addIcon('solar:book-bookmark-bold-duotone', solar_bookBookmarkBoldDuotone);
  addIcon('solar:chart-square-bold-duotone', solar_chartSquareBoldDuotone);
  addIcon('solar:chart-up-bold-duotone', solar_chartUpBoldDuotone);
  addIcon('solar:chat-round-dots-bold-duotone', solar_chatRoundDotsBoldDuotone);
  addIcon('solar:check-circle-bold-duotone', solar_checkCircleBoldDuotone);
  addIcon('solar:close-circle-bold-duotone', solar_closeCircleBoldDuotone);
  addIcon('solar:code-square-bold-duotone', solar_codeSquareBoldDuotone);
  addIcon('solar:danger-triangle-bold-duotone', solar_dangerTriangleBoldDuotone);
  addIcon('solar:double-alt-arrow-left-bold-duotone', solar_doubleAltArrowLeftBoldDuotone);
  addIcon('solar:double-alt-arrow-right-bold-duotone', solar_doubleAltArrowRightBoldDuotone);
  addIcon('solar:fire-bold-duotone', solar_fireBoldDuotone);
  addIcon('solar:gift-bold-duotone', solar_giftBoldDuotone);
  addIcon('solar:graph-bold-duotone', solar_graphBoldDuotone);
  addIcon('solar:hamburger-menu-bold-duotone', solar_hamburgerMenuBoldDuotone);
  addIcon('solar:lightbulb-bolt-bold-duotone', solar_lightbulbBoltBoldDuotone);
  addIcon('solar:logout-2-bold-duotone', solar_logout2BoldDuotone);
  addIcon('solar:magic-stick-3-bold-duotone', solar_magicStick3BoldDuotone);
  addIcon('solar:medal-ribbons-star-bold-duotone', solar_medalRibbonsStarBoldDuotone);
  addIcon('solar:pen-new-square-bold-duotone', solar_penNewSquareBoldDuotone);
  addIcon('solar:refresh-circle-bold-duotone', solar_refreshCircleBoldDuotone);
  addIcon('solar:settings-bold-duotone', solar_settingsBoldDuotone);
  addIcon('solar:spinner-bold-duotone', solar_spinnerBoldDuotone);
  addIcon('solar:star-shine-bold-duotone', solar_starShineBoldDuotone);
  addIcon('solar:target-bold-duotone', solar_targetBoldDuotone);
  addIcon('solar:user-circle-bold-duotone', solar_userCircleBoldDuotone);
  addIcon('tabler:math-integral-x', tabler_mathIntegralX);
}

// 自动执行
preloadIcons();

