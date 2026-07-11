import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bot, Globe, X } from 'lucide-react';

interface InfoBotPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InfoBotPanel: React.FC<InfoBotPanelProps> = ({ isOpen, onClose }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          key="botpress-drawer-panel"
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 100 }}
          className="fixed inset-y-0 right-0 w-full sm:w-[450px] bg-black/98 backdrop-blur-2xl z-[70] border-l border-neutral-800 shadow-2xl flex flex-col pt-20"
        >
          <div className="p-6 border-b border-neutral-800 flex flex-col gap-3">
            <div className="flex items-center justify-between w-full">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold flex items-center gap-2 font-mono text-cyan-400">
                    <Bot className="text-cyan-400 animate-pulse" size={22} />
                    Info-Bot
                  </h3>
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                </div>
                <p className="text-neutral-400 text-xs mt-1">Frage unseren intelligenten Info-Bot alles über den Realm!</p>
              </div>
              <div className="flex items-center gap-2">
                <a 
                  href="https://dampf.mypi.co/?info=true"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-neutral-400 hover:text-cyan-400 hover:bg-neutral-800 rounded-lg transition-all"
                  title="In neuem Tab öffnen"
                >
                  <Globe size={18} />
                </a>
                <button onClick={onClose} className="p-2 hover:bg-neutral-800 rounded-lg transition-colors text-neutral-400 hover:text-white">
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Direct Fullscreen Link Banner */}
            <div className="bg-cyan-950/30 border border-cyan-500/20 rounded-lg px-3 py-1.5 text-xs text-cyan-300 flex items-center justify-between gap-1">
              <span>Direkt-Link zum Bot:</span>
              <a 
                href="https://dampf.mypi.co/?info=true"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold underline text-cyan-400 hover:text-cyan-200 transition-colors uppercase tracking-wider text-[10px]"
              >
                In neuem Tab öffnen ↗
              </a>
            </div>
          </div>
          <div className="flex-1 w-full bg-neutral-950 relative">
            <iframe
              src="https://cdn.botpress.cloud/webchat/v3.6/shareable.html?configUrl=https://files.bpcontent.cloud/2026/06/21/12/20260621124741-8QMPZF8T.json"
              className="w-full h-full border-none"
              title="KI Community info Chat"
              allow="microphone; camera; geolocation"
            ></iframe>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
