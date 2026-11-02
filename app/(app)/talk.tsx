import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Image, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { currentConversation, messages as loadMessages, myCredits, newConversation, sendMessage, type Message } from '@/lib/data';
import { isPro } from '@/lib/plan';
import { VOICE_LIVE, VoiceButton } from '@/components/VoiceButton';
import { TaliThinking } from '@/components/TaliThinking';
import { TaliAvatar } from '@/components/TaliAvatar';
import { useAuth } from '@/lib/auth';
import { tali } from '@/components/ui';
import { colours, elevation, NO_BOTTOM, radius, space } from '@/constants/theme';

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
  const [pro, setPro] = useState(false);
  const listRef = useRef<FlatList<Row>>(null);
  const inputRef = useRef<TextInput>(null);
  // Share to Tali (2 Nov 2026): the PWA is a share target, so a text, DM screenshot caption or link
  // shared from another app lands here as ?text=&title=&url=. It goes into the composer for the
  // user to add a word to and send; nothing is sent on its own.
  const params = useLocalSearchParams<{ text?: string; title?: string; url?: string }>();
  useEffect(() => {
    const shared = [params.title, params.text, params.url].map((v) => (Array.isArray(v) ? v[0] : v)).filter((v) => v && String(v).trim());
    if (!shared.length) return;
    const unique = Array.from(new Set(shared.map(String)));
    setText(`Someone sent me this. What should I do with it?\n\n${unique.join('\n')}`);
    setNotice('Shared with Tali. Add a word if you like, then send.');
    setTimeout(() => inputRef.current?.focus(), 300);
    // Clear the params so a refresh does not re-fill the box.
    router.setParams({ text: undefined, title: undefined, url: undefined } as any);
  }, [params.text, params.title, params.url]);

  const load = useCallback(async () => {
    try {
      const id = await currentConversation();
      setConversationId(id);
      setRows(await loadMessages(id));
      myCredits().then((c) => setPro(isPro(c))).catch(() => {});
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
      if (res.remindersSet) bits.push(res.remindersSet === 1 ? 'reminder set' : `${res.remindersSet} reminders set`);
      if (res.invoicesDrafted) bits.push('invoice drafted on your Invoices screen');
      if (res.foodLogged) bits.push(res.foodLogged === 1 ? 'food logged' : `${res.foodLogged} foods logged`);
      if (res.weightLogged) bits.push('weight logged');
      if (res.workoutsLogged) bits.push('workout logged');
      if (res.planSaved) bits.push('training plan saved');
      if (res.searched) bits.push(res.searched === 1 ? 'searched the web once' : `searched the web ${res.searched} times`);
      if (res.clientsSaved) bits.push(res.clientsSaved === 1 ? 'client list updated' : `${res.clientsSaved} clients updated`);
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colours.bg }} edges={NO_BOTTOM}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colours.border }}>
          <TaliAvatar pose={thinking ? 'head_think' : 'head'} size={36} />
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
            <TaliAvatar pose="wave" size={100} style={{ alignSelf: 'center' }} />
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
                    borderColor: 'rgba(39,38,38,0.04)',
                    borderRadius: 18,
                    borderBottomRightRadius: me ? 6 : 18,
                    borderBottomLeftRadius: me ? 18 : 6,
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    opacity: item.pending ? 0.7 : 1,
                    ...(me ? null : elevation.card),
                  }}>
                  <Text style={{ color: me ? '#FFFFFF' : colours.text, fontSize: 15, lineHeight: 22 }}>{item.content}</Text>
                  {item.failed ? <Text style={{ color: '#FFB4A8', fontSize: 12, marginTop: 4 }}>Not sent</Text> : null}
                  {VOICE_LIVE && pro && !me && !item.id.startsWith('tmp-') ? <VoiceButton messageId={item.id} onError={setNotice} /> : null}
                </View>
              );
            }}
            ListFooterComponent={thinking ? <TaliThinking /> : null}
          />
        )}

        {notice ? <Text style={{ color: colours.muted, fontSize: 13, textAlign: 'center', paddingHorizontal: space.lg, paddingBottom: 6 }}>{notice}</Text> : null}

        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, padding: space.md, borderTopWidth: 1, borderTopColor: colours.border, backgroundColor: colours.surface }}>
          <TextInput
            ref={inputRef}
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
            style={{ height: 44, paddingHorizontal: 18, borderRadius: 22, backgroundColor: colours.purple, alignItems: 'center', justifyContent: 'center', opacity: thinking || !text.trim() ? 0.5 : 1, ...elevation.button(colours.purple) }}>
            <Text style={{ color: colours.onPurple, fontWeight: '700', fontSize: 15 }}>Send</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
