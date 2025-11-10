const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { createDocument } = require('../test-utils/fakeDom');

const flushPromises = () => new Promise(resolve => setImmediate(resolve));

describe('popup promo code management', () => {
  let store;
  let getMock;
  let setMock;
  let removeMock;
  let load;

  const buildDom = () => {
    const doc = createDocument();
    const body = doc.body;

    const hero = doc.createElement('div');
    hero.className = 'hero';
    const heroImg = doc.createElement('img');
    heroImg.id = 'disco-hero-icon';
    hero.appendChild(heroImg);
    const heroText = doc.createElement('div');
    const title = doc.createElement('h1');
    title.textContent = 'Disco is ready';
    heroText.appendChild(title);
    hero.appendChild(heroText);
    body.appendChild(hero);

    const total = doc.createElement('div');
    total.id = 'total-savings';
    body.appendChild(total);

    const details = doc.createElement('details');
    const backendLabel = doc.createElement('label');
    details.appendChild(backendLabel);
    const backendInput = doc.createElement('input');
    backendInput.id = 'backend';
    details.appendChild(backendInput);
    const keyLabel = doc.createElement('label');
    details.appendChild(keyLabel);
    const keyInput = doc.createElement('input');
    keyInput.id = 'key';
    details.appendChild(keyInput);
    const buttonRow = doc.createElement('div');
    const saveBtn = doc.createElement('button');
    saveBtn.id = 'save';
    buttonRow.appendChild(saveBtn);
    const clearBtn = doc.createElement('button');
    clearBtn.id = 'clear';
    buttonRow.appendChild(clearBtn);
    details.appendChild(buttonRow);
    body.appendChild(details);

    const codesHeader = doc.createElement('h1');
    codesHeader.textContent = 'Your codes';
    body.appendChild(codesHeader);

    const codesRow = doc.createElement('div');
    const codeInput = doc.createElement('input');
    codeInput.id = 'code';
    codesRow.appendChild(codeInput);
    const addBtn = doc.createElement('button');
    addBtn.id = 'add';
    codesRow.appendChild(addBtn);
    body.appendChild(codesRow);

    const list = doc.createElement('ul');
    list.id = 'list';
    body.appendChild(list);

    return doc;
  };

  const importPopup = async () => {
    delete require.cache[require.resolve('../popup.js')];
    global.document = buildDom();
    ({ load } = require('../popup.js'));
    await flushPromises();
    await load();
    await flushPromises();
  };

  beforeEach(async () => {
    store = {
      discoSettings: { backendUrl: 'https://api.disco/staging', apiKey: 'secret' },
      discoSavingsTotal: 12.34,
      discoCodes: ['SAVE10', 'WELCOME10'],
    };

    getMock = async (key) => {
      if (Array.isArray(key)) {
        return key.reduce((acc, k) => {
          if (k in store) acc[k] = store[k];
          return acc;
        }, {});
      }
      if (typeof key === 'object') {
        const result = {};
        for (const k of Object.keys(key)) {
          if (k in store) result[k] = store[k];
        }
        return result;
      }
      if (key in store) {
        return { [key]: store[key] };
      }
      return {};
    };

    setMock = async (updates) => {
      for (const [key, value] of Object.entries(updates)) {
        store[key] = value;
      }
    };

    removeMock = async (key) => {
      if (Array.isArray(key)) {
        key.forEach(k => delete store[k]);
      } else {
        delete store[key];
      }
    };

    global.chrome = {
      storage: {
        local: {
          get: getMock,
          set: setMock,
          remove: removeMock,
        },
      },
    };

    global.self = global.self || global;
    global.self.DISCO_ICON_BASE64 = { '48': 'test-base64' };

    await importPopup();
  });

  afterEach(() => {
    delete global.chrome;
    if (global.self && global.self.DISCO_ICON_BASE64) {
      delete global.self.DISCO_ICON_BASE64;
    }
    delete global.document;
  });

  it('load renders settings, totals, and saved codes', () => {
    assert.equal(global.document.getElementById('backend').value, 'https://api.disco/staging');
    assert.equal(global.document.getElementById('key').value, 'secret');
    assert.equal(global.document.getElementById('total-savings').textContent, 'Total saved with Disco: £12.34');
    const listItems = global.document.querySelectorAll('#list li');
    assert.equal(listItems.length, 2);
    assert.ok(listItems[0].textContent.includes('SAVE10'));
    assert.ok(global.document.getElementById('disco-hero-icon').src.includes('data:image/png;base64,test-base64'));
  });

  it('saving settings trims values and persists to storage', async () => {
    const backendInput = global.document.getElementById('backend');
    backendInput.value = ' https://prod.disco ';
    const keyInput = global.document.getElementById('key');
    keyInput.value = ' new-key ';
    const saveBtn = global.document.getElementById('save');
    await saveBtn.click();
    await flushPromises();
    assert.deepEqual(store.discoSettings, { backendUrl: 'https://prod.disco', apiKey: 'new-key' });
  });

  it('adding and removing codes keeps storage in sync', async () => {
    const codeInput = global.document.getElementById('code');
    codeInput.value = ' FRESH ';
    const addBtn = global.document.getElementById('add');
    await addBtn.click();
    await flushPromises();
    assert.deepEqual(store.discoCodes, ['SAVE10', 'WELCOME10', 'FRESH']);

    const firstRemove = global.document.querySelector('#list li button');
    await firstRemove.click();
    await flushPromises();
    assert.deepEqual(store.discoCodes, ['WELCOME10', 'FRESH']);
  });

  it('clearing settings removes the override from storage', async () => {
    const clearBtn = global.document.getElementById('clear');
    await clearBtn.click();
    await flushPromises();
    assert.equal(store.discoSettings, undefined);
  });
});
