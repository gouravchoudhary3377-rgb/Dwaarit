import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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

type Status = 'open' | 'pending' | 'resolved' | 'closed';

type Ticket = {
  ticket_id: string;
  user_id: string;
  user_email: string;
  subject: string;
  status: Status;
  created_at: string;
  updated_at: string;
};

type Msg = {
  role: 'user' | 'assistant' | 'agent';
  content: string;
  agent_email?: string;
  created_at: string;
};

const STATUSES: Status[] = ['open', 'pending', 'resolved', 'closed'];

const STATUS_TINT: Record<Status, { bg: string; fg: string }> = {
  open: { bg: '#FFF3E0', fg: '#E65100' },
  pending: { bg: '#E3F2FD', fg: '#1565C0' },
  resolved: { bg: '#E8F5E9', fg: '#2E7D32' },
  closed: { bg: '#ECEFF1', fg: '#455A64' },
};

export default function AdminTicketDetail() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<Msg>>(null);

  const load = useCallback(async () => {
    if (!token || !id) return;
    try {
      const res = await api.get<{ ticket: Ticket; messages: Msg[] }>(`/admin/tickets/${id}`, token);
      setTicket(res.ticket);
      setMessages(res.messages);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 50);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not load ticket');
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => { load(); }, [load]);

  async function sendReply() {
    if (!reply.trim() || sending || !id) return;
    setSending(true);
    try {
      await api.post(`/admin/tickets/${id}/reply`, { message: reply.trim() }, token);
      setReply('');
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to send reply');
    } finally {
      setSending(false);
    }
  }

  async function changeStatus(s: Status) {
    if (!id || !ticket || ticket.status === s) return;
    try {
      await api.patch(`/admin/tickets/${id}/status`, { status: s }, token);
      setTicket({ ...ticket, status: s });
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update status');
    }
  }

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top + 80 }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!ticket) {
    return (
      <View style={[styles.center, { paddingTop: insets.top + 80 }]}>
        <Text style={{ color: colors.textSecondary }}>Ticket not found.</Text>
      </View>
    );
  }

  function renderMsg({ item }: { item: Msg }) {
    const isCustomer = item.role === 'user';
    return (
      <View style={[styles.bubbleRow, { justifyContent: isCustomer ? 'flex-start' : 'flex-end' }]}>
        <View
          style={[
            styles.bubble,
            isCustomer ? styles.bubbleCustomer : item.role === 'agent' ? styles.bubbleAgent : styles.bubbleBot,
          ]}
        >
          <Text style={styles.bubbleRole}>
            {isCustomer ? 'Customer' : item.role === 'agent' ? `Agent · ${item.agent_email || ''}` : 'AI Assistant'}
          </Text>
          <Text style={[styles.bubbleText, !isCustomer && { color: colors.white }]}>{item.content}</Text>
          <Text style={[styles.bubbleTime, !isCustomer && { color: 'rgba(255,255,255,0.7)' }]}>
            {new Date(item.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.headerBtn}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 6l-6 6 6 6" stroke={colors.textPrimary} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{ticket.subject || 'Conversation'}</Text>
          <Text style={styles.headerSub}>{ticket.user_email}</Text>
        </View>
      </View>

      {/* Status switcher */}
      <View style={styles.statusBar}>
        <Text style={styles.statusBarLabel}>Status</Text>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
          {STATUSES.map((s) => {
            const active = ticket.status === s;
            const tint = STATUS_TINT[s];
            return (
              <Pressable key={s} onPress={() => changeStatus(s)} style={[styles.statusChip, active && { backgroundColor: tint.bg, borderColor: tint.fg }]}>
                <Text style={[styles.statusChipText, active && { color: tint.fg }]}>{s}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(_, i) => `${i}`}
        renderItem={renderMsg}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 20 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
      />

      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <TextInput
          value={reply}
          onChangeText={setReply}
          placeholder="Reply as support agent…"
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={2000}
          style={styles.input}
          editable={!sending}
        />
        <Pressable
          onPress={sendReply}
          disabled={!reply.trim() || sending}
          style={[styles.sendBtn, (!reply.trim() || sending) && { opacity: 0.5 }]}
        >
          {sending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.sendText}>Send</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.md, paddingBottom: spacing.md,
    backgroundColor: colors.white, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  headerBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.h3, color: colors.textPrimary },
  headerSub: { ...typography.tiny, color: colors.textSecondary, marginTop: 2 },

  statusBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: 10, gap: 8, backgroundColor: colors.white, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  statusBarLabel: { ...typography.captionBold, color: colors.textSecondary },
  statusChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  statusChipText: { ...typography.tiny, color: colors.textSecondary, fontWeight: '700', textTransform: 'capitalize' },

  bubbleRow: { flexDirection: 'row', marginBottom: 10 },
  bubble: { maxWidth: '85%', padding: 12, borderRadius: 14, ...shadow.soft },
  bubbleCustomer: { backgroundColor: colors.white, borderTopLeftRadius: 4 },
  bubbleBot: { backgroundColor: '#5C6BC0', borderTopRightRadius: 4 },
  bubbleAgent: { backgroundColor: colors.primary, borderTopRightRadius: 4 },
  bubbleRole: { ...typography.tiny, fontWeight: '800', marginBottom: 4, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  bubbleText: { ...typography.body, color: colors.textPrimary },
  bubbleTime: { ...typography.tiny, color: colors.textMuted, marginTop: 6 },

  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: spacing.md, paddingTop: 8, gap: 8, backgroundColor: colors.white, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  input: { flex: 1, backgroundColor: colors.surface, borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 12 : 8, maxHeight: 140, ...typography.body, color: colors.textPrimary },
  sendBtn: { backgroundColor: colors.primary, borderRadius: radii.md, paddingHorizontal: 18, height: 44, alignItems: 'center', justifyContent: 'center' },
  sendText: { color: colors.white, fontWeight: '800' },
});
