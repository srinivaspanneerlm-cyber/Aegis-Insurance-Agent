"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { AmbientBackground } from "@/components/shared/AmbientBackground";
import {
  wrapperClass,
  useContactChat,
  ContactHero,
  SupportCategories,
  VaultChatRoom,
  TrustPillars,
} from "@/components/contact";

export default function ContactPage() {
  const chat = useContactChat();

  return (
    <div className={`min-h-screen relative flex flex-col justify-between overflow-hidden transition-colors duration-300 ${wrapperClass}`}>
      <Navbar />
      <AmbientBackground variant="contact" />
      <ContactHero onOpenChat={chat.openChat} />
      <SupportCategories onQuickAccess={chat.handleQuickAccess} />
      <VaultChatRoom
        isChatOpen={chat.isChatOpen}
        toggleChat={chat.toggleChat}
        messages={chat.messages}
        isTyping={chat.isTyping}
        inputVal={chat.inputVal}
        setInputVal={chat.setInputVal}
        handleSendMessage={chat.handleSendMessage}
        chatEndRef={chat.chatEndRef}
        chatConsoleRef={chat.chatConsoleRef}
      />
      <TrustPillars />
      <Footer />
    </div>
  );
}
