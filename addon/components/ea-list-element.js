import Ember from 'ember';
import { componentNodes } from 'ember-animated/ember-internals';
import Sprite from '../sprite';
import $ from 'jquery';

export default Ember.Component.extend({
  tagName: '',
  didInsertElement() {
    this._forEachElement(elt => {
      $(elt).addClass('ember-animated-hidden');
    });
    this.sendAction("entering", this);
  },
  willDestroyElement() {
    this.sendAction("leaving", this);
  },

  _forEachElement(fn) {
    let { firstNode, lastNode } = componentNodes(this);
    let node = firstNode;
    while (node) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        fn(node);
      } else if (! /^\s*$/.test(node.textContent)) {
        console.warn("Found bare text content inside a liquid-each");
      }
      if (node === lastNode){ break; }
      node = node.nextSibling;
    }
  },

  sprites() {
    let list = [];
    this._forEachElement(elt => {
      list.push(new Sprite(elt, this));
    });
    return list;
  }
});
