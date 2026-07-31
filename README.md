# Passable Span Panel Card

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/default)
[![version](https://img.shields.io/badge/version-v1.0.0-blue.svg)](https://github.com/GBear09/passable-span-panel-card/releases)
[![license](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

A sleek, customizable, and universal custom dashboard card for Home Assistant to visually monitor and control your **Span Smart Electrical Panel**. Designed with realistic physical breaker panel layouts, interactive circuit toggles, priority selection, real-time power/voltage/current telemetry, **Native Home Assistant `ha-entity-picker` Visual UI Editor support**, and **automatic breaker discovery**.

---

## ✨ Features

- ⚡ **Physical Panel View**: Realistic two-column electrical panel grid layout with numbered breaker tabs (1–32), central busbar visualizer, and open/empty slot indicators.
- 🔄 **Sort by Power vs Panel Layout**: Easily switch between physical tab ordering and real-time power draw sorting.
- 🛠️ **Native `ha-entity-picker` Visual UI Editor**: Integrated with Home Assistant's native entity picker component complete with search, icons, domain filtering (`sensor`), and field help text.
- 🔍 **Smart Auto-Discovery**: Automatically discovers all panel circuit breakers, power sensors, breaker ratings, current sensors, and priority selectors using your panel's base keyword (e.g., `span_panel`).
- ⚡ **Real-Time Telemetry & Status Badges**: Displays total active power (W), panel voltage (V), and total current (A) in real-time header chips.
- 🚗 **EV Charger Hardware Linking**: Special handling to seamlessly detect and link standalone EV Charger current telemetry and breaker ratings to panel circuits.
- 🎛️ **Circuit Priority Control**: Quick drop-down control for Span off-grid priority levels (*Stays On*, *Until Battery*, *Turns Off*) directly on each breaker block.
- 📱 **Fully Responsive Layout**: Automatically collapses to a clean single-column mobile-friendly list view on smaller viewports.

---

## 🛠️ Visual UI Editor

When editing your dashboard in Home Assistant, select **Passable Span Panel Card**. The native visual editor allows you to configure the card interactively:

1. **Panel Title** (Optional, default: `Span Panel`)
2. **Entity Keyword** (Required, default: `span_panel` - base prefix for discovering panel entities)
3. **Power Summary Entity** (Required, native `ha-entity-picker` filtered to sensor domain, e.g. `sensor.span_panel_power`)
4. **Advanced Naming Suffixes** (Collapsible section):
   - **Power Sensor Suffix** (Default: `_power`)
   - **Circuit Priority Suffix** (Default: `_circuit_priority`)

---

## 💡 YAML Configuration Example

```yaml
type: custom:passable-span-panel-card
title: Main Electrical Panel
entity_keyword: span_panel
power_summary_entity: sensor.span_panel_power
```

---

## 📦 Installation

### Option 1: HACS (Recommended)

1. Open **HACS** in your Home Assistant instance.
2. Click the three dots `⋮` in the top right corner and select **Custom repositories**.
3. Paste the URL: `https://github.com/GBear09/passable-span-panel-card`
4. Set the category to **Lovelace** (Dashboard).
5. Click **Add**, search for **Passable Span Panel Card**, and click **Download**.
6. Refresh your browser page.

### Option 2: Manual Installation

1. Download `passable-span-panel-card.js` from the [latest release](https://github.com/GBear09/passable-span-panel-card/releases).
2. Copy `passable-span-panel-card.js` to your Home Assistant `www/` directory (`/config/www/passable-span-panel-card.js`).
3. In Home Assistant, navigate to **Settings** -> **Dashboards** -> **Three Dots (Top Right)** -> **Resources**.
4. Add resource:
   - **URL**: `/local/passable-span-panel-card.js?v=1.0.0`
   - **Resource Type**: `JavaScript Module`

---

## 📄 License

Distributed under the [MIT License](LICENSE).
