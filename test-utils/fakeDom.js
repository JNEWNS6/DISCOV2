class FakeElement {
  constructor(tagName, ownerDocument) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.parent = null;
    this.attributes = {};
    this._textContent = '';
    this._innerHTML = '';
    this.value = '';
    this.onclick = null;
    this.src = '';
    this.className = '';
  }

  set id(value) {
    this.attributes.id = value;
    if (this.ownerDocument) {
      this.ownerDocument.registerId(value, this);
    }
  }

  get id() {
    return this.attributes.id || '';
  }

  setAttribute(name, value) {
    if (name === 'id') {
      this.id = value;
      return;
    }
    if (name === 'class') {
      this.className = value;
    }
    this.attributes[name] = value;
  }

  getAttribute(name) {
    if (name === 'id') return this.id;
    if (name === 'class') return this.className;
    return this.attributes[name];
  }

  appendChild(child) {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  removeChildren() {
    this.children.forEach(child => {
      if (child.id) {
        this.ownerDocument.unregisterId(child.id);
      }
      child.parent = null;
    });
    this.children = [];
  }

  set textContent(value) {
    this._textContent = String(value);
  }

  get textContent() {
    let text = this._textContent;
    for (const child of this.children) {
      text += child.textContent;
    }
    return text;
  }

  set innerHTML(value) {
    this._innerHTML = String(value);
    this._textContent = String(value);
    this.removeChildren();
  }

  get innerHTML() {
    if (this.children.length === 0) {
      return this._innerHTML;
    }
    return this.children.map(child => child.innerHTML || child.textContent).join('');
  }

  querySelectorAll(selector) {
    const tokens = selector.trim().split(/\s+/);
    const matches = [];

    const matchesToken = (node, token) => {
      if (!node) return false;
      if (token.startsWith('#')) {
        return node.id === token.slice(1);
      }
      return node.tagName.toLowerCase() === token.toLowerCase();
    };

    const traverse = (node, depth) => {
      if (!node) return;
      if (matchesToken(node, tokens[depth])) {
        if (depth === tokens.length - 1) {
          matches.push(node);
        } else {
          for (const child of node.children) {
            traverse(child, depth + 1);
          }
        }
      }
      for (const child of node.children) {
        traverse(child, depth);
      }
    };

    traverse(this, 0);
    return matches;
  }

  querySelector(selector) {
    const [first] = this.querySelectorAll(selector);
    return first || null;
  }

  click() {
    if (typeof this.onclick === 'function') {
      return this.onclick();
    }
    return undefined;
  }
}

class FakeDocument {
  constructor() {
    this.elementsById = new Map();
    this.body = new FakeElement('body', this);
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
    return this.body.querySelector(selector);
  }

  querySelectorAll(selector) {
    return this.body.querySelectorAll(selector);
  }
}

function createDocument() {
  return new FakeDocument();
}

module.exports = {
  FakeElement,
  FakeDocument,
  createDocument,
};
