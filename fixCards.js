import fs from 'fs';

const filePath = 'src/components/ClashArenaView.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

// The basic idea: update playType, speed and radius where appropriate.
const spells = ['arrows', 'fireball', 'freeze', 'poison', 'rage', 'the_log', 'zap', 'tornado', 'earthquake', 'clone', 'heal', 'void', 'giant_snowball', 'royal_delivery', 'goblin_barrel', 'barbarian_barrel'];

const buildings = ['bomb_tower', 'cannon', 'goblin_cage', 'goblin_drill', 'goblin_hut', 'barbarian_hut', 'elixir_collector', 'furnace', 'inferno_tower', 'mortar', 'party_hut', 'rocket_silo', 'tesla', 'tombstone', 'x_bow'];

const towerTroops = ['royal_chef', 'cannoneer', 'tower_princess', 'dagger_duchess'];

spells.forEach(s => {
  const regex = new RegExp(`{ id: '${s}',(.*?)}`, 'g');
  content = content.replace(regex, (match, body) => {
     let newBody = body.replace(/playType: '.*?'/, "playType: 'spell'");
     newBody = newBody.replace(/speed: [0-9.]+/, "speed: 0");
     if (!newBody.includes('radius:')) {
       newBody = newBody.replace(" }", ", radius: 50 }");
     }
     return `{ id: '${s}',${newBody}}`;
  });
});

buildings.forEach(s => {
  const regex = new RegExp(`{ id: '${s}',(.*?)}`, 'g');
  content = content.replace(regex, (match, body) => {
     let newBody = body.replace(/playType: '.*?'/, "playType: 'building'");
     newBody = newBody.replace(/speed: [0-9.]+/, "speed: 0");
     return `{ id: '${s}',${newBody}}`;
  });
});

towerTroops.forEach(s => {
  const regex = new RegExp(`{ id: '${s}',(.*?)}`, 'g');
  content = content.replace(regex, (match, body) => {
     let newBody = body.replace(/playType: '.*?'/, "playType: 'building'");
     newBody = newBody.replace(/speed: [0-9.]+/, "speed: 0");
     return `{ id: '${s}',${newBody}}`;
  });
});

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Fixed cards logic!');
