const Gio = imports.gi.Gio;
const St = imports.gi.St;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;

const State = Me.imports.sources.state;
const Renderer = Me.imports.sources.renderer;
const Keybinds = Me.imports.sources.keybinds;
const Indicator = Me.imports.sources.indicator;

class Extension {
	constructor() {
		this._state = new State.StateManager();
		this._renderer = new Renderer.Renderer(this._state);
		this._keybinds = new Keybinds.KeyboardManager(this._state, this._renderer);
		this._indicator = new Indicator.Indicator(this._state, this._renderer);
	}

	enable() {
		this._renderer.enable();
		this._keybinds.enable();
		this._indicator.enable();
	}

	disable() {
		this._renderer.disable();
		this._keybinds.disable();
		this._indicator.disable();
	}
}

function init() {
	return new Extension();
}
