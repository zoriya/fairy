"use strict";

const GObject = imports.gi.GObject;
const Main = imports.ui.main;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

var Indicator = GObject.registerClass(
	class Indicator extends GObject.Object {
		_init(state, renderer) {
			super._init();
			this._state = state;
			this._renderer = renderer;
		}

		enable() {
			this.settings = ExtensionUtils.getSettings(
				"org.gnome.shell.extensions.fairy"
			);

			let indicatorName = `${Me.metadata.name} Indicator`;

			this._layoutIndicator = new PanelMenu.Button(0.0, indicatorName, false);

			// Add an icon
			let icon = new St.Icon({
				gicon: new Gio.ThemedIcon({ name: "face-laugh-symbolic" }),
				style_class: "system-status-icon",
			});
			this._layoutIndicator.add_child(icon);

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

			this.settings = null;
		}
	}
);
