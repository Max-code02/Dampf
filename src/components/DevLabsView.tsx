import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  addDoc, 
  collection, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  X, 
  Cpu, 
  Smartphone, 
  Play, 
  RefreshCw, 
  Zap, 
  Send, 
  Layers, 
  Sliders, 
  Activity, 
  MessageSquare, 
  Bell, 
  Check, 
  Sparkles, 
  BarChart2,
  Terminal,
  Grid,
  Settings,
  HelpCircle,
  PlayCircle,
  Pause,
  Copy,
  Shield,
  Wifi,
  AlertTriangle,
  Layout,
  BarChart
} from 'lucide-react';

interface DevLabsViewProps {
  user: any;
  myProfile: any;
  db: any;
  chatMessages: any[];
  onClose: () => void;
  triggerToast: (type: 'quest' | 'xp' | 'level', title: string, description: string, options?: any) => void;
}

export const DevLabsView: React.FC<DevLabsViewProps> = ({
  user,
  myProfile,
  db,
  chatMessages,
  onClose,
  triggerToast
}) => {
  // Four major development environments
  const [activeTab, setActiveTab] = useState<'rust' | 'flutter' | 'python' | 'go'>('rust');

  // ==========================================
  // RUST WASM VOXEL GENERATOR STATE & LOGIC
  // ==========================================
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [chunkSize, setChunkSize] = useState<8 | 12 | 16>(12);
  const [biome, setBiome] = useState<'plains' | 'nether' | 'ocean' | 'desert'>('plains');
  const [noiseFrequency, setNoiseFrequency] = useState<number>(3);
  const [wasmPerformanceMultiplier, setWasmPerformanceMultiplier] = useState<number>(24); 
  const [shaderPreset, setShaderPreset] = useState<'classic' | 'cyberpunk' | 'retro' | 'sunset' | 'toxic'>('classic');
  const [ambientLight, setAmbientLight] = useState<number>(100); // percentage 0 - 200
  const [isGenerating, setIsGenerating] = useState(false);
  const [telemetry, setTelemetry] = useState({
    calcTimePr: 0.08, 
    totalTimeMs: 0.12, 
    jsEquivalentMs: 2.88, 
    blocksCount: 1728,
    ramAllocation: 2.4, 
    wasmMemoryUsage: 16.2, 
    wasmCallsCount: 0
  });

  const [rotationAngle, setRotationAngle] = useState(45); 
  const [zoom, setZoom] = useState(1.1);

  // Generate 3D Noise heights
  const generateVoxelData = useMemo(() => {
    const size = chunkSize;
    const blocks: { x: number; y: number; z: number; type: string }[] = [];
    const seedValue = biome === 'plains' ? 1.2 : biome === 'nether' ? 2.5 : biome === 'ocean' ? 0.7 : 1.8;
    
    for (let x = 0; x < size; x++) {
      for (let z = 0; z < size; z++) {
        const nx = x / size * noiseFrequency;
        const nz = z / size * noiseFrequency;
        let heightFactor = Math.sin(nx * seedValue) * Math.cos(nz * seedValue * 1.5) + Math.cos(nx * 0.5) * Math.sin(nz * seedValue);
        
        let h = Math.floor(((heightFactor + 2) / 4) * (size - 1)) + 1;
        if (biome === 'ocean') {
          h = Math.max(2, h - 1);
        }
        
        for (let y = 0; y < size; y++) {
          if (y <= h) {
            let blockType = 'stone';
            if (biome === 'plains') {
              if (y === h) blockType = 'grass';
              else if (y > h - 2) blockType = 'dirt';
            } else if (biome === 'nether') {
              if (y === h && Math.random() > 0.7) blockType = 'lava';
              else blockType = 'netherrack';
            } else if (biome === 'ocean') {
              if (y <= 3) blockType = 'sand';
              else blockType = 'water';
            } else if (biome === 'desert') {
              if (y === h) blockType = 'sand';
              else if (y > h - 2) blockType = 'sandstone';
            }
            blocks.push({ x, y, z, type: blockType });
          } else {
            if (biome === 'ocean' && y <= 4) {
              blocks.push({ x, y, z, type: 'water' });
            }
          }
        }
      }
    }
    return blocks;
  }, [chunkSize, biome, noiseFrequency]);

  // Voxel Rendering effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const startCalculations = performance.now();
    let simulatedWasmCalls = generateVoxelData.length * 3; 
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const size = chunkSize;
    const blockWidth = 24 * zoom;
    const blockHeight = 12 * zoom;
    const verticalStep = 14 * zoom;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2 + (size * blockHeight / 4);

    const getBlockColors = (type: string) => {
      let baseColors = { top: '#52bd3a', left: '#368c24', right: '#296b1b' };
      
      switch (type) {
        case 'grass':
          baseColors = { top: '#52bd3a', left: '#36c24', right: '#296b1b' };
          break;
        case 'dirt':
          baseColors = { top: '#866043', left: '#61442e', right: '#4c3524' };
          break;
        case 'stone':
          baseColors = { top: '#8a8a8a', left: '#666666', right: '#4f4f4f' };
          break;
        case 'netherrack':
          baseColors = { top: '#732121', left: '#541515', right: '#3b0e0e' };
          break;
        case 'lava':
          baseColors = { top: '#ff6200', left: '#d94100', right: '#b32400' };
          break;
        case 'sand':
          baseColors = { top: '#e3c681', left: '#bda362', right: '#9e8549' };
          break;
        case 'sandstone':
          baseColors = { top: '#bfa061', left: '#9c7f46', right: '#826835' };
          break;
        case 'water':
          baseColors = { top: 'rgba(31,117,214,0.65)', left: 'rgba(18,87,166,0.7)', right: 'rgba(12,65,128,0.75)' };
          break;
        default:
          baseColors = { top: '#dddddd', left: '#aaaaaa', right: '#777777' };
      }

      // Shader presets modification
      if (shaderPreset === 'cyberpunk') {
        const isWaterOrLava = type === 'water' || type === 'lava';
        return {
          top: isWaterOrLava ? '#f43f5e' : '#1e1b4b',
          left: '#ec4899',
          right: '#0ea5e9'
        };
      } else if (shaderPreset === 'retro') {
        return {
          top: '#22c55e',
          left: '#15803d',
          right: '#14532d'
        };
      } else if (shaderPreset === 'sunset') {
        return {
          top: '#f97316',
          left: '#b91c1c',
          right: '#4c1d95'
        };
      } else if (shaderPreset === 'toxic') {
        return {
          top: '#a3e635',
          left: '#4c1d95',
          right: '#581c87'
        };
      }

      return baseColors;
    };

    // Helper to apply ambient light multiplier
    const applyLighting = (colorHex: string, factor: number) => {
      if (colorHex.startsWith('rgba')) return colorHex;
      
      // Expand shorthand forms if necessary
      let fullHex = colorHex;
      if (colorHex.length === 4) {
        fullHex = '#' + colorHex[1] + colorHex[1] + colorHex[2] + colorHex[2] + colorHex[3] + colorHex[3];
      }
      
      let r = parseInt(fullHex.slice(1, 3), 16);
      let g = parseInt(fullHex.slice(3, 5), 16);
      let b = parseInt(fullHex.slice(5, 7), 16);

      r = Math.min(255, Math.max(0, Math.floor(r * factor)));
      g = Math.min(255, Math.max(0, Math.floor(g * factor)));
      b = Math.min(255, Math.max(0, Math.floor(b * factor)));

      return `rgb(${r}, ${g}, ${b})`;
    };

    const lightMultiplier = ambientLight / 100;

    const drawCube = (x3d: number, y3d: number, z3d: number, type: string) => {
      const rad = (rotationAngle * Math.PI) / 180;
      const transX = x3d - size / 2;
      const transZ = z3d - size / 2;
      
      const rotX = transX * Math.cos(rad) - transZ * Math.sin(rad);
      const rotZ = transX * Math.sin(rad) + transZ * Math.cos(rad);
      
      const screenX = centerX + (rotX - rotZ) * (blockWidth / 2);
      const screenY = centerY + (rotX + rotZ) * (blockHeight / 2) - y3d * verticalStep;

      const baseColors = getBlockColors(type);
      const finalLeft = applyLighting(baseColors.left, lightMultiplier * 0.82);
      const finalRight = applyLighting(baseColors.right, lightMultiplier * 0.65);
      const finalTop = applyLighting(baseColors.top, lightMultiplier * 1.15);

      // 1. Left Face
      ctx.fillStyle = finalLeft;
      ctx.beginPath();
      ctx.moveTo(screenX, screenY);
      ctx.lineTo(screenX - blockWidth / 2, screenY - blockHeight / 2);
      ctx.lineTo(screenX - blockWidth / 2, screenY + blockHeight / 2 - blockHeight / 2 - verticalStep);
      ctx.lineTo(screenX, screenY - verticalStep);
      ctx.closePath();
      ctx.fill();

      // 2. Right Face
      ctx.fillStyle = finalRight;
      ctx.beginPath();
      ctx.moveTo(screenX, screenY);
      ctx.lineTo(screenX + blockWidth / 2, screenY - blockHeight / 2);
      ctx.lineTo(screenX + blockWidth / 2, screenY + blockHeight / 2 - blockHeight / 2 - verticalStep);
      ctx.lineTo(screenX, screenY - verticalStep);
      ctx.closePath();
      ctx.fill();

      // 3. Top Face
      ctx.fillStyle = finalTop;
      ctx.beginPath();
      ctx.moveTo(screenX, screenY - verticalStep);
      ctx.lineTo(screenX - blockWidth / 2, screenY - blockHeight / 2 - verticalStep);
      ctx.lineTo(screenX, screenY - blockHeight - verticalStep);
      ctx.lineTo(screenX + blockWidth / 2, screenY - blockHeight / 2 - verticalStep);
      ctx.closePath();
      ctx.fill();
    };

    const rotatedOrder = [...generateVoxelData].sort((a, b) => {
      const rad = (rotationAngle * Math.PI) / 180;
      const rotZa = (a.x - size/2) * Math.sin(rad) + (a.z - size/2) * Math.cos(rad);
      const rotZb = (b.x - size/2) * Math.sin(rad) + (b.z - size/2) * Math.cos(rad);
      
      if (Math.abs(rotZa - rotZb) < 0.01) {
        return a.y - b.y;
      }
      return rotZa - rotZb;
    });

    rotatedOrder.forEach(voxel => {
      drawCube(voxel.x, voxel.y, voxel.z, voxel.type);
    });

    const endCalculations = performance.now();
    const rawTime = endCalculations - startCalculations;
    
    const calculatedWasmMs = Math.max(0.04, rawTime / wasmPerformanceMultiplier);
    const simulatedJsMs = Math.max(1.8, rawTime * 1.5);
    
    setTelemetry({
      calcTimePr: parseFloat((calculatedWasmMs * 0.6).toFixed(3)),
      totalTimeMs: parseFloat(calculatedWasmMs.toFixed(2)),
      jsEquivalentMs: parseFloat(simulatedJsMs.toFixed(2)),
      blocksCount: generateVoxelData.length,
      ramAllocation: parseFloat(((generateVoxelData.length * 32) / 1024).toFixed(3)),
      wasmMemoryUsage: parseFloat((16.0 + (size * size * size / 1024) * 0.1).toFixed(1)),
      wasmCallsCount: simulatedWasmCalls
    });
  }, [generateVoxelData, chunkSize, rotationAngle, zoom, biome, noiseFrequency, wasmPerformanceMultiplier, shaderPreset, ambientLight]);

  const handleTestCompile = () => {
    setIsGenerating(true);
    triggerToast('quest', '🦀 WASM COMPILE STATUS', 'Kompiliere Minecraft WASM32-Standard-Bibliotheken in Rust...', { amount: 100 });
    setTimeout(() => {
      setIsGenerating(false);
      triggerToast('xp', '⚡ SPEED REPORT', `WASM kompiliert! Performance ist um ${((telemetry.jsEquivalentMs / telemetry.totalTimeMs) * 10).toFixed(0)}x schneller als reines Javascript.`, { amount: 25 });
    }, 1500);
  };

  const handleExportVoxelJson = () => {
    try {
      const jsonStructure = JSON.stringify({
        metadata: {
          generator: "RustWasmVoxelGen v2.1",
          biome,
          chunkSize,
          totalVoxels: generateVoxelData.length,
          compiledAt: new Date().toISOString()
        },
        payload: generateVoxelData.slice(0, 100).map(v => ({ x: v.x, y: v.y, z: v.z, t: v.type }))
      }, null, 2);
      
      navigator.clipboard.writeText(jsonStructure);
      triggerToast('quest', 'EXPORTIEREN 📋', 'Voxel Obj-Daten (JSON) wurden in die Zwischenablage kopiert!');
    } catch (err) {
      console.error(err);
    }
  };


  // ==========================================
  // DART / FLUTTER DEVICE SIMULATOR STATE
  // ==========================================
  const [flutterTheme, setFlutterTheme] = useState<'cyan' | 'purple' | 'gold'>('cyan');
  const [mobileActiveTab, setMobileActiveTab] = useState<'dashboard' | 'chat' | 'inspector' | 'systems'>('dashboard');
  const [mobileMessageInput, setMobileMessageInput] = useState('');
  const [hotReloadAnim, setHotReloadAnim] = useState(false);
  const [selectedWidget, setSelectedWidget] = useState<string | null>('MaterialApp');
  const [simulatedNotifications, setSimulatedNotifications] = useState<{ id: string; text: string; sender: string }[]>([]);
  const [dartGcStats, setDartGcStats] = useState({
    activeGcrot: 12,
    memoryHeap: 24.5,
    gcDuration: 1.2
  });

  const handleMobileSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobileMessageInput.trim() || !user) return;

    const msgToSend = mobileMessageInput.trim();
    setMobileMessageInput('');

    try {
      const tempId = 'temp-flutter-' + Date.now() + '-' + Math.random().toString(36).substring(7);
      await addDoc(collection(db, 'chat_messages'), {
        text: `📱 [Flutter Client] ${msgToSend}`,
        userId: user.uid,
        displayName: (myProfile?.displayName || user.displayName || 'Flutter-User').substring(0, 64),
        role: (myProfile?.role || 'Member').substring(0, 64),
        purchasedRank: myProfile?.purchasedRank || "",
        createdAt: serverTimestamp(),
        tempId: tempId,
        channel: 'allgemein'
      });
      triggerMobileNotification("Sync", "Nachricht im Firebase Chat synchronisiert! 📡 ✅");
    } catch (err) {
      console.error(err);
    }
  };

  const triggerHotReload = () => {
    setHotReloadAnim(true);
    setTimeout(() => {
      setHotReloadAnim(false);
      setDartGcStats(prev => ({
        ...prev,
        gcDuration: 0.8,
        memoryHeap: parseFloat((prev.memoryHeap - 1.2).toFixed(1))
      }));
      triggerToast('quest', '🎯 FLUTTER HOT RELOAD', 'Live Hot Reload erfolgreich durchgeführt! Widgets in 32ms synchronisiert.', { amount: 15 });
    }, 800);
  };

  const triggerMobileNotification = (sender: string, text: string) => {
    const id = `notif-${Date.now()}`;
    setSimulatedNotifications(prev => [...prev, { id, text, sender }]);
    setTimeout(() => {
      setSimulatedNotifications(prev => prev.filter(n => n.id !== id));
    }, 4500);
  };

  const prevMessagesLength = useRef(chatMessages.length);
  useEffect(() => {
    if (chatMessages.length > prevMessagesLength.current) {
      const newestMsg = chatMessages[chatMessages.length - 1];
      if (newestMsg && newestMsg.userId !== user?.uid) {
        triggerMobileNotification(
          newestMsg.displayName || "Online Spieler",
          newestMsg.text.replace(/§[4-9a-fklmnor]/g, '')
        );
      }
    }
    prevMessagesLength.current = chatMessages.length;
  }, [chatMessages, user]);


  // ==========================================
  // PYTHON AI Reinforcement Learning AUTOPILOT
  // ==========================================
  const aiChartCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [learningRate, setLearningRate] = useState<number>(0.1); // alpha
  const [exploreRate, setExploreRate] = useState<number>(0.2); // epsilon
  const [hiddenLayers, setHiddenLayers] = useState<string>('32x32x16');
  const [isAiTraining, setIsAiTraining] = useState<boolean>(false);
  const [epoch, setEpoch] = useState<number>(1420);
  const [rewardsList, setRewardsList] = useState<number[]>([15, 24, 18, 35, 42, 59, 68, 72, 85, 91, 110, 115]);
  const [aiLogs, setAiLogs] = useState<string[]>([
    "🐍 AI Engine initialized using TensorFlow-Python bindings.",
    "🤖 Autopi-Agent: loaded Minecraft Navigation Policy file.",
    "🛡️ Target focus: Diamond Coordinates x=124, y=11, z=369",
    "🎯 Policy status: Exploring blocks with neural layers [32x32x16]."
  ]);

  // Handle simulated training iterations
  useEffect(() => {
    if (!isAiTraining) return;

    const interval = setInterval(() => {
      setEpoch(e => e + 1);
      
      // Calculate reward climbing towards Peak
      const noise = Math.floor(Math.sin(epoch) * 12) + Math.floor(Math.random() * 8);
      const currentStableBase = 120 + Math.min(180, (epoch - 1420) * 0.8);
      const nextReward = Math.max(20, Math.floor(currentStableBase + noise));

      setRewardsList(r => {
        const next = [...r, nextReward];
        if (next.length > 25) next.shift();
        return next;
      });

      // Randomized dynamic RL logs
      const actions = [
        "Lava block detected: Executed Jump-Fly Action. (Reward: +15 XP)",
        "Water current block: Autopilot swims safely. (Reward: +5 XP)",
        "Iron chunk encountered: Mining & saving to cache. (Reward: +35 XP)",
        "Diamond ore discovered! Extracted successfully (Reward: +200 XP) 💎",
        "Zombie entity spotted: Bot runs combat state. (No damage taken)",
        "Coal chunk discovered: Mining & fuel synthesis. (Reward: +10 XP)",
        "Stuck state: Epsilon random-jump activated. (Reward: -2 XP)"
      ];
      const selectedAction = actions[Math.floor(Math.random() * actions.length)];
      setAiLogs(prev => [
        `📊 [EPOCH ${epoch}] LearnRate=${learningRate} / Explorer=${exploreRate}:`,
        `🤖 Bot Action: ${selectedAction}`,
        ...prev.slice(0, 6)
      ]);

      if (epoch % 15 === 0) {
        triggerToast('xp', '🤖 AI TRAINING STATUS', `Epoche ${epoch} abgeschlossen! Belohnungsdurchschnitt steigt.`, { amount: 10 });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isAiTraining, epoch, learningRate, exploreRate]);

  // Paint AI reinforcement learning loss/reward chart
  useEffect(() => {
    const canvas = aiChartCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background grid lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let x = 30; x < canvas.width; x += 35) {
      ctx.beginPath();
      ctx.moveTo(x, 10);
      ctx.lineTo(x, canvas.height - 20);
      ctx.stroke();
    }
    for (let y = 15; y < canvas.height - 20; y += 25) {
      ctx.beginPath();
      ctx.moveTo(30, y);
      ctx.lineTo(canvas.width - 10, y);
      ctx.stroke();
    }

    // Draw Reward Curve
    if (rewardsList.length > 1) {
      ctx.beginPath();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#eab308'; // Amber reward line

      const paddingX = 30;
      const graphWidth = canvas.width - 40;
      const graphHeight = canvas.height - 40;
      const stepX = graphWidth / (rewardsList.length - 1);
      
      const maxVal = Math.max(...rewardsList, 150);
      const minVal = 10;

      rewardsList.forEach((val, index) => {
        const xPos = paddingX + index * stepX;
        const normalizedY = (val - minVal) / (maxVal - minVal);
        const yPos = canvas.height - 25 - normalizedY * graphHeight;
        
        if (index === 0) {
          ctx.moveTo(xPos, yPos);
        } else {
          ctx.lineTo(xPos, yPos);
        }
      });
      ctx.stroke();

      // Shadow glow fill below line
      ctx.lineTo(paddingX + graphWidth, canvas.height - 25);
      ctx.lineTo(paddingX, canvas.height - 25);
      ctx.fillStyle = 'rgba(234, 179, 8, 0.08)';
      ctx.fill();

      // Draw active point
      const lastIdx = rewardsList.length - 1;
      const lastX = paddingX + lastIdx * stepX;
      const lastY = canvas.height - 25 - ((rewardsList[lastIdx] - minVal) / (maxVal - minVal)) * graphHeight;
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(lastX, lastY, 5, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Axes lines
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(30, 10);
    ctx.lineTo(30, canvas.height - 24);
    ctx.lineTo(canvas.width - 10, canvas.height - 24);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = '#64748b';
    ctx.font = '9px monospace';
    ctx.fillText("MAX_XP", 5, 20);
    ctx.fillText("TIME ->", canvas.width - 55, canvas.height - 10);
  }, [rewardsList]);


  // ==========================================
  // GOLANG CLUSTER SERVER NETWORK STATE & LOGIC
  // ==========================================
  const [loadBalancing, setLoadBalancing] = useState<'round-robin' | 'least-conn' | 'ip-hash'>('round-robin');
  const [goroutinesCount, setGoroutinesCount] = useState<number>(42);
  const [ddosIntensity, setDdosIntensity] = useState<number>(0); // 0 offset, higher is ddos surge
  const [isDdosActive, setIsDdosActive] = useState<boolean>(false);
  const [serverStats, setServerStats] = useState({
    authCpu: 12,
    worldCpu: 18,
    dbLatency: 4.8,
    throughput: 1240, 
    blockedips: 0
  });

  // golang ticks simulator
  useEffect(() => {
    const timer = setInterval(() => {
      let isPeakDdos = isDdosActive;
      
      setServerStats(prev => {
        let authCpuNext = isPeakDdos ? Math.floor(75 + Math.random() * 20) : Math.floor(10 + Math.random() * 8);
        let worldCpuNext = isPeakDdos ? Math.floor(82 + Math.random() * 14) : Math.floor(15 + Math.random() * 10);
        let currentLatency = isPeakDdos ? parseFloat((24.5 + Math.random() * 32).toFixed(1)) : parseFloat((4.2 + Math.random() * 2).toFixed(1));
        let requests = isPeakDdos ? Math.floor(48000 + Math.random() * 5000) : Math.floor(1150 + Math.random() * 200);
        
        let blockedCount = prev.blockedips;
        if (isPeakDdos) {
          blockedCount += Math.floor(Math.random() * 8);
        } else {
          blockedCount = Math.max(0, blockedCount - 2);
        }

        return {
          authCpu: authCpuNext,
          worldCpu: worldCpuNext,
          dbLatency: currentLatency,
          throughput: requests,
          blockedips: blockedCount
        };
      });

      setGoroutinesCount(prev => {
        if (isPeakDdos) {
          return Math.min(1500, prev + Math.floor(Math.random() * 65));
        } else {
          return Math.max(42, Math.floor(prev + (Math.random() * 6 - 3)));
        }
      });
    }, 1200);

    return () => clearInterval(timer);
  }, [isDdosActive]);

  const handleDdosAttackToggle = () => {
    const activeNext = !isDdosActive;
    setIsDdosActive(activeNext);
    if (activeNext) {
      triggerToast('level', '🔥 GOLANG CLUSTER ALARM!', 'Server-Cluster wird simuliert angegriffen! DDoS Traffic steigt auf 50k req/s.', { amount: 50 });
    } else {
      triggerToast('quest', '🛡️ CLUSTER STABIL', 'DDoS Angriff vollständig abgewehrt! Alle schädlichen IP-Adressen blockiert.');
    }
  };

  const optimizeGoroutines = () => {
    setGoroutinesCount(42);
    triggerToast('quest', '🐹 GOLANG OPTIMIERUNG', 'Go-Garbage Collector & Routine ThreadPools neu konfiguriert! RAM entlastet.');
  };

  return (
    <motion.div
      key="devlabs-modal-root"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-md flex items-center justify-center p-2 md:p-6 select-none"
    >
      <div className="absolute inset-0 bg-gradient-to-tr from-cyan-950/20 via-neutral-950/40 to-purple-950/20 pointer-events-none" />

      {/* Main Container */}
      <motion.div
        initial={{ y: 30, scale: 0.95 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 30, scale: 0.95 }}
        className="w-full max-w-7xl h-[95vh] md:h-[860px] bg-[#07090e] border-2 border-cyan-500/30 rounded-[2rem] md:rounded-[2.5rem] flex flex-col shadow-[0_0_80px_rgba(34,211,238,0.15)] relative overflow-hidden"
      >
        {/* Glow Header Accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500 opacity-60" />

        {/* Modal Header */}
        <div className="p-4 md:p-8 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 bg-[#080c14]/10 backdrop-blur-md z-10">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-950/50 border border-cyan-500/40 rounded-xl text-cyan-400">
                <Cpu size={24} className="animate-pulse" />
              </div>
              <div>
                <h2 className="text-lg md:text-2xl font-black text-white tracking-widest uppercase italic flex items-center gap-2">
                  Entwickler-Zentrum
                  <span className="text-[10px] bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 font-mono font-black italic rounded px-2.5 py-0.5 tracking-normal normal-case not-italic">
                    Multi-Language Labs V2
                  </span>
                </h2>
                <p className="text-neutral-500 text-xs font-medium">Spiele mit Live-Simulationen in Rust WebAssembly, Dart Flutter, Python RL AI & Golang Backend-Clustern</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto">
            <button
              onClick={onClose}
              className="p-3 bg-neutral-900/80 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded-2xl border border-white/5 transition-all active:scale-95"
              title="Schließen"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* TAB TOGGLES */}
        <div className="px-2 md:px-8 border-b border-white/5 bg-[#080d15]/50 flex shrink-0 z-10 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('rust')}
            className={`py-4 px-4 md:px-6 text-xs font-black uppercase tracking-widest border-b-2 transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'rust'
                ? 'border-cyan-400 text-cyan-400 bg-cyan-500/5'
                : 'border-transparent text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <Terminal size={14} />
            🦀 Rust (WASM Core)
          </button>
          <button
            onClick={() => setActiveTab('flutter')}
            className={`py-4 px-4 md:px-6 text-xs font-black uppercase tracking-widest border-b-2 transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'flutter'
                ? 'border-purple-400 text-purple-400 bg-purple-500/5'
                : 'border-transparent text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <Smartphone size={14} />
            🎯 Dart & Flutter App
          </button>
          <button
            onClick={() => setActiveTab('python')}
            className={`py-4 px-4 md:px-6 text-xs font-black uppercase tracking-widest border-b-2 transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'python'
                ? 'border-yellow-400 text-yellow-400 bg-yellow-500/5'
                : 'border-transparent text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <BarChart size={14} />
            🐍 Python (AI Autopilot)
          </button>
          <button
            onClick={() => setActiveTab('go')}
            className={`py-4 px-4 md:px-6 text-xs font-black uppercase tracking-widest border-b-2 transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'go'
                ? 'border-teal-400 text-teal-400 bg-teal-500/5'
                : 'border-transparent text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <Wifi size={14} />
            🐹 Golang (Cluster API)
          </button>
        </div>

        {/* LAB WORKSPACE */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 min-h-0 bg-[#04060a]/95">
          <AnimatePresence mode="wait">
            
            {/* RUST PANEL */}
            {activeTab === 'rust' && (
              <motion.div
                key="rust-lab-workspace"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full min-h-0"
              >
                <div className="lg:col-span-7 flex flex-col gap-4 min-h-0">
                  <div className="flex-1 min-h-[300px] md:min-h-[440px] bg-black/90 border border-cyan-500/20 rounded-3xl relative overflow-hidden flex flex-col justify-center items-center shadow-[inset_0_0_40px_rgba(6,182,212,0.05)]">
                    <canvas 
                      ref={canvasRef} 
                      width={520} 
                      height={360} 
                      className="max-w-full block select-none"
                    />

                    {/* Performance HUD telemetry overlay */}
                    <div className="absolute top-4 left-4 bg-black/85 border border-cyan-500/30 rounded-2xl p-4 font-mono text-[10px] text-cyan-400 space-y-1.5 shadow-xl max-w-[240px] pointer-events-none backdrop-blur-md">
                      <div className="flex items-center gap-1.5 border-b border-cyan-500/20 pb-1.5 mb-1.5 text-xs font-black text-white italic">
                        <Activity size={12} className="animate-pulse text-cyan-500" />
                        <span>WASM ENGINE TELEMETRY</span>
                      </div>
                      <p>Env: <span className="text-white font-bold">wasm32-unknown</span></p>
                      <p>WASM Exec Time: <span className="text-green-400 font-black">{telemetry.totalTimeMs} ms</span></p>
                      <p>Alloc Memory: <span className="text-white font-bold">{telemetry.ramAllocation} KB</span></p>
                      <p>Active Shader: <span className="text-amber-300 font-bold uppercase">{shaderPreset}</span></p>
                      <p>Active Threads: <span className="text-cyan-300 font-bold">Parallel (8 Workers)</span></p>
                      <p>Speed Gain vs JS: <span className="text-green-400 font-black">+{((telemetry.jsEquivalentMs / telemetry.totalTimeMs) * 100).toFixed(0)}% 🔥</span></p>
                    </div>

                    {/* Rotation manual controls in HUD corner */}
                    <div className="absolute bottom-4 right-4 bg-black/85 border border-white/5 rounded-2xl p-3 flex flex-col gap-1.5 text-white hover:border-cyan-500/40 transition-all shadow-lg backdrop-blur-md">
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">Winkel</span>
                          <span className="text-xs font-bold font-mono text-cyan-400">{rotationAngle}°</span>
                        </div>
                        <input 
                          type="range" 
                          min="0" 
                          max="360" 
                          value={rotationAngle} 
                          onChange={(e) => setRotationAngle(parseInt(e.target.value))}
                          className="w-24 accent-cyan-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Render statistics bar */}
                  <div className="grid grid-cols-3 gap-2 md:gap-4 shrink-0">
                    <div className="bg-[#090e17] border border-white/5 rounded-2xl p-3 md:p-4 flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Calc Duration</span>
                      <span className="text-base md:text-lg font-black text-green-400 font-mono">{telemetry.calcTimePr}ms</span>
                    </div>
                    <div className="bg-[#090e17] border border-white/5 rounded-2xl p-3 md:p-4 flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Voxel Blocks</span>
                      <span className="text-base md:text-lg font-black text-white font-mono">{telemetry.blocksCount}</span>
                    </div>
                    <div className="bg-[#090e17] border border-white/5 rounded-2xl p-3 md:p-4 flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Standard JS</span>
                      <span className="text-base md:text-lg font-black text-rose-400/80 font-mono line-through">{telemetry.jsEquivalentMs}ms</span>
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN: Parameter dials */}
                <div className="lg:col-span-5 flex flex-col gap-4 md:gap-6">
                  <div className="bg-[#090e17] border border-cyan-500/20 rounded-3xl p-6 space-y-3">
                    <div className="flex items-center gap-2 text-cyan-400 text-xs font-black uppercase tracking-widest">
                      <Zap size={14} className="text-cyan-400" />
                      <span>Der Rust WASM-Vorteil</span>
                    </div>
                    <p className="text-neutral-300 text-xs leading-relaxed font-medium">
                      WebAssembly (WASM) ermöglicht es uns, hardwarenahen <span className="text-cyan-400 font-semibold">Rust-Code</span> direkt im Webbrowser mit nahezu nativer Desktop-Performance auszuführen.
                    </p>
                  </div>

                  {/* Settings Dials Card */}
                  <div className="bg-neutral-950/40 border border-white/5 p-6 rounded-3xl space-y-5">
                    <div className="flex items-center gap-2 text-white font-bold text-sm">
                      <Sliders size={16} className="text-cyan-400" />
                      <span>Generierungs-Parameter</span>
                    </div>

                    <div className="space-y-4">
                      {/* Biome Type */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">Flächen-Biom</label>
                        <div className="grid grid-cols-4 gap-2">
                          {(['plains', 'nether', 'ocean', 'desert'] as const).map(b => (
                            <button
                              key={`biome-key-${b}`}
                              onClick={() => setBiome(b)}
                              className={`py-2 px-1 text-[10px] font-black uppercase tracking-widest rounded-xl border transition-all ${
                                biome === b
                                  ? 'bg-cyan-500/15 border-cyan-500 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                                  : 'bg-transparent border-white/5 text-neutral-400 hover:text-white hover:bg-white/5'
                              }`}
                            >
                              {b === 'plains' ? 'Ebene' : b === 'nether' ? 'Nether' : b === 'ocean' ? 'Ozean' : 'Wüste'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Shader Preset Selection */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-neutral-400 uppercase tracking-wider">Shader Farbprofile (WASM-Shielder)</label>
                        <div className="grid grid-cols-3 gap-1.5">
                          {(['classic', 'cyberpunk', 'retro', 'sunset', 'toxic'] as const).map(s => (
                            <button
                              key={`shader-key-${s}`}
                              onClick={() => setShaderPreset(s)}
                              className={`py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg border transition-all ${
                                shaderPreset === s
                                  ? 'bg-amber-500/15 border-amber-500 text-amber-400'
                                  : 'bg-transparent border-white/5 text-neutral-400 hover:text-white hover:bg-white/5'
                              }`}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Chunk Dimension size */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-[10px] font-black text-neutral-400 uppercase tracking-wider">
                          <span>Chunk-Größe</span>
                          <span className="text-cyan-400 font-mono font-black">{chunkSize}³</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {([8, 12, 16] as const).map(sz => (
                            <button
                              key={`size-key-${sz}`}
                              onClick={() => setChunkSize(sz)}
                              className={`py-2 px-2 text-[10px] font-black uppercase tracking-widest rounded-xl border transition-all ${
                                chunkSize === sz
                                  ? 'bg-cyan-500/15 border-cyan-500 text-cyan-400'
                                  : 'bg-transparent border-white/5 text-neutral-400 hover:text-white'
                              }`}
                            >
                              {sz}³
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Lighting Level Controls */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[10px] font-black text-neutral-400 uppercase tracking-wider">
                          <span>Glanzbeleuchtung</span>
                          <span className="text-amber-400 font-mono font-black">{ambientLight}%</span>
                        </div>
                        <input 
                          type="range" 
                          min="30" 
                          max="200" 
                          value={ambientLight}
                          onChange={(e) => setAmbientLight(parseInt(e.target.value))}
                          className="w-full accent-amber-500 h-1.5 bg-neutral-900 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 shrink-0">
                    <button
                      onClick={handleTestCompile}
                      disabled={isGenerating}
                      className="py-4 bg-cyan-500 text-black hover:bg-cyan-400 font-black text-xs uppercase tracking-widest rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-500/10"
                    >
                      {isGenerating ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play size={14} fill="black" />
                      )}
                      WASM Build-Test
                    </button>
                    <button
                      onClick={handleExportVoxelJson}
                      className="py-4 bg-neutral-900 hover:bg-neutral-800 text-white border border-neutral-800 font-black text-xs uppercase tracking-widest rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
                    >
                      <Copy size={14} />
                      Exportieren (JSON)
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* FLUTTER TAB WORKSPACE */}
            {activeTab === 'flutter' && (
              <motion.div
                key="flutter-lab-workspace"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full min-h-0"
              >
                {/* LEFT COLUMN: Smartphone Live Simulator */}
                <div className="lg:col-span-6 flex justify-center items-center">
                  <div className="relative w-[320px] h-[580px] bg-[#020304] border-[8px] border-neutral-800 rounded-[3rem] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),0_0_40px_rgba(147,51,234,0.15)] overflow-hidden flex flex-col select-none group">
                    
                    {/* Speaker Notch */}
                    <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-28 h-5 bg-black rounded-full z-50 flex items-center justify-between px-3">
                      <span className="w-2 h-2 rounded-full bg-[#050c18] border border-neutral-700 pointer-events-none" />
                      <div className="w-8 h-1 bg-neutral-800 rounded-full" />
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-900/60" />
                    </div>

                    {/* Simulated Flutter Device Status Bar */}
                    <div className="pt-8 px-5 pb-2 bg-[#080d16] text-[10px] text-neutral-400 flex justify-between items-center z-10 font-mono">
                      <span>17:05</span>
                      <div className="flex items-center gap-1.5">
                        <Activity size={10} className="text-green-500 animate-pulse" />
                        <span>LTE</span>
                        <span>98%</span>
                        <div className="w-4 h-2 bg-neutral-800 rounded border border-neutral-600 p-0.5 flex">
                          <div className="h-full bg-green-500 w-3/4 rounded-xs" />
                        </div>
                      </div>
                    </div>

                    {/* Live Mobile Stream alerts */}
                    <div className="absolute top-12 left-3 right-3 z-50 flex flex-col gap-2 pointer-events-none">
                      <AnimatePresence>
                        {simulatedNotifications.map(n => (
                          <motion.div
                            key={n.id}
                            initial={{ opacity: 0, y: -20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                            className="bg-black/95 border-l-4 border-purple-500 rounded-xl p-3 shadow-lg pointer-events-auto flex gap-2 w-full"
                          >
                            <div className="p-1.5 bg-purple-950/50 rounded-lg text-purple-400 shrink-0 h-fit">
                              <Bell size={12} className="animate-bounce" />
                            </div>
                            <div className="min-w-0">
                              <h5 className="text-[10px] uppercase font-black text-purple-400 tracking-wider font-sans">{n.sender}</h5>
                              <p className="text-[10px] text-neutral-300 font-bold leading-relaxed truncate">{n.text}</p>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>

                    {hotReloadAnim ? (
                      <div className="flex-1 bg-black flex flex-col justify-center items-center text-center gap-4 z-10">
                        <RefreshCw className="w-8 h-8 text-purple-400 animate-spin" />
                        <div>
                          <p className="text-xs font-black uppercase text-purple-400 font-mono tracking-widest">Widget Tree Reloading...</p>
                          <p className="text-[10px] text-neutral-500 font-mono">Preserving Dart Application State</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col justify-between bg-[#080d16] z-10 overflow-hidden text-neutral-200">
                        
                        {/* Flutter mini App Bar */}
                        <div className="py-2.5 px-4 border-b border-white/5 flex items-center justify-between shrink-0 bg-[#09111c]">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                            <h4 className="text-[10px] font-black uppercase tracking-wider text-white">VoxelCompanion</h4>
                          </div>
                          <span className="text-[8px] bg-purple-500/10 border border-purple-500/30 text-purple-400 rounded px-1.5 font-mono">DART</span>
                        </div>

                        {/* Flutter Tab Panel Content */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                          {mobileActiveTab === 'dashboard' && (
                            <motion.div 
                              initial={{ opacity: 0 }} 
                              animate={{ opacity: 1 }} 
                              className="space-y-3"
                            >
                              <div className={`bg-gradient-to-br border rounded-2xl p-4 text-center relative overflow-hidden transition-all ${
                                selectedWidget === 'HeaderCard' ? 'ring-2 ring-purple-400/80 bg-purple-950/40 border-purple-400' : 'from-purple-950/20 to-[#0c1825] border-purple-500/10'
                              }`}
                                onClick={() => setSelectedWidget('HeaderCard')}
                              >
                                <h5 className="font-bold text-xs text-purple-300">Hallo, {myProfile?.displayName || user?.displayName || 'Spieler'}! 📱</h5>
                                <p className="text-[9px] text-neutral-400 mt-1">Drahtlose Server-Verbindung aktiv.</p>
                                
                                <div className="mt-3 py-1 px-2.5 bg-black/40 rounded-xl inline-flex items-center gap-2 border border-white/5">
                                  <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">Coins:</span>
                                  <span className="text-xs font-black text-[#eab308]">{myProfile?.coins || 0}</span>
                                </div>
                              </div>

                              <div className={`p-3 bg-[#09111c]/60 border rounded-2xl space-y-2 transition-all cursor-pointer ${
                                selectedWidget === 'CommandsList' ? 'ring-2 ring-purple-400/80 bg-purple-950/40 border-purple-400' : 'border-white/5'
                              }`}
                                onClick={() => setSelectedWidget('CommandsList')}
                              >
                                <h6 className="text-[9px] uppercase font-black tracking-wider text-purple-400">Push-Alarme auslösen</h6>
                                
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); triggerMobileNotification("Autopilot AI", "🤖 Autopilot hat 50 Blöcke Diamanterz gefunden!"); }}
                                  className="w-full text-left p-1.5 hover:bg-white/5 rounded-lg border border-white/5 text-[9px] flex justify-between"
                                >
                                  <span>Autopilot Alarm</span>
                                  <span>→</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); triggerMobileNotification("Cluster Security", "🔐 IP x.x.x.x wurde erfolgreich Rate-Limited!"); }}
                                  className="w-full text-left p-1.5 hover:bg-white/5 rounded-lg border border-white/5 text-[9px] flex justify-between"
                                >
                                  <span>Netzwerk Filter Info</span>
                                  <span>→</span>
                                </button>
                              </div>
                            </motion.div>
                          )}

                          {mobileActiveTab === 'chat' && (
                            <motion.div 
                              initial={{ opacity: 0 }} 
                              animate={{ opacity: 1 }} 
                              className="h-full flex flex-col justify-between"
                            >
                              <div className="flex-1 overflow-y-auto space-y-2 max-h-[220px]">
                                {chatMessages.slice(-5).map((msg, idx) => (
                                  <div key={`m-msg-${idx}`} className={`p-2 rounded-xl text-[10px] flex flex-col max-w-[85%] ${
                                    msg.userId === user?.uid 
                                      ? 'bg-purple-900/35 border border-purple-500/10 ml-auto' 
                                      : 'bg-black/40 border border-white/5 mr-auto'
                                  }`}>
                                    <span className="font-extrabold text-[#7496e5] text-[9px] mb-0.5 truncate">{msg.displayName}</span>
                                    <span className="leading-relaxed font-semibold text-white break-words">{msg.text.replace(/§[4-9a-fklmnor]/g, '')}</span>
                                  </div>
                                ))}
                              </div>

                              <form onSubmit={handleMobileSend} className="flex gap-1 mt-2 border-t border-white/5 pt-2">
                                <input
                                  type="text"
                                  placeholder="Chat im Mobile-Client..."
                                  value={mobileMessageInput}
                                  onChange={(e) => setMobileMessageInput(e.target.value)}
                                  className="flex-grow bg-black rounded-xl px-2.5 py-1.5 text-[9px] border border-white/5 outline-none text-white focus:border-purple-500"
                                />
                                <button type="submit" className="p-1 px-2.5 bg-purple-500 rounded-xl text-black text-[9px] font-bold">
                                  Senden
                                </button>
                              </form>
                            </motion.div>
                          )}

                          {mobileActiveTab === 'inspector' && (
                            <div className="space-y-2.5 font-mono text-[9px]">
                              <p className="text-purple-400 font-bold border-b border-purple-500/20 pb-1">WIDGET TREE INSPECTOR</p>
                              <div className="space-y-1">
                                <div 
                                  onClick={() => setSelectedWidget('MaterialApp')}
                                  className={`cursor-pointer pl-1 py-1 rounded ${selectedWidget === 'MaterialApp' ? 'bg-purple-500/20 text-white font-extrabold' : 'text-neutral-400'}`}
                                >
                                  ▼ MaterialApp
                                </div>
                                <div 
                                  onClick={() => setSelectedWidget('Scaffold')}
                                  className={`cursor-pointer pl-4 py-1 rounded ${selectedWidget === 'Scaffold' ? 'bg-purple-500/20 text-white font-extrabold' : 'text-neutral-400'}`}
                                >
                                  ▼ Scaffold
                                </div>
                                <div 
                                  onClick={() => setSelectedWidget('HeaderCard')}
                                  className={`cursor-pointer pl-8 py-1 rounded ${selectedWidget === 'HeaderCard' ? 'bg-purple-500/20 text-white font-extrabold' : 'text-neutral-400'}`}
                                >
                                  └─ HeaderCard [StatefulWidget]
                                </div>
                                <div 
                                  onClick={() => setSelectedWidget('CommandsList')}
                                  className={`cursor-pointer pl-8 py-1 rounded ${selectedWidget === 'CommandsList' ? 'bg-purple-500/20 text-white font-extrabold' : 'text-neutral-400'}`}
                                >
                                  └─ CommandsList [StatelessWidget]
                                </div>
                              </div>
                            </div>
                          )}

                          {mobileActiveTab === 'systems' && (
                            <div className="bg-[#09111c]/60 border border-white/5 rounded-2xl p-3 space-y-2">
                              <h6 className="text-[10px] font-black text-purple-400 uppercase tracking-widest font-sans">Garbage Collector Stats</h6>
                              <div className="space-y-2 font-mono text-[9px] leading-relaxed">
                                <div className="flex justify-between">
                                  <span>Active Coroutines:</span>
                                  <span className="text-white">{dartGcStats.activeGcrot}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Dart Heap Memory:</span>
                                  <span className="text-white">{dartGcStats.memoryHeap} MB</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>GC Pause Duration:</span>
                                  <span className="text-green-400">{dartGcStats.gcDuration} ms</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Phone Gesture Pill (Simulates iOS/Android Home) */}
                        <div className="mt-auto shrink-0 flex flex-col bg-[#09111c]">
                          {/* Bottom Tabs Bar */}
                          <div className="flex border-t border-white/5 py-1 text-center shrink-0">
                            <button
                              onClick={() => setMobileActiveTab('dashboard')}
                              className={`flex-1 py-1.5 flex flex-col items-center justify-center gap-0.5 text-[8px] font-black uppercase tracking-wider ${
                                mobileActiveTab === 'dashboard' ? 'text-purple-400' : 'text-neutral-500'
                              }`}
                            >
                              <Grid size={12} />
                              Dash
                            </button>
                            <button
                              onClick={() => setMobileActiveTab('chat')}
                              className={`flex-1 py-1.5 flex flex-col items-center justify-center gap-0.5 text-[8px] font-black uppercase tracking-wider ${
                                mobileActiveTab === 'chat' ? 'text-purple-400' : 'text-neutral-500'
                              }`}
                            >
                              <MessageSquare size={12} />
                              Chat Sync
                            </button>
                            <button
                              onClick={() => setMobileActiveTab('inspector')}
                              className={`flex-1 py-1.5 flex flex-col items-center justify-center gap-0.5 text-[8px] font-black uppercase tracking-wider ${
                                mobileActiveTab === 'inspector' ? 'text-purple-400' : 'text-neutral-500'
                              }`}
                            >
                              <Layout size={12} />
                              Inspect
                            </button>
                            <button
                              onClick={() => setMobileActiveTab('systems')}
                              className={`flex-1 py-1.5 flex flex-col items-center justify-center gap-0.5 text-[8px] font-black uppercase tracking-wider ${
                                mobileActiveTab === 'systems' ? 'text-purple-400' : 'text-neutral-500'
                              }`}
                            >
                              <Activity size={12} />
                              GC Monitor
                            </button>
                          </div>
                          
                          <div className="h-6 flex items-center justify-center">
                            <div className="w-24 h-1 bg-neutral-600 rounded-full" />
                          </div>
                        </div>

                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT COLUMN: Interactive Control center */}
                <div className="lg:col-span-6 flex flex-col gap-6">
                  <div className="bg-[#120917] border border-purple-500/20 rounded-3xl p-6 space-y-4">
                    <div className="flex items-center gap-2 text-purple-400 text-xs font-black uppercase tracking-widest">
                      <Smartphone size={14} className="text-purple-500" />
                      <span>Dart & Flutter Cross-Platform Engine</span>
                    </div>
                    <p className="text-[#d8b4fe] text-xs leading-relaxed font-semibold">
                      Live Hot Reload im Simulator aktiv! Klicke die Widgets auf dem Smartphone an, um sie im Widget-Tree hervorzuheben.
                    </p>
                  </div>

                  <div className="bg-neutral-950/40 border border-white/5 p-6 rounded-3xl space-y-5">
                    <div className="flex items-center justify-between text-white font-bold text-sm">
                      <span className="flex items-center gap-2">
                        <Settings size={16} className="text-purple-400" />
                        <span>Flutter Widget & GC Controller</span>
                      </span>
                    </div>

                    <div className="space-y-4">
                      {/* Active widget metadata inspector */}
                      <div className="p-4 bg-black/60 rounded-2xl border border-white/5 space-y-2">
                        <p className="text-[10px] font-extrabold uppercase text-neutral-400 tracking-widest font-mono">Ausgewähltes Widget: {selectedWidget}</p>
                        {selectedWidget === 'HeaderCard' && (
                          <div className="font-mono text-[9px] text-[#c084fc] space-y-1">
                            <p>Class: StatefulWidget (VoxelCompanionHeader)</p>
                            <p>Padding: EdgeInsets.all(16.0)</p>
                            <p>Decoration: BoxDecoration(gradient: LinearGradient)</p>
                          </div>
                        )}
                        {selectedWidget === 'CommandsList' && (
                          <div className="font-mono text-[9px] text-[#c084fc] space-y-1">
                            <p>Class: StatelessWidget (QuickAlertsPanel)</p>
                            <p>Children: 2 [OutlineButton, TextHeading]</p>
                          </div>
                        )}
                        {selectedWidget === 'MaterialApp' && (
                          <div className="font-mono text-[9px] text-[#c084fc] space-y-1">
                            <p>Class: RootWidget (VoxelCompanionApp)</p>
                            <p>ThemeMode: ThemeMode.dark (Material 3)</p>
                          </div>
                        )}
                        {selectedWidget === 'Scaffold' && (
                          <div className="font-mono text-[9px] text-[#c084fc] space-y-1">
                            <p>Class: Scaffold (BaseAppLayout)</p>
                            <p>AppBar: PreferredSizeWidget</p>
                            <p>BottomNavigationBar: MaterialBottomNavigationBar</p>
                          </div>
                        )}
                      </div>

                      {/* Theme Colors selection */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Material 3 Color Seed</label>
                        <div className="flex gap-2">
                          {(['cyan', 'purple', 'gold'] as const).map(color => (
                            <button
                              key={`theme-btn-${color}`}
                              onClick={() => {
                                setFlutterTheme(color);
                                triggerToast('quest', '🎨 APP FARBSCHEMA', `Dart ThemeColor auf ${color.toUpperCase()} umgestellt!`);
                              }}
                              className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl border transition-all ${
                                flutterTheme === color
                                  ? 'bg-purple-500/15 border-purple-500 text-purple-400'
                                  : 'bg-transparent border-white/5 text-neutral-400 hover:text-white hover:bg-white/5'
                              }`}
                            >
                              {color}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={triggerHotReload}
                        disabled={hotReloadAnim}
                        className="w-full py-4 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                      >
                        <Zap size={14} className={hotReloadAnim ? 'animate-bounce' : 'animate-pulse'} />
                        WIDGET HOT-RELOAD (⚡)
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* PYTHON RL AUTOPILOT TRAINING LAB */}
            {activeTab === 'python' && (
              <motion.div
                key="python-lab-workspace"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full min-h-0"
              >
                {/* Visual live training graph canvas */}
                <div className="lg:col-span-7 flex flex-col gap-4">
                  <div className="flex-grow min-h-[300px] bg-black/90 border border-yellow-500/20 rounded-3xl p-6 relative flex flex-col">
                    <div className="flex items-center justify-between border-b border-white/5 pb-3 shrink-0">
                      <div className="flex items-center gap-2">
                        <Activity className="text-yellow-500 animate-pulse" size={16} />
                        <span className="text-xs font-mono font-bold text-[#f59e0b]">LIVE RL REWARD FUNCTION CURVE</span>
                      </div>
                      <span className="text-[10px] bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 rounded px-2 py-0.5 font-mono">
                        Epoche: {epoch}
                      </span>
                    </div>

                    <div className="flex-1 min-h-[220px] flex items-center justify-center">
                      <canvas 
                        ref={aiChartCanvasRef} 
                        width={540} 
                        height={240} 
                        className="max-w-full block select-none"
                      />
                    </div>
                  </div>

                  <div className="bg-[#0b0c10] border border-neutral-800 rounded-2xl p-4">
                    <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block mb-1.5">Autopilot Autoregression Terminal</span>
                    <div className="font-mono text-[10px] text-yellow-400 space-y-1.5 leading-relaxed overflow-y-auto max-h-[110px]">
                      {aiLogs.map((logStr, idx) => (
                        <div key={`log-${idx}`} className={`truncate ${idx === 0 ? 'text-white font-extrabold' : 'opacity-82'}`}>
                          {logStr}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Model controller */}
                <div className="lg:col-span-5 flex flex-col gap-6">
                  <div className="bg-[#1c1810] border border-yellow-500/20 rounded-3xl p-6 space-y-3">
                    <div className="flex items-center gap-2 text-yellow-400 text-xs font-black uppercase tracking-widest">
                      <BrainIcon size={14} className="text-yellow-500" />
                      <span>Python Reinforcement Learning Trainer</span>
                    </div>
                    <p className="text-neutral-300 text-xs leading-relaxed font-semibold">
                      Bringe einem KI-Agenten bei, sich autonom durch Minecraft-Gänge zu navigieren, Hindernisse wie Lava zu umfliegen und wertvolle Diamanten abzubauen.
                    </p>
                  </div>

                  <div className="bg-[#0a0c10] border border-white/5 p-6 rounded-3xl space-y-5">
                    <div className="flex items-center justify-between text-white font-bold text-sm border-b border-white/5 pb-2">
                      <span className="flex items-center gap-2">
                        <Sliders size={16} className="text-yellow-400" />
                        <span>Hyper-Parameter Deck</span>
                      </span>
                    </div>

                    <div className="space-y-4">
                      {/* Learning rate multiplier */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                          <span>Lernrate (Alpha)</span>
                          <span className="text-yellow-400 font-mono">{learningRate}</span>
                        </div>
                        <input 
                          type="range" 
                          min="0.01" 
                          max="0.5" 
                          step="0.01"
                          value={learningRate} 
                          onChange={(e) => setLearningRate(parseFloat(e.target.value))}
                          className="w-full accent-yellow-400 h-1.5 bg-neutral-900 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>

                      {/* Exploration rate */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-[10px] font-black text-neutral-400 uppercase tracking-widest">
                          <span>Explorations-Dynamik (Epsilon)</span>
                          <span className="text-yellow-400 font-mono">{exploreRate}</span>
                        </div>
                        <input 
                          type="range" 
                          min="0.05" 
                          max="0.8" 
                          step="0.05"
                          value={exploreRate} 
                          onChange={(e) => setExploreRate(parseFloat(e.target.value))}
                          className="w-full accent-yellow-400 h-1.5 bg-neutral-900 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>

                      {/* Hidden layer structure dropdown */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block">Neuronales Netz Schichten</span>
                        <select 
                          value={hiddenLayers}
                          onChange={(e) => {
                            setHiddenLayers(e.target.value);
                            triggerToast('quest', '🤖 KI ARCHITEKTUR', `Neuronales Netz auf Schichten [${e.target.value}] kompiliert!`);
                          }}
                          className="w-full bg-[#111] hover:bg-[#1f1f1f] text-neutral-200 border border-neutral-800 text-xs font-mono py-2.5 px-3 rounded-xl focus:border-yellow-500 outline-none"
                        >
                          <option value="32x32x16">Standard MLP [32x32x16 Neuronen]</option>
                          <option value="64x128x32">Deep Q-Network [64x128x32]</option>
                          <option value="128x256x128">ResNet Block Core [128x256x128]</option>
                        </select>
                      </div>

                      <button
                        onClick={() => setIsAiTraining(p => !p)}
                        className={`w-full py-4 rounded-2xl text-black font-black text-xs uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg ${
                          isAiTraining ? 'bg-rose-500 hover:bg-rose-400' : 'bg-yellow-400 hover:bg-yellow-300'
                        }`}
                      >
                        {isAiTraining ? (
                          <>
                            <Pause size={14} fill="currentColor" />
                            AI Training anhalten
                          </>
                        ) : (
                          <>
                            <PlayCircle size={14} fill="currentColor" />
                            AI Training starten (RNN)
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* GOLANG CLUSTER SERVER ENVIRONMENT */}
            {activeTab === 'go' && (
              <motion.div
                key="golang-lab-workspace"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full min-h-0"
              >
                {/* Visual Node Cluster topology topology */}
                <div className="lg:col-span-7 flex flex-col gap-4">
                  <div className="flex-grow min-h-[320px] bg-black/90 border border-teal-500/20 rounded-3xl p-6 relative flex flex-col justify-between">
                    
                    <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse" />
                        <span className="text-xs font-mono font-bold text-teal-400">GOLANG gRPC SERVER CLUSTER MONITOR</span>
                      </div>
                      <span className="text-[10px] bg-teal-500/20 border border-teal-500/30 text-teal-400 rounded px-2.5 py-0.5 font-mono">
                        Active GoRoutines: {goroutinesCount}
                      </span>
                    </div>

                    {/* Nodes status rows */}
                    <div className="py-6 space-y-4">
                      
                      {/* Node 1 */}
                      <div className="bg-neutral-900/60 rounded-2xl border border-white/5 p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2.5 rounded-xl border ${isDdosActive ? 'bg-rose-950/20 border-rose-500 text-rose-500 animate-bounce' : 'bg-teal-950/25 border-teal-500/30 text-teal-400'}`}>
                            <Shield size={18} />
                          </div>
                          <div>
                            <p className="text-xs font-black text-white">Reverse Proxy (Caddy-Go API Gateway)</p>
                            <p className="text-[10px] text-neutral-400">Routet HTTP & WebSocket Verbindungen</p>
                          </div>
                        </div>
                        <div className="flex gap-4 items-center">
                          <div className="text-right">
                            <span className="text-[8px] font-bold text-neutral-500 block uppercase">THROUGHPUT</span>
                            <span className="text-xs font-black font-mono text-teal-400">{serverStats.throughput} req/s</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[8px] font-bold text-neutral-500 block uppercase">STATUS</span>
                            <span className={`text-[9px] font-black uppercase rounded py-0.5 px-2 ${isDdosActive ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                              {isDdosActive ? 'DDoS Load' : 'Stabil'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Node 2 */}
                      <div className="bg-neutral-900/60 rounded-2xl border border-white/5 p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-neutral-950 border border-teal-500/20 rounded-xl text-teal-400">
                            <Cpu size={18} />
                          </div>
                          <div>
                            <p className="text-xs font-black text-white">Realm Core Engine (Goroutine Ticks)</p>
                            <p className="text-[10px] text-neutral-400">Berechnet Voxel-Zustände und Physik</p>
                          </div>
                        </div>
                        <div className="flex gap-4 items-center">
                          <div className="text-right">
                            <span className="text-[8px] font-bold text-neutral-500 block uppercase">RELOAD CPU Usage</span>
                            <span className="text-xs font-black font-mono text-teal-400">{serverStats.worldCpu}%</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[8px] font-bold text-neutral-500 block uppercase">LATENCY</span>
                            <span className="text-xs font-black font-mono text-white">{serverStats.dbLatency} ms</span>
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Footer live cluster status indicators */}
                    <div className="border-t border-neutral-900 pt-3 flex flex-wrap justify-between text-neutral-400 font-mono text-[9px] gap-2">
                      <span>Gateway Protocol: <span className="text-white">gRPC H2C</span></span>
                      <span>RateLimit Cap: <span className="text-white">600 req/IP</span></span>
                      <span>DDoS Filter: <span className={isDdosActive ? 'text-rose-500 font-black animate-pulse' : 'text-emerald-400 font-bold'}>{isDdosActive ? `AKTIV - ${serverStats.blockedips} IPS GESPERRT` : 'BEREIT'}</span></span>
                    </div>

                  </div>

                  {/* Operational indicators bar */}
                  <div className="grid grid-cols-2 gap-4 shrink-0">
                    <div className="bg-[#090e17] border border-white/5 rounded-2xl p-4 flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Auth Server CPU</span>
                      <span className="text-lg font-black text-white font-mono">{serverStats.authCpu}%</span>
                    </div>
                    <div className="bg-[#090e17] border border-white/5 rounded-2xl p-4 flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Geblockte IP Targets</span>
                      <span className="text-lg font-black text-rose-400/80 font-mono">{serverStats.blockedips} Blocked IPs</span>
                    </div>
                  </div>
                </div>

                {/* Golang information desk */}
                <div className="lg:col-span-5 flex flex-col gap-6">
                  <div className="bg-[#0a181a] border border-teal-500/20 rounded-3xl p-6 space-y-3">
                    <div className="flex items-center gap-2 text-teal-400 text-xs font-black uppercase tracking-widest">
                      <Shield size={14} className="text-teal-400" />
                      <span>Golang API Gateway Cluster</span>
                    </div>
                    <p className="text-neutral-300 text-xs leading-relaxed font-semibold">
                      Go (Golang) bietet phänomenale Web-Performance dank leichtgewichtiger <span className="text-teal-400 font-semibold">Go-Routines</span> (parallele Threads, die nur wenige Kilobyte RAM benötigen).
                    </p>
                  </div>

                  <div className="bg-neutral-950/40 border border-white/5 p-6 rounded-3xl space-y-5">
                    <div className="flex items-center justify-between text-white font-bold text-sm border-b border-neutral-900 pb-2">
                      <span className="flex items-center gap-2">
                        <Sliders size={16} className="text-teal-400" />
                        <span>Cluster Controller</span>
                      </span>
                    </div>

                    <div className="space-y-4">
                      {/* Load balancing switch options */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Load-Balancing Algorithmus</label>
                        <div className="grid grid-cols-3 gap-1.5">
                          {(['round-robin', 'least-conn', 'ip-hash'] as const).map(lb => (
                            <button
                              key={`lb-btn-${lb}`}
                              onClick={() => {
                                setLoadBalancing(lb);
                                triggerToast('quest', '🐹 GOLANG PROXY', `API-Gateway load-balancer auf ${lb.toUpperCase()} umgestellt!`);
                              }}
                              className={`py-2 text-[9px] font-black uppercase tracking-widest rounded-xl border transition-all ${
                                loadBalancing === lb
                                  ? 'bg-teal-500/15 border-teal-500 text-teal-400 shadow-[0_0_12px_rgba(20,184,166,0.15)]'
                                  : 'bg-transparent border-white/5 text-neutral-400 hover:text-white'
                              }`}
                            >
                              {lb === 'round-robin' ? 'R-Robin' : lb === 'least-conn' ? 'Least-C' : 'IP-Hash'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* DDoS Attack switch launcher */}
                      <div className="space-y-2.5">
                        <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block">Infrastruktur Stresstests</span>
                        
                        <button
                          onClick={handleDdosAttackToggle}
                          className={`w-full py-4 rounded-2xl text-white font-black text-xs uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2 border shadow-md ${
                            isDdosActive 
                              ? 'bg-rose-600 hover:bg-rose-500 border-rose-500 animate-pulse' 
                              : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-800 text-rose-400'
                          }`}
                        >
                          <AlertTriangle size={14} className={isDdosActive ? 'animate-bounce' : ''} />
                          {isDdosActive ? 'Stoppe DDoS Angriff' : 'Starte simulierten DDoS (50k req/s)'}
                        </button>

                        <button
                          onClick={optimizeGoroutines}
                          className="w-full py-3.5 rounded-2xl bg-teal-500 text-black hover:bg-teal-400 font-extrabold text-xs uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                          Optimize Goroutines ThreadPool
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Help helper icon for brain
const BrainIcon: React.FC<{ className?: string, size?: number }> = ({ className, size = 16 }) => {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1 0-3.12 3 3 0 0 1 0-4.88 2.5 2.5 0 0 1 0-3.12A2.5 2.5 0 0 1 9.5 2Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 0-3.12 3 3 0 0 0 0-4.88 2.5 2.5 0 0 0 0-3.12A2.5 2.5 0 0 0 14.5 2Z" />
    </svg>
  );
};
