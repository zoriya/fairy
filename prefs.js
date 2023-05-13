"use strict";

const { Adw, Gio, Gtk } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

function init() { }

function _createKeybind(settings, keybind) {
	// TODO: Set the title to the gsettings's title.
	const row = new Adw.ActionRow({ title: keybind });

	// TODO: Implement a shortcut selector here.
	const listener = new Gtk.Switch({});
	// settings.bind(keybind, listener, );
	row.add_suffix(listener);
	row.activable_widget = listener;
	return row
}

function fillPreferencesWindow(window) {
	const settings = ExtensionUtils.getSettings(
		"org.gnome.shell.extensions.fairy"
	);

	const page = new Adw.PreferencesPage();
	page.set_title("General");
	const group = new Adw.PreferencesGroup();
	page.add(group);

	const row = new Adw.ActionRow({ title: "Show Layout Indicator" });
	group.add(row);

	const toggle = new Gtk.Switch({
		active: settings.get_boolean("show-layout"),
		valign: Gtk.Align.CENTER,
	});
	settings.bind(
		"show-layout",
		toggle,
		"active",
		Gio.SettingsBindFlags.DEFAULT
	);

	row.add_suffix(toggle);
	row.activatable_widget = toggle;

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
