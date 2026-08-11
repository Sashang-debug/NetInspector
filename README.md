# NetInspector

> A full-stack network diagnostics and analysis platform for performing DNS, Reverse DNS, WHOIS, SSL certificate, HTTP header, Ping, and Traceroute lookups from a unified dashboard.

## 🚀 Live Demo

**Frontend:** https://net-inspector.vercel.app

**Backend:** https://netinspector.onrender.com

---

## 📌 About

NetInspector is a full-stack web application designed to provide commonly used network diagnostic tools through a clean and centralized interface.

Users can sign in with Google and perform network lookups while their search history is securely stored per user.

The project demonstrates:

- Full-stack web development
- REST API development
- Network diagnostics
- Firebase Authentication
- Cloud deployment
- Database-backed user history
- Production environment configuration
- Error handling for cloud-hosting limitations

---

## ✨ Features

### 🔍 DNS Lookup
Query DNS records for a domain, including:

- A
- AAAA
- MX
- NS
- TXT
- CNAME

### 🔄 Reverse DNS Lookup
Resolve an IP address back to its associated hostname using PTR records.

### 📡 Ping
Measure network reachability and response latency.

> **Production note:** Ping may not be available on the Render hosting environment because the platform restricts or does not provide the required OS-level networking capabilities.

### 🛰️ Traceroute
Analyze the network path between the server and a destination.

> **Production note:** Traceroute works in local development but is unavailable in the current Render deployment environment because the required system-level traceroute functionality is not available/restricted in the hosted runtime.

The application handles this limitation gracefully instead of returning fake or fabricated results.

### 🌐 HTTP Headers
Inspect HTTP response headers from a target website.

### 🔐 SSL Certificate
Retrieve and analyze SSL/TLS certificate information from a domain.

### 🌍 WHOIS Lookup
Retrieve domain registration information through WHOIS services.

### 📜 Search History
Authenticated users can:

- View previous lookups
- See lookup status and response time
- Delete individual searches
- Clear their complete history

History is stored separately for each authenticated user.

### 🔐 Google Authentication

Users can sign in using their Google account through Firebase Authentication.

---

## 🏗️ Architecture

```text
                    ┌─────────────────────┐
                    │       User          │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Vercel Frontend   │
                    │   React + Vite       │
                    └──────────┬──────────┘
                               │
                         REST API Calls
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Render Backend    │
                    │   Node + Express    │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
          DNS / WHOIS       SSL / HTTP      Network Tools
              │                │                │
              └────────────────┴────────────────┘

                    Firebase Authentication
                              │
                              ▼
                         User History
