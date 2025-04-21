// main.c - Full ESP32-S3 MQTT UI over WSS with SPIFFS + LVGL UI + Sidebar Navigation

#include <stdio.h>
#include <string.h>
#include <dirent.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/semphr.h"
#include "esp_log.h"
#include "esp_event.h"
#include "esp_netif.h"
#include "esp_wifi.h"
#include "esp_spiffs.h"
#include "esp_tls.h"
#include "mqtt_client.h"
#include "nvs_flash.h"
#include "bsp/esp-bsp.h"
#include "lvgl.h"
#include "esp_sntp.h"

#define WIFI_SSID "Flugel"
#define WIFI_PASS "dogecoin"
#define MQTT_URI        "wss://lb88002c.ala.us-east-1.emqxsl.com:8084/mqtt"
#define MQTT_USERNAME   "Carlos"
#define MQTT_PASSWORD   "mqtt2025"
#define MQTT_TOPIC      "usf/messages"

static const char *ca_cert =
"-----BEGIN CERTIFICATE-----\n"
"MIIDrzCCApegAwIBAgIQCDvgVpBCRrGhdWrJWZHHSjANBgkqhkiG9w0BAQUFADBh\n"
"MQswCQYDVQQGEwJVUzEVMBMGA1UEChMMRGlnaUNlcnQgSW5jMRkwFwYDVQQLExB3\n"
"d3cuZGlnaWNlcnQuY29tMSAwHgYDVQQDExdEaWdpQ2VydCBHbG9iYWwgUm9vdCBD\n"
"QTAeFw0wNjExMTAwMDAwMDBaFw0zMTExMTAwMDAwMDBaMGExCzAJBgNVBAYTAlVT\n"
"MRUwEwYDVQQKEwxEaWdpQ2VydCBJbmMxGTAXBgNVBAsTEHd3dy5kaWdpY2VydC5j\n"
"b20xIDAeBgNVBAMTF0RpZ2lDZXJ0IEdsb2JhbCBSb290IENBMIIBIjANBgkqhkiG\n"
"9w0BAQEFAAOCAQ8AMIIBCgKCAQEA4jvhEXLeqKTTo1eqUKKPC3eQyaKl7hLOllsB\n"
"CSDMAZOnTjC3U/dDxGkAV53ijSLdhwZAAIEJzs4bg7/fzTtxRuLWZscFs3YnFo97\n"
"nh6Vfe63SKMI2tavegw5BmV/Sl0fvBf4q77uKNd0f3p4mVmFaG5cIzJLv07A6Fpt\n"
"43C/dxC//AH2hdmoRBBYMql1GNXRor5H4idq9Joz+EkIYIvUX7Q6hL+hqkpMfT7P\n"
"T19sdl6gSzeRntwi5m3OFBqOasv+zbMUZBfHWymeMr/y7vrTC0LUq7dBMtoM1O/4\n"
"gdW7jVg/tRvoSSiicNoxBN33shbyTApOB6jtSj1etX+jkMOvJwIDAQABo2MwYTAO\n"
"BgNVHQ8BAf8EBAMCAYYwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4EFgQUA95QNVbR\n"
"TLtm8KPiGxvDl7I90VUwHwYDVR0jBBgwFoAUA95QNVbRTLtm8KPiGxvDl7I90VUw\n"
"DQYJKoZIhvcNAQEFBQADggEBAMucN6pIExIK+t1EnE9SsPTfrgT1eXkIoyQY/Esr\n"
"hMAtudXH/vTBH1jLuG2cenTnmCmrEbXjcKChzUyImZOMkXDiqw8cvpOp/2PV5Adg\n"
"06O/nVsJ8dWO41P0jmP6P6fbtGbfYmbW0W5BjfIttep3Sp+dWOIrWcBAI+0tKIJF\n"
"PnlUkiaY4IBIqDfv8NZ5YBberOgOzW6sRBc4L0na4UU+Krk2U886UAb3LujEV0ls\n"
"YSEY1QSteDwsOoBrp+uvFRTp2InBuThs4pFsiv9kuXclVzDAGySj4dzp30d8tbQk\n"
"CAUw7C29C79Fv1C5qfPrmAESrciIxpg0X40KPMbp1ZWVbd4=\n"
"-----END CERTIFICATE-----\n";


static const char *TAG = "MQTT_UI";

static lv_obj_t *label_status, *terminal;
static lv_obj_t *tabview;
static lv_obj_t *tabs[5];
static SemaphoreHandle_t term_mutex;
static esp_mqtt_client_handle_t mqtt_client = NULL;
static bool mqtt_connected = false;
static char term_buf[4096];
static int term_pos = 0;

void mqtt_start();
void send_mqtt(const char *cmd);
void btn_up_cb(lv_event_t *e);
void btn_down_cb(lv_event_t *e);

int _write(int fd, const char *data, int size) {
    if (fd == 1 && term_mutex) {
        xSemaphoreTake(term_mutex, portMAX_DELAY);
        for (int i = 0; i < size && term_pos < sizeof(term_buf) - 1; i++) {
            term_buf[term_pos++] = data[i];
        }
        term_buf[term_pos] = '\0';
        xSemaphoreGive(term_mutex);
    }
    return size;
}

void sync_time() {
    ESP_LOGI(TAG, "⏰ Initializing SNTP...");
    esp_sntp_setoperatingmode(SNTP_OPMODE_POLL);
    esp_sntp_setservername(0, "pool.ntp.org");
    esp_sntp_init();
    time_t now = 0;
    struct tm timeinfo = { 0 };
    int retry = 0;
    const int retry_count = 10;
    while (timeinfo.tm_year < (2022 - 1900) && ++retry < retry_count) {
        vTaskDelay(2000 / portTICK_PERIOD_MS);
        time(&now);
        localtime_r(&now, &timeinfo);
    }
    if (timeinfo.tm_year >= (2022 - 1900)) {
        ESP_LOGI(TAG, "✅ Time synced: %s", asctime(&timeinfo));
    } else {
        ESP_LOGW(TAG, "⚠️ Failed to sync time!");
    }
}

void spiffs_init() {
    esp_vfs_spiffs_conf_t conf = {
        .base_path = "/spiffs",
        .max_files = 3,
        .format_if_mount_failed = false
    };
    esp_err_t ret = esp_vfs_spiffs_register(&conf);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "SPIFFS mount failed (%s)", esp_err_to_name(ret));
    } else {
        ESP_LOGI(TAG, "SPIFFS mounted successfully");
    }
}

void wifi_event_handler(void* arg, esp_event_base_t base, int32_t id, void* data) {
    if (base == WIFI_EVENT && id == WIFI_EVENT_STA_START) {
        esp_wifi_connect();
    } else if (base == WIFI_EVENT && id == WIFI_EVENT_STA_DISCONNECTED) {
        mqtt_connected = false;
        lv_label_set_text(label_status, "Wi-Fi Disconnected");
        esp_wifi_connect();
    } else if (base == IP_EVENT && id == IP_EVENT_STA_GOT_IP) {
        ip_event_got_ip_t* event = (ip_event_got_ip_t*) data;
        lv_label_set_text(label_status, "Wi-Fi Connected. Starting MQTT...");
        mqtt_start();
    }
}

void wifi_init() {
    esp_netif_init();
    esp_event_loop_create_default();
    esp_netif_create_default_wifi_sta();
    esp_event_handler_register(WIFI_EVENT, ESP_EVENT_ANY_ID, &wifi_event_handler, NULL);
    esp_event_handler_register(IP_EVENT, IP_EVENT_STA_GOT_IP, &wifi_event_handler, NULL);
    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    esp_wifi_init(&cfg);
    wifi_config_t wifi_config = {
        .sta = {
            .ssid = WIFI_SSID,
            .password = WIFI_PASS,
            .threshold.authmode = WIFI_AUTH_WPA2_PSK,
            .pmf_cfg = {.capable = true, .required = false}
        },
    };
    esp_wifi_set_mode(WIFI_MODE_STA);
    esp_wifi_set_config(WIFI_IF_STA, &wifi_config);
    esp_wifi_start();
}

void mqtt_event_handler(void *handler_args, esp_event_base_t base, int32_t event_id, void *event_data) {
    esp_mqtt_event_handle_t event = event_data;
    switch (event_id) {
        case MQTT_EVENT_CONNECTED:
            mqtt_connected = true;
            esp_mqtt_client_subscribe(mqtt_client, MQTT_TOPIC, 0);
            lv_label_set_text(label_status, "MQTT Connected!");
            break;
        case MQTT_EVENT_DISCONNECTED:
            mqtt_connected = false;
            lv_label_set_text(label_status, "MQTT Disconnected");
            break;
        case MQTT_EVENT_DATA:
            printf("\n📩 %.*s: %.*s\n", event->topic_len, event->topic, event->data_len, event->data);
            break;
        case MQTT_EVENT_ERROR:
            lv_label_set_text(label_status, "MQTT Error");
            break;
        default:
            break;
    }
}

void mqtt_start() {
    esp_mqtt_client_config_t mqtt_cfg = {
        .broker.address.uri = MQTT_URI,
        .broker.verification.certificate = (const char *)ca_cert,
        .credentials.username = MQTT_USERNAME,
        .credentials.authentication.password = MQTT_PASSWORD,
    };
    mqtt_client = esp_mqtt_client_init(&mqtt_cfg);
    esp_mqtt_client_register_event(mqtt_client, ESP_EVENT_ANY_ID, mqtt_event_handler, NULL);
    esp_mqtt_client_start(mqtt_client);
}

void btn_up_cb(lv_event_t *e) {
    send_mqtt("COMMAND:UP");
}

void btn_down_cb(lv_event_t *e) {
    send_mqtt("COMMAND:DOWN");
}

void send_mqtt(const char *cmd) {
    if (mqtt_connected) {
        int msg_id = esp_mqtt_client_publish(mqtt_client, MQTT_TOPIC, cmd, 0, 1, 0);
        lv_label_set_text_fmt(label_status, "Sent: %s", cmd);
    } else {
        lv_label_set_text(label_status, "MQTT Not Connected");
    }
}

void terminal_task(void *arg) {
    while (1) {
        vTaskDelay(pdMS_TO_TICKS(200));
        xSemaphoreTake(term_mutex, portMAX_DELAY);
        if (term_pos > 0) {
            lv_textarea_add_text(terminal, term_buf);
            lv_textarea_set_cursor_pos(terminal, LV_TEXTAREA_CURSOR_LAST);
            term_pos = 0;
        }
        xSemaphoreGive(term_mutex);
    }
}

void switch_tab_cb(lv_event_t *e) {
    int id = (int)lv_event_get_user_data(e);
    lv_tabview_set_act(tabview, id, LV_ANIM_ON);
}

void create_sidebar_tabs(lv_obj_t *parent) {
    static const char *tab_names[] = { "Home", "Logs", "Controls", "Settings", "About" };
    for (int i = 0; i < 5; i++) {
        lv_obj_t *btn = lv_btn_create(parent);
        lv_obj_set_size(btn, 100, 50);
        lv_obj_align(btn, LV_ALIGN_TOP_LEFT, 5, 20 + i * 60);
        lv_obj_add_event_cb(btn, switch_tab_cb, LV_EVENT_CLICKED, (void*)(intptr_t)i);
        lv_obj_t *lbl = lv_label_create(btn);
        lv_label_set_text(lbl, tab_names[i]);
        lv_obj_center(lbl);
    }
}

void update_language_cb(lv_event_t *e) {
    lv_obj_t *dropdown = lv_event_get_target(e);
    uint16_t selected = lv_dropdown_get_selected(dropdown);
    static const char *translations[][5] = {
        {"Home", "Logs", "Controls", "Settings", "About"},
        {"主页", "日志", "控制", "设置", "关于"},
        {"मुखपृष्ठ", "लॉग्स", "नियंत्रण", "सेटिंग्स", "जानकारी"},
        {"Inicio", "Registros", "Controles", "Configuración", "Acerca de"},
        {"Accueil", "Journaux", "Commandes", "Paramètres", "À propos"},
        {"الصفحة الرئيسية", "السجلات", "عناصر التحكم", "الإعدادات", "حول"},
        {"হোম", "লগস", "নিয়ন্ত্রণ", "সেটিংস", "সম্বন্ধে"},
        {"Главная", "Журналы", "Управление", "Настройки", "О программе"},
        {"Início", "Registos", "Controles", "Configurações", "Sobre"},
        {"ہوم", "لاگز", "کنٹرولز", "ترتیبات", "کے بارے میں"},
    };
    for (int i = 0; i < 5; i++) {
        lv_obj_t *btn = lv_obj_get_child(lv_scr_act(), i);
        if (btn && lv_obj_get_class(btn) == &lv_btn_class) {
            lv_obj_t *label = lv_obj_get_child(btn, 0);
            lv_label_set_text(label, translations[selected][i]);
        }
    }
}

void ui_init() {
    tabview = lv_tabview_create(lv_scr_act(), LV_DIR_RIGHT, 120);
    lv_obj_set_size(tabview, LV_HOR_RES, LV_VER_RES);
    for (int i = 0; i < 5; i++) {
        tabs[i] = lv_tabview_add_tab(tabview, "");
    }

    create_sidebar_tabs(lv_scr_act());

    // Status label shown at the top of the Home tab (e.g., Wi-Fi and MQTT connection status)
    label_status = lv_label_create(tabs[0]);
    lv_label_set_text(label_status, "Status: Initializing...");
    lv_obj_align(label_status, LV_ALIGN_TOP_MID, 40, 10);

    // Terminal for displaying received MQTT messages in the Logs tab
    terminal = lv_textarea_create(tabs[1]);
    lv_obj_set_size(terminal, LV_HOR_RES - 140, LV_VER_RES - 40);
    lv_obj_align(terminal, LV_ALIGN_CENTER, 20, 0);

    // 'UP' control button in the Controls tab (sends COMMAND:UP over MQTT)
    lv_obj_t *btn_up = lv_btn_create(tabs[2]);
    lv_obj_set_size(btn_up, 100, 60);
    lv_obj_align(btn_up, LV_ALIGN_TOP_MID, 40, 40);
    lv_obj_t *up_lbl = lv_label_create(btn_up);
    lv_label_set_text(up_lbl, "UP");
    lv_obj_center(up_lbl);
    lv_obj_add_event_cb(btn_up, btn_up_cb, LV_EVENT_CLICKED, NULL);

    // 'DOWN' control button in the Controls tab (sends COMMAND:DOWN over MQTT)
    lv_obj_t *btn_down = lv_btn_create(tabs[2]);
    lv_obj_set_size(btn_down, 100, 60);
    lv_obj_align(btn_down, LV_ALIGN_BOTTOM_MID, 40, -40);
    lv_obj_t *down_lbl = lv_label_create(btn_down);
    lv_label_set_text(down_lbl, "DOWN");
    lv_obj_center(down_lbl);
    lv_obj_add_event_cb(btn_down, btn_down_cb, LV_EVENT_CLICKED, NULL);

    // Label in Settings tab for introducing language selection
    lv_obj_t *settings_label = lv_label_create(tabs[3]);
// Label displayed in the Settings tab to prompt the user to pick a language
    lv_label_set_text(settings_label, "Select Language:");
lv_obj_align(settings_label, LV_ALIGN_TOP_MID, 0, 20);

static const char *languages[] = {
    "English", "Mandarin", "Hindi", "Spanish", "French",
    "Arabic", "Bengali", "Russian", "Portuguese", "Urdu"
};
// Dropdown for language selection in Settings tab
    lv_obj_t *dd = lv_dropdown_create(tabs[3]);
lv_dropdown_set_options(dd, "English\n"
                            "Mandarin\n"
                            "Hindi\n"
                            "Spanish\n"
                            "French\n"
                            "Arabic\n"
                            "Bengali\n"
                            "Russian\n"
                            "Portuguese\n"
                            "Urdu");
lv_obj_set_width(dd, 160);
lv_obj_align(dd, LV_ALIGN_TOP_MID, 0, 60);

lv_obj_add_event_cb(dd, update_language_cb, LV_EVENT_VALUE_CHANGED, NULL);
    // Label in About tab describing the app purpose
    lv_obj_t *about_label = lv_label_create(tabs[4]);
// Label in About tab giving a description of the project purpose
    lv_label_set_text(about_label, "This application showcases MQTT + UI on ESP32-S3.");
lv_obj_align(about_label, LV_ALIGN_CENTER, 0, 0);
}

void app_main(void) {
    ESP_LOGI(TAG, "Starting MQTT UI...");
    ESP_ERROR_CHECK(nvs_flash_init());
    bsp_display_start();
    bsp_display_backlight_on();
    ui_init();
    term_mutex = xSemaphoreCreateMutex();
    spiffs_init();
    wifi_init();
    sync_time();
    xTaskCreate(terminal_task, "term", 4096, NULL, 5, NULL);
    while (1) {
        lv_timer_handler();
        vTaskDelay(pdMS_TO_TICKS(10));
    }
}
