const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

class FakeEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.bubbles = !!init.bubbles;
    this.target = null;
  }
}

class FakeClassList {
  constructor(element) {
    this.element = element;
  }

  _set() {
    if (!this.element._classes) {
      this.element._classes = new Set();
    }
    return this.element._classes;
  }

  add(...tokens) {
    const set = this._set();
    tokens.forEach(t => { if (t) set.add(t); });
  }

  remove(...tokens) {
    const set = this._set();
    tokens.forEach(t => set.delete(t));
  }

  toggle(token) {
    const set = this._set();
    if (set.has(token)) {
      set.delete(token);
      return false;
    }
    set.add(token);
    return true;
  }

  contains(token) {
    const set = this._set();
    return set.has(token);
  }

  toString() {
    const set = this._set();
    return Array.from(set).join(' ');
  }
}

class FakeElement {
  constructor(tagName, ownerDocument) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.parentElement = null;
    this._id = '';
    this._classes = new Set();
    this._attributes = new Map();
    this._text = '';
    this.value = '';
    this.onclick = null;
    this.eventHandlers = new Map();
  }

  get classList() {
    return new FakeClassList(this);
  }

  set className(value) {
    this._classes = new Set((value || '').split(/\s+/).filter(Boolean));
  }

  get className() {
    return Array.from(this._classes).join(' ');
  }

  set id(value) {
    if (this._id) {
      this.ownerDocument.unregisterId(this._id);
    }
    this._id = value;
    if (value) {
      this.ownerDocument.registerId(value, this);
    }
  }

  get id() {
    return this._id;
  }

  setAttribute(name, value) {
    if (name === 'id') {
      this.id = value;
      return;
    }
    if (name === 'class') {
      this.className = value;
      return;
    }
    this._attributes.set(name, value);
  }

  getAttribute(name) {
    if (name === 'id') return this.id;
    if (name === 'class') return this.className;
    return this._attributes.get(name);
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx >= 0) {
      this.children.splice(idx, 1);
      child.parentElement = null;
    }
    return child;
  }

  remove() {
    if (this.parentElement) {
      this.parentElement.removeChild(this);
    }
  }

  set textContent(value) {
    this._text = String(value);
  }

  get textContent() {
    if (this.children.length === 0) {
      return this._text;
    }
    return this.children.map(child => child.textContent).join('');
  }

  set innerText(value) {
    this.textContent = value;
  }

  get innerText() {
    return this.textContent;
  }

  set innerHTML(value) {
    this._text = String(value);
    this.children = [];
  }

  get innerHTML() {
    if (this.children.length === 0) {
      return this._text;
    }
    return this.children.map(child => child.innerHTML || child.textContent).join('');
  }

  addEventListener(type, handler) {
    if (!this.eventHandlers.has(type)) {
      this.eventHandlers.set(type, []);
    }
    this.eventHandlers.get(type).push(handler);
  }

  dispatchEvent(event) {
    event.target = this;
    const handlers = this.eventHandlers.get(event.type) || [];
    for (const handler of handlers) {
      handler.call(this, event);
    }
    if (event.type === 'click' && typeof this.onclick === 'function') {
      this.onclick(event);
    }
    return true;
  }

  click() {
    this.dispatchEvent(new FakeEvent('click', { bubbles: true }));
  }

  focus() {}
}

class FakeDocument {
  constructor() {
    this.elementsById = new Map();
    this.documentElement = new FakeElement('html', this);
    this.body = new FakeElement('body', this);
    this.documentElement.appendChild(this.body);
  }

  createElement(tagName) {
    return new FakeElement(tagName, this);
  }

  registerId(id, element) {
    this.elementsById.set(id, element);
  }

  unregisterId(id) {
    this.elementsById.delete(id);
  }

  getElementById(id) {
    return this.elementsById.get(id) || null;
  }

  querySelector(selector) {
    return this.documentElement.querySelector(selector);
  }

  querySelectorAll(selector) {
    return this.documentElement.querySelectorAll(selector);
  }
}

function matchesSelector(element, selector) {
  if (!selector) return false;
  if (selector.startsWith('#')) {
    return element.id === selector.slice(1);
  }
  if (selector.startsWith('.')) {
    const classes = selector.split('.').filter(Boolean);
    return classes.every(cls => element.classList.contains(cls));
  }
  return element.tagName.toLowerCase() === selector.toLowerCase();
}

FakeElement.prototype.querySelectorAll = function querySelectorAll(selector) {
  const selectors = selector.split(',').map(s => s.trim()).filter(Boolean);
  const results = [];
  const traverse = (node) => {
    for (const sel of selectors) {
      if (matchesSelector(node, sel)) {
        results.push(node);
        break;
      }
    }
    for (const child of node.children) {
      traverse(child);
    }
  };
  for (const child of this.children) {
    traverse(child);
  }
  return results;
};

FakeElement.prototype.querySelector = function querySelector(selector) {
  const [first] = this.querySelectorAll(selector);
  return first || null;
};

const flush = () => new Promise(resolve => setImmediate(resolve));
const tick = () => new Promise(resolve => global.setTimeout(resolve, 0));

class FakeMutationObserver {
  constructor() {}
  observe() {}
  disconnect() {}
}

describe('content script promo code flow', () => {
  let storage;
  let events;
  let hooks;
  let document;
  let couponInput;
  let totalEl;
  let statusEl;
  let applyButton;
  let realSetTimeout;

  beforeEach(async () => {
    realSetTimeout = global.setTimeout;
    global.setTimeout = (fn, ms, ...args) => realSetTimeout(fn, 0, ...args);

    storage = { discoCodes: ['SAVE10'], discoSavingsTotal: 0 };
    events = [];

    document = new FakeDocument();
    global.document = document;

    couponInput = document.createElement('input');
    couponInput.id = 'coupon-field';
    document.body.appendChild(couponInput);

    applyButton = document.createElement('button');
    applyButton.id = 'apply-button';
    applyButton.onclick = () => {
      if (couponInput.value === 'SAVE10') {
        totalEl.textContent = 'Total: £90.00';
      } else {
        totalEl.textContent = 'Total: £100.00';
      }
    };
    document.body.appendChild(applyButton);

    totalEl = document.createElement('div');
    totalEl.className = 'checkout-total';
    totalEl.textContent = 'Total: £100.00';
    document.body.appendChild(totalEl);

    statusEl = document.createElement('small');
    statusEl.id = 'disco-status';
    document.body.appendChild(statusEl);

    const get = async (key) => {
      if (Array.isArray(key)) {
        return key.reduce((acc, k) => {
          if (k in storage) acc[k] = storage[k];
          return acc;
        }, {});
      }
      if (typeof key === 'object' && key !== null) {
        const result = {};
        for (const prop of Object.keys(key)) {
          if (prop in storage) result[prop] = storage[prop];
        }
        return result;
      }
      if (key in storage) {
        return { [key]: storage[key] };
      }
      return {};
    };

    const set = async (updates) => {
      Object.assign(storage, updates);
    };

    const remove = async (key) => {
      if (Array.isArray(key)) {
        key.forEach(k => delete storage[k]);
      } else {
        delete storage[key];
      }
    };

    global.chrome = {
      storage: { local: { get, set, remove } },
      runtime: { onMessage: { addListener: () => {} } },
    };

    const adapters = {
      platforms: {
        generic: {
          coupon: ['#coupon-field'],
          apply: ['#apply-button'],
          total: ['.checkout-total'],
        },
      },
      retailers: [
        {
          name: 'shopper.test',
          domains: ['shopper.test'],
          platform: 'generic',
          checkoutHints: ['checkout'],
        },
      ],
    };

    const ai = {
      scrapeCodesFromDom: () => [],
      fetchCodeSuggestions: async () => ({ codes: ['FAIL', 'SAVE10'] }),
      rankCodesWithAI: async (_domain, { codes }) => ({
        codes: codes.map(code => ({ code, score: code === 'SAVE10' ? 5 : 1 })),
      }),
      postEvent: (...args) => { events.push(args); },
    };

    global.window = {
      DISCO_ADAPTERS: adapters,
      DISCO_AI: ai,
    };

    global.location = {
      href: 'https://shopper.test/checkout',
      host: 'shopper.test',
      hostname: 'shopper.test',
      pathname: '/checkout',
      hash: '',
    };

    global.Event = FakeEvent;
    global.MutationObserver = FakeMutationObserver;
    global.self = global.window;

    delete require.cache[require.resolve('../content.js')];
    ({ __testHooks: hooks } = require('../content.js'));
    await tick();
    await flush();
  });

  afterEach(() => {
    global.setTimeout = realSetTimeout;
    delete global.chrome;
    delete global.document;
    delete global.window;
    delete global.location;
    delete global.Event;
    delete global.MutationObserver;
    delete global.self;
    hooks = null;
    document = null;
    couponInput = null;
    totalEl = null;
    statusEl = null;
    applyButton = null;
    if (require.cache[require.resolve('../content.js')]) {
      delete require.cache[require.resolve('../content.js')];
    }
  });

  it('applies the best available code and records savings', async () => {
    assert.ok(typeof hooks.applyBest === 'function', 'applyBest hook exposed');

    await hooks.applyBest();
    await tick();
    await flush();

    assert.equal(couponInput.value, 'SAVE10');
    assert.ok(totalEl.textContent.includes('£90.00'));
    assert.equal(storage.discoSavingsTotal, 10);
    assert.match(statusEl.textContent, /Applied SAVE10/i);
    assert.ok(events.some(([, payload]) => payload?.success));
  });
});
