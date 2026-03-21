"use client";

import { useState } from "react";
import AppSidebar from "@/components/common/AppSidebar";
import LoadingScreen from "@/components/common/LoadingScreen";
import { useAuth } from "@/providers/AuthProvider";

type MockChat = {
  id: string;
  name: string;
  avatar: string | null;
  lastMessage: string;
  time: string;
  unread: boolean;
  isGroup: boolean;
};

const MOCK_CHATS: MockChat[] = [
  { id: "1", name: "Ana García", avatar: null, lastMessage: "Nos vemos mañana!", time: "14:32", unread: true, isGroup: false },
  { id: "2", name: "Plan Roma 🇮🇹", avatar: null, lastMessage: "He reservado el hotel", time: "12:05", unread: true, isGroup: true },
  { id: "3", name: "Carlos López", avatar: null, lastMessage: "Genial, gracias!", time: "Ayer", unread: false, isGroup: false },
  { id: "4", name: "María Ruiz", avatar: null, lastMessage: "¿Quedamos el viernes?", time: "Ayer", unread: false, isGroup: false },
  { id: "5", name: "Plan Barcelona", avatar: null, lastMessage: "Yo llego el sábado", time: "Lun", unread: false, isGroup: true },
  { id: "6", name: "Pedro Martín", avatar: null, lastMessage: "Perfecto 👍", time: "Lun", unread: false, isGroup: false },
  { id: "7", name: "Plan Londres 🇬🇧", avatar: null, lastMessage: "¿Alguien ha mirado vuelos?", time: "Dom", unread: false, isGroup: true },
  { id: "8", name: "Lucía Fernández", avatar: null, lastMessage: "Jajaja muy bueno", time: "Dom", unread: false, isGroup: false },
  { id: "9", name: "Plan París", avatar: null, lastMessage: "Confirmado para abril", time: "Sáb", unread: false, isGroup: true },
  { id: "10", name: "Javier Ruiz", avatar: null, lastMessage: "Hablamos luego", time: "Sáb", unread: false, isGroup: false },
];

export default function MessagesPage() {
  const { loading } = useAuth();
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState("");

  if (loading) return <LoadingScreen />;

  const selected = MOCK_CHATS.find((c) => c.id === selectedChat);
  const trimmedSearch = searchValue.trim().toLowerCase();
  const filteredChats = trimmedSearch
    ? MOCK_CHATS.filter((c) => c.name.toLowerCase().includes(trimmedSearch) || c.lastMessage.toLowerCase().includes(trimmedSearch))
    : MOCK_CHATS;

  return (
    <div className="min-h-dvh bg-app text-app">
      <div className="relative mx-auto min-h-dvh max-w-[1440px]">
        <AppSidebar />

        <main className="px-safe pb-[calc(var(--space-20)+env(safe-area-inset-bottom))] pt-[var(--space-4)] md:py-[var(--space-8)] md:pr-[var(--space-14)]">
          <div className="mx-auto w-full max-w-[760px]">
            {/* Chat list or conversation */}
            {selectedChat && selected ? (
              <ChatConversation chat={selected} onBack={() => setSelectedChat(null)} />
            ) : (
              <>
                {/* Search */}
                <div className="relative mb-[var(--space-3)]">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-[16px] -translate-y-1/2 text-muted">
                    <circle cx="11" cy="11" r="6.2" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M16 16L20.5 20.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                  <input
                    type="text"
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    placeholder="Buscar"
                    className="w-full rounded-full border border-app bg-surface py-[7px] pl-9 pr-8 text-body-sm text-app outline-none transition-colors focus:border-[var(--border-strong)] [&::-webkit-search-cancel-button]:hidden"
                  />
                  {searchValue && (
                    <button
                      type="button"
                      onClick={() => setSearchValue("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition-opacity hover:opacity-70"
                    >
                      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-[14px]">
                        <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </button>
                  )}
                </div>
                <div className="space-y-[1px]">
                {filteredChats.map((chat) => (
                  <button
                    key={chat.id}
                    type="button"
                    onClick={() => setSelectedChat(chat.id)}
                    className="flex w-full items-center gap-[var(--space-3)] rounded-[10px] px-2 py-[10px] text-left transition-colors hover:bg-surface"
                  >
                    <div className="relative shrink-0">
                      <div className="flex avatar-md items-center justify-center overflow-hidden rounded-full border border-app bg-surface-inset text-body-sm font-[var(--fw-semibold)] text-app">
                        {chat.avatar ? (
                          <img src={chat.avatar} alt={chat.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                        ) : chat.isGroup ? (
                          <GroupIcon className="size-[16px] text-muted" />
                        ) : (
                          chat.name[0].toUpperCase()
                        )}
                      </div>
                      {chat.unread && (
                        <span className="absolute -right-[2px] -top-[2px] size-[10px] rounded-full border-2 border-[var(--bg)] bg-[#ff6a3d]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-body-sm ${chat.unread ? "font-[var(--fw-semibold)] text-app" : "text-app"}`}>
                        {chat.name}
                      </p>
                      <p className={`truncate text-[12px] leading-[16px] ${chat.unread ? "font-[var(--fw-medium)] text-app" : "text-muted"}`}>
                        {chat.lastMessage}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted">{chat.time}</span>
                  </button>
                ))}
              </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

type ChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  time: string;
};

function getMockMessages(chat: MockChat): ChatMessage[] {
  if (chat.isGroup) {
    return [
      { id: "m1", senderId: "u1", senderName: "Ana García", text: "Hola a todos!", time: "10:02" },
      { id: "m2", senderId: "u1", senderName: "Ana García", text: "Alguien ha mirado los vuelos?", time: "10:03" },
      { id: "m3", senderId: "me", senderName: "", text: "Sí, los estuve mirando ayer", time: "10:05" },
      { id: "m4", senderId: "u2", senderName: "Carlos López", text: "Yo también, hay buenos precios", time: "10:06" },
      { id: "m5", senderId: "u2", senderName: "Carlos López", text: "Os paso el link", time: "10:07" },
      { id: "m6", senderId: "me", senderName: "", text: "Perfecto 👍", time: "10:08" },
      { id: "m7", senderId: "u1", senderName: "Ana García", text: chat.lastMessage, time: chat.time },
    ];
  }
  return [
    { id: "m1", senderId: "other", senderName: chat.name, text: "Hola! Qué tal?", time: "10:02" },
    { id: "m2", senderId: "me", senderName: "", text: "Hey! Todo bien y tú?", time: "10:05" },
    { id: "m3", senderId: "other", senderName: chat.name, text: "Genial, oye te quería comentar lo del plan", time: "10:06" },
    { id: "m4", senderId: "me", senderName: "", text: "Sí claro, dime", time: "10:07" },
    { id: "m5", senderId: "other", senderName: chat.name, text: chat.lastMessage, time: chat.time },
  ];
}

function ChatConversation({ chat, onBack }: { chat: MockChat; onBack: () => void }) {
  const [message, setMessage] = useState("");
  const mockMessages = getMockMessages(chat);

  return (
    <div>
      {/* Chat header */}
      <div className="flex items-center gap-[var(--space-3)] border-b border-app pb-[var(--space-3)]">
        <button
          type="button"
          onClick={onBack}
          className="flex size-[32px] items-center justify-center rounded-full transition-colors hover:bg-surface"
          aria-label="Volver"
        >
          <BackIcon className="size-[18px]" />
        </button>
        <div className="flex avatar-md items-center justify-center overflow-hidden rounded-full border border-app bg-surface-inset text-body-sm font-[var(--fw-semibold)] text-app">
          {chat.avatar ? (
            <img src={chat.avatar} alt={chat.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
          ) : chat.isGroup ? (
            <GroupIcon className="size-[16px] text-muted" />
          ) : (
            chat.name[0].toUpperCase()
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-body-sm font-[var(--fw-semibold)] text-app">{chat.name}</p>
          {chat.isGroup && <p className="text-[11px] text-muted">Grupo</p>}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex min-h-[400px] flex-col justify-end py-[var(--space-4)]">
        <div className="space-y-[1px]">
          {mockMessages.map((msg, idx) => {
            const isMe = msg.senderId === "me";
            const prevMsg = mockMessages[idx - 1];
            const isFirstInGroup = !prevMsg || prevMsg.senderId !== msg.senderId;

            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} ${isFirstInGroup ? "mt-[var(--space-3)]" : "mt-[2px]"}`}>
                {/* Avatar slot for group others */}
                {!isMe && chat.isGroup && (
                  <div className="mr-[var(--space-2)] w-[24px] shrink-0">
                    {isFirstInGroup && (
                      <div className="flex size-[24px] items-center justify-center overflow-hidden rounded-full border border-app bg-surface-inset text-[10px] font-[var(--fw-semibold)] text-app">
                        {msg.senderName[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                )}
                <div className={`max-w-[75%] rounded-[16px] px-3 py-2 ${
                  isMe
                    ? "bg-[var(--text-primary)] text-contrast-token"
                    : "bg-surface-inset"
                }`}>
                  {!isMe && chat.isGroup && isFirstInGroup && (
                    <p className="mb-[2px] text-[11px] font-[var(--fw-semibold)] text-muted">{msg.senderName}</p>
                  )}
                  <p className="text-body-sm">{msg.text}</p>
                  <p className={`mt-[2px] text-right text-[10px] ${isMe ? "text-contrast-token/60" : "text-muted"}`}>{msg.time}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Input */}
      <div className="flex items-center gap-[var(--space-2)] border-t border-app pt-[var(--space-3)]">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Escribe un mensaje..."
          className="min-w-0 flex-1 rounded-full border border-app bg-surface px-4 py-[8px] text-body-sm text-app outline-none transition-colors focus:border-[var(--border-strong)]"
        />
        <button
          type="button"
          disabled={!message.trim()}
          className="flex size-[36px] shrink-0 items-center justify-center rounded-full bg-[var(--text-primary)] text-contrast-token transition-opacity hover:opacity-80 disabled:opacity-30"
          aria-label="Enviar"
        >
          <SendMsgIcon className="size-[16px]" />
        </button>
      </div>
    </div>
  );
}

function BackIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GroupIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <circle cx="9" cy="7" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M2 19c1-3 3.5-4.5 7-4.5s6 1.5 7 4.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M18.5 14.5c1.5.8 2.8 2 3.5 4.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function SendMsgIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M22 2L11 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
