// Desktop Scroller.
// Copyright (C) 2011-2012 Marcos Diaz <diazmencia@gmail.com>.
// Copyright (C) 2012 Arnaud Bonatti <arnaud.bonatti@gmail.com>.
// Copyright (C) 2012 Bruno Orlandi <brorlandi@gmail.com>.
//
// Desktop Scroller is libre software: you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation, either version 2 of the License, or newer.
//
// You should have received a copy of the GNU General Public License along with
// this file. If not, see <http://www.gnu.org/licenses/>.

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

const ScrollPosition = {
    RIGHT: 1,
    LEFT: 2,
    TOP: 3,
    BOTTOM: 4,
};

const SCROLL_POSITION  = 'scroll-position';
const SCROLL_DELAY = 'scroll-delay';
const SCROLL_WIDTH = 1;

function Scroller() {
    this._init();
}

Scroller.prototype = {
    _init : function() {
        this.actors = [];

	var monitors = Main.layoutManager.monitors;

        var max_right = -Infinity;
        var min_left = Infinity;
        var left_monitor = null;
        var right_monitor = null;

        /* Find the left-most and right-most monitor */
        for(var i=0; i<monitors.length; i++) {
            var left = monitors[i].x;
            var right = monitors[i].x + monitors[i].width;
            if(left < min_left) {
                min_left = left;
                left_monitor = monitors[i];
            }
            if(right > max_right) {
                max_right = right;
                right_monitor = monitors[i];
            }
        }

        if(!left_monitor || !right_monitor) {

        }

        var actor = this._createScrollArea(left_monitor, ScrollPosition.LEFT);
        this._addActor(actor);
        actor = this._createScrollArea(right_monitor, ScrollPosition.RIGHT);
        this._addActor(actor);
    },

    _createScrollArea: function(monitor, type) {
        var y_offset = 0;
        /* Make sure we don't go over the panel */
        if(monitor == Main.layoutManager.primaryMonitor)
            y_offset = Main.panel.actor.get_height() + Main.panel._leftCorner.actor.get_height();

        /* Default values for the left side */
	var x = 0;
	var y = y_offset;
	var width = SCROLL_WIDTH;
	var height = monitor.height - y;

        switch (type) {
	case ScrollPosition.LEFT:
            break;

	case ScrollPosition.RIGHT:
	    x = monitor.x + monitor.width - width;
	    break;
	}

	var actor = new Clutter.Rectangle({
	    name: 'scroller_' + type,
	    reactive: true,
            opacity: 0,
            x: x,
            y: y,
            height: height,
            width: width
	});

        return actor;
    },

    _addActor: function(actor) {
        actor.connect('scroll-event', Lang.bind(this, this._onScrollEventSwitcher));
	Main.layoutManager.addChrome(actor, { /* visibleInFullscreen:true */ });
        this.actors.push(actor);
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

        /* Shows the switcher and scrolls */
        Main.wm._showWorkspaceSwitcher(null, global.screen, null, binding_obj);

        /* The workspace switcher is on top our scroll actors. Move them
           to the top. */
        for(let i=0; i<this.actors.length; i++) {
            this.actors[i].raise_top();
        }
    },

    /**
     * Destroys the Scroller and its actors.
     */
    destroy: function() {
        for(var i=0; i<this.actors.length; i++) {
            var actor = this.actors[i];
	    Main.layoutManager.removeChrome(actor);
	    actor.destroy();
        }
        this.actors = null;
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
