"use strict";

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const State = Me.imports.sources.state;
const Renderer = Me.imports.sources.renderer;
const Keybinds = Me.imports.sources.keybinds;
const Indicator = Me.imports.sources.indicator;
const Border = Me.imports.sources.border;

class Extension {
	constructor() {
		this._state = new State.StateManager();
		this._settings = ExtensionUtils.getSettings("org.gnome.shell.extensions.fairy");

		this._border = new Border.BorderManager(this._state, this._settings);
		this._indicator = new Indicator.Indicator(this._state, this._renderer, this._keybinds);
		this._renderer = new Renderer.Renderer(this._state, this._settings, this._indicator, this._border);
		this._keybinds = new Keybinds.KeyboardManager(this._state, this._renderer, this._indicator);

		this._indicator.endInit(this);
	}

	enable() {
		this._border.enable();
		this._renderer.enable();
		this._keybinds.enable();
		this._indicator.enable();
	}

	disable() {
		this._renderer.disable();
		this._keybinds.disable();
		this._indicator.disable();
		this._border.disable();
	}
}

function init() {
	return new Extension();
}
