#include <Arduino.h>
#include <WiFi.h>
#include <ESPmDNS.h>
#include <WiFiUdp.h>
#include <ArduinoOTA.h>
#include <WebServer.h>
#include <LittleFS.h>

// WiFi credentials
const char* ssid = "internet";
const char* password = "internet123";

// Web server on port 80
WebServer server(80);

// YF-S201 Flow Meter Configuration
#define SENSOR_PIN 27  // GPIO 27 - Connect to YF-S201 signal pin

volatile int pulseCount = 0;
float flowRate = 0.0;
float totalVolume = 0.0;
unsigned long oldTime = 0;

// YF-S201 calibration factor (pulses per liter/minute)
const float calibrationFactor = 4.5;  // pulses per second per liter/minute

// Interrupt Service Routine for pulse counting
void IRAM_ATTR pulseCounter() {
  pulseCount++;
}

void setup() {
  // Initialize serial communication
  Serial.begin(9600);
  Serial.println("\nBooting...");

  // Connect to WiFi dynamically (DHCP)
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");

  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(500);
  }

  Serial.println("\nWiFi Connected!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());  // Shows IP assigned by DHCP

  // Configure OTA
  ArduinoOTA.setHostname("FlowMeter-ESP32");

  ArduinoOTA.onStart([]() {
    String type = (ArduinoOTA.getCommand() == U_FLASH) ? "sketch" : "filesystem";
    Serial.println("Start updating " + type);
  });

  ArduinoOTA.onEnd([]() {
    Serial.println("\nEnd");
  });

  ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
    Serial.printf("Progress: %u%%\r", (progress / (total / 100)));
  });

  ArduinoOTA.onError([](ota_error_t error) {
    Serial.printf("Error[%u]: ", error);
    if (error == OTA_AUTH_ERROR) Serial.println("Auth Failed");
    else if (error == OTA_BEGIN_ERROR) Serial.println("Begin Failed");
    else if (error == OTA_CONNECT_ERROR) Serial.println("Connect Failed");
    else if (error == OTA_RECEIVE_ERROR) Serial.println("Receive Failed");
    else if (error == OTA_END_ERROR) Serial.println("End Failed");
  });

  ArduinoOTA.begin();
  Serial.println("OTA Ready");

  // Initialize LittleFS
  if (!LittleFS.begin(true)) {
    Serial.println("LittleFS mount failed!");
    return;
  }
  Serial.println("LittleFS mounted successfully");

  // Setup web server routes
  server.on("/", HTTP_GET, []() {
    File file = LittleFS.open("/index.html", "r");
    if (!file) {
      server.send(404, "text/plain", "File not found");
      return;
    }
    server.streamFile(file, "text/html");
    file.close();
  });

  server.on("/api/data", HTTP_GET, []() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    String json = "{\"flowRate\":" + String(flowRate, 2) + ",\"totalVolume\":" + String(totalVolume, 3) + "}";
    server.send(200, "application/json", json);
  });

  server.begin();
  Serial.println("Web server started");
  Serial.print("Open browser: http://");
  Serial.println(WiFi.localIP());

  // Configure sensor pin as input with pull-up
  pinMode(SENSOR_PIN, INPUT_PULLUP);

  // Attach interrupt to sensor pin (trigger on rising edge)
  attachInterrupt(digitalPinToInterrupt(SENSOR_PIN), pulseCounter, RISING);

  oldTime = millis();

  Serial.println("YF-S201 Flow Meter Initialized");
  Serial.println("Flow Rate (L/min) | Total Volume (L)");
  Serial.println("-------------------------------------");
}

void loop() {
  // Handle OTA updates
  ArduinoOTA.handle();

  // Handle web server requests
  server.handleClient();

  // Calculate flow rate every 100ms for faster sampling (10 Hz)
  if (millis() - oldTime >= 100) {
    // Disable interrupts while calculating
    detachInterrupt(digitalPinToInterrupt(SENSOR_PIN));

    // Calculate flow rate in L/min
    flowRate = ((1000.0 / (millis() - oldTime)) * pulseCount) / calibrationFactor;

    // Calculate total volume in liters
    totalVolume += (flowRate / 60.0) * ((millis() - oldTime) / 1000.0);

    // Display results
    Serial.print("Flow Rate: ");
    Serial.print(flowRate, 2);
    Serial.print(" L/min | Total: ");
    Serial.print(totalVolume, 3);
    Serial.println(" L");

    // Reset pulse counter and timer
    pulseCount = 0;
    oldTime = millis();

    // Re-enable interrupts
    attachInterrupt(digitalPinToInterrupt(SENSOR_PIN), pulseCounter, RISING);
  }
}
