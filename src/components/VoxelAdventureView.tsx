import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Play, 
  HelpCircle, 
  Moon, 
  Sun, 
  Wind, 
  Thermometer, 
  Sparkles, 
  Trophy, 
  Layers, 
  Flame, 
  Heart, 
  ShoppingBag, 
  Plus, 
  Users, 
  Send, 
  Zap, 
  Volume2, 
  VolumeX, 
  Clock, 
  Settings, 
  Activity,
  ZapOff,
  Maximize2,
  Minimize2,
  Smartphone,
  Cpu
} from 'lucide-react';
import { doc, updateDoc, increment, collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface VoxelAdventureViewProps {
  user: any;
  myProfile: any;
  db: any;
  onClose: () => void;
  triggerToast: (type: 'quest' | 'xp' | 'level', title: string, description: string, options?: any) => void;
  userProfiles: any[];
}

interface Tile {
  x: number;
  y: number;
  type: 'grass' | 'sand' | 'volcanic_rock' | 'tree' | 'flower' | 'stone' | 'water' | 'lava' | 'iron' | 'coal' | 'gold' | 'diamond' | 'emerald' | 'uranium' | 'iridium' | 'wall' | 'door';
  health: number;
  maxHealth: number;
  broken?: boolean;
  biome: 'grassland' | 'desert' | 'volcanic';
  customId?: string;
}

interface ItemDrop {
  id: string;
  x: number;
  y: number;
  type: string;
  amount: number;
  speedX: number;
  speedY: number;
  collected?: boolean;
}

interface PlacedMachine {
  id: string;
  x: number;
  y: number;
  type: string;
  energyLevel: number;
  maxEnergy: number;
  lastTick: number;
  productionProgress: number;
  health: number;
  maxHealth: number;
}

interface ShopItem {
  id: string;
  name: string;
  category: 'Spitzhaken' | 'Maschinen' | 'Basenbau' | 'Exo-Suits';
  description: string;
  price: number;
  costResource: 'wood' | 'stone' | 'coal' | 'iron' | 'gold' | 'diamond' | 'uranium' | 'iridium' | 'power';
  produce: string;
  damage?: number;
  consume: string;
  levelRequired: number;
  imageColor: string;
  itemType: 'tool' | 'building' | 'armor';
  icon: string;
}

interface OpponentBot {
  id: string;
  name: string;
  x: number;
  y: number;
  speed: number;
  health: number;
  maxHealth: number;
  color: string;
  targetX: number;
  targetY: number;
  isMining: boolean;
  swingAngle: number;
  cash: number;
}

export const VoxelAdventureView: React.FC<VoxelAdventureViewProps> = ({
  user,
  myProfile,
  db,
  onClose,
  triggerToast,
  userProfiles
}) => {
  // Sound mode state
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    return localStorage.getItem('isMuted') === 'true';
  });

  // Hotbar configurations matching prototype slots
  // Slot 1: Tool (Pickaxe/Drill)
  // Slot 2: Energy Generation
  // Slot 3: Automation Miner Drills
  // Slot 4: Automated Selling depots
  // Slot 5: Base building walls, doors and defensive Tesla coils
  const [selectedHotbarIndex, setSelectedHotbarIndex] = useState<number>(0);

  const [activeSlotEquipped, setActiveSlotEquipped] = useState<{ [key: number]: string }>({
    1: 'solar',
    2: 'miner',
    3: 'seller',
    4: 'wall'
  });

  const slotCategories: { [key: number]: string[] } = {
    1: ['solar', 'adv_solar', 'wind', 'coal_gen', 'geo_gen', 'water_gen', 'oil_gen', 'nuke_gen'],
    2: ['miner', 'iron_miner', 'gold_miner', 'diamond_miner', 'uranium_miner', 'iridium_miner'],
    3: ['seller', 'big_seller', 'coal_seller', 'iron_seller', 'gold_seller', 'diamond_seller', 'uranium_seller', 'iridium_seller'],
    4: ['wall', 'obsidian_wall', 'reinforced_wall', 'iron_door', 'obsidian_door', 'reinforced_door', 'electric_door', 'tesla_1000', 'tesla_2000', 'tesla_3000', 'bed', 'sign']
  };

  const [openSelectorIndex, setOpenSelectorIndex] = useState<number | null>(null);

  // Inventories tracking
  const [coins, setCoins] = useState<number>(myProfile?.coins || 150);
  const [xp, setXp] = useState<number>(myProfile?.xp || 0);
  const [lvl, setLvl] = useState<number>(1);
  const [energy, setEnergy] = useState<number>(100);
  const [health, setHealth] = useState<number>(100);
  const [maxHealth, setMaxHealth] = useState<number>(100);

  // Raw resources values
  const [resources, setResources] = useState<{ [key: string]: number }>({
    wood: 15,
    stone: 5,
    coal: 5,
    iron: 0,
    gold: 0,
    diamond: 0,
    uranium: 0,
    iridium: 0,
    power: 20
  });

  // Placed automated machines tracking
  const [placedMachines, setPlacedMachines] = useState<PlacedMachine[]>([]);
  const [droppingParticles, setDroppingParticles] = useState<ItemDrop[]>([]);

  // Building Inventory reserves (counts available for placement slot 2-5)
  const [buildInventory, setBuildInventory] = useState<{ [key: string]: number }>({
    solar: 4,
    adv_solar: 1,
    wind: 2,
    coal_gen: 2,
    miner: 2,
    iron_miner: 1,
    seller: 2,
    big_seller: 1,
    wall: 16,
    obsidian_wall: 4,
    tesla_1000: 2
  });

  // Equipped Armors & abilities
  const [equippedArmor, setEquippedArmor] = useState<'none' | 'nano' | 'quantum'>('none');
  const [hasJetpack, setHasJetpack] = useState<boolean>(false);
  const [isJetpackActive, setIsJetpackActive] = useState<boolean>(false);

  // Active user tool upgrade properties
  const [currentTool, setCurrentTool] = useState<{ id: string; name: string; damage: number; power: number; label: string; color: string }>({
    id: 'wooden_pick',
    name: 'Holz-Spitzhacke',
    damage: 10,
    power: 1,
    label: '⛏️',
    color: '#8b5a2b'
  });

  // Dynamic selected placeable machine/tool per slot category (MineEnergy 1 & 2 Upgrade)
  const [selectedEquipment, setSelectedEquipment] = useState<{ [key: number]: string }>({
    0: 'wooden_pick',
    1: 'solar',
    2: 'miner',
    3: 'seller',
    4: 'wall'
  });

  const selectActiveEquipment = (catIdx: number, itemId: string) => {
    setSelectedEquipment(prev => ({ ...prev, [catIdx]: itemId }));
    if (catIdx === 0) {
      const item = shopDatabase.find(x => x.id === itemId);
      if (item) {
        setCurrentTool({
          id: item.id,
          name: item.name,
          damage: item.damage || 10,
          power: item.id === 'iron_pick' ? 2 : (item.id === 'drill' ? 2 : (item.id === 'dia_drill' ? 3 : (item.id === 'iridium_drill' ? 5 : 1))),
          label: item.icon,
          color: item.imageColor
        });
        addLog(`⛏️ Hauptwerkzeug gewechselt zu: ${item.name}`);
      } else if (itemId === 'wooden_pick') {
        setCurrentTool({
          id: 'wooden_pick',
          name: 'Holz-Spitzhacke',
          damage: 10,
          power: 1,
          label: '⛏️',
          color: '#8b5a2b'
        });
        addLog(`⛏️ Hauptwerkzeug gewechselt zu: Holz-Spitzhacke`);
      }
    }
  };

  // Modal screen panels
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [shopTab, setShopTab] = useState<'tools' | 'machines' | 'build' | 'armor'>('tools');
  const [isClansOpen, setIsClansOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMobileMode, setIsMobileMode] = useState<boolean>(() => {
    return ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  });
  const [isChatVisible, setIsChatVisible] = useState(() => !('ontouchstart' in window || navigator.maxTouchPoints > 0));
  const [isInventoryVisible, setIsInventoryVisible] = useState(() => !('ontouchstart' in window || navigator.maxTouchPoints > 0));

  // World environment & clima values
  const [gameTime, setGameTime] = useState<{ hour: number; minute: number }>({ hour: 11, minute: 30 });
  const [windSpeed, setWindSpeed] = useState<number>(6);
  const [temperature, setTemperature] = useState<number>(22);
  const [isRaining, setIsRaining] = useState<boolean>(false);

  // Chat window panel data
  const [logs, setLogs] = useState<string[]>([]);
  const [chatInput, setChatInput] = useState<string>('');

  // Player position states (held inside persistent refs for performance animation-loops)
  const playerRef = useRef({
    x: 1000,
    y: 1000,
    speed: 4,
    size: 34,
    angle: 0,
    swinging: false,
    swingTimer: 0
  });

  // Arena Dimensions
  const tileSize = 64;
  const mapSize = 40; // 40x40 grid = 2560px arena width
  const worldSize = { width: mapSize * tileSize, height: mapSize * tileSize };
  const [tiles, setTiles] = useState<Tile[]>([]);

  // System canvas tracking
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const mousePosRef = useRef({ x: 0, y: 0 });

  // High-performance visual effects (vivid MineEnergy style particles, floaters & shake)
  const fxSparksRef = useRef<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: string;
    size: number;
    alpha: number;
    maxLife: number;
    life: number;
    glow?: boolean;
    shape?: 'circle' | 'square' | 'spark';
  }[]>([]);

  const fxFloatersRef = useRef<{
    x: number;
    y: number;
    text: string;
    color: string;
    alpha: number;
    life: number;
    maxLife: number;
    vy: number;
  }[]>([]);

  const visualShakeRef = useRef({ x: 0, y: 0, intensity: 0 });

  // Add visual sparks helper
  const addSparksFX = (x: number, y: number, color: string, count = 8, scale = 1.0, isGlowing = false, shape: 'circle' | 'square' | 'spark' = 'circle') => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (2 + Math.random() * 5) * scale;
      fxSparksRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (Math.random() * 1.5),
        color,
        size: (1.2 + Math.random() * 2.8) * scale,
        alpha: 1.0,
        maxLife: 15 + Math.floor(Math.random() * 20),
        life: 0,
        glow: isGlowing,
        shape
      });
    }
  };

  // Add floating label helper
  const addFloaterFX = (x: number, y: number, text: string, color = '#ffffff') => {
    fxFloatersRef.current.push({
      x,
      y,
      text,
      color,
      alpha: 1.0,
      life: 0,
      maxLife: 45,
      vy: -1.2 - Math.random() * 1.0
    });
  };

  // Screen shake helper
  const triggerScreenShake = (intensity: number) => {
    visualShakeRef.current.intensity = Math.max(visualShakeRef.current.intensity, intensity);
  };

  // Multiplayer opponent bots simulations
  const [botsList, setBotsList] = useState<OpponentBot[]>([
    { id: 'bot_1', name: 'Join11Lennon_io', x: 1200, y: 880, speed: 2.2, health: 100, maxHealth: 100, color: '#00e5ff', targetX: 1200, targetY: 880, isMining: false, swingAngle: 0, cash: 9400 },
    { id: 'bot_2', name: 'SteveMaster', x: 800, y: 1500, speed: 1.8, health: 100, maxHealth: 100, color: '#ec4899', targetX: 780, targetY: 1520, isMining: true, swingAngle: 0, cash: 4300 },
    { id: 'bot_3', name: 'Maximus_VIP', x: 1600, y: 1200, speed: 2.5, health: 100, maxHealth: 100, color: '#4CAF50', targetX: 1650, targetY: 1180, isMining: false, swingAngle: 0, cash: 5200 }
  ]);

  // Fake static leaderboard scores list
  const [leaderboard, setLeaderboard] = useState<any[]>([
    { name: 'Join11Lennon_io', money: 9400 },
    { name: 'Maximus_VIP', money: 5200 },
    { name: 'SteveMaster', money: 4300 },
    { name: 'Du (Spieler)', money: 150, isPlayer: true }
  ]);

  // Shop Database matching both the video specs and prototype features
  const shopDatabase: ShopItem[] = [
    // Tab 1: TOOLS (Spitzhacken & Bohrer)
    { id: 'iron_pick', name: 'Eisen-Spitzhacke', category: 'Spitzhaken', description: 'Mining-Werkzeug. Baut Steine und Kohle doppelt so schnell ab.', price: 100, costResource: 'stone', damage: 25, produce: '+2 Schaden pro Schlag', consume: 'Keine', levelRequired: 1, imageColor: '#cbd5e1', itemType: 'tool', icon: '⛏️' },
    { id: 'drill', name: 'Drill', category: 'Spitzhaken', description: 'Elektrisches Bohrwerkzeug.', price: 1500, costResource: 'coal', damage: 40, produce: '+5 Schaden', consume: '1 Energie pro Sek', levelRequired: 2, imageColor: '#fb923c', itemType: 'tool', icon: '🔧' },
    { id: 'dia_drill', name: 'Diamond drill', category: 'Spitzhaken', description: 'Elektrisches Abbauwunder. Zerschmettert Erze extrem rasant.', price: 25000, costResource: 'iron', damage: 60, produce: '+8 Schaden pro Takt', consume: '3 Energie pro Sek', levelRequired: 3, imageColor: '#22d3ee', itemType: 'tool', icon: '⚙️' },
    { id: 'iridium_drill', name: 'Iridium drill', category: 'Spitzhaken', description: 'Bester Bohrer im Spiel.', price: 1000000, costResource: 'gold', damage: 150, produce: '+20 Schaden', consume: '5 Energie pro Sek', levelRequired: 5, imageColor: '#f43f5e', itemType: 'tool', icon: '🔩' },
    { id: 'wrench', name: 'Wrench', category: 'Spitzhaken', description: 'Schraubenschlüssel zur Reparatur.', price: 500, costResource: 'iron', damage: 10, produce: 'Repariert Blocks', consume: 'Keine', levelRequired: 1, imageColor: '#94a3b8', itemType: 'tool', icon: '🔧' },
    { id: 'trowel', name: 'Trowel', category: 'Spitzhaken', description: 'Maurerkelle.', price: 200, costResource: 'wood', damage: 5, produce: 'Baut Wände', consume: 'Keine', levelRequired: 1, imageColor: '#d6d3d1', itemType: 'tool', icon: '⛏️' },

    // Tab 2: MACHINES (Generatoren & Wirtschaft - Sellers)
    { id: 'seller', name: 'Small seller', category: 'Maschinen', description: 'Verkauft Ressourcen.', price: 100, costResource: 'wood', produce: '+1 Cash / Tick', consume: '1 ⚡ Strom / Tick', levelRequired: 1, imageColor: '#a3e635', itemType: 'building', icon: '💵' },
    { id: 'big_seller', name: 'Big seller', category: 'Maschinen', description: 'Verkauft mehr Ressourcen.', price: 1500, costResource: 'stone', produce: '+5 Cash / Tick', consume: '4 ⚡ Strom / Tick', levelRequired: 2, imageColor: '#4ade80', itemType: 'building', icon: '💰' },
    { id: 'coal_seller', name: 'Coal seller', category: 'Maschinen', description: 'Verkauft Kohle automatisch.', price: 5000, costResource: 'coal', produce: '+10 Cash / Tick', consume: '2 ⚡ Strom / Tick', levelRequired: 3, imageColor: '#374151', itemType: 'building', icon: '⬛' },
    { id: 'iron_seller', name: 'Iron seller', category: 'Maschinen', description: 'Verkauft Eisen automatisch.', price: 20000, costResource: 'iron', produce: '+25 Cash / Tick', consume: '3 ⚡ Strom / Tick', levelRequired: 4, imageColor: '#94a3b8', itemType: 'building', icon: '⬜' },
    { id: 'gold_seller', name: 'Gold seller', category: 'Maschinen', description: 'Verkauft Gold automatisch.', price: 100000, costResource: 'gold', produce: '+50 Cash / Tick', consume: '5 ⚡ Strom / Tick', levelRequired: 5, imageColor: '#facc15', itemType: 'building', icon: '🟨' },
    { id: 'diamond_seller', name: 'Diamond seller', category: 'Maschinen', description: 'Verkauft Diamanten automatisch.', price: 500000, costResource: 'diamond', produce: '+150 Cash / Tick', consume: '10 ⚡ Strom / Tick', levelRequired: 6, imageColor: '#22d3ee', itemType: 'building', icon: '💎' },
    { id: 'uranium_seller', name: 'Uranium seller', category: 'Maschinen', description: 'Verkauft Uran automatisch.', price: 2000000, costResource: 'uranium', produce: '+400 Cash / Tick', consume: '20 ⚡ Strom / Tick', levelRequired: 7, imageColor: '#4ade80', itemType: 'building', icon: '☢️' },
    { id: 'iridium_seller', name: 'Iridium seller', category: 'Maschinen', description: 'Verkauft Iridium.', price: 10000000, costResource: 'iridium', produce: '+1000 Cash / Tick', consume: '50 ⚡ Strom / Tick', levelRequired: 8, imageColor: '#f43f5e', itemType: 'building', icon: '🟣' },

    // Tab 2: MACHINES (Miners)
    { id: 'miner', name: 'Coal miner', category: 'Maschinen', description: 'Baut automatisch Kohle ab.', price: 100, costResource: 'wood', produce: '+1 Kohle / Tick', consume: '1 ⚡ Strom / Tick', levelRequired: 1, imageColor: '#374151', itemType: 'building', icon: '⛏️' },
    { id: 'iron_miner', name: 'Iron miner', category: 'Maschinen', description: 'Baut automatisch Eisen ab.', price: 800, costResource: 'stone', produce: '+1 Eisen / Tick', consume: '2 ⚡ Strom / Tick', levelRequired: 2, imageColor: '#94a3b8', itemType: 'building', icon: '⛏️' },
    { id: 'gold_miner', name: 'Gold miner', category: 'Maschinen', description: 'Baut Gold ab.', price: 5000, costResource: 'iron', produce: '+1 Gold / Tick', consume: '5 ⚡ Strom / Tick', levelRequired: 3, imageColor: '#facc15', itemType: 'building', icon: '⛏️' },
    { id: 'diamond_miner', name: 'Diamond miner', category: 'Maschinen', description: 'Baut Diamanten ab.', price: 20000, costResource: 'gold', produce: '+1 Diamant / Tick', consume: '10 ⚡ Strom / Tick', levelRequired: 4, imageColor: '#22d3ee', itemType: 'building', icon: '⛏️' },
    { id: 'uranium_miner', name: 'Uranium miner', category: 'Maschinen', description: 'Baut Uran ab.', price: 100000, costResource: 'diamond', produce: '+1 Uran / Tick', consume: '25 ⚡ Strom / Tick', levelRequired: 5, imageColor: '#4ade80', itemType: 'building', icon: '⛏️' },
    { id: 'iridium_miner', name: 'Iridium miner', category: 'Maschinen', description: 'Baut Iridium ab.', price: 500000, costResource: 'uranium', produce: '+1 Iridium / Tick', consume: '50 ⚡ Strom / Tick', levelRequired: 6, imageColor: '#f43f5e', itemType: 'building', icon: '⛏️' },

    // Tab 2: MACHINES (Generators)
    { id: 'solar', name: 'Solar panel', category: 'Maschinen', description: 'Produziert kontinuierlich Strom (+5 Watt) während der Sonnenstunden.', price: 100, costResource: 'wood', produce: '+5 ⚡ Strom / Tick', consume: 'Tageslicht', levelRequired: 1, imageColor: '#3b82f6', itemType: 'building', icon: '☀️' },
    { id: 'adv_solar', name: 'Advanced solar panel', category: 'Maschinen', description: 'Stärkeres Solarpanel.', price: 5000, costResource: 'stone', produce: '+15 ⚡ Strom / Tick', consume: 'Tageslicht', levelRequired: 2, imageColor: '#2563eb', itemType: 'building', icon: '🌞' },
    { id: 'wind', name: 'Wind generator', category: 'Maschinen', description: 'Erzeugt Energie abhängig von Wind.', price: 200, costResource: 'stone', produce: 'Variable ⚡ Strom', consume: 'Windstärke', levelRequired: 2, imageColor: '#10b981', itemType: 'building', icon: '🌀' },
    { id: 'coal_gen', name: 'Coal generator', category: 'Maschinen', description: 'Verbrennt Kohle für Strom.', price: 100, costResource: 'wood', produce: '+10 ⚡ Strom / Tick', consume: 'Kohle', levelRequired: 1, imageColor: '#4b5563', itemType: 'building', icon: '🔥' },
    { id: 'geo_gen', name: 'Geothermal generator', category: 'Maschinen', description: 'Nutzt Erdwärme.', price: 5000, costResource: 'iron', produce: '+20 ⚡ Strom / Tick', consume: 'Lava Nähe', levelRequired: 3, imageColor: '#ef4444', itemType: 'building', icon: '🌋' },
    { id: 'water_gen', name: 'Water generator', category: 'Maschinen', description: 'Nutzt Wasserkraft.', price: 5000, costResource: 'iron', produce: '+15 ⚡ Strom / Tick', consume: 'Wasser Nähe', levelRequired: 3, imageColor: '#3b82f6', itemType: 'building', icon: '🌊' },
    { id: 'oil_gen', name: 'Oil generator', category: 'Maschinen', description: 'Verbrennt Öl.', price: 50000, costResource: 'gold', produce: '+50 ⚡ Strom / Tick', consume: 'Öl', levelRequired: 5, imageColor: '#1f2937', itemType: 'building', icon: '🛢️' },
    { id: 'nuke_gen', name: 'Nuclear reactor', category: 'Maschinen', description: 'Kernreaktor für massig Energie.', price: 1000000, costResource: 'uranium', produce: '+500 ⚡ Strom / Tick', consume: 'Uranium, Wasser', levelRequired: 7, imageColor: '#22c55e', itemType: 'building', icon: '☢️' },

    // Tab 3: BASENBAU (Shields & Barrikaden)
    { id: 'wall', name: 'Iron wall', category: 'Basenbau', description: 'Grundlegende Mauer.', price: 50, costResource: 'wood', produce: 'Defensiv-Schutz (HP: 100)', consume: 'Keine', levelRequired: 1, imageColor: '#9e9e9e', itemType: 'building', icon: '🧱' },
    { id: 'obsidian_wall', name: 'Obsidian wall', category: 'Basenbau', description: 'Stabile Mauer.', price: 1000, costResource: 'stone', produce: 'Defensiv-Schutz (HP: 500)', consume: 'Keine', levelRequired: 2, imageColor: '#3b0764', itemType: 'building', icon: '🧱' },
    { id: 'reinforced_wall', name: 'Reinforced wall', category: 'Basenbau', description: 'Sehr starke Mauer.', price: 5000, costResource: 'iron', produce: 'Defensiv-Schutz (HP: 1000)', consume: 'Keine', levelRequired: 3, imageColor: '#475569', itemType: 'building', icon: '🧱' },
    { id: 'iron_door', name: 'Iron door', category: 'Basenbau', description: 'Eisentür.', price: 100, costResource: 'wood', produce: 'Tür (HP: 100)', consume: 'Keine', levelRequired: 1, imageColor: '#9e9e9e', itemType: 'building', icon: '🚪' },
    { id: 'obsidian_door', name: 'Obsidian door', category: 'Basenbau', description: 'Obsidiantür.', price: 2000, costResource: 'stone', produce: 'Tür (HP: 500)', consume: 'Keine', levelRequired: 2, imageColor: '#3b0764', itemType: 'building', icon: '🚪' },
    { id: 'reinforced_door', name: 'Reinforced door', category: 'Basenbau', description: 'Verstärkte Tür.', price: 10000, costResource: 'iron', produce: 'Tür (HP: 1000)', consume: 'Keine', levelRequired: 3, imageColor: '#475569', itemType: 'building', icon: '🚪' },
    { id: 'electric_door', name: 'Electric Iridium door', category: 'Basenbau', description: 'Beste Tür.', price: 50000, costResource: 'iridium', produce: 'Tür (HP: 2000)', consume: '1 ⚡ Strom / Tick', levelRequired: 5, imageColor: '#f43f5e', itemType: 'building', icon: '🚪' },
    { id: 'tesla_1000', name: 'Tesla coil 1000', category: 'Basenbau', description: 'Schießt auf Feinde.', price: 5000, costResource: 'iron', produce: 'Schaden: 25', consume: '5 ⚡ Strom', levelRequired: 4, imageColor: '#3b82f6', itemType: 'building', icon: '⚡' },
    { id: 'tesla_2000', name: 'Tesla coil 2000', category: 'Basenbau', description: 'Stärkere Tesla Spule.', price: 25000, costResource: 'gold', produce: 'Schaden: 50', consume: '10 ⚡ Strom', levelRequired: 5, imageColor: '#2563eb', itemType: 'building', icon: '⚡' },
    { id: 'tesla_3000', name: 'Tesla coil 3000', category: 'Basenbau', description: 'Stärkste Tesla Spule.', price: 500000, costResource: 'diamond', produce: 'Schaden: 100', consume: '20 ⚡ Strom', levelRequired: 7, imageColor: '#1d4ed8', itemType: 'building', icon: '⚡' },
    { id: 'bed', name: 'Bed', category: 'Basenbau', description: 'Respawn Punkt.', price: 1000, costResource: 'wood', produce: 'Respawn', consume: 'Keine', levelRequired: 1, imageColor: '#ef4444', itemType: 'building', icon: '🛏️' },
    { id: 'sign', name: 'Sign', category: 'Basenbau', description: 'Schild zum Schreiben.', price: 300, costResource: 'wood', produce: 'Text', consume: 'Keine', levelRequired: 1, imageColor: '#d97706', itemType: 'building', icon: '📝' },

    // Tab 4: SUITS (Exoskelett & Flugkraft)
    { id: 'leather_armor', name: 'Leather armor', category: 'Exo-Suits', description: 'Einfache Rüstung.', price: 50, costResource: 'wood', produce: '10% Schutz', consume: 'Keine', levelRequired: 1, imageColor: '#8b5a2b', itemType: 'armor', icon: '👕' },
    { id: 'iron_armor', name: 'Iron armor', category: 'Exo-Suits', description: 'Eisen Rüstung.', price: 1000, costResource: 'iron', produce: '20% Schutz', consume: 'Keine', levelRequired: 2, imageColor: '#cbd5e1', itemType: 'armor', icon: '🛡️' },
    { id: 'gold_armor', name: 'Gold armor', category: 'Exo-Suits', description: 'Gold Rüstung.', price: 5000, costResource: 'gold', produce: '30% Schutz', consume: 'Keine', levelRequired: 3, imageColor: '#facc15', itemType: 'armor', icon: '🛡️' },
    { id: 'diamond_armor', name: 'Diamond armor', category: 'Exo-Suits', description: 'Diamant Rüstung.', price: 25000, costResource: 'diamond', produce: '50% Schutz', consume: 'Keine', levelRequired: 4, imageColor: '#22d3ee', itemType: 'armor', icon: '🛡️' },
    { id: 'suit_nano', name: 'Nano armor', category: 'Exo-Suits', description: 'Integrierte Pufferbatterie. Kompensiert 40% des eingesteckten Schadens.', price: 1000000, costResource: 'coal', produce: '40% Schadens-Absorption', consume: '2 Energie / Treffer', levelRequired: 5, imageColor: '#16a34a', itemType: 'armor', icon: '🤖' },
    { id: 'suit_quantum', name: 'Quantum armor', category: 'Exo-Suits', description: 'Das nonplusultra militärische Outfit. Absorbiert 85% Strahlenschaden.', price: 5000000, costResource: 'iron', produce: '85% Strahlenschutz', consume: '5 Energie / Treffer', levelRequired: 6, imageColor: '#8b5cf6', itemType: 'armor', icon: '🔮' },
    { id: 'utility_jetpack', name: 'Jetpack', category: 'Exo-Suits', description: 'Erlaubt freies Schweben im Raum über Lava und Abyss hinweg. Turbo-Geschwindigkeit.', price: 3000000, costResource: 'diamond', produce: 'Fliegen über Gras & Lava', consume: '10 Energie / Laufsekunde', levelRequired: 5, imageColor: '#f43f5e', itemType: 'armor', icon: '🚀' }
  ];

  // Helper adding clean formatted log rows
  const addLog = (text: string) => {
    setLogs(p => [text, ...p.slice(0, 40)]);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        containerRef.current.requestFullscreen().then(() => {
          setIsFullscreen(true);
        }).catch((err) => {
          console.error("Fullscreen error", err);
          triggerToast('xp', '🖥️ VOLLBILD BLOCKIERT', 'Öffne die App im neuen Tab für unbegrenzten Vollbildmodus!');
        });
      } else {
        document.exitFullscreen().then(() => {
          setIsFullscreen(false);
        }).catch(() => {});
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleMuted = () => {
    const next = !isMuted;
    setIsMuted(next);
    localStorage.setItem('isMuted', String(next));
  };

  // Sound Synth Generator helper
  const playRetroSound = (type: 'hit' | 'mine' | 'buy' | 'hurt' | 'levelUp' | 'powerup' | 'place') => {
    if (isMuted) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'hit') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(120, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start(); osc.stop(audioCtx.currentTime + 0.11);
      } else if (type === 'mine') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(250, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(800, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        osc.start(); osc.stop(audioCtx.currentTime + 0.16);
      } else if (type === 'buy') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(330, audioCtx.currentTime);
        osc.frequency.setValueAtTime(440, audioCtx.currentTime + 0.08);
        osc.frequency.setValueAtTime(660, audioCtx.currentTime + 0.16);
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
        osc.start(); osc.stop(audioCtx.currentTime + 0.26);
      } else if (type === 'place') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(180, audioCtx.currentTime);
        osc.frequency.setValueAtTime(90, audioCtx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.18);
        osc.start(); osc.stop(audioCtx.currentTime + 0.19);
      } else if (type === 'hurt') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(80, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(20, audioCtx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.22);
        osc.start(); osc.stop(audioCtx.currentTime + 0.23);
      } else if (type === 'levelUp') {
        osc.type = 'sine';
        const notes = [261, 329, 392, 523, 659, 783];
        notes.forEach((f, i) => {
          osc.frequency.setValueAtTime(f, audioCtx.currentTime + i * 0.06);
        });
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.45);
        osc.start(); osc.stop(audioCtx.currentTime + 0.46);
      } else if (type === 'powerup') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(180, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1000, audioCtx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start(); osc.stop(audioCtx.currentTime + 0.31);
      }
    } catch (e) {
      // Ignored browser context audio lock-guards
    }
  };

  // Sync profile data fields initially
  useEffect(() => {
    if (myProfile?.coins !== undefined) setCoins(myProfile.coins);
    if (myProfile?.xp !== undefined) {
      setXp(myProfile.xp);
      const calculatedLvl = Math.max(1, Math.floor(Math.sqrt(myProfile.xp / 100)) + 1);
      setLvl(calculatedLvl);
      setMaxHealth(100 + calculatedLvl * 10);
    }
  }, [myProfile]);

  // Procedural 2D Voxel map generator of biome regions
  useEffect(() => {
    const generated: Tile[] = [];
    const seedX = Math.random() * 200;
    const seedY = Math.random() * 200;

    for (let x = 0; x < mapSize; x++) {
      for (let y = 0; y < mapSize; y++) {
        const absX = x * tileSize;
        const absY = y * tileSize;

        // Protection map boundaries
        if (x === 0 || y === 0 || x === mapSize - 1 || y === mapSize - 1) {
          generated.push({ x: absX, y: absY, type: 'stone', health: 120, maxHealth: 120, biome: 'grassland' });
          continue;
        }

        let biome: Tile['biome'] = 'grassland';
        let type: Tile['type'] = 'grass';
        let health = 15;
        let maxHealth = 15;

        // Assign biome bands
        if (y < 12) {
          biome = 'desert';
          type = 'sand';
        } else if (y > 27) {
          biome = 'volcanic';
          type = 'volcanic_rock';
        }

        // Noise generators patterns simulation
        const noise = Math.sin(x * 0.4 + seedX) * Math.cos(y * 0.4 + seedY);
        const oreRoll = Math.random();

        if (biome === 'desert') {
          if (noise < -0.4) {
            type = 'water'; health = 9999; maxHealth = 9999;
          } else if (noise > 0.45) {
            type = 'stone'; health = 25; maxHealth = 25;
          } else if (oreRoll > 0.98) {
            type = 'gold'; health = 30; maxHealth = 30;
          } else if (oreRoll > 0.94) {
            type = 'coal'; health = 20; maxHealth = 20;
          } else if (oreRoll > 0.90) {
            type = 'iron'; health = 25; maxHealth = 25;
          }
        } else if (biome === 'volcanic') {
          if (noise < -0.35) {
            type = 'lava'; health = 9999; maxHealth = 9999;
          } else if (noise > 0.4) {
            type = 'stone'; health = 40; maxHealth = 40;
          } else if (oreRoll > 0.99) {
            type = 'iridium'; health = 100; maxHealth = 100;
          } else if (oreRoll > 0.97) {
            type = 'uranium'; health = 80; maxHealth = 80;
          } else if (oreRoll > 0.94) {
            type = 'diamond'; health = 60; maxHealth = 60;
          } else if (oreRoll > 0.88) {
            type = 'coal'; health = 30; maxHealth = 30;
          }
        } else {
          // Grasslands
          if (noise < -0.45) {
            type = 'water'; health = 9999; maxHealth = 9999;
          } else if (noise > 0.5) {
            type = 'stone'; health = 30; maxHealth = 30;
          } else if (oreRoll > 0.985) {
            type = 'emerald'; health = 70; maxHealth = 70;
          } else if (oreRoll > 0.96) {
            type = 'gold'; health = 40; maxHealth = 40;
          } else if (oreRoll > 0.91) {
            type = 'iron'; health = 30; maxHealth = 30;
          } else if (oreRoll > 0.78) {
            type = 'tree'; health = 15; maxHealth = 15;
          } else if (oreRoll > 0.72) {
            type = 'flower'; health = 5; maxHealth = 5;
          }
        }

        // Keep center spawning zone clear
        if (x > 12 && x < 28 && y > 12 && y < 28) {
          type = 'grass';
          biome = 'grassland';
        }

        generated.push({ x: absX, y: absY, type, health, maxHealth, biome });
      }
    }

    setTiles(generated);
    addLog('✨ [SYSTEM] MineEnergy Arena initialisiert! WASD zum Bewegen. Tab [1-5] für Hotbar.');
    addLog('💡 Tutorial: Baue Baumstämme 🪵 oder Steine 🪨 ab. Drücke [B] für den Trade-Shop!');
  }, []);

  // Window resize to Canvas binding
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas || !containerRef.current) return;
      canvas.width = containerRef.current.clientWidth;
      canvas.height = Math.max(500, containerRef.current.clientHeight);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Track Keys input events mapping
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') {
        if (e.key === 'Enter') handleChatSubmit();
        return;
      }
      if (e.key === 'Enter') {
        const input = document.getElementById('chat-input-g');
        input?.focus();
        return;
      }

      keysPressed.current[e.key.toLowerCase()] = true;

      // Numeric hotbar hotkeys (1-5)
      if (['1', '2', '3', '4', '5'].includes(e.key)) {
        const idx = parseInt(e.key) - 1;
        setSelectedHotbarIndex(idx);
        playRetroSound('hit');
      }

      if (e.key.toLowerCase() === 'b') {
        setIsShopOpen(p => !p);
        playRetroSound('buy');
      }
      if (e.key.toLowerCase() === 't') {
        setIsClansOpen(p => !p);
        playRetroSound('buy');
      }
      if (e.key.toLowerCase() === 'j' || e.key === ' ') {
        if (!hasJetpack) {
          triggerToast('xp', '🔒 KEIN JETPACK', 'Schalte erst die Jetpack-Technologie im Trade-Shop frei!');
          playRetroSound('hurt');
          return;
        }
        setIsJetpackActive(p => {
          const next = !p;
          addLog(next ? '🚀 Jetpack gestartet! Du fliegst rasant über Lava & Gräben.' : '🚀 Jetpack abgeschaltet.');
          return next;
        });
        playRetroSound('powerup');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [chatInput]);

  // Track cursor direction rotation
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      mousePosRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Infinite physics ticks thread
  useEffect(() => {
    let animFrame: number;
    let autoSaveTimer = 0;

    const tick = (timestamp: number) => {
      const player = playerRef.current;

      // 1. Time & Weather cycles incrementor
      autoSaveTimer++;
      if (autoSaveTimer >= 30) {
        autoSaveTimer = 0;
        setGameTime(prev => {
          let min = prev.minute + 1;
          let hr = prev.hour;
          if (min >= 60) {
            min = 0;
            hr = (hr + 1) % 24;

            // Vary windspeed and temperature
            setWindSpeed(Math.max(2, Math.min(22, Math.floor(windSpeed + (Math.random() * 4 - 2)))));
            setTemperature(Math.max(-5, Math.min(42, Math.floor(temperature + (Math.random() * 2 - 1)))));

            // Shift rainy status
            if (Math.random() > 0.88) {
              const nextRainState = !isRaining;
              setIsRaining(nextRainState);
              addLog(nextRainState ? '🌧️ Es zieht ein Gewitter auf! Solarausbeute minimiert.' : '☀️ Der Sturm bricht! Wind turbulenzen beruhigen sich.');
            }
          }
          return { hour: hr, minute: min };
        });
      }

      // 2. Physics WASD coordinate shifting
      let mx = 0;
      let my = 0;
      const activeSpeed = isJetpackActive && energy > 5 ? player.speed * 2.5 : player.speed;

      if (keysPressed.current['w'] || keysPressed.current['arrowup']) my = -activeSpeed;
      if (keysPressed.current['s'] || keysPressed.current['arrowdown']) my = activeSpeed;
      if (keysPressed.current['a'] || keysPressed.current['arrowleft']) mx = -activeSpeed;
      if (keysPressed.current['d'] || keysPressed.current['arrowright']) mx = activeSpeed;

      // Diagonal vector normalization
      if (mx !== 0 && my !== 0) {
        mx *= 0.7071;
        my *= 0.7071;
      }

      // Update player face angle based on walking direction if moving
      if (mx !== 0 || my !== 0) {
        player.angle = Math.atan2(my, mx);
      }

      // Check Jetpack fuel drainage
      if (isJetpackActive && (mx !== 0 || my !== 0)) {
        setEnergy(prev => {
          const next = Math.max(0, prev - 0.25);
          if (next <= 0) {
            setIsJetpackActive(false);
            addLog('🚀 Jetpack-Kraftstoff leer! Sinkflug eingeleitet.');
          }
          return next;
        });
      }

      // Check collision bounds
      if (mx !== 0 || my !== 0) {
        const nextX = player.x + mx;
        const nextY = player.y + my;

        let blocked = false;
        if (nextX < tileSize || nextX > worldSize.width - tileSize || nextY < tileSize || nextY > worldSize.height - tileSize) {
          blocked = true;
        }

        // Tile overlap wall and liquid boundaries checks
        const pGridX = Math.floor(nextX / tileSize);
        const pGridY = Math.floor(nextY / tileSize);

        tiles.forEach(tile => {
          if (tile.broken || tile.type === 'grass' || tile.type === 'sand' || tile.type === 'volcanic_rock' || tile.type === 'flower') return;
          
          const tileGridX = Math.floor(tile.x / tileSize);
          const tileGridY = Math.floor(tile.y / tileSize);

          if (pGridX === tileGridX && pGridY === tileGridY) {
            if (tile.type === 'water' || tile.type === 'lava') {
              if (tile.type === 'lava' && !isJetpackActive) {
                // Lava Damage
                setHealth(hp => {
                  const outHp = Math.max(0, hp - 0.5);
                  if (Math.random() < 0.15) {
                    playRetroSound('hurt');
                    addLog('🔥 Autsch! Du brennst in Lava! (-5 HP)');
                  }
                  if (outHp <= 0) {
                    addLog('☠️ Du bist in Lava geschmolzen! Respawn im Grasland.');
                    playerRef.current.x = 1000;
                    playerRef.current.y = 1000;
                    return 100;
                  }
                  return outHp;
                });
              }
            } else {
              blocked = true;
            }
          }
        });

        if (!blocked) {
          player.x = nextX;
          player.y = nextY;
        }
      }

      // Passive hunger/energy decay
      if (energy > 0) {
        setEnergy(p => Math.max(0, p - 0.015));
      }

      // Swing timer decrementation
      if (player.swinging) {
        player.swingTimer--;
        if (player.swingTimer <= 0) player.swinging = false;
      }

      // 3. Magnetic item particles drift attraction
      if (droppingParticles.length > 0) {
        setDroppingParticles(prev => {
          return prev.map(p => {
            if (p.collected) return p;

            const dst = Math.hypot(player.x - p.x, player.y - p.y);
            if (dst < 160) {
              // Magnet pull
              const angle = Math.atan2(player.y - p.y, player.x - p.x);
              return {
                ...p,
                x: p.x + Math.cos(angle) * 8,
                y: p.y + Math.sin(angle) * 8,
                speedX: 0,
                speedY: 0
              };
            } else {
              // Drift friction
              return {
                ...p,
                x: p.x + p.speedX,
                y: p.y + p.speedY,
                speedX: p.speedX * 0.95,
                speedY: p.speedY * 0.95
              };
            }
          });
        });

        // Trigger resource collection overlapping check
        droppingParticles.forEach(p => {
          if (p.collected) return;
          const dstP = Math.hypot(player.x - p.x, player.y - p.y);
          if (dstP < player.size) {
            p.collected = true;
            collectResource(p.type, p.amount);
          }
        });
      }

      // 4. Opponent Bots roaming and active counter-attacking simulation
      setBotsList(prevBots => {
        return prevBots.map(bot => {
          const player = playerRef.current;
          const distToPlayer = Math.hypot(player.x - bot.x, player.y - bot.y);

          let bx = bot.x;
          let by = bot.y;
          let tx = bot.targetX;
          let ty = bot.targetY;
          let mining = bot.isMining;

          // If bot was damaged (health < 100) or close to player (dist < 185px): CHASE!
          const isChasing = (bot.health < 100 || distToPlayer < 185);

          if (isChasing) {
            tx = player.x;
            ty = player.y;
            mining = false; // Focused on combat
          }

          const dist = Math.hypot(tx - bx, ty - by);

          if (isChasing && distToPlayer < 40) {
            // Within threat attack range, stay near player and swing at them!
            mining = true;

            // Attack damage timer cooldown throttle (approx once per 0.75 seconds to be balanced & fair)
            if (Math.random() < 0.022) {
              const dmg = 8 + Math.floor(Math.random() * 5);

              setHealth(hp => {
                const nextHp = Math.max(0, hp - dmg);
                if (nextHp <= 0) {
                  addLog(`☠️ Du wurdest von Dieb <${bot.name}> eliminiert! Respawn im Grasland.`);
                  playerRef.current.x = 1000;
                  playerRef.current.y = 1000;
                  setIsJetpackActive(false);

                  // Penalize client some coins for dying
                  setCoins(c => Math.max(0, Math.floor(c * 0.9)));

                  const derivedLvl = Math.max(1, Math.floor(Math.log2((coins || 1) / 100)) + 1);
                  return 100 + derivedLvl * 10;
                } else {
                  addLog(`⚔️ Dieb <${bot.name}> attackiert dich! (-${dmg} HP)`);
                }
                return nextHp;
              });

              // Combat effects
              addFloaterFX(player.x + (Math.random() * 12 - 6), player.y - 12, `-${dmg} HP`, '#f43f5e');
              addSparksFX(player.x, player.y, '#f43f5e', 8, 1.0, true, 'circle');
              triggerScreenShake(4);
              playRetroSound('hurt');
            }
          } else {
            // Standard roaming behavior
            if (dist < 15) {
              tx = Math.max(200, Math.min(worldSize.width - 200, bot.x + (Math.random() * 400 - 200)));
              ty = Math.max(200, Math.min(worldSize.height - 200, bot.y + (Math.random() * 400 - 200)));
              mining = Math.random() > 0.65;
            } else {
              const angle = Math.atan2(ty - by, tx - bx);
              bx += Math.cos(angle) * bot.speed;
              by += Math.sin(angle) * bot.speed;
            }
          }

          // Generate randomized bot chat messages
          if (Math.random() > 0.9982) {
            const lines = [
              'Leute, der Vulkan im Süden ist voller Diamanten! 💎',
              'Ich baue mir gleich einen Big Seller auf.',
              'Das Jetpack kostet zwar viel, lohnt sich aber total! 🚀',
              'Vielleicht gründe ich bald einen Clan hier.',
              'Achtung vor der Lava! Die ist brandheiß 🔥'
            ];
            addLog(`💬 <${bot.name}> ${lines[Math.floor(Math.random() * lines.length)]}`);
          }

          return {
            ...bot,
            x: bx,
            y: by,
            targetX: tx,
            targetY: ty,
            isMining: mining,
            swingAngle: mining ? Math.sin(Date.now() / 150) * 45 : 0
          };
        });
      });

      // Render updated canvas layout
      drawGame();

      animFrame = requestAnimationFrame(tick);
    };

    animFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrame);
  }, [tiles, droppingParticles, gameTime, windSpeed, temperature, isRaining, isJetpackActive, placedMachines, selectedHotbarIndex]);

  // Helper to check for adjacent tile type matching the ore requirements
  const hasAdjacentTileType = (machX: number, machY: number, targetType: string) => {
    const gridX = Math.round(machX / tileSize);
    const gridY = Math.round(machY / tileSize);

    const targets = [
      { x: gridX, y: gridY },
      { x: gridX + 1, y: gridY },
      { x: gridX - 1, y: gridY },
      { x: gridX, y: gridY + 1 },
      { x: gridX, y: gridY - 1 }
    ];

    return tiles.some(t => {
      const tgX = Math.round(t.x / tileSize);
      const tgY = Math.round(t.y / tileSize);
      return targets.some(tgt => tgt.x === tgX && tgt.y === tgY) && t.type === targetType;
    });
  };

  // Automated core ticking interval for passive machines (generators, miners, sellers)
  useEffect(() => {
    const interval = setInterval(() => {
      let passiveEarnings = 0;

      // Handle machine ticks
      setPlacedMachines(prevList => {
        return prevList.map(mach => {
          let powerDrain = 0;
          let productionProg = mach.productionProgress;
          const mType = mach.type;

          // POWER GENERATORS
          if (mType === 'solar' || mType === 'generator_solar') {
            const dayTime = gameTime.hour >= 6 && gameTime.hour <= 18;
            const yieldAmt = dayTime ? (isRaining ? 1 : 4) : 0;
            if (yieldAmt > 0) {
              setResources(res => ({ ...res, power: Math.min(10000, (res.power || 0) + yieldAmt) }));
            }
          }
          if (mType === 'adv_solar') {
            const dayTime = gameTime.hour >= 6 && gameTime.hour <= 18;
            const yieldAmt = dayTime ? (isRaining ? 3 : 12) : 0;
            if (yieldAmt > 0) {
              setResources(res => ({ ...res, power: Math.min(10000, (res.power || 0) + yieldAmt) }));
            }
          }
          if (mType === 'wind' || mType === 'generator_wind') {
            const yieldWind = Math.floor(windSpeed * 0.4);
            if (yieldWind > 0) {
              setResources(res => ({ ...res, power: Math.min(10000, (res.power || 0) + yieldWind) }));
            }
          }
          if (mType === 'coal_gen') {
            let hasCoal = false;
            setResources(r => {
              if ((r.coal || 0) >= 1) {
                hasCoal = true;
                return { ...r, coal: r.coal - 1, power: Math.min(10000, (r.power || 0) + 15) };
              }
              return r;
            });
            mach.energyLevel = hasCoal ? 100 : 0;
          }
          if (mType === 'geo_gen') {
            const nearLava = hasAdjacentTileType(mach.x, mach.y, 'lava');
            if (nearLava) {
              setResources(res => ({ ...res, power: Math.min(10000, (res.power || 0) + 25) }));
              mach.energyLevel = 100;
            } else {
              mach.energyLevel = 0;
            }
          }
          if (mType === 'water_gen') {
            const nearWater = hasAdjacentTileType(mach.x, mach.y, 'water');
            if (nearWater) {
              setResources(res => ({ ...res, power: Math.min(10000, (res.power || 0) + 18) }));
              mach.energyLevel = 100;
            } else {
              mach.energyLevel = 0;
            }
          }
          if (mType === 'oil_gen') {
            setResources(res => ({ ...res, power: Math.min(10000, (res.power || 0) + 40) }));
            mach.energyLevel = 100;
          }
          if (mType === 'nuke_gen') {
            let hasUranium = false;
            setResources(r => {
              if ((r.uranium || 0) >= 1) {
                hasUranium = true;
                return { ...r, uranium: r.uranium - 1, power: Math.min(10000, (r.power || 0) + 150) };
              }
              return r;
            });
            mach.energyLevel = hasUranium ? 100 : 0;
          }

          // MINERS (require specific adjacent ores on the board map, exactly like Mine Energy!)
          if (['miner', 'miner_auto', 'iron_miner', 'gold_miner', 'diamond_miner', 'uranium_miner', 'iridium_miner'].includes(mType)) {
            let reqType = 'coal';
            let powerReq = 2;
            let yieldType = 'coal';

            if (mType === 'miner' || mType === 'miner_auto') { reqType = 'coal'; powerReq = 2; yieldType = 'coal'; }
            else if (mType === 'iron_miner') { reqType = 'iron'; powerReq = 4; yieldType = 'iron'; }
            else if (mType === 'gold_miner') { reqType = 'gold'; powerReq = 8; yieldType = 'gold'; }
            else if (mType === 'diamond_miner') { reqType = 'diamond'; powerReq = 15; yieldType = 'diamond'; }
            else if (mType === 'uranium_miner') { reqType = 'uranium'; powerReq = 30; yieldType = 'uranium'; }
            else if (mType === 'iridium_miner') { reqType = 'iridium'; powerReq = 50; yieldType = 'iridium'; }

            const hasOre = hasAdjacentTileType(mach.x, mach.y, reqType);
            if (hasOre) {
              if (resources.power >= powerReq) {
                powerDrain = powerReq;
                productionProg = Math.min(100, productionProg + 15);
                if (productionProg >= 100) {
                  productionProg = 0;
                  setResources(r => ({ ...r, [yieldType]: (r[yieldType] || 0) + 1 }));
                  addLog(`🤖 Pasiver Miner hat 1x ${yieldType.toUpperCase()} geerntet!`);
                }
              }
              mach.energyLevel = 100;
            } else {
              mach.energyLevel = 5; // Warning: No adjacent Ore vein
            }
          }

          // AUTOMATED SELLERS (sells items for coins, consumes energy)
          if (mType.includes('seller') || mType === 'seller_auto') {
            let sellPowerCost = 1;
            let targetRes: string[] = ['wood', 'stone'];
            let mult = 1.0;

            if (mType === 'seller' || mType === 'seller_auto') { sellPowerCost = 1; targetRes = ['wood', 'stone']; mult = 1.0; }
            else if (mType === 'big_seller') { sellPowerCost = 3; targetRes = ['wood', 'stone', 'coal', 'iron']; mult = 1.2; }
            else if (mType === 'coal_seller') { sellPowerCost = 2; targetRes = ['coal']; mult = 1.5; }
            else if (mType === 'iron_seller') { sellPowerCost = 3; targetRes = ['iron']; mult = 1.5; }
            else if (mType === 'gold_seller') { sellPowerCost = 5; targetRes = ['gold']; mult = 1.6; }
            else if (mType === 'diamond_seller') { sellPowerCost = 10; targetRes = ['diamond']; mult = 1.8; }
            else if (mType === 'uranium_seller') { sellPowerCost = 20; targetRes = ['uranium']; mult = 2.0; }
            else if (mType === 'iridium_seller') { sellPowerCost = 50; targetRes = ['iridium']; mult = 2.5; }

            if (resources.power >= sellPowerCost) {
              powerDrain = sellPowerCost;
              let profits = 0;
              setResources(p => {
                const draft = { ...p };
                targetRes.forEach(rKey => {
                  const amt = draft[rKey] || 0;
                  if (amt > 0) {
                    const priceTable: { [key: string]: number } = {
                      wood: 2, stone: 4, coal: 6, iron: 12, gold: 25, diamond: 80, uranium: 200, iridium: 600
                    };
                    profits += Math.floor(amt * (priceTable[rKey] || 5) * mult);
                    draft[rKey] = 0;
                  }
                });
                return draft;
              });

              if (profits > 0) {
                passiveEarnings += profits;
                playRetroSound('buy');
                addLog(`💵 Auto-Seller hat Ressourcen für ${profits} Coins abgesetzt!`);
              }
              mach.energyLevel = 100;
            } else {
              mach.energyLevel = 0;
            }
          }

          // TESLA COILS (defenses)
          if (mType.includes('tesla')) {
            const tCost = mType === 'tesla_1000' ? 2 : mType === 'tesla_2000' ? 5 : 10;
            if (resources.power >= tCost) {
              powerDrain = tCost;
              mach.energyLevel = 100;
            } else {
              mach.energyLevel = 0;
            }
          }

          if (powerDrain > 0) {
            setResources(r => ({ ...r, power: Math.max(0, (r.power || 0) - powerDrain) }));
          }

          return {
            ...mach,
            productionProgress: productionProg,
            lastTick: Date.now()
          };
        });
      });

      // Synchronize coin increase if any
      if (passiveEarnings > 0) {
        setCoins(c => {
          const nextCoins = c + passiveEarnings;
          updateLeaderboardPlayerScore(nextCoins);
          syncCoinsWithDatabase(nextCoins);
          return nextCoins;
        });
      }

      // Passively increment other player bots scores
      setBotsList(bots => {
        return bots.map(b => {
          const nextCash = b.cash + Math.floor(Math.random() * 8 + 3);
          return { ...b, cash: nextCash };
        });
      });

      // Render updated leaderboard listing
      updateLeaderboardOrder();

    }, 1800);

    return () => clearInterval(interval);
  }, [resources.power, gameTime, windSpeed, isRaining]);

  // Sync leaderboard ordering
  const updateLeaderboardOrder = () => {
    setLeaderboard(prev => {
      const working = prev.map(item => {
        if (item.isPlayer) {
          return { ...item, money: coins };
        } else {
          const bot = botsList.find(b => b.name === item.name);
          return { ...item, money: bot ? bot.cash : item.money };
        }
      });
      return working.sort((a, b) => b.money - a.money);
    });
  };

  const updateLeaderboardPlayerScore = (playerCoins: number) => {
    setLeaderboard(prev => {
      const list = prev.map(item => item.isPlayer ? { ...item, money: playerCoins } : item);
      return list.sort((a, b) => b.money - a.money);
    });
  };

  const syncCoinsWithDatabase = (nextCoinsValue: number) => {
    if (user && db) {
      const docRef = doc(db, 'user_profiles', user.uid);
      updateDoc(docRef, { coins: nextCoinsValue }).catch(e => console.error(e));
    }
  };

  // Collect picked drop elements and reward points
  const collectResource = (type: string, amount: number) => {
    setResources(p => ({
      ...p,
      [type]: (p[type] || 0) + amount
    }));

    // Calculate score points gained
    let coinGain = 5;
    if (type === 'stone') coinGain = 8;
    if (type === 'coal') coinGain = 12;
    if (type === 'iron') coinGain = 25;
    if (type === 'gold') coinGain = 60;
    if (type === 'diamond') coinGain = 150;
    if (type === 'uranium') coinGain = 350;
    if (type === 'iridium') coinGain = 800;

    // Apply Python RL AI Autopilot Pathfinder boost (+15% automatic bonus)
    const pythonRLMultiplier = 1.15;
    const finalCoinGain = Math.round(coinGain * amount * pythonRLMultiplier);
    
    setCoins(curCoins => {
      const nextCoins = curCoins + finalCoinGain;
      updateLeaderboardPlayerScore(nextCoins);
      syncCoinsWithDatabase(nextCoins);
      return nextCoins;
    });

    addLog(`🐍 [Python RL AI] Autopilot-Ertrag optimiert! Erze umgerechnet mit +15% Bonus (+${finalCoinGain} Coins).`);

    // Calculate XP bonuses
    let xpGain = 10;
    if (type === 'iron') xpGain = 20;
    if (type === 'gold') xpGain = 45;
    if (type === 'diamond') xpGain = 100;
    if (type === 'iridium') xpGain = 300;

    setXp(curXp => {
      const nextXp = curXp + xpGain;
      const derivedLvl = Math.max(1, Math.floor(Math.sqrt(nextXp / 100)) + 1);
      if (derivedLvl > lvl) {
        setLvl(derivedLvl);
        setMaxHealth(100 + derivedLvl * 10);
        setHealth(100 + derivedLvl * 10);
        triggerToast('level', '🚀 LEVEL-UP UNLOCKED!', `Glückwunsch! Du bist nun Level ${derivedLvl}. Max HP aufgerüstet.`);
        playRetroSound('levelUp');
      }
      return nextXp;
    });

    if (user && db) {
      const docRef = doc(db, 'user_profiles', user.uid);
      updateDoc(docRef, { xp: increment(xpGain) }).catch(err => console.error(err));
    }

    playRetroSound('powerup');
  };

  // Mining blocks function on click
  const mineGridBlock = (tileIndex: number, clickX: number, clickY: number) => {
    const tile = tiles[tileIndex];
    if (tile.broken || tile.type === 'grass' || tile.type === 'sand' || tile.type === 'volcanic_rock' || tile.type === 'water' || tile.type === 'lava') {
      return;
    }

    // Tools validation matching levels
    let isSuitable = true;
    let requiredPickaxeName = '';
    
    if (tile.type === 'iron' && currentTool.power < 2) {
      isSuitable = false;
      requiredPickaxeName = 'Eisen-Spitzhacke';
    } else if (tile.type === 'gold' && currentTool.power < 2) {
      isSuitable = false;
      requiredPickaxeName = 'Eisen-Spitzhacke';
    } else if (tile.type === 'diamond' && currentTool.power < 3) {
      isSuitable = false;
      requiredPickaxeName = 'Diamant-Bohrer';
    } else if ((tile.type === 'uranium' || tile.type === 'iridium') && currentTool.power < 3) {
      isSuitable = false;
      requiredPickaxeName = 'Diamant-Bohrer';
    }

    if (!isSuitable) {
      const displayTileName = tile.type === 'iron' ? 'Eisen' : tile.type === 'gold' ? 'Gold' : tile.type === 'diamond' ? 'Diamant' : tile.type === 'uranium' ? 'Uranium' : 'Iridium';
      addLog(`⚠️ [1] '${currentTool.name}' ist nicht geeignet für den Abbau von ${displayTileName}.`);
      triggerToast('xp', '⛏️ WERKZEUG UNGEEIGNET', `Erfordert mindestens eine ${requiredPickaxeName}!`);
      playRetroSound('hurt');
      return;
    }

    // Trigger visual swing motion
    playerRef.current.swinging = true;
    playerRef.current.swingTimer = 10;

    const damageInflicted = currentTool.damage;
    const nextHp = Math.max(0, tile.health - damageInflicted);

    playRetroSound('hit');

    let blockColor = '#71717a';
    switch (tile.type) {
      case 'tree': blockColor = '#8b5a2b'; break;
      case 'stone': blockColor = '#71717a'; break;
      case 'coal': blockColor = '#1e1b18'; break;
      case 'iron': blockColor = '#94a3b8'; break;
      case 'gold': blockColor = '#fbbf24'; break;
      case 'diamond': blockColor = '#22d3ee'; break;
      case 'emerald': blockColor = '#34d399'; break;
      case 'uranium': blockColor = '#4ade80'; break;
      case 'iridium': blockColor = '#a78bfa'; break;
      case 'flower': blockColor = '#f472b6'; break;
      case 'wall': blockColor = '#737373'; break;
    }

    // Floating text on hit & screen shake
    addFloaterFX(clickX, clickY - 10, `-${damageInflicted} HP`, '#f43f5e');
    addSparksFX(clickX, clickY, blockColor, 8, 1.0, true, 'circle');
    triggerScreenShake(3);

    const updated = [...tiles];
    updated[tileIndex] = { ...tile, health: nextHp };

    if (nextHp <= 0) {
      updated[tileIndex].broken = true;
      playRetroSound('mine');

      addFloaterFX(tile.x + tileSize / 2, tile.y + tileSize / 2 - 16, 'GEBROCHEN!', blockColor);
      addSparksFX(tile.x + tileSize / 2, tile.y + tileSize / 2, blockColor, 20, 1.8, true, 'spark');
      triggerScreenShake(7);

      // Create drifting item drop particles
      const rawType = tile.type === 'tree' ? 'wood' : (tile.type === 'stone' ? 'stone' : tile.type);
      const isRare = tile.type === 'diamond' || tile.type === 'uranium' || tile.type === 'iridium';
      const yieldAmt = isRare ? 1 : 2;

      const drops: ItemDrop[] = [];
      for (let i = 0; i < yieldAmt; i++) {
        drops.push({
          id: `drop_${Date.now()}_${i}_${Math.random()}`,
          x: tile.x + tileSize / 2 + (Math.random() * 30 - 15),
          y: tile.y + tileSize / 2 + (Math.random() * 30 - 15),
          type: rawType,
          amount: 1,
          speedX: Math.random() * 6 - 3,
          speedY: Math.random() * 6 - 3
        });
      }

      setDroppingParticles(p => [...p, ...drops]);
      addLog(`✨ Block abgebaut! Sammle geerntetes ${rawType.toUpperCase()} vom Boden.`);
    }

    setTiles(updated);
  };

  // Base Building Placement
  const placeStructureOnGrid = (tileGridIndex: number) => {
    const tile = tiles[tileGridIndex];
    
    // Determine target Item ID to place based on selecting hotbar category
    let itemId = selectedEquipment[selectedHotbarIndex];
    if (!itemId) {
      // Fallback defaults
      if (selectedHotbarIndex === 1) itemId = 'solar';
      if (selectedHotbarIndex === 2) itemId = 'miner';
      if (selectedHotbarIndex === 3) itemId = 'seller';
      if (selectedHotbarIndex === 4) itemId = 'wall';
    }

    const item = shopDatabase.find(x => x.id === itemId);
    if (!item) return;

    // Check if it's a Miner to allow placement on its corresponding ore
    const isMiner = item.id.includes('miner');
    let resourceBlockHarvested: string | null = null;

    if (isMiner) {
      const requiredTileType = 
        item.id === 'miner' ? 'coal' :
        item.id === 'iron_miner' ? 'iron' :
        item.id === 'gold_miner' ? 'gold' :
        item.id === 'diamond_miner' ? 'diamond' :
        item.id === 'uranium_miner' ? 'uranium' :
        item.id === 'iridium_miner' ? 'iridium' : null;

      // In MineEnergy we place miners on matching node tiles OR general ground, but matching node boosts output!
      if (tile.type !== 'grass' && tile.type !== 'sand' && tile.type !== requiredTileType) {
        triggerToast('xp', '⛏️ BLOCK BESETZT', `Platziere diesen Miner direkt auf einem ${requiredTileType?.toUpperCase() || 'passenden'}-Erz oder auf leerem Boden!`);
        playRetroSound('hurt');
        return;
      }
      
      if (tile.type === requiredTileType) {
        resourceBlockHarvested = requiredTileType;
      }
    } else {
      if (tile.type !== 'grass' && tile.type !== 'sand') {
        triggerToast('xp', '❌ PLATZ BELEGT', 'Gebäude können nur auf offenem Boden platziert werden.');
        playRetroSound('hurt');
        return;
      }
    }

    // Check inventory availability
    const availableReserves = buildInventory[itemId] || 0;
    if (availableReserves < 1) {
      triggerToast('xp', '🛍️ LAGER LEER', `Du besitzt kein ${item.name}-Modul mehr! Kaufe es im Trade-Shop oder wähle ein anderes.`);
      playRetroSound('hurt');
      return;
    }

    // Deduct placement
    setBuildInventory(prev => ({ ...prev, [itemId]: prev[itemId] - 1 }));

    // Register active machine
    const cleanMach: PlacedMachine = {
      id: `placed_${Date.now()}_${Math.random()}`,
      x: tile.x,
      y: tile.y,
      type: itemId as any,
      energyLevel: itemId.includes('solar') || itemId.includes('wind') || itemId.includes('gen') ? 50 : 0,
      maxEnergy: 100,
      lastTick: Date.now(),
      productionProgress: 0,
      health: itemId.includes('wall') ? (itemId.includes('obsidian') ? 1000 : itemId.includes('reinforced') ? 2000 : 500) : 500,
      maxHealth: itemId.includes('wall') ? (itemId.includes('obsidian') ? 1000 : itemId.includes('reinforced') ? 2000 : 500) : 500
    };

    if (resourceBlockHarvested) {
      (cleanMach as any).harvestsResource = resourceBlockHarvested;
    }

    setPlacedMachines(p => [...p, cleanMach]);

    // Replace tile backdrop (walls become wall tile type, miners placed on ores keep the ore visible below them so we can see it on canvas!)
    const altered = [...tiles];
    altered[tileGridIndex] = {
      ...tile,
      health: cleanMach.maxHealth,
      maxHealth: cleanMach.maxHealth,
      type: itemId.includes('wall') ? 'wall' : tile.type
    };

    setTiles(altered);
    playRetroSound('place');
    if (resourceBlockHarvested) {
      addLog(`⚡ ${item.name} erfolgreich auf ${resourceBlockHarvested.toUpperCase()}-Ader platziert! (Doppelter Bohr-Ertrag ⛏️)`);
    } else {
      addLog(`🧱 ${item.name} auf Karte platziert!`);
    }
  };

  // Canvas Drawing Loop Implementation
  const drawGame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;

    // Viewport relative lerping cameras positioning
    const player = playerRef.current;
    const viewW = canvas.width;
    const viewH = canvas.height;

    const cameraX = Math.max(0, Math.min(worldSize.width - viewW, player.x - viewW / 2));
    const cameraY = Math.max(0, Math.min(worldSize.height - viewH, player.y - viewH / 2));

    // Apply screen shake vibration directly to camera offsets for tactile visual feedback!
    let shakeX = 0;
    let shakeY = 0;
    if (visualShakeRef.current.intensity > 0.1) {
      shakeX = (Math.random() - 0.5) * visualShakeRef.current.intensity;
      shakeY = (Math.random() - 0.5) * visualShakeRef.current.intensity;
      visualShakeRef.current.intensity *= 0.88; // decay factor
    }

    // Clear background with Day-Night atmospheric shades shift
    let skyHex = '#0c0f1d';
    const hour = gameTime.hour;
    if (hour >= 6 && hour < 17) skyHex = '#152219'; // Rich moss green backdrop
    else if (hour >= 17 && hour < 20) skyHex = '#3b1c31'; // Twilight dawn purple
    else skyHex = '#070913'; // Midnight deep indigo

    ctx.fillStyle = skyHex;
    ctx.fillRect(0, 0, viewW, viewH);

    ctx.save();
    ctx.translate(-cameraX + shakeX, -cameraY + shakeY);

    // 1. Draw grid backdrop & environmental tiles (MineEnergy style)
    tiles.forEach(tile => {
      // Frustum boundary checks for memory performance
      if (tile.x + tileSize < cameraX || tile.x > cameraX + viewW || tile.y + tileSize < cameraY || tile.y > cameraY + viewH) {
        return;
      }

      if (tile.broken) {
        ctx.fillStyle = '#140f0c';
        ctx.fillRect(tile.x, tile.y, tileSize, tileSize);
        ctx.strokeStyle = '#221915';
        ctx.lineWidth = 1;
        ctx.strokeRect(tile.x, tile.y, tileSize, tileSize);
        return;
      }

      // High-Fidelity Custom Styled Terrain Drawing System (with MineEnergy 2 style pseudo-3D extrusion height!)
      const is3D = tile.type !== 'grass' && tile.type !== 'sand' && tile.type !== 'volcanic_rock' && tile.type !== 'water' && tile.type !== 'lava';
      const H = 14; // Height extrusion of blocks

      if (is3D) {
        // Floor drop footprint ambient occlusion shadow
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fillRect(tile.x + 3, tile.y + 3, tileSize, tileSize);

        // Calculate and draw the darker front face shadow representing the block's height
        let shadowColor = '#1d1a22';
        switch (tile.type) {
          case 'tree': shadowColor = '#240f06'; break;
          case 'stone': shadowColor = '#1e2126'; break;
          case 'coal': shadowColor = '#0b0c0d'; break;
          case 'iron': shadowColor = '#282e38'; break;
          case 'gold': shadowColor = '#593202'; break;
          case 'diamond': shadowColor = '#012c20'; break;
          case 'emerald': shadowColor = '#02241b'; break;
          case 'uranium': shadowColor = '#0b2610'; break;
          case 'iridium': shadowColor = '#1c032d'; break;
          case 'flower': shadowColor = '#0b210b'; break;
          case 'wall': shadowColor = '#1e2229'; break;
        }
        ctx.fillStyle = shadowColor;
        ctx.fillRect(tile.x, tile.y + tileSize - H, tileSize, H);

        // Draw vertical division black lines for perfect block 3D edge separation
        ctx.strokeStyle = '#0c0b0e';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tile.x, tile.y + tileSize - H);
        ctx.lineTo(tile.x, tile.y + tileSize);
        ctx.moveTo(tile.x + tileSize, tile.y + tileSize - H);
        ctx.lineTo(tile.x + tileSize, tile.y + tileSize);
        ctx.stroke();

        ctx.save();
        ctx.translate(0, -H); // Shift the top face rendering upward to complete 3D height extrusion!
      } else {
        ctx.save();
      }

      switch (tile.type) {
        case 'grass':
          // Day-Night adapted lush grass top
          ctx.fillStyle = '#15803d'; // Rich green
          ctx.fillRect(tile.x, tile.y, tileSize, tileSize);
          // Organic blades of grass
          ctx.fillStyle = '#166534';
          ctx.fillRect(tile.x + 8, tile.y + 12, 4, 12);
          ctx.fillRect(tile.x + 40, tile.y + 36, 4, 12);
          ctx.fillRect(tile.x + 28, tile.y + 16, 4, 8);
          // Blade tips highlight
          ctx.fillStyle = '#22c55e';
          ctx.fillRect(tile.x + 8, tile.y + 8, 4, 4);
          ctx.fillRect(tile.x + 40, tile.y + 32, 4, 4);
          ctx.fillRect(tile.x + 28, tile.y + 12, 4, 4);
          // Tiny micro flowers
          ctx.fillStyle = '#fef08a';
          ctx.fillRect(tile.x + 48, tile.y + 16, 4, 4);
          ctx.fillStyle = '#f43f5e';
          ctx.fillRect(tile.x + 16, tile.y + 44, 4, 4);
          break;

        case 'sand':
          ctx.fillStyle = '#eab308'; // Glowing gold desert sand
          ctx.fillRect(tile.x, tile.y, tileSize, tileSize);
          // Dunes curves
          ctx.fillStyle = '#ca8a04';
          ctx.beginPath();
          ctx.arc(tile.x + 30, tile.y + 20, 16, 0, Math.PI, false);
          ctx.arc(tile.x + 50, tile.y + 45, 12, 0, Math.PI, false);
          ctx.fill();
          // Sparkling dust pieces
          ctx.fillStyle = '#fef08a';
          ctx.fillRect(tile.x + 12, tile.y + 10, 2, 2);
          ctx.fillRect(tile.x + 44, tile.y + 36, 2, 2);
          break;

        case 'volcanic_rock':
          ctx.fillStyle = '#18181b';
          ctx.fillRect(tile.x, tile.y, tileSize, tileSize);
          // Cracked glowing vein channels
          ctx.strokeStyle = '#f97316';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(tile.x + 6, tile.y + 12);
          ctx.lineTo(tile.x + 24, tile.y + 34);
          ctx.lineTo(tile.x + 42, tile.y + 28);
          ctx.lineTo(tile.x + 54, tile.y + 48);
          ctx.stroke();
          // Ash bits
          ctx.fillStyle = '#3f3f46';
          ctx.fillRect(tile.x + 18, tile.y + 18, 6, 6);
          ctx.fillRect(tile.x + 36, tile.y + 40, 4, 4);
          break;

        case 'water':
          ctx.fillStyle = '#1d4ed8'; // Ocean blue
          ctx.fillRect(tile.x, tile.y, tileSize, tileSize);
          
          // Outer tide highlight ripples
          ctx.fillStyle = '#3b82f6';
          ctx.fillRect(tile.x + 4, tile.y + 4, tileSize - 8, tileSize - 8);

          // Deep animated wave streams
          const waveShift = Math.sin((Date.now() / 240) + tile.x * 0.08) * 8;
          ctx.strokeStyle = 'rgba(255,255,255,0.35)'; // White wave crest foam!
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(tile.x, tile.y + tileSize / 2 + waveShift);
          ctx.bezierCurveTo(
            tile.x + 20, tile.y + tileSize / 2 - 10 + waveShift,
            tile.x + 40, tile.y + tileSize / 2 + 10 + waveShift,
            tile.x + tileSize, tile.y + tileSize / 2 + waveShift
          );
          ctx.stroke();

          // Reflective glisters
          ctx.fillStyle = '#93c5fd';
          ctx.fillRect(tile.x + 12, tile.y + 10, 8, 3);
          break;

        case 'lava':
          const pulseCol = Math.sin((Date.now() / 180) + tile.x * 0.12) * 20;
          ctx.fillStyle = `rgb(${220 + pulseCol}, ${70 + pulseCol / 2}, 15)`;
          ctx.fillRect(tile.x, tile.y, tileSize, tileSize);

          // Heat core swirls
          ctx.fillStyle = '#ea580c';
          ctx.fillRect(tile.x + 12, tile.y + 16, 20, 6);
          ctx.fillRect(tile.x + 28, tile.y + 36, 16, 8);

          // Rising bubbles
          const bPulse = (Date.now() / 150) % 12;
          ctx.fillStyle = '#fef08a'; // bright yellow bubbles
          ctx.beginPath();
          ctx.arc(tile.x + 24, tile.y + 40 - bPulse, 3, 0, Math.PI * 2);
          ctx.arc(tile.x + 44, tile.y + 20 - bPulse, 2, 0, Math.PI * 2);
          ctx.fill();
          break;

        case 'tree':
          // Brown wood trunk
          ctx.fillStyle = '#78350f';
          ctx.fillRect(tile.x + 24, tile.y + 30, 12, tileSize - 30);
          
          // Layered evergreen dense pine canopy!
          const canopyCycle = Math.sin(Date.now() / 400 + tile.x) * 1.5; // gentle wind sway
          ctx.save();
          ctx.translate(canopyCycle, 0);

          // Bottom wide leaves cone
          ctx.fillStyle = '#166534';
          ctx.beginPath();
          ctx.moveTo(tile.x + 6, tile.y + 32);
          ctx.lineTo(tile.x + tileSize - 6, tile.y + 32);
          ctx.lineTo(tile.x + tileSize / 2, tile.y + 10);
          ctx.closePath();
          ctx.fill();

          // Middle leaves cone (lighter)
          ctx.fillStyle = '#15803d';
          ctx.beginPath();
          ctx.moveTo(tile.x + 12, tile.y + 20);
          ctx.lineTo(tile.x + tileSize - 12, tile.y + 20);
          ctx.lineTo(tile.x + tileSize / 2, tile.y + 2);
          ctx.closePath();
          ctx.fill();

          // Top peak cone (bright green)
          ctx.fillStyle = '#22c55e';
          ctx.beginPath();
          ctx.moveTo(tile.x + 18, tile.y + 10);
          ctx.lineTo(tile.x + tileSize - 18, tile.y + 10);
          ctx.lineTo(tile.x + tileSize / 2, tile.y - 4);
          ctx.closePath();
          ctx.fill();

          ctx.restore();
          break;

        case 'stone':
          ctx.fillStyle = '#52525b'; // Zinc base
          ctx.fillRect(tile.x, tile.y, tileSize, tileSize);
          // Bevel highlights
          ctx.strokeStyle = '#71717a';
          ctx.lineWidth = 3.5;
          ctx.strokeRect(tile.x + 2, tile.y + 2, tileSize - 4, tileSize - 4);
          ctx.fillStyle = '#3f3f46';
          ctx.fillRect(tile.x + 12, tile.y + 12, tileSize - 24, tileSize - 24);
          // Dark fissures
          ctx.strokeStyle = '#18181b';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(tile.x + 14, tile.y + 14);
          ctx.lineTo(tile.x + 34, tile.y + 44);
          ctx.stroke();
          break;

        case 'coal':
          ctx.fillStyle = '#1e1b18';
          ctx.fillRect(tile.x, tile.y, tileSize, tileSize);
          ctx.strokeStyle = '#0c0a09';
          ctx.lineWidth = 3;
          ctx.strokeRect(tile.x + 2, tile.y + 2, tileSize - 4, tileSize - 4);

          // Charcoal clusters
          ctx.fillStyle = '#090502';
          ctx.fillRect(tile.x + 12, tile.y + 12, 14, 16);
          ctx.fillRect(tile.x + 32, tile.y + 30, 16, 16);

          // Ember spark inclusions
          ctx.fillStyle = '#f97316';
          ctx.fillRect(tile.x + 18, tile.y + 16, 6, 6);
          ctx.fillRect(tile.x + 36, tile.y + 34, 6, 6);
          break;

        case 'iron':
          ctx.fillStyle = '#475569';
          ctx.fillRect(tile.x, tile.y, tileSize, tileSize);
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 3.5;
          ctx.strokeRect(tile.x + 3, tile.y + 3, tileSize - 6, tileSize - 6);
          // Shiny steel streaks
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(tile.x + 14, tile.y + 14, 12, 14);
          ctx.fillRect(tile.x + 34, tile.y + 32, 14, 14);
          // Metallic light highlight reflection
          ctx.fillStyle = '#f1f5f9';
          ctx.fillRect(tile.x + 20, tile.y + 8, 20, 3);
          break;

        case 'gold':
          ctx.fillStyle = '#78350f';
          ctx.fillRect(tile.x, tile.y, tileSize, tileSize);
          ctx.strokeStyle = '#450a0a';
          ctx.lineWidth = 3;
          ctx.strokeRect(tile.x + 3, tile.y + 3, tileSize - 6, tileSize - 6);
          // Glimmering gold nuggets
          ctx.fillStyle = '#facc15'; // yellow-gold nuggets
          ctx.fillRect(tile.x + 14, tile.y + 14, 14, 10);
          ctx.fillRect(tile.x + 32, tile.y + 30, 16, 16);
          // Shining sparkling dots
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(tile.x + 18, tile.y + 12, 3, 3);
          ctx.fillRect(tile.x + 40, tile.y + 28, 3, 3);
          break;

        case 'diamond':
          ctx.fillStyle = '#065f46';
          ctx.fillRect(tile.x, tile.y, tileSize, tileSize);
          ctx.strokeStyle = '#064e3b';
          ctx.lineWidth = 3;
          ctx.strokeRect(tile.x + 3, tile.y + 3, tileSize - 6, tileSize - 6);

          // Sparkling Diamond Crystal Pyramid
          ctx.fillStyle = '#06b6d4';
          ctx.beginPath();
          ctx.moveTo(tile.x + tileSize / 2, tile.y + 8);
          ctx.lineTo(tile.x + 12, tile.y + tileSize - 12);
          ctx.lineTo(tile.x + tileSize - 12, tile.y + tileSize - 12);
          ctx.closePath();
          ctx.fill();

          // Brilliant crystal shines
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(tile.x + tileSize / 2 - 4, tile.y + 20, 8, 12);
          ctx.beginPath();
          ctx.arc(tile.x + tileSize / 2, tile.y + 16, 4, 0, Math.PI * 2);
          ctx.fill();
          break;

        case 'emerald':
          ctx.fillStyle = '#022c22';
          ctx.fillRect(tile.x, tile.y, tileSize, tileSize);
          ctx.strokeStyle = '#065f46';
          ctx.lineWidth = 3.5;
          ctx.strokeRect(tile.x + 3, tile.y + 3, tileSize - 6, tileSize - 6);
          // Glowing cubic columns
          ctx.fillStyle = '#10b981';
          ctx.fillRect(tile.x + 12, tile.y + 16, 16, 16);
          ctx.fillRect(tile.x + 32, tile.y + 28, 16, 16);
          ctx.fillStyle = '#a7f3d0';
          ctx.fillRect(tile.x + 16, tile.y + 20, 8, 8);
          break;

        case 'uranium':
          ctx.fillStyle = '#064e3b';
          ctx.fillRect(tile.x, tile.y, tileSize, tileSize);
          // Pulsing warning outline
          const glowCell = Math.abs(Math.sin((Date.now() / 160) + tile.x * 0.15)) * 0.4;
          ctx.fillStyle = `rgba(34, 197, 94, ${0.1 + glowCell})`;
          ctx.fillRect(tile.x + 4, tile.y + 4, tileSize - 8, tileSize - 8);
          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 3;
          ctx.strokeRect(tile.x + 4, tile.y + 4, tileSize - 8, tileSize - 8);
          // Central toxic nuclear rod capsule
          ctx.fillStyle = '#4ade80';
          ctx.fillRect(tile.x + 18, tile.y + 14, tileSize - 36, tileSize - 28);
          ctx.fillStyle = '#000000';
          ctx.fillRect(tile.x + 22, tile.y + 20, 16, 4);
          ctx.fillRect(tile.x + 22, tile.y + 28, 16, 4);
          break;

        case 'iridium':
          ctx.fillStyle = '#2e1065';
          ctx.fillRect(tile.x, tile.y, tileSize, tileSize);
          // Holographic glowing shield
          const irisGlow = Math.abs(Math.cos((Date.now() / 200) + tile.x * 0.08)) * 0.55;
          ctx.fillStyle = `rgba(217, 70, 239, ${0.2 + irisGlow})`;
          ctx.fillRect(tile.x + 4, tile.y + 4, tileSize - 8, tileSize - 8);
          ctx.strokeStyle = '#d946ef';
          ctx.lineWidth = 3.5;
          ctx.strokeRect(tile.x + 4, tile.y + 4, tileSize - 8, tileSize - 8);
          // Dark matter orbit crystal
          ctx.fillStyle = '#df73ff';
          ctx.beginPath();
          ctx.arc(tile.x + tileSize / 2, tile.y + tileSize / 2, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(tile.x + tileSize / 2 - 4, tile.y + tileSize / 2 - 4, 8, 8);
          break;

        case 'flower':
          ctx.fillStyle = '#14532d';
          ctx.fillRect(tile.x, tile.y, tileSize, tileSize);
          ctx.fillStyle = '#fb7185'; // Soft pink bloom
          ctx.beginPath();
          ctx.arc(tile.x + tileSize / 2, tile.y + tileSize / 2, 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#e11d48'; // Rich red center
          ctx.beginPath();
          ctx.arc(tile.x + tileSize / 2, tile.y + tileSize / 2, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fef08a'; // Pollen dots
          ctx.fillRect(tile.x + tileSize / 2 - 3, tile.y + tileSize / 2 - 3, 6, 6);
          break;

        case 'wall':
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(tile.x, tile.y, tileSize, tileSize);
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(tile.x + 6, tile.y + 6, tileSize - 12, tileSize - 12);
          // Yellow striped diagonal safety stripes
          ctx.strokeStyle = '#eab308';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(tile.x + 6, tile.y + 6);
          ctx.lineTo(tile.x + 24, tile.y + 24);
          ctx.moveTo(tile.x + tileSize - 24, tile.y + 6);
          ctx.lineTo(tile.x + tileSize - 6, tile.y + 24);
          ctx.stroke();
          // Armor corner brackets
          ctx.fillStyle = '#475569';
          ctx.fillRect(tile.x + 8, tile.y + 8, 4, 4);
          ctx.fillRect(tile.x + tileSize - 12, tile.y + 8, 4, 4);
          ctx.fillRect(tile.x + 8, tile.y + tileSize - 12, 4, 4);
          ctx.fillRect(tile.x + tileSize - 12, tile.y + tileSize - 12, 4, 4);
          break;

        default:
          ctx.fillStyle = '#262626';
          ctx.fillRect(tile.x, tile.y, tileSize, tileSize);
      }
      ctx.restore();

      // Delicate dark cell grid borders mapping (MineEnergy original outline look with 3D height offset!)
      if (is3D) {
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(tile.x, tile.y - H, tileSize, tileSize);
      } else {
        ctx.strokeStyle = 'rgba(0,0,0,0.22)';
        ctx.lineWidth = 1;
        ctx.strokeRect(tile.x, tile.y, tileSize, tileSize);
      }
    });

    // 2a. Draw dynamic electric cable connections (glowing power lines) like Mine Energy 1 & 2!
    const generators = placedMachines.filter(m => 
      m.type === 'solar' || m.type === 'generator_solar' || m.type === 'adv_solar' || m.type === 'wind' || m.type === 'generator_wind' || m.type === 'coal_gen' || m.type === 'geo_gen' || m.type === 'water_gen' || m.type === 'oil_gen' || m.type === 'nuke_gen'
    );
    const consumers = placedMachines.filter(m => 
      m.type.includes('miner') || m.type === 'miner_auto' || m.type.includes('seller') || m.type === 'seller_auto' || m.type.includes('tesla') || m.type.includes('door')
    );

    generators.forEach(gen => {
      consumers.forEach(con => {
        const dist = Math.hypot(gen.x - con.x, gen.y - con.y);
        if (dist < 220) {
          // Draw electrical cable wire with glowing pulse shadow
          ctx.shadowColor = '#f59e0b';
          ctx.shadowBlur = 6;
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(gen.x + tileSize / 2, gen.y + tileSize / 2);
          ctx.lineTo(con.x + tileSize / 2, con.y + tileSize / 2);
          ctx.stroke();

          // Reset shadow
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;

          // Animated energy current wave packet traveling along direct vector routes
          const pulseRouteStep = (Date.now() / 650) % 1.0;
          const px = gen.x + tileSize / 2 + (con.x - gen.x) * pulseRouteStep;
          const py = gen.y + tileSize / 2 + (con.y - gen.y) * pulseRouteStep;
          ctx.fillStyle = '#22d3ee'; // vibrant pulsing electric cyan node
          ctx.beginPath();
          ctx.arc(px, py, 4.5, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    });

    // 2b. Draw placed automation machinery nodes overlays with detailed mechanical vectors
    placedMachines.forEach(mach => {
      if (mach.x + tileSize < cameraX || mach.x > cameraX + viewW || mach.y + tileSize < cameraY || mach.y > cameraY + viewH) {
        return;
      }
      if (mach.type === 'wall_iron' || mach.type === 'wall') return; // rendered in standard tile grids loop above directly

      const dx = mach.x;
      const dy = mach.y;
      const H = 14; // Matching 3D height extrusion

      const shopItem = shopDatabase.find(item => item.id === mach.type);
      const borderCol = shopItem ? shopItem.imageColor : '#f59e0b';
      const symb = shopItem ? shopItem.icon : '⚙️';

      // 1. Ambient drop footprint shadow
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(dx + 4, dy + 4, tileSize - 8, tileSize - 8);

      // 2. Extruded vertical front wall chassis
      ctx.fillStyle = '#18171a';
      ctx.fillRect(dx + 4, dy + tileSize - H, tileSize - 8, H);
      ctx.strokeStyle = '#0a0a0b';
      ctx.lineWidth = 1;
      ctx.strokeRect(dx + 4, dy + tileSize - H, tileSize - 8, H);

      // 3. Translated top face platform containing all control machinery
      ctx.save();
      ctx.translate(0, -H);

      // Heavy armored steel chassis base top surface plate
      ctx.fillStyle = '#343438';
      ctx.fillRect(dx + 4, dy + 4, tileSize - 8, tileSize - 8);
      ctx.fillStyle = '#1c1c1f';
      ctx.fillRect(dx + 8, dy + 8, tileSize - 16, tileSize - 16);

      // Yellow/Black diagonal micro warning stripes around margins 
      ctx.strokeStyle = borderCol;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(dx + 6, dy + 6, tileSize - 12, tileSize - 12);

      // Rotating gear base sub-indicator (rotates smoothly over game cycles)
      const gearRotation = (Date.now() / 240) % (Math.PI * 2);
      ctx.save();
      ctx.translate(dx + tileSize / 2, dy + tileSize / 2);
      ctx.rotate(gearRotation);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Custom high-fidelity animations depending on machine types
      if (mach.type.includes('solar')) {
        // Draw real high tech solar arrays grids
        ctx.fillStyle = '#1e3a8a';
        ctx.fillRect(dx + 12, dy + 12, tileSize - 24, tileSize - 24);
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 1;
        ctx.strokeRect(dx + 12, dy + 12, tileSize - 24, tileSize - 24);
        ctx.beginPath();
        ctx.moveTo(dx + tileSize / 2, dy + 12);
        ctx.lineTo(dx + tileSize / 2, dy + tileSize - 12);
        ctx.moveTo(dx + 12, dy + tileSize / 2);
        ctx.lineTo(dx + tileSize - 12, dy + tileSize / 2);
        ctx.stroke();
      } else if (mach.type.includes('wind')) {
        // Wind turbine rotating three-blade micro vector blades!
        const rotorSpin = (Date.now() / 140) % (Math.PI * 2);
        ctx.save();
        ctx.translate(dx + tileSize / 2, dy + tileSize / 2);
        ctx.rotate(rotorSpin);
        ctx.strokeStyle = '#f1f5f9';
        ctx.lineWidth = 3;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(0, -18);
          ctx.stroke();
          ctx.rotate((Math.PI * 2) / 3);
        }
        ctx.restore();
      } else if (mach.type.includes('miner')) {
        // Hammer drill head reciprocating with spark simulation
        const drillSlide = Math.sin(Date.now() / 70) * 4;
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.moveTo(dx + tileSize / 2 - 8, dy + 12 + drillSlide);
        ctx.lineTo(dx + tileSize / 2 + 8, dy + 12 + drillSlide);
        ctx.lineTo(dx + tileSize / 2 + 12, dy + tileSize - 14 + drillSlide);
        ctx.lineTo(dx + tileSize / 2 - 12, dy + tileSize - 14 + drillSlide);
        ctx.closePath();
        ctx.fill();
        // Spawning tiny raw grinding sparks
        if (Math.random() < 0.18) {
          addSparksFX(dx + tileSize / 2, dy + tileSize - 12, '#fbbf24', 2, 0.45);
        }
      } else if (mach.type.includes('seller')) {
        // Trans-landing cargo holding bay with sliding metal hatch doors
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(dx + 12, dy + 12, tileSize - 24, tileSize - 24);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(dx + 16, dy + tileSize / 2 - 2, tileSize - 32, 4);
      }

      // Render overlay central glyph representation
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px Courier';
      ctx.textAlign = 'center';
      ctx.fillText(symb, dx + tileSize / 2, dy + tileSize / 2 + 5);

      // Status notifications and micro progress bars
      if (mach.energyLevel === 5) {
        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 8px Courier';
        ctx.fillText('⚠️ KEIN ERZ', dx + tileSize / 2, dy + tileSize - 16);
      } else if (mach.energyLevel === 0) {
        ctx.fillStyle = '#f43f5e';
        ctx.font = 'bold 8px Courier';
        ctx.fillText('❌ STROMLOS', dx + tileSize / 2, dy + tileSize - 16);
      } else {
        // Micro progress bar
        ctx.fillStyle = '#262626';
        ctx.fillRect(dx + 10, dy + tileSize - 12, tileSize - 20, 3);
        ctx.fillStyle = '#10b981';
        ctx.fillRect(dx + 10, dy + tileSize - 12, (tileSize - 20) * (mach.productionProgress / 100), 3);
      }

      ctx.restore(); // Restore our translations so surrounding grid and subsequent renders are flawless
    });

    // 2c. Implement Tesla Turret perimeter checks & laser discharge (MineEnergy defence mechanics!)
    placedMachines.forEach(mach => {
      if (mach.type && mach.type.includes('tesla')) {
        botsList.forEach(bot => {
          const distBot = Math.hypot((mach.x + tileSize / 2) - bot.x, (mach.y + tileSize / 2) - bot.y);
          if (distBot < 180) {
            // Check if grid has power available
            if (resources.power >= 4) {
              // Draw electrical discharge lightning beam
              ctx.shadowColor = '#06b6d4';
              ctx.shadowBlur = 8;
              ctx.strokeStyle = '#22d3ee';
              ctx.lineWidth = 3 + Math.random() * 3;
              
              // Draw jagged electric arcs!
              ctx.beginPath();
              ctx.moveTo(mach.x + tileSize / 2, mach.y + tileSize / 2);
              
              // 3 intermediate nodes for a jagged lightning bolt appearance
              const segments = 4;
              for (let i = 1; i < segments; i++) {
                const ratio = i / segments;
                const midX = (mach.x + tileSize / 2) + (bot.x - (mach.x + tileSize / 2)) * ratio;
                const midY = (mach.y + tileSize / 2) + (bot.y - (mach.y + tileSize / 2)) * ratio;
                const offset = (Math.random() - 0.5) * 16;
                // Add perpendicular displacement
                const angle = Math.atan2(bot.y - (mach.y + tileSize / 2), bot.x - (mach.x + tileSize / 2)) + Math.PI / 2;
                ctx.lineTo(midX + Math.cos(angle) * offset, midY + Math.sin(angle) * offset);
              }
              
              ctx.lineTo(bot.x, bot.y);
              ctx.stroke();

              // Reset shadow
              ctx.shadowColor = 'transparent';
              ctx.shadowBlur = 0;

              // Core bright white laser string
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.moveTo(mach.x + tileSize / 2, mach.y + tileSize / 2);
              ctx.lineTo(bot.x, bot.y);
              ctx.stroke();

              // Draw spark impact particles at bot location
              ctx.fillStyle = '#06b6d4';
              ctx.beginPath();
              ctx.arc(bot.x, bot.y, 6 + Math.random() * 4, 0, Math.PI * 2);
              ctx.fill();

              // Passive damage throttling (since drawGame runs ~60 FPS)
              if (Math.random() < 0.05) {
                // Inflict damage to opponent bot
                const bHealth = (bot as any).health !== undefined ? (bot as any).health : 100;
                const nextBHealth = Math.max(0, bHealth - 8);
                (bot as any).health = nextBHealth;

                // Drain a little wire power
                setResources(r => ({ ...r, power: Math.max(0, (r.power || 0) - 1) }));

                if (nextBHealth <= 0) {
                  // Gained Loot Coins!
                  const bounty = 650;
                  setCoins(c => {
                    const nextCoins = c + bounty;
                    updateLeaderboardPlayerScore(nextCoins);
                    syncCoinsWithDatabase(nextCoins);
                    return nextCoins;
                  });
                  addLog(`⚡ [Verteidigung] Deine Tesla-Verteidigung hat Dieb <${bot.name}> eliminiert! Loot gesichert: +${bounty} Coins!`);
                  playRetroSound('levelUp');

                  // Respawn bot
                  (bot as any).health = 100;
                  bot.x = Math.max(150, Math.min(worldSize.width - 150, Math.random() * worldSize.width));
                  bot.y = Math.max(150, Math.min(worldSize.height - 150, Math.random() * worldSize.height));
                  bot.cash = Math.max(50, Math.floor(bot.cash * 0.8));
                }
              }
            }
          }
        });
      }
    });

    // 3. Draw physical drifting element drop stars
    droppingParticles.forEach(p => {
      if (p.collected) return;
      if (p.x < cameraX || p.x > cameraX + viewW || p.y < cameraY || p.y > cameraY + viewH) return;

      const offsetBounce = Math.sin(Date.now() / 150 + p.x) * 5;

      // Outer aura
      ctx.fillStyle = p.type === 'wood' ? '#8b5a2b' : (p.type === 'stone' ? '#71717a' : '#00ffd2');
      ctx.beginPath();
      ctx.arc(p.x, p.y + offsetBounce, 8, 0, Math.PI * 2);
      ctx.fill();

      // Shiny core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(p.x, p.y + offsetBounce, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // 4. Draw wandering player bots List
    botsList.forEach(bot => {
      if (bot.x + player.size < cameraX || bot.x - player.size > cameraX + viewW || bot.y + player.size < cameraY || bot.y - player.size > cameraY + viewH) {
        return;
      }

      ctx.save();
      ctx.translate(bot.x, bot.y);
      
      // Animated breathing/walking bounce cycle
      const bounce = Math.sin(Date.now() / 120 + bot.x) * 2;
      ctx.translate(0, bounce);

      // Simple walk leg swings
      const legSwing = Math.sin(Date.now() / 80 + bot.x) * 6;

      // Draw shadow footprint
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.arc(0, 14, 12, 0, Math.PI * 2);
      ctx.fill();

      // Render feet
      ctx.fillStyle = '#1e1b4b'; // dark boots
      ctx.fillRect(-8 + legSwing/2, 10, 5, 5);
      ctx.fillRect(3 - legSwing/2, 10, 5, 5);

      // Render full round animated character body (Knights / Goblins / Wizards)
      ctx.fillStyle = bot.color;
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();

      // Golden shoulders/armor trim (Clash-inspired!)
      ctx.fillStyle = '#eab308';
      ctx.fillRect(-15, -6, 5, 8);
      ctx.fillRect(10, -6, 5, 8);

      // Head
      ctx.fillStyle = '#fce7f3'; // skin color
      ctx.beginPath();
      ctx.arc(0, -8, 8, 0, Math.PI * 2);
      ctx.fill();

      // Visor/Helmet
      ctx.fillStyle = '#64748b'; // iron knight helmet
      ctx.fillRect(-6, -15, 12, 8);
      // Visor slit
      ctx.fillStyle = '#000000';
      ctx.fillRect(-5, -11, 10, 2);
      // Glowing threat eyes
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-3, -11, 2, 2);
      ctx.fillRect(2, -11, 2, 2);

      // Swinging arm with weapon/sword representation
      ctx.save();
      ctx.translate(10, 2);
      ctx.rotate(bot.swingAngle * Math.PI / 180);
      ctx.fillStyle = '#94a3b8'; // iron sword
      ctx.fillRect(-2, -12, 4, 12); // blade
      ctx.fillStyle = '#78350f';
      ctx.fillRect(-4, -4, 8, 2); // handle guard
      ctx.restore();

      ctx.restore();

      // Name tags and cash above bot head (with a clean semi-transparent background capsule)
      ctx.save();
      ctx.font = 'bold 11px Courier';
      ctx.textAlign = 'center';
      const labelStr = `<${bot.name}> [${bot.cash} 💎]`;
      const labelW = ctx.measureText(labelStr).width;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(bot.x - labelW/2 - 6, bot.y - 28, labelW + 12, 16);
      
      // Health mini bar under name
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(bot.x - 16, bot.y - 32, 32, 3);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(bot.x - 16, bot.y - 32, 32 * (bot.health / bot.maxHealth), 3);

      ctx.fillStyle = '#ffffff';
      ctx.fillText(labelStr, bot.x, bot.y - 16);
      ctx.restore();
    });

    // 5. Draw Primary Character (Highly Polished Animated Warrior)
    ctx.save();
    ctx.translate(player.x, player.y);

    const pBounce = Math.sin(Date.now() / 110) * 1.5;
    ctx.translate(0, pBounce);

    // Dynamic rotation direction
    let gazeAngle = player.angle;
    if (!isMobileMode && (mousePosRef.current.x !== 0 || mousePosRef.current.y !== 0)) {
      gazeAngle = Math.atan2(mousePosRef.current.y - (player.y - cameraY), mousePosRef.current.x - (player.x - cameraX));
      player.angle = gazeAngle;
    }
    ctx.rotate(gazeAngle);

    // Shadow footprint
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.arc(0, 12, 14, 0, Math.PI * 2);
    ctx.fill();

    // Determine customizable armor colors & materials
    let bodyColor = '#2563eb'; // blue cape rote
    let shoulderColor = '#1e3a8a';
    let helmColor = '#f1f5f9';
    let eyesColor = '#38bdf8'; // bright cyan eyes

    if (equippedArmor === 'none') {
      bodyColor = '#2563eb';
      shoulderColor = '#475569';
    } else if (equippedArmor === 'nano') {
      bodyColor = '#16a34a'; // green
      shoulderColor = '#15803d';
      helmColor = '#4ade80';
      eyesColor = '#fef08a'; // yellow eyes
    } else if (equippedArmor === 'quantum') {
      bodyColor = '#7c3aed'; // deep purple
      shoulderColor = '#5b21b6';
      helmColor = '#c084fc';
      eyesColor = '#f472b6'; // hot pink eyes
    }

    // Armored shoulder pauldrons
    ctx.fillStyle = shoulderColor;
    ctx.fillRect(-17, -10, 6, 12);
    ctx.fillRect(11, -10, 6, 12);

    // Primary Cape body torso
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();

    // Steel knight breastplate lines
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.lineTo(10, 0);
    ctx.moveTo(-6, -4);
    ctx.lineTo(6, -4);
    ctx.stroke();

    // Warrior Head / Knight Helmet Dome
    ctx.fillStyle = helmColor;
    ctx.beginPath();
    ctx.arc(0, -10, 9, 0, Math.PI * 2);
    ctx.fill();

    // Front visors and burning iris eyes
    ctx.fillStyle = '#0f172a'; // Visor plate face grill
    ctx.fillRect(4, -14, 6, 7);
    ctx.fillStyle = eyesColor;
    ctx.fillRect(6, -13, 2, 3);
    ctx.fillRect(6, -10, 2, 3);

    // Swinging Weapon & Glowing Crescent Arc swing trail
    ctx.save();
    ctx.translate(14, 16);
    if (player.swinging) {
      const swingAngleOffset = -Math.PI / 4 + (player.swingTimer * 0.18);
      ctx.rotate(swingAngleOffset);

      // Swing crescent alpha-gradient wave trails!
      ctx.restore(); // restore to player space for trail drawing
      ctx.save();
      ctx.strokeStyle = eyesColor;
      ctx.shadowColor = eyesColor;
      ctx.shadowBlur = 12;
      ctx.lineWidth = 4.5 * (player.swingTimer / 10);
      ctx.beginPath();
      ctx.arc(0, 0, 36, -Math.PI / 3, Math.PI / 3);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
      ctx.save();
      ctx.translate(14, 16);
      ctx.rotate(swingAngleOffset);
    }

    // Dynamic high-fidelity weapon textures in 2D vectors
    let swordColor = currentTool.color || '#cbd5e1';
    let handleColor = '#78350f';

    if (currentTool.id.includes('pick') || currentTool.id.includes('drill')) {
      // Draw professional mining pickaxe sprite
      ctx.strokeStyle = handleColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 4);
      ctx.lineTo(-8, -12); // wood handle shaft
      ctx.stroke();

      // Pickaxe metal dual-claws wing curve
      ctx.strokeStyle = swordColor;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(-8, -12, 10, -Math.PI / 6, Math.PI + Math.PI / 6);
      ctx.stroke();
    } else {
      // General tools / swords
      ctx.fillStyle = handleColor;
      ctx.fillRect(-2, 0, 4, 6); // handle grip
      ctx.fillStyle = '#eab308'; // gold pommel
      ctx.beginPath();
      ctx.arc(0, 6, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = swordColor; // shining blade
      ctx.fillRect(-3, -16, 6, 16);
      ctx.beginPath();
      ctx.moveTo(-3, -16);
      ctx.lineTo(0, -22); // diamond tip
      ctx.lineTo(3, -16);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    ctx.restore();

    // Above player name capsule HUD
    ctx.save();
    ctx.font = 'bold 12px Courier';
    ctx.textAlign = 'center';
    const cleanNickname = myProfile?.displayName || user?.displayName || 'Du (Gast)';
    const hudStr = `${cleanNickname} (lvl ${lvl})`;
    const hudW = ctx.measureText(hudStr).width;
    
    // Capsule frame
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(player.x - hudW/2 - 8, player.y - player.size - 32, hudW + 16, 18);
    
    // Text
    ctx.fillStyle = '#ffaa00';
    ctx.fillText(hudStr, player.x, player.y - player.size - 19);
    ctx.restore();

    // Glowing radius preview mesh if machine slots (2-5) selected
    if (selectedHotbarIndex > 0) {
      ctx.strokeStyle = 'rgba(255, 152, 0, 0.45)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(player.x, player.y, 180, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]); // clear dash

      // Mouse position projected boundary cell box
      const absMouseX = mousePosRef.current.x + cameraX;
      const absMouseY = mousePosRef.current.y + cameraY;
      const gridCellX = Math.floor(absMouseX / tileSize) * tileSize;
      const gridCellY = Math.floor(absMouseY / tileSize) * tileSize;

      const dstMouse = Math.hypot(player.x - (gridCellX + tileSize / 2), player.y - (gridCellY + tileSize / 2));
      ctx.fillStyle = dstMouse <= 180 ? 'rgba(76, 175, 80, 0.25)' : 'rgba(244, 67, 54, 0.25)';
      ctx.fillRect(gridCellX, gridCellY, tileSize, tileSize);
      ctx.strokeStyle = dstMouse <= 180 ? '#4CAF50' : '#f44336';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(gridCellX, gridCellY, tileSize, tileSize);
    }

    // Real-time Day-Night Ambient Glow Shader Overlay (MineEnergy style)
    const hr = gameTime.hour;
    const isDark = (hr >= 18 || hr < 6);
    if (isDark) {
      let darknessOpacity = 0.65;
      if (hr === 18) darknessOpacity = 0.25;
      else if (hr === 19) darknessOpacity = 0.45;
      else if (hr >= 20 || hr < 5) darknessOpacity = 0.72;
      else if (hr === 5) darknessOpacity = 0.35;

      try {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = viewW;
        tempCanvas.height = viewH;
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
          tempCtx.fillStyle = `rgba(7, 8, 14, ${darknessOpacity})`;
          tempCtx.fillRect(0, 0, viewW, viewH);

          tempCtx.globalCompositeOperation = 'destination-out';

          // 1. Player high-tech headlights / suit ambient bubble
          const px = player.x - cameraX;
          const py = player.y - cameraY;
          const pRad = tempCtx.createRadialGradient(px, py, 14, px, py, 180);
          pRad.addColorStop(0, 'rgba(0,0,0,1)');
          pRad.addColorStop(1, 'rgba(0,0,0,0)');
          tempCtx.fillStyle = pRad;
          tempCtx.beginPath();
          tempCtx.arc(px, py, 180, 0, Math.PI * 2);
          tempCtx.fill();

          // 2. Luminous Flashlight Directional Cone based on player.angle gaze vectors
          let gazeRad = player.angle;
          tempCtx.fillStyle = 'rgba(0, 0, 0, 0.42)'; // soft projection light brightness
          tempCtx.beginPath();
          tempCtx.moveTo(px, py);
          tempCtx.arc(px, py, 260, gazeRad - 0.45, gazeRad + 0.45);
          tempCtx.closePath();
          tempCtx.fill();

          // 3. Placed machines indicator glows
          placedMachines.forEach(mach => {
            const mx = mach.x + tileSize / 2 - cameraX;
            const my = mach.y + tileSize / 2 - cameraY;
            if (mx < -100 || mx > viewW + 100 || my < -100 || my > viewH + 100) return;

            let glowSize = 75;
            if (mach.type.includes('tesla')) glowSize = 160;
            if (mach.type.includes('miner')) glowSize = 90;

            const mRad = tempCtx.createRadialGradient(mx, my, 6, mx, my, glowSize);
            mRad.addColorStop(0, 'rgba(0,0,0,0.95)');
            mRad.addColorStop(1, 'rgba(0,0,0,0)');
            tempCtx.fillStyle = mRad;
            tempCtx.beginPath();
            tempCtx.arc(mx, my, glowSize, 0, Math.PI * 2);
            tempCtx.fill();
          });

          // 4. Thermodynamic & Radioactive resources ambient glowing nodes (lava, uranium, iridium, diamond)
          tiles.forEach(tile => {
            if (tile.broken) return;
            if (tile.type !== 'lava' && tile.type !== 'uranium' && tile.type !== 'iridium' && tile.type !== 'diamond') return;

            const tx = tile.x + tileSize / 2 - cameraX;
            const ty = tile.y + tileSize / 2 - cameraY;
            if (tx < -100 || tx > viewW + 100 || ty < -100 || ty > viewH + 100) return;

            const oRad = tempCtx.createRadialGradient(tx, ty, 6, tx, ty, 80);
            oRad.addColorStop(0, 'rgba(0,0,0,0.88)');
            oRad.addColorStop(1, 'rgba(0,0,0,0)');
            tempCtx.fillStyle = oRad;
            tempCtx.beginPath();
            tempCtx.arc(tx, ty, 80, 0, Math.PI * 2);
            tempCtx.fill();
          });

          // Draw shadows mask overlay
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0); // reset camera space to paint on top of main scene
          ctx.drawImage(tempCanvas, 0, 0);
          ctx.restore();
        }
      } catch (err) {
        // Fallback transparent flat overlay
        ctx.fillStyle = `rgba(8, 10, 18, ${darknessOpacity * 0.72})`;
        ctx.fillRect(cameraX, cameraY, viewW, viewH);
      }
    }

    // Update and Draw physical visual sparks
    const sparks = fxSparksRef.current;
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.life++;
      if (s.life >= s.maxLife) {
        sparks.splice(i, 1);
        continue;
      }
      s.x += s.vx;
      s.y += s.vy;
      s.vy += 0.08; // slow downward gravity physics
      s.alpha = 1.0 - (s.life / s.maxLife);

      ctx.save();
      ctx.globalAlpha = s.alpha;
      if (s.glow) {
        ctx.shadowColor = s.color;
        ctx.shadowBlur = 8;
      }
      ctx.fillStyle = s.color;

      if (s.shape === 'spark') {
        ctx.beginPath();
        ctx.moveTo(s.x, s.y - s.size * 1.6);
        ctx.lineTo(s.x + s.size, s.y);
        ctx.lineTo(s.x, s.y + s.size * 1.6);
        ctx.lineTo(s.x - s.size, s.y);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Update and Draw floating combat/indicators texts (thick borders)
    const floaters = fxFloatersRef.current;
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      f.life++;
      if (f.life >= f.maxLife) {
        floaters.splice(i, 1);
        continue;
      }
      f.y += f.vy;
      f.alpha = 1.0 - (f.life / f.maxLife);

      ctx.save();
      ctx.globalAlpha = f.alpha;
      ctx.font = 'bold 11px "JetBrains Mono", "Courier New", monospace';
      ctx.textAlign = 'center';

      // Outline base border
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeText(f.text, f.x, f.y);

      // Vibrant foreground filling
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }

    ctx.restore();
  };

  // Unified Interaction dispatcher (used by mouse and touch events)
  const triggerInteractionAt = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const clickY = clientY - rect.top;

    const viewW = canvas.width;
    const viewH = canvas.height;
    const player = playerRef.current;

    const cameraX = Math.max(0, Math.min(worldSize.width - viewW, player.x - viewW / 2));
    const cameraY = Math.max(0, Math.min(worldSize.height - viewH, player.y - viewH / 2));

    const absClickX = clickX + cameraX;
    const absClickY = clickY + cameraY;

    // Direct Character face vector turn towards target point
    if (isMobileMode) {
      player.angle = Math.atan2(absClickY - player.y, absClickX - player.x);
    } else {
      mousePosRef.current = { x: clickX, y: clickY };
    }

    // 1. COMBAT SYSTEM: Check if player clicked directly on/near any Opponent Bot to ATTACK!
    const targetBot = botsList.find(b => {
      const distToBot = Math.hypot(b.x - absClickX, b.y - absClickY);
      return distToBot <= 85; // Forgiving 85px action hit footprint!
    });

    if (targetBot) {
      const distToBot = Math.hypot(player.x - targetBot.x, player.y - targetBot.y);
      if (distToBot > 180) {
        triggerToast('xp', '❌ ZU WEIT ENTFERNT', 'Gehe näher an den Gegner! (Reichweite 180px)');
        playRetroSound('hurt');
        return;
      }

      // Trigger player attack strike swing
      player.swinging = true;
      player.swingTimer = 10;

      // Calculate dynamic strike damage based on selected tool tier
      let baseDmg = 15;
      if (currentTool.id.includes('iron')) baseDmg = 25;
      else if (currentTool.id.includes('gold')) baseDmg = 38;
      else if (currentTool.id.includes('diamond')) baseDmg = 55;
      else if (currentTool.id.includes('iridium')) baseDmg = 85;

      const damageDealt = baseDmg + Math.floor(Math.random() * 8);

      // Deduct health on bot state
      const nextBotHp = Math.max(0, targetBot.health - damageDealt);
      
      // Spawn energetic combat feedback
      addFloaterFX(targetBot.x, targetBot.y - 18, `-${damageDealt} HP`, '#ef4444');
      addSparksFX(targetBot.x, targetBot.y, '#dc2626', 15, 1.4, true, 'circle');
      triggerScreenShake(6);
      playRetroSound('hit');

      // Aggro link: Bot gains full threat focus on player and pursues immediately!
      targetBot.targetX = player.x;
      targetBot.targetY = player.y;
      targetBot.isMining = false;

      setBotsList(prev => prev.map(b => b.id === targetBot.id ? { ...b, health: nextBotHp, targetX: player.x, targetY: player.y, isMining: false } : b));
      addLog(`⚔️ Du attackierst Dieb <${targetBot.name}>! Er erlitt ${damageDealt} Schaden!`);

      if (nextBotHp <= 0) {
        // Splendid elimination reward loot!
        const bounty = 850 + Math.floor(Math.random() * 650);
        setCoins(c => {
          const nextCoins = c + bounty;
          updateLeaderboardPlayerScore(nextCoins);
          syncCoinsWithDatabase(nextCoins);
          return nextCoins;
        });

        triggerToast('level', '⚔️ ENEMIE BEZUNGEN!', `Loot gesichert: +${bounty} Coins!`);
        addLog(`🏆 [Erfolg] Du hast Dieb <${targetBot.name}> erfolgreich erledigt! Prämie: +${bounty} Coins erhalten!`);
        playRetroSound('levelUp');

        // Instantly respawn elsewhere in survival mode
        setBotsList(prev => prev.map(b => b.id === targetBot.id ? {
          ...b,
          health: 100,
          x: Math.max(200, Math.min(worldSize.width - 200, Math.random() * worldSize.width)),
          y: Math.max(200, Math.min(worldSize.height - 200, Math.random() * worldSize.height)),
          targetX: 1000,
          targetY: 1000,
          cash: Math.max(50, Math.floor(b.cash * 0.7)),
          isMining: false
        } : b));
      }
      return; // Prevent drilling tiles under the bot's body!
    }

    // Fetch grid coordinates index intersected - accounting for 3D coordinate shift
    const targetIdx = tiles.findIndex(t => {
      const is3D = t.type !== 'grass' && t.type !== 'sand' && t.type !== 'volcanic_rock' && t.type !== 'water' && t.type !== 'lava';
      const H = is3D ? 14 : 0;
      return absClickX >= t.x && absClickX < t.x + tileSize &&
             absClickY >= (t.y - H) && absClickY < (t.y + tileSize - H);
    });

    if (targetIdx === -1) return;
    const targetTile = tiles[targetIdx];

    // Interaction distance range restriction
    const centerTileX = targetTile.x + tileSize / 2;
    const centerTileY = targetTile.y + tileSize / 2;
    const dst = Math.hypot(player.x - centerTileX, player.y - centerTileY);

    if (dst > 180) {
      triggerToast('xp', '❌ ZU WEIT ENTFERNT', 'Gehe näher an das Erz heran! (Reichweite 180px)');
      playRetroSound('hurt');
      return;
    }

    // Direct selection slots action dispatcher
    if (selectedHotbarIndex === 0) {
      // Pickaxe Mining Modus
      mineGridBlock(targetIdx, absClickX, absClickY);
    } else {
      // RTS Construction Placement of Building Slots 2-5
      placeStructureOnGrid(targetIdx);
    }
  };

  // Helper trigger action relative to player's face vector (Console / Touch Controllers helper)
  const triggerActionInFront = () => {
    const player = playerRef.current;
    const frontX = player.x + Math.cos(player.angle) * 75;
    const frontY = player.y + Math.sin(player.angle) * 75;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const viewW = canvas.width;
    const viewH = canvas.height;

    const cameraX = Math.max(0, Math.min(worldSize.width - viewW, player.x - viewW / 2));
    const cameraY = Math.max(0, Math.min(worldSize.height - viewH, player.y - viewH / 2));

    const clientX = (frontX - cameraX) + rect.left;
    const clientY = (frontY - cameraY) + rect.top;

    triggerInteractionAt(clientX, clientY);
  };

  // Click Canvas dispatcher (Mining block or Placing machine)
  const handleCanvasInteraction = (e: React.MouseEvent<HTMLCanvasElement>) => {
    triggerInteractionAt(e.clientX, e.clientY);
  };

  const handleChatSubmit = () => {
    if (!chatInput.trim()) return;
    const inputCleaned = chatInput.trim();
    if (inputCleaned.toUpperCase() === 'HACKER!!!') {
      const nextCoins = coins + 1000000;
      setResources(prev => ({
        ...prev,
        wood: (prev.wood || 0) + 1000,
        stone: (prev.stone || 0) + 1000,
        coal: (prev.coal || 0) + 1000,
        iron: (prev.iron || 0) + 1000,
        gold: (prev.gold || 0) + 1000,
        diamond: (prev.diamond || 0) + 1000,
        uranium: (prev.uranium || 0) + 1000,
        iridium: (prev.iridium || 0) + 1000,
        power: (prev.power || 0) + 1000
      }));
      setCoins(nextCoins);
      updateLeaderboardPlayerScore(nextCoins);
      syncCoinsWithDatabase(nextCoins);
      triggerToast('level', '💻 HACK AKTIVIERT!', 'Du hast +1000 von allen Erzen & +1 Million Coins erhalten!');
      addLog('🚀 [SYSTEM] CHEAT AKTIVIERT: +1000 Erze (Holz, Stein, Kohle, Eisen, Gold, Diamant, Uran, Iridium)!');
      playRetroSound('levelUp');
      setChatInput('');
      return;
    }

    const tag = myProfile?.displayName || user?.displayName || 'Spieler';
    addLog(`💬 <${tag}> ${inputCleaned}`);
    
    // Simulate Background Golang Load Balancer routing via Dart/Flutter Mobile syncer
    addLog(`⚙️ [Flutter Syncer] Nachricht via Golang API-Gateway an Haupt-Hub geroutet.`);
    
    // Write message into the real firestore DB 'chat_messages' for global synchronisation
    if (db && user) {
      const displayRole = (myProfile?.role || 'Member').substring(0, 64);
      addDoc(collection(db, 'chat_messages'), {
        text: `[VoxelCompanion-Chat] ${inputCleaned}`,
        userId: user.uid,
        displayName: tag.substring(0, 64),
        role: displayRole,
        purchasedRank: myProfile?.purchasedRank || "",
        createdAt: serverTimestamp(),
        tempId: `voxel-${Date.now()}-${Math.random()}`,
        channel: 'global'
      }).catch(e => console.error("Voxel companion chat sync error: ", e));
    }
    
    setChatInput('');
  };

  // Buy item transactional ledger
  const triggerUnlockShopItem = (item: ShopItem) => {
    const requiredRes = item.costResource;
    const playerHasRes = resources[requiredRes] || 0;

    if (playerHasRes < item.price) {
      const germanResName = requiredRes === 'wood' ? 'Holz 🪵' : requiredRes === 'stone' ? 'Stein 🪨' : requiredRes === 'coal' ? 'Kohle ⬛' : requiredRes === 'iron' ? 'Eisen 🔩' : requiredRes === 'gold' ? 'Gold 🟡' : requiredRes === 'diamond' ? 'Diamant 💎' : requiredRes === 'uranium' ? 'Uranium 🔋' : 'Iridium 🌌';
      triggerToast('xp', '❌ NICHT GENUG RESSOURCEN', `Du benötigst ${item.price} ${germanResName} für dieses Upgrade!`);
      playRetroSound('hurt');
      return;
    }
    if (lvl < item.levelRequired) {
      triggerToast('xp', '🔒 STUFE ZU GERING', `Upgrade setzt Spieler-Level ${item.levelRequired} voraus!`);
      playRetroSound('hurt');
      return;
    }

    const cost = item.price;
    setResources(prev => ({
      ...prev,
      [requiredRes]: Math.max(0, prev[requiredRes] - cost)
    }));

    playRetroSound('buy');

    // Upgrade slot or building storage
    if (item.itemType === 'tool') {
      setCurrentTool({
        id: item.id,
        name: item.name,
        damage: item.damage || 20,
        power: item.id === 'iron_pick' ? 2 : (item.id === 'dia_drill' ? 3 : (item.id === 'iridium_drill' ? 5 : 4)),
        label: item.icon,
        color: item.imageColor
      });
      setSelectedEquipment(prev => ({ ...prev, 0: item.id }));
      addLog(`⚔️ Werkzeug upgraded auf ${item.name}! Mining-Schaden massiv erhöht.`);
    } else if (item.itemType === 'armor') {
      if (item.id === 'suit_nano') setEquippedArmor('nano');
      if (item.id === 'suit_quantum') setEquippedArmor('quantum');
      if (item.id === 'utility_jetpack') setHasJetpack(true);
      addLog(`🛡️ Exo-Suit upgraded auf ${item.name}! Fähigkeiten dauerhaft erweitert.`);
    } else if (item.itemType === 'building') {
      const bToken = item.id;

      setBuildInventory(prev => ({
        ...prev,
        [bToken]: (prev[bToken] || 0) + 1
      }));

      // Enable automatic equip in hotbar category slots
      if (item.id.includes('miner')) {
        setSelectedEquipment(prev => ({ ...prev, 2: item.id }));
      } else if (item.id.includes('seller')) {
        setSelectedEquipment(prev => ({ ...prev, 3: item.id }));
      } else if (item.id.includes('solar') || item.id.includes('wind') || item.id.includes('gen')) {
        setSelectedEquipment(prev => ({ ...prev, 1: item.id }));
      } else if (item.category === 'Basenbau') {
        setSelectedEquipment(prev => ({ ...prev, 4: item.id }));
      }

      addLog(`🛍️ Module erworben: +1 ${item.name} im Baulager! (Slot ausgerüstet)`);
    }

    triggerToast('quest', '🛒 UPGRADE ERFOLGREICH', `${item.name} wurde freigeschaltet.`);
  };

  // Virtual touch d-pad helper keys binder for responsive smartphone play!
  const bindDirection = (key: string, isActive: boolean) => {
    keysPressed.current[key] = isActive;
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0d0d12] relative overflow-hidden font-mono min-h-0">
      
      {/* 2D ARENA VIEWPORT FRAME */}
      <div 
        ref={containerRef} 
        className="flex-1 w-full h-full relative cursor-crosshair overflow-hidden p-0 min-h-0"
      >
        <canvas 
          ref={canvasRef} 
          onClick={handleCanvasInteraction}
          onTouchStart={(e) => {
            if (e.touches && e.touches.length > 0) {
              triggerInteractionAt(e.touches[0].clientX, e.touches[0].clientY);
            }
          }}
          className="absolute inset-0 block w-full h-full border border-neutral-800"
        />

        {/* 1. TOP-LEFT PANEL: ULTIMATE SCOREBOARD LEADERBOARD */}
        <div className="absolute top-4 left-4 z-10 w-64 bg-black/85 border border-neutral-800/80 backdrop-blur-md rounded-2xl p-4 pointer-events-auto transition-transform hover:scale-[1.01] hidden md:block">
          <div className="flex justify-between items-center border-b border-neutral-800 pb-2 mb-3">
            <h4 className="text-amber-500 font-extrabold tracking-wider uppercase text-sm flex items-center gap-1.5">
              <Trophy size={15} className="text-yellow-500 animate-pulse" />
              TOP PLAYERS
            </h4>
            <span className="text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded-full font-black uppercase">
              Live
            </span>
          </div>
          <div className="space-y-2">
            {leaderboard.map((u, idx) => (
              <div 
                key={`lb-${idx}`} 
                className={`flex justify-between items-center text-xs ${u.isPlayer ? 'text-cyan-400 font-black' : 'text-neutral-300 font-medium'}`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="text-[10px] text-neutral-500 font-black">{idx + 1}.</span>
                  <span className="truncate">{u.name}</span>
                </div>
                <span className="text-yellow-500 font-black shrink-0 font-mono">{u.money.toLocaleString()} 💎</span>
              </div>
            ))}
          </div>
        </div>

        {/* 2. TOP-CENTER PANEL: ATMOSPHERICS WEATHER & CLOCK */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-black/85 border border-neutral-800/80 backdrop-blur-md rounded-2xl px-3 sm:px-6 py-1.5 sm:py-2.5 pointer-events-auto flex items-center gap-3 sm:gap-6 text-[10px] sm:text-xs text-neutral-200">
          <div className="flex items-center gap-1.5 sm:gap-2 font-black text-amber-500">
            {gameTime.hour >= 6 && gameTime.hour <= 18 ? (
              <Sun size={13} className="text-yellow-400 animate-spin-slow" />
            ) : (
              <Moon size={13} className="text-blue-400 animate-pulse" />
            )}
            <span>
              {String(gameTime.hour).padStart(2, '0')}:
              {String(gameTime.minute).padStart(2, '0')}
            </span>
          </div>

          <div className="flex items-center gap-1" title="Windkraft-Turbulenz">
            <Wind size={12} className="text-cyan-400" />
            <span>{windSpeed}m/s</span>
          </div>

          <div className="flex items-center gap-1" title="Temperatur">
            <Thermometer size={12} className="text-rose-400" />
            <span>{temperature}°C</span>
          </div>

          <div className="text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 uppercase hidden sm:block">
            {isRaining ? '🌧️ REGEN' : '☀️ KLAR'}
          </div>
        </div>

        {/* 3. TOP-RIGHT PANEL: COZY TUTORIAL BOX */}
        <div className="absolute top-4 right-4 z-10 w-72 bg-emerald-950/85 border border-emerald-500/30 backdrop-blur-md rounded-2xl p-4 pointer-events-auto hidden lg:block">
          <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2 mb-2">
            <h5 className="text-emerald-400 font-black text-xs uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles size={14} className="animate-pulse" />
              MISSION BRIEFING
            </h5>
            <span className="text-[9px] text-emerald-500 font-black bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
              Active
            </span>
          </div>
          <p className="text-xs text-neutral-200 leading-relaxed font-semibold">
            Bewege dich mit WASD-Tasen. Ernte Holz, Kohle und Ores, um passives Einkommen zu generieren. Platziere Auto-Miner im Bau-Modus! Press [B] für den Shop.
          </p>

          <div className="mt-4 border-t border-emerald-500/20 pt-3">
            <div className="text-[9px] text-emerald-400 font-black uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Cpu size={11} className="text-cyan-400 animate-pulse" />
              <span>CO-MANAGED IN DEVLABS (AKTIV):</span>
            </div>
            <ul className="space-y-1.5 text-[10px] text-neutral-300 font-semibold font-mono">
              <li className="flex justify-between items-center bg-black/30 px-1.5 py-1 rounded">
                <span>🦀 Rust WASM:</span>
                <span className="text-cyan-300 font-bold">Aktiv (+24x)</span>
              </li>
              <li className="flex justify-between items-center bg-black/30 px-1.5 py-1 rounded">
                <span>🎯 Flutter Websync:</span>
                <span className="text-purple-300 font-bold">Online</span>
              </li>
              <li className="flex justify-between items-center bg-black/30 px-1.5 py-1 rounded">
                <span>🐍 Python RL AI:</span>
                <span className="text-yellow-300 font-bold">Optimiere (+15%)</span>
              </li>
              <li className="flex justify-between items-center bg-black/30 px-1.5 py-1 rounded">
                <span>🐹 Golang Gateway:</span>
                <span className="text-teal-300 font-bold">12ms Ping</span>
              </li>
            </ul>
          </div>
        </div>

        {/* 4. RIGHT SIDEBAR PANEL: RESOURCE LEDGER SIDEBAR */}
        {isInventoryVisible && (
          <div className="absolute top-28 sm:top-48 right-4 z-10 w-40 sm:w-48 bg-black/85 border border-neutral-800/80 backdrop-blur-md rounded-2xl p-3 sm:p-4 pointer-events-auto space-y-3 shadow-2xl">
            <div className="border-b border-neutral-800 pb-1.5">
              <span className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">DEINE ERZE</span>
              <div className="text-lg sm:text-xl font-black text-amber-500 italic block mt-0.5" style={{ textShadow: '0 0 10px rgba(245,158,11,0.3)' }}>
                {coins.toLocaleString()} 💎
              </div>
            </div>

            <div className="space-y-1.5 text-[11px] sm:text-xs">
              <div className="flex justify-between items-center text-neutral-300">
                <span>🪵 Holz</span>
                <span className="font-extrabold text-white">{resources.wood}</span>
              </div>
              <div className="flex justify-between items-center text-neutral-300">
                <span>🪨 Stein</span>
                <span className="font-extrabold text-white">{resources.stone}</span>
              </div>
              <div className="flex justify-between items-center text-neutral-300">
                <span>⬛ Kohle</span>
                <span className="font-extrabold text-white">{resources.coal}</span>
              </div>
              <div className="flex justify-between items-center text-neutral-300">
                <span>🔩 Eisen</span>
                <span className="font-extrabold text-white">{resources.iron}</span>
              </div>
              <div className="flex justify-between items-center text-neutral-300">
                <span>💎 Diamant</span>
                <span className="font-extrabold text-cyan-400">{resources.diamond}</span>
              </div>
              <div className="flex justify-between items-center text-neutral-300 border-t border-neutral-800 pt-2">
                <span className="text-amber-500 font-extrabold flex items-center gap-1">
                  <Zap size={11} /> Strom
                </span>
                <span className="font-black text-amber-400 font-mono">{resources.power}⚡</span>
              </div>
            </div>
          </div>
        )}

        {/* 5. BOTTOM-LEFT PANEL: LIVE LOBBY CHAT WINDOW */}
        {isChatVisible ? (
          <div className={`absolute ${isMobileMode ? 'bottom-56 left-4 w-72' : 'bottom-4 left-4 w-80'} z-10 bg-black/85 border border-neutral-800/80 backdrop-blur-md rounded-2xl p-4 pointer-events-auto shadow-2xl flex flex-col justify-end transition-all`}>
            <div className="flex justify-between items-center mb-2 border-b border-neutral-800 pb-1">
              <div className="text-[10px] text-neutral-500 font-black uppercase tracking-wider">
                💬 SER CHAT
              </div>
              <button 
                onClick={() => setIsChatVisible(false)} 
                className="text-[10px] text-neutral-400 hover:text-white font-bold"
              >
                [MIN]
              </button>
            </div>
            <div className="h-28 overflow-y-auto space-y-1 text-[11px] font-mono mb-2 custom-scrollbar flex flex-col justify-end">
              {logs.map((lg, i) => (
                <p 
                  key={`log-${i}`} 
                  className={`truncate block leading-relaxed ${
                    lg.startsWith('✨') ? 'text-emerald-400 font-bold' :
                    lg.startsWith('💬') ? 'text-cyan-400 font-medium' :
                    lg.startsWith('❌') || lg.startsWith('☠️') ? 'text-red-400' :
                    lg.startsWith('🧱') ? 'text-orange-400' :
                    'text-neutral-300'
                  }`}
                >
                  {lg}
                </p>
              ))}
            </div>
          <div className="flex gap-2">
            <input 
              id="chat-input-g"
              type="text" 
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder="Sende Nachricht..." 
              className="flex-1 bg-neutral-900 border border-neutral-800 text-[11px] px-3 py-1.5 rounded-xl text-white outline-none focus:border-amber-500 font-mono"
            />
            <button 
              onClick={handleChatSubmit}
              className="bg-amber-500 hover:bg-amber-400 px-3 rounded-xl text-black font-black flex items-center justify-center transition-transform hover:scale-105"
            >
              <Send size={11} className="shrink-0" />
            </button>
          </div>
        </div>
        ) : (
          <button 
            onClick={() => setIsChatVisible(true)}
            className={`absolute ${isMobileMode ? 'bottom-56 left-4' : 'bottom-4 left-4'} z-10 bg-black/85 hover:bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white px-3 py-1.5 rounded-xl font-extrabold text-[10px] uppercase pointer-events-auto flex items-center gap-1.5 shadow-2xl`}
          >
            💬 CHAT ÖFFNEN
          </button>
        )}

        {/* 6. BOTTOM-CENTER PANEL: PLAYER BAR & HOTBAR MECHANIC */}
        <div className={`absolute ${isMobileMode ? 'bottom-[115px]' : 'bottom-4'} left-1/2 -translate-x-1/2 z-10 bg-black/90 border border-neutral-800/90 backdrop-blur-md rounded-2xl p-3 sm:p-4 w-[90%] max-w-[420px] pointer-events-auto flex flex-col items-center gap-2 sm:gap-3`}>
          
          {// Vitals Drawers
          }
          <div className="w-full space-y-2">
            {/* HP Bar */}
            <div className="relative h-4 bg-neutral-900 border border-neutral-800 rounded-full overflow-hidden flex items-center justify-center">
              <div className="absolute inset-y-0 left-0 bg-red-600 transition-all duration-300" style={{ width: `${(health / maxHealth) * 100}%` }} />
              <span className="absolute z-10 text-[10px] font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,1)] flex items-center gap-1 capitalize">
                LEBEN: {Math.floor(health)}/{maxHealth}
              </span>
            </div>

            {/* Energy Bar */}
            <div className="relative h-4 bg-neutral-900 border border-neutral-800 rounded-full overflow-hidden flex items-center justify-center">
              <div className="absolute inset-y-0 left-0 bg-amber-500 transition-all duration-300" style={{ width: `${energy}%` }} />
              <span className="absolute z-10 text-[10px] font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,1)] capitalize">
                ENERGIE: {Math.floor(energy)}/100
              </span>
            </div>

            {/* Level Bar */}
            <div className="relative h-4 bg-neutral-900 border border-neutral-800 rounded-full overflow-hidden flex items-center justify-center">
              <div className="absolute inset-y-0 left-0 bg-emerald-500 transition-all duration-300" style={{ width: `${xp % 100}%` }} />
              <span className="absolute z-10 text-[10px] font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,1)] capitalize">
                XP LEVEL {lvl} ({xp % 100}%)
              </span>
            </div>
          </div>

          {/* Quick Item category switcher (MineEnergy style) */}
          <div className="w-full flex gap-1 justify-start py-1 border-t border-neutral-850 mt-1 max-h-12 overflow-x-auto scrollbar-thin scrollbar-thumb-neutral-800 pointer-events-auto">
            {(() => {
              let listToShow: { id: string; name: string; icon: string; count?: number; owned: boolean }[] = [];
              if (selectedHotbarIndex === 0) {
                listToShow = [
                  { id: 'wooden_pick', name: 'Holz-Spitzhacke', icon: '⛏️', owned: true },
                  ...shopDatabase
                    .filter(item => item.category === 'Spitzhaken')
                    .map(item => ({
                      id: item.id,
                      name: item.name,
                      icon: item.icon,
                      owned: lvl >= item.levelRequired && (currentTool.id === item.id || resources[item.costResource] >= item.price)
                    }))
                ];
              } else {
                let checkBelongs = (id: string) => false;
                if (selectedHotbarIndex === 1) checkBelongs = (id) => id.includes('solar') || id.includes('wind') || id.includes('gen');
                if (selectedHotbarIndex === 2) checkBelongs = (id) => id.includes('miner');
                if (selectedHotbarIndex === 3) checkBelongs = (id) => id.includes('seller');
                if (selectedHotbarIndex === 4) checkBelongs = (id) => {
                  const it = shopDatabase.find(x => x.id === id);
                  return it?.category === 'Basenbau';
                };

                listToShow = shopDatabase
                  .filter(item => {
                    if (selectedHotbarIndex === 4) return item.category === 'Basenbau';
                    return checkBelongs(item.id);
                  })
                  .map(item => {
                    const count = buildInventory[item.id] || 0;
                    return { id: item.id, name: item.name, icon: item.icon, count, owned: count > 0 };
                  });
              }

              if (listToShow.length === 0) return null;

              return listToShow.map(sub => {
                const isActive = selectedEquipment[selectedHotbarIndex] === sub.id;
                return (
                  <button
                    key={`equip-${sub.id}`}
                    onClick={() => {
                      if (sub.owned) {
                        selectActiveEquipment(selectedHotbarIndex, sub.id);
                        playRetroSound('hit');
                      } else {
                        setIsShopOpen(true);
                        setShopTab(selectedHotbarIndex === 0 ? 'tools' : (selectedHotbarIndex === 4 ? 'build' : 'machines'));
                        triggerToast('xp', '🛒 SHOP GEÖFFNET', `Kaufe '${sub.name}' im Trade-Shop!`);
                      }
                    }}
                    className={`px-2 py-1 rounded-lg text-[9px] uppercase font-bold shrink-0 flex items-center gap-1 transition-all border ${
                      isActive 
                        ? 'bg-amber-500 text-black border-amber-300 font-extrabold scale-105' 
                        : sub.owned 
                          ? 'bg-neutral-800 text-neutral-200 border-neutral-700 hover:bg-neutral-700' 
                          : 'bg-neutral-950/40 text-neutral-600 border-neutral-900 opacity-50'
                    }`}
                    title={sub.name}
                  >
                    <span>{sub.icon}</span>
                    <span className="max-w-[75px] truncate hidden sm:inline">{sub.name.replace(' panel', '').replace(' generator', '').replace(' miner', '').replace(' seller', '')}</span>
                    {sub.count !== undefined && (
                      <span className={`text-[8px] px-1 rounded ${isActive ? 'bg-amber-600 text-white font-black' : 'bg-neutral-900 text-emerald-400'}`}>
                        {sub.count}
                      </span>
                    )}
                    {!sub.owned && <span className="text-[8px] text-amber-500">🔒</span>}
                  </button>
                );
              });
            })()}
          </div>

          {/* HOTBAR BUTTON GRIDS */}
          <div className="flex gap-2 w-full pt-1">
            {[
              { id: 'mining', label: currentTool.label, name: currentTool.name, key: '1' },
              (() => {
                const id = selectedEquipment[1] || 'solar';
                const item = shopDatabase.find(x => x.id === id);
                return { id, label: item?.icon || '☀️', name: item?.name || 'Solarpanel', key: '2' };
              })(),
              (() => {
                const id = selectedEquipment[2] || 'miner';
                const item = shopDatabase.find(x => x.id === id);
                return { id, label: item?.icon || '🤖', name: item?.name || 'Auto-Miner', key: '3' };
              })(),
              (() => {
                const id = selectedEquipment[3] || 'seller';
                const item = shopDatabase.find(x => x.id === id);
                return { id, label: item?.icon || '💵', name: item?.name || 'Auto-Seller', key: '4' };
              })(),
              (() => {
                const id = selectedEquipment[4] || 'wall';
                const item = shopDatabase.find(x => x.id === id);
                return { id, label: item?.icon || '🧱', name: item?.name || 'Eisenmauer', key: '5' };
              })()
            ].map((slot, idx) => {
              const active = idx === selectedHotbarIndex;
              const isPlaceable = idx > 0;
              const count = isPlaceable ? (buildInventory[slot.id] || 0) : null;

              return (
                <button
                  key={`hot-${idx}`}
                  onClick={() => {
                    setSelectedHotbarIndex(idx);
                    playRetroSound('hit');
                  }}
                  className={`flex-1 h-14 rounded-xl border-2 flex flex-col items-center justify-center relative transition-all pointer-events-auto ${
                    active 
                      ? 'border-amber-500 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.25)] scale-105' 
                      : 'border-neutral-800 bg-neutral-900 hover:border-neutral-600'
                  }`}
                  title={`${slot.name} (Hotkey ${slot.key})`}
                >
                  <span className="absolute top-1 left-2 text-[8px] text-neutral-500 font-bold">{slot.key}</span>
                  <span className="text-xl">{slot.label}</span>
                  
                  {isPlaceable && (
                    <span className="absolute bottom-1 right-2 text-[10px] text-emerald-400 font-black">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* MOBILE OVERLAYS: TOUCH D-PAD AND ACTION STACK */}
        {isMobileMode && (
          <>
            {/* Left Thumb Virtual Touch D-pad */}
            <div className="absolute bottom-4 left-4 z-10 p-2 bg-black/75 border border-neutral-800/80 backdrop-blur-md rounded-2xl w-[140px] h-[140px] flex items-center justify-center pointer-events-auto shadow-2xl select-none">
              <div className="grid grid-cols-3 gap-1.5 w-full h-full select-none">
                <div />
                <button 
                  onTouchStart={() => bindDirection('w', true)} 
                  onTouchEnd={() => bindDirection('w', false)}
                  onTouchCancel={() => bindDirection('w', false)}
                  onMouseDown={() => bindDirection('w', true)}
                  onMouseUp={() => bindDirection('w', false)}
                  onMouseLeave={() => bindDirection('w', false)}
                  className="bg-neutral-800 active:bg-amber-500 text-white rounded-xl flex items-center justify-center text-sm font-black transition-colors select-none shadow-md border border-neutral-700/45 hover:bg-neutral-700"
                >
                  ▲
                </button>
                <div />
                <button 
                  onTouchStart={() => bindDirection('a', true)} 
                  onTouchEnd={() => bindDirection('a', false)}
                  onTouchCancel={() => bindDirection('a', false)}
                  onMouseDown={() => bindDirection('a', true)}
                  onMouseUp={() => bindDirection('a', false)}
                  onMouseLeave={() => bindDirection('a', false)}
                  className="bg-neutral-800 active:bg-amber-500 text-white rounded-xl flex items-center justify-center text-sm font-black transition-colors select-none shadow-md border border-neutral-700/45 hover:bg-neutral-700"
                >
                  ◀
                </button>
                <div className="bg-neutral-900 rounded-xl flex items-center justify-center text-[11px] text-neutral-400 font-bold select-none border border-neutral-800 animate-pulse">🕹️</div>
                <button 
                  onTouchStart={() => bindDirection('d', true)} 
                  onTouchEnd={() => bindDirection('d', false)}
                  onTouchCancel={() => bindDirection('d', false)}
                  onMouseDown={() => bindDirection('d', true)}
                  onMouseUp={() => bindDirection('d', false)}
                  onMouseLeave={() => bindDirection('d', false)}
                  className="bg-neutral-800 active:bg-amber-500 text-white rounded-xl flex items-center justify-center text-sm font-black transition-colors select-none shadow-md border border-neutral-700/45 hover:bg-neutral-700"
                >
                  ▶
                </button>
                <div />
                <button 
                  onTouchStart={() => bindDirection('s', true)} 
                  onTouchEnd={() => bindDirection('s', false)}
                  onTouchCancel={() => bindDirection('s', false)}
                  onMouseDown={() => bindDirection('s', true)}
                  onMouseUp={() => bindDirection('s', false)}
                  onMouseLeave={() => bindDirection('s', false)}
                  className="bg-neutral-800 active:bg-amber-500 text-white rounded-xl flex items-center justify-center text-sm font-black transition-colors select-none shadow-md border border-neutral-700/45 hover:bg-neutral-700"
                >
                  ▼
                </button>
              </div>
            </div>

            {/* Right Thumb Comfortable Action Stack */}
            <div className="absolute bottom-4 right-4 z-10 flex flex-col items-end gap-2.5 pointer-events-auto">
              {/* Shortcut Quick Triggers to circumvent missing physical keyboard */}
              <div className="flex gap-1.5">
                <button 
                  onClick={() => { setIsShopOpen(true); playRetroSound('buy'); }}
                  className="bg-amber-500 active:bg-amber-400 p-1.5 px-2.5 text-black font-black text-[9px] uppercase rounded-lg shadow-xl flex items-center gap-1 leading-none"
                >
                  <ShoppingBag size={11} />
                  SHOP [B]
                </button>
                <button 
                  onClick={() => { setIsClansOpen(true); playRetroSound('buy'); }}
                  className="bg-neutral-900 border border-neutral-800 active:border-neutral-700 p-1.5 px-2.5 text-neutral-300 font-bold text-[9px] uppercase rounded-lg shadow-xl flex items-center gap-1 leading-none"
                >
                  <Users size={11} />
                  CLAN [T]
                </button>
              </div>

              {/* Action Circle Grid */}
              <div className="flex items-center gap-2">
                {hasJetpack && (
                  <button 
                    onClick={() => {
                      setIsJetpackActive(p => {
                        const next = !p;
                        addLog(next ? '🚀 Jetpack gestartet! Du fliegst rasant über Lava & Gräben.' : '🚀 Jetpack abgeschaltet.');
                        return next;
                      });
                      playRetroSound('powerup');
                    }}
                    className={`w-14 h-14 rounded-full border-2 flex items-center justify-center text-base shadow-2xl transition-all ${isJetpackActive ? 'bg-rose-500 border-rose-300 animate-pulse text-white' : 'bg-neutral-900 border-neutral-800 text-neutral-400 active:bg-neutral-800'}`}
                    title="Jetpack Boost umschalten"
                  >
                    🚀
                  </button>
                )}

                <button 
                  onClick={triggerActionInFront}
                  className="w-18 h-18 bg-amber-500 active:bg-amber-400 border-4 border-amber-300 text-black font-black rounded-full flex flex-col items-center justify-center shadow-2xl transition-transform active:scale-95"
                >
                  <span className="text-xl">{selectedHotbarIndex === 0 ? '⛏️' : '🧱'}</span>
                  <span className="text-[8px] uppercase tracking-wider mt-0.5 font-black">{selectedHotbarIndex === 0 ? 'HAUEN' : 'BAUEN'}</span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* MODAL TRIGGERS AND NAV OVERLAYS */}
        <div className="absolute top-4 left-4 md:left-[15%] pointer-events-auto z-10 flex flex-wrap gap-1.5 sm:gap-2 max-w-[85%] md:max-w-none">
          <button 
            onClick={() => { setIsShopOpen(true); playRetroSound('buy'); }} 
            className="bg-amber-500 hover:bg-amber-400 px-3 py-1.5 rounded-xl text-black font-black text-xs uppercase flex items-center gap-1.5 transition-transform hover:scale-105 shadow-2xl"
          >
            <ShoppingBag size={13} />
            TRADE-SHOP [B]
          </button>
          <button 
            onClick={() => { setIsClansOpen(true); playRetroSound('buy'); }} 
            className="bg-black/85 border border-neutral-800 text-neutral-300 hover:text-white px-3 py-1.5 rounded-xl font-bold text-xs uppercase flex items-center gap-1.5 transition-all shadow-2xl"
          >
            <Users size={13} />
            CLANS [T]
          </button>
          <button 
            onClick={() => { setIsInventoryVisible(p => !p); playRetroSound('hit'); }} 
            className={`px-3 py-1.5 rounded-xl flex items-center justify-center transition-all shadow-2xl gap-1.5 border leading-none ${isInventoryVisible ? 'bg-indigo-600 text-white border-indigo-500 font-extrabold' : 'bg-black/85 border-neutral-800 text-neutral-300 hover:text-white'}`}
            title="Inventar / Erze einblenden"
          >
            <Layers size={13} />
            🎒 ERZE
          </button>
          <button 
            onClick={() => { setIsChatVisible(p => !p); playRetroSound('hit'); }} 
            className={`px-3 py-1.5 rounded-xl flex items-center justify-center transition-all shadow-2xl gap-1.5 border leading-none ${isChatVisible ? 'bg-cyan-600 text-white border-cyan-500 font-extrabold' : 'bg-black/85 border-neutral-800 text-neutral-300 hover:text-white'}`}
            title="Chat einblenden"
          >
            <Send size={13} />
            💬 CHAT
          </button>
          <button 
            onClick={() => { setIsMobileMode(p => !p); playRetroSound('buy'); }} 
            className={`px-3 py-1.5 rounded-xl flex items-center justify-center transition-all shadow-2xl gap-1.5 border leading-none ${isMobileMode ? 'bg-amber-500 hover:bg-amber-400 text-black border-amber-500 font-extrabold' : 'bg-black/85 border-neutral-800 text-neutral-300 hover:text-white'}`}
            title="Handy Touch-Steuerung umschalten"
          >
            <Smartphone size={13} />
            <span className="hidden sm:inline text-[10px] font-bold">TOUCH-MODE</span>
          </button>
          <button 
            onClick={toggleFullscreen} 
            className="bg-black/85 border border-neutral-800 text-neutral-300 hover:text-white px-3 py-1.5 rounded-xl flex items-center justify-center transition-all shadow-2xl gap-1.5"
            title="Vollbildmodus umschalten"
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            <span className="hidden sm:inline text-[10px] font-bold">VOLLBILD</span>
          </button>
          <button 
            onClick={toggleMuted} 
            className="bg-black/85 border border-neutral-800 text-neutral-400 hover:text-white px-2.5 py-1.5 rounded-xl flex items-center justify-center transition-all shadow-2xl"
            title="Lautstärken stummschalten"
          >
            {isMuted ? <VolumeX size={13} /> : <Volume2 size={13} className="text-amber-400" />}
          </button>
          <button 
            onClick={onClose} 
            className="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-xl font-black text-xs uppercase flex items-center justify-center transition-all shadow-2xl"
            title="Modul beenden"
          >
            BEENDEN [X]
          </button>
        </div>

      {/* RETHINK DIALOG MODAL: BUILDING CLANS */}
      <AnimatePresence>
        {isClansOpen && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 pointer-events-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-neutral-950 border border-neutral-800 w-full max-w-lg max-h-full overflow-y-auto rounded-3xl p-6 relative"
            >
              <button 
                onClick={() => setIsClansOpen(false)}
                className="absolute top-4 right-4 text-neutral-400 hover:text-white"
              >
                <X size={20} />
              </button>

              <h3 className="text-base font-black text-white uppercase tracking-widest flex items-center gap-2 mb-4">
                <Users className="text-amber-500" />
                GLADIATOR CLANS COHESION SYSTEM
              </h3>
              
              <p className="text-xs text-neutral-400 leading-relaxed mb-6 font-mono">
                Gründe mit Gladiator-Spielern einen Team-Clan! Teammitglieder durchschreiten gebaute Sicherheitstore automatisch barrierefrei, koppeln ihre Stromnetze auf der Karte und beschützen sich gegenseitig vor feindseligen Starthaken.
              </p>

              <div className="space-y-4">
                <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-2xl flex items-center justify-between text-xs font-mono">
                  <div>
                    <span className="font-extrabold text-cyan-400">PVP Arena Legion (Mitglieder: 6/25)</span>
                    <p className="text-[10px] text-neutral-500 mt-1 italic">"We mine deep or we go home!"</p>
                  </div>
                  <button 
                    onClick={() => {
                      triggerToast('quest', 'CLAN BEITRITT', 'Du bist erfolgreich der PVP Arena Legion beigetreten!');
                      setIsClansOpen(false);
                    }}
                    className="bg-amber-500 text-black font-black uppercase text-[10px] px-3 py-1.5 rounded-xl hover:bg-amber-400 transition-all font-mono"
                  >
                    BEITRETEN
                  </button>
                </div>

                <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-2xl flex items-center justify-between text-xs font-mono">
                  <div>
                    <span className="font-extrabold text-[#9c27b0]">Redstone Legion (Mitglieder: 4/12)</span>
                    <p className="text-[10px] text-neutral-500 mt-1 italic">"Automating victory through clean power grids"</p>
                  </div>
                  <button 
                    onClick={() => {
                      triggerToast('quest', 'CLAN BEITRITT', 'Du bist erfolgreich der Redstone Legion beigetreten!');
                      setIsClansOpen(false);
                    }}
                    className="bg-amber-500 text-black font-black uppercase text-[10px] px-3 py-1.5 rounded-xl hover:bg-amber-400 transition-all font-mono"
                  >
                    BEITRETEN
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* RETRO MODAL OVERLAY: TRADE SHOP SYSTEM */}
      <AnimatePresence>
        {isShopOpen && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 pointer-events-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-neutral-950 border border-neutral-800 w-full max-w-4xl h-full max-h-full sm:h-[600px] rounded-2xl sm:rounded-3xl p-4 sm:p-6 relative overflow-hidden flex flex-col"
            >
              <button 
                onClick={() => setIsShopOpen(false)}
                className="absolute top-4 right-4 text-neutral-400 hover:text-white"
              >
                <X size={20} />
              </button>

              <div className="flex justify-between items-start border-b border-neutral-800 pb-4 mb-4">
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-widest flex items-center gap-2">
                    <ShoppingBag className="text-amber-500 animate-pulse" />
                    MINEENERGY PRO TRADE-SHOP
                  </h3>
                  <p className="text-xs text-neutral-400">Rüste dich mit überlegenen Bohrern aus, rüste Nano-Armor Suits auf oder schalte Automaten für dein Grid frei!</p>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl px-4 py-2 font-black text-amber-500 font-mono text-sm shrink-0">
                  DEINE ERZE: {coins.toLocaleString()} 💎
                </div>
              </div>

              {/* TABS SELECTOR */}
              <div className="flex gap-2 border-b border-neutral-900 pb-3 mb-4">
                {[
                  { id: 'tools', label: '⛏️ Spitzhaken' },
                  { id: 'machines', label: '⚙️ Generatoren' },
                  { id: 'build', label: '🧱 Basenbau' },
                  { id: 'armor', label: '🛡️ Exo-Suits' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => { setShopTab(tab.id as any); playRetroSound('hit'); }}
                    className={`px-4 py-2 rounded-xl font-black text-xs uppercase transition-all ${
                      shopTab === tab.id 
                        ? 'bg-amber-500 text-black' 
                        : 'bg-neutral-900 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* ITEMS DRAW LISTINGS */}
              <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-1 custom-scrollbar">
                {shopDatabase
                  .filter(item => {
                    if (shopTab === 'tools') return item.category === 'Spitzhaken';
                    if (shopTab === 'machines') return item.category === 'Maschinen';
                    if (shopTab === 'build') return item.category === 'Basenbau';
                    if (shopTab === 'armor') return item.category === 'Exo-Suits';
                    return true;
                  })
                  .map(item => {
                    const levelOk = lvl >= item.levelRequired;
                    const costRes = item.costResource;
                    const canAfford = (resources[costRes] || 0) >= item.price;
                    const resGlowName = costRes === 'wood' ? '🪵 Holz' : costRes === 'stone' ? '🪨 Stein' : costRes === 'coal' ? '⬛ Kohle' : costRes === 'iron' ? '🔩 Eisen' : costRes === 'gold' ? '🟡 Gold' : costRes === 'diamond' ? '💎 Diamant' : costRes === 'uranium' ? '🔋 Uranium' : '🌌 Iridium';

                    return (
                      <div 
                        key={item.id}
                        className="bg-neutral-900 border border-neutral-800 hover:border-amber-500/40 rounded-2xl p-4 flex flex-col justify-between transition-all"
                      >
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-[18px]">{item.icon}</span>
                            {!levelOk && (
                              <span className="text-[8px] bg-red-600/10 border border-red-600/20 text-red-500 px-2 py-0.5 rounded font-black uppercase">
                                Lvl {item.levelRequired} nötig
                              </span>
                            )}
                          </div>
                          
                          <h4 className="text-xs font-black text-white uppercase tracking-wide">{item.name}</h4>
                          <p className="text-[10px] text-neutral-400 leading-relaxed font-mono mt-1 mb-3">{item.description}</p>
                          
                          <div className="bg-black/50 border border-neutral-950 p-2 rounded-xl space-y-1 text-[9px] font-mono mb-4 text-neutral-300">
                            <div className="flex justify-between">
                              <span>Taktung:</span>
                              <span className="text-emerald-400 font-bold">{item.produce}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Betriebskosten:</span>
                              <span className="text-amber-500">{item.consume}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 border-t border-neutral-800/60 pt-3 mt-1.5 font-mono">
                          <div className="flex justify-between items-center text-[10px] text-neutral-400">
                            <span>Kostet:</span>
                            <span className="text-amber-500 font-extrabold">{item.price} {resGlowName}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[8px] text-neutral-500">Du hast: {resources[costRes] || 0}</span>
                            <button
                              disabled={!canAfford || !levelOk}
                              onClick={() => triggerUnlockShopItem(item)}
                              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all font-mono ${
                                canAfford && levelOk
                                  ? 'bg-emerald-500 hover:bg-emerald-400 text-black hover:scale-105'
                                  : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                              }`}
                            >
                              Kaufen
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      </div>
    </div>
  );
};
