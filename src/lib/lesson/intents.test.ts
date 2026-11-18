import { describe, expect, it } from "vitest";
import { isRestartRequest } from "./intents";

describe("isRestartRequest", () => {
  it("restart / re-explain requests restart the lesson", () => {
    for (const q of [
      "Boshidan doskani o'chirib tushuntirib ber",
      "boshidan",
      "Qaytadan tushuntir",
      "Doskani o‘chir",
      "doskani ochiring",
      "Tushunmadim",
      "hech narsa tushunmadim",
      "Tushuntirib bering",
      "yana bir marta tushuntirib ber iltimos",
      "Darsni boshqatdan boshlang",
    ])
      expect(isRestartRequest(q), q).toBe(true);
  });

  it("real questions are answered, not restarted", () => {
    for (const q of [
      "Nega 12?",
      "EKUK qanday tushuntiriladi?",
      "Nega maxrajlarni ko'paytirdik?",
      "EKUK nimani tushuntiradi?",
      "4 va 6 ning EKUKini tushuntirib ber",
      "Karrali nima degani?",
      "doska qayerda",
      "tushundim",
      "",
      "Nega eng kichigini olamiz?",
    ])
      expect(isRestartRequest(q), q).toBe(false);
  });
});
