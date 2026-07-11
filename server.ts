import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { Client, GatewayIntentBits, REST, Routes, PermissionFlagsBits, ChatInputCommandInteraction } from 'discord.js';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  query, 
  collection, 
  where, 
  getDocs, 
  doc, 
  deleteDoc, 
  writeBatch,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  runTransaction,
  serverTimestamp,
  onSnapshot,
  orderBy,
  limit
} from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import fs from 'fs';
import { GoogleGenAI } from "@google/genai";

// Load Firebase Config
const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));
const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp, firebaseConfig.firestoreDatabaseId);
const authClient = getAuth(fbApp);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Programmatically authenticate system bot to Firebase Auth
  const systemEmail = 'system-quiz-bot@community.local';
  const systemPassword = 'VerySecureSystemPassword987!#@';

  try {
    await signInWithEmailAndPassword(authClient, systemEmail, systemPassword);
    console.log('[SYSTEM-BOT] Erfolgreich in Firebase Auth angemeldet.');
  } catch (err: any) {
    if (
      err.code === 'auth/user-not-found' || 
      err.code === 'auth/invalid-credential' || 
      String(err).includes('user-not-found') || 
      String(err).includes('invalid-credential') || 
      String(err).includes('INVALID_LOGIN_CREDENTIALS') ||
      String(err).includes('auth/invalid-login-credentials')
    ) {
      try {
        console.log('[SYSTEM-BOT] Bot-User existiert nicht. Erstelle neuen Bot-Account...');
        await createUserWithEmailAndPassword(authClient, systemEmail, systemPassword);
        console.log('[SYSTEM-BOT] Bot-User erfolgreich erstellt und angemeldet.');
      } catch (createErr) {
        console.error('[SYSTEM-BOT] Fehler beim automatischen Erstellen des Bot-Users:', createErr);
      }
    } else {
      console.error('[SYSTEM-BOT] Login fehlgeschlagen:', err);
    }
  }

  // --- DISCORD BOT SETUP ---
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.VITE_DISCORD_GUILD_ID || "1451980583969230882";

  if (botToken) {
    const client = new Client({ 
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] 
    });

    client.on('ready', async () => {
      console.log(`[DISCORD] Bot online als ${client.user?.tag}`);
      
      // Register Slash Commands GLOBALLY (can take up to 1 hour to propagate, but works for User Installs)
      const rest = new REST({ version: '10' }).setToken(botToken);
      const commands = [
        {
          name: 'ban',
          description: 'Bannt einen User vom Discord und aus der Website-Datenbank',
          default_member_permissions: PermissionFlagsBits.BanMembers.toString(),
          dm_permission: false,
          integration_types: [0, 1],
          contexts: [0, 1, 2],
          options: [
            {
              name: 'discord_user',
              type: 6, // USER
              description: 'Der Discord-User zum Bannen',
              required: false
            },
            {
              name: 'web_id',
              type: 3, // STRING
              description: 'Oder die Website-ID / Minecraft-Name zum Bannen',
              required: false
            },
            {
              name: 'grund',
              type: 3, // STRING
              description: 'Grund für den Bann',
              required: false
            }
          ]
        },
        {
          name: 'stats',
          description: 'Zeigt Statistiken eines Spielers an',
          integration_types: [0, 1],
          contexts: [0, 1, 2],
          options: [
            {
              name: 'user',
              type: 6, // USER
              description: 'Der User dessen Stats du sehen willst',
              required: false
            }
          ]
        },
        {
          name: 'status',
          description: 'Zeigt den System-Status an',
          integration_types: [0, 1],
          contexts: [0, 1, 2]
        },
        {
          name: 'help',
          description: 'Zeigt alle verfügbaren Befehle an',
          integration_types: [0, 1],
          contexts: [0, 1, 2]
        }
      ];

      try {
        // Register globally for User Context support
        await rest.put(
          Routes.applicationCommands(client.user!.id),
          { body: commands }
        );
        console.log('[DISCORD] Globale Slash Commands registriert.');
      } catch (err) {
        console.error('[DISCORD] Fehler beim Registrieren der globalen Commands:', err);
      }

      try {
        if (guildId) {
          // Also register guild-specific for instant updates on main server
          await rest.put(
            Routes.applicationGuildCommands(client.user!.id, guildId),
            { body: commands }
          );
          console.log(`[DISCORD] Gilden-spezifische Slash Commands für Guild ID ${guildId} registriert.`);
        }
      } catch (err: any) {
        const errStr = String(err);
        if (err.code === 50001 || err.status === 403 || errStr.includes('50001') || errStr.includes('Missing Access')) {
          console.warn(`[DISCORD] Hinweis: Gilden-Befehle konnten für Guild ID ${guildId} nicht registriert werden (Missing Access / Code 50001).`);
          console.warn(`           Das ist normal, wenn der Bot nicht auf diesem Server existiert oder ohne die 'applications.commands' Berechtigung eingeladen wurde.`);
        } else {
          console.error('[DISCORD] Fehler beim Registrieren der Gilden-spezifischen Commands:', err);
        }
      }
    });

    client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      const { commandName, options } = interaction;

      if (commandName === 'ban') {
        const targetUser = options.getUser('discord_user');
        const webId = options.getString('web_id');
        const reason = options.getString('grund') || 'Kein Grund angegeben';

        if (!targetUser && !webId) {
          return interaction.reply({ content: '❌ Du musst entweder einen Discord-User oder eine Website-ID/Namen angeben.', ephemeral: true });
        }

        await interaction.deferReply();

        try {
          let systemBanSuccess = false;
          let foundUser = null;

          if (targetUser) {
            const snapshot = await getDocs(query(collection(db, 'user_profiles'), where('discordId', '==', targetUser.id)));
            if (!snapshot.empty) {
              const batch = writeBatch(db);
              snapshot.forEach(docSnap => {
                foundUser = docSnap.data();
                batch.delete(doc(db, 'user_profiles', docSnap.id));
              });
              await batch.commit();
              systemBanSuccess = true;
            }
          } else if (webId) {
            // Search by ID or Name
            const [snapName, snapId] = await Promise.all([
              getDocs(query(collection(db, 'user_profiles'), where('minecraftUsername', '==', webId))),
              getDocs(query(collection(db, 'user_profiles'), where('userId', '==', webId)))
            ]);
            
            const batch = writeBatch(db);
            const snaps = [...snapName.docs, ...snapId.docs];
            if (snaps.length > 0) {
              snaps.forEach(docSnap => {
                foundUser = docSnap.data();
                batch.delete(doc(db, 'user_profiles', docSnap.id));
              });
              await batch.commit();
              systemBanSuccess = true;
            }
          }

          // Discord Ban if user provided
          if (targetUser) {
            const member = await interaction.guild?.members.fetch(targetUser.id).catch(() => null);
            if (member) {
              await member.ban({ reason: `[Admin: ${interaction.user.tag}] ${reason}` });
            } else {
              await interaction.guild?.bans.create(targetUser.id, { reason: `[Admin: ${interaction.user.tag}] ${reason}` });
            }
          }

          await interaction.editReply({ 
            content: `✅ Bann abgeschlossen.\n- Ziel: ${targetUser ? targetUser.tag : webId}\n- Discord: ${targetUser ? 'Gebannt' : 'N/A'}\n- Website-Datenbank: ${systemBanSuccess ? `Gefunden & Gelöscht (${foundUser?.displayName})` : 'Kein Account gefunden'}` 
          });
        } catch (err: any) {
          console.error('[DISCORD] Ban-Fehler:', err);
          await interaction.editReply({ content: `❌ Fehler beim Ausführen des Banns: ${err.message}` });
        }
      }

      if (commandName === 'stats') {
        const targetUser = options.getUser('user') || interaction.user;
        await interaction.deferReply();

        try {
          const snapshot = await getDocs(query(collection(db, 'user_profiles'), where('discordId', '==', targetUser.id)));

          if (snapshot.empty) {
            return interaction.editReply({ content: `❌ Kein verknüpfter Website-Account für **${targetUser.tag}** gefunden.` });
          }

          const profile = snapshot.docs[0].data() as any;
          const embed = {
            color: 0xffd700,
            title: `Statistiken für ${profile.displayName}`,
            thumbnail: { url: targetUser.displayAvatarURL() },
            fields: [
              { name: '💰 Coins', value: `\`${profile.coins || 0}\``, inline: true },
              { name: '⭐ Level', value: `\`${Math.floor(Math.sqrt((profile.xp || 0) / 100)) + 1}\``, inline: true },
              { name: '🛡️ Rang', value: `\`${profile.role || 'Spieler'}\``, inline: true },
              { name: '🎮 Minecraft', value: `\`${profile.minecraftUsername || 'Unbekannt'}\``, inline: true },
              { name: '🔥 XP', value: `\`${profile.xp || 0}\``, inline: true },
            ],
            timestamp: new Date().toISOString()
          };

          await interaction.editReply({ embeds: [embed] });
        } catch (err: any) {
          await interaction.editReply({ content: `❌ Fehler beim Laden der Stats: ${err.message}` });
        }
      }

      if (commandName === 'status') {
        await interaction.reply({ content: '✅ **System-Status:** Online\n- Website: https://mc-manager.example.com\n- Datenbank-Sync: Aktiv\n- AI-Integration: Bereit' });
      }

      if (commandName === 'help') {
        const helpMsg = `**Verfügbare Befehle:**\n` + 
          `- \`/stats [@user]\`: Zeigt Statistiken an.\n` +
          `- \`/ban [discord_user] [web_id] [grund]\`: Bannt einen User (Admin).\n` +
          `- \`/status\`: Zeigt System-Status an.\n` +
          `- \`/help\`: Diese Nachricht.`;
        await interaction.reply({ content: helpMsg, ephemeral: true });
      }
    });

    client.login(botToken).catch(err => {
      console.error('[DISCORD] Login fehlgeschlagen:', err);
    });
  } else {
    console.warn('[DISCORD] DISCORD_BOT_TOKEN nicht gesetzt. Bot bleibt offline.');
  }

  // --- EMERGENCY PERSISTENCE (In-Memory for now) ---
  // This stores critical states when Firebase is dead
  let emergencyConfig = {
    maintenanceMode: false,
    realmCodes: {
      PVP: 'w3PHnwq-5_kcfoE',
      SURVIVAL: 'JwMPYn9KpsVnRFo'
    }
  };

  // Basic API for emergency recovery
  app.get('/api/emergency-config', (req, res) => {
    res.json(emergencyConfig);
  });

  app.post('/api/emergency-config', (req, res) => {
    emergencyConfig = { ...emergencyConfig, ...req.body };
    res.json({ success: true, config: emergencyConfig });
  });

  // --- DISCORD API ENDPOINT (For Website -> Discord) ---
  app.post('/api/discord/ban', async (req, res) => {
    const { discordUserId, reason } = req.body;
    
    if (!botToken) {
      return res.status(500).json({ error: "Discord Bot Token nicht konfiguriert (DISCORD_BOT_TOKEN)." });
    }

    if (!discordUserId) {
      return res.status(400).json({ error: "Keine Discord User ID angegeben." });
    }

    try {
      const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/bans/${discordUserId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bot ${botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          delete_message_days: 1,
          reason: reason || "Banned via Admin Dashboard"
        })
      });

      if (response.ok || response.status === 204) {
        res.json({ success: true, message: "User erfolgreich auf Discord gebannt." });
      } else {
        const errData = await response.json().catch(() => ({ message: "Unbekannter Discord API Fehler" }));
        res.status(response.status).json({ error: errData.message });
      }
    } catch (err) {
      res.status(500).json({ error: "Verbindung zu Discord fehlgeschlagen." });
    }
  });

  // --- AI ORACLE (MIGRATED TO CLIENT-SIDE MAIN SCRIPT) ---
  // The oracle resides fully in the main frontend script now (src/services/geminiService.ts) as requested.

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', mode: 'full-stack' });
  });

  // --- YOUTUBE PROXY ---
  app.get('/api/stream/youtube', async (req, res) => {
    const videoUrl = req.query.url as string;
    if (!videoUrl) return res.status(400).send('Keine URL übergeben.');

    try {
        const ytdl = require('ytdl-core');
        res.setHeader('Content-Type', 'audio/mpeg');
        ytdl(videoUrl, {
            filter: 'audioonly',
            quality: 'highestaudio'
        }).pipe(res); 
    } catch (error) {
        console.error(error);
        res.status(500).send('Fehler beim YouTube-Streaming.');
    }
  });

  // --- TWITCH PROXY ---
  app.get('/api/stream/twitch', async (req, res) => {
    const channelName = req.query.channel as string;
    if (!channelName) return res.status(400).send('Kein Channel angegeben.');

    try {
        const twitchM3u8 = require('twitch-m3u8');
        const streams = await twitchM3u8.getStream(channelName);
        const audioStream = streams.find((s: any) => s.quality && s.quality.includes('Audio')) || streams[streams.length - 1];

        if (audioStream) {
            res.redirect(audioStream.url);
        } else {
            res.status(404).send('Kein Stream gefunden.');
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('Fehler beim Twitch-Streaming.');
    }
  });

  // --- STREAM PROXY (Bypasses CORS & Mixed Content) ---
  app.get('/api/stream-proxy', async (req, res) => {
    const streamUrl = req.query.url as string;
    if (!streamUrl) {
      return res.status(400).send("Parameter 'url' is required");
    }

    try {
      const decodedUrl = decodeURIComponent(streamUrl);
      if (!decodedUrl.startsWith('http://') && !decodedUrl.startsWith('https://')) {
        return res.status(400).send("Invalid URL protocol. Must start with http:// or https://");
      }

      console.log(`[STREAM PROXY] Proxying request to: ${decodedUrl}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 seconds connection timeout

      const response = await fetch(decodedUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return res.status(response.status).send(`Failed to stream. Source returned HTTP ${response.status}: ${response.statusText}`);
      }

      // Forward headers
      const contentType = response.headers.get('content-type') || 'audio/mpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      // Forward length if available and not a live stream chunked transfer
      const contentLength = response.headers.get('content-length');
      if (contentLength && response.headers.get('transfer-encoding') !== 'chunked') {
        res.setHeader('Content-Length', contentLength);
      }

      if (response.body) {
        const { Readable } = await import('stream');
        const nodeReadable = Readable.fromWeb(response.body as any);
        
        nodeReadable.on('error', (err) => {
          console.error('[STREAM PROXY] Error piping source stream:', err);
          res.end();
        });

        req.on('close', () => {
          // Prevent resource leak if client aborts/closes tab or pauses audio
          try {
            nodeReadable.destroy();
          } catch (e) {
            // ignore
          }
        });

        nodeReadable.pipe(res);
      } else {
        res.status(500).send("No body stream was returned from the source.");
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        res.status(504).send("Error: Connecting to the stream timed out.");
      } else {
        console.error('[STREAM PROXY FEHLER]', err);
        res.status(500).send(`Stream Proxy Failure: ${err.message}`);
      }
    }
  });

  // --- CHAT QUIZ BOT (SYSTEM BOT) ---
  const quizQuestions = [
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
    { question: "Wie viele Obsidianblöcke benötigt man, um einen Zaubertisch herzustellen?", answers: ["4", "vier"] }
  ];

  let serverQuizState: {
    question: string;
    answers: string[];
    reward: number;
    active: boolean;
  } | null = null;

  const startQuizTime = Date.now();

  const checkQuizAnswer = async (msg: any) => {
    if (!serverQuizState || !serverQuizState.active) return;
    
    const text = (msg.text || '').trim();
    if (!text) return;

    const cleanStr = (s: string) => s.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "").replace(/\s+/g, ' ').trim();
    const userClean = cleanStr(text);

    const matchIdx = serverQuizState.answers.findIndex(ans => cleanStr(ans) === userClean);
    if (matchIdx >= 0) {
      const correctAns = serverQuizState.answers[matchIdx];
      const userId = msg.userId;
      const displayName = msg.displayName || 'Unbekannt';
      const solvedQuiz = serverQuizState;
      
      // Instantly mark as resolved in memory
      serverQuizState = null;

      console.log(`[QUIZ-BOT] Richtig beantwortet von ${displayName} (${userId}): ${text}`);

      try {
        // 1. Write solved state to app_config
        await setDoc(doc(db, 'app_config', 'active_quiz'), {
          active: false,
          winningUser: displayName,
          winningUid: userId,
          solvedAt: serverTimestamp(),
          question: solvedQuiz.question,
          answer: correctAns,
          reward: solvedQuiz.reward
        }, { merge: true });

        // 2. Increment stats of winning user safely via transaction
        const userRef = doc(db, 'user_profiles', userId);
        await runTransaction(db, async (transaction) => {
          const snap = await transaction.get(userRef);
          if (snap.exists()) {
            const data = snap.data() || {};
            const coins = data.coins || 0;
            const wins = data.quizWins || 0;

            transaction.update(userRef, {
              coins: coins + solvedQuiz.reward,
              quizWins: wins + 1
            });
          }
        });

        // 3. Post notification to global chat
        let customAnnouncement = `🏆 **Richtig!** **${displayName}** hat die Quizfrage am schnellsten beantwortet: "*${solvedQuiz.question}*" ➜ **${correctAns.toUpperCase()}**! (+50 Coins 🪙)`;
        const cleanAnswer = correctAns.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "").replace(/\s+/g, '').trim();
        if (solvedQuiz.question.includes("Obsidian") && solvedQuiz.question.includes("Werkzeug") && solvedQuiz.question.includes("schnellsten")) {
          if (cleanAnswer.includes("netherit")) {
            customAnnouncement = `🏆 **Richtig!** **${displayName}** hat die Quizfrage am schnellsten beantwortet: "*${solvedQuiz.question}*" ➜ **${correctAns.toUpperCase()}**! (+50 Coins 🪙) *– Absolut korrekt! Netherit ist tatsächlich noch flinker als Diamant! ✨*`;
          } else if (cleanAnswer.includes("diamant")) {
            customAnnouncement = `🏆 **Richtig!** **${displayName}** hat die Quizfrage am schnellsten beantwortet: "*${solvedQuiz.question}*" ➜ **${correctAns.toUpperCase()}**! (+50 Coins 🪙) *– Korrekt! Diamant ist super, aber mit Netherit geht es sogar noch ein bisschen schneller! ⛏️*`;
          }
        }

        await addDoc(collection(db, 'chat_messages'), {
          text: customAnnouncement,
          userId: 'quiz_bot',
          displayName: '💡 Quiz-Bot',
          role: 'System',
          createdAt: serverTimestamp()
        });

      } catch (err) {
        console.error('[QUIZ-BOT] Fehler beim Verarbeiten des Richtig-Tipps:', err);
      }
    }
  };

  let processedMessageIds = new Set<string>();

  // Real-time synchronization of the active quiz from Firestore.
  onSnapshot(
    doc(db, 'app_config', 'active_quiz'),
    (snap) => {
      if (snap && snap.exists()) {
        const curData = snap.data();
        if (curData && curData.active === true) {
          serverQuizState = {
            question: curData.question,
            answers: curData.answers || [curData.answer],
            reward: curData.reward || 50,
            active: true
          };
          console.log('[QUIZ-BOT] Synchronisiertes aktives Quiz aus Firestore:', serverQuizState.question);
        } else {
          serverQuizState = null;
        }
      } else {
        serverQuizState = null;
      }
    },
    (err) => {
      console.error('[QUIZ-BOT] Fehler beim Abonnieren von active_quiz:', err);
    }
  );

  // Listen to incoming chat messages
  onSnapshot(
    query(collection(db, 'chat_messages'), orderBy('createdAt', 'desc'), limit(1)),
    (snap) => {
      if (!snap || snap.empty) return;
      
      const docSnap = snap.docs[0];
      const data = docSnap.data();
      const docId = docSnap.id;

      // Prevent processing the same message snapshot event twice
      if (processedMessageIds.has(docId)) {
        return;
      }
      processedMessageIds.add(docId);
      if (processedMessageIds.size > 100) {
        processedMessageIds.clear();
        processedMessageIds.add(docId);
      }

      if (data && data.userId !== 'quiz_bot' && data.userId !== 'system') {
        const createdAtDate = data.createdAt 
          ? (data.createdAt.toMillis ? data.createdAt.toMillis() : (data.createdAt.getTime ? data.createdAt.getTime() : null)) 
          : null;
        
        // Mark as fresh if there's no server timestamp yet (e.g. pending write) or was written within the last 15 seconds
        const isFresh = !createdAtDate || (createdAtDate > startQuizTime && createdAtDate > Date.now() - 15000);
        
        if (isFresh) {
          checkQuizAnswer(data);
        } else {
          console.log('[QUIZ-BOT] Überspringe historische Nachricht:', docId, data.text);
        }
      }
    },
    (err) => {
      console.error('[QUIZ-BOT] Snapshot listen error:', err);
    }
  );

  const sendNewQuizQuestion = async () => {
    try {
      // Check existing active quiz in DB (freshness threshold: 15 mins)
      const curDoc = await getDoc(doc(db, 'app_config', 'active_quiz'));
      if (curDoc.exists()) {
        const curData = curDoc.data();
        if (curData && curData.active === true && curData.createdAt) {
          const createdTime = curData.createdAt.toMillis ? curData.createdAt.toMillis() : (curData.createdAt.getTime ? curData.createdAt.getTime() : Date.now());
          const ageSec = (Date.now() - createdTime) / 1000;
          if (ageSec < 15 * 60) {
            console.log('[QUIZ-BOT] Aktive Frage existiert und ist noch gültig. Vermeide Überschreiben...');
            serverQuizState = {
              question: curData.question,
              answers: curData.answers || [curData.answer],
              reward: curData.reward || 50,
              active: true
            };
            return;
          }
        }
      }

      // Pick random question from list
      const randQuiz = quizQuestions[Math.floor(Math.random() * quizQuestions.length)];
      serverQuizState = {
        question: randQuiz.question,
        answers: randQuiz.answers,
        reward: 50,
        active: true
      };

      // Set DB
      await setDoc(doc(db, 'app_config', 'active_quiz'), {
        question: serverQuizState.question,
        answers: serverQuizState.answers,
        reward: serverQuizState.reward,
        active: true,
        createdAt: serverTimestamp(),
        winningUser: null,
        winningUid: null
      });

      // Post to chat
      await addDoc(collection(db, 'chat_messages'), {
        text: `💡 **NEUE QUIZFRAGE:** ${serverQuizState.question} 🤔 (Tippe die Antwort als Erste/r in den Chat für **50 Coins**!)`,
        userId: 'quiz_bot',
        displayName: '💡 Quiz-Bot',
        role: 'System',
        createdAt: serverTimestamp()
      });

      console.log(`[QUIZ-BOT] Neue Frage generiert: ${serverQuizState.question}`);
    } catch (err) {
      console.error('[QUIZ-BOT] Fehler beim Registrieren neuer Quiz-Frage:', err);
    }
  };

  // Every 5 minutes, post a new quiz question
  const QUIZ_CYCLE_TIME = 5 * 60 * 1000;
  setTimeout(() => {
    sendNewQuizQuestion();
    setInterval(sendNewQuizQuestion, QUIZ_CYCLE_TIME);
  }, 10000);

  // --- VITE MIDDLEWARE ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SYSTEM] Full-Stack Server running on http://localhost:${PORT}`);
  });
}

startServer();
