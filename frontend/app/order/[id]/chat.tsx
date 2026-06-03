import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { Stack, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';

import { api, ChatMessage } from '@/src/api/client';
import { useAuth } from '@/src/context/AuthContext';
import { colors, radii, shadow, spacing, typography } from '@/src/theme';

function SendIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke={colors.white} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function OrderChat() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const listRef = useRef<FlatList>(null);

  const fetchMessages = useCallback(async () => {
    if (!id || !token) return;
    try {
      const msgs = await api.get<ChatMessage[]>(`/orders/${id}/chat`, token);
      setMessages(msgs);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const onSend = async () => {
    const content = text.trim();
    if (!content || sending || !token) return;
    setSending(true);
    setText('');
    try {
      const msg = await api.post<ChatMessage>(`/orders/${id}/chat`, { content }, token);
      setMessages((prev) => [...prev, msg]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      setText(content); // restore on failure
    } finally {
      setSending(false);
    }
  };

  const myId = user?.user_id;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.surface }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={insets.bottom + 8}
    >
      <Stack.Screen
        options={{
          title: 'Chat with Rider',
          headerShown: true,
          headerStyle: { backgroundColor: colors.white },
          headerTitleStyle: { ...typography.bodyBold, color: colors.textPrimary },
        }}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.message_id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptySub}>Start the conversation with your rider</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isMine = item.sender_id === myId;
            return (
              <View style={[styles.msgRow, isMine ? styles.msgRowMine : styles.msgRowOther]}>
                {!isMine && (
                  <View style={styles.avatarDot}>
                    <Text style={styles.avatarText}>{(item.sender_name || 'R').charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
                  {!isMine && (
                    <Text style={styles.senderLabel}>
                      {item.sender_name || 'Rider'} · {item.sender_role}
                    </Text>
                  )}
                  <Text style={[styles.msgText, isMine && styles.msgTextMine]}>{item.content}</Text>
                  <Text style={[styles.msgTime, isMine && styles.msgTimeMine]}>{fmtTime(item.created_at)}</Text>
                </View>
              </View>
            );
          }}
        />
      )}

      <View style={[styles.inputBar, { paddingBottom: insets.bottom + spacing.sm }]}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Type a message…"
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={onSend}
          blurOnSubmit={false}
        />
        <Pressable
          onPress={onSend}
          disabled={!text.trim() || sending}
          style={({ pressed }) => [
            styles.sendBtn,
            (!text.trim() || sending) && styles.sendBtnDisabled,
            pressed && { opacity: 0.85 },
          ]}
        >
          {sending ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <SendIcon />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  list: {
    padding: spacing.md,
    gap: spacing.sm,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: spacing.sm },
  emptyTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: 4 },
  emptySub: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },

  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 4 },
  msgRowMine: { justifyContent: 'flex-end' },
  msgRowOther: { justifyContent: 'flex-start' },

  avatarDot: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { ...typography.captionBold, color: colors.primary },

  bubble: {
    maxWidth: '75%',
    borderRadius: radii.lg,
    padding: spacing.sm,
    ...shadow.soft,
  },
  bubbleMine: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: colors.white,
    borderBottomLeftRadius: 4,
  },

  senderLabel: {
    ...typography.tiny,
    color: colors.textMuted,
    fontWeight: '600',
    marginBottom: 3,
    textTransform: 'capitalize',
  },
  msgText: { ...typography.body, color: colors.textPrimary },
  msgTextMine: { color: colors.white },
  msgTime: { ...typography.tiny, color: colors.textMuted, marginTop: 4, alignSelf: 'flex-end' },
  msgTimeMine: { color: 'rgba(255,255,255,0.7)' },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    ...typography.body,
    color: colors.textPrimary,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendBtn: {
    width: 44, height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    ...shadow.soft,
  },
  sendBtnDisabled: { backgroundColor: colors.textMuted },
});
