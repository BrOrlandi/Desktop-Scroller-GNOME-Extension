// Desktop Scroller.
// Copyright (C) 2011-2012 Marcos Diaz <diazmencia@gmail.com>.
// Copyright (C) 2012 Arnaud Bonatti <arnaud.bonatti@gmail.com>.
// Copyright (C) 2012 Bruno Orlandi <brorlandi@gmail.com>.
// Copyright (C) 2013 Thomas Wendt <thoemy@gmail.com>.
//
// Desktop Scroller is libre software: you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation, either version 2 of the License, or newer.
//
// You should have received a copy of the GNU General Public License along with
// this file. If not, see <http://www.gnu.org/licenses/>.

const TAG = 'DesktopScroller'

const Gettext = imports.gettext.domain('gnome-shell-extensions');
const _ = Gettext.gettext;

const Clutter = imports.gi.Clutter
const Lang = imports.lang
const Main = imports.ui.main
const Meta = imports.gi.Meta

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

let settings = null;
let desktopscroller = null;

const KEY_SCROLL_EDGES = 'scroll-edges';
const KEY_DESKTOP_SCROLL = 'desktop-scroll';

const ScrollEdges = {
    left: {flag: 1 << 0, name: "Left"},
    right: {flag: 1 << 1, name: "Right"},
    top: {flag: 1 << 2, name: "Top"},
    bottom: {flag: 1 << 3, name: "Bottom"},
};

const SCROLL_WIDTH = 1;

/**
 * Logging function
 */
function l() {
    let args = Array.prototype.slice.call(arguments);
    let message = TAG + ": " + args.join('');
    log(message);
}

function Scroller() {
    this._init();
}

Scroller.prototype = {
    _init : function() {
        /**
         * Clutter actors for the edges.
         */
        this.edge_actors = {};
        /**
         * Handler ids added to actors not in our control such as the
         * background.
         */
        this.handlers = {'background' : [], 'switcher' : [], 'misc' : []};

        this.monitors = this._getMonitors();
        this._setupEdgeActors();

        if(settings.get_boolean(KEY_DESKTOP_SCROLL))
            this._enableBackgroundScrolling();

        let handler = Lang.bind(this, this._onSettingsChanged);
        let handlerId = settings.connect('changed', handler);
        this.handlers['misc'].push([settings, handlerId]);
    },

    _onSettingsChanged: function(settings, key) {
        l('Settings changed: ', key);
        switch(key) {
        case KEY_SCROLL_EDGES:
            this._setupEdgeActors();
            break;
        case KEY_DESKTOP_SCROLL:
            let value = settings.get_boolean(key);
            if(value)
                this._enableBackgroundScrolling();
            else
                this._disableBackgroundScrolling();
            break;
        }
    },

    /**
     * Returns a dict with the leftmost, rightmost, topmost and bottommost monitors.
     */
    _getMonitors: function() {
	let monitors = Main.layoutManager.monitors;

        let max = {'right' : -Infinity, 'bottom' : -Infinity};
        let min = {'left' : Infinity, 'top' : Infinity};

        let monitor_dict = {'left' : null, 'right' : null,
                            'top' : null, 'bottom' : null};

        for(var i=0; i<monitors.length; i++) {
            let left = monitors[i].x;
            let right = monitors[i].x + monitors[i].width;
            let top =  monitors[i].y;
            let bottom =  monitors[i].y + monitors[i].height;

            if(left < min.left) {
                min.left = left;
                monitor_dict.left = monitors[i];
            }
            if(right > max.right) {
                max.right = right;
                monitor_dict.right = monitors[i];
            }
            if(top < min.top) {
                min.top = top;
                monitor_dict.top = monitors[i];
            }
            if(bottom > max.bottom) {
                max.bottom = bottom;
                monitor_dict.bottom = monitors[i];
            }
        }

        return monitor_dict;
    },

    /**
     * Creates enabled scroll edges on the monitor beloning to it.
     */
    _setupEdgeActors: function() {
        let edges_setting = settings.get_flags(KEY_SCROLL_EDGES);

        for(let name in ScrollEdges) {
            let edge = ScrollEdges[name];
            let enabled = edges_setting & edge.flag;

            // Destroy existing
            if(this.edge_actors[name]) {
                l('destroying ' + name + ' actor');
                let actor = this.edge_actors[name];
	        Main.layoutManager.removeChrome(actor);
	        actor.destroy();
                delete this.edge_actors[name];
            }

            if(enabled) {
                l('creating ' + name + ' actor');

                let monitor = this.monitors[name];
                let actor = this._createScrollArea(monitor, edge);
                this.edge_actors[name] = actor
                this._addActor(actor);
            }
        }
    },

    _createScrollArea: function(monitor, edge) {
        var y_offset = 0;
        /* Make sure we don't go over the panel */
        if(monitor == Main.layoutManager.primaryMonitor)
            y_offset = Main.panel.actor.get_height() + Main.panel._leftCorner.actor.get_height();

        /* Default values for the left side */
	var x = 0;
	var y = y_offset;
	var width = SCROLL_WIDTH;
	var height = monitor.height - y;

        switch (edge) {
	case ScrollEdges.left:
            break;

	case ScrollEdges.right:
	    x = monitor.x + monitor.width - width;
	    break;
	}

	var actor = new Clutter.Rectangle({
	    name: 'scroller_' + edge.name,
	    reactive: true,
            opacity: 0,
            x: x,
            y: y,
            height: height,
            width: width
	});

        return actor;
    },

    /**
     * Enables the background scrolling if enabled.
     */
    _enableBackgroundScrolling: function() {
        l('enabling background scrolling');

        try {
            let bgManagers = Main.layoutManager._bgManagers;
            for(let i=0; i<bgManagers.length; i++) {
                let actor = bgManagers[i].background.actor;
                this._addActor(actor, true, 'background');
            }
        } catch(e) {
            l('Error while initializing background scrolling!');
            l( e);
        }
    },

    /**
     * Stops the background scrolling.
     */
    _disableBackgroundScrolling: function() {
        l('disabling background scrolling');

        this._disconnectHandlerList(this.handlers.background);
        this.handlers.background = [];
    },

    /*
     * Disconnect a list of handlers from their actors.
     */
    _disconnectHandlerList: function(handler_list) {
        for(let i=0; i<handler_list.length; i++) {
            let [actor, handlerId] = handler_list[i];
            actor.disconnect(handlerId);
        }
    },

    /**
     * _addActor: Add the scroll-event handler to the passed actor.
     * @actor: The actor.
     * @noadd: (optional): Set to true if actor is not under our control.
     * @type: (optional): Type of the actor. For example 'background' or 'switcher'.
     *
     * Adds the scroll-event handler to an actor. @noadd should be true for actors that
     * are not in the control of this extension. For those actors the handlers have to
     * be removed when destroying the extension.
     */
    _addActor: function(actor, noadd, type) {
        let handler = Lang.bind(this, this._onScrollEventSwitcher);
        let handler_id = actor.connect('scroll-event', handler);
        if(!noadd) {
            let args = {/*visibleInFullscreen:true*/};
	    Main.layoutManager.addChrome(actor, args);
        } else {
            // Keep those handler ids for the background or switcher around so
            // we can disconnect them in destroy().
            if(!type)
                type = 'misc';

            if(!this.handlers[type])
                this.handlers[type] = [];

            this.handlers[type].push([actor, handler_id]);
            let self = this;
            actor.connect('destroy', function(actor, event) {
                self._onActorDestroyed(actor, event, type);
            });
        }
        return handler_id;
    },

    /**
     * Keeps our handler id list up to date when an actor is destroyed. May
     * happen if a background/monitor is removed or the switcher is destoryed.
     */
    _onActorDestroyed: function(actor, event, type) {
        l('actor: ', actor, 'type (', type, ') destroyed');

        for(let i=this.handlers[type].length-1; i>=0; i--) {
            let list_actor = this.handlers[type][i][0];
            if(actor == list_actor)
                this.handlers[type].splice(i, 1);
        }
    },

    /**
     * Switches workspaces and shows the switcher overlay.
     */
    _onScrollEventSwitcher: function(actor, event) {
	switch (event.get_scroll_direction()) {
	case Clutter.ScrollDirection.UP:
            this._showWorkspaceSwitcher('switch-to-workspace-up');
            return true;
	case Clutter.ScrollDirection.DOWN:
            this._showWorkspaceSwitcher('switch-to-workspace-down');
	    return true;
	}
        return false;
    },

    /**
     * Switches workspaces without showing the switcher overlay.
     * Code taken from js/ui/workspacesView.js:724
     */
    _onScrollEventSafe: function(actor, event) {
        switch (event.get_scroll_direction()) {
        case Clutter.ScrollDirection.UP:
            Main.wm.actionMoveWorkspace(Meta.MotionDirection.UP);
            return true;
        case Clutter.ScrollDirection.DOWN:
            Main.wm.actionMoveWorkspace(Meta.MotionDirection.DOWN);
            return true;
        }
        return false;
    },

    /**
     * Switches worspaces and shows the workspace switcher overlay. Uses
     * non-public functions and may stop working.
     */
    _showWorkspaceSwitcher: function(binding_str) {
        let binding_obj = {
            get_name: function() {
                return binding_str;
            }
        }

        let add_switcher_handler = false;
        if (Main.wm._workspaceSwitcherPopup == null) {
            // Only add the scroll handler when the swichter gets created
            add_switcher_handler = true;
        }

        /* Shows the switcher and scrolls */
        Main.wm._showWorkspaceSwitcher(null, global.screen, null, binding_obj);

        let switcher = Main.wm._workspaceSwitcherPopup;
        if(switcher && add_switcher_handler) {
            this._addActor(switcher.actor, true, 'switcher');
        }
    },

    /**
     * Destroys the Scroller and its actors.
     */
    destroy: function() {
        l('destroying');

        // Remove scroll actors
        for(let name in this.edge_actors) {
            let actor = this.edge_actors[name];
	    Main.layoutManager.removeChrome(actor);
	    actor.destroy();
        }
        this.edge_actors = null;

        this._disableBackgroundScrolling();

        for(let name in this.handlers)
            this._disconnectHandlerList(this.handlers[name]);

        this.handlers = null;
    }
}

function init() {
    Convenience.initTranslations();
    settings = Convenience.getSettings();
}

function enable() {
    desktopscroller = new Scroller();
}

function disable() {
    desktopscroller.destroy();
    desktopscroller = null;
}
