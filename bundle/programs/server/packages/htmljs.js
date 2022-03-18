(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var HTML;

var require = meteorInstall({"node_modules":{"meteor":{"htmljs":{"preamble.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/htmljs/preamble.js                                                                                    //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
module.export({
  HTML: () => HTML
});
let HTMLTags, Tag, Attrs, getTag, ensureTag, isTagEnsured, getSymbolName, knownHTMLElementNames, knownSVGElementNames, knownElementNames, voidElementNames, isKnownElement, isKnownSVGElement, isVoidElement, CharRef, Comment, Raw, isArray, isConstructedObject, isNully, isValidAttributeName, flattenAttributes;
module.link("./html", {
  HTMLTags(v) {
    HTMLTags = v;
  },

  Tag(v) {
    Tag = v;
  },

  Attrs(v) {
    Attrs = v;
  },

  getTag(v) {
    getTag = v;
  },

  ensureTag(v) {
    ensureTag = v;
  },

  isTagEnsured(v) {
    isTagEnsured = v;
  },

  getSymbolName(v) {
    getSymbolName = v;
  },

  knownHTMLElementNames(v) {
    knownHTMLElementNames = v;
  },

  knownSVGElementNames(v) {
    knownSVGElementNames = v;
  },

  knownElementNames(v) {
    knownElementNames = v;
  },

  voidElementNames(v) {
    voidElementNames = v;
  },

  isKnownElement(v) {
    isKnownElement = v;
  },

  isKnownSVGElement(v) {
    isKnownSVGElement = v;
  },

  isVoidElement(v) {
    isVoidElement = v;
  },

  CharRef(v) {
    CharRef = v;
  },

  Comment(v) {
    Comment = v;
  },

  Raw(v) {
    Raw = v;
  },

  isArray(v) {
    isArray = v;
  },

  isConstructedObject(v) {
    isConstructedObject = v;
  },

  isNully(v) {
    isNully = v;
  },

  isValidAttributeName(v) {
    isValidAttributeName = v;
  },

  flattenAttributes(v) {
    flattenAttributes = v;
  }

}, 0);
let Visitor, TransformingVisitor, ToHTMLVisitor, ToTextVisitor, toHTML, TEXTMODE, toText;
module.link("./visitors", {
  Visitor(v) {
    Visitor = v;
  },

  TransformingVisitor(v) {
    TransformingVisitor = v;
  },

  ToHTMLVisitor(v) {
    ToHTMLVisitor = v;
  },

  ToTextVisitor(v) {
    ToTextVisitor = v;
  },

  toHTML(v) {
    toHTML = v;
  },

  TEXTMODE(v) {
    TEXTMODE = v;
  },

  toText(v) {
    toText = v;
  }

}, 1);
const HTML = Object.assign(HTMLTags, {
  Tag,
  Attrs,
  getTag,
  ensureTag,
  isTagEnsured,
  getSymbolName,
  knownHTMLElementNames,
  knownSVGElementNames,
  knownElementNames,
  voidElementNames,
  isKnownElement,
  isKnownSVGElement,
  isVoidElement,
  CharRef,
  Comment,
  Raw,
  isArray,
  isConstructedObject,
  isNully,
  isValidAttributeName,
  flattenAttributes,
  toHTML,
  TEXTMODE,
  toText,
  Visitor,
  TransformingVisitor,
  ToHTMLVisitor,
  ToTextVisitor
});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"html.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/htmljs/html.js                                                                                        //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
module.export({
  Tag: () => Tag,
  Attrs: () => Attrs,
  HTMLTags: () => HTMLTags,
  getTag: () => getTag,
  ensureTag: () => ensureTag,
  isTagEnsured: () => isTagEnsured,
  getSymbolName: () => getSymbolName,
  knownHTMLElementNames: () => knownHTMLElementNames,
  knownSVGElementNames: () => knownSVGElementNames,
  knownElementNames: () => knownElementNames,
  voidElementNames: () => voidElementNames,
  isKnownElement: () => isKnownElement,
  isKnownSVGElement: () => isKnownSVGElement,
  isVoidElement: () => isVoidElement,
  CharRef: () => CharRef,
  Comment: () => Comment,
  Raw: () => Raw,
  isArray: () => isArray,
  isConstructedObject: () => isConstructedObject,
  isNully: () => isNully,
  isValidAttributeName: () => isValidAttributeName,
  flattenAttributes: () => flattenAttributes
});

const Tag = function () {};

Tag.prototype.tagName = ''; // this will be set per Tag subclass

Tag.prototype.attrs = null;
Tag.prototype.children = Object.freeze ? Object.freeze([]) : [];
Tag.prototype.htmljsType = Tag.htmljsType = ['Tag']; // Given "p" create the function `HTML.P`.

var makeTagConstructor = function (tagName) {
  // Tag is the per-tagName constructor of a HTML.Tag subclass
  var HTMLTag = function () {
    // Work with or without `new`.  If not called with `new`,
    // perform instantiation by recursively calling this constructor.
    // We can't pass varargs, so pass no args.
    var instance = this instanceof Tag ? this : new HTMLTag();
    var i = 0;

    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    var attrs = args.length && args[0];

    if (attrs && typeof attrs === 'object') {
      // Treat vanilla JS object as an attributes dictionary.
      if (!isConstructedObject(attrs)) {
        instance.attrs = attrs;
        i++;
      } else if (attrs instanceof Attrs) {
        var array = attrs.value;

        if (array.length === 1) {
          instance.attrs = array[0];
        } else if (array.length > 1) {
          instance.attrs = array;
        }

        i++;
      }
    } // If no children, don't create an array at all, use the prototype's
    // (frozen, empty) array.  This way we don't create an empty array
    // every time someone creates a tag without `new` and this constructor
    // calls itself with no arguments (above).


    if (i < args.length) instance.children = args.slice(i);
    return instance;
  };

  HTMLTag.prototype = new Tag();
  HTMLTag.prototype.constructor = HTMLTag;
  HTMLTag.prototype.tagName = tagName;
  return HTMLTag;
}; // Not an HTMLjs node, but a wrapper to pass multiple attrs dictionaries
// to a tag (for the purpose of implementing dynamic attributes).


function Attrs() {
  // Work with or without `new`.  If not called with `new`,
  // perform instantiation by recursively calling this constructor.
  // We can't pass varargs, so pass no args.
  var instance = this instanceof Attrs ? this : new Attrs();

  for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
    args[_key2] = arguments[_key2];
  }

  instance.value = args;
  return instance;
}

const HTMLTags = {};

function getTag(tagName) {
  var symbolName = getSymbolName(tagName);
  if (symbolName === tagName) // all-caps tagName
    throw new Error("Use the lowercase or camelCase form of '" + tagName + "' here");
  if (!HTMLTags[symbolName]) HTMLTags[symbolName] = makeTagConstructor(tagName);
  return HTMLTags[symbolName];
}

function ensureTag(tagName) {
  getTag(tagName); // don't return it
}

function isTagEnsured(tagName) {
  return isKnownElement(tagName);
}

function getSymbolName(tagName) {
  // "foo-bar" -> "FOO_BAR"
  return tagName.toUpperCase().replace(/-/g, '_');
}

const knownHTMLElementNames = 'a abbr acronym address applet area article aside audio b base basefont bdi bdo big blockquote body br button canvas caption center cite code col colgroup command data datagrid datalist dd del details dfn dir div dl dt em embed eventsource fieldset figcaption figure font footer form frame frameset h1 h2 h3 h4 h5 h6 head header hgroup hr html i iframe img input ins isindex kbd keygen label legend li link main map mark menu meta meter nav noframes noscript object ol optgroup option output p param pre progress q rp rt ruby s samp script section select small source span strike strong style sub summary sup table tbody td textarea tfoot th thead time title tr track tt u ul var video wbr'.split(' ');
const knownSVGElementNames = 'altGlyph altGlyphDef altGlyphItem animate animateColor animateMotion animateTransform circle clipPath color-profile cursor defs desc ellipse feBlend feColorMatrix feComponentTransfer feComposite feConvolveMatrix feDiffuseLighting feDisplacementMap feDistantLight feFlood feFuncA feFuncB feFuncG feFuncR feGaussianBlur feImage feMerge feMergeNode feMorphology feOffset fePointLight feSpecularLighting feSpotLight feTile feTurbulence filter font font-face font-face-format font-face-name font-face-src font-face-uri foreignObject g glyph glyphRef hkern image line linearGradient marker mask metadata missing-glyph path pattern polygon polyline radialGradient rect set stop style svg switch symbol text textPath title tref tspan use view vkern'.split(' ');
const knownElementNames = knownHTMLElementNames.concat(knownSVGElementNames);
const voidElementNames = 'area base br col command embed hr img input keygen link meta param source track wbr'.split(' ');
var voidElementSet = new Set(voidElementNames);
var knownElementSet = new Set(knownElementNames);
var knownSVGElementSet = new Set(knownSVGElementNames);

function isKnownElement(tagName) {
  return knownElementSet.has(tagName);
}

function isKnownSVGElement(tagName) {
  return knownSVGElementSet.has(tagName);
}

function isVoidElement(tagName) {
  return voidElementSet.has(tagName);
}

// Ensure tags for all known elements
knownElementNames.forEach(ensureTag);

function CharRef(attrs) {
  if (!(this instanceof CharRef)) // called without `new`
    return new CharRef(attrs);
  if (!(attrs && attrs.html && attrs.str)) throw new Error("HTML.CharRef must be constructed with ({html:..., str:...})");
  this.html = attrs.html;
  this.str = attrs.str;
}

CharRef.prototype.htmljsType = CharRef.htmljsType = ['CharRef'];

function Comment(value) {
  if (!(this instanceof Comment)) // called without `new`
    return new Comment(value);
  if (typeof value !== 'string') throw new Error('HTML.Comment must be constructed with a string');
  this.value = value; // Kill illegal hyphens in comment value (no way to escape them in HTML)

  this.sanitizedValue = value.replace(/^-|--+|-$/g, '');
}

Comment.prototype.htmljsType = Comment.htmljsType = ['Comment'];

function Raw(value) {
  if (!(this instanceof Raw)) // called without `new`
    return new Raw(value);
  if (typeof value !== 'string') throw new Error('HTML.Raw must be constructed with a string');
  this.value = value;
}

Raw.prototype.htmljsType = Raw.htmljsType = ['Raw'];

function isArray(x) {
  return x instanceof Array || Array.isArray(x);
}

function isConstructedObject(x) {
  // Figure out if `x` is "an instance of some class" or just a plain
  // object literal.  It correctly treats an object literal like
  // `{ constructor: ... }` as an object literal.  It won't detect
  // instances of classes that lack a `constructor` property (e.g.
  // if you assign to a prototype when setting up the class as in:
  // `Foo = function () { ... }; Foo.prototype = { ... }`, then
  // `(new Foo).constructor` is `Object`, not `Foo`).
  if (!x || typeof x !== 'object') return false; // Is this a plain object?

  let plain = false;

  if (Object.getPrototypeOf(x) === null) {
    plain = true;
  } else {
    let proto = x;

    while (Object.getPrototypeOf(proto) !== null) {
      proto = Object.getPrototypeOf(proto);
    }

    plain = Object.getPrototypeOf(x) === proto;
  }

  return !plain && typeof x.constructor === 'function' && x instanceof x.constructor;
}

function isNully(node) {
  if (node == null) // null or undefined
    return true;

  if (isArray(node)) {
    // is it an empty array or an array of all nully items?
    for (var i = 0; i < node.length; i++) if (!isNully(node[i])) return false;

    return true;
  }

  return false;
}

function isValidAttributeName(name) {
  return /^[:_A-Za-z][:_A-Za-z0-9.\-]*/.test(name);
}

function flattenAttributes(attrs) {
  if (!attrs) return attrs;
  var isList = isArray(attrs);
  if (isList && attrs.length === 0) return null;
  var result = {};

  for (var i = 0, N = isList ? attrs.length : 1; i < N; i++) {
    var oneAttrs = isList ? attrs[i] : attrs;
    if (typeof oneAttrs !== 'object' || isConstructedObject(oneAttrs)) throw new Error("Expected plain JS object as attrs, found: " + oneAttrs);

    for (var name in oneAttrs) {
      if (!isValidAttributeName(name)) throw new Error("Illegal HTML attribute name: " + name);
      var value = oneAttrs[name];
      if (!isNully(value)) result[name] = value;
    }
  }

  return result;
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"visitors.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/htmljs/visitors.js                                                                                    //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
module.export({
  Visitor: () => Visitor,
  TransformingVisitor: () => TransformingVisitor,
  ToTextVisitor: () => ToTextVisitor,
  ToHTMLVisitor: () => ToHTMLVisitor,
  toHTML: () => toHTML,
  TEXTMODE: () => TEXTMODE,
  toText: () => toText
});
let Tag, CharRef, Comment, Raw, isArray, getTag, isConstructedObject, flattenAttributes, isVoidElement;
module.link("./html", {
  Tag(v) {
    Tag = v;
  },

  CharRef(v) {
    CharRef = v;
  },

  Comment(v) {
    Comment = v;
  },

  Raw(v) {
    Raw = v;
  },

  isArray(v) {
    isArray = v;
  },

  getTag(v) {
    getTag = v;
  },

  isConstructedObject(v) {
    isConstructedObject = v;
  },

  flattenAttributes(v) {
    flattenAttributes = v;
  },

  isVoidElement(v) {
    isVoidElement = v;
  }

}, 0);

var IDENTITY = function (x) {
  return x;
}; // _assign is like _.extend or the upcoming Object.assign.
// Copy src's own, enumerable properties onto tgt and return
// tgt.


var _hasOwnProperty = Object.prototype.hasOwnProperty;

var _assign = function (tgt, src) {
  for (var k in src) {
    if (_hasOwnProperty.call(src, k)) tgt[k] = src[k];
  }

  return tgt;
};

const Visitor = function (props) {
  _assign(this, props);
};

Visitor.def = function (options) {
  _assign(this.prototype, options);
};

Visitor.extend = function (options) {
  var curType = this;

  var subType = function
    /*arguments*/
  HTMLVisitorSubtype() {
    Visitor.apply(this, arguments);
  };

  subType.prototype = new curType();
  subType.extend = curType.extend;
  subType.def = curType.def;
  if (options) _assign(subType.prototype, options);
  return subType;
};

Visitor.def({
  visit: function (content
  /*, ...*/
  ) {
    if (content == null) // null or undefined.
      return this.visitNull.apply(this, arguments);

    if (typeof content === 'object') {
      if (content.htmljsType) {
        switch (content.htmljsType) {
          case Tag.htmljsType:
            return this.visitTag.apply(this, arguments);

          case CharRef.htmljsType:
            return this.visitCharRef.apply(this, arguments);

          case Comment.htmljsType:
            return this.visitComment.apply(this, arguments);

          case Raw.htmljsType:
            return this.visitRaw.apply(this, arguments);

          default:
            throw new Error("Unknown htmljs type: " + content.htmljsType);
        }
      }

      if (isArray(content)) return this.visitArray.apply(this, arguments);
      return this.visitObject.apply(this, arguments);
    } else if (typeof content === 'string' || typeof content === 'boolean' || typeof content === 'number') {
      return this.visitPrimitive.apply(this, arguments);
    } else if (typeof content === 'function') {
      return this.visitFunction.apply(this, arguments);
    }

    throw new Error("Unexpected object in htmljs: " + content);
  },
  visitNull: function (nullOrUndefined
  /*, ...*/
  ) {},
  visitPrimitive: function (stringBooleanOrNumber
  /*, ...*/
  ) {},
  visitArray: function (array
  /*, ...*/
  ) {},
  visitComment: function (comment
  /*, ...*/
  ) {},
  visitCharRef: function (charRef
  /*, ...*/
  ) {},
  visitRaw: function (raw
  /*, ...*/
  ) {},
  visitTag: function (tag
  /*, ...*/
  ) {},
  visitObject: function (obj
  /*, ...*/
  ) {
    throw new Error("Unexpected object in htmljs: " + obj);
  },
  visitFunction: function (fn
  /*, ...*/
  ) {
    throw new Error("Unexpected function in htmljs: " + fn);
  }
});
const TransformingVisitor = Visitor.extend();
TransformingVisitor.def({
  visitNull: IDENTITY,
  visitPrimitive: IDENTITY,
  visitArray: function (array) {
    var result = array;

    for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      args[_key - 1] = arguments[_key];
    }

    for (var i = 0; i < array.length; i++) {
      var oldItem = array[i];
      var newItem = this.visit(oldItem, ...args);

      if (newItem !== oldItem) {
        // copy `array` on write
        if (result === array) result = array.slice();
        result[i] = newItem;
      }
    }

    return result;
  },
  visitComment: IDENTITY,
  visitCharRef: IDENTITY,
  visitRaw: IDENTITY,
  visitObject: function (obj) {
    // Don't parse Markdown & RCData as HTML
    if (obj.textMode != null) {
      return obj;
    }

    for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
      args[_key2 - 1] = arguments[_key2];
    }

    if ('content' in obj) {
      obj.content = this.visit(obj.content, ...args);
    }

    if ('elseContent' in obj) {
      obj.elseContent = this.visit(obj.elseContent, ...args);
    }

    return obj;
  },
  visitFunction: IDENTITY,
  visitTag: function (tag) {
    var oldChildren = tag.children;

    for (var _len3 = arguments.length, args = new Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
      args[_key3 - 1] = arguments[_key3];
    }

    var newChildren = this.visitChildren(oldChildren, ...args);
    var oldAttrs = tag.attrs;
    var newAttrs = this.visitAttributes(oldAttrs, ...args);
    if (newAttrs === oldAttrs && newChildren === oldChildren) return tag;
    var newTag = getTag(tag.tagName).apply(null, newChildren);
    newTag.attrs = newAttrs;
    return newTag;
  },
  visitChildren: function (children) {
    for (var _len4 = arguments.length, args = new Array(_len4 > 1 ? _len4 - 1 : 0), _key4 = 1; _key4 < _len4; _key4++) {
      args[_key4 - 1] = arguments[_key4];
    }

    return this.visitArray(children, ...args);
  },
  // Transform the `.attrs` property of a tag, which may be a dictionary,
  // an array, or in some uses, a foreign object (such as
  // a template tag).
  visitAttributes: function (attrs) {
    for (var _len5 = arguments.length, args = new Array(_len5 > 1 ? _len5 - 1 : 0), _key5 = 1; _key5 < _len5; _key5++) {
      args[_key5 - 1] = arguments[_key5];
    }

    if (isArray(attrs)) {
      var result = attrs;

      for (var i = 0; i < attrs.length; i++) {
        var oldItem = attrs[i];
        var newItem = this.visitAttributes(oldItem, ...args);

        if (newItem !== oldItem) {
          // copy on write
          if (result === attrs) result = attrs.slice();
          result[i] = newItem;
        }
      }

      return result;
    }

    if (attrs && isConstructedObject(attrs)) {
      throw new Error("The basic TransformingVisitor does not support " + "foreign objects in attributes.  Define a custom " + "visitAttributes for this case.");
    }

    var oldAttrs = attrs;
    var newAttrs = oldAttrs;

    if (oldAttrs) {
      var attrArgs = [null, null];
      attrArgs.push.apply(attrArgs, arguments);

      for (var k in oldAttrs) {
        var oldValue = oldAttrs[k];
        attrArgs[0] = k;
        attrArgs[1] = oldValue;
        var newValue = this.visitAttribute.apply(this, attrArgs);

        if (newValue !== oldValue) {
          // copy on write
          if (newAttrs === oldAttrs) newAttrs = _assign({}, oldAttrs);
          newAttrs[k] = newValue;
        }
      }
    }

    return newAttrs;
  },
  // Transform the value of one attribute name/value in an
  // attributes dictionary.
  visitAttribute: function (name, value, tag) {
    for (var _len6 = arguments.length, args = new Array(_len6 > 3 ? _len6 - 3 : 0), _key6 = 3; _key6 < _len6; _key6++) {
      args[_key6 - 3] = arguments[_key6];
    }

    return this.visit(value, ...args);
  }
});
const ToTextVisitor = Visitor.extend();
ToTextVisitor.def({
  visitNull: function (nullOrUndefined) {
    return '';
  },
  visitPrimitive: function (stringBooleanOrNumber) {
    var str = String(stringBooleanOrNumber);

    if (this.textMode === TEXTMODE.RCDATA) {
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    } else if (this.textMode === TEXTMODE.ATTRIBUTE) {
      // escape `&` and `"` this time, not `&` and `<`
      return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    } else {
      return str;
    }
  },
  visitArray: function (array) {
    var parts = [];

    for (var i = 0; i < array.length; i++) parts.push(this.visit(array[i]));

    return parts.join('');
  },
  visitComment: function (comment) {
    throw new Error("Can't have a comment here");
  },
  visitCharRef: function (charRef) {
    if (this.textMode === TEXTMODE.RCDATA || this.textMode === TEXTMODE.ATTRIBUTE) {
      return charRef.html;
    } else {
      return charRef.str;
    }
  },
  visitRaw: function (raw) {
    return raw.value;
  },
  visitTag: function (tag) {
    // Really we should just disallow Tags here.  However, at the
    // moment it's useful to stringify any HTML we find.  In
    // particular, when you include a template within `{{#markdown}}`,
    // we render the template as text, and since there's currently
    // no way to make the template be *parsed* as text (e.g. `<template
    // type="text">`), we hackishly support HTML tags in markdown
    // in templates by parsing them and stringifying them.
    return this.visit(this.toHTML(tag));
  },
  visitObject: function (x) {
    throw new Error("Unexpected object in htmljs in toText: " + x);
  },
  toHTML: function (node) {
    return toHTML(node);
  }
});
const ToHTMLVisitor = Visitor.extend();
ToHTMLVisitor.def({
  visitNull: function (nullOrUndefined) {
    return '';
  },
  visitPrimitive: function (stringBooleanOrNumber) {
    var str = String(stringBooleanOrNumber);
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  },
  visitArray: function (array) {
    var parts = [];

    for (var i = 0; i < array.length; i++) parts.push(this.visit(array[i]));

    return parts.join('');
  },
  visitComment: function (comment) {
    return '<!--' + comment.sanitizedValue + '-->';
  },
  visitCharRef: function (charRef) {
    return charRef.html;
  },
  visitRaw: function (raw) {
    return raw.value;
  },
  visitTag: function (tag) {
    var attrStrs = [];
    var tagName = tag.tagName;
    var children = tag.children;
    var attrs = tag.attrs;

    if (attrs) {
      attrs = flattenAttributes(attrs);

      for (var k in attrs) {
        if (k === 'value' && tagName === 'textarea') {
          children = [attrs[k], children];
        } else {
          var v = this.toText(attrs[k], TEXTMODE.ATTRIBUTE);
          attrStrs.push(' ' + k + '="' + v + '"');
        }
      }
    }

    var startTag = '<' + tagName + attrStrs.join('') + '>';
    var childStrs = [];
    var content;

    if (tagName === 'textarea') {
      for (var i = 0; i < children.length; i++) childStrs.push(this.toText(children[i], TEXTMODE.RCDATA));

      content = childStrs.join('');
      if (content.slice(0, 1) === '\n') // TEXTAREA will absorb a newline, so if we see one, add
        // another one.
        content = '\n' + content;
    } else {
      for (var i = 0; i < children.length; i++) childStrs.push(this.visit(children[i]));

      content = childStrs.join('');
    }

    var result = startTag + content;

    if (children.length || !isVoidElement(tagName)) {
      // "Void" elements like BR are the only ones that don't get a close
      // tag in HTML5.  They shouldn't have contents, either, so we could
      // throw an error upon seeing contents here.
      result += '</' + tagName + '>';
    }

    return result;
  },
  visitObject: function (x) {
    throw new Error("Unexpected object in htmljs in toHTML: " + x);
  },
  toText: function (node, textMode) {
    return toText(node, textMode);
  }
}); ////////////////////////////// TOHTML

function toHTML(content) {
  return new ToHTMLVisitor().visit(content);
}

const TEXTMODE = {
  STRING: 1,
  RCDATA: 2,
  ATTRIBUTE: 3
};

function toText(content, textMode) {
  if (!textMode) throw new Error("textMode required for HTML.toText");
  if (!(textMode === TEXTMODE.STRING || textMode === TEXTMODE.RCDATA || textMode === TEXTMODE.ATTRIBUTE)) throw new Error("Unknown textMode: " + textMode);
  var visitor = new ToTextVisitor({
    textMode: textMode
  });
  return visitor.visit(content);
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});

var exports = require("/node_modules/meteor/htmljs/preamble.js");

/* Exports */
Package._define("htmljs", exports, {
  HTML: HTML
});

})();

//# sourceURL=meteor://💻app/packages/htmljs.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvaHRtbGpzL3ByZWFtYmxlLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9odG1sanMvaHRtbC5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvaHRtbGpzL3Zpc2l0b3JzLmpzIl0sIm5hbWVzIjpbIm1vZHVsZSIsImV4cG9ydCIsIkhUTUwiLCJIVE1MVGFncyIsIlRhZyIsIkF0dHJzIiwiZ2V0VGFnIiwiZW5zdXJlVGFnIiwiaXNUYWdFbnN1cmVkIiwiZ2V0U3ltYm9sTmFtZSIsImtub3duSFRNTEVsZW1lbnROYW1lcyIsImtub3duU1ZHRWxlbWVudE5hbWVzIiwia25vd25FbGVtZW50TmFtZXMiLCJ2b2lkRWxlbWVudE5hbWVzIiwiaXNLbm93bkVsZW1lbnQiLCJpc0tub3duU1ZHRWxlbWVudCIsImlzVm9pZEVsZW1lbnQiLCJDaGFyUmVmIiwiQ29tbWVudCIsIlJhdyIsImlzQXJyYXkiLCJpc0NvbnN0cnVjdGVkT2JqZWN0IiwiaXNOdWxseSIsImlzVmFsaWRBdHRyaWJ1dGVOYW1lIiwiZmxhdHRlbkF0dHJpYnV0ZXMiLCJsaW5rIiwidiIsIlZpc2l0b3IiLCJUcmFuc2Zvcm1pbmdWaXNpdG9yIiwiVG9IVE1MVmlzaXRvciIsIlRvVGV4dFZpc2l0b3IiLCJ0b0hUTUwiLCJURVhUTU9ERSIsInRvVGV4dCIsIk9iamVjdCIsImFzc2lnbiIsInByb3RvdHlwZSIsInRhZ05hbWUiLCJhdHRycyIsImNoaWxkcmVuIiwiZnJlZXplIiwiaHRtbGpzVHlwZSIsIm1ha2VUYWdDb25zdHJ1Y3RvciIsIkhUTUxUYWciLCJpbnN0YW5jZSIsImkiLCJhcmdzIiwibGVuZ3RoIiwiYXJyYXkiLCJ2YWx1ZSIsInNsaWNlIiwiY29uc3RydWN0b3IiLCJzeW1ib2xOYW1lIiwiRXJyb3IiLCJ0b1VwcGVyQ2FzZSIsInJlcGxhY2UiLCJzcGxpdCIsImNvbmNhdCIsInZvaWRFbGVtZW50U2V0IiwiU2V0Iiwia25vd25FbGVtZW50U2V0Iiwia25vd25TVkdFbGVtZW50U2V0IiwiaGFzIiwiZm9yRWFjaCIsImh0bWwiLCJzdHIiLCJzYW5pdGl6ZWRWYWx1ZSIsIngiLCJBcnJheSIsInBsYWluIiwiZ2V0UHJvdG90eXBlT2YiLCJwcm90byIsIm5vZGUiLCJuYW1lIiwidGVzdCIsImlzTGlzdCIsInJlc3VsdCIsIk4iLCJvbmVBdHRycyIsIklERU5USVRZIiwiX2hhc093blByb3BlcnR5IiwiaGFzT3duUHJvcGVydHkiLCJfYXNzaWduIiwidGd0Iiwic3JjIiwiayIsImNhbGwiLCJwcm9wcyIsImRlZiIsIm9wdGlvbnMiLCJleHRlbmQiLCJjdXJUeXBlIiwic3ViVHlwZSIsIkhUTUxWaXNpdG9yU3VidHlwZSIsImFwcGx5IiwiYXJndW1lbnRzIiwidmlzaXQiLCJjb250ZW50IiwidmlzaXROdWxsIiwidmlzaXRUYWciLCJ2aXNpdENoYXJSZWYiLCJ2aXNpdENvbW1lbnQiLCJ2aXNpdFJhdyIsInZpc2l0QXJyYXkiLCJ2aXNpdE9iamVjdCIsInZpc2l0UHJpbWl0aXZlIiwidmlzaXRGdW5jdGlvbiIsIm51bGxPclVuZGVmaW5lZCIsInN0cmluZ0Jvb2xlYW5Pck51bWJlciIsImNvbW1lbnQiLCJjaGFyUmVmIiwicmF3IiwidGFnIiwib2JqIiwiZm4iLCJvbGRJdGVtIiwibmV3SXRlbSIsInRleHRNb2RlIiwiZWxzZUNvbnRlbnQiLCJvbGRDaGlsZHJlbiIsIm5ld0NoaWxkcmVuIiwidmlzaXRDaGlsZHJlbiIsIm9sZEF0dHJzIiwibmV3QXR0cnMiLCJ2aXNpdEF0dHJpYnV0ZXMiLCJuZXdUYWciLCJhdHRyQXJncyIsInB1c2giLCJvbGRWYWx1ZSIsIm5ld1ZhbHVlIiwidmlzaXRBdHRyaWJ1dGUiLCJTdHJpbmciLCJSQ0RBVEEiLCJBVFRSSUJVVEUiLCJwYXJ0cyIsImpvaW4iLCJhdHRyU3RycyIsInN0YXJ0VGFnIiwiY2hpbGRTdHJzIiwiU1RSSU5HIiwidmlzaXRvciJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7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aWxlIjoiL3BhY2thZ2VzL2h0bWxqcy5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7XG4gIEhUTUxUYWdzLFxuICBUYWcsXG4gIEF0dHJzLFxuICBnZXRUYWcsXG4gIGVuc3VyZVRhZyxcbiAgaXNUYWdFbnN1cmVkLFxuICBnZXRTeW1ib2xOYW1lLFxuICBrbm93bkhUTUxFbGVtZW50TmFtZXMsXG4gIGtub3duU1ZHRWxlbWVudE5hbWVzLFxuICBrbm93bkVsZW1lbnROYW1lcyxcbiAgdm9pZEVsZW1lbnROYW1lcyxcbiAgaXNLbm93bkVsZW1lbnQsXG4gIGlzS25vd25TVkdFbGVtZW50LFxuICBpc1ZvaWRFbGVtZW50LFxuICBDaGFyUmVmLFxuICBDb21tZW50LFxuICBSYXcsXG4gIGlzQXJyYXksXG4gIGlzQ29uc3RydWN0ZWRPYmplY3QsXG4gIGlzTnVsbHksXG4gIGlzVmFsaWRBdHRyaWJ1dGVOYW1lLFxuICBmbGF0dGVuQXR0cmlidXRlcyxcbn0gZnJvbSAnLi9odG1sJztcblxuaW1wb3J0IHtcbiAgVmlzaXRvcixcbiAgVHJhbnNmb3JtaW5nVmlzaXRvcixcbiAgVG9IVE1MVmlzaXRvcixcbiAgVG9UZXh0VmlzaXRvcixcbiAgdG9IVE1MLFxuICBURVhUTU9ERSxcbiAgdG9UZXh0XG59IGZyb20gJy4vdmlzaXRvcnMnO1xuXG5cbi8vIHdlJ3JlIGFjdHVhbGx5IGV4cG9ydGluZyB0aGUgSFRNTFRhZ3Mgb2JqZWN0LlxuLy8gIGJlY2F1c2UgaXQgaXMgZHluYW1pY2FsbHkgYWx0ZXJlZCBieSBnZXRUYWcvZW5zdXJlVGFnXG5leHBvcnQgY29uc3QgSFRNTCA9IE9iamVjdC5hc3NpZ24oSFRNTFRhZ3MsIHtcbiAgVGFnLFxuICBBdHRycyxcbiAgZ2V0VGFnLFxuICBlbnN1cmVUYWcsXG4gIGlzVGFnRW5zdXJlZCxcbiAgZ2V0U3ltYm9sTmFtZSxcbiAga25vd25IVE1MRWxlbWVudE5hbWVzLFxuICBrbm93blNWR0VsZW1lbnROYW1lcyxcbiAga25vd25FbGVtZW50TmFtZXMsXG4gIHZvaWRFbGVtZW50TmFtZXMsXG4gIGlzS25vd25FbGVtZW50LFxuICBpc0tub3duU1ZHRWxlbWVudCxcbiAgaXNWb2lkRWxlbWVudCxcbiAgQ2hhclJlZixcbiAgQ29tbWVudCxcbiAgUmF3LFxuICBpc0FycmF5LFxuICBpc0NvbnN0cnVjdGVkT2JqZWN0LFxuICBpc051bGx5LFxuICBpc1ZhbGlkQXR0cmlidXRlTmFtZSxcbiAgZmxhdHRlbkF0dHJpYnV0ZXMsXG4gIHRvSFRNTCxcbiAgVEVYVE1PREUsXG4gIHRvVGV4dCxcbiAgVmlzaXRvcixcbiAgVHJhbnNmb3JtaW5nVmlzaXRvcixcbiAgVG9IVE1MVmlzaXRvcixcbiAgVG9UZXh0VmlzaXRvcixcbn0pO1xuIiwiXG5leHBvcnQgY29uc3QgVGFnID0gZnVuY3Rpb24gKCkge307XG5UYWcucHJvdG90eXBlLnRhZ05hbWUgPSAnJzsgLy8gdGhpcyB3aWxsIGJlIHNldCBwZXIgVGFnIHN1YmNsYXNzXG5UYWcucHJvdG90eXBlLmF0dHJzID0gbnVsbDtcblRhZy5wcm90b3R5cGUuY2hpbGRyZW4gPSBPYmplY3QuZnJlZXplID8gT2JqZWN0LmZyZWV6ZShbXSkgOiBbXTtcblRhZy5wcm90b3R5cGUuaHRtbGpzVHlwZSA9IFRhZy5odG1sanNUeXBlID0gWydUYWcnXTtcblxuLy8gR2l2ZW4gXCJwXCIgY3JlYXRlIHRoZSBmdW5jdGlvbiBgSFRNTC5QYC5cbnZhciBtYWtlVGFnQ29uc3RydWN0b3IgPSBmdW5jdGlvbiAodGFnTmFtZSkge1xuICAvLyBUYWcgaXMgdGhlIHBlci10YWdOYW1lIGNvbnN0cnVjdG9yIG9mIGEgSFRNTC5UYWcgc3ViY2xhc3NcbiAgdmFyIEhUTUxUYWcgPSBmdW5jdGlvbiAoLi4uYXJncykge1xuICAgIC8vIFdvcmsgd2l0aCBvciB3aXRob3V0IGBuZXdgLiAgSWYgbm90IGNhbGxlZCB3aXRoIGBuZXdgLFxuICAgIC8vIHBlcmZvcm0gaW5zdGFudGlhdGlvbiBieSByZWN1cnNpdmVseSBjYWxsaW5nIHRoaXMgY29uc3RydWN0b3IuXG4gICAgLy8gV2UgY2FuJ3QgcGFzcyB2YXJhcmdzLCBzbyBwYXNzIG5vIGFyZ3MuXG4gICAgdmFyIGluc3RhbmNlID0gKHRoaXMgaW5zdGFuY2VvZiBUYWcpID8gdGhpcyA6IG5ldyBIVE1MVGFnO1xuXG4gICAgdmFyIGkgPSAwO1xuICAgIHZhciBhdHRycyA9IGFyZ3MubGVuZ3RoICYmIGFyZ3NbMF07XG4gICAgaWYgKGF0dHJzICYmICh0eXBlb2YgYXR0cnMgPT09ICdvYmplY3QnKSkge1xuICAgICAgLy8gVHJlYXQgdmFuaWxsYSBKUyBvYmplY3QgYXMgYW4gYXR0cmlidXRlcyBkaWN0aW9uYXJ5LlxuICAgICAgaWYgKCEgaXNDb25zdHJ1Y3RlZE9iamVjdChhdHRycykpIHtcbiAgICAgICAgaW5zdGFuY2UuYXR0cnMgPSBhdHRycztcbiAgICAgICAgaSsrO1xuICAgICAgfSBlbHNlIGlmIChhdHRycyBpbnN0YW5jZW9mIEF0dHJzKSB7XG4gICAgICAgIHZhciBhcnJheSA9IGF0dHJzLnZhbHVlO1xuICAgICAgICBpZiAoYXJyYXkubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgaW5zdGFuY2UuYXR0cnMgPSBhcnJheVswXTtcbiAgICAgICAgfSBlbHNlIGlmIChhcnJheS5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgaW5zdGFuY2UuYXR0cnMgPSBhcnJheTtcbiAgICAgICAgfVxuICAgICAgICBpKys7XG4gICAgICB9XG4gICAgfVxuXG5cbiAgICAvLyBJZiBubyBjaGlsZHJlbiwgZG9uJ3QgY3JlYXRlIGFuIGFycmF5IGF0IGFsbCwgdXNlIHRoZSBwcm90b3R5cGUnc1xuICAgIC8vIChmcm96ZW4sIGVtcHR5KSBhcnJheS4gIFRoaXMgd2F5IHdlIGRvbid0IGNyZWF0ZSBhbiBlbXB0eSBhcnJheVxuICAgIC8vIGV2ZXJ5IHRpbWUgc29tZW9uZSBjcmVhdGVzIGEgdGFnIHdpdGhvdXQgYG5ld2AgYW5kIHRoaXMgY29uc3RydWN0b3JcbiAgICAvLyBjYWxscyBpdHNlbGYgd2l0aCBubyBhcmd1bWVudHMgKGFib3ZlKS5cbiAgICBpZiAoaSA8IGFyZ3MubGVuZ3RoKVxuICAgICAgaW5zdGFuY2UuY2hpbGRyZW4gPSBhcmdzLnNsaWNlKGkpO1xuXG4gICAgcmV0dXJuIGluc3RhbmNlO1xuICB9O1xuICBIVE1MVGFnLnByb3RvdHlwZSA9IG5ldyBUYWc7XG4gIEhUTUxUYWcucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gSFRNTFRhZztcbiAgSFRNTFRhZy5wcm90b3R5cGUudGFnTmFtZSA9IHRhZ05hbWU7XG5cbiAgcmV0dXJuIEhUTUxUYWc7XG59O1xuXG4vLyBOb3QgYW4gSFRNTGpzIG5vZGUsIGJ1dCBhIHdyYXBwZXIgdG8gcGFzcyBtdWx0aXBsZSBhdHRycyBkaWN0aW9uYXJpZXNcbi8vIHRvIGEgdGFnIChmb3IgdGhlIHB1cnBvc2Ugb2YgaW1wbGVtZW50aW5nIGR5bmFtaWMgYXR0cmlidXRlcykuXG5leHBvcnQgZnVuY3Rpb24gQXR0cnMoLi4uYXJncykge1xuICAvLyBXb3JrIHdpdGggb3Igd2l0aG91dCBgbmV3YC4gIElmIG5vdCBjYWxsZWQgd2l0aCBgbmV3YCxcbiAgLy8gcGVyZm9ybSBpbnN0YW50aWF0aW9uIGJ5IHJlY3Vyc2l2ZWx5IGNhbGxpbmcgdGhpcyBjb25zdHJ1Y3Rvci5cbiAgLy8gV2UgY2FuJ3QgcGFzcyB2YXJhcmdzLCBzbyBwYXNzIG5vIGFyZ3MuXG4gIHZhciBpbnN0YW5jZSA9ICh0aGlzIGluc3RhbmNlb2YgQXR0cnMpID8gdGhpcyA6IG5ldyBBdHRycztcblxuICBpbnN0YW5jZS52YWx1ZSA9IGFyZ3M7XG5cbiAgcmV0dXJuIGluc3RhbmNlO1xufVxuXG4vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8gS05PV04gRUxFTUVOVFNcbmV4cG9ydCBjb25zdCBIVE1MVGFncyA9IHt9O1xuXG5leHBvcnQgZnVuY3Rpb24gZ2V0VGFnICh0YWdOYW1lKSB7XG4gIHZhciBzeW1ib2xOYW1lID0gZ2V0U3ltYm9sTmFtZSh0YWdOYW1lKTtcbiAgaWYgKHN5bWJvbE5hbWUgPT09IHRhZ05hbWUpIC8vIGFsbC1jYXBzIHRhZ05hbWVcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJVc2UgdGhlIGxvd2VyY2FzZSBvciBjYW1lbENhc2UgZm9ybSBvZiAnXCIgKyB0YWdOYW1lICsgXCInIGhlcmVcIik7XG5cbiAgaWYgKCEgSFRNTFRhZ3Nbc3ltYm9sTmFtZV0pXG4gICAgSFRNTFRhZ3Nbc3ltYm9sTmFtZV0gPSBtYWtlVGFnQ29uc3RydWN0b3IodGFnTmFtZSk7XG5cbiAgcmV0dXJuIEhUTUxUYWdzW3N5bWJvbE5hbWVdO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZW5zdXJlVGFnKHRhZ05hbWUpIHtcbiAgZ2V0VGFnKHRhZ05hbWUpOyAvLyBkb24ndCByZXR1cm4gaXRcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzVGFnRW5zdXJlZCAodGFnTmFtZSkge1xuICByZXR1cm4gaXNLbm93bkVsZW1lbnQodGFnTmFtZSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRTeW1ib2xOYW1lICh0YWdOYW1lKSB7XG4gIC8vIFwiZm9vLWJhclwiIC0+IFwiRk9PX0JBUlwiXG4gIHJldHVybiB0YWdOYW1lLnRvVXBwZXJDYXNlKCkucmVwbGFjZSgvLS9nLCAnXycpO1xufVxuXG5leHBvcnQgY29uc3Qga25vd25IVE1MRWxlbWVudE5hbWVzID0gJ2EgYWJiciBhY3JvbnltIGFkZHJlc3MgYXBwbGV0IGFyZWEgYXJ0aWNsZSBhc2lkZSBhdWRpbyBiIGJhc2UgYmFzZWZvbnQgYmRpIGJkbyBiaWcgYmxvY2txdW90ZSBib2R5IGJyIGJ1dHRvbiBjYW52YXMgY2FwdGlvbiBjZW50ZXIgY2l0ZSBjb2RlIGNvbCBjb2xncm91cCBjb21tYW5kIGRhdGEgZGF0YWdyaWQgZGF0YWxpc3QgZGQgZGVsIGRldGFpbHMgZGZuIGRpciBkaXYgZGwgZHQgZW0gZW1iZWQgZXZlbnRzb3VyY2UgZmllbGRzZXQgZmlnY2FwdGlvbiBmaWd1cmUgZm9udCBmb290ZXIgZm9ybSBmcmFtZSBmcmFtZXNldCBoMSBoMiBoMyBoNCBoNSBoNiBoZWFkIGhlYWRlciBoZ3JvdXAgaHIgaHRtbCBpIGlmcmFtZSBpbWcgaW5wdXQgaW5zIGlzaW5kZXgga2JkIGtleWdlbiBsYWJlbCBsZWdlbmQgbGkgbGluayBtYWluIG1hcCBtYXJrIG1lbnUgbWV0YSBtZXRlciBuYXYgbm9mcmFtZXMgbm9zY3JpcHQgb2JqZWN0IG9sIG9wdGdyb3VwIG9wdGlvbiBvdXRwdXQgcCBwYXJhbSBwcmUgcHJvZ3Jlc3MgcSBycCBydCBydWJ5IHMgc2FtcCBzY3JpcHQgc2VjdGlvbiBzZWxlY3Qgc21hbGwgc291cmNlIHNwYW4gc3RyaWtlIHN0cm9uZyBzdHlsZSBzdWIgc3VtbWFyeSBzdXAgdGFibGUgdGJvZHkgdGQgdGV4dGFyZWEgdGZvb3QgdGggdGhlYWQgdGltZSB0aXRsZSB0ciB0cmFjayB0dCB1IHVsIHZhciB2aWRlbyB3YnInLnNwbGl0KCcgJyk7XG4vLyAod2UgYWRkIHRoZSBTVkcgb25lcyBiZWxvdylcblxuZXhwb3J0IGNvbnN0IGtub3duU1ZHRWxlbWVudE5hbWVzID0gJ2FsdEdseXBoIGFsdEdseXBoRGVmIGFsdEdseXBoSXRlbSBhbmltYXRlIGFuaW1hdGVDb2xvciBhbmltYXRlTW90aW9uIGFuaW1hdGVUcmFuc2Zvcm0gY2lyY2xlIGNsaXBQYXRoIGNvbG9yLXByb2ZpbGUgY3Vyc29yIGRlZnMgZGVzYyBlbGxpcHNlIGZlQmxlbmQgZmVDb2xvck1hdHJpeCBmZUNvbXBvbmVudFRyYW5zZmVyIGZlQ29tcG9zaXRlIGZlQ29udm9sdmVNYXRyaXggZmVEaWZmdXNlTGlnaHRpbmcgZmVEaXNwbGFjZW1lbnRNYXAgZmVEaXN0YW50TGlnaHQgZmVGbG9vZCBmZUZ1bmNBIGZlRnVuY0IgZmVGdW5jRyBmZUZ1bmNSIGZlR2F1c3NpYW5CbHVyIGZlSW1hZ2UgZmVNZXJnZSBmZU1lcmdlTm9kZSBmZU1vcnBob2xvZ3kgZmVPZmZzZXQgZmVQb2ludExpZ2h0IGZlU3BlY3VsYXJMaWdodGluZyBmZVNwb3RMaWdodCBmZVRpbGUgZmVUdXJidWxlbmNlIGZpbHRlciBmb250IGZvbnQtZmFjZSBmb250LWZhY2UtZm9ybWF0IGZvbnQtZmFjZS1uYW1lIGZvbnQtZmFjZS1zcmMgZm9udC1mYWNlLXVyaSBmb3JlaWduT2JqZWN0IGcgZ2x5cGggZ2x5cGhSZWYgaGtlcm4gaW1hZ2UgbGluZSBsaW5lYXJHcmFkaWVudCBtYXJrZXIgbWFzayBtZXRhZGF0YSBtaXNzaW5nLWdseXBoIHBhdGggcGF0dGVybiBwb2x5Z29uIHBvbHlsaW5lIHJhZGlhbEdyYWRpZW50IHJlY3Qgc2V0IHN0b3Agc3R5bGUgc3ZnIHN3aXRjaCBzeW1ib2wgdGV4dCB0ZXh0UGF0aCB0aXRsZSB0cmVmIHRzcGFuIHVzZSB2aWV3IHZrZXJuJy5zcGxpdCgnICcpO1xuLy8gQXBwZW5kIFNWRyBlbGVtZW50IG5hbWVzIHRvIGxpc3Qgb2Yga25vd24gZWxlbWVudCBuYW1lc1xuZXhwb3J0IGNvbnN0IGtub3duRWxlbWVudE5hbWVzID0ga25vd25IVE1MRWxlbWVudE5hbWVzLmNvbmNhdChrbm93blNWR0VsZW1lbnROYW1lcyk7XG5cbmV4cG9ydCBjb25zdCB2b2lkRWxlbWVudE5hbWVzID0gJ2FyZWEgYmFzZSBiciBjb2wgY29tbWFuZCBlbWJlZCBociBpbWcgaW5wdXQga2V5Z2VuIGxpbmsgbWV0YSBwYXJhbSBzb3VyY2UgdHJhY2sgd2JyJy5zcGxpdCgnICcpO1xuXG5cbnZhciB2b2lkRWxlbWVudFNldCA9IG5ldyBTZXQodm9pZEVsZW1lbnROYW1lcyk7XG52YXIga25vd25FbGVtZW50U2V0ID0gbmV3IFNldChrbm93bkVsZW1lbnROYW1lcyk7XG52YXIga25vd25TVkdFbGVtZW50U2V0ID0gbmV3IFNldChrbm93blNWR0VsZW1lbnROYW1lcyk7XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0tub3duRWxlbWVudCh0YWdOYW1lKSB7XG4gIHJldHVybiBrbm93bkVsZW1lbnRTZXQuaGFzKHRhZ05hbWUpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNLbm93blNWR0VsZW1lbnQodGFnTmFtZSkge1xuICByZXR1cm4ga25vd25TVkdFbGVtZW50U2V0Lmhhcyh0YWdOYW1lKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzVm9pZEVsZW1lbnQodGFnTmFtZSkge1xuICByZXR1cm4gdm9pZEVsZW1lbnRTZXQuaGFzKHRhZ05hbWUpO1xufVxuXG5cbi8vIEVuc3VyZSB0YWdzIGZvciBhbGwga25vd24gZWxlbWVudHNcbmtub3duRWxlbWVudE5hbWVzLmZvckVhY2goZW5zdXJlVGFnKTtcblxuXG5leHBvcnQgZnVuY3Rpb24gQ2hhclJlZihhdHRycykge1xuICBpZiAoISAodGhpcyBpbnN0YW5jZW9mIENoYXJSZWYpKVxuICAgIC8vIGNhbGxlZCB3aXRob3V0IGBuZXdgXG4gICAgcmV0dXJuIG5ldyBDaGFyUmVmKGF0dHJzKTtcblxuICBpZiAoISAoYXR0cnMgJiYgYXR0cnMuaHRtbCAmJiBhdHRycy5zdHIpKVxuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIFwiSFRNTC5DaGFyUmVmIG11c3QgYmUgY29uc3RydWN0ZWQgd2l0aCAoe2h0bWw6Li4uLCBzdHI6Li4ufSlcIik7XG5cbiAgdGhpcy5odG1sID0gYXR0cnMuaHRtbDtcbiAgdGhpcy5zdHIgPSBhdHRycy5zdHI7XG59XG5DaGFyUmVmLnByb3RvdHlwZS5odG1sanNUeXBlID0gQ2hhclJlZi5odG1sanNUeXBlID0gWydDaGFyUmVmJ107XG5cbmV4cG9ydCBmdW5jdGlvbiBDb21tZW50KHZhbHVlKSB7XG4gIGlmICghICh0aGlzIGluc3RhbmNlb2YgQ29tbWVudCkpXG4gICAgLy8gY2FsbGVkIHdpdGhvdXQgYG5ld2BcbiAgICByZXR1cm4gbmV3IENvbW1lbnQodmFsdWUpO1xuXG4gIGlmICh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnKVxuICAgIHRocm93IG5ldyBFcnJvcignSFRNTC5Db21tZW50IG11c3QgYmUgY29uc3RydWN0ZWQgd2l0aCBhIHN0cmluZycpO1xuXG4gIHRoaXMudmFsdWUgPSB2YWx1ZTtcbiAgLy8gS2lsbCBpbGxlZ2FsIGh5cGhlbnMgaW4gY29tbWVudCB2YWx1ZSAobm8gd2F5IHRvIGVzY2FwZSB0aGVtIGluIEhUTUwpXG4gIHRoaXMuc2FuaXRpemVkVmFsdWUgPSB2YWx1ZS5yZXBsYWNlKC9eLXwtLSt8LSQvZywgJycpO1xufVxuQ29tbWVudC5wcm90b3R5cGUuaHRtbGpzVHlwZSA9IENvbW1lbnQuaHRtbGpzVHlwZSA9IFsnQ29tbWVudCddO1xuXG5leHBvcnQgZnVuY3Rpb24gUmF3KHZhbHVlKSB7XG4gIGlmICghICh0aGlzIGluc3RhbmNlb2YgUmF3KSlcbiAgICAvLyBjYWxsZWQgd2l0aG91dCBgbmV3YFxuICAgIHJldHVybiBuZXcgUmF3KHZhbHVlKTtcblxuICBpZiAodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJylcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0hUTUwuUmF3IG11c3QgYmUgY29uc3RydWN0ZWQgd2l0aCBhIHN0cmluZycpO1xuXG4gIHRoaXMudmFsdWUgPSB2YWx1ZTtcbn1cblJhdy5wcm90b3R5cGUuaHRtbGpzVHlwZSA9IFJhdy5odG1sanNUeXBlID0gWydSYXcnXTtcblxuXG5leHBvcnQgZnVuY3Rpb24gaXNBcnJheSAoeCkge1xuICByZXR1cm4geCBpbnN0YW5jZW9mIEFycmF5IHx8IEFycmF5LmlzQXJyYXkoeCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0NvbnN0cnVjdGVkT2JqZWN0ICh4KSB7XG4gIC8vIEZpZ3VyZSBvdXQgaWYgYHhgIGlzIFwiYW4gaW5zdGFuY2Ugb2Ygc29tZSBjbGFzc1wiIG9yIGp1c3QgYSBwbGFpblxuICAvLyBvYmplY3QgbGl0ZXJhbC4gIEl0IGNvcnJlY3RseSB0cmVhdHMgYW4gb2JqZWN0IGxpdGVyYWwgbGlrZVxuICAvLyBgeyBjb25zdHJ1Y3RvcjogLi4uIH1gIGFzIGFuIG9iamVjdCBsaXRlcmFsLiAgSXQgd29uJ3QgZGV0ZWN0XG4gIC8vIGluc3RhbmNlcyBvZiBjbGFzc2VzIHRoYXQgbGFjayBhIGBjb25zdHJ1Y3RvcmAgcHJvcGVydHkgKGUuZy5cbiAgLy8gaWYgeW91IGFzc2lnbiB0byBhIHByb3RvdHlwZSB3aGVuIHNldHRpbmcgdXAgdGhlIGNsYXNzIGFzIGluOlxuICAvLyBgRm9vID0gZnVuY3Rpb24gKCkgeyAuLi4gfTsgRm9vLnByb3RvdHlwZSA9IHsgLi4uIH1gLCB0aGVuXG4gIC8vIGAobmV3IEZvbykuY29uc3RydWN0b3JgIGlzIGBPYmplY3RgLCBub3QgYEZvb2ApLlxuICBpZigheCB8fCAodHlwZW9mIHggIT09ICdvYmplY3QnKSkgcmV0dXJuIGZhbHNlO1xuICAvLyBJcyB0aGlzIGEgcGxhaW4gb2JqZWN0P1xuICBsZXQgcGxhaW4gPSBmYWxzZTtcbiAgaWYoT2JqZWN0LmdldFByb3RvdHlwZU9mKHgpID09PSBudWxsKSB7XG4gICAgcGxhaW4gPSB0cnVlO1xuICB9IGVsc2Uge1xuICAgIGxldCBwcm90byA9IHg7XG4gICAgd2hpbGUoT2JqZWN0LmdldFByb3RvdHlwZU9mKHByb3RvKSAhPT0gbnVsbCkge1xuICAgICAgcHJvdG8gPSBPYmplY3QuZ2V0UHJvdG90eXBlT2YocHJvdG8pO1xuICAgIH1cbiAgICBwbGFpbiA9IE9iamVjdC5nZXRQcm90b3R5cGVPZih4KSA9PT0gcHJvdG87XG4gIH1cblxuICByZXR1cm4gIXBsYWluICYmXG4gICAgKHR5cGVvZiB4LmNvbnN0cnVjdG9yID09PSAnZnVuY3Rpb24nKSAmJlxuICAgICh4IGluc3RhbmNlb2YgeC5jb25zdHJ1Y3Rvcik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc051bGx5IChub2RlKSB7XG4gIGlmIChub2RlID09IG51bGwpXG4gICAgLy8gbnVsbCBvciB1bmRlZmluZWRcbiAgICByZXR1cm4gdHJ1ZTtcblxuICBpZiAoaXNBcnJheShub2RlKSkge1xuICAgIC8vIGlzIGl0IGFuIGVtcHR5IGFycmF5IG9yIGFuIGFycmF5IG9mIGFsbCBudWxseSBpdGVtcz9cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG5vZGUubGVuZ3RoOyBpKyspXG4gICAgICBpZiAoISBpc051bGx5KG5vZGVbaV0pKVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICByZXR1cm4gZmFsc2U7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc1ZhbGlkQXR0cmlidXRlTmFtZSAobmFtZSkge1xuICByZXR1cm4gL15bOl9BLVphLXpdWzpfQS1aYS16MC05LlxcLV0qLy50ZXN0KG5hbWUpO1xufVxuXG4vLyBJZiBgYXR0cnNgIGlzIGFuIGFycmF5IG9mIGF0dHJpYnV0ZXMgZGljdGlvbmFyaWVzLCBjb21iaW5lcyB0aGVtXG4vLyBpbnRvIG9uZS4gIFJlbW92ZXMgYXR0cmlidXRlcyB0aGF0IGFyZSBcIm51bGx5LlwiXG5leHBvcnQgZnVuY3Rpb24gZmxhdHRlbkF0dHJpYnV0ZXMgKGF0dHJzKSB7XG4gIGlmICghIGF0dHJzKVxuICAgIHJldHVybiBhdHRycztcblxuICB2YXIgaXNMaXN0ID0gaXNBcnJheShhdHRycyk7XG4gIGlmIChpc0xpc3QgJiYgYXR0cnMubGVuZ3RoID09PSAwKVxuICAgIHJldHVybiBudWxsO1xuXG4gIHZhciByZXN1bHQgPSB7fTtcbiAgZm9yICh2YXIgaSA9IDAsIE4gPSAoaXNMaXN0ID8gYXR0cnMubGVuZ3RoIDogMSk7IGkgPCBOOyBpKyspIHtcbiAgICB2YXIgb25lQXR0cnMgPSAoaXNMaXN0ID8gYXR0cnNbaV0gOiBhdHRycyk7XG4gICAgaWYgKCh0eXBlb2Ygb25lQXR0cnMgIT09ICdvYmplY3QnKSB8fFxuICAgICAgICBpc0NvbnN0cnVjdGVkT2JqZWN0KG9uZUF0dHJzKSlcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkV4cGVjdGVkIHBsYWluIEpTIG9iamVjdCBhcyBhdHRycywgZm91bmQ6IFwiICsgb25lQXR0cnMpO1xuICAgIGZvciAodmFyIG5hbWUgaW4gb25lQXR0cnMpIHtcbiAgICAgIGlmICghIGlzVmFsaWRBdHRyaWJ1dGVOYW1lKG5hbWUpKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbGxlZ2FsIEhUTUwgYXR0cmlidXRlIG5hbWU6IFwiICsgbmFtZSk7XG4gICAgICB2YXIgdmFsdWUgPSBvbmVBdHRyc1tuYW1lXTtcbiAgICAgIGlmICghIGlzTnVsbHkodmFsdWUpKVxuICAgICAgICByZXN1bHRbbmFtZV0gPSB2YWx1ZTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmVzdWx0O1xufVxuIiwiaW1wb3J0IHtcbiAgVGFnLFxuICBDaGFyUmVmLFxuICBDb21tZW50LFxuICBSYXcsXG4gIGlzQXJyYXksXG4gIGdldFRhZyxcbiAgaXNDb25zdHJ1Y3RlZE9iamVjdCxcbiAgZmxhdHRlbkF0dHJpYnV0ZXMsXG4gIGlzVm9pZEVsZW1lbnQsXG59IGZyb20gJy4vaHRtbCc7XG5cblxudmFyIElERU5USVRZID0gZnVuY3Rpb24gKHgpIHsgcmV0dXJuIHg7IH07XG5cbi8vIF9hc3NpZ24gaXMgbGlrZSBfLmV4dGVuZCBvciB0aGUgdXBjb21pbmcgT2JqZWN0LmFzc2lnbi5cbi8vIENvcHkgc3JjJ3Mgb3duLCBlbnVtZXJhYmxlIHByb3BlcnRpZXMgb250byB0Z3QgYW5kIHJldHVyblxuLy8gdGd0LlxudmFyIF9oYXNPd25Qcm9wZXJ0eSA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG52YXIgX2Fzc2lnbiA9IGZ1bmN0aW9uICh0Z3QsIHNyYykge1xuICBmb3IgKHZhciBrIGluIHNyYykge1xuICAgIGlmIChfaGFzT3duUHJvcGVydHkuY2FsbChzcmMsIGspKVxuICAgICAgdGd0W2tdID0gc3JjW2tdO1xuICB9XG4gIHJldHVybiB0Z3Q7XG59O1xuXG5leHBvcnQgY29uc3QgVmlzaXRvciA9IGZ1bmN0aW9uIChwcm9wcykge1xuICBfYXNzaWduKHRoaXMsIHByb3BzKTtcbn07XG5cblZpc2l0b3IuZGVmID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgX2Fzc2lnbih0aGlzLnByb3RvdHlwZSwgb3B0aW9ucyk7XG59O1xuXG5WaXNpdG9yLmV4dGVuZCA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gIHZhciBjdXJUeXBlID0gdGhpcztcbiAgdmFyIHN1YlR5cGUgPSBmdW5jdGlvbiBIVE1MVmlzaXRvclN1YnR5cGUoLyphcmd1bWVudHMqLykge1xuICAgIFZpc2l0b3IuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgfTtcbiAgc3ViVHlwZS5wcm90b3R5cGUgPSBuZXcgY3VyVHlwZTtcbiAgc3ViVHlwZS5leHRlbmQgPSBjdXJUeXBlLmV4dGVuZDtcbiAgc3ViVHlwZS5kZWYgPSBjdXJUeXBlLmRlZjtcbiAgaWYgKG9wdGlvbnMpXG4gICAgX2Fzc2lnbihzdWJUeXBlLnByb3RvdHlwZSwgb3B0aW9ucyk7XG4gIHJldHVybiBzdWJUeXBlO1xufTtcblxuVmlzaXRvci5kZWYoe1xuICB2aXNpdDogZnVuY3Rpb24gKGNvbnRlbnQvKiwgLi4uKi8pIHtcbiAgICBpZiAoY29udGVudCA9PSBudWxsKVxuICAgICAgLy8gbnVsbCBvciB1bmRlZmluZWQuXG4gICAgICByZXR1cm4gdGhpcy52aXNpdE51bGwuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcblxuICAgIGlmICh0eXBlb2YgY29udGVudCA9PT0gJ29iamVjdCcpIHtcbiAgICAgIGlmIChjb250ZW50Lmh0bWxqc1R5cGUpIHtcbiAgICAgICAgc3dpdGNoIChjb250ZW50Lmh0bWxqc1R5cGUpIHtcbiAgICAgICAgY2FzZSBUYWcuaHRtbGpzVHlwZTpcbiAgICAgICAgICByZXR1cm4gdGhpcy52aXNpdFRhZy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICBjYXNlIENoYXJSZWYuaHRtbGpzVHlwZTpcbiAgICAgICAgICByZXR1cm4gdGhpcy52aXNpdENoYXJSZWYuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgY2FzZSBDb21tZW50Lmh0bWxqc1R5cGU6XG4gICAgICAgICAgcmV0dXJuIHRoaXMudmlzaXRDb21tZW50LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgIGNhc2UgUmF3Lmh0bWxqc1R5cGU6XG4gICAgICAgICAgcmV0dXJuIHRoaXMudmlzaXRSYXcuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbmtub3duIGh0bWxqcyB0eXBlOiBcIiArIGNvbnRlbnQuaHRtbGpzVHlwZSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKGlzQXJyYXkoY29udGVudCkpXG4gICAgICAgIHJldHVybiB0aGlzLnZpc2l0QXJyYXkuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcblxuICAgICAgcmV0dXJuIHRoaXMudmlzaXRPYmplY3QuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcblxuICAgIH0gZWxzZSBpZiAoKHR5cGVvZiBjb250ZW50ID09PSAnc3RyaW5nJykgfHxcbiAgICAgICAgICAgICAgICh0eXBlb2YgY29udGVudCA9PT0gJ2Jvb2xlYW4nKSB8fFxuICAgICAgICAgICAgICAgKHR5cGVvZiBjb250ZW50ID09PSAnbnVtYmVyJykpIHtcbiAgICAgIHJldHVybiB0aGlzLnZpc2l0UHJpbWl0aXZlLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG5cbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBjb250ZW50ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICByZXR1cm4gdGhpcy52aXNpdEZ1bmN0aW9uLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuXG4gICAgdGhyb3cgbmV3IEVycm9yKFwiVW5leHBlY3RlZCBvYmplY3QgaW4gaHRtbGpzOiBcIiArIGNvbnRlbnQpO1xuXG4gIH0sXG4gIHZpc2l0TnVsbDogZnVuY3Rpb24gKG51bGxPclVuZGVmaW5lZC8qLCAuLi4qLykge30sXG4gIHZpc2l0UHJpbWl0aXZlOiBmdW5jdGlvbiAoc3RyaW5nQm9vbGVhbk9yTnVtYmVyLyosIC4uLiovKSB7fSxcbiAgdmlzaXRBcnJheTogZnVuY3Rpb24gKGFycmF5LyosIC4uLiovKSB7fSxcbiAgdmlzaXRDb21tZW50OiBmdW5jdGlvbiAoY29tbWVudC8qLCAuLi4qLykge30sXG4gIHZpc2l0Q2hhclJlZjogZnVuY3Rpb24gKGNoYXJSZWYvKiwgLi4uKi8pIHt9LFxuICB2aXNpdFJhdzogZnVuY3Rpb24gKHJhdy8qLCAuLi4qLykge30sXG4gIHZpc2l0VGFnOiBmdW5jdGlvbiAodGFnLyosIC4uLiovKSB7fSxcbiAgdmlzaXRPYmplY3Q6IGZ1bmN0aW9uIChvYmovKiwgLi4uKi8pIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbmV4cGVjdGVkIG9iamVjdCBpbiBodG1sanM6IFwiICsgb2JqKTtcbiAgfSxcbiAgdmlzaXRGdW5jdGlvbjogZnVuY3Rpb24gKGZuLyosIC4uLiovKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiVW5leHBlY3RlZCBmdW5jdGlvbiBpbiBodG1sanM6IFwiICsgZm4pO1xuICB9XG59KTtcblxuZXhwb3J0IGNvbnN0IFRyYW5zZm9ybWluZ1Zpc2l0b3IgPSBWaXNpdG9yLmV4dGVuZCgpO1xuVHJhbnNmb3JtaW5nVmlzaXRvci5kZWYoe1xuICB2aXNpdE51bGw6IElERU5USVRZLFxuICB2aXNpdFByaW1pdGl2ZTogSURFTlRJVFksXG4gIHZpc2l0QXJyYXk6IGZ1bmN0aW9uIChhcnJheSwgLi4uYXJncykge1xuICAgIHZhciByZXN1bHQgPSBhcnJheTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFycmF5Lmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgb2xkSXRlbSA9IGFycmF5W2ldO1xuICAgICAgdmFyIG5ld0l0ZW0gPSB0aGlzLnZpc2l0KG9sZEl0ZW0sIC4uLmFyZ3MpO1xuICAgICAgaWYgKG5ld0l0ZW0gIT09IG9sZEl0ZW0pIHtcbiAgICAgICAgLy8gY29weSBgYXJyYXlgIG9uIHdyaXRlXG4gICAgICAgIGlmIChyZXN1bHQgPT09IGFycmF5KVxuICAgICAgICAgIHJlc3VsdCA9IGFycmF5LnNsaWNlKCk7XG4gICAgICAgIHJlc3VsdFtpXSA9IG5ld0l0ZW07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH0sXG4gIHZpc2l0Q29tbWVudDogSURFTlRJVFksXG4gIHZpc2l0Q2hhclJlZjogSURFTlRJVFksXG4gIHZpc2l0UmF3OiBJREVOVElUWSxcbiAgdmlzaXRPYmplY3Q6IGZ1bmN0aW9uKG9iaiwgLi4uYXJncyl7XG4gICAgLy8gRG9uJ3QgcGFyc2UgTWFya2Rvd24gJiBSQ0RhdGEgYXMgSFRNTFxuICAgIGlmIChvYmoudGV4dE1vZGUgIT0gbnVsbCl7XG4gICAgICByZXR1cm4gb2JqO1xuICAgIH1cbiAgICBpZiAoJ2NvbnRlbnQnIGluIG9iaikge1xuICAgICAgb2JqLmNvbnRlbnQgPSB0aGlzLnZpc2l0KG9iai5jb250ZW50LCAuLi5hcmdzKTtcbiAgICB9XG4gICAgaWYgKCdlbHNlQ29udGVudCcgaW4gb2JqKXtcbiAgICAgIG9iai5lbHNlQ29udGVudCA9IHRoaXMudmlzaXQob2JqLmVsc2VDb250ZW50LCAuLi5hcmdzKTtcbiAgICB9XG4gICAgcmV0dXJuIG9iajtcbiAgfSxcbiAgdmlzaXRGdW5jdGlvbjogSURFTlRJVFksXG4gIHZpc2l0VGFnOiBmdW5jdGlvbiAodGFnLCAuLi5hcmdzKSB7XG4gICAgdmFyIG9sZENoaWxkcmVuID0gdGFnLmNoaWxkcmVuO1xuICAgIHZhciBuZXdDaGlsZHJlbiA9IHRoaXMudmlzaXRDaGlsZHJlbihvbGRDaGlsZHJlbiwgLi4uYXJncyk7XG5cbiAgICB2YXIgb2xkQXR0cnMgPSB0YWcuYXR0cnM7XG4gICAgdmFyIG5ld0F0dHJzID0gdGhpcy52aXNpdEF0dHJpYnV0ZXMob2xkQXR0cnMsIC4uLmFyZ3MpO1xuXG4gICAgaWYgKG5ld0F0dHJzID09PSBvbGRBdHRycyAmJiBuZXdDaGlsZHJlbiA9PT0gb2xkQ2hpbGRyZW4pXG4gICAgICByZXR1cm4gdGFnO1xuXG4gICAgdmFyIG5ld1RhZyA9IGdldFRhZyh0YWcudGFnTmFtZSkuYXBwbHkobnVsbCwgbmV3Q2hpbGRyZW4pO1xuICAgIG5ld1RhZy5hdHRycyA9IG5ld0F0dHJzO1xuICAgIHJldHVybiBuZXdUYWc7XG4gIH0sXG4gIHZpc2l0Q2hpbGRyZW46IGZ1bmN0aW9uIChjaGlsZHJlbiwgLi4uYXJncykge1xuICAgIHJldHVybiB0aGlzLnZpc2l0QXJyYXkoY2hpbGRyZW4sIC4uLmFyZ3MpO1xuICB9LFxuICAvLyBUcmFuc2Zvcm0gdGhlIGAuYXR0cnNgIHByb3BlcnR5IG9mIGEgdGFnLCB3aGljaCBtYXkgYmUgYSBkaWN0aW9uYXJ5LFxuICAvLyBhbiBhcnJheSwgb3IgaW4gc29tZSB1c2VzLCBhIGZvcmVpZ24gb2JqZWN0IChzdWNoIGFzXG4gIC8vIGEgdGVtcGxhdGUgdGFnKS5cbiAgdmlzaXRBdHRyaWJ1dGVzOiBmdW5jdGlvbiAoYXR0cnMsIC4uLmFyZ3MpIHtcbiAgICBpZiAoaXNBcnJheShhdHRycykpIHtcbiAgICAgIHZhciByZXN1bHQgPSBhdHRycztcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXR0cnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIG9sZEl0ZW0gPSBhdHRyc1tpXTtcbiAgICAgICAgdmFyIG5ld0l0ZW0gPSB0aGlzLnZpc2l0QXR0cmlidXRlcyhvbGRJdGVtLCAuLi5hcmdzKTtcbiAgICAgICAgaWYgKG5ld0l0ZW0gIT09IG9sZEl0ZW0pIHtcbiAgICAgICAgICAvLyBjb3B5IG9uIHdyaXRlXG4gICAgICAgICAgaWYgKHJlc3VsdCA9PT0gYXR0cnMpXG4gICAgICAgICAgICByZXN1bHQgPSBhdHRycy5zbGljZSgpO1xuICAgICAgICAgIHJlc3VsdFtpXSA9IG5ld0l0ZW07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgaWYgKGF0dHJzICYmIGlzQ29uc3RydWN0ZWRPYmplY3QoYXR0cnMpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJUaGUgYmFzaWMgVHJhbnNmb3JtaW5nVmlzaXRvciBkb2VzIG5vdCBzdXBwb3J0IFwiICtcbiAgICAgICAgICAgICAgICAgICAgICBcImZvcmVpZ24gb2JqZWN0cyBpbiBhdHRyaWJ1dGVzLiAgRGVmaW5lIGEgY3VzdG9tIFwiICtcbiAgICAgICAgICAgICAgICAgICAgICBcInZpc2l0QXR0cmlidXRlcyBmb3IgdGhpcyBjYXNlLlwiKTtcbiAgICB9XG5cbiAgICB2YXIgb2xkQXR0cnMgPSBhdHRycztcbiAgICB2YXIgbmV3QXR0cnMgPSBvbGRBdHRycztcbiAgICBpZiAob2xkQXR0cnMpIHtcbiAgICAgIHZhciBhdHRyQXJncyA9IFtudWxsLCBudWxsXTtcbiAgICAgIGF0dHJBcmdzLnB1c2guYXBwbHkoYXR0ckFyZ3MsIGFyZ3VtZW50cyk7XG4gICAgICBmb3IgKHZhciBrIGluIG9sZEF0dHJzKSB7XG4gICAgICAgIHZhciBvbGRWYWx1ZSA9IG9sZEF0dHJzW2tdO1xuICAgICAgICBhdHRyQXJnc1swXSA9IGs7XG4gICAgICAgIGF0dHJBcmdzWzFdID0gb2xkVmFsdWU7XG4gICAgICAgIHZhciBuZXdWYWx1ZSA9IHRoaXMudmlzaXRBdHRyaWJ1dGUuYXBwbHkodGhpcywgYXR0ckFyZ3MpO1xuICAgICAgICBpZiAobmV3VmFsdWUgIT09IG9sZFZhbHVlKSB7XG4gICAgICAgICAgLy8gY29weSBvbiB3cml0ZVxuICAgICAgICAgIGlmIChuZXdBdHRycyA9PT0gb2xkQXR0cnMpXG4gICAgICAgICAgICBuZXdBdHRycyA9IF9hc3NpZ24oe30sIG9sZEF0dHJzKTtcbiAgICAgICAgICBuZXdBdHRyc1trXSA9IG5ld1ZhbHVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ld0F0dHJzO1xuICB9LFxuICAvLyBUcmFuc2Zvcm0gdGhlIHZhbHVlIG9mIG9uZSBhdHRyaWJ1dGUgbmFtZS92YWx1ZSBpbiBhblxuICAvLyBhdHRyaWJ1dGVzIGRpY3Rpb25hcnkuXG4gIHZpc2l0QXR0cmlidXRlOiBmdW5jdGlvbiAobmFtZSwgdmFsdWUsIHRhZywgLi4uYXJncykge1xuICAgIHJldHVybiB0aGlzLnZpc2l0KHZhbHVlLCAuLi5hcmdzKTtcbiAgfVxufSk7XG5cblxuZXhwb3J0IGNvbnN0IFRvVGV4dFZpc2l0b3IgPSBWaXNpdG9yLmV4dGVuZCgpO1xuVG9UZXh0VmlzaXRvci5kZWYoe1xuICB2aXNpdE51bGw6IGZ1bmN0aW9uIChudWxsT3JVbmRlZmluZWQpIHtcbiAgICByZXR1cm4gJyc7XG4gIH0sXG4gIHZpc2l0UHJpbWl0aXZlOiBmdW5jdGlvbiAoc3RyaW5nQm9vbGVhbk9yTnVtYmVyKSB7XG4gICAgdmFyIHN0ciA9IFN0cmluZyhzdHJpbmdCb29sZWFuT3JOdW1iZXIpO1xuICAgIGlmICh0aGlzLnRleHRNb2RlID09PSBURVhUTU9ERS5SQ0RBVEEpIHtcbiAgICAgIHJldHVybiBzdHIucmVwbGFjZSgvJi9nLCAnJmFtcDsnKS5yZXBsYWNlKC88L2csICcmbHQ7Jyk7XG4gICAgfSBlbHNlIGlmICh0aGlzLnRleHRNb2RlID09PSBURVhUTU9ERS5BVFRSSUJVVEUpIHtcbiAgICAgIC8vIGVzY2FwZSBgJmAgYW5kIGBcImAgdGhpcyB0aW1lLCBub3QgYCZgIGFuZCBgPGBcbiAgICAgIHJldHVybiBzdHIucmVwbGFjZSgvJi9nLCAnJmFtcDsnKS5yZXBsYWNlKC9cIi9nLCAnJnF1b3Q7Jyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBzdHI7XG4gICAgfVxuICB9LFxuICB2aXNpdEFycmF5OiBmdW5jdGlvbiAoYXJyYXkpIHtcbiAgICB2YXIgcGFydHMgPSBbXTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFycmF5Lmxlbmd0aDsgaSsrKVxuICAgICAgcGFydHMucHVzaCh0aGlzLnZpc2l0KGFycmF5W2ldKSk7XG4gICAgcmV0dXJuIHBhcnRzLmpvaW4oJycpO1xuICB9LFxuICB2aXNpdENvbW1lbnQ6IGZ1bmN0aW9uIChjb21tZW50KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiQ2FuJ3QgaGF2ZSBhIGNvbW1lbnQgaGVyZVwiKTtcbiAgfSxcbiAgdmlzaXRDaGFyUmVmOiBmdW5jdGlvbiAoY2hhclJlZikge1xuICAgIGlmICh0aGlzLnRleHRNb2RlID09PSBURVhUTU9ERS5SQ0RBVEEgfHxcbiAgICAgICAgdGhpcy50ZXh0TW9kZSA9PT0gVEVYVE1PREUuQVRUUklCVVRFKSB7XG4gICAgICByZXR1cm4gY2hhclJlZi5odG1sO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gY2hhclJlZi5zdHI7XG4gICAgfVxuICB9LFxuICB2aXNpdFJhdzogZnVuY3Rpb24gKHJhdykge1xuICAgIHJldHVybiByYXcudmFsdWU7XG4gIH0sXG4gIHZpc2l0VGFnOiBmdW5jdGlvbiAodGFnKSB7XG4gICAgLy8gUmVhbGx5IHdlIHNob3VsZCBqdXN0IGRpc2FsbG93IFRhZ3MgaGVyZS4gIEhvd2V2ZXIsIGF0IHRoZVxuICAgIC8vIG1vbWVudCBpdCdzIHVzZWZ1bCB0byBzdHJpbmdpZnkgYW55IEhUTUwgd2UgZmluZC4gIEluXG4gICAgLy8gcGFydGljdWxhciwgd2hlbiB5b3UgaW5jbHVkZSBhIHRlbXBsYXRlIHdpdGhpbiBge3sjbWFya2Rvd259fWAsXG4gICAgLy8gd2UgcmVuZGVyIHRoZSB0ZW1wbGF0ZSBhcyB0ZXh0LCBhbmQgc2luY2UgdGhlcmUncyBjdXJyZW50bHlcbiAgICAvLyBubyB3YXkgdG8gbWFrZSB0aGUgdGVtcGxhdGUgYmUgKnBhcnNlZCogYXMgdGV4dCAoZS5nLiBgPHRlbXBsYXRlXG4gICAgLy8gdHlwZT1cInRleHRcIj5gKSwgd2UgaGFja2lzaGx5IHN1cHBvcnQgSFRNTCB0YWdzIGluIG1hcmtkb3duXG4gICAgLy8gaW4gdGVtcGxhdGVzIGJ5IHBhcnNpbmcgdGhlbSBhbmQgc3RyaW5naWZ5aW5nIHRoZW0uXG4gICAgcmV0dXJuIHRoaXMudmlzaXQodGhpcy50b0hUTUwodGFnKSk7XG4gIH0sXG4gIHZpc2l0T2JqZWN0OiBmdW5jdGlvbiAoeCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIlVuZXhwZWN0ZWQgb2JqZWN0IGluIGh0bWxqcyBpbiB0b1RleHQ6IFwiICsgeCk7XG4gIH0sXG4gIHRvSFRNTDogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICByZXR1cm4gdG9IVE1MKG5vZGUpO1xuICB9XG59KTtcblxuXG5cbmV4cG9ydCBjb25zdCBUb0hUTUxWaXNpdG9yID0gVmlzaXRvci5leHRlbmQoKTtcblRvSFRNTFZpc2l0b3IuZGVmKHtcbiAgdmlzaXROdWxsOiBmdW5jdGlvbiAobnVsbE9yVW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuICcnO1xuICB9LFxuICB2aXNpdFByaW1pdGl2ZTogZnVuY3Rpb24gKHN0cmluZ0Jvb2xlYW5Pck51bWJlcikge1xuICAgIHZhciBzdHIgPSBTdHJpbmcoc3RyaW5nQm9vbGVhbk9yTnVtYmVyKTtcbiAgICByZXR1cm4gc3RyLnJlcGxhY2UoLyYvZywgJyZhbXA7JykucmVwbGFjZSgvPC9nLCAnJmx0OycpO1xuICB9LFxuICB2aXNpdEFycmF5OiBmdW5jdGlvbiAoYXJyYXkpIHtcbiAgICB2YXIgcGFydHMgPSBbXTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFycmF5Lmxlbmd0aDsgaSsrKVxuICAgICAgcGFydHMucHVzaCh0aGlzLnZpc2l0KGFycmF5W2ldKSk7XG4gICAgcmV0dXJuIHBhcnRzLmpvaW4oJycpO1xuICB9LFxuICB2aXNpdENvbW1lbnQ6IGZ1bmN0aW9uIChjb21tZW50KSB7XG4gICAgcmV0dXJuICc8IS0tJyArIGNvbW1lbnQuc2FuaXRpemVkVmFsdWUgKyAnLS0+JztcbiAgfSxcbiAgdmlzaXRDaGFyUmVmOiBmdW5jdGlvbiAoY2hhclJlZikge1xuICAgIHJldHVybiBjaGFyUmVmLmh0bWw7XG4gIH0sXG4gIHZpc2l0UmF3OiBmdW5jdGlvbiAocmF3KSB7XG4gICAgcmV0dXJuIHJhdy52YWx1ZTtcbiAgfSxcbiAgdmlzaXRUYWc6IGZ1bmN0aW9uICh0YWcpIHtcbiAgICB2YXIgYXR0clN0cnMgPSBbXTtcblxuICAgIHZhciB0YWdOYW1lID0gdGFnLnRhZ05hbWU7XG4gICAgdmFyIGNoaWxkcmVuID0gdGFnLmNoaWxkcmVuO1xuXG4gICAgdmFyIGF0dHJzID0gdGFnLmF0dHJzO1xuICAgIGlmIChhdHRycykge1xuICAgICAgYXR0cnMgPSBmbGF0dGVuQXR0cmlidXRlcyhhdHRycyk7XG4gICAgICBmb3IgKHZhciBrIGluIGF0dHJzKSB7XG4gICAgICAgIGlmIChrID09PSAndmFsdWUnICYmIHRhZ05hbWUgPT09ICd0ZXh0YXJlYScpIHtcbiAgICAgICAgICBjaGlsZHJlbiA9IFthdHRyc1trXSwgY2hpbGRyZW5dO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZhciB2ID0gdGhpcy50b1RleHQoYXR0cnNba10sIFRFWFRNT0RFLkFUVFJJQlVURSk7XG4gICAgICAgICAgYXR0clN0cnMucHVzaCgnICcgKyBrICsgJz1cIicgKyB2ICsgJ1wiJyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgc3RhcnRUYWcgPSAnPCcgKyB0YWdOYW1lICsgYXR0clN0cnMuam9pbignJykgKyAnPic7XG5cbiAgICB2YXIgY2hpbGRTdHJzID0gW107XG4gICAgdmFyIGNvbnRlbnQ7XG4gICAgaWYgKHRhZ05hbWUgPT09ICd0ZXh0YXJlYScpIHtcblxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjaGlsZHJlbi5sZW5ndGg7IGkrKylcbiAgICAgICAgY2hpbGRTdHJzLnB1c2godGhpcy50b1RleHQoY2hpbGRyZW5baV0sIFRFWFRNT0RFLlJDREFUQSkpO1xuXG4gICAgICBjb250ZW50ID0gY2hpbGRTdHJzLmpvaW4oJycpO1xuICAgICAgaWYgKGNvbnRlbnQuc2xpY2UoMCwgMSkgPT09ICdcXG4nKVxuICAgICAgICAvLyBURVhUQVJFQSB3aWxsIGFic29yYiBhIG5ld2xpbmUsIHNvIGlmIHdlIHNlZSBvbmUsIGFkZFxuICAgICAgICAvLyBhbm90aGVyIG9uZS5cbiAgICAgICAgY29udGVudCA9ICdcXG4nICsgY29udGVudDtcblxuICAgIH0gZWxzZSB7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNoaWxkcmVuLmxlbmd0aDsgaSsrKVxuICAgICAgICBjaGlsZFN0cnMucHVzaCh0aGlzLnZpc2l0KGNoaWxkcmVuW2ldKSk7XG5cbiAgICAgIGNvbnRlbnQgPSBjaGlsZFN0cnMuam9pbignJyk7XG4gICAgfVxuXG4gICAgdmFyIHJlc3VsdCA9IHN0YXJ0VGFnICsgY29udGVudDtcblxuICAgIGlmIChjaGlsZHJlbi5sZW5ndGggfHwgISBpc1ZvaWRFbGVtZW50KHRhZ05hbWUpKSB7XG4gICAgICAvLyBcIlZvaWRcIiBlbGVtZW50cyBsaWtlIEJSIGFyZSB0aGUgb25seSBvbmVzIHRoYXQgZG9uJ3QgZ2V0IGEgY2xvc2VcbiAgICAgIC8vIHRhZyBpbiBIVE1MNS4gIFRoZXkgc2hvdWxkbid0IGhhdmUgY29udGVudHMsIGVpdGhlciwgc28gd2UgY291bGRcbiAgICAgIC8vIHRocm93IGFuIGVycm9yIHVwb24gc2VlaW5nIGNvbnRlbnRzIGhlcmUuXG4gICAgICByZXN1bHQgKz0gJzwvJyArIHRhZ05hbWUgKyAnPic7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfSxcbiAgdmlzaXRPYmplY3Q6IGZ1bmN0aW9uICh4KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiVW5leHBlY3RlZCBvYmplY3QgaW4gaHRtbGpzIGluIHRvSFRNTDogXCIgKyB4KTtcbiAgfSxcbiAgdG9UZXh0OiBmdW5jdGlvbiAobm9kZSwgdGV4dE1vZGUpIHtcbiAgICByZXR1cm4gdG9UZXh0KG5vZGUsIHRleHRNb2RlKTtcbiAgfVxufSk7XG5cblxuXG4vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8gVE9IVE1MXG5cbmV4cG9ydCBmdW5jdGlvbiB0b0hUTUwoY29udGVudCkge1xuICByZXR1cm4gKG5ldyBUb0hUTUxWaXNpdG9yKS52aXNpdChjb250ZW50KTtcbn1cblxuLy8gRXNjYXBpbmcgbW9kZXMgZm9yIG91dHB1dHRpbmcgdGV4dCB3aGVuIGdlbmVyYXRpbmcgSFRNTC5cbmV4cG9ydCBjb25zdCBURVhUTU9ERSA9IHtcbiAgU1RSSU5HOiAxLFxuICBSQ0RBVEE6IDIsXG4gIEFUVFJJQlVURTogM1xufTtcblxuXG5leHBvcnQgZnVuY3Rpb24gdG9UZXh0KGNvbnRlbnQsIHRleHRNb2RlKSB7XG4gIGlmICghIHRleHRNb2RlKVxuICAgIHRocm93IG5ldyBFcnJvcihcInRleHRNb2RlIHJlcXVpcmVkIGZvciBIVE1MLnRvVGV4dFwiKTtcbiAgaWYgKCEgKHRleHRNb2RlID09PSBURVhUTU9ERS5TVFJJTkcgfHxcbiAgICAgICAgIHRleHRNb2RlID09PSBURVhUTU9ERS5SQ0RBVEEgfHxcbiAgICAgICAgIHRleHRNb2RlID09PSBURVhUTU9ERS5BVFRSSUJVVEUpKVxuICAgIHRocm93IG5ldyBFcnJvcihcIlVua25vd24gdGV4dE1vZGU6IFwiICsgdGV4dE1vZGUpO1xuXG4gIHZhciB2aXNpdG9yID0gbmV3IFRvVGV4dFZpc2l0b3Ioe3RleHRNb2RlOiB0ZXh0TW9kZX0pO1xuICByZXR1cm4gdmlzaXRvci52aXNpdChjb250ZW50KTtcbn1cbiJdfQ==
