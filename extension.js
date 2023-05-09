const Gio = imports.gi.Gio;
const St = imports.gi.St;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;

const Windows = Me.imports.sources.windows;

class Extension {
	constructor() {
		this._layoutIndicator = null;
		this._windows = new Windows.WindowManager();
	}

	enable() {
		this._windows.enable();

		this.settings = ExtensionUtils.getSettings(
			"org.gnome.shell.extensions.fairy"
		);

		let indicatorName = `${Me.metadata.name} Layout Indicator`;

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
		this._windows.disable();
		this._layoutIndicator.destroy();
		this._layoutIndicator = null;

		this.settings = null;
	}
}

function init() {
	return new Extension();
}
