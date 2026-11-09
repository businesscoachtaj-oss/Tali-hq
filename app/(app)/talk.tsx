import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Image, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { currentConversation, deleteConversation, freeMessagesLeft, listConversations, makeImage, messages as loadMessages, myCredits, newConversation, pinConversation, renameConversation, sendMessage, type Attachment, type Credits, type DeepLevel, type ConversationRow, type Message, MAX_ATTACHMENTS, uploadAttachment } from '@/lib/data';
import { isPaid, isPro } from '@/lib/plan';
import { VOICE_LIVE, VoiceButton } from '@/components/VoiceButton';
import { MicButton } from '@/components/MicButton';
import { COST } from '@/lib/brainAiPlan';
import { useCapabilities } from '@/lib/capabilities';
import { useVoiceNote, voiceMinutesLeftLine, VOICE_NOTES_ON } from '@/lib/voiceNotes';
import { TaliThinking } from '@/components/TaliThinking';
import { TaliAvatar } from '@/components/TaliAvatar';
import { TaliMessage } from '@/components/TaliMessage';
import { isStaleImage, TaliImage } from '@/components/TaliImage';
import { useAuth } from '@/lib/auth';
import { pickFiles, type PickedFile } from '@/lib/pickFiles';
import { tali } from '@/components/ui';
import { colours, elevation, NO_BOTTOM, radius, space } from '@/constants/theme';
import { NightBackground } from '@/components/NightSky';
import { Aurora } from '@/components/Aurora';

// An image Tali made (it carries her prompt, or is still a placeholder with no file yet).
const isTaliMade = (me: boolean, a: Attachment) => !me && a.kind === 'image' && (!!a.prompt || !a.path);

// A failed row keeps its files so "Try again" can resend the same message.
type Row = Message & { pending?: boolean; failed?: boolean; files?: Attachment[] };

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
  const rowsRef = useRef<Row[]>([]);
  rowsRef.current = rows;
  const [text, setText] = useState('');
  const [thinking, setThinking] = useState(false);
  const [notice, setNotice] = useState('');
  // 6 Nov 2026 (Taj): out of credits shows a Top up button under the notice.
  const [outOfCredits, setOutOfCredits] = useState(false);
  const [pro, setPro] = useState(false);
  const [plan, setPlan] = useState<'free' | 'hq' | 'pro' | null>(null);
  // Deep think (6 Nov 2026): the next message goes to a smarter model with more of her brain.
  const [deep, setDeep] = useState<DeepLevel | null>(null);
  const [deepSending, setDeepSending] = useState<DeepLevel | null>(null);
  // Second opinion (planned, 9 Nov 2026): GPT-5.4 checks her answer. 20 credits.
  const [second, setSecond] = useState(false);
  const caps = useCapabilities();
  const [freeDeep, setFreeDeep] = useState<Credits['deep']>(null);
  // 7 Nov 2026 (Taj): Free sees how many messages are left once it gets low (25 or fewer).
  const [freeLeft, setFreeLeft] = useState<{ left: number; limit: number } | null>(null);
  // 4 Nov 2026: the starter screen waited on nothing, so it flashed before the history arrived.
  const [loaded, setLoaded] = useState(false);
  // Voice notes (3 Nov 2026): the mic in the composer. Tap to record, tap to stop, the words land in the box.
  const onVoiceText = useCallback((t: string) => setText((cur) => (cur.trim() ? `${cur.trim()} ${t}` : t)), []);
  const voice = useVoiceNote({ onText: onVoiceText, onNotice: setNotice, plan });
  const voiceLine = !VOICE_NOTES_ON ? null : voice.recording ? 'Recording. Tap the red dot to stop, 3 minutes tops.' : voice.busy ? null : voiceMinutesLeftLine(voice.secondsLeft);
  const messagesLine = freeLeft && freeLeft.left <= 25 ? (freeLeft.left === 1 ? `1 of ${freeLeft.limit} messages left this month.` : `${freeLeft.left} of ${freeLeft.limit} messages left this month.`) : null;
  const voiceHint = voiceLine ?? messagesLine;
  // Chat history (3 Nov 2026): the sheet with every chat; open, rename, pin, delete.
  const [historyOpen, setHistoryOpen] = useState(false);
  // Photos and files (3 Nov 2026): what is attached to the message being written, already uploaded.
  const [pending, setPending] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Images Tali is drawing right now (6 Nov 2026), keyed "<message id>:<index>".
  const [drawing, setDrawing] = useState<Set<string>>(new Set());

  async function drawImage(messageId: string, index: number) {
    const key = `${messageId}:${index}`;
    setDrawing((d) => new Set(d).add(key));
    setRows((r) => r.map((m) => (m.id === messageId && m.attachments ? { ...m, attachments: m.attachments.map((a, i) => (i === index ? { ...a, making: true, failed: null } : a)) } : m)));
    const res = await makeImage(messageId, index);
    setDrawing((d) => { const n = new Set(d); n.delete(key); return n; });
    setRows((r) => r.map((m) => (m.id === messageId && m.attachments
      ? { ...m, attachments: m.attachments.map((a, i) => (i !== index ? a : res.ok ? res.attachment : { ...a, making: false, failed: res.message })) }
      : m)));
    if (res.ok && typeof res.remaining === 'number') setNotice(res.remaining === 1 ? 'Image done. 1 image left this month.' : `Image done. ${res.remaining} images left this month.`);
  }

  async function attach(source: 'photo' | 'camera' | 'file' | 'video') {
    setPickerOpen(false);
    if (!conversationId || uploading) return;
    const room = MAX_ATTACHMENTS - pending.length;
    if (room <= 0) { setNotice(`Up to ${MAX_ATTACHMENTS} files a message.`); return; }
    let files: PickedFile[] = [];
    try {
      files = await pickFiles(source, room);
    } catch (e: any) {
      setNotice(e?.message ?? 'Could not open that.');
      return;
    }
    if (!files.length) return;
    setUploading(true);
    setNotice('');
    for (const f of files) {
      try {
        const a = await uploadAttachment(conversationId, f);
        setPending((p) => [...p, { ...a, url: f.previewUrl }]);
      } catch (e: any) {
        setNotice(e?.message ?? `Could not upload ${f.name}.`);
      }
    }
    setUploading(false);
  }
  const listRef = useRef<FlatList<Row>>(null);
  // FIX (6 Nov 2026, Taj): when Tali's reply lands, show it from its first line, so a long reply is
  // read from the top instead of the list jumping to (or stopping short of) the bottom. Cleared as
  // soon as they scroll themselves or send again.
  const pinReply = useRef<string | null>(null);
  function settleList() {
    const list = listRef.current;
    if (!list) return;
    const id = pinReply.current;
    const index = id ? rowsRef.current.findIndex((m) => m.id === id) : -1;
    if (index >= 0) list.scrollToIndex({ index, viewPosition: 0, viewOffset: 8, animated: true });
    else list.scrollToEnd({ animated: true });
  }
  const inputRef = useRef<TextInput>(null);
  // Share to Tali (2 Nov 2026): the PWA is a share target, so a text, DM screenshot caption or link
  // shared from another app lands here as ?text=&title=&url=. It goes into the composer for the
  // user to add a word to and send; nothing is sent on its own.
  const params = useLocalSearchParams<{ text?: string; title?: string; url?: string; ask?: string; chat?: string }>();
  // Ask Tali (3 Nov 2026): other screens open Talk with a ready question in the box.
  useEffect(() => {
    const ask = Array.isArray(params.ask) ? params.ask[0] : params.ask;
    if (!ask || !String(ask).trim()) return;
    setText(String(ask));
    setTimeout(() => inputRef.current?.focus(), 300);
    router.setParams({ ask: undefined } as any);
  }, [params.ask]);
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

  const loadPlan = useCallback(() => {
    myCredits().then((c) => { setPro(isPro(c)); setPlan(isPro(c) ? 'pro' : isPaid(c) ? 'hq' : 'free'); setFreeDeep(c?.deep ?? null); setFreeLeft(isPaid(c) ? null : freeMessagesLeft(c)); }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try {
      const id = await currentConversation();
      if (chatAsked.current) return; // "Go to the chat" got there first
      setConversationId(id);
      setRows(await loadMessages(id));
      loadPlan();
    } catch (e: any) {
      setNotice(e?.message ?? 'Could not load the chat.');
    } finally {
      setLoaded(true);
    }
  }, [loadPlan]);

  useEffect(() => {
    load();
  }, [load]);

  // Visual memories (6 Nov 2026): "Go to the chat" opens Talk on the chat an image came from.
  const chatAsked = useRef(false);
  useEffect(() => {
    const wanted = Array.isArray(params.chat) ? params.chat[0] : params.chat;
    if (!wanted || !/^[0-9a-f-]{36}$/i.test(String(wanted))) return;
    chatAsked.current = true;
    router.setParams({ chat: undefined } as any);
    (async () => {
      try {
        setConversationId(String(wanted));
        setRows(await loadMessages(String(wanted)));
      } catch (e: any) {
        setNotice(e?.message ?? 'Could not open that chat.');
      } finally {
        setLoaded(true);
      }
    })();
  }, [params.chat]);

  // 4 Nov 2026: re-check the plan each time Talk comes into view, so an upgrade on Plans shows here straight away.
  useFocusEffect(useCallback(() => { loadPlan(); }, [loadPlan]));

  // 4 Nov 2026: a failed send puts the words (and files) back in the composer, and the failed bubble
  // offers "Try again". retryOf is the failed row being resent, so it is replaced rather than doubled.
  async function send(raw?: string, rawFiles?: Attachment[], retryOf?: string, deepOverride?: DeepLevel | null) {
    const direct = raw !== undefined;
    const body = (raw ?? text).trim();
    const files = direct ? rawFiles ?? [] : pending;
    if ((!body && !files.length) || !conversationId || thinking || uploading) return;
    // A retry leaves the composer alone (the tap handler clears it only if it still holds the failed words).
    if (!direct) { setText(''); setPending([]); }
    pinReply.current = null;
    setNotice('');
    const temp: Row = { id: `tmp-${Date.now()}`, role: 'user', content: body, created_at: new Date().toISOString(), pending: true, attachments: files, files };
    setRows((r) => [...r.filter((m) => m.id !== retryOf), temp]);
    const level = deepOverride !== undefined ? deepOverride : deep;
    setDeep(null);
    setDeepSending(level);
    setThinking(true);
    const wantSecond = second && caps.second_opinion;
    setSecond(false);
    const res = await sendMessage(conversationId, body, files, level, wantSecond);
    setThinking(false);
    setDeepSending(null);
    if (level || wantSecond || files.some((f) => f.kind === 'video')) loadPlan();
    if (res.ok) {
      setOutOfCredits(false);
      setFreeLeft((f) => (f ? { ...f, left: Math.max(f.left - 1, 0) } : f));
      const fresh = await loadMessages(conversationId);
      const reply = [...fresh].reverse().find((m) => m.role !== 'user');
      pinReply.current = reply ? reply.id : null;
      setRows(fresh);
      if (res.image) void drawImage(res.image.messageId, res.image.index);
      const bits: string[] = [];
      if (res.drafted) bits.push(res.drafted === 1 ? 'Draft waiting on Today' : `${res.drafted} drafts waiting on Today`);
      if (res.remindersSet) bits.push(res.remindersSet === 1 ? 'reminder set' : `${res.remindersSet} reminders set`);
      if (res.invoicesDrafted) bits.push('invoice drafted on your Invoices screen');
      if (res.foodLogged) bits.push(res.foodLogged === 1 ? 'food logged' : `${res.foodLogged} foods logged`);
      if (res.weightLogged) bits.push('weight logged');
      if (res.workoutsLogged) bits.push('workout logged');
      if (res.planSaved) bits.push('programme saved');
      if (res.searched) bits.push(res.searched === 1 ? 'searched the web once' : `searched the web ${res.searched} times`);
      if (res.clientsSaved) bits.push(res.clientsSaved === 1 ? 'client list updated' : `${res.clientsSaved} clients updated`);
      if (res.goalsSaved) bits.push(res.goalsSaved === 1 ? 'goal updated' : `${res.goalsSaved} goals updated`);
      if (res.decisionsLogged) bits.push(res.decisionsLogged === 1 ? 'decision logged' : `${res.decisionsLogged} decisions logged`);
      if (res.remembered > 0) bits.push(res.remembered === 1 ? 'saved 1 thing to remember' : `saved ${res.remembered} things to remember`);
      if (bits.length) setNotice(bits.join(', ').replace(/^./, (c) => c.toUpperCase()) + '.');
    } else {
      setRows((r) => r.map((m) => (m.id === temp.id ? { ...m, pending: false, failed: true } : m)));
      // Put it all back so nothing typed is lost.
      if (!direct) setText((cur) => (cur.trim() ? cur : body));
      if (!direct && files.length) setPending(files);
      setNotice(res.message);
      setOutOfCredits(res.code === 'out_of_credits');
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

  async function openChat(id: string) {
    setHistoryOpen(false);
    if (id === conversationId) return;
    setNotice('');
    try {
      setConversationId(id);
      setRows(await loadMessages(id));
    } catch (e: any) {
      setNotice(e?.message ?? 'Could not open that chat.');
    }
  }

  async function chatDeleted(id: string) {
    if (id !== conversationId) return;
    // The open chat went: fall back to the latest one, or a fresh one.
    const next = await currentConversation();
    setConversationId(next);
    setRows(await loadMessages(next));
  }

  const empty = rows.length === 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colours.bg }} edges={NO_BOTTOM}>
      <NightBackground />
      <Aurora />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colours.border }}>
          <TaliAvatar pose={thinking ? 'head_think' : 'head'} size={48} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 28, color: colours.text, fontFamily: 'InstrumentSerif_400Regular' }}>Tali</Text>
            <Text style={{ fontSize: 12, fontWeight: '700', color: thinking ? '#FFB04D' : '#8EF0C8' }}>{'●'} {thinking ? 'Thinking' : 'Listening'}</Text>
          </View>
          <Pressable onPress={() => setHistoryOpen(true)} accessibilityRole="button" accessibilityLabel="Your chats" style={{ borderWidth: 0, borderColor: colours.borderStrong, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 12 }}>
            <Text style={{ fontWeight: '700', fontSize: 15, color: colours.purple }}>Chats</Text>
          </Pressable>
          {!empty ? (
            <Pressable onPress={startNew} accessibilityRole="button" style={{ borderWidth: 0, borderColor: colours.borderStrong, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 12 }}>
              <Text style={{ fontWeight: '700', fontSize: 15, color: colours.purple }}>New</Text>
            </Pressable>
          ) : null}
        </View>

        <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(20,16,30,0.45)' }} onPress={() => setPickerOpen(false)} accessibilityLabel="Close" />
          <View style={{ backgroundColor: colours.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: space.lg, paddingBottom: 36, gap: space.sm }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: colours.text, marginBottom: 4 }}>Send Tali something</Text>
            {([['photo', 'Choose a photo'], ['camera', 'Take a photo'], ['file', 'Pick a PDF or file']] as const).map(([k, label]) => (
              <Pressable key={k} onPress={() => attach(k)} accessibilityRole="button" style={{ backgroundColor: colours.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(39,38,38,0.04)', ...elevation.card }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colours.text }}>{label}</Text>
              </Pressable>
            ))}
            {caps.video && plan && plan !== 'free' ? (
              <Pressable onPress={() => attach('video')} accessibilityRole="button" style={{ backgroundColor: colours.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(39,38,38,0.04)', ...elevation.card, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: colours.text }}>Send a video</Text>
                  <Text style={{ fontSize: 12.5, color: colours.muted, marginTop: 2 }}>A screen recording, an ad, a walkthrough. Up to 10 minutes.</Text>
                </View>
                <View style={{ backgroundColor: colours.purpleSoft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ color: colours.purpleInk, fontSize: 12, fontWeight: '800' }}>{COST.videoPerMinute} credits a min</Text>
                </View>
              </Pressable>
            ) : null}
            <Text style={{ fontSize: 12, color: colours.muted, marginTop: 4 }}>Photos and PDFs, up to {MAX_ATTACHMENTS} a message, 10 MB each. One extra credit per message with files.{caps.video && plan && plan !== 'free' ? ' Videos up to 10 minutes and 200 MB.' : ''}</Text>
          </View>
        </Modal>

        <ChatHistory
          visible={historyOpen}
          currentId={conversationId}
          onClose={() => setHistoryOpen(false)}
          onOpen={openChat}
          onNew={() => { setHistoryOpen(false); void startNew(); }}
          onDeleted={chatDeleted}
        />

        {!loaded ? (
          <View style={{ flex: 1 }} />
        ) : empty ? (
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
                <Pressable key={s} accessibilityRole="button" onPress={() => { setText(s); setTimeout(() => inputRef.current?.focus(), 50); }} style={{ borderWidth: 1, borderColor: colours.borderStrong, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: colours.surface }}>
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
            contentContainerStyle={{ padding: space.lg, gap: space.md, maxWidth: 680, width: '100%', alignSelf: 'center' }}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={settleList}
            // The notice line under the list can shrink it after a reply; settle again when it does.
            onLayout={settleList}
            onScrollBeginDrag={() => { pinReply.current = null; }}
            onScrollToIndexFailed={({ index, averageItemLength }) => {
              listRef.current?.scrollToOffset({ offset: index * averageItemLength, animated: false });
              setTimeout(settleList, 120);
            }}
            renderItem={({ item }) => {
              const me = item.role === 'user';
              return (
                // 10 Nov 2026 look: you're talking to her inside her space. Her words sit in the sky with a
                // small glowing dot, no bubble. Yours glow violet.
                <View
                  style={me ? {
                    alignSelf: 'flex-end',
                    maxWidth: '84%',
                    backgroundColor: 'rgba(122,77,255,0.35)',
                    borderWidth: 1,
                    borderColor: 'rgba(200,180,255,0.6)',
                    borderRadius: 22,
                    paddingVertical: 11,
                    paddingHorizontal: 16,
                    opacity: item.pending ? 0.7 : 1,
                    shadowColor: '#7A4DFF', shadowOpacity: 0.7, shadowRadius: 18, shadowOffset: { width: 0, height: 0 },
                  } : { alignSelf: 'stretch', paddingLeft: 20, paddingVertical: 6 }}>
                  {!me ? <View style={{ position: 'absolute', left: 0, top: 15, width: 8, height: 8, borderRadius: 4, backgroundColor: '#D7CCFF', shadowColor: '#B9A6FF', shadowOpacity: 1, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } }} /> : null}
                  {item.attachments?.some((a) => !isTaliMade(me, a)) ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: item.content ? 8 : 0 }}>
                      {item.attachments.map((a, i) => isTaliMade(me, a) ? null : a.kind === 'video' ? (
                        <VideoTile key={i} a={a} me={me} />
                      ) : a.kind === 'image' ? (
                        <Pressable key={i} onPress={() => a.url && Linking.openURL(a.url)} accessibilityRole="imagebutton" accessibilityLabel={`Open ${a.name}`}>
                          <Image source={{ uri: a.url }} style={{ width: 150, height: 150, borderRadius: 12, backgroundColor: colours.sunk }} resizeMode="cover" />
                        </Pressable>
                      ) : (
                        <Pressable key={i} onPress={() => a.url && Linking.openURL(a.url)} accessibilityRole="button" accessibilityLabel={`Open ${a.name}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: me ? 'rgba(255,255,255,0.12)' : colours.sunk, borderRadius: 12, padding: 10, maxWidth: 220 }}>
                          <View style={{ width: 34, height: 40, borderRadius: 6, backgroundColor: colours.danger, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>PDF</Text></View>
                          <View style={{ flex: 1 }}>
                            <Text numberOfLines={1} style={{ color: me ? '#fff' : colours.text, fontSize: 13, fontWeight: '700' }}>{a.name}</Text>
                            {a.size ? <Text style={{ color: me ? 'rgba(255,255,255,0.7)' : colours.muted, fontSize: 11 }}>{Math.round(a.size / 1024)} KB</Text> : null}
                          </View>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                  {!me && item.meta?.watched ? (
                    <Text style={{ color: colours.purpleInk, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, marginBottom: 4 }}>WATCHED {fmtSecs(item.meta.watched.seconds)} OF VIDEO · {item.meta.watched.credits} CREDITS</Text>
                  ) : null}
                  {!me && item.meta?.deep ? (
                    <Text style={{ color: colours.purple, fontSize: 11, fontWeight: '800', letterSpacing: 2, marginBottom: 4 }}>{item.meta.deep === 'deepest' ? 'BIG BRAIN' : 'SHE THOUGHT HARDER'}</Text>
                  ) : null}
                  {item.content ? (me
                    ? <Text style={{ color: '#FFFFFF', fontSize: 15, lineHeight: 22 }}>{item.content}</Text>
                    : <TaliMessage content={item.content} />) : null}
                  {!me && item.meta?.sources?.length ? <Sources list={item.meta.sources} /> : null}
                  {!me && item.meta?.second_opinion ? <SecondOpinion o={item.meta.second_opinion} /> : null}
                  {/* Images Tali made sit under her words (6 Nov 2026). */}
                  {item.attachments?.map((a, i) => isTaliMade(me, a) ? (
                    <View key={`t${i}`} style={{ marginTop: item.content ? 10 : 0 }}>
                      <TaliImage a={a} drawing={drawing.has(`${item.id}:${i}`)} stale={isStaleImage(a, item.created_at)} onRetry={() => void drawImage(item.id, i)} />
                    </View>
                  ) : null)}
                  {/* When she keeps something from this reply, say so and say where in her brain it went. */}
                  {!me && item.meta?.kept ? (
                    <View style={{ marginTop: 10, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12, backgroundColor: keptColour(item.meta.kept.part) + '22', borderWidth: 1, borderColor: keptColour(item.meta.kept.part) + 'AA', shadowColor: keptColour(item.meta.kept.part), shadowOpacity: 0.8, shadowRadius: 14, shadowOffset: { width: 0, height: 0 } }}>
                      <Text style={{ color: keptColour(item.meta.kept.part), fontSize: 13 }}>{'✦'}</Text>
                      <Text style={{ color: '#FFFFFF', fontSize: 12.5, flexShrink: 1 }}><Text style={{ fontWeight: '800' }}>New memory</Text> {item.meta.kept.text} <Text style={{ color: keptColour(item.meta.kept.part), fontWeight: '700' }}>{'→'} {item.meta.kept.part}</Text></Text>
                    </View>
                  ) : null}
                  {item.failed ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Try sending again"
                      hitSlop={8}
                      disabled={thinking || uploading}
                      onPress={() => {
                        // The failed words were put back in the box; clear them only if they are still as they were.
                        if (text.trim() === (item.content ?? '').trim()) { setText(''); setPending([]); }
                        void send(item.content ?? '', item.files ?? item.attachments ?? [], item.id);
                      }}
                      style={{ marginTop: 4 }}>
                      <Text style={{ color: '#FFB4A8', fontSize: 12 }}>Not sent. <Text style={{ fontWeight: '800', textDecorationLine: 'underline' }}>Try again</Text></Text>
                    </Pressable>
                  ) : null}
                  {!me && item.meta?.suggest_deep && item.id === rows[rows.length - 1]?.id && !thinking ? (
                    <DeepOffer plan={plan} freeDeep={freeDeep} onPress={() => {
                      const asked = [...rows].reverse().find((m) => m.role === 'user' && !m.pending);
                      if (asked) void send(asked.content ?? '', [], undefined, 'deep');
                    }} />
                  ) : null}
                  {VOICE_LIVE && pro && !me && !item.id.startsWith('tmp-') ? <VoiceButton messageId={item.id} onError={setNotice} /> : null}
                  {!me && item.meta?.routed ? <RoutedLine routed={item.meta.routed} /> : null}
                </View>
              );
            }}
            ListFooterComponent={thinking ? <TaliThinking label={deepSending ? 'Having a proper think. About half a minute.' : undefined} /> : null}
          />
        )}

        {notice ? <Text style={{ color: colours.muted, fontSize: 13, textAlign: 'center', paddingHorizontal: space.lg, paddingBottom: 6 }}>{notice}</Text> : null}
        {notice && outOfCredits ? (
          <Pressable onPress={() => router.navigate('/top-up' as any)} accessibilityRole="button" style={{ alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 18, borderRadius: radius.pill, backgroundColor: colours.purple, marginBottom: 8 }}>
            <Text style={{ color: colours.onPurple, fontWeight: '800', fontSize: 14 }}>Top up</Text>
          </Pressable>
        ) : null}

        {pending.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingHorizontal: space.md, paddingTop: space.sm, backgroundColor: colours.surface, borderTopWidth: 1, borderTopColor: colours.border }}>
            {pending.map((a, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colours.sunk, borderRadius: 12, padding: 6, paddingRight: 8 }}>
                {a.kind === 'image' ? <Image source={{ uri: a.url }} style={{ width: 44, height: 44, borderRadius: 8 }} /> : <View style={{ width: 34, height: 44, borderRadius: 6, backgroundColor: colours.danger, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>PDF</Text></View>}
                <Text numberOfLines={1} style={{ maxWidth: 110, fontSize: 12, color: colours.text, fontWeight: '600' }}>{a.name}</Text>
                <Pressable onPress={() => setPending((p) => p.filter((_, j) => j !== i))} hitSlop={8} accessibilityLabel={`Remove ${a.name}`}><Text style={{ color: colours.muted, fontWeight: '800' }}>{'✕'}</Text></Pressable>
              </View>
            ))}
            <Text style={{ alignSelf: 'center', fontSize: 11, color: colours.faint }}>+1 credit for the files</Text>
          </View>
        ) : null}
        {voiceHint ? (
          <Text style={{ color: voice.recording ? colours.danger : colours.muted, fontSize: 12, textAlign: 'center', paddingHorizontal: space.lg, paddingTop: 6, backgroundColor: colours.surface, borderTopWidth: pending.length ? 0 : 1, borderTopColor: colours.border }}>{voiceHint}</Text>
        ) : null}
        <DeepSwitch plan={plan} freeDeep={freeDeep} value={deep} onChange={setDeep} second={second} onSecond={setSecond} canSecond={caps.second_opinion} topBorder={!pending.length && !voiceHint} />
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, padding: space.md, paddingTop: plan ? space.sm : space.md, borderTopWidth: 0, borderTopColor: colours.border, backgroundColor: colours.surface }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Attach a photo or file"
            onPress={() => (Platform.OS === 'web' && !(caps.video && plan && plan !== 'free') ? attach('file') : setPickerOpen(true))}
            disabled={uploading}
            style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colours.borderStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: colours.bg }}>
            <Text style={{ fontSize: 20, color: colours.muted }}>{uploading ? '…' : '+'}</Text>
          </Pressable>
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
          {VOICE_NOTES_ON ? <MicButton recording={voice.recording} busy={voice.busy} seconds={voice.seconds} onPress={voice.toggle} disabled={thinking || uploading} /> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send"
            onPress={() => send()}
            disabled={thinking || uploading || (!text.trim() && !pending.length)}
            style={{ height: 44, paddingHorizontal: 18, borderRadius: 22, backgroundColor: colours.purple, alignItems: 'center', justifyContent: 'center', opacity: thinking || uploading || (!text.trim() && !pending.length) ? 0.5 : 1, ...elevation.button(colours.purple) }}>
            <Text style={{ color: colours.onPurple, fontWeight: '700', fontSize: 15 }}>{deep ? 'Think' : 'Send'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// The history sheet: pinned chats first, then newest. Long press a chat for rename, pin and delete.
function ChatHistory({ visible, currentId, onClose, onOpen, onNew, onDeleted }: {
  visible: boolean; currentId: string | null; onClose: () => void; onOpen: (id: string) => void; onNew: () => void; onDeleted: (id: string) => void;
}) {
  const [chats, setChats] = useState<ConversationRow[]>([]);
  const [error, setError] = useState('');
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setChats(await listConversations());
      setError('');
    } catch (e: any) {
      setError(e?.message ?? 'Could not load your chats.');
    }
  }, []);

  useEffect(() => {
    if (visible) { setMenuFor(null); setRenaming(null); setConfirmDelete(null); void refresh(); }
  }, [visible, refresh]);

  async function saveRename(id: string) {
    const title = draft.trim();
    setRenaming(null);
    if (!title) return;
    setChats((c) => c.map((x) => (x.id === id ? { ...x, title } : x)));
    try { await renameConversation(id, title); } catch (e: any) { setError(e?.message ?? 'Could not rename.'); }
    void refresh();
  }

  async function togglePin(row: ConversationRow) {
    setMenuFor(null);
    setChats((c) => c.map((x) => (x.id === row.id ? { ...x, pinned: !row.pinned } : x)));
    try { await pinConversation(row.id, !row.pinned); } catch (e: any) { setError(e?.message ?? 'Could not pin.'); }
    void refresh();
  }

  async function remove(id: string) {
    setConfirmDelete(null); setMenuFor(null);
    setChats((c) => c.filter((x) => x.id !== id));
    try { await deleteConversation(id); await onDeleted(id); } catch (e: any) { setError(e?.message ?? 'Could not delete.'); }
    void refresh();
  }

  const when = (iso: string) => {
    const d = new Date(iso); const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
    const days = Math.round((now.setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
    if (days === 1) return 'Yesterday';
    if (days < 7) return d.toLocaleDateString('en-AU', { weekday: 'long' });
    return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  };

  const pinned = chats.filter((c) => c.pinned);
  const rest = chats.filter((c) => !c.pinned);
  const Section = ({ title, items }: { title: string; items: ConversationRow[] }) => items.length === 0 ? null : (
    <View style={{ marginBottom: space.md }}>
      <Text style={{ fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: colours.faint, fontWeight: '800', marginBottom: 6, marginLeft: 4 }}>{title}</Text>
      <View style={{ backgroundColor: colours.surface, borderRadius: radius.card, borderWidth: 1, borderColor: 'rgba(39,38,38,0.04)', overflow: 'hidden', ...elevation.card }}>
        {items.map((c, i) => {
          const open = c.id === currentId; const menu = menuFor === c.id;
          return (
            <View key={c.id} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: colours.border }}>
              <Pressable
                onPress={() => (menu ? setMenuFor(null) : onOpen(c.id))}
                onLongPress={() => { setMenuFor(menu ? null : c.id); setConfirmDelete(null); }}
                delayLongPress={350}
                accessibilityRole="button"
                style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 12, paddingHorizontal: space.md, backgroundColor: open ? colours.purpleSoft : 'transparent' }}>
                <View style={{ flex: 1 }}>
                  {renaming === c.id ? (
                    <TextInput
                      autoFocus
                      value={draft}
                      onChangeText={setDraft}
                      onSubmitEditing={() => saveRename(c.id)}
                      onBlur={() => saveRename(c.id)}
                      maxLength={80}
                      style={{ fontSize: 15, fontWeight: '700', color: colours.text, borderBottomWidth: 1, borderBottomColor: colours.purple, paddingVertical: 2 }}
                    />
                  ) : (
                    <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: colours.text }}>{c.pinned ? '📌 ' : ''}{c.title}</Text>
                  )}
                  <Text numberOfLines={1} style={{ fontSize: 13, color: colours.muted, marginTop: 2 }}>{c.last_message || 'No messages yet'}</Text>
                </View>
                <Text style={{ fontSize: 12, color: colours.faint }}>{when(c.updated_at)}</Text>
                <Pressable onPress={() => { setMenuFor(menu ? null : c.id); setConfirmDelete(null); }} hitSlop={10} accessibilityRole="button" accessibilityLabel="Chat options" style={{ paddingHorizontal: 4 }}>
                  <Text style={{ fontSize: 18, color: colours.muted, fontWeight: '800' }}>{'⋯'}</Text>
                </Pressable>
              </Pressable>
              {menu ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingHorizontal: space.md, paddingBottom: 12, backgroundColor: open ? colours.purpleSoft : 'transparent' }}>
                  {confirmDelete === c.id ? (
                    <>
                      <Text style={{ alignSelf: 'center', fontSize: 13, color: colours.text }}>Delete this chat for good?</Text>
                      <Chip label="Delete" danger onPress={() => remove(c.id)} />
                      <Chip label="Keep" onPress={() => setConfirmDelete(null)} />
                    </>
                  ) : (
                    <>
                      <Chip label="Rename" onPress={() => { setDraft(c.title); setRenaming(c.id); setMenuFor(null); }} />
                      <Chip label={c.pinned ? 'Unpin' : 'Pin'} onPress={() => togglePin(c)} />
                      <Chip label="Delete" danger onPress={() => setConfirmDelete(c.id)} />
                    </>
                  )}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(20,16,30,0.45)' }} onPress={onClose} accessibilityLabel="Close" />
      <View style={{ backgroundColor: colours.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '82%', paddingTop: 10 }}>
        <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colours.borderStrong, alignSelf: 'center', marginBottom: 8 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingBottom: space.sm }}>
          <Text style={{ flex: 1, fontSize: 20, fontWeight: '800', color: colours.text }}>Your chats</Text>
          <Pressable onPress={onNew} accessibilityRole="button" style={{ backgroundColor: colours.purple, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 14, ...elevation.button(colours.purple) }}>
            <Text style={{ color: colours.onPurple, fontWeight: '700', fontSize: 13 }}>New chat</Text>
          </Pressable>
        </View>
        <Text style={{ fontSize: 12, color: colours.muted, paddingHorizontal: space.lg, marginBottom: space.md }}>Tap to open. Hold a chat, or tap its dots, to rename, pin or delete it. Tali remembers you across all of them.</Text>
        {error ? <Text style={{ color: colours.danger, fontSize: 13, paddingHorizontal: space.lg, marginBottom: space.sm }}>{error}</Text> : null}
        <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {chats.length === 0 && !error ? <Text style={{ color: colours.muted, fontSize: 14, textAlign: 'center', paddingVertical: space.xl }}>No chats yet.</Text> : null}
          <Section title="Pinned" items={pinned} />
          <Section title={pinned.length ? 'Everything else' : 'Recent'} items={rest} />
        </ScrollView>
      </View>
    </Modal>
  );
}

function keptColour(part: string) {
  return ({ 'Your people': '#5CF2C0', 'Your life and work': '#7FA8FF', 'Plans and ideas': '#FFE066', 'How you like things': '#FF7EB6' } as Record<string, string>)[part] ?? '#B9A6FF';
}

function Chip({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={{ borderWidth: 1, borderColor: danger ? colours.danger : colours.borderStrong, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: colours.surface }}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: danger ? colours.danger : colours.text }}>{label}</Text>
    </Pressable>
  );
}

// Deep think (6 Nov 2026, asked for by Taj). Above the composer: a switch that sends the next message to a
// smarter model with more of her brain. Tali HQ: Deep (Sonnet, 20 credits). Pro adds Big brain (Opus, 40).
// Free gets 1 a month.
function deepCost(level: DeepLevel, plan: string | null, freeDeep: Credits['deep']) {
  if (plan === 'free') return freeDeep?.remaining ? 'your free one this month' : 'used for this month';
  return level === 'deepest' ? '40 credits' : '20 credits';
}

function DeepSwitch({ plan, freeDeep, value, onChange, second, onSecond, canSecond, topBorder }: { canSecond: boolean; plan: 'free' | 'hq' | 'pro' | null; freeDeep: Credits['deep']; value: DeepLevel | null; onChange: (v: DeepLevel | null) => void; second: boolean; onSecond: (v: boolean) => void; topBorder: boolean }) {
  // 9 Nov 2026 look refresh: one quiet line until you want more thinking. Costs only show once open.
  const [open, setOpen] = useState(false);
  if (!plan) return null;
  const freeOut = plan === 'free' && !freeDeep?.remaining;
  const options: DeepLevel[] = plan === 'pro' ? ['deep', 'deepest'] : ['deep'];
  if (!open && !value && !second) {
    return (
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" style={{ paddingHorizontal: space.lg, paddingTop: space.sm, backgroundColor: colours.surface, borderTopWidth: topBorder ? 1 : 0, borderTopColor: colours.border }}>
        <Text style={{ fontSize: 13, color: colours.muted }}>Quick answers  <Text style={{ color: colours.purple, fontWeight: '700' }}>Think harder {'›'}</Text></Text>
      </Pressable>
    );
  }
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, paddingHorizontal: space.md, paddingTop: space.sm, backgroundColor: colours.surface, borderTopWidth: topBorder ? 1 : 0, borderTopColor: colours.border }}>
      {options.map((o) => {
        const on = value === o;
        return (
          <Pressable key={o} accessibilityRole="switch" accessibilityState={{ checked: on, disabled: freeOut }} disabled={freeOut}
            onPress={() => onChange(on ? null : o)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: on ? colours.purple : colours.borderStrong, backgroundColor: on ? colours.purple : colours.bg, opacity: freeOut ? 0.5 : 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: on ? colours.onPurple : colours.text }}>{o === 'deepest' ? 'Big brain' : 'Deep think'}</Text>
            <Text style={{ fontSize: 12, color: on ? colours.onPurple : colours.muted }}>{deepCost(o, plan, freeDeep)}</Text>
          </Pressable>
        );
      })}
      {canSecond && plan !== 'free' ? (
        <Pressable accessibilityRole="switch" accessibilityState={{ checked: second }} onPress={() => onSecond(!second)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: second ? colours.purple : colours.borderStrong, backgroundColor: second ? colours.purple : colours.bg }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: second ? colours.onPurple : colours.text }}>Second opinion</Text>
          <Text style={{ fontSize: 12, color: second ? colours.onPurple : colours.muted }}>{COST.secondOpinion} credits</Text>
        </Pressable>
      ) : null}
      {second ? <Text style={{ fontSize: 11, color: colours.faint, flexBasis: '100%' }}>Tali answers, then a second AI checks her. You see where they agree and where they don't.</Text> : null}
      {value ? <Text style={{ fontSize: 11, color: colours.faint, flexBasis: '100%' }}>{value === 'deepest' ? 'Big brain: her strongest thinking, for the big calls. About a minute.' : 'A smarter Tali with more of her memory. About half a minute.'}</Text> : null}
    </View>
  );
}

function DeepOffer({ plan, freeDeep, onPress }: { plan: 'free' | 'hq' | 'pro' | null; freeDeep: Credits['deep']; onPress: () => void }) {
  if (!plan || (plan === 'free' && !freeDeep?.remaining)) return null;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={{ alignSelf: 'flex-start', marginTop: 10, paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colours.purpleSoft }}>
      <Text style={{ color: colours.purpleInk, fontWeight: '800', fontSize: 13 }}>Deep think this <Text style={{ fontWeight: '600' }}>({deepCost('deep', plan, freeDeep)})</Text></Text>
    </Pressable>
  );
}

// ---------- the extra AIs (10 Nov 2026): video, sources, second opinion ----------

const fmtSecs = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function VideoTile({ a, me }: { a: Attachment; me: boolean }) {
  const mins = Math.max(1, Math.ceil((a.seconds ?? 60) / 60));
  return (
    <View style={{ width: 220, borderRadius: 12, overflow: 'hidden', backgroundColor: me ? 'rgba(255,255,255,0.12)' : colours.sunk }}>
      <View style={{ height: 118, backgroundColor: '#1F1A2E', alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#1F1A2E', fontSize: 16, marginLeft: 3 }}>{'▶'}</Text>
        </View>
        <View style={{ position: 'absolute', right: 8, bottom: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{fmtSecs(a.seconds ?? 0)}</Text>
        </View>
      </View>
      <View style={{ padding: 8 }}>
        <Text numberOfLines={1} style={{ color: me ? '#fff' : colours.text, fontSize: 13, fontWeight: '700' }}>{a.name}</Text>
        <Text style={{ color: me ? 'rgba(255,255,255,0.75)' : colours.muted, fontSize: 11 }}>{mins * COST.videoPerMinute} credits to watch</Text>
      </View>
    </View>
  );
}

function Sources({ list }: { list: { title: string; url: string }[] }) {
  return (
    <View style={{ marginTop: 10, gap: 6 }}>
      <Text style={{ color: colours.faint, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.6 }}>SOURCES · LOOKED UP JUST NOW</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {list.map((s, i) => {
          let host = s.url;
          try { host = new URL(s.url).hostname.replace(/^www\./, ''); } catch {}
          return (
            <Pressable key={i} onPress={() => Linking.openURL(s.url)} accessibilityRole="link" accessibilityLabel={s.title}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colours.sunk, borderRadius: radius.pill, paddingVertical: 5, paddingLeft: 5, paddingRight: 10, maxWidth: 230 }}>
              <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: colours.purple, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{i + 1}</Text>
              </View>
              <Text numberOfLines={1} style={{ color: colours.text, fontSize: 12, fontWeight: '600', flexShrink: 1 }}>{host}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function SecondOpinion({ o }: { o: { by: string; agree: string; differ: string; credits: number } }) {
  return (
    <View style={{ marginTop: 12, borderRadius: 14, borderWidth: 1, borderColor: colours.border, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colours.purpleSoft }}>
        <Text style={{ flex: 1, color: colours.purpleInk, fontSize: 11, fontWeight: '800', letterSpacing: 0.6 }}>SECOND OPINION</Text>
        <Text style={{ color: colours.purpleInk, fontSize: 11, fontWeight: '700' }}>{o.credits} credits</Text>
      </View>
      <View style={{ padding: 12, gap: 10 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: colours.good, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}><Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{'✓'}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colours.text, fontSize: 13, fontWeight: '800' }}>Agrees</Text>
            <Text style={{ color: colours.muted, fontSize: 13, lineHeight: 19 }}>{o.agree}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: colours.orange, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}><Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>!</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colours.text, fontSize: 13, fontWeight: '800' }}>Would change</Text>
            <Text style={{ color: colours.muted, fontSize: 13, lineHeight: 19 }}>{o.differ}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// Founder only (the server sends routed to no one else): which part of her brain answered and what it cost.
function RoutedLine({ routed }: { routed: { part: string; ai: string; credits: number } }) {
  return <Text style={{ color: colours.faint, fontSize: 11, marginTop: 8 }}>{routed.part} · {routed.ai} · {routed.credits} {routed.credits === 1 ? 'credit' : 'credits'}</Text>;
}
