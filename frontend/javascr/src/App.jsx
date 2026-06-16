import React, { useState, useEffect, useRef } from 'react';
import { Upload, MessageSquare, Send, Loader2, CheckCircle, AlertCircle, Plus, Trash2, Edit2, Check, X, LogOut, Lock, Mail, User, Copy, Moon, Sun } from 'lucide-react';

export default function App() {
  // Authentication & Token tracking
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [authMode, setAuthMode] = useState('login'); // login | register
  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '' });
  const [authError, setAuthError] = useState('');

  // UI Theme Engine State
  const [theme, setTheme] = useState(localStorage.getItem('app-theme') || 'light');

  // Workspace Architecture States
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState('');
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);

  // In-line editing states
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editTitleText, setEditTitleText] = useState('');

  // Custom In-App Deletion Modal State
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, sessionId: null });

  // Layout Upload Tracking
  const [uploadStatus, setUploadStatus] = useState('idle'); // idle | uploading | success | error
  const [uploadMessage, setUploadMessage] = useState('');

  // DOM Node References for Focus & Scrolling
  const chatEndRef = useRef(null);
  const chatInputRef = useRef(null);

  // Toggle Dark Mode Framework Hooks
  useEffect(() => {
    localStorage.setItem('app-theme', theme);
  }, [theme]);

  // Sync token to persistent cache storage
  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
      fetchSessions();
    } else {
      localStorage.removeItem('token');
      setSessions([]);
      setActiveSessionId('');
      setMessages([]);
      setHasAnimated(false);
    }
  }, [token]);

  // Smooth scroll handle to trace typewriter rendering
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // Trigger historical stream updates when shifting focus between sessions
  useEffect(() => {
    if (activeSessionId) {
      fetchMessages(activeSessionId);
      setUploadStatus('idle');
      setUploadMessage('');
      setTimeout(() => chatInputRef.current?.focus(), 50);
    }
  }, [activeSessionId]);

  // ---------------------------------------------------------
  // SYSTEM WORKFLOW HANDLERS
  // ---------------------------------------------------------
  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleLogout = () => {
    setToken('');
    setAuthForm({ username: '', email: '', password: '' });
    setChatInput('');
    setAuthError('');
    setMessages([]);
    setHasAnimated(false);
  };

  const copyToClipboard = (text, e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text)
      .then(() => {})
      .catch(err => console.error("Could not copy message payload: ", err));
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
          setHasAnimated(true);
        }
      } else if (response.status === 401) {
        handleLogout(); 
      }
    } catch (err) {
      console.error("Backend offline while gathering sessions context.");
    }
  };

  const fetchMessages = async (id) => {
    try {
      const response = await fetch(`http://localhost:8000/sessions/${id}/messages`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        const normalized = data.map(m => ({
          sender: m.role === 'human' ? 'human' : 'ai',
          text: m.content
        }));
        setMessages(normalized);
      }
    } catch (err) {
      console.error("Failed fetching context logs.");
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    
    if (authMode === 'register') {
      try {
        const response = await fetch('http://localhost:8000/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: authForm.username,
            email: authForm.email,
            password: authForm.password
          })
        });
        const data = await response.json();
        if (response.ok) {
          setAuthMode('login');
          setAuthForm({ username: '', email: '', password: '' });
          alert('Registration successful! Please log in.');
        } else {
          setAuthError(data.detail || 'Registration failed.');
        }
      } catch (err) {
        setAuthError('Connection failed.');
      }
    } else {
      const params = new URLSearchParams();
      params.append('username', authForm.email); 
      params.append('password', authForm.password);

      try {
        const response = await fetch('http://localhost:8000/auth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params
        });
        const data = await response.json();
        if (response.ok) {
          setToken(data.access_token);
        } else {
          setAuthError(data.detail || 'Invalid login details.');
        }
      } catch (err) {
        setAuthError('Connection failed.');
      }
    }
  };

  const createNewWorkspaceSession = async () => {
    if (!activeSessionId && !hasAnimated) {
      setIsTransitioning(true);
      setTimeout(async () => {
        await executeSessionCreation();
        setIsTransitioning(false);
        setHasAnimated(true);
      }, 700); 
    } else {
      await executeSessionCreation();
    }
  };

  const executeSessionCreation = async () => {
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
      console.error("Unable to instantiate dynamic workspace thread.");
    }
  };

  const startRenameInline = (id, currentTitle, e) => {
    e.stopPropagation();
    setEditingSessionId(id);
    setEditTitleText(currentTitle);
  };

  const saveRenameInline = async (id) => {
    if (!editTitleText || !editTitleText.trim()) {
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
      console.error("Rename update failed.");
    } finally {
      setEditingSessionId(null);
    }
  };

  const triggerDeleteModal = (id, e) => {
    e.stopPropagation();
    setDeleteModal({ isOpen: true, sessionId: id });
  };

  const confirmDeleteSession = async () => {
    const id = deleteModal.sessionId;
    if (!id) return;

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
      console.error("Session deletion tracking failed.");
    } finally {
      setDeleteModal({ isOpen: false, sessionId: null });
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
      const data = await response.json();
      if (response.ok) {
        setUploadStatus('success');
        setUploadMessage(`"${selectedFile.name}" added successfully.`);
      } else {
        setUploadStatus('error');
        setUploadMessage(data.detail || 'Failed to process document.');
      }
    } catch (err) {
      setUploadStatus('error');
      setUploadMessage('Server error during upload.');
    }
    
    e.target.value = '';
    chatInputRef.current?.focus(); 
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeSessionId || isStreaming) return;

    const query = chatInput;
    setChatInput('');
    setIsStreaming(true);

    const userMsg = { sender: 'human', text: query };
    const dummyAiMsg = { sender: 'ai', text: '' };
    setMessages(prev => [...prev, userMsg, dummyAiMsg]);

    setTimeout(() => chatInputRef.current?.focus(), 10);

    try {
      const response = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ question: query, session_id: activeSessionId })
      });

      if (!response.body) throw new Error("Null pointer on downstream data pipes.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let finished = false;
      let streamedText = "";

      while (!finished) {
        const { value, done } = await reader.read();
        finished = done;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          streamedText += chunk;
          setMessages(prev => {
            const current = [...prev];
            current[current.length - 1] = { sender: 'ai', text: streamedText };
            return current;
          });
        }
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => {
        const current = [...prev];
        current[current.length - 1] = { sender: 'ai', text: '⚠️ Connection lost. Could not finish generating answer.' };
        return current;
      });
    } finally {
      setIsStreaming(false);
      fetchSessions(); 
      setTimeout(() => chatInputRef.current?.focus(), 10);
    }
  };

  // Theme variable interpolation maps
  const isDark = theme === 'dark';
  const c_bg = isDark ? '#171717' : '#ffffff';
  const c_side = isDark ? '#262626' : '#fafafa';
  const c_border = isDark ? '#404040' : '#e5e5e5';
  const c_text = isDark ? '#f5f5f5' : '#171717';
  const c_subtext = isDark ? '#a3a3a3' : '#737373';
  const c_input = isDark ? '#262626' : '#fafafa';
  const c_bubble_ai = isDark ? '#262626' : '#f4f4f5';

  return (
    <div style={{ ...styles.workspace, backgroundColor: c_bg, color: c_text }}>
      <style dangerouslySetInnerHTML={{__html: styles.globalResetStyles(isDark) + styles.animationKeyframes}} />

      {!token ? (
        <div style={{ ...styles.authLayout, backgroundColor: c_side, color: c_text }}>
          <div style={{ ...styles.authCard, backgroundColor: c_bg, borderColor: c_border }}>
            <h2 style={{ ...styles.title, color: c_text, textAlign: 'center', marginBottom: '8px', fontSize: '22px' }}>OmniDoc <span style={{ color: '#ff4e00' }}>Core</span></h2>
            <p style={{ ...styles.subtitle, color: c_subtext, textAlign: 'center', marginBottom: '24px' }}>
              {authMode === 'login' ? 'Your personal context-aware assistant' : 'Create a new account'}
            </p>

            <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} autoComplete="new-password">
              {authMode === 'register' && (
                <div style={{ ...styles.inputWrapper, borderColor: isDark ? '#525252' : '#d4d4d4', backgroundColor: c_bg }}>
                  <User size={18} color="#a3a3a3" style={styles.inputIcon} />
                  <input 
                    type="text" placeholder="Username" required style={{ ...styles.authInput, backgroundColor: c_bg, color: c_text }} className="validated-input"
                    value={authForm.username} onChange={e => setAuthForm(prev => ({ ...prev, username: e.target.value }))}
                    autoComplete="new-password"
                  />
                </div>
              )}
              <div style={{ ...styles.inputWrapper, borderColor: isDark ? '#525252' : '#d4d4d4', backgroundColor: c_bg }}>
                <Mail size={18} color="#a3a3a3" style={styles.inputIcon} />
                <input 
                  type="email" placeholder="Email Address" required style={{ ...styles.authInput, backgroundColor: c_bg, color: c_text }} className="validated-input"
                  value={authForm.email} onChange={e => setAuthForm(prev => ({ ...prev, email: e.target.value }))}
                  autoComplete="new-password"
                />
              </div>
              <div style={{ ...styles.inputWrapper, borderColor: isDark ? '#525252' : '#d4d4d4', backgroundColor: c_bg }}>
                <Lock size={18} color="#a3a3a3" style={styles.inputIcon} />
                <input 
                  type="password" placeholder="Password" required style={{ ...styles.authInput, backgroundColor: c_bg, color: c_text }} className="validated-input"
                  value={authForm.password} onChange={e => setAuthForm(prev => ({ ...prev, password: e.target.value }))}
                  autoComplete="new-password"
                />
              </div>

              {authError && <div style={styles.authErrorBlock}><AlertCircle size={16} /> {authError}</div>}

              <button type="submit" style={styles.button}>
                {authMode === 'login' ? 'Login' : 'Create Account'}
              </button>
            </form>

            <p style={styles.toggleAuthModeText}>
              {authMode === 'login' ? "New to OmniDoc? " : "Already have an account? "}
              <span style={styles.toggleLink} onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError(''); setAuthForm({ username: '', email: '', password: '' }); }}>
                {authMode === 'login' ? 'Register' : 'Log in here'}
              </span>
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* SIDEBAR COMPONENT */}
          <div style={{ ...styles.sidebar, backgroundColor: c_side, borderColor: c_border }}>
            <div style={styles.sidebarHeader}>
              <div>
                <h2 style={{ ...styles.title, color: c_text }}>OmniDoc</h2>
                <p style={{ ...styles.subtitle, color: c_subtext }}>Document Assistant</p>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {/* Circular Theme Toggle Button - Positioned exactly next to Logout */}
                <button 
                  onClick={toggleTheme} 
                  style={{ ...styles.sidebarRoundToggle, backgroundColor: isDark ? '#404040' : '#e5e5e5', color: c_text }} 
                  title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
                >
                  {isDark ? <Sun size={15} strokeWidth={2.5} /> : <Moon size={15} strokeWidth={2.5} />}
                </button>
                <button 
                  style={{ ...styles.logoutBtn, backgroundColor: isDark ? '#404040' : '#e5e5e5', color: c_text }} 
                  onClick={handleLogout} 
                  title="Log Out"
                >
                  <LogOut size={15} />
                </button>
              </div>
            </div>

            <button onClick={createNewWorkspaceSession} style={{ ...styles.button, marginBottom: '16px' }}>
              <Plus size={16} /> New Chat
            </button>

            {/* Dynamic Sessions Panel List */}
            <div style={styles.sessionScroller}>
              {sessions.map(s => (
                <div 
                  key={s.session_id} 
                  style={{ ...styles.sessionItem, backgroundColor: activeSessionId === s.session_id ? (isDark ? '#404040' : '#f4f4f5') : 'transparent', borderLeft: activeSessionId === s.session_id ? '3px solid #ff4e00' : '3px solid transparent' }}
                  onClick={() => { if (editingSessionId !== s.session_id) setActiveSessionId(s.session_id); }}
                >
                  <MessageSquare size={16} color={activeSessionId === s.session_id ? '#ff4e00' : c_subtext} style={{ flexShrink: 0 }} />
                  
                  {editingSessionId === s.session_id ? (
                    <input 
                      type="text" 
                      value={editTitleText}
                      style={{ ...styles.inlineRenameInput, backgroundColor: c_bg, color: c_text, borderColor: '#ff4e00' }}
                      onChange={(e) => setEditTitleText(e.target.value)}
                      onBlur={() => saveRenameInline(s.session_id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveRenameInline(s.session_id);
                        if (e.key === 'Escape') setEditingSessionId(null);
                      }}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span style={{ ...styles.sessionTitle, color: isDark ? '#f5f5f5' : '#262626', fontWeight: activeSessionId === s.session_id ? '600' : '400' }}>{s.title}</span>
                  )}

                  <div style={styles.sessionActionRow}>
                    {editingSessionId === s.session_id ? (
                      <>
                        <Check size={14} style={{ color: '#16a34a', cursor: 'pointer' }} onMouseDown={() => saveRenameInline(s.session_id)} />
                        <X size={14} style={{ color: '#dc2626', cursor: 'pointer' }} onMouseDown={() => setEditingSessionId(null)} />
                      </>
                    ) : (
                      <>
                        <Edit2 size={14} style={styles.actionIcon} onClick={(e) => startRenameInline(s.session_id, s.title, e)} />
                        <Trash2 size={14} style={styles.actionIconDanger} onClick={(e) => triggerDeleteModal(s.session_id, e)} />
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Dynamic File Uploading Module Section */}
            {activeSessionId && (
              <div style={{ ...styles.uploadBoundary, borderColor: c_border }}>
                <label style={{ ...styles.dropzone, backgroundColor: c_bg, borderColor: isDark ? '#525252' : '#d4d4d4' }}>
                  {uploadStatus === 'uploading' ? (
                    <Loader2 size={20} color="#ff4e00" style={{ animation: 'spin-loop 1s linear infinite' }} />
                  ) : (
                    <Upload size={20} color="#ff4e00" />
                  )}
                  <span style={{ ...styles.dropzoneText, color: isDark ? '#a3a3a3' : '#525252' }}>
                    {uploadStatus === 'uploading' ? "Processing Context..." : "Upload Document (PDF/PNG)"}
                  </span>
                  <input 
                    type="file" 
                    accept=".pdf,.png,.jpg,.jpeg" 
                    onChange={handleFileChange} 
                    disabled={uploadStatus === 'uploading'}
                    style={{ display: 'none' }} 
                  />
                </label>
                {uploadStatus === 'success' && <div style={{ ...styles.alert, ...styles.success }}><CheckCircle size={14} /> {uploadMessage}</div>}
                {uploadStatus === 'error' && <div style={{ ...styles.alert, ...styles.error }}><AlertCircle size={14} /> {uploadMessage}</div>}
              </div>
            )}
          </div>

          {/* INTERACTIVE STREAM WORKSPACE AREA */}
          <div style={{ ...styles.chatArea, backgroundColor: c_bg }}>
            {/* Ambient Fixed Bot Companion Row (Occupies its own layout row) */}
            {(hasAnimated || isTransitioning || activeSessionId) && (
              <div style={{ ...styles.botExclusiveRow, borderColor: c_border, backgroundColor: c_bg }}>
                <div style={{ ...styles.miniBotHead, backgroundColor: isDark ? '#404040' : '#f4f4f5', borderColor: c_border }}>
                  <div style={styles.miniBotEyeRow}>
                    <div style={styles.miniBotEye} />
                    <div style={styles.miniBotEye} />
                  </div>
                </div>
              </div>
            )}

            {activeSessionId && !isTransitioning ? (
              <>
                <div style={styles.chatScroller}>
                  {messages.length === 0 ? (
                    <div style={styles.emptyState}>
                      <MessageSquare size={44} color={isDark ? '#404040' : '#e5e5e5'} style={{ marginBottom: '12px' }} />
                      <p style={{ color: c_subtext, fontSize: '14px' }}>Ready to chat. Ask a question about your documents.</p>
                    </div>
                  ) : (
                    messages.map((m, idx) => (
                      <div key={idx} style={m.sender === 'human' ? styles.humanBubbleRow : styles.aiBubbleRow}>
                        <div style={m.sender === 'human' ? styles.humanBubble : { ...styles.aiBubble, backgroundColor: c_bubble_ai, color: c_text }}>
                          <div>{m.text}</div>
                          <div style={styles.bubbleActionShelf}>
                            <button 
                              type="button" 
                              style={m.sender === 'human' ? styles.copyBtnHuman : styles.copyBtnAi} 
                              onClick={(e) => copyToClipboard(m.text, e)}
                              title="Copy text"
                            >
                              <Copy size={13} strokeWidth={3} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={chatEndRef} />
                </div>

                <form onSubmit={handleChatSubmit} style={{ ...styles.inputStrip, backgroundColor: c_bg, borderColor: c_border }}>
                  <input 
                    type="text" 
                    ref={chatInputRef}
                    placeholder="Ask anything... " 
                    disabled={isStreaming} 
                    style={{ ...styles.chatInput, backgroundColor: c_input, color: c_text, borderColor: c_border }} 
                    className="validated-input"
                    value={chatInput} 
                    onChange={e => setChatInput(e.target.value)}
                    autoFocus
                  />
                  <button type="submit" disabled={isStreaming || !chatInput.trim()} style={styles.sendBtn}>
                    {isStreaming ? <Loader2 size={16} style={{ animation: 'spin-loop 1s linear infinite' }} /> : <Send size={16} />}
                  </button>
                </form>
              </>
            ) : (
              <div style={styles.emptyState}>
                {/* OMNIDOC CUSTOM BOT FACE CHARACTER */}
                {!hasAnimated && (
                  <div style={{
                    ...styles.botFaceContainer,
                    animation: isTransitioning ? 'botFlyAwayAndShrink 0.7s cubic-bezier(0.25, 1, 0.5, 1) forwards' : 'none'
                  }}>
                    <div style={styles.botAntenna} />
                    <div style={{ ...styles.botHead, backgroundColor: isDark ? '#262626' : '#f4f4f5', borderColor: c_border }}>
                      <div style={styles.botEarLeft} />
                      <div style={styles.botEyeRow}>
                        <div style={styles.botEye}><div style={styles.botPupil} /></div>
                        <div style={styles.botEye}><div style={styles.botPupil} /></div>
                      </div>
                      <div style={styles.botMouth} />
                      <div style={styles.botEarRight} />
                    </div>
                  </div>
                )}
                
                <p style={{ fontSize: '18px', fontWeight: '700', color: c_text, marginTop: '8px', opacity: isTransitioning ? 0 : 1, transition: 'opacity 0.2s' }}>
                  OmniDoc Assistant Workspace
                </p>
                <p style={{ color: c_subtext, marginTop: '6px', fontSize: '14px', marginBottom: '24px', maxWidth: '320px', opacity: isTransitioning ? 0 : 1, transition: 'opacity 0.2s' }}>
                  No workspace loaded. Launch a brand new session thread to begin parsing files.
                </p>
                <button 
                  onClick={createNewWorkspaceSession} 
                  disabled={isTransitioning}
                  style={{ ...styles.button, width: 'auto', paddingLeft: '24px', paddingRight: '24px', opacity: isTransitioning ? 0 : 1, transition: 'opacity 0.2s' }}
                >
                  <Plus size={16} /> Create Chat Session
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* WEBAPP DIALOGUE MODAL FOR CHAT DELETIONS */}
      {deleteModal.isOpen && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalCard, backgroundColor: c_bg, borderColor: c_border }}>
            <h3 style={{ ...styles.modalTitle, color: c_text }}>Delete Chat Thread?</h3>
            <p style={{ ...styles.modalBody, color: c_subtext }}>Are you sure you want to delete this conversation permanently? This operation cannot be reversed.</p>
            <div style={styles.modalActionRow}>
              <button style={{ ...styles.modalCancelBtn, backgroundColor: c_bg, color: c_text, borderColor: c_border }} onClick={() => setDeleteModal({ isOpen: false, sessionId: null })}>Cancel</button>
              <button style={styles.modalConfirmBtn} onClick={confirmDeleteSession}>Delete Thread</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------
// DESIGN SYSTEM STYLES (DYNAMIC MODE INTERPOLATION ENGINE)
// ---------------------------------------------------------
const styles = {
  globalResetStyles: (isDark) => `
    * {
      box-shadow: none !important;
      -webkit-box-shadow: none !important;
    }
    body, html, #root {
      background-color: ${isDark ? '#171717' : '#ffffff'} !important;
      margin: 0;
      padding: 0;
    }
    .validated-input:-webkit-autofill,
    .validated-input:-webkit-autofill:hover, 
    .validated-input:-webkit-autofill:focus {
      -webkit-text-fill-color: ${isDark ? '#f5f5f5' : '#171717'} !important;
      -webkit-box-shadow: 0 0 0px 1000px ${isDark ? '#171717' : '#ffffff'} inset !important;
      box-shadow: 0 0 0px 1000px ${isDark ? '#171717' : '#ffffff'} inset !important;
      transition: background-color 5000s ease-in-out 0s;
    }
  `,
  animationKeyframes: `
    @keyframes spin-loop {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    @keyframes botFlyAwayAndShrink {
      0% {
        transform: translate(0, 0) scale(1);
        opacity: 1;
      }
      100% {
        transform: translate(36vw, -36vh) scale(0.35);
        opacity: 0;
      }
    }
    @keyframes fadeInMiniBot {
      0% { opacity: 0; transform: scale(0.7); }
      100% { opacity: 1; transform: scale(1); }
    }
  `,
  authLayout: { height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' },
  authCard: { width: '400px', padding: '36px', borderRadius: '10px', border: '1px solid' },
  inputWrapper: { display: 'flex', alignItems: 'center', border: '1px solid', borderRadius: '10px', padding: '0 12px' },
  inputIcon: { marginRight: '8px' },
  authInput: { width: '100%', border: 'none', padding: '12px 0', outline: 'none', fontSize: '14px' }, 
  authErrorBlock: { display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626', backgroundColor: '#fef2f2', padding: '10px', borderRadius: '10px', fontSize: '13px' },
  toggleAuthModeText: { textAlign: 'center', marginTop: '20px', fontSize: '13px', color: '#737373' },
  toggleLink: { color: '#ff4e00', fontWeight: '600', cursor: 'pointer', textDecoration: 'none' },
  
  workspace: { display: 'flex', height: '100vh', width: '100vw', fontFamily: 'system-ui, sans-serif', overflow: 'hidden' },
  sidebar: { width: '290px', minWidth: '290px', borderRight: '1px solid', padding: '24px 16px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' },
  sidebarHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  title: { margin: 0, fontSize: '19px', fontWeight: '800', letterSpacing: '-0.025em' },
  subtitle: { margin: 0, fontSize: '11px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' },
  logoutBtn: { padding: '7px', border: 'none', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  sidebarRoundToggle: { width: '29px', height: '29px', borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 },
  button: { width: '100%', padding: '11px', backgroundColor: '#ff4e00', color: '#ffffff', border: 'none', borderRadius: '10px', fontWeight: '600', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'background 0.2s' },
  sessionScroller: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '16px' },
  sessionItem: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 8px', borderRadius: '10px', cursor: 'pointer' },
  sessionTitle: { fontSize: '13px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', width: '140px' },
  inlineRenameInput: { fontSize: '13px', border: '1px solid', borderRadius: '6px', padding: '2px 4px', width: '140px', outline: 'none' },
  sessionActionRow: { display: 'flex', gap: '8px', marginLeft: 'auto', flexShrink: 0 },
  actionIcon: { color: '#a3a3a3', cursor: 'pointer' },
  actionIconDanger: { color: '#a3a3a3', cursor: 'pointer' },
  uploadBoundary: { borderTop: '1px solid', paddingTop: '16px' },
  dropzone: { border: '1px dashed', borderRadius: '10px', padding: '16px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', marginBottom: '8px' },
  dropzoneText: { marginTop: '6px', fontSize: '11px', textAlign: 'center', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' },
  alert: { padding: '8px', borderRadius: '10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' },
  success: { backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' },
  error: { backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' },
  
  chatArea: { flex: 1, display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' },
  chatScroller: { flex: 1, padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', flex: 1, padding: '20px', position: 'relative', overflow: 'hidden' },
  humanBubbleRow: { display: 'flex', justifyContent: 'flex-end' },
  aiBubbleRow: { display: 'flex', justifyContent: 'flex-start' },
  
  humanBubble: { maxWidth: '75%', backgroundColor: '#ff4e00', color: '#ffffff', padding: '14px 18px', borderRadius: '18px 18px 2px 18px', fontSize: '14px', lineHeight: '1.5', fontWeight: '500', display: 'flex', flexDirection: 'column', gap: '6px' },
  aiBubble: { maxWidth: '75%', padding: '14px 18px', borderRadius: '18px 18px 18px 2px', fontSize: '14px', lineHeight: '1.55', whiteSpace: 'pre-wrap', display: 'flex', flexDirection: 'column', gap: '6px' },
  bubbleActionShelf: { display: 'flex', justifyContent: 'flex-end' },
  
  copyBtnAi: { display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: '#737373', cursor: 'pointer', padding: '3px', borderRadius: '4px' },
  copyBtnHuman: { display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.9)', cursor: 'pointer', padding: '3px', borderRadius: '4px' },

  inputStrip: { padding: '16px 32px', borderTop: '1px solid', display: 'flex', gap: '12px', alignItems: 'center' },
  chatInput: { flex: 1, padding: '14px 18px', border: '1px solid', borderRadius: '10px', fontSize: '14px', outline: 'none' }, 
  sendBtn: { padding: '14px 16px', backgroundColor: '#ff4e00', color: '#ffffff', border: 'none', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  
  modalOverlay: { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalCard: { width: '360px', padding: '24px', borderRadius: '10px', fontFamily: 'system-ui, sans-serif', border: '1px solid' },
  modalTitle: { margin: '0 0 10px 0', fontSize: '16px', fontWeight: '700' },
  modalBody: { margin: '0 0 20px 0', fontSize: '14px', lineHeight: '1.4' },
  modalActionRow: { display: 'flex', justifyContent: 'flex-end', gap: '12px' },
  modalCancelBtn: { padding: '8px 14px', border: '1px solid', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' },
  modalConfirmBtn: { padding: '8px 14px', border: 'none', borderRadius: '10px', backgroundColor: '#dc2626', color: '#ffffff', cursor: 'pointer', fontSize: '13px', fontWeight: '600' },

  // Base Vectors
  botFaceContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', width: '100px', marginBottom: '16px', transformOrigin: 'center center' },
  botAntenna: { width: '4px', height: '12px', backgroundColor: '#d4d4d4', borderRadius: '2px', position: 'relative', marginBottom: '-2px' },
  botHead: { width: '74px', height: '60px', border: '3px solid', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', gap: '8px' },
  botEarLeft: { position: 'absolute', left: '-7px', top: '22px', width: '6px', height: '14px', backgroundColor: '#d4d4d4', borderRadius: '3px 0 0 3px' },
  botEarRight: { position: 'absolute', right: '-7px', top: '22px', width: '6px', height: '14px', backgroundColor: '#d4d4d4', borderRadius: '0 3px 3px 0' },
  botEyeRow: { display: 'flex', gap: '12px' },
  botEye: { width: '14px', height: '14px', backgroundColor: '#ff4e00', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  botPupil: { width: '4px', height: '4px', backgroundColor: '#ffffff', borderRadius: '50%' },
  botMouth: { width: '28px', height: '4px', backgroundColor: '#a3a3a3', borderRadius: '2px' },

  // Dedicated Bot Isolated Row (Prevents overlap with logs)
  botExclusiveRow: { width: '100%', display: 'flex', justifyContent: 'flex-end', padding: '16px 24px', boxSizing: 'border-box', borderBottom: '1px solid' },
  miniBotHead: { width: '38px', height: '30px', border: '2px solid', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeInMiniBot 0.4s ease forwards' },
  miniBotEyeRow: { display: 'flex', gap: '6px' },
  miniBotEye: { width: '6px', height: '6px', backgroundColor: '#ff4e00', borderRadius: '50%' }
};