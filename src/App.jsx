import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { request } from './api';
import './App.css';

// Academic SweetAlert2 Notification Helpers
const notifySuccess = (title, text = '') => {
  Swal.fire({
    icon: 'success',
    title,
    text,
    timer: 2000,
    showConfirmButton: false,
    confirmButtonColor: '#002147'
  });
};

const notifyError = (text) => {
  Swal.fire({
    icon: 'error',
    title: 'Action Failed',
    text,
    confirmButtonColor: '#002147'
  });
};

const confirmDialog = async (title, text = '') => {
  const result = await Swal.fire({
    title,
    text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#dc2626',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'Confirm'
  });
  return result.isConfirmed;
};

// Tricky Utility: Secure Password Generator
const generateStrongPassword = () => {
  const alphaUpper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const alphaLower = 'abcdefghijkmnpqrstuvwxyz';
  const numbers = '23456789';
  const symbols = '!@#$%^&*';
  const all = alphaUpper + alphaLower + numbers + symbols;

  let pwd = '';
  pwd += alphaUpper.charAt(Math.floor(Math.random() * alphaUpper.length));
  pwd += alphaLower.charAt(Math.floor(Math.random() * alphaLower.length));
  pwd += numbers.charAt(Math.floor(Math.random() * numbers.length));
  pwd += symbols.charAt(Math.floor(Math.random() * symbols.length));

  for (let i = 4; i < 12; i++) {
    pwd += all.charAt(Math.floor(Math.random() * all.length));
  }
  return pwd.split('').sort(() => 0.5 - Math.random()).join('');
};

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [activeTab, setActiveTab] = useState('notes');
  const [systemHealth, setSystemHealth] = useState({ status: 'Connecting...', database: 'Checking' });

  // Custom Inline Toast State (No big popups for minor actions)
  const [inlineToast, setInlineToast] = useState('');

  // Auth Form State
  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [authData, setAuthData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user',
    interests: 'chess, reading'
  });

  // Notes State & Enterprise Table Controls
  const [notes, setNotes] = useState([]);
  const [notePage, setNotePage] = useState(1);
  const [notePages, setNotePages] = useState(1);
  const [noteSearch, setNoteSearch] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'table'
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest', 'oldest', 'alpha'
  const [newNote, setNewNote] = useState({ title: '', content: '' });
  const [editingNote, setEditingNote] = useState(null);

  // Aggregation 1 State (Group by Interests)
  const [interestsData, setInterestsData] = useState([]);
  const [loadingInterests, setLoadingInterests] = useState(false);

  // Aggregation 2 State (Posts & $lookup)
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState({ title: '', content: '' });
  const [lookupUserId, setLookupUserId] = useState('');
  const [lookupResult, setLookupResult] = useState(null);

  // Admin Users State
  const [adminUsers, setAdminUsers] = useState([]);
  const [userPage, setUserPage] = useState(1);
  const [userPages, setUserPages] = useState(1);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [newAdminUser, setNewAdminUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user',
    interests: ''
  });

  // Display custom inline toast for 2.5 seconds
  const triggerInlineToast = (msg) => {
    setInlineToast(msg);
    setTimeout(() => setInlineToast(''), 2500);
  };

  // Check backend health on initial load
  useEffect(() => {
    request('/api/health')
      .then((data) => setSystemHealth(data))
      .catch(() => setSystemHealth({ status: 'offline', database: 'Disconnected' }));
  }, []);

  // Fetch relevant data on tab or page change
  useEffect(() => {
    if (user && activeTab === 'notes') {
      fetchNotes(notePage);
    }
    if (user && activeTab === 'interests') {
      fetchInterests();
    }
    if (user && activeTab === 'posts') {
      fetchPosts();
    }
    if (user && user.role === 'admin' && activeTab === 'admin') {
      fetchAdminUsers(userPage);
    }
  }, [user, activeTab, notePage, userPage]);

  // Copy helper
  const copyToClipboard = (text, label = 'Copied') => {
    navigator.clipboard.writeText(text);
    triggerInlineToast(`✓ ${label}`);
  };

  // --- AUTH HANDLERS ---
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
      const payload = isRegister
        ? {
            ...authData,
            interests: authData.interests.split(',').map((i) => i.trim()).filter(Boolean)
          }
        : { email: authData.email, password: authData.password };

      const data = await request(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data));
      setUser(data);
      notifySuccess(isRegister ? 'Account Registered' : 'Authentication Successful', `Welcome, ${data.name}`);
    } catch (err) {
      notifyError(err.message);
    }
  };

  const handleLogout = async () => {
    const confirmed = await confirmDialog('Sign Out', 'Are you sure you wish to log out?');
    if (!confirmed) return;

    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setNotes([]);
    notifySuccess('Signed Out', 'You have been safely disconnected');
  };

  // --- NOTES HANDLERS ---
  const fetchNotes = async (page = 1) => {
    try {
      const data = await request(`/api/notes?page=${page}&limit=6`);
      setNotes(data.notes || []);
      setNotePage(data.page || 1);
      setNotePages(data.pages || 1);
    } catch (err) {
      notifyError(err.message);
    }
  };

  const handleCreateNote = async (e) => {
    e.preventDefault();
    try {
      await request('/api/notes', {
        method: 'POST',
        body: JSON.stringify(newNote)
      });
      setNewNote({ title: '', content: '' });
      notifySuccess('Note Saved', 'Record added to repository');
      fetchNotes(1);
    } catch (err) {
      notifyError(err.message);
    }
  };

  const handleUpdateNote = async (e) => {
    e.preventDefault();
    try {
      await request(`/api/notes/${editingNote._id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: editingNote.title,
          content: editingNote.content
        })
      });
      setEditingNote(null);
      notifySuccess('Note Updated', 'Modifications saved');
      fetchNotes(notePage);
    } catch (err) {
      notifyError(err.message);
    }
  };

  const handleDeleteNote = async (id) => {
    const confirmed = await confirmDialog('Delete Record', 'This action will permanently delete this note.');
    if (!confirmed) return;

    try {
      await request(`/api/notes/${id}`, { method: 'DELETE' });
      notifySuccess('Deleted', 'Note record removed');
      fetchNotes(notePage);
    } catch (err) {
      notifyError(err.message);
    }
  };

  // Export Notes to CSV (Enterprise academic reporting)
  const exportNotesToCSV = () => {
    if (!notes.length) {
      notifyError('No notes available to export.');
      return;
    }
    const headers = 'ID,Title,Content,Author,Created Date\n';
    const rows = notes
      .map((n) => {
        const title = `"${n.title.replace(/"/g, '""')}"`;
        const content = `"${n.content.replace(/"/g, '""')}"`;
        const author = n.user ? `"${n.user.name}"` : '"Me"';
        const date = `"${new Date(n.createdAt).toLocaleDateString()}"`;
        return `${n._id},${title},${content},${author},${date}`;
      })
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notes_export_${Date.now()}.csv`;
    a.click();
    triggerInlineToast('✓ Exported to CSV');
  };

  // Filter & Sort notes locally
  const processedNotes = notes
    .filter(
      (n) =>
        n.title.toLowerCase().includes(noteSearch.toLowerCase()) ||
        n.content.toLowerCase().includes(noteSearch.toLowerCase())
    )
    .sort((a, b) => {
      if (sortOrder === 'alpha') return a.title.localeCompare(b.title);
      if (sortOrder === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

  // --- AGGREGATION 1: GROUP BY INTERESTS ---
  const fetchInterests = async () => {
    setLoadingInterests(true);
    try {
      const data = await request('/api/users/by-interests');
      setInterestsData(data);
    } catch (err) {
      notifyError(err.message);
    } finally {
      setLoadingInterests(false);
    }
  };

  // --- AGGREGATION 2: USER POSTS ($lookup) ---
  const fetchPosts = async () => {
    try {
      const data = await request('/api/posts?limit=10');
      setPosts(data.posts || []);
    } catch (err) {
      notifyError(err.message);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    try {
      await request('/api/posts', {
        method: 'POST',
        body: JSON.stringify(newPost)
      });
      setNewPost({ title: '', content: '' });
      notifySuccess('Post Published', 'Visible across the public platform');
      fetchPosts();
    } catch (err) {
      notifyError(err.message);
    }
  };

  const handleLookup = async (idToLookup) => {
    const id = idToLookup || lookupUserId;
    if (!id) {
      notifyError('Please specify a valid User ID to perform $lookup aggregation.');
      return;
    }
    try {
      const data = await request(`/api/posts/user/${id}`);
      setLookupResult(data);
      notifySuccess('$lookup Successful', `Aggregated ${data.posts ? data.posts.length : 0} posts for ${data.name}`);
    } catch (err) {
      notifyError(err.message);
    }
  };

  // --- ADMIN USER MANAGEMENT HANDLERS ---
  const fetchAdminUsers = async (page = 1) => {
    try {
      const data = await request(`/api/users?page=${page}&limit=5`);
      setAdminUsers(data.users || []);
      setUserPage(data.page || 1);
      setUserPages(data.pages || 1);
    } catch (err) {
      notifyError(err.message);
    }
  };

  const handleAddAdminUser = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...newAdminUser,
        interests: newAdminUser.interests.split(',').map((i) => i.trim()).filter(Boolean)
      };
      await request('/api/users', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setNewAdminUser({ name: '', email: '', password: '', role: 'user', interests: '' });
      notifySuccess('User Created', 'New member enrolled in system');
      fetchAdminUsers(userPage);
    } catch (err) {
      notifyError(err.message);
    }
  };

  const handleDeleteAdminUser = async (id) => {
    const confirmed = await confirmDialog('Remove Member', 'Are you certain you wish to remove this user?');
    if (!confirmed) return;

    try {
      await request(`/api/users/${id}`, { method: 'DELETE' });
      notifySuccess('Member Removed', 'User record cleared');
      fetchAdminUsers(userPage);
    } catch (err) {
      notifyError(err.message);
    }
  };

  // Dynamic Password Validation Rules for Registration
  const pass = authData.password;
  const ruleLength = pass.length >= 8;
  const ruleUpper = /[A-Z]/.test(pass);
  const ruleNumber = /[0-9]/.test(pass);
  const ruleSymbol = /[^A-Za-z0-9]/.test(pass);

  // --- IF NOT LOGGED IN: ACADEMIC AUTHENTICATION SCREEN ---
  if (!user) {
    return (
      <div className="container" style={{ maxWidth: '450px', marginTop: '60px' }}>
        <div className="academic-panel">
          <div className="panel-header-row">
            <div>
              <h2 className="panel-heading">{isRegister ? 'New Account Registration' : 'Institutional Sign In'}</h2>
              <p className="panel-subtext">Secure Note-Taking Platform with Role-Based Access Control</p>
            </div>
          </div>

          <form onSubmit={handleAuthSubmit}>
            {isRegister && (
              <div className="field-group">
                <label className="field-label">Full Name</label>
                <input
                  type="text"
                  required
                  className="field-input"
                  value={authData.name}
                  onChange={(e) => setAuthData({ ...authData, name: e.target.value })}
                  placeholder="e.g. Shihab Candidate"
                />
              </div>
            )}

            <div className="field-group">
              <label className="field-label">Email Address</label>
              <input
                type="email"
                required
                className="field-input"
                value={authData.email}
                onChange={(e) => setAuthData({ ...authData, email: e.target.value })}
                placeholder="name@example.com"
              />
            </div>

            <div className="field-group">
              <div className="field-label-row">
                <label className="field-label">Password</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {inlineToast && <span className="custom-inline-toast">{inlineToast}</span>}
                  {isRegister && (
                    <button
                      type="button"
                      className="action-link-btn"
                      onClick={() => {
                        const strong = generateStrongPassword();
                        setAuthData({ ...authData, password: strong });
                        setShowPassword(true);
                        triggerInlineToast('✓ Strong Password Generated');
                      }}
                    >
                      Suggest Strong Password
                    </button>
                  )}
                </div>
              </div>
              <div className="password-field-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="field-input"
                  value={authData.password}
                  onChange={(e) => setAuthData({ ...authData, password: e.target.value })}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  title={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Professional Dynamic Password Criteria Checklist */}
              {isRegister && (
                <div className="password-checklist-pills">
                  <span className={`rule-pill ${ruleLength ? 'valid' : ''}`}>
                    {ruleLength ? '✓' : '•'} 8+ Characters
                  </span>
                  <span className={`rule-pill ${ruleUpper ? 'valid' : ''}`}>
                    {ruleUpper ? '✓' : '•'} Uppercase (A-Z)
                  </span>
                  <span className={`rule-pill ${ruleNumber ? 'valid' : ''}`}>
                    {ruleNumber ? '✓' : '•'} Number (0-9)
                  </span>
                  <span className={`rule-pill ${ruleSymbol ? 'valid' : ''}`}>
                    {ruleSymbol ? '✓' : '•'} Symbol (!@#)
                  </span>
                </div>
              )}
            </div>

            {isRegister && (
              <>
                <div className="field-group">
                  <label className="field-label">Account Role Assignment</label>
                  <select
                    className="field-select"
                    value={authData.role}
                    onChange={(e) => setAuthData({ ...authData, role: e.target.value })}
                  >
                    <option value="user">User (Standard account)</option>
                    <option value="admin">Admin (System supervisor)</option>
                  </select>
                </div>

                <div className="field-group">
                  <label className="field-label">Research / Personal Interests</label>
                  <input
                    type="text"
                    className="field-input"
                    value={authData.interests}
                    onChange={(e) => setAuthData({ ...authData, interests: e.target.value })}
                    placeholder="chess, reading, tech"
                  />
                  <p className="field-hint">Comma-separated entries for MongoDB Scenario 1 aggregation.</p>
                </div>
              </>
            )}

            <button type="submit" className="btn-gov btn-gov-primary" style={{ width: '100%', marginTop: '8px', padding: '10px' }}>
              {isRegister ? 'Complete Registration' : 'Sign In'}
            </button>
          </form>

          <div style={{ marginTop: '20px', textAlign: 'left', fontSize: '13px', color: 'var(--text-muted)' }}>
            {isRegister ? 'Already registered?' : 'Need an account?'}{' '}
            <button
              type="button"
              onClick={() => setIsRegister(!isRegister)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary-navy)',
                fontWeight: 700,
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              {isRegister ? 'Sign in here' : 'Register here'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- LOGGED IN INSTITUTIONAL DASHBOARD ---
  return (
    <div className="container">
      {/* Top Academic Header */}
      <header className="portal-header">
        <div>
          <h1 className="portal-title">Secure Note-Taking Portal</h1>
          <p className="portal-subtitle">
            Authenticated: <strong>{user.name}</strong> &lt;{user.email}&gt;
          </p>
        </div>
        <div className="header-user-info">
          {inlineToast && <span className="custom-inline-toast">{inlineToast}</span>}
          <span className="health-status-pill">
            <span className="health-dot"></span>
            DB {systemHealth.database || 'Online'}
          </span>
          <span className={`badge-role ${user.role}`}>{user.role}</span>
          <button className="btn-gov btn-gov-secondary btn-gov-sm" onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </header>

      {/* Clean Horizontal Tabs */}
      <nav className="portal-tabs">
        <button
          className={`tab-link ${activeTab === 'notes' ? 'active' : ''}`}
          onClick={() => setActiveTab('notes')}
        >
          Notes Repository {user.role === 'admin' ? '(Admin View)' : '(Personal)'}
        </button>
        <button
          className={`tab-link ${activeTab === 'interests' ? 'active' : ''}`}
          onClick={() => setActiveTab('interests')}
        >
          Scenario 1: Group by Interests
        </button>
        <button
          className={`tab-link ${activeTab === 'posts' ? 'active' : ''}`}
          onClick={() => setActiveTab('posts')}
        >
          Scenario 2: User Posts ($lookup)
        </button>
        {user.role === 'admin' && (
          <button
            className={`tab-link ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => setActiveTab('admin')}
          >
            Administration Panel
          </button>
        )}
      </nav>

      {/* ========================================================================= */}
      {/* TAB 1: NOTES REPOSITORY (CRUD + DATA TABLE / GRID + PAGINATION) */}
      {/* ========================================================================= */}
      {activeTab === 'notes' && (
        <div>
          {/* Note Composition Panel */}
          <div className="academic-panel">
            <div className="panel-header-row">
              <h3 className="panel-heading">{editingNote ? 'Modify Note Record' : 'Compose New Note'}</h3>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {(editingNote ? editingNote.content : newNote.content).length} characters
              </span>
            </div>
            <form onSubmit={editingNote ? handleUpdateNote : handleCreateNote}>
              <div className="field-group">
                <label className="field-label">Record Title</label>
                <input
                  type="text"
                  required
                  className="field-input"
                  placeholder="Enter title..."
                  value={editingNote ? editingNote.title : newNote.title}
                  onChange={(e) =>
                    editingNote
                      ? setEditingNote({ ...editingNote, title: e.target.value })
                      : setNewNote({ ...newNote, title: e.target.value })
                  }
                />
              </div>
              <div className="field-group">
                <label className="field-label">Content Body</label>
                <textarea
                  required
                  className="field-textarea"
                  placeholder="Write note contents..."
                  value={editingNote ? editingNote.content : newNote.content}
                  onChange={(e) =>
                    editingNote
                      ? setEditingNote({ ...editingNote, content: e.target.value })
                      : setNewNote({ ...newNote, content: e.target.value })
                  }
                />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" className="btn-gov btn-gov-primary">
                  {editingNote ? 'Update Note' : 'Save Note'}
                </button>
                {editingNote && (
                  <button
                    type="button"
                    className="btn-gov btn-gov-secondary"
                    onClick={() => setEditingNote(null)}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Records Display Panel with Enterprise Controls */}
          <div className="academic-panel">
            <div className="panel-header-row">
              <div>
                <h3 className="panel-heading">
                  {user.role === 'admin' ? 'All System Notes (Administrator View)' : 'Your Notes Collection'}
                </h3>
                <p className="panel-subtext">
                  Supported by index: {user.role === 'admin' ? '{ createdAt: -1 }' : '{ user: 1, createdAt: -1 }'}
                </p>
              </div>

              {/* Data Table Controls Bar */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Search */}
                <input
                  type="text"
                  className="field-input"
                  style={{ width: '180px', padding: '6px 10px', fontSize: '13px' }}
                  placeholder="Search notes..."
                  value={noteSearch}
                  onChange={(e) => setNoteSearch(e.target.value)}
                />

                {/* Sort Order Dropdown */}
                <select
                  className="field-select"
                  style={{ width: '120px', padding: '6px 8px', fontSize: '12px' }}
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                >
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="alpha">A-Z Title</option>
                </select>

                {/* View Mode Toggle */}
                <div className="view-mode-toggle">
                  <button
                    className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                    onClick={() => setViewMode('grid')}
                  >
                    Cards
                  </button>
                  <button
                    className={`view-btn ${viewMode === 'table' ? 'active' : ''}`}
                    onClick={() => setViewMode('table')}
                  >
                    Table
                  </button>
                </div>

                {/* Export CSV button */}
                <button
                  className="btn-gov btn-gov-secondary btn-gov-sm"
                  title="Export notes to CSV file"
                  onClick={exportNotesToCSV}
                >
                  Export CSV
                </button>
              </div>
            </div>

            {processedNotes.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', padding: '24px 0', textAlign: 'left' }}>
                No records match current parameters.
              </p>
            ) : viewMode === 'grid' ? (
              /* Grid Card View */
              <div className="notes-container-grid">
                {processedNotes.map((note) => (
                  <div key={note._id} className="single-note-card">
                    <div>
                      <h4 className="note-card-title">{note.title}</h4>
                      <p className="note-card-text">{note.content}</p>
                    </div>
                    <div>
                      <div className="note-card-bottom">
                        <span>
                          {user.role === 'admin' && note.user
                            ? `Author: ${note.user.name}`
                            : new Date(note.createdAt).toLocaleDateString()}
                        </span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            className="btn-gov btn-gov-secondary btn-gov-sm"
                            onClick={() => setEditingNote(note)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn-gov btn-gov-danger btn-gov-sm"
                            onClick={() => handleDeleteNote(note._id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Enterprise Data Table View */
              <div style={{ overflowX: 'auto' }}>
                <table className="academic-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Content Excerpt</th>
                      <th>Author</th>
                      <th>Date</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {processedNotes.map((note) => (
                      <tr key={note._id}>
                        <td>
                          <strong>{note.title}</strong>
                        </td>
                        <td style={{ color: 'var(--text-muted)', maxWidth: '280px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {note.content}
                        </td>
                        <td>{note.user ? note.user.name : 'You'}</td>
                        <td>{new Date(note.createdAt).toLocaleDateString()}</td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button
                            className="btn-gov btn-gov-secondary btn-gov-sm"
                            style={{ marginRight: '6px' }}
                            onClick={() => setEditingNote(note)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn-gov btn-gov-danger btn-gov-sm"
                            onClick={() => handleDeleteNote(note._id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {notePages > 1 && (
              <div className="academic-pagination">
                <button
                  className="btn-gov btn-gov-secondary btn-gov-sm"
                  disabled={notePage <= 1}
                  onClick={() => setNotePage((p) => Math.max(p - 1, 1))}
                >
                  &larr; Previous Page
                </button>
                <span>
                  Page <strong>{notePage}</strong> of <strong>{notePages}</strong>
                </span>
                <button
                  className="btn-gov btn-gov-secondary btn-gov-sm"
                  disabled={notePage >= notePages}
                  onClick={() => setNotePage((p) => Math.min(p + 1, notePages))}
                >
                  Next Page &rarr;
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: AGGREGATION SCENARIO 1 (GROUP BY INTERESTS) */}
      {/* ========================================================================= */}
      {activeTab === 'interests' && (
        <div className="academic-panel">
          <div className="panel-header-row">
            <div>
              <h3 className="panel-heading">Aggregation Scenario 1: Group by Interests</h3>
              <p className="panel-subtext">
                Constraint: Single <code>collection.aggregate()</code> call using $unwind, $group, and $sort.
              </p>
            </div>
            <button className="btn-gov btn-gov-secondary btn-gov-sm" onClick={fetchInterests}>
              Refresh Aggregation
            </button>
          </div>

          {loadingInterests ? (
            <p style={{ padding: '20px 0', color: 'var(--text-muted)' }}>Executing MongoDB aggregation pipeline...</p>
          ) : interestsData.length === 0 ? (
            <p style={{ padding: '20px 0', color: 'var(--text-muted)' }}>No interests data available.</p>
          ) : (
            <div>
              {interestsData.map((group) => (
                <div
                  key={group.interest}
                  style={{
                    borderBottom: '1px solid var(--border-light)',
                    padding: '12px 0'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="meta-tag">{group.interest}</span>
                    <strong style={{ fontSize: '13px' }}>
                      {group.totalUsers} {group.totalUsers === 1 ? 'User' : 'Users'}
                    </strong>
                  </div>
                  <ul style={{ paddingLeft: '20px', marginTop: '6px', fontSize: '13px', textAlign: 'left' }}>
                    {group.users.map((u) => (
                      <li key={u._id} style={{ margin: '3px 0' }}>
                        {u.name} — <span style={{ color: 'var(--text-muted)' }}>{u.email}</span> (
                        <span style={{ fontSize: '11px', textTransform: 'uppercase' }}>{u.role}</span>){' '}
                        <button
                          className="action-link-btn"
                          style={{ marginLeft: '6px', fontSize: '11px' }}
                          onClick={() => copyToClipboard(u._id, 'User ID Copied')}
                        >
                          Copy ID
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: AGGREGATION SCENARIO 2 (POSTS & $lookup) */}
      {/* ========================================================================= */}
      {activeTab === 'posts' && (
        <div>
          {/* Post Creation */}
          <div className="academic-panel">
            <div className="panel-header-row">
              <div>
                <h3 className="panel-heading">Publish Public Post</h3>
                <p className="panel-subtext">Stored in Posts collection; visible to everyone.</p>
              </div>
            </div>
            <form onSubmit={handleCreatePost}>
              <div className="field-group">
                <label className="field-label">Post Title</label>
                <input
                  type="text"
                  required
                  className="field-input"
                  placeholder="Enter post title..."
                  value={newPost.title}
                  onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                />
              </div>
              <div className="field-group">
                <label className="field-label">Post Content</label>
                <textarea
                  required
                  className="field-textarea"
                  placeholder="Write post content..."
                  value={newPost.content}
                  onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                />
              </div>
              <button type="submit" className="btn-gov btn-gov-primary">
                Publish Post
              </button>
            </form>
          </div>

          {/* Interactive $lookup Inspection */}
          <div className="academic-panel" style={{ borderLeft: '4px solid var(--primary-navy)' }}>
            <div className="panel-header-row">
              <div>
                <h3 className="panel-heading">Scenario 2: User Posts ($lookup Stage)</h3>
                <p className="panel-subtext">
                  Constraint: Single aggregation pipeline with <code>$lookup</code> stage. Supported by index{' '}
                  <code>postSchema.index({'{ user: 1 }'})</code>.
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              <input
                type="text"
                className="field-input"
                placeholder="Paste Target User ObjectId or click button below"
                value={lookupUserId}
                onChange={(e) => setLookupUserId(e.target.value)}
              />
              <button className="btn-gov btn-gov-primary" onClick={() => handleLookup()}>
                Run $lookup
              </button>
            </div>

            {lookupResult && (
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '14px',
                  fontSize: '13px',
                  textAlign: 'left'
                }}
              >
                <h4 style={{ color: 'var(--primary-navy)' }}>
                  User: {lookupResult.name} &lt;{lookupResult.email}&gt;
                </h4>
                <p style={{ color: 'var(--text-muted)', margin: '4px 0 10px 0' }}>
                  Total Joined Posts: <strong>{lookupResult.posts ? lookupResult.posts.length : 0}</strong>
                </p>
                {lookupResult.posts && lookupResult.posts.length > 0 ? (
                  lookupResult.posts.map((p) => (
                    <div
                      key={p._id}
                      style={{
                        background: '#ffffff',
                        border: '1px solid var(--border-light)',
                        padding: '10px 12px',
                        marginBottom: '8px',
                        borderRadius: 'var(--radius-sm)'
                      }}
                    >
                      <strong>{p.title}</strong>
                      <p style={{ fontSize: '13px', color: 'var(--text-body)', marginTop: '2px' }}>{p.content}</p>
                    </div>
                  ))
                ) : (
                  <p style={{ color: 'var(--text-muted)' }}>No posts associated with this user.</p>
                )}
              </div>
            )}
          </div>

          {/* Public Posts Feed */}
          <div className="academic-panel">
            <div className="panel-header-row">
              <h3 className="panel-heading">Public Posts Stream ({posts.length} entries)</h3>
            </div>
            {posts.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', padding: '16px 0' }}>No records published yet.</p>
            ) : (
              posts.map((post) => (
                <div
                  key={post._id}
                  style={{
                    borderBottom: '1px solid #f1f5f9',
                    padding: '12px 0',
                    textAlign: 'left'
                  }}
                >
                  <h4 style={{ fontSize: '15px', color: 'var(--text-dark)' }}>{post.title}</h4>
                  <p style={{ fontSize: '13px', color: 'var(--text-body)', margin: '4px 0 8px 0' }}>{post.content}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Author: <strong>{post.user ? post.user.name : 'Unknown'}</strong> (
                      {post.user ? post.user.email : ''})
                    </span>
                    {post.user && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className="action-link-btn"
                          style={{ fontSize: '12px' }}
                          onClick={() => copyToClipboard(post.user._id, 'Author ID Copied')}
                        >
                          Copy ID
                        </button>
                        <button
                          className="btn-gov btn-gov-secondary btn-gov-sm"
                          onClick={() => {
                            setLookupUserId(post.user._id);
                            handleLookup(post.user._id);
                          }}
                        >
                          Inspect via $lookup
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: ADMINISTRATION PANEL (ADMIN ONLY) */}
      {/* ========================================================================= */}
      {user.role === 'admin' && activeTab === 'admin' && (
        <div>
          {/* Add User Panel */}
          <div className="academic-panel">
            <div className="panel-header-row">
              <div>
                <h3 className="panel-heading">Administrator: Enroll Member</h3>
                <p className="panel-subtext">Direct user management with role assignment.</p>
              </div>
            </div>
            <form onSubmit={handleAddAdminUser}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="field-group">
                  <label className="field-label">Full Name</label>
                  <input
                    type="text"
                    required
                    className="field-input"
                    value={newAdminUser.name}
                    onChange={(e) => setNewAdminUser({ ...newAdminUser, name: e.target.value })}
                  />
                </div>
                <div className="field-group">
                  <label className="field-label">Email Address</label>
                  <input
                    type="email"
                    required
                    className="field-input"
                    value={newAdminUser.email}
                    onChange={(e) => setNewAdminUser({ ...newAdminUser, email: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div className="field-group">
                  <div className="field-label-row">
                    <label className="field-label">Password</label>
                    <button
                      type="button"
                      className="action-link-btn"
                      onClick={() => {
                        const strong = generateStrongPassword();
                        setNewAdminUser({ ...newAdminUser, password: strong });
                        setShowAdminPassword(true);
                        triggerInlineToast('✓ Password Generated');
                      }}
                    >
                      Suggest
                    </button>
                  </div>
                  <div className="password-field-wrapper">
                    <input
                      type={showAdminPassword ? 'text' : 'password'}
                      required
                      className="field-input"
                      value={newAdminUser.password}
                      onChange={(e) => setNewAdminUser({ ...newAdminUser, password: e.target.value })}
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowAdminPassword(!showAdminPassword)}
                    >
                      {showAdminPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
                <div className="field-group">
                  <label className="field-label">Role</label>
                  <select
                    className="field-select"
                    value={newAdminUser.role}
                    onChange={(e) => setNewAdminUser({ ...newAdminUser, role: e.target.value })}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="field-group">
                  <label className="field-label">Interests (Comma separated)</label>
                  <input
                    type="text"
                    className="field-input"
                    value={newAdminUser.interests}
                    onChange={(e) => setNewAdminUser({ ...newAdminUser, interests: e.target.value })}
                  />
                </div>
              </div>
              <button type="submit" className="btn-gov btn-gov-primary">
                Add User
              </button>
            </form>
          </div>

          {/* Members Table */}
          <div className="academic-panel">
            <div className="panel-header-row">
              <div>
                <h3 className="panel-heading">System User Accounts</h3>
                <p className="panel-subtext">
                  Supported by index: <code>{'{ createdAt: -1 }'}</code>
                </p>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="academic-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Interests</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {adminUsers.map((u) => (
                    <tr key={u._id}>
                      <td>
                        <strong>{u.name}</strong>
                      </td>
                      <td>{u.email}</td>
                      <td>
                        <span className={`badge-role ${u.role}`}>{u.role}</span>
                      </td>
                      <td>
                        {u.interests && u.interests.length > 0
                          ? u.interests.map((i) => (
                              <span key={i} className="meta-tag">
                                {i}
                              </span>
                            ))
                          : 'None'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="action-link-btn"
                          style={{ marginRight: '10px' }}
                          onClick={() => copyToClipboard(u._id, 'User ID Copied')}
                        >
                          Copy ID
                        </button>
                        {u._id !== user._id && (
                          <button
                            className="btn-gov btn-gov-danger btn-gov-sm"
                            onClick={() => handleDeleteAdminUser(u._id)}
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {userPages > 1 && (
              <div className="academic-pagination">
                <button
                  className="btn-gov btn-gov-secondary btn-gov-sm"
                  disabled={userPage <= 1}
                  onClick={() => setUserPage((p) => Math.max(p - 1, 1))}
                >
                  &larr; Previous Page
                </button>
                <span>
                  Page <strong>{userPage}</strong> of <strong>{userPages}</strong>
                </span>
                <button
                  className="btn-gov btn-gov-secondary btn-gov-sm"
                  disabled={userPage >= userPages}
                  onClick={() => setUserPage((p) => Math.min(p + 1, userPages))}
                >
                  Next Page &rarr;
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
