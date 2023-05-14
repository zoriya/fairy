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
			this._addBinding("set-layout-tiling", () => this._switchLayout("tiling"));
			this._addBinding("set-layout-monocle", () =>
				this._switchLayout("monocle")
			);
			this._addBinding("set-layout-floating", () =>
				this._switchLayout("floating")
			);

			this._addBinding("cycle-prev", () => {
				const mon = global.display.get_current_monitor();
				const state = this._state.monitors[mon];
				const idx = this._state.workIndexByHandle(state.focused);
				const newW = this._state.workIndex(mon, state.tags, idx + 1);
				this._state.focus(newW.handle);
			});
			this._addBinding("cycle-next", () => {
				const mon = global.display.get_current_monitor();
				const state = this._state.monitors[mon];
				const idx = this._state.workIndexByHandle(state.focused);
				const win = this._state.workIndex(mon, state.tags, idx - 1);
				this._state.focus(win.handle);
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

			this._addBinding("swap-prev", () => {
				const mon = global.display.get_current_monitor();
				const state = this._state.monitors[mon];
				const idx = this._state.workIndexByHandle(state.focused);
				this._state.swap(mon, state.tags, idx, idx + 1);
				this._renderer.render(mon);
			});
			this._addBinding("swap-next", () => {
				const mon = global.display.get_current_monitor();
				const state = this._state.monitors[mon];
				const idx = this._state.workIndexByHandle(state.focused);
				this._state.swap(mon, state.tags, idx, idx - 1);
				this._renderer.render(mon);
			});
			this._addBinding("zoom", () => {
				const mon = global.display.get_current_monitor();
				const state = this._state.monitors[mon];
				const idx = this._state.workIndexByHandle(state.focused);

				// if the master is not focused
				if (idx !== 0) this._state.swap(mon, state.tags, idx, 0);
				else this._state.swap(mon, state.tags, idx, state.beforeZoom);
				state.beforeZoom = idx;
				this._renderer.render(mon);
			});

			for (const tagNbr = 1; tagNbr < 10; tagNbr++) {
				const tag = 0b1 << tagNbr;

				this._addBinding(`set-tag-${tagNbr}`, () => {
					const mon = global.display.get_current_monitor();
					this._renderer.setTags(mon, tag);
				});
				this._addBinding(`add-tag-${tagNbr}`, () => {
					const mon = global.display.get_current_monitor();
					const currTags = this._state.monitors[mon].tags;
					// Add the tag to the monitor but if the tag is already present, remove it
					// Do not allow 0 tags to be present.
					this._renderer.setTags(
						mon,
						currTags & tag && currTags !== tag
							? currTags & ~tag
							: currTags | tag
					);
				});
			}
			this._addBinding("set-tag-all", () => {
				const mon = global.display.get_current_monitor();

				const takkenTags = 0;
				for (const i = 0; i < this._state.monitors.length; i++)
					takkenTags |= this._state.monitors[i];

				this._state.monitors[mon].tags |= ~takkenTags;
				this._renderer.render(mon);
			});
		}

		disable() {
			this._removeBinding("set-layout-tiling");
			this._removeBinding("set-layout-monocle");
			this._removeBinding("set-layout-floating");

			this._removeBinding("cycle-next");
			this._removeBinding("cycle-prev");

			this._removeBinding("incrmfact");
			this._removeBinding("decrmfact");
			this._removeBinding("incrnmaster");
			this._removeBinding("decrnmaster");

			this._removeBinding("swap-next");
			this._removeBinding("swap-prev");
			this._removeBinding("zoom");

			for (const i = 1; i < 10; i++) {
				this._removeBinding(`set-tag-${i}`);
				this._removeBinding(`add-tag-${i}`);
			}
			this._removeBinding("set-tag-all");
		}

		_switchLayout(mode) {
			const mon = global.display.get_current_monitor();
			const state = this._state.monitors[mon];
			const currentLayout = state.layout;
			if (state.layout === mode) state.layout = state.oldLayout;
			else state.layout = mode;
			state.oldLayout = currentLayout;
			this._renderer.render(mon);
		}
	}
);
