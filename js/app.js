// ==========================================
// Project Aqua - Application Logic
// ==========================================

// Configuration
const CONFIG = {
    flowMeterUrl: 'http://192.168.154.184/api/data',  // Actual ESP32 flow meter endpoint
    botCameraUrl: 'http://192.168.154.1',
    updateInterval: 2000, // 2 seconds
    defaultThreshold: 20, // L/min
    mockMode: false // Set to false when connected to actual hardware
};

// Default configuration for reset
const DEFAULT_CONFIG = {
    flowMeterUrl: 'http://192.168.154.184/api/data',
    botCameraUrl: 'http://192.168.154.1'
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
    lowFlowStartTime: null, // Track when low flow started
    // Track which devices are using real data
    devices: {
        flowMeter: { usingRealData: false, connected: false },
        botCamera: { usingRealData: false, connected: false }
    }
};

// DOM Elements
const elements = {
    currentFlowRate: document.getElementById('currentFlowRate'),
    totalVolume: document.getElementById('totalVolume'),
    thresholdInput: document.getElementById('thresholdInput'),
    systemStatusText: document.getElementById('systemStatusText'),
    botStatusText: document.getElementById('botStatusText'),
    flowMeterStatus: document.getElementById('flowMeterStatus'),
    gaugeValue: document.getElementById('gaugeValue'),
    gaugeProgress: document.getElementById('gaugeProgress'),
    thresholdValue: document.getElementById('thresholdValue'),
    minFlow: document.getElementById('minFlow'),
    avgFlow: document.getElementById('avgFlow'),
    maxFlow: document.getElementById('maxFlow'),
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
    console.log('🚀 Project Porishkar Initializing...');

    // Add SVG gradient for gauge
    addGaugeGradient();

    // Setup event listeners
    setupEventListeners();

    // Initialize camera feeds
    initializeCameras();

    // Start data polling (will auto-detect real vs mock per device)
    startDataPolling();

    console.log('✅ Project Porishkar Ready');
}

// ==========================================
// Camera Management
// ==========================================

function initializeCameras() {
    // Only Bot Camera logic remains
    // Bot camera is activated when deployed
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
            // Update Total Volume UI directly here as it's not part of the flow update loop
            if (elements.totalVolume) {
                elements.totalVolume.textContent = `${state.totalVolume.toFixed(3)} L`;
            }
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
    elements.currentFlowRate.textContent = `${flowRate.toFixed(2)} L/min`;
    elements.gaugeValue.textContent = Math.round(flowRate);

    // Update gauge progress
    const maxGaugeValue = 250;
    const percentage = Math.min((flowRate / maxGaugeValue) * 100, 100);
    const circumference = 534; // 2 * PI * 85
    const offset = circumference - (percentage / 100) * circumference;
    elements.gaugeProgress.style.strokeDashoffset = offset;

    // Change gauge color based on threshold (Low flow = Bad)
    if (flowRate < state.threshold) {
        elements.gaugeProgress.style.stroke = 'url(#dangerGradient)';
    } else if (flowRate < state.threshold * 1.2) {
        // Warning zone (close to threshold)
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
    // Alert if flow rate is BELOW threshold (clog detection)
    if (state.flowRate < state.threshold) {
        // If this is the start of the low flow condition, record the time
        if (state.lowFlowStartTime === null) {
            state.lowFlowStartTime = Date.now();
            console.log('⏱️ Low flow detected. Starting 5s timer...');
        }

        // Check if 5 seconds have passed
        const duration = Date.now() - state.lowFlowStartTime;
        if (duration >= 5000 && !state.warningActive) {
            triggerWarning();
        }
    } else {
        // Flow is normal, reset timer and clear warning
        state.lowFlowStartTime = null;

        if (state.warningActive) {
            clearWarning();
        }
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

    console.log('⚠️ WARNING: Flow rate below threshold (Clog Detected)!');
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
    // Threshold input listener
    if (elements.thresholdInput) {
        elements.thresholdInput.addEventListener('change', (e) => {
            const newThreshold = parseFloat(e.target.value);
            if (!isNaN(newThreshold) && newThreshold >= 0) {
                state.threshold = newThreshold;
                console.log(`⚙️ Threshold updated to: ${state.threshold} L/min`);

                // Update static display if it exists
                if (elements.thresholdValue) {
                    elements.thresholdValue.textContent = `${state.threshold} L/min`;
                }

                // Re-check threshold immediately
                checkThreshold();
                // Update gauge colors
                updateFlowUI();
            }
        });
    }
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
    const botCameraUrl = document.getElementById('botCameraUrlInput').value.trim();
    const configStatus = document.getElementById('configStatus');

    // Update configuration (empty URLs are allowed - will use mock data)
    CONFIG.flowMeterUrl = flowMeterUrl;
    CONFIG.botCameraUrl = botCameraUrl;

    // Reset device states
    state.devices.flowMeter.usingRealData = false;
    state.devices.flowMeter.connected = false;
    state.devices.botCamera.usingRealData = false;
    state.devices.botCamera.connected = false;

    // Reinitialize cameras
    initializeCameras();

    // Show success message
    let message = '✓ Configuration applied!';
    if (!flowMeterUrl) message += ' (Flow meter: mock)';
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
    alert('Project Porishkar v1.0\n\nIntelligent Drain Monitoring & Cleaning System\n\nDeveloped for automated drainage maintenance with real-time monitoring and autonomous robot deployment.');
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
