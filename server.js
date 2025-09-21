const express = require('express');
const WebSocket = require('ws');
const { spawn } = require('child_process');
const cors = require('cors');

const app = express();
app.use(cors());

const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });

app.get('/', (req, res) => {
  res.json({ status: 'Terminal server running' });
});

wss.on('connection', (ws) => {
  console.log('New terminal connection');
  
  // Windows PowerShell process
  const terminal = spawn('powershell.exe', ['-NoProfile', '-NoLogo'], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  // Terminal output → WebSocket
  terminal.stdout.on('data', (data) => {
    ws.send(data.toString());
  });

  terminal.stderr.on('data', (data) => {
    ws.send(data.toString());
  });

  // WebSocket input → Terminal
  ws.on('message', (data) => {
    terminal.stdin.write(data + '\r\n');
  });

  // Cleanup
  ws.on('close', () => {
    terminal.kill();
  });

  terminal.on('exit', () => {
    ws.close();
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Terminal server running on port ${PORT}`);
});