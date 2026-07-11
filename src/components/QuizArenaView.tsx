import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Sparkles, Send, Trophy, Brain, Timer, Award, Coins, HelpCircle } from 'lucide-react';

interface QuizArenaViewProps {
  activeQuiz: {
    question: string;
    reward: number;
    active: boolean;
    winningUser?: string | null;
    winningUid?: string | null;
    createdAt?: any;
    answers?: string[];
  } | null;
  myProfile: any;
  user: any;
  db: any;
  onRequestNewQuestion?: () => Promise<void>;
}

export const QuizArenaView: React.FC<QuizArenaViewProps> = ({ activeQuiz, myProfile, user, db, onRequestNewQuestion }) => {
  const [answerInput, setAnswerInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !answerInput.trim() || isSending) return;

    const answer = answerInput.trim();
    setIsSending(true);
    setAnswerInput('');

    try {
      const tempId = 'temp-quiz-' + Date.now() + '-' + Math.random().toString(36).substring(7);
      const msgRef = doc(db, 'chat_messages', tempId);
      
      await setDoc(msgRef, {
        text: answer,
        userId: user.uid,
        displayName: (myProfile?.displayName || user.displayName || 'Unbekannt').substring(0, 64),
        role: (myProfile?.role || 'Member').substring(0, 64),
        purchasedRank: myProfile?.purchasedRank || "",
        createdAt: serverTimestamp(),
        tempId: tempId,
        channel: 'quiz'
      });

      // Show temporary positive feedback
      setSuccessToast('Antwort gesendet! Siehe Live-Chat.');
      setTimeout(() => setSuccessToast(null), 3000);
    } catch (err) {
      console.error('[QUIZ-ARENA] Failed to submit answer message', err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div id="quiz-arena-root" className="w-full h-full flex flex-col md:flex-row gap-6 relative z-10 select-none">
      
      {/* LEFT SECTION: Main Question Board and Submissions */}
      <div className="flex-1 flex flex-col justify-center items-center p-4 min-h-[350px]">
        
        <AnimatePresence mode="wait">
          {activeQuiz && activeQuiz.active ? (
            <motion.div
              key="active-quiz-view"
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="w-full max-w-xl bg-neutral-900/90 border-2 border-mc-gold rounded-[2rem] p-6 md:p-8 flex flex-col items-center justify-between shadow-[0_0_50px_rgba(255,170,0,0.15)] relative overflow-hidden"
            >
              {/* Gold Glare Background Effect */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-mc-gold/5 blur-3xl rounded-full pointer-events-none" />
              <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-mc-gold/5 blur-3xl rounded-full pointer-events-none" />

              {/* Status Header */}
              <div className="flex items-center gap-3 mb-6 bg-mc-gold/10 px-4 py-1.5 rounded-full border border-mc-gold/20">
                <Sparkles size={14} className="text-mc-gold animate-spin" style={{ animationDuration: '3s' }} />
                <span className="text-[10px] font-black text-mc-gold uppercase tracking-[0.2em] leading-none">AKTIVE QUIZ-HERAUSFORDERUNG</span>
              </div>

              {/* Question icon */}
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-mc-gold to-yellow-500 flex items-center justify-center shadow-[0_10px_30px_rgba(255,170,0,0.25)] mb-6">
                <Brain size={32} className="text-black" />
              </div>

              {/* Question Text */}
              <div className="text-center mb-8">
                <h2 className="text-white font-black text-xl md:text-2xl tracking-tight leading-tight uppercase italic drop-shadow-mc-thick px-2">
                  "{activeQuiz.question}"
                </h2>
                <div className="mt-4 flex items-center justify-center gap-2 text-neutral-400 font-black text-[10px] uppercase tracking-widest">
                  <Coins size={14} className="text-mc-gold" />
                  <span>Belohnung:</span>
                  <span className="text-mc-gold">{activeQuiz.reward} Coins</span>
                  <span>+</span>
                  <Trophy size={12} className="text-[#3b82f6]" />
                  <span className="text-[#3b82f6] font-bold">1 Quiz-Sieg</span>
                </div>
              </div>

              {/* Input Form */}
              <form onSubmit={handleSubmit} className="w-full space-y-4">
                <div className="relative">
                  <input
                    type="text"
                    required
                    maxLength={140}
                    disabled={isSending}
                    placeholder="Deine Antwort eingeben..."
                    value={answerInput}
                    onChange={(e) => setAnswerInput(e.target.value)}
                    className="w-full h-14 bg-black/60 border border-neutral-800 focus:border-mc-gold rounded-2xl pl-5 pr-14 text-white text-sm font-black tracking-wide placeholder-neutral-600 outline-none transition-all shadow-inner focus:shadow-[0_0_20px_rgba(255,170,0,0.1)] uppercase"
                  />
                  <button
                    type="submit"
                    disabled={isSending || !answerInput.trim()}
                    className="absolute right-2 top-2 h-10 w-10 bg-mc-gold text-black rounded-lg flex items-center justify-center hover:scale-105 active:scale-95 disabled:opacity-40 disabled:grayscale transition-all"
                  >
                    <Send size={16} />
                  </button>
                </div>
                <p className="text-center text-[9px] text-neutral-500 font-black uppercase tracking-wider">
                  ANTWORTE SCHNELLER ALS DIE ANDEREN! DIE ANTWORT WIRD IM GLOBALEN LIVE-CHAT GEPRÜFT.
                </p>
              </form>

              {/* Toast Feedback */}
              <AnimatePresence>
                {successToast && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="absolute bottom-16 bg-green-500 text-black text-xs font-black uppercase tracking-widest px-4 py-2 rounded-xl shadow-lg border border-green-400"
                  >
                    {successToast}
                  </motion.div>
                )}
              </AnimatePresence>

            </motion.div>
          ) : (
            <motion.div
              key="idle-quiz-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center text-center max-w-sm"
            >
              <div className="w-16 h-16 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center animate-pulse mb-6">
                <Timer size={28} className="text-neutral-500" />
              </div>
              <h3 className="text-white text-lg font-black uppercase tracking-widest italic mb-2">Quiz-Ruhephase</h3>
              <p className="text-xs text-neutral-500 font-bold uppercase tracking-wide leading-relaxed mb-4">
                Der Quiz-Bot sortiert seine Karten... Alle 5 bis 10 Minuten erscheint eine neue Herausforderung automatisch direkt hier und im globalen Chat!
              </p>

              {onRequestNewQuestion && (
                <button
                  type="button"
                  onClick={onRequestNewQuestion}
                  className="mb-6 w-full py-3 px-5 bg-gradient-to-r from-mc-gold to-yellow-500 text-black font-black uppercase rounded-2xl tracking-[0.1em] text-xs hover:scale-[1.03] active:scale-[0.98] transition-all shadow-[0_5px_15px_rgba(255,170,0,0.15)] cursor-pointer"
                >
                  Neue Frage anfordern 💡
                </button>
              )}

              <div className="mt-2 p-4 bg-neutral-900/40 border border-white/5 rounded-2xl w-full flex items-center justify-between">
                <HelpCircle size={16} className="text-mc-gold" />
                <span className="text-[10px] text-neutral-400 uppercase font-bold tracking-widest pl-3 flex-1 text-left">
                  TIPP: Behalte dieses Fenster offen, um blitzschnell antworten zu können.
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* RIGHT SECTION: Mini Guide and Personal Stats Dashboard */}
      <div className="w-full md:w-80 bg-black/40 backdrop-blur-md md:border-l border-t md:border-t-0 border-white/5 p-6 flex flex-col justify-between overflow-hidden relative">
        <div className="space-y-6">
          
          {/* Header */}
          <div>
            <h3 className="text-mc-gold font-black text-lg md:text-xl flex items-center gap-2 drop-shadow-mc uppercase italic">
              <Award size={20} className="text-mc-gold" />
              QUIZ ARENA
            </h3>
            <p className="text-[10px] text-neutral-500 font-black uppercase tracking-widest mt-1">
              Deine persönlichen Errungenschaften
            </p>
          </div>

          {/* Stats Widgets */}
          <div className="grid grid-cols-1 gap-3">
            <div className="p-4 bg-neutral-900/60 border border-white/5 rounded-2xl flex items-center justify-between shadow-lg">
              <div>
                <p className="text-[9px] text-neutral-500 font-black uppercase tracking-widest mb-0.5">Quiz-Siege insgesamt</p>
                <p className="text-2xl font-black text-white italic">
                  {myProfile?.quizWins || 0} 🏆
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-mc-gold/10 border border-mc-gold/20 flex items-center justify-center text-mc-gold shadow-md">
                <Trophy size={20} />
              </div>
            </div>

            <div className="p-4 bg-neutral-900/60 border border-white/5 rounded-2xl flex items-center justify-between shadow-lg">
              <div>
                <p className="text-[9px] text-neutral-500 font-black uppercase tracking-widest mb-0.5">Erhaltene Quiz-Münzen</p>
                <p className="text-2xl font-black text-mc-gold italic">
                  {((myProfile?.quizWins || 0) * 50).toLocaleString()} 🪙
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-mc-gold shadow-md">
                <Coins size={20} />
              </div>
            </div>
          </div>

          {/* Guide list */}
          <div className="space-y-3 bg-neutral-900/30 p-4 border border-white/5 rounded-2xl">
            <p className="text-[9px] text-neutral-400 font-black uppercase tracking-[0.2em] mb-2 leading-none">SPIELREGELN:</p>
            <ol className="text-[10px] text-neutral-500 font-black uppercase space-y-2 leading-relaxed list-decimal list-inside pl-1">
              <li>
                <span className="text-neutral-300">BOT FRAGT</span>: Automatische Quizfragen erscheinen alle 5 Min.
              </li>
              <li>
                <span className="text-neutral-300">ECHTZEIT REAKTION</span>: Tippe die Antwort blitzschnell ein.
              </li>
              <li>
                <span className="text-neutral-300">GESCHWINDIGKEIT GEWINNT</span>: Nur der Allerschnellste erhält den Preis!
              </li>
            </ol>
          </div>

        </div>

        {/* Footer info text */}
        <div className="pt-6 border-t border-white/5 text-center">
          <p className="text-[8px] text-neutral-600 font-black uppercase tracking-[0.3em]">
            SYSTEM BOT SECURED // VER. 1.0.0
          </p>
        </div>
      </div>

    </div>
  );
};
