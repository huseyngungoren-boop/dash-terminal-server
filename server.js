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
    shell: os.platform() === 'win32' ? 'cmd.exe' : '/bin/bash'
  });
});

wss.on('connection', (ws) => {
  console.log('New terminal connection');
  
  // Create proper shell based on platform
  const shell = os.platform() === 'win32' ? 'cmd.exe' : '/bin/bash';
  const args = os.platform() === 'win32' ? ['/k', 'prompt $P$G'] : ['-i'];
  
  const terminal = spawn(shell, args, {
    cwd: process.env.HOME || process.env.USERPROFILE || '/tmp',
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      PS1: '\\[\\033[01;32m\\]\\u@\\h\\[\\033[00m\\]:\\[\\033[01;34m\\]\\w\\[\\033[00m\\]\\$ '
    },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  // Send initial prompt
  const welcomeMsg = `\x1b[32m● Terminal connected\x1b[0m\r\n`;
  ws.send(welcomeMsg);

  // Terminal output → WebSocket (with proper encoding)
  terminal.stdout.on('data', (data) => {
    ws.send(data.toString('utf8'));
  });

  terminal.stderr.on('data', (data) => {
    ws.send(`\x1b[31m${data.toString('utf8')}\x1b[0m`);
  });

  // WebSocket input → Terminal (handle special keys)
  ws.on('message', (data) => {
    const input = data.toString();
    
    // Handle special keys
    if (input === '\r') {
      terminal.stdin.write('\n');
    } else if (input === '\u007f') { // Backspace
      terminal.stdin.write('\b');
    } else if (input === '\t') { // Tab
      terminal.stdin.write('\t');
    } else if (input === '\u0003') { // Ctrl+C
      terminal.kill('SIGINT');
    } else {
      terminal.stdin.write(input);
    }
  });

  // Connection cleanup
  ws.on('close', () => {
    console.log('Terminal connection closed');
    terminal.kill('SIGTERM');
  });

  terminal.on('exit', (code) => {
    console.log(`Terminal process exited with code ${code}`);
    ws.send(`\r\n\x1b[33mProcess exited with code ${code}\x1b[0m\r\n`);
    ws.close();
  });

  terminal.on('error', (error) => {
    console.error('Terminal error:', error);
    ws.send(`\x1b[31mTerminal error: ${error.message}\x1b[0m\r\n`);
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Terminal server running on port ${PORT}`);
  console.log(`Platform: ${os.platform()}`);
});
