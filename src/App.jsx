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
    title: 'Error',
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
    confirmButtonColor: '#b91c1c',
    cancelButtonColor: '#4b5563',
    confirmButtonText: 'Confirm Delete'
  });
  return result.isConfirmed;
};

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [activeTab, setActiveTab] = useState('notes');
  const [systemHealth, setSystemHealth] = useState({ status: 'Connecting...', database: 'Checking' });

  // Auth Form State
  const [isRegister, setIsRegister] = useState(false);
  const [authData, setAuthData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user',
    interests: 'chess, reading'
  });

  // Notes State
  const [notes, setNotes] = useState([]);
  const [notePage, setNotePage] = useState(1);
  const [notePages, setNotePages] = useState(1);
  const [noteSearch, setNoteSearch] = useState('');
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
  const [newAdminUser, setNewAdminUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user',
    interests: ''
  });

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
      notifySuccess('Note Updated', 'Modifications recorded');
      fetchNotes(notePage);
    } catch (err) {
      notifyError(err.message);
    }
  };

  const handleDeleteNote = async (id) => {
    const confirmed = await confirmDialog('Delete Record', 'This action will permanently remove this note.');
    if (!confirmed) return;

    try {
      await request(`/api/notes/${id}`, { method: 'DELETE' });
      notifySuccess('Deleted', 'Note record removed');
      fetchNotes(notePage);
    } catch (err) {
      notifyError(err.message);
    }
  };

  // Filter notes locally by search keyword
  const filteredNotes = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(noteSearch.toLowerCase()) ||
      n.content.toLowerCase().includes(noteSearch.toLowerCase())
  );

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
    const confirmed = await confirmDialog('Remove Member', 'Are you certain you wish to delete this user?');
    if (!confirmed) return;

    try {
      await request(`/api/users/${id}`, { method: 'DELETE' });
      notifySuccess('Member Removed', 'User record cleared');
      fetchAdminUsers(userPage);
    } catch (err) {
      notifyError(err.message);
    }
  };

  // --- IF NOT LOGGED IN: ACADEMIC AUTHENTICATION SCREEN ---
  if (!user) {
    return (
      <div className="container" style={{ maxWidth: '440px', marginTop: '50px' }}>
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">{isRegister ? 'New Account Registration' : 'Institutional Sign In'}</h2>
              <p className="panel-desc">Secure Note-Taking Platform & RBAC Repository</p>
            </div>
          </div>

          <form onSubmit={handleAuthSubmit}>
            {isRegister && (
              <div className="form-field">
                <label className="form-label">Full Legal Name</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={authData.name}
                  onChange={(e) => setAuthData({ ...authData, name: e.target.value })}
                  placeholder="e.g. Shihab Candidate"
                />
              </div>
            )}

            <div className="form-field">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                required
                className="form-input"
                value={authData.email}
                onChange={(e) => setAuthData({ ...authData, email: e.target.value })}
                placeholder="name@institution.ac.uk"
              />
            </div>

            <div className="form-field">
              <label className="form-label">Password</label>
              <input
                type="password"
                required
                className="form-input"
                value={authData.password}
                onChange={(e) => setAuthData({ ...authData, password: e.target.value })}
                placeholder="••••••••"
              />
            </div>

            {isRegister && (
              <>
                <div className="form-field">
                  <label className="form-label">Account Role Assignment</label>
                  <select
                    className="form-select"
                    value={authData.role}
                    onChange={(e) => setAuthData({ ...authData, role: e.target.value })}
                  >
                    <option value="user">User (Standard permissions)</option>
                    <option value="admin">Admin (System supervisor permissions)</option>
                  </select>
                </div>

                <div className="form-field">
                  <label className="form-label">Research / Personal Interests</label>
                  <input
                    type="text"
                    className="form-input"
                    value={authData.interests}
                    onChange={(e) => setAuthData({ ...authData, interests: e.target.value })}
                    placeholder="chess, reading, computer science"
                  />
                  <p className="form-help">Comma-delimited entries utilized in MongoDB Scenario 1 aggregation.</p>
                </div>
              </>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>
              {isRegister ? 'Enroll Account' : 'Authenticate Credentials'}
            </button>
          </form>

          <div style={{ marginTop: '18px', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
            {isRegister ? 'Already possess credentials?' : 'Require an account?'}{' '}
            <button
              type="button"
              onClick={() => setIsRegister(!isRegister)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--navy-primary)',
                fontWeight: 700,
                textDecoration: 'underline',
                cursor: 'pointer'
              }}
            >
              {isRegister ? 'Proceed to Sign In' : 'Register Here'}
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
      <header className="academic-header">
        <div>
          <h1 className="site-title">Secure Note-Taking Portal</h1>
          <p className="site-subtitle">
            Authenticated Member: <strong>{user.name}</strong> &lt;{user.email}&gt;
          </p>
        </div>
        <div className="user-status-bar">
          <span className="system-pill">
            <span className="system-dot"></span>
            DB {systemHealth.database || 'Online'}
          </span>
          <span className={`role-badge ${user.role}`}>{user.role}</span>
          <button className="btn btn-outline btn-sm" onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </header>

      {/* Academic Navigation Tabs */}
      <nav className="nav-tabs">
        <button
          className={`nav-tab-item ${activeTab === 'notes' ? 'active' : ''}`}
          onClick={() => setActiveTab('notes')}
        >
          Notes Repository {user.role === 'admin' ? '(Admin View)' : '(Personal)'}
        </button>
        <button
          className={`nav-tab-item ${activeTab === 'interests' ? 'active' : ''}`}
          onClick={() => setActiveTab('interests')}
        >
          Scenario 1: Group by Interests
        </button>
        <button
          className={`nav-tab-item ${activeTab === 'posts' ? 'active' : ''}`}
          onClick={() => setActiveTab('posts')}
        >
          Scenario 2: User Posts ($lookup)
        </button>
        {user.role === 'admin' && (
          <button
            className={`nav-tab-item ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => setActiveTab('admin')}
          >
            Administration Panel
          </button>
        )}
      </nav>

      {/* ========================================================================= */}
      {/* TAB 1: NOTES REPOSITORY (CRUD + PAGINATION + RBAC) */}
      {/* ========================================================================= */}
      {activeTab === 'notes' && (
        <div>
          {/* Note Composition Panel */}
          <div className="panel">
            <div className="panel-header">
              <h3 className="panel-title">{editingNote ? 'Modify Note Record' : 'Compose New Note'}</h3>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Length: {(editingNote ? editingNote.content : newNote.content).length} chars
              </span>
            </div>
            <form onSubmit={editingNote ? handleUpdateNote : handleCreateNote}>
              <div className="form-field">
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="Record Title"
                  value={editingNote ? editingNote.title : newNote.title}
                  onChange={(e) =>
                    editingNote
                      ? setEditingNote({ ...editingNote, title: e.target.value })
                      : setNewNote({ ...newNote, title: e.target.value })
                  }
                />
              </div>
              <div className="form-field">
                <textarea
                  required
                  className="form-textarea"
                  placeholder="Type note contents..."
                  value={editingNote ? editingNote.content : newNote.content}
                  onChange={(e) =>
                    editingNote
                      ? setEditingNote({ ...editingNote, content: e.target.value })
                      : setNewNote({ ...newNote, content: e.target.value })
                  }
                />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" className="btn btn-primary">
                  {editingNote ? 'Update Record' : 'Save Record'}
                </button>
                {editingNote && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setEditingNote(null)}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Records Display Panel */}
          <div className="panel">
            <div className="panel-header">
              <div>
                <h3 className="panel-title">
                  {user.role === 'admin' ? 'All System Notes (Administrator View)' : 'Personal Notes Collection'}
                </h3>
                <p className="panel-desc">
                  Supported by index: {user.role === 'admin' ? '{ createdAt: -1 }' : '{ user: 1, createdAt: -1 }'}
                </p>
              </div>
              <div className="search-wrapper" style={{ margin: 0 }}>
                <input
                  type="text"
                  className="form-input"
                  style={{ width: '220px', padding: '6px 10px', fontSize: '13px' }}
                  placeholder="Filter records..."
                  value={noteSearch}
                  onChange={(e) => setNoteSearch(e.target.value)}
                />
              </div>
            </div>

            {filteredNotes.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', padding: '24px 0', textAlign: 'center' }}>
                No records match current parameters.
              </p>
            ) : (
              <div className="notes-grid">
                {filteredNotes.map((note) => (
                  <div key={note._id} className="note-card">
                    <div>
                      <h4 className="note-heading">{note.title}</h4>
                      <p className="note-body">{note.content}</p>
                    </div>
                    <div>
                      <div className="note-footer">
                        <span>
                          {user.role === 'admin' && note.user
                            ? `By: ${note.user.name}`
                            : new Date(note.createdAt).toLocaleDateString()}
                        </span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setEditingNote(note)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
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
            )}

            {/* Pagination Controls */}
            {notePages > 1 && (
              <div className="pagination-bar">
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={notePage <= 1}
                  onClick={() => setNotePage((p) => Math.max(p - 1, 1))}
                >
                  &larr; Previous Page
                </button>
                <span>
                  Page <strong>{notePage}</strong> of <strong>{notePages}</strong>
                </span>
                <button
                  className="btn btn-secondary btn-sm"
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
        <div className="panel">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">Aggregation Scenario 1: Group by Interests</h3>
              <p className="panel-desc">
                Requirement: Executed via a single <code>collection.aggregate()</code> call ($unwind, $group, $sort).
              </p>
            </div>
            <button className="btn btn-outline btn-sm" onClick={fetchInterests}>
              Re-run Aggregation
            </button>
          </div>

          {loadingInterests ? (
            <p style={{ padding: '24px 0', color: 'var(--text-muted)' }}>Executing MongoDB aggregation pipeline...</p>
          ) : interestsData.length === 0 ? (
            <p style={{ padding: '24px 0', color: 'var(--text-muted)' }}>No interests data available.</p>
          ) : (
            <div>
              {interestsData.map((group) => (
                <div
                  key={group.interest}
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    padding: '14px 0'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="tag-academic">{group.interest}</span>
                    <strong style={{ fontSize: '13px' }}>
                      {group.totalUsers} {group.totalUsers === 1 ? 'Individual' : 'Individuals'}
                    </strong>
                  </div>
                  <ul style={{ paddingLeft: '22px', marginTop: '6px', fontSize: '13px' }}>
                    {group.users.map((u) => (
                      <li key={u._id} style={{ margin: '3px 0' }}>
                        {u.name} — <span style={{ color: 'var(--text-muted)' }}>{u.email}</span> (
                        <span style={{ fontSize: '11px', textTransform: 'uppercase' }}>{u.role}</span>)
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
          <div className="panel">
            <div className="panel-header">
              <h3 className="panel-title">Publish Public Document / Post</h3>
              <p className="panel-desc">Stored in Posts collection; visible across all user accounts.</p>
            </div>
            <form onSubmit={handleCreatePost}>
              <div className="form-field">
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="Post Title"
                  value={newPost.title}
                  onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                />
              </div>
              <div className="form-field">
                <textarea
                  required
                  className="form-textarea"
                  placeholder="Body content..."
                  value={newPost.content}
                  onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                />
              </div>
              <button type="submit" className="btn btn-primary">
                Publish Post
              </button>
            </form>
          </div>

          {/* Interactive $lookup Inspection */}
          <div className="panel" style={{ borderLeft: '4px solid var(--navy-primary)' }}>
            <div className="panel-header">
              <div>
                <h3 className="panel-title">Scenario 2: User Posts ($lookup Stage)</h3>
                <p className="panel-desc">
                  Constraint: Single pipeline with <code>$lookup</code> stage. Supported by index{' '}
                  <code>postSchema.index({'{ user: 1 }'})</code>.
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Paste Target User ObjectId or click 'Lookup' below"
                value={lookupUserId}
                onChange={(e) => setLookupUserId(e.target.value)}
              />
              <button className="btn btn-primary" onClick={() => handleLookup()}>
                Execute $lookup
              </button>
            </div>

            {lookupResult && (
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid var(--border-color)',
                  borderRadius: '3px',
                  padding: '14px',
                  fontSize: '13px'
                }}
              >
                <h4 style={{ color: 'var(--navy-primary)' }}>
                  Aggregation Target: {lookupResult.name} &lt;{lookupResult.email}&gt;
                </h4>
                <p style={{ color: 'var(--text-muted)', margin: '4px 0 10px 0' }}>
                  Joined Posts via $lookup: <strong>{lookupResult.posts ? lookupResult.posts.length : 0}</strong>
                </p>
                {lookupResult.posts && lookupResult.posts.length > 0 ? (
                  lookupResult.posts.map((p) => (
                    <div
                      key={p._id}
                      style={{
                        background: '#ffffff',
                        border: '1px solid var(--border-subtle)',
                        padding: '10px 12px',
                        marginBottom: '8px',
                        borderRadius: '2px'
                      }}
                    >
                      <strong>{p.title}</strong>
                      <p style={{ fontSize: '13px', color: '#4b5563', marginTop: '2px' }}>{p.content}</p>
                    </div>
                  ))
                ) : (
                  <p style={{ color: 'var(--text-muted)' }}>No associated posts found for this user.</p>
                )}
              </div>
            )}
          </div>

          {/* Public Posts Stream */}
          <div className="panel">
            <div className="panel-header">
              <h3 className="panel-title">Public Posts Stream ({posts.length} entries)</h3>
            </div>
            {posts.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', padding: '20px 0' }}>No records published.</p>
            ) : (
              posts.map((post) => (
                <div
                  key={post._id}
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    padding: '12px 0'
                  }}
                >
                  <h4 style={{ fontSize: '15px', color: 'var(--text-main)' }}>{post.title}</h4>
                  <p style={{ fontSize: '13px', color: '#374151', margin: '4px 0 8px 0' }}>{post.content}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Author: <strong>{post.user ? post.user.name : 'Unknown'}</strong> (
                      {post.user ? post.user.email : ''})
                    </span>
                    {post.user && (
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => {
                          setLookupUserId(post.user._id);
                          handleLookup(post.user._id);
                        }}
                      >
                        Run $lookup for Author
                      </button>
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
          <div className="panel">
            <div className="panel-header">
              <h3 className="panel-title">Administrator: Enroll Member</h3>
              <p className="panel-desc">Direct administrative creation with customized initial role.</p>
            </div>
            <form onSubmit={handleAddAdminUser}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-field">
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={newAdminUser.name}
                    onChange={(e) => setNewAdminUser({ ...newAdminUser, name: e.target.value })}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    required
                    className="form-input"
                    value={newAdminUser.email}
                    onChange={(e) => setNewAdminUser({ ...newAdminUser, email: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div className="form-field">
                  <label className="form-label">Password</label>
                  <input
                    type="password"
                    required
                    className="form-input"
                    value={newAdminUser.password}
                    onChange={(e) => setNewAdminUser({ ...newAdminUser, password: e.target.value })}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Role</label>
                  <select
                    className="form-select"
                    value={newAdminUser.role}
                    onChange={(e) => setNewAdminUser({ ...newAdminUser, role: e.target.value })}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="form-field">
                  <label className="form-label">Interests (Comma separated)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newAdminUser.interests}
                    onChange={(e) => setNewAdminUser({ ...newAdminUser, interests: e.target.value })}
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-primary">
                Add User to System
              </button>
            </form>
          </div>

          {/* Members Table */}
          <div className="panel">
            <div className="panel-header">
              <h3 className="panel-title">System User Accounts</h3>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Index: <code>{'{ createdAt: -1 }'}</code>
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
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
                        <span className={`role-badge ${u.role}`}>{u.role}</span>
                      </td>
                      <td>
                        {u.interests && u.interests.length > 0
                          ? u.interests.map((i) => (
                              <span key={i} className="tag-academic">
                                {i}
                              </span>
                            ))
                          : 'None'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {u._id !== user._id && (
                          <button
                            className="btn btn-danger btn-sm"
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
              <div className="pagination-bar">
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={userPage <= 1}
                  onClick={() => setUserPage((p) => Math.max(p - 1, 1))}
                >
                  &larr; Previous Page
                </button>
                <span>
                  Page <strong>{userPage}</strong> of <strong>{userPages}</strong>
                </span>
                <button
                  className="btn btn-secondary btn-sm"
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
