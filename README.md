# Project Porishkar 🤖💧

**Intelligent Drain Monitoring & Cleaning System**

A real-time drain monitoring system that uses IoT sensors to detect clogs and deploy an autonomous cleaning bot when needed.

---

## 🎯 Overview

Project Porishkar combines hardware sensors with a web-based dashboard to monitor drainage systems in real-time. The system tracks flow rates, detects potential clogs, and provides visual feedback through camera feeds and interactive maps.

### Key Features
- **Real-time Flow Monitoring** - Track water flow rates with ESP32-based sensors
- **Clog Detection** - Automatic alerts when flow drops below threshold
- **Autonomous Bot Control** - Deploy cleaning bot to clear detected clogs
- **Interactive Dashboard** - Web-based monitoring with visual gauges and maps

---

## 📁 Project Structure

```
Aqua/
├── index.html              # Main dashboard interface
├── css/
│   └── style.css          # Dashboard styling
├── js/
│   └── app.js             # Dashboard logic and API integration
└── flowMeter_Aqua/        # ESP32 flow meter firmware
    ├── platformio.ini     # PlatformIO configuration
    └── src/
        └── main.cpp       # ESP32 sensor code
```

---

## 🚀 Quick Start

### 1. Hardware Setup (ESP32 Flow Meter)

**Prerequisites:**
- [PlatformIO](https://platformio.org/) installed
- ESP32 development board
- Flow sensor connected to ESP32

**Steps:**
```bash
# Navigate to the flow meter directory
cd flowMeter_Aqua

# Install dependencies and build
pio run

# Upload to ESP32 (via USB)
pio run --target upload

# Monitor serial output
pio device monitor
```

**For OTA (Over-The-Air) Updates:**
```bash
# Upload via WiFi (ensure ESP32 is on network)
pio run --target upload
```

> **Note:** The default OTA hostname is `FlowMeter-ESP32.local`. Update `platformio.ini` line 20 if needed.

---

### 2. Web Dashboard Setup

**Prerequisites:**
- Modern web browser (Chrome, Firefox, Edge)
- Web server (optional, for remote access)

**Option A: Local File Access**
Simply open `index.html` in your browser:
```bash
# From project root
open index.html
# or
xdg-open index.html  # Linux
```

**Option B: HTTP Server (Recommended)**
```bash
# Using Python 3
python3 -m http.server 8000

# Using Node.js
npx serve

# Using PHP
php -S localhost:8000
```

Then navigate to: `http://localhost:8000`

---

## ⚙️ Configuration

### Device Addresses

1. Open the web dashboard
2. Expand the **Device Configuration** section
3. Set the following addresses:

- **Flow Meter Address**: `http://10.93.71.184/api/data`
- **Bot Camera**: `http://192.168.0.110/bot/stream`

4. Click **Apply Configuration**

> **Mock Data Mode:** Leave fields empty to use simulated data for testing without hardware.

### ESP32 Network Configuration

Update WiFi credentials in `flowMeter_Aqua/src/main.cpp`:
```cpp
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
```

---

## 📊 Usage

### Dashboard Features

**Monitoring:**
- View real-time flow rate on circular gauge
- Check min/avg/max flow statistics
- Monitor system and bot status

**Alerts:**
- Automatic alerts when flow drops below threshold (default 20 L/min)
- Visual clog indicators on drainage map

**Bot Control:**
- Deploy cleaning bot when clog detected
- View bot camera interface
- Return bot to dock after cleaning

---

## 🔧 Development

### ESP32 Firmware

**Build:**
```bash
cd flowMeter_Aqua
pio run
```

**Clean build:**
```bash
pio run --target clean
pio run
```

**Monitor serial output:**
```bash
pio device monitor -b 115200
```

### Web Dashboard

The dashboard is built with vanilla HTML/CSS/JavaScript:
- Edit `index.html` for structure
- Modify `css/style.css` for styling
- Update `js/app.js` for functionality

No build process required - changes are reflected immediately on page refresh.

---

## 🌐 API Endpoints

The ESP32 flow meter should expose the following endpoint:

**GET** `/api/data`
```json
{
  "flowRate": 125.5,
  "totalVolume": 1700.5
}
```

---

## 📝 License

© 2024 Project Porishkar - Intelligent Drainage Management System