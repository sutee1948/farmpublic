(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var Tracker = Package.tracker.Tracker;
var Deps = Package.tracker.Deps;
var check = Package.check.check;
var Match = Package.check.Match;
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
  Blaze._bind = function (objA, objB) {
    objA.bind(objB);
  };
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
  var index = destroyed.lastIndexOf(cb);

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

Blaze.__rootViews = [];
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
  var view = contentAsView(content); // TODO: this is only needed in development

  if (!parentView) {
    view.onViewCreated(function () {
      Blaze.__rootViews.push(view);
    });
    view.onViewDestroyed(function () {
      var index = Blaze.__rootViews.indexOf(view);

      if (index > -1) {
        Blaze.__rootViews.splice(index, 1);
      }
    });
  }

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
    Object.keys(eventMap).forEach(function (spec) {
      let handler = eventMap[spec];
      var clauses = spec.split(/,\s+/); // iterate over clauses of spec, e.g. ['click .foo', 'click .bar']

      clauses.forEach(function (clause) {
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
    handles.forEach(function (h) {
      h.stop();
    });
    handles.length = 0;
  });
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"builtins.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/blaze/builtins.js                                                                                          //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let has;
module.link("lodash.has", {
  default(v) {
    has = v;
  }

}, 0);
let isObject;
module.link("lodash.isobject", {
  default(v) {
    isObject = v;
  }

}, 1);

Blaze._calculateCondition = function (cond) {
  if (HTML.isArray(cond) && cond.length === 0) cond = false;
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
    Object.entries(bindings).forEach(function (_ref) {
      let [name, binding] = _ref;
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

      if (isObject(arg) && has(arg, '_sequence')) {
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

},"lookup.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/blaze/lookup.js                                                                                            //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let has;
module.link("lodash.has", {
  default(v) {
    has = v;
  }

}, 0);
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
    if (has(currentView._scopeBindings, name)) {
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

},"template.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/blaze/template.js                                                                                          //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
let isObject;
module.link("lodash.isobject", {
  default(v) {
    isObject = v;
  }

}, 0);
let isFunction;
module.link("lodash.isfunction", {
  default(v) {
    isFunction = v;
  }

}, 1);
let has;
module.link("lodash.has", {
  default(v) {
    has = v;
  }

}, 2);
let isEmpty;
module.link("lodash.isempty", {
  default(v) {
    isEmpty = v;
  }

}, 3);

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

      self.__eventMaps.forEach(function (m) {
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


Blaze.TemplateInstance.prototype.subscribe = function () {
  var self = this;
  var subHandles = self._subscriptionHandles; // Duplicate logic from Meteor.subscribe

  var options = {};

  for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
    args[_key] = arguments[_key];
  }

  if (args.length) {
    var lastParam = args[args.length - 1]; // Match pattern to check if the last arg is an options argument

    var lastParamOptionsPattern = {
      onReady: Match.Optional(Function),
      // XXX COMPAT WITH 1.0.3.1 onError used to exist, but now we use
      // onStop with an error callback instead.
      onError: Match.Optional(Function),
      onStop: Match.Optional(Function),
      connection: Match.Optional(Match.Any)
    };

    if (isFunction(lastParam)) {
      options.onReady = args.pop();
    } else if (lastParam && !isEmpty(lastParam) && Match.test(lastParam, lastParamOptionsPattern)) {
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
  const {
    onReady,
    onError,
    onStop
  } = options;
  var callbacks = {
    onReady,
    onError,
    onStop
  }; // The callbacks are passed as the last item in the arguments array passed to
  // View#subscribe

  args.push(callbacks); // View#subscribe takes the connection as one of the options in the last
  // argument

  subHandle = self.view.subscribe.call(self.view, args, {
    connection: connection
  });

  if (!has(subHandles, subHandle.subscriptionId)) {
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

  this._allSubsReady = Object.values(this._subscriptionHandles).every(handle => {
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
  if (!isObject(dict)) {
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
  if (!isObject(eventMap)) {
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

},"node_modules":{"lodash.has":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/blaze/node_modules/lodash.has/package.json                                                      //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.exports = {
  "name": "lodash.has",
  "version": "4.5.2"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/blaze/node_modules/lodash.has/index.js                                                          //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"lodash.isobject":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/blaze/node_modules/lodash.isobject/package.json                                                 //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.exports = {
  "name": "lodash.isobject",
  "version": "3.0.2"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/blaze/node_modules/lodash.isobject/index.js                                                     //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"lodash.isfunction":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/blaze/node_modules/lodash.isfunction/package.json                                               //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.exports = {
  "name": "lodash.isfunction",
  "version": "3.0.9"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/blaze/node_modules/lodash.isfunction/index.js                                                   //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"lodash.isempty":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/blaze/node_modules/lodash.isempty/package.json                                                  //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.exports = {
  "name": "lodash.isempty",
  "version": "4.4.0"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/blaze/node_modules/lodash.isempty/index.js                                                      //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}}},{
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvYmxhemUvcHJlYW1ibGUuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL2JsYXplL2V4Y2VwdGlvbnMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL2JsYXplL3ZpZXcuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL2JsYXplL2J1aWx0aW5zLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9ibGF6ZS9sb29rdXAuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL2JsYXplL3RlbXBsYXRlLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9ibGF6ZS9iYWNrY29tcGF0LmpzIl0sIm5hbWVzIjpbIkJsYXplIiwiX2VzY2FwZSIsImVzY2FwZV9tYXAiLCJlc2NhcGVfb25lIiwiYyIsIngiLCJyZXBsYWNlIiwiX3dhcm4iLCJtc2ciLCJjb25zb2xlIiwid2FybiIsIm5hdGl2ZUJpbmQiLCJGdW5jdGlvbiIsInByb3RvdHlwZSIsImJpbmQiLCJfYmluZCIsImZ1bmMiLCJvYmoiLCJhcmd1bWVudHMiLCJsZW5ndGgiLCJjYWxsIiwiYXJncyIsIkFycmF5IiwiaSIsImFwcGx5Iiwic2xpY2UiLCJvYmpBIiwib2JqQiIsImRlYnVnRnVuYyIsIl90aHJvd05leHRFeGNlcHRpb24iLCJfcmVwb3J0RXhjZXB0aW9uIiwiZSIsIk1ldGVvciIsIl9kZWJ1ZyIsImxvZyIsInN0YWNrIiwibWVzc2FnZSIsIl93cmFwQ2F0Y2hpbmdFeGNlcHRpb25zIiwiZiIsIndoZXJlIiwiVmlldyIsIm5hbWUiLCJyZW5kZXIiLCJfcmVuZGVyIiwiX2NhbGxiYWNrcyIsImNyZWF0ZWQiLCJyZW5kZXJlZCIsImRlc3Ryb3llZCIsImlzQ3JlYXRlZCIsIl9pc0NyZWF0ZWRGb3JFeHBhbnNpb24iLCJpc1JlbmRlcmVkIiwiX2lzQXR0YWNoZWQiLCJpc0Rlc3Ryb3llZCIsIl9pc0luUmVuZGVyIiwicGFyZW50VmlldyIsIl9kb21yYW5nZSIsIl9oYXNHZW5lcmF0ZWRQYXJlbnQiLCJfc2NvcGVCaW5kaW5ncyIsInJlbmRlckNvdW50Iiwib25WaWV3Q3JlYXRlZCIsImNiIiwicHVzaCIsIl9vblZpZXdSZW5kZXJlZCIsIm9uVmlld1JlYWR5Iiwic2VsZiIsImZpcmUiLCJUcmFja2VyIiwiYWZ0ZXJGbHVzaCIsIl93aXRoQ3VycmVudFZpZXciLCJvblZpZXdSZW5kZXJlZCIsImF0dGFjaGVkIiwib25BdHRhY2hlZCIsIm9uVmlld0Rlc3Ryb3llZCIsInJlbW92ZVZpZXdEZXN0cm95ZWRMaXN0ZW5lciIsImluZGV4IiwibGFzdEluZGV4T2YiLCJhdXRvcnVuIiwiX2luVmlld1Njb3BlIiwiZGlzcGxheU5hbWUiLCJFcnJvciIsInRlbXBsYXRlSW5zdGFuY2VGdW5jIiwiVGVtcGxhdGUiLCJfY3VycmVudFRlbXBsYXRlSW5zdGFuY2VGdW5jIiwidmlld0F1dG9ydW4iLCJfd2l0aFRlbXBsYXRlSW5zdGFuY2VGdW5jIiwiY29tcCIsInN0b3BDb21wdXRhdGlvbiIsInN0b3AiLCJvblN0b3AiLCJfZXJyb3JJZlNob3VsZG50Q2FsbFN1YnNjcmliZSIsInN1YnNjcmliZSIsIm9wdGlvbnMiLCJzdWJIYW5kbGUiLCJjb25uZWN0aW9uIiwiZmlyc3ROb2RlIiwibGFzdE5vZGUiLCJfZmlyZUNhbGxiYWNrcyIsInZpZXciLCJ3aGljaCIsIm5vbnJlYWN0aXZlIiwiZmlyZUNhbGxiYWNrcyIsImNicyIsIk4iLCJfY3JlYXRlVmlldyIsImZvckV4cGFuc2lvbiIsImRvRmlyc3RSZW5kZXIiLCJpbml0aWFsQ29udGVudCIsImRvbXJhbmdlIiwiX0RPTVJhbmdlIiwidGVhcmRvd25Ib29rIiwicmFuZ2UiLCJlbGVtZW50IiwiX0RPTUJhY2tlbmQiLCJUZWFyZG93biIsIm9uRWxlbWVudFRlYXJkb3duIiwidGVhcmRvd24iLCJfZGVzdHJveVZpZXciLCJfbWF0ZXJpYWxpemVWaWV3IiwiX3dvcmtTdGFjayIsIl9pbnRvQXJyYXkiLCJsYXN0SHRtbGpzIiwiZG9SZW5kZXIiLCJodG1sanMiLCJmaXJzdFJ1biIsIl9pc0NvbnRlbnRFcXVhbCIsImRvTWF0ZXJpYWxpemUiLCJyYW5nZXNBbmROb2RlcyIsIl9tYXRlcmlhbGl6ZURPTSIsInNldE1lbWJlcnMiLCJvbkludmFsaWRhdGUiLCJkZXN0cm95TWVtYmVycyIsInVuZGVmaW5lZCIsImluaXRpYWxDb250ZW50cyIsIl9leHBhbmRWaWV3IiwicmVzdWx0IiwiX2V4cGFuZCIsImFjdGl2ZSIsIl9IVE1MSlNFeHBhbmRlciIsIkhUTUwiLCJUcmFuc2Zvcm1pbmdWaXNpdG9yIiwiZXh0ZW5kIiwiZGVmIiwidmlzaXRPYmplY3QiLCJjb25zdHJ1Y3RWaWV3IiwidmlzaXRBdHRyaWJ1dGVzIiwiYXR0cnMiLCJ2aXNpdEF0dHJpYnV0ZSIsInZhbHVlIiwidGFnIiwiY3VycmVudFZpZXdJZlJlbmRlcmluZyIsImN1cnJlbnRWaWV3IiwidmlzaXQiLCJfZXhwYW5kQXR0cmlidXRlcyIsIl9za2lwTm9kZXMiLCJfZGVzdHJveU5vZGUiLCJub2RlIiwibm9kZVR5cGUiLCJ0ZWFyRG93bkVsZW1lbnQiLCJhIiwiYiIsIlJhdyIsIm9sZFZpZXciLCJjaGVja1JlbmRlckNvbnRlbnQiLCJjb250ZW50IiwiVmlzaXRvciIsImNvbnRlbnRBc1ZpZXciLCJjb250ZW50QXNGdW5jIiwiX19yb290Vmlld3MiLCJwYXJlbnRFbGVtZW50IiwibmV4dE5vZGUiLCJpbmRleE9mIiwic3BsaWNlIiwiYXR0YWNoIiwiaW5zZXJ0IiwicmVuZGVyV2l0aERhdGEiLCJkYXRhIiwiX1RlbXBsYXRlV2l0aCIsInJlbW92ZSIsInBhcmVudFJhbmdlIiwiZGV0YWNoIiwiZGVzdHJveSIsInRvSFRNTCIsInRvSFRNTFdpdGhEYXRhIiwiX3RvVGV4dCIsInRleHRNb2RlIiwiVEVYVE1PREUiLCJTVFJJTkciLCJSQ0RBVEEiLCJBVFRSSUJVVEUiLCJ0b1RleHQiLCJnZXREYXRhIiwiZWxlbWVudE9yVmlldyIsInRoZVdpdGgiLCJnZXRWaWV3IiwiZGF0YVZhciIsImdldCIsImdldEVsZW1lbnREYXRhIiwiX3ZpZXdOYW1lIiwidmlld05hbWUiLCJfZ2V0Q3VycmVudFZpZXciLCJfZ2V0UGFyZW50VmlldyIsIl9nZXRFbGVtZW50VmlldyIsInYiLCJlbGVtIiwiZm9yRWxlbWVudCIsIl9hZGRFdmVudE1hcCIsImV2ZW50TWFwIiwidGhpc0luSGFuZGxlciIsImhhbmRsZXMiLCJhdHRhY2hlZF9ldmVudE1hcHMiLCJPYmplY3QiLCJrZXlzIiwiZm9yRWFjaCIsInNwZWMiLCJoYW5kbGVyIiwiY2xhdXNlcyIsInNwbGl0IiwiY2xhdXNlIiwicGFydHMiLCJuZXdFdmVudHMiLCJzaGlmdCIsInNlbGVjdG9yIiwiam9pbiIsIl9FdmVudFN1cHBvcnQiLCJsaXN0ZW4iLCJldnQiLCJjb250YWluc0VsZW1lbnQiLCJjdXJyZW50VGFyZ2V0IiwiaGFuZGxlclRoaXMiLCJoYW5kbGVyQXJncyIsInIiLCJoIiwiaGFzIiwibW9kdWxlIiwibGluayIsImRlZmF1bHQiLCJpc09iamVjdCIsIl9jYWxjdWxhdGVDb25kaXRpb24iLCJjb25kIiwiaXNBcnJheSIsIldpdGgiLCJjb250ZW50RnVuYyIsIlJlYWN0aXZlVmFyIiwic2V0IiwiX2F0dGFjaEJpbmRpbmdzVG9WaWV3IiwiYmluZGluZ3MiLCJlbnRyaWVzIiwiYmluZGluZyIsIkxldCIsIklmIiwiY29uZGl0aW9uRnVuYyIsImVsc2VGdW5jIiwiX25vdCIsImNvbmRpdGlvblZhciIsIl9fY29uZGl0aW9uVmFyIiwiVW5sZXNzIiwiRWFjaCIsImFyZ0Z1bmMiLCJlYWNoVmlldyIsInN1YnZpZXdzIiwiaW5pdGlhbFN1YnZpZXdzIiwiZXhwYW5kZWRWYWx1ZURlcCIsIkRlcGVuZGVuY3kiLCJkZXBlbmQiLCJudW1JdGVtcyIsImluRWxzZU1vZGUiLCJzdG9wSGFuZGxlIiwiYXJnVmFyIiwidmFyaWFibGVOYW1lIiwidXBkYXRlSW5kaWNlcyIsImZyb20iLCJ0byIsIm1lbWJlcnMiLCJhcmciLCJfdmFyaWFibGUiLCJfc2VxdWVuY2UiLCJPYnNlcnZlU2VxdWVuY2UiLCJvYnNlcnZlIiwiYWRkZWRBdCIsImlkIiwiaXRlbSIsIm5ld0l0ZW1WaWV3IiwiY2hhbmdlZCIsInJlbW92ZU1lbWJlciIsImFkZE1lbWJlciIsInJlbW92ZWRBdCIsImNoYW5nZWRBdCIsIm5ld0l0ZW0iLCJvbGRJdGVtIiwiaXRlbVZpZXciLCJnZXRNZW1iZXIiLCJtb3ZlZFRvIiwiZnJvbUluZGV4IiwidG9JbmRleCIsIm1vdmVNZW1iZXIiLCJNYXRoIiwibWluIiwibWF4IiwidyIsIndyYXBwZWRBcmdGdW5jIiwidmlld1RvRXZhbHVhdGVBcmciLCJvcmlnaW5hbFBhcmVudFZpZXciLCJ3cmFwcGVkQ29udGVudEZ1bmMiLCJfX2lzVGVtcGxhdGVXaXRoIiwiX0luT3V0ZXJUZW1wbGF0ZVNjb3BlIiwidGVtcGxhdGVWaWV3IiwiX19jaGlsZERvZXNudFN0YXJ0TmV3TGV4aWNhbFNjb3BlIiwiSW5PdXRlclRlbXBsYXRlU2NvcGUiLCJfZ2xvYmFsSGVscGVycyIsInJlZ2lzdGVySGVscGVyIiwiZGVyZWdpc3RlckhlbHBlciIsImJpbmRJZklzRnVuY3Rpb24iLCJ0YXJnZXQiLCJiaW5kRGF0YUNvbnRleHQiLCJfT0xEU1RZTEVfSEVMUEVSIiwiX2dldFRlbXBsYXRlSGVscGVyIiwidGVtcGxhdGUiLCJ0bXBsSW5zdGFuY2VGdW5jIiwiaXNLbm93bk9sZFN0eWxlSGVscGVyIiwiX19oZWxwZXJzIiwiaGVscGVyIiwid3JhcEhlbHBlciIsIl9OT1dBUk5fT0xEU1RZTEVfSEVMUEVSUyIsInRlbXBsYXRlRnVuYyIsIl9sZXhpY2FsQmluZGluZ0xvb2t1cCIsImJsb2NrSGVscGVyc1N0YWNrIiwiYmluZGluZ1JlYWN0aXZlVmFyIiwiX19zdGFydHNOZXdMZXhpY2FsU2NvcGUiLCJfZ2V0VGVtcGxhdGUiLCJ0ZW1wbGF0ZUluc3RhbmNlIiwiX2dldEdsb2JhbEhlbHBlciIsImxvb2t1cCIsIl9vcHRpb25zIiwibG9va3VwVGVtcGxhdGUiLCJib3VuZFRtcGxJbnN0YW5jZSIsImZvdW5kVGVtcGxhdGUiLCJ0ZXN0IiwiX3BhcmVudERhdGEiLCJpc0NhbGxlZEFzRnVuY3Rpb24iLCJjaGFyQXQiLCJoZWlnaHQiLCJfZnVuY3Rpb25XcmFwcGVkIiwiaXNGdW5jdGlvbiIsImlzRW1wdHkiLCJyZW5kZXJGdW5jdGlvbiIsIkhlbHBlck1hcCIsIl9fZXZlbnRNYXBzIiwiaXNUZW1wbGF0ZSIsInQiLCJvbkNyZWF0ZWQiLCJvblJlbmRlcmVkIiwib25EZXN0cm95ZWQiLCJfZ2V0Q2FsbGJhY2tzIiwiY2FsbGJhY2tzIiwiY29uY2F0IiwidGVtcGxhdGVDb250ZW50QmxvY2siLCJ0ZW1wbGF0ZUVsc2VCbG9jayIsImV2ZW50cyIsIm0iLCJfdGVtcGxhdGVJbnN0YW5jZSIsIlRlbXBsYXRlSW5zdGFuY2UiLCJpbnN0IiwiY3JlYXRlZENhbGxiYWNrcyIsInJlbmRlcmVkQ2FsbGJhY2tzIiwiZGVzdHJveWVkQ2FsbGJhY2tzIiwiX2FsbFN1YnNSZWFkeURlcCIsIl9hbGxTdWJzUmVhZHkiLCJfc3Vic2NyaXB0aW9uSGFuZGxlcyIsIiQiLCJmaW5kQWxsIiwiZmluZCIsInN1YkhhbmRsZXMiLCJsYXN0UGFyYW0iLCJsYXN0UGFyYW1PcHRpb25zUGF0dGVybiIsIm9uUmVhZHkiLCJNYXRjaCIsIk9wdGlvbmFsIiwib25FcnJvciIsIkFueSIsInBvcCIsIm9sZFN0b3BwZWQiLCJlcnJvciIsInN1YnNjcmlwdGlvbklkIiwic3Vic2NyaXB0aW9uc1JlYWR5IiwidmFsdWVzIiwiZXZlcnkiLCJoYW5kbGUiLCJyZWFkeSIsImhlbHBlcnMiLCJkaWN0IiwiayIsImNhblVzZUdldHRlcnMiLCJkZWZpbmVQcm9wZXJ0eSIsImN1cnJlbnRUZW1wbGF0ZUluc3RhbmNlRnVuYyIsIm9sZFRtcGxJbnN0YW5jZUZ1bmMiLCJldmVudE1hcDIiLCJldmVudCIsImluc3RhbmNlIiwiY3VycmVudERhdGEiLCJwYXJlbnREYXRhIiwiVUkiLCJIYW5kbGViYXJz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QUFLLENBQUNrUCxXQUFOLEdBQW9CQSxXQUFwQjtBQUNBOEosRUFBRSxDQUFDekMsaUJBQUgsR0FBdUJ2VyxLQUFLLENBQUNpRixRQUFOLENBQWU0VCxRQUF0QztBQUVBSSxVQUFVLEdBQUcsRUFBYjtBQUNBQSxVQUFVLENBQUM1RixjQUFYLEdBQTRCclQsS0FBSyxDQUFDcVQsY0FBbEM7QUFFQTRGLFVBQVUsQ0FBQ2haLE9BQVgsR0FBcUJELEtBQUssQ0FBQ0MsT0FBM0IsQyxDQUVBO0FBQ0E7O0FBQ0FnWixVQUFVLENBQUNDLFVBQVgsR0FBd0IsVUFBU0MsTUFBVCxFQUFpQjtBQUN2QyxPQUFLQSxNQUFMLEdBQWNBLE1BQWQ7QUFDRCxDQUZEOztBQUdBRixVQUFVLENBQUNDLFVBQVgsQ0FBc0JyWSxTQUF0QixDQUFnQ3VZLFFBQWhDLEdBQTJDLFlBQVc7QUFDcEQsU0FBTyxLQUFLRCxNQUFMLENBQVlDLFFBQVosRUFBUDtBQUNELENBRkQsQyIsImZpbGUiOiIvcGFja2FnZXMvYmxhemUuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBuYW1lc3BhY2UgQmxhemVcbiAqIEBzdW1tYXJ5IFRoZSBuYW1lc3BhY2UgZm9yIGFsbCBCbGF6ZS1yZWxhdGVkIG1ldGhvZHMgYW5kIGNsYXNzZXMuXG4gKi9cbkJsYXplID0ge307XG5cbi8vIFV0aWxpdHkgdG8gSFRNTC1lc2NhcGUgYSBzdHJpbmcuICBJbmNsdWRlZCBmb3IgbGVnYWN5IHJlYXNvbnMuXG4vLyBUT0RPOiBTaG91bGQgYmUgcmVwbGFjZWQgd2l0aCBfLmVzY2FwZSBvbmNlIHVuZGVyc2NvcmUgaXMgdXBncmFkZWQgdG8gYSBuZXdlclxuLy8gICAgICAgdmVyc2lvbiB3aGljaCBlc2NhcGVzIGAgKGJhY2t0aWNrKSBhcyB3ZWxsLiBVbmRlcnNjb3JlIDEuNS4yIGRvZXMgbm90LlxuQmxhemUuX2VzY2FwZSA9IChmdW5jdGlvbigpIHtcbiAgdmFyIGVzY2FwZV9tYXAgPSB7XG4gICAgXCI8XCI6IFwiJmx0O1wiLFxuICAgIFwiPlwiOiBcIiZndDtcIixcbiAgICAnXCInOiBcIiZxdW90O1wiLFxuICAgIFwiJ1wiOiBcIiYjeDI3O1wiLFxuICAgIFwiL1wiOiBcIiYjeDJGO1wiLFxuICAgIFwiYFwiOiBcIiYjeDYwO1wiLCAvKiBJRSBhbGxvd3MgYmFja3RpY2stZGVsaW1pdGVkIGF0dHJpYnV0ZXM/PyAqL1xuICAgIFwiJlwiOiBcIiZhbXA7XCJcbiAgfTtcbiAgdmFyIGVzY2FwZV9vbmUgPSBmdW5jdGlvbihjKSB7XG4gICAgcmV0dXJuIGVzY2FwZV9tYXBbY107XG4gIH07XG5cbiAgcmV0dXJuIGZ1bmN0aW9uICh4KSB7XG4gICAgcmV0dXJuIHgucmVwbGFjZSgvWyY8PlwiJ2BdL2csIGVzY2FwZV9vbmUpO1xuICB9O1xufSkoKTtcblxuQmxhemUuX3dhcm4gPSBmdW5jdGlvbiAobXNnKSB7XG4gIG1zZyA9ICdXYXJuaW5nOiAnICsgbXNnO1xuXG4gIGlmICgodHlwZW9mIGNvbnNvbGUgIT09ICd1bmRlZmluZWQnKSAmJiBjb25zb2xlLndhcm4pIHtcbiAgICBjb25zb2xlLndhcm4obXNnKTtcbiAgfVxufTtcblxudmFyIG5hdGl2ZUJpbmQgPSBGdW5jdGlvbi5wcm90b3R5cGUuYmluZDtcblxuLy8gQW4gaW1wbGVtZW50YXRpb24gb2YgXy5iaW5kIHdoaWNoIGFsbG93cyBiZXR0ZXIgb3B0aW1pemF0aW9uLlxuLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vcGV0a2FhbnRvbm92L2JsdWViaXJkL3dpa2kvT3B0aW1pemF0aW9uLWtpbGxlcnMjMy1tYW5hZ2luZy1hcmd1bWVudHNcbmlmIChuYXRpdmVCaW5kKSB7XG4gIEJsYXplLl9iaW5kID0gZnVuY3Rpb24gKGZ1bmMsIG9iaikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAyKSB7XG4gICAgICByZXR1cm4gbmF0aXZlQmluZC5jYWxsKGZ1bmMsIG9iaik7XG4gICAgfVxuXG4gICAgLy8gQ29weSB0aGUgYXJndW1lbnRzIHNvIHRoaXMgZnVuY3Rpb24gY2FuIGJlIG9wdGltaXplZC5cbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyZ3MubGVuZ3RoOyBpKyspIHtcbiAgICAgIGFyZ3NbaV0gPSBhcmd1bWVudHNbaV07XG4gICAgfVxuXG4gICAgcmV0dXJuIG5hdGl2ZUJpbmQuYXBwbHkoZnVuYywgYXJncy5zbGljZSgxKSk7XG4gIH07XG59XG5lbHNlIHtcbiAgLy8gQSBzbG93ZXIgYnV0IGJhY2t3YXJkcyBjb21wYXRpYmxlIHZlcnNpb24uXG4gIEJsYXplLl9iaW5kID0gZnVuY3Rpb24ob2JqQSwgb2JqQikge1xuICAgIG9iakEuYmluZChvYmpCKTtcbiAgfTtcbn1cbiIsInZhciBkZWJ1Z0Z1bmM7XG5cbi8vIFdlIGNhbGwgaW50byB1c2VyIGNvZGUgaW4gbWFueSBwbGFjZXMsIGFuZCBpdCdzIG5pY2UgdG8gY2F0Y2ggZXhjZXB0aW9uc1xuLy8gcHJvcGFnYXRlZCBmcm9tIHVzZXIgY29kZSBpbW1lZGlhdGVseSBzbyB0aGF0IHRoZSB3aG9sZSBzeXN0ZW0gZG9lc24ndCBqdXN0XG4vLyBicmVhay4gIENhdGNoaW5nIGV4Y2VwdGlvbnMgaXMgZWFzeTsgcmVwb3J0aW5nIHRoZW0gaXMgaGFyZC4gIFRoaXMgaGVscGVyXG4vLyByZXBvcnRzIGV4Y2VwdGlvbnMuXG4vL1xuLy8gVXNhZ2U6XG4vL1xuLy8gYGBgXG4vLyB0cnkge1xuLy8gICAvLyAuLi4gc29tZVN0dWZmIC4uLlxuLy8gfSBjYXRjaCAoZSkge1xuLy8gICByZXBvcnRVSUV4Y2VwdGlvbihlKTtcbi8vIH1cbi8vIGBgYFxuLy9cbi8vIEFuIG9wdGlvbmFsIHNlY29uZCBhcmd1bWVudCBvdmVycmlkZXMgdGhlIGRlZmF1bHQgbWVzc2FnZS5cblxuLy8gU2V0IHRoaXMgdG8gYHRydWVgIHRvIGNhdXNlIGByZXBvcnRFeGNlcHRpb25gIHRvIHRocm93XG4vLyB0aGUgbmV4dCBleGNlcHRpb24gcmF0aGVyIHRoYW4gcmVwb3J0aW5nIGl0LiAgVGhpcyBpc1xuLy8gdXNlZnVsIGluIHVuaXQgdGVzdHMgdGhhdCB0ZXN0IGVycm9yIG1lc3NhZ2VzLlxuQmxhemUuX3Rocm93TmV4dEV4Y2VwdGlvbiA9IGZhbHNlO1xuXG5CbGF6ZS5fcmVwb3J0RXhjZXB0aW9uID0gZnVuY3Rpb24gKGUsIG1zZykge1xuICBpZiAoQmxhemUuX3Rocm93TmV4dEV4Y2VwdGlvbikge1xuICAgIEJsYXplLl90aHJvd05leHRFeGNlcHRpb24gPSBmYWxzZTtcbiAgICB0aHJvdyBlO1xuICB9XG5cbiAgaWYgKCEgZGVidWdGdW5jKVxuICAgIC8vIGFkYXB0ZWQgZnJvbSBUcmFja2VyXG4gICAgZGVidWdGdW5jID0gZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuICh0eXBlb2YgTWV0ZW9yICE9PSBcInVuZGVmaW5lZFwiID8gTWV0ZW9yLl9kZWJ1ZyA6XG4gICAgICAgICAgICAgICgodHlwZW9mIGNvbnNvbGUgIT09IFwidW5kZWZpbmVkXCIpICYmIGNvbnNvbGUubG9nID8gY29uc29sZS5sb2cgOlxuICAgICAgICAgICAgICAgZnVuY3Rpb24gKCkge30pKTtcbiAgICB9O1xuXG4gIC8vIEluIENocm9tZSwgYGUuc3RhY2tgIGlzIGEgbXVsdGlsaW5lIHN0cmluZyB0aGF0IHN0YXJ0cyB3aXRoIHRoZSBtZXNzYWdlXG4gIC8vIGFuZCBjb250YWlucyBhIHN0YWNrIHRyYWNlLiAgRnVydGhlcm1vcmUsIGBjb25zb2xlLmxvZ2AgbWFrZXMgaXQgY2xpY2thYmxlLlxuICAvLyBgY29uc29sZS5sb2dgIHN1cHBsaWVzIHRoZSBzcGFjZSBiZXR3ZWVuIHRoZSB0d28gYXJndW1lbnRzLlxuICBkZWJ1Z0Z1bmMoKShtc2cgfHwgJ0V4Y2VwdGlvbiBjYXVnaHQgaW4gdGVtcGxhdGU6JywgZS5zdGFjayB8fCBlLm1lc3NhZ2UgfHwgZSk7XG59O1xuXG5CbGF6ZS5fd3JhcENhdGNoaW5nRXhjZXB0aW9ucyA9IGZ1bmN0aW9uIChmLCB3aGVyZSkge1xuICBpZiAodHlwZW9mIGYgIT09ICdmdW5jdGlvbicpXG4gICAgcmV0dXJuIGY7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIGYuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBCbGF6ZS5fcmVwb3J0RXhjZXB0aW9uKGUsICdFeGNlcHRpb24gaW4gJyArIHdoZXJlICsgJzonKTtcbiAgICB9XG4gIH07XG59O1xuIiwiLy8vIFtuZXddIEJsYXplLlZpZXcoW25hbWVdLCByZW5kZXJNZXRob2QpXG4vLy9cbi8vLyBCbGF6ZS5WaWV3IGlzIHRoZSBidWlsZGluZyBibG9jayBvZiByZWFjdGl2ZSBET00uICBWaWV3cyBoYXZlXG4vLy8gdGhlIGZvbGxvd2luZyBmZWF0dXJlczpcbi8vL1xuLy8vICogbGlmZWN5Y2xlIGNhbGxiYWNrcyAtIFZpZXdzIGFyZSBjcmVhdGVkLCByZW5kZXJlZCwgYW5kIGRlc3Ryb3llZCxcbi8vLyAgIGFuZCBjYWxsYmFja3MgY2FuIGJlIHJlZ2lzdGVyZWQgdG8gZmlyZSB3aGVuIHRoZXNlIHRoaW5ncyBoYXBwZW4uXG4vLy9cbi8vLyAqIHBhcmVudCBwb2ludGVyIC0gQSBWaWV3IHBvaW50cyB0byBpdHMgcGFyZW50Vmlldywgd2hpY2ggaXMgdGhlXG4vLy8gICBWaWV3IHRoYXQgY2F1c2VkIGl0IHRvIGJlIHJlbmRlcmVkLiAgVGhlc2UgcG9pbnRlcnMgZm9ybSBhXG4vLy8gICBoaWVyYXJjaHkgb3IgdHJlZSBvZiBWaWV3cy5cbi8vL1xuLy8vICogcmVuZGVyKCkgbWV0aG9kIC0gQSBWaWV3J3MgcmVuZGVyKCkgbWV0aG9kIHNwZWNpZmllcyB0aGUgRE9NXG4vLy8gICAob3IgSFRNTCkgY29udGVudCBvZiB0aGUgVmlldy4gIElmIHRoZSBtZXRob2QgZXN0YWJsaXNoZXNcbi8vLyAgIHJlYWN0aXZlIGRlcGVuZGVuY2llcywgaXQgbWF5IGJlIHJlLXJ1bi5cbi8vL1xuLy8vICogYSBET01SYW5nZSAtIElmIGEgVmlldyBpcyByZW5kZXJlZCB0byBET00sIGl0cyBwb3NpdGlvbiBhbmRcbi8vLyAgIGV4dGVudCBpbiB0aGUgRE9NIGFyZSB0cmFja2VkIHVzaW5nIGEgRE9NUmFuZ2Ugb2JqZWN0LlxuLy8vXG4vLy8gV2hlbiBhIFZpZXcgaXMgY29uc3RydWN0ZWQgYnkgY2FsbGluZyBCbGF6ZS5WaWV3LCB0aGUgVmlldyBpc1xuLy8vIG5vdCB5ZXQgY29uc2lkZXJlZCBcImNyZWF0ZWQuXCIgIEl0IGRvZXNuJ3QgaGF2ZSBhIHBhcmVudFZpZXcgeWV0LFxuLy8vIGFuZCBubyBsb2dpYyBoYXMgYmVlbiBydW4gdG8gaW5pdGlhbGl6ZSB0aGUgVmlldy4gIEFsbCByZWFsXG4vLy8gd29yayBpcyBkZWZlcnJlZCB1bnRpbCBhdCBsZWFzdCBjcmVhdGlvbiB0aW1lLCB3aGVuIHRoZSBvblZpZXdDcmVhdGVkXG4vLy8gY2FsbGJhY2tzIGFyZSBmaXJlZCwgd2hpY2ggaGFwcGVucyB3aGVuIHRoZSBWaWV3IGlzIFwidXNlZFwiIGluXG4vLy8gc29tZSB3YXkgdGhhdCByZXF1aXJlcyBpdCB0byBiZSByZW5kZXJlZC5cbi8vL1xuLy8vIC4uLm1vcmUgbGlmZWN5Y2xlIHN0dWZmXG4vLy9cbi8vLyBgbmFtZWAgaXMgYW4gb3B0aW9uYWwgc3RyaW5nIHRhZyBpZGVudGlmeWluZyB0aGUgVmlldy4gIFRoZSBvbmx5XG4vLy8gdGltZSBpdCdzIHVzZWQgaXMgd2hlbiBsb29raW5nIGluIHRoZSBWaWV3IHRyZWUgZm9yIGEgVmlldyBvZiBhXG4vLy8gcGFydGljdWxhciBuYW1lOyBmb3IgZXhhbXBsZSwgZGF0YSBjb250ZXh0cyBhcmUgc3RvcmVkIG9uIFZpZXdzXG4vLy8gb2YgbmFtZSBcIndpdGhcIi4gIE5hbWVzIGFyZSBhbHNvIHVzZWZ1bCB3aGVuIGRlYnVnZ2luZywgc28gaW5cbi8vLyBnZW5lcmFsIGl0J3MgZ29vZCBmb3IgZnVuY3Rpb25zIHRoYXQgY3JlYXRlIFZpZXdzIHRvIHNldCB0aGUgbmFtZS5cbi8vLyBWaWV3cyBhc3NvY2lhdGVkIHdpdGggdGVtcGxhdGVzIGhhdmUgbmFtZXMgb2YgdGhlIGZvcm0gXCJUZW1wbGF0ZS5mb29cIi5cblxuLyoqXG4gKiBAY2xhc3NcbiAqIEBzdW1tYXJ5IENvbnN0cnVjdG9yIGZvciBhIFZpZXcsIHdoaWNoIHJlcHJlc2VudHMgYSByZWFjdGl2ZSByZWdpb24gb2YgRE9NLlxuICogQGxvY3VzIENsaWVudFxuICogQHBhcmFtIHtTdHJpbmd9IFtuYW1lXSBPcHRpb25hbC4gIEEgbmFtZSBmb3IgdGhpcyB0eXBlIG9mIFZpZXcuICBTZWUgW2B2aWV3Lm5hbWVgXSgjdmlld19uYW1lKS5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IHJlbmRlckZ1bmN0aW9uIEEgZnVuY3Rpb24gdGhhdCByZXR1cm5zIFsqcmVuZGVyYWJsZSBjb250ZW50Kl0oI1JlbmRlcmFibGUtQ29udGVudCkuICBJbiB0aGlzIGZ1bmN0aW9uLCBgdGhpc2AgaXMgYm91bmQgdG8gdGhlIFZpZXcuXG4gKi9cbkJsYXplLlZpZXcgPSBmdW5jdGlvbiAobmFtZSwgcmVuZGVyKSB7XG4gIGlmICghICh0aGlzIGluc3RhbmNlb2YgQmxhemUuVmlldykpXG4gICAgLy8gY2FsbGVkIHdpdGhvdXQgYG5ld2BcbiAgICByZXR1cm4gbmV3IEJsYXplLlZpZXcobmFtZSwgcmVuZGVyKTtcblxuICBpZiAodHlwZW9mIG5hbWUgPT09ICdmdW5jdGlvbicpIHtcbiAgICAvLyBvbWl0dGVkIFwibmFtZVwiIGFyZ3VtZW50XG4gICAgcmVuZGVyID0gbmFtZTtcbiAgICBuYW1lID0gJyc7XG4gIH1cbiAgdGhpcy5uYW1lID0gbmFtZTtcbiAgdGhpcy5fcmVuZGVyID0gcmVuZGVyO1xuXG4gIHRoaXMuX2NhbGxiYWNrcyA9IHtcbiAgICBjcmVhdGVkOiBudWxsLFxuICAgIHJlbmRlcmVkOiBudWxsLFxuICAgIGRlc3Ryb3llZDogbnVsbFxuICB9O1xuXG4gIC8vIFNldHRpbmcgYWxsIHByb3BlcnRpZXMgaGVyZSBpcyBnb29kIGZvciByZWFkYWJpbGl0eSxcbiAgLy8gYW5kIGFsc28gbWF5IGhlbHAgQ2hyb21lIG9wdGltaXplIHRoZSBjb2RlIGJ5IGtlZXBpbmdcbiAgLy8gdGhlIFZpZXcgb2JqZWN0IGZyb20gY2hhbmdpbmcgc2hhcGUgdG9vIG11Y2guXG4gIHRoaXMuaXNDcmVhdGVkID0gZmFsc2U7XG4gIHRoaXMuX2lzQ3JlYXRlZEZvckV4cGFuc2lvbiA9IGZhbHNlO1xuICB0aGlzLmlzUmVuZGVyZWQgPSBmYWxzZTtcbiAgdGhpcy5faXNBdHRhY2hlZCA9IGZhbHNlO1xuICB0aGlzLmlzRGVzdHJveWVkID0gZmFsc2U7XG4gIHRoaXMuX2lzSW5SZW5kZXIgPSBmYWxzZTtcbiAgdGhpcy5wYXJlbnRWaWV3ID0gbnVsbDtcbiAgdGhpcy5fZG9tcmFuZ2UgPSBudWxsO1xuICAvLyBUaGlzIGZsYWcgaXMgbm9ybWFsbHkgc2V0IHRvIGZhbHNlIGV4Y2VwdCBmb3IgdGhlIGNhc2VzIHdoZW4gdmlldydzIHBhcmVudFxuICAvLyB3YXMgZ2VuZXJhdGVkIGFzIHBhcnQgb2YgZXhwYW5kaW5nIHNvbWUgc3ludGFjdGljIHN1Z2FyIGV4cHJlc3Npb25zIG9yXG4gIC8vIG1ldGhvZHMuXG4gIC8vIEV4LjogQmxhemUucmVuZGVyV2l0aERhdGEgaXMgYW4gZXF1aXZhbGVudCB0byBjcmVhdGluZyBhIHZpZXcgd2l0aCByZWd1bGFyXG4gIC8vIEJsYXplLnJlbmRlciBhbmQgd3JhcHBpbmcgaXQgaW50byB7eyN3aXRoIGRhdGF9fXt7L3dpdGh9fSB2aWV3LiBTaW5jZSB0aGVcbiAgLy8gdXNlcnMgZG9uJ3Qga25vdyBhbnl0aGluZyBhYm91dCB0aGVzZSBnZW5lcmF0ZWQgcGFyZW50IHZpZXdzLCBCbGF6ZSBuZWVkc1xuICAvLyB0aGlzIGluZm9ybWF0aW9uIHRvIGJlIGF2YWlsYWJsZSBvbiB2aWV3cyB0byBtYWtlIHNtYXJ0ZXIgZGVjaXNpb25zLiBGb3JcbiAgLy8gZXhhbXBsZTogcmVtb3ZpbmcgdGhlIGdlbmVyYXRlZCBwYXJlbnQgdmlldyB3aXRoIHRoZSB2aWV3IG9uIEJsYXplLnJlbW92ZS5cbiAgdGhpcy5faGFzR2VuZXJhdGVkUGFyZW50ID0gZmFsc2U7XG4gIC8vIEJpbmRpbmdzIGFjY2Vzc2libGUgdG8gY2hpbGRyZW4gdmlld3MgKHZpYSB2aWV3Lmxvb2t1cCgnbmFtZScpKSB3aXRoaW4gdGhlXG4gIC8vIGNsb3Nlc3QgdGVtcGxhdGUgdmlldy5cbiAgdGhpcy5fc2NvcGVCaW5kaW5ncyA9IHt9O1xuXG4gIHRoaXMucmVuZGVyQ291bnQgPSAwO1xufTtcblxuQmxhemUuVmlldy5wcm90b3R5cGUuX3JlbmRlciA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIG51bGw7IH07XG5cbkJsYXplLlZpZXcucHJvdG90eXBlLm9uVmlld0NyZWF0ZWQgPSBmdW5jdGlvbiAoY2IpIHtcbiAgdGhpcy5fY2FsbGJhY2tzLmNyZWF0ZWQgPSB0aGlzLl9jYWxsYmFja3MuY3JlYXRlZCB8fCBbXTtcbiAgdGhpcy5fY2FsbGJhY2tzLmNyZWF0ZWQucHVzaChjYik7XG59O1xuXG5CbGF6ZS5WaWV3LnByb3RvdHlwZS5fb25WaWV3UmVuZGVyZWQgPSBmdW5jdGlvbiAoY2IpIHtcbiAgdGhpcy5fY2FsbGJhY2tzLnJlbmRlcmVkID0gdGhpcy5fY2FsbGJhY2tzLnJlbmRlcmVkIHx8IFtdO1xuICB0aGlzLl9jYWxsYmFja3MucmVuZGVyZWQucHVzaChjYik7XG59O1xuXG5CbGF6ZS5WaWV3LnByb3RvdHlwZS5vblZpZXdSZWFkeSA9IGZ1bmN0aW9uIChjYikge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHZhciBmaXJlID0gZnVuY3Rpb24gKCkge1xuICAgIFRyYWNrZXIuYWZ0ZXJGbHVzaChmdW5jdGlvbiAoKSB7XG4gICAgICBpZiAoISBzZWxmLmlzRGVzdHJveWVkKSB7XG4gICAgICAgIEJsYXplLl93aXRoQ3VycmVudFZpZXcoc2VsZiwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgIGNiLmNhbGwoc2VsZik7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pO1xuICB9O1xuICBzZWxmLl9vblZpZXdSZW5kZXJlZChmdW5jdGlvbiBvblZpZXdSZW5kZXJlZCgpIHtcbiAgICBpZiAoc2VsZi5pc0Rlc3Ryb3llZClcbiAgICAgIHJldHVybjtcbiAgICBpZiAoISBzZWxmLl9kb21yYW5nZS5hdHRhY2hlZClcbiAgICAgIHNlbGYuX2RvbXJhbmdlLm9uQXR0YWNoZWQoZmlyZSk7XG4gICAgZWxzZVxuICAgICAgZmlyZSgpO1xuICB9KTtcbn07XG5cbkJsYXplLlZpZXcucHJvdG90eXBlLm9uVmlld0Rlc3Ryb3llZCA9IGZ1bmN0aW9uIChjYikge1xuICB0aGlzLl9jYWxsYmFja3MuZGVzdHJveWVkID0gdGhpcy5fY2FsbGJhY2tzLmRlc3Ryb3llZCB8fCBbXTtcbiAgdGhpcy5fY2FsbGJhY2tzLmRlc3Ryb3llZC5wdXNoKGNiKTtcbn07XG5CbGF6ZS5WaWV3LnByb3RvdHlwZS5yZW1vdmVWaWV3RGVzdHJveWVkTGlzdGVuZXIgPSBmdW5jdGlvbiAoY2IpIHtcbiAgdmFyIGRlc3Ryb3llZCA9IHRoaXMuX2NhbGxiYWNrcy5kZXN0cm95ZWQ7XG4gIGlmICghIGRlc3Ryb3llZClcbiAgICByZXR1cm47XG4gIHZhciBpbmRleCA9IGRlc3Ryb3llZC5sYXN0SW5kZXhPZihjYik7XG4gIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAvLyBYWFggWW91J2QgdGhpbmsgdGhlIHJpZ2h0IHRoaW5nIHRvIGRvIHdvdWxkIGJlIHNwbGljZSwgYnV0IF9maXJlQ2FsbGJhY2tzXG4gICAgLy8gZ2V0cyBzYWQgaWYgeW91IHJlbW92ZSBjYWxsYmFja3Mgd2hpbGUgaXRlcmF0aW5nIG92ZXIgdGhlIGxpc3QuICBTaG91bGRcbiAgICAvLyBjaGFuZ2UgdGhpcyB0byB1c2UgY2FsbGJhY2staG9vayBvciBFdmVudEVtaXR0ZXIgb3Igc29tZXRoaW5nIGVsc2UgdGhhdFxuICAgIC8vIHByb3Blcmx5IHN1cHBvcnRzIHJlbW92YWwuXG4gICAgZGVzdHJveWVkW2luZGV4XSA9IG51bGw7XG4gIH1cbn07XG5cbi8vLyBWaWV3I2F1dG9ydW4oZnVuYylcbi8vL1xuLy8vIFNldHMgdXAgYSBUcmFja2VyIGF1dG9ydW4gdGhhdCBpcyBcInNjb3BlZFwiIHRvIHRoaXMgVmlldyBpbiB0d29cbi8vLyBpbXBvcnRhbnQgd2F5czogMSkgQmxhemUuY3VycmVudFZpZXcgaXMgYXV0b21hdGljYWxseSBzZXRcbi8vLyBvbiBldmVyeSByZS1ydW4sIGFuZCAyKSB0aGUgYXV0b3J1biBpcyBzdG9wcGVkIHdoZW4gdGhlXG4vLy8gVmlldyBpcyBkZXN0cm95ZWQuICBBcyB3aXRoIFRyYWNrZXIuYXV0b3J1biwgdGhlIGZpcnN0IHJ1biBvZlxuLy8vIHRoZSBmdW5jdGlvbiBpcyBpbW1lZGlhdGUsIGFuZCBhIENvbXB1dGF0aW9uIG9iamVjdCB0aGF0IGNhblxuLy8vIGJlIHVzZWQgdG8gc3RvcCB0aGUgYXV0b3J1biBpcyByZXR1cm5lZC5cbi8vL1xuLy8vIFZpZXcjYXV0b3J1biBpcyBtZWFudCB0byBiZSBjYWxsZWQgZnJvbSBWaWV3IGNhbGxiYWNrcyBsaWtlXG4vLy8gb25WaWV3Q3JlYXRlZCwgb3IgZnJvbSBvdXRzaWRlIHRoZSByZW5kZXJpbmcgcHJvY2Vzcy4gIEl0IG1heSBub3Rcbi8vLyBiZSBjYWxsZWQgYmVmb3JlIHRoZSBvblZpZXdDcmVhdGVkIGNhbGxiYWNrcyBhcmUgZmlyZWQgKHRvbyBlYXJseSksXG4vLy8gb3IgZnJvbSBhIHJlbmRlcigpIG1ldGhvZCAodG9vIGNvbmZ1c2luZykuXG4vLy9cbi8vLyBUeXBpY2FsbHksIGF1dG9ydW5zIHRoYXQgdXBkYXRlIHRoZSBzdGF0ZVxuLy8vIG9mIHRoZSBWaWV3IChhcyBpbiBCbGF6ZS5XaXRoKSBzaG91bGQgYmUgc3RhcnRlZCBmcm9tIGFuIG9uVmlld0NyZWF0ZWRcbi8vLyBjYWxsYmFjay4gIEF1dG9ydW5zIHRoYXQgdXBkYXRlIHRoZSBET00gc2hvdWxkIGJlIHN0YXJ0ZWRcbi8vLyBmcm9tIGVpdGhlciBvblZpZXdDcmVhdGVkIChndWFyZGVkIGFnYWluc3QgdGhlIGFic2VuY2Ugb2Zcbi8vLyB2aWV3Ll9kb21yYW5nZSksIG9yIG9uVmlld1JlYWR5LlxuQmxhemUuVmlldy5wcm90b3R5cGUuYXV0b3J1biA9IGZ1bmN0aW9uIChmLCBfaW5WaWV3U2NvcGUsIGRpc3BsYXlOYW1lKSB7XG4gIHZhciBzZWxmID0gdGhpcztcblxuICAvLyBUaGUgcmVzdHJpY3Rpb25zIG9uIHdoZW4gVmlldyNhdXRvcnVuIGNhbiBiZSBjYWxsZWQgYXJlIGluIG9yZGVyXG4gIC8vIHRvIGF2b2lkIGJhZCBwYXR0ZXJucywgbGlrZSBjcmVhdGluZyBhIEJsYXplLlZpZXcgYW5kIGltbWVkaWF0ZWx5XG4gIC8vIGNhbGxpbmcgYXV0b3J1biBvbiBpdC4gIEEgZnJlc2hseSBjcmVhdGVkIFZpZXcgaXMgbm90IHJlYWR5IHRvXG4gIC8vIGhhdmUgbG9naWMgcnVuIG9uIGl0OyBpdCBkb2Vzbid0IGhhdmUgYSBwYXJlbnRWaWV3LCBmb3IgZXhhbXBsZS5cbiAgLy8gSXQncyB3aGVuIHRoZSBWaWV3IGlzIG1hdGVyaWFsaXplZCBvciBleHBhbmRlZCB0aGF0IHRoZSBvblZpZXdDcmVhdGVkXG4gIC8vIGhhbmRsZXJzIGFyZSBmaXJlZCBhbmQgdGhlIFZpZXcgc3RhcnRzIHVwLlxuICAvL1xuICAvLyBMZXR0aW5nIHRoZSByZW5kZXIoKSBtZXRob2QgY2FsbCBgdGhpcy5hdXRvcnVuKClgIGlzIHByb2JsZW1hdGljXG4gIC8vIGJlY2F1c2Ugb2YgcmUtcmVuZGVyLiAgVGhlIGJlc3Qgd2UgY2FuIGRvIGlzIHRvIHN0b3AgdGhlIG9sZFxuICAvLyBhdXRvcnVuIGFuZCBzdGFydCBhIG5ldyBvbmUgZm9yIGVhY2ggcmVuZGVyLCBidXQgdGhhdCdzIGEgcGF0dGVyblxuICAvLyB3ZSB0cnkgdG8gYXZvaWQgaW50ZXJuYWxseSBiZWNhdXNlIGl0IGxlYWRzIHRvIGhlbHBlcnMgYmVpbmdcbiAgLy8gY2FsbGVkIGV4dHJhIHRpbWVzLCBpbiB0aGUgY2FzZSB3aGVyZSB0aGUgYXV0b3J1biBjYXVzZXMgdGhlXG4gIC8vIHZpZXcgdG8gcmUtcmVuZGVyIChhbmQgdGh1cyB0aGUgYXV0b3J1biB0byBiZSB0b3JuIGRvd24gYW5kIGFcbiAgLy8gbmV3IG9uZSBlc3RhYmxpc2hlZCkuXG4gIC8vXG4gIC8vIFdlIGNvdWxkIGxpZnQgdGhlc2UgcmVzdHJpY3Rpb25zIGluIHZhcmlvdXMgd2F5cy4gIE9uZSBpbnRlcmVzdGluZ1xuICAvLyBpZGVhIGlzIHRvIGFsbG93IHlvdSB0byBjYWxsIGB2aWV3LmF1dG9ydW5gIGFmdGVyIGluc3RhbnRpYXRpbmdcbiAgLy8gYHZpZXdgLCBhbmQgYXV0b21hdGljYWxseSB3cmFwIGl0IGluIGB2aWV3Lm9uVmlld0NyZWF0ZWRgLCBkZWZlcnJpbmdcbiAgLy8gdGhlIGF1dG9ydW4gc28gdGhhdCBpdCBzdGFydHMgYXQgYW4gYXBwcm9wcmlhdGUgdGltZS4gIEhvd2V2ZXIsXG4gIC8vIHRoZW4gd2UgY2FuJ3QgcmV0dXJuIHRoZSBDb21wdXRhdGlvbiBvYmplY3QgdG8gdGhlIGNhbGxlciwgYmVjYXVzZVxuICAvLyBpdCBkb2Vzbid0IGV4aXN0IHlldC5cbiAgaWYgKCEgc2VsZi5pc0NyZWF0ZWQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJWaWV3I2F1dG9ydW4gbXVzdCBiZSBjYWxsZWQgZnJvbSB0aGUgY3JlYXRlZCBjYWxsYmFjayBhdCB0aGUgZWFybGllc3RcIik7XG4gIH1cbiAgaWYgKHRoaXMuX2lzSW5SZW5kZXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW4ndCBjYWxsIFZpZXcjYXV0b3J1biBmcm9tIGluc2lkZSByZW5kZXIoKTsgdHJ5IGNhbGxpbmcgaXQgZnJvbSB0aGUgY3JlYXRlZCBvciByZW5kZXJlZCBjYWxsYmFja1wiKTtcbiAgfVxuXG4gIHZhciB0ZW1wbGF0ZUluc3RhbmNlRnVuYyA9IEJsYXplLlRlbXBsYXRlLl9jdXJyZW50VGVtcGxhdGVJbnN0YW5jZUZ1bmM7XG5cbiAgdmFyIGZ1bmMgPSBmdW5jdGlvbiB2aWV3QXV0b3J1bihjKSB7XG4gICAgcmV0dXJuIEJsYXplLl93aXRoQ3VycmVudFZpZXcoX2luVmlld1Njb3BlIHx8IHNlbGYsIGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiBCbGF6ZS5UZW1wbGF0ZS5fd2l0aFRlbXBsYXRlSW5zdGFuY2VGdW5jKFxuICAgICAgICB0ZW1wbGF0ZUluc3RhbmNlRnVuYywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgIHJldHVybiBmLmNhbGwoc2VsZiwgYyk7XG4gICAgICAgIH0pO1xuICAgIH0pO1xuICB9O1xuXG4gIC8vIEdpdmUgdGhlIGF1dG9ydW4gZnVuY3Rpb24gYSBiZXR0ZXIgbmFtZSBmb3IgZGVidWdnaW5nIGFuZCBwcm9maWxpbmcuXG4gIC8vIFRoZSBgZGlzcGxheU5hbWVgIHByb3BlcnR5IGlzIG5vdCBwYXJ0IG9mIHRoZSBzcGVjIGJ1dCBicm93c2VycyBsaWtlIENocm9tZVxuICAvLyBhbmQgRmlyZWZveCBwcmVmZXIgaXQgaW4gZGVidWdnZXJzIG92ZXIgdGhlIG5hbWUgZnVuY3Rpb24gd2FzIGRlY2xhcmVkIGJ5LlxuICBmdW5jLmRpc3BsYXlOYW1lID1cbiAgICAoc2VsZi5uYW1lIHx8ICdhbm9ueW1vdXMnKSArICc6JyArIChkaXNwbGF5TmFtZSB8fCAnYW5vbnltb3VzJyk7XG4gIHZhciBjb21wID0gVHJhY2tlci5hdXRvcnVuKGZ1bmMpO1xuXG4gIHZhciBzdG9wQ29tcHV0YXRpb24gPSBmdW5jdGlvbiAoKSB7IGNvbXAuc3RvcCgpOyB9O1xuICBzZWxmLm9uVmlld0Rlc3Ryb3llZChzdG9wQ29tcHV0YXRpb24pO1xuICBjb21wLm9uU3RvcChmdW5jdGlvbiAoKSB7XG4gICAgc2VsZi5yZW1vdmVWaWV3RGVzdHJveWVkTGlzdGVuZXIoc3RvcENvbXB1dGF0aW9uKTtcbiAgfSk7XG5cbiAgcmV0dXJuIGNvbXA7XG59O1xuXG5CbGF6ZS5WaWV3LnByb3RvdHlwZS5fZXJyb3JJZlNob3VsZG50Q2FsbFN1YnNjcmliZSA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIGlmICghIHNlbGYuaXNDcmVhdGVkKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiVmlldyNzdWJzY3JpYmUgbXVzdCBiZSBjYWxsZWQgZnJvbSB0aGUgY3JlYXRlZCBjYWxsYmFjayBhdCB0aGUgZWFybGllc3RcIik7XG4gIH1cbiAgaWYgKHNlbGYuX2lzSW5SZW5kZXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW4ndCBjYWxsIFZpZXcjc3Vic2NyaWJlIGZyb20gaW5zaWRlIHJlbmRlcigpOyB0cnkgY2FsbGluZyBpdCBmcm9tIHRoZSBjcmVhdGVkIG9yIHJlbmRlcmVkIGNhbGxiYWNrXCIpO1xuICB9XG4gIGlmIChzZWxmLmlzRGVzdHJveWVkKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiQ2FuJ3QgY2FsbCBWaWV3I3N1YnNjcmliZSBmcm9tIGluc2lkZSB0aGUgZGVzdHJveWVkIGNhbGxiYWNrLCB0cnkgY2FsbGluZyBpdCBpbnNpZGUgY3JlYXRlZCBvciByZW5kZXJlZC5cIik7XG4gIH1cbn07XG5cbi8qKlxuICogSnVzdCBsaWtlIEJsYXplLlZpZXcjYXV0b3J1biwgYnV0IHdpdGggTWV0ZW9yLnN1YnNjcmliZSBpbnN0ZWFkIG9mXG4gKiBUcmFja2VyLmF1dG9ydW4uIFN0b3AgdGhlIHN1YnNjcmlwdGlvbiB3aGVuIHRoZSB2aWV3IGlzIGRlc3Ryb3llZC5cbiAqIEByZXR1cm4ge1N1YnNjcmlwdGlvbkhhbmRsZX0gQSBoYW5kbGUgdG8gdGhlIHN1YnNjcmlwdGlvbiBzbyB0aGF0IHlvdSBjYW5cbiAqIHNlZSBpZiBpdCBpcyByZWFkeSwgb3Igc3RvcCBpdCBtYW51YWxseVxuICovXG5CbGF6ZS5WaWV3LnByb3RvdHlwZS5zdWJzY3JpYmUgPSBmdW5jdGlvbiAoYXJncywgb3B0aW9ucykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG4gIHNlbGYuX2Vycm9ySWZTaG91bGRudENhbGxTdWJzY3JpYmUoKTtcblxuICB2YXIgc3ViSGFuZGxlO1xuICBpZiAob3B0aW9ucy5jb25uZWN0aW9uKSB7XG4gICAgc3ViSGFuZGxlID0gb3B0aW9ucy5jb25uZWN0aW9uLnN1YnNjcmliZS5hcHBseShvcHRpb25zLmNvbm5lY3Rpb24sIGFyZ3MpO1xuICB9IGVsc2Uge1xuICAgIHN1YkhhbmRsZSA9IE1ldGVvci5zdWJzY3JpYmUuYXBwbHkoTWV0ZW9yLCBhcmdzKTtcbiAgfVxuXG4gIHNlbGYub25WaWV3RGVzdHJveWVkKGZ1bmN0aW9uICgpIHtcbiAgICBzdWJIYW5kbGUuc3RvcCgpO1xuICB9KTtcblxuICByZXR1cm4gc3ViSGFuZGxlO1xufTtcblxuQmxhemUuVmlldy5wcm90b3R5cGUuZmlyc3ROb2RlID0gZnVuY3Rpb24gKCkge1xuICBpZiAoISB0aGlzLl9pc0F0dGFjaGVkKVxuICAgIHRocm93IG5ldyBFcnJvcihcIlZpZXcgbXVzdCBiZSBhdHRhY2hlZCBiZWZvcmUgYWNjZXNzaW5nIGl0cyBET01cIik7XG5cbiAgcmV0dXJuIHRoaXMuX2RvbXJhbmdlLmZpcnN0Tm9kZSgpO1xufTtcblxuQmxhemUuVmlldy5wcm90b3R5cGUubGFzdE5vZGUgPSBmdW5jdGlvbiAoKSB7XG4gIGlmICghIHRoaXMuX2lzQXR0YWNoZWQpXG4gICAgdGhyb3cgbmV3IEVycm9yKFwiVmlldyBtdXN0IGJlIGF0dGFjaGVkIGJlZm9yZSBhY2Nlc3NpbmcgaXRzIERPTVwiKTtcblxuICByZXR1cm4gdGhpcy5fZG9tcmFuZ2UubGFzdE5vZGUoKTtcbn07XG5cbkJsYXplLl9maXJlQ2FsbGJhY2tzID0gZnVuY3Rpb24gKHZpZXcsIHdoaWNoKSB7XG4gIEJsYXplLl93aXRoQ3VycmVudFZpZXcodmlldywgZnVuY3Rpb24gKCkge1xuICAgIFRyYWNrZXIubm9ucmVhY3RpdmUoZnVuY3Rpb24gZmlyZUNhbGxiYWNrcygpIHtcbiAgICAgIHZhciBjYnMgPSB2aWV3Ll9jYWxsYmFja3Nbd2hpY2hdO1xuICAgICAgZm9yICh2YXIgaSA9IDAsIE4gPSAoY2JzICYmIGNicy5sZW5ndGgpOyBpIDwgTjsgaSsrKVxuICAgICAgICBjYnNbaV0gJiYgY2JzW2ldLmNhbGwodmlldyk7XG4gICAgfSk7XG4gIH0pO1xufTtcblxuQmxhemUuX2NyZWF0ZVZpZXcgPSBmdW5jdGlvbiAodmlldywgcGFyZW50VmlldywgZm9yRXhwYW5zaW9uKSB7XG4gIGlmICh2aWV3LmlzQ3JlYXRlZClcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW4ndCByZW5kZXIgdGhlIHNhbWUgVmlldyB0d2ljZVwiKTtcblxuICB2aWV3LnBhcmVudFZpZXcgPSAocGFyZW50VmlldyB8fCBudWxsKTtcbiAgdmlldy5pc0NyZWF0ZWQgPSB0cnVlO1xuICBpZiAoZm9yRXhwYW5zaW9uKVxuICAgIHZpZXcuX2lzQ3JlYXRlZEZvckV4cGFuc2lvbiA9IHRydWU7XG5cbiAgQmxhemUuX2ZpcmVDYWxsYmFja3ModmlldywgJ2NyZWF0ZWQnKTtcbn07XG5cbnZhciBkb0ZpcnN0UmVuZGVyID0gZnVuY3Rpb24gKHZpZXcsIGluaXRpYWxDb250ZW50KSB7XG4gIHZhciBkb21yYW5nZSA9IG5ldyBCbGF6ZS5fRE9NUmFuZ2UoaW5pdGlhbENvbnRlbnQpO1xuICB2aWV3Ll9kb21yYW5nZSA9IGRvbXJhbmdlO1xuICBkb21yYW5nZS52aWV3ID0gdmlldztcbiAgdmlldy5pc1JlbmRlcmVkID0gdHJ1ZTtcbiAgQmxhemUuX2ZpcmVDYWxsYmFja3ModmlldywgJ3JlbmRlcmVkJyk7XG5cbiAgdmFyIHRlYXJkb3duSG9vayA9IG51bGw7XG5cbiAgZG9tcmFuZ2Uub25BdHRhY2hlZChmdW5jdGlvbiBhdHRhY2hlZChyYW5nZSwgZWxlbWVudCkge1xuICAgIHZpZXcuX2lzQXR0YWNoZWQgPSB0cnVlO1xuXG4gICAgdGVhcmRvd25Ib29rID0gQmxhemUuX0RPTUJhY2tlbmQuVGVhcmRvd24ub25FbGVtZW50VGVhcmRvd24oXG4gICAgICBlbGVtZW50LCBmdW5jdGlvbiB0ZWFyZG93bigpIHtcbiAgICAgICAgQmxhemUuX2Rlc3Ryb3lWaWV3KHZpZXcsIHRydWUgLyogX3NraXBOb2RlcyAqLyk7XG4gICAgICB9KTtcbiAgfSk7XG5cbiAgLy8gdGVhciBkb3duIHRoZSB0ZWFyZG93biBob29rXG4gIHZpZXcub25WaWV3RGVzdHJveWVkKGZ1bmN0aW9uICgpIHtcbiAgICB0ZWFyZG93bkhvb2sgJiYgdGVhcmRvd25Ib29rLnN0b3AoKTtcbiAgICB0ZWFyZG93bkhvb2sgPSBudWxsO1xuICB9KTtcblxuICByZXR1cm4gZG9tcmFuZ2U7XG59O1xuXG4vLyBUYWtlIGFuIHVuY3JlYXRlZCBWaWV3IGB2aWV3YCBhbmQgY3JlYXRlIGFuZCByZW5kZXIgaXQgdG8gRE9NLFxuLy8gc2V0dGluZyB1cCB0aGUgYXV0b3J1biB0aGF0IHVwZGF0ZXMgdGhlIFZpZXcuICBSZXR1cm5zIGEgbmV3XG4vLyBET01SYW5nZSwgd2hpY2ggaGFzIGJlZW4gYXNzb2NpYXRlZCB3aXRoIHRoZSBWaWV3LlxuLy9cbi8vIFRoZSBwcml2YXRlIGFyZ3VtZW50cyBgX3dvcmtTdGFja2AgYW5kIGBfaW50b0FycmF5YCBhcmUgcGFzc2VkIGluXG4vLyBieSBCbGF6ZS5fbWF0ZXJpYWxpemVET00gYW5kIGFyZSBvbmx5IHByZXNlbnQgZm9yIHJlY3Vyc2l2ZSBjYWxsc1xuLy8gKHdoZW4gdGhlcmUgaXMgc29tZSBvdGhlciBfbWF0ZXJpYWxpemVWaWV3IG9uIHRoZSBzdGFjaykuICBJZlxuLy8gcHJvdmlkZWQsIHRoZW4gd2UgYXZvaWQgdGhlIG11dHVhbCByZWN1cnNpb24gb2YgY2FsbGluZyBiYWNrIGludG9cbi8vIEJsYXplLl9tYXRlcmlhbGl6ZURPTSBzbyB0aGF0IGRlZXAgVmlldyBoaWVyYXJjaGllcyBkb24ndCBibG93IHRoZVxuLy8gc3RhY2suICBJbnN0ZWFkLCB3ZSBwdXNoIHRhc2tzIG9udG8gd29ya1N0YWNrIGZvciB0aGUgaW5pdGlhbFxuLy8gcmVuZGVyaW5nIGFuZCBzdWJzZXF1ZW50IHNldHVwIG9mIHRoZSBWaWV3LCBhbmQgdGhleSBhcmUgZG9uZSBhZnRlclxuLy8gd2UgcmV0dXJuLiAgV2hlbiB0aGVyZSBpcyBhIF93b3JrU3RhY2ssIHdlIGRvIG5vdCByZXR1cm4gdGhlIG5ld1xuLy8gRE9NUmFuZ2UsIGJ1dCBpbnN0ZWFkIHB1c2ggaXQgaW50byBfaW50b0FycmF5IGZyb20gYSBfd29ya1N0YWNrXG4vLyB0YXNrLlxuQmxhemUuX21hdGVyaWFsaXplVmlldyA9IGZ1bmN0aW9uICh2aWV3LCBwYXJlbnRWaWV3LCBfd29ya1N0YWNrLCBfaW50b0FycmF5KSB7XG4gIEJsYXplLl9jcmVhdGVWaWV3KHZpZXcsIHBhcmVudFZpZXcpO1xuXG4gIHZhciBkb21yYW5nZTtcbiAgdmFyIGxhc3RIdG1sanM7XG4gIC8vIFdlIGRvbid0IGV4cGVjdCB0byBiZSBjYWxsZWQgaW4gYSBDb21wdXRhdGlvbiwgYnV0IGp1c3QgaW4gY2FzZSxcbiAgLy8gd3JhcCBpbiBUcmFja2VyLm5vbnJlYWN0aXZlLlxuICBUcmFja2VyLm5vbnJlYWN0aXZlKGZ1bmN0aW9uICgpIHtcbiAgICB2aWV3LmF1dG9ydW4oZnVuY3Rpb24gZG9SZW5kZXIoYykge1xuICAgICAgLy8gYHZpZXcuYXV0b3J1bmAgc2V0cyB0aGUgY3VycmVudCB2aWV3LlxuICAgICAgdmlldy5yZW5kZXJDb3VudCsrO1xuICAgICAgdmlldy5faXNJblJlbmRlciA9IHRydWU7XG4gICAgICAvLyBBbnkgZGVwZW5kZW5jaWVzIHRoYXQgc2hvdWxkIGludmFsaWRhdGUgdGhpcyBDb21wdXRhdGlvbiBjb21lXG4gICAgICAvLyBmcm9tIHRoaXMgbGluZTpcbiAgICAgIHZhciBodG1sanMgPSB2aWV3Ll9yZW5kZXIoKTtcbiAgICAgIHZpZXcuX2lzSW5SZW5kZXIgPSBmYWxzZTtcblxuICAgICAgaWYgKCEgYy5maXJzdFJ1biAmJiAhIEJsYXplLl9pc0NvbnRlbnRFcXVhbChsYXN0SHRtbGpzLCBodG1sanMpKSB7XG4gICAgICAgIFRyYWNrZXIubm9ucmVhY3RpdmUoZnVuY3Rpb24gZG9NYXRlcmlhbGl6ZSgpIHtcbiAgICAgICAgICAvLyByZS1yZW5kZXJcbiAgICAgICAgICB2YXIgcmFuZ2VzQW5kTm9kZXMgPSBCbGF6ZS5fbWF0ZXJpYWxpemVET00oaHRtbGpzLCBbXSwgdmlldyk7XG4gICAgICAgICAgZG9tcmFuZ2Uuc2V0TWVtYmVycyhyYW5nZXNBbmROb2Rlcyk7XG4gICAgICAgICAgQmxhemUuX2ZpcmVDYWxsYmFja3ModmlldywgJ3JlbmRlcmVkJyk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgbGFzdEh0bWxqcyA9IGh0bWxqcztcblxuICAgICAgLy8gQ2F1c2VzIGFueSBuZXN0ZWQgdmlld3MgdG8gc3RvcCBpbW1lZGlhdGVseSwgbm90IHdoZW4gd2UgY2FsbFxuICAgICAgLy8gYHNldE1lbWJlcnNgIHRoZSBuZXh0IHRpbWUgYXJvdW5kIHRoZSBhdXRvcnVuLiAgT3RoZXJ3aXNlLFxuICAgICAgLy8gaGVscGVycyBpbiB0aGUgRE9NIHRyZWUgdG8gYmUgcmVwbGFjZWQgbWlnaHQgYmUgc2NoZWR1bGVkXG4gICAgICAvLyB0byByZS1ydW4gYmVmb3JlIHdlIGhhdmUgYSBjaGFuY2UgdG8gc3RvcCB0aGVtLlxuICAgICAgVHJhY2tlci5vbkludmFsaWRhdGUoZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoZG9tcmFuZ2UpIHtcbiAgICAgICAgICBkb21yYW5nZS5kZXN0cm95TWVtYmVycygpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9LCB1bmRlZmluZWQsICdtYXRlcmlhbGl6ZScpO1xuXG4gICAgLy8gZmlyc3QgcmVuZGVyLiAgbGFzdEh0bWxqcyBpcyB0aGUgZmlyc3QgaHRtbGpzLlxuICAgIHZhciBpbml0aWFsQ29udGVudHM7XG4gICAgaWYgKCEgX3dvcmtTdGFjaykge1xuICAgICAgaW5pdGlhbENvbnRlbnRzID0gQmxhemUuX21hdGVyaWFsaXplRE9NKGxhc3RIdG1sanMsIFtdLCB2aWV3KTtcbiAgICAgIGRvbXJhbmdlID0gZG9GaXJzdFJlbmRlcih2aWV3LCBpbml0aWFsQ29udGVudHMpO1xuICAgICAgaW5pdGlhbENvbnRlbnRzID0gbnVsbDsgLy8gaGVscCBHQyBiZWNhdXNlIHdlIGNsb3NlIG92ZXIgdGhpcyBzY29wZSBhIGxvdFxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBXZSdyZSBiZWluZyBjYWxsZWQgZnJvbSBCbGF6ZS5fbWF0ZXJpYWxpemVET00sIHNvIHRvIGF2b2lkXG4gICAgICAvLyByZWN1cnNpb24gYW5kIHNhdmUgc3RhY2sgc3BhY2UsIHByb3ZpZGUgYSBkZXNjcmlwdGlvbiBvZiB0aGVcbiAgICAgIC8vIHdvcmsgdG8gYmUgZG9uZSBpbnN0ZWFkIG9mIGRvaW5nIGl0LiAgVGFza3MgcHVzaGVkIG9udG9cbiAgICAgIC8vIF93b3JrU3RhY2sgd2lsbCBiZSBkb25lIGluIExJRk8gb3JkZXIgYWZ0ZXIgd2UgcmV0dXJuLlxuICAgICAgLy8gVGhlIHdvcmsgd2lsbCBzdGlsbCBiZSBkb25lIHdpdGhpbiBhIFRyYWNrZXIubm9ucmVhY3RpdmUsXG4gICAgICAvLyBiZWNhdXNlIGl0IHdpbGwgYmUgZG9uZSBieSBzb21lIGNhbGwgdG8gQmxhemUuX21hdGVyaWFsaXplRE9NXG4gICAgICAvLyAod2hpY2ggaXMgYWx3YXlzIGNhbGxlZCBpbiBhIFRyYWNrZXIubm9ucmVhY3RpdmUpLlxuICAgICAgaW5pdGlhbENvbnRlbnRzID0gW107XG4gICAgICAvLyBwdXNoIHRoaXMgZnVuY3Rpb24gZmlyc3Qgc28gdGhhdCBpdCBoYXBwZW5zIGxhc3RcbiAgICAgIF93b3JrU3RhY2sucHVzaChmdW5jdGlvbiAoKSB7XG4gICAgICAgIGRvbXJhbmdlID0gZG9GaXJzdFJlbmRlcih2aWV3LCBpbml0aWFsQ29udGVudHMpO1xuICAgICAgICBpbml0aWFsQ29udGVudHMgPSBudWxsOyAvLyBoZWxwIEdDIGJlY2F1c2Ugb2YgYWxsIHRoZSBjbG9zdXJlcyBoZXJlXG4gICAgICAgIF9pbnRvQXJyYXkucHVzaChkb21yYW5nZSk7XG4gICAgICB9KTtcbiAgICAgIC8vIG5vdyBwdXNoIHRoZSB0YXNrIHRoYXQgY2FsY3VsYXRlcyBpbml0aWFsQ29udGVudHNcbiAgICAgIF93b3JrU3RhY2sucHVzaChCbGF6ZS5fYmluZChCbGF6ZS5fbWF0ZXJpYWxpemVET00sIG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhc3RIdG1sanMsIGluaXRpYWxDb250ZW50cywgdmlldywgX3dvcmtTdGFjaykpO1xuICAgIH1cbiAgfSk7XG5cbiAgaWYgKCEgX3dvcmtTdGFjaykge1xuICAgIHJldHVybiBkb21yYW5nZTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufTtcblxuLy8gRXhwYW5kcyBhIFZpZXcgdG8gSFRNTGpzLCBjYWxsaW5nIGByZW5kZXJgIHJlY3Vyc2l2ZWx5IG9uIGFsbFxuLy8gVmlld3MgYW5kIGV2YWx1YXRpbmcgYW55IGR5bmFtaWMgYXR0cmlidXRlcy4gIENhbGxzIHRoZSBgY3JlYXRlZGBcbi8vIGNhbGxiYWNrLCBidXQgbm90IHRoZSBgbWF0ZXJpYWxpemVkYCBvciBgcmVuZGVyZWRgIGNhbGxiYWNrcy5cbi8vIERlc3Ryb3lzIHRoZSB2aWV3IGltbWVkaWF0ZWx5LCB1bmxlc3MgY2FsbGVkIGluIGEgVHJhY2tlciBDb21wdXRhdGlvbixcbi8vIGluIHdoaWNoIGNhc2UgdGhlIHZpZXcgd2lsbCBiZSBkZXN0cm95ZWQgd2hlbiB0aGUgQ29tcHV0YXRpb24gaXNcbi8vIGludmFsaWRhdGVkLiAgSWYgY2FsbGVkIGluIGEgVHJhY2tlciBDb21wdXRhdGlvbiwgdGhlIHJlc3VsdCBpcyBhXG4vLyByZWFjdGl2ZSBzdHJpbmc7IHRoYXQgaXMsIHRoZSBDb21wdXRhdGlvbiB3aWxsIGJlIGludmFsaWRhdGVkXG4vLyBpZiBhbnkgY2hhbmdlcyBhcmUgbWFkZSB0byB0aGUgdmlldyBvciBzdWJ2aWV3cyB0aGF0IG1pZ2h0IGFmZmVjdFxuLy8gdGhlIEhUTUwuXG5CbGF6ZS5fZXhwYW5kVmlldyA9IGZ1bmN0aW9uICh2aWV3LCBwYXJlbnRWaWV3KSB7XG4gIEJsYXplLl9jcmVhdGVWaWV3KHZpZXcsIHBhcmVudFZpZXcsIHRydWUgLypmb3JFeHBhbnNpb24qLyk7XG5cbiAgdmlldy5faXNJblJlbmRlciA9IHRydWU7XG4gIHZhciBodG1sanMgPSBCbGF6ZS5fd2l0aEN1cnJlbnRWaWV3KHZpZXcsIGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdmlldy5fcmVuZGVyKCk7XG4gIH0pO1xuICB2aWV3Ll9pc0luUmVuZGVyID0gZmFsc2U7XG5cbiAgdmFyIHJlc3VsdCA9IEJsYXplLl9leHBhbmQoaHRtbGpzLCB2aWV3KTtcblxuICBpZiAoVHJhY2tlci5hY3RpdmUpIHtcbiAgICBUcmFja2VyLm9uSW52YWxpZGF0ZShmdW5jdGlvbiAoKSB7XG4gICAgICBCbGF6ZS5fZGVzdHJveVZpZXcodmlldyk7XG4gICAgfSk7XG4gIH0gZWxzZSB7XG4gICAgQmxhemUuX2Rlc3Ryb3lWaWV3KHZpZXcpO1xuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbi8vIE9wdGlvbnM6IGBwYXJlbnRWaWV3YFxuQmxhemUuX0hUTUxKU0V4cGFuZGVyID0gSFRNTC5UcmFuc2Zvcm1pbmdWaXNpdG9yLmV4dGVuZCgpO1xuQmxhemUuX0hUTUxKU0V4cGFuZGVyLmRlZih7XG4gIHZpc2l0T2JqZWN0OiBmdW5jdGlvbiAoeCkge1xuICAgIGlmICh4IGluc3RhbmNlb2YgQmxhemUuVGVtcGxhdGUpXG4gICAgICB4ID0geC5jb25zdHJ1Y3RWaWV3KCk7XG4gICAgaWYgKHggaW5zdGFuY2VvZiBCbGF6ZS5WaWV3KVxuICAgICAgcmV0dXJuIEJsYXplLl9leHBhbmRWaWV3KHgsIHRoaXMucGFyZW50Vmlldyk7XG5cbiAgICAvLyB0aGlzIHdpbGwgdGhyb3cgYW4gZXJyb3I7IG90aGVyIG9iamVjdHMgYXJlIG5vdCBhbGxvd2VkIVxuICAgIHJldHVybiBIVE1MLlRyYW5zZm9ybWluZ1Zpc2l0b3IucHJvdG90eXBlLnZpc2l0T2JqZWN0LmNhbGwodGhpcywgeCk7XG4gIH0sXG4gIHZpc2l0QXR0cmlidXRlczogZnVuY3Rpb24gKGF0dHJzKSB7XG4gICAgLy8gZXhwYW5kIGR5bmFtaWMgYXR0cmlidXRlc1xuICAgIGlmICh0eXBlb2YgYXR0cnMgPT09ICdmdW5jdGlvbicpXG4gICAgICBhdHRycyA9IEJsYXplLl93aXRoQ3VycmVudFZpZXcodGhpcy5wYXJlbnRWaWV3LCBhdHRycyk7XG5cbiAgICAvLyBjYWxsIHN1cGVyIChlLmcuIGZvciBjYXNlIHdoZXJlIGBhdHRyc2AgaXMgYW4gYXJyYXkpXG4gICAgcmV0dXJuIEhUTUwuVHJhbnNmb3JtaW5nVmlzaXRvci5wcm90b3R5cGUudmlzaXRBdHRyaWJ1dGVzLmNhbGwodGhpcywgYXR0cnMpO1xuICB9LFxuICB2aXNpdEF0dHJpYnV0ZTogZnVuY3Rpb24gKG5hbWUsIHZhbHVlLCB0YWcpIHtcbiAgICAvLyBleHBhbmQgYXR0cmlidXRlIHZhbHVlcyB0aGF0IGFyZSBmdW5jdGlvbnMuICBBbnkgYXR0cmlidXRlIHZhbHVlXG4gICAgLy8gdGhhdCBjb250YWlucyBWaWV3cyBtdXN0IGJlIHdyYXBwZWQgaW4gYSBmdW5jdGlvbi5cbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnZnVuY3Rpb24nKVxuICAgICAgdmFsdWUgPSBCbGF6ZS5fd2l0aEN1cnJlbnRWaWV3KHRoaXMucGFyZW50VmlldywgdmFsdWUpO1xuXG4gICAgcmV0dXJuIEhUTUwuVHJhbnNmb3JtaW5nVmlzaXRvci5wcm90b3R5cGUudmlzaXRBdHRyaWJ1dGUuY2FsbChcbiAgICAgIHRoaXMsIG5hbWUsIHZhbHVlLCB0YWcpO1xuICB9XG59KTtcblxuLy8gUmV0dXJuIEJsYXplLmN1cnJlbnRWaWV3LCBidXQgb25seSBpZiBpdCBpcyBiZWluZyByZW5kZXJlZFxuLy8gKGkuZS4gd2UgYXJlIGluIGl0cyByZW5kZXIoKSBtZXRob2QpLlxudmFyIGN1cnJlbnRWaWV3SWZSZW5kZXJpbmcgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciB2aWV3ID0gQmxhemUuY3VycmVudFZpZXc7XG4gIHJldHVybiAodmlldyAmJiB2aWV3Ll9pc0luUmVuZGVyKSA/IHZpZXcgOiBudWxsO1xufTtcblxuQmxhemUuX2V4cGFuZCA9IGZ1bmN0aW9uIChodG1sanMsIHBhcmVudFZpZXcpIHtcbiAgcGFyZW50VmlldyA9IHBhcmVudFZpZXcgfHwgY3VycmVudFZpZXdJZlJlbmRlcmluZygpO1xuICByZXR1cm4gKG5ldyBCbGF6ZS5fSFRNTEpTRXhwYW5kZXIoXG4gICAge3BhcmVudFZpZXc6IHBhcmVudFZpZXd9KSkudmlzaXQoaHRtbGpzKTtcbn07XG5cbkJsYXplLl9leHBhbmRBdHRyaWJ1dGVzID0gZnVuY3Rpb24gKGF0dHJzLCBwYXJlbnRWaWV3KSB7XG4gIHBhcmVudFZpZXcgPSBwYXJlbnRWaWV3IHx8IGN1cnJlbnRWaWV3SWZSZW5kZXJpbmcoKTtcbiAgcmV0dXJuIChuZXcgQmxhemUuX0hUTUxKU0V4cGFuZGVyKFxuICAgIHtwYXJlbnRWaWV3OiBwYXJlbnRWaWV3fSkpLnZpc2l0QXR0cmlidXRlcyhhdHRycyk7XG59O1xuXG5CbGF6ZS5fZGVzdHJveVZpZXcgPSBmdW5jdGlvbiAodmlldywgX3NraXBOb2Rlcykge1xuICBpZiAodmlldy5pc0Rlc3Ryb3llZClcbiAgICByZXR1cm47XG4gIHZpZXcuaXNEZXN0cm95ZWQgPSB0cnVlO1xuXG4gIEJsYXplLl9maXJlQ2FsbGJhY2tzKHZpZXcsICdkZXN0cm95ZWQnKTtcblxuICAvLyBEZXN0cm95IHZpZXdzIGFuZCBlbGVtZW50cyByZWN1cnNpdmVseS4gIElmIF9za2lwTm9kZXMsXG4gIC8vIG9ubHkgcmVjdXJzZSB1cCB0byB2aWV3cywgbm90IGVsZW1lbnRzLCBmb3IgdGhlIGNhc2Ugd2hlcmVcbiAgLy8gdGhlIGJhY2tlbmQgKGpRdWVyeSkgaXMgcmVjdXJzaW5nIG92ZXIgdGhlIGVsZW1lbnRzIGFscmVhZHkuXG5cbiAgaWYgKHZpZXcuX2RvbXJhbmdlKVxuICAgIHZpZXcuX2RvbXJhbmdlLmRlc3Ryb3lNZW1iZXJzKF9za2lwTm9kZXMpO1xufTtcblxuQmxhemUuX2Rlc3Ryb3lOb2RlID0gZnVuY3Rpb24gKG5vZGUpIHtcbiAgaWYgKG5vZGUubm9kZVR5cGUgPT09IDEpXG4gICAgQmxhemUuX0RPTUJhY2tlbmQuVGVhcmRvd24udGVhckRvd25FbGVtZW50KG5vZGUpO1xufTtcblxuLy8gQXJlIHRoZSBIVE1ManMgZW50aXRpZXMgYGFgIGFuZCBgYmAgdGhlIHNhbWU/ICBXZSBjb3VsZCBiZVxuLy8gbW9yZSBlbGFib3JhdGUgaGVyZSBidXQgdGhlIHBvaW50IGlzIHRvIGNhdGNoIHRoZSBtb3N0IGJhc2ljXG4vLyBjYXNlcy5cbkJsYXplLl9pc0NvbnRlbnRFcXVhbCA9IGZ1bmN0aW9uIChhLCBiKSB7XG4gIGlmIChhIGluc3RhbmNlb2YgSFRNTC5SYXcpIHtcbiAgICByZXR1cm4gKGIgaW5zdGFuY2VvZiBIVE1MLlJhdykgJiYgKGEudmFsdWUgPT09IGIudmFsdWUpO1xuICB9IGVsc2UgaWYgKGEgPT0gbnVsbCkge1xuICAgIHJldHVybiAoYiA9PSBudWxsKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gKGEgPT09IGIpICYmXG4gICAgICAoKHR5cGVvZiBhID09PSAnbnVtYmVyJykgfHwgKHR5cGVvZiBhID09PSAnYm9vbGVhbicpIHx8XG4gICAgICAgKHR5cGVvZiBhID09PSAnc3RyaW5nJykpO1xuICB9XG59O1xuXG4vKipcbiAqIEBzdW1tYXJ5IFRoZSBWaWV3IGNvcnJlc3BvbmRpbmcgdG8gdGhlIGN1cnJlbnQgdGVtcGxhdGUgaGVscGVyLCBldmVudCBoYW5kbGVyLCBjYWxsYmFjaywgb3IgYXV0b3J1bi4gIElmIHRoZXJlIGlzbid0IG9uZSwgYG51bGxgLlxuICogQGxvY3VzIENsaWVudFxuICogQHR5cGUge0JsYXplLlZpZXd9XG4gKi9cbkJsYXplLmN1cnJlbnRWaWV3ID0gbnVsbDtcblxuQmxhemUuX3dpdGhDdXJyZW50VmlldyA9IGZ1bmN0aW9uICh2aWV3LCBmdW5jKSB7XG4gIHZhciBvbGRWaWV3ID0gQmxhemUuY3VycmVudFZpZXc7XG4gIHRyeSB7XG4gICAgQmxhemUuY3VycmVudFZpZXcgPSB2aWV3O1xuICAgIHJldHVybiBmdW5jKCk7XG4gIH0gZmluYWxseSB7XG4gICAgQmxhemUuY3VycmVudFZpZXcgPSBvbGRWaWV3O1xuICB9XG59O1xuXG4vLyBCbGF6ZS5yZW5kZXIgcHVibGljbHkgdGFrZXMgYSBWaWV3IG9yIGEgVGVtcGxhdGUuXG4vLyBQcml2YXRlbHksIGl0IHRha2VzIGFueSBIVE1MSlMgKGV4dGVuZGVkIHdpdGggVmlld3MgYW5kIFRlbXBsYXRlcylcbi8vIGV4Y2VwdCBudWxsIG9yIHVuZGVmaW5lZCwgb3IgYSBmdW5jdGlvbiB0aGF0IHJldHVybnMgYW55IGV4dGVuZGVkXG4vLyBIVE1MSlMuXG52YXIgY2hlY2tSZW5kZXJDb250ZW50ID0gZnVuY3Rpb24gKGNvbnRlbnQpIHtcbiAgaWYgKGNvbnRlbnQgPT09IG51bGwpXG4gICAgdGhyb3cgbmV3IEVycm9yKFwiQ2FuJ3QgcmVuZGVyIG51bGxcIik7XG4gIGlmICh0eXBlb2YgY29udGVudCA9PT0gJ3VuZGVmaW5lZCcpXG4gICAgdGhyb3cgbmV3IEVycm9yKFwiQ2FuJ3QgcmVuZGVyIHVuZGVmaW5lZFwiKTtcblxuICBpZiAoKGNvbnRlbnQgaW5zdGFuY2VvZiBCbGF6ZS5WaWV3KSB8fFxuICAgICAgKGNvbnRlbnQgaW5zdGFuY2VvZiBCbGF6ZS5UZW1wbGF0ZSkgfHxcbiAgICAgICh0eXBlb2YgY29udGVudCA9PT0gJ2Z1bmN0aW9uJykpXG4gICAgcmV0dXJuO1xuXG4gIHRyeSB7XG4gICAgLy8gVGhyb3cgaWYgY29udGVudCBkb2Vzbid0IGxvb2sgbGlrZSBIVE1MSlMgYXQgdGhlIHRvcCBsZXZlbFxuICAgIC8vIChpLmUuIHZlcmlmeSB0aGF0IHRoaXMgaXMgYW4gSFRNTC5UYWcsIG9yIGFuIGFycmF5LFxuICAgIC8vIG9yIGEgcHJpbWl0aXZlLCBldGMuKVxuICAgIChuZXcgSFRNTC5WaXNpdG9yKS52aXNpdChjb250ZW50KTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIC8vIE1ha2UgZXJyb3IgbWVzc2FnZSBzdWl0YWJsZSBmb3IgcHVibGljIEFQSVxuICAgIHRocm93IG5ldyBFcnJvcihcIkV4cGVjdGVkIFRlbXBsYXRlIG9yIFZpZXdcIik7XG4gIH1cbn07XG5cbi8vIEZvciBCbGF6ZS5yZW5kZXIgYW5kIEJsYXplLnRvSFRNTCwgdGFrZSBjb250ZW50IGFuZFxuLy8gd3JhcCBpdCBpbiBhIFZpZXcsIHVubGVzcyBpdCdzIGEgc2luZ2xlIFZpZXcgb3Jcbi8vIFRlbXBsYXRlIGFscmVhZHkuXG52YXIgY29udGVudEFzVmlldyA9IGZ1bmN0aW9uIChjb250ZW50KSB7XG4gIGNoZWNrUmVuZGVyQ29udGVudChjb250ZW50KTtcblxuICBpZiAoY29udGVudCBpbnN0YW5jZW9mIEJsYXplLlRlbXBsYXRlKSB7XG4gICAgcmV0dXJuIGNvbnRlbnQuY29uc3RydWN0VmlldygpO1xuICB9IGVsc2UgaWYgKGNvbnRlbnQgaW5zdGFuY2VvZiBCbGF6ZS5WaWV3KSB7XG4gICAgcmV0dXJuIGNvbnRlbnQ7XG4gIH0gZWxzZSB7XG4gICAgdmFyIGZ1bmMgPSBjb250ZW50O1xuICAgIGlmICh0eXBlb2YgZnVuYyAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgZnVuYyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIGNvbnRlbnQ7XG4gICAgICB9O1xuICAgIH1cbiAgICByZXR1cm4gQmxhemUuVmlldygncmVuZGVyJywgZnVuYyk7XG4gIH1cbn07XG5cbi8vIEZvciBCbGF6ZS5yZW5kZXJXaXRoRGF0YSBhbmQgQmxhemUudG9IVE1MV2l0aERhdGEsIHdyYXAgY29udGVudFxuLy8gaW4gYSBmdW5jdGlvbiwgaWYgbmVjZXNzYXJ5LCBzbyBpdCBjYW4gYmUgYSBjb250ZW50IGFyZyB0b1xuLy8gYSBCbGF6ZS5XaXRoLlxudmFyIGNvbnRlbnRBc0Z1bmMgPSBmdW5jdGlvbiAoY29udGVudCkge1xuICBjaGVja1JlbmRlckNvbnRlbnQoY29udGVudCk7XG5cbiAgaWYgKHR5cGVvZiBjb250ZW50ICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiBjb250ZW50O1xuICAgIH07XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGNvbnRlbnQ7XG4gIH1cbn07XG5cbkJsYXplLl9fcm9vdFZpZXdzID0gW107XG5cbi8qKlxuICogQHN1bW1hcnkgUmVuZGVycyBhIHRlbXBsYXRlIG9yIFZpZXcgdG8gRE9NIG5vZGVzIGFuZCBpbnNlcnRzIGl0IGludG8gdGhlIERPTSwgcmV0dXJuaW5nIGEgcmVuZGVyZWQgW1ZpZXddKCNCbGF6ZS1WaWV3KSB3aGljaCBjYW4gYmUgcGFzc2VkIHRvIFtgQmxhemUucmVtb3ZlYF0oI0JsYXplLXJlbW92ZSkuXG4gKiBAbG9jdXMgQ2xpZW50XG4gKiBAcGFyYW0ge1RlbXBsYXRlfEJsYXplLlZpZXd9IHRlbXBsYXRlT3JWaWV3IFRoZSB0ZW1wbGF0ZSAoZS5nLiBgVGVtcGxhdGUubXlUZW1wbGF0ZWApIG9yIFZpZXcgb2JqZWN0IHRvIHJlbmRlci4gIElmIGEgdGVtcGxhdGUsIGEgVmlldyBvYmplY3QgaXMgW2NvbnN0cnVjdGVkXSgjdGVtcGxhdGVfY29uc3RydWN0dmlldykuICBJZiBhIFZpZXcsIGl0IG11c3QgYmUgYW4gdW5yZW5kZXJlZCBWaWV3LCB3aGljaCBiZWNvbWVzIGEgcmVuZGVyZWQgVmlldyBhbmQgaXMgcmV0dXJuZWQuXG4gKiBAcGFyYW0ge0RPTU5vZGV9IHBhcmVudE5vZGUgVGhlIG5vZGUgdGhhdCB3aWxsIGJlIHRoZSBwYXJlbnQgb2YgdGhlIHJlbmRlcmVkIHRlbXBsYXRlLiAgSXQgbXVzdCBiZSBhbiBFbGVtZW50IG5vZGUuXG4gKiBAcGFyYW0ge0RPTU5vZGV9IFtuZXh0Tm9kZV0gT3B0aW9uYWwuIElmIHByb3ZpZGVkLCBtdXN0IGJlIGEgY2hpbGQgb2YgPGVtPnBhcmVudE5vZGU8L2VtPjsgdGhlIHRlbXBsYXRlIHdpbGwgYmUgaW5zZXJ0ZWQgYmVmb3JlIHRoaXMgbm9kZS4gSWYgbm90IHByb3ZpZGVkLCB0aGUgdGVtcGxhdGUgd2lsbCBiZSBpbnNlcnRlZCBhcyB0aGUgbGFzdCBjaGlsZCBvZiBwYXJlbnROb2RlLlxuICogQHBhcmFtIHtCbGF6ZS5WaWV3fSBbcGFyZW50Vmlld10gT3B0aW9uYWwuIElmIHByb3ZpZGVkLCBpdCB3aWxsIGJlIHNldCBhcyB0aGUgcmVuZGVyZWQgVmlldydzIFtgcGFyZW50Vmlld2BdKCN2aWV3X3BhcmVudHZpZXcpLlxuICovXG5CbGF6ZS5yZW5kZXIgPSBmdW5jdGlvbiAoY29udGVudCwgcGFyZW50RWxlbWVudCwgbmV4dE5vZGUsIHBhcmVudFZpZXcpIHtcbiAgaWYgKCEgcGFyZW50RWxlbWVudCkge1xuICAgIEJsYXplLl93YXJuKFwiQmxhemUucmVuZGVyIHdpdGhvdXQgYSBwYXJlbnQgZWxlbWVudCBpcyBkZXByZWNhdGVkLiBcIiArXG4gICAgICAgICAgICAgICAgXCJZb3UgbXVzdCBzcGVjaWZ5IHdoZXJlIHRvIGluc2VydCB0aGUgcmVuZGVyZWQgY29udGVudC5cIik7XG4gIH1cblxuICBpZiAobmV4dE5vZGUgaW5zdGFuY2VvZiBCbGF6ZS5WaWV3KSB7XG4gICAgLy8gaGFuZGxlIG9taXR0ZWQgbmV4dE5vZGVcbiAgICBwYXJlbnRWaWV3ID0gbmV4dE5vZGU7XG4gICAgbmV4dE5vZGUgPSBudWxsO1xuICB9XG5cbiAgLy8gcGFyZW50RWxlbWVudCBtdXN0IGJlIGEgRE9NIG5vZGUuIGluIHBhcnRpY3VsYXIsIGNhbid0IGJlIHRoZVxuICAvLyByZXN1bHQgb2YgYSBjYWxsIHRvIGAkYC4gQ2FuJ3QgY2hlY2sgaWYgYHBhcmVudEVsZW1lbnQgaW5zdGFuY2VvZlxuICAvLyBOb2RlYCBzaW5jZSAnTm9kZScgaXMgdW5kZWZpbmVkIGluIElFOC5cbiAgaWYgKHBhcmVudEVsZW1lbnQgJiYgdHlwZW9mIHBhcmVudEVsZW1lbnQubm9kZVR5cGUgIT09ICdudW1iZXInKVxuICAgIHRocm93IG5ldyBFcnJvcihcIidwYXJlbnRFbGVtZW50JyBtdXN0IGJlIGEgRE9NIG5vZGVcIik7XG4gIGlmIChuZXh0Tm9kZSAmJiB0eXBlb2YgbmV4dE5vZGUubm9kZVR5cGUgIT09ICdudW1iZXInKSAvLyAnbmV4dE5vZGUnIGlzIG9wdGlvbmFsXG4gICAgdGhyb3cgbmV3IEVycm9yKFwiJ25leHROb2RlJyBtdXN0IGJlIGEgRE9NIG5vZGVcIik7XG5cbiAgcGFyZW50VmlldyA9IHBhcmVudFZpZXcgfHwgY3VycmVudFZpZXdJZlJlbmRlcmluZygpO1xuXG4gIHZhciB2aWV3ID0gY29udGVudEFzVmlldyhjb250ZW50KTtcblxuICAvLyBUT0RPOiB0aGlzIGlzIG9ubHkgbmVlZGVkIGluIGRldmVsb3BtZW50XG4gIGlmICghcGFyZW50Vmlldykge1xuICAgIHZpZXcub25WaWV3Q3JlYXRlZChmdW5jdGlvbiAoKSB7XG4gICAgICBCbGF6ZS5fX3Jvb3RWaWV3cy5wdXNoKHZpZXcpO1xuICAgIH0pO1xuXG4gICAgdmlldy5vblZpZXdEZXN0cm95ZWQoZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIGluZGV4ID0gQmxhemUuX19yb290Vmlld3MuaW5kZXhPZih2aWV3KTtcbiAgICAgIGlmIChpbmRleCA+IC0xKSB7XG4gICAgICAgIEJsYXplLl9fcm9vdFZpZXdzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBCbGF6ZS5fbWF0ZXJpYWxpemVWaWV3KHZpZXcsIHBhcmVudFZpZXcpO1xuICBpZiAocGFyZW50RWxlbWVudCkge1xuICAgIHZpZXcuX2RvbXJhbmdlLmF0dGFjaChwYXJlbnRFbGVtZW50LCBuZXh0Tm9kZSk7XG4gIH1cblxuICByZXR1cm4gdmlldztcbn07XG5cbkJsYXplLmluc2VydCA9IGZ1bmN0aW9uICh2aWV3LCBwYXJlbnRFbGVtZW50LCBuZXh0Tm9kZSkge1xuICBCbGF6ZS5fd2FybihcIkJsYXplLmluc2VydCBoYXMgYmVlbiBkZXByZWNhdGVkLiAgU3BlY2lmeSB3aGVyZSB0byBpbnNlcnQgdGhlIFwiICtcbiAgICAgICAgICAgICAgXCJyZW5kZXJlZCBjb250ZW50IGluIHRoZSBjYWxsIHRvIEJsYXplLnJlbmRlci5cIik7XG5cbiAgaWYgKCEgKHZpZXcgJiYgKHZpZXcuX2RvbXJhbmdlIGluc3RhbmNlb2YgQmxhemUuX0RPTVJhbmdlKSkpXG4gICAgdGhyb3cgbmV3IEVycm9yKFwiRXhwZWN0ZWQgdGVtcGxhdGUgcmVuZGVyZWQgd2l0aCBCbGF6ZS5yZW5kZXJcIik7XG5cbiAgdmlldy5fZG9tcmFuZ2UuYXR0YWNoKHBhcmVudEVsZW1lbnQsIG5leHROb2RlKTtcbn07XG5cbi8qKlxuICogQHN1bW1hcnkgUmVuZGVycyBhIHRlbXBsYXRlIG9yIFZpZXcgdG8gRE9NIG5vZGVzIHdpdGggYSBkYXRhIGNvbnRleHQuICBPdGhlcndpc2UgaWRlbnRpY2FsIHRvIGBCbGF6ZS5yZW5kZXJgLlxuICogQGxvY3VzIENsaWVudFxuICogQHBhcmFtIHtUZW1wbGF0ZXxCbGF6ZS5WaWV3fSB0ZW1wbGF0ZU9yVmlldyBUaGUgdGVtcGxhdGUgKGUuZy4gYFRlbXBsYXRlLm15VGVtcGxhdGVgKSBvciBWaWV3IG9iamVjdCB0byByZW5kZXIuXG4gKiBAcGFyYW0ge09iamVjdHxGdW5jdGlvbn0gZGF0YSBUaGUgZGF0YSBjb250ZXh0IHRvIHVzZSwgb3IgYSBmdW5jdGlvbiByZXR1cm5pbmcgYSBkYXRhIGNvbnRleHQuICBJZiBhIGZ1bmN0aW9uIGlzIHByb3ZpZGVkLCBpdCB3aWxsIGJlIHJlYWN0aXZlbHkgcmUtcnVuLlxuICogQHBhcmFtIHtET01Ob2RlfSBwYXJlbnROb2RlIFRoZSBub2RlIHRoYXQgd2lsbCBiZSB0aGUgcGFyZW50IG9mIHRoZSByZW5kZXJlZCB0ZW1wbGF0ZS4gIEl0IG11c3QgYmUgYW4gRWxlbWVudCBub2RlLlxuICogQHBhcmFtIHtET01Ob2RlfSBbbmV4dE5vZGVdIE9wdGlvbmFsLiBJZiBwcm92aWRlZCwgbXVzdCBiZSBhIGNoaWxkIG9mIDxlbT5wYXJlbnROb2RlPC9lbT47IHRoZSB0ZW1wbGF0ZSB3aWxsIGJlIGluc2VydGVkIGJlZm9yZSB0aGlzIG5vZGUuIElmIG5vdCBwcm92aWRlZCwgdGhlIHRlbXBsYXRlIHdpbGwgYmUgaW5zZXJ0ZWQgYXMgdGhlIGxhc3QgY2hpbGQgb2YgcGFyZW50Tm9kZS5cbiAqIEBwYXJhbSB7QmxhemUuVmlld30gW3BhcmVudFZpZXddIE9wdGlvbmFsLiBJZiBwcm92aWRlZCwgaXQgd2lsbCBiZSBzZXQgYXMgdGhlIHJlbmRlcmVkIFZpZXcncyBbYHBhcmVudFZpZXdgXSgjdmlld19wYXJlbnR2aWV3KS5cbiAqL1xuQmxhemUucmVuZGVyV2l0aERhdGEgPSBmdW5jdGlvbiAoY29udGVudCwgZGF0YSwgcGFyZW50RWxlbWVudCwgbmV4dE5vZGUsIHBhcmVudFZpZXcpIHtcbiAgLy8gV2UgZGVmZXIgdGhlIGhhbmRsaW5nIG9mIG9wdGlvbmFsIGFyZ3VtZW50cyB0byBCbGF6ZS5yZW5kZXIuICBBdCB0aGlzIHBvaW50LFxuICAvLyBgbmV4dE5vZGVgIG1heSBhY3R1YWxseSBiZSBgcGFyZW50Vmlld2AuXG4gIHJldHVybiBCbGF6ZS5yZW5kZXIoQmxhemUuX1RlbXBsYXRlV2l0aChkYXRhLCBjb250ZW50QXNGdW5jKGNvbnRlbnQpKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgcGFyZW50RWxlbWVudCwgbmV4dE5vZGUsIHBhcmVudFZpZXcpO1xufTtcblxuLyoqXG4gKiBAc3VtbWFyeSBSZW1vdmVzIGEgcmVuZGVyZWQgVmlldyBmcm9tIHRoZSBET00sIHN0b3BwaW5nIGFsbCByZWFjdGl2ZSB1cGRhdGVzIGFuZCBldmVudCBsaXN0ZW5lcnMgb24gaXQuIEFsc28gZGVzdHJveXMgdGhlIEJsYXplLlRlbXBsYXRlIGluc3RhbmNlIGFzc29jaWF0ZWQgd2l0aCB0aGUgdmlldy5cbiAqIEBsb2N1cyBDbGllbnRcbiAqIEBwYXJhbSB7QmxhemUuVmlld30gcmVuZGVyZWRWaWV3IFRoZSByZXR1cm4gdmFsdWUgZnJvbSBgQmxhemUucmVuZGVyYCBvciBgQmxhemUucmVuZGVyV2l0aERhdGFgLCBvciB0aGUgYHZpZXdgIHByb3BlcnR5IG9mIGEgQmxhemUuVGVtcGxhdGUgaW5zdGFuY2UuIENhbGxpbmcgYEJsYXplLnJlbW92ZShUZW1wbGF0ZS5pbnN0YW5jZSgpLnZpZXcpYCBmcm9tIHdpdGhpbiBhIHRlbXBsYXRlIGV2ZW50IGhhbmRsZXIgd2lsbCBkZXN0cm95IHRoZSB2aWV3IGFzIHdlbGwgYXMgdGhhdCB0ZW1wbGF0ZSBhbmQgdHJpZ2dlciB0aGUgdGVtcGxhdGUncyBgb25EZXN0cm95ZWRgIGhhbmRsZXJzLlxuICovXG5CbGF6ZS5yZW1vdmUgPSBmdW5jdGlvbiAodmlldykge1xuICBpZiAoISAodmlldyAmJiAodmlldy5fZG9tcmFuZ2UgaW5zdGFuY2VvZiBCbGF6ZS5fRE9NUmFuZ2UpKSlcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJFeHBlY3RlZCB0ZW1wbGF0ZSByZW5kZXJlZCB3aXRoIEJsYXplLnJlbmRlclwiKTtcblxuICB3aGlsZSAodmlldykge1xuICAgIGlmICghIHZpZXcuaXNEZXN0cm95ZWQpIHtcbiAgICAgIHZhciByYW5nZSA9IHZpZXcuX2RvbXJhbmdlO1xuICAgICAgaWYgKHJhbmdlLmF0dGFjaGVkICYmICEgcmFuZ2UucGFyZW50UmFuZ2UpXG4gICAgICAgIHJhbmdlLmRldGFjaCgpO1xuICAgICAgcmFuZ2UuZGVzdHJveSgpO1xuICAgIH1cblxuICAgIHZpZXcgPSB2aWV3Ll9oYXNHZW5lcmF0ZWRQYXJlbnQgJiYgdmlldy5wYXJlbnRWaWV3O1xuICB9XG59O1xuXG4vKipcbiAqIEBzdW1tYXJ5IFJlbmRlcnMgYSB0ZW1wbGF0ZSBvciBWaWV3IHRvIGEgc3RyaW5nIG9mIEhUTUwuXG4gKiBAbG9jdXMgQ2xpZW50XG4gKiBAcGFyYW0ge1RlbXBsYXRlfEJsYXplLlZpZXd9IHRlbXBsYXRlT3JWaWV3IFRoZSB0ZW1wbGF0ZSAoZS5nLiBgVGVtcGxhdGUubXlUZW1wbGF0ZWApIG9yIFZpZXcgb2JqZWN0IGZyb20gd2hpY2ggdG8gZ2VuZXJhdGUgSFRNTC5cbiAqL1xuQmxhemUudG9IVE1MID0gZnVuY3Rpb24gKGNvbnRlbnQsIHBhcmVudFZpZXcpIHtcbiAgcGFyZW50VmlldyA9IHBhcmVudFZpZXcgfHwgY3VycmVudFZpZXdJZlJlbmRlcmluZygpO1xuXG4gIHJldHVybiBIVE1MLnRvSFRNTChCbGF6ZS5fZXhwYW5kVmlldyhjb250ZW50QXNWaWV3KGNvbnRlbnQpLCBwYXJlbnRWaWV3KSk7XG59O1xuXG4vKipcbiAqIEBzdW1tYXJ5IFJlbmRlcnMgYSB0ZW1wbGF0ZSBvciBWaWV3IHRvIEhUTUwgd2l0aCBhIGRhdGEgY29udGV4dC4gIE90aGVyd2lzZSBpZGVudGljYWwgdG8gYEJsYXplLnRvSFRNTGAuXG4gKiBAbG9jdXMgQ2xpZW50XG4gKiBAcGFyYW0ge1RlbXBsYXRlfEJsYXplLlZpZXd9IHRlbXBsYXRlT3JWaWV3IFRoZSB0ZW1wbGF0ZSAoZS5nLiBgVGVtcGxhdGUubXlUZW1wbGF0ZWApIG9yIFZpZXcgb2JqZWN0IGZyb20gd2hpY2ggdG8gZ2VuZXJhdGUgSFRNTC5cbiAqIEBwYXJhbSB7T2JqZWN0fEZ1bmN0aW9ufSBkYXRhIFRoZSBkYXRhIGNvbnRleHQgdG8gdXNlLCBvciBhIGZ1bmN0aW9uIHJldHVybmluZyBhIGRhdGEgY29udGV4dC5cbiAqL1xuQmxhemUudG9IVE1MV2l0aERhdGEgPSBmdW5jdGlvbiAoY29udGVudCwgZGF0YSwgcGFyZW50Vmlldykge1xuICBwYXJlbnRWaWV3ID0gcGFyZW50VmlldyB8fCBjdXJyZW50Vmlld0lmUmVuZGVyaW5nKCk7XG5cbiAgcmV0dXJuIEhUTUwudG9IVE1MKEJsYXplLl9leHBhbmRWaWV3KEJsYXplLl9UZW1wbGF0ZVdpdGgoXG4gICAgZGF0YSwgY29udGVudEFzRnVuYyhjb250ZW50KSksIHBhcmVudFZpZXcpKTtcbn07XG5cbkJsYXplLl90b1RleHQgPSBmdW5jdGlvbiAoaHRtbGpzLCBwYXJlbnRWaWV3LCB0ZXh0TW9kZSkge1xuICBpZiAodHlwZW9mIGh0bWxqcyA9PT0gJ2Z1bmN0aW9uJylcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJCbGF6ZS5fdG9UZXh0IGRvZXNuJ3QgdGFrZSBhIGZ1bmN0aW9uLCBqdXN0IEhUTUxqc1wiKTtcblxuICBpZiAoKHBhcmVudFZpZXcgIT0gbnVsbCkgJiYgISAocGFyZW50VmlldyBpbnN0YW5jZW9mIEJsYXplLlZpZXcpKSB7XG4gICAgLy8gb21pdHRlZCBwYXJlbnRWaWV3IGFyZ3VtZW50XG4gICAgdGV4dE1vZGUgPSBwYXJlbnRWaWV3O1xuICAgIHBhcmVudFZpZXcgPSBudWxsO1xuICB9XG4gIHBhcmVudFZpZXcgPSBwYXJlbnRWaWV3IHx8IGN1cnJlbnRWaWV3SWZSZW5kZXJpbmcoKTtcblxuICBpZiAoISB0ZXh0TW9kZSlcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJ0ZXh0TW9kZSByZXF1aXJlZFwiKTtcbiAgaWYgKCEgKHRleHRNb2RlID09PSBIVE1MLlRFWFRNT0RFLlNUUklORyB8fFxuICAgICAgICAgdGV4dE1vZGUgPT09IEhUTUwuVEVYVE1PREUuUkNEQVRBIHx8XG4gICAgICAgICB0ZXh0TW9kZSA9PT0gSFRNTC5URVhUTU9ERS5BVFRSSUJVVEUpKVxuICAgIHRocm93IG5ldyBFcnJvcihcIlVua25vd24gdGV4dE1vZGU6IFwiICsgdGV4dE1vZGUpO1xuXG4gIHJldHVybiBIVE1MLnRvVGV4dChCbGF6ZS5fZXhwYW5kKGh0bWxqcywgcGFyZW50VmlldyksIHRleHRNb2RlKTtcbn07XG5cbi8qKlxuICogQHN1bW1hcnkgUmV0dXJucyB0aGUgY3VycmVudCBkYXRhIGNvbnRleHQsIG9yIHRoZSBkYXRhIGNvbnRleHQgdGhhdCB3YXMgdXNlZCB3aGVuIHJlbmRlcmluZyBhIHBhcnRpY3VsYXIgRE9NIGVsZW1lbnQgb3IgVmlldyBmcm9tIGEgTWV0ZW9yIHRlbXBsYXRlLlxuICogQGxvY3VzIENsaWVudFxuICogQHBhcmFtIHtET01FbGVtZW50fEJsYXplLlZpZXd9IFtlbGVtZW50T3JWaWV3XSBPcHRpb25hbC4gIEFuIGVsZW1lbnQgdGhhdCB3YXMgcmVuZGVyZWQgYnkgYSBNZXRlb3IsIG9yIGEgVmlldy5cbiAqL1xuQmxhemUuZ2V0RGF0YSA9IGZ1bmN0aW9uIChlbGVtZW50T3JWaWV3KSB7XG4gIHZhciB0aGVXaXRoO1xuXG4gIGlmICghIGVsZW1lbnRPclZpZXcpIHtcbiAgICB0aGVXaXRoID0gQmxhemUuZ2V0Vmlldygnd2l0aCcpO1xuICB9IGVsc2UgaWYgKGVsZW1lbnRPclZpZXcgaW5zdGFuY2VvZiBCbGF6ZS5WaWV3KSB7XG4gICAgdmFyIHZpZXcgPSBlbGVtZW50T3JWaWV3O1xuICAgIHRoZVdpdGggPSAodmlldy5uYW1lID09PSAnd2l0aCcgPyB2aWV3IDpcbiAgICAgICAgICAgICAgIEJsYXplLmdldFZpZXcodmlldywgJ3dpdGgnKSk7XG4gIH0gZWxzZSBpZiAodHlwZW9mIGVsZW1lbnRPclZpZXcubm9kZVR5cGUgPT09ICdudW1iZXInKSB7XG4gICAgaWYgKGVsZW1lbnRPclZpZXcubm9kZVR5cGUgIT09IDEpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJFeHBlY3RlZCBET00gZWxlbWVudFwiKTtcbiAgICB0aGVXaXRoID0gQmxhemUuZ2V0VmlldyhlbGVtZW50T3JWaWV3LCAnd2l0aCcpO1xuICB9IGVsc2Uge1xuICAgIHRocm93IG5ldyBFcnJvcihcIkV4cGVjdGVkIERPTSBlbGVtZW50IG9yIFZpZXdcIik7XG4gIH1cblxuICByZXR1cm4gdGhlV2l0aCA/IHRoZVdpdGguZGF0YVZhci5nZXQoKSA6IG51bGw7XG59O1xuXG4vLyBGb3IgYmFjay1jb21wYXRcbkJsYXplLmdldEVsZW1lbnREYXRhID0gZnVuY3Rpb24gKGVsZW1lbnQpIHtcbiAgQmxhemUuX3dhcm4oXCJCbGF6ZS5nZXRFbGVtZW50RGF0YSBoYXMgYmVlbiBkZXByZWNhdGVkLiAgVXNlIFwiICtcbiAgICAgICAgICAgICAgXCJCbGF6ZS5nZXREYXRhKGVsZW1lbnQpIGluc3RlYWQuXCIpO1xuXG4gIGlmIChlbGVtZW50Lm5vZGVUeXBlICE9PSAxKVxuICAgIHRocm93IG5ldyBFcnJvcihcIkV4cGVjdGVkIERPTSBlbGVtZW50XCIpO1xuXG4gIHJldHVybiBCbGF6ZS5nZXREYXRhKGVsZW1lbnQpO1xufTtcblxuLy8gQm90aCBhcmd1bWVudHMgYXJlIG9wdGlvbmFsLlxuXG4vKipcbiAqIEBzdW1tYXJ5IEdldHMgZWl0aGVyIHRoZSBjdXJyZW50IFZpZXcsIG9yIHRoZSBWaWV3IGVuY2xvc2luZyB0aGUgZ2l2ZW4gRE9NIGVsZW1lbnQuXG4gKiBAbG9jdXMgQ2xpZW50XG4gKiBAcGFyYW0ge0RPTUVsZW1lbnR9IFtlbGVtZW50XSBPcHRpb25hbC4gIElmIHNwZWNpZmllZCwgdGhlIFZpZXcgZW5jbG9zaW5nIGBlbGVtZW50YCBpcyByZXR1cm5lZC5cbiAqL1xuQmxhemUuZ2V0VmlldyA9IGZ1bmN0aW9uIChlbGVtZW50T3JWaWV3LCBfdmlld05hbWUpIHtcbiAgdmFyIHZpZXdOYW1lID0gX3ZpZXdOYW1lO1xuXG4gIGlmICgodHlwZW9mIGVsZW1lbnRPclZpZXcpID09PSAnc3RyaW5nJykge1xuICAgIC8vIG9taXR0ZWQgZWxlbWVudE9yVmlldzsgdmlld05hbWUgcHJlc2VudFxuICAgIHZpZXdOYW1lID0gZWxlbWVudE9yVmlldztcbiAgICBlbGVtZW50T3JWaWV3ID0gbnVsbDtcbiAgfVxuXG4gIC8vIFdlIGNvdWxkIGV2ZW50dWFsbHkgc2hvcnRlbiB0aGUgY29kZSBieSBmb2xkaW5nIHRoZSBsb2dpY1xuICAvLyBmcm9tIHRoZSBvdGhlciBtZXRob2RzIGludG8gdGhpcyBtZXRob2QuXG4gIGlmICghIGVsZW1lbnRPclZpZXcpIHtcbiAgICByZXR1cm4gQmxhemUuX2dldEN1cnJlbnRWaWV3KHZpZXdOYW1lKTtcbiAgfSBlbHNlIGlmIChlbGVtZW50T3JWaWV3IGluc3RhbmNlb2YgQmxhemUuVmlldykge1xuICAgIHJldHVybiBCbGF6ZS5fZ2V0UGFyZW50VmlldyhlbGVtZW50T3JWaWV3LCB2aWV3TmFtZSk7XG4gIH0gZWxzZSBpZiAodHlwZW9mIGVsZW1lbnRPclZpZXcubm9kZVR5cGUgPT09ICdudW1iZXInKSB7XG4gICAgcmV0dXJuIEJsYXplLl9nZXRFbGVtZW50VmlldyhlbGVtZW50T3JWaWV3LCB2aWV3TmFtZSk7XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiRXhwZWN0ZWQgRE9NIGVsZW1lbnQgb3IgVmlld1wiKTtcbiAgfVxufTtcblxuLy8gR2V0cyB0aGUgY3VycmVudCB2aWV3IG9yIGl0cyBuZWFyZXN0IGFuY2VzdG9yIG9mIG5hbWVcbi8vIGBuYW1lYC5cbkJsYXplLl9nZXRDdXJyZW50VmlldyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gIHZhciB2aWV3ID0gQmxhemUuY3VycmVudFZpZXc7XG4gIC8vIEJldHRlciB0byBmYWlsIGluIGNhc2VzIHdoZXJlIGl0IGRvZXNuJ3QgbWFrZSBzZW5zZVxuICAvLyB0byB1c2UgQmxhemUuX2dldEN1cnJlbnRWaWV3KCkuICBUaGVyZSB3aWxsIGJlIGEgY3VycmVudFxuICAvLyB2aWV3IGFueXdoZXJlIGl0IGRvZXMuICBZb3UgY2FuIGNoZWNrIEJsYXplLmN1cnJlbnRWaWV3XG4gIC8vIGlmIHlvdSB3YW50IHRvIGtub3cgd2hldGhlciB0aGVyZSBpcyBvbmUgb3Igbm90LlxuICBpZiAoISB2aWV3KVxuICAgIHRocm93IG5ldyBFcnJvcihcIlRoZXJlIGlzIG5vIGN1cnJlbnQgdmlld1wiKTtcblxuICBpZiAobmFtZSkge1xuICAgIHdoaWxlICh2aWV3ICYmIHZpZXcubmFtZSAhPT0gbmFtZSlcbiAgICAgIHZpZXcgPSB2aWV3LnBhcmVudFZpZXc7XG4gICAgcmV0dXJuIHZpZXcgfHwgbnVsbDtcbiAgfSBlbHNlIHtcbiAgICAvLyBCbGF6ZS5fZ2V0Q3VycmVudFZpZXcoKSB3aXRoIG5vIGFyZ3VtZW50cyBqdXN0IHJldHVybnNcbiAgICAvLyBCbGF6ZS5jdXJyZW50Vmlldy5cbiAgICByZXR1cm4gdmlldztcbiAgfVxufTtcblxuQmxhemUuX2dldFBhcmVudFZpZXcgPSBmdW5jdGlvbiAodmlldywgbmFtZSkge1xuICB2YXIgdiA9IHZpZXcucGFyZW50VmlldztcblxuICBpZiAobmFtZSkge1xuICAgIHdoaWxlICh2ICYmIHYubmFtZSAhPT0gbmFtZSlcbiAgICAgIHYgPSB2LnBhcmVudFZpZXc7XG4gIH1cblxuICByZXR1cm4gdiB8fCBudWxsO1xufTtcblxuQmxhemUuX2dldEVsZW1lbnRWaWV3ID0gZnVuY3Rpb24gKGVsZW0sIG5hbWUpIHtcbiAgdmFyIHJhbmdlID0gQmxhemUuX0RPTVJhbmdlLmZvckVsZW1lbnQoZWxlbSk7XG4gIHZhciB2aWV3ID0gbnVsbDtcbiAgd2hpbGUgKHJhbmdlICYmICEgdmlldykge1xuICAgIHZpZXcgPSAocmFuZ2UudmlldyB8fCBudWxsKTtcbiAgICBpZiAoISB2aWV3KSB7XG4gICAgICBpZiAocmFuZ2UucGFyZW50UmFuZ2UpXG4gICAgICAgIHJhbmdlID0gcmFuZ2UucGFyZW50UmFuZ2U7XG4gICAgICBlbHNlXG4gICAgICAgIHJhbmdlID0gQmxhemUuX0RPTVJhbmdlLmZvckVsZW1lbnQocmFuZ2UucGFyZW50RWxlbWVudCk7XG4gICAgfVxuICB9XG5cbiAgaWYgKG5hbWUpIHtcbiAgICB3aGlsZSAodmlldyAmJiB2aWV3Lm5hbWUgIT09IG5hbWUpXG4gICAgICB2aWV3ID0gdmlldy5wYXJlbnRWaWV3O1xuICAgIHJldHVybiB2aWV3IHx8IG51bGw7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHZpZXc7XG4gIH1cbn07XG5cbkJsYXplLl9hZGRFdmVudE1hcCA9IGZ1bmN0aW9uICh2aWV3LCBldmVudE1hcCwgdGhpc0luSGFuZGxlcikge1xuICB0aGlzSW5IYW5kbGVyID0gKHRoaXNJbkhhbmRsZXIgfHwgbnVsbCk7XG4gIHZhciBoYW5kbGVzID0gW107XG5cbiAgaWYgKCEgdmlldy5fZG9tcmFuZ2UpXG4gICAgdGhyb3cgbmV3IEVycm9yKFwiVmlldyBtdXN0IGhhdmUgYSBET01SYW5nZVwiKTtcblxuICB2aWV3Ll9kb21yYW5nZS5vbkF0dGFjaGVkKGZ1bmN0aW9uIGF0dGFjaGVkX2V2ZW50TWFwcyhyYW5nZSwgZWxlbWVudCkge1xuICAgIE9iamVjdC5rZXlzKGV2ZW50TWFwKS5mb3JFYWNoKGZ1bmN0aW9uIChzcGVjKSB7XG4gICAgICBsZXQgaGFuZGxlciA9IGV2ZW50TWFwW3NwZWNdO1xuICAgICAgdmFyIGNsYXVzZXMgPSBzcGVjLnNwbGl0KC8sXFxzKy8pO1xuICAgICAgLy8gaXRlcmF0ZSBvdmVyIGNsYXVzZXMgb2Ygc3BlYywgZS5nLiBbJ2NsaWNrIC5mb28nLCAnY2xpY2sgLmJhciddXG4gICAgICBjbGF1c2VzLmZvckVhY2goZnVuY3Rpb24gKGNsYXVzZSkge1xuICAgICAgICB2YXIgcGFydHMgPSBjbGF1c2Uuc3BsaXQoL1xccysvKTtcbiAgICAgICAgaWYgKHBhcnRzLmxlbmd0aCA9PT0gMClcbiAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdmFyIG5ld0V2ZW50cyA9IHBhcnRzLnNoaWZ0KCk7XG4gICAgICAgIHZhciBzZWxlY3RvciA9IHBhcnRzLmpvaW4oJyAnKTtcbiAgICAgICAgaGFuZGxlcy5wdXNoKEJsYXplLl9FdmVudFN1cHBvcnQubGlzdGVuKFxuICAgICAgICAgIGVsZW1lbnQsIG5ld0V2ZW50cywgc2VsZWN0b3IsXG4gICAgICAgICAgZnVuY3Rpb24gKGV2dCkge1xuICAgICAgICAgICAgaWYgKCEgcmFuZ2UuY29udGFpbnNFbGVtZW50KGV2dC5jdXJyZW50VGFyZ2V0KSlcbiAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB2YXIgaGFuZGxlclRoaXMgPSB0aGlzSW5IYW5kbGVyIHx8IHRoaXM7XG4gICAgICAgICAgICB2YXIgaGFuZGxlckFyZ3MgPSBhcmd1bWVudHM7XG4gICAgICAgICAgICByZXR1cm4gQmxhemUuX3dpdGhDdXJyZW50Vmlldyh2aWV3LCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgIHJldHVybiBoYW5kbGVyLmFwcGx5KGhhbmRsZXJUaGlzLCBoYW5kbGVyQXJncyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9LFxuICAgICAgICAgIHJhbmdlLCBmdW5jdGlvbiAocikge1xuICAgICAgICAgICAgcmV0dXJuIHIucGFyZW50UmFuZ2U7XG4gICAgICAgICAgfSkpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH0pO1xuXG4gIHZpZXcub25WaWV3RGVzdHJveWVkKGZ1bmN0aW9uICgpIHtcbiAgICBoYW5kbGVzLmZvckVhY2goZnVuY3Rpb24gKGgpIHtcbiAgICAgIGguc3RvcCgpO1xuICAgIH0pO1xuICAgIGhhbmRsZXMubGVuZ3RoID0gMDtcbiAgfSk7XG59O1xuIiwiaW1wb3J0IGhhcyBmcm9tICdsb2Rhc2guaGFzJztcbmltcG9ydCBpc09iamVjdCBmcm9tICdsb2Rhc2guaXNvYmplY3QnO1xuXG5CbGF6ZS5fY2FsY3VsYXRlQ29uZGl0aW9uID0gZnVuY3Rpb24gKGNvbmQpIHtcbiAgaWYgKEhUTUwuaXNBcnJheShjb25kKSAmJiBjb25kLmxlbmd0aCA9PT0gMClcbiAgICBjb25kID0gZmFsc2U7XG4gIHJldHVybiAhISBjb25kO1xufTtcblxuLyoqXG4gKiBAc3VtbWFyeSBDb25zdHJ1Y3RzIGEgVmlldyB0aGF0IHJlbmRlcnMgY29udGVudCB3aXRoIGEgZGF0YSBjb250ZXh0LlxuICogQGxvY3VzIENsaWVudFxuICogQHBhcmFtIHtPYmplY3R8RnVuY3Rpb259IGRhdGEgQW4gb2JqZWN0IHRvIHVzZSBhcyB0aGUgZGF0YSBjb250ZXh0LCBvciBhIGZ1bmN0aW9uIHJldHVybmluZyBzdWNoIGFuIG9iamVjdC4gIElmIGEgZnVuY3Rpb24gaXMgcHJvdmlkZWQsIGl0IHdpbGwgYmUgcmVhY3RpdmVseSByZS1ydW4uXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjb250ZW50RnVuYyBBIEZ1bmN0aW9uIHRoYXQgcmV0dXJucyBbKnJlbmRlcmFibGUgY29udGVudCpdKCNSZW5kZXJhYmxlLUNvbnRlbnQpLlxuICovXG5CbGF6ZS5XaXRoID0gZnVuY3Rpb24gKGRhdGEsIGNvbnRlbnRGdW5jKSB7XG4gIHZhciB2aWV3ID0gQmxhemUuVmlldygnd2l0aCcsIGNvbnRlbnRGdW5jKTtcblxuICB2aWV3LmRhdGFWYXIgPSBuZXcgUmVhY3RpdmVWYXI7XG5cbiAgdmlldy5vblZpZXdDcmVhdGVkKGZ1bmN0aW9uICgpIHtcbiAgICBpZiAodHlwZW9mIGRhdGEgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIC8vIGBkYXRhYCBpcyBhIHJlYWN0aXZlIGZ1bmN0aW9uXG4gICAgICB2aWV3LmF1dG9ydW4oZnVuY3Rpb24gKCkge1xuICAgICAgICB2aWV3LmRhdGFWYXIuc2V0KGRhdGEoKSk7XG4gICAgICB9LCB2aWV3LnBhcmVudFZpZXcsICdzZXREYXRhJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZpZXcuZGF0YVZhci5zZXQoZGF0YSk7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gdmlldztcbn07XG5cbi8qKlxuICogQXR0YWNoZXMgYmluZGluZ3MgdG8gdGhlIGluc3RhbnRpYXRlZCB2aWV3LlxuICogQHBhcmFtIHtPYmplY3R9IGJpbmRpbmdzIEEgZGljdGlvbmFyeSBvZiBiaW5kaW5ncywgZWFjaCBiaW5kaW5nIG5hbWVcbiAqIGNvcnJlc3BvbmRzIHRvIGEgdmFsdWUgb3IgYSBmdW5jdGlvbiB0aGF0IHdpbGwgYmUgcmVhY3RpdmVseSByZS1ydW4uXG4gKiBAcGFyYW0ge1ZpZXd9IHZpZXcgVGhlIHRhcmdldC5cbiAqL1xuQmxhemUuX2F0dGFjaEJpbmRpbmdzVG9WaWV3ID0gZnVuY3Rpb24gKGJpbmRpbmdzLCB2aWV3KSB7XG4gIHZpZXcub25WaWV3Q3JlYXRlZChmdW5jdGlvbiAoKSB7XG4gICAgT2JqZWN0LmVudHJpZXMoYmluZGluZ3MpLmZvckVhY2goZnVuY3Rpb24gKFtuYW1lLCBiaW5kaW5nXSkge1xuICAgICAgdmlldy5fc2NvcGVCaW5kaW5nc1tuYW1lXSA9IG5ldyBSZWFjdGl2ZVZhcigpO1xuICAgICAgaWYgKHR5cGVvZiBiaW5kaW5nID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHZpZXcuYXV0b3J1bihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgdmlldy5fc2NvcGVCaW5kaW5nc1tuYW1lXS5zZXQoYmluZGluZygpKTtcbiAgICAgICAgfSwgdmlldy5wYXJlbnRWaWV3KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZpZXcuX3Njb3BlQmluZGluZ3NbbmFtZV0uc2V0KGJpbmRpbmcpO1xuICAgICAgfVxuICAgIH0pO1xuICB9KTtcbn07XG5cbi8qKlxuICogQHN1bW1hcnkgQ29uc3RydWN0cyBhIFZpZXcgc2V0dGluZyB0aGUgbG9jYWwgbGV4aWNhbCBzY29wZSBpbiB0aGUgYmxvY2suXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBiaW5kaW5ncyBEaWN0aW9uYXJ5IG1hcHBpbmcgbmFtZXMgb2YgYmluZGluZ3MgdG9cbiAqIHZhbHVlcyBvciBjb21wdXRhdGlvbnMgdG8gcmVhY3RpdmVseSByZS1ydW4uXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjb250ZW50RnVuYyBBIEZ1bmN0aW9uIHRoYXQgcmV0dXJucyBbKnJlbmRlcmFibGUgY29udGVudCpdKCNSZW5kZXJhYmxlLUNvbnRlbnQpLlxuICovXG5CbGF6ZS5MZXQgPSBmdW5jdGlvbiAoYmluZGluZ3MsIGNvbnRlbnRGdW5jKSB7XG4gIHZhciB2aWV3ID0gQmxhemUuVmlldygnbGV0JywgY29udGVudEZ1bmMpO1xuICBCbGF6ZS5fYXR0YWNoQmluZGluZ3NUb1ZpZXcoYmluZGluZ3MsIHZpZXcpO1xuXG4gIHJldHVybiB2aWV3O1xufTtcblxuLyoqXG4gKiBAc3VtbWFyeSBDb25zdHJ1Y3RzIGEgVmlldyB0aGF0IHJlbmRlcnMgY29udGVudCBjb25kaXRpb25hbGx5LlxuICogQGxvY3VzIENsaWVudFxuICogQHBhcmFtIHtGdW5jdGlvbn0gY29uZGl0aW9uRnVuYyBBIGZ1bmN0aW9uIHRvIHJlYWN0aXZlbHkgcmUtcnVuLiAgV2hldGhlciB0aGUgcmVzdWx0IGlzIHRydXRoeSBvciBmYWxzeSBkZXRlcm1pbmVzIHdoZXRoZXIgYGNvbnRlbnRGdW5jYCBvciBgZWxzZUZ1bmNgIGlzIHNob3duLiAgQW4gZW1wdHkgYXJyYXkgaXMgY29uc2lkZXJlZCBmYWxzeS5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNvbnRlbnRGdW5jIEEgRnVuY3Rpb24gdGhhdCByZXR1cm5zIFsqcmVuZGVyYWJsZSBjb250ZW50Kl0oI1JlbmRlcmFibGUtQ29udGVudCkuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBbZWxzZUZ1bmNdIE9wdGlvbmFsLiAgQSBGdW5jdGlvbiB0aGF0IHJldHVybnMgWypyZW5kZXJhYmxlIGNvbnRlbnQqXSgjUmVuZGVyYWJsZS1Db250ZW50KS4gIElmIG5vIGBlbHNlRnVuY2AgaXMgc3VwcGxpZWQsIG5vIGNvbnRlbnQgaXMgc2hvd24gaW4gdGhlIFwiZWxzZVwiIGNhc2UuXG4gKi9cbkJsYXplLklmID0gZnVuY3Rpb24gKGNvbmRpdGlvbkZ1bmMsIGNvbnRlbnRGdW5jLCBlbHNlRnVuYywgX25vdCkge1xuICB2YXIgY29uZGl0aW9uVmFyID0gbmV3IFJlYWN0aXZlVmFyO1xuXG4gIHZhciB2aWV3ID0gQmxhemUuVmlldyhfbm90ID8gJ3VubGVzcycgOiAnaWYnLCBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIGNvbmRpdGlvblZhci5nZXQoKSA/IGNvbnRlbnRGdW5jKCkgOlxuICAgICAgKGVsc2VGdW5jID8gZWxzZUZ1bmMoKSA6IG51bGwpO1xuICB9KTtcbiAgdmlldy5fX2NvbmRpdGlvblZhciA9IGNvbmRpdGlvblZhcjtcbiAgdmlldy5vblZpZXdDcmVhdGVkKGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmF1dG9ydW4oZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIGNvbmQgPSBCbGF6ZS5fY2FsY3VsYXRlQ29uZGl0aW9uKGNvbmRpdGlvbkZ1bmMoKSk7XG4gICAgICBjb25kaXRpb25WYXIuc2V0KF9ub3QgPyAoISBjb25kKSA6IGNvbmQpO1xuICAgIH0sIHRoaXMucGFyZW50VmlldywgJ2NvbmRpdGlvbicpO1xuICB9KTtcblxuICByZXR1cm4gdmlldztcbn07XG5cbi8qKlxuICogQHN1bW1hcnkgQW4gaW52ZXJ0ZWQgW2BCbGF6ZS5JZmBdKCNCbGF6ZS1JZikuXG4gKiBAbG9jdXMgQ2xpZW50XG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjb25kaXRpb25GdW5jIEEgZnVuY3Rpb24gdG8gcmVhY3RpdmVseSByZS1ydW4uICBJZiB0aGUgcmVzdWx0IGlzIGZhbHN5LCBgY29udGVudEZ1bmNgIGlzIHNob3duLCBvdGhlcndpc2UgYGVsc2VGdW5jYCBpcyBzaG93bi4gIEFuIGVtcHR5IGFycmF5IGlzIGNvbnNpZGVyZWQgZmFsc3kuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjb250ZW50RnVuYyBBIEZ1bmN0aW9uIHRoYXQgcmV0dXJucyBbKnJlbmRlcmFibGUgY29udGVudCpdKCNSZW5kZXJhYmxlLUNvbnRlbnQpLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gW2Vsc2VGdW5jXSBPcHRpb25hbC4gIEEgRnVuY3Rpb24gdGhhdCByZXR1cm5zIFsqcmVuZGVyYWJsZSBjb250ZW50Kl0oI1JlbmRlcmFibGUtQ29udGVudCkuICBJZiBubyBgZWxzZUZ1bmNgIGlzIHN1cHBsaWVkLCBubyBjb250ZW50IGlzIHNob3duIGluIHRoZSBcImVsc2VcIiBjYXNlLlxuICovXG5CbGF6ZS5Vbmxlc3MgPSBmdW5jdGlvbiAoY29uZGl0aW9uRnVuYywgY29udGVudEZ1bmMsIGVsc2VGdW5jKSB7XG4gIHJldHVybiBCbGF6ZS5JZihjb25kaXRpb25GdW5jLCBjb250ZW50RnVuYywgZWxzZUZ1bmMsIHRydWUgLypfbm90Ki8pO1xufTtcblxuLyoqXG4gKiBAc3VtbWFyeSBDb25zdHJ1Y3RzIGEgVmlldyB0aGF0IHJlbmRlcnMgYGNvbnRlbnRGdW5jYCBmb3IgZWFjaCBpdGVtIGluIGEgc2VxdWVuY2UuXG4gKiBAbG9jdXMgQ2xpZW50XG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBhcmdGdW5jIEEgZnVuY3Rpb24gdG8gcmVhY3RpdmVseSByZS1ydW4uIFRoZSBmdW5jdGlvbiBjYW5cbiAqIHJldHVybiBvbmUgb2YgdHdvIG9wdGlvbnM6XG4gKlxuICogMS4gQW4gb2JqZWN0IHdpdGggdHdvIGZpZWxkczogJ192YXJpYWJsZScgYW5kICdfc2VxdWVuY2UnLiBFYWNoIGl0ZXJhdGVzIG92ZXJcbiAqICAgJ19zZXF1ZW5jZScsIGl0IG1heSBiZSBhIEN1cnNvciwgYW4gYXJyYXksIG51bGwsIG9yIHVuZGVmaW5lZC4gSW5zaWRlIHRoZVxuICogICBFYWNoIGJvZHkgeW91IHdpbGwgYmUgYWJsZSB0byBnZXQgdGhlIGN1cnJlbnQgaXRlbSBmcm9tIHRoZSBzZXF1ZW5jZSB1c2luZ1xuICogICB0aGUgbmFtZSBzcGVjaWZpZWQgaW4gdGhlICdfdmFyaWFibGUnIGZpZWxkLlxuICpcbiAqIDIuIEp1c3QgYSBzZXF1ZW5jZSAoQ3Vyc29yLCBhcnJheSwgbnVsbCwgb3IgdW5kZWZpbmVkKSBub3Qgd3JhcHBlZCBpbnRvIGFuXG4gKiAgIG9iamVjdC4gSW5zaWRlIHRoZSBFYWNoIGJvZHksIHRoZSBjdXJyZW50IGl0ZW0gd2lsbCBiZSBzZXQgYXMgdGhlIGRhdGFcbiAqICAgY29udGV4dC5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNvbnRlbnRGdW5jIEEgRnVuY3Rpb24gdGhhdCByZXR1cm5zICBbKnJlbmRlcmFibGVcbiAqIGNvbnRlbnQqXSgjUmVuZGVyYWJsZS1Db250ZW50KS5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IFtlbHNlRnVuY10gQSBGdW5jdGlvbiB0aGF0IHJldHVybnMgWypyZW5kZXJhYmxlXG4gKiBjb250ZW50Kl0oI1JlbmRlcmFibGUtQ29udGVudCkgdG8gZGlzcGxheSBpbiB0aGUgY2FzZSB3aGVuIHRoZXJlIGFyZSBubyBpdGVtc1xuICogaW4gdGhlIHNlcXVlbmNlLlxuICovXG5CbGF6ZS5FYWNoID0gZnVuY3Rpb24gKGFyZ0Z1bmMsIGNvbnRlbnRGdW5jLCBlbHNlRnVuYykge1xuICB2YXIgZWFjaFZpZXcgPSBCbGF6ZS5WaWV3KCdlYWNoJywgZnVuY3Rpb24gKCkge1xuICAgIHZhciBzdWJ2aWV3cyA9IHRoaXMuaW5pdGlhbFN1YnZpZXdzO1xuICAgIHRoaXMuaW5pdGlhbFN1YnZpZXdzID0gbnVsbDtcbiAgICBpZiAodGhpcy5faXNDcmVhdGVkRm9yRXhwYW5zaW9uKSB7XG4gICAgICB0aGlzLmV4cGFuZGVkVmFsdWVEZXAgPSBuZXcgVHJhY2tlci5EZXBlbmRlbmN5O1xuICAgICAgdGhpcy5leHBhbmRlZFZhbHVlRGVwLmRlcGVuZCgpO1xuICAgIH1cbiAgICByZXR1cm4gc3Vidmlld3M7XG4gIH0pO1xuICBlYWNoVmlldy5pbml0aWFsU3Vidmlld3MgPSBbXTtcbiAgZWFjaFZpZXcubnVtSXRlbXMgPSAwO1xuICBlYWNoVmlldy5pbkVsc2VNb2RlID0gZmFsc2U7XG4gIGVhY2hWaWV3LnN0b3BIYW5kbGUgPSBudWxsO1xuICBlYWNoVmlldy5jb250ZW50RnVuYyA9IGNvbnRlbnRGdW5jO1xuICBlYWNoVmlldy5lbHNlRnVuYyA9IGVsc2VGdW5jO1xuICBlYWNoVmlldy5hcmdWYXIgPSBuZXcgUmVhY3RpdmVWYXI7XG4gIGVhY2hWaWV3LnZhcmlhYmxlTmFtZSA9IG51bGw7XG5cbiAgLy8gdXBkYXRlIHRoZSBAaW5kZXggdmFsdWUgaW4gdGhlIHNjb3BlIG9mIGFsbCBzdWJ2aWV3cyBpbiB0aGUgcmFuZ2VcbiAgdmFyIHVwZGF0ZUluZGljZXMgPSBmdW5jdGlvbiAoZnJvbSwgdG8pIHtcbiAgICBpZiAodG8gPT09IHVuZGVmaW5lZCkge1xuICAgICAgdG8gPSBlYWNoVmlldy5udW1JdGVtcyAtIDE7XG4gICAgfVxuXG4gICAgZm9yICh2YXIgaSA9IGZyb207IGkgPD0gdG87IGkrKykge1xuICAgICAgdmFyIHZpZXcgPSBlYWNoVmlldy5fZG9tcmFuZ2UubWVtYmVyc1tpXS52aWV3O1xuICAgICAgdmlldy5fc2NvcGVCaW5kaW5nc1snQGluZGV4J10uc2V0KGkpO1xuICAgIH1cbiAgfTtcblxuICBlYWNoVmlldy5vblZpZXdDcmVhdGVkKGZ1bmN0aW9uICgpIHtcbiAgICAvLyBXZSBldmFsdWF0ZSBhcmdGdW5jIGluIGFuIGF1dG9ydW4gdG8gbWFrZSBzdXJlXG4gICAgLy8gQmxhemUuY3VycmVudFZpZXcgaXMgYWx3YXlzIHNldCB3aGVuIGl0IHJ1bnMgKHJhdGhlciB0aGFuXG4gICAgLy8gcGFzc2luZyBhcmdGdW5jIHN0cmFpZ2h0IHRvIE9ic2VydmVTZXF1ZW5jZSkuXG4gICAgZWFjaFZpZXcuYXV0b3J1bihmdW5jdGlvbiAoKSB7XG4gICAgICAvLyBhcmdGdW5jIGNhbiByZXR1cm4gZWl0aGVyIGEgc2VxdWVuY2UgYXMgaXMgb3IgYSB3cmFwcGVyIG9iamVjdCB3aXRoIGFcbiAgICAgIC8vIF9zZXF1ZW5jZSBhbmQgX3ZhcmlhYmxlIGZpZWxkcyBzZXQuXG4gICAgICB2YXIgYXJnID0gYXJnRnVuYygpO1xuICAgICAgaWYgKGlzT2JqZWN0KGFyZykgJiYgaGFzKGFyZywgJ19zZXF1ZW5jZScpKSB7XG4gICAgICAgIGVhY2hWaWV3LnZhcmlhYmxlTmFtZSA9IGFyZy5fdmFyaWFibGUgfHwgbnVsbDtcbiAgICAgICAgYXJnID0gYXJnLl9zZXF1ZW5jZTtcbiAgICAgIH1cblxuICAgICAgZWFjaFZpZXcuYXJnVmFyLnNldChhcmcpO1xuICAgIH0sIGVhY2hWaWV3LnBhcmVudFZpZXcsICdjb2xsZWN0aW9uJyk7XG5cbiAgICBlYWNoVmlldy5zdG9wSGFuZGxlID0gT2JzZXJ2ZVNlcXVlbmNlLm9ic2VydmUoZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIGVhY2hWaWV3LmFyZ1Zhci5nZXQoKTtcbiAgICB9LCB7XG4gICAgICBhZGRlZEF0OiBmdW5jdGlvbiAoaWQsIGl0ZW0sIGluZGV4KSB7XG4gICAgICAgIFRyYWNrZXIubm9ucmVhY3RpdmUoZnVuY3Rpb24gKCkge1xuICAgICAgICAgIHZhciBuZXdJdGVtVmlldztcbiAgICAgICAgICBpZiAoZWFjaFZpZXcudmFyaWFibGVOYW1lKSB7XG4gICAgICAgICAgICAvLyBuZXctc3R5bGUgI2VhY2ggKGFzIGluIHt7I2VhY2ggaXRlbSBpbiBpdGVtc319KVxuICAgICAgICAgICAgLy8gZG9lc24ndCBjcmVhdGUgYSBuZXcgZGF0YSBjb250ZXh0XG4gICAgICAgICAgICBuZXdJdGVtVmlldyA9IEJsYXplLlZpZXcoJ2l0ZW0nLCBlYWNoVmlldy5jb250ZW50RnVuYyk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG5ld0l0ZW1WaWV3ID0gQmxhemUuV2l0aChpdGVtLCBlYWNoVmlldy5jb250ZW50RnVuYyk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgZWFjaFZpZXcubnVtSXRlbXMrKztcblxuICAgICAgICAgIHZhciBiaW5kaW5ncyA9IHt9O1xuICAgICAgICAgIGJpbmRpbmdzWydAaW5kZXgnXSA9IGluZGV4O1xuICAgICAgICAgIGlmIChlYWNoVmlldy52YXJpYWJsZU5hbWUpIHtcbiAgICAgICAgICAgIGJpbmRpbmdzW2VhY2hWaWV3LnZhcmlhYmxlTmFtZV0gPSBpdGVtO1xuICAgICAgICAgIH1cbiAgICAgICAgICBCbGF6ZS5fYXR0YWNoQmluZGluZ3NUb1ZpZXcoYmluZGluZ3MsIG5ld0l0ZW1WaWV3KTtcblxuICAgICAgICAgIGlmIChlYWNoVmlldy5leHBhbmRlZFZhbHVlRGVwKSB7XG4gICAgICAgICAgICBlYWNoVmlldy5leHBhbmRlZFZhbHVlRGVwLmNoYW5nZWQoKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGVhY2hWaWV3Ll9kb21yYW5nZSkge1xuICAgICAgICAgICAgaWYgKGVhY2hWaWV3LmluRWxzZU1vZGUpIHtcbiAgICAgICAgICAgICAgZWFjaFZpZXcuX2RvbXJhbmdlLnJlbW92ZU1lbWJlcigwKTtcbiAgICAgICAgICAgICAgZWFjaFZpZXcuaW5FbHNlTW9kZSA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgcmFuZ2UgPSBCbGF6ZS5fbWF0ZXJpYWxpemVWaWV3KG5ld0l0ZW1WaWV3LCBlYWNoVmlldyk7XG4gICAgICAgICAgICBlYWNoVmlldy5fZG9tcmFuZ2UuYWRkTWVtYmVyKHJhbmdlLCBpbmRleCk7XG4gICAgICAgICAgICB1cGRhdGVJbmRpY2VzKGluZGV4KTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZWFjaFZpZXcuaW5pdGlhbFN1YnZpZXdzLnNwbGljZShpbmRleCwgMCwgbmV3SXRlbVZpZXcpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9LFxuICAgICAgcmVtb3ZlZEF0OiBmdW5jdGlvbiAoaWQsIGl0ZW0sIGluZGV4KSB7XG4gICAgICAgIFRyYWNrZXIubm9ucmVhY3RpdmUoZnVuY3Rpb24gKCkge1xuICAgICAgICAgIGVhY2hWaWV3Lm51bUl0ZW1zLS07XG4gICAgICAgICAgaWYgKGVhY2hWaWV3LmV4cGFuZGVkVmFsdWVEZXApIHtcbiAgICAgICAgICAgIGVhY2hWaWV3LmV4cGFuZGVkVmFsdWVEZXAuY2hhbmdlZCgpO1xuICAgICAgICAgIH0gZWxzZSBpZiAoZWFjaFZpZXcuX2RvbXJhbmdlKSB7XG4gICAgICAgICAgICBlYWNoVmlldy5fZG9tcmFuZ2UucmVtb3ZlTWVtYmVyKGluZGV4KTtcbiAgICAgICAgICAgIHVwZGF0ZUluZGljZXMoaW5kZXgpO1xuICAgICAgICAgICAgaWYgKGVhY2hWaWV3LmVsc2VGdW5jICYmIGVhY2hWaWV3Lm51bUl0ZW1zID09PSAwKSB7XG4gICAgICAgICAgICAgIGVhY2hWaWV3LmluRWxzZU1vZGUgPSB0cnVlO1xuICAgICAgICAgICAgICBlYWNoVmlldy5fZG9tcmFuZ2UuYWRkTWVtYmVyKFxuICAgICAgICAgICAgICAgIEJsYXplLl9tYXRlcmlhbGl6ZVZpZXcoXG4gICAgICAgICAgICAgICAgICBCbGF6ZS5WaWV3KCdlYWNoX2Vsc2UnLGVhY2hWaWV3LmVsc2VGdW5jKSxcbiAgICAgICAgICAgICAgICAgIGVhY2hWaWV3KSwgMCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGVhY2hWaWV3LmluaXRpYWxTdWJ2aWV3cy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9LFxuICAgICAgY2hhbmdlZEF0OiBmdW5jdGlvbiAoaWQsIG5ld0l0ZW0sIG9sZEl0ZW0sIGluZGV4KSB7XG4gICAgICAgIFRyYWNrZXIubm9ucmVhY3RpdmUoZnVuY3Rpb24gKCkge1xuICAgICAgICAgIGlmIChlYWNoVmlldy5leHBhbmRlZFZhbHVlRGVwKSB7XG4gICAgICAgICAgICBlYWNoVmlldy5leHBhbmRlZFZhbHVlRGVwLmNoYW5nZWQoKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdmFyIGl0ZW1WaWV3O1xuICAgICAgICAgICAgaWYgKGVhY2hWaWV3Ll9kb21yYW5nZSkge1xuICAgICAgICAgICAgICBpdGVtVmlldyA9IGVhY2hWaWV3Ll9kb21yYW5nZS5nZXRNZW1iZXIoaW5kZXgpLnZpZXc7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBpdGVtVmlldyA9IGVhY2hWaWV3LmluaXRpYWxTdWJ2aWV3c1tpbmRleF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoZWFjaFZpZXcudmFyaWFibGVOYW1lKSB7XG4gICAgICAgICAgICAgIGl0ZW1WaWV3Ll9zY29wZUJpbmRpbmdzW2VhY2hWaWV3LnZhcmlhYmxlTmFtZV0uc2V0KG5ld0l0ZW0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgaXRlbVZpZXcuZGF0YVZhci5zZXQobmV3SXRlbSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH0sXG4gICAgICBtb3ZlZFRvOiBmdW5jdGlvbiAoaWQsIGl0ZW0sIGZyb21JbmRleCwgdG9JbmRleCkge1xuICAgICAgICBUcmFja2VyLm5vbnJlYWN0aXZlKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICBpZiAoZWFjaFZpZXcuZXhwYW5kZWRWYWx1ZURlcCkge1xuICAgICAgICAgICAgZWFjaFZpZXcuZXhwYW5kZWRWYWx1ZURlcC5jaGFuZ2VkKCk7XG4gICAgICAgICAgfSBlbHNlIGlmIChlYWNoVmlldy5fZG9tcmFuZ2UpIHtcbiAgICAgICAgICAgIGVhY2hWaWV3Ll9kb21yYW5nZS5tb3ZlTWVtYmVyKGZyb21JbmRleCwgdG9JbmRleCk7XG4gICAgICAgICAgICB1cGRhdGVJbmRpY2VzKFxuICAgICAgICAgICAgICBNYXRoLm1pbihmcm9tSW5kZXgsIHRvSW5kZXgpLCBNYXRoLm1heChmcm9tSW5kZXgsIHRvSW5kZXgpKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdmFyIHN1YnZpZXdzID0gZWFjaFZpZXcuaW5pdGlhbFN1YnZpZXdzO1xuICAgICAgICAgICAgdmFyIGl0ZW1WaWV3ID0gc3Vidmlld3NbZnJvbUluZGV4XTtcbiAgICAgICAgICAgIHN1YnZpZXdzLnNwbGljZShmcm9tSW5kZXgsIDEpO1xuICAgICAgICAgICAgc3Vidmlld3Muc3BsaWNlKHRvSW5kZXgsIDAsIGl0ZW1WaWV3KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgaWYgKGVhY2hWaWV3LmVsc2VGdW5jICYmIGVhY2hWaWV3Lm51bUl0ZW1zID09PSAwKSB7XG4gICAgICBlYWNoVmlldy5pbkVsc2VNb2RlID0gdHJ1ZTtcbiAgICAgIGVhY2hWaWV3LmluaXRpYWxTdWJ2aWV3c1swXSA9XG4gICAgICAgIEJsYXplLlZpZXcoJ2VhY2hfZWxzZScsIGVhY2hWaWV3LmVsc2VGdW5jKTtcbiAgICB9XG4gIH0pO1xuXG4gIGVhY2hWaWV3Lm9uVmlld0Rlc3Ryb3llZChmdW5jdGlvbiAoKSB7XG4gICAgaWYgKGVhY2hWaWV3LnN0b3BIYW5kbGUpXG4gICAgICBlYWNoVmlldy5zdG9wSGFuZGxlLnN0b3AoKTtcbiAgfSk7XG5cbiAgcmV0dXJuIGVhY2hWaWV3O1xufTtcblxuQmxhemUuX1RlbXBsYXRlV2l0aCA9IGZ1bmN0aW9uIChhcmcsIGNvbnRlbnRGdW5jKSB7XG4gIHZhciB3O1xuXG4gIHZhciBhcmdGdW5jID0gYXJnO1xuICBpZiAodHlwZW9mIGFyZyAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIGFyZ0Z1bmMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gYXJnO1xuICAgIH07XG4gIH1cblxuICAvLyBUaGlzIGlzIGEgbGl0dGxlIG1lc3N5LiAgV2hlbiB3ZSBjb21waWxlIGB7ez4gVGVtcGxhdGUuY29udGVudEJsb2NrfX1gLCB3ZVxuICAvLyB3cmFwIGl0IGluIEJsYXplLl9Jbk91dGVyVGVtcGxhdGVTY29wZSBpbiBvcmRlciB0byBza2lwIHRoZSBpbnRlcm1lZGlhdGVcbiAgLy8gcGFyZW50IFZpZXdzIGluIHRoZSBjdXJyZW50IHRlbXBsYXRlLiAgSG93ZXZlciwgd2hlbiB0aGVyZSdzIGFuIGFyZ3VtZW50XG4gIC8vIChge3s+IFRlbXBsYXRlLmNvbnRlbnRCbG9jayBhcmd9fWApLCB0aGUgYXJndW1lbnQgbmVlZHMgdG8gYmUgZXZhbHVhdGVkXG4gIC8vIGluIHRoZSBvcmlnaW5hbCBzY29wZS4gIFRoZXJlJ3Mgbm8gZ29vZCBvcmRlciB0byBuZXN0XG4gIC8vIEJsYXplLl9Jbk91dGVyVGVtcGxhdGVTY29wZSBhbmQgU3BhY2ViYXJzLlRlbXBsYXRlV2l0aCB0byBhY2hpZXZlIHRoaXMsXG4gIC8vIHNvIHdlIHdyYXAgYXJnRnVuYyB0byBydW4gaXQgaW4gdGhlIFwib3JpZ2luYWwgcGFyZW50Vmlld1wiIG9mIHRoZVxuICAvLyBCbGF6ZS5fSW5PdXRlclRlbXBsYXRlU2NvcGUuXG4gIC8vXG4gIC8vIFRvIG1ha2UgdGhpcyBiZXR0ZXIsIHJlY29uc2lkZXIgX0luT3V0ZXJUZW1wbGF0ZVNjb3BlIGFzIGEgcHJpbWl0aXZlLlxuICAvLyBMb25nZXIgdGVybSwgZXZhbHVhdGUgZXhwcmVzc2lvbnMgaW4gdGhlIHByb3BlciBsZXhpY2FsIHNjb3BlLlxuICB2YXIgd3JhcHBlZEFyZ0Z1bmMgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHZpZXdUb0V2YWx1YXRlQXJnID0gbnVsbDtcbiAgICBpZiAody5wYXJlbnRWaWV3ICYmIHcucGFyZW50Vmlldy5uYW1lID09PSAnSW5PdXRlclRlbXBsYXRlU2NvcGUnKSB7XG4gICAgICB2aWV3VG9FdmFsdWF0ZUFyZyA9IHcucGFyZW50Vmlldy5vcmlnaW5hbFBhcmVudFZpZXc7XG4gICAgfVxuICAgIGlmICh2aWV3VG9FdmFsdWF0ZUFyZykge1xuICAgICAgcmV0dXJuIEJsYXplLl93aXRoQ3VycmVudFZpZXcodmlld1RvRXZhbHVhdGVBcmcsIGFyZ0Z1bmMpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gYXJnRnVuYygpO1xuICAgIH1cbiAgfTtcblxuICB2YXIgd3JhcHBlZENvbnRlbnRGdW5jID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBjb250ZW50ID0gY29udGVudEZ1bmMuY2FsbCh0aGlzKTtcblxuICAgIC8vIFNpbmNlIHdlIGFyZSBnZW5lcmF0aW5nIHRoZSBCbGF6ZS5fVGVtcGxhdGVXaXRoIHZpZXcgZm9yIHRoZVxuICAgIC8vIHVzZXIsIHNldCB0aGUgZmxhZyBvbiB0aGUgY2hpbGQgdmlldy4gIElmIGBjb250ZW50YCBpcyBhIHRlbXBsYXRlLFxuICAgIC8vIGNvbnN0cnVjdCB0aGUgVmlldyBzbyB0aGF0IHdlIGNhbiBzZXQgdGhlIGZsYWcuXG4gICAgaWYgKGNvbnRlbnQgaW5zdGFuY2VvZiBCbGF6ZS5UZW1wbGF0ZSkge1xuICAgICAgY29udGVudCA9IGNvbnRlbnQuY29uc3RydWN0VmlldygpO1xuICAgIH1cbiAgICBpZiAoY29udGVudCBpbnN0YW5jZW9mIEJsYXplLlZpZXcpIHtcbiAgICAgIGNvbnRlbnQuX2hhc0dlbmVyYXRlZFBhcmVudCA9IHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGNvbnRlbnQ7XG4gIH07XG5cbiAgdyA9IEJsYXplLldpdGgod3JhcHBlZEFyZ0Z1bmMsIHdyYXBwZWRDb250ZW50RnVuYyk7XG4gIHcuX19pc1RlbXBsYXRlV2l0aCA9IHRydWU7XG4gIHJldHVybiB3O1xufTtcblxuQmxhemUuX0luT3V0ZXJUZW1wbGF0ZVNjb3BlID0gZnVuY3Rpb24gKHRlbXBsYXRlVmlldywgY29udGVudEZ1bmMpIHtcbiAgdmFyIHZpZXcgPSBCbGF6ZS5WaWV3KCdJbk91dGVyVGVtcGxhdGVTY29wZScsIGNvbnRlbnRGdW5jKTtcbiAgdmFyIHBhcmVudFZpZXcgPSB0ZW1wbGF0ZVZpZXcucGFyZW50VmlldztcblxuICAvLyBIYWNrIHNvIHRoYXQgaWYgeW91IGNhbGwgYHt7PiBmb28gYmFyfX1gIGFuZCBpdCBleHBhbmRzIGludG9cbiAgLy8gYHt7I3dpdGggYmFyfX17ez4gZm9vfX17ey93aXRofX1gLCBhbmQgdGhlbiBgZm9vYCBpcyBhIHRlbXBsYXRlXG4gIC8vIHRoYXQgaW5zZXJ0cyBge3s+IFRlbXBsYXRlLmNvbnRlbnRCbG9ja319YCwgdGhlIGRhdGEgY29udGV4dCBmb3JcbiAgLy8gYFRlbXBsYXRlLmNvbnRlbnRCbG9ja2AgaXMgbm90IGBiYXJgIGJ1dCB0aGUgb25lIGVuY2xvc2luZyB0aGF0LlxuICBpZiAocGFyZW50Vmlldy5fX2lzVGVtcGxhdGVXaXRoKVxuICAgIHBhcmVudFZpZXcgPSBwYXJlbnRWaWV3LnBhcmVudFZpZXc7XG5cbiAgdmlldy5vblZpZXdDcmVhdGVkKGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLm9yaWdpbmFsUGFyZW50VmlldyA9IHRoaXMucGFyZW50VmlldztcbiAgICB0aGlzLnBhcmVudFZpZXcgPSBwYXJlbnRWaWV3O1xuICAgIHRoaXMuX19jaGlsZERvZXNudFN0YXJ0TmV3TGV4aWNhbFNjb3BlID0gdHJ1ZTtcbiAgfSk7XG4gIHJldHVybiB2aWV3O1xufTtcblxuLy8gWFhYIENPTVBBVCBXSVRIIDAuOS4wXG5CbGF6ZS5Jbk91dGVyVGVtcGxhdGVTY29wZSA9IEJsYXplLl9Jbk91dGVyVGVtcGxhdGVTY29wZTtcbiIsImltcG9ydCBoYXMgZnJvbSAnbG9kYXNoLmhhcyc7XG5cbkJsYXplLl9nbG9iYWxIZWxwZXJzID0ge307XG5cbi8vIERvY3VtZW50ZWQgYXMgVGVtcGxhdGUucmVnaXN0ZXJIZWxwZXIuXG4vLyBUaGlzIGRlZmluaXRpb24gYWxzbyBwcm92aWRlcyBiYWNrLWNvbXBhdCBmb3IgYFVJLnJlZ2lzdGVySGVscGVyYC5cbkJsYXplLnJlZ2lzdGVySGVscGVyID0gZnVuY3Rpb24gKG5hbWUsIGZ1bmMpIHtcbiAgQmxhemUuX2dsb2JhbEhlbHBlcnNbbmFtZV0gPSBmdW5jO1xufTtcblxuLy8gQWxzbyBkb2N1bWVudGVkIGFzIFRlbXBsYXRlLmRlcmVnaXN0ZXJIZWxwZXJcbkJsYXplLmRlcmVnaXN0ZXJIZWxwZXIgPSBmdW5jdGlvbihuYW1lKSB7XG4gIGRlbGV0ZSBCbGF6ZS5fZ2xvYmFsSGVscGVyc1tuYW1lXTtcbn07XG5cbnZhciBiaW5kSWZJc0Z1bmN0aW9uID0gZnVuY3Rpb24gKHgsIHRhcmdldCkge1xuICBpZiAodHlwZW9mIHggIT09ICdmdW5jdGlvbicpXG4gICAgcmV0dXJuIHg7XG4gIHJldHVybiBCbGF6ZS5fYmluZCh4LCB0YXJnZXQpO1xufTtcblxuLy8gSWYgYHhgIGlzIGEgZnVuY3Rpb24sIGJpbmRzIHRoZSB2YWx1ZSBvZiBgdGhpc2AgZm9yIHRoYXQgZnVuY3Rpb25cbi8vIHRvIHRoZSBjdXJyZW50IGRhdGEgY29udGV4dC5cbnZhciBiaW5kRGF0YUNvbnRleHQgPSBmdW5jdGlvbiAoeCkge1xuICBpZiAodHlwZW9mIHggPT09ICdmdW5jdGlvbicpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIGRhdGEgPSBCbGF6ZS5nZXREYXRhKCk7XG4gICAgICBpZiAoZGF0YSA9PSBudWxsKVxuICAgICAgICBkYXRhID0ge307XG4gICAgICByZXR1cm4geC5hcHBseShkYXRhLCBhcmd1bWVudHMpO1xuICAgIH07XG4gIH1cbiAgcmV0dXJuIHg7XG59O1xuXG5CbGF6ZS5fT0xEU1RZTEVfSEVMUEVSID0ge307XG5cbkJsYXplLl9nZXRUZW1wbGF0ZUhlbHBlciA9IGZ1bmN0aW9uICh0ZW1wbGF0ZSwgbmFtZSwgdG1wbEluc3RhbmNlRnVuYykge1xuICAvLyBYWFggQ09NUEFUIFdJVEggMC45LjNcbiAgdmFyIGlzS25vd25PbGRTdHlsZUhlbHBlciA9IGZhbHNlO1xuXG4gIGlmICh0ZW1wbGF0ZS5fX2hlbHBlcnMuaGFzKG5hbWUpKSB7XG4gICAgdmFyIGhlbHBlciA9IHRlbXBsYXRlLl9faGVscGVycy5nZXQobmFtZSk7XG4gICAgaWYgKGhlbHBlciA9PT0gQmxhemUuX09MRFNUWUxFX0hFTFBFUikge1xuICAgICAgaXNLbm93bk9sZFN0eWxlSGVscGVyID0gdHJ1ZTtcbiAgICB9IGVsc2UgaWYgKGhlbHBlciAhPSBudWxsKSB7XG4gICAgICByZXR1cm4gd3JhcEhlbHBlcihiaW5kRGF0YUNvbnRleHQoaGVscGVyKSwgdG1wbEluc3RhbmNlRnVuYyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIC8vIG9sZC1zdHlsZSBoZWxwZXJcbiAgaWYgKG5hbWUgaW4gdGVtcGxhdGUpIHtcbiAgICAvLyBPbmx5IHdhcm4gb25jZSBwZXIgaGVscGVyXG4gICAgaWYgKCEgaXNLbm93bk9sZFN0eWxlSGVscGVyKSB7XG4gICAgICB0ZW1wbGF0ZS5fX2hlbHBlcnMuc2V0KG5hbWUsIEJsYXplLl9PTERTVFlMRV9IRUxQRVIpO1xuICAgICAgaWYgKCEgdGVtcGxhdGUuX05PV0FSTl9PTERTVFlMRV9IRUxQRVJTKSB7XG4gICAgICAgIEJsYXplLl93YXJuKCdBc3NpZ25pbmcgaGVscGVyIHdpdGggYCcgKyB0ZW1wbGF0ZS52aWV3TmFtZSArICcuJyArXG4gICAgICAgICAgICAgICAgICAgIG5hbWUgKyAnID0gLi4uYCBpcyBkZXByZWNhdGVkLiAgVXNlIGAnICsgdGVtcGxhdGUudmlld05hbWUgK1xuICAgICAgICAgICAgICAgICAgICAnLmhlbHBlcnMoLi4uKWAgaW5zdGVhZC4nKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHRlbXBsYXRlW25hbWVdICE9IG51bGwpIHtcbiAgICAgIHJldHVybiB3cmFwSGVscGVyKGJpbmREYXRhQ29udGV4dCh0ZW1wbGF0ZVtuYW1lXSksIHRtcGxJbnN0YW5jZUZ1bmMpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBudWxsO1xufTtcblxudmFyIHdyYXBIZWxwZXIgPSBmdW5jdGlvbiAoZiwgdGVtcGxhdGVGdW5jKSB7XG4gIGlmICh0eXBlb2YgZiAhPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgcmV0dXJuIGY7XG4gIH1cblxuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgYXJncyA9IGFyZ3VtZW50cztcblxuICAgIHJldHVybiBCbGF6ZS5UZW1wbGF0ZS5fd2l0aFRlbXBsYXRlSW5zdGFuY2VGdW5jKHRlbXBsYXRlRnVuYywgZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIEJsYXplLl93cmFwQ2F0Y2hpbmdFeGNlcHRpb25zKGYsICd0ZW1wbGF0ZSBoZWxwZXInKS5hcHBseShzZWxmLCBhcmdzKTtcbiAgICB9KTtcbiAgfTtcbn07XG5cbkJsYXplLl9sZXhpY2FsQmluZGluZ0xvb2t1cCA9IGZ1bmN0aW9uICh2aWV3LCBuYW1lKSB7XG4gIHZhciBjdXJyZW50VmlldyA9IHZpZXc7XG4gIHZhciBibG9ja0hlbHBlcnNTdGFjayA9IFtdO1xuXG4gIC8vIHdhbGsgdXAgdGhlIHZpZXdzIHN0b3BwaW5nIGF0IGEgU3BhY2ViYXJzLmluY2x1ZGUgb3IgVGVtcGxhdGUgdmlldyB0aGF0XG4gIC8vIGRvZXNuJ3QgaGF2ZSBhbiBJbk91dGVyVGVtcGxhdGVTY29wZSB2aWV3IGFzIGEgcGFyZW50XG4gIGRvIHtcbiAgICAvLyBza2lwIGJsb2NrIGhlbHBlcnMgdmlld3NcbiAgICAvLyBpZiB3ZSBmb3VuZCB0aGUgYmluZGluZyBvbiB0aGUgc2NvcGUsIHJldHVybiBpdFxuICAgIGlmIChoYXMoY3VycmVudFZpZXcuX3Njb3BlQmluZGluZ3MsIG5hbWUpKSB7XG4gICAgICB2YXIgYmluZGluZ1JlYWN0aXZlVmFyID0gY3VycmVudFZpZXcuX3Njb3BlQmluZGluZ3NbbmFtZV07XG4gICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gYmluZGluZ1JlYWN0aXZlVmFyLmdldCgpO1xuICAgICAgfTtcbiAgICB9XG4gIH0gd2hpbGUgKCEgKGN1cnJlbnRWaWV3Ll9fc3RhcnRzTmV3TGV4aWNhbFNjb3BlICYmXG4gICAgICAgICAgICAgICEgKGN1cnJlbnRWaWV3LnBhcmVudFZpZXcgJiZcbiAgICAgICAgICAgICAgICAgY3VycmVudFZpZXcucGFyZW50Vmlldy5fX2NoaWxkRG9lc250U3RhcnROZXdMZXhpY2FsU2NvcGUpKVxuICAgICAgICAgICAmJiAoY3VycmVudFZpZXcgPSBjdXJyZW50Vmlldy5wYXJlbnRWaWV3KSk7XG5cbiAgcmV0dXJuIG51bGw7XG59O1xuXG4vLyB0ZW1wbGF0ZUluc3RhbmNlIGFyZ3VtZW50IGlzIHByb3ZpZGVkIHRvIGJlIGF2YWlsYWJsZSBmb3IgcG9zc2libGVcbi8vIGFsdGVybmF0aXZlIGltcGxlbWVudGF0aW9ucyBvZiB0aGlzIGZ1bmN0aW9uIGJ5IDNyZCBwYXJ0eSBwYWNrYWdlcy5cbkJsYXplLl9nZXRUZW1wbGF0ZSA9IGZ1bmN0aW9uIChuYW1lLCB0ZW1wbGF0ZUluc3RhbmNlKSB7XG4gIGlmICgobmFtZSBpbiBCbGF6ZS5UZW1wbGF0ZSkgJiYgKEJsYXplLlRlbXBsYXRlW25hbWVdIGluc3RhbmNlb2YgQmxhemUuVGVtcGxhdGUpKSB7XG4gICAgcmV0dXJuIEJsYXplLlRlbXBsYXRlW25hbWVdO1xuICB9XG4gIHJldHVybiBudWxsO1xufTtcblxuQmxhemUuX2dldEdsb2JhbEhlbHBlciA9IGZ1bmN0aW9uIChuYW1lLCB0ZW1wbGF0ZUluc3RhbmNlKSB7XG4gIGlmIChCbGF6ZS5fZ2xvYmFsSGVscGVyc1tuYW1lXSAhPSBudWxsKSB7XG4gICAgcmV0dXJuIHdyYXBIZWxwZXIoYmluZERhdGFDb250ZXh0KEJsYXplLl9nbG9iYWxIZWxwZXJzW25hbWVdKSwgdGVtcGxhdGVJbnN0YW5jZSk7XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59O1xuXG4vLyBMb29rcyB1cCBhIG5hbWUsIGxpa2UgXCJmb29cIiBvciBcIi4uXCIsIGFzIGEgaGVscGVyIG9mIHRoZVxuLy8gY3VycmVudCB0ZW1wbGF0ZTsgdGhlIG5hbWUgb2YgYSB0ZW1wbGF0ZTsgYSBnbG9iYWwgaGVscGVyO1xuLy8gb3IgYSBwcm9wZXJ0eSBvZiB0aGUgZGF0YSBjb250ZXh0LiAgQ2FsbGVkIG9uIHRoZSBWaWV3IG9mXG4vLyBhIHRlbXBsYXRlIChpLmUuIGEgVmlldyB3aXRoIGEgYC50ZW1wbGF0ZWAgcHJvcGVydHksXG4vLyB3aGVyZSB0aGUgaGVscGVycyBhcmUpLiAgVXNlZCBmb3IgdGhlIGZpcnN0IG5hbWUgaW4gYVxuLy8gXCJwYXRoXCIgaW4gYSB0ZW1wbGF0ZSB0YWcsIGxpa2UgXCJmb29cIiBpbiBge3tmb28uYmFyfX1gIG9yXG4vLyBcIi4uXCIgaW4gYHt7ZnJvYnVsYXRlIC4uL2JsYWh9fWAuXG4vL1xuLy8gUmV0dXJucyBhIGZ1bmN0aW9uLCBhIG5vbi1mdW5jdGlvbiB2YWx1ZSwgb3IgbnVsbC4gIElmXG4vLyBhIGZ1bmN0aW9uIGlzIGZvdW5kLCBpdCBpcyBib3VuZCBhcHByb3ByaWF0ZWx5LlxuLy9cbi8vIE5PVEU6IFRoaXMgZnVuY3Rpb24gbXVzdCBub3QgZXN0YWJsaXNoIGFueSByZWFjdGl2ZVxuLy8gZGVwZW5kZW5jaWVzIGl0c2VsZi4gIElmIHRoZXJlIGlzIGFueSByZWFjdGl2aXR5IGluIHRoZVxuLy8gdmFsdWUsIGxvb2t1cCBzaG91bGQgcmV0dXJuIGEgZnVuY3Rpb24uXG5CbGF6ZS5WaWV3LnByb3RvdHlwZS5sb29rdXAgPSBmdW5jdGlvbiAobmFtZSwgX29wdGlvbnMpIHtcbiAgdmFyIHRlbXBsYXRlID0gdGhpcy50ZW1wbGF0ZTtcbiAgdmFyIGxvb2t1cFRlbXBsYXRlID0gX29wdGlvbnMgJiYgX29wdGlvbnMudGVtcGxhdGU7XG4gIHZhciBoZWxwZXI7XG4gIHZhciBiaW5kaW5nO1xuICB2YXIgYm91bmRUbXBsSW5zdGFuY2U7XG4gIHZhciBmb3VuZFRlbXBsYXRlO1xuXG4gIGlmICh0aGlzLnRlbXBsYXRlSW5zdGFuY2UpIHtcbiAgICBib3VuZFRtcGxJbnN0YW5jZSA9IEJsYXplLl9iaW5kKHRoaXMudGVtcGxhdGVJbnN0YW5jZSwgdGhpcyk7XG4gIH1cblxuICAvLyAwLiBsb29raW5nIHVwIHRoZSBwYXJlbnQgZGF0YSBjb250ZXh0IHdpdGggdGhlIHNwZWNpYWwgXCIuLi9cIiBzeW50YXhcbiAgaWYgKC9eXFwuLy50ZXN0KG5hbWUpKSB7XG4gICAgLy8gc3RhcnRzIHdpdGggYSBkb3QuIG11c3QgYmUgYSBzZXJpZXMgb2YgZG90cyB3aGljaCBtYXBzIHRvIGFuXG4gICAgLy8gYW5jZXN0b3Igb2YgdGhlIGFwcHJvcHJpYXRlIGhlaWdodC5cbiAgICBpZiAoIS9eKFxcLikrJC8udGVzdChuYW1lKSlcbiAgICAgIHRocm93IG5ldyBFcnJvcihcImlkIHN0YXJ0aW5nIHdpdGggZG90IG11c3QgYmUgYSBzZXJpZXMgb2YgZG90c1wiKTtcblxuICAgIHJldHVybiBCbGF6ZS5fcGFyZW50RGF0YShuYW1lLmxlbmd0aCAtIDEsIHRydWUgLypfZnVuY3Rpb25XcmFwcGVkKi8pO1xuXG4gIH1cblxuICAvLyAxLiBsb29rIHVwIGEgaGVscGVyIG9uIHRoZSBjdXJyZW50IHRlbXBsYXRlXG4gIGlmICh0ZW1wbGF0ZSAmJiAoKGhlbHBlciA9IEJsYXplLl9nZXRUZW1wbGF0ZUhlbHBlcih0ZW1wbGF0ZSwgbmFtZSwgYm91bmRUbXBsSW5zdGFuY2UpKSAhPSBudWxsKSkge1xuICAgIHJldHVybiBoZWxwZXI7XG4gIH1cblxuICAvLyAyLiBsb29rIHVwIGEgYmluZGluZyBieSB0cmF2ZXJzaW5nIHRoZSBsZXhpY2FsIHZpZXcgaGllcmFyY2h5IGluc2lkZSB0aGVcbiAgLy8gY3VycmVudCB0ZW1wbGF0ZVxuICBpZiAodGVtcGxhdGUgJiYgKGJpbmRpbmcgPSBCbGF6ZS5fbGV4aWNhbEJpbmRpbmdMb29rdXAoQmxhemUuY3VycmVudFZpZXcsIG5hbWUpKSAhPSBudWxsKSB7XG4gICAgcmV0dXJuIGJpbmRpbmc7XG4gIH1cblxuICAvLyAzLiBsb29rIHVwIGEgdGVtcGxhdGUgYnkgbmFtZVxuICBpZiAobG9va3VwVGVtcGxhdGUgJiYgKChmb3VuZFRlbXBsYXRlID0gQmxhemUuX2dldFRlbXBsYXRlKG5hbWUsIGJvdW5kVG1wbEluc3RhbmNlKSkgIT0gbnVsbCkpIHtcbiAgICByZXR1cm4gZm91bmRUZW1wbGF0ZTtcbiAgfVxuXG4gIC8vIDQuIGxvb2sgdXAgYSBnbG9iYWwgaGVscGVyXG4gIGlmICgoaGVscGVyID0gQmxhemUuX2dldEdsb2JhbEhlbHBlcihuYW1lLCBib3VuZFRtcGxJbnN0YW5jZSkpICE9IG51bGwpIHtcbiAgICByZXR1cm4gaGVscGVyO1xuICB9XG5cbiAgLy8gNS4gbG9vayB1cCBpbiBhIGRhdGEgY29udGV4dFxuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIHZhciBpc0NhbGxlZEFzRnVuY3Rpb24gPSAoYXJndW1lbnRzLmxlbmd0aCA+IDApO1xuICAgIHZhciBkYXRhID0gQmxhemUuZ2V0RGF0YSgpO1xuICAgIHZhciB4ID0gZGF0YSAmJiBkYXRhW25hbWVdO1xuICAgIGlmICghIHgpIHtcbiAgICAgIGlmIChsb29rdXBUZW1wbGF0ZSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJObyBzdWNoIHRlbXBsYXRlOiBcIiArIG5hbWUpO1xuICAgICAgfSBlbHNlIGlmIChpc0NhbGxlZEFzRnVuY3Rpb24pIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTm8gc3VjaCBmdW5jdGlvbjogXCIgKyBuYW1lKTtcbiAgICAgIH0gZWxzZSBpZiAobmFtZS5jaGFyQXQoMCkgPT09ICdAJyAmJiAoKHggPT09IG51bGwpIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICh4ID09PSB1bmRlZmluZWQpKSkge1xuICAgICAgICAvLyBUaHJvdyBhbiBlcnJvciBpZiB0aGUgdXNlciB0cmllcyB0byB1c2UgYSBgQGRpcmVjdGl2ZWBcbiAgICAgICAgLy8gdGhhdCBkb2Vzbid0IGV4aXN0LiAgV2UgZG9uJ3QgaW1wbGVtZW50IGFsbCBkaXJlY3RpdmVzXG4gICAgICAgIC8vIGZyb20gSGFuZGxlYmFycywgc28gdGhlcmUncyBhIHBvdGVudGlhbCBmb3IgY29uZnVzaW9uXG4gICAgICAgIC8vIGlmIHdlIGZhaWwgc2lsZW50bHkuICBPbiB0aGUgb3RoZXIgaGFuZCwgd2Ugd2FudCB0b1xuICAgICAgICAvLyB0aHJvdyBsYXRlIGluIGNhc2Ugc29tZSBhcHAgb3IgcGFja2FnZSB3YW50cyB0byBwcm92aWRlXG4gICAgICAgIC8vIGEgbWlzc2luZyBkaXJlY3RpdmUuXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIlVuc3VwcG9ydGVkIGRpcmVjdGl2ZTogXCIgKyBuYW1lKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKCEgZGF0YSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGlmICh0eXBlb2YgeCAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgaWYgKGlzQ2FsbGVkQXNGdW5jdGlvbikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW4ndCBjYWxsIG5vbi1mdW5jdGlvbjogXCIgKyB4KTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB4O1xuICAgIH1cbiAgICByZXR1cm4geC5hcHBseShkYXRhLCBhcmd1bWVudHMpO1xuICB9O1xufTtcblxuLy8gSW1wbGVtZW50IFNwYWNlYmFycycge3suLi8uLn19LlxuLy8gQHBhcmFtIGhlaWdodCB7TnVtYmVyfSBUaGUgbnVtYmVyIG9mICcuLidzXG5CbGF6ZS5fcGFyZW50RGF0YSA9IGZ1bmN0aW9uIChoZWlnaHQsIF9mdW5jdGlvbldyYXBwZWQpIHtcbiAgLy8gSWYgaGVpZ2h0IGlzIG51bGwgb3IgdW5kZWZpbmVkLCB3ZSBkZWZhdWx0IHRvIDEsIHRoZSBmaXJzdCBwYXJlbnQuXG4gIGlmIChoZWlnaHQgPT0gbnVsbCkge1xuICAgIGhlaWdodCA9IDE7XG4gIH1cbiAgdmFyIHRoZVdpdGggPSBCbGF6ZS5nZXRWaWV3KCd3aXRoJyk7XG4gIGZvciAodmFyIGkgPSAwOyAoaSA8IGhlaWdodCkgJiYgdGhlV2l0aDsgaSsrKSB7XG4gICAgdGhlV2l0aCA9IEJsYXplLmdldFZpZXcodGhlV2l0aCwgJ3dpdGgnKTtcbiAgfVxuXG4gIGlmICghIHRoZVdpdGgpXG4gICAgcmV0dXJuIG51bGw7XG4gIGlmIChfZnVuY3Rpb25XcmFwcGVkKVxuICAgIHJldHVybiBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGVXaXRoLmRhdGFWYXIuZ2V0KCk7IH07XG4gIHJldHVybiB0aGVXaXRoLmRhdGFWYXIuZ2V0KCk7XG59O1xuXG5cbkJsYXplLlZpZXcucHJvdG90eXBlLmxvb2t1cFRlbXBsYXRlID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgcmV0dXJuIHRoaXMubG9va3VwKG5hbWUsIHt0ZW1wbGF0ZTp0cnVlfSk7XG59O1xuIiwiaW1wb3J0IGlzT2JqZWN0IGZyb20gJ2xvZGFzaC5pc29iamVjdCc7XG5pbXBvcnQgaXNGdW5jdGlvbiBmcm9tICdsb2Rhc2guaXNmdW5jdGlvbic7XG5pbXBvcnQgaGFzIGZyb20gJ2xvZGFzaC5oYXMnO1xuaW1wb3J0IGlzRW1wdHkgZnJvbSAnbG9kYXNoLmlzZW1wdHknO1xuXG4vLyBbbmV3XSBCbGF6ZS5UZW1wbGF0ZShbdmlld05hbWVdLCByZW5kZXJGdW5jdGlvbilcbi8vXG4vLyBgQmxhemUuVGVtcGxhdGVgIGlzIHRoZSBjbGFzcyBvZiB0ZW1wbGF0ZXMsIGxpa2UgYFRlbXBsYXRlLmZvb2AgaW5cbi8vIE1ldGVvciwgd2hpY2ggaXMgYGluc3RhbmNlb2YgVGVtcGxhdGVgLlxuLy9cbi8vIGB2aWV3S2luZGAgaXMgYSBzdHJpbmcgdGhhdCBsb29rcyBsaWtlIFwiVGVtcGxhdGUuZm9vXCIgZm9yIHRlbXBsYXRlc1xuLy8gZGVmaW5lZCBieSB0aGUgY29tcGlsZXIuXG5cbi8qKlxuICogQGNsYXNzXG4gKiBAc3VtbWFyeSBDb25zdHJ1Y3RvciBmb3IgYSBUZW1wbGF0ZSwgd2hpY2ggaXMgdXNlZCB0byBjb25zdHJ1Y3QgVmlld3Mgd2l0aCBwYXJ0aWN1bGFyIG5hbWUgYW5kIGNvbnRlbnQuXG4gKiBAbG9jdXMgQ2xpZW50XG4gKiBAcGFyYW0ge1N0cmluZ30gW3ZpZXdOYW1lXSBPcHRpb25hbC4gIEEgbmFtZSBmb3IgVmlld3MgY29uc3RydWN0ZWQgYnkgdGhpcyBUZW1wbGF0ZS4gIFNlZSBbYHZpZXcubmFtZWBdKCN2aWV3X25hbWUpLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gcmVuZGVyRnVuY3Rpb24gQSBmdW5jdGlvbiB0aGF0IHJldHVybnMgWypyZW5kZXJhYmxlIGNvbnRlbnQqXSgjUmVuZGVyYWJsZS1Db250ZW50KS4gIFRoaXMgZnVuY3Rpb24gaXMgdXNlZCBhcyB0aGUgYHJlbmRlckZ1bmN0aW9uYCBmb3IgVmlld3MgY29uc3RydWN0ZWQgYnkgdGhpcyBUZW1wbGF0ZS5cbiAqL1xuQmxhemUuVGVtcGxhdGUgPSBmdW5jdGlvbiAodmlld05hbWUsIHJlbmRlckZ1bmN0aW9uKSB7XG4gIGlmICghICh0aGlzIGluc3RhbmNlb2YgQmxhemUuVGVtcGxhdGUpKVxuICAgIC8vIGNhbGxlZCB3aXRob3V0IGBuZXdgXG4gICAgcmV0dXJuIG5ldyBCbGF6ZS5UZW1wbGF0ZSh2aWV3TmFtZSwgcmVuZGVyRnVuY3Rpb24pO1xuXG4gIGlmICh0eXBlb2Ygdmlld05hbWUgPT09ICdmdW5jdGlvbicpIHtcbiAgICAvLyBvbWl0dGVkIFwidmlld05hbWVcIiBhcmd1bWVudFxuICAgIHJlbmRlckZ1bmN0aW9uID0gdmlld05hbWU7XG4gICAgdmlld05hbWUgPSAnJztcbiAgfVxuICBpZiAodHlwZW9mIHZpZXdOYW1lICE9PSAnc3RyaW5nJylcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJ2aWV3TmFtZSBtdXN0IGJlIGEgU3RyaW5nIChvciBvbWl0dGVkKVwiKTtcbiAgaWYgKHR5cGVvZiByZW5kZXJGdW5jdGlvbiAhPT0gJ2Z1bmN0aW9uJylcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJyZW5kZXJGdW5jdGlvbiBtdXN0IGJlIGEgZnVuY3Rpb25cIik7XG5cbiAgdGhpcy52aWV3TmFtZSA9IHZpZXdOYW1lO1xuICB0aGlzLnJlbmRlckZ1bmN0aW9uID0gcmVuZGVyRnVuY3Rpb247XG5cbiAgdGhpcy5fX2hlbHBlcnMgPSBuZXcgSGVscGVyTWFwO1xuICB0aGlzLl9fZXZlbnRNYXBzID0gW107XG5cbiAgdGhpcy5fY2FsbGJhY2tzID0ge1xuICAgIGNyZWF0ZWQ6IFtdLFxuICAgIHJlbmRlcmVkOiBbXSxcbiAgICBkZXN0cm95ZWQ6IFtdXG4gIH07XG59O1xudmFyIFRlbXBsYXRlID0gQmxhemUuVGVtcGxhdGU7XG5cbnZhciBIZWxwZXJNYXAgPSBmdW5jdGlvbiAoKSB7fTtcbkhlbHBlck1hcC5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgcmV0dXJuIHRoaXNbJyAnK25hbWVdO1xufTtcbkhlbHBlck1hcC5wcm90b3R5cGUuc2V0ID0gZnVuY3Rpb24gKG5hbWUsIGhlbHBlcikge1xuICB0aGlzWycgJytuYW1lXSA9IGhlbHBlcjtcbn07XG5IZWxwZXJNYXAucHJvdG90eXBlLmhhcyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gIHJldHVybiAodHlwZW9mIHRoaXNbJyAnK25hbWVdICE9PSAndW5kZWZpbmVkJyk7XG59O1xuXG4vKipcbiAqIEBzdW1tYXJ5IFJldHVybnMgdHJ1ZSBpZiBgdmFsdWVgIGlzIGEgdGVtcGxhdGUgb2JqZWN0IGxpa2UgYFRlbXBsYXRlLm15VGVtcGxhdGVgLlxuICogQGxvY3VzIENsaWVudFxuICogQHBhcmFtIHtBbnl9IHZhbHVlIFRoZSB2YWx1ZSB0byB0ZXN0LlxuICovXG5CbGF6ZS5pc1RlbXBsYXRlID0gZnVuY3Rpb24gKHQpIHtcbiAgcmV0dXJuICh0IGluc3RhbmNlb2YgQmxhemUuVGVtcGxhdGUpO1xufTtcblxuLyoqXG4gKiBAbmFtZSAgb25DcmVhdGVkXG4gKiBAaW5zdGFuY2VcbiAqIEBtZW1iZXJPZiBUZW1wbGF0ZVxuICogQHN1bW1hcnkgUmVnaXN0ZXIgYSBmdW5jdGlvbiB0byBiZSBjYWxsZWQgd2hlbiBhbiBpbnN0YW5jZSBvZiB0aGlzIHRlbXBsYXRlIGlzIGNyZWF0ZWQuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBBIGZ1bmN0aW9uIHRvIGJlIGFkZGVkIGFzIGEgY2FsbGJhY2suXG4gKiBAbG9jdXMgQ2xpZW50XG4gKiBAaW1wb3J0RnJvbVBhY2thZ2UgdGVtcGxhdGluZ1xuICovXG5UZW1wbGF0ZS5wcm90b3R5cGUub25DcmVhdGVkID0gZnVuY3Rpb24gKGNiKSB7XG4gIHRoaXMuX2NhbGxiYWNrcy5jcmVhdGVkLnB1c2goY2IpO1xufTtcblxuLyoqXG4gKiBAbmFtZSAgb25SZW5kZXJlZFxuICogQGluc3RhbmNlXG4gKiBAbWVtYmVyT2YgVGVtcGxhdGVcbiAqIEBzdW1tYXJ5IFJlZ2lzdGVyIGEgZnVuY3Rpb24gdG8gYmUgY2FsbGVkIHdoZW4gYW4gaW5zdGFuY2Ugb2YgdGhpcyB0ZW1wbGF0ZSBpcyBpbnNlcnRlZCBpbnRvIHRoZSBET00uXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBBIGZ1bmN0aW9uIHRvIGJlIGFkZGVkIGFzIGEgY2FsbGJhY2suXG4gKiBAbG9jdXMgQ2xpZW50XG4gKiBAaW1wb3J0RnJvbVBhY2thZ2UgdGVtcGxhdGluZ1xuICovXG5UZW1wbGF0ZS5wcm90b3R5cGUub25SZW5kZXJlZCA9IGZ1bmN0aW9uIChjYikge1xuICB0aGlzLl9jYWxsYmFja3MucmVuZGVyZWQucHVzaChjYik7XG59O1xuXG4vKipcbiAqIEBuYW1lICBvbkRlc3Ryb3llZFxuICogQGluc3RhbmNlXG4gKiBAbWVtYmVyT2YgVGVtcGxhdGVcbiAqIEBzdW1tYXJ5IFJlZ2lzdGVyIGEgZnVuY3Rpb24gdG8gYmUgY2FsbGVkIHdoZW4gYW4gaW5zdGFuY2Ugb2YgdGhpcyB0ZW1wbGF0ZSBpcyByZW1vdmVkIGZyb20gdGhlIERPTSBhbmQgZGVzdHJveWVkLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgQSBmdW5jdGlvbiB0byBiZSBhZGRlZCBhcyBhIGNhbGxiYWNrLlxuICogQGxvY3VzIENsaWVudFxuICogQGltcG9ydEZyb21QYWNrYWdlIHRlbXBsYXRpbmdcbiAqL1xuVGVtcGxhdGUucHJvdG90eXBlLm9uRGVzdHJveWVkID0gZnVuY3Rpb24gKGNiKSB7XG4gIHRoaXMuX2NhbGxiYWNrcy5kZXN0cm95ZWQucHVzaChjYik7XG59O1xuXG5UZW1wbGF0ZS5wcm90b3R5cGUuX2dldENhbGxiYWNrcyA9IGZ1bmN0aW9uICh3aGljaCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHZhciBjYWxsYmFja3MgPSBzZWxmW3doaWNoXSA/IFtzZWxmW3doaWNoXV0gOiBbXTtcbiAgLy8gRmlyZSBhbGwgY2FsbGJhY2tzIGFkZGVkIHdpdGggdGhlIG5ldyBBUEkgKFRlbXBsYXRlLm9uUmVuZGVyZWQoKSlcbiAgLy8gYXMgd2VsbCBhcyB0aGUgb2xkLXN0eWxlIGNhbGxiYWNrIChlLmcuIFRlbXBsYXRlLnJlbmRlcmVkKSBmb3JcbiAgLy8gYmFja3dhcmRzLWNvbXBhdGliaWxpdHkuXG4gIGNhbGxiYWNrcyA9IGNhbGxiYWNrcy5jb25jYXQoc2VsZi5fY2FsbGJhY2tzW3doaWNoXSk7XG4gIHJldHVybiBjYWxsYmFja3M7XG59O1xuXG52YXIgZmlyZUNhbGxiYWNrcyA9IGZ1bmN0aW9uIChjYWxsYmFja3MsIHRlbXBsYXRlKSB7XG4gIFRlbXBsYXRlLl93aXRoVGVtcGxhdGVJbnN0YW5jZUZ1bmMoXG4gICAgZnVuY3Rpb24gKCkgeyByZXR1cm4gdGVtcGxhdGU7IH0sXG4gICAgZnVuY3Rpb24gKCkge1xuICAgICAgZm9yICh2YXIgaSA9IDAsIE4gPSBjYWxsYmFja3MubGVuZ3RoOyBpIDwgTjsgaSsrKSB7XG4gICAgICAgIGNhbGxiYWNrc1tpXS5jYWxsKHRlbXBsYXRlKTtcbiAgICAgIH1cbiAgICB9KTtcbn07XG5cblRlbXBsYXRlLnByb3RvdHlwZS5jb25zdHJ1Y3RWaWV3ID0gZnVuY3Rpb24gKGNvbnRlbnRGdW5jLCBlbHNlRnVuYykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHZhciB2aWV3ID0gQmxhemUuVmlldyhzZWxmLnZpZXdOYW1lLCBzZWxmLnJlbmRlckZ1bmN0aW9uKTtcbiAgdmlldy50ZW1wbGF0ZSA9IHNlbGY7XG5cbiAgdmlldy50ZW1wbGF0ZUNvbnRlbnRCbG9jayA9IChcbiAgICBjb250ZW50RnVuYyA/IG5ldyBUZW1wbGF0ZSgnKGNvbnRlbnRCbG9jayknLCBjb250ZW50RnVuYykgOiBudWxsKTtcbiAgdmlldy50ZW1wbGF0ZUVsc2VCbG9jayA9IChcbiAgICBlbHNlRnVuYyA/IG5ldyBUZW1wbGF0ZSgnKGVsc2VCbG9jayknLCBlbHNlRnVuYykgOiBudWxsKTtcblxuICBpZiAoc2VsZi5fX2V2ZW50TWFwcyB8fCB0eXBlb2Ygc2VsZi5ldmVudHMgPT09ICdvYmplY3QnKSB7XG4gICAgdmlldy5fb25WaWV3UmVuZGVyZWQoZnVuY3Rpb24gKCkge1xuICAgICAgaWYgKHZpZXcucmVuZGVyQ291bnQgIT09IDEpXG4gICAgICAgIHJldHVybjtcblxuICAgICAgaWYgKCEgc2VsZi5fX2V2ZW50TWFwcy5sZW5ndGggJiYgdHlwZW9mIHNlbGYuZXZlbnRzID09PSBcIm9iamVjdFwiKSB7XG4gICAgICAgIC8vIFByb3ZpZGUgbGltaXRlZCBiYWNrLWNvbXBhdCBzdXBwb3J0IGZvciBgLmV2ZW50cyA9IHsuLi59YFxuICAgICAgICAvLyBzeW50YXguICBQYXNzIGB0ZW1wbGF0ZS5ldmVudHNgIHRvIHRoZSBvcmlnaW5hbCBgLmV2ZW50cyguLi4pYFxuICAgICAgICAvLyBmdW5jdGlvbi4gIFRoaXMgY29kZSBtdXN0IHJ1biBvbmx5IG9uY2UgcGVyIHRlbXBsYXRlLCBpblxuICAgICAgICAvLyBvcmRlciB0byBub3QgYmluZCB0aGUgaGFuZGxlcnMgbW9yZSB0aGFuIG9uY2UsIHdoaWNoIGlzXG4gICAgICAgIC8vIGVuc3VyZWQgYnkgdGhlIGZhY3QgdGhhdCB3ZSBvbmx5IGRvIHRoaXMgd2hlbiBgX19ldmVudE1hcHNgXG4gICAgICAgIC8vIGlzIGZhbHN5LCBhbmQgd2UgY2F1c2UgaXQgdG8gYmUgc2V0IG5vdy5cbiAgICAgICAgVGVtcGxhdGUucHJvdG90eXBlLmV2ZW50cy5jYWxsKHNlbGYsIHNlbGYuZXZlbnRzKTtcbiAgICAgIH1cblxuICAgICAgc2VsZi5fX2V2ZW50TWFwcy5mb3JFYWNoKGZ1bmN0aW9uIChtKSB7XG4gICAgICAgIEJsYXplLl9hZGRFdmVudE1hcCh2aWV3LCBtLCB2aWV3KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgdmlldy5fdGVtcGxhdGVJbnN0YW5jZSA9IG5ldyBCbGF6ZS5UZW1wbGF0ZUluc3RhbmNlKHZpZXcpO1xuICB2aWV3LnRlbXBsYXRlSW5zdGFuY2UgPSBmdW5jdGlvbiAoKSB7XG4gICAgLy8gVXBkYXRlIGRhdGEsIGZpcnN0Tm9kZSwgYW5kIGxhc3ROb2RlLCBhbmQgcmV0dXJuIHRoZSBUZW1wbGF0ZUluc3RhbmNlXG4gICAgLy8gb2JqZWN0LlxuICAgIHZhciBpbnN0ID0gdmlldy5fdGVtcGxhdGVJbnN0YW5jZTtcblxuICAgIC8qKlxuICAgICAqIEBpbnN0YW5jZVxuICAgICAqIEBtZW1iZXJPZiBCbGF6ZS5UZW1wbGF0ZUluc3RhbmNlXG4gICAgICogQG5hbWUgIGRhdGFcbiAgICAgKiBAc3VtbWFyeSBUaGUgZGF0YSBjb250ZXh0IG9mIHRoaXMgaW5zdGFuY2UncyBsYXRlc3QgaW52b2NhdGlvbi5cbiAgICAgKiBAbG9jdXMgQ2xpZW50XG4gICAgICovXG4gICAgaW5zdC5kYXRhID0gQmxhemUuZ2V0RGF0YSh2aWV3KTtcblxuICAgIGlmICh2aWV3Ll9kb21yYW5nZSAmJiAhdmlldy5pc0Rlc3Ryb3llZCkge1xuICAgICAgaW5zdC5maXJzdE5vZGUgPSB2aWV3Ll9kb21yYW5nZS5maXJzdE5vZGUoKTtcbiAgICAgIGluc3QubGFzdE5vZGUgPSB2aWV3Ll9kb21yYW5nZS5sYXN0Tm9kZSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBvbiAnY3JlYXRlZCcgb3IgJ2Rlc3Ryb3llZCcgY2FsbGJhY2tzIHdlIGRvbid0IGhhdmUgYSBEb21SYW5nZVxuICAgICAgaW5zdC5maXJzdE5vZGUgPSBudWxsO1xuICAgICAgaW5zdC5sYXN0Tm9kZSA9IG51bGw7XG4gICAgfVxuXG4gICAgcmV0dXJuIGluc3Q7XG4gIH07XG5cbiAgLyoqXG4gICAqIEBuYW1lICBjcmVhdGVkXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAbWVtYmVyT2YgVGVtcGxhdGVcbiAgICogQHN1bW1hcnkgUHJvdmlkZSBhIGNhbGxiYWNrIHdoZW4gYW4gaW5zdGFuY2Ugb2YgYSB0ZW1wbGF0ZSBpcyBjcmVhdGVkLlxuICAgKiBAbG9jdXMgQ2xpZW50XG4gICAqIEBkZXByZWNhdGVkIGluIDEuMVxuICAgKi9cbiAgLy8gVG8gYXZvaWQgc2l0dWF0aW9ucyB3aGVuIG5ldyBjYWxsYmFja3MgYXJlIGFkZGVkIGluIGJldHdlZW4gdmlld1xuICAvLyBpbnN0YW50aWF0aW9uIGFuZCBldmVudCBiZWluZyBmaXJlZCwgZGVjaWRlIG9uIGFsbCBjYWxsYmFja3MgdG8gZmlyZVxuICAvLyBpbW1lZGlhdGVseSBhbmQgdGhlbiBmaXJlIHRoZW0gb24gdGhlIGV2ZW50LlxuICB2YXIgY3JlYXRlZENhbGxiYWNrcyA9IHNlbGYuX2dldENhbGxiYWNrcygnY3JlYXRlZCcpO1xuICB2aWV3Lm9uVmlld0NyZWF0ZWQoZnVuY3Rpb24gKCkge1xuICAgIGZpcmVDYWxsYmFja3MoY3JlYXRlZENhbGxiYWNrcywgdmlldy50ZW1wbGF0ZUluc3RhbmNlKCkpO1xuICB9KTtcblxuICAvKipcbiAgICogQG5hbWUgIHJlbmRlcmVkXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAbWVtYmVyT2YgVGVtcGxhdGVcbiAgICogQHN1bW1hcnkgUHJvdmlkZSBhIGNhbGxiYWNrIHdoZW4gYW4gaW5zdGFuY2Ugb2YgYSB0ZW1wbGF0ZSBpcyByZW5kZXJlZC5cbiAgICogQGxvY3VzIENsaWVudFxuICAgKiBAZGVwcmVjYXRlZCBpbiAxLjFcbiAgICovXG4gIHZhciByZW5kZXJlZENhbGxiYWNrcyA9IHNlbGYuX2dldENhbGxiYWNrcygncmVuZGVyZWQnKTtcbiAgdmlldy5vblZpZXdSZWFkeShmdW5jdGlvbiAoKSB7XG4gICAgZmlyZUNhbGxiYWNrcyhyZW5kZXJlZENhbGxiYWNrcywgdmlldy50ZW1wbGF0ZUluc3RhbmNlKCkpO1xuICB9KTtcblxuICAvKipcbiAgICogQG5hbWUgIGRlc3Ryb3llZFxuICAgKiBAaW5zdGFuY2VcbiAgICogQG1lbWJlck9mIFRlbXBsYXRlXG4gICAqIEBzdW1tYXJ5IFByb3ZpZGUgYSBjYWxsYmFjayB3aGVuIGFuIGluc3RhbmNlIG9mIGEgdGVtcGxhdGUgaXMgZGVzdHJveWVkLlxuICAgKiBAbG9jdXMgQ2xpZW50XG4gICAqIEBkZXByZWNhdGVkIGluIDEuMVxuICAgKi9cbiAgdmFyIGRlc3Ryb3llZENhbGxiYWNrcyA9IHNlbGYuX2dldENhbGxiYWNrcygnZGVzdHJveWVkJyk7XG4gIHZpZXcub25WaWV3RGVzdHJveWVkKGZ1bmN0aW9uICgpIHtcbiAgICBmaXJlQ2FsbGJhY2tzKGRlc3Ryb3llZENhbGxiYWNrcywgdmlldy50ZW1wbGF0ZUluc3RhbmNlKCkpO1xuICB9KTtcblxuICByZXR1cm4gdmlldztcbn07XG5cbi8qKlxuICogQGNsYXNzXG4gKiBAc3VtbWFyeSBUaGUgY2xhc3MgZm9yIHRlbXBsYXRlIGluc3RhbmNlc1xuICogQHBhcmFtIHtCbGF6ZS5WaWV3fSB2aWV3XG4gKiBAaW5zdGFuY2VOYW1lIHRlbXBsYXRlXG4gKi9cbkJsYXplLlRlbXBsYXRlSW5zdGFuY2UgPSBmdW5jdGlvbiAodmlldykge1xuICBpZiAoISAodGhpcyBpbnN0YW5jZW9mIEJsYXplLlRlbXBsYXRlSW5zdGFuY2UpKVxuICAgIC8vIGNhbGxlZCB3aXRob3V0IGBuZXdgXG4gICAgcmV0dXJuIG5ldyBCbGF6ZS5UZW1wbGF0ZUluc3RhbmNlKHZpZXcpO1xuXG4gIGlmICghICh2aWV3IGluc3RhbmNlb2YgQmxhemUuVmlldykpXG4gICAgdGhyb3cgbmV3IEVycm9yKFwiVmlldyByZXF1aXJlZFwiKTtcblxuICB2aWV3Ll90ZW1wbGF0ZUluc3RhbmNlID0gdGhpcztcblxuICAvKipcbiAgICogQG5hbWUgdmlld1xuICAgKiBAbWVtYmVyT2YgQmxhemUuVGVtcGxhdGVJbnN0YW5jZVxuICAgKiBAaW5zdGFuY2VcbiAgICogQHN1bW1hcnkgVGhlIFtWaWV3XSguLi9hcGkvYmxhemUuaHRtbCNCbGF6ZS1WaWV3KSBvYmplY3QgZm9yIHRoaXMgaW52b2NhdGlvbiBvZiB0aGUgdGVtcGxhdGUuXG4gICAqIEBsb2N1cyBDbGllbnRcbiAgICogQHR5cGUge0JsYXplLlZpZXd9XG4gICAqL1xuICB0aGlzLnZpZXcgPSB2aWV3O1xuICB0aGlzLmRhdGEgPSBudWxsO1xuXG4gIC8qKlxuICAgKiBAbmFtZSBmaXJzdE5vZGVcbiAgICogQG1lbWJlck9mIEJsYXplLlRlbXBsYXRlSW5zdGFuY2VcbiAgICogQGluc3RhbmNlXG4gICAqIEBzdW1tYXJ5IFRoZSBmaXJzdCB0b3AtbGV2ZWwgRE9NIG5vZGUgaW4gdGhpcyB0ZW1wbGF0ZSBpbnN0YW5jZS5cbiAgICogQGxvY3VzIENsaWVudFxuICAgKiBAdHlwZSB7RE9NTm9kZX1cbiAgICovXG4gIHRoaXMuZmlyc3ROb2RlID0gbnVsbDtcblxuICAvKipcbiAgICogQG5hbWUgbGFzdE5vZGVcbiAgICogQG1lbWJlck9mIEJsYXplLlRlbXBsYXRlSW5zdGFuY2VcbiAgICogQGluc3RhbmNlXG4gICAqIEBzdW1tYXJ5IFRoZSBsYXN0IHRvcC1sZXZlbCBET00gbm9kZSBpbiB0aGlzIHRlbXBsYXRlIGluc3RhbmNlLlxuICAgKiBAbG9jdXMgQ2xpZW50XG4gICAqIEB0eXBlIHtET01Ob2RlfVxuICAgKi9cbiAgdGhpcy5sYXN0Tm9kZSA9IG51bGw7XG5cbiAgLy8gVGhpcyBkZXBlbmRlbmN5IGlzIHVzZWQgdG8gaWRlbnRpZnkgc3RhdGUgdHJhbnNpdGlvbnMgaW5cbiAgLy8gX3N1YnNjcmlwdGlvbkhhbmRsZXMgd2hpY2ggY291bGQgY2F1c2UgdGhlIHJlc3VsdCBvZlxuICAvLyBUZW1wbGF0ZUluc3RhbmNlI3N1YnNjcmlwdGlvbnNSZWFkeSB0byBjaGFuZ2UuIEJhc2ljYWxseSB0aGlzIGlzIHRyaWdnZXJlZFxuICAvLyB3aGVuZXZlciBhIG5ldyBzdWJzY3JpcHRpb24gaGFuZGxlIGlzIGFkZGVkIG9yIHdoZW4gYSBzdWJzY3JpcHRpb24gaGFuZGxlXG4gIC8vIGlzIHJlbW92ZWQgYW5kIHRoZXkgYXJlIG5vdCByZWFkeS5cbiAgdGhpcy5fYWxsU3Vic1JlYWR5RGVwID0gbmV3IFRyYWNrZXIuRGVwZW5kZW5jeSgpO1xuICB0aGlzLl9hbGxTdWJzUmVhZHkgPSBmYWxzZTtcblxuICB0aGlzLl9zdWJzY3JpcHRpb25IYW5kbGVzID0ge307XG59O1xuXG4vKipcbiAqIEBzdW1tYXJ5IEZpbmQgYWxsIGVsZW1lbnRzIG1hdGNoaW5nIGBzZWxlY3RvcmAgaW4gdGhpcyB0ZW1wbGF0ZSBpbnN0YW5jZSwgYW5kIHJldHVybiB0aGVtIGFzIGEgSlF1ZXJ5IG9iamVjdC5cbiAqIEBsb2N1cyBDbGllbnRcbiAqIEBwYXJhbSB7U3RyaW5nfSBzZWxlY3RvciBUaGUgQ1NTIHNlbGVjdG9yIHRvIG1hdGNoLCBzY29wZWQgdG8gdGhlIHRlbXBsYXRlIGNvbnRlbnRzLlxuICogQHJldHVybnMge0RPTU5vZGVbXX1cbiAqL1xuQmxhemUuVGVtcGxhdGVJbnN0YW5jZS5wcm90b3R5cGUuJCA9IGZ1bmN0aW9uIChzZWxlY3Rvcikge1xuICB2YXIgdmlldyA9IHRoaXMudmlldztcbiAgaWYgKCEgdmlldy5fZG9tcmFuZ2UpXG4gICAgdGhyb3cgbmV3IEVycm9yKFwiQ2FuJ3QgdXNlICQgb24gdGVtcGxhdGUgaW5zdGFuY2Ugd2l0aCBubyBET01cIik7XG4gIHJldHVybiB2aWV3Ll9kb21yYW5nZS4kKHNlbGVjdG9yKTtcbn07XG5cbi8qKlxuICogQHN1bW1hcnkgRmluZCBhbGwgZWxlbWVudHMgbWF0Y2hpbmcgYHNlbGVjdG9yYCBpbiB0aGlzIHRlbXBsYXRlIGluc3RhbmNlLlxuICogQGxvY3VzIENsaWVudFxuICogQHBhcmFtIHtTdHJpbmd9IHNlbGVjdG9yIFRoZSBDU1Mgc2VsZWN0b3IgdG8gbWF0Y2gsIHNjb3BlZCB0byB0aGUgdGVtcGxhdGUgY29udGVudHMuXG4gKiBAcmV0dXJucyB7RE9NRWxlbWVudFtdfVxuICovXG5CbGF6ZS5UZW1wbGF0ZUluc3RhbmNlLnByb3RvdHlwZS5maW5kQWxsID0gZnVuY3Rpb24gKHNlbGVjdG9yKSB7XG4gIHJldHVybiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCh0aGlzLiQoc2VsZWN0b3IpKTtcbn07XG5cbi8qKlxuICogQHN1bW1hcnkgRmluZCBvbmUgZWxlbWVudCBtYXRjaGluZyBgc2VsZWN0b3JgIGluIHRoaXMgdGVtcGxhdGUgaW5zdGFuY2UuXG4gKiBAbG9jdXMgQ2xpZW50XG4gKiBAcGFyYW0ge1N0cmluZ30gc2VsZWN0b3IgVGhlIENTUyBzZWxlY3RvciB0byBtYXRjaCwgc2NvcGVkIHRvIHRoZSB0ZW1wbGF0ZSBjb250ZW50cy5cbiAqIEByZXR1cm5zIHtET01FbGVtZW50fVxuICovXG5CbGF6ZS5UZW1wbGF0ZUluc3RhbmNlLnByb3RvdHlwZS5maW5kID0gZnVuY3Rpb24gKHNlbGVjdG9yKSB7XG4gIHZhciByZXN1bHQgPSB0aGlzLiQoc2VsZWN0b3IpO1xuICByZXR1cm4gcmVzdWx0WzBdIHx8IG51bGw7XG59O1xuXG4vKipcbiAqIEBzdW1tYXJ5IEEgdmVyc2lvbiBvZiBbVHJhY2tlci5hdXRvcnVuXShodHRwczovL2RvY3MubWV0ZW9yLmNvbS9hcGkvdHJhY2tlci5odG1sI1RyYWNrZXItYXV0b3J1bikgdGhhdCBpcyBzdG9wcGVkIHdoZW4gdGhlIHRlbXBsYXRlIGlzIGRlc3Ryb3llZC5cbiAqIEBsb2N1cyBDbGllbnRcbiAqIEBwYXJhbSB7RnVuY3Rpb259IHJ1bkZ1bmMgVGhlIGZ1bmN0aW9uIHRvIHJ1bi4gSXQgcmVjZWl2ZXMgb25lIGFyZ3VtZW50OiBhIFRyYWNrZXIuQ29tcHV0YXRpb24gb2JqZWN0LlxuICovXG5CbGF6ZS5UZW1wbGF0ZUluc3RhbmNlLnByb3RvdHlwZS5hdXRvcnVuID0gZnVuY3Rpb24gKGYpIHtcbiAgcmV0dXJuIHRoaXMudmlldy5hdXRvcnVuKGYpO1xufTtcblxuLyoqXG4gKiBAc3VtbWFyeSBBIHZlcnNpb24gb2YgW01ldGVvci5zdWJzY3JpYmVdKGh0dHBzOi8vZG9jcy5tZXRlb3IuY29tL2FwaS9wdWJzdWIuaHRtbCNNZXRlb3Itc3Vic2NyaWJlKSB0aGF0IGlzIHN0b3BwZWRcbiAqIHdoZW4gdGhlIHRlbXBsYXRlIGlzIGRlc3Ryb3llZC5cbiAqIEByZXR1cm4ge1N1YnNjcmlwdGlvbkhhbmRsZX0gVGhlIHN1YnNjcmlwdGlvbiBoYW5kbGUgdG8gdGhlIG5ld2x5IG1hZGVcbiAqIHN1YnNjcmlwdGlvbi4gQ2FsbCBgaGFuZGxlLnN0b3AoKWAgdG8gbWFudWFsbHkgc3RvcCB0aGUgc3Vic2NyaXB0aW9uLCBvclxuICogYGhhbmRsZS5yZWFkeSgpYCB0byBmaW5kIG91dCBpZiB0aGlzIHBhcnRpY3VsYXIgc3Vic2NyaXB0aW9uIGhhcyBsb2FkZWQgYWxsXG4gKiBvZiBpdHMgaW5pdGFsIGRhdGEuXG4gKiBAbG9jdXMgQ2xpZW50XG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZSBOYW1lIG9mIHRoZSBzdWJzY3JpcHRpb24uICBNYXRjaGVzIHRoZSBuYW1lIG9mIHRoZVxuICogc2VydmVyJ3MgYHB1Ymxpc2goKWAgY2FsbC5cbiAqIEBwYXJhbSB7QW55fSBbYXJnMSxhcmcyLi4uXSBPcHRpb25hbCBhcmd1bWVudHMgcGFzc2VkIHRvIHB1Ymxpc2hlciBmdW5jdGlvblxuICogb24gc2VydmVyLlxuICogQHBhcmFtIHtGdW5jdGlvbnxPYmplY3R9IFtvcHRpb25zXSBJZiBhIGZ1bmN0aW9uIGlzIHBhc3NlZCBpbnN0ZWFkIG9mIGFuXG4gKiBvYmplY3QsIGl0IGlzIGludGVycHJldGVkIGFzIGFuIGBvblJlYWR5YCBjYWxsYmFjay5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IFtvcHRpb25zLm9uUmVhZHldIFBhc3NlZCB0byBbYE1ldGVvci5zdWJzY3JpYmVgXShodHRwczovL2RvY3MubWV0ZW9yLmNvbS9hcGkvcHVic3ViLmh0bWwjTWV0ZW9yLXN1YnNjcmliZSkuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb3B0aW9ucy5vblN0b3BdIFBhc3NlZCB0byBbYE1ldGVvci5zdWJzY3JpYmVgXShodHRwczovL2RvY3MubWV0ZW9yLmNvbS9hcGkvcHVic3ViLmh0bWwjTWV0ZW9yLXN1YnNjcmliZSkuXG4gKiBAcGFyYW0ge0REUC5Db25uZWN0aW9ufSBbb3B0aW9ucy5jb25uZWN0aW9uXSBUaGUgY29ubmVjdGlvbiBvbiB3aGljaCB0byBtYWtlIHRoZVxuICogc3Vic2NyaXB0aW9uLlxuICovXG5CbGF6ZS5UZW1wbGF0ZUluc3RhbmNlLnByb3RvdHlwZS5zdWJzY3JpYmUgPSBmdW5jdGlvbiAoLi4uYXJncykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgdmFyIHN1YkhhbmRsZXMgPSBzZWxmLl9zdWJzY3JpcHRpb25IYW5kbGVzO1xuXG4gIC8vIER1cGxpY2F0ZSBsb2dpYyBmcm9tIE1ldGVvci5zdWJzY3JpYmVcbiAgdmFyIG9wdGlvbnMgPSB7fTtcbiAgaWYgKGFyZ3MubGVuZ3RoKSB7XG4gICAgdmFyIGxhc3RQYXJhbSA9IGFyZ3NbYXJncy5sZW5ndGggLSAxXTtcblxuICAgIC8vIE1hdGNoIHBhdHRlcm4gdG8gY2hlY2sgaWYgdGhlIGxhc3QgYXJnIGlzIGFuIG9wdGlvbnMgYXJndW1lbnRcbiAgICB2YXIgbGFzdFBhcmFtT3B0aW9uc1BhdHRlcm4gPSB7XG4gICAgICBvblJlYWR5OiBNYXRjaC5PcHRpb25hbChGdW5jdGlvbiksXG4gICAgICAvLyBYWFggQ09NUEFUIFdJVEggMS4wLjMuMSBvbkVycm9yIHVzZWQgdG8gZXhpc3QsIGJ1dCBub3cgd2UgdXNlXG4gICAgICAvLyBvblN0b3Agd2l0aCBhbiBlcnJvciBjYWxsYmFjayBpbnN0ZWFkLlxuICAgICAgb25FcnJvcjogTWF0Y2guT3B0aW9uYWwoRnVuY3Rpb24pLFxuICAgICAgb25TdG9wOiBNYXRjaC5PcHRpb25hbChGdW5jdGlvbiksXG4gICAgICBjb25uZWN0aW9uOiBNYXRjaC5PcHRpb25hbChNYXRjaC5BbnkpXG4gICAgfTtcblxuICAgIGlmIChpc0Z1bmN0aW9uKGxhc3RQYXJhbSkpIHtcbiAgICAgIG9wdGlvbnMub25SZWFkeSA9IGFyZ3MucG9wKCk7XG4gICAgfSBlbHNlIGlmIChsYXN0UGFyYW0gJiYgISBpc0VtcHR5KGxhc3RQYXJhbSkgJiYgTWF0Y2gudGVzdChsYXN0UGFyYW0sIGxhc3RQYXJhbU9wdGlvbnNQYXR0ZXJuKSkge1xuICAgICAgb3B0aW9ucyA9IGFyZ3MucG9wKCk7XG4gICAgfVxuICB9XG5cbiAgdmFyIHN1YkhhbmRsZTtcbiAgdmFyIG9sZFN0b3BwZWQgPSBvcHRpb25zLm9uU3RvcDtcbiAgb3B0aW9ucy5vblN0b3AgPSBmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICAvLyBXaGVuIHRoZSBzdWJzY3JpcHRpb24gaXMgc3RvcHBlZCwgcmVtb3ZlIGl0IGZyb20gdGhlIHNldCBvZiB0cmFja2VkXG4gICAgLy8gc3Vic2NyaXB0aW9ucyB0byBhdm9pZCB0aGlzIGxpc3QgZ3Jvd2luZyB3aXRob3V0IGJvdW5kXG4gICAgZGVsZXRlIHN1YkhhbmRsZXNbc3ViSGFuZGxlLnN1YnNjcmlwdGlvbklkXTtcblxuICAgIC8vIFJlbW92aW5nIGEgc3Vic2NyaXB0aW9uIGNhbiBvbmx5IGNoYW5nZSB0aGUgcmVzdWx0IG9mIHN1YnNjcmlwdGlvbnNSZWFkeVxuICAgIC8vIGlmIHdlIGFyZSBub3QgcmVhZHkgKHRoYXQgc3Vic2NyaXB0aW9uIGNvdWxkIGJlIHRoZSBvbmUgYmxvY2tpbmcgdXMgYmVpbmdcbiAgICAvLyByZWFkeSkuXG4gICAgaWYgKCEgc2VsZi5fYWxsU3Vic1JlYWR5KSB7XG4gICAgICBzZWxmLl9hbGxTdWJzUmVhZHlEZXAuY2hhbmdlZCgpO1xuICAgIH1cblxuICAgIGlmIChvbGRTdG9wcGVkKSB7XG4gICAgICBvbGRTdG9wcGVkKGVycm9yKTtcbiAgICB9XG4gIH07XG5cbiAgdmFyIGNvbm5lY3Rpb24gPSBvcHRpb25zLmNvbm5lY3Rpb247XG4gIGNvbnN0IHsgb25SZWFkeSwgb25FcnJvciwgb25TdG9wIH0gPSBvcHRpb25zO1xuICB2YXIgY2FsbGJhY2tzID0geyBvblJlYWR5LCBvbkVycm9yLCBvblN0b3AgfTtcblxuICAvLyBUaGUgY2FsbGJhY2tzIGFyZSBwYXNzZWQgYXMgdGhlIGxhc3QgaXRlbSBpbiB0aGUgYXJndW1lbnRzIGFycmF5IHBhc3NlZCB0b1xuICAvLyBWaWV3I3N1YnNjcmliZVxuICBhcmdzLnB1c2goY2FsbGJhY2tzKTtcblxuICAvLyBWaWV3I3N1YnNjcmliZSB0YWtlcyB0aGUgY29ubmVjdGlvbiBhcyBvbmUgb2YgdGhlIG9wdGlvbnMgaW4gdGhlIGxhc3RcbiAgLy8gYXJndW1lbnRcbiAgc3ViSGFuZGxlID0gc2VsZi52aWV3LnN1YnNjcmliZS5jYWxsKHNlbGYudmlldywgYXJncywge1xuICAgIGNvbm5lY3Rpb246IGNvbm5lY3Rpb25cbiAgfSk7XG5cbiAgaWYgKCFoYXMoc3ViSGFuZGxlcywgc3ViSGFuZGxlLnN1YnNjcmlwdGlvbklkKSkge1xuICAgIHN1YkhhbmRsZXNbc3ViSGFuZGxlLnN1YnNjcmlwdGlvbklkXSA9IHN1YkhhbmRsZTtcblxuICAgIC8vIEFkZGluZyBhIG5ldyBzdWJzY3JpcHRpb24gd2lsbCBhbHdheXMgY2F1c2UgdXMgdG8gdHJhbnNpdGlvbiBmcm9tIHJlYWR5XG4gICAgLy8gdG8gbm90IHJlYWR5LCBidXQgaWYgd2UgYXJlIGFscmVhZHkgbm90IHJlYWR5IHRoZW4gdGhpcyBjYW4ndCBtYWtlIHVzXG4gICAgLy8gcmVhZHkuXG4gICAgaWYgKHNlbGYuX2FsbFN1YnNSZWFkeSkge1xuICAgICAgc2VsZi5fYWxsU3Vic1JlYWR5RGVwLmNoYW5nZWQoKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gc3ViSGFuZGxlO1xufTtcblxuLyoqXG4gKiBAc3VtbWFyeSBBIHJlYWN0aXZlIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyB0cnVlIHdoZW4gYWxsIG9mIHRoZSBzdWJzY3JpcHRpb25zXG4gKiBjYWxsZWQgd2l0aCBbdGhpcy5zdWJzY3JpYmVdKCNUZW1wbGF0ZUluc3RhbmNlLXN1YnNjcmliZSkgYXJlIHJlYWR5LlxuICogQHJldHVybiB7Qm9vbGVhbn0gVHJ1ZSBpZiBhbGwgc3Vic2NyaXB0aW9ucyBvbiB0aGlzIHRlbXBsYXRlIGluc3RhbmNlIGFyZVxuICogcmVhZHkuXG4gKi9cbkJsYXplLlRlbXBsYXRlSW5zdGFuY2UucHJvdG90eXBlLnN1YnNjcmlwdGlvbnNSZWFkeSA9IGZ1bmN0aW9uICgpIHtcbiAgdGhpcy5fYWxsU3Vic1JlYWR5RGVwLmRlcGVuZCgpO1xuICB0aGlzLl9hbGxTdWJzUmVhZHkgPSBPYmplY3QudmFsdWVzKHRoaXMuX3N1YnNjcmlwdGlvbkhhbmRsZXMpLmV2ZXJ5KChoYW5kbGUpID0+IHsgIFxuICAgIHJldHVybiBoYW5kbGUucmVhZHkoKTtcbiAgfSk7XG5cbiAgcmV0dXJuIHRoaXMuX2FsbFN1YnNSZWFkeTtcbn07XG5cbi8qKlxuICogQHN1bW1hcnkgU3BlY2lmeSB0ZW1wbGF0ZSBoZWxwZXJzIGF2YWlsYWJsZSB0byB0aGlzIHRlbXBsYXRlLlxuICogQGxvY3VzIENsaWVudFxuICogQHBhcmFtIHtPYmplY3R9IGhlbHBlcnMgRGljdGlvbmFyeSBvZiBoZWxwZXIgZnVuY3Rpb25zIGJ5IG5hbWUuXG4gKiBAaW1wb3J0RnJvbVBhY2thZ2UgdGVtcGxhdGluZ1xuICovXG5UZW1wbGF0ZS5wcm90b3R5cGUuaGVscGVycyA9IGZ1bmN0aW9uIChkaWN0KSB7XG4gIGlmICghaXNPYmplY3QoZGljdCkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJIZWxwZXJzIGRpY3Rpb25hcnkgaGFzIHRvIGJlIGFuIG9iamVjdFwiKTtcbiAgfVxuXG4gIGZvciAodmFyIGsgaW4gZGljdCkgdGhpcy5fX2hlbHBlcnMuc2V0KGssIGRpY3Rba10pO1xufTtcblxudmFyIGNhblVzZUdldHRlcnMgPSAoZnVuY3Rpb24gKCkge1xuICBpZiAoT2JqZWN0LmRlZmluZVByb3BlcnR5KSB7XG4gICAgdmFyIG9iaiA9IHt9O1xuICAgIHRyeSB7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkob2JqLCBcInNlbGZcIiwge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHsgcmV0dXJuIG9iajsgfVxuICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gb2JqLnNlbGYgPT09IG9iajtcbiAgfVxuICByZXR1cm4gZmFsc2U7XG59KSgpO1xuXG5pZiAoY2FuVXNlR2V0dGVycykge1xuICAvLyBMaWtlIEJsYXplLmN1cnJlbnRWaWV3IGJ1dCBmb3IgdGhlIHRlbXBsYXRlIGluc3RhbmNlLiBBIGZ1bmN0aW9uXG4gIC8vIHJhdGhlciB0aGFuIGEgdmFsdWUgc28gdGhhdCBub3QgYWxsIGhlbHBlcnMgYXJlIGltcGxpY2l0bHkgZGVwZW5kZW50XG4gIC8vIG9uIHRoZSBjdXJyZW50IHRlbXBsYXRlIGluc3RhbmNlJ3MgYGRhdGFgIHByb3BlcnR5LCB3aGljaCB3b3VsZCBtYWtlXG4gIC8vIHRoZW0gZGVwZW5kZW50IG9uIHRoZSBkYXRhIGNvbnRleHQgb2YgdGhlIHRlbXBsYXRlIGluY2x1c2lvbi5cbiAgdmFyIGN1cnJlbnRUZW1wbGF0ZUluc3RhbmNlRnVuYyA9IG51bGw7XG5cbiAgLy8gSWYgZ2V0dGVycyBhcmUgc3VwcG9ydGVkLCBkZWZpbmUgdGhpcyBwcm9wZXJ0eSB3aXRoIGEgZ2V0dGVyIGZ1bmN0aW9uXG4gIC8vIHRvIG1ha2UgaXQgZWZmZWN0aXZlbHkgcmVhZC1vbmx5LCBhbmQgdG8gd29yayBhcm91bmQgdGhpcyBiaXphcnJlIEpTQ1xuICAvLyBidWc6IGh0dHBzOi8vZ2l0aHViLmNvbS9tZXRlb3IvbWV0ZW9yL2lzc3Vlcy85OTI2XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShUZW1wbGF0ZSwgXCJfY3VycmVudFRlbXBsYXRlSW5zdGFuY2VGdW5jXCIsIHtcbiAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiBjdXJyZW50VGVtcGxhdGVJbnN0YW5jZUZ1bmM7XG4gICAgfVxuICB9KTtcblxuICBUZW1wbGF0ZS5fd2l0aFRlbXBsYXRlSW5zdGFuY2VGdW5jID0gZnVuY3Rpb24gKHRlbXBsYXRlSW5zdGFuY2VGdW5jLCBmdW5jKSB7XG4gICAgaWYgKHR5cGVvZiBmdW5jICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJFeHBlY3RlZCBmdW5jdGlvbiwgZ290OiBcIiArIGZ1bmMpO1xuICAgIH1cbiAgICB2YXIgb2xkVG1wbEluc3RhbmNlRnVuYyA9IGN1cnJlbnRUZW1wbGF0ZUluc3RhbmNlRnVuYztcbiAgICB0cnkge1xuICAgICAgY3VycmVudFRlbXBsYXRlSW5zdGFuY2VGdW5jID0gdGVtcGxhdGVJbnN0YW5jZUZ1bmM7XG4gICAgICByZXR1cm4gZnVuYygpO1xuICAgIH0gZmluYWxseSB7XG4gICAgICBjdXJyZW50VGVtcGxhdGVJbnN0YW5jZUZ1bmMgPSBvbGRUbXBsSW5zdGFuY2VGdW5jO1xuICAgIH1cbiAgfTtcbn0gZWxzZSB7XG4gIC8vIElmIGdldHRlcnMgYXJlIG5vdCBzdXBwb3J0ZWQsIGp1c3QgdXNlIGEgbm9ybWFsIHByb3BlcnR5LlxuICBUZW1wbGF0ZS5fY3VycmVudFRlbXBsYXRlSW5zdGFuY2VGdW5jID0gbnVsbDtcblxuICBUZW1wbGF0ZS5fd2l0aFRlbXBsYXRlSW5zdGFuY2VGdW5jID0gZnVuY3Rpb24gKHRlbXBsYXRlSW5zdGFuY2VGdW5jLCBmdW5jKSB7XG4gICAgaWYgKHR5cGVvZiBmdW5jICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJFeHBlY3RlZCBmdW5jdGlvbiwgZ290OiBcIiArIGZ1bmMpO1xuICAgIH1cbiAgICB2YXIgb2xkVG1wbEluc3RhbmNlRnVuYyA9IFRlbXBsYXRlLl9jdXJyZW50VGVtcGxhdGVJbnN0YW5jZUZ1bmM7XG4gICAgdHJ5IHtcbiAgICAgIFRlbXBsYXRlLl9jdXJyZW50VGVtcGxhdGVJbnN0YW5jZUZ1bmMgPSB0ZW1wbGF0ZUluc3RhbmNlRnVuYztcbiAgICAgIHJldHVybiBmdW5jKCk7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIFRlbXBsYXRlLl9jdXJyZW50VGVtcGxhdGVJbnN0YW5jZUZ1bmMgPSBvbGRUbXBsSW5zdGFuY2VGdW5jO1xuICAgIH1cbiAgfTtcbn1cblxuLyoqXG4gKiBAc3VtbWFyeSBTcGVjaWZ5IGV2ZW50IGhhbmRsZXJzIGZvciB0aGlzIHRlbXBsYXRlLlxuICogQGxvY3VzIENsaWVudFxuICogQHBhcmFtIHtFdmVudE1hcH0gZXZlbnRNYXAgRXZlbnQgaGFuZGxlcnMgdG8gYXNzb2NpYXRlIHdpdGggdGhpcyB0ZW1wbGF0ZS5cbiAqIEBpbXBvcnRGcm9tUGFja2FnZSB0ZW1wbGF0aW5nXG4gKi9cblRlbXBsYXRlLnByb3RvdHlwZS5ldmVudHMgPSBmdW5jdGlvbiAoZXZlbnRNYXApIHtcbiAgaWYgKCFpc09iamVjdChldmVudE1hcCkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJFdmVudCBtYXAgaGFzIHRvIGJlIGFuIG9iamVjdFwiKTtcbiAgfVxuXG4gIHZhciB0ZW1wbGF0ZSA9IHRoaXM7XG4gIHZhciBldmVudE1hcDIgPSB7fTtcbiAgZm9yICh2YXIgayBpbiBldmVudE1hcCkge1xuICAgIGV2ZW50TWFwMltrXSA9IChmdW5jdGlvbiAoaywgdikge1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uIChldmVudCAvKiwgLi4uKi8pIHtcbiAgICAgICAgdmFyIHZpZXcgPSB0aGlzOyAvLyBwYXNzZWQgYnkgRXZlbnRBdWdtZW50ZXJcbiAgICAgICAgdmFyIGRhdGEgPSBCbGF6ZS5nZXREYXRhKGV2ZW50LmN1cnJlbnRUYXJnZXQpO1xuICAgICAgICBpZiAoZGF0YSA9PSBudWxsKSBkYXRhID0ge307XG4gICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgICAgICAgdmFyIHRtcGxJbnN0YW5jZUZ1bmMgPSBCbGF6ZS5fYmluZCh2aWV3LnRlbXBsYXRlSW5zdGFuY2UsIHZpZXcpO1xuICAgICAgICBhcmdzLnNwbGljZSgxLCAwLCB0bXBsSW5zdGFuY2VGdW5jKCkpO1xuXG4gICAgICAgIHJldHVybiBUZW1wbGF0ZS5fd2l0aFRlbXBsYXRlSW5zdGFuY2VGdW5jKHRtcGxJbnN0YW5jZUZ1bmMsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICByZXR1cm4gdi5hcHBseShkYXRhLCBhcmdzKTtcbiAgICAgICAgfSk7XG4gICAgICB9O1xuICAgIH0pKGssIGV2ZW50TWFwW2tdKTtcbiAgfVxuXG4gIHRlbXBsYXRlLl9fZXZlbnRNYXBzLnB1c2goZXZlbnRNYXAyKTtcbn07XG5cbi8qKlxuICogQGZ1bmN0aW9uXG4gKiBAbmFtZSBpbnN0YW5jZVxuICogQG1lbWJlck9mIFRlbXBsYXRlXG4gKiBAc3VtbWFyeSBUaGUgW3RlbXBsYXRlIGluc3RhbmNlXSgjVGVtcGxhdGUtaW5zdGFuY2VzKSBjb3JyZXNwb25kaW5nIHRvIHRoZSBjdXJyZW50IHRlbXBsYXRlIGhlbHBlciwgZXZlbnQgaGFuZGxlciwgY2FsbGJhY2ssIG9yIGF1dG9ydW4uICBJZiB0aGVyZSBpc24ndCBvbmUsIGBudWxsYC5cbiAqIEBsb2N1cyBDbGllbnRcbiAqIEByZXR1cm5zIHtCbGF6ZS5UZW1wbGF0ZUluc3RhbmNlfVxuICogQGltcG9ydEZyb21QYWNrYWdlIHRlbXBsYXRpbmdcbiAqL1xuVGVtcGxhdGUuaW5zdGFuY2UgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiBUZW1wbGF0ZS5fY3VycmVudFRlbXBsYXRlSW5zdGFuY2VGdW5jXG4gICAgJiYgVGVtcGxhdGUuX2N1cnJlbnRUZW1wbGF0ZUluc3RhbmNlRnVuYygpO1xufTtcblxuLy8gTm90ZTogVGVtcGxhdGUuY3VycmVudERhdGEoKSBpcyBkb2N1bWVudGVkIHRvIHRha2UgemVybyBhcmd1bWVudHMsXG4vLyB3aGlsZSBCbGF6ZS5nZXREYXRhIHRha2VzIHVwIHRvIG9uZS5cblxuLyoqXG4gKiBAc3VtbWFyeVxuICpcbiAqIC0gSW5zaWRlIGFuIGBvbkNyZWF0ZWRgLCBgb25SZW5kZXJlZGAsIG9yIGBvbkRlc3Ryb3llZGAgY2FsbGJhY2ssIHJldHVybnNcbiAqIHRoZSBkYXRhIGNvbnRleHQgb2YgdGhlIHRlbXBsYXRlLlxuICogLSBJbnNpZGUgYW4gZXZlbnQgaGFuZGxlciwgcmV0dXJucyB0aGUgZGF0YSBjb250ZXh0IG9mIHRoZSB0ZW1wbGF0ZSBvbiB3aGljaFxuICogdGhpcyBldmVudCBoYW5kbGVyIHdhcyBkZWZpbmVkLlxuICogLSBJbnNpZGUgYSBoZWxwZXIsIHJldHVybnMgdGhlIGRhdGEgY29udGV4dCBvZiB0aGUgRE9NIG5vZGUgd2hlcmUgdGhlIGhlbHBlclxuICogd2FzIHVzZWQuXG4gKlxuICogRXN0YWJsaXNoZXMgYSByZWFjdGl2ZSBkZXBlbmRlbmN5IG9uIHRoZSByZXN1bHQuXG4gKiBAbG9jdXMgQ2xpZW50XG4gKiBAZnVuY3Rpb25cbiAqIEBpbXBvcnRGcm9tUGFja2FnZSB0ZW1wbGF0aW5nXG4gKi9cblRlbXBsYXRlLmN1cnJlbnREYXRhID0gQmxhemUuZ2V0RGF0YTtcblxuLyoqXG4gKiBAc3VtbWFyeSBBY2Nlc3NlcyBvdGhlciBkYXRhIGNvbnRleHRzIHRoYXQgZW5jbG9zZSB0aGUgY3VycmVudCBkYXRhIGNvbnRleHQuXG4gKiBAbG9jdXMgQ2xpZW50XG4gKiBAZnVuY3Rpb25cbiAqIEBwYXJhbSB7SW50ZWdlcn0gW251bUxldmVsc10gVGhlIG51bWJlciBvZiBsZXZlbHMgYmV5b25kIHRoZSBjdXJyZW50IGRhdGEgY29udGV4dCB0byBsb29rLiBEZWZhdWx0cyB0byAxLlxuICogQGltcG9ydEZyb21QYWNrYWdlIHRlbXBsYXRpbmdcbiAqL1xuVGVtcGxhdGUucGFyZW50RGF0YSA9IEJsYXplLl9wYXJlbnREYXRhO1xuXG4vKipcbiAqIEBzdW1tYXJ5IERlZmluZXMgYSBbaGVscGVyIGZ1bmN0aW9uXSgjVGVtcGxhdGUtaGVscGVycykgd2hpY2ggY2FuIGJlIHVzZWQgZnJvbSBhbGwgdGVtcGxhdGVzLlxuICogQGxvY3VzIENsaWVudFxuICogQGZ1bmN0aW9uXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZSBUaGUgbmFtZSBvZiB0aGUgaGVscGVyIGZ1bmN0aW9uIHlvdSBhcmUgZGVmaW5pbmcuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmdW5jdGlvbiBUaGUgaGVscGVyIGZ1bmN0aW9uIGl0c2VsZi5cbiAqIEBpbXBvcnRGcm9tUGFja2FnZSB0ZW1wbGF0aW5nXG4gKi9cblRlbXBsYXRlLnJlZ2lzdGVySGVscGVyID0gQmxhemUucmVnaXN0ZXJIZWxwZXI7XG5cbi8qKlxuICogQHN1bW1hcnkgUmVtb3ZlcyBhIGdsb2JhbCBbaGVscGVyIGZ1bmN0aW9uXSgjVGVtcGxhdGUtaGVscGVycykuXG4gKiBAbG9jdXMgQ2xpZW50XG4gKiBAZnVuY3Rpb25cbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIFRoZSBuYW1lIG9mIHRoZSBoZWxwZXIgZnVuY3Rpb24geW91IGFyZSBkZWZpbmluZy5cbiAqIEBpbXBvcnRGcm9tUGFja2FnZSB0ZW1wbGF0aW5nXG4gKi9cblRlbXBsYXRlLmRlcmVnaXN0ZXJIZWxwZXIgPSBCbGF6ZS5kZXJlZ2lzdGVySGVscGVyO1xuIiwiVUkgPSBCbGF6ZTtcblxuQmxhemUuUmVhY3RpdmVWYXIgPSBSZWFjdGl2ZVZhcjtcblVJLl90ZW1wbGF0ZUluc3RhbmNlID0gQmxhemUuVGVtcGxhdGUuaW5zdGFuY2U7XG5cbkhhbmRsZWJhcnMgPSB7fTtcbkhhbmRsZWJhcnMucmVnaXN0ZXJIZWxwZXIgPSBCbGF6ZS5yZWdpc3RlckhlbHBlcjtcblxuSGFuZGxlYmFycy5fZXNjYXBlID0gQmxhemUuX2VzY2FwZTtcblxuLy8gUmV0dXJuIHRoZXNlIGZyb20ge3suLi59fSBoZWxwZXJzIHRvIGFjaGlldmUgdGhlIHNhbWUgYXMgcmV0dXJuaW5nXG4vLyBzdHJpbmdzIGZyb20ge3t7Li4ufX19IGhlbHBlcnNcbkhhbmRsZWJhcnMuU2FmZVN0cmluZyA9IGZ1bmN0aW9uKHN0cmluZykge1xuICB0aGlzLnN0cmluZyA9IHN0cmluZztcbn07XG5IYW5kbGViYXJzLlNhZmVTdHJpbmcucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiB0aGlzLnN0cmluZy50b1N0cmluZygpO1xufTtcbiJdfQ==
