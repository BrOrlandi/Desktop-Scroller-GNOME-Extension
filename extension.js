// Desktop Scroller.
// Copyright (C) 2011-2012 Marcos Diaz <diazmencia@gmail.com>.
// Copyright (C) 2012 Arnaud Bonatti <arnaud.bonatti@gmail.com>.
// Copyright (C) 2012 Bruno Orlandi <brorlandi@gmail.com>.
// Copyright (C) 2013 Thomas Wendt <thoemy@gmail.com>.
// Copyright (C) 2014 Pawel Mikolajczyk <pawel.b.mikolajczyk@gmail.com>.
//
// Desktop Scroller is libre software: you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation, either version 2 of the License, or newer.
//
// You should have received a copy of the GNU General Public License along with
// this file. If not, see <http://www.gnu.org/licenses/>.

const TAG = 'DesktopScroller'

const Gettext = imports.gettext.domain('desktop-scroller');
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
        this.edge_actors = {left: [], right: [], top: [], bottom: []};
        /**
         * Handler ids added to actors not in our control such as the
         * background.
         */
        this.handlers = {'background' : [], 'switcher' : [], 'misc' : []};

        this.monitors = this._getMonitors();
        this._setupEdgeActors();

        let handler = null;
        let handlerId = null;

        if(settings.get_boolean(KEY_DESKTOP_SCROLL)) {
            if(Main.layoutManager._startingUp) {
                // Wait to make sure all background actors are created
                handler = Lang.bind(this, this._enableBackgroundScrolling);
                handlerId = Main.layoutManager.connect('startup-complete', handler);
                this.handlers['misc'].push([Main.layoutManager, handlerId]);
            } else {
                this._enableBackgroundScrolling();
            }
        }

        // Settings changed handler
        handler = Lang.bind(this, this._onSettingsChanged);
        handlerId = settings.connect('changed', handler);
        this.handlers['misc'].push([settings, handlerId]);

        // Monitor changed handler
        handler = Lang.bind(this, this._onMonitorsChanged);
        handlerId = Main.layoutManager.connect('monitors-changed', handler);
        this.handlers['misc'].push([Main.layoutManager, handlerId]);
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

    _onMonitorsChanged: function() {
        l('Monitors changed');
        this.monitors = this._getMonitors();
        this._setupEdgeActors();

        this._disableBackgroundScrolling();
        if(settings.get_boolean(KEY_DESKTOP_SCROLL))
            this._enableBackgroundScrolling();
    },

    /**
     * Returns a dict with the leftmost, rightmost, topmost and bottommost
     * monitors.
     */
    _getMonitors: function() {
	let monitors = Main.layoutManager.monitors;

        let limits = {'left' : Infinity, 'top' : Infinity,
                      'right' : -Infinity, 'bottom' : -Infinity};

        let monitor_dict = {'left' : null, 'right' : null,
                            'top' : null, 'bottom' : null};

        /**
         * Compares @new_value with the value stored in @limits for the passed
         * @edge key. @cmp indicates if @new_value has to be smaller or bigger
         * than the stored value. If the condition is true the value in @limits
         * is updated and the monitor is added to the @monitor_dict.
         */
        let compare_fcn = function(new_value, edge, cmp, monitor) {
            let condition = false;
            if(cmp == 'min') {
                condition = new_value < limits[edge];
            } else {
                condition = new_value > limits[edge];
            }

            if(condition) {
                limits[edge] = new_value;
                monitor_dict[edge] = [monitor];
            } else if(new_value == limits[edge]) {
                monitor_dict[edge].push(monitor);
            }
        }

        for(var i=0; i<monitors.length; i++) {
            let left = monitors[i].x;
            let right = monitors[i].x + monitors[i].width;
            let top =  monitors[i].y;
            let bottom =  monitors[i].y + monitors[i].height;

            compare_fcn(left, 'left', 'min', monitors[i]);
            compare_fcn(right, 'right', 'max', monitors[i]);
            compare_fcn(top, 'top', 'min', monitors[i]);
            compare_fcn(bottom, 'bottom', 'max', monitors[i]);
        }

        return monitor_dict;
    },

    /**
     * Destroys all actors for the scrolling edges.
     */
    _destroyEdgeActors: function() {
        for(let name in ScrollEdges) {
            let actors = this.edge_actors[name];
            for(let i=0; i<actors.length; i++) {
                l('destroying ' + name + ' actor');
                let actor = this.edge_actors[name][i];

	        Main.layoutManager.removeChrome(actor);
	        actor.destroy();
            }
            this.edge_actors[name] = [];
        }
    },

    /**
     * Creates enabled scroll edges on the monitor belonging to it.
     */
    _setupEdgeActors: function() {
        let edges_setting = settings.get_flags(KEY_SCROLL_EDGES);

        this._destroyEdgeActors();

        for(let name in ScrollEdges) {
            let edge = ScrollEdges[name];
            let enabled = edges_setting & edge.flag;

            if(enabled) {
                let monitors = this.monitors[name];
                for(let i=0; i<monitors.length; i++) {
                    l('creating ' + name + ' actor');

                    let actor = this._createScrollArea(monitors[i], edge);
                    l(name + ': ' + actor.x + 'x' + actor.y + ','
                      + actor.width + 'x' + actor.height);
                    this.edge_actors[name].push(actor);
                    this._addActor(actor);
                }
            }
        }
    },

    _createScrollArea: function(monitor, edge) {
        var y_offset = 0;
        var x_offset = 0;

        /* Make sure we are not over the hot corner */
        if(monitor == Main.layoutManager.primaryMonitor) {
            y_offset = Main.panel.actor.height;
            try {
                x_offset = Main.panel._leftBox.get_children()[0].width;
            } catch(e) {
                x_offset = 100;
                logError(e, 'Could not determine width of left panel box');
            }
        }

        /* Default values for the left side */
	var x = monitor.x;
	var y = monitor.y + y_offset;
	var width = SCROLL_WIDTH;
	var height = monitor.height - y_offset;

        switch (edge) {
	case ScrollEdges.left:
            break;

	case ScrollEdges.right:
	    x = monitor.x + monitor.width - width;
	    break;

        case ScrollEdges.top:
            x = monitor.x + x_offset;
            y = monitor.y;
            width = monitor.width - x_offset;
            height = SCROLL_WIDTH;
            break;

        case ScrollEdges.bottom:
            x = monitor.x;
            y = monitor.y + monitor.height - SCROLL_WIDTH;
            width = monitor.width;
            height = SCROLL_WIDTH;
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

    _onWallpaperChanged: function(manager) {
        l('Wallpaper changed on monitor ', manager._monitorIndex);
        if(settings.get_boolean(KEY_DESKTOP_SCROLL))
            this._addActor(manager.background.actor, true, 'background');
    },

    /**
     * Enables the background scrolling if enabled.
     */
    _enableBackgroundScrolling: function() {
        l('enabling background scrolling');

        let handler = Lang.bind(this, this._onWallpaperChanged);
        try {
            let bgManagers = Main.layoutManager._bgManagers;
            for(let i=0; i<bgManagers.length; i++) {
                let manager = bgManagers[i];
                let actor = manager.backgroundActor;

                // Wallpaper changed signal
                let handler_id = manager.connect('changed', handler);
                this.handlers['background'].push([manager, handler_id]);

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
            l('Disconnecting ', handlerId, ' from ', actor);
            actor.disconnect(handlerId);
        }
    },

    /**
     * _addActor: Add the scroll-event handler to the passed actor.
     * @actor: The actor.
     * @noadd: (optional): Set to true if actor is not under our control.
     * @type: (optional): Type of the actor. For example 'background' or
     *                    'switcher'.
     *
     * Adds the scroll-event handler to an actor. @noadd should be true for
     * actors that are not in the control of this extension. For those actors
     * the handlers have to be removed when destroying the extension.
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
            handler_id = actor.connect('destroy', function(actor, event) {
                self._onActorDestroyed(actor, event, type);
            });
            this.handlers[type].push([actor, handler_id]);
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
            let handler_id = this.handlers[type][i][1];
            if(actor == list_actor) {
                l('Disconnecting ', handler_id, ' from ', list_actor);
                this.handlers[type].splice(i, 1);
            }
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

        this._destroyEdgeActors()
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
