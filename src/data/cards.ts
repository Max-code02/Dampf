export type Rarity = 'Common' | 'Rare' | 'Epic' | 'Legendary';
export type CardType = 'troop' | 'building' | 'spell';
export type TargetType = 'any' | 'buildings' | 'ground' | 'air';
export type Speed = 'slow' | 'medium' | 'fast' | 'very_fast';

export interface Card {
  id: string;
  name: string;
  cost: number;
  image: string;
  rarity: Rarity;
  playType: CardType;
  
  // Base Stats
  hp?: number;
  damage?: number;
  hitSpeed?: number;
  speed?: number;
  range?: number;
  sightRadius?: number;
  mass?: number;
  
  // Specifics
  isFlying?: boolean;
  targetsFlying?: boolean;
  targetType?: TargetType;
  shieldHp?: number;
  count?: number; // for swarms
  
  // Spells / Buildings
  radius?: number;
  duration?: number;
  spawnInterval?: number;
  lifetime?: number;
  spawnId?: string; // what building spawns
  
  // Abilities
  chargeDuration?: number; // if charging
  dashRange?: number; // if dashing
  onDeath?: string; // e.g. 'bomb', 'split'
  spellType?: 'damage' | 'poison' | 'freeze';
}

export interface PlayerStats {
  gold: number;
  gems: number;
  trophies: number;
  chests: (Chest | null)[];
  cardLevels: Record<string, { level: number, copiesCollected: number }>;
}

export interface Chest {
  id: string;
  type: 'Silver' | 'Gold' | 'Magical';
  unlockTime: number | null; // Date.now() + duration
}

export const CARDS_POOL: Card[] = [
  { id: 'knight', name: 'Ritter', cost: 3, image: '/images/knight.png', rarity: 'Common', playType: 'troop', hp: 1000, damage: 100, hitSpeed: 1.2, speed: 60, range: 1, sightRadius: 5.5, mass: 6, targetsFlying: false, targetType: 'any' },
  { id: 'archers', name: 'Bogenschützen', cost: 3, image: '/images/archers.png', rarity: 'Common', playType: 'troop', hp: 250, damage: 80, hitSpeed: 1.1, speed: 50, range: 5, sightRadius: 5.5, mass: 2, targetsFlying: true, targetType: 'any', count: 2 },
  { id: 'giant', name: 'Riese', cost: 5, image: '/images/giant.png', rarity: 'Rare', playType: 'troop', hp: 2000, damage: 120, hitSpeed: 1.5, speed: 40, range: 1, sightRadius: 6, mass: 10, targetsFlying: false, targetType: 'buildings' },
  { id: 'goblins', name: 'Kobolde', cost: 2, image: '/images/goblins.png', rarity: 'Common', playType: 'troop', hp: 160, damage: 90, hitSpeed: 1.1, speed: 90, range: 1, sightRadius: 5, mass: 1, targetsFlying: false, targetType: 'any', count: 3 },
  { id: 'valkyrie', name: 'Walküre', cost: 4, image: '/images/valkyrie.png', rarity: 'Rare', playType: 'troop', hp: 1200, damage: 130, hitSpeed: 1.5, speed: 60, range: 1, sightRadius: 5.5, mass: 7, targetsFlying: false, targetType: 'any' },
  { id: 'bomber', name: 'Bomber', cost: 2, image: '/images/bomber.png', rarity: 'Common', playType: 'troop', hp: 200, damage: 120, hitSpeed: 1.9, speed: 60, range: 4.5, sightRadius: 5.5, mass: 2, targetsFlying: false, targetType: 'any' },
  { id: 'musketeer', name: 'Musketierin', cost: 4, image: '/images/musketeer.png', rarity: 'Rare', playType: 'troop', hp: 500, damage: 150, hitSpeed: 1.1, speed: 50, range: 6, sightRadius: 6, mass: 3, targetsFlying: true, targetType: 'any' },
  { id: 'mini-pekka', name: 'Mini P.E.K.K.A', cost: 4, image: '/images/mini-pekka.png', rarity: 'Rare', playType: 'troop', hp: 900, damage: 450, hitSpeed: 1.8, speed: 90, range: 1, sightRadius: 5.5, mass: 5, targetsFlying: false, targetType: 'any' },
  { id: 'witch', name: 'Hexe', cost: 5, image: '/images/witch.png', rarity: 'Epic', playType: 'troop', hp: 600, damage: 85, hitSpeed: 1.1, speed: 50, range: 5, sightRadius: 5.5, mass: 3, targetsFlying: true, targetType: 'any', spawnInterval: 7000, spawnId: 'skeletons' },
  { id: 'skeleton-army', name: 'Skelettarmee', cost: 3, image: '/images/skeleton-army.png', rarity: 'Epic', playType: 'troop', hp: 60, damage: 60, hitSpeed: 1.0, speed: 90, range: 1, sightRadius: 5, mass: 1, targetsFlying: false, targetType: 'any', count: 15 },
  { id: 'baby-dragon', name: 'Baby Drache', cost: 4, image: '/images/baby-dragon.png', rarity: 'Epic', playType: 'troop', isFlying: true, hp: 800, damage: 100, hitSpeed: 1.5, speed: 60, range: 3.5, sightRadius: 5.5, mass: 5, targetsFlying: true, targetType: 'any' },
  { id: 'prince', name: 'Prinz', cost: 5, image: '/images/prince.png', rarity: 'Epic', playType: 'troop', hp: 1200, damage: 250, hitSpeed: 1.4, speed: 60, range: 1, sightRadius: 5.5, mass: 8, targetsFlying: false, targetType: 'any', chargeDuration: 2500 },
  { id: 'fireball', name: 'Feuerball', cost: 4, image: '/images/fireball.png', rarity: 'Rare', playType: 'spell', damage: 450, radius: 2.5, spellType: 'damage' },
  { id: 'arrows', name: 'Pfeile', cost: 3, image: '/images/arrows.png', rarity: 'Common', playType: 'spell', damage: 200, radius: 4, spellType: 'damage' },
  { id: 'zap', name: 'Knall', cost: 2, image: '/images/zap.png', rarity: 'Common', playType: 'spell', damage: 150, radius: 2.5, spellType: 'damage', duration: 500 },
  { id: 'poison', name: 'Gift', cost: 4, image: '/images/poison.png', rarity: 'Epic', playType: 'spell', damage: 600, radius: 3.5, spellType: 'poison', duration: 8000 },
  { id: 'freeze', name: 'Frost', cost: 4, image: '/images/freeze.png', rarity: 'Epic', playType: 'spell', radius: 3, spellType: 'freeze', duration: 4000 },
  { id: 'goblin-hut', name: 'Koboldhütte', cost: 5, image: '/images/goblin-hut.png', rarity: 'Rare', playType: 'building', hp: 700, lifetime: 40000, spawnInterval: 4500, spawnId: 'spear-goblins' },
  { id: 'bomb-tower', name: 'Bombenturm', cost: 4, image: '/images/bomb-tower.png', rarity: 'Rare', playType: 'building', hp: 1000, damage: 150, hitSpeed: 1.6, range: 6, sightRadius: 6, lifetime: 30000 },
  { id: 'bandit', name: 'Banditin', cost: 3, image: '/images/bandit.png', rarity: 'Legendary', playType: 'troop', hp: 750, damage: 160, hitSpeed: 1.0, speed: 90, range: 1, sightRadius: 5.5, mass: 4, targetsFlying: false, targetType: 'any', dashRange: 6 },
  { id: 'dark-prince', name: 'Dunkler Prinz', cost: 4, image: '/images/dark-prince.png', rarity: 'Epic', playType: 'troop', hp: 900, shieldHp: 200, damage: 150, hitSpeed: 1.3, speed: 60, range: 1, sightRadius: 5.5, mass: 7, targetsFlying: false, targetType: 'any', chargeDuration: 2500 }
];
