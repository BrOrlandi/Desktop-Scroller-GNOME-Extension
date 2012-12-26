/**
 These preferences menu for the Desktop Scroller are made by Bruuno Orlandi, brorlandi@gmail.com.
*/
/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */

/* most of the code is borrowed from
 * > js/ui/altTab.js <
 * of the gnome-shell source code
 */

const Gdk = imports.gi.Gdk;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;
const Lang = imports.lang;

const Gettext = imports.gettext.domain('gnome-shell-extensions');
const _ = Gettext.gettext;
const N_ = function(e) { return e };

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

const SCROLL_POSITION = 'scroll-position';
const SCROLL_DELAY = 'scroll-delay';


const POSITIONS = {
    right: N_("Right"),
    left: N_("Left"),
    top: N_("Top"),
    bottom: N_("Bottom")
};

const DesktopScrollerSettingsWidget = new GObject.Class({
    Name: 'DesktopScroller.Prefs.DesktopScrollerSettingsWidget',
    GTypeName: 'DesktopScrollerSettingsWidget',
    Extends: Gtk.Grid,

    _init : function(params) {
        this.parent(params);
        this.margin = 10;
	this.orientation = Gtk.Orientation.VERTICAL;

        this._settings = Convenience.getSettings();

        this.add(new Gtk.Label({ label: _("Scroll position on the screen"), sensitive: true,
                                 margin_bottom: 10, margin_top: 5 }));

        let top = 1;
        let radio = null;
        let currentPos = this._settings.get_string(SCROLL_POSITION);
        for (let pos in POSITIONS) {
            let posCapture = pos;
            let name = Gettext.gettext(POSITIONS[pos]);

            radio = new Gtk.RadioButton({ group: radio, label: name, valign: Gtk.Align.START });
            radio.connect('toggled', Lang.bind(this, function(widget) {
                if (widget.active)
                    this._settings.set_string(SCROLL_POSITION, posCapture);
            }));
            this.add(radio);

            if (pos == currentPos)
                radio.active = true;
            top += 1;
        }

	let check = new Gtk.CheckButton({ label: _("Delay time on transition between workspaces."),
					  margin_top: 12 });
	this._settings.bind(SCROLL_DELAY, check, 'active', Gio.SettingsBindFlags.DEFAULT);
	this.add(check);
	
    this.add(new Gtk.Label({ label: _("Warning: Changing the position requires that the extension be reenabled!"), sensitive: true, margin_top: 40, margin_left: 40 }));
	
    },
});

function init() {
    Convenience.initTranslations();
}

function buildPrefsWidget() {
    let widget = new DesktopScrollerSettingsWidget();
    widget.show_all();

    return widget;
}
