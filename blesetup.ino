// blesetup.ino
// Example: Adding BLE support to an existing ESP32 WiFi project
// This script shows all the changes needed to enable BLE advertising and a simple GATT server
// alongside WiFi functionality.

#include <WiFi.h>           // Include the WiFi library for ESP32
#include <BLEDevice.h>      // Include the BLE core library
#include <BLEUtils.h>       // Include BLE utility functions
#include <BLEServer.h>      // Include BLE server functionality

// WiFi credentials (replace with your own)
const char* ssid = "<insert your WiFi SSID here>";      // Your WiFi network name
const char* password = "<insert your WiFi password here>"; // Your WiFi password

// BLE service and characteristic UUIDs
#define SERVICE_UUID        "12345678-1234-1234-1234-1234567890ab" // Unique ID for the BLE service
#define CHARACTERISTIC_UUID "abcdefab-1234-5678-1234-abcdefabcdef" // Unique ID for the BLE characteristic

BLEServer* pServer = nullptr;           // Pointer to the BLE server object
BLECharacteristic* pCharacteristic = nullptr; // Pointer to the BLE characteristic object

void setup() {
  Serial.begin(115200); // Start serial communication for debugging

  // --- WiFi Setup (existing code) ---
  WiFi.begin(ssid, password); // Start connecting to WiFi
  Serial.print("Connecting to WiFi"); // Print status to serial
  while (WiFi.status() != WL_CONNECTED) { // Wait until connected
    delay(500); // Wait 500ms between checks
    Serial.print("."); // Print a dot for each attempt
  }
  Serial.println("\nWiFi connected!"); // Print when connected
  Serial.print("IP address: "); // Print the assigned IP address
  Serial.println(WiFi.localIP());

  // --- BLE Setup (new code) ---
  BLEDevice::init("ESP32-BLE-Demo"); // Initialize BLE and set device name
  pServer = BLEDevice::createServer(); // Create a BLE server instance

  // Create a BLE service
  BLEService *pService = pServer->createService(SERVICE_UUID); // Create a BLE service with the given UUID

  // Create a BLE characteristic
  pCharacteristic = pService->createCharacteristic(
                      CHARACTERISTIC_UUID, // Set the characteristic UUID
                      BLECharacteristic::PROPERTY_READ | // Allow reading
                      BLECharacteristic::PROPERTY_WRITE   // Allow writing
                    );
  // Set initial value
  pCharacteristic->setValue("Hello from ESP32 BLE!"); // Set the default value for the characteristic

  // Start the service
  pService->start(); // Start the BLE service

  // Start advertising
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising(); // Get the advertising object
  pAdvertising->addServiceUUID(SERVICE_UUID); // Advertise the service UUID
  pAdvertising->start(); // Start BLE advertising
  Serial.println("BLE advertising started!"); // Print status
}

void loop() {
  // Your main application code here
  // Both WiFi and BLE will run concurrently
}

// --- Notes ---
// 1. This script can be merged into your main project by copying the BLE setup code into your setup().
// 2. You can add more characteristics or callbacks for advanced BLE features.
// 3. Use a BLE scanner app (like nRF Connect) to test BLE advertising and read/write the characteristic.
// 4. WiFi and BLE can run together on ESP32, but monitor memory usage for large projects. 