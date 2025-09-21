const express = require('express');
const WebSocket = require('ws');
const { spawn } = require('child_process');
const cors = require('cors');
const os = require('os');

const app = express();
app.use(cors());

const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });

app.get('/', (req, res) => {
  res.json({ 
    status: 'Terminal server running',
    platform: os.platform(),
    shell: os.platform() === 'win32' ? 'powershell.exe' : '/bin/bash'
  });
});

wss.on('connection', (ws) => {
  console.log('New terminal connection');
  
  // Platform detection
  const shell = os.platform() === 'win32' ? 'powershell.exe' : '/bin/bash';
  const args = os.platform() === 'win32' ? ['-NoProfile', '-NoLogo'] : ['-i'];
  
  const terminal = spawn(shell, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      TERM: 'xterm-color',
      PS1: '$ '
    },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  // Send welcome message
  ws.send('Terminal connected! Ready for commands.\r\n$ ');

  // Terminal output → WebSocket
  terminal.stdout.on('data', (data) => {
    ws.send(data.toString());
  });

  terminal.stderr.on('data', (data) => {
    ws.send(data.toString());
  });

  // WebSocket input → Terminal
  ws.on('message', (data) => {
    const command = data.toString().trim();
    terminal.stdin.write(command + '\n');
  });

  // Cleanup
  ws.on('close', () => {
    console.log('Terminal connection closed');
    terminal.kill('SIGTERM');
  });

  terminal.on('exit', (code) => {
    console.log(`Terminal process exited with code ${code}`);
    if (ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  });

  terminal.on('error', (error) => {
    console.error('Terminal error:', error);
    ws.send(`Error: ${error.message}\r\n`);
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Terminal server running on port ${PORT}`);
  console.log(`Platform: ${os.platform()}`);
});
