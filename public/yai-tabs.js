"use strict";

/**
 * YaiTabs - Yai component
 */
class YaiTabs extends YaiBase {
    constructor(customConfig = {}) {
        // YaiTabs specific config
        const tabsConfig = {
            rootSelector: '[data-yai-tabs]',     /** @var string Tabs container selector, can handle multiple */
            closable: true,                      /** @var bool Closable tabs, click on active tab button closes the tab */
            openDefault: null,                   /** @var int If no data-default is set, use to open predefined index */
            defaultBehavior: 'slide-up',         /** @var string Default animation behavior if no data-behavior is specified */
            autoFocus: true,                     /** @var bool Automatically focus the first container's active tab on init */
            enableNavigationTree: false,         /** @var bool Enable internal navigation tree and state tracking (for advanced features) */
            // Override eventHandler configs
            events: {
                actionableAttributes: ['data-tab-action'],
                actionableTags: ['button'],
            },
            dispatchName: 'yai.tabs',

            // Extend base emitable events with tabs-specific ones
            // Base events are automatically merged from YaiBase.getBaseEmitableEvents()
            emitable: {
                // Tabs-specific events only
                tabOpened: 'tabOpened',
                tabClosed: 'tabClosed',
                tabSwitched: 'tabSwitched',
                hashChanged: 'hashChanged',
                nested: 'nested',
            },
        };

        super(YaiBase.deepMerge(tabsConfig, customConfig));

        /**
         * Create event handler using YaiBase factory | this.events
         * Event selectors & Aliases - simple string format works fine
         */
        this.createEventHandler({
                [this.config.rootSelector]: ['click', 'keydown'],
                window: [{ type: 'hashchange', debounce: 500 }],
            },{
                click: {
                    open:  'openTab',
                    close: 'closeTab',
                },
            }
        );

        // Internal navigation tree and state (only if enabled)
        if (this.config.enableNavigationTree) {
            this.navigationTree = new Map(); // containerId -> tree node
            this.activeStates = new Map();   // containerId -> active tab info
        }

        // Hash routing state
        this.routeMap = new Map();

        // Process hash before initialization
        this.processHashBeforeInit();

        this.init();

        // Clean up any focusable elements in hidden panels after initialization
        this._cleanupHiddenPanels();
    }

    /**
     * Clean up focusable elements in hidden panels (fixes Lighthouse accessibility issue)
     * Nesting-aware: Only disables elements that don't belong to active nested tabs
     */
    _cleanupHiddenPanels() {
        // Find all tab containers using cached query
        const containers = this.$$(this.config.rootSelector);

        containers.forEach(container => {
            // Find hidden panels within this specific container
            const hiddenPanels = this.findAll(':scope > div[data-content] > [data-tab][aria-hidden="true"]', container);

            hiddenPanels.forEach(panel => {
                // Find focusable elements, but exclude those in nested active tab containers
                const focusableElements = this.findAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', panel);

                focusableElements.forEach(element => {
                    // Check if this element belongs to an active nested tab container
                    const nestedContainer = element.closest(this.config.rootSelector);
                    const isInNestedActive = nestedContainer &&
                                           nestedContainer !== container &&
                                           this.find(':scope > div[data-content] > [data-tab]:not([aria-hidden="true"])', nestedContainer);

                    // Only disable if not part of an active nested tab structure
                    if (!isInNestedActive) {
                        element.setAttribute('tabindex', '-1');
                    }
                });
            });
        });
    }

    /**
     * Centralized ARIA state management for container and its nested components
     */
    _updateAriaStates(container) {
        // Find all tab containers within this container (including itself)
        const allContainers = [container, ...this.findAll('[data-yai-tabs]', container)];

        allContainers.forEach(tabContainer => {
            // Get the active panel in this container
            const activePanel = this.find(':scope > div[data-content] > [data-tab].active', tabContainer);
            const allPanels = this.findAll(':scope > div[data-content] > [data-tab]', tabContainer);
            const allButtons = this.findAll(':scope > nav[data-controller] [data-open]', tabContainer);

            // Update panels
            allPanels.forEach(panel => {
                const isActive = panel === activePanel;
                const isParentVisible = this._isElementVisible(panel.closest('[data-tab]') || document.body);

                if (isActive && isParentVisible) {
                    // Active panel in visible container
                    panel.removeAttribute('aria-hidden');
                    panel.setAttribute('tabindex', '0');
                } else {
                    // Inactive panel or parent container is hidden
                    panel.setAttribute('aria-hidden', 'true');
                    panel.setAttribute('tabindex', '-1');
                }
            });

            // Check if any button in this container is active (more efficient approach)
            const activeButton = this.find(':scope > nav[data-controller] button.active', tabContainer);
            const hasActiveButton = !!activeButton;

            // Update buttons
            allButtons.forEach((button, index) => {
                const isActive = button.classList.contains('active');
                const isParentVisible = this._isElementVisible(button.closest('[data-tab]') || document.body);

                if (isParentVisible) {
                    // Button in visible container
                    button.removeAttribute('aria-hidden');
                    // For TAB navigation: active button gets tabindex="0",
                    // or first button if no active button exists
                    const shouldBeFocusable = isActive || (!hasActiveButton && index === 0);
                    button.setAttribute('tabindex', shouldBeFocusable ? '0' : '-1');
                } else {
                    // Button in hidden container
                    button.setAttribute('aria-hidden', 'true');
                    button.setAttribute('tabindex', '-1');
                }
            });
        });
    }

    /**
     * Check if an element is visible (not in a hidden parent)
     */
    _isElementVisible(element) {
        if (!element || element === document.body) return true;

        // Check if this element or any parent has aria-hidden="true"
        let current = element;
        while (current && current !== document.body) {
            if (current.getAttribute('aria-hidden') === 'true') {
                return false;
            }
            current = current.parentElement;
        }
        return true;
    }

    /**
     * Safe focus management - removes focus from hidden elements
     */
    _manageFocusForHiddenElements(container) {
        const hiddenElements = this.findAll('[aria-hidden="true"]', container);

        hiddenElements.forEach(hidden => {
            if (hidden.contains(document.activeElement)) {
                // Move focus to nearest visible tab button
                const visibleTabButton = this.find(':scope > nav[data-controller] button:not([aria-hidden])',
                    container.closest('[data-yai-tabs]'));

                if (visibleTabButton) {
                    visibleTabButton.focus();
                } else {
                    document.activeElement.blur();
                }
            }
        });
    }

    /**
     * Initialize a nested container that was dynamically loaded
     */
    _initializeNestedContainer(container) {
        // // Basic setup for nested container
        // const nestingLevel = this._calculateNestingLevel(container);

        // Set nesting level
        container.setAttribute('data-nesting', this._calculateNestingLevel(container).toString());

        // Apply default behavior if not set
        if (!container.hasAttribute('data-behavior') && this.config.defaultBehavior) {
            container.setAttribute('data-behavior', this.config.defaultBehavior);
        }

        // Setup accessibility for the nested container
        YaiTabs._setupContainerAccessibility(container);

        // Only open default tab if explicitly specified with data-default attribute
        const defaultButton = this.find(':scope > nav[data-controller] [data-default]', container);
        if (defaultButton) {
            this.openTab(defaultButton, null, container);
        }
        // Do not auto-open first tab for dynamically loaded content
    }

    /**
     * Process hash before initialization to override data-default attributes
     */
    processHashBeforeInit() {
        const hashParams = this.parseHash();

        for (const [refPath, tabId] of Object.entries(hashParams)) {
            const container = this.$(`[data-yai-tabs][data-ref-path="${refPath}"]`);
            if (!container) continue;

            // Remove existing data-default
            const currentDefault = this.find('[data-default]', container);
            if (currentDefault) {
                currentDefault.removeAttribute('data-default');
            }

            // Set hash target as new default
            const hashTarget = this.find(`[data-open="${tabId}"]`, container);
            if (hashTarget) {
                hashTarget.setAttribute('data-default', '');
                this.routeMap.set(refPath, tabId);
            }
        }
    }

    /**
     * Handle hash change events
     */
    handleHashchange() {
        const hashParams = this.parseHash();

        // Sync tabs to hash state
        for (const [refPath, tabId] of Object.entries(hashParams)) {
            const tabContainer = this.$(`[data-yai-tabs][data-ref-path="${refPath}"]`);
            if (!tabContainer) continue;

            const targetTab = this.find(`[data-open="${tabId}"]`, tabContainer);
            const currentActive = this.find('.active[data-open]', tabContainer);

            // Only change if different from current active
            if (targetTab && (!currentActive || currentActive.dataset.open !== tabId)) {
                this.openTab(targetTab, null, tabContainer);
            }

            this.routeMap.set(refPath, tabId);
        }
    }

    /**
     * Click handler for tab-specific actions
     * YpsilonEventHandler automatically filters by actionableAttributes config
     */
    handleClick(event, target, container) {
        const action = target.dataset.tabAction;

        if (action) {
            // Try direct method first
            if (typeof this[action] === 'function') {
                return this[action](target, event, container);
            }

            // If handler not found, try resolving aliases
            const aliasHandler = this.resolveAlias(action, event.type);
            if (aliasHandler && typeof this[aliasHandler] === 'function') {
                return this[aliasHandler](target, event, container);
            }
        }
    }

    /**
     * Override YaiBase keydown handler for tab-specific keyboard navigation
     * YpsilonEventHandler will call this via method resolution
     */
    handleKeydown(event, target, container) {
        // Only handle specific keys
        if (!['Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
            return;
        }

        // Handle ESC key to go up component levels
        if (event.key === 'Escape') {
            event.preventDefault();

            // Find parent tab container
            const parentTabContainer = container.closest('[data-tab]');
            if (parentTabContainer) {
                const parentContainer = parentTabContainer.closest('[data-yai-tabs]');
                if (parentContainer) {
                    // Focus the active button in parent container
                    const parentActiveButton = this.find(':scope > nav[data-controller] button.active', parentContainer);
                    if (parentActiveButton) {
                        parentActiveButton.focus();
                        return;
                    }
                }
            }

            // If no parent, blur current focus (escape to document)
            target.blur();
            return;
        }

        // Only handle arrow keys on tab buttons
        if (!target.dataset.open) {
            return;
        }

        event.preventDefault();

        const buttons = Array.from(this.findAll(':scope > nav[data-controller] [data-open]', container));
        const currentIndex = buttons.indexOf(target);

        // Get orientation from tablist
        const nav = this.find(':scope > nav[data-controller]', container);
        const orientation = nav?.getAttribute('aria-orientation') || 'horizontal';

        let nextIndex;
        switch (event.key) {
            case 'ArrowLeft':  if (orientation === 'horizontal') nextIndex = currentIndex > 0 ? currentIndex - 1 : buttons.length - 1; break;
            case 'ArrowRight': if (orientation === 'horizontal') nextIndex = currentIndex < buttons.length - 1 ? currentIndex + 1 : 0; break;
            case 'ArrowUp':    if (orientation === 'vertical')   nextIndex = currentIndex > 0 ? currentIndex - 1 : buttons.length - 1; break;
            case 'ArrowDown':  if (orientation === 'vertical')   nextIndex = currentIndex < buttons.length - 1 ? currentIndex + 1 : 0; break;
            case 'Home':       nextIndex = 0; break;
            case 'End':        nextIndex = buttons.length - 1; break;
        }

        if (nextIndex !== undefined && buttons[nextIndex]) {
            // Automatically activate the tab (following ARIA practices)
            if (container.classList.contains('tab-active')) {
                this.openTab(buttons[nextIndex], event, container);
            }
            buttons[nextIndex].focus();
        }
    }

    init() {
        // Unified initialization: discover, analyze, and initialize all containers at once
        this.initializeAllContainers();
    }

    /**
     * Unified container initialization system
     * Single DOM scan, complete setup, internal state building
     */
    initializeAllContainers(rootElement = document) {
        // Single DOM scan for all containers using cached query
        const containers = Array.from(this.findAll(this.config.rootSelector, rootElement, { refresh: true }));
        if (!containers.length) return;

        // Build complete initialization data in one pass
        const initData = containers.map((container, index) => {
            const containerId = container.id || YaiTabs.generateId('yai-tabs-container');
            if (!container.id) container.id = containerId;

            return {
                container,
                containerId,
                index,
                nestingLevel: this._calculateNestingLevel(container),
                navElement: this.find(':scope > nav[data-controller]', container),
                buttons: Array.from(this.findAll(':scope > nav[data-controller] [data-open]', container)),
                panels: Array.from(this.findAll(':scope > div[data-content] [data-tab]', container)),
                defaultButton: this.find(':scope > nav[data-controller] [data-default]', container),
                isVisible: this._isContainerVisible(container)
            };
        });

        // Process all containers with complete context
        initData.forEach(data => this._processContainer(data));

        // Build navigation tree after all containers are processed (only if enabled)
        if (this.config.enableNavigationTree) {
            this._buildNavigationTree(initData);
        }
    }

    /**
     * Process individual container with complete context
     */
    _processContainer(data) {
        const { container, containerId, index, buttons, defaultButton, isVisible } = data;

        // Set nesting level
        container.setAttribute('data-nesting', data.nestingLevel.toString());

        // Apply default behavior
        if (!container.hasAttribute('data-behavior') && this.config.defaultBehavior) {
            container.setAttribute('data-behavior', this.config.defaultBehavior);
        }

        // Setup complete ARIA accessibility
        if (this.config.autoAccessibility) {
            this._setupCompleteAccessibility(data);
        }

        // Initialize default tab if visible
        if (defaultButton && defaultButton.dataset.open && isVisible) {
            this.openTab(defaultButton, null, container, true);

            // Set initial focus on the first visible container's active tab
            if (this.config.autoFocus && index === 0) {
                defaultButton.focus();
            }
        }

        // Store active state (only if navigation tree is enabled)
        if (this.config.enableNavigationTree) {
            this.activeStates.set(containerId, {
                activeTabId: defaultButton?.dataset.open || null,
                buttons: buttons.map(btn => ({ id: btn.dataset.open, element: btn, text: btn.textContent })),
                isVisible
            });
        }
    }

    /**
     * Complete ARIA setup for TABS using pre-calculated data
     */
    _setupCompleteAccessibility(data) {
        const { navElement, buttons, panels } = data;
        const containerPrefix = YaiTabs.generateId('yai-tabs');

        // Setup nav element
        if (navElement) {
            navElement.setAttribute('role', 'tablist');

            if (!navElement.hasAttribute('aria-label') && !navElement.hasAttribute('aria-labelledby')) {
                navElement.setAttribute('aria-label', 'Tab navigation');
            }

            // Set orientation based on actual computed CSS layout
            const computedStyle = window.getComputedStyle(navElement);
            const flexDirection = computedStyle.flexDirection;
            const isVertical = flexDirection === 'column' || flexDirection === 'column-reverse';
            navElement.setAttribute('aria-orientation', isVertical ? 'vertical' : 'horizontal');
        }

        // Setup buttons
        buttons.forEach((button, index) => {
            const tabId = button.dataset.open;
            if (button.id) button.setAttribute('data-original-id', button.id);

            button.id = `${containerPrefix}-tab-${tabId}`;
            button.setAttribute('role', 'tab');
            button.setAttribute('aria-selected', 'false');
            button.setAttribute('aria-controls', `${containerPrefix}-panel-${tabId}`);
            button.setAttribute('tabindex', index === 0 ? '0' : '-1');
        });

        // Setup panels
        panels.forEach(panel => {
            const tabId = panel.dataset.tab;
            if (panel.id) panel.setAttribute('data-original-id', panel.id);

            panel.id = `${containerPrefix}-panel-${tabId}`;
            panel.setAttribute('role', 'tabpanel');
            panel.setAttribute('aria-labelledby', `${containerPrefix}-tab-${tabId}`);
            panel.setAttribute('aria-hidden', 'true');
            panel.setAttribute('tabindex', '-1');
        });
    }

    /**
     * Build internal navigation tree for state management
     */
    _buildNavigationTree(allContainers) {
        allContainers.forEach(data => {
            const { containerId, container, nestingLevel, buttons } = data;

            // Find parent container
            const parentContainer = container.closest('[data-tab]')?.closest('[data-yai-tabs]');
            const parentId = parentContainer?.id;

            const treeNode = {
                id: containerId,
                element: container,
                level: nestingLevel,
                parentId,
                children: [],
                tabs: buttons.map(btn => ({
                    id: btn.dataset.open,
                    element: btn,
                    label: btn.textContent.trim(),
                    isDefault: btn.hasAttribute('data-default')
                })),
                path: this._generatePath(container)
            };

            this.navigationTree.set(containerId, treeNode);

            // Link to parent
            if (parentId && this.navigationTree.has(parentId)) {
                this.navigationTree.get(parentId).children.push(containerId);
            }
        });
    }

    /**
     * Generate breadcrumb path for container
     */
    _generatePath(container) {
        const path = [];
        let current = container;

        while (current) {
            const tabPanel = current.closest('[data-tab]');
            if (tabPanel) {
                const parentContainer = tabPanel.closest('[data-yai-tabs]');
                if (parentContainer) {
                    const activeButton = this.find('button.active[data-open]', parentContainer);
                    if (activeButton) {
                        path.unshift({
                            containerId: parentContainer.id,
                            tabId: activeButton.dataset.open,
                            label: activeButton.textContent.trim()
                        });
                    }
                }
                current = parentContainer?.parentElement;
            } else {
                break;
            }
        }

        return path;
    }

    /**
     * Update active state when tabs change
     */
    _updateActiveState(container, newActiveTabId) {
        if (!this.config.enableNavigationTree) return;

        const containerId = container.id;
        const currentState = this.activeStates.get(containerId);

        if (currentState) {
            // Update the active tab ID
            currentState.activeTabId = newActiveTabId;

            // Update visibility if needed
            currentState.isVisible = this._isContainerVisible(container);

            // Update the tree node path
            const treeNode = this.navigationTree.get(containerId);
            if (treeNode) {
                treeNode.path = this._generatePath(container);
            }
        }
    }

    /**
     * Attribute/Alias handlers, can be used with both.
     */
    closeTab(target, _event, container) {
        if (!this.config.closable) return;
        this._removeActive(target, container);

        // Update hash routing after closing
        const refPath = container.dataset.refPath;
        if (refPath) {
            // Check if any tab is still active after close
            const stillActive = this.find(':scope > nav[data-controller] button.active[data-open]', container);

            if (stillActive) {
                // Update to the still-active tab
                this.routeMap.set(refPath, stillActive.dataset.open);
                this.updateHash(container);
            } else {
                // No active tab left, remove from hash AND clean up nested entries
                this.routeMap.delete(refPath);
                this._cleanupNestedHashEntries(container);
                this.updateHash(container);
            }
        }
    }

    /**
     * Clean up hash entries for nested tab containers when parent closes
     * @param {Element} parentContainer - The parent container that's being closed
     */
    _cleanupNestedHashEntries(parentContainer) {
        // Find all nested tab containers within this parent
        const nestedContainers = this.findAll(`${this.config.rootSelector}[data-ref-path]`, parentContainer);

        nestedContainers.forEach(nestedContainer => {
            const nestedRefPath = nestedContainer.dataset.refPath;
            if (nestedRefPath && this.routeMap.has(nestedRefPath)) {
                // Remove nested container's hash entry
                this.routeMap.delete(nestedRefPath);

                // Recursively clean up any deeper nested containers
                this._cleanupNestedHashEntries(nestedContainer);
            }
        });
    }

    /**
     * Set class to targeted element
     */
    _markRootContainer(element, add = true, marker = null) {
        const fn = add ? 'add' : 'remove';
        element.classList[fn](marker || 'tab-active');
    }

    openTab(target, event, container, isDefaultInitialization = false) {
        if (target.classList.contains('active')) {
            if (this.config.closable) {
                this.closeTab(target, event, container);
            }
            return;
        }

        // Set processing state
        this._setProcessingState(container, true);

        this._preserveContentHeight(container);

        const tabId = target.dataset.open;
        const content = this.find(`:scope > div[data-content] > [data-tab="${tabId}"]`, container);

        if (content) {
            this._removeActive(target, container);

            // Update button states
            this.findAll(':scope > nav[data-controller] [data-open]', container).forEach(btn => {
                btn.setAttribute('aria-selected', 'false');
                btn.setAttribute('tabindex', '-1');
            });

            target.setAttribute('aria-selected', 'true');
            target.setAttribute('tabindex', '0'); // Active button is focusable
            target.classList.add('active');
            content.classList.add('active');
            content.removeAttribute('aria-hidden'); // Make visible to screen readers
            content.setAttribute('tabindex', '0'); // Restore tab navigation

            // Update ARIA states for all nested components now that parent is visible
            this._updateAriaStates(container);

            // Initialize nested default tabs now that this content is visible
            this._initializeNestedDefaults(content);

            // Optional: Move focus to panel for screen readers (only on Enter/Space, NOT arrow keys)
            if (event && (event.key === 'Enter' || event.key === ' ')) {
                content.focus();
            }

            this._markRootContainer(container, true);

            // Update active state tracking
            this._updateActiveState(container, tabId);

            // Clear processing state after animation completes
            setTimeout(() => {
                this._setProcessingState(container, false);
            }, 150); // Match animation duration

            // Load dynamic content if data-url is specified
            if (target.dataset.url) {
                const append = target.dataset.append === 'true';
                this._loadContent(target.dataset.url, `:scope > div[data-content] > [data-tab="${tabId}"]`, container, append, target);
            } else {
                this._resetContentHeight(container);
            }

            // Emit tabs-specific event
            this.yaiEmit('tabOpened', {
                id: tabId,
                container,
                target,
                content
            });

            // Update hash routing if container has ref-path (skip for default initialization)
            const refPath = container.dataset.refPath;
            if (refPath && !isDefaultInitialization) {
                this.routeMap.set(refPath, tabId);
                this.updateHash(container);
            }
        }
    }

    /**
     * Active tabs are marked with a configurable css class.
     * This method removes all relevant `.active` classes in a container.
     */
    _removeActive(target, container, selectors = ['[data-open]', '[data-tab]']) {
        const selectorButton = [ selectors[0] || '[data-open]', selectors[1] || '[data-tab]' ]

        // Use :scope to target direct children within THIS container's elements
        const elements = [
            this.find(`:scope > nav[data-controller] > button.active${selectorButton[0]}`, container),
            this.find(`:scope > div[data-content] > .active${selectorButton[1]}`, container),
        ];




        elements.forEach((el, index) => {
            if (!el) return;

            // For closing tabs, trigger exit animation first
            const isClosing = target.classList.contains('active');

            if (isClosing) {
                // Add exit class to trigger reverse animation
                el.classList.add('exiting');

                // Remove tab-active class
                this._markRootContainer(container, false);

                // Remove active and exit classes after animation completes
                setTimeout(() => {
                    el.classList.remove('active', 'exiting');
                    // Handle focus and ARIA after visual state changes complete
                    this._manageFocusForHiddenElements(container);
                    this._updateAriaStates(container);
                }, 100);
            } else {
                // Normal tab switching - immediate removal
                el.classList.remove('active');

                // Handle focus and ARIA after visual state changes
                this._manageFocusForHiddenElements(container);
                this._updateAriaStates(container);
            }

            // Only remove container marker for normal tab switching (not closing)
            if (!isClosing) {
                this._markRootContainer(container, false);
            }
            YaiTabs._clearInteractiveState(el, isClosing);

            if (elements.length === index+1) {
                const id = el.dataset.tab || el.dataset.open;
                // Emit tabs-specific event
                this.yaiEmit('tabClosed', { id, container });
            }
        });
    }

    /**
     * Check if a container is visible (either root level or parent is active)
     */
    _isContainerVisible(container) {
        // Find the parent tab panel this container is nested in
        const parentTabPanel = container.closest('[data-tab]');
        if (!parentTabPanel) return true; // Root level, always visible

        // Check if parent panel is active
        return parentTabPanel.classList.contains('active');
    }

    /**
     * Initialize nested default tabs when their parent becomes active
     */
    _initializeNestedDefaults(content) {
        // Find all nested tab containers in the content
        const nestedContainers = this.findAll('[data-yai-tabs]', content);
        nestedContainers.forEach(container => {
            // Look for default button in this container
            const defaultButton = this.find(':scope > nav[data-controller] [data-default]', container);
            if (defaultButton && defaultButton.dataset.open) {
                // Check if this container doesn't already have an active tab
                const hasActiveTab = this.find(`:scope > nav[data-controller] button.active`, container);
                if (!hasActiveTab) {
                    this.openTab(defaultButton, null, container, true);
                }
            }
        });
    }

    /**
     * Override YaiBase post-processing to initialize nested tab components
     * Uses unified initialization system for consistent setup
     */
    _postProcessContent(content, url) {
        // Call parent method for basic post-processing
        super._postProcessContent(content, url);

        // Use unified initialization for any dynamically loaded containers
        this.initializeAllContainers(content);
    }

    static _setupContainerAccessibility(container) {
        // Generate unique prefix for this container to avoid ID collisions
        const containerPrefix = YaiTabs.generateId('yai-tabs');

        // Find the nav element and set tablist role on it (correct ARIA pattern)
        const nav = container.querySelector(':scope > nav[data-controller]');
        if (nav) {
            nav.setAttribute('role', 'tablist');

            // Add aria-label if not already present
            if (!nav.hasAttribute('aria-label') && !nav.hasAttribute('aria-labelledby')) {
                nav.setAttribute('aria-label', 'Tab navigation');
            }

            // Set orientation based on actual computed CSS layout
            const computedStyle = window.getComputedStyle(nav);
            const flexDirection = computedStyle.flexDirection;
            const isVertical = flexDirection === 'column' || flexDirection === 'column-reverse';
            nav.setAttribute('aria-orientation', isVertical ? 'vertical' : 'horizontal');
        }

        // Setup buttons with forced safe IDs
        const buttons = container.querySelectorAll(':scope > nav[data-controller] [data-open]');
        buttons.forEach((button, index) => {
            if (button.id) button.setAttribute('data-original-id', button.id);

            const tabId = button.dataset.open;

            // Always set our controlled ID
            button.id = `${containerPrefix}-tab-${tabId}`;
            button.setAttribute('role', 'tab');
            button.setAttribute('aria-selected', 'false');
            button.setAttribute('aria-controls', `${containerPrefix}-panel-${tabId}`);
            button.setAttribute('tabindex', index === 0 ? '0' : '-1'); // First tab is focusable by default
        });

        // Setup panels with forced safe IDs
        const panels = container.querySelectorAll(':scope > div[data-content] [data-tab]');
        panels.forEach(panel => {
            if (panel.id) panel.setAttribute('data-original-id', panel.id);

            const tabId = panel.dataset.tab;

            panel.id = `${containerPrefix}-panel-${tabId}`;
            panel.setAttribute('role', 'tabpanel');
            panel.setAttribute('aria-labelledby', `${containerPrefix}-tab-${tabId}`);
            panel.setAttribute('aria-hidden', 'true'); // All panels start hidden from screen readers
            panel.setAttribute('tabindex', '-1'); // Not focusable when hidden
        });
    }

    static _clearInteractiveState(element, isClosing = false) {
        // Only clear dynamic states, keep ARIA roles and relationships intact
        if (element.matches('[data-open]')) {
            // Tab button - only clear interactive state
            element.setAttribute('aria-selected', 'false');

            // For closing tabs, keep them focusable to maintain roving tabindex
            if (isClosing) {
                element.setAttribute('tabindex', '0'); // Closed tab remains focusable
                element.classList.remove('active');
            } else {
                element.setAttribute('tabindex', '-1');
            }
            // role="tab" and aria-controls REMAIN intact
        }

        if (element.matches('[data-tab]')) {
            // Tab panel - only clear interactive state
            element.setAttribute('aria-hidden', 'true');
            element.setAttribute('tabindex', '-1');
            // role="tabpanel" and aria-labelledby REMAIN intact
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { YaiTabs };
    module.exports.default = YaiTabs;
} else if (typeof window !== 'undefined') {
    window['YaiTabs'] = YaiTabs;
}
