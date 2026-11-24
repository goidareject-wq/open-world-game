import { CFG, ITEM_INFO } from './config.js';

export class Profile {
  constructor() {
    this.reset();
  }

  reset() {
    this.money = 250;
    this.stats = {
      missionsCompleted: 0,
      totalEarned: 0,
      distanceDriven: 0,
      distanceWalked: 0,
      orbsCollected: 0,
      jumps: 0,
      topSpeed: 0,
      racesWon: 0,
      faresCompleted: 0,
      crashes: 0,
    };
    this.inventory = { coffee: 0, nitro: 0, repair: 0 };
  }

  addMoney(n) {
    this.money += n;
    if (n > 0) this.stats.totalEarned += n;
  }

  canAfford(n) {
    return this.money >= n;
  }

  spend(n) {
    if (!this.canAfford(n)) return false;
    this.money -= n;
    return true;
  }

  addItem(type, n = 1) {
    if (!CFG.itemTypes.includes(type)) return;
    this.inventory[type] = Math.min(5, this.inventory[type] + n);
  }

  useItem(type) {
    if ((this.inventory[type] || 0) <= 0) return false;
    this.inventory[type]--;
    return true;
  }

  itemName(type) {
    return ITEM_INFO[type] ? ITEM_INFO[type].name : type;
  }

  serialize() {
    return { money: this.money, stats: { ...this.stats }, inventory: { ...this.inventory } };
  }

  deserialize(d) {
    if (!d) return;
    this.money = d.money ?? this.money;
    Object.assign(this.stats, d.stats || {});
    Object.assign(this.inventory, d.inventory || {});
  }
}
