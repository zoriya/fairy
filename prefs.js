"use strict";

const { Adw, Gio, Gtk } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

function init() {}

function _createKeybind(settings, keybind) {
	// TODO: Set the title to the gsettings's title.
	const row = new Adw.ActionRow({ title: keybind });

	// TODO: Implement a shortcut selector here.
	const listener = new Gtk.Switch({});
	// settings.bind(keybind, listener, );
	row.add_suffix(listener);
	row.activable_widget = listener;
	return row;
}

function _createBool(settings, { title, key }) {
	const row = new Adw.ActionRow({ title: title });

	const toggle = new Gtk.Switch({
		active: settings.get_boolean(key),
		valign: Gtk.Align.CENTER,
	});
	settings.bind(key, toggle, "active", Gio.SettingsBindFlags.DEFAULT);

	row.add_suffix(toggle);
	row.activatable_widget = toggle;
	return row;
}

function _createUint(settings, { title, key }) {
	const row = new Adw.ActionRow({ title: title });

	const input = new Gtk.SpinButton({
		adjustment: new Gtk.Adjustment({
			lower: 0,
			upper: 100,
			step_increment: 1,
			value: settings.get_uint(key),
		}),
	});
	settings.bind(key, input, "value", Gio.SettingsBindFlags.DEFAULT);

	row.add_suffix(input);
	row.activatable_widget = input;
	return row;
}

function fillPreferencesWindow(window) {
	const settings = ExtensionUtils.getSettings(
		"org.gnome.shell.extensions.fairy"
	);

	const page = new Adw.PreferencesPage();
	page.set_title("General");

	const general = new Adw.PreferencesGroup();
	page.add(general);
	general.add(
		_createBool(settings, {
			title: "Show Layout Indicator",
			key: "show-layout",
		})
	);

	const gaps = new Adw.PreferencesGroup();
	page.add(gaps);
	gaps.add(
		_createUint(settings, {
			title: "Gap size",
			key: "gap-size",
		})
	);
	gaps.add(
		_createUint(settings, {
			title: "Outer gap size",
			key: "outer-gap-size",
		})
	);
	gaps.add(
		_createBool(settings, {
			title: "Smart gaps",
			key: "smart-gaps",
		})
	);

	const keybinds = new Adw.PreferencesPage();
	keybinds.set_title("Keybinds");

	const layoutBindings = new Adw.PreferencesGroup();
	keybinds.add(layoutBindings);
	layoutBindings.add(_createKeybind(settings, "set-layout-tiling"));
	layoutBindings.add(_createKeybind(settings, "set-layout-monocle"));
	layoutBindings.add(_createKeybind(settings, "set-layout-floating"));

	const focusBindings = new Adw.PreferencesGroup();
	keybinds.add(focusBindings);
	focusBindings.add(_createKeybind(settings, "cycle-next"));
	focusBindings.add(_createKeybind(settings, "cycle-prev"));

	const swapBindings = new Adw.PreferencesGroup();
	keybinds.add(swapBindings);
	swapBindings.add(_createKeybind(settings, "swap-next"));
	swapBindings.add(_createKeybind(settings, "swap-prev"));
	swapBindings.add(_createKeybind(settings, "zoom"));

	const tileBindings = new Adw.PreferencesGroup();
	keybinds.add(tileBindings);
	tileBindings.add(_createKeybind(settings, "incrmfact"));
	tileBindings.add(_createKeybind(settings, "decmfact"));
	tileBindings.add(_createKeybind(settings, "incrnmaster"));
	tileBindings.add(_createKeybind(settings, "decnmaster"));

	window.add(page);
	window.add(keybinds);
}
