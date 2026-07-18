import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Gamepad2, 
  Swords, 
  Trees, 
  Users, 
  MessageCircle, 
  Copy, 
  CheckCircle2, 
  ExternalLink,
  ChevronRight,
  Info,
  Activity,
  Zap,
  LogIn,
  LogOut,
  UserPlus,
  UserMinus,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Command,
  HelpCircle,
  Unplug,
  ChevronDown,
  Coins,
  Scroll,
  MessageSquare,
  Bot,
  User as UserIcon,
  Globe,
  MapPin,
  Cpu,
  Smartphone,
  Code,
  Circle,
  Award,
  Clock,
  Lock,
  Send,
  Box,
  Key,
  Star,
  Target,
  Settings,
  Trophy,
  BarChart2,
  Sword,
  Newspaper,
  Vote,
  Pickaxe,
  Hammer,
  Gem,
  X,
  Rocket,
  Upload,
  Plus,
  Unlock,
  ShoppingBag,
  Store,
  Edit2,
  History,
  Check,
  Package,
  RefreshCw,
  Image as ImageIcon,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Sunrise,
  Sun,
  Sunset,
  Moon,
  Music,
  Disc,
  Flame,
  Castle,
  Shield,
  RefreshCcw,
  Crown,
  Sparkles,
  Brain,
  CloudRain,
  Snowflake,
  Leaf,
  Compass,
  SunDim,
  Lightbulb,
  ChevronUp,
  Search,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { QuizArenaView } from './components/QuizArenaView';
import { DevLabsView } from './components/DevLabsView';
import { VoxelAdventureView } from './components/VoxelAdventureView';
import { ClashArenaView } from './components/ClashArenaView';
import { InfoBotPanel } from './components/InfoBotPanel';
import { getGeminiResponse, ChatMessage as GeminiChatMessage } from './services/geminiService';
import { 
  collection, 
  onSnapshot, 
  setDoc, 
  doc, 
  deleteDoc, 
  getDocs,
  getDoc,
  query,
  orderBy,
  limit,
  where,
  addDoc,
  serverTimestamp,
  writeBatch,
  increment,
  updateDoc,
  arrayUnion
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  OAuthProvider,
  signOut, 
  onAuthStateChanged,
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { db, auth, OperationType, handleFirestoreError, testFirestoreConnection, setQuotaListener } from './firebase-lib';
import ReactGA from "react-ga4";

if (import.meta.env.VITE_GA_MEASUREMENT_ID) {
  ReactGA.initialize(import.meta.env.VITE_GA_MEASUREMENT_ID);
}

const REALM_CODES = {
  PVP: 'https://discord.com/invite/2XrnqReeE',
  SURVIVAL: 'https://discord.com/invite/2XrnqReeE'
};

const compressAndResizeImage = (file: File, maxWidth = 1280, maxHeight = 720, quality = 0.75): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions preserving aspect ratio
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(event.target?.result as string); // fallback
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Export to jpeg with medium quality to stay under 100-200kb easily
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedBase64);
      };
      img.onerror = (err) => {
        reject(err);
      };
    };
    reader.onerror = (err) => {
      reject(err);
    };
  });
};

interface WeatherParticle {
  x: number;
  y: number;
  speedY: number;
  speedX: number;
  sizeW: number;
  sizeH: number;
  color: string;
  swaySeed: number;
  rot: number;
  rotSpeed: number;
  charIndex?: number;
}

interface PixelWeatherEffectProps {
  mode: string;
  resolvedTime: string;
  sharedWeathers?: any[];
}

const PixelWeatherEffect = ({ mode, resolvedTime, sharedWeathers = [] }: PixelWeatherEffectProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: WeatherParticle[] = [];

    // Find if active mode is a custom weather doc
    const customWeather = sharedWeathers.find(w => w.id === mode);

    // Determine the working weather type, colors, speed, and size
    let activeType = mode;
    let colors: string[] = [];
    let speedMult = 1.0;
    let sizeMult = 1.0;

    // Premium fields with default Fallbacks
    let particleCount = 120;
    let windDrift = 0;
    let gravityMult = 1.0;
    let particleShape = 'pixels'; // 'pixels' | 'circles' | 'emojis'
    let emojiString = '⭐';
    let isGlow = false;
    let swayAmplitude = 1.0;
    let enableLightning = false;
    let lightningFrequency = 2;
    let lightningColor = '#ffffff';
    let enableSplashes = false;
    let splashSize = 1.0;
    let trailLength = 0;
    let overlayColor = '';
    let overlayOpacity = 0;
    
    interface PixelSplash {
      x: number;
      y: number;
      maxRadius: number;
      currentRadius: number;
      opacity: number;
      color: string;
    }
    let floorSplashes: PixelSplash[] = [];
    let lightningIntensity = 0;

    if (customWeather) {
      activeType = customWeather.type;
      colors = customWeather.colors && customWeather.colors.length > 0 ? customWeather.colors : ['#ffffff'];
      
      if (customWeather.speedMultiplier === 'gentle') speedMult = 0.5;
      else if (customWeather.speedMultiplier === 'tempest') speedMult = 2.0;
      else speedMult = 1.0;
      
      if (customWeather.particleScale === 'fine') sizeMult = 0.5;
      else if (customWeather.particleScale === 'chunk') sizeMult = 1.8;
      else sizeMult = 1.0;

      // Extract custom premium configurations
      if (customWeather.particleCount !== undefined) {
        particleCount = customWeather.particleCount;
      } else {
        particleCount = activeType === 'rain' ? 120 : (activeType === 'snow' ? 65 : 45);
      }

      windDrift = customWeather.windDrift !== undefined ? customWeather.windDrift : 0;
      gravityMult = customWeather.gravityMult !== undefined ? customWeather.gravityMult : 1.0;
      particleShape = customWeather.particleShape || 'pixels';
      emojiString = customWeather.emojiString || '⭐';
      isGlow = !!customWeather.glow;
      swayAmplitude = customWeather.swayAmplitude !== undefined ? customWeather.swayAmplitude : 1.0;
      enableLightning = !!customWeather.enableLightning;
      lightningFrequency = customWeather.lightningFrequency !== undefined ? customWeather.lightningFrequency : 2;
      lightningColor = customWeather.lightningColor || '#ffffff';
      enableSplashes = !!customWeather.enableSplashes;
      splashSize = customWeather.splashSize !== undefined ? customWeather.splashSize : 1.0;
      trailLength = customWeather.trailLength !== undefined ? customWeather.trailLength : 0;
      overlayColor = customWeather.overlayColor || '';
      overlayOpacity = customWeather.overlayOpacity !== undefined ? customWeather.overlayOpacity : 0;
    } else {
      if (mode === 'cycle') {
        if (resolvedTime === 'noon') activeType = 'rain';
        else if (resolvedTime === 'night') activeType = 'snow';
        else if (resolvedTime === 'evening') activeType = 'leaves';
        else activeType = 'sunny';
      }

      if (activeType === 'rain') {
        colors = ['rgba(130, 203, 255, 0.45)', 'rgba(64, 156, 255, 0.55)', 'rgba(100, 180, 255, 0.45)'];
        particleCount = 120;
      } else if (activeType === 'snow') {
        colors = ['rgba(255, 255, 255, 0.85)', 'rgba(230, 242, 255, 0.9)', 'rgba(210, 230, 255, 0.75)'];
        particleCount = 65;
      } else if (activeType === 'leaves') {
        colors = ['#e56b46', '#ffd08a', '#b53846', '#9c6239', '#5c7a29'];
        particleCount = 45;
      }
    }

    if (activeType === 'sunny') {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Parse custom characters safely (supporting emojis / unicode surrogate pairs)
    const emojiList = Array.from(emojiString).filter(char => char.trim() !== '');

    for (let i = 0; i < particleCount; i++) {
      let p: WeatherParticle = {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        speedY: 0,
        speedX: 0,
        sizeW: 0,
        sizeH: 0,
        color: '',
        swaySeed: Math.random() * 100,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.05,
        charIndex: Math.floor(Math.random() * Math.max(1, emojiList.length))
      };

      if (activeType === 'rain') {
        p.speedY = (Math.random() * 6 + 10) * speedMult * gravityMult;
        p.speedX = ((-1.5 - Math.random() * 1.5) * (speedMult >= 1.5 ? 1.5 : speedMult)) + windDrift;
        p.sizeW = 2 * sizeMult;
        p.sizeH = (Math.random() * 7 + 7) * sizeMult;
        p.color = colors[Math.floor(Math.random() * colors.length)];
      } else if (activeType === 'snow') {
        p.speedY = (Math.random() * 1.1 + 0.7) * speedMult * gravityMult;
        p.speedX = ((Math.random() - 0.5) * 0.8 * speedMult) + windDrift;
        p.sizeW = (Math.random() > 0.5 ? 4 : 3) * sizeMult;
        p.sizeH = p.sizeW;
        p.color = colors[Math.floor(Math.random() * colors.length)];
      } else if (activeType === 'leaves') {
        p.speedY = (Math.random() * 0.7 + 0.7) * speedMult * gravityMult;
        p.speedX = ((-1.5 - Math.random() * 1.8) * speedMult) + windDrift;
        p.sizeW = (Math.random() * 3 + 4) * sizeMult;
        p.sizeH = (Math.random() * 2 + 3) * sizeMult;
        p.color = colors[Math.floor(Math.random() * colors.length)];
      }
      particles.push(p);
    }

    const updateAndDraw = (time: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const swayTime = time * 0.002;

      // Draw environment climate overlay tone FIRST (before particles are rendered)
      if (overlayOpacity > 0 && overlayColor) {
        ctx.save();
        ctx.fillStyle = overlayColor;
        ctx.globalAlpha = overlayOpacity;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      }

      // Live Lightning generator
      if (enableLightning) {
        if (Math.random() < (0.001 * lightningFrequency)) {
          lightningIntensity = 0.95;
        }
        if (lightningIntensity > 0) {
          lightningIntensity -= 0.08;
          if (lightningIntensity < 0) lightningIntensity = 0;
        }
      }

      // Render lightning flash screen cover
      if (lightningIntensity > 0) {
        ctx.save();
        ctx.fillStyle = lightningColor;
        ctx.globalAlpha = lightningIntensity;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      }

      // Render floor splash ripples
      if (enableSplashes && floorSplashes.length > 0) {
        ctx.save();
        ctx.shadowBlur = 0;
        for (let s = floorSplashes.length - 1; s >= 0; s--) {
          const splash = floorSplashes[s];
          splash.currentRadius += 0.85 * speedMult;
          splash.opacity -= 0.045 * speedMult;
          if (splash.opacity <= 0 || splash.currentRadius > splash.maxRadius) {
            floorSplashes.splice(s, 1);
            continue;
          }
          ctx.strokeStyle = splash.color;
          ctx.globalAlpha = splash.opacity;
          ctx.lineWidth = 1;
          ctx.beginPath();
          // Isometric ellipse splatter simulation
          ctx.ellipse(splash.x, splash.y, splash.currentRadius, splash.currentRadius * 0.35, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Glow setting
      if (isGlow) {
        ctx.shadowBlur = 8;
      } else {
        ctx.shadowBlur = 0;
      }

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (activeType === 'rain') {
          p.y += p.speedY;
          p.x += p.speedX + Math.sin(swayTime + p.swaySeed) * 0.1 * swayAmplitude;
        } else if (activeType === 'snow') {
          p.y += p.speedY;
          p.x += p.speedX + Math.sin(swayTime + p.swaySeed) * 0.4 * swayAmplitude;
        } else if (activeType === 'leaves') {
          p.y += p.speedY + Math.sin(swayTime + p.swaySeed) * 0.2 * swayAmplitude;
          p.x += p.speedX + Math.cos(swayTime + p.swaySeed) * 0.3 * swayAmplitude;
          p.rot += p.rotSpeed * swayAmplitude;
        }

        // Drop boundaries wrap & floor collision splash triggers
        if (p.speedY >= 0) {
          if (p.y > canvas.height + 20) {
            // Collision splash trigger
            if (enableSplashes && Math.random() < 0.35) {
              floorSplashes.push({
                x: p.x,
                y: canvas.height - 2 - Math.random() * 5,
                maxRadius: (Math.random() * 6 + 5) * sizeMult * splashSize,
                currentRadius: 1,
                opacity: 0.85,
                color: p.color
              });
            }
            p.y = -20;
            p.x = Math.random() * canvas.width;
          }
        } else {
          if (p.y < -20) {
            p.y = canvas.height + 20;
            p.x = Math.random() * canvas.width;
          }
        }

        if (p.x < -20) {
          p.x = canvas.width + 20;
          if (p.speedY >= 0) p.y = -10;
          else p.y = canvas.height + 10;
        }
        if (p.x > canvas.width + 20) {
          p.x = -20;
          if (p.speedY >= 0) p.y = -10;
          else p.y = canvas.height + 10;
        }

        ctx.fillStyle = p.color;
        if (isGlow) {
          ctx.shadowColor = p.color;
        }

        // Draw streak trails if setting enabled
        if (trailLength > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.strokeStyle = p.color;
          ctx.lineWidth = Math.max(1, p.sizeW * 0.65);
          ctx.globalAlpha = 0.25;
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.speedX * trailLength, p.y - p.speedY * trailLength);
          ctx.stroke();
          ctx.restore();
        }

        if (particleShape === 'emojis' && emojiList.length > 0) {
          const emoji = emojiList[(p.charIndex || 0) % emojiList.length];
          ctx.font = `${p.sizeW * 8}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.save();
          ctx.translate(p.x, p.y);
          if (activeType === 'leaves') {
            ctx.rotate(p.rot);
          }
          ctx.fillText(emoji, 0, 0);
          ctx.restore();
        } else if (particleShape === 'circles') {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.sizeW / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Standard style (rectangles/leaves pixels)
          if (activeType === 'leaves') {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.fillRect(-p.sizeW / 2, -p.sizeH / 2, p.sizeW, p.sizeH);
            ctx.restore();
          } else {
            ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.sizeW, p.sizeH);
          }
        }
      }

      animationFrameId = requestAnimationFrame(updateAndDraw);
    };

    animationFrameId = requestAnimationFrame(updateAndDraw);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [mode, resolvedTime, sharedWeathers]);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 z-[1] pointer-events-none" 
      style={{ imageRendering: 'pixelated' }}
    />
  );
};

const MountainPets = ({ playAppSound }: { playAppSound: any }) => {
  const [pets, setPets] = useState([
    {
      id: 'sheep_1',
      type: 'sheep',
      name: 'Pixel-Schaf',
      baseX: 25,
      y: 32,
      dir: 1,
      offsetX: 0,
      sound: 'sheep',
      text: 'Mäh! 🐑',
    },
    {
      id: 'chicken_1',
      type: 'chicken',
      name: 'Pixel-Huhn',
      baseX: 58,
      y: 25,
      dir: -1,
      offsetX: 0,
      sound: 'chicken',
      text: 'Gack! 🐔',
    },
    {
      id: 'dragon_1',
      type: 'dragon',
      name: 'Baby-Drache',
      baseX: 73,
      y: 35,
      dir: 1,
      offsetX: 0,
      sound: 'dragon',
      text: 'Rawr! 🐉',
    }
  ]);

  const [activeBubble, setActiveBubble] = useState<{ id: string; text: string } | null>(null);
  const [jumpingPet, setJumpingPet] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setPets(prev => prev.map(p => {
        const changeDir = Math.random() < 0.15;
        const newDir = changeDir ? p.dir * -1 : p.dir;
        let newOffset = p.offsetX + newDir * 0.4;
        if (newOffset > 10) newOffset = 10;
        if (newOffset < -10) newOffset = -10;
        return {
          ...p,
          dir: newDir,
          offsetX: newOffset
        };
      }));
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  const handlePetClick = (id: string, sound: any, text: string) => {
    playAppSound(sound);
    setJumpingPet(id);
    setActiveBubble({ id, text });
    setTimeout(() => {
      setJumpingPet(null);
    }, 600);
    setTimeout(() => {
      setActiveBubble(prev => prev?.id === id ? null : prev);
    }, 2200);
  };

  return (
    <>
      {pets.map(p => {
        const isJumping = jumpingPet === p.id;
        const hasBubble = activeBubble?.id === p.id;
        const currentX = `calc(${p.baseX}% + ${p.offsetX}px)`;

        return (
          <div
            key={p.id}
            className="absolute z-10 pointer-events-auto cursor-pointer"
            style={{
              left: currentX,
              bottom: `${p.y}%`,
              transform: 'translate(-50%, 0)',
              transition: 'left 1.2s linear'
            }}
            onClick={(e) => {
              e.stopPropagation();
              handlePetClick(p.id, p.sound, p.text);
            }}
          >
            <AnimatePresence>
              {hasBubble && (
                <motion.div
                  initial={{ scale: 0, y: 10, opacity: 0 }}
                  animate={{ scale: 1, y: -24, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className="absolute left-1/2 -translate-x-1/2 bg-black/95 border border-mc-gold text-white font-mono text-[9px] px-1.5 py-0.5 rounded-md whitespace-nowrap shadow-xl z-20"
                >
                  {activeBubble.text}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-black border-r border-b border-mc-gold rotate-45 -mt-1" />
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div
              animate={isJumping ? {
                y: [-2, -22, 0],
                scaleX: [1, 0.9, 1.1, 1],
                scaleY: [1, 1.2, 0.9, 1]
              } : {
                y: [0, -1, 0]
              }}
              transition={isJumping ? {
                duration: 0.5,
                ease: "easeOut"
              } : {
                repeat: Infinity,
                duration: p.type === 'chicken' ? 0.8 : 1.4,
                ease: "easeInOut"
              }}
              className="flex flex-col items-center select-none"
            >
              {p.type === 'sheep' && (
                <svg width="24" height="18" viewBox="0 0 24 18" className="pixelated" style={{ transform: p.dir < 0 ? 'scaleX(-1)' : 'none' }}>
                  <rect x="4" y="2" width="14" height="10" fill="#f0f0f0" stroke="#d0d0d0" strokeWidth="1" />
                  <rect x="5" y="3" width="12" height="8" fill="#ffffff" />
                  <rect x="16" y="1" width="6" height="6" fill="#e5c7a3" stroke="#bfa37c" strokeWidth="1" />
                  <rect x="16" y="0" width="5" height="2" fill="#ffffff" />
                  <rect x="20" y="3" width="1" height="1" fill="#000000" />
                  <rect x="6" y="12" width="2" height="4" fill="#cfbca7" />
                  <rect x="14" y="12" width="2" height="4" fill="#cfbca7" />
                  <rect x="8" y="12" width="2" height="4" fill="#a49383" />
                  <rect x="12" y="12" width="2" height="4" fill="#a49383" />
                </svg>
              )}

              {p.type === 'chicken' && (
                <svg width="18" height="18" viewBox="0 0 16 16" className="pixelated" style={{ transform: p.dir < 0 ? 'scaleX(-1)' : 'none' }}>
                  <rect x="3" y="4" width="8" height="7" fill="#ffffff" stroke="#e0e0e0" strokeWidth="1" />
                  <rect x="9" y="1" width="3" height="2" fill="#ef4444" />
                  <rect x="8" y="2" width="5" height="4" fill="#ffffff" stroke="#e0e0e0" strokeWidth="1" />
                  <rect x="9" y="2" width="4" height="3" fill="#ffffff" />
                  <rect x="13" y="3" width="2" height="1" fill="#f59e0b" />
                  <rect x="11" y="4" width="2" height="2" fill="#ef4444" />
                  <rect x="11" y="3" width="1" height="1" fill="#000000" />
                  <rect x="5" y="11" width="1" height="3" fill="#f59e0b" />
                  <rect x="8" y="11" width="1" height="3" fill="#f59e0b" />
                  <rect x="4" y="14" width="3" height="1" fill="#f59e0b" />
                  <rect x="7" y="14" width="3" height="1" fill="#f59e0b" />
                </svg>
              )}

              {p.type === 'dragon' && (
                <svg width="28" height="22" viewBox="0 0 28 22" className="pixelated" style={{ transform: p.dir < 0 ? 'scaleX(-1)' : 'none' }}>
                  <rect x="6" y="5" width="14" height="11" fill="#15803d" stroke="#166534" strokeWidth="1" />
                  <rect x="7" y="6" width="12" height="9" fill="#22c55e" />
                  <rect x="3" y="3" width="6" height="6" fill="#c084fc" stroke="#a855f7" strokeWidth="1" />
                  <rect x="2" y="11" width="5" height="3" fill="#15803d" />
                  <rect x="0" y="9" width="3" height="3" fill="#166534" />
                  <rect x="1" y="10" width="2" height="2" fill="#22c55e" />
                  <rect x="18" y="2" width="8" height="7" fill="#15803d" stroke="#166534" strokeWidth="1" />
                  <rect x="19" y="3" width="6" height="5" fill="#22c55e" />
                  <rect x="22" y="0" width="2" height="2" fill="#f59e0b" />
                  <rect x="10" y="3" width="2" height="2" fill="#f59e0b" />
                  <rect x="14" y="3" width="2" height="2" fill="#f59e0b" />
                  <rect x="23" y="4" width="2" height="2" fill="#facc15" />
                  <rect x="24" y="5" width="1" height="1" fill="#ef4444" />
                  <rect x="25" y="6" width="3" height="2" fill="#15803d" />
                  <rect x="11" y="10" width="7" height="6" fill="#f59e0b" opacity="0.9" />
                  <rect x="8" y="16" width="3" height="4" fill="#166534" />
                  <rect x="15" y="16" width="3" height="4" fill="#166534" />
                </svg>
              )}
            </motion.div>
          </div>
        );
      })}
    </>
  );
};

const DISCORD_URL = 'https://discord.com/invite/2XrnqReeE';

const SpruceTree = ({ className, height = 32, color }: { className?: string; height?: number; color: string }) => {
  return (
    <div className={`absolute select-none pointer-events-none ${className}`} style={{ height, width: height * 0.4 }}>
      <svg viewBox="0 0 40 100" className="w-full h-full" fill={color}>
        <polygon points="17,0 23,0 23,3 26,3 26,6 29,6 29,10 32,10 32,14 35,14 35,19 38,19 38,24 2,24 2,19 5,19 5,14 8,14 8,10 11,10 11,6 14,6 14,3 17,3" />
        <polygon points="17,16 23,16 23,19 26,19 26,22 29,22 29,26 32,26 32,31 35,31 35,36 38,36 38,42 2,42 2,36 5,36 5,31 8,31 8,26 11,26 11,22 14,22 14,19 17,19" />
        <polygon points="17,34 23,34 23,37 26,37 26,40 29,40 29,44 32,44 32,49 35,49 35,55 39,55 39,62 1,62 1,55 5,55 5,49 8,49 8,44 11,44 11,40 14,40 14,37 17,37" />
        <polygon points="17,52 23,52 23,55 26,55 26,58 29,58 29,62 32,62 32,68 36,68 36,75 40,75 40,84 0,84 0,75 4,75 4,68 8,68 8,62 11,62 11,58 14,58 14,55 17,55" />
        <rect x="17" y="84" width="6" height="16" />
      </svg>
    </div>
  );
};

const PixelCastle = ({ className, height = 64, color }: { className?: string; height?: number; color: string }) => {
  return (
    <div className={`absolute select-none pointer-events-none ${className}`} style={{ height, width: height * 1.5 }}>
      <svg viewBox="0 0 150 100" className="w-full h-full" fill={color}>
        <rect x="5" y="30" width="22" height="70" />
        <rect x="2" y="24" width="28" height="6" />
        <rect x="2" y="18" width="6" height="6" />
        <rect x="13" y="18" width="6" height="6" />
        <rect x="24" y="18" width="6" height="6" />
        <rect x="27" y="45" width="56" height="55" />
        <rect x="27" y="40" width="56" height="5" />
        <rect x="31" y="35" width="6" height="5" />
        <rect x="43" y="35" width="6" height="5" />
        <rect x="55" y="35" width="6" height="5" />
        <rect x="67" y="35" width="6" height="5" />
        <rect x="75" y="35" width="6" height="5" />
        <rect x="42" y="15" width="26" height="25" />
        <polygon points="39,15 55,0 71,15" />
        <rect x="54" y="-8" width="2" height="8" />
        <polygon points="44,-8 54,-8 54,-4" fill="#ef4444" opacity="0.6" />
        <rect x="83" y="35" width="26" height="65" />
        <rect x="80" y="30" width="32" height="5" />
        <rect x="80" y="25" width="6" height="5" />
        <rect x="93" y="25" width="6" height="5" />
        <rect x="106" y="25" width="6" height="5" />
        <rect x="109" y="55" width="36" height="45" />
        <rect x="112" y="50" width="6" height="5" />
        <rect x="124" y="50" width="6" height="5" />
        <rect x="136" y="50" width="6" height="5" />
        <path d="M 47,100 L 47,80 A 8,8 0 0 1 63,80 L 63,100 Z" fill="rgba(0,0,0,0.3)" />
      </svg>
    </div>
  );
};

interface Player {
  id: string;
  username: string;
  server: 'pvp' | 'survival';
  lastSeen: string;
}

interface ServerStatus {
  online: boolean;
  playerCount: number;
  maxPlayers: number;
  maintenance?: boolean;
}

interface UserProfile {
  id?: string;
  userId: string;
  displayName: string;
  minecraftUsername: string;
  isOnline: boolean;
  currentServer: 'none' | 'pvp' | 'survival';
  role?: 'Member' | 'VIP' | 'MVP' | 'Mod' | 'Admin' | 'Root' | 'Owner' | 'Spieler';
  xp?: number;
  coins?: number;
  isShadowMuted?: boolean;
  isInvisible?: boolean;
  customSkin?: string;
  updatedAt: any;
  purchasedRank?: string;
  purchasedRanks?: string[];
  activeGlow?: string;
  ownedColors?: string[];
  // NEUE FELDER
  inventory?: {
    keys?: number;
    cases?: number;
    pickaxePower?: number;
    pickaxeName?: string;
    luck?: number;
    xpMultiplier?: number;
  };
  mining?: {
    cps?: number;
    level?: number;
    coinsPerClick?: number;
  };
  perks?: {
    flightUntil?: number;
  };
  lastLoginIp?: string;
  lastLoginCity?: string;
  lastLoginRegion?: string;
  lastLoginCountry?: string;
  lastLoginPostal?: string;
  lastLoginTimezone?: string;
  lastLoginOrg?: string;
  lastLoginAsn?: string;
  registrationIp?: string;
  lastDailyReward?: any;
  quizWins?: number;
}

interface ChatMessage {
  id: string;
  text: string;
  userId: string;
  displayName: string;
  role?: string;
  createdAt: any;
  timestamp?: any;
  isAction?: boolean;
  isLocal?: boolean;
  isStaffOnly?: boolean;
  tempId?: string;
  purchasedRank?: string;
  localTimestamp?: number;
  channel?: string;
  imageUrl?: string;
}

interface NewsItem {
  id: string;
  title: string;
  text: string;
  createdAt: any;
}

interface PollOption {
  label: string;
  votes: number;
}

interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  isActive: boolean;
  createdAt: any;
}

interface SuggestionComment {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: string;
}

interface Suggestion {
  id: string;
  title: string;
  description: string;
  authorId: string;
  authorName: string;
  createdAt: any;
  status: 'pending' | 'planned' | 'in-progress' | 'completed' | 'declined';
  upvotes: number;
  upvotedBy: string[];
  downvotes: number;
  downvotedBy: string[];
  comments: SuggestionComment[];
  tag?: 'Feature' | 'Bug-Report' | 'Design' | 'Sonstiges';
}

interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: 'Ränge' | 'Items' | 'Vorteile' | 'Boxen' | 'Ausrüstung' | 'Farben';
  icon?: string;
  stock?: number;
  isActive: boolean;
  createdAt: any;
}

interface Clan {
  id: string;
  name: string;
  tag: string;
  description?: string;
  announcement?: string;
  leaderId: string;
  logo?: string;
  createdAt: any;
  memberCount: number;
  level: number;
  xp: number;
  totalKills: number;
}

interface ClanMember {
  id: string;
  userId: string;
  role: 'Leader' | 'Officer' | 'Member';
  joinedAt: any;
  xpContribution: number;
}

interface ClanJoinRequest {
  id: string;
  userId: string;
  minecraftUsername: string;
  message?: string;
  requestedAt: any;
}

interface ClanQuest {
  id: string;
  title: string;
  goal: number;
  current: number;
  rewardXp: number;
  completed: boolean;
}

// App component - Main entry point
// Mining Tool Component for Custom Cursor
const PickaxeTool = ({ active, pickaxeName }: { active: boolean, pickaxeName?: string }) => {
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      setPos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, []);

  const pickColor = 
    pickaxeName?.toLowerCase()?.includes('netherit') ? '#7c3aed' :
    pickaxeName?.toLowerCase()?.includes('diamant') ? '#3b82f6' :
    pickaxeName?.toLowerCase()?.includes('eisen') ? '#cbd5e1' :
    pickaxeName?.toLowerCase()?.includes('gold') ? '#facc15' :
    '#78350f'; // Holz

  return (
    <>
      <div 
        className="fixed inset-0 pointer-events-none z-[190]"
        style={{ 
          background: `radial-gradient(circle 400px at ${pos.x}px ${pos.y}px, rgba(255,255,255,0.12), transparent)` 
        }}
      />
      <motion.div
        style={{ left: pos.x, top: pos.y, position: 'fixed', pointerEvents: 'none', zIndex: 9999 }}
        animate={{ 
          rotate: active ? [0, -90, 0] : -20,
          scale: active ? 1.4 : 1,
          x: active ? -40 : 0,
          y: active ? -20 : 0
        }}
        transition={{ 
          rotate: { duration: 0.15 },
          scale: { type: 'spring', stiffness: 400 }
        }}
        className="opacity-100 drop-shadow-[0_25px_50px_rgba(0,0,0,1)]"
      >
        <div className="relative group">
          <Pickaxe size={64} style={{ color: pickColor }} className="drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]" />
          
          {/* Magic Glow */}
          {(pickaxeName?.includes('Netherit') || pickaxeName?.includes('Diamant')) && (
            <motion.div 
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 z-10"
            >
              <Pickaxe size={64} style={{ color: 'white' }} className="blur-md opacity-50" />
            </motion.div>
          )}

          {/* Impact Spark */}
          {active && (
            <motion.div 
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 2, 0], opacity: [0, 1, 0] }}
              className="absolute -top-4 -right-4 w-12 h-12 bg-white/40 rounded-full blur-xl"
            />
          )}
        </div>
      </motion.div>
    </>
  );
};

// Special Role Constants
const STAFF_OVERWRITES: Record<string, 'Owner' | 'Admin'> = {
  'Block5': 'Owner',
  'dampfk': 'Owner',
  'finnhd1165': 'Admin'
};

const FloatingParticles = () => {
  const [particles, setParticles] = useState<any[]>([]);

  useEffect(() => {
    const p = Array.from({ length: 20 }).map(() => ({
      id: Math.random(),
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      size: Math.random() * 3 + 2,
      duration: Math.random() * 15 + 15,
      delay: Math.random() * 10,
      opacity: Math.random() * 0.4 + 0.1,
    }));
    setParticles(p);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {particles.map((p, i) => (
        <motion.div
          key={`particle-${p.id || i}-${i}`}
          initial={{ y: '110vh', opacity: 0 }}
          animate={{ 
            y: '-10vh', 
            opacity: [0, p.opacity, p.opacity, 0],
            rotate: [0, 180, 360]
          }}
          transition={{ 
            duration: p.duration, 
            repeat: Infinity, 
            delay: p.delay,
            ease: "linear"
          }}
          style={{
            position: 'absolute',
            left: p.left,
            width: p.size,
            height: p.size,
            backgroundColor: Math.random() > 0.5 ? '#ff4747' : '#ffaa00',
            boxShadow: '0 0 10px rgba(255, 71, 71, 0.5)',
            borderRadius: '1px'
          }}
        />
      ))}
    </div>
  );
};

const getGlowStyles = (color?: string, isStaticOverride?: boolean) => {
  if (!color || color === 'none') return '';
  const isStatic = isStaticOverride !== undefined ? isStaticOverride : (color !== 'rainbow');
  switch (color) {
    case 'red':
      return isStatic
        ? 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.7),_0_0_30px_rgba(239,68,68,0.3)] hover:shadow-[0_0_25px_rgba(239,68,68,0.9)] border-2 bg-red-950/20'
        : 'border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.85),_0_0_50px_rgba(239,68,68,0.45)] hover:shadow-[0_0_35px_rgba(239,68,68,1.0),_0_0_70px_rgba(239,68,68,0.6)] animate-pulse border-2';
    case 'blue':
      return isStatic
        ? 'border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.7),_0_0_30px_rgba(59,130,246,0.3)] hover:shadow-[0_0_25px_rgba(59,130,246,0.9)] border-2 bg-blue-950/20'
        : 'border-blue-400 shadow-[0_0_25px_rgba(59,130,246,0.85),_0_0_50px_rgba(59,130,246,0.45)] hover:shadow-[0_0_35px_rgba(59,130,246,1.0),_0_0_70px_rgba(59,130,246,0.6)] animate-pulse border-2';
    case 'gold':
      return isStatic
        ? 'border-yellow-400 shadow-[0_0_18px_rgba(251,191,36,0.75),_0_0_35px_rgba(251,191,36,0.35)] hover:shadow-[0_0_28px_rgba(251,191,36,0.95)] border-2 bg-yellow-950/20'
        : 'border-yellow-400 shadow-[0_0_30px_rgba(251,191,36,0.9),_0_0_60px_rgba(251,191,36,0.5)] hover:shadow-[0_0_40px_rgba(251,191,36,1.0),_0_0_80px_rgba(251,191,36,0.7)] animate-pulse border-2';
    case 'green':
      return isStatic
        ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.7),_0_0_30px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.9)] border-2 bg-emerald-950/20'
        : 'border-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.85),_0_0_50px_rgba(16,185,129,0.45)] hover:shadow-[0_0_35px_rgba(16,185,129,1.0),_0_0_70px_rgba(16,185,129,0.6)] animate-pulse border-2';
    case 'purple':
      return isStatic
        ? 'border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.7),_0_0_30px_rgba(168,85,247,0.3)] hover:shadow-[0_0_25px_rgba(168,85,247,0.9)] border-2 bg-purple-950/20'
        : 'border-purple-500 shadow-[0_0_25px_rgba(168,85,247,0.85),_0_0_50px_rgba(168,85,247,0.45)] hover:shadow-[0_0_35px_rgba(168,85,247,1.0),_0_0_70px_rgba(168,85,247,0.6)] animate-pulse border-2';
    case 'rainbow':
      return 'rainbow-glow border-2 border-solid';
    default:
      return '';
  }
};

const clientQuizQuestions = [
  { question: "Wie viele Eisenbarren benötigt man für einen Amboss?", answers: ["31"] },
  { question: "Welches Werkzeug baut Obsidian am schnellsten ab?", answers: ["netheritspitzhacke", "netherit-spitzhacke", "netherit spitzhacke", "netheritespitzhacke", "netherite-spitzhacke", "netherite spitzhacke", "diamantspitzhacke", "diamant-spitzhacke", "diamant spitzhacke", "spitzhacke"] },
  { question: "Welche Kreatur explodiert, wenn sie dem Spieler zu nahe kommt?", answers: ["creeper", "kreeper"] },
  { question: "Was muss man im Nether abbauen, um Netherit herzustellen?", answers: ["antiker schutt", "ancient debris", "schutt", "ancientdebris"] },
  { question: "Wie viele Holzbretter (Planks) erhält man aus einem normalen Holzstamm?", answers: ["4", "vier"] },
  { question: "Welcher Trank verleiht die Fähigkeit, unter Wasser zu atmen?", answers: ["wasseratmung", "wasseratmungstrank", "trank der wasseratmung"] },
  { question: "Welches Tier liefert Wolle und Hammelfleisch?", answers: ["schaf", "schafe"] },
  { question: "Wie heißt die Dimension, in der man den Enderdrachen bekämpft?", answers: ["the end", "end", "das end"] },
  { question: "Aus wie vielen Obsidianblöcken besteht das kleinste Netherportal (ohne Ecken)?", answers: ["10", "zehn"] },
  { question: "Aus wie vielen Obsidianblöcken besteht ein vollständiges Netherportal inklusive Ecken?", answers: ["14", "vierzehn"] },
  { question: "Welcher feindliche Mob teleportiert sich, wenn man ihn anschaut?", answers: ["enderman", "endermann"] },
  { question: "Wie zähmt man einen Wolf in Minecraft?", answers: ["knochen", "mit knochen"] },
  { question: "Welches Material schmilzt man in einem Ofen, um Glas herzustellen?", answers: ["sand"] },
  { question: "Wie viele Betten benötigt man, um einen Eisengolem in einem Dorf spawnen zu lassen? (Minimum)", answers: ["3", "drei"] },
  { question: "Welcher Block zieht Feuchtigkeit an und trocknet im Ofen?", answers: ["schwamm", "sponge"] },
  { question: "Mit welchem Gegenstand kann man ein Schwein lenken, wenn man auf ihm reitet?", answers: ["karottenrute", "karotte am stiel", "karotten-rute"] },
  { question: "Welcher Trank erhöht die Bewegungsgeschwindigkeit?", answers: ["schnelligkeit", "geschwindigkeit", "schnelligkeitstrank", "geschwindigkeitstrank"] },
  { question: "Was erhält man, wenn man eine Wasserquelle mit fließender Lava mischt?", answers: ["pflasterstein", "cobblestone"] },
  { question: "Wie heißt das grüne Juwel, das zum Handeln mit Dorfbewohnern verwendet wird?", answers: ["smaragd", "emerald"] },
  { question: "Welche Nahrung wird benötigt, um Axolotl fortzupflanzen?", answers: ["tropenfisch", "tropenfischeimer"] },
  { question: "Welches Erz kommt nur im Extremberge-Biom natürlich vor?", answers: ["smaragderz", "smaragd"] },
  { question: "Wie viele Goldklumpen benötigt man, um einen Goldbarren herzustellen?", answers: ["9", "neun"] },
  { question: "Aus welchem Holz wird der dunkelste Holztyp hergestellt?", answers: ["schwarzeiche", "dark oak", "schwarzeichenholz"] },
  { question: "Wie hoch ist die maximale Bauhöhe in Minecraft?", answers: ["320", "319", "318"] },
  { question: "Welcher Block verhindert Fallschaden zu 100%, wenn man darauf landet?", answers: ["heuballen", "schleimblock", "wasser", "honigblock"] },
  { question: "Welches gängige Monster verbrennt NICHT im Sonnenlicht?", answers: ["creeper", "spinne", "enderman"] },
  { question: "In welchem Jahr wurde Minecraft 1.0 offiziell veröffentlicht?", answers: ["2011"] },
  { question: "Mit welcher Taste schleicht man standardmäßig in Minecraft?", answers: ["shift", "umschalttaste", "schleichtaste", "umschalt"] },
  { question: "Aus wie vielen Fäden stellt man einen Block Wolle her?", answers: ["4", "vier"] },
  { question: "Welcher Gegenstand schützt den Spieler im Nether vor Angriffen der Piglins?", answers: ["goldrüstung", "gold", "goldhelm", "goldhose", "goldbrustplatte", "goldschuhe"] },
  { question: "Welcher Trank schwächt feindliche Mobs und reduziert ihren Schaden?", answers: ["schwäche", "schwächetrank"] },
  { question: "Wie viele Obsidianblöcke benötigt man, um einen Zaubertisch herzustellen?", answers: ["4", "vier"] },
  
  // Neue Minecraft Quizfragen
  { question: "Wie viele Diamanten benötigt man für eine vollständige Diamantrüstung?", answers: ["24", "vierundzwanzig"] },
  { question: "Aus wie vielen Weizen-Einheiten backt man ein Brot?", answers: ["3", "drei"] },
  { question: "Welchen Gegenstand benötigt man zwingend, um ein Schwein oder Pferd zu reiten?", answers: ["sattel"] },
  { question: "Wie heißt der dreiköpfige Boss-Mob, den der Spieler mit Seelensand und Köpfen selbst beschwören kann?", answers: ["wither"] },
  { question: "Welches Haustier lockt man mit rohem Kabeljau oder Lachs an?", answers: ["katze", "katzen", "oszelot", "ozelot"] },
  { question: "Welche Pflanze fressen Pandas am liebsten?", answers: ["bambus"] },
  { question: "Welcher fliegende, weiße Mob im Nether schießt mit explosiven Feuerbällen?", answers: ["ghast", "gast"] },
  { question: "Aus wie vielen Eisenbarren stellt man einen massiven Eisenblock her?", answers: ["9", "neun"] },
  { question: "Wie heißt der rote, hochexplosive Block, der aus Sand und Schwarzpulver hergestellt wird?", answers: ["tnt", "dynamit"] },
  { question: "Aus welchem Gestein besteht das unzerstörbare Fundament ganz unten in der Oberwelt?", answers: ["grundgestein", "bedrock"] },
  { question: "Welches legendäre Minecraft-Studio hat das Spiel ursprünglich entwickelt?", answers: ["mojang", "mojang studios"] },
  { question: "Wie heißt das fliegende Schiff, das man manchmal in den End-Städten findet?", answers: ["endschiff", "end-schiff", "end schiff"] },
  { question: "In welchem Biom generieren Hexenhütten natürlicherweise?", answers: ["sumpf", "sumpfbiom", "sümpfe"] },
  { question: "Welcher Trank erhöht die Sprunghöhe des Spielers?", answers: ["sprungkraft", "sprungkrafttrank", "trank der sprungkraft"] },
  { question: "Welcher seltene Gegenstand ermöglicht es dem Spieler, durch die Luft zu gleiten?", answers: ["elytra", "elytren"] },
  { question: "Welcher gigantische, blinde und extrem starke Mob bewacht die Tiefen des Deep Dark?", answers: ["warden"] },
  { question: "Welcher Gegenstand leitet Redstone-Signale über weite Strecken wie ein Kabel?", answers: ["redstone", "redstonestaub", "redstone-staub"] },
  { question: "Wie viele Holzstufen (Slabs) benötigt man, um ein Rezept für ein Boot zu füllen?", answers: ["5", "fünf"] },
  { question: "Welches Haustier kann man mit Karotten, Äpfeln oder goldenen Karotten züchten?", answers: ["pferd", "pferde", "esel"] },
  { question: "Welches Erz schmilzt man, um Kupferbarren zu erhalten?", answers: ["kupfer", "kupfererz", "rohkuper", "rohkupfer"] },
  { question: "Mit welchem Item kann man schwebende Phantome (Phantoms) vertreiben? (Ein friedlicher Mob)", answers: ["katze", "katzen"] },
  { question: "Wie heißt das Erz, das man abbaut, um Redstone-Staub zu erhalten?", answers: ["redstoneerz", "redstone-erz"] },
  { question: "Welche Scheibe oder Musikplatte ist die seltenste und wurde von C418 komponiert?", answers: ["11", "pigstep"] },
  { question: "Aus welchem Holz wird der hellste Holztyp (Birke) gewonnen?", answers: ["birke", "birkeneiche", "birkenholz"] },
  { question: "Wie heißt der feindliche Meeres-Mob mit einem Dreizack, der im Wasser spawnt?", answers: ["ertrunkener", "ertrunkene", "drowned"] },
  { question: "Aus wie vielen Goldbarren craftet man einen Goldblock?", answers: ["9", "neun"] },
  { question: "Wie heißt das Biom im Nether mit riesigen blauen Pilzbäumen?", answers: ["wirrwald", "warped forest"] },
  { question: "Welcher friedliche Mob aus der 1.17 leuchtet unter Wasser und kann in Eimern transportiert werden?", answers: ["axolotl"] },
  { question: "Aus welcher Nutzpflanze stellt man Zucker und Papier her?", answers: ["zuckerrohr"] },
  { question: "Wie viele Wolle-Blöcke braucht man, um ein Bett zu craften?", answers: ["3", "drei"] },
  { question: "Wie viele Holzbretter braucht man für eine Werkbank (Crafting Table)?", answers: ["4", "vier"] },
  { question: "Welcher unheimliche Mob hinterlässt eine Perle, mit der man sich teleportieren kann?", answers: ["enderman", "endermann"] },
  { question: "Wie heißt das Biom im Nether mit riesigen roten Pilzbäumen?", answers: ["karmesinwald", "crimson forest"] },
  { question: "Welcher Trank schützt den Spieler vor Feuerschaden und Lava?", answers: ["feuerresistenz", "feuerresistenztrank", "trank der feuerresistenz"] },
  { question: "Welchen Fisch fressen Ozelots oder Katzen am liebsten?", answers: ["kabeljau", "lachs", "fisch"] },
  { question: "Aus wie vielen Eisenbarren craftet man eine Eisenschaufel?", answers: ["1", "eins"] },
  { question: "Wie viele Wolle-Blöcke benötigt man, um ein Gemälde (Painting) zu craften?", answers: ["1", "eins"] },
  { question: "Mit welchem Erz im Nether stellt man Quarzblöcke her?", answers: ["netherquarz", "quarz", "netherquarzerz", "nether-quarz"] },
  { question: "Welcher Trank erhöht die Sichtbarkeit unter Wasser oder im Dunkeln?", answers: ["nachtsicht", "nachtsichttrank", "trank der nachtsicht"] },
  { question: "Aus wie vielen Papier-Einheiten und Leder craftet man ein Buch?", answers: ["3", "drei"] },
  { question: "Wie heißt die Dimension, in die man mit einem Obsidianportal gelangt?", answers: ["nether", "die hölle", "hölle"] },
  { question: "Wie heißt der pelzige, gelbe Mob, der Honig produziert?", answers: ["biene", "bienen"] },
  { question: "Welches Gestein im Nether brennt ewig, wenn man es anzündet?", answers: ["netherrack"] },
  { question: "Welchen Trank verwendet man, um Zombie-Villager zu heilen?", answers: ["schwäche", "schwächetrank"] },
  { question: "Aus wie vielen Kohle-Einheiten craftet man einen Kohleblock?", answers: ["9", "neun"] },
  { question: "Welchen friedlichen Mob aus der 1.19 kann man Items einsammeln lassen?", answers: ["allay"] },
  { question: "Wie heißt der schwebende Mob im End, der Schalen für Kisten droppt?", answers: ["shulker"] },
  { question: "Welches Werkzeug baut Laub am schnellsten ab und hinterlässt ganze Blätter?", answers: ["schere", "shears"] },
  { question: "Wie viele Wither-Skelett-Schädel benötigt man, um einen Wither zu beschwören?", answers: ["3", "drei"] },
  { question: "Aus welchem Material stellt man Eimer her?", answers: ["eisen", "eisenbarren"] },
  { question: "Welches Nahrungsmittel wächst an Eichenbäumen und kann vergoldet sein?", answers: ["apfel", "goldener apfel", "äpfel"] },
  { question: "Wie viele Stöcke (Sticks) benötigt man für eine Leiter?", answers: ["7", "sieben"] },
  { question: "Welcher grüne Block federt den Spieler ab und lässt ihn hochfedern?", answers: ["schleimblock", "slimeblock", "schleim", "slime"] }
];

export default function App() {
  // Quota state
  const [hasQuotaExceeded, setHasQuotaExceeded] = useState(false);

  const [realmCodes, setRealmCodes] = useState({
    PVP: 'https://discord.com/invite/2XrnqReeE',
    SURVIVAL: 'https://discord.com/invite/2XrnqReeE'
  });
  const [copied, setCopied] = useState<string | null>(null);
  const [user, setUser] = useState<User| null>(null);
  const [guestId] = useState<string>(() => {
    if (typeof window === 'undefined') return 'guest_temp';
    let id = localStorage.getItem('suggestions_guest_id');
    if (!id) {
      id = 'guest_' + Math.random().toString(36).substring(2, 11);
      localStorage.setItem('suggestions_guest_id', id);
    }
    return id;
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOwner, setIsOwner] = useState(false); // New Owner tier
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [realmNames, setRealmNames] = useState({ pvp: 'Helden', survival: 'Survival World' });
  const [realmColors, setRealmColors] = useState({ pvp: '#ff3b3b', survival: '#ff3b3b' });
  const [broadcastMessage, setBroadcastMessage] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [userProfiles, setUserProfiles] = useState<UserProfile[]>([]);
  const [myProfile, setMyProfile] = useState<UserProfile | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showClientsModal, setShowClientsModal] = useState(false);
  const [clientActiveTab, setClientActiveTab] = useState<'lunar' | 'badlion' | 'labymod' | 'vanilla' | 'browser-mod'>('lunar');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [invitedClanId, setInvitedClanId] = useState<string | null>(null);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const activeEditingProfId = editingProfileId || user?.uid || null;
  const editingProfile = activeEditingProfId 
    ? (userProfiles.find(p => p.userId === activeEditingProfId) || (activeEditingProfId === user?.uid ? myProfile : null))
    : null;
  const [tempSkin, setTempSkin] = useState<string | null>(null);
  const [mcUsernameInput, setMcUsernameInput] = useState<string>('');
  const [activeGlowInput, setActiveGlowInput] = useState<string>('none');
  const [previewGlow, setPreviewGlow] = useState<string | null>(null);
  
  // Retro Jukebox states & audio references
  const [unlockedDiscs, setUnlockedDiscs] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('mc_unlocked_discs');
      return saved ? JSON.parse(saved) : ['cat'];
    } catch {
      return ['cat'];
    }
  });
  const [activeDisc, setActiveDisc] = useState<string | null>(null);
  const [isJukeboxPlaying, setIsJukeboxPlaying] = useState<boolean>(false);
  const [jukeboxVolume, setJukeboxVolume] = useState<number>(0.4);
  const [activeNotes, setActiveNotes] = useState<{ id: number; x: number; char: string; color: string }[]>([]);
  const [customSongUrl, setCustomSongUrl] = useState<string>('');
  const [activeStreamTitle, setActiveStreamTitle] = useState<string>('');
  const [streamLoading, setStreamLoading] = useState<boolean>(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [resolvedStreamUrl, setResolvedStreamUrl] = useState<string>('');
  const [youtubeVideoId, setYoutubeVideoId] = useState<string | null>(null);
  const [spotifyUrl, setSpotifyUrl] = useState<string | null>(null);
  const [ytReady, setYtReady] = useState<boolean>(false);
  
  // Easter Egg State
  const [showJumpscare, setShowJumpscare] = useState(false);
  const [isPostGlitching, setIsPostGlitching] = useState(false);
  const logoClicksRef = useRef({ count: 0, lastClick: 0 });

  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const filterNodeRef = useRef<BiquadFilterNode | null>(null);
  const synthIntervalRef = useRef<any>(null);
  const streamAudioRef = useRef<HTMLAudioElement | null>(null);
  const ytPlayerRef = useRef<any>(null);

  const unlockDisc = (discId: string) => {
    setUnlockedDiscs(prev => {
      if (prev.includes(discId)) return prev;
      const next = [...prev, discId];
      localStorage.setItem('mc_unlocked_discs', JSON.stringify(next));
      return next;
    });
  };

  const initAudioCtx = () => {
    if (!audioCtxRef.current) {
      const AudioCtxClass = (window.AudioContext || (window as any).webkitAudioContext);
      if (AudioCtxClass) {
        audioCtxRef.current = new AudioCtxClass();
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    
    // Mobile unlock for stream audio element
    if (!streamAudioRef.current) {
      streamAudioRef.current = new Audio();
      try {
        streamAudioRef.current.setAttribute("referrerpolicy", "no-referrer");
      } catch (e) {}
    }
    const audio = streamAudioRef.current;
    if (!audio.src || audio.src.endsWith('undefined') || audio.src.startsWith('data:audio/mp3;base64,')) {
      // Create a tiny silent source so play() actually resolves
      audio.src = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU5LjI3LjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq//MUZAAAAAGkAAAAAAAAA0gAAAAATEFN//MUZAMAAAGkAAAAAAAAA0gAAAAARTmQ//MUZAYAAAGkAAAAAAAAA0gAAAAARTmQ//MUZAgAAAGkAAAAAAAAA0gAAAAARTmQ";
      audio.play().then(() => audio.pause()).catch(() => {});
    }
  };

  const playSynthNote = (freq: number, type: OscillatorType, duration: number, gainVal: number, detuneVal: number = 0) => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    if (ctx.state === 'closed') return;

    try {
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (detuneVal) {
        osc.detune.setValueAtTime(detuneVal, ctx.currentTime);
      }
      
      noteGain.gain.setValueAtTime(0, ctx.currentTime);
      noteGain.gain.linearRampToValueAtTime(gainVal, ctx.currentTime + 0.04);
      noteGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      
      osc.connect(noteGain);
      if (filterNodeRef.current) {
        noteGain.connect(filterNodeRef.current);
      } else if (masterGainRef.current) {
        noteGain.connect(masterGainRef.current);
      } else {
        noteGain.connect(ctx.destination);
      }
      
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.warn("Error playing note:", e);
    }
  };

  const triggerJumpscare = () => {
    initAudioCtx();
    setShowJumpscare(true);
    setIsPostGlitching(false); // Reset any existing active aftershock

    // Save current jukebox volume to restore later
    const previousVol = jukeboxVolume;
    setJukeboxVolume(1.0); // Crank up volume in game state!

    // Also directly maximize any active HTML audio elements
    if (streamAudioRef.current) {
      streamAudioRef.current.volume = 1.0;
    }

    // Play scary noise
    if (audioCtxRef.current) {
      const ctx = audioCtxRef.current;
      try {
        // Resume context in case it was suspended
        if (ctx.state === 'suspended') {
          ctx.resume();
        }

        const now = ctx.currentTime;

        // 1. White Noise Node (Static crunch)
        const bufferSize = ctx.sampleRate * 2.8; 
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1; // Pure white noise
        }
        
        const noiseSource = ctx.createBufferSource();
        noiseSource.buffer = buffer;
        
        // Lowpass filter for deep rumbling bass
        const rumblyFilter = ctx.createBiquadFilter();
        rumblyFilter.type = 'lowpass';
        rumblyFilter.frequency.setValueAtTime(150, now);
        rumblyFilter.frequency.linearRampToValueAtTime(8000, now + 1.8);
        
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(3.5, now); // Super high Gain volume!
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 2.7);
        
        noiseSource.connect(rumblyFilter);
        rumblyFilter.connect(noiseGain);
        noiseGain.connect(ctx.destination);
        
        // 2. Screeching Demonic Sawtooth & Frequency Modulation
        const carrierOsc = ctx.createOscillator();
        carrierOsc.type = 'sawtooth';
        carrierOsc.frequency.setValueAtTime(1300, now);
        // Exponentially ramp frequency up to 3600 Hz for ear-piercing scream
        carrierOsc.frequency.exponentialRampToValueAtTime(3600, now + 1.5);
        
        const FMModulator = ctx.createOscillator();
        FMModulator.type = 'sine';
        FMModulator.frequency.setValueAtTime(66.6, now); // Rate of satanic sweep
        
        const FMGain = ctx.createGain();
        FMGain.gain.setValueAtTime(500, now); // Deep modulation depth
        
        FMModulator.connect(FMGain);
        FMGain.connect(carrierOsc.frequency); // Modulate carrier frequency
        
        // Distort the carrier to sound metallic/bloody using waveshaper
        const waveshaper = ctx.createWaveShaper();
        const makeDistortionCurve = (amount = 120) => {
          const k = typeof amount === 'number' ? amount : 50;
          const n_samples = 44100;
          const curve = new Float32Array(n_samples);
          const deg = Math.PI / 180;
          for (let i = 0; i < n_samples; ++i) {
            const x = (i * 2) / n_samples - 1;
            curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
          }
          return curve;
        };
        waveshaper.curve = makeDistortionCurve(150);
        waveshaper.oversample = '4x';

        const screechGain = ctx.createGain();
        screechGain.gain.setValueAtTime(2.5, now);
        screechGain.gain.exponentialRampToValueAtTime(0.01, now + 2.6);

        carrierOsc.connect(waveshaper);
        waveshaper.connect(screechGain);
        screechGain.connect(ctx.destination);

        // 3. Giant low-end Sub-Bass Roar
        const subOsc = ctx.createOscillator();
        subOsc.type = 'sawtooth';
        subOsc.frequency.setValueAtTime(90, now);
        subOsc.frequency.linearRampToValueAtTime(30, now + 2.0);

        const subGain = ctx.createGain();
        subGain.gain.setValueAtTime(3.0, now);
        subGain.gain.exponentialRampToValueAtTime(0.01, now + 2.7);

        subOsc.connect(subGain);
        subGain.connect(ctx.destination);

        // Start all sound components together!
        noiseSource.start(now);
        carrierOsc.start(now);
        FMModulator.start(now);
        subOsc.start(now);

        // Stop them after 2.8 seconds
        noiseSource.stop(now + 2.8);
        carrierOsc.stop(now + 2.8);
        FMModulator.stop(now + 2.8);
        subOsc.stop(now + 2.8);
      } catch (e) {
        console.warn('Jumpscare audio synthesis failed', e);
      }
    }
    
    // Auto turn off jumpscare & start the post-glitch state
    setTimeout(() => {
      setShowJumpscare(false);
      setIsPostGlitching(true);
      
      // Post-glitch lasts 10 seconds total, then restores previous state
      setTimeout(() => {
        setIsPostGlitching(false);
        setJukeboxVolume(previousVol); // Restore normal volume setting
      }, 10000);
    }, 2500);
  };

  const handleLogoClick = () => {
    const now = Date.now();
    const state = logoClicksRef.current;
    
    if (now - state.lastClick > 600) {
      // Reset if too slow
      state.count = 1;
    } else {
      state.count += 1;
    }
    
    state.lastClick = now;
    
    if (state.count >= 6) {
      state.count = 0;
      triggerJumpscare();
    }
  };

  const playSnareHiss = (duration: number, gainVal: number) => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    if (ctx.state === 'closed') return;

    try {
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = buffer;
      
      const snFilter = ctx.createBiquadFilter();
      snFilter.type = 'highpass';
      snFilter.frequency.setValueAtTime(1200, ctx.currentTime);
      
      const snGain = ctx.createGain();
      snGain.gain.setValueAtTime(gainVal, ctx.currentTime);
      snGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      
      noiseSource.connect(snFilter);
      snFilter.connect(snGain);
      
      if (masterGainRef.current) {
        snGain.connect(masterGainRef.current);
      } else {
        snGain.connect(ctx.destination);
      }
      
      noiseSource.start(ctx.currentTime);
      noiseSource.stop(ctx.currentTime + duration);
    } catch (e) {
      console.warn("Error playing snare hiss:", e);
    }
  };  useEffect(() => {
    if (synthIntervalRef.current) {
      clearInterval(synthIntervalRef.current);
      synthIntervalRef.current = null;
    }

    if (!isJukeboxPlaying || !activeDisc) {
      if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
        audioCtxRef.current.suspend();
      }
      return;
    }

    const isStreamOption = activeDisc.startsWith('http') || activeDisc.startsWith('preset:');

    // Only init synth nodes if not a full audio stream
    if (!isStreamOption) {
      initAudioCtx();
      const ctx = audioCtxRef.current;
      if (ctx) {
        if (!masterGainRef.current) {
          masterGainRef.current = ctx.createGain();
          masterGainRef.current.connect(ctx.destination);
        }
        masterGainRef.current.gain.setValueAtTime(jukeboxVolume, ctx.currentTime);

        if (!filterNodeRef.current) {
          filterNodeRef.current = ctx.createBiquadFilter();
          filterNodeRef.current.type = 'lowpass';
          filterNodeRef.current.frequency.setValueAtTime(900, ctx.currentTime);
          filterNodeRef.current.Q.setValueAtTime(1.0, ctx.currentTime);
          filterNodeRef.current.connect(masterGainRef.current);
        }
      }
    }

    let intervalMs = 260; 
    if (activeDisc === 'pigstep') intervalMs = 319; 
    if (activeDisc === 'chirp') intervalMs = 288; 
    if (isStreamOption) intervalMs = 380; // Gentle visualizer drops for online streams

    const stepRef = { current: 0 };
    const diskColor = activeDisc === 'pigstep' ? '#ef4444' : activeDisc === 'chirp' ? '#22d3ee' : activeDisc === 'cat' ? '#10b981' : '#a855f7';
    const noteChars = ['♩', '♪', '♫', '♬'];

    const tick = () => {
      const step = stepRef.current;
      stepRef.current = (step + 1) % 16;

      if (step % 2 === 0) {
        setActiveNotes(prev => [
          ...prev, 
          {
            id: Date.now() + Math.random(),
            x: (Math.random() - 0.5) * 80, 
            char: noteChars[Math.floor(Math.random() * noteChars.length)],
            color: diskColor
          }
        ].slice(-10));
      }

      if (activeDisc === 'cat') {
        if (step === 0 || step === 1) playSynthNote(110.00, 'triangle', 0.25, 0.4); 
        if (step === 4 || step === 5) playSynthNote(130.81, 'triangle', 0.25, 0.4); 
        if (step === 8 || step === 9) playSynthNote(98.00, 'triangle', 0.25, 0.4);  
        if (step === 12 || step === 13) playSynthNote(87.31, 'triangle', 0.25, 0.4); 

        if (step === 0 || step === 8) {
          playSynthNote(60, 'sine', 0.08, 0.5); 
        }
        if (step === 4 || step === 12) {
          playSnareHiss(0.06, 0.12);
        }

        const melodyNotes: Record<number, number> = {
          0: 523.25,  
          2: 659.25,  
          4: 783.99,  
          6: 880.00,  
          8: 783.99,  
          10: 659.25, 
          12: 587.33, 
          14: 523.25  
        };
        if (melodyNotes[step]) {
          playSynthNote(melodyNotes[step], 'sine', 0.2, 0.3);
          setTimeout(() => {
            if (activeDisc === 'cat') {
              playSynthNote(melodyNotes[step], 'sine', 0.15, 0.1, -10);
            }
          }, 150);
        }
      } 
      else if (activeDisc === 'pigstep') {
        if (step === 0 || step === 2) {
          playSynthNote(73.42, 'sawtooth', 0.35, 0.35, 5); 
          playSynthNote(73.42, 'triangle', 0.35, 0.5);
        }
        if (step === 4 || step === 6) {
          playSynthNote(58.27, 'sawtooth', 0.35, 0.35, 5); 
          playSynthNote(58.27, 'triangle', 0.35, 0.5);
        }
        if (step === 8 || step === 10) {
          playSynthNote(65.41, 'sawtooth', 0.35, 0.35, 5); 
          playSynthNote(65.41, 'triangle', 0.35, 0.5);
        }
        if (step === 12 || step === 14) {
          playSynthNote(49.00, 'sawtooth', 0.35, 0.35, 5); 
          playSynthNote(49.00, 'triangle', 0.35, 0.5);
        }

        if (step === 0 || step === 2 || step === 8 || step === 10) {
          playSynthNote(50, 'sine', 0.15, 0.6); 
        }
        if (step === 4 || step === 12) {
          playSnareHiss(0.12, 0.25); 
        }

        const melodyNotes: Record<number, number> = {
          0: 392.00,  
          3: 466.16,  
          6: 587.33,  
          8: 554.37,  
          11: 466.16, 
          14: 392.00  
        };
        if (melodyNotes[step]) {
          playSynthNote(melodyNotes[step], 'triangle', 0.22, 0.4);
          playSynthNote(melodyNotes[step] * 2, 'sine', 0.1, 0.15);
        }
      } 
      else if (activeDisc === 'chirp') {
        const bassFreqs = [130.81, 196.00, 130.81, 196.00, 110.00, 164.81, 110.00, 164.81]; 
        const bassNode = bassFreqs[Math.floor(step / 2) % bassFreqs.length];
        if (step % 2 === 0) {
          playSynthNote(bassNode, 'triangle', 0.15, 0.5);
        }

        if (step % 4 === 0) {
          playSynthNote(75, 'sine', 0.05, 0.4); 
        }
        if (step % 4 === 2) {
          playSnareHiss(0.04, 0.1); 
        }

        if (step === 0) {
          playSynthNote(261.63, 'sine', 0.5, 0.2);
          playSynthNote(329.63, 'sine', 0.5, 0.2);
          playSynthNote(392.00, 'sine', 0.5, 0.2);
        }
        if (step === 4) {
          playSynthNote(196.00, 'sine', 0.5, 0.2);
          playSynthNote(246.94, 'sine', 0.5, 0.2);
          playSynthNote(293.66, 'sine', 0.5, 0.2);
        }
        if (step === 8) {
          playSynthNote(220.00, 'sine', 0.5, 0.2);
          playSynthNote(261.63, 'sine', 0.5, 0.2);
          playSynthNote(329.63, 'sine', 0.5, 0.2);
        }
        if (step === 12) {
          playSynthNote(174.61, 'sine', 0.5, 0.2);
          playSynthNote(220.00, 'sine', 0.5, 0.2);
          playSynthNote(261.63, 'sine', 0.5, 0.2);
        }

        const melodyNotes: Record<number, number> = {
          2: 523.25,   
          6: 659.25,   
          10: 783.99,  
          14: 1046.50  
        };
        if (melodyNotes[step]) {
          playSynthNote(melodyNotes[step], 'sine', 0.1, 0.25);
          setTimeout(() => {
            if (activeDisc === 'chirp') {
              playSynthNote(melodyNotes[step] * 1.5, 'sine', 0.08, 0.12);
            }
          }, 80);
        }
      }
    };

    tick();
    synthIntervalRef.current = setInterval(tick, intervalMs);

    return () => {
      if (synthIntervalRef.current) {
        clearInterval(synthIntervalRef.current);
      }
    };
  }, [isJukeboxPlaying, activeDisc]);

  // YouTube video extraction and stream player helper
  const getYoutubeId = (url: string): string | null => {
    if (!url) return null;
    try {
      const urlObj = new URL(url);
      if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtube-nocookie.com')) {
        const v = urlObj.searchParams.get('v');
        if (v && v.length === 11) return v;
      }
      if (urlObj.hostname.includes('youtu.be')) {
        const path = urlObj.pathname.substring(1);
        if (path.length === 11) return path;
      }
    } catch (e) {}

    const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/i;
    const match = url.match(regExp);
    if (match && match[2] && match[2].length === 11) {
      return match[2];
    }
    return null;
  };

  const getTwitchChannel = (url: string): string | null => {
    if (!url) return null;
    const twitchRegex = /(?:twitch\.tv\/)([\w]+)/i;
    const match = url.match(twitchRegex);
    if (match && match[1]) {
      return match[1];
    }
    return null;
  };

  const getSpotifyEmbed = (url: string): string | null => {
    if (!url) return null;
    const spotRegex = /open\.spotify\.com\/(track|playlist|album)\/([a-zA-Z0-9]+)/i;
    const match = url.match(spotRegex);
    if (match && match[1] && match[2]) {
      return `https://open.spotify.com/embed/${match[1]}/${match[2]}`;
    }
    return null;
  };

  // Dynamically load the YouTube Iframe Player API script
  useEffect(() => {
    if ((window as any).YT) return;
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    if (firstScriptTag && firstScriptTag.parentNode) {
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    } else {
      document.head.appendChild(tag);
    }
  }, []);

  // Sync YouTube and Spotify IDs from the active disc URL
  useEffect(() => {
    if (!activeDisc) {
      setYoutubeVideoId(null);
      setSpotifyUrl(null);
      return;
    }
    const rawUrl = activeDisc.startsWith('preset:') ? activeDisc.replace('preset:', '') : activeDisc;
    const ytId = getYoutubeId(rawUrl);
    setYoutubeVideoId(ytId);
    
    const spotifyEmbed = getSpotifyEmbed(rawUrl);
    setSpotifyUrl(spotifyEmbed);
  }, [activeDisc]);

  // Main YouTube Player Controller Effect
  useEffect(() => {
    if (!youtubeVideoId) {
      if (ytPlayerRef.current) {
        try {
          ytPlayerRef.current.pauseVideo();
        } catch (e) {
          // ignore
        }
      }
      return;
    }

    const initOrLoadPlayer = () => {
      const YTGlobal = (window as any).YT;
      // If the API hasn't loaded yet, wait slightly and retry
      if (!YTGlobal || !YTGlobal.Player) {
        const retryTimer = setTimeout(initOrLoadPlayer, 200);
        return () => clearTimeout(retryTimer);
      }

      setStreamLoading(true);
      setStreamError(null);

      if (!ytPlayerRef.current) {
        try {
          ytPlayerRef.current = new YTGlobal.Player('youtube-player-element', {
            height: '240',
            width: '360',
            videoId: youtubeVideoId,
            playerVars: {
              autoplay: isJukeboxPlaying ? 1 : 0,
              controls: 0,
              disablekb: 1,
              fs: 0,
              modestbranding: 1,
              rel: 0,
              showinfo: 0,
              origin: window.location.origin
            },
            events: {
              onReady: (event: any) => {
                setStreamLoading(false);
                setYtReady(true);
                try {
                  event.target.unMute();
                  event.target.setVolume(Math.round(jukeboxVolume * 100));
                } catch (volErr) {
                  console.warn("Could not set init volume/unmute", volErr);
                }
                if (isJukeboxPlaying) {
                  event.target.playVideo();
                }
              },
              onStateChange: (event: any) => {
                const state = event.data;
                if (state === YTGlobal.PlayerState.PLAYING) {
                  setStreamLoading(false);
                  setStreamError(null);
                  try {
                    event.target.unMute();
                    event.target.setVolume(Math.round(jukeboxVolume * 100));
                  } catch (volErr) {
                    // ignore
                  }
                } else if (state === YTGlobal.PlayerState.BUFFERING) {
                  setStreamLoading(true);
                }
              },
              onError: (event: any) => {
                setStreamLoading(false);
                setStreamError("YouTube-Wiedergabefehler (GEMA/Urheberrecht oder Einbetten blockiert)");
                console.error("YouTube Player Error Code:", event.data);
              }
            }
          });
        } catch (err) {
          console.error("Failed to construct YouTube player instance:", err);
          setStreamLoading(false);
          setStreamError("Konnte YouTube-Player nicht initialisieren.");
        }
      } else {
        // Player already instantiated, load or cue the video
        try {
          if (isJukeboxPlaying) {
            ytPlayerRef.current.unMute();
            ytPlayerRef.current.setVolume(Math.round(jukeboxVolume * 100));
            ytPlayerRef.current.loadVideoById(youtubeVideoId);
            ytPlayerRef.current.playVideo();
          } else {
            ytPlayerRef.current.cueVideoById(youtubeVideoId);
          }
        } catch (e) {
          console.warn("YouTube player instance stale. Resetting and re-injecting iframe.", e);
          const wrapper = document.getElementById('youtube-player-wrapper');
          if (wrapper) {
            wrapper.innerHTML = '<div id="youtube-player-element" class="w-full h-full"></div>';
          }
          ytPlayerRef.current = null;
          initOrLoadPlayer();
        }
      }
    };

    initOrLoadPlayer();
  }, [youtubeVideoId]);

  // Synchronize Play/Pause states for YouTube playback
  useEffect(() => {
    if (!ytPlayerRef.current || !youtubeVideoId) return;
    try {
      if (isJukeboxPlaying) {
        ytPlayerRef.current.unMute();
        ytPlayerRef.current.setVolume(Math.round(jukeboxVolume * 100));
        ytPlayerRef.current.playVideo();
      } else {
        ytPlayerRef.current.pauseVideo();
      }
    } catch (e) {
      // ignore
    }
  }, [isJukeboxPlaying, youtubeVideoId]);

  // Synchronize Jukebox volume with the YouTube player
  useEffect(() => {
    if (!ytPlayerRef.current) return;
    try {
      ytPlayerRef.current.unMute();
      ytPlayerRef.current.setVolume(Math.round(jukeboxVolume * 100));
    } catch (e) {
      // ignore
    }
  }, [jukeboxVolume]);

  // Resolve or parse playlist/stream URLs dynamically (.m3u, .pls fallback support)
  useEffect(() => {
    let active = true;
    const resolveUrl = async () => {
      if (!activeDisc) {
        setResolvedStreamUrl('');
        setStreamLoading(false);
        setStreamError(null);
        return;
      }

      const rawUrl = activeDisc.startsWith('preset:') ? activeDisc.replace('preset:', '') : activeDisc;
      
      // If it's a YouTube / YouTube Music URL, let the YouTube system handle it
      if (getYoutubeId(rawUrl) !== null) {
        setResolvedStreamUrl('');
        setStreamError(null); // Clear errors, YouTube handles its own loading states
        return;
      }

      const spotifyEmbed = getSpotifyEmbed(rawUrl);
      if (spotifyEmbed) {
        setResolvedStreamUrl('');
        setStreamError(null);
        return;
      }

      const twitchChannel = getTwitchChannel(rawUrl);
      if (twitchChannel) {
        // Resolve twitch stream through backend proxy (which fetches m3u8 and redirects)
        setResolvedStreamUrl(`/api/stream/twitch?channel=${encodeURIComponent(twitchChannel)}`);
        setStreamError(null);
        return;
      }

      const isWebStream = rawUrl.startsWith('http://') || rawUrl.startsWith('https://');

      if (!isWebStream) {
        setResolvedStreamUrl('');
        setStreamError(null);
        setStreamLoading(false);
        return;
      }

      setStreamLoading(true);
      setStreamError(null);

      const normalized = rawUrl.toLowerCase();
      
      // Attempt parsing .m3u, .m3u8, .pls files
      if (normalized.endsWith('.m3u') || normalized.endsWith('.m3u8') || normalized.endsWith('.pls') || normalized.includes('m3u') || normalized.includes('pls')) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 4000);
          
          // Execute playlist text content request through our backend proxy to circumvent client-side CORS policies
          const textProxyUrl = `/api/stream-proxy?url=${encodeURIComponent(rawUrl)}`;
          const res = await fetch(textProxyUrl, { signal: controller.signal });
          clearTimeout(timeoutId);
          
          if (res.ok) {
            const text = await res.text();
            if (normalized.includes('pls')) {
              const match = text.match(/File\d+=(https?:\/\/[^\s\r\n]+)/i);
              if (match && match[1]) {
                if (active) {
                  const finalUrl = match[1];
                  setResolvedStreamUrl(finalUrl.startsWith('https://') ? finalUrl : `/api/stream-proxy?url=${encodeURIComponent(finalUrl)}`);
                }
                return;
              }
            } else {
              const lines = text.split('\n');
              for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#') && (trimmed.startsWith('http://') || trimmed.startsWith('https://'))) {
                  if (active) {
                    setResolvedStreamUrl(trimmed.startsWith('https://') ? trimmed : `/api/stream-proxy?url=${encodeURIComponent(trimmed)}`);
                  }
                  return;
                }
              }
            }
          }
        } catch (err) {
          console.warn("M3U/PLS fetch via proxy failed. Falling back to direct live audio proxy.", err);
        }
      }

      if (active) {
        if (rawUrl.startsWith('https://')) {
          setResolvedStreamUrl(rawUrl);
        } else {
          setResolvedStreamUrl(`/api/stream-proxy?url=${encodeURIComponent(rawUrl)}`);
        }
      }
    };

    resolveUrl();

    return () => {
      active = false;
    };
  }, [activeDisc]);

  // Real-time audio stream controller (HTMLAudioElement) with loading and error events
  useEffect(() => {
    if (!streamAudioRef.current) {
      streamAudioRef.current = new Audio();
    }
    
    const audio = streamAudioRef.current;
    
    try {
      audio.setAttribute("referrerpolicy", "no-referrer");
    } catch (e) {
      // ignore
    }
    
    const handleLoadStart = () => {
      setStreamLoading(true);
      setStreamError(null);
    };
    const handleCanPlay = () => {
      setStreamLoading(false);
    };
    const handlePlaying = () => {
      setStreamLoading(false);
      setStreamError(null);
    };
    const handleError = () => {
      if (!resolvedStreamUrl) return; // Ignore errors if we are not trying to play a stream (like when playing Synth Cat)
      if (audio.src && audio.src.startsWith('data:audio')) return;
      setStreamLoading(false);
      setIsJukeboxPlaying(false);
      let errMsg = "Stream-Fehler (CORS, mixed content oder ungültiges Format)";
      if (audio.error) {
        if (audio.error.code === 1) errMsg = "Wiedergabe abgebrochen.";
        else if (audio.error.code === 2) errMsg = "Netzwerkfehler (Stream offline?).";
        else if (audio.error.code === 3) errMsg = "Audio-Dekodierung fehlgeschlagen.";
        else if (audio.error.code === 4) {
          errMsg = "Format nicht unterstützt oder Stream blockiert.";
        }
      }
      setStreamError(errMsg);
    };

    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('error', handleError);

    if (isJukeboxPlaying && resolvedStreamUrl) {
      if (audio.src !== resolvedStreamUrl) {
        audio.pause();
        audio.src = resolvedStreamUrl;
        audio.load();
      }
      audio.volume = jukeboxVolume;
      audio.play().catch(err => {
        console.warn("Audio play failed, retrying on user interaction:", err);
        setStreamError("Fehler bei Wiedergabe. Klicke Play!");
        setIsJukeboxPlaying(false);
      });
    } else {
      audio.pause();
      setStreamLoading(false);
    }

    return () => {
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('error', handleError);
    };
  }, [isJukeboxPlaying, resolvedStreamUrl]);

  useEffect(() => {
    if (masterGainRef.current && audioCtxRef.current) {
      try {
        masterGainRef.current.gain.setValueAtTime(jukeboxVolume, audioCtxRef.current.currentTime);
      } catch (e) {
        // ignore
      }
    }
    if (streamAudioRef.current) {
      streamAudioRef.current.volume = jukeboxVolume;
    }
  }, [jukeboxVolume]);

  useEffect(() => {
    if (activeNotes.length === 0) return;
    const timer = setTimeout(() => {
      setActiveNotes(prev => prev.slice(1));
    }, 1800);
    return () => clearTimeout(timer);
  }, [activeNotes]);

  useEffect(() => {
    return () => {
      if (synthIntervalRef.current) clearInterval(synthIntervalRef.current);
      if (streamAudioRef.current) {
        streamAudioRef.current.pause();
        streamAudioRef.current = null;
      }
      if (audioCtxRef.current) {
        try {
          audioCtxRef.current.close();
        } catch (e) {
          // ignore
        }
      }
    };
  }, []);

  const handlePotentialDiscDrop = (blockType: string) => {
    const currentUnlocked = [...unlockedDiscs];
    const allDiscs = ['cat', 'pigstep', 'chirp'];
    const locked = allDiscs.filter(d => !currentUnlocked.includes(d));
    if (locked.length === 0) return; 

    let chance = 0.02;
    if (blockType === 'Chest') chance = 0.35; 
    if (blockType === 'Emerald') chance = 0.20;
    if (blockType === 'Diamond') chance = 0.15;
    if (blockType === 'Gold') chance = 0.08;

    if (Math.random() < chance) {
      const chosen = locked[Math.floor(Math.random() * locked.length)];
      const niceName = chosen === 'pigstep' ? 'Pigstep' : 'Chirp';
      unlockDisc(chosen);
      
      const sendSystemMsg = (text: string, title: string = 'SYSTEM') => {
        const now = Date.now();
        const sysMsg: ChatMessage = {
          id: `local-disc-${now}-${Math.random()}`,
          text: text,
          userId: 'system',
          displayName: title,
          role: 'System',
          createdAt: new Date(now),
          isLocal: true,
          localTimestamp: now
        };
        setLocalMessages(prev => [...prev, sysMsg]);
      };

      sendSystemMsg(`§6§l[SCHALLPLATTE]§r Glückwunsch! Du hast die seltene Schallplatte §e"${niceName}"§r beim Minen gefunden! 🎵`, 'JUKEBOX');
      
      const discRewardId = `disc-reward-${Date.now()}`;
      setFloatingRewards(prev => [...prev, {
        id: discRewardId,
        text: `🎵 ${niceName} GEFUNDEN!`,
        x: window.innerWidth / 2,
        y: window.innerHeight / 2 - 100,
        color: chosen === 'pigstep' ? '#ef4444' : '#22d3ee'
      }]);
      setTimeout(() => {
        setFloatingRewards(prev => prev.filter(r => r.id !== discRewardId));
      }, 4000);
    }
  };

  const [pixelGrid, setPixelGrid] = useState<string[]>(Array(64).fill('#000000'));
  const [brushColor, setBrushColor] = useState('#ff0000');
  const [pvpStatus, setPvpStatus] = useState<ServerStatus>({ online: true, playerCount: 0, maxPlayers: 10 });
  const [survivalStatus, setSurvivalStatus] = useState<ServerStatus>({ online: true, playerCount: 0, maxPlayers: 10 });
  const [showAdmin, setShowAdmin] = useState(false);
  const [discordData, setDiscordData] = useState<{ online_count: number; members: any[] } | null>(null);

  // Chat State
  const [chatOpen, setChatOpen] = useState(false);
  const [newsOpen, setNewsOpen] = useState(false);
  const [pollsOpen, setPollsOpen] = useState(false);
  const [botpressOpen, setBotpressOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash;
    return (
      params.get('bot') === 'true' || 
      params.get('info') === 'true' || 
      params.get('support') === 'true' || 
      hash === '#bot' || 
      hash === '#info' || 
      hash === '#support'
    );
  });
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);

  const combinedMessages = useMemo(() => {
    if (hasQuotaExceeded && chatMessages.length === 0) return localMessages;
    
    // Create a Map to track unique messages by tempId and fallback to id
    // This handles duplicates produced by Firestore retries and ensures stable keys
    const messageMap = new Map<string, ChatMessage>();
    
    // Process server messages first (they take priority)
    chatMessages.forEach(msg => {
      // Use tempId specifically for deduplication if it exists (for send-to-confirmed transition)
      // Otherwise use the unique Firestore document ID
      const key = msg.tempId || msg.id;
      if (key) {
        const existing = messageMap.get(key);
        // Only overwrite if the new message has a proper server timestamp (is more authoritative)
        if (!existing || (!existing.createdAt && msg.createdAt)) {
          messageMap.set(key, msg);
        }
      }
    });
    
    // Add local messages that aren't confirmed/synced yet
    localMessages.forEach(lm => {
      const key = lm.tempId || lm.id;
      if (key && !messageMap.has(key)) {
        messageMap.set(key, lm);
      }
    });

    const combined = Array.from(messageMap.values());

    return combined.sort((a, b) => {
      const getTime = (ca: any, localTs?: number) => {
        if (!ca) return localTs || Date.now();
        if (ca.seconds) return ca.seconds * 1000;
        if (ca instanceof Date) return ca.getTime();
        if (typeof ca === 'string') return new Date(ca).getTime();
        if (typeof ca === 'number') return ca;
        try { if (ca.toDate) return ca.toDate().getTime(); } catch (e) {}
        return localTs || 0;
      };
      return getTime(a.createdAt, a.localTimestamp) - getTime(b.createdAt, b.localTimestamp);
    });
  }, [chatMessages, localMessages, hasQuotaExceeded]);

  const [chatChannel, setChatChannel] = useState<'allgemein' | 'quiz' | 'bilder'>('allgemein');

  const filteredMessages = useMemo(() => {
    return combinedMessages.filter(msg => {
      const text = msg.text || '';
      const isQuizRelated = msg.channel === 'quiz' || msg.userId === 'quiz_bot' || text.includes('QUIZFRAGE') || text.includes('Richtig!') || text.includes('gelöst');
      const isImage = !!msg.imageUrl || msg.channel === 'bilder';
      
      if (chatChannel === 'quiz') {
        return isQuizRelated;
      } else if (chatChannel === 'bilder') {
        return isImage;
      } else {
        return !isQuizRelated && msg.channel !== 'quiz' && !isImage && msg.channel !== 'bilder';
      }
    });
  }, [combinedMessages, chatChannel]);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [shopLogs, setShopLogs] = useState<any[]>([]);
  const [myPurchases, setMyPurchases] = useState<any[]>([]);
  const [shopOpen, setShopOpen] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [expandedSuggestionComments, setExpandedSuggestionComments] = useState<Record<string, boolean>>({});
  const [suggestionsSort, setSuggestionsSort] = useState<'score' | 'newest' | 'comments'>('score');
  const [suggestionsTagFilter, setSuggestionsTagFilter] = useState<string>('All');
  const [chatGuestName, setChatGuestName] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('suggestions_guest_name') || '';
  });
  
  const filteredAndSortedSuggestions = useMemo(() => {
    let result = [...suggestions];
    // 1. Filter by tag
    if (suggestionsTagFilter !== 'All') {
      result = result.filter(sug => sug.tag === suggestionsTagFilter);
    }
    // 2. Sort
    result.sort((a, b) => {
      if (suggestionsSort === 'score') {
        const scoreA = (a.upvotes || 0) - (a.downvotes || 0);
        const scoreB = (b.upvotes || 0) - (b.downvotes || 0);
        if (scoreB !== scoreA) return scoreB - scoreA;
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      } else if (suggestionsSort === 'newest') {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      } else if (suggestionsSort === 'comments') {
        const commentsA = (a.comments || []).length;
        const commentsB = (b.comments || []).length;
        if (commentsB !== commentsA) return commentsB - commentsA;
        const scoreA = (a.upvotes || 0) - (a.downvotes || 0);
        const scoreB = (b.upvotes || 0) - (b.downvotes || 0);
        return scoreB - scoreA;
      }
      return 0;
    });
    return result;
  }, [suggestions, suggestionsSort, suggestionsTagFilter]);
  const [devLabsOpen, setDevLabsOpen] = useState(false);
  const [devLabsTab, setDevLabsTab] = useState<'rust' | 'flutter'>('rust');
  const [showLogs, setShowLogs] = useState(false);
  const [showMyItems, setShowMyItems] = useState(false);
  const [showMiningModal, setShowMiningModal] = useState(false);
  const [miningTab, setMiningTab] = useState<'mines' | 'world' | 'quiz' | 'clash'>('mines');
  const [isRefreshingProfiles, setIsRefreshingProfiles] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState<{
    question: string;
    reward: number;
    active: boolean;
    answers?: string[];
    winningUser?: string | null;
    winningUid?: string | null;
    createdAt?: any;
  } | null>(null);

  // Floating Toast Notification System
  interface AppToast {
    id: string;
    type: 'quest' | 'xp' | 'level';
    title: string;
    description: string;
    amount?: number;
    questTitle?: string;
    percent?: number;
  }

  const [toasts, setToasts] = useState<AppToast[]>([]);

  const triggerToast = (type: 'quest' | 'xp' | 'level', title: string, description: string, options?: Partial<AppToast>) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const newToast: AppToast = { id, type, title, description, ...options };
    setToasts(prev => [...prev.slice(-3), newToast]); // Shows max 4 toasts at the same time
    
    // Play beautiful theme acoustic Note-Block feedback
    if (type === 'level') {
      playAppSound('levelUp');
    } else if (type === 'xp') {
      playAppSound('exp');
    } else {
      playAppSound('pop');
    }

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  const generateNewQuizQuestionLocally = async () => {
    try {
      const randQuiz = clientQuizQuestions[Math.floor(Math.random() * clientQuizQuestions.length)];
      
      await setDoc(doc(db, 'app_config', 'active_quiz'), {
        question: randQuiz.question,
        answers: randQuiz.answers,
        reward: 50,
        active: true,
        createdAt: serverTimestamp(),
        winningUser: null,
        winningUid: null
      });

      // Post New Question to Chat
      await addDoc(collection(db, 'chat_messages'), {
        text: `💡 **NEUE QUIZFRAGE:** ${randQuiz.question} 🤔 (Tippe die Antwort als Erste/r in den Chat für **50 Coins**!)`,
        userId: 'quiz_bot',
        displayName: '💡 Quiz-Bot',
        role: 'System',
        createdAt: serverTimestamp(),
        tempId: `quiz-new-${Date.now()}-${Math.random()}`
      });

      console.log('[QUIZ-CLIENT] Neue Frage erfolgreich generiert:', randQuiz.question);
    } catch (err) {
      console.error('[QUIZ-CLIENT] Fehler beim Generieren einer neuen Frage:', err);
    }
  };

  const processQuizVictoryLocally = async (displayName: string, userId: string, answer: string, currentQuiz: any) => {
    try {
      // 1. Mark quiz as inactive in DB (prevents double winning)
      const quizRef = doc(db, 'app_config', 'active_quiz');
      await setDoc(quizRef, {
        active: false,
        winningUser: displayName,
        winningUid: userId,
        solvedAt: serverTimestamp(),
        question: currentQuiz.question,
        answer: answer,
        reward: currentQuiz.reward || 50,
        answers: currentQuiz.answers || []
      });

      // 2. Increment stats of winning user safely
      const userRef = doc(db, 'user_profiles', userId);
      await updateDoc(userRef, {
        coins: increment(currentQuiz.reward || 50),
        quizWins: increment(1)
      });

      // 3. Post notification to global chat under 'quiz_bot' identity
      let customAnnouncement = `🏆 **Richtig!** **${displayName}** hat die Quizfrage am schnellsten beantwortet: "*${currentQuiz.question}*" ➜ **${answer.toUpperCase()}**! (+50 Coins 🪙)`;
      const cleanAnswer = answer.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "").replace(/\s+/g, '').trim();
      if (currentQuiz.question.includes("Obsidian") && currentQuiz.question.includes("Werkzeug") && currentQuiz.question.includes("schnellsten")) {
        if (cleanAnswer.includes("netherit")) {
          customAnnouncement = `🏆 **Richtig!** **${displayName}** hat die Quizfrage am schnellsten beantwortet: "*${currentQuiz.question}*" ➜ **${answer.toUpperCase()}**! (+50 Coins 🪙) *– Absolut korrekt! Netherit ist tatsächlich noch flinker als Diamant! ✨*`;
        } else if (cleanAnswer.includes("diamant")) {
          customAnnouncement = `🏆 **Richtig!** **${displayName}** hat die Quizfrage am schnellsten beantwortet: "*${currentQuiz.question}*" ➜ **${answer.toUpperCase()}**! (+50 Coins 🪙) *– Korrekt! Diamant ist super, aber mit Netherit geht es sogar noch ein bisschen schneller! ⛏️*`;
        }
      }

      await addDoc(collection(db, 'chat_messages'), {
        text: customAnnouncement,
        userId: 'quiz_bot',
        displayName: '💡 Quiz-Bot',
        role: 'System',
        createdAt: serverTimestamp(),
        tempId: `quiz-win-${Date.now()}-${Math.random().toString(36).substring(7)}`
      });

      console.log('[QUIZ-BOT CLIENT] Victory successfully processed and synchronized!');
    } catch (err) {
      console.error('[QUIZ-BOT CLIENT] Error writing victory:', err);
    }
  };

  const getLevel = (xp: number = 0) => Math.floor(Math.sqrt(xp / 100)) + 1;

  const prevXpRef = useRef<number | null>(null);
  const prevLevelRef = useRef<number | null>(null);

  useEffect(() => {
    if (!myProfile) {
      prevXpRef.current = null;
      prevLevelRef.current = null;
      return;
    }

    const currentXp = myProfile.xp || 0;
    const currentLevel = getLevel(currentXp);

    if (prevXpRef.current !== null && prevLevelRef.current !== null) {
      const xpDifference = currentXp - prevXpRef.current;
      const levelDifference = currentLevel - prevLevelRef.current;

      if (levelDifference > 0) {
        triggerToast(
          'level',
          '🔥 LEVEL UP! 🎉',
          `Glückwunsch! Du hast Level ${currentLevel} erreicht!`,
          { amount: currentLevel }
        );
      } else if (xpDifference >= 20) {
        triggerToast(
          'xp',
          '✨ ERFAHRUNG GEWONNEN!',
          `Du hast +${xpDifference} XP erhalten! Mach weiter so!`,
          { amount: xpDifference }
        );
      }
    }

    prevXpRef.current = currentXp;
    prevLevelRef.current = currentLevel;
  }, [myProfile?.xp]);

  useEffect(() => {
    setQuotaListener(() => {
      setHasQuotaExceeded(prev => {
        if (!prev) {
          console.error("GLOBAL QUOTA LIMIT REACHED - Stopping database listeners");
        }
        return true;
      });
    });
  }, []);
  const [floatingRewards, setFloatingRewards] = useState<{ id: string | number, text: string, x: number, y: number, color: string }[]>([]);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [leaderboardTab, setLeaderboardTab] = useState<'coins' | 'quiz' | 'transactions'>('coins');
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [lastLeaderboardFetch, setLastLeaderboardFetch] = useState<number>(0);
  const [transactionsList, setTransactionsList] = useState<any[]>([]);
  const [txSearchQuery, setTxSearchQuery] = useState<string>('');

  const fetchLeaderboard = async (tabOverride?: 'coins' | 'quiz' | 'transactions', force: boolean = false) => {
    const activeTab = tabOverride || leaderboardTab;
    const isTabChange = tabOverride && tabOverride !== leaderboardTab;
    if (!force && !isTabChange && Date.now() - lastLeaderboardFetch < 30000 && (activeTab === 'transactions' ? transactionsList.length > 0 : leaderboardData.length > 0)) return;
    
    if (activeTab === 'transactions') {
      try {
        const txQuery = query(collection(db, 'coin_transactions'), orderBy('createdAt', 'desc'), limit(100));
        const txSnap = await getDocs(txQuery);
        const txData = txSnap.docs.map(doc => ({
          ...doc.data(),
          id: doc.id,
          createdAt: doc.data().createdAt?.toDate() || new Date()
        }));
        setTransactionsList(txData);
        setLastLeaderboardFetch(Date.now());
      } catch (txErr: any) {
        if (txErr.message?.includes('Quota')) setHasQuotaExceeded(true);
        console.error("Transactions fetch error:", txErr);
      }
    } else {
      setLeaderboardData([]); // clear to trigger loading spinner
      try {
        let q;
        if (activeTab === 'quiz') {
          q = query(collection(db, 'user_profiles'), orderBy('quizWins', 'desc'), limit(50));
        } else {
          q = query(collection(db, 'user_profiles'), orderBy('coins', 'desc'), limit(50));
        }
        const snap = await getDocs(q);
        const rawData = snap.docs.map(doc => ({ ...(doc.data() as any), id: doc.id } as any));
        
        const seenNames = new Set<string>();
        const seenUserIds = new Set<string>();
        const dedupedData: UserProfile[] = [];
        
        rawData.forEach(profile => {
          const userId = profile.userId || profile.id;
          const nameKey = (profile.minecraftUsername || profile.displayName || userId || '').trim().toLowerCase();
          
          if (userId && !seenUserIds.has(userId) && nameKey && !seenNames.has(nameKey)) {
            seenUserIds.add(userId);
            seenNames.add(nameKey);
            dedupedData.push(profile);
          }
        });

        setLeaderboardData(dedupedData);
        setLastLeaderboardFetch(Date.now());
      } catch (err: any) {
        if (err.message?.includes('Quota')) setHasQuotaExceeded(true);
        console.error("Leaderboard fetch error:", err);
      }
    }
  };

  // Optimized fetch functions
  const fetchServerStatus = async () => {
    try {
      const pvpSnap = await getDoc(doc(db, 'server_status', 'pvp'));
      if (pvpSnap.exists()) setPvpStatus(pvpSnap.data() as any);
      
      const survivalSnap = await getDoc(doc(db, 'server_status', 'survival'));
      if (survivalSnap.exists()) setSurvivalStatus(survivalSnap.data() as any);
    } catch (err: any) {
      if (err.message?.includes('Quota')) setHasQuotaExceeded(true);
      handleFirestoreError(err, OperationType.GET, 'server_status');
    }
  };

  const fetchOnlinePlayers = async () => {
    try {
      const playersQuery = query(collection(db, 'online_players'), limit(50));
      const snapshot = await getDocs(playersQuery);
      setPlayers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
    } catch (err: any) {
      if (err.message?.includes('Quota')) setHasQuotaExceeded(true);
      handleFirestoreError(err, OperationType.GET, 'online_players');
    }
  };

  const fetchRealmCodes = async () => {
    try {
      const snap = await getDoc(doc(db, 'app_config', 'realm_codes'));
      if (snap.exists()) setRealmCodes(snap.data() as any);
    } catch (err: any) {
      if (err.message?.includes('Quota')) setHasQuotaExceeded(true);
      handleFirestoreError(err, OperationType.GET, 'app_config/realm_codes');
    }
  };

  // Optimization: Fetch profiles manually to save quota
  const fetchProfiles = async () => {
    if (hasQuotaExceeded) return;
    setIsRefreshingProfiles(true);
    try {
      const profilesQuery = query(collection(db, 'user_profiles'), orderBy('updatedAt', 'desc'), limit(50));
      const snapshot = await getDocs(profilesQuery);
      const profiles = snapshot.docs.map(doc => doc.data() as UserProfile);
      setUserProfiles(profiles);
      // Cache profiles briefly in memory (already in state)
    } catch (err: any) {
      if (err.message?.includes('Quota')) setHasQuotaExceeded(true);
      handleFirestoreError(err, OperationType.GET, 'user_profiles');
    } finally {
      setIsRefreshingProfiles(false);
    }
  };

  const fetchClans = async () => {
    if (hasQuotaExceeded) return;
    try {
      const clansSnap = await getDocs(collection(db, 'clans'));
      setClans(clansSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Clan)));
    } catch (err: any) {
      if (err.message.includes('Quota')) setHasQuotaExceeded(true);
    }
  };

  const fetchNews = async () => {
    if (hasQuotaExceeded) return;
    try {
      const newsSnap = await getDocs(query(collection(db, 'news'), orderBy('createdAt', 'desc'), limit(5)));
      setNews(newsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as NewsItem)));
    } catch (err: any) {
      if (err.message.includes('Quota')) setHasQuotaExceeded(true);
    }
  };

  const fetchPolls = async () => {
    if (hasQuotaExceeded) return;
    try {
      const pollsSnap = await getDocs(query(collection(db, 'polls'), orderBy('createdAt', 'desc'), limit(5)));
      setPolls(pollsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Poll)));
    } catch (err: any) {
      if (err.message.includes('Quota')) setHasQuotaExceeded(true);
    }
  };

  const fetchSuggestions = async () => {
    if (hasQuotaExceeded) return;
    try {
      const suggestSnap = await getDocs(query(collection(db, 'suggestions'), limit(100)));
      const items = suggestSnap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          upvotes: data.upvotes ?? 0,
          upvotedBy: data.upvotedBy ?? [],
          downvotes: data.downvotes ?? 0,
          downvotedBy: data.downvotedBy ?? [],
          comments: data.comments ?? [],
          tag: data.tag ?? 'Sonstiges'
        } as Suggestion;
      });
      items.sort((a, b) => {
        const scoreA = (a.upvotes || 0) - (a.downvotes || 0);
        const scoreB = (b.upvotes || 0) - (b.downvotes || 0);
        if (scoreB !== scoreA) return scoreB - scoreA;
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
      setSuggestions(items);
    } catch (err: any) {
      if (err.message.includes('Quota')) setHasQuotaExceeded(true);
    }
  };

  const fetchShop = async () => {
    if (hasQuotaExceeded) return;
    try {
      const shopSnap = await getDocs(query(collection(db, 'shop'), orderBy('price', 'asc')));
      const dbItems = shopSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShopItem));
      
      const defaultItems: ShopItem[] = [
        { id: 'rank_vip', name: 'VIP Rang', description: 'Goldener Name & exklusive Features', price: 5000, category: 'Ränge', isActive: true, createdAt: null },
        { id: 'rank_mvp', name: 'MVP Rang', description: 'Der ultimative Rang mit 5.000 Coins Daily Bonus!', price: 25000, category: 'Ränge', isActive: true, createdAt: null },
        
        { id: 'pickaxe_wood', name: 'Holzspitzhacke', description: 'Standard-Equipment (Power: 1)', price: 100, category: 'Ausrüstung', isActive: true, createdAt: null },
        { id: 'pickaxe_iron', name: 'Eisenspitzhacke', description: 'Bessere Haltbarkeit & Speed (Power: 2)', price: 2500, category: 'Ausrüstung', isActive: true, createdAt: null },
        { id: 'pickaxe_diamond', name: 'Diamantspitzhacke', description: 'Die schärfste Klinge (Power: 4)', price: 15000, category: 'Ausrüstung', isActive: true, createdAt: null },
        { id: 'pickaxe_netherite', name: 'Netheritspitzhacke', description: 'Göttergleicher Speed (Power: 8)', price: 75000, category: 'Ausrüstung', isActive: true, createdAt: null },

        { id: 'amulet_god', name: 'Götter-Amulett', description: 'Erhöht die Chance auf seltene Erze (Luck: +5)', price: 10000, category: 'Ausrüstung', isActive: true, createdAt: null },
        { id: 'boost_xp', name: 'Erfahrungs-Boost', description: 'Du erhältst +50% mehr XP beim Mining', price: 15000, category: 'Ausrüstung', isActive: true, createdAt: null },
        { id: 'vote_key_1', name: '1x Vote-Key', description: 'Öffne Cases am Spawn!', price: 50, category: 'Items', isActive: true, createdAt: null },
        { id: 'vote_key_10', name: '10x Vote-Keys', description: 'Das Sparpaket für Key-Jäger!', price: 400, category: 'Items', isActive: true, createdAt: null },


        { id: 'glow_red', name: 'Rotes Glühen', description: 'Glow: red. Profilbox leuchtet im feurigen Rot!', price: 1500, category: 'Farben', isActive: true, createdAt: null },
        { id: 'glow_blue', name: 'Blaues Glühen', description: 'Glow: blue. Profilbox leuchtet im mystischen Aquamarin-Blau!', price: 1500, category: 'Farben', isActive: true, createdAt: null },
        { id: 'glow_gold', name: 'Goldenes Glühen', description: 'Glow: gold. Königlicher Schein für dich und dein Profil!', price: 3000, category: 'Farben', isActive: true, createdAt: null },
        { id: 'glow_green', name: 'Grünes Glühen', description: 'Glow: green. Giftig-grünes Smaragd-Schimmern!', price: 1500, category: 'Farben', isActive: true, createdAt: null },
        { id: 'glow_purple', name: 'Lila Glühen', description: 'Glow: purple. Magisches violettes Schimmern!', price: 2000, category: 'Farben', isActive: true, createdAt: null }
      ];

      const merged = [...dbItems];
      const dbNames = new Set(dbItems.map(i => (i.name || '').toLowerCase().trim()));
      
      defaultItems.forEach(defItem => {
        if (!dbNames.has(defItem.name.toLowerCase().trim())) {
          merged.push(defItem);
        }
      });
      
      merged.sort((a, b) => a.price - b.price);
      setShopItems(merged);
    } catch (err: any) {
      if (err.message.includes('Quota')) setHasQuotaExceeded(true);
    }
  };

  const [miningShake, setMiningShake] = useState(0);
  const [hitFeedback, setHitFeedback] = useState(false);
  const [coinsPerSecond, setCoinsPerSecond] = useState(0);

  useEffect(() => {
    setCoinsPerSecond(myProfile?.mining?.cps ?? 0);
  }, [myProfile?.mining?.cps]);

  // Mining Game State
  const [miningBlock, setMiningBlock] = useState<{ id: string, type: 'Stone' | 'Coal' | 'Iron' | 'Gold' | 'Diamond' | 'Emerald' | 'TNT' | 'Chest', health: number, maxHealth: number }>({ id: 'initial', type: 'Stone', health: 10, maxHealth: 10 });
  const [miningParticles, setMiningParticles] = useState<{ id: string; x: number; y: number; color: string; vx: number; vy: number }[]>([]);
  const [pickaxeSwing, setPickaxeSwing] = useState(false);
  const [miningLevel, setMiningLevel] = useState(1);
  const [miningStats, setMiningStats] = useState({ totalBroken: 0, diamondsFound: 0 });
  const [optimisticCoins, setOptimisticCoins] = useState<number | null>(null);
  const [optimisticXp, setOptimisticXp] = useState<number | null>(null);

  const pendingCpsCoinsRef = useRef<number>(0);
  const pendingCpsXpRef = useRef<number>(0);

  const [miningCombo, setMiningCombo] = useState(0);
  const [miningMultiplier, setMiningMultiplier] = useState(1);
  const comboTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showStaffSection, setShowStaffSection] = useState(false);
  const [openingBox, setOpeningBox] = useState<{ isOpen: boolean; item: ShopItem | null; clicks: number; rarity: 'Standard' | 'Selten' | 'EPIK' | 'LEGENDÄR' }>({
    isOpen: false,
    item: null,
    clicks: 0,
    rarity: 'Standard'
  });

  // Clan State
  const [clans, setClans] = useState<Clan[]>([]);
  const invitedClan = clans.find(c => c.id === invitedClanId);
  const [myClan, setMyClan] = useState<Clan | null>(null);
  const [clanMembers, setClanMembers] = useState<ClanMember[]>([]);
  const [showCreateClan, setShowCreateClan] = useState(false);
  const [activeClanId, setActiveClanId] = useState<string | null>(null);
  const [isClansOpen, setIsClansOpen] = useState(false);
  const [clanChatMessages, setClanChatMessages] = useState<ChatMessage[]>([]);
  const [clanChatInput, setClanChatInput] = useState('');
  const [clanTab, setClanTab] = useState<'members' | 'chat' | 'perks' | 'requests' | 'quests' | 'stats'>('members');
  const [clanRequests, setClanRequests] = useState<ClanJoinRequest[]>([]);
  const [clanQuests, setClanQuests] = useState<ClanQuest[]>([]);

  // Tracks and triggers floating toast notifications for clan quest updates
  const prevQuestsRef = useRef<Record<string, { current: number, completed: boolean }>>({});

  useEffect(() => {
    if (!clanQuests || clanQuests.length === 0) {
      prevQuestsRef.current = {};
      return;
    }

    clanQuests.forEach((quest) => {
      const prev = prevQuestsRef.current[quest.id];
      const nextCurrent = quest.current;
      const nextCompleted = quest.completed;

      if (prev) {
        if (nextCompleted && !prev.completed) {
          triggerToast(
            'quest',
            '🎯 QUEST ABGESCHLOSSEN!',
            `Die Clan Quest "${quest.title}" wurde erfolgreich abgeschlossen. (+${quest.rewardXp} Clan-XP)`,
            { percent: 100 }
          );
        } else if (nextCurrent !== prev.current) {
          const prevPercent = Math.floor((prev.current / quest.goal) * 100);
          const nextPercent = Math.floor((nextCurrent / quest.goal) * 100);

          const milestones = [25, 50, 75, 90];
          const milestonePassed = milestones.find(m => prevPercent < m && nextPercent >= m);

          if (milestonePassed) {
            triggerToast(
              'quest',
              '🎯 MEILENSTEIN ERREICHT!',
              `Quest "${quest.title}" Fortschritt: ${nextCurrent}/${quest.goal} (${nextPercent}%)`,
              { percent: nextPercent, questTitle: quest.title }
            );
          }
        }
      }

      prevQuestsRef.current[quest.id] = { current: nextCurrent, completed: nextCompleted };
    });
  }, [clanQuests]);

  const [isJoinRequestModalOpen, setIsJoinRequestModalOpen] = useState(false);
  const [visitorInfo, setVisitorInfo] = useState<any>(null);
  const [showCommandMenu, setShowCommandMenu] = useState(false);
  
  // AI Helper State
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isFabMenuOpen, setIsFabMenuOpen] = useState(false);
  const [aiHistory, setAiHistory] = useState<GeminiChatMessage[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const aiChatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (aiChatEndRef.current) {
      aiChatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [aiHistory]);

  const handleAiChat = async (input?: string) => {
    const text = input || aiInput;
    if (!text.trim() || isAiLoading) return;

    // Play magical oracle summoning sounds
    try {
      initAudioCtx();
      playSynthNote(330, 'sine', 0.12, 0.2); // Mi (330Hz)
      setTimeout(() => playSynthNote(440, 'sine', 0.18, 0.2), 100); // La (440Hz)
    } catch (e) {
      // Audio fallback silent
    }

    const userMsg: GeminiChatMessage = { role: 'user', parts: [{ text }] };
    const newHistory = [...aiHistory, userMsg];
    
    setAiHistory(newHistory);
    setAiInput('');
    setIsAiLoading(true);

    try {
      const response = await getGeminiResponse(text, aiHistory);
      setAiHistory(prev => [...prev, { role: 'model', parts: [{ text: response || 'Entschuldige, ich habe gerade eine Vision blockiert...' }] }]);
      
      // Play magical arpeggio sound sequence on successful response
      try {
        initAudioCtx();
        playSynthNote(523.25, 'sine', 0.1, 0.15); // C5
        setTimeout(() => playSynthNote(659.25, 'sine', 0.1, 0.15), 80); // E5
        setTimeout(() => playSynthNote(783.99, 'sine', 0.12, 0.15), 160); // G5
        setTimeout(() => playSynthNote(1046.50, 'sine', 0.2, 0.2), 240); // C6
      } catch (ae) {}
    } catch (err) {
      setAiHistory(prev => [...prev, { role: 'model', parts: [{ text: '⚠️ [ERROR] Die Geister sind gerade unruhig. Versuche es später erneut.' }] }]);
      // Play warning low chord on failure
      try {
        initAudioCtx();
        playSynthNote(180, 'sawtooth', 0.4, 0.2);
      } catch (ae) {}
    } finally {
      setIsAiLoading(false);
    }
  };

  const [surveillanceExpanded, setSurveillanceExpanded] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);

  // Emergency Fallback: If Firebase is dead, we fetch basic info from our own server
  const fetchEmergencyConfig = async () => {
    try {
      // Use full URL if provided via env, otherwise fallback to local /api
      const target = import.meta.env.VITE_EMERGENCY_CONFIG_URL || '/api/emergency-config';
      const res = await fetch(target);
      if (!res.ok) return; // Silent skip
      const data = await res.json();
      if (data) {
        setIsMaintenanceMode(prev => data.maintenanceMode !== undefined ? data.maintenanceMode : prev);
        setRealmCodes(prev => data.realmCodes ? { ...prev, ...data.realmCodes } : prev);
      }
    } catch (e) {
      // Silently fail, it's just a fallback
    }
  };

  const updateEmergencyConfig = async (update: any) => {
    try {
      await fetch('/api/emergency-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update)
      });
    } catch (e) {
      console.error('Failed to update emergency config', e);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        // 1. Initial check: Is Firebase working?
        const isFbWorking = await testFirestoreConnection();
        if (!isFbWorking) {
          console.warn('⚠️ [SYSTEM] Firebase offline or quota reached. Activating emergency fallback...');
          setIsMaintenanceMode(true);
          fetchEmergencyConfig();
        } else {
          // Firebase works
          setIsMaintenanceMode(false);
          fetchEmergencyConfig();
        }
      } catch (err) {
        console.error('Initialization failed:', err);
      }
    };
    init();

    // Suppress Vite HMR WebSocket errors in the console to avoid user confusion
    const originalError = console.error;
    const originalWarn = console.warn;

    console.error = (...args: any[]) => {
      if (args[0]?.toString().includes('WebSocket') || args[0]?.toString().includes('vite')) return;
      originalError.apply(console, args);
    };

    console.warn = (...args: any[]) => {
      if (args[0]?.toString().includes('Firebase Quota Hit')) return;
      originalWarn.apply(console, args);
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      if (event.reason?.message?.includes('WebSocket')) {
        event.preventDefault();
      }
    };
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      console.error = originalError;
      console.warn = originalWarn;
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallButton(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallButton(false);
    }
    setDeferredPrompt(null);
  };

  // Constants
  const DISCORD_GUILD_ID = import.meta.env.VITE_DISCORD_GUILD_ID || '1451980583969230882'; 
  const WEBHOOK_URL = (import.meta as any).env.VITE_DISCORD_WEBHOOK_URL;

  // Discord Notifier (System-Logs / Security)
  const notifyDiscord = async (title: string, message: string, color: number = 16711680, fields: { name: string, value: string, inline?: boolean }[] = [], thumbnail?: string) => {
    if (!WEBHOOK_URL) return;
    try {
      await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: "MC HUB Security",
          avatar_url: "https://i.imgur.com/8nNf9u8.png",
          embeds: [{
            title: title,
            description: message,
            color: color,
            fields: fields.length > 0 ? fields : undefined,
            timestamp: new Date().toISOString(),
            footer: { 
              text: `🛡️ MC HUB ANTIGRIEF | ${window.location.hostname}`,
              icon_url: 'https://i.imgur.com/8fGz3pP.png'
            },
            thumbnail: { url: thumbnail || auth.currentUser?.photoURL || 'https://i.imgur.com/8fGz3pP.png' },
            author: {
              name: auth.currentUser?.displayName || "Anonymer Besucher",
              icon_url: auth.currentUser?.photoURL || 'https://i.imgur.com/8fGz3pP.png'
            }
          }]
        })
      });
    } catch (e) {
      console.warn("Discord Log failed", e);
    }
  };

  // Dedicated function for Player Status Webhook
  const updateDiscordStatus = async () => {
    const statusWebhook = import.meta.env.VITE_DISCORD_STATUS_WEBHOOK;
    if (!statusWebhook) return;

    const totalOnline = players.length;
    const pvpCount = players.filter(p => p.server === 'pvp').length;
    const survivalCount = players.filter(p => p.server === 'survival').length;

    try {
      await fetch(statusWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: "MC HUB Server-Agent",
          avatar_url: "https://i.imgur.com/8nNf9u8.png",
          embeds: [{
            title: "📊 SERVER-STATUS UPDATE",
            description: `**${totalOnline}** Mitglieder sind aktuell auf der Plattform aktiv.`,
            color: 3447003, // Blue-ish
            thumbnail: { url: "https://i.imgur.com/8nNf9u8.png" },
            fields: [
              { name: "⚔️ PvP Realm", value: `\`${pvpCount} Spieler\``, inline: true },
              { name: "🌲 Survival", value: `\`${survivalCount} Spieler\``, inline: true },
              { name: "🔗 Website", value: `[Dashboard öffnen](https://${window.location.hostname})`, inline: false }
            ],
            footer: { text: "MC HUB - Echtzeit Community Monitoring" },
            timestamp: new Date().toISOString()
          }]
        })
      });
    } catch (err) {
      console.warn("Discord Status update failed", err);
    }
  };

  // Fetch IP and Location Info (ULTRA-VECTOR TRACE)
  const trackVisitor = async (isManualUpdate = false) => {
    try {
      // Vector Alpha: Detailed Geo-IP (ipapi)
      const timeoutSignal = AbortSignal?.timeout ? AbortSignal.timeout(6000) : undefined;
      const res1 = await fetch('https://ipapi.co/json/', { signal: timeoutSignal });
      const data1 = res1.ok ? await res1.json() : null;
      
      // Vector Beta: Direct RAW IP (ipify)
      const res2 = await fetch('https://api.ipify.org?format=json');
      const data2 = res2.ok ? await res2.json() : null;

      // Vector Gamma: System Meta
      const confirmedIp = data2?.ip || data1?.ip || 'Verborgen';
      const geoIp = data1?.ip || 'Pending...';
      
      setVisitorInfo(data1 || { ip: confirmedIp, city: 'Scanning...', region: '...', country_name: '...', org: '...' });
      
      // Detailed Discord Logging
      const isBot = /bot|spider|crawl|slurp|google|bing|yandex|duckduck|baidu|meta|twitter|discord/i.test(navigator.userAgent);
      
      const eventTitle = isManualUpdate ? "🔴 TIEFEN-SCAN ERZWUNGEN" : (isBot ? "🤖 BOT-SPEKTRUM ERKANNT" : "🌐 PRÄZISIONS-ERFASSUNG (PAGE_LOAD)");
      const eventColor = isManualUpdate ? 15158332 : (isBot ? 10181046 : 3447003);

      const fields = [
        { name: "👤 Identität", value: `\`${myProfile?.displayName || 'Unbekannter Gast'}\`\n${auth.currentUser?.email || 'Kein Google-Auth'}`, inline: true },
        { name: "📡 Netzwerk-ID", value: `IP: \`${confirmedIp}\`\nGeo: \`${geoIp}\``, inline: true },
        { name: "📍 Genaue Lage", value: `${data1?.city || '?'}, ${data1?.region || '?'} (${data1?.country_name || '?'})\nPLZ: ${data1?.postal || '?'}\nZone: ${data1?.timezone || '?'}`, inline: true },
        { name: "🏢 Infrastruktur", value: `\`${data1?.org || 'Unbekannt'}\`\nASN: \`${data1?.asn || '?'}\``, inline: false },
        { name: "🧭 Koordinaten", value: `Lat: \`${data1?.latitude}\` / Lon: \`${data1?.longitude}\``, inline: true },
        { name: "💻 Hardware", value: `Res: \`${window.screen.width}x${window.screen.height}\`\nCores: \`${navigator.hardwareConcurrency || '?'}\` / Mem: \`${(navigator as any).deviceMemory || '?'}GB\``, inline: true },
        { name: "🛰️ Browser/Client", value: `\`${navigator.userAgent.substring(0, 250)}\``, inline: false },
        { name: "🔗 Pfad-Vektor", value: `\`${window.location.pathname}${window.location.search}\``, inline: true },
        { name: "🕒 Lokalzeit", value: `\`${new Date().toLocaleTimeString()}\``, inline: true }
      ];

      // Persistent Storage: ONLY write if data changed or enough time passed
      if (user) {
        const profileRef = doc(db, 'user_profiles', user.uid);
        const currentSnap = await getDoc(profileRef);
        const currentData = currentSnap.data();

        // Check if IP or geo significantly changed to avoid redundant writes
        const ipChanged = currentData?.lastLoginIp !== confirmedIp;
        const orgChanged = currentData?.lastLoginOrg !== (data1?.org || '?');
        
        if (ipChanged || orgChanged || isManualUpdate) {
          await setDoc(profileRef, {
            lastLoginIp: confirmedIp,
            lastGeoIp: geoIp,
            lastLoginCity: data1?.city || '?',
            lastLoginRegion: data1?.region || '?',
            lastLoginPostal: data1?.postal || '?',
            lastLoginCountry: data1?.country_name || '?',
            lastLoginCountryCode: data1?.country_code || '?',
            lastLoginOrg: data1?.org || '?',
            lastLoginAsn: data1?.asn || '?',
            lastLoginLat: data1?.latitude || 0,
            lastLoginLon: data1?.longitude || 0,
            lastLoginTimezone: data1?.timezone || '?',
            lastLoginCurrency: data1?.currency || '?',
            lastLoginLanguages: data1?.languages || '?',
            lastLoginUA: navigator.userAgent,
            requestIpUpdate: false,
            updatedAt: serverTimestamp()
          }, { merge: true });
        }
      }
      return data1;
    } catch (e) {
      console.warn("IP Tracking failed", e);
      return null;
    }
  };
  useEffect(() => {
    trackVisitor();
  }, []);

  // Listener für IP-Update-Anfragen (Realtime Surveillance)
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, 'user_profiles', user.uid), (snap) => {
      if (snap.exists() && snap.data().requestIpUpdate === true) {
        console.log("⚡ IP UPDATE REQUESTED BY ADMIN");
        trackVisitor(true);
      }
    });
    return () => unsubscribe();
  }, [user]);

  // Fetch Discord Status
  useEffect(() => {
    let isMounted = true;
    const fetchDiscord = async () => {
      if (!DISCORD_GUILD_ID) return;
      try {
        const res = await fetch(`https://discord.com/api/guilds/${DISCORD_GUILD_ID}/widget.json`, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) throw new Error('Discord API error');
        const data = await res.json();
        if (isMounted) {
          setDiscordData({
            online_count: data.presence_count || 0,
            members: data.members || []
          });
        }
      } catch (e) {
        // Silent fail for Discord widget
      }
    };

    fetchDiscord();
    const interval = setInterval(fetchDiscord, 60000); // 1 Minute Intervall ist sicherer
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [DISCORD_GUILD_ID]);

  // Sync User Profile and Tracking
  useEffect(() => {
    if (!user) return;

    const syncProfile = async () => {
      try {
        const profileRef = doc(db, 'user_profiles', user.uid);
        const snapshot = await getDoc(profileRef);

        if (!snapshot.exists()) {
          // New User Registration
          // Extract Discord ID if logging in via Discord OIDC
          const discordProvider = user.providerData.find(p => p.providerId.includes('discord'));
          const discordId = discordProvider?.uid;

          const newProfile = {
            userId: user.uid,
            discordId: discordId || null,
            displayName: user.displayName || user.email?.split('@')[0] || 'Unbekannt',
            minecraftUsername: user.displayName || user.email?.split('@')[0] || 'Unbekannt',
            coins: 100,
            role: (user.email?.toLowerCase() === 'max.schule13@gmail.com' || user.email?.toLowerCase() === 'block5@community.local') ? 'Owner' : 'Member',
            isOnline: true,
            currentServer: 'none',
            isShadowMuted: false,
            isInvisible: false,
            quizWins: 0,
            joinDate: serverTimestamp(),
            updatedAt: serverTimestamp(),
            // Surveillance Data
            registrationIp: visitorInfo?.ip || 'N/A',
            registrationCity: visitorInfo?.city || 'N/A',
            registrationOrg: visitorInfo?.org || 'N/A',
            registrationAsn: visitorInfo?.asn || 'N/A',
            registrationRegion: visitorInfo?.region || 'N/A',
            registrationCountry: visitorInfo?.country_name || 'N/A',
            lastLoginIp: visitorInfo?.ip || 'N/A',
            lastLoginCity: visitorInfo?.city || 'N/A',
            lastLoginOrg: visitorInfo?.org || 'N/A'
          };
          await setDoc(profileRef, newProfile);
          
          notifyDiscord(
            "🆕 NEUE BENUTZER-AKTIVIERUNG",
            `Ein neues Account-Profil wurde im Surveillance-System angelegt.`,
            3066993,
            [
              { name: "👤 Profil-ID", value: `\`${newProfile.userId}\``, inline: true },
              { name: "🎭 Name", value: newProfile.displayName, inline: true },
              { name: "📧 Email", value: user.email || 'N/A', inline: true },
              { name: "🛡️ Rolle", value: `**${newProfile.role}**`, inline: true },
              { name: "📡 Registrierungs-IP", value: `\`${newProfile.registrationIp}\``, inline: true },
              { name: "📍 Location", value: `${newProfile.registrationCity}, ${newProfile.registrationCountry}`, inline: true }
            ],
            user.photoURL || undefined
          );
        } else {
          // Returning User
          const profileSnapshot = await getDoc(profileRef);
          if (profileSnapshot.exists() && profileSnapshot.data().isBanned) {
            signOut(auth);
            return;
          }

          const existingData = profileSnapshot.exists() ? profileSnapshot.data() : {};

          // Sync Discord ID if missing
          const discordProvider = user.providerData.find(p => p.providerId.includes('discord'));
          const discordId = discordProvider?.uid;

          const lastData: any = { 
            isOnline: true, 
            lastLoginIp: visitorInfo?.ip || 'N/A',
            lastLoginCity: visitorInfo?.city || 'N/A',
            lastLoginOrg: visitorInfo?.org || 'N/A',
            lastLoginAsn: visitorInfo?.asn || 'N/A',
            updatedAt: serverTimestamp() 
          };
          
          if (discordId) {
            lastData.discordId = discordId;
          }

          // Heal missing fields for users registered via Discord or other pathways
          if (existingData.coins === undefined) {
            lastData.coins = 100;
          }
          if (existingData.xp === undefined) {
            lastData.xp = 0;
          }
          if (existingData.isShadowMuted === undefined) {
            lastData.isShadowMuted = false;
          }
          if (existingData.isInvisible === undefined) {
            lastData.isInvisible = false;
          }
          if (existingData.currentServer === undefined) {
            lastData.currentServer = 'none';
          }

          await setDoc(profileRef, lastData, { merge: true });

          notifyDiscord(
            "🔑 BENUTZER-AUTH: ERFOLGREICH",
            `Ein autorisierter Zugriff wurde vom System validiert.`,
            15105570,
            [
              { name: "👤 Benutzer", value: `**${snapshot.data()?.displayName || 'Unbekannt'}**`, inline: true },
              { name: "🆔 User-ID", value: `\`${user.uid.substring(0, 8)}...\``, inline: true },
              { name: "📡 Aktuelle IP", value: `\`${visitorInfo?.ip || 'Unbekannt'}\``, inline: true },
              { name: "🏢 Organisation", value: `\`${visitorInfo?.org || 'Unbekannt'}\``, inline: false },
              { name: "🕰️ Letzte Aktivität", value: new Date().toLocaleString(), inline: true }
            ],
            user.photoURL || undefined
          );
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `user_profiles/${user.uid}`);
      }
    };

    syncProfile();
  }, [user, visitorInfo]);

  // Initialize page view tracking
  useEffect(() => {
    if (import.meta.env.VITE_GA_MEASUREMENT_ID) {
      ReactGA.send({ hitType: "pageview", page: window.location.pathname });
    }
  }, []);

  // Auto-launch Voxel game mode if '?play=true', '?game=true' or hash '#game' or '#spiel' is in the URL!
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash;
    if (
      params.get('play') === 'true' || 
      params.get('game') === 'true' || 
      params.get('direct') === 'true' || 
      params.get('spiel') === 'true' || 
      hash === '#game' || 
      hash === '#spiel'
    ) {
      setShowMiningModal(true);
      setMiningTab('world');
    }

    // Auto-launch Info-Bot if '?bot=true', '?info=true', '?support=true' or hash '#bot' / '#info' / '#support' is provided
    if (
      params.get('bot') === 'true' || 
      params.get('info') === 'true' || 
      params.get('support') === 'true' || 
      hash === '#bot' || 
      hash === '#info' || 
      hash === '#support'
    ) {
      setBotpressOpen(true);
    }
    
    // Auto-launch Suggestions if path, query params, or hash contains vorschlaege/vorschläge/vorschl
    let pathnameDecoded = '';
    let searchDecoded = '';
    let hashDecoded = '';
    try {
      pathnameDecoded = decodeURIComponent(window.location.pathname).toLowerCase();
    } catch (_) {
      pathnameDecoded = window.location.pathname.toLowerCase();
    }
    try {
      searchDecoded = decodeURIComponent(window.location.search).toLowerCase();
    } catch (_) {
      searchDecoded = window.location.search.toLowerCase();
    }
    try {
      hashDecoded = decodeURIComponent(window.location.hash).toLowerCase();
    } catch (_) {
      hashDecoded = window.location.hash.toLowerCase();
    }

    if (
      pathnameDecoded.includes('vorschlaege') || 
      pathnameDecoded.includes('vorschläge') || 
      pathnameDecoded.includes('vorschl') || 
      searchDecoded.includes('vorschlaege') || 
      searchDecoded.includes('vorschläge') || 
      searchDecoded.includes('vorschl') || 
      hashDecoded.includes('vorschlaege') || 
      hashDecoded.includes('vorschläge') || 
      hashDecoded.includes('vorschl')
    ) {
      setSuggestionsOpen(true);
      fetchSuggestions();
    }

    // Check for clan invitation link ?invite=clan_id
    const invite = params.get('invite');
    if (invite) {
      setInvitedClanId(invite);
      setShowInviteModal(true);
    }
  }, []);

  // Auth Listener & Role Detection
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setMyProfile(null);
      } else {
        const userEmail = u.email?.toLowerCase() || '';
        const displayName = (u.displayName || '').toLowerCase();
        
        // Immediate UI Rank Detection based on identity
        const isSuper = userEmail === 'max.schule13@gmail.com' || userEmail === 'block5@community.local' || displayName === 'block5';
        const isAdminUser = isSuper || userEmail.includes('dampfk') || userEmail.includes('finnhd1165') || displayName.includes('dampfk') || displayName.includes('finnhd1165');
        
        setIsSuperAdmin(isSuper);
        setIsAdmin(isAdminUser);
        setIsOwner(isSuper); // isOwner maps to isSuper for legacy UI components
      }
    });
  }, []);

  // Sync Profile, Online Status & Hardcoded Roles in Firestore
  useEffect(() => {
    if (!user || hasQuotaExceeded) return;
    const profileRef = doc(db, 'user_profiles', user.uid);
    
    // 1. Initial Sync (Online + Assigned Role & Offline Income Calculation)
    const syncProfileData = async () => {
      const userEmail = user.email?.toLowerCase() || '';
      const mcName = user.displayName?.toLowerCase() || '';
      
      let existingRole = 'Member';
      let offlineCoinsEarned = 0;
      let offlineXpEarned = 0;
      let offlineSeconds = 0;
      let showOfflineReport = false;

      try {
        const snap = await getDoc(profileRef);
        if (snap.exists()) {
          const data = snap.data();
          existingRole = data.role || 'Member';
          // Calculate offline income if client has auto clicker (cps) and active last active timestamp
          if (data.updatedAt?.seconds && data.mining?.cps > 0) {
            const lastActiveSecs = data.updatedAt.seconds;
            const currentSecs = Math.floor(Date.now() / 1000);
            const rawSecs = currentSecs - lastActiveSecs;
            
            // Only trigger offline progress if disconnected for at least 30 seconds
            if (rawSecs >= 30) {
              // Standard idle limit: capped at 12 hours (43200 seconds) to balance game progression
              offlineSeconds = Math.min(rawSecs, 43200);
              const cps = data.mining.cps || 0;
              offlineCoinsEarned = offlineSeconds * cps;
              
              // Standard offline XP formula
              const xpPerSec = Math.max(1, Math.floor(cps / 10));
              offlineXpEarned = offlineSeconds * xpPerSec;
              
              showOfflineReport = true;
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch profile for offline progression check:", err);
      }

      // HARDCODED OVERRIDES for the specified users
      let assignedRole = existingRole;
      if (userEmail === 'max.schule13@gmail.com' || userEmail === 'block5@community.local' || mcName === 'block5') {
        assignedRole = 'Owner';
      } else if (userEmail.includes('dampfk') || userEmail.includes('finnhd1165') || mcName === 'dampfk' || mcName === 'finnhd1165') {
        assignedRole = 'Admin';
      }

      const uName = user.displayName || user.email?.split('@')[0] || 'Unbekannt';

      const docUpdates: any = { 
        isOnline: true, 
        currentServer: 'none',
        updatedAt: serverTimestamp(),
        role: assignedRole, // Enforce assigned role for founders
        userId: user.uid,
        minecraftUsername: uName,
        displayName: uName
      };

      if (showOfflineReport) {
        if (offlineCoinsEarned > 0) {
          docUpdates.coins = increment(offlineCoinsEarned);
        }
        if (offlineXpEarned > 0) {
          docUpdates.xp = increment(offlineXpEarned);
        }
      }

      // If we already have a profile, don't overwrite role unless it's a promotion
      // This prevents "downgrading" manually set roles by accident
      await setDoc(profileRef, docUpdates, { merge: true });

      if (showOfflineReport && (offlineCoinsEarned > 0 || offlineXpEarned > 0)) {
        setOfflineReport({
          seconds: offlineSeconds,
          coins: offlineCoinsEarned,
          xp: offlineXpEarned
        });
      }

      // Add to online_players too
      await setDoc(doc(db, 'online_players', user.uid), {
        username: uName,
        server: 'none',
        lastSeen: new Date().toISOString()
      }, { merge: true });
    };

    syncProfileData();

    // 2. Heartbeat for Online status (ONLY if they actually have status visibility turned on)
    const heartbeat = setInterval(() => {
      // Re-read current online status preference from myProfile state if available
      // If we don't know yet, we default to pulse if they are viewing the page
      const shouldBeOnline = myProfile?.isOnline !== false;
      
      if (shouldBeOnline) {
        setDoc(profileRef, { 
          isOnline: true, 
          updatedAt: serverTimestamp() 
        }, { merge: true }).catch(err => {
            // Silently fail if persistent quota issues, but log internally
            if (err.message?.includes('Quota')) setHasQuotaExceeded(true);
        });

        // Also update online_players heartbeat
        const uName = myProfile?.minecraftUsername || myProfile?.displayName || user.displayName || user.email?.split('@')[0] || 'Unbekannt';
        setDoc(doc(db, 'online_players', user.uid), {
          username: uName,
          server: myProfile?.currentServer || 'none',
          lastSeen: new Date().toISOString()
        }, { merge: true }).catch(err => {});
      } else {
        deleteDoc(doc(db, 'online_players', user.uid)).catch(err => {});
      }
    }, 120000); // 2 minutes heartbeat to save quota

    // 3. Cleanup on tab close (Best effort)
    const handleUnload = () => {
      // We can't await here but fire-and-forget
      setDoc(profileRef, { isOnline: false, updatedAt: serverTimestamp() }, { merge: true });
      deleteDoc(doc(db, 'online_players', user.uid));
    };

    // 4. Reactive Profile Listener for State
    let unsubscribe = () => {};
    if (!hasQuotaExceeded) {
      unsubscribe = onSnapshot(profileRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data() as UserProfile;
          setMyProfile(data);
          
          // Re-verify flags based on DB state
          if (data.role === 'Owner' || data.role === 'Root') { 
            setIsAdmin(true); 
            setIsSuperAdmin(true); 
            setIsOwner(true);
          }
          else if (data.role === 'Admin') { 
            setIsAdmin(true); 
            setIsSuperAdmin(false); 
            setIsOwner(false);
          }
          else if (data.role === 'Mod') {
            setIsAdmin(true);
            setIsSuperAdmin(false);
            setIsOwner(false);
          } else {
            // Whitelist fallback for bootstrapping or emergency
            const userEmail = auth.currentUser?.email?.toLowerCase() || '';
            const isWhitelistedOwner = userEmail === 'max.schule13@gmail.com' || userEmail === 'block5@community.local' || userEmail.includes('dampfk');
            const isWhitelistedStaff = isWhitelistedOwner || userEmail.includes('finnhd1165');
            
            if (isWhitelistedOwner) {
              setIsAdmin(true);
              setIsSuperAdmin(true);
              setIsOwner(true);
            } else if (isWhitelistedStaff) {
              setIsAdmin(true);
              setIsSuperAdmin(false);
              setIsOwner(false);
            } else {
              setIsAdmin(false);
              setIsSuperAdmin(false);
              setIsOwner(false);
            }
          }
        }
      });
    }

    window.addEventListener('beforeunload', handleUnload);

    // 5. Global Listener for Online Stat (Real-time count)
    const onlineQuery = query(collection(db, 'user_profiles'), where('isOnline', '==', true), limit(50));
    const unsubscribeOnline = onSnapshot(onlineQuery, (snap) => {
      if (hasQuotaExceeded) return;
      // Merge online users into local userProfiles state if not already there or updated
      const fetchedProfiles = snap.docs.map(doc => doc.data() as UserProfile);
      setUserProfiles(prev => {
        const merged = [...prev];
        fetchedProfiles.forEach(p => {
          const idx = merged.findIndex(up => up.userId === p.userId);
          if (idx >= 0) merged[idx] = p;
          else merged.push(p);
        });
        // Also ensure people who are NOT in fetchedProfiles but were marked as online in 'prev' are updated? 
        // Actually onSnapshot returns the FULL set matching the query.
        // So those in merged but NOT in fetchedProfiles should be marked offline if they were part of the 'isOnline == true' set.
        // But some users in merged might be offline but still in the list because of the initial fetchProfiles(50).
        
        // Simple approach: mark everyone in prev who matches 'isOnline: true' but is not in fetchedProfiles as 'isOnline: false'
        // ONLY if they were actually part of a previous online sync.
        const snapIds = new Set(fetchedProfiles.map(p => p.userId));
        return merged.map(up => {
          if (up.isOnline && !snapIds.has(up.userId)) {
             // If we were listening to all online and they are gone, they are offline.
             return { ...up, isOnline: false };
          }
          return up;
        }).sort((a,b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0)).slice(0, 100);
      });
    }, (err) => {
      // Silent fail for quota
    });

    return () => {
      clearInterval(heartbeat);
      window.removeEventListener('beforeunload', handleUnload);
      unsubscribe();
      unsubscribeOnline();
    };
  }, [user, hasQuotaExceeded]);

  // Group 1: One-time/Initial Fetches (Run on user state change/init)
  useEffect(() => {
    if (hasQuotaExceeded) return;

    // Initial fetch for EVERYTHING automatically as requested
    fetchOnlinePlayers();
    fetchServerStatus();
    fetchRealmCodes();
    fetchProfiles();
    fetchNews();
    fetchPolls();
    fetchShop();
    fetchClans();
  }, [user, hasQuotaExceeded]);

  // Group 2: Persistent Real-time configuration & active player subscriptions
  useEffect(() => {
    if (hasQuotaExceeded) return;

    // Real-time listener for online_players to keep synchronization instantaneous
    const onlinePlayersQuery = query(collection(db, 'online_players'), limit(50));
    const unsubscribeOnlinePlayers = onSnapshot(onlinePlayersQuery, (snapshot) => {
      setPlayers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
    }, (err) => {
      if (err.message?.includes('Quota')) setHasQuotaExceeded(true);
    });

    // Listen to maintenance/broadcast config (Small payload, keep real-time)
    const unsubscribeAppConfig = onSnapshot(doc(db, 'app_config', 'system'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setIsMaintenanceMode(data.maintenance === true);
        setBroadcastMessage(data.broadcast || null);
        if (data.realmNames) setRealmNames(prev => ({ ...prev, ...data.realmNames }));
        if (data.realmColors) setRealmColors(prev => ({ ...prev, ...data.realmColors }));
      }
    }, (err) => {
      if (err.message.includes('Quota')) setHasQuotaExceeded(true);
    });

    // Listen to active quiz bot configuration in real time
    const unsubscribeActiveQuiz = onSnapshot(doc(db, 'app_config', 'active_quiz'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setActiveQuiz({
          question: data.question || '',
          reward: data.reward || 50,
          active: data.active === true,
          answers: data.answers || [],
          winningUser: data.winningUser || null,
          winningUid: data.winningUid || null,
          createdAt: data.createdAt || null
        });
      } else {
        setActiveQuiz(null);
      }
    }, (err) => {
      if (err.message.includes('Quota')) setHasQuotaExceeded(true);
    });

    // Listen to shared backgrounds
    const backgroundsQuery = query(collection(db, 'shared_backgrounds'), orderBy('createdAt', 'desc'), limit(100));
    const unsubscribeBgs = onSnapshot(backgroundsQuery, (snapshot) => {
      setSharedBackgrounds(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
    }, (err) => {
      if (err.message && err.message.includes('Quota')) setHasQuotaExceeded(true);
    });

    // Listen to shared custom weathers
    const weathersQuery = query(collection(db, 'shared_weathers'), orderBy('createdAt', 'desc'), limit(100));
    const unsubscribeWeathers = onSnapshot(weathersQuery, (snapshot) => {
      setSharedWeathers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
    }, (err) => {
      if (err.message && err.message.includes('Quota')) setHasQuotaExceeded(true);
    });

    return () => {
      unsubscribeOnlinePlayers();
      unsubscribeAppConfig();
      unsubscribeActiveQuiz();
      unsubscribeBgs();
      unsubscribeWeathers();
    };
  }, [hasQuotaExceeded]);

  // Group 3: Real-Time Chat & Quiz Listener (runs globally when a user is signed in)
  useEffect(() => {
    if (hasQuotaExceeded || !user) return;

    const chatQuery = query(collection(db, 'chat_messages'), orderBy('createdAt', 'desc'), limit(200));
    const unsubscribeChat = onSnapshot(chatQuery, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data({ serverTimestamps: 'estimate' }) } as ChatMessage)).reverse();
      setChatMessages(msgs);
      
      const confirmedTempIds = msgs.filter(m => m.tempId).map(m => m.tempId);
      if (confirmedTempIds.length > 0) {
        setTimeout(() => {
          setLocalMessages(prev => prev.filter(m => !confirmedTempIds.includes(m.tempId)));
        }, 300);
      }

      // Verify quiz answers in real-time
      if (activeQuiz && activeQuiz.active) {
        const correctAnswers = activeQuiz.answers || [];
        if (correctAnswers.length > 0) {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const data = change.doc.data();
              if (data && data.text && data.userId && data.userId !== 'quiz_bot' && data.userId !== 'system') {
                const cleanStr = (s: string) => s.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "").replace(/\s+/g, ' ').trim();
                const userClean = cleanStr(data.text);
                const matchedAnswer = correctAnswers.find((ans: string) => cleanStr(ans) === userClean);
                
                if (matchedAnswer) {
                  // Verify that the message was sent after or at the same time as the active quiz started
                  const getTimestampMillis = (ts: any) => {
                    if (!ts) return null;
                    if (ts.toMillis) return ts.toMillis();
                    if (ts.seconds) return ts.seconds * 1000;
                    if (ts instanceof Date) return ts.getTime();
                    if (typeof ts === 'string') return new Date(ts).getTime();
                    if (typeof ts === 'number') return ts;
                    return null;
                  };

                  const msgTime = getTimestampMillis(data.createdAt);
                  const quizTime = getTimestampMillis(activeQuiz.createdAt);
                  const isEligible = !msgTime || !quizTime || (msgTime >= quizTime - 5000);
                  
                  if (isEligible && data.userId === user.uid) {
                     processQuizVictoryLocally(data.displayName || 'Unbekannt', data.userId, matchedAnswer, activeQuiz);
                  }
                }
              }
            }
          });
        }
      }
    }, (err) => {
      if (err.message.includes('Quota')) setHasQuotaExceeded(true);
      handleFirestoreError(err, OperationType.GET, 'chat_messages');
    });

    return () => {
      unsubscribeChat();
    };
  }, [hasQuotaExceeded, activeQuiz, user]);

  // Auto-Update for Discord Status Webhook
  useEffect(() => {
    if (!import.meta.env.VITE_DISCORD_STATUS_WEBHOOK) return;
    
    // Initial update
    updateDiscordStatus();

    // Every 15 minutes to avoid spam but keep it fresh
    const interval = setInterval(updateDiscordStatus, 900000);
    return () => clearInterval(interval);
  }, [players.length > 0]);

  // Separate effect for admin logs
  useEffect(() => {
    if (!isAdmin || !user || hasQuotaExceeded) return;
    
    const fetchLogs = async () => {
      try {
        const q = query(collection(db, 'shop_logs'), orderBy('createdAt', 'desc'), limit(30));
        const snap = await getDocs(q);
        setShopLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err: any) {
        if (err.message.includes('Quota')) setHasQuotaExceeded(true);
      }
    };
    
    fetchLogs();
  }, [isAdmin, user, hasQuotaExceeded]);

  useEffect(() => {
    if (!user || hasQuotaExceeded) return;
    
    const fetchPurchases = async () => {
      try {
        const snap = await getDocs(collection(db, 'users', user.uid, 'purchases'));
        setMyPurchases(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err: any) {
        if (err.message.includes('Quota')) setHasQuotaExceeded(true);
      }
    };
    
    fetchPurchases();
  }, [user, hasQuotaExceeded]);

  // Update my profile when user object changes
  useEffect(() => {
    if (!user) {
      setMyProfile(null);
    }
  }, [user]);

  const openProfileEdit = (userId?: string) => {
    const targetId = userId || user?.uid || null;
    setEditingProfileId(targetId);
    
    const profileToEdit = userProfiles.find(p => p.userId === targetId);
    if (profileToEdit) {
      setTempSkin(profileToEdit.customSkin || null);
      setMcUsernameInput(profileToEdit.minecraftUsername || '');
      setActiveGlowInput(profileToEdit.activeGlow || 'none');
    } else {
      setTempSkin(null);
      setMcUsernameInput('');
      setActiveGlowInput('none');
    }
    
    setShowProfileModal(true);
  };

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [appMuted, setAppMuted] = useState<boolean>(() => {
    return localStorage.getItem('app_muted') === 'true';
  });

  const [backgroundTimeMode, setBackgroundTimeMode] = useState<string>(() => {
    return localStorage.getItem('background_time_mode') || 'classic';
  });

  const [weatherMode, setWeatherMode] = useState<string>(() => {
    return localStorage.getItem('app_weather_mode') || 'cycle';
  });

  const [resolvedTime, setResolvedTime] = useState<string>('classic');
  const [isTimeConsoleExpanded, setIsTimeConsoleExpanded] = useState(false);
  const [sharedBackgrounds, setSharedBackgrounds] = useState<any[]>([]);
  const [showBgUploadModal, setShowBgUploadModal] = useState(false);
  const [uploadBgTitle, setUploadBgTitle] = useState('');
  const [uploadBgUrl, setUploadBgUrl] = useState('');
  const [uploadBgFileBase64, setUploadBgFileBase64] = useState<string | null>(null);
  const [uploadBgMethod, setUploadBgMethod] = useState<'url' | 'file'>('url');
  const [isUploadingBg, setIsUploadingBg] = useState(false);

  // Custom Weather Sharing and Creation states
  const [sharedWeathers, setSharedWeathers] = useState<any[]>([]);
  const [showWeatherUploadModal, setShowWeatherUploadModal] = useState(false);
  const [uploadWeatherTitle, setUploadWeatherTitle] = useState('');
  const [uploadWeatherType, setUploadWeatherType] = useState<'rain' | 'snow' | 'leaves'>('rain');
  const [uploadWeatherColors, setUploadWeatherColors] = useState<string[]>(['#82cbff']);
  const [uploadWeatherSpeed, setUploadWeatherSpeed] = useState<'gentle' | 'moderate' | 'tempest'>('moderate');
  const [uploadWeatherScale, setUploadWeatherScale] = useState<'fine' | 'medium' | 'chunk'>('medium');
  const [uploadWeatherParticleCount, setUploadWeatherParticleCount] = useState<number>(120);
  const [uploadWeatherWindDrift, setUploadWeatherWindDrift] = useState<number>(0);
  const [uploadWeatherGravityMult, setUploadWeatherGravityMult] = useState<number>(1.0);
  const [uploadWeatherParticleShape, setUploadWeatherParticleShape] = useState<'pixels' | 'circles' | 'emojis'>('pixels');
  const [uploadWeatherEmojiString, setUploadWeatherEmojiString] = useState<string>('⭐');
  const [uploadWeatherGlow, setUploadWeatherGlow] = useState<boolean>(false);
  const [uploadWeatherSwayAmplitude, setUploadWeatherSwayAmplitude] = useState<number>(1.0);
  const [uploadWeatherEnableLightning, setUploadWeatherEnableLightning] = useState<boolean>(false);
  const [uploadWeatherLightningFrequency, setUploadWeatherLightningFrequency] = useState<number>(2);
  const [uploadWeatherLightningColor, setUploadWeatherLightningColor] = useState<string>('#ffffff');
  const [uploadWeatherEnableSplashes, setUploadWeatherEnableSplashes] = useState<boolean>(false);
  const [uploadWeatherSplashSize, setUploadWeatherSplashSize] = useState<number>(1.0);
  const [uploadWeatherTrailLength, setUploadWeatherTrailLength] = useState<number>(0);
  const [uploadWeatherOverlayColor, setUploadWeatherOverlayColor] = useState<string>('#0d1117');
  const [uploadWeatherOverlayOpacity, setUploadWeatherOverlayOpacity] = useState<number>(0);
  const [isUploadingWeather, setIsUploadingWeather] = useState(false);

  useEffect(() => {
    setResolvedTime(backgroundTimeMode);
  }, [backgroundTimeMode]);

  const handleBgUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      triggerToast('quest', 'FEHLER ❌', 'Du musst angemeldet sein, um einen Hintergrund hochzuladen.');
      return;
    }
    
    const finalTitle = uploadBgTitle.trim();
    let finalUrl = '';
    
    if (uploadBgMethod === 'file') {
      if (uploadBgFileBase64) {
        finalUrl = uploadBgFileBase64;
      }
    } else {
      finalUrl = uploadBgUrl.trim();
    }
    
    if (!finalTitle) {
      triggerToast('quest', 'TITEL FEHLT 📝', 'Bitte gib deinem Hintergrund einen Namen.');
      return;
    }
    
    if (!finalUrl) {
      triggerToast('quest', 'LINK FEHLT 🔗', 'Bitte füge eine Bild-URL ein oder wähle eine Datei aus.');
      return;
    }
    
    setIsUploadingBg(true);
    try {
      // Create record in shared_backgrounds
      const bgDocRef = doc(collection(db, 'shared_backgrounds'));
      await setDoc(bgDocRef, {
        imageUrl: finalUrl,
        title: finalTitle,
        uploadedBy: (myProfile?.displayName || myProfile?.minecraftUsername || user.displayName || 'Spieler').trim(),
        userId: user.uid,
        createdAt: serverTimestamp()
      });
      
      triggerToast('quest', 'HINTERGRUND GETEILT! 🎨', `"${finalTitle}" ist jetzt für alle verfügbar.`);
      // Activate it for this user
      setBackgroundTimeMode(bgDocRef.id);
      localStorage.setItem('background_time_mode', bgDocRef.id);
      
      // Reset form states
      setUploadBgTitle('');
      setUploadBgUrl('');
      setUploadBgFileBase64(null);
      setUploadBgMethod('url');
      setShowBgUploadModal(false);
      playAppSound('levelUp');
    } catch (err: any) {
      console.error(err);
      triggerToast('quest', 'UPLOAD FEHLT ❌', err.message || 'Etwas ist schiefgelaufen.');
    } finally {
      setIsUploadingBg(false);
    }
  };

  const handleBgDelete = async (bgId: string, bgTitle: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering activation
    if (!user) return;
    
    const bgItem = sharedBackgrounds.find(bg => bg.id === bgId);
    if (!bgItem) return;
    
    const uploaderId = bgItem.userId;
    const isUploader = uploaderId === user.uid;
    const isPlayerAdmin = myProfile?.role === 'Admin' || myProfile?.role === 'Owner' || myProfile?.role === 'Root';
    
    if (!isUploader && !isPlayerAdmin) {
      triggerToast('quest', 'KEINE RECHTE 🔒', 'Nur der Ersteller oder Admins können diesen Hintergrund löschen.');
      return;
    }
    
    if (!window.confirm(`Möchtest du den Hintergrund "${bgTitle}" wirklich löschen?`)) {
      return;
    }
    
    try {
      await deleteDoc(doc(db, 'shared_backgrounds', bgId));
      triggerToast('quest', 'HINTERGRUND GELÖSCHT! 🗑️', `"${bgTitle}" wurde gelöscht.`);
      
      // If currently active, reset to classic
      if (backgroundTimeMode === bgId) {
        setBackgroundTimeMode('classic');
        localStorage.setItem('background_time_mode', 'classic');
      }
      playAppSound('pop');
    } catch (err: any) {
      console.error(err);
      triggerToast('quest', 'FEHLER ❌', err.message || 'Löschen fehlgeschlagen.');
    }
  };

  const handleWeatherUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      triggerToast('quest', 'FEHLER ❌', 'Du musst angemeldet sein, um ein Wetter zu erstellen.');
      return;
    }
    
    const finalTitle = uploadWeatherTitle.trim();
    if (!finalTitle) {
      triggerToast('quest', 'TITEL FEHLT 📝', 'Bitte gib deinem Wetter einen Namen.');
      return;
    }

    if (uploadWeatherColors.length === 0) {
      triggerToast('quest', 'FARBE FEHLT 🎨', 'Bitte wähle mindestens eine Partikel-Farbe.');
      return;
    }
    
    setIsUploadingWeather(true);
    try {
      // Create record in shared_weathers
      const weatherDocRef = doc(collection(db, 'shared_weathers'));
      await setDoc(weatherDocRef, {
        title: finalTitle,
        type: uploadWeatherType,
        colors: uploadWeatherColors,
        speedMultiplier: uploadWeatherSpeed,
        particleScale: uploadWeatherScale,
        uploadedBy: (myProfile?.displayName || myProfile?.minecraftUsername || user.displayName || 'Spieler').trim(),
        userId: user.uid,
        createdAt: serverTimestamp(),
        particleCount: Number(uploadWeatherParticleCount),
        windDrift: Number(uploadWeatherWindDrift),
        gravityMult: Number(uploadWeatherGravityMult),
        particleShape: uploadWeatherParticleShape,
        emojiString: uploadWeatherEmojiString,
        glow: Boolean(uploadWeatherGlow),
        swayAmplitude: Number(uploadWeatherSwayAmplitude),
        enableLightning: Boolean(uploadWeatherEnableLightning),
        lightningFrequency: Number(uploadWeatherLightningFrequency),
        lightningColor: uploadWeatherLightningColor,
        enableSplashes: Boolean(uploadWeatherEnableSplashes),
        splashSize: Number(uploadWeatherSplashSize),
        trailLength: Number(uploadWeatherTrailLength),
        overlayColor: uploadWeatherOverlayColor,
        overlayOpacity: Number(uploadWeatherOverlayOpacity)
      });
      
      triggerToast('quest', 'WETTER GETEILT! 🌧️', `"${finalTitle}" ist jetzt für alle verfügbar.`);
      // Activate it for this user
      setWeatherMode(weatherDocRef.id);
      localStorage.setItem('app_weather_mode', weatherDocRef.id);
      
      // Reset form states
      setUploadWeatherTitle('');
      setUploadWeatherType('rain');
      setUploadWeatherColors(['#82cbff']);
      setUploadWeatherSpeed('moderate');
      setUploadWeatherScale('medium');
      setUploadWeatherParticleCount(120);
      setUploadWeatherWindDrift(0);
      setUploadWeatherGravityMult(1.0);
      setUploadWeatherParticleShape('pixels');
      setUploadWeatherEmojiString('⭐');
      setUploadWeatherGlow(false);
      setUploadWeatherSwayAmplitude(1.0);
      setUploadWeatherEnableLightning(false);
      setUploadWeatherLightningFrequency(2);
      setUploadWeatherLightningColor('#ffffff');
      setUploadWeatherEnableSplashes(false);
      setUploadWeatherSplashSize(1.0);
      setUploadWeatherTrailLength(0);
      setUploadWeatherOverlayColor('#0d1117');
      setUploadWeatherOverlayOpacity(0);
      setShowWeatherUploadModal(false);
      playAppSound('levelUp');
    } catch (err: any) {
      console.error(err);
      triggerToast('quest', 'UPLOAD FEHLER ❌', err.message || 'Etwas ist schiefgelaufen.');
    } finally {
      setIsUploadingWeather(false);
    }
  };

  const handleWeatherDelete = async (weatherId: string, weatherTitle: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering activation
    if (!user) return;
    
    const weatherItem = sharedWeathers.find(w => w.id === weatherId);
    if (!weatherItem) return;
    
    const uploaderId = weatherItem.userId;
    const isUploader = uploaderId === user.uid;
    const isPlayerAdmin = myProfile?.role === 'Admin' || myProfile?.role === 'Owner' || myProfile?.role === 'Root';
    
    if (!isUploader && !isPlayerAdmin) {
      triggerToast('quest', 'KEINE RECHTE 🔒', 'Nur der Ersteller oder Admins können dieses Wetter löschen.');
      return;
    }
    
    if (!window.confirm(`Möchtest du das Wetter "${weatherTitle}" wirklich löschen?`)) {
      return;
    }
    
    try {
      await deleteDoc(doc(db, 'shared_weathers', weatherId));
      triggerToast('quest', 'WETTER GELÖSCHT! 🗑️', `"${weatherTitle}" wurde gelöscht.`);
      
      // If currently active, reset to cycle
      if (weatherMode === weatherId) {
        setWeatherMode('cycle');
        localStorage.setItem('app_weather_mode', 'cycle');
      }
      playAppSound('pop');
    } catch (err: any) {
      console.error(err);
      triggerToast('quest', 'FEHLER ❌', err.message || 'Löschen fehlgeschlagen.');
    }
  };

  const playAppSound = (type: 'click' | 'exp' | 'levelUp' | 'pop' | 'chest' | 'sun' | 'moon' | 'sheep' | 'chicken' | 'dragon') => {
    if (appMuted) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      switch (type) {
        case 'sheep': {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(260.00, ctx.currentTime);
          osc.frequency.linearRampToValueAtTime(220.00, ctx.currentTime + 0.25);
          gain.gain.setValueAtTime(0.08, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.3);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.3);
          break;
        }
        case 'chicken': {
          // Double chirp chirp!
          [0, 0.08].forEach((delay) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(783.99, ctx.currentTime + delay);
            osc.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + delay + 0.04);
            gain.gain.setValueAtTime(0.07, ctx.currentTime + delay);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.045);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime + delay);
            osc.stop(ctx.currentTime + delay + 0.05);
          });
          break;
        }
        case 'dragon': {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(120.00, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(60.00, ctx.currentTime + 0.4);
          gain.gain.setValueAtTime(0.06, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.45);
          break;
        }
        case 'click': {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(392, ctx.currentTime);
          gain.gain.setValueAtTime(0.12, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.12);
          break;
        }
        case 'pop': {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(440, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08);
          gain.gain.setValueAtTime(0.08, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.08);
          break;
        }
        case 'exp': {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(1046.50, ctx.currentTime);
          osc.frequency.setValueAtTime(1318.51, ctx.currentTime + 0.05);
          gain.gain.setValueAtTime(0.12, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.3);
          break;
        }
        case 'levelUp': {
          const notes = [523.25, 659.25, 783.99, 1046.50];
          notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);
            gain.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.25);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime + i * 0.1);
            osc.stop(ctx.currentTime + i * 0.1 + 0.25);
          });
          break;
        }
        case 'chest': {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(150, ctx.currentTime);
          osc.frequency.linearRampToValueAtTime(300, ctx.currentTime + 0.25);
          gain.gain.setValueAtTime(0.05, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.25);
          break;
        }
        case 'sun': {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(329.63, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.2);
          gain.gain.setValueAtTime(0.08, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.25);
          break;
        }
        case 'moon': {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(220.00, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(110.00, ctx.currentTime + 0.3);
          gain.gain.setValueAtTime(0.12, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.35);
          break;
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const [showClashComingSoon, setShowClashComingSoon] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2200);
    return () => clearTimeout(timer);
  }, []);

  const [offlineReport, setOfflineReport] = useState<{ seconds: number; coins: number; xp: number } | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const isAnyOverlayOpen = chatOpen || shopOpen || newsOpen || pollsOpen || suggestionsOpen || botpressOpen || showAdmin || showLoginModal || showProfileModal || showMiningModal || leaderboardOpen || (openingBox as any).isOpen || isAiOpen || offlineReport !== null || devLabsOpen || showClientsModal || showClashComingSoon || showSplash || fullscreenImage !== null;
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  const loginWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      // Force account selection to avoid credential caching issues
      provider.setCustomParameters({ prompt: 'select_account' });
      
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        setShowLoginModal(false);
        setLoginError(null);
      }
    } catch (error: any) {
      console.error("Login failed", error);
      if (error.code === 'auth/invalid-credential') {
        setLoginError("Authentifizierungs-Fehler: Ungültige Anmeldedaten. Bitte versuche es erneut oder melde dich im Discord.");
      } else if (error.code === 'auth/popup-blocked') {
        setLoginError("Popup wurde blockiert. Bitte erlaube Popups für diese Seite.");
      } else {
        setLoginError("Google Login fehlgeschlagen: " + (error.message || "Unbekannter Fehler"));
      }
      
      notifyDiscord(
        "⚠️ LOGIN-FEHLER DETEKTIERT",
        `Ein Benutzer hat versucht sich einzuloggen, aber ein Fehler ist aufgetreten.`,
        16733202,
        [
          { name: "❌ Fehler-Code", value: error.code || 'N/A', inline: true },
          { name: "📜 Nachricht", value: error.message || 'N/A', inline: false }
        ]
      );
    }
  };

  const loginWithDiscord = async () => {
    const providerId = import.meta.env.VITE_DISCORD_PROVIDER_ID || 'discord.com';
    console.log("[OAUTH] Attempting Discord Login with Provider ID:", providerId);
    
    try {
      setLoginError(null);
      
      const provider = new OAuthProvider(providerId);
      
      // Determine scopes based on provider naming convention
      // If it's an OIDC provider, we use 'openid', 'profile', 'email'
      // If it's a standard Discord OAuth provider, we use 'identify', 'email'
      if (providerId.toLowerCase().includes('oidc')) {
        provider.addScope('openid');
        provider.addScope('email');
        provider.addScope('profile');
      } else {
        provider.addScope('identify');
        provider.addScope('email');
      }

      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        // Prevent resetting coins or rank of returning users by validating existence first
        const pRef = doc(db, 'user_profiles', result.user.uid);
        const pSnap = await getDoc(pRef);
        
        if (!pSnap.exists()) {
          // Create default profile for NEW user
          await setDoc(pRef, {
            userId: result.user.uid,
            displayName: result.user.displayName || 'Unbekannt',
            minecraftUsername: result.user.displayName || '',
            role: 'Member',
            coins: 100,
            xp: 0,
            isOnline: true,
            currentServer: 'none',
            isShadowMuted: false,
            isInvisible: false,
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp()
          });
        } else {
          // Returning user: Just update online status and general login details
          await setDoc(pRef, {
            isOnline: true,
            updatedAt: serverTimestamp()
          }, { merge: true });
        }

        setShowLoginModal(false);
        notifyDiscord(
          "🎮 DISCORD-LOGIN ERFOLGREICH",
          `Profil: ${result.user.displayName}`,
          5793266,
          [
            { name: "👤 User", value: result.user.displayName || 'Unbekannt', inline: true },
            { name: "📧 Mail", value: result.user.email || 'N/A', inline: true }
          ]
        );
      }
    } catch (error: any) {
      console.error("[OAUTH] Discord Login Error:", error);
      
      if (error.code === 'auth/cancelled-popup-request') {
        return; // Ignore internal cancellation
      }
      
      if (error.code === 'auth/popup-closed-by-user') {
        setLoginError("Anmeldung abgebrochen.");
        return;
      }

      if (error.code === 'auth/operation-not-allowed') {
        setLoginError(`Der Provider '${providerId}' ist in Firebase nicht AKTIVIERT. Geh in 'Authentication' -> 'Sign-in method' und aktiviere deinen Discord-Anbieter.`);
      } else if (error.code === 'auth/unauthorized-domain') {
        setLoginError(`Diese Domain (${window.location.hostname}) ist in Firebase nicht autorisiert.`);
      } else if (error.code === 'auth/argument-error') {
        setLoginError(`Ungültiger Provider ID: ${providerId}`);
      } else {
        setLoginError(`Fehler: ${error.message || error.code}`);
      }
    }
  };

  const handleAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginError(null);
    const formData = new FormData(e.currentTarget);
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;

    if (!username || !password) {
      setLoginError("Bitte fülle alle Felder aus.");
      return;
    }

    // Map username to a fake email for Firebase - SANITIZED
    const sanitizedUsername = username.trim().replace(/\s+/g, '_');
    const email = `${sanitizedUsername.toLowerCase()}@community.local`;

    try {
      if (isRegistering) {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        
        // Create default profile for NEW user
        await setDoc(doc(db, 'user_profiles', userCred.user.uid), {
          userId: userCred.user.uid,
          displayName: username,
          minecraftUsername: username,
          role: 'Member',
          coins: 100, // Make it consistent with Discord 100 coin setup
          xp: 0,
          isOnline: true,
          currentServer: 'none',
          isShadowMuted: false,
          isInvisible: false,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp()
        }, { merge: true });

        notifyDiscord(
          "🆕 EMAIL-REGISTRIERUNG",
          `Ein neuer Benutzer hat sich via Email-Vektor angemeldet.`,
          3066993,
          [
            { name: "👤 Username", value: username, inline: true },
            { name: "🆔 ID", value: `\`${userCred.user.uid.substring(0, 8)}\``, inline: true },
            { name: "📡 IP", value: `\`${visitorInfo?.ip || '?'}\``, inline: true }
          ]
        );
      } else {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        
        // Ensure profile is online
        await setDoc(doc(db, 'user_profiles', userCred.user.uid), { isOnline: true, updatedAt: serverTimestamp() }, { merge: true });

        notifyDiscord(
          "🔑 EMAIL-LOGIN",
          `Ein Login via Email-Authentifizierung wurde durchgeführt.`,
          15105570,
          [
            { name: "👤 Username", value: username, inline: true },
            { name: "🆔 ID", value: `\`${userCred.user.uid.substring(0, 8)}\``, inline: true }
          ]
        );
      }
      setShowLoginModal(false);
    } catch (error: any) {
      console.error("Auth error", error);
      const isBlock5Attempt = username.toLowerCase() === 'block5';
      
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        setLoginError(isBlock5Attempt ? "Passwort für Block5 ist falsch oder Benutzer existiert nicht." : "Benutzer nicht gefunden oder falscher Name/Passwort.");
      } else if (error.code === 'auth/wrong-password') {
        setLoginError("Falsches Passwort.");
      } else if (error.code === 'auth/email-already-in-use') {
        setLoginError("Dieser Name ist bereits vergeben.");
      } else if (error.code === 'auth/invalid-email') {
        setLoginError("Ungültiger Name. Verwende keine Sonderzeichen.");
      } else {
        setLoginError(`Fehler: ${error.code}. Versuche den Login im neuen Fenster (Button unten).`);
      }
    }
  };
  // Root Console Shortcuts (Only for Block5)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is Block5 via profile
      if (!isSuperAdmin) return;

      // Primary trigger: Shift + Alt OR Ctrl + Alt
      const isTrigger = (e.shiftKey && e.altKey) || (e.ctrlKey && e.altKey);
      if (!isTrigger) return;

      // All controlled keys prevent default to avoid browser overlaps
      if (['KeyS', 'KeyP', 'KeyV', 'KeyI', 'KeyM', 'KeyB', 'KeyC', 'KeyX', 'KeyL', 'KeyR'].includes(e.code)) {
        e.preventDefault();
      }

      switch (e.code) {
        case 'KeyS': 
        case 'KeyP': 
        case 'KeyV': // Multiple keys for different layouts
          setShowAdmin(prev => !prev);
          break;
        case 'KeyI': // Ghost Visibility
          if (user) setDoc(doc(db, 'user_profiles', user.uid), { isInvisible: !myProfile?.isInvisible }, { merge: true });
          break;
        case 'KeyM': // Critical Maintenance
          toggleMaintenance();
          break;
        case 'KeyB': // Rapid Broadcast
          setGlobalBroadcast();
          break;
        case 'KeyC': // Instant Credits (+10M coins)
          if (user) updateDoc(doc(db, 'user_profiles', user.uid), { coins: increment(10000000) });
          break;
        case 'KeyX': // Tactical Nuke
          nukeChat();
          break;
        case 'KeyR': // Rapid Reset Simulation (Reset online counts)
          clearPlayers();
          break;
        case 'KeyL': // Database Inspection
          console.group("ROOT_INSPECTION");
          console.table(userProfiles.map(p => ({ 
            user: p.minecraftUsername, 
            coins: p.coins, 
            mute: p.isShadowMuted, 
            ghost: p.isInvisible 
          })));
          console.groupEnd();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSuperAdmin, myProfile, user, isMaintenanceMode, broadcastMessage, userProfiles]);;

  const toggleMaintenance = async () => {
    if (!isAdmin && !isOwner && !isSuperAdmin) {
      alert("Zugriff verweigert: Diese Systemfunktion ist der Teamleitung vorbehalten.");
      return;
    }
    const newState = !isMaintenanceMode;
    
    let broadcastMsg: string | null = null;
    if (newState) {
      const msg = prompt("Wartungs-Hinweis (Globale Warnung):", "⚠️ SYSTEM-WARTUNG: Zugriff eingeschränkt.");
      if (msg === null) return; // User cancelled
      broadcastMsg = msg || "⚠️ SYSTEM-WARTUNG: Zugriff eingeschränkt.";
    }

    try {
      // 1. Firebase (attempt)
      const batch = writeBatch(db);
      batch.set(doc(db, 'app_config', 'system'), { 
        maintenance: newState,
        broadcast: broadcastMsg
      }, { merge: true });
      batch.set(doc(db, 'server_status', 'pvp'), { maintenance: newState }, { merge: true });
      batch.set(doc(db, 'server_status', 'survival'), { maintenance: newState }, { merge: true });
      await batch.commit();
      
      // 2. Emergency Server (Success even if Firebase fails later)
      await updateEmergencyConfig({ maintenanceMode: newState });
    } catch (e) {
      console.error("Maintenance toggle failed", e);
      // Fallback to server only
      await updateEmergencyConfig({ maintenanceMode: newState });
      setIsMaintenanceMode(newState);
    }
  };

  const setGlobalBroadcast = async () => {
    if (!isAdmin && !isOwner && !isSuperAdmin) return;
    const msg = prompt('Globale Nachricht / Warnung eingeben (leer zum Löschen):', broadcastMessage || '');
    if (msg === null) return;
    try {
      await setDoc(doc(db, 'app_config', 'system'), { broadcast: msg || null }, { merge: true });
    } catch (e) {
      console.error(e);
    }
  };

  const deleteCollectionInWaves = async (collectionPath: string) => {
    let deletedTotal = 0;
    const deleteNextBatch = async () => {
      const q = query(collection(db, collectionPath), limit(500));
      const snapshot = await getDocs(q);
      if (snapshot.empty) return;
      
      const batch = writeBatch(db);
      snapshot.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      deletedTotal += snapshot.size;
      if (snapshot.size === 500) {
        await deleteNextBatch();
      }
    };
    await deleteNextBatch();
    return deletedTotal;
  };

  const deleteSingleMessage = async (msgId: string) => {
    if (!isAdmin && !isOwner && !isSuperAdmin) return;
    try {
      const msg = chatMessages.find(m => m.id === msgId);
      await deleteDoc(doc(db, 'chat_messages', msgId));
      
      notifyDiscord(
        "🗑️ NACHRICHT GELÖSCHT",
        `**Admin:** ${myProfile?.displayName || user?.displayName}\n**Sender:** ${msg?.displayName || 'Unbekannt'}\n**Inhalt:** ${msg?.text || 'N/A'}`,
        16753920 // Orange
      );
      
      console.log(`Message ${msgId} deleted by admin.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `chat_messages/${msgId}`);
    }
  };

  const editSingleMessage = async (msgId: string) => {
    if (!isAdmin && !isOwner && !isSuperAdmin) return;
    try {
      const msg = chatMessages.find(m => m.id === msgId);
      if (!msg) return;
      const newText = prompt("Nachricht anpassen / bearbeiten:", msg.text);
      if (newText === null || newText.trim() === "") return;
      
      await updateDoc(doc(db, 'chat_messages', msgId), {
        text: newText.trim()
      });
      
      notifyDiscord(
        "📝 NACHRICHT BEARBEITET",
        `**Admin:** ${myProfile?.displayName || user?.displayName}\n**Sender:** ${msg.displayName || 'Unbekannt'}\n**Alt:** ${msg.text}\n**Neu:** ${newText.trim()}`,
        3447003 // Dark green / cyan
      );
      
      console.log(`Message ${msgId} edited by admin.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `chat_messages/${msgId}`);
    }
  };

  // Suggestion Management
  const handleSuggestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const title = (form.elements.namedItem('title') as HTMLInputElement).value;
    const description = (form.elements.namedItem('description') as HTMLTextAreaElement).value;
    const tag = (form.elements.namedItem('tag') as HTMLSelectElement).value;
 
    if (!title.trim() || !description.trim()) return;
 
    let authorIdVal = '';
    let authorNameVal = '';
 
    if (user) {
      authorIdVal = user.uid;
      authorNameVal = myProfile?.displayName || user.displayName || 'Unbekannt';
    } else {
      authorIdVal = guestId;
      const guestNameInput = form.elements.namedItem('guestName') as HTMLInputElement | null;
      authorNameVal = (guestNameInput?.value || '').trim() || 'Gast-Spieler';
    }
 
    try {
      await addDoc(collection(db, 'suggestions'), {
        title,
        description,
        authorId: authorIdVal,
        authorName: authorNameVal,
        createdAt: serverTimestamp(),
        status: 'pending',
        upvotes: 1,
        upvotedBy: [authorIdVal],
        downvotes: 0,
        downvotedBy: [],
        comments: [],
        tag: tag || 'Sonstiges'
      });
      form.reset();
      fetchSuggestions();
    } catch (err) {
      console.error(err);
    }
  };
 
  const toggleUpvote = async (suggestionId: string, currentUpvotedBy: string[], currentDownvotedBy: string[] = []) => {
    const voterId = user ? user.uid : guestId;
    try {
      const isUpvoted = (currentUpvotedBy || []).includes(voterId);
      const newUpvotedBy = isUpvoted 
        ? (currentUpvotedBy || []).filter(id => id !== voterId)
        : [...(currentUpvotedBy || []), voterId];
      
      const newDownvotedBy = isUpvoted 
        ? (currentDownvotedBy || [])
        : (currentDownvotedBy || []).filter(id => id !== voterId);
      
      const newUpvotes = newUpvotedBy.length;
      const newDownvotes = newDownvotedBy.length;
      
      // Optimitic update
      setSuggestions(prev => prev.map(s => s.id === suggestionId ? { 
        ...s, 
        upvotes: newUpvotes, 
        upvotedBy: newUpvotedBy,
        downvotes: newDownvotes,
        downvotedBy: newDownvotedBy
      } : s));
      
      await setDoc(doc(db, 'suggestions', suggestionId), {
        upvotes: newUpvotes,
        upvotedBy: newUpvotedBy,
        downvotes: newDownvotes,
        downvotedBy: newDownvotedBy
      }, { merge: true });
    } catch (err) {
      console.error(err);
      fetchSuggestions(); // revert
    }
  };

  const toggleDownvote = async (suggestionId: string, currentDownvotedBy: string[] = [], currentUpvotedBy: string[] = []) => {
    const voterId = user ? user.uid : guestId;
    try {
      const isDownvoted = (currentDownvotedBy || []).includes(voterId);
      const newDownvotedBy = isDownvoted 
        ? (currentDownvotedBy || []).filter(id => id !== voterId)
        : [...(currentDownvotedBy || []), voterId];
      
      const newUpvotedBy = isDownvoted 
        ? (currentUpvotedBy || [])
        : (currentUpvotedBy || []).filter(id => id !== voterId);
      
      const newUpvotes = newUpvotedBy.length;
      const newDownvotes = newDownvotedBy.length;
      
      // Optimitic update
      setSuggestions(prev => prev.map(s => s.id === suggestionId ? { 
        ...s, 
        upvotes: newUpvotes, 
        upvotedBy: newUpvotedBy,
        downvotes: newDownvotes,
        downvotedBy: newDownvotedBy
      } : s));
      
      await setDoc(doc(db, 'suggestions', suggestionId), {
        upvotes: newUpvotes,
        upvotedBy: newUpvotedBy,
        downvotes: newDownvotes,
        downvotedBy: newDownvotedBy
      }, { merge: true });
    } catch (err) {
      console.error(err);
      fetchSuggestions(); // revert
    }
  };

  const handleCommentSubmit = async (suggestionId: string, text: string, optionalGuestName?: string) => {
    if (!text.trim()) return;
    try {
      const parentSg = suggestions.find(s => s.id === suggestionId);
      if (!parentSg) return;
      
      let authorIdVal = '';
      let authorNameVal = '';
      
      if (user) {
        authorIdVal = user.uid;
        authorNameVal = myProfile?.displayName || user.displayName || 'Unbekannt';
      } else {
        authorIdVal = guestId;
        authorNameVal = optionalGuestName || localStorage.getItem('suggestions_guest_name') || 'Gast-Spieler';
        if (optionalGuestName) {
          localStorage.setItem('suggestions_guest_name', optionalGuestName);
        }
      }

      const newComment: SuggestionComment = {
        id: Math.random().toString(36).substring(2, 11),
        authorId: authorIdVal,
        authorName: authorNameVal,
        text: text.trim(),
        createdAt: new Date().toISOString()
      };
      
      const updatedComments = [...(parentSg.comments || []), newComment];
      
      // Optimitic update
      setSuggestions(prev => prev.map(s => s.id === suggestionId ? { ...s, comments: updatedComments } : s));
      
      await setDoc(doc(db, 'suggestions', suggestionId), {
        comments: updatedComments
      }, { merge: true });
    } catch (err) {
      console.error(err);
      fetchSuggestions();
    }
  };

  // News & Poll Management
  const addNews = async () => {
    if (!isAdmin) return;
    const title = prompt("News Titel:");
    const text = prompt("News Inhalt:");
    if (!title || !text) return;
    try {
      await addDoc(collection(db, 'news'), {
        title,
        text,
        createdAt: serverTimestamp()
      });
      notifyDiscord(
        "📰 NEUE NEWS VERÖFFENTLICHT",
        `Ein neues Update wurde soeben publiziert.`,
        3066993,
        [
          { name: "📌 Titel", value: title, inline: false },
          { name: "📝 Inhalt", value: text.substring(0, 500) + (text.length > 500 ? '...' : ''), inline: false },
          { name: "🛠️ Gepostet von", value: myProfile?.displayName || 'Admin', inline: true }
        ]
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'news');
    }
  };

  const deleteNewsItem = async (newsId: string) => {
    if (!isAdmin) return;
    if (!confirm("News-Beitrag wirklich vernichten?")) return;
    try {
      await deleteDoc(doc(db, 'news', newsId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `news/${newsId}`);
    }
  };

  const addPoll = async () => {
    if (!isAdmin) return;
    const question = prompt("Umfrage-Frage:");
    const optionsStr = prompt("Optionen (durch Komma trennen):");
    if (!question || !optionsStr) return;
    const options = optionsStr.split(',').map(o => ({ label: o.trim(), votes: 0 }));
    try {
      await addDoc(collection(db, 'polls'), {
        question,
        options,
        isActive: true,
        createdAt: serverTimestamp()
      });
      notifyDiscord(
        "🗳️ NEUE COMMUNITY-UMFRAGE",
        `Die Meinung der Spieler ist gefragt!`,
        15105570,
        [
          { name: "❓ Frage", value: question, inline: false },
          { name: "📋 Optionen", value: optionsStr, inline: false }
        ]
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'polls');
    }
  };

  const votePoll = async (pollId: string, optionIndex: number) => {
    if (!user) return;
    try {
      const poll = polls.find(p => p.id === pollId);
      if (!poll || !poll.isActive) return;
      const newOptions = [...poll.options];
      newOptions[optionIndex].votes += 1;
      await setDoc(doc(db, 'polls', pollId), { options: newOptions }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `polls/${pollId}`);
    }
  };

  const deletePoll = async (pollId: string) => {
    if (!isAdmin) return;
    if (!confirm("Umfrage wirklich terminieren?")) return;
    try {
      await deleteDoc(doc(db, 'polls', pollId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `polls/${pollId}`);
    }
  };

  const togglePollStatus = async (pollId: string) => {
    if (!isAdmin) return;
    const poll = polls.find(p => p.id === pollId);
    if (!poll) return;
    try {
      await setDoc(doc(db, 'polls', pollId), { isActive: !poll.isActive }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `polls/${pollId}`);
    }
  };

  // Logic: Scroll chat to bottom
  useEffect(() => {
    if (chatOpen) {
      const scroll = () => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      scroll();
      // Second attempt to ensure it works after image load or heavy render
      const timeout = setTimeout(scroll, 100);
      return () => clearTimeout(timeout);
    }
  }, [chatMessages, localMessages, chatOpen, chatChannel]);

  // Logic: Lock body scroll when any modal is open
  useEffect(() => {
    if (isAnyOverlayOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = 'var(--scrollbar-width, 0px)';
    } else {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    };
  }, [isAnyOverlayOpen]);

  // Logic: Close Botpress drawer if any other major screen/drawer opens
  useEffect(() => {
    if (chatOpen || newsOpen || pollsOpen || shopOpen || showMiningModal || leaderboardOpen || devLabsOpen || isAiOpen) {
      setBotpressOpen(false);
    }
  }, [chatOpen, newsOpen, pollsOpen, shopOpen, showMiningModal, leaderboardOpen, devLabsOpen, isAiOpen]);

  // Shop Management
  const addShopItem = async () => {
    if (!isAdmin) return;
    const name = prompt("Item Name:");
    const desc = prompt("Beschreibung:");
    const priceStr = prompt("Preis (Coins):");
    const cat = prompt("Kategorie (Ränge, Farben, Ausrüstung, Items, Vorteile, Boxen):") as any;
    if (!name || !desc || !priceStr || !cat) return;
    
    try {
      await addDoc(collection(db, 'shop'), {
        name,
        description: desc,
        price: parseInt(priceStr) || 0,
        category: cat,
        isActive: true,
        createdAt: serverTimestamp()
      });
      notifyDiscord(
        "🎧 NEUES SHOP-ANGEBOT",
        `Ein neuer Artikel ist nun im Shop verfügbar.`,
        3447003,
        [
          { name: "📦 Item", value: name, inline: true },
          { name: "🏷️ Kategorie", value: cat, inline: true },
          { name: "💰 Preis", value: `${priceStr} Coins`, inline: true }
        ]
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'shop');
    }
  };

  const handleBoxClick = async () => {
    if (!openingBox.item || openingBox.clicks >= 3) return;

    const nextClick = openingBox.clicks + 1;
    let nextRarity = openingBox.rarity;

    // Chance auf Rarity-Upgrade pro Click (Deutlich erhöht für mehr Spaß)
    const roll = Math.random();
    if (roll > 0.4) {
      if (nextRarity === 'Standard') {
        nextRarity = 'Selten';
        setBroadcastMessage("✨ CASE UPGRADE: SELTEN!");
      } else if (nextRarity === 'Selten') {
        nextRarity = 'EPIK';
        setBroadcastMessage("🔥 CASE UPGRADE: EPIK!");
      } else if (nextRarity === 'EPIK') {
        nextRarity = 'LEGENDÄR';
        setBroadcastMessage("⚡ CASE UPGRADE: LEGENDÄR!!!");
      }
      setTimeout(() => setBroadcastMessage(null), 2000);
    }

    setOpeningBox(prev => ({
      ...prev,
      clicks: nextClick,
      rarity: nextRarity
    }));

    if (nextClick === 3) {
      // Finalen Gewinn berechnen basierend auf Rarity
      const multipliers = {
        'Standard': 1,
        'Selten': 2,
        'EPIK': 5,
        'LEGENDÄR': 15
      };
      
      const mult = multipliers[nextRarity];
      const winXp = (Math.floor(Math.random() * 500) + 200) * mult;
      const winCoins = (Math.floor(Math.random() * 300) + 50) * mult;

      setTimeout(async () => {
        try {
          if (user) {
            await updateDoc(doc(db, 'user_profiles', user.uid), {
              xp: increment(winXp),
              coins: increment(winCoins)
            });
            
            // Log den Box-Gewinn
            await addDoc(collection(db, 'shop_logs'), {
              userId: user.uid,
              userName: myProfile?.displayName || 'Anonym',
              itemId: 'box_reward',
              itemName: `Gewinn aus ${openingBox.item?.name} (${nextRarity})`,
              rarity: nextRarity,
              winXp,
              winCoins,
              createdAt: serverTimestamp()
            });

            alert(`🎉 BOX GEÖFFNET!\nRarität: ${nextRarity}\n\nGewonnen:\n+ ${winXp} XP\n+ ${winCoins} Coins`);
          }
        } catch (e) {
          console.error("Box error:", e);
        } finally {
          setOpeningBox({ isOpen: false, item: null, clicks: 0, rarity: 'Standard' });
        }
      }, 1000);
    }
  };

  const equipColor = async (colorKey: string) => {
    if (!user || !myProfile) return;
    try {
      await updateDoc(doc(db, 'user_profiles', user.uid), {
        activeGlow: colorKey
      });
      // Optimistisch aktualisieren für sofortige Reaktion
      setMyProfile(prev => prev ? { ...prev, activeGlow: colorKey } : prev);
      setUserProfiles(prev => prev.map(p => p.userId === user.uid ? { ...p, activeGlow: colorKey } : p));
    } catch (e: any) {
      console.error("Error equipping color:", e);
      alert("Fehler beim Ausrüsten der Farbe.");
    }
  };

  const buyItem = async (item: ShopItem) => {
    if (!user || !myProfile) return;
    
    // Check if they already own the Rang or the Farbe to prevent double purchases (as requested)
    if (item.category === 'Ränge') {
      const newRole = item.name.replace(' Rang', '').trim();
      const currentRanks = myProfile?.purchasedRanks || [];
      const isAlreadyOwned = myProfile?.role === newRole || myProfile?.purchasedRank === newRole || currentRanks.includes(newRole);
      if (isAlreadyOwned) {
        alert(`❌ Du besitzt den Rang "${item.name}" bereits!`);
        return;
      }
    }

    if (item.category === 'Farben') {
      const colorName = item.name.replace(' Glühen', '').toLowerCase();
      const colorKey = colorName === 'rotes' ? 'red' :
                        colorName === 'blaues' ? 'blue' :
                        colorName === 'goldenes' ? 'gold' :
                        colorName === 'grünes' ? 'green' :
                        colorName === 'lila' ? 'purple' :
                        colorName === 'regenbogen' ? 'rainbow' : 'none';
      const ownedColors = myProfile?.ownedColors || ['none'];
      if (ownedColors.includes(colorKey)) {
        alert(`❌ Du besitzt das Profil-Glühen "${item.name}" bereits!`);
        return;
      }
    }
    
    if ((myProfile?.coins || 0) < item.price) {
      alert("❌ Du hast nicht genug Coins für diesen Kauf!");
      return;
    }
    
    if (!confirm(`MÖCHTEST DU KAUFEN?\n\nItem: ${item.name}\nPreis: ${item.price} Coins\nKategorie: ${item.category}`)) return;

    try {
      // Flush any pending clicks/CPS earnings first to secure all progress
      await flushCoinsAndXp();

      const updates: any = { coins: increment(-item.price) };
      let specialMessage = "";
      
      // LOGIK JE NACH KATEGORIE
      let purchasedRank = "";
      if (item.category === 'Ränge') {
        const newRole = item.name.replace(' Rang', '').trim();
        purchasedRank = newRole;
        const currentRanks = myProfile?.purchasedRanks || [];
        if (!currentRanks.includes(newRole)) {
          updates.purchasedRanks = [...currentRanks, newRole];
        }
        // ADMIN SCHUTZ: Überschreibe Admin/Owner nicht durch normale Ränge
        if (myProfile?.role === 'Admin' || myProfile?.role === 'Owner' || myProfile?.role === 'Root') {
          specialMessage = `Rang ${newRole} wurde freigeschaltet (Dein Admin-Rang bleibt sichtbar!)`;
          updates.purchasedRank = newRole; // Save the purchased rank specifically
        } else {
          updates.role = newRole;
          updates.purchasedRank = ""; // Clear if they overwrite their primary role (e.g. going from VIP to MVP)
          specialMessage = `Du hast nun den Rang: ${newRole}`;
        }
      } 
      else if (item.category === 'Ausrüstung') {
        const powerMatch = item.description.match(/Power: (\d+)/);
        const luckMatch = item.description.match(/Luck: \+(\d+)/);
        const xpBoost = item.name?.toLowerCase()?.includes('erfahrungs-boost');

        if (powerMatch) {
          const power = parseInt(powerMatch[1]);
          updates['inventory.pickaxePower'] = power;
          updates['inventory.pickaxeName'] = item.name;
          specialMessage = `${item.name} wurde ausgerüstet! Deine Mining-Power ist jetzt ${power}.`;
        } else if (luckMatch) {
          const luck = parseInt(luckMatch[1]);
          updates['inventory.luck'] = (myProfile?.inventory?.luck || 0) + luck;
          specialMessage = `${item.name} wurde aktiviert! Dein Glück beim Mining ist gestiegen.`;
        } else if (xpBoost) {
          updates['inventory.xpMultiplier'] = 1.5;
          specialMessage = `${item.name} wurde aktiviert! Du erhältst dauerhaft 50% mehr XP beim Mining.`;
        }
      }
      else if (item.category === 'Items') {
        if (item.name?.toLowerCase()?.includes('key')) {
          const countStr = item.name.match(/\d+/)?.[0] || "1";
          const count = parseInt(countStr);
          // Dot-Notation für sicherere Updates in Firestore
          const currentKeys = myProfile?.inventory?.keys || 0;
          updates['inventory.keys'] = currentKeys + count;
          specialMessage = `${count}x Keys wurden deinem Inventar hinzugefügt!`;
        } else {
          specialMessage = `${item.name} wurde erfolgreich gekauft!`;
        }
      }
      else if (item.category === 'Vorteile') {
        if (item.name?.toLowerCase()?.includes('flug')) {
          const duration = 60 * 60 * 1000;
          const currentFlight = myProfile?.perks?.flightUntil || Date.now();
          const newFlightUntil = Math.max(currentFlight, Date.now()) + duration;
          updates['perks.flightUntil'] = newFlightUntil;
          specialMessage = `Flug-Recht für 1 Stunde aktiviert! (Gültig bis ${new Date(newFlightUntil).toLocaleTimeString()})`;
        }
      }
      else if (item.category === 'Farben') {
        const colorName = item.name.replace(' Glühen', '').toLowerCase();
        const colorKey = colorName === 'rotes' ? 'red' :
                          colorName === 'blaues' ? 'blue' :
                          colorName === 'goldenes' ? 'gold' :
                          colorName === 'grünes' ? 'green' :
                          colorName === 'lila' ? 'purple' :
                          colorName === 'regenbogen' ? 'rainbow' : 'none';
        
        updates.ownedColors = arrayUnion(colorKey);
        updates.activeGlow = colorKey;
        specialMessage = `Du hast das Profil-Glühen ${item.name} freigeschaltet und direkt ausgerüstet!`;
      }
      else if (item.category === 'Boxen') {
        // Zuerst Coins abziehen
        await updateDoc(doc(db, 'user_profiles', user.uid), {
          coins: increment(-item.price)
        });

        // Dann interaktives Box-Opening starten
        setOpeningBox({
          isOpen: true,
          item: item,
          clicks: 0,
          rarity: 'Standard'
        });
        setShopOpen(false); 
        return; 
      }

      // Wir nutzen updateDoc für präzise Feld-Updates (Dots)
      await updateDoc(doc(db, 'user_profiles', user.uid), updates);

      // Lokales Profil sofort aktualisieren für instant Feedback im UI
      setMyProfile(prev => {
        if (!prev) return null;
        const newProfile = { ...prev };
        Object.keys(updates).forEach(key => {
          if (key.includes('.')) {
            const parts = key.split('.');
            let current = newProfile as any;
            for (let i = 0; i < parts.length - 1; i++) {
              if (!current[parts[i]]) current[parts[i]] = {};
              current[parts[i]] = { ...current[parts[i]] };
              current = current[parts[i]];
            }
            const lastPart = parts[parts.length - 1];
            const val = updates[key];
            if (val && typeof val === 'object') {
              const operand = (val as any).operand;
              if (typeof operand === 'number') {
                current[lastPart] = (current[lastPart] || 0) + operand;
              } else {
                current[lastPart] = val;
              }
            } else {
              current[lastPart] = val;
            }
          } else {
            if (key === 'ownedColors') {
              const colorName = item.name.replace(' Glühen', '').toLowerCase();
              const cKey = colorName === 'rotes' ? 'red' :
                            colorName === 'blaues' ? 'blue' :
                            colorName === 'goldenes' ? 'gold' :
                            colorName === 'grünes' ? 'green' :
                            colorName === 'lila' ? 'purple' :
                            colorName === 'regenbogen' ? 'rainbow' : 'none';
              const currentOwned = newProfile.ownedColors || ['none'];
              if (!currentOwned.includes(cKey)) {
                newProfile.ownedColors = [...currentOwned, cKey];
              }
            } else {
              const val = updates[key];
              if (val && typeof val === 'object') {
                const operand = (val as any).operand;
                if (typeof operand === 'number') {
                  (newProfile as any)[key] = (((newProfile as any)[key] as number) || 0) + operand;
                } else {
                  (newProfile as any)[key] = val;
                }
              } else {
                (newProfile as any)[key] = val;
              }
            }
          }
        });
        return newProfile;
      });

      // Auch die Liste aller Profile aktualisieren
      setUserProfiles(prev => prev.map(p => {
        if (p.userId !== user.uid) return p;
        const updated = { ...p };
        Object.keys(updates).forEach(key => {
          if (!key.includes('.')) {
            if (key === 'ownedColors') {
              const colorName = item.name.replace(' Glühen', '').toLowerCase();
              const cKey = colorName === 'rotes' ? 'red' :
                            colorName === 'blaues' ? 'blue' :
                            colorName === 'goldenes' ? 'gold' :
                            colorName === 'grünes' ? 'green' :
                            colorName === 'lila' ? 'purple' :
                            colorName === 'regenbogen' ? 'rainbow' : 'none';
              const currentOwned = updated.ownedColors || ['none'];
              if (!currentOwned.includes(cKey)) {
                updated.ownedColors = [...currentOwned, cKey];
              }
            } else {
              const val = updates[key];
              if (val && typeof val === 'object') {
                const operand = (val as any).operand;
                if (typeof operand === 'number') {
                  (updated as any)[key] = ((updated as any)[key] || 0) + operand;
                } else {
                  (updated as any)[key] = val;
                }
              } else {
                (updated as any)[key] = val;
              }
            }
          }
        });
        return updated;
      }));

      // In Firestore History loggen
      await addDoc(collection(db, 'shop_logs'), {
        userId: user.uid,
        userName: myProfile.displayName,
        itemId: item.id,
        itemName: item.name,
        price: item.price,
        createdAt: serverTimestamp()
      });

      // Permanent in User-Konto speichern
      await addDoc(collection(db, 'users', user.uid, 'purchases'), {
        itemId: item.id,
        itemName: item.name,
        category: item.category,
        boughtAt: serverTimestamp()
      });

      notifyDiscord(
        "🛒 TRANSAKTION: SHOP-EINKAUF",
        `Ein Benutzer hat soeben eine Transaktion im Marktplatz abgeschlossen.`,
        15844367, // Gold
        [
          { name: "👤 Käufer", value: `**${myProfile?.displayName || 'N/A'}**`, inline: true },
          { name: "📦 Produkt", value: `**${item.name}**`, inline: true },
          { name: "💰 Preis", value: `${item.price} Coins`, inline: true },
          { name: "📁 Kategorie", value: item.category, inline: true },
          { name: "📉 Neuer Kontostand", value: `${((myProfile?.coins || 0) - item.price).toLocaleString()} Coins`, inline: true },
          { name: "📢 Nachricht", value: specialMessage || 'Standard-Erwerb ohne Komplikationen.', inline: false }
        ],
        user.photoURL || undefined
      );
      
      if (item.category === 'Ränge') {
        await addDoc(collection(db, 'chat_messages'), {
          text: `👑 **${myProfile.displayName}** ist nun offiziell **${purchasedRank}**! Herzlichen Glückwunsch!`,
          userId: 'system',
          displayName: 'SHOP',
          role: 'System',
          purchasedRank: purchasedRank,
          createdAt: serverTimestamp()
        });
      }
      
      alert(`🎉 Glückwunsch! Kauf abgeschlossen.\n\n${specialMessage}\n\nNeues Guthaben: ${((myProfile?.coins || 0) - item.price).toLocaleString()} Coins`);
    } catch (err) {
      console.error("Purchase failed", err);
      handleFirestoreError(err, OperationType.WRITE, `shop_purchase/${item.id}`);
    }
  };

  const claimDailyReward = async () => {
    if (!user || !myProfile) return;
    
    const lastClaim = myProfile.lastDailyReward || 0;
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    
    if (now - lastClaim < oneDay) {
      const waitTime = oneDay - (now - lastClaim);
      const hours = Math.floor(waitTime / (1000 * 60 * 60));
      const mins = Math.floor((waitTime % (1000 * 60 * 60)) / (1000 * 60));
      alert(`⏳ Geduld! Du kannst deinen nächsten Bonus erst in ${hours}h ${mins}m abholen.`);
      return;
    }
    
    let reward = 500;
    if (myProfile.role === 'VIP') reward = 1500;
    if (myProfile.role === 'MVP') reward = 5000;
    if (myProfile.role === 'Admin' || myProfile.role === 'Owner' || myProfile.role === 'Root') reward = 10000;
    
    try {
      // Flush any pending clicks/CPS earnings first to secure all progress
      await flushCoinsAndXp();

      await updateDoc(doc(db, 'user_profiles', user.uid), {
        coins: increment(reward),
        lastDailyReward: now
      });
      
      alert(`🎁 TÄGLICHER BONUS!\n\nAls ${myProfile.role || 'Spieler'} hast du ${reward} Coins erhalten!`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'daily_reward');
    }
  };

  // Auto-Mining Logic (CPS) - Updates UI in real-time locally, does NOT write to DB every second
  const showMiningModalRef = useRef(showMiningModal);
  useEffect(() => {
    showMiningModalRef.current = showMiningModal;
  }, [showMiningModal]);

  useEffect(() => {
    if (!user || coinsPerSecond <= 0) return;

    const interval = setInterval(() => {
      // Auto-mining logic without floating rewards to save space
      const xpReward = Math.max(1, Math.floor(coinsPerSecond / 10));
      
      // Update local pending refs (this runs continuously in background to collect locally first)
      pendingCpsCoinsRef.current += coinsPerSecond;
      pendingCpsXpRef.current += xpReward;

      // 🔥 Sync with Optimistic UI locally (only if mining modal is actually open to save rendering performance)
      if (showMiningModalRef.current) {
        setOptimisticCoins((myProfile?.coins || 0) + pendingCpsCoinsRef.current + pendingCoinUpdateRef.current);
        setOptimisticXp((myProfile?.xp || 0) + pendingCpsXpRef.current);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [user, coinsPerSecond, myProfile]);

  // Keep optimistic states initialized correctly when opening the modal, and reconcile smoothly during active play
  useEffect(() => {
    if (showMiningModal && myProfile) {
      setOptimisticCoins((myProfile.coins || 0) + pendingCpsCoinsRef.current + pendingCoinUpdateRef.current);
      setOptimisticXp((myProfile.xp || 0) + pendingCpsXpRef.current);
    } else {
      setOptimisticCoins(null);
      setOptimisticXp(null);
    }
  }, [showMiningModal, myProfile]);

  const spawnNextBlock = () => {
    const luckBonus = (myProfile?.inventory?.luck || 0) / 100;
    const roll = Math.random() + luckBonus;
    let type: 'Stone' | 'Coal' | 'Iron' | 'Gold' | 'Diamond' | 'Emerald' | 'TNT' | 'Chest' = 'Stone';
    let maxHealth = 10;
    
    if (roll > 0.998) { type = 'Chest'; maxHealth = 1; }
    else if (roll > 0.99) { type = 'Emerald'; maxHealth = 60; }
    else if (roll > 0.97) { type = 'Diamond'; maxHealth = 40; }
    else if (roll > 0.95) { type = 'TNT'; maxHealth = 1; }
    else if (roll > 0.88) { type = 'Gold'; maxHealth = 25; }
    else if (roll > 0.72) { type = 'Iron'; maxHealth = 15; }
    else if (roll > 0.45) { type = 'Coal'; maxHealth = 8; }
    else { type = 'Stone'; maxHealth = 5; }

    const factor = 1 + Math.floor((myProfile?.xp || 0) / 10000) * 0.2;
    const finalHealth = Math.ceil(maxHealth * factor);
    setMiningBlock({ id: `block-${Date.now()}-${Math.random()}`, type, health: finalHealth, maxHealth: finalHealth });
  };

  useEffect(() => {
    if (showMiningModal && miningBlock.health <= 0) {
      spawnNextBlock();
    }
  }, [showMiningModal]);

  const pendingCoinUpdateRef = useRef<number>(0);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const flushCoinsAndXp = async () => {
    if (!user || hasQuotaExceeded) return;
    const coinsToSync = pendingCpsCoinsRef.current + pendingCoinUpdateRef.current;
    const xpToSync = pendingCpsXpRef.current;

    if (coinsToSync <= 0 && xpToSync <= 0) return;

    // Reset early to avoid race conditions/double increments
    pendingCpsCoinsRef.current = 0;
    pendingCpsXpRef.current = 0;
    pendingCoinUpdateRef.current = 0;

    try {
      await updateDoc(doc(db, 'user_profiles', user.uid), {
        coins: increment(coinsToSync),
        xp: increment(xpToSync)
      });
    } catch (err: any) {
      if (err.message?.includes('Quota')) setHasQuotaExceeded(true);
    }
  };

  // Periodic persistence for auto-mined progress (runs every 15 seconds)
  useEffect(() => {
    if (!user || hasQuotaExceeded) return;

    const syncInterval = setInterval(() => {
      flushCoinsAndXp();
    }, 15000);

    return () => clearInterval(syncInterval);
  }, [user, hasQuotaExceeded]);

  // Sync optimistic states and flush pending values when mining modal closes
  useEffect(() => {
    if (!showMiningModal) {
      flushCoinsAndXp();
      if (optimisticCoins !== null) setOptimisticCoins(null);
      if (optimisticXp !== null) setOptimisticXp(null);
    }
  }, [showMiningModal]);

  const syncCoinsToDb = async () => {
    await flushCoinsAndXp();
  };

  const queueCoinUpdate = (amount: number) => {
    pendingCoinUpdateRef.current += amount;
    
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(syncCoinsToDb, 3000); // Sync active click coins after 3 seconds of inactivity
  };

  const mineBlock = async (e: React.MouseEvent) => {
    if (miningBlock.health <= 0) return;

    // Spawn Impact Particles
    const centerX = e.clientX;
    const centerY = e.clientY;

    // Combo Logic
    if (comboTimeoutRef.current) clearTimeout(comboTimeoutRef.current);
    
    setMiningCombo(prev => {
      const next = prev + 1;
      const newMult = Math.min(10, 1 + Math.floor(next / 10) * 0.5);
      setMiningMultiplier(newMult);
      return next;
    });

    comboTimeoutRef.current = setTimeout(() => {
      setMiningCombo(0);
      setMiningMultiplier(1);
    }, 1500);

    // Trigger Pickaxe Animation
    setPickaxeSwing(true);
    setHitFeedback(true);
    setMiningShake(8);
    
    // Floating reward calculation for current hit
    const damage = (myProfile?.inventory?.pickaxePower || 1);
    const baseCpc = (myProfile?.mining?.coinsPerClick || 1);
    const powerBonus = (myProfile?.inventory?.pickaxePower || 0) * 0.5;
    const luckBonus = (myProfile?.inventory?.luck || 0) * 0.1;
    const coinsPerClick = Math.floor((baseCpc + powerBonus) * (1 + luckBonus) * miningMultiplier);
    
    // 🔥 Optimistic Sync: UI Updates immediately
    const coinsStr = `+${coinsPerClick} 🪙`;
    const rewardId = `reward-${Date.now()}-${Math.random()}`;
    setFloatingRewards(prev => [...prev, {
      id: rewardId,
      text: coinsStr,
      x: centerX,
      y: centerY,
      color: '#fbbf24'
    }].slice(-10));

    // Clear reward after 1s
    setTimeout(() => {
      setFloatingRewards(prev => prev.filter(r => r.id !== rewardId));
    }, 1000);

    // BATCHED COIN UPDATE INSTEAD OF IMMEDIATE
    queueCoinUpdate(coinsPerClick);

    // Reconcile optimistic value from absolute DB state + pending ticks
    setOptimisticCoins((myProfile?.coins || 0) + pendingCpsCoinsRef.current + pendingCoinUpdateRef.current);

    setTimeout(() => {
      setPickaxeSwing(false);
      setHitFeedback(false);
      setMiningShake(0);
    }, 100);
    
    const colors: Record<string, string> = {
      'Stone': '#737373', 'Coal': '#333333', 'Iron': '#cbd5e1', 'Gold': '#fbbf24', 'Diamond': '#60a5fa', 'Emerald': '#10b981', 'TNT': '#ef4444', 'Chest': '#b45309'
    };

    const particleCount = miningBlock.type === 'TNT' ? 40 : 8;
    const now = Date.now();
    const particles = Array.from({ length: particleCount }).map((_, i) => ({
      id: `p-${now}-${i}-${Math.random()}`,
      x: centerX,
      y: centerY,
      color: colors[miningBlock.type] || '#ffffff',
      vx: (Math.random() - 0.5) * 20,
      vy: (Math.random() - 0.5) * 20 - 10
    }));
    setMiningParticles(prev => [...prev, ...particles].slice(-60));

    const newHealth = Math.max(0, miningBlock.health - damage);

    if (newHealth > 0) {
      setMiningBlock(prev => ({ ...prev, health: newHealth }));
      return;
    }

    // Block destroyed
    setMiningBlock(prev => ({ ...prev, health: 0 }));
    setMiningShake(45);

    let xp = 1;
    let coins = 0;

    switch (miningBlock.type) {
      case 'Coal': xp = 15; coins = 8; break;
      case 'Iron': xp = 35; coins = 25; break;
      case 'Gold': xp = 80; coins = 60; break;
      case 'Diamond': xp = 350; coins = 250; break;
      case 'Emerald': xp = 800; coins = 600; break;
      case 'TNT': xp = 200; coins = 100; setMiningShake(85); break;
      case 'Chest': {
        const bonusCoins = Math.floor(Math.random() * 3000) + 1500;
        xp = 750; coins = bonusCoins;
        if (user) await updateDoc(doc(db, 'user_profiles', user.uid), { 'inventory.keys': increment(1) });
        break;
      }
      default: xp = 8; coins = 5; break;
    }

    const userXpMult = myProfile?.inventory?.xpMultiplier || 1;
    const finalXp = Math.floor(xp * miningMultiplier * userXpMult);
    const finalCoins = Math.floor(coins * miningMultiplier);
    
    // Floating reward for block destruction
    const blockRewardId = `block-reward-${Date.now()}-${Math.random()}`;
    setFloatingRewards(prev => [...prev, {
      id: blockRewardId,
      text: `+${finalCoins} 🪙`,
      x: centerX,
      y: centerY - 50,
      color: '#fbbf24'
    }].slice(-10));

    setTimeout(() => {
      setFloatingRewards(prev => prev.filter(r => r.id !== blockRewardId));
    }, 1500);

    if (user) {
      // Queue rewards in pending accumulators to prevent excessive database writes
      pendingCoinUpdateRef.current += finalCoins;
      pendingCpsXpRef.current += finalXp;

      // Trigger 3s idle/de-bounce flush
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(syncCoinsToDb, 3000);
    }

    // Reconcile optimistic values from absolute DB states + pending ticks
    setOptimisticCoins((myProfile?.coins || 0) + pendingCpsCoinsRef.current + pendingCoinUpdateRef.current);
    setOptimisticXp((myProfile?.xp || 0) + pendingCpsXpRef.current);

    setMiningStats(prev => ({
      totalBroken: prev.totalBroken + 1,
      diamondsFound: miningBlock.type === 'Diamond' ? prev.diamondsFound + 1 : prev.diamondsFound
    }));

    // Visual pause before respawn
    setTimeout(() => {
      handlePotentialDiscDrop(miningBlock.type);
      spawnNextBlock();
    }, 200);
  };

  // Particle physics loop
  useEffect(() => {
    if (!showMiningModal || miningParticles.length === 0) return;

    const interval = setInterval(() => {
      setMiningParticles(prev => 
        prev.map(p => ({
          ...p,
          x: p.x + p.vx,
          y: p.y + p.vy,
          vy: p.vy + 1.2, // Stronger Gravity
          vx: p.vx * 0.95  // More friction
        })).filter(p => p.y < window.innerHeight && p.x > 0 && p.x < window.innerWidth)
      );
    }, 20);

    return () => clearInterval(interval);
  }, [showMiningModal, miningParticles.length]);

  const seedShop = async () => {
    if (!isAdmin) return;
    
    const items = [
      { name: 'VIP Rang', description: 'Goldener Name & exklusive Features', price: 5000, category: 'Ränge' },
      { name: 'MVP Rang', description: 'Der ultimative Rang mit 5.000 Coins Daily Bonus!', price: 25000, category: 'Ränge' },
      
      { name: 'Holzspitzhacke', description: 'Standard-Equipment (Power: 1)', price: 100, category: 'Ausrüstung' },
      { name: 'Eisenspitzhacke', description: 'Bessere Haltbarkeit & Speed (Power: 2)', price: 2500, category: 'Ausrüstung' },
      { name: 'Diamantspitzhacke', description: 'Die schärfste Klinge (Power: 4)', price: 15000, category: 'Ausrüstung' },
      { name: 'Netheritspitzhacke', description: 'Göttergleicher Speed (Power: 8)', price: 75000, category: 'Ausrüstung' },

      { name: 'Götter-Amulett', description: 'Erhöht die Chance auf seltene Erze (Luck: +5)', price: 10000, category: 'Ausrüstung' },
      { name: 'Erfahrungs-Boost', description: 'Du erhältst +50% mehr XP beim Mining', price: 15000, category: 'Ausrüstung' },
      { name: '1x Vote-Key', description: 'Öffne Cases am Spawn!', price: 50, category: 'Items' },
      { name: '10x Vote-Keys', description: 'Das Sparpaket für Key-Jäger!', price: 400, category: 'Items' },

      { name: 'Rotes Glühen', description: 'Glow: red. Profilbox leuchtet im feurigen Rot!', price: 1500, category: 'Farben' },
      { name: 'Blaues Glühen', description: 'Glow: blue. Profilbox leuchtet im mystischen Aquamarin-Blau!', price: 1500, category: 'Farben' },
      { name: 'Goldenes Glühen', description: 'Glow: gold. Königlicher Schein für dich und dein Profil!', price: 3000, category: 'Farben' },
      { name: 'Grünes Glühen', description: 'Glow: green. Giftig-grünes Smaragd-Schimmern!', price: 1500, category: 'Farben' },
      { name: 'Lila Glühen', description: 'Glow: purple. Magisches violettes Schimmern!', price: 2000, category: 'Farben' },
      { name: 'Regenbogen Glühen', description: 'Glow: rainbow. Legendäres schillerndes Regenbogen-Fluten!', price: 10000, category: 'Farben' }
    ];

    try {
      // Existierende Items prüfen um Duplikate zu vermeiden
      const existingNames = shopItems.map(i => i.name?.toLowerCase() || '');
      
      let addedCount = 0;
      for (const item of items) {
        if (!existingNames.includes(item.name?.toLowerCase() || '')) {
          await addDoc(collection(db, 'shop'), {
            ...item,
            isActive: true,
            createdAt: serverTimestamp()
          });
          addedCount++;
        }
      }
      alert(`${addedCount} neue Standard-Items wurden hinzugefügt! (Duplikate wurden übersprungen)`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'shop_seed');
    }
  };

  const deleteShopItem = async (itemId: string) => {
    if (!isAdmin) return;
    if (!confirm("Item aus dem Shop entfernen?")) return;
    try {
      await deleteDoc(doc(db, 'shop', itemId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `shop/${itemId}`);
    }
  };

  const editShopItem = async (item: ShopItem) => {
    if (!isAdmin) return;
    const newName = prompt("Neuer Name:", item.name) || item.name;
    const newDesc = prompt("Neue Beschreibung:", item.description) || item.description;
    const newPrice = prompt("Neuer Preis:", item.price.toString()) || item.price.toString();
    const newCat = prompt("Kategorie (Ränge, Farben, Ausrüstung, Items, Vorteile, Boxen):", item.category) as any || item.category;

    try {
      const createdAt = item.createdAt || serverTimestamp();
      await setDoc(doc(db, 'shop', item.id), {
        name: newName,
        description: newDesc,
        price: parseInt(newPrice) || 0,
        category: newCat,
        isActive: item.isActive !== undefined ? item.isActive : true,
        createdAt: createdAt
      }, { merge: true });
      alert("✅ Item aktualisiert!");
      await fetchShop();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `shop/${item.id}`);
    }
  };

  const nukeChat = async () => {
    if (!isAdmin && !isOwner && !isSuperAdmin) {
      alert("Halt Stop! Das darf nur die Heeresleitung.");
      return;
    }
    if (!confirm('⚡ EXTREMER CHAT-WIPE: ALLES wird gelöscht. Fortfahren?')) return;
    try {
      const deletedCount = await deleteCollectionInWaves('chat_messages');
      
      notifyDiscord(
        "☢️ CHAT-REINIGUNG (LEVEL 4)",
        `Eine vollständige Bereinigung des globalen Kommunikations-Streams wurde durchgeführt.`,
        16711680,
        [
          { name: "🛡️ Autorität", value: myProfile?.displayName || user?.displayName || 'N/A', inline: true },
          { name: "🧹 Gelöscht", value: `${deletedCount} Datensätze`, inline: true },
          { name: "⚡ Status", value: "Chat-Speicher vollständig geleert", inline: false }
        ]
      );

      await addDoc(collection(db, 'chat_messages'), {
        text: `⚡ SYSTEM-CLEANSE: ${deletedCount} Nachrichten wurden permanent vernichtet.`,
        userId: 'system',
        displayName: 'SYSTEM',
        role: 'Root',
        type: 'status',
        createdAt: serverTimestamp()
      });
      console.log(`Nuked ${deletedCount} messages.`);
    } catch (e) {
      console.error("Nuke failed", e);
    }
  };

  const logout = async () => {
    if (user) {
      notifyDiscord(
        "👋 BENUTZER-LOGOUT",
        `Die aktive Session von **${myProfile?.displayName || user.displayName || 'Unbekannt'}** wurde beendet.`,
        9807270,
        [
          { name: "👤 Benutzer", value: myProfile?.displayName || 'N/A', inline: true },
          { name: "⏳ Session-Dauer", value: `Beendet um ${new Date().toLocaleTimeString()}`, inline: true }
        ],
        user.photoURL || undefined
      );
      
      // Update online status in Firestore before actual logout
      try {
        await setDoc(doc(db, 'user_profiles', user.uid), { isOnline: false, updatedAt: serverTimestamp() }, { merge: true });
        await deleteDoc(doc(db, 'online_players', user.uid));
      } catch (e) {
        console.error("Logout status update failed", e);
      }
    }
    signOut(auth);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setTempSkin(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handlePixelClick = (index: number) => {
    const newGrid = [...pixelGrid];
    newGrid[index] = brushColor;
    setPixelGrid(newGrid);
    
    // Generate base64 from canvas
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 8;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      newGrid.forEach((color, i) => {
        ctx.fillStyle = color;
        ctx.fillRect(i % 8, Math.floor(i / 8), 1, 1);
      });
      setTempSkin(canvas.toDataURL());
    }
  };

  const saveProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (hasQuotaExceeded) {
      alert("Server-Limit erreicht: Profiländerungen aktuell nicht möglich.");
      setShowProfileModal(false);
      return;
    }
    const targetId = editingProfileId || user?.uid;
    if (!targetId || !user) return; // Must be logged in

    // Security & Hierarchy
    const targetProfile = userProfiles.find(p => p.userId === targetId);
    if (targetId !== user.uid) {
      if (!isAdmin) {
        alert("Nicht autorisiert.");
        return;
      }
      
      const targetIsStaff = targetProfile?.role === 'Owner' || targetProfile?.role === 'Admin' || targetProfile?.role === 'Root';
      if (targetIsStaff && !isOwner) {
        alert("Admins können keine anderen Teammitglieder bearbeiten. (Nur Owner)");
        return;
      }
    }

    const formData = new FormData(e.currentTarget);
    const displayName = formData.get('displayName') as string;
    const minecraftUsername = formData.get('minecraftUsername') as string;
    const currentServer = formData.get('currentServer') as 'none' | 'pvp' | 'survival';
    const isOnline = currentServer !== 'none' || formData.get('isOnline') === 'on';

    try {
      let finalRole: string | undefined = undefined;
      let finalCoins: number | undefined = undefined;

      const updates: any = {
        userId: targetId,
        displayName,
        minecraftUsername,
        isOnline,
        currentServer,
        customSkin: tempSkin || null,
        activeGlow: activeGlowInput,
        updatedAt: serverTimestamp()
      };

      if (isAdmin) {
        // Staff/Admin updates
        const roleVal = formData.get('role') as any;
        const coinsVal = parseInt(formData.get('coins') as string);
        
        const isSettingStaffRole = roleVal === 'Admin' || roleVal === 'Owner' || roleVal === 'Root';
        if (isSettingStaffRole && !isOwner) {
          alert("Du kannst keine Team-Ränge vergeben. (Nur Owner)");
        } else if (roleVal) {
          updates.role = roleVal;
          finalRole = roleVal;
        }
        
        if (!isNaN(coinsVal)) {
          updates.coins = coinsVal;
          finalCoins = coinsVal;
        }
      }

      await setDoc(doc(db, 'user_profiles', targetId), updates, { merge: true });
      
      // Update online_players as well. If online, add/overwrite; otherwise, delete.
      if (isOnline) {
        await setDoc(doc(db, 'online_players', targetId), {
          username: minecraftUsername || displayName || targetId,
          server: currentServer,
          lastSeen: new Date().toISOString()
        }, { merge: true });
      } else {
        await deleteDoc(doc(db, 'online_players', targetId));
      }
      
      // Update local state immediately for better UX
      setUserProfiles(prev => {
        const index = prev.findIndex(p => p.userId === targetId);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = { 
            ...updated[index], 
            ...updates,
            updatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 }
          };
          return updated;
        } else {
          return [...prev, { 
            ...updates,
            updatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 }
          } as UserProfile];
        }
      });

      setLeaderboardData(prev => {
        const index = prev.findIndex(p => (p.userId || (p as any).id) === targetId);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = { 
            ...updated[index], 
            ...updates,
            updatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 }
          };
          return updated;
        }
        return prev;
      });

      if (targetId === user.uid) {
        setMyProfile(prev => prev ? { 
          ...prev, 
          ...updates,
          updatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 }
        } : { 
          ...updates,
          updatedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 }
        });
      }

      alert("✅ Profil erfolgreich gespeichert!");
      
      setShowProfileModal(false);
      setEditingProfileId(null);

      notifyDiscord(
        "🧬 PROFIL-MODIFIKATION (STAFF)",
        `Ein Benutzerprofil wurde durch einen Administrator angepasst.`,
        2123412, // Dark Greenish
        [
          { name: "👮 Admin", value: myProfile?.displayName || user?.displayName || 'System', inline: true },
          { name: "🎯 Ziel-Konto", value: targetProfile?.displayName || 'Unbekannt', inline: true },
          { name: "📊 Neue Daten", value: `Rolle: ${finalRole || targetProfile?.role || 'Unverändert'}\nCoins: ${finalCoins !== undefined ? finalCoins : (targetProfile?.coins || 0)}`, inline: false }
        ]
      );

      setShowProfileModal(false);
      setEditingProfileId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `user_profiles/${targetId}`);
    }
  };

  // Listen to clan members when user is in a clan or viewing one
  useEffect(() => {
    if (!activeClanId || hasQuotaExceeded) return;
    const unsubscribeMembers = onSnapshot(collection(db, 'clans', activeClanId, 'members'), (snapshot) => {
      const members = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClanMember));
      setClanMembers(members);
    }, (err) => handleFirestoreError(err, OperationType.GET, `clans/${activeClanId}/members`));

    const unsubscribeRequests = onSnapshot(collection(db, 'clans', activeClanId, 'requests'), (snapshot) => {
      const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClanJoinRequest));
      setClanRequests(requests);
    }, (err) => {
       // Only leaders/officers can see this, so silent fail is okay
       setClanRequests([]);
    });

    const unsubscribeQuests = onSnapshot(collection(db, 'clans', activeClanId, 'quests'), (snapshot) => {
      const quests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClanQuest));
      setClanQuests(quests);
    }, (err) => handleFirestoreError(err, OperationType.GET, `clans/${activeClanId}/quests`));

    const unsubscribeChat = onSnapshot(query(collection(db, 'clans', activeClanId, 'chat'), orderBy('timestamp', 'desc'), limit(50)), (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage)).reverse();
      setClanChatMessages(msgs);
    }, (err) => {
      // It's okay if this fails (e.g. user not a member), we just clear messages
      setClanChatMessages([]);
    });

    return () => {
      unsubscribeMembers();
      unsubscribeRequests();
      unsubscribeQuests();
      unsubscribeChat();
    };
  }, [activeClanId, user, hasQuotaExceeded]);

  const sendClanMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeClanId || !clanChatInput.trim()) return;
    
    // ROOT CONSOLE (Staff commands in clan chat)
    if ((isSuperAdmin || isOwner || isAdmin) && clanChatInput.startsWith('/root.')) {
      setChatInput(clanChatInput); 
      sendMessage(e); // Pipe to main command handler
      setClanChatInput('');
      return;
    }

    // Check membership (Admins bypass)
    const isMember = clanMembers.some(m => m.userId === user.uid) || isAdmin;
    if (!isMember) {
      return;
    }

    if (myProfile?.isShadowMuted) {
      setClanChatInput('');
      return;
    }

    try {
      await addDoc(collection(db, 'clans', activeClanId, 'chat'), {
        userId: user.uid,
        text: clanChatInput.trim(),
        timestamp: serverTimestamp()
      });
      setClanChatInput('');
      
      // Also gain some clan XP for chatting!
      gainClanXp(activeClanId, 5);

      // Update contribution
      const myMember = clanMembers.find(m => m.userId === user.uid);
      if (myMember) {
         await setDoc(doc(db, 'clans', activeClanId, 'members', user.uid), {
            xpContribution: (myMember.xpContribution || 0) + 5
         }, { merge: true });
      }

      // Quest Progress: Clan-Chat Aktivität
      const chatQuest = clanQuests.find(q => q.title === 'Clan-Chat Aktivität' && !q.completed);
      if (chatQuest) {
        const newCurrent = chatQuest.current + 1;
        const completed = newCurrent >= chatQuest.goal;
        await setDoc(doc(db, 'clans', activeClanId, 'quests', chatQuest.id), {
          current: newCurrent,
          completed
        }, { merge: true });
        
        if (completed) {
          gainClanXp(activeClanId, chatQuest.rewardXp);
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `clans/${activeClanId}/chat`);
    }
  };

  // Determine user's clan
  useEffect(() => {
    if (!user || clans.length === 0) {
      setMyClan(null);
      return;
    }
    // This is expensive but okay for a small list. Ideally, user profile has clanId.
    const findMyClan = async () => {
      for (const clan of clans) {
        const memberRef = doc(db, 'clans', clan.id, 'members', user.uid);
        // We use a simplified check: is user the leader? 
        // For deep check, we'd need a subcollection query or clanId on profile.
        if (clan.leaderId === user.uid) {
          setMyClan(clan);
          setActiveClanId(clan.id);
          return;
        }
      }
      setMyClan(null);
    };
    findMyClan();
  }, [user, clans]);

  const handleCreateClan = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const formData = new FormData(e.currentTarget);
    const name = formData.get('clanName') as string;
    const tag = formData.get('clanTag') as string;
    const description = formData.get('clanDescription') as string;

    const clanId = name?.toLowerCase()?.replace(/\s+/g, '-') || `clan-${Date.now()}`;

    try {
      await setDoc(doc(db, 'clans', clanId), {
        name,
        tag: tag.toUpperCase(),
        description,
        announcement: 'Willkommen in unserem Clan!',
        leaderId: user.uid,
        memberCount: 1,
        level: 1,
        xp: 0,
        totalKills: 0,
        createdAt: serverTimestamp()
      });

      notifyDiscord(
        "⚜️ CLAN-GRÜNDUNG",
        `Ein neues Machtzentrum wurde im System etabliert.`,
        15105570,
        [
          { name: "🛡️ Clan-Name", value: name, inline: true },
          { name: "🏷️ Tag", value: `[${tag.toUpperCase()}]`, inline: true },
          { name: "👑 Gründer", value: myProfile?.displayName || user.displayName, inline: true },
          { name: "📜 Vision", value: description || 'Keine Angabe', inline: false }
        ]
      );

      await setDoc(doc(db, 'clans', clanId, 'members', user.uid), {
        userId: user.uid,
        role: 'Leader',
        joinedAt: serverTimestamp(),
        xpContribution: 0
      });

      // Initial Quests
      const quests = [
        { title: 'Clan-Chat Aktivität', goal: 50, current: 0, rewardXp: 500, completed: false },
        { title: 'Tägliche Online-Zeit', goal: 10, current: 0, rewardXp: 300, completed: false }
      ];
      for (const q of quests) {
        await addDoc(collection(db, 'clans', clanId, 'quests'), q);
      }

      setShowCreateClan(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'clans');
    }
  };

  const submitJoinRequest = async (clanId: string, message: string) => {
    if (!user || !myProfile) return;
    try {
      await setDoc(doc(db, 'clans', clanId, 'requests', user.uid), {
        userId: user.uid,
        minecraftUsername: myProfile.minecraftUsername || 'Unbekannt',
        message,
        requestedAt: serverTimestamp()
      });
      alert('Anfrage gesendet!');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `clans/${clanId}/requests`);
    }
  };

  const acceptDirectInvite = async (clanId: string) => {
    if (!user || !myProfile) return;
    const targetClan = clans.find(c => c.id === clanId);
    if (!targetClan) return;

    try {
      // 1. Add player as standard member to members subcollection
      await setDoc(doc(db, 'clans', clanId, 'members', user.uid), {
        userId: user.uid,
        role: 'Member',
        joinedAt: serverTimestamp(),
        xpContribution: 0
      });

      // 2. Increment member count of the clan
      await setDoc(doc(db, 'clans', clanId), {
        memberCount: (targetClan.memberCount || 0) + 1
      }, { merge: true });

      // 3. Delete any prospective request is also cleaned
      try {
        await deleteDoc(doc(db, 'clans', clanId, 'requests', user.uid));
      } catch (e) {
        // Tolerable if doesn't exist
      }

      setActiveClanId(clanId);
      setIsClansOpen(true);
      setShowInviteModal(false);
      triggerToast('xp', 'CLAN BEIGETRETEN! 🎉', `Willkommen im Clan "${targetClan.name}"!`);
      fetchClans();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `clans/${clanId}/members`);
    }
  };

  const acceptJoinRequest = async (clanId: string, requestId: string) => {
    if (!user) return;
    const clan = clans.find(c => c.id === clanId);
    if (!clan) return;

    try {
      // 1. Add as member
      await setDoc(doc(db, 'clans', clanId, 'members', requestId), {
        userId: requestId,
        role: 'Member',
        joinedAt: serverTimestamp(),
        xpContribution: 0
      });
      
      // 2. Increment count
      await setDoc(doc(db, 'clans', clanId), {
        memberCount: (clan.memberCount || 0) + 1
      }, { merge: true });

      // 3. Delete request
      await deleteDoc(doc(db, 'clans', clanId, 'requests', requestId));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `clans/${clanId}/members`);
    }
  };

  const declineJoinRequest = async (clanId: string, requestId: string) => {
    try {
      await deleteDoc(doc(db, 'clans', clanId, 'requests', requestId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `clans/${clanId}/requests`);
    }
  };

  const leaveClan = async (clanId: string) => {
    if (!user) return;
    const clan = clans.find(c => c.id === clanId);
    if (!clan) return;

    try {
      await deleteDoc(doc(db, 'clans', clanId, 'members', user.uid));
      await setDoc(doc(db, 'clans', clanId), {
        memberCount: Math.max(0, (clan.memberCount || 1) - 1)
      }, { merge: true });
      
      if (activeClanId === clanId) {
        setActiveClanId(null);
        setClanMembers([]);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `clans/${clanId}/members`);
    }
  };

  const deleteClan = async (clanId: string) => {
    const clan = clans.find(c => c.id === clanId);
    if (!clan) {
      alert("Clan nicht gefunden.");
      return;
    }
    
    // Permission check: Leader OR Admin/Owner/Root
    const canDelete = (user && clan.leaderId === user.uid) || isAdmin;
    
    if (!canDelete) {
      alert('Du hast keine Berechtigung, diesen Clan aufzulösen. (Admins/Owner oder Leader einzige Erlaubnis)');
      return;
    }
    
    if (!confirm(`🚨 CLAN-AUFLÖSUNG: Bist du sicher, dass du "${clan.name}" [${clan.tag}] löschen möchtest? Alle Daten gehen verloren!`)) return;
    
    try {
      console.log(`Starting deletion for clan ${clanId}... (Initiator: ${user?.uid})`);
      
      // Clean up subcollections
      await Promise.all([
        deleteCollectionInWaves(`clans/${clanId}/members`).catch(e => console.error("Error deleting members:", e)),
        deleteCollectionInWaves(`clans/${clanId}/chat`).catch(e => console.error("Error deleting chat:", e)),
        deleteCollectionInWaves(`clans/${clanId}/requests`).catch(e => console.error("Error deleting requests:", e)),
        deleteCollectionInWaves(`clans/${clanId}/quests`).catch(e => console.error("Error deleting quests:", e))
      ]);
      
      console.log(`Sub-collections for clan ${clanId} deletion attempted. Deleting main document...`);
      await deleteDoc(doc(db, 'clans', clanId));
      
      notifyDiscord(
        "🏚️ CLAN-AUFLÖSUNG",
        `Ein Clan wurde von einem Admin oder dem Leader aufgelöst.`,
        16711680,
        [
          { name: "🛡️ Clan", value: `${clan.name} [${clan.tag}]`, inline: true },
          { name: "🚧 Initiator", value: myProfile?.displayName || user?.displayName || 'N/A', inline: true },
          { name: "⚠️ Status", value: "Vollständig gelöscht", inline: false }
        ]
      );

      alert(`Der Clan "${clan.name}" wurde erfolgreich aufgelöst.`);
      
      if (activeClanId === clanId) {
        setActiveClanId(null);
        setMyClan(null);
      }
    } catch (err) {
      console.error("Critical Error during clan deletion:", err);
      alert("Fehler beim Löschen des Clans. Details siehe Konsole.");
      handleFirestoreError(err, OperationType.DELETE, `clans/${clanId}`);
    }
  };

  const updateClanAnnouncement = async (clanId: string, text: string) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'clans', clanId), {
        announcement: text
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `clans/${clanId}`);
    }
  };

  const updateMemberRole = async (clanId: string, targetUserId: string, newRole: 'Officer' | 'Member') => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'clans', clanId, 'members', targetUserId), {
        role: newRole
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `clans/${clanId}/members/${targetUserId}`);
    }
  };

  const addClanKill = async (clanId: string) => {
    if (!user) return;
    const clan = clans.find(c => c.id === clanId);
    if (!clan) return;

    try {
      await setDoc(doc(db, 'clans', clanId), {
        totalKills: (clan.totalKills || 0) + 1
      }, { merge: true });
      
      // Also gain some individual contribution and clan XP
      gainClanXp(clanId, 10);
      
      const myMember = clanMembers.find(m => m.userId === user.uid);
      if (myMember) {
        await setDoc(doc(db, 'clans', clanId, 'members', user.uid), {
          xpContribution: (myMember.xpContribution || 0) + 10
        }, { merge: true });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `clans/${clanId}`);
    }
  };

  const gainClanXp = async (clanId: string, amount: number) => {
    const clan = clans.find(c => c.id === clanId);
    if (!clan) return;
    
    let newXp = (clan.xp || 0) + amount;
    let newLevel = clan.level || 1;
    const nextLevelXp = newLevel * 1000;

    if (newXp >= nextLevelXp) {
      newXp -= nextLevelXp;
      newLevel += 1;
    }

    try {
      await setDoc(doc(db, 'clans', clanId), {
        xp: newXp,
        level: newLevel
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `clans/${clanId}`);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user && !guestId) return;

    // Helper to send local system message (Only visible to current user)
    const sendSystemMsg = (text: string, title: string = 'SYSTEM') => {
      const now = Date.now();
      const newLocalMsg: ChatMessage = {
        id: `local-${now}-${Math.random()}`,
        text: text,
        userId: 'system',
        displayName: title,
        role: 'System',
        createdAt: new Date(now),
        isLocal: true,
        localTimestamp: now
      };
      setLocalMessages(prev => [...prev, newLocalMsg]);
    };
    
    if (hasQuotaExceeded) {
      sendSystemMsg("§cDie Server-Kapazität ist aktuell erschöpft. Nachrichten können nicht gesendet werden.§r");
      setChatInput('');
      return;
    }

    if (!chatInput.trim()) return;
    const input = chatInput.trim();

    const guestDispName = chatGuestName || 'Gast-' + guestId.substring(6, 12);
    const senderName = user ? (myProfile?.displayName || user.displayName || 'Unbekannt') : guestDispName;
    const senderRole = user ? (myProfile?.role || 'Member') : 'Gast';
    const senderUid = user ? user.uid : guestId;

    const getLevel = (xp: number = 0) => Math.floor(Math.sqrt(xp / 100)) + 1;
    const getXPForLevel = (level: number) => Math.pow(level - 1, 2) * 100;

    // COMMAND HANDLING (Slash Commands)
    if (input.startsWith('/')) {
      const parts = input.substring(1).split(' ');
      const command = parts[0]?.toLowerCase() || '';
      const args = parts.slice(1);

      try {
        switch (command) {
          case 'help': {
            notifyDiscord(
              "⚙️ COMMAND-USAGE: /help",
              `Benutzer **${myProfile?.displayName}** hat die Hilfe aufgerufen.`,
              2123412,
              [
                { name: "👤 User", value: myProfile?.displayName || 'N/A', inline: true },
                { name: "📡 IP", value: `\`${visitorInfo?.ip || '?'}\``, inline: true }
              ]
            );
            const adminCmds = isAdmin ? '\n\n§c[ADMIN-BEDIENER]§r\n§7/root.invisible§r - Ninja-Modus\n§7/root.mute [User]§r - Silent-Mute\n§7/root.coins [User] [Betrag]§r - Kontostand hacken\n§7/root.xp [User] [Betrag]§r - Level manipulieren\n§7/root.nuke§r - Alles weglöschen\n§7/root.broadcast [Text]§r - Globale Megaphon-Nachricht' : '';
            sendSystemMsg(`§6§l--- BEFEHLS-ZENTRALE ---§r\n§e/stats [Spieler]§r - Level, Coins & XP abrufen\n§e/pay [User] [Betrag]§r - Coins spendieren\n§e/top§r - Wer ist der Beste?\n§e/list§r - Wer treibt sich hier rum?\n§e/me [Aktion]§r - Rollenspiel-Action\n§e/rank§r - XP-Fortschritt checken\n§e/rules§r - Was darf ich?\n§e/discord§r - Server-Invite\n§e/ai [Frage]§r - Das Orakel befragen ✨\n§e/ping§r - Verbindungs-Check\n§e/calc [Formel]§r - Der smarte Rechner\n§e/roll [max]§r - Glücksrad\n§e/flip§r - Münze werfen\n§e/joke§r - Lass mich dich unterhalten\n§e/clear§r - Chat sauber machen${adminCmds}`);
            break;
          }
          case 'ai':
          case 'oracle': {
            setIsAiOpen(true);
            if (args.length > 0) {
              handleAiChat(args.join(' '));
            } else {
              sendSystemMsg("§6Das scharfe Orakel wurde gerufen!§r ✨");
            }
            break;
          }
          case 'coins':
            sendSystemMsg(`💰 Dein Kontostand: §e${user ? (myProfile?.coins || 0) : 0} Coins§r${user ? '' : ' (Melde dich an, um Coins zu verdienen!)'}`);
            break;
          case 'pay': {
            if (!user) {
              sendSystemMsg("§cDu musst registriert und eingeloggt sein, um Coins zu überweisen!§r");
              break;
            }
            if (args.length < 2) {
              sendSystemMsg("§cVerwendung: /pay [Name] [Betrag]§r");
              break;
            }
            const targetName = args[0];
            const amount = parseInt(args[1]);
            if (isNaN(amount) || amount <= 0) {
              sendSystemMsg("§cBetrag muss eine positive Zahl sein!§r");
              break;
            }
            if (targetName?.toLowerCase() === myProfile?.minecraftUsername?.toLowerCase() || targetName?.toLowerCase() === myProfile?.displayName?.toLowerCase()) {
              sendSystemMsg("§cDu kannst dir nicht selbst Geld überweisen!§r");
              break;
            }
            if ((myProfile?.coins || 0) < amount) {
              sendSystemMsg("§cOperation abgelehnt: Guthaben nicht ausreichend!§r");
              break;
            }
            const targetProf = userProfiles.find(p => 
              (p.minecraftUsername?.toLowerCase() === targetName?.toLowerCase()) || 
              (p.displayName?.toLowerCase() === targetName?.toLowerCase())
            );
            if (!targetProf) {
              sendSystemMsg(`§cEmpfänger "${targetName}" im System unauffindbar.§r`);
              break;
            }
            
            // Generate tracking ID
            const trackingId = `TX-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

            // Flush any pending clicks/CPS earnings first to secure all progress
            await flushCoinsAndXp();
            
            await updateDoc(doc(db, 'user_profiles', user.uid), { coins: increment(-amount) });
            await updateDoc(doc(db, 'user_profiles', targetProf.userId), { coins: increment(amount) });
            
            // Log to coin_transactions collection
            try {
              await addDoc(collection(db, 'coin_transactions'), {
                senderId: user.uid,
                senderName: myProfile?.displayName || 'Unbekannt',
                receiverId: targetProf.userId,
                receiverName: targetProf.displayName || 'Unbekannt',
                amount: amount,
                createdAt: serverTimestamp(),
                trackingId: trackingId
              });
            } catch (txErr) {
              console.error("Fehler beim Speichern der Transaktion:", txErr);
              handleFirestoreError(txErr, OperationType.WRITE, 'coin_transactions');
            }

            // Discord Transaction Log
            notifyDiscord(
              "💸 COIN-TRANSFER PROTOKOLL",
              `Eine interne Währungsübertragung wurde autorisiert.`,
              15158332,
              [
                { name: "📤 Sender", value: myProfile?.displayName || 'N/A', inline: true },
                { name: "📥 Empfänger", value: targetProf.displayName || 'N/A', inline: true },
                { name: "💰 Volumen", value: `${amount} Coins`, inline: true },
                { name: "🛰️ Tracking-ID", value: trackingId, inline: false }
              ]
            );

            await addDoc(collection(db, 'chat_messages'), {
              text: `💸 **${myProfile?.displayName}** hat **${amount} Coins** an **${targetProf.displayName}** überwiesen!`,
              userId: 'system',
              displayName: 'BANK',
              role: 'System',
              createdAt: serverTimestamp(),
              tempId: `sys-${Date.now()}-${Math.random()}`
            });
            break;
          }
          case 'me': {
            if (args.length === 0) break;
            const fallbackDisp = chatGuestName || 'Gast-' + guestId.substring(6, 12);
            const chosenDispName = user ? (myProfile?.displayName || user.displayName || 'Unbekannt') : fallbackDisp;
            const chosenRole = user ? (myProfile?.role || 'Member') : 'Gast';
            await addDoc(collection(db, 'chat_messages'), {
              text: `* ${chosenDispName} ${args.join(' ')}`,
              userId: user ? user.uid : guestId,
              displayName: chosenDispName,
              role: chosenRole,
              createdAt: serverTimestamp(),
              isAction: true,
              tempId: `act-${Date.now()}-${Math.random()}`
            });
            break;
          }
          case 'list': {
            const visibleOnline = userProfiles.filter(p => (p.isOnline && (!p.isInvisible || isAdmin)));
            const onlineText = visibleOnline.map(p => `§7[${p.role || 'Member'}]§r ${p.displayName} (§b${p.currentServer}§r)`).join('\n');
            sendSystemMsg(`§a§lAKTUELL AKTIV (${visibleOnline.length}):§r\n${onlineText}`);
            break;
          }
          case 'rank': {
            if (!user) {
              sendSystemMsg("§cDu musst registriert und eingeloggt sein, um XP und Levels zu sammeln!§r");
              break;
            }
            const xp = myProfile?.xp || 0;
            const lv = getLevel(xp);
            const nextLv = lv + 1;
            const xpForNext = getXPForLevel(nextLv);
            const xpThisLv = xp - getXPForLevel(lv);
            const nextLvCost = xpForNext - getXPForLevel(lv);
            const progress = Math.min(100, Math.floor((xpThisLv / nextLvCost) * 100));
            sendSystemMsg(`§b--- DEIN RANG-STATUS ---§r\nLevel: §l${lv}§r\nXP: §7${xp} / ${xpForNext}§r\nFortschritt: §a${progress}%§r`);
            break;
          }
          case 'rules':
            sendSystemMsg("§4§lOFFIZIELLES REGELWERK:§r\n§71.§r Sei kein Schwein (Respekt)\n§72.§r Cheats & Hacks = Permanent Bann\n§73.§r Kein Spam, keine Scams\n§74.§r Die Admins haben immer recht\n§75.§r Spaß haben ist Pflicht!");
            break;
          case 'discord':
            sendSystemMsg(`§9§lDISCORD VERBINDUNG:§r\n${DISCORD_URL}`);
            break;
          case 'stats': {
            const targetName = args[0] || (user ? myProfile?.displayName : null);
            if (!targetName) {
              sendSystemMsg("§cVerwendung: /stats [Spieler] (Da du als Gast spielst, gib bitte einen registrierten Spielernamen an!)§r");
              break;
            }
            const targetProf = userProfiles.find(p => p.minecraftUsername?.toLowerCase() === targetName?.toLowerCase() || p.displayName?.toLowerCase() === targetName?.toLowerCase());
            if (!targetProf) {
              sendSystemMsg(`§cFehler: Spieler-Profil "${targetName}" nicht gefunden.§r`);
            } else {
              const lv = getLevel(targetProf.xp || 0);
              const statusStr = targetProf.isOnline ? '§aONLINE§r' : '§cOFFLINE§r';
              sendSystemMsg(`§b§lAKTE: ${targetProf.displayName?.toUpperCase() || 'UNBEKANNT'}§r\n§8----------------------§r\n§eRang:§r ${targetProf.role || 'Member'}\n§eLevel:§r §l${lv}§r (${targetProf.xp || 0} XP)\n§eCoins:§r ${targetProf.coins || 0}\n§eRealm:§r ${targetProf.currentServer || 'Keiner'}\n§eStatus:§r ${statusStr}`);
            }
            break;
          }
          case 'top': {
            const category = args[0]?.toLowerCase() || 'coins';
            let list = [];
            let title = '';
            
            if (category === 'xp' || category === 'level') {
              title = 'SITZFLEISCH-KÖNIGE (XP)';
              list = [...userProfiles].sort((a, b) => (b.xp || 0) - (a.xp || 0)).slice(0, 5);
            } else {
              title = 'REICHSTE SPIELER (COINS)';
              list = [...userProfiles].sort((a, b) => (b.coins || 0) - (a.coins || 0)).slice(0, 5);
            }
            
            const topList = list.map((u, i) => `§e${i + 1}.§r ${u.displayName} - ${category === 'xp' || category === 'level' ? `§bLv. ${getLevel(u.xp)}§r` : `§6${u.coins} Coins§r`}`).join('\n');
            sendSystemMsg(`§6§l--- ${title} ---§r\n${topList}\n§7(Tipp: /top xp oder /top coins)§r`);
            break;
          }
          case 'ping': {
            const pings = [12, 24, 38, 42, 11, 401, 15, 29];
            const p = pings[Math.floor(Math.random() * pings.length)];
            sendSystemMsg(`§fVerbindung: §l${p}ms§r ${p > 100 ? '§c(Laggy!)§r' : '§a(Stable)§r'}`);
            break;
          }
          case 'time':
            sendSystemMsg(`§7Server-Uhr:§r ${new Date().toLocaleTimeString('de-DE')} Uhr`);
            break;
          case 'weather': {
            const conditions = ['Sonnig ☀️', 'Regen 🌧️', 'Gewitter ⚡', 'Schneefall ❄️', 'Bewölkt ☁️', 'Sandsturm 🏜️', 'Blutmond 🌑'];
            sendSystemMsg(`§3Meteorologe:§r Heute ist mit §l${conditions[Math.floor(Math.random() * conditions.length)]}§r zu rechnen.`);
            break;
          }
          case 'roll': {
            const max = parseInt(args[0]) || 100;
            const result = Math.floor(Math.random() * max) + 1;
            await addDoc(collection(db, 'chat_messages'), {
              text: `🎲 **${senderName}** würfelt eine **${result}** (1-${max})`,
              userId: senderUid,
              displayName: senderName,
              role: senderRole,
              createdAt: serverTimestamp(),
              isAction: true,
              tempId: `roll-${Date.now()}`
            });
            break;
          }
          case 'flip': {
            const result = Math.random() > 0.5 ? '§eKOPF§r' : '§7ZAHL§r';
            await addDoc(collection(db, 'chat_messages'), {
              text: `🪙 **${senderName}** wirft eine Münze: ${result}!`,
              userId: senderUid,
              displayName: senderName,
              role: senderRole,
              createdAt: serverTimestamp(),
              isAction: true,
              tempId: `flip-${Date.now()}`
            });
            break;
          }
          case '8ball': {
            if (args.length === 0) {
              sendSystemMsg("§cDu musst dem Orakel eine Frage stellen!§r");
              break;
            }
            const answers = ['Ja.', 'Nein.', 'Vielleicht.', 'Frag später nochmal.', 'Auf jeden Fall!', 'Eher nicht.', 'Definitiv.', 'Niemals.', 'Sehr wahrscheinlich.', 'Konzentriere dich und frage erneut.', 'Meine Quellen sagen Nein.'];
            sendSystemMsg(`§5[ORAKEL]§r ${answers[Math.floor(Math.random() * answers.length)]}`);
            break;
          }
          case 'calc': {
            try {
              const expr = args.join('');
              const cleanExpr = expr.replace(/[^-()\d/*+.]/g, '');
              const result = eval(cleanExpr);
              sendSystemMsg(`§2§lRECHNER:§r ${cleanExpr} = §l${result}§r`);
            } catch (e) {
              sendSystemMsg("§cSyntax-Fehler! Nur Zahlen und Operatoren (+, -, *, /) zulässig.§r");
            }
            break;
          }
          case 'joke': {
            const jokes = [
              "Hacker beim Angeln. Er fängt einen dicken Fisch. 'Warum schaust du so?' - 'Ich finde den Download-Button nicht!'",
              "Warum tragen Creeper keine Brillen? Weil sei alles mit einem Knall sehen!",
              "Was ist der Lieblings-Song eines Endermans? 'Don't Look Back in Anger'.",
              "Ein Skelett geht in eine Bar... und bestellt ein Bier und einen Wischmopp.",
              "Was passiert, wenn man einen Creeper und eine Ziege kreuzt? Eine Explosiv-Milch!",
              "Woran erkennt man einen motivierten Programmierer? Er hat seine Überstunden schon in Binär gezählt."
            ];
            sendSystemMsg(`§e[COMEDY]§r ${jokes[Math.floor(Math.random() * jokes.length)]}`);
            break;
          }
          case 'shrug': {
            await addDoc(collection(db, 'chat_messages'), {
              text: '¯\\_(ツ)_/¯',
              userId: senderUid,
              displayName: senderName,
              role: senderRole,
              createdAt: serverTimestamp(),
              tempId: `shrug-${Date.now()}`
            });
            break;
          }
          case 'lenny': {
            await addDoc(collection(db, 'chat_messages'), {
              text: '( ͡° ͜ʖ ͡°)',
              userId: senderUid,
              displayName: senderName,
              role: senderRole,
              createdAt: serverTimestamp(),
              tempId: `lenny-${Date.now()}`
            });
            break;
          }
          case 'tableflip': {
            await addDoc(collection(db, 'chat_messages'), {
              text: '(╯°□°）╯︵ ┻━┻',
              userId: senderUid,
              displayName: senderName,
              role: senderRole,
              createdAt: serverTimestamp(),
              tempId: `tableflip-${Date.now()}`
            });
            break;
          }
          case 'hug': {
            if (args.length === 0) break;
            await addDoc(collection(db, 'chat_messages'), {
              text: `🤗 **${senderName}** umarmt **${args.join(' ')}** ganz fest!`,
              userId: senderUid,
              displayName: senderName,
              role: senderRole,
              createdAt: serverTimestamp(),
              isAction: true,
              tempId: `hug-${Date.now()}`
            });
            break;
          }
          case 'slap': {
            if (args.length === 0) break;
            await addDoc(collection(db, 'chat_messages'), {
              text: `👋 **${senderName}** gibt **${args.join(' ')}** eine fette Backpfeife!`,
              userId: senderUid,
              displayName: senderName,
              role: senderRole,
              createdAt: serverTimestamp(),
              isAction: true,
              tempId: `slap-${Date.now()}`
            });
            break;
          }
          case 'clear':
            setLocalMessages([]);
            sendSystemMsg("§7Dein lokaler Chat-Verlauf wurde bereinigt.§r");
            break;
          case 'ban': {
            if (!isAdmin) { sendSystemMsg("§cBerechtigungs-Level unzureichend!§r"); break; }
            const target = args[0];
            if (!target) { sendSystemMsg("§cVerwendung: /ban [Account-ID/DiscordId/Name]§r"); break; }
            const targetProf = userProfiles.find(p => 
              p.minecraftUsername?.toLowerCase() === target.toLowerCase() || 
              p.displayName?.toLowerCase() === target.toLowerCase() || 
              p.userId === target || 
              (p as any).discordId === target
            );
            if (!targetProf) { sendSystemMsg("§cZielsubjekt im System nicht auffindbar.§r"); break; }
            if ((targetProf.role === 'Owner' || targetProf.role === 'Admin' || targetProf.role === 'Root') && !isOwner) {
              sendSystemMsg("§cFehler: Teammitglieder können nur vom Sektor-Lead gebannt werden.§r");
              break;
            }
            if (confirm(`Soll ${targetProf.displayName} wirklich permanent aus dem System entfernt werden?`)) {
              deleteProfile(targetProf.userId);
              sendSystemMsg(`§4Spieler ${targetProf.displayName} wurde erfolgreich terminiert.§r`);
            }
            break;
          }
          case 'root.ban': {
            if (!isAdmin) { sendSystemMsg("§cZugriff verweigert!§r"); break; }
            const target = args[0];
            if (!target) break;
            const targetProf = userProfiles.find(p => p.minecraftUsername?.toLowerCase() === target.toLowerCase() || p.displayName?.toLowerCase() === target.toLowerCase() || p.userId === target || (p as any).discordId === target);
            if (targetProf) {
              deleteProfile(targetProf.userId);
              sendSystemMsg(`§6§lROOT:§r Bann für ${targetProf.displayName} initiiert.`);
            }
            break;
          }
          default:
            if (command.startsWith('root.')) {
              if (!isAdmin) {
                sendSystemMsg("§cZugriff verweigert: Admin-Privilegien erforderlich!§r");
                break;
              }
                  const action = command.substring(5);
                  switch (action) {
                    case 'invisible': {
                      const newInvisible = !myProfile?.isInvisible;
                      await setDoc(doc(db, 'user_profiles', user.uid), { isInvisible: newInvisible }, { merge: true });
                      setUserProfiles(prev => prev.map(p => p.userId === user.uid ? { ...p, isInvisible: newInvisible } : p));
                      setMyProfile(prev => prev ? { ...prev, isInvisible: newInvisible } : prev);
                      sendSystemMsg(`§6§lROOT:§r Stealth-Modus nun ${newInvisible ? '§aAKTIVIERT§r' : '§cDEAKTIVIERT§r'}.`);
                      break;
                    }
                    case 'mute': {
                      const target = args[0];
                      if (!target) { sendSystemMsg("§cVerwendung: /root.mute [Name]§r"); break; }
                      const targetProf = userProfiles.find(p => p.minecraftUsername?.toLowerCase() === target?.toLowerCase() || p.displayName?.toLowerCase() === target?.toLowerCase());
                      if (targetProf) {
                        const isStaff = targetProf.role === 'Owner' || targetProf.role === 'Admin' || targetProf.role === 'Root';
                        if (isStaff && !isOwner) {
                          sendSystemMsg("§cError: Du kannst keine Teammitglieder stummschalten!§r");
                          break;
                        }
                        const newMute = !targetProf.isShadowMuted;
                        await setDoc(doc(db, 'user_profiles', targetProf.userId), { isShadowMuted: newMute }, { merge: true });
                        setUserProfiles(prev => prev.map(p => p.userId === targetProf.userId ? { ...p, isShadowMuted: newMute } : p));
                        if (targetProf.userId === user.uid) {
                          setMyProfile(prev => prev ? { ...prev, isShadowMuted: newMute } : prev);
                        }
                        sendSystemMsg(`§6§lROOT:§r Shadowmute für ${targetProf.displayName} ${newMute ? '§aGESETZT§r' : '§cENTFERNT§r'}.`);
                      }
                      break;
                    }
                    case 'coins': {
                      const target = args[0];
                      if (!target || !args[1]) { sendSystemMsg("§cVerwendung: /root.coins [Name] [Betrag]§r"); break; }
                      const targetProf = userProfiles.find(p => p.minecraftUsername?.toLowerCase() === target?.toLowerCase() || p.displayName?.toLowerCase() === target?.toLowerCase());
                      if (targetProf) {
                        const isStaff = targetProf.role === 'Owner' || targetProf.role === 'Admin' || targetProf.role === 'Root';
                        if (isStaff && !isOwner) {
                          sendSystemMsg("§cError: Konten von Teammitgliedern können nur von Besitzern manipuliert werden!§r");
                          break;
                        }
                        const newCoins = parseInt(args[1]);
                        await setDoc(doc(db, 'user_profiles', targetProf.userId), { coins: newCoins }, { merge: true });
                        setUserProfiles(prev => prev.map(p => p.userId === targetProf.userId ? { ...p, coins: newCoins } : p));
                        if (targetProf.userId === user.uid) {
                          setMyProfile(prev => prev ? { ...prev, coins: newCoins } : prev);
                        }
                        sendSystemMsg(`§6§lROOT:§r Coins von ${targetProf.displayName} auf §e${args[1]}§r gesetzt.`);
                      }
                      break;
                    }
                    case 'xp': {
                      const target = args[0];
                      if (!target || !args[1]) { sendSystemMsg("§cVerwendung: /root.xp [Name] [Betrag]§r"); break; }
                      const targetProf = userProfiles.find(p => p.minecraftUsername?.toLowerCase() === target?.toLowerCase() || p.displayName?.toLowerCase() === target?.toLowerCase());
                      if (targetProf) {
                        const isStaff = targetProf.role === 'Owner' || targetProf.role === 'Admin' || targetProf.role === 'Root';
                        if (isStaff && !isOwner) {
                          sendSystemMsg("§cError: XP von Teammitgliedern können nur von Besitzern manipuliert werden!§r");
                          break;
                        }
                        const newXp = parseInt(args[1]);
                        await setDoc(doc(db, 'user_profiles', targetProf.userId), { xp: newXp }, { merge: true });
                        setUserProfiles(prev => prev.map(p => p.userId === targetProf.userId ? { ...p, xp: newXp } : p));
                        if (targetProf.userId === user.uid) {
                          setMyProfile(prev => prev ? { ...prev, xp: newXp } : prev);
                        }
                        sendSystemMsg(`§6§lROOT:§r XP von ${targetProf.displayName} auf §b${args[1]}§r gesetzt.`);
                      }
                      break;
                    }
                    case 'nuke':
                      if (!isOwner) {
                        sendSystemMsg("§cError: /root.nuke ist ein exklusiver Owner-Befehl!§r");
                        break;
                      }
                      nukeChat();
                      sendSystemMsg("§4§lDETONATION ERFOLGT:§r Chat wurde vollständig bereinigt.");
                      break;
                    case 'maintenance':
                      toggleMaintenance();
                      break;
                case 'broadcast':
                  if (args.length > 0) {
                    const msg = args.join(' ');
                    await setDoc(doc(db, 'app_config', 'system'), { broadcast: msg }, { merge: true });
                    sendSystemMsg(`§aBroadcast gesetzt:§r ${msg}`);
                  } else {
                    await setDoc(doc(db, 'app_config', 'system'), { broadcast: null }, { merge: true });
                    sendSystemMsg("§7Broadcast entfernt.§r");
                  }
                  break;
                default:
                  sendSystemMsg(`§cKommandozentrale: Unbekannter Root-Befehl "${action}"§r`);
              }
            } else {
              sendSystemMsg(`§cBefehl nicht erkannt: /${command}. Nutze /help für eine Übersicht.§r`);
            }
        }
      } catch (err) {
        console.error("Critical command failure", err);
        sendSystemMsg("§cSystem-Fehler bei der Befehlsverarbeitung!§r");
      }
      setChatInput('');
      return;
    }

    // Normal message sending...
    if (myProfile?.isShadowMuted) {
      setChatInput('');
      return;
    }
    const inputToSend = chatInput.trim();
    setChatInput('');
    
    // Safety check for offline users
    if (!navigator.onLine) {
      sendSystemMsg('Du bist aktuell offline! Deine Nachricht wird gesendet, sobald die Verbindung steht.', 'SYSTEM');
      // Note: Firestore actually handles offline queuing, but we want to show visual feedback better
    }

    // Quiz Mode Correct/Incorrect feedback handling
    if (chatChannel === 'quiz') {
      if (activeQuiz && activeQuiz.active) {
        const correctAnswers = activeQuiz.answers || [];
        const textNorm = inputToSend.trim().toLowerCase();
        const matchedAnswer = correctAnswers.find((ans: string) => ans.trim().toLowerCase() === textNorm);
        if (matchedAnswer) {
          sendSystemMsg(`🏆 §a§lRICHTIGE ANTWORT!§r Deine Antwort §e"${inputToSend}"§r ist korrekt! Du hast das Quiz gelöst! 🎉`, "💡 Quiz-Bot");
          triggerToast('quest', '🏆 KORREKT!', `Glückwunsch! "${inputToSend.toUpperCase()}" ist die richtige Antwort! 🎉`);
        } else {
          sendSystemMsg(`❌ §c§lFALSCHE ANTWORT!§r Die Antwort §e"${inputToSend}"§r ist leider nicht richtig. Probier es noch einmal! 🤔`, "💡 Quiz-Bot");
          triggerToast('quest', '❌ LEIDER FALSCH', `"${inputToSend}" ist nicht korrekt. Versuche es noch einmal! 🤔`);
        }
      } else {
        sendSystemMsg("⚠️ §6§lHINWEIS:§r Aktuell gibt es keine aktive Quizfrage. Bitte warte auf eine neue Runde!", "💡 Quiz-Bot");
        triggerToast('quest', '⚠️ KEIN AKTIVES QUIZ', "Aktuell läuft keine Quizfrage.");
      }
    }

    const tempId = 'temp-' + Date.now() + '-' + Math.random().toString(36).substring(7);
    const localTimestamp = Date.now();
    const tempMsg: ChatMessage = {
      id: tempId,
      text: inputToSend,
      userId: senderUid,
      displayName: senderName.substring(0, 64),
      role: senderRole.substring(0, 64),
      purchasedRank: user ? myProfile?.purchasedRank : undefined,
      createdAt: null,
      tempId: tempId,
      localTimestamp: localTimestamp,
      channel: chatChannel
    };
    
    setLocalMessages(prev => {
      // Prevent duplicates in local state
      if (prev.some(m => m.text === inputToSend && (Date.now() - (m.localTimestamp || 0) < 1000))) {
        return prev;
      }
      return [...prev, tempMsg];
    });
    
    let retries = 0;
    const maxRetries = 3;

    const executeSend = async () => {
      try {
        // Use setDoc with the specific tempId as document ID to prevent duplicate messages
        // in Firestore if the client retries the same operation.
        const msgRef = doc(db, 'chat_messages', tempId);
        await setDoc(msgRef, {
          text: inputToSend,
          userId: senderUid,
          displayName: senderName.substring(0, 64),
          role: senderRole.substring(0, 64),
          purchasedRank: user ? (myProfile?.purchasedRank || "") : "",
          createdAt: serverTimestamp(),
          tempId: tempId,
          channel: chatChannel
        });
        
        notifyDiscord(
          chatChannel === 'quiz' ? "💡 QUIZ-FEEDBACK" : "💬 CHAT-LIVESTREAM",
          chatChannel === 'quiz' ? `Ein Benutzer hat eine Antwort im Quiz-Chat eingereicht.` : `Eine neue Nachricht wurde im globalen Chat gesendet.`,
          chatChannel === 'quiz' ? 16750848 : 3447003,
          [
            { name: "👤 Absender", value: senderName, inline: true },
            { name: chatChannel === 'quiz' ? "💡 Antwort" : "💬 Nachricht", value: inputToSend, inline: false }
          ]
        );
      } catch (err) {
        if (retries < maxRetries && navigator.onLine) {
          retries++;
          const delay = Math.pow(2, retries) * 800; // Exponential backoff
          setTimeout(executeSend, delay);
        } else {
          setLocalMessages(prev => prev.filter(m => m.id !== tempId));
          setChatInput(inputToSend); // Restore input on final failure
          sendSystemMsg('Nachricht konnte nicht zugestellt werden. Bitte erneut versuchen.', 'FEHLER');
          handleFirestoreError(err, OperationType.CREATE, 'chat_messages');
        }
      }
    };

    executeSend();
    
    // Long-term cleanup fallback
    setTimeout(() => {
      setLocalMessages(prev => prev.filter(m => m.id !== tempId));
    }, 30000);
  };

  const kickPlayerFromClan = async (clanId: string, targetUserId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'clans', clanId, 'members', targetUserId));
      const clan = clans.find(c => c.id === clanId);
      if (clan) {
        await setDoc(doc(db, 'clans', clanId), {
          memberCount: Math.max(0, (clan.memberCount || 1) - 1)
        }, { merge: true });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `clans/${clanId}/members/${targetUserId}`);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  // Simulation Helpers
  const addRandomPlayer = async (server: 'pvp' | 'survival') => {
    if (!user) return;
    const usernames = ['Steve', 'Alex', 'Herobrine', 'Dinnerbone', 'Notch', 'Grumm', 'Dream', 'Techno'];
    const username = usernames[Math.floor(Math.random() * usernames.length)] + Math.floor(Math.random() * 100);
    const playerId = username?.toLowerCase() || `player-${Date.now()}`;
    
    try {
      await setDoc(doc(db, 'online_players', playerId), {
        username,
        server,
        lastSeen: new Date().toISOString()
      });
      // Update count locally for faster UI
      const status = server === 'pvp' ? pvpStatus : survivalStatus;
      await setDoc(doc(db, 'server_status', server), {
        ...status,
        playerCount: status.playerCount + 1
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `online_players/${playerId}`);
    }
  };

  const updateServerStatus = async (server: 'pvp' | 'survival', updates: Partial<ServerStatus>) => {
    if (!isAdmin) return;
    try {
      const status = server === 'pvp' ? pvpStatus : survivalStatus;
      await setDoc(doc(db, 'server_status', server), { ...status, ...updates });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `server_status/${server}`);
    }
  };

  const updateRealmCode = async (server: 'pvp' | 'survival', code: string) => {
    if (!isAdmin) return;
    try {
      await setDoc(doc(db, 'app_config', 'realm_codes'), { ...realmCodes, [server.toUpperCase()]: code });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'app_config/realm_codes');
    }
  };

  const kickPlayer = async (player: { id: string; type: 'manual' | 'profile' }) => {
    if (!isAdmin) return;
    
    // Extreme Mode: Ask for full deletion of account
    const action = confirm('Möchtest du den Spieler komplett LÖSCHEN (OK) oder nur KICKEN (Abbrechen)?');
    
    try {
      const batch = writeBatch(db);
      
      if (player.type === 'manual') {
        batch.delete(doc(db, 'online_players', player.id?.toLowerCase() || player.id));
      } else {
        if (action) {
          // Full Annihilation across multiple collections
          const profile = userProfiles.find(p => p.userId === player.id);
          batch.delete(doc(db, 'user_profiles', player.id));
          batch.delete(doc(db, 'online_players', player.id));
          if (profile?.minecraftUsername) {
            batch.delete(doc(db, 'online_players', profile.minecraftUsername.toLowerCase()));
          }
        } else {
          // Normal Kick
          const profile = userProfiles.find(p => p.userId === player.id);
          batch.set(doc(db, 'user_profiles', player.id), { 
            isOnline: false, 
            currentServer: 'none',
            updatedAt: serverTimestamp() 
          }, { merge: true });
          batch.delete(doc(db, 'online_players', player.id));
          if (profile?.minecraftUsername) {
            batch.delete(doc(db, 'online_players', profile.minecraftUsername.toLowerCase()));
          }
        }
      }
      
      await batch.commit();
      
      notifyDiscord(
        "🦶 SPIELER-MASSNAHME ERGRIFFEN",
        `Ein Administrator hat eine Moderations-Aktion durchgeführt.`,
        16776960,
        [
          { name: "👮 Admin", value: myProfile?.displayName || 'System', inline: true },
          { name: "🎯 Ziel-ID", value: `\`${player.id}\``, inline: true },
          { name: "🛠️ Methode", value: action ? '🔴 VOLLSTÄNDIGE LÖSCHUNG' : '🟡 SOFT-KICK', inline: false }
        ]
      );

      console.log(`[EXTREME] Action performed on ${player.id}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `kick_${player.type}/${player.id}`);
    }
  };

  const clearPlayers = async () => {
    if (!isOwner && !isSuperAdmin) return;
    if (!confirm('☣️ EXTREM-RESET Online-Listen: Bist du sicher?')) return;
    try {
      // 1. Delete manual players in waves
      const deletedManual = await deleteCollectionInWaves('online_players');
      
      const batch = writeBatch(db);
      // 2. Queue server status updates
      batch.set(doc(db, 'server_status', 'pvp'), { playerCount: 0, online: true, maxPlayers: 10 }, { merge: true });
      batch.set(doc(db, 'server_status', 'survival'), { playerCount: 0, online: true, maxPlayers: 10 }, { merge: true });

      // 3. Force all user profiles to offline status via waves or individual updates if small
      // For absolute security, we use individual batch updates for current active profiles
      const profilesSnapshot = await getDocs(collection(db, 'user_profiles'));
      profilesSnapshot.docs.forEach(d => {
        batch.set(d.ref, { 
          isOnline: false, 
          currentServer: 'none',
          updatedAt: serverTimestamp() 
        }, { merge: true });
      });

      await batch.commit();
      
      notifyDiscord(
        "🌊 GLOBALER STATUS-RESET",
        `Die Online-Listen wurden vollständig bereinigt.`,
        16753920,
        [
          { name: "👮 Admin", value: myProfile?.displayName || 'System', inline: true },
          { name: "📡 Gelöschte Einträge", value: `${deletedManual}`, inline: true },
          { name: "⚙️ System-Status", value: "ALL_PROFILES_OFFLINED", inline: false }
        ]
      );

      console.log(`[EXTREME] Reset complete. Cleared ${deletedManual} manual entries.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'clear_players');
    }
  };

  const totalReset = async () => {
    if (!isOwner && !isSuperAdmin) return;
    if (!confirm('☢️ APOKALYPTISCHER RESET ☢️\nDAS GESAMTE SYSTEM WURDE GELÖSCHT!\nProfile, Chats, Status - ALLES WEG.\n\nBist du ABSOLUT sicher?')) return;
    
    try {
      await deleteCollectionInWaves('online_players');
      await deleteCollectionInWaves('chat_messages');
      await deleteCollectionInWaves('user_profiles');
      await deleteCollectionInWaves('clans');

      const batch = writeBatch(db);
      batch.set(doc(db, 'server_status', 'pvp'), { online: true, playerCount: 0, maxPlayers: 10, maintenance: false }, { merge: true });
      batch.set(doc(db, 'server_status', 'survival'), { online: true, playerCount: 0, maxPlayers: 10, maintenance: false }, { merge: true });
      batch.set(doc(db, 'app_config', 'system'), { maintenance: false, broadcast: null }, { merge: true });

      await batch.commit();
      
      notifyDiscord(
        "🔥 TOTALER SYSTEM-RESET",
        `**Admin:** ${myProfile?.displayName || user?.displayName}\n**Aktion:** APOCALYPSE_TRIGGERED\n**Ergebnis:** Alle Kollektionen geleert.`,
        16711680 // Special Red
      );

      alert('⚡ SYSTEM REBOOTET: Alles wurde vernichtet.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'total_reset');
    }
  };

  const clearProfiles = async () => {
    if (!isOwner && !isSuperAdmin) return;
    if (!confirm('🔥 DATABASE PURGE: Alle Benutzerprofile löschen?')) return;
    try {
      const deleted = await deleteCollectionInWaves('user_profiles');
      console.log(`Database Purge: ${deleted} profiles removed.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'user_profiles');
    }
  };

  const deleteProfile = async (profileId: string) => {
    if (!isOwner && !isSuperAdmin) return;
    
    // Look up profile to find username for online_players cleanup
    const profile = userProfiles.find(p => p.userId === profileId);
    const discordId = (profile as any)?.discordId;
    
    let alsoDiscord = false;
    if (discordId) {
      alsoDiscord = confirm(`☢️ EXTREM-LÖSCHUNG: Diesen Account vernichten?\n\nSoll der User auch auf Discord (${discordId}) gebannt werden?`);
    } else {
      if (!confirm('☢️ EXTREM-LÖSCHUNG: Diesen Account permanent aus der Datenbank vernichten?')) return;
    }

    try {
      const batch = writeBatch(db);
      
      // 1. Delete Profile document
      batch.delete(doc(db, 'user_profiles', profileId));
      
      // 2. Clear Online Data - Check by userId and by username
      batch.delete(doc(db, 'online_players', profileId));
      if (profile?.minecraftUsername) {
        batch.delete(doc(db, 'online_players', profile.minecraftUsername?.toLowerCase()));
      }
      
      await batch.commit();

      // DISCORD SYNC BAN
      if (alsoDiscord && discordId) {
        try {
          const res = await fetch('/api/discord/ban', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              discordUserId: discordId, 
              reason: `Gebannt via Admin-Panel durch ${myProfile?.displayName || user?.displayName}`
            })
          });
          const data = await res.json();
          if (data.success) {
            console.log("Discord-Bann erfolgreich durchgeführt.");
          } else {
            alert(`Discord-Bann fehlgeschlagen: ${data.error}`);
          }
        } catch (discordErr) {
          console.error("Fehler bei Discord API Call:", discordErr);
        }
      }

      notifyDiscord(
        "💀 ACCOUNT TERMINIERT",
        `**User:** ${profile?.displayName}\n**Email:** ${profile?.userId}\n**Discord-Bann:** ${alsoDiscord ? '✅ Ja' : '❌ Nein'}\n**Admin:** ${myProfile?.displayName || user?.displayName}`,
        0 // Black
      );

      console.log(`Profile ${profileId} wiped from core.`);
      
      // Force immediate local state update for better UI response
      if (editingProfileId === profileId) {
        setShowProfileModal(false);
        setEditingProfileId(null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `user_profiles/${profileId}`);
    }
  };

  const updateRealmName = async (server: 'pvp' | 'survival', name: string) => {
    if (!isAdmin && !isOwner && !isSuperAdmin) return;
    try {
      await setDoc(doc(db, 'app_config', 'system'), {
        realmNames: {
          [server]: name
        }
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'app_config/system');
    }
  };

  const updateRealmColor = async (server: 'pvp' | 'survival', color: string) => {
    if (!isAdmin && !isOwner && !isSuperAdmin) return;
    try {
      await setDoc(doc(db, 'app_config', 'system'), {
        realmColors: {
          [server]: color
        }
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'app_config/system');
    }
  };

  const clearChat = async () => {
    if (!isAdmin) return;
    if (!confirm('🗑️ CHAT-VERLAUF LEEREN? Fortfahren?')) return;
    try {
      const deleted = await deleteCollectionInWaves('chat_messages');
      console.log(`Chat Cleared: ${deleted} messages removed.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'chat_messages');
    }
  };

  const pvpPlayers = players.filter(p => p.server === 'pvp');
  const survivalPlayers = players.filter(p => p.server === 'survival');
  
  // Combined lists for specific servers
  const combinedPvpPlayers = [
    ...userProfiles
      .filter(p => p.isOnline && p.currentServer === 'pvp' && (!p.isInvisible || isAdmin))
      .map(p => ({ username: p.minecraftUsername, id: p.userId, type: 'profile', role: p.role || 'Member', ip: p.lastLoginIp, purchasedRank: p.purchasedRank })),
    ...pvpPlayers.map(p => ({ username: p.username, id: p.id, type: 'manual', role: 'Member', ip: null }))
  ].filter((player, index, self) => 
    index === self.findIndex((t) => t.username?.toLowerCase() === player.username?.toLowerCase())
    && (!userProfiles.find(up => up.minecraftUsername?.toLowerCase() === player.username?.toLowerCase())?.isInvisible || isAdmin)
  );

  const combinedSurvivalPlayers = [
    ...userProfiles
      .filter(p => p.isOnline && p.currentServer === 'survival' && (!p.isInvisible || isAdmin))
      .map(p => ({ username: p.minecraftUsername || p.displayName || p.userId || 'Unbekannt', id: p.userId, type: 'profile', role: p.role || 'Member', ip: p.lastLoginIp, purchasedRank: p.purchasedRank })),
    ...survivalPlayers.map(p => ({ username: p.username || 'Unbekannt', id: p.id, type: 'manual', role: 'Member', ip: null }))
  ].filter((player, index, self) => 
    index === self.findIndex((t) => (t.username || '').toLowerCase() === (player.username || '').toLowerCase())
    && (!userProfiles.find(up => (up.minecraftUsername || up.displayName || '').toLowerCase() === (player.username || '').toLowerCase())?.isInvisible || isAdmin)
  );

  // Combined online players from both manual list and user profiles
  const combinedOnline = useMemo(() => [
    ...players.map(p => ({
      username: p.username,
      server: p.server,
      type: 'manual' as const
    })),
    ...userProfiles
      .filter(p => p.isOnline && (!p.isInvisible || isAdmin))
      .map(p => ({
        username: p.minecraftUsername || p.displayName || p.userId || 'Unbekannt',
        server: p.currentServer,
        displayName: p.displayName,
        userId: p.userId,
        type: 'profile' as const
      }))
  ].filter((player, index, self) => 
    index === self.findIndex((t) => (t.username || '').toLowerCase() === (player.username || '').toLowerCase())
    && (!userProfiles.find(up => (up.minecraftUsername || up.displayName || '').toLowerCase() === (player.username || '').toLowerCase())?.isInvisible || isAdmin)
  ), [players, userProfiles, isAdmin]);

  // Final Unified Community Status List (Synced with Firebase) - Deduped by lowercase username
  // Filter out any duplicates and invalid entries
  const communityDisplayList = useMemo(() => Array.from(new Map(
    userProfiles
      .filter(p => p.userId && (p.displayName || p.minecraftUsername)) 
      .sort((a,b) => (b.isOnline ? 1 : 0) - (a.isOnline ? 1 : 0) || (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0))
      .filter(p => !p.isInvisible || isAdmin)
      .map(p => {
        const name = (p.minecraftUsername || p.displayName || p.userId || '').trim();
        const key = name.toLowerCase();
        
        // Respect STAFF_OVERWRITES for fixed roles (like dampfk and Block5)
        const rawRole = p.role || 'Member';
        const overwrittenRole = STAFF_OVERWRITES[name] || STAFF_OVERWRITES[p.displayName || ''] || rawRole;
        const displayRole = (overwrittenRole === 'Owner' || overwrittenRole === 'Root') ? 'Owner' : (overwrittenRole === 'Admin') ? 'Admin' : overwrittenRole;
        
        // If staff role overwritten a purchased rank role, preserve it as purchased rank
        let effectivePurchasedRank = p.purchasedRank;
        if ((!effectivePurchasedRank || effectivePurchasedRank === 'undefined') && (rawRole === 'VIP' || rawRole === 'MVP')) {
          if (displayRole === 'Owner' || displayRole === 'Admin' || displayRole === 'Mod') {
            effectivePurchasedRank = rawRole;
          }
        }

        return [key, {
          username: name,
          displayName: p.displayName,
          userId: p.userId,
          isOnline: p.isOnline,
          role: displayRole,
          purchasedRank: effectivePurchasedRank,
          profile: p,
          server: p.currentServer || 'none',
          lastLoginIp: p.lastLoginIp,
          lastLoginCity: p.lastLoginCity
        }];
      })
  ).values()).slice(0, 60), [userProfiles, isAdmin]);

  const staffList = useMemo(() => Array.from(new Map(
    userProfiles
      .filter(p => {
        const name = (p.minecraftUsername || p.displayName || p.userId || '').trim();
        const role = STAFF_OVERWRITES[name] || STAFF_OVERWRITES[p.displayName || ''] || p.role;
        return (role === 'Owner' || role === 'Admin' || role === 'Mod' || role === 'Root');
      })
      .sort((a,b) => {
        const nameA = (a.minecraftUsername || a.displayName || a.userId || '').trim();
        const nameB = (b.minecraftUsername || b.displayName || b.userId || '').trim();
        const roleA = STAFF_OVERWRITES[nameA] || STAFF_OVERWRITES[a.displayName || ''] || a.role;
        const roleB = STAFF_OVERWRITES[nameB] || STAFF_OVERWRITES[b.displayName || ''] || b.role;
        
        const rank = { 'Root': 0, 'Owner': 1, 'Admin': 2, 'Mod': 3 };
        const rankValueA = rank[roleA as keyof typeof rank] ?? 99;
        const rankValueB = rank[roleB as keyof typeof rank] ?? 99;
        
        // Sort lowest priority first so map preserves highest
        if (rankValueA !== rankValueB) return rankValueB - rankValueA;
        if (a.isOnline !== b.isOnline) return a.isOnline ? 1 : -1;
        return (a.updatedAt?.seconds || 0) - (b.updatedAt?.seconds || 0);
      })
      .map(p => [(p.minecraftUsername || p.displayName || p.userId || '').trim().toLowerCase(), p])
  ).values()).sort((a: any, b: any) => {
    const nameA = (a.minecraftUsername || a.displayName || a.userId || '').trim();
    const nameB = (b.minecraftUsername || b.displayName || b.userId || '').trim();
    const roleA = STAFF_OVERWRITES[nameA] || STAFF_OVERWRITES[a.displayName || ''] || a.role;
    const roleB = STAFF_OVERWRITES[nameB] || STAFF_OVERWRITES[b.displayName || ''] || b.role;
    
    const rank = { 'Root': 0, 'Owner': 1, 'Admin': 2, 'Mod': 3 };
    const rankValueA = rank[roleA as keyof typeof rank] ?? 99;
    const rankValueB = rank[roleB as keyof typeof rank] ?? 99;
    if (rankValueA !== rankValueB) return rankValueA - rankValueB;
    if (a.isOnline !== b.isOnline) return b.isOnline ? 1 : -1;
    return (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0);
  }), [userProfiles]);

  const totalOnline = combinedOnline.length;

  const getBackgroundStyle = () => {
    const baseStyle: React.CSSProperties = {
      backgroundAttachment: 'fixed',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat'
    };

    if (resolvedTime === 'classic') {
      return { ...baseStyle, backgroundColor: 'black', backgroundImage: 'none' };
    }
    
    // Improved, rich, eye-catching gradients that maintain pixel vibe
    if (resolvedTime === 'morning') {
      return { 
        ...baseStyle, 
        backgroundImage: 'linear-gradient(to bottom, #0d061a 0%, #1d0f32 30%, #46173a 52%, #b53846 72%, #e56b46 87%, #ffd08a 100%)' 
      };
    }
    if (resolvedTime === 'noon') {
      return { 
        ...baseStyle, 
        backgroundImage: 'linear-gradient(to bottom, #084c8a 0%, #1562b3 25%, #328fe3 55%, #6abcff 80%, #a4e5ff 100%)' 
      };
    }
    if (resolvedTime === 'evening') {
      return { 
        ...baseStyle, 
        backgroundImage: 'linear-gradient(to bottom, #030412 0%, #0e0620 22%, #320d2c 44%, #7b1932 64%, #c73e25 82%, #ee8535 93%, #ffd46f 100%)' 
      };
    }
    if (resolvedTime === 'night') {
      return { 
        ...baseStyle, 
        backgroundImage: 'linear-gradient(to bottom, #010103 0%, #02040c 25%, #050a1d 55%, #0b112a 80%, #111d42 100%)' 
      };
    }
    
    // Check custom backgrounds
    const customBg = sharedBackgrounds.find(bg => bg.id === resolvedTime);
    if (customBg) {
      return { 
        ...baseStyle,
        backgroundImage: `url(${customBg.imageUrl})`
      };
    }
    
    // Direct URL support
    if (resolvedTime.startsWith('http') || resolvedTime.startsWith('data:image')) {
      return { 
        ...baseStyle,
        backgroundImage: `url(${resolvedTime})`
      };
    }
    
    return { backgroundColor: 'black', backgroundImage: 'none' };
  };

  const isPresetTime = ['classic', 'morning', 'noon', 'evening', 'night'].includes(resolvedTime);

  return (
    <div className={`min-h-screen relative overflow-x-hidden text-neutral-100 font-sans antialiased bg-black transition-all duration-[400ms] ${isPostGlitching ? 'animate-[glitch-post_0.35s_infinite] saturate-[1.60] contrast-125 sepia-[10%] brightness-95' : ''}`}>
      {/* Herobrine Easter Egg Overlay & Styles */}
      <style>{`
        @keyframes terrifying-shake {
          0% { transform: translate(0, 0) rotate(0deg) scale(1.1); }
          10% { transform: translate(-8px, 6px) rotate(-3deg) scale(1.15); }
          20% { transform: translate(7px, -5px) rotate(4deg) scale(1.1); }
          30% { transform: translate(-9px, -2px) rotate(-2deg) scale(1.23); }
          40% { transform: translate(6px, 9px) rotate(3deg) scale(1.18); }
          50% { transform: translate(-5px, -7px) rotate(-4deg) scale(1.28); }
          60% { transform: translate(8px, 4px) rotate(1deg) scale(1.1); }
          70% { transform: translate(-4px, 8px) rotate(-3deg) scale(1.23); }
          80% { transform: translate(9px, -6px) rotate(5deg) scale(1.18); }
          90% { transform: translate(-6px, -4px) rotate(-1deg) scale(1.35); }
          100% { transform: translate(0, 0) rotate(0deg) scale(1.1); }
        }
        @keyframes blood-pulse {
          0%, 100% { box-shadow: inset 0 0 100px rgba(185, 28, 28, 0.95), 0 0 60px rgba(185, 28, 28, 0.6); }
          50% { box-shadow: inset 0 0 170px rgba(0, 0, 0, 1), 0 0 110px rgba(220, 38, 38, 1); }
        }
        @keyframes glitch-post {
          0% { transform: translate(0) skew(0deg); filter: hue-rotate(0deg); }
          3% { transform: translate(3px, -2px) skew(-3deg); filter: hue-rotate(15deg); }
          6% { transform: translate(-2px, 3px) skew(1deg); filter: hue-rotate(-10deg); }
          8% { transform: translate(0) skew(0deg); }
          40% { transform: translate(0) skew(0deg); }
          42% { transform: translate(-5px, 2px) skew(5deg) scaleY(1.02); filter: invert(0.08); }
          44% { transform: translate(3px, -3px) skew(-2deg); }
          46% { transform: translate(0) skew(0deg); }
          100% { transform: translate(0) skew(0deg); }
        }
        @keyframes chromatic-text {
          0%, 100% { text-shadow: 2px -1px #ef4444, -2px 1px #06b6d4; }
          50% { text-shadow: -3px 2px #ec4899, 3px -2px #10b981; }
        }
        @keyframes eye-glow {
          0%, 100% { filter: drop-shadow(0 0 15px rgba(255, 255, 255, 1)) brightness(1.5); }
          50% { filter: drop-shadow(0 0 35px rgba(239, 68, 68, 1)) brightness(2); }
        }
      `}</style>

      {showJumpscare && (
        <div className="fixed inset-0 z-[999999] bg-black flex flex-col items-center justify-center select-none overflow-hidden animate-[terrifying-shake_0.08s_infinite] pointer-events-auto">
           {/* Blood Red Vignette */}
           <div className="absolute inset-0 pointer-events-none animate-[blood-pulse_0.2s_infinite]" style={{ mixBlendMode: 'multiply' }} />
           
           {/* Creepy static overlay */}
           <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/tv-noise.png')] opacity-95 pointer-events-none mix-blend-screen mix-blend-overlay"></div>
           
           {/* Floating Herobrine Face / Screamer */}
           <div className="relative w-80 h-80 md:w-[480px] md:h-[480px] flex flex-col items-center justify-center scale-125 md:scale-150 transition-all duration-100">
             {/* The Herobrine Image */}
             <img 
               src="https://i.imgur.com/vHq4Rzy.jpg" 
               alt="HEROBRINE" 
               className="w-full h-full object-cover rounded-md border-4 border-mc-red mix-blend-difference opacity-90 scale-110" 
               style={{ filter: 'invert(1) contrast(8) saturate(3) grayscale(0.2)' }}
             />
             {/* Dynamic Custom Glowing White Eyes */}
             <div className="absolute top-[35%] left-[28%] w-8 h-8 md:w-12 md:h-12 bg-white rounded-none shadow-[0_0_40px_rgba(255,255,255,1),0_0_80px_rgba(255,255,255,0.8)] animate-[eye-glow_0.15s_infinite]" />
             <div className="absolute top-[35%] right-[28%] w-8 h-8 md:w-12 md:h-12 bg-white rounded-none shadow-[0_0_40px_rgba(255,255,255,1),0_0_80px_rgba(255,255,255,0.8)] animate-[eye-glow_0.15s_infinite]" />
           </div>

           {/* Terrible Glitchy Text Messages overlay */}
           <div className="absolute inset-x-0 bottom-10 md:bottom-20 text-center z-10 flex flex-col items-center gap-2">
             <div className="font-mono text-mc-red text-4xl md:text-7xl font-black mix-blend-difference scale-y-125 tracking-wider animate-pulse uppercase">
               SYSTEM CORRUPTED
             </div>
             <div className="font-mono text-white text-xs md:text-lg font-bold tracking-[0.4em] opacity-85 uppercase mt-1 animate-[chromatic-text_0.1s_infinite]">
               H̷E̴L̸P̶ ̸U̷S̴ ̸-̷ ̸H̸E̷ ̸I̴S̶ ̶H̵E̴R̷E̶
             </div>
           </div>

           {/* Rapid Glitch/Noise Line Accents */}
           <div className="absolute top-[10%] w-full h-2 bg-mc-red opacity-60 mix-blend-difference animate-bounce"></div>
           <div className="absolute top-[80%] w-full h-3 bg-cyan-500 opacity-50 mix-blend-difference animate-pulse"></div>
           <div className="absolute left-[20%] h-full w-1 bg-white opacity-40 mix-blend-difference animate-ping"></div>

           {/* Mobile-oriented center red alert */}
           <div className="absolute top-4 left-4 font-mono text-[9px] text-mc-red font-bold uppercase tracking-widest bg-red-950/80 border border-mc-red/30 px-2 py-1 rounded">
             CRITICAL_OVERHEAT_ERR_0x666
           </div>
        </div>
      )}

      {/* 
        Fixed Full-Screen Ambient Background Layer
        Ensures a seamless, non-repeating continuous background gradient
        regardless of scroll, browser window size, or iframe boundaries.
      */}
      <div 
        className="fixed inset-0 z-0 pointer-events-none transition-all duration-[1000ms] ease-in-out"
        style={getBackgroundStyle()}
      />

      {/* Grid Pattern overlay with low opacity - fixed behind content */}
      <div className="fixed inset-0 z-0 opacity-15 pointer-events-none pixel-grid" />

      {/* Sky Ambient Elements Layer (Sun, Moon, Stars, Minecraft clouds, Mountains) - Fixed to viewport */}
      {resolvedTime !== 'classic' && (
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden select-none">
          {/* Twinkling Stars (Only in Night, Evening, Morning or Custom Wallpapers) */}
          {(resolvedTime === 'night' || resolvedTime === 'evening' || resolvedTime === 'morning' || !isPresetTime) && (
            <div className="absolute inset-0 z-0">
              {[
                { t: '12%', l: '8%', s: 'w-1 h-0.5', d: 1.5 },
                { t: '25%', l: '20%', s: 'w-1.5 h-1.5', d: 2 },
                { t: '8%', l: '35%', s: 'w-1 h-1', d: 3 },
                { t: '18%', l: '50%', s: 'w-2 h-2', d: 1.2 },
                { t: '28%', l: '65%', s: 'w-1.5 h-1.5', d: 2.5 },
                { t: '10%', l: '80%', s: 'w-2 h-2', d: 1.8 },
                { t: '22%', l: '92%', s: 'w-1 h-1', d: 2.2 },
                { t: '40%', l: '15%', s: 'w-1.5 h-1.5', d: 3.2 },
                { t: '35%', l: '42%', s: 'w-2 h-2', d: 1.6 },
                { t: '45%', l: '78%', s: 'w-1 h-1', d: 2.7 },
              ].map((star, i) => (
                <motion.div
                  key={`bg-star-${i}`}
                  initial={{ opacity: 0.1 }}
                  animate={{ opacity: [0.15, 0.9, 0.15] }}
                  transition={{ repeat: Infinity, duration: star.d, ease: "easeInOut" }}
                  className={`absolute bg-white rounded-none ${star.s} shadow-[0_0_6px_rgba(255,255,255,0.8)]`}
                  style={{ top: star.t, left: star.l }}
                />
              ))}
            </div>
          )}

          {/* Shooting Stars Animation (Only Night, Evening) */}
          {(resolvedTime === 'night' || resolvedTime === 'evening') && (
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
              {[
                { delay: 3, duration: 2, top: '12%', left: '85%' },
                { delay: 10, duration: 2.5, top: '30%', left: '92%' }
              ].map((star, idx) => (
                <motion.div
                  key={`shooting-star-${idx}`}
                  initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                  animate={{ 
                    x: [0, -500], 
                    y: [0, 500], 
                    opacity: [0, 1, 1, 0],
                    scale: [0.6, 1.2, 1.2, 0]
                  }}
                  transition={{ 
                    repeat: Infinity, 
                    duration: star.duration, 
                    delay: star.delay,
                    repeatDelay: 12,
                    ease: "easeOut"
                  }}
                  className="absolute bg-white w-2 h-2 rounded-none rotate-45 shadow-[0_0_12px_rgba(255,255,255,0.9)]"
                  style={{ top: star.top, left: star.left }}
                >
                  <div className="absolute top-0 left-0 w-8 h-1.5 bg-gradient-to-r from-white to-transparent -rotate-45 origin-left" />
                </motion.div>
              ))}
            </div>
          )}

          {/* Pixel Sun & Sunbeams (Morning & Day) */}
          {(resolvedTime === 'noon' || resolvedTime === 'morning') && (
            <motion.div
              initial={{ y: 250, opacity: 0 }}
              animate={{ 
                y: resolvedTime === 'morning' ? 120 : 0, 
                opacity: resolvedTime === 'morning' ? 0.8 : 1 
              }}
              transition={{ type: "spring", stiffness: 35, damping: 15 }}
              className="absolute left-[70%] top-[8%] flex flex-col items-center z-0"
            >
              {/* Sun Rays Halo */}
              <div className="absolute -inset-14 bg-amber-400/25 blur-3xl pointer-events-none rounded-none animate-pulse" />
              {/* Flat pixelated blocky Sun */}
              <div className="w-16 h-16 bg-[#ffd843] border-4 border-[#ca8a04] shadow-[0_0_30px_rgba(251,191,36,0.6)] flex items-center justify-center relative">
                <div className="w-8 h-8 bg-[#fffbeb] opacity-40" />
              </div>
            </motion.div>
          )}

          {/* Pixel Moon (Evening & Night) */}
          {(resolvedTime === 'night' || resolvedTime === 'evening') && (
            <motion.div
              initial={{ y: 250, opacity: 0 }}
              animate={{ 
                y: resolvedTime === 'evening' ? 110 : 0, 
                opacity: resolvedTime === 'evening' ? 0.7 : 1 
              }}
              transition={{ type: "spring", stiffness: 35, damping: 15 }}
              className="absolute left-[72%] top-[8%] flex flex-col items-center z-0"
            >
              {/* Moon Glow Halo */}
              <div className="absolute -inset-14 bg-indigo-300/15 blur-3xl pointer-events-none rounded-none" />
              {/* Flat pixelated blocky Moon (Crescent design) */}
              <div className="w-14 h-14 bg-[#e2e8f0] border-4 border-[#94a3b8] shadow-[0_0_25px_rgba(148,163,184,0.4)] relative flex overflow-hidden">
                <div className="w-1/3 h-full bg-[#cbd5e1] opacity-70" />
                <div className="w-2/3 h-full bg-[#f1f5f9]" />
              </div>
            </motion.div>
          )}

          {/* Drifting flat Minecraft clouds */}
          {isPresetTime && (
            <div className="absolute top-[22%] left-[-20%] w-[150%] h-[120px] pointer-events-none opacity-45 z-0">
              <motion.div 
                animate={{ x: ["0%", "80%"] }}
                transition={{ repeat: Infinity, duration: 160, ease: "linear" }}
                className="flex gap-48"
              >
                <div className="w-64 h-8 bg-white/10 relative">
                  <div className="absolute left-4 -top-4 w-40 h-8 bg-white/10" />
                  <div className="absolute left-12 -top-8 w-24 h-8 bg-white/10" />
                </div>
                <div className="w-80 h-10 bg-white/10 relative mt-6">
                  <div className="absolute left-8 -top-4 w-48 h-10 bg-white/10" />
                  <div className="absolute left-20 -top-8 w-32 h-10 bg-white/10" />
                </div>
                <div className="w-56 h-8 bg-white/10 relative mt-12">
                  <div className="absolute left-6 -top-4 w-32 h-8 bg-white/10" />
                </div>
              </motion.div>
            </div>
          )}

          {/* Blocky Parallax Mountains (Only for standard times to keep custom clear) */}
          {isPresetTime && (
            <div className="absolute inset-x-0 bottom-0 h-64 pointer-events-none z-0 overflow-hidden select-none">
              {/* Define color mappings for each time mode */}
              {(() => {
                const colors = {
                  morning: { far: '#3d1a40', mid: '#270e2d', close: '#15031b' },
                  noon: { far: '#397fb5', mid: '#225992', close: '#0f3565' },
                  evening: { far: '#491535', mid: '#300827', close: '#1a011a' },
                  night: { far: '#0b0f24', mid: '#050817', close: '#02030a' }
                }[resolvedTime as 'morning' | 'noon' | 'evening' | 'night'] || { far: '#0b0f24', mid: '#050817', close: '#02030a' };

                return (
                  <>
                    {/* Far Mountain silhouette */}
                    <div 
                      className="absolute inset-x-0 bottom-0 h-52 origin-bottom transition-all duration-[1000ms] ease-in-out"
                      style={{ 
                        clipPath: 'polygon(0% 100%, 0% 65%, 4% 65%, 4% 60%, 8% 60%, 8% 55%, 12% 55%, 12% 50%, 16% 50%, 16% 45%, 20% 45%, 20% 50%, 24% 50%, 24% 55%, 28% 55%, 28% 60%, 32% 60%, 32% 55%, 36% 55%, 36% 50%, 40% 50%, 40% 45%, 44% 45%, 44% 40%, 48% 40%, 48% 35%, 52% 35%, 52% 40%, 56% 40%, 56% 45%, 60% 45%, 60% 50%, 64% 50%, 64% 55%, 68% 55%, 68% 60%, 72% 60%, 72% 55%, 76% 55%, 76% 50%, 80% 50%, 80% 45%, 84% 45%, 84% 40%, 88% 40%, 88% 45%, 92% 45%, 92% 50%, 96% 50%, 96% 55%, 100% 55%, 100% 100%)',
                        backgroundColor: colors.far
                      }} 
                    >
                      {/* Distant spruce trees on far peaks */}
                      <SpruceTree color={colors.far} height={20} className="left-[14%] bottom-[45%]" />
                      <SpruceTree color={colors.far} height={24} className="left-[46%] bottom-[55%]" />
                      <SpruceTree color={colors.far} height={20} className="left-[54%] bottom-[55%]" />
                      <SpruceTree color={colors.far} height={18} className="left-[82%] bottom-[50%]" />
                    </div>

                    {/* Mid Mountain silhouette */}
                    <div 
                      className="absolute inset-x-0 bottom-0 h-40 origin-bottom transition-all duration-[1000ms] ease-in-out"
                      style={{ 
                        clipPath: 'polygon(0% 100%, 0% 75%, 3% 75%, 3% 70%, 6% 70%, 6% 65%, 9% 65%, 9% 60%, 12% 60%, 12% 55%, 15% 55%, 15% 50%, 18% 50%, 18% 45%, 21% 45%, 21% 50%, 24% 50%, 24% 55%, 27% 55%, 27% 60%, 30% 60%, 30% 65%, 33% 65%, 33% 70%, 36% 70%, 36% 75%, 39% 75%, 39% 70%, 42% 70%, 42% 65%, 45% 65%, 45% 60%, 48% 60%, 48% 55%, 51% 55%, 51% 50%, 54% 50%, 54% 55%, 57% 55%, 57% 60%, 60% 60%, 60% 65%, 63% 65%, 63% 70%, 66% 70%, 66% 75%, 69% 75%, 69% 70%, 72% 70%, 72% 65%, 75% 65%, 75% 60%, 78% 60%, 78% 55%, 81% 55%, 81% 50%, 84% 50%, 84% 55%, 87% 55%, 87% 60%, 90% 60%, 90% 65%, 93% 65%, 93% 70%, 96% 70%, 96% 75%, 100% 75%, 100% 100%)',
                        backgroundColor: colors.mid
                      }} 
                    >
                      {/* Voxel Castle standing on mid peak */}
                      <PixelCastle color={colors.mid} height={56} className="right-[15%] bottom-[42%]" />

                      {/* Mid spruce trees on mid peaks */}
                      <SpruceTree color={colors.mid} height={32} className="left-[8%] bottom-[35%]" />
                      <SpruceTree color={colors.mid} height={36} className="left-[25%] bottom-[35%]" />
                      <SpruceTree color={colors.mid} height={40} className="left-[47%] bottom-[45%]" />
                      <SpruceTree color={colors.mid} height={30} className="left-[64%] bottom-[30%]" />
                    </div>

                    {/* Close Rocky foothills / blocky trees */}
                    <div 
                      className="absolute inset-x-0 bottom-0 h-28 origin-bottom transition-all duration-[1000ms] ease-in-out"
                      style={{ 
                        clipPath: 'polygon(0% 100%, 0% 85%, 2% 85%, 2% 80%, 4% 80%, 4% 75%, 6% 75%, 6% 70%, 8% 70%, 8% 65%, 10% 65%, 10% 60%, 13% 60%, 13% 65%, 16% 65%, 16% 70%, 19% 70%, 19% 75%, 22% 75%, 22% 80%, 25% 80%, 25% 85%, 28% 85%, 28% 80%, 31% 80%, 31% 75%, 34% 75%, 34% 70%, 37% 70%, 37% 65%, 40% 65%, 40% 60%, 43% 60%, 43% 65%, 46% 65%, 46% 70%, 49% 70%, 49% 75%, 52% 75%, 52% 80%, 55% 80%, 55% 85%, 58% 85%, 58% 80%, 61% 80%, 61% 75%, 64% 75%, 64% 70%, 67% 70%, 67% 65%, 70% 65%, 70% 60%, 73% 60%, 73% 65%, 76% 65%, 76% 70%, 79% 70%, 79% 75%, 82% 75%, 82% 80%, 85% 80%, 85% 85%, 88% 85%, 88% 80%, 91% 80%, 91% 75%, 94% 75%, 94% 70%, 97% 70%, 97% 75%, 100% 75%, 100% 100%)',
                        backgroundColor: colors.close
                      }} 
                    >
                      {/* Foreground spruce forest spruce forest */}
                      <SpruceTree color={colors.close} height={48} className="left-[3%] bottom-[30%]" />
                      <SpruceTree color={colors.close} height={56} className="left-[12%] bottom-[35%]" />
                      <SpruceTree color={colors.close} height={48} className="left-[29%] bottom-[20%]" />
                      <SpruceTree color={colors.close} height={64} className="left-[42%] bottom-[35%]" />
                      <SpruceTree color={colors.close} height={52} className="left-[58%] bottom-[25%]" />
                      <SpruceTree color={colors.close} height={60} className="left-[73%] bottom-[35%]" />
                      <SpruceTree color={colors.close} height={54} className="left-[88%] bottom-[20%]" />
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}

      <PixelWeatherEffect mode={weatherMode} resolvedTime={resolvedTime} sharedWeathers={sharedWeathers} />
      {isPresetTime && (
        <div className="absolute inset-x-0 bottom-0 h-64 pointer-events-none z-[2] select-none">
          <MountainPets playAppSound={playAppSound} />
        </div>
      )}
      <FloatingParticles />
      {/* Emergency Fallback Banner */}
      {isMaintenanceMode && (
        <motion.div 
          initial={{ y: -50 }}
          animate={{ y: 0 }}
          className="fixed top-0 left-0 right-0 bg-red-600/90 backdrop-blur-md text-white py-1 px-4 text-[9px] font-black uppercase tracking-[0.2em] text-center border-b border-red-500/50 z-[9991] flex items-center justify-center gap-3 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_2s_infinite]"></div>
          <ShieldAlert size={10} className="animate-pulse" />
          <span>⚠️ EMERGENCY-BACKUP AKTIV: KRITISCHE DATEN WERDEN VOM LOKALEN SERVER GEHODELT (FIREBASE QUOTA LIMIT)</span>
          <ShieldAlert size={10} className="animate-pulse" />
        </motion.div>
      )}

      {/* Grid Pattern overlay with low opacity */}
      <div className="fixed inset-0 z-0 opacity-15 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-mc-red/5 to-transparent animate-pulse" />
        <div className="w-full h-full opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #ff4747 1px, transparent 0)', backgroundSize: '40px 40px' }} />
      </div>
      
      {/* Scanline Effect */}
      <div className="fixed inset-0 z-[2] pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] opacity-20" />

      {/* Background Glows */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-mc-red/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-mc-gold/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Maintenance Overlay */}
      <AnimatePresence>
        {isMaintenanceMode && !isSuperAdmin && (
          <motion.div 
            key="maintenance-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center p-6 text-center select-none"
          >
            <div className="mc-card border-mc-red bg-mc-red/10 p-12 max-w-lg aspect-square flex flex-col items-center justify-center">
              <Lock size={64} className="text-mc-red mb-6 animate-pulse" />
              <h1 className="text-4xl font-black uppercase tracking-tighter mb-4 text-mc-red">Wartungsarbeiten</h1>
              <p className="text-neutral-400 font-medium leading-relaxed">
                Der Community-Server befindet sich gerade im Umbau. <br />
                Bitte schau später wieder vorbei!
              </p>
              <div className="mt-8 pt-8 border-t border-mc-red/20 w-full flex flex-col items-center gap-4">
                <a href={DISCORD_URL} target="_blank" rel="noreferrer" className="mc-button mc-button-secondary py-3 px-8 text-xs font-black uppercase tracking-widest">
                  Discord beitreten
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Root Stealth Indicators - Extremely subtle and only for Block5 */}
      {isSuperAdmin && !isAnyOverlayOpen && (
        <>
          {myProfile?.isInvisible && (
            <div className="fixed top-0 right-0 w-1 h-1 bg-purple-500/20 z-[9999] pointer-events-none" />
          )}
          <motion.button
            whileHover={{ scale: 1.1, backgroundColor: 'rgba(147, 51, 234, 0.4)' }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowAdmin(!showAdmin)}
            className="fixed bottom-6 left-6 w-12 h-12 bg-purple-600/30 border-2 border-purple-500/50 rounded-full z-[100] flex items-center justify-center backdrop-blur-xl shadow-[0_0_30px_rgba(168,85,247,0.4)] transition-colors"
            title="Root Console (Shift+Alt+S / Ctrl+Alt+P)"
          >
            <Zap size={22} className="text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
          </motion.button>
        </>
      )}

      {/* Floating Info-Bot Chat-Bubble Button (Bottom Left) */}
      {!isAnyOverlayOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className={`fixed bottom-6 z-[100] transition-all duration-300 ${isSuperAdmin ? 'left-[5.5rem]' : 'left-6'}`}
        >
          <button
            onClick={() => {
              setBotpressOpen(true);
              setIsFabMenuOpen(false);
              setIsAiOpen(false);
              setChatOpen(false);
              setNewsOpen(false);
              setPollsOpen(false);
              setShopOpen(false);
              setShowMiningModal(false);
              setLeaderboardOpen(false);
            }}
            className="w-14 h-14 rounded-2xl bg-black border-2 border-cyan-500 text-cyan-400 flex items-center justify-center shadow-[0_0_25px_rgba(6,182,212,0.4)] hover:scale-110 active:scale-95 transition-all relative group"
            title="Info-Bot öffnen"
          >
            {/* Pulsing indicator */}
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
            </span>

            <Bot size={24} className="text-cyan-400 animate-pulse" />

            <div className="absolute left-16 bg-black/95 text-cyan-400 text-[10px] font-mono font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-cyan-500/30 shadow-xl opacity-0 scale-90 origin-left group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 select-none whitespace-nowrap pointer-events-none">
              Info-Bot fragen ✨
            </div>
          </button>
        </motion.div>
      )}

      {/* Floating Day-Night & Audio Note-Block Control Center */}
      {!isAnyOverlayOpen && (
        <motion.div
          layout
          initial={{ opacity: 0, y: -20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 25 }}
          className="fixed top-6 right-6 z-[90] flex flex-col items-end gap-2 select-none"
        >
          {/* Main Expand/Collapse Toggle Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setIsTimeConsoleExpanded(!isTimeConsoleExpanded);
              playAppSound('click');
            }}
            className={`w-10 h-10 rounded-xl flex items-center justify-center text-white backdrop-blur-md shadow-2xl transition-all duration-300 border-2 ${
              isTimeConsoleExpanded 
                ? 'bg-mc-gold/25 border-mc-gold text-mc-gold' 
                : 'bg-black/85 border-neutral-800 hover:border-mc-gold'
            }`}
            title={isTimeConsoleExpanded ? 'Optionen einklappen' : 'VFX & Wetter-Optionen öffnen ✨'}
          >
            <motion.div
              animate={{ rotate: isTimeConsoleExpanded ? 180 : 0 }}
              transition={{ type: "spring", stiffness: 150, damping: 15 }}
            >
              <Settings size={18} />
            </motion.div>
          </motion.button>

          {/* Expanded Settings Panels */}
          <AnimatePresence>
            {isTimeConsoleExpanded && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 220, damping: 22 }}
                className="flex flex-col items-end gap-2"
              >
                {/* Sound Mute Toggle Button */}
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    const nextMute = !appMuted;
                    setAppMuted(nextMute);
                    localStorage.setItem('app_muted', String(nextMute));
                    if (!nextMute) {
                      setTimeout(() => playAppSound('click'), 100);
                    }
                  }}
                  className="w-10 h-10 bg-black/85 border-2 border-neutral-800/80 hover:border-mc-gold/50 rounded-xl flex items-center justify-center text-white backdrop-blur-md shadow-2xl transition-all flex-shrink-0"
                  title={appMuted ? 'Note-Block VFX aktivieren 🔊' : 'Note-Block VFX stummschalten 🔇'}
                >
                  {appMuted ? (
                    <VolumeX size={16} className="text-neutral-500" />
                  ) : (
                    <Volume2 size={16} className="text-mc-gold animate-pulse" />
                  )}
                </motion.button>

                {/* Time & Background Multi-Selector Console with public scrolling gallery */}
                <div className="bg-black/95 border-2 border-neutral-800/80 rounded-xl p-2 md:p-3 flex flex-col gap-2 md:gap-3 backdrop-blur-md shadow-2xl max-w-[90vw] sm:max-w-md md:max-w-4xl overflow-hidden">
                  {/* Top row: Presets & Galerie */}
                  <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-1.5 w-full">
                    {/* Time Presets Row */}
                    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 w-full md:w-auto">
                      <div className="flex items-center gap-1 border-r border-neutral-800/40 pr-2 flex-shrink-0">
                        {[
                          { id: 'classic', label: 'Classic 🌌', icon: Clock, sound: 'click' },
                          { id: 'morning', label: 'Morning 🌅', icon: Sunrise, sound: 'sun' },
                          { id: 'noon', label: 'Noon ☀️', icon: Sun, sound: 'sun' },
                          { id: 'evening', label: 'Evening 🌇', icon: Sunset, sound: 'moon' },
                          { id: 'night', label: 'Night 🌙', icon: Moon, sound: 'moon' }
                        ].map((opt) => (
                          <motion.button
                            key={`time-opt-${opt.id}`}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              setBackgroundTimeMode(opt.id);
                              localStorage.setItem('background_time_mode', opt.id);
                              playAppSound(opt.sound as any);
                              triggerToast('quest', 'WETTER-HEXEREI! 🌤️', `Hintergrund wurde auf "${opt.id.toUpperCase()}" gestellt.`);
                            }}
                            className={`py-1.5 px-2 rounded-lg text-[8px] sm:text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all flex-shrink-0 ${
                              backgroundTimeMode === opt.id
                                ? 'bg-mc-gold text-black border border-mc-gold shadow-[0_0_12px_rgba(255,170,0,0.4)] font-semibold'
                                : 'hover:bg-neutral-800/60 text-neutral-400 hover:text-white border border-transparent'
                            }`}
                            title={opt.label}
                          >
                            <opt.icon size={11} className={backgroundTimeMode === opt.id ? 'text-black' : 'text-neutral-500'} />
                            <span className="hidden sm:inline">{opt.id}</span>
                          </motion.button>
                        ))}
                      </div>

                      {/* Shared Wallpapers List */}
                      <div className="flex items-center gap-1.5 pl-1 flex-1">
                        <span className="text-[7.5px] font-black uppercase text-neutral-500 tracking-wider hidden md:inline whitespace-nowrap mr-0.5 flex-shrink-0">
                          Galerie:
                        </span>

                        {/* Upload Plus Trigger Card */}
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            if (!user) {
                              triggerToast('quest', 'MELDUNG 🔒', 'Melde dich an, um eigene Wallpapers mit allen zu teilen!');
                              setShowLoginModal(true);
                            } else {
                              setShowBgUploadModal(true);
                            }
                            playAppSound('click');
                          }}
                          className="w-10 h-8 rounded-lg bg-mc-gold/15 border border-mc-gold/40 hover:bg-mc-gold/25 text-mc-gold transition-all flex flex-col items-center justify-center flex-shrink-0 cursor-pointer outline-none"
                          title="Eigenen Hintergrund teilen ✨"
                        >
                          <Plus size={11} />
                          <span className="text-[6px] font-black uppercase tracking-tighter leading-none mt-0.5">Teilen</span>
                        </motion.button>

                        {/* Array of Shared Backgrounds */}
                        {sharedBackgrounds.map((bg) => {
                          const isCreator = user && bg.userId === user.uid;
                          const isAdm = myProfile && ['Admin', 'Owner', 'Root'].includes(myProfile.role);
                          const isSelected = backgroundTimeMode === bg.id;

                          return (
                            <motion.div
                              key={`shared-bg-item-${bg.id}`}
                              className="relative flex-shrink-0 group"
                            >
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => {
                                  setBackgroundTimeMode(bg.id);
                                  localStorage.setItem('background_time_mode', bg.id);
                                  playAppSound('pop');
                                  triggerToast('quest', 'WALLPAPER AKTIV 🎨', `"${bg.title}" von ${bg.uploadedBy} geladen.`);
                                }}
                                className={`w-14 h-8 rounded-lg relative overflow-hidden bg-neutral-950 border transition-all flex flex-col items-center justify-end p-0.5 outline-none cursor-pointer ${
                                  isSelected
                                    ? 'border-mc-gold ring-1 ring-mc-gold shadow-[0_0_10px_rgba(255,170,0,0.4)]'
                                    : 'border-neutral-800 hover:border-neutral-600'
                                }`}
                                title={`"${bg.title}" geteilt von ${bg.uploadedBy}`}
                              >
                                <img
                                  src={bg.imageUrl}
                                  alt={bg.title}
                                  referrerPolicy="no-referrer"
                                  className="absolute inset-0 w-full h-full object-cover opacity-65 group-hover:opacity-95 transition-opacity"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent pointer-events-none" />
                                <span className="relative z-10 text-[6px] font-black text-white truncate text-center w-full block drop-shadow-[0_1px_1px_rgba(0,0,0,0.95)] px-0.5 pb-0.5 leading-none max-w-full">
                                  {bg.title}
                                </span>
                              </motion.button>

                              {/* Delete capability overlay bin icon (Only for author or admins) */}
                              {(isCreator || isAdm) && (
                                <button
                                  onClick={(e) => handleBgDelete(bg.id, bg.title, e)}
                                  className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md pointer-events-auto hover:bg-red-700 hover:scale-110 cursor-pointer"
                                  title="Dieses Wallpaper löschen 🗑️"
                                >
                                  <span className="text-[8px] font-black leading-none">×</span>
                                </button>
                              )}
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Divider line */}
                  <div className="h-[1px] bg-neutral-800/40 w-full" />

                  {/* Bottom Row: Weather Select */}
                  <div className="flex flex-col md:flex-row md:items-center gap-1.5 md:gap-2 overflow-hidden w-full">
                    <span className="text-[7.5px] font-black uppercase text-neutral-400 tracking-wider whitespace-nowrap pl-1 md:pl-0">
                      Wetter-Hexerei:
                    </span>
                    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5 select-none w-full scroll-smooth">
                      {/* Standard Weathers */}
                      <div className="flex items-center gap-1 flex-shrink-0 border-r border-neutral-800/40 pr-1.5">
                        {[
                          { id: 'cycle', label: 'Auto 🔄', icon: Compass, sound: 'click' },
                          { id: 'sunny', label: 'Sonne ☀️', icon: SunDim, sound: 'click' },
                          { id: 'rain', label: 'Regen 🌧️', icon: CloudRain, sound: 'pop' },
                          { id: 'snow', label: 'Schnee ❄️', icon: Snowflake, sound: 'click' },
                          { id: 'leaves', label: 'Wind 🍀', icon: Leaf, sound: 'click' }
                        ].map((opt) => (
                          <motion.button
                            key={`weather-opt-${opt.id}`}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              setWeatherMode(opt.id);
                              localStorage.setItem('app_weather_mode', opt.id);
                              playAppSound(opt.sound as any);
                              triggerToast('quest', 'METEOROLOGIE 🪄', `Wetter wurde auf "${opt.id.toUpperCase()}" gestellt.`);
                            }}
                            className={`py-1 px-1.5 rounded-lg text-[8px] sm:text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all flex-shrink-0 cursor-pointer ${
                              weatherMode === opt.id
                                ? 'bg-sky-500 text-black border border-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.4)] font-semibold'
                                : 'bg-neutral-900/45 hover:bg-neutral-800/60 text-neutral-400 hover:text-white border border-transparent'
                            }`}
                            title={opt.label}
                          >
                            <opt.icon size={11} className={weatherMode === opt.id ? 'text-black' : 'text-neutral-500'} />
                            <span>{opt.id === 'cycle' ? 'auto' : opt.id}</span>
                          </motion.button>
                        ))}
                      </div>

                      {/* Add Custom Weather Button */}
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          if (!user) {
                            triggerToast('quest', 'MELDUNG 🔒', 'Melde dich an, um dein eigenes Wetter mit allen zu teilen!');
                            setShowLoginModal(true);
                          } else {
                            setShowWeatherUploadModal(true);
                          }
                          playAppSound('click');
                        }}
                        className="py-1 px-1.5 rounded-lg bg-sky-500/15 border border-sky-500/40 hover:bg-sky-500/25 text-sky-400 transition-all flex items-center gap-1 flex-shrink-0 cursor-pointer outline-none"
                        title="Eigenes Wetter erschaffen ✨"
                      >
                        <Plus size={11} />
                        <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider">Erstellen</span>
                      </motion.button>

                      {/* Shared Custom Weathers */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {sharedWeathers.map((w) => {
                          const isCreator = user && w.userId === user.uid;
                          const isAdm = myProfile && ['Admin', 'Owner', 'Root'].includes(myProfile.role);
                          const isSelected = weatherMode === w.id;
                          const weatherEmoji = w.type === 'rain' ? '🌧️' : (w.type === 'snow' ? '❄️' : '🍀');

                          return (
                            <div key={`shared-weather-item-${w.id}`} className="relative flex-shrink-0 group">
                              <motion.button
                                { ...{ whileHover: { scale: 1.05 }, whileTap: { scale: 0.95 } } as any }
                                onClick={() => {
                                  setWeatherMode(w.id);
                                  localStorage.setItem('app_weather_mode', w.id);
                                  playAppSound('pop');
                                  triggerToast('quest', 'WETTER-MASTERY 🔮', `"${w.title}" geladen.`);
                                }}
                                className={`py-1 px-1.5 rounded-lg text-[8px] sm:text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all flex-shrink-0 cursor-pointer ${
                                  isSelected
                                    ? 'bg-sky-500 text-black border border-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.4)] font-semibold'
                                    : 'bg-neutral-950 border border-neutral-800 hover:border-neutral-600 text-neutral-400 hover:text-white'
                                }`}
                                title={`"${w.title}" geteilt von ${w.uploadedBy}`}
                              >
                                <span>{weatherEmoji}</span>
                                <span>{w.title}</span>
                              </motion.button>

                              {/* Delete button for authors or admins */}
                              {(isCreator || isAdm) && (
                                <button
                                  onClick={(e) => handleWeatherDelete(w.id, w.title, e)}
                                  className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md pointer-events-auto hover:bg-red-700 hover:scale-110 cursor-pointer z-10"
                                  title="Dieses Wetter löschen 🗑️"
                                >
                                  <span className="text-[8px] font-black leading-none">×</span>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Custom Background Upload Modal */}
      <AnimatePresence>
        {showBgUploadModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[190] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
            onClick={() => setShowBgUploadModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              className="w-full max-w-md bg-neutral-900 border-2 border-neutral-800 rounded-2xl p-6 shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={() => {
                  setShowBgUploadModal(false);
                  playAppSound('click');
                }}
                className="absolute top-4 right-4 text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-mc-gold/10 flex items-center justify-center text-mc-gold border border-mc-gold/20">
                  <ImageIcon size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">Hintergrund teilen 🎨</h3>
                  <p className="text-[10px] text-neutral-400">Veröffentliche deinen Lieblingshintergrund für die ganze Community.</p>
                </div>
              </div>

              <form onSubmit={handleBgUploadSubmit} className="space-y-4">
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-wider text-neutral-400 mb-1">
                    Name des Hintergrunds *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={32}
                    value={uploadBgTitle}
                    onChange={(e) => setUploadBgTitle(e.target.value)}
                    placeholder="z.B. Pixel Wald, Ender-Drache..."
                    className="w-full bg-black/50 border border-neutral-850 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-mc-gold transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-black uppercase tracking-wider text-neutral-400 mb-1">
                    Methode zum Hochladen
                  </label>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => {
                        setUploadBgMethod('url');
                        playAppSound('click');
                      }}
                      className={`py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider text-center transition-all cursor-pointer ${
                        uploadBgMethod === 'url' 
                          ? 'bg-mc-gold text-black border border-mc-gold' 
                          : 'bg-neutral-850 hover:bg-neutral-800 text-neutral-400 border border-transparent'
                      }`}
                    >
                      Bild URL einfügen
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUploadBgMethod('file');
                        playAppSound('click');
                      }}
                      className={`py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider text-center transition-all cursor-pointer ${
                        uploadBgMethod === 'file' 
                          ? 'bg-mc-gold text-black border border-mc-gold' 
                          : 'bg-neutral-850 hover:bg-neutral-800 text-neutral-400 border border-transparent'
                      }`}
                    >
                      Datei auswählen (PC/Handy)
                    </button>
                  </div>

                  {uploadBgMethod === 'url' ? (
                    <div>
                      <input
                        type="url"
                        value={uploadBgUrl}
                        onChange={(e) => setUploadBgUrl(e.target.value)}
                        placeholder="https://deine-seite.de/bild.png"
                        className="w-full bg-black/50 border border-neutral-850 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-mc-gold transition-colors"
                      />
                      <p className="text-[8px] text-neutral-500 mt-1">Ggf. kannst du ein Bild auf Seiten wie imgur.com hochladen und hier verlinken.</p>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-neutral-850 bg-black/30 rounded-xl p-4 flex flex-col items-center justify-center relative cursor-pointer hover:border-mc-gold/40 transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 8000000) {
                              triggerToast('quest', 'DATEI ZU GROẞ! 📁', 'Bitte wähle ein Bild unter 8 MB.');
                              return;
                            }
                            triggerToast('quest', 'KOMPRIMIERUNG... ⏳', 'Hintergrund wird für schnelles Laden optimiert...');
                            compressAndResizeImage(file, 1280, 720, 0.55)
                              .then((compressedBase64) => {
                                setUploadBgFileBase64(compressedBase64);
                                triggerToast('quest', 'BILD GELADEN! 🖼️', `"${file.name}" erfolgreich optimiert.`);
                              })
                              .catch((err) => {
                                console.error("Compression failed:", err);
                                triggerToast('quest', 'FEHLER ❌', 'Komprimierung fehlgeschlagen.');
                              });
                          }
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                      <Upload size={20} className="text-neutral-500 mb-1" />
                      <span className="text-[9px] font-black text-neutral-400 uppercase tracking-wider text-center">
                        Bild-Datei hierhin ziehen oder anklicken
                      </span>
                      {uploadBgFileBase64 && (
                        <div className="mt-3 relative w-full h-24 rounded-lg overflow-hidden border border-neutral-800 bg-neutral-950">
                          <img src={uploadBgFileBase64} className="w-full h-full object-cover" alt="Preview" />
                          <div className="absolute top-1 right-1 bg-black/80 px-1.5 py-0.5 rounded text-[7px] text-mc-gold uppercase font-black">
                            Vorschau
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={isUploadingBg}
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-mc-gold hover:bg-amber-400 text-black font-extrabold uppercase text-xs tracking-wider border-b-4 border-amber-600 shadow-md flex items-center justify-center gap-2 disabled:opacity-55 cursor-pointer"
                  >
                    {isUploadingBg ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        Teile mit allen...
                      </>
                    ) : (
                      <>
                        Hintergrund für alle veröffentlichen 🚀
                      </>
                    )}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Weather Creator Modal */}
      <AnimatePresence>
        {showWeatherUploadModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[190] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
            onClick={() => setShowWeatherUploadModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              className="w-full max-w-md bg-neutral-900 border-2 border-neutral-800 rounded-2xl p-6 shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={() => {
                  setShowWeatherUploadModal(false);
                  playAppSound('click');
                }}
                className="absolute top-4 right-4 text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-400 border border-sky-500/20">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">Wetter erschaffen 🌧️</h3>
                  <p className="text-[10px] text-neutral-400">Passe dein eigenes, animiertes Pixel-Wetter an und teile es mit allen.</p>
                </div>
              </div>

              <form onSubmit={handleWeatherUploadSubmit} className="space-y-4 max-h-[62vh] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-neutral-800">
                {/* 1. Name */}
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-wider text-neutral-400 mb-1">
                    Wetter Name *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={32}
                    value={uploadWeatherTitle}
                    onChange={(e) => setUploadWeatherTitle(e.target.value)}
                    placeholder="z.B. Goldener Regen, Kometenschauer..."
                    className="w-full bg-black/50 border border-neutral-850 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-400 transition-colors"
                  />
                </div>

                {/* 2. Type */}
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-wider text-neutral-400 mb-1">
                    Muster / Bewegungsverhalten
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'rain', label: 'Regen 🌧️' },
                      { id: 'snow', label: 'Schnee ❄️' },
                      { id: 'leaves', label: 'Blätter 🍀' }
                    ].map((t) => (
                      <button
                        key={`t-${t.id}`}
                        type="button"
                        onClick={() => {
                          setUploadWeatherType(t.id as any);
                          playAppSound('click');
                        }}
                        className={`py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider text-center transition-all cursor-pointer ${
                          uploadWeatherType === t.id 
                            ? 'bg-sky-500 text-black border border-sky-400' 
                            : 'bg-neutral-850 hover:bg-neutral-800 text-neutral-400 border border-transparent'
                        }`}
                      >
                        {t.id === 'rain' ? 'Regen' : t.id === 'snow' ? 'Schnee' : 'Blätter'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Particle Shape */}
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-wider text-neutral-400 mb-1">
                    Partikel-Form
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'pixels', label: 'Eckig ◼️' },
                      { id: 'circles', label: 'Rund 🔴' },
                      { id: 'emojis', label: 'Emoji ⭐' }
                    ].map((sh) => (
                      <button
                        key={`sh-${sh.id}`}
                        type="button"
                        onClick={() => {
                          setUploadWeatherParticleShape(sh.id as any);
                          playAppSound('click');
                        }}
                        className={`py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider text-center transition-all cursor-pointer ${
                          uploadWeatherParticleShape === sh.id 
                            ? 'bg-sky-500 text-black border border-sky-400' 
                            : 'bg-neutral-850 hover:bg-neutral-800 text-neutral-400 border border-transparent'
                        }`}
                      >
                        {sh.id === 'pixels' ? 'Eckig' : sh.id === 'circles' ? 'Rund' : 'Emoji'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Emojis input */}
                {uploadWeatherParticleShape === 'emojis' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="overflow-hidden space-y-1"
                  >
                    <label className="block text-[9px] font-black uppercase tracking-wider text-neutral-400">
                      Symbole / Emojis (Zufallsauswahl aus Eingabe)
                    </label>
                    <input
                      type="text"
                      maxLength={24}
                      value={uploadWeatherEmojiString}
                      onChange={(e) => setUploadWeatherEmojiString(e.target.value)}
                      placeholder="z.B. ⭐🪙💖💀🥦"
                      className="w-full bg-black/50 border border-neutral-850 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-400 transition-colors"
                    />
                    <p className="text-[7.5px] text-neutral-500">Jedes Zeichen wird als herabregnendes Partikel verwendet.</p>
                  </motion.div>
                )}

                {/* 3. Colors selection */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[9px] font-black uppercase tracking-wider text-neutral-400">
                      Partikel-Farben (Auswahl: {uploadWeatherColors.join(', ')})
                    </label>
                    {uploadWeatherColors.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setUploadWeatherColors(['#ffffff']);
                          playAppSound('click');
                        }}
                        className="text-[8px] font-black text-rose-400 hover:text-rose-300 uppercase transition-colors"
                      >
                        Leeren
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 p-2 bg-black/30 rounded-xl border border-neutral-850">
                    {[
                      { name: 'Blau', hex: '#82cbff' },
                      { name: 'Smaragd', hex: '#2ecc71' },
                      { name: 'Drache', hex: '#ff4d4d' },
                      { name: 'Gold', hex: '#f1c40f' },
                      { name: 'Portal', hex: '#9b59b6' },
                      { name: 'Schnee', hex: '#ffffff' },
                      { name: 'Pastell', hex: '#ff99cc' },
                      { name: 'Slime', hex: '#5bfb00' },
                      { name: 'Lava', hex: '#ff5500' },
                      { name: 'Herbst', hex: '#e67e22' }
                    ].map((preset) => {
                      const isSelected = uploadWeatherColors.includes(preset.hex);
                      return (
                        <button
                          key={`col-${preset.hex}`}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              if (uploadWeatherColors.length > 1) {
                                setUploadWeatherColors(prev => prev.filter(c => c !== preset.hex));
                              }
                            } else {
                              if (uploadWeatherColors.length < 10) {
                                setUploadWeatherColors(prev => [...prev, preset.hex]);
                              } else {
                                triggerToast('quest', 'LIMIT ERREICHT 🎨', 'Maximal 10 Farben pro Wetter!');
                              }
                            }
                            playAppSound('click');
                          }}
                          className={`p-1 rounded flex flex-col items-center gap-1 transition-all border cursor-pointer ${
                            isSelected ? 'border-sky-400 bg-sky-500/15' : 'border-neutral-800 bg-neutral-950/40 hover:bg-neutral-900'
                          }`}
                          title={preset.name}
                        >
                          <div className="w-4.5 h-4.5 rounded" style={{ backgroundColor: preset.hex }} />
                          <span className="text-[7px] font-black truncate max-w-full text-neutral-400">{preset.name}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* HTML Color Picker for Any custom Color */}
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-neutral-850/40 justify-between">
                    <span className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Eigene RGB-Farbe hinzufügen:</span>
                    <div className="flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded border border-neutral-850">
                      <input 
                        type="color" 
                        defaultValue="#ff00ea"
                        onChange={(e) => {
                          const val = e.target.value;
                          if (!uploadWeatherColors.includes(val)) {
                            if (uploadWeatherColors.length < 10) {
                              setUploadWeatherColors(prev => [...prev, val]);
                              playAppSound('pop');
                            } else {
                              triggerToast('quest', 'LIMIT ERREICHT 🎨', 'Maximal 10 Farben pro Wetter!');
                            }
                          }
                        }}
                        className="w-4 h-4 bg-transparent border-0 cursor-pointer outline-none rounded p-0"
                      />
                      <span className="text-[8px] text-neutral-400 font-mono">Auswählen</span>
                    </div>
                  </div>
                </div>

                {/* Density (Particle Count) */}
                <div>
                  <div className="flex justify-between items-center mb-0.5">
                    <label className="text-[9px] font-black uppercase tracking-wider text-neutral-400">
                      Partikel-Anzahl (Menge): {uploadWeatherParticleCount}
                    </label>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={400}
                    step={10}
                    value={uploadWeatherParticleCount}
                    onChange={(e) => setUploadWeatherParticleCount(Number(e.target.value))}
                    className="w-full accent-sky-500 h-1 bg-neutral-850 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[6.5px] text-neutral-600 font-bold uppercase">
                    <span>Nieselsturm</span>
                    <span>Standard</span>
                    <span>Sintflut (Extrem)</span>
                  </div>
                </div>

                {/* Friction / Wind sway */}
                <div>
                  <div className="flex justify-between items-center mb-0.5">
                    <label className="text-[9px] font-black uppercase tracking-wider text-neutral-400">
                      Horizontale Windstärke (Sway): {uploadWeatherWindDrift > 0 ? `+${uploadWeatherWindDrift}` : uploadWeatherWindDrift}
                    </label>
                  </div>
                  <input
                    type="range"
                    min={-8}
                    max={8}
                    step={1}
                    value={uploadWeatherWindDrift}
                    onChange={(e) => setUploadWeatherWindDrift(Number(e.target.value))}
                    className="w-full accent-sky-500 h-1 bg-neutral-850 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[6.5px] text-neutral-600 font-bold uppercase">
                    <span>← Sturm links</span>
                    <span>Windstille</span>
                    <span>Sturm rechts →</span>
                  </div>
                </div>

                {/* Speed Multiplier / Gravity */}
                <div>
                  <div className="flex justify-between items-center mb-0.5">
                    <label className="text-[9px] font-black uppercase tracking-wider text-neutral-400">
                      Fall-Geschwindigkeit (Schwerkraft): {uploadWeatherGravityMult.toFixed(1)}x
                    </label>
                  </div>
                  <input
                    type="range"
                    min={-2.0}
                    max={3.0}
                    step={0.2}
                    value={uploadWeatherGravityMult}
                    onChange={(e) => setUploadWeatherGravityMult(Number(e.target.value))}
                    className="w-full accent-sky-500 h-1 bg-neutral-850 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[6.5px] text-neutral-600 font-bold uppercase">
                    <span>↑ Aufsteigen (-G)</span>
                    <span>Schweben</span>
                    <span>Kometensturz (Hyper) ↓</span>
                  </div>
                </div>

                {/* Advanced Options Grid */}
                <div className="space-y-4 p-3 bg-black/40 rounded-xl border border-neutral-850">
                  <h4 className="text-[9px] font-black uppercase tracking-wider text-sky-400 mb-2 border-b border-sky-950/40 pb-1 flex items-center justify-between">
                    <span>Erweiterte Effekte (Premium) ✨</span>
                    <span className="text-[7px] text-neutral-500 lowercase font-normal">Noch mehr Einstellmöglichkeiten</span>
                  </h4>

                  {/* Row 1: Glow / Neon Toggle */}
                  <div className="flex items-center justify-between py-1 border-b border-neutral-800/20">
                    <div>
                      <span className="block text-[9.5px] font-black uppercase tracking-wider text-neutral-200">
                        Neon Leuchten (Glow)
                      </span>
                      <span className="block text-[7.5px] text-neutral-500">
                        Partikel haben eine glühende Lichtaura
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setUploadWeatherGlow(prev => !prev);
                        playAppSound('click');
                      }}
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer flex items-center ${
                        uploadWeatherGlow ? 'bg-sky-500' : 'bg-neutral-800'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                        uploadWeatherGlow ? 'translate-x-4' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>

                  {/* Sway Wave Slider */}
                  <div>
                    <div className="flex justify-between items-center mb-0.5">
                      <label className="text-[9px] font-black uppercase tracking-wider text-neutral-300">
                        Wellen-Schwankung (Sway Wave): {uploadWeatherSwayAmplitude.toFixed(1)}x
                      </label>
                    </div>
                    <input
                      type="range"
                      min={0.0}
                      max={5.0}
                      step={0.2}
                      value={uploadWeatherSwayAmplitude}
                      onChange={(e) => setUploadWeatherSwayAmplitude(Number(e.target.value))}
                      className="w-full accent-sky-500 h-1 bg-neutral-850 rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[6.5px] text-neutral-600 font-bold uppercase">
                      <span>Kerzengerade</span>
                      <span>Physik-Standard</span>
                      <span>Starker Wirbelsturm</span>
                    </div>
                  </div>

                  {/* Trail / Streak trail Slider */}
                  <div>
                    <div className="flex justify-between items-center mb-0.5">
                      <label className="text-[9px] font-black uppercase tracking-wider text-neutral-300">
                        Streifen-Schweif (Motion Trail): {uploadWeatherTrailLength > 0 ? `${uploadWeatherTrailLength}px` : 'Aus'}
                      </label>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={8}
                      step={1}
                      value={uploadWeatherTrailLength}
                      onChange={(e) => setUploadWeatherTrailLength(Number(e.target.value))}
                      className="w-full accent-sky-500 h-1 bg-neutral-850 rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[6.5px] text-neutral-600 font-bold uppercase">
                      <span>Kein Schweif</span>
                      <span>Sternschnuppen-Stil</span>
                      <span>Hyperschall-Streifen</span>
                    </div>
                  </div>

                  {/* Splashes / Bodenripple Option */}
                  <div className="space-y-2 border-t border-b border-neutral-850/40 py-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="block text-[9.5px] font-black uppercase tracking-wider text-neutral-200">
                          Boden-Einschlag (Splashes)
                        </span>
                        <span className="block text-[7.5px] text-neutral-500">
                          Aufschlag-Wellenringe am Bildschirmrand am Boden
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setUploadWeatherEnableSplashes(prev => !prev);
                          playAppSound('click');
                        }}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer flex items-center ${
                          uploadWeatherEnableSplashes ? 'bg-sky-500' : 'bg-neutral-800'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                          uploadWeatherEnableSplashes ? 'translate-x-4' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>

                    {uploadWeatherEnableSplashes && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        className="overflow-hidden space-y-1.5 pl-2 border-l border-sky-950"
                      >
                        <div className="flex justify-between items-center">
                          <label className="text-[8px] font-black uppercase tracking-wider text-neutral-400">
                            Einschlag-Größe (Splash Scale): {uploadWeatherSplashSize.toFixed(1)}x
                          </label>
                        </div>
                        <input
                          type="range"
                          min={0.4}
                          max={3.0}
                          step={0.2}
                          value={uploadWeatherSplashSize}
                          onChange={(e) => setUploadWeatherSplashSize(Number(e.target.value))}
                          className="w-full accent-sky-500 h-1 bg-neutral-850 rounded-lg cursor-pointer"
                        />
                      </motion.div>
                    )}
                  </div>

                  {/* Lightning Gewitter Storm Option */}
                  <div className="space-y-2 border-b border-neutral-850/40 pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="block text-[9.5px] font-black uppercase tracking-wider text-neutral-200">
                          Sturmwetter Gewitter (Lightning Flashes)
                        </span>
                        <span className="block text-[7.5px] text-neutral-500">
                          Der Bildschirm leuchtet sporadisch wie bei Blitzeinschlägen auf
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setUploadWeatherEnableLightning(prev => !prev);
                          playAppSound('click');
                        }}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer flex items-center ${
                          uploadWeatherEnableLightning ? 'bg-sky-500' : 'bg-neutral-800'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                          uploadWeatherEnableLightning ? 'translate-x-4' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>

                    {uploadWeatherEnableLightning && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        className="overflow-hidden space-y-2.5 pl-2 border-l border-sky-950"
                      >
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-[8px] font-black uppercase tracking-wider text-neutral-400">
                              Blitz-Häufigkeit: {uploadWeatherLightningFrequency === 1 ? 'Selten' : uploadWeatherLightningFrequency === 3 ? 'Stürmisch' : uploadWeatherLightningFrequency === 5 ? 'Apo-Kollaps' : uploadWeatherLightningFrequency}
                            </label>
                          </div>
                          <input
                            type="range"
                            min={1}
                            max={5}
                            step={1}
                            value={uploadWeatherLightningFrequency}
                            onChange={(e) => setUploadWeatherLightningFrequency(Number(e.target.value))}
                            className="w-full accent-sky-500 h-1 bg-neutral-850 rounded-lg cursor-pointer"
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <label className="text-[8px] font-black uppercase tracking-wider text-neutral-400">
                            Blitz-Farbe (Atmosphäre):
                          </label>
                          <div className="flex items-center gap-1.5">
                            {[
                              { label: 'Weiß', hex: '#ffffff' },
                              { label: 'Blitz-Lila', hex: '#cb6eff' },
                              { label: 'Lava-Rot', hex: '#ff3700' },
                              { label: 'Ozean-Cyan', hex: '#00f7ff' }
                            ].map((preset) => (
                              <button
                                key={`lightning-${preset.hex}`}
                                type="button"
                                onClick={() => {
                                  setUploadWeatherLightningColor(preset.hex);
                                  playAppSound('pop');
                                }}
                                className={`w-4 h-4 rounded-full border transition-all ${
                                  uploadWeatherLightningColor === preset.hex ? 'border-sky-400 scale-120' : 'border-neutral-800 hover:border-neutral-700'
                                }`}
                                style={{ backgroundColor: preset.hex }}
                                title={preset.label}
                              />
                            ))}
                            <input
                              type="color"
                              value={uploadWeatherLightningColor}
                              onChange={(e) => setUploadWeatherLightningColor(e.target.value)}
                              className="w-4 h-4 bg-transparent cursor-pointer rounded p-0 border-0"
                              title="Benutzerdefinierte Blitzfarbe"
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* Climate Shade Background Overlay Tone */}
                  <div className="space-y-2">
                    <div>
                      <span className="block text-[9.5px] font-black uppercase tracking-wider text-neutral-200">
                        Atmosphären-Hintergrundschatten (Climate Tint)
                      </span>
                      <span className="block text-[7.5px] text-neutral-500">
                        Färbe den Hintergrund ein, um Nebel oder Dämmerung nachzustellen
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 items-center">
                      <div>
                        <div className="flex justify-between text-[7.5px] font-black text-neutral-400 uppercase tracking-widest mb-0.5">
                          <span>Schatten-Farbe</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-black/40 px-2 py-0.5 rounded border border-neutral-850">
                          <input 
                            type="color" 
                            value={uploadWeatherOverlayColor}
                            onChange={(e) => setUploadWeatherOverlayColor(e.target.value)}
                            className="w-4.5 h-4.5 bg-transparent border-0 cursor-pointer outline-none rounded p-0"
                          />
                          <span className="text-[7.5px] text-neutral-400 font-mono font-black">{uploadWeatherOverlayColor.toUpperCase()}</span>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[7.5px] font-black text-neutral-400 uppercase tracking-widest mb-0.5">
                          <span>Stärke: {Math.round(uploadWeatherOverlayOpacity * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min={0.0}
                          max={0.8}
                          step={0.05}
                          value={uploadWeatherOverlayOpacity}
                          onChange={(e) => setUploadWeatherOverlayOpacity(Number(e.target.value))}
                          className="w-full accent-sky-500 h-1 bg-neutral-850 rounded-lg cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. Speed & Scale row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-wider text-neutral-400 mb-1">
                      Geschwindigkeit (Basis)
                    </label>
                    <select
                      value={uploadWeatherSpeed}
                      onChange={(e) => setUploadWeatherSpeed(e.target.value as any)}
                      className="w-full bg-black/50 border border-neutral-850 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-400"
                    >
                      <option value="gentle">Sacht (Gentle)</option>
                      <option value="moderate">Normal (Moderate)</option>
                      <option value="tempest">Stürmisch (Tempest)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-wider text-neutral-400 mb-1">
                      Partikel-Größe (Basis)
                    </label>
                    <select
                      value={uploadWeatherScale}
                      onChange={(e) => setUploadWeatherScale(e.target.value as any)}
                      className="w-full bg-black/50 border border-neutral-850 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-400"
                    >
                      <option value="fine">Fein (Fine)</option>
                      <option value="medium">Mittel (Medium)</option>
                      <option value="chunk">Groß (Chunk)</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={isUploadingWeather}
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-black font-extrabold uppercase text-xs tracking-wider border-b-4 border-sky-700 shadow-md flex items-center justify-center gap-2 disabled:opacity-55 cursor-pointer"
                  >
                    {isUploadingWeather ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        Erschaffen...
                      </>
                    ) : (
                      <>
                        Wetter online bringen ✨
                      </>
                    )}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mining Modal */}
      <AnimatePresence>
        {showMiningModal && (
          <motion.div
            key="mining-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex items-center justify-center p-0 sm:p-6 bg-black/95 backdrop-blur-3xl overflow-hidden"
          >
            {/* Mining Background Glow */}
            <div className="absolute inset-0 z-0">
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-mc-gold/5 blur-[150px] animate-pulse" />
               <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black to-transparent" />
            </div>

            {/* Particle Layer */}
            {miningParticles.map((p, i) => (
              <div 
                key={`mining-p-${p.id}-${i}`}
                className="absolute w-2 h-2 rounded-sm z-[200] pointer-events-none shadow-sm"
                style={{ 
                  left: p.x, 
                  top: p.y, 
                  backgroundColor: p.color,
                  boxShadow: `0 0 10px ${p.color}`
                }}
              />
            ))}

            {/* Pickaxe Tool Visual (Follows Cursor) */}
            <PickaxeTool active={pickaxeSwing} pickaxeName={myProfile?.inventory?.pickaxeName} />

            <motion.div
              initial={{ scale: 0.9, y: 50 }}
              animate={{ 
                scale: 1, 
                y: 0,
                x: (Math.random() - 0.5) * miningShake,
                rotate: (Math.random() - 0.5) * (miningShake / 2)
              }}
              exit={{ scale: 0.9, y: 50 }}
              className="max-w-5xl w-full h-full sm:h-[85vh] bg-neutral-900/40 border border-white/5 rounded-none sm:rounded-[3rem] overflow-hidden flex flex-col relative z-10 shadow-[0_0_100px_rgba(0,0,0,1)]"
            >
              {/* Explosion Overlay */}
              <AnimatePresence>
                {miningShake > 10 && (
                   <motion.div 
                     key="explosion-kaboom-overlay"
                     initial={{ opacity: 0 }}
                     animate={{ opacity: 1 }}
                     exit={{ opacity: 0 }}
                     className="absolute inset-0 z-[300] bg-white flex items-center justify-center font-black text-6xl text-black italic italic tracking-tighter"
                   >
                     KABOOM!
                   </motion.div>
                )}
              </AnimatePresence>
              {/* Header */}
              <div className="p-8 border-b border-white/5 flex items-center justify-between bg-black/40 backdrop-blur-md relative overflow-hidden">
                {/* Fever Bar Background */}
                <motion.div 
                  className="absolute bottom-0 left-0 h-1 bg-mc-gold shadow-[0_0_20px_rgba(255,170,0,1)]"
                  initial={{ width: '0%' }}
                  animate={{ width: `${(miningCombo % 5) * 20}%` }}
                />
                
                <div className="flex items-center gap-6">
                  <div className="p-4 bg-mc-gold rounded-2xl text-black shadow-[0_10px_30px_rgba(255,170,0,0.3)]">
                    <Pickaxe size={36} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-3xl font-black text-white italic tracking-tighter leading-none mb-1">DEEP MINES</h3>
                      <AnimatePresence>
                        {miningCombo > 2 && (
                          <motion.span 
                            key={`combo-badge-${miningCombo}`}
                            initial={{ scale: 0, rotate: -20 }}
                            animate={{ scale: 1, rotate: 0 }}
                            exit={{ scale: 0 }}
                            className="bg-mc-red text-white text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-tighter"
                          >
                            {miningCombo} COMBO!
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] bg-mc-gold/20 text-mc-gold px-2 py-0.5 rounded-full font-black border border-mc-gold/20">LEVEL {Math.floor((optimisticXp !== null ? optimisticXp : (myProfile?.xp || 0)) / 5000) + 1}</span>
                      <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-[0.2em]">Mult: {miningMultiplier}x {myProfile?.inventory?.xpMultiplier && `(+50% Bonus)`}</p>
                      {myProfile?.inventory?.luck && (
                        <span className="text-[10px] text-mc-gold animate-pulse">LUCK +{myProfile?.inventory?.luck}%</span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="hidden md:flex gap-10">
                   <div className="text-right">
                      <p className="text-[10px] text-neutral-500 font-bold uppercase mb-1">Tool ausgerüstet</p>
                      <p className="text-sm font-black text-white italic capitalize">{myProfile?.inventory?.pickaxeName || 'Holzspitzhacke'}</p>
                   </div>
                    <div className="text-right">
                       <p className="text-[10px] text-mc-gold font-bold uppercase mb-1">Deine Coins</p>
                       <p className="text-xl font-black text-mc-gold italic">
                         {optimisticCoins !== null ? optimisticCoins.toLocaleString() : (myProfile?.coins?.toLocaleString() || 0)} 🪙
                       </p>
                    </div>
                    <div className="text-right">
                       <p className="text-[10px] text-mc-gold font-bold uppercase mb-1">Diamanten</p>
                       <p className="text-xl font-black text-mc-gold italic">{miningStats.diamondsFound}</p>
                    </div>
                </div>

                <button 
                  onClick={() => setShowMiningModal(false)}
                  className="p-4 hover:bg-white/5 rounded-2xl transition-all text-neutral-500 hover:text-white group"
                >
                  <X size={28} className="group-hover:rotate-90 transition-transform" />
                </button>
              </div>

              {/* Game Mode Tab Selector */}
              <div className="flex bg-neutral-950 border-b border-white/5 p-2 gap-2 relative z-[20]">
                <button
                  onClick={() => setMiningTab('mines')}
                  className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all rounded-xl border flex items-center justify-center gap-2 ${
                    miningTab === 'mines'
                      ? 'bg-mc-gold/25 border-mc-gold text-mc-gold shadow-[0_0_20px_rgba(255,170,0,0.2)] font-black'
                      : 'bg-transparent border-transparent text-neutral-400 hover:text-white hover:bg-white/5 font-bold'
                  }`}
                >
                  <Pickaxe size={16} />
                  Deep Mines Clicker
                </button>
                <button
                  onClick={() => setMiningTab('world')}
                  className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all rounded-xl border flex items-center justify-center gap-2 ${
                    miningTab === 'world'
                      ? 'bg-mc-gold/25 border-mc-gold text-mc-gold shadow-[0_0_20px_rgba(255,170,0,0.2)] font-black'
                      : 'bg-transparent border-transparent text-neutral-400 hover:text-white hover:bg-white/5 font-bold'
                  }`}
                >
                  <Gamepad2 size={16} />
                  2D Open World (spiel2) 🎮
                </button>
                <button
                  onClick={() => setMiningTab('quiz')}
                  className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all rounded-xl border flex items-center justify-center gap-2 relative ${
                    miningTab === 'quiz'
                      ? 'bg-mc-gold/25 border-mc-gold text-mc-gold shadow-[0_0_20px_rgba(255,170,0,0.2)] font-black'
                      : 'bg-transparent border-transparent text-neutral-400 hover:text-white hover:bg-white/5 font-bold'
                  }`}
                >
                  <Sparkles size={16} />
                  Quiz Arena
                  {activeQuiz?.active && (
                    <span className="absolute top-1.5 right-3 w-2.5 h-2.5 rounded-full bg-mc-gold animate-ping border border-black" />
                  )}
                </button>
                <button
                  onClick={() => setShowClashComingSoon(true)}
                  className="flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all rounded-xl border flex items-center justify-center gap-2 bg-transparent border-transparent text-neutral-400 hover:text-white hover:bg-white/5 font-bold"
                >
                  <Crown size={16} />
                  Clash Royale 👑
                </button>
              </div>

              {/* Conditionally render game or quiz */}
              {miningTab === 'mines' ? (
                <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden bg-[#1a1a1a] relative custom-scrollbar">
                <div 
                  className="absolute inset-0 z-0 pointer-events-none opacity-20"
                  style={{ 
                    backgroundImage: `url('https://www.transparenttextures.com/patterns/dark-matter.png')`,
                    transform: `translate(${miningShake}px, ${miningShake}px)`
                  }}
                />

                {/* Floating Reward Labels (One place only) */}
                <AnimatePresence>
                  {floatingRewards.map((reward, i) => (
                    <motion.div
                      key={`floating-reward-${reward.id || `reward-${i}`}-${i}`}
                      initial={{ opacity: 1, y: reward.y, scale: 0.5 }}
                      animate={{ opacity: 0, y: reward.y - 150, scale: 2 }}
                      exit={{ opacity: 0 }}
                      style={{ left: reward.x, position: 'fixed', zIndex: 1000 }}
                      className="pointer-events-none"
                    >
                      <span className="font-black text-2xl drop-shadow-mc-thick italic" style={{ color: reward.color }}>
                        {reward.text}
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
                
                {/* Left Column: The Clicker Area */}
                <div className="w-full md:w-1/2 h-auto min-h-[300px] md:h-full flex flex-col items-center justify-center p-4 md:p-6 sm:border-r border-white/5 relative z-10 select-none touch-pan-y">
                  <div className="mb-4 md:mb-8 text-center space-y-1 scale-90 md:scale-100 pointer-events-none">
                     <h2 className="text-white font-black text-2xl md:text-3xl tracking-[0.3em] uppercase drop-shadow-mc">Mining Clicker</h2>
                     <div className="flex flex-col items-center gap-1">
                       <p className="text-mc-gold font-bold italic text-sm">CPS (Münzen/s): {coinsPerSecond} Coins/s</p>
                       <p className="text-[#fbbf24] font-bold italic text-xs">CPC (Münzen/Klick): {myProfile?.mining?.coinsPerClick || 1} Coins/Klick</p>
                     </div>
                  </div>

                  {/* Center Game Area */}
                  <div className="flex-1 flex flex-col items-center justify-center relative w-full overflow-visible touch-pan-y">
                    <div className="absolute inset-0 pointer-events-none z-0">
                      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[400px] md:h-[600px] w-full opacity-5 blur-[80px] bg-mc-gold rounded-full" />
                    </div>

                    <AnimatePresence mode="wait">
                      <motion.div
                        key={`${miningBlock.type}-${miningBlock.id}`}
                        initial={{ scale: 0.3, rotate: -30, opacity: 0, y: 50 }}
                        animate={{ scale: 0.8, rotate: 0, opacity: 1, y: 0 }} 
                        whileInView={{ scale: window.innerWidth < 768 ? 0.7 : 1 }}
                        exit={{ scale: 1.1, opacity: 0 }}
                        transition={{ type: 'spring', damping: 15, stiffness: 100 }}
                        className="relative z-50 w-48 h-48 sm:w-72 sm:h-72 group cursor-pointer touch-pan-y"
                        onClick={mineBlock}
                        style={{ touchAction: 'pan-y' }}
                      >
                        {/* Health Bar */}
                        <div className="absolute -top-12 md:-top-16 left-1/2 -translate-x-1/2 w-48 md:w-64 text-center space-y-2 md:space-y-3 pointer-events-none">
                          <p className="text-white font-black text-sm md:text-xl uppercase tracking-[0.4em] drop-shadow-mc-thick shrink-0">
                            {miningBlock.type}
                          </p>
                          <div className="h-4 w-full bg-black/80 rounded-full p-1 border border-white/10 relative overflow-hidden">
                            <motion.div 
                              initial={{ width: '100%' }}
                              animate={{ width: `${(miningBlock.health / miningBlock.maxHealth) * 100}%` }}
                              className={`h-full rounded-full transition-all duration-300 ${
                                miningBlock.type === 'Diamond' ? 'bg-blue-500' :
                                miningBlock.type === 'Emerald' ? 'bg-emerald-500' :
                                miningBlock.type === 'Gold' ? 'bg-mc-gold' :
                                miningBlock.type === 'TNT' ? 'bg-red-600 animate-pulse' :
                                'bg-neutral-500'
                              }`}
                            />
                          </div>
                        </div>

                        <div className="w-full h-full perspective-1000">
                          <motion.div
                            animate={{ scale: hitFeedback ? [1, 0.95, 1.05, 1] : 1 }}
                            onClick={mineBlock}
                            className="w-full h-full relative cursor-mine group-hover:brightness-110 active:brightness-125 transition-all"
                          >
                            <div className={`absolute inset-0 rounded-2xl border-4 border-white/10 shadow-2xl overflow-hidden z-10 ${
                               miningBlock.type === 'Diamond' ? 'bg-[#3b82f6]' :
                               miningBlock.type === 'Gold' ? 'bg-mc-gold' :
                               miningBlock.type === 'Iron' ? 'bg-[#94a3b8]' :
                               miningBlock.type === 'Coal' ? 'bg-[#262626]' : 
                               miningBlock.type === 'Emerald' ? 'bg-[#10b981]' :
                               miningBlock.type === 'TNT' ? 'bg-red-600' :
                               miningBlock.type === 'Chest' ? 'bg-[#92400e]' :
                               'bg-neutral-600'
                            }`}>
                              <div className="absolute inset-0 border-t-8 border-l-8 border-white/10" />
                              <div className="absolute inset-0 border-b-8 border-r-8 border-black/30" />

                              {miningBlock.type !== 'Stone' && miningBlock.type !== 'TNT' && miningBlock.type !== 'Chest' && (
                                <div className="absolute inset-0 p-8 grid grid-cols-4 grid-rows-4 gap-4">
                                  {[...Array(16)].map((_, i) => 
                                    i % 3 === 0 ? (
                                      <div key={`mining-grid-bg-${i}`} className={`rounded-xl ${
                                        miningBlock.type === 'Diamond' ? 'bg-blue-300' :
                                        miningBlock.type === 'Gold' ? 'bg-mc-amber' :
                                        miningBlock.type === 'Emerald' ? 'bg-emerald-300' :
                                        miningBlock.type === 'Iron' ? 'bg-slate-100' : 'bg-black'
                                      }`} />
                                    ) : null
                                  )}
                                </div>
                              )}
                              
                              {miningBlock.type === 'Chest' && <div className="absolute inset-0 flex items-center justify-center"><Package size={80} className="text-mc-gold drop-shadow-mc" /></div>}
                              {miningBlock.type === 'TNT' && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-600">
                                  <span className="text-white font-black text-5xl tracking-tighter drop-shadow-mc-thick">TNT</span>
                                </div>
                              )}

                              <div className="absolute inset-0 z-20 p-8 opacity-40">
                                <svg className="w-full h-full text-black" viewBox="0 0 100 100">
                                  <motion.path 
                                    animate={{ pathLength: 1 - miningBlock.health / miningBlock.maxHealth }}
                                    d="M0,0 L20,30 L0,70 M40,20 L60,40 L100,0 M20,100 L50,80 L80,100" 
                                    fill="none" stroke="currentColor" strokeWidth={10} 
                                  />
                                </svg>
                              </div>
                            </div>
                            <div className="absolute inset-0 translate-y-4 translate-x-2 bg-black/40 rounded-2xl -z-10" />
                          </motion.div>
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>

                {/* Right Column: The Shop */}
                <div className="w-full md:w-1/2 min-h-[400px] md:min-h-0 h-auto md:h-full flex flex-col bg-black/30 backdrop-blur-md md:border-l border-t md:border-t-0 border-white/5 md:overflow-hidden relative flex-shrink-0">
                  <div className="flex-shrink-0 bg-[#1a1a1a]/80 backdrop-blur-sm z-50 p-4 md:p-6 pb-2 border-b border-white/5">
                    <h3 className="text-mc-gold font-black text-lg md:text-xl flex items-center gap-2 drop-shadow-mc">
                      <ShoppingBag size={24} /> UPGRADES & MINERS
                    </h3>
                  </div>

                  <div className="flex-1 md:overflow-y-auto p-3 sm:p-6 space-y-3 custom-scrollbar touch-pan-y overscroll-contain relative scroll-smooth h-auto md:h-full min-h-[200px]">
                    {[
                      { id: 'miner_1', name: 'Holz-Mitarbeiter', price: 150, cps: 1, icon: Pickaxe, desc: 'Ein einfacher Helfer für den Start.', type: 'miner' },
                      { id: 'miner_2', name: 'Eisen-Bergmann', price: 1000, cps: 8, icon: UserIcon, desc: 'Ausgebildeter Facharbeiter.', type: 'miner' },
                      { id: 'miner_3', name: 'Mining-Team', price: 6000, cps: 55, icon: Users, desc: 'Ein ganzer Trupp Profis im Einsatz.', type: 'miner' },
                      { id: 'click_1', name: 'Goldmünze', price: 500, cpc: 2, icon: Gem, desc: 'Zusätzliche Münzen pro Klick.', type: 'click' },
                      { id: 'click_2', name: 'Schatzbeutel', price: 3000, cpc: 8, icon: Package, desc: 'Viel mehr Münzen pro Klick.', type: 'click' },
                      { id: 'click_3', name: 'Ender-Schatz', price: 15000, cpc: 25, icon: Castle, desc: 'Göttliche Ausbeute bei jedem Schlag.', type: 'click' },
                      { id: 'power_1', name: 'Scharfe Kante', price: 400, power: 1, icon: Zap, desc: '+1 Schaden pro Klick.', type: 'power' },
                      { id: 'power_2', name: 'Wuchtiger Schlag', price: 2500, power: 6, icon: Hammer, desc: '+6 Schaden pro Klick.', type: 'power' },
                      { id: 'power_3', name: 'Nether-Effizienz', price: 8000, power: 20, icon: Flame, desc: '+20 Schaden pro Klick.', type: 'power' },
                      { id: 'miner_4', name: 'Diamant-Bohrer', price: 25000, cps: 250, icon: Settings, desc: 'Industrielle Bohrleistung.', type: 'miner' },
                      { id: 'miner_5', name: 'Laser-Extraktor', price: 100000, cps: 1200, icon: Target, desc: 'Schmilzt Gestein in Sekunden.', type: 'miner' },
                      { id: 'click_4', name: 'Königlicher Segen', price: 50000, cpc: 100, icon: Trophy, desc: 'Jeder Klick ist ein Vermögen wert.', type: 'click' },
                      { id: 'power_4', name: 'Weltenspalter', price: 40000, power: 85, icon: Swords, desc: 'Kein Block hält diesem Schlag stand.', type: 'power' },
                    ].map((item) => {
                      const currentCoins = optimisticCoins !== null ? optimisticCoins : (myProfile?.coins || 0);
                      const canAfford = currentCoins >= item.price;
                      const typeColor = item.type === 'miner' ? 'text-blue-400' : item.type === 'click' ? 'text-yellow-400' : 'text-mc-red';
                      const typeBg = item.type === 'miner' ? 'bg-blue-400/10' : item.type === 'click' ? 'bg-yellow-400/10' : 'bg-mc-red/10';

                      return (
                        <motion.button
                          key={item.id}
                          whileHover={canAfford ? { scale: 1.02, x: 5, backgroundColor: 'rgba(255,255,255,0.05)' } : {}}
                          whileTap={canAfford ? { scale: 0.98 } : {}}
                          onClick={async () => {
                             if (!canAfford || !user) return;
                             
                             const coinsToSync = pendingCpsCoinsRef.current + pendingCoinUpdateRef.current;
                             const xpToSync = pendingCpsXpRef.current;

                             // Clear local pending accumulators simultaneously to prevent double increments/race conditions
                             pendingCpsCoinsRef.current = 0;
                             pendingCoinUpdateRef.current = 0;
                             pendingCpsXpRef.current = 0;

                             // Estimate new balance optimistically
                             const currentDbCoins = myProfile?.coins || 0;
                             const currentDbXp = myProfile?.xp || 0;
                             const nextCoins = currentDbCoins + coinsToSync - item.price;
                             const nextXp = currentDbXp + xpToSync;

                             setOptimisticCoins(nextCoins);
                             setOptimisticXp(nextXp);

                             const updates: any = { 
                               coins: increment(-item.price + coinsToSync),
                               xp: increment(xpToSync)
                             };
                             if ('cps' in item) {
                               updates['mining.cps'] = increment(item.cps || 0);
                             }
                             if ('cpc' in item) {
                               updates['mining.coinsPerClick'] = increment(item.cpc || 0);
                             }
                             if ('power' in item) {
                               updates['inventory.pickaxePower'] = increment(item.power || 0);
                             }

                             try {
                               await updateDoc(doc(db, 'user_profiles', user.uid), updates);
                               
                               // Feedback
                               setFloatingRewards(prev => [...prev, {
                                 id: Math.random(),
                                 text: `GEKAUFT: ${item.name}`,
                                 x: window.innerWidth / 2,
                                 y: window.innerHeight / 2,
                                 color: '#22c55e'
                               }].slice(-10));
                             } catch (err) {
                               console.error("Purchase failed:", err);
                               // Revert to database state on failure
                               setOptimisticCoins(null);
                               setOptimisticXp(null);
                             }
                          }}
                          className={`w-full p-4 rounded-2xl border flex items-center gap-4 text-left transition-all ${
                            canAfford 
                              ? 'bg-neutral-800/40 border-white/10 hover:border-mc-gold/50 cursor-pointer' 
                              : 'bg-neutral-900 shadow-inner border-transparent relative opacity-60'
                          }`}
                        >
                          {!canAfford && (
                            <div className="absolute inset-0 z-20 flex items-center justify-end pr-8 pointer-events-none opacity-20">
                              <Lock size={40} className="text-neutral-500" />
                            </div>
                          )}
                          <div className={`p-3 rounded-xl flex-shrink-0 ${canAfford ? `${typeBg} ${typeColor} shadow-lg shadow-black/40` : 'bg-neutral-700 text-neutral-500'}`}>
                            <item.icon size={28} />
                          </div>
                          <div className="flex-1 overflow-hidden relative z-10">
                            <div className="flex justify-between items-center gap-2">
                              <span className={`font-black truncate text-sm transition-colors ${canAfford ? 'text-white' : 'text-neutral-500'}`}>{item.name}</span>
                              <span className={`font-black text-xs whitespace-nowrap ${canAfford ? 'text-mc-gold' : 'text-neutral-600'}`}>{item.price.toLocaleString()} 🪙</span>
                            </div>
                            <p className={`text-[10px] truncate ${canAfford ? 'text-neutral-400' : 'text-neutral-600'}`}>{item.desc}</p>
                            <div className="mt-1.5 flex items-center gap-2">
                               <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${canAfford ? `${typeBg} ${typeColor} border-${item.type === 'miner' ? 'blue' : item.type === 'click' ? 'yellow' : 'red'}-400/20` : 'bg-neutral-800 text-neutral-600 border-transparent'}`}>
                                 {'cps' in item ? `+${item.cps} CPS` : 'cpc' in item ? `+${item.cpc} CPC` : `+${item.power} KRAFT`}
                               </span>
                               <span className="text-[8px] text-neutral-500 font-bold uppercase tracking-widest">{item.type}</span>
                            </div>
                          </div>
                        </motion.button>
                      );
                    })}
                    <div className="pb-40 pt-10 text-center">
                      <p className="text-[10px] text-neutral-600 font-bold uppercase tracking-[0.3em]">Ende der Liste</p>
                    </div>
                  </div>
                </div>
              </div>
              ) : miningTab === 'world' ? (
                <VoxelAdventureView 
                  user={user}
                  myProfile={myProfile}
                  db={db}
                  onClose={() => setShowMiningModal(false)}
                  triggerToast={triggerToast}
                  userProfiles={userProfiles}
                />
              ) : miningTab === 'clash' ? (
                <ClashArenaView 
                  user={user}
                  myProfile={myProfile}
                  onClose={() => setShowMiningModal(false)}
                />
              ) : (
                <div className="flex-1 overflow-y-auto bg-[#131313] relative custom-scrollbar p-6">
                  <QuizArenaView 
                    activeQuiz={activeQuiz}
                    myProfile={myProfile}
                    user={user}
                    db={db}
                    onRequestNewQuestion={generateNewQuizQuestionLocally}
                  />
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {openingBox.isOpen && (
          <motion.div
            key="case-opening-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl"
          >
            <div className="max-w-md w-full relative">
              <motion.div
                initial={{ scale: 0.5, y: 100 }}
                animate={{ scale: 1, y: 0 }}
                className="text-center space-y-8"
              >
                <div className="space-y-2">
                  <h2 className="text-3xl font-black text-white italic tracking-tighter">CASE OPENING</h2>
                  <p className="text-mc-gold font-bold uppercase tracking-[0.3em] text-[10px] animate-pulse">
                    Klicke 3 Mal zum Öffnen! ({openingBox.clicks}/3)
                  </p>
                </div>

                <div className="relative group perspective-1000">
                  <motion.div
                    animate={{ 
                      rotateY: openingBox.clicks * 360,
                      x: openingBox.clicks > 0 ? [0, -5, 5, -5, 5, 0] : 0,
                      scale: 1 + (openingBox.clicks * 0.1),
                      filter: openingBox.clicks > 0 ? `brightness(${1 + (openingBox.clicks * 0.3)})` : 'none',
                      boxShadow: openingBox.rarity === 'LEGENDÄR' ? '0 0 150px rgba(255,170,0,0.8)' : 
                                 openingBox.rarity === 'EPIK' ? '0 0 120px rgba(168,85,247,0.8)' :
                                 openingBox.rarity === 'Selten' ? '0 0 100px rgba(59,130,246,0.8)' : '0 0 60px rgba(255,255,255,0.3)'
                    }}
                    onClick={handleBoxClick}
                    className="w-64 h-64 mx-auto cursor-pointer relative group/chest select-none active:scale-90 transition-transform"
                  >
                    {/* Floating Numbers on Tap */}
                    <AnimatePresence>
                      {openingBox.clicks > 0 && (
                        <motion.div
                          key={openingBox.clicks}
                          initial={{ opacity: 1, y: 0, scale: 1 }}
                          animate={{ opacity: 0, y: -100, scale: 2 }}
                          className="absolute inset-0 flex items-center justify-center pointer-events-none z-[100]"
                        >
                           <span className="text-4xl font-black text-white italic drop-shadow-mc-thick">TAP!</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    {/* Minecraft-Style Chest Visual */}
                    <div className="absolute inset-0 flex flex-col">
                      {/* Chest Lid */}
                      <motion.div 
                        animate={{ 
                          rotateX: openingBox.clicks === 1 ? -15 : openingBox.clicks === 2 ? -35 : openingBox.clicks === 3 ? -90 : 0 
                        }}
                        style={{ originY: 'bottom' }}
                        className={`h-2/5 w-full rounded-t-xl border-4 border-black/40 relative z-20 transition-colors duration-500 ${
                          openingBox.rarity === 'LEGENDÄR' ? 'bg-gradient-to-b from-mc-gold to-[#cc8800]' : 
                          openingBox.rarity === 'EPIK' ? 'bg-gradient-to-b from-purple-500 to-purple-800' :
                          openingBox.rarity === 'Selten' ? 'bg-gradient-to-b from-blue-500 to-blue-800' : 
                          'bg-gradient-to-b from-[#8d6e63] to-[#5d4037]'
                        }`}
                      >
                        {/* Highlights on Lid */}
                        <div className="absolute inset-1 border border-white/20 rounded-t-lg" />
                        <div className="absolute top-2 left-2 w-2 h-2 bg-white/20 rounded-full" />
                      </motion.div>

                      {/* Chest Body */}
                      <div className={`h-3/5 w-full rounded-b-xl border-4 border-t-0 border-black/40 relative z-10 transition-colors duration-500 ${
                          openingBox.rarity === 'LEGENDÄR' ? 'bg-gradient-to-b from-[#cc8800] to-[#996600]' : 
                          openingBox.rarity === 'EPIK' ? 'bg-gradient-to-b from-purple-800 to-purple-950' :
                          openingBox.rarity === 'Selten' ? 'bg-gradient-to-b from-blue-800 to-blue-950' : 
                          'bg-gradient-to-b from-[#5d4037] to-[#3e2723]'
                        }`}
                      >
                         {/* The Lock */}
                         <motion.div 
                          animate={{ 
                            y: openingBox.clicks > 0 ? -5 : 0,
                            scale: openingBox.clicks > 0 ? 1.2 : 1
                          }}
                          className="absolute -top-3 left-1/2 -translate-x-1/2 w-8 h-10 bg-[#e0e0e0] border-2 border-neutral-400 rounded-sm shadow-xl flex items-center justify-center z-30"
                         >
                           <div className="w-1 h-3 bg-neutral-600 rounded-full" />
                         </motion.div>
                         
                         {/* Inner Glow when clicking */}
                         {openingBox.clicks > 0 && (
                            <div className={`absolute inset-0 opacity-40 animate-pulse ${
                              openingBox.rarity === 'LEGENDÄR' ? 'bg-yellow-400' : 
                              openingBox.rarity === 'EPIK' ? 'bg-purple-400' :
                              openingBox.rarity === 'Selten' ? 'bg-blue-400' : 'bg-white'
                            }`} />
                         )}
                      </div>
                    </div>

                    {/* Particle Effects (simplified with glows) */}
                    {openingBox.clicks >= 2 && (
                       <div className="absolute -inset-10 pointer-events-none">
                         <div className={`absolute inset-0 blur-3xl opacity-30 animate-ping ${
                            openingBox.rarity === 'LEGENDÄR' ? 'bg-mc-gold' : 
                            openingBox.rarity === 'EPIK' ? 'bg-purple-500' :
                            'bg-blue-500'
                         }`} />
                       </div>
                    )}
                  </motion.div>

                  {/* Rarity Label Overlay */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={openingBox.rarity}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="mt-8"
                    >
                      <span className={`px-6 py-2 rounded-full font-black text-xs uppercase tracking-widest shadow-2xl border-2 ${
                        openingBox.rarity === 'LEGENDÄR' ? 'bg-mc-gold text-black border-yellow-400' :
                        openingBox.rarity === 'EPIK' ? 'bg-purple-600 text-white border-purple-400' :
                        openingBox.rarity === 'Selten' ? 'bg-blue-600 text-white border-blue-400' :
                        'bg-neutral-800 text-neutral-400 border-neutral-700'
                      }`}>
                        {openingBox.rarity}
                      </span>
                    </motion.div>
                  </AnimatePresence>
                </div>

                <div className="flex gap-1 justify-center">
                  {[1, 2, 3].map(i => (
                    <div 
                      key={i} 
                      className={`h-1.5 rounded-full transition-all duration-500 ${
                        openingBox.clicks >= i ? 'w-8 bg-mc-gold' : 'w-2 bg-neutral-800'
                      }`} 
                    />
                  ))}
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Broadcast Banner */}
      <AnimatePresence>
        {broadcastMessage && !isAnyOverlayOpen && (
          <motion.div 
            key="global-broadcast-banner"
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="fixed top-20 left-0 right-0 z-[90] flex justify-center px-4 pointer-events-none"
          >
            <div className="bg-mc-gold text-black px-6 py-2 rounded-b-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl flex items-center gap-3 border-x border-b border-white/20 pointer-events-auto">
              <Zap size={14} className="animate-bounce" />
              {broadcastMessage}
              <Zap size={14} className="animate-bounce" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <nav className={`relative z-10 border-b border-neutral-800/50 bg-black/50 backdrop-blur-sm sticky top-0 transition-all duration-500 ${isAnyOverlayOpen ? '-translate-y-full opacity-0' : 'translate-y-0 opacity-100'}`}>
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center select-none">
              <div 
                className={`w-9 h-9 rounded-lg flex items-center justify-center relative overflow-hidden cursor-pointer transition-all duration-300 ${isPostGlitching ? 'bg-red-700 animate-pulse shadow-[0_0_20px_#f00]' : 'bg-mc-red'}`}
                onClick={handleLogoClick}
              >
                <div className="absolute inset-0 bg-white/10 animate-pulse pointer-events-none" />
                <Gamepad2 className={`text-white relative z-10 pointer-events-none ${isPostGlitching ? 'text-black scale-125' : ''}`} size={20} />
              </div>
              <span className="text-[7px] text-neutral-500 font-bold uppercase tracking-wider mt-0.5 pointer-events-none whitespace-nowrap">6 mal drücken</span>
            </div>
            <span className={`font-extrabold text-xl hidden sm:block select-none cursor-pointer transition-all duration-300 ${isPostGlitching ? 'text-mc-red animate-[chromatic-text_0.15s_infinite] tracking-wider font-mono' : 'tracking-tight font-sans'}`} onClick={handleLogoClick}>
              {isPostGlitching ? "H̷E̵R̶O̷B̷R̶I̴N̵E̶" : "MC HUB"}
            </span>
          </div>
          <div className="flex items-center gap-4">
            {!user ? (
              <button 
                onClick={() => setShowLoginModal(true)}
                className="mc-button mc-button-primary py-2 text-sm shadow-lg shadow-mc-red/20"
              >
                <LogIn size={18} />
                Anmelden
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => openProfileEdit()}
                  className="mc-button mc-button-secondary py-2 text-sm hidden sm:flex border-mc-gold/20"
                >
                  <UserIcon size={18} className="text-mc-gold" />
                  Mein Profil
                </button>
                {isAdmin && (
                  <button 
                    onClick={() => setShowAdmin(!showAdmin)}
                    className={`p-2 rounded-lg transition-colors ${showAdmin ? 'bg-mc-red/20 text-mc-red' : 'bg-neutral-800 text-neutral-400'}`}
                    title="Simulation Panel"
                  >
                    <ShieldCheck size={20} />
                  </button>
                )}
                <button 
                  onClick={logout}
                  className="mc-button border-red-500/20 text-red-400 hover:bg-red-500/10 p-2 rounded-lg"
                  title="Abmelden"
                >
                  <LogOut size={20} />
                </button>
              </div>
            )}
            <a 
              href={DISCORD_URL} 
              target="_blank" 
              rel="noreferrer"
              className="mc-button mc-button-secondary py-2 text-sm hidden md:flex"
            >
              <MessageCircle size={18} />
              Discord
            </a>
            {user && (
              <button 
                onClick={() => document.getElementById('clans')?.scrollIntoView({ behavior: 'smooth' })}
                className="mc-button mc-button-secondary py-2 text-sm hidden lg:flex border-mc-gold/20"
              >
                <Users size={18} className="text-mc-gold" />
                Clans
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Simulation/Admin Panel */}
      <AnimatePresence>
        {showAdmin && isAdmin && (
          <motion.div
            key="admin-simulation-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="relative z-10 bg-neutral-900 border-b border-neutral-800 max-h-[85vh] overflow-y-auto custom-scrollbar"
          >
            <div className="max-w-[1600px] mx-auto px-6 py-10 flex flex-col gap-8">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-mc-gold font-bold flex items-center gap-2">
                    <ShieldCheck size={18} />
                    ADMIN CONTROL CENTER
                  </h4>
                  <p className="text-neutral-500 text-xs">Diese Sektion ist nur für dich sichtbar.</p>
                </div>
                <button onClick={() => setShowAdmin(false)} className="text-neutral-500 hover:text-white">
                  <LogOut size={16} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {/* Root Control for Block5 & Owners */}
                {(isSuperAdmin || isOwner || isAdmin) && (
                  <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-6 space-y-4">
                    <span className="text-[10px] uppercase font-bold text-purple-400 tracking-widest flex items-center gap-2">
                       <Zap size={14} /> Root Control (Teamleitung)
                    </span>
                    <div className="space-y-3">
                      <button 
                        onClick={() => {
                          if (user) {
                            updateDoc(doc(db, 'user_profiles', user.uid), {
                              coins: increment(10000)
                            });
                          }
                        }}
                        className="w-full py-3 rounded-xl bg-green-500/10 hover:bg-green-500/20 text-green-400 text-[10px] font-black uppercase tracking-widest border border-green-500/20 shadow-lg shadow-green-500/5 transition-all active:scale-95"
                      >
                         <Coins size={14} className="inline mr-2" /> +10k Coins (Test)
                      </button>
                      <button 
                        onClick={() => addRandomPlayer('pvp')}
                        className="w-full py-3 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-widest border border-blue-500/20 mt-2"
                      >
                        PVP Bot Simulieren
                      </button>
                      <button 
                        onClick={toggleMaintenance}
                        className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border mt-2 ${isMaintenanceMode ? 'bg-mc-red border-white/20 text-white shadow-lg shadow-mc-red/40' : 'bg-neutral-800 border-neutral-700 text-neutral-400'}`}
                      >
                        {isMaintenanceMode ? 'Wartung Beenden' : 'Wartung Starten'}
                      </button>
                      <button 
                        onClick={setGlobalBroadcast}
                        className="w-full py-3 rounded-xl bg-mc-gold text-black text-[10px] font-black uppercase tracking-widest shadow-lg shadow-mc-gold/20"
                      >
                        Warnung / Broadcast
                      </button>
                      <p className="text-[9px] text-neutral-500 italic text-center px-4">
                        Shift + Alt + S zum schnellen Öffnen/Schließen
                      </p>
                    </div>
                  </div>
                )}

                {/* PVP Controls */}
                <div className="bg-black/40 border border-neutral-800 rounded-2xl p-6 space-y-4">
                  <span className="text-[10px] uppercase font-bold text-red-400 tracking-widest">PVP Server Control</span>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] text-neutral-500 uppercase font-bold">Realm Name (Anzeige)</label>
                      <input 
                        type="text"
                        defaultValue={realmNames.pvp}
                        onBlur={(e) => updateRealmName('pvp', e.target.value)}
                        placeholder="z.B. Helden Realm"
                        className="w-full bg-black/40 border border-neutral-800 rounded-lg p-2 text-xs focus:border-mc-gold outline-none"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Status</span>
                      <button 
                        onClick={() => updateServerStatus('pvp', { online: !pvpStatus.online })}
                        className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${pvpStatus.online ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}
                      >
                        {pvpStatus.online ? 'Online' : 'Offline'}
                      </button>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-neutral-500 uppercase font-bold">Max. Spieler</label>
                      <input 
                        type="number"
                        defaultValue={pvpStatus.maxPlayers}
                        onBlur={(e) => updateServerStatus('pvp', { maxPlayers: parseInt(e.target.value) || 10 })}
                        className="w-full bg-black/40 border border-neutral-800 rounded-lg p-2 text-xs focus:border-mc-gold outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-neutral-500 uppercase font-bold">Realm Code</label>
                      <input 
                        type="text" 
                        defaultValue={realmCodes.PVP}
                        onBlur={(e) => updateRealmCode('pvp', e.target.value)}
                        className="w-full bg-black/40 border border-neutral-800 rounded-lg p-2 text-xs focus:border-mc-gold outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-neutral-500 uppercase font-bold">Farbe</label>
                      <input 
                        type="color"
                        defaultValue={realmColors.pvp}
                        onBlur={(e) => updateRealmColor('pvp', e.target.value)}
                        className="w-full h-8 bg-black/40 border border-neutral-800 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* Survival Controls */}
                <div className="bg-black/40 border border-neutral-800 rounded-2xl p-6 space-y-4">
                  <span className="text-[10px] uppercase font-bold text-mc-red tracking-widest">Survival Server Control</span>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] text-neutral-500 uppercase font-bold">Realm Name (Anzeige)</label>
                      <input 
                        type="text"
                        defaultValue={realmNames.survival}
                        onBlur={(e) => updateRealmName('survival', e.target.value)}
                        placeholder="z.B. Survival World"
                        className="w-full bg-black/40 border border-neutral-800 rounded-lg p-2 text-xs focus:border-mc-gold outline-none"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Status</span>
                      <button 
                        onClick={() => updateServerStatus('survival', { online: !survivalStatus.online })}
                        className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${survivalStatus.online ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}
                      >
                        {survivalStatus.online ? 'Online' : 'Offline'}
                      </button>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-neutral-500 uppercase font-bold">Max. Spieler</label>
                      <input 
                        type="number"
                        defaultValue={survivalStatus.maxPlayers}
                        onBlur={(e) => updateServerStatus('survival', { maxPlayers: parseInt(e.target.value) || 10 })}
                        className="w-full bg-black/40 border border-neutral-800 rounded-lg p-2 text-xs focus:border-mc-gold outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-neutral-500 uppercase font-bold">Realm Code</label>
                      <input 
                        type="text" 
                        defaultValue={realmCodes.SURVIVAL}
                        onBlur={(e) => updateRealmCode('survival', e.target.value)}
                        className="w-full bg-black/40 border border-neutral-800 rounded-lg p-2 text-xs focus:border-mc-gold outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-neutral-500 uppercase font-bold">Farbe</label>
                      <input 
                        type="color"
                        defaultValue={realmColors.survival}
                        onBlur={(e) => updateRealmColor('survival', e.target.value)}
                        className="w-full h-8 bg-black/40 border border-neutral-800 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* Global Actions */}
                {(isAdmin || isOwner || isSuperAdmin) && (
                  <div className="bg-black/40 border border-neutral-800 rounded-2xl p-6 space-y-4">
                    <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-widest">Global Tools</span>
                    <div className="flex flex-col gap-3">
                      <button onClick={clearPlayers} className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs py-3 rounded-xl border border-red-500/20 flex items-center justify-center gap-2">
                        <Trash2 size={14} /> ONLINE-LISTEN WIPE
                      </button>
                      <button onClick={clearProfiles} className="w-full bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-xs py-3 rounded-xl border border-orange-500/20 flex items-center justify-center gap-2">
                         <UserMinus size={14} /> DATABASE PURGE (PROFILE)
                      </button>
                      <button onClick={clearChat} className="w-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs py-3 rounded-xl border border-blue-500/20 flex items-center justify-center gap-2">
                         <MessageCircle size={14} /> CHAT HISTORY CLEAR
                      </button>
                      {(isOwner || isSuperAdmin) && (
                        <button onClick={totalReset} className="w-full bg-white/5 hover:bg-white/10 text-white text-[10px] py-2 rounded-lg border border-white/10 flex items-center justify-center gap-2 mt-4 opacity-50 hover:opacity-100 transition-opacity">
                           <ShieldCheck size={12} /> NUCLEAR RESET
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* BIG SURVEILLANCE TABLE */}
              <div className="bg-black/20 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-md">
                <div className="bg-neutral-900/80 px-8 py-5 border-b border-neutral-800 flex items-center justify-between">
                  <div className="flex flex-col">
                    <h5 className="text-[11px] uppercase font-black text-mc-red tracking-[0.2em] flex items-center gap-2">
                      <Activity size={16} className="text-mc-red animate-pulse" /> Global Entity Intelligence & Identity Matrix
                    </h5>
                    <span className="text-[8px] text-neutral-500 font-mono tracking-widest mt-1">REAL-TIME SURVEILLANCE PROTOCOL ACTIVE | SATELLITE UPLINK: VERIFIED</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-end">
                       <span className="text-[9px] text-neutral-500 font-mono uppercase">Nodes Tracked</span>
                       <span className="text-sm font-black text-white font-mono">{userProfiles.length}</span>
                    </div>
                    <div className="w-[1px] h-8 bg-neutral-800" />
                    <button 
                      onClick={() => trackVisitor(true)}
                      className="p-2 bg-mc-red text-white rounded-lg hover:bg-red-500 transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest active:scale-95"
                    >
                      <RefreshCcw size={14} /> Force Update
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left">
                      <thead className="text-[9px] uppercase font-black text-neutral-400 border-b border-neutral-800 shadow-sm bg-neutral-900/50 sticky top-0 z-20">
                        <tr>
                          <th className="px-8 py-5 tracking-[0.1em]">Identity Vector</th>
                          <th className="px-8 py-5 tracking-[0.1em]">Session Status</th>
                          <th className="px-8 py-5 tracking-[0.1em]">Network Address (IP)</th>
                          <th className="px-8 py-5 tracking-[0.1em]">Geolocation Intelligence</th>
                          <th className="px-8 py-5 tracking-[0.1em]">Infrastructure/ISP</th>
                          <th className="px-8 py-5 tracking-[0.1em]">Protocol</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-800/40 bg-black/10">
                        {userProfiles.length === 0 ? (
                           <tr>
                             <td colSpan={6} className="px-8 py-20 text-center text-neutral-600 text-xs font-mono uppercase tracking-[0.3em]">No valid entities detected in perimeter</td>
                           </tr>
                        ) : [...userProfiles].sort((a,b) => (b.isOnline ? 1 : 0) - (a.isOnline ? 1 : 0)).map((p, i) => (
                           <tr key={`${p.userId}-${i}`} className="hover:bg-mc-red/[0.04] transition-all duration-300 group">
                             <td className="px-8 py-5">
                               <div className="flex items-center gap-4">
                                 <div className="relative group/avatar">
                                   <img 
                                     src={p.customSkin || `https://mc-heads.net/avatar/${p.minecraftUsername || 'Steve'}`} 
                                     className="w-12 h-12 rounded-xl bg-neutral-900 border border-neutral-800 object-cover shadow-lg group-hover/avatar:border-mc-red/50 transition-all" 
                                     alt=""
                                     referrerPolicy="no-referrer"
                                   />
                                   {p.isOnline && <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-black animate-pulse" />}
                                 </div>
                                 <div className="flex flex-col">
                                   <div className="flex items-center gap-2">
                                     <span className="font-black text-sm text-white tracking-tight">{p.displayName}</span>
                                     <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                                       p.role === 'Owner' || p.role === 'Root' ? 'bg-mc-gold/20 text-mc-gold border border-mc-gold/30' : 
                                       p.role === 'Admin' ? 'bg-mc-red/20 text-mc-red border border-mc-red/30' : 
                                       'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                     }`}>
                                       {p.role}
                                     </span>
                                   </div>
                                   <span className="text-[9px] text-neutral-500 font-mono uppercase mt-1">UID: {p.userId}</span>
                                 </div>
                               </div>
                             </td>
                             <td className="px-8 py-5">
                               <div className="flex flex-col gap-1">
                                 <div className="flex items-center gap-2">
                                   <div className={`w-2 h-2 rounded-full ${p.isOnline ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-neutral-800'}`} />
                                   <span className={`text-[10px] font-black uppercase tracking-widest ${p.isOnline ? 'text-green-400' : 'text-neutral-500'}`}>
                                     {p.isOnline ? 'Connected' : 'Disconnected'}
                                   </span>
                                 </div>
                                 <span className="text-[8px] text-neutral-600 font-mono">
                                    Last Active: {p.updatedAt?.seconds ? new Date(p.updatedAt.seconds * 1000).toLocaleString() : 'Legacy Record'}
                                 </span>
                               </div>
                             </td>
                             <td className="px-8 py-5">
                               <div className="flex flex-col gap-1">
                                 <span className="font-mono text-mc-gold text-xs font-black tracking-widest selection:bg-mc-gold selection:text-black">
                                   {p.lastLoginIp || '0.0.0.0'}
                                 </span>
                                 <span className="text-[8px] text-neutral-600 font-black uppercase">Trace-Vektor: Alpha-Primary</span>
                               </div>
                             </td>
                             <td className="px-8 py-5">
                               <div className="flex items-center gap-3">
                                 <MapPin size={16} className="text-mc-red opacity-50 shrink-0" />
                                 <div className="flex flex-col max-w-[200px]">
                                   <span className="text-white text-[11px] font-black leading-tight uppercase tracking-tight truncate">
                                     {p.lastLoginCity || 'Unknown'}, {p.lastLoginRegion || 'N/A'}
                                   </span>
                                   <span className="text-[9px] text-neutral-500 font-bold uppercase truncate">{p.lastLoginCountry || 'Neutral Territory'}</span>
                                 </div>
                               </div>
                             </td>
                             <td className="px-8 py-5 text-neutral-400">
                               <div className="flex flex-col max-w-[250px]">
                                 <span className="text-[10px] font-mono text-neutral-300 font-bold truncate leading-tight">{p.lastLoginOrg || 'Analyzing Provider...'}</span>
                                 <span className="text-[8px] text-neutral-600 font-black uppercase mt-1">ASN: {p.lastLoginAsn || '---'}</span>
                               </div>
                             </td>
                             <td className="px-8 py-5">
                               <button 
                                 onClick={() => openProfileEdit(p.userId)}
                                 className="w-full py-3 bg-neutral-900 border border-neutral-800 hover:border-mc-red hover:bg-mc-red/10 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 active:scale-95 group/btn"
                               >
                                 <Shield size={14} className="group-hover/btn:text-mc-red transition-colors" />
                                 Full Trace
                               </button>
                             </td>
                           </tr>
                        ))}
                      </tbody>
                    </table>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unified Expandable Adventure Menu (FAB) - Hide when any overlay is open */}
      <AnimatePresence>
        {!isAnyOverlayOpen && (
          <div className="fixed bottom-8 right-8 z-[120] flex flex-col items-end gap-3 pointer-events-none">
            {/* Expanded items list */}
            {isFabMenuOpen && (
              <motion.div
                initial="hidden"
                animate="visible"
                exit="hidden"
                variants={{
                  visible: {
                    transition: {
                      staggerChildren: 0.04,
                    }
                  },
                  hidden: {}
                }}
                className="flex flex-col items-end gap-3 mb-2"
              >
                {/* 1. KI-Orakel */}
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 15, scale: 0.8 },
                    visible: { opacity: 1, y: 0, scale: 1 }
                  }}
                  className="flex items-center gap-3 pointer-events-auto group/item"
                >
                  <span className="bg-black/95 text-mc-gold text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-mc-gold/30 shadow-xl opacity-0 group-hover/item:opacity-100 transition-opacity duration-200 select-none">
                    KI-Orakel
                  </span>
                  <button
                    onClick={() => {
                      setIsAiOpen(true);
                      setIsFabMenuOpen(false);
                      setChatOpen(false);
                      setNewsOpen(false);
                      setPollsOpen(false);
                      setBotpressOpen(false);
                      setShopOpen(false);
                      setShowMiningModal(false);
                      setLeaderboardOpen(false);
                    }}
                    className="w-12 h-12 rounded-xl bg-black border-2 border-mc-gold text-mc-gold flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 hover:shadow-[0_0_15px_rgba(255,170,0,0.5)] transition-all"
                    title="KI-Orakel"
                  >
                    <Sparkles size={20} className="animate-pulse" />
                  </button>
                </motion.div>

                {/* 1.5 Info-Bot (Botpress Bot) */}
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 15, scale: 0.8 },
                    visible: { opacity: 1, y: 0, scale: 1 }
                  }}
                  className="flex items-center gap-3 pointer-events-auto group/item"
                >
                  <span className="bg-black/95 text-cyan-400 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-cyan-500/30 shadow-xl opacity-0 group-hover/item:opacity-100 transition-opacity duration-200 select-none">
                    Info-Bot
                  </span>
                  <button
                    onClick={() => {
                      setBotpressOpen(true);
                      setIsFabMenuOpen(false);
                      setIsAiOpen(false);
                      setChatOpen(false);
                      setNewsOpen(false);
                      setPollsOpen(false);
                      setShopOpen(false);
                      setShowMiningModal(false);
                      setLeaderboardOpen(false);
                    }}
                    className="w-12 h-12 rounded-xl bg-black border-2 border-cyan-500 text-cyan-400 flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 hover:shadow-[0_0_15px_rgba(34,211,238,0.5)] transition-all"
                    title="Info-Bot"
                  >
                    <Bot size={20} className="text-cyan-400 animate-pulse" />
                  </button>
                </motion.div>

                {/* 2. Clan Chat */}
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 15, scale: 0.8 },
                    visible: { opacity: 1, y: 0, scale: 1 }
                  }}
                  className="flex items-center gap-3 pointer-events-auto group/item"
                >
                  <span className="bg-black/95 text-neutral-200 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-neutral-800 shadow-xl opacity-0 group-hover/item:opacity-100 transition-opacity duration-200 select-none">
                    Clan Chat
                  </span>
                  <button
                    onClick={() => {
                      setChatOpen(true);
                      setNewsOpen(false);
                      setPollsOpen(false);
                      setShopOpen(false);
                      setShowMiningModal(false);
                      setLeaderboardOpen(false);
                      setIsFabMenuOpen(false);
                    }}
                    className="w-12 h-12 rounded-xl bg-black border border-neutral-800 text-white flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 hover:border-mc-gold transition-all"
                    title="Clan Chat"
                  >
                    <MessageCircle size={20} />
                  </button>
                </motion.div>

                {/* 3. Umfragen */}
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 15, scale: 0.8 },
                    visible: { opacity: 1, y: 0, scale: 1 }
                  }}
                  className="flex items-center gap-3 pointer-events-auto group/item"
                >
                  <span className="bg-black/95 text-neutral-200 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-neutral-800 shadow-xl opacity-0 group-hover/item:opacity-100 transition-opacity duration-200 select-none">
                    Umfragen
                  </span>
                  <button
                    onClick={() => {
                      setPollsOpen(true);
                      fetchPolls();
                      setNewsOpen(false);
                      setChatOpen(false);
                      setShopOpen(false);
                      setShowMiningModal(false);
                      setLeaderboardOpen(false);
                      setIsFabMenuOpen(false);
                    }}
                    className="w-12 h-12 rounded-xl bg-black border border-neutral-800 text-white flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 hover:border-mc-red transition-all"
                    title="Umfragen"
                  >
                    <Vote size={20} />
                  </button>
                </motion.div>

                {/* 4. News-Feed */}
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 15, scale: 0.8 },
                    visible: { opacity: 1, y: 0, scale: 1 }
                  }}
                  className="flex items-center gap-3 pointer-events-auto group/item"
                >
                  <span className="bg-black/95 text-neutral-200 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-neutral-800 shadow-xl opacity-0 group-hover/item:opacity-100 transition-opacity duration-200 select-none">
                    News-Feed
                  </span>
                  <button
                    onClick={() => {
                      setNewsOpen(true);
                      fetchNews();
                      setPollsOpen(false);
                      setSuggestionsOpen(false);
                      setChatOpen(false);
                      setShopOpen(false);
                      setShowMiningModal(false);
                      setLeaderboardOpen(false);
                      setIsFabMenuOpen(false);
                    }}
                    className="w-12 h-12 rounded-xl bg-black border border-neutral-800 text-white flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 hover:border-mc-red transition-all"
                    title="News-Feed"
                  >
                    <Newspaper size={20} />
                  </button>
                </motion.div>

                {/* 4.5 Vorschläge */}
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 15, scale: 0.8 },
                    visible: { opacity: 1, y: 0, scale: 1 }
                  }}
                  className="flex items-center gap-3 pointer-events-auto group/item"
                >
                  <span className="bg-black/95 text-neutral-200 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-neutral-800 shadow-xl opacity-0 group-hover/item:opacity-100 transition-opacity duration-200 select-none">
                    Vorschläge
                  </span>
                  <button
                    onClick={() => {
                      setSuggestionsOpen(true);
                      fetchSuggestions();
                      setNewsOpen(false);
                      setPollsOpen(false);
                      setChatOpen(false);
                      setShopOpen(false);
                      setShowMiningModal(false);
                      setLeaderboardOpen(false);
                      setIsFabMenuOpen(false);
                    }}
                    className="w-12 h-12 rounded-xl bg-black border border-neutral-800 text-white flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 hover:border-blue-400 transition-all"
                    title="Vorschläge"
                  >
                    <Lightbulb size={20} />
                  </button>
                </motion.div>

                {/* 5. Globaler Shop */}
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 15, scale: 0.8 },
                    visible: { opacity: 1, y: 0, scale: 1 }
                  }}
                  className="flex items-center gap-3 pointer-events-auto group/item"
                >
                  <span className="bg-black/95 text-neutral-200 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-neutral-800 shadow-xl opacity-0 group-hover/item:opacity-100 transition-opacity duration-200 select-none">
                    Shop
                  </span>
                  <button
                    onClick={() => {
                      setShopOpen(true);
                      fetchShop();
                      setNewsOpen(false);
                      setPollsOpen(false);
                      setChatOpen(false);
                      setShowMiningModal(false);
                      setLeaderboardOpen(false);
                      setIsFabMenuOpen(false);
                    }}
                    className="w-12 h-12 rounded-xl bg-black border border-neutral-800 text-white flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 hover:border-mc-gold transition-all"
                    title="Globaler Shop"
                  >
                    <ShoppingBag size={20} />
                  </button>
                </motion.div>

                {/* 6. Deep Mines */}
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 15, scale: 0.8 },
                    visible: { opacity: 1, y: 0, scale: 1 }
                  }}
                  className="flex items-center gap-3 pointer-events-auto group/item"
                >
                  <span className="bg-black/95 text-mc-gold text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-mc-gold/30 shadow-xl opacity-0 group-hover/item:opacity-100 transition-opacity duration-200 select-none">
                    Deep Mines
                  </span>
                  <button
                    onClick={() => {
                      setShowMiningModal(true);
                      setShopOpen(false);
                      setNewsOpen(false);
                      setPollsOpen(false);
                      setChatOpen(false);
                      setLeaderboardOpen(false);
                      setIsFabMenuOpen(false);
                    }}
                    className="w-12 h-12 rounded-xl bg-black border border-neutral-800 text-white flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 hover:border-mc-gold transition-all"
                    title="Mining Minispiel"
                  >
                    <Pickaxe size={20} />
                  </button>
                </motion.div>

                {/* 7. Bestenliste */}
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 15, scale: 0.8 },
                    visible: { opacity: 1, y: 0, scale: 1 }
                  }}
                  className="flex items-center gap-3 pointer-events-auto group/item"
                >
                  <span className="bg-black/95 text-neutral-200 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-neutral-800 shadow-xl opacity-0 group-hover/item:opacity-100 transition-opacity duration-200 select-none">
                    Bestenliste
                  </span>
                  <button
                    onClick={() => {
                      setLeaderboardOpen(true);
                      fetchLeaderboard();
                      setShopOpen(false);
                      setNewsOpen(false);
                      setPollsOpen(false);
                      setChatOpen(false);
                      setShowMiningModal(false);
                      setDevLabsOpen(false);
                      setIsFabMenuOpen(false);
                    }}
                    className="w-12 h-12 rounded-xl bg-black border border-neutral-800 text-white flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 hover:border-mc-gold transition-all"
                    title="Bestenliste"
                  >
                    <Trophy size={20} />
                  </button>
                </motion.div>

                {/* 7.5 Entwickler-Zentrum */}
                {(false && (myProfile?.role === 'Owner' || myProfile?.role === 'Root' || isOwner || isSuperAdmin)) && (
                  <motion.div
                    variants={{
                      hidden: { opacity: 0, y: 15, scale: 0.8 },
                      visible: { opacity: 1, y: 0, scale: 1 }
                    }}
                    className="flex items-center gap-3 pointer-events-auto group/item"
                  >
                    <span className="bg-black/95 text-cyan-400 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-cyan-500/30 shadow-xl opacity-0 group-hover/item:opacity-100 transition-opacity duration-200 select-none">
                      Entwickler-Zentrum
                    </span>
                    <button
                      onClick={() => {
                        setDevLabsOpen(true);
                        setLeaderboardOpen(false);
                        setShopOpen(false);
                        setNewsOpen(false);
                        setPollsOpen(false);
                        setChatOpen(false);
                        setShowMiningModal(false);
                        setIsFabMenuOpen(false);
                      }}
                      className="w-12 h-12 rounded-xl bg-black border-2 border-cyan-500/50 text-cyan-400 flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 hover:shadow-[0_0_15px_rgba(34,211,238,0.4)] transition-all"
                      title="Entwickler-Zentrum (Rust & Flutter)"
                    >
                      <Cpu size={20} className="text-cyan-400" />
                    </button>
                  </motion.div>
                )}

                {/* 8. Install App (Conditional) */}
                {showInstallButton && (
                  <motion.div
                    variants={{
                      hidden: { opacity: 0, y: 15, scale: 0.8 },
                      visible: { opacity: 1, y: 0, scale: 1 }
                    }}
                    className="flex items-center gap-3 pointer-events-auto group/item"
                  >
                    <span className="bg-black/95 text-mc-green text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-green-500/30 shadow-xl opacity-0 group-hover/item:opacity-100 transition-opacity duration-200 select-none">
                      App Installieren
                    </span>
                    <button
                      onClick={() => {
                        handleInstallClick();
                        setIsFabMenuOpen(false);
                      }}
                      className="w-12 h-12 rounded-xl bg-mc-green text-black flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all"
                      title="App installieren"
                    >
                      <Rocket size={20} className="animate-bounce" />
                    </button>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* Main Primary FAB Toggle Button */}
            <motion.button
              key="main-fab-toggle"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setIsFabMenuOpen(!isFabMenuOpen);
                playAppSound('click');
              }}
              className="pointer-events-auto w-14 h-14 rounded-2xl bg-black border-2 border-mc-gold text-mc-gold flex items-center justify-center shadow-[0_0_30px_rgba(255,170,0,0.4)] relative overflow-hidden group transition-all"
              title="Abenteuer-Menü"
            >
              <div className="absolute inset-0 bg-mc-gold/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              {/* Pulsing ring around main action button when menu is closed */}
              {!isFabMenuOpen && (
                <div className="absolute inset-0 border-2 border-mc-gold/40 rounded-2xl animate-ping opacity-75 pointer-events-none scale-105" />
              )}
              
              <motion.div
                animate={{ rotate: isFabMenuOpen ? 135 : 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="relative z-10 flex items-center justify-center"
              >
                <Plus size={26} className="text-mc-gold drop-shadow-[0_0_8px_rgba(255,170,0,0.5)]" />
              </motion.div>
            </motion.button>
          </div>
        )}
      </AnimatePresence>

      {/* News Drawer */}
      <AnimatePresence>
        {newsOpen && (
          <motion.div 
            key="news-drawer-panel"
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="fixed inset-y-0 right-0 w-full sm:w-[400px] bg-black/95 backdrop-blur-xl z-[70] border-l border-neutral-800 shadow-2xl flex flex-col pt-20"
          >
            <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Newspaper className="text-mc-red" />
                  News-Feed
                </h3>
                <p className="text-neutral-500 text-xs">Aktuelle Updates & Ankündigungen</p>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); addNews(); }}
                    className="p-2 bg-mc-gold text-black rounded-lg hover:bg-mc-gold/80 transition-all shadow-lg active:scale-95"
                    title="News hinzufügen"
                  >
                    <Plus size={20} />
                  </button>
                )}
                <button onClick={() => setNewsOpen(false)} className="p-2 hover:bg-neutral-800 rounded-lg transition-colors">
                  <X size={24} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {news.length === 0 ? (
                <div className="text-center py-10 opacity-30 text-xs uppercase tracking-widest">Keine News verfügbar</div>
              ) : news.map((item, idx) => (
                <div key={`news-item-${item.id || idx}-${idx}`} className="mc-card p-4 border-neutral-800 hover:border-mc-red/30 transition-colors group">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-sm text-mc-red">{item.title}</h4>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-neutral-500">
                        {item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000).toLocaleDateString() : 'Gerade eben'}
                      </span>
                      {isAdmin && (
                        <button 
                          onClick={() => deleteNewsItem(item.id)}
                          className="text-red-500 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-neutral-400 leading-relaxed whitespace-pre-wrap">{item.text}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Polls Drawer */}
      <AnimatePresence>
        {pollsOpen && (
          <motion.div 
            key="polls-drawer-panel"
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="fixed inset-y-0 right-0 w-full sm:w-[400px] bg-black/95 backdrop-blur-xl z-[70] border-l border-neutral-800 shadow-2xl flex flex-col pt-20"
          >
            <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Vote className="text-mc-red" />
                  Community Umfragen
                </h3>
                <p className="text-neutral-500 text-xs">Deine Meinung zählt!</p>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); addPoll(); }}
                    className="p-2 bg-mc-gold text-black rounded-lg hover:bg-mc-gold/80 transition-all shadow-lg active:scale-95"
                    title="Umfrage erstellen"
                  >
                    <Plus size={20} />
                  </button>
                )}
                <button onClick={() => setPollsOpen(false)} className="p-2 hover:bg-neutral-800 rounded-lg transition-colors">
                  <X size={24} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {polls.length === 0 ? (
                <div className="text-center py-10 opacity-30 text-xs uppercase tracking-widest">Keine Umfragen verfügbar</div>
              ) : polls.map((poll, pIdx) => {
                const totalVotes = poll.options.reduce((acc, opt) => acc + opt.votes, 0);
                return (
                  <div key={`poll-item-${poll.id || pIdx}-${pIdx}`} className="space-y-4 relative group">
                    <div className={`p-4 rounded-xl border transition-all ${poll.isActive ? 'bg-mc-red/10 border-mc-red/20' : 'bg-neutral-900 border-neutral-800 opacity-80'}`}>
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-bold text-sm">{poll.question}</h4>
                        {isAdmin && (
                          <div className="flex gap-1">
                            <button onClick={() => togglePollStatus(poll.id)} className="p-1 hover:bg-black/20 rounded" title={poll.isActive ? "Beenden" : "Aktivieren"}>
                              {poll.isActive ? <Lock size={12} /> : <Unlock size={12} />}
                            </button>
                            <button onClick={() => deletePoll(poll.id)} className="p-1 hover:bg-black/20 rounded text-red-500" title="Löschen">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                      
                      {!poll.isActive && <p className="text-[10px] text-neutral-500 uppercase font-bold mb-2">Beendet</p>}
                      
                      <div className="space-y-2">
                        {poll.options.map((opt, optIdx) => (
                          <button 
                            key={`poll-opt-${poll.id || `p-${pIdx}`}-${opt.label}-${optIdx}`}
                            disabled={!poll.isActive}
                            onClick={() => votePoll(poll.id, optIdx)}
                            className={`w-full bg-neutral-900 border border-neutral-800 p-3 rounded-lg text-left text-xs hover:border-mc-red/50 transition-all relative overflow-hidden group ${!poll.isActive ? 'cursor-default' : ''}`}
                          >
                            <div className="relative z-10 flex justify-between">
                              <span>{opt.label}</span>
                              <span className="text-neutral-500">{totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0}%</span>
                            </div>
                            <div className="absolute inset-y-0 left-0 bg-mc-red/10 transition-all duration-500" style={{ width: `${totalVotes > 0 ? (opt.votes / totalVotes) * 100 : 0}%` }} />
                          </button>
                        ))}
                      </div>
                      <p className="mt-3 text-[9px] text-neutral-500 text-right uppercase tracking-widest">{totalVotes} Stimmen insgesamt</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botpress Info-Bot Panel */}
      <InfoBotPanel isOpen={botpressOpen} onClose={() => setBotpressOpen(false)} />

      {/* Suggestions Drawer */}
      <AnimatePresence>
        {suggestionsOpen && (
          <motion.div 
            key="suggestions-drawer"
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="fixed inset-y-0 right-0 w-full sm:w-[450px] bg-black/95 backdrop-blur-xl z-[70] border-l border-neutral-800 shadow-2xl flex flex-col pt-20"
          >
            <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Lightbulb className="text-blue-400" />
                  Community Vorschläge
                </h3>
                <p className="text-neutral-500 text-xs">
                  Teile deine Ideen und vote für die besten!
                </p>
              </div>
              <button 
                onClick={() => setSuggestionsOpen(false)}
                className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
                title="Schließen"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              <div className="bg-neutral-900/50 p-4 rounded-xl border border-neutral-800 mb-6">
                <h4 className="text-sm font-bold text-white mb-2">Neuen Vorschlag einreichen</h4>
                <form onSubmit={handleSuggestionSubmit} className="space-y-3">
                  {!user && (
                    <input
                      name="guestName"
                      type="text"
                      placeholder="Dein Name / Nickname (optional)..."
                      className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none transition-colors text-neutral-300"
                    />
                  )}
                  <input
                    name="title"
                    type="text"
                    required
                    placeholder="Kurzer, prägnanter Titel..."
                    className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none transition-colors text-neutral-200"
                  />
                  <textarea
                    name="description"
                    required
                    placeholder="Beschreibe deine Idee im Detail..."
                    rows={3}
                    className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none transition-colors resize-none text-neutral-200"
                  />
                  
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Kategorie / Tag</label>
                    <select
                      name="tag"
                      required
                      className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none transition-colors text-neutral-300 appearance-none"
                    >
                      <option value="Feature">Feature</option>
                      <option value="Bug-Report">Bug-Report</option>
                      <option value="Design">Design</option>
                      <option value="Sonstiges">Sonstiges</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-lg transition-colors text-sm mt-2"
                  >
                    Vorschlag senden
                  </button>
                </form>
              </div>

              {/* Filter and Sort Controls */}
              <div className="bg-neutral-900/30 p-3 rounded-xl border border-neutral-800 space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[11px] font-bold text-neutral-400">Tag Filter:</span>
                  <div className="flex flex-wrap gap-1">
                    {['All', 'Feature', 'Bug-Report', 'Design', 'Sonstiges'].map((tagOption) => (
                      <button
                        key={tagOption}
                        onClick={() => setSuggestionsTagFilter(tagOption)}
                        className={`text-[10px] px-2 py-1 rounded font-semibold transition-colors ${
                          suggestionsTagFilter === tagOption
                            ? 'bg-blue-500 text-white shadow-[0_0_8px_rgba(59,130,246,0.5)]'
                            : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200'
                        }`}
                      >
                        {tagOption === 'All' ? 'Alle' : tagOption}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-neutral-800 pt-2 flex-wrap">
                  <span className="text-[11px] font-bold text-neutral-400">Sortierung:</span>
                  <div className="flex gap-1">
                    {[
                      { value: 'score', label: 'Beste' },
                      { value: 'newest', label: 'Neueste' },
                      { value: 'comments', label: 'Aktivste' }
                    ].map((sortOption) => (
                      <button
                        key={sortOption.value}
                        onClick={() => setSuggestionsSort(sortOption.value as any)}
                        className={`text-[10px] px-2 py-1 rounded font-semibold transition-colors ${
                          suggestionsSort === sortOption.value
                            ? 'bg-blue-500 text-white shadow-[0_0_8px_rgba(59,130,246,0.5)]'
                            : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200'
                        }`}
                      >
                        {sortOption.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-widest text-neutral-500 mb-2">Aktuelle Vorschläge</h4>
                {filteredAndSortedSuggestions.map((sug) => {
                  const commentsCount = (sug.comments || []).length;
                  const isCommentsExpanded = !!expandedSuggestionComments[sug.id];
                  const hasUpvoted = (sug.upvotedBy || []).includes(user?.uid || guestId);
                  const hasDownvoted = (sug.downvotedBy || []).includes(user?.uid || guestId);

                  return (
                    <div key={sug.id} className="bg-black border border-neutral-800 rounded-xl p-4 flex flex-col hover:border-neutral-700 transition-colors group">
                      <div className="flex gap-4">
                        <div className="flex flex-col items-center gap-2 shrink-0">
                          {/* Upvote Button */}
                          <div className="flex flex-col items-center gap-0.5">
                            <button
                              onClick={() => toggleUpvote(sug.id, sug.upvotedBy || [], sug.downvotedBy || [])}
                              className={`p-1.5 rounded-lg transition-colors ${
                                hasUpvoted
                                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                  : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800 border border-transparent'
                              }`}
                              title="Dafür stimmen"
                            >
                              <ChevronUp size={18} className={hasUpvoted ? 'drop-shadow-[0_0_5px_rgba(59,130,246,0.8)]' : ''} />
                            </button>
                            <span className={`font-black text-xs ${hasUpvoted ? 'text-blue-400' : 'text-neutral-300'}`}>
                              {sug.upvotes || 0}
                            </span>
                          </div>

                          {/* Downvote Button */}
                          <div className="flex flex-col items-center gap-0.5">
                            <button
                              onClick={() => toggleDownvote(sug.id, sug.downvotedBy || [], sug.upvotedBy || [])}
                              className={`p-1.5 rounded-lg transition-colors ${
                                hasDownvoted
                                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                  : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800 border border-transparent'
                              }`}
                              title="Dagegen stimmen"
                            >
                              <ChevronDown size={18} className={hasDownvoted ? 'drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]' : ''} />
                            </button>
                            <span className={`font-black text-xs ${hasDownvoted ? 'text-red-400' : 'text-neutral-500'}`}>
                              {sug.downvotes || 0}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex flex-col gap-1 min-w-0">
                              <h5 className="font-bold text-sm text-white truncate" title={sug.title}>{sug.title}</h5>
                              {sug.tag && (
                                <span className={`self-start text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider ${
                                  sug.tag === 'Feature' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                  sug.tag === 'Bug-Report' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                                  sug.tag === 'Design' ? 'bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20' :
                                  'bg-neutral-800 text-neutral-400 border border-neutral-850'
                                }`}>
                                  {sug.tag}
                                </span>
                              )}
                            </div>
                            {sug.status && (
                              <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 ${
                                sug.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                sug.status === 'in-progress' ? 'bg-blue-500/20 text-blue-400' :
                                sug.status === 'planned' ? 'bg-purple-500/20 text-purple-400' :
                                sug.status === 'declined' ? 'bg-red-500/20 text-red-400' :
                                'bg-neutral-800 text-neutral-400'
                              }`}>
                                {sug.status}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-neutral-400 whitespace-pre-wrap break-words leading-relaxed">{sug.description}</p>
                          <div className="mt-3 flex items-center justify-between">
                            <p className="text-[10px] text-neutral-500">
                              Von <span className="text-neutral-300">{sug.authorName}</span>
                            </p>
                            {(isAdmin || isOwner) && (
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                <select
                                  value={sug.status || 'pending'}
                                  onChange={(e) => setDoc(doc(db, 'suggestions', sug.id), { status: e.target.value }, { merge: true }).then(fetchSuggestions)}
                                  className="text-[9px] bg-neutral-900 border border-neutral-700 rounded px-1 text-neutral-300 outline-none"
                                >
                                  <option value="pending">Pending</option>
                                  <option value="planned">Geplant</option>
                                  <option value="in-progress">In Arbeit</option>
                                  <option value="completed">Fertig</option>
                                  <option value="declined">Abgelehnt</option>
                                </select>
                                <button
                                  onClick={async () => {
                                    if (confirm("Vorschlag löschen?")) {
                                      await deleteDoc(doc(db, 'suggestions', sug.id));
                                      fetchSuggestions();
                                    }
                                  }}
                                  className="text-red-500 hover:text-red-400 p-0.5"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Comments Section */}
                      <div className="mt-3 pt-3 border-t border-neutral-900">
                        <button
                          onClick={() => setExpandedSuggestionComments(prev => ({ ...prev, [sug.id]: !prev[sug.id] }))}
                          className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors"
                        >
                          <MessageSquare size={14} className="text-neutral-500" />
                          <span>{commentsCount} {commentsCount === 1 ? 'Kommentar' : 'Kommentare'}</span>
                          <ChevronDown size={14} className={`transition-transform duration-200 ${isCommentsExpanded ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {isCommentsExpanded && (
                          <div className="mt-3 space-y-3 pl-2 border-l border-neutral-800">
                            {/* Comment list */}
                            {(sug.comments || []).length > 0 ? (
                              <div className="space-y-2 max-h-[160px] overflow-y-auto custom-scrollbar pr-1">
                                {(sug.comments || []).map((comment) => (
                                  <div key={comment.id} className="bg-neutral-900/40 p-2 rounded-lg border border-neutral-900">
                                    <div className="flex justify-between items-center mb-1">
                                      <span className="text-[10px] font-bold text-neutral-300">{comment.authorName}</span>
                                      <span className="text-[9px] text-neutral-500">
                                        {new Date(comment.createdAt).toLocaleDateString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>
                                    <p className="text-xs text-neutral-300 break-words">{comment.text}</p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[10px] text-neutral-500 italic">Noch keine Kommentare.</p>
                            )}
                            
                            {/* Post comment form */}
                            <form 
                              onSubmit={(e) => {
                                e.preventDefault();
                                const input = e.currentTarget.elements.namedItem('commentText') as HTMLInputElement;
                                let optionalGuestName = '';
                                if (!user) {
                                  const guestNameInput = e.currentTarget.elements.namedItem('commentGuestName') as HTMLInputElement | null;
                                  optionalGuestName = (guestNameInput?.value || '').trim();
                                }
                                if (input && input.value.trim()) {
                                  handleCommentSubmit(sug.id, input.value, optionalGuestName);
                                  input.value = '';
                                }
                              }}
                              className="space-y-2 mt-2"
                            >
                              {!user && (
                                <input
                                  name="commentGuestName"
                                  type="text"
                                  placeholder="Dein Name (optional)..."
                                  defaultValue={localStorage.getItem('suggestions_guest_name') || ''}
                                  className="w-full bg-black border border-neutral-800 rounded-lg px-2.5 py-1 text-[11px] focus:border-blue-500 outline-none transition-colors text-neutral-300"
                                />
                              )}
                              <div className="flex gap-2">
                                <input
                                  name="commentText"
                                  type="text"
                                  placeholder="Schreibe einen Kommentar..."
                                  required
                                  className="flex-1 bg-black border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs focus:border-blue-500 outline-none transition-colors text-neutral-200"
                                />
                                <button
                                  type="submit"
                                  className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-lg transition-colors shrink-0"
                                >
                                  Senden
                                </button>
                              </div>
                            </form>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                
                {filteredAndSortedSuggestions.length === 0 && (
                  <div className="text-center py-10">
                    <Lightbulb size={32} className="mx-auto text-neutral-700 mb-3" />
                    <p className="text-neutral-500 text-sm italic">
                      {suggestionsTagFilter === 'All' 
                        ? 'Noch keine Vorschläge vorhanden.' 
                        : `Noch keine Vorschläge in der Kategorie "${suggestionsTagFilter}" vorhanden.`}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shop Drawer */}
      <AnimatePresence>
        {shopOpen && (
          <motion.div 
            key="shop-drawer-panel"
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="fixed inset-y-0 right-0 w-full md:w-[700px] bg-black/98 backdrop-blur-2xl z-[70] border-l border-neutral-800 shadow-2xl flex flex-col pt-20"
          >
            <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <ShoppingBag className="text-mc-gold" />
                  Globaler Shop
                </h3>
                <p className="text-neutral-500 text-xs">Kaufe Ränge, Items und mehr mit Coins</p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => { setShowMyItems(!showMyItems); setShowLogs(false); }}
                  className={`p-2 rounded-lg transition-all shadow-lg active:scale-95 ${showMyItems ? 'bg-mc-blue text-white' : 'bg-neutral-800 text-neutral-400 hover:text-white'}`}
                  title="Meine Käufe"
                >
                  <Package size={20} />
                </button>
                {isAdmin && (
                  <>
                    <button 
                      onClick={() => { setShowLogs(!showLogs); setShowMyItems(false); }}
                      className={`p-2 rounded-lg transition-all shadow-lg active:scale-95 ${showLogs ? 'bg-mc-red text-white' : 'bg-neutral-800 text-neutral-400 hover:text-white'}`}
                      title="Verkauf-Logs"
                    >
                      <History size={20} />
                    </button>
                    {!showLogs && !showMyItems && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); addShopItem(); }}
                        className="p-2 bg-mc-gold text-black rounded-lg hover:bg-mc-gold/80 transition-all shadow-lg active:scale-95"
                        title="Item hinzufügen"
                      >
                        <Plus size={20} />
                      </button>
                    )}
                  </>
                )}
                <button onClick={() => setShopOpen(false)} className="p-2 hover:bg-neutral-800 rounded-lg transition-colors">
                  <X size={24} />
                </button>
              </div>
            </div>
            
            <div className="p-4 bg-mc-gold/5 border-b border-mc-gold/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-mc-gold tracking-widest">Dein Guthaben</span>
                    <span className="text-[9px] text-neutral-500 font-medium">Verfügbar für Käufe</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={claimDailyReward}
                      className="flex items-center gap-2 px-3 py-1.5 bg-mc-gold text-black rounded-lg font-bold text-[10px] uppercase tracking-tighter hover:scale-105 active:scale-95 transition-all shadow-lg font-bold"
                    >
                      🎁 Daily Bonus
                    </button>
                    <div className="flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-full border border-mc-gold/20 shadow-[0_0_15px_rgba(255,170,0,0.1)]">
                      <span className="text-mc-gold font-black">{myProfile?.coins?.toLocaleString() || 0}</span>
                      <Coins size={14} className="text-mc-gold" />
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-neutral-900 rounded-lg border border-neutral-800">
                    <Key size={10} className="text-mc-gold" />
                    <span className="text-[10px] text-white font-bold">{myProfile?.inventory?.keys || 0}</span>
                    <span className="text-[8px] text-neutral-500 uppercase font-black">Keys</span>
                  </div>
                  {myProfile?.perks?.flightUntil && myProfile?.perks?.flightUntil > Date.now() && (
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-mc-blue/10 rounded-lg border border-mc-blue/20 animate-pulse">
                      <Rocket size={10} className="text-mc-blue" />
                      <span className="text-[8px] text-mc-blue uppercase font-black italic">Flug Aktiv</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Dynamic Live Profile Box Preview */}
              {myProfile && (
                <div className={`p-3 rounded-2xl flex items-center gap-4 min-w-[240px] relative overflow-hidden bg-black/40 border transition-all duration-300 ${
                  previewGlow ? 'border-mc-gold/40 shadow-[0_0_15px_rgba(255,170,0,0.1)]' : 'border-neutral-800/80'
                }`}>
                  <div className="absolute top-1 right-2 flex items-center gap-1">
                    <span className="text-[7.5px] uppercase tracking-wider text-neutral-500 font-black animate-pulse">
                      {previewGlow ? 'Glow-Vorschau' : 'Deine Profilbox'}
                    </span>
                    <Sparkles size={8} className="text-mc-gold" />
                  </div>

                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
                    previewGlow ? getGlowStyles(previewGlow) : (myProfile.activeGlow && myProfile.activeGlow !== 'none' ? getGlowStyles(myProfile.activeGlow) : 'border border-neutral-800/80 bg-neutral-900/40')
                  }`}>
                    <img 
                      src={myProfile.customSkin || `https://mc-heads.net/avatar/${myProfile.minecraftUsername || myProfile.displayName}/64`} 
                      className="w-8 h-8 rounded-lg pixelated" 
                      alt="" 
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div>
                    <div className="text-xs font-black uppercase text-white tracking-tight flex items-center gap-1.5">
                      {myProfile.displayName}
                    </div>
                    <div className="text-[9px] text-neutral-500 uppercase font-bold tracking-widest mt-0.5">
                      {myProfile.role || 'Spieler'}
                    </div>
                    <div className="text-[7.5px] text-mc-gold/80 font-mono mt-0.5">
                      Glow: <span className="font-extrabold underline uppercase">{previewGlow ? `${previewGlow} (Vorschau)` : (myProfile.activeGlow || 'KEINS')}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-6 scroll-smooth overscroll-contain min-h-0 custom-scrollbar space-y-12">
              {showMyItems ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                    <h4 className="text-xs font-black uppercase tracking-widest text-mc-blue">Meine Sammlung</h4>
                    <Package size={14} className="text-mc-blue" />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pt-2">
                    {myPurchases.map((p, i) => {
                      const lowerName = (p.itemName || '').toLowerCase();
                      let rarityName = 'Gewöhnlich';
                      let rarityBorder = 'border-slate-700 bg-slate-900/90 text-slate-300';
                      let rarityGrad = 'from-slate-800 to-slate-950';
                      let rarityTextColor = 'text-slate-300';
                      let rarityLabelColor = 'bg-slate-500';
                      let elixirCost = 3;
                      let cardIcon = '⚔️';

                      if (lowerName.includes('iridium') || lowerName.includes('quantum') || lowerName.includes('tesla')) {
                        rarityName = 'Legendär';
                        rarityBorder = 'border-amber-400 border-2 shadow-[0_0_15px_rgba(245,158,11,0.55)]';
                        rarityGrad = 'from-amber-650 via-rose-650 to-indigo-950';
                        rarityTextColor = 'text-amber-300 font-extrabold';
                        rarityLabelColor = 'bg-amber-600';
                        elixirCost = 5;
                        cardIcon = '👑';
                      } else if (lowerName.includes('dia') || lowerName.includes('nano') || lowerName.includes('power')) {
                        rarityName = 'Episch';
                        rarityBorder = 'border-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.35)]';
                        rarityGrad = 'from-purple-900 to-indigo-950';
                        rarityTextColor = 'text-purple-300';
                        rarityLabelColor = 'bg-purple-650';
                        elixirCost = 4;
                        cardIcon = '🔮';
                      } else if (lowerName.includes('iron') || lowerName.includes('gold') || lowerName.includes('miner')) {
                        rarityName = 'Selten';
                        rarityBorder = 'border-orange-400';
                        rarityGrad = 'from-orange-950 to-neutral-900';
                        rarityTextColor = 'text-orange-300';
                        rarityLabelColor = 'bg-orange-600';
                        elixirCost = 3;
                        cardIcon = '🛡️';
                      } else {
                        rarityName = 'Gewöhnlich';
                        rarityBorder = 'border-zinc-700';
                        rarityGrad = 'from-zinc-800 to-zinc-950';
                        rarityTextColor = 'text-zinc-450';
                        rarityLabelColor = 'bg-zinc-650';
                        elixirCost = 2;
                        cardIcon = '🪵';
                      }

                      // Emojis mapping
                      if (lowerName.includes('pick') || lowerName.includes('hacke') || lowerName.includes('spitz')) cardIcon = '⛏️';
                      else if (lowerName.includes('solar')) cardIcon = '☀️';
                      else if (lowerName.includes('wind')) cardIcon = '💨';
                      else if (lowerName.includes('miner')) cardIcon = '⚙️';
                      else if (lowerName.includes('armor') || lowerName.includes('rüstung')) cardIcon = '👕';
                      else if (lowerName.includes('pack')) cardIcon = '🚀';

                      const mockLvl = (i % 4) + 6;
                      const progressRatio = ((i * 19) % 75) + 15;

                      return (
                        <div 
                          key={`purchase-${p.id || `pur-${i}`}-${i}`} 
                          className={`relative select-none rounded-xl p-[2px] transition-all duration-300 hover:scale-105 active:scale-95 ${rarityBorder} cursor-pointer group`}
                        >
                          {/* Outer gradient background */}
                          <div className={`rounded-[10px] p-3 h-full flex flex-col justify-between bg-gradient-to-b ${rarityGrad} text-white`}>
                            {/* Elixir Drop Cost badge */}
                            <div className="absolute -top-2 -left-2 w-7 h-7 rounded-full bg-pink-600 border-2 border-white flex items-center justify-center font-black text-[10px] shadow-sm shadow-black text-white z-10">
                              {elixirCost}💧
                            </div>

                            {/* Rarity Label Badge */}
                            <div className="absolute top-2 right-2">
                              <span className={`text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full ${rarityLabelColor} text-white shadow-xs shadow-black`}>
                                {rarityName}
                              </span>
                            </div>

                            {/* Center portrait view */}
                            <div className="my-3 flex flex-col items-center justify-center">
                              <div className="w-14 h-14 rounded-full bg-neutral-950/60 border border-white/20 flex items-center justify-center text-3xl shadow-inner group-hover:scale-110 transition-transform duration-300">
                                {cardIcon}
                              </div>
                            </div>

                            {/* Stats & Upgrade Meter */}
                            <div className="space-y-1 bg-black/70 p-2 rounded-lg border border-white/5 backdrop-blur-xs">
                              <div className={`text-[11px] font-black truncate text-center uppercase tracking-tight ${rarityTextColor}`}>
                                {p.itemName}
                              </div>
                              <div className="text-[7px] text-zinc-400 text-center uppercase tracking-widest leading-none">
                                {p.category}
                              </div>

                              {/* Card progression upgrade bar */}
                              <div className="mt-1 space-y-0.5">
                                <div className="flex justify-between items-center text-[7px] font-bold">
                                  <span className="text-mc-gold font-black">LVL {mockLvl}</span>
                                  <span className="text-mc-green font-black">{progressRatio}/100</span>
                                </div>
                                <div className="w-full h-1 bg-neutral-900 rounded-full overflow-hidden border border-white/5">
                                  <div 
                                    className="h-full bg-gradient-to-r from-emerald-500 to-green-400 rounded-full" 
                                    style={{ width: `${progressRatio}%` }}
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Date footprint inside cards */}
                            <div className="text-[6px] text-center text-white/30 font-mono mt-1">
                              BOUGHT: {p.boughtAt?.toDate() ? p.boughtAt.toDate().toLocaleDateString('de-DE') : 'AKTIV'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {myPurchases.length === 0 && (
                      <div className="col-span-full text-center py-20 opacity-20">
                        <ShoppingBag size={48} className="mx-auto mb-4" />
                        <p className="text-xs font-bold uppercase tracking-widest">Du hast noch nichts gekauft</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : showLogs && isAdmin ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                    <h4 className="text-xs font-black uppercase tracking-widest text-mc-red">Verkaufs-Protokoll</h4>
                    <Activity size={14} className="text-mc-red animate-pulse" />
                  </div>
                  <div className="space-y-2">
                    {shopLogs.map((log, i) => (
                      <div key={`shop-log-${log.id || `log-${i}`}-${i}`} className="p-3 bg-neutral-900/50 rounded-lg border border-neutral-800 flex justify-between items-center group">
                        <div>
                          <div className="text-xs font-bold text-white group-hover:text-mc-gold transition-colors">{log.userName}</div>
                          <div className="text-[10px] text-neutral-500">{log.itemName}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-black text-mc-gold">-{log.price} C</div>
                          <div className="text-[9px] text-neutral-600">
                            {log.createdAt?.toDate().toLocaleTimeString('de-DE')}
                          </div>
                        </div>
                      </div>
                    ))}
                    {shopLogs.length === 0 && (
                      <div className="text-center py-10 text-neutral-600 italic text-xs">Noch keine Verkäufe verzeichnet.</div>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {/* Premium Featured Section */}
                  <div className="relative p-8 rounded-[2.5rem] bg-gradient-to-br from-mc-gold/20 via-black to-black border-2 border-mc-gold/30 overflow-hidden group">
                    <div className="absolute top-0 right-0 p-12 opacity-5 scale-150 rotate-12 group-hover:rotate-0 transition-all duration-1000">
                      <Star size={200} className="text-mc-gold" />
                    </div>
                    <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
                      <div className="w-40 h-40 bg-mc-gold rounded-3xl flex items-center justify-center shadow-[0_0_50px_rgba(255,170,0,0.3)] shrink-0">
                         <Crown size={80} className="text-black" />
                      </div>
                      <div className="text-center md:text-left space-y-4">
                        <span className="bg-mc-gold text-black text-[10px] px-4 py-1 rounded-full font-black uppercase tracking-widest">Empfehlung der Admins</span>
                        <h2 className="text-4xl font-black text-white italic tracking-tighter leading-tight">DER MVP RANG<br/><span className="text-mc-gold">MAXIMALE POWER</span></h2>
                        <p className="text-neutral-400 text-sm max-w-md font-medium leading-relaxed italic">
                          Hol dir den ultimativen Rang und starte jeden Tag mit <span className="text-mc-gold font-black">5.000 Coins Bonus</span>. Inklusive exklusivem Prefix & Chat-Farben!
                        </p>
                        <div className="pt-2">
                          <button 
                            onClick={() => {
                              const mvp = shopItems.find(i => i.name === 'MVP Rang');
                              if (mvp) buyItem(mvp);
                              else alert("MVP Rang Item wurde noch nicht generiert! Klicke unten auf 'Beispiel-Katalog Generieren'");
                            }}
                            className="bg-mc-gold text-black px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white hover:scale-105 transition-all shadow-xl shadow-mc-gold/20"
                          >
                            Jetzt Sichern
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Top Stats Cards */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="mc-card p-6 border-neutral-800 flex items-center justify-between group overflow-hidden relative">
                      <div className="absolute inset-0 bg-mc-gold/[0.02] opacity-0 group-hover:opacity-100 transition-opacity" />
                       <div>
                         <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-1">Guthaben</p>
                         <span className="text-2xl font-black text-mc-gold italic">{(myProfile?.coins || 0).toLocaleString()}</span>
                       </div>
                       <div className="p-3 bg-mc-gold/10 text-mc-gold rounded-xl group-hover:scale-110 transition-transform"><Coins size={24} /></div>
                    </div>
                    <div className="mc-card p-6 border-neutral-800 flex items-center justify-between group overflow-hidden relative">
                      <div className="absolute inset-0 bg-blue-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity" />
                       <div>
                         <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-1">Deine Keys</p>
                         <span className="text-2xl font-black text-mc-blue italic">{(myProfile?.inventory?.keys || 0)}</span>
                       </div>
                       <div className="p-3 bg-mc-blue/10 text-mc-blue rounded-xl group-hover:scale-110 transition-transform"><Key size={24} /></div>
                    </div>
                  </div>

                  <div className="space-y-12">
                    {/* Rank Status Info */}
                    {myProfile?.role && myProfile.role !== 'Spieler' && (
                    <div className="p-4 bg-mc-gold/10 border border-mc-gold/20 rounded-2xl flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-mc-gold/20 flex items-center justify-center shadow-[0_0_20px_rgba(255,170,0,0.2)]">
                        <Award size={24} className="text-mc-gold" />
                      </div>
                      <div>
                        <div className="text-[10px] uppercase font-black tracking-widest text-mc-gold">Aktivierter Rang</div>
                        <div className="text-xl font-black text-white">{myProfile.role === 'Owner' ? 'Admin' : myProfile.role}</div>
                        <div className="text-[9px] text-neutral-400 mt-1 italic">Vorteil: Erhöhter Daily-Bonus aktiviert!</div>
                      </div>
                    </div>
                  )}

                  {myProfile?.purchasedRank && (
                    <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.2)]">
                        <Award size={24} className="text-purple-400" />
                      </div>
                      <div>
                        <div className="text-[10px] uppercase font-black tracking-widest text-purple-400">Erworbener Rang</div>
                        <div className="text-xl font-black text-white">{myProfile.purchasedRank}</div>
                        <div className="text-[9px] text-neutral-400 mt-1 italic">Vorteil: Dieser Rang wird im Chat angezeigt!</div>
                      </div>
                    </div>
                  )}

                  {['Ränge', 'Farben', 'Ausrüstung', 'Items', 'Vorteile', 'Boxen'].map((cat, catIdx) => {
                    const items = shopItems.filter(i => i.category === cat);
                    if (items.length === 0 && !isAdmin) return null;
                    
                    return (
                      <div key={`shop-cat-${cat}-${catIdx}`} className="space-y-5">
                        <div className="flex items-center gap-3">
                          <div className="p-1.5 bg-mc-gold/10 rounded-lg border border-mc-gold/20">
                            {cat === 'Ränge' && <Award size={16} className="text-mc-gold" />}
                            {cat === 'Farben' && <Sparkles size={16} className="text-mc-gold" />}
                            {cat === 'Ausrüstung' && <Pickaxe size={16} className="text-mc-gold" />}
                            {cat === 'Items' && <Sword size={16} className="text-mc-gold" />}
                            {cat === 'Vorteile' && <Zap size={16} className="text-mc-gold" />}
                            {cat === 'Boxen' && <Box size={16} className="text-mc-gold" />}
                          </div>
                          <h4 className="text-xs uppercase font-black text-white tracking-[0.25em]">{cat}</h4>
                          <div className="h-px flex-1 bg-gradient-to-r from-neutral-800 to-transparent" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {items.length === 0 && isAdmin && (
                            <button 
                              onClick={seedShop}
                              className="text-center py-8 opacity-20 text-[10px] uppercase tracking-[0.3em] border-2 border-dashed border-neutral-800 rounded-2xl font-bold hover:opacity-100 hover:border-mc-gold/50 transition-all flex flex-col items-center gap-2 group mt-4"
                            >
                              <Plus className="group-hover:scale-125 transition-transform" />
                              Beispiel-Items generieren
                            </button>
                          )}
                          {items.map((item, itemIdx) => {
                            const isOwnRank = item.category === 'Ränge' && myProfile?.role === item.name.replace(' Rang', '').trim();
                            
                            const getColorKeyFromItemName = (name: string) => {
                              const n = name.replace(' Glühen', '').toLowerCase();
                              return n === 'rotes' ? 'red' :
                                     n === 'blaues' ? 'blue' :
                                     n === 'goldenes' ? 'gold' :
                                     n === 'grünes' ? 'green' :
                                     n === 'lila' ? 'purple' :
                                     n === 'regenbogen' ? 'rainbow' : 'none';
                            };

                            const checkOwned = () => {
                              if (!myProfile) return false;
                              if (item.category === 'Ränge') {
                                const roleName = item.name.replace(' Rang', '').trim();
                                return myProfile.role === roleName || 
                                       myProfile.purchasedRank === roleName || 
                                       (myProfile.purchasedRanks || []).includes(roleName);
                              }
                              if (item.category === 'Farben') {
                                const colorKey = getColorKeyFromItemName(item.name);
                                return (myProfile.ownedColors || ['none']).includes(colorKey);
                              }
                              return false;
                            };

                            const isOwned = checkOwned();
                            const isOwnColor = item.category === 'Farben' && (myProfile?.ownedColors || ['none']).includes(getColorKeyFromItemName(item.name));
                            const colorKey = item.category === 'Farben' ? getColorKeyFromItemName(item.name) : 'none';
                            const isActiveColor = item.category === 'Farben' && myProfile?.activeGlow === colorKey;
                            
                            return (
                              <motion.div 
                                key={`shop-item-${item.id || itemIdx}-${itemIdx}`} 
                                whileHover={{ y: -4, scale: 1.01 }}
                                onMouseEnter={() => {
                                  if (item.category === 'Farben') {
                                    setPreviewGlow(getColorKeyFromItemName(item.name));
                                  }
                                }}
                                onMouseLeave={() => {
                                  if (item.category === 'Farben') {
                                    setPreviewGlow(null);
                                  }
                                }}
                                className={`mc-card p-5 border-neutral-800 hover:border-mc-gold/50 transition-all group relative overflow-hidden bg-gradient-to-br from-neutral-900/40 to-black select-none ${item.price >= 10000 ? 'border-l-4 border-l-mc-gold' : ''} ${(isOwnRank || isOwnColor) ? 'border-mc-gold/50 bg-gradient-to-br from-mc-gold/5 to-black shadow-[0_0_20px_rgba(255,170,0,0.1)]' : ''}`}
                              >
                                <div className="flex justify-between items-start mb-4 relative z-10">
                                  <div className="space-y-1.5">
                                    <div className="flex items-center gap-2">
                                      <h5 className={`font-black text-lg transition-colors ${(item.price >= 25000 || item.name.includes('MVP')) ? 'text-mc-gold' : item.name.includes('VIP') ? 'text-purple-400' : 'text-gray-100 group-hover:text-mc-gold'}`}>
                                        {item.name}
                                      </h5>
                                      {(item.price >= 25000 || item.name.includes('MVP')) ? (
                                        <span className="bg-mc-gold text-black text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter shadow-[0_0_15px_rgba(255,170,0,0.4)] border border-yellow-300/50">LEGENDÄR</span>
                                      ) : (item.price >= 5000 || item.name.includes('VIP')) ? (
                                        <span className="bg-purple-500/20 text-purple-400 text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.3)]">VIP ELITE</span>
                                      ) : null}
                                      {((item.category === 'Ränge' && isOwnRank) || (item.category === 'Farben' && isActiveColor)) && (
                                        <span className="bg-white text-black text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter shadow-[0_0_10px_rgba(255,255,255,0.3)]">AKTIV</span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-neutral-400 leading-snug max-w-[260px] font-medium italic opacity-80">
                                      {item.description}
                                    </p>
                                  </div>
                                  
                                  <div className="flex flex-col items-end gap-3 translate-x-2 group-hover:translate-x-0 transition-transform">
                                    <div className="flex items-center gap-1 group/admin">
                                      {isAdmin && (
                                        <>
                                          <button 
                                            onClick={() => editShopItem(item)}
                                            className="text-blue-500/30 hover:text-blue-400 transition-all p-1.5 bg-blue-500/5 rounded-lg border border-blue-500/0 hover:border-blue-500/20"
                                            title="Bearbeiten"
                                          >
                                            <Edit2 size={12} />
                                          </button>
                                          <button 
                                            onClick={() => deleteShopItem(item.id)}
                                            className="text-red-500/30 hover:text-red-500 transition-all p-1.5 bg-red-500/5 rounded-lg border border-red-500/0 hover:border-red-500/20"
                                            title="Löschen"
                                          >
                                            <Trash2 size={12} />
                                          </button>
                                        </>
                                      )}
                                    </div>
                                    
                                    <div className="relative group/btn">
                                      {item.category === 'Farben' && isOwned ? (
                                        <button 
                                          onClick={() => equipColor(colorKey)}
                                          disabled={isActiveColor}
                                          className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all shadow-xl active:scale-95 flex items-center gap-2 border-b-4 ${
                                            isActiveColor 
                                              ? 'bg-neutral-800 text-neutral-500 border-neutral-900 cursor-not-allowed opacity-[0.65]' 
                                              : 'bg-mc-blue text-white border-mc-blue/40 hover:bg-white hover:text-black hover:border-white hover:-translate-y-0.5'
                                          }`}
                                        >
                                          {isActiveColor ? 'AKTIVIERT' : 'AUSRÜSTEN'}
                                        </button>
                                      ) : (
                                        <button 
                                          onClick={() => buyItem(item)}
                                          disabled={isOwned || !myProfile || (myProfile?.coins || 0) < item.price}
                                          className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all shadow-xl active:scale-95 flex items-center gap-2 border-b-4 ${isOwned ? 'bg-neutral-800 text-neutral-500 border-neutral-900 cursor-not-allowed opacity-[0.65]' : (!myProfile || (myProfile?.coins || 0) < item.price) ? 'bg-neutral-800 text-neutral-500 border-neutral-900 cursor-not-allowed opacity-50' : 'bg-mc-gold text-black border-mc-gold/40 hover:bg-white hover:border-white hover:-translate-y-0.5'}`}
                                        >
                                          {isOwned ? (item.category === 'Ränge' ? 'ERWORBEN' : 'AKTIVIERT') : item.price.toLocaleString()} {!isOwned && <Coins size={12} />}
                                        </button>
                                      )}
                                      {myProfile && (myProfile?.coins || 0) < item.price && !isOwned && (
                                        <div className="absolute bottom-full right-0 mb-2 bg-mc-red text-white text-[9px] px-2 py-1 rounded shadow-lg opacity-0 group-hover/btn:opacity-100 whitespace-nowrap transition-opacity pointer-events-none font-bold uppercase tracking-widest border border-red-500">
                                          Nicht genug Coins!
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                          
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-neutral-800/30">
                             <div className="flex items-center gap-1.5">
                                <div className={`w-2 h-2 rounded-full ${item.price > 10000 ? 'bg-mc-gold animate-pulse' : 'bg-green-500'}`} />
                                <span className={`text-[9px] uppercase font-black tracking-[0.1em] ${item.price > 10000 ? 'text-mc-gold' : 'text-neutral-500'}`}>
                                  {item.price > 10000 ? 'Legendärer Gegenstand' : 'Verfügbar'}
                                </span>
                             </div>
                             <div className="flex items-center gap-1 opacity-20 hover:opacity-100 transition-opacity cursor-help">
                               <Info size={10} className="text-white" />
                               <span className="text-[8px] text-neutral-400 font-mono">UID:{item.id.slice(0,4)}</span>
                             </div>
                          </div>

                          {/* Glow Effects */}
                          <div className={`absolute top-0 right-0 w-32 h-32 blur-3xl -mr-16 -mt-16 transition-all duration-700 opacity-20 pointer-events-none ${item.price >= 10000 ? 'bg-mc-gold' : 'bg-mc-blue'}`} />
                          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-mc-gold/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  </motion.div>
)}
</AnimatePresence>

      {/* AI Oracle Drawer */}
      <AnimatePresence>
        {isAiOpen && (
          <div key="ai-oracle-wrapper" className="fixed inset-0 z-[120] flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAiOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-lg bg-neutral-900 border-l border-neutral-800 h-full flex flex-col shadow-2xl"
            >
              <div className="p-6 border-b border-neutral-800 flex items-center justify-between bg-black/40">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-mc-gold/20 flex items-center justify-center shadow-[0_0_20px_rgba(255,170,0,0.2)]">
                    <Sparkles className="text-mc-gold" size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white italic tracking-tighter">DAS SCHARFE ORAKEL</h3>
                    <p className="text-[10px] text-mc-gold font-bold uppercase tracking-[0.3em]">AI-Powered Wisdom</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsAiOpen(false)}
                  className="p-3 hover:bg-white/5 rounded-xl transition-colors text-neutral-500 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 scroll-smooth space-y-6 custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]">
                {aiHistory.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center py-12 px-4">
                     <Brain size={64} className="mb-4 text-mc-gold animate-pulse opacity-80" />
                     <p className="text-xl font-black italic text-neutral-100">Befrage das weise Orakel...</p>
                     <p className="max-w-[320px] text-[10px] uppercase font-bold tracking-widest mt-2 text-neutral-400">
                       Frag mich nach Geheimnissen, Minecraft-Tipps oder wie du im Dashboard aufsteigst!
                     </p>
                     
                     <div className="mt-8 w-full max-w-sm space-y-3">
                        <p className="text-[10px] uppercase font-black tracking-[0.2em] text-mc-gold animate-pulse">Schnellvorschläge:</p>
                        <div className="grid grid-cols-2 gap-2.5">
                           {[
                              { label: "🏰 Bauideen", prompt: "Gib mir 3 epische Bauideen für meine Survival Base" },
                              { label: "🪙 Mehr Münzen", prompt: "Wie kann ich hier am schnellsten Coins verdienen?" },
                              { label: "⚔️ Server Welten", prompt: "Erkläre mir die Welten PVP und Survival" },
                              { label: "🚀 Updates & News", prompt: "Gib mir die aktuellsten Server-Neuigkeiten" },
                           ].map((item, idx) => (
                              <button
                                 key={idx}
                                 type="button"
                                 onClick={() => handleAiChat(item.prompt)}
                                 className="p-3 text-left rounded-xl border border-neutral-800 bg-neutral-900/80 hover:bg-neutral-800 active:scale-95 text-xs font-bold text-neutral-300 hover:text-white hover:border-mc-gold/40 transition-all cursor-pointer flex items-start gap-1.5 shadow-md"
                              >
                                 <Sparkles size={11} className="text-mc-gold mt-1 shrink-0" />
                                 <span>{item.label}</span>
                              </button>
                           ))}
                        </div>
                     </div>
                  </div>
                )}
                {aiHistory.map((msg, i) => (
                  <motion.div 
                    key={`ai-chat-${i}-${msg.role}`}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[85%] rounded-3xl px-5 py-4 ${
                      msg.role === 'user' 
                        ? 'bg-mc-gold text-black font-bold shadow-lg shadow-mc-gold/10' 
                        : 'bg-neutral-800 text-neutral-100 border border-neutral-700/50 shadow-xl'
                    }`}>
                       <div className="markdown-body text-sm leading-relaxed">
                          <ReactMarkdown>{msg.parts[0].text}</ReactMarkdown>
                       </div>
                    </div>
                  </motion.div>
                ))}
                {isAiLoading && (
                  <div className="flex justify-start">
                     <div className="bg-neutral-800 border border-neutral-700/50 rounded-3xl px-6 py-4 flex items-center gap-3">
                        <div className="flex gap-1">
                           <div className="w-1.5 h-1.5 bg-mc-gold rounded-full animate-bounce [animation-delay:-0.3s]" />
                           <div className="w-1.5 h-1.5 bg-mc-gold rounded-full animate-bounce [animation-delay:-0.15s]" />
                           <div className="w-1.5 h-1.5 bg-mc-gold rounded-full animate-bounce" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-mc-gold/50">Orakel fokussiert sich...</span>
                     </div>
                  </div>
                )}
                <div ref={aiChatEndRef} />
              </div>

              <div className="p-6 bg-black/60 border-t border-neutral-800">
                <form 
                  onSubmit={(e) => { e.preventDefault(); handleAiChat(); }}
                  className="relative group"
                >
                  <input 
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    placeholder="Frag das Orakel..."
                    className="w-full bg-neutral-900 border-2 border-neutral-800 rounded-2xl py-5 px-6 pr-16 text-white focus:border-mc-gold transition-all outline-none group-focus-within:shadow-[0_0_30px_rgba(255,170,0,0.1)]"
                  />
                  <button 
                    disabled={isAiLoading || !aiInput.trim()}
                    type="submit"
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-xl bg-mc-gold text-black flex items-center justify-center hover:scale-105 active:scale-95 disabled:opacity-50 disabled:grayscale transition-all shadow-lg"
                  >
                     <Send size={20} />
                  </button>
                </form>
                <p className="text-center text-[9px] text-neutral-600 mt-4 uppercase font-bold tracking-tighter">KI kann Fehler machen. Überprüfe wichtige Informationen.</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Leaderboard Modal */}
      <AnimatePresence>
        {leaderboardOpen && (
          <motion.div 
            key="leaderboard-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            onClick={(e) => { if (e.target === e.currentTarget) setLeaderboardOpen(false); }}
          >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="w-full max-w-2xl bg-neutral-900 border border-mc-gold/30 rounded-[2rem] overflow-hidden shadow-[0_0_100px_rgba(255,170,0,0.1)] flex flex-col max-h-[85vh]"
              >
                {/* Header */}
                <div className="p-8 bg-gradient-to-r from-mc-gold/10 via-transparent to-mc-gold/5 flex items-center justify-between border-b border-white/5">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-mc-gold rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(255,170,0,0.4)]">
                      <Trophy size={28} className="text-black" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-none">Globales Leaderboard</h2>
                      <p className="text-[10px] text-mc-gold/60 font-bold uppercase tracking-widest mt-1 italic">
                        {leaderboardTab === 'quiz' 
                          ? 'Wer hat die meisten Fragen gelöst?' 
                          : leaderboardTab === 'transactions' 
                            ? 'Lückenloses Audit-Protokoll & globale Statistiken' 
                            : 'Wer sind die reichsten Spieler?'}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setLeaderboardOpen(false)}
                    className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors border border-white/10"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Horizontal Category Switcher */}
                <div className="px-8 py-3 border-b border-white/5 bg-black/40 flex flex-wrap gap-2 md:gap-4">
                  <button
                    onClick={() => {
                      setLeaderboardTab('coins');
                      fetchLeaderboard('coins');
                    }}
                    className={`flex-1 py-2.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border whitespace-nowrap ${
                      leaderboardTab === 'coins'
                        ? 'bg-mc-gold/20 border-mc-gold text-mc-gold shadow-[0_0_15px_rgba(255,170,0,0.15)]'
                        : 'bg-transparent border-transparent text-neutral-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    🪙 Münzen
                  </button>
                  <button
                    onClick={() => {
                      setLeaderboardTab('quiz');
                      fetchLeaderboard('quiz');
                    }}
                    className={`flex-1 py-2.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border whitespace-nowrap ${
                      leaderboardTab === 'quiz'
                        ? 'bg-mc-gold/20 border-mc-gold text-mc-gold shadow-[0_0_15px_rgba(255,170,0,0.15)]'
                        : 'bg-transparent border-transparent text-neutral-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    💡 Quiz-Siege
                  </button>
                  <button
                    onClick={() => {
                      setLeaderboardTab('transactions');
                      fetchLeaderboard('transactions');
                    }}
                    className={`flex-1 py-2.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border whitespace-nowrap ${
                      leaderboardTab === 'transactions'
                        ? 'bg-mc-gold/20 border-mc-gold text-mc-gold shadow-[0_0_15px_rgba(255,170,0,0.15)]'
                        : 'bg-transparent border-transparent text-neutral-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    💸 Transaktionen
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
                  {leaderboardTab === 'transactions' ? (
                    <div className="space-y-6">
                      {/* Financial Audit Bento Metrics */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-black/40 border border-white/5 p-4 rounded-2xl flex flex-col justify-between shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
                          <span className="text-[8px] font-black uppercase text-neutral-500 tracking-widest leading-none">Umlaufmenge</span>
                          <div className="mt-2 flex items-baseline gap-1">
                            <span className="text-base font-black text-white italic tracking-tighter">
                              {userProfiles.reduce((acc, p) => acc + (p.coins || 0), 0).toLocaleString('de-DE')}
                            </span>
                            <span className="text-[8px] font-bold text-mc-gold uppercase">Coins</span>
                          </div>
                        </div>

                        <div className="bg-black/40 border border-white/5 p-4 rounded-2xl flex flex-col justify-between shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
                          <span className="text-[8px] font-black uppercase text-neutral-500 tracking-widest leading-none">Ø Kontostand</span>
                          <div className="mt-2 flex items-baseline gap-1">
                            <span className="text-base font-black text-white italic tracking-tighter">
                              {userProfiles.length > 0 
                                ? Math.round(userProfiles.reduce((acc, p) => acc + (p.coins || 0), 0) / userProfiles.length).toLocaleString('de-DE') 
                                : '0'
                              }
                            </span>
                            <span className="text-[8px] font-bold text-mc-gold uppercase">Coins</span>
                          </div>
                        </div>

                        <div className="bg-black/40 border border-white/5 p-4 rounded-2xl flex flex-col justify-between shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
                          <span className="text-[8px] font-black uppercase text-neutral-500 tracking-widest leading-none">Transaktionen</span>
                          <div className="mt-2 flex items-baseline gap-1">
                            <span className="text-base font-black text-white italic tracking-tighter">
                              {transactionsList.length.toLocaleString('de-DE')}
                            </span>
                            <span className="text-[8px] font-bold text-blue-400 uppercase">Audit-Logs</span>
                          </div>
                        </div>

                        <div className="bg-black/40 border border-white/5 p-4 rounded-2xl flex flex-col justify-between shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
                          <span className="text-[8px] font-black uppercase text-neutral-500 tracking-widest leading-none">Max. Transfer</span>
                          <div className="mt-2 flex items-baseline gap-1">
                            <span className="text-base font-black text-white italic tracking-tighter">
                              {transactionsList.length > 0 
                                ? Math.max(...transactionsList.map(t => t.amount || 0)).toLocaleString('de-DE') 
                                : '0'
                              }
                            </span>
                            <span className="text-[8px] font-bold text-mc-gold uppercase">Coins</span>
                          </div>
                        </div>
                      </div>

                      {/* Filter Search Input */}
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Audit-Protokoll durchsuchen (Sender, Empfänger, TX-ID)..."
                          value={txSearchQuery}
                          onChange={(e) => setTxSearchQuery(e.target.value)}
                          className="w-full bg-black/40 border border-white/5 rounded-2xl py-3 pl-11 pr-4 text-xs font-bold text-white placeholder-neutral-500 focus:outline-none focus:border-mc-gold/30 focus:bg-black/60 transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]"
                        />
                        <Search size={16} className="absolute left-4 top-3.5 text-neutral-500" />
                        {txSearchQuery && (
                          <button 
                            onClick={() => setTxSearchQuery('')} 
                            className="absolute right-4 top-3.5 text-mc-gold hover:text-white text-[9px] font-black uppercase tracking-widest"
                          >
                            Zurücksetzen
                          </button>
                        )}
                      </div>

                      {/* Transactions Audit List */}
                      <div className="space-y-2">
                        {transactionsList.filter(t => {
                          const queryVal = txSearchQuery.toLowerCase().trim();
                          if (!queryVal) return true;
                          return (t.senderName || '').toLowerCase().includes(queryVal) ||
                                 (t.receiverName || '').toLowerCase().includes(queryVal) ||
                                 (t.trackingId || '').toLowerCase().includes(queryVal);
                        }).length === 0 ? (
                          <div className="py-12 bg-black/20 rounded-2xl border border-white/5 text-center">
                            <Activity className="mx-auto text-neutral-600 mb-2 animate-pulse" size={24} />
                            <p className="text-neutral-500 text-[10px] uppercase font-black tracking-widest">Keine Transaktionen gefunden</p>
                          </div>
                        ) : (
                          transactionsList
                            .filter(t => {
                              const queryVal = txSearchQuery.toLowerCase().trim();
                              if (!queryVal) return true;
                              return (t.senderName || '').toLowerCase().includes(queryVal) ||
                                     (t.receiverName || '').toLowerCase().includes(queryVal) ||
                                     (t.trackingId || '').toLowerCase().includes(queryVal);
                            })
                            .map((tx, idx) => (
                              <motion.div
                                key={tx.id || `tx-${idx}`}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.03 }}
                                className="bg-black/30 border border-white/5 p-4 rounded-2xl hover:border-white/10 transition-colors flex items-center justify-between gap-4"
                              >
                                <div className="flex items-center gap-3">
                                  {/* Icon indicator */}
                                  <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center border border-white/5 text-neutral-400">
                                    <Activity size={16} className="text-mc-gold" />
                                  </div>

                                  <div className="flex flex-col">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-xs font-black uppercase text-white tracking-tight">{tx.senderName}</span>
                                      <span className="text-[9px] text-neutral-600 font-bold uppercase tracking-widest">an</span>
                                      <span className="text-xs font-black uppercase text-mc-gold tracking-tight">{tx.receiverName}</span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className="text-[8px] font-mono text-neutral-500 bg-neutral-800/50 px-1.5 py-0.5 rounded tracking-widest uppercase">
                                        {tx.trackingId || 'TX-GENERIC'}
                                      </span>
                                      <span className="text-[8px] text-neutral-500 font-bold">
                                        {tx.createdAt ? new Date(tx.createdAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Gerade eben'}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex flex-col items-end">
                                  <span className="text-sm font-black text-white italic tracking-tighter flex items-center gap-1">
                                    {tx.amount?.toLocaleString('de-DE')} <span className="text-mc-gold text-[10px] not-italic font-black">C</span>
                                  </span>
                                  <span className="text-[7px] text-neutral-600 uppercase font-black tracking-widest">Überwiesen</span>
                                </div>
                              </motion.div>
                            ))
                        )}
                      </div>
                    </div>
                  ) : leaderboardData.length === 0 ? (
                    <div className="py-20 text-center">
                      <RefreshCw className="mx-auto text-mc-gold/20 animate-spin mb-4" size={40} />
                      <p className="text-neutral-500 uppercase font-black text-xs tracking-widest">Lade Daten aus dem Multiversum...</p>
                    </div>
                  ) : (
                    leaderboardData.map((profile, idx) => (
                      <motion.div 
                        key={`leaderboard-item-${profile.userId || profile.minecraftUsername || `idx-${idx}`}-${idx}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className={`flex items-center justify-between p-4 rounded-2xl border transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
                          profile.activeGlow && profile.activeGlow !== 'none'
                            ? getGlowStyles(profile.activeGlow)
                            : profile.userId === user?.uid 
                              ? 'bg-mc-gold/20 border-mc-gold shadow-[0_0_30px_rgba(255,170,0,0.1)]' 
                              : 'bg-black/40 border-white/5 hover:border-mc-gold/30'
                        }`}
                        onClick={() => {
                          setEditingProfileId(profile.userId);
                          setShowProfileModal(true);
                          setLeaderboardOpen(false);
                        }}
                      >
                        <div className="flex items-center gap-4">
                          {/* Rank indicator */}
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${
                            idx === 0 ? 'bg-mc-gold text-black shadow-[0_0_15px_rgba(255,170,0,0.5)]' :
                            idx === 1 ? 'bg-neutral-300 text-black' :
                            idx === 2 ? 'bg-orange-400 text-black' :
                            'bg-neutral-800 text-neutral-500'
                          }`}>
                            #{idx + 1}
                          </div>
                          
                          {/* Avatar */}
                          <div className="relative">
                            <img 
                              src={profile.customSkin || `https://mc-heads.net/avatar/${profile.minecraftUsername || profile.displayName}/64`} 
                              alt="Avatar"
                              className="w-10 h-10 rounded-xl"
                            />
                            {profile.isOnline && (
                              <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-500 border-2 border-neutral-900 rounded-full" />
                            )}
                          </div>
                          
                          {/* Name & Role */}
                          <div className="flex flex-col">
                            <span className={`font-black uppercase tracking-tight text-sm ${profile.userId === user?.uid ? 'text-mc-gold' : 'text-white'}`}>
                              {profile.displayName || 'Unbekannt'}
                            </span>
                            <span className="text-[9px] text-neutral-500 uppercase font-black tracking-widest">
                              {profile.role || 'Member'}
                            </span>
                          </div>
                        </div>

                        {/* Coins / Quiz Wins */}
                        <div className="flex flex-col items-end">
                          <div className="flex items-center gap-2">
                            <span className="text-xl font-black text-white italic tracking-tighter">
                              {leaderboardTab === 'quiz'
                                ? (profile.quizWins || 0).toLocaleString('de-DE')
                                : (profile.coins || 0).toLocaleString('de-DE')
                              }
                            </span>
                            {leaderboardTab === 'quiz' ? (
                              <span className="text-mc-gold text-xs font-black drop-shadow-[0_0_8px_rgba(255,170,0,0.55)] tracking-tighter italic">ANSWERS</span>
                            ) : (
                              <Coins size={18} className="text-mc-gold drop-shadow-[0_0_8px_rgba(255,170,0,0.5)]" />
                            )}
                          </div>
                          <span className="text-[8px] text-neutral-600 uppercase font-bold tracking-widest">
                            {leaderboardTab === 'quiz' ? 'Gelöst' : 'Credits'}
                          </span>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>

                {/* Footer Info */}
                <div className="p-6 bg-black/40 border-t border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-[9px] font-black text-neutral-500 uppercase tracking-widest">
                    <History size={14} />
                    Letztes Update: Gerade eben
                  </div>
                  <div className="text-[9px] font-black text-mc-gold uppercase tracking-widest">
                    Zählt Gesamte Coins im System
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      {/* Chat Drawer */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div 
            key="chat-drawer"
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="fixed inset-y-0 right-0 w-full sm:w-[400px] bg-black/95 backdrop-blur-xl z-[70] border-l border-neutral-800 shadow-2xl flex flex-col pt-20"
          >
            <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <MessageCircle className={`${chatChannel === 'quiz' ? 'text-mc-gold' : chatChannel === 'bilder' ? 'text-blue-500' : 'text-mc-red'}`} />
                  {chatChannel === 'quiz' ? 'Quiz-Chatroom' : chatChannel === 'bilder' ? 'Bilder-Galerie' : 'Community Chat'}
                </h3>
                <p className="text-neutral-500 text-xs">
                  {chatChannel === 'quiz' ? 'Löse Fragen und erhalte Coins!' : chatChannel === 'bilder' ? 'Teile Bilder und Memes mit der Community' : 'Schreibe mit anderen Spielern'}
                </p>
              </div>
              <button 
                onClick={() => setChatOpen(false)}
                className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
                title="Schließen"
              >
                <X size={24} />
              </button>
            </div>

            {/* CHANNEL TOGGLE BUTTONS */}
            <div className="flex bg-neutral-950/60 border-b border-white/5 p-2 gap-2 relative z-[20] shrink-0">
              <button
                type="button"
                onClick={() => setChatChannel('allgemein')}
                className={`flex-1 py-2 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all rounded-xl border flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 ${
                  chatChannel === 'allgemein'
                    ? 'bg-mc-red/25 border-mc-red text-white shadow-[0_0_20px_rgba(255,0,0,0.2)] font-black'
                    : 'bg-transparent border-transparent text-neutral-400 hover:text-white hover:bg-white/5 font-bold'
                }`}
              >
                <MessageSquare size={14} />
                Allgemein
              </button>
              <button
                type="button"
                onClick={() => setChatChannel('quiz')}
                className={`flex-1 py-2 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all rounded-xl border flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 relative ${
                  chatChannel === 'quiz'
                    ? 'bg-mc-gold/25 border-mc-gold text-mc-gold shadow-[0_0_20px_rgba(255,170,0,0.2)] font-black'
                    : 'bg-transparent border-transparent text-neutral-400 hover:text-white hover:bg-white/5 font-bold'
                }`}
              >
                <Sparkles size={14} />
                Quiz
                {activeQuiz?.active && (
                  <span className="absolute top-1.5 right-3 w-2 h-2 rounded-full bg-mc-gold animate-pulse border border-black" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setChatChannel('bilder')}
                className={`flex-1 py-2 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all rounded-xl border flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 ${
                  chatChannel === 'bilder'
                    ? 'bg-blue-500/25 border-blue-500 text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.2)] font-black'
                    : 'bg-transparent border-transparent text-neutral-400 hover:text-white hover:bg-white/5 font-bold'
                }`}
              >
                <ImageIcon size={14} />
                Bilder
              </button>
            </div>

            {/* Active Quiz Question Banner in Quiz Channel */}
            {chatChannel === 'quiz' && activeQuiz?.active && (
              <div className="m-4 mb-2 p-4 bg-mc-gold/15 border border-mc-gold/30 rounded-2xl flex flex-col gap-2 relative overflow-hidden shrink-0">
                <div className="absolute right-2 -top-1 opacity-10 font-black text-6xl text-mc-gold font-mono pointer-events-none">?</div>
                <div className="flex items-center gap-2 text-mc-gold text-xs font-black uppercase tracking-wider">
                  <Sparkles size={14} className="animate-pulse text-mc-gold shrink-0" />
                  <span>Aktive Quizfrage</span>
                  <span className="ml-auto bg-mc-gold/25 text-mc-gold text-[10px] px-2 py-0.5 rounded-full border border-mc-gold/30">+{activeQuiz.reward || 50} COINS</span>
                </div>
                <p className="font-sans text-sm font-bold text-white leading-relaxed">{activeQuiz.question}</p>
                <span className="text-[10px] text-neutral-400">Gib deine Antwort unten in das Chat-Textfeld ein!</span>
              </div>
            )}
            {chatChannel === 'quiz' && !activeQuiz?.active && (
              <div className="m-4 mb-2 p-4 bg-neutral-900 border border-neutral-800 rounded-2xl flex flex-col gap-2 text-center shrink-0">
                <div className="text-neutral-500 font-bold text-xs uppercase tracking-widest">Keine aktive Quizfrage</div>
                <p className="text-xs text-neutral-400">Warte auf das nächste automatische oder administrative Quiz-Event!</p>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar scroll-smooth">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {filteredMessages.map((msg, idx, arr) => {
                      const prevMsg = arr[idx - 1];
                      const isSameSender = prevMsg && prevMsg.userId === msg.userId && !msg.isAction && !prevMsg.isAction;
                      const isSystem = msg.userId === 'system';
                      const isMe = msg.userId === user?.uid;
                      const displayRole = STAFF_OVERWRITES[msg.displayName] || msg.role;

                      // Use a robust, guaranteed unique key combining id, tempId, and index
                      const uniqueKey = `chat-msg-${msg.id || 'msg'}-${msg.tempId || 'temp'}-${idx}`;

                      return (
                        <motion.div 
                          layout
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          key={uniqueKey} 
                          className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} ${isSameSender ? '-mt-2' : ''}`}
                        >
                        {!isSameSender && (
                          <div className={`flex items-center gap-2 mb-1 px-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${
                              isSystem ? 'text-mc-gold' : 'text-neutral-500'
                            }`}>
                              {msg.displayName}
                            </span>
                            {displayRole && displayRole !== 'Member' && (
                              <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase text-white ${
                                displayRole === 'Owner' ? 'bg-mc-gold shadow-[0_0_10px_rgba(255,170,0,0.3)]' :
                                displayRole === 'Admin' || displayRole === 'Root' ? 'bg-mc-red' : 
                                displayRole === 'Mod' ? 'bg-blue-600' : 
                                'bg-purple-500'
                              }`}>
                                {displayRole}
                              </span>
                            )}
                            {(() => {
                              const senderProf = userProfiles.find(p => p.userId === msg.userId);
                              const rankToShow = (msg.purchasedRank && msg.purchasedRank !== 'undefined') 
                                ? msg.purchasedRank 
                                : senderProf?.purchasedRank;
                                
                              if (rankToShow && rankToShow !== 'undefined') {
                                return (
                                  <span className="text-[8px] px-1.5 py-0.5 rounded font-black uppercase text-white bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.3)]">
                                    {rankToShow}
                                  </span>
                                );
                              }
                              return null;
                            })()}
                            {msg.isLocal && !isSystem && (
                              <span className="text-[8px] px-1.5 py-0.5 rounded font-black uppercase bg-neutral-800 text-neutral-400 border border-neutral-700">
                                Privat
                              </span>
                            )}
                          </div>
                        )}
                        
                        <div className="flex items-end gap-2 group max-w-[85%]">
                          {(isAdmin || isOwner || isSuperAdmin) && (
                            <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => editSingleMessage(msg.id)}
                                className="p-1 hover:text-blue-400 text-neutral-600 transition-colors shrink-0"
                                title="Anpassen"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button 
                                onClick={() => deleteSingleMessage(msg.id)}
                                className="p-1 hover:text-mc-red text-neutral-600 transition-colors shrink-0"
                                title="Löschen"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          )}
                          
                          <div className={`relative px-4 py-2 rounded-2xl text-sm break-words whitespace-pre-wrap transition-all ${
                            msg.isAction ? 'italic text-neutral-400 bg-transparent py-1 px-0 shadow-none border-0' :
                            msg.userId === 'system' ? 'bg-mc-gold/10 border border-mc-gold/20 text-mc-gold' :
                            msg.isLocal ? 'bg-neutral-800 text-neutral-400 opacity-60 border border-neutral-700 border-dashed' :
                            isMe ? 'bg-mc-red text-white shadow-lg shadow-mc-red/15 rounded-tr-sm' : 
                            'bg-neutral-800 text-neutral-100 rounded-tl-sm'
                          }`}>
                            {(() => {
                              let cleanText = msg.text.replace(/§[a-z0-9]/g, '');
                              const undefinedRankPattern = /ist nun offiziell \*\*undefined\*\*/g;
                              if (msg.userId === 'system' && (cleanText.includes('undefined') || undefinedRankPattern.test(cleanText))) {
                                // Versuche den Rang aus dem purchasedRank Feld zu nehmen, falls vorhanden
                                const actualRank = (msg.purchasedRank && msg.purchasedRank !== 'undefined') ? msg.purchasedRank : 'Mitglied';
                                // Replace both bold and non-bold variants
                                cleanText = cleanText.replace(/\*\*undefined\*\*/g, `**${actualRank}**`)
                                                     .replace(/undefined/g, actualRank);
                              }
                              return cleanText;
                            })()}
                            {msg.imageUrl && (
                              <div className="mt-2 mb-1">
                                <img 
                                  src={msg.imageUrl} 
                                  alt="Chat Upload" 
                                  className="w-full max-w-[300px] sm:max-w-[400px] rounded-md shadow-sm border border-white/10 cursor-zoom-in hover:opacity-90 transition-opacity" 
                                  loading="lazy"
                                  onClick={() => setFullscreenImage(msg.imageUrl || null)}
                                />
                              </div>
                            )}
                            {msg.isLocal && (
                              <motion.div 
                                animate={{ rotate: 360 }}
                                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                                className="absolute -right-2 -top-2 bg-neutral-900 rounded-full p-0.5"
                              >
                                <div className="w-2 h-2 border-2 border-mc-red border-t-transparent rounded-full" />
                              </motion.div>
                            )}
                          </div>

                          {/* Deletion button removed here because it's now handled before the message for better consistency */}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              <div ref={chatEndRef} className="h-4" />
              {filteredMessages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-neutral-600 text-center space-y-4">
                   <div className="p-4 bg-neutral-900 rounded-full">
                     <MessageCircle size={32} />
                   </div>
                   <p className="text-xs italic">
                     {chatChannel === 'quiz' ? 'Noch keine Quiz-Antworten gesendet...' : chatChannel === 'bilder' ? 'Noch keine Bilder hochgeladen... teile dein erstes!' : 'Noch keine Nachrichten... fang an zu schreiben!'}
                   </p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-neutral-800 relative">
              {/* QUICK COMMAND MENU */}
              <AnimatePresence>
                {showCommandMenu && (
                  <motion.div 
                    key="command-menu-quick"
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute bottom-full left-6 right-6 mb-2 p-2 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl z-50 grid grid-cols-2 gap-2"
                  >
                    {[
                      { icon: HelpCircle, label: 'Hilfe', cmd: '/help' },
                      { icon: Coins, label: 'Coins', cmd: '/coins' },
                      { icon: Users, label: 'Spieler', cmd: '/list' },
                      { icon: MessageSquare, label: 'Status', cmd: '/me ' },
                      { icon: Scroll, label: 'Regeln', cmd: '/rules' },
                      { icon: Globe, label: 'Discord', cmd: '/discord' },
                    ].map((item, itemIdx) => (
                      <button
                        key={`cmd-menu-${itemIdx}-${item.cmd}`}
                        onClick={() => {
                          setChatInput(item.cmd);
                          setShowCommandMenu(false);
                        }}
                        className="flex items-center gap-3 p-3 hover:bg-neutral-800 rounded-xl transition-colors text-left"
                      >
                        <item.icon size={16} className="text-mc-red" />
                        <span className="text-xs font-medium text-neutral-300">{item.label}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex flex-col gap-2">
                {!navigator.onLine && (
                  <div className="flex items-center gap-2 text-[10px] text-mc-red font-bold uppercase animate-pulse mb-1">
                    <div className="w-1.5 h-1.5 bg-mc-red rounded-full" />
                    Offline - Warte auf Verbindung...
                  </div>
                )}
                
                {/* Gastname Input for non-logged-in users */}
                {!user && (
                  <div className="flex items-center justify-between gap-2 px-1 mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider shrink-0">Gastname:</span>
                      <input
                        type="text"
                        value={chatGuestName}
                        onChange={(e) => {
                          const val = e.target.value.substring(0, 24);
                          localStorage.setItem('suggestions_guest_name', val);
                          setChatGuestName(val);
                        }}
                        placeholder={`Gast-${guestId.substring(6, 12)}`}
                        className="bg-neutral-900 border border-neutral-800 rounded px-2 py-0.5 text-xs text-white outline-none focus:border-mc-red transition-colors w-[130px]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowLoginModal(true)}
                      className="text-[10px] text-mc-gold hover:underline font-bold uppercase tracking-wider"
                    >
                      Anmelden
                    </button>
                  </div>
                )}

                <form onSubmit={sendMessage} className="flex gap-2">
                  <button 
                    type="button"
                    onClick={() => setShowCommandMenu(!showCommandMenu)}
                    className={`p-3 rounded-xl transition-all border ${showCommandMenu ? 'bg-mc-red text-white border-mc-red' : 'bg-neutral-900 text-neutral-500 border-neutral-800 hover:border-neutral-700'}`}
                    title="Schnelle Befehle"
                  >
                    <Command size={20} />
                  </button>
                  <input 
                    type="file"
                    accept="image/*"
                    id="chat-image-upload"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                         try {
                           // Assuming compressAndResizeImage is defined and returns a base64 string
                           const base64 = await compressAndResizeImage(file, 800, 800, 0.6);
                           const fallbackDisp = chatGuestName || 'Gast-' + guestId.substring(6, 12);
                           const resolvedDisp = user ? (myProfile?.displayName || user.displayName || 'Unknown') : fallbackDisp;
                           const resolvedRole = user ? (myProfile?.role || 'Member') : 'Gast';
                           
                           await addDoc(collection(db, 'chat_messages'), {
                             text: '',
                             imageUrl: base64,
                             userId: user ? user.uid : guestId,
                             displayName: resolvedDisp,
                             role: resolvedRole,
                             purchasedRank: user ? (myProfile?.purchasedRank || 'undefined') : '',
                             channel: chatChannel,
                             createdAt: serverTimestamp()
                           });
                           // Reset input so we can select the same file again if needed
                           e.target.value = '';
                         } catch (err) {
                           console.error("Image upload error", err);
                         }
                      }
                    }}
                  />
                  <button 
                    type="button"
                    onClick={() => document.getElementById('chat-image-upload')?.click()}
                    className="p-3 rounded-xl transition-all border bg-neutral-900 text-neutral-500 border-neutral-800 hover:border-neutral-700 hover:text-white"
                    title="Bild hochladen"
                  >
                    <ImageIcon size={20} />
                  </button>
                  <input 
                    type="text" 
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Sende eine Nachricht oder /Befehl..."
                    className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-sm focus:border-mc-red outline-none transition-colors"
                  />
                  <button 
                    type="submit"
                    className="p-3 bg-mc-red rounded-xl hover:bg-mc-red/90 transition-colors"
                  >
                    <ChevronRight size={20} />
                  </button>
                </form>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className={`relative z-10 max-w-7xl mx-auto px-6 py-12 md:py-24 transition-all duration-500 ${isAnyOverlayOpen ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'}`}>

        {/* Hero Section */}
        <div className="max-w-3xl mb-20 text-center mx-auto md:text-left md:mx-0">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-sm font-medium mb-6 transition-all duration-300 ${isPostGlitching ? 'bg-red-950/60 text-mc-red border-red-700/50 animate-[terrifying-shake_0.1s_infinite]' : 'bg-red-500/10 text-mc-red border-red-500/20'}`}>
              <Zap size={14} />
              <span>{isPostGlitching ? "WARNING: HEROBRINE INFESTATION" : "Community Dashboard V2.1 - Echte Daten"}</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold mb-6 leading-tight select-none">
              Bester <br />
              <span className={`text-mc-red transition-all duration-300 inline-block ${isPostGlitching ? 'animate-[chromatic-text_0.1s_infinite] text-6xl md:text-8xl scale-110 font-mono' : ''}`}>
                {isPostGlitching ? "M̵U̵R̵D̵E̸R̸E̶R̵ ̶L̵A̸N̶D̵" : "Minecraft Realm."}
              </span>
            </h1>
            <p className={`text-lg md:text-xl mb-10 max-w-xl text-wrap transition-all duration-300 ${isPostGlitching ? 'text-red-500 saturate-[2.0] animate-pulse font-mono' : 'text-neutral-400'}`}>
              {isPostGlitching 
                ? "Y̸O̸U̶ ̸S̸H̵O̸U̵L̵D̵N̶'̷T̶ ̵H̴A̶V̸E̸ ̸C̶L̴I̴C̵K̵E̵D̸ ̸T̵H̵A̷T̴.̷ ̴N̶O̶B̵O̷D̴Y̷ ̸C̷A̸N̷ ̴S̴A̶V̶E̷ ̷Y̷O̵U̴ ̶N̶O̴W̵.̴ ̴H̷E̴ ̸I̶S̶ ̷C̷O̴M̷I̵N̷G̷ ̴F̸O̵R̴ ̶Y̴O̴U̷R̷ ̷S̶O̸U̸L̴.̶" 
                : "Willkommen auf dem Hub des besten Minecraft Realms. Entdecke neue Welten, nimm an Events teil und werde Teil unserer wachsenden Community."
              }
            </p>
            <div className="flex flex-wrap gap-4 justify-center md:justify-start">
              {(false && (myProfile?.role === 'Owner' || myProfile?.role === 'Root' || isOwner || isSuperAdmin)) && (
                <button 
                  onClick={() => {
                    setDevLabsOpen(true);
                    setLeaderboardOpen(false);
                    setShopOpen(false);
                    setNewsOpen(false);
                    setPollsOpen(false);
                    setChatOpen(false);
                    setShowMiningModal(false);
                  }}
                  className="mc-button bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold transition-all shadow-[0_0_20px_rgba(6,182,212,0.35)] flex items-center gap-2 group px-6 py-3 rounded-xl hover:scale-105"
                  title="Entwickler-Zentrum mit Rust WASM, Dart Flutter, Python RL & Golang API"
                >
                  <span>Entwickler-Zentrum 💻</span>
                </button>
              )}
              <button 
                onClick={() => {
                  const directLink = "https://dampf.mypi.co/";
                  navigator.clipboard.writeText(directLink);
                  triggerToast('quest', 'LINK KOPIERT 📋', 'Der Direktspiel-Link (https://dampf.mypi.co/) wurde kopiert!');
                }}
                className="mc-button mc-button-secondary flex items-center gap-2 px-6 py-3 rounded-xl border border-neutral-800 hover:border-emerald-500 hover:text-emerald-400 transition-all"
                title="Diesen Link kopieren oder Lesezeichen für direkten Spielstart erstellen!"
              >
                <span>Direkt-Link kopieren 🔗</span>
              </button>
              <button 
                onClick={() => document.getElementById('codes')?.scrollIntoView({ behavior: 'smooth' })}
                className="mc-button mc-button-secondary flex items-center gap-2 px-6 py-3 rounded-xl border border-neutral-800 transition-all"
              >
                Codes abrufen
                <ChevronRight size={16} />
              </button>
              <a 
                href={DISCORD_URL} 
                target="_blank" 
                rel="noreferrer"
                className="mc-button mc-button-secondary flex items-center gap-2 px-6 py-3 rounded-xl border border-neutral-800 transition-all"
              >
                Discord Server
                <ExternalLink size={16} />
              </a>
            </div>
          </motion.div>
        </div>

        {/* Live Status Cards (Summary) */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mc-card flex items-center gap-4 border-blue-500/10"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
              <Users size={24} />
            </div>
            <div>
              <p className="text-neutral-400 text-sm">Spieler Online</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{totalOnline}</span>
                {totalOnline > 0 && <span className="w-2 h-2 rounded-full bg-mc-red animate-pulse" />}
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mc-card flex items-center gap-4 border-mc-gold/10"
          >
            <div className="w-12 h-12 rounded-xl bg-mc-gold/10 flex items-center justify-center text-mc-gold">
              <Activity size={24} />
            </div>
            <div>
              <p className="text-neutral-400 text-sm">Gesamt-Status</p>
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-bold uppercase ${pvpStatus.online || survivalStatus.online ? 'text-mc-red' : 'text-red-500'}`}>
                  {pvpStatus.online || survivalStatus.online ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mc-card flex items-center gap-4 border-purple-500/10"
          >
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
              <MessageCircle size={24} />
            </div>
            <div>
              <p className="text-neutral-400 text-sm">Discord Online</p>
              <span className="text-2xl font-bold">{discordData?.online_count || '...'}</span>
            </div>
          </motion.div>
        </section>

        {/* Global Online Players Summary */}
        <section className="mb-12">
          <div className="mc-card p-8 flex flex-col md:flex-row items-center justify-between gap-8 border-mc-gold/20 relative overflow-hidden">
            <div className="absolute inset-0 bg-mc-gold/[0.02] pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between w-full gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Circle className="text-mc-red fill-mc-red animate-pulse" size={12} />
                  <h2 className="text-2xl font-bold">Wer ist gerade online?</h2>
                </div>
                <p className="text-neutral-500 text-sm">Aktuell sind {totalOnline} Spieler in der Community aktiv.</p>
              </div>
              <button 
                onClick={fetchOnlinePlayers}
                className="flex items-center gap-2 px-4 py-2 bg-black/40 border border-neutral-800 rounded-xl text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-white transition-all hover:border-neutral-700 active:scale-95 group/refresh"
              >
                <RefreshCw size={12} className="group-hover/refresh:rotate-180 transition-transform duration-500" />
                Aktualisieren
              </button>
            </div>
            
            <div className="flex -space-x-4">
              {(combinedOnline || []).map((p: any, i: number) => (
                <motion.div 
                  key={`online-avatar-${p?.userId || p?.username || `v-${i}`}-${p?.type || 'unknown'}-${i}`}
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className="relative group cursor-pointer"
                  onClick={() => isAdmin && p?.type === 'profile' && p?.userId && openProfileEdit(p.userId)}
                >
                  <img 
                    src={p?.type === 'profile' ? (userProfiles.find(prof => prof.userId === p.userId)?.customSkin || `https://mc-heads.net/avatar/${p.username}`) : `https://mc-heads.net/avatar/${p?.username}`} 
                    alt={`${p?.username} Minecraft Profil`}
                    className="w-14 h-14 rounded-lg border-2 border-mc-gold bg-neutral-900 pixelated relative z-10 transition-transform group-hover:scale-110 group-hover:z-20 cursor-help object-cover"
                    title={`${p.username} ${p.server !== 'none' ? `auf ${p.server}` : ''}`}
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-30 pointer-events-none border border-neutral-800">
                    {p.username}
                  </div>
                </motion.div>
              ))}
              {combinedOnline.length === 0 && (
                <div className="text-neutral-500 font-medium italic">Gerade keiner online...</div>
              )}
            </div>
          </div>
        </section>

        {/* Staff / Team Section */}
        {staffList.length > 0 && (
          <section className="mb-24">
            <div 
              className="flex items-center justify-between gap-3 mb-8 cursor-pointer group select-none"
              onClick={() => setShowStaffSection(!showStaffSection)}
            >
              <div className="flex items-center gap-3">
                <ShieldCheck className="text-mc-gold" size={24} />
                <h2 className="text-3xl font-bold">Unser Team</h2>
              </div>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-neutral-500 group-hover:text-white transition-colors">
                {showStaffSection ? 'Einklappen' : 'Ausklappen'}
                <ChevronDown className={`transition-transform duration-300 ${showStaffSection ? 'rotate-180' : ''}`} size={16} />
              </div>
            </div>
            
            <AnimatePresence>
              {showStaffSection && (
                <motion.div 
                  key="staff-section"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6 pt-4">
                    {staffList.map((p: any, i: number) => (
                      <motion.div 
                        key={`staff-member-${p.userId || p.username || `v-${i}`}-${i}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className={`mc-card p-6 flex flex-col items-center text-center group transition-all duration-300 ${
                          p.activeGlow && p.activeGlow !== 'none'
                            ? getGlowStyles(p.activeGlow)
                            : 'border-mc-gold/10 hover:border-mc-gold/40'
                        }`}
                      >
                         <div className="relative mb-4">
                           <img 
                             src={p.customSkin || `https://mc-heads.net/avatar/${p.minecraftUsername || 'Steve'}`} 
                             className="w-20 h-20 rounded-xl bg-neutral-900 border-2 border-mc-gold/20 pixelated object-cover group-hover:scale-105 transition-transform" 
                             alt=""
                             referrerPolicy="no-referrer"
                           />
                           {p.isOnline && <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-black animate-pulse" />}
                         </div>
                         <span className="font-extrabold text-sm mb-1">{p.displayName}</span>
                         <div className="flex flex-wrap justify-center gap-1">
                           {(() => {
                             const name = (p.minecraftUsername || p.displayName || p.userId || '').trim();
                             const displayRole = STAFF_OVERWRITES[name] || STAFF_OVERWRITES[p.displayName || ''] || p.role;
                             if (!displayRole || displayRole === 'Member') return null;
                             
                             return (
                               <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                                 (displayRole === 'Root') ? 'bg-mc-gold text-black shadow-[0_0_15px_rgba(255,170,0,0.6)]' :
                                 (displayRole === 'Owner') ? 'bg-mc-gold text-black shadow-[0_0_10px_rgba(255,170,0,0.4)]' : 
                                 displayRole === 'Admin' ? 'bg-mc-red text-white' : 
                                 displayRole === 'Mod' ? 'bg-mc-red/40 text-white' : 
                                 displayRole === 'VIP' ? 'bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.7)]' :
                                 displayRole === 'MVP' ? 'bg-mc-gold text-black' :
                                 'bg-blue-600 text-white'
                               }`}>
                                 {(displayRole === 'Root') ? 'DEVELOPER' : (displayRole === 'Owner') ? 'OWNER' : (displayRole === 'Admin') ? 'ADMIN' : (displayRole === 'VIP') ? 'VIP' : (displayRole === 'MVP') ? 'MVP' : displayRole}
                               </span>
                             );
                           })()}
                           {p.purchasedRank && p.purchasedRank !== 'undefined' && (
                             <span className="px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-widest bg-purple-500 text-white shadow-[0_0_8px_rgba(168,85,247,0.4)]">
                               {p.purchasedRank}
                             </span>
                           )}
                         </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        )}

        {/* Realm Codes Section */}
        <section id="codes" className="mb-24">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <h2 className="text-3xl font-bold mb-4">Realm Zugangscodes</h2>
              <p className="text-neutral-400">Direkter Zugang für geprüfte Community-Mitglieder.</p>
            </div>
            <button 
              onClick={() => { fetchServerStatus(); fetchRealmCodes(); }}
              className="flex items-center gap-2 px-6 py-3 bg-neutral-900 border border-neutral-800 rounded-2xl text-xs font-black uppercase tracking-[0.2em] text-neutral-400 hover:text-white transition-all hover:border-neutral-700 active:scale-95 group/status"
            >
              <RefreshCw size={14} className="group-hover/status:rotate-180 transition-transform duration-700" />
              Status Refresh
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-24">
            <motion.div 
              whileHover={{ scale: 1.01 }}
              className="relative overflow-hidden group"
            >
              <div 
                className="absolute inset-0 pointer-events-none" 
                style={{ background: `linear-gradient(to bottom right, ${realmColors.pvp}1a, transparent)` }}
              />
              <div className="mc-card h-full flex flex-col justify-between" style={{ borderColor: `${realmColors.pvp}33` }}>
                <div>
                  <div className="flex items-center justify-between mb-8">
                    <div className="p-3 rounded-xl" style={{ backgroundColor: `${realmColors.pvp}33`, color: realmColors.pvp }}>
                      <Swords size={32} />
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: realmColors.pvp }}>Live Status</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono px-3 py-1 rounded-full border" style={{ backgroundColor: `${realmColors.pvp}1a`, color: realmColors.pvp, borderColor: `${realmColors.pvp}33` }}>
                          {combinedPvpPlayers.length} / {pvpStatus.maxPlayers} Online
                        </span>
                      </div>
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold mb-2">{realmNames.pvp}</h3>

                  <p className="text-neutral-400 mb-6 leading-relaxed">
                    {realmNames.pvp === 'PvP Arena' ? 'Der offizielle Realm für unsere PvP-Turniere. Kämpfe gegen andere, verbessere deine Skills und dominiere.' : `Willkommen auf dem ${realmNames.pvp} Realm!`}
                  </p>

                  {/* Capacity Progress Bar */}
                  <div className="mb-6 bg-black/30 border border-neutral-800/40 rounded-xl p-3.5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Realm Auslastung</span>
                      <span className="text-xs font-mono font-bold" style={{ color: realmColors.pvp }}>
                        {Math.round((combinedPvpPlayers.length / (pvpStatus.maxPlayers || 10)) * 100)}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-neutral-900 rounded-full overflow-hidden border border-neutral-800/50">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (combinedPvpPlayers.length / (pvpStatus.maxPlayers || 10)) * 100)}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="h-full rounded-full"
                        style={{ 
                          backgroundColor: realmColors.pvp,
                          boxShadow: `0 0 8px ${realmColors.pvp}80`
                        }}
                      />
                    </div>
                  </div>
                  
                  {/* Player List */}
                  <div className="mb-8 min-h-[40px]">
                    <p className="text-[10px] uppercase font-bold text-neutral-500 mb-2 tracking-widest">Aktive Spieler</p>
                    <div className="flex flex-wrap gap-2">
                      {combinedPvpPlayers.length > 0 ? combinedPvpPlayers.map((p, i: number) => (
                        <div key={`pvp-player-${p.id || p.username || `v-${i}`}-${i}`} className="flex items-center gap-2 px-2 py-1 bg-black/40 rounded-lg border border-neutral-800 text-xs group/item relative overflow-hidden">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: realmColors.pvp, boxShadow: `0 0 5px ${realmColors.pvp}80` }} />
                          <span className="flex items-center gap-1.5">
                            {p.username}
                            {isAdmin && (p as any).ip && (
                              <span className="text-[9px] font-mono px-1 rounded border" style={{ color: realmColors.pvp, backgroundColor: `${realmColors.pvp}1a`, borderColor: `${realmColors.pvp}33` }}>
                                {(p as any).ip}
                              </span>
                            )}
                            {p.role && p.role !== 'Member' && (
                              <span className={`text-[8px] px-1 py-0.5 rounded-sm font-bold uppercase ${
                                p.role === 'Admin' ? 'bg-mc-gold text-black' :
                                p.role === 'Mod' ? 'bg-mc-red text-white' :
                                'bg-purple-500 text-white'
                              }`}>
                                {p.role}
                              </span>
                            )}
                            {(p as any).purchasedRank && (p as any).purchasedRank !== 'undefined' && (
                              <span className="text-[8px] px-1 py-0.5 rounded-sm font-bold uppercase bg-purple-500 text-white shadow-[0_0_8px_rgba(168,85,247,0.4)]">
                                {(p as any).purchasedRank}
                              </span>
                            )}
                          </span>
                          {isAdmin && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); kickPlayer({ id: p.id, type: p.type as any }); }}
                              className="ml-1 opacity-0 group-hover/item:opacity-100 transition-opacity text-neutral-500 hover:text-mc-red"
                            >
                              <Trash2 size={10} />
                            </button>
                          )}
                        </div>
                      )) : (
                        <span className="text-xs text-neutral-600 italic">Warte auf Spieler...</span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div 
                  onClick={() => copyToClipboard(realmCodes.PVP, 'pvp')}
                  className="mt-auto bg-black/40 border border-neutral-800 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:border-neutral-700 transition-colors group/code"
                >
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold mb-1">Realm Code</span>
                    <span className="font-mono text-xl text-mc-gold group-hover/code:text-white transition-colors">
                      {realmCodes.PVP}
                    </span>
                  </div>
                  <div className="p-2 text-neutral-500">
                    {copied === 'pvp' ? <CheckCircle2 className="text-mc-green" /> : <Copy size={20} />}
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div 
              whileHover={{ scale: 1.01 }}
              className="relative overflow-hidden group"
            >
              <div 
                className="absolute inset-0 pointer-events-none" 
                style={{ background: `linear-gradient(to bottom right, ${realmColors.survival}1a, transparent)` }}
              />
              <div className="mc-card h-full flex flex-col justify-between" style={{ borderColor: `${realmColors.survival}33` }}>
                <div>
                  <div className="flex items-center justify-between mb-8">
                    <div className="p-3 rounded-xl" style={{ backgroundColor: `${realmColors.survival}33`, color: realmColors.survival }}>
                      <Trees size={32} />
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: realmColors.survival }}>Live Status</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono px-3 py-1 rounded-full border" style={{ backgroundColor: `${realmColors.survival}1a`, color: realmColors.survival, borderColor: `${realmColors.survival}33` }}>
                          {combinedSurvivalPlayers.length} / {survivalStatus.maxPlayers} Online
                        </span>
                      </div>
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold mb-2">{realmNames.survival}</h3>
                  <p className="text-neutral-400 mb-6 leading-relaxed text-wrap">
                    {realmNames.survival === 'Survival World' ? 'Entspanntes Vanilla-Survival. Erforsche, baue gemeinsam und genieße die Welt.' : `Willkommen auf dem ${realmNames.survival} Realm!`}
                  </p>

                  {/* Capacity Progress Bar */}
                  <div className="mb-6 bg-black/30 border border-neutral-800/40 rounded-xl p-3.5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Realm Auslastung</span>
                      <span className="text-xs font-mono font-bold" style={{ color: realmColors.survival }}>
                        {Math.round((combinedSurvivalPlayers.length / (survivalStatus.maxPlayers || 10)) * 100)}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-neutral-900 rounded-full overflow-hidden border border-neutral-800/50">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (combinedSurvivalPlayers.length / (survivalStatus.maxPlayers || 10)) * 100)}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="h-full rounded-full"
                        style={{ 
                          backgroundColor: realmColors.survival,
                          boxShadow: `0 0 8px ${realmColors.survival}80`
                        }}
                      />
                    </div>
                  </div>

                   {/* Player List */}
                   <div className="mb-8 min-h-[40px]">
                    <p className="text-[10px] uppercase font-bold text-neutral-500 mb-2 tracking-widest">Aktive Spieler</p>
                    <div className="flex flex-wrap gap-2">
                      {combinedSurvivalPlayers.length > 0 ? combinedSurvivalPlayers.map((p, i: number) => (
                        <div key={`survival-player-${p.id || p.username || `v-${i}`}-${i}`} className="flex items-center gap-2 px-2 py-1 bg-black/40 rounded-lg border border-neutral-800 text-xs group/item relative overflow-hidden">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: realmColors.survival, boxShadow: `0 0 5px ${realmColors.survival}80` }} />
                          <span className="flex items-center gap-1.5">
                            {p.username}
                            {isAdmin && (p as any).ip && (
                              <span className="text-[9px] font-mono px-1 rounded border" style={{ color: realmColors.survival, backgroundColor: `${realmColors.survival}1a`, borderColor: `${realmColors.survival}33` }}>
                                {(p as any).ip}
                              </span>
                            )}
                            {p.role && p.role !== 'Member' && (
                              <span className={`text-[8px] px-1 py-0.5 rounded-sm font-bold uppercase ${
                                p.role === 'Admin' ? 'bg-mc-gold text-black' :
                                p.role === 'Mod' ? 'bg-mc-red text-white' :
                                'bg-purple-500 text-white'
                              }`}>
                                {p.role}
                              </span>
                            )}
                            {(p as any).purchasedRank && (p as any).purchasedRank !== 'undefined' && (
                              <span className="text-[8px] px-1 py-0.5 rounded-sm font-bold uppercase bg-purple-500 text-white shadow-[0_0_8px_rgba(168,85,247,0.4)]">
                                {(p as any).purchasedRank}
                              </span>
                            )}
                          </span>
                          {isAdmin && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); kickPlayer({ id: p.id, type: p.type as any }); }}
                              className="ml-1 opacity-0 group-hover/item:opacity-100 transition-opacity text-neutral-500 hover:text-mc-red"
                            >
                              <Trash2 size={10} />
                            </button>
                          )}
                        </div>
                      )) : (
                        <span className="text-xs text-neutral-600 italic">Warte auf Spieler...</span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div 
                  onClick={() => copyToClipboard(realmCodes.SURVIVAL, 'survival')}
                  className="mt-auto bg-black/40 border border-neutral-800 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:border-neutral-700 transition-colors group/code"
                >
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold mb-1">Realm Code</span>
                    <span className="font-mono text-xl text-mc-gold group-hover/code:text-white transition-colors">
                      {realmCodes.SURVIVAL}
                    </span>
                  </div>
                  <div className="p-2 text-neutral-500">
                    {copied === 'survival' ? <CheckCircle2 className="text-mc-green" /> : <Copy size={20} />}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Community Players List */}
          <div className="mb-12">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <Globe className="text-mc-gold" size={28} />
                <h2 className="text-3xl font-bold">Community Status</h2>
              </div>
              <button 
                onClick={fetchProfiles}
                disabled={isRefreshingProfiles}
                className={`flex items-center gap-2 px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs font-bold uppercase tracking-widest text-neutral-400 hover:text-white transition-all hover:border-neutral-700 ${isRefreshingProfiles ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <RefreshCw size={14} className={isRefreshingProfiles ? 'animate-spin' : ''} />
                {isRefreshingProfiles ? 'Refreshing...' : 'Aktualisieren'}
              </button>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                  {communityDisplayList.map((p: any, i: number) => {
                    const activeColorGlow = p.activeGlow || p.profile?.activeGlow;
                    return (
                      <motion.div 
                        key={`community-profile-${p.userId || p.username || `v-${i}`}-${i}`}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`mc-card p-4 flex flex-col items-center text-center transition-all duration-300 group relative ${
                          (activeColorGlow && activeColorGlow !== 'none')
                            ? getGlowStyles(activeColorGlow)
                            : 'border-neutral-800/50'
                        } ${isAdmin ? 'cursor-pointer hover:border-mc-gold/50' : 'hover:border-mc-red/30'}`}
                        onClick={() => {
                          if (isAdmin && p.userId) {
                            openProfileEdit(p.userId);
                          }
                        }}
                      >
                  {isAdmin && p.lastLoginIp && (
                    <div className={`absolute inset-0 bg-black/95 opacity-0 group-hover:opacity-100 transition-opacity z-40 flex flex-col items-center justify-center p-2 text-center pointer-events-none border-2 ${p.isOnline ? 'border-red-600' : 'border-mc-gold/50'} rounded-xl`}>
                      <div className="flex items-center gap-1 mb-1">
                        <ShieldAlert size={10} className={p.isOnline ? 'text-red-500 animate-pulse' : 'text-mc-gold'} />
                        <p className="text-[9px] font-black text-mc-gold uppercase tracking-tighter">Live Transmission</p>
                      </div>
                      <p className="text-[14px] font-mono text-white mb-1 font-black select-all tracking-tight bg-white/5 px-2 py-0.5 rounded border border-white/10">
                        {p.lastLoginIp}
                      </p>
                      <div className="flex flex-col gap-1 w-full px-2">
                        <div className="flex items-center justify-between text-[7px] text-neutral-500 font-bold uppercase mb-1">
                          <span>{p.lastLoginCity || 'Unknown'}</span>
                          <span>{p.isOnline ? 'ACTIVE' : 'IDLE'}</span>
                        </div>
                        <div className="h-1 w-full bg-neutral-900 rounded-full overflow-hidden border border-neutral-800">
                          <motion.div 
                            animate={p.isOnline ? { x: [-20, 100] } : {}}
                            transition={p.isOnline ? { repeat: Infinity, duration: 1.5, ease: "linear" } : {}}
                            className={`h-full w-4 ${p.isOnline ? 'bg-red-500 shadow-[0_0_5px_red]' : 'bg-neutral-700'}`} 
                          />
                        </div>
                        {isAdmin && p.isOnline && (
                          <button 
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (!p.userId) return;
                              const btn = e.currentTarget;
                              btn.innerHTML = 'SYNC...';
                              btn.style.borderColor = '#ff0000';
                              
                              await updateDoc(doc(db, 'user_profiles', p.userId), { requestIpUpdate: true });
                              
                              notifyDiscord(
                                "📡 FERN-PING AUSGELÖST",
                                `Eine manuelle IP-Standortabfrage wurde gestartet.`,
                                16711680,
                                [
                                  { name: "🛡️ Admin", value: myProfile?.displayName || 'System', inline: true },
                                  { name: "🎯 Ziel", value: p.username || p.displayName || 'Unbekannt', inline: true },
                                  { name: "⚡ Status", value: "Signal gesendet...", inline: true }
                                ]
                              );
                              
                              setTimeout(() => { if(btn) btn.innerHTML = 'PING IP'; }, 2000);
                            }}
                            className="mt-2 pointer-events-auto bg-mc-red/20 border border-mc-red/40 text-mc-red text-[8px] font-black uppercase py-1 px-2 rounded hover:bg-mc-red hover:text-white transition-all"
                          >
                            Ping IP
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="absolute top-2 right-2 flex flex-wrap gap-1 z-20 justify-end">
                    {p.role && p.role !== 'Member' && (
                      <div className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider shadow-sm ${
                        p.role === 'Owner' || p.role === 'Root' ? 'bg-mc-gold text-black shadow-[0_0_10px_rgba(255,170,0,0.5)]' :
                        p.role === 'Admin' ? 'bg-mc-red text-white' :
                        p.role === 'Mod' ? 'bg-mc-red/40 text-white' :
                        p.role === 'VIP' ? 'bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.7)] border border-purple-400/30' :
                        p.role === 'MVP' ? 'bg-mc-blue text-white' :
                        p.role === 'Besucher' ? 'bg-neutral-700 text-neutral-300' : ''
                      }`}>
                        {p.role === 'Root' ? 'Owner' : p.role}
                      </div>
                    )}
                    {p.purchasedRank && p.purchasedRank !== 'undefined' && (
                      <div className="px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider shadow-sm bg-purple-500 text-white shadow-[0_0_10px_rgba(168,85,247,0.3)]">
                        {p.purchasedRank}
                      </div>
                    )}
                    {isAdmin && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            if(p.isOnline) {
                              kickPlayer({ id: p.userId || p.username, type: p.type });
                            } else if (p.userId) {
                              deleteProfile(p.userId);
                            }
                          }}
                          className="p-1.5 bg-red-600/30 text-red-100 rounded-lg hover:bg-red-600 hover:text-white transition-all shadow-lg border border-red-500/30"
                          title={p.isOnline ? "Spieler Kicken/Entfernen" : "Account Terminieren"}
                        >
                          {p.isOnline ? <UserMinus size={14} /> : <Trash2 size={14} />}
                        </button>
                        <div className="p-1.5 bg-mc-gold/20 text-mc-gold rounded-lg border border-mc-gold/20">
                          <ShieldCheck size={14} />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="relative mb-4">
                    <img 
                      src={p.profile?.customSkin || `https://mc-heads.net/avatar/${p.username || 'steve'}`} 
                      alt={`${p.displayName} Community Mitglied`}
                      className="w-16 h-16 rounded-lg bg-neutral-900 pixelated border-2 border-neutral-800 group-hover:border-mc-red/50 transition-colors object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-black ${p.isOnline ? 'bg-green-500' : 'bg-neutral-600'}`} />
                  </div>
                  <h4 className="font-bold text-sm truncate w-full mb-1">{p.displayName}</h4>
                  <div className="flex flex-col items-center gap-1">
                    <p className="text-[10px] text-neutral-500 uppercase tracking-widest">{p.isOnline ? 'Online' : 'Offline'}</p>
                    {p.isOnline && p.server && p.server !== 'none' && (
                      <span 
                        className="text-[8px] px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter border shadow-sm"
                        style={{ 
                          backgroundColor: `${p.server === 'pvp' ? realmColors.pvp : realmColors.survival}1a`, 
                          color: p.server === 'pvp' ? realmColors.pvp : realmColors.survival,
                          borderColor: `${p.server === 'pvp' ? realmColors.pvp : realmColors.survival}33`
                        }}
                      >
                        {p.server}
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
              {!user && (
                <div 
                  onClick={() => setShowLoginModal(true)}
                  className="mc-card p-4 flex flex-col items-center justify-center text-center border-dashed border-neutral-800 hover:border-mc-gold/50 cursor-pointer transition-colors"
                >
                  <div className="w-16 h-16 rounded-lg bg-neutral-900 flex items-center justify-center border-2 border-dashed border-neutral-800 text-neutral-600 mb-2">
                    <UserPlus size={24} />
                  </div>
                  <span className="text-[10px] font-bold text-neutral-500 uppercase">Hier eintragen</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Clan System Section */}
        <section id="clans" className="mb-12 py-8 border-t border-neutral-800/50">
          <div 
            className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-6 cursor-pointer group"
            onClick={() => setIsClansOpen(!isClansOpen)}
          >
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Users className={`transition-colors ${isClansOpen ? "text-mc-gold" : "text-neutral-500"}`} size={32} />
                <h2 className="text-3xl font-bold flex items-center gap-4">
                  Clan-System
                  <motion.div
                    animate={{ rotate: isClansOpen ? 180 : 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    <ChevronDown size={24} className="text-neutral-600 group-hover:text-white transition-colors" />
                  </motion.div>
                </h2>
              </div>
              <p className="text-neutral-400">Schließe dich mit anderen zusammen und dominiert gemeinsam.</p>
            </div>
            
            <div className="flex flex-wrap gap-4 items-center">
              {/* Mini Leaderboard Tags */}
              <div className="hidden md:flex items-center gap-2 bg-neutral-900/50 p-2 rounded-xl border border-neutral-800">
                <BarChart2 size={14} className="text-mc-gold ml-2" />
                <span className="text-[10px] font-black uppercase text-neutral-500 mr-2">Top Clans:</span>
                {clans
                  .sort((a,b) => (b.level||0) - (a.level||0))
                  .slice(0, 3)
                  .map((c, i) => (
                    <span key={`top-clan-tag-${c.id || i}-${i}`} className="text-[10px] font-bold px-2 py-1 bg-black/40 rounded border border-neutral-800">
                      <span className="text-mc-gold mr-1">#{i+1}</span> {c.tag}
                    </span>
                  ))
                }
              </div>

              {user && !myClan && isClansOpen && (
                <button 
                  onClick={(e) => { e.stopPropagation(); setShowCreateClan(true); }}
                  className="mc-button mc-button-primary"
                >
                  <UserPlus size={20} />
                  Clan gründen
                </button>
              )}
            </div>
          </div>

          <AnimatePresence>
            {isClansOpen && (
              <motion.div 
                key="clans-section"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-4">
                  {/* Clan List */}
                  <div className="lg:col-span-2 space-y-4">
                    {clans
                      .sort((a, b) => {
                        if ((b.level || 1) !== (a.level || 1)) return (b.level || 1) - (a.level || 1);
                        return (b.xp || 0) - (a.xp || 0);
                      })
                      .map((clan, clanIdx) => (
                      <motion.div 
                        key={`clan-card-${clan.id || clanIdx}-${clanIdx}`}
                        layout
                        className={`mc-card p-6 flex flex-col md:flex-row items-center justify-between gap-6 transition-colors cursor-pointer ${activeClanId === clan.id ? 'border-mc-gold bg-mc-gold/[0.02]' : 'border-neutral-800 hover:border-neutral-700'}`}
                        onClick={() => setActiveClanId(clan.id)}
                      >
                        <div className="flex items-center gap-6">
                          <div className="w-16 h-16 bg-neutral-900 rounded-xl border border-neutral-800 flex items-center justify-center text-2xl font-bold text-mc-red pixelated">
                            {clan.tag}
                          </div>
                          <div>
                            <h3 className="text-xl font-bold flex items-center gap-2">
                              {clan.name}
                              <span className="text-xs font-mono bg-mc-red/10 text-mc-red px-2 py-0.5 rounded">[{clan.tag}]</span>
                              <span className="text-[10px] bg-mc-gold text-black px-1.5 rounded font-black">LVL {clan.level || 1}</span>
                            </h3>
                            <p className="text-neutral-500 text-sm italic mb-2">{clan.description || 'Keine Beschreibung'}</p>
                            <div className="flex items-center gap-4 text-[10px] text-neutral-600 uppercase font-bold tracking-widest">
                              <span className="flex items-center gap-1"><Users size={12} /> {clan.memberCount} Mitglieder</span>
                              <span className="flex items-center gap-1"><Activity size={12} /> Seit {new Date(clan.createdAt?.seconds * 1000).toLocaleDateString() || '...'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2 w-full md:w-auto">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const link = `https://dampf.mypi.co/?invite=${clan.id}`;
                              navigator.clipboard.writeText(link);
                              triggerToast('quest', 'LINK KOPIERT ⚡', `Einladungslink für "${clan.name}" kopiert!`);
                            }}
                            className="p-3 bg-neutral-900 border border-neutral-800 text-neutral-400 rounded-xl hover:border-neutral-700 hover:text-white transition-colors flex items-center justify-center"
                            title="Einladungslink kopieren"
                          >
                            <Copy size={16} />
                          </button>
                          {(user?.uid === clan.leaderId || isAdmin) ? (
                            <button 
                              onClick={(e) => { e.stopPropagation(); deleteClan(clan.id); }}
                              className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20"
                            >
                              <Trash2 size={20} />
                            </button>
                          ) : clanMembers.some(m => m.userId === user?.uid) ? (
                            <button 
                              onClick={(e) => { e.stopPropagation(); leaveClan(clan.id); }}
                              className="mc-button border-red-500/20 text-red-400 hover:bg-red-500/10 text-xs py-2 px-4"
                            >
                              Verlassen
                            </button>
                          ) : clanRequests.some(r => r.userId === user?.uid) ? (
                            <button 
                              disabled
                              className="mc-button opacity-50 border-neutral-700 text-neutral-500 text-xs py-2 px-4 cursor-not-allowed"
                            >
                              Anfrage läuft
                            </button>
                          ) : (
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                const msg = prompt('Nachricht an den Clan-Leader:');
                                if (msg !== null) submitJoinRequest(clan.id, msg);
                              }}
                              className="mc-button mc-button-secondary text-xs py-2 px-4"
                            >
                              Beitreten
                            </button>
                          )}
                        </div>
                      </motion.div>
                    ))}
                    {clans.length === 0 && (
                      <div className="mc-card p-12 text-center border-dashed border-neutral-800 text-neutral-500">
                        <p className="italic">Noch keine Clans vorhanden. Gründe den ersten!</p>
                      </div>
                    )}
                  </div>

                  {/* Clan Specific Info (Right Sidebar) */}
                  <div className="mc-card border-neutral-800 bg-black/40 overflow-hidden self-start sticky top-24">
                    <div className="border-b border-neutral-800 flex bg-neutral-900/50 overflow-x-auto scrollbar-hide">
                      {(['members', 'chat', 'quests', 'stats', 'requests', 'perks'] as const).map((tab, tabIdx) => {
                        const myMemberData = clanMembers.find(m => m.userId === user?.uid);
                        const isLeaderOrOfficer = myMemberData?.role === 'Leader' || myMemberData?.role === 'Officer';
                        if (tab === 'requests' && !isLeaderOrOfficer) return null;
                        
                        return (
                          <button
                            key={`clan-tab-${tab}-${tabIdx}`}
                            onClick={() => setClanTab(tab)}
                            className={`flex-1 min-w-[80px] py-4 text-[10px] font-black uppercase tracking-widest transition-all ${
                              clanTab === tab 
                                ? 'text-mc-gold bg-mc-gold/5 border-b-2 border-mc-gold' 
                                : 'text-neutral-600 hover:text-neutral-400'
                            }`}
                          >
                            {tab === 'members' && <Users size={12} className="inline mr-1" />}
                            {tab === 'chat' && <MessageSquare size={12} className="inline mr-1" />}
                            {tab === 'perks' && <Award size={12} className="inline mr-1" />}
                            {tab === 'quests' && <Target size={12} className="inline mr-1" />}
                            {tab === 'stats' && <BarChart2 size={12} className="inline mr-1" />}
                            {tab === 'requests' && <UserPlus size={12} className="inline mr-1" />}
                            {tab}
                          </button>
                        );
                      })}
                    </div>

                    <div className="p-6">
                      {activeClanId ? (
                        <>
                          {clanTab === 'members' && (
                            <div className="space-y-4">
                              <div className="border-b border-neutral-800/50 pb-4 mb-4">
                                <h4 className="text-sm font-bold text-white mb-4">Clan-Details</h4>
                                {/* XP & Level Progress */}
                                <div className="space-y-2">
                                  <div className="flex justify-between text-[10px] font-black uppercase tracking-tighter">
                                    <span className="text-mc-gold">LVL {clans.find(c => c.id === activeClanId)?.level}</span>
                                    <span className="text-neutral-500">
                                      {clans.find(c => c.id === activeClanId)?.xp} / {(clans.find(c => c.id === activeClanId)?.level || 1) * 1000} XP
                                    </span>
                                  </div>
                                  <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden border border-neutral-700/50">
                                    <motion.div 
                                      initial={{ width: 0 }}
                                      animate={{ width: `${((clans.find(c => c.id === activeClanId)?.xp || 0) / ((clans.find(c => c.id === activeClanId)?.level || 1) * 1000)) * 100}%` }}
                                      className="h-full bg-mc-gold"
                                    />
                                  </div>
                                </div>

                                {/* Announcement */}
                                <div className="mt-4 bg-mc-gold/5 border border-mc-gold/20 p-3 rounded-xl">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Info size={12} className="text-mc-gold" />
                                    <span className="text-[10px] font-bold text-mc-gold uppercase tracking-widest">Anküdigung</span>
                                  </div>
                                  <p className="text-xs text-neutral-300 italic">
                                    "{clans.find(c => c.id === activeClanId)?.announcement || 'Keine Ankündigung vorhanden.'}"
                                  </p>
                                  {(clans.find(c => c.id === activeClanId)?.leaderId === user?.uid || clanMembers.find(m => m.userId === user?.uid)?.role === 'Officer') && (
                                    <button 
                                      onClick={() => {
                                        const txt = prompt('Neue Ankündigung:', clans.find(c => c.id === activeClanId)?.announcement);
                                        if (txt) updateClanAnnouncement(activeClanId, txt);
                                      }}
                                      className="mt-2 text-[8px] text-mc-gold/60 hover:text-mc-gold uppercase font-bold"
                                    >
                                      Bearbeiten
                                    </button>
                                  )}
                                </div>

                                {/* Invitation Join Link */}
                                <div className="mt-3 bg-neutral-950/40 border border-neutral-800 p-3 rounded-xl flex items-center justify-between gap-3">
                                  <div className="truncate">
                                    <span className="text-[9px] font-extrabold text-neutral-500 uppercase tracking-widest block mb-0.5">Eindeutiger Beitrittslink ⚡</span>
                                    <p className="text-[10px] font-mono text-zinc-400 truncate select-all">
                                      dampf.mypi.co/?invite={activeClanId}
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => {
                                      const url = `https://dampf.mypi.co/?invite=${activeClanId}`;
                                      navigator.clipboard.writeText(url);
                                      triggerToast('quest', 'LINK KOPIERT ⚡', 'Dein Clan-Einladungslink wurde in deine Zwischenablage kopiert.');
                                    }}
                                    className="p-2 bg-mc-gold/10 text-mc-gold rounded-lg hover:bg-mc-gold hover:text-black transition-all shrink-0 flex items-center justify-center border border-mc-gold/20"
                                    title="Beitrittslink kopieren"
                                  >
                                    <Copy size={13} />
                                  </button>
                                </div>
                              </div>

                              <h4 className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-2">Mitglieder</h4>
                              {clanMembers
                                .sort((a, b) => {
                                  const roleRank = { 'Leader': 0, 'Officer': 1, 'Member': 2 };
                                  if (roleRank[a.role] !== roleRank[b.role]) return roleRank[a.role] - roleRank[b.role];
                                  return (b.xpContribution || 0) - (a.xpContribution || 0);
                                })
                                .map((member, i: number) => {
                                const prof = userProfiles.find(p => p.userId === member.userId);
                                const isLeader = clans.find(c => c.id === activeClanId)?.leaderId === user?.uid;
                                
                                return (
                                  <div key={`clan-member-${member.userId || `idx-${i}`}-${i}`} className="flex items-center justify-between p-2 bg-neutral-900/30 rounded-xl border border-neutral-800/30">
                                    <div className="flex items-center gap-2">
                                      <img 
                                        src={prof?.customSkin || `https://mc-heads.net/avatar/${prof?.minecraftUsername || 'steve'}`}
                                        alt={`${prof?.displayName || 'Spieler'} Clan Avatar`}
                                        className="w-8 h-8 rounded-lg bg-black pixelated border border-neutral-800 object-cover"
                                        referrerPolicy="no-referrer"
                                      />
                                      <div>
                                        <p className="text-xs font-bold leading-tight flex items-center gap-1">
                                          {prof?.displayName || 'Spieler'}
                                          <span className="text-[8px] text-mc-gold font-black">+{member.xpContribution || 0} XP</span>
                                        </p>
                                        <span className={`text-[7px] px-1 py-0.5 rounded font-black uppercase text-white ${
                                          member.role === 'Leader' ? 'bg-mc-gold' : 
                                          member.role === 'Officer' ? 'bg-mc-red' : 
                                          'bg-neutral-700'
                                        }`}>
                                          {member.role}
                                        </span>
                                      </div>
                                    </div>
                                    
                                    {(isLeader || isAdmin) && member.userId !== user?.uid && (
                                      <button 
                                        onClick={() => kickPlayerFromClan(activeClanId, member.userId)}
                                        className="p-1.5 text-neutral-600 hover:text-red-500"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {clanTab === 'chat' && (
                            <div className="flex flex-col h-[400px]">
                              {!clanMembers.some(m => m.userId === user?.uid) && !isAdmin ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-neutral-900/50 rounded-2xl border border-dashed border-neutral-800">
                                  <Lock size={24} className="text-neutral-700 mb-2" />
                                  <p className="text-xs text-neutral-500 italic">Du musst diesem Clan beitreten, um den Chat zu sehen.</p>
                                </div>
                              ) : (
                                <>
                                  <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2 scrollbar-hide">
                                    {(isAdmin && !clanMembers.some(m => m.userId === user?.uid)) && (
                                       <div className="bg-purple-500/10 border border-purple-500/30 p-2 rounded text-[8px] text-purple-400 font-bold uppercase mb-4 text-center">
                                          Geister-Modus Aktiv (Nur Admins)
                                       </div>
                                    )}
                                    {clanChatMessages.map((msg, idx) => {
                                      const isOwn = msg.userId === user?.uid;
                                      const profile = userProfiles.find(p => p.userId === msg.userId);
                                      return (
                                        <div key={`clan-msg-${msg.id || 'msg'}-${idx}`} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                          <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${
                                            isOwn ? 'bg-mc-gold text-black rounded-tr-none' : 'bg-neutral-800 text-white rounded-tl-none'
                                          }`}>
                                            {!isOwn && <p className="text-[8px] font-bold mb-1 opacity-60 uppercase">{profile?.displayName || '...'}</p>}
                                            {msg.text}
                                          </div>
                                        </div>
                                      );
                                    })}
                                    {clanChatMessages.length === 0 && (
                                      <p className="text-[10px] text-neutral-600 text-center italic py-20">Keine Nachrichten vorhanden. Schreib als Erster!</p>
                                    )}
                                  </div>
                                  <form onSubmit={sendClanMessage} className="relative">
                                    <input 
                                      value={clanChatInput}
                                      onChange={(e) => setClanChatInput(e.target.value)}
                                      placeholder="Clan-Chat..."
                                      className="w-full bg-neutral-900 border border-neutral-800 rounded-xl py-2 px-3 text-xs outline-none focus:border-mc-gold pr-10"
                                    />
                                    <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 text-mc-gold hover:text-white transition-colors">
                                      <Send size={14} />
                                    </button>
                                  </form>
                                </>
                              )}
                            </div>
                          )}

                          {clanTab === 'quests' && (
                            <div className="space-y-4">
                              <h4 className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-4">Clan-Quests</h4>
                              {clanQuests.map((quest, i: number) => (
                                <div key={`clan-quest-${quest.id || `q-${i}`}-${i}`} className={`p-4 rounded-xl border ${quest.completed ? 'bg-green-500/10 border-green-500/30' : 'bg-neutral-900/50 border-neutral-800'}`}>
                                  <div className="flex justify-between items-start mb-2">
                                    <p className={`text-xs font-bold ${quest.completed ? 'text-green-400' : 'text-white'}`}>{quest.title}</p>
                                    <span className="text-[10px] text-mc-gold font-bold">+{quest.rewardXp} XP</span>
                                  </div>
                                  <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden mb-1">
                                    <motion.div 
                                      initial={{ width: 0 }}
                                      animate={{ width: `${(quest.current / quest.goal) * 100}%` }}
                                      className={`h-full ${quest.completed ? 'bg-green-500' : 'bg-mc-gold'}`}
                                    />
                                  </div>
                                  <p className="text-[9px] text-neutral-500 text-right">{quest.current} / {quest.goal}</p>
                                </div>
                              ))}
                              {clanQuests.length === 0 && (
                                <p className="text-xs text-neutral-600 text-center italic py-20">Keine aktiven Quests.</p>
                              )}
                            </div>
                          )}

                          {clanTab === 'stats' && (
                            <div className="space-y-6">
                              <h4 className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-4">Clan Performance</h4>
                              
                              <div className="grid grid-cols-2 gap-4">
                                <div className="mc-card bg-neutral-900/50 p-4 border-neutral-800">
                                  <p className="text-[8px] text-neutral-500 uppercase font-black mb-1">Total Kills</p>
                                  <p className="text-2xl font-black text-mc-red font-mono">
                                    {(clans.find(c => c.id === activeClanId)?.totalKills || 0).toLocaleString()}
                                  </p>
                                </div>
                                <div className="mc-card bg-neutral-900/50 p-4 border-neutral-800">
                                  <p className="text-[8px] text-neutral-500 uppercase font-black mb-1">XP Rang</p>
                                  <p className="text-2xl font-black text-mc-gold font-mono">
                                    #{clans.sort((a,b) => (b.xp || 0) - (a.xp || 0)).findIndex(c => c.id === activeClanId) + 1}
                                  </p>
                                </div>
                              </div>

                              <div className="pt-4 border-t border-neutral-800/50">
                                <h5 className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-4">Top Beitragsleister</h5>
                                <div className="space-y-3">
                                  {clanMembers
                                    .sort((a,b) => (b.xpContribution || 0) - (a.xpContribution || 0))
                                    .slice(0, 3)
                                    .map((m, i) => {
                                      const p = userProfiles.find(up => up.userId === m.userId);
                                      return (
                                        <div key={`clan-top-${activeClanId}-${m.userId}-${i}`} className="flex items-center justify-between text-xs">
                                          <div className="flex items-center gap-2">
                                            <span className="text-neutral-600 font-mono">#{i+1}</span>
                                            <span className="font-bold">{p?.displayName || 'Spieler'}</span>
                                          </div>
                                          <span className="text-mc-gold font-bold">{(m.xpContribution || 0).toLocaleString()} XP</span>
                                        </div>
                                      );
                                    })
                                  }
                                </div>
                              </div>
                            </div>
                          )}

                          {clanTab === 'requests' && (
                            <div className="space-y-4">
                              <h4 className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-4">Beitrittsanfragen</h4>
                              {clanRequests.map((req, i: number) => (
                                <div key={`clan-req-${req.id || `req-${i}`}-${i}`} className="p-3 bg-neutral-900/30 rounded-xl border border-neutral-800/30">
                                  <div className="flex items-center gap-3 mb-2">
                                    <img 
                                      src={`https://mc-heads.net/avatar/${req.minecraftUsername}`}
                                      alt={`${req.minecraftUsername} Beitrittsanfrage`}
                                      className="w-8 h-8 rounded-lg bg-black pixelated border border-neutral-800"
                                      referrerPolicy="no-referrer"
                                    />
                                    <div>
                                      <p className="text-xs font-bold">{req.minecraftUsername}</p>
                                      <p className="text-[9px] text-neutral-500">{new Date(req.requestedAt?.seconds * 1000).toLocaleDateString()}</p>
                                    </div>
                                  </div>
                                  {req.message && <p className="text-[10px] text-neutral-400 italic mb-3">"{req.message}"</p>}
                                  <div className="flex gap-2">
                                    <button 
                                      onClick={() => acceptJoinRequest(activeClanId, req.userId)}
                                      className="flex-1 py-2 bg-green-500 text-black text-[10px] font-bold rounded-lg hover:bg-green-400 transition-colors"
                                    >
                                      Annehmen
                                    </button>
                                    <button 
                                      onClick={() => declineJoinRequest(activeClanId, req.userId)}
                                      className="flex-1 py-2 bg-neutral-800 text-white text-[10px] font-bold rounded-lg hover:bg-neutral-700 transition-colors"
                                    >
                                      Ablehnen
                                    </button>
                                  </div>
                                </div>
                              ))}
                              {clanRequests.length === 0 && (
                                <p className="text-xs text-neutral-600 text-center italic py-20">Keine ausstehenden Anfragen.</p>
                              )}
                            </div>
                          )}

                          {clanTab === 'perks' && (
                            <div className="space-y-4">
                              <h4 className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mb-4">Freigeschaltete Boni</h4>
                              {[
                                { lvl: 2, title: 'Officer-Status', desc: 'Befördere vertrauenswürdige Mitglieder.', icon: ShieldCheck },
                                { lvl: 5, title: 'Clan-Bank', desc: 'Sammle Ressourcen gemeinsam (Demnächst).', icon: Box },
                                { lvl: 10, title: 'Exklusive Realm-Codes', desc: 'Greife auf private VIP-Welten zu.', icon: Key },
                                { lvl: 20, title: 'Goldener Tag', desc: 'Dein Clan-Tag leuchtet im Global Chat.', icon: Star },
                              ].map((perk, i) => {
                                const isUnlocked = (clans.find(c => c.id === activeClanId)?.level || 1) >= perk.lvl;
                                return (
                                  <div key={`clan-perk-${perk.title}-${i}`} className={`p-3 rounded-xl border transition-all ${
                                    isUnlocked ? 'bg-mc-gold/10 border-mc-gold/30' : 'bg-neutral-900/50 border-neutral-800 opacity-50'
                                  }`}>
                                    <div className="flex items-start gap-3">
                                      <div className={`p-2 rounded-lg ${isUnlocked ? 'bg-mc-gold text-black' : 'bg-neutral-800 text-neutral-600'}`}>
                                        <perk.icon size={16} />
                                      </div>
                                      <div>
                                        <p className={`text-xs font-bold ${isUnlocked ? 'text-white' : 'text-neutral-500'}`}>
                                          {perk.title}
                                          {!isUnlocked && <span className="ml-2 text-[8px] bg-neutral-800 px-1 rounded">LVL {perk.lvl}</span>}
                                        </p>
                                        <p className="text-[9px] text-neutral-600 mt-0.5">{perk.desc}</p>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="py-20 text-center">
                          <Users size={32} className="mx-auto text-neutral-800 mb-4" />
                          <p className="text-xs text-neutral-600 italic">Klicke auf einen Clan in der Liste, um Details zu sehen.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Entwickler-Zentrum Portal Section */}
        {(false && (myProfile?.role === 'Owner' || myProfile?.role === 'Root' || isOwner || isSuperAdmin)) && (
          <section className="mb-24 py-8 border-t border-neutral-800/50">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-500/10 text-cyan-400 rounded-full border border-cyan-500/20 text-xs font-semibold mb-3">
                  <Cpu size={12} className="animate-pulse" />
                  <span>MULTILINGUAL COMPILER SANDBOX</span>
                </div>
                <h2 className="text-3xl font-extrabold tracking-tight">💻 Das Entwickler-Zentrum (Dev Labs)</h2>
                <p className="text-neutral-400 text-sm mt-2 max-w-2xl">
                  Erforsche unsere hochperformanten Webbrowser-Entwicklertools. Simuliere Rust WebAssembly Generatoren, passe Dart & Flutter Mobile UI-Bäume an, trainiere KI-Modelle in Python oder teste gRPC Cluster-Infrastrukturen unter DDoS-Ausnahbezuständen.
                </p>
              </div>
              <button
                onClick={() => {
                  setDevLabsOpen(true);
                  setLeaderboardOpen(false);
                  setShopOpen(false);
                  setNewsOpen(false);
                  setPollsOpen(false);
                  setChatOpen(false);
                  setShowMiningModal(false);
                }}
                className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold rounded-xl shadow-[0_0_20px_rgba(34,211,238,0.2)] transition-all flex items-center gap-2 text-sm shrink-0 active:scale-95"
              >
                <span>Vollen Sandbox-Zugriff öffnen</span>
                <span>⚡</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              
              {/* Rust Card */}
              <div 
                onClick={() => {
                  setDevLabsOpen(true);
                  setLeaderboardOpen(false);
                  setShopOpen(false);
                  setNewsOpen(false);
                  setPollsOpen(false);
                  setChatOpen(false);
                  setShowMiningModal(false);
                }}
                className="mc-card cursor-pointer hover:border-cyan-500/50 hover:shadow-[0_0_30px_rgba(6,182,212,0.1)] transition-all p-6 relative overflow-hidden group border border-neutral-800/60"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 blur-xl group-hover:bg-cyan-500/10 rounded-full transition-all" />
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 bg-cyan-950/40 border border-cyan-500/30 text-cyan-400 rounded-xl group-hover:scale-110 transition-transform">
                    <Cpu size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white">🦀 Rust WASM</h4>
                    <span className="text-[9px] font-mono text-cyan-400">wasm32-unknown</span>
                  </div>
                </div>
                <p className="text-neutral-400 text-xs leading-relaxed mb-4">
                  Generiert komplexe 3D-Voxel-Chunks mithilfe von Hardware-beschleunigten Algorithmen direkt im Browser.
                </p>
                <div className="flex justify-between items-center text-[10px] font-mono border-t border-neutral-900 pt-3">
                  <span className="text-neutral-500">EFFIZIENZ:</span>
                  <span className="text-emerald-400 font-extrabold">+2400% vs JS 🔥</span>
                </div>
              </div>

              {/* Flutter Card */}
              <div 
                onClick={() => {
                  setDevLabsOpen(true);
                  setLeaderboardOpen(false);
                  setShopOpen(false);
                  setNewsOpen(false);
                  setPollsOpen(false);
                  setChatOpen(false);
                  setShowMiningModal(false);
                }}
                className="mc-card cursor-pointer hover:border-purple-500/50 hover:shadow-[0_0_30px_rgba(168,85,247,0.1)] transition-all p-6 relative overflow-hidden group border border-neutral-800/60"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 blur-xl group-hover:bg-purple-500/10 rounded-full transition-all" />
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 bg-purple-950/40 border border-purple-500/30 text-purple-400 rounded-xl group-hover:scale-110 transition-transform">
                    <Smartphone size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white">🎯 Dart & Flutter</h4>
                    <span className="text-[9px] font-mono text-purple-400">iOS & Android App</span>
                  </div>
                </div>
                <p className="text-neutral-400 text-xs leading-relaxed mb-4">
                  Simuliert mobile Widgets, testet Live-Push-Dienste und synchronisiert Nachrichten mit der globalen Cloud-DB.
                </p>
                <div className="flex justify-between items-center text-[10px] font-mono border-t border-neutral-900 pt-3">
                  <span className="text-neutral-500">HOT-RELOAD:</span>
                  <span className="text-purple-400 font-extrabold">Aktiv (32ms) ⚡</span>
                </div>
              </div>

              {/* Python Card */}
              <div 
                onClick={() => {
                  setDevLabsOpen(true);
                  setLeaderboardOpen(false);
                  setShopOpen(false);
                  setNewsOpen(false);
                  setPollsOpen(false);
                  setChatOpen(false);
                  setShowMiningModal(false);
                }}
                className="mc-card cursor-pointer hover:border-yellow-500/50 hover:shadow-[0_0_30px_rgba(234,179,8,0.1)] transition-all p-6 relative overflow-hidden group border border-neutral-800/60"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-500/5 blur-xl group-hover:bg-yellow-500/10 rounded-full transition-all" />
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 bg-yellow-950/40 border border-yellow-500/30 text-yellow-400 rounded-xl group-hover:scale-110 transition-transform">
                    <Settings size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white">🐍 Python AI RL</h4>
                    <span className="text-[9px] font-mono text-yellow-400">AutoPilot Agent</span>
                  </div>
                </div>
                <p className="text-neutral-400 text-xs leading-relaxed mb-4">
                  Trainiert neuronale Pfadfindungsnetze für Autopiloten über Reinforcement Learning Epochen.
                </p>
                <div className="flex justify-between items-center text-[10px] font-mono border-t border-neutral-900 pt-3">
                  <span className="text-neutral-500">OPTIMIERT:</span>
                  <span className="text-yellow-400 font-extrabold">Q-Learning Model 🧠</span>
                </div>
              </div>

              {/* Golang Card */}
              <div 
                onClick={() => {
                  setDevLabsOpen(true);
                  setLeaderboardOpen(false);
                  setShopOpen(false);
                  setNewsOpen(false);
                  setPollsOpen(false);
                  setChatOpen(false);
                  setShowMiningModal(false);
                }}
                className="mc-card cursor-pointer hover:border-teal-500/50 hover:shadow-[0_0_30px_rgba(20,184,166,0.1)] transition-all p-6 relative overflow-hidden group border border-neutral-800/60"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/5 blur-xl group-hover:bg-teal-500/10 rounded-full transition-all" />
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 bg-teal-950/40 border border-teal-500/30 text-teal-400 rounded-xl group-hover:scale-110 transition-transform">
                    <Globe size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white">🐹 Golang API</h4>
                    <span className="text-[9px] font-mono text-teal-400">Microservice Cluster</span>
                  </div>
                </div>
                <p className="text-neutral-400 text-xs leading-relaxed mb-4">
                  Beobachtet WebSockets und gRPC Gateway-Threads. Bewältigt fiktive DDoS Angriffe über Echtzeit-IP-Filter.
                </p>
                <div className="flex justify-between items-center text-[10px] font-mono border-t border-neutral-900 pt-3">
                  <span className="text-neutral-500">GO ROUTINES:</span>
                  <span className="text-teal-400 font-extrabold">Parallel Threads ⚙️</span>
                </div>
              </div>

            </div>
          </section>
        )}

        {/* Community & Feedback Section */}
        <section className="mb-12 py-8 border-t border-neutral-800/50">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Lightbulb className="text-blue-400" size={32} />
              <h2 className="text-3xl font-bold">Community & Feedback</h2>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div 
              onClick={() => {
                setSuggestionsOpen(true);
                fetchSuggestions();
                setNewsOpen(false);
                setPollsOpen(false);
                setChatOpen(false);
                setShopOpen(false);
                setShowMiningModal(false);
                setLeaderboardOpen(false);
              }}
              className="mc-card cursor-pointer hover:border-blue-500/50 hover:shadow-[0_0_30px_rgba(59,130,246,0.1)] transition-all p-6 relative overflow-hidden group border border-neutral-800/60"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 blur-xl group-hover:bg-blue-500/10 rounded-full transition-all" />
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-6">
                  <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl">
                    <Lightbulb size={28} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 border border-blue-500/30 px-2 py-1 rounded bg-blue-500/10">
                    BETA
                  </span>
                </div>
                <h3 className="text-xl font-bold mb-2">Vorschlags-System</h3>
                <p className="text-neutral-400 text-sm mb-6 max-w-sm">
                  Hast du eine gute Idee für den Server? Reiche deinen Vorschlag ein oder vote für die Ideen der Community.
                </p>
                <div className="flex items-center text-blue-400 text-xs font-bold uppercase tracking-widest group-hover:gap-2 transition-all">
                  Zu den Vorschlägen <ChevronRight size={14} className="ml-1" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Server Rules Section */}
        <section className="mb-12 py-8 border-t border-neutral-800/50">
          <div className="flex items-center gap-3 mb-8">
            <ShieldCheck className="text-mc-red" size={32} />
            <h2 className="text-3xl font-bold">Server Rules</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="mc-card" style={{ borderColor: `${realmColors.pvp}1a`, backgroundColor: `${realmColors.pvp}02` }}>
              <div className="flex items-center gap-3 mb-6">
                <Swords size={24} style={{ color: realmColors.pvp }} className="opacity-80" />
                <h3 className="text-xl font-bold">{realmNames.pvp} Rules</h3>
              </div>
              <ul className="space-y-4">
                <li className="flex gap-3 text-sm text-neutral-400">
                  <div className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: realmColors.pvp }} />
                  Keine künstlichen Verzögerungen oder "Lag-Switching".
                </li>
                <li className="flex gap-3 text-sm text-neutral-400">
                  <div className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: realmColors.pvp }} />
                  Respektvoller Umgang im Chat nach einem Kampf (GG!).
                </li>
                <li className="flex gap-3 text-sm text-neutral-400">
                  <div className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: realmColors.pvp }} />
                  Kein Teaming in Solo-Modi.
                </li>
                <li className="flex gap-3 text-sm text-neutral-400">
                  <div className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: realmColors.pvp }} />
                  Nutzung von Exploits führt zum sofortigen Bann.
                </li>
              </ul>
            </div>

            <div className="mc-card" style={{ borderColor: `${realmColors.survival}1a`, backgroundColor: `${realmColors.survival}02` }}>
              <div className="flex items-center gap-3 mb-6">
                <Trees size={24} style={{ color: realmColors.survival }} className="opacity-80" />
                <h3 className="text-xl font-bold">{realmNames.survival} Rules</h3>
              </div>
              <ul className="space-y-4">
                <li className="flex gap-3 text-sm text-neutral-400">
                  <div className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: realmColors.survival }} />
                  Kein Griefing oder Zerstören fremder Bauwerke.
                </li>
                <li className="flex gap-3 text-sm text-neutral-400">
                  <div className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: realmColors.survival }} />
                  Kein Stehlen aus Kisten – fragt vorher um Erlaubnis.
                </li>
                <li className="flex gap-3 text-sm text-neutral-400">
                  <div className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: realmColors.survival }} />
                  Haltet die Welt sauber (keine schwebenden Baumkronen).
                </li>
                <li className="flex gap-3 text-sm text-neutral-400">
                  <div className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: realmColors.survival }} />
                  Große Projekte bitte vorher im Discord anmelden.
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Information & Rules */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-12 py-8 border-t border-neutral-800/50">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <Info className="text-mc-gold" size={24} />
              <h2 className="text-3xl font-bold">Wichtige Infos</h2>
            </div>
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="w-1 bg-mc-gold h-auto rounded-full" />
                <div>
                  <h4 className="font-bold mb-1">Community Hub</h4>
                  <p className="text-neutral-400 text-sm">Verwalte deinen Account, checke deine Statistiken und bleibe mit anderen Spielern über unser Dashboard in Kontakt.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-1 bg-mc-red h-auto rounded-full" />
                <div>
                  <h4 className="font-bold mb-1">Sicherheit</h4>
                  <p className="text-neutral-400 text-sm">Griefing wird nicht toleriert. Alle Aktionen werden geloggt. Bei Verstößen erfolgt ein sofortiger Ausschluss aus allen Realms.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mc-card border-purple-500/10 bg-purple-500/[0.02]">
            <h3 className="text-xl font-bold mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle className="text-purple-500" size={20} />
                Discord Community
              </div>
      <span className="text-xs font-mono bg-purple-500/20 text-purple-400 px-2 py-1 rounded-lg">
                {(discordData?.online_count && discordData.online_count > 0) ? `${discordData.online_count} Online` : 'Community'}
              </span>
            </h3>
            
            {/* Discord Online List */}
            <div className="mb-6 max-h-[140px] overflow-y-auto pr-2 custom-scrollbar space-y-2">
              {discordData?.members && discordData.members.length > 0 ? (
                discordData.members.slice(0, 15).map((member, idx) => (
                  <div key={`discord-member-${member.id || idx}-${idx}`} className="flex items-center gap-3 text-sm group/member">
                    <div className="relative">
                      <img src={member.avatar_url} alt={`${member.username} Discord`} className="w-6 h-6 rounded-full border border-purple-500/20 group-hover/member:border-purple-500/50 transition-colors" />
                      <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 border border-black rounded-full shadow-[0_0_5px_rgba(34,197,94,0.5)]" />
                    </div>
                    <span className="text-neutral-300 truncate group-hover/member:text-white transition-colors">{member.username}</span>
                  </div>
                ))
              ) : (
                <div className="py-4 text-center">
                  <p className="text-xs text-neutral-400 font-medium mb-1">Tritt unserer Community bei!</p>
                  <p className="text-[10px] text-neutral-600 uppercase tracking-widest italic font-black">Join jetzt</p>
                </div>
              )}
            </div>

            <p className="text-neutral-400 text-sm mb-6 text-wrap">
              Probleme beim Beitreten? Unser Support-Team im Discord hilft dir gerne weiter.
            </p>
            <a 
              href={DISCORD_URL}
              target="_blank"
              rel="noreferrer"
              className="mc-button bg-purple-600 hover:bg-purple-500 text-white w-full"
            >
              Discord beitreten
            </a>
          </div>
        </section>
      </main>

      {/* Retro Jukebox Section */}
      <section className="relative z-10 border-t border-neutral-800/40 py-12 bg-black/40 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-2xl p-6 sm:p-8 flex flex-col lg:flex-row gap-8 items-stretch justify-between relative">
            
            {/* Absolute element for floating note particles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-2xl">
              <AnimatePresence>
                {activeNotes.map(n => (
                  <motion.span
                    key={n.id}
                    initial={{ y: 60, x: n.x, scale: 0.5, opacity: 1, rotate: 0 }}
                    animate={{ y: -160, scale: 1.5, opacity: 0, rotate: [0, -15, 15, -15, 30] }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.8, ease: "easeOut" }}
                    className="absolute pointer-events-none text-xl select-none bottom-8"
                    style={{ color: n.color, left: '25%' }}
                  >
                    {n.char}
                  </motion.span>
                ))}
              </AnimatePresence>
            </div>

            {/* Column 1: Jukebox visual and status */}
            <div className="flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-6 z-10 lg:w-5/12">
              <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-xl bg-[#4e3621] border-4 border-[#331c0e] shadow-[inset_0_4px_0_rgba(255,255,255,0.1),0_12px_24px_rgba(0,0,0,0.5)] flex flex-col items-center justify-center group overflow-hidden shrink-0">
                {/* Visual slot for vinyl at the top */}
                <div className="absolute top-2 w-14 h-2 bg-[#211107] rounded border-b border-[#5e432c]">
                  {/* If disc inside, draw it! */}
                  {activeDisc && (
                    <motion.div
                      animate={isJukeboxPlaying ? { rotate: 360 } : {}}
                      transition={isJukeboxPlaying ? { repeat: Infinity, duration: 4, ease: "linear" } : {}}
                      className="absolute -top-1 left-2 w-10 h-10 rounded-full border-2 border-black flex items-center justify-center opacity-80"
                      style={{
                        backgroundColor: activeDisc === 'pigstep' ? '#ef4444' : activeDisc === 'chirp' ? '#22d3ee' : activeDisc === 'cat' ? '#10b981' : '#a855f7',
                      }}
                    >
                      <div className="w-3 h-3 rounded-full bg-[#fbbf24]" />
                    </motion.div>
                  )}
                </div>

                {/* Main Jukebox Texture & Grille */}
                <div className="mt-8 flex flex-col items-center justify-center">
                  <div className={`w-8 h-8 rounded-full border-4 flex items-center justify-center transition-all duration-500 shadow-lg ${
                    isJukeboxPlaying ? 'animate-pulse scale-105 border-mc-gold/40' : 'border-neutral-800'
                  }`}
                  style={{
                    backgroundColor: activeDisc ? (activeDisc === 'pigstep' ? 'rgba(239, 68, 68, 0.2)' : activeDisc === 'chirp' ? 'rgba(34, 211, 238, 0.2)' : activeDisc === 'cat' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(168, 85, 247, 0.2)') : '#1a1008'
                  }}>
                    <Disc className={`w-4 h-4 transition-all duration-500 ${
                      isJukeboxPlaying ? 'text-mc-gold animate-spin' : 'text-neutral-500'
                    }`} />
                  </div>
                  <span className="text-[9px] font-black tracking-widest text-[#9c7b5d] uppercase mt-2 select-none">Jukebox</span>
                </div>

                {/* Animated active lights */}
                {isJukeboxPlaying && (
                  <>
                    <span className="absolute bottom-2 left-2 w-2 h-2 rounded-full bg-red-500 animate-ping delay-75" />
                    <span className="absolute bottom-2 right-2 w-2 h-2 rounded-full bg-green-500 animate-ping" />
                  </>
                )}
              </div>

              {/* Status and title info */}
              <div className="flex flex-col items-center md:items-start text-center md:text-left w-full">
                <span className="px-2 py-0.5 bg-mc-gold/10 border border-mc-gold/30 text-mc-gold text-[8px] font-bold tracking-[0.2em] uppercase rounded-full">Atmospherisch</span>
                <h3 className="text-lg sm:text-xl font-black text-white tracking-tight mt-1 flex items-center justify-center md:justify-start gap-2 w-full">
                  Retro Jukebox
                  <Sparkles size={16} className="text-mc-gold" />
                </h3>
                <p className="text-neutral-400 text-xs mt-1 max-w-sm mx-auto md:mx-0">
                  {activeDisc ? (
                    isJukeboxPlaying ? (
                      <>Spielt gerade: <span className="font-bold text-white capitalize">
                        {activeDisc === 'cat' ? 'Cat 🐈 (Cozy Lofi Loop)' : 
                         activeDisc === 'pigstep' ? 'Pigstep 🔥 (Retro Hip-Hop)' : 
                         activeDisc === 'chirp' ? 'Chirp 🛸 (Space Lounge)' : 
                         (activeStreamTitle || "Eigenen Audio-Stream 📻")}
                      </span></>
                    ) : (
                      <>Schallplatte / Stream eingelegt: <span className="font-bold text-neutral-300 capitalize">
                        {activeDisc === 'cat' ? 'Cat 🐈' : 
                         activeDisc === 'pigstep' ? 'Pigstep 🔥' : 
                         activeDisc === 'chirp' ? 'Chirp 🛸' : 
                         (activeStreamTitle || "Eigener Web-Stream")}
                      </span>. Klicke auf Play!</>
                    )
                  ) : (
                    "Wähle eine klassische Chiptune-Schallplatte oder füge einen Online-Stream ein!"
                  )}
                </p>
                
                {/* Stream buffer indicator and error messages */}
                {(streamLoading || streamError) && (
                  <div className="mt-3 py-1.5 px-3 bg-black/45 border border-neutral-800 rounded-xl flex flex-col gap-1 max-w-sm">
                    {streamLoading && (
                      <div className="flex items-center gap-2 text-[10px] text-mc-gold font-bold">
                        <span className="w-2.5 h-2.5 rounded-full border-2 border-mc-gold border-t-transparent animate-spin shrink-0" />
                        <span>Verbinde mit Stream / Buffer lädt...</span>
                      </div>
                    )}
                    {streamError && (
                      <div className="flex items-center gap-2 text-[10px] text-red-400 font-bold font-sans">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping shrink-0" />
                        <span className="leading-tight">{streamError}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Simple responsive visualizer bars */}
                {isJukeboxPlaying && (
                  <div className="flex items-end gap-1 h-5 mt-3">
                    {[...Array(8)].map((_, i) => (
                      <motion.div 
                        key={`bar-${i}`}
                        animate={{ height: [4, 18, 6, 22, 10, 5, 14, 4][(i + Math.floor(Math.random() * 5)) % 8] }}
                        transition={{ duration: 0.5 + i * 0.08, repeat: Infinity, repeatType: "reverse" }}
                        className="w-1.5 rounded-full"
                        style={{
                          backgroundColor: activeDisc === 'pigstep' ? '#ef4444' : activeDisc === 'chirp' ? '#22d3ee' : activeDisc === 'cat' ? '#10b981' : '#a855f7'
                        }}
                      />
                    ))}
                  </div>
                )}

                {/* Stable YouTube Player Viewport Container */}
                <div 
                  className={`mt-4 overflow-hidden rounded-xl border border-neutral-800 bg-black/80 shadow-[inset_0_4px_12px_rgba(0,0,0,0.8)] transition-all duration-300 ${
                    youtubeVideoId 
                      ? 'w-full max-w-[280px] h-[160px] opacity-100 ring-2 ring-purple-500/20 mx-auto md:mx-0' 
                      : 'w-0 h-0 opacity-0 pointer-events-none'
                  }`}
                >
                  <div id="youtube-player-wrapper" className="w-full h-full relative">
                    <div id="youtube-player-element" className="w-full h-full" />
                  </div>
                </div>

                {/* Spotify Embed Container */}
                <div 
                  className={`mt-4 overflow-hidden rounded-xl transition-all duration-300 ${
                    spotifyUrl 
                      ? 'w-full max-w-[280px] h-[80px] opacity-100 mx-auto md:mx-0' 
                      : 'w-0 h-0 opacity-0 pointer-events-none'
                  }`}
                >
                  {spotifyUrl && (
                    <iframe 
                      src={spotifyUrl} 
                      width="100%" 
                      height="80" 
                      frameBorder="0" 
                      allow="encrypted-media"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Column 2: Controls, Presets & Custom URL Input */}
            <div className="flex flex-col gap-4 justify-between w-full lg:w-7/12 z-10">
              
              {/* Media Controls bar */}
              <div className="flex flex-wrap sm:flex-nowrap items-center justify-between bg-black/40 p-2 rounded-xl border border-neutral-800 gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!activeDisc}
                    onClick={() => {
                      initAudioCtx();
                      const nextPlaying = !isJukeboxPlaying;
                      setIsJukeboxPlaying(nextPlaying);

                      if (youtubeVideoId && ytPlayerRef.current) {
                        try {
                          if (nextPlaying) {
                            ytPlayerRef.current.unMute();
                            ytPlayerRef.current.setVolume(Math.round(jukeboxVolume * 100));
                            ytPlayerRef.current.playVideo();
                          } else {
                            ytPlayerRef.current.pauseVideo();
                          }
                        } catch (clickErr) {
                          console.warn("Direct onClick YouTube action failed:", clickErr);
                        }
                      }

                      if (!youtubeVideoId && streamAudioRef.current) {
                        try {
                          if (nextPlaying) {
                            streamAudioRef.current.volume = jukeboxVolume;
                            if (resolvedStreamUrl) {
                              streamAudioRef.current.play().catch((err: any) => {
                                 console.warn("Direct onClick play failed:", err);
                                 setIsJukeboxPlaying(false);
                                 setStreamError("Fehler bei Wiedergabe. Klicke Play!");
                              });
                            }
                          } else {
                            streamAudioRef.current.pause();
                          }
                        } catch (clickErr) {
                          console.warn("Direct onClick general audio action failed:", clickErr);
                        }
                      }
                    }}
                    className={`p-3 rounded-lg transition-all ${
                      !activeDisc 
                        ? 'text-neutral-600 cursor-not-allowed' 
                        : isJukeboxPlaying 
                          ? 'bg-mc-red/10 text-mc-red border border-mc-red/30' 
                          : 'bg-mc-green/10 text-mc-green border border-mc-green/30 hover:bg-mc-green/20'
                    }`}
                    title={isJukeboxPlaying ? "Pausieren" : "Abspielen"}
                  >
                    {isJukeboxPlaying ? <Pause size={18} /> : <Play size={18} />}
                  </button>

                  <button
                    type="button"
                    disabled={!activeDisc}
                    onClick={() => {
                      setIsJukeboxPlaying(false);
                      setActiveDisc(null);
                      setActiveStreamTitle('');
                    }}
                    className={`p-3 rounded-lg border transition-all ${
                      !activeDisc 
                        ? 'text-neutral-600 border-transparent cursor-not-allowed' 
                        : 'border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800/40'
                    }`}
                    title="Platte auswerfen"
                  >
                    <LogOut size={18} />
                  </button>
                </div>

                {/* Volume slider */}
                <div className="flex items-center gap-2 px-2 border-t sm:border-t-0 sm:border-l border-neutral-800 pt-2 sm:pt-0 w-full sm:w-auto justify-end">
                  <Volume2 size={16} className="text-neutral-400 shrink-0" />
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={jukeboxVolume}
                    onChange={(e) => setJukeboxVolume(parseFloat(e.target.value))}
                    className="w-full sm:w-28 accent-mc-gold cursor-pointer"
                  />
                </div>
              </div>

              {/* Deck container dividing Vinyls and Streams */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
                
                {/* Panel A: Minecraft Vinyl Classics */}
                <div className="space-y-2">
                  <div className="text-[9px] font-black text-neutral-500 uppercase tracking-widest text-center sm:text-left">In-Game Schallplatten (Funde):</div>
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                    
                    {/* CAT RECORD */}
                    <button
                      type="button"
                      onClick={() => {
                        initAudioCtx();
                        setActiveStreamTitle('');
                        if (activeDisc === 'cat') {
                          setIsJukeboxPlaying(!isJukeboxPlaying);
                        } else {
                          setActiveDisc('cat');
                          setIsJukeboxPlaying(true);
                        }
                      }}
                      className={`p-2 rounded-xl border flex flex-col items-center justify-between text-center min-h-[76px] transition-all relative overflow-hidden group/record ${
                        activeDisc === 'cat'
                          ? 'bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                          : 'bg-black/30 border-neutral-800 hover:border-emerald-500/30'
                      }`}
                    >
                      <Disc className={`w-6 h-6 text-emerald-500 group-hover/record:rotate-45 transition-transform ${activeDisc === 'cat' && isJukeboxPlaying ? 'animate-spin' : ''}`} />
                      <div className="flex flex-col items-center mt-1">
                        <span className="text-[10px] font-bold text-white">Cat</span>
                        <span className="text-[7px] text-neutral-400">Cozy Classic</span>
                      </div>
                      <span className="absolute top-1 right-1 text-[6px] text-emerald-400 font-black">START</span>
                    </button>

                    {/* PIGSTEP RECORD */}
                    {unlockedDiscs.includes('pigstep') ? (
                      <button
                        type="button"
                        onClick={() => {
                          initAudioCtx();
                          setActiveStreamTitle('');
                          if (activeDisc === 'pigstep') {
                            setIsJukeboxPlaying(!isJukeboxPlaying);
                          } else {
                            setActiveDisc('pigstep');
                            setIsJukeboxPlaying(true);
                          }
                        }}
                        className={`p-2 rounded-xl border flex flex-col items-center justify-between text-center min-h-[76px] transition-all relative overflow-hidden group/record ${
                          activeDisc === 'pigstep'
                            ? 'bg-red-500/10 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.15)]'
                            : 'bg-black/30 border-neutral-800 hover:border-red-500/30'
                        }`}
                      >
                        <Disc className={`w-6 h-6 text-red-500 group-hover/record:rotate-45 transition-transform ${activeDisc === 'pigstep' && isJukeboxPlaying ? 'animate-spin' : ''}`} />
                        <div className="flex flex-col items-center mt-1">
                          <span className="text-[10px] font-bold text-white">Pigstep</span>
                          <span className="text-[7px] text-neutral-400">Retro Loop</span>
                        </div>
                        <span className="absolute top-1 right-1 text-[6px] text-red-400 font-black font-mono">OK</span>
                      </button>
                    ) : (
                      <div className="p-2 rounded-xl border border-neutral-800/60 bg-black/10 flex flex-col items-center justify-center text-center opacity-60 min-h-[76px]">
                        <Lock size={12} className="text-neutral-500 mb-1" />
                        <span className="text-[9px] font-bold text-neutral-400">Locked</span>
                        <span className="text-[6px] text-neutral-600 uppercase tracking-widest leading-none mt-0.5 text-center">Beim Minen</span>
                      </div>
                    )}

                    {/* CHIRP RECORD */}
                    {unlockedDiscs.includes('chirp') ? (
                      <button
                        type="button"
                        onClick={() => {
                          initAudioCtx();
                          setActiveStreamTitle('');
                          if (activeDisc === 'chirp') {
                            setIsJukeboxPlaying(!isJukeboxPlaying);
                          } else {
                            setActiveDisc('chirp');
                            setIsJukeboxPlaying(true);
                          }
                        }}
                        className={`p-2 rounded-xl border flex flex-col items-center justify-between text-center min-h-[76px] transition-all relative overflow-hidden group/record ${
                          activeDisc === 'chirp'
                            ? 'bg-cyan-500/10 border-cyan-500/50 shadow-[0_0_15px_rgba(34,211,238,0.15)]'
                            : 'bg-black/30 border-neutral-800 hover:border-cyan-500/30'
                        }`}
                      >
                        <Disc className={`w-6 h-6 text-cyan-400 group-hover/record:rotate-45 transition-transform ${activeDisc === 'chirp' && isJukeboxPlaying ? 'animate-spin' : ''}`} />
                        <div className="flex flex-col items-center mt-1">
                          <span className="text-[10px] font-bold text-white">Chirp</span>
                          <span className="text-[7px] text-neutral-400">Synth Retro</span>
                        </div>
                        <span className="absolute top-1 right-1 text-[6px] text-cyan-400 font-black font-mono">OK</span>
                      </button>
                    ) : (
                      <div className="p-2 rounded-xl border border-neutral-800/60 bg-black/10 flex flex-col items-center justify-center text-center opacity-60 min-h-[76px]">
                        <Lock size={12} className="text-neutral-500 mb-1" />
                        <span className="text-[9px] font-bold text-neutral-400">Locked</span>
                        <span className="text-[6px] text-neutral-600 uppercase tracking-widest leading-none mt-0.5 text-center">Beim Minen</span>
                      </div>
                    )}

                  </div>
                </div>

                {/* Panel B: Radio & Custom URLs */}
                <div className="space-y-2">
                  <div className="text-[9px] font-black text-neutral-500 uppercase tracking-widest text-center sm:text-left mt-2 sm:mt-0">Echte Musik & Radio Streams:</div>
                  <div className="grid grid-cols-1 gap-2">
                    
                    <button
                      type="button"
                      onClick={() => {
                        initAudioCtx();
                        const url = "preset:https://streaming.radio.co/s812836261/listen";
                        setActiveStreamTitle("Minecraft Lofi Beats 📻");
                        if (activeDisc === url) {
                          setIsJukeboxPlaying(!isJukeboxPlaying);
                        } else {
                          setActiveDisc(url);
                          setIsJukeboxPlaying(true);
                        }
                      }}
                      className={`p-2 rounded-xl border text-left flex flex-col justify-between h-[36px] transition-all relative overflow-hidden group/preset ${
                        activeDisc === 'preset:https://streaming.radio.co/s812836261/listen'
                          ? 'bg-purple-500/10 border-purple-500/50 shadow-[0_0_10px_rgba(168,85,247,0.1)]'
                          : 'bg-black/30 border-neutral-800 hover:border-purple-500/20'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Music size={12} className="text-purple-400 shrink-0" />
                        <span className="text-[10px] font-bold text-white truncate">Minecraft Lofi ☕</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        initAudioCtx();
                        const url = "preset:https://nightride.fm/stream/nightride.128.mp3";
                        setActiveStreamTitle("Synthwave Space FM 🌌");
                        if (activeDisc === url) {
                          setIsJukeboxPlaying(!isJukeboxPlaying);
                        } else {
                          setActiveDisc(url);
                          setIsJukeboxPlaying(true);
                        }
                      }}
                      className={`p-2 rounded-xl border text-left flex flex-col justify-between h-[36px] transition-all relative overflow-hidden group/preset ${
                        activeDisc === 'preset:https://nightride.fm/stream/nightride.128.mp3'
                          ? 'bg-purple-500/10 border-purple-500/50 shadow-[0_0_10px_rgba(168,85,247,0.1)]'
                          : 'bg-black/30 border-neutral-800 hover:border-purple-500/20'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Music size={12} className="text-purple-400 shrink-0" />
                        <span className="text-[10px] font-bold text-white truncate">Synthwave FM 🌌</span>
                      </div>
                    </button>

                  </div>

                  {/* Custom Audio Stream Input */}
                  <div className="flex items-center gap-1.5 bg-black/40 border border-neutral-800 p-1 rounded-lg">
                    <input
                      type="text"
                      placeholder="Custom MP3 / Stream URL..."
                      value={customSongUrl}
                      onChange={(e) => setCustomSongUrl(e.target.value)}
                      className="bg-transparent border-none text-[10px] focus:ring-0 focus:outline-none flex-grow text-white px-2 py-0.5 truncate placeholder-neutral-600"
                    />
                    <button
                      type="button"
                      disabled={!customSongUrl.trim()}
                      onClick={() => {
                        initAudioCtx();
                        if (!customSongUrl.trim()) return;
                        const url = customSongUrl.trim();
                        setActiveStreamTitle("Dein Web-Song 🎵");
                        setActiveDisc(url);
                        setIsJukeboxPlaying(true);
                      }}
                      className={`px-2 py-1 text-[9px] font-bold text-black rounded-md transition-all ${
                        customSongUrl.trim() 
                          ? 'bg-mc-gold hover:bg-yellow-400 cursor-pointer' 
                          : 'bg-neutral-800 text-neutral-600 cursor-not-allowed'
                      }`}
                    >
                      Laden
                    </button>
                  </div>
                  <div className="text-[8px] text-neutral-500 leading-tight">
                    * Spielt jegliche direkte Audio-M3U/MP3-Adresse ab (z.B. von Discord / Audio-Dateien).
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>



      <footer className="relative z-10 border-t border-neutral-800/50 pt-12 pb-40 md:pb-28 bg-black/20">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-3 opacity-30">
            <Gamepad2 size={24} />
            <span className="font-bold tracking-tight">BESTER MINECRAFT REALMS &copy; 2026</span>
          </div>
          <div className="flex flex-col items-center md:items-end gap-2 text-sm text-neutral-500">
            <div className="flex gap-8">
              <a href="#" className="hover:text-white transition-colors">Discord</a>
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Imprint</a>
            </div>
            <span className="text-xs opacity-50 font-mono mt-2 relative z-50">v1.21.5</span>
          </div>
        </div>
      </footer>

      {/* Create Clan Modal */}
      <AnimatePresence>
        {showCreateClan && (
          <div key="create-clan-modal-container" className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div 
              key="create-clan-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateClan(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              key="create-clan-content"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-8">
                <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
                  <UserPlus className="text-mc-gold" />
                  Clan gründen
                </h3>
                
                <form onSubmit={handleCreateClan} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Clan Name</label>
                    <input 
                      name="clanName"
                      placeholder="z.B. Die Zerstörer"
                      required
                      maxLength={32}
                      className="w-full bg-black/40 border border-neutral-800 rounded-xl p-4 text-white focus:border-mc-gold outline-none transition-colors"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Clan Tag (3-4 Zeichen)</label>
                    <input 
                      name="clanTag"
                      placeholder="TAG"
                      required
                      maxLength={4}
                      className="w-full bg-black/40 border border-neutral-800 rounded-xl p-4 text-white focus:border-mc-gold outline-none transition-colors uppercase font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Beschreibung</label>
                    <textarea 
                      name="clanDescription"
                      placeholder="Euer Motto..."
                      className="w-full bg-black/40 border border-neutral-800 rounded-xl p-4 text-white focus:border-mc-gold outline-none transition-colors resize-none h-24"
                    />
                  </div>

                  <button 
                    type="submit"
                    className="w-full px-6 py-4 rounded-xl font-bold bg-mc-gold text-black hover:bg-yellow-500 transition-all shadow-lg shadow-mc-gold/20 flex items-center justify-center gap-2"
                  >
                    Clan jetzt erstellen
                  </button>
                  <button 
                    type="button"
                    onClick={() => setShowCreateClan(false)}
                    className="w-full py-2 text-xs text-neutral-500 hover:text-white transition-colors"
                  >
                    Abbrechen
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Copy Notification */}
      <AnimatePresence>
        {copied && (
          <motion.div
            key="copied-notification"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-mc-red text-white px-6 py-3 rounded-xl font-bold shadow-2xl flex items-center gap-2"
          >
            <CheckCircle2 size={20} />
            Erfolgreich kopiert!
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fullscreen Image Lightbox */}
      <AnimatePresence>
        {fullscreenImage && (
          <motion.div
            key="fullscreen-image"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[11000] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 sm:p-8 cursor-zoom-out"
            onClick={() => setFullscreenImage(null)}
          >
            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              src={fullscreenImage}
              alt="Fullscreen Chat Upload"
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
              onClick={(e) => e.stopPropagation()} // Prevent clicking the image itself from closing it, optional, but useful if we add buttons inside later. Actually let's let clicking it close it too since it's a lightbox.
            />
            <button 
              className="absolute top-6 right-6 p-3 bg-black/50 hover:bg-white/10 rounded-full text-white backdrop-blur-md transition-colors"
              onClick={() => setFullscreenImage(null)}
            >
              <X size={24} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Cinematic Splash Screen */}
      <AnimatePresence>
        {showSplash && (
          <motion.div
            key="global-splash-screen"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="fixed inset-0 z-[10000] bg-black flex flex-col items-center justify-center select-none"
          >
            <div className="absolute inset-x-0 bottom-0 top-[20%] bg-gradient-to-t from-black via-black/90 to-transparent pointer-events-none z-0" />
            <div className="absolute w-[300px] h-[300px] bg-mc-red/10 rounded-full blur-[100px] z-0 animate-pulse" />
            
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.1, opacity: 0 }}
              transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 flex flex-col items-center gap-6"
            >
              <div className="relative group">
                <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-mc-red via-mc-gold to-mc-red opacity-70 blur-xl group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-pulse"></div>
                <img
                  src="https://yt3.googleusercontent.com/qwGGKBMp6Fph_qtakNCBlQLk3gHZcgh2fupaLhFwakknR7Idh056nFgN8jeeK9MqDvnBBQ0SHw=s160-c-k-c0x00ffffff-no-rj"
                  alt="Server Icon"
                  className="relative w-32 h-32 rounded-full border-4 border-mc-gold shadow-2xl bg-neutral-900 object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="text-center space-y-2 mt-4">
                <motion.h1
                  initial={{ letterSpacing: "0.1em", opacity: 0 }}
                  animate={{ letterSpacing: "0.25em", opacity: 1 }}
                  transition={{ delay: 0.2, duration: 1.2 }}
                  className="text-white font-black text-3xl uppercase tracking-[0.25em] font-sans drop-shadow-[0_4px_12px_rgba(239,68,68,0.5)]"
                >
                  DAMPF
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 0.6, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.8 }}
                  className="text-neutral-400 text-xs font-black uppercase tracking-[0.4em] font-mono"
                >
                  COMMUNITY APP
                </motion.p>
              </div>

              <div className="w-48 h-1 bg-neutral-900 rounded-full overflow-hidden border border-neutral-800/50 mt-6 relative">
                <motion.div
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 1.8, ease: "easeInOut" }}
                  className="h-full bg-gradient-to-r from-mc-red via-mc-gold to-mc-red"
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2, duration: 0.5 }}
              className="absolute bottom-12 left-1/2 -translate-x-1/2 text-xs font-mono text-neutral-500 tracking-widest z-50"
            >
              v1.21.5
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Clash Royale Coming Soon Modal */}
      <AnimatePresence>
        {showClashComingSoon && (
          <div key="clash-coming-soon-container" className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              key="clash-coming-soon-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowClashComingSoon(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              key="clash-coming-soon-content"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-neutral-900 border-2 border-amber-500/30 rounded-2xl w-full max-w-md overflow-hidden shadow-[0_0_50px_rgba(245,158,11,0.15)] p-8 text-center space-y-6"
            >
              <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shadow-lg shadow-amber-500/5 animate-pulse">
                <Crown size={32} className="text-amber-500" />
              </div>

              <div className="space-y-2">
                <h3 className="text-white font-black text-2xl tracking-[0.2em] uppercase drop-shadow-mc">
                  Clash Royale
                </h3>
                <p className="text-amber-400 font-bold uppercase tracking-widest text-xs">
                  In Kürze verfügbar! 👑
                </p>
              </div>

              <p className="text-neutral-400 text-sm">
                Die Arena wird derzeit überarbeitet, um dir das beste Echtzeit-Kampferlebnis zu bieten. Schwebende Truppen, mächtige Zauber und 3D-Königreiche erwarten dich bald!
              </p>

              <button
                onClick={() => setShowClashComingSoon(false)}
                className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-widest shadow-lg shadow-amber-500/20 active:translate-y-0.5 transition-all outline-none border-b-4 border-amber-700"
              >
                Verstanden
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Login Modal */}
      <AnimatePresence>
        {showLoginModal && (
          <div key="login-modal-container" className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              key="login-modal-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLoginModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              key="login-modal-content"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-8">
                <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
                  <LogIn className="text-mc-gold" />
                  {isRegistering ? 'Account erstellen' : 'Anmelden'}
                </h3>
                
                <form onSubmit={handleAuth} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Benutzername</label>
                    <input 
                      name="username"
                      placeholder="Dein Name"
                      required
                      className="w-full bg-black/40 border border-neutral-800 rounded-xl p-4 text-white focus:border-mc-gold outline-none transition-colors"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Passwort</label>
                    <input 
                      type="password"
                      name="password"
                      placeholder="••••••••"
                      required
                      className="w-full bg-black/40 border border-neutral-800 rounded-xl p-4 text-white focus:border-mc-gold outline-none transition-colors"
                    />
                  </div>

                  {loginError && (
                    <div className="space-y-2">
                      <p className="text-mc-red text-[11px] font-bold bg-mc-red/10 p-4 rounded-xl border border-mc-red/20 shadow-inner">
                        <ShieldAlert size={14} className="inline mr-2 mb-0.5" />
                        {loginError}
                      </p>
                      <button 
                        type="button"
                        onClick={() => window.open(window.location.href, '_blank')}
                        className="w-full text-[10px] text-mc-gold hover:underline font-bold uppercase tracking-widest text-center py-1 animate-pulse"
                      >
                        Login im neuen Fenster versuchen (Empfohlen)
                      </button>
                    </div>
                  )}

                  <button 
                    type="submit"
                    className="w-full px-6 py-4 rounded-xl font-bold bg-mc-gold text-black hover:bg-yellow-500 transition-all shadow-lg shadow-mc-gold/20"
                  >
                    {isRegistering ? 'Registrieren' : 'Jetzt Einloggen'}
                  </button>
                </form>

                <div className="mt-6 flex flex-col gap-4">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-neutral-800"></div></div>
                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-neutral-900 px-2 text-neutral-500">Oder</span></div>
                  </div>

                  <button 
                    onClick={loginWithGoogle}
                    className="w-full px-6 py-4 rounded-xl font-bold bg-white text-black hover:bg-neutral-200 transition-all flex items-center justify-center gap-2"
                  >
                    <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google Logo" />
                    Mit Google anmelden
                  </button>

                  <button 
                    onClick={loginWithDiscord}
                    className="w-full px-6 py-4 rounded-xl font-bold bg-[#5865F2] text-white hover:bg-[#4752C4] transition-all flex items-center justify-center gap-2"
                  >
                    <Globe size={18} />
                    Mit Discord anmelden
                  </button>
                  <div className="text-[10px] text-center text-neutral-600 opacity-50 -mt-2">
                    ID: {import.meta.env.VITE_DISCORD_PROVIDER_ID || 'discord.com'}
                  </div>

                  <button 
                    onClick={() => setIsRegistering(!isRegistering)}
                    className="text-center text-xs text-neutral-500 hover:text-white transition-colors"
                  >
                    {isRegistering ? 'Bereits einen Account? Hier einloggen' : 'Noch keinen Account? Hier registrieren'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Offline Progress Modal */}
      <AnimatePresence>
        {offlineReport && (
          <div key="offline-modal-container" className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/50 backdrop-blur-xs">
            <motion.div 
              key="offline-modal-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOfflineReport(null)}
              className="absolute inset-0 bg-black/80"
            />
            <motion.div 
              key="offline-modal-content"
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-md overflow-hidden shadow-[0_0_50px_rgba(251,191,36,0.15)] flex flex-col z-10"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-mc-gold to-yellow-500" />
              
              <div className="p-8 text-center flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-mc-gold/10 border border-mc-gold/20 flex items-center justify-center mb-6">
                  <Pickaxe size={30} className="text-mc-gold animate-bounce" />
                </div>
                
                <h3 className="text-2xl font-black text-white tracking-wide uppercase drop-shadow-mc mb-2">
                  Offline-Ausbeute!
                </h3>
                
                <p className="text-sm text-neutral-400 mb-6 max-w-xs leading-relaxed">
                  Dein Bergbau-Team war fleißig und hat weitergearbeitet, während du offline warst!
                </p>

                <div className="w-full space-y-4 mb-8">
                  {/* Time Gone */}
                  <div className="bg-neutral-950/40 border border-neutral-800/60 rounded-2xl p-4 flex items-center justify-between text-left">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-neutral-900 flex items-center justify-center text-neutral-400">
                        <Clock size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Abwesenheit</p>
                        <p className="text-sm font-black text-neutral-200">
                          {(() => {
                            const secs = offlineReport.seconds;
                            const h = Math.floor(secs / 3600);
                            const m = Math.floor((secs % 3600) / 60);
                            const s = secs % 60;
                            const textList: string[] = [];
                            if (h > 0) textList.push(`${h} Std.`);
                            if (m > 0) textList.push(`${m} Min.`);
                            if (s > 0 || textList.length === 0) textList.push(`${s} Sek.`);
                            return textList.join(' ');
                          })()}
                        </p>
                      </div>
                    </div>
                    {offlineReport.seconds >= 43200 && (
                      <span className="text-[10px] uppercase font-bold px-2.5 py-1 bg-mc-red/10 border border-mc-red/20 text-mc-red rounded-lg">Capped (12h)</span>
                    )}
                  </div>

                  {/* Coins Earned */}
                  <div className="bg-neutral-950/40 border border-neutral-800/60 rounded-2xl p-4 flex items-center justify-between text-left">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-mc-gold/10 flex items-center justify-center text-mc-gold font-bold">
                        🪙
                      </div>
                      <div>
                        <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Erhaltene Münzen</p>
                        <p className="text-base font-black text-mc-gold italic">
                          +{offlineReport.coins.toLocaleString('de-DE')} Coins
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* XP Earned */}
                  <div className="bg-neutral-950/40 border border-neutral-800/60 rounded-2xl p-4 flex items-center justify-between text-left">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                        <Award size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Erhaltene XP</p>
                        <p className="text-base font-black text-emerald-400">
                          +{offlineReport.xp.toLocaleString('de-DE')} XP
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => setOfflineReport(null)}
                  className="w-full px-6 py-4 rounded-2xl font-black text-white bg-emerald-600 hover:bg-emerald-500 active:scale-95 border-b-4 border-emerald-800 hover:border-emerald-700 transition-all shadow-lg uppercase tracking-widest text-xs"
                >
                  Belohnungen Einsammeln
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Clients Modal */}
      <AnimatePresence>
        {showClientsModal && (
          <div key="clients-modal-container" className="fixed inset-0 z-[100] flex items-center justify-center p-6 text-left">
            <motion.div 
              key="clients-modal-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowClientsModal(false)}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            />
            <motion.div 
              key="clients-modal-content"
              initial={{ scale: 0.9, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 30 }}
              className="relative bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-4xl overflow-hidden shadow-[0_0_50px_rgba(147,51,234,0.15)] max-h-[92vh] flex flex-col z-10"
            >
              {/* Header */}
              <div className="p-6 md:p-8 border-b border-neutral-800/80 flex items-center justify-between shrink-0 bg-neutral-900 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-indigo-500/5 pointer-events-none" />
                <div className="relative z-10">
                  <span className="text-[10px] font-black tracking-[0.2em] uppercase text-purple-400 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20">Website & Client Integration</span>
                  <h3 className="text-2xl md:text-3xl font-black uppercase text-white mt-2.5 flex items-center gap-2.5">
                    <Cpu className="text-purple-400" size={26} />
                    MC HUB mit Clients nutzen
                  </h3>
                  <p className="text-neutral-500 text-xs md:text-sm mt-1">Hier erfährst du, wie du das Dashboard und unsere Server direkt über Minecraft-Clients aufrufen kannst!</p>
                </div>
                <button 
                  type="button" 
                  onClick={() => setShowClientsModal(false)}
                  className="p-2.5 hover:bg-neutral-800 rounded-xl text-neutral-400 hover:text-white transition-all hover:rotate-90 duration-300"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Sub-navigation inside modal */}
              <div className="flex overflow-x-auto border-b border-neutral-800/60 bg-neutral-950/40 p-2 gap-1.5 shrink-0 scrollbar-none">
                <button
                  onClick={() => setClientActiveTab('lunar')}
                  className={`px-4 py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 ${
                    clientActiveTab === 'lunar' 
                      ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30 shadow-[0_0_15px_rgba(147,51,234,0.1)]' 
                      : 'text-neutral-400 hover:text-white border border-transparent hover:bg-neutral-900'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                  Lunar Client
                </button>
                <button
                  onClick={() => setClientActiveTab('badlion')}
                  className={`px-4 py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 ${
                    clientActiveTab === 'badlion' 
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                      : 'text-neutral-400 hover:text-white border border-transparent hover:bg-neutral-900'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Badlion Client
                </button>
                <button
                  onClick={() => setClientActiveTab('labymod')}
                  className={`px-4 py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 ${
                    clientActiveTab === 'labymod' 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                      : 'text-neutral-400 hover:text-white border border-transparent hover:bg-neutral-900'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  LabyMod 4
                </button>
                <button
                  onClick={() => setClientActiveTab('vanilla')}
                  className={`px-4 py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 ${
                    clientActiveTab === 'vanilla' 
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                      : 'text-neutral-400 hover:text-white border border-transparent hover:bg-neutral-900'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  Vanilla & Launcher
                </button>
                <button
                  onClick={() => setClientActiveTab('browser-mod')}
                  className={`px-4 py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-2 ${
                    clientActiveTab === 'browser-mod' 
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.1)]' 
                      : 'text-neutral-400 hover:text-white border border-transparent hover:bg-neutral-900'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  In-Game Browser Mod
                </button>
              </div>

              {/* Scrollable Modal Content */}
              <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 text-neutral-300">
                
                {clientActiveTab === 'lunar' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 15 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    className="space-y-6 text-left"
                  >
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-purple-500/10 text-purple-400 rounded-2xl border border-purple-500/20 shrink-0">
                        <Zap size={28} />
                      </div>
                      <div>
                        <h4 className="text-xl font-black text-white uppercase tracking-tight">Lunar Client Integration</h4>
                        <p className="text-neutral-400 text-sm mt-1">Lunar Client ist der beliebteste PvP-Client für Minecraft und bietet eine fantastische FPS-Performance.</p>
                      </div>
                    </div>

                    <div className="p-5 bg-black/40 border border-neutral-800/80 rounded-2xl space-y-4">
                      <div className="flex gap-3">
                        <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">1</span>
                        <div>
                          <p className="text-sm font-bold text-white">Lunar Client starten</p>
                          <p className="text-xs text-neutral-400 mt-1">Stelle sicher, dass du die neueste Version von Lunar Client nutzt und weise genügend RAM in den Einstellungen zu.</p>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">2</span>
                        <div>
                          <p className="text-sm font-bold text-white">Web-Verbindung aktivieren</p>
                          <p className="text-xs text-neutral-400 mt-1">Mit Lunar Client kannst du MC HUB direkt als Server-IP hinzufügen. Nutze den Realm-Zugangscode für die Registrierung deiner Minecraft-UUID.</p>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">3</span>
                        <div>
                          <p className="text-sm font-bold text-white">Web-Hud auf der Website abrufen</p>
                          <p className="text-xs text-neutral-400 mt-1">Richte deine Spielertastatur, Cosmetics und HUD-Overlay-Farbe in deinem Profil ein. Sie wird automatisch für kompatible Clients synchronisiert!</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="mc-card p-5 border-purple-500/10 hover:border-purple-500/30 transition-all flex flex-col justify-between">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-purple-400 tracking-wider">Download</span>
                          <h5 className="font-bold text-white mt-1 text-sm">Download Lunar Client</h5>
                          <p className="text-xs text-neutral-505 mt-1">Hol dir den Client für Windows, macOS oder Linux für die beste Performance.</p>
                        </div>
                        <a href="https://www.lunarclient.com/" target="_blank" rel="noreferrer" className="mc-button mc-button-secondary py-2 mt-4 text-xs font-bold w-full border-purple-500/20 text-purple-400 hover:bg-purple-500/10 flex items-center justify-center gap-1">
                          Zur Lunar-Website <ExternalLink size={12} />
                        </a>
                      </div>

                      <div className="mc-card p-5 border-purple-500/10 hover:border-purple-500/30 transition-all flex flex-col justify-between">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-purple-400 tracking-wider">Skin-Sync</span>
                          <h5 className="font-bold text-white mt-1 text-sm">Automatischer Skin-Sync</h5>
                          <p className="text-xs text-neutral-505 mt-1">Deine Web-Anpassungen (Skins, Name, Glow) werden in Echtzeit als Minecraft Skin-Referenz bereitgestellt.</p>
                        </div>
                        <button type="button" onClick={() => triggerToast('xp', 'SKIN SYNCED 🎭', 'Deine Skins und Farben wurden für Lunar Client erfolgreich bereitgestellt!')} className="mc-button bg-purple-600 text-white font-bold py-2 mt-4 text-xs w-full hover:bg-purple-500 transition-colors">
                          Skin jetzt synchronisieren
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {clientActiveTab === 'badlion' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 15 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    className="space-y-6 text-left"
                  >
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/20 shrink-0">
                        <Award size={28} />
                      </div>
                      <div>
                        <h4 className="text-xl font-black text-white uppercase tracking-tight">Badlion Client Support</h4>
                        <p className="text-neutral-400 text-sm mt-1">Badlion bietet herausragende Mod-Pakete, unübertroffenen Anticheat-Schutz und weitreichende Personalisierung.</p>
                      </div>
                    </div>

                    <div className="p-5 bg-black/40 border border-neutral-800/80 rounded-2xl space-y-4">
                      <div className="flex gap-3">
                        <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">1</span>
                        <div>
                          <p className="text-sm font-bold text-white">Client-Verbindung</p>
                          <p className="text-xs text-neutral-400 mt-1">Gib unter Mehrspieler-Servern die Zugangs-Ip deines Realms an. Badlion verbindet dich verschlüsselt.</p>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">2</span>
                        <div>
                          <p className="text-sm font-bold text-white">In-Game HUD Mods</p>
                          <p className="text-xs text-neutral-400 mt-1">Badlion bietet über 70 Mods direkt im Client. Installiere dir Keystrokes und Minimapas für die beste Arena-Erfahrung.</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="mc-card p-5 border-amber-500/10 hover:border-amber-500/30 transition-all flex flex-col justify-between">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">Offizielle Seite</span>
                          <h5 className="font-bold text-white mt-1 text-sm">Download Badlion Client</h5>
                          <p className="text-xs text-neutral-505 mt-1">Hunderte kostenlose Mods bereits integriert im Launcher.</p>
                        </div>
                        <a href="https://www.badlion.net/" target="_blank" rel="noreferrer" className="mc-button mc-button-secondary py-2 mt-4 text-xs font-bold w-full border-amber-500/20 text-amber-400 hover:bg-amber-500/10 flex items-center justify-center gap-1">
                          Zur Badlion-Website <ExternalLink size={12} />
                        </a>
                      </div>

                      <div className="mc-card p-5 border-amber-500/10 hover:border-amber-500/30 transition-all flex flex-col justify-between">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">Anticheat</span>
                          <h5 className="font-bold text-white mt-1 text-sm">BAC Schutz auf unseren Servern</h5>
                          <p className="text-xs text-neutral-505 mt-1">Unsere Realms nutzen serverseitige Verifikation, um ein sicheres und faires Gameplay zu garantieren.</p>
                        </div>
                        <div className="text-[10px] font-black text-amber-400 uppercase tracking-widest bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 text-center mt-4">
                          BAC GESCHÜTZT 🛡️
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {clientActiveTab === 'labymod' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 15 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    className="space-y-6 text-left"
                  >
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20 shrink-0">
                        <Users size={28} />
                      </div>
                      <div>
                        <h4 className="text-xl font-black text-white uppercase tracking-tight">LabyMod 4 Voice Chat & Cosmetics</h4>
                        <p className="text-neutral-400 text-sm mt-1">LabyMod 4 bietet dir einen nahtlosen In-game Sprachchat, eigene Cosmetics und erstklassige Anpassbarkeit.</p>
                      </div>
                    </div>

                    <div className="p-5 bg-black/40 border border-neutral-800/80 rounded-2xl space-y-4">
                      <p className="text-xs text-neutral-400 italic">Nutze diese genialen Features von LabyMod, um dich mit deinen Freunden auf den Realms zu koordinieren:</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="bg-neutral-900/50 p-3 rounded-xl border border-neutral-800">
                          <p className="font-bold text-white mb-1">🎙️ Positional Voice Chat</p>
                          <p className="text-neutral-500">Höre deine Mates im Clan-Team-Chat räumlich, je nachdem wo sie stehen!</p>
                        </div>
                        <div className="bg-neutral-900/50 p-3 rounded-xl border border-neutral-800">
                          <p className="font-bold text-white mb-1">🎭 Custom Emotes & Skins</p>
                          <p className="text-neutral-500">Präsentiere deine im Web-Shop errungenen Ränge und Abzeichen direkt ingame.</p>
                        </div>
                      </div>
                    </div>

                    <div className="mc-card p-5 border-emerald-500/10 hover:border-emerald-500/30 transition-all flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Sprachchat</span>
                        <h5 className="font-bold text-white mt-1 text-sm">Download LabyMod 4</h5>
                        <p className="text-xs text-neutral-505 mt-1">Hol dir den flexibelsten Mod-Client mit erstklassiger Performance und unzähligen Addons.</p>
                      </div>
                      <a href="https://www.labymod.net/" target="_blank" rel="noreferrer" className="mc-button bg-emerald-600 text-black font-extrabold py-2 mt-4 text-xs w-full hover:bg-emerald-500 transition-all flex items-center justify-center gap-1">
                        Zur LabyMod-Website <ExternalLink size={12} />
                      </a>
                    </div>
                  </motion.div>
                )}

                {clientActiveTab === 'vanilla' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 15 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    className="space-y-6 text-left"
                  >
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-red-500/10 text-red-400 rounded-2xl border border-red-500/20 shrink-0">
                        <Gamepad2 size={24} />
                      </div>
                      <div>
                        <h4 className="text-xl font-black text-white uppercase tracking-tight">Vanilla Minecraft & Multi-Platform Launcher</h4>
                        <p className="text-neutral-400 text-sm mt-1">Egal ober Java Edition auf dem PC oder Bedrock (Pocket Edition) auf deinem Handy/Tablet – der Zugang steht dir rund um die Uhr offen.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-black/40 border border-neutral-850 p-5 rounded-2xl space-y-3">
                        <span className="px-2 py-0.5 rounded text-[8px] font-black tracking-widest uppercase bg-red-600 text-white">JAVA EDITION</span>
                        <h5 className="font-bold text-white text-sm">PC / Mac / Linux</h5>
                        <ul className="text-xs text-neutral-500 space-y-1 list-disc list-inside">
                          <li>Starte den offiziellen Launcher</li>
                          <li>Wähle die neueste Version (Vanilla)</li>
                          <li>Unter Mehrspieler ➜ Server hinzufügen</li>
                          <li>Verwende den Zugangscode unten!</li>
                        </ul>
                      </div>

                      <div className="bg-black/40 border border-neutral-850 p-5 rounded-2xl space-y-3">
                        <span className="px-2 py-0.5 rounded text-[8px] font-black tracking-widest uppercase bg-sky-600 text-white">BEDROCK EDITION</span>
                        <h5 className="font-bold text-white text-sm">Handy / Playstation / XBOX</h5>
                        <ul className="text-xs text-neutral-500 space-y-1 list-disc list-inside">
                          <li>Öffne Minecraft auf deinem Device</li>
                          <li>Klicke auf Spielen ➜ Reiter "Server"</li>
                          <li>Scrolle ganz nach unten ➜ Server hinzufügen</li>
                          <li>Egal ob iOS/Android – absolut crossplay!</li>
                        </ul>
                      </div>
                    </div>
                  </motion.div>
                )}

                {clientActiveTab === 'browser-mod' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 15 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    className="space-y-6 text-left"
                  >
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-2xl border border-cyan-500/20 shrink-0">
                        <Globe size={28} />
                      </div>
                      <div>
                        <h4 className="text-xl font-black text-white uppercase tracking-tight">Website direkt im Minecraft-Spiel aufrufen</h4>
                        <p className="text-neutral-400 text-sm mt-1">Hol dir das MC HUB Dashboard als echtes in-game Terminal direkt in deine Minecraft-Welt mit Minecraft-Browser-Mods!</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-black/40 border border-neutral-800/80 p-5 rounded-2xl space-y-3">
                        <h5 className="font-bold text-white text-sm flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-cyan-450" />
                          Web Displays Mod (Forge)
                        </h5>
                        <p className="text-xs text-neutral-400 leading-relaxed">
                          Mit dieser legendären Mod kannst du gigantische Bildschirme in deiner Minecraft-Welt bauen! Erstelle einen Web-Screen (3x5 bis 16x16 Blöcke), klicke ihn mit der rechten Maustaste an und tippe unsere Website ein.
                        </p>
                        <div className="p-2 border border-neutral-800 rounded bg-neutral-950 font-mono text-[10px] text-zinc-400 flex justify-between items-center select-all">
                          <span>{window.location.origin}</span>
                        </div>
                      </div>

                      <div className="bg-black/40 border border-neutral-800/80 p-5 rounded-2xl space-y-3">
                        <h5 className="font-bold text-white text-sm flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-cyan-450" />
                          In-Game Web Browser (Fabric)
                        </h5>
                        <p className="text-xs text-neutral-400 leading-relaxed">
                          Öffne ein in-game Tablet, Laptop oder füge ein transparentes Overlay direkt an den Bildschirmrand, um Münzen zu farmen, Musik abzuspielen oder zu chatten, während du Holz hackst!
                        </p>
                        <button 
                          type="button"
                          onClick={() => {
                            const origin = window.location.origin;
                            navigator.clipboard.writeText(origin);
                            triggerToast('quest', 'ADRESSE KOPIERT 📌', 'Die Portal-Webadresse wurde in deine Zwischenablage kopiert.');
                          }} 
                          className="mc-button mc-button-secondary py-1 text-[10px] font-black uppercase text-cyan-400 border-cyan-500/20 hover:bg-cyan-500/10 transition-colors w-full flex items-center justify-center gap-1.5"
                        >
                          Echtzeit-URL kopieren <Copy size={12} />
                        </button>
                      </div>
                    </div>

                    <div className="p-4 bg-cyan-950/20 border border-cyan-550/20 rounded-2xl text-center">
                      <p className="text-xs text-cyan-200 font-bold">
                        💡 Tipp: Melde dich einmalig mit deiner E-Mail und Passwort an – so speichert das In-game-Terminal dein Profil dauerhaft ab!
                      </p>
                    </div>
                  </motion.div>
                )}

              </div>

              {/* Fixed Footer with general connections / PWA Quick installer */}
              <div className="p-6 bg-neutral-955 border-t border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                    <Rocket size={16} />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-white leading-none">Lieber als eigene Anwendung?</p>
                    <p className="text-[10px] text-neutral-500 mt-1">Installiere den MC HUB direkt als Standalone-Client auf deinem Desktop.</p>
                  </div>
                </div>

                <div className="flex gap-2.5 w-full sm:w-auto">
                  {showInstallButton ? (
                    <button
                      type="button"
                      onClick={() => {
                        handleInstallClick();
                        setShowClientsModal(false);
                      }}
                      className="mc-button bg-emerald-600 hover:bg-emerald-500 text-black font-extrabold px-5 py-2 rounded-xl text-xs uppercase tracking-wider grow sm:grow-0"
                    >
                      Desktop-App Installieren
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="mc-button border border-neutral-800 text-neutral-500 px-5 py-2 rounded-xl text-xs uppercase tracking-wider grow sm:grow-0 cursor-not-allowed"
                    >
                      Desktop-App Bereits installiert
                    </button>
                  )}
                  <button 
                    type="button"
                    onClick={() => setShowClientsModal(false)}
                    className="mc-button bg-neutral-800 hover:bg-neutral-700 text-white px-5 py-2 rounded-xl text-xs uppercase tracking-wider grow sm:grow-0"
                  >
                    Schließen
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Clan Invite Modal */}
      <AnimatePresence>
        {showInviteModal && (
          <div key="clan-invite-modal-container" className="fixed inset-0 z-[120] flex items-center justify-center p-6 text-left">
            <motion.div 
              key="clan-invite-modal-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowInviteModal(false)}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            />
            <motion.div 
              key="clan-invite-modal-content"
              initial={{ scale: 0.9, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 30 }}
              className="relative bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-md overflow-hidden shadow-[0_0_50px_rgba(245,158,11,0.15)] flex flex-col z-10 p-6 md:p-8"
            >
              {/* Header */}
              <div className="flex items-center gap-4 border-b border-neutral-800 pb-5 mb-6">
                <div className="p-3 bg-mc-gold/10 text-mc-gold rounded-2xl border border-mc-gold/20 shrink-0 animate-pulse">
                  <Sparkles size={24} />
                </div>
                <div>
                  <h4 className="text-lg font-black text-white uppercase tracking-wider">Clan-Einladung</h4>
                  <p className="text-neutral-500 text-[10px] uppercase font-bold tracking-widest mt-0.5">Exklusiver Direktlink</p>
                </div>
              </div>

              {/* Clan Information Card */}
              {invitedClan ? (
                <div className="space-y-6">
                  <div className="bg-neutral-950/50 border border-neutral-800 p-5 rounded-2xl text-center space-y-4">
                    <div className="w-16 h-16 bg-neutral-900 mx-auto rounded-2xl border border-neutral-800 flex items-center justify-center text-3xl font-bold text-mc-gold shadow-[0_0_20px_rgba(245,158,11,0.05)] font-mono">
                      {invitedClan.tag}
                    </div>
                    <div>
                      <h3 className="text-2xl font-extrabold text-white">{invitedClan.name}</h3>
                      <p className="text-xs font-mono text-mc-gold mt-1">[{invitedClan.tag}] • Level {invitedClan.level || 1}</p>
                    </div>
                    {invitedClan.description && (
                      <p className="text-neutral-400 text-xs italic bg-neutral-900/40 p-3 rounded-xl border border-neutral-800/50">
                        "{invitedClan.description}"
                      </p>
                    )}
                    <div className="flex justify-around items-center pt-2 text-[10px] font-black uppercase text-neutral-500 tracking-wider">
                      <div>
                        <span className="block text-white text-base font-bold font-mono">{invitedClan.memberCount}</span>
                        Mitglieder
                      </div>
                      <div className="w-px h-6 bg-neutral-800" />
                      <div>
                        <span className="block text-white text-base font-bold font-mono">{(invitedClan.totalKills || 0).toLocaleString()}</span>
                        Kills
                      </div>
                    </div>
                  </div>

                  {!user ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl text-center text-orange-400">
                        <p className="text-xs font-bold">
                          ⚠️ Du bist aktuell nicht angemeldet. Bitte logge dich ein, um dieser Clan-Einladung beizutreten!
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setShowInviteModal(false);
                          setShowLoginModal(true);
                        }}
                        className="w-full py-4 mc-button bg-mc-gold text-black font-extrabold tracking-widest uppercase text-xs hover:bg-amber-400 rounded-xl"
                      >
                        Jetzt einloggen & beitreten ⚡
                      </button>
                    </div>
                  ) : myClan ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-center text-red-400">
                        <p className="text-xs font-bold">
                          ⚠️ Du bist bereits Mitglied im Clan "{myClan.name}". Du musst deinen aktuellen Clan verlassen, um der Einladung beizutreten!
                        </p>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => {
                            leaveClan(myClan.id);
                          }}
                          className="flex-1 py-3 border border-red-500/20 text-red-500 font-bold text-xs uppercase rounded-xl hover:bg-red-500/5"
                        >
                          Clan verlassen
                        </button>
                        <button
                          onClick={() => setShowInviteModal(false)}
                          className="flex-1 py-3 bg-neutral-800 text-neutral-400 font-bold text-xs uppercase rounded-xl hover:bg-neutral-700"
                        >
                          Abbrechen
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <button
                        onClick={() => acceptDirectInvite(invitedClan.id)}
                        className="w-full py-4 mc-button bg-emerald-500 text-black font-black uppercase tracking-widest text-xs hover:bg-emerald-400 transition-all shadow-[0_0_30px_rgba(16,185,129,0.2)] rounded-2xl flex items-center justify-center gap-2"
                      >
                        <span>Einladung annehmen & beitreten ⚡</span>
                      </button>
                      <button
                        onClick={() => setShowInviteModal(false)}
                        className="w-full py-3 bg-neutral-800 text-neutral-400 uppercase font-black tracking-widest text-[10px] rounded-xl hover:bg-neutral-700 transition"
                      >
                        Später
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 space-y-4 text-neutral-500">
                  <div className="w-10 h-10 border-4 border-mc-gold border-t-transparent rounded-full animate-spin mx-auto mr-auto" />
                  <p className="text-sm italic animate-pulse">Lade Clan-Einladungsdaten...</p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Profile Modal */}
      <AnimatePresence>
        {showProfileModal && (
          <div key="profile-modal-container" className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              key="profile-modal-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowProfileModal(false); setEditingProfileId(null); }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              key="profile-modal-content"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col z-10"
            >
              <form onSubmit={saveProfile} className="flex-1 flex flex-col overflow-hidden m-0 text-left">
                {/* Fixed Header */}
                <div className="p-6 md:px-10 py-5 border-b border-neutral-800/80 flex items-center justify-between shrink-0 bg-neutral-900">
                  <h3 className="text-xl md:text-2xl font-bold flex items-center gap-2">
                    <UserIcon className="text-mc-red" />
                    {isAdmin && editingProfileId !== user?.uid ? `Profil von ${editingProfile?.displayName || 'Unbekannt'}` : 'Dein Spieler-Profil'}
                  </h3>
                  <button 
                    type="button" 
                    onClick={() => { setShowProfileModal(false); setEditingProfileId(null); }}
                    className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-white transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Scrollable Form Body Container */}
                <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-10 custom-scrollbar bg-neutral-900/40">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    {/* Admin Stealth Status Indicators & Toggles */}
                    {isSuperAdmin && activeEditingProfId && (
                      <div className="md:col-span-2 flex flex-wrap gap-4 p-4 bg-purple-500/5 border border-purple-500/20 rounded-xl">
                        <button 
                          type="button"
                          onClick={() => {
                            if (editingProfile) {
                              const newInv = !editingProfile.isInvisible;
                              setDoc(doc(db, 'user_profiles', activeEditingProfId), { isInvisible: newInv }, { merge: true });
                              setUserProfiles(prev => prev.map(p => p.userId === activeEditingProfId ? { ...p, isInvisible: newInv } : p));
                              if (activeEditingProfId === user?.uid) {
                                setMyProfile(prev => prev ? { ...prev, isInvisible: newInv } : prev);
                              }
                            }
                          }}
                          className="flex items-center gap-2 hover:bg-purple-500/10 px-2 py-1 rounded"
                        >
                           <div className={`w-3 h-3 rounded-full ${editingProfile?.isInvisible ? 'bg-purple-500 shadow-[0_0_5px_purple]' : 'bg-neutral-800'}`} />
                           <span className="text-[10px] font-bold uppercase text-purple-400">Invisible Ghost</span>
                        </button>
                        <button 
                          type="button"
                          onClick={() => {
                            if (editingProfile) {
                              const newMute = !editingProfile.isShadowMuted;
                              setDoc(doc(db, 'user_profiles', activeEditingProfId), { isShadowMuted: newMute }, { merge: true });
                              setUserProfiles(prev => prev.map(p => p.userId === activeEditingProfId ? { ...p, isShadowMuted: newMute } : p));
                              if (activeEditingProfId === user?.uid) {
                                setMyProfile(prev => prev ? { ...prev, isShadowMuted: newMute } : prev);
                              }
                            }
                          }}
                          className="flex items-center gap-2 hover:bg-mc-gold/10 px-2 py-1 rounded"
                        >
                           <div className={`w-3 h-3 rounded-full ${editingProfile?.isShadowMuted ? 'bg-mc-gold shadow-[0_0_5px_gold]' : 'bg-neutral-800'}`} />
                           <span className="text-[10px] font-bold uppercase text-mc-gold">Shadow Muted</span>
                        </button>
                        <div className="flex items-center gap-2 px-2 py-1">
                           <span className="text-[10px] font-bold uppercase text-neutral-500">Coins: {editingProfile?.coins || 0}</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Left Column: Basic Info */}
                    <div className="space-y-6">
                      <div>
                        <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Display Name</label>
                        <input 
                          name="displayName"
                          defaultValue={editingProfile?.displayName || ''}
                          placeholder="Wie willst du genannt werden?"
                          required
                          className="w-full bg-black/40 border border-neutral-800 rounded-xl p-4 text-white focus:border-mc-red outline-none transition-colors"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Minecraft Username</label>
                        <input 
                          name="minecraftUsername"
                          value={mcUsernameInput}
                          onChange={(e) => setMcUsernameInput(e.target.value)}
                          placeholder="Dein In-Game Name"
                          required
                          className="w-full bg-black/40 border border-neutral-800 rounded-xl p-4 text-white focus:border-mc-red outline-none transition-colors"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Aktueller Server</label>
                        <select 
                          name="currentServer"
                          defaultValue={editingProfile?.currentServer || 'none'}
                          className="w-full bg-black/40 border border-neutral-800 rounded-xl p-4 text-white focus:border-mc-red outline-none transition-colors appearance-none"
                        >
                          <option value="none">Keiner / Menü</option>
                          <option value="pvp">{realmNames.pvp}</option>
                          <option value="survival">{realmNames.survival}</option>
                        </select>
                      </div>

                      {/* Profil-Leuchten (Farbe) */}
                      <div>
                        <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Profil-Leuchten (Glow-Farbe)</label>
                        <select 
                          name="activeGlow"
                          value={activeGlowInput}
                          onChange={(e) => setActiveGlowInput(e.target.value)}
                          className="w-full bg-black/40 border border-neutral-800 rounded-xl p-4 text-white focus:border-mc-red outline-none transition-colors appearance-none"
                        >
                          <option value="none">Standard (Kein Leuchten)</option>
                          {(isAdmin || editingProfile?.ownedColors?.includes('red')) && <option value="red">❤️ Rotes Glühen</option>}
                          {(isAdmin || editingProfile?.ownedColors?.includes('blue')) && <option value="blue">💙 Blaues Glühen</option>}
                          {(isAdmin || editingProfile?.ownedColors?.includes('gold')) && <option value="gold">💛 Goldenes Glühen</option>}
                          {(isAdmin || editingProfile?.ownedColors?.includes('green')) && <option value="green">💚 Grünes Glühen</option>}
                          {(isAdmin || editingProfile?.ownedColors?.includes('purple')) && <option value="purple">💜 Lila Glühen</option>}
                          {(isAdmin || editingProfile?.ownedColors?.includes('rainbow')) && <option value="rainbow">🌈 Regenbogen-Glühen (Legendär)</option>}
                        </select>
                      </div>
                    </div>

                    {/* Right Column: Skin & Avatar */}
                    <div className="flex flex-col gap-4">
                      <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest">Skin & Avatar</label>
                      <div className={`mc-card p-4 flex flex-col items-center gap-4 bg-black/20 transition-all duration-300 ${activeGlowInput !== 'none' ? getGlowStyles(activeGlowInput) : 'border-neutral-800/50'}`}>
                        <div className="relative group">
                          {tempSkin ? (
                            <img src={tempSkin} className="w-24 h-24 rounded-lg bg-neutral-900 pixelated border-2 border-mc-gold object-cover" alt="Minecraft Skin Vorschau - Dein Charakter" />
                          ) : (
                            <img 
                              src={`https://mc-heads.net/avatar/${mcUsernameInput.trim() || 'Steve'}`} 
                              className="w-24 h-24 rounded-lg bg-neutral-900 pixelated border-2 border-mc-gold object-cover shadow-[0_0_20px_rgba(251,191,36,0.15)]" 
                              alt="Minecraft Skin/Head-Vorschau"
                              referrerPolicy="no-referrer"
                            />
                          )}
                          <button 
                            type="button" 
                            onClick={() => setTempSkin(null)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 w-full">
                          <label className={`mc-button py-2 text-[10px] cursor-pointer text-center transition-all duration-300 ${tempSkin ? 'border-mc-gold text-mc-gold bg-mc-gold/10' : 'border-neutral-800 text-neutral-400 hover:text-white'}`}>
                            Upload
                            <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                          </label>
                          <button 
                            type="button" 
                            onClick={() => setTempSkin(null)} 
                            className={`mc-button py-2 text-[10px] transition-all duration-300 ${!tempSkin ? 'border-mc-gold text-mc-gold bg-mc-gold/10 font-bold' : 'border-neutral-800 text-neutral-400 hover:text-white'}`}
                          >
                            MC Head
                          </button>
                        </div>

                        <div className="w-full">
                          <p className="text-[10px] font-bold text-neutral-600 mb-2 text-center uppercase tracking-tighter">Oder zeichnen (8x8)</p>
                          <div className="grid grid-cols-8 gap-0.5 aspect-square w-full max-w-[160px] mx-auto border border-neutral-800 bg-black/40">
                            {pixelGrid.map((color, i) => (
                              <div 
                                key={`pixel-${i}`} 
                                onClick={() => handlePixelClick(i)}
                                style={{ backgroundColor: color }}
                                className="w-full h-full cursor-crosshair hover:opacity-80 transition-opacity"
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Full Width Bottom: Admin Dashboard */}
                    {isAdmin && (
                      <div className="md:col-span-2 space-y-8 pt-10 border-t border-white/5 mt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <label className="block text-xs font-bold text-mc-gold uppercase tracking-widest mb-2">Benutzer-Rolle (Nur Staff)</label>
                              <select 
                                name="role"
                                defaultValue={editingProfile?.role || 'Member'}
                                className="w-full bg-black/40 border border-mc-gold/30 rounded-xl p-4 text-white focus:border-mc-gold outline-none transition-colors appearance-none"
                              >
                                <option value="Member">Mitglied</option>
                                <option value="Spieler">Spieler</option>
                                <option value="VIP">VIP</option>
                                <option value="MVP">MVP</option>
                                <option value="Mod">Moderator</option>
                                <option value="Admin">Administrator</option>
                                <option value="Owner">Besitzer (Owner)</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-mc-gold uppercase tracking-widest mb-2">Credits (Admin)</label>
                              <input 
                                name="coins"
                                type="number"
                                defaultValue={editingProfile?.coins || 0}
                                className="w-full bg-black/40 border border-mc-gold/30 rounded-xl p-4 text-white focus:border-mc-gold outline-none transition-colors"
                              />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <button 
                            type="button"
                            onClick={() => {
                              if (!activeEditingProfId) return;
                              if (confirm("🚨 KICK: Benutzer-Session terminieren?")) {
                                setDoc(doc(db, 'user_profiles', activeEditingProfId), { isOnline: false }, { merge: true });
                              }
                            }}
                            className="py-4 bg-orange-500/10 border border-orange-500/30 hover:bg-orange-600 hover:text-white text-orange-500 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
                          >
                             <Unplug size={16} /> Session Kicken
                          </button>
                          <button 
                            type="button"
                            onClick={async () => {
                              if (!activeEditingProfId) return;
                              if (confirm("☢️ PERMANENT-DELETE: Profil vollständig vernichten?")) {
                                await deleteDoc(doc(db, 'user_profiles', activeEditingProfId));
                                setShowProfileModal(false);
                                setEditingProfileId(null);
                              }
                            }}
                            className="py-4 bg-red-600/10 border border-red-600/30 hover:bg-red-600 hover:text-white text-mc-red rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
                          >
                             <ShieldAlert size={16} /> Profil Löschen
                          </button>
                        </div>
                          
                        <div className="bg-black/60 border border-red-500/20 rounded-3xl overflow-hidden shadow-[inset_0_0_50px_rgba(239,68,68,0.05)]">
                             <div className="bg-gradient-to-r from-red-600/15 via-red-600/5 to-transparent border-b border-white/5 px-8 py-6 flex items-center justify-between">
                               <div className="flex items-center gap-6">
                                 <div className="relative flex items-center justify-center">
                                   <div className="absolute inset-0 bg-red-500 blur-[15px] animate-pulse opacity-30" />
                                   <ShieldAlert size={24} className="text-red-500 relative drop-shadow-[0_0_12px_rgba(239,68,68,1)]" />
                                 </div>
                                 <div className="flex flex-col">
                                   <span className="text-[14px] font-black uppercase tracking-[0.3em] text-red-500 leading-none">
                                     Identity Surveillance Feed
                                   </span>
                                   <div className="text-[8px] font-mono text-neutral-500 uppercase tracking-[0.1em] mt-2 flex items-center gap-2">
                                     <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_red]" />
                                     Direct Satellite Uplink Active & Secure
                                   </div>
                                 </div>
                               </div>
                               
                               <button 
                                 type="button"
                                 onClick={() => setSurveillanceExpanded(!surveillanceExpanded)}
                                 className={`text-[9px] px-6 py-2.5 rounded-xl border transition-all font-black uppercase tracking-[0.1em] shadow-lg active:scale-95 ${surveillanceExpanded ? 'bg-red-500 text-white border-red-400' : 'bg-neutral-900/80 text-neutral-400 border-neutral-800 hover:border-red-500/50 hover:text-white'}`}
                               >
                                 {surveillanceExpanded ? 'TERMINATE TRACE' : 'ESTABLISH FULL TRACE'}
                               </button>
                             </div>
                             
                             <div className="p-8 bg-neutral-950/40">
                                <div className="flex flex-col gap-8">
                                  {!surveillanceExpanded ? (
                                    <div className="flex items-center justify-between bg-red-500/5 border border-red-500/10 p-8 rounded-3xl group hover:border-red-500/30 transition-all">
                                      <div className="flex items-center gap-6">
                                        <Activity size={20} className="text-red-500 opacity-40 group-hover:opacity-100 transition-opacity" />
                                        <div className="flex flex-col">
                                          <span className="text-[10px] font-black text-red-500/60 uppercase tracking-[0.2em] mb-1">Active Signal Monitor</span>
                                          <span className="text-xl font-mono text-white font-black tracking-widest break-all">
                                            {(editingProfile as any)?.lastLoginIp || 'DETERMINING_IP...'}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="flex flex-col items-end gap-1">
                                        <span className="text-[10px] text-neutral-600 font-black uppercase tracking-widest">Status</span>
                                        <span className="px-4 py-1 bg-green-500/10 text-green-500 text-[10px] font-black rounded-lg border border-green-500/20">READY</span>
                                      </div>
                                    </div>
                                  ) : (
                                    <motion.div 
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      className="space-y-10 overflow-hidden"
                                    >
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                          {/* PRIMARY VECTOR */}
                                          <div className="space-y-6">
                                           <div className="text-[10px] font-black text-red-500/80 uppercase tracking-[0.3em] flex items-center gap-3">
                                              <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,1)]" />
                                              Infrastructural Origins
                                            </div>
                                            <div className="bg-neutral-900/80 border border-red-500/20 p-8 rounded-[2rem] group hover:border-red-500/60 transition-all cursor-copy relative overflow-hidden" onClick={() => {
                                              const ip = editingProfile?.lastLoginIp;
                                              if (ip) { navigator.clipboard.writeText(ip); }
                                            }}>
                                              <div className="absolute top-0 right-0 p-6 opacity-5">
                                                <Activity size={100} className="text-red-500" />
                                              </div>
                                              <div className="flex flex-col relative z-10 text-left">
                                                <p className="text-[9px] font-black text-neutral-500 uppercase mb-2 tracking-widest">Active session IP (Trace)</p>
                                                <span className="text-3xl font-mono font-black text-white tracking-widest break-all group-hover:text-red-500 transition-colors">
                                                  {editingProfile?.lastLoginIp || 'HIDDEN'}
                                                </span>
                                                <div className="flex items-center gap-3 mt-4">
                                                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                                  <p className="text-[9px] text-neutral-600 uppercase font-black tracking-widest">Verified Integrity Protocol v4.2</p>
                                                </div>
                                              </div>
                                            </div>
                                            
                                            <div className="bg-black/40 p-6 rounded-2xl border border-blue-500/20 flex items-center justify-between group hover:border-blue-500/50 transition-all">
                                              <div>
                                                <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-1">Genesis Arrival IP</p>
                                                <span className="text-lg font-mono font-bold text-blue-400 tracking-wider">
                                                  {editingProfile?.registrationIp || '---'}
                                                </span>
                                              </div>
                                              <div className="px-3 py-1 bg-blue-500/10 rounded-xl text-blue-500 text-[9px] font-black border border-blue-500/20 shadow-lg shadow-blue-500/5">SYSTEM_ROOT</div>
                                            </div>
                                          </div>

                                          {/* GEOSPATIAL INTELLIGENCE */}
                                          <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-[2rem] space-y-8 flex flex-col justify-between relative overflow-hidden group">
                                            <div className="absolute -top-10 -right-10 opacity-[0.03] group-hover:scale-110 group-hover:opacity-[0.05] transition-all duration-700">
                                              <MapPin size={250} className="text-mc-gold" />
                                            </div>
                                            <div className="space-y-4">
                                              <div className="flex items-center gap-3">
                                                <MapPin size={20} className="text-mc-gold" />
                                                <span className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em]">Satellite Analytics</span>
                                              </div>
                                              <div className="flex flex-col gap-2 relative z-10 text-left">
                                                <span className="text-3xl font-black text-white leading-tight tracking-tight">
                                                  {(editingProfile as any)?.lastLoginCity || '?'}, 
                                                  {(editingProfile as any)?.lastLoginRegion || '?'}
                                                </span>
                                                <div className="text-mc-gold font-black uppercase tracking-[0.2em] text-sm flex items-center gap-2">
                                                  <div className="w-4 h-[1px] bg-mc-gold/40" />
                                                  {(editingProfile as any)?.lastLoginCountry || 'Neutral Territory'}
                                                </div>
                                              </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 relative z-10">
                                              <div className="bg-black/60 p-5 rounded-2xl border border-white/5 hover:border-mc-gold/30 transition-colors group/sub text-left">
                                                <p className="text-[9px] font-black text-neutral-600 uppercase mb-2 tracking-widest">Registry ZIP</p>
                                                <p className="text-base font-mono text-neutral-300 font-bold tracking-widest">{(editingProfile as any)?.lastLoginPostal || '---'}</p>
                                              </div>
                                              <div className="bg-black/60 p-5 rounded-2xl border border-white/5 hover:border-mc-gold/30 transition-colors group/sub text-left">
                                                <p className="text-[9px] font-black text-neutral-600 uppercase mb-2 tracking-widest">Zone / Offset</p>
                                                <p className="text-base font-mono text-mc-gold font-black tracking-widest">{(editingProfile as any)?.lastLoginTimezone || 'UTC'}</p>
                                              </div>
                                            </div>
                                          </div>

                                          {/* INFRASTRUCTURE & NETWORK - FULL WIDTH SUBGRID */}
                                          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8">
                                            <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-[2rem] space-y-6 group hover:border-red-500/30 transition-all">
                                              <div className="flex items-center gap-4">
                                                <Cpu size={20} className="text-red-500" />
                                                <span className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em]">Carrier / ISP Node</span>
                                              </div>
                                              <div className="bg-black/60 p-6 rounded-[2rem] border border-white/5 group-hover:border-red-500/20 transition-all relative overflow-hidden">
                                                <div className="relative z-10 text-left">
                                                  <span className="text-xl font-mono text-red-500 font-black block leading-tight tracking-[0.02em]">
                                                    {(editingProfile as any)?.lastLoginOrg || 'DETERMINING ISP...'}
                                                  </span>
                                                  <div className="flex items-center justify-between mt-4 border-t border-white/5 pt-4">
                                                    <span className="text-[10px] font-mono text-neutral-500 font-bold uppercase tracking-widest">AS Number</span>
                                                    <span className="text-xs font-mono bg-mc-gold/10 text-mc-gold px-3 py-1 rounded-lg border border-mc-gold/20 font-black">
                                                      {(editingProfile as any)?.lastLoginAsn || 'AS_NONE'}
                                                    </span>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                            
                                            <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-[2rem] space-y-6 group hover:border-green-500/30 transition-all">
                                              <div className="flex items-center gap-4">
                                                <Activity size={20} className="text-green-500" />
                                                <span className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.3em]">Client Specs Sensor</span>
                                              </div>
                                              <div className="grid grid-cols-2 gap-4 h-full">
                                                <div className="bg-black/60 p-6 rounded-[2rem] border border-white/5 text-center flex flex-col justify-center gap-2 group-hover:bg-green-500/5 transition-all">
                                                  <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest">Cores</p>
                                                  <span className="text-3xl font-mono text-white font-black leading-none">{navigator.hardwareConcurrency || '?'}</span>
                                                </div>
                                                <div className="bg-black/60 p-6 rounded-[2rem] border border-white/5 text-center flex flex-col justify-center gap-2 group-hover:bg-green-500/5 transition-all">
                                                  <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest">Memory</p>
                                                  <span className="text-3xl font-mono text-white font-black leading-none">{(navigator as any).deviceMemory || '?'}<span className="text-xs text-neutral-500 uppercase tracking-normal">GB</span></span>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        </div>

                                        <div className="flex items-center justify-between px-2 pt-8 border-t border-white/5">
                                          <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-2 px-3 py-1 bg-red-500/10 rounded-lg border border-red-500/20">
                                              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                              <span className="text-[9px] font-mono text-red-500 font-black tracking-widest uppercase">Trace_Active</span>
                                            </div>
                                            <span className="text-[10px] font-mono text-neutral-500 font-bold tracking-widest">
                                              ENTITY_IDENT: TR-{editingProfile?.userId?.substring(0, 10).toUpperCase()}
                                            </span>
                                          </div>
                                          <span className="text-[9px] font-mono text-neutral-700 uppercase tracking-[0.2em] font-bold">Protocol v8.12.0 SECURED</span>
                                        </div>
                                    </motion.div>
                                  )}
                                </div>
                             </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-4 bg-black/40 border border-neutral-800 rounded-xl">
                    <span className="text-sm font-medium">Gerade online anzeigen?</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        name="isOnline"
                        defaultChecked={editingProfile?.isOnline || false}
                        className="sr-only peer" 
                      />
                      <div className="w-11 h-6 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-mc-red"></div>
                    </label>
                  </div>
                </div> {/* Closes Scrollable Form Body Container */}

                {/* Sticky/Fixed Footer at Bottom */}
                <div className="p-6 md:px-10 border-t border-neutral-800/80 bg-neutral-950/85 backdrop-blur-md flex gap-3 shrink-0">
                  {isAdmin && activeEditingProfId && activeEditingProfId !== user?.uid && (
                    <button 
                      type="button" 
                      onClick={() => {
                        deleteProfile(activeEditingProfId);
                        setShowProfileModal(false);
                        setEditingProfileId(null);
                      }}
                      className="px-4 py-4 rounded-xl font-bold bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 transition-colors flex items-center justify-center min-h-[48px] min-w-[48px]"
                      title="Benutzer permanent löschen"
                    >
                      <Trash2 size={20} />
                    </button>
                  )}
                  <button 
                    type="button" 
                    onClick={() => { setShowProfileModal(false); setEditingProfileId(null); }}
                    className="flex-1 px-6 py-4 rounded-xl font-black text-xs uppercase tracking-wider bg-neutral-800 hover:bg-neutral-700 hover:text-white transition-colors min-h-[48px]"
                  >
                    Abbrechen
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-6 py-4 rounded-xl font-black text-xs uppercase tracking-wider bg-mc-red text-white hover:bg-red-500 transition-all shadow-lg shadow-red-500/20 min-h-[48px]"
                  >
                    Speichern
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {hasQuotaExceeded && (
          <div key="quota-exceeded-container" className="fixed inset-0 z-[500] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-6 text-center animate-in fade-in duration-700">
            <div className="max-w-md w-full bg-[#050505] border border-mc-red/20 rounded-[2.5rem] p-10 shadow-[0_0_100px_rgba(255,59,59,0.1)] space-y-10 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-mc-red to-transparent opacity-40" />
              
              <div className="flex justify-center">
                <div className="relative group">
                  <div className="absolute inset-0 bg-mc-red blur-3xl opacity-10 group-hover:opacity-30 transition-opacity animate-pulse" />
                  <div className="w-24 h-24 bg-mc-red/5 rounded-full flex items-center justify-center border border-mc-red/10 group-hover:border-mc-red/30 transition-colors">
                    <Unplug className="w-12 h-12 text-mc-red" />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h2 className="text-4xl font-black text-white tracking-widest uppercase italic">System Limit</h2>
                <div className="h-0.5 w-12 bg-white/10 mx-auto" />
                <p className="text-neutral-500 leading-relaxed text-sm font-medium">
                  Die tägliche Datenbank-Quote der Gratis-Stufe wurde ausgeschöpft. 
                  Alle Funktionen sind vorübergehend pausiert.
                </p>
              </div>

              <div className="space-y-4 pt-2">
                <div className="bg-neutral-900/30 rounded-3xl p-5 border border-white/5 backdrop-blur-sm">
                  <div className="flex items-center gap-4 text-left">
                    <div className="w-10 h-10 rounded-2xl bg-mc-gold/10 flex items-center justify-center border border-mc-gold/20">
                      <Clock className="w-5 h-5 text-mc-gold" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-mc-gold uppercase tracking-[0.2em] mb-0.5">Reset Timer</p>
                      <p className="text-xs text-neutral-400 font-semibold font-mono">ca. 12-24h (Täglicher Reset)</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <button 
                    onClick={() => window.location.reload()}
                    className="w-full py-5 bg-white text-black hover:bg-neutral-200 font-bold rounded-2xl transition-all active:scale-[0.97] flex items-center justify-center gap-3 shadow-xl"
                  >
                    <RefreshCw className="w-4 h-4 animate-[spin_3s_linear_infinite]" />
                    Status prüfen
                  </button>
                  <a 
                    href={DISCORD_URL}
                    target="_blank"
                    className="w-full py-5 bg-neutral-900/50 text-white hover:bg-neutral-800 font-bold rounded-2xl border border-white/5 transition-all active:scale-[0.97] flex items-center justify-center gap-3 backdrop-blur-sm"
                  >
                    Community Discord
                  </a>
                </div>
              </div>

              <div className="pt-4 opacity-30 flex items-center justify-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-mc-red" />
                <p className="text-[9px] text-neutral-400 font-mono tracking-widest uppercase">
                  Error Code: RESOURCE_EXHAUSTED
                </p>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {devLabsOpen && (
          <DevLabsView
            user={user}
            myProfile={myProfile}
            db={db}
            chatMessages={combinedMessages}
            onClose={() => setDevLabsOpen(false)}
            triggerToast={triggerToast}
          />
        )}
      </AnimatePresence>

      {/* Floating toast notification panel */}
      <div id="toast-container" className="fixed bottom-5 right-5 z-[10000] flex flex-col gap-3 max-w-[360px] pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.9, transition: { duration: 0.2 } }}
              className="pointer-events-auto flex items-start gap-3 p-4 bg-black/95 border-2 border-mc-gold rounded-xl shadow-[0_0_20px_rgba(255,170,0,0.3)] relative overflow-hidden group select-none"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-mc-gold/10 via-amber-500/5 to-transparent animate-pulse pointer-events-none" />
              
              <div className="p-2 rounded-lg bg-mc-gold/10 border border-mc-gold/30 text-mc-gold shrink-0">
                {toast.type === 'quest' && <Target size={18} className="animate-bounce" />}
                {toast.type === 'xp' && <Sparkles size={18} className="animate-pulse" />}
                {toast.type === 'level' && <Award size={18} className="animate-pulse" />}
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="font-sans font-black text-xs text-mc-gold flex items-center gap-1.5 uppercase tracking-wider">
                  {toast.title}
                </h4>
                <p className="font-sans text-[11px] text-neutral-300 font-semibold leading-relaxed mt-1">
                  {toast.description}
                </p>
                
                {toast.type === 'quest' && toast.percent !== undefined && (
                  <div className="w-full h-1.5 bg-neutral-900 rounded-full mt-2.5 overflow-hidden border border-neutral-800">
                    <motion.div 
                      className="h-full bg-mc-gold rounded-full shadow-[0_0_8px_rgba(255,170,0,0.5)]"
                      initial={{ width: 0 }}
                      animate={{ width: `${toast.percent}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                  </div>
                )}
              </div>

              <button 
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="text-neutral-500 hover:text-white transition-colors p-0.5 shrink-0"
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
