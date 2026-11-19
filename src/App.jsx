import React, { useState, useEffect } from 'react';
import { request } from './api';
import './App.css';

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [activeTab, setActiveTab] = useState('notes');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

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

  // Clear notifications after 4 seconds
  useEffect(() => {
    if (error || info) {
      const timer = setTimeout(() => {
        setError('');
        setInfo('');
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [error, info]);

  // Load notes when page or user changes
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
    setError('');
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
      setInfo(`Welcome, ${data.name}!`);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setNotes([]);
    setInfo('Logged out successfully');
  };

  // --- NOTES HANDLERS ---
  const fetchNotes = async (page = 1) => {
    try {
      const data = await request(`/api/notes?page=${page}&limit=6`);
      setNotes(data.notes || []);
      setNotePage(data.page || 1);
      setNotePages(data.pages || 1);
    } catch (err) {
      setError(err.message);
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
      setInfo('Note created successfully!');
      fetchNotes(1);
    } catch (err) {
      setError(err.message);
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
      setInfo('Note updated successfully!');
      fetchNotes(notePage);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteNote = async (id) => {
    if (!window.confirm('Are you sure you want to delete this note?')) return;
    try {
      await request(`/api/notes/${id}`, { method: 'DELETE' });
      setInfo('Note deleted successfully');
      fetchNotes(notePage);
    } catch (err) {
      setError(err.message);
    }
  };

  // --- AGGREGATION 1: GROUP BY INTERESTS ---
  const fetchInterests = async () => {
    setLoadingInterests(true);
    try {
      const data = await request('/api/users/by-interests');
      setInterestsData(data);
    } catch (err) {
      setError(err.message);
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
      setError(err.message);
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
      setInfo('Post published!');
      fetchPosts();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLookup = async (idToLookup) => {
    const id = idToLookup || lookupUserId;
    if (!id) {
      setError('Please provide a valid User ID for $lookup');
      return;
    }
    try {
      const data = await request(`/api/posts/user/${id}`);
      setLookupResult(data);
      setInfo(`Successfully fetched posts via $lookup for ${data.name}`);
    } catch (err) {
      setError(err.message);
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
      setError(err.message);
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
      setInfo('New user added successfully!');
      fetchAdminUsers(userPage);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteAdminUser = async (id) => {
    if (!window.confirm('Delete this user?')) return;
    try {
      await request(`/api/users/${id}`, { method: 'DELETE' });
      setInfo('User removed successfully');
      fetchAdminUsers(userPage);
    } catch (err) {
      setError(err.message);
    }
  };

  // --- IF NOT LOGGED IN: SHOW AUTH FORM ---
  if (!user) {
    return (
      <div className="container" style={{ maxWidth: '420px', marginTop: '60px' }}>
        <div className="card">
          <h2>{isRegister ? 'Create Account' : 'Sign In'}</h2>
          <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '16px' }}>
            Secure Note-Taking Platform with Role-Based Access Control
          </p>

          {error && <div className="alert alert-error">{error}</div>}
          {info && <div className="alert alert-info">{info}</div>}

          <form onSubmit={handleAuthSubmit}>
            {isRegister && (
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  required
                  className="form-control"
                  value={authData.name}
                  onChange={(e) => setAuthData({ ...authData, name: e.target.value })}
                  placeholder="Your full name"
                />
              </div>
            )}

            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                required
                className="form-control"
                value={authData.email}
                onChange={(e) => setAuthData({ ...authData, email: e.target.value })}
                placeholder="name@example.com"
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                required
                className="form-control"
                value={authData.password}
                onChange={(e) => setAuthData({ ...authData, password: e.target.value })}
                placeholder="••••••••"
              />
            </div>

            {isRegister && (
              <>
                <div className="form-group">
                  <label>Role (for interview demo)</label>
                  <select
                    className="form-control"
                    value={authData.role}
                    onChange={(e) => setAuthData({ ...authData, role: e.target.value })}
                  >
                    <option value="user">User (can manage own notes)</option>
                    <option value="admin">Admin (manage users & view all notes)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Interests (comma separated for Scenario 1)</label>
                  <input
                    type="text"
                    className="form-control"
                    value={authData.interests}
                    onChange={(e) => setAuthData({ ...authData, interests: e.target.value })}
                    placeholder="chess, reading, tech"
                  />
                </div>
              </>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }}>
              {isRegister ? 'Register' : 'Login'}
            </button>
          </form>

          <p style={{ marginTop: '16px', fontSize: '13px', textAlign: 'center' }}>
            {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                setError('');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {isRegister ? 'Login here' : 'Register here'}
            </button>
          </p>
        </div>
      </div>
    );
  }

  // --- LOGGED IN DASHBOARD ---
  return (
    <div className="container">
      {/* Top Header */}
      <header className="header">
        <div>
          <h1>Secure Note-Taking Application</h1>
          <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
            Logged in as <strong>{user.name}</strong> ({user.email})
          </p>
        </div>
        <div className="user-badge">
          <span className={`role-tag ${user.role}`}>{user.role}</span>
          <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      {/* Notifications */}
      {error && <div className="alert alert-error">{error}</div>}
      {info && <div className="alert alert-info">{info}</div>}

      {/* Navigation Tabs */}
      <div className="tabs">
        <button
          className={`tab-btn ${activeTab === 'notes' ? 'active' : ''}`}
          onClick={() => setActiveTab('notes')}
        >
          📝 Notes {user.role === 'admin' ? '(Admin View: All Notes)' : '(My Notes)'}
        </button>
        <button
          className={`tab-btn ${activeTab === 'interests' ? 'active' : ''}`}
          onClick={() => setActiveTab('interests')}
        >
          📊 Scenario 1: Group by Interests
        </button>
        <button
          className={`tab-btn ${activeTab === 'posts' ? 'active' : ''}`}
          onClick={() => setActiveTab('posts')}
        >
          📰 Scenario 2: User Posts ($lookup)
        </button>
        {user.role === 'admin' && (
          <button
            className={`tab-btn ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => setActiveTab('admin')}
          >
            👥 Admin: User Management
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: NOTES CRUD & PAGINATION */}
      {/* ========================================================================= */}
      {activeTab === 'notes' && (
        <div>
          {/* Create Note Card */}
          <div className="card">
            <h3>{editingNote ? 'Edit Note' : 'Create a New Note'}</h3>
            <form onSubmit={editingNote ? handleUpdateNote : handleCreateNote}>
              <div className="form-group">
                <input
                  type="text"
                  required
                  className="form-control"
                  placeholder="Note Title"
                  value={editingNote ? editingNote.title : newNote.title}
                  onChange={(e) =>
                    editingNote
                      ? setEditingNote({ ...editingNote, title: e.target.value })
                      : setNewNote({ ...newNote, title: e.target.value })
                  }
                />
              </div>
              <div className="form-group">
                <textarea
                  required
                  className="form-control"
                  placeholder="Write your note content here..."
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
                  {editingNote ? 'Update Note' : 'Save Note'}
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

          {/* Notes Grid */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>
                {user.role === 'admin' ? "Everyone's Notes (Admin View)" : 'Your Notes'} (
                {notes.length} shown)
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                Index: {user.role === 'admin' ? '{ createdAt: -1 }' : '{ user: 1, createdAt: -1 }'}
              </span>
            </div>

            {notes.length === 0 ? (
              <p style={{ color: 'var(--muted)', padding: '20px 0' }}>No notes found on this page.</p>
            ) : (
              <div className="note-grid">
                {notes.map((note) => (
                  <div key={note._id} className="note-item">
                    <div>
                      <h4 className="note-title">{note.title}</h4>
                      <p className="note-content">{note.content}</p>
                    </div>
                    <div>
                      <div className="note-meta">
                        {user.role === 'admin' && note.user && (
                          <div>
                            <strong>Author:</strong> {note.user.name} ({note.user.email})
                          </div>
                        )}
                        <div>
                          <strong>Created:</strong> {new Date(note.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="note-actions">
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
                ))}
              </div>
            )}

            {/* Pagination Controls */}
            {notePages > 1 && (
              <div className="pagination">
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={notePage <= 1}
                  onClick={() => setNotePage((prev) => Math.max(prev - 1, 1))}
                >
                  &larr; Previous
                </button>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>
                  Page {notePage} of {notePages}
                </span>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={notePage >= notePages}
                  onClick={() => setNotePage((prev) => Math.min(prev + 1, notePages))}
                >
                  Next &rarr;
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
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3>Scenario 1: Users Grouped by Interests</h3>
              <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
                MongoDB Aggregation: Single <code>collection.aggregate([$unwind, $group, $sort])</code> call.
              </p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={fetchInterests}>
              Refresh
            </button>
          </div>

          {loadingInterests ? (
            <p style={{ padding: '20px 0', color: 'var(--muted)' }}>Running aggregation pipeline...</p>
          ) : interestsData.length === 0 ? (
            <p style={{ padding: '20px 0', color: 'var(--muted)' }}>No interests found.</p>
          ) : (
            <div style={{ marginTop: '16px' }}>
              {interestsData.map((item) => (
                <div key={item.interest} className="interest-group">
                  <div>
                    <span className="interest-badge">{item.interest}</span>
                    <strong style={{ fontSize: '14px' }}>
                      {item.totalUsers} {item.totalUsers === 1 ? 'User' : 'Users'}
                    </strong>
                  </div>
                  <ul className="interest-users">
                    {item.users.map((u) => (
                      <li key={u._id}>
                        {u.name} — <span style={{ color: 'var(--muted)' }}>{u.email}</span> (
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
          {/* Create Post */}
          <div className="card">
            <h3>Publish a Public Post</h3>
            <form onSubmit={handleCreatePost}>
              <div className="form-group">
                <input
                  type="text"
                  required
                  className="form-control"
                  placeholder="Post Title"
                  value={newPost.title}
                  onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                />
              </div>
              <div className="form-group">
                <textarea
                  required
                  className="form-control"
                  placeholder="Post content visible to everyone..."
                  value={newPost.content}
                  onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                />
              </div>
              <button type="submit" className="btn btn-primary">
                Publish Post
              </button>
            </form>
          </div>

          {/* $lookup Interactive Inspector */}
          <div className="card" style={{ borderLeft: '4px solid var(--primary)' }}>
            <h3>Scenario 2: Retrieve User Posts ($lookup Stage)</h3>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '12px' }}>
              Constraint: Single aggregation pipeline with a <code>$lookup</code> stage. Supported by index{' '}
              <code>postSchema.index({'{ user: 1 }'})</code>.
            </p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Enter User ObjectId or click 'Lookup' below"
                value={lookupUserId}
                onChange={(e) => setLookupUserId(e.target.value)}
              />
              <button className="btn btn-primary" onClick={() => handleLookup()}>
                Run $lookup
              </button>
            </div>

            {lookupResult && (
              <div
                style={{
                  background: '#f1f5f9',
                  borderRadius: '6px',
                  padding: '16px',
                  fontSize: '13px'
                }}
              >
                <h4>
                  Aggregation Result for: {lookupResult.name} ({lookupResult.email})
                </h4>
                <p style={{ color: 'var(--muted)', marginBottom: '8px' }}>
                  Total Joined Posts via $lookup: <strong>{lookupResult.posts ? lookupResult.posts.length : 0}</strong>
                </p>
                {lookupResult.posts && lookupResult.posts.length > 0 ? (
                  lookupResult.posts.map((p) => (
                    <div key={p._id} style={{ background: 'white', padding: '10px', borderRadius: '4px', marginBottom: '8px' }}>
                      <strong>{p.title}</strong>
                      <p style={{ fontSize: '12px', color: '#475569' }}>{p.content}</p>
                    </div>
                  ))
                ) : (
                  <p style={{ color: 'var(--muted)' }}>This user has not published any posts yet.</p>
                )}
              </div>
            )}
          </div>

          {/* Public Posts Feed */}
          <div className="card">
            <h3>Public Posts Feed ({posts.length} posts)</h3>
            {posts.length === 0 ? (
              <p style={{ color: 'var(--muted)' }}>No posts published yet.</p>
            ) : (
              posts.map((post) => (
                <div key={post._id} className="post-item">
                  <h4>{post.title}</h4>
                  <p style={{ fontSize: '14px', color: '#334155', margin: '6px 0' }}>{post.content}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      By: <strong>{post.user ? post.user.name : 'Unknown'}</strong> (
                      {post.user ? post.user.email : ''})
                    </span>
                    {post.user && (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setLookupUserId(post.user._id);
                          handleLookup(post.user._id);
                        }}
                      >
                        Inspect User via $lookup
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
      {/* TAB 4: ADMIN USER MANAGEMENT (Admin Only) */}
      {/* ========================================================================= */}
      {user.role === 'admin' && activeTab === 'admin' && (
        <div>
          {/* Add User Card */}
          <div className="card">
            <h3>Admin: Add New User</h3>
            <form onSubmit={handleAddAdminUser}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Name</label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="Full Name"
                    value={newAdminUser.name}
                    onChange={(e) => setNewAdminUser({ ...newAdminUser, name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    required
                    className="form-control"
                    placeholder="user@example.com"
                    value={newAdminUser.email}
                    onChange={(e) => setNewAdminUser({ ...newAdminUser, email: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Password</label>
                  <input
                    type="password"
                    required
                    className="form-control"
                    placeholder="Password"
                    value={newAdminUser.password}
                    onChange={(e) => setNewAdminUser({ ...newAdminUser, password: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Role</label>
                  <select
                    className="form-control"
                    value={newAdminUser.role}
                    onChange={(e) => setNewAdminUser({ ...newAdminUser, role: e.target.value })}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Interests</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="chess, football"
                    value={newAdminUser.interests}
                    onChange={(e) => setNewAdminUser({ ...newAdminUser, interests: e.target.value })}
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-primary">
                Add User
              </button>
            </form>
          </div>

          {/* User List with Pagination */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>System Users List</h3>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                Index: <code>{'{ createdAt: -1 }'}</code>
              </span>
            </div>

            <div style={{ overflowX: 'auto', marginTop: '12px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)', color: 'var(--muted)' }}>
                    <th style={{ padding: '8px' }}>Name</th>
                    <th style={{ padding: '8px' }}>Email</th>
                    <th style={{ padding: '8px' }}>Role</th>
                    <th style={{ padding: '8px' }}>Interests</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {adminUsers.map((u) => (
                    <tr key={u._id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 8px' }}>
                        <strong>{u.name}</strong>
                      </td>
                      <td style={{ padding: '10px 8px' }}>{u.email}</td>
                      <td style={{ padding: '10px 8px' }}>
                        <span className={`role-tag ${u.role}`}>{u.role}</span>
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        {u.interests && u.interests.length > 0
                          ? u.interests.join(', ')
                          : <span style={{ color: 'var(--muted)' }}>None</span>}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right' }}>
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
              <div className="pagination">
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={userPage <= 1}
                  onClick={() => setUserPage((prev) => Math.max(prev - 1, 1))}
                >
                  &larr; Previous
                </button>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>
                  Page {userPage} of {userPages}
                </span>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={userPage >= userPages}
                  onClick={() => setUserPage((prev) => Math.min(prev + 1, userPages))}
                >
                  Next &rarr;
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
