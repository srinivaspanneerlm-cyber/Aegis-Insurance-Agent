# Aegis Premium AI Insurance SaaS Backend

This is the production-grade, highly scalable backend powering the Aegis AI-powered Insurance platform. Built with **Node.js, Express.js, PostgreSQL, Prisma ORM, JWT authentication, and Socket.io**.

---

## 🛠️ Tech Stack & Security

- **Web Server**: Node.js & Express.js with custom operational async handlers.
- **ORM & Database**: Prisma ORM interacting with a PostgreSQL relational database.
- **Realtime**: Socket.io for bi-directional messaging, notifications, and typing indicators.
- **Security Protocols**:
  - `helmet`: Secure HTTP header settings.
  - `express-rate-limit`: Request throttling to prevent DDoS and brute-force scans.
  - `cors`: Cross-Origin Resource Sharing.
  - `bcrypt`: Solid password hashing (Salt Rounds: 10).
  - `jsonwebtoken (JWT)`: Custom state-free authorization.

---

## 📂 Database Models (prisma/schema.prisma)

1. **User**: Credentials, profiles, and roles (`customer`, `admin`, `superadmin`).
2. **Company**: Multi-tenant client corporations.
3. **Lead**: Qualified lead insurance types, target budgets, and statuses.
4. **Chat**: Dialogue records of AI and human consulting feeds.
5. **Policy**: Pre-rated tenant-specific coverages.
6. **UploadedDocument**: audited records for secure PDF & DOCX file vaults.

---

## ⚡ Realtime Socket.io Events

### Client Emitted
- `join_chat`: payload `{ chatId, userId }`
- `send_message`: payload `{ chatId, text, sender }`
- `typing`: payload `{ chatId, isTyping }`

### Server Broadcasted
- `message_received`: payload `{ id, text, sender, createdAt }`
- `typing_state`: payload `{ isTyping }`
- `notify_underwriting`: payload `{ leadId, status }`
