import React, { useState, useEffect, useRef } from 'react';
import Swal from 'sweetalert2';
import toast, { Toaster } from 'react-hot-toast';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { request } from './api';
import './App.css';

// Rich Text Quill Configuration
const quillModules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['blockquote', 'code-block'],
    ['clean']
  ]
};

const quillFormats = [
  'header',
  'bold', 'italic', 'underline', 'strike',
  'list',
  'blockquote', 'code-block'
];

// Rich text stripping, entity decoding, and reading estimation helpers
const stripHtml = (html) => {
  if (!html) return '';
  if (typeof document !== 'undefined') {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const text = tmp.textContent || tmp.innerText || '';
    return text
      .replace(/\u00a0/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return html
    .replace(/<[^>]*>?/gm, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
};

const getWordCount = (content) => {
  const text = stripHtml(content);
  return text ? text.split(/\s+/).length : 0;
};

const getReadingTime = (content) => {
  const words = getWordCount(content);
  return Math.max(1, Math.ceil(words / 200));
};

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
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileRef = useRef(null);

  // Close profile dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const getInitials = (name) => {
    if (!name) return 'U';
    const p = name.trim().split(/\s+/);
    if (p.length === 1) return p[0].substring(0, 2).toUpperCase();
    return (p[0][0] + p[p.length - 1][0]).toUpperCase();
  };

  // Auth Form State
  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [authData, setAuthData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user',
    interests: ''
  });

  // Notes State & Controls
  const [notes, setNotes] = useState([]);
  const [notePage, setNotePage] = useState(1);
  const [noteSearch, setNoteSearch] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'table'
  const [newNote, setNewNote] = useState({ title: '', content: '' });
  const [editorResetKey, setEditorResetKey] = useState(0);
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [isUpdatingNote, setIsUpdatingNote] = useState(false);
  const [viewingNote, setViewingNote] = useState(null);
  const [loadingNotes, setLoadingNotes] = useState(false);

  // Admin Users State
  const [adminUsers, setAdminUsers] = useState([]);
  const [userPage, setUserPage] = useState(1);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [newAdminUser, setNewAdminUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user',
    interests: ''
  });

  // Fetch initial notes on login or tab switch
  useEffect(() => {
    if (user && activeTab === 'notes') {
      fetchNotes();
    }
  }, [user, activeTab]);

  // Fetch admin users on login or admin tab switch
  useEffect(() => {
    if (user && user.role === 'admin' && activeTab === 'admin') {
      fetchAdminUsers();
    }
  }, [user, activeTab]);

  // Copy helper with react-hot-toast notification
  const copyToClipboard = (text, label = 'Copied to clipboard') => {
    navigator.clipboard.writeText(text);
    toast.success(label);
  };

  // --- AUTH HANDLERS ---
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setIsSubmittingAuth(true);
    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
      const payload = isRegister
        ? {
            name: authData.name.trim(),
            email: authData.email.trim(),
            password: authData.password,
            role: authData.role || 'user',
            interests: authData.interests
              ? authData.interests.split(',').map((i) => i.trim()).filter(Boolean)
              : []
          }
        : { email: authData.email.trim(), password: authData.password };

      const data = await request(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data));
      setUser(data);
      setAuthData({ name: '', email: '', password: '', role: 'user', interests: '' });
      notifySuccess(isRegister ? 'Account Registered' : 'Authentication Successful', `Welcome, ${data.name}`);
    } catch (err) {
      notifyError(err.message);
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleToggleAuthMode = () => {
    setIsRegister(!isRegister);
    setAuthData({ name: '', email: '', password: '', role: 'user', interests: '' });
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
  const fetchNotes = async () => {
    setLoadingNotes(true);
    try {
      const data = await request('/api/notes?limit=100&sort=newest');
      setNotes(data.notes || []);
    } catch (err) {
      notifyError(err.message);
    } finally {
      setLoadingNotes(false);
    }
  };

  const handleCreateNote = async (e) => {
    e.preventDefault();
    if (!newNote.title.trim()) {
      notifyError('Please enter a note title.');
      return;
    }
    const cleanContent = stripHtml(newNote.content);
    if (!cleanContent) {
      notifyError('Please enter some content for the note.');
      return;
    }

    setIsSubmittingNote(true);
    try {
      await request('/api/notes', {
        method: 'POST',
        body: JSON.stringify({
          title: newNote.title.trim(),
          content: newNote.content
        })
      });
      // Fully reset form state and force ReactQuill re-render
      setNewNote({ title: '', content: '' });
      setEditorResetKey((prev) => prev + 1);
      toast.success('Note created successfully');
      fetchNotes();
    } catch (err) {
      notifyError(err.message);
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const handleUpdateNote = async (e) => {
    e.preventDefault();
    if (!editingNote) return;
    if (!editingNote.title.trim()) {
      notifyError('Please enter a note title.');
      return;
    }
    const cleanContent = stripHtml(editingNote.content);
    if (!cleanContent) {
      notifyError('Please enter some content for the note.');
      return;
    }

    setIsUpdatingNote(true);
    try {
      await request(`/api/notes/${editingNote._id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: editingNote.title.trim(),
          content: editingNote.content
        })
      });
      setEditingNote(null);
      toast.success('Note updated successfully');
      fetchNotes();
    } catch (err) {
      notifyError(err.message);
    } finally {
      setIsUpdatingNote(false);
    }
  };

  const handleDeleteNote = async (id) => {
    const confirmed = await confirmDialog('Delete Record', 'This action will permanently delete this note.');
    if (!confirmed) return;

    try {
      await request(`/api/notes/${id}`, { method: 'DELETE' });
      toast.success('Note deleted successfully');
      fetchNotes();
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
    toast.success('Notes exported to CSV');
  };

  // Dynamic search, text extraction & pagination for Notes
  const filteredNotes = notes.filter((n) => {
    if (!noteSearch.trim()) return true;
    const q = noteSearch.toLowerCase().trim();
    const titleMatch = (n.title || '').toLowerCase().includes(q);
    const contentMatch = stripHtml(n.content || '').toLowerCase().includes(q);
    const authorMatch = (n.user?.name || '').toLowerCase().includes(q);
    const emailMatch = (n.user?.email || '').toLowerCase().includes(q);
    return titleMatch || contentMatch || authorMatch || emailMatch;
  });

  const NOTES_PER_PAGE = 6;
  const notePages = Math.max(1, Math.ceil(filteredNotes.length / NOTES_PER_PAGE));
  const currentNotePage = Math.min(notePage, notePages);
  const processedNotes = filteredNotes.slice((currentNotePage - 1) * NOTES_PER_PAGE, currentNotePage * NOTES_PER_PAGE);

  // --- ADMIN USER MANAGEMENT HANDLERS ---
  const fetchAdminUsers = async () => {
    setLoadingUsers(true);
    try {
      const data = await request('/api/users?limit=100');
      setAdminUsers(data.users || []);
    } catch (err) {
      notifyError(err.message);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Dynamic search, role filter & pagination for Admin Users
  const filteredUsers = adminUsers.filter((u) => {
    // 1. Role filter
    if (userRoleFilter && userRoleFilter !== 'all') {
      if ((u.role || '').toLowerCase() !== userRoleFilter.toLowerCase()) {
        return false;
      }
    }
    // 2. Search keyword filter
    if (userSearch.trim()) {
      const q = userSearch.toLowerCase().trim();
      const nameMatch = (u.name || '').toLowerCase().includes(q);
      const emailMatch = (u.email || '').toLowerCase().includes(q);
      const roleMatch = (u.role || '').toLowerCase().includes(q);
      const interestMatch = Array.isArray(u.interests) && u.interests.some((i) => i.toLowerCase().includes(q));
      return nameMatch || emailMatch || roleMatch || interestMatch;
    }
    return true;
  });

  const USERS_PER_PAGE = 5;
  const userPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PER_PAGE));
  const currentUserPage = Math.min(userPage, userPages);
  const displayUsers = filteredUsers.slice((currentUserPage - 1) * USERS_PER_PAGE, currentUserPage * USERS_PER_PAGE);

  const handleAddAdminUser = async (e) => {
    e.preventDefault();
    if (!newAdminUser.name.trim()) {
      notifyError('Full name is required');
      return;
    }
    if (!newAdminUser.email.trim()) {
      notifyError('Valid email address is required');
      return;
    }

    setIsSubmittingUser(true);
    try {
      const payload = {
        name: newAdminUser.name.trim(),
        email: newAdminUser.email.trim(),
        password: newAdminUser.password,
        role: newAdminUser.role,
        interests: newAdminUser.interests.split(',').map((i) => i.trim()).filter(Boolean)
      };
      const created = await request('/api/users', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setNewAdminUser({ name: '', email: '', password: '', role: 'user', interests: '' });
      notifySuccess('User Enrolled Successfully', `${created.name} (${created.email}) has been assigned role: ${created.role.toUpperCase()}`);
      toast.success('User account created');
      fetchAdminUsers();
    } catch (err) {
      notifyError(err.message || 'Failed to create user account.');
    } finally {
      setIsSubmittingUser(false);
    }
  };

  const handleDeleteAdminUser = async (id) => {
    const confirmed = await confirmDialog('Remove Member', 'Are you certain you wish to remove this user?');
    if (!confirmed) return;

    try {
      await request(`/api/users/${id}`, { method: 'DELETE' });
      notifySuccess('Member Removed', 'User record cleared');
      fetchAdminUsers();
    } catch (err) {
      notifyError(err.message);
    }
  };

  // Dynamic Password Validation Rules & Strength Calculation
  const pass = authData.password || '';
  const ruleLength = pass.length >= 8;
  const ruleUpper = /[A-Z]/.test(pass);
  const ruleNumber = /[0-9]/.test(pass);
  const ruleSymbol = /[^A-Za-z0-9]/.test(pass);

  const rulesPassed = [ruleLength, ruleUpper, ruleNumber, ruleSymbol].filter(Boolean).length;
  let strengthLabel = 'Weak';
  let strengthColor = '#dc2626';
  let strengthPercent = 25;

  if (!pass) {
    strengthLabel = 'None';
    strengthColor = '#94a3b8';
    strengthPercent = 0;
  } else if (rulesPassed <= 1) {
    strengthLabel = 'Weak';
    strengthColor = '#dc2626';
    strengthPercent = 25;
  } else if (rulesPassed === 2) {
    strengthLabel = 'Fair';
    strengthColor = '#d97706';
    strengthPercent = 50;
  } else if (rulesPassed === 3) {
    strengthLabel = 'Good';
    strengthColor = '#0284c7';
    strengthPercent = 75;
  } else if (rulesPassed === 4) {
    strengthLabel = 'Strong';
    strengthColor = '#16a34a';
    strengthPercent = 100;
  }

  // Live Note Word Counter & Reading Time (calculated from stripped text)
  const wordCount = getWordCount(newNote.content);
  const readingTime = getReadingTime(newNote.content);

  // --- IF NOT LOGGED IN: CLEAN AUTHENTICATION SCREEN ---
  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ width: '100%', maxWidth: '480px' }}>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 2500,
              style: {
                fontSize: '14px',
                borderRadius: '0px',
                border: '2px solid #0b0c0c'
              }
            }}
          />
          <div className="academic-panel" style={{ boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)' }}>
            <div className="panel-header-row" style={{ alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '38px',
                height: '38px',
                backgroundColor: 'var(--govuk-black)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="rgba(255,255,255,0.2)" />
                </svg>
              </div>
              <div>
                <h2 className="panel-heading" style={{ fontSize: '20px' }}>
                  {isRegister ? 'Care Guide Registration' : 'Care Guide Sign In'}
                </h2>
                <p className="panel-subtext">Secure Notes Workspace</p>
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
                {isRegister && (
                  <button
                    type="button"
                    className="action-link-btn"
                    onClick={() => {
                      const strong = generateStrongPassword();
                      setAuthData({ ...authData, password: strong });
                      setShowPassword(true);
                      toast.success('Strong password generated');
                    }}
                  >
                    Suggest Strong Password
                  </button>
                )}
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

              {/* Password Strength Range Slider & Requirements Tooltip */}
              {isRegister && (
                <div className="password-strength-container">
                  <div className="password-strength-meta">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Strength:</span>
                      <strong style={{ fontSize: '12px', color: strengthColor }}>{strengthLabel}</strong>
                    </div>

                    <div className="info-tooltip-wrapper" tabIndex={0}>
                      <span className="info-icon-badge">ⓘ Requirements</span>
                      <div className="info-tooltip-box">
                        <div className="tooltip-title">Security Criteria</div>
                        <ul className="tooltip-criteria-list">
                          <li className={`tooltip-criteria-item ${ruleLength ? 'met' : ''}`}>
                            <span className="criteria-icon">{ruleLength ? '✓' : '•'}</span>
                            <span>At least 8 characters</span>
                          </li>
                          <li className={`tooltip-criteria-item ${ruleUpper ? 'met' : ''}`}>
                            <span className="criteria-icon">{ruleUpper ? '✓' : '•'}</span>
                            <span>Uppercase letter (A-Z)</span>
                          </li>
                          <li className={`tooltip-criteria-item ${ruleNumber ? 'met' : ''}`}>
                            <span className="criteria-icon">{ruleNumber ? '✓' : '•'}</span>
                            <span>At least one number (0-9)</span>
                          </li>
                          <li className={`tooltip-criteria-item ${ruleSymbol ? 'met' : ''}`}>
                            <span className="criteria-icon">{ruleSymbol ? '✓' : '•'}</span>
                            <span>Special symbol (!@#$%^&*)</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="password-slider-track">
                    <div
                      className="password-slider-fill"
                      style={{
                        width: `${strengthPercent}%`,
                        backgroundColor: strengthColor
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {isRegister && (
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
            )}

            {isRegister && (
              <div className="field-group">
                <label className="field-label">Personal / Research Interests</label>
                <input
                  type="text"
                  className="field-input"
                  value={authData.interests}
                  onChange={(e) => setAuthData({ ...authData, interests: e.target.value })}
                  placeholder="e.g. Artificial Intelligence, Cloud Systems, Reading"
                />
              </div>
            )}

            <button
              type="submit"
              className="btn-gov btn-gov-primary"
              disabled={isSubmittingAuth}
              style={{
                width: '100%',
                marginTop: '10px',
                padding: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {isSubmittingAuth && <span className="spinner-icon" style={{ borderTopColor: '#ffffff' }} />}
              {isSubmittingAuth
                ? (isRegister ? 'Creating Account...' : 'Signing In...')
                : (isRegister ? 'Complete Registration' : 'Sign In')}
            </button>
          </form>

          <div style={{ marginTop: '20px', textAlign: 'left', fontSize: '13px', color: 'var(--text-muted)' }}>
            {isRegister ? 'Already registered?' : 'Need an account?'}{' '}
            <button
              type="button"
              onClick={handleToggleAuthMode}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--govuk-blue)',
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
    </div>
    );
  }

  // --- LOGGED IN INSTITUTIONAL DASHBOARD ---
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Institutional Header */}
      <header className="govuk-header-bar">
        <div className="govuk-header-inner">
          <div className="govuk-header-brand">
            <div className="govuk-crown-logo" title="Care Guide">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="rgba(255,255,255,0.2)" />
              </svg>
            </div>
            <span className="govuk-logotype-text">Care Guide</span>
            <span className="govuk-service-title">Secure Notes Workspace</span>
          </div>

          {/* Profile Avatar Dropdown */}
          <div className="profile-menu-wrapper" ref={profileRef}>
            <button
              type="button"
              className="profile-btn"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              aria-expanded={showProfileMenu}
            >
              <div className="profile-avatar-circle">
                {getInitials(user.name)}
              </div>
              <div className="profile-details-column">
                <span className="profile-name-text">{user.name}</span>
                <span className="profile-role-tag">{user.role}</span>
              </div>
              <span className="profile-caret">▼</span>
            </button>

            {showProfileMenu && (
              <div className="profile-dropdown-card">
                <div className="dropdown-user-header">
                  <span className="dropdown-user-name">{user.name}</span>
                  <span className="dropdown-user-email">{user.email}</span>
                  <div style={{ marginTop: '6px' }}>
                    <span className={`badge-role ${user.role}`}>{user.role}</span>
                  </div>
                </div>
                <div className="dropdown-divider" />
                <button
                  type="button"
                  className="dropdown-action-btn"
                  onClick={() => {
                    setShowProfileMenu(false);
                    handleLogout();
                  }}
                >
                  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ marginRight: '8px' }}>
                    <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Phase Banner */}
      <div className="govuk-phase-banner">
        <div className="govuk-phase-banner-inner">
          <span className="govuk-phase-tag">BETA</span>
          <span>This is a secure institutional prototype. Your feedback helps us improve it.</span>
        </div>
      </div>

      <main className="container" style={{ flex: '1 0 auto' }}>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 2500,
            style: {
              fontSize: '14px',
              borderRadius: '0px',
              border: '2px solid #0b0c0c'
            }
          }}
        />

        {/* Header Navigation Tabs */}
        <nav className="header-nav-tabs">
          <button
            type="button"
            className={`nav-tab-btn ${activeTab === 'notes' ? 'active' : ''}`}
            onClick={() => setActiveTab('notes')}
          >
            My Notes
          </button>
          {user.role === 'admin' && (
            <button
              type="button"
              className={`nav-tab-btn ${activeTab === 'admin' ? 'active' : ''}`}
              onClick={() => setActiveTab('admin')}
            >
              User Management
            </button>
          )}
        </nav>

      {/* Edit Note Popup Modal */}
      {editingNote && (
        <div className="modal-overlay" onClick={() => setEditingNote(null)}>
          <div className="modal-dialog modal-dialog-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Edit Note</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setEditingNote(null)}
                title="Close"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleUpdateNote}>
              <div className="modal-body">
                <div className="field-group">
                  <label className="field-label">Title</label>
                  <input
                    type="text"
                    required
                    className="field-input"
                    value={editingNote.title}
                    onChange={(e) => setEditingNote({ ...editingNote, title: e.target.value })}
                  />
                </div>
                <div className="field-group quill-editor-wrapper">
                  <label className="field-label">Content Body</label>
                  <ReactQuill
                    theme="snow"
                    value={editingNote.content}
                    onChange={(val) => setEditingNote({ ...editingNote, content: val })}
                    modules={quillModules}
                    formats={quillFormats}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-gov btn-gov-secondary"
                  onClick={() => setEditingNote(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-gov btn-gov-primary"
                  disabled={isUpdatingNote}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                >
                  {isUpdatingNote && <span className="spinner-icon" style={{ borderTopColor: '#ffffff' }} />}
                  {isUpdatingNote ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Note Details Modal (Read Full Massive Content) */}
      {viewingNote && (
        <div className="modal-overlay" onClick={() => setViewingNote(null)}>
          <div className="modal-dialog modal-dialog-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{viewingNote.title}</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setViewingNote(null)}
                title="Close"
              >
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ maxHeight: '68vh', overflowY: 'auto' }}>
              <div className="view-note-meta-bar">
                <span>Author: <strong>{viewingNote.user ? viewingNote.user.name : 'You'}</strong></span>
                <span>•</span>
                <span>Date: <strong>{new Date(viewingNote.createdAt).toLocaleDateString()}</strong></span>
                <span>•</span>
                <span className="word-meta-badge">
                  {getWordCount(viewingNote.content)} words • ~{getReadingTime(viewingNote.content)} min read
                </span>
              </div>
              <div
                className="view-note-rendered-content"
                dangerouslySetInnerHTML={{ __html: viewingNote.content }}
              />
            </div>
            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              <button
                type="button"
                className="btn-gov btn-gov-secondary"
                onClick={() => copyToClipboard(stripHtml(viewingNote.content), 'Note content copied')}
              >
                Copy Content
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn-gov btn-gov-secondary"
                  onClick={() => setViewingNote(null)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="btn-gov btn-gov-primary"
                  onClick={() => {
                    const target = viewingNote;
                    setViewingNote(null);
                    setEditingNote(target);
                  }}
                >
                  Edit Note
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: NOTES REPOSITORY (CRUD + DATA TABLE / GRID + PAGINATION) */}
      {/* ========================================================================= */}
      {activeTab === 'notes' && (
        <div>
          {/* Note Composition Panel */}
          <div className="academic-panel">
            <div className="panel-header-row">
              <h3 className="panel-heading">Compose New Note</h3>
              <span className="word-meta-badge">
                {wordCount} words • ~{readingTime} min read
              </span>
            </div>
            <div className="govuk-inset-text">
              Notes are encrypted and indexed according to official Equality-Sort-Range (ESR) database rules.
            </div>
            <form onSubmit={handleCreateNote}>
              <div className="field-group">
                <label className="field-label">Record Title</label>
                <input
                  type="text"
                  required
                  className="field-input"
                  placeholder="Enter title..."
                  value={newNote.title || ''}
                  onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                />
              </div>
              <div className="field-group quill-editor-wrapper">
                <label className="field-label">Content Body</label>
                <ReactQuill
                  key={editorResetKey}
                  theme="snow"
                  value={newNote.content || ''}
                  onChange={(val) => setNewNote((prev) => ({ ...prev, content: val }))}
                  modules={quillModules}
                  formats={quillFormats}
                  placeholder="Write comprehensive, encrypted note body here..."
                />
              </div>
              <button
                type="submit"
                className="btn-gov btn-gov-primary"
                disabled={isSubmittingNote}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                {isSubmittingNote && <span className="spinner-icon" style={{ borderTopColor: '#ffffff' }} />}
                {isSubmittingNote ? 'Saving Note...' : 'Save Note'}
              </button>
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
                  {user.role === 'admin' ? 'Administrative view across all system users' : 'Your personal saved records'}
                </p>
              </div>

              {/* Data Table Controls Bar */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Search */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="text"
                    className="field-input"
                    style={{ width: '220px', padding: '6px 28px 6px 10px', fontSize: '13px' }}
                    placeholder="Search notes..."
                    value={noteSearch}
                    onChange={(e) => {
                      setNoteSearch(e.target.value);
                      setNotePage(1);
                    }}
                  />
                  {noteSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setNoteSearch('');
                        setNotePage(1);
                      }}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        fontSize: '14px',
                        padding: 0
                      }}
                      title="Clear search"
                    >
                      &times;
                    </button>
                  )}
                </div>

                {/* View Mode Toggle */}
                <div className="view-mode-toggle">
                  <button
                    type="button"
                    className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                    onClick={() => setViewMode('grid')}
                  >
                    Cards
                  </button>
                  <button
                    type="button"
                    className={`view-btn ${viewMode === 'table' ? 'active' : ''}`}
                    onClick={() => setViewMode('table')}
                  >
                    Table
                  </button>
                </div>

                {/* Export CSV button */}
                <button
                  type="button"
                  className="btn-gov btn-gov-secondary btn-gov-sm"
                  title="Export notes to CSV file"
                  onClick={exportNotesToCSV}
                >
                  Export CSV
                </button>
              </div>
            </div>

            {loadingNotes ? (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <div className="spinner-large" style={{ margin: '0 auto 12px auto' }} />
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Loading notes repository...</span>
              </div>
            ) : processedNotes.length === 0 ? (
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
                      <p className="note-card-text">{stripHtml(note.content)}</p>
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
                            type="button"
                            className="btn-gov btn-gov-secondary btn-gov-sm"
                            onClick={() => setViewingNote(note)}
                            title="Read complete note contents in detail"
                          >
                            View Details
                          </button>
                          <button
                            type="button"
                            className="btn-gov btn-gov-secondary btn-gov-sm"
                            onClick={() => setEditingNote(note)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
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
                          <button
                            type="button"
                            className="action-link-btn"
                            style={{ fontWeight: 700, fontSize: '13px', textAlign: 'left' }}
                            onClick={() => setViewingNote(note)}
                            title="Click to view details"
                          >
                            {note.title}
                          </button>
                        </td>
                        <td style={{ color: 'var(--text-muted)', maxWidth: '280px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {stripHtml(note.content)}
                        </td>
                        <td>{note.user ? note.user.name : 'You'}</td>
                        <td>{new Date(note.createdAt).toLocaleDateString()}</td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            className="btn-gov btn-gov-secondary btn-gov-sm"
                            style={{ marginRight: '6px' }}
                            onClick={() => setViewingNote(note)}
                          >
                            View
                          </button>
                          <button
                            type="button"
                            className="btn-gov btn-gov-secondary btn-gov-sm"
                            style={{ marginRight: '6px' }}
                            onClick={() => setEditingNote(note)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
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

            {/* Pagination Controls - Always Visible */}
            <div className="academic-pagination">
              <button
                type="button"
                className="btn-gov btn-gov-secondary btn-gov-sm"
                disabled={loadingNotes || currentNotePage <= 1}
                onClick={() => setNotePage((p) => Math.max(p - 1, 1))}
              >
                &larr; Previous Page
              </button>
              <span>
                Page <strong>{currentNotePage}</strong> of <strong>{notePages || 1}</strong>
                {loadingNotes && <span className="spinner-icon" style={{ marginLeft: '8px' }} />}
              </span>
              <button
                type="button"
                className="btn-gov btn-gov-secondary btn-gov-sm"
                disabled={loadingNotes || currentNotePage >= (notePages || 1)}
                onClick={() => setNotePage((p) => Math.min(p + 1, notePages || 1))}
              >
                Next Page &rarr;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* USER MANAGEMENT PANEL (ADMIN ONLY) */}
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
            <div className="govuk-inset-text">
              Direct institutional user registration. Roles determine access permissions to system notes and administrative controls.
            </div>
            <form onSubmit={handleAddAdminUser}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="field-group">
                  <label className="field-label">Full Name</label>
                  <input
                    type="text"
                    required
                    className="field-input"
                    value={newAdminUser.name || ''}
                    onChange={(e) => setNewAdminUser({ ...newAdminUser, name: e.target.value })}
                  />
                </div>
                <div className="field-group">
                  <label className="field-label">Email Address</label>
                  <input
                    type="email"
                    required
                    className="field-input"
                    value={newAdminUser.email || ''}
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
                        toast.success('Strong password generated');
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
                      value={newAdminUser.password || ''}
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
                    value={newAdminUser.role || 'user'}
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
                    value={newAdminUser.interests || ''}
                    onChange={(e) => setNewAdminUser({ ...newAdminUser, interests: e.target.value })}
                  />
                </div>
              </div>
              <button
                type="submit"
                className="btn-gov btn-gov-primary"
                disabled={isSubmittingUser}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                {isSubmittingUser && <span className="spinner-icon" style={{ borderTopColor: '#ffffff' }} />}
                {isSubmittingUser ? 'Enrolling Member...' : 'Add User'}
              </button>
            </form>
          </div>

          {/* Members Table */}
          <div className="academic-panel">
            <div className="panel-header-row">
              <div>
                <h3 className="panel-heading">System User Accounts</h3>
                <p className="panel-subtext">
                  Registered user accounts and permission roles
                </p>
              </div>
              {loadingUsers && (
                <div className="table-loading-indicator">
                  <span className="spinner-icon" />
                  <span>Loading accounts...</span>
                </div>
              )}
            </div>

            {/* Dynamic Filter & Search Toolbar */}
            <div className="table-filter-bar">
              <div className="filter-group-left">
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="text"
                    className="table-search-input"
                    style={{ paddingRight: userSearch ? '28px' : '10px' }}
                    placeholder="Search user by name or email..."
                    value={userSearch}
                    onChange={(e) => {
                      setUserSearch(e.target.value);
                      setUserPage(1);
                    }}
                  />
                  {userSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setUserSearch('');
                        setUserPage(1);
                      }}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        fontSize: '14px',
                        padding: 0
                      }}
                      title="Clear search"
                    >
                      &times;
                    </button>
                  )}
                </div>
                <select
                  className="table-role-select"
                  value={userRoleFilter}
                  onChange={(e) => {
                    setUserRoleFilter(e.target.value);
                    setUserPage(1);
                  }}
                >
                  <option value="all">All Roles</option>
                  <option value="user">Users only</option>
                  <option value="admin">Admins only</option>
                </select>
              </div>
              <button
                type="button"
                className="btn-gov btn-gov-secondary btn-gov-sm"
                onClick={fetchAdminUsers}
                disabled={loadingUsers}
              >
                Refresh List
              </button>
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
                  {loadingUsers ? (
                    <tr>
                      <td colSpan="5" className="table-loading-cell">
                        <div className="loading-content-box">
                          <div className="spinner-large" />
                          <span>Fetching user accounts from database...</span>
                        </div>
                      </td>
                    </tr>
                  ) : displayUsers.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-muted)' }}>
                        No user accounts match current search criteria.
                      </td>
                    </tr>
                  ) : (
                    displayUsers.map((u) => (
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
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls - Always Visible */}
            <div className="academic-pagination">
              <button
                type="button"
                className="btn-gov btn-gov-secondary btn-gov-sm"
                disabled={loadingUsers || currentUserPage <= 1}
                onClick={() => setUserPage((p) => Math.max(p - 1, 1))}
              >
                &larr; Previous Page
              </button>
              <span>
                Page <strong>{currentUserPage}</strong> of <strong>{userPages || 1}</strong>
                {loadingUsers && <span className="spinner-icon" style={{ marginLeft: '8px' }} />}
              </span>
              <button
                type="button"
                className="btn-gov btn-gov-secondary btn-gov-sm"
                disabled={loadingUsers || currentUserPage >= (userPages || 1)}
                onClick={() => setUserPage((p) => Math.min(p + 1, userPages || 1))}
              >
                Next Page &rarr;
              </button>
            </div>
          </div>
        </div>
      )}

      </main>

      {/* Institutional Footer */}
      <footer className="govuk-footer">
        <div className="govuk-footer-inner">
          <div className="govuk-footer-meta">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#505a5f" strokeWidth="2" className="govuk-ogl-icon">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span>
              Institutional Secure Note-Taking Platform • 256-bit Encrypted Session • Role-Based Access Control
            </span>
          </div>
          <div className="govuk-footer-copyright">&copy; Care Guide Secure Notes Workspace</div>
        </div>
      </footer>
    </div>
  );
}
