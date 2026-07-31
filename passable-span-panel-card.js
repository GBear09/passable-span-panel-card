/**
 * Passable Span Panel Card
 * Version: 1.0.0
 * GitHub: https://github.com/GBear09/passable-span-panel-card
 * 
 * Sleek, universal Home Assistant custom dashboard card for visual breaker
 * panel representation, real-time energy monitoring, and priority management
 * of Span smart electrical panels.
 */

const CARD_VERSION = "1.0.0";

const LitElement = Object.getPrototypeOf(
  customElements.get("hui-entities-card")
);
const html = LitElement.prototype.html;
const css = LitElement.prototype.css;

console.info(
  `%c PASSABLE-SPAN-PANEL-CARD %c v${CARD_VERSION} IS LOADED `,
  "color: white; background: #0284c7; font-weight: bold; padding: 2px 6px; border-radius: 4px 0 0 4px;",
  "color: #0284c7; background: #e0f2fe; font-weight: bold; padding: 2px 6px; border-radius: 0 4px 4px 0;"
);

class PassableSpanPanelCard extends LitElement {
  static getConfigElement() {
    return document.createElement("passable-span-panel-card-editor");
  }

  static getStubConfig() {
    return {
      title: "Span Panel",
      entity_keyword: "span_panel",
      power_summary_entity: "sensor.span_panel_power",
    };
  }

  static get properties() {
    return {
      hass: {},
      config: {},
      _pendingBreakers: { state: true },
      _sortByPower: { state: true },
      _activePriorityMenu: { state: true },
    };
  }

  constructor() {
    super();
    this._pendingBreakers = new Set();
    this._sortByPower = false;
    this._activePriorityMenu = null;
    this._handleOutsideClick = this._handleOutsideClick.bind(this);
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("click", this._handleOutsideClick);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("click", this._handleOutsideClick);
  }

  _handleOutsideClick() {
    if (this._activePriorityMenu) {
      this._closePriorityMenu();
    }
  }

  _closePriorityMenu() {
    this._activePriorityMenu = null;
  }

  _openPriorityMenu(e, breaker) {
    e.stopPropagation();
    this._fireHaptic("light");

    const priorityEntity = this._getEntity(breaker.priority_entity);
    const currentOption = priorityEntity.state !== "unavailable" ? priorityEntity.state : "never";
    const isMobile = window.innerWidth <= 768;

    if (this._activePriorityMenu && this._activePriorityMenu.entityId === breaker.priority_entity) {
      this._activePriorityMenu = null;
    } else {
      this._activePriorityMenu = {
        entityId: breaker.priority_entity,
        name: breaker.name,
        currentOption: currentOption,
        isMobile: isMobile,
      };
    }
  }

  setConfig(config) {
    if (!config.entity_keyword) {
      throw new Error(
        "You must define an 'entity_keyword' for auto-discovery."
      );
    }
    if (!config.power_summary_entity) {
      throw new Error(
        "You must define 'power_summary_entity' to display the header stats."
      );
    }
    this.config = config;
  }

  updated(changedProperties) {
    if (changedProperties.has("hass") && this._pendingBreakers.size > 0) {
      const oldHass = changedProperties.get("hass");
      if (!oldHass) return;

      const updatedPendingBreakers = new Set(this._pendingBreakers);
      let changed = false;

      for (const entityId of this._pendingBreakers) {
        if (
          oldHass.states[entityId]?.state !== this.hass.states[entityId]?.state
        ) {
          updatedPendingBreakers.delete(entityId);
          changed = true;
        }
      }

      if (changed) {
        this._pendingBreakers = updatedPendingBreakers;
      }
    }
  }

  _getEntity(entityId) {
    if (!entityId) return { state: "unavailable", attributes: {} };
    const state = this.hass.states[entityId];
    if (!state) {
      return { state: "unavailable", attributes: {} };
    }
    return state;
  }

  _parseTabs(tabsAttr) {
    if (!tabsAttr) return { start: null, span: 1, col: null, row: null, allTabs: [] };
    let nums = [];
    if (Array.isArray(tabsAttr)) {
      nums = tabsAttr.map(Number).filter((n) => !isNaN(n));
    } else if (typeof tabsAttr === "string") {
      const matches = tabsAttr.match(/\d+/g);
      if (matches) nums = matches.map(Number);
    }

    if (nums.length === 0)
      return { start: null, span: 1, col: null, row: null, allTabs: [] };

    nums.sort((a, b) => a - b);
    const start = nums[0];
    const span = nums.length;
    // Standard panels: odd numbers on left (col 1), even numbers on right (col 2)
    const col = start % 2 !== 0 ? 1 : 2;
    const row = Math.ceil(start / 2);

    return { start, span, col, row, allTabs: nums };
  }

  _findBreakers() {
    const keyword = this.config.entity_keyword;
    const powerSuffix = this.config.power_suffix || "_power";
    const prioritySuffix = this.config.priority_suffix || "_circuit_priority";
    const breakerSuffix = "_breaker";
    const consumedEnergySuffix = "_consumed_energy";

    const allEntities = Object.keys(this.hass.states);

    const powerSensors = allEntities.filter(
      (e) => e.startsWith(`sensor.${keyword}_`) && e.endsWith(powerSuffix)
    );

    const breakers = {};

    powerSensors.forEach((ps) => {
      if (ps.includes("feed_through")) return;

      const baseName = ps.substring(
        `sensor.${keyword}_`.length,
        ps.length - powerSuffix.length
      );

      const consumedEnergyEntityId = `sensor.${keyword}_${baseName}${consumedEnergySuffix}`;
      if (!allEntities.includes(consumedEnergyEntityId)) return;

      let ratingEntityStr = `sensor.${keyword}_${baseName}_breaker_rating`;
      let ratingEntity = allEntities.includes(ratingEntityStr) ? ratingEntityStr : null;

      if (!ratingEntity) {
        const evRatingStr = allEntities.find(e => e.startsWith(`sensor.${keyword}_`) && e.endsWith("drive_car_charger_breaker_rating"));
        if (evRatingStr) {
            ratingEntity = evRatingStr;
        }
      }

      if (!breakers[baseName]) {
        let formattedName = this._formatName(baseName);
        if (ratingEntity && ratingEntity.includes("drive_car_charger") && !formattedName.toLowerCase().includes("charger")) {
            formattedName += " (Car Charger)";
        }

        breakers[baseName] = {
          name: formattedName,
          power_entity: ps,
          rating_entity: ratingEntity,
        };
      }
    });

    Object.keys(breakers).forEach((nameKey) => {
      let switchEntityId = allEntities.find((e) =>
        e.startsWith(`switch.${keyword}_${nameKey}${breakerSuffix}`)
      );
      let priorityEntityId = allEntities.find((e) =>
        e.startsWith(`select.${keyword}_${nameKey}${prioritySuffix}`)
      );

      if (switchEntityId) {
        breakers[nameKey].switch_entity = switchEntityId;
        const switchState = this.hass.states[switchEntityId];
        if (switchState?.attributes?.friendly_name) {
          breakers[nameKey].name = switchState.attributes.friendly_name
            .replace(/\[Breaker\]/gi, "")
            .trim();
        }
      }

      if (priorityEntityId) {
        breakers[nameKey].priority_entity = priorityEntityId;
      }
    });

    return Object.values(breakers);
  }

  _formatName(name) {
    return name.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  }

  _changePriority(entity_id, option) {
    if (!entity_id) return;
    this._fireHaptic("medium");
    this.hass.callService("select", "select_option", {
      entity_id: entity_id,
      option: option,
    });
  }

  _toggleBreaker(entity_id) {
    this._fireHaptic("medium");
    this._pendingBreakers.add(entity_id);
    this.requestUpdate("_pendingBreakers");
    this.hass.callService("switch", "toggle", { entity_id });
  }

  _showMoreInfo(entityId) {
    if (!entityId) return;
    this._fireHaptic("light");
    const event = new Event("hass-more-info", {
      bubbles: true,
      composed: true,
    });
    event.detail = { entityId };
    this.dispatchEvent(event);
  }

  _fireHaptic(style = "light") {
    const event = new Event("haptic", { bubbles: true, composed: true });
    event.detail = style;
    this.dispatchEvent(event);
    if (navigator.vibrate) navigator.vibrate(15);
  }

  _renderBreaker(breaker) {
    const switchEntity = this._getEntity(breaker.switch_entity);
    const powerEntity = this._getEntity(breaker.power_entity);
    const priorityEntity = this._getEntity(breaker.priority_entity);
    const ratingEntity = this._getEntity(breaker.rating_entity);

    // Power
    let powerVal =
      powerEntity.state !== "unavailable" ? parseFloat(powerEntity.state) : 0;
    const powerStr = isNaN(powerVal) ? "--" : powerVal.toFixed(0);

    const hasSwitch = !!breaker.switch_entity;
    const hasValidSwitch = hasSwitch && switchEntity.state !== "unavailable" && switchEntity.state !== "unknown";
    const isLocked = !hasValidSwitch;
    
    const isOn = isLocked || switchEntity.state === "on" || (!isNaN(powerVal) && powerVal >= 1);
    const isPending = hasSwitch ? this._pendingBreakers.has(breaker.switch_entity) : false;

    // Rating
    const ratedAmps =
      ratingEntity.state !== "unavailable" && ratingEntity.state
        ? parseFloat(ratingEntity.state).toFixed(0)
        : "--";
    const voltageAttr = ratingEntity.attributes?.voltage;
    const tabData = this._parseTabs(ratingEntity.attributes?.tabs);
    
    const vNum = parseFloat(voltageAttr) || (tabData.span > 1 ? 240 : 120);
    const voltageStr = voltageAttr ? `${voltageAttr}` : `${vNum}`;
    
    let currentA = "--";
    if (breaker.rating_entity) {
        const explicitCurrentStr = breaker.rating_entity.replace("_breaker_rating", "_current");
        if (this.hass.states[explicitCurrentStr] && this.hass.states[explicitCurrentStr].state !== "unavailable") {
            currentA = parseFloat(this.hass.states[explicitCurrentStr].state).toFixed(1);
        }
    }
    if (currentA === "--" && !isNaN(powerVal)) {
        currentA = (powerVal / vNum).toFixed(1);
    }

    // Priority Button UI (Hybrid Popover/Sheet trigger)
    const priorityState = priorityEntity.state !== "unavailable" ? priorityEntity.state : "N/A";
    const priorityLabels = {
      never: "Stays On",
      soc_threshold: "Until Battery",
      off_grid: "Turns Off",
    };
    const currentLabel = priorityLabels[priorityState] || priorityState;
    const isMenuOpen = this._activePriorityMenu?.entityId === breaker.priority_entity;

    const priorityEl =
      breaker.priority_entity && priorityState !== "N/A"
        ? html`
            <div
              class="priority-btn ${priorityState} ${isMenuOpen ? "active" : ""}"
              @click=${(e) => this._openPriorityMenu(e, breaker)}
              title="Change Priority"
            >
              <span>${currentLabel}</span>
              <ha-icon icon="mdi:chevron-down" class="dropdown-arrow"></ha-icon>

              ${isMenuOpen && !this._activePriorityMenu.isMobile
                ? this._renderDesktopPopover(breaker)
                : html``}
            </div>
          `
        : html`<div class="priority-btn disabled">N/A</div>`;

    // Layout configuration
    const isPanelMode = !this._sortByPower && tabData.start !== null;
    const gridCol = isPanelMode ? (tabData.col === 2 ? 3 : 2) : "auto";
    const layoutStyle = isPanelMode
      ? `grid-column: ${gridCol}; grid-row: ${tabData.row} / span ${tabData.span};`
      : ``;
      
    const colClass = isPanelMode
      ? tabData.col === 2
        ? "col-2"
        : "col-1"
      : "col-list";

    return html`
      <div
        class="breaker-box ${colClass} ${isPending ? "pending" : ""}"
        style="${layoutStyle}"
        @click=${() => this._showMoreInfo(breaker.power_entity)}
      >
        <div
          class="breaker-switch-area ${isLocked ? 'locked' : ''}"
          @click=${(e) => {
            if (!isLocked && !isPending) {
              e.stopPropagation();
              this._toggleBreaker(breaker.switch_entity);
            }
          }}
        >
          <div class="breaker-track ${isOn ? "on" : "off"}">
            <div
              class="breaker-handle ${isOn ? "on" : "off"} ${isLocked ? "locked" : ""}"
              title=${isLocked ? "Circuit locked on by Span" : ""}
            >
              ${ratedAmps}
            </div>
          </div>
        </div>

        <div class="breaker-content">
          <div class="breaker-header">
            <span class="breaker-name" title="${breaker.name}"
              >${breaker.name}</span
            >
            ${priorityEl}
          </div>
          <div class="breaker-metrics">
            <div class="metric" title="Power">
              <ha-icon icon="mdi:lightning-bolt"></ha-icon>${powerStr}W
            </div>
            <div class="metric" title="Current">
              <ha-icon icon="mdi:current-ac"></ha-icon>${currentA}A
            </div>
            <div class="metric" title="Voltage">
              <ha-icon icon="mdi:sine-wave"></ha-icon>${voltageStr}V
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _getPriorityOptions() {
    return [
      {
        id: "never",
        label: "Stays On",
        description: "Circuit remains powered during grid outages",
        icon: "mdi:shield-check-outline",
        colorClass: "never",
      },
      {
        id: "soc_threshold",
        label: "Until Battery",
        description: "Shed circuit when battery drops to target level",
        icon: "mdi:battery-alert-outline",
        colorClass: "soc_threshold",
      },
      {
        id: "off_grid",
        label: "Turns Off",
        description: "Shed circuit immediately when grid fails",
        icon: "mdi:flash-off-outline",
        colorClass: "off_grid",
      },
    ];
  }

  _renderDesktopPopover(breaker) {
    const options = this._getPriorityOptions();
    const currentOption = this._activePriorityMenu.currentOption;

    return html`
      <div class="popover-dropdown" @click=${(e) => e.stopPropagation()}>
        ${options.map((opt) => {
          const isSelected = currentOption === opt.id;
          return html`
            <div
              class="popover-item ${opt.colorClass} ${isSelected ? "selected" : ""}"
              @click=${(e) => {
                e.stopPropagation();
                this._changePriority(breaker.priority_entity, opt.id);
                this._closePriorityMenu();
              }}
            >
              <ha-icon icon=${opt.icon} class="popover-icon ${opt.colorClass}"></ha-icon>
              <span class="popover-label">${opt.label}</span>
              ${isSelected
                ? html`<ha-icon icon="mdi:check" class="check-icon"></ha-icon>`
                : html``}
            </div>
          `;
        })}
      </div>
    `;
  }

  _renderMobileBottomSheet() {
    if (!this._activePriorityMenu || !this._activePriorityMenu.isMobile) return html``;

    const { entityId, name, currentOption } = this._activePriorityMenu;
    const options = this._getPriorityOptions();

    return html`
      <div class="bottom-sheet-backdrop" @click=${this._closePriorityMenu}>
        <div class="bottom-sheet-modal" @click=${(e) => e.stopPropagation()}>
          <div class="sheet-handle"></div>
          <div class="sheet-header">
            <div class="sheet-title">Off-Grid Circuit Priority</div>
            <div class="sheet-subtitle">${name}</div>
          </div>
          <div class="sheet-options">
            ${options.map((opt) => {
              const isSelected = currentOption === opt.id;
              return html`
                <div
                  class="sheet-option-row ${opt.colorClass} ${isSelected ? "selected" : ""}"
                  @click=${() => {
                    this._changePriority(entityId, opt.id);
                    this._closePriorityMenu();
                  }}
                >
                  <div class="sheet-icon-wrapper ${opt.colorClass}">
                    <ha-icon icon=${opt.icon}></ha-icon>
                  </div>
                  <div class="sheet-option-text">
                    <div class="sheet-option-label">${opt.label}</div>
                    <div class="sheet-option-desc">${opt.description}</div>
                  </div>
                  ${isSelected
                    ? html`<ha-icon icon="mdi:check-circle" class="sheet-check-icon"></ha-icon>`
                    : html``}
                </div>
              `;
            })}
          </div>
        </div>
      </div>
    `;
  }

  render() {
    if (!this.hass || !this.config) return html``;

    let allBreakers = this._findBreakers();
    const occupiedTabs = new Set();
    const maxTabs = 32;

    if (this._sortByPower) {
      allBreakers.sort((a, b) => {
        const powerA = parseFloat(this._getEntity(a.power_entity).state) || 0;
        const powerB = parseFloat(this._getEntity(b.power_entity).state) || 0;
        return powerB - powerA;
      });
    } else {
      allBreakers.sort((a, b) => {
        const ratingA = this._getEntity(a.rating_entity);
        const ratingB = this._getEntity(b.rating_entity);
        const tabA = this._parseTabs(ratingA?.attributes?.tabs).start || 999;
        const tabB = this._parseTabs(ratingB?.attributes?.tabs).start || 999;
        return tabA - tabB;
      });
      
      allBreakers.forEach(b => {
          const ratingEntity = this._getEntity(b.rating_entity);
          const tabData = this._parseTabs(ratingEntity?.attributes?.tabs);
          if (tabData.allTabs && tabData.allTabs.length > 0) {
              tabData.allTabs.forEach(t => occupiedTabs.add(t));
          }
      });
    }

    const currentPower = this._getEntity(this.config.power_summary_entity);
    const totalW =
      currentPower.state !== "unavailable"
        ? parseFloat(currentPower.state).toFixed(0)
        : "--";
    const voltage = currentPower.attributes?.voltage || "--";
    const amperage = currentPower.attributes?.amperage || "--";

    const panelElements = [];

    if (!this._sortByPower) {
        panelElements.push(html`<div class="busbar"></div>`);
        
        for (let r = 1; r <= (maxTabs / 2); r++) {
            panelElements.push(html`<div class="tab-number left" style="grid-column: 1; grid-row: ${r};">${r*2 - 1}</div>`);
            panelElements.push(html`<div class="tab-number right" style="grid-column: 4; grid-row: ${r};">${r*2}</div>`);
        }
        
        for (let i = 1; i <= maxTabs; i++) {
            if (!occupiedTabs.has(i)) {
                const col = i % 2 !== 0 ? 2 : 3;
                const row = Math.ceil(i / 2);
                panelElements.push(html`
                  <div class="breaker-box empty" style="grid-column: ${col}; grid-row: ${row};">
                      <div class="empty-text">Empty</div>
                  </div>
                `);
            }
        }
    }

    panelElements.push(...allBreakers.map((breaker) => this._renderBreaker(breaker)));

    return html`
      <ha-card>
        <div class="header" @click=${() => this._showMoreInfo(this.config.power_summary_entity)} style="cursor: pointer;">
          <div class="header-left">
            <h1 class="title">
              <ha-icon
                icon="mdi:flash"
                style="margin-right:8px; color: var(--primary-color);"
              ></ha-icon>
              ${this.config.title || "Span Panel"}
            </h1>
            <p class="subtitle">Real-time Energy Monitoring</p>
          </div>
          <div class="header-right">
             <div class="status-chip active" title="Total Power">
                ${totalW} W
             </div>
             <div class="status-chip info" title="Voltage">
                ${voltage} V
             </div>
             <div class="status-chip warning" title="Amperage">
                ${amperage} A
             </div>
          </div>
        </div>

        <div class="card-content">
          <div class="list-header">
            <span class="list-title">Circuit Panel</span>
            <div
              class="sort-btn ${this._sortByPower ? "active" : ""}"
              @click=${() => {
                this._fireHaptic("light");
                this._sortByPower = !this._sortByPower;
              }}
            >
              <ha-icon icon="mdi:sort-variant"></ha-icon>
              ${this._sortByPower ? "By Power" : "Panel View"}
            </div>
          </div>

          <div
            class="panel-container ${this._sortByPower
              ? "list-mode"
              : "grid-mode"}"
          >
            ${panelElements}
          </div>
        </div>

        ${this._renderMobileBottomSheet()}
      </ha-card>
    `;
  }

  static get styles() {
    return css`
      :host {
        display: block;
        width: 100%;
      }

      ha-card {
        border-radius: var(--ha-card-border-radius, 12px);
        background: var(--ha-card-background, #fff);
        box-shadow: var(--ha-card-box-shadow, 0 2px 4px rgba(0, 0, 0, 0.1));
        overflow: visible;
        color: var(--primary-text-color);
      }

      /* HEADER */
      .header {
        padding: 16px 16px 0;
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        border-bottom: 1px solid var(--divider-color, #e0e0e0);
        padding-bottom: 16px;
        margin-bottom: 16px;
        flex-shrink: 0;
      }
      .header-left {
        display: flex;
        flex-direction: column;
      }
      .title {
        font-size: 24px;
        font-weight: 500;
        margin: 0;
        display: flex;
        align-items: center;
      }
      .subtitle {
        color: var(--secondary-text-color, #757575);
        font-size: 14px;
        margin-top: 4px;
        margin-bottom: 0;
      }
      
      .header-right {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        justify-content: flex-end;
      }
      .status-chip {
        font-size: 11px;
        font-weight: 500;
        padding: 2px 8px;
        border-radius: 12px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        display: flex;
        align-items: center;
        margin-left: 6px;
        margin-top: 4px;
      }
      .status-chip.active {
        background: rgba(var(--rgb-primary-color, 33, 150, 243), 0.15);
        color: var(--primary-color, #2196f3);
      }
      .status-chip.info {
        background: rgba(49, 130, 206, 0.15);
        color: var(--info-color, #3182ce);
      }
      .status-chip.warning {
        background: rgba(255, 152, 0, 0.15);
        color: var(--warning-color, #ff9800);
      }

      .card-content {
        padding: 0 16px 16px;
      }

      /* LIST HEADER */
      .list-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        padding: 0 4px;
      }
      .list-title {
        font-size: 0.85em;
        font-weight: 600;
        color: var(--secondary-text-color);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .sort-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.8em;
        font-weight: 600;
        color: var(--secondary-text-color);
        cursor: pointer;
        padding: 6px 12px;
        border-radius: 16px;
        background: rgba(128, 128, 128, 0.05);
        transition: all 0.2s;
      }
      .sort-btn:hover {
        background: rgba(128, 128, 128, 0.15);
      }
      .sort-btn.active {
        color: var(--primary-color);
        background: rgba(var(--rgb-primary-color, 33, 150, 243), 0.15);
      }
      .sort-btn ha-icon {
        --mdc-icon-size: 16px;
      }

      /* PANEL CONTAINER */
      .panel-container.grid-mode {
        display: grid;
        grid-template-columns: 20px minmax(0, 1fr) minmax(0, 1fr) 20px;
        grid-auto-rows: minmax(70px, auto);
        gap: 6px 8px;
        background: var(--secondary-background-color, #d8d8d8);
        padding: 16px;
        border-radius: 12px;
        position: relative;
        box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.1);
      }
      .busbar {
        position: absolute;
        top: 16px;
        bottom: 16px;
        left: 50%;
        width: 8px;
        background: linear-gradient(to right, #555, #222, #555);
        transform: translateX(-50%);
        border-radius: 4px;
        z-index: 0;
        box-shadow: 0 0 4px rgba(0, 0, 0, 0.5);
      }
      .panel-container.list-mode {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      /* BREAKER BOX & TABS */
      .tab-number {
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: bold;
        color: var(--secondary-text-color, #888);
      }
      
      .breaker-box {
        display: flex;
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color);
        border-radius: 8px;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
        border: 1px solid var(--divider-color, #e0e0e0);
        position: relative;
        z-index: 1;
        cursor: pointer;
        transition: transform 0.1s, box-shadow 0.1s;
      }
      .breaker-box:not(.empty):hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
      }
      @keyframes pulse-border {
        0% { border-color: var(--warning-color, #ff9800); }
        50% { border-color: transparent; }
        100% { border-color: var(--warning-color, #ff9800); }
      }
      .breaker-box.pending {
        animation: pulse-border 1.5s infinite;
        border-width: 2px;
      }
      
      /* Empty Tab Styles */
      .breaker-box.empty {
        background: transparent;
        border: 2px dashed var(--divider-color, #bbb);
        box-shadow: none;
        align-items: center;
        justify-content: center;
        cursor: default;
      }
      .breaker-box.empty .empty-text {
        color: var(--secondary-text-color, #aaa);
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      /* Handle Orientation Physics */
      .breaker-box.col-1 {
        flex-direction: row-reverse;
      }
      .breaker-box.col-2 {
        flex-direction: row;
      }
      .breaker-box.col-list {
        flex-direction: row;
      }

      .breaker-content {
        display: flex;
        flex-direction: column;
        justify-content: center;
        flex-grow: 1;
        padding: 10px 12px;
        min-width: 0;
        background: inherit;
        overflow: visible;
      }
      .col-1 .breaker-content { border-radius: 8px 0 0 8px; }
      .col-2 .breaker-content { border-radius: 0 8px 8px 0; }

      .breaker-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 6px;
        gap: 8px;
        min-width: 0;
        position: relative;
      }
      .breaker-name {
        font-weight: 600;
        font-size: 0.95em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* BREAKER HANDLE & TRACK */
      .breaker-switch-area {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 16px;
        background: #1e1e1e;
        cursor: pointer;
      }
      .breaker-switch-area.locked {
        cursor: not-allowed;
      }
      .col-1 .breaker-switch-area { border-radius: 0 8px 8px 0; border-left: 1px solid #111; }
      .col-2 .breaker-switch-area { border-radius: 8px 0 0 8px; border-right: 1px solid #111; }
      .col-list .breaker-switch-area { border-radius: 8px 0 0 8px; }

      .breaker-track {
        width: 48px;
        height: 28px;
        background: #000;
        border-radius: 4px;
        box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.8), inset 0 0 0 1px #333;
        position: relative;
        display: flex;
        align-items: center;
        transition: background-color 0.3s;
      }
      
      .breaker-track.off {
        background: #3a1111;
        box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.8), inset 0 0 0 1px #5a1a1a;
      }

      .breaker-handle {
        width: 24px;
        height: 24px;
        background: linear-gradient(180deg, #333 0%, #111 100%);
        border-radius: 3px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 4px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.2);
        color: #fff;
        font-size: 11px;
        font-weight: bold;
        position: absolute;
        transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .breaker-handle.locked {
        opacity: 0.8;
      }

      .col-1 .breaker-handle { transform: translateX(2px); }
      .col-1 .breaker-handle.on { transform: translateX(22px); }

      .col-2 .breaker-handle { transform: translateX(22px); }
      .col-2 .breaker-handle.on { transform: translateX(2px); }

      .col-list .breaker-handle { transform: translateX(2px); }
      .col-list .breaker-handle.on { transform: translateX(22px); }
      .col-list .breaker-handle.on.locked { color: #81c784; }

      .breaker-handle.off {
        color: #ff8a80;
        border-bottom: 2px solid #d32f2f;
      }

      /* METRICS */
      .breaker-metrics {
        display: flex;
        gap: 12px;
        font-size: 0.8em;
        color: var(--secondary-text-color);
      }
      .metric {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .metric ha-icon {
        --mdc-icon-size: 14px;
        opacity: 0.8;
      }

      /* PRIORITY BUTTON (MODERN HYBRID TRIGGER) */
      .priority-btn {
        font-size: 0.72em;
        font-weight: 700;
        padding: 4px 10px;
        border-radius: 20px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        border: 1px solid transparent;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 4px;
        position: relative;
        flex-shrink: 0;
        transition: all 0.2s ease;
        user-select: none;
      }
      .priority-btn:hover {
        filter: brightness(1.1);
        transform: scale(1.02);
      }
      .priority-btn.never {
        background-color: rgba(76, 175, 80, 0.18);
        color: #4caf50;
        border-color: rgba(76, 175, 80, 0.4);
      }
      .priority-btn.soc_threshold {
        background-color: rgba(255, 152, 0, 0.18);
        color: #ff9800;
        border-color: rgba(255, 152, 0, 0.4);
      }
      .priority-btn.off_grid {
        background-color: rgba(244, 67, 54, 0.18);
        color: #f44336;
        border-color: rgba(244, 67, 54, 0.4);
      }
      .priority-btn.disabled {
        background-color: rgba(128, 128, 128, 0.15);
        color: var(--secondary-text-color);
        cursor: not-allowed;
        border-color: transparent;
      }
      .priority-btn.active {
        box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.2);
      }
      .dropdown-arrow {
        --mdc-icon-size: 14px;
        transition: transform 0.2s ease;
      }
      .priority-btn.active .dropdown-arrow {
        transform: rotate(180deg);
      }

      /* DESKTOP POPOVER DROPDOWN */
      .popover-dropdown {
        position: absolute;
        top: calc(100% + 6px);
        right: 0;
        z-index: 999;
        background: var(--card-background-color, #1e1e1e);
        border: 1px solid var(--divider-color, rgba(255, 255, 255, 0.15));
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5), 0 2px 6px rgba(0, 0, 0, 0.3);
        padding: 6px;
        min-width: 150px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        animation: popoverFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      }
      @keyframes popoverFadeIn {
        from {
          opacity: 0;
          transform: translateY(-6px) scale(0.96);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      .popover-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        border-radius: 8px;
        font-size: 0.85em;
        font-weight: 600;
        color: var(--primary-text-color, #fff);
        cursor: pointer;
        transition: background-color 0.15s ease;
      }
      .popover-item:hover {
        background: rgba(255, 255, 255, 0.08);
      }
      .popover-item.selected {
        background: rgba(255, 255, 255, 0.12);
      }
      .popover-icon {
        --mdc-icon-size: 16px;
      }
      .popover-icon.never { color: #4caf50; }
      .popover-icon.soc_threshold { color: #ff9800; }
      .popover-icon.off_grid { color: #f44336; }
      .popover-label {
        flex-grow: 1;
        white-space: nowrap;
      }
      .check-icon {
        --mdc-icon-size: 14px;
        color: var(--primary-color, #2196f3);
      }

      /* MOBILE BOTTOM SHEET MODAL */
      .bottom-sheet-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: 10000;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(6px);
        display: flex;
        align-items: flex-end;
        justify-content: center;
        animation: backdropFade 0.2s ease;
      }
      @keyframes backdropFade {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      .bottom-sheet-modal {
        width: 100%;
        max-width: 500px;
        background: var(--card-background-color, #1e1e1e);
        border-radius: 20px 20px 0 0;
        border-top: 1px solid rgba(255, 255, 255, 0.15);
        padding: 12px 18px 24px;
        box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.6);
        animation: sheetSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        box-sizing: border-box;
      }
      @keyframes sheetSlideUp {
        from { transform: translateY(100%); }
        to { transform: translateY(0); }
      }
      .sheet-handle {
        width: 36px;
        height: 4px;
        background: rgba(255, 255, 255, 0.3);
        border-radius: 2px;
        margin: 0 auto 14px;
      }
      .sheet-header {
        margin-bottom: 16px;
        text-align: center;
      }
      .sheet-title {
        font-size: 1.1em;
        font-weight: 700;
        color: var(--primary-text-color, #fff);
      }
      .sheet-subtitle {
        font-size: 0.85em;
        color: var(--secondary-text-color, #aaa);
        margin-top: 2px;
      }
      .sheet-options {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .sheet-option-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 14px;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .sheet-option-row:active {
        transform: scale(0.98);
        background: rgba(255, 255, 255, 0.08);
      }
      .sheet-option-row.selected {
        border-color: rgba(255, 255, 255, 0.25);
        background: rgba(255, 255, 255, 0.08);
      }
      .sheet-icon-wrapper {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .sheet-icon-wrapper.never {
        background: rgba(76, 175, 80, 0.18);
        color: #4caf50;
      }
      .sheet-icon-wrapper.soc_threshold {
        background: rgba(255, 152, 0, 0.18);
        color: #ff9800;
      }
      .sheet-icon-wrapper.off_grid {
        background: rgba(244, 67, 54, 0.18);
        color: #f44336;
      }
      .sheet-icon-wrapper ha-icon {
        --mdc-icon-size: 20px;
      }
      .sheet-option-text {
        display: flex;
        flex-direction: column;
        flex-grow: 1;
      }
      .sheet-option-label {
        font-weight: 700;
        font-size: 0.95em;
        color: var(--primary-text-color, #fff);
      }
      .sheet-option-desc {
        font-size: 0.78em;
        color: var(--secondary-text-color, #aaa);
        margin-top: 2px;
      }
      .sheet-check-icon {
        --mdc-icon-size: 20px;
        color: var(--primary-color, #2196f3);
      }

      /* RESPONSIVE DESIGN FOR SMALLER SCREENS */
      @media (max-width: 850px) {
        .header {
          flex-direction: column;
          align-items: flex-start;
          gap: 12px;
        }
        .header-right {
          width: 100%;
          justify-content: flex-start;
        }
        
        .panel-container.grid-mode {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 12px;
        }
        
        .busbar, .tab-number, .breaker-box.empty {
          display: none !important;
        }

        .breaker-box {
          flex-direction: row !important;
          width: 100%;
          box-sizing: border-box;
        }

        .breaker-content {
          padding: 8px 10px !important;
          border-radius: 0 8px 8px 0 !important;
          min-width: 0;
        }

        .breaker-name {
          font-size: 0.9em;
        }

        .breaker-metrics {
          gap: 8px;
          flex-wrap: wrap;
          font-size: 0.8em;
        }
        
        .breaker-switch-area {
          padding: 0 10px !important;
          border-radius: 8px 0 0 8px !important;
          border: none !important;
          border-right: 1px solid #111 !important;
        }
        
        .breaker-track {
          width: 40px !important;
          height: 24px !important;
        }
        
        .breaker-handle {
          width: 20px !important;
          height: 20px !important;
          font-size: 9px !important;
          transform: translateX(2px) !important;
        }

        .breaker-handle.on { 
          transform: translateX(18px) !important; 
        }
        
        .breaker-handle.on.locked { 
          color: #81c784 !important; 
        }

        .priority-btn {
          padding: 3px 8px;
          font-size: 0.65em;
        }
      }
    `;
  }
}

// --- VISUAL EDITOR ---

class PassableSpanPanelCardEditor extends LitElement {
  static get properties() {
    return {
      hass: {},
      _config: { state: true },
    };
  }

  setConfig(config) {
    this._config = config || {};
  }

  _valueChanged(ev) {
    if (!this._config || !this.hass) return;

    const target = ev.target;
    const configValue = target.configValue || target.getAttribute("configValue");
    if (!configValue) return;

    const value = ev.detail && ev.detail.value !== undefined ? ev.detail.value : target.value;
    if (this._config[configValue] === value) return;

    const newConfig = { ...this._config };
    if (value === "" || value === undefined || value === null) {
      delete newConfig[configValue];
    } else {
      newConfig[configValue] = value;
    }

    this._config = newConfig;
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: newConfig },
        bubbles: true,
        composed: true,
      })
    );
  }

  _renderEntityPicker(configValue, label, domainFilter = null, helpText = "") {
    const currentValue = this._config[configValue] || "";

    return html`
      <div class="option-row">
        <ha-entity-picker
          .hass=${this.hass}
          .value=${currentValue}
          .configValue=${configValue}
          .label=${label}
          .includeDomains=${domainFilter}
          @value-changed=${this._valueChanged}
          allow-custom-entity
        ></ha-entity-picker>
        ${helpText ? html`<span class="help-text">${helpText}</span>` : ""}
      </div>
    `;
  }

  render() {
    if (!this.hass || !this._config) return html``;

    return html`
      <div class="card-config">
        <div class="option-row">
          <label class="label">Panel Title (Optional)</label>
          <input
            class="input-text"
            .value=${this._config.title || ""}
            .configValue=${"title"}
            @input=${this._valueChanged}
            placeholder="Span Panel"
          />
        </div>

        <div class="option-row">
          <label class="label">Entity Keyword (Required)</label>
          <input
            class="input-text"
            .value=${this._config.entity_keyword || ""}
            .configValue=${"entity_keyword"}
            @input=${this._valueChanged}
            placeholder="span_panel"
            required
          />
          <span class="help-text">Base keyword used to auto-discover breakers and circuit sensors (e.g., span_panel).</span>
        </div>

        ${this._renderEntityPicker(
          "power_summary_entity",
          "Power Summary Entity (Required)",
          ["sensor"],
          "Main panel power sensor used for real-time total power, voltage, and amperage telemetry."
        )}

        <details class="advanced-section">
          <summary>Advanced Naming Suffixes</summary>
          <div class="details-content">
            <div class="option-row">
              <label class="label">Power Sensor Suffix</label>
              <input
                class="input-text"
                .value=${this._config.power_suffix || ""}
                .configValue=${"power_suffix"}
                @input=${this._valueChanged}
                placeholder="_power"
              />
              <span class="help-text">Suffix appended to circuit names for power sensors (default: _power).</span>
            </div>

            <div class="option-row">
              <label class="label">Circuit Priority Suffix</label>
              <input
                class="input-text"
                .value=${this._config.priority_suffix || ""}
                .configValue=${"priority_suffix"}
                @input=${this._valueChanged}
                placeholder="_circuit_priority"
              />
              <span class="help-text">Suffix appended to circuit names for priority select entities (default: _circuit_priority).</span>
            </div>
          </div>
        </details>
      </div>
    `;
  }

  static get styles() {
    return css`
      .card-config {
        display: flex;
        flex-direction: column;
        gap: 16px;
        margin-top: 8px;
      }
      .option-row {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .label {
        font-weight: 600;
        font-size: 0.9em;
        color: var(--primary-text-color);
      }
      .input-text {
        width: 100%;
        padding: 10px 12px;
        border-radius: 8px;
        border: 1px solid var(--divider-color, #e0e0e0);
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color);
        font-size: 0.95em;
        box-sizing: border-box;
      }
      .input-text:focus {
        outline: none;
        border-color: var(--primary-color, #0284c7);
      }
      .help-text {
        font-size: 0.75em;
        color: var(--secondary-text-color, #757575);
      }
      ha-entity-picker {
        width: 100%;
      }
      .advanced-section {
        border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.2));
        border-radius: 8px;
        padding: 8px 12px;
        background: rgba(128, 128, 128, 0.05);
      }
      .advanced-section summary {
        cursor: pointer;
        font-weight: 600;
        font-size: 0.9em;
        color: var(--primary-text-color);
      }
      .details-content {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-top: 12px;
      }
    `;
  }
}

customElements.define("passable-span-panel-card", PassableSpanPanelCard);
customElements.define("passable-span-panel-card-editor", PassableSpanPanelCardEditor);

if (!customElements.get("span-panel-card")) {
  customElements.define("span-panel-card", PassableSpanPanelCard);
}
if (!customElements.get("span-panel-card-editor")) {
  customElements.define("span-panel-card-editor", PassableSpanPanelCardEditor);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "passable-span-panel-card",
  name: "Passable Span Panel Card",
  preview: true,
  description: "A sleek, universal visual breaker panel representation and real-time energy monitoring card for Span smart electrical panels.",
});
