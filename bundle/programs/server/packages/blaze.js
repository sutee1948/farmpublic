(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var Tracker = Package.tracker.Tracker;
var Deps = Package.tracker.Deps;
var check = Package.check.check;
var Match = Package.check.Match;
var _ = Package.underscore._;
var ObserveSequence = Package['observe-sequence'].ObserveSequence;
var ReactiveVar = Package['reactive-var'].ReactiveVar;
var OrderedDict = Package['ordered-dict'].OrderedDict;
var ECMAScript = Package.ecmascript.ECMAScript;
var HTML = Package.htmljs.HTML;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var Blaze, UI, Handlebars;

var require = meteorInstall({"node_modules":{"meteor":{"blaze":{"preamble.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/blaze/preamble.js                                                                                          //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
/**
 * @namespace Blaze
 * @summary The namespace for all Blaze-related methods and classes.
 */
Blaze = {}; // Utility to HTML-escape a string.  Included for legacy reasons.
// TODO: Should be replaced with _.escape once underscore is upgraded to a newer
//       version which escapes ` (backtick) as well. Underscore 1.5.2 does not.

Blaze._escape = function () {
  var escape_map = {
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
    "/": "&#x2F;",
    "`": "&#x60;",

    /* IE allows backtick-delimited attributes?? */
    "&": "&amp;"
  };

  var escape_one = function (c) {
    return escape_map[c];
  };

  return function (x) {
    return x.replace(/[&<>"'`]/g, escape_one);
  };
}();

Blaze._warn = function (msg) {
  msg = 'Warning: ' + msg;

  if (typeof console !== 'undefined' && console.warn) {
    console.warn(msg);
  }
};

var nativeBind = Function.prototype.bind; // An implementation of _.bind which allows better optimization.
// See: https://github.com/petkaantonov/bluebird/wiki/Optimization-killers#3-managing-arguments

if (nativeBind) {
  Blaze._bind = function (func, obj) {
    if (arguments.length === 2) {
      return nativeBind.call(func, obj);
    } // Copy the arguments so this function can be optimized.


    var args = new Array(arguments.length);

    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i];
    }

    return nativeBind.apply(func, args.slice(1));
  };
} else {
  // A slower but backwards compatible version.
  Blaze._bind = _.bind;
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"exceptions.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/blaze/exceptions.js                                                                                        //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
var debugFunc; // We call into user code in many places, and it's nice to catch exceptions
// propagated from user code immediately so that the whole system doesn't just
// break.  Catching exceptions is easy; reporting them is hard.  This helper
// reports exceptions.
//
// Usage:
//
// ```
// try {
//   // ... someStuff ...
// } catch (e) {
//   reportUIException(e);
// }
// ```
//
// An optional second argument overrides the default message.
// Set this to `true` to cause `reportException` to throw
// the next exception rather than reporting it.  This is
// useful in unit tests that test error messages.

Blaze._throwNextException = false;

Blaze._reportException = function (e, msg) {
  if (Blaze._throwNextException) {
    Blaze._throwNextException = false;
    throw e;
  }

  if (!debugFunc) // adapted from Tracker
    debugFunc = function () {
      return typeof Meteor !== "undefined" ? Meteor._debug : typeof console !== "undefined" && console.log ? console.log : function () {};
    }; // In Chrome, `e.stack` is a multiline string that starts with the message
  // and contains a stack trace.  Furthermore, `console.log` makes it clickable.
  // `console.log` supplies the space between the two arguments.

  debugFunc()(msg || 'Exception caught in template:', e.stack || e.message || e);
};

Blaze._wrapCatchingExceptions = function (f, where) {
  if (typeof f !== 'function') return f;
  return function () {
    try {
      return f.apply(this, arguments);
    } catch (e) {
      Blaze._reportException(e, 'Exception in ' + where + ':');
    }
  };
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"view.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/blaze/view.js                                                                                              //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
/// [new] Blaze.View([name], renderMethod)
///
/// Blaze.View is the building block of reactive DOM.  Views have
/// the following features:
///
/// * lifecycle callbacks - Views are created, rendered, and destroyed,
///   and callbacks can be registered to fire when these things happen.
///
/// * parent pointer - A View points to its parentView, which is the
///   View that caused it to be rendered.  These pointers form a
///   hierarchy or tree of Views.
///
/// * render() method - A View's render() method specifies the DOM
///   (or HTML) content of the View.  If the method establishes
///   reactive dependencies, it may be re-run.
///
/// * a DOMRange - If a View is rendered to DOM, its position and
///   extent in the DOM are tracked using a DOMRange object.
///
/// When a View is constructed by calling Blaze.View, the View is
/// not yet considered "created."  It doesn't have a parentView yet,
/// and no logic has been run to initialize the View.  All real
/// work is deferred until at least creation time, when the onViewCreated
/// callbacks are fired, which happens when the View is "used" in
/// some way that requires it to be rendered.
///
/// ...more lifecycle stuff
///
/// `name` is an optional string tag identifying the View.  The only
/// time it's used is when looking in the View tree for a View of a
/// particular name; for example, data contexts are stored on Views
/// of name "with".  Names are also useful when debugging, so in
/// general it's good for functions that create Views to set the name.
/// Views associated with templates have names of the form "Template.foo".

/**
 * @class
 * @summary Constructor for a View, which represents a reactive region of DOM.
 * @locus Client
 * @param {String} [name] Optional.  A name for this type of View.  See [`view.name`](#view_name).
 * @param {Function} renderFunction A function that returns [*renderable content*](#Renderable-Content).  In this function, `this` is bound to the View.
 */
Blaze.View = function (name, render) {
  if (!(this instanceof Blaze.View)) // called without `new`
    return new Blaze.View(name, render);

  if (typeof name === 'function') {
    // omitted "name" argument
    render = name;
    name = '';
  }

  this.name = name;
  this._render = render;
  this._callbacks = {
    created: null,
    rendered: null,
    destroyed: null
  }; // Setting all properties here is good for readability,
  // and also may help Chrome optimize the code by keeping
  // the View object from changing shape too much.

  this.isCreated = false;
  this._isCreatedForExpansion = false;
  this.isRendered = false;
  this._isAttached = false;
  this.isDestroyed = false;
  this._isInRender = false;
  this.parentView = null;
  this._domrange = null; // This flag is normally set to false except for the cases when view's parent
  // was generated as part of expanding some syntactic sugar expressions or
  // methods.
  // Ex.: Blaze.renderWithData is an equivalent to creating a view with regular
  // Blaze.render and wrapping it into {{#with data}}{{/with}} view. Since the
  // users don't know anything about these generated parent views, Blaze needs
  // this information to be available on views to make smarter decisions. For
  // example: removing the generated parent view with the view on Blaze.remove.

  this._hasGeneratedParent = false; // Bindings accessible to children views (via view.lookup('name')) within the
  // closest template view.

  this._scopeBindings = {};
  this.renderCount = 0;
};

Blaze.View.prototype._render = function () {
  return null;
};

Blaze.View.prototype.onViewCreated = function (cb) {
  this._callbacks.created = this._callbacks.created || [];

  this._callbacks.created.push(cb);
};

Blaze.View.prototype._onViewRendered = function (cb) {
  this._callbacks.rendered = this._callbacks.rendered || [];

  this._callbacks.rendered.push(cb);
};

Blaze.View.prototype.onViewReady = function (cb) {
  var self = this;

  var fire = function () {
    Tracker.afterFlush(function () {
      if (!self.isDestroyed) {
        Blaze._withCurrentView(self, function () {
          cb.call(self);
        });
      }
    });
  };

  self._onViewRendered(function onViewRendered() {
    if (self.isDestroyed) return;
    if (!self._domrange.attached) self._domrange.onAttached(fire);else fire();
  });
};

Blaze.View.prototype.onViewDestroyed = function (cb) {
  this._callbacks.destroyed = this._callbacks.destroyed || [];

  this._callbacks.destroyed.push(cb);
};

Blaze.View.prototype.removeViewDestroyedListener = function (cb) {
  var destroyed = this._callbacks.destroyed;
  if (!destroyed) return;

  var index = _.lastIndexOf(destroyed, cb);

  if (index !== -1) {
    // XXX You'd think the right thing to do would be splice, but _fireCallbacks
    // gets sad if you remove callbacks while iterating over the list.  Should
    // change this to use callback-hook or EventEmitter or something else that
    // properly supports removal.
    destroyed[index] = null;
  }
}; /// View#autorun(func)
///
/// Sets up a Tracker autorun that is "scoped" to this View in two
/// important ways: 1) Blaze.currentView is automatically set
/// on every re-run, and 2) the autorun is stopped when the
/// View is destroyed.  As with Tracker.autorun, the first run of
/// the function is immediate, and a Computation object that can
/// be used to stop the autorun is returned.
///
/// View#autorun is meant to be called from View callbacks like
/// onViewCreated, or from outside the rendering process.  It may not
/// be called before the onViewCreated callbacks are fired (too early),
/// or from a render() method (too confusing).
///
/// Typically, autoruns that update the state
/// of the View (as in Blaze.With) should be started from an onViewCreated
/// callback.  Autoruns that update the DOM should be started
/// from either onViewCreated (guarded against the absence of
/// view._domrange), or onViewReady.


Blaze.View.prototype.autorun = function (f, _inViewScope, displayName) {
  var self = this; // The restrictions on when View#autorun can be called are in order
  // to avoid bad patterns, like creating a Blaze.View and immediately
  // calling autorun on it.  A freshly created View is not ready to
  // have logic run on it; it doesn't have a parentView, for example.
  // It's when the View is materialized or expanded that the onViewCreated
  // handlers are fired and the View starts up.
  //
  // Letting the render() method call `this.autorun()` is problematic
  // because of re-render.  The best we can do is to stop the old
  // autorun and start a new one for each render, but that's a pattern
  // we try to avoid internally because it leads to helpers being
  // called extra times, in the case where the autorun causes the
  // view to re-render (and thus the autorun to be torn down and a
  // new one established).
  //
  // We could lift these restrictions in various ways.  One interesting
  // idea is to allow you to call `view.autorun` after instantiating
  // `view`, and automatically wrap it in `view.onViewCreated`, deferring
  // the autorun so that it starts at an appropriate time.  However,
  // then we can't return the Computation object to the caller, because
  // it doesn't exist yet.

  if (!self.isCreated) {
    throw new Error("View#autorun must be called from the created callback at the earliest");
  }

  if (this._isInRender) {
    throw new Error("Can't call View#autorun from inside render(); try calling it from the created or rendered callback");
  }

  var templateInstanceFunc = Blaze.Template._currentTemplateInstanceFunc;

  var func = function viewAutorun(c) {
    return Blaze._withCurrentView(_inViewScope || self, function () {
      return Blaze.Template._withTemplateInstanceFunc(templateInstanceFunc, function () {
        return f.call(self, c);
      });
    });
  }; // Give the autorun function a better name for debugging and profiling.
  // The `displayName` property is not part of the spec but browsers like Chrome
  // and Firefox prefer it in debuggers over the name function was declared by.


  func.displayName = (self.name || 'anonymous') + ':' + (displayName || 'anonymous');
  var comp = Tracker.autorun(func);

  var stopComputation = function () {
    comp.stop();
  };

  self.onViewDestroyed(stopComputation);
  comp.onStop(function () {
    self.removeViewDestroyedListener(stopComputation);
  });
  return comp;
};

Blaze.View.prototype._errorIfShouldntCallSubscribe = function () {
  var self = this;

  if (!self.isCreated) {
    throw new Error("View#subscribe must be called from the created callback at the earliest");
  }

  if (self._isInRender) {
    throw new Error("Can't call View#subscribe from inside render(); try calling it from the created or rendered callback");
  }

  if (self.isDestroyed) {
    throw new Error("Can't call View#subscribe from inside the destroyed callback, try calling it inside created or rendered.");
  }
};
/**
 * Just like Blaze.View#autorun, but with Meteor.subscribe instead of
 * Tracker.autorun. Stop the subscription when the view is destroyed.
 * @return {SubscriptionHandle} A handle to the subscription so that you can
 * see if it is ready, or stop it manually
 */


Blaze.View.prototype.subscribe = function (args, options) {
  var self = this;
  options = options || {};

  self._errorIfShouldntCallSubscribe();

  var subHandle;

  if (options.connection) {
    subHandle = options.connection.subscribe.apply(options.connection, args);
  } else {
    subHandle = Meteor.subscribe.apply(Meteor, args);
  }

  self.onViewDestroyed(function () {
    subHandle.stop();
  });
  return subHandle;
};

Blaze.View.prototype.firstNode = function () {
  if (!this._isAttached) throw new Error("View must be attached before accessing its DOM");
  return this._domrange.firstNode();
};

Blaze.View.prototype.lastNode = function () {
  if (!this._isAttached) throw new Error("View must be attached before accessing its DOM");
  return this._domrange.lastNode();
};

Blaze._fireCallbacks = function (view, which) {
  Blaze._withCurrentView(view, function () {
    Tracker.nonreactive(function fireCallbacks() {
      var cbs = view._callbacks[which];

      for (var i = 0, N = cbs && cbs.length; i < N; i++) cbs[i] && cbs[i].call(view);
    });
  });
};

Blaze._createView = function (view, parentView, forExpansion) {
  if (view.isCreated) throw new Error("Can't render the same View twice");
  view.parentView = parentView || null;
  view.isCreated = true;
  if (forExpansion) view._isCreatedForExpansion = true;

  Blaze._fireCallbacks(view, 'created');
};

var doFirstRender = function (view, initialContent) {
  var domrange = new Blaze._DOMRange(initialContent);
  view._domrange = domrange;
  domrange.view = view;
  view.isRendered = true;

  Blaze._fireCallbacks(view, 'rendered');

  var teardownHook = null;
  domrange.onAttached(function attached(range, element) {
    view._isAttached = true;
    teardownHook = Blaze._DOMBackend.Teardown.onElementTeardown(element, function teardown() {
      Blaze._destroyView(view, true
      /* _skipNodes */
      );
    });
  }); // tear down the teardown hook

  view.onViewDestroyed(function () {
    teardownHook && teardownHook.stop();
    teardownHook = null;
  });
  return domrange;
}; // Take an uncreated View `view` and create and render it to DOM,
// setting up the autorun that updates the View.  Returns a new
// DOMRange, which has been associated with the View.
//
// The private arguments `_workStack` and `_intoArray` are passed in
// by Blaze._materializeDOM and are only present for recursive calls
// (when there is some other _materializeView on the stack).  If
// provided, then we avoid the mutual recursion of calling back into
// Blaze._materializeDOM so that deep View hierarchies don't blow the
// stack.  Instead, we push tasks onto workStack for the initial
// rendering and subsequent setup of the View, and they are done after
// we return.  When there is a _workStack, we do not return the new
// DOMRange, but instead push it into _intoArray from a _workStack
// task.


Blaze._materializeView = function (view, parentView, _workStack, _intoArray) {
  Blaze._createView(view, parentView);

  var domrange;
  var lastHtmljs; // We don't expect to be called in a Computation, but just in case,
  // wrap in Tracker.nonreactive.

  Tracker.nonreactive(function () {
    view.autorun(function doRender(c) {
      // `view.autorun` sets the current view.
      view.renderCount++;
      view._isInRender = true; // Any dependencies that should invalidate this Computation come
      // from this line:

      var htmljs = view._render();

      view._isInRender = false;

      if (!c.firstRun && !Blaze._isContentEqual(lastHtmljs, htmljs)) {
        Tracker.nonreactive(function doMaterialize() {
          // re-render
          var rangesAndNodes = Blaze._materializeDOM(htmljs, [], view);

          domrange.setMembers(rangesAndNodes);

          Blaze._fireCallbacks(view, 'rendered');
        });
      }

      lastHtmljs = htmljs; // Causes any nested views to stop immediately, not when we call
      // `setMembers` the next time around the autorun.  Otherwise,
      // helpers in the DOM tree to be replaced might be scheduled
      // to re-run before we have a chance to stop them.

      Tracker.onInvalidate(function () {
        if (domrange) {
          domrange.destroyMembers();
        }
      });
    }, undefined, 'materialize'); // first render.  lastHtmljs is the first htmljs.

    var initialContents;

    if (!_workStack) {
      initialContents = Blaze._materializeDOM(lastHtmljs, [], view);
      domrange = doFirstRender(view, initialContents);
      initialContents = null; // help GC because we close over this scope a lot
    } else {
      // We're being called from Blaze._materializeDOM, so to avoid
      // recursion and save stack space, provide a description of the
      // work to be done instead of doing it.  Tasks pushed onto
      // _workStack will be done in LIFO order after we return.
      // The work will still be done within a Tracker.nonreactive,
      // because it will be done by some call to Blaze._materializeDOM
      // (which is always called in a Tracker.nonreactive).
      initialContents = []; // push this function first so that it happens last

      _workStack.push(function () {
        domrange = doFirstRender(view, initialContents);
        initialContents = null; // help GC because of all the closures here

        _intoArray.push(domrange);
      }); // now push the task that calculates initialContents


      _workStack.push(Blaze._bind(Blaze._materializeDOM, null, lastHtmljs, initialContents, view, _workStack));
    }
  });

  if (!_workStack) {
    return domrange;
  } else {
    return null;
  }
}; // Expands a View to HTMLjs, calling `render` recursively on all
// Views and evaluating any dynamic attributes.  Calls the `created`
// callback, but not the `materialized` or `rendered` callbacks.
// Destroys the view immediately, unless called in a Tracker Computation,
// in which case the view will be destroyed when the Computation is
// invalidated.  If called in a Tracker Computation, the result is a
// reactive string; that is, the Computation will be invalidated
// if any changes are made to the view or subviews that might affect
// the HTML.


Blaze._expandView = function (view, parentView) {
  Blaze._createView(view, parentView, true
  /*forExpansion*/
  );

  view._isInRender = true;

  var htmljs = Blaze._withCurrentView(view, function () {
    return view._render();
  });

  view._isInRender = false;

  var result = Blaze._expand(htmljs, view);

  if (Tracker.active) {
    Tracker.onInvalidate(function () {
      Blaze._destroyView(view);
    });
  } else {
    Blaze._destroyView(view);
  }

  return result;
}; // Options: `parentView`


Blaze._HTMLJSExpander = HTML.TransformingVisitor.extend();

Blaze._HTMLJSExpander.def({
  visitObject: function (x) {
    if (x instanceof Blaze.Template) x = x.constructView();
    if (x instanceof Blaze.View) return Blaze._expandView(x, this.parentView); // this will throw an error; other objects are not allowed!

    return HTML.TransformingVisitor.prototype.visitObject.call(this, x);
  },
  visitAttributes: function (attrs) {
    // expand dynamic attributes
    if (typeof attrs === 'function') attrs = Blaze._withCurrentView(this.parentView, attrs); // call super (e.g. for case where `attrs` is an array)

    return HTML.TransformingVisitor.prototype.visitAttributes.call(this, attrs);
  },
  visitAttribute: function (name, value, tag) {
    // expand attribute values that are functions.  Any attribute value
    // that contains Views must be wrapped in a function.
    if (typeof value === 'function') value = Blaze._withCurrentView(this.parentView, value);
    return HTML.TransformingVisitor.prototype.visitAttribute.call(this, name, value, tag);
  }
}); // Return Blaze.currentView, but only if it is being rendered
// (i.e. we are in its render() method).


var currentViewIfRendering = function () {
  var view = Blaze.currentView;
  return view && view._isInRender ? view : null;
};

Blaze._expand = function (htmljs, parentView) {
  parentView = parentView || currentViewIfRendering();
  return new Blaze._HTMLJSExpander({
    parentView: parentView
  }).visit(htmljs);
};

Blaze._expandAttributes = function (attrs, parentView) {
  parentView = parentView || currentViewIfRendering();
  return new Blaze._HTMLJSExpander({
    parentView: parentView
  }).visitAttributes(attrs);
};

Blaze._destroyView = function (view, _skipNodes) {
  if (view.isDestroyed) return;
  view.isDestroyed = true;

  Blaze._fireCallbacks(view, 'destroyed'); // Destroy views and elements recursively.  If _skipNodes,
  // only recurse up to views, not elements, for the case where
  // the backend (jQuery) is recursing over the elements already.


  if (view._domrange) view._domrange.destroyMembers(_skipNodes);
};

Blaze._destroyNode = function (node) {
  if (node.nodeType === 1) Blaze._DOMBackend.Teardown.tearDownElement(node);
}; // Are the HTMLjs entities `a` and `b` the same?  We could be
// more elaborate here but the point is to catch the most basic
// cases.


Blaze._isContentEqual = function (a, b) {
  if (a instanceof HTML.Raw) {
    return b instanceof HTML.Raw && a.value === b.value;
  } else if (a == null) {
    return b == null;
  } else {
    return a === b && (typeof a === 'number' || typeof a === 'boolean' || typeof a === 'string');
  }
};
/**
 * @summary The View corresponding to the current template helper, event handler, callback, or autorun.  If there isn't one, `null`.
 * @locus Client
 * @type {Blaze.View}
 */


Blaze.currentView = null;

Blaze._withCurrentView = function (view, func) {
  var oldView = Blaze.currentView;

  try {
    Blaze.currentView = view;
    return func();
  } finally {
    Blaze.currentView = oldView;
  }
}; // Blaze.render publicly takes a View or a Template.
// Privately, it takes any HTMLJS (extended with Views and Templates)
// except null or undefined, or a function that returns any extended
// HTMLJS.


var checkRenderContent = function (content) {
  if (content === null) throw new Error("Can't render null");
  if (typeof content === 'undefined') throw new Error("Can't render undefined");
  if (content instanceof Blaze.View || content instanceof Blaze.Template || typeof content === 'function') return;

  try {
    // Throw if content doesn't look like HTMLJS at the top level
    // (i.e. verify that this is an HTML.Tag, or an array,
    // or a primitive, etc.)
    new HTML.Visitor().visit(content);
  } catch (e) {
    // Make error message suitable for public API
    throw new Error("Expected Template or View");
  }
}; // For Blaze.render and Blaze.toHTML, take content and
// wrap it in a View, unless it's a single View or
// Template already.


var contentAsView = function (content) {
  checkRenderContent(content);

  if (content instanceof Blaze.Template) {
    return content.constructView();
  } else if (content instanceof Blaze.View) {
    return content;
  } else {
    var func = content;

    if (typeof func !== 'function') {
      func = function () {
        return content;
      };
    }

    return Blaze.View('render', func);
  }
}; // For Blaze.renderWithData and Blaze.toHTMLWithData, wrap content
// in a function, if necessary, so it can be a content arg to
// a Blaze.With.


var contentAsFunc = function (content) {
  checkRenderContent(content);

  if (typeof content !== 'function') {
    return function () {
      return content;
    };
  } else {
    return content;
  }
};
/**
 * @summary Renders a template or View to DOM nodes and inserts it into the DOM, returning a rendered [View](#Blaze-View) which can be passed to [`Blaze.remove`](#Blaze-remove).
 * @locus Client
 * @param {Template|Blaze.View} templateOrView The template (e.g. `Template.myTemplate`) or View object to render.  If a template, a View object is [constructed](#template_constructview).  If a View, it must be an unrendered View, which becomes a rendered View and is returned.
 * @param {DOMNode} parentNode The node that will be the parent of the rendered template.  It must be an Element node.
 * @param {DOMNode} [nextNode] Optional. If provided, must be a child of <em>parentNode</em>; the template will be inserted before this node. If not provided, the template will be inserted as the last child of parentNode.
 * @param {Blaze.View} [parentView] Optional. If provided, it will be set as the rendered View's [`parentView`](#view_parentview).
 */


Blaze.render = function (content, parentElement, nextNode, parentView) {
  if (!parentElement) {
    Blaze._warn("Blaze.render without a parent element is deprecated. " + "You must specify where to insert the rendered content.");
  }

  if (nextNode instanceof Blaze.View) {
    // handle omitted nextNode
    parentView = nextNode;
    nextNode = null;
  } // parentElement must be a DOM node. in particular, can't be the
  // result of a call to `$`. Can't check if `parentElement instanceof
  // Node` since 'Node' is undefined in IE8.


  if (parentElement && typeof parentElement.nodeType !== 'number') throw new Error("'parentElement' must be a DOM node");
  if (nextNode && typeof nextNode.nodeType !== 'number') // 'nextNode' is optional
    throw new Error("'nextNode' must be a DOM node");
  parentView = parentView || currentViewIfRendering();
  var view = contentAsView(content);

  Blaze._materializeView(view, parentView);

  if (parentElement) {
    view._domrange.attach(parentElement, nextNode);
  }

  return view;
};

Blaze.insert = function (view, parentElement, nextNode) {
  Blaze._warn("Blaze.insert has been deprecated.  Specify where to insert the " + "rendered content in the call to Blaze.render.");

  if (!(view && view._domrange instanceof Blaze._DOMRange)) throw new Error("Expected template rendered with Blaze.render");

  view._domrange.attach(parentElement, nextNode);
};
/**
 * @summary Renders a template or View to DOM nodes with a data context.  Otherwise identical to `Blaze.render`.
 * @locus Client
 * @param {Template|Blaze.View} templateOrView The template (e.g. `Template.myTemplate`) or View object to render.
 * @param {Object|Function} data The data context to use, or a function returning a data context.  If a function is provided, it will be reactively re-run.
 * @param {DOMNode} parentNode The node that will be the parent of the rendered template.  It must be an Element node.
 * @param {DOMNode} [nextNode] Optional. If provided, must be a child of <em>parentNode</em>; the template will be inserted before this node. If not provided, the template will be inserted as the last child of parentNode.
 * @param {Blaze.View} [parentView] Optional. If provided, it will be set as the rendered View's [`parentView`](#view_parentview).
 */


Blaze.renderWithData = function (content, data, parentElement, nextNode, parentView) {
  // We defer the handling of optional arguments to Blaze.render.  At this point,
  // `nextNode` may actually be `parentView`.
  return Blaze.render(Blaze._TemplateWith(data, contentAsFunc(content)), parentElement, nextNode, parentView);
};
/**
 * @summary Removes a rendered View from the DOM, stopping all reactive updates and event listeners on it. Also destroys the Blaze.Template instance associated with the view.
 * @locus Client
 * @param {Blaze.View} renderedView The return value from `Blaze.render` or `Blaze.renderWithData`, or the `view` property of a Blaze.Template instance. Calling `Blaze.remove(Template.instance().view)` from within a template event handler will destroy the view as well as that template and trigger the template's `onDestroyed` handlers.
 */


Blaze.remove = function (view) {
  if (!(view && view._domrange instanceof Blaze._DOMRange)) throw new Error("Expected template rendered with Blaze.render");

  while (view) {
    if (!view.isDestroyed) {
      var range = view._domrange;
      if (range.attached && !range.parentRange) range.detach();
      range.destroy();
    }

    view = view._hasGeneratedParent && view.parentView;
  }
};
/**
 * @summary Renders a template or View to a string of HTML.
 * @locus Client
 * @param {Template|Blaze.View} templateOrView The template (e.g. `Template.myTemplate`) or View object from which to generate HTML.
 */


Blaze.toHTML = function (content, parentView) {
  parentView = parentView || currentViewIfRendering();
  return HTML.toHTML(Blaze._expandView(contentAsView(content), parentView));
};
/**
 * @summary Renders a template or View to HTML with a data context.  Otherwise identical to `Blaze.toHTML`.
 * @locus Client
 * @param {Template|Blaze.View} templateOrView The template (e.g. `Template.myTemplate`) or View object from which to generate HTML.
 * @param {Object|Function} data The data context to use, or a function returning a data context.
 */


Blaze.toHTMLWithData = function (content, data, parentView) {
  parentView = parentView || currentViewIfRendering();
  return HTML.toHTML(Blaze._expandView(Blaze._TemplateWith(data, contentAsFunc(content)), parentView));
};

Blaze._toText = function (htmljs, parentView, textMode) {
  if (typeof htmljs === 'function') throw new Error("Blaze._toText doesn't take a function, just HTMLjs");

  if (parentView != null && !(parentView instanceof Blaze.View)) {
    // omitted parentView argument
    textMode = parentView;
    parentView = null;
  }

  parentView = parentView || currentViewIfRendering();
  if (!textMode) throw new Error("textMode required");
  if (!(textMode === HTML.TEXTMODE.STRING || textMode === HTML.TEXTMODE.RCDATA || textMode === HTML.TEXTMODE.ATTRIBUTE)) throw new Error("Unknown textMode: " + textMode);
  return HTML.toText(Blaze._expand(htmljs, parentView), textMode);
};
/**
 * @summary Returns the current data context, or the data context that was used when rendering a particular DOM element or View from a Meteor template.
 * @locus Client
 * @param {DOMElement|Blaze.View} [elementOrView] Optional.  An element that was rendered by a Meteor, or a View.
 */


Blaze.getData = function (elementOrView) {
  var theWith;

  if (!elementOrView) {
    theWith = Blaze.getView('with');
  } else if (elementOrView instanceof Blaze.View) {
    var view = elementOrView;
    theWith = view.name === 'with' ? view : Blaze.getView(view, 'with');
  } else if (typeof elementOrView.nodeType === 'number') {
    if (elementOrView.nodeType !== 1) throw new Error("Expected DOM element");
    theWith = Blaze.getView(elementOrView, 'with');
  } else {
    throw new Error("Expected DOM element or View");
  }

  return theWith ? theWith.dataVar.get() : null;
}; // For back-compat


Blaze.getElementData = function (element) {
  Blaze._warn("Blaze.getElementData has been deprecated.  Use " + "Blaze.getData(element) instead.");

  if (element.nodeType !== 1) throw new Error("Expected DOM element");
  return Blaze.getData(element);
}; // Both arguments are optional.

/**
 * @summary Gets either the current View, or the View enclosing the given DOM element.
 * @locus Client
 * @param {DOMElement} [element] Optional.  If specified, the View enclosing `element` is returned.
 */


Blaze.getView = function (elementOrView, _viewName) {
  var viewName = _viewName;

  if (typeof elementOrView === 'string') {
    // omitted elementOrView; viewName present
    viewName = elementOrView;
    elementOrView = null;
  } // We could eventually shorten the code by folding the logic
  // from the other methods into this method.


  if (!elementOrView) {
    return Blaze._getCurrentView(viewName);
  } else if (elementOrView instanceof Blaze.View) {
    return Blaze._getParentView(elementOrView, viewName);
  } else if (typeof elementOrView.nodeType === 'number') {
    return Blaze._getElementView(elementOrView, viewName);
  } else {
    throw new Error("Expected DOM element or View");
  }
}; // Gets the current view or its nearest ancestor of name
// `name`.


Blaze._getCurrentView = function (name) {
  var view = Blaze.currentView; // Better to fail in cases where it doesn't make sense
  // to use Blaze._getCurrentView().  There will be a current
  // view anywhere it does.  You can check Blaze.currentView
  // if you want to know whether there is one or not.

  if (!view) throw new Error("There is no current view");

  if (name) {
    while (view && view.name !== name) view = view.parentView;

    return view || null;
  } else {
    // Blaze._getCurrentView() with no arguments just returns
    // Blaze.currentView.
    return view;
  }
};

Blaze._getParentView = function (view, name) {
  var v = view.parentView;

  if (name) {
    while (v && v.name !== name) v = v.parentView;
  }

  return v || null;
};

Blaze._getElementView = function (elem, name) {
  var range = Blaze._DOMRange.forElement(elem);

  var view = null;

  while (range && !view) {
    view = range.view || null;

    if (!view) {
      if (range.parentRange) range = range.parentRange;else range = Blaze._DOMRange.forElement(range.parentElement);
    }
  }

  if (name) {
    while (view && view.name !== name) view = view.parentView;

    return view || null;
  } else {
    return view;
  }
};

Blaze._addEventMap = function (view, eventMap, thisInHandler) {
  thisInHandler = thisInHandler || null;
  var handles = [];
  if (!view._domrange) throw new Error("View must have a DOMRange");

  view._domrange.onAttached(function attached_eventMaps(range, element) {
    _.each(eventMap, function (handler, spec) {
      var clauses = spec.split(/,\s+/); // iterate over clauses of spec, e.g. ['click .foo', 'click .bar']

      _.each(clauses, function (clause) {
        var parts = clause.split(/\s+/);
        if (parts.length === 0) return;
        var newEvents = parts.shift();
        var selector = parts.join(' ');
        handles.push(Blaze._EventSupport.listen(element, newEvents, selector, function (evt) {
          if (!range.containsElement(evt.currentTarget)) return null;
          var handlerThis = thisInHandler || this;
          var handlerArgs = arguments;
          return Blaze._withCurrentView(view, function () {
            return handler.apply(handlerThis, handlerArgs);
          });
        }, range, function (r) {
          return r.parentRange;
        }));
      });
    });
  });

  view.onViewDestroyed(function () {
    _.each(handles, function (h) {
      h.stop();
    });

    handles.length = 0;
  });
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"builtins.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/blaze/builtins.js                                                                                          //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Blaze._calculateCondition = function (cond) {
  if (cond instanceof Array && cond.length === 0) cond = false;
  return !!cond;
};
/**
 * @summary Constructs a View that renders content with a data context.
 * @locus Client
 * @param {Object|Function} data An object to use as the data context, or a function returning such an object.  If a function is provided, it will be reactively re-run.
 * @param {Function} contentFunc A Function that returns [*renderable content*](#Renderable-Content).
 */


Blaze.With = function (data, contentFunc) {
  var view = Blaze.View('with', contentFunc);
  view.dataVar = new ReactiveVar();
  view.onViewCreated(function () {
    if (typeof data === 'function') {
      // `data` is a reactive function
      view.autorun(function () {
        view.dataVar.set(data());
      }, view.parentView, 'setData');
    } else {
      view.dataVar.set(data);
    }
  });
  return view;
};
/**
 * Attaches bindings to the instantiated view.
 * @param {Object} bindings A dictionary of bindings, each binding name
 * corresponds to a value or a function that will be reactively re-run.
 * @param {View} view The target.
 */


Blaze._attachBindingsToView = function (bindings, view) {
  view.onViewCreated(function () {
    _.each(bindings, function (binding, name) {
      view._scopeBindings[name] = new ReactiveVar();

      if (typeof binding === 'function') {
        view.autorun(function () {
          view._scopeBindings[name].set(binding());
        }, view.parentView);
      } else {
        view._scopeBindings[name].set(binding);
      }
    });
  });
};
/**
 * @summary Constructs a View setting the local lexical scope in the block.
 * @param {Function} bindings Dictionary mapping names of bindings to
 * values or computations to reactively re-run.
 * @param {Function} contentFunc A Function that returns [*renderable content*](#Renderable-Content).
 */


Blaze.Let = function (bindings, contentFunc) {
  var view = Blaze.View('let', contentFunc);

  Blaze._attachBindingsToView(bindings, view);

  return view;
};
/**
 * @summary Constructs a View that renders content conditionally.
 * @locus Client
 * @param {Function} conditionFunc A function to reactively re-run.  Whether the result is truthy or falsy determines whether `contentFunc` or `elseFunc` is shown.  An empty array is considered falsy.
 * @param {Function} contentFunc A Function that returns [*renderable content*](#Renderable-Content).
 * @param {Function} [elseFunc] Optional.  A Function that returns [*renderable content*](#Renderable-Content).  If no `elseFunc` is supplied, no content is shown in the "else" case.
 */


Blaze.If = function (conditionFunc, contentFunc, elseFunc, _not) {
  var conditionVar = new ReactiveVar();
  var view = Blaze.View(_not ? 'unless' : 'if', function () {
    return conditionVar.get() ? contentFunc() : elseFunc ? elseFunc() : null;
  });
  view.__conditionVar = conditionVar;
  view.onViewCreated(function () {
    this.autorun(function () {
      var cond = Blaze._calculateCondition(conditionFunc());

      conditionVar.set(_not ? !cond : cond);
    }, this.parentView, 'condition');
  });
  return view;
};
/**
 * @summary An inverted [`Blaze.If`](#Blaze-If).
 * @locus Client
 * @param {Function} conditionFunc A function to reactively re-run.  If the result is falsy, `contentFunc` is shown, otherwise `elseFunc` is shown.  An empty array is considered falsy.
 * @param {Function} contentFunc A Function that returns [*renderable content*](#Renderable-Content).
 * @param {Function} [elseFunc] Optional.  A Function that returns [*renderable content*](#Renderable-Content).  If no `elseFunc` is supplied, no content is shown in the "else" case.
 */


Blaze.Unless = function (conditionFunc, contentFunc, elseFunc) {
  return Blaze.If(conditionFunc, contentFunc, elseFunc, true
  /*_not*/
  );
};
/**
 * @summary Constructs a View that renders `contentFunc` for each item in a sequence.
 * @locus Client
 * @param {Function} argFunc A function to reactively re-run. The function can
 * return one of two options:
 *
 * 1. An object with two fields: '_variable' and '_sequence'. Each iterates over
 *   '_sequence', it may be a Cursor, an array, null, or undefined. Inside the
 *   Each body you will be able to get the current item from the sequence using
 *   the name specified in the '_variable' field.
 *
 * 2. Just a sequence (Cursor, array, null, or undefined) not wrapped into an
 *   object. Inside the Each body, the current item will be set as the data
 *   context.
 * @param {Function} contentFunc A Function that returns  [*renderable
 * content*](#Renderable-Content).
 * @param {Function} [elseFunc] A Function that returns [*renderable
 * content*](#Renderable-Content) to display in the case when there are no items
 * in the sequence.
 */


Blaze.Each = function (argFunc, contentFunc, elseFunc) {
  var eachView = Blaze.View('each', function () {
    var subviews = this.initialSubviews;
    this.initialSubviews = null;

    if (this._isCreatedForExpansion) {
      this.expandedValueDep = new Tracker.Dependency();
      this.expandedValueDep.depend();
    }

    return subviews;
  });
  eachView.initialSubviews = [];
  eachView.numItems = 0;
  eachView.inElseMode = false;
  eachView.stopHandle = null;
  eachView.contentFunc = contentFunc;
  eachView.elseFunc = elseFunc;
  eachView.argVar = new ReactiveVar();
  eachView.variableName = null; // update the @index value in the scope of all subviews in the range

  var updateIndices = function (from, to) {
    if (to === undefined) {
      to = eachView.numItems - 1;
    }

    for (var i = from; i <= to; i++) {
      var view = eachView._domrange.members[i].view;

      view._scopeBindings['@index'].set(i);
    }
  };

  eachView.onViewCreated(function () {
    // We evaluate argFunc in an autorun to make sure
    // Blaze.currentView is always set when it runs (rather than
    // passing argFunc straight to ObserveSequence).
    eachView.autorun(function () {
      // argFunc can return either a sequence as is or a wrapper object with a
      // _sequence and _variable fields set.
      var arg = argFunc();

      if (_.isObject(arg) && _.has(arg, '_sequence')) {
        eachView.variableName = arg._variable || null;
        arg = arg._sequence;
      }

      eachView.argVar.set(arg);
    }, eachView.parentView, 'collection');
    eachView.stopHandle = ObserveSequence.observe(function () {
      return eachView.argVar.get();
    }, {
      addedAt: function (id, item, index) {
        Tracker.nonreactive(function () {
          var newItemView;

          if (eachView.variableName) {
            // new-style #each (as in {{#each item in items}})
            // doesn't create a new data context
            newItemView = Blaze.View('item', eachView.contentFunc);
          } else {
            newItemView = Blaze.With(item, eachView.contentFunc);
          }

          eachView.numItems++;
          var bindings = {};
          bindings['@index'] = index;

          if (eachView.variableName) {
            bindings[eachView.variableName] = item;
          }

          Blaze._attachBindingsToView(bindings, newItemView);

          if (eachView.expandedValueDep) {
            eachView.expandedValueDep.changed();
          } else if (eachView._domrange) {
            if (eachView.inElseMode) {
              eachView._domrange.removeMember(0);

              eachView.inElseMode = false;
            }

            var range = Blaze._materializeView(newItemView, eachView);

            eachView._domrange.addMember(range, index);

            updateIndices(index);
          } else {
            eachView.initialSubviews.splice(index, 0, newItemView);
          }
        });
      },
      removedAt: function (id, item, index) {
        Tracker.nonreactive(function () {
          eachView.numItems--;

          if (eachView.expandedValueDep) {
            eachView.expandedValueDep.changed();
          } else if (eachView._domrange) {
            eachView._domrange.removeMember(index);

            updateIndices(index);

            if (eachView.elseFunc && eachView.numItems === 0) {
              eachView.inElseMode = true;

              eachView._domrange.addMember(Blaze._materializeView(Blaze.View('each_else', eachView.elseFunc), eachView), 0);
            }
          } else {
            eachView.initialSubviews.splice(index, 1);
          }
        });
      },
      changedAt: function (id, newItem, oldItem, index) {
        Tracker.nonreactive(function () {
          if (eachView.expandedValueDep) {
            eachView.expandedValueDep.changed();
          } else {
            var itemView;

            if (eachView._domrange) {
              itemView = eachView._domrange.getMember(index).view;
            } else {
              itemView = eachView.initialSubviews[index];
            }

            if (eachView.variableName) {
              itemView._scopeBindings[eachView.variableName].set(newItem);
            } else {
              itemView.dataVar.set(newItem);
            }
          }
        });
      },
      movedTo: function (id, item, fromIndex, toIndex) {
        Tracker.nonreactive(function () {
          if (eachView.expandedValueDep) {
            eachView.expandedValueDep.changed();
          } else if (eachView._domrange) {
            eachView._domrange.moveMember(fromIndex, toIndex);

            updateIndices(Math.min(fromIndex, toIndex), Math.max(fromIndex, toIndex));
          } else {
            var subviews = eachView.initialSubviews;
            var itemView = subviews[fromIndex];
            subviews.splice(fromIndex, 1);
            subviews.splice(toIndex, 0, itemView);
          }
        });
      }
    });

    if (eachView.elseFunc && eachView.numItems === 0) {
      eachView.inElseMode = true;
      eachView.initialSubviews[0] = Blaze.View('each_else', eachView.elseFunc);
    }
  });
  eachView.onViewDestroyed(function () {
    if (eachView.stopHandle) eachView.stopHandle.stop();
  });
  return eachView;
};

Blaze._TemplateWith = function (arg, contentFunc) {
  var w;
  var argFunc = arg;

  if (typeof arg !== 'function') {
    argFunc = function () {
      return arg;
    };
  } // This is a little messy.  When we compile `{{> Template.contentBlock}}`, we
  // wrap it in Blaze._InOuterTemplateScope in order to skip the intermediate
  // parent Views in the current template.  However, when there's an argument
  // (`{{> Template.contentBlock arg}}`), the argument needs to be evaluated
  // in the original scope.  There's no good order to nest
  // Blaze._InOuterTemplateScope and Spacebars.TemplateWith to achieve this,
  // so we wrap argFunc to run it in the "original parentView" of the
  // Blaze._InOuterTemplateScope.
  //
  // To make this better, reconsider _InOuterTemplateScope as a primitive.
  // Longer term, evaluate expressions in the proper lexical scope.


  var wrappedArgFunc = function () {
    var viewToEvaluateArg = null;

    if (w.parentView && w.parentView.name === 'InOuterTemplateScope') {
      viewToEvaluateArg = w.parentView.originalParentView;
    }

    if (viewToEvaluateArg) {
      return Blaze._withCurrentView(viewToEvaluateArg, argFunc);
    } else {
      return argFunc();
    }
  };

  var wrappedContentFunc = function () {
    var content = contentFunc.call(this); // Since we are generating the Blaze._TemplateWith view for the
    // user, set the flag on the child view.  If `content` is a template,
    // construct the View so that we can set the flag.

    if (content instanceof Blaze.Template) {
      content = content.constructView();
    }

    if (content instanceof Blaze.View) {
      content._hasGeneratedParent = true;
    }

    return content;
  };

  w = Blaze.With(wrappedArgFunc, wrappedContentFunc);
  w.__isTemplateWith = true;
  return w;
};

Blaze._InOuterTemplateScope = function (templateView, contentFunc) {
  var view = Blaze.View('InOuterTemplateScope', contentFunc);
  var parentView = templateView.parentView; // Hack so that if you call `{{> foo bar}}` and it expands into
  // `{{#with bar}}{{> foo}}{{/with}}`, and then `foo` is a template
  // that inserts `{{> Template.contentBlock}}`, the data context for
  // `Template.contentBlock` is not `bar` but the one enclosing that.

  if (parentView.__isTemplateWith) parentView = parentView.parentView;
  view.onViewCreated(function () {
    this.originalParentView = this.parentView;
    this.parentView = parentView;
    this.__childDoesntStartNewLexicalScope = true;
  });
  return view;
}; // XXX COMPAT WITH 0.9.0


Blaze.InOuterTemplateScope = Blaze._InOuterTemplateScope;
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"lookup.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/blaze/lookup.js                                                                                            //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Blaze._globalHelpers = {}; // Documented as Template.registerHelper.
// This definition also provides back-compat for `UI.registerHelper`.

Blaze.registerHelper = function (name, func) {
  Blaze._globalHelpers[name] = func;
}; // Also documented as Template.deregisterHelper


Blaze.deregisterHelper = function (name) {
  delete Blaze._globalHelpers[name];
};

var bindIfIsFunction = function (x, target) {
  if (typeof x !== 'function') return x;
  return Blaze._bind(x, target);
}; // If `x` is a function, binds the value of `this` for that function
// to the current data context.


var bindDataContext = function (x) {
  if (typeof x === 'function') {
    return function () {
      var data = Blaze.getData();
      if (data == null) data = {};
      return x.apply(data, arguments);
    };
  }

  return x;
};

Blaze._OLDSTYLE_HELPER = {};

Blaze._getTemplateHelper = function (template, name, tmplInstanceFunc) {
  // XXX COMPAT WITH 0.9.3
  var isKnownOldStyleHelper = false;

  if (template.__helpers.has(name)) {
    var helper = template.__helpers.get(name);

    if (helper === Blaze._OLDSTYLE_HELPER) {
      isKnownOldStyleHelper = true;
    } else if (helper != null) {
      return wrapHelper(bindDataContext(helper), tmplInstanceFunc);
    } else {
      return null;
    }
  } // old-style helper


  if (name in template) {
    // Only warn once per helper
    if (!isKnownOldStyleHelper) {
      template.__helpers.set(name, Blaze._OLDSTYLE_HELPER);

      if (!template._NOWARN_OLDSTYLE_HELPERS) {
        Blaze._warn('Assigning helper with `' + template.viewName + '.' + name + ' = ...` is deprecated.  Use `' + template.viewName + '.helpers(...)` instead.');
      }
    }

    if (template[name] != null) {
      return wrapHelper(bindDataContext(template[name]), tmplInstanceFunc);
    }
  }

  return null;
};

var wrapHelper = function (f, templateFunc) {
  if (typeof f !== "function") {
    return f;
  }

  return function () {
    var self = this;
    var args = arguments;
    return Blaze.Template._withTemplateInstanceFunc(templateFunc, function () {
      return Blaze._wrapCatchingExceptions(f, 'template helper').apply(self, args);
    });
  };
};

Blaze._lexicalBindingLookup = function (view, name) {
  var currentView = view;
  var blockHelpersStack = []; // walk up the views stopping at a Spacebars.include or Template view that
  // doesn't have an InOuterTemplateScope view as a parent

  do {
    // skip block helpers views
    // if we found the binding on the scope, return it
    if (_.has(currentView._scopeBindings, name)) {
      var bindingReactiveVar = currentView._scopeBindings[name];
      return function () {
        return bindingReactiveVar.get();
      };
    }
  } while (!(currentView.__startsNewLexicalScope && !(currentView.parentView && currentView.parentView.__childDoesntStartNewLexicalScope)) && (currentView = currentView.parentView));

  return null;
}; // templateInstance argument is provided to be available for possible
// alternative implementations of this function by 3rd party packages.


Blaze._getTemplate = function (name, templateInstance) {
  if (name in Blaze.Template && Blaze.Template[name] instanceof Blaze.Template) {
    return Blaze.Template[name];
  }

  return null;
};

Blaze._getGlobalHelper = function (name, templateInstance) {
  if (Blaze._globalHelpers[name] != null) {
    return wrapHelper(bindDataContext(Blaze._globalHelpers[name]), templateInstance);
  }

  return null;
}; // Looks up a name, like "foo" or "..", as a helper of the
// current template; the name of a template; a global helper;
// or a property of the data context.  Called on the View of
// a template (i.e. a View with a `.template` property,
// where the helpers are).  Used for the first name in a
// "path" in a template tag, like "foo" in `{{foo.bar}}` or
// ".." in `{{frobulate ../blah}}`.
//
// Returns a function, a non-function value, or null.  If
// a function is found, it is bound appropriately.
//
// NOTE: This function must not establish any reactive
// dependencies itself.  If there is any reactivity in the
// value, lookup should return a function.


Blaze.View.prototype.lookup = function (name, _options) {
  var template = this.template;
  var lookupTemplate = _options && _options.template;
  var helper;
  var binding;
  var boundTmplInstance;
  var foundTemplate;

  if (this.templateInstance) {
    boundTmplInstance = Blaze._bind(this.templateInstance, this);
  } // 0. looking up the parent data context with the special "../" syntax


  if (/^\./.test(name)) {
    // starts with a dot. must be a series of dots which maps to an
    // ancestor of the appropriate height.
    if (!/^(\.)+$/.test(name)) throw new Error("id starting with dot must be a series of dots");
    return Blaze._parentData(name.length - 1, true
    /*_functionWrapped*/
    );
  } // 1. look up a helper on the current template


  if (template && (helper = Blaze._getTemplateHelper(template, name, boundTmplInstance)) != null) {
    return helper;
  } // 2. look up a binding by traversing the lexical view hierarchy inside the
  // current template


  if (template && (binding = Blaze._lexicalBindingLookup(Blaze.currentView, name)) != null) {
    return binding;
  } // 3. look up a template by name


  if (lookupTemplate && (foundTemplate = Blaze._getTemplate(name, boundTmplInstance)) != null) {
    return foundTemplate;
  } // 4. look up a global helper


  if ((helper = Blaze._getGlobalHelper(name, boundTmplInstance)) != null) {
    return helper;
  } // 5. look up in a data context


  return function () {
    var isCalledAsFunction = arguments.length > 0;
    var data = Blaze.getData();
    var x = data && data[name];

    if (!x) {
      if (lookupTemplate) {
        throw new Error("No such template: " + name);
      } else if (isCalledAsFunction) {
        throw new Error("No such function: " + name);
      } else if (name.charAt(0) === '@' && (x === null || x === undefined)) {
        // Throw an error if the user tries to use a `@directive`
        // that doesn't exist.  We don't implement all directives
        // from Handlebars, so there's a potential for confusion
        // if we fail silently.  On the other hand, we want to
        // throw late in case some app or package wants to provide
        // a missing directive.
        throw new Error("Unsupported directive: " + name);
      }
    }

    if (!data) {
      return null;
    }

    if (typeof x !== 'function') {
      if (isCalledAsFunction) {
        throw new Error("Can't call non-function: " + x);
      }

      return x;
    }

    return x.apply(data, arguments);
  };
}; // Implement Spacebars' {{../..}}.
// @param height {Number} The number of '..'s


Blaze._parentData = function (height, _functionWrapped) {
  // If height is null or undefined, we default to 1, the first parent.
  if (height == null) {
    height = 1;
  }

  var theWith = Blaze.getView('with');

  for (var i = 0; i < height && theWith; i++) {
    theWith = Blaze.getView(theWith, 'with');
  }

  if (!theWith) return null;
  if (_functionWrapped) return function () {
    return theWith.dataVar.get();
  };
  return theWith.dataVar.get();
};

Blaze.View.prototype.lookupTemplate = function (name) {
  return this.lookup(name, {
    template: true
  });
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"template.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/blaze/template.js                                                                                          //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
// [new] Blaze.Template([viewName], renderFunction)
//
// `Blaze.Template` is the class of templates, like `Template.foo` in
// Meteor, which is `instanceof Template`.
//
// `viewKind` is a string that looks like "Template.foo" for templates
// defined by the compiler.

/**
 * @class
 * @summary Constructor for a Template, which is used to construct Views with particular name and content.
 * @locus Client
 * @param {String} [viewName] Optional.  A name for Views constructed by this Template.  See [`view.name`](#view_name).
 * @param {Function} renderFunction A function that returns [*renderable content*](#Renderable-Content).  This function is used as the `renderFunction` for Views constructed by this Template.
 */
Blaze.Template = function (viewName, renderFunction) {
  if (!(this instanceof Blaze.Template)) // called without `new`
    return new Blaze.Template(viewName, renderFunction);

  if (typeof viewName === 'function') {
    // omitted "viewName" argument
    renderFunction = viewName;
    viewName = '';
  }

  if (typeof viewName !== 'string') throw new Error("viewName must be a String (or omitted)");
  if (typeof renderFunction !== 'function') throw new Error("renderFunction must be a function");
  this.viewName = viewName;
  this.renderFunction = renderFunction;
  this.__helpers = new HelperMap();
  this.__eventMaps = [];
  this._callbacks = {
    created: [],
    rendered: [],
    destroyed: []
  };
};

var Template = Blaze.Template;

var HelperMap = function () {};

HelperMap.prototype.get = function (name) {
  return this[' ' + name];
};

HelperMap.prototype.set = function (name, helper) {
  this[' ' + name] = helper;
};

HelperMap.prototype.has = function (name) {
  return typeof this[' ' + name] !== 'undefined';
};
/**
 * @summary Returns true if `value` is a template object like `Template.myTemplate`.
 * @locus Client
 * @param {Any} value The value to test.
 */


Blaze.isTemplate = function (t) {
  return t instanceof Blaze.Template;
};
/**
 * @name  onCreated
 * @instance
 * @memberOf Template
 * @summary Register a function to be called when an instance of this template is created.
 * @param {Function} callback A function to be added as a callback.
 * @locus Client
 * @importFromPackage templating
 */


Template.prototype.onCreated = function (cb) {
  this._callbacks.created.push(cb);
};
/**
 * @name  onRendered
 * @instance
 * @memberOf Template
 * @summary Register a function to be called when an instance of this template is inserted into the DOM.
 * @param {Function} callback A function to be added as a callback.
 * @locus Client
 * @importFromPackage templating
 */


Template.prototype.onRendered = function (cb) {
  this._callbacks.rendered.push(cb);
};
/**
 * @name  onDestroyed
 * @instance
 * @memberOf Template
 * @summary Register a function to be called when an instance of this template is removed from the DOM and destroyed.
 * @param {Function} callback A function to be added as a callback.
 * @locus Client
 * @importFromPackage templating
 */


Template.prototype.onDestroyed = function (cb) {
  this._callbacks.destroyed.push(cb);
};

Template.prototype._getCallbacks = function (which) {
  var self = this;
  var callbacks = self[which] ? [self[which]] : []; // Fire all callbacks added with the new API (Template.onRendered())
  // as well as the old-style callback (e.g. Template.rendered) for
  // backwards-compatibility.

  callbacks = callbacks.concat(self._callbacks[which]);
  return callbacks;
};

var fireCallbacks = function (callbacks, template) {
  Template._withTemplateInstanceFunc(function () {
    return template;
  }, function () {
    for (var i = 0, N = callbacks.length; i < N; i++) {
      callbacks[i].call(template);
    }
  });
};

Template.prototype.constructView = function (contentFunc, elseFunc) {
  var self = this;
  var view = Blaze.View(self.viewName, self.renderFunction);
  view.template = self;
  view.templateContentBlock = contentFunc ? new Template('(contentBlock)', contentFunc) : null;
  view.templateElseBlock = elseFunc ? new Template('(elseBlock)', elseFunc) : null;

  if (self.__eventMaps || typeof self.events === 'object') {
    view._onViewRendered(function () {
      if (view.renderCount !== 1) return;

      if (!self.__eventMaps.length && typeof self.events === "object") {
        // Provide limited back-compat support for `.events = {...}`
        // syntax.  Pass `template.events` to the original `.events(...)`
        // function.  This code must run only once per template, in
        // order to not bind the handlers more than once, which is
        // ensured by the fact that we only do this when `__eventMaps`
        // is falsy, and we cause it to be set now.
        Template.prototype.events.call(self, self.events);
      }

      _.each(self.__eventMaps, function (m) {
        Blaze._addEventMap(view, m, view);
      });
    });
  }

  view._templateInstance = new Blaze.TemplateInstance(view);

  view.templateInstance = function () {
    // Update data, firstNode, and lastNode, and return the TemplateInstance
    // object.
    var inst = view._templateInstance;
    /**
     * @instance
     * @memberOf Blaze.TemplateInstance
     * @name  data
     * @summary The data context of this instance's latest invocation.
     * @locus Client
     */

    inst.data = Blaze.getData(view);

    if (view._domrange && !view.isDestroyed) {
      inst.firstNode = view._domrange.firstNode();
      inst.lastNode = view._domrange.lastNode();
    } else {
      // on 'created' or 'destroyed' callbacks we don't have a DomRange
      inst.firstNode = null;
      inst.lastNode = null;
    }

    return inst;
  };
  /**
   * @name  created
   * @instance
   * @memberOf Template
   * @summary Provide a callback when an instance of a template is created.
   * @locus Client
   * @deprecated in 1.1
   */
  // To avoid situations when new callbacks are added in between view
  // instantiation and event being fired, decide on all callbacks to fire
  // immediately and then fire them on the event.


  var createdCallbacks = self._getCallbacks('created');

  view.onViewCreated(function () {
    fireCallbacks(createdCallbacks, view.templateInstance());
  });
  /**
   * @name  rendered
   * @instance
   * @memberOf Template
   * @summary Provide a callback when an instance of a template is rendered.
   * @locus Client
   * @deprecated in 1.1
   */

  var renderedCallbacks = self._getCallbacks('rendered');

  view.onViewReady(function () {
    fireCallbacks(renderedCallbacks, view.templateInstance());
  });
  /**
   * @name  destroyed
   * @instance
   * @memberOf Template
   * @summary Provide a callback when an instance of a template is destroyed.
   * @locus Client
   * @deprecated in 1.1
   */

  var destroyedCallbacks = self._getCallbacks('destroyed');

  view.onViewDestroyed(function () {
    fireCallbacks(destroyedCallbacks, view.templateInstance());
  });
  return view;
};
/**
 * @class
 * @summary The class for template instances
 * @param {Blaze.View} view
 * @instanceName template
 */


Blaze.TemplateInstance = function (view) {
  if (!(this instanceof Blaze.TemplateInstance)) // called without `new`
    return new Blaze.TemplateInstance(view);
  if (!(view instanceof Blaze.View)) throw new Error("View required");
  view._templateInstance = this;
  /**
   * @name view
   * @memberOf Blaze.TemplateInstance
   * @instance
   * @summary The [View](../api/blaze.html#Blaze-View) object for this invocation of the template.
   * @locus Client
   * @type {Blaze.View}
   */

  this.view = view;
  this.data = null;
  /**
   * @name firstNode
   * @memberOf Blaze.TemplateInstance
   * @instance
   * @summary The first top-level DOM node in this template instance.
   * @locus Client
   * @type {DOMNode}
   */

  this.firstNode = null;
  /**
   * @name lastNode
   * @memberOf Blaze.TemplateInstance
   * @instance
   * @summary The last top-level DOM node in this template instance.
   * @locus Client
   * @type {DOMNode}
   */

  this.lastNode = null; // This dependency is used to identify state transitions in
  // _subscriptionHandles which could cause the result of
  // TemplateInstance#subscriptionsReady to change. Basically this is triggered
  // whenever a new subscription handle is added or when a subscription handle
  // is removed and they are not ready.

  this._allSubsReadyDep = new Tracker.Dependency();
  this._allSubsReady = false;
  this._subscriptionHandles = {};
};
/**
 * @summary Find all elements matching `selector` in this template instance, and return them as a JQuery object.
 * @locus Client
 * @param {String} selector The CSS selector to match, scoped to the template contents.
 * @returns {DOMNode[]}
 */


Blaze.TemplateInstance.prototype.$ = function (selector) {
  var view = this.view;
  if (!view._domrange) throw new Error("Can't use $ on template instance with no DOM");
  return view._domrange.$(selector);
};
/**
 * @summary Find all elements matching `selector` in this template instance.
 * @locus Client
 * @param {String} selector The CSS selector to match, scoped to the template contents.
 * @returns {DOMElement[]}
 */


Blaze.TemplateInstance.prototype.findAll = function (selector) {
  return Array.prototype.slice.call(this.$(selector));
};
/**
 * @summary Find one element matching `selector` in this template instance.
 * @locus Client
 * @param {String} selector The CSS selector to match, scoped to the template contents.
 * @returns {DOMElement}
 */


Blaze.TemplateInstance.prototype.find = function (selector) {
  var result = this.$(selector);
  return result[0] || null;
};
/**
 * @summary A version of [Tracker.autorun](https://docs.meteor.com/api/tracker.html#Tracker-autorun) that is stopped when the template is destroyed.
 * @locus Client
 * @param {Function} runFunc The function to run. It receives one argument: a Tracker.Computation object.
 */


Blaze.TemplateInstance.prototype.autorun = function (f) {
  return this.view.autorun(f);
};
/**
 * @summary A version of [Meteor.subscribe](https://docs.meteor.com/api/pubsub.html#Meteor-subscribe) that is stopped
 * when the template is destroyed.
 * @return {SubscriptionHandle} The subscription handle to the newly made
 * subscription. Call `handle.stop()` to manually stop the subscription, or
 * `handle.ready()` to find out if this particular subscription has loaded all
 * of its inital data.
 * @locus Client
 * @param {String} name Name of the subscription.  Matches the name of the
 * server's `publish()` call.
 * @param {Any} [arg1,arg2...] Optional arguments passed to publisher function
 * on server.
 * @param {Function|Object} [options] If a function is passed instead of an
 * object, it is interpreted as an `onReady` callback.
 * @param {Function} [options.onReady] Passed to [`Meteor.subscribe`](https://docs.meteor.com/api/pubsub.html#Meteor-subscribe).
 * @param {Function} [options.onStop] Passed to [`Meteor.subscribe`](https://docs.meteor.com/api/pubsub.html#Meteor-subscribe).
 * @param {DDP.Connection} [options.connection] The connection on which to make the
 * subscription.
 */


Blaze.TemplateInstance.prototype.subscribe = function ()
/* arguments */
{
  var self = this;
  var subHandles = self._subscriptionHandles;

  var args = _.toArray(arguments); // Duplicate logic from Meteor.subscribe


  var options = {};

  if (args.length) {
    var lastParam = _.last(args); // Match pattern to check if the last arg is an options argument


    var lastParamOptionsPattern = {
      onReady: Match.Optional(Function),
      // XXX COMPAT WITH 1.0.3.1 onError used to exist, but now we use
      // onStop with an error callback instead.
      onError: Match.Optional(Function),
      onStop: Match.Optional(Function),
      connection: Match.Optional(Match.Any)
    };

    if (_.isFunction(lastParam)) {
      options.onReady = args.pop();
    } else if (lastParam && !_.isEmpty(lastParam) && Match.test(lastParam, lastParamOptionsPattern)) {
      options = args.pop();
    }
  }

  var subHandle;
  var oldStopped = options.onStop;

  options.onStop = function (error) {
    // When the subscription is stopped, remove it from the set of tracked
    // subscriptions to avoid this list growing without bound
    delete subHandles[subHandle.subscriptionId]; // Removing a subscription can only change the result of subscriptionsReady
    // if we are not ready (that subscription could be the one blocking us being
    // ready).

    if (!self._allSubsReady) {
      self._allSubsReadyDep.changed();
    }

    if (oldStopped) {
      oldStopped(error);
    }
  };

  var connection = options.connection;

  var callbacks = _.pick(options, ["onReady", "onError", "onStop"]); // The callbacks are passed as the last item in the arguments array passed to
  // View#subscribe


  args.push(callbacks); // View#subscribe takes the connection as one of the options in the last
  // argument

  subHandle = self.view.subscribe.call(self.view, args, {
    connection: connection
  });

  if (!_.has(subHandles, subHandle.subscriptionId)) {
    subHandles[subHandle.subscriptionId] = subHandle; // Adding a new subscription will always cause us to transition from ready
    // to not ready, but if we are already not ready then this can't make us
    // ready.

    if (self._allSubsReady) {
      self._allSubsReadyDep.changed();
    }
  }

  return subHandle;
};
/**
 * @summary A reactive function that returns true when all of the subscriptions
 * called with [this.subscribe](#TemplateInstance-subscribe) are ready.
 * @return {Boolean} True if all subscriptions on this template instance are
 * ready.
 */


Blaze.TemplateInstance.prototype.subscriptionsReady = function () {
  this._allSubsReadyDep.depend();

  this._allSubsReady = _.all(this._subscriptionHandles, function (handle) {
    return handle.ready();
  });
  return this._allSubsReady;
};
/**
 * @summary Specify template helpers available to this template.
 * @locus Client
 * @param {Object} helpers Dictionary of helper functions by name.
 * @importFromPackage templating
 */


Template.prototype.helpers = function (dict) {
  if (!_.isObject(dict)) {
    throw new Error("Helpers dictionary has to be an object");
  }

  for (var k in dict) this.__helpers.set(k, dict[k]);
};

var canUseGetters = function () {
  if (Object.defineProperty) {
    var obj = {};

    try {
      Object.defineProperty(obj, "self", {
        get: function () {
          return obj;
        }
      });
    } catch (e) {
      return false;
    }

    return obj.self === obj;
  }

  return false;
}();

if (canUseGetters) {
  // Like Blaze.currentView but for the template instance. A function
  // rather than a value so that not all helpers are implicitly dependent
  // on the current template instance's `data` property, which would make
  // them dependent on the data context of the template inclusion.
  var currentTemplateInstanceFunc = null; // If getters are supported, define this property with a getter function
  // to make it effectively read-only, and to work around this bizarre JSC
  // bug: https://github.com/meteor/meteor/issues/9926

  Object.defineProperty(Template, "_currentTemplateInstanceFunc", {
    get: function () {
      return currentTemplateInstanceFunc;
    }
  });

  Template._withTemplateInstanceFunc = function (templateInstanceFunc, func) {
    if (typeof func !== 'function') {
      throw new Error("Expected function, got: " + func);
    }

    var oldTmplInstanceFunc = currentTemplateInstanceFunc;

    try {
      currentTemplateInstanceFunc = templateInstanceFunc;
      return func();
    } finally {
      currentTemplateInstanceFunc = oldTmplInstanceFunc;
    }
  };
} else {
  // If getters are not supported, just use a normal property.
  Template._currentTemplateInstanceFunc = null;

  Template._withTemplateInstanceFunc = function (templateInstanceFunc, func) {
    if (typeof func !== 'function') {
      throw new Error("Expected function, got: " + func);
    }

    var oldTmplInstanceFunc = Template._currentTemplateInstanceFunc;

    try {
      Template._currentTemplateInstanceFunc = templateInstanceFunc;
      return func();
    } finally {
      Template._currentTemplateInstanceFunc = oldTmplInstanceFunc;
    }
  };
}
/**
 * @summary Specify event handlers for this template.
 * @locus Client
 * @param {EventMap} eventMap Event handlers to associate with this template.
 * @importFromPackage templating
 */


Template.prototype.events = function (eventMap) {
  if (!_.isObject(eventMap)) {
    throw new Error("Event map has to be an object");
  }

  var template = this;
  var eventMap2 = {};

  for (var k in eventMap) {
    eventMap2[k] = function (k, v) {
      return function (event
      /*, ...*/
      ) {
        var view = this; // passed by EventAugmenter

        var data = Blaze.getData(event.currentTarget);
        if (data == null) data = {};
        var args = Array.prototype.slice.call(arguments);

        var tmplInstanceFunc = Blaze._bind(view.templateInstance, view);

        args.splice(1, 0, tmplInstanceFunc());
        return Template._withTemplateInstanceFunc(tmplInstanceFunc, function () {
          return v.apply(data, args);
        });
      };
    }(k, eventMap[k]);
  }

  template.__eventMaps.push(eventMap2);
};
/**
 * @function
 * @name instance
 * @memberOf Template
 * @summary The [template instance](#Template-instances) corresponding to the current template helper, event handler, callback, or autorun.  If there isn't one, `null`.
 * @locus Client
 * @returns {Blaze.TemplateInstance}
 * @importFromPackage templating
 */


Template.instance = function () {
  return Template._currentTemplateInstanceFunc && Template._currentTemplateInstanceFunc();
}; // Note: Template.currentData() is documented to take zero arguments,
// while Blaze.getData takes up to one.

/**
 * @summary
 *
 * - Inside an `onCreated`, `onRendered`, or `onDestroyed` callback, returns
 * the data context of the template.
 * - Inside an event handler, returns the data context of the template on which
 * this event handler was defined.
 * - Inside a helper, returns the data context of the DOM node where the helper
 * was used.
 *
 * Establishes a reactive dependency on the result.
 * @locus Client
 * @function
 * @importFromPackage templating
 */


Template.currentData = Blaze.getData;
/**
 * @summary Accesses other data contexts that enclose the current data context.
 * @locus Client
 * @function
 * @param {Integer} [numLevels] The number of levels beyond the current data context to look. Defaults to 1.
 * @importFromPackage templating
 */

Template.parentData = Blaze._parentData;
/**
 * @summary Defines a [helper function](#Template-helpers) which can be used from all templates.
 * @locus Client
 * @function
 * @param {String} name The name of the helper function you are defining.
 * @param {Function} function The helper function itself.
 * @importFromPackage templating
 */

Template.registerHelper = Blaze.registerHelper;
/**
 * @summary Removes a global [helper function](#Template-helpers).
 * @locus Client
 * @function
 * @param {String} name The name of the helper function you are defining.
 * @importFromPackage templating
 */

Template.deregisterHelper = Blaze.deregisterHelper;
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"backcompat.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/blaze/backcompat.js                                                                                        //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
UI = Blaze;
Blaze.ReactiveVar = ReactiveVar;
UI._templateInstance = Blaze.Template.instance;
Handlebars = {};
Handlebars.registerHelper = Blaze.registerHelper;
Handlebars._escape = Blaze._escape; // Return these from {{...}} helpers to achieve the same as returning
// strings from {{{...}}} helpers

Handlebars.SafeString = function (string) {
  this.string = string;
};

Handlebars.SafeString.prototype.toString = function () {
  return this.string.toString();
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});

require("/node_modules/meteor/blaze/preamble.js");
require("/node_modules/meteor/blaze/exceptions.js");
require("/node_modules/meteor/blaze/view.js");
require("/node_modules/meteor/blaze/builtins.js");
require("/node_modules/meteor/blaze/lookup.js");
require("/node_modules/meteor/blaze/template.js");
require("/node_modules/meteor/blaze/backcompat.js");

/* Exports */
Package._define("blaze", {
  Blaze: Blaze,
  UI: UI,
  Handlebars: Handlebars
});

})();

//# sourceURL=meteor://💻app/packages/blaze.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvYmxhemUvcHJlYW1ibGUuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL2JsYXplL2V4Y2VwdGlvbnMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL2JsYXplL3ZpZXcuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL2JsYXplL2J1aWx0aW5zLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9ibGF6ZS9sb29rdXAuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL2JsYXplL3RlbXBsYXRlLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9ibGF6ZS9iYWNrY29tcGF0LmpzIl0sIm5hbWVzIjpbIkJsYXplIiwiX2VzY2FwZSIsImVzY2FwZV9tYXAiLCJlc2NhcGVfb25lIiwiYyIsIngiLCJyZXBsYWNlIiwiX3dhcm4iLCJtc2ciLCJjb25zb2xlIiwid2FybiIsIm5hdGl2ZUJpbmQiLCJGdW5jdGlvbiIsInByb3RvdHlwZSIsImJpbmQiLCJfYmluZCIsImZ1bmMiLCJvYmoiLCJhcmd1bWVudHMiLCJsZW5ndGgiLCJjYWxsIiwiYXJncyIsIkFycmF5IiwiaSIsImFwcGx5Iiwic2xpY2UiLCJfIiwiZGVidWdGdW5jIiwiX3Rocm93TmV4dEV4Y2VwdGlvbiIsIl9yZXBvcnRFeGNlcHRpb24iLCJlIiwiTWV0ZW9yIiwiX2RlYnVnIiwibG9nIiwic3RhY2siLCJtZXNzYWdlIiwiX3dyYXBDYXRjaGluZ0V4Y2VwdGlvbnMiLCJmIiwid2hlcmUiLCJWaWV3IiwibmFtZSIsInJlbmRlciIsIl9yZW5kZXIiLCJfY2FsbGJhY2tzIiwiY3JlYXRlZCIsInJlbmRlcmVkIiwiZGVzdHJveWVkIiwiaXNDcmVhdGVkIiwiX2lzQ3JlYXRlZEZvckV4cGFuc2lvbiIsImlzUmVuZGVyZWQiLCJfaXNBdHRhY2hlZCIsImlzRGVzdHJveWVkIiwiX2lzSW5SZW5kZXIiLCJwYXJlbnRWaWV3IiwiX2RvbXJhbmdlIiwiX2hhc0dlbmVyYXRlZFBhcmVudCIsIl9zY29wZUJpbmRpbmdzIiwicmVuZGVyQ291bnQiLCJvblZpZXdDcmVhdGVkIiwiY2IiLCJwdXNoIiwiX29uVmlld1JlbmRlcmVkIiwib25WaWV3UmVhZHkiLCJzZWxmIiwiZmlyZSIsIlRyYWNrZXIiLCJhZnRlckZsdXNoIiwiX3dpdGhDdXJyZW50VmlldyIsIm9uVmlld1JlbmRlcmVkIiwiYXR0YWNoZWQiLCJvbkF0dGFjaGVkIiwib25WaWV3RGVzdHJveWVkIiwicmVtb3ZlVmlld0Rlc3Ryb3llZExpc3RlbmVyIiwiaW5kZXgiLCJsYXN0SW5kZXhPZiIsImF1dG9ydW4iLCJfaW5WaWV3U2NvcGUiLCJkaXNwbGF5TmFtZSIsIkVycm9yIiwidGVtcGxhdGVJbnN0YW5jZUZ1bmMiLCJUZW1wbGF0ZSIsIl9jdXJyZW50VGVtcGxhdGVJbnN0YW5jZUZ1bmMiLCJ2aWV3QXV0b3J1biIsIl93aXRoVGVtcGxhdGVJbnN0YW5jZUZ1bmMiLCJjb21wIiwic3RvcENvbXB1dGF0aW9uIiwic3RvcCIsIm9uU3RvcCIsIl9lcnJvcklmU2hvdWxkbnRDYWxsU3Vic2NyaWJlIiwic3Vic2NyaWJlIiwib3B0aW9ucyIsInN1YkhhbmRsZSIsImNvbm5lY3Rpb24iLCJmaXJzdE5vZGUiLCJsYXN0Tm9kZSIsIl9maXJlQ2FsbGJhY2tzIiwidmlldyIsIndoaWNoIiwibm9ucmVhY3RpdmUiLCJmaXJlQ2FsbGJhY2tzIiwiY2JzIiwiTiIsIl9jcmVhdGVWaWV3IiwiZm9yRXhwYW5zaW9uIiwiZG9GaXJzdFJlbmRlciIsImluaXRpYWxDb250ZW50IiwiZG9tcmFuZ2UiLCJfRE9NUmFuZ2UiLCJ0ZWFyZG93bkhvb2siLCJyYW5nZSIsImVsZW1lbnQiLCJfRE9NQmFja2VuZCIsIlRlYXJkb3duIiwib25FbGVtZW50VGVhcmRvd24iLCJ0ZWFyZG93biIsIl9kZXN0cm95VmlldyIsIl9tYXRlcmlhbGl6ZVZpZXciLCJfd29ya1N0YWNrIiwiX2ludG9BcnJheSIsImxhc3RIdG1sanMiLCJkb1JlbmRlciIsImh0bWxqcyIsImZpcnN0UnVuIiwiX2lzQ29udGVudEVxdWFsIiwiZG9NYXRlcmlhbGl6ZSIsInJhbmdlc0FuZE5vZGVzIiwiX21hdGVyaWFsaXplRE9NIiwic2V0TWVtYmVycyIsIm9uSW52YWxpZGF0ZSIsImRlc3Ryb3lNZW1iZXJzIiwidW5kZWZpbmVkIiwiaW5pdGlhbENvbnRlbnRzIiwiX2V4cGFuZFZpZXciLCJyZXN1bHQiLCJfZXhwYW5kIiwiYWN0aXZlIiwiX0hUTUxKU0V4cGFuZGVyIiwiSFRNTCIsIlRyYW5zZm9ybWluZ1Zpc2l0b3IiLCJleHRlbmQiLCJkZWYiLCJ2aXNpdE9iamVjdCIsImNvbnN0cnVjdFZpZXciLCJ2aXNpdEF0dHJpYnV0ZXMiLCJhdHRycyIsInZpc2l0QXR0cmlidXRlIiwidmFsdWUiLCJ0YWciLCJjdXJyZW50Vmlld0lmUmVuZGVyaW5nIiwiY3VycmVudFZpZXciLCJ2aXNpdCIsIl9leHBhbmRBdHRyaWJ1dGVzIiwiX3NraXBOb2RlcyIsIl9kZXN0cm95Tm9kZSIsIm5vZGUiLCJub2RlVHlwZSIsInRlYXJEb3duRWxlbWVudCIsImEiLCJiIiwiUmF3Iiwib2xkVmlldyIsImNoZWNrUmVuZGVyQ29udGVudCIsImNvbnRlbnQiLCJWaXNpdG9yIiwiY29udGVudEFzVmlldyIsImNvbnRlbnRBc0Z1bmMiLCJwYXJlbnRFbGVtZW50IiwibmV4dE5vZGUiLCJhdHRhY2giLCJpbnNlcnQiLCJyZW5kZXJXaXRoRGF0YSIsImRhdGEiLCJfVGVtcGxhdGVXaXRoIiwicmVtb3ZlIiwicGFyZW50UmFuZ2UiLCJkZXRhY2giLCJkZXN0cm95IiwidG9IVE1MIiwidG9IVE1MV2l0aERhdGEiLCJfdG9UZXh0IiwidGV4dE1vZGUiLCJURVhUTU9ERSIsIlNUUklORyIsIlJDREFUQSIsIkFUVFJJQlVURSIsInRvVGV4dCIsImdldERhdGEiLCJlbGVtZW50T3JWaWV3IiwidGhlV2l0aCIsImdldFZpZXciLCJkYXRhVmFyIiwiZ2V0IiwiZ2V0RWxlbWVudERhdGEiLCJfdmlld05hbWUiLCJ2aWV3TmFtZSIsIl9nZXRDdXJyZW50VmlldyIsIl9nZXRQYXJlbnRWaWV3IiwiX2dldEVsZW1lbnRWaWV3IiwidiIsImVsZW0iLCJmb3JFbGVtZW50IiwiX2FkZEV2ZW50TWFwIiwiZXZlbnRNYXAiLCJ0aGlzSW5IYW5kbGVyIiwiaGFuZGxlcyIsImF0dGFjaGVkX2V2ZW50TWFwcyIsImVhY2giLCJoYW5kbGVyIiwic3BlYyIsImNsYXVzZXMiLCJzcGxpdCIsImNsYXVzZSIsInBhcnRzIiwibmV3RXZlbnRzIiwic2hpZnQiLCJzZWxlY3RvciIsImpvaW4iLCJfRXZlbnRTdXBwb3J0IiwibGlzdGVuIiwiZXZ0IiwiY29udGFpbnNFbGVtZW50IiwiY3VycmVudFRhcmdldCIsImhhbmRsZXJUaGlzIiwiaGFuZGxlckFyZ3MiLCJyIiwiaCIsIl9jYWxjdWxhdGVDb25kaXRpb24iLCJjb25kIiwiV2l0aCIsImNvbnRlbnRGdW5jIiwiUmVhY3RpdmVWYXIiLCJzZXQiLCJfYXR0YWNoQmluZGluZ3NUb1ZpZXciLCJiaW5kaW5ncyIsImJpbmRpbmciLCJMZXQiLCJJZiIsImNvbmRpdGlvbkZ1bmMiLCJlbHNlRnVuYyIsIl9ub3QiLCJjb25kaXRpb25WYXIiLCJfX2NvbmRpdGlvblZhciIsIlVubGVzcyIsIkVhY2giLCJhcmdGdW5jIiwiZWFjaFZpZXciLCJzdWJ2aWV3cyIsImluaXRpYWxTdWJ2aWV3cyIsImV4cGFuZGVkVmFsdWVEZXAiLCJEZXBlbmRlbmN5IiwiZGVwZW5kIiwibnVtSXRlbXMiLCJpbkVsc2VNb2RlIiwic3RvcEhhbmRsZSIsImFyZ1ZhciIsInZhcmlhYmxlTmFtZSIsInVwZGF0ZUluZGljZXMiLCJmcm9tIiwidG8iLCJtZW1iZXJzIiwiYXJnIiwiaXNPYmplY3QiLCJoYXMiLCJfdmFyaWFibGUiLCJfc2VxdWVuY2UiLCJPYnNlcnZlU2VxdWVuY2UiLCJvYnNlcnZlIiwiYWRkZWRBdCIsImlkIiwiaXRlbSIsIm5ld0l0ZW1WaWV3IiwiY2hhbmdlZCIsInJlbW92ZU1lbWJlciIsImFkZE1lbWJlciIsInNwbGljZSIsInJlbW92ZWRBdCIsImNoYW5nZWRBdCIsIm5ld0l0ZW0iLCJvbGRJdGVtIiwiaXRlbVZpZXciLCJnZXRNZW1iZXIiLCJtb3ZlZFRvIiwiZnJvbUluZGV4IiwidG9JbmRleCIsIm1vdmVNZW1iZXIiLCJNYXRoIiwibWluIiwibWF4IiwidyIsIndyYXBwZWRBcmdGdW5jIiwidmlld1RvRXZhbHVhdGVBcmciLCJvcmlnaW5hbFBhcmVudFZpZXciLCJ3cmFwcGVkQ29udGVudEZ1bmMiLCJfX2lzVGVtcGxhdGVXaXRoIiwiX0luT3V0ZXJUZW1wbGF0ZVNjb3BlIiwidGVtcGxhdGVWaWV3IiwiX19jaGlsZERvZXNudFN0YXJ0TmV3TGV4aWNhbFNjb3BlIiwiSW5PdXRlclRlbXBsYXRlU2NvcGUiLCJfZ2xvYmFsSGVscGVycyIsInJlZ2lzdGVySGVscGVyIiwiZGVyZWdpc3RlckhlbHBlciIsImJpbmRJZklzRnVuY3Rpb24iLCJ0YXJnZXQiLCJiaW5kRGF0YUNvbnRleHQiLCJfT0xEU1RZTEVfSEVMUEVSIiwiX2dldFRlbXBsYXRlSGVscGVyIiwidGVtcGxhdGUiLCJ0bXBsSW5zdGFuY2VGdW5jIiwiaXNLbm93bk9sZFN0eWxlSGVscGVyIiwiX19oZWxwZXJzIiwiaGVscGVyIiwid3JhcEhlbHBlciIsIl9OT1dBUk5fT0xEU1RZTEVfSEVMUEVSUyIsInRlbXBsYXRlRnVuYyIsIl9sZXhpY2FsQmluZGluZ0xvb2t1cCIsImJsb2NrSGVscGVyc1N0YWNrIiwiYmluZGluZ1JlYWN0aXZlVmFyIiwiX19zdGFydHNOZXdMZXhpY2FsU2NvcGUiLCJfZ2V0VGVtcGxhdGUiLCJ0ZW1wbGF0ZUluc3RhbmNlIiwiX2dldEdsb2JhbEhlbHBlciIsImxvb2t1cCIsIl9vcHRpb25zIiwibG9va3VwVGVtcGxhdGUiLCJib3VuZFRtcGxJbnN0YW5jZSIsImZvdW5kVGVtcGxhdGUiLCJ0ZXN0IiwiX3BhcmVudERhdGEiLCJpc0NhbGxlZEFzRnVuY3Rpb24iLCJjaGFyQXQiLCJoZWlnaHQiLCJfZnVuY3Rpb25XcmFwcGVkIiwicmVuZGVyRnVuY3Rpb24iLCJIZWxwZXJNYXAiLCJfX2V2ZW50TWFwcyIsImlzVGVtcGxhdGUiLCJ0Iiwib25DcmVhdGVkIiwib25SZW5kZXJlZCIsIm9uRGVzdHJveWVkIiwiX2dldENhbGxiYWNrcyIsImNhbGxiYWNrcyIsImNvbmNhdCIsInRlbXBsYXRlQ29udGVudEJsb2NrIiwidGVtcGxhdGVFbHNlQmxvY2siLCJldmVudHMiLCJtIiwiX3RlbXBsYXRlSW5zdGFuY2UiLCJUZW1wbGF0ZUluc3RhbmNlIiwiaW5zdCIsImNyZWF0ZWRDYWxsYmFja3MiLCJyZW5kZXJlZENhbGxiYWNrcyIsImRlc3Ryb3llZENhbGxiYWNrcyIsIl9hbGxTdWJzUmVhZHlEZXAiLCJfYWxsU3Vic1JlYWR5IiwiX3N1YnNjcmlwdGlvbkhhbmRsZXMiLCIkIiwiZmluZEFsbCIsImZpbmQiLCJzdWJIYW5kbGVzIiwidG9BcnJheSIsImxhc3RQYXJhbSIsImxhc3QiLCJsYXN0UGFyYW1PcHRpb25zUGF0dGVybiIsIm9uUmVhZHkiLCJNYXRjaCIsIk9wdGlvbmFsIiwib25FcnJvciIsIkFueSIsImlzRnVuY3Rpb24iLCJwb3AiLCJpc0VtcHR5Iiwib2xkU3RvcHBlZCIsImVycm9yIiwic3Vic2NyaXB0aW9uSWQiLCJwaWNrIiwic3Vic2NyaXB0aW9uc1JlYWR5IiwiYWxsIiwiaGFuZGxlIiwicmVhZHkiLCJoZWxwZXJzIiwiZGljdCIsImsiLCJjYW5Vc2VHZXR0ZXJzIiwiT2JqZWN0IiwiZGVmaW5lUHJvcGVydHkiLCJjdXJyZW50VGVtcGxhdGVJbnN0YW5jZUZ1bmMiLCJvbGRUbXBsSW5zdGFuY2VGdW5jIiwiZXZlbnRNYXAyIiwiZXZlbnQiLCJpbnN0YW5jZSIsImN1cnJlbnREYXRhIiwicGFyZW50RGF0YSIsIlVJIiwiSGFuZGxlYmFycyIsIlNhZmVTdHJpbmciLCJzdHJpbmciLCJ0b1N0cmluZyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7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QUFDMEwsT0FBN0I7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFDQTFHLFFBQVEsQ0FBQ3dULFVBQVQsR0FBc0J4WSxLQUFLLENBQUN1VSxXQUE1QjtBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBQ0F2UCxRQUFRLENBQUMyTixjQUFULEdBQTBCM1MsS0FBSyxDQUFDMlMsY0FBaEM7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFDQTNOLFFBQVEsQ0FBQzROLGdCQUFULEdBQTRCNVMsS0FBSyxDQUFDNFMsZ0JBQWxDLEM7Ozs7Ozs7Ozs7O0FDL2xCQTZGLEVBQUUsR0FBR3pZLEtBQUw7QUFFQUEsS0FBSyxDQUFDc08sV0FBTixHQUFvQkEsV0FBcEI7QUFDQW1LLEVBQUUsQ0FBQzlDLGlCQUFILEdBQXVCM1YsS0FBSyxDQUFDZ0YsUUFBTixDQUFlc1QsUUFBdEM7QUFFQUksVUFBVSxHQUFHLEVBQWI7QUFDQUEsVUFBVSxDQUFDL0YsY0FBWCxHQUE0QjNTLEtBQUssQ0FBQzJTLGNBQWxDO0FBRUErRixVQUFVLENBQUN6WSxPQUFYLEdBQXFCRCxLQUFLLENBQUNDLE9BQTNCLEMsQ0FFQTtBQUNBOztBQUNBeVksVUFBVSxDQUFDQyxVQUFYLEdBQXdCLFVBQVNDLE1BQVQsRUFBaUI7QUFDdkMsT0FBS0EsTUFBTCxHQUFjQSxNQUFkO0FBQ0QsQ0FGRDs7QUFHQUYsVUFBVSxDQUFDQyxVQUFYLENBQXNCOVgsU0FBdEIsQ0FBZ0NnWSxRQUFoQyxHQUEyQyxZQUFXO0FBQ3BELFNBQU8sS0FBS0QsTUFBTCxDQUFZQyxRQUFaLEVBQVA7QUFDRCxDQUZELEMiLCJmaWxlIjoiL3BhY2thZ2VzL2JsYXplLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbmFtZXNwYWNlIEJsYXplXG4gKiBAc3VtbWFyeSBUaGUgbmFtZXNwYWNlIGZvciBhbGwgQmxhemUtcmVsYXRlZCBtZXRob2RzIGFuZCBjbGFzc2VzLlxuICovXG5CbGF6ZSA9IHt9O1xuXG4vLyBVdGlsaXR5IHRvIEhUTUwtZXNjYXBlIGEgc3RyaW5nLiAgSW5jbHVkZWQgZm9yIGxlZ2FjeSByZWFzb25zLlxuLy8gVE9ETzogU2hvdWxkIGJlIHJlcGxhY2VkIHdpdGggXy5lc2NhcGUgb25jZSB1bmRlcnNjb3JlIGlzIHVwZ3JhZGVkIHRvIGEgbmV3ZXJcbi8vICAgICAgIHZlcnNpb24gd2hpY2ggZXNjYXBlcyBgIChiYWNrdGljaykgYXMgd2VsbC4gVW5kZXJzY29yZSAxLjUuMiBkb2VzIG5vdC5cbkJsYXplLl9lc2NhcGUgPSAoZnVuY3Rpb24oKSB7XG4gIHZhciBlc2NhcGVfbWFwID0ge1xuICAgIFwiPFwiOiBcIiZsdDtcIixcbiAgICBcIj5cIjogXCImZ3Q7XCIsXG4gICAgJ1wiJzogXCImcXVvdDtcIixcbiAgICBcIidcIjogXCImI3gyNztcIixcbiAgICBcIi9cIjogXCImI3gyRjtcIixcbiAgICBcImBcIjogXCImI3g2MDtcIiwgLyogSUUgYWxsb3dzIGJhY2t0aWNrLWRlbGltaXRlZCBhdHRyaWJ1dGVzPz8gKi9cbiAgICBcIiZcIjogXCImYW1wO1wiXG4gIH07XG4gIHZhciBlc2NhcGVfb25lID0gZnVuY3Rpb24oYykge1xuICAgIHJldHVybiBlc2NhcGVfbWFwW2NdO1xuICB9O1xuXG4gIHJldHVybiBmdW5jdGlvbiAoeCkge1xuICAgIHJldHVybiB4LnJlcGxhY2UoL1smPD5cIidgXS9nLCBlc2NhcGVfb25lKTtcbiAgfTtcbn0pKCk7XG5cbkJsYXplLl93YXJuID0gZnVuY3Rpb24gKG1zZykge1xuICBtc2cgPSAnV2FybmluZzogJyArIG1zZztcblxuICBpZiAoKHR5cGVvZiBjb25zb2xlICE9PSAndW5kZWZpbmVkJykgJiYgY29uc29sZS53YXJuKSB7XG4gICAgY29uc29sZS53YXJuKG1zZyk7XG4gIH1cbn07XG5cbnZhciBuYXRpdmVCaW5kID0gRnVuY3Rpb24ucHJvdG90eXBlLmJpbmQ7XG5cbi8vIEFuIGltcGxlbWVudGF0aW9uIG9mIF8uYmluZCB3aGljaCBhbGxvd3MgYmV0dGVyIG9wdGltaXphdGlvbi5cbi8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL3BldGthYW50b25vdi9ibHVlYmlyZC93aWtpL09wdGltaXphdGlvbi1raWxsZXJzIzMtbWFuYWdpbmctYXJndW1lbnRzXG5pZiAobmF0aXZlQmluZCkge1xuICBCbGF6ZS5fYmluZCA9IGZ1bmN0aW9uIChmdW5jLCBvYmopIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMikge1xuICAgICAgcmV0dXJuIG5hdGl2ZUJpbmQuY2FsbChmdW5jLCBvYmopO1xuICAgIH1cblxuICAgIC8vIENvcHkgdGhlIGFyZ3VtZW50cyBzbyB0aGlzIGZ1bmN0aW9uIGNhbiBiZSBvcHRpbWl6ZWQuXG4gICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcmdzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBhcmdzW2ldID0gYXJndW1lbnRzW2ldO1xuICAgIH1cblxuICAgIHJldHVybiBuYXRpdmVCaW5kLmFwcGx5KGZ1bmMsIGFyZ3Muc2xpY2UoMSkpO1xuICB9O1xufVxuZWxzZSB7XG4gIC8vIEEgc2xvd2VyIGJ1dCBiYWNrd2FyZHMgY29tcGF0aWJsZSB2ZXJzaW9uLlxuICBCbGF6ZS5fYmluZCA9IF8uYmluZDtcbn1cbiIsInZhciBkZWJ1Z0Z1bmM7XG5cbi8vIFdlIGNhbGwgaW50byB1c2VyIGNvZGUgaW4gbWFueSBwbGFjZXMsIGFuZCBpdCdzIG5pY2UgdG8gY2F0Y2ggZXhjZXB0aW9uc1xuLy8gcHJvcGFnYXRlZCBmcm9tIHVzZXIgY29kZSBpbW1lZGlhdGVseSBzbyB0aGF0IHRoZSB3aG9sZSBzeXN0ZW0gZG9lc24ndCBqdXN0XG4vLyBicmVhay4gIENhdGNoaW5nIGV4Y2VwdGlvbnMgaXMgZWFzeTsgcmVwb3J0aW5nIHRoZW0gaXMgaGFyZC4gIFRoaXMgaGVscGVyXG4vLyByZXBvcnRzIGV4Y2VwdGlvbnMuXG4vL1xuLy8gVXNhZ2U6XG4vL1xuLy8gYGBgXG4vLyB0cnkge1xuLy8gICAvLyAuLi4gc29tZVN0dWZmIC4uLlxuLy8gfSBjYXRjaCAoZSkge1xuLy8gICByZXBvcnRVSUV4Y2VwdGlvbihlKTtcbi8vIH1cbi8vIGBgYFxuLy9cbi8vIEFuIG9wdGlvbmFsIHNlY29uZCBhcmd1bWVudCBvdmVycmlkZXMgdGhlIGRlZmF1bHQgbWVzc2FnZS5cblxuLy8gU2V0IHRoaXMgdG8gYHRydWVgIHRvIGNhdXNlIGByZXBvcnRFeGNlcHRpb25gIHRvIHRocm93XG4vLyB0aGUgbmV4dCBleGNlcHRpb24gcmF0aGVyIHRoYW4gcmVwb3J0aW5nIGl0LiAgVGhpcyBpc1xuLy8gdXNlZnVsIGluIHVuaXQgdGVzdHMgdGhhdCB0ZXN0IGVycm9yIG1lc3NhZ2VzLlxuQmxhemUuX3Rocm93TmV4dEV4Y2VwdGlvbiA9IGZhbHNlO1xuXG5CbGF6ZS5fcmVwb3J0RXhjZXB0aW9uID0gZnVuY3Rpb24gKGUsIG1zZykge1xuICBpZiAoQmxhemUuX3Rocm93TmV4dEV4Y2VwdGlvbikge1xuICAgIEJsYXplLl90aHJvd05leHRFeGNlcHRpb24gPSBmYWxzZTtcbiAgICB0aHJvdyBlO1xuICB9XG5cbiAgaWYgKCEgZGVidWdGdW5jKVxuICAgIC8vIGFkYXB0ZWQgZnJvbSBUcmFja2VyXG4gICAgZGVidWdGdW5jID0gZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuICh0eXBlb2YgTWV0ZW9yICE9PSBcInVuZGVmaW5lZFwiID8gTWV0ZW9yLl9kZWJ1ZyA6XG4gICAgICAgICAgICAgICgodHlwZW9mIGNvbnNvbGUgIT09IFwidW5kZWZpbmVkXCIpICYmIGNvbnNvbGUubG9nID8gY29uc29sZS5sb2cgOlxuICAgICAgICAgICAgICAgZnVuY3Rpb24gKCkge30pKTtcbiAgICB9O1xuXG4gIC8vIEluIENocm9tZSwgYGUuc3RhY2tgIGlzIGEgbXVsdGlsaW5lIHN0cmluZyB0aGF0IHN0YXJ0cyB3aXRoIHRoZSBtZXNzYWdlXG4gIC8vIGFuZCBjb250YWlucyBhIHN0YWNrIHRyYWNlLiAgRnVydGhlcm1vcmUsIGBjb25zb2xlLmxvZ2AgbWFrZXMgaXQgY2xpY2thYmxlLlxuICAvLyBgY29uc29sZS5sb2dgIHN1cHBsaWVzIHRoZSBzcGFjZSBiZXR3ZWVuIHRoZSB0d28gYXJndW1lbnRzLlxuICBkZWJ1Z0Z1bmMoKShtc2cgfHwgJ0V4Y2VwdGlvbiBjYXVnaHQgaW4gdGVtcGxhdGU6JywgZS5zdGFjayB8fCBlLm1lc3NhZ2UgfHwgZSk7XG59O1xuXG5CbGF6ZS5fd3JhcENhdGNoaW5nRXhjZXB0aW9ucyA9IGZ1bmN0aW9uIChmLCB3aGVyZSkge1xuICBpZiAodHlwZW9mIGYgIT09ICdmdW5jdGlvbicpXG4gICAgcmV0dXJuIGY7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIGYuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBCbGF6ZS5fcmVwb3J0RXhjZXB0aW9uKGUsICdFeGNlcHRpb24gaW4gJyArIHdoZXJlICsgJzonKTtcbiAgICB9XG4gIH07XG59O1xuIiwiLy8vIFtuZXddIEJsYXplLlZpZXcoW25hbWVdLCByZW5kZXJNZXRob2QpXG4vLy9cbi8vLyBCbGF6ZS5WaWV3IGlzIHRoZSBidWlsZGluZyBibG9jayBvZiByZWFjdGl2ZSBET00uICBWaWV3cyBoYXZlXG4vLy8gdGhlIGZvbGxvd2luZyBmZWF0dXJlczpcbi8vL1xuLy8vICogbGlmZWN5Y2xlIGNhbGxiYWNrcyAtIFZpZXdzIGFyZSBjcmVhdGVkLCByZW5kZXJlZCwgYW5kIGRlc3Ryb3llZCxcbi8vLyAgIGFuZCBjYWxsYmFja3MgY2FuIGJlIHJlZ2lzdGVyZWQgdG8gZmlyZSB3aGVuIHRoZXNlIHRoaW5ncyBoYXBwZW4uXG4vLy9cbi8vLyAqIHBhcmVudCBwb2ludGVyIC0gQSBWaWV3IHBvaW50cyB0byBpdHMgcGFyZW50Vmlldywgd2hpY2ggaXMgdGhlXG4vLy8gICBWaWV3IHRoYXQgY2F1c2VkIGl0IHRvIGJlIHJlbmRlcmVkLiAgVGhlc2UgcG9pbnRlcnMgZm9ybSBhXG4vLy8gICBoaWVyYXJjaHkgb3IgdHJlZSBvZiBWaWV3cy5cbi8vL1xuLy8vICogcmVuZGVyKCkgbWV0aG9kIC0gQSBWaWV3J3MgcmVuZGVyKCkgbWV0aG9kIHNwZWNpZmllcyB0aGUgRE9NXG4vLy8gICAob3IgSFRNTCkgY29udGVudCBvZiB0aGUgVmlldy4gIElmIHRoZSBtZXRob2QgZXN0YWJsaXNoZXNcbi8vLyAgIHJlYWN0aXZlIGRlcGVuZGVuY2llcywgaXQgbWF5IGJlIHJlLXJ1bi5cbi8vL1xuLy8vICogYSBET01SYW5nZSAtIElmIGEgVmlldyBpcyByZW5kZXJlZCB0byBET00sIGl0cyBwb3NpdGlvbiBhbmRcbi8vLyAgIGV4dGVudCBpbiB0aGUgRE9NIGFyZSB0cmFja2VkIHVzaW5nIGEgRE9NUmFuZ2Ugb2JqZWN0LlxuLy8vXG4vLy8gV2hlbiBhIFZpZXcgaXMgY29uc3RydWN0ZWQgYnkgY2FsbGluZyBCbGF6ZS5WaWV3LCB0aGUgVmlldyBpc1xuLy8vIG5vdCB5ZXQgY29uc2lkZXJlZCBcImNyZWF0ZWQuXCIgIEl0IGRvZXNuJ3QgaGF2ZSBhIHBhcmVudFZpZXcgeWV0LFxuLy8vIGFuZCBubyBsb2dpYyBoYXMgYmVlbiBydW4gdG8gaW5pdGlhbGl6ZSB0aGUgVmlldy4gIEFsbCByZWFsXG4vLy8gd29yayBpcyBkZWZlcnJlZCB1bnRpbCBhdCBsZWFzdCBjcmVhdGlvbiB0aW1lLCB3aGVuIHRoZSBvblZpZXdDcmVhdGVkXG4vLy8gY2FsbGJhY2tzIGFyZSBmaXJlZCwgd2hpY2ggaGFwcGVucyB3aGVuIHRoZSBWaWV3IGlzIFwidXNlZFwiIGluXG4vLy8gc29tZSB3YXkgdGhhdCByZXF1aXJlcyBpdCB0byBiZSByZW5kZXJlZC5cbi8vL1xuLy8vIC4uLm1vcmUgbGlmZWN5Y2xlIHN0dWZmXG4vLy9cbi8vLyBgbmFtZWAgaXMgYW4gb3B0aW9uYWwgc3RyaW5nIHRhZyBpZGVudGlmeWluZyB0aGUgVmlldy4gIFRoZSBvbmx5XG4vLy8gdGltZSBpdCdzIHVzZWQgaXMgd2hlbiBsb29raW5nIGluIHRoZSBWaWV3IHRyZWUgZm9yIGEgVmlldyBvZiBhXG4vLy8gcGFydGljdWxhciBuYW1lOyBmb3IgZXhhbXBsZSwgZGF0YSBjb250ZXh0cyBhcmUgc3RvcmVkIG9uIFZpZXdzXG4vLy8gb2YgbmFtZSBcIndpdGhcIi4gIE5hbWVzIGFyZSBhbHNvIHVzZWZ1bCB3aGVuIGRlYnVnZ2luZywgc28gaW5cbi8vLyBnZW5lcmFsIGl0J3MgZ29vZCBmb3IgZnVuY3Rpb25zIHRoYXQgY3JlYXRlIFZpZXdzIHRvIHNldCB0aGUgbmFtZS5cbi8vLyBWaWV3cyBhc3NvY2lhdGVkIHdpdGggdGVtcGxhdGVzIGhhdmUgbmFtZXMgb2YgdGhlIGZvcm0gXCJUZW1wbGF0ZS5mb29cIi5cblxuLyoqXG4gKiBAY2xhc3NcbiAqIEBzdW1tYXJ5IENvbnN0cnVjdG9yIGZvciBhIFZpZXcsIHdoaWNoIHJlcHJlc2VudHMgYSByZWFjdGl2ZSByZWdpb24gb2YgRE9NLlxuICogQGxvY3VzIENsaWVudFxuICogQHBhcmFtIHtTdHJpbmd9IFtuYW1lXSBPcHRpb25hbC4gIEEgbmFtZSBmb3IgdGhpcyB0eXBlIG9mIFZpZXcuICBTZWUgW2B2aWV3Lm5hbWVgXSgjdmlld19uYW1lKS5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IHJlbmRlckZ1bmN0aW9uIEEgZnVuY3Rpb24gdGhhdCByZXR1cm5zIFsqcmVuZGVyYWJsZSBjb250ZW50Kl0oI1JlbmRlcmFibGUtQ29udGVudCkuICBJbiB0aGlzIGZ1bmN0aW9uLCBgdGhpc2AgaXMgYm91bmQgdG8gdGhlIFZpZXcuXG4gKi9cbkJsYXplLlZpZXcgPSBmdW5jdGlvbiAobmFtZSwgcmVuZGVyKSB7XG4gIGlmICghICh0aGlzIGluc3RhbmNlb2YgQmxhemUuVmlldykpXG4gICAgLy8gY2FsbGVkIHdpdGhvdXQgYG5ld2BcbiAgICByZXR1cm4gbmV3IEJsYXplLlZpZXcobmFtZSwgcmVuZGVyKTtcblxuICBpZiAodHlwZW9mIG5hbWUgPT09ICdmdW5jdGlvbicpIHtcbiAgICAvLyBvbWl0dGVkIFwibmFtZVwiIGFyZ3VtZW50XG4gICAgcmVuZGVyID0gbmFtZTtcbiAgICBuYW1lID0gJyc7XG4gIH1cbiAgdGhpcy5uYW1lID0gbmFtZTtcbiAgdGhpcy5fcmVuZGVyID0gcmVuZGVyO1xuXG4gIHRoaXMuX2NhbGxiYWNrcyA9IHtcbiAgICBjcmVhdGVkOiBudWxsLFxuICAgIHJlbmRlcmVkOiBudWxsLFxuICAgIGRlc3Ryb3llZDogbnVsbFxuICB9O1xuXG4gIC8vIFNldHRpbmcgYWxsIHByb3BlcnRpZXMgaGVyZSBpcyBnb29kIGZvciByZWFkYWJpbGl0eSxcbiAgLy8gYW5kIGFsc28gbWF5IGhlbHAgQ2hyb21lIG9wdGltaXplIHRoZSBjb2RlIGJ5IGtlZXBpbmdcbiAgLy8gdGhlIFZpZXcgb2JqZWN0IGZyb20gY2hhbmdpbmcgc2hhcGUgdG9vIG11Y2guXG4gIHRoaXMuaXNDcmVhdGVkID0gZmFsc2U7XG4gIHRoaXMuX2lzQ3JlYXRlZEZvckV4cGFuc2lvbiA9IGZhbHNlO1xuICB0aGlzLmlzUmVuZGVyZWQgPSBmYWxzZTtcbiAgdGhpcy5faXNBdHRhY2hlZCA9IGZhbHNlO1xuICB0aGlzLmlzRGVzdHJveWVkID0gZmFsc2U7XG4gIHRoaXMuX2lzSW5SZW5kZXIgPSBmYWxzZTtcbiAgdGhpcy5wYXJlbnRWaWV3ID0gbnVsbDtcbiAgdGhpcy5fZG9tcmFuZ2UgPSBudWxsO1xuICAvLyBUaGlzIGZsYWcgaXMgbm9ybWFsbHkgc2V0IHRvIGZhbHNlIGV4Y2VwdCBmb3IgdGhlIGNhc2VzIHdoZW4gdmlldydzIHBhcmVudFxuICAvLyB3YXMgZ2VuZXJhdGVkIGFzIHBhcnQgb2YgZXhwYW5kaW5nIHNvbWUgc3ludGFjdGljIHN1Z2FyIGV4cHJlc3Npb25zIG9yXG4gIC8vIG1ldGhvZHMuXG4gIC8vIEV4LjogQmxhemUucmVuZGVyV2l0aERhdGEgaXMgYW4gZXF1aXZhbGVudCB0byBjcmVhdGluZyBhIHZpZXcgd2l0aCByZWd1bGFyXG4gIC8vIEJsYXplLnJlbmRlciBhbmQgd3JhcHBpbmcgaXQgaW50byB7eyN3aXRoIGRhdGF9fXt7L3dpdGh9fSB2aWV3LiBTaW5jZSB0aGVcbiAgLy8gdXNlcnMgZG9uJ3Qga25vdyBhbnl0aGluZyBhYm91dCB0aGVzZSBnZW5lcmF0ZWQgcGFyZW50IHZpZXdzLCBCbGF6ZSBuZWVkc1xuICAvLyB0aGlzIGluZm9ybWF0aW9uIHRvIGJlIGF2YWlsYWJsZSBvbiB2aWV3cyB0byBtYWtlIHNtYXJ0ZXIgZGVjaXNpb25zLiBGb3JcbiAgLy8gZXhhbXBsZTogcmVtb3ZpbmcgdGhlIGdlbmVyYXRlZCBwYXJlbnQgdmlldyB3aXRoIHRoZSB2aWV3IG9uIEJsYXplLnJlbW92ZS5cbiAgdGhpcy5faGFzR2VuZXJhdGVkUGFyZW50ID0gZmFsc2U7XG4gIC8vIEJpbmRpbmdzIGFjY2Vzc2libGUgdG8gY2hpbGRyZW4gdmlld3MgKHZpYSB2aWV3Lmxvb2t1cCgnbmFtZScpKSB3aXRoaW4gdGhlXG4gIC8vIGNsb3Nlc3QgdGVtcGxhdGUgdmlldy5cbiAgdGhpcy5fc2NvcGVCaW5kaW5ncyA9IHt9O1xuXG4gIHRoaXMucmVuZGVyQ291bnQgPSAwO1xufTtcblxuQmxhemUuVmlldy5wcm90b3R5cGUuX3JlbmRlciA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIG51bGw7IH07XG5cbkJsYXplLlZpZXcucHJvdG90eXBlLm9uVmlld0NyZWF0ZWQgPSBmdW5jdGlvbiAoY2IpIHtcbiAgdGhpcy5fY2FsbGJhY2tzLmNyZWF0ZWQgPSB0aGlzLl9jYWxsYmFja3MuY3JlYXRlZCB8fCBbXTtcbiAgdGhpcy5fY2FsbGJhY2tzLmNyZWF0ZWQucHVzaChjYik7XG59O1xuXG5CbGF6ZS5WaWV3LnByb3RvdHlwZS5fb25WaWV3UmVuZGVyZWQgPSBmdW5jdGlvbiAoY2IpIHtcbiAgdGhpcy5fY2FsbGJhY2tzLnJlbmRlcmVkID0gdGhpcy5fY2FsbGJhY2tzLnJlbmRlcmVkIHx8IFtdO1xuICB0aGlzLl9jYWxsYmFja3MucmVuZGVyZWQucHVzaChjYik7XG59O1xuXG5CbGF6ZS5WaWV3LnByb3RvdHlwZS5vblZpZXdSZWFkeSA9IGZ1bmN0aW9uIChjYikge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHZhciBmaXJlID0gZnVuY3Rpb24gKCkge1xuICAgIFRyYWNrZXIuYWZ0ZXJGbHVzaChmdW5jdGlvbiAoKSB7XG4gICAgICBpZiAoISBzZWxmLmlzRGVzdHJveWVkKSB7XG4gICAgICAgIEJsYXplLl93aXRoQ3VycmVudFZpZXcoc2VsZiwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgIGNiLmNhbGwoc2VsZik7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pO1xuICB9O1xuICBzZWxmLl9vblZpZXdSZW5kZXJlZChmdW5jdGlvbiBvblZpZXdSZW5kZXJlZCgpIHtcbiAgICBpZiAoc2VsZi5pc0Rlc3Ryb3llZClcbiAgICAgIHJldHVybjtcbiAgICBpZiAoISBzZWxmLl9kb21yYW5nZS5hdHRhY2hlZClcbiAgICAgIHNlbGYuX2RvbXJhbmdlLm9uQXR0YWNoZWQoZmlyZSk7XG4gICAgZWxzZVxuICAgICAgZmlyZSgpO1xuICB9KTtcbn07XG5cbkJsYXplLlZpZXcucHJvdG90eXBlLm9uVmlld0Rlc3Ryb3llZCA9IGZ1bmN0aW9uIChjYikge1xuICB0aGlzLl9jYWxsYmFja3MuZGVzdHJveWVkID0gdGhpcy5fY2FsbGJhY2tzLmRlc3Ryb3llZCB8fCBbXTtcbiAgdGhpcy5fY2FsbGJhY2tzLmRlc3Ryb3llZC5wdXNoKGNiKTtcbn07XG5CbGF6ZS5WaWV3LnByb3RvdHlwZS5yZW1vdmVWaWV3RGVzdHJveWVkTGlzdGVuZXIgPSBmdW5jdGlvbiAoY2IpIHtcbiAgdmFyIGRlc3Ryb3llZCA9IHRoaXMuX2NhbGxiYWNrcy5kZXN0cm95ZWQ7XG4gIGlmICghIGRlc3Ryb3llZClcbiAgICByZXR1cm47XG4gIHZhciBpbmRleCA9IF8ubGFzdEluZGV4T2YoZGVzdHJveWVkLCBjYik7XG4gIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAvLyBYWFggWW91J2QgdGhpbmsgdGhlIHJpZ2h0IHRoaW5nIHRvIGRvIHdvdWxkIGJlIHNwbGljZSwgYnV0IF9maXJlQ2FsbGJhY2tzXG4gICAgLy8gZ2V0cyBzYWQgaWYgeW91IHJlbW92ZSBjYWxsYmFja3Mgd2hpbGUgaXRlcmF0aW5nIG92ZXIgdGhlIGxpc3QuICBTaG91bGRcbiAgICAvLyBjaGFuZ2UgdGhpcyB0byB1c2UgY2FsbGJhY2staG9vayBvciBFdmVudEVtaXR0ZXIgb3Igc29tZXRoaW5nIGVsc2UgdGhhdFxuICAgIC8vIHByb3Blcmx5IHN1cHBvcnRzIHJlbW92YWwuXG4gICAgZGVzdHJveWVkW2luZGV4XSA9IG51bGw7XG4gIH1cbn07XG5cbi8vLyBWaWV3I2F1dG9ydW4oZnVuYylcbi8vL1xuLy8vIFNldHMgdXAgYSBUcmFja2VyIGF1dG9ydW4gdGhhdCBpcyBcInNjb3BlZFwiIHRvIHRoaXMgVmlldyBpbiB0d29cbi8vLyBpbXBvcnRhbnQgd2F5czogMSkgQmxhemUuY3VycmVudFZpZXcgaXMgYXV0b21hdGljYWxseSBzZXRcbi8vLyBvbiBldmVyeSByZS1ydW4sIGFuZCAyKSB0aGUgYXV0b3J1biBpcyBzdG9wcGVkIHdoZW4gdGhlXG4vLy8gVmlldyBpcyBkZXN0cm95ZWQuICBBcyB3aXRoIFRyYWNrZXIuYXV0b3J1biwgdGhlIGZpcnN0IHJ1biBvZlxuLy8vIHRoZSBmdW5jdGlvbiBpcyBpbW1lZGlhdGUsIGFuZCBhIENvbXB1dGF0aW9uIG9iamVjdCB0aGF0IGNhblxuLy8vIGJlIHVzZWQgdG8gc3RvcCB0aGUgYXV0b3J1biBpcyByZXR1cm5lZC5cbi8vL1xuLy8vIFZpZXcjYXV0b3J1biBpcyBtZWFudCB0byBiZSBjYWxsZWQgZnJvbSBWaWV3IGNhbGxiYWNrcyBsaWtlXG4vLy8gb25WaWV3Q3JlYXRlZCwgb3IgZnJvbSBvdXRzaWRlIHRoZSByZW5kZXJpbmcgcHJvY2Vzcy4gIEl0IG1heSBub3Rcbi8vLyBiZSBjYWxsZWQgYmVmb3JlIHRoZSBvblZpZXdDcmVhdGVkIGNhbGxiYWNrcyBhcmUgZmlyZWQgKHRvbyBlYXJseSksXG4vLy8gb3IgZnJvbSBhIHJlbmRlcigpIG1ldGhvZCAodG9vIGNvbmZ1c2luZykuXG4vLy9cbi8vLyBUeXBpY2FsbHksIGF1dG9ydW5zIHRoYXQgdXBkYXRlIHRoZSBzdGF0ZVxuLy8vIG9mIHRoZSBWaWV3IChhcyBpbiBCbGF6ZS5XaXRoKSBzaG91bGQgYmUgc3RhcnRlZCBmcm9tIGFuIG9uVmlld0NyZWF0ZWRcbi8vLyBjYWxsYmFjay4gIEF1dG9ydW5zIHRoYXQgdXBkYXRlIHRoZSBET00gc2hvdWxkIGJlIHN0YXJ0ZWRcbi8vLyBmcm9tIGVpdGhlciBvblZpZXdDcmVhdGVkIChndWFyZGVkIGFnYWluc3QgdGhlIGFic2VuY2Ugb2Zcbi8vLyB2aWV3Ll9kb21yYW5nZSksIG9yIG9uVmlld1JlYWR5LlxuQmxhemUuVmlldy5wcm90b3R5cGUuYXV0b3J1biA9IGZ1bmN0aW9uIChmLCBfaW5WaWV3U2NvcGUsIGRpc3BsYXlOYW1lKSB7XG4gIHZhciBzZWxmID0gdGhpcztcblxuICAvLyBUaGUgcmVzdHJpY3Rpb25zIG9uIHdoZW4gVmlldyNhdXRvcnVuIGNhbiBiZSBjYWxsZWQgYXJlIGluIG9yZGVyXG4gIC8vIHRvIGF2b2lkIGJhZCBwYXR0ZXJucywgbGlrZSBjcmVhdGluZyBhIEJsYXplLlZpZXcgYW5kIGltbWVkaWF0ZWx5XG4gIC8vIGNhbGxpbmcgYXV0b3J1biBvbiBpdC4gIEEgZnJlc2hseSBjcmVhdGVkIFZpZXcgaXMgbm90IHJlYWR5IHRvXG4gIC8vIGhhdmUgbG9naWMgcnVuIG9uIGl0OyBpdCBkb2Vzbid0IGhhdmUgYSBwYXJlbnRWaWV3LCBmb3IgZXhhbXBsZS5cbiAgLy8gSXQncyB3aGVuIHRoZSBWaWV3IGlzIG1hdGVyaWFsaXplZCBvciBleHBhbmRlZCB0aGF0IHRoZSBvblZpZXdDcmVhdGVkXG4gIC8vIGhhbmRsZXJzIGFyZSBmaXJlZCBhbmQgdGhlIFZpZXcgc3RhcnRzIHVwLlxuICAvL1xuICAvLyBMZXR0aW5nIHRoZSByZW5kZXIoKSBtZXRob2QgY2FsbCBgdGhpcy5hdXRvcnVuKClgIGlzIHByb2JsZW1hdGljXG4gIC8vIGJlY2F1c2Ugb2YgcmUtcmVuZGVyLiAgVGhlIGJlc3Qgd2UgY2FuIGRvIGlzIHRvIHN0b3AgdGhlIG9sZFxuICAvLyBhdXRvcnVuIGFuZCBzdGFydCBhIG5ldyBvbmUgZm9yIGVhY2ggcmVuZGVyLCBidXQgdGhhdCdzIGEgcGF0dGVyblxuICAvLyB3ZSB0cnkgdG8gYXZvaWQgaW50ZXJuYWxseSBiZWNhdXNlIGl0IGxlYWRzIHRvIGhlbHBlcnMgYmVpbmdcbiAgLy8gY2FsbGVkIGV4dHJhIHRpbWVzLCBpbiB0aGUgY2FzZSB3aGVyZSB0aGUgYXV0b3J1biBjYXVzZXMgdGhlXG4gIC8vIHZpZXcgdG8gcmUtcmVuZGVyIChhbmQgdGh1cyB0aGUgYXV0b3J1biB0byBiZSB0b3JuIGRvd24gYW5kIGFcbiAgLy8gbmV3IG9uZSBlc3RhYmxpc2hlZCkuXG4gIC8vXG4gIC8vIFdlIGNvdWxkIGxpZnQgdGhlc2UgcmVzdHJpY3Rpb25zIGluIHZhcmlvdXMgd2F5cy4gIE9uZSBpbnRlcmVzdGluZ1xuICAvLyBpZGVhIGlzIHRvIGFsbG93IHlvdSB0byBjYWxsIGB2aWV3LmF1dG9ydW5gIGFmdGVyIGluc3RhbnRpYXRpbmdcbiAgLy8gYHZpZXdgLCBhbmQgYXV0b21hdGljYWxseSB3cmFwIGl0IGluIGB2aWV3Lm9uVmlld0NyZWF0ZWRgLCBkZWZlcnJpbmdcbiAgLy8gdGhlIGF1dG9ydW4gc28gdGhhdCBpdCBzdGFydHMgYXQgYW4gYXBwcm9wcmlhdGUgdGltZS4gIEhvd2V2ZXIsXG4gIC8vIHRoZW4gd2UgY2FuJ3QgcmV0dXJuIHRoZSBDb21wdXRhdGlvbiBvYmplY3QgdG8gdGhlIGNhbGxlciwgYmVjYXVzZVxuICAvLyBpdCBkb2Vzbid0IGV4aXN0IHlldC5cbiAgaWYgKCEgc2VsZi5pc0NyZWF0ZWQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJWaWV3I2F1dG9ydW4gbXVzdCBiZSBjYWxsZWQgZnJvbSB0aGUgY3JlYXRlZCBjYWxsYmFjayBhdCB0aGUgZWFybGllc3RcIik7XG4gIH1cbiAgaWYgKHRoaXMuX2lzSW5SZW5kZXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW4ndCBjYWxsIFZpZXcjYXV0b3J1biBmcm9tIGluc2lkZSByZW5kZXIoKTsgdHJ5IGNhbGxpbmcgaXQgZnJvbSB0aGUgY3JlYXRlZCBvciByZW5kZXJlZCBjYWxsYmFja1wiKTtcbiAgfVxuXG4gIHZhciB0ZW1wbGF0ZUluc3RhbmNlRnVuYyA9IEJsYXplLlRlbXBsYXRlLl9jdXJyZW50VGVtcGxhdGVJbnN0YW5jZUZ1bmM7XG5cbiAgdmFyIGZ1bmMgPSBmdW5jdGlvbiB2aWV3QXV0b3J1bihjKSB7XG4gICAgcmV0dXJuIEJsYXplLl93aXRoQ3VycmVudFZpZXcoX2luVmlld1Njb3BlIHx8IHNlbGYsIGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiBCbGF6ZS5UZW1wbGF0ZS5fd2l0aFRlbXBsYXRlSW5zdGFuY2VGdW5jKFxuICAgICAgICB0ZW1wbGF0ZUluc3RhbmNlRnVuYywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgIHJldHVybiBmLmNhbGwoc2VsZiwgYyk7XG4gICAgICAgIH0pO1xuICAgIH0pO1xuICB9O1xuXG4gIC8vIEdpdmUgdGhlIGF1dG9ydW4gZnVuY3Rpb24gYSBiZXR0ZXIgbmFtZSBmb3IgZGVidWdnaW5nIGFuZCBwcm9maWxpbmcuXG4gIC8vIFRoZSBgZGlzcGxheU5hbWVgIHByb3BlcnR5IGlzIG5vdCBwYXJ0IG9mIHRoZSBzcGVjIGJ1dCBicm93c2VycyBsaWtlIENocm9tZVxuICAvLyBhbmQgRmlyZWZveCBwcmVmZXIgaXQgaW4gZGVidWdnZXJzIG92ZXIgdGhlIG5hbWUgZnVuY3Rpb24gd2FzIGRlY2xhcmVkIGJ5LlxuICBmdW5jLmRpc3BsYXlOYW1lID1cbiAgICAoc2VsZi5uYW1lIHx8ICdhbm9ueW1vdXMnKSArICc6JyArIChkaXNwbGF5TmFtZSB8fCAnYW5vbnltb3VzJyk7XG4gIHZhciBjb21wID0gVHJhY2tlci5hdXRvcnVuKGZ1bmMpO1xuXG4gIHZhciBzdG9wQ29tcHV0YXRpb24gPSBmdW5jdGlvbiAoKSB7IGNvbXAuc3RvcCgpOyB9O1xuICBzZWxmLm9uVmlld0Rlc3Ryb3llZChzdG9wQ29tcHV0YXRpb24pO1xuICBjb21wLm9uU3RvcChmdW5jdGlvbiAoKSB7XG4gICAgc2VsZi5yZW1vdmVWaWV3RGVzdHJveWVkTGlzdGVuZXIoc3RvcENvbXB1dGF0aW9uKTtcbiAgfSk7XG5cbiAgcmV0dXJuIGNvbXA7XG59O1xuXG5CbGF6ZS5WaWV3LnByb3RvdHlwZS5fZXJyb3JJZlNob3VsZG50Q2FsbFN1YnNjcmliZSA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIGlmICghIHNlbGYuaXNDcmVhdGVkKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiVmlldyNzdWJzY3JpYmUgbXVzdCBiZSBjYWxsZWQgZnJvbSB0aGUgY3JlYXRlZCBjYWxsYmFjayBhdCB0aGUgZWFybGllc3RcIik7XG4gIH1cbiAgaWYgKHNlbGYuX2lzSW5SZW5kZXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW4ndCBjYWxsIFZpZXcjc3Vic2NyaWJlIGZyb20gaW5zaWRlIHJlbmRlcigpOyB0cnkgY2FsbGluZyBpdCBmcm9tIHRoZSBjcmVhdGVkIG9yIHJlbmRlcmVkIGNhbGxiYWNrXCIpO1xuICB9XG4gIGlmIChzZWxmLmlzRGVzdHJveWVkKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiQ2FuJ3QgY2FsbCBWaWV3I3N1YnNjcmliZSBmcm9tIGluc2lkZSB0aGUgZGVzdHJveWVkIGNhbGxiYWNrLCB0cnkgY2FsbGluZyBpdCBpbnNpZGUgY3JlYXRlZCBvciByZW5kZXJlZC5cIik7XG4gIH1cbn07XG5cbi8qKlxuICogSnVzdCBsaWtlIEJsYXplLlZpZXcjYXV0b3J1biwgYnV0IHdpdGggTWV0ZW9yLnN1YnNjcmliZSBpbnN0ZWFkIG9mXG4gKiBUcmFja2VyLmF1dG9ydW4uIFN0b3AgdGhlIHN1YnNjcmlwdGlvbiB3aGVuIHRoZSB2aWV3IGlzIGRlc3Ryb3llZC5cbiAqIEByZXR1cm4ge1N1YnNjcmlwdGlvbkhhbmRsZX0gQSBoYW5kbGUgdG8gdGhlIHN1YnNjcmlwdGlvbiBzbyB0aGF0IHlvdSBjYW5cbiAqIHNlZSBpZiBpdCBpcyByZWFkeSwgb3Igc3RvcCBpdCBtYW51YWxseVxuICovXG5CbGF6ZS5WaWV3LnByb3RvdHlwZS5zdWJzY3JpYmUgPSBmdW5jdGlvbiAoYXJncywgb3B0aW9ucykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG4gIHNlbGYuX2Vycm9ySWZTaG91bGRudENhbGxTdWJzY3JpYmUoKTtcblxuICB2YXIgc3ViSGFuZGxlO1xuICBpZiAob3B0aW9ucy5jb25uZWN0aW9uKSB7XG4gICAgc3ViSGFuZGxlID0gb3B0aW9ucy5jb25uZWN0aW9uLnN1YnNjcmliZS5hcHBseShvcHRpb25zLmNvbm5lY3Rpb24sIGFyZ3MpO1xuICB9IGVsc2Uge1xuICAgIHN1YkhhbmRsZSA9IE1ldGVvci5zdWJzY3JpYmUuYXBwbHkoTWV0ZW9yLCBhcmdzKTtcbiAgfVxuXG4gIHNlbGYub25WaWV3RGVzdHJveWVkKGZ1bmN0aW9uICgpIHtcbiAgICBzdWJIYW5kbGUuc3RvcCgpO1xuICB9KTtcblxuICByZXR1cm4gc3ViSGFuZGxlO1xufTtcblxuQmxhemUuVmlldy5wcm90b3R5cGUuZmlyc3ROb2RlID0gZnVuY3Rpb24gKCkge1xuICBpZiAoISB0aGlzLl9pc0F0dGFjaGVkKVxuICAgIHRocm93IG5ldyBFcnJvcihcIlZpZXcgbXVzdCBiZSBhdHRhY2hlZCBiZWZvcmUgYWNjZXNzaW5nIGl0cyBET01cIik7XG5cbiAgcmV0dXJuIHRoaXMuX2RvbXJhbmdlLmZpcnN0Tm9kZSgpO1xufTtcblxuQmxhemUuVmlldy5wcm90b3R5cGUubGFzdE5vZGUgPSBmdW5jdGlvbiAoKSB7XG4gIGlmICghIHRoaXMuX2lzQXR0YWNoZWQpXG4gICAgdGhyb3cgbmV3IEVycm9yKFwiVmlldyBtdXN0IGJlIGF0dGFjaGVkIGJlZm9yZSBhY2Nlc3NpbmcgaXRzIERPTVwiKTtcblxuICByZXR1cm4gdGhpcy5fZG9tcmFuZ2UubGFzdE5vZGUoKTtcbn07XG5cbkJsYXplLl9maXJlQ2FsbGJhY2tzID0gZnVuY3Rpb24gKHZpZXcsIHdoaWNoKSB7XG4gIEJsYXplLl93aXRoQ3VycmVudFZpZXcodmlldywgZnVuY3Rpb24gKCkge1xuICAgIFRyYWNrZXIubm9ucmVhY3RpdmUoZnVuY3Rpb24gZmlyZUNhbGxiYWNrcygpIHtcbiAgICAgIHZhciBjYnMgPSB2aWV3Ll9jYWxsYmFja3Nbd2hpY2hdO1xuICAgICAgZm9yICh2YXIgaSA9IDAsIE4gPSAoY2JzICYmIGNicy5sZW5ndGgpOyBpIDwgTjsgaSsrKVxuICAgICAgICBjYnNbaV0gJiYgY2JzW2ldLmNhbGwodmlldyk7XG4gICAgfSk7XG4gIH0pO1xufTtcblxuQmxhemUuX2NyZWF0ZVZpZXcgPSBmdW5jdGlvbiAodmlldywgcGFyZW50VmlldywgZm9yRXhwYW5zaW9uKSB7XG4gIGlmICh2aWV3LmlzQ3JlYXRlZClcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW4ndCByZW5kZXIgdGhlIHNhbWUgVmlldyB0d2ljZVwiKTtcblxuICB2aWV3LnBhcmVudFZpZXcgPSAocGFyZW50VmlldyB8fCBudWxsKTtcbiAgdmlldy5pc0NyZWF0ZWQgPSB0cnVlO1xuICBpZiAoZm9yRXhwYW5zaW9uKVxuICAgIHZpZXcuX2lzQ3JlYXRlZEZvckV4cGFuc2lvbiA9IHRydWU7XG5cbiAgQmxhemUuX2ZpcmVDYWxsYmFja3ModmlldywgJ2NyZWF0ZWQnKTtcbn07XG5cbnZhciBkb0ZpcnN0UmVuZGVyID0gZnVuY3Rpb24gKHZpZXcsIGluaXRpYWxDb250ZW50KSB7XG4gIHZhciBkb21yYW5nZSA9IG5ldyBCbGF6ZS5fRE9NUmFuZ2UoaW5pdGlhbENvbnRlbnQpO1xuICB2aWV3Ll9kb21yYW5nZSA9IGRvbXJhbmdlO1xuICBkb21yYW5nZS52aWV3ID0gdmlldztcbiAgdmlldy5pc1JlbmRlcmVkID0gdHJ1ZTtcbiAgQmxhemUuX2ZpcmVDYWxsYmFja3ModmlldywgJ3JlbmRlcmVkJyk7XG5cbiAgdmFyIHRlYXJkb3duSG9vayA9IG51bGw7XG5cbiAgZG9tcmFuZ2Uub25BdHRhY2hlZChmdW5jdGlvbiBhdHRhY2hlZChyYW5nZSwgZWxlbWVudCkge1xuICAgIHZpZXcuX2lzQXR0YWNoZWQgPSB0cnVlO1xuXG4gICAgdGVhcmRvd25Ib29rID0gQmxhemUuX0RPTUJhY2tlbmQuVGVhcmRvd24ub25FbGVtZW50VGVhcmRvd24oXG4gICAgICBlbGVtZW50LCBmdW5jdGlvbiB0ZWFyZG93bigpIHtcbiAgICAgICAgQmxhemUuX2Rlc3Ryb3lWaWV3KHZpZXcsIHRydWUgLyogX3NraXBOb2RlcyAqLyk7XG4gICAgICB9KTtcbiAgfSk7XG5cbiAgLy8gdGVhciBkb3duIHRoZSB0ZWFyZG93biBob29rXG4gIHZpZXcub25WaWV3RGVzdHJveWVkKGZ1bmN0aW9uICgpIHtcbiAgICB0ZWFyZG93bkhvb2sgJiYgdGVhcmRvd25Ib29rLnN0b3AoKTtcbiAgICB0ZWFyZG93bkhvb2sgPSBudWxsO1xuICB9KTtcblxuICByZXR1cm4gZG9tcmFuZ2U7XG59O1xuXG4vLyBUYWtlIGFuIHVuY3JlYXRlZCBWaWV3IGB2aWV3YCBhbmQgY3JlYXRlIGFuZCByZW5kZXIgaXQgdG8gRE9NLFxuLy8gc2V0dGluZyB1cCB0aGUgYXV0b3J1biB0aGF0IHVwZGF0ZXMgdGhlIFZpZXcuICBSZXR1cm5zIGEgbmV3XG4vLyBET01SYW5nZSwgd2hpY2ggaGFzIGJlZW4gYXNzb2NpYXRlZCB3aXRoIHRoZSBWaWV3LlxuLy9cbi8vIFRoZSBwcml2YXRlIGFyZ3VtZW50cyBgX3dvcmtTdGFja2AgYW5kIGBfaW50b0FycmF5YCBhcmUgcGFzc2VkIGluXG4vLyBieSBCbGF6ZS5fbWF0ZXJpYWxpemVET00gYW5kIGFyZSBvbmx5IHByZXNlbnQgZm9yIHJlY3Vyc2l2ZSBjYWxsc1xuLy8gKHdoZW4gdGhlcmUgaXMgc29tZSBvdGhlciBfbWF0ZXJpYWxpemVWaWV3IG9uIHRoZSBzdGFjaykuICBJZlxuLy8gcHJvdmlkZWQsIHRoZW4gd2UgYXZvaWQgdGhlIG11dHVhbCByZWN1cnNpb24gb2YgY2FsbGluZyBiYWNrIGludG9cbi8vIEJsYXplLl9tYXRlcmlhbGl6ZURPTSBzbyB0aGF0IGRlZXAgVmlldyBoaWVyYXJjaGllcyBkb24ndCBibG93IHRoZVxuLy8gc3RhY2suICBJbnN0ZWFkLCB3ZSBwdXNoIHRhc2tzIG9udG8gd29ya1N0YWNrIGZvciB0aGUgaW5pdGlhbFxuLy8gcmVuZGVyaW5nIGFuZCBzdWJzZXF1ZW50IHNldHVwIG9mIHRoZSBWaWV3LCBhbmQgdGhleSBhcmUgZG9uZSBhZnRlclxuLy8gd2UgcmV0dXJuLiAgV2hlbiB0aGVyZSBpcyBhIF93b3JrU3RhY2ssIHdlIGRvIG5vdCByZXR1cm4gdGhlIG5ld1xuLy8gRE9NUmFuZ2UsIGJ1dCBpbnN0ZWFkIHB1c2ggaXQgaW50byBfaW50b0FycmF5IGZyb20gYSBfd29ya1N0YWNrXG4vLyB0YXNrLlxuQmxhemUuX21hdGVyaWFsaXplVmlldyA9IGZ1bmN0aW9uICh2aWV3LCBwYXJlbnRWaWV3LCBfd29ya1N0YWNrLCBfaW50b0FycmF5KSB7XG4gIEJsYXplLl9jcmVhdGVWaWV3KHZpZXcsIHBhcmVudFZpZXcpO1xuXG4gIHZhciBkb21yYW5nZTtcbiAgdmFyIGxhc3RIdG1sanM7XG4gIC8vIFdlIGRvbid0IGV4cGVjdCB0byBiZSBjYWxsZWQgaW4gYSBDb21wdXRhdGlvbiwgYnV0IGp1c3QgaW4gY2FzZSxcbiAgLy8gd3JhcCBpbiBUcmFja2VyLm5vbnJlYWN0aXZlLlxuICBUcmFja2VyLm5vbnJlYWN0aXZlKGZ1bmN0aW9uICgpIHtcbiAgICB2aWV3LmF1dG9ydW4oZnVuY3Rpb24gZG9SZW5kZXIoYykge1xuICAgICAgLy8gYHZpZXcuYXV0b3J1bmAgc2V0cyB0aGUgY3VycmVudCB2aWV3LlxuICAgICAgdmlldy5yZW5kZXJDb3VudCsrO1xuICAgICAgdmlldy5faXNJblJlbmRlciA9IHRydWU7XG4gICAgICAvLyBBbnkgZGVwZW5kZW5jaWVzIHRoYXQgc2hvdWxkIGludmFsaWRhdGUgdGhpcyBDb21wdXRhdGlvbiBjb21lXG4gICAgICAvLyBmcm9tIHRoaXMgbGluZTpcbiAgICAgIHZhciBodG1sanMgPSB2aWV3Ll9yZW5kZXIoKTtcbiAgICAgIHZpZXcuX2lzSW5SZW5kZXIgPSBmYWxzZTtcblxuICAgICAgaWYgKCEgYy5maXJzdFJ1biAmJiAhIEJsYXplLl9pc0NvbnRlbnRFcXVhbChsYXN0SHRtbGpzLCBodG1sanMpKSB7XG4gICAgICAgIFRyYWNrZXIubm9ucmVhY3RpdmUoZnVuY3Rpb24gZG9NYXRlcmlhbGl6ZSgpIHtcbiAgICAgICAgICAvLyByZS1yZW5kZXJcbiAgICAgICAgICB2YXIgcmFuZ2VzQW5kTm9kZXMgPSBCbGF6ZS5fbWF0ZXJpYWxpemVET00oaHRtbGpzLCBbXSwgdmlldyk7XG4gICAgICAgICAgZG9tcmFuZ2Uuc2V0TWVtYmVycyhyYW5nZXNBbmROb2Rlcyk7XG4gICAgICAgICAgQmxhemUuX2ZpcmVDYWxsYmFja3ModmlldywgJ3JlbmRlcmVkJyk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgbGFzdEh0bWxqcyA9IGh0bWxqcztcblxuICAgICAgLy8gQ2F1c2VzIGFueSBuZXN0ZWQgdmlld3MgdG8gc3RvcCBpbW1lZGlhdGVseSwgbm90IHdoZW4gd2UgY2FsbFxuICAgICAgLy8gYHNldE1lbWJlcnNgIHRoZSBuZXh0IHRpbWUgYXJvdW5kIHRoZSBhdXRvcnVuLiAgT3RoZXJ3aXNlLFxuICAgICAgLy8gaGVscGVycyBpbiB0aGUgRE9NIHRyZWUgdG8gYmUgcmVwbGFjZWQgbWlnaHQgYmUgc2NoZWR1bGVkXG4gICAgICAvLyB0byByZS1ydW4gYmVmb3JlIHdlIGhhdmUgYSBjaGFuY2UgdG8gc3RvcCB0aGVtLlxuICAgICAgVHJhY2tlci5vbkludmFsaWRhdGUoZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoZG9tcmFuZ2UpIHtcbiAgICAgICAgICBkb21yYW5nZS5kZXN0cm95TWVtYmVycygpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9LCB1bmRlZmluZWQsICdtYXRlcmlhbGl6ZScpO1xuXG4gICAgLy8gZmlyc3QgcmVuZGVyLiAgbGFzdEh0bWxqcyBpcyB0aGUgZmlyc3QgaHRtbGpzLlxuICAgIHZhciBpbml0aWFsQ29udGVudHM7XG4gICAgaWYgKCEgX3dvcmtTdGFjaykge1xuICAgICAgaW5pdGlhbENvbnRlbnRzID0gQmxhemUuX21hdGVyaWFsaXplRE9NKGxhc3RIdG1sanMsIFtdLCB2aWV3KTtcbiAgICAgIGRvbXJhbmdlID0gZG9GaXJzdFJlbmRlcih2aWV3LCBpbml0aWFsQ29udGVudHMpO1xuICAgICAgaW5pdGlhbENvbnRlbnRzID0gbnVsbDsgLy8gaGVscCBHQyBiZWNhdXNlIHdlIGNsb3NlIG92ZXIgdGhpcyBzY29wZSBhIGxvdFxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBXZSdyZSBiZWluZyBjYWxsZWQgZnJvbSBCbGF6ZS5fbWF0ZXJpYWxpemVET00sIHNvIHRvIGF2b2lkXG4gICAgICAvLyByZWN1cnNpb24gYW5kIHNhdmUgc3RhY2sgc3BhY2UsIHByb3ZpZGUgYSBkZXNjcmlwdGlvbiBvZiB0aGVcbiAgICAgIC8vIHdvcmsgdG8gYmUgZG9uZSBpbnN0ZWFkIG9mIGRvaW5nIGl0LiAgVGFza3MgcHVzaGVkIG9udG9cbiAgICAgIC8vIF93b3JrU3RhY2sgd2lsbCBiZSBkb25lIGluIExJRk8gb3JkZXIgYWZ0ZXIgd2UgcmV0dXJuLlxuICAgICAgLy8gVGhlIHdvcmsgd2lsbCBzdGlsbCBiZSBkb25lIHdpdGhpbiBhIFRyYWNrZXIubm9ucmVhY3RpdmUsXG4gICAgICAvLyBiZWNhdXNlIGl0IHdpbGwgYmUgZG9uZSBieSBzb21lIGNhbGwgdG8gQmxhemUuX21hdGVyaWFsaXplRE9NXG4gICAgICAvLyAod2hpY2ggaXMgYWx3YXlzIGNhbGxlZCBpbiBhIFRyYWNrZXIubm9ucmVhY3RpdmUpLlxuICAgICAgaW5pdGlhbENvbnRlbnRzID0gW107XG4gICAgICAvLyBwdXNoIHRoaXMgZnVuY3Rpb24gZmlyc3Qgc28gdGhhdCBpdCBoYXBwZW5zIGxhc3RcbiAgICAgIF93b3JrU3RhY2sucHVzaChmdW5jdGlvbiAoKSB7XG4gICAgICAgIGRvbXJhbmdlID0gZG9GaXJzdFJlbmRlcih2aWV3LCBpbml0aWFsQ29udGVudHMpO1xuICAgICAgICBpbml0aWFsQ29udGVudHMgPSBudWxsOyAvLyBoZWxwIEdDIGJlY2F1c2Ugb2YgYWxsIHRoZSBjbG9zdXJlcyBoZXJlXG4gICAgICAgIF9pbnRvQXJyYXkucHVzaChkb21yYW5nZSk7XG4gICAgICB9KTtcbiAgICAgIC8vIG5vdyBwdXNoIHRoZSB0YXNrIHRoYXQgY2FsY3VsYXRlcyBpbml0aWFsQ29udGVudHNcbiAgICAgIF93b3JrU3RhY2sucHVzaChCbGF6ZS5fYmluZChCbGF6ZS5fbWF0ZXJpYWxpemVET00sIG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhc3RIdG1sanMsIGluaXRpYWxDb250ZW50cywgdmlldywgX3dvcmtTdGFjaykpO1xuICAgIH1cbiAgfSk7XG5cbiAgaWYgKCEgX3dvcmtTdGFjaykge1xuICAgIHJldHVybiBkb21yYW5nZTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufTtcblxuLy8gRXhwYW5kcyBhIFZpZXcgdG8gSFRNTGpzLCBjYWxsaW5nIGByZW5kZXJgIHJlY3Vyc2l2ZWx5IG9uIGFsbFxuLy8gVmlld3MgYW5kIGV2YWx1YXRpbmcgYW55IGR5bmFtaWMgYXR0cmlidXRlcy4gIENhbGxzIHRoZSBgY3JlYXRlZGBcbi8vIGNhbGxiYWNrLCBidXQgbm90IHRoZSBgbWF0ZXJpYWxpemVkYCBvciBgcmVuZGVyZWRgIGNhbGxiYWNrcy5cbi8vIERlc3Ryb3lzIHRoZSB2aWV3IGltbWVkaWF0ZWx5LCB1bmxlc3MgY2FsbGVkIGluIGEgVHJhY2tlciBDb21wdXRhdGlvbixcbi8vIGluIHdoaWNoIGNhc2UgdGhlIHZpZXcgd2lsbCBiZSBkZXN0cm95ZWQgd2hlbiB0aGUgQ29tcHV0YXRpb24gaXNcbi8vIGludmFsaWRhdGVkLiAgSWYgY2FsbGVkIGluIGEgVHJhY2tlciBDb21wdXRhdGlvbiwgdGhlIHJlc3VsdCBpcyBhXG4vLyByZWFjdGl2ZSBzdHJpbmc7IHRoYXQgaXMsIHRoZSBDb21wdXRhdGlvbiB3aWxsIGJlIGludmFsaWRhdGVkXG4vLyBpZiBhbnkgY2hhbmdlcyBhcmUgbWFkZSB0byB0aGUgdmlldyBvciBzdWJ2aWV3cyB0aGF0IG1pZ2h0IGFmZmVjdFxuLy8gdGhlIEhUTUwuXG5CbGF6ZS5fZXhwYW5kVmlldyA9IGZ1bmN0aW9uICh2aWV3LCBwYXJlbnRWaWV3KSB7XG4gIEJsYXplLl9jcmVhdGVWaWV3KHZpZXcsIHBhcmVudFZpZXcsIHRydWUgLypmb3JFeHBhbnNpb24qLyk7XG5cbiAgdmlldy5faXNJblJlbmRlciA9IHRydWU7XG4gIHZhciBodG1sanMgPSBCbGF6ZS5fd2l0aEN1cnJlbnRWaWV3KHZpZXcsIGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdmlldy5fcmVuZGVyKCk7XG4gIH0pO1xuICB2aWV3Ll9pc0luUmVuZGVyID0gZmFsc2U7XG5cbiAgdmFyIHJlc3VsdCA9IEJsYXplLl9leHBhbmQoaHRtbGpzLCB2aWV3KTtcblxuICBpZiAoVHJhY2tlci5hY3RpdmUpIHtcbiAgICBUcmFja2VyLm9uSW52YWxpZGF0ZShmdW5jdGlvbiAoKSB7XG4gICAgICBCbGF6ZS5fZGVzdHJveVZpZXcodmlldyk7XG4gICAgfSk7XG4gIH0gZWxzZSB7XG4gICAgQmxhemUuX2Rlc3Ryb3lWaWV3KHZpZXcpO1xuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbi8vIE9wdGlvbnM6IGBwYXJlbnRWaWV3YFxuQmxhemUuX0hUTUxKU0V4cGFuZGVyID0gSFRNTC5UcmFuc2Zvcm1pbmdWaXNpdG9yLmV4dGVuZCgpO1xuQmxhemUuX0hUTUxKU0V4cGFuZGVyLmRlZih7XG4gIHZpc2l0T2JqZWN0OiBmdW5jdGlvbiAoeCkge1xuICAgIGlmICh4IGluc3RhbmNlb2YgQmxhemUuVGVtcGxhdGUpXG4gICAgICB4ID0geC5jb25zdHJ1Y3RWaWV3KCk7XG4gICAgaWYgKHggaW5zdGFuY2VvZiBCbGF6ZS5WaWV3KVxuICAgICAgcmV0dXJuIEJsYXplLl9leHBhbmRWaWV3KHgsIHRoaXMucGFyZW50Vmlldyk7XG5cbiAgICAvLyB0aGlzIHdpbGwgdGhyb3cgYW4gZXJyb3I7IG90aGVyIG9iamVjdHMgYXJlIG5vdCBhbGxvd2VkIVxuICAgIHJldHVybiBIVE1MLlRyYW5zZm9ybWluZ1Zpc2l0b3IucHJvdG90eXBlLnZpc2l0T2JqZWN0LmNhbGwodGhpcywgeCk7XG4gIH0sXG4gIHZpc2l0QXR0cmlidXRlczogZnVuY3Rpb24gKGF0dHJzKSB7XG4gICAgLy8gZXhwYW5kIGR5bmFtaWMgYXR0cmlidXRlc1xuICAgIGlmICh0eXBlb2YgYXR0cnMgPT09ICdmdW5jdGlvbicpXG4gICAgICBhdHRycyA9IEJsYXplLl93aXRoQ3VycmVudFZpZXcodGhpcy5wYXJlbnRWaWV3LCBhdHRycyk7XG5cbiAgICAvLyBjYWxsIHN1cGVyIChlLmcuIGZvciBjYXNlIHdoZXJlIGBhdHRyc2AgaXMgYW4gYXJyYXkpXG4gICAgcmV0dXJuIEhUTUwuVHJhbnNmb3JtaW5nVmlzaXRvci5wcm90b3R5cGUudmlzaXRBdHRyaWJ1dGVzLmNhbGwodGhpcywgYXR0cnMpO1xuICB9LFxuICB2aXNpdEF0dHJpYnV0ZTogZnVuY3Rpb24gKG5hbWUsIHZhbHVlLCB0YWcpIHtcbiAgICAvLyBleHBhbmQgYXR0cmlidXRlIHZhbHVlcyB0aGF0IGFyZSBmdW5jdGlvbnMuICBBbnkgYXR0cmlidXRlIHZhbHVlXG4gICAgLy8gdGhhdCBjb250YWlucyBWaWV3cyBtdXN0IGJlIHdyYXBwZWQgaW4gYSBmdW5jdGlvbi5cbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnZnVuY3Rpb24nKVxuICAgICAgdmFsdWUgPSBCbGF6ZS5fd2l0aEN1cnJlbnRWaWV3KHRoaXMucGFyZW50VmlldywgdmFsdWUpO1xuXG4gICAgcmV0dXJuIEhUTUwuVHJhbnNmb3JtaW5nVmlzaXRvci5wcm90b3R5cGUudmlzaXRBdHRyaWJ1dGUuY2FsbChcbiAgICAgIHRoaXMsIG5hbWUsIHZhbHVlLCB0YWcpO1xuICB9XG59KTtcblxuLy8gUmV0dXJuIEJsYXplLmN1cnJlbnRWaWV3LCBidXQgb25seSBpZiBpdCBpcyBiZWluZyByZW5kZXJlZFxuLy8gKGkuZS4gd2UgYXJlIGluIGl0cyByZW5kZXIoKSBtZXRob2QpLlxudmFyIGN1cnJlbnRWaWV3SWZSZW5kZXJpbmcgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciB2aWV3ID0gQmxhemUuY3VycmVudFZpZXc7XG4gIHJldHVybiAodmlldyAmJiB2aWV3Ll9pc0luUmVuZGVyKSA/IHZpZXcgOiBudWxsO1xufTtcblxuQmxhemUuX2V4cGFuZCA9IGZ1bmN0aW9uIChodG1sanMsIHBhcmVudFZpZXcpIHtcbiAgcGFyZW50VmlldyA9IHBhcmVudFZpZXcgfHwgY3VycmVudFZpZXdJZlJlbmRlcmluZygpO1xuICByZXR1cm4gKG5ldyBCbGF6ZS5fSFRNTEpTRXhwYW5kZXIoXG4gICAge3BhcmVudFZpZXc6IHBhcmVudFZpZXd9KSkudmlzaXQoaHRtbGpzKTtcbn07XG5cbkJsYXplLl9leHBhbmRBdHRyaWJ1dGVzID0gZnVuY3Rpb24gKGF0dHJzLCBwYXJlbnRWaWV3KSB7XG4gIHBhcmVudFZpZXcgPSBwYXJlbnRWaWV3IHx8IGN1cnJlbnRWaWV3SWZSZW5kZXJpbmcoKTtcbiAgcmV0dXJuIChuZXcgQmxhemUuX0hUTUxKU0V4cGFuZGVyKFxuICAgIHtwYXJlbnRWaWV3OiBwYXJlbnRWaWV3fSkpLnZpc2l0QXR0cmlidXRlcyhhdHRycyk7XG59O1xuXG5CbGF6ZS5fZGVzdHJveVZpZXcgPSBmdW5jdGlvbiAodmlldywgX3NraXBOb2Rlcykge1xuICBpZiAodmlldy5pc0Rlc3Ryb3llZClcbiAgICByZXR1cm47XG4gIHZpZXcuaXNEZXN0cm95ZWQgPSB0cnVlO1xuXG4gIEJsYXplLl9maXJlQ2FsbGJhY2tzKHZpZXcsICdkZXN0cm95ZWQnKTtcblxuICAvLyBEZXN0cm95IHZpZXdzIGFuZCBlbGVtZW50cyByZWN1cnNpdmVseS4gIElmIF9za2lwTm9kZXMsXG4gIC8vIG9ubHkgcmVjdXJzZSB1cCB0byB2aWV3cywgbm90IGVsZW1lbnRzLCBmb3IgdGhlIGNhc2Ugd2hlcmVcbiAgLy8gdGhlIGJhY2tlbmQgKGpRdWVyeSkgaXMgcmVjdXJzaW5nIG92ZXIgdGhlIGVsZW1lbnRzIGFscmVhZHkuXG5cbiAgaWYgKHZpZXcuX2RvbXJhbmdlKVxuICAgIHZpZXcuX2RvbXJhbmdlLmRlc3Ryb3lNZW1iZXJzKF9za2lwTm9kZXMpO1xufTtcblxuQmxhemUuX2Rlc3Ryb3lOb2RlID0gZnVuY3Rpb24gKG5vZGUpIHtcbiAgaWYgKG5vZGUubm9kZVR5cGUgPT09IDEpXG4gICAgQmxhemUuX0RPTUJhY2tlbmQuVGVhcmRvd24udGVhckRvd25FbGVtZW50KG5vZGUpO1xufTtcblxuLy8gQXJlIHRoZSBIVE1ManMgZW50aXRpZXMgYGFgIGFuZCBgYmAgdGhlIHNhbWU/ICBXZSBjb3VsZCBiZVxuLy8gbW9yZSBlbGFib3JhdGUgaGVyZSBidXQgdGhlIHBvaW50IGlzIHRvIGNhdGNoIHRoZSBtb3N0IGJhc2ljXG4vLyBjYXNlcy5cbkJsYXplLl9pc0NvbnRlbnRFcXVhbCA9IGZ1bmN0aW9uIChhLCBiKSB7XG4gIGlmIChhIGluc3RhbmNlb2YgSFRNTC5SYXcpIHtcbiAgICByZXR1cm4gKGIgaW5zdGFuY2VvZiBIVE1MLlJhdykgJiYgKGEudmFsdWUgPT09IGIudmFsdWUpO1xuICB9IGVsc2UgaWYgKGEgPT0gbnVsbCkge1xuICAgIHJldHVybiAoYiA9PSBudWxsKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gKGEgPT09IGIpICYmXG4gICAgICAoKHR5cGVvZiBhID09PSAnbnVtYmVyJykgfHwgKHR5cGVvZiBhID09PSAnYm9vbGVhbicpIHx8XG4gICAgICAgKHR5cGVvZiBhID09PSAnc3RyaW5nJykpO1xuICB9XG59O1xuXG4vKipcbiAqIEBzdW1tYXJ5IFRoZSBWaWV3IGNvcnJlc3BvbmRpbmcgdG8gdGhlIGN1cnJlbnQgdGVtcGxhdGUgaGVscGVyLCBldmVudCBoYW5kbGVyLCBjYWxsYmFjaywgb3IgYXV0b3J1bi4gIElmIHRoZXJlIGlzbid0IG9uZSwgYG51bGxgLlxuICogQGxvY3VzIENsaWVudFxuICogQHR5cGUge0JsYXplLlZpZXd9XG4gKi9cbkJsYXplLmN1cnJlbnRWaWV3ID0gbnVsbDtcblxuQmxhemUuX3dpdGhDdXJyZW50VmlldyA9IGZ1bmN0aW9uICh2aWV3LCBmdW5jKSB7XG4gIHZhciBvbGRWaWV3ID0gQmxhemUuY3VycmVudFZpZXc7XG4gIHRyeSB7XG4gICAgQmxhemUuY3VycmVudFZpZXcgPSB2aWV3O1xuICAgIHJldHVybiBmdW5jKCk7XG4gIH0gZmluYWxseSB7XG4gICAgQmxhemUuY3VycmVudFZpZXcgPSBvbGRWaWV3O1xuICB9XG59O1xuXG4vLyBCbGF6ZS5yZW5kZXIgcHVibGljbHkgdGFrZXMgYSBWaWV3IG9yIGEgVGVtcGxhdGUuXG4vLyBQcml2YXRlbHksIGl0IHRha2VzIGFueSBIVE1MSlMgKGV4dGVuZGVkIHdpdGggVmlld3MgYW5kIFRlbXBsYXRlcylcbi8vIGV4Y2VwdCBudWxsIG9yIHVuZGVmaW5lZCwgb3IgYSBmdW5jdGlvbiB0aGF0IHJldHVybnMgYW55IGV4dGVuZGVkXG4vLyBIVE1MSlMuXG52YXIgY2hlY2tSZW5kZXJDb250ZW50ID0gZnVuY3Rpb24gKGNvbnRlbnQpIHtcbiAgaWYgKGNvbnRlbnQgPT09IG51bGwpXG4gICAgdGhyb3cgbmV3IEVycm9yKFwiQ2FuJ3QgcmVuZGVyIG51bGxcIik7XG4gIGlmICh0eXBlb2YgY29udGVudCA9PT0gJ3VuZGVmaW5lZCcpXG4gICAgdGhyb3cgbmV3IEVycm9yKFwiQ2FuJ3QgcmVuZGVyIHVuZGVmaW5lZFwiKTtcblxuICBpZiAoKGNvbnRlbnQgaW5zdGFuY2VvZiBCbGF6ZS5WaWV3KSB8fFxuICAgICAgKGNvbnRlbnQgaW5zdGFuY2VvZiBCbGF6ZS5UZW1wbGF0ZSkgfHxcbiAgICAgICh0eXBlb2YgY29udGVudCA9PT0gJ2Z1bmN0aW9uJykpXG4gICAgcmV0dXJuO1xuXG4gIHRyeSB7XG4gICAgLy8gVGhyb3cgaWYgY29udGVudCBkb2Vzbid0IGxvb2sgbGlrZSBIVE1MSlMgYXQgdGhlIHRvcCBsZXZlbFxuICAgIC8vIChpLmUuIHZlcmlmeSB0aGF0IHRoaXMgaXMgYW4gSFRNTC5UYWcsIG9yIGFuIGFycmF5LFxuICAgIC8vIG9yIGEgcHJpbWl0aXZlLCBldGMuKVxuICAgIChuZXcgSFRNTC5WaXNpdG9yKS52aXNpdChjb250ZW50KTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIC8vIE1ha2UgZXJyb3IgbWVzc2FnZSBzdWl0YWJsZSBmb3IgcHVibGljIEFQSVxuICAgIHRocm93IG5ldyBFcnJvcihcIkV4cGVjdGVkIFRlbXBsYXRlIG9yIFZpZXdcIik7XG4gIH1cbn07XG5cbi8vIEZvciBCbGF6ZS5yZW5kZXIgYW5kIEJsYXplLnRvSFRNTCwgdGFrZSBjb250ZW50IGFuZFxuLy8gd3JhcCBpdCBpbiBhIFZpZXcsIHVubGVzcyBpdCdzIGEgc2luZ2xlIFZpZXcgb3Jcbi8vIFRlbXBsYXRlIGFscmVhZHkuXG52YXIgY29udGVudEFzVmlldyA9IGZ1bmN0aW9uIChjb250ZW50KSB7XG4gIGNoZWNrUmVuZGVyQ29udGVudChjb250ZW50KTtcblxuICBpZiAoY29udGVudCBpbnN0YW5jZW9mIEJsYXplLlRlbXBsYXRlKSB7XG4gICAgcmV0dXJuIGNvbnRlbnQuY29uc3RydWN0VmlldygpO1xuICB9IGVsc2UgaWYgKGNvbnRlbnQgaW5zdGFuY2VvZiBCbGF6ZS5WaWV3KSB7XG4gICAgcmV0dXJuIGNvbnRlbnQ7XG4gIH0gZWxzZSB7XG4gICAgdmFyIGZ1bmMgPSBjb250ZW50O1xuICAgIGlmICh0eXBlb2YgZnVuYyAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgZnVuYyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIGNvbnRlbnQ7XG4gICAgICB9O1xuICAgIH1cbiAgICByZXR1cm4gQmxhemUuVmlldygncmVuZGVyJywgZnVuYyk7XG4gIH1cbn07XG5cbi8vIEZvciBCbGF6ZS5yZW5kZXJXaXRoRGF0YSBhbmQgQmxhemUudG9IVE1MV2l0aERhdGEsIHdyYXAgY29udGVudFxuLy8gaW4gYSBmdW5jdGlvbiwgaWYgbmVjZXNzYXJ5LCBzbyBpdCBjYW4gYmUgYSBjb250ZW50IGFyZyB0b1xuLy8gYSBCbGF6ZS5XaXRoLlxudmFyIGNvbnRlbnRBc0Z1bmMgPSBmdW5jdGlvbiAoY29udGVudCkge1xuICBjaGVja1JlbmRlckNvbnRlbnQoY29udGVudCk7XG5cbiAgaWYgKHR5cGVvZiBjb250ZW50ICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiBjb250ZW50O1xuICAgIH07XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGNvbnRlbnQ7XG4gIH1cbn07XG5cbi8qKlxuICogQHN1bW1hcnkgUmVuZGVycyBhIHRlbXBsYXRlIG9yIFZpZXcgdG8gRE9NIG5vZGVzIGFuZCBpbnNlcnRzIGl0IGludG8gdGhlIERPTSwgcmV0dXJuaW5nIGEgcmVuZGVyZWQgW1ZpZXddKCNCbGF6ZS1WaWV3KSB3aGljaCBjYW4gYmUgcGFzc2VkIHRvIFtgQmxhemUucmVtb3ZlYF0oI0JsYXplLXJlbW92ZSkuXG4gKiBAbG9jdXMgQ2xpZW50XG4gKiBAcGFyYW0ge1RlbXBsYXRlfEJsYXplLlZpZXd9IHRlbXBsYXRlT3JWaWV3IFRoZSB0ZW1wbGF0ZSAoZS5nLiBgVGVtcGxhdGUubXlUZW1wbGF0ZWApIG9yIFZpZXcgb2JqZWN0IHRvIHJlbmRlci4gIElmIGEgdGVtcGxhdGUsIGEgVmlldyBvYmplY3QgaXMgW2NvbnN0cnVjdGVkXSgjdGVtcGxhdGVfY29uc3RydWN0dmlldykuICBJZiBhIFZpZXcsIGl0IG11c3QgYmUgYW4gdW5yZW5kZXJlZCBWaWV3LCB3aGljaCBiZWNvbWVzIGEgcmVuZGVyZWQgVmlldyBhbmQgaXMgcmV0dXJuZWQuXG4gKiBAcGFyYW0ge0RPTU5vZGV9IHBhcmVudE5vZGUgVGhlIG5vZGUgdGhhdCB3aWxsIGJlIHRoZSBwYXJlbnQgb2YgdGhlIHJlbmRlcmVkIHRlbXBsYXRlLiAgSXQgbXVzdCBiZSBhbiBFbGVtZW50IG5vZGUuXG4gKiBAcGFyYW0ge0RPTU5vZGV9IFtuZXh0Tm9kZV0gT3B0aW9uYWwuIElmIHByb3ZpZGVkLCBtdXN0IGJlIGEgY2hpbGQgb2YgPGVtPnBhcmVudE5vZGU8L2VtPjsgdGhlIHRlbXBsYXRlIHdpbGwgYmUgaW5zZXJ0ZWQgYmVmb3JlIHRoaXMgbm9kZS4gSWYgbm90IHByb3ZpZGVkLCB0aGUgdGVtcGxhdGUgd2lsbCBiZSBpbnNlcnRlZCBhcyB0aGUgbGFzdCBjaGlsZCBvZiBwYXJlbnROb2RlLlxuICogQHBhcmFtIHtCbGF6ZS5WaWV3fSBbcGFyZW50Vmlld10gT3B0aW9uYWwuIElmIHByb3ZpZGVkLCBpdCB3aWxsIGJlIHNldCBhcyB0aGUgcmVuZGVyZWQgVmlldydzIFtgcGFyZW50Vmlld2BdKCN2aWV3X3BhcmVudHZpZXcpLlxuICovXG5CbGF6ZS5yZW5kZXIgPSBmdW5jdGlvbiAoY29udGVudCwgcGFyZW50RWxlbWVudCwgbmV4dE5vZGUsIHBhcmVudFZpZXcpIHtcbiAgaWYgKCEgcGFyZW50RWxlbWVudCkge1xuICAgIEJsYXplLl93YXJuKFwiQmxhemUucmVuZGVyIHdpdGhvdXQgYSBwYXJlbnQgZWxlbWVudCBpcyBkZXByZWNhdGVkLiBcIiArXG4gICAgICAgICAgICAgICAgXCJZb3UgbXVzdCBzcGVjaWZ5IHdoZXJlIHRvIGluc2VydCB0aGUgcmVuZGVyZWQgY29udGVudC5cIik7XG4gIH1cblxuICBpZiAobmV4dE5vZGUgaW5zdGFuY2VvZiBCbGF6ZS5WaWV3KSB7XG4gICAgLy8gaGFuZGxlIG9taXR0ZWQgbmV4dE5vZGVcbiAgICBwYXJlbnRWaWV3ID0gbmV4dE5vZGU7XG4gICAgbmV4dE5vZGUgPSBudWxsO1xuICB9XG5cbiAgLy8gcGFyZW50RWxlbWVudCBtdXN0IGJlIGEgRE9NIG5vZGUuIGluIHBhcnRpY3VsYXIsIGNhbid0IGJlIHRoZVxuICAvLyByZXN1bHQgb2YgYSBjYWxsIHRvIGAkYC4gQ2FuJ3QgY2hlY2sgaWYgYHBhcmVudEVsZW1lbnQgaW5zdGFuY2VvZlxuICAvLyBOb2RlYCBzaW5jZSAnTm9kZScgaXMgdW5kZWZpbmVkIGluIElFOC5cbiAgaWYgKHBhcmVudEVsZW1lbnQgJiYgdHlwZW9mIHBhcmVudEVsZW1lbnQubm9kZVR5cGUgIT09ICdudW1iZXInKVxuICAgIHRocm93IG5ldyBFcnJvcihcIidwYXJlbnRFbGVtZW50JyBtdXN0IGJlIGEgRE9NIG5vZGVcIik7XG4gIGlmIChuZXh0Tm9kZSAmJiB0eXBlb2YgbmV4dE5vZGUubm9kZVR5cGUgIT09ICdudW1iZXInKSAvLyAnbmV4dE5vZGUnIGlzIG9wdGlvbmFsXG4gICAgdGhyb3cgbmV3IEVycm9yKFwiJ25leHROb2RlJyBtdXN0IGJlIGEgRE9NIG5vZGVcIik7XG5cbiAgcGFyZW50VmlldyA9IHBhcmVudFZpZXcgfHwgY3VycmVudFZpZXdJZlJlbmRlcmluZygpO1xuXG4gIHZhciB2aWV3ID0gY29udGVudEFzVmlldyhjb250ZW50KTtcbiAgQmxhemUuX21hdGVyaWFsaXplVmlldyh2aWV3LCBwYXJlbnRWaWV3KTtcblxuICBpZiAocGFyZW50RWxlbWVudCkge1xuICAgIHZpZXcuX2RvbXJhbmdlLmF0dGFjaChwYXJlbnRFbGVtZW50LCBuZXh0Tm9kZSk7XG4gIH1cblxuICByZXR1cm4gdmlldztcbn07XG5cbkJsYXplLmluc2VydCA9IGZ1bmN0aW9uICh2aWV3LCBwYXJlbnRFbGVtZW50LCBuZXh0Tm9kZSkge1xuICBCbGF6ZS5fd2FybihcIkJsYXplLmluc2VydCBoYXMgYmVlbiBkZXByZWNhdGVkLiAgU3BlY2lmeSB3aGVyZSB0byBpbnNlcnQgdGhlIFwiICtcbiAgICAgICAgICAgICAgXCJyZW5kZXJlZCBjb250ZW50IGluIHRoZSBjYWxsIHRvIEJsYXplLnJlbmRlci5cIik7XG5cbiAgaWYgKCEgKHZpZXcgJiYgKHZpZXcuX2RvbXJhbmdlIGluc3RhbmNlb2YgQmxhemUuX0RPTVJhbmdlKSkpXG4gICAgdGhyb3cgbmV3IEVycm9yKFwiRXhwZWN0ZWQgdGVtcGxhdGUgcmVuZGVyZWQgd2l0aCBCbGF6ZS5yZW5kZXJcIik7XG5cbiAgdmlldy5fZG9tcmFuZ2UuYXR0YWNoKHBhcmVudEVsZW1lbnQsIG5leHROb2RlKTtcbn07XG5cbi8qKlxuICogQHN1bW1hcnkgUmVuZGVycyBhIHRlbXBsYXRlIG9yIFZpZXcgdG8gRE9NIG5vZGVzIHdpdGggYSBkYXRhIGNvbnRleHQuICBPdGhlcndpc2UgaWRlbnRpY2FsIHRvIGBCbGF6ZS5yZW5kZXJgLlxuICogQGxvY3VzIENsaWVudFxuICogQHBhcmFtIHtUZW1wbGF0ZXxCbGF6ZS5WaWV3fSB0ZW1wbGF0ZU9yVmlldyBUaGUgdGVtcGxhdGUgKGUuZy4gYFRlbXBsYXRlLm15VGVtcGxhdGVgKSBvciBWaWV3IG9iamVjdCB0byByZW5kZXIuXG4gKiBAcGFyYW0ge09iamVjdHxGdW5jdGlvbn0gZGF0YSBUaGUgZGF0YSBjb250ZXh0IHRvIHVzZSwgb3IgYSBmdW5jdGlvbiByZXR1cm5pbmcgYSBkYXRhIGNvbnRleHQuICBJZiBhIGZ1bmN0aW9uIGlzIHByb3ZpZGVkLCBpdCB3aWxsIGJlIHJlYWN0aXZlbHkgcmUtcnVuLlxuICogQHBhcmFtIHtET01Ob2RlfSBwYXJlbnROb2RlIFRoZSBub2RlIHRoYXQgd2lsbCBiZSB0aGUgcGFyZW50IG9mIHRoZSByZW5kZXJlZCB0ZW1wbGF0ZS4gIEl0IG11c3QgYmUgYW4gRWxlbWVudCBub2RlLlxuICogQHBhcmFtIHtET01Ob2RlfSBbbmV4dE5vZGVdIE9wdGlvbmFsLiBJZiBwcm92aWRlZCwgbXVzdCBiZSBhIGNoaWxkIG9mIDxlbT5wYXJlbnROb2RlPC9lbT47IHRoZSB0ZW1wbGF0ZSB3aWxsIGJlIGluc2VydGVkIGJlZm9yZSB0aGlzIG5vZGUuIElmIG5vdCBwcm92aWRlZCwgdGhlIHRlbXBsYXRlIHdpbGwgYmUgaW5zZXJ0ZWQgYXMgdGhlIGxhc3QgY2hpbGQgb2YgcGFyZW50Tm9kZS5cbiAqIEBwYXJhbSB7QmxhemUuVmlld30gW3BhcmVudFZpZXddIE9wdGlvbmFsLiBJZiBwcm92aWRlZCwgaXQgd2lsbCBiZSBzZXQgYXMgdGhlIHJlbmRlcmVkIFZpZXcncyBbYHBhcmVudFZpZXdgXSgjdmlld19wYXJlbnR2aWV3KS5cbiAqL1xuQmxhemUucmVuZGVyV2l0aERhdGEgPSBmdW5jdGlvbiAoY29udGVudCwgZGF0YSwgcGFyZW50RWxlbWVudCwgbmV4dE5vZGUsIHBhcmVudFZpZXcpIHtcbiAgLy8gV2UgZGVmZXIgdGhlIGhhbmRsaW5nIG9mIG9wdGlvbmFsIGFyZ3VtZW50cyB0byBCbGF6ZS5yZW5kZXIuICBBdCB0aGlzIHBvaW50LFxuICAvLyBgbmV4dE5vZGVgIG1heSBhY3R1YWxseSBiZSBgcGFyZW50Vmlld2AuXG4gIHJldHVybiBCbGF6ZS5yZW5kZXIoQmxhemUuX1RlbXBsYXRlV2l0aChkYXRhLCBjb250ZW50QXNGdW5jKGNvbnRlbnQpKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgcGFyZW50RWxlbWVudCwgbmV4dE5vZGUsIHBhcmVudFZpZXcpO1xufTtcblxuLyoqXG4gKiBAc3VtbWFyeSBSZW1vdmVzIGEgcmVuZGVyZWQgVmlldyBmcm9tIHRoZSBET00sIHN0b3BwaW5nIGFsbCByZWFjdGl2ZSB1cGRhdGVzIGFuZCBldmVudCBsaXN0ZW5lcnMgb24gaXQuIEFsc28gZGVzdHJveXMgdGhlIEJsYXplLlRlbXBsYXRlIGluc3RhbmNlIGFzc29jaWF0ZWQgd2l0aCB0aGUgdmlldy5cbiAqIEBsb2N1cyBDbGllbnRcbiAqIEBwYXJhbSB7QmxhemUuVmlld30gcmVuZGVyZWRWaWV3IFRoZSByZXR1cm4gdmFsdWUgZnJvbSBgQmxhemUucmVuZGVyYCBvciBgQmxhemUucmVuZGVyV2l0aERhdGFgLCBvciB0aGUgYHZpZXdgIHByb3BlcnR5IG9mIGEgQmxhemUuVGVtcGxhdGUgaW5zdGFuY2UuIENhbGxpbmcgYEJsYXplLnJlbW92ZShUZW1wbGF0ZS5pbnN0YW5jZSgpLnZpZXcpYCBmcm9tIHdpdGhpbiBhIHRlbXBsYXRlIGV2ZW50IGhhbmRsZXIgd2lsbCBkZXN0cm95IHRoZSB2aWV3IGFzIHdlbGwgYXMgdGhhdCB0ZW1wbGF0ZSBhbmQgdHJpZ2dlciB0aGUgdGVtcGxhdGUncyBgb25EZXN0cm95ZWRgIGhhbmRsZXJzLlxuICovXG5CbGF6ZS5yZW1vdmUgPSBmdW5jdGlvbiAodmlldykge1xuICBpZiAoISAodmlldyAmJiAodmlldy5fZG9tcmFuZ2UgaW5zdGFuY2VvZiBCbGF6ZS5fRE9NUmFuZ2UpKSlcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJFeHBlY3RlZCB0ZW1wbGF0ZSByZW5kZXJlZCB3aXRoIEJsYXplLnJlbmRlclwiKTtcblxuICB3aGlsZSAodmlldykge1xuICAgIGlmICghIHZpZXcuaXNEZXN0cm95ZWQpIHtcbiAgICAgIHZhciByYW5nZSA9IHZpZXcuX2RvbXJhbmdlO1xuICAgICAgaWYgKHJhbmdlLmF0dGFjaGVkICYmICEgcmFuZ2UucGFyZW50UmFuZ2UpXG4gICAgICAgIHJhbmdlLmRldGFjaCgpO1xuICAgICAgcmFuZ2UuZGVzdHJveSgpO1xuICAgIH1cblxuICAgIHZpZXcgPSB2aWV3Ll9oYXNHZW5lcmF0ZWRQYXJlbnQgJiYgdmlldy5wYXJlbnRWaWV3O1xuICB9XG59O1xuXG4vKipcbiAqIEBzdW1tYXJ5IFJlbmRlcnMgYSB0ZW1wbGF0ZSBvciBWaWV3IHRvIGEgc3RyaW5nIG9mIEhUTUwuXG4gKiBAbG9jdXMgQ2xpZW50XG4gKiBAcGFyYW0ge1RlbXBsYXRlfEJsYXplLlZpZXd9IHRlbXBsYXRlT3JWaWV3IFRoZSB0ZW1wbGF0ZSAoZS5nLiBgVGVtcGxhdGUubXlUZW1wbGF0ZWApIG9yIFZpZXcgb2JqZWN0IGZyb20gd2hpY2ggdG8gZ2VuZXJhdGUgSFRNTC5cbiAqL1xuQmxhemUudG9IVE1MID0gZnVuY3Rpb24gKGNvbnRlbnQsIHBhcmVudFZpZXcpIHtcbiAgcGFyZW50VmlldyA9IHBhcmVudFZpZXcgfHwgY3VycmVudFZpZXdJZlJlbmRlcmluZygpO1xuXG4gIHJldHVybiBIVE1MLnRvSFRNTChCbGF6ZS5fZXhwYW5kVmlldyhjb250ZW50QXNWaWV3KGNvbnRlbnQpLCBwYXJlbnRWaWV3KSk7XG59O1xuXG4vKipcbiAqIEBzdW1tYXJ5IFJlbmRlcnMgYSB0ZW1wbGF0ZSBvciBWaWV3IHRvIEhUTUwgd2l0aCBhIGRhdGEgY29udGV4dC4gIE90aGVyd2lzZSBpZGVudGljYWwgdG8gYEJsYXplLnRvSFRNTGAuXG4gKiBAbG9jdXMgQ2xpZW50XG4gKiBAcGFyYW0ge1RlbXBsYXRlfEJsYXplLlZpZXd9IHRlbXBsYXRlT3JWaWV3IFRoZSB0ZW1wbGF0ZSAoZS5nLiBgVGVtcGxhdGUubXlUZW1wbGF0ZWApIG9yIFZpZXcgb2JqZWN0IGZyb20gd2hpY2ggdG8gZ2VuZXJhdGUgSFRNTC5cbiAqIEBwYXJhbSB7T2JqZWN0fEZ1bmN0aW9ufSBkYXRhIFRoZSBkYXRhIGNvbnRleHQgdG8gdXNlLCBvciBhIGZ1bmN0aW9uIHJldHVybmluZyBhIGRhdGEgY29udGV4dC5cbiAqL1xuQmxhemUudG9IVE1MV2l0aERhdGEgPSBmdW5jdGlvbiAoY29udGVudCwgZGF0YSwgcGFyZW50Vmlldykge1xuICBwYXJlbnRWaWV3ID0gcGFyZW50VmlldyB8fCBjdXJyZW50Vmlld0lmUmVuZGVyaW5nKCk7XG5cbiAgcmV0dXJuIEhUTUwudG9IVE1MKEJsYXplLl9leHBhbmRWaWV3KEJsYXplLl9UZW1wbGF0ZVdpdGgoXG4gICAgZGF0YSwgY29udGVudEFzRnVuYyhjb250ZW50KSksIHBhcmVudFZpZXcpKTtcbn07XG5cbkJsYXplLl90b1RleHQgPSBmdW5jdGlvbiAoaHRtbGpzLCBwYXJlbnRWaWV3LCB0ZXh0TW9kZSkge1xuICBpZiAodHlwZW9mIGh0bWxqcyA9PT0gJ2Z1bmN0aW9uJylcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJCbGF6ZS5fdG9UZXh0IGRvZXNuJ3QgdGFrZSBhIGZ1bmN0aW9uLCBqdXN0IEhUTUxqc1wiKTtcblxuICBpZiAoKHBhcmVudFZpZXcgIT0gbnVsbCkgJiYgISAocGFyZW50VmlldyBpbnN0YW5jZW9mIEJsYXplLlZpZXcpKSB7XG4gICAgLy8gb21pdHRlZCBwYXJlbnRWaWV3IGFyZ3VtZW50XG4gICAgdGV4dE1vZGUgPSBwYXJlbnRWaWV3O1xuICAgIHBhcmVudFZpZXcgPSBudWxsO1xuICB9XG4gIHBhcmVudFZpZXcgPSBwYXJlbnRWaWV3IHx8IGN1cnJlbnRWaWV3SWZSZW5kZXJpbmcoKTtcblxuICBpZiAoISB0ZXh0TW9kZSlcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJ0ZXh0TW9kZSByZXF1aXJlZFwiKTtcbiAgaWYgKCEgKHRleHRNb2RlID09PSBIVE1MLlRFWFRNT0RFLlNUUklORyB8fFxuICAgICAgICAgdGV4dE1vZGUgPT09IEhUTUwuVEVYVE1PREUuUkNEQVRBIHx8XG4gICAgICAgICB0ZXh0TW9kZSA9PT0gSFRNTC5URVhUTU9ERS5BVFRSSUJVVEUpKVxuICAgIHRocm93IG5ldyBFcnJvcihcIlVua25vd24gdGV4dE1vZGU6IFwiICsgdGV4dE1vZGUpO1xuXG4gIHJldHVybiBIVE1MLnRvVGV4dChCbGF6ZS5fZXhwYW5kKGh0bWxqcywgcGFyZW50VmlldyksIHRleHRNb2RlKTtcbn07XG5cbi8qKlxuICogQHN1bW1hcnkgUmV0dXJucyB0aGUgY3VycmVudCBkYXRhIGNvbnRleHQsIG9yIHRoZSBkYXRhIGNvbnRleHQgdGhhdCB3YXMgdXNlZCB3aGVuIHJlbmRlcmluZyBhIHBhcnRpY3VsYXIgRE9NIGVsZW1lbnQgb3IgVmlldyBmcm9tIGEgTWV0ZW9yIHRlbXBsYXRlLlxuICogQGxvY3VzIENsaWVudFxuICogQHBhcmFtIHtET01FbGVtZW50fEJsYXplLlZpZXd9IFtlbGVtZW50T3JWaWV3XSBPcHRpb25hbC4gIEFuIGVsZW1lbnQgdGhhdCB3YXMgcmVuZGVyZWQgYnkgYSBNZXRlb3IsIG9yIGEgVmlldy5cbiAqL1xuQmxhemUuZ2V0RGF0YSA9IGZ1bmN0aW9uIChlbGVtZW50T3JWaWV3KSB7XG4gIHZhciB0aGVXaXRoO1xuXG4gIGlmICghIGVsZW1lbnRPclZpZXcpIHtcbiAgICB0aGVXaXRoID0gQmxhemUuZ2V0Vmlldygnd2l0aCcpO1xuICB9IGVsc2UgaWYgKGVsZW1lbnRPclZpZXcgaW5zdGFuY2VvZiBCbGF6ZS5WaWV3KSB7XG4gICAgdmFyIHZpZXcgPSBlbGVtZW50T3JWaWV3O1xuICAgIHRoZVdpdGggPSAodmlldy5uYW1lID09PSAnd2l0aCcgPyB2aWV3IDpcbiAgICAgICAgICAgICAgIEJsYXplLmdldFZpZXcodmlldywgJ3dpdGgnKSk7XG4gIH0gZWxzZSBpZiAodHlwZW9mIGVsZW1lbnRPclZpZXcubm9kZVR5cGUgPT09ICdudW1iZXInKSB7XG4gICAgaWYgKGVsZW1lbnRPclZpZXcubm9kZVR5cGUgIT09IDEpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJFeHBlY3RlZCBET00gZWxlbWVudFwiKTtcbiAgICB0aGVXaXRoID0gQmxhemUuZ2V0VmlldyhlbGVtZW50T3JWaWV3LCAnd2l0aCcpO1xuICB9IGVsc2Uge1xuICAgIHRocm93IG5ldyBFcnJvcihcIkV4cGVjdGVkIERPTSBlbGVtZW50IG9yIFZpZXdcIik7XG4gIH1cblxuICByZXR1cm4gdGhlV2l0aCA/IHRoZVdpdGguZGF0YVZhci5nZXQoKSA6IG51bGw7XG59O1xuXG4vLyBGb3IgYmFjay1jb21wYXRcbkJsYXplLmdldEVsZW1lbnREYXRhID0gZnVuY3Rpb24gKGVsZW1lbnQpIHtcbiAgQmxhemUuX3dhcm4oXCJCbGF6ZS5nZXRFbGVtZW50RGF0YSBoYXMgYmVlbiBkZXByZWNhdGVkLiAgVXNlIFwiICtcbiAgICAgICAgICAgICAgXCJCbGF6ZS5nZXREYXRhKGVsZW1lbnQpIGluc3RlYWQuXCIpO1xuXG4gIGlmIChlbGVtZW50Lm5vZGVUeXBlICE9PSAxKVxuICAgIHRocm93IG5ldyBFcnJvcihcIkV4cGVjdGVkIERPTSBlbGVtZW50XCIpO1xuXG4gIHJldHVybiBCbGF6ZS5nZXREYXRhKGVsZW1lbnQpO1xufTtcblxuLy8gQm90aCBhcmd1bWVudHMgYXJlIG9wdGlvbmFsLlxuXG4vKipcbiAqIEBzdW1tYXJ5IEdldHMgZWl0aGVyIHRoZSBjdXJyZW50IFZpZXcsIG9yIHRoZSBWaWV3IGVuY2xvc2luZyB0aGUgZ2l2ZW4gRE9NIGVsZW1lbnQuXG4gKiBAbG9jdXMgQ2xpZW50XG4gKiBAcGFyYW0ge0RPTUVsZW1lbnR9IFtlbGVtZW50XSBPcHRpb25hbC4gIElmIHNwZWNpZmllZCwgdGhlIFZpZXcgZW5jbG9zaW5nIGBlbGVtZW50YCBpcyByZXR1cm5lZC5cbiAqL1xuQmxhemUuZ2V0VmlldyA9IGZ1bmN0aW9uIChlbGVtZW50T3JWaWV3LCBfdmlld05hbWUpIHtcbiAgdmFyIHZpZXdOYW1lID0gX3ZpZXdOYW1lO1xuXG4gIGlmICgodHlwZW9mIGVsZW1lbnRPclZpZXcpID09PSAnc3RyaW5nJykge1xuICAgIC8vIG9taXR0ZWQgZWxlbWVudE9yVmlldzsgdmlld05hbWUgcHJlc2VudFxuICAgIHZpZXdOYW1lID0gZWxlbWVudE9yVmlldztcbiAgICBlbGVtZW50T3JWaWV3ID0gbnVsbDtcbiAgfVxuXG4gIC8vIFdlIGNvdWxkIGV2ZW50dWFsbHkgc2hvcnRlbiB0aGUgY29kZSBieSBmb2xkaW5nIHRoZSBsb2dpY1xuICAvLyBmcm9tIHRoZSBvdGhlciBtZXRob2RzIGludG8gdGhpcyBtZXRob2QuXG4gIGlmICghIGVsZW1lbnRPclZpZXcpIHtcbiAgICByZXR1cm4gQmxhemUuX2dldEN1cnJlbnRWaWV3KHZpZXdOYW1lKTtcbiAgfSBlbHNlIGlmIChlbGVtZW50T3JWaWV3IGluc3RhbmNlb2YgQmxhemUuVmlldykge1xuICAgIHJldHVybiBCbGF6ZS5fZ2V0UGFyZW50VmlldyhlbGVtZW50T3JWaWV3LCB2aWV3TmFtZSk7XG4gIH0gZWxzZSBpZiAodHlwZW9mIGVsZW1lbnRPclZpZXcubm9kZVR5cGUgPT09ICdudW1iZXInKSB7XG4gICAgcmV0dXJuIEJsYXplLl9nZXRFbGVtZW50VmlldyhlbGVtZW50T3JWaWV3LCB2aWV3TmFtZSk7XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiRXhwZWN0ZWQgRE9NIGVsZW1lbnQgb3IgVmlld1wiKTtcbiAgfVxufTtcblxuLy8gR2V0cyB0aGUgY3VycmVudCB2aWV3IG9yIGl0cyBuZWFyZXN0IGFuY2VzdG9yIG9mIG5hbWVcbi8vIGBuYW1lYC5cbkJsYXplLl9nZXRDdXJyZW50VmlldyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gIHZhciB2aWV3ID0gQmxhemUuY3VycmVudFZpZXc7XG4gIC8vIEJldHRlciB0byBmYWlsIGluIGNhc2VzIHdoZXJlIGl0IGRvZXNuJ3QgbWFrZSBzZW5zZVxuICAvLyB0byB1c2UgQmxhemUuX2dldEN1cnJlbnRWaWV3KCkuICBUaGVyZSB3aWxsIGJlIGEgY3VycmVudFxuICAvLyB2aWV3IGFueXdoZXJlIGl0IGRvZXMuICBZb3UgY2FuIGNoZWNrIEJsYXplLmN1cnJlbnRWaWV3XG4gIC8vIGlmIHlvdSB3YW50IHRvIGtub3cgd2hldGhlciB0aGVyZSBpcyBvbmUgb3Igbm90LlxuICBpZiAoISB2aWV3KVxuICAgIHRocm93IG5ldyBFcnJvcihcIlRoZXJlIGlzIG5vIGN1cnJlbnQgdmlld1wiKTtcblxuICBpZiAobmFtZSkge1xuICAgIHdoaWxlICh2aWV3ICYmIHZpZXcubmFtZSAhPT0gbmFtZSlcbiAgICAgIHZpZXcgPSB2aWV3LnBhcmVudFZpZXc7XG4gICAgcmV0dXJuIHZpZXcgfHwgbnVsbDtcbiAgfSBlbHNlIHtcbiAgICAvLyBCbGF6ZS5fZ2V0Q3VycmVudFZpZXcoKSB3aXRoIG5vIGFyZ3VtZW50cyBqdXN0IHJldHVybnNcbiAgICAvLyBCbGF6ZS5jdXJyZW50Vmlldy5cbiAgICByZXR1cm4gdmlldztcbiAgfVxufTtcblxuQmxhemUuX2dldFBhcmVudFZpZXcgPSBmdW5jdGlvbiAodmlldywgbmFtZSkge1xuICB2YXIgdiA9IHZpZXcucGFyZW50VmlldztcblxuICBpZiAobmFtZSkge1xuICAgIHdoaWxlICh2ICYmIHYubmFtZSAhPT0gbmFtZSlcbiAgICAgIHYgPSB2LnBhcmVudFZpZXc7XG4gIH1cblxuICByZXR1cm4gdiB8fCBudWxsO1xufTtcblxuQmxhemUuX2dldEVsZW1lbnRWaWV3ID0gZnVuY3Rpb24gKGVsZW0sIG5hbWUpIHtcbiAgdmFyIHJhbmdlID0gQmxhemUuX0RPTVJhbmdlLmZvckVsZW1lbnQoZWxlbSk7XG4gIHZhciB2aWV3ID0gbnVsbDtcbiAgd2hpbGUgKHJhbmdlICYmICEgdmlldykge1xuICAgIHZpZXcgPSAocmFuZ2UudmlldyB8fCBudWxsKTtcbiAgICBpZiAoISB2aWV3KSB7XG4gICAgICBpZiAocmFuZ2UucGFyZW50UmFuZ2UpXG4gICAgICAgIHJhbmdlID0gcmFuZ2UucGFyZW50UmFuZ2U7XG4gICAgICBlbHNlXG4gICAgICAgIHJhbmdlID0gQmxhemUuX0RPTVJhbmdlLmZvckVsZW1lbnQocmFuZ2UucGFyZW50RWxlbWVudCk7XG4gICAgfVxuICB9XG5cbiAgaWYgKG5hbWUpIHtcbiAgICB3aGlsZSAodmlldyAmJiB2aWV3Lm5hbWUgIT09IG5hbWUpXG4gICAgICB2aWV3ID0gdmlldy5wYXJlbnRWaWV3O1xuICAgIHJldHVybiB2aWV3IHx8IG51bGw7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHZpZXc7XG4gIH1cbn07XG5cbkJsYXplLl9hZGRFdmVudE1hcCA9IGZ1bmN0aW9uICh2aWV3LCBldmVudE1hcCwgdGhpc0luSGFuZGxlcikge1xuICB0aGlzSW5IYW5kbGVyID0gKHRoaXNJbkhhbmRsZXIgfHwgbnVsbCk7XG4gIHZhciBoYW5kbGVzID0gW107XG5cbiAgaWYgKCEgdmlldy5fZG9tcmFuZ2UpXG4gICAgdGhyb3cgbmV3IEVycm9yKFwiVmlldyBtdXN0IGhhdmUgYSBET01SYW5nZVwiKTtcblxuICB2aWV3Ll9kb21yYW5nZS5vbkF0dGFjaGVkKGZ1bmN0aW9uIGF0dGFjaGVkX2V2ZW50TWFwcyhyYW5nZSwgZWxlbWVudCkge1xuICAgIF8uZWFjaChldmVudE1hcCwgZnVuY3Rpb24gKGhhbmRsZXIsIHNwZWMpIHtcbiAgICAgIHZhciBjbGF1c2VzID0gc3BlYy5zcGxpdCgvLFxccysvKTtcbiAgICAgIC8vIGl0ZXJhdGUgb3ZlciBjbGF1c2VzIG9mIHNwZWMsIGUuZy4gWydjbGljayAuZm9vJywgJ2NsaWNrIC5iYXInXVxuICAgICAgXy5lYWNoKGNsYXVzZXMsIGZ1bmN0aW9uIChjbGF1c2UpIHtcbiAgICAgICAgdmFyIHBhcnRzID0gY2xhdXNlLnNwbGl0KC9cXHMrLyk7XG4gICAgICAgIGlmIChwYXJ0cy5sZW5ndGggPT09IDApXG4gICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHZhciBuZXdFdmVudHMgPSBwYXJ0cy5zaGlmdCgpO1xuICAgICAgICB2YXIgc2VsZWN0b3IgPSBwYXJ0cy5qb2luKCcgJyk7XG4gICAgICAgIGhhbmRsZXMucHVzaChCbGF6ZS5fRXZlbnRTdXBwb3J0Lmxpc3RlbihcbiAgICAgICAgICBlbGVtZW50LCBuZXdFdmVudHMsIHNlbGVjdG9yLFxuICAgICAgICAgIGZ1bmN0aW9uIChldnQpIHtcbiAgICAgICAgICAgIGlmICghIHJhbmdlLmNvbnRhaW5zRWxlbWVudChldnQuY3VycmVudFRhcmdldCkpXG4gICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgdmFyIGhhbmRsZXJUaGlzID0gdGhpc0luSGFuZGxlciB8fCB0aGlzO1xuICAgICAgICAgICAgdmFyIGhhbmRsZXJBcmdzID0gYXJndW1lbnRzO1xuICAgICAgICAgICAgcmV0dXJuIEJsYXplLl93aXRoQ3VycmVudFZpZXcodmlldywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICByZXR1cm4gaGFuZGxlci5hcHBseShoYW5kbGVyVGhpcywgaGFuZGxlckFyZ3MpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSxcbiAgICAgICAgICByYW5nZSwgZnVuY3Rpb24gKHIpIHtcbiAgICAgICAgICAgIHJldHVybiByLnBhcmVudFJhbmdlO1xuICAgICAgICAgIH0pKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9KTtcblxuICB2aWV3Lm9uVmlld0Rlc3Ryb3llZChmdW5jdGlvbiAoKSB7XG4gICAgXy5lYWNoKGhhbmRsZXMsIGZ1bmN0aW9uIChoKSB7XG4gICAgICBoLnN0b3AoKTtcbiAgICB9KTtcbiAgICBoYW5kbGVzLmxlbmd0aCA9IDA7XG4gIH0pO1xufTtcbiIsIkJsYXplLl9jYWxjdWxhdGVDb25kaXRpb24gPSBmdW5jdGlvbiAoY29uZCkge1xuICBpZiAoY29uZCBpbnN0YW5jZW9mIEFycmF5ICYmIGNvbmQubGVuZ3RoID09PSAwKVxuICAgIGNvbmQgPSBmYWxzZTtcbiAgcmV0dXJuICEhIGNvbmQ7XG59O1xuXG4vKipcbiAqIEBzdW1tYXJ5IENvbnN0cnVjdHMgYSBWaWV3IHRoYXQgcmVuZGVycyBjb250ZW50IHdpdGggYSBkYXRhIGNvbnRleHQuXG4gKiBAbG9jdXMgQ2xpZW50XG4gKiBAcGFyYW0ge09iamVjdHxGdW5jdGlvbn0gZGF0YSBBbiBvYmplY3QgdG8gdXNlIGFzIHRoZSBkYXRhIGNvbnRleHQsIG9yIGEgZnVuY3Rpb24gcmV0dXJuaW5nIHN1Y2ggYW4gb2JqZWN0LiAgSWYgYSBmdW5jdGlvbiBpcyBwcm92aWRlZCwgaXQgd2lsbCBiZSByZWFjdGl2ZWx5IHJlLXJ1bi5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNvbnRlbnRGdW5jIEEgRnVuY3Rpb24gdGhhdCByZXR1cm5zIFsqcmVuZGVyYWJsZSBjb250ZW50Kl0oI1JlbmRlcmFibGUtQ29udGVudCkuXG4gKi9cbkJsYXplLldpdGggPSBmdW5jdGlvbiAoZGF0YSwgY29udGVudEZ1bmMpIHtcbiAgdmFyIHZpZXcgPSBCbGF6ZS5WaWV3KCd3aXRoJywgY29udGVudEZ1bmMpO1xuXG4gIHZpZXcuZGF0YVZhciA9IG5ldyBSZWFjdGl2ZVZhcjtcblxuICB2aWV3Lm9uVmlld0NyZWF0ZWQoZnVuY3Rpb24gKCkge1xuICAgIGlmICh0eXBlb2YgZGF0YSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgLy8gYGRhdGFgIGlzIGEgcmVhY3RpdmUgZnVuY3Rpb25cbiAgICAgIHZpZXcuYXV0b3J1bihmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZpZXcuZGF0YVZhci5zZXQoZGF0YSgpKTtcbiAgICAgIH0sIHZpZXcucGFyZW50VmlldywgJ3NldERhdGEnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmlldy5kYXRhVmFyLnNldChkYXRhKTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiB2aWV3O1xufTtcblxuLyoqXG4gKiBBdHRhY2hlcyBiaW5kaW5ncyB0byB0aGUgaW5zdGFudGlhdGVkIHZpZXcuXG4gKiBAcGFyYW0ge09iamVjdH0gYmluZGluZ3MgQSBkaWN0aW9uYXJ5IG9mIGJpbmRpbmdzLCBlYWNoIGJpbmRpbmcgbmFtZVxuICogY29ycmVzcG9uZHMgdG8gYSB2YWx1ZSBvciBhIGZ1bmN0aW9uIHRoYXQgd2lsbCBiZSByZWFjdGl2ZWx5IHJlLXJ1bi5cbiAqIEBwYXJhbSB7Vmlld30gdmlldyBUaGUgdGFyZ2V0LlxuICovXG5CbGF6ZS5fYXR0YWNoQmluZGluZ3NUb1ZpZXcgPSBmdW5jdGlvbiAoYmluZGluZ3MsIHZpZXcpIHtcbiAgdmlldy5vblZpZXdDcmVhdGVkKGZ1bmN0aW9uICgpIHtcbiAgICBfLmVhY2goYmluZGluZ3MsIGZ1bmN0aW9uIChiaW5kaW5nLCBuYW1lKSB7XG4gICAgICB2aWV3Ll9zY29wZUJpbmRpbmdzW25hbWVdID0gbmV3IFJlYWN0aXZlVmFyO1xuICAgICAgaWYgKHR5cGVvZiBiaW5kaW5nID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHZpZXcuYXV0b3J1bihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgdmlldy5fc2NvcGVCaW5kaW5nc1tuYW1lXS5zZXQoYmluZGluZygpKTtcbiAgICAgICAgfSwgdmlldy5wYXJlbnRWaWV3KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZpZXcuX3Njb3BlQmluZGluZ3NbbmFtZV0uc2V0KGJpbmRpbmcpO1xuICAgICAgfVxuICAgIH0pO1xuICB9KTtcbn07XG5cbi8qKlxuICogQHN1bW1hcnkgQ29uc3RydWN0cyBhIFZpZXcgc2V0dGluZyB0aGUgbG9jYWwgbGV4aWNhbCBzY29wZSBpbiB0aGUgYmxvY2suXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBiaW5kaW5ncyBEaWN0aW9uYXJ5IG1hcHBpbmcgbmFtZXMgb2YgYmluZGluZ3MgdG9cbiAqIHZhbHVlcyBvciBjb21wdXRhdGlvbnMgdG8gcmVhY3RpdmVseSByZS1ydW4uXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjb250ZW50RnVuYyBBIEZ1bmN0aW9uIHRoYXQgcmV0dXJucyBbKnJlbmRlcmFibGUgY29udGVudCpdKCNSZW5kZXJhYmxlLUNvbnRlbnQpLlxuICovXG5CbGF6ZS5MZXQgPSBmdW5jdGlvbiAoYmluZGluZ3MsIGNvbnRlbnRGdW5jKSB7XG4gIHZhciB2aWV3ID0gQmxhemUuVmlldygnbGV0JywgY29udGVudEZ1bmMpO1xuICBCbGF6ZS5fYXR0YWNoQmluZGluZ3NUb1ZpZXcoYmluZGluZ3MsIHZpZXcpO1xuXG4gIHJldHVybiB2aWV3O1xufTtcblxuLyoqXG4gKiBAc3VtbWFyeSBDb25zdHJ1Y3RzIGEgVmlldyB0aGF0IHJlbmRlcnMgY29udGVudCBjb25kaXRpb25hbGx5LlxuICogQGxvY3VzIENsaWVudFxuICogQHBhcmFtIHtGdW5jdGlvbn0gY29uZGl0aW9uRnVuYyBBIGZ1bmN0aW9uIHRvIHJlYWN0aXZlbHkgcmUtcnVuLiAgV2hldGhlciB0aGUgcmVzdWx0IGlzIHRydXRoeSBvciBmYWxzeSBkZXRlcm1pbmVzIHdoZXRoZXIgYGNvbnRlbnRGdW5jYCBvciBgZWxzZUZ1bmNgIGlzIHNob3duLiAgQW4gZW1wdHkgYXJyYXkgaXMgY29uc2lkZXJlZCBmYWxzeS5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNvbnRlbnRGdW5jIEEgRnVuY3Rpb24gdGhhdCByZXR1cm5zIFsqcmVuZGVyYWJsZSBjb250ZW50Kl0oI1JlbmRlcmFibGUtQ29udGVudCkuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBbZWxzZUZ1bmNdIE9wdGlvbmFsLiAgQSBGdW5jdGlvbiB0aGF0IHJldHVybnMgWypyZW5kZXJhYmxlIGNvbnRlbnQqXSgjUmVuZGVyYWJsZS1Db250ZW50KS4gIElmIG5vIGBlbHNlRnVuY2AgaXMgc3VwcGxpZWQsIG5vIGNvbnRlbnQgaXMgc2hvd24gaW4gdGhlIFwiZWxzZVwiIGNhc2UuXG4gKi9cbkJsYXplLklmID0gZnVuY3Rpb24gKGNvbmRpdGlvbkZ1bmMsIGNvbnRlbnRGdW5jLCBlbHNlRnVuYywgX25vdCkge1xuICB2YXIgY29uZGl0aW9uVmFyID0gbmV3IFJlYWN0aXZlVmFyO1xuXG4gIHZhciB2aWV3ID0gQmxhemUuVmlldyhfbm90ID8gJ3VubGVzcycgOiAnaWYnLCBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIGNvbmRpdGlvblZhci5nZXQoKSA/IGNvbnRlbnRGdW5jKCkgOlxuICAgICAgKGVsc2VGdW5jID8gZWxzZUZ1bmMoKSA6IG51bGwpO1xuICB9KTtcbiAgdmlldy5fX2NvbmRpdGlvblZhciA9IGNvbmRpdGlvblZhcjtcbiAgdmlldy5vblZpZXdDcmVhdGVkKGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmF1dG9ydW4oZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIGNvbmQgPSBCbGF6ZS5fY2FsY3VsYXRlQ29uZGl0aW9uKGNvbmRpdGlvbkZ1bmMoKSk7XG4gICAgICBjb25kaXRpb25WYXIuc2V0KF9ub3QgPyAoISBjb25kKSA6IGNvbmQpO1xuICAgIH0sIHRoaXMucGFyZW50VmlldywgJ2NvbmRpdGlvbicpO1xuICB9KTtcblxuICByZXR1cm4gdmlldztcbn07XG5cbi8qKlxuICogQHN1bW1hcnkgQW4gaW52ZXJ0ZWQgW2BCbGF6ZS5JZmBdKCNCbGF6ZS1JZikuXG4gKiBAbG9jdXMgQ2xpZW50XG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjb25kaXRpb25GdW5jIEEgZnVuY3Rpb24gdG8gcmVhY3RpdmVseSByZS1ydW4uICBJZiB0aGUgcmVzdWx0IGlzIGZhbHN5LCBgY29udGVudEZ1bmNgIGlzIHNob3duLCBvdGhlcndpc2UgYGVsc2VGdW5jYCBpcyBzaG93bi4gIEFuIGVtcHR5IGFycmF5IGlzIGNvbnNpZGVyZWQgZmFsc3kuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjb250ZW50RnVuYyBBIEZ1bmN0aW9uIHRoYXQgcmV0dXJucyBbKnJlbmRlcmFibGUgY29udGVudCpdKCNSZW5kZXJhYmxlLUNvbnRlbnQpLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gW2Vsc2VGdW5jXSBPcHRpb25hbC4gIEEgRnVuY3Rpb24gdGhhdCByZXR1cm5zIFsqcmVuZGVyYWJsZSBjb250ZW50Kl0oI1JlbmRlcmFibGUtQ29udGVudCkuICBJZiBubyBgZWxzZUZ1bmNgIGlzIHN1cHBsaWVkLCBubyBjb250ZW50IGlzIHNob3duIGluIHRoZSBcImVsc2VcIiBjYXNlLlxuICovXG5CbGF6ZS5Vbmxlc3MgPSBmdW5jdGlvbiAoY29uZGl0aW9uRnVuYywgY29udGVudEZ1bmMsIGVsc2VGdW5jKSB7XG4gIHJldHVybiBCbGF6ZS5JZihjb25kaXRpb25GdW5jLCBjb250ZW50RnVuYywgZWxzZUZ1bmMsIHRydWUgLypfbm90Ki8pO1xufTtcblxuLyoqXG4gKiBAc3VtbWFyeSBDb25zdHJ1Y3RzIGEgVmlldyB0aGF0IHJlbmRlcnMgYGNvbnRlbnRGdW5jYCBmb3IgZWFjaCBpdGVtIGluIGEgc2VxdWVuY2UuXG4gKiBAbG9jdXMgQ2xpZW50XG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBhcmdGdW5jIEEgZnVuY3Rpb24gdG8gcmVhY3RpdmVseSByZS1ydW4uIFRoZSBmdW5jdGlvbiBjYW5cbiAqIHJldHVybiBvbmUgb2YgdHdvIG9wdGlvbnM6XG4gKlxuICogMS4gQW4gb2JqZWN0IHdpdGggdHdvIGZpZWxkczogJ192YXJpYWJsZScgYW5kICdfc2VxdWVuY2UnLiBFYWNoIGl0ZXJhdGVzIG92ZXJcbiAqICAgJ19zZXF1ZW5jZScsIGl0IG1heSBiZSBhIEN1cnNvciwgYW4gYXJyYXksIG51bGwsIG9yIHVuZGVmaW5lZC4gSW5zaWRlIHRoZVxuICogICBFYWNoIGJvZHkgeW91IHdpbGwgYmUgYWJsZSB0byBnZXQgdGhlIGN1cnJlbnQgaXRlbSBmcm9tIHRoZSBzZXF1ZW5jZSB1c2luZ1xuICogICB0aGUgbmFtZSBzcGVjaWZpZWQgaW4gdGhlICdfdmFyaWFibGUnIGZpZWxkLlxuICpcbiAqIDIuIEp1c3QgYSBzZXF1ZW5jZSAoQ3Vyc29yLCBhcnJheSwgbnVsbCwgb3IgdW5kZWZpbmVkKSBub3Qgd3JhcHBlZCBpbnRvIGFuXG4gKiAgIG9iamVjdC4gSW5zaWRlIHRoZSBFYWNoIGJvZHksIHRoZSBjdXJyZW50IGl0ZW0gd2lsbCBiZSBzZXQgYXMgdGhlIGRhdGFcbiAqICAgY29udGV4dC5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNvbnRlbnRGdW5jIEEgRnVuY3Rpb24gdGhhdCByZXR1cm5zICBbKnJlbmRlcmFibGVcbiAqIGNvbnRlbnQqXSgjUmVuZGVyYWJsZS1Db250ZW50KS5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IFtlbHNlRnVuY10gQSBGdW5jdGlvbiB0aGF0IHJldHVybnMgWypyZW5kZXJhYmxlXG4gKiBjb250ZW50Kl0oI1JlbmRlcmFibGUtQ29udGVudCkgdG8gZGlzcGxheSBpbiB0aGUgY2FzZSB3aGVuIHRoZXJlIGFyZSBubyBpdGVtc1xuICogaW4gdGhlIHNlcXVlbmNlLlxuICovXG5CbGF6ZS5FYWNoID0gZnVuY3Rpb24gKGFyZ0Z1bmMsIGNvbnRlbnRGdW5jLCBlbHNlRnVuYykge1xuICB2YXIgZWFjaFZpZXcgPSBCbGF6ZS5WaWV3KCdlYWNoJywgZnVuY3Rpb24gKCkge1xuICAgIHZhciBzdWJ2aWV3cyA9IHRoaXMuaW5pdGlhbFN1YnZpZXdzO1xuICAgIHRoaXMuaW5pdGlhbFN1YnZpZXdzID0gbnVsbDtcbiAgICBpZiAodGhpcy5faXNDcmVhdGVkRm9yRXhwYW5zaW9uKSB7XG4gICAgICB0aGlzLmV4cGFuZGVkVmFsdWVEZXAgPSBuZXcgVHJhY2tlci5EZXBlbmRlbmN5O1xuICAgICAgdGhpcy5leHBhbmRlZFZhbHVlRGVwLmRlcGVuZCgpO1xuICAgIH1cbiAgICByZXR1cm4gc3Vidmlld3M7XG4gIH0pO1xuICBlYWNoVmlldy5pbml0aWFsU3Vidmlld3MgPSBbXTtcbiAgZWFjaFZpZXcubnVtSXRlbXMgPSAwO1xuICBlYWNoVmlldy5pbkVsc2VNb2RlID0gZmFsc2U7XG4gIGVhY2hWaWV3LnN0b3BIYW5kbGUgPSBudWxsO1xuICBlYWNoVmlldy5jb250ZW50RnVuYyA9IGNvbnRlbnRGdW5jO1xuICBlYWNoVmlldy5lbHNlRnVuYyA9IGVsc2VGdW5jO1xuICBlYWNoVmlldy5hcmdWYXIgPSBuZXcgUmVhY3RpdmVWYXI7XG4gIGVhY2hWaWV3LnZhcmlhYmxlTmFtZSA9IG51bGw7XG5cbiAgLy8gdXBkYXRlIHRoZSBAaW5kZXggdmFsdWUgaW4gdGhlIHNjb3BlIG9mIGFsbCBzdWJ2aWV3cyBpbiB0aGUgcmFuZ2VcbiAgdmFyIHVwZGF0ZUluZGljZXMgPSBmdW5jdGlvbiAoZnJvbSwgdG8pIHtcbiAgICBpZiAodG8gPT09IHVuZGVmaW5lZCkge1xuICAgICAgdG8gPSBlYWNoVmlldy5udW1JdGVtcyAtIDE7XG4gICAgfVxuXG4gICAgZm9yICh2YXIgaSA9IGZyb207IGkgPD0gdG87IGkrKykge1xuICAgICAgdmFyIHZpZXcgPSBlYWNoVmlldy5fZG9tcmFuZ2UubWVtYmVyc1tpXS52aWV3O1xuICAgICAgdmlldy5fc2NvcGVCaW5kaW5nc1snQGluZGV4J10uc2V0KGkpO1xuICAgIH1cbiAgfTtcblxuICBlYWNoVmlldy5vblZpZXdDcmVhdGVkKGZ1bmN0aW9uICgpIHtcbiAgICAvLyBXZSBldmFsdWF0ZSBhcmdGdW5jIGluIGFuIGF1dG9ydW4gdG8gbWFrZSBzdXJlXG4gICAgLy8gQmxhemUuY3VycmVudFZpZXcgaXMgYWx3YXlzIHNldCB3aGVuIGl0IHJ1bnMgKHJhdGhlciB0aGFuXG4gICAgLy8gcGFzc2luZyBhcmdGdW5jIHN0cmFpZ2h0IHRvIE9ic2VydmVTZXF1ZW5jZSkuXG4gICAgZWFjaFZpZXcuYXV0b3J1bihmdW5jdGlvbiAoKSB7XG4gICAgICAvLyBhcmdGdW5jIGNhbiByZXR1cm4gZWl0aGVyIGEgc2VxdWVuY2UgYXMgaXMgb3IgYSB3cmFwcGVyIG9iamVjdCB3aXRoIGFcbiAgICAgIC8vIF9zZXF1ZW5jZSBhbmQgX3ZhcmlhYmxlIGZpZWxkcyBzZXQuXG4gICAgICB2YXIgYXJnID0gYXJnRnVuYygpO1xuICAgICAgaWYgKF8uaXNPYmplY3QoYXJnKSAmJiBfLmhhcyhhcmcsICdfc2VxdWVuY2UnKSkge1xuICAgICAgICBlYWNoVmlldy52YXJpYWJsZU5hbWUgPSBhcmcuX3ZhcmlhYmxlIHx8IG51bGw7XG4gICAgICAgIGFyZyA9IGFyZy5fc2VxdWVuY2U7XG4gICAgICB9XG5cbiAgICAgIGVhY2hWaWV3LmFyZ1Zhci5zZXQoYXJnKTtcbiAgICB9LCBlYWNoVmlldy5wYXJlbnRWaWV3LCAnY29sbGVjdGlvbicpO1xuXG4gICAgZWFjaFZpZXcuc3RvcEhhbmRsZSA9IE9ic2VydmVTZXF1ZW5jZS5vYnNlcnZlKGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiBlYWNoVmlldy5hcmdWYXIuZ2V0KCk7XG4gICAgfSwge1xuICAgICAgYWRkZWRBdDogZnVuY3Rpb24gKGlkLCBpdGVtLCBpbmRleCkge1xuICAgICAgICBUcmFja2VyLm5vbnJlYWN0aXZlKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICB2YXIgbmV3SXRlbVZpZXc7XG4gICAgICAgICAgaWYgKGVhY2hWaWV3LnZhcmlhYmxlTmFtZSkge1xuICAgICAgICAgICAgLy8gbmV3LXN0eWxlICNlYWNoIChhcyBpbiB7eyNlYWNoIGl0ZW0gaW4gaXRlbXN9fSlcbiAgICAgICAgICAgIC8vIGRvZXNuJ3QgY3JlYXRlIGEgbmV3IGRhdGEgY29udGV4dFxuICAgICAgICAgICAgbmV3SXRlbVZpZXcgPSBCbGF6ZS5WaWV3KCdpdGVtJywgZWFjaFZpZXcuY29udGVudEZ1bmMpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBuZXdJdGVtVmlldyA9IEJsYXplLldpdGgoaXRlbSwgZWFjaFZpZXcuY29udGVudEZ1bmMpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGVhY2hWaWV3Lm51bUl0ZW1zKys7XG5cbiAgICAgICAgICB2YXIgYmluZGluZ3MgPSB7fTtcbiAgICAgICAgICBiaW5kaW5nc1snQGluZGV4J10gPSBpbmRleDtcbiAgICAgICAgICBpZiAoZWFjaFZpZXcudmFyaWFibGVOYW1lKSB7XG4gICAgICAgICAgICBiaW5kaW5nc1tlYWNoVmlldy52YXJpYWJsZU5hbWVdID0gaXRlbTtcbiAgICAgICAgICB9XG4gICAgICAgICAgQmxhemUuX2F0dGFjaEJpbmRpbmdzVG9WaWV3KGJpbmRpbmdzLCBuZXdJdGVtVmlldyk7XG5cbiAgICAgICAgICBpZiAoZWFjaFZpZXcuZXhwYW5kZWRWYWx1ZURlcCkge1xuICAgICAgICAgICAgZWFjaFZpZXcuZXhwYW5kZWRWYWx1ZURlcC5jaGFuZ2VkKCk7XG4gICAgICAgICAgfSBlbHNlIGlmIChlYWNoVmlldy5fZG9tcmFuZ2UpIHtcbiAgICAgICAgICAgIGlmIChlYWNoVmlldy5pbkVsc2VNb2RlKSB7XG4gICAgICAgICAgICAgIGVhY2hWaWV3Ll9kb21yYW5nZS5yZW1vdmVNZW1iZXIoMCk7XG4gICAgICAgICAgICAgIGVhY2hWaWV3LmluRWxzZU1vZGUgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIHJhbmdlID0gQmxhemUuX21hdGVyaWFsaXplVmlldyhuZXdJdGVtVmlldywgZWFjaFZpZXcpO1xuICAgICAgICAgICAgZWFjaFZpZXcuX2RvbXJhbmdlLmFkZE1lbWJlcihyYW5nZSwgaW5kZXgpO1xuICAgICAgICAgICAgdXBkYXRlSW5kaWNlcyhpbmRleCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGVhY2hWaWV3LmluaXRpYWxTdWJ2aWV3cy5zcGxpY2UoaW5kZXgsIDAsIG5ld0l0ZW1WaWV3KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfSxcbiAgICAgIHJlbW92ZWRBdDogZnVuY3Rpb24gKGlkLCBpdGVtLCBpbmRleCkge1xuICAgICAgICBUcmFja2VyLm5vbnJlYWN0aXZlKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICBlYWNoVmlldy5udW1JdGVtcy0tO1xuICAgICAgICAgIGlmIChlYWNoVmlldy5leHBhbmRlZFZhbHVlRGVwKSB7XG4gICAgICAgICAgICBlYWNoVmlldy5leHBhbmRlZFZhbHVlRGVwLmNoYW5nZWQoKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGVhY2hWaWV3Ll9kb21yYW5nZSkge1xuICAgICAgICAgICAgZWFjaFZpZXcuX2RvbXJhbmdlLnJlbW92ZU1lbWJlcihpbmRleCk7XG4gICAgICAgICAgICB1cGRhdGVJbmRpY2VzKGluZGV4KTtcbiAgICAgICAgICAgIGlmIChlYWNoVmlldy5lbHNlRnVuYyAmJiBlYWNoVmlldy5udW1JdGVtcyA9PT0gMCkge1xuICAgICAgICAgICAgICBlYWNoVmlldy5pbkVsc2VNb2RlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgZWFjaFZpZXcuX2RvbXJhbmdlLmFkZE1lbWJlcihcbiAgICAgICAgICAgICAgICBCbGF6ZS5fbWF0ZXJpYWxpemVWaWV3KFxuICAgICAgICAgICAgICAgICAgQmxhemUuVmlldygnZWFjaF9lbHNlJyxlYWNoVmlldy5lbHNlRnVuYyksXG4gICAgICAgICAgICAgICAgICBlYWNoVmlldyksIDApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBlYWNoVmlldy5pbml0aWFsU3Vidmlld3Muc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfSxcbiAgICAgIGNoYW5nZWRBdDogZnVuY3Rpb24gKGlkLCBuZXdJdGVtLCBvbGRJdGVtLCBpbmRleCkge1xuICAgICAgICBUcmFja2VyLm5vbnJlYWN0aXZlKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICBpZiAoZWFjaFZpZXcuZXhwYW5kZWRWYWx1ZURlcCkge1xuICAgICAgICAgICAgZWFjaFZpZXcuZXhwYW5kZWRWYWx1ZURlcC5jaGFuZ2VkKCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhciBpdGVtVmlldztcbiAgICAgICAgICAgIGlmIChlYWNoVmlldy5fZG9tcmFuZ2UpIHtcbiAgICAgICAgICAgICAgaXRlbVZpZXcgPSBlYWNoVmlldy5fZG9tcmFuZ2UuZ2V0TWVtYmVyKGluZGV4KS52aWV3O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgaXRlbVZpZXcgPSBlYWNoVmlldy5pbml0aWFsU3Vidmlld3NbaW5kZXhdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGVhY2hWaWV3LnZhcmlhYmxlTmFtZSkge1xuICAgICAgICAgICAgICBpdGVtVmlldy5fc2NvcGVCaW5kaW5nc1tlYWNoVmlldy52YXJpYWJsZU5hbWVdLnNldChuZXdJdGVtKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGl0ZW1WaWV3LmRhdGFWYXIuc2V0KG5ld0l0ZW0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9LFxuICAgICAgbW92ZWRUbzogZnVuY3Rpb24gKGlkLCBpdGVtLCBmcm9tSW5kZXgsIHRvSW5kZXgpIHtcbiAgICAgICAgVHJhY2tlci5ub25yZWFjdGl2ZShmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgaWYgKGVhY2hWaWV3LmV4cGFuZGVkVmFsdWVEZXApIHtcbiAgICAgICAgICAgIGVhY2hWaWV3LmV4cGFuZGVkVmFsdWVEZXAuY2hhbmdlZCgpO1xuICAgICAgICAgIH0gZWxzZSBpZiAoZWFjaFZpZXcuX2RvbXJhbmdlKSB7XG4gICAgICAgICAgICBlYWNoVmlldy5fZG9tcmFuZ2UubW92ZU1lbWJlcihmcm9tSW5kZXgsIHRvSW5kZXgpO1xuICAgICAgICAgICAgdXBkYXRlSW5kaWNlcyhcbiAgICAgICAgICAgICAgTWF0aC5taW4oZnJvbUluZGV4LCB0b0luZGV4KSwgTWF0aC5tYXgoZnJvbUluZGV4LCB0b0luZGV4KSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhciBzdWJ2aWV3cyA9IGVhY2hWaWV3LmluaXRpYWxTdWJ2aWV3cztcbiAgICAgICAgICAgIHZhciBpdGVtVmlldyA9IHN1YnZpZXdzW2Zyb21JbmRleF07XG4gICAgICAgICAgICBzdWJ2aWV3cy5zcGxpY2UoZnJvbUluZGV4LCAxKTtcbiAgICAgICAgICAgIHN1YnZpZXdzLnNwbGljZSh0b0luZGV4LCAwLCBpdGVtVmlldyk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGlmIChlYWNoVmlldy5lbHNlRnVuYyAmJiBlYWNoVmlldy5udW1JdGVtcyA9PT0gMCkge1xuICAgICAgZWFjaFZpZXcuaW5FbHNlTW9kZSA9IHRydWU7XG4gICAgICBlYWNoVmlldy5pbml0aWFsU3Vidmlld3NbMF0gPVxuICAgICAgICBCbGF6ZS5WaWV3KCdlYWNoX2Vsc2UnLCBlYWNoVmlldy5lbHNlRnVuYyk7XG4gICAgfVxuICB9KTtcblxuICBlYWNoVmlldy5vblZpZXdEZXN0cm95ZWQoZnVuY3Rpb24gKCkge1xuICAgIGlmIChlYWNoVmlldy5zdG9wSGFuZGxlKVxuICAgICAgZWFjaFZpZXcuc3RvcEhhbmRsZS5zdG9wKCk7XG4gIH0pO1xuXG4gIHJldHVybiBlYWNoVmlldztcbn07XG5cbkJsYXplLl9UZW1wbGF0ZVdpdGggPSBmdW5jdGlvbiAoYXJnLCBjb250ZW50RnVuYykge1xuICB2YXIgdztcblxuICB2YXIgYXJnRnVuYyA9IGFyZztcbiAgaWYgKHR5cGVvZiBhcmcgIT09ICdmdW5jdGlvbicpIHtcbiAgICBhcmdGdW5jID0gZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIGFyZztcbiAgICB9O1xuICB9XG5cbiAgLy8gVGhpcyBpcyBhIGxpdHRsZSBtZXNzeS4gIFdoZW4gd2UgY29tcGlsZSBge3s+IFRlbXBsYXRlLmNvbnRlbnRCbG9ja319YCwgd2VcbiAgLy8gd3JhcCBpdCBpbiBCbGF6ZS5fSW5PdXRlclRlbXBsYXRlU2NvcGUgaW4gb3JkZXIgdG8gc2tpcCB0aGUgaW50ZXJtZWRpYXRlXG4gIC8vIHBhcmVudCBWaWV3cyBpbiB0aGUgY3VycmVudCB0ZW1wbGF0ZS4gIEhvd2V2ZXIsIHdoZW4gdGhlcmUncyBhbiBhcmd1bWVudFxuICAvLyAoYHt7PiBUZW1wbGF0ZS5jb250ZW50QmxvY2sgYXJnfX1gKSwgdGhlIGFyZ3VtZW50IG5lZWRzIHRvIGJlIGV2YWx1YXRlZFxuICAvLyBpbiB0aGUgb3JpZ2luYWwgc2NvcGUuICBUaGVyZSdzIG5vIGdvb2Qgb3JkZXIgdG8gbmVzdFxuICAvLyBCbGF6ZS5fSW5PdXRlclRlbXBsYXRlU2NvcGUgYW5kIFNwYWNlYmFycy5UZW1wbGF0ZVdpdGggdG8gYWNoaWV2ZSB0aGlzLFxuICAvLyBzbyB3ZSB3cmFwIGFyZ0Z1bmMgdG8gcnVuIGl0IGluIHRoZSBcIm9yaWdpbmFsIHBhcmVudFZpZXdcIiBvZiB0aGVcbiAgLy8gQmxhemUuX0luT3V0ZXJUZW1wbGF0ZVNjb3BlLlxuICAvL1xuICAvLyBUbyBtYWtlIHRoaXMgYmV0dGVyLCByZWNvbnNpZGVyIF9Jbk91dGVyVGVtcGxhdGVTY29wZSBhcyBhIHByaW1pdGl2ZS5cbiAgLy8gTG9uZ2VyIHRlcm0sIGV2YWx1YXRlIGV4cHJlc3Npb25zIGluIHRoZSBwcm9wZXIgbGV4aWNhbCBzY29wZS5cbiAgdmFyIHdyYXBwZWRBcmdGdW5jID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciB2aWV3VG9FdmFsdWF0ZUFyZyA9IG51bGw7XG4gICAgaWYgKHcucGFyZW50VmlldyAmJiB3LnBhcmVudFZpZXcubmFtZSA9PT0gJ0luT3V0ZXJUZW1wbGF0ZVNjb3BlJykge1xuICAgICAgdmlld1RvRXZhbHVhdGVBcmcgPSB3LnBhcmVudFZpZXcub3JpZ2luYWxQYXJlbnRWaWV3O1xuICAgIH1cbiAgICBpZiAodmlld1RvRXZhbHVhdGVBcmcpIHtcbiAgICAgIHJldHVybiBCbGF6ZS5fd2l0aEN1cnJlbnRWaWV3KHZpZXdUb0V2YWx1YXRlQXJnLCBhcmdGdW5jKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGFyZ0Z1bmMoKTtcbiAgICB9XG4gIH07XG5cbiAgdmFyIHdyYXBwZWRDb250ZW50RnVuYyA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgY29udGVudCA9IGNvbnRlbnRGdW5jLmNhbGwodGhpcyk7XG5cbiAgICAvLyBTaW5jZSB3ZSBhcmUgZ2VuZXJhdGluZyB0aGUgQmxhemUuX1RlbXBsYXRlV2l0aCB2aWV3IGZvciB0aGVcbiAgICAvLyB1c2VyLCBzZXQgdGhlIGZsYWcgb24gdGhlIGNoaWxkIHZpZXcuICBJZiBgY29udGVudGAgaXMgYSB0ZW1wbGF0ZSxcbiAgICAvLyBjb25zdHJ1Y3QgdGhlIFZpZXcgc28gdGhhdCB3ZSBjYW4gc2V0IHRoZSBmbGFnLlxuICAgIGlmIChjb250ZW50IGluc3RhbmNlb2YgQmxhemUuVGVtcGxhdGUpIHtcbiAgICAgIGNvbnRlbnQgPSBjb250ZW50LmNvbnN0cnVjdFZpZXcoKTtcbiAgICB9XG4gICAgaWYgKGNvbnRlbnQgaW5zdGFuY2VvZiBCbGF6ZS5WaWV3KSB7XG4gICAgICBjb250ZW50Ll9oYXNHZW5lcmF0ZWRQYXJlbnQgPSB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBjb250ZW50O1xuICB9O1xuXG4gIHcgPSBCbGF6ZS5XaXRoKHdyYXBwZWRBcmdGdW5jLCB3cmFwcGVkQ29udGVudEZ1bmMpO1xuICB3Ll9faXNUZW1wbGF0ZVdpdGggPSB0cnVlO1xuICByZXR1cm4gdztcbn07XG5cbkJsYXplLl9Jbk91dGVyVGVtcGxhdGVTY29wZSA9IGZ1bmN0aW9uICh0ZW1wbGF0ZVZpZXcsIGNvbnRlbnRGdW5jKSB7XG4gIHZhciB2aWV3ID0gQmxhemUuVmlldygnSW5PdXRlclRlbXBsYXRlU2NvcGUnLCBjb250ZW50RnVuYyk7XG4gIHZhciBwYXJlbnRWaWV3ID0gdGVtcGxhdGVWaWV3LnBhcmVudFZpZXc7XG5cbiAgLy8gSGFjayBzbyB0aGF0IGlmIHlvdSBjYWxsIGB7ez4gZm9vIGJhcn19YCBhbmQgaXQgZXhwYW5kcyBpbnRvXG4gIC8vIGB7eyN3aXRoIGJhcn19e3s+IGZvb319e3svd2l0aH19YCwgYW5kIHRoZW4gYGZvb2AgaXMgYSB0ZW1wbGF0ZVxuICAvLyB0aGF0IGluc2VydHMgYHt7PiBUZW1wbGF0ZS5jb250ZW50QmxvY2t9fWAsIHRoZSBkYXRhIGNvbnRleHQgZm9yXG4gIC8vIGBUZW1wbGF0ZS5jb250ZW50QmxvY2tgIGlzIG5vdCBgYmFyYCBidXQgdGhlIG9uZSBlbmNsb3NpbmcgdGhhdC5cbiAgaWYgKHBhcmVudFZpZXcuX19pc1RlbXBsYXRlV2l0aClcbiAgICBwYXJlbnRWaWV3ID0gcGFyZW50Vmlldy5wYXJlbnRWaWV3O1xuXG4gIHZpZXcub25WaWV3Q3JlYXRlZChmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5vcmlnaW5hbFBhcmVudFZpZXcgPSB0aGlzLnBhcmVudFZpZXc7XG4gICAgdGhpcy5wYXJlbnRWaWV3ID0gcGFyZW50VmlldztcbiAgICB0aGlzLl9fY2hpbGREb2VzbnRTdGFydE5ld0xleGljYWxTY29wZSA9IHRydWU7XG4gIH0pO1xuICByZXR1cm4gdmlldztcbn07XG5cbi8vIFhYWCBDT01QQVQgV0lUSCAwLjkuMFxuQmxhemUuSW5PdXRlclRlbXBsYXRlU2NvcGUgPSBCbGF6ZS5fSW5PdXRlclRlbXBsYXRlU2NvcGU7XG4iLCJCbGF6ZS5fZ2xvYmFsSGVscGVycyA9IHt9O1xuXG4vLyBEb2N1bWVudGVkIGFzIFRlbXBsYXRlLnJlZ2lzdGVySGVscGVyLlxuLy8gVGhpcyBkZWZpbml0aW9uIGFsc28gcHJvdmlkZXMgYmFjay1jb21wYXQgZm9yIGBVSS5yZWdpc3RlckhlbHBlcmAuXG5CbGF6ZS5yZWdpc3RlckhlbHBlciA9IGZ1bmN0aW9uIChuYW1lLCBmdW5jKSB7XG4gIEJsYXplLl9nbG9iYWxIZWxwZXJzW25hbWVdID0gZnVuYztcbn07XG5cbi8vIEFsc28gZG9jdW1lbnRlZCBhcyBUZW1wbGF0ZS5kZXJlZ2lzdGVySGVscGVyXG5CbGF6ZS5kZXJlZ2lzdGVySGVscGVyID0gZnVuY3Rpb24obmFtZSkge1xuICBkZWxldGUgQmxhemUuX2dsb2JhbEhlbHBlcnNbbmFtZV07XG59O1xuXG52YXIgYmluZElmSXNGdW5jdGlvbiA9IGZ1bmN0aW9uICh4LCB0YXJnZXQpIHtcbiAgaWYgKHR5cGVvZiB4ICE9PSAnZnVuY3Rpb24nKVxuICAgIHJldHVybiB4O1xuICByZXR1cm4gQmxhemUuX2JpbmQoeCwgdGFyZ2V0KTtcbn07XG5cbi8vIElmIGB4YCBpcyBhIGZ1bmN0aW9uLCBiaW5kcyB0aGUgdmFsdWUgb2YgYHRoaXNgIGZvciB0aGF0IGZ1bmN0aW9uXG4vLyB0byB0aGUgY3VycmVudCBkYXRhIGNvbnRleHQuXG52YXIgYmluZERhdGFDb250ZXh0ID0gZnVuY3Rpb24gKHgpIHtcbiAgaWYgKHR5cGVvZiB4ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciBkYXRhID0gQmxhemUuZ2V0RGF0YSgpO1xuICAgICAgaWYgKGRhdGEgPT0gbnVsbClcbiAgICAgICAgZGF0YSA9IHt9O1xuICAgICAgcmV0dXJuIHguYXBwbHkoZGF0YSwgYXJndW1lbnRzKTtcbiAgICB9O1xuICB9XG4gIHJldHVybiB4O1xufTtcblxuQmxhemUuX09MRFNUWUxFX0hFTFBFUiA9IHt9O1xuXG5CbGF6ZS5fZ2V0VGVtcGxhdGVIZWxwZXIgPSBmdW5jdGlvbiAodGVtcGxhdGUsIG5hbWUsIHRtcGxJbnN0YW5jZUZ1bmMpIHtcbiAgLy8gWFhYIENPTVBBVCBXSVRIIDAuOS4zXG4gIHZhciBpc0tub3duT2xkU3R5bGVIZWxwZXIgPSBmYWxzZTtcblxuICBpZiAodGVtcGxhdGUuX19oZWxwZXJzLmhhcyhuYW1lKSkge1xuICAgIHZhciBoZWxwZXIgPSB0ZW1wbGF0ZS5fX2hlbHBlcnMuZ2V0KG5hbWUpO1xuICAgIGlmIChoZWxwZXIgPT09IEJsYXplLl9PTERTVFlMRV9IRUxQRVIpIHtcbiAgICAgIGlzS25vd25PbGRTdHlsZUhlbHBlciA9IHRydWU7XG4gICAgfSBlbHNlIGlmIChoZWxwZXIgIT0gbnVsbCkge1xuICAgICAgcmV0dXJuIHdyYXBIZWxwZXIoYmluZERhdGFDb250ZXh0KGhlbHBlciksIHRtcGxJbnN0YW5jZUZ1bmMpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICAvLyBvbGQtc3R5bGUgaGVscGVyXG4gIGlmIChuYW1lIGluIHRlbXBsYXRlKSB7XG4gICAgLy8gT25seSB3YXJuIG9uY2UgcGVyIGhlbHBlclxuICAgIGlmICghIGlzS25vd25PbGRTdHlsZUhlbHBlcikge1xuICAgICAgdGVtcGxhdGUuX19oZWxwZXJzLnNldChuYW1lLCBCbGF6ZS5fT0xEU1RZTEVfSEVMUEVSKTtcbiAgICAgIGlmICghIHRlbXBsYXRlLl9OT1dBUk5fT0xEU1RZTEVfSEVMUEVSUykge1xuICAgICAgICBCbGF6ZS5fd2FybignQXNzaWduaW5nIGhlbHBlciB3aXRoIGAnICsgdGVtcGxhdGUudmlld05hbWUgKyAnLicgK1xuICAgICAgICAgICAgICAgICAgICBuYW1lICsgJyA9IC4uLmAgaXMgZGVwcmVjYXRlZC4gIFVzZSBgJyArIHRlbXBsYXRlLnZpZXdOYW1lICtcbiAgICAgICAgICAgICAgICAgICAgJy5oZWxwZXJzKC4uLilgIGluc3RlYWQuJyk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICh0ZW1wbGF0ZVtuYW1lXSAhPSBudWxsKSB7XG4gICAgICByZXR1cm4gd3JhcEhlbHBlcihiaW5kRGF0YUNvbnRleHQodGVtcGxhdGVbbmFtZV0pLCB0bXBsSW5zdGFuY2VGdW5jKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbnVsbDtcbn07XG5cbnZhciB3cmFwSGVscGVyID0gZnVuY3Rpb24gKGYsIHRlbXBsYXRlRnVuYykge1xuICBpZiAodHlwZW9mIGYgIT09IFwiZnVuY3Rpb25cIikge1xuICAgIHJldHVybiBmO1xuICB9XG5cbiAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIGFyZ3MgPSBhcmd1bWVudHM7XG5cbiAgICByZXR1cm4gQmxhemUuVGVtcGxhdGUuX3dpdGhUZW1wbGF0ZUluc3RhbmNlRnVuYyh0ZW1wbGF0ZUZ1bmMsIGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiBCbGF6ZS5fd3JhcENhdGNoaW5nRXhjZXB0aW9ucyhmLCAndGVtcGxhdGUgaGVscGVyJykuYXBwbHkoc2VsZiwgYXJncyk7XG4gICAgfSk7XG4gIH07XG59O1xuXG5CbGF6ZS5fbGV4aWNhbEJpbmRpbmdMb29rdXAgPSBmdW5jdGlvbiAodmlldywgbmFtZSkge1xuICB2YXIgY3VycmVudFZpZXcgPSB2aWV3O1xuICB2YXIgYmxvY2tIZWxwZXJzU3RhY2sgPSBbXTtcblxuICAvLyB3YWxrIHVwIHRoZSB2aWV3cyBzdG9wcGluZyBhdCBhIFNwYWNlYmFycy5pbmNsdWRlIG9yIFRlbXBsYXRlIHZpZXcgdGhhdFxuICAvLyBkb2Vzbid0IGhhdmUgYW4gSW5PdXRlclRlbXBsYXRlU2NvcGUgdmlldyBhcyBhIHBhcmVudFxuICBkbyB7XG4gICAgLy8gc2tpcCBibG9jayBoZWxwZXJzIHZpZXdzXG4gICAgLy8gaWYgd2UgZm91bmQgdGhlIGJpbmRpbmcgb24gdGhlIHNjb3BlLCByZXR1cm4gaXRcbiAgICBpZiAoXy5oYXMoY3VycmVudFZpZXcuX3Njb3BlQmluZGluZ3MsIG5hbWUpKSB7XG4gICAgICB2YXIgYmluZGluZ1JlYWN0aXZlVmFyID0gY3VycmVudFZpZXcuX3Njb3BlQmluZGluZ3NbbmFtZV07XG4gICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gYmluZGluZ1JlYWN0aXZlVmFyLmdldCgpO1xuICAgICAgfTtcbiAgICB9XG4gIH0gd2hpbGUgKCEgKGN1cnJlbnRWaWV3Ll9fc3RhcnRzTmV3TGV4aWNhbFNjb3BlICYmXG4gICAgICAgICAgICAgICEgKGN1cnJlbnRWaWV3LnBhcmVudFZpZXcgJiZcbiAgICAgICAgICAgICAgICAgY3VycmVudFZpZXcucGFyZW50Vmlldy5fX2NoaWxkRG9lc250U3RhcnROZXdMZXhpY2FsU2NvcGUpKVxuICAgICAgICAgICAmJiAoY3VycmVudFZpZXcgPSBjdXJyZW50Vmlldy5wYXJlbnRWaWV3KSk7XG5cbiAgcmV0dXJuIG51bGw7XG59O1xuXG4vLyB0ZW1wbGF0ZUluc3RhbmNlIGFyZ3VtZW50IGlzIHByb3ZpZGVkIHRvIGJlIGF2YWlsYWJsZSBmb3IgcG9zc2libGVcbi8vIGFsdGVybmF0aXZlIGltcGxlbWVudGF0aW9ucyBvZiB0aGlzIGZ1bmN0aW9uIGJ5IDNyZCBwYXJ0eSBwYWNrYWdlcy5cbkJsYXplLl9nZXRUZW1wbGF0ZSA9IGZ1bmN0aW9uIChuYW1lLCB0ZW1wbGF0ZUluc3RhbmNlKSB7XG4gIGlmICgobmFtZSBpbiBCbGF6ZS5UZW1wbGF0ZSkgJiYgKEJsYXplLlRlbXBsYXRlW25hbWVdIGluc3RhbmNlb2YgQmxhemUuVGVtcGxhdGUpKSB7XG4gICAgcmV0dXJuIEJsYXplLlRlbXBsYXRlW25hbWVdO1xuICB9XG4gIHJldHVybiBudWxsO1xufTtcblxuQmxhemUuX2dldEdsb2JhbEhlbHBlciA9IGZ1bmN0aW9uIChuYW1lLCB0ZW1wbGF0ZUluc3RhbmNlKSB7XG4gIGlmIChCbGF6ZS5fZ2xvYmFsSGVscGVyc1tuYW1lXSAhPSBudWxsKSB7XG4gICAgcmV0dXJuIHdyYXBIZWxwZXIoYmluZERhdGFDb250ZXh0KEJsYXplLl9nbG9iYWxIZWxwZXJzW25hbWVdKSwgdGVtcGxhdGVJbnN0YW5jZSk7XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59O1xuXG4vLyBMb29rcyB1cCBhIG5hbWUsIGxpa2UgXCJmb29cIiBvciBcIi4uXCIsIGFzIGEgaGVscGVyIG9mIHRoZVxuLy8gY3VycmVudCB0ZW1wbGF0ZTsgdGhlIG5hbWUgb2YgYSB0ZW1wbGF0ZTsgYSBnbG9iYWwgaGVscGVyO1xuLy8gb3IgYSBwcm9wZXJ0eSBvZiB0aGUgZGF0YSBjb250ZXh0LiAgQ2FsbGVkIG9uIHRoZSBWaWV3IG9mXG4vLyBhIHRlbXBsYXRlIChpLmUuIGEgVmlldyB3aXRoIGEgYC50ZW1wbGF0ZWAgcHJvcGVydHksXG4vLyB3aGVyZSB0aGUgaGVscGVycyBhcmUpLiAgVXNlZCBmb3IgdGhlIGZpcnN0IG5hbWUgaW4gYVxuLy8gXCJwYXRoXCIgaW4gYSB0ZW1wbGF0ZSB0YWcsIGxpa2UgXCJmb29cIiBpbiBge3tmb28uYmFyfX1gIG9yXG4vLyBcIi4uXCIgaW4gYHt7ZnJvYnVsYXRlIC4uL2JsYWh9fWAuXG4vL1xuLy8gUmV0dXJucyBhIGZ1bmN0aW9uLCBhIG5vbi1mdW5jdGlvbiB2YWx1ZSwgb3IgbnVsbC4gIElmXG4vLyBhIGZ1bmN0aW9uIGlzIGZvdW5kLCBpdCBpcyBib3VuZCBhcHByb3ByaWF0ZWx5LlxuLy9cbi8vIE5PVEU6IFRoaXMgZnVuY3Rpb24gbXVzdCBub3QgZXN0YWJsaXNoIGFueSByZWFjdGl2ZVxuLy8gZGVwZW5kZW5jaWVzIGl0c2VsZi4gIElmIHRoZXJlIGlzIGFueSByZWFjdGl2aXR5IGluIHRoZVxuLy8gdmFsdWUsIGxvb2t1cCBzaG91bGQgcmV0dXJuIGEgZnVuY3Rpb24uXG5CbGF6ZS5WaWV3LnByb3RvdHlwZS5sb29rdXAgPSBmdW5jdGlvbiAobmFtZSwgX29wdGlvbnMpIHtcbiAgdmFyIHRlbXBsYXRlID0gdGhpcy50ZW1wbGF0ZTtcbiAgdmFyIGxvb2t1cFRlbXBsYXRlID0gX29wdGlvbnMgJiYgX29wdGlvbnMudGVtcGxhdGU7XG4gIHZhciBoZWxwZXI7XG4gIHZhciBiaW5kaW5nO1xuICB2YXIgYm91bmRUbXBsSW5zdGFuY2U7XG4gIHZhciBmb3VuZFRlbXBsYXRlO1xuXG4gIGlmICh0aGlzLnRlbXBsYXRlSW5zdGFuY2UpIHtcbiAgICBib3VuZFRtcGxJbnN0YW5jZSA9IEJsYXplLl9iaW5kKHRoaXMudGVtcGxhdGVJbnN0YW5jZSwgdGhpcyk7XG4gIH1cblxuICAvLyAwLiBsb29raW5nIHVwIHRoZSBwYXJlbnQgZGF0YSBjb250ZXh0IHdpdGggdGhlIHNwZWNpYWwgXCIuLi9cIiBzeW50YXhcbiAgaWYgKC9eXFwuLy50ZXN0KG5hbWUpKSB7XG4gICAgLy8gc3RhcnRzIHdpdGggYSBkb3QuIG11c3QgYmUgYSBzZXJpZXMgb2YgZG90cyB3aGljaCBtYXBzIHRvIGFuXG4gICAgLy8gYW5jZXN0b3Igb2YgdGhlIGFwcHJvcHJpYXRlIGhlaWdodC5cbiAgICBpZiAoIS9eKFxcLikrJC8udGVzdChuYW1lKSlcbiAgICAgIHRocm93IG5ldyBFcnJvcihcImlkIHN0YXJ0aW5nIHdpdGggZG90IG11c3QgYmUgYSBzZXJpZXMgb2YgZG90c1wiKTtcblxuICAgIHJldHVybiBCbGF6ZS5fcGFyZW50RGF0YShuYW1lLmxlbmd0aCAtIDEsIHRydWUgLypfZnVuY3Rpb25XcmFwcGVkKi8pO1xuXG4gIH1cblxuICAvLyAxLiBsb29rIHVwIGEgaGVscGVyIG9uIHRoZSBjdXJyZW50IHRlbXBsYXRlXG4gIGlmICh0ZW1wbGF0ZSAmJiAoKGhlbHBlciA9IEJsYXplLl9nZXRUZW1wbGF0ZUhlbHBlcih0ZW1wbGF0ZSwgbmFtZSwgYm91bmRUbXBsSW5zdGFuY2UpKSAhPSBudWxsKSkge1xuICAgIHJldHVybiBoZWxwZXI7XG4gIH1cblxuICAvLyAyLiBsb29rIHVwIGEgYmluZGluZyBieSB0cmF2ZXJzaW5nIHRoZSBsZXhpY2FsIHZpZXcgaGllcmFyY2h5IGluc2lkZSB0aGVcbiAgLy8gY3VycmVudCB0ZW1wbGF0ZVxuICBpZiAodGVtcGxhdGUgJiYgKGJpbmRpbmcgPSBCbGF6ZS5fbGV4aWNhbEJpbmRpbmdMb29rdXAoQmxhemUuY3VycmVudFZpZXcsIG5hbWUpKSAhPSBudWxsKSB7XG4gICAgcmV0dXJuIGJpbmRpbmc7XG4gIH1cblxuICAvLyAzLiBsb29rIHVwIGEgdGVtcGxhdGUgYnkgbmFtZVxuICBpZiAobG9va3VwVGVtcGxhdGUgJiYgKChmb3VuZFRlbXBsYXRlID0gQmxhemUuX2dldFRlbXBsYXRlKG5hbWUsIGJvdW5kVG1wbEluc3RhbmNlKSkgIT0gbnVsbCkpIHtcbiAgICByZXR1cm4gZm91bmRUZW1wbGF0ZTtcbiAgfVxuXG4gIC8vIDQuIGxvb2sgdXAgYSBnbG9iYWwgaGVscGVyXG4gIGlmICgoaGVscGVyID0gQmxhemUuX2dldEdsb2JhbEhlbHBlcihuYW1lLCBib3VuZFRtcGxJbnN0YW5jZSkpICE9IG51bGwpIHtcbiAgICByZXR1cm4gaGVscGVyO1xuICB9XG5cbiAgLy8gNS4gbG9vayB1cCBpbiBhIGRhdGEgY29udGV4dFxuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIHZhciBpc0NhbGxlZEFzRnVuY3Rpb24gPSAoYXJndW1lbnRzLmxlbmd0aCA+IDApO1xuICAgIHZhciBkYXRhID0gQmxhemUuZ2V0RGF0YSgpO1xuICAgIHZhciB4ID0gZGF0YSAmJiBkYXRhW25hbWVdO1xuICAgIGlmICghIHgpIHtcbiAgICAgIGlmIChsb29rdXBUZW1wbGF0ZSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJObyBzdWNoIHRlbXBsYXRlOiBcIiArIG5hbWUpO1xuICAgICAgfSBlbHNlIGlmIChpc0NhbGxlZEFzRnVuY3Rpb24pIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTm8gc3VjaCBmdW5jdGlvbjogXCIgKyBuYW1lKTtcbiAgICAgIH0gZWxzZSBpZiAobmFtZS5jaGFyQXQoMCkgPT09ICdAJyAmJiAoKHggPT09IG51bGwpIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICh4ID09PSB1bmRlZmluZWQpKSkge1xuICAgICAgICAvLyBUaHJvdyBhbiBlcnJvciBpZiB0aGUgdXNlciB0cmllcyB0byB1c2UgYSBgQGRpcmVjdGl2ZWBcbiAgICAgICAgLy8gdGhhdCBkb2Vzbid0IGV4aXN0LiAgV2UgZG9uJ3QgaW1wbGVtZW50IGFsbCBkaXJlY3RpdmVzXG4gICAgICAgIC8vIGZyb20gSGFuZGxlYmFycywgc28gdGhlcmUncyBhIHBvdGVudGlhbCBmb3IgY29uZnVzaW9uXG4gICAgICAgIC8vIGlmIHdlIGZhaWwgc2lsZW50bHkuICBPbiB0aGUgb3RoZXIgaGFuZCwgd2Ugd2FudCB0b1xuICAgICAgICAvLyB0aHJvdyBsYXRlIGluIGNhc2Ugc29tZSBhcHAgb3IgcGFja2FnZSB3YW50cyB0byBwcm92aWRlXG4gICAgICAgIC8vIGEgbWlzc2luZyBkaXJlY3RpdmUuXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIlVuc3VwcG9ydGVkIGRpcmVjdGl2ZTogXCIgKyBuYW1lKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKCEgZGF0YSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGlmICh0eXBlb2YgeCAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgaWYgKGlzQ2FsbGVkQXNGdW5jdGlvbikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW4ndCBjYWxsIG5vbi1mdW5jdGlvbjogXCIgKyB4KTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB4O1xuICAgIH1cbiAgICByZXR1cm4geC5hcHBseShkYXRhLCBhcmd1bWVudHMpO1xuICB9O1xufTtcblxuLy8gSW1wbGVtZW50IFNwYWNlYmFycycge3suLi8uLn19LlxuLy8gQHBhcmFtIGhlaWdodCB7TnVtYmVyfSBUaGUgbnVtYmVyIG9mICcuLidzXG5CbGF6ZS5fcGFyZW50RGF0YSA9IGZ1bmN0aW9uIChoZWlnaHQsIF9mdW5jdGlvbldyYXBwZWQpIHtcbiAgLy8gSWYgaGVpZ2h0IGlzIG51bGwgb3IgdW5kZWZpbmVkLCB3ZSBkZWZhdWx0IHRvIDEsIHRoZSBmaXJzdCBwYXJlbnQuXG4gIGlmIChoZWlnaHQgPT0gbnVsbCkge1xuICAgIGhlaWdodCA9IDE7XG4gIH1cbiAgdmFyIHRoZVdpdGggPSBCbGF6ZS5nZXRWaWV3KCd3aXRoJyk7XG4gIGZvciAodmFyIGkgPSAwOyAoaSA8IGhlaWdodCkgJiYgdGhlV2l0aDsgaSsrKSB7XG4gICAgdGhlV2l0aCA9IEJsYXplLmdldFZpZXcodGhlV2l0aCwgJ3dpdGgnKTtcbiAgfVxuXG4gIGlmICghIHRoZVdpdGgpXG4gICAgcmV0dXJuIG51bGw7XG4gIGlmIChfZnVuY3Rpb25XcmFwcGVkKVxuICAgIHJldHVybiBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGVXaXRoLmRhdGFWYXIuZ2V0KCk7IH07XG4gIHJldHVybiB0aGVXaXRoLmRhdGFWYXIuZ2V0KCk7XG59O1xuXG5cbkJsYXplLlZpZXcucHJvdG90eXBlLmxvb2t1cFRlbXBsYXRlID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgcmV0dXJuIHRoaXMubG9va3VwKG5hbWUsIHt0ZW1wbGF0ZTp0cnVlfSk7XG59O1xuIiwiLy8gW25ld10gQmxhemUuVGVtcGxhdGUoW3ZpZXdOYW1lXSwgcmVuZGVyRnVuY3Rpb24pXG4vL1xuLy8gYEJsYXplLlRlbXBsYXRlYCBpcyB0aGUgY2xhc3Mgb2YgdGVtcGxhdGVzLCBsaWtlIGBUZW1wbGF0ZS5mb29gIGluXG4vLyBNZXRlb3IsIHdoaWNoIGlzIGBpbnN0YW5jZW9mIFRlbXBsYXRlYC5cbi8vXG4vLyBgdmlld0tpbmRgIGlzIGEgc3RyaW5nIHRoYXQgbG9va3MgbGlrZSBcIlRlbXBsYXRlLmZvb1wiIGZvciB0ZW1wbGF0ZXNcbi8vIGRlZmluZWQgYnkgdGhlIGNvbXBpbGVyLlxuXG4vKipcbiAqIEBjbGFzc1xuICogQHN1bW1hcnkgQ29uc3RydWN0b3IgZm9yIGEgVGVtcGxhdGUsIHdoaWNoIGlzIHVzZWQgdG8gY29uc3RydWN0IFZpZXdzIHdpdGggcGFydGljdWxhciBuYW1lIGFuZCBjb250ZW50LlxuICogQGxvY3VzIENsaWVudFxuICogQHBhcmFtIHtTdHJpbmd9IFt2aWV3TmFtZV0gT3B0aW9uYWwuICBBIG5hbWUgZm9yIFZpZXdzIGNvbnN0cnVjdGVkIGJ5IHRoaXMgVGVtcGxhdGUuICBTZWUgW2B2aWV3Lm5hbWVgXSgjdmlld19uYW1lKS5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IHJlbmRlckZ1bmN0aW9uIEEgZnVuY3Rpb24gdGhhdCByZXR1cm5zIFsqcmVuZGVyYWJsZSBjb250ZW50Kl0oI1JlbmRlcmFibGUtQ29udGVudCkuICBUaGlzIGZ1bmN0aW9uIGlzIHVzZWQgYXMgdGhlIGByZW5kZXJGdW5jdGlvbmAgZm9yIFZpZXdzIGNvbnN0cnVjdGVkIGJ5IHRoaXMgVGVtcGxhdGUuXG4gKi9cbkJsYXplLlRlbXBsYXRlID0gZnVuY3Rpb24gKHZpZXdOYW1lLCByZW5kZXJGdW5jdGlvbikge1xuICBpZiAoISAodGhpcyBpbnN0YW5jZW9mIEJsYXplLlRlbXBsYXRlKSlcbiAgICAvLyBjYWxsZWQgd2l0aG91dCBgbmV3YFxuICAgIHJldHVybiBuZXcgQmxhemUuVGVtcGxhdGUodmlld05hbWUsIHJlbmRlckZ1bmN0aW9uKTtcblxuICBpZiAodHlwZW9mIHZpZXdOYW1lID09PSAnZnVuY3Rpb24nKSB7XG4gICAgLy8gb21pdHRlZCBcInZpZXdOYW1lXCIgYXJndW1lbnRcbiAgICByZW5kZXJGdW5jdGlvbiA9IHZpZXdOYW1lO1xuICAgIHZpZXdOYW1lID0gJyc7XG4gIH1cbiAgaWYgKHR5cGVvZiB2aWV3TmFtZSAhPT0gJ3N0cmluZycpXG4gICAgdGhyb3cgbmV3IEVycm9yKFwidmlld05hbWUgbXVzdCBiZSBhIFN0cmluZyAob3Igb21pdHRlZClcIik7XG4gIGlmICh0eXBlb2YgcmVuZGVyRnVuY3Rpb24gIT09ICdmdW5jdGlvbicpXG4gICAgdGhyb3cgbmV3IEVycm9yKFwicmVuZGVyRnVuY3Rpb24gbXVzdCBiZSBhIGZ1bmN0aW9uXCIpO1xuXG4gIHRoaXMudmlld05hbWUgPSB2aWV3TmFtZTtcbiAgdGhpcy5yZW5kZXJGdW5jdGlvbiA9IHJlbmRlckZ1bmN0aW9uO1xuXG4gIHRoaXMuX19oZWxwZXJzID0gbmV3IEhlbHBlck1hcDtcbiAgdGhpcy5fX2V2ZW50TWFwcyA9IFtdO1xuXG4gIHRoaXMuX2NhbGxiYWNrcyA9IHtcbiAgICBjcmVhdGVkOiBbXSxcbiAgICByZW5kZXJlZDogW10sXG4gICAgZGVzdHJveWVkOiBbXVxuICB9O1xufTtcbnZhciBUZW1wbGF0ZSA9IEJsYXplLlRlbXBsYXRlO1xuXG52YXIgSGVscGVyTWFwID0gZnVuY3Rpb24gKCkge307XG5IZWxwZXJNYXAucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gIHJldHVybiB0aGlzWycgJytuYW1lXTtcbn07XG5IZWxwZXJNYXAucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uIChuYW1lLCBoZWxwZXIpIHtcbiAgdGhpc1snICcrbmFtZV0gPSBoZWxwZXI7XG59O1xuSGVscGVyTWFwLnByb3RvdHlwZS5oYXMgPSBmdW5jdGlvbiAobmFtZSkge1xuICByZXR1cm4gKHR5cGVvZiB0aGlzWycgJytuYW1lXSAhPT0gJ3VuZGVmaW5lZCcpO1xufTtcblxuLyoqXG4gKiBAc3VtbWFyeSBSZXR1cm5zIHRydWUgaWYgYHZhbHVlYCBpcyBhIHRlbXBsYXRlIG9iamVjdCBsaWtlIGBUZW1wbGF0ZS5teVRlbXBsYXRlYC5cbiAqIEBsb2N1cyBDbGllbnRcbiAqIEBwYXJhbSB7QW55fSB2YWx1ZSBUaGUgdmFsdWUgdG8gdGVzdC5cbiAqL1xuQmxhemUuaXNUZW1wbGF0ZSA9IGZ1bmN0aW9uICh0KSB7XG4gIHJldHVybiAodCBpbnN0YW5jZW9mIEJsYXplLlRlbXBsYXRlKTtcbn07XG5cbi8qKlxuICogQG5hbWUgIG9uQ3JlYXRlZFxuICogQGluc3RhbmNlXG4gKiBAbWVtYmVyT2YgVGVtcGxhdGVcbiAqIEBzdW1tYXJ5IFJlZ2lzdGVyIGEgZnVuY3Rpb24gdG8gYmUgY2FsbGVkIHdoZW4gYW4gaW5zdGFuY2Ugb2YgdGhpcyB0ZW1wbGF0ZSBpcyBjcmVhdGVkLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgQSBmdW5jdGlvbiB0byBiZSBhZGRlZCBhcyBhIGNhbGxiYWNrLlxuICogQGxvY3VzIENsaWVudFxuICogQGltcG9ydEZyb21QYWNrYWdlIHRlbXBsYXRpbmdcbiAqL1xuVGVtcGxhdGUucHJvdG90eXBlLm9uQ3JlYXRlZCA9IGZ1bmN0aW9uIChjYikge1xuICB0aGlzLl9jYWxsYmFja3MuY3JlYXRlZC5wdXNoKGNiKTtcbn07XG5cbi8qKlxuICogQG5hbWUgIG9uUmVuZGVyZWRcbiAqIEBpbnN0YW5jZVxuICogQG1lbWJlck9mIFRlbXBsYXRlXG4gKiBAc3VtbWFyeSBSZWdpc3RlciBhIGZ1bmN0aW9uIHRvIGJlIGNhbGxlZCB3aGVuIGFuIGluc3RhbmNlIG9mIHRoaXMgdGVtcGxhdGUgaXMgaW5zZXJ0ZWQgaW50byB0aGUgRE9NLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgQSBmdW5jdGlvbiB0byBiZSBhZGRlZCBhcyBhIGNhbGxiYWNrLlxuICogQGxvY3VzIENsaWVudFxuICogQGltcG9ydEZyb21QYWNrYWdlIHRlbXBsYXRpbmdcbiAqL1xuVGVtcGxhdGUucHJvdG90eXBlLm9uUmVuZGVyZWQgPSBmdW5jdGlvbiAoY2IpIHtcbiAgdGhpcy5fY2FsbGJhY2tzLnJlbmRlcmVkLnB1c2goY2IpO1xufTtcblxuLyoqXG4gKiBAbmFtZSAgb25EZXN0cm95ZWRcbiAqIEBpbnN0YW5jZVxuICogQG1lbWJlck9mIFRlbXBsYXRlXG4gKiBAc3VtbWFyeSBSZWdpc3RlciBhIGZ1bmN0aW9uIHRvIGJlIGNhbGxlZCB3aGVuIGFuIGluc3RhbmNlIG9mIHRoaXMgdGVtcGxhdGUgaXMgcmVtb3ZlZCBmcm9tIHRoZSBET00gYW5kIGRlc3Ryb3llZC5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIEEgZnVuY3Rpb24gdG8gYmUgYWRkZWQgYXMgYSBjYWxsYmFjay5cbiAqIEBsb2N1cyBDbGllbnRcbiAqIEBpbXBvcnRGcm9tUGFja2FnZSB0ZW1wbGF0aW5nXG4gKi9cblRlbXBsYXRlLnByb3RvdHlwZS5vbkRlc3Ryb3llZCA9IGZ1bmN0aW9uIChjYikge1xuICB0aGlzLl9jYWxsYmFja3MuZGVzdHJveWVkLnB1c2goY2IpO1xufTtcblxuVGVtcGxhdGUucHJvdG90eXBlLl9nZXRDYWxsYmFja3MgPSBmdW5jdGlvbiAod2hpY2gpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB2YXIgY2FsbGJhY2tzID0gc2VsZlt3aGljaF0gPyBbc2VsZlt3aGljaF1dIDogW107XG4gIC8vIEZpcmUgYWxsIGNhbGxiYWNrcyBhZGRlZCB3aXRoIHRoZSBuZXcgQVBJIChUZW1wbGF0ZS5vblJlbmRlcmVkKCkpXG4gIC8vIGFzIHdlbGwgYXMgdGhlIG9sZC1zdHlsZSBjYWxsYmFjayAoZS5nLiBUZW1wbGF0ZS5yZW5kZXJlZCkgZm9yXG4gIC8vIGJhY2t3YXJkcy1jb21wYXRpYmlsaXR5LlxuICBjYWxsYmFja3MgPSBjYWxsYmFja3MuY29uY2F0KHNlbGYuX2NhbGxiYWNrc1t3aGljaF0pO1xuICByZXR1cm4gY2FsbGJhY2tzO1xufTtcblxudmFyIGZpcmVDYWxsYmFja3MgPSBmdW5jdGlvbiAoY2FsbGJhY2tzLCB0ZW1wbGF0ZSkge1xuICBUZW1wbGF0ZS5fd2l0aFRlbXBsYXRlSW5zdGFuY2VGdW5jKFxuICAgIGZ1bmN0aW9uICgpIHsgcmV0dXJuIHRlbXBsYXRlOyB9LFxuICAgIGZ1bmN0aW9uICgpIHtcbiAgICAgIGZvciAodmFyIGkgPSAwLCBOID0gY2FsbGJhY2tzLmxlbmd0aDsgaSA8IE47IGkrKykge1xuICAgICAgICBjYWxsYmFja3NbaV0uY2FsbCh0ZW1wbGF0ZSk7XG4gICAgICB9XG4gICAgfSk7XG59O1xuXG5UZW1wbGF0ZS5wcm90b3R5cGUuY29uc3RydWN0VmlldyA9IGZ1bmN0aW9uIChjb250ZW50RnVuYywgZWxzZUZ1bmMpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB2YXIgdmlldyA9IEJsYXplLlZpZXcoc2VsZi52aWV3TmFtZSwgc2VsZi5yZW5kZXJGdW5jdGlvbik7XG4gIHZpZXcudGVtcGxhdGUgPSBzZWxmO1xuXG4gIHZpZXcudGVtcGxhdGVDb250ZW50QmxvY2sgPSAoXG4gICAgY29udGVudEZ1bmMgPyBuZXcgVGVtcGxhdGUoJyhjb250ZW50QmxvY2spJywgY29udGVudEZ1bmMpIDogbnVsbCk7XG4gIHZpZXcudGVtcGxhdGVFbHNlQmxvY2sgPSAoXG4gICAgZWxzZUZ1bmMgPyBuZXcgVGVtcGxhdGUoJyhlbHNlQmxvY2spJywgZWxzZUZ1bmMpIDogbnVsbCk7XG5cbiAgaWYgKHNlbGYuX19ldmVudE1hcHMgfHwgdHlwZW9mIHNlbGYuZXZlbnRzID09PSAnb2JqZWN0Jykge1xuICAgIHZpZXcuX29uVmlld1JlbmRlcmVkKGZ1bmN0aW9uICgpIHtcbiAgICAgIGlmICh2aWV3LnJlbmRlckNvdW50ICE9PSAxKVxuICAgICAgICByZXR1cm47XG5cbiAgICAgIGlmICghIHNlbGYuX19ldmVudE1hcHMubGVuZ3RoICYmIHR5cGVvZiBzZWxmLmV2ZW50cyA9PT0gXCJvYmplY3RcIikge1xuICAgICAgICAvLyBQcm92aWRlIGxpbWl0ZWQgYmFjay1jb21wYXQgc3VwcG9ydCBmb3IgYC5ldmVudHMgPSB7Li4ufWBcbiAgICAgICAgLy8gc3ludGF4LiAgUGFzcyBgdGVtcGxhdGUuZXZlbnRzYCB0byB0aGUgb3JpZ2luYWwgYC5ldmVudHMoLi4uKWBcbiAgICAgICAgLy8gZnVuY3Rpb24uICBUaGlzIGNvZGUgbXVzdCBydW4gb25seSBvbmNlIHBlciB0ZW1wbGF0ZSwgaW5cbiAgICAgICAgLy8gb3JkZXIgdG8gbm90IGJpbmQgdGhlIGhhbmRsZXJzIG1vcmUgdGhhbiBvbmNlLCB3aGljaCBpc1xuICAgICAgICAvLyBlbnN1cmVkIGJ5IHRoZSBmYWN0IHRoYXQgd2Ugb25seSBkbyB0aGlzIHdoZW4gYF9fZXZlbnRNYXBzYFxuICAgICAgICAvLyBpcyBmYWxzeSwgYW5kIHdlIGNhdXNlIGl0IHRvIGJlIHNldCBub3cuXG4gICAgICAgIFRlbXBsYXRlLnByb3RvdHlwZS5ldmVudHMuY2FsbChzZWxmLCBzZWxmLmV2ZW50cyk7XG4gICAgICB9XG5cbiAgICAgIF8uZWFjaChzZWxmLl9fZXZlbnRNYXBzLCBmdW5jdGlvbiAobSkge1xuICAgICAgICBCbGF6ZS5fYWRkRXZlbnRNYXAodmlldywgbSwgdmlldyk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIHZpZXcuX3RlbXBsYXRlSW5zdGFuY2UgPSBuZXcgQmxhemUuVGVtcGxhdGVJbnN0YW5jZSh2aWV3KTtcbiAgdmlldy50ZW1wbGF0ZUluc3RhbmNlID0gZnVuY3Rpb24gKCkge1xuICAgIC8vIFVwZGF0ZSBkYXRhLCBmaXJzdE5vZGUsIGFuZCBsYXN0Tm9kZSwgYW5kIHJldHVybiB0aGUgVGVtcGxhdGVJbnN0YW5jZVxuICAgIC8vIG9iamVjdC5cbiAgICB2YXIgaW5zdCA9IHZpZXcuX3RlbXBsYXRlSW5zdGFuY2U7XG5cbiAgICAvKipcbiAgICAgKiBAaW5zdGFuY2VcbiAgICAgKiBAbWVtYmVyT2YgQmxhemUuVGVtcGxhdGVJbnN0YW5jZVxuICAgICAqIEBuYW1lICBkYXRhXG4gICAgICogQHN1bW1hcnkgVGhlIGRhdGEgY29udGV4dCBvZiB0aGlzIGluc3RhbmNlJ3MgbGF0ZXN0IGludm9jYXRpb24uXG4gICAgICogQGxvY3VzIENsaWVudFxuICAgICAqL1xuICAgIGluc3QuZGF0YSA9IEJsYXplLmdldERhdGEodmlldyk7XG5cbiAgICBpZiAodmlldy5fZG9tcmFuZ2UgJiYgIXZpZXcuaXNEZXN0cm95ZWQpIHtcbiAgICAgIGluc3QuZmlyc3ROb2RlID0gdmlldy5fZG9tcmFuZ2UuZmlyc3ROb2RlKCk7XG4gICAgICBpbnN0Lmxhc3ROb2RlID0gdmlldy5fZG9tcmFuZ2UubGFzdE5vZGUoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gb24gJ2NyZWF0ZWQnIG9yICdkZXN0cm95ZWQnIGNhbGxiYWNrcyB3ZSBkb24ndCBoYXZlIGEgRG9tUmFuZ2VcbiAgICAgIGluc3QuZmlyc3ROb2RlID0gbnVsbDtcbiAgICAgIGluc3QubGFzdE5vZGUgPSBudWxsO1xuICAgIH1cblxuICAgIHJldHVybiBpbnN0O1xuICB9O1xuXG4gIC8qKlxuICAgKiBAbmFtZSAgY3JlYXRlZFxuICAgKiBAaW5zdGFuY2VcbiAgICogQG1lbWJlck9mIFRlbXBsYXRlXG4gICAqIEBzdW1tYXJ5IFByb3ZpZGUgYSBjYWxsYmFjayB3aGVuIGFuIGluc3RhbmNlIG9mIGEgdGVtcGxhdGUgaXMgY3JlYXRlZC5cbiAgICogQGxvY3VzIENsaWVudFxuICAgKiBAZGVwcmVjYXRlZCBpbiAxLjFcbiAgICovXG4gIC8vIFRvIGF2b2lkIHNpdHVhdGlvbnMgd2hlbiBuZXcgY2FsbGJhY2tzIGFyZSBhZGRlZCBpbiBiZXR3ZWVuIHZpZXdcbiAgLy8gaW5zdGFudGlhdGlvbiBhbmQgZXZlbnQgYmVpbmcgZmlyZWQsIGRlY2lkZSBvbiBhbGwgY2FsbGJhY2tzIHRvIGZpcmVcbiAgLy8gaW1tZWRpYXRlbHkgYW5kIHRoZW4gZmlyZSB0aGVtIG9uIHRoZSBldmVudC5cbiAgdmFyIGNyZWF0ZWRDYWxsYmFja3MgPSBzZWxmLl9nZXRDYWxsYmFja3MoJ2NyZWF0ZWQnKTtcbiAgdmlldy5vblZpZXdDcmVhdGVkKGZ1bmN0aW9uICgpIHtcbiAgICBmaXJlQ2FsbGJhY2tzKGNyZWF0ZWRDYWxsYmFja3MsIHZpZXcudGVtcGxhdGVJbnN0YW5jZSgpKTtcbiAgfSk7XG5cbiAgLyoqXG4gICAqIEBuYW1lICByZW5kZXJlZFxuICAgKiBAaW5zdGFuY2VcbiAgICogQG1lbWJlck9mIFRlbXBsYXRlXG4gICAqIEBzdW1tYXJ5IFByb3ZpZGUgYSBjYWxsYmFjayB3aGVuIGFuIGluc3RhbmNlIG9mIGEgdGVtcGxhdGUgaXMgcmVuZGVyZWQuXG4gICAqIEBsb2N1cyBDbGllbnRcbiAgICogQGRlcHJlY2F0ZWQgaW4gMS4xXG4gICAqL1xuICB2YXIgcmVuZGVyZWRDYWxsYmFja3MgPSBzZWxmLl9nZXRDYWxsYmFja3MoJ3JlbmRlcmVkJyk7XG4gIHZpZXcub25WaWV3UmVhZHkoZnVuY3Rpb24gKCkge1xuICAgIGZpcmVDYWxsYmFja3MocmVuZGVyZWRDYWxsYmFja3MsIHZpZXcudGVtcGxhdGVJbnN0YW5jZSgpKTtcbiAgfSk7XG5cbiAgLyoqXG4gICAqIEBuYW1lICBkZXN0cm95ZWRcbiAgICogQGluc3RhbmNlXG4gICAqIEBtZW1iZXJPZiBUZW1wbGF0ZVxuICAgKiBAc3VtbWFyeSBQcm92aWRlIGEgY2FsbGJhY2sgd2hlbiBhbiBpbnN0YW5jZSBvZiBhIHRlbXBsYXRlIGlzIGRlc3Ryb3llZC5cbiAgICogQGxvY3VzIENsaWVudFxuICAgKiBAZGVwcmVjYXRlZCBpbiAxLjFcbiAgICovXG4gIHZhciBkZXN0cm95ZWRDYWxsYmFja3MgPSBzZWxmLl9nZXRDYWxsYmFja3MoJ2Rlc3Ryb3llZCcpO1xuICB2aWV3Lm9uVmlld0Rlc3Ryb3llZChmdW5jdGlvbiAoKSB7XG4gICAgZmlyZUNhbGxiYWNrcyhkZXN0cm95ZWRDYWxsYmFja3MsIHZpZXcudGVtcGxhdGVJbnN0YW5jZSgpKTtcbiAgfSk7XG5cbiAgcmV0dXJuIHZpZXc7XG59O1xuXG4vKipcbiAqIEBjbGFzc1xuICogQHN1bW1hcnkgVGhlIGNsYXNzIGZvciB0ZW1wbGF0ZSBpbnN0YW5jZXNcbiAqIEBwYXJhbSB7QmxhemUuVmlld30gdmlld1xuICogQGluc3RhbmNlTmFtZSB0ZW1wbGF0ZVxuICovXG5CbGF6ZS5UZW1wbGF0ZUluc3RhbmNlID0gZnVuY3Rpb24gKHZpZXcpIHtcbiAgaWYgKCEgKHRoaXMgaW5zdGFuY2VvZiBCbGF6ZS5UZW1wbGF0ZUluc3RhbmNlKSlcbiAgICAvLyBjYWxsZWQgd2l0aG91dCBgbmV3YFxuICAgIHJldHVybiBuZXcgQmxhemUuVGVtcGxhdGVJbnN0YW5jZSh2aWV3KTtcblxuICBpZiAoISAodmlldyBpbnN0YW5jZW9mIEJsYXplLlZpZXcpKVxuICAgIHRocm93IG5ldyBFcnJvcihcIlZpZXcgcmVxdWlyZWRcIik7XG5cbiAgdmlldy5fdGVtcGxhdGVJbnN0YW5jZSA9IHRoaXM7XG5cbiAgLyoqXG4gICAqIEBuYW1lIHZpZXdcbiAgICogQG1lbWJlck9mIEJsYXplLlRlbXBsYXRlSW5zdGFuY2VcbiAgICogQGluc3RhbmNlXG4gICAqIEBzdW1tYXJ5IFRoZSBbVmlld10oLi4vYXBpL2JsYXplLmh0bWwjQmxhemUtVmlldykgb2JqZWN0IGZvciB0aGlzIGludm9jYXRpb24gb2YgdGhlIHRlbXBsYXRlLlxuICAgKiBAbG9jdXMgQ2xpZW50XG4gICAqIEB0eXBlIHtCbGF6ZS5WaWV3fVxuICAgKi9cbiAgdGhpcy52aWV3ID0gdmlldztcbiAgdGhpcy5kYXRhID0gbnVsbDtcblxuICAvKipcbiAgICogQG5hbWUgZmlyc3ROb2RlXG4gICAqIEBtZW1iZXJPZiBCbGF6ZS5UZW1wbGF0ZUluc3RhbmNlXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAc3VtbWFyeSBUaGUgZmlyc3QgdG9wLWxldmVsIERPTSBub2RlIGluIHRoaXMgdGVtcGxhdGUgaW5zdGFuY2UuXG4gICAqIEBsb2N1cyBDbGllbnRcbiAgICogQHR5cGUge0RPTU5vZGV9XG4gICAqL1xuICB0aGlzLmZpcnN0Tm9kZSA9IG51bGw7XG5cbiAgLyoqXG4gICAqIEBuYW1lIGxhc3ROb2RlXG4gICAqIEBtZW1iZXJPZiBCbGF6ZS5UZW1wbGF0ZUluc3RhbmNlXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAc3VtbWFyeSBUaGUgbGFzdCB0b3AtbGV2ZWwgRE9NIG5vZGUgaW4gdGhpcyB0ZW1wbGF0ZSBpbnN0YW5jZS5cbiAgICogQGxvY3VzIENsaWVudFxuICAgKiBAdHlwZSB7RE9NTm9kZX1cbiAgICovXG4gIHRoaXMubGFzdE5vZGUgPSBudWxsO1xuXG4gIC8vIFRoaXMgZGVwZW5kZW5jeSBpcyB1c2VkIHRvIGlkZW50aWZ5IHN0YXRlIHRyYW5zaXRpb25zIGluXG4gIC8vIF9zdWJzY3JpcHRpb25IYW5kbGVzIHdoaWNoIGNvdWxkIGNhdXNlIHRoZSByZXN1bHQgb2ZcbiAgLy8gVGVtcGxhdGVJbnN0YW5jZSNzdWJzY3JpcHRpb25zUmVhZHkgdG8gY2hhbmdlLiBCYXNpY2FsbHkgdGhpcyBpcyB0cmlnZ2VyZWRcbiAgLy8gd2hlbmV2ZXIgYSBuZXcgc3Vic2NyaXB0aW9uIGhhbmRsZSBpcyBhZGRlZCBvciB3aGVuIGEgc3Vic2NyaXB0aW9uIGhhbmRsZVxuICAvLyBpcyByZW1vdmVkIGFuZCB0aGV5IGFyZSBub3QgcmVhZHkuXG4gIHRoaXMuX2FsbFN1YnNSZWFkeURlcCA9IG5ldyBUcmFja2VyLkRlcGVuZGVuY3koKTtcbiAgdGhpcy5fYWxsU3Vic1JlYWR5ID0gZmFsc2U7XG5cbiAgdGhpcy5fc3Vic2NyaXB0aW9uSGFuZGxlcyA9IHt9O1xufTtcblxuLyoqXG4gKiBAc3VtbWFyeSBGaW5kIGFsbCBlbGVtZW50cyBtYXRjaGluZyBgc2VsZWN0b3JgIGluIHRoaXMgdGVtcGxhdGUgaW5zdGFuY2UsIGFuZCByZXR1cm4gdGhlbSBhcyBhIEpRdWVyeSBvYmplY3QuXG4gKiBAbG9jdXMgQ2xpZW50XG4gKiBAcGFyYW0ge1N0cmluZ30gc2VsZWN0b3IgVGhlIENTUyBzZWxlY3RvciB0byBtYXRjaCwgc2NvcGVkIHRvIHRoZSB0ZW1wbGF0ZSBjb250ZW50cy5cbiAqIEByZXR1cm5zIHtET01Ob2RlW119XG4gKi9cbkJsYXplLlRlbXBsYXRlSW5zdGFuY2UucHJvdG90eXBlLiQgPSBmdW5jdGlvbiAoc2VsZWN0b3IpIHtcbiAgdmFyIHZpZXcgPSB0aGlzLnZpZXc7XG4gIGlmICghIHZpZXcuX2RvbXJhbmdlKVxuICAgIHRocm93IG5ldyBFcnJvcihcIkNhbid0IHVzZSAkIG9uIHRlbXBsYXRlIGluc3RhbmNlIHdpdGggbm8gRE9NXCIpO1xuICByZXR1cm4gdmlldy5fZG9tcmFuZ2UuJChzZWxlY3Rvcik7XG59O1xuXG4vKipcbiAqIEBzdW1tYXJ5IEZpbmQgYWxsIGVsZW1lbnRzIG1hdGNoaW5nIGBzZWxlY3RvcmAgaW4gdGhpcyB0ZW1wbGF0ZSBpbnN0YW5jZS5cbiAqIEBsb2N1cyBDbGllbnRcbiAqIEBwYXJhbSB7U3RyaW5nfSBzZWxlY3RvciBUaGUgQ1NTIHNlbGVjdG9yIHRvIG1hdGNoLCBzY29wZWQgdG8gdGhlIHRlbXBsYXRlIGNvbnRlbnRzLlxuICogQHJldHVybnMge0RPTUVsZW1lbnRbXX1cbiAqL1xuQmxhemUuVGVtcGxhdGVJbnN0YW5jZS5wcm90b3R5cGUuZmluZEFsbCA9IGZ1bmN0aW9uIChzZWxlY3Rvcikge1xuICByZXR1cm4gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwodGhpcy4kKHNlbGVjdG9yKSk7XG59O1xuXG4vKipcbiAqIEBzdW1tYXJ5IEZpbmQgb25lIGVsZW1lbnQgbWF0Y2hpbmcgYHNlbGVjdG9yYCBpbiB0aGlzIHRlbXBsYXRlIGluc3RhbmNlLlxuICogQGxvY3VzIENsaWVudFxuICogQHBhcmFtIHtTdHJpbmd9IHNlbGVjdG9yIFRoZSBDU1Mgc2VsZWN0b3IgdG8gbWF0Y2gsIHNjb3BlZCB0byB0aGUgdGVtcGxhdGUgY29udGVudHMuXG4gKiBAcmV0dXJucyB7RE9NRWxlbWVudH1cbiAqL1xuQmxhemUuVGVtcGxhdGVJbnN0YW5jZS5wcm90b3R5cGUuZmluZCA9IGZ1bmN0aW9uIChzZWxlY3Rvcikge1xuICB2YXIgcmVzdWx0ID0gdGhpcy4kKHNlbGVjdG9yKTtcbiAgcmV0dXJuIHJlc3VsdFswXSB8fCBudWxsO1xufTtcblxuLyoqXG4gKiBAc3VtbWFyeSBBIHZlcnNpb24gb2YgW1RyYWNrZXIuYXV0b3J1bl0oaHR0cHM6Ly9kb2NzLm1ldGVvci5jb20vYXBpL3RyYWNrZXIuaHRtbCNUcmFja2VyLWF1dG9ydW4pIHRoYXQgaXMgc3RvcHBlZCB3aGVuIHRoZSB0ZW1wbGF0ZSBpcyBkZXN0cm95ZWQuXG4gKiBAbG9jdXMgQ2xpZW50XG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBydW5GdW5jIFRoZSBmdW5jdGlvbiB0byBydW4uIEl0IHJlY2VpdmVzIG9uZSBhcmd1bWVudDogYSBUcmFja2VyLkNvbXB1dGF0aW9uIG9iamVjdC5cbiAqL1xuQmxhemUuVGVtcGxhdGVJbnN0YW5jZS5wcm90b3R5cGUuYXV0b3J1biA9IGZ1bmN0aW9uIChmKSB7XG4gIHJldHVybiB0aGlzLnZpZXcuYXV0b3J1bihmKTtcbn07XG5cbi8qKlxuICogQHN1bW1hcnkgQSB2ZXJzaW9uIG9mIFtNZXRlb3Iuc3Vic2NyaWJlXShodHRwczovL2RvY3MubWV0ZW9yLmNvbS9hcGkvcHVic3ViLmh0bWwjTWV0ZW9yLXN1YnNjcmliZSkgdGhhdCBpcyBzdG9wcGVkXG4gKiB3aGVuIHRoZSB0ZW1wbGF0ZSBpcyBkZXN0cm95ZWQuXG4gKiBAcmV0dXJuIHtTdWJzY3JpcHRpb25IYW5kbGV9IFRoZSBzdWJzY3JpcHRpb24gaGFuZGxlIHRvIHRoZSBuZXdseSBtYWRlXG4gKiBzdWJzY3JpcHRpb24uIENhbGwgYGhhbmRsZS5zdG9wKClgIHRvIG1hbnVhbGx5IHN0b3AgdGhlIHN1YnNjcmlwdGlvbiwgb3JcbiAqIGBoYW5kbGUucmVhZHkoKWAgdG8gZmluZCBvdXQgaWYgdGhpcyBwYXJ0aWN1bGFyIHN1YnNjcmlwdGlvbiBoYXMgbG9hZGVkIGFsbFxuICogb2YgaXRzIGluaXRhbCBkYXRhLlxuICogQGxvY3VzIENsaWVudFxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiB0aGUgc3Vic2NyaXB0aW9uLiAgTWF0Y2hlcyB0aGUgbmFtZSBvZiB0aGVcbiAqIHNlcnZlcidzIGBwdWJsaXNoKClgIGNhbGwuXG4gKiBAcGFyYW0ge0FueX0gW2FyZzEsYXJnMi4uLl0gT3B0aW9uYWwgYXJndW1lbnRzIHBhc3NlZCB0byBwdWJsaXNoZXIgZnVuY3Rpb25cbiAqIG9uIHNlcnZlci5cbiAqIEBwYXJhbSB7RnVuY3Rpb258T2JqZWN0fSBbb3B0aW9uc10gSWYgYSBmdW5jdGlvbiBpcyBwYXNzZWQgaW5zdGVhZCBvZiBhblxuICogb2JqZWN0LCBpdCBpcyBpbnRlcnByZXRlZCBhcyBhbiBgb25SZWFkeWAgY2FsbGJhY2suXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb3B0aW9ucy5vblJlYWR5XSBQYXNzZWQgdG8gW2BNZXRlb3Iuc3Vic2NyaWJlYF0oaHR0cHM6Ly9kb2NzLm1ldGVvci5jb20vYXBpL3B1YnN1Yi5odG1sI01ldGVvci1zdWJzY3JpYmUpLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gW29wdGlvbnMub25TdG9wXSBQYXNzZWQgdG8gW2BNZXRlb3Iuc3Vic2NyaWJlYF0oaHR0cHM6Ly9kb2NzLm1ldGVvci5jb20vYXBpL3B1YnN1Yi5odG1sI01ldGVvci1zdWJzY3JpYmUpLlxuICogQHBhcmFtIHtERFAuQ29ubmVjdGlvbn0gW29wdGlvbnMuY29ubmVjdGlvbl0gVGhlIGNvbm5lY3Rpb24gb24gd2hpY2ggdG8gbWFrZSB0aGVcbiAqIHN1YnNjcmlwdGlvbi5cbiAqL1xuQmxhemUuVGVtcGxhdGVJbnN0YW5jZS5wcm90b3R5cGUuc3Vic2NyaWJlID0gZnVuY3Rpb24gKC8qIGFyZ3VtZW50cyAqLykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgdmFyIHN1YkhhbmRsZXMgPSBzZWxmLl9zdWJzY3JpcHRpb25IYW5kbGVzO1xuICB2YXIgYXJncyA9IF8udG9BcnJheShhcmd1bWVudHMpO1xuXG4gIC8vIER1cGxpY2F0ZSBsb2dpYyBmcm9tIE1ldGVvci5zdWJzY3JpYmVcbiAgdmFyIG9wdGlvbnMgPSB7fTtcbiAgaWYgKGFyZ3MubGVuZ3RoKSB7XG4gICAgdmFyIGxhc3RQYXJhbSA9IF8ubGFzdChhcmdzKTtcblxuICAgIC8vIE1hdGNoIHBhdHRlcm4gdG8gY2hlY2sgaWYgdGhlIGxhc3QgYXJnIGlzIGFuIG9wdGlvbnMgYXJndW1lbnRcbiAgICB2YXIgbGFzdFBhcmFtT3B0aW9uc1BhdHRlcm4gPSB7XG4gICAgICBvblJlYWR5OiBNYXRjaC5PcHRpb25hbChGdW5jdGlvbiksXG4gICAgICAvLyBYWFggQ09NUEFUIFdJVEggMS4wLjMuMSBvbkVycm9yIHVzZWQgdG8gZXhpc3QsIGJ1dCBub3cgd2UgdXNlXG4gICAgICAvLyBvblN0b3Agd2l0aCBhbiBlcnJvciBjYWxsYmFjayBpbnN0ZWFkLlxuICAgICAgb25FcnJvcjogTWF0Y2guT3B0aW9uYWwoRnVuY3Rpb24pLFxuICAgICAgb25TdG9wOiBNYXRjaC5PcHRpb25hbChGdW5jdGlvbiksXG4gICAgICBjb25uZWN0aW9uOiBNYXRjaC5PcHRpb25hbChNYXRjaC5BbnkpXG4gICAgfTtcblxuICAgIGlmIChfLmlzRnVuY3Rpb24obGFzdFBhcmFtKSkge1xuICAgICAgb3B0aW9ucy5vblJlYWR5ID0gYXJncy5wb3AoKTtcbiAgICB9IGVsc2UgaWYgKGxhc3RQYXJhbSAmJiAhIF8uaXNFbXB0eShsYXN0UGFyYW0pICYmIE1hdGNoLnRlc3QobGFzdFBhcmFtLCBsYXN0UGFyYW1PcHRpb25zUGF0dGVybikpIHtcbiAgICAgIG9wdGlvbnMgPSBhcmdzLnBvcCgpO1xuICAgIH1cbiAgfVxuXG4gIHZhciBzdWJIYW5kbGU7XG4gIHZhciBvbGRTdG9wcGVkID0gb3B0aW9ucy5vblN0b3A7XG4gIG9wdGlvbnMub25TdG9wID0gZnVuY3Rpb24gKGVycm9yKSB7XG4gICAgLy8gV2hlbiB0aGUgc3Vic2NyaXB0aW9uIGlzIHN0b3BwZWQsIHJlbW92ZSBpdCBmcm9tIHRoZSBzZXQgb2YgdHJhY2tlZFxuICAgIC8vIHN1YnNjcmlwdGlvbnMgdG8gYXZvaWQgdGhpcyBsaXN0IGdyb3dpbmcgd2l0aG91dCBib3VuZFxuICAgIGRlbGV0ZSBzdWJIYW5kbGVzW3N1YkhhbmRsZS5zdWJzY3JpcHRpb25JZF07XG5cbiAgICAvLyBSZW1vdmluZyBhIHN1YnNjcmlwdGlvbiBjYW4gb25seSBjaGFuZ2UgdGhlIHJlc3VsdCBvZiBzdWJzY3JpcHRpb25zUmVhZHlcbiAgICAvLyBpZiB3ZSBhcmUgbm90IHJlYWR5ICh0aGF0IHN1YnNjcmlwdGlvbiBjb3VsZCBiZSB0aGUgb25lIGJsb2NraW5nIHVzIGJlaW5nXG4gICAgLy8gcmVhZHkpLlxuICAgIGlmICghIHNlbGYuX2FsbFN1YnNSZWFkeSkge1xuICAgICAgc2VsZi5fYWxsU3Vic1JlYWR5RGVwLmNoYW5nZWQoKTtcbiAgICB9XG5cbiAgICBpZiAob2xkU3RvcHBlZCkge1xuICAgICAgb2xkU3RvcHBlZChlcnJvcik7XG4gICAgfVxuICB9O1xuXG4gIHZhciBjb25uZWN0aW9uID0gb3B0aW9ucy5jb25uZWN0aW9uO1xuICB2YXIgY2FsbGJhY2tzID0gXy5waWNrKG9wdGlvbnMsIFtcIm9uUmVhZHlcIiwgXCJvbkVycm9yXCIsIFwib25TdG9wXCJdKTtcblxuICAvLyBUaGUgY2FsbGJhY2tzIGFyZSBwYXNzZWQgYXMgdGhlIGxhc3QgaXRlbSBpbiB0aGUgYXJndW1lbnRzIGFycmF5IHBhc3NlZCB0b1xuICAvLyBWaWV3I3N1YnNjcmliZVxuICBhcmdzLnB1c2goY2FsbGJhY2tzKTtcblxuICAvLyBWaWV3I3N1YnNjcmliZSB0YWtlcyB0aGUgY29ubmVjdGlvbiBhcyBvbmUgb2YgdGhlIG9wdGlvbnMgaW4gdGhlIGxhc3RcbiAgLy8gYXJndW1lbnRcbiAgc3ViSGFuZGxlID0gc2VsZi52aWV3LnN1YnNjcmliZS5jYWxsKHNlbGYudmlldywgYXJncywge1xuICAgIGNvbm5lY3Rpb246IGNvbm5lY3Rpb25cbiAgfSk7XG5cbiAgaWYgKCEgXy5oYXMoc3ViSGFuZGxlcywgc3ViSGFuZGxlLnN1YnNjcmlwdGlvbklkKSkge1xuICAgIHN1YkhhbmRsZXNbc3ViSGFuZGxlLnN1YnNjcmlwdGlvbklkXSA9IHN1YkhhbmRsZTtcblxuICAgIC8vIEFkZGluZyBhIG5ldyBzdWJzY3JpcHRpb24gd2lsbCBhbHdheXMgY2F1c2UgdXMgdG8gdHJhbnNpdGlvbiBmcm9tIHJlYWR5XG4gICAgLy8gdG8gbm90IHJlYWR5LCBidXQgaWYgd2UgYXJlIGFscmVhZHkgbm90IHJlYWR5IHRoZW4gdGhpcyBjYW4ndCBtYWtlIHVzXG4gICAgLy8gcmVhZHkuXG4gICAgaWYgKHNlbGYuX2FsbFN1YnNSZWFkeSkge1xuICAgICAgc2VsZi5fYWxsU3Vic1JlYWR5RGVwLmNoYW5nZWQoKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gc3ViSGFuZGxlO1xufTtcblxuLyoqXG4gKiBAc3VtbWFyeSBBIHJlYWN0aXZlIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyB0cnVlIHdoZW4gYWxsIG9mIHRoZSBzdWJzY3JpcHRpb25zXG4gKiBjYWxsZWQgd2l0aCBbdGhpcy5zdWJzY3JpYmVdKCNUZW1wbGF0ZUluc3RhbmNlLXN1YnNjcmliZSkgYXJlIHJlYWR5LlxuICogQHJldHVybiB7Qm9vbGVhbn0gVHJ1ZSBpZiBhbGwgc3Vic2NyaXB0aW9ucyBvbiB0aGlzIHRlbXBsYXRlIGluc3RhbmNlIGFyZVxuICogcmVhZHkuXG4gKi9cbkJsYXplLlRlbXBsYXRlSW5zdGFuY2UucHJvdG90eXBlLnN1YnNjcmlwdGlvbnNSZWFkeSA9IGZ1bmN0aW9uICgpIHtcbiAgdGhpcy5fYWxsU3Vic1JlYWR5RGVwLmRlcGVuZCgpO1xuXG4gIHRoaXMuX2FsbFN1YnNSZWFkeSA9IF8uYWxsKHRoaXMuX3N1YnNjcmlwdGlvbkhhbmRsZXMsIGZ1bmN0aW9uIChoYW5kbGUpIHtcbiAgICByZXR1cm4gaGFuZGxlLnJlYWR5KCk7XG4gIH0pO1xuXG4gIHJldHVybiB0aGlzLl9hbGxTdWJzUmVhZHk7XG59O1xuXG4vKipcbiAqIEBzdW1tYXJ5IFNwZWNpZnkgdGVtcGxhdGUgaGVscGVycyBhdmFpbGFibGUgdG8gdGhpcyB0ZW1wbGF0ZS5cbiAqIEBsb2N1cyBDbGllbnRcbiAqIEBwYXJhbSB7T2JqZWN0fSBoZWxwZXJzIERpY3Rpb25hcnkgb2YgaGVscGVyIGZ1bmN0aW9ucyBieSBuYW1lLlxuICogQGltcG9ydEZyb21QYWNrYWdlIHRlbXBsYXRpbmdcbiAqL1xuVGVtcGxhdGUucHJvdG90eXBlLmhlbHBlcnMgPSBmdW5jdGlvbiAoZGljdCkge1xuICBpZiAoISBfLmlzT2JqZWN0KGRpY3QpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiSGVscGVycyBkaWN0aW9uYXJ5IGhhcyB0byBiZSBhbiBvYmplY3RcIik7XG4gIH1cblxuICBmb3IgKHZhciBrIGluIGRpY3QpXG4gICAgdGhpcy5fX2hlbHBlcnMuc2V0KGssIGRpY3Rba10pO1xufTtcblxudmFyIGNhblVzZUdldHRlcnMgPSBmdW5jdGlvbigpIHtcbiAgaWYgKE9iamVjdC5kZWZpbmVQcm9wZXJ0eSkge1xuICAgIHZhciBvYmogPSB7fTtcbiAgICB0cnkge1xuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwgXCJzZWxmXCIsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7IHJldHVybiBvYmo7IH1cbiAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgcmV0dXJuIG9iai5zZWxmID09PSBvYmo7XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufSgpO1xuXG5pZiAoY2FuVXNlR2V0dGVycykge1xuICAvLyBMaWtlIEJsYXplLmN1cnJlbnRWaWV3IGJ1dCBmb3IgdGhlIHRlbXBsYXRlIGluc3RhbmNlLiBBIGZ1bmN0aW9uXG4gIC8vIHJhdGhlciB0aGFuIGEgdmFsdWUgc28gdGhhdCBub3QgYWxsIGhlbHBlcnMgYXJlIGltcGxpY2l0bHkgZGVwZW5kZW50XG4gIC8vIG9uIHRoZSBjdXJyZW50IHRlbXBsYXRlIGluc3RhbmNlJ3MgYGRhdGFgIHByb3BlcnR5LCB3aGljaCB3b3VsZCBtYWtlXG4gIC8vIHRoZW0gZGVwZW5kZW50IG9uIHRoZSBkYXRhIGNvbnRleHQgb2YgdGhlIHRlbXBsYXRlIGluY2x1c2lvbi5cbiAgdmFyIGN1cnJlbnRUZW1wbGF0ZUluc3RhbmNlRnVuYyA9IG51bGw7XG5cbiAgLy8gSWYgZ2V0dGVycyBhcmUgc3VwcG9ydGVkLCBkZWZpbmUgdGhpcyBwcm9wZXJ0eSB3aXRoIGEgZ2V0dGVyIGZ1bmN0aW9uXG4gIC8vIHRvIG1ha2UgaXQgZWZmZWN0aXZlbHkgcmVhZC1vbmx5LCBhbmQgdG8gd29yayBhcm91bmQgdGhpcyBiaXphcnJlIEpTQ1xuICAvLyBidWc6IGh0dHBzOi8vZ2l0aHViLmNvbS9tZXRlb3IvbWV0ZW9yL2lzc3Vlcy85OTI2XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShUZW1wbGF0ZSwgXCJfY3VycmVudFRlbXBsYXRlSW5zdGFuY2VGdW5jXCIsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiBjdXJyZW50VGVtcGxhdGVJbnN0YW5jZUZ1bmM7XG4gICAgfVxuICB9KTtcblxuICBUZW1wbGF0ZS5fd2l0aFRlbXBsYXRlSW5zdGFuY2VGdW5jID0gZnVuY3Rpb24gKHRlbXBsYXRlSW5zdGFuY2VGdW5jLCBmdW5jKSB7XG4gICAgaWYgKHR5cGVvZiBmdW5jICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJFeHBlY3RlZCBmdW5jdGlvbiwgZ290OiBcIiArIGZ1bmMpO1xuICAgIH1cbiAgICB2YXIgb2xkVG1wbEluc3RhbmNlRnVuYyA9IGN1cnJlbnRUZW1wbGF0ZUluc3RhbmNlRnVuYztcbiAgICB0cnkge1xuICAgICAgY3VycmVudFRlbXBsYXRlSW5zdGFuY2VGdW5jID0gdGVtcGxhdGVJbnN0YW5jZUZ1bmM7XG4gICAgICByZXR1cm4gZnVuYygpO1xuICAgIH0gZmluYWxseSB7XG4gICAgICBjdXJyZW50VGVtcGxhdGVJbnN0YW5jZUZ1bmMgPSBvbGRUbXBsSW5zdGFuY2VGdW5jO1xuICAgIH1cbiAgfTtcblxufSBlbHNlIHtcbiAgLy8gSWYgZ2V0dGVycyBhcmUgbm90IHN1cHBvcnRlZCwganVzdCB1c2UgYSBub3JtYWwgcHJvcGVydHkuXG4gIFRlbXBsYXRlLl9jdXJyZW50VGVtcGxhdGVJbnN0YW5jZUZ1bmMgPSBudWxsO1xuXG4gIFRlbXBsYXRlLl93aXRoVGVtcGxhdGVJbnN0YW5jZUZ1bmMgPSBmdW5jdGlvbiAodGVtcGxhdGVJbnN0YW5jZUZ1bmMsIGZ1bmMpIHtcbiAgICBpZiAodHlwZW9mIGZ1bmMgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkV4cGVjdGVkIGZ1bmN0aW9uLCBnb3Q6IFwiICsgZnVuYyk7XG4gICAgfVxuICAgIHZhciBvbGRUbXBsSW5zdGFuY2VGdW5jID0gVGVtcGxhdGUuX2N1cnJlbnRUZW1wbGF0ZUluc3RhbmNlRnVuYztcbiAgICB0cnkge1xuICAgICAgVGVtcGxhdGUuX2N1cnJlbnRUZW1wbGF0ZUluc3RhbmNlRnVuYyA9IHRlbXBsYXRlSW5zdGFuY2VGdW5jO1xuICAgICAgcmV0dXJuIGZ1bmMoKTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgVGVtcGxhdGUuX2N1cnJlbnRUZW1wbGF0ZUluc3RhbmNlRnVuYyA9IG9sZFRtcGxJbnN0YW5jZUZ1bmM7XG4gICAgfVxuICB9O1xufVxuXG4vKipcbiAqIEBzdW1tYXJ5IFNwZWNpZnkgZXZlbnQgaGFuZGxlcnMgZm9yIHRoaXMgdGVtcGxhdGUuXG4gKiBAbG9jdXMgQ2xpZW50XG4gKiBAcGFyYW0ge0V2ZW50TWFwfSBldmVudE1hcCBFdmVudCBoYW5kbGVycyB0byBhc3NvY2lhdGUgd2l0aCB0aGlzIHRlbXBsYXRlLlxuICogQGltcG9ydEZyb21QYWNrYWdlIHRlbXBsYXRpbmdcbiAqL1xuVGVtcGxhdGUucHJvdG90eXBlLmV2ZW50cyA9IGZ1bmN0aW9uIChldmVudE1hcCkge1xuICBpZiAoISBfLmlzT2JqZWN0KGV2ZW50TWFwKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIkV2ZW50IG1hcCBoYXMgdG8gYmUgYW4gb2JqZWN0XCIpO1xuICB9XG5cbiAgdmFyIHRlbXBsYXRlID0gdGhpcztcbiAgdmFyIGV2ZW50TWFwMiA9IHt9O1xuICBmb3IgKHZhciBrIGluIGV2ZW50TWFwKSB7XG4gICAgZXZlbnRNYXAyW2tdID0gKGZ1bmN0aW9uIChrLCB2KSB7XG4gICAgICByZXR1cm4gZnVuY3Rpb24gKGV2ZW50LyosIC4uLiovKSB7XG4gICAgICAgIHZhciB2aWV3ID0gdGhpczsgLy8gcGFzc2VkIGJ5IEV2ZW50QXVnbWVudGVyXG4gICAgICAgIHZhciBkYXRhID0gQmxhemUuZ2V0RGF0YShldmVudC5jdXJyZW50VGFyZ2V0KTtcbiAgICAgICAgaWYgKGRhdGEgPT0gbnVsbClcbiAgICAgICAgICBkYXRhID0ge307XG4gICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgICAgICAgdmFyIHRtcGxJbnN0YW5jZUZ1bmMgPSBCbGF6ZS5fYmluZCh2aWV3LnRlbXBsYXRlSW5zdGFuY2UsIHZpZXcpO1xuICAgICAgICBhcmdzLnNwbGljZSgxLCAwLCB0bXBsSW5zdGFuY2VGdW5jKCkpO1xuXG4gICAgICAgIHJldHVybiBUZW1wbGF0ZS5fd2l0aFRlbXBsYXRlSW5zdGFuY2VGdW5jKHRtcGxJbnN0YW5jZUZ1bmMsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICByZXR1cm4gdi5hcHBseShkYXRhLCBhcmdzKTtcbiAgICAgICAgfSk7XG4gICAgICB9O1xuICAgIH0pKGssIGV2ZW50TWFwW2tdKTtcbiAgfVxuXG4gIHRlbXBsYXRlLl9fZXZlbnRNYXBzLnB1c2goZXZlbnRNYXAyKTtcbn07XG5cbi8qKlxuICogQGZ1bmN0aW9uXG4gKiBAbmFtZSBpbnN0YW5jZVxuICogQG1lbWJlck9mIFRlbXBsYXRlXG4gKiBAc3VtbWFyeSBUaGUgW3RlbXBsYXRlIGluc3RhbmNlXSgjVGVtcGxhdGUtaW5zdGFuY2VzKSBjb3JyZXNwb25kaW5nIHRvIHRoZSBjdXJyZW50IHRlbXBsYXRlIGhlbHBlciwgZXZlbnQgaGFuZGxlciwgY2FsbGJhY2ssIG9yIGF1dG9ydW4uICBJZiB0aGVyZSBpc24ndCBvbmUsIGBudWxsYC5cbiAqIEBsb2N1cyBDbGllbnRcbiAqIEByZXR1cm5zIHtCbGF6ZS5UZW1wbGF0ZUluc3RhbmNlfVxuICogQGltcG9ydEZyb21QYWNrYWdlIHRlbXBsYXRpbmdcbiAqL1xuVGVtcGxhdGUuaW5zdGFuY2UgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiBUZW1wbGF0ZS5fY3VycmVudFRlbXBsYXRlSW5zdGFuY2VGdW5jXG4gICAgJiYgVGVtcGxhdGUuX2N1cnJlbnRUZW1wbGF0ZUluc3RhbmNlRnVuYygpO1xufTtcblxuLy8gTm90ZTogVGVtcGxhdGUuY3VycmVudERhdGEoKSBpcyBkb2N1bWVudGVkIHRvIHRha2UgemVybyBhcmd1bWVudHMsXG4vLyB3aGlsZSBCbGF6ZS5nZXREYXRhIHRha2VzIHVwIHRvIG9uZS5cblxuLyoqXG4gKiBAc3VtbWFyeVxuICpcbiAqIC0gSW5zaWRlIGFuIGBvbkNyZWF0ZWRgLCBgb25SZW5kZXJlZGAsIG9yIGBvbkRlc3Ryb3llZGAgY2FsbGJhY2ssIHJldHVybnNcbiAqIHRoZSBkYXRhIGNvbnRleHQgb2YgdGhlIHRlbXBsYXRlLlxuICogLSBJbnNpZGUgYW4gZXZlbnQgaGFuZGxlciwgcmV0dXJucyB0aGUgZGF0YSBjb250ZXh0IG9mIHRoZSB0ZW1wbGF0ZSBvbiB3aGljaFxuICogdGhpcyBldmVudCBoYW5kbGVyIHdhcyBkZWZpbmVkLlxuICogLSBJbnNpZGUgYSBoZWxwZXIsIHJldHVybnMgdGhlIGRhdGEgY29udGV4dCBvZiB0aGUgRE9NIG5vZGUgd2hlcmUgdGhlIGhlbHBlclxuICogd2FzIHVzZWQuXG4gKlxuICogRXN0YWJsaXNoZXMgYSByZWFjdGl2ZSBkZXBlbmRlbmN5IG9uIHRoZSByZXN1bHQuXG4gKiBAbG9jdXMgQ2xpZW50XG4gKiBAZnVuY3Rpb25cbiAqIEBpbXBvcnRGcm9tUGFja2FnZSB0ZW1wbGF0aW5nXG4gKi9cblRlbXBsYXRlLmN1cnJlbnREYXRhID0gQmxhemUuZ2V0RGF0YTtcblxuLyoqXG4gKiBAc3VtbWFyeSBBY2Nlc3NlcyBvdGhlciBkYXRhIGNvbnRleHRzIHRoYXQgZW5jbG9zZSB0aGUgY3VycmVudCBkYXRhIGNvbnRleHQuXG4gKiBAbG9jdXMgQ2xpZW50XG4gKiBAZnVuY3Rpb25cbiAqIEBwYXJhbSB7SW50ZWdlcn0gW251bUxldmVsc10gVGhlIG51bWJlciBvZiBsZXZlbHMgYmV5b25kIHRoZSBjdXJyZW50IGRhdGEgY29udGV4dCB0byBsb29rLiBEZWZhdWx0cyB0byAxLlxuICogQGltcG9ydEZyb21QYWNrYWdlIHRlbXBsYXRpbmdcbiAqL1xuVGVtcGxhdGUucGFyZW50RGF0YSA9IEJsYXplLl9wYXJlbnREYXRhO1xuXG4vKipcbiAqIEBzdW1tYXJ5IERlZmluZXMgYSBbaGVscGVyIGZ1bmN0aW9uXSgjVGVtcGxhdGUtaGVscGVycykgd2hpY2ggY2FuIGJlIHVzZWQgZnJvbSBhbGwgdGVtcGxhdGVzLlxuICogQGxvY3VzIENsaWVudFxuICogQGZ1bmN0aW9uXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZSBUaGUgbmFtZSBvZiB0aGUgaGVscGVyIGZ1bmN0aW9uIHlvdSBhcmUgZGVmaW5pbmcuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmdW5jdGlvbiBUaGUgaGVscGVyIGZ1bmN0aW9uIGl0c2VsZi5cbiAqIEBpbXBvcnRGcm9tUGFja2FnZSB0ZW1wbGF0aW5nXG4gKi9cblRlbXBsYXRlLnJlZ2lzdGVySGVscGVyID0gQmxhemUucmVnaXN0ZXJIZWxwZXI7XG5cbi8qKlxuICogQHN1bW1hcnkgUmVtb3ZlcyBhIGdsb2JhbCBbaGVscGVyIGZ1bmN0aW9uXSgjVGVtcGxhdGUtaGVscGVycykuXG4gKiBAbG9jdXMgQ2xpZW50XG4gKiBAZnVuY3Rpb25cbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIFRoZSBuYW1lIG9mIHRoZSBoZWxwZXIgZnVuY3Rpb24geW91IGFyZSBkZWZpbmluZy5cbiAqIEBpbXBvcnRGcm9tUGFja2FnZSB0ZW1wbGF0aW5nXG4gKi9cblRlbXBsYXRlLmRlcmVnaXN0ZXJIZWxwZXIgPSBCbGF6ZS5kZXJlZ2lzdGVySGVscGVyO1xuIiwiVUkgPSBCbGF6ZTtcblxuQmxhemUuUmVhY3RpdmVWYXIgPSBSZWFjdGl2ZVZhcjtcblVJLl90ZW1wbGF0ZUluc3RhbmNlID0gQmxhemUuVGVtcGxhdGUuaW5zdGFuY2U7XG5cbkhhbmRsZWJhcnMgPSB7fTtcbkhhbmRsZWJhcnMucmVnaXN0ZXJIZWxwZXIgPSBCbGF6ZS5yZWdpc3RlckhlbHBlcjtcblxuSGFuZGxlYmFycy5fZXNjYXBlID0gQmxhemUuX2VzY2FwZTtcblxuLy8gUmV0dXJuIHRoZXNlIGZyb20ge3suLi59fSBoZWxwZXJzIHRvIGFjaGlldmUgdGhlIHNhbWUgYXMgcmV0dXJuaW5nXG4vLyBzdHJpbmdzIGZyb20ge3t7Li4ufX19IGhlbHBlcnNcbkhhbmRsZWJhcnMuU2FmZVN0cmluZyA9IGZ1bmN0aW9uKHN0cmluZykge1xuICB0aGlzLnN0cmluZyA9IHN0cmluZztcbn07XG5IYW5kbGViYXJzLlNhZmVTdHJpbmcucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB0aGlzLnN0cmluZy50b1N0cmluZygpO1xufTtcbiJdfQ==
