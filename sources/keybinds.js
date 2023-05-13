"use strict";

const GObject = imports.gi.GObject;
const Main = imports.ui.main;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;
const ExtensionUtils = imports.misc.extensionUtils;

var KeyboardManager = GObject.registerClass(
	class KeyboardManager extends GObject.Object {
		_init(state, renderer) {
			super._init();
			this._state = state;
			this._renderer = renderer;
		}

		/**
		 * @param {string} key
		 * @param {() => void} action
		 */
		_addBinding(key, action) {
			const settings = ExtensionUtils.getSettings(
				"org.gnome.shell.extensions.fairy.keybinds"
			);

			Main.wm.addKeybinding(
				key,
				settings,
				Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
				Shell.ActionMode.NORMAL,
				action
			);
		}

		/**
		 * @param {string} key
		 */
		_removeBinding(key) {
			Main.wm.removeKeybinding(key);
		}

		enable() {
			this._addBinding("set-layout-tiling", () => {
				const mon = global.display.get_current_monitor();
				const state = this._state.monitors[mon];
				state.layout = "tiling";
				this._renderer.render(mon);
			});
			this._addBinding("set-layout-monocle", () => {
				const mon = global.display.get_current_monitor();
				const state = this._state.monitors[mon];
				state.layout = "monocle";
				this._renderer.render(mon);
			});
			this._addBinding("set-layout-floating", () => {
				const mon = global.display.get_current_monitor();
				const state = this._state.monitors[mon];
				state.layout = "floating";
				this._renderer.render(mon);
			});

			this._addBinding("incrmfact", () => {
				const mon = global.display.get_current_monitor();
				const state = this._state.monitors[mon];
				state.mfact = Math.min(95, state.mfact + 5);
				this._renderer.render(mon);
			});
			this._addBinding("decmfact", () => {
				const mon = global.display.get_current_monitor();
				const state = this._state.monitors[mon];
				state.mfact = Math.max(5, state.mfact - 5);
				this._renderer.render(mon);
			});

			this._addBinding("incrnmaster", () => {
				const mon = global.display.get_current_monitor();
				this._state.monitors[mon].nmaster += 1;
				this._renderer.render(mon);
			});
			this._addBinding("decnmaster", () => {
				const mon = global.display.get_current_monitor();
				if (this._state.monitors[mon].nmaster > 0)
					this._state.monitors[mon].nmaster -= 1;
				this._renderer.render(mon);
			});
		}

		disable() {
			this._removeBinding("set-layout-tiling");
			this._removeBinding("set-layout-monocle");
			this._removeBinding("set-layout-floating");

			this._removeBinding("incrmfact");
			this._removeBinding("decrmfact");
			this._removeBinding("incrnmaster");
			this._removeBinding("decrnmaster");
		}
	}
);
