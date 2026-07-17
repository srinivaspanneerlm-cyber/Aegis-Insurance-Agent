"use client";

import { useState, useEffect, useRef } from "react";
import { getExecutiveResponse } from "./executiveResponses";

/** A single message in the Contact page demo chat. */
export interface ChatMessage {
  sender: "user" | "advisor";
  text: string;
  timestamp: string;
}

const now = () =>
  new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const INTRO_MESSAGE: ChatMessage = {
  sender: "advisor",
  text: `Hello 👋\nI’m Sri AI,\nChief Executive AI Advisor at Aegis AI.\n\nI’m here to help you with:\n• insurance guidance\n• technical support\n• platform assistance\n• consultation issues\n• AI recommendation clarification\n\nHow may I assist you today?`,
  timestamp: "",
};

/** Delay before the mock advisor "types" its reply (ms). */
const ADVISOR_REPLY_DELAY = 1200;

/**
 * Owns all state and behaviour for the Contact page demo chat: message list,
 * input, typing indicator, open/closed panel, and the auto-scroll refs. The
 * page and its section components consume this so the shared chat state lives
 * in exactly one place (previously all inline in the monolithic page).
 */
export function useContactChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputVal, setInputVal] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatConsoleRef = useRef<HTMLDivElement>(null);

  // Seed the intro message on mount (timestamp resolved client-side).
  useEffect(() => {
    setMessages([{ ...INTRO_MESSAGE, timestamp: now() }]);
  }, []);

  // Keep the latest message in view as the conversation grows.
  useEffect(() => {
    const timer = setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
    return () => clearTimeout(timer);
  }, [messages, isTyping]);

  const scrollToConsole = () => {
    setTimeout(() => {
      chatConsoleRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleSendMessage = (e?: React.FormEvent, customMsg?: string) => {
    if (e) e.preventDefault();
    const finalMsg = customMsg || inputVal;
    if (!finalMsg.trim()) return;

    if (!customMsg) setInputVal("");
    setMessages((prev) => [...prev, { sender: "user", text: finalMsg, timestamp: now() }]);
    setIsTyping(true);

    setTimeout(() => {
      const aiReply = getExecutiveResponse(finalMsg);
      setMessages((prev) => [...prev, { sender: "advisor", text: aiReply, timestamp: now() }]);
      setIsTyping(false);
    }, ADVISOR_REPLY_DELAY);
  };

  /** Hero CTA: reveal the chat panel and scroll to it. */
  const openChat = () => {
    setIsChatOpen(true);
    scrollToConsole();
  };

  /** Support category card: open the panel, scroll, and send the topic. */
  const handleQuickAccess = (topic: string) => {
    setIsChatOpen(true);
    scrollToConsole();
    handleSendMessage(undefined, topic);
  };

  const toggleChat = () => setIsChatOpen((open) => !open);

  return {
    messages,
    inputVal,
    setInputVal,
    isTyping,
    isChatOpen,
    chatEndRef,
    chatConsoleRef,
    handleSendMessage,
    openChat,
    handleQuickAccess,
    toggleChat,
  };
}
