import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Image, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { currentConversation, messages as loadMessages, newConversation, sendMessage, type Message } from '@/lib/data';
import { useAuth } from '@/lib/auth';
import { tali } from '@/components/ui';
import { colours, radius, space } from '@/constants/theme';

type Row = Message & { pending?: boolean; failed?: boolean };

const STARTERS = [
  'Help me plan my week',
  'Write a follow-up for a client who went quiet',
  'Give me 3 post ideas for this week',
  'What should I focus on to grow?',
];

export default function Talk() {
  const { profile } = useAuth();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [text, setText] = useState('');
  const [thinking, setThinking] = useState(false);
  const [notice, setNotice] = useState('');
  const listRef = useRef<FlatList<Row>>(null);

  const load = useCallback(async () => {
    try {
      const id = await currentConversation();
      setConversationId(id);
      setRows(await loadMessages(id));
    } catch (e: any) {
      setNotice(e?.message ?? 'Could not load the chat.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function send(raw?: string) {
    const body = (raw ?? text).trim();
    if (!body || !conversationId || thinking) return;
    setText('');
    setNotice('');
    const temp: Row = { id: `tmp-${Date.now()}`, role: 'user', content: body, created_at: new Date().toISOString(), pending: true };
    setRows((r) => [...r, temp]);
    setThinking(true);
    const res = await sendMessage(conversationId, body);
    setThinking(false);
    if (res.ok) {
      setRows(await loadMessages(conversationId));
      const bits: string[] = [];
      if (res.drafted) bits.push(res.drafted === 1 ? 'Draft waiting on Today' : `${res.drafted} drafts waiting on Today`);
      if (res.remembered > 0) bits.push(res.remembered === 1 ? 'saved 1 thing to remember' : `saved ${res.remembered} things to remember`);
      if (bits.length) setNotice(bits.join(', ').replace(/^./, (c) => c.toUpperCase()) + '.');
    } else {
      setRows((r) => r.map((m) => (m.id === temp.id ? { ...m, pending: false, failed: true } : m)));
      setNotice(res.message);
    }
  }

  async function startNew() {
    if (thinking || rows.length === 0) return;
    setNotice('');
    try {
      const id = await newConversation();
      setConversationId(id);
      setRows([]);
    } catch (e: any) {
      setNotice(e?.message ?? 'Could not start a new chat.');
    }
  }

  const empty = rows.length === 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colours.bg }} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colours.border }}>
          <Image source={tali.head} style={{ width: 36, height: 36 }} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: colours.text }}>Tali</Text>
            <Text style={{ fontSize: 12, color: colours.muted }}>{thinking ? 'Thinking...' : 'Your AI teammate'}</Text>
          </View>
          {!empty ? (
            <Pressable onPress={startNew} accessibilityRole="button" style={{ borderWidth: 1, borderColor: colours.borderStrong, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 12 }}>
              <Text style={{ fontWeight: '700', fontSize: 13, color: colours.text }}>New chat</Text>
            </Pressable>
          ) : null}
        </View>

        {empty ? (
          <View style={{ flex: 1, padding: space.lg, justifyContent: 'center', maxWidth: 640, width: '100%', alignSelf: 'center' }}>
            <Image source={tali.wave} style={{ width: 90, height: 170, alignSelf: 'center' }} resizeMode="contain" />
            <Text style={{ fontSize: 18, fontWeight: '700', color: colours.text, textAlign: 'center', marginTop: space.md }}>
              Hey {profile?.first_name || 'there'}, what are we working on?
            </Text>
            <Text style={{ fontSize: 14, color: colours.muted, textAlign: 'center', marginTop: 6, lineHeight: 20 }}>
              I remember what you tell me, so the more you share, the more useful I get.
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'center', marginTop: space.lg }}>
              {STARTERS.map((s) => (
                <Pressable key={s} onPress={() => send(s)} style={{ borderWidth: 1, borderColor: colours.borderStrong, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: colours.surface }}>
                  <Text style={{ color: colours.text, fontWeight: '600', fontSize: 13 }}>{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={rows}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: space.lg, gap: space.sm, maxWidth: 680, width: '100%', alignSelf: 'center' }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item }) => {
              const me = item.role === 'user';
              return (
                <View
                  style={{
                    alignSelf: me ? 'flex-end' : 'flex-start',
                    maxWidth: '86%',
                    backgroundColor: me ? colours.text : colours.surface,
                    borderWidth: me ? 0 : 1,
                    borderColor: colours.border,
                    borderRadius: 18,
                    borderBottomRightRadius: me ? 6 : 18,
                    borderBottomLeftRadius: me ? 18 : 6,
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    opacity: item.pending ? 0.7 : 1,
                  }}>
                  <Text style={{ color: me ? '#FFFFFF' : colours.text, fontSize: 15, lineHeight: 22 }}>{item.content}</Text>
                  {item.failed ? <Text style={{ color: '#FFB4A8', fontSize: 12, marginTop: 4 }}>Not sent</Text> : null}
                </View>
              );
            }}
            ListFooterComponent={thinking ? <Text style={{ color: colours.muted, fontStyle: 'italic', marginTop: space.sm }}>Tali is thinking...</Text> : null}
          />
        )}

        {notice ? <Text style={{ color: colours.muted, fontSize: 13, textAlign: 'center', paddingHorizontal: space.lg, paddingBottom: 6 }}>{notice}</Text> : null}

        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, padding: space.md, borderTopWidth: 1, borderTopColor: colours.border, backgroundColor: colours.surface }}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Message Tali"
            placeholderTextColor={colours.faint}
            multiline
            maxLength={2000}
            style={{ flex: 1, maxHeight: 140, minHeight: 44, borderWidth: 1, borderColor: colours.borderStrong, borderRadius: 22, paddingHorizontal: 14, paddingTop: 11, paddingBottom: 11, fontSize: 16, color: colours.text, backgroundColor: colours.bg }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send"
            onPress={() => send()}
            disabled={thinking || !text.trim()}
            style={{ height: 44, paddingHorizontal: 18, borderRadius: 22, backgroundColor: colours.purple, alignItems: 'center', justifyContent: 'center', opacity: thinking || !text.trim() ? 0.5 : 1 }}>
            <Text style={{ color: colours.onPurple, fontWeight: '700', fontSize: 15 }}>Send</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
