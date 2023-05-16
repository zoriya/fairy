"use strict";

const Gio = imports.gi.Gio;
const St = imports.gi.St;

const GObject = imports.gi.GObject;
const Main = imports.ui.main;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;
const PanelMenu = imports.ui.panelMenu;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

var Indicator = GObject.registerClass(
	class Indicator extends GObject.Object {
		_init(state, renderer) {
			super._init();
			this._state = state;
			this._renderer = renderer;

			this._layoutIcons = {
				tiling: Gio.icon_new_for_string(`${Me.path}/icons/tiling.svg`),
				monocle: Gio.icon_new_for_string(`${Me.path}/icons/monocle.svg`),
				floating: Gio.icon_new_for_string(`${Me.path}/icons/floating.svg`),
				deck: Gio.icon_new_for_string(`${Me.path}/icons/deck.svg`),
			};
		}

		enable() {
			this.settings = ExtensionUtils.getSettings(
				"org.gnome.shell.extensions.fairy"
			);

			const indicatorName = `${Me.metadata.name} Indicator`;
			this._layoutIndicator = new PanelMenu.Button(0.0, indicatorName);
			this._icon = new St.Icon({
				gicon: this._layoutIcons.tiling,
				style_class: "system-status-icon",
			});
			this._layoutIndicator.add_child(this._icon);

			this.settings.bind(
				"show-layout",
				this._layoutIndicator,
				"visible",
				Gio.SettingsBindFlags.DEFAULT
			);
			Main.panel.addToStatusArea(indicatorName, this._layoutIndicator);
		}

		disable() {
			this._layoutIndicator.destroy();
			this._layoutIndicator = null;
			this._icon = null;

			this.settings = null;
		}

		update() {
			const primaryMon = global.display.get_primary_monitor();
			this._icon.gicon = this._layoutIcons[this._state.monitors[primaryMon].layout];
		}
	}
);
