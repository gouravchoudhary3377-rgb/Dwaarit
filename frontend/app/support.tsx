import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';

import { api } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';

type Msg = {
  ticket_id: string;
  role: 'user' | 'assistant' | 'agent';
  content: string;
  agent_email?: string;
  created_at: string;
};

type Ticket = {
  ticket_id: string;
  subject: string;
  status: 'open' | 'pending' | 'resolved' | 'closed';
  updated_at: string;
  created_at: string;
};

const SUGGESTIONS = [
  'Where is my latest order?',
  'How do refunds work?',
  'Change delivery address',
  'How to use wallet credits?',
];

function StatusDot({ status }: { status: Ticket['status'] }) {
  const map: Record<Ticket['status'], string> = {
    open: '#FF8A00',
    pending: '#1E88E5',
    resolved: '#34C759',
    closed: colors.textMuted,
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: map[status] }} />
      <Text style={{ ...typography.tiny, color: colors.textSecondary, textTransform: 'capitalize', fontWeight: '700' }}>
        {status}
      </Text>
    </View>
  );
}

function BackIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M15 6l-6 6 6 6" stroke={colors.textPrimary} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function SendIcon({ disabled }: { disabled: boolean }) {
  const c = disabled ? colors.textMuted : colors.white;
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M3 11l18-8-8 18-2-8-8-2z" stroke={c} strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  );
}

export default function SupportScreen() {
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const params = useLocalSearchParams<{ ticket_id?: string }>();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeTicket, setActiveTicket] = useState<string | null>(
    typeof params.ticket_id === 'string' ? params.ticket_id : null,
  );
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const listRef = useRef<FlatList<Msg>>(null);

  const loadTickets = useCallback(async () => {
    if (!token) return;
    try {
      setLoadingTickets(true);
      const list = await api.get<Ticket[]>('/support/tickets', token);
      setTickets(list || []);
    } catch {
      setTickets([]);
    } finally {
      setLoadingTickets(false);
    }
  }, [token]);

  const loadMessages = useCallback(
    async (id: string) => {
      if (!token) return;
      try {
        const res = await api.get<{ ticket: Ticket; messages: Msg[] }>(
          `/support/tickets/${id}`,
          token,
        );
        setMessages(res.messages || []);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 50);
      } catch {
        setMessages([]);
      }
    },
    [token],
  );

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    if (activeTicket) loadMessages(activeTicket);
    else setMessages([]);
  }, [activeTicket, loadMessages]);

  async function send(text?: string) {
    const message = (text ?? input).trim();
    if (!message || sending) return;
    setInput('');
    setSending(true);

    // optimistic
    const tempMsg: Msg = {
      ticket_id: activeTicket || 'new',
      role: 'user',
      content: message,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, tempMsg]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);

    try {
      const res = await api.post<{ ticket_id: string; reply: string }>(
        '/support/chat',
        { ticket_id: activeTicket || undefined, message },
        token,
      );
      if (!activeTicket) setActiveTicket(res.ticket_id);
      setMessages((m) => [
        ...m,
        {
          ticket_id: res.ticket_id,
          role: 'assistant',
          content: res.reply,
          created_at: new Date().toISOString(),
        },
      ]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
      loadTickets();
    } catch (e: any) {
      setMessages((m) => [
        ...m,
        {
          ticket_id: activeTicket || 'new',
          role: 'assistant',
          content: "Sorry, I couldn't reach the assistant. Please try again.",
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  function renderMsg({ item }: { item: Msg }) {
    const isUser = item.role === 'user';
    const isAgent = item.role === 'agent';
    return (
      <View
        style={[
          styles.bubbleRow,
          { justifyContent: isUser ? 'flex-end' : 'flex-start' },
        ]}
      >
        {!isUser && (
          <View style={[styles.botAvatar, isAgent && { backgroundColor: '#E3F2FD' }]}>
            <Text style={[styles.botAvatarText, isAgent && { color: '#1565C0' }]}>
              {isAgent ? 'A' : 'D'}
            </Text>
          </View>
        )}
        <View
          style={[
            styles.bubble,
            isUser ? styles.bubbleUser : styles.bubbleBot,
          ]}
        >
          {isAgent && (
            <Text style={styles.agentLabel}>
              Support Agent{item.agent_email ? ` · ${item.agent_email}` : ''}
            </Text>
          )}
          <Text style={[styles.bubbleText, isUser && { color: colors.white }]}>
            {item.content}
          </Text>
        </View>
      </View>
    );
  }

  const showTicketsList = !activeTicket && tickets.length > 0 && messages.length === 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.surface }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => {
            if (activeTicket && tickets.length > 0) {
              setActiveTicket(null);
              setMessages([]);
            } else {
              router.back();
            }
          }}
          hitSlop={10}
          style={styles.headerBtn}
        >
          <BackIcon />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Help & Support</Text>
          <Text style={styles.headerSub}>
            {activeTicket ? `Ticket ${activeTicket.slice(0, 14)}` : 'AI assistant · usually replies instantly'}
          </Text>
        </View>
        {activeTicket && (
          <Pressable
            onPress={() => {
              setActiveTicket(null);
              setMessages([]);
            }}
            style={styles.newBtn}
          >
            <Text style={styles.newBtnText}>New</Text>
          </Pressable>
        )}
      </View>

      {/* Past tickets gallery (only on landing) */}
      {showTicketsList && (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          <Text style={styles.sectionTitle}>YOUR RECENT TICKETS</Text>
          <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
            {tickets.slice(0, 6).map((t) => (
              <Pressable
                key={t.ticket_id}
                onPress={() => setActiveTicket(t.ticket_id)}
                style={styles.ticketCard}
                android_ripple={{ color: colors.surface }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.ticketSubject} numberOfLines={1}>
                    {t.subject || 'Conversation'}
                  </Text>
                  <Text style={styles.ticketDate}>
                    {new Date(t.updated_at).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
                <StatusDot status={t.status} />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Chat area */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m, i) => `${m.ticket_id}-${i}-${m.created_at}`}
        renderItem={renderMsg}
        contentContainerStyle={{
          paddingHorizontal: spacing.md,
          paddingTop: spacing.md,
          paddingBottom: spacing.md,
          flexGrow: 1,
        }}
        ListEmptyComponent={
          loadingTickets ? (
            <View style={{ alignItems: 'center', marginTop: 60 }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : !activeTicket ? (
            <View style={styles.welcomeWrap}>
              <View style={styles.welcomeAvatar}>
                <Text style={{ color: colors.white, fontWeight: '800', fontSize: 22 }}>D</Text>
              </View>
              <Text style={styles.welcomeTitle}>
                Hi {user?.name?.split(' ')[0] || 'there'} 👋
              </Text>
              <Text style={styles.welcomeSub}>
                I'm Flynkit Assistant. Ask me anything about orders, refunds, wallet, or delivery.
              </Text>
              <View style={{ width: '100%', marginTop: spacing.lg, gap: 8 }}>
                {SUGGESTIONS.map((s) => (
                  <Pressable key={s} style={styles.suggestion} onPress={() => send(s)}>
                    <Text style={styles.suggestionText}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null
        }
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
      />

      {sending && (
        <View style={styles.typingRow}>
          <View style={styles.dot} />
          <View style={[styles.dot, { opacity: 0.7 }]} />
          <View style={[styles.dot, { opacity: 0.4 }]} />
          <Text style={{ ...typography.tiny, color: colors.textMuted, marginLeft: 6 }}>
            assistant is typing…
          </Text>
        </View>
      )}

      {/* Input */}
      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Type your message…"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          multiline
          maxLength={1500}
          editable={!sending}
        />
        <Pressable
          onPress={() => send()}
          disabled={!input.trim() || sending}
          style={[
            styles.sendBtn,
            (!input.trim() || sending) && { backgroundColor: colors.surface },
          ]}
        >
          <SendIcon disabled={!input.trim() || sending} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  headerBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.h3, color: colors.textPrimary },
  headerSub: { ...typography.tiny, color: colors.textSecondary, marginTop: 2 },
  newBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
  },
  newBtnText: { ...typography.captionBold, color: colors.primary },

  sectionTitle: {
    ...typography.tiny,
    color: colors.textMuted,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
  },
  ticketCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: 8,
    ...shadow.soft,
  },
  ticketSubject: { ...typography.bodyBold, color: colors.textPrimary },
  ticketDate: { ...typography.tiny, color: colors.textMuted, marginTop: 2 },

  welcomeWrap: { alignItems: 'center', marginTop: 24, paddingHorizontal: spacing.md },
  welcomeAvatar: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  welcomeTitle: { ...typography.h2, color: colors.textPrimary, marginBottom: 6 },
  welcomeSub: { ...typography.body, color: colors.textSecondary, textAlign: 'center', maxWidth: 320 },
  suggestion: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestionText: { ...typography.body, color: colors.textPrimary },

  bubbleRow: { flexDirection: 'row', marginBottom: 10, alignItems: 'flex-end', gap: 6 },
  botAvatar: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  botAvatarText: { color: colors.white, fontWeight: '800' },
  bubble: {
    maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18,
  },
  bubbleUser: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleBot: { backgroundColor: colors.white, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border },
  bubbleText: { ...typography.body, color: colors.textPrimary },
  agentLabel: { ...typography.tiny, color: '#1565C0', fontWeight: '700', marginBottom: 4 },

  typingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: 4, gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingTop: 8,
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    maxHeight: 120,
    ...typography.body,
    color: colors.textPrimary,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
});
