"use strict";

/**
 * YaiBase - Foundation class for all Yai components
 * Provides shared utilities, event handler factory, and common patterns
 *
 * @method debounce           this.events.debounce
 * @method throttle           this.events.throttle
 * @method resolveMethodName  this.events.resolveMethodName
 */
class YaiBase {
    constructor(customConfig = {}) {
        /**
         * Shared configuration with sensible defaults
         */
        const baseConfig = this.getDefaultConfig();

        // Merge base emitable events with any custom emitable events
        if (customConfig.emitable) {
            customConfig.emitable = { ...YaiBase.getBaseEmitableEvents(), ...customConfig.emitable };
        } else {
            // Ensure base config gets base events if no custom emitable provided
            baseConfig.emitable = YaiBase.getBaseEmitableEvents();
        }

        this.config = this.deepMerge(baseConfig, customConfig);

        /**
         * Shared state management
         */
        this.isProcessing = false;
        this.processingContainers = new Set();

        /**
         * Fetch abort controllers for dynamic content loading
         */
        this._fetchControllers = new Map();

        /**
         * High-performance DOM element cache - direct implementation
         */
        this._domCache = new Map();
        this._cacheStats = {
            hits: 0,
            misses: 0,
            totalQueries: 0
        };

        /**
         * Event handler will be created by factory method
         */
        this.events = null;
    }

    /**
     * Default configuration shared across all Yai components
     */
    getDefaultConfig() {
        return {
            // Dynamic content
            dynamicContent: true,
            errorPlaceholder: 'Failed to load content',

            // Accessibility
            autoAccessibility: true,

            // Common selectors (can be overridden)
            selectors: {
                active: 'active',
            },

            // Event system defaults
            events: {
                autoTargetResolution: true,
                enableDistanceCache: false,
                actionableAttributes: ['data-action'],
                actionableTags: ['button'],
            },

            // Dispatch
            dispatchName: 'yai.component',

            // Standardized emitable events base
            emitable: {
                // Lifecycle events
                beforeInit: 'beforeInit',
                afterInit: 'afterInit',
                beforeDestroy: 'beforeDestroy',
                afterDestroy: 'afterDestroy',

                // State events
                processingStart: 'processingStart',
                processingEnd: 'processingEnd',
                stateChange: 'stateChange',

                // Content events
                contentLoaded: 'contentLoaded',
                contentError: 'contentError',

                // User interaction events
                change: 'change',
                open: 'open',
                close: 'close',

                // System events
                error: 'error',
                notification: 'notification',
                alert: 'alert',
            },
        };
    }

    /**
     * Factory method to create YpsilonEventHandler with component-specific config
     * @param {Object} selectors - Event listener selectors
     * @param {Object} aliases - Event method aliases
     * @param {Object} options - Additional event handler options
     * @returns {YpsilonEventHandler} Configured event handler instance
     */
    createEventHandler(selectors, aliases, options = {}) {
        const eventOptions = this.deepMerge(this.config.events, options);

        // Create methods object with component methods
        const methods = {
            click:      { handleClick: (...args)      => this.handleClick(...args) },
            keydown:    { handleKeydown: (...args)    => this.handleKeydown(...args) },
            hashchange: { handleHashchange: (...args) => this.handleHashchange(...args) },
        };

        // Merge with any additional methods from options
        if (options.methods) {
            this.deepMerge(methods, options.methods);
        }

        const finalOptions = {
            ...eventOptions,
            ...options,
            methods: methods,
            enableHandlerValidation: true
        };

        this.events = new YpsilonEventHandler(selectors, aliases, finalOptions);
        return this.events;
    }

    /**
     * Deep merge utility for configuration objects
     */
    deepMerge(target, source) {
        return YaiBase.deepMerge(target, source);
    }

    /**
     * Static deep merge utility for configuration objects
     */
    static deepMerge(target, source) {
        for (const key in source) {
            if (source[key] instanceof Object && !Array.isArray(source[key])) {
                target[key] = YaiBase.deepMerge(target[key] || {}, source[key]);
            } else {
                target[key] = source[key];
            }
        }
        return target;
    }

    /**
     * Generate unique IDs for components
     */
    static generateId(prefix = 'yai') {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    }

    /**
     * Static base emitable events - consistent across all Yai components
     * These are non-overridable core events that every component should have
     */
    static getBaseEmitableEvents() {
        return {
            // Lifecycle events
            beforeInit: 'beforeInit',
            afterInit: 'afterInit',
            beforeDestroy: 'beforeDestroy',
            afterDestroy: 'afterDestroy',

            // State events
            processingStart: 'processingStart',
            processingEnd: 'processingEnd',
            stateChange: 'stateChange',

            // Content events
            contentLoaded: 'contentLoaded',
            contentError: 'contentError',

            // User interaction events
            change: 'change',
            open: 'open',
            close: 'close',

            // System events
            error: 'error',
            notification: 'notification',
            alert: 'alert',
        };
    }

    /**
     * Get element(s) with caching
     * @param {string} selector - CSS selector
     * @param {Object} options - Query options
     * @param {boolean} options.multiple - Return all matches (querySelectorAll)
     * @param {boolean} options.refresh - Force fresh DOM query
     * @param {Element|Document} options.scope - Query scope (default: document)
     * @returns {Element|NodeList|null}
     */
    _getCached(selector, options = {}) {
        this._cacheStats.totalQueries++;

        const {
            multiple = false,
            refresh = false,
            scope = document
        } = options;

        // Skip caching for :scope selectors or any scoped queries (not document-level)
        if (selector.includes(':scope') || scope !== document || refresh) {
            this._cacheStats.misses++;
            const method = multiple ? 'querySelectorAll' : 'querySelector';
            return scope[method](selector);
        }

        // Create cache key for non-scope selectors
        const scopeId = scope === document ? 'doc' : (scope.id || 'scope');
        const cacheKey = `${selector}:${multiple ? 'all' : 'one'}:${scopeId}`;

        // Return cached value if available
        if (this._domCache.has(cacheKey)) {
            const cached = this._domCache.get(cacheKey);
            // Validate cached value - ensure elements are still in DOM
            if (this._validateCached(cached, multiple)) {
                this._cacheStats.hits++;
                return cached;
            } else {
                // Remove invalid cache entry
                this._domCache.delete(cacheKey);
            }
        }

        // Query the DOM if not in cache
        this._cacheStats.misses++;
        const method = multiple ? 'querySelectorAll' : 'querySelector';
        const elements = scope[method](selector);

        // Only cache if we found something and it's not a scope selector
        if (elements && (multiple ? elements.length > 0 : elements.nodeType)) {
            this._domCache.set(cacheKey, elements);
        }

        return elements;
    }

    /**
     * Validate cached elements are still in DOM
     */
    _validateCached(cached, multiple) {
        if (!cached) return false;

        if (multiple) {
            // For NodeList, check if at least one element is still in DOM
            return cached.length > 0 && Array.from(cached).some(el => el.isConnected);
        } else {
            // For single element, check if it's still connected
            return cached.nodeType && cached.isConnected;
        }
    }

    /**
     * Cached DOM queries - performance optimized alternatives to querySelector
     */
    $(selector, options = {}) {
        return this._getCached(selector, { ...options, multiple: false });
    }

    $$(selector, options = {}) {
        return this._getCached(selector, { ...options, multiple: true });
    }

    /**
     * Get elements within a specific container scope
     */
    find(selector, container = document, options = {}) {
        return this._getCached(selector, { ...options, scope: container, multiple: false });
    }

    findAll(selector, container = document, options = {}) {
        return this._getCached(selector, { ...options, scope: container, multiple: true });
    }

    /**
     * Refresh cache for specific selectors or entire cache
     */
    refreshCache(selector = null) {
        if (selector) {
            // Remove all cache entries for this selector
            for (const key of this._domCache.keys()) {
                if (key.startsWith(selector + ':')) {
                    this._domCache.delete(key);
                }
            }
        } else {
            this._domCache.clear();
            this._cacheStats = { hits: 0, misses: 0, totalQueries: 0 };
        }
        return this;
    }

    /**
     * Get cache performance statistics
     */
    getCacheStats() {
        const hitRate = this._cacheStats.totalQueries > 0
            ? (this._cacheStats.hits / this._cacheStats.totalQueries * 100).toFixed(2)
            : 0;

        return {
            ...this._cacheStats,
            hitRate: `${hitRate}%`,
            cacheSize: this._domCache.size
        };
    }

    /**
     * Resolve template selectors with replacements
     */
    resolveSelector(selector, replacements = {}) {
        if (typeof selector !== 'string') throw new TypeError('Selector must be a string');

        let resolved = selector;
        for (const [key, value] of Object.entries(replacements)) {
            resolved = resolved.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
        }

        return resolved;
    }

    /**
     * Resolve alias to method name using YpsilonEventHandler's built-in resolver
     */
    resolveAlias(alias, eventType) {
        return this.events ? this.events.resolveMethodName(alias, eventType) : null;
    }

    /**
     * Event dispatch utility (legacy)
     */
    dispatch(eventName, data, target) {
        if (this.events) {
            this.events.dispatch(eventName, data, target || document);
        }
    }

    /**
     * Standardized event emission with namespacing
     * @param {string} eventName - Event name from this.config.emitable
     * @param {Object} details - Event details/data
     * @param {Element} target - Event target (default: document)
     */
    yaiEmit(eventName, details = {}, target = document) {
        // Get the standardized event name
        const standardEventName = this.config.emitable[eventName];
        if (!standardEventName) {
            console.warn(`YaiBase: Unknown emitable event '${eventName}'. Available events:`, Object.keys(this.config.emitable));
            return;
        }
        // Dispatch with YpsilonEventHandler
        if (this.events) {
            // Create namespaced event name
            const namespacedEvent = `${this.config.dispatchName}.${standardEventName}`;

            this.events.dispatch(namespacedEvent, details, target);
        }
    }

    /**
     * Set nesting level attribute on container
     */
    _setNestingLevel(container, rootSelector = '[data-yai-tabs]') {
        let level = 0;
        let parent = container.parentElement;

        while (parent) {
            if (parent.matches(rootSelector)) {
                level++;
            }
            parent = parent.parentElement;
        }

        container.setAttribute('data-nesting', level.toString());
    }

    /**
     * Processing/Loading state management
     */
    _setProcessingState(container, isProcessing) {
        if (isProcessing) {
            container.classList.add('processing');
            container.style.overflow = 'hidden';
            this.processingContainers.add(container);
            this.isProcessing = true;
        } else {
            container.classList.remove('processing');
            container.style.overflow = '';
            this.processingContainers.delete(container);
            this.isProcessing = this.processingContainers.size > 0;
        }

        // Dispatch processing state change using standardized events
        this.yaiEmit(isProcessing ? 'processingStart' : 'processingEnd', {
            container: container,
            globalProcessing: this.isProcessing
        });
    }

    /**
     * Check if any containers are currently processing
     */
    isAnyProcessing() {
        return this.isProcessing;
    }

    /**
     * Check if specific container is processing
     */
    isContainerProcessing(container) {
        return this.processingContainers.has(container);
    }

    /**
     * Parse URL hash into object
     */
    parseHash() {
        const hash = window.location.hash.slice(1);
        if (!hash) return {};

        try {
            const params = new URLSearchParams(hash);
            return Object.fromEntries(params);
        } catch (e) {
            console.warn('YaiTabs: Failed to parse hash', hash);
            return {};
        }
    }

    /**
     * Update URL hash from routeMap (immediate)
     * @param {Element} container - Optional container to determine history mode
     * @param {boolean} forceReplace - Force replace state (for programmatic sync)
     */
    updateHash(container = null, forceReplace = false) {
        const params = new URLSearchParams();
        for (const [refPath, tabId] of this.routeMap) {
            if (tabId) params.set(refPath, tabId);
        }

        const newHash = params.toString();
        if (newHash !== window.location.hash.slice(1)) {
            // Check history mode preference - default to 'replace' for cleaner URL history
            const historyMode = container?.dataset.historyMode || 'replace';

            if ((historyMode === 'replace' || forceReplace) && history.replaceState) {
                if (newHash === '') {
                    // Clear hash completely to avoid page scroll
                    const cleanUrl = window.location.origin + window.location.pathname + window.location.search;
                    history.replaceState(null, '', cleanUrl);
                } else {
                    history.replaceState(null, '', '#' + newHash);
                }
            } else {
                // Default: push state (routable mini-app)
                if (newHash === '') {
                    // Clear hash completely to avoid page scroll
                    const cleanUrl = window.location.origin + window.location.pathname + window.location.search;
                    history.pushState(null, '', cleanUrl);
                } else {
                    window.location.hash = newHash;
                }
            }
        }
    }

    /**
     * Set minimum height on content area to prevent layout shifts
     * @param {Element} container - Container element
     * @param {string} selector - Content selector (default: '[data-content]')
     */
    _preserveContentHeight(container, selector='[data-content]') {
        const content = this.find(selector, container);
        if (content) {
            const currentHeight = content.offsetHeight;
            if (currentHeight > 0) {
                content.style.minHeight = currentHeight + 'px';
            }
        }
    }

    /**
     * Reset content height constraints and force recalculation
     * @param {Element} container - Container element  
     * @param {string} selector - Content selector (default: '[data-content]')
     */
    _resetContentHeight(container, selector='[data-content]') {
        const content = this.find(selector, container);
        if (content) {
            content.style.minHeight = '';
            content.style.height = '';
            content.offsetHeight;
        }
    }

    /**
     * Add loading state class to content element
     * @param {Element} container - Container element
     * @param {string} selector - Content selector (default: '[data-content]')
     */
    _setLoadingState(container, selector='[data-content]') {
        const content = this.find(selector, container);
        if (content) {
            content.classList.add('yai-loading');
        }
    }
    
    /**
     * Remove loading state class from content element  
     * @param {Element} container - Container element
     * @param {string} selector - Content selector (default: '[data-content]')
     */
    _removeLoadingState(container, selector='[data-content]') {
        const content = this.find(selector, container);
        if (content) {
            content.classList.remove('yai-loading');
        }
    }

    /**
     * Cancel any in-flight fetch request for a container
     */
    _cancelFetch(container) {
        const controller = this._fetchControllers.get(container);
        if (controller) {
            controller.abort();
            this._fetchControllers.delete(container);
        }
    }

    /**
     * Dynamic content loading via fetch
     */
    async _loadContent(url, targetSelector, container, append = false) {
        if (!this.config.dynamicContent) return;

        const content = this.find(targetSelector, container);
        if (!content) return;

        // Cancel any existing fetch for this container
        this._cancelFetch(container);

        // Create new AbortController for this request
        const controller = new AbortController();
        this._fetchControllers.set(container, controller);

        // Find the trigger element (tab button/link that has data-url)
        const triggerElement = this.find(`[data-url="${url}"]`, container);

        // Show loading state
        this._setLoadingState(container);

        // Set ARIA busy state for screen readers
        content.setAttribute('aria-busy', 'true');
        if (!content.hasAttribute('aria-live')) {
            content.setAttribute('aria-live', 'polite');
        }

        try {
            const response = await fetch(url, { signal: controller.signal });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const html = await response.text();

            if (append) {
                content.insertAdjacentHTML('beforeend', html);
            } else {
                content.innerHTML = html;

                // Remove load trigger attributes for DOM caching
                if (triggerElement && !triggerElement.hasAttribute('data-url-refresh')) {
                    triggerElement.removeAttribute('data-url');
                    triggerElement.removeAttribute('data-target');
                    triggerElement.removeAttribute('data-append');
                }
            }

            // Initialize any nested YaiTabs components in the loaded content
            this._initializeNestedComponents(content);

            // Reset content height after dynamic content settles
            this._resetContentHeight(container);
            // Remove loading state
            this._removeLoadingState(container);

            // Dispatch content loaded event using standardized events
            this.yaiEmit('contentLoaded', {
                url,
                targetSelector,
                container,
                append
            });

        } catch (error) {
            // Handle AbortError (request was cancelled)
            if (error.name === 'AbortError') {
                return; // Request was cancelled, don't show error
            }

            console.warn('Failed to load content:', error);
            content.innerHTML = this.config.errorPlaceholder;
            this._removeLoadingState(container);

            // Dispatch error event using standardized events
            this.yaiEmit('contentError', {
                url,
                targetSelector,
                container,
                error: error.message
            });
        } finally {
            // Clear ARIA busy state
            content.setAttribute('aria-busy', 'false');

            // Clean up fetch controller
            this._fetchControllers.delete(container);
        }
    }

    /**
     * Calculate nesting level more efficiently
     */
    _calculateNestingLevel(container) {
        let level = 0;
        let parent = container.parentElement;
        while (parent) {
            if (parent.matches(this.config.rootSelector)) level++;
            parent = parent.parentElement;
        }
        return level;
    }

    /**
     * Initialize nested components in dynamically loaded content
     */
    _initializeNestedComponents(content) {
        // Find any nested YaiTabs components that need initialization
        const nestedContainers = this.findAll('[data-yai-tabs]', content);

        nestedContainers.forEach(nestedContainer => {
            // Skip if already initialized (has event listeners attached)
            if (nestedContainer.hasAttribute('data-yai-initialized')) return;

            // Mark as initialized to prevent duplicate initialization
            nestedContainer.setAttribute('data-yai-initialized', 'true');

            // Dispatch event to initialize nested component (legacy dispatch for cross-component communication)
            this.dispatch('yai.tabs', {
                type: 'initializeNested',
                container: nestedContainer,
                parentContainer: content.closest('[data-yai-tabs]')
            });
        });
    }

    /**
     * Post-process loaded content (override in components)
     */
    _postProcessContent(content) {
        // Base implementation - set timestamps
        const loadTimeElements = this.findAll('#load-time, .load-time', content);
        loadTimeElements.forEach(el => {
            el.textContent = new Date().toLocaleTimeString();
        });
    }

    /**
     * Accessibility utilities
     */
    static _setupAccessibility(container, config = {}) {
        const {
            role = 'region',
            label = 'Interactive component',
            idPrefix = 'yai'
        } = config;

        if (!container.hasAttribute('role')) {
            container.setAttribute('role', role);
        }

        if (!container.hasAttribute('aria-label') && !container.hasAttribute('aria-labelledby')) {
            container.setAttribute('aria-label', label);
        }

        return YaiBase.generateId(idPrefix);
    }

    /**
     * Clear accessibility attributes
     */
    static _clearAccessibilityAttributes(element) {
        const attributes = [
            'role', 'aria-selected', 'aria-controls', 'aria-labelledby',
            'tabindex', 'aria-hidden', 'aria-expanded', 'aria-disabled'
        ];

        attributes.forEach(attr => element.removeAttribute(attr));
    }
}

// Universal module definition (UMD)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { YaiBase };
    module.exports.default = YaiBase;
} else if (typeof window !== 'undefined') {
    window['YaiBase'] = YaiBase;
}