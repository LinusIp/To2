// UI-kit strings (empty / loading / error states, toasts, sheets). Kept in a separate file so the
// design-system branch never conflicts with feature branches editing src/i18n/uz.ts; merge later.
export const ui = {
  empty: "Hozircha bu yer bo'sh — birinchi darsdan boshlaymiz!",
  loading: "Bir soniya, tayyorlayapman…",
  error: "Voy, nimadir chalkashdi. Yana bir bor urinib ko'ramizmi?",
  offline: "Internet yo'q. Ulanib, qayta urinib ko'ring.",
  retry: "Qayta urinish",
  close: "Yopish",
  saved: "Saqlandi!",
  xp: "tajriba ochkosi",
  noBadges: "Birinchi darsni tugatsangiz, birinchi nishon sizniki!",
  badgesEarned: (n: number, all: number) => `${n} / ${all} ta nishon`,
  tutorSaved: (name: string) => `${name} endi sizning ustozingiz!`,
  gradeSaved: (g: number) => `${g}-sinf saqlandi`,
} as const;
