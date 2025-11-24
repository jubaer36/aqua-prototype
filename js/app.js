// ==========================================
// Project Aqua - Application Logic
// ==========================================

// Configuration
const CONFIG = {
    flowMeterUrl: 'http://192.168.0.77/api/data',  // Actual ESP32 flow meter endpoint
    esp32CameraUrl: 'http://192.168.0.110/stream',
    botCameraUrl: 'http://192.168.0.110/bot/stream',
    updateInterval: 2000, // 2 seconds
    defaultThreshold: 150, // L/min
    mockMode: true // Set to false when connected to actual hardware
};

// Default configuration for reset
const DEFAULT_CONFIG = {
    flowMeterUrl: 'http://192.168.0.77/api/data',
    esp32CameraUrl: 'http://192.168.0.110/stream',
    botCameraUrl: 'http://192.168.0.110/bot/stream'
};

// Application State
const state = {
    flowRate: 0,
    totalVolume: 0,  // Added from flow meter
    threshold: CONFIG.defaultThreshold,
    minFlow: Infinity,
    maxFlow: 0,
    avgFlow: 0,
    flowHistory: [],
    botDeployed: false,
    warningActive: false,
    // Track which devices are using real data
    devices: {
        flowMeter: { usingRealData: false, connected: false },
        drainCamera: { usingRealData: false, connected: false },
        botCamera: { usingRealData: false, connected: false }
    }
};

// DOM Elements
const elements = {
    currentFlowRate: document.getElementById('currentFlowRate'),
    thresholdDisplay: document.getElementById('thresholdDisplay'),
    systemStatusText: document.getElementById('systemStatusText'),
    botStatusText: document.getElementById('botStatusText'),
    flowMeterStatus: document.getElementById('flowMeterStatus'),
    cameraStatus: document.getElementById('cameraStatus'),
    gaugeValue: document.getElementById('gaugeValue'),
    gaugeProgress: document.getElementById('gaugeProgress'),
    thresholdValue: document.getElementById('thresholdValue'),
    minFlow: document.getElementById('minFlow'),
    avgFlow: document.getElementById('avgFlow'),
    maxFlow: document.getElementById('maxFlow'),
    drainCamera: document.getElementById('drainCamera'),
    cameraOverlay: document.getElementById('cameraOverlay'),
    alertBanner: document.getElementById('alertBanner'),
    clogIndicator: document.getElementById('clogIndicator'),
    sectionB: document.getElementById('sectionB'),
    deployBtn: document.getElementById('deployBtn'),
    returnBtn: document.getElementById('returnBtn'),
    botBadge: document.getElementById('botBadge'),
    botCameraSection: document.getElementById('botCameraSection'),
    botCamera: document.getElementById('botCamera'),
    botCameraOverlay: document.getElementById('botCameraOverlay')
};

// ==========================================
// Initialization
// ==========================================

function init() {
    console.log('🚀 Project Aqua Initializing...');

    // Add SVG gradient for gauge
    addGaugeGradient();

    // Setup event listeners
    setupEventListeners();

    // Initialize camera feeds
    initializeCameras();

    // Start data polling (will auto-detect real vs mock per device)
    startDataPolling();

    console.log('✅ Project Aqua Ready');
}

// ==========================================
// Camera Management
// ==========================================

function initializeCameras() {
    // Check if drainage camera URL is provided and valid
    if (CONFIG.esp32CameraUrl && CONFIG.esp32CameraUrl.trim() !== '') {
        console.log('📹 Attempting to connect to drainage camera:', CONFIG.esp32CameraUrl);

        // Update UI to show the address
        const addressElement = document.getElementById('drainCameraAddress');
        const messageElement = document.getElementById('drainCameraMessage');
        const labelElement = document.getElementById('drainCameraLabel');

        if (addressElement) addressElement.textContent = CONFIG.esp32CameraUrl;
        if (labelElement) labelElement.textContent = `Camera: ${extractHostname(CONFIG.esp32CameraUrl)}`;

        elements.drainCamera.src = CONFIG.esp32CameraUrl;

        elements.drainCamera.onload = () => {
            elements.cameraOverlay.classList.add('hidden');
            state.devices.drainCamera.connected = true;
            state.devices.drainCamera.usingRealData = true;
            updateConnectionStatus(elements.cameraStatus, true);
            console.log('✅ Drainage camera connected');
        };

        elements.drainCamera.onerror = () => {
            state.devices.drainCamera.connected = false;
            state.devices.drainCamera.usingRealData = false;
            updateConnectionStatus(elements.cameraStatus, false);
            if (messageElement) messageElement.textContent = 'Camera Offline - Connection Failed';
            console.error(`❌ Drainage camera connection failed: ${CONFIG.esp32CameraUrl}`);
        };
    } else {
        // No URL provided, use mock
        console.log('📹 No drainage camera URL provided - using mock mode');
        const addressElement = document.getElementById('drainCameraAddress');
        const messageElement = document.getElementById('drainCameraMessage');
        const labelElement = document.getElementById('drainCameraLabel');

        state.devices.drainCamera.usingRealData = false;
        if (messageElement) messageElement.textContent = 'Mock Mode - No Camera Configured';
        if (addressElement) addressElement.textContent = 'No URL configured';
        if (labelElement) labelElement.textContent = 'ESP32-CAM (Mock)';
        updateConnectionStatus(elements.cameraStatus, false);
    }
}

function activateBotCamera() {
    // Check if bot camera URL is provided and valid
    if (CONFIG.botCameraUrl && CONFIG.botCameraUrl.trim() !== '') {
        console.log('🤖 Loading bot interface:', CONFIG.botCameraUrl);

        // Update UI to show the address
        const botIframe = elements.botCamera;
        const overlayElement = elements.botCameraOverlay;
        const labelElement = document.getElementById('botInterfaceLabel');

        if (labelElement) {
            labelElement.textContent = `Bot: ${extractHostname(CONFIG.botCameraUrl)}`;
        }

        // Set iframe source
        if (botIframe) {
            botIframe.src = CONFIG.botCameraUrl;

            // Hide overlay after a delay (iframe load events are unreliable cross-origin)
            setTimeout(() => {
                if (overlayElement) {
                    overlayElement.classList.add('hidden');
                }
                state.devices.botCamera.connected = true;
                state.devices.botCamera.usingRealData = true;
                console.log('✅ Bot interface loaded');
            }, 2000);

            // Handle iframe errors
            botIframe.onerror = () => {
                state.devices.botCamera.connected = false;
                state.devices.botCamera.usingRealData = false;
                const placeholder = overlayElement ? overlayElement.querySelector('p') : null;
                if (placeholder) placeholder.textContent = `Connection Failed: ${CONFIG.botCameraUrl}`;
                console.error(`❌ Bot interface connection failed: ${CONFIG.botCameraUrl}`);
            };
        }
    } else {
        // No URL provided, use mock
        console.log('🤖 No bot interface URL provided - using mock mode');
        state.devices.botCamera.usingRealData = false;
        setTimeout(() => {
            const placeholder = elements.botCameraOverlay.querySelector('p');
            if (placeholder) placeholder.textContent = 'Mock Mode - No Interface Configured';
            elements.botCameraOverlay.classList.add('hidden');
        }, 2000);
    }
}

// Open bot interface in new window
function openBotInterface() {
    if (CONFIG.botCameraUrl && CONFIG.botCameraUrl.trim() !== '') {
        window.open(CONFIG.botCameraUrl, '_blank', 'noopener,noreferrer');
        console.log('🔗 Opening bot interface in new window:', CONFIG.botCameraUrl);
    }
}

// Helper function to extract hostname from URL
function extractHostname(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname + (urlObj.port ? ':' + urlObj.port : '');
    } catch {
        return url;
    }
}

function updateConnectionStatus(element, connected) {
    const statusDot = element.querySelector('.status-dot');
    const statusText = element.querySelector('span:last-child');

    if (connected) {
        statusDot.style.background = 'var(--color-success)';
        statusText.textContent = 'Connected';
    } else {
        statusDot.style.background = 'var(--color-danger)';
        statusText.textContent = 'Disconnected';
    }
}

// ==========================================
// Data Fetching
// ==========================================

async function fetchFlowMeterData() {
    // Check if flow meter URL is provided and valid
    if (!CONFIG.flowMeterUrl || CONFIG.flowMeterUrl.trim() === '') {
        // No URL provided - use mock data (this is intentional)
        if (!state.devices.flowMeter.usingRealData) {
            state.devices.flowMeter.usingRealData = false;
            updateConnectionStatus(elements.flowMeterStatus, false);
        }
        return; // Let mock data run
    }

    // URL is provided - ONLY use real data, show errors if it fails
    try {
        const response = await fetch(CONFIG.flowMeterUrl, {
            method: 'GET',
            mode: 'cors',
            cache: 'no-cache',
            signal: AbortSignal.timeout(5000) // 5 second timeout
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Validate data format from actual ESP32 flow meter
        // Expected format: {"flowRate":123.45,"totalVolume":67.890}
        if (typeof data.flowRate !== 'number') {
            throw new Error('Invalid data format - flowRate must be a number');
        }

        // Update flow data with actual ESP32 values
        updateFlowData(data.flowRate);

        // Store total volume from ESP32
        if (typeof data.totalVolume === 'number') {
            state.totalVolume = data.totalVolume;
        }

        // Mark as using real data
        if (!state.devices.flowMeter.usingRealData) {
            console.log('✅ Flow meter connected - using real data from:', CONFIG.flowMeterUrl);
            console.log('📊 Data format:', data);
        }
        state.devices.flowMeter.usingRealData = true;
        state.devices.flowMeter.connected = true;
        updateConnectionStatus(elements.flowMeterStatus, true);

    } catch (error) {
        // URL provided but connection failed - show error, DON'T use mock
        state.devices.flowMeter.connected = false;
        state.devices.flowMeter.usingRealData = true; // Still trying real data, not mock
        updateConnectionStatus(elements.flowMeterStatus, false);

        console.error(`❌ Flow meter error (${CONFIG.flowMeterUrl}):`, error.message);
        // Keep retrying on next interval
    }
}

function startDataPolling() {
    // Always start mock data generation (will be ignored if real URLs are provided)
    startMockDataGeneration();

    // Attempt to fetch real data periodically
    fetchFlowMeterData();
    setInterval(fetchFlowMeterData, CONFIG.updateInterval);
}

// ==========================================
// Mock Data Generation (for testing)
// ==========================================

function startMockDataGeneration() {
    let baseFlow = 120;
    let trend = 1;

    function generateMockData() {
        // Only generate mock data if URL is NOT provided
        if (CONFIG.flowMeterUrl && CONFIG.flowMeterUrl.trim() !== '') {
            return; // URL provided, don't use mock - let real data handle it
        }

        // Simulate varying flow rates
        baseFlow += (Math.random() - 0.5) * 10 + trend;

        // Periodically change trend
        if (Math.random() > 0.95) {
            trend = (Math.random() - 0.5) * 2;
        }

        // Keep within realistic bounds
        baseFlow = Math.max(60, Math.min(200, baseFlow));

        // Occasionally spike to trigger warning
        const flowRate = Math.random() > 0.9 ? baseFlow + 50 : baseFlow;

        updateFlowData(flowRate);
    }

    generateMockData();
    setInterval(generateMockData, CONFIG.updateInterval);
}

// ==========================================
// Data Processing & UI Updates
// ==========================================

function updateFlowData(flowRate) {
    // Round to 1 decimal place
    flowRate = Math.round(flowRate * 10) / 10;

    // Update state
    state.flowRate = flowRate;
    state.flowHistory.push(flowRate);

    // Keep history limited to last 30 readings
    if (state.flowHistory.length > 30) {
        state.flowHistory.shift();
    }

    // Calculate statistics
    state.minFlow = Math.min(state.minFlow, flowRate);
    state.maxFlow = Math.max(state.maxFlow, flowRate);
    state.avgFlow = state.flowHistory.reduce((a, b) => a + b, 0) / state.flowHistory.length;

    // Update UI
    updateFlowUI();

    // Check threshold
    checkThreshold();
}

function updateFlowUI() {
    const flowRate = state.flowRate;

    // Update main display
    elements.currentFlowRate.textContent = `${flowRate} L/min`;
    elements.gaugeValue.textContent = Math.round(flowRate);

    // Update gauge progress
    const maxGaugeValue = 250;
    const percentage = Math.min((flowRate / maxGaugeValue) * 100, 100);
    const circumference = 534; // 2 * PI * 85
    const offset = circumference - (percentage / 100) * circumference;
    elements.gaugeProgress.style.strokeDashoffset = offset;

    // Change gauge color based on threshold
    if (flowRate > state.threshold) {
        elements.gaugeProgress.style.stroke = 'url(#dangerGradient)';
    } else if (flowRate > state.threshold * 0.8) {
        elements.gaugeProgress.style.stroke = 'url(#warningGradient)';
    } else {
        elements.gaugeProgress.style.stroke = 'url(#gaugeGradient)';
    }

    // Update statistics
    elements.minFlow.textContent = `${Math.round(state.minFlow * 10) / 10} L/min`;
    elements.avgFlow.textContent = `${Math.round(state.avgFlow * 10) / 10} L/min`;
    elements.maxFlow.textContent = `${Math.round(state.maxFlow * 10) / 10} L/min`;
}

function checkThreshold() {
    if (state.flowRate > state.threshold && !state.warningActive) {
        triggerWarning();
    } else if (state.flowRate <= state.threshold && state.warningActive) {
        clearWarning();
    }
}

function triggerWarning() {
    state.warningActive = true;

    // Show alert banner
    elements.alertBanner.classList.remove('hidden');

    // Update system status
    elements.systemStatusText.textContent = 'Warning';
    elements.systemStatusText.style.color = 'var(--color-danger)';

    // Highlight clog location
    elements.clogIndicator.classList.remove('hidden');
    elements.sectionB.classList.add('danger');

    // Update system status badge
    const statusDot = document.querySelector('#systemStatus .status-dot');
    statusDot.classList.add('danger');

    console.log('⚠️ WARNING: Flow rate exceeded threshold!');
}

function clearWarning() {
    state.warningActive = false;

    // Hide alert banner
    elements.alertBanner.classList.add('hidden');

    // Reset system status
    elements.systemStatusText.textContent = 'Normal';
    elements.systemStatusText.style.color = 'var(--color-success)';

    // Clear clog indicator
    elements.clogIndicator.classList.add('hidden');
    elements.sectionB.classList.remove('danger');

    // Reset status badge
    const statusDot = document.querySelector('#systemStatus .status-dot');
    statusDot.classList.remove('danger');

    console.log('✅ Flow rate returned to normal');
}

// ==========================================
// Bot Control
// ==========================================

function toggleBotDeployment() {
    if (!state.botDeployed) {
        deployBot();
    } else {
        returnBot();
    }
}

function deployBot() {
    state.botDeployed = true;

    console.log('🤖 Deploying cleaning bot...');

    // Update button
    const deployBtn = elements.deployBtn;
    deployBtn.classList.add('deployed');
    deployBtn.querySelector('.btn-text').textContent = 'Bot Deployed';
    deployBtn.querySelector('.btn-icon').textContent = '✅';

    // Enable return button
    elements.returnBtn.disabled = false;

    // Update bot status
    elements.botStatusText.textContent = 'Deployed';
    elements.botStatusText.style.color = 'var(--color-success)';

    // Update badge
    elements.botBadge.innerHTML = '<span class="status-dot"></span><span>Deployed</span>';
    elements.botBadge.style.background = 'rgba(16, 185, 129, 0.1)';
    elements.botBadge.style.borderColor = 'rgba(16, 185, 129, 0.3)';

    // Show bot camera
    elements.botCameraSection.classList.remove('hidden');
    activateBotCamera();

    // Simulate deployment notification
    setTimeout(() => {
        alert('🤖 Bot successfully deployed to Section B!\n\nCleaning operation in progress...');
    }, 500);
}

function returnBot() {
    state.botDeployed = false;

    console.log('🏠 Returning bot to dock...');

    // Update button
    const deployBtn = elements.deployBtn;
    deployBtn.classList.remove('deployed');
    deployBtn.querySelector('.btn-text').textContent = 'Deploy Bot';
    deployBtn.querySelector('.btn-icon').textContent = '🚀';

    // Disable return button
    elements.returnBtn.disabled = true;

    // Update bot status
    elements.botStatusText.textContent = 'Standby';
    elements.botStatusText.style.color = 'var(--color-warning)';

    // Update badge
    elements.botBadge.innerHTML = '<span class="status-dot standby"></span><span>Standby Mode</span>';
    elements.botBadge.style.background = 'rgba(245, 158, 11, 0.1)';
    elements.botBadge.style.borderColor = 'rgba(245, 158, 11, 0.3)';

    // Hide bot camera
    elements.botCameraSection.classList.add('hidden');

    setTimeout(() => {
        alert('🏠 Bot returned to dock successfully!');
    }, 500);
}

// ==========================================
// Event Listeners
// ==========================================

function setupEventListeners() {
    // No dynamic event listeners needed for threshold (now static)
    // Threshold is set in CONFIG and displayed as read-only
}

// ==========================================
// Utility Functions
// ==========================================

function dismissAlert() {
    elements.alertBanner.classList.add('hidden');
}

function toggleFullscreen(elementId) {
    const element = document.getElementById(elementId);

    if (!document.fullscreenElement) {
        element.requestFullscreen().catch(err => {
            console.error('Error attempting to enable fullscreen:', err);
        });
    } else {
        document.exitFullscreen();
    }
}

function addGaugeGradient() {
    const svg = document.querySelector('.gauge');
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

    // Normal gradient
    const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gradient.setAttribute('id', 'gaugeGradient');
    gradient.innerHTML = `
        <stop offset="0%" stop-color="#667eea"/>
        <stop offset="100%" stop-color="#00d4ff"/>
    `;

    // Warning gradient
    const warningGradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    warningGradient.setAttribute('id', 'warningGradient');
    warningGradient.innerHTML = `
        <stop offset="0%" stop-color="#f59e0b"/>
        <stop offset="100%" stop-color="#fbbf24"/>
    `;

    // Danger gradient
    const dangerGradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    dangerGradient.setAttribute('id', 'dangerGradient');
    dangerGradient.innerHTML = `
        <stop offset="0%" stop-color="#f59e0b"/>
        <stop offset="100%" stop-color="#ef4444"/>
    `;

    defs.appendChild(gradient);
    defs.appendChild(warningGradient);
    defs.appendChild(dangerGradient);
    svg.insertBefore(defs, svg.firstChild);
}

// ==========================================
// Configuration Management
// ==========================================

function toggleConfigSection() {
    const configBody = document.getElementById('configBody');
    const toggleIcon = document.getElementById('configToggleIcon');

    if (configBody.classList.contains('collapsed')) {
        configBody.classList.remove('collapsed');
        toggleIcon.textContent = '▼';
    } else {
        configBody.classList.add('collapsed');
        toggleIcon.textContent = '▶';
    }
}

function applyConfiguration() {
    const flowMeterUrl = document.getElementById('flowMeterUrlInput').value.trim();
    const esp32CameraUrl = document.getElementById('esp32CameraUrlInput').value.trim();
    const botCameraUrl = document.getElementById('botCameraUrlInput').value.trim();
    const configStatus = document.getElementById('configStatus');

    // Update configuration (empty URLs are allowed - will use mock data)
    CONFIG.flowMeterUrl = flowMeterUrl;
    CONFIG.esp32CameraUrl = esp32CameraUrl;
    CONFIG.botCameraUrl = botCameraUrl;

    // Reset device states
    state.devices.flowMeter.usingRealData = false;
    state.devices.flowMeter.connected = false;
    state.devices.drainCamera.usingRealData = false;
    state.devices.drainCamera.connected = false;
    state.devices.botCamera.usingRealData = false;
    state.devices.botCamera.connected = false;

    // Reinitialize cameras
    initializeCameras();

    // Show success message
    let message = '✓ Configuration applied!';
    if (!flowMeterUrl) message += ' (Flow meter: mock)';
    if (!esp32CameraUrl) message += ' (Drain cam: mock)';
    if (!botCameraUrl) message += ' (Bot cam: mock)';

    configStatus.textContent = message;
    configStatus.className = 'config-status success';

    setTimeout(() => {
        configStatus.textContent = '';
        configStatus.className = 'config-status';
    }, 4000);

    console.log('✅ Configuration updated:', CONFIG);
    console.log('Device states:', state.devices);
}

function resetConfiguration() {
    document.getElementById('flowMeterUrlInput').value = DEFAULT_CONFIG.flowMeterUrl;
    document.getElementById('esp32CameraUrlInput').value = DEFAULT_CONFIG.esp32CameraUrl;
    document.getElementById('botCameraUrlInput').value = DEFAULT_CONFIG.botCameraUrl;

    const configStatus = document.getElementById('configStatus');
    configStatus.textContent = 'Reset to defaults';
    configStatus.className = 'config-status';

    setTimeout(() => {
        configStatus.textContent = '';
    }, 2000);
}

// Placeholder functions for footer links
function showInfo() {
    alert('Project Aqua v1.0\n\nIntelligent Drain Monitoring & Cleaning System\n\nDeveloped for automated drainage maintenance with real-time monitoring and autonomous robot deployment.');
}

function showSettings() {
    // Scroll to and expand config section
    const configSection = document.querySelector('.config-section');
    const configBody = document.getElementById('configBody');
    const toggleIcon = document.getElementById('configToggleIcon');

    configSection.scrollIntoView({ behavior: 'smooth', block: 'center' });

    setTimeout(() => {
        if (configBody.classList.contains('collapsed')) {
            configBody.classList.remove('collapsed');
            toggleIcon.textContent = '▼';
        }
    }, 500);
}

function showLogs() {
    const logs = state.flowHistory.slice(-10).reverse();
    alert(`System Logs (Last 10 readings):\n\n${logs.map((flow, i) => `${i + 1}. Flow Rate: ${Math.round(flow * 10) / 10} L/min`).join('\n')}`);
}

// ==========================================
// Start Application
// ==========================================

// Wait for DOM to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
