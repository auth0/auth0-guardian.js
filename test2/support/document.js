'use strict';

class Element {
  constructor(type) {
    this.type = type;
    this.attrs = {};
    this.children = [];
    this.submitted = false;
  }

  setAttribute(attr, value) {
    this.attrs[attr] = value;
  }

  appendChild(element) {
    this.children.push(element);
  }

  removeChild(element) {
    const index = this.children.indexOf(element);
    this.children[index].removed = true;
  }

  submit() {
    this.submitted = true;
  }
}

module.exports = class Document {
  constructor() {
    this.body = new Element('body');
  }

  createElement(type) {
    return new Element(type);
  }
};
