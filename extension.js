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

const Gdk = imports.gi.Gdk;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;
const Gettext = imports.gettext.domain('gnome-shell-extensions');
const _ = Gettext.gettext;

const Clutter					= imports.gi.Clutter
const Lang						= imports.lang
const Main						= imports.ui.main
const Mainloop					= imports.mainloop
const Meta						= imports.gi.Meta
const WorkspaceSwitcherPopup	= imports.ui.workspaceSwitcherPopup

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

let settings;

const ScrollPosition = {
    RIGHT: 1,
    LEFT: 2,
    TOP: 3,
    BOTTOM: 4,
};

const SCROLL_POSITION  = 'scroll-position';
const SCROLL_DELAY = 'scroll-delay';

const SCROLL_WIDTH = 1;
var waiter_ms	= 0

function Scroller() { this._init() }

Scroller.prototype = {
    _init : function() {
		
		this.actor = new Clutter.Rectangle({
			name: 'scroller',
			reactive: true
		})

		var monitor = Main.layoutManager.primaryMonitor;
		
		var width = SCROLL_WIDTH;
		var height = monitor.height - 30;
		var x = monitor.width - width;
		var y = 30;

        switch (settings.get_enum(SCROLL_POSITION)) {
	    case ScrollPosition.RIGHT:
		    width = SCROLL_WIDTH;
		    height = monitor.height - 30;
		    x = monitor.width - width;
		    y = 30;	
		    break;
		    
	    case ScrollPosition.LEFT:
		    width = SCROLL_WIDTH;
		    height = monitor.height - 30;
		    x = 0;
		    y = 30;	
		    break;
		    
	    case ScrollPosition.TOP:
		    width = monitor.width-20;
		    height = SCROLL_WIDTH;
		    x = 20;
		    y = 0;	
		    break;
		    
	    case ScrollPosition.BOTTOM:
		    width = monitor.width;
		    height = SCROLL_WIDTH;
		    x = 0;	
		    y = monitor.height - height;
		    break;
		    
		}


		this.actor.set_position(x,y);
		this.actor.set_width(width);
		this.actor.set_height(height);
		this.actor.opacity = 0;
		
		this.actor._delegate = this
		this._timeoutId = null
		
		this.actor.connect('scroll-event', function(actor, event) {
			if (!actor._delegate._timeoutId) {
				// see js/ui/workspacesView.js:1042
				switch (event.get_scroll_direction()) {
				case Clutter.ScrollDirection.UP:
					actor._delegate._doScroll(Meta.MotionDirection.UP)
					break
				case Clutter.ScrollDirection.DOWN:
					actor._delegate._doScroll(Meta.MotionDirection.DOWN)
					break
				}
			}
		})
		
		Main.layoutManager.addChrome(this.actor, { /* visibleInFullscreen:true */ })
	},
	
	_doScroll: function(direction) {
		let newWs = Main.wm.actionMoveWorkspace(direction)
		
		// for scrolling more than one time, but not at the same time if Delay Time is checked in extension preferences.
		if(!settings.get_boolean(SCROLL_DELAY)){
		    waiter_ms = 0;
        }
        else
        {
            waiter_ms = 465;
        }
		
		this._timeoutId = Mainloop.timeout_add(waiter_ms, Lang.bind(this, function() { this._timeoutId = null; return false }))
		
		// workspaceSwitcher popup, see js/ui/windowManager.js:575
		if (!Main.overview.visible) {
			if (Main.wm._workspaceSwitcherPopup == null) {
				Main.wm._workspaceSwitcherPopup = new WorkspaceSwitcherPopup.WorkspaceSwitcherPopup()				
				Main.wm._workspaceSwitcherPopup.connect('destroy', function() { Main.wm._workspaceSwitcherPopup = null })
			}
			// The 'workspace-switcher-group' takes all the screen, we should be on top to scroll more than one time
			Main.layoutManager.removeChrome(this.actor)
			Main.layoutManager.addChrome(this.actor, { /* visibleInFullscreen:true */ })
			
			Main.wm._workspaceSwitcherPopup.display(direction, newWs.index())
		}
	},
	
	destroy: function() {
		if (this._timeoutId) Mainloop.source_remove(this._timeoutId)
		this._timeoutId = null
		
		Main.layoutManager.removeChrome(this.actor)
		this.actor.destroy()
	}
}

let desktopscroller
function init() 	{ 
    Convenience.initTranslations();
    settings = Convenience.getSettings();
}
function enable()	{ 
    settings = Convenience.getSettings();
    desktopscroller = new Scroller();
}
function disable()	{ desktopscroller.destroy()
					  desktopscroller = null }
