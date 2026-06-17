import React, { useState, useEffect, useRef } from 'react';
import { Upload, MessageSquare, Send, Loader2, Plus, Trash2, Edit2, Check, X, LogOut, Moon, Sun, Mic, Pause, Play, FileText, Bot } from 'lucide-react';

export default function App() {
  // Authentication & Session States
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [authMode, setAuthMode] = useState('login'); 
  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '' });
  const [authError, setAuthError] = useState('');

  // Layout Theme State
  const [theme, setTheme] = useState(localStorage.getItem('app-theme') || 'light');

  // Architecture System States
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState('');
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  // In-line title editing states
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editTitleText, setEditTitleText] = useState('');

  // Left Column Tracked Files State Array
  const [attachedFiles, setAttachedFiles] = useState([]);

  // Upload Progress Tracking Animations state
  const [uploadStatus, setUploadStatus] = useState('idle');
  const [uploadMessage, setUploadMessage] = useState('');

  // Audio Processing State Engine
  const [voiceGender, setVoiceGender] = useState('female');
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [audioChunks, setAudioChunks] = useState([]);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);

  // DOM and Hardware Node References
  const chatEndRef = useRef(null);
  const chatInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const canvasRef = useRef(null);
  const activeAudioRef = useRef(null); 

  useEffect(() => {
    localStorage.setItem('app-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
      fetchSessions();
    } else {
      localStorage.removeItem('token');
      setSessions([]);
      setActiveSessionId('');
      setMessages([]);
    }
  }, [token]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming, isRecording]);

  useEffect(() => {
    if (activeSessionId) {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current = null;
      }
      fetchMessages(activeSessionId);
      fetchAttachedFiles(activeSessionId);
      setUploadStatus('idle');
      setUploadMessage('');
      setTimeout(() => chatInputRef.current?.focus(), 50);
    } else {
      setAttachedFiles([]);
    }
  }, [activeSessionId]);

  useEffect(() => {
    if (isRecording && !isRecordingPaused && canvasRef.current) {
      drawVoiceSignals();
    } else {
      cancelAnimationFrame(animationFrameRef.current);
    }
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [isRecording, isRecordingPaused]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  const handleLogout = () => {
    if (activeAudioRef.current) activeAudioRef.current.pause();
    setToken('');
    setSessions([]);
    setActiveSessionId('');
    setMessages([]);
  };

  const fetchSessions = async () => {
    try {
      const response = await fetch('http://localhost:8000/sessions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSessions(data);
        if (data.length > 0 && !activeSessionId) {
          setActiveSessionId(data[0].session_id);
        }
      } else if (response.status === 401) {
        handleLogout(); 
      }
    } catch (err) {
      console.error("Server connection timeout.");
    }
  };

  const fetchMessages = async (id) => {
    try {
      const response = await fetch(`http://localhost:8000/sessions/${id}/messages`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMessages(data.map(m => ({
          sender: m.role === 'human' ? 'human' : 'ai',
          text: m.content
        })));
      }
    } catch (err) {
      console.error("Failed gathering session message histories.");
    }
  };

  const fetchAttachedFiles = async (sessionId) => {
    try {
      const response = await fetch(`http://localhost:8000/documents?session_id=${sessionId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAttachedFiles(data || []);
      } else {
        setAttachedFiles([]);
      }
    } catch (err) {
      console.error("Failed gathering session documents.");
      setAttachedFiles([]);
    }
  };

  const deleteAttachedFile = async (fileId, e) => {
    e.stopPropagation();
    try {
      const response = await fetch(`http://localhost:8000/documents/${fileId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setAttachedFiles(prev => prev.filter(f => f.id !== fileId));
      }
    } catch (err) {
      console.error("Failed executing file deletion stream.");
    }
  };

  const createNewWorkspaceSession = async () => {
    try {
      const response = await fetch('http://localhost:8000/sessions/create', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const newSession = await response.json();
        setSessions(prev => [newSession, ...prev]);
        setActiveSessionId(newSession.session_id);
      }
    } catch (err) {
      console.error("Thread creation tracking crashed.");
    }
  };

  const startRenameInline = (id, title, e) => {
    e.stopPropagation();
    setEditingSessionId(id);
    setEditTitleText(title);
  };

  const saveRenameInline = async (id, e) => {
    if (e) e.stopPropagation();
    if (!editTitleText.trim()) {
      setEditingSessionId(null);
      return;
    }
    try {
      const response = await fetch(`http://localhost:8000/sessions/${id}/rename`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title: editTitleText.trim() })
      });
      if (response.ok) {
        setSessions(prev => prev.map(s => s.session_id === id ? { ...s, title: editTitleText.trim() } : s));
      }
    } catch (err) {
      console.error("Failed renaming session");
    } finally {
      setEditingSessionId(null);
    }
  };

  const deleteSession = async (id, e) => {
    e.stopPropagation();
    try {
      const response = await fetch(`http://localhost:8000/sessions/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setSessions(prev => prev.filter(s => s.session_id !== id));
        if (activeSessionId === id) {
          setActiveSessionId('');
          setMessages([]);
        }
      }
    } catch (err) {
      console.error("Delete call rejected.");
    }
  };

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile || !activeSessionId) return;

    setUploadStatus('uploading');
    setUploadMessage('Processing document...');

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('session_id', activeSessionId);

    try {
      const response = await fetch('http://localhost:8000/documents/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      if (response.ok) {
        setUploadStatus('success');
        setUploadMessage('Attached successfully.');
        fetchAttachedFiles(activeSessionId);
      } else {
        setUploadStatus('error');
        setUploadMessage('Failed processing document.');
      }
    } catch (err) {
      setUploadStatus('error');
      setUploadMessage('Upload pipeline connection error.');
    }
    e.target.value = '';
  };

  const startRecordingAudio = async () => {
    if (activeAudioRef.current) activeAudioRef.current.pause();
    setAudioChunks([]);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) setAudioChunks((prev) => [...prev, e.data]);
      };

      mediaRecorder.start(10);
      setIsRecording(true);
      setIsRecordingPaused(false);
    } catch (err) {
      alert("Microphone capture access denied.");
    }
  };

  const togglePauseRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) return;
    if (isRecordingPaused) {
      mediaRecorderRef.current.resume();
      audioContextRef.current.resume();
      setIsRecordingPaused(false);
    } else {
      mediaRecorderRef.current.pause();
      audioContextRef.current.suspend();
      setIsRecordingPaused(true);
    }
  };

  const cancelRecordingAudio = () => {
    if (!mediaRecorderRef.current) return;
    mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    setIsRecording(false);
    setAudioChunks([]);
  };

  // ✅ FIXED: Voice now shows transcribed text + AI reply as text in chat
  const submitVoiceMessage = () => {
    if (!mediaRecorderRef.current || isProcessingVoice) return;

    mediaRecorderRef.current.onstop = async () => {
      const rawAudioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      if (rawAudioBlob.size === 0) return;

      setIsProcessingVoice(true);
      setIsRecording(false);

      // Show a processing placeholder
      setMessages(prev => [
        ...prev,
        { sender: 'human', text: '🎤 Processing voice...' }
      ]);

      const formPayload = new FormData();
      formPayload.append('file', rawAudioBlob, 'microphone_input.webm');
      formPayload.append('session_id', activeSessionId);
      formPayload.append('voice_gender', voiceGender);

      try {
        const response = await fetch('http://localhost:8000/chat/voice', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formPayload
        });

        if (!response.ok) throw new Error("Audio generation process rejected.");

        // Read transcribed text from response header
        const transcribedText = response.headers.get('X-Transcribed-Text');

        // Replace the placeholder with the real transcribed human message
        if (transcribedText) {
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { sender: 'human', text: `🎤 ${transcribedText}` };
            return updated;
          });
        }

        // Play the audio response
        const audioFileBlob = await response.blob();
        const audioPlaybackUrl = URL.createObjectURL(audioFileBlob);
        const audioEngine = new Audio(audioPlaybackUrl);
        activeAudioRef.current = audioEngine;
        audioEngine.load();
        audioEngine.play();

        // Fetch full message history (includes AI reply text) after a short delay
        // to allow backend to finish saving
        setTimeout(async () => {
          await fetchMessages(activeSessionId);
        }, 500);

      } catch (err) {
        console.error("Audio engine stream execution failed:", err);
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { sender: 'human', text: '🎤 Voice message (processing failed)' };
          return updated;
        });
      } finally {
        setIsProcessingVoice(false);
        setAudioChunks([]);
        fetchSessions();
      }
    };

    mediaRecorderRef.current.stop();
    mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
  };

  const drawVoiceSignals = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const runVisualizer = () => {
      animationFrameRef.current = requestAnimationFrame(runVisualizer);
      analyser.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
      const averageVolume = sum / bufferLength;
      
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const maxVolumeOffset = (averageVolume / 255) * 22; 

      ctx.strokeStyle = '#ff4e00';
      ctx.lineCap = 'round';

      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.lineWidth = 3 + i;
        const radius = (i * 18) + maxVolumeOffset;
        ctx.arc(centerX, centerY, radius, -Math.PI / 3, Math.PI / 3);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, Math.PI - Math.PI / 3, Math.PI + Math.PI / 3);
        ctx.stroke();
      }
    };
    runVisualizer();
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeSessionId || isStreaming) return;
    if (activeAudioRef.current) activeAudioRef.current.pause();

    const query = chatInput;
    setChatInput('');
    setIsStreaming(true);

    setMessages(prev => [...prev, { sender: 'human', text: query }, { sender: 'ai', text: '' }]);

    try {
      const response = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ question: query, session_id: activeSessionId })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let finished = false;
      let streamedText = "";

      while (!finished) {
        const { value, done } = await reader.read();
        finished = done;
        if (value) {
          streamedText += decoder.decode(value, { stream: true });
          setMessages(prev => {
            const current = [...prev];
            current[current.length - 1] = { sender: 'ai', text: streamedText };
            return current;
          });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsStreaming(false);
      fetchSessions(); 
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (authMode === 'register') {
      const response = await fetch('http://localhost:8000/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      });
      if (response.ok) {
        setAuthMode('login');
      } else {
        setAuthError('Registration rejected.');
      }
    } else {
      const params = new URLSearchParams();
      params.append('username', authForm.email); 
      params.append('password', authForm.password);
      const response = await fetch('http://localhost:8000/auth/token', {
        method: 'POST',
        body: params
      });
      if (response.ok) {
        const data = await response.json();
        setToken(data.access_token);
      } else {
        setAuthError('Invalid credentials.');
      }
    }
  };

  const isDark = theme === 'dark';
  const c_bg = isDark ? '#1a1a1a' : '#f1f3f5'; 
  const c_side = isDark ? '#121212' : '#e9ecef'; 
  const c_border = isDark ? '#2d2d2d' : '#dee2e6';
  const c_text = isDark ? '#f8f9fa' : '#212529';
  const c_subtext = isDark ? '#adb5bd' : '#6c757d';
  const c_input = isDark ? '#222222' : '#ffffff';
  const c_session_active = isDark ? '#262626' : '#ced4da';
  const c_bubble_ai = isDark ? '#262626' : '#ffffff';

  // Input focus style helper
  const inputStyle = {
    width: '100%',
    padding: '11px 14px',
    fontSize: '13.5px',
    color: c_text,
    backgroundColor: isDark ? '#222222' : '#ffffff',
    border: `1.5px solid ${c_border}`,
    borderRadius: '9px',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ ...styles.workspace, backgroundColor: c_bg, color: c_text }}>
      <style dangerouslySetInnerHTML={{__html: `
        body, html, #root { background-color: ${c_bg}; margin: 0; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .auth-input:focus { border-color: #ff4e00 !important; box-shadow: 0 0 0 3px rgba(255,78,0,0.12) !important; }
        .submit-btn:hover { background-color: #e44400 !important; }
        .tab-btn:hover { background-color: ${isDark ? '#333' : '#e5e5e3'} !important; }
      `}} />

      {!token ? (
        /* ============================================================
           NEW LOGIN PAGE
        ============================================================ */
        <div style={{ height: '100vh', width: '100vw', display: 'flex', backgroundColor: isDark ? '#111111' : '#f7f7f6' }}>

          {/* LEFT BRANDING PANEL */}
          <div style={{
            width: '420px', minWidth: '420px', minHeight: '100vh',
            backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
            borderRight: `1px solid ${c_border}`,
            display: 'flex', flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '44px 48px',
            position: 'relative', overflow: 'hidden',
          }}>
            {/* Decorative circle */}
            <div style={{
              position: 'absolute', bottom: '-80px', right: '-80px',
              width: '280px', height: '280px', borderRadius: '50%',
              backgroundColor: isDark ? 'rgba(255,78,0,0.06)' : '#fff3ee',
              pointerEvents: 'none',
            }} />

            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '32px', height: '32px', backgroundColor: '#ff4e00',
                borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                  <rect x="2" y="2" width="6" height="6" rx="1.5" fill="white"/>
                  <rect x="10" y="2" width="6" height="6" rx="1.5" fill="white" opacity="0.6"/>
                  <rect x="2" y="10" width="6" height="6" rx="1.5" fill="white" opacity="0.6"/>
                  <rect x="10" y="10" width="6" height="6" rx="1.5" fill="white" opacity="0.35"/>
                </svg>
              </div>
              <span style={{ fontSize: '17px', fontWeight: '800', color: c_text, letterSpacing: '-0.3px' }}>
                Omni<span style={{ color: '#ff4e00' }}>Doc</span>
              </span>
            </div>

            {/* Headline block */}
            <div style={{ position: 'relative', zIndex: 1 }}>
              <p style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#ff4e00', marginBottom: '14px', margin: '0 0 14px 0' }}>
                AI Document Intelligence
              </p>
              <h1 style={{ fontSize: '34px', fontWeight: '800', color: c_text, lineHeight: '1.15', letterSpacing: '-0.8px', margin: '0 0 16px 0' }}>
                Ask anything<br />about your docs.
              </h1>
              <p style={{ fontSize: '14px', color: c_subtext, lineHeight: '1.65', maxWidth: '300px', margin: 0 }}>
                Upload PDFs and images. Talk to them by text or voice. OmniDoc understands context across your whole workspace.
              </p>

              {/* Feature pills */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', marginTop: '32px' }}>
                {['RAG-powered document Q&A', 'Voice input & audio responses', 'Persistent chat sessions'].map(feat => (
                  <div key={feat} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 14px',
                    backgroundColor: isDark ? '#222222' : '#f7f7f6',
                    border: `1px solid ${c_border}`,
                    borderRadius: '9px', fontSize: '13px', color: c_text,
                  }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#ff4e00', flexShrink: 0 }} />
                    {feat}
                  </div>
                ))}
              </div>
            </div>

            <p style={{ fontSize: '12px', color: c_subtext, position: 'relative', zIndex: 1, margin: 0 }}>
              © 2025 OmniDoc. All rights reserved.
            </p>
          </div>

          {/* RIGHT FORM PANEL */}
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '48px 40px',
          }}>
            <div style={{ width: '100%', maxWidth: '360px' }}>

              {/* Tab switcher */}
              <div style={{
                display: 'flex',
                marginBottom: '28px',
                backgroundColor: isDark ? '#222222' : '#eeeeec',
                borderRadius: '10px', padding: '3px',
              }}>
                {['login', 'register'].map(m => (
                  <button key={m} className="tab-btn" onClick={() => { setAuthMode(m); setAuthError(''); }} style={{
                    flex: 1, padding: '8px 0', fontSize: '13px', fontWeight: '600',
                    border: 'none', cursor: 'pointer', borderRadius: '8px',
                    backgroundColor: authMode === m ? (isDark ? '#2d2d2d' : '#ffffff') : 'transparent',
                    color: authMode === m ? c_text : c_subtext,
                    boxShadow: authMode === m ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    transition: 'all 0.15s',
                  }}>
                    {m === 'login' ? 'Sign in' : 'Create account'}
                  </button>
                ))}
              </div>

              <h2 style={{ fontSize: '22px', fontWeight: '800', color: c_text, letterSpacing: '-0.4px', margin: '0 0 6px 0' }}>
                {authMode === 'login' ? 'Welcome back' : 'Create your account'}
              </h2>
              <p style={{ fontSize: '13.5px', color: c_subtext, margin: '0 0 26px 0' }}>
                {authMode === 'login' ? 'Sign in to your OmniDoc workspace.' : 'Join OmniDoc and start talking to your documents.'}
              </p>

              {/* Error box */}
              {authError && (
                <div style={{
                  backgroundColor: isDark ? '#2d1515' : '#fff3f3',
                  border: '1px solid #ffc5c5', borderRadius: '7px',
                  padding: '9px 12px', fontSize: '12.5px', color: '#c0392b', marginBottom: '14px',
                }}>
                  {authError}
                </div>
              )}

              <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

                {/* Username — register only */}
                {authMode === 'register' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: c_subtext, marginBottom: '6px', letterSpacing: '0.2px' }}>Username</label>
                    <input
                      type="text"
                      placeholder="your_username"
                      className="auth-input"
                      value={authForm.username}
                      onChange={e => setAuthForm(prev => ({ ...prev, username: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>
                )}

                {/* Email */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: c_subtext, marginBottom: '6px', letterSpacing: '0.2px' }}>Email address</label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    className="auth-input"
                    value={authForm.email}
                    onChange={e => setAuthForm(prev => ({ ...prev, email: e.target.value }))}
                    style={inputStyle}
                  />
                </div>

                {/* Password */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: c_subtext, letterSpacing: '0.2px' }}>Password</label>
                    {authMode === 'login' && (
                      <span style={{ fontSize: '12px', color: '#ff4e00', cursor: 'pointer' }}>Forgot password?</span>
                    )}
                  </div>
                  <input
                    type="password"
                    placeholder="••••••••"
                    className="auth-input"
                    value={authForm.password}
                    onChange={e => setAuthForm(prev => ({ ...prev, password: e.target.value }))}
                    style={inputStyle}
                  />
                </div>

                {/* Submit */}
                <button type="submit" className="submit-btn" style={{
                  width: '100%', padding: '12px', marginTop: '4px',
                  backgroundColor: '#ff4e00', color: '#ffffff',
                  border: 'none', borderRadius: '9px',
                  fontSize: '14px', fontWeight: '700', cursor: 'pointer',
                  letterSpacing: '0.1px', transition: 'background-color 0.15s',
                }}>
                  {authMode === 'login' ? 'Sign in' : 'Create account'}
                </button>
              </form>

              <p style={{ textAlign: 'center', marginTop: '22px', fontSize: '13px', color: c_subtext }}>
                {authMode === 'login' ? 'New to OmniDoc? ' : 'Already have an account? '}
                <span
                  onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError(''); }}
                  style={{ color: '#ff4e00', fontWeight: '600', cursor: 'pointer' }}
                >
                  {authMode === 'login' ? 'Create an account' : 'Sign in'}
                </span>
              </p>
            </div>
          </div>
        </div>

      ) : (
        /* ============================================================
           MAIN APP (unchanged)
        ============================================================ */
        <>
          {/* LEFT COLUMN PANEL */}
          <div style={{ ...styles.sidebar, backgroundColor: c_side, borderColor: c_border }}>
            <div style={styles.sidebarHeader}>
              <div>
                <h2 style={{ ...styles.title, color: c_text }}>OmniDoc</h2>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={toggleTheme} style={{ ...styles.sidebarRoundToggle, color: c_text, backgroundColor: isDark ? '#262626' : '#ffffff' }}>{isDark ? <Sun size={14} /> : <Moon size={14} />}</button>
                <button onClick={handleLogout} style={{ ...styles.sidebarRoundToggle, color: c_text, backgroundColor: isDark ? '#262626' : '#ffffff' }}><LogOut size={14} /></button>
              </div>
            </div>

            <button onClick={createNewWorkspaceSession} style={styles.button}><Plus size={16} /> New Chat</button>

            <h3 style={styles.sectionDividerText}>Chat Threads</h3>
            <div style={styles.sessionScroller}>
              {sessions.map(s => (
                <div key={s.session_id} style={{ ...styles.sessionCheck, backgroundColor: activeSessionId === s.session_id ? c_session_active : 'transparent' }} onClick={() => setActiveSessionId(s.session_id)}>
                  <MessageSquare size={14} color={activeSessionId === s.session_id ? '#ff4e00' : c_subtext} />
                  
                  {editingSessionId === s.session_id ? (
                    <input 
                      type="text" 
                      value={editTitleText}
                      onChange={e => setEditTitleText(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && saveRenameInline(s.session_id)}
                      onClick={e => e.stopPropagation()}
                      style={{ border: '1px solid #ff4e00', padding: '2px 4px', borderRadius: '4px', fontSize: '12px', width: '110px', outline: 'none', backgroundColor: c_input, color: c_text }}
                      autoFocus
                    />
                  ) : (
                    <span style={{ ...styles.sessionTitle, color: c_text }}>{s.title}</span>
                  )}

                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {editingSessionId === s.session_id ? (
                      <Check size={13} style={{ color: '#10b981', cursor: 'pointer' }} onClick={(e) => saveRenameInline(s.session_id, e)} />
                    ) : (
                      <Edit2 size={13} style={{ color: c_subtext, cursor: 'pointer' }} onClick={(e) => startRenameInline(s.session_id, s.title, e)} />
                    )}
                    <Trash2 size={13} style={{ color: '#dc2626', cursor: 'pointer' }} onClick={(e) => deleteSession(s.session_id, e)} />
                  </div>
                </div>
              ))}
            </div>

            {/* ATTACHED FILES SYSTEM MANAGER BLOCK */}
            {activeSessionId && (
              <div style={styles.filesManagerSection}>
                <h3 style={styles.sectionDividerText}>Attached Files</h3>
                <div style={styles.filesListContainer}>
                  {attachedFiles.length === 0 ? (
                    <p style={{ fontSize: '12px', color: c_subtext, padding: '0 4px' }}>No files attached to thread.</p>
                  ) : (
                    attachedFiles.map(file => (
                      <div key={file.id} style={styles.fileListItem}>
                        <FileText size={14} color="#ff4e00" style={{ flexShrink: 0 }} />
                        <span style={{ ...styles.fileNameText, color: c_text }} title={file.name}>{file.name}</span>
                        <X size={14} style={styles.deleteFileIcon} onClick={(e) => deleteAttachedFile(file.id, e)} />
                      </div>
                    ))
                  )}
                </div>
                
                <div style={{ borderTop: `1px solid ${c_border}`, paddingTop: '10px' }}>
                  {uploadStatus !== 'idle' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '11px' }}>
                      {uploadStatus === 'uploading' && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite', color: '#ff4e00' }} />}
                      <span style={{ color: c_text }}>{uploadMessage}</span>
                    </div>
                  )}

                  <label style={styles.dropzone}>
                    <Upload size={16} color="#ff4e00" />
                    <span style={{ fontSize: '11px', color: c_subtext, marginTop: '4px' }}>Upload Document</span>
                    <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={handleFileChange} style={{ display: 'none' }} />
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* MAIN CHAT AREA LAYOUT */}
          <div style={{ ...styles.chatArea, backgroundColor: c_bg }}>
            
            {/* IN-CHAT ACTIVE MICROPHONE RECORDING DIALOGUE OVERLAY */}
            {isRecording && (
              <div style={styles.speakNowOverlay}>
                <div style={styles.speakCard}>
                  <canvas ref={canvasRef} width={200} height={100} style={styles.signalCanvas} />
                  <h3 style={styles.speakText}>Speak Now</h3>
                  <p style={{ color: '#a3a3a3', fontSize: '12px', margin: '0 0 16px 0' }}>Listening to voice stream...</p>
                  
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                    <button onClick={cancelRecordingAudio} style={styles.voiceRoundCancel}><X size={16} color="#ffffff" /></button>
                    <button onClick={togglePauseRecording} style={styles.voiceRoundPause}>
                      {isRecordingPaused ? <Play size={16} fill="#ffffff" color="#ffffff" /> : <Pause size={16} fill="#ffffff" color="#ffffff" />}
                    </button>
                    <button onClick={submitVoiceMessage} style={styles.voiceRoundSend}><Send size={16} fill="#ffffff" color="#ffffff" /></button>
                  </div>
                </div>
              </div>
            )}

            {/* DASHBOARD CONDITIONAL CANVAS VIEWS */}
            {!activeSessionId ? (
              <div style={styles.emptyDashboardState}>
                <Bot size={54} color="#ff4e00" style={{ marginBottom: '16px' }} />
                <h2 style={{ color: c_text }}>Welcome to OmniDoc Workspace</h2>
                <p style={{ color: c_subtext, marginBottom: '24px' }}>Select an ongoing chat sequence from the side panel or create a brand new one below.</p>
                <button onClick={createNewWorkspaceSession} style={{ ...styles.button, width: '200px' }}><Plus size={16} /> Create Chat Session</button>
              </div>
            ) : (
              <>
                {/* OMNIBOT HEADER ROW */}
                <div style={{ ...styles.omnibotHeaderRow, borderColor: c_border, backgroundColor: isDark ? '#1a1a1a' : '#ffffff' }}>
                  <div style={styles.omnibotBadgeCircle}>
                    <Bot size={22} color="#ffffff" />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: c_text }}>OmniDoc Assistant</h4>
                  </div>
                </div>

                <div style={styles.chatScroller}>
                  {messages.map((m, idx) => (
                    <div key={idx} style={m.sender === 'human' ? styles.humanBubbleRow : styles.aiBubbleRow}>
                      <div style={m.sender === 'human' ? styles.humanBubble : { ...styles.aiBubble, backgroundColor: c_bubble_ai, color: c_text, borderColor: c_border }}>
                        {m.text}
                      </div>
                    </div>
                  ))}
                  {isProcessingVoice && (
                    <div style={styles.aiBubbleRow}>
                      <div style={{ ...styles.aiBubble, backgroundColor: c_bubble_ai, color: c_subtext, borderColor: c_border }}>
                        <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', display: 'inline', marginRight: '6px' }} />
                        Generating voice response...
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* BOTTOM CHAT INPUT STRIP */}
                <div style={styles.inputStrip}>
                  
                  {/* GENDER SELECTOR TOGGLE */}
                  <button 
                    type="button" 
                    onClick={() => setVoiceGender(prev => prev === 'female' ? 'male' : 'female')}
                    style={{ ...styles.genderToggleCircle, backgroundColor: isDark ? '#262626' : '#ffffff', borderColor: c_border }}
                    title={`AI Output Voice: ${voiceGender}`}
                  >
                    {voiceGender === 'female' ? (
                      <svg style={styles.genderArrowSvg} viewBox="0 0 24 24" fill="none" stroke="#ff4e00" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="9" r="5" />
                        <line x1="12" y1="14" x2="12" y2="21" />
                        <line x1="9" y1="18" x2="15" y2="18" />
                      </svg>
                    ) : (
                      <svg style={styles.genderArrowSvg} viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="9" cy="15" r="5" />
                        <line x1="13" y1="11" x2="19" y2="5" />
                        <polyline points="14 5 19 5 19 10" />
                      </svg>
                    )}
                  </button>

                  <form onSubmit={handleChatSubmit} style={styles.shortenedFormWrapper}>
                    <input 
                      type="text" 
                      ref={chatInputRef}
                      placeholder="Type a message or use the microphone..." 
                      disabled={isStreaming || isRecording || isProcessingVoice} 
                      style={{ ...styles.chatInput, backgroundColor: c_input, color: c_text, borderColor: c_border }} 
                      value={chatInput} 
                      onChange={e => setChatInput(e.target.value)}
                    />
                    <button type="submit" disabled={isStreaming || isProcessingVoice || !chatInput.trim()} style={styles.sendBtnFrameless}>
                      <Send size={18} fill="#ff4e00" color="#ff4e00" style={{ opacity: chatInput.trim() ? 1 : 0.3 }} />
                    </button>
                  </form>

                  <button type="button" onClick={startRecordingAudio} disabled={isStreaming || isRecording || isProcessingVoice} style={styles.micTriggerCircle}>
                    <Mic size={18} color="#ffffff" />
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------
// APP DESIGN SYSTEM
// ---------------------------------------------------------
const styles = {
  workspace: { display: 'flex', height: '100vh', width: '100vw', fontFamily: 'system-ui, sans-serif', overflow: 'hidden' },

  sidebar: { width: '280px', minWidth: '280px', borderRight: '1px solid', padding: '20px 14px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' },
  sidebarHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  title: { margin: 0, fontSize: '18px', fontWeight: '800' },
  sidebarRoundToggle: { width: '28px', height: '28px', borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  button: { width: '100%', padding: '10px', backgroundColor: '#ff4e00', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '13px' },
  sectionDividerText: { margin: '18px 0 6px 0', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#888888' },
  sessionScroller: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '220px' },
  sessionCheck: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', borderRadius: '6px', cursor: 'pointer' },
  sessionTitle: { fontSize: '13px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', width: '100px' },
  
  filesManagerSection: { borderTop: '1px solid #dee2e6', marginTop: 'auto', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' },
  filesListContainer: { display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '140px', overflowY: 'auto', marginBottom: '6px' },
  fileListItem: { display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', backgroundColor: 'rgba(255, 78, 0, 0.05)', borderRadius: '6px', border: '1px solid rgba(255, 78, 0, 0.1)' },
  fileNameText: { fontSize: '12px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', flex: 1, fontWeight: '500' },
  deleteFileIcon: { color: '#888888', cursor: 'pointer' },
  dropzone: { border: '1px dashed #ccc', borderRadius: '6px', padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' },

  chatArea: { flex: 1, display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' },
  omnibotHeaderRow: { padding: '12px 24px', borderBottom: '1px solid', display: 'flex', alignItems: 'center', gap: '12px' },
  omnibotBadgeCircle: { width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#ff4e00', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  
  emptyDashboardState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: '0 40px' },
  chatScroller: { flex: 1, padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' },
  humanBubbleRow: { display: 'flex', justifyContent: 'flex-end' },
  aiBubbleRow: { display: 'flex', justifyContent: 'flex-start' },
  humanBubble: { maxWidth: '70%', backgroundColor: '#ff4e00', color: '#ffffff', padding: '11px 16px', borderRadius: '16px 16px 2px 16px', fontSize: '13.5px', lineHeight: '1.4' },
  aiBubble: { maxWidth: '70%', padding: '11px 16px', borderRadius: '16px 16px 16px 2px', fontSize: '13.5px', lineHeight: '1.45', whiteSpace: 'pre-wrap', border: '1px solid' },

  inputStrip: { padding: '12px 24px 20px 24px', display: 'flex', gap: '10px', alignItems: 'center' },
  genderToggleCircle: { width: '40px', height: '40px', borderRadius: '50%', border: '1px solid', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 },
  genderArrowSvg: { width: '20px', height: '20px' },
  shortenedFormWrapper: { flex: 1, display: 'flex', gap: '8px', alignItems: 'center', position: 'relative' },
  chatInput: { width: '100%', padding: '12px 40px 12px 16px', border: '1px solid', borderRadius: '20px', fontSize: '13.5px', outline: 'none', boxSizing: 'border-box' }, 
  sendBtnFrameless: { background: 'transparent', border: 'none', position: 'absolute', right: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center' },
  micTriggerCircle: { width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#ff4e00', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  speakNowOverlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  speakCard: { backgroundColor: '#1e1e1e', padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '240px', textAlign: 'center', border: '1px solid #2d2d2d' },
  signalCanvas: { width: '200px', height: '100px', marginBottom: '6px' },
  speakText: { color: '#ffffff', margin: '0 0 2px 0', fontSize: '16px', fontWeight: '700' },
  voiceRoundCancel: { width: '34px', height: '34px', borderRadius: '50%', backgroundColor: '#ef4444', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  voiceRoundPause: { width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#4b5563', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  voiceRoundSend: { width: '34px', height: '34px', borderRadius: '50%', backgroundColor: '#10b981', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
};
