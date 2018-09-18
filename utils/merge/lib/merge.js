"use strict";

const isPlainObject = require("@gourmet/is-plain-object");

class Customizer {
  constructor(customizer) {
    this.customizer = customizer;
  }
}

const OBJECT = 1;
const ARRAY = 2;
const OTHER = 0;

function _getType(obj) {
  if (isPlainObject(obj))
    return OBJECT;
  else if (Array.isArray(obj))
    return ARRAY;
  return OTHER;
}

function _merge(des, src) {
  const props = Object.keys(src);

  for (let idx = 0; idx < props.length; idx++) {
    const prop = props[idx];
    const srcVal = src[prop];
    const desVal = des[prop];

    if (srcVal instanceof Customizer) {
      des[prop] = srcVal.customizer.call(null, desVal);
    } else {
      const st = _getType(srcVal);
      const dt = _getType(desVal);
      let nv;

      if (dt === ARRAY && srcVal !== undefined)
        nv = desVal.concat(srcVal);
      else if (st === ARRAY && desVal !== undefined)
        nv = [desVal].concat(srcVal);
      else if (st === OBJECT && dt === OBJECT)
        nv = _merge(desVal, srcVal);
      else if (st === OBJECT)
        nv = _merge({}, srcVal);  // make a copy
      else
        nv = srcVal;

      if (nv !== undefined)
        des[prop] = nv;
    }
  }

  return des;
}

/**
 * Recursively merges source objects into the destination object in-place.
 * Key behaviors are:
 *  - Arrays are appended.
 *  - Non-plain objects (class instances) are ref-copied, not cloned.
 *  - Customizers are supported through `merge.custom`.
 **/
function merge(des, ...args) {
  for (let idx = 0, len = args.length; idx < len; idx++) {
    const src = args[idx];
    if (src)
      _merge(des, src);
  }
  return des;
}

// `customizer` will get called with a parameter `des` which is a destination
// value to be merged with. Note this can be `undefined` if there is no
// destination value. If returns `undefined`, the default method is used.
merge.custom = function(customizer) {
  return new Customizer(customizer);
};

// A customizer to assign a value to destination without any operation.
// Can be used to replace, not to append an array.
merge.assign = function(value) {
  return new Customizer(function() {
    return value;
  });
};

// Merges objects into a new object, keeping source objects intact.
// This function tries to minimize unnecessary copying whenever possible.
// Also, note that this function returns `undefined` if there is no plain
// object in the arguments.
merge.intact = function(...args) {
  let des;

  for (let idx = 0, len = args.length; idx < len; idx++) {
    const src = args[idx];
    if (src) {
      if (!des) {
        des = src;
      } else if (des.__safeToWrite__) {
        merge(des, src);
      } else {
        const obj = {};
        Object.defineProperty(obj, "__safeToWrite__", {value: true});
        des = merge(obj, des, src);
      }
    }
  }

  return des;
};

module.exports = merge;
