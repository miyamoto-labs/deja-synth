"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUserStore } from "@/app/lib/stores/user-store";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function ChatWidget() {
  const { walletAddress } = useUserStore();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hi! I'm easyP, your betting concierge. How can I help you today?" },
  ]);
  const [streaming, setStreaming] = useState(false);
  const [showGreeting, setShowGreeting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Show greeting bubble after 5s (once per session)
  useEffect(() => {
    const greeted = sessionStorage.getItem("ep_chat_greeted");
    if (greeted) return;

    const timer = setTimeout(() => {
      setShowGreeting(true);
      sessionStorage.setItem("ep_chat_greeted", "1");
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  // Auto-dismiss greeting after 6s
  useEffect(() => {
    if (!showGreeting) return;
    const timer = setTimeout(() => setShowGreeting(false), 6000);
    return () => clearTimeout(timer);
  }, [showGreeting]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when opening
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open]);

  function handleQuickAsk(question: string) {
    if (streaming) return;
    setInput("");
    sendMessage(question);
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    sendMessage(text);
  }

  async function sendMessage(text: string) {
    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setStreaming(true);

    // Add placeholder for assistant response
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: messages.slice(-20),
        }),
      });

      if (!res.ok) throw new Error("Chat request failed");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") break;

          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") {
                  last.content += parsed.text;
                }
                return updated;
              });
            }
          } catch {
            // skip malformed chunks
          }
        }
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === "assistant" && !last.content) {
          last.content = "Sorry, something went wrong. Try again!";
        }
        return updated;
      });
    } finally {
      setStreaming(false);
    }
  }

  // Only show for logged-in users
  if (!walletAddress) return null;

  return (
    <>
      {/* Floating button + greeting */}
      <div className="fixed bottom-20 left-4 md:bottom-6 md:left-6 z-40 flex flex-col items-start gap-2">
        {/* Chat hint label */}
        <AnimatePresence>
          {showGreeting && !open && (
            <motion.button
              onClick={() => {
                setShowGreeting(false);
                setOpen(true);
              }}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="ep-card px-3 py-2 rounded-xl shadow-lg border border-[var(--ep-green)]/20 flex items-center gap-2 hover:border-[var(--ep-green)]/40 transition cursor-pointer"
            >
              <span className="text-xs font-medium text-[var(--text-primary)] whitespace-nowrap">
                Chat with <span className="text-[var(--ep-green)] font-bold">easyP</span>
              </span>
              <motion.span
                animate={{ y: [0, 4, 0] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                className="text-[var(--ep-green)] text-sm"
              >
                ↓
              </motion.span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* FAB */}
        <motion.button
          onClick={() => {
            setShowGreeting(false);
            setOpen(!open);
          }}
          className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all overflow-hidden ${
            open
              ? "bg-[var(--ep-surface)] border border-[var(--ep-border)] text-[var(--text-muted)]"
              : "border-2 border-[var(--ep-green)]/40 shadow-[0_0_12px_rgba(0,240,160,0.3)]"
          }`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {open ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <img src="/easyp.jpg" alt="easyP" className="w-full h-full object-cover" />
          )}
        </motion.button>
      </div>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-36 left-4 md:bottom-20 md:left-6 z-40 w-[calc(100vw-2rem)] max-w-sm"
          >
            <div className="ep-card rounded-2xl shadow-2xl border border-[var(--ep-border)]/50 overflow-hidden flex flex-col" style={{ maxHeight: "min(480px, 60vh)" }}>
              {/* Header */}
              <div className="px-4 pt-4 pb-3 border-b border-[var(--ep-border)]/50 flex items-center gap-2.5 shrink-0">
                <img src="/easyp.jpg" alt="easyP" className="w-8 h-8 rounded-full object-cover border border-[var(--ep-green)]/30" />
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">easyP</h3>
                  <p className="text-[10px] text-[var(--text-muted)]">Your betting concierge</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[200px]">
                {messages.length === 1 && messages[0].role === "assistant" && (
                  <div className="flex flex-wrap gap-1.5 justify-center mt-1">
                    {["How do I start?", "What are picks?", "How does copy-trading work?"].map((q) => (
                      <button
                        key={q}
                        onClick={() => handleQuickAsk(q)}
                        className="px-2.5 py-1.5 rounded-lg text-[10px] font-medium border border-[var(--ep-border)] text-[var(--text-secondary)] hover:text-[var(--ep-green)] hover:border-[var(--ep-green)]/30 transition"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}

                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex items-end gap-1.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" && (
                      <img src="/easyp.jpg" alt="" className="w-5 h-5 rounded-full object-cover shrink-0 mb-0.5" />
                    )}
                    <div
                      className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                        msg.role === "user"
                          ? "bg-[var(--ep-green)]/15 text-[var(--text-primary)] rounded-br-md"
                          : "bg-[var(--ep-surface)] border border-[var(--ep-border)]/50 text-[var(--text-primary)] rounded-bl-md"
                      }`}
                    >
                      {msg.content || (
                        <span className="inline-flex gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] animate-pulse" />
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] animate-pulse" style={{ animationDelay: "0.2s" }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] animate-pulse" style={{ animationDelay: "0.4s" }} />
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="px-3 pb-3 pt-1 border-t border-[var(--ep-border)]/50 shrink-0">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask easyP anything..."
                    disabled={streaming}
                    className="flex-1 px-3 py-2 bg-[var(--ep-surface)] border border-[var(--ep-border)] rounded-xl
                               text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
                               focus:outline-none focus:border-[var(--ep-green)]/50 focus:ring-1 focus:ring-[var(--ep-green)]/20
                               transition disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={streaming || !input.trim()}
                    className="w-8 h-8 rounded-lg bg-[var(--ep-green)] text-[var(--ep-bg)] flex items-center justify-center
                               disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition shrink-0"
                  >
                    {streaming ? (
                      <div className="h-3.5 w-3.5 border-2 border-[var(--ep-bg)]/30 border-t-[var(--ep-bg)] rounded-full animate-spin" />
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
                      </svg>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
