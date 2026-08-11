# NetInspector
A full-stack SaaS application for advanced network diagnostics and analysis. It provides users with a unified, professional dashboard to perform domain, IP, and certificate lookups.

## Features
- **DNS Lookup:** Query A, AAAA, MX, NS, TXT, and CNAME records for any domain.
- **Reverse DNS:** Resolve an IP address back to its associated hostname using PTR records.
- **Ping:** Measure network reachability and response latency.
- **Traceroute:** Analyze the network path between the server and a destination.
- **HTTP Headers:** Inspect HTTP response headers from a target website.
- **SSL Certificate:** Retrieve and analyze SSL/TLS certificate information and expiration.
- **WHOIS Lookup:** Retrieve domain registration, registrar, and expiration details.
- **Google Authentication:** Secure user sign-in and personalized lookup history using Firebase Auth.

## Tech Stack
- **Frontend:** React 19, Vite 8, TypeScript, Tailwind CSS, Radix UI, Recharts, Framer Motion
- **Backend:** Node.js, Express.js 5, SQLite3
- **Authentication:** Firebase

## Project Structure
```text
.
├── backend/
│   ├── package.json
│   ├── server.js            # Express API endpoints
│   └── database.sqlite      # User lookup history
├── public/
│   ├── favicon.svg          # Vector favicon
│   └── icons.svg
├── src/
│   ├── components/          # Reusable UI components
│   ├── pages/
│   │   └── tools/           # Network diagnostic tool pages
│   ├── App.tsx
│   └── main.tsx
├── .env.local               # Frontend environment variables
├── package.json
└── vite.config.ts           # Vite proxy configuration
```

## Getting Started
1. **Clone the repository**
   ```bash
   git clone https://github.com/Sashang-debug/NetInspector.git
   cd NetInspector
   ```
2. **Install dependencies**
   ```bash
   npm install          # Install frontend dependencies
   cd backend
   npm install          # Install backend dependencies
   cd ..
   ```
3. **Configure environment variables**
   Create a `.env.local` file in the root directory:
   ```env
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
   ```
4. **Start the application locally**
   Start the backend (runs on port 3000):
   ```bash
   cd backend
   npm start
   ```
   Start the frontend (runs on port 5173 with Vite proxy):
   ```bash
   npm run dev
   ```

## Deployment
- **Frontend:** Hosted on Vercel.
- **Backend:** Hosted on Render.

In production, the Vercel frontend communicates directly with the Render backend via the `VITE_API_URL` environment variable.

## Production Limitation
Ping and Traceroute work perfectly in local development but are currently unavailable in production. This is because the Render hosting environment strictly restricts low-level OS networking capabilities (such as ICMP/raw sockets) required to execute these commands. This is a deliberate infrastructure limitation, not an application bug.

## Future Improvements
- Export diagnostic results to PDF or CSV formats.
- Add automated network uptime monitoring alerts.
- Allow users to share specific network lookup results via public links.
- Migrate the SQLite database to PostgreSQL for production scalability.
