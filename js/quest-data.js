/* Genere par tools/build-quests.py : ne pas modifier a la main.
   Les recompenses des quetes quotidiennes, telles que le mod les tire
   (DailyQuestTier.java, OWEntity.java). js/simulator.js s'en sert. */
window.OW = window.OW || {};
window.OW.QUEST_REWARDS = {
  "tiers": {
    "I": {
      "xpMin": 5,
      "xpMax": 10,
      "coinChance": 0.0,
      "coinMin": 0,
      "coinMax": 0
    },
    "II": {
      "xpMin": 7,
      "xpMax": 15,
      "coinChance": 0.3333,
      "coinMin": 1,
      "coinMax": 1
    },
    "III": {
      "xpMin": 10,
      "xpMax": 20,
      "coinChance": 0.5,
      "coinMin": 1,
      "coinMax": 2
    }
  },
  "orbXp": 4.0,
  "tamingFromLevel": 50,
  "tamingDivisor": 2.0
};
