// isConversationUnread is pure, but its module imports the Firestore SDK at
// load time for the sibling write helper. Stub both so the unit under test can
// be exercised without pulling in untransformed ESM or a live Firebase app.
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  setDoc: jest.fn(),
  serverTimestamp: jest.fn(),
}));
jest.mock('@/firebaseConfig', () => ({ db: {} }));

import { isConversationUnread, type ConversationReadState } from '@/lib/conversations';

/** Firestore Timestamp stand-in — only toMillis() is ever read. */
const at = (ms: number) => ({ toMillis: () => ms });

const ME = 'me-uid';
const THEM = 'them-uid';

describe('isConversationUnread', () => {
  it('is unread when the other party wrote after I last opened it', () => {
    const convo: ConversationReadState = {
      lastSenderId: THEM,
      lastMessageAt: at(2_000),
      reads: { [ME]: at(1_000) },
    };
    expect(isConversationUnread(convo, ME)).toBe(true);
  });

  it('is read once I have opened it since their message', () => {
    const convo: ConversationReadState = {
      lastSenderId: THEM,
      lastMessageAt: at(1_000),
      reads: { [ME]: at(2_000) },
    };
    expect(isConversationUnread(convo, ME)).toBe(false);
  });

  it('never marks my own message as unread to me', () => {
    // Otherwise every thread you replied to would show a badge to you.
    const convo: ConversationReadState = {
      lastSenderId: ME,
      lastMessageAt: at(5_000),
      reads: { [ME]: at(1_000) },
    };
    expect(isConversationUnread(convo, ME)).toBe(false);
  });

  it('treats a never-opened thread with an incoming message as unread', () => {
    const convo: ConversationReadState = {
      lastSenderId: THEM,
      lastMessageAt: at(1_000),
    };
    expect(isConversationUnread(convo, ME)).toBe(true);
  });

  it('is read when there is no message at all', () => {
    expect(isConversationUnread({}, ME)).toBe(false);
    expect(isConversationUnread({ reads: { [ME]: at(1) } }, ME)).toBe(false);
  });

  it('does not treat another user’s read stamp as mine', () => {
    // The reads map is keyed by uid; reading someone else's entry would hide
    // genuinely unread threads.
    const convo: ConversationReadState = {
      lastSenderId: THEM,
      lastMessageAt: at(2_000),
      reads: { [THEM]: at(3_000) },
    };
    expect(isConversationUnread(convo, ME)).toBe(true);
  });

  it('survives a message whose timestamp has not been written yet', () => {
    // serverTimestamp() reads back as null on the writer's local snapshot
    // before the round trip completes.
    const convo: ConversationReadState = {
      lastSenderId: THEM,
      lastMessageAt: null,
      reads: { [ME]: at(1_000) },
    };
    expect(isConversationUnread(convo, ME)).toBe(false);
  });

  it('handles a stamp object missing toMillis entirely', () => {
    const convo = {
      lastSenderId: THEM,
      lastMessageAt: {} as never,
      reads: { [ME]: {} as never },
    };
    expect(isConversationUnread(convo, ME)).toBe(false);
  });

  it('is not unread when the two stamps are identical', () => {
    const convo: ConversationReadState = {
      lastSenderId: THEM,
      lastMessageAt: at(1_000),
      reads: { [ME]: at(1_000) },
    };
    expect(isConversationUnread(convo, ME)).toBe(false);
  });
});
