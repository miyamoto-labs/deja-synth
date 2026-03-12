'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AskAIProps {
  contextPrompt: string;
  marketQuestion: string;
  compact?: boolean;
}

export function AskAI({ contextPrompt, marketQuestion, compact = false }: AskAIProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customQuestion, setCustomQuestion] = useState('');
  const [response, setResponse] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleAsk = async (prompt: string) => {
    if (!prompt.trim()) return;

    setStatus('loading');
    setResponse('');
    setErrorMsg('');

    try {
      const res = await fetch('/api/bankr/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.slice(0, 500) }),
      });

      const data = await res.json();

      if (data.success && data.response) {
        setResponse(data.response);
        setStatus('done');
      } else {
        throw new Error(data.error || 'AI query failed');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Something went wrong');
      setStatus('error');
    }
  };

  return (
    <div className={compact ? 'mt-3' : 'px-3 sm:px-5 pb-2'}>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-xs text-text-muted hover:text-accent transition group"
      >
        <svg className="h-3.5 w-3.5 group-hover:text-accent transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
        </svg>
        <span>{isOpen ? 'Hide AI' : 'Ask AI'}</span>
        <svg
          className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expandable Section */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className={`mt-3 space-y-3 ${compact ? '' : 'border-t border-ep-border pt-3'}`}>
              {/* Context prompt preview */}
              <div className="rounded-lg bg-ep-surface/50 border border-ep-border/50 p-3">
                <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Context</p>
                <p className="text-xs text-text-secondary leading-relaxed line-clamp-3">
                  {contextPrompt}
                </p>
              </div>

              {/* Custom question input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customQuestion}
                  onChange={(e) => setCustomQuestion(e.target.value)}
                  placeholder="Or ask your own question..."
                  className="flex-1 px-3 py-2 text-xs bg-ep-surface border border-ep-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAsk(customQuestion || contextPrompt);
                    }
                  }}
                />
                <button
                  onClick={() => handleAsk(customQuestion || contextPrompt)}
                  disabled={status === 'loading'}
                  className="px-3 py-2 text-xs font-semibold rounded-lg bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 disabled:opacity-50 disabled:cursor-not-allowed transition shrink-0"
                >
                  {status === 'loading' ? (
                    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    'Ask'
                  )}
                </button>
              </div>

              {/* Loading State */}
              {status === 'loading' && (
                <div className="flex items-center gap-2 py-3">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-xs text-text-muted">bankr.bot is thinking...</span>
                </div>
              )}

              {/* Response */}
              {status === 'done' && response && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg bg-ep-surface border border-accent/10 p-3"
                >
                  <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                    {response}
                  </p>
                  <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-ep-border/50">
                    <svg className="h-3 w-3 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                    <span className="text-[10px] text-text-muted">Powered by bankr.bot</span>
                  </div>
                </motion.div>
              )}

              {/* Error */}
              {status === 'error' && (
                <div className="rounded-lg bg-loss/5 border border-loss/20 p-3">
                  <p className="text-xs text-loss">{errorMsg}</p>
                  <button
                    onClick={() => {
                      setStatus('idle');
                      setErrorMsg('');
                    }}
                    className="text-[10px] text-text-muted hover:text-text-primary mt-1 underline"
                  >
                    Try again
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
