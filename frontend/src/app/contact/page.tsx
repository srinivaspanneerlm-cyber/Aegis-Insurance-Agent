"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useTheme } from "@/context/ThemeContext";
import { wrapperClass } from "@/components/contact/contactTheme";
import { useContactChat } from "@/components/contact/useContactChat";
import { AmbientBackground } from "@/components/shared/AmbientBackground";
import { ContactHero } from "@/components/contact/ContactHero";
import { SupportCategories } from "@/components/contact/SupportCategories";
import { VaultChatRoom } from "@/components/contact/VaultChatRoom";
import { TrustPillars } from "@/components/contact/TrustPillars";

export default function ContactPage() {
  const { theme } = useTheme();
  const chat = useContactChat();

  return (
    <div className={`min-h-screen relative flex flex-col justify-between overflow-hidden transition-colors duration-300 ${wrapperClass(theme)}`}>
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
