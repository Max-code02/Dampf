import fs from 'fs';

let content = fs.readFileSync('src/components/ClashArenaView.tsx', 'utf-8');

// 1. Update State variables
content = content.replace(
  /const \[isPlaying, setIsPlaying\] = useState\(false\);/,
  `const [currentScreen, setCurrentScreen] = useState<'menu'|'deck'>('menu');
  const [userDeck, setUserDeck] = useState<string[]>([...CARDS_POOL].slice(0, 8).map(c => c.id));
  const [isPlaying, setIsPlaying] = useState(false);`
);

// 2. Update initGame
content = content.replace(
  /const initGame = \(\) => {[\s\S]*?const shuffled = \[\.\.\.CARDS_POOL\].sort\(\(\) => 0\.5 - Math\.random\(\)\);[\s\S]*?const initialDeck = shuffled\.slice\(0, 4\);[\s\S]*?const nextSlot = shuffled\[4\];/,
  `const initGame = () => {
    // Setup Deck using user layout
    const activeCards = CARDS_POOL.filter(card => userDeck.includes(card.id));
    const shuffled = [...activeCards].sort(() => 0.5 - Math.random());
    const initialDeck = shuffled.slice(0, 4);
    const nextSlot = shuffled[4] || CARDS_POOL[0];`
);

// 3. Inject Deck setup logic
// We'll replace the prompt overlay and the entire return structure with a 3-tier view.
fs.writeFileSync('src/components/ClashArenaView.tsx', content);
console.log('States injected');
