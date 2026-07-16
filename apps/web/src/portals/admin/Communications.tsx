import { useState } from 'react';
import { Send } from 'lucide-react';
import type { DashboardData } from '@compass/shared';
import { Avatar, Button } from '../../components/ui';
import { useMessage } from '../../hooks/useCompass';
import { useSession } from '../../lib/session';
import { fmtTime, roomName, SectionHead } from './common';

export function CommunicationsTab({ data }: { data: DashboardData }) {
  const user = useSession(state => state.user)!;
  const send = useMessage();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const conversations = data.children.filter(child => child.guardianIds.length || data.messages.some(item => item.childId === child.id));
  const activeChild = conversations.find(child => child.id === conversationId) ?? conversations[0];
  const thread = activeChild ? data.messages.filter(item => item.childId === activeChild.id) : [];
  const unreadFor = (childId: string) => data.messages.filter(item => item.childId === childId && item.senderId !== user.id && !item.readBy.includes(user.id)).length;

  return <>
    <SectionHead title="Communications" subtitle="Direct, documented messaging with every enrolled family."/>
    <section className="messages-page panel">
      <aside>
        <p className="eyebrow">Family inbox</p><h2>Conversations</h2>
        {conversations.map(child => { const last = data.messages.filter(item => item.childId === child.id).at(-1); const unread = unreadFor(child.id); return <button key={child.id} className={child.id === activeChild?.id ? 'active' : ''} onClick={() => setConversationId(child.id)}>
          <Avatar label={`${child.firstName} ${child.lastName}`} tone={child.avatar}/>
          <span><b>{child.firstName}’s family</b><small>{last ? last.body : 'Start the conversation'}</small></span>
          {unread ? <i>{unread}</i> : null}
        </button>; })}
        {!conversations.length ? <p className="empty-note">No family conversations yet.</p> : null}
      </aside>
      {activeChild ? <main>
        <header><Avatar label={`${activeChild.firstName} ${activeChild.lastName}`} tone={activeChild.avatar}/><div><b>{activeChild.firstName}’s family</b><small>{roomName(data, activeChild.classroomId)} · Parents & guardians of {activeChild.firstName}</small></div></header>
        <div className="chat-thread">{thread.map(item => <div key={item.id} className={item.senderId === user.id ? 'mine' : ''}><span>{item.body}</span><time>{fmtTime(item.createdAt)}</time></div>)}{!thread.length ? <p className="empty-note">No messages yet — say hello!</p> : null}</div>
        <form onSubmit={async event => { event.preventDefault(); if (!message.trim()) return; await send.mutateAsync({ childId: activeChild.id, body: message }); setMessage(''); }}>
          <input value={message} onChange={event => setMessage(event.target.value)} placeholder={`Message ${activeChild.firstName}’s family…`}/>
          <Button className="button-primary" disabled={!message.trim() || send.isPending}><Send/></Button>
        </form>
      </main> : null}
    </section>
  </>;
}
