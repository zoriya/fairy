"use strict";

const { Adw, Gio, Gtk } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

function init() { }

function fillPreferencesWindow(window) {
	const settings = ExtensionUtils.getSettings(
		"org.gnome.shell.extensions.fairy"
	);

	const page = new Adw.PreferencesPage();
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

	window.add(page);
}
