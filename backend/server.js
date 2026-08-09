const express = require('express');
const cors = require('cors');
const dns = require('dns').promises;
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { spawn } = require('child_process');
const tls = require('tls');
const whois = require('whois-json');
const osTraceroute = require('os');

const app = express();
const port = process.env.PORT || 3000;

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.some(o => origin.startsWith(o))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());

// Database Initialization
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err);
  } else {
    db.run(`CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tool_name TEXT,
      target TEXT,
      status TEXT,
      latency_ms REAL,
      metadata TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  }
});

const logHistory = (tool_name, target, status, latency_ms, metadata = {}) => {
  db.run(
    `INSERT INTO history (tool_name, target, status, latency_ms, metadata) VALUES (?, ?, ?, ?, ?)`,
    [tool_name, target, status, latency_ms, JSON.stringify(metadata)],
    (err) => {
      if (err) console.error("DB Insert error:", err.message);
    }
  );
};

app.get('/api/dns', async (req, res) => {
  const domain = req.query.domain;
  if (!domain || typeof domain !== 'string') return res.status(400).json({ error: 'Domain is required' });
  const start = performance.now();
  const results = [];
  const addRecords = (type, dataList, defaultTtl = 300) => {
    if (!dataList) return;
    if (Array.isArray(dataList)) {
      dataList.forEach(data => {
        let value = data;
        let ttl = defaultTtl;
        if (typeof data === 'object') {
            if (type === 'MX') { value = `${data.priority} ${data.exchange}`; ttl = 3600; } 
            else if (type === 'SOA') { value = `${data.nsname} ${data.hostmaster}`; ttl = 86400; } 
            else if (type === 'TXT') { value = `"${data.join(' ')}"`; ttl = 3600; } 
            else { value = JSON.stringify(data); }
        } else if (type === 'NS') { ttl = 86400; }
        results.push({ type, name: domain, ttl, data: value });
      });
    } else {
        let ttl = type === 'CNAME' ? 3600 : defaultTtl;
        results.push({ type, name: domain, ttl, data: dataList });
    }
  };

  try {
    const aRecords = await dns.resolve4(domain).catch(() => []); addRecords('A', aRecords);
    const aaaaRecords = await dns.resolve6(domain).catch(() => []); addRecords('AAAA', aaaaRecords);
    const mxRecords = await dns.resolveMx(domain).catch(() => []); addRecords('MX', mxRecords);
    const nsRecords = await dns.resolveNs(domain).catch(() => []); addRecords('NS', nsRecords);
    const txtRecords = await dns.resolveTxt(domain).catch(() => []); addRecords('TXT', txtRecords);
    const cnameRecords = await dns.resolveCname(domain).catch(() => []); addRecords('CNAME', cnameRecords);
    
    const latency = Math.round(performance.now() - start);
    logHistory('DNS', domain, 'Success', latency, { recordsCount: results.length });
    res.json(results);
  } catch (error) {
    const latency = Math.round(performance.now() - start);
    logHistory('DNS', domain, 'Failed', latency, { error: 'Failed to resolve DNS records' });
    res.status(500).json({ error: 'Failed to resolve DNS records' });
  }
});

app.get('/api/reverse-dns', async (req, res) => {
  const ip = req.query.ip;
  if (!ip || typeof ip !== 'string') return res.status(400).json({ success: false, error: 'IP address is required' });
  const isIPv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(ip);
  const isIPv6 = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(ip) || ip.includes('::');
  if (!isIPv4 && !isIPv6) return res.status(400).json({ success: false, error: 'Invalid IP address format' });

  const start = performance.now();
  try {
    const hostnames = await dns.reverse(ip);
    const latency = Math.round(performance.now() - start);
    logHistory('Reverse DNS', ip, 'Success', latency, { hostnamesCount: hostnames.length });
    res.json({ success: true, hostnames, lookupTimeMs: latency });
  } catch (error) {
    const latency = Math.round(performance.now() - start);
    let errorMessage = 'Failed to perform reverse DNS lookup';
    if (error.code === 'ENOTFOUND') errorMessage = 'No reverse DNS record found for this IP';
    else if (error.code === 'ETIMEOUT') errorMessage = 'Network timeout occurred during lookup';
    logHistory('Reverse DNS', ip, 'Failed', latency, { error: errorMessage });
    res.status(404).json({ success: false, hostnames: [], lookupTimeMs: latency, error: errorMessage });
  }
});

app.get('/api/ping', async (req, res) => {
  const host = req.query.host;
  if (!host || typeof host !== 'string') return res.status(400).json({ success: false, error: 'Host is required' });
  if (!/^[a-zA-Z0-9.\-:]+$/.test(host)) return res.status(400).json({ success: false, error: 'Invalid host format' });

  const start = performance.now();
  const isWin = process.platform === 'win32';
  const isIPv6 = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(host) || host.includes('::');
  const pingCmdStr = !isWin && isIPv6 ? 'ping6' : 'ping';
  const pingArgs = isWin ? ['-n', '4', host] : ['-c', '4', host];
  const pingCmd = spawn(pingCmdStr, pingArgs);

  let stdout = ''; let stderr = '';
  const timeoutId = setTimeout(() => {
    pingCmd.kill();
    if (!res.headersSent) {
      logHistory('Ping', host, 'Failed', Math.round(performance.now() - start), { error: 'Network timeout' });
      res.status(504).json({ success: false, error: 'Network timeout' });
    }
  }, 10000);

  pingCmd.stdout.on('data', (data) => { stdout += data.toString(); });
  pingCmd.stderr.on('data', (data) => { stderr += data.toString(); });
  pingCmd.on('close', (code) => {
    clearTimeout(timeoutId);
    if (res.headersSent) return;
    const latencyMs = Math.round(performance.now() - start);

    if (code !== 0 && stdout.trim() === '') {
      let errorMsg = 'Failed to execute ping';
      if (stderr.toLowerCase().includes('unknown host') || stderr.toLowerCase().includes('name or service not known')) {
        errorMsg = 'DNS resolution failure';
      }
      logHistory('Ping', host, 'Failed', latencyMs, { error: errorMsg });
      return res.status(404).json({ success: false, error: errorMsg });
    }
    if (stdout.toLowerCase().includes('could not find host') || stdout.toLowerCase().includes('unknown host')) {
      logHistory('Ping', host, 'Failed', latencyMs, { error: 'DNS resolution failure' });
      return res.status(404).json({ success: false, error: 'DNS resolution failure' });
    }

    const attempts = [];
    let sent = 4; let received = 0;
    const timeRegex = /time(?:=|<=|<)\s*([\d.]+)/gi;
    let match; let attemptId = 1;
    while ((match = timeRegex.exec(stdout)) !== null) {
      attempts.push({ attempt: attemptId++, latency: parseFloat(match[1]) });
      received++;
    }

    if (received === 0 && (stdout.toLowerCase().includes('100% packet loss') || code !== 0)) {
       logHistory('Ping', host, 'Failed', latencyMs, { error: 'Host unreachable' });
       return res.status(404).json({ success: false, error: 'Host unreachable' });
    }

    const packetLoss = sent > 0 ? ((sent - received) / sent) * 100 : 0;
    let min = 0, max = 0, avg = 0;
    if (attempts.length > 0) {
      const latencies = attempts.map(a => a.latency);
      min = Math.min(...latencies); max = Math.max(...latencies);
      avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    }

    logHistory('Ping', host, 'Success', latencyMs, { avgLatency: Number(avg.toFixed(2)), packetLoss });
    res.json({ success: true, attempts, stats: { sent, received, packetLoss, minLatency: Number(min.toFixed(2)), maxLatency: Number(max.toFixed(2)), avgLatency: Number(avg.toFixed(2)) } });
  });
});

app.get('/api/http-headers', async (req, res) => {
  let url = req.query.url;
  if (!url || typeof url !== 'string') return res.status(400).json({ success: false, error: 'URL is required' });
  url = url.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;

  const start = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, { method: 'GET', signal: controller.signal, redirect: 'follow' });
    clearTimeout(timeoutId);
    const latency = Math.round(performance.now() - start);

    const headers = {};
    for (const [key, value] of response.headers.entries()) headers[key.toLowerCase()] = value;
    const redirectCount = response.redirected ? 1 : (url !== response.url ? 1 : 0);
    
    let score = 100;
    if (!headers['strict-transport-security']) score -= 20;
    if (!headers['content-security-policy']) score -= 20;
    if (!headers['x-frame-options']) score -= 15;
    if (!headers['x-content-type-options']) score -= 15;
    
    logHistory('HTTP Headers', url, 'Success', latency, { statusCode: response.status, securityScore: Math.max(0, score) });
    res.json({ success: true, statusCode: response.status, statusText: response.statusText, httpVersion: 'HTTP/1.1 or 2', responseTimeMs: latency, finalUrl: response.url, redirectCount, headers });
  } catch (error) {
    clearTimeout(timeoutId);
    const latency = Math.round(performance.now() - start);
    let errorMessage = 'Failed to fetch HTTP headers';
    if (error.name === 'AbortError') errorMessage = 'Network timeout occurred while fetching headers';
    else if (error.cause && error.cause.code === 'ENOTFOUND') errorMessage = 'Website Unreachable (DNS Resolution Failed)';
    else if (error.cause && error.cause.code === 'ECONNREFUSED') errorMessage = 'Website Unreachable (Connection Refused)';
    else if (error.message && (error.message.toLowerCase().includes('ssl') || error.message.toLowerCase().includes('cert')) || (error.cause && error.cause.code && error.cause.code.includes('CERT'))) errorMessage = 'SSL Certificate Error';
    else if (error.message && error.message.includes('redirect')) errorMessage = 'Redirect Loop Detected';
    else if (error.message && error.message.includes('Invalid URL')) errorMessage = 'Invalid URL format';
    
    logHistory('HTTP Headers', url, 'Failed', latency, { error: errorMessage });
    res.status(404).json({ success: false, error: errorMessage });
  }
});

app.get('/api/ssl', (req, res) => {
  let domain = req.query.domain;
  if (!domain || typeof domain !== 'string') return res.status(400).json({ success: false, error: 'Domain is required' });
  domain = domain.trim().replace(/^https?:\/\//i, '').split('/')[0];
  const start = performance.now();
  const options = { host: domain, port: 443, servername: domain, rejectUnauthorized: false, timeout: 10000 };
  const socket = tls.connect(options, () => {
    const cert = socket.getPeerCertificate(true);
    const tlsVersion = socket.getProtocol();
    socket.destroy();
    const latency = Math.round(performance.now() - start);

    if (!cert || Object.keys(cert).length === 0) {
      logHistory('SSL', domain, 'Failed', latency, { error: 'Certificate not found' });
      return res.status(404).json({ success: false, error: 'Certificate not found' });
    }

    const validFrom = new Date(cert.valid_from);
    const validTo = new Date(cert.valid_to);
    const daysRemaining = Math.max(0, Math.floor((validTo - new Date()) / (1000 * 60 * 60 * 24)));
    
    let status = 'Valid';
    if (new Date() > validTo) status = 'Expired';
    else if (daysRemaining < 30) status = 'Expiring Soon';

    let san = [];
    if (cert.subjectaltname) san = cert.subjectaltname.split(',').map(s => s.trim().replace(/^DNS:/, ''));

    logHistory('SSL', domain, 'Success', latency, { daysRemaining, status, tlsVersion });
    res.json({ success: true, subject: cert.subject ? cert.subject.CN : '', organization: cert.subject ? (cert.subject.O || '') : '', issuer: cert.issuer ? cert.issuer.CN : '', issuedByOrg: cert.issuer ? (cert.issuer.O || '') : '', validFrom: validFrom.toISOString(), validTo: validTo.toISOString(), daysRemaining, status, signatureAlgorithm: cert.sigalg || 'Unknown', publicKeySize: cert.bits || 'Unknown', tlsVersion: tlsVersion || 'Unknown', san, fingerprint: cert.fingerprint256 || cert.fingerprint || '', serialNumber: cert.serialNumber || '' });
  });

  socket.on('error', (err) => {
    socket.destroy();
    const latency = Math.round(performance.now() - start);
    let errorMessage = 'Failed to connect to host';
    if (err.code === 'ENOTFOUND') errorMessage = 'Host unreachable or DNS failure';
    else if (err.code === 'ECONNREFUSED') errorMessage = 'Connection refused (Port 443 closed)';
    else if (err.code === 'ETIMEDOUT') errorMessage = 'Connection timeout';
    logHistory('SSL', domain, 'Failed', latency, { error: errorMessage });
    res.status(404).json({ success: false, error: errorMessage });
  });

  socket.on('timeout', () => {
    socket.destroy();
    const latency = Math.round(performance.now() - start);
    logHistory('SSL', domain, 'Failed', latency, { error: 'Connection timeout' });
    res.status(404).json({ success: false, error: 'Connection timeout' });
  });
});

app.get('/api/whois', async (req, res) => {
  let domain = req.query.domain;
  if (!domain || typeof domain !== 'string') return res.status(400).json({ success: false, error: 'Domain is required' });
  domain = domain.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
  const start = performance.now();

  try {
    const rawData = await whois(domain);
    const latency = Math.round(performance.now() - start);
    const dataStr = JSON.stringify(rawData).toLowerCase();
    if (Object.keys(rawData).length === 0 || dataStr.includes('no match') || dataStr.includes('not found') || dataStr.includes('no data found')) {
      logHistory('WHOIS', domain, 'Failed', latency, { error: 'Not registered' });
      return res.status(404).json({ success: false, error: 'WHOIS record unavailable or domain not registered' });
    }

    const findKey = (keysList) => {
      for (const k of Object.keys(rawData)) {
        const lowerK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const target of keysList) { if (lowerK.includes(target.toLowerCase().replace(/[^a-z0-9]/g, ''))) return rawData[k]; }
      }
      return '';
    };

    const domainName = findKey(['domainname', 'domain']);
    const registrar = findKey(['registrar']);
    const whoisServer = findKey(['whoisserver', 'whois']);
    const createdDate = findKey(['creationdate', 'created', 'registrationdate', 'registered']);
    const updatedDate = findKey(['updateddate', 'updated', 'modified']);
    const expirationDate = findKey(['registryexpirydate', 'expirationdate', 'expires', 'expiry']);
    const domainStatus = findKey(['domainstatus', 'status']);
    const nameServerRaw = findKey(['nameserver', 'nserver']);
    const dnssec = findKey(['dnssec']);
    const registrantCountry = findKey(['registrantcountry', 'country']);
    const registrantOrg = findKey(['registrantorganization', 'organization', 'registrant']);

    let nameServers = [];
    if (nameServerRaw) {
      if (typeof nameServerRaw === 'string') nameServers = nameServerRaw.split(/[\n, ]+/).filter(n => n.trim()).map(n => n.trim().toLowerCase());
      else nameServers = Object.values(nameServerRaw).map(n => String(n).trim().toLowerCase());
    }
    nameServers = [...new Set(nameServers)]; 

    let statuses = [];
    if (domainStatus) {
      if (typeof domainStatus === 'string') statuses = domainStatus.split(/[\n,]+/).map(s => s.trim().split(' ')[0]);
      else statuses = Object.values(domainStatus).map(s => String(s).trim().split(' ')[0]);
    }
    statuses = [...new Set(statuses)];

    let daysUntilExpiration = 0; let registrationAge = '';
    if (expirationDate) {
      const exp = new Date(expirationDate);
      if (!isNaN(exp.getTime())) daysUntilExpiration = Math.max(0, Math.ceil((exp - new Date()) / (1000 * 60 * 60 * 24)));
    }
    if (createdDate) {
      const created = new Date(createdDate);
      if (!isNaN(created.getTime())) {
        const totalDays = Math.max(0, Math.ceil((new Date() - created) / (1000 * 60 * 60 * 24)));
        registrationAge = `${Math.floor(totalDays / 365)} years, ${totalDays % 365} days`;
      }
    }

    logHistory('WHOIS', domain, 'Success', latency, { dnssec: dnssec || 'unsigned' });
    res.json({ success: true, domainName: domainName || domain, registrar, whoisServer, createdDate, updatedDate, expirationDate, domainStatus: statuses, nameServers, dnssec, registrantCountry, registrantOrg, daysUntilExpiration, registrationAge });
  } catch (error) {
    const latency = Math.round(performance.now() - start);
    let msg = 'Failed to fetch WHOIS records.';
    if (error.message && error.message.toLowerCase().includes('timeout')) msg = 'Connection timeout while reaching WHOIS server';
    logHistory('WHOIS', domain, 'Failed', latency, { error: msg });
    res.status(error.message && error.message.toLowerCase().includes('timeout') ? 404 : 500).json({ success: false, error: msg });
  }
});

app.get('/api/traceroute', (req, res) => {
  let host = req.query.host;
  if (!host || typeof host !== 'string') return res.status(400).json({ success: false, error: 'Host is required' });
  host = host.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
  if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(host) && !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return res.status(400).json({ success: false, error: 'Invalid host format' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const isWin = osTraceroute.platform() === 'win32';
  const cmd = isWin ? 'tracert' : 'traceroute';
  const args = isWin ? ['-d', '-h', '30', '-w', '1000', host] : ['-q', '1', '-m', '30', '-w', '1', host];

  const traceroute = spawn(cmd, args);
  let resolvedIp = '';
  let traceComplete = false;
  const start = performance.now();

  const sendEvent = (type, data) => res.write(`data: ${JSON.stringify({ type, data })}\n\n`);

  const timeoutId = setTimeout(() => {
    if (!traceComplete) {
      traceroute.kill();
      logHistory('Traceroute', host, 'Failed', Math.round(performance.now() - start), { error: 'Network timeout' });
      sendEvent('error', { message: 'Network timeout' });
      res.end();
    }
  }, 30000);
  sendEvent('start', { host });

  traceroute.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach(line => {
      line = line.trim();
      if (!line) return;
      if (line.toLowerCase().includes('traceroute to') || line.toLowerCase().includes('tracing route to')) {
        const ipMatch = line.match(/\(([\d.]+)\)/) || line.match(/\[([\d.]+)\]/);
        if (ipMatch) resolvedIp = ipMatch[1];
        return;
      }
      const parts = line.split(/\s+/);
      const hopNum = parseInt(parts[0], 10);
      if (!isNaN(hopNum) && hopNum > 0 && hopNum <= 30) {
        let hopIp = ''; let hopHost = ''; let latency = 0; let timeout = false;
        if (line.includes('* * *') || (isWin && line.includes('*') && parts.length < 5)) timeout = true;
        else {
          const msMatch = line.match(/([\d.]+)\s*ms/);
          if (msMatch) latency = parseFloat(msMatch[1]);
          else if (isWin && line.includes('<1 ms')) latency = 0.5;
          const ipMatch = line.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
          if (ipMatch) {
            hopIp = ipMatch[0]; hopHost = hopIp; 
            const hostMatch = line.match(/(\S+)\s+\((?:\d{1,3}\.){3}\d{1,3}\)/);
            if (hostMatch) hopHost = hostMatch[1];
          }
        }
        if (hopIp || timeout) sendEvent('hop', { hop: hopNum, ip: hopIp || '*', hostname: hopHost || '*', latency: timeout ? 0 : latency, timeout });
      }
    });
  });

  traceroute.on('close', (code) => {
    clearTimeout(timeoutId);
    traceComplete = true;
    const latency = Math.round(performance.now() - start);
    logHistory('Traceroute', host, 'Success', latency, { resolvedIp });
    sendEvent('complete', { target: host, resolvedIp: resolvedIp || host, totalTime: latency });
    res.end();
  });

  traceroute.on('error', (err) => {
    clearTimeout(timeoutId);
    const latency = Math.round(performance.now() - start);
    logHistory('Traceroute', host, 'Failed', latency, { error: err.message });
    sendEvent('error', { message: 'Failed to start traceroute process. ' + err.message });
    res.end();
  });

  req.on('close', () => {
    if (!traceComplete) {
      traceroute.kill();
      logHistory('Traceroute', host, 'Failed', Math.round(performance.now() - start), { error: 'Aborted by client' });
    }
  });
});

app.get('/api/dashboard', (req, res) => {
  const queries = {
    totalQueries: "SELECT COUNT(*) as count FROM history WHERE date(timestamp) = date('now')",
    successfulLookups: "SELECT COUNT(*) as count FROM history WHERE status = 'Success'",
    failedRequests: "SELECT COUNT(*) as count FROM history WHERE status = 'Failed'",
    avgResponseTime: "SELECT AVG(latency_ms) as avg FROM history WHERE status = 'Success'",
    mostUsedTool: "SELECT tool_name, COUNT(*) as count FROM history GROUP BY tool_name ORDER BY count DESC LIMIT 1",
    recentActivity: "SELECT id, tool_name as tool, target, status, latency_ms as latency, timestamp as time FROM history ORDER BY timestamp DESC LIMIT 50",
    mostQueriedDomain: "SELECT target, COUNT(*) as count FROM history GROUP BY target ORDER BY count DESC LIMIT 1",
    avgDnsTime: "SELECT AVG(latency_ms) as avg FROM history WHERE tool_name = 'DNS' AND status = 'Success'",
    avgPingTime: "SELECT AVG(latency_ms) as avg FROM history WHERE tool_name = 'Ping' AND status = 'Success'",
    queriesLast7Days: "SELECT date(timestamp) as date, COUNT(*) as count FROM history WHERE timestamp >= date('now', '-7 days') GROUP BY date(timestamp) ORDER BY date(timestamp) ASC",
    toolUsage: "SELECT tool_name as name, COUNT(*) as value FROM history GROUP BY tool_name",
    avgLatencyByTool: "SELECT tool_name as name, AVG(latency_ms) as latency FROM history WHERE status = 'Success' GROUP BY tool_name",
    rawCertMetadata: "SELECT metadata FROM history WHERE tool_name = 'SSL' AND status = 'Success' ORDER BY timestamp DESC",
    rawWhoisMetadata: "SELECT metadata FROM history WHERE tool_name = 'WHOIS' AND status = 'Success' ORDER BY timestamp DESC",
    rawHttpMetadata: "SELECT metadata FROM history WHERE tool_name = 'HTTP Headers' AND status = 'Success' ORDER BY timestamp DESC"
  };

  const results = {};
  let pending = Object.keys(queries).length;

  Object.keys(queries).forEach(key => {
    db.all(queries[key], [], (err, rows) => {
      if (err) {
        results[key] = null;
      } else {
        if (key === 'totalQueries' || key === 'successfulLookups' || key === 'failedRequests') results[key] = rows[0]?.count || 0;
        else if (key === 'avgResponseTime' || key === 'avgDnsTime' || key === 'avgPingTime') results[key] = Math.round(rows[0]?.avg || 0);
        else if (key === 'mostUsedTool') results[key] = rows[0]?.tool_name || 'None';
        else if (key === 'mostQueriedDomain') results[key] = rows[0]?.target || 'None';
        else if (['recentActivity', 'queriesLast7Days', 'toolUsage', 'avgLatencyByTool'].includes(key)) results[key] = rows;
        else results[key] = rows;
      }
      pending--;
      if (pending === 0) {
        let certsExpiringSoon = 0;
        const certDoms = new Set();
        (results.rawCertMetadata || []).forEach(row => {
          try {
            const meta = JSON.parse(row.metadata);
            if (meta.status === 'Expiring Soon' && !certDoms.has(meta.target)) {
              certsExpiringSoon++;
              certDoms.add(meta.target);
            }
          } catch(e) {}
        });

        let domainsWithoutDnssec = 0;
        const whoisDoms = new Set();
        (results.rawWhoisMetadata || []).forEach(row => {
          try {
            const meta = JSON.parse(row.metadata);
            if (meta.dnssec && meta.dnssec.toLowerCase().includes('unsigned') && !whoisDoms.has(meta.target)) {
              domainsWithoutDnssec++;
              whoisDoms.add(meta.target);
            }
          } catch(e) {}
        });

        let httpSecurityAvg = 0;
        let httpCount = 0;
        (results.rawHttpMetadata || []).forEach(row => {
          try {
            const meta = JSON.parse(row.metadata);
            if (typeof meta.securityScore === 'number') {
              httpSecurityAvg += meta.securityScore;
              httpCount++;
            }
          } catch(e) {}
        });
        if (httpCount > 0) httpSecurityAvg = Math.round(httpSecurityAvg / httpCount);
        else httpSecurityAvg = 100;

        res.json({
          success: true,
          overview: {
            totalQueriesToday: results.totalQueries,
            successfulLookups: results.successfulLookups,
            failedRequests: results.failedRequests,
            avgResponseTime: results.avgResponseTime,
            mostUsedTool: results.mostUsedTool,
          },
          insights: {
            mostQueriedDomain: results.mostQueriedDomain,
            avgDnsTime: results.avgDnsTime,
            avgPingTime: results.avgPingTime,
            certsExpiringSoon,
            domainsWithoutDnssec,
            httpSecurityAvg
          },
          charts: {
            queriesLast7Days: results.queriesLast7Days || [],
            toolUsage: results.toolUsage || [],
            avgLatencyByTool: results.avgLatencyByTool || []
          },
          recentActivity: results.recentActivity || []
        });
      }
    });
  });
});

app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    services: {
      backendApi: 'Green',
      database: db ? 'Green' : 'Red',
      whoisService: 'Green',
      dnsResolver: 'Green',
      tracerouteEngine: 'Green'
    }
  });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Backend server listening on port ${port}`);
});
