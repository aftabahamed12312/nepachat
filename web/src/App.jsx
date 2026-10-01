import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const API = import.meta.env.VITE_API_URL || '';
const call = async (path, token, method = 'GET', body) => {
  const r = await fetch(API + '/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: 'Bearer ' + token }) },
    body: body && JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || 'Request failed'), { data: d, status: r.status });
  return d;
};
const time = t => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const Avatar = ({ name, big }) => <div className={'avatar' + (big ? ' big' : '')}>{(name || '?')[0].toUpperCase()}</div>;

function Auth({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ username: '', email: '', password: '' });
  const [err, setErr] = useState(''), [notice, setNotice] = useState(''), [awaitingCode, setAwaitingCode] = useState(false), [code, setCode] = useState('');
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const go = async e => {
    e.preventDefault(); setErr(''); setNotice('');
    try {
      if (mode === 'login') onAuth(await call('/login', null, 'POST', { email: f.email, password: f.password }));
      else if (awaitingCode) onAuth(await call('/verify-email', null, 'POST', { email: f.email, code }));
      else {
        const d = await call('/register', null, 'POST', f);
        setAwaitingCode(true); setNotice(d.message); setCode('');
      }
    } catch (x) { setErr(x.message); }
  };
  const switchMode = () => { setMode(mode === 'login' ? 'register' : 'login'); setErr(''); setNotice(''); setAwaitingCode(false); setCode(''); };
  const resend = async () => {
    setErr(''); setNotice('');
    try { const d = await call('/register', null, 'POST', f); setNotice(d.message); }
    catch (x) { setErr(x.message); }
  };
  return (
    <div className="auth">
      <header className="top"><b>Nepa<span>Chat</span></b></header>
      <form className="card" onSubmit={go}>
        <h2>{mode === 'login' ? 'Welcome back' : awaitingCode ? 'Check your email' : 'Create your account'}</h2>
        {mode === 'register' && !awaitingCode && <label>Username<input value={f.username} onChange={set('username')} placeholder="sita_k" autoComplete="username" required /></label>}
        <label>{mode === 'login' ? 'Email or username' : 'Email address'}<input type={mode === 'login' ? 'text' : 'email'} value={f.email} onChange={set('email')} placeholder="you@example.com" autoComplete={mode === 'login' ? 'username' : 'email'} required /></label>
        {mode === 'register' && awaitingCode
          ? <label>6-digit verification code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} required /></label>
          : <label>Password<input type="password" value={f.password} onChange={set('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required /></label>}
        {err && <div className="err">{err}</div>}
        {notice && <div className="notice">{notice}</div>}
        <button className="btn">{mode === 'login' ? 'Sign in' : awaitingCode ? 'Verify and create account' : 'Send verification code'}</button>
        {mode === 'register' && awaitingCode && <button type="button" className="text-button" onClick={resend}>Send a new code</button>}
        <p className="sw">{mode === 'login' ? 'New here?' : 'Have an account?'} <a onClick={switchMode}>{mode === 'login' ? 'Create account' : 'Sign in'}</a></p>
      </form>
    </div>
  );
}

function CallPanel({ callState, localStream, remoteStream, onAccept, onDecline, onHangup }) {
  const localRef = useRef(), remoteRef = useRef();
  useEffect(() => { if (localRef.current) localRef.current.srcObject = localStream || null; }, [localStream]);
  useEffect(() => { if (remoteRef.current) remoteRef.current.srcObject = remoteStream || null; }, [remoteStream]);
  if (!callState) return null;
  const label = callState.incoming ? `Incoming ${callState.kind} call` : callState.status === 'calling' ? 'Calling…' : callState.status === 'active' ? 'Connected' : 'Connecting…';
  return (
    <div className="modal call-modal">
      <section className="call-panel" aria-label="Call">
        <header><div><b>{callState.peerName}</b><small>{label}</small></div></header>
        {callState.error && <p className="err">{callState.error}</p>}
        <div className={'call-stage' + (callState.kind === 'audio' ? ' audio-stage' : '')}>
          <video ref={remoteRef} autoPlay playsInline className="remote-video" />
          {callState.kind === 'audio' && <div className="audio-label">{callState.peerName}</div>}
          {callState.kind === 'video' && localStream && <video ref={localRef} autoPlay muted playsInline className="local-video" />}
        </div>
        <footer>
          {callState.incoming ? <>
            <button className="btn" onClick={onAccept}>Answer</button>
            <button className="btn danger" onClick={onDecline}>Decline</button>
          </> : <button className="btn danger" onClick={onHangup}>End call</button>}
        </footer>
      </section>
    </div>
  );
}

function NewChat({ token, onClose, onOpen, me }) {
  const [q, setQ] = useState(''), [hits, setHits] = useState([]), [msg, setMsg] = useState(null);
  useEffect(() => {
    const t = setTimeout(() => call('/users/search?q=' + encodeURIComponent(q), token).then(setHits).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [q]);
  const start = async to => {
    try { onOpen(await call('/chats', token, 'POST', { to })); onClose(); }
    catch (e) { setMsg(e.data?.invite ? { email: to } : { text: e.message }); }
  };
  const isMail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q.trim());
  return (
    <div className="modal" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <h3>New chat</h3>
        <input autoFocus value={q} onChange={e => { setQ(e.target.value); setMsg(null); }} placeholder="Email address or @username" onKeyDown={e => e.key === 'Enter' && q.trim() && start(q.trim())} />
        <div className="hits">
          {hits.map(u => <button key={u.id} className="row" onClick={() => start(u.username)}><Avatar name={u.username} /><div><b>@{u.username}</b><small>{u.email}</small></div></button>)}
          {q.trim().length > 1 && !hits.length && <p className="muted">No match yet. Press Enter to try exactly “{q.trim()}”.</p>}
          {msg?.text && <p className="err">{msg.text}</p>}
          {(msg?.email || (isMail && !hits.length)) && (
            <a className="row invite" href={`mailto:${msg?.email || q.trim()}?subject=${encodeURIComponent('Join me on NepaChat')}&body=${encodeURIComponent(`Hi! ${me.username} invited you to NepaChat: ${location.origin}`)}`}>
              <div className="avatar">✉</div><div><b>Invite {msg?.email || q.trim()}</b><small>Send an invitation by email</small></div>
            </a>)}
        </div>
        <button className="btn ghost" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

export default function App() {
  const [auth, setAuth] = useState(() => JSON.parse(localStorage.getItem('nepa') || 'null'));
  const [chats, setChats] = useState([]), [active, setActive] = useState(null), [messages, setMessages] = useState([]);
  const [text, setText] = useState(''), [modal, setModal] = useState(false), [filter, setFilter] = useState('');
  const [callState, setCallState] = useState(null), [localStream, setLocalStream] = useState(null), [remoteStream, setRemoteStream] = useState(null);
  const endRef = useRef(), activeRef = useRef(), socketRef = useRef(), peerRef = useRef(), localStreamRef = useRef(), callRef = useRef(), pendingCandidatesRef = useRef([]);
  activeRef.current = active;
  callRef.current = callState;
  const token = auth?.token, me = auth?.user;
  const logout = () => { localStorage.removeItem('nepa'); setAuth(null); setChats([]); setActive(null); };
  const onAuth = d => { localStorage.setItem('nepa', JSON.stringify(d)); setAuth(d); };
  const clearCall = () => {
    peerRef.current?.close(); peerRef.current = null;
    localStreamRef.current?.getTracks().forEach(track => track.stop()); localStreamRef.current = null;
    pendingCandidatesRef.current = []; setLocalStream(null); setRemoteStream(null); setCallState(null); callRef.current = null;
  };
  const endCall = reason => {
    const current = callRef.current;
    if (current) socketRef.current?.emit('call:end', { chatId: current.chatId, callId: current.callId, reason });
    clearCall();
  };

  const attachPeer = (peer, current) => {
    peerRef.current = peer;
    peer.ontrack = event => setRemoteStream(event.streams[0]);
    peer.onicecandidate = event => {
      if (event.candidate) socketRef.current?.emit('call:signal', { chatId: current.chatId, callId: current.callId, signal: { type: 'candidate', candidate: event.candidate.toJSON() } });
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'connected') setCallState(c => c ? { ...c, status: 'active' } : c);
      if (peer.connectionState === 'failed') setCallState(c => c ? { ...c, error: 'Connection failed. Check your network or TURN server settings.' } : c);
    };
  };

  const startCall = async kind => {
    if (!active || !socketRef.current || callRef.current) return;
    try {
      const { iceServers } = await call('/calls/ice-servers', token);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: kind === 'video' });
      const current = { chatId: active.id, callId: crypto.randomUUID(), peerUserId: active.other.id, peerName: '@' + active.other.username, kind, status: 'calling' };
      const peer = new RTCPeerConnection({ iceServers });
      callRef.current = current; setCallState(current); localStreamRef.current = stream; setLocalStream(stream);
      attachPeer(peer, current); stream.getTracks().forEach(track => peer.addTrack(track, stream));
      const offer = await peer.createOffer(); await peer.setLocalDescription(offer);
      socketRef.current.emit('call:invite', { chatId: current.chatId, callId: current.callId, kind, offer: peer.localDescription });
    } catch (error) {
      clearCall();
      setCallState({ peerName: '@' + active.other.username, kind, status: 'error', error: error.name === 'NotAllowedError' ? 'Allow camera and microphone access to place a call.' : error.message || 'Unable to start the call.' });
    }
  };

  const acceptCall = async () => {
    const current = callRef.current;
    if (!current?.incoming) return;
    try {
      const { iceServers } = await call('/calls/ice-servers', token);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: current.kind === 'video' });
      const peer = new RTCPeerConnection({ iceServers });
      const connecting = { ...current, incoming: false, status: 'connecting' };
      callRef.current = connecting; setCallState(connecting); localStreamRef.current = stream; setLocalStream(stream);
      attachPeer(peer, current); stream.getTracks().forEach(track => peer.addTrack(track, stream));
      await peer.setRemoteDescription(current.offer);
      const candidates = pendingCandidatesRef.current.filter(item => item.callId === current.callId);
      pendingCandidatesRef.current = pendingCandidatesRef.current.filter(item => item.callId !== current.callId);
      for (const item of candidates) await peer.addIceCandidate(item.candidate);
      const answer = await peer.createAnswer(); await peer.setLocalDescription(answer);
      socketRef.current.emit('call:signal', { chatId: current.chatId, callId: current.callId, signal: { type: 'answer', sdp: peer.localDescription } });
    } catch (error) {
      setCallState(c => c ? { ...c, error: error.name === 'NotAllowedError' ? 'Allow camera and microphone access to answer.' : error.message || 'Unable to answer the call.' } : c);
    }
  };

  useEffect(() => {
    if (!token) return;
    call('/chats', token).then(setChats).catch(e => e.status === 401 && logout());
    const s = io(API || undefined, { auth: { token } });
    socketRef.current = s;
    s.on('message', ({ chatId, message, chat }) => {
      setChats(c => [chat, ...c.filter(x => x.id !== chatId)]);
      if (activeRef.current?.id === chatId) setMessages(m => m.some(x => x.id === message.id) ? m : [...m, message]);
    });
    s.on('call:incoming', incoming => {
      if (callRef.current) { s.emit('call:end', { chatId: incoming.chatId, callId: incoming.callId, reason: 'declined' }); return; }
      pendingCandidatesRef.current = pendingCandidatesRef.current.filter(item => item.callId === incoming.callId);
      const next = { ...incoming, peerUserId: incoming.from.id, peerName: '@' + incoming.from.username, incoming: true, status: 'incoming' };
      callRef.current = next; setCallState(next);
    });
    s.on('call:signal', async ({ callId, signal }) => {
      if (signal.type === 'candidate' && !callRef.current) {
        if (pendingCandidatesRef.current.length < 64) pendingCandidatesRef.current.push({ callId, candidate: signal.candidate });
        return;
      }
      if (callRef.current?.callId !== callId) return;
      const peer = peerRef.current;
      if (signal.type === 'answer' && peer) {
        await peer.setRemoteDescription(signal.sdp);
        const candidates = pendingCandidatesRef.current.filter(item => item.callId === callId);
        pendingCandidatesRef.current = pendingCandidatesRef.current.filter(item => item.callId !== callId);
        for (const item of candidates) await peer.addIceCandidate(item.candidate);
      } else if (signal.type === 'candidate') {
        if (peer?.remoteDescription) await peer.addIceCandidate(signal.candidate);
        else if (pendingCandidatesRef.current.length < 64) pendingCandidatesRef.current.push({ callId, candidate: signal.candidate });
      }
    });
    s.on('call:ended', ({ callId }) => { if (callRef.current?.callId === callId) clearCall(); });
    return () => { s.close(); socketRef.current = null; clearCall(); };
  }, [token]);

  useEffect(() => {
    if (!active) return;
    setMessages([]);
    call(`/chats/${active.id}/messages`, token).then(setMessages).catch(() => {});
  }, [active?.id]);
  useEffect(() => { endRef.current?.scrollIntoView(); }, [messages]);

  const open = c => { setChats(l => l.some(x => x.id === c.id) ? l : [c, ...l]); setActive(c); };
  const send = async () => {
    const t = text.trim(); if (!t || !active) return; setText('');
    try { await call(`/chats/${active.id}/messages`, token, 'POST', { text: t }); } catch { setText(t); }
  };

  if (!auth) return <Auth onAuth={onAuth} />;
  const shown = chats.filter(c => (c.other.username + c.other.email).includes(filter.toLowerCase()));
  return (
    <div className={'app' + (active ? ' open' : '')}>
      <header className="top">
        <b>Nepa<span>Chat</span></b>
        <div className="grow" />
        <small>@{me.username}</small>
        <button className="hbtn" title="New chat" onClick={() => setModal(true)}>＋</button>
        <button className="hbtn" title="Sign out" onClick={logout}>⎋</button>
      </header>
      <aside className="side">
        <input className="search" placeholder="Search chats" value={filter} onChange={e => setFilter(e.target.value)} />
        <div className="list">
          {!shown.length && <p className="muted pad">No chats yet. Tap ＋ to start one.</p>}
          {shown.map(c => (
            <button key={c.id} className={'row' + (active?.id === c.id ? ' on' : '')} onClick={() => setActive(c)}>
              <Avatar name={c.other.username} />
              <div className="grow"><b>@{c.other.username}</b><small>{c.last ? (c.by === me.id ? 'You: ' : '') + c.last : 'Say hello 👋'}</small></div>
              {c.ts > 0 && <em>{time(c.ts)}</em>}
            </button>))}
        </div>
      </aside>
      <main className="main">
        {!active ? <div className="empty"><div>💬</div><h2>Welcome, @{me.username}</h2><p>Select a chat or start a new one with an email address or username.</p></div> : <>
          <div className="chead">
            <button className="back" onClick={() => setActive(null)}>←</button>
            <Avatar name={active.other.username} big />
            <div className="grow"><b>@{active.other.username}</b><small>{active.other.email}</small></div>
            <button className="mail" title="Start audio call" aria-label="Start audio call" onClick={() => startCall('audio')}>☎</button>
            <button className="mail" title="Start video call" aria-label="Start video call" onClick={() => startCall('video')}>▣</button>
            <a className="mail" href={`mailto:${active.other.email}`} title="Send email">✉</a>
          </div>
          <div className="msgs">
            {messages.map(m => <div key={m.id} className={'msg' + (m.from === me.id ? ' me' : '')}>{m.text}<i>{time(m.ts)}{m.from === me.id ? ' ✓' : ''}</i></div>)}
            <div ref={endRef} />
          </div>
          <div className="comp">
            <textarea rows={1} value={text} placeholder="Type a message" onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
            <button className="send" onClick={send}>➤</button>
          </div>
        </>}
      </main>
      {modal && <NewChat token={token} me={me} onClose={() => setModal(false)} onOpen={open} />}
      <CallPanel callState={callState} localStream={localStream} remoteStream={remoteStream} onAccept={acceptCall} onDecline={() => endCall('declined')} onHangup={() => endCall('ended')} />
    </div>
  );
}
