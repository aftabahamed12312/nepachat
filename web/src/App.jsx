import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const API = import.meta.env.VITE_API_URL || '';
const MAX_ATTACH_BYTES = 25 * 1024 * 1024;
const attachmentKey = file => `${file.name}-${file.size}-${file.lastModified}`;
const mediaTypeFromFile = file => {
  const lowerName = String(file.name || '').toLowerCase();
  if (['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'].includes(file.type)) return file.type;
  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) return 'image/jpeg';
  if (lowerName.endsWith('.png')) return 'image/png';
  if (lowerName.endsWith('.webp')) return 'image/webp';
  if (lowerName.endsWith('.gif')) return 'image/gif';
  if (lowerName.endsWith('.mp4')) return 'video/mp4';
  if (lowerName.endsWith('.webm')) return 'video/webm';
  return '';
};
const isSupportedAttachment = file => {
  if (typeof File === 'undefined' || !(file instanceof File)) return false;
  if (file.size <= 0 || file.size > MAX_ATTACH_BYTES) return false;
  return Boolean(mediaTypeFromFile(file));
};
const call = async (path, token, method = 'GET', body) => {
  const r = await fetch(API + '/api' + path, {
    method,
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: 'Bearer ' + token }) },
    body: body && JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || 'Request failed'), { data: d, status: r.status });
  return d;
};
const time = t => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const Avatar = ({ name, big, avatarPath }) => (
  <div className={'avatar' + (big ? ' big' : '')}>
    {avatarPath && <img src={API + avatarPath} alt="" onError={event => { event.currentTarget.style.display = 'none'; }} />}
    <span>{(name || '?')[0].toUpperCase()}</span>
  </div>
);
const decodeVapidKey = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), character => character.charCodeAt(0));
const getDeviceId = () => {
  const key = 'nepachat-device-id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
};
const getDeviceName = () => {
  const agent = navigator.userAgent || '';
  const platform = /iPhone|iPad|iPod/i.test(agent) ? 'iPhone/iPad'
    : /Android/i.test(agent) ? 'Android'
      : /Windows/i.test(agent) ? 'Windows'
        : /Macintosh|Mac OS/i.test(agent) ? 'Mac'
          : /Linux/i.test(agent) ? 'Linux' : 'Web browser';
  return `${platform} browser`;
};

function Auth({ onAuth, allowPublicSignUp, emailVerificationEnabled }) {
  const onAuthRef = useRef(onAuth);
  onAuthRef.current = onAuth;
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ username: '', email: '', password: '' });
  const [err, setErr] = useState(''), [notice, setNotice] = useState(''), [awaitingCode, setAwaitingCode] = useState(false), [code, setCode] = useState('');
  const [pairing, setPairing] = useState(null), [pairingQr, setPairingQr] = useState(''), [pairingError, setPairingError] = useState('');
  const set = k => e => setF({ ...f, [k]: e.target.value });
  useEffect(() => {
    if (!pairing) return undefined;
    let cancelled = false, checking = false;
    let timer;
    import('qrcode').then(({ default: QRCode }) =>
      QRCode.toDataURL(JSON.stringify({ type: 'nepachat-device-link', requestId: pairing.requestId, secret: pairing.secret, deviceName: pairing.deviceName }), { margin: 2, width: 260 }),
    ).then(source => { if (!cancelled) setPairingQr(source); })
      .catch(error => { if (!cancelled) setPairingError(`Could not create a QR code: ${error.message}`); });
    const checkStatus = async () => {
      if (cancelled || checking) return;
      checking = true;
      try {
        const result = await call(`/devices/pairing/${pairing.requestId}/claim`, null, 'POST', { secret: pairing.secret });
        if (result.status === 'approved') {
          if (!cancelled) onAuthRef.current(result);
          return;
        }
      } catch (error) {
        if (!cancelled) setPairingError(error.message);
        if (error.status === 410) return;
      } finally {
        checking = false;
      }
      if (!cancelled) timer = window.setTimeout(checkStatus, 2000);
    };
    timer = window.setTimeout(checkStatus, 2000);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [pairing]);
  const startPairing = async () => {
    setPairingError('');
    setPairingQr('');
    try {
      const request = await call('/devices/pairing', null, 'POST', { deviceId: getDeviceId(), deviceName: getDeviceName() });
      setPairing(request);
    } catch (error) {
      setPairingError(error.message);
    }
  };
  const authenticateDevice = async (path, credentials) => {
    const device = { deviceId: getDeviceId(), deviceName: getDeviceName() };
    try {
      return await call(path, null, 'POST', { ...credentials, ...device });
    } catch (error) {
      if (!error.data?.deviceIdConflict) throw error;
      localStorage.removeItem('nepachat-device-id');
      return call(path, null, 'POST', { ...credentials, deviceId: getDeviceId(), deviceName: getDeviceName() });
    }
  };
  const go = async e => {
    e.preventDefault(); setErr(''); setNotice('');
    try {
      if (mode === 'login') onAuth(await authenticateDevice('/login', { email: f.email, password: f.password }));
      else if (awaitingCode) onAuth(await authenticateDevice('/verify-email', { email: f.email, code }));
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
  if (pairing) return (
    <div className="auth">
      <header className="top"><b>Nepa<span>Chat</span></b></header>
      <section className="card pairing-card">
        <h2>Link this device</h2>
        <p>On a device already signed in to NepaChat, open <b>Linked devices</b> and scan this code.</p>
        {pairingQr ? <img className="pairing-qr" src={pairingQr} alt="QR code to link this device" /> : <p className="muted">Preparing secure QR code…</p>}
        <p className="muted">This code expires in five minutes. Keep it private.</p>
        {pairingError && <div className="err">{pairingError}</div>}
        <button className="btn ghost" onClick={() => { setPairing(null); setPairingQr(''); setPairingError(''); }}>Cancel</button>
      </section>
    </div>
  );
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
        {mode === 'register' && !awaitingCode && !emailVerificationEnabled && <div className="err">Email verification is not configured on the server. Ask the administrator to set up an email provider.</div>}
        <button className="btn" disabled={mode === 'register' && !awaitingCode && !emailVerificationEnabled}>{mode === 'login' ? 'Sign in' : awaitingCode ? 'Verify and create account' : 'Send verification code'}</button>
        {mode === 'register' && awaitingCode && <button type="button" className="text-button" onClick={resend}>Send a new code</button>}
        {allowPublicSignUp
          ? <p className="sw">{mode === 'login' ? 'New here?' : 'Have an account?'} <a onClick={switchMode}>{mode === 'login' ? 'Create account' : 'Sign in'}</a></p>
          : <p className="sw">Account creation is managed by the owner.</p>}
        {mode === 'login' && <button type="button" className="text-button" onClick={startPairing}>Link a companion device</button>}
      </form>
    </div>
  );
}

function LinkedDevices({ token, onClose, onAlert }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanRequest, setScanRequest] = useState(null);
  const [error, setError] = useState('');
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const handledScanRef = useRef(false);
  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      setDevices(await call('/devices', token));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { refresh(); }, [token]);
  useEffect(() => {
    if (!scanning) return undefined;
    let cancelled = false;
    handledScanRef.current = false;
    import('@zxing/browser').then(({ BrowserMultiFormatReader }) => {
      if (cancelled) return undefined;
      const reader = new BrowserMultiFormatReader();
      return reader.decodeFromVideoDevice(undefined, videoRef.current, async result => {
        if (!result || cancelled || handledScanRef.current) return;
        handledScanRef.current = true;
        controlsRef.current?.stop();
        setScanning(false);
        try {
          const parsed = JSON.parse(result.getText());
          if (parsed.type !== 'nepachat-device-link' || typeof parsed.requestId !== 'string' || typeof parsed.secret !== 'string') {
            throw new Error('That QR code is not a NepaChat device link.');
          }
          setScanRequest(parsed);
        } catch (requestError) {
          setError(requestError.message || 'Could not link this device');
        }
      });
    }).then(controls => {
      if (!controls) return;
      controlsRef.current = controls;
      if (cancelled) controls.stop();
    }).catch(requestError => {
      if (!cancelled) {
        setScanning(false);
        setError(requestError.message || 'Could not open the camera. Allow camera access and try again.');
      }
    });
    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [scanning, token]);
  const revokeDevice = async device => {
    setError('');
    try {
      await call(`/devices/${device.id}`, token, 'DELETE');
      setDevices(current => current.filter(item => item.id !== device.id));
      onAlert(`${device.name} was unlinked`, 'success');
    } catch (requestError) {
      setError(requestError.message);
    }
  };
  const approveScannedDevice = async () => {
    if (!scanRequest) return;
    setError('');
    try {
      await call(`/devices/pairings/${scanRequest.requestId}/approve`, token, 'POST', { secret: scanRequest.secret });
      setScanRequest(null);
      await refresh();
      onAlert('Device linked successfully', 'success');
    } catch (requestError) {
      setError(requestError.message);
    }
  };
  return (
    <div className="modal linked-devices-modal" onClick={onClose}>
      <section className="sheet linked-devices-sheet" role="dialog" aria-modal="true" aria-labelledby="linked-devices-title" onClick={event => event.stopPropagation()}>
        <div className="linked-devices-heading">
          <h3 id="linked-devices-title">Linked devices</h3>
          <button aria-label="Close linked devices" onClick={onClose}>×</button>
        </div>
        <p className="muted">Use NepaChat on up to four companion devices. Scan a device's QR code here to approve it.</p>
        {error && <p className="err">{error}</p>}
        {scanRequest ? <>
          <p>Approve linking <b>{scanRequest.deviceName || 'this device'}</b> to your account?</p>
          <button className="btn" onClick={approveScannedDevice}>Approve device link</button>
          <button className="btn ghost" onClick={() => setScanRequest(null)}>Cancel</button>
        </> : scanning ? <>
          <video ref={videoRef} className="device-scanner-video" muted playsInline />
          <button className="btn ghost" onClick={() => setScanning(false)}>Cancel scan</button>
        </> : <button className="btn" onClick={() => { setError(''); setScanning(true); }}>Scan QR code to link a device</button>}
        <h4>Your devices</h4>
        {loading && <p className="muted">Loading devices…</p>}
        {!loading && !devices.length && <p className="muted">No active devices found.</p>}
        <div className="linked-device-list">{devices.map(device => (
          <div className="linked-device-row" key={device.id}>
            <div className="linked-device-icon">▣</div>
            <div className="grow"><b>{device.name}{device.current ? ' (this device)' : ''}</b><small>{device.isPrimary ? 'Primary device' : 'Companion device'} · Last active {new Date(device.lastSeenAt).toLocaleString()}</small></div>
            {!device.current && <button className="friend-decline" onClick={() => revokeDevice(device)}>Unlink</button>}
          </div>
        ))}</div>
        <button className="btn ghost" onClick={onClose}>Done</button>
      </section>
    </div>
  );
}

function CallPanel({ callState, localStream, remoteStream, peerConnection, audioEnabled, videoEnabled, noiseCancellation, cameraSwitching, layout, onLayoutChange, onToggleAudio, onToggleVideo, onToggleNoiseCancellation, onSwitchCamera, onAccept, onDecline, onHangup }) {
  const localRef = useRef(), remoteRef = useRef();
  const panelRef = useRef();
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [networkQuality, setNetworkQuality] = useState('Connecting');
  const dragRef = useRef(null);
  useEffect(() => { if (localRef.current) localRef.current.srcObject = localStream || null; }, [localStream]);
  useEffect(() => { if (remoteRef.current) remoteRef.current.srcObject = remoteStream || null; }, [remoteStream]);
  useEffect(() => {
    if (!peerConnection) {
      setNetworkQuality('Connecting');
      return undefined;
    }
    let current = true;
    const previousInbound = new Map();
    const measure = async () => {
      try {
        const stats = await peerConnection.getStats();
        let roundTripTime = null, outgoingBitrate = null, packetsReceived = 0, packetsLost = 0;
        stats.forEach(report => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded' && (report.nominated || report.selected)) {
            roundTripTime = report.currentRoundTripTime ?? roundTripTime;
            outgoingBitrate = report.availableOutgoingBitrate ?? outgoingBitrate;
          }
          if (report.type === 'inbound-rtp' && (report.kind === 'audio' || report.kind === 'video')) {
            const prior = previousInbound.get(report.id);
            if (prior) {
              packetsReceived += Math.max(0, (report.packetsReceived || 0) - prior.received);
              packetsLost += Math.max(0, (report.packetsLost || 0) - prior.lost);
            }
            previousInbound.set(report.id, { received: report.packetsReceived || 0, lost: report.packetsLost || 0 });
          }
        });
        const totalPackets = packetsReceived + packetsLost;
        const lossRate = totalPackets ? packetsLost / totalPackets : 0;
        const poor = (roundTripTime !== null && roundTripTime > 0.5) || lossRate > 0.08 || (outgoingBitrate !== null && outgoingBitrate < 200_000);
        const fair = (roundTripTime !== null && roundTripTime > 0.25) || lossRate > 0.03 || (outgoingBitrate !== null && outgoingBitrate < 700_000);
        if (current) setNetworkQuality(peerConnection.connectionState === 'connected' ? poor ? 'Poor' : fair ? 'Fair' : 'Good' : 'Connecting');
      } catch (error) {
        if (current) {
          console.error('Unable to read call network statistics:', error);
          setNetworkQuality('Unavailable');
        }
      }
    };
    measure();
    const timer = window.setInterval(measure, 2500);
    return () => { current = false; window.clearInterval(timer); };
  }, [peerConnection]);
  useEffect(() => {
    const onPointerMove = event => {
      if (!dragRef.current) return;
      const rect = dragRef.current.rect;
      const deltaX = event.clientX - dragRef.current.startX;
      const deltaY = event.clientY - dragRef.current.startY;
      const nextX = dragRef.current.offsetX + Math.min(window.innerWidth - rect.right, Math.max(-rect.left, deltaX));
      const nextY = dragRef.current.offsetY + Math.min(window.innerHeight - rect.bottom, Math.max(-rect.top, deltaY));
      setDragOffset({ x: nextX, y: nextY });
    };
    const onPointerUp = () => { dragRef.current = null; };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, []);
  if (!callState) return null;
  const label = callState.incoming ? `Incoming ${callState.kind} call`
    : callState.status === 'calling' ? 'Calling…'
      : callState.status === 'active' ? 'Connected'
        : callState.status === 'reconnecting' ? 'Reconnecting…'
          : callState.status === 'failed' ? 'Connection failed' : 'Connecting…';
  const handleDragStart = event => {
    if (event.button !== 0 || event.target.closest('button')) return;
    event.preventDefault();
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      offsetX: dragOffset.x,
      offsetY: dragOffset.y,
      rect: panelRef.current.getBoundingClientRect(),
    };
  };
  const panelStyle = layout === 'overlay'
    ? { position: 'fixed', left: '50%', top: '50%', transform: `translate(-50%, -50%) translate(${dragOffset.x}px, ${dragOffset.y}px)`, zIndex: 12 }
    : layout === 'split'
      ? { transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` }
      : { transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` };
  return (
    <div className={'call-shell call-shell-' + layout}>
      <section ref={panelRef} className="call-panel" aria-label="Call" style={panelStyle} onPointerDown={handleDragStart}>
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
        <div className={'call-stage' + (callState.kind === 'audio' ? ' audio-stage' : callState.kind === 'video' ? ' video-stage' : '')}>
          {callState.kind === 'video' ? <>
            <div className="call-video-tile">
              {!remoteStream && <span className="call-video-placeholder">{label}</span>}
              <video ref={remoteRef} autoPlay playsInline className="remote-video" aria-label={`${callState.peerName} video`} />
              <span className="call-video-name">{callState.peerName}</span>
            </div>
            <div className="call-video-tile">
              {localStream && videoEnabled
                ? <video ref={localRef} autoPlay muted playsInline className="local-video" aria-label="Your video" />
                : <span className="call-video-placeholder">{videoEnabled ? 'Starting camera…' : 'Camera off'}</span>}
              <span className="call-video-name">You</span>
            </div>
          </> : <video ref={remoteRef} autoPlay playsInline className="remote-video" />}
          {callState.kind === 'audio' && <div className="audio-label">{callState.peerName}</div>}
        </div>
        <footer>
          {layout === 'minimized' ? <>
            <span className="call-mini-status">{label}</span>
            {!callState.incoming && <>
              <button className={'call-control' + (audioEnabled ? '' : ' disabled')} title={audioEnabled ? 'Mute microphone' : 'Unmute microphone'} aria-label={audioEnabled ? 'Mute microphone' : 'Unmute microphone'} onClick={onToggleAudio}>{audioEnabled ? 'Mic on' : 'Mic off'}</button>
              <button className={'call-control' + (noiseCancellation ? '' : ' disabled')} aria-pressed={noiseCancellation} title={noiseCancellation ? 'Turn noise cancellation off' : 'Turn noise cancellation on'} onClick={onToggleNoiseCancellation}>Noise cancel {noiseCancellation ? 'on' : 'off'}</button>
            </>}
            {callState.incoming ? <button className="btn" onClick={onAccept}>Answer</button> : <button className="btn danger" onClick={onHangup}>End</button>}
          </> : callState.incoming ? <>
            <button className="btn" onClick={onAccept}>Answer</button>
            <button className="btn danger" onClick={onDecline}>Decline</button>
          </> : <>
            <span className={'call-network-quality quality-' + networkQuality.toLowerCase()} role="status">Network: {networkQuality}</span>
            <button className={'call-control' + (audioEnabled ? '' : ' disabled')} title={audioEnabled ? 'Mute microphone' : 'Unmute microphone'} aria-label={audioEnabled ? 'Mute microphone' : 'Unmute microphone'} onClick={onToggleAudio}>{audioEnabled ? 'Mic on' : 'Mic off'}</button>
            <button className={'call-control' + (noiseCancellation ? '' : ' disabled')} aria-pressed={noiseCancellation} title={noiseCancellation ? 'Turn noise cancellation off' : 'Turn noise cancellation on'} onClick={onToggleNoiseCancellation}>Noise cancel {noiseCancellation ? 'on' : 'off'}</button>
            {callState.kind === 'video' && <>
              <button className={'call-control' + (videoEnabled ? '' : ' disabled')} title={videoEnabled ? 'Turn camera off' : 'Turn camera on'} aria-label={videoEnabled ? 'Turn camera off' : 'Turn camera on'} onClick={onToggleVideo}>{videoEnabled ? 'Camera on' : 'Camera off'}</button>
              <button className="call-control" title="Switch camera" aria-label="Switch camera" onClick={onSwitchCamera} disabled={cameraSwitching}>{cameraSwitching ? 'Switching…' : 'Flip camera'}</button>
            </>}
            <button className="btn danger" onClick={onHangup}>End call</button>
          </>}
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
          {hits.map(u => <button key={u.id} className="row" onClick={() => start(u.username)}><Avatar name={u.username} avatarPath={u.avatarPath} /><div><b>{u.username}</b><small>{u.email}</small></div></button>)}
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

function AdminUsers({ token, currentUserId, onClose }) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let current = true;
    const timeout = window.setTimeout(() => {
      setLoading(true); setError(''); setSelected(null);
      call(`/admin/users?q=${encodeURIComponent(query)}`, token).then(result => {
        if (!current) return;
        setUsers(result.users); setTotal(result.total);
      }).catch(requestError => {
        if (current) setError(requestError.message);
      }).finally(() => {
        if (current) setLoading(false);
      });
    }, 200);
    return () => { current = false; window.clearTimeout(timeout); };
  }, [query, token]);
  const loadMore = async () => {
    setLoadingMore(true); setError('');
    try {
      const result = await call(`/admin/users?q=${encodeURIComponent(query)}&offset=${users.length}`, token);
      setUsers(current => [...current, ...result.users]); setTotal(result.total);
    } catch (requestError) { setError(requestError.message); }
    finally { setLoadingMore(false); }
  };
  const deleteSelected = async () => {
    if (!selected || deleting) return;
    const confirmed = window.confirm(
      `Permanently delete @${selected.username} and their account data? This removes their chats, messages, and attachments for everyone in those chats, friendships, activity posts, calls, location shares, devices, and profile. This cannot be undone.`,
    );
    if (!confirmed) return;
    setDeleting(true);
    setError('');
    setNotice('');
    try {
      const result = await call(`/admin/users/${encodeURIComponent(selected.id)}`, token, 'DELETE');
      setUsers(current => current.filter(user => user.id !== selected.id));
      setTotal(current => Math.max(0, current - 1));
      setSelected(null);
      if (result.mediaCleanupWarning) setNotice(`Account deleted. ${result.mediaCleanupWarning}.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setDeleting(false);
    }
  };
  const created = selected?.created ? new Date(selected.created).toLocaleString() : 'Not available';
  return (
    <div className="modal" onClick={onClose}>
      <section className="sheet admin-users-sheet" onClick={event => event.stopPropagation()}>
        <div className="admin-users-heading">
          {selected && <button className="admin-profile-back" onClick={() => setSelected(null)}>← Users</button>}
          <h3>{selected ? 'User profile' : 'Users'}</h3>
        </div>
        {selected ? (
          <div className="admin-user-profile">
            <Avatar name={selected.username} />
            <h4>@{selected.username}</h4>
            {error && <p className="err">{error}</p>}
            <dl>
              <div><dt>Email</dt><dd>{selected.email}</dd></div>
              <div><dt>Account type</dt><dd>{selected.role}</dd></div>
              <div><dt>Email verified</dt><dd>{selected.verified ? 'Yes' : 'No'}</dd></div>
              <div><dt>Account created</dt><dd>{created}</dd></div>
            </dl>
            {selected.id === currentUserId ? (
              <p className="muted">You cannot delete the account you are currently using.</p>
            ) : (
              <button className="btn danger" onClick={deleteSelected} disabled={deleting}>
                {deleting ? 'Deleting account…' : 'Permanently delete account'}
              </button>
            )}
          </div>
        ) : <>
          <input className="search admin-user-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by username or email" />
          {error && <p className="err">{error}</p>}
          {notice && <p className="notice">{notice}</p>}
          <div className="admin-user-list">
            {!loading && !error && users.map(user => (
              <button key={user.id} className="row admin-user-row" onClick={() => setSelected(user)}>
                <Avatar name={user.username} avatarPath={user.avatarPath} />
                <div className="grow"><b>{user.username}</b><small>{user.email}</small></div>
                <span className="admin-user-role">{user.role}</span>
              </button>
            ))}
            {!loading && !error && !users.length && <p className="muted pad">No users found.</p>}
            {loading && <p className="muted pad">Loading users…</p>}
          </div>
          {!loading && users.length < total && <button className="btn ghost" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Load more users'}
          </button>}
          {!loading && !error && <small className="admin-user-count">Showing {users.length} of {total}</small>}
        </>}
        <button className="btn ghost" onClick={onClose}>Close</button>
      </section>
    </div>
  );
}

function ProfileSettings({ me, token, onClose, onUpdated }) {
  const [username, setUsername] = useState(me.username);
  const [email, setEmail] = useState(me.email);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [picture, setPicture] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState('');
  const selectPicture = event => {
    const file = event.target.files?.[0] || null;
    setError('');
    setNotice('');
    if (file && (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) || file.size > 5 * 1024 * 1024)) {
      setError('Choose a JPEG, PNG, WebP, or GIF image under 5 MB.');
      event.target.value = '';
      return;
    }
    setPicture(file);
    setPreview(file ? URL.createObjectURL(file) : '');
  };
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const save = async event => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      let updated = await call('/me/profile', token, 'PATCH', { username, email, currentPassword, newPassword });
      onUpdated(updated);
      if (picture) {
        const response = await fetch(`${API}/api/me/avatar`, {
          method: 'PUT',
          headers: {
            Authorization: 'Bearer ' + token,
            'Content-Type': picture.type,
            'X-File-Type': picture.type,
            'X-File-Name': encodeURIComponent(picture.name),
          },
          body: picture,
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || `Profile picture upload failed (${response.status})`);
        updated = result;
        onUpdated(updated);
        setPicture(null);
        setPreview('');
      }
      setCurrentPassword('');
      setNewPassword('');
      setNotice('Profile updated.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="modal" onClick={() => { if (!saving) onClose(); }}>
      <form className="sheet profile-sheet" onClick={event => event.stopPropagation()} onSubmit={save}>
        <div className="profile-heading"><h3>Profile settings</h3><button type="button" aria-label="Close profile settings" disabled={saving} onClick={onClose}>×</button></div>
        <div className="profile-picture-setting">
          <div className="avatar profile-avatar">
            {(preview || me.avatarPath) && <img src={preview || (API + me.avatarPath)} alt="" onError={event => { event.currentTarget.style.display = 'none'; }} />}
            <span>{(username || '?')[0].toUpperCase()}</span>
          </div>
          <label className="profile-picture-label">Profile picture
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={selectPicture} disabled={saving} />
            <small>JPEG, PNG, WebP, or GIF; up to 5 MB</small>
          </label>
        </div>
        <label>Username<input value={username} onChange={event => setUsername(event.target.value)} minLength={3} maxLength={20} required disabled={saving} /></label>
        <label>Email<input type="email" value={email} onChange={event => setEmail(event.target.value)} required disabled={saving} /></label>
        <p className="muted profile-password-note">Leave password fields empty to keep your current password.</p>
        <label>Current password<input type="password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} autoComplete="current-password" disabled={saving} /></label>
        <label>New password<input type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} minLength={8} autoComplete="new-password" disabled={saving} /></label>
        {error && <p className="err">{error}</p>}
        {notice && <p className="notice">{notice}</p>}
        <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
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
            <Avatar name={item.other.username} avatarPath={item.other.avatarPath} />
            <div className="grow"><b>{item.other.username}</b><small>{item.direction === 'incoming' ? 'Incoming' : 'Outgoing'} {item.kind} · {label(item)}</small></div>
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
  const [publicConfig, setPublicConfig] = useState({ allowPublicSignUp: true, emailVerificationEnabled: false, vapidPublicKey: null, pushNotificationsEnabled: false, mediaEnabled: false });
  const [adminModal, setAdminModal] = useState(false), [adminUsersOpen, setAdminUsersOpen] = useState(false), [callsOpen, setCallsOpen] = useState(false), [locationModal, setLocationModal] = useState(false), [profileOpen, setProfileOpen] = useState(false), [linkedDevicesOpen, setLinkedDevicesOpen] = useState(false);
  const [chats, setChats] = useState([]), [active, setActive] = useState(null), [messages, setMessages] = useState([]);
  const [activeView, setActiveView] = useState('chats'), [activityPosts, setActivityPosts] = useState([]);
  const [activityText, setActivityText] = useState(''), [activityFiles, setActivityFiles] = useState([]);
  const [activityError, setActivityError] = useState(''), [activityLoading, setActivityLoading] = useState(false), [postingActivity, setPostingActivity] = useState(false);
  const [activityUploadProgress, setActivityUploadProgress] = useState({});
  const [activityComposerOpen, setActivityComposerOpen] = useState(false);
  const [friendData, setFriendData] = useState({ friends: [], incoming: [], outgoing: [] });
  const [friendPanel, setFriendPanel] = useState('');
  const [friendQuery, setFriendQuery] = useState('');
  const [friendSearchResults, setFriendSearchResults] = useState([]);
  const [friendError, setFriendError] = useState('');
  const [friendActionId, setFriendActionId] = useState('');
  const [text, setText] = useState(''), [replyingTo, setReplyingTo] = useState(null), [modal, setModal] = useState(false), [filter, setFilter] = useState('');
  const [attachedFiles, setAttachedFiles] = useState([]), [composeError, setComposeError] = useState('');
  const [uploadState, setUploadState] = useState({});
  const [isSending, setIsSending] = useState(false);
  const [locationShares, setLocationShares] = useState([]), [locationError, setLocationError] = useState('');
  const [pushError, setPushError] = useState('');
  const [notificationPromptOpen, setNotificationPromptOpen] = useState(false), [configLoaded, setConfigLoaded] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [callState, setCallState] = useState(null), [localStream, setLocalStream] = useState(null), [remoteStream, setRemoteStream] = useState(null), [peerConnection, setPeerConnection] = useState(null);
  const [audioEnabled, setAudioEnabled] = useState(true), [videoEnabled, setVideoEnabled] = useState(true), [noiseCancellation, setNoiseCancellation] = useState(true);
  const [cameraSwitching, setCameraSwitching] = useState(false);
  const [cameraFacing, setCameraFacing] = useState('user');
  const [callLayout, setCallLayout] = useState('overlay');
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const endRef = useRef(), fileInputRef = useRef(), activityInputRef = useRef(), activeRef = useRef(), activeViewRef = useRef(activeView), socketRef = useRef(), peerRef = useRef(), localStreamRef = useRef(), callRef = useRef(), pendingCandidatesRef = useRef([]), locationWatchRef = useRef(null), locationTimerRef = useRef(null), lastLocationUpdateRef = useRef(0);
  const backStateRef = useRef(null);
  activeRef.current = active;
  activeViewRef.current = activeView;
  callRef.current = callState;
  backStateRef.current = { active, activeView, adminModal, adminUsersOpen, callsOpen, locationModal, profileOpen, linkedDevicesOpen, modal, activityComposerOpen, friendPanel, notificationPromptOpen };
  const token = auth?.token, me = auth?.user;
  const sendingRef = useRef(false);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-color-scheme: dark)');
    const updateBrowserTheme = event => {
      const themeColor = document.querySelector('meta[name="theme-color"]');
      if (themeColor) themeColor.content = event.matches ? '#101714' : '#053215';
    };
    updateBrowserTheme(preference);
    preference.addEventListener('change', updateBrowserTheme);
    return () => preference.removeEventListener('change', updateBrowserTheme);
  }, []);
  const stopLocationTracking = () => {
    if (locationWatchRef.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(locationWatchRef.current);
    if (locationTimerRef.current !== null) window.clearTimeout(locationTimerRef.current);
    locationWatchRef.current = null; locationTimerRef.current = null;
  };
  const logout = () => { stopLocationTracking(); localStorage.removeItem('nepa'); setAuth(null); setChats([]); setActive(null); setLocationShares([]); };
  const onAuth = d => { localStorage.setItem('nepa', JSON.stringify(d)); setAuth(d); };
  const onProfileUpdated = user => setAuth(current => {
    if (!current) return current;
    const updated = { ...current, user };
    localStorage.setItem('nepa', JSON.stringify(updated));
    return updated;
  });
  const refreshFriendData = () => call('/friends', token).then(setFriendData);

  useEffect(() => {
    if (!token || !me?.id) return;
    call('/devices/current', token, 'POST', { deviceId: getDeviceId(), deviceName: getDeviceName() })
      .then(session => {
        if (session.token) onAuth(session);
      })
      .catch(error => {
        if (error.status === 401) {
          localStorage.removeItem('nepa');
          setAuth(null);
        } else {
          console.error('Unable to register this device session:', error);
        }
      });
  }, [token]);

  useEffect(() => {
    call('/config').then(config => {
      setPublicConfig(config);
      if (new URLSearchParams(window.location.search).has('callHistory')) setCallsOpen(true);
      const notificationTarget = new URLSearchParams(window.location.search).get('notifications');
      if (notificationTarget === 'friends') {
        setActiveView('activity');
        setFriendPanel('requests');
      } else if (notificationTarget === 'activity') {
        setActiveView('activity');
      }
    }).catch(() => {}).finally(() => setConfigLoaded(true));
  }, []);
  useEffect(() => {
    if (!auth?.user?.id || !configLoaded || !publicConfig.pushNotificationsEnabled || !publicConfig.vapidPublicKey) return;
    const promptKey = `nepachat-notifications-asked:${auth.user.id}`;
    if (localStorage.getItem(promptKey)) return;
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window) || Notification.permission === 'denied') {
      localStorage.setItem(promptKey, '1');
      return;
    }
    if (Notification.permission === 'granted') {
      navigator.serviceWorker.ready.then(registration => registration.pushManager.getSubscription()).then(subscription => {
        if (subscription) {
          localStorage.setItem(promptKey, '1');
        } else {
          setNotificationPromptOpen(true);
        }
      }).catch(error => console.error('Unable to check device notification subscription:', error));
      return;
    }
    setNotificationPromptOpen(true);
  }, [auth?.user?.id, configLoaded, publicConfig.pushNotificationsEnabled, publicConfig.vapidPublicKey]);
  useEffect(() => {
    if (!auth) return;
    const pushBackGuard = () => {
      window.history.pushState({ nepachatBackGuard: true }, '', window.location.href);
    };
    if (!window.history.state?.nepachatBackGuard) pushBackGuard();
    const handleBackNavigation = () => {
      const state = backStateRef.current;
      if (state?.activityComposerOpen) setActivityComposerOpen(false);
      else if (state?.notificationPromptOpen) dismissNotificationPrompt();
      else if (state?.locationModal) setLocationModal(false);
      else if (state?.profileOpen) setProfileOpen(false);
      else if (state?.adminUsersOpen) setAdminUsersOpen(false);
      else if (state?.adminModal) setAdminModal(false);
      else if (state?.callsOpen) setCallsOpen(false);
      else if (state?.linkedDevicesOpen) setLinkedDevicesOpen(false);
      else if (state?.modal) setModal(false);
      else if (state?.friendPanel) setFriendPanel('');
      else if (state?.active) setActive(null);
      else if (state?.activeView === 'activity') setActiveView('chats');
      pushBackGuard();
    };
    window.addEventListener('popstate', handleBackNavigation);
    return () => window.removeEventListener('popstate', handleBackNavigation);
  }, [Boolean(auth)]);
  const addAlert = (message, kind = 'info') => {
    const next = { id: `${Date.now()}-${Math.random()}`, message, kind };
    setAlerts(current => [...current, next]);
    window.setTimeout(() => setAlerts(current => current.filter(item => item.id !== next.id)), 4000);
  };
  const showSystemNotification = (title, options = {}) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => registration.showNotification(title, {
        body: options.body || '',
        icon: options.icon || '/icon.svg',
        badge: options.icon || '/icon.svg',
        tag: options.tag || undefined,
        requireInteraction: Boolean(options.requireInteraction),
        data: { url: options.url || '/', focusOnly: Boolean(options.onClick) },
      })).catch(error => console.error('Unable to show device notification:', error));
      return;
    }
    const notification = new Notification(title, { body: options.body || '', tag: options.tag || undefined });
    notification.onclick = () => {
      window.focus();
      if (options.onClick) options.onClick();
      else window.location.assign(options.url || '/');
      notification.close();
    };
  };
  const enableNotifications = async () => {
    setPushError('');
    try {
      if (!('Notification' in window)) throw new Error('Notifications are not supported in this browser');
      if (!publicConfig.pushNotificationsEnabled || !publicConfig.vapidPublicKey) throw new Error('Device notifications need VAPID keys configured on the API server. See the deployment setup instructions.');
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('Push notifications are not supported in this browser');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Allow notifications in your browser to receive call alerts');
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeVapidKey(publicConfig.vapidPublicKey) });
      await call('/push/subscribe', token, 'POST', { subscription: subscription.toJSON() });
      localStorage.setItem(`nepachat-notifications-asked:${me.id}`, '1');
      setNotificationPromptOpen(false);
      addAlert('Device notifications enabled', 'success');
    } catch (error) {
      setPushError(error.message);
      addAlert(error.message, 'error');
    }
  };
  const dismissNotificationPrompt = () => {
    if (me?.id) localStorage.setItem(`nepachat-notifications-asked:${me.id}`, '1');
    setNotificationPromptOpen(false);
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
  const uploadAttachment = async (file, chatId, onProgress) => {
    if (!publicConfig.mediaEnabled) throw new Error('Chat media storage is not configured');
    if (!isSupportedAttachment(file)) throw new Error('Only image and video files under 25 MB are supported');
    const fileType = mediaTypeFromFile(file);
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('PUT', `${API}${chatId ? `/api/chats/${chatId}/uploads` : '/api/activity/uploads'}`);
      request.timeout = 120000;
      request.setRequestHeader('Authorization', 'Bearer ' + token);
      request.setRequestHeader('Content-Type', fileType);
      request.setRequestHeader('X-File-Type', fileType);
      request.setRequestHeader('X-File-Name', encodeURIComponent(file.name || 'attachment'));
      request.upload.onprogress = event => {
        if (event.lengthComputable) {
          const progress = Math.round(event.loaded / event.total * 100);
          if (onProgress) onProgress(progress);
          else setUploadState(current => ({
            ...current,
            [attachmentKey(file)]: { ...current[attachmentKey(file)], status: 'uploading', progress },
          }));
        }
      };
      request.onerror = () => reject(new Error('Upload failed. Check your connection and try again.'));
      request.onabort = () => reject(new Error('Upload was cancelled.'));
      request.ontimeout = () => reject(new Error('Upload timed out. Check your connection and try again.'));
      request.onload = () => {
        let data = {};
        try { data = JSON.parse(request.responseText || '{}'); } catch { /* handled as a failed response below */ }
        if (request.status < 200 || request.status >= 300) {
          const message = request.status === 404
            ? 'The API server is missing the upload endpoint. Redeploy the latest server code, then try again.'
            : data.error || `Upload failed (${request.status || 'network error'})`;
          reject(new Error(message));
          return;
        }
        if (!data.attachment) {
          reject(new Error('Upload completed without an attachment response.'));
          return;
        }
        resolve(data.attachment);
      };
      request.send(file);
    });
  };
  const showCallHistory = () => {
    setCallsOpen(true);
    if (new URLSearchParams(window.location.search).has('callHistory')) history.replaceState(null, '', window.location.pathname);
  };
  const clearCall = () => {
    peerRef.current?.close(); peerRef.current = null;
    localStreamRef.current?.getTracks().forEach(track => track.stop()); localStreamRef.current = null;
    pendingCandidatesRef.current = []; setLocalStream(null); setRemoteStream(null); setPeerConnection(null); setCallState(null); setCallLayout('overlay'); setAudioEnabled(true); setVideoEnabled(true); setNoiseCancellation(true); setCameraSwitching(false); setCameraFacing('user'); callRef.current = null;
  };
  const endCall = reason => {
    const current = callRef.current;
    if (current) socketRef.current?.emit('call:end', { chatId: current.chatId, callId: current.callId, reason });
    clearCall();
  };

  const attachPeer = (peer, current) => {
    peerRef.current = peer;
    setPeerConnection(peer);
    peer.ontrack = event => setRemoteStream(event.streams[0]);
    peer.onicecandidate = event => {
      if (event.candidate) socketRef.current?.emit('call:signal', { chatId: current.chatId, callId: current.callId, signal: { type: 'candidate', candidate: event.candidate.toJSON() } });
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'connected') setCallState(c => c ? { ...c, status: 'active' } : c);
      if (peer.connectionState === 'failed') setCallState(c => c ? { ...c, error: 'Connection failed. Check your network or TURN server settings.' } : c);
    };
    peer.oniceconnectionstatechange = () => {
      if (peer.iceConnectionState === 'disconnected') setCallState(c => c ? { ...c, status: 'reconnecting' } : c);
      if (peer.iceConnectionState === 'connected' || peer.iceConnectionState === 'completed') setCallState(c => c ? { ...c, status: 'active' } : c);
      if (peer.iceConnectionState === 'failed') setCallState(c => c ? { ...c, status: 'failed', error: 'Could not connect. Check your network or TURN server settings, then try calling again.' } : c);
    };
  };

  const toggleAudio = () => {
    const tracks = localStreamRef.current?.getAudioTracks() || [];
    if (!tracks.length) {
      setCallState(current => current ? { ...current, error: 'Microphone track is unavailable. End the call and try again.' } : current);
      return;
    }
    const enabled = !tracks.some(track => track.enabled);
    tracks.forEach(track => { track.enabled = enabled; });
    setAudioEnabled(enabled);
  };

  const toggleVideo = () => {
    const tracks = localStreamRef.current?.getVideoTracks() || [];
    if (!tracks.length) {
      setCallState(current => current ? { ...current, error: 'Camera track is unavailable. End the call and try again.' } : current);
      return;
    }
    const enabled = !tracks.some(track => track.enabled);
    tracks.forEach(track => { track.enabled = enabled; });
    setVideoEnabled(enabled);
  };

  const toggleNoiseCancellation = async () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track || track.readyState !== 'live') {
      setCallState(current => current ? { ...current, error: 'Microphone track is unavailable. End the call and try again.' } : current);
      return;
    }
    const enabled = !noiseCancellation;
    const supported = navigator.mediaDevices.getSupportedConstraints?.() || {};
    const constraints = {};
    if (supported.noiseSuppression) constraints.noiseSuppression = enabled;
    if (supported.echoCancellation) constraints.echoCancellation = enabled;
    if (supported.autoGainControl) constraints.autoGainControl = enabled;
    if (!Object.keys(constraints).length) {
      setCallState(current => current ? { ...current, error: 'Noise cancellation controls are not supported by this browser.' } : current);
      return;
    }
    try {
      await track.applyConstraints(constraints);
      setNoiseCancellation(enabled);
      setCallState(current => current ? { ...current, error: '' } : current);
    } catch (error) {
      setCallState(current => current ? {
        ...current,
        error: error.message || 'Unable to change microphone noise cancellation on this device.',
      } : current);
    }
  };

  const switchCamera = async () => {
    const current = callRef.current;
    const stream = localStreamRef.current;
    if (!current || current.kind !== 'video' || !stream || cameraSwitching) return;
    let replacement;
    setCameraSwitching(true);
    try {
      const targetFacing = cameraFacing === 'user' ? 'environment' : 'user';
      const oldTrack = stream.getVideoTracks()[0];
      if (!oldTrack || oldTrack.readyState !== 'live') throw new Error('Camera track is unavailable. End the call and try again.');
      let targetDevice;
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(device => device.kind === 'videoinput');
        const currentDeviceId = oldTrack.getSettings().deviceId;
        const matchingCamera = cameras.find(device => {
          if (!device.deviceId || device.deviceId === currentDeviceId) return false;
          return targetFacing === 'environment'
            ? /(back|rear|environment|world)/i.test(device.label)
            : /(front|user|facetime)/i.test(device.label);
        });
        targetDevice = matchingCamera || cameras.find(device => device.deviceId && device.deviceId !== currentDeviceId);
      } catch (error) {
        console.warn('Unable to enumerate cameras; trying the requested facing mode:', error);
      }
      try {
        replacement = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: targetDevice
            ? { deviceId: { exact: targetDevice.deviceId } }
            : { facingMode: { ideal: targetFacing } },
        });
      } catch (deviceError) {
        replacement?.getTracks().forEach(track => track.stop());
        replacement = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: targetFacing } },
        });
        if (replacement.getVideoTracks()[0]?.getSettings().deviceId === oldTrack.getSettings().deviceId) {
          throw new Error(deviceError.message || 'A different camera is not available on this device.');
        }
      }
      const nextTrack = replacement.getVideoTracks()[0];
      const sender = peerRef.current?.getSenders().find(item => item.track?.kind === 'video');
      if (!nextTrack || !sender || !oldTrack) throw new Error('The other camera could not be selected.');
      nextTrack.enabled = videoEnabled;
      await sender.replaceTrack(nextTrack);
      const nextStream = new MediaStream([...stream.getAudioTracks(), nextTrack]);
      localStreamRef.current = nextStream;
      oldTrack.stop();
      setLocalStream(nextStream);
      const actualFacing = nextTrack.getSettings().facingMode;
      setCameraFacing(actualFacing === 'user' || actualFacing === 'environment' ? actualFacing : targetFacing);
      setCallState(value => value ? { ...value, error: '' } : value);
    } catch (error) {
      replacement?.getTracks().forEach(track => track.stop());
      setCallState(value => value ? {
        ...value,
        error: error.name === 'NotAllowedError'
          ? 'Allow camera access to switch cameras.'
          : error.message || 'Unable to switch camera on this device.',
      } : value);
    } finally {
      setCameraSwitching(false);
    }
  };

  const startCall = async kind => {
    if (!active || !socketRef.current || callRef.current) return;
    try {
      const { iceServers } = await call('/calls/ice-servers', token);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: kind === 'video' ? { facingMode: { ideal: 'user' } } : false,
      });
      if (kind === 'video') setCameraFacing(stream.getVideoTracks()[0]?.getSettings().facingMode || 'user');
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
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: current.kind === 'video' ? { facingMode: { ideal: 'user' } } : false,
      });
      if (current.kind === 'video') setCameraFacing(stream.getVideoTracks()[0]?.getSettings().facingMode || 'user');
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
    let lastVisibleRefresh = 0;
    const refreshVisibleData = () => {
      if (Date.now() - lastVisibleRefresh < 1000) return;
      lastVisibleRefresh = Date.now();
      call('/chats', token).then(setChats).catch(error => {
        if (error.status === 401) logout();
        else console.error('Unable to refresh chats:', error);
      });
      const currentChat = activeRef.current;
      if (currentChat) {
        call(`/chats/${currentChat.id}/messages`, token).then(list => {
          if (activeRef.current?.id !== currentChat.id) return;
          setMessages(list);
          for (const message of list) {
            if (message.from === me.id) continue;
            socketRef.current?.emit('message:delivered', { chatId: currentChat.id, messageId: message.id });
            socketRef.current?.emit('message:read', { chatId: currentChat.id, messageId: message.id });
          }
        }).catch(error => console.error('Unable to refresh messages:', error));
        call(`/chats/${currentChat.id}/location-shares`, token).then(shares => {
          if (activeRef.current?.id !== currentChat.id) return;
          setLocationShares(current => [
            ...current.filter(item => item.chatId !== currentChat.id),
            ...shares,
          ]);
        }).catch(error => console.error('Unable to refresh location shares:', error));
      }
      if (activeViewRef.current === 'activity') {
        call('/activity/posts', token).then(posts => {
          if (activeViewRef.current === 'activity') setActivityPosts(posts);
        }).catch(error => console.error('Unable to refresh activity:', error));
        refreshFriendData().catch(error => console.error('Unable to refresh friend requests:', error));
      }
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refreshVisibleData();
    };
    call('/me', token).then(user => setAuth(current => {
      if (!current || current.user.role === user.role) return current;
      const updated = { ...current, user };
      localStorage.setItem('nepa', JSON.stringify(updated));
      return updated;
    })).catch(e => e.status === 401 && logout());
    call('/chats', token).then(list => {
      setChats(list);
      const chatId = new URLSearchParams(window.location.search).get('chat');
      const targetChat = chatId && list.find(item => item.id === chatId);
      if (targetChat) {
        setActiveView('chats');
        setActive(targetChat);
        history.replaceState(null, '', window.location.pathname);
      }
    }).catch(e => e.status === 401 && logout());
    window.addEventListener('focus', refreshVisibleData);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    const s = io(API || undefined, { auth: { token } });
    socketRef.current = s;
    s.io.on('reconnect', refreshVisibleData);
    s.on('message', ({ chatId, message, chat }) => {
      setChats(c => [chat, ...c.filter(x => x.id !== chatId)]);
      if (message.from !== me.id) {
        s.emit('message:delivered', { chatId, messageId: message.id });
        if (activeRef.current?.id === chatId) s.emit('message:read', { chatId, messageId: message.id });
        addAlert(`New message from @${chat.other.username}`, 'info');
        showSystemNotification(`New message from ${chat.other.username}`, {
          body: message.text || (message.attachments?.length ? 'Shared a photo or video' : 'Sent you a message'),
          tag: `message-${message.id}`,
          url: `/?chat=${encodeURIComponent(chatId)}`,
        });
      }
      if (activeRef.current?.id === chatId) setMessages(m => m.some(x => x.id === message.id) ? m : [...m, message]);
    });
    s.on('message:status', ({ chatId, messageId, status }) => {
      if (activeRef.current?.id !== chatId) return;
      const rank = { sent: 0, delivered: 1, read: 2 };
      setMessages(list => list.map(message => message.id === messageId && rank[status] > rank[message.status || 'sent'] ? { ...message, status } : message));
    });
    s.on('location:update', share => setLocationShares(current => [...current.filter(item => item.id !== share.id), share]));
    s.on('activity:post', post => setActivityPosts(current => [post, ...current.filter(item => item.id !== post.id)].slice(0, 50)));
    s.on('activity:post', post => {
      if (post.author.id !== me.id) {
        showSystemNotification(`New activity from ${post.author.username}`, {
          body: post.text || (post.attachments?.length ? 'Shared a photo or video' : 'Shared a post'),
          tag: `activity-${post.id}`,
          url: '/?notifications=activity',
        });
      }
    });
    s.on('friend:request', request => {
      refreshFriendData().catch(error => console.error('Unable to refresh friend requests:', error));
      showSystemNotification('New friend request', {
        body: `${request.username} wants to connect`,
        tag: `friend-request-${request.id}`,
        url: '/?notifications=friends',
      });
    });
    s.on('friend:accepted', friend => {
      refreshFriendData().catch(error => console.error('Unable to refresh friend data:', error));
      showSystemNotification('Friend request accepted', {
        body: `${friend.username} accepted your request`,
        tag: `friend-accepted-${friend.id}`,
        url: '/?notifications=friends',
      });
    });
    s.on('friend:changed', () => {
      refreshFriendData().catch(error => console.error('Unable to refresh friend requests:', error));
      if (activeViewRef.current === 'activity') {
        call('/activity/posts', token).then(setActivityPosts).catch(error => console.error('Unable to refresh activity after friend update:', error));
      }
    });
    s.on('account:changed', () => {
      call('/chats', token).then(setChats).catch(error => console.error('Unable to refresh chats after account deletion:', error));
      refreshFriendData().catch(error => console.error('Unable to refresh friends after account deletion:', error));
      call('/activity/posts', token).then(setActivityPosts).catch(error => console.error('Unable to refresh activity after account deletion:', error));
    });
    s.on('account:deleted', logout);
    s.on('location:stopped', ({ shareId }) => setLocationShares(current => current.filter(item => item.id !== shareId)));
    s.on('call:incoming', incoming => {
      if (callRef.current) { s.emit('call:end', { chatId: incoming.chatId, callId: incoming.callId, reason: 'declined' }); return; }
      pendingCandidatesRef.current = pendingCandidatesRef.current.filter(item => item.callId === incoming.callId);
      const next = { ...incoming, peerUserId: incoming.from.id, peerName: '@' + incoming.from.username, incoming: true, status: 'incoming' };
      callRef.current = next; setCallState(next); setCallLayout('overlay');
      addAlert(`Incoming ${incoming.kind} call from @${incoming.from.username}`, 'info');
      showSystemNotification(`Incoming ${incoming.kind} call`, {
        body: `@${incoming.from.username} is calling you`,
        tag: `call-${incoming.callId}`,
        requireInteraction: true,
        onClick: () => setCallLayout('overlay'),
      });
    });
    s.on('call:answered-elsewhere', ({ callId }) => {
      if (callRef.current?.callId === callId && callRef.current.incoming) clearCall();
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
    return () => {
      window.removeEventListener('focus', refreshVisibleData);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      s.io.off('reconnect', refreshVisibleData);
      s.close(); socketRef.current = null; clearCall();
    };
  }, [token]);

  useEffect(() => {
    if (activeView !== 'activity' || !token) return;
    let current = true;
    setActivityLoading(true);
    setActivityError('');
    Promise.all([call('/activity/posts', token), refreshFriendData()])
      .then(([posts]) => { if (current) setActivityPosts(posts); })
      .catch(error => { if (current) setActivityError(error.message); })
      .finally(() => { if (current) setActivityLoading(false); });
    return () => { current = false; };
  }, [activeView, token]);

  useEffect(() => {
    if (activeView !== 'activity' || friendPanel !== 'discover' || friendQuery.trim().length < 2) {
      setFriendSearchResults([]);
      return;
    }
    let current = true;
    const timeout = window.setTimeout(() => {
      call('/users/search?q=' + encodeURIComponent(friendQuery.trim()), token)
        .then(results => { if (current) setFriendSearchResults(results); })
        .catch(error => { if (current) setFriendError(error.message); });
    }, 200);
    return () => { current = false; window.clearTimeout(timeout); };
  }, [activeView, friendPanel, friendQuery, token]);

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
  const selectView = view => {
    setActiveView(view);
    setActive(null);
    setIsDraggingFiles(false);
  };
  const sendFriendRequest = async user => {
    setFriendError('');
    setFriendActionId(user.id);
    try {
      await call('/friends/requests', token, 'POST', { to: user.username });
      await refreshFriendData();
    } catch (error) {
      setFriendError(error.message);
      if (error.status === 409) refreshFriendData().catch(refreshError => setFriendError(refreshError.message));
    } finally {
      setFriendActionId('');
    }
  };
  const respondToFriendRequest = async (request, action) => {
    setFriendError('');
    setFriendActionId(request.id);
    try {
      await call(`/friends/requests/${request.id}`, token, 'PATCH', { action });
      await refreshFriendData();
      if (action === 'accept') {
        const posts = await call('/activity/posts', token);
        setActivityPosts(posts);
      }
    } catch (error) {
      setFriendError(error.message);
    } finally {
      setFriendActionId('');
    }
  };
  const selectActivityFiles = fileList => {
    const incoming = Array.from(fileList || []);
    const chosen = incoming.filter(isSupportedAttachment).slice(0, 5 - activityFiles.length);
    if (!publicConfig.mediaEnabled) {
      setActivityError('Media storage is not configured.');
      return;
    }
    if (!chosen.length && incoming.length) {
      setActivityError('Choose image or video files under 25 MB (up to 5 per post).');
      return;
    }
    setActivityError('');
    setActivityFiles(current => [...current, ...chosen]);
  };
  const publishActivity = async () => {
    if (postingActivity) return;
    const text = activityText.trim();
    const files = activityFiles.slice();
    if ((!text && !files.length) || text.length > 2000) {
      setActivityError(text.length > 2000 ? 'Post text must be under 2,000 characters.' : 'Write something or add a photo/video.');
      return;
    }
    setPostingActivity(true);
    setActivityError('');
    try {
      const attachments = await Promise.all(files.map(async file => {
        const key = attachmentKey(file);
        setActivityUploadProgress(current => ({ ...current, [key]: 0 }));
        const attachment = await uploadAttachment(file, null, progress => setActivityUploadProgress(current => ({ ...current, [key]: progress })));
        setActivityUploadProgress(current => ({ ...current, [key]: 100 }));
        return attachment;
      }));
      const post = await call('/activity/posts', token, 'POST', { text, attachments });
      setActivityPosts(current => [post, ...current.filter(item => item.id !== post.id)].slice(0, 50));
      setActivityText('');
      setActivityFiles([]);
      setActivityUploadProgress({});
      setActivityComposerOpen(false);
    } catch (error) {
      setActivityError(error.message || 'Unable to publish this post.');
    } finally {
      setPostingActivity(false);
    }
  };
  const handleFilesSelected = fileList => {
    if (sendingRef.current) {
      setComposeError('Wait for the current message to finish sending before adding files.');
      return;
    }
    if (!publicConfig.mediaEnabled) {
      setComposeError('Chat media storage is not configured.');
      return;
    }
    const incoming = Array.from(fileList || []);
    const chosen = [];
    const seen = new Set(attachedFiles.map(attachmentKey));
    let rejected = 0;
    for (const file of incoming) {
      if (!isSupportedAttachment(file)) { rejected++; continue; }
      const key = attachmentKey(file);
      if (seen.has(key)) continue;
      seen.add(key);
      chosen.push(file);
      if (chosen.length + attachedFiles.length >= 5) break;
    }
    if (!chosen.length) {
      setComposeError(rejected ? 'Choose image or video files under 25 MB.' : 'You can attach up to 5 files to a message.');
      return;
    }
    setComposeError(rejected ? 'Some files were skipped. Choose image or video files under 25 MB.' : '');
    setAttachedFiles(current => [...current, ...chosen]);
    setUploadState(current => {
      const next = { ...current };
      for (const file of chosen) next[attachmentKey(file)] = { status: 'queued' };
      return next;
    });
  };
  const handleFileDragEnter = event => {
    if (Array.from(event.dataTransfer.types).includes('Files')) {
      event.preventDefault();
      setIsDraggingFiles(true);
    }
  };
  const handleFileDrop = event => {
    if (!Array.from(event.dataTransfer.types).includes('Files')) return;
    event.preventDefault();
    setIsDraggingFiles(false);
    if (activeView === 'activity') selectActivityFiles(event.dataTransfer.files);
    else handleFilesSelected(event.dataTransfer.files);
  };
  const send = async () => {
    const t = text.trim(), files = attachedFiles.slice(), chat = active;
    if ((!t && !files.length) || !chat || sendingRef.current) return;
    sendingRef.current = true;
    setIsSending(true);
    const payload = { text: t, attachments: [], replyTo: replyingTo?.id || null };
    setText(''); setReplyingTo(null); setComposeError('');
    try {
      const results = await Promise.allSettled(files.map(async file => {
        const key = attachmentKey(file);
        const cached = uploadState[key];
        if (cached?.status === 'done' && cached.attachment) return cached.attachment;
        setUploadState(current => ({ ...current, [key]: { status: 'uploading', progress: 0 } }));
        try {
          const attachment = await uploadAttachment(file, chat.id);
          setUploadState(current => ({ ...current, [key]: { status: 'done', progress: 100, attachment } }));
          return attachment;
        } catch (error) {
          setUploadState(current => ({ ...current, [key]: { status: 'error', message: error.message } }));
          throw error;
        }
      }));
      const failedUpload = results.find(result => result.status === 'rejected');
      if (failedUpload) throw failedUpload.reason;
      payload.attachments = results.map(result => result.value);
      await call(`/chats/${chat.id}/messages`, token, 'POST', payload);
      setAttachedFiles([]);
      setUploadState({});
    } catch (error) {
      setText(t);
      setAttachedFiles(files);
      setReplyingTo(replyingTo);
      setComposeError(error.message);
    } finally {
      sendingRef.current = false;
      setIsSending(false);
    }
  };

  if (!auth) return <Auth onAuth={onAuth} allowPublicSignUp={publicConfig.allowPublicSignUp} emailVerificationEnabled={publicConfig.emailVerificationEnabled} />;
  const shown = chats.filter(c => (c.other.username + c.other.email).includes(filter.toLowerCase()));
  const visibleLocationShares = active ? locationShares.filter(share => share.chatId === active.id) : [];
  return (
    <div className={'app' + (active || activeView === 'activity' ? ' open' : '')}>
      <header className="top">
        <b>Nepa<span>Chat</span></b>
        <div className="grow" />
        <small>@{me.username}</small>
        <button className="hbtn" title="Profile settings" aria-label="Profile settings" onClick={() => setProfileOpen(true)}>⚙</button>
        {me.role === 'admin' && <button className="hbtn" title="View users" aria-label="View users" onClick={() => setAdminUsersOpen(true)}>♙</button>}
        {me.role === 'admin' && <button className="hbtn" title="Create account" aria-label="Create account" onClick={() => setAdminModal(true)}>＋</button>}
        <button className="hbtn" title="Call history" aria-label="Call history" onClick={showCallHistory}>◷</button>
        <button className="hbtn" title="Linked devices" aria-label="Linked devices" onClick={() => setLinkedDevicesOpen(true)}>▣</button>
        <button className="hbtn" title="New chat" onClick={() => setModal(true)}>＋</button>
        <button className="hbtn" title="Sign out" onClick={logout}>⎋</button>
      </header>
      <aside className="side">
        <nav className="side-nav" aria-label="Main navigation">
          <button className={activeView === 'chats' ? 'selected' : ''} onClick={() => selectView('chats')}>Chats</button>
          <button className={activeView === 'activity' ? 'selected' : ''} onClick={() => selectView('activity')}>Activity</button>
        </nav>
        {activeView === 'chats' && <>
          <input className="search" placeholder="Search chats" value={filter} onChange={e => setFilter(e.target.value)} />
          <div className="list">
            {!shown.length && <p className="muted pad">No chats yet. Tap ＋ to start one.</p>}
            {shown.map(c => (
              <button key={c.id} className={'row' + (active?.id === c.id ? ' on' : '')} onClick={() => { setActiveView('chats'); setActive(c); }}>
                <Avatar name={c.other.username} avatarPath={c.other.avatarPath} />
                <div className="grow"><b>{c.other.username}</b><small>{c.last ? (c.by === me.id ? 'You: ' : '') + c.last : 'Say hello 👋'}</small></div>
                {c.ts > 0 && <em>{time(c.ts)}</em>}
              </button>))}
          </div>
        </>}
      </aside>
      <main className={'main' + (isDraggingFiles ? ' drag-over' : '')}
        onDragEnter={handleFileDragEnter}
        onDragOver={event => { if (Array.from(event.dataTransfer.types).includes('Files')) event.preventDefault(); }}
        onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setIsDraggingFiles(false); }}
        onDrop={handleFileDrop}>
        {isDraggingFiles && <div className="drop-overlay" aria-hidden="true">{activeView === 'activity' ? 'Drop photos/videos to add to your post' : 'Drop images or videos to attach'}</div>}
        {activeView === 'activity' ? <div className="activity-page">
          <div className="activity-heading">
            <button className="activity-back" onClick={() => selectView('chats')}>← Chats</button>
            <h2>Activity</h2>
            <p>Share updates with your accepted friends.</p>
            <div className="friend-tabs">
              <button className={friendPanel === 'discover' ? 'selected' : ''} onClick={() => { setFriendPanel(friendPanel === 'discover' ? '' : 'discover'); setFriendError(''); }}>Find people</button>
              <button className={friendPanel === 'requests' ? 'selected' : ''} onClick={() => { setFriendPanel(friendPanel === 'requests' ? '' : 'requests'); setFriendError(''); }}>
                Requests{friendData.incoming.length > 0 && <span>{friendData.incoming.length}</span>}
              </button>
              <button className={friendPanel === 'friends' ? 'selected' : ''} onClick={() => { setFriendPanel(friendPanel === 'friends' ? '' : 'friends'); setFriendError(''); }}>
                Friends{friendData.friends.length > 0 && <span>{friendData.friends.length}</span>}
              </button>
            </div>
          </div>
          {friendPanel && <section className="friend-panel">
            <div className="friend-panel-heading">
              <h3>{friendPanel === 'discover' ? 'Find people' : friendPanel === 'requests' ? 'Friend requests' : 'Your friends'}</h3>
              <button aria-label="Close friends panel" onClick={() => { setFriendPanel(''); setFriendError(''); }}>×</button>
            </div>
            {friendError && <p className="err">{friendError}</p>}
            {friendPanel === 'discover' && <>
              <input className="friend-search" value={friendQuery} onChange={event => { setFriendQuery(event.target.value); setFriendError(''); }} placeholder="Search by username or email" />
              {friendQuery.trim().length < 2 && <p className="muted">Enter at least 2 characters to find someone.</p>}
              {friendSearchResults.map(user => {
                const isFriend = friendData.friends.some(friend => friend.id === user.id);
                const incoming = friendData.incoming.find(request => request.user.id === user.id);
                const outgoing = friendData.outgoing.some(request => request.user.id === user.id);
                return <div className="friend-row" key={user.id}>
                  <Avatar name={user.username} />
                  <div className="grow"><b>@{user.username}</b><small>{user.email}</small></div>
                  {isFriend ? <span className="friend-status">Friends</span>
                    : incoming ? <button className="btn" disabled={friendActionId === incoming.id} onClick={() => respondToFriendRequest(incoming, 'accept')}>Accept request</button>
                      : outgoing ? <span className="friend-status">Request sent</span>
                        : <button className="btn" disabled={friendActionId === user.id} onClick={() => sendFriendRequest(user)}>{friendActionId === user.id ? 'Sending…' : 'Add friend'}</button>}
                </div>;
              })}
            </>}
            {friendPanel === 'requests' && <>
              <h4>Received</h4>
              {!friendData.incoming.length && <p className="muted">No pending requests.</p>}
              {friendData.incoming.map(request => <div className="friend-row" key={request.id}>
                <Avatar name={request.user.username} avatarPath={request.user.avatarPath} />
                <div className="grow"><b>{request.user.username}</b><small>{request.user.email}</small></div>
                <button className="btn" disabled={friendActionId === request.id} onClick={() => respondToFriendRequest(request, 'accept')}>Accept</button>
                <button className="friend-decline" disabled={friendActionId === request.id} onClick={() => respondToFriendRequest(request, 'reject')}>Reject</button>
              </div>)}
              <h4>Sent</h4>
              {!friendData.outgoing.length && <p className="muted">No sent requests.</p>}
              {friendData.outgoing.map(request => <div className="friend-row" key={request.id}>
                <Avatar name={request.user.username} avatarPath={request.user.avatarPath} />
                <div className="grow"><b>{request.user.username}</b><small>{request.user.email}</small></div>
                <span className="friend-status">Waiting for approval</span>
              </div>)}
            </>}
            {friendPanel === 'friends' && <>
              {!friendData.friends.length && <p className="muted">No friends yet. Find people and send a request.</p>}
              {friendData.friends.map(friend => <div className="friend-row" key={friend.id}>
                <Avatar name={friend.username} avatarPath={friend.avatarPath} />
                <div className="grow"><b>{friend.username}</b><small>{friend.email}</small></div>
                <span className="friend-status">Friends</span>
              </div>)}
            </>}
          </section>}
          <button className="activity-start-post" onClick={() => { setActivityError(''); setActivityComposerOpen(true); }}>
            <Avatar name={me.username} avatarPath={me.avatarPath} /><span>What's happening, {me.username}?</span><b>＋</b>
          </button>
          <div className="activity-feed" aria-live="polite">
            {activityLoading && !activityPosts.length && <p className="muted">Loading activity…</p>}
            {!activityLoading && !activityError && !activityPosts.length && <div className="empty activity-empty"><div>✦</div><h3>No activity yet</h3><p>Share your first update with the community.</p></div>}
            {activityPosts.map(post => <article className="activity-post" key={post.id}>
              <header><Avatar name={post.author.username} avatarPath={post.author.avatarPath} /><div><b>{post.author.username}</b><time>{new Date(post.createdAt).toLocaleString()}</time></div></header>
              {post.text && <p className="activity-post-text">{post.text}</p>}
              {post.attachments?.length > 0 && <div className="activity-media">{post.attachments.map(attachment => attachment.type.startsWith('image/')
                ? <a href={attachment.url} target="_blank" rel="noreferrer" key={attachment.key}><img src={attachment.url} alt={attachment.name} loading="lazy" /></a>
                : <video key={attachment.key} src={attachment.url} controls playsInline preload="metadata" />)}</div>}
            </article>)}
          </div>
          <button className="activity-fab" aria-label="Create an activity post" title="Create an activity post" onClick={() => { setActivityError(''); setActivityComposerOpen(true); }}>＋</button>
        </div> : !active ? <div className="empty"><div>💬</div><h2>Welcome, @{me.username}</h2><p>Select a chat or start a new one with an email address or username.</p></div> : <>
          <div className="chead">
            <button className="back" onClick={() => setActive(null)}>←</button>
            <Avatar name={active.other.username} avatarPath={active.other.avatarPath} big />
            <div className="grow"><b>{active.other.username}</b><small>{active.other.email}</small></div>
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
          {attachedFiles.length > 0 && <div className="file-queue">{attachedFiles.map((file, index) => {
            const key = attachmentKey(file);
            const state = uploadState[key] || {};
            const suffix = state.status === 'uploading' ? `Uploading ${state.progress || 0}%` : state.status === 'error' ? state.message || 'Upload failed' : state.status === 'done' ? 'Ready to send' : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
            return <span key={key} className={state.status === 'error' ? 'upload-error' : ''} aria-label={`${file.name}: ${suffix}`}>
              <b>{file.name}</b><small>{suffix}</small>
              {state.status === 'uploading' && <progress max="100" value={state.progress || 0} aria-label={`Uploading ${file.name}`} />}
              <button disabled={isSending} aria-label={`Remove ${file.name}`} onClick={() => {
                setAttachedFiles(current => current.filter((_, i) => i !== index));
                setUploadState(current => { const next = { ...current }; delete next[key]; return next; });
              }}>×</button>
            </span>;
          })}</div>}
          {replyingTo && <div className="reply-box"><div className="reply-meta">Replying to @{messages.find(item => item.id === replyingTo.id)?.from === me.id ? 'you' : active.other.username}</div><div className="reply-preview">{replyingTo.text || 'Shared media'}</div><button className="text-button" onClick={() => setReplyingTo(null)}>Cancel</button></div>}
          {composeError && <div className="inline-error">{composeError}</div>}
          <div className="comp">
            <input ref={fileInputRef} className="file-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" multiple disabled={isSending || attachedFiles.length >= 5} onChange={event => { handleFilesSelected(event.target.files); event.target.value = ''; }} />
            <button className="attach" title={publicConfig.mediaEnabled ? 'Attach image or video' : 'Media storage is not configured'} aria-label="Attach image or video" disabled={!publicConfig.mediaEnabled || isSending || attachedFiles.length >= 5} onClick={() => fileInputRef.current?.click()}>▧</button>
            <textarea rows={1} value={text} disabled={isSending} placeholder={replyingTo ? 'Reply to the message…' : 'Type a message'} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
            <button className="send" disabled={isSending || (!text.trim() && !attachedFiles.length)} onClick={send}>{isSending ? '…' : '➤'}</button>
          </div>
        </>}
      </main>
      {notificationPromptOpen && <div className="modal notification-prompt-modal">
        <section className="sheet notification-prompt-sheet" role="dialog" aria-modal="true" aria-labelledby="notification-prompt-title">
          <h3 id="notification-prompt-title">Stay up to date</h3>
          <p>Enable device notifications to hear about new messages, calls, friend requests, and activity when NepaChat isn’t open.</p>
          {pushError && <p className="err">{pushError}</p>}
          <button className="btn" onClick={enableNotifications}>Enable notifications</button>
          <button className="btn ghost" onClick={dismissNotificationPrompt}>Not now</button>
        </section>
      </div>}
      {modal && <NewChat token={token} me={me} onClose={() => setModal(false)} onOpen={open} />}
      {linkedDevicesOpen && <LinkedDevices token={token} onClose={() => setLinkedDevicesOpen(false)} onAlert={addAlert} />}
      {adminUsersOpen && <AdminUsers token={token} currentUserId={me.id} onClose={() => setAdminUsersOpen(false)} />}
      {adminModal && <AdminCreateUser token={token} onClose={() => setAdminModal(false)} />}
      {callsOpen && <CallHistory token={token} onClose={() => setCallsOpen(false)} />}
      {locationModal && <LocationShareDialog onStart={startLocationShare} onClose={() => setLocationModal(false)} />}
      {profileOpen && <ProfileSettings me={me} token={token} onClose={() => setProfileOpen(false)} onUpdated={onProfileUpdated} />}
      {activityComposerOpen && <div className="modal activity-compose-modal" onClick={() => { if (!postingActivity) setActivityComposerOpen(false); }}>
        <section className="sheet activity-compose-sheet" onClick={event => event.stopPropagation()}>
          <div className="activity-compose-title"><h3>Create post</h3><button aria-label="Close post composer" disabled={postingActivity} onClick={() => setActivityComposerOpen(false)}>×</button></div>
          <div className="activity-composer-head"><Avatar name={me.username} avatarPath={me.avatarPath} /><b>{me.username}</b></div>
          <textarea maxLength={2000} value={activityText} onChange={event => setActivityText(event.target.value)} placeholder="What's happening today?" aria-label="Write an activity post" />
          {activityFiles.length > 0 && <div className="activity-file-list">{activityFiles.map(file => {
            const key = attachmentKey(file);
            const progress = activityUploadProgress[key];
            return <div className="activity-file" key={key}>
              <span>{file.name}</span>
              {postingActivity && <progress max="100" value={progress || 0} aria-label={`Uploading ${file.name}`} />}
              {!postingActivity && <button aria-label={`Remove ${file.name}`} onClick={() => setActivityFiles(current => current.filter(item => attachmentKey(item) !== key))}>×</button>}
            </div>;
          })}</div>}
          {activityError && <p className="err">{activityError}</p>}
          <div className="activity-composer-actions">
            <input ref={activityInputRef} className="file-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" multiple disabled={!publicConfig.mediaEnabled || postingActivity || activityFiles.length >= 5} onChange={event => { selectActivityFiles(event.target.files); event.target.value = ''; }} />
            <button className="btn ghost" disabled={!publicConfig.mediaEnabled || postingActivity || activityFiles.length >= 5} onClick={() => activityInputRef.current?.click()}>Add photos/videos</button>
            <span className="grow" />
            <small>{activityText.length}/2000</small>
            <button className="btn" disabled={postingActivity || (!activityText.trim() && !activityFiles.length)} onClick={publishActivity}>{postingActivity ? 'Posting…' : 'Post'}</button>
          </div>
        </section>
      </div>}
      {pushError && !notificationPromptOpen && <div className="push-error" role="status">{pushError}<button aria-label="Dismiss" onClick={() => setPushError('')}>×</button></div>}
      {alerts.length > 0 && (
        <div className="alert-stack" aria-live="polite" aria-atomic="true">
          {alerts.map(alert => <div key={alert.id} className={'alert-item alert-' + alert.kind}>{alert.message}</div>)}
        </div>
      )}
      <CallPanel callState={callState} localStream={localStream} remoteStream={remoteStream} peerConnection={peerConnection} audioEnabled={audioEnabled} videoEnabled={videoEnabled} noiseCancellation={noiseCancellation} cameraSwitching={cameraSwitching} layout={callLayout} onLayoutChange={setCallLayout} onToggleAudio={toggleAudio} onToggleVideo={toggleVideo} onToggleNoiseCancellation={toggleNoiseCancellation} onSwitchCamera={switchCamera} onAccept={acceptCall} onDecline={() => endCall('declined')} onHangup={() => endCall('ended')} />
    </div>
  );
}
