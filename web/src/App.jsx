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
const decodeVapidKey = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), character => character.charCodeAt(0));

function Auth({ onAuth, allowPublicSignUp }) {
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
        {allowPublicSignUp
          ? <p className="sw">{mode === 'login' ? 'New here?' : 'Have an account?'} <a onClick={switchMode}>{mode === 'login' ? 'Create account' : 'Sign in'}</a></p>
          : <p className="sw">Account creation is managed by the owner.</p>}
      </form>
    </div>
  );
}

function CallPanel({ callState, localStream, remoteStream, layout, onLayoutChange, onAccept, onDecline, onHangup }) {
  const localRef = useRef(), remoteRef = useRef();
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null);
  useEffect(() => { if (localRef.current) localRef.current.srcObject = localStream || null; }, [localStream]);
  useEffect(() => { if (remoteRef.current) remoteRef.current.srcObject = remoteStream || null; }, [remoteStream]);
  useEffect(() => {
    if (layout !== 'overlay' || !dragRef.current) return;
    const onPointerMove = event => {
      if (!dragRef.current) return;
      const nextX = Math.min(220, Math.max(-220, dragRef.current.offsetX + (event.clientX - dragRef.current.startX)));
      const nextY = Math.min(160, Math.max(-160, dragRef.current.offsetY + (event.clientY - dragRef.current.startY)));
      setDragOffset({ x: nextX, y: nextY });
    };
    const onPointerUp = () => { dragRef.current = null; };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [layout]);
  if (!callState) return null;
  const label = callState.incoming ? `Incoming ${callState.kind} call` : callState.status === 'calling' ? 'Calling…' : callState.status === 'active' ? 'Connected' : 'Connecting…';
  const handleDragStart = event => {
    if (layout !== 'overlay' || event.button !== 0 || event.target.closest('button')) return;
    dragRef.current = { startX: event.clientX, startY: event.clientY, offsetX: dragOffset.x, offsetY: dragOffset.y };
  };
  const panelStyle = layout === 'overlay' ? { position: 'fixed', left: '50%', top: '50%', transform: `translate(-50%, -50%) translate(${dragOffset.x}px, ${dragOffset.y}px)`, zIndex: 12 } : undefined;
  return (
    <div className={'call-shell call-shell-' + layout}>
      <section className="call-panel" aria-label="Call" style={panelStyle} onPointerDown={handleDragStart}>
        <header>
          <div><b>{callState.peerName}</b><small>{label}</small></div>
          {!callState.incoming && <div className="call-layout-actions">
            {layout !== 'minimized' && <button className="call-action" title="Minimize call" aria-label="Minimize call" onClick={() => onLayoutChange('minimized')}>−</button>}
            {layout === 'minimized'
              ? <button className="call-action" title="Restore call" aria-label="Restore call" onClick={() => onLayoutChange('overlay')}>□</button>
              : <button className="call-action" title={layout === 'split' ? 'Return to full call' : 'Split screen'} aria-label={layout === 'split' ? 'Return to full call' : 'Split screen'} onClick={() => onLayoutChange(layout === 'split' ? 'overlay' : 'split')}>▣</button>}
          </div>}
        </header>
        {callState.error && <p className="err call-error">{callState.error}</p>}
        <div className={'call-stage' + (callState.kind === 'audio' ? ' audio-stage' : '')}>
          <video ref={remoteRef} autoPlay playsInline className="remote-video" />
          {callState.kind === 'audio' && <div className="audio-label">{callState.peerName}</div>}
          {callState.kind === 'video' && localStream && <video ref={localRef} autoPlay muted playsInline className="local-video" />}
        </div>
        <footer>
          {layout === 'minimized' ? <>
            <span className="call-mini-status">{label}</span>
            {callState.incoming ? <button className="btn" onClick={onAccept}>Answer</button> : <button className="btn danger" onClick={onHangup}>End</button>}
          </> : callState.incoming ? <>
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

function AdminCreateUser({ token, onClose }) {
  const [fields, setFields] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const set = key => event => setFields(current => ({ ...current, [key]: event.target.value }));
  const create = async event => {
    event.preventDefault(); setError(''); setNotice('');
    try {
      const result = await call('/admin/users', token, 'POST', fields);
      setNotice(`Created @${result.user.username}. They can sign in now.`);
      setFields({ username: '', email: '', password: '' });
    } catch (requestError) { setError(requestError.message); }
  };
  return (
    <div className="modal" onClick={onClose}>
      <form className="sheet" onClick={event => event.stopPropagation()} onSubmit={create}>
        <h3>Create account</h3>
        <label>Username<input value={fields.username} onChange={set('username')} autoComplete="off" minLength={3} maxLength={20} required /></label>
        <label>Email<input type="email" value={fields.email} onChange={set('email')} autoComplete="off" required /></label>
        <label>Temporary password<input type="password" value={fields.password} onChange={set('password')} minLength={8} autoComplete="new-password" required /></label>
        {error && <div className="err">{error}</div>}
        {notice && <div className="notice">{notice}</div>}
        <button className="btn" type="submit">Create account</button>
        <button className="btn ghost" type="button" onClick={onClose}>Close</button>
      </form>
    </div>
  );
}

function CallHistory({ token, onClose }) {
  const [history, setHistory] = useState([]), [error, setError] = useState('');
  useEffect(() => { call('/calls/history', token).then(setHistory).catch(requestError => setError(requestError.message)); }, [token]);
  const label = item => item.status === 'missed' ? 'Missed' : item.status === 'declined' ? 'Declined' : item.status === 'cancelled' ? 'Cancelled' : item.status === 'ended' ? 'Ended' : item.status === 'active' ? 'Connected' : 'Ringing';
  return (
    <div className="modal" onClick={onClose}>
      <section className="sheet history-sheet" onClick={event => event.stopPropagation()}>
        <h3>Call history</h3>
        {error && <p className="err">{error}</p>}
        {!history.length && !error && <p className="muted">No calls yet.</p>}
        <div className="history-list">{history.map(item => (
          <div className="history-row" key={item.id}>
            <Avatar name={item.other.username} />
            <div className="grow"><b>@{item.other.username}</b><small>{item.direction === 'incoming' ? 'Incoming' : 'Outgoing'} {item.kind} · {label(item)}</small></div>
            <time>{new Date(item.startedAt).toLocaleString()}</time>
          </div>
        ))}</div>
        <button className="btn ghost" onClick={onClose}>Close</button>
      </section>
    </div>
  );
}

function LocationShareDialog({ onStart, onClose }) {
  const [duration, setDuration] = useState(3600), [error, setError] = useState('');
  const start = async () => {
    setError('');
    try { await onStart(duration); }
    catch (requestError) { setError(requestError.message || 'Could not get your location'); }
  };
  return (
    <div className="modal" onClick={onClose}>
      <section className="sheet" onClick={event => event.stopPropagation()}>
        <h3>Share live location</h3>
        <p className="muted">Your location is shared only with this chat and stops automatically when the timer ends. You can stop it sooner.</p>
        <label>Share for<select value={duration} onChange={event => setDuration(Number(event.target.value))}>
          <option value={900}>15 minutes</option><option value={3600}>1 hour</option><option value={28800}>8 hours</option>
        </select></label>
        {error && <div className="err">{error}</div>}
        <button className="btn" onClick={start}>Share my location</button>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
      </section>
    </div>
  );
}

export default function App() {
  const [auth, setAuth] = useState(() => JSON.parse(localStorage.getItem('nepa') || 'null'));
  const [publicConfig, setPublicConfig] = useState({ allowPublicSignUp: true, vapidPublicKey: null, mediaEnabled: false });
  const [adminModal, setAdminModal] = useState(false), [callsOpen, setCallsOpen] = useState(false), [locationModal, setLocationModal] = useState(false);
  const [chats, setChats] = useState([]), [active, setActive] = useState(null), [messages, setMessages] = useState([]);
  const [text, setText] = useState(''), [replyingTo, setReplyingTo] = useState(null), [modal, setModal] = useState(false), [filter, setFilter] = useState('');
  const [attachedFiles, setAttachedFiles] = useState([]), [composeError, setComposeError] = useState('');
  const [locationShares, setLocationShares] = useState([]), [locationError, setLocationError] = useState('');
  const [pushEnabled, setPushEnabled] = useState(false), [pushError, setPushError] = useState('');
  const [alerts, setAlerts] = useState([]);
  const [callState, setCallState] = useState(null), [localStream, setLocalStream] = useState(null), [remoteStream, setRemoteStream] = useState(null);
  const [callLayout, setCallLayout] = useState('overlay');
  const endRef = useRef(), fileInputRef = useRef(), activeRef = useRef(), socketRef = useRef(), peerRef = useRef(), localStreamRef = useRef(), callRef = useRef(), pendingCandidatesRef = useRef([]), locationWatchRef = useRef(null), locationTimerRef = useRef(null), lastLocationUpdateRef = useRef(0);
  activeRef.current = active;
  callRef.current = callState;
  const token = auth?.token, me = auth?.user;
  const stopLocationTracking = () => {
    if (locationWatchRef.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(locationWatchRef.current);
    if (locationTimerRef.current !== null) window.clearTimeout(locationTimerRef.current);
    locationWatchRef.current = null; locationTimerRef.current = null;
  };
  const logout = () => { stopLocationTracking(); localStorage.removeItem('nepa'); setAuth(null); setChats([]); setActive(null); setLocationShares([]); };
  const onAuth = d => { localStorage.setItem('nepa', JSON.stringify(d)); setAuth(d); };

  useEffect(() => {
    call('/config').then(config => {
      setPublicConfig(config);
      if (new URLSearchParams(window.location.search).has('callHistory')) setCallsOpen(true);
      if (config.vapidPublicKey && 'serviceWorker' in navigator && Notification.permission === 'granted') {
        navigator.serviceWorker.ready.then(registration => registration.pushManager.getSubscription().then(subscription => setPushEnabled(Boolean(subscription)))).catch(() => {});
      }
    }).catch(() => {});
  }, []);
  const addAlert = (message, kind = 'info') => {
    const next = { id: `${Date.now()}-${Math.random()}`, message, kind };
    setAlerts(current => [...current, next]);
    window.setTimeout(() => setAlerts(current => current.filter(item => item.id !== next.id)), 4000);
  };
  const enableNotifications = async () => {
    setPushError('');
    try {
      if (!publicConfig.vapidPublicKey) throw new Error('Call notifications are not configured yet');
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('Push notifications are not supported in this browser');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Allow notifications in your browser to receive call alerts');
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeVapidKey(publicConfig.vapidPublicKey) });
      await call('/push/subscribe', token, 'POST', { subscription: subscription.toJSON() });
      setPushEnabled(true);
      addAlert('Call notifications enabled', 'success');
    } catch (error) {
      setPushError(error.message);
      addAlert(error.message, 'error');
    }
  };
  const startLocationShare = async durationSeconds => {
    if (!active || !navigator.geolocation) throw new Error('Location is not available in this browser');
    if (locationWatchRef.current !== null || locationShares.some(share => share.ownerId === me.id)) throw new Error('Stop your existing live location share first');
    const position = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }));
    const share = await call(`/chats/${active.id}/location-shares`, token, 'POST', {
      latitude: position.coords.latitude, longitude: position.coords.longitude, durationSeconds,
    });
    setLocationError('');
    setLocationModal(false);
    setLocationShares(current => [...current.filter(item => item.id !== share.id), share]);
    lastLocationUpdateRef.current = Date.now();
    locationWatchRef.current = navigator.geolocation.watchPosition(positionUpdate => {
      const now = Date.now();
      if (now - lastLocationUpdateRef.current < 5000) return;
      lastLocationUpdateRef.current = now;
      call(`/chats/${share.chatId}/location-shares/${share.id}`, token, 'PATCH', {
        latitude: positionUpdate.coords.latitude, longitude: positionUpdate.coords.longitude,
      }).then(updated => setLocationShares(current => current.map(item => item.id === updated.id ? updated : item))).catch(error => setLocationError(error.message));
    }, error => setLocationError(error.message || 'Location updates are unavailable'), { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
    locationTimerRef.current = window.setTimeout(() => stopLocationShare(share), Math.max(0, share.expiresAt - Date.now()));
  };
  const stopLocationShare = async share => {
    if (!share || share.ownerId !== me.id) return;
    stopLocationTracking();
    setLocationShares(current => current.filter(item => item.id !== share.id));
    await call(`/chats/${share.chatId}/location-shares/${share.id}`, token, 'DELETE').catch(() => {});
  };
  const uploadAttachment = async (file, chatId) => {
    if (!publicConfig.mediaEnabled) throw new Error('Chat media storage is not configured');
    if (file.size > 25 * 1024 * 1024) throw new Error('Each image or video must be under 25 MB');
    const fileType = file.type || (() => {
      const lowerName = String(file.name || '').toLowerCase();
      if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) return 'image/jpeg';
      if (lowerName.endsWith('.png')) return 'image/png';
      if (lowerName.endsWith('.webp')) return 'image/webp';
      if (lowerName.endsWith('.gif')) return 'image/gif';
      if (lowerName.endsWith('.mp4')) return 'video/mp4';
      if (lowerName.endsWith('.webm')) return 'video/webm';
      return 'application/octet-stream';
    })();
    const response = await fetch(`${API}/api/chats/${chatId}/uploads`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': fileType, 'X-File-Type': fileType, 'X-File-Name': encodeURIComponent(file.name) },
      body: file,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Upload failed');
    return data.attachment;
  };
  const enablePush = async () => {
    await enableNotifications();
  };
  const showCallHistory = () => {
    setCallsOpen(true);
    if (new URLSearchParams(window.location.search).has('callHistory')) history.replaceState(null, '', window.location.pathname);
  };
  const clearCall = () => {
    peerRef.current?.close(); peerRef.current = null;
    localStreamRef.current?.getTracks().forEach(track => track.stop()); localStreamRef.current = null;
    pendingCandidatesRef.current = []; setLocalStream(null); setRemoteStream(null); setCallState(null); setCallLayout('overlay'); callRef.current = null;
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
      callRef.current = current; setCallState(current); setCallLayout('overlay'); localStreamRef.current = stream; setLocalStream(stream);
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
      callRef.current = connecting; setCallState(connecting); setCallLayout('overlay'); localStreamRef.current = stream; setLocalStream(stream);
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
    call('/me', token).then(user => setAuth(current => {
      if (!current || current.user.role === user.role) return current;
      const updated = { ...current, user };
      localStorage.setItem('nepa', JSON.stringify(updated));
      return updated;
    })).catch(e => e.status === 401 && logout());
    call('/chats', token).then(setChats).catch(e => e.status === 401 && logout());
    const s = io(API || undefined, { auth: { token } });
    socketRef.current = s;
    s.on('message', ({ chatId, message, chat }) => {
      setChats(c => [chat, ...c.filter(x => x.id !== chatId)]);
      if (message.from !== me.id) {
        s.emit('message:delivered', { chatId, messageId: message.id });
        if (activeRef.current?.id === chatId) s.emit('message:read', { chatId, messageId: message.id });
        addAlert(`New message from @${chat.other.username}`, 'info');
      }
      if (activeRef.current?.id === chatId) setMessages(m => m.some(x => x.id === message.id) ? m : [...m, message]);
    });
    s.on('message:status', ({ chatId, messageId, status }) => {
      if (activeRef.current?.id !== chatId) return;
      const rank = { sent: 0, delivered: 1, read: 2 };
      setMessages(list => list.map(message => message.id === messageId && rank[status] > rank[message.status || 'sent'] ? { ...message, status } : message));
    });
    s.on('location:update', share => setLocationShares(current => [...current.filter(item => item.id !== share.id), share]));
    s.on('location:stopped', ({ shareId }) => setLocationShares(current => current.filter(item => item.id !== shareId)));
    s.on('call:incoming', incoming => {
      if (callRef.current) { s.emit('call:end', { chatId: incoming.chatId, callId: incoming.callId, reason: 'declined' }); return; }
      pendingCandidatesRef.current = pendingCandidatesRef.current.filter(item => item.callId === incoming.callId);
      const next = { ...incoming, peerUserId: incoming.from.id, peerName: '@' + incoming.from.username, incoming: true, status: 'incoming' };
      callRef.current = next; setCallState(next); setCallLayout('overlay');
      addAlert(`Incoming ${incoming.kind} call from @${incoming.from.username}`, 'info');
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
    call(`/chats/${active.id}/messages`, token).then(list => {
      setMessages(list);
      for (const message of list) {
        if (message.from === me.id) continue;
        socketRef.current?.emit('message:delivered', { chatId: active.id, messageId: message.id });
        socketRef.current?.emit('message:read', { chatId: active.id, messageId: message.id });
      }
    }).catch(() => {});
    call(`/chats/${active.id}/location-shares`, token).then(shares => setLocationShares(current => [...current.filter(item => item.chatId !== active.id), ...shares])).catch(() => {});
  }, [active?.id]);
  useEffect(() => { endRef.current?.scrollIntoView(); }, [messages]);

  const open = c => { setChats(l => l.some(x => x.id === c.id) ? l : [c, ...l]); setActive(c); };
  const send = async () => {
    const t = text.trim(), files = attachedFiles.slice(), chat = active;
    if ((!t && !files.length) || !chat) return;
    const payload = { text: t, attachments: [], replyTo: replyingTo?.id || null };
    setText(''); setAttachedFiles([]); setReplyingTo(null); setComposeError('');
    try {
      const attachments = await Promise.all(files.map(file => uploadAttachment(file, chat.id)));
      payload.attachments = attachments;
      await call(`/chats/${chat.id}/messages`, token, 'POST', payload);
    } catch (error) { setText(t); setAttachedFiles(files); setReplyingTo(replyingTo); setComposeError(error.message); }
  };

  if (!auth) return <Auth onAuth={onAuth} allowPublicSignUp={publicConfig.allowPublicSignUp} />;
  const shown = chats.filter(c => (c.other.username + c.other.email).includes(filter.toLowerCase()));
  const visibleLocationShares = active ? locationShares.filter(share => share.chatId === active.id) : [];
  return (
    <div className={'app' + (active ? ' open' : '') + (callLayout === 'split' ? ' call-split-active' : '')}>
      <header className="top">
        <b>Nepa<span>Chat</span></b>
        <div className="grow" />
        <small>@{me.username}</small>
        {me.role === 'admin' && <button className="hbtn" title="Create account" aria-label="Create account" onClick={() => setAdminModal(true)}>＋</button>}
        <button className="hbtn" title="Call history" aria-label="Call history" onClick={showCallHistory}>◷</button>
        {publicConfig.vapidPublicKey && <button className={'hbtn' + (pushEnabled ? ' push-on' : '')} title={pushEnabled ? 'Call notifications enabled' : 'Enable call notifications'} aria-label="Enable call notifications" onClick={enablePush}>{pushEnabled ? '●' : '♢'}</button>}
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
            <button className="mail" title="Share live location" aria-label="Share live location" onClick={() => setLocationModal(true)}>⌖</button>
            <button className="mail" title="Start audio call" aria-label="Start audio call" onClick={() => startCall('audio')}>☎</button>
            <button className="mail" title="Start video call" aria-label="Start video call" onClick={() => startCall('video')}>▣</button>
            <a className="mail" href={`mailto:${active.other.email}`} title="Send email">✉</a>
          </div>
          {visibleLocationShares.map(share => <div className="location-share" key={share.id}>
            <div className="grow"><b>{share.ownerId === me.id ? 'You are sharing live location' : `@${share.ownerName} is sharing live location`}</b><small>Until {new Date(share.expiresAt).toLocaleTimeString()}</small></div>
            <a href={share.mapsUrl} target="_blank" rel="noreferrer">Open in Maps</a>
            {share.ownerId === me.id && <button className="text-button" onClick={() => stopLocationShare(share)}>Stop</button>}
          </div>)}
          {locationError && <div className="inline-error">{locationError}</div>}
          <div className="msgs">
            {messages.map(m => <div key={m.id} className={'msg' + (m.from === me.id ? ' me' : '')}>
              {m.replyTo && <div className="reply-chunk"><span>Replying to @{m.replyTo.from === me.id ? 'you' : active.other.username}</span><div>{m.replyTo.text || 'Shared media'}</div></div>}
              {m.text}
              {m.attachments?.map(attachment => attachment.type.startsWith('image/')
                ? <a className="attachment-link" href={attachment.url} target="_blank" rel="noreferrer" key={attachment.key}><img className="message-image" src={attachment.url} alt={attachment.name} loading="lazy" /></a>
                : <video className="message-video" key={attachment.key} src={attachment.url} controls playsInline preload="metadata" />)}
              <div className="msg-actions"><button className="mini-action" onClick={() => setReplyingTo(m)}>Reply</button><i>{time(m.ts)}{m.from === me.id && <span className={'ticks ' + (m.status || 'sent')} title={m.status === 'read' ? 'Read' : m.status === 'delivered' ? 'Delivered' : 'Sent'} aria-label={m.status === 'read' ? 'Read' : m.status === 'delivered' ? 'Delivered' : 'Sent'}>{m.status === 'sent' || !m.status ? '✓' : '✓✓'}</span>}</i></div>
            </div>)}
            <div ref={endRef} />
          </div>
          {attachedFiles.length > 0 && <div className="file-queue">{attachedFiles.map((file, index) => <span key={`${file.name}-${file.lastModified}`}>{file.name}<button aria-label={`Remove ${file.name}`} onClick={() => setAttachedFiles(current => current.filter((_, i) => i !== index))}>×</button></span>)}</div>}
          {replyingTo && <div className="reply-box"><div className="reply-meta">Replying to @{messages.find(item => item.id === replyingTo.id)?.from === me.id ? 'you' : active.other.username}</div><div className="reply-preview">{replyingTo.text || 'Shared media'}</div><button className="text-button" onClick={() => setReplyingTo(null)}>Cancel</button></div>}
          {composeError && <div className="inline-error">{composeError}</div>}
          <div className="comp">
            <input ref={fileInputRef} className="file-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" multiple onChange={event => { setAttachedFiles(current => [...current, ...Array.from(event.target.files || []).slice(0, 5 - current.length)]); event.target.value = ''; }} />
            <button className="attach" title={publicConfig.mediaEnabled ? 'Attach image or video' : 'Media storage is not configured'} aria-label="Attach image or video" disabled={!publicConfig.mediaEnabled || attachedFiles.length >= 5} onClick={() => fileInputRef.current?.click()}>▧</button>
            <textarea rows={1} value={text} placeholder={replyingTo ? 'Reply to the message…' : 'Type a message'} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
            <button className="send" onClick={send}>➤</button>
          </div>
        </>}
      </main>
      {modal && <NewChat token={token} me={me} onClose={() => setModal(false)} onOpen={open} />}
      {adminModal && <AdminCreateUser token={token} onClose={() => setAdminModal(false)} />}
      {callsOpen && <CallHistory token={token} onClose={() => setCallsOpen(false)} />}
      {locationModal && <LocationShareDialog onStart={startLocationShare} onClose={() => setLocationModal(false)} />}
      {pushError && <div className="push-error" role="status">{pushError}<button aria-label="Dismiss" onClick={() => setPushError('')}>×</button></div>}
      {alerts.length > 0 && (
        <div className="alert-stack" aria-live="polite" aria-atomic="true">
          {alerts.map(alert => <div key={alert.id} className={'alert-item alert-' + alert.kind}>{alert.message}</div>)}
        </div>
      )}
      <CallPanel callState={callState} localStream={localStream} remoteStream={remoteStream} layout={callLayout} onLayoutChange={setCallLayout} onAccept={acceptCall} onDecline={() => endCall('declined')} onHangup={() => endCall('ended')} />
    </div>
  );
}
