# MIFOS Branch CCTV Agent Setup & Technical Guide

This package runs on the local Cashier/CCTV PC at each MIFOS branch to connect the branch's **EZVIZ CS-H6c Camera** to the central MIFOS Web Application.

---

## 📋 System Requirements
1. **Operating System**: Windows 10/11 or Windows Server.
2. **Node.js**: v18.x or later installed.
3. **FFmpeg**: Installed and added to System Environment PATH (`ffmpeg -version`).
4. **Camera Network**: EZVIZ CS-H6c Camera connected to the same LAN (assigned a fixed static local IP, e.g. `192.168.10.50`).

---

## 🚀 Installation & Setup Steps

### Step 1: Configure `config.json`
Open `cctv-agent/config.json` and set branch specific values:

```json
{
  "branch_id": "KTW",
  "agent_id": "CCTV-AGENT-KTW",
  "server_url": "https://mifos-finance.vercel.app",
  "camera": {
    "id": "CAM-KTW-01",
    "name": "Kottawa Counter 01",
    "ip": "192.168.10.50",
    "rtsp_url": "rtsp://admin:VERIFICATION_CODE@192.168.10.50:554/h264/ch1/main/av_stream"
  }
}
```
*(Note: Replace `VERIFICATION_CODE` with the 6-character code printed on the bottom label of your EZVIZ camera).*

---

### Step 2: Test Agent Executable
Open Command Prompt in `cctv-agent` directory and run:

```cmd
node agent.js
```

You will see:
```text
[CCTV AGENT] Loaded config for Branch: KTW, Agent: CCTV-AGENT-KTW
[HEARTBEAT] Ping sent successfully at 10:35:30 AM
[STREAM] Connecting to camera RTSP stream at 192.168.10.50...
[CCTV AGENT] Branch Agent active & ready for MIFOS transaction evidence commands.
```

---

### Step 3: Run as a Permanent Windows Background Service
To ensure the Agent starts automatically whenever the PC turns on, install it using `node-windows` or `NSSM`:

```cmd
nssm install MIFOS-CCTV-Agent "C:\Program Files\nodejs\node.exe" "C:\MIFOS-CCTV\agent.js"
nssm start MIFOS-CCTV-Agent
```

---

## 🔒 Security Architecture
- The branch camera is kept **100% inside the local LAN**.
- Central MIFOS communicates outbound over secure HTTPS/WSS without opening any public camera ports or port forwarding.
