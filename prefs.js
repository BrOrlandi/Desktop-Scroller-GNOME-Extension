/**
 * These preferences menu for the Desktop Scroller are made by Bruuno Orlandi,
 * brorlandi@gmail.com.
 * Most of the code is borrowed from js/ui/altTab.js  of the gnome-shell source
 * code.
 */

/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */

import Gtk from 'gi://Gtk'
import Gio from 'gi://Gio'
import GObject from 'gi://GObject'

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
const N_ = function(e) { return e };

const SCROLL_EDGES = 'scroll-edges';
const DESKTOP_SCROLL = 'desktop-scroll';

const EDGES = {
    left: { flag: 1 << 0, name: N_("Left") },
    right: { flag: 1 << 1, name: N_("Right") },
    top: { flag: 1 << 2, name: N_("Top") },
    bottom: { flag: 1 << 3, name: N_("Bottom") },
};

const DesktopScrollerSettingsWidget = new GObject.Class({
    Name: 'DesktopScroller.Prefs.DesktopScrollerSettingsWidget',
    GTypeName: 'DesktopScrollerSettingsWidget',
    Extends: Gtk.Grid,

    _init: function(params) {
        this.parent(params);

        this.margin = this.row_spacing = this.column_spacing = 10;
        this._settings = ExtensionPreferences.lookupByUUID('desktop-scroller@brorlandi').getSettings()

        // Wallpaper scrolling
        let label = new Gtk.Label({
            label: _("Wallpaper Scrolling"),
            wrap: true,
            xalign: 0.0
        });
        let wallpaperSwitch = new Gtk.Switch({ halign: Gtk.Align.START });
        wallpaperSwitch.active = this._settings.get_boolean(DESKTOP_SCROLL);
        this._settings.bind(DESKTOP_SCROLL, wallpaperSwitch, 'active',
            Gio.SettingsBindFlags.DEFAULT);

        this.attach(label, 0, 0, 1, 1);
        this.attach(wallpaperSwitch, 1, 0, 1, 1);

        // Enabled edges
        label = new Gtk.Label({
            label: _("Enabled Edges"),
            wrap: true,
            xalign: 0.0
        });
        this.attach(label, 0, 1, 1, 1);

        let left = 0;
        let check = null;

        let checkGrid = new Gtk.Grid({ halign: Gtk.Align.START });
        checkGrid.margin = checkGrid.row_spacing = checkGrid.column_spacing = 10;

        for (let edge_key in EDGES) {
            let edge = EDGES[edge_key];

            check = new Gtk.CheckButton({
                label: _(edge.name),
                halign: Gtk.Align.START
            });
            checkGrid.attach(check, left, 1, 1, 1);

            check.connect('toggled', function foobar(widget) {
                if (widget.active) {
                    DesktopScrollerPreferences.enableEdge(this._settings, edge);
                } else {
                    DesktopScrollerPreferences.disableEdge(this._settings, edge);
                }
            }.bind(this));

            check.active = DesktopScrollerPreferences.isEdgeEnabled(this._settings, edge);

            left += 1;
        }

        this.attach(checkGrid, 1, 1, 1, 1);
    },
});

export default class DesktopScrollerPreferences extends ExtensionPreferences {
    static getEnabledEdges(settings) {
        return settings.get_flags(SCROLL_EDGES);
    }

    static isEdgeEnabled(settings, edge) {
        let edges = this.getEnabledEdges(settings);
        return edges & edge.flag;
    }

    static disableEdge(settings, edge) {
        let edges = this.getEnabledEdges(settings);
        edges = edges & ~edge.flag;
        settings.set_flags(SCROLL_EDGES, edges);
    }

    static enableEdge(settings, edge) {
        let edges = this.getEnabledEdges(settings);
        edges = edges | edge.flag;
        settings.set_flags(SCROLL_EDGES, edges);
    }

    constructor(metadata) {
        super(metadata)
        this.initTranslations()
    }

    getPreferencesWidget() {
        let widget = new DesktopScrollerSettingsWidget();

        return widget;
    }
}