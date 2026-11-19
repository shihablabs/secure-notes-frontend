# Secure Note-Taking Application — Frontend

A clean, template-free, responsive frontend interface built with **React (Vite)** to demonstrate integration with the Secure Note-Taking REST API.

---

## Features

- **Authentication & RBAC:**
  - Login & Register forms with role selection (`user` / `admin`) and interests configuration.
  - JWT token management via `localStorage` with automatic header injection.
- **Notes Module:**
  - Full CRUD operations (Create, Read, Update, Delete).
  - List pagination (previous, next, page indicators).
  - Dynamic RBAC view: regular users see their own notes, while admins can view everyone's notes with author metadata.
- **Aggregation Scenario 1 View:**
  - Interactive view showing users grouped by interests using MongoDB aggregation.
- **Aggregation Scenario 2 View:**
  - Public posts feed and interactive inspector for the `$lookup` aggregation to retrieve all posts of a specific user.
- **Admin Panel:**
  - Accessible only to admin accounts for managing users with pagination.

---

## Local Setup

```bash
# Clone the repository
git clone https://github.com/shihablabs/secure-notes-frontend.git
cd secure-notes-frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

App runs on `http://localhost:5173`.
